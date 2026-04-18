import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  X, AlertTriangle, MessageCircle, TrendingUp,
  Users, GitBranch, VolumeX, Skull, Check, Loader2,
  Radio, Search, Zap, Globe, ArrowRight,
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
    {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : avatarChar(name)}
  </div>
);

// ── Send notification helper ───────────────────────────────────────────────────

async function sendNotification(userId: string, content: string, type = "magnet") {
  try {
    await supabase.from("notifications").insert({ user_id: userId, content, type, is_read: false });
  } catch (_) {}
}

// ── useMagnet hook ─────────────────────────────────────────────────────────────

export function useMagnet(postId: string, postType: string, currentUserId: string | null) {
  const [reach, setReach]               = useState(0);
  const [myChainId, setMyChainId]       = useState<string | null>(null);
  const [voice, setVoice]               = useState<MagnetVoice | null>(null);   // backward compat (first active voice)
  const [voices, setVoices]             = useState<MagnetVoice[]>([]);
  const [chains, setChains]             = useState<MagnetChain[]>([]);
  const [firstMagneterId, setFirstMagneterId] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const voiceChannelRef                 = useRef<any>(null);
  const reachChannelRef                 = useRef<any>(null);

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

      // All voices for this post
      const { data: vRows } = await supabase
        .from("post_magnet_voice")
        .select("*")
        .eq("post_id", postId)
        .eq("post_type", postType);
      const activeVoices = (vRows || []).filter((v: MagnetVoice) => v.status_text);
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

  useEffect(() => {
    fetchAll();

    reachChannelRef.current = supabase
      .channel(`magnet-reach-${postId}-${postType}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "magnet_chains", filter: `post_id=eq.${postId}` },
        () => fetchAll())
      .subscribe();

    voiceChannelRef.current = supabase
      .channel(`magnet-voice-${postId}-${postType}`)
      .on("broadcast", { event: "voice_update" }, ({ payload }: any) => {
        setVoices(prev => {
          const existing = prev.findIndex(v => v.owner_id === payload.owner_id);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = payload as MagnetVoice;
            return next.filter(v => v.status_text);
          }
          return payload.status_text ? [...prev, payload as MagnetVoice] : prev;
        });
        setVoice(payload.status_text ? payload as MagnetVoice : null);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_magnet_voice", filter: `post_id=eq.${postId}` },
        () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(reachChannelRef.current);
      supabase.removeChannel(voiceChannelRef.current);
    };
  }, [postId, postType, currentUserId, fetchAll]);

  return {
    reach, myChainId, voice, voices, chains, firstMagneterId, loading,
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
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <AlertTriangle size={16} className="text-yellow-300 shrink-0" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-[13px] leading-snug">{v.status_text}</p>
            <p className="text-red-200 text-[9px] font-semibold uppercase tracking-widest mt-0.5">
              {v.owner_id === postOwnerId ? "⚡ Post Owner Warning" : "🧲 Chain Alert"}
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
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Radio size={10} className="text-purple-500 shrink-0" />
              </motion.div>
              <span className="text-purple-700 text-[11px] font-bold truncate">{v.status_text}</span>
              <span className="text-purple-400 text-[8px] font-black shrink-0">
                {v.owner_id === postOwnerId ? "Owner" : "1st🧲"}
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
        <p className="text-[11px] mt-1">Be the first to Magnet this post!</p>
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
          { label: "Total Reach",    value: formatReach(activePeople.length), icon: "🧲" },
          { label: "Viral Depth",    value: `Lv ${maxDepth}`,                  icon: "📡" },
          { label: "Last Magneter",  value: lastPerson?.profile?.full_name?.split(" ")[0] || "—", icon: "👤" },
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

  const [tab, setTab]               = useState<"magnet" | "trace" | "voice">("magnet");
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
  const [userTab, setUserTab]       = useState<"friends" | "all">("friends");
  const [friends, setFriends]       = useState<Friend[]>([]);
  const voiceChannelRef = useRef<any>(null);

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
    if (myChainId) { toast("You're already in this chain! 🧲"); return; }
    setJoiningChain(true);
    try {
      await supabase.from("magnet_chains").insert({
        post_id: postId, post_type: postType, user_id: currentUserId,
        invited_by: null, depth: 0,
      });

      // Notify post owner
      if (postOwnerId !== currentUserId) {
        await sendNotification(
          postOwnerId,
          `Your post is going viral! ${myName} just magneted it.`
        );
      }

      // Increment magnet_count on post
      try {
        await supabase.rpc("increment_magnet_count", { post_id_input: postId });
      } catch (_) {
        // RPC might not exist — silent fail
      }

      toast.success("🧲 You joined the Magnet chain!");
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

      // Notifications — notify each selected user
      await Promise.all(Array.from(selected).map(uid =>
        sendNotification(uid, `${myName} has sent you a Magnet for this post!`)
      ));

      // Notify post owner (if not self)
      if (postOwnerId !== currentUserId) {
        await sendNotification(
          postOwnerId,
          `Your post is going viral! ${myName} just magneted it to ${selected.size} people.`
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

      toast.success(`🧲 Magneted ${selected.size} ${selected.size > 1 ? "people" : "person"}!`);
      setSelected(new Set());
      onClose();
    } catch (err: any) {
      toast.error("Magnet failed: " + (err.message || "try again"));
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
        const { data } = await supabase.from("post_magnet_voice").update(payload).eq("id", existing.id).select("*").single();
        saved = data;
      } else {
        const { data } = await supabase.from("post_magnet_voice").insert(payload).select("*").single();
        saved = data;
      }

      if (saved) {
        onVoiceUpdate(saved as MagnetVoice);
        const updated = voices.filter(v => v.owner_id !== currentUserId);
        if (saved.status_text) updated.push(saved as MagnetVoice);
        onVoicesUpdate(updated);

        // Broadcast to all viewers
        if (!voiceChannelRef.current) {
          voiceChannelRef.current = supabase.channel(`magnet-voice-${postId}-${postType}`);
          await voiceChannelRef.current.subscribe();
        }
        voiceChannelRef.current.send({ type: "broadcast", event: "voice_update", payload: saved });
        toast.success("Voice broadcast live!");
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

  const toggleBranch = async (chainId: string, field: "is_killed" | "is_muted", cur: boolean) => {
    await supabase.from("magnet_chains").update({ [field]: !cur }).eq("id", chainId);
    onChainsUpdate(chains.map(c => c.id === chainId ? { ...c, [field]: !cur } : c));
  };

  const lastPerson = chains.length ? chains[chains.length - 1] : null;
  const inChain    = new Set(chains.map(c => c.user_id));
  const displayList = (userTab === "friends" ? friends : allUsers)
    .filter(f => f.full_name?.toLowerCase().includes(search.toLowerCase()) || f.username?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { key: "magnet", label: "🧲 Magnet" },
    { key: "trace",  label: "🛤 Trace"  },
    ...(canVoice ? [{ key: "voice", label: "📢 Voice" }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-0" style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xl">🧲</span>
              </div>
              <div>
                <h2 className="text-white font-black text-base leading-none">VIRAL CHAIN ENGINE</h2>
                <p className="text-white/70 text-[10px] font-semibold">Powered by Magnet System</p>
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
                      <p className="text-white/70 text-[10px]">Anyone can magnet — no friends needed</p>
                    </>
                  )}
                </div>
                {!myChainId && (
                  <button
                    onClick={joinChain}
                    disabled={joiningChain}
                    className="px-3 py-2 bg-white text-purple-700 rounded-xl text-[11px] font-black shrink-0 flex items-center gap-1 active:scale-95"
                  >
                    {joiningChain ? <Loader2 size={12} className="animate-spin" /> : <span>🧲</span>}
                    Magnet It!
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
                          {alreadyChained && <p className="text-purple-400 text-[10px] font-black">Already Magneted ✓</p>}
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
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <span>🧲</span>}
                  {sending ? "Sending…" : `Forward to ${selected.size} ${selected.size > 1 ? "People" : "Person"}`}
                </motion.button>
              )}
            </div>
          )}

          {/* ── TRACE TAB ── */}
          {tab === "trace" && (
            <div className="p-5">
              {!traceLoaded ? (
                <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-purple-400" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide">
                      Chain — {chains.length} people
                    </p>
                    {lastPerson && (
                      <button
                        onClick={() => { onBridgeChat(lastPerson.user_id, lastPerson.profile?.full_name || "User"); onClose(); }}
                        className="flex items-center gap-1 text-[11px] font-black text-purple-600 px-3 py-1.5 bg-purple-50 rounded-xl"
                      >
                        <MessageCircle size={11} /> Bridge Chat
                      </button>
                    )}
                  </div>

                  <ViralPath chains={chains} postOwnerId={postOwnerId} />

                  {/* Kill/Mute controls for owner */}
                  {isOwner && chains.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Owner Controls</p>
                      <div className="space-y-1.5">
                        {chains.filter(c => c.depth > 0).slice(0, 20).map(c => (
                          <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={26} />
                            <span className="text-xs text-gray-700 font-bold flex-1 truncate">{c.profile?.full_name}</span>
                            <span className="text-[9px] text-gray-400">Lv{c.depth}</span>
                            <button onClick={() => toggleBranch(c.id, "is_muted", c.is_muted)}
                              className={`p-1 rounded-lg ${c.is_muted ? "bg-gray-300 text-gray-500" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                              <VolumeX size={12} />
                            </button>
                            <button onClick={() => toggleBranch(c.id, "is_killed", c.is_killed)}
                              className={`p-1 rounded-lg ${c.is_killed ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400"}`}>
                              <Skull size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── VOICE TAB (owner + first magneter) ── */}
          {tab === "voice" && canVoice && (
            <div className="p-5">
              <div className="mb-4 p-3 rounded-2xl border"
                style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.08),rgba(219,39,119,0.08))", borderColor: "rgba(139,92,246,0.2)" }}>
                <p className="text-purple-700 font-black text-[12px] flex items-center gap-1.5 mb-1">
                  <Radio size={13} />
                  {isOwner ? "Post Owner Voice" : "First Magneter Voice"}
                </p>
                <p className="text-gray-500 text-[11px]">
                  {isOwner
                    ? "Your message appears live on every screen viewing this post."
                    : "As the first magneter, your voice appears alongside the owner's."}
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
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
}

// ── PostVoiceStrip — lightweight per-post voice fetcher for feed cards ────────
// Fetches voices once on mount (no real-time subscription) — safe for many posts

export function PostVoiceStrip({ postId, postType, postOwnerId }: {
  postId: string;
  postType: string;
  postOwnerId: string;
}) {
  const [voices, setVoices] = useState<MagnetVoice[]>([]);
  const [firstId, setFirstId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: vRows } = await supabase
        .from("post_magnet_voice").select("*")
        .eq("post_id", postId).eq("post_type", postType);
      if (!cancelled) setVoices((vRows || []).filter((v: MagnetVoice) => v.status_text));

      const { data: firstEntry } = await supabase
        .from("magnet_chains").select("user_id")
        .eq("post_id", postId).eq("post_type", postType)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!cancelled) setFirstId(firstEntry?.user_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [postId, postType]);

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
}

export function MagnetButton({
  postId, postType, postOwnerId, currentUserId, onBridgeChat, dark = true, myName = "Someone",
}: MagnetButtonProps) {
  const {
    reach, myChainId, voice, voices, chains, firstMagneterId, loading,
    fetchAll, fetchChains, setVoice, setVoices, setReach, setChains,
  } = useMagnet(postId, postType, currentUserId);
  const [showModal, setShowModal] = useState(false);

  const textCls = dark ? "text-white" : "text-gray-700";
  const bgCls   = dark ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200";

  return (
    <>
      <button
        onClick={e => {
          e.stopPropagation();
          if (!currentUserId) { toast.error("Login to use Magnet!"); return; }
          fetchChains();
          setShowModal(true);
        }}
        className={`flex flex-col items-center gap-0.5 ${bgCls} rounded-2xl px-2 py-2 transition-all active:scale-90`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <motion.span
          key={reach}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="text-xl"
        >🧲</motion.span>
        <span className={`text-[10px] font-black leading-none ${textCls}`}>
          {loading ? "…" : formatReach(reach)}
        </span>
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
