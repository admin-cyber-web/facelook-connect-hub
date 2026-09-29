export type ReelFilterKey =
  | "none"
  | "cinematic"
  | "vintage"
  | "bw"
  | "cyberpunk"
  | "glow";

export interface ReelFilterOption {
  key: ReelFilterKey;
  label: string;
  description: string;
  cssFilter: string;
}

export const REEL_FILTERS: ReelFilterOption[] = [
  { key: "none", label: "Original", description: "Natural", cssFilter: "none" },
  {
    key: "cinematic",
    label: "Cinematic",
    description: "Deep contrast",
    cssFilter: "contrast(1.18) saturate(1.08) brightness(0.9)",
  },
  {
    key: "vintage",
    label: "Vintage",
    description: "Warm film",
    cssFilter: "sepia(0.42) saturate(1.18) contrast(1.05)",
  },
  {
    key: "bw",
    label: "B&W",
    description: "Monochrome",
    cssFilter: "grayscale(1) contrast(1.12)",
  },
  {
    key: "cyberpunk",
    label: "Cyberpunk",
    description: "Neon shift",
    cssFilter: "saturate(1.75) hue-rotate(22deg) contrast(1.18)",
  },
  {
    key: "glow",
    label: "Glow",
    description: "Soft light",
    cssFilter: "brightness(1.08) saturate(1.35) contrast(1.04)",
  },
];

const FILTER_KEYS = new Set<ReelFilterKey>(REEL_FILTERS.map((item) => item.key));

export const isReelFilterKey = (value: unknown): value is ReelFilterKey =>
  typeof value === "string" && FILTER_KEYS.has(value as ReelFilterKey);

const parseMetadata = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "object") return (value as Record<string, any>) || {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const firstNonBlank = (...values: unknown[]): string | null => {
  const value = values.find(
    (candidate) => typeof candidate === "string" && candidate.trim(),
  );
  return typeof value === "string" ? value : null;
};

export function getReelSettings(post: any) {
  const metadata = parseMetadata(post?.metadata);
  const filterValue = firstNonBlank(
    post?.filters,
    metadata.filters,
    metadata.reel_filter,
  );
  const filter: ReelFilterKey = isReelFilterKey(filterValue)
    ? filterValue
    : "none";
  const rateCandidate = Number(
    post?.playback_rate ?? metadata.playback_rate ?? 1,
  );
  const playbackRate = [0.5, 1, 1.5, 2].includes(rateCandidate)
    ? rateCandidate
    : 1;

  return {
    videoUrl: firstNonBlank(post?.video_url, post?.media_url),
    audioUrl: firstNonBlank(post?.audio_url, metadata.audio_url),
    filter,
    playbackRate,
    cssFilter:
      REEL_FILTERS.find((option) => option.key === filter)?.cssFilter || "none",
    metadata,
  };
}

export { parseMetadata };