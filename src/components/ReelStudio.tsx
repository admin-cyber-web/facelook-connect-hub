import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileVideo,
  Gauge,
  Loader2,
  Music2,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  uploadToCloudinaryDetailed,
  type CloudinaryUploadResult,
} from "@/lib/cloudinaryUpload";
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
  const [videoFile, setVideoFile] = useState<File | null>(initialVideoFile || null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<ReelMusicTrack | null>(null);
  const [filter, setFilter] = useState<ReelFilterKey>("none");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicTracks, setMusicTracks] = useState<ReelMusicTrack[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;
    setVideoFile(initialVideoFile || null);
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
    video.muted = Boolean(audioPreviewUrl);
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

    video.muted = Boolean(audioPreviewUrl);
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

      const uploadFile = async (file: File, label: string) => {
        try {
          return await withTimeout(label, REEL_UPLOAD_TIMEOUT_MS, (signal) =>
            uploadToCloudinaryDetailed(file, { resourceType: "video", signal }),
          );
        } catch (error) {
          console.error(`[ReelStudio] ${label} failed`, error);
          throw new Error(`${label} failed: ${getErrorMessage(error)}`);
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

      let videoUpload: CloudinaryUploadResult | null = null;
      let audioUpload: CloudinaryUploadResult | null = null;
      if (videoFile) {
        videoUpload = await uploadFile(videoFile, "Video upload");
      }
      if (audioFile) {
        audioUpload = await uploadFile(audioFile, "Audio upload");
      }

      const videoUrl = videoUpload?.secureUrl || reelSettings.videoUrl;
      const finalAudioUrl =
        audioUpload?.secureUrl || selectedTrack?.audio_url || audioUrl || null;
      if (!videoUrl) throw new Error("The video upload did not return a secure URL.");

      const existingMetadata = parseMetadata(reel?.metadata);
      const metadata = {
        ...existingMetadata,
        is_youtube: false,
        mime_type: videoFile?.type || existingMetadata.mime_type || "video/mp4",
        reel_filter: filter,
        filters: filter,
        playback_rate: playbackRate,
        audio_url: finalAudioUrl,
        video_url: videoUrl,
        audio_source: audioUpload
          ? "cloudinary"
          : selectedTrack
            ? "library"
            : finalAudioUrl
              ? existingMetadata.audio_source || "cloudinary"
              : null,
      };

      const fullPayload = {
        ...(isEditing ? {} : {
          author_id: userId,
          author: userProfile?.full_name || "User",
          content: reel?.content || "",
          type: "video",
          post_type: "fame",
          visibility: "public",
        }),
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
            content: reel?.content || "",
            type: "video",
            visibility: "public",
          }),
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
    }
  };

  if (!isOpen) return null;

  const filteredTracks = musicTracks.filter((track) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(musicQuery.toLowerCase().trim()),
  );
  const musicLabel = audioFile?.name || selectedTrack?.title || (audioUrl ? "Current track" : "No background music");

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-[#111326] text-white shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Flicks Studio</p>
            <h2 className="mt-1 text-lg font-black">{isEditing ? "Edit Reel" : "Create Reel"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15"
            aria-label="Close Reel Studio"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <div className="grid gap-5 md:grid-cols-[minmax(190px,0.78fr)_1fr]">
            <div className="relative aspect-[9/14] overflow-hidden rounded-3xl border border-white/10 bg-black shadow-xl">
              {videoPreviewUrl ? (
                <video
                  ref={previewVideoRef}
                  src={videoPreviewUrl}
                  className="h-full w-full object-cover"
                  style={{ filter: selectedFilter.cssFilter }}
                  playsInline
                  loop
                  muted={Boolean(audioPreviewUrl)}
                  preload="metadata"
                  onEnded={() => {
                    previewAudioRef.current?.pause();
                    setPreviewPlaying(false);
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/45">
                  <FileVideo size={34} />
                  <span className="text-sm font-bold">Choose a video to preview</span>
                </div>
              )}
              {audioPreviewUrl && (
                <audio ref={previewAudioRef} src={audioPreviewUrl} preload="metadata" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">{selectedFilter.label}</p>
                  <p className="mt-1 text-xs font-semibold text-white/75">{playbackRate}x playback</p>
                </div>
                {videoPreviewUrl && (
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg"
                    aria-label={previewPlaying ? "Pause preview" : "Play preview"}
                  >
                    {previewPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-5">
              {!isEditing && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileVideo size={18} className="shrink-0 text-cyan-300" />
                    <span className="truncate text-xs font-bold text-white/75">
                      {videoFile?.name || "No video selected"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black text-white/80"
                  >
                    Change
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
              )}

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-cyan-300" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/75">Visual filter</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {REEL_FILTERS.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => setFilter(option.key)}
                      className={`rounded-2xl border p-2.5 text-left transition ${
                        filter === option.key
                          ? "border-cyan-300 bg-cyan-300/15 text-white"
                          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                      }`}
                    >
                      <span className="block truncate text-[11px] font-black">{option.label}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-white/35">{option.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Gauge size={15} className="text-violet-300" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/75">Speed</h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      type="button"
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`rounded-xl border py-2.5 text-xs font-black ${
                        playbackRate === rate
                          ? "border-violet-300 bg-violet-300/20 text-white"
                          : "border-white/10 bg-white/[0.04] text-white/55"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Music2 size={15} className="text-pink-300" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/75">Background music</h3>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Music2 size={16} className="shrink-0 text-pink-300" />
                    <span className="truncate text-xs font-bold text-white/70">{musicLabel}</span>
                  </div>
                  {audioUrl || audioFile ? (
                    <button type="button" onClick={clearAudio} className="shrink-0 text-[10px] font-black text-white/45 hover:text-white">
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMusicOpen(true)}
                    className="shrink-0 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-3 py-2 text-[10px] font-black"
                  >
                    Choose
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-xs font-bold text-white/55 hover:border-pink-300/50 hover:text-white"
                >
                  <Upload size={14} /> Upload MP3 to Cloudinary
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
                <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                  Selecting music automatically mutes the original video audio during playback.
                </p>
              </section>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-black text-white/70">
            Cancel
          </button>
          <button
            type="button"
            onClick={saveReel}
            disabled={saving || !videoPreviewUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 disabled:cursor-wait disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Publish Reel"}
          </button>
        </div>
      </div>

      {musicOpen && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-8">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171a31] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-black">Music library</p>
                <p className="mt-0.5 text-[10px] text-white/40">Cloudinary-backed tracks</p>
              </div>
              <button type="button" onClick={() => setMusicOpen(false)} className="rounded-full bg-white/10 p-2">
                <X size={15} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
              <Search size={15} className="text-white/35" />
              <input
                value={musicQuery}
                onChange={(event) => setMusicQuery(event.target.value)}
                placeholder="Search tracks or artists"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {filteredTracks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <Music2 size={24} className="mx-auto text-white/25" />
                  <p className="mt-2 text-xs font-bold text-white/55">No curated tracks available yet</p>
                  <p className="mt-1 text-[10px] text-white/30">Upload an MP3 to add your own Cloudinary track.</p>
                </div>
              ) : (
                filteredTracks.map((track) => (
                  <button
                    type="button"
                    key={track.id}
                    onClick={() => chooseTrack(track)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-3 text-left hover:bg-white/[0.09]"
                  >
                    {track.cover_url ? (
                      <img src={track.cover_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/30 to-violet-500/30">
                        <Music2 size={15} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black">{track.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-white/40">{track.artist}</span>
                    </span>
                    <Play size={14} className="text-white/45" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}