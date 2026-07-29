import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { memGet, memSet } from "../lib/memCache";
import { resolveMediaUrl } from "../lib/mediaUrl";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Loader2, Music, Mic, Download, Share2, Heart, ChevronUp, MessageCircle, Send, Volume2, VolumeX } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption?: string;
  emoji?: string;
  mood?: string;
  media_type?: string;
  is_help_request?: boolean;
  music_url?: string;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface StoryGroup {
  user_id: string;
  profile: { full_name: string; avatar_url?: string };
  stories: Story[];
}

// ── Mood CSS filter map ────────────────────────────────────────────────────────
const MOOD_FILTER: Record<string, string> = {
  sad:            "grayscale(80%) brightness(0.75)",
  happy:          "saturate(1.4) brightness(1.05)",
  angry:          "saturate(1.8) hue-rotate(330deg) brightness(0.9)",
  party:          "saturate(2) contrast(1.15) brightness(1.1)",
  love:           "sepia(0.4) saturate(1.6) brightness(1.05)",
  chill:          "saturate(0.8) brightness(0.95) hue-rotate(200deg)",
  "vibrant-gold": "sepia(0.35) saturate(2.2) brightness(1.12) contrast(1.08)",
  cyberpunk:      "saturate(2.6) hue-rotate(255deg) contrast(1.25) brightness(0.88)",
  noir:           "grayscale(100%) contrast(1.45) brightness(0.88)",
  grid:           "",
};

// ── Gradient for anonymous avatars ────────────────────────────────────────────
const GRADS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
const gradFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i);
  return GRADS[Math.abs(h) % GRADS.length];
};

// ── Rain overlay for sad mood ──────────────────────────────────────────────────
const RainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    {Array.from({ length: 22 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-px bg-blue-300/40 rounded-full"
        style={{
          left: `${(i / 22) * 100}%`,
          height: `${30 + Math.random() * 50}px`,
          top: "-10%",
        }}
        animate={{ y: ["0%", "130%"], opacity: [0.7, 0] }}
        transition={{
          duration: 0.8 + Math.random() * 0.6,
          repeat: Infinity,
          delay: Math.random() * 1.5,
          ease: "linear",
        }}
      />
    ))}
  </div>
);

// ── Neon glow overlay for party mood ──────────────────────────────────────────
const NeonOverlay = () => (
  <motion.div
    className="absolute inset-0 pointer-events-none z-10"
    animate={{
      background: [
        "radial-gradient(circle at 30% 40%, rgba(236,72,153,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 70% 60%, rgba(99,102,241,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 50% 20%, rgba(245,158,11,0.25) 0%, transparent 60%)",
        "radial-gradient(circle at 30% 40%, rgba(236,72,153,0.25) 0%, transparent 60%)",
      ],
    }}
    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
  />
);

