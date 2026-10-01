export type VibeTag =
  | "storm_alert"
  | "diwali_fest"
  | "holi_fest"
  | "raksha_bandhan"
  | "patriotic"
  | "deep_focus"
  | "hype_mode"
  | "fury_fire"
  | "wanderlust"
  | "birthday_bash";

export interface VibeProfile {
  tag: VibeTag;
  label: string;
  icon: string;
  keywords: string[];
  priority: number;
  glowColor: string;
  secondaryColor: string;
  audioUrl: string;
  audioTitle: string;
  audioSourceUrl: string;
}

// These small, public-domain Wikimedia tracks are fetched only after a viewer
// opts into sound. Replace the URLs here with the production Cloudinary tracks
// when those are available.
const PUBLIC_DOMAIN_AUDIO = {
  storm: {
    url: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Rain_thunder_and_other_noises.ogg",
    title: "Rain, thunder and other noises — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Rain_thunder_and_other_noises.ogg",
  },
  flute: {
    url: "https://upload.wikimedia.org/wikipedia/commons/0/05/Flute.ogg",
    title: "Flute — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Flute.ogg",
  },
  applause: {
    url: "https://upload.wikimedia.org/wikipedia/commons/0/09/Applause_ii.ogg",
    title: "Applause II — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Applause_ii.ogg",
  },
};

export const VIBE_PROFILES: VibeProfile[] = [
  {
    tag: "storm_alert",
    label: "Storm alert",
    icon: "⛈️",
    keywords: ["aandhi", "barish", "storm", "rain", "bijli", "toofan", "flood"],
    priority: 100,
    glowColor: "#38bdf8",
    secondaryColor: "#1d4ed8",
    audioUrl: PUBLIC_DOMAIN_AUDIO.storm.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.storm.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.storm.source,
  },
  {
    tag: "diwali_fest",
    label: "Diwali",
    icon: "🪔",
    keywords: ["diwali", "deepawali", "patake", "fireworks", "diya"],
    priority: 70,
    glowColor: "#fbbf24",
    secondaryColor: "#f97316",
    audioUrl: PUBLIC_DOMAIN_AUDIO.applause.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.applause.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.applause.source,
  },
  {
    tag: "holi_fest",
    label: "Holi",
    icon: "🎨",
    keywords: ["holi", "rang", "colors", "pichkari"],
    priority: 69,
    glowColor: "#f472b6",
    secondaryColor: "#22d3ee",
    audioUrl: PUBLIC_DOMAIN_AUDIO.applause.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.applause.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.applause.source,
  },
  {
    tag: "raksha_bandhan",
    label: "Raksha Bandhan",
    icon: "🧵",
    keywords: ["rakhi", "rakshabandhan"],
    priority: 68,
    glowColor: "#fb7185",
    secondaryColor: "#facc15",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "patriotic",
    label: "Patriotic",
    icon: "🇮🇳",
    keywords: ["gandhi jayanti", "bapu", "15 august", "republic day"],
    priority: 67,
    glowColor: "#fb923c",
    secondaryColor: "#22c55e",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "birthday_bash",
    label: "Birthday bash",
    icon: "🎂",
    keywords: ["birthday", "cake", "saal gira"],
    priority: 60,
    glowColor: "#c084fc",
    secondaryColor: "#fb7185",
    audioUrl: PUBLIC_DOMAIN_AUDIO.applause.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.applause.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.applause.source,
  },
  {
    tag: "fury_fire",
    label: "Fury fire",
    icon: "🔥",
    keywords: ["gussa", "anger", "aag", "fire", "fuming"],
    priority: 50,
    glowColor: "#fb4b24",
    secondaryColor: "#dc2626",
    audioUrl: PUBLIC_DOMAIN_AUDIO.storm.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.storm.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.storm.source,
  },
  {
    tag: "deep_focus",
    label: "Deep focus",
    icon: "🌙",
    keywords: ["coding", "night shift", "bug", "hustle", "late night"],
    priority: 40,
    glowColor: "#e879f9",
    secondaryColor: "#d9f99d",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "wanderlust",
    label: "Wanderlust",
    icon: "✈️",
    keywords: ["travel", "flight", "airplane", "safar", "trip", "ticket"],
    priority: 39,
    glowColor: "#38bdf8",
    secondaryColor: "#facc15",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "hype_mode",
    label: "Hype mode",
    icon: "🎉",
    keywords: ["party", "maza", "dance", "chill", "celebration"],
    priority: 30,
    glowColor: "#e879f9",
    secondaryColor: "#22d3ee",
    audioUrl: PUBLIC_DOMAIN_AUDIO.applause.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.applause.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.applause.source,
  },
];

