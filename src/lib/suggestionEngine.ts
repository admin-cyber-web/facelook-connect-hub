import { GoogleGenerativeAI } from "@google/generative-ai";

// ═══════════════════════════════════════════════════════════════════════════
//  FLICKS SUGGESTED FOR YOU — Gemini-Powered Post Suggestion Engine
//  Debounced, cached, client-side with fallback. No polling, no subs.
// ═══════════════════════════════════════════════════════════════════════════

export interface SuggestionPayload {
  text: string;
  mediaType?: "image" | "video" | "youtube" | "text";
  location?: string;
  language?: "en" | "hi" | "hinglish";
}

export interface SuggestionSet {
  captions: string[];
  hashtags: string[];
  engagementHooks: string[];
  improvedVersions: string[];
  autoSelected: number;
  category: string;
  confidence: number;
}

export interface SuggestionAnalytics {
  shown: number;
  selected: number;
  ignored: number;
  copied: number;
}

// ── In-memory request cache (keyed by input hash) ───────────────────────────
const cache = new Map<string, { data: SuggestionSet; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

function hashPayload(p: SuggestionPayload): string {
  const raw = `${p.text.trim().toLowerCase()}|${p.mediaType || ""}|${p.location || ""}|${p.language || "en"}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function getCached(key: string): SuggestionSet | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: SuggestionSet) {
  cache.set(key, { data, ts: Date.now() });
  // Hard cap at 50 entries to prevent unbounded growth
  if (cache.size > 50) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
}

// ── Prompt builder ──────────────────────────────────────────────────────────
function buildPrompt(p: SuggestionPayload): string {
  const lang = p.language === "hi" ? "Hindi" : p.language === "hinglish" ? "Hinglish (Hindi in Roman script)" : "English";
  const mediaCtx = p.mediaType
    ? `The user has uploaded a ${p.mediaType}. Generate suggestions that match visual/video context.`
    : "";
  const locCtx = p.location
    ? `The user is at location: "${p.location}". Include location-specific references and hashtags.`
    : "";

  return `You are "Flicks Suggested For You" — an expert social media copywriter for Indian users.

User Input: "${p.text.trim()}"
Language: ${lang}
${mediaCtx}
${locCtx}

Generate a JSON object with these exact keys:
{
  "captions": [5 short, catchy caption options (each 10-80 chars), EACH in a DIFFERENT style],
  "hashtags": [8-12 relevant hashtags including Indian/popular tags],
  "engagementHooks": [3 questions or CTAs to boost comments],
  "improvedVersions": [3 rewritten versions of the user's text, more engaging],
  "category": "detected content category (e.g. Travel, Food, Nature, Fashion, News, Sports, Events, Motivation, Comedy, Love, Sad, Attitude, General)",
  "confidence": number 0-1
}

CRITICAL STYLES for captions (each must be distinct):
Option 1: Emotional / Heartfelt — warm, relatable, personal feelings.
Option 2: Funny / Witty — playful, humor, meme energy, sarcasm.
Option 3: Travel Blogger / Lifestyle — aesthetic, curated, influencer style.
Option 4: Short Viral / Punchy — bold, trending, 1-liner, maximum impact.
Option 5: Storytelling / Narrative — a mini story, "That one time when...", anecdote.

DEDUPLICATION RULES:
- No two captions should share the same opening 3 words.
- No near-duplicates (same meaning, different word order).
- If the user mentions "Goa", only ONE caption should mention Goa explicitly.
- Each caption must feel genuinely different in tone and style.

Rules:
- Captions must be ready to post — no placeholders, no "[Your Name]".
- Hashtags must include a mix of broad (#flicksindia, #viral, #trending) and niche tags.
- Engagement hooks should spark conversation — ask opinions, recommendations, or relatable questions.
- Improved versions should preserve the user's intent but make it punchier.
- If input is empty, generate generic but trendy suggestions in the category.
- If input is very short (1-3 words), expand it into a full post idea.
- NEVER include markdown code blocks — return pure JSON only.
`;
}

// ── Text similarity for deduplication ────────────────────────────────────
function textSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const sa = normalize(a);
  const sb = normalize(b);
  if (sa === sb) return 1;
  const setA = new Set(sa.split(/\s+/));
  const setB = new Set(sb.split(/\s+/));
  const inter = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function deduplicateCaptions(captions: string[]): string[] {
  const unique: string[] = [];
  for (const cap of captions) {
    const trimmed = cap.trim();
    if (!trimmed) continue;
    // Skip if too similar to any already-kept caption
    const isDup = unique.some((u) => textSimilarity(trimmed, u) > 0.6);
    if (!isDup) unique.push(trimmed);
  }
  return unique;
}

// ── Gemini client resolver ─────────────────────────────────────────────────
function resolveApiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
}

// ── Offline fallback generator (deterministic, no API needed) ──────────────
function generateOfflineSuggestions(p: SuggestionPayload): SuggestionSet {
  const text = p.text.trim().toLowerCase();
  const loc = p.location ? p.location.trim() : "";
  const lang = p.language || "en";

  // Detect category from keywords
  let category = "General";
  const categories: Record<string, string[]> = {
    Travel: ["travel", "trip", "goa", "delhi", "mumbai", "mountain", "beach", "hotel", "flight", "road", "vacation", "tour", "wander"],
    Food: ["food", "biryani", "pizza", "chai", "dinner", "lunch", "restaurant", "cafe", "cook", "recipe", "tasty", "delicious"],
    Nature: ["nature", "sunset", "rain", "sky", "tree", "flower", "green", "forest", "lake", "river", "cloud", "sunrise"],
    Fashion: ["fashion", "style", "outfit", "dress", "look", "ootd", "trend", "model", "wear", "shopping"],
    Sports: ["cricket", "football", "match", "game", "ipl", "player", "score", "team", "win", "run", "goal", "sport"],
    Events: ["wedding", "party", "birthday", "celebration", "festival", "diwali", "holi", "event", "concert"],
    Motivation: ["motivation", "success", "grind", "work", "hustle", "goal", "dream", "believe", "never", "stop", "fight"],
    Comedy: ["funny", "joke", "laugh", "meme", "lol", "haha", "comedy", "humor", "sarcasm"],
    Love: ["love", "heart", "crush", "boyfriend", "girlfriend", "couple", "romance", "kiss", "miss", "forever"],
    Sad: ["sad", "cry", "broken", "pain", "hurt", "alone", "miss", "tears", "goodbye", "sorry"],
    Attitude: ["attitude", "boss", "king", "queen", "legend", "royal", "swag", "badass", "rule"],
  };
  for (const [cat, words] of Object.entries(categories)) {
    if (words.some((w) => text.includes(w))) { category = cat; break; }
  }

  const base = p.text.trim() || "Flicks India";
  const locPrefix = loc ? `${loc} vibes — ` : "";

  const captions: Record<string, string[]> = {
    en: [
      `${locPrefix}${base} ✨🔥`,
      `Just dropped this on Flicks India 👆🏽`,
      `When the moment is too good to keep to yourself 📸`,
      `${locPrefix}living my best life 🌟`,
      `This energy >>> 🔥 Who else feels it?`,
    ],
    hi: [
      `${locPrefix}${base} ✨ 🔥`,
      `Flicks India pe abhi daala 👆🏽`,
      `Ye pal itna khaas hai ki sirf apne liye nahi 📸`,
      `${locPrefix}zindagi jeene ka asli mazaa 🌟`,
      `Ye vibe alag hai 🔥 Aapko kaisa laga?`,
    ],
    hinglish: [
      `${locPrefix}${base} ✨ 🔥`,
      `Abhi Flicks India pe drop kiya 👆🏽`,
      `Moment itna khaas hai, sirf apne liye nahi rakh sakta 📸`,
      `${locPrefix}best life ji raha hun 🌟`,
      `Ye energy next level hai 🔥 Aap bhi feel kar rahe ho?`,
    ],
  };

  const hashtags: Record<string, string[]> = {
    General: ["#flicksindia", "#viral", "#trending", "#explore", "#india", "#social", "#community", "#vibes", "#daily", "#fyp", "#foryou", "#instagood"],
    Travel: ["#flicksindia", "#travel", "#wanderlust", "#goa", "#india", "#trip", "#explore", "#adventure", "#backpacking", "#vacation", "#roadtrip", "#beachlife"],
    Food: ["#flicksindia", "#foodie", "#foodporn", "#indianfood", "#yummy", "#delicious", "#streetfood", "#foodstagram", "#homemade", "#chef", "#tasty", "#foodlover"],
    Nature: ["#flicksindia", "#nature", "#sunset", "#sky", "#green", "#peace", "#earth", "#photography", "#naturelovers", "#hills", "#rain", "#clouds"],
    Fashion: ["#flicksindia", "#fashion", "#ootd", "#style", "#outfit", "#trend", "#model", "#look", "#fashionista", "#streetstyle", "#vogue", "#glam"],
    Sports: ["#flicksindia", "#cricket", "#ipl", "#sports", "#team", "#win", "#match", "#champion", "#fitness", "#game", "#score", "#player"],
    Events: ["#flicksindia", "#wedding", "#party", "#celebration", "#festival", "#diwali", "#holi", "#event", "#fun", "#memories", "#family", "#friends"],
    Motivation: ["#flicksindia", "#motivation", "#success", "#hustle", "#grind", "#dream", "#believe", "#inspire", "#goals", "#mindset", "#positive", "#nevergiveup"],
    Comedy: ["#flicksindia", "#comedy", "#funny", "#meme", "#lol", "#joke", "#haha", "#humor", "#sarcasm", "#memes", "#laugh", "#trending"],
    Love: ["#flicksindia", "#love", "#heart", "#couple", "#romance", "#forever", "#together", "#crush", "#relationship", "#bae", "#soulmate", "#instalove"],
    Sad: ["#flicksindia", "#sad", "#broken", "#pain", "#hurt", "#alone", "#miss", "#tears", "#heartbreak", "#emotions", "#mood", "#night"],
    Attitude: ["#flicksindia", "#attitude", "#boss", "#king", "#queen", "#legend", "#swag", "#royal", "#badass", "#rule", "#power", "#unstoppable"],
  };

  const hooks: Record<string, string[]> = {
    en: ["What do you think? 👇", "Drop your thoughts below! 💬", "Tag someone who needs to see this 👆"],
    hi: ["Aapko kya lagta hai? 👇", "Apni raay comment mein batao! 💬", "Kisi ko tag karo jisko ye dekhna chahiye 👆"],
    hinglish: ["Aapko kya lagta hai? 👇", "Comment mein batao apni soch! 💬", "Tag karo wo dost jisko ye dekhna chahiye 👆"],
  };

  const improved: Record<string, string[]> = {
    en: [
      `${locPrefix}${base} — and honestly? It's giving everything it needed to give ✨`,
      `Here's the thing about ${base}: you either get it, or you're missing out 🔥`,
      `Not to be dramatic, but ${base} just changed the whole vibe 💀`,
    ],
    hi: [
      `${locPrefix}${base} — aur sach mein? Ye sab kuch de raha hai jo chahiye tha ✨`,
      `${base} ke baare mein ek baat samajh lo: ya toh aap samajhoge, ya kuch miss kar doge 🔥`,
      `Dramatic nahi bol raha, par ${base} ne poora vibe badal diya 💀`,
    ],
    hinglish: [
      `${locPrefix}${base} — aur sach mein? Ye sab kuch de raha hai jo chahiye tha ✨`,
      `${base} ke baare mein ek baat: ya toh samajhoge, ya miss kar doge 🔥`,
      `Dramatic nahi bol raha, par ${base} ne vibe hi badal diya 💀`,
    ],
  };

  const l = lang === "hi" ? "hi" : lang === "hinglish" ? "hinglish" : "en";
  const catHashtags = hashtags[category] || hashtags.General;
  if (loc) {
    const locTag = `#${loc.toLowerCase().replace(/\s+/g, "")}`;
    if (!catHashtags.includes(locTag)) catHashtags.unshift(locTag);
  }

  return {
    captions: captions[l].map((c) => c.replace(/\bbase\b/g, base)),
    hashtags: catHashtags.slice(0, 12),
    engagementHooks: hooks[l],
    improvedVersions: improved[l].map((v) => v.replace(/\bbase\b/g, base)),
    autoSelected: 0,
    category,
    confidence: 0.6,
  };
}

// ── Main API call ───────────────────────────────────────────────────────────
let pendingAbort: AbortController | null = null;

export async function generateSuggestions(payload: SuggestionPayload, bypassCache = false): Promise<SuggestionSet> {
  const key = hashPayload(payload);
  const cached = getCached(key);
  if (cached && !bypassCache) return cached;

  const apiKey = resolveApiKey();
  if (!apiKey) {
    const fallback = generateOfflineSuggestions(payload);
    setCached(key, fallback);
    return fallback;
  }

  // Cancel any in-flight request
  if (pendingAbort) {
    pendingAbort.abort();
  }
  pendingAbort = new AbortController();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(buildPrompt(payload));
    const text = result.response.text().trim();

    // Extract JSON from possible markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(jsonStr);

    let captions: string[] = Array.isArray(parsed.captions) ? parsed.captions.slice(0, 5) : [];
    captions = deduplicateCaptions(captions);

    const suggestions: SuggestionSet = {
      captions,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 12) : [],
      engagementHooks: Array.isArray(parsed.engagementHooks) ? parsed.engagementHooks.slice(0, 3) : [],
      improvedVersions: Array.isArray(parsed.improvedVersions) ? parsed.improvedVersions.slice(0, 3) : [],
      autoSelected: 0,
      category: typeof parsed.category === "string" ? parsed.category : "General",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    };

    setCached(key, suggestions);
    return suggestions;
  } catch (err) {
    console.warn("[SuggestionEngine] Gemini error, using offline fallback:", err);
    const fallback = generateOfflineSuggestions(payload);
    setCached(key, fallback);
    return fallback;
  }
}

// ── Analytics helpers (localStorage-backed) ─────────────────────────────────
const ANALYTICS_KEY = "flicks_suggestion_analytics";

export function getAnalytics(): SuggestionAnalytics {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    void 0;
  }
  return { shown: 0, selected: 0, ignored: 0, copied: 0 };
}

export function trackAnalytics(event: "shown" | "selected" | "ignored" | "copied") {
  try {
    const a = getAnalytics();
    a[event] += 1;
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(a));
  } catch {
    void 0;
  }
}
