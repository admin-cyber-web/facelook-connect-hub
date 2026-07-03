import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, X, Send, Crown, Clock, Swords, Heart, Eye,
  Shield, Flame, CheckCircle2, XCircle, Loader2, Trophy, Timer,
  ThumbsUp, ThumbsDown, Star,
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

// ── Vote types ────────────────────────────────────────────────────────────────
type VoteType = "accepted" | "rejected";
interface VoteEntry { accepted: number; rejected: number; myVote: VoteType | null; }
type VoteMap = Record<string, VoteEntry>;

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

// ── News Jingle via Web Audio API ─────────────────────────────────────────────
function playDebateJingle() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { freq: 523, dur: 0.12, start: 0.0 },
      { freq: 659, dur: 0.12, start: 0.14 },
      { freq: 784, dur: 0.12, start: 0.28 },
      { freq: 1047, dur: 0.22, start: 0.42 },
      { freq: 784, dur: 0.10, start: 0.66 },
      { freq: 1047, dur: 0.35, start: 0.78 },
    ];
    notes.forEach(({ freq, dur, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch { /* silent */ }
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
  votes: VoteMap;
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
  onLike: (msgId: string, liked: boolean) => Promise<void>;
  onVote: (msgId: string, voteType: VoteType) => Promise<void>;
  onEnd: () => Promise<void>;
  onMakePublic: () => Promise<void>;
}> = ({ debate, messages, currentUserId, surveyQuestion, votes, onClose, onSend, onLike, onVote, onEnd, onMakePublic }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { h, m, s, expired } = useCountdown(
    debate.status === "active" ? debate.expires_at : null
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, opponentTyping]);

  // ── Typing broadcast ────────────────────────────────────────────────────────
  useEffect(() => {
    if (debate.status !== "active") return;
    const ch = supabase
      .channel(`debate-typing-${debate.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.user_id !== currentUserId) {
          setOpponentTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOpponentTyping(false), 2500);
        }
      })
      .subscribe();
    typingChannelRef.current = ch;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(ch);
    };
  }, [debate.id, debate.status, currentUserId]);

  const broadcastTyping = useCallback(() => {
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: currentUserId },
    });
  }, [currentUserId]);

  const amChallenger = debate.challenger_id === currentUserId;
  const myProfile    = amChallenger ? debate.challenger : debate.responder;
  const oppProfile   = amChallenger ? debate.responder  : debate.challenger;
  const CHALL_COLOR  = "#6366f1"; // indigo — always challenger
  const RESP_COLOR   = "#ec4899"; // pink — always responder

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

  const myLikes  = messages.filter(m => m.user_id === currentUserId).reduce((a, m) => a + m.likes_count, 0);
  const oppId    = amChallenger ? debate.responder_id : debate.challenger_id;
  const oppLikes = messages.filter(m => m.user_id === oppId).reduce((a, m) => a + m.likes_count, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg,#0d0d1a 0%,#0a0a14 100%)" }}>

      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 safe-area-top"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Swords size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-[13px] leading-none">Live Debate</p>
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
      <div className="shrink-0 px-4 py-3"
        style={{ background: "linear-gradient(180deg,rgba(99,102,241,0.06),transparent)" }}>
        <div className="flex items-center justify-between">
          {/* Challenger — always LEFT */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <DA url={debate.challenger?.avatar_url} name={debate.challenger?.full_name} size={48} ring={CHALL_COLOR} />
            <p className="text-[11px] font-black text-center leading-tight" style={{ color: CHALL_COLOR }}>
              {debate.challenger?.full_name || "Challenger"}
            </p>
            <span className="text-[9px] text-indigo-400/60 font-bold uppercase tracking-wide">Challenger</span>
            {debate.status === "finished" && debate.winner_id === debate.challenger_id && (
              <div className="flex items-center gap-0.5">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-black">Winner</span>
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-[14px]"
              style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", boxShadow: "0 0 16px rgba(239,68,68,0.4)" }}>
              VS
            </div>
            {debate.status === "active" && (
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Live</span>
            )}
            {debate.status === "finished" && (
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Done</span>
            )}
          </div>

          {/* Responder — always RIGHT */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <DA url={debate.responder?.avatar_url} name={debate.responder?.full_name} size={48} ring={RESP_COLOR} />
            <p className="text-[11px] font-black text-center leading-tight" style={{ color: RESP_COLOR }}>
              {debate.responder?.full_name || "Responder"}
            </p>
            <span className="text-[9px] text-pink-400/60 font-bold uppercase tracking-wide">Responder</span>
            {debate.status === "finished" && debate.winner_id === debate.responder_id && (
              <div className="flex items-center gap-0.5">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-black">Winner</span>
              </div>
            )}
          </div>
        </div>

        {/* Vote score bar (after finish) */}
        {debate.status === "finished" && (() => {
          const challAcc = messages
            .filter(m => m.user_id === debate.challenger_id)
            .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
          const respAcc  = messages
            .filter(m => m.user_id === debate.responder_id)
            .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
          const total = challAcc + respAcc;
          return total > 0 ? (
            <div className="mt-3 space-y-1">
              <div className="rounded-full overflow-hidden h-2 flex" style={{ background: "rgba(255,255,255,0.07)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(challAcc/total*100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{ background: CHALL_COLOR }} />
                <div style={{ flex: 1, background: RESP_COLOR }} />
              </div>
              <div className="flex justify-between text-[9px] font-bold opacity-50">
                <span style={{ color: CHALL_COLOR }}>✅ {challAcc} accepted</span>
                <span style={{ color: RESP_COLOR }}>✅ {respAcc} accepted</span>
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && debate.status === "active" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <Flame size={32} className="text-orange-400/50" />
            <p className="text-white/30 text-[13px] font-bold text-center">
              Arena is ready. First argument wins the crowd!
            </p>
          </div>
        )}

        {[...messages]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(msg => {
          // Challenger always LEFT, responder always RIGHT
          const isChallenger = msg.user_id === debate.challenger_id;
          const color = isChallenger ? CHALL_COLOR : RESP_COLOR;
          const alignRight = !isChallenger; // responder = right

          const senderProfile = isChallenger ? debate.challenger : debate.responder;

          return (
            <motion.div key={msg.id}
              initial={{ opacity: 0, x: alignRight ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", damping: 22 }}
              className={`flex items-end gap-2 ${alignRight ? "flex-row-reverse" : "flex-row"}`}>
              <DA url={senderProfile?.avatar_url} name={senderProfile?.full_name} size={28} ring={color} />
              <div className={`max-w-[72%] ${alignRight ? "items-end" : "items-start"} flex flex-col`}>
                <div className="px-3.5 py-2.5 rounded-2xl text-[13px] text-white font-medium leading-snug"
                  style={{
                    background: `${color}1e`,
                    border: `1.5px solid ${color}40`,
                    borderBottomRightRadius: alignRight ? 4 : undefined,
                    borderBottomLeftRadius: !alignRight ? 4 : undefined,
                  }}>
                  {msg.content}
                </div>
                {/* Like + time row */}
                <div className={`flex items-center gap-2 mt-1 ${alignRight ? "flex-row-reverse" : "flex-row"}`}>
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

                {/* ✅ / ❌ Verdict vote row */}
                <div className={`flex items-center gap-1.5 mt-1.5 ${alignRight ? "flex-row-reverse" : "flex-row"}`}>
                  {(["accepted", "rejected"] as VoteType[]).map(vt => {
                    const entry = votes[msg.id];
                    const count = entry?.[vt] ?? 0;
                    const isMyVote = entry?.myVote === vt;
                    const isAcc = vt === "accepted";
                    return (
                      <motion.button key={vt} whileTap={{ scale: 0.85 }}
                        onClick={() => onVote(msg.id, vt)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all"
                        style={{
                          background: isMyVote
                            ? (isAcc ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)")
                            : "rgba(255,255,255,0.05)",
                          border: `1px solid ${isMyVote
                            ? (isAcc ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)")
                            : "rgba(255,255,255,0.08)"}`,
                          color: isMyVote ? (isAcc ? "#10b981" : "#ef4444") : "rgba(255,255,255,0.3)",
                        }}>
                        {isAcc
                          ? <ThumbsUp size={9} className={isMyVote ? "fill-emerald-400" : ""} />
                          : <ThumbsDown size={9} className={isMyVote ? "fill-red-400" : ""} />}
                        <span>{isAcc ? "Accepted" : "Rejected"}</span>
                        {count > 0 && <span className="ml-0.5 opacity-70">{count}</span>}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {opponentTyping && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2 px-1">
              <DA
                url={amChallenger ? debate.responder?.avatar_url : debate.challenger?.avatar_url}
                name={amChallenger ? debate.responder?.full_name : debate.challenger?.full_name}
                size={24}
                ring={amChallenger ? RESP_COLOR : CHALL_COLOR}
              />
              <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-sm"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.span key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay, ease: "easeInOut" }}
                    className="w-1.5 h-1.5 rounded-full bg-white/40 inline-block" />
                ))}
              </div>
              <span className="text-[10px] text-white/25 font-medium">typing…</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={endRef} />
      </div>

      {/* ── Input Bar or Finished Controls ── */}
      {debate.status === "active" ? (
        <div className="shrink-0 px-4 pt-3 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => { setText(e.target.value); broadcastTyping(); }}
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
        <div className="shrink-0 px-4 pt-4 space-y-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <Trophy size={20} className="text-yellow-400 shrink-0" />
            <div className="flex-1">
              <p className="text-white font-black text-[13px]">Debate Concluded</p>
              {debate.winner_id ? (
                <p className="text-white/50 text-[11px]">
                  {debate.winner_id === currentUserId ? "🎉 You won! +1 Debater Level" : "Better luck next time!"}
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

// ── Debate Result Modal ───────────────────────────────────────────────────────
const DebateResultModal: React.FC<{
  debate: DebateChallenge;
  messages: DebateMessage[];
  votes: VoteMap;
  currentUserId: string;
  onClose: () => void;
  onMakePublic: () => Promise<void>;
}> = ({ debate, messages, votes, currentUserId, onClose, onMakePublic }) => {
  const challAcc = messages
    .filter(m => m.user_id === debate.challenger_id)
    .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
  const challRej = messages
    .filter(m => m.user_id === debate.challenger_id)
    .reduce((sum, m) => sum + (votes[m.id]?.rejected ?? 0), 0);
  const respAcc = messages
    .filter(m => m.user_id === debate.responder_id)
    .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
  const respRej = messages
    .filter(m => m.user_id === debate.responder_id)
    .reduce((sum, m) => sum + (votes[m.id]?.rejected ?? 0), 0);

  const winnerId = debate.winner_id;
  const iAmWinner = winnerId === currentUserId;
  const winnerName = winnerId === debate.challenger_id
    ? debate.challenger?.full_name
    : winnerId === debate.responder_id
      ? debate.responder?.full_name
      : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(20px)" }}
      onClick={onClose}>
      <motion.div initial={{ y: 60, scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 200 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden mb-4"
        style={{ background: "linear-gradient(180deg,#0f0a1e,#0a0a14)", border: "1.5px solid rgba(251,191,36,0.4)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-6 pb-4 text-center"
          style={{ background: "linear-gradient(180deg,rgba(251,191,36,0.08),transparent)" }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 0 30px rgba(251,191,36,0.4)" }}>
            <Trophy size={28} className="text-white" />
          </div>
          {winnerName ? (
            <>
              <p className="text-yellow-400 text-[11px] font-bold uppercase tracking-widest mb-1">🏆 Winner</p>
              <h2 className="text-white font-black text-[22px] leading-tight">{winnerName}</h2>
              <p className="text-white/40 text-[12px] mt-1">
                {iAmWinner ? "You dominated the arena! +1 Debater Level" : "Better luck next debate!"}
              </p>
            </>
          ) : (
            <>
              <p className="text-white/50 text-[12px] uppercase tracking-widest mb-1">Result</p>
              <h2 className="text-white font-black text-[22px]">It's a Draw!</h2>
              <p className="text-white/40 text-[12px] mt-1">Both argued equally well.</p>
            </>
          )}
        </div>

        {/* Vote Stats */}
        <div className="px-5 pb-4 space-y-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold text-center mb-3">
            ⚖️ Fact-Check Verdict
          </p>

          {/* Challenger row */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <DA url={debate.challenger?.avatar_url} name={debate.challenger?.full_name} size={32} ring="#6366f1" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[12px] truncate">{debate.challenger?.full_name || "Challenger"}</p>
              <p className="text-white/40 text-[10px]">Challenger</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-0.5 text-emerald-400 text-[11px] font-black">
                <ThumbsUp size={10} /> {challAcc}
              </span>
              <span className="flex items-center gap-0.5 text-red-400 text-[11px] font-black">
                <ThumbsDown size={10} /> {challRej}
              </span>
              {winnerId === debate.challenger_id && <Crown size={14} className="text-yellow-400" />}
            </div>
          </div>

          {/* Responder row */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.2)" }}>
            <DA url={debate.responder?.avatar_url} name={debate.responder?.full_name} size={32} ring="#ec4899" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[12px] truncate">{debate.responder?.full_name || "Responder"}</p>
              <p className="text-white/40 text-[10px]">Responder</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-0.5 text-emerald-400 text-[11px] font-black">
                <ThumbsUp size={10} /> {respAcc}
              </span>
              <span className="flex items-center gap-0.5 text-red-400 text-[11px] font-black">
                <ThumbsDown size={10} /> {respRej}
              </span>
              {winnerId === debate.responder_id && <Crown size={14} className="text-yellow-400" />}
            </div>
          </div>

          {/* Make public */}
          {!debate.is_public && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={async () => { await onMakePublic(); }}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-black text-white"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.25))", border: "1px solid rgba(99,102,241,0.4)" }}>
              <Eye size={14} className="text-indigo-400" />
              Make Public — Let Everyone Read
            </motion.button>
          )}
          {debate.is_public && (
            <div className="flex items-center justify-center gap-1.5 py-2">
              <Eye size={11} className="text-emerald-400" />
              <span className="text-emerald-400 text-[11px] font-bold">Debate is now public</span>
            </div>
          )}

          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
            className="w-full py-3 rounded-2xl text-[12px] font-bold text-white/50"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Queue Wait Modal ──────────────────────────────────────────────────────────
const QueueWaitModal: React.FC<{ onClose: () => void; estimatedFreeAt: Date | null }> = ({ onClose, estimatedFreeAt }) => {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!estimatedFreeAt) return;
    const tick = () => setLeft(Math.max(0, estimatedFreeAt.getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [estimatedFreeAt]);

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[700] flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden p-6 text-center"
        style={{ background: "linear-gradient(180deg,#1a0a0a,#0d0a1a)", border: "1.5px solid rgba(249,115,22,0.4)" }}
        onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"
          style={{ boxShadow: "0 0 30px rgba(249,115,22,0.4)" }}>
          <Timer size={28} className="text-white" />
        </div>
        <h2 className="text-white font-black text-[18px] mb-2">⏳ Please Wait</h2>
        <p className="text-white/50 text-[13px] mb-4 leading-relaxed">
          This creator is already in an active debate. The arena will be free soon.
        </p>
        {estimatedFreeAt && left > 0 && (
          <div className="mx-auto mb-5 w-32 h-16 rounded-2xl flex flex-col items-center justify-center"
            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <span className="text-orange-300 font-black text-[22px] tabular-nums">
              {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
            </span>
            <span className="text-orange-400/50 text-[9px] uppercase tracking-widest font-bold">Est. free in</span>
          </div>
        )}
        <motion.button whileTap={{ scale: 0.95 }} onClick={onClose}
          className="w-full py-3 rounded-2xl text-[13px] font-black text-white"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          OK, I'll wait
        </motion.button>
      </motion.div>
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
  const [votes, setVotes]         = useState<VoteMap>({});
  const [showArena, setShowArena] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [accepting, setAccepting]     = useState(false);
  const [queueModal, setQueueModal]   = useState<{ show: boolean; freeAt: Date | null }>({ show: false, freeAt: null });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const jinglePlayedRef = useRef(false);

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
      if (data.status === "pending" && new Date(data.expires_at) < new Date()) {
        await supabase.from("debate_challenges").update({ status: "expired" }).eq("id", data.id);
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

  // ── Fetch & sync message votes ───────────────────────────────────────────────
  const fetchVotes = useCallback(async (msgIds: string[]) => {
    if (!msgIds.length) return;
    const { data: allVotes } = await supabase
      .from("debate_message_votes")
      .select("message_id, vote_type, user_id")
      .in("message_id", msgIds);
    if (!allVotes) return;

    const map: VoteMap = {};
    for (const v of allVotes) {
      if (!map[v.message_id]) map[v.message_id] = { accepted: 0, rejected: 0, myVote: null };
      if (v.vote_type === "accepted") map[v.message_id].accepted++;
      else map[v.message_id].rejected++;
      if (v.user_id === currentUserId) map[v.message_id].myVote = v.vote_type as VoteType;
    }
    setVotes(map);
  }, [currentUserId]);

  // ── Check if owner is busy (queue system) ───────────────────────────────────
  const checkOwnerBusy = useCallback(async (): Promise<{ busy: boolean; freeAt: Date | null }> => {
    const { data } = await supabase
      .from("debate_challenges")
      .select("id, expires_at")
      .eq("responder_id", surveyOwnerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return { busy: true, freeAt: new Date(data.expires_at) };
    }
    return { busy: false, freeAt: null };
  }, [surveyOwnerId]);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => { fetchDebate(); }, [fetchDebate]);

  useEffect(() => {
    if (!debate?.id) return;
    if (debate.status === "active" || debate.status === "finished") {
      fetchMessages(debate.id);
    }
  }, [debate?.id, debate?.status, fetchMessages]);

  // Re-fetch votes whenever messages change
  useEffect(() => {
    if (messages.length) fetchVotes(messages.map(m => m.id));
  }, [messages, fetchVotes]);

  // Play jingle when arena becomes active and is opened
  useEffect(() => {
    if (showArena && debate?.status === "active" && !jinglePlayedRef.current) {
      jinglePlayedRef.current = true;
      setTimeout(playDebateJingle, 300);
    }
    if (!showArena) {
      jinglePlayedRef.current = false;
    }
  }, [showArena, debate?.status]);

  useEffect(() => {
    const ch = supabase
      .channel(`debate-watch-${surveyId}-${currentUserId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "debate_challenges",
        filter: `survey_id=eq.${surveyId}`,
      }, (payload) => {
        const row = payload.new as DebateChallenge;
        if (row.challenger_id === currentUserId || row.responder_id === currentUserId) {
          fetchDebate();
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
    const debateId    = debate.id;
    const challenger  = debate.challenger;
    const responder   = debate.responder;
    const challengerId = debate.challenger_id;

    const ch = supabase
      .channel(`debate-msgs-${debateId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "debate_messages",
        filter: `debate_id=eq.${debateId}`,
      }, (payload) => {
        const raw = payload.new as DebateMessage;
        const profile: Profile | undefined = raw.user_id === challengerId ? challenger : responder;
        setMessages(prev => {
          if (prev.some(m => m.id === raw.id)) return prev;
          return [...prev, { ...raw, user_liked: false, profiles: profile }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [debate?.id, debate?.status, debate?.challenger_id, debate?.challenger, debate?.responder]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleChallenge = async () => {
    if (challenging || isSelf) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please log in to start a debate"); return; }

    setChallenging(true);
    setLoading(true);

    // ── Queue check: is the owner already in an active debate? ────────────────
    const { busy, freeAt } = await checkOwnerBusy();
    if (busy) {
      setChallenging(false);
      setLoading(false);
      setQueueModal({ show: true, freeAt });
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).single();

    const { data: newDebate, error } = await supabase
      .from("debate_challenges")
      .insert({
        survey_id: surveyId,
        challenger_id: user.id,
        responder_id: surveyOwnerId,
        status: "pending",
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select("*, challenger:profiles!challenger_id(full_name,avatar_url), responder:profiles!responder_id(full_name,avatar_url)")
      .single();

    if (error) {
      if (error.code === "42501") {
        toast.error("⚠️ RLS blocked: run supabase_debate_rls.sql in Supabase Dashboard → SQL Editor", { duration: 8000 });
      } else if (error.code === "23505") {
        toast.error("You already have an active debate on this survey");
      } else {
        toast.error(`Challenge failed (${error.code || "unknown"}): ${error.message}`);
      }
    } else {
      setDebate(newDebate as DebateChallenge);
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
    const { error } = await supabase
      .from("debate_messages")
      .insert({ debate_id: debate.id, user_id: currentUserId, content });
    if (error) toast.error("Failed to send message. Check RLS or Realtime settings.");
  };

  const handleLike = async (msgId: string, liked: boolean) => {
    if (liked) {
      await supabase.from("debate_message_likes").delete().eq("message_id", msgId).eq("user_id", currentUserId);
    } else {
      await supabase.from("debate_message_likes").insert({ message_id: msgId, user_id: currentUserId });
    }
    const { count } = await supabase.from("debate_message_likes")
      .select("*", { count: "exact", head: true }).eq("message_id", msgId);
    await supabase.from("debate_messages").update({ likes_count: count ?? 0 }).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId
      ? { ...m, likes_count: count || 0, user_liked: !liked } : m));
  };

  const handleVote = async (msgId: string, voteType: VoteType) => {
    const current = votes[msgId]?.myVote;
    if (current === voteType) {
      // Toggle off — delete vote
      await supabase.from("debate_message_votes")
        .delete().eq("message_id", msgId).eq("user_id", currentUserId);
      setVotes(prev => ({
        ...prev,
        [msgId]: {
          ...prev[msgId],
          [voteType]: Math.max(0, (prev[msgId]?.[voteType] ?? 1) - 1),
          myVote: null,
        },
      }));
    } else {
      // Upsert new vote (replace if switching)
      await supabase.from("debate_message_votes")
        .upsert({ message_id: msgId, user_id: currentUserId, vote_type: voteType },
          { onConflict: "message_id,user_id" });
      setVotes(prev => {
        const old = prev[msgId] ?? { accepted: 0, rejected: 0, myVote: null };
        const prev_vote = old.myVote;
        return {
          ...prev,
          [msgId]: {
            accepted: old.accepted
              + (voteType === "accepted" ? 1 : 0)
              - (prev_vote === "accepted" ? 1 : 0),
            rejected: old.rejected
              + (voteType === "rejected" ? 1 : 0)
              - (prev_vote === "rejected" ? 1 : 0),
            myVote: voteType,
          },
        };
      });
    }
  };

  const handleEnd = async () => {
    if (!debate) return;
    const challAcc = messages
      .filter(m => m.user_id === debate.challenger_id)
      .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
    const respAcc  = messages
      .filter(m => m.user_id === debate.responder_id)
      .reduce((sum, m) => sum + (votes[m.id]?.accepted ?? 0), 0);
    const winnerId = challAcc > respAcc
      ? debate.challenger_id
      : respAcc > challAcc
        ? debate.responder_id
        : null;

    await supabase.from("debate_challenges").update({
      status: "finished", finished_at: new Date().toISOString(), winner_id: winnerId,
    }).eq("id", debate.id);

    if (winnerId) {
      const { data: prof } = await supabase.from("profiles").select("debater_level").eq("id", winnerId).single();
      if (prof) {
        await supabase.from("profiles").update({ debater_level: (prof.debater_level || 0) + 1 }).eq("id", winnerId);
      }
    }
    await fetchDebate();
    setShowResult(true);
    toast.success(winnerId === currentUserId ? "🏆 You won the debate! +1 Debater Level" : "Debate ended.");
  };

  const handleMakePublic = async () => {
    if (!debate) return;
    await supabase.from("debate_challenges").update({ is_public: true }).eq("id", debate.id);
    await fetchDebate();
    toast.success("Debate is now public 🌐");
  };

  // ── Button state ─────────────────────────────────────────────────────────────
  const btnState = (() => {
    if (!debate) return isSelf ? "own" : "idle";
    if (debate.status === "pending") {
      return debate.challenger_id === currentUserId ? "sent" : "received";
    }
    return debate.status;
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
          else if (btnState === "received")                   { setShowArena(true); }
          else if (btnState === "sent")                       { toast("Waiting for them to accept…"); }
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

      {/* ── Queue Wait Modal ── */}
      <AnimatePresence>
        {queueModal.show && (
          <QueueWaitModal
            onClose={() => setQueueModal({ show: false, freeAt: null })}
            estimatedFreeAt={queueModal.freeAt}
          />
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
              votes={votes}
              onClose={() => setShowArena(false)}
              onSend={handleSend}
              onLike={handleLike}
              onVote={handleVote}
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

      {/* ── Debate Result Modal ── */}
      <AnimatePresence>
        {showResult && debate && (
          <DebateResultModal
            debate={debate}
            messages={messages}
            votes={votes}
            currentUserId={currentUserId}
            onClose={() => setShowResult(false)}
            onMakePublic={handleMakePublic}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ── Public Archive Banner ──────────────────────────────────────────────────────
// Drop this onto any survey post to show a past-debate result banner.
export const DebateArchiveBanner: React.FC<{
  surveyId: string;
  onViewDebate?: (debateId: string) => void;
}> = ({ surveyId, onViewDebate }) => {
  const [archivedDebate, setArchivedDebate] = useState<DebateChallenge | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase
      .from("debate_challenges")
      .select(`
        *,
        challenger:profiles!challenger_id(full_name, avatar_url),
        responder:profiles!responder_id(full_name, avatar_url)
      `)
      .eq("survey_id", surveyId)
      .eq("status", "finished")
      .eq("is_public", true)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setArchivedDebate(data as DebateChallenge); });
  }, [surveyId]);

  if (!archivedDebate) return null;

  const winnerName = archivedDebate.winner_id === archivedDebate.challenger_id
    ? archivedDebate.challenger?.full_name
    : archivedDebate.winner_id === archivedDebate.responder_id
      ? archivedDebate.responder?.full_name
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mt-2 rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: "linear-gradient(135deg,rgba(251,191,36,0.06),rgba(99,102,241,0.06))",
        border: "1px solid rgba(251,191,36,0.25)",
      }}
      onClick={() => {
        if (onViewDebate) onViewDebate(archivedDebate.id);
        else setExpanded(v => !v);
      }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shrink-0">
          <Trophy size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-[11px] font-black leading-tight truncate">
            ⚔️ Debate Concluded:&nbsp;
            <span className="text-indigo-300">{archivedDebate.challenger?.full_name}</span>
            &nbsp;vs&nbsp;
            <span className="text-pink-300">{archivedDebate.responder?.full_name}</span>
          </p>
          <p className="text-yellow-400 text-[10px] font-bold mt-0.5">
            {winnerName ? `🏆 Winner: ${winnerName}` : "It was a draw!"}&nbsp;
            <span className="text-white/30 font-normal">· Tap to view archive</span>
          </p>
        </div>
        <Star size={13} className="text-yellow-400 shrink-0" />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <DA url={archivedDebate.challenger?.avatar_url}
                  name={archivedDebate.challenger?.full_name} size={28} ring="#6366f1" />
                <p className="text-indigo-300 text-[10px] font-bold">Challenger</p>
              </div>
              <div className="flex-1 text-center text-white/20 text-[9px] font-bold uppercase">vs</div>
              <div className="flex items-center gap-2">
                <p className="text-pink-300 text-[10px] font-bold">Responder</p>
                <DA url={archivedDebate.responder?.avatar_url}
                  name={archivedDebate.responder?.full_name} size={28} ring="#ec4899" />
              </div>
            </div>
            <div className="px-3 pb-3">
              <p className="text-white/30 text-[9px] text-center">
                Finished {new Date(archivedDebate.finished_at || "").toLocaleDateString()} · Inspire others — start a new debate!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
