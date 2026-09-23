import { useState, useEffect, useRef, useMemo } from "react";
import {
  Image as ImageIcon,
  X,
  ArrowLeft,
  Send,
  Loader2,
  Globe,
  Users,
  Sparkles,
  Gift,
  ChevronDown,
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
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { getSmartPostAsset } from "@/utils/smartAssets";

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
  const [surpriseEnabled, setSurpriseEnabled] = useState(false);
  const [surpriseTargetId, setSurpriseTargetId] = useState("");
  const [surpriseCustomMessage, setSurpriseCustomMessage] = useState("");
  const [surpriseGifUrl, setSurpriseGifUrl] = useState("");

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
  const friendCandidates = useMemo(
    () => candidates.filter(c => c.kind === "friend"),
    [candidates],
  );

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      setPreview(URL.createObjectURL(initialFile));
    }
  }, [initialFile]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setFile(null);
      setPreview(null);
      setVisibility("public");
      setLoadingMsg("Post Vibe");
       setSurpriseEnabled(false);
       setSurpriseTargetId("");
       setSurpriseCustomMessage("");
       setSurpriseGifUrl("");
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
      const surpriseTarget = surpriseEnabled
        ? friendCandidates.find((candidate) => candidate.id === surpriseTargetId)
        : null;

      if (surpriseEnabled) {
        if (!user?.id || !surpriseTarget) {
          toast.error("Surprise Tag ke liye apne friends mein se kisi ko choose karo.");
          setLoading(false);
          return;
        }
        if (!surpriseCustomMessage.trim()) {
          toast.error("Surprise message likho.");
          setLoading(false);
          return;
        }

        // Re-check the relationship at publish time. The composer list may be
        // stale if the friendship changed while this modal was open.
        const { data: friendshipRows, error: friendshipError } = await supabase
          .from("friendships")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${surpriseTarget.id}),and(sender_id.eq.${surpriseTarget.id},receiver_id.eq.${user.id})`,
          )
          .limit(1);
        if (friendshipError || !friendshipRows?.length) {
          toast.error("Surprise Tag sirf connected friends ko bhej sakte ho.");
          setLoading(false);
          return;
        }
      }

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
      let smartAssetSource: "keyword" | "fallback" | null = null;
      let smartAssetKey: string | null = null;

      if (!file) {
        const detection = getMediaInfoFromUrl(content);
        finalMediaUrl = detection.finalUrl;
        mediaType = detection.type;
        isYoutube = detection.isYoutube;
      }

      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        finalMediaUrl = await uploadToCloudinary(file);
        isYoutube = false;
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

      // User-selected media always wins. Only text-only posts without an
      // existing direct/YouTube media URL receive an automatic image.
      if (!file && !finalMediaUrl) {
        const smartAsset = getSmartPostAsset(cleanContent);
        finalMediaUrl = smartAsset.url;
        mediaType = smartAsset.type;
        smartAssetSource = smartAsset.source;
        smartAssetKey = smartAsset.key;
      }

      setLoadingMsg("Optimizing SEO & Posting…");
      const seo = await generatePostSEO(cleanContent);

      const postPayload = {
        author_id: user?.id || userProfile?.id,
        content: cleanContent,
        media_url: finalMediaUrl,
        author: authorName,
        type: mediaType,
        post_type: "fame",
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
          smart_asset_source: smartAssetSource,
          smart_asset_key: smartAssetKey,
          // SEO also stored inside metadata as fallback in case columns aren't migrated yet
          meta_title: seo.meta_title,
          meta_description: seo.meta_description,
          seo_keywords: seo.seo_keywords,
          author_avatar:
            userProfile?.avatar_url ||
            (user as any)?.user_metadata?.picture ||
            (user as any)?.user_metadata?.avatar_url ||
            "",
          ...(surpriseTarget
            ? {
                surpriseMsg: {
                  targetUserId: surpriseTarget.id,
                  targetUserName: surpriseTarget.name,
                  customMessage: surpriseCustomMessage.trim(),
                  gifUrl: surpriseGifUrl.trim(),
                  isSeen: false,
                },
              }
            : {}),
        },
      };

      // Try full payload first; if schema cache rejects extra columns, fall back
      // to the safe minimal payload so the post always goes through.
      let inserted: any = null;
      let insertError: any = null;

      ({ data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert([postPayload])
        .select("*")
        .maybeSingle());

      if (insertError) {
        const isColumnMismatch =
          insertError.code === "PGRST204" ||
          insertError.code === "42703" ||
          insertError.message?.toLowerCase().includes("column") ||
          insertError.message?.toLowerCase().includes("schema cache");

        if (isColumnMismatch) {
          console.warn(
            "[CreatePost] Column mismatch — retrying with safe payload. Error:",
            insertError.message,
            "Full payload was:",
            postPayload,
          );
          // Minimal safe payload — only columns guaranteed to exist
          const safePayload = {
            author_id: postPayload.author_id,
            content:   postPayload.content,
            media_url: postPayload.media_url,
            author:    postPayload.author,
            type:      postPayload.type,
            visibility: postPayload.visibility,
            is_admin_post: postPayload.is_admin_post,
            metadata:  postPayload.metadata,
          };
          ({ data: inserted, error: insertError } = await supabase
            .from("posts")
            .insert([safePayload])
            .select("*")
            .maybeSingle());
        } else {
          console.error("[CreatePost] posts insert failed — payload:", postPayload, "error:", insertError);
        }
      }

      if (insertError) throw insertError;

      // Update the mounted feed immediately after Supabase accepts the post.
      // The feed listener also writes this object into its cache, so the new
      // post remains visible when the composer closes without a manual refresh.
      const createdAt = new Date().toISOString();
      window.dispatchEvent(new CustomEvent("flicks:post-created", {
        detail: {
          ...(inserted || {}),
          id: inserted?.id ?? `local-${Date.now()}`,
          author_id: inserted?.author_id ?? postPayload.author_id,
          author: inserted?.author ?? authorName,
          author_profile: {
            full_name: authorName,
            avatar_url: postPayload.metadata.author_avatar || null,
          },
          content: inserted?.content ?? postPayload.content,
          media_url: inserted?.media_url ?? postPayload.media_url,
          image_url: inserted?.image_url ?? postPayload.media_url,
          type: inserted?.type ?? postPayload.type,
          visibility: inserted?.visibility ?? postPayload.visibility,
          metadata: inserted?.metadata ?? postPayload.metadata,
           surpriseMsg:
             inserted?.metadata?.surpriseMsg ??
             postPayload.metadata.surpriseMsg ??
             null,
          created_at: inserted?.created_at ?? createdAt,
          likes_count: inserted?.likes_count ?? 0,
          comments_count: inserted?.comments_count ?? 0,
          shares_count: inserted?.shares_count ?? 0,
          views_count: inserted?.views_count ?? 0,
        },
      }));

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[998] bg-slate-950/25 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[999] flex items-end justify-center pointer-events-none sm:items-center">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-[2rem] border border-white bg-white shadow-[0_24px_80px_rgba(23,37,84,0.14)] sm:max-w-lg sm:rounded-[2rem]"
              style={{ maxHeight: "92dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <span className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-[#E9FBEF]/80 blur-[72px]" />
                <span className="absolute -bottom-28 -left-24 h-60 w-60 rounded-full bg-[#FFE8EC]/65 blur-[72px]" />
                <span className="absolute -left-16 top-28 h-28 w-28 rounded-full bg-[#FFE8EC]/35 blur-[54px]" />
              </div>

              {/* Reference layout header: back arrow and centered title. */}
              <header className="relative z-10 flex h-[4.75rem] flex-none items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#172554] transition hover:bg-[#FFF0F2] active:scale-90 touch-manipulation"
                >
                  <ArrowLeft size={22} strokeWidth={2.25} />
                </button>
                <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[22px] font-black tracking-[-0.03em] text-[#172554]">
                  Create a Post
                </h1>
                <span className="mr-1 h-3 w-3 rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" aria-label="Online" />
              </header>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-7">
                  {/* Dynamic user information and the real privacy selector. */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-[3.7rem] w-[3.7rem] shrink-0 rounded-full bg-[conic-gradient(from_210deg,#FF3B4D,#FFB0B8,#22C55E,#FF3B4D)] p-[3px]">
                        <div className="h-full w-full rounded-full bg-white p-[2px]">
                          <img
                            src={
                              userProfile?.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name || "User")}&background=172554&color=fff`
                            }
                            className="h-full w-full rounded-full object-cover"
                            alt="Avatar"
                            decoding="async"
                          />
                        </div>
                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-white bg-[#22C55E]" aria-hidden="true" />
                      </div>
                      <p className="truncate text-[20px] font-black tracking-[-0.02em] text-[#172554]">
                        {userProfile?.full_name || "You"}
                      </p>
                    </div>

                    <div className="relative shrink-0">
                      <Globe size={19} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#172554]" />
                      <select
                        aria-label="Post privacy"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as "public" | "friends_only")}
                        className="h-12 appearance-none rounded-full border border-slate-200 bg-white py-2 pl-10 pr-10 text-[16px] font-semibold text-[#172554] shadow-[0_4px_14px_rgba(23,37,84,0.05)] outline-none transition focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="public">Public</option>
                        <option value="friends_only">Friends</option>
                      </select>
                      <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#172554]" />
                    </div>
                  </div>

                  <AnimatePresence>
                    {visibility === "public" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-[#FFF9EA] px-3 py-2.5"
                      >
                        <span className="mt-0.5 text-sm text-amber-500">⚠️</span>
                        <p className="text-[11px] font-semibold leading-snug text-amber-800">
                          You're posting publicly. Make sure your content follows community guidelines.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Spacious editor with the reference's vertical red/green accent. */}
                  <div className="flex min-h-[11rem] gap-3 rounded-2xl bg-white py-3">
                    <span className="w-1 shrink-0 rounded-full bg-gradient-to-b from-[#FF3B4D] via-[#FF6B7A] to-[#22C55E]" aria-hidden="true" />
                    <MentionInput
                      autoFocus
                      value={content}
                      onChange={setContent}
                      candidates={candidates}
                      placeholder="What's on your mind?"
                      className="w-full min-h-[10rem] resize-none bg-transparent px-0.5 text-[20px] font-medium leading-relaxed text-[#172554] placeholder:text-slate-400 outline-none pointer-events-auto"
                    />
                  </div>

                  <AnimatePresence>
                    {showLocationInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="relative">
                          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF3B4D]" />
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Delhi, Mumbai, Goa..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-medium text-[#172554] outline-none transition-all focus:border-[#FF6B7A] focus:ring-2 focus:ring-[#FFE8EC]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {preview && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-[0_10px_30px_rgba(23,37,84,0.10)]"
                      >
                        {file?.type.startsWith("video/") ? (
                          <video src={preview} className="max-h-60 w-full object-contain" controls preload="none" />
                        ) : (
                          <img src={preview} className="max-h-60 w-full object-cover" alt="Preview" decoding="async" />
                        )}
                        <button
                          type="button"
                          onClick={() => { setFile(null); setPreview(null); }}
                          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/65 text-white transition-colors hover:bg-[#FF3B4D] active:scale-90"
                          aria-label="Remove media"
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                        <label
                          htmlFor="add-more-picker"
                          className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-full bg-slate-950/65 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#FF3B4D]"
                        >
                          <ImageIcon size={11} /> Add More
                          <input id="add-more-picker" type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Surprise Tag card: collapsed by default, expanded inputs remain unchanged. */}
                  <div className="rounded-[1.35rem] border border-[#FF3B4D]/20 bg-gradient-to-br from-white via-[#FFF8FA] to-[#FFE8EC]/70 p-1 shadow-[0_12px_30px_rgba(255,59,77,0.08)]">
                    <button
                      type="button"
                      onClick={() => setSurpriseEnabled((enabled) => !enabled)}
                      className="flex min-h-[6.4rem] w-full items-center justify-between gap-3 rounded-[1.1rem] border-l-4 border-[#FF3B4D] px-4 py-3 text-left transition-colors hover:bg-white/70"
                      aria-pressed={surpriseEnabled}
                    >
                      <span className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFE8EC] text-[#FF3B4D] shadow-[0_6px_16px_rgba(255,59,77,0.12)]">
                          <Gift size={27} strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[19px] font-black tracking-[-0.02em] text-[#172554]">
                            Add Surprise Tag
                          </span>
                          <span className="mt-0.5 block text-[14px] font-medium text-slate-500">
                            Tag someone for a surprise
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        size={23}
                        className={`shrink-0 text-[#172554] transition-transform ${surpriseEnabled ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {surpriseEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -4 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -4 }}
                          className="space-y-2 overflow-hidden px-4 pb-4 pt-2"
                        >
                          <label className="block text-[11px] font-black uppercase tracking-wide text-[#D92B3D]">
                            Choose a friend
                            <select
                              value={surpriseTargetId}
                              onChange={(e) => setSurpriseTargetId(e.target.value)}
                              className="mt-1.5 w-full rounded-xl border border-[#FF3B4D]/15 bg-white px-3 py-2.5 text-sm font-bold text-[#172554] outline-none focus:border-[#FF6B7A] focus:ring-2 focus:ring-[#FFE8EC]"
                            >
                              <option value="">
                                {friendCandidates.length ? "Select a connected friend" : "No connected friends found"}
                              </option>
                              {friendCandidates.map((friend) => (
                                <option key={friend.id} value={friend.id}>
                                  {friend.name} · @{friend.username}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[11px] font-black uppercase tracking-wide text-[#D92B3D]">
                            Custom message
                            <textarea
                              value={surpriseCustomMessage}
                              onChange={(e) => setSurpriseCustomMessage(e.target.value)}
                              rows={2}
                              maxLength={240}
                              placeholder="Write something special..."
                              className="mt-1.5 w-full resize-none rounded-xl border border-[#FF3B4D]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#172554] outline-none focus:border-[#FF6B7A] focus:ring-2 focus:ring-[#FFE8EC]"
                            />
                          </label>
                          <label className="block text-[11px] font-black uppercase tracking-wide text-[#D92B3D]">
                            GIF URL <span className="font-medium normal-case text-slate-400">(optional)</span>
                            <input
                              type="url"
                              value={surpriseGifUrl}
                              onChange={(e) => setSurpriseGifUrl(e.target.value)}
                              placeholder="https://media.giphy.com/..."
                              className="mt-1.5 w-full rounded-xl border border-[#FF3B4D]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#172554] outline-none focus:border-[#FF6B7A] focus:ring-2 focus:ring-[#FFE8EC]"
                            />
                          </label>
                          <p className="text-[10px] font-semibold text-[#D92B3D]/70">
                            Only accepted friends appear here, and the relationship is checked again when you post.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* The reference leaves breathing room before the AI card. */}
                  <div className="h-16 sm:h-24" aria-hidden="true" />

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
                </div>

                {/* Fixed bottom action tray with the reference icon layout. */}
                <div className="relative z-10 flex-none border-t border-slate-200/80 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_28px_rgba(23,37,84,0.07)] backdrop-blur-md sm:px-5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="relative flex min-w-0 flex-1 flex-col items-center">
                      <label
                        htmlFor="gallery-picker"
                        className="flex min-h-12 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[#2563EB] transition hover:bg-blue-50 active:scale-95 touch-manipulation"
                      >
                        <ImageIcon size={22} strokeWidth={2} />
                        <span className="text-[11px] font-semibold text-slate-500">Photo</span>
                        <input id="gallery-picker" type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} />
                      </label>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        aria-label="Open camera"
                        className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                      >
                        <Camera size={11} />
                      </button>
                      <input
                        id="camera-picker"
                        ref={cameraInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                      />
                    </div>

                    <label
                      htmlFor="video-picker"
                      className="flex min-h-12 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[#E83E8C] transition hover:bg-[#FFF0F7] active:scale-95 touch-manipulation"
                    >
                      <Video size={22} strokeWidth={2} />
                      <span className="text-[11px] font-semibold text-slate-500">Reel</span>
                      <input id="video-picker" type="file" className="hidden" accept="video/*" onChange={handleFileChange} ref={videoInputRef} />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowLocationInput((p) => !p)}
                      className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95 touch-manipulation ${
                        showLocationInput ? "bg-[#FFF0F2] text-[#FF3B4D]" : "text-[#FF3B4D] hover:bg-[#FFF0F2]"
                      }`}
                    >
                      <MapPin size={22} strokeWidth={2} />
                      <span className="text-[11px] font-semibold text-slate-500">Location</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setContent((p) => p + " 😊")}
                      className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-amber-500 transition hover:bg-amber-50 active:scale-95 touch-manipulation"
                    >
                      <Smile size={22} strokeWidth={2} />
                      <span className="text-[11px] font-semibold text-slate-500">Emoji</span>
                    </button>

                    {Boolean(content || file) && (
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        aria-label="Save draft"
                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:scale-95 touch-manipulation"
                      >
                        <BookmarkPlus size={18} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={!canPost}
                      className="flex min-h-12 min-w-[7.2rem] flex-[1.65] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#3B82F6] px-4 text-[15px] font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.23)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="shrink-0 animate-spin" />
                          <span className="truncate">{loadingMsg}</span>
                        </>
                      ) : (
                        <>
                          <span>Post Now</span>
                          <Send size={18} strokeWidth={2.2} />
                        </>
                      )}
                    </button>
                  </div>
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
