import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Loader2, Music, Mic, Download, Share2 } from "lucide-react";

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

  const DURATION = 15;
  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  const totalInGroup = group?.stories.length ?? 0;

  const goNext = useCallback(() => {
    setElapsed(0);
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
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx(g => g - 1);
      setStoryIdx(prevGroup.stories.length - 1);
    }
  }, [storyIdx, groupIdx, groups]);

  // Timer tick
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        if (e + 0.1 >= DURATION) { goNext(); return 0; }
        return e + 0.1;
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, goNext, storyIdx, groupIdx]);

  // View tracking
  useEffect(() => {
    if (!story || !currentUserId) return;
    if (viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    supabase.from("story_views").insert({
      story_id: story.id,
      viewer_id: currentUserId,
    }).then(() => {});
  }, [story, currentUserId]);

  // Music autoplay
  useEffect(() => {
    if (!story?.music_url) return;
    audioRef.current = new Audio(story.music_url);
    audioRef.current.volume = 0.4;
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {});
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [story?.music_url, story?.id]);

  if (!story || !group) return null;

  const isVoice = story.media_type === "voice";
  const moodFilter = MOOD_FILTER[story.mood ?? ""] ?? "";
  const isSad = story.mood === "sad";
  const isParty = story.mood === "party";
  const profileName = group.profile?.full_name || "User";
  const avatarUrl = group.profile?.avatar_url;

  return (
    <AnimatePresence>
      <motion.div
        key="story-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-black flex flex-col touch-none"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {/* Progress bar */}
        <ProgressSegments
          total={totalInGroup}
          current={storyIdx}
          elapsed={elapsed}
          duration={DURATION}
        />

        {/* Close button — absolute top-right, always visible & tappable */}
        <button
          className="absolute top-14 right-3 z-[60] w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <X size={20} className="text-white" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2 pr-16 z-20">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-9 h-9 rounded-full object-cover border-2 border-white/60" />
          ) : (
            <div
              className="w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{ background: gradFor(group.user_id) }}
            >
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
        <div className="flex-1 relative overflow-hidden">
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
                /* Voice story — pulsing avatar + wave */
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-6"
                  style={{ background: `linear-gradient(160deg, ${gradFor(group.user_id)}, #0f172a)` }}
                >
                  <motion.div
                    className="w-28 h-28 rounded-full border-4 border-white/40 overflow-hidden shadow-2xl"
                    animate={{ scale: [1, 1.07, 1], boxShadow: ["0 0 0 0 rgba(255,255,255,0.2)", "0 0 0 18px rgba(255,255,255,0)", "0 0 0 0 rgba(255,255,255,0)"] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl" style={{ background: gradFor(group.user_id) }}>
                        {profileName[0]}
                      </div>
                    )}
                  </motion.div>
                  <AudioWave />
                  {story.caption && (
                    <p className="text-white/80 text-sm font-medium px-6 text-center">{story.caption}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Mic size={14} className="text-white/50" />
                    <span className="text-white/50 text-[11px]">Voice Story</span>
                  </div>
                </div>
              ) : story.media_type === "video" ? (
                story.mood === "grid" ? (
                  <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                    {[0,1,2,3].map(j => (
                      <video key={j} src={story.image_url} className="w-full h-full object-cover" autoPlay muted={!!story.music_url} playsInline loop />
                    ))}
                  </div>
                ) : (
                  <video src={story.image_url} className="w-full h-full object-cover" autoPlay muted={!!story.music_url} playsInline loop style={{ filter: moodFilter }} />
                )
              ) : story.mood === "grid" ? (
                <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                  {[0,1,2,3].map(j => (
                    <img key={j} src={story.image_url} className="w-full h-full object-cover" style={{ transform: j % 2 === 1 ? "scaleX(-1)" : undefined }} draggable={false} />
                  ))}
                </div>
              ) : (
                /* Image story */
                <div className="w-full h-full relative">
                  <img
                    src={story.image_url}
                    className="w-full h-full object-cover"
                    style={{ filter: moodFilter }}
                    draggable={false}
                  />
                  {isSad && <RainOverlay />}
                  {isParty && <NeonOverlay />}
                </div>
              )}

              {/* Help sticker */}
              {story.is_help_request && <HelpSticker />}

              {/* Caption + emoji */}
              {(story.caption || story.emoji) && (
                <div className="absolute bottom-16 left-4 right-4 z-20">
                  <div className="bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3 inline-block max-w-full">
                    {story.emoji && <span className="text-2xl mr-2">{story.emoji}</span>}
                    {story.caption && (
                      <span className="text-white text-sm font-medium leading-snug">{story.caption}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Share & Download */}
              <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                <button
                  onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); const url = story.image_url; if (navigator.share) { navigator.share({ title: "Facelook Story", url }).catch(() => {}); } else { navigator.clipboard.writeText(url); toast.success("Link copied!"); } }}
                  className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
                >
                  <Share2 size={15} className="text-white" />
                </button>
                <button
                  onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); const a = document.createElement("a"); a.href = story.image_url; a.download = `facelook-story`; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
                  className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20"
                >
                  <Download size={15} className="text-white" />
                </button>
              </div>

              {/* View count — only for story owner */}
              {currentUserId === story.user_id && (
                <ViewCount storyId={story.id} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Tap zones */}
          <button
            className="absolute left-0 top-0 w-1/3 h-full z-30"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
          />
          <button
            className="absolute right-0 top-0 w-1/3 h-full z-30"
            onClick={e => { e.stopPropagation(); goNext(); }}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
          />

          {/* Arrow overlays */}
          {(storyIdx > 0 || groupIdx > 0) && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <ChevronLeft size={28} className="text-white/50" />
            </div>
          )}
          {(storyIdx + 1 < totalInGroup || groupIdx + 1 < groups.length) && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <ChevronRight size={28} className="text-white/50" />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Inline view count fetcher (owner only) ────────────────────────────────────
const ViewCount = ({ storyId }: { storyId: string }) => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from("story_views")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [storyId]);
  if (count === null) return null;
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/15">
      <Eye size={13} className="text-white/80" />
      <span className="text-white text-[11px] font-bold">{count}</span>
    </div>
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
          .from("avatars")
          .upload(fileName, file, { upsert: true });
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        await supabase.from("stories").insert({
          user_id: userId,
          image_url: publicUrl,
          caption: caption.trim() || null,
          mood: mood || null,
          is_help_request: isHelp || null,
          media_type: file.type.startsWith("audio/") ? "voice" : file.type.startsWith("video/") ? "video" : "image",
        });
      } catch (e: any) {
        console.warn("[StoryUploader] upload error:", e?.message);
      }
      done++;
      setProgress(Math.round((done / files.length) * 100));
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
                      <video src={url} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="text-white text-lg">🎬</span>
                      </div>
                    </div>
                  ) : (
                    <img src={url} className="w-full h-full object-cover" />
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
            className="w-full mt-4 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-300/30 resize-none"
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
      className="flex flex-col items-center gap-1.5 shrink-0"
      style={{ width: 64 }}
    >
      <div
        className={`w-14 h-14 rounded-full p-0.5 ${
          hasStory
            ? "bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-600"
            : "bg-gray-200"
        }`}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-white p-0.5">
          {isSelf && !avatarUrl ? (
            <div
              className="w-full h-full rounded-full flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg,#6366f1,#ec4899)" }}
            >
              <Plus size={20} className="text-white" />
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-white font-black text-base"
              style={{ background: gradFor(userId) }}
            >
              {firstName[0]}
            </div>
          )}
        </div>
      </div>
      <span className="text-[10px] font-semibold text-gray-700 truncate w-full text-center">
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

  const fetchStories = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("stories")
      .select("*, profile:profiles(full_name, avatar_url)")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) return;

    const storiesArr: Story[] = (data || []).map((s: any) => ({
      ...s,
      profile: Array.isArray(s.profile) ? s.profile[0] : s.profile,
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

    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);
    if (uid) {
      const mine = groupArr.find(g => g.user_id === uid) || null;
      setMyGroup(mine);
    }
  }, []);

  useEffect(() => {
    fetchStories();
    const ch = supabase
      .channel(`story-bar-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, fetchStories)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchStories]);

  const openViewer = (groupIdx: number, storyIdx = 0) => {
    setViewerState({ groupIdx, storyIdx });
  };

  const otherGroups = groups.filter(g => g.user_id !== currentUserId);

  return (
    <>
      <div className="bg-white border-b border-gray-100 py-3">
        <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar">
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
              <p className="text-[11px] text-gray-400 font-medium italic">
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
