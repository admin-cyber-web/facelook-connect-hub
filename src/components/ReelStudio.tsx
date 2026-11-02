import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileVideo,
  Gauge,
  Loader2,
  Music2,
  Pause,
  PenLine,
  Play,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { uploadBunnyImage, uploadBunnyVideo } from "@/lib/bunny";
import type { BunnyVideoResult } from "@/lib/bunny";
import {
  getReelSettings,
  parseMetadata,
  REEL_FILTERS,
  type ReelFilterKey,
} from "@/lib/reelSettings";
import {
  attachReelAudioSync,
  getReelAudioTargetTime,
} from "@/lib/reelAudioSync";
import BunnyCreatorProcessingOverlay from "@/components/BunnyCreatorProcessingOverlay";
import { useBunnyVideoStatus } from "@/hooks/useBunnyVideoStatus";

export interface ReelMusicTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_url?: string | null;
}

interface ReelStudioProps {
  isOpen: boolean;
  userId: string | null;
  userProfile?: { full_name?: string | null } | null;
  initialVideoFile?: File | null;
  reel?: any | null;
  onClose: () => void;
  onSaved?: (reel: any) => void;
}

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;
const REEL_UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const REEL_SAVE_TIMEOUT_MS = 30 * 1000;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

type ReelSaveResponse = {
  data: unknown;
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  } | null;
};

const makeFallbackTracks = (): ReelMusicTrack[] => [];

const isAudioFile = (file: File) =>
  file.type === "audio/mpeg" ||
  file.type === "audio/mp3" ||
  file.name.toLowerCase().endsWith(".mp3");

const isColumnMismatch = (error: any) =>
  error?.code === "PGRST204" ||
  error?.code === "42703" ||
  error?.message?.toLowerCase().includes("column") ||
  error?.message?.toLowerCase().includes("schema cache");

const toReelRow = (row: any, fallback: Record<string, any>) => ({
  ...(row || {}),
  ...fallback,
  metadata: row?.metadata ?? fallback.metadata,
  media_url: row?.media_url ?? fallback.media_url,
  video_url: row?.video_url ?? fallback.video_url,
  audio_url: row?.audio_url ?? fallback.audio_url,
  filters: row?.filters ?? fallback.filters,
  playback_rate: row?.playback_rate ?? fallback.playback_rate,
});

