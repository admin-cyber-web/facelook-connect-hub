export type VibeTag =
  | "storm_alert"
  | "diwali_fest"
  | "holi_fest"
  | "dussehra_fest"
  | "raksha_bandhan"
  | "patriotic"
  | "deep_focus"
  | "hype_mode"
  | "fury_fire"
  | "wanderlust"
  | "birthday_bash"
  | "news_flash"
  | "money_flow"
  | "love_romance"
  | "moody_sad"
  | "miss_you"
  | "summer_vibe"
  | "devotional"
  | "good_morning"
  | "good_night";

export interface VibeProfile {
  tag: VibeTag;
  label: string;
  icon: string;
  keywords: string[];
  priority: number;
  glowColor: string;
  secondaryColor: string;
  audioUrl: string | null;
  audioTitle: string;
  audioSourceUrl: string;
  audioLoop?: boolean;
}

// Compact local tracks remain available for profiles without a dedicated vibe track.
const PUBLIC_DOMAIN_AUDIO = {
  storm: {
    url: "/audio/vibes/storm.mp3",
    title: "Rain, thunder and other noises — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Rain_thunder_and_other_noises.ogg",
  },
  flute: {
    url: "/audio/vibes/flute.mp3",
    title: "Flute — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Flute.ogg",
  },
  applause: {
    url: "/audio/vibes/applause.mp3",
    title: "Applause II — public domain",
    source: "https://commons.wikimedia.org/wiki/File:Applause_ii.ogg",
  },
};

const VIBE_AUDIO_URLS = {
  goodMorning:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930871/alex-morgan-slow-morning-ritual-537463_ssqaxc.mp3",
  goodNight:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930853/juliush-late-in-the-evening-short-piano-music-180518_kk3skm.mp3",
  missYou:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930849/alex-morgan-diwali-festival-lights-celebration-575884_nkmcqt.mp3",
  diwali:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930831/tanweraman-cracker-sound-261119_jdl5mr.mp3",
  summer:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930827/bombinsound-happy-ukulele-version-4-537782_ojokrj.mp3",
  devotional:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930824/donaravind-24-jan-1200-293552_tojjcf.mp3",
  storm:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930812/freesound_community-thunderstorm-with-heavy-rain1wav-14586_swfjtt.mp3",
  hype:
    "https://res.cloudinary.com/dzlazqbvf/video/upload/v1790930808/h-beats-music-box-beat-effect-410596_chcmqm.mp3",
} as const;

