import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import {
  X, AlertTriangle, MessageCircle,
  Users, GitBranch, VolumeX, Skull, Check, Loader2,
  Radio, Search,
} from "lucide-react";
import toast from "react-hot-toast";

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

const formatReach = (n: number): string => {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(1) + "Cr";
  if (n >= 100_000)    return (n / 100_000).toFixed(1) + "L";
  if (n >= 1_000)      return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

const avatarChar = (name?: string | null) =>
  (name || "U")[0].toUpperCase();

const AvatarPill = ({ url, name, size = 32 }: { url?: string | null; name?: string | null; size?: number }) => (
  <div
    className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black shrink-0 overflow-hidden border-2 border-black"
    style={{ width: size, height: size, fontSize: size / 2.6 }}
  >
    {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : avatarChar(name)}
  </div>
);

// ── useMagnet hook ─────────────────────────────────────────────────────────────

export function useMagnet(postId: string, postType: string, currentUserId: string | null) {
  const [reach, setReach]         = useState(0);
  const [myChainId, setMyChainId] = useState<string | null>(null);
  const [voice, setVoice]         = useState<MagnetVoice | null>(null);
  const [chains, setChains]       = useState<MagnetChain[]>([]);
  const [loading, setLoading]     = useState(true);
  const voiceChannelRef           = useRef<any>(null);
  const reachChannelRef           = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    if (!postId) return;
    try {
      // Reach count
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

      // Creator voice
      const { data: v } = await supabase
        .from("post_magnet_voice")
        .select("*")
        .eq("post_id", postId)
        .eq("post_type", postType)
        .maybeSingle();
      setVoice(v ?? null);
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

    // Realtime: reach counter
    reachChannelRef.current = supabase
      .channel(`magnet-reach-${postId}-${postType}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "magnet_chains", filter: `post_id=eq.${postId}` },
        () => fetchAll())
      .subscribe();

    // Realtime broadcast: creator voice
    voiceChannelRef.current = supabase
      .channel(`magnet-voice-${postId}-${postType}`)
      .on("broadcast", { event: "voice_update" }, ({ payload }: any) => {
        setVoice(payload as MagnetVoice);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_magnet_voice", filter: `post_id=eq.${postId}` },
        ({ new: row }: any) => { if (row) setVoice(row as MagnetVoice); })
      .subscribe();

    return () => {
      supabase.removeChannel(reachChannelRef.current);
      supabase.removeChannel(voiceChannelRef.current);
    };
  }, [postId, postType, currentUserId, fetchAll]);

  return { reach, myChainId, voice, chains, loading, fetchAll, fetchChains, setVoice, setReach, setChains };
}

// ── CreatorVoice strip ────────────────────────────────────────────────────────

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

// ── MagnetCluster (floating avatars in sidebar) ─────────────────────────────

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

// ── Viral Path Visualization ─────────────────────────────────────────────────

function ViralPath({ chains }: { chains: MagnetChain[] }) {
  if (!chains.length) {
    return (
      <div className="py-10 flex flex-col items-center text-center text-gray-400">
        <GitBranch size={32} className="mb-3 opacity-30" />
        <p className="font-black text-sm">No chain yet</p>
        <p className="text-[11px] mt-1">Be the first to Magnet this post!</p>
      </div>
    );
  }

  // Build tree structure for rendering
  const byDepth: Record<number, MagnetChain[]> = {};
  chains.forEach(c => {
    if (!byDepth[c.depth]) byDepth[c.depth] = [];
    byDepth[c.depth].push(c);
  });
  const maxDepth = Math.max(...Object.keys(byDepth).map(Number));

  return (
    <div className="overflow-x-auto pb-2">
      {Array.from({ length: maxDepth + 1 }, (_, d) => (
        <div key={d} className="mb-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 pl-1">
            {d === 0 ? "Root" : `Level ${d}`} — {byDepth[d]?.length ?? 0} people
          </p>
          <div className="flex flex-wrap gap-2">
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
                    : "bg-purple-50 border-purple-200 text-purple-700"
                }`}
              >
                <AvatarPill url={c.profile?.avatar_url} name={c.profile?.full_name} size={18} />
                <span className="max-w-[80px] truncate">{c.profile?.full_name || "User"}</span>
                {c.is_killed && <Skull size={10} className="text-red-400" />}
                {c.is_muted && <VolumeX size={10} className="text-gray-400" />}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
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
  voice: MagnetVoice | null;
  chains: MagnetChain[];
  myChainId: string | null;
  onClose: () => void;
  onVoiceUpdate: (v: MagnetVoice) => void;
  onReachUpdate: (n: number) => void;
  onChainsUpdate: (c: MagnetChain[]) => void;
  onBridgeChat: (userId: string, userName: string) => void;
  fetchChains: () => Promise<void>;
}

export function MagnetModal({
  postId, postType, postOwnerId, currentUserId, reach, voice,
  chains, myChainId, onClose, onVoiceUpdate, onReachUpdate,
  onChainsUpdate, onBridgeChat, fetchChains,
}: MagnetModalProps) {
  const isOwner = postOwnerId === currentUserId;
  const [tab, setTab]               = useState<"magnet" | "trace" | "voice">("magnet");
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [search, setSearch]         = useState("");
  const [sending, setSending]       = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [voiceText, setVoiceText]   = useState(voice?.status_text || "");
  const [voiceWarning, setVoiceWarning] = useState(voice?.is_warning || false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [traceLoaded, setTraceLoaded] = useState(false);
  const voiceChannelRef = useRef<any>(null);

  // Fetch friends list
  useEffect(() => {
    (async () => {
      const { data: fships } = await supabase
        .from("friendships")
        .select("sender_id,receiver_id")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq("status", "accepted");
      if (!fships?.length) { setLoadingFriends(false); return; }
      const ids = fships.map(f => f.sender_id === currentUserId ? f.receiver_id : f.sender_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,username")
        .in("id", ids);
      setFriends((profs as Friend[]) ?? []);
      setLoadingFriends(false);
    })();
  }, [currentUserId]);

  // Fetch trace when tab switches
  useEffect(() => {
    if (tab === "trace" && !traceLoaded) {
      fetchChains().then(() => setTraceLoaded(true));
    }
  }, [tab, traceLoaded, fetchChains]);

  const toggleFriend = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Send magnets to selected friends
  const sendMagnets = async () => {
    if (!selected.size) return;
    setSending(true);
    try {
      // Get or create MY chain entry first
      let parentId = myChainId;
      let myDepth  = 0;

      if (!parentId) {
        const { data: myEntry } = await supabase
          .from("magnet_chains")
          .insert({ post_id: postId, post_type: postType, user_id: currentUserId, invited_by: null, depth: 0 })
          .select("id")
          .single();
        parentId = myEntry?.id ?? null;
      } else {
        const { data: me } = await supabase.from("magnet_chains").select("depth").eq("id", parentId).single();
        myDepth = me?.depth ?? 0;
      }

      // Insert one chain entry per friend (skip if already magneted)
      const rows = Array.from(selected).map(fid => ({
        post_id: postId,
        post_type: postType,
        user_id: fid,
        invited_by: currentUserId,
        parent_magnet_id: parentId,
        depth: myDepth + 1,
      }));

      await supabase.from("magnet_chains").upsert(rows, { onConflict: "user_id,post_id,post_type", ignoreDuplicates: true });

      // Update reach
      const { count } = await supabase
        .from("magnet_chains")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("post_type", postType)
        .eq("is_killed", false);
      onReachUpdate(count ?? reach + selected.size);

      toast.success(`🧲 Magneted ${selected.size} friend${selected.size > 1 ? "s" : ""}!`);
      setSelected(new Set());
      onClose();
    } catch (err: any) {
      toast.error("Magnet failed: " + (err.message || "try again"));
    }
    setSending(false);
  };

  // Save Creator's Voice
  const saveVoice = async () => {
    setSavingVoice(true);
    const payload: any = {
      post_id: postId,
      post_type: postType,
      owner_id: currentUserId,
      status_text: voiceText.trim() || null,
      is_warning: voiceWarning,
      updated_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("post_magnet_voice")
      .upsert(payload, { onConflict: "post_id,post_type" })
      .select("*")
      .single();

    if (data) {
      onVoiceUpdate(data as MagnetVoice);
      // Broadcast globally so every viewer updates instantly
      if (!voiceChannelRef.current) {
        voiceChannelRef.current = supabase.channel(`magnet-voice-${postId}-${postType}`);
        await voiceChannelRef.current.subscribe();
      }
      voiceChannelRef.current.send({ type: "broadcast", event: "voice_update", payload: data });
      toast.success("Voice published!");
    }
    setSavingVoice(false);
  };

  // Kill / Mute a branch
  const toggleBranch = async (chainId: string, field: "is_killed" | "is_muted", cur: boolean) => {
    await supabase.from("magnet_chains").update({ [field]: !cur }).eq("id", chainId);
    const updated = chains.map(c => c.id === chainId ? { ...c, [field]: !cur } : c);
    onChainsUpdate(updated);
  };

  // Last person in chain
  const lastPerson = chains.length ? chains[chains.length - 1] : null;

  const filtered = friends.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.username?.toLowerCase().includes(search.toLowerCase())
  );

  // Already in chain?
  const inChain = new Set(chains.map(c => c.user_id));

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
        className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-0 bg-gradient-to-r from-purple-600 to-pink-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-lg">🧲</span>
              </div>
              <div>
                <h2 className="text-white font-black text-base leading-none">MAGNET</h2>
                <p className="text-white/70 text-[10px] font-semibold">Viral Chain System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <motion.p
                  key={reach}
                  initial={{ scale: 1.3, color: "#fff" }}
                  animate={{ scale: 1, color: "#fff" }}
                  className="text-white font-black text-xl leading-none"
                >
                  {formatReach(reach)}
                </motion.p>
                <p className="text-white/60 text-[9px] font-black uppercase">Magnet Reach</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 text-white">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 pb-0">
            {[
              { key: "magnet", label: "🧲 Magnet" },
              { key: "trace",  label: "🛤 Trace" },
              ...(isOwner ? [{ key: "voice", label: "📢 Voice" }] : []),
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-4 py-2 text-[11px] font-black rounded-t-xl transition-all ${
                  tab === t.key ? "bg-white text-purple-700" : "text-white/70 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MAGNET TAB ── */}
          {tab === "magnet" && (
            <div className="p-5">
              {/* Last person bridge */}
              {lastPerson && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100 flex items-center gap-3"
                >
                  <AvatarPill url={lastPerson.profile?.avatar_url} name={lastPerson.profile?.full_name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-wide">Last Linked Person</p>
                    <p className="text-gray-800 font-black text-sm truncate">{lastPerson.profile?.full_name || "Someone"}</p>
                    <p className="text-[10px] text-gray-400">Depth {lastPerson.depth} in chain</p>
                  </div>
                  <button
                    onClick={() => { onBridgeChat(lastPerson.user_id, lastPerson.profile?.full_name || "User"); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-[11px] font-black shrink-0"
                  >
                    <MessageCircle size={13} /> Bridge
                  </button>
                </motion.div>
              )}

              {/* Search */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search friends…"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-300/40 text-gray-700"
                />
              </div>

              {/* Friends list */}
              {loadingFriends ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-purple-400" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Users size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-black">No friends yet</p>
                </div>
              ) : (
                <div className="space-y-1.5 mb-4">
                  {filtered.map(f => {
                    const isSelected = selected.has(f.id);
                    const alreadyChained = inChain.has(f.id);
                    return (
                      <motion.button
                        key={f.id}
                        whileTap={{ scale: 0.97 }}
                        disabled={alreadyChained}
                        onClick={() => !alreadyChained && toggleFriend(f.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all ${
                          alreadyChained
                            ? "bg-gray-50 border-gray-100 opacity-50"
                            : isSelected
                            ? "bg-purple-50 border-purple-200"
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

              {/* Send button */}
              {selected.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={sendMagnets}
                  disabled={sending}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <span>🧲</span>}
                  {sending ? "Sending…" : `Magnet ${selected.size} Friend${selected.size > 1 ? "s" : ""}`}
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide">Viral Path — {chains.length} people</p>
                    {lastPerson && (
                      <button
                        onClick={() => { onBridgeChat(lastPerson.user_id, lastPerson.profile?.full_name || "User"); onClose(); }}
                        className="flex items-center gap-1 text-[11px] font-black text-purple-600 px-3 py-1.5 bg-purple-50 rounded-xl"
                      >
                        <MessageCircle size={11} /> Bridge Chat
                      </button>
                    )}
                  </div>

                  <ViralPath chains={chains} />

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
                            <button
                              onClick={() => toggleBranch(c.id, "is_muted", c.is_muted)}
                              className={`p-1 rounded-lg ${c.is_muted ? "bg-gray-300 text-gray-500" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                              title="Mute branch"
                            >
                              <VolumeX size={12} />
                            </button>
                            <button
                              onClick={() => toggleBranch(c.id, "is_killed", c.is_killed)}
                              className={`p-1 rounded-lg ${c.is_killed ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400"}`}
                              title="Kill branch"
                            >
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

          {/* ── VOICE TAB (owner only) ── */}
          {tab === "voice" && isOwner && (
            <div className="p-5">
              <div className="mb-4 p-3 bg-purple-50 rounded-2xl border border-purple-100">
                <p className="text-purple-700 font-black text-[12px] flex items-center gap-1.5 mb-1">
                  <Radio size={13} /> Creator's Voice
                </p>
                <p className="text-gray-500 text-[11px]">
                  This message will appear live on every screen viewing this post — instantly, via realtime broadcast.
                </p>
              </div>

              {/* Current voice preview */}
              {voice?.status_text && (
                <div className={`mb-4 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold ${
                  voice.is_warning ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                }`}>
                  {voice.is_warning ? <AlertTriangle size={14} /> : <Radio size={14} />}
                  <span className="flex-1 truncate">{voice.status_text}</span>
                  <span className="text-[9px] font-black uppercase opacity-60">Live</span>
                </div>
              )}

              <label className="text-[11px] font-black text-gray-500 uppercase tracking-wide block mb-1.5">Status Message</label>
              <textarea
                value={voiceText}
                onChange={e => setVoiceText(e.target.value)}
                rows={3}
                placeholder="Type a message for all viewers…"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-400/30 resize-none mb-4"
              />

              <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
                <div
                  onClick={() => setVoiceWarning(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${voiceWarning ? "bg-red-500" : "bg-gray-200"}`}
                >
                  <motion.div
                    animate={{ x: voiceWarning ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  />
                </div>
                <span className="text-sm font-black text-gray-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} className={voiceWarning ? "text-red-500" : "text-gray-300"} />
                  Mark as Warning
                </span>
              </label>

              <button
                onClick={saveVoice}
                disabled={savingVoice}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {savingVoice ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                {savingVoice ? "Broadcasting…" : "Broadcast to All Screens"}
              </button>

              {voice?.status_text && (
                <button
                  onClick={async () => {
                    const cleared: any = { post_id: postId, post_type: postType, owner_id: currentUserId, status_text: null, is_warning: false, updated_at: new Date().toISOString() };
                    await supabase.from("post_magnet_voice").upsert(cleared, { onConflict: "post_id,post_type" });
                    onVoiceUpdate({ ...voice, status_text: null, is_warning: false });
                    setVoiceText("");
                    setVoiceWarning(false);
                    toast.success("Voice cleared.");
                  }}
                  className="w-full mt-2 py-3 rounded-2xl bg-gray-100 text-gray-500 font-black text-sm"
                >
                  Clear Voice
                </button>
              )}
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
}

// ── MagnetButton (sidebar icon + counter) ─────────────────────────────────────

interface MagnetButtonProps {
  postId: string;
  postType: string;
  postOwnerId: string;
  currentUserId: string | null;
  onBridgeChat?: (userId: string, userName: string) => void;
  dark?: boolean;
}

export function MagnetButton({
  postId, postType, postOwnerId, currentUserId, onBridgeChat, dark = true,
}: MagnetButtonProps) {
  const { reach, myChainId, voice, chains, loading, fetchAll, fetchChains, setVoice, setReach, setChains } = useMagnet(postId, postType, currentUserId);
  const [showModal, setShowModal] = useState(false);

  const textCls = dark ? "text-white" : "text-gray-700";
  const bgCls   = dark ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200";

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); if (!currentUserId) { toast.error("Login to use Magnet!"); return; } fetchChains(); setShowModal(true); }}
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
            chains={chains}
            myChainId={myChainId}
            onClose={() => setShowModal(false)}
            onVoiceUpdate={v => setVoice(v)}
            onReachUpdate={n => setReach(n)}
            onChainsUpdate={c => setChains(c)}
            onBridgeChat={onBridgeChat ?? (() => {})}
            fetchChains={fetchChains}
          />
        )}
      </AnimatePresence>
    </>
  );
}
