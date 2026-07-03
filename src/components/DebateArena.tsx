import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, X, Send, Crown, Clock, Swords, Heart, Eye, EyeOff,
  Shield, Flame, CheckCircle2, XCircle, Loader2, Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Profile { full_name: string; avatar_url: string | null; }

interface DebateChallenge {
  id: string;
  survey_id: string;
  challenger_id: string;
  responder_id: string;
  status: "pending" | "active" | "rejected" | "finished" | "expired";
  is_public: boolean;
  expires_at: string;
  finished_at: string | null;
  winner_id: string | null;
  created_at: string;
  challenger?: Profile;
  responder?: Profile;
}

interface DebateMessage {
  id: string;
  debate_id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  user_liked?: boolean;
  profiles?: Profile;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { h, m, s, expired: left === 0 };
}

const DA: React.FC<{ url?: string | null; name?: string; size?: number; ring?: string }> = ({
  url, name = "?", size = 44, ring,
}) => (
  url
    ? <img src={resolveMediaUrl(url, "avatars")} className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, border: ring ? `2.5px solid ${ring}` : undefined }} />
    : <div className="rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.38, border: ring ? `2.5px solid ${ring}` : undefined }}>
        {name.charAt(0).toUpperCase()}
      </div>
);

// ── Debate Room Overlay ────────────────────────────────────────────────────────
const DebateRoom: React.FC<{
  debate: DebateChallenge;
  messages: DebateMessage[];
  currentUserId: string;
  surveyQuestion: string;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
  onLike: (msgId: string, liked: boolean) => Promise<void>;
  onEnd: () => Promise<void>;
  onMakePublic: () => Promise<void>;
}> = ({ debate, messages, currentUserId, surveyQuestion, onClose, onSend, onLike, onEnd, onMakePublic }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { h, m, s, expired } = useCountdown(
    debate.status === "active" ? debate.expires_at : null
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isMine = (uid: string) => uid === currentUserId;
  const amChallenger = debate.challenger_id === currentUserId;
  const myProfile  = amChallenger ? debate.challenger : debate.responder;
  const oppProfile = amChallenger ? debate.responder  : debate.challenger;
  const myColor    = "#6366f1";
  const oppColor   = "#ec4899";

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onSend(text.trim());
    setText("");
    setSending(false);
  };

  const handleEnd = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    setEnding(true);
    await onEnd();
    setEnding(false);
    setConfirmEnd(false);
  };

  // Determine winner by likes
  const myLikes  = messages.filter(m => m.user_id === currentUserId).reduce((a, m) => a + m.likes_count, 0);
  const oppId    = amChallenger ? debate.responder_id : debate.challenger_id;
  const oppLikes = messages.filter(m => m.user_id === oppId).reduce((a, m) => a + m.likes_count, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] flex flex-col"
      style={{ background: "linear-gradient(180deg,#0d0d1a 0%,#0a0a14 100%)" }}>

      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Swords size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-[13px] leading-none">Debate Duel</p>
            <p className="text-white/30 text-[10px] truncate max-w-[160px]">{surveyQuestion}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {debate.status === "active" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: expired ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)", border: `1px solid ${expired ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.3)"}` }}>
              <Clock size={10} className={expired ? "text-red-400" : "text-orange-400"} />
              <span className={`text-[11px] font-black tabular-nums ${expired ? "text-red-400" : "text-orange-300"}`}>
                {expired ? "EXPIRED" : `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
              </span>
            </div>
          )}
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <X size={13} className="text-white/60" />
          </motion.button>
        </div>
      </div>

      {/* ── VS Header ── */}
      <div className="shrink-0 px-4 py-4"
        style={{ background: "linear-gradient(180deg,rgba(99,102,241,0.06),transparent)" }}>
        <div className="flex items-center justify-between">
          {/* Challenger */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <DA url={amChallenger ? myProfile?.avatar_url : oppProfile?.avatar_url}
                name={amChallenger ? myProfile?.full_name : oppProfile?.full_name}
                size={52} ring={myColor} />
            <p className="text-[11px] font-black text-center leading-tight"
              style={{ color: myColor }}>
              {(amChallenger ? myProfile?.full_name : oppProfile?.full_name) || "You"}
            </p>
            {debate.status === "finished" && debate.winner_id === debate.challenger_id && (
              <div className="flex items-center gap-0.5">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-black">Winner</span>
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-[15px]"
              style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", boxShadow: "0 0 20px rgba(239,68,68,0.4)" }}>
              VS
            </div>
            {debate.status === "active" && (
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Live Duel</span>
            )}
            {debate.status === "finished" && (
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Finished</span>
            )}
          </div>

          {/* Responder */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <DA url={amChallenger ? oppProfile?.avatar_url : myProfile?.avatar_url}
                name={amChallenger ? oppProfile?.full_name : myProfile?.full_name}
                size={52} ring={oppColor} />
            <p className="text-[11px] font-black text-center leading-tight"
              style={{ color: oppColor }}>
              {(amChallenger ? oppProfile?.full_name : myProfile?.full_name) || "Opponent"}
            </p>
            {debate.status === "finished" && debate.winner_id === debate.responder_id && (
              <div className="flex items-center gap-0.5">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-black">Winner</span>
              </div>
            )}
          </div>
        </div>

        {/* Score bar (after finish) */}
        {debate.status === "finished" && (myLikes + oppLikes) > 0 && (
          <div className="mt-3 rounded-full overflow-hidden h-2 flex" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(myLikes/(myLikes+oppLikes)*100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ background: myColor }} />
            <div style={{ flex: 1, background: oppColor }} />
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.length === 0 && debate.status === "active" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <Flame size={32} className="text-orange-400/50" />
            <p className="text-white/30 text-[13px] font-bold text-center">
              Arena is ready. First argument wins the crowd!
            </p>
          </div>
        )}

        {messages.map(msg => {
          const mine = isMine(msg.user_id);
          const color = mine ? myColor : oppColor;
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, x: mine ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", damping: 20 }}
              className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
              <DA url={msg.profiles?.avatar_url} name={msg.profiles?.full_name}
                size={28} ring={color} />
              <div className="max-w-[72%]">
                <div className="px-4 py-2.5 rounded-2xl text-[13px] text-white font-medium leading-snug"
                  style={{ background: mine ? `${myColor}22` : `${oppColor}22`, border: `1.5px solid ${color}35`,
                           borderBottomRightRadius: mine ? 4 : undefined,
                           borderBottomLeftRadius: !mine ? 4 : undefined }}>
                  {msg.content}
                </div>
                {/* Like row */}
                <div className={`flex items-center gap-2 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <motion.button whileTap={{ scale: 0.8 }}
                    onClick={() => onLike(msg.id, !!msg.user_liked)}
                    className="flex items-center gap-1">
                    <Heart size={12} className={msg.user_liked ? "fill-rose-500 text-rose-500" : "text-white/25"} />
                    {msg.likes_count > 0 && (
                      <span className="text-[10px] text-white/30 font-bold">{msg.likes_count}</span>
                    )}
                  </motion.button>
                  <span className="text-[9px] text-white/20">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Input Bar or Finished Controls ── */}
      {debate.status === "active" ? (
        <div className="shrink-0 px-4 py-3 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="State your argument…"
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-[13px] placeholder-white/25 outline-none focus:border-indigo-500/50" />
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 disabled:opacity-40">
              {sending ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
            </motion.button>
          </div>

          <AnimatePresence>
            {confirmEnd ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="flex items-center gap-2">
                <span className="text-white/50 text-[11px] flex-1">End this debate?</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleEnd} disabled={ending}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black text-white"
                  style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
                  {ending ? "Ending…" : "Confirm End"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmEnd(false)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white/50"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  Cancel
                </motion.button>
              </motion.div>
            ) : (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                whileTap={{ scale: 0.95 }} onClick={handleEnd}
                className="w-full py-2 rounded-xl text-[12px] font-bold text-red-400/60 hover:text-red-400"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                🏳 End Debate
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      ) : debate.status === "finished" ? (
        <div className="shrink-0 px-4 py-4 space-y-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <Trophy size={20} className="text-yellow-400 shrink-0" />
            <div className="flex-1">
              <p className="text-white font-black text-[13px]">Debate Concluded</p>
              {debate.winner_id ? (
                <p className="text-white/50 text-[11px]">
                  {debate.winner_id === currentUserId
                    ? "🎉 You won! +1 Debater Level"
                    : "Better luck next time!"}
                </p>
              ) : (
                <p className="text-white/50 text-[11px]">It's a draw!</p>
              )}
            </div>
          </div>

          {!debate.is_public && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={onMakePublic}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-black text-white"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))", border: "1px solid rgba(99,102,241,0.3)" }}>
              <Eye size={15} className="text-indigo-400" />
              Make Debate Public
              <span className="text-[10px] text-white/30 font-normal ml-1">Let others read</span>
            </motion.button>
          )}
          {debate.is_public && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Eye size={13} className="text-emerald-400" />
              <span className="text-emerald-400 text-[12px] font-bold">This debate is now public</span>
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
};

// ── Main: DebateButton ────────────────────────────────────────────────────────
export const DebateButton: React.FC<{
  surveyId: string;
  surveyQuestion: string;
  surveyOwnerId: string;
  currentUserId: string;
}> = ({ surveyId, surveyQuestion, surveyOwnerId, currentUserId }) => {
  const isSelf = surveyOwnerId === currentUserId;

  const [debate, setDebate]       = useState<DebateChallenge | null>(null);
  const [messages, setMessages]   = useState<DebateMessage[]>([]);
  const [showArena, setShowArena] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [accepting, setAccepting]     = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch debate ────────────────────────────────────────────────────────────
  const fetchDebate = useCallback(async () => {
    const { data } = await supabase
      .from("debate_challenges")
      .select(`
        *,
        challenger:profiles!challenger_id(full_name, avatar_url),
        responder:profiles!responder_id(full_name, avatar_url)
      `)
      .eq("survey_id", surveyId)
      .or(`challenger_id.eq.${currentUserId},responder_id.eq.${currentUserId}`)
      .neq("status", "expired")
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Auto-expire if 48h passed
      if (data.status === "pending" && new Date(data.expires_at) < new Date()) {
        await supabase.from("debate_challenges")
          .update({ status: "expired" }).eq("id", data.id);
        setDebate(null);
      } else {
        setDebate(data as DebateChallenge);
      }
    } else {
      setDebate(null);
    }
  }, [surveyId, currentUserId]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (debateId: string) => {
    const { data } = await supabase
      .from("debate_messages")
      .select("*, profiles(full_name, avatar_url)")
      .eq("debate_id", debateId)
      .order("created_at", { ascending: true });

    if (!data) return;

    const { data: likedRows } = await supabase
      .from("debate_message_likes")
      .select("message_id")
      .in("message_id", data.map(m => m.id))
      .eq("user_id", currentUserId);

    const likedSet = new Set((likedRows || []).map(r => r.message_id));
    setMessages(data.map(m => ({ ...m, user_liked: likedSet.has(m.id) })));
  }, [currentUserId]);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    fetchDebate();
  }, [fetchDebate]);

  useEffect(() => {
    if (!debate?.id) return;
    if (debate.status === "active" || debate.status === "finished") {
      fetchMessages(debate.id);
    }
  }, [debate?.id, debate?.status, fetchMessages]);

  useEffect(() => {
    // Subscribe to challenges where I'm the responder (incoming challenge notification)
    const ch = supabase
      .channel(`debate-watch-${surveyId}-${currentUserId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "debate_challenges",
        filter: `survey_id=eq.${surveyId}`,
      }, (payload) => {
        const row = payload.new as DebateChallenge;
        if (row.challenger_id === currentUserId || row.responder_id === currentUserId) {
          fetchDebate();
          // Incoming challenge notification
          if (payload.eventType === "INSERT" && row.responder_id === currentUserId) {
            toast.custom(() => (
              <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
                style={{ background: "linear-gradient(135deg,#1a1a2e,#0d0d1a)", border: "1.5px solid rgba(239,68,68,0.4)" }}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
                  <Swords size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-[13px]">⚔️ Debate Challenge!</p>
                  <p className="text-white/60 text-[11px]">Someone challenged you to a debate</p>
                </div>
              </motion.div>
            ), { duration: 5000 });
          }
        }
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [surveyId, currentUserId, fetchDebate]);

  useEffect(() => {
    if (!debate?.id || debate.status !== "active") return;
    const ch = supabase
      .channel(`debate-msgs-${debate.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "debate_messages",
        filter: `debate_id=eq.${debate.id}`,
      }, () => fetchMessages(debate.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [debate?.id, debate?.status, fetchMessages]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleChallenge = async () => {
    if (challenging || isSelf) return;

    // ── Auth guard ──────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to start a debate");
      return;
    }

    setChallenging(true);
    setLoading(true);

    // Get my profile
    const { data: myProfile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).single();

    const { data: newDebate, error } = await supabase
      .from("debate_challenges")
      .insert({
        survey_id: surveyId,
        challenger_id: user.id,
        responder_id: surveyOwnerId,
        status: "pending",
        // 48-hour window for the owner to accept / reject
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select("*, challenger:profiles!challenger_id(full_name,avatar_url), responder:profiles!responder_id(full_name,avatar_url)")
      .single();

    if (error) {
      // Log every field so we can see exactly what went wrong in console
      console.error("[DebateArena] insert error →", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      if (error.code === "42501") {
        // RLS blocked the insert — instruct user to run the SQL fix
        toast.error("⚠️ RLS blocked: run supabase_debate_rls.sql in Supabase Dashboard → SQL Editor", { duration: 8000 });
      } else if (error.code === "23505") {
        toast.error("You already have an active debate on this survey");
      } else if (error.code === "23502") {
        toast.error(`DB error (missing required field): ${error.message}`);
      } else {
        toast.error(`Challenge failed (${error.code || "unknown"}): ${error.message}`);
      }
    } else {
      setDebate(newDebate as DebateChallenge);

      // Notify the survey owner — fire-and-forget with full error logging
      supabase.from("notifications").insert({
        notifier_id: surveyOwnerId,
        actor_id: user.id,
        type: "debate_challenge",
        reference_id: newDebate.id,
        message: `${myProfile?.full_name || "Someone"} challenged you to a debate!`,
      }).then(({ error: ne }) => {
        if (ne) console.warn("[DebateArena] notification insert failed:", ne.code, ne.message);
      });

      toast.success("⚔️ Challenge sent! Owner will see Accept/Reject popup.");
    }

    setChallenging(false);
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!debate || accepting) return;
    setAccepting(true);
    const { error } = await supabase
      .from("debate_challenges")
      .update({ status: "active", expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })
      .eq("id", debate.id);
    if (!error) {
      await fetchDebate();
      setShowArena(true);
      toast.success("🔥 Debate accepted! Arena is live.");
    }
    setAccepting(false);
  };

  const handleReject = async () => {
    if (!debate) return;
    await supabase.from("debate_challenges").update({ status: "rejected" }).eq("id", debate.id);
    setDebate(null);
    toast("Challenge rejected.");
  };

  const handleSend = async (content: string) => {
    if (!debate) return;
    const { data: msg } = await supabase
      .from("debate_messages")
      .insert({ debate_id: debate.id, user_id: currentUserId, content })
      .select("*, profiles(full_name, avatar_url)")
      .single();
    if (msg) setMessages(prev => [...prev, { ...msg, user_liked: false }]);
  };

  const handleLike = async (msgId: string, liked: boolean) => {
    if (liked) {
      await supabase.from("debate_message_likes").delete()
        .eq("message_id", msgId).eq("user_id", currentUserId);
    } else {
      await supabase.from("debate_message_likes").insert({ message_id: msgId, user_id: currentUserId });
    }
    // Recount and sync to messages table
    const { count } = await supabase.from("debate_message_likes")
      .select("*", { count: "exact", head: true }).eq("message_id", msgId);
    await supabase.from("debate_messages").update({ likes_count: count ?? 0 }).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId
      ? { ...m, likes_count: count || 0, user_liked: !liked }
      : m
    ));
  };

  const handleEnd = async () => {
    if (!debate) return;
    // Determine winner
    const oppId = debate.challenger_id === currentUserId ? debate.responder_id : debate.challenger_id;
    const myTotal  = messages.filter(m => m.user_id === currentUserId).reduce((a, m) => a + m.likes_count, 0);
    const oppTotal = messages.filter(m => m.user_id === oppId).reduce((a, m) => a + m.likes_count, 0);
    const winnerId = myTotal > oppTotal ? currentUserId : oppTotal > myTotal ? oppId : null;

    await supabase.from("debate_challenges").update({
      status: "finished", finished_at: new Date().toISOString(), winner_id: winnerId,
    }).eq("id", debate.id);

    // Increment debater_level for winner
    if (winnerId) {
      const { data: prof } = await supabase.from("profiles").select("debater_level").eq("id", winnerId).single();
      if (prof) {
        await supabase.from("profiles").update({ debater_level: (prof.debater_level || 0) + 1 }).eq("id", winnerId);
      }
    }

    await fetchDebate();
    toast.success(winnerId === currentUserId ? "🏆 You won the debate! +1 Debater Level" : "Debate ended.");
  };

  const handleMakePublic = async () => {
    if (!debate) return;
    await supabase.from("debate_challenges").update({ is_public: true }).eq("id", debate.id);
    await fetchDebate();
    toast.success("Debate is now public 🌐");
  };

  // ── Button appearance by state ──────────────────────────────────────────────
  const btnState = (() => {
    if (!debate) return isSelf ? "own" : "idle";
    if (debate.status === "pending") {
      return debate.challenger_id === currentUserId ? "sent" : "received";
    }
    return debate.status; // "active" | "finished"
  })();

  const btnConfig: Record<string, { color: string; bg: string; border: string; label: string; pulse: boolean }> = {
    idle:     { color: "#ec4899", bg: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.4)",  label: "Debate",  pulse: true  },
    own:      { color: "#94a3b8", bg: "rgba(148,163,184,0.08)",border: "rgba(148,163,184,0.15)",label: "Debate",  pulse: false },
    sent:     { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  label: "Pending", pulse: true  },
    received: { color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.45)",  label: "Accept!", pulse: true  },
    active:   { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.35)", label: "Arena",   pulse: true  },
    finished: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  label: "Results", pulse: false },
    rejected: { color: "#ec4899", bg: "rgba(236,72,153,0.1)",  border: "rgba(236,72,153,0.25)", label: "Debate",  pulse: false },
  };

  const cfg = btnConfig[btnState] || btnConfig.idle;

  return (
    <>
      {/* ── Debate Button ── */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        disabled={btnState === "own" || loading}
        onClick={() => {
          if (btnState === "idle" || btnState === "rejected") { handleChallenge(); }
          else if (btnState === "received")                  { setShowArena(true); }
          else if (btnState === "sent")                      { toast("Waiting for them to accept…"); }
          else if (btnState === "active" || btnState === "finished") { setShowArena(true); }
        }}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all disabled:cursor-default"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>

        {cfg.pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
            style={{ background: cfg.color, opacity: 0.7 }} />
        )}
        {loading
          ? <Loader2 size={13} className="animate-spin" style={{ color: cfg.color }} />
          : (
            <motion.div
              animate={cfg.pulse ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ repeat: cfg.pulse ? Infinity : 0, duration: 1.4, ease: "easeInOut" }}>
              <Mic size={13} style={{ color: cfg.color }} />
            </motion.div>
          )
        }
        <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.label}</span>
      </motion.button>

      {/* ── Incoming Challenge Notification (inline) ── */}
      <AnimatePresence>
        {btnState === "received" && debate && !showArena && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }} style={{ transformOrigin: "top" }}
            className="fixed bottom-24 left-0 right-0 z-[550] flex justify-center px-4 pointer-events-none">
            <motion.div
              className="w-full max-w-sm rounded-2xl overflow-hidden pointer-events-auto"
              style={{ background: "linear-gradient(135deg,#1a0d2e,#0d0d1a)", border: "1.5px solid rgba(239,68,68,0.5)", boxShadow: "0 0 30px rgba(239,68,68,0.25)" }}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
                  <Swords size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-[13px]">⚔️ Debate Challenge!</p>
                  <p className="text-white/60 text-[11px] truncate">
                    <span className="text-orange-300 font-bold">{debate.challenger?.full_name || "Someone"}</span> challenged you
                  </p>
                </div>
              </div>
              <div className="flex border-t border-white/8">
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold text-red-400/70">
                  <XCircle size={13} /> Reject
                </motion.button>
                <div className="w-px bg-white/8" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleAccept} disabled={accepting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-black text-emerald-400">
                  {accepting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Accept Debate!
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Arena Overlay ── */}
      <AnimatePresence>
        {showArena && debate && (
          debate.status === "active" || debate.status === "finished" ? (
            <DebateRoom
              debate={debate}
              messages={messages}
              currentUserId={currentUserId}
              surveyQuestion={surveyQuestion}
              onClose={() => setShowArena(false)}
              onSend={handleSend}
              onLike={handleLike}
              onEnd={handleEnd}
              onMakePublic={handleMakePublic}
            />
          ) : debate.status === "pending" && debate.responder_id === currentUserId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600] flex items-center justify-center px-6"
              style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
              onClick={() => setShowArena(false)}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-sm rounded-3xl overflow-hidden"
                style={{ background: "linear-gradient(180deg,#1a0d2e,#0d0d1a)", border: "1.5px solid rgba(239,68,68,0.4)" }}
                onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4"
                    style={{ boxShadow: "0 0 30px rgba(239,68,68,0.4)" }}>
                    <Swords size={28} className="text-white" />
                  </div>
                  <h2 className="text-white font-black text-[20px] mb-1">⚔️ Debate Challenge!</h2>
                  <p className="text-white/50 text-[13px] mb-1">
                    <span className="text-orange-300 font-bold">{debate.challenger?.full_name}</span> has challenged you
                  </p>
                  <p className="text-white/30 text-[11px] mb-6 px-4 line-clamp-2">"{surveyQuestion}"</p>
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={handleReject}
                      className="flex-1 py-3 rounded-2xl text-[13px] font-black text-red-400"
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      Decline
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={handleAccept} disabled={accepting}
                      className="flex-1 py-3 rounded-2xl text-[13px] font-black text-white"
                      style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}>
                      {accepting ? "Accepting…" : "🔥 Accept!"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null
        )}
      </AnimatePresence>
    </>
  );
};