export const VIBE_PROFILES: VibeProfile[] = [
  {
    tag: "storm_alert",
    label: "Storm alert",
    icon: "⛈️",
    keywords: ["aandhi", "barish", "storm", "rain", "bijli", "toofan", "flood", "weather alert"],
    priority: 100,
    glowColor: "#38bdf8",
    secondaryColor: "#1d4ed8",
    audioUrl: VIBE_AUDIO_URLS.storm,
    audioTitle: "Thunderstorm with heavy rain",
    audioSourceUrl: VIBE_AUDIO_URLS.storm,
  },
  {
    tag: "diwali_fest",
    label: "Diwali",
    icon: "🪔",
    keywords: ["diwali", "deepawali", "patake", "fireworks", "diya", "crackers"],
    priority: 70,
    glowColor: "#fbbf24",
    secondaryColor: "#f97316",
    audioUrl: VIBE_AUDIO_URLS.diwali,
    audioTitle: "Diwali crackers",
    audioSourceUrl: VIBE_AUDIO_URLS.diwali,
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
    tag: "dussehra_fest",
    label: "Dussehra",
    icon: "🏹",
    keywords: ["dussehra", "dussera", "dashara", "vijayadashami", "vijaya dashami"],
    priority: 71,
    glowColor: "#fb923c",
    secondaryColor: "#facc15",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: "Flute — public domain",
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
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
    audioUrl: "/notif.wav",
    audioTitle: "Celebration chime",
    audioSourceUrl: "",
  },
  {
    tag: "news_flash",
    label: "Breaking news",
    icon: "🚨",
    keywords: ["breaking news", "khabar", "alert", "update"],
    priority: 80,
    glowColor: "#ef4444",
    secondaryColor: "#f8fafc",
    audioUrl: null,
    audioTitle: "",
    audioSourceUrl: "",
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
    keywords: ["ghumne", "trip", "travel", "vacation", "flight", "ticket", "safar", "airplane"],
    priority: 39,
    glowColor: "#38bdf8",
    secondaryColor: "#facc15",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "money_flow",
    label: "Money flow",
    icon: "💸",
    keywords: ["paise", "money", "cash", "salary", "profit", "wealth", "dhan"],
    priority: 58,
    glowColor: "#facc15",
    secondaryColor: "#22c55e",
    audioUrl: PUBLIC_DOMAIN_AUDIO.applause.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.applause.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.applause.source,
  },
  {
    tag: "love_romance",
    label: "Love & romance",
    icon: "💞",
    keywords: ["love", "pyaar", "jaan", "close to heart"],
    priority: 57,
    glowColor: "#fb7185",
    secondaryColor: "#c084fc",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "moody_sad",
    label: "Sad & emotional",
    icon: "🌧️",
    keywords: ["sad", "dukh", "rona", "lonely", "broken"],
    priority: 56,
    glowColor: "#94a3b8",
    secondaryColor: "#60a5fa",
    audioUrl: PUBLIC_DOMAIN_AUDIO.flute.url,
    audioTitle: PUBLIC_DOMAIN_AUDIO.flute.title,
    audioSourceUrl: PUBLIC_DOMAIN_AUDIO.flute.source,
  },
  {
    tag: "miss_you",
    label: "Miss you & nostalgia",
    icon: "💭",
    keywords: ["yaad", "miss you", "purane din", "purani yaadein", "purana safar", "woh din"],
    priority: 59,
    glowColor: "#a78bfa",
    secondaryColor: "#f472b6",
    audioUrl: VIBE_AUDIO_URLS.missYou,
    audioTitle: "Nostalgia",
    audioSourceUrl: VIBE_AUDIO_URLS.missYou,
  },
  {
    tag: "summer_vibe",
    label: "Summer vibe",
    icon: "☀️",
    keywords: ["garmi", "summer", "dhoop", "mausam", "sunny", "happy"],
    priority: 45,
    glowColor: "#facc15",
    secondaryColor: "#fb923c",
    audioUrl: VIBE_AUDIO_URLS.summer,
    audioTitle: "Happy ukulele",
    audioSourceUrl: VIBE_AUDIO_URLS.summer,
  },
  {
    tag: "devotional",
    label: "Devotional & puja",
    icon: "🙏",
    keywords: ["mandir", "puja", "bhagwan", "god", "temple", "prarthana", "aarti"],
    priority: 54,
    glowColor: "#fbbf24",
    secondaryColor: "#f97316",
    audioUrl: VIBE_AUDIO_URLS.devotional,
    audioTitle: "Devotional",
    audioSourceUrl: VIBE_AUDIO_URLS.devotional,
  },
  {
    tag: "good_morning",
    label: "Good morning",
    icon: "🌅",
    keywords: ["good morning", "subah", "gm", "prabhat", "sunrise"],
    priority: 53,
    glowColor: "#fbbf24",
    secondaryColor: "#fb923c",
    audioUrl: VIBE_AUDIO_URLS.goodMorning,
    audioTitle: "Slow morning ritual",
    audioSourceUrl: VIBE_AUDIO_URLS.goodMorning,
  },
  {
    tag: "good_night",
    label: "Good night",
    icon: "🌙",
    keywords: ["good night", "raat", "gn", "shubh ratri", "sleep"],
    priority: 52,
    glowColor: "#818cf8",
    secondaryColor: "#c4b5fd",
    audioUrl: VIBE_AUDIO_URLS.goodNight,
    audioTitle: "Late evening piano",
    audioSourceUrl: VIBE_AUDIO_URLS.goodNight,
  },
  {
    tag: "hype_mode",
    label: "Hype mode",
    icon: "🎉",
    keywords: ["party", "maza", "dance", "chill", "celebration", "club", "fun"],
    priority: 30,
    glowColor: "#e879f9",
    secondaryColor: "#22d3ee",
    audioUrl: VIBE_AUDIO_URLS.hype,
    audioTitle: "Celebration beat",
    audioSourceUrl: VIBE_AUDIO_URLS.hype,
  },
];

const PROFILES_BY_TAG = new Map(VIBE_PROFILES.map((profile) => [profile.tag, profile]));
const VIBE_TAG_ALIASES: Record<string, VibeTag> = {
  nostalgia: "miss_you",
  puja: "devotional",
};
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
  const canonicalTag = VIBE_TAG_ALIASES[tag] ?? (tag as VibeTag);
  return PROFILES_BY_TAG.get(canonicalTag) ?? null;
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
  const customUrl = metadata.vibe_audio_url;
  if (typeof customUrl === "string" && /^https?:\/\//i.test(customUrl)) return customUrl;
  if (!resolvedVibe.primary) return null;
  return resolvedVibe.primary.audioUrl || null;
}