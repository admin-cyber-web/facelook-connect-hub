import { useState, useEffect, useRef, useMemo } from "react";
import {
  Image as ImageIcon,
  X,
  Send,
  Loader2,
  Globe,
  Users,
  Sparkles,
  MapPin,
  Smile,
  Camera,
  Video,
  BookmarkPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import MentionInput, { MentionCandidate } from "./MentionInput";
import { extractMentionTokens, nameToUsername, Mention } from "@/lib/mentions";
import { sanitizeText } from "@/lib/profanityFilter";
import { generatePostSEO } from "@/lib/geminiClient";
import { useSuggestion } from "@/hooks/useSuggestion";
import SuggestionPanel from "./SuggestionPanel";

interface CreatePostProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  initialFile?: File | null;
}

const CreatePost = ({
  isOpen,
  onClose,
  userProfile,
  initialFile,
}: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Post Vibe");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "friends_only">("public");
  const [location, setLocation] = useState<string>("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [draft, setDraft] = useState(false);

  // Load friends + first circle members for mention candidates (memoized fetch).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid) return;
      if (!cancelled) setCurrentUserId(uid);

      const friendCands: MentionCandidate[] = [];
      try {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("sender_id, receiver_id, status")
          .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
          .eq("status", "accepted");
        const friendIds = (friendships || [])
          .map((f: any) => (f.sender_id === uid ? f.receiver_id : f.sender_id))
          .filter(Boolean);
        if (friendIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", friendIds);
          (profs || []).forEach((p: any) => {
            const uname = nameToUsername(p.full_name) || `user_${(p.id || "").slice(0, 6)}`;
            friendCands.push({
              kind: "friend",
              id: p.id,
              username: uname,
              name: p.full_name || "User",
              avatar_url: p.avatar_url,
            });
          });
        }
      } catch (e) {
        console.warn("[CreatePost] friends fetch warning:", e);
      }

      const teamCands: MentionCandidate[] = [];
      try {
        const { data: myCircles } = await supabase
          .from("circle_members")
          .select("circle_id, circles(id, name)")
          .eq("user_id", uid)
          .limit(1);
        const firstCircle = (myCircles || [])[0] as any;
        if (firstCircle?.circle_id) {
          const circleId: string = firstCircle.circle_id;
          const circleName: string = firstCircle.circles?.name || "Circle";
          const { data: members } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", circleId);
          const memberIds = (members || [])
            .map((m: any) => m.user_id)
            .filter((id: string) => id && id !== uid);
          if (memberIds.length > 0) {
            teamCands.push({
              kind: "team",
              id: `__team_${circleId}`,
              username: "team",
              name: circleName,
              circle_id: circleId,
              circle_name: circleName,
            });
          }
        }
      } catch (e) {
        console.warn("[CreatePost] circle members fetch warning:", e);
      }

      if (!cancelled) setCandidates([...friendCands, ...teamCands]);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const teamMarker = useMemo(
    () => candidates.find(c => c.kind === "team"),
    [candidates],
  );

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      setPreview(URL.createObjectURL(initialFile));
    }
  }, [initialFile]);

  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setFile(null);
      setPreview(null);
      setVisibility("public");
      setLoadingMsg("Post Vibe");
    }
  }, [isOpen]);

  const ADMIN_EMAIL = "tiwarijhumki@gmail.com";

  const getMediaInfoFromUrl = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const url = text.match(urlRegex)?.[0];
    if (!url) return { finalUrl: "", type: "text", isYoutube: false };

    const ytRegExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
      return {
        finalUrl: `https://www.youtube.com/embed/${ytMatch[2]}`,
        type: "video",
        isYoutube: true,
      };
    }

    const isDirectVideo =
      /\.(mp4|webm|ogg|mov|m4v)/i.test(url.split("?")[0]) ||
      url.includes("rapidcdn.app") ||
      url.includes("raw=1");

    if (isDirectVideo) return { finalUrl: url, type: "video", isYoutube: false };
    return { finalUrl: "", type: "text", isYoutube: false };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const mediaType = useMemo<"image" | "video" | "youtube" | "text" | undefined>(() => {
    if (file) {
      if (file.type.startsWith("video/")) return "video";
      return "image";
    }
    const url = content.match(/https?:\/\/[^\s]+/)?.[0] || "";
    if (/youtu\.be\/|youtube\.com\/|\/shorts\//.test(url)) return "youtube";
    return undefined;
  }, [file, content]);

  const { suggestions, loading: suggestLoading, error: suggestError, refresh } = useSuggestion({
    text: content,
    mediaType,
    location: location || undefined,
    enabled: isOpen,
  });

  const [autoMerged, setAutoMerged] = useState(false);
  useEffect(() => {
    if (suggestions && !autoMerged && suggestions.captions.length > 0 && content.trim()) {
      const auto = suggestions.captions[suggestions.autoSelected] || suggestions.captions[0];
      if (content.trim().length <= 60 && !content.includes(auto)) {
        const newContent = content.trim() ? `${content.trim()} \u2014 ${auto}` : auto;
        setContent(newContent);
        setAutoMerged(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, autoMerged, content]);

  useEffect(() => {
    if (!isOpen) {
      setAutoMerged(false);
      setLocation("");
      setShowLocationInput(false);
    }
  }, [isOpen]);

  const appliedRef = useRef<Set<string>>(new Set());

  const handleUseCaption = (caption: string) => {
    const key = "use:" + caption;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    setContent((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return caption;
      if (trimmed.includes(caption)) return prev;
      return `${trimmed} \n${caption}`;
    });
    toast.success("✨ Suggestion Applied", { duration: 1500 });
  };

  const handleAddHashtags = (hashtags: string[]) => {
    const tagStr = hashtags.join(" ");
    const key = "tags:" + tagStr;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    setContent((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tagStr;
      if (trimmed.includes(tagStr)) return prev;
      return `${trimmed} \n${tagStr}`;
    });
    toast.success("✨ Hashtags Added", { duration: 1500 });
  };

  const handleReplaceContent = (text: string) => {
    const key = "replace:" + text;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    setContent(text);
    toast.success("✨ Suggestion Applied", { duration: 1500 });
  };

  const handleSaveDraft = () => {
    if (!content && !file) return;
    setDraft(true);
    toast.success("Draft saved!", { duration: 2000 });
    onClose();
  };

  const handlePost = async () => {
    if (!content && !file) return;
    setLoading(true);
    setLoadingMsg("Posting…");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let savedName = userProfile?.full_name;
      if (!savedName && user?.id) {
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        savedName = freshProfile?.full_name;
      }
      const authorName =
        savedName ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Vibe User";

      let finalMediaUrl = "";
      let mediaType = "text";
      let isYoutube = false;

      if (!file) {
        const detection = getMediaInfoFromUrl(content);
        finalMediaUrl = detection.finalUrl;
        mediaType = detection.type;
        isYoutube = detection.isYoutube;
      }

      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        if (uploadData) {
          const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
          finalMediaUrl = data.publicUrl;
          isYoutube = false;
        }
      }

      const tokens = extractMentionTokens(content);
      const friendByUsername = new Map<string, MentionCandidate>();
      candidates.forEach(c => {
        if (c.kind === "friend") friendByUsername.set(c.username.toLowerCase(), c);
      });
      const resolvedMentions: Mention[] = [];
      let hasPin = false;
      let hasTeam = false;
      for (const tok of tokens) {
        if (tok === "pin") {
          hasPin = true;
          resolvedMentions.push({ kind: "pin", username: "pin" });
          continue;
        }
        if (tok === "team" && teamMarker?.circle_id) {
          hasTeam = true;
          resolvedMentions.push({
            kind: "team",
            username: "team",
            circle_id: teamMarker.circle_id,
            name: teamMarker.circle_name,
          });
          continue;
        }
        const f = friendByUsername.get(tok);
        if (f) {
          resolvedMentions.push({
            kind: "friend",
            username: f.username,
            name: f.name,
            user_id: f.id,
          });
        }
      }

      const { cleaned: cleanContent, hadProfanity } = sanitizeText(content);
      if (hadProfanity) {
        toast.warning("Offensive words detected and masked automatically.");
      }

      setLoadingMsg("Optimizing SEO & Posting…");
      const seo = await generatePostSEO(cleanContent);

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert([
          {
            author_id: user?.id || userProfile?.id,
            content: cleanContent,
            media_url: finalMediaUrl,
            author: authorName,
            type: mediaType,
            visibility,
            is_admin_post: user?.email === ADMIN_EMAIL,
            meta_title: seo.meta_title,
            meta_description: seo.meta_description,
            seo_keywords: seo.seo_keywords,
            metadata: {
              is_youtube: isYoutube,
              mentions: resolvedMentions,
              has_pin: hasPin,
              has_team: hasTeam,
              author_avatar:
                userProfile?.avatar_url ||
                (user as any)?.user_metadata?.picture ||
                (user as any)?.user_metadata?.avatar_url ||
                "",
            },
          },
        ])
        .select("id")
        .maybeSingle();

      if (insertError) throw insertError;

      try {
        const notifierIds = new Set<string>();
        resolvedMentions.forEach(m => {
          if (m.kind === "friend" && m.user_id && m.user_id !== user?.id)
            notifierIds.add(m.user_id);
        });
        if (hasPin) {
          candidates
            .filter(c => c.kind === "friend" && c.id && c.id !== user?.id)
            .forEach(c => notifierIds.add(c.id));
        }
        if (hasTeam && teamMarker?.circle_id) {
          const { data: members } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", teamMarker.circle_id);
          (members || []).forEach((m: any) => {
            if (m.user_id && m.user_id !== user?.id) notifierIds.add(m.user_id);
          });
        }
        if (notifierIds.size > 0 && user?.id) {
          const isPriority = hasPin || hasTeam;
          const notifText = isPriority
            ? "pinned you in a priority post"
            : "mentioned you in a post";
          const rows = Array.from(notifierIds).map(nid => ({
            notifier_id: nid,
            actor_id: user.id,
            type: isPriority ? "post_pin" : "post_mention",
            entity_id: inserted?.id ?? null,
            content: notifText,
            is_read: false,
          }));
          await supabase.from("notifications").insert(rows);
        }
      } catch (notifyErr) {
        console.warn("[CreatePost] notification batch warning:", notifyErr);
      }

      setContent("");
      setFile(null);
      setPreview(null);
      onClose();
    } catch (err: any) {
      console.error("Error Details:", err);
      toast.error(`Error: ${err.message || "Post failed."}`);
    } finally {
      setLoading(false);
      setLoadingMsg("Post Vibe");
    }
  };

  const canPost = !loading && (!!content || !!file);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal panel */}
          <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center pointer-events-none">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="pointer-events-auto w-full sm:max-w-lg flex flex-col bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden"
              style={{ maxHeight: "92dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Sticky Header ─────────────────────────────────── */}
              <div className="flex-none flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      userProfile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name || "User")}&background=6366f1&color=fff`
                    }
                    className="w-11 h-11 rounded-2xl object-cover ring-2 ring-indigo-100"
                    alt="Avatar"
                    decoding="async"
                  />
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">
                      {userProfile?.full_name || "You"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">Create a post</p>
                  </div>
                </div>

                {/* Floating close button — always reachable */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all active:scale-90 touch-manipulation"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* ── Scrollable Body ───────────────────────────────── */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

                {/* Visibility toggle — large touch-friendly cards */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVisibility("public")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 touch-manipulation ${
                      visibility === "public"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <Globe size={16} />
                    🌍 Public
                  </button>
                  <button
                    onClick={() => setVisibility("friends_only")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 touch-manipulation ${
                      visibility === "friends_only"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <Users size={16} />
                    👥 Friends
                  </button>
                </div>

                {/* Public warning */}
                <AnimatePresence>
                  {visibility === "public" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                    >
                      <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                      <p className="text-amber-700 text-[11px] font-semibold leading-snug">
                        You're posting publicly. Make sure your content follows community guidelines.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Text editor — always visible, never hidden */}
                <div className="bg-slate-50 rounded-2xl p-3 min-h-[130px]">
                  <MentionInput
                    autoFocus
                    value={content}
                    onChange={setContent}
                    candidates={candidates}
                    placeholder="What's on your mind? Paste a link, write something… 🔥  Type @ to tag friends, @pin or @team"
                    className="w-full min-h-[110px] text-base font-medium text-slate-700 outline-none resize-none bg-transparent pointer-events-auto leading-relaxed"
                  />
                </div>

                {/* Location input */}
                <AnimatePresence>
                  {showLocationInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="relative">
                        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Delhi, Mumbai, Goa..."
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 transition-all"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Media preview — below editor, never overlapping */}
                <AnimatePresence>
                  {preview && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="relative rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm bg-black"
                    >
                      {file?.type.startsWith("video/") ? (
                        <video
                          src={preview}
                          className="w-full max-h-60 object-contain"
                          controls
                          preload="none"
                        />
                      ) : (
                        <img
                          src={preview}
                          className="w-full max-h-60 object-cover"
                          alt="Preview"
                          decoding="async"
                        />
                      )}
                      {/* Remove media button */}
                      <button
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors active:scale-90"
                        aria-label="Remove media"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                      {/* Add more button */}
                      <label
                        htmlFor="add-more-picker"
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 bg-black/60 text-white text-[11px] font-bold rounded-full cursor-pointer hover:bg-indigo-600 transition-colors"
                      >
                        <ImageIcon size={11} /> Add More
                        <input
                          id="add-more-picker"
                          type="file"
                          className="hidden"
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                        />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Quick action bar */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {/* Photo / Video */}
                  <label
                    htmlFor="gallery-picker"
                    className="flex-none flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[12px] font-bold cursor-pointer hover:bg-blue-100 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  >
                    <ImageIcon size={15} /> Photo/Video
                    <input
                      id="gallery-picker"
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                    />
                  </label>

                  {/* Camera */}
                  <label
                    htmlFor="camera-picker"
                    className="flex-none flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-bold cursor-pointer hover:bg-emerald-100 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  >
                    <Camera size={15} /> Camera
                    <input
                      id="camera-picker"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      ref={cameraInputRef}
                    />
                  </label>

                  {/* Video */}
                  <label
                    htmlFor="video-picker"
                    className="flex-none flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-[12px] font-bold cursor-pointer hover:bg-red-100 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  >
                    <Video size={15} /> Reel
                    <input
                      id="video-picker"
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={handleFileChange}
                      ref={videoInputRef}
                    />
                  </label>

                  {/* Location */}
                  <button
                    onClick={() => setShowLocationInput((p) => !p)}
                    className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95 transition-all touch-manipulation whitespace-nowrap ${
                      showLocationInput
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <MapPin size={15} />
                    {showLocationInput ? "Hide" : "Location"}
                  </button>

                  {/* Emoji hint */}
                  <button
                    onClick={() => setContent((p) => p + " 😊")}
                    className="flex-none flex items-center gap-1.5 px-3 py-2 bg-yellow-50 text-yellow-600 rounded-xl text-[12px] font-bold hover:bg-yellow-100 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  >
                    <Smile size={15} /> Emoji
                  </button>
                </div>

                {/* AI Suggestion Panel — full feature preserved */}
                <SuggestionPanel
                  suggestions={suggestions}
                  loading={suggestLoading}
                  error={suggestError}
                  onRefresh={refresh}
                  onUseCaption={handleUseCaption}
                  onAddHashtags={handleAddHashtags}
                  onReplaceContent={handleReplaceContent}
                  existingText={content}
                  onCollapse={() => {}}
                />

                {/* Bottom padding so content clears sticky footer */}
                <div className="h-2" />
              </div>

              {/* ── Sticky Footer ─────────────────────────────────── */}
              <div className="flex-none border-t border-slate-100 bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* Save Draft */}
                  <button
                    onClick={handleSaveDraft}
                    disabled={!content && !file}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 active:scale-95 transition-all touch-manipulation"
                  >
                    <BookmarkPlus size={16} />
                    <span className="hidden xs:inline">Save Draft</span>
                  </button>

                  {/* Post Now — primary CTA */}
                  <button
                    onClick={handlePost}
                    disabled={!canPost}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-95 transition-all touch-manipulation"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span className="truncate">{loadingMsg}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <Send size={16} />
                        Post Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePost;
