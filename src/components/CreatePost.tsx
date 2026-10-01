import { useState, useEffect, useRef, useMemo } from "react";
import {
  Image as ImageIcon,
  X,
  ArrowLeft,
  Send,
  Loader2,
  Globe,
  BarChart3,
  Gift,
  ChevronDown,
  MapPin,
  Smile,
  Camera,
  BookmarkPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import MentionInput, { MentionCandidate } from "./MentionInput";
import { extractMentionTokens, nameToUsername, Mention } from "@/lib/mentions";
import { sanitizeText } from "@/lib/profanityFilter";
import { generatePostSEO } from "@/lib/geminiClient";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { getSmartPostAsset } from "@/utils/smartAssets";
import {
  resolveVibeSelection,
  VIBE_PROFILES,
  type VibeOverride,
} from "@/lib/vibeMatcher";

interface CreatePostProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  initialFile?: File | null;
  onReelSelected?: (file: File) => void;
}

const CreatePost = ({
  isOpen,
  onClose,
  userProfile,
  initialFile,
  onReelSelected,
}: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [vibeOverride, setVibeOverride] = useState<VibeOverride>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewUrlsRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Post Vibe");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [visibility, setVisibility] = useState<"public" | "friends_only">("public");
  const [mood, setMood] = useState("");
  const [location, setLocation] = useState<string>("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [surpriseEnabled, setSurpriseEnabled] = useState(false);
  const [surpriseTargetId, setSurpriseTargetId] = useState("");
  const [surpriseCustomMessage, setSurpriseCustomMessage] = useState("");
  const [surpriseGifUrl, setSurpriseGifUrl] = useState("");

  const replaceMediaSelection = (nextFiles: File[]) => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const nextPreviews = nextFiles.map((selectedFile) =>
      URL.createObjectURL(selectedFile),
    );
    previewUrlsRef.current = nextPreviews;
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  const clearMediaSelection = () => replaceMediaSelection([]);

  // Load friends + first circle members for mention candidates (memoized fetch).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid) return;
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
      replaceMediaSelection([initialFile]);
    }
  }, [initialFile]);

  useEffect(() => {
    return () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setVibeOverride(null);
      clearMediaSelection();
      setVisibility("public");
      setMood("");
      setPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
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
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length) {
      const videoFile = selectedFiles.find((selectedFile) =>
        selectedFile.type.startsWith("video/"),
      );
      if (videoFile) {
        onReelSelected?.(videoFile);
        onClose();
        e.target.value = "";
        return;
      }
      const imageFiles = selectedFiles.filter((selectedFile) =>
        selectedFile.type.startsWith("image/"),
      );
      const nextFiles = [...files, ...imageFiles].slice(0, 5);
      if (files.length + imageFiles.length > 5) {
        toast.info("You can add up to 5 images per post.");
      }
      replaceMediaSelection(nextFiles);
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (!isOpen) {
      setLocation("");
      setShowLocationInput(false);
    }
  }, [isOpen]);

  const handleSaveDraft = () => {
    if (!content.trim() && !files.length) return;
    toast.success("Draft saved!", { duration: 2000 });
    onClose();
  };

  const handleCreateSurvey = async () => {
    if (loading) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!question) {
      toast.error("Add a question for your poll.");
      return;
    }
    if (options.length < 2) {
      toast.error("Add at least two poll choices.");
      return;
    }

    setLoading(true);
    setLoadingMsg("Publishing poll…");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Sign in to publish a poll.");

      const { data: survey, error: surveyError } = await supabase
        .from("surveys")
        .insert({
          question,
          image_url: null,
          user_id: user.id,
        })
        .select("id, question, user_id, created_at")
        .single();
      if (surveyError || !survey) {
        throw surveyError || new Error("The poll could not be created.");
      }

      const { error: optionsError } = await supabase
        .from("survey_options")
        .insert(options.map((text) => ({ survey_id: survey.id, text })));
      if (optionsError) {
        const { error: cleanupError } = await supabase
          .from("surveys")
          .delete()
          .eq("id", survey.id)
          .eq("user_id", user.id);
        if (cleanupError) {
          console.error("[CreatePost] Could not clean up incomplete survey:", cleanupError);
        }
        throw optionsError;
      }

      window.dispatchEvent(new CustomEvent("flicks:survey-created", {
        detail: { ...survey, options },
      }));
      toast.success("Poll published!");
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollEnabled(false);
      onClose();
    } catch (err: any) {
      console.error("[CreatePost] Poll publish failed:", err);
      toast.error(err?.message || "Poll could not be published.");
    } finally {
      setLoading(false);
      setLoadingMsg("Post Vibe");
    }
  };

  const handlePost = async () => {
    if (loading) return;
    if (pollEnabled) {
      await handleCreateSurvey();
      return;
    }
    if (!content.trim() && !files.length) return;
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
      let imageUrls: string[] = [];

      if (!files.length) {
        const detection = getMediaInfoFromUrl(content);
        finalMediaUrl = detection.finalUrl;
        mediaType = detection.type;
        isYoutube = detection.isYoutube;
      }

      if (files.length) {
        if (files[0].type.startsWith("video/")) {
          mediaType = "video";
          finalMediaUrl = await uploadToCloudinary(files[0]);
        } else {
          mediaType = "image";
          setLoadingMsg(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}…`);
          imageUrls = await Promise.all(
            files.map((selectedFile) => uploadToCloudinary(selectedFile)),
          );
          finalMediaUrl = imageUrls[0] || "";
        }
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
      const postVibe = resolveVibeSelection(cleanContent, vibeOverride);

      // User-selected media always wins. Only text-only posts without an
      // existing direct/YouTube media URL receive an automatic image.
      if (!files.length && !finalMediaUrl) {
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
        image_urls: imageUrls.length ? imageUrls : null,
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
          vibe_tag: postVibe.primary?.tag ?? null,
          vibe_matches: postVibe.matches.map((profile) => profile.tag),
          vibe_manual: postVibe.manual,
          vibe_audio_url: postVibe.primary?.audioUrl ?? null,
          mentions: resolvedMentions,
          has_pin: hasPin,
          has_team: hasTeam,
          mood: mood || null,
          location: location.trim() || null,
          smart_asset_source: smartAssetSource,
          smart_asset_key: smartAssetKey,
          ...(imageUrls.length ? { image_urls: imageUrls } : {}),
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
           image_urls:
             inserted?.image_urls ??
             postPayload.image_urls ??
             postPayload.metadata.image_urls ??
             null,
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
      clearMediaSelection();
      onClose();
    } catch (err: any) {
      console.error("Error Details:", err);
      toast.error(`Error: ${err.message || "Post failed."}`);
    } finally {
      setLoading(false);
      setLoadingMsg("Post Vibe");
    }
  };

  const validPollOptionCount = pollOptions.filter((option) => option.trim()).length;
  const canPost = !loading && (pollEnabled
    ? Boolean(pollQuestion.trim()) && validPollOptionCount >= 2
    : Boolean(content.trim()) || files.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[998] bg-slate-950/55 backdrop-blur-[6px]"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[999] flex items-start justify-center pointer-events-none sm:items-center">
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="pointer-events-auto relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-transparent bg-white shadow-[0_24px_80px_rgba(23,37,84,0.14)] sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-[2rem]"
              style={{
                border: "1px solid transparent",
                background: "linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#e879f9,#60a5fa,#22d3ee) border-box",
                boxShadow: "0 24px 80px rgba(23,37,84,.18), 0 0 32px rgba(139,92,246,.16)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <span className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-[#E9FBEF]/80 blur-[72px]" />
                <span className="absolute -bottom-28 -left-24 h-60 w-60 rounded-full bg-[#FFE8EC]/65 blur-[72px]" />
                <span className="absolute -left-16 top-28 h-28 w-28 rounded-full bg-[#FFE8EC]/35 blur-[54px]" />
              </div>

              <header className="relative z-10 flex h-[4.25rem] flex-none items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
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
                {Boolean(content || files.length) ? (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    aria-label="Save draft"
                    data-testid="button-save-draft"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95"
                  >
                    <BookmarkPlus size={19} />
                  </button>
                ) : (
                  <span className="mr-1 h-3 w-3 rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" aria-label="Online" />
                )}
              </header>

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 sm:px-7">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative h-12 w-12 shrink-0 rounded-full bg-[conic-gradient(from_210deg,#d946ef,#60a5fa,#22d3ee,#d946ef)] p-[2.5px] shadow-[0_0_18px_rgba(139,92,246,.22)]">
                      <div className="h-full w-full rounded-full bg-white p-[2px]">
                        <img
                          src={
                            userProfile?.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.full_name || "User")}&background=172554&color=fff`
                          }
                          className="h-full w-full rounded-full object-cover"
                          alt={`${userProfile?.full_name || "Your"} avatar`}
                          decoding="async"
                          data-testid="img-avatar-create-post"
                        />
                      </div>
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2px] border-white bg-[#22C55E]" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#172554]">
                        {userProfile?.full_name || "Your post"}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        Write something worth sharing
                      </p>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-add-media"
                        className="flex h-[3.35rem] min-w-[6.25rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-600 to-sky-500 px-3 text-[12px] font-extrabold leading-tight text-white shadow-[0_8px_22px_rgba(124,58,237,.32)] transition hover:brightness-105 active:scale-95 sm:min-w-[7.5rem] sm:px-4 sm:text-sm"
                      >
                        <Camera size={20} strokeWidth={2.4} />
                        <span>Media /<br className="sm:hidden" /> Photo</span>
                      </button>
                      <input
                        id="gallery-picker"
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                      />
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        aria-label="Open camera"
                        data-testid="button-open-camera"
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-md"
                      >
                        <Camera size={12} />
                      </button>
                    </div>
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

                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[#fffefa] shadow-inner transition focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100/70">
                    <div className="flex items-center justify-between px-4 pb-1 pt-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-500">
                        Your notebook
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        Take your time
                      </span>
                    </div>
                    <div className="relative">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(148,163,184,.24) 27px, rgba(148,163,184,.24) 28px)",
                          backgroundSize: "100% 28px",
                        }}
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-0 left-8 top-0 w-px bg-rose-200/80"
                      />
                      <MentionInput
                        autoFocus
                        value={content}
                        onChange={setContent}
                        candidates={candidates}
                        placeholder="Share your vibe today..."
                        className="relative z-[1] box-border h-[min(38dvh,24rem)] min-h-[12rem] max-h-[42dvh] w-full resize-none overflow-y-auto border-0 bg-transparent py-2.5 pl-11 pr-4 text-[16px] font-medium leading-7 text-[#172554] placeholder:text-slate-400 outline-none pointer-events-auto"
                        testId="input-post-content"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-violet-700">
                      <span>Vibe</span>
                      <select
                        aria-label="Choose post vibe"
                        value={vibeOverride ?? "auto"}
                        onChange={(event) => {
                          const value = event.target.value;
                          setVibeOverride(value === "auto" ? null : value as VibeOverride);
                        }}
                        className="max-w-[10rem] rounded-full border border-violet-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-violet-800 outline-none focus:ring-2 focus:ring-violet-300"
                      >
                        <option value="auto">Automatic</option>
                        <option value="none">No vibe</option>
                        {VIBE_PROFILES.map((profile) => (
                          <option key={profile.tag} value={profile.tag}>
                            {profile.icon} {profile.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex gap-2.5 sm:gap-3">
                    <label className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-violet-50 px-3 py-2.5 shadow-[0_5px_16px_rgba(168,85,247,.09)] focus-within:ring-4 focus-within:ring-fuchsia-100">
                      <Smile size={21} className="shrink-0 text-violet-600" />
                      <select
                        aria-label="Post mood"
                        data-testid="select-post-mood"
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        className="min-w-0 flex-1 appearance-none bg-transparent text-[14px] font-bold text-violet-800 outline-none"
                      >
                        <option value="">Mood</option>
                        <option value="happy">Happy 😄</option>
                        <option value="excited">Excited 🤩</option>
                        <option value="grateful">Grateful 🙏</option>
                        <option value="chill">Chill 😌</option>
                        <option value="thoughtful">Thoughtful 🤔</option>
                        <option value="inspired">Inspired ✨</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none shrink-0 text-violet-600" />
                    </label>

                    <label className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full border border-sky-200 bg-gradient-to-r from-sky-50 to-blue-50 px-3 py-2.5 shadow-[0_5px_16px_rgba(59,130,246,.08)] focus-within:ring-4 focus-within:ring-sky-100">
                      <Globe size={20} className="shrink-0 text-blue-600" />
                      <select
                        aria-label="Post audience"
                        data-testid="select-post-audience"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as "public" | "friends_only")}
                        className="min-w-0 flex-1 appearance-none bg-transparent text-[14px] font-bold text-blue-900 outline-none"
                      >
                        <option value="public">Public &amp; Friends</option>
                        <option value="friends_only">Friends only</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none shrink-0 text-blue-700" />
                    </label>
                  </div>

                  <AnimatePresence initial={false}>
                    {pollEnabled && (
                      <motion.section
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        className="overflow-hidden rounded-[1.35rem] border border-fuchsia-200/90 bg-gradient-to-br from-white via-fuchsia-50/70 to-sky-50/80 p-4 shadow-[0_10px_28px_rgba(139,92,246,.12)]"
                        aria-label="Create a poll"
                      >
                        <div className="mb-3 flex items-center gap-2 text-violet-800">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-[0_5px_16px_rgba(139,92,246,.28)]">
                            <BarChart3 size={18} />
                          </span>
                          <div>
                            <h2 className="text-sm font-black">Poll &amp; Survey</h2>
                            <p className="text-[11px] font-medium text-slate-500">Add a question and at least two choices.</p>
                          </div>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">
                          Question
                          <textarea
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            maxLength={240}
                            rows={2}
                            placeholder="What would you like to ask?"
                            data-testid="input-poll-question"
                            className="mt-1.5 w-full resize-none rounded-xl border border-violet-200 bg-white/90 px-3 py-2.5 text-sm font-semibold text-[#172554] outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                          />
                        </label>
                        <div className="mt-3 space-y-2">
                          {pollOptions.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => setPollOptions((current) =>
                                  current.map((value, optionIndex) =>
                                    optionIndex === index ? e.target.value : value,
                                  ),
                                )}
                                maxLength={120}
                                placeholder={`Choice ${index + 1}`}
                                aria-label={`Poll choice ${index + 1}`}
                                data-testid={`input-poll-option-${index + 1}`}
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm font-medium text-[#172554] outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                              />
                              {pollOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setPollOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}
                                  aria-label={`Remove choice ${index + 1}`}
                                  data-testid={`button-remove-poll-option-${index + 1}`}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPollOptions((current) => current.length < 6 ? [...current, ""] : current)}
                          disabled={pollOptions.length >= 6}
                          data-testid="button-add-poll-option"
                          className="mt-3 rounded-full border border-violet-200 bg-white/80 px-3.5 py-2 text-xs font-extrabold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          + Add choice
                        </button>
                      </motion.section>
                    )}
                  </AnimatePresence>

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
                            data-testid="input-post-location"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-medium text-[#172554] outline-none transition-all focus:border-[#FF6B7A] focus:ring-2 focus:ring-[#FFE8EC]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {previews.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-[0_10px_30px_rgba(23,37,84,0.10)]"
                      >
                        <div className={`grid gap-1.5 p-1.5 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {previews.map((previewUrl, index) => (
                            <div
                              key={previewUrl}
                              className={`relative overflow-hidden rounded-xl bg-slate-900 ${previews.length === 1 ? "aspect-[16/10]" : "aspect-square"}`}
                            >
                              {files[index]?.type.startsWith("video/") ? (
                                <video src={previewUrl} className="h-full w-full object-contain" controls preload="none" />
                              ) : (
                                <img src={previewUrl} className="h-full w-full object-cover" alt={`Selected image ${index + 1}`} decoding="async" />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
                                  const removedPreview = previews[index];
                                  if (removedPreview) URL.revokeObjectURL(removedPreview);
                                  const nextPreviews = previews.filter((_, previewIndex) => previewIndex !== index);
                                  previewUrlsRef.current = nextPreviews;
                                  setFiles(nextFiles);
                                  setPreviews(nextPreviews);
                                }}
                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white transition-colors hover:bg-[#FF3B4D] active:scale-90"
                                aria-label={`Remove image ${index + 1}`}
                                data-testid={`button-remove-media-${index + 1}`}
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {files.length > 1 && (
                          <p className="px-3 pb-1 text-[11px] font-bold text-white/75">
                            {files.length}/5 images selected
                          </p>
                        )}
                        <label
                          htmlFor="add-more-picker"
                          data-testid="label-add-more-media"
                          className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-full bg-slate-950/70 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#FF3B4D]"
                        >
                          <ImageIcon size={11} /> Add More
                          <input id="add-more-picker" type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} data-testid="input-add-more-media" />
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* The bottom-row Surprise action reveals these friend-tag fields. */}
                  {surpriseEnabled && (
                  <div className="rounded-[1.35rem] border border-[#FF3B4D]/20 bg-gradient-to-br from-white via-[#FFF8FA] to-[#FFE8EC]/70 p-1 shadow-[0_12px_30px_rgba(255,59,77,0.08)]">
                    <button
                      type="button"
                      onClick={() => setSurpriseEnabled((enabled) => !enabled)}
                      data-testid="button-expand-surprise-details"
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
                              data-testid="select-surprise-friend"
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
                              data-testid="input-surprise-message"
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
                              data-testid="input-surprise-gif"
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
                  )}

                </div>

                <div className="sticky bottom-0 z-20 flex-none border-t border-slate-200/80 bg-white/95 px-3 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shadow-[0_-10px_28px_rgba(23,37,84,0.09)] backdrop-blur-xl sm:px-5 sm:pt-3">
                  <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(7.1rem,1.5fr)] items-center gap-1.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setPollEnabled((enabled) => !enabled)}
                      aria-pressed={pollEnabled}
                      data-testid="button-toggle-poll"
                      className={`flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition active:scale-95 touch-manipulation ${
                        pollEnabled ? "bg-fuchsia-50 text-fuchsia-700" : "text-violet-700 hover:bg-violet-50"
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-[0_4px_12px_rgba(139,92,246,.24)]">
                        <BarChart3 size={17} strokeWidth={2.3} />
                      </span>
                      <span className="text-[10px] font-extrabold leading-[1.05] sm:text-[11px]">Poll &amp; Survey</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLocationInput((open) => !open)}
                      aria-pressed={showLocationInput}
                      data-testid="button-toggle-location"
                      className={`flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition active:scale-95 touch-manipulation ${
                        showLocationInput ? "bg-sky-50 text-sky-700" : "text-sky-700 hover:bg-sky-50"
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_4px_12px_rgba(59,130,246,.24)]">
                        <MapPin size={17} strokeWidth={2.3} />
                      </span>
                      <span className="text-[10px] font-extrabold leading-[1.05] sm:text-[11px]">Location</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSurpriseEnabled((enabled) => !enabled)}
                      aria-pressed={surpriseEnabled}
                      data-testid="button-toggle-surprise"
                      className={`flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition active:scale-95 touch-manipulation ${
                        surpriseEnabled ? "bg-rose-50 text-rose-700" : "text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-[0_4px_12px_rgba(244,63,94,.22)]">
                        <Gift size={17} strokeWidth={2.3} />
                      </span>
                      <span className="text-[10px] font-extrabold leading-[1.05] sm:text-[11px]">Surprise</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={!canPost}
                      data-testid="button-submit-post"
                      className="flex min-h-[3.75rem] min-w-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-violet-600 to-blue-500 px-3 text-[14px] font-black text-white shadow-[0_8px_22px_rgba(124,58,237,.32)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 touch-manipulation sm:px-5 sm:text-[15px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={17} className="shrink-0 animate-spin" />
                          <span className="truncate">{loadingMsg}</span>
                        </>
                      ) : (
                        <>
                          <Send size={18} strokeWidth={2.3} />
                          <span className="truncate">{pollEnabled ? "Publish Poll" : "Post"}</span>
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
