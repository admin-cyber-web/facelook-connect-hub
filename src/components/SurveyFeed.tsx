import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, PieChart as PieChartIcon, Plus, Trash2, Image as ImageIcon,
  Send, Heart, MessageCircle, Share2, ChevronDown, ChevronUp,
  X, Upload, CheckCircle2, TrendingUp, Users, Vote, Loader2,
  CornerDownRight, Edit3, BarChart, Link2,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SurveyOption { id: string; text: string; vote_count?: number; }
interface Survey {
  id: string; question: string; image_url: string | null;
  user_id: string; created_at: string;
  profiles?: { full_name: string; avatar_url: string; username: string };
  options?: SurveyOption[];
  total_votes?: number; user_vote?: string | null;
  likes_count?: number; user_liked?: boolean; comments_count?: number;
}
interface Comment {
  id: string; survey_id: string; user_id: string; parent_id: string | null;
  content: string; created_at: string;
  profiles?: { full_name: string; avatar_url: string };
  replies?: Comment[];
}

const PALETTE = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
};

const Avatar: React.FC<{ url?: string; name?: string; size?: number }> = ({ url, name = "?", size = 36 }) => (
  url
    ? <img src={resolveMediaUrl(url, "avatars")} className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} decoding="async" />
    : <div className="rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 text-white font-black"
        style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {name[0]?.toUpperCase() || "?"}
      </div>
);

