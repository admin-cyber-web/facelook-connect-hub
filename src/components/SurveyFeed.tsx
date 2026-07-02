import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, PieChart as PieChartIcon, Plus, Trash2, Image as ImageIcon,
  Send, Heart, MessageCircle, Share2, ChevronDown, ChevronUp,
  X, Upload, CheckCircle2, TrendingUp, Users, Vote, Loader2,
  CornerDownRight, Edit3, BarChart,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
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

// ── Survey Card ────────────────────────────────────────────────────────────────
const SurveyCard: React.FC<{ survey: Survey; userId: string; onUpdate: () => void }> = ({ survey, userId, onUpdate }) => {
  const [voting, setVoting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [posting, setPosting] = useState(false);

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
    const url = `${window.location.origin}/survey/${survey.id}`;
    const text = `📊 ${survey.question}\n${total} votes so far!`;
    if (navigator.share) {
      try { await navigator.share({ title: survey.question, text, url }); } catch { }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Link copied!");
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden mb-4"
      style={{ background: "linear-gradient(145deg,rgba(30,30,50,0.95),rgba(20,20,40,0.98))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

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
          className="flex items-center gap-1.5 group ml-auto">
          <Share2 size={16} className="text-white/40 group-hover:text-emerald-400" />
          <span className="text-white/40 text-[12px] group-hover:text-emerald-400">Share</span>
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
const SurveyFeed: React.FC<{ userId: string }> = ({ userId }) => {
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

  return (
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
              <SurveyCard key={survey.id} survey={survey} userId={userId} onUpdate={fetchSurveys} />
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
  );
};

export default SurveyFeed;