const PROFILES_BY_TAG = new Map(VIBE_PROFILES.map((profile) => [profile.tag, profile]));
const SEVERE_PRIORITY = 100;

export type VibeOverride = VibeTag | "none" | null;

export interface VibeDetection {
  primary: VibeProfile | null;
  matches: VibeProfile[];
}

export interface VibeSelection extends VibeDetection {
  manual: boolean;
  weatherOverride: boolean;
}

const normalizeText = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const keywordMatches = (text: string, keyword: string): boolean => {
  const words = normalizeText(keyword).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const expression = new RegExp(`(?:^|[^\\p{L}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return expression.test(text);
};

export function getVibeProfile(tag: string | null | undefined): VibeProfile | null {
  if (!tag) return null;
  return PROFILES_BY_TAG.get(tag as VibeTag) ?? null;
}

export function detectVibes(text: string): VibeDetection {
  const normalized = normalizeText(text || "");
  const matches = VIBE_PROFILES.filter((profile) =>
    profile.keywords.some((keyword) => keywordMatches(normalized, keyword)),
  ).sort((left, right) => right.priority - left.priority);

  return { primary: matches[0] ?? null, matches };
}

export function resolveVibeSelection(
  text: string,
  override: VibeOverride = null,
): VibeSelection {
  const detection = detectVibes(text);
  const severeMatch = detection.matches.find((profile) => profile.priority >= SEVERE_PRIORITY);
  const selected =
    severeMatch ??
    (override === null
      ? detection.primary
      : override === "none"
        ? null
        : getVibeProfile(override));
  const matches = selected
    ? [selected, ...detection.matches.filter((profile) => profile.tag !== selected.tag)]
    : detection.matches;

  return {
    primary: selected,
    matches,
    manual: override !== null,
    weatherOverride: Boolean(severeMatch && override !== null && override !== severeMatch.tag),
  };
}

const objectMetadata = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const cachedVibes = new WeakMap<object, VibeSelection>();

export function resolvePostVibe(post: unknown): VibeSelection {
  if (!post || typeof post !== "object") {
    return { primary: null, matches: [], manual: false, weatherOverride: false };
  }
  const cached = cachedVibes.get(post);
  if (cached) return cached;

  const row = post as Record<string, unknown>;
  const metadata = objectMetadata(row.metadata);
  const content = String(row.content ?? row.caption ?? "");
  const detected = detectVibes(content);
  const storedTag =
    (typeof row.vibe_tag === "string" && row.vibe_tag) ||
    (typeof metadata.vibe_tag === "string" && metadata.vibe_tag) ||
    null;
  const severeMatch = detected.matches.find((profile) => profile.priority >= SEVERE_PRIORITY);
  const manual = metadata.vibe_manual === true;
  const storedProfile = getVibeProfile(storedTag);
  const manuallyDisabled = manual && storedTag === null;
  const primary =
    severeMatch ?? (manuallyDisabled ? null : storedProfile || detected.primary);
  const storedMatches = Array.isArray(metadata.vibe_matches)
    ? metadata.vibe_matches
        .map((tag) => getVibeProfile(typeof tag === "string" ? tag : null))
        .filter((profile): profile is VibeProfile => Boolean(profile))
    : [];
  const matches = primary
    ? [
        primary,
        ...[...storedMatches, ...detected.matches].filter(
          (profile, index, all) =>
            profile.tag !== primary.tag &&
            all.findIndex((candidate) => candidate.tag === profile.tag) === index,
        ),
      ]
    : [];

  const result: VibeSelection = {
    primary,
    matches,
    manual,
    weatherOverride: Boolean(severeMatch && storedProfile && severeMatch.tag !== storedProfile.tag),
  };

  cachedVibes.set(post, result);
  return result;
}

export function getPostVibeAudioUrl(post: unknown, selection?: VibeSelection): string | null {
  const row = post && typeof post === "object" ? (post as Record<string, unknown>) : {};
  const metadata = objectMetadata(row.metadata);
  const resolvedVibe = selection ?? resolvePostVibe(post);
  if (!resolvedVibe.primary) return null;
  const customUrl = metadata.vibe_audio_url;
  if (typeof customUrl === "string" && /^https?:\/\//i.test(customUrl)) return customUrl;
  return resolvedVibe.primary.audioUrl;
}