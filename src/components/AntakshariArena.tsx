import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { usePageVisibility } from "../hooks/usePageVisibility";
import {
  Mic2, ArrowLeft, Plus, Shuffle, Trophy, Gift, Calendar,
  Users, Lock, Globe, Clock, Crown, Star, Heart, MessageCircle,
  UserPlus, Check, X, Radio, Search,
  Copy, Share2, ChevronRight, Sparkles, Zap, Target,
  Flame, Music, Award, Loader2
} from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Profile {
  id: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  antakshari_level?: number;
  antakshari_xp?: number;
  antakshari_coins?: number;
  antakshari_matches?: number;
  antakshari_wins?: number;
  fair_play_score?: number;
  country?: string;
  bio?: string;
}

interface RoomMember {
  id: string;
  user_id: string;
  is_ready: boolean;
  is_host: boolean;
  score: number;
  joined_at: string;
  profiles?: Profile;
}

interface Room {
  id: string;
  code: string;
  name: string;
  theme: string;
  max_players: number;
  host_id: string;
  is_public: boolean;
  status: "waiting" | "playing" | "finished";
  current_word?: string;
  current_singer_id?: string;
  round_number: number;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  score: number;
  wins: number;
  matches: number;
  profiles?: Profile;
}

/* ── Color Palette ─────────────────────────────────────────────────────────── */
const BG = "#0F172A";
const CARD_BG = "rgba(15,23,42,0.95)";
const ORANGE = "#ff6b35";
const ORANGE_GLOW = "rgba(255,107,53,0.3)";
const CYAN = "#00e5ff";
const GOLD = "#ffd600";

/* ── Glass Card ────────────────────────────────────────────────────────────── */
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}> = ({ children, className = "", onClick, active }) => (
  <motion.div
    whileTap={onClick ? { scale: 0.97 } : undefined}
    onClick={onClick}
    className={`rounded-2xl border overflow-hidden ${className}`}
    style={{
      background: active
        ? `linear-gradient(135deg, ${ORANGE}15 0%, ${CARD_BG} 100%)`
        : `linear-gradient(135deg, rgba(30,30,50,0.6) 0%, ${CARD_BG} 100%)`,
      borderColor: active ? `${ORANGE}40` : "rgba(255,255,255,0.06)",
      backdropFilter: "blur(16px)",
    }}
  >
    {children}
  </motion.div>
);

/* ── Gradient Text ──────────────────────────────────────────────────────────── */
const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`bg-clip-text text-transparent ${className}`}
    style={{
      backgroundImage: `linear-gradient(135deg, ${ORANGE}, ${GOLD}, ${ORANGE})`,
      backgroundSize: "200% 200%",
      animation: "gradientShift 3s ease infinite",
    }}
  >
    {children}
  </span>
);

/* ── Action Button ──────────────────────────────────────────────────────────── */
const ActionBtn: React.FC<{
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  className?: string;
}> = ({ children, icon, onClick, variant = "primary", disabled, className = "" }) => {
  const base =
    variant === "primary"
      ? "text-white shadow-lg"
      : variant === "secondary"
      ? "bg-white/[0.06] text-white border border-white/10"
      : "border border-white/20 text-white/70 bg-transparent";

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-sm w-full ${base} ${disabled ? "opacity-50" : ""} ${className}`}
      style={variant === "primary" ? { background: `linear-gradient(135deg, ${ORANGE}, #ff8c5a)`, boxShadow: `0 4px 24px ${ORANGE_GLOW}` } : undefined}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
      <ChevronRight size={16} className="ml-auto shrink-0 opacity-50" />
    </motion.button>
  );
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const getRandomStartingWord = () => {
  const words = ["Dil", "Pyar", "Mohabbat", "Tere", "Mere", "Zindagi", "Chand", "Raat", "Sapna", "Dost", "Yaar", "Saathi", "Mann", "Tera", "Mera", "Prem", "Aashiqui", "Ishq", "Rang", "Badan", "Janam", "Sajan", "Sanam", "Haseen", "Khoobsurat", "Jawan", "Jism", "Tasveer", "Baat", "Pal", "Dard", "Rooh", "Duniya", "Jahan", "Nazar", "Aankhen", "Khwab", "Shab", "Sawan", "Barsaat", "Mausam", "Bheegi", "Aag", "Barf", "Garmi", "Nasha", "Madira", "Sharaab", "Afeem", "Neend", "Jaga", "Sote", "Jaagne", "Rona", "Hansi", "Muskurahat", "Jashn", "Mehfil", "Masti", "Thumri", "Qawwali", "Ghazal", "Sangeet", "Taal", "Lay", "Sur", "Alaap", "Bandish", "Geet", "Nagma", "Sargam", "Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];
  return words[Math.floor(Math.random() * words.length)];
};

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export default function AntakshariArena({
  userId,
  userProfile,
  onBack,
}: {
  userId: string;
  userProfile: any;
  onBack: () => void;
}) {
  const { openProfile } = useProfileViewer();
  const pageVisible = usePageVisibility();

  const [view, setView] = useState<"home" | "create" | "join" | "lobby" | "game" | "leaderboard">("home");
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);

  const realtimeRef = useRef<any>(null);

  /* ── Load profile ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, antakshari_level, antakshari_xp, antakshari_coins, antakshari_matches, antakshari_wins, fair_play_score, country, bio")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) setMyProfile(data);
      });
  }, [userId]);

  /* ── Load public rooms ───────────────────────────────────────────────────── */
  const fetchPublicRooms = useCallback(async () => {
    const { data } = await supabase
      .from("antakshari_rooms")
      .select("*")
      .eq("is_public", true)
      .eq("status", "waiting")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setPublicRooms(data);
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    fetchPublicRooms();
    let lastActivityAt = 0;
    const markActive = () => {
      lastActivityAt = Date.now();
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((event) => {
      window.addEventListener(event, markActive, { passive: true });
    });
    const id = setInterval(() => {
      if (Date.now() - lastActivityAt < 2 * 60 * 1000) {
        fetchPublicRooms();
      }
    }, 10000);
    return () => {
      clearInterval(id);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, markActive);
      });
    };
  }, [fetchPublicRooms, pageVisible]);

  /* ── Load leaderboard ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!pageVisible) return;
    supabase
      .from("antakshari_leaderboard")
      .select("user_id, score, wins, matches, profiles(id, full_name, avatar_url, antakshari_level)")
      .eq("period", "global")
      .order("score", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLeaderboard(data as any);
      });
  }, [pageVisible]);

  /* ── Create Room ─────────────────────────────────────────────────────────── */
  const handleCreateRoom = async (roomData: {
    name: string;
    theme: string;
    maxPlayers: number;
    isPublic: boolean;
  }) => {
    setLoading(true);
    setError("");
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: roomRow, error: err } = await supabase
        .from("antakshari_rooms")
        .insert({
          code,
          name: roomData.name,
          theme: roomData.theme,
          max_players: roomData.maxPlayers,
          host_id: userId,
          is_public: roomData.isPublic,
          status: "waiting",
          current_word: getRandomStartingWord(),
          round_number: 0,
        })
        .select()
        .single();

      if (err || !roomRow) throw err || new Error("Failed to create room");

      await supabase.from("antakshari_room_members").insert({
        room_id: roomRow.id,
        user_id: userId,
        is_host: true,
        is_ready: false,
      });

      setRoom(roomRow);
      setView("lobby");
    } catch (e: any) {
      setError(e.message || "Room create failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── Join Room ───────────────────────────────────────────────────────────── */
  const handleJoinRoom = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const { data: roomRow } = await supabase
        .from("antakshari_rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .single();

      if (!roomRow) throw new Error("Room not found");
      if (roomRow.status !== "waiting") throw new Error("Room is already playing");

      const { data: existing } = await supabase
        .from("antakshari_room_members")
        .select("id")
        .eq("room_id", roomRow.id)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        const { count } = await supabase
          .from("antakshari_room_members")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomRow.id);
        if ((count || 0) >= roomRow.max_players) {
          throw new Error("Room is full");
        }
        await supabase.from("antakshari_room_members").insert({
          room_id: roomRow.id,
          user_id: userId,
        });
      }

      setRoom(roomRow);
      setView("lobby");
    } catch (e: any) {
      setError(e.message || "Join failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── Realtime Room Sync ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!room?.id || view !== "lobby" || !pageVisible) return;

    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "antakshari_room_members", filter: `room_id=eq.${room.id}` },
        () => fetchMembers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "antakshari_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) {
            /* merge so host_id and other fields are never lost */
            setRoom((prev) => (prev ? { ...prev, ...(payload.new as Room) } : (payload.new as Room)));
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    fetchMembers();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, view, pageVisible]);

  const fetchMembers = async () => {
    if (!room?.id) return;
    const { data } = await supabase
      .from("antakshari_room_members")
      .select("*, profiles(id, full_name, username, avatar_url, antakshari_level, country)")
      .eq("room_id", room.id);
    if (data) setMembers(data as any);
  };

  const toggleReady = async () => {
    if (!room?.id) return;
    const me = members.find((m) => m.user_id === userId);
    if (!me) return;
    await supabase
      .from("antakshari_room_members")
      .update({ is_ready: !me.is_ready })
      .eq("id", me.id);
    fetchMembers();
  };

  const startGame = async () => {
    if (!room?.id) return;
    /* Only the host may start the game */
    const isHostStart =
      room.host_id === userId ||
      members.some((m) => m.user_id === userId && m.is_host);
    if (!isHostStart) {
      alert("Only the host can start the game!");
      return;
    }
    await supabase
      .from("antakshari_rooms")
      .update({ status: "playing", round_number: 1 })
      .eq("id", room.id);
    setView("game");
  };

  const leaveRoom = async () => {
    if (!room?.id) return;
    await supabase
      .from("antakshari_room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", userId);
    if (room.host_id === userId) {
      await supabase.from("antakshari_rooms").delete().eq("id", room.id);
    }
    setRoom(null);
    setMembers([]);
    setView("home");
  };

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen w-full" style={{ background: BG }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(16px)" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
          <ArrowLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-white font-black text-sm tracking-wide flex items-center gap-2">
            <Mic2 size={16} style={{ color: ORANGE }} />
            Antakshari Arena
          </h1>
          <p className="text-white/30 text-[10px] font-bold tracking-wider">Sing • Play • Connect • Win</p>
        </div>
        {myProfile && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
              <Star size={12} style={{ color: GOLD }} />
              <span className="text-[10px] font-bold text-white/70">{myProfile.antakshari_coins || 0}</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-white/10 overflow-hidden border border-white/10" onClick={() => openProfile?.(userId)}>
              {myProfile.avatar_url ? (
                <img src={myProfile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">{(myProfile.full_name || "U")[0]}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === "home" && (
          <HomeView
            key="home"
            myProfile={myProfile}
            publicRooms={publicRooms}
            leaderboard={leaderboard.slice(0, 5)}
            onCreate={() => setView("create")}
            onJoin={() => setView("join")}
            onLeaderboard={() => setView("leaderboard")}
            onJoinPublic={(code) => handleJoinRoom(code)}
          />
        )}
        {view === "create" && (
          <CreateRoomView key="create" onCreate={handleCreateRoom} onBack={() => setView("home")} loading={loading} error={error} />
        )}
        {view === "join" && (
          <JoinRoomView key="join" onJoin={handleJoinRoom} onBack={() => setView("home")} loading={loading} error={error} />
        )}
        {view === "lobby" && room && (
          <LobbyView
            key="lobby"
            room={room}
            members={members}
            userId={userId}
            onReady={toggleReady}
            onStart={startGame}
            onLeave={leaveRoom}
            onBack={() => setView("home")}
            onOpenProfile={openProfile}
          />
        )}
        {view === "game" && room && (
          <GameView
            key="game"
            room={room}
            members={members}
            userId={userId}
            onLeave={leaveRoom}
            onBackToLobby={() => setView("lobby")}
            myProfile={myProfile}
          />
        )}
        {view === "leaderboard" && (
          <LeaderboardView key="lb" entries={leaderboard} onBack={() => setView("home")} />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HOME VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function HomeView({
  myProfile,
  publicRooms,
  leaderboard,
  onCreate,
  onJoin,
  onLeaderboard,
  onJoinPublic,
}: {
  myProfile: Profile | null;
  publicRooms: Room[];
  leaderboard: LeaderboardEntry[];
  onCreate: () => void;
  onJoin: () => void;
  onLeaderboard: () => void;
  onJoinPublic: (code: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-4 pb-8 space-y-5">
      {/* Hero Card */}
      <GlassCard className="p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${ORANGE} 0%, transparent 70%)` }} />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ORANGE}, #ff8c5a)` }}>
            <Mic2 size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Antakshari Arena</h2>
            <p className="text-white/40 text-xs font-bold">Sing songs starting with the last letter!</p>
          </div>
        </div>
        {myProfile && (
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <Flame size={14} style={{ color: ORANGE }} />
              <span className="text-white/70 text-xs font-bold">Lv.{myProfile.antakshari_level || 1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy size={14} style={{ color: GOLD }} />
              <span className="text-white/70 text-xs font-bold">{myProfile.antakshari_wins || 0} Wins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target size={14} style={{ color: CYAN }} />
              <span className="text-white/70 text-xs font-bold">{myProfile.antakshari_matches || 0} Matches</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionBtn icon={<Plus size={20} />} onClick={onCreate}>
          Create Room
        </ActionBtn>
        <ActionBtn icon={<Radio size={20} />} onClick={onJoin} variant="secondary">
          Join Room
        </ActionBtn>
      </div>

      {/* Public Rooms */}
      {publicRooms.length > 0 && (
        <div>
          <h3 className="text-white/50 text-xs font-black tracking-wider uppercase mb-3 flex items-center gap-2">
            <Globe size={12} /> Public Rooms
          </h3>
          <div className="space-y-2">
            {publicRooms.slice(0, 5).map((r) => (
              <GlassCard key={r.id} className="p-3" onClick={() => onJoinPublic(r.code)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: `linear-gradient(135deg, ${ORANGE}30, ${ORANGE}10)` }}>
                    <Music size={18} style={{ color: ORANGE }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{r.name}</p>
                    <p className="text-white/40 text-[10px] font-bold">{r.theme} • Code: <span className="text-white/60 font-mono">{r.code}</span></p>
                  </div>
                  <div className="flex items-center gap-1 text-white/40 text-xs">
                    <Users size={12} />
                    <span>0/{r.max_players}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Preview */}
      {leaderboard.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white/50 text-xs font-black tracking-wider uppercase flex items-center gap-2">
              <Trophy size={12} /> Global Top 5
            </h3>
            <button onClick={onLeaderboard} className="text-white/30 text-[10px] font-bold flex items-center gap-1">
              View All <ChevronRight size={10} />
            </button>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <GlassCard key={entry.user_id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs" style={{ background: i === 0 ? `${GOLD}20` : i === 1 ? `${CYAN}15` : i === 2 ? `${ORANGE}15` : "rgba(255,255,255,0.05)", color: i === 0 ? GOLD : i === 1 ? CYAN : i === 2 ? ORANGE : "rgba(255,255,255,0.3)" }}>
                    {i + 1}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden">
                    {entry.profiles?.avatar_url ? (
                      <img src={entry.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">{(entry.profiles?.full_name || "U")[0]}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{entry.profiles?.full_name || "Unknown"}</p>
                    <p className="text-white/30 text-[10px] font-bold">Lv.{entry.profiles?.antakshari_level || 1}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-sm">{entry.score}</p>
                    <p className="text-white/30 text-[10px] font-bold">{entry.wins} wins</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE ROOM VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function CreateRoomView({
  onCreate,
  onBack,
  loading,
  error,
}: {
  onCreate: (data: { name: string; theme: string; maxPlayers: number; isPublic: boolean }) => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}) {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("Bollywood");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPublic, setIsPublic] = useState(true);

  const themes = ["Bollywood", "Classical", "Punjabi", "South Indian", "Devotional", "Mixed"];

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 pb-8 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
          <ArrowLeft size={16} />
        </motion.button>
        <h2 className="text-white font-black text-base">Create Room</h2>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-xs font-bold text-red-300 border border-red-500/20 bg-red-500/10">
          {error}
        </div>
      )}

      <GlassCard className="p-4 space-y-4">
        <div>
          <label className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2 block">Room Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Antakshari Room"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
        </div>

        <div>
          <label className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2 block">Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${theme === t ? "text-white border-white/20" : "text-white/40 border-white/5"}`}
                style={theme === t ? { background: `${ORANGE}20` } : { background: "rgba(255,255,255,0.03)" }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2 block">Max Players ({maxPlayers})</label>
          <input
            type="range"
            min={2}
            max={12}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
            className="w-full accent-orange-500"
            style={{ accentColor: ORANGE }}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-white/40 text-[10px] font-black tracking-wider uppercase">Public Room</label>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`w-11 h-6 rounded-full relative transition-colors ${isPublic ? "" : "bg-white/10"}`}
            style={isPublic ? { background: ORANGE } : undefined}
          >
            <motion.div
              animate={{ x: isPublic ? 20 : 2 }}
              className="w-5 h-5 rounded-full bg-white absolute top-0.5"
            />
          </button>
        </div>
      </GlassCard>

      <ActionBtn
        icon={loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        onClick={() => onCreate({ name: name || "Antakshari Room", theme, maxPlayers, isPublic })}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create & Go to Lobby"}
      </ActionBtn>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   JOIN ROOM VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function JoinRoomView({
  onJoin,
  onBack,
  loading,
  error,
}: {
  onJoin: (code: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}) {
  const [code, setCode] = useState("");

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 pb-8 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
          <ArrowLeft size={16} />
        </motion.button>
        <h2 className="text-white font-black text-base">Join Room</h2>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-xs font-bold text-red-300 border border-red-500/20 bg-red-500/10">
          {error}
        </div>
      )}

      <GlassCard className="p-4">
        <label className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2 block">Room Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-letter code"
          maxLength={6}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-white/20 tracking-widest uppercase"
        />
      </GlassCard>

      <ActionBtn
        icon={loading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
        onClick={() => onJoin(code)}
        disabled={loading || code.length < 4}
      >
        {loading ? "Joining..." : "Join Room"}
      </ActionBtn>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LOBBY VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function LobbyView({
  room,
  members,
  userId,
  onReady,
  onStart,
  onLeave,
  onBack,
  onOpenProfile,
}: {
  room: Room;
  members: RoomMember[];
  userId: string;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
  onBack: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const me = members.find((m) => m.user_id === userId);

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="px-4 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
            <ArrowLeft size={16} />
          </motion.button>
          <div>
            <h2 className="text-white font-black text-sm">{room.name}</h2>
            <p className="text-white/30 text-[10px] font-bold">{room.theme} • {members.length}/{room.max_players} players</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
            <span className="text-white font-mono font-bold text-sm">{room.code}</span>
            <button onClick={copyCode} className="text-white/30 hover:text-white/60">
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Players */}
      <div className="space-y-2">
        {members.map((m) => (
          <GlassCard key={m.id} className="p-3" active={m.user_id === userId}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/10 overflow-hidden border border-white/10">
                  {m.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">{(m.profiles?.full_name || "U")[0]}</div>
                  )}
                </div>
                {m.is_host && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
                    <Crown size={10} className="text-black" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0" onClick={() => onOpenProfile?.(m.user_id)}>
                <p className="text-white font-bold text-sm truncate">{m.profiles?.full_name || "Unknown"}</p>
                <p className="text-white/30 text-[10px] font-bold">{m.is_host ? "Host" : "Player"} • Lv.{m.profiles?.antakshari_level || 1}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.is_host ? (
                  <span className="px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1" style={{ background: `${ORANGE}15`, color: ORANGE }}>
                    <Crown size={10} /> Host
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-[10px] font-black text-white/30 bg-white/5">Player</span>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Actions — Start Game visible to everyone; host check inside onStart */}
      <div className="space-y-2 pt-2">
        <ActionBtn icon={<Zap size={20} />} onClick={onStart}>
          Start Game
        </ActionBtn>
        <ActionBtn icon={<ArrowLeft size={20} />} onClick={onLeave} variant="outline">
          Leave Room
        </ActionBtn>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   GAME VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function GameView({
  room,
  members,
  userId,
  onLeave,
  onBackToLobby,
  myProfile,
}: {
  room: Room;
  members: RoomMember[];
  userId: string;
  onLeave: () => void;
  onBackToLobby: () => void;
  myProfile: Profile | null;
}) {
  const [songInput, setSongInput] = useState("");
  const [roundTime, setRoundTime] = useState(30);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([]);

  const currentSinger = members.find((m) => m.user_id === room.current_singer_id);
  const isMyTurn = room.current_singer_id === userId;

  useEffect(() => {
    if (roundTime > 0 && isMyTurn) {
      const t = setTimeout(() => setRoundTime((r) => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [roundTime, isMyTurn]);

  const submitSong = async () => {
    if (!songInput.trim() || !room.id) return;
    await supabase.from("antakshari_rounds").insert({
      match_id: room.id,
      round_number: room.round_number,
      singer_id: userId,
      song_name: songInput.trim(),
      starting_word: room.current_word,
    });
    setGameLog((prev) => [...prev, `${myProfile?.full_name || "You"} sang "${songInput.trim()}" starting with ${room.current_word}`]);
    setSongInput("");
    setHasVoted(false);

    // pick next singer
    const idx = members.findIndex((m) => m.user_id === userId);
    const next = members[(idx + 1) % members.length];
    const nextWord = songInput.trim().slice(-1).toUpperCase();
    await supabase.from("antakshari_rooms").update({ current_singer_id: next.user_id, current_word: nextWord, round_number: room.round_number + 1 }).eq("id", room.id);
    setRoundTime(30);
  };

  const castVote = async (targetId: string, emoji: string) => {
    if (hasVoted || targetId === userId) return;
    await supabase.from("antakshari_votes").insert({
      match_id: room.id,
      round_number: room.round_number,
      voter_id: userId,
      singer_id: targetId,
      emoji,
    });
    setVotes((prev) => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }));
    setHasVoted(true);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="px-4 pb-8 space-y-4">
      {/* Game Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBackToLobby} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
            <ArrowLeft size={16} />
          </motion.button>
          <div>
            <h2 className="text-white font-black text-sm">Round {room.round_number}</h2>
            <p className="text-white/30 text-[10px] font-bold">{room.theme} Theme</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white font-mono font-bold text-sm">{roundTime}s</span>
          </div>
        </div>
      </div>

      {/* Current Word Banner */}
      <GlassCard className="p-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${ORANGE}, transparent 70%)` }} />
        <p className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2">Sing a song starting with</p>
        <h3 className="text-5xl font-black text-white tracking-wider">{room.current_word}</h3>
        {currentSinger && (
          <p className="text-white/40 text-xs font-bold mt-2 flex items-center justify-center gap-1">
            <Mic2 size={12} style={{ color: ORANGE }} />
            {currentSinger.profiles?.full_name || "Unknown"} is singing...
          </p>
        )}
      </GlassCard>

      {/* Singer Input */}
      {isMyTurn && (
        <GlassCard className="p-4 space-y-3">
          <input
            value={songInput}
            onChange={(e) => setSongInput(e.target.value)}
            placeholder={`Song starting with "${room.current_word}"...`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
          <ActionBtn icon={<Music size={20} />} onClick={submitSong} disabled={!songInput.trim()}>
            Submit Song
          </ActionBtn>
        </GlassCard>
      )}

      {/* Voting */}
      {!isMyTurn && currentSinger && (
        <GlassCard className="p-4">
          <p className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-3">Vote for {currentSinger.profiles?.full_name || "Singer"}</p>
          <div className="flex items-center gap-2">
            {["❤️", "🔥", "⭐", "👏"].map((emoji) => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.85 }}
                onClick={() => castVote(currentSinger.user_id, emoji)}
                disabled={hasVoted}
                className={`flex-1 py-3 rounded-xl text-xl border ${hasVoted ? "opacity-40" : "border-white/10 bg-white/5"}`}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
          {hasVoted && <p className="text-white/30 text-[10px] font-bold text-center mt-2">Vote cast! Wait for next round.</p>}
        </GlassCard>
      )}

      {/* Live Log */}
      {gameLog.length > 0 && (
        <GlassCard className="p-4">
          <p className="text-white/40 text-[10px] font-black tracking-wider uppercase mb-2">Game Log</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {gameLog.map((log, i) => (
              <p key={i} className="text-white/50 text-[11px] font-bold">• {log}</p>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Leave */}
      <ActionBtn icon={<ArrowLeft size={20} />} onClick={onLeave} variant="outline">
        End Game & Leave
      </ActionBtn>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LEADERBOARD VIEW
   ════════════════════════════════════════════════════════════════════════════ */
function LeaderboardView({
  entries,
  onBack,
}: {
  entries: LeaderboardEntry[];
  onBack: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 pb-8 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
          <ArrowLeft size={16} />
        </motion.button>
        <h2 className="text-white font-black text-base flex items-center gap-2">
          <Trophy size={18} style={{ color: GOLD }} /> Global Leaderboard
        </h2>
      </div>

      <div className="space-y-2">
        {entries.map((entry, i) => (
          <GlassCard key={entry.user_id} className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm" style={{ background: i === 0 ? `${GOLD}20` : i === 1 ? `${CYAN}15` : i === 2 ? `${ORANGE}15` : "rgba(255,255,255,0.05)", color: i === 0 ? GOLD : i === 1 ? CYAN : i === 2 ? ORANGE : "rgba(255,255,255,0.3)" }}>
                {i + 1}
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 overflow-hidden border border-white/10">
                {entry.profiles?.avatar_url ? (
                  <img src={entry.profiles.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">{(entry.profiles?.full_name || "U")[0]}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{entry.profiles?.full_name || "Unknown"}</p>
                <p className="text-white/30 text-[10px] font-bold">Lv.{entry.profiles?.antakshari_level || 1} • {entry.matches} matches</p>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-lg">{entry.score}</p>
                <p className="text-white/30 text-[10px] font-bold">{entry.wins} wins</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
}
