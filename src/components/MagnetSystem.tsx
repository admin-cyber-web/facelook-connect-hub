import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  X, AlertTriangle, MessageCircle, TrendingUp,
  Users, GitBranch, VolumeX, Skull, Check, Loader2,
  Radio, Search, Zap, Globe, ArrowRight, ArrowUpRight, ArrowDownLeft, Trophy, Lock,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MagnetChain {
  id: string;
  post_id: string;
  post_type: string;
  user_id: string;
  invited_by: string | null;
  parent_magnet_id: string | null;
  depth: number;
  is_killed: boolean;
  is_muted: boolean;
  created_at: string;
  profile?: { full_name: string; avatar_url: string | null; username?: string };
  inviter?: { full_name: string; avatar_url: string | null };
}

export interface MagnetVoice {
  id: string;
  post_id: string;
  post_type: string;
  owner_id: string;
  status_text: string | null;
  is_warning: boolean;
  updated_at: string;
  /** NULL = public voice (all chain members see it). UUID = private, only that user sees it. */
  target_user_id?: string | null;
}

interface Friend {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export const formatReach = (n: number): string => {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(1) + "Cr";
  if (n >= 100_000)    return (n / 100_000).toFixed(1) + "L";
  if (n >= 1_000)      return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

const avatarChar = (name?: string | null) => (name || "U")[0].toUpperCase();

export const AvatarPill = ({ url, name, size = 32 }: { url?: string | null; name?: string | null; size?: number }) => (
  <div
    className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black shrink-0 overflow-hidden border-2 border-black"
    style={{ width: size, height: size, fontSize: size / 2.6 }}
  >
    {url ? <img src={url} className="w-full h-full object-cover" alt=""  decoding="async"/> : avatarChar(name)}
  </div>
);

// ── Send notification helper ───────────────────────────────────────────────────
// NOTE: DB column is `notifier_id` (the recipient), NOT `user_id`. `actor_id` is the sender.
async function sendNotification(
  notifierId: string,
  content: string,
  type = "magnet",
  actorId?: string,
  entityId?: string,
) {
  try {
    await supabase.from("notifications").insert({
      notifier_id: notifierId,
      actor_id: actorId ?? null,
      type,
      entity_id: entityId ?? null,
      content,
      is_read: false,
    });
  } catch (_) {}
}

// ── useMagnet hook ─────────────────────────────────────────────────────────────

export function useMagnet(postId: string, postType: string, currentUserId: string | null, channelsActive = false) {
  const [reach, setReach]               = useState(0);
  const [myChainId, setMyChainId]       = useState<string | null>(null);
  const [voice, setVoice]               = useState<MagnetVoice | null>(null);   // backward compat (first active voice)
  const [voices, setVoices]             = useState<MagnetVoice[]>([]);
  const [chains, setChains]             = useState<MagnetChain[]>([]);
  const [firstMagneterId, setFirstMagneterId] = useState<string | null>(null);
  const [lastLinker, setLastLinker]     = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [recentLinkers, setRecentLinkers] = useState<Array<{ full_name: string; avatar_url: string | null }>>([]);
  const [loading, setLoading]           = useState(true);
  const voiceChannelRef                 = useRef<any>(null);
  const reachChannelRef                 = useRef<any>(null);
  const fetchAllRef                     = useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchAll = useCallback(async () => {
    if (!postId) return;
    try {
      // Reach count (unique non-killed)
      const { count } = await supabase
        .from("magnet_chains")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("post_type", postType)
        .eq("is_killed", false);
      setReach(count ?? 0);

      // My own chain entry
      if (currentUserId) {
        const { data: mine } = await supabase
          .from("magnet_chains")
          .select("id")
          .eq("post_id", postId)
          .eq("post_type", postType)
          .eq("user_id", currentUserId)
          .maybeSingle();
        setMyChainId(mine?.id ?? null);
      }

      // All voices for this post — public (no target) + ones targeted at me
      const { data: vRows } = await supabase
        .from("post_magnet_voice")
        .select("id,post_id,post_type,owner_id,status_text,is_warning,updated_at,target_user_id")
        .eq("post_id", postId)
        .eq("post_type", postType);
      const activeVoices = (vRows || []).filter((v: any) =>
        v.status_text && (!v.target_user_id || v.target_user_id === currentUserId)
      ) as MagnetVoice[];
      setVoices(activeVoices);
      setVoice(activeVoices[0] ?? null);  // backward compat

      // First magneter (oldest chain entry, any user)
      const { data: firstEntry } = await supabase
        .from("magnet_chains")
        .select("user_id")
        .eq("post_id", postId)
        .eq("post_type", postType)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setFirstMagneterId(firstEntry?.user_id ?? null);

      // Recent linkers — last 5 non-killed entries; [0] = most recent
      const { data: recentEntries } = await supabase
        .from("magnet_chains")
        .select("user_id, profile:profiles!magnet_chains_user_id_fkey(full_name,avatar_url)")
        .eq("post_id", postId)
        .eq("post_type", postType)
        .eq("is_killed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      const linkerProfiles = ((recentEntries || []) as any[])
        .map((e: any) => e.profile).filter(Boolean);
      setRecentLinkers(linkerProfiles);
      setLastLinker(linkerProfiles[0] ?? null);

    } catch (_) {}
    setLoading(false);
  }, [postId, postType, currentUserId]);

  const fetchChains = useCallback(async () => {
    const { data } = await supabase
      .from("magnet_chains")
      .select(`
        *,
        profile:profiles!magnet_chains_user_id_fkey(full_name,avatar_url,username),
        inviter:profiles!magnet_chains_invited_by_fkey(full_name,avatar_url)
      `)
      .eq("post_id", postId)
      .eq("post_type", postType)
      .order("depth", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(500);
    setChains((data as MagnetChain[]) ?? []);
  }, [postId, postType]);

  // Keep fetchAllRef in sync so channel callbacks always call the latest version
  // without adding fetchAll to the channel useEffect's dependency array
  useEffect(() => { fetchAllRef.current = fetchAll; }, [fetchAll]);

  useEffect(() => {
    if (!postId) return;
    fetchAllRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, postType, currentUserId]);

  // Channels only open when the panel is visible — prevents 40+ idle channels
  // in the feed. Gate on channelsActive so the button still shows reach count.
  useEffect(() => {
    if (!postId || !channelsActive) return;

    const reachCh = supabase
      .channel(`magnet-reach-${postId}-${postType}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "magnet_chains", filter: `post_id=eq.${postId}` },
        () => fetchAllRef.current())
      .subscribe();
    reachChannelRef.current = reachCh;

    const voiceCh = supabase
      .channel(`magnet-voice-${postId}-${postType}`)
      .on("broadcast", { event: "voice_update" }, ({ payload }: any) => {
        // Only process if public (no target) or targeted specifically at me
        const isForMe = !payload.target_user_id || payload.target_user_id === currentUserId;
        if (!isForMe) return;
        setVoices(prev => {
          const existing = prev.findIndex(
            v => v.owner_id === payload.owner_id && (v.target_user_id ?? null) === (payload.target_user_id ?? null)
          );
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = payload as MagnetVoice;
            return next.filter(v => v.status_text);
          }
          return payload.status_text ? [...prev, payload as MagnetVoice] : prev;
        });
        // Update backward-compat single voice (only for public voices)
        if (!payload.target_user_id) {
          setVoice(payload.status_text ? payload as MagnetVoice : null);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_magnet_voice", filter: `post_id=eq.${postId}` },
        () => fetchAllRef.current())
      .subscribe();
    voiceChannelRef.current = voiceCh;

    return () => {
      supabase.removeChannel(reachCh);
      supabase.removeChannel(voiceCh);
      reachChannelRef.current = null;
      voiceChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, postType, currentUserId, channelsActive]);

  return {
    reach, myChainId, voice, voices, chains, firstMagneterId, lastLinker, recentLinkers, loading,
    fetchAll, fetchChains,
    setVoice, setVoices, setReach, setChains,
  };
}

// ── VoiceDisplay ──────────────────────────────────────────────────────────────
// Renders all active voices for a post in the correct visual style

export function VoiceDisplay({
  voices,
  postOwnerId,
  firstMagneterId,
}: {
  voices: MagnetVoice[];
  postOwnerId?: string;
  firstMagneterId?: string | null;
}) {
  const warnings = voices.filter(v => v.is_warning && v.status_text);
  const normals  = voices.filter(v => !v.is_warning && v.status_text);

  if (!voices.length) return null;

  return (
    <>
      {/* Warning Voices — bold overlay strip in middle of post */}
      {warnings.map(v => (
        <motion.div
          key={v.id}
          initial={{ opacity: 0, scaleY: 0.8 }}
          animate={{ opacity: 1, scaleY: 1 }}
          className="relative w-full z-10 flex items-center gap-2 px-4 py-3 my-1"
          style={{
            background: "linear-gradient(90deg,#dc2626,#b91c1c)",
            boxShadow: "0 4px 20px rgba(220,38,38,0.4)",
          }}
        >
          <div style={{ animation: "magnet-pulse-scale 1.2s ease-in-out infinite" }}>
            <AlertTriangle size={16} className="text-yellow-300 shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-[13px] leading-snug">{v.status_text}</p>
            <p className="text-red-200 text-[9px] font-semibold uppercase tracking-widest mt-0.5">
              {v.owner_id === postOwnerId ? "⚡ Post Owner Warning" : "🔗 Chain Alert"}
            </p>
          </div>
        </motion.div>
      ))}

      {/* Normal Voices — blinking pill on right side */}
      {normals.length > 0 && (
        <div className="flex justify-end px-3 gap-1.5 flex-wrap mt-1">
          {normals.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full max-w-[220px]"
              style={{
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <div style={{ animation: "magnet-pulse-opacity 1.5s ease-in-out infinite" }}>
                <Radio size={10} className="text-purple-500 shrink-0" />
              </div>
              <span className="text-purple-700 text-[11px] font-bold truncate">{v.status_text}</span>
              <span className="text-purple-400 text-[8px] font-black shrink-0">
                {v.owner_id === postOwnerId ? "Owner" : "1st🔗"}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

// ── CreatorVoice (backward-compat strip for FlicksFeed etc.) ─────────────────

export function CreatorVoice({ voice }: { voice: MagnetVoice | null }) {
  if (!voice?.status_text) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={voice.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`w-full px-4 py-2 flex items-center gap-2 text-white text-[12px] font-semibold backdrop-blur-md z-50 ${
          voice.is_warning
            ? "bg-red-600/85 border-b border-red-400/40"
            : "bg-black/55 border-b border-white/10"
        }`}
      >
        {voice.is_warning
          ? <AlertTriangle size={13} className="shrink-0 animate-pulse text-yellow-300" />
          : <Radio size={13} className="shrink-0 animate-pulse text-green-400" />
        }
        <span className="truncate flex-1">{voice.status_text}</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── MagnetCluster ─────────────────────────────────────────────────────────────

export function MagnetCluster({ chains }: { chains: MagnetChain[] }) {
  const last5 = chains.slice(-5).reverse();
  if (!last5.length) return null;
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center" style={{ gap: -4 }}>
        {last5.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{ marginTop: i === 0 ? 0 : -8, zIndex: 5 - i }}
          >
            <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={22} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Viral Path Visualization ──────────────────────────────────────────────────

function ViralPath({ chains, postOwnerId }: { chains: MagnetChain[]; postOwnerId: string }) {
  if (!chains.length) {
    return (
      <div className="py-10 flex flex-col items-center text-center text-gray-400">
        <GitBranch size={32} className="mb-3 opacity-30" />
        <p className="font-black text-sm">No chain yet</p>
        <p className="text-[11px] mt-1">Be the first to Link this post!</p>
      </div>
    );
  }

  const byDepth: Record<number, MagnetChain[]> = {};
  chains.forEach(c => { if (!byDepth[c.depth]) byDepth[c.depth] = []; byDepth[c.depth].push(c); });
  const maxDepth = Math.max(...Object.keys(byDepth).map(Number));
  const lastPerson = chains[chains.length - 1];
  const activePeople = chains.filter(c => !c.is_killed);

  return (
    <div>
      {/* Chain Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Total Reach",  value: formatReach(activePeople.length), icon: "🔗" },
          { label: "Viral Depth",  value: `Lv ${maxDepth}`,                  icon: "📡" },
          { label: "Last Linker",  value: lastPerson?.profile?.full_name?.split(" ")[0] || "—", icon: "👤" },
        ].map(s => (
          <div key={s.label} className="bg-purple-50 rounded-xl p-2 text-center border border-purple-100">
            <p className="text-lg mb-0.5">{s.icon}</p>
            <p className="text-purple-700 font-black text-sm leading-none">{s.value}</p>
            <p className="text-purple-400 text-[9px] font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Depth Tree */}
      <div className="overflow-x-auto pb-2">
        {Array.from({ length: maxDepth + 1 }, (_, d) => (
          <div key={d} className="mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 pl-1 flex items-center gap-1">
              {d === 0 ? <><Zap size={9} /> Root</> : <><ArrowRight size={9} /> Level {d}</>}
              <span className="text-gray-300">— {byDepth[d]?.length ?? 0} people</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(byDepth[d] || []).map(c => (
                <motion.div
                  key={c.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-bold ${
                    c.is_killed
                      ? "bg-red-50 border-red-200 text-red-400"
                      : c.is_muted
                      ? "bg-gray-50 border-gray-200 text-gray-400"
                      : c.user_id === postOwnerId
                      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                      : "bg-purple-50 border-purple-200 text-purple-700"
                  }`}
                >
                  <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={18} />
                  <span className="max-w-[80px] truncate">{c.profile?.full_name || "User"}</span>
                  {c.user_id === postOwnerId && <span className="text-[8px]">👑</span>}
                  {c.is_killed && <Skull size={10} className="text-red-400" />}
                  {c.is_muted && <VolumeX size={10} className="text-gray-400" />}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MagnetDashboard ────────────────────────────────────────────────────────────

interface DashboardEntry {
  id: string;
  post_id: string;
  created_at: string;
  profile?: { full_name: string; avatar_url: string | null };
  inviter?: { full_name: string; avatar_url: string | null };
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MagnetDashboard({ currentUserId }: { currentUserId: string | null }) {
  const [sent, setSent]         = useState<DashboardEntry[]>([]);
  const [received, setReceived] = useState<DashboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dashTab, setDashTab]   = useState<"sent" | "received">("sent");
  const [totalSent, setTotalSent]           = useState(0);
  const [totalReceived, setTotalReceived]   = useState(0);

  const fetchDashboardStats = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [sentRes, recvRes] = await Promise.all([
        // SENT: from magnet_invites (who the current user invited)
        supabase
          .from("magnet_invites")
          .select("id, post_id, created_at, profile:profiles!receiver_id(full_name,avatar_url)", { count: "exact" })
          .eq("sender_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50),
        // RECEIVED: magnet_chains where I joined (any invite)
        supabase
          .from("magnet_chains")
          .select("id, post_id, created_at, inviter:profiles!magnet_chains_invited_by_fkey(full_name,avatar_url)", { count: "exact" })
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      // Gracefully handle case where magnet_invites table doesn't exist yet
      if (sentRes.error) {
        // Fall back to magnet_chains invited_by column
        const { data: fbData, count: fbCount } = await supabase
          .from("magnet_chains")
          .select("id, post_id, created_at, profile:profiles!magnet_chains_user_id_fkey(full_name,avatar_url)", { count: "exact" })
          .eq("invited_by", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50);
        setSent(fbData ?? []);
        setTotalSent(fbCount ?? fbData?.length ?? 0);
      } else {
        setSent(sentRes.data ?? []);
        setTotalSent(sentRes.count ?? sentRes.data?.length ?? 0);
      }
      setReceived(recvRes.data ?? []);
      setTotalReceived(recvRes.count ?? recvRes.data?.length ?? 0);
    } catch (_) {}
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => { fetchDashboardStats(); }, [fetchDashboardStats]);

  const list = dashTab === "sent" ? sent : received;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      {/* Stats header */}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">📊 My Link Dashboard</p>
      <div className="flex gap-2 mb-3">
        {[
          { label: "Total Sent",     value: formatReach(totalSent),     bg: "rgba(124,58,237,0.07)",  bd: "rgba(124,58,237,0.18)", tc: "text-purple-700", sc: "text-purple-400" },
          { label: "Total Received", value: formatReach(totalReceived), bg: "rgba(219,39,119,0.07)", bd: "rgba(219,39,119,0.18)", tc: "text-pink-600",   sc: "text-pink-400"   },
        ].map(s => (
          <div key={s.label} className="flex-1 rounded-2xl p-3 text-center border" style={{ background: s.bg, borderColor: s.bd }}>
            <p className={`${s.tc} font-black text-xl leading-none`}>{s.value}</p>
            <p className={`${s.sc} text-[9px] font-black uppercase tracking-wide mt-1`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3">
        {(["sent", "received"] as const).map(t => (
          <button
            key={t}
            onClick={e => { e.stopPropagation(); setDashTab(t); }}
            className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all"
            style={
              dashTab === t
                ? { background: "linear-gradient(90deg,#7c3aed,#db2777)", color: "#fff" }
                : { background: "#f3f4f6", color: "#6b7280" }
            }
          >
            {t === "sent" ? `📤 Sent (${totalSent})` : `📥 Received (${totalReceived})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-purple-400" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-center text-gray-400">
          <GitBranch size={28} className="mb-2 opacity-30" />
          <p className="text-sm font-black">No connections yet</p>
          <p className="text-[11px] mt-1">
            {dashTab === "sent" ? "Link friends to grow your chain 🔗" : "No one has linked you into a chain yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((entry, i) => {
            const person = dashTab === "sent" ? entry.profile : entry.inviter;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-gray-100 bg-gray-50/70 cursor-default"
              >
                <AvatarPill url={person?.avatar_url} name={person?.full_name} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-bold text-sm leading-tight truncate">
                    {person?.full_name || "User"}
                  </p>
                  <p className="text-gray-400 text-[10px] font-semibold flex items-center gap-1 mt-0.5">
                    {dashTab === "sent"
                      ? <ArrowUpRight size={9} className="text-purple-400" />
                      : <ArrowDownLeft size={9} className="text-pink-400" />}
                    {formatTimeAgo(entry.created_at)}
                  </p>
                </div>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                  style={dashTab === "sent"
                    ? { background: "rgba(124,58,237,0.12)", color: "#7c3aed" }
                    : { background: "rgba(219,39,119,0.12)", color: "#db2777" }}
                >
                  {dashTab === "sent" ? "↗" : "↙"}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MagnetLeaderboard ─────────────────────────────────────────────────────────

interface LeaderRow {
  userId: string;
  full_name: string;
  avatar_url: string | null;
  count: number;
}

const RANK_MEDAL = ["🥇", "🥈", "🥉"];
const RANK_COLORS = [
  { bg: "rgba(251,191,36,0.12)", bd: "rgba(251,191,36,0.30)", tc: "#b45309" },
  { bg: "rgba(148,163,184,0.12)", bd: "rgba(148,163,184,0.30)", tc: "#475569" },
  { bg: "rgba(180,120,80,0.12)",  bd: "rgba(180,120,80,0.30)",  tc: "#92400e" },
];

function MagnetLeaderboard({ currentUserId }: { currentUserId: string | null }) {
  const [rows, setRows]         = useState<LeaderRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [myRank, setMyRank]     = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Pull every non-root chain entry with the inviter's profile
        const { data } = await supabase
          .from("magnet_chains")
          .select("invited_by, inviter:profiles!magnet_chains_invited_by_fkey(full_name,avatar_url)")
          .not("invited_by", "is", null)
          .limit(2000);

        if (cancelled || !data) return;

        // Group by invited_by and count
        const map = new Map<string, { full_name: string; avatar_url: string | null; count: number }>();
        for (const row of data) {
          const uid = row.invited_by as string;
          const p   = (row as any).inviter as { full_name: string; avatar_url: string | null } | null;
          if (!uid || !p) continue;
          if (map.has(uid)) {
            map.get(uid)!.count++;
          } else {
            map.set(uid, { full_name: p.full_name || "User", avatar_url: p.avatar_url, count: 1 });
          }
        }

        const sorted: LeaderRow[] = Array.from(map.entries())
          .map(([userId, v]) => ({ userId, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50);

        const rank = sorted.findIndex(r => r.userId === currentUserId);
        setMyRank(rank >= 0 ? rank + 1 : null);
        setRows(sorted);
      } catch (_) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899)" }}>
          <Trophy size={15} className="text-white" />
        </div>
        <div>
          <p className="text-gray-900 font-black text-sm leading-none">Chain Leaderboard</p>
          <p className="text-gray-400 text-[10px] mt-0.5">Global ranking by total links sent</p>
        </div>
        {myRank && (
          <div className="ml-auto px-3 py-1 rounded-full text-[10px] font-black" style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>
            You #{myRank}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-purple-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center text-gray-400">
          <Trophy size={32} className="mb-3 opacity-20" />
          <p className="text-sm font-black">No data yet</p>
          <p className="text-[11px] mt-1">Be the first to start linking!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const isMe    = row.userId === currentUserId;
            const medal   = RANK_MEDAL[i];
            const colors  = RANK_COLORS[i];
            const isTop3  = i < 3;
            return (
              <motion.div
                key={row.userId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all"
                style={
                  isMe
                    ? { background: "rgba(124,58,237,0.10)", borderColor: "rgba(124,58,237,0.30)" }
                    : isTop3
                    ? { background: colors.bg, borderColor: colors.bd }
                    : { background: "#f9f9fb", borderColor: "#ebebf0" }
                }
              >
                {/* Rank */}
                <div className="w-7 shrink-0 flex items-center justify-center">
                  {medal ? (
                    <span className="text-lg leading-none">{medal}</span>
                  ) : (
                    <span className="text-[11px] font-black text-gray-400">#{i + 1}</span>
                  )}
                </div>

                <AvatarPill url={row.avatar_url} name={row.full_name} size={34} />

                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm leading-tight truncate ${isMe ? "text-purple-800" : "text-gray-900"}`}>
                    {row.full_name}{isMe && <span className="ml-1 text-[10px] font-black text-purple-500">YOU</span>}
                  </p>
                  <p className="text-gray-400 text-[10px] font-semibold flex items-center gap-1 mt-0.5">
                    <ArrowUpRight size={9} />
                    {row.count} {row.count === 1 ? "link" : "links"} sent
                  </p>
                </div>

                {/* Bar */}
                <div className="w-14 shrink-0">
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((row.count / rows[0].count) * 100)}%` }}
                      transition={{ delay: i * 0.025 + 0.15, duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: isTop3 ? "linear-gradient(90deg,#7c3aed,#db2777)" : "#a78bfa" }}
                    />
                  </div>
                  <p className={`text-right text-[10px] font-black mt-0.5 ${isTop3 && colors.tc ? "" : "text-purple-600"}`}
                    style={isTop3 ? { color: colors.tc } : {}}>
                    {formatReach(row.count)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MagnetModal ───────────────────────────────────────────────────────────────

interface MagnetModalProps {
  postId: string;
  postType: string;
  postOwnerId: string;
  currentUserId: string;
  reach: number;
  voices: MagnetVoice[];
  voice: MagnetVoice | null;
  chains: MagnetChain[];
  myChainId: string | null;
  firstMagneterId: string | null;
  onClose: () => void;
  onVoiceUpdate: (v: MagnetVoice) => void;
  onVoicesUpdate: (vs: MagnetVoice[]) => void;
  onReachUpdate: (n: number) => void;
  onChainsUpdate: (c: MagnetChain[]) => void;
  onBridgeChat: (userId: string, userName: string) => void;
  fetchChains: () => Promise<void>;
  myName: string;
}

export function MagnetModal({
  postId, postType, postOwnerId, currentUserId, reach, voices, voice,
  chains, myChainId, firstMagneterId, onClose, onVoiceUpdate, onVoicesUpdate,
  onReachUpdate, onChainsUpdate, onBridgeChat, fetchChains, myName,
}: MagnetModalProps) {
  const isOwner        = postOwnerId === currentUserId;
  const isFirstMagneter = firstMagneterId === currentUserId && firstMagneterId !== postOwnerId;
  const canVoice       = isOwner || isFirstMagneter;

  const myVoice = voices.find(v => v.owner_id === currentUserId);

  const [tab, setTab]               = useState<"magnet" | "trace" | "voice" | "leaderboard">("magnet");
  const [allUsers, setAllUsers]     = useState<Friend[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [search, setSearch]         = useState("");
  const [sending, setSending]       = useState(false);
  const [joiningChain, setJoiningChain] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [voiceText, setVoiceText]   = useState(myVoice?.status_text || "");
  const [voiceWarning, setVoiceWarning] = useState(myVoice?.is_warning || false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [traceLoaded, setTraceLoaded] = useState(false);
  const [traceShowAll, setTraceShowAll] = useState(false);
  const [userTab, setUserTab]       = useState<"friends" | "all">("friends");
  const [friends, setFriends]       = useState<Friend[]>([]);
  // Targeted private voice state
  const [targetUserId, setTargetUserId]         = useState("");
  const [targetVoiceText, setTargetVoiceText]   = useState("");
  const [savingTargetVoice, setSavingTargetVoice] = useState(false);
  const voiceChannelRef = useRef<any>(null);

  // Initialise a broadcast-send-only channel — must be subscribed BEFORE
  // saveVoice() runs so we never call .on() after .subscribe() on it.
  // NOTE: name uses "-send" suffix to avoid topic collision with useMagnet's
  // listener channel (same base name without "-send"). Supabase-js returns the
  // existing subscribed channel when topics match — calling .on() on it after
  // .subscribe() throws "cannot add postgres_changes callbacks after subscribe()".
  useEffect(() => {
    if (!postId || !postType) return;
    const sendCh = supabase
      .channel(`magnet-voice-send-${postId}-${postType}`)
      .subscribe();
    voiceChannelRef.current = sendCh;
    return () => {
      supabase.removeChannel(sendCh);
      voiceChannelRef.current = null;
    };
  }, [postId, postType]);

  // Fetch friends + all users
  useEffect(() => {
    (async () => {
      // Fetch friends
      const { data: fships } = await supabase
        .from("friendships")
        .select("sender_id,receiver_id")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq("status", "accepted");
      const friendIds = (fships || []).map(f => f.sender_id === currentUserId ? f.receiver_id : f.sender_id);

      if (friendIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id,full_name,avatar_url,username").in("id", friendIds);
        setFriends((profs as Friend[]) ?? []);
      }

      // Fetch all users (for global magnet)
      const { data: allProfs } = await supabase
        .from("profiles").select("id,full_name,avatar_url,username")
        .neq("id", currentUserId).order("fame_points", { ascending: false }).limit(80);
      setAllUsers((allProfs as Friend[]) ?? []);

      setLoadingUsers(false);
    })();
  }, [currentUserId]);

  // Fetch trace when tab switches
  useEffect(() => {
    if (tab === "trace" && !traceLoaded) {
      fetchChains().then(() => setTraceLoaded(true));
    }
  }, [tab, traceLoaded, fetchChains]);

  const toggleUser = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Self-join chain (global access)
  const joinChain = async () => {
    if (myChainId) { toast("You're already in this chain! 🔗"); return; }
    setJoiningChain(true);
    try {
      // Check if we were directly invited — use that as invited_by
      let invitedBy: string | null = null;
      let joinDepth = 0;
      const { data: myInvite } = await supabase
        .from("magnet_invites")
        .select("sender_id")
        .eq("receiver_id", currentUserId)
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (myInvite?.sender_id) { invitedBy = myInvite.sender_id; joinDepth = 1; }

      await supabase.from("magnet_chains").insert({
        post_id: postId, post_type: postType, user_id: currentUserId,
        invited_by: invitedBy, depth: joinDepth,
      });

      // Notify post owner
      if (postOwnerId !== currentUserId) {
        await sendNotification(
          postOwnerId,
          "joined your viral chain.",
          "magnet_accepted",
          currentUserId ?? undefined,
          postId,
        );
      }

      // Increment magnet_count on post
      try {
        await supabase.rpc("increment_magnet_count", { post_id_input: postId });
      } catch (_) {
        // RPC might not exist — silent fail
      }

      toast.success("🔗 You joined the Link chain!");
      onReachUpdate(reach + 1);
    } catch (err: any) {
      if (err.message?.includes("duplicate")) toast("Already in chain!");
      else toast.error("Failed: " + err.message);
    }
    setJoiningChain(false);
  };

  // Send magnets to selected users
  const sendMagnets = async () => {
    if (!selected.size) return;
    setSending(true);
    try {
      let parentId = myChainId;
      let myDepth  = 0;

      if (!parentId) {
        const { data: myEntry } = await supabase
          .from("magnet_chains")
          .insert({ post_id: postId, post_type: postType, user_id: currentUserId, invited_by: null, depth: 0 })
          .select("id").single();
        parentId = myEntry?.id ?? null;
      } else {
        const { data: me } = await supabase.from("magnet_chains").select("depth").eq("id", parentId).single();
        myDepth = me?.depth ?? 0;
      }

      const rows = Array.from(selected).map(fid => ({
        post_id: postId, post_type: postType, user_id: fid,
        invited_by: currentUserId, parent_magnet_id: parentId, depth: myDepth + 1,
      }));

      await supabase.from("magnet_chains").upsert(rows, { onConflict: "user_id,post_id,post_type", ignoreDuplicates: true });

      // ── Log in magnet_invites (sender_id, receiver_id, post_id) ───────────
      // This powers the Trace panel and Dashboard "Sent" count.
      const inviteRows = Array.from(selected).map(fid => ({
        sender_id:   currentUserId,
        receiver_id: fid,
        post_id:     postId,
      }));
      supabase.from("magnet_invites").upsert(inviteRows, {
        onConflict: "sender_id,receiver_id,post_id",
        ignoreDuplicates: true,
      }).then(({ error: ie }) => {
        if (ie) console.warn("[Magnet] magnet_invites insert failed (run SQL migration):", ie.message);
      });

      // Notify each selected user (private — only they receive this)
      await Promise.all(Array.from(selected).map(uid =>
        sendNotification(
          uid,
          "sent you a viral Link! Open the post to join the chain.",
          "magnet_link",
          currentUserId ?? undefined,
          postId,
        )
      ));

      // Notify post owner (if not self)
      if (postOwnerId !== currentUserId) {
        await sendNotification(
          postOwnerId,
          `linked ${selected.size} ${selected.size > 1 ? "people" : "person"} to your post.`,
          "magnet_accepted",
          currentUserId ?? undefined,
          postId,
        );
      }

      // Increment magnet_count
      try {
        await supabase.rpc("increment_magnet_count", { post_id_input: postId });
      } catch (_) {}

      // Update reach counter
      const { count } = await supabase
        .from("magnet_chains").select("id", { count: "exact", head: true })
        .eq("post_id", postId).eq("post_type", postType).eq("is_killed", false);
      onReachUpdate(count ?? reach + selected.size);

      toast.success(`🔗 Linked ${selected.size} ${selected.size > 1 ? "people" : "person"}!`);
      setSelected(new Set());
      onClose();
    } catch (err: any) {
      toast.error("Link failed: " + (err.message || "try again"));
    }
    setSending(false);
  };

  // Save Voice (for owner OR first magneter)
  const saveVoice = async () => {
    setSavingVoice(true);
    try {
      const payload = {
        post_id: postId, post_type: postType, owner_id: currentUserId,
        status_text: voiceText.trim() || null, is_warning: voiceWarning,
        updated_at: new Date().toISOString(),
      };

      // Check if this user already has a voice entry
      const { data: existing } = await supabase
        .from("post_magnet_voice").select("id")
        .eq("post_id", postId).eq("post_type", postType).eq("owner_id", currentUserId)
        .maybeSingle();

      let saved;
      if (existing?.id) {
        const { data } = await supabase.from("post_magnet_voice").update(payload).eq("id", existing.id)
          .select("id, post_id, post_type, owner_id, status_text, is_warning, updated_at, target_user_id").single();
        saved = data;
      } else {
        const { data } = await supabase.from("post_magnet_voice").insert(payload)
          .select("id, post_id, post_type, owner_id, status_text, is_warning, updated_at, target_user_id").single();
        saved = data;
      }

      if (saved) {
        onVoiceUpdate(saved as MagnetVoice);
        const updated = voices.filter(v => v.owner_id !== currentUserId);
        if (saved.status_text) updated.push(saved as MagnetVoice);
        onVoicesUpdate(updated);

        // Broadcast to all viewers via the already-subscribed voice channel.
        // voiceChannelRef is initialised in a useEffect below — no lazy subscribe needed.
        if (voiceChannelRef.current) {
          voiceChannelRef.current.send({ type: "broadcast", event: "voice_update", payload: saved });
        }
        toast.success("Voice updated live!");
      }
    } catch (err: any) {
      toast.error("Voice save failed: " + err.message);
    }
    setSavingVoice(false);
  };

  const clearVoice = async () => {
    const { data: existing } = await supabase
      .from("post_magnet_voice").select("id")
      .eq("post_id", postId).eq("post_type", postType).eq("owner_id", currentUserId)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from("post_magnet_voice").update({ status_text: null, is_warning: false }).eq("id", existing.id);
    }
    onVoicesUpdate(voices.filter(v => v.owner_id !== currentUserId));
    setVoiceText(""); setVoiceWarning(false);
    toast.success("Voice cleared.");
  };

  // Save a private targeted voice to a specific chain participant
  const saveTargetedVoice = async () => {
    if (!targetUserId || !targetVoiceText.trim()) return;
    setSavingTargetVoice(true);
    try {
      const payload = {
        post_id: postId, post_type: postType, owner_id: currentUserId,
        target_user_id: targetUserId,
        status_text: targetVoiceText.trim(),
        is_warning: false,
        updated_at: new Date().toISOString(),
      };

      // Look for an existing targeted row for this exact recipient
      const { data: existing } = await supabase
        .from("post_magnet_voice").select("id")
        .eq("post_id", postId).eq("post_type", postType)
        .eq("owner_id", currentUserId).eq("target_user_id", targetUserId)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("post_magnet_voice").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("post_magnet_voice").insert(payload);
      }

      // Broadcast so the recipient sees it live (they filter by target_user_id)
      if (voiceChannelRef.current) {
        voiceChannelRef.current.send({ type: "broadcast", event: "voice_update", payload });
      }

      const recipientName = chains.find(c => c.user_id === targetUserId)?.profile?.full_name || "them";
      toast.success(`🔒 Private message sent to ${recipientName}!`);
      setTargetUserId(""); setTargetVoiceText("");
    } catch (err: any) {
      toast.error("Private send failed: " + err.message);
    }
    setSavingTargetVoice(false);
  };

  const toggleBranch = async (chainId: string, field: "is_killed" | "is_muted", cur: boolean) => {
    await supabase.from("magnet_chains").update({ [field]: !cur }).eq("id", chainId);
    onChainsUpdate(chains.map(c => c.id === chainId ? { ...c, [field]: !cur } : c));
  };

  const lastPerson = chains.length ? chains[chains.length - 1] : null;
  const inChain    = new Set(chains.map(c => c.user_id));
  const displayList = (userTab === "friends" ? friends : allUsers)
    .filter(f => f.full_name?.toLowerCase().includes(search.toLowerCase()) || f.username?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { key: "magnet",      label: "🔗 Link"  },
    { key: "trace",       label: "🛤 Trace" },
    { key: "leaderboard", label: "🏆 Board" },
    ...(canVoice ? [{ key: "voice", label: "📢 Voice" }] : []),
  ];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(var(--cap-safe-top) + 16px) 16px calc(var(--cap-safe-bottom) + 16px) 16px", backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-0" style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xl">🔗</span>
              </div>
              <div>
                <h2 className="text-white font-black text-base leading-none">VIRAL CHAIN ENGINE</h2>
                <p className="text-white/70 text-[10px] font-semibold">Powered by Link System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <motion.p key={reach} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                  className="text-white font-black text-xl leading-none">
                  {formatReach(reach)}
                </motion.p>
                <p className="text-white/60 text-[9px] font-black uppercase flex items-center gap-1 justify-end">
                  <TrendingUp size={8} /> Viral Reach
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 text-white">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={`px-4 py-2 text-[11px] font-black rounded-t-xl transition-all ${
                  tab === t.key ? "bg-white text-purple-700" : "text-white/70 hover:text-white"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MAGNET TAB ── */}
          {tab === "magnet" && (
            <div className="p-5">

              {/* Global Join Chain Button */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-4 rounded-2xl border flex items-center gap-3 ${
                  myChainId
                    ? "bg-purple-50 border-purple-200"
                    : "bg-gradient-to-r from-purple-600 to-pink-500 border-transparent"
                }`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: myChainId ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.2)" }}>
                  <Globe size={18} className={myChainId ? "text-purple-500" : "text-white"} />
                </div>
                <div className="flex-1">
                  {myChainId ? (
                    <>
                      <p className="text-purple-700 font-black text-sm">You're in the Chain! ✓</p>
                      <p className="text-purple-400 text-[10px]">Forward to more people below</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white font-black text-sm">Join This Viral Chain</p>
                      <p className="text-white/70 text-[10px]">Anyone can link — no friends needed</p>
                    </>
                  )}
                </div>
                {!myChainId && (
                  <button
                    onClick={joinChain}
                    disabled={joiningChain}
                    className="px-3 py-2 bg-white text-purple-700 rounded-xl text-[11px] font-black shrink-0 flex items-center gap-1 active:scale-95"
                  >
                    {joiningChain ? <Loader2 size={12} className="animate-spin" /> : <span>🔗</span>}
                    Link It!
                  </button>
                )}
              </motion.div>

              {/* Last person bridge */}
              {lastPerson && lastPerson.user_id !== currentUserId && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100 flex items-center gap-3"
                >
                  <AvatarPill url={lastPerson.profile?.avatar_url} name={lastPerson.profile?.full_name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-purple-400 uppercase tracking-wide">Last in Chain</p>
                    <p className="text-gray-800 font-black text-sm truncate">{lastPerson.profile?.full_name || "Someone"}</p>
                    <p className="text-[10px] text-gray-400">Depth {lastPerson.depth}</p>
                  </div>
                  <button
                    onClick={() => { onBridgeChat(lastPerson.user_id, lastPerson.profile?.full_name || "User"); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-[11px] font-black shrink-0"
                  >
                    <MessageCircle size={13} /> Bridge
                  </button>
                </motion.div>
              )}

              {/* Forward Section */}
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Forward to People</p>

              {/* Friend / All toggle */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 mb-3">
                {(["friends", "all"] as const).map(t => (
                  <button key={t} onClick={() => setUserTab(t)}
                    className={`flex-1 py-1.5 text-[11px] font-black rounded-[10px] transition-all ${
                      userTab === t ? "bg-white text-purple-700 shadow-sm" : "text-gray-400"
                    }`}>
                    {t === "friends" ? "👥 Friends" : "🌍 All Users"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-300/40 text-gray-700" />
              </div>

              {/* User List */}
              {loadingUsers ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-purple-400" /></div>
              ) : displayList.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Users size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-black">{userTab === "friends" ? "No friends yet" : "No users found"}</p>
                </div>
              ) : (
                <div className="space-y-1.5 mb-4">
                  {displayList.map(f => {
                    const isSelected     = selected.has(f.id);
                    const alreadyChained = inChain.has(f.id);
                    return (
                      <motion.button key={f.id} whileTap={{ scale: 0.97 }}
                        disabled={alreadyChained}
                        onClick={() => !alreadyChained && toggleUser(f.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all ${
                          alreadyChained ? "bg-gray-50 border-gray-100 opacity-50"
                            : isSelected  ? "bg-purple-50 border-purple-200"
                            : "bg-white border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <AvatarPill url={f.avatar_url} name={f.full_name} size={38} />
                        <div className="flex-1 text-left">
                          <p className="text-gray-900 font-bold text-sm leading-tight">{f.full_name || "User"}</p>
                          {f.username && <p className="text-gray-400 text-[11px]">@{f.username}</p>}
                          {alreadyChained && <p className="text-purple-400 text-[10px] font-black">Already Linked ✓</p>}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? "bg-purple-600 border-purple-600" : "border-gray-300"
                        }`}>
                          {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Send Button */}
              {selected.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onClick={sendMagnets} disabled={sending}
                  className="w-full py-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <span>🔗</span>}
                  {sending ? "Sending…" : `Forward to ${selected.size} ${selected.size > 1 ? "People" : "Person"}`}
                </motion.button>
              )}

              {/* ── My Link Stats Dashboard ──────────────────────────────────── */}
              {chains.length > 0 && (() => {
                const sentByMe      = chains.filter(c => c.invited_by === currentUserId);
                const notForwarded  = sentByMe.filter(c =>
                  !chains.some(c2 => c2.invited_by === c.user_id)
                );
                return (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    {/* Stats row */}
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">📊 My Link Stats</p>
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1 bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
                        <p className="text-purple-700 font-black text-lg leading-none">{sentByMe.length}</p>
                        <p className="text-[9px] text-purple-400 font-black uppercase tracking-wide mt-0.5">Sent</p>
                      </div>
                      <div className="flex-1 bg-pink-50 rounded-2xl p-3 text-center border border-pink-100">
                        <p className="text-pink-600 font-black text-lg leading-none">{reach}</p>
                        <p className="text-[9px] text-pink-400 font-black uppercase tracking-wide mt-0.5">Total Reach</p>
                      </div>
                      <div className="flex-1 bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
                        <p className="text-amber-600 font-black text-lg leading-none">{notForwarded.length}</p>
                        <p className="text-[9px] text-amber-500 font-black uppercase tracking-wide mt-0.5">Idle</p>
                      </div>
                    </div>

                    {/* Non-forwarder list with Resend */}
                    {notForwarded.length > 0 && (
                      <>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Waiting — nudge them 👇</p>
                        <div className="space-y-1.5">
                          {notForwarded.slice(0, 8).map(c => (
                            <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 bg-amber-50/80 rounded-2xl border border-amber-100">
                              <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={28} />
                              <p className="text-gray-800 font-bold text-[12px] flex-1 truncate">{c.profile?.full_name || "User"}</p>
                              <button
                                onClick={async () => {
                                  await sendNotification(c.user_id, "is reminding you to forward this viral post!", "magnet_link", currentUserId ?? undefined, postId);
                                  toast.success("Nudge sent! 🎯");
                                }}
                                className="bg-pink-600 text-white text-xs px-3 py-1 rounded-md font-bold shrink-0 active:scale-95 transition-transform"
                              >
                                Resend
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TRACE TAB ── */}
          {tab === "trace" && (
            <div className="p-5">
              {!traceLoaded ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-purple-400" />
                </div>
              ) : !isOwner && !myChainId ? (
                /* ── ACCESS GATE — only post owner or chain members can view ── */
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "rgba(139,92,246,0.08)", border: "2px solid rgba(139,92,246,0.15)" }}>
                    <Lock size={24} className="text-purple-300" />
                  </div>
                  <p className="font-black text-gray-800 text-base mb-1">Chain Network — Members Only</p>
                  <p className="text-gray-400 text-[12px] max-w-[220px] leading-relaxed">
                    Join the viral chain to unlock the full lineage and see who's in the network.
                  </p>
                  <button onClick={() => setTab("magnet")}
                    className="mt-5 px-7 py-3 rounded-2xl text-white font-black text-sm flex items-center gap-2"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}>
                    <span>🔗</span> Join Chain to Unlock
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Header row ── */}
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide">
                      Chain — {chains.length} {chains.length === 1 ? "person" : "people"}
                    </p>
                    {lastPerson && (
                      <button
                        onClick={e => { e.stopPropagation(); onBridgeChat(lastPerson.user_id, lastPerson.profile?.full_name || "User"); onClose(); }}
                        className="flex items-center gap-1 text-[11px] font-black text-purple-600 px-3 py-1.5 bg-purple-50 rounded-xl"
                      >
                        <MessageCircle size={11} /> Bridge Chat
                      </button>
                    )}
                  </div>

                  {/* ── RECENT JOINERS — top 10 + "More" ─────────────────────── */}
                  {chains.length > 0 && (() => {
                    const sorted = [...chains]
                      .filter(c => !c.is_killed)
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const visible = traceShowAll ? sorted : sorted.slice(0, 10);
                    return (
                      <div className="mb-5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                          🧑‍🤝‍🧑 Recent Joiners — {chains.filter(c => !c.is_killed).length} active
                        </p>
                        <div className="space-y-1.5">
                          {visible.map((c, idx) => (
                            <motion.div
                              key={c.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl border border-gray-100 bg-gray-50/70"
                            >
                              <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={30} />
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-900 font-bold text-[12px] truncate">
                                  {c.profile?.full_name || "User"}
                                  {c.user_id === postOwnerId && <span className="ml-1 text-[9px] text-yellow-600 font-black">👑 Owner</span>}
                                  {c.user_id === currentUserId && <span className="ml-1 text-[9px] text-purple-500 font-black">YOU</span>}
                                </p>
                                <p className="text-gray-400 text-[10px] flex items-center gap-1 mt-0.5">
                                  {c.invited_by
                                    ? <><ArrowRight size={8} className="text-pink-400" />
                                        Linked by {c.inviter?.full_name || "someone"} · Lv{c.depth}</>
                                    : <><Zap size={8} className="text-amber-400" /> Self-joined · Lv{c.depth}</>
                                  }
                                </p>
                              </div>
                              <div className="text-[9px] text-gray-400 shrink-0">
                                {(() => {
                                  const d = Date.now() - new Date(c.created_at).getTime();
                                  const m = Math.floor(d / 60000);
                                  if (m < 60) return `${m}m ago`;
                                  const h = Math.floor(m / 60);
                                  if (h < 24) return `${h}h ago`;
                                  return `${Math.floor(h / 24)}d ago`;
                                })()}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        {sorted.length > 10 && (
                          <button
                            onClick={() => setTraceShowAll(v => !v)}
                            className="w-full mt-2 py-2 rounded-xl text-[11px] font-black text-purple-600 bg-purple-50 border border-purple-100"
                          >
                            {traceShowAll ? "Show Less ↑" : `Show ${sorted.length - 10} More ↓`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── LINEAGE TREE — who-forwarded-to-whom ──────────────────── */}
                  {chains.length > 0 && (() => {
                    // Build a map: userId → chain entry for quick lookup
                    const byUser: Record<string, MagnetChain> = {};
                    chains.forEach(c => { byUser[c.user_id] = c; });

                    // Only show entries that have a clear inviter (depth > 0)
                    const lineageRows = chains.filter(c => c.invited_by && c.depth > 0);

                    if (!lineageRows.length) return null;

                    return (
                      <div className="mb-5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                          🔗 Chain Lineage
                        </p>
                        <div className="space-y-0">
                          {lineageRows.slice(0, 30).map((c, idx) => (
                            <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                              {/* Depth indent */}
                              <div style={{ width: Math.min(c.depth - 1, 5) * 14, flexShrink: 0 }} />
                              {/* Inviter */}
                              <AvatarPill url={c.inviter?.avatar_url} name={c.inviter?.full_name} size={20} />
                              <span className="text-gray-500 font-bold text-[11px] truncate max-w-[70px]">
                                {c.inviter?.full_name?.split(" ")[0] || "?"}
                              </span>
                              {/* Arrow */}
                              <ArrowRight size={10} className="text-purple-300 shrink-0" />
                              {/* Recipient */}
                              <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={20} />
                              <span className={`font-bold text-[11px] truncate flex-1 ${c.is_killed ? "line-through text-red-300" : "text-gray-700"}`}>
                                {c.profile?.full_name || "User"}
                                {c.user_id === currentUserId && <span className="text-purple-400"> (you)</span>}
                              </span>
                              {/* Depth badge */}
                              <span className="text-[8px] font-black text-purple-400 shrink-0 bg-purple-50 px-1.5 py-0.5 rounded-full">
                                Lv{c.depth}
                              </span>
                              {c.is_killed && <Skull size={10} className="text-red-300 shrink-0" />}
                              {c.is_muted && <VolumeX size={10} className="text-gray-300 shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── DEPTH TREE (visual) ─────────────────────────────────── */}
                  <ViralPath chains={chains} postOwnerId={postOwnerId} />

                  {/* ── Owner Controls — kill / mute ────────────────────────── */}
                  {isOwner && chains.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">⚙️ Owner Controls</p>
                      <div className="space-y-1.5">
                        {chains.filter(c => c.depth > 0).slice(0, 20).map(c => (
                          <div key={c.id} onClick={e => e.stopPropagation()}
                            className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={26} />
                            <span className="text-xs text-gray-700 font-bold flex-1 truncate">{c.profile?.full_name}</span>
                            <span className="text-[9px] text-gray-400">Lv{c.depth}</span>
                            <button onClick={e => { e.stopPropagation(); toggleBranch(c.id, "is_muted", c.is_muted); }}
                              className={`p-1 rounded-lg transition-all ${c.is_muted ? "bg-gray-300 text-gray-500" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                              title={c.is_muted ? "Unmute" : "Mute"}>
                              <VolumeX size={12} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); toggleBranch(c.id, "is_killed", c.is_killed); }}
                              className={`p-1 rounded-lg transition-all ${c.is_killed ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400"}`}
                              title={c.is_killed ? "Unkill" : "Kill"}>
                              <Skull size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── My Link Dashboard ───────────────────────────────────── */}
                  <MagnetDashboard currentUserId={currentUserId} />
                </>
              )}
            </div>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {tab === "leaderboard" && (
            <MagnetLeaderboard currentUserId={currentUserId} />
          )}

          {/* ── VOICE TAB (owner + first magneter) ── */}
          {tab === "voice" && canVoice && (
            <div className="p-5">
              <div className="mb-4 p-3 rounded-2xl border"
                style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.08),rgba(219,39,119,0.08))", borderColor: "rgba(139,92,246,0.2)" }}>
                <p className="text-purple-700 font-black text-[12px] flex items-center gap-1.5 mb-1">
                  <Radio size={13} />
                  {isOwner ? "Post Owner Voice" : "First Linker Voice"}
                </p>
                <p className="text-gray-500 text-[11px]">
                  {isOwner
                    ? "Your message appears live on every screen viewing this post."
                    : "As the first linker, your voice appears alongside the owner's."}
                </p>
              </div>

              {/* Current voice preview */}
              {myVoice?.status_text && (
                <div className={`mb-4 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold ${
                  myVoice.is_warning ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"
                }`}>
                  {myVoice.is_warning ? <AlertTriangle size={14} /> : <Radio size={14} />}
                  <span className="flex-1 truncate">{myVoice.status_text}</span>
                  <span className="text-[9px] font-black uppercase opacity-60">Live</span>
                </div>
              )}

              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide block mb-1.5">Your Message</label>
              <textarea
                value={voiceText}
                onChange={e => setVoiceText(e.target.value)}
                rows={3}
                maxLength={160}
                placeholder="Type a live message for all viewers…"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-400/30 resize-none mb-1"
              />
              <p className="text-[10px] text-gray-400 text-right mb-3">{voiceText.length}/160</p>

              {/* Warning toggle */}
              <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
                <div onClick={() => setVoiceWarning(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${voiceWarning ? "bg-red-500" : "bg-gray-200"}`}>
                  <motion.div animate={{ x: voiceWarning ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-700 flex items-center gap-1.5">
                    <AlertTriangle size={14} className={voiceWarning ? "text-red-500" : "text-gray-300"} />
                    Mark as Warning
                  </p>
                  <p className="text-[10px] text-gray-400">Warning = bold red overlay in middle of post</p>
                </div>
              </label>

              <button onClick={saveVoice} disabled={savingVoice || !voiceText.trim()}
                className="w-full py-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}>
                {savingVoice ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                {savingVoice ? "Broadcasting…" : "Broadcast Live"}
              </button>

              {myVoice?.status_text && (
                <button onClick={clearVoice} className="w-full mt-2 py-3 rounded-2xl bg-gray-100 text-gray-500 font-black text-sm">
                  Clear My Voice
                </button>
              )}

              {/* ── PRIVATE / TARGETED MESSAGE (owner only) ──────────────── */}
              {isOwner && chains.filter(c => c.user_id !== currentUserId && !c.is_killed).length > 0 && (
                <div className="mt-6 pt-5 border-t border-dashed border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(219,39,119,0.15))" }}>
                      <Lock size={13} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-gray-800 leading-none">Private Message</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Only the chosen person sees this — others keep seeing your public message above.
                      </p>
                    </div>
                  </div>

                  {/* Participant selector */}
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wide block mb-1.5">
                    Send Privately To
                  </label>
                  <div className="relative mb-3">
                    <select
                      value={targetUserId}
                      onChange={e => setTargetUserId(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-300/40 appearance-none"
                    >
                      <option value="">— Choose a chain member —</option>
                      {chains
                        .filter(c => c.user_id !== currentUserId && !c.is_killed)
                        .map(c => (
                          <option key={c.id} value={c.user_id}>
                            {c.profile?.full_name || "User"} (Lv{c.depth})
                          </option>
                        ))
                      }
                    </select>
                    <ArrowRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
                  </div>

                  {/* Private message textarea */}
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wide block mb-1.5">
                    Private Message
                    {targetUserId && (
                      <span className="ml-2 text-purple-500 normal-case font-bold text-[10px]">
                        → {chains.find(c => c.user_id === targetUserId)?.profile?.full_name || "them"}
                      </span>
                    )}
                  </label>
                  <textarea
                    value={targetVoiceText}
                    onChange={e => setTargetVoiceText(e.target.value)}
                    rows={2}
                    maxLength={160}
                    placeholder={targetUserId
                      ? `Private message only for ${chains.find(c => c.user_id === targetUserId)?.profile?.full_name?.split(" ")[0] || "them"}…`
                      : "Select a person above first…"
                    }
                    disabled={!targetUserId}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-400/30 resize-none mb-1 disabled:opacity-40"
                  />
                  <p className="text-[10px] text-gray-400 text-right mb-3">{targetVoiceText.length}/160</p>

                  <button
                    onClick={saveTargetedVoice}
                    disabled={savingTargetVoice || !targetUserId || !targetVoiceText.trim()}
                    className="w-full py-3 rounded-2xl text-white font-black text-[13px] flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}
                  >
                    {savingTargetVoice ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    {savingTargetVoice ? "Sending…" : "Send Private Message 🔒"}
                  </button>

                  <p className="text-center text-[10px] text-gray-400 mt-2">
                    🔒 Only they will see this. Other viewers see your public message only.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  , document.body);
}

// ── PostVoiceStrip — lightweight per-post voice fetcher for feed cards ────────
// Fetches voices once on mount (no real-time subscription) — safe for many posts

export function PostVoiceStrip({ postId, postType, postOwnerId, currentUserId = null }: {
  postId: string;
  postType: string;
  postOwnerId: string;
  /** Pass the logged-in user's ID so targeted private messages are only shown to their recipient. */
  currentUserId?: string | null;
}) {
  const [voices, setVoices] = useState<MagnetVoice[]>([]);
  const [firstId, setFirstId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: vRows } = await supabase
        .from("post_magnet_voice")
        // Include target_user_id so we can enforce privacy client-side
        .select("id,post_id,post_type,owner_id,status_text,is_warning,updated_at,target_user_id")
        .eq("post_id", postId).eq("post_type", postType);

      if (!cancelled) {
        const filtered = (vRows || []).filter((v: MagnetVoice) => {
          if (!v.status_text) return false;
          // Public voice (no target) → show to everyone
          if (!v.target_user_id) return true;
          // Private voice → only show to the recipient
          return v.target_user_id === currentUserId;
        });
        setVoices(filtered as MagnetVoice[]);
      }

      const { data: firstEntry } = await supabase
        .from("magnet_chains").select("user_id")
        .eq("post_id", postId).eq("post_type", postType)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!cancelled) setFirstId(firstEntry?.user_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [postId, postType, currentUserId]);

  if (!voices.length) return null;
  return <VoiceDisplay voices={voices} postOwnerId={postOwnerId} firstMagneterId={firstId} />;
}

// ── MagnetButton ──────────────────────────────────────────────────────────────

interface MagnetButtonProps {
  postId: string;
  postType: string;
  postOwnerId: string;
  currentUserId: string | null;
  onBridgeChat?: (userId: string, userName: string) => void;
  dark?: boolean;
  myName?: string;
  onMagnetLoad?: (d: { linkers: Array<{ full_name: string; avatar_url: string | null }>; voices: MagnetVoice[] }) => void;
}

export function MagnetButton({
  postId, postType, postOwnerId, currentUserId, onBridgeChat, dark = true, myName = "Someone",
  onMagnetLoad,
}: MagnetButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const {
    reach, myChainId, voice, voices, chains, firstMagneterId, lastLinker, recentLinkers, loading,
    fetchAll, fetchChains, setVoice, setVoices, setReach, setChains,
  } = useMagnet(postId, postType, currentUserId, showModal);

  // Keep a ref to onMagnetLoad so the effect below never needs it in its deps.
  // Without this, the inline lambda in FameFeed (new reference every render) would
  // either cause a stale-closure bug (if excluded) or an infinite update loop
  // (setPostMagnetData → re-render → new lambda → effect re-fires → repeat).
  const onMagnetLoadRef = useRef(onMagnetLoad);
  useEffect(() => { onMagnetLoadRef.current = onMagnetLoad; }); // sync every render, no deps

  // Fire callback whenever linkers or voices update so parent can render chain/voice row
  useEffect(() => {
    if (!loading && onMagnetLoadRef.current) {
      onMagnetLoadRef.current({ linkers: recentLinkers, voices });
    }
  }, [recentLinkers, voices, loading]);

  const textCls = dark ? "text-lime-400 font-black" : "text-gray-700";
  const bgCls   = dark ? "bg-lime-400/10 hover:bg-lime-400/20 border border-lime-400/20" : "bg-gray-100 hover:bg-gray-200";

  return (
    <>
      <button
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          if (!currentUserId) { toast.error("Login to use Link!"); return; }
          fetchChains();
          setShowModal(true);
        }}
        className={`flex flex-row items-center gap-1.5 ${bgCls} rounded-2xl px-2.5 py-1.5 transition-all active:scale-90`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <motion.span
          key={reach}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="text-base leading-none"
        >🔗</motion.span>
        <span className={`text-[10px] font-black leading-none ${textCls}`}>
          {loading ? "…" : formatReach(reach)}
        </span>
        {/* Last linker badge — inline avatar to the right of the count */}
        <AnimatePresence>
          {reach > 0 && lastLinker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex items-center gap-0.5"
              title={`${lastLinker.full_name} linked`}
            >
              <div
                className="w-[14px] h-[14px] rounded-full overflow-hidden border border-lime-400/60 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0"
                style={{ fontSize: 6, color: "#fff", fontWeight: 900 }}
              >
                {lastLinker.avatar_url
                  ? <img src={lastLinker.avatar_url} className="w-full h-full object-cover" alt="" decoding="async"/>
                  : lastLinker.full_name?.[0]?.toUpperCase()}
              </div>
              <Check size={7} className="text-lime-400 shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {showModal && currentUserId && (
          <MagnetModal
            postId={postId}
            postType={postType}
            postOwnerId={postOwnerId}
            currentUserId={currentUserId}
            reach={reach}
            voice={voice}
            voices={voices}
            chains={chains}
            myChainId={myChainId}
            firstMagneterId={firstMagneterId}
            onClose={() => setShowModal(false)}
            onVoiceUpdate={v => setVoice(v)}
            onVoicesUpdate={vs => setVoices(vs)}
            onReachUpdate={n => setReach(n)}
            onChainsUpdate={c => setChains(c)}
            onBridgeChat={onBridgeChat ?? (() => {})}
            fetchChains={fetchChains}
            myName={myName}
          />
        )}
      </AnimatePresence>
    </>
  );
}