// ── Chart View ─────────────────────────────────────────────────────────────────
const SurveyChart: React.FC<{ options: SurveyOption[]; total: number; userVote: string | null }> = ({ options, total, userVote }) => {
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const data = options.map((o, i) => ({
    name: o.text.length > 20 ? o.text.slice(0, 18) + "…" : o.text,
    value: o.vote_count || 0,
    pct: total > 0 ? Math.round(((o.vote_count || 0) / total) * 100) : 0,
    fill: PALETTE[i % PALETTE.length],
    id: o.id,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Live Results</span>
        <div className="flex gap-1">
          {(["pie", "bar"] as const).map(t => (
            <button key={t} onClick={() => setChartType(t)}
              className={`p-1.5 rounded-lg transition-all ${chartType === t ? "bg-indigo-500/30 text-indigo-300" : "text-white/30 hover:text-white/60"}`}>
              {t === "pie" ? <PieChartIcon size={14} /> : <BarChart size={14} />}
            </button>
          ))}
        </div>
      </div>

      {chartType === "pie" ? (
        <div className="px-2 py-2">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={78}
                paddingAngle={3} dataKey="value"
                label={({ pct }) => pct > 0 ? `${pct}%` : ""} labelLine={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.fill}
                    stroke={userVote === d.id ? "#fff" : "transparent"} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} votes`]} contentStyle={{
                background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "#fff", fontSize: 12
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 px-2 pb-2 justify-center">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-white/60 text-[11px]">{d.name} <span className="text-white/90 font-bold">{d.pct}%</span></span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-2 py-2">
          <ResponsiveContainer width="100%" height={180}>
            <ReBarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v} votes`]} contentStyle={{
                background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "#fff", fontSize: 12
              }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-center gap-4 pb-3 pt-1">
        <div className="text-center">
          <div className="text-white font-black text-lg">{total}</div>
          <div className="text-white/40 text-[10px]">Total Votes</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-indigo-400 font-black text-lg">{options.length}</div>
          <div className="text-white/40 text-[10px]">Options</div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Comment Tree ───────────────────────────────────────────────────────────────
const CommentItem: React.FC<{
  comment: Comment; userId: string; surveyId: string;
  depth?: number; onReply: (id: string, name: string) => void;
}> = ({ comment, userId, depth = 0, onReply }) => {
  const [showReplies, setShowReplies] = useState(true);
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      className={`${depth > 0 ? "ml-8 border-l-2 border-indigo-500/20 pl-3" : ""}`}>
      <div className="flex gap-2.5 py-2">
        <Avatar url={comment.profiles?.avatar_url} name={comment.profiles?.full_name} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 text-[12px] font-bold">{comment.profiles?.full_name || "User"}</span>
            <span className="text-white/30 text-[10px]">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-white/70 text-[13px] mt-0.5 leading-snug">{comment.content}</p>
          {depth < 2 && (
            <button onClick={() => onReply(comment.id, comment.profiles?.full_name || "User")}
              className="flex items-center gap-1 mt-1 text-indigo-400 text-[11px] font-semibold hover:text-indigo-300">
              <CornerDownRight size={11} /> Reply
            </button>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <>
          <button onClick={() => setShowReplies(v => !v)}
            className="flex items-center gap-1 ml-9 mb-1 text-white/30 text-[11px]">
            {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showReplies ? "Hide" : `${comment.replies.length}`} replies
          </button>
          <AnimatePresence>
            {showReplies && comment.replies.map(r => (
              <CommentItem key={r.id} comment={r} userId={userId} surveyId={comment.survey_id}
                depth={depth + 1} onReply={onReply} />
            ))}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

// ── Share Drawer ───────────────────────────────────────────────────────────────
const ShareDrawer: React.FC<{ survey: Survey; total: number; onClose: () => void }> = ({ survey, total, onClose }) => {
  const deepLink = `${window.location.origin}/survey/${survey.id}`;
  const shareText = `📊 ${survey.question}\n${total} votes on FlicksIndia! Vote now 👇`;

  const platforms = [
    {
      name: "WhatsApp", color: "#25D366", bg: "#25D36618",
      url: `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + deepLink)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L0 24l6.335-1.508A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.79 9.79 0 01-4.988-1.365l-.358-.213-3.76.895.952-3.652-.233-.374A9.789 9.789 0 012.182 12c0-5.418 4.4-9.818 9.818-9.818 5.417 0 9.818 4.4 9.818 9.818 0 5.419-4.401 9.818-9.818 9.818z"/></svg>,
    },
    {
      name: "Twitter / X", color: "#e7e9ea", bg: "#ffffff12",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(survey.question)}&url=${encodeURIComponent(deepLink)}&hashtags=Survey,FlicksIndia`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.763l7.737-8.835L1.258 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>,
    },
    {
      name: "Facebook", color: "#1877F2", bg: "#1877F218",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepLink)}&quote=${encodeURIComponent(shareText)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    },
    {
      name: "Telegram", color: "#0088CC", bg: "#0088CC18",
      url: `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
    },
    {
      name: "Instagram", color: "#E1306C", bg: "#E1306C18",
      url: null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
    },
  ];

  const handlePlatformShare = (p: typeof platforms[0]) => {
    if (p.url) {
      window.open(p.url, "_blank", "noopener,noreferrer");
    } else {
      navigator.clipboard.writeText(shareText + "\n\n" + deepLink);
      toast.success("Copied! Paste into your Instagram Story 🎉");
    }
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deepLink);
    toast.success("🔗 Link copied!");
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className="w-full max-w-md rounded-t-[28px] overflow-hidden"
        style={{ background: "linear-gradient(180deg,#161628,#0d0d1a)", border: "1px solid rgba(255,255,255,0.09)", borderBottom: "none" }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="text-white font-black text-[16px]">Share Survey</h3>
            <p className="text-white/40 text-[11px] mt-0.5 truncate">{survey.question}</p>
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <X size={14} className="text-white/50" />
          </motion.button>
        </div>

        {/* Vote Count Badge */}
        <div className="flex items-center gap-2 mx-5 mb-4 px-4 py-2.5 rounded-2xl"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <Vote size={13} className="text-indigo-400" />
          <span className="text-indigo-300 text-[12px] font-bold">{total} votes so far</span>
          <span className="text-white/20 text-[11px] ml-auto">Live results</span>
        </div>

        {/* Platform Grid (2 rows × 3 columns) */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {platforms.map(p => (
            <motion.button key={p.name} whileTap={{ scale: 0.9 }} onClick={() => handlePlatformShare(p)}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl active:opacity-80"
              style={{ background: p.bg, border: `1.5px solid ${p.color}25` }}>
              <div style={{ color: p.color }}>{p.icon}</div>
              <span className="text-[10px] font-bold leading-tight text-center" style={{ color: "rgba(255,255,255,0.65)" }}>
                {p.name}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Copy Link Bar */}
        <div className="px-5 pb-8">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <Link2 size={14} className="text-white/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white/25 text-[10px]">Deep link</p>
              <p className="text-white/60 text-[11px] truncate font-mono">{deepLink}</p>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleCopyLink}
              className="shrink-0 px-4 py-2 rounded-xl text-white font-black text-[12px]"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              Copy
            </motion.button>
          </div>
          <p className="text-center text-white/20 text-[10px] mt-2.5">
            Recipients land directly on this survey
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Survey Card ────────────────────────────────────────────────────────────────
const SurveyCard: React.FC<{ survey: Survey; userId: string; onUpdate: () => void; highlighted?: boolean }> = ({ survey, userId, onUpdate, highlighted = false }) => {
  const [voting, setVoting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }
  }, [highlighted]);

  const userVote = survey.user_vote || null;
  const hasVoted = !!userVote;
  const total = survey.total_votes || 0;

  const handleVote = async (optionId: string) => {
    if (voting || hasVoted) return;
    setVoting(true);
    try {
      await supabase.from("votes").insert({ survey_id: survey.id, option_id: optionId, user_id: userId });
      onUpdate();
    } catch { toast.error("Vote failed"); }
    setVoting(false);
  };

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      if (survey.user_liked) {
        await supabase.from("survey_likes").delete().eq("survey_id", survey.id).eq("user_id", userId);
      } else {
        await supabase.from("survey_likes").upsert({ survey_id: survey.id, user_id: userId });
      }
      onUpdate();
    } catch { }
    setLiking(false);
  };

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from("survey_comments")
      .select("*, profiles(full_name, avatar_url)")
      .eq("survey_id", survey.id)
      .order("created_at", { ascending: true });
    if (!data) return;
    const roots: Comment[] = [];
    const map: Record<string, Comment> = {};
    data.forEach(c => { map[c.id] = { ...c, replies: [] }; });
    data.forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].replies!.push(map[c.id]);
      else roots.push(map[c.id]);
    });
    setComments(roots);
    setCommentsLoaded(true);
  }, [survey.id]);

  const toggleComments = () => {
    setShowComments(v => !v);
    if (!commentsLoaded) loadComments();
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    await supabase.from("survey_comments").insert({
      survey_id: survey.id, user_id: userId,
      parent_id: replyTo?.id || null, content: newComment.trim(),
    });
    setNewComment(""); setReplyTo(null);
    await loadComments();
    onUpdate();
    setPosting(false);
  };

  const handleShare = async () => {
    const deepLink = `${window.location.origin}/survey/${survey.id}`;
    const text = `📊 ${survey.question}\n${total} votes on FlicksIndia! Vote now 👇`;
    if (navigator.share) {
      try {
        await navigator.share({ title: survey.question, text, url: deepLink });
        return;
      } catch { /* fallthrough to drawer */ }
    }
    setShowShareDrawer(true);
  };

  return (
    <>
    <motion.div ref={cardRef} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden mb-4"
      style={{
        background: "linear-gradient(145deg,rgba(30,30,50,0.95),rgba(20,20,40,0.98))",
        border: highlighted ? "1.5px solid rgba(99,102,241,0.7)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: highlighted ? "0 0 0 3px rgba(99,102,241,0.18), 0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(0,0,0,0.4)",
      }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar url={survey.profiles?.avatar_url} name={survey.profiles?.full_name} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[13px] truncate">{survey.profiles?.full_name || "Anonymous"}</p>
          <p className="text-white/40 text-[11px]">{timeAgo(survey.created_at)}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-full">
          <Vote size={11} className="text-indigo-400" />
          <span className="text-indigo-300 text-[11px] font-bold">Survey</span>
        </div>
      </div>

      {/* Question */}
      <div className="px-4 pb-3">
        <p className="text-white font-black text-[16px] leading-snug">{survey.question}</p>
      </div>

      {/* Image */}
      {survey.image_url && (
        <div className="mx-4 mb-3 rounded-2xl overflow-hidden">
          <img src={resolveMediaUrl(survey.image_url, "surveys")} className="w-full object-cover max-h-52" decoding="async" loading="lazy" />
        </div>
      )}

      {/* Options */}
      <div className="px-4 space-y-2.5 pb-3">
        {(survey.options || []).map((opt, i) => {
          const pct = total > 0 ? Math.round(((opt.vote_count || 0) / total) * 100) : 0;
          const isVoted = userVote === opt.id;
          return (
            <motion.button key={opt.id} onClick={() => handleVote(opt.id)}
              whileTap={{ scale: hasVoted ? 1 : 0.97 }}
              disabled={hasVoted || voting}
              className={`relative w-full text-left rounded-2xl overflow-hidden transition-all ${hasVoted ? "cursor-default" : "cursor-pointer hover:opacity-90"}`}
              style={{ border: `1.5px solid ${isVoted ? PALETTE[i % PALETTE.length] : "rgba(255,255,255,0.1)"}` }}>
              {hasVoted && (
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                  className="absolute inset-y-0 left-0 rounded-2xl"
                  style={{ background: `${PALETTE[i % PALETTE.length]}22` }} />
              )}
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {isVoted && <CheckCircle2 size={15} style={{ color: PALETTE[i % PALETTE.length] }} />}
                  <span className={`text-[13px] font-semibold ${isVoted ? "text-white" : "text-white/80"}`}>{opt.text}</span>
                </div>
                {hasVoted && (
                  <span className="text-[12px] font-black" style={{ color: PALETTE[i % PALETTE.length] }}>{pct}%</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Chart after voting */}
      {hasVoted && (
        <div className="px-4 pb-3">
          <SurveyChart options={survey.options || []} total={total} userVote={userVote} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pb-4 pt-1 border-t border-white/5 mt-1">
        <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
          className="flex items-center gap-1.5 group">
          <motion.div animate={survey.user_liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
            <Heart size={18} className={survey.user_liked ? "fill-rose-500 text-rose-500" : "text-white/40 group-hover:text-rose-400"} />
          </motion.div>
          <span className={`text-[12px] font-bold ${survey.user_liked ? "text-rose-400" : "text-white/40"}`}>{survey.likes_count || 0}</span>
        </motion.button>

        <motion.button whileTap={{ scale: 0.85 }} onClick={toggleComments}
          className="flex items-center gap-1.5 group">
          <MessageCircle size={18} className={showComments ? "text-indigo-400" : "text-white/40 group-hover:text-indigo-400"} />
          <span className={`text-[12px] font-bold ${showComments ? "text-indigo-400" : "text-white/40"}`}>{survey.comments_count || 0}</span>
        </motion.button>

        <motion.button whileTap={{ scale: 0.85 }} onClick={handleShare}
          className="flex items-center gap-1.5 group ml-auto px-3 py-1.5 rounded-full transition-all"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <Share2 size={14} className="text-indigo-400" />
          <span className="text-indigo-400 text-[11px] font-bold">Share</span>
        </motion.button>

        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-white/25" />
          <span className="text-white/25 text-[11px]">{total} votes</span>
        </div>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="border-t border-white/5 overflow-hidden">
            <div className="px-4 py-3 max-h-72 overflow-y-auto">
              {!commentsLoaded
                ? <div className="flex justify-center py-4"><Loader2 size={20} className="text-indigo-400 animate-spin" /></div>
                : comments.length === 0
                  ? <p className="text-white/30 text-[12px] text-center py-3">No comments yet. Be first!</p>
                  : comments.map(c => (
                      <CommentItem key={c.id} comment={c} userId={userId} surveyId={survey.id}
                        onReply={(id, name) => setReplyTo({ id, name })} />
                    ))}
            </div>
            {replyTo && (
              <div className="mx-4 mb-2 px-3 py-1.5 rounded-xl flex items-center justify-between"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <span className="text-indigo-300 text-[11px]">↩ Replying to <b>{replyTo.name}</b></span>
                <button onClick={() => setReplyTo(null)}><X size={12} className="text-white/40" /></button>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 pb-3">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && postComment()}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-[13px] placeholder-white/25 outline-none focus:border-indigo-500/50" />
              <motion.button whileTap={{ scale: 0.88 }} onClick={postComment} disabled={posting || !newComment.trim()}
                className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 disabled:opacity-40">
                {posting ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* Share Drawer */}
    <AnimatePresence>
      {showShareDrawer && (
        <ShareDrawer survey={survey} total={total} onClose={() => setShowShareDrawer(false)} />
      )}
    </AnimatePresence>
    </>
  );
};

// ── Create Survey Modal ────────────────────────────────────────────────────────
const CreateSurveyModal: React.FC<{ userId: string; onCreated: () => void; onClose: () => void }> = ({ userId, onCreated, onClose }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const addOption = () => setOptions(v => [...v, ""]);
  const removeOption = (i: number) => setOptions(v => v.filter((_, idx) => idx !== i));
  const updateOption = (i: number, val: string) => setOptions(v => v.map((o, idx) => idx === i ? val : o));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!question.trim()) return toast.error("Question is required");
    const validOpts = options.filter(o => o.trim());
    if (validOpts.length < 2) return toast.error("At least 2 options needed");
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploadProgress(30);
        const ext = imageFile.name.split(".").pop();
        const path = `${userId}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("surveys").upload(path, imageFile, { upsert: true });
        if (upErr) throw upErr;
        imageUrl = path;
        setUploadProgress(70);
      }
      const { data: survey, error: sErr } = await supabase.from("surveys")
        .insert({ question: question.trim(), image_url: imageUrl, user_id: userId })
        .select().single();
      if (sErr || !survey) throw sErr;
      setUploadProgress(90);
      const { error: oErr } = await supabase.from("survey_options")
        .insert(validOpts.map(text => ({ survey_id: survey.id, text: text.trim() })));
      if (oErr) throw oErr;
      setUploadProgress(100);
      toast.success("Survey published!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish");
    }
    setSubmitting(false);
    setUploadProgress(0);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: "linear-gradient(180deg,#1a1a2e,#0f0f1e)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: "rgba(26,26,46,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <BarChart2 size={15} className="text-white" />
            </div>
            <span className="text-white font-black text-[15px]">New Survey</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-5 pt-4">
          {/* Question */}
          <div>
            <label className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-2 block">Question *</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2}
              placeholder="What do you want to ask?"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-[14px] placeholder-white/25 outline-none focus:border-indigo-500/50 resize-none" />
          </div>

          {/* Image */}
          <div>
            <label className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-2 block">Survey Image (optional)</label>
            {imagePreview
              ? <div className="relative rounded-2xl overflow-hidden">
                  <img src={imagePreview} className="w-full object-cover max-h-40" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                    <X size={13} className="text-white" />
                  </button>
                </div>
              : <button onClick={() => fileRef.current?.click()}
                  className="w-full h-28 rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/40 transition-all">
                  <Upload size={22} className="text-white/30" />
                  <span className="text-white/30 text-[12px]">Tap to upload image</span>
                </button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>

          {/* Options */}
          <div>
            <label className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-2 block">Options * (min 2)</label>
            <div className="space-y-2.5">
              <AnimatePresence>
                {options.map((opt, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black text-white"
                      style={{ background: PALETTE[i % PALETTE.length] }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <input value={opt} onChange={e => updateOption(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-[13px] placeholder-white/25 outline-none focus:border-indigo-500/40" />
                    {options.length > 2 && (
                      <button onClick={() => removeOption(i)} className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                        <X size={12} className="text-red-400" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button onClick={addOption}
              className="mt-3 flex items-center gap-2 text-indigo-400 text-[12px] font-bold hover:text-indigo-300 transition-all">
              <Plus size={14} /> Add Option
            </button>
          </div>

          {/* Progress bar while submitting */}
          {submitting && uploadProgress > 0 && (
            <div className="rounded-full h-1.5 bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.4 }} />
            </div>
          )}

          {/* Submit */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2.5 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Publishing…</> : <><BarChart2 size={18} /> Publish Survey</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main SurveyFeed ────────────────────────────────────────────────────────────
const SurveyFeed: React.FC<{ userId: string; highlightedSurveyId?: string | null }> = ({ userId, highlightedSurveyId }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "voted">("all");

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("surveys")
      .select(`
        id, question, image_url, user_id, created_at,
        profiles(full_name, avatar_url, username),
        survey_options(id, text)
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) { setLoading(false); return; }

    const ids = data.map(s => s.id);

    const [votesRes, likesRes, commentsRes, userVotesRes, userLikesRes] = await Promise.all([
      supabase.from("votes").select("survey_id, option_id").in("survey_id", ids),
      supabase.from("survey_likes").select("survey_id").in("survey_id", ids),
      supabase.from("survey_comments").select("survey_id").in("survey_id", ids),
      supabase.from("votes").select("survey_id, option_id").in("survey_id", ids).eq("user_id", userId),
      supabase.from("survey_likes").select("survey_id").in("survey_id", ids).eq("user_id", userId),
    ]);

    const votesMap: Record<string, Record<string, number>> = {};
    const totalMap: Record<string, number> = {};
    (votesRes.data || []).forEach(v => {
      if (!votesMap[v.survey_id]) votesMap[v.survey_id] = {};
      votesMap[v.survey_id][v.option_id] = (votesMap[v.survey_id][v.option_id] || 0) + 1;
      totalMap[v.survey_id] = (totalMap[v.survey_id] || 0) + 1;
    });
    const likesMap: Record<string, number> = {};
    (likesRes.data || []).forEach(l => { likesMap[l.survey_id] = (likesMap[l.survey_id] || 0) + 1; });
    const commentsMap: Record<string, number> = {};
    (commentsRes.data || []).forEach(c => { commentsMap[c.survey_id] = (commentsMap[c.survey_id] || 0) + 1; });
    const userVoteMap: Record<string, string> = {};
    (userVotesRes.data || []).forEach(v => { userVoteMap[v.survey_id] = v.option_id; });
    const userLikeSet = new Set((userLikesRes.data || []).map(l => l.survey_id));

    const enriched: Survey[] = data.map(s => ({
      ...s,
      options: (s.survey_options || []).map((o: SurveyOption) => ({
        ...o, vote_count: (votesMap[s.id]?.[o.id] || 0),
      })),
      total_votes: totalMap[s.id] || 0,
      likes_count: likesMap[s.id] || 0,
      comments_count: commentsMap[s.id] || 0,
      user_vote: userVoteMap[s.id] || null,
      user_liked: userLikeSet.has(s.id),
    }));

    setSurveys(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const filtered = surveys.filter(s => {
    if (filter === "mine") return s.user_id === userId;
    if (filter === "voted") return !!s.user_vote;
    return true;
  });

  // OG meta tags for the highlighted/deep-linked survey
  const ogSurvey = highlightedSurveyId ? surveys.find(s => s.id === highlightedSurveyId) : null;
  const ogDesc = ogSurvey
    ? `${ogSurvey.total_votes || 0} votes · ${(ogSurvey.options || []).map(o => `${o.text} ${ogSurvey.total_votes ? Math.round(((o.vote_count||0)/ogSurvey.total_votes!)*100) : 0}%`).join(" · ")} — Vote on FlicksIndia`
    : "Vote on live surveys on FlicksIndia";
  const ogImage = ogSurvey?.image_url
    ? resolveMediaUrl(ogSurvey.image_url, "surveys")
    : `${window.location.origin}/og-fallback.png`;

  return (
    <>
    {ogSurvey && (
      <Helmet>
        <title>{ogSurvey.question} – FlicksIndia Survey</title>
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogSurvey.question} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={`${window.location.origin}/survey/${ogSurvey.id}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogSurvey.question} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>
    )}
    <div className="min-h-screen pb-32" style={{ background: "linear-gradient(180deg,#0d0d1a,#0a0a14)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3"
        style={{ background: "rgba(13,13,26,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BarChart2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-black text-[17px] leading-none">Surveys</h1>
              <p className="text-white/40 text-[11px]">{surveys.length} live surveys</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[13px] text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}>
            <Plus size={15} /> Create
          </motion.button>
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "mine", "voted"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold capitalize transition-all ${filter === f
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "bg-white/5 text-white/40 hover:text-white/70"}`}>
              {f === "all" ? "🌐 All" : f === "mine" ? "👤 Mine" : "✅ Voted"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar">
        {[
          { icon: <Vote size={14} />, label: "Total Surveys", val: surveys.length, color: "#6366f1" },
          { icon: <Users size={14} />, label: "Total Votes", val: surveys.reduce((a, s) => a + (s.total_votes || 0), 0), color: "#ec4899" },
          { icon: <TrendingUp size={14} />, label: "My Votes", val: surveys.filter(s => s.user_vote).length, color: "#f59e0b" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className="flex-shrink-0 rounded-2xl px-4 py-3 flex items-center gap-2.5 min-w-[120px]"
            style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${s.color}25`, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="text-white font-black text-[16px] leading-none">{s.val}</div>
              <div className="text-white/40 text-[10px] mt-0.5">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Feed */}
      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <BarChart2 size={32} className="text-indigo-400" />
            </motion.div>
            <p className="text-white/40 text-[13px]">Loading surveys…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center">
              <Vote size={28} className="text-indigo-400" />
            </div>
            <p className="text-white/50 font-bold text-[14px]">
              {filter === "mine" ? "You haven't created any surveys yet" : filter === "voted" ? "You haven't voted yet" : "No surveys yet"}
            </p>
            {filter === "all" && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
                className="px-6 py-3 rounded-2xl text-white font-black text-[13px]"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                Create First Survey
              </motion.button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(survey => (
              <SurveyCard key={survey.id} survey={survey} userId={userId} onUpdate={fetchSurveys}
                highlighted={survey.id === highlightedSurveyId} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateSurveyModal userId={userId} onCreated={fetchSurveys} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
    </>
  );
};

export default SurveyFeed;