// ── Audio Wave animation for voice stories ────────────────────────────────────
const AudioWave = () => (
  <div className="flex items-center gap-1 justify-center">
    {Array.from({ length: 7 }).map((_, i) => (
      <motion.div
        key={i}
        className="w-1.5 rounded-full bg-white/80"
        animate={{ height: ["8px", `${16 + i * 4}px`, "8px"] }}
        transition={{
          duration: 0.7,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// ── HELP sticker ──────────────────────────────────────────────────────────────
const HelpSticker = () => (
  <motion.div
    className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full select-none"
    style={{ background: "linear-gradient(135deg, #f97316, #ef4444)" }}
    animate={{ scale: [1, 1.08, 1], rotate: [-2, 2, -2] }}
    transition={{ duration: 1.1, repeat: Infinity }}
  >
    <span className="text-white font-black text-lg tracking-widest drop-shadow">🆘 MADAD</span>
  </motion.div>
);

// ── Progress segments bar ──────────────────────────────────────────────────────
const ProgressSegments = ({
  total, current, elapsed, duration,
}: { total: number; current: number; elapsed: number; duration: number }) => (
  <div className="flex gap-1 px-3 pt-2">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden">
        {i < current ? (
          <div className="h-full w-full bg-white" />
        ) : i === current ? (
          <motion.div
            className="h-full bg-white origin-left"
            style={{ scaleX: elapsed / duration }}
          />
        ) : null}
      </div>
    ))}
  </div>
);

// ── Story Comment Sheet ───────────────────────────────────────────────────────
const StoryCommentSheet = ({
  storyId,
  storyOwnerId,
  currentUserId,
  onClose,
  onCommentPosted,
}: {
  storyId: string;
  storyOwnerId: string;
  currentUserId: string | null;
  onClose: () => void;
  onCommentPosted: () => void;
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("story_comments")
        .select("id, comment_text, created_at, user_id, profiles(full_name, avatar_url)")
        .eq("story_id", storyId)
        .order("created_at", { ascending: true });
      setComments(data || []);
      setLoading(false);
      setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, 100);
    })();
  }, [storyId]);

  const send = async () => {
    if (!text.trim() || !currentUserId || sending) return;
    setSending(true);
    const comment_text = text.trim();
    setText("");

    console.log("[StoryCommentSheet] Insert payload:", {
      storyId,
      currentUserId,
      comment_text,
      storyOwnerId,
    });

    const { data, error } = await supabase
      .from("story_comments")
      .insert({ story_id: storyId, user_id: currentUserId, comment_text })
      .select("id, comment_text, created_at, user_id, profiles(full_name, avatar_url)")
      .single();

    if (error) {
      console.error("[StoryCommentSheet] Insert error:", error);
      toast.error("Comment failed: " + error.message);
      setSending(false);
      return;
    }

    if (data) {
      console.log("[StoryCommentSheet] Insert success:", data);
      setComments(prev => [...prev, data]);
      onCommentPosted();
      setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, 80);
      // Notification to story owner
      if (storyOwnerId !== currentUserId) {
        await supabase.from("notifications").insert({
          notifier_id: storyOwnerId, actor_id: currentUserId,
          type: "story_comment", entity_id: storyId,
          entity_type: "story", content: "commented on your story", is_read: false,
        });
      }
    }
    setSending(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1010] flex flex-col justify-end"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="bg-black/85 backdrop-blur-2xl rounded-t-3xl flex flex-col"
        style={{
          maxHeight: "65vh",
          paddingBottom: "max(calc(env(safe-area-inset-bottom) + 72px), 80px)",
        }}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-3 mb-1 shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <p className="text-white font-black text-[15px]">💬 Comments</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <X size={14} className="text-white/70" />
          </button>
        </div>
        {/* Comment list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-white/40" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-white/35 text-sm text-center py-8 font-medium">Pehla comment karo! 🌟</p>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex items-start gap-2.5">
                {c.profiles?.avatar_url ? (
                  <img src={c.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async"/>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white font-bold text-sm">{(c.profiles?.full_name || "U")[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-white/55 text-[11px] font-bold">{c.profiles?.full_name || "User"}</span>
                  <p className="text-white text-[13px] leading-snug mt-0.5">{c.comment_text}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 pt-2.5 border-t border-white/10 shrink-0">
          {currentUserId ? (
            <>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                placeholder="Comment likho…"
                className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-white/35 outline-none border border-white/15 focus:border-white/35 transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={send}
                disabled={!text.trim() || sending}
                className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center active:scale-90 disabled:opacity-40 transition-all shrink-0"
              >
                {sending ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
              </motion.button>
            </>
          ) : (
            <p className="text-white/40 text-sm text-center flex-1 py-1">Comment karne ke liye login karo</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Full-Screen Story Viewer ───────────────────────────────────────────────────
const StoryViewer = ({
  groups,
  startGroupIdx,
  startStoryIdx,
  currentUserId,
  onClose,
}: {
  groups: StoryGroup[];
  startGroupIdx: number;
  startStoryIdx: number;
  currentUserId: string | null;
  onClose: () => void;
}) => {
  const [groupIdx, setGroupIdx] = useState(startGroupIdx);
  const [storyIdx, setStoryIdx] = useState(startStoryIdx);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  // ── Action bar state ─────────────────────────────────────────────────────
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showViewers, setShowViewers] = useState(false);

  const DURATION = 15;
  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const totalInGroup = group?.stories.length ?? 0;
  const isOwner = currentUserId === story?.user_id;

  // Resolve public URL for the current story
  const storyPublicUrl = story?.image_url
    ? (story.image_url.startsWith("http://") || story.image_url.startsWith("https://")
      ? story.image_url
      : supabase.storage.from("stories").getPublicUrl(story.image_url).data.publicUrl)
    : "";

  const goNext = useCallback(() => {
    setElapsed(0);
    setShowComments(false);
    setShowViewers(false);
    if (storyIdx + 1 < totalInGroup) {
      setStoryIdx(s => s + 1);
    } else if (groupIdx + 1 < groups.length) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, totalInGroup, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    setElapsed(0);
    setShowComments(false);
    setShowViewers(false);
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx(g => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
    }
  }, [storyIdx, groupIdx, groups]);

  // Timer tick — pauses when sheets are open or page is hidden (saves battery)
  useEffect(() => {
    if (paused || showComments || showViewers) return;
    const tick = () => {
      if (document.hidden) return; // don't fire when screen is off/app backgrounded
      setElapsed(e => {
        if (e + 0.1 >= DURATION) { goNext(); return 0; }
        return e + 0.1;
      });
    };
    timerRef.current = setInterval(tick, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, goNext, storyIdx, groupIdx, showComments, showViewers]);

  // View tracking
  useEffect(() => {
    if (!story || !currentUserId) return;
    if (viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    supabase.from("story_views").upsert({
      story_id: story.id,
      viewer_id: currentUserId,
    }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true }).then(() => {});
  }, [story, currentUserId]);

  // Music — manual play/pause with resolved public URL
  const musicPublicUrl = story?.music_url
    ? (story.music_url.startsWith("http")
      ? story.music_url
      : supabase.storage.from("stories").getPublicUrl(story.music_url).data.publicUrl)
    : "";

  const [musicPlaying, setMusicPlaying] = useState(false);

  useEffect(() => {
    if (!musicPublicUrl) return;
    audioRef.current = new Audio(musicPublicUrl);
    audioRef.current.volume = 0.5;
    audioRef.current.loop = true;
    // Browsers block autoplay — user must click the speaker icon
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      setMusicPlaying(false);
    };
  }, [musicPublicUrl, story?.id]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (musicPlaying) {
      audioRef.current.pause();
      setMusicPlaying(false);
    } else {
      audioRef.current.play().then(() => setMusicPlaying(true)).catch(() => {
        toast.error("Tap to play music");
      });
    }
  };

  // Fetch like / comment / view counts whenever story changes
  useEffect(() => {
    if (!story?.id) return;
    let cancelled = false;

    const fetchCounts = async () => {
      // Likes
      const { count: lc } = await supabase
        .from("story_likes").select("id", { count: "exact", head: true }).eq("story_id", story.id);
      if (!cancelled) setLikeCount(lc ?? 0);

      if (currentUserId) {
        const { data: myLike } = await supabase
          .from("story_likes").select("id").eq("story_id", story.id).eq("user_id", currentUserId).maybeSingle();
        if (!cancelled) setLiked(!!myLike);
      }

      // Views
      const { count: vc } = await supabase
        .from("story_views").select("id", { count: "exact", head: true }).eq("story_id", story.id);
      if (!cancelled) setViewCount(vc ?? 0);

      // Comments
      const { count: cc } = await supabase
        .from("story_comments").select("id", { count: "exact", head: true }).eq("story_id", story.id);
      if (!cancelled) setCommentCount(cc ?? 0);
    };

    fetchCounts();
    return () => { cancelled = true; };
  }, [story?.id, currentUserId]);

  if (!story || !group) return null;

  const isVoice = story.media_type === "voice" ||
    /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(story.image_url || "");
  const moodFilter = MOOD_FILTER[story.mood ?? ""] ?? "";
  const isSad = story.mood === "sad";
  const isParty = story.mood === "party";
  const profileName = group.profile?.full_name || "User";
  const avatarUrl = group.profile?.avatar_url;

  // ── Action helpers ────────────────────────────────────────────────────────
  const toggleLike = async () => {
    if (!currentUserId || likeBusy) return;
    setLikeBusy(true);
    try {
      // Check if like already exists
      const { data: existingLike } = await supabase
        .from("story_likes")
        .select("id")
        .eq("story_id", story.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (existingLike) {
        // Toggle OFF: remove like
        await supabase.from("story_likes").delete()
          .eq("story_id", story.id).eq("user_id", currentUserId);
        setLiked(false);
        setLikeCount(c => Math.max(0, c - 1));
      } else {
        // Toggle ON: insert like
        const { error } = await supabase.from("story_likes")
          .insert({ story_id: story.id, user_id: currentUserId });
        if (!error) {
          setLiked(true);
          setLikeCount(c => c + 1);
          setLikeBurst(true);
          setTimeout(() => setLikeBurst(false), 700);
          // Notify story owner (only if not self-like)
          if (story.user_id !== currentUserId) {
            await supabase.from("notifications").insert({
              notifier_id: story.user_id, actor_id: currentUserId,
              type: "story_like", entity_id: story.id,
              entity_type: "story", content: "liked your story", is_read: false,
            });
          }
        }
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = storyPublicUrl; a.download = "flicks-story"; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Flicks Story", url: storyPublicUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(storyPublicUrl);
      toast.success("Link copied!");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="story-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-black flex flex-col touch-none overflow-x-hidden"
        style={{ paddingTop: "env(safe-area-inset-top)", maxWidth: "100vw", width: "100%" }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* Progress bar */}
        <ProgressSegments total={totalInGroup} current={storyIdx} elapsed={elapsed} duration={DURATION} />

        {/* Close button — top-right, always on top */}
        <div className="absolute top-4 right-4 z-[100]">
          <button
            className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-xl active:scale-90 transition-transform"
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClose(); }}
            aria-label="Close story"
          >
            <X size={22} className="text-white" strokeWidth={3} />
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2 pr-16 z-20">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover border-2 border-white/60" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async"/>
          ) : (
            <div className="w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{ background: gradFor(group.user_id) }}>
              {profileName[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[13px] leading-none truncate">{profileName}</p>
            <p className="text-white/60 text-[10px] mt-0.5">
              {storyIdx + 1}/{totalInGroup} · {Math.max(0, Math.ceil(DURATION - elapsed))}s
            </p>
          </div>
          {story.music_url && <Music size={14} className="text-white/60" />}
        </div>

        {/* Story content */}
        <div className="flex-1 relative overflow-hidden" style={{ maxWidth: "100vw", width: "100%" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={story.id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {isVoice ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6"
                  style={{ background: `linear-gradient(160deg, ${gradFor(group.user_id)}, #0f172a)` }}>
                  {/* Hidden audio element — auto-plays the music */}
                  <audio src={storyPublicUrl} autoPlay loop style={{ display: "none" }} />

                  {/* Rotating music disc / visualizer */}
                  <motion.div className="w-32 h-32 rounded-full border-4 border-white/30 overflow-hidden shadow-2xl flex items-center justify-center relative"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
                    <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)` }} />
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-5xl" style={{ background: gradFor(group.user_id) }}>
                        {profileName[0]}
                      </div>
                    )}
                  </motion.div>

                  {/* Audio wave bars */}
                  <AudioWave />

                  {story.caption && <p className="text-white/80 text-sm font-medium px-6 text-center">{story.caption}</p>}

                  <div className="flex items-center gap-1.5">
                    <Music size={14} className="text-white/50" />
                    <span className="text-white/50 text-[11px]">Music Story</span>
                  </div>
                </div>
              ) : story.media_type === "video" ? (
                story.mood === "grid" ? (
                  <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                    {[0,1,2,3].map(j => <video key={j} src={storyPublicUrl} className="w-full h-full object-cover" autoPlay muted={!!story.music_url} playsInline loop />)}
                  </div>
                ) : (
                  <video src={storyPublicUrl} className="w-full h-full object-cover" autoPlay muted={!!story.music_url} playsInline loop style={{ filter: moodFilter }} />
                )
              ) : story.mood === "grid" ? (
                <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                  {[0,1,2,3].map(j => <img key={j} src={storyPublicUrl} className="w-full h-full object-cover" style={{ transform: j % 2 === 1 ? "scaleX(-1)" : undefined }} draggable={false} loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async"/>)}
                </div>
              ) : (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <img
                    src={storyPublicUrl}
                    className="w-full h-full"
                    style={{ objectFit: "contain", objectPosition: "center", filter: moodFilter, maxWidth: "100%", display: "block" }}
                    draggable={false}
                    loading="lazy"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                   decoding="async"/>
                  {isSad && <RainOverlay />}
                  {isParty && <NeonOverlay />}
                </div>
              )}

              {/* Help sticker */}
              {story.is_help_request && <HelpSticker />}

              {/* Caption — left side, above action bar, safe-area-aware */}
              {(story.caption || story.emoji) && (
                <div className="absolute left-4 z-20 pr-20"
                  style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)", right: "72px" }}>
                  <div className="bg-black/45 backdrop-blur-md rounded-2xl px-4 py-3 inline-block max-w-full">
                    {story.emoji && <span className="text-2xl mr-2">{story.emoji}</span>}
                    {story.caption && <span className="text-white text-sm font-medium leading-snug">{story.caption}</span>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Tap zones — left & centre only, right side reserved for action bar */}
          <button
            className="absolute left-0 top-0 w-[38%] h-full z-30"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
          />
          <button
            className="absolute left-[38%] top-0 w-[42%] h-full z-30"
            onClick={e => { e.stopPropagation(); goNext(); }}
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
          />

          {/* Arrow overlays */}
          {(storyIdx > 0 || groupIdx > 0) && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <ChevronLeft size={28} className="text-white/50" />
            </div>
          )}

          {/* ── RIGHT-SIDE VERTICAL ACTION BAR ─────────────────────────── */}
          <div
            className="absolute right-2.5 z-50 flex flex-col items-center gap-5"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
          >
            {/* 1 — Like */}
            <div className="flex flex-col items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={e => { e.stopPropagation(); toggleLike(); }}
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform relative"
              >
                <motion.span animate={likeBurst ? { scale: [1, 1.7, 1] } : { scale: 1 }} transition={{ duration: 0.45 }} className="flex items-center">
                  <Heart size={21} className={liked ? "text-red-500" : "text-white"} fill={liked ? "#ef4444" : "transparent"} />
                </motion.span>
                {likeBurst && (
                  <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -24 }} transition={{ duration: 0.55 }}
                    className="absolute -top-1 left-1/2 -translate-x-1/2 text-red-400 text-sm pointer-events-none">❤️</motion.span>
                )}
              </motion.button>
              {likeCount > 0 && <span className="text-white text-[10px] font-bold drop-shadow-md tabular-nums">{likeCount}</span>}
            </div>

            {/* 2 — Comment */}
            <div className="flex flex-col items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={e => { e.stopPropagation(); setShowComments(true); }}
                className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
              >
                <MessageCircle size={20} className="text-white" />
              </motion.button>
              {commentCount > 0 && <span className="text-white text-[10px] font-bold drop-shadow-md tabular-nums">{commentCount}</span>}
            </div>

            {/* 3 — Speaker / Music toggle */}
            {story.music_url && (
              <div className="flex flex-col items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.82 }}
                  onClick={e => { e.stopPropagation(); toggleMusic(); }}
                  className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
                >
                  {musicPlaying
                    ? <Volume2 size={20} className="text-green-400" />
                    : <VolumeX size={20} className="text-white/60" />}
                </motion.button>
              </div>
            )}

            {/* 4 — Eye / Views (owner → opens viewer list; everyone → sees count) */}
            <div className="flex flex-col items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={e => { e.stopPropagation(); if (isOwner) setShowViewers(true); }}
                className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 transition-transform ${isOwner ? "active:scale-90 cursor-pointer" : "cursor-default"}`}
              >
                <Eye size={20} className="text-white" />
              </motion.button>
              <span className="text-white text-[10px] font-bold drop-shadow-md tabular-nums">{viewCount}</span>
            </div>

            {/* 4 — Download */}
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={e => { e.stopPropagation(); handleDownload(); }}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
            >
              <Download size={18} className="text-white" />
            </motion.button>

            {/* 5 — Share */}
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={e => { e.stopPropagation(); handleShare(); }}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
            >
              <Share2 size={18} className="text-white" />
            </motion.button>
          </div>
        </div>

        {/* Comment Sheet */}
        <AnimatePresence>
          {showComments && (
            <StoryCommentSheet
              storyId={story.id}
              storyOwnerId={story.user_id}
              currentUserId={currentUserId}
              onClose={() => setShowComments(false)}
              onCommentPosted={() => setCommentCount(c => c + 1)}
            />
          )}
        </AnimatePresence>

        {/* Viewer List Sheet (owner tap on Eye) */}
        <AnimatePresence>
          {showViewers && (
            <ViewerListSheet
              storyId={story.id}
              onClose={() => setShowViewers(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Like button (non-owner) — sends notification on first like ────────────────
const LikeButton = ({
  storyId,
  storyOwnerId,
  currentUserId,
  onPause,
  onResume,
}: {
  storyId: string;
  storyOwnerId: string;
  currentUserId: string;
  onPause: () => void;
  onResume: () => void;
}) => {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);

  const refresh = useCallback(async () => {
    const { count: c } = await supabase
      .from("story_likes")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId);
    setCount(c ?? 0);
    const { data } = await supabase
      .from("story_likes")
      .select("id")
      .eq("story_id", storyId)
      .eq("user_id", currentUserId)
      .maybeSingle();
    setLiked(!!data);
  }, [storyId, currentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    onPause();
    try {
      if (liked) {
        await supabase.from("story_likes")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", currentUserId);
        setLiked(false);
        setCount(c => Math.max(0, c - 1));
      } else {
        const { error } = await supabase.from("story_likes")
          .insert({ story_id: storyId, user_id: currentUserId });
        if (!error) {
          setLiked(true);
          setCount(c => c + 1);
          setBurst(true);
          setTimeout(() => setBurst(false), 700);
          // Notify owner (if not self)
          if (storyOwnerId !== currentUserId) {
            const { data: me } = await supabase
              .from("profiles").select("full_name").eq("id", currentUserId).maybeSingle();
            const name = (me as any)?.full_name || "Someone";
            await supabase.from("notifications").insert({
              notifier_id: storyOwnerId,
              actor_id: currentUserId,
              type: "story_like",
              entity_id: storyId,
              entity_type: "story",
              content: "liked your story",
              is_read: false,
            });
          }
        }
      }
    } finally {
      setBusy(false);
      setTimeout(onResume, 200);
    }
  };

  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={toggle}
      className="relative flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-2 border border-white/20 active:scale-95 transition-transform"
    >
      <motion.span
        animate={burst ? { scale: [1, 1.6, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center"
      >
        <Heart
          size={18}
          className={liked ? "text-red-500" : "text-white"}
          fill={liked ? "#ef4444" : "transparent"}
        />
      </motion.span>
      {count > 0 && (
        <span className="text-white text-[11px] font-bold tabular-nums">{count}</span>
      )}
      {burst && (
        <motion.span
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -22, scale: 1.4 }}
          transition={{ duration: 0.6 }}
          className="absolute -top-1 left-1/2 -translate-x-1/2 text-red-500 text-base pointer-events-none"
        >
          ❤️
        </motion.span>
      )}
    </button>
  );
};

// ── Viewer count + swipe-up viewer list (owner only) ──────────────────────────
const ViewerListSheet = ({
  storyId,
  onClose,
}: {
  storyId: string;
  onClose: () => void;
}) => {
  const [viewers, setViewers] = useState<Array<{ id: string; viewed_at: string; profile: { full_name: string; username?: string; avatar_url?: string } }>>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Single query: join profiles via the viewer_id foreign key relation
      const [{ data: rows }, { data: likes }] = await Promise.all([
        supabase
          .from("story_views")
          .select("viewer_id, viewed_at, profiles:viewer_id(id, full_name, username, avatar_url)")
          .eq("story_id", storyId)
          .order("viewed_at", { ascending: false }),
        supabase
          .from("story_likes")
          .select("user_id")
          .eq("story_id", storyId),
      ]);
      setLikedSet(new Set((likes || []).map((l: any) => l.user_id)));
      setViewers(
        (rows || []).map((r: any) => {
          const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return {
            id: r.viewer_id,
            viewed_at: r.viewed_at,
            profile: prof
              ? { full_name: prof.full_name || "User", username: prof.username, avatar_url: prof.avatar_url }
              : { full_name: "User" },
          };
        })
      );
      setLoading(false);
    })();
  }, [storyId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/60"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => { if (info.offset.y > 80) onClose(); }}
        className="absolute bottom-0 left-0 right-0 bg-[#d4f0e2] rounded-t-3xl max-h-[80vh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-gray-300 mx-auto mt-2.5 mb-2" />
        <div className="px-5 pb-2 flex items-center gap-2">
          <Eye size={18} className="text-gray-700" />
          <h3 className="text-base font-black text-gray-900">
            Viewed by {viewers.length}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-gray-400" />
            </div>
          ) : viewers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">No viewers yet</p>
          ) : (
            viewers.map(v => (
              <div key={v.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#c4e8d4] rounded-xl">
                {v.profile.avatar_url ? (
                  <img src={v.profile.avatar_url} className="w-11 h-11 rounded-full object-cover" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async"/>
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black"
                    style={{ background: gradFor(v.id) }}
                  >
                    {v.profile.full_name?.[0] || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{v.profile.full_name}</p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(v.viewed_at).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </p>
                </div>
                {likedSet.has(v.id) && (
                  <Heart size={16} className="text-red-500" fill="#ef4444" />
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Owner: Eye button with count + swipe-up trigger ───────────────────────────
const OwnerViewButton = ({
  storyId,
  onPause,
  onResume,
}: {
  storyId: string;
  onPause: () => void;
  onResume: () => void;
}) => {
  const [count, setCount] = useState<number>(0);
  const [showSheet, setShowSheet] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    supabase
      .from("story_views")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [storyId]);

  const open = () => { onPause(); setShowSheet(true); };
  const close = () => { setShowSheet(false); onResume(); };

  return (
    <>
      <button
        onPointerDown={(e) => { e.stopPropagation(); startY.current = e.clientY; }}
        onPointerUp={(e) => {
          e.stopPropagation();
          const dy = startY.current !== null ? startY.current - e.clientY : 0;
          startY.current = null;
          if (dy > 25) open();
        }}
        onClick={(e) => { e.stopPropagation(); open(); }}
        className="flex flex-col items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-2xl px-3 py-1.5 border border-white/20 active:scale-95 transition-transform"
      >
        <ChevronUp size={14} className="text-white/80 -mb-1" />
        <div className="flex items-center gap-1">
          <Eye size={14} className="text-white" />
          <span className="text-white text-xs font-bold tabular-nums">{count}</span>
        </div>
      </button>
      <AnimatePresence>
        {showSheet && <ViewerListSheet storyId={storyId} onClose={close} />}
      </AnimatePresence>
    </>
  );
};

// ── Story Upload Sheet ─────────────────────────────────────────────────────────
const StoryUploader = ({
  userId,
  onDone,
  onClose,
}: {
  userId: string;
  onDone: () => void;
  onClose: () => void;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [mood, setMood] = useState("");
  const [isHelp, setIsHelp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const MOODS = [
    { key: "", label: "✨ None" },
    { key: "happy", label: "😊 Happy" },
    { key: "sad", label: "😢 Sad" },
    { key: "love", label: "❤️ Love" },
    { key: "angry", label: "😡 Angry" },
    { key: "party", label: "🎉 Party" },
    { key: "chill", label: "😌 Chill" },
    { key: "vibrant-gold", label: "🌟 Gold" },
    { key: "cyberpunk", label: "⚡ Cyber" },
    { key: "noir", label: "🎞 Noir" },
    { key: "grid", label: "▦ Grid" },
  ];

  const handleFiles = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const arr = Array.from(selected).slice(0, 10);
    const oversized = arr.find(f => f.type.startsWith("video/") && f.size > 30 * 1024 * 1024);
    if (oversized) { toast.error("Please shorten your file under 30MB"); return; }
    setFiles(arr);
    const urls = arr.map(f => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const uploadAll = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);
    let done = 0;

    for (const file of files) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `stories/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("stories")
          .upload(fileName, file, { upsert: true });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("stories").insert({
          user_id: userId,
          image_url: fileName,
          caption: caption?.trim() || null,
          mood: mood || null,
          is_help_request: isHelp || false,
          media_type: file.type.startsWith("audio/") ? "voice" : file.type.startsWith("video/") ? "video" : "image",
        });
        if (dbErr) {
          console.error("[StoryUploader] DB insert failed:", dbErr);
          toast.error("Story save failed: " + dbErr.message);
          setUploading(false);
          return;
        }
        done++;
        setProgress(Math.round((done / files.length) * 100));
      } catch (e: any) {
        console.error("[StoryUploader] upload error:", e?.message);
        toast.error("Story upload failed: " + (e?.message || "Unknown error"));
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    toast.success(files.length > 1 ? `${files.length} stories posted! 🌟` : "Story posted! 🌟");
    onDone();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="uploader-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm flex items-end"
        onClick={onClose}
      >
        <motion.div
          key="uploader-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="w-full bg-white rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-black text-gray-900 mb-4">Add to Your Story</h2>

          {/* File picker */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {previews.length === 0 ? (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
            >
              <Plus size={32} />
              <span className="text-sm font-semibold">Tap to select photos/audio</span>
              <span className="text-xs">Up to 10 files</span>
            </button>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {previews.map((url, i) => (
                <div key={i} className="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-gray-100 relative">
                  {files[i]?.type.startsWith("audio/") ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Mic size={24} className="text-white" />
                    </div>
                  ) : files[i]?.type.startsWith("video/") ? (
                    <div className="w-full h-full relative bg-black">
                      <video src={url} className="w-full h-full object-cover" muted playsInline  preload="none"/>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-white text-lg">🎬</span>
                      </div>
                    </div>
                  ) : (
                    <img src={url} className="w-full h-full object-cover" loading="lazy"  decoding="async"/>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/40 rounded-full px-1.5 py-0.5">
                    <span className="text-white text-[9px] font-bold">{i + 1}</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => inputRef.current?.click()}
                className="flex-shrink-0 w-20 h-28 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center"
              >
                <Plus size={20} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption… (applies to all)"
            className="w-full mt-4 bg-[#c4e8d4] border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-300/30 resize-none"
            rows={2}
            maxLength={200}
          />

          {/* Mood selector */}
          <div className="mt-3">
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5">Mood Filter</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {MOODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMood(m.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    mood === m.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Madad toggle */}
          <button
            onClick={() => setIsHelp(v => !v)}
            className={`w-full mt-3 py-3 rounded-2xl text-sm font-black border-2 transition-all ${
              isHelp
                ? "bg-orange-50 text-orange-600 border-orange-400"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            🆘 {isHelp ? "Madad Request ON" : "Mark as Madad Request"}
          </button>

          {/* Progress bar */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-600">Uploading…</span>
                <span className="text-xs text-gray-400">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={uploadAll}
            disabled={files.length === 0 || uploading}
            className="w-full mt-4 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 size={18} className="animate-spin" /> Posting {files.length} {files.length === 1 ? "Story" : "Stories"}…</>
            ) : (
              `Post ${files.length > 0 ? files.length : ""} ${files.length === 1 ? "Story" : files.length > 1 ? "Stories" : "Story"} ✨`
            )}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Story Avatar Bubble ────────────────────────────────────────────────────────
const StoryBubble = ({
  group,
  isSelf,
  hasStory,
  onClick,
}: {
  group?: StoryGroup;
  isSelf?: boolean;
  hasStory?: boolean;
  onClick: () => void;
}) => {
  const profileName = group?.profile?.full_name || "You";
  const avatarUrl = group?.profile?.avatar_url;
  const userId = group?.user_id || "";
  const firstName = profileName.split(" ")[0];

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 shrink-0"
      style={{ width: "calc((100vw - 28px) / 4.2)", maxWidth: 84 }}
    >
      <div
        className={`rounded-full p-0.5 ${
          hasStory
            ? "bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-600"
            : "bg-white/20"
        }`}
        style={{ width: "calc((100vw - 28px) / 4.2 - 10px)", height: "calc((100vw - 28px) / 4.2 - 10px)", maxWidth: 74, maxHeight: 74 }}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-[#0F172A] p-0.5">
          {isSelf && !avatarUrl ? (
            <div
              className="w-full h-full rounded-full flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg,#6366f1,#ec4899)" }}
            >
              <Plus size={24} className="text-white" />
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full rounded-full object-cover" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" decoding="async"/>
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-white font-black text-lg"
              style={{ background: gradFor(userId) }}
            >
              {firstName[0]}
            </div>
          )}
        </div>
      </div>
      <span className="text-[11px] font-semibold text-white/90 truncate w-full text-center leading-tight">
        {isSelf ? "Your Story" : firstName}
      </span>
    </motion.button>
  );
};

// ── Main StoryBar export ───────────────────────────────────────────────────────
export const StoryBar = ({ userProfile }: { userProfile?: any }) => {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<{ groupIdx: number; storyIdx: number } | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [myGroup, setMyGroup] = useState<StoryGroup | null>(null);

  const fetchStories = useCallback(async (force = false) => {
    // Serve from cache on initial mount — realtime calls always pass force=true
    const cKey = "storyBarGroups";
    if (!force) {
      const hit = memGet<StoryGroup[]>(cKey);
      if (hit) {
        setGroups(hit);
        const uid2 = hit.find(() => true)?.user_id ?? null;
        // currentUserId is set separately below, but we can fast-path the groups
        return;
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Resolve current user first so we can apply the block filter
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;

    // Fetch stories with all columns including music_url
    const { data: rawData, error: fetchError } = await supabase
      .from("stories")
      .select("id, user_id, created_at, image_url, media_type, caption, music_url")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[StoryBar] fetch failed:", fetchError.message, "| code:", fetchError.code, "| details:", fetchError.details);
      return;
    }

    // Block filter: hide stories from anyone you've blocked or who's blocked you
    const blockedSet = new Set<string>();
    if (uid) {
      const { data: blockRows } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
      for (const b of blockRows || []) {
        if (b.blocker_id === uid) blockedSet.add(b.blocked_id);
        if (b.blocked_id === uid) blockedSet.add(b.blocker_id);
      }
    }

    const filteredRaw = (rawData || []).filter((s: any) => !blockedSet.has(s.user_id));

    // Step 2: Fetch profiles for all unique user_ids (includes is_private_mode for filtering)
    const userIds = [...new Set(filteredRaw.map((s: any) => s.user_id).filter(Boolean))];
    let profileMap: Record<string, { full_name: string; avatar_url: string; is_private_mode?: boolean }> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: pe } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_private_mode")
        .in("id", userIds);
      if (pe) {
        console.error("[StoryBar] Profile fetch failed:", pe.message);
      } else {
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }
    }

    // Step 2b: Privacy filter — private accounts only visible to confirmed friends
    let friendSet = new Set<string>();
    if (uid) {
      const { data: friendRows } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
      for (const f of friendRows || []) {
        friendSet.add(f.requester_id === uid ? f.addressee_id : f.requester_id);
      }
    }

    const privacyFiltered = filteredRaw.filter((s: any) => {
      if (s.user_id === uid) return true;                             // always show own stories
      const prof = profileMap[s.user_id];
      if (!prof) return true;                                         // unknown = show (safe default)
      if (prof.is_private_mode === true) return friendSet.has(s.user_id); // private → friends only
      return true;                                                    // public → show to all
    });

    const storiesArr: Story[] = privacyFiltered.map((s: any) => ({
      ...s,
      profile: profileMap[s.user_id] || { full_name: "User", avatar_url: "" },
    }));

    const map = new Map<string, StoryGroup>();
    for (const s of storiesArr) {
      if (!map.has(s.user_id)) {
        map.set(s.user_id, {
          user_id: s.user_id,
          profile: s.profile || { full_name: "User" },
          stories: [],
        });
      }
      map.get(s.user_id)!.stories.push(s);
    }

    const groupArr = Array.from(map.values());
    setGroups(groupArr);
    memSet(cKey, groupArr);

    setCurrentUserId(uid);
    if (uid) {
      const mine = groupArr.find(g => g.user_id === uid) || null;
      setMyGroup(mine);
    }
  }, []);

  useEffect(() => {
    fetchStories();
    const ch = supabase
      .channel("story-bar-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => fetchStories(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchStories]);

  // Listen for notification-click story opens
  useEffect(() => {
    const openStory = (e: any) => {
      const storyId = e.detail?.storyId;
      if (!storyId || groups.length === 0) return;
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const sIdx = groups[gIdx].stories.findIndex(s => s.id === storyId);
        if (sIdx >= 0) {
          setViewerState({ groupIdx: gIdx, storyIdx: sIdx });
          return;
        }
      }
    };
    window.addEventListener("flicks:open-story", openStory);
    return () => window.removeEventListener("flicks:open-story", openStory);
  }, [groups]);

  const openViewer = (groupIdx: number, storyIdx = 0) => {
    setViewerState({ groupIdx, storyIdx });
  };

  const otherGroups = groups.filter(g => g.user_id !== currentUserId);

  return (
    <>
      <div className="bg-[#0F172A] border-b border-white/8 py-3">
        <div className="flex gap-2 overflow-x-auto px-3 no-scrollbar">
          {/* Your Story bubble */}
          <StoryBubble
            isSelf
            hasStory={!!myGroup}
            group={myGroup ?? {
              user_id: currentUserId || "",
              profile: { full_name: userProfile?.full_name || "You", avatar_url: userProfile?.avatar_url },
              stories: [],
            }}
            onClick={() => {
              if (myGroup) {
                const idx = groups.findIndex(g => g.user_id === currentUserId);
                if (idx >= 0) openViewer(idx);
              } else {
                setShowUploader(true);
              }
            }}
          />

          {/* Friend stories */}
          {otherGroups.map((group) => {
            const groupIdx = groups.findIndex(g => g.user_id === group.user_id);
            return (
              <StoryBubble
                key={group.user_id}
                group={group}
                hasStory
                onClick={() => openViewer(groupIdx)}
              />
            );
          })}

          {/* Empty state */}
          {otherGroups.length === 0 && (
            <div className="flex items-center">
              <p className="text-[11px] text-white/40 font-medium italic">
                No stories yet · Be the first! 🌟
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Viewer */}
      {viewerState && (
        <StoryViewer
          groups={groups}
          startGroupIdx={viewerState.groupIdx}
          startStoryIdx={viewerState.storyIdx}
          currentUserId={currentUserId}
          onClose={() => setViewerState(null)}
        />
      )}

      {/* Uploader */}
      {showUploader && currentUserId && (
        <StoryUploader
          userId={currentUserId}
          onDone={fetchStories}
          onClose={() => setShowUploader(false)}
        />
      )}
      {showUploader && !currentUserId && (
        <div>{toast.error("Please log in to post a story.")}</div>
      )}
    </>
  );
};

export default StoryBar;