export default function ReelStudio({
  isOpen,
  userId,
  userProfile,
  initialVideoFile,
  reel,
  onClose,
  onSaved,
}: ReelStudioProps) {
  const reelId = reel?._raw_id || reel?.id || null;
  const isEditing = Boolean(reelId);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);
  const captionInputWrapRef = useRef<HTMLDivElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(initialVideoFile || null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<ReelMusicTrack | null>(null);
  const [caption, setCaption] = useState(reel?.content || "");
  const [captionFocused, setCaptionFocused] = useState(false);
  const [penPosition, setPenPosition] = useState({ left: 18, top: 54 });
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [filter, setFilter] = useState<ReelFilterKey>("none");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicTracks, setMusicTracks] = useState<ReelMusicTrack[]>([]);
  const [saving, setSaving] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [uploadingBunnyVideoId, setUploadingBunnyVideoId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const bunnyUploadStatus = useBunnyVideoStatus(
    uploadingBunnyVideoId,
    saving && Boolean(uploadingBunnyVideoId),
  );

  const reelSettings = useMemo(() => getReelSettings(reel), [reel]);
  const videoPreviewUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : reelSettings.videoUrl),
    [videoFile, reelSettings.videoUrl],
  );
  const audioPreviewUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : selectedTrack?.audio_url || audioUrl),
    [audioFile, audioUrl, selectedTrack?.audio_url],
  );
  const selectedFilter = REEL_FILTERS.find((option) => option.key === filter) || REEL_FILTERS[0];
  const captionPlaceholder = "Type your video description...";

  const updatePenPosition = () => {
    const textarea = captionInputRef.current;
    const inputWrap = captionInputWrapRef.current;
    if (!textarea || !inputWrap) return;

    const textareaRect = textarea.getBoundingClientRect();
    const inputWrapRect = inputWrap.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const copiedStyles = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "letterSpacing",
      "lineHeight",
      "textIndent",
      "textTransform",
      "wordSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "boxSizing",
    ] as const;

    mirror.style.position = "fixed";
    mirror.style.left = `${textareaRect.left}px`;
    mirror.style.top = `${textareaRect.top}px`;
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    for (const property of copiedStyles) {
      mirror.style[property] = computed[property];
    }

    mirror.append(document.createTextNode(textarea.value.slice(0, textarea.selectionStart)));
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    marker.style.display = "inline-block";
    marker.style.width = "1px";
    marker.style.height = "1em";
    mirror.append(marker);
    document.body.append(mirror);
    const markerRect = marker.getBoundingClientRect();
    setPenPosition({
      left: Math.min(
        inputWrap.clientWidth - 20,
        Math.max(4, markerRect.left - inputWrapRect.left),
      ),
      top: Math.max(2, markerRect.top - inputWrapRect.top - textarea.scrollTop),
    });
    mirror.remove();
  };

  useEffect(() => {
    const fontLinkId = "reel-studio-handwriting-font";
    if (!document.getElementById(fontLinkId)) {
      const fontLink = document.createElement("link");
      fontLink.id = fontLinkId;
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap";
      document.head.append(fontLink);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(
      () => setPlaceholderIndex((index) => (index >= captionPlaceholder.length ? 0 : index + 1)),
      placeholderIndex >= captionPlaceholder.length ? 1300 : 65,
    );
    return () => window.clearTimeout(timeout);
  }, [captionPlaceholder.length, isOpen, placeholderIndex]);

  useEffect(() => {
    if (!isOpen) return;
    updatePenPosition();
    window.addEventListener("resize", updatePenPosition);
    return () => window.removeEventListener("resize", updatePenPosition);
  }, [caption, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setVideoFile(initialVideoFile || null);
    setCaption(reel?.content || "");
    setAudioFile(null);
    setSelectedTrack(null);
    setFilter(reelSettings.filter);
    setPlaybackRate(reelSettings.playbackRate);
    setAudioUrl(reelSettings.audioUrl);
    setMusicOpen(false);
    setMusicQuery("");
    setPreviewPlaying(false);
  }, [
    initialVideoFile,
    isOpen,
    reel?.content,
    reel?.id,
    reelSettings.audioUrl,
    reelSettings.filter,
    reelSettings.playbackRate,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    supabase
      .from("reel_music_tracks")
      .select("id, title, artist, audio_url, cover_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(24)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // The migration is intentionally optional during rollout. Custom
          // upload remains usable while the curated table is being seeded.
          setMusicTracks(makeFallbackTracks());
          return;
        }
        setMusicTracks((data || []) as ReelMusicTrack[]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    const video = previewVideoRef.current;
    const audio = previewAudioRef.current;
    if (!video || !isOpen) return;

    video.playbackRate = playbackRate;
    video.style.filter = selectedFilter.cssFilter;
    video.muted = true;
    if (audio) {
      audio.playbackRate = playbackRate;
      audio.loop = true;
      audio.muted = false;
    }
  }, [audioPreviewUrl, isOpen, playbackRate, selectedFilter.cssFilter]);

  useEffect(() => {
    const video = previewVideoRef.current;
    const audio = previewAudioRef.current;
    if (!video || !audio || !audioPreviewUrl) return;
    return attachReelAudioSync(video, audio, playbackRate);
  }, [audioPreviewUrl, playbackRate]);

  useEffect(() => {
    const video = previewVideoRef.current;
    const audio = previewAudioRef.current;
    if (!isOpen || !video || !audio || !audioPreviewUrl) return;

    video.muted = true;
    audio.loop = true;
    audio.muted = false;
    audio.playbackRate = playbackRate;
    if (!previewPlaying) {
      audio.pause();
      return;
    }

    let cancelled = false;
    const startSelectedTrack = () => {
      if (cancelled || !previewPlaying || audio.readyState < HTMLMediaElement.HAVE_METADATA) return;
      const expectedUrl = new URL(audioPreviewUrl, document.baseURI).href;
      if (audio.currentSrc && audio.currentSrc !== expectedUrl) return;
      void audio.play().catch(() => {});
    };

    audio.addEventListener("loadedmetadata", startSelectedTrack);
    startSelectedTrack();
    return () => {
      cancelled = true;
      audio.removeEventListener("loadedmetadata", startSelectedTrack);
    };
  }, [audioPreviewUrl, isOpen, playbackRate, previewPlaying]);

  const togglePreview = async () => {
    const video = previewVideoRef.current;
    const audio = previewAudioRef.current;
    if (!video) return;
    if (previewPlaying) {
      video.pause();
      audio?.pause();
      setPreviewPlaying(false);
      return;
    }

    video.muted = true;
    video.playbackRate = playbackRate;
    await video.play().catch(() => {});
    if (audioPreviewUrl && audio) {
      audio.muted = false;
      audio.currentTime = getReelAudioTargetTime(video, audio);
      await audio.play().catch(() => {});
    }
    setPreviewPlaying(true);
  };

  const chooseTrack = (track: ReelMusicTrack) => {
    setAudioFile(null);
    setSelectedTrack(track);
    setAudioUrl(track.audio_url);
    setMusicOpen(false);
  };

  const clearAudio = () => {
    setAudioFile(null);
    setSelectedTrack(null);
    setAudioUrl(null);
    previewAudioRef.current?.pause();
  };

  const handleAudioFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAudioFile(file)) {
      toast.error("Please choose an MP3 background track.");
      return;
    }
    setSelectedTrack(null);
    setAudioFile(file);
    setAudioUrl(null);
    setMusicOpen(false);
  };

  const handleVideoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    setVideoFile(file);
  };

  const saveReel = async () => {
    if (!userId) {
      toast.error("Please login to publish a Reel.");
      return;
    }
    if (!videoFile && !reelSettings.videoUrl) {
      toast.error("Choose a video before publishing.");
      return;
    }

    setSaving(true);
    setVideoUploadProgress(null);
    setUploadingBunnyVideoId(null);
    try {
      const withTimeout = async <T,>(
        label: string,
        timeoutMs: number,
        request: (signal: AbortSignal) => PromiseLike<T>,
      ): Promise<T> => {
        const controller = new AbortController();
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutError = new Error(
          `${label} timed out. Please check your connection and try again.`,
        );

        try {
          return await Promise.race([
            request(controller.signal),
            new Promise<T>((_, reject) => {
              timeoutId = setTimeout(() => {
                controller.abort();
                reject(timeoutError);
              }, timeoutMs);
            }),
          ]);
        } catch (error) {
          if (controller.signal.aborted) throw timeoutError;
          throw error;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      };

      const savePost = async (
        label: string,
        request: (signal: AbortSignal) => PromiseLike<ReelSaveResponse>,
      ) => {
        try {
          const result = await withTimeout(label, REEL_SAVE_TIMEOUT_MS, request);
          if (result.error) {
            console.error(`[ReelStudio] ${label} returned a database error`, result.error);
          }
          return result;
        } catch (error) {
          console.error(`[ReelStudio] ${label} failed`, error);
          throw new Error(`${label} failed: ${getErrorMessage(error)}`);
        }
      };

      let videoUpload: BunnyVideoResult | null = null;
      let audioUpload: { url: string } | null = null;
      if (videoFile) {
        setVideoUploadProgress(0);
        videoUpload = await uploadBunnyVideo(videoFile, setVideoUploadProgress);
        setUploadingBunnyVideoId(videoUpload.videoId);
        setVideoUploadProgress(null);
      }
      if (audioFile) {
        audioUpload = await uploadBunnyImage(audioFile!);
      }

      const videoUrl = videoUpload?.hlsUrl || reelSettings.videoUrl;
      const finalAudioUrl =
        audioUpload?.url || selectedTrack?.audio_url || audioUrl || null;
      if (!videoUrl) throw new Error("The video upload did not return a secure URL.");

      const existingMetadata = parseMetadata(reel?.metadata);
      const metadata = {
        ...existingMetadata,
        is_youtube: false,
        ...(videoUpload
          ? {
              bunny_video_id: videoUpload.videoId,
              bunny_library_id: videoUpload.libraryId,
            }
          : {}),
        mime_type: videoFile?.type || existingMetadata.mime_type || "video/mp4",
        reel_filter: filter,
        filters: filter,
        playback_rate: playbackRate,
        audio_url: finalAudioUrl,
        video_url: videoUrl,
        audio_source: audioUpload
          ? "bunny"
          : selectedTrack
            ? "library"
            : finalAudioUrl
              ? existingMetadata.audio_source || "bunny"
              : null,
      };

      const fullPayload = {
        ...(isEditing ? {} : {
          author_id: userId,
          author: userProfile?.full_name || "User",
          type: "video",
          post_type: "fame",
          visibility: "public",
        }),
        content: caption.trim(),
        media_url: videoUrl,
        video_url: videoUrl,
        audio_url: finalAudioUrl,
        filters: filter,
        playback_rate: playbackRate,
        metadata,
      };

      let savedRow: any = null;
      let saveError: any = null;
      if (isEditing) {
        const result = await savePost("Reel update", (signal) =>
          supabase
            .from("posts")
            .update(fullPayload)
            .eq("id", reelId)
            .select("*")
            .maybeSingle()
            .abortSignal(signal),
        );
        savedRow = result.data;
        saveError = result.error;
      } else {
        const result = await savePost("Reel publish", (signal) =>
          supabase
            .from("posts")
            .insert([fullPayload])
            .select("*")
            .maybeSingle()
            .abortSignal(signal),
        );
        savedRow = result.data;
        saveError = result.error;
      }

      if (saveError && isColumnMismatch(saveError)) {
        const compatibilityPayload = {
          ...(isEditing ? {} : {
            author_id: userId,
            author: userProfile?.full_name || "User",
            type: "video",
            visibility: "public",
          }),
          content: caption.trim(),
          media_url: videoUrl,
          metadata,
        };
        const result = isEditing
          ? await savePost("Compatible Reel update", (signal) =>
              supabase
                .from("posts")
                .update(compatibilityPayload)
                .eq("id", reelId)
                .select("*")
                .maybeSingle()
                .abortSignal(signal),
            )
          : await savePost("Compatible Reel publish", (signal) =>
              supabase
                .from("posts")
                .insert([compatibilityPayload])
                .select("*")
                .maybeSingle()
                .abortSignal(signal),
            );
        savedRow = result.data;
        saveError = result.error;
        if (!saveError) {
          toast.info("Reel saved. Run supabase_reel_studio.sql to enable dedicated metadata columns.");
        }
      }

      if (saveError) throw saveError;

      const fallbackRow = {
        ...(reel || {}),
        ...fullPayload,
        id: savedRow?.id || reelId,
        author_id: savedRow?.author_id || userId,
      };
      const nextRow = toReelRow(savedRow, fallbackRow);
      window.dispatchEvent(new CustomEvent("flicks:reel-updated", { detail: nextRow }));
      if (!isEditing) {
        window.dispatchEvent(new CustomEvent("flicks:post-created", { detail: nextRow }));
      }
      toast.success(isEditing ? "Reel updated." : "Reel published.");
      onSaved?.(nextRow);
      onClose();
    } catch (error: any) {
      console.error("[ReelStudio] save failed:", error);
      toast.error(error?.message || "Reel could not be saved.");
    } finally {
      setSaving(false);
      setVideoUploadProgress(null);
      setUploadingBunnyVideoId(null);
    }
  };

  if (!isOpen) return null;

  const filteredTracks = musicTracks.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(musicQuery.toLowerCase().trim()),
  );
  const musicLabel = audioFile?.name || selectedTrack?.title || (audioUrl ? "Current track" : "No background music");

  return (
    <>
    <style>{`
      @keyframes reel-pen-writing {
        0%, 100% { transform: translateY(0) rotate(-35deg); }
        50% { transform: translateY(-3px) rotate(-28deg); }
      }
    `}</style>
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[#071207]/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-lime-900/80 bg-[#132210] text-lime-50 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-lime-900 bg-[#162917] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#84cc16]">Flicks Studio</p>
            <h2 className="mt-1 text-lg font-black">{isEditing ? "Edit Reel" : "Create Reel"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#203b1d] text-lime-100/80 transition hover:bg-[#2b4a25]"
            aria-label="Close Reel Studio"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <section
            className="relative mb-5 overflow-hidden rounded-2xl border border-[#d6cba8] bg-[#f4efd9] px-3.5 pb-3 pt-3 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, #f4efd9 0px, #f4efd9 31px, rgba(132,204,22,0.22) 32px, #f4efd9 33px)",
            }}
          >
            <label htmlFor="reel-caption" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#55742e]">Reel caption</label>
            <div ref={captionInputWrapRef} className="relative">
              <textarea
                ref={captionInputRef}
                id="reel-caption"
                value={caption}
                onChange={(event) => {
                  setCaption(event.target.value);
                  requestAnimationFrame(updatePenPosition);
                }}
                onFocus={() => {
                  setCaptionFocused(true);
                  requestAnimationFrame(updatePenPosition);
                }}
                onBlur={() => setCaptionFocused(false)}
                onClick={updatePenPosition}
                onKeyUp={updatePenPosition}
                onScroll={updatePenPosition}
                maxLength={2200}
                rows={4}
                placeholder={captionPlaceholder.slice(0, placeholderIndex)}
                className="relative z-[1] min-h-[8rem] w-full resize-y border-0 bg-transparent px-1 py-1 text-[25px] leading-[2rem] text-[#26351d] outline-none placeholder:text-[#899276] focus:ring-0"
                style={{ fontFamily: "'Caveat', cursive", caretColor: "#55742e" }}
              />
              {captionFocused && (
                <PenLine
                  aria-hidden="true"
                  className="pointer-events-none absolute z-[2] h-4 w-4 text-[#55742e] drop-shadow-sm"
                  style={{
                    left: penPosition.left,
                    top: penPosition.top,
                    animation: "reel-pen-writing 800ms ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-end text-[10px] font-semibold text-[#71805d]">
              {caption.length}/2200
            </div>
          </section>
          <div className="grid gap-5 md:grid-cols-[minmax(190px,0.78fr)_1fr]">
            <div className="relative aspect-[9/14] overflow-hidden rounded-3xl border border-lime-900 bg-[#0d190c] shadow-xl">
              {videoPreviewUrl ? (
                <video
                  ref={previewVideoRef}
                  src={videoPreviewUrl}
                  className="h-full w-full object-cover"
                  style={{ filter: selectedFilter.cssFilter }}
                  playsInline
                  loop
                  muted
                  preload="metadata"
                  onEnded={() => {
                    previewAudioRef.current?.pause();
                    setPreviewPlaying(false);
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-lime-100/55">
                  <FileVideo size={34} className="text-[#84cc16]" />
                  <span className="text-sm font-bold">Choose a video to preview</span>
                </div>
              )}
              {audioPreviewUrl && (
                <audio ref={previewAudioRef} src={audioPreviewUrl} preload="metadata" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-[#071207]/90 to-transparent p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-lime-200">{selectedFilter.label}</p>
                  <p className="mt-1 text-xs font-semibold text-lime-50/85">{playbackRate}x playback</p>
                </div>
                {videoPreviewUrl && (
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#84cc16] text-[#132210] shadow-lg"
                    aria-label={previewPlaying ? "Pause preview" : "Play preview"}
                  >
                    {previewPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </button>
                )}
              </div>
              {saving && (videoUploadProgress !== null ||
                bunnyUploadStatus.phase === "checking" ||
                bunnyUploadStatus.phase === "processing") && (
                <div className="fixed inset-0 z-[1300]">
                  <BunnyCreatorProcessingOverlay
                    state={bunnyUploadStatus}
                    uploadProgress={videoUploadProgress}
                  />
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-lime-900 bg-[#162917] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileVideo size={18} className="shrink-0 text-[#84cc16]" />
                  <span className="truncate text-xs font-bold text-lime-50/85">
                    {videoFile?.name || (isEditing ? "Current video" : "No video selected")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="shrink-0 rounded-full bg-[#84cc16] px-3 py-2 text-[10px] font-black text-[#132210] transition hover:bg-lime-300"
                >
                  {isEditing ? "Replace" : "Choose"}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => {
                    handleVideoFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-[#84cc16]" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-lime-50/85">Visual filter</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {REEL_FILTERS.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => setFilter(option.key)}
                      className={`rounded-2xl border p-2.5 text-left transition ${
                        filter === option.key
                          ? "border-[#84cc16] bg-[#84cc16]/15 text-lime-50"
                          : "border-lime-900 bg-[#162917] text-lime-100/65 hover:bg-[#1c331a]"
                      }`}
                    >
                      <span className="block truncate text-[11px] font-black">{option.label}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-lime-100/45">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Gauge size={15} className="text-[#84cc16]" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-lime-50/85">Speed</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      type="button"
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`rounded-xl border py-2.5 text-xs font-black ${
                        playbackRate === rate
                          ? "border-[#84cc16] bg-[#84cc16]/15 text-lime-50"
                          : "border-lime-900 bg-[#162917] text-lime-100/60 hover:bg-[#1c331a]"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Music2 size={15} className="text-[#84cc16]" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-lime-50/85">Background music</h3>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-lime-900 bg-[#162917] p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Music2 size={16} className="shrink-0 text-[#84cc16]" />
                    <span className="truncate text-xs font-bold text-lime-50/75">{musicLabel}</span>
                  </div>
                  {audioUrl || audioFile ? (
                    <button type="button" onClick={clearAudio} className="shrink-0 text-[10px] font-black text-lime-100/50 hover:text-lime-50">
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMusicOpen(true)}
                    className="shrink-0 rounded-full bg-[#84cc16] px-3 py-2 text-[10px] font-black text-[#132210] transition hover:bg-lime-300"
                  >
                    Choose
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-lime-800 py-3 text-xs font-bold text-lime-100/65 hover:border-[#84cc16] hover:bg-[#162917] hover:text-lime-50"
                >
                  <Upload size={14} /> 📱 Phone Upload
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,audio/mpeg,audio/mp3"
                  className="hidden"
                  onChange={(event) => {
                    handleAudioFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <p className="mt-2 text-[10px] leading-relaxed text-lime-100/45">
                  Selecting music automatically mutes the original video audio during playback.
                </p>
              </section>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-lime-900 bg-[#162917] px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-lime-800 bg-[#203b1d] py-3 text-sm font-black text-lime-50/75 transition hover:bg-[#2b4a25]">
            Cancel
          </button>
          <button
            type="button"
            onClick={saveReel}
            disabled={saving || !videoPreviewUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#84cc16] py-3 text-sm font-black text-[#132210] shadow-lg shadow-lime-950/30 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Publish Reel"}
          </button>
        </div>
      </div>

      {musicOpen && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-[#071207]/75 p-3 backdrop-blur-sm sm:items-center sm:p-8">
          <div className="w-full max-w-md rounded-3xl border border-lime-800 bg-[#162917] p-4 text-lime-50 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-black">Music library</p>
                <p className="mt-0.5 text-[10px] text-lime-100/50">Bunny-backed tracks</p>
              </div>
              <button type="button" onClick={() => setMusicOpen(false)} className="rounded-full bg-[#203b1d] p-2 text-lime-50 hover:bg-[#2b4a25]">
                <X size={15} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-lime-900 bg-[#132210] px-3 py-2.5">
              <Search size={15} className="text-lime-100/50" />
              <input
                value={musicQuery}
                onChange={(event) => setMusicQuery(event.target.value)}
                placeholder="Search tracks or artists"
                className="min-w-0 flex-1 bg-transparent text-xs text-lime-50 outline-none placeholder:text-lime-100/40"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {filteredTracks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-lime-900 px-4 py-8 text-center">
                  <Music2 size={24} className="mx-auto text-[#84cc16]" />
                  <p className="mt-2 text-xs font-bold text-lime-50/75">No curated tracks available yet</p>
                  <p className="mt-1 text-[10px] text-lime-100/45">Upload an MP3 to add your own track.</p>
                </div>
              ) : (
                filteredTracks.map((track) => (
                  <button
                    type="button"
                    key={track.id}
                    onClick={() => chooseTrack(track)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-lime-900 bg-[#132210] p-3 text-left transition hover:bg-[#203b1d]"
                  >
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#203b1d] text-[#84cc16]">
                        <Music2 size={15} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black">{track.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-lime-100/50">{track.artist}</span>
                    </span>
                    <Play size={14} className="text-[#84cc16]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
