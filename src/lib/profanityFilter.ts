// ═══════════════════════════════════════════════════════════════════════════
//  FLICKS INDIA — MULTILINGUAL PROFANITY FILTER ENGINE  (v2 — smart edition)
//
//  Key principles:
//  • Whole-word matching only — never censor inside legitimate words
//  • Explicit whitelist — news/Hindi words are NEVER censored
//  • Leet-speak detection applies only to known leet variants, not to
//    space-stripped arbitrary text (which caused cross-word false positives)
//  • Ambiguous short words removed from block-lists
// ═══════════════════════════════════════════════════════════════════════════

// ── Explicit Whitelist — NEVER censor these ───────────────────────────────
// Add any word here that was being falsely flagged.
const WHITELIST = new Set([
  // News / journalism
  "news", "badi", "khabar", "breaking", "update", "report", "headline",
  "latest", "saamne", "rahi", "aayi", "aaya", "aa", "raha", "hai",
  "india", "desh", "rajya", "sarkar", "netaji",
  // Common Hindi / Hinglish words often mistaken
  "saala", "sala", "saali", "sali",   // brother/sister-in-law
  "baal", "baalon",                    // hair
  "kutta", "kutte", "kutiya",          // dog (common noun)
  "kutti",                             // puppy / small dog
  "moot",                              // English legal term
  "dalal",                             // broker / agent
  "dalla",                             // agent
  "bur",                               // too short, multi-meaning
  "tatti",                             // common slang but too ambiguous
  "arse",                              // British English mild
  "damn", "damm",                      // mild
  "anal",  "penis", "vagina",          // medical terms
  "cum",                               // conflicts with "come"
  "boobs", "boobies",                  // too ambiguous for social context
  "cock",                              // rooster; too many false positives
  "dick",                              // common proper noun / name
  "ass",                               // donkey; too many false positives
  // Urdu / Hindi verbs / nouns commonly hit
  "chodo", "chhodo",                   // "leave it / let go" — imperative
  "maar", "maarke",                    // "beat/hit" — common usage
  "pissa", "pisab", "pesab",           // urine — medical
]);

// ── Helper: check if a word is whitelisted ────────────────────────────────
function isWhitelisted(word: string): boolean {
  return WHITELIST.has(word.toLowerCase().trim());
}

// ── Leet-speak normalization (used ONLY on isolated tokens, not full text) ──
function normalizeLeetToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/\+/g, "t")
    .replace(/!/g, "i")
    .replace(/%/g, "x")
    .replace(/8/g, "b")
    .replace(/6/g, "g")
    .replace(/9/g, "g")
    .replace(/</g, "c")
    .replace(/\(/g, "c")
    .replace(/\|/g, "i")
    .replace(/\^/g, "a");
}

// ── Word lists — only include words where there's NO common legitimate use ──

const ENGLISH_PROFANITY = [
  "fuck", "fucking", "fucker", "fucked", "fuk", "fck", "fuking",
  "shit", "shitting", "shitted", "sh1t", "sht",
  "bitch", "b1tch", "bich", "beetch",
  "asshole", "ashole",
  "bastard", "bstrd",
  "cunt", "cnt",
  "dik", "dikhead", "dickhead",
  "pussy", "pussies", "pusy",
  "c0ck", "kok",
  "slut", "slutt",
  "whore", "hore",
  "retard", "rtard",
  "nigger", "nigga", "n1gga", "n1gger",
  "chink", "ch1nk",
  "raghead",
  "beaner",
  "wetback",
  "tranny", "trannies",
  "dyke",
  "fag", "faggot", "fagot",
  "motherfucker", "mothafucka", "mthrfckr",
  "jizz", "sperm",
  "tits", "titty", "titties",
  "bollocks", "wanker", "twat",
];

const HINDI_HINGLISH_PROFANITY = [
  // Core expletives only — no ambiguous short words
  "madarchod", "madarchhod", "madharchhod", "madharchod", "madrchod",
  "bahanchod", "bahanchhod", "behenchod", "behenchhod", "bhenchod", "bhenchhod",
  "betichod", "betichhod",
  "chutiya", "chutiyapa", "chutiy",
  "bhosda", "bhosdi", "bhosdike",
  "gandu", "gandoo",
  "lund", "lund khajao", "lund chus",
  "loda", "laude", "lauda",
  "chuchi", "chuchiya", "choochi",
  "randi", "r@ndi", "randiya", "randva",
  "harami", "haramzada", "haramkhor",
  "suar",
  "gaand", "gaandu",
  "teri maa ki", "maa ka bhosda",
  "teri bahan", "teri bahin",
  "bhadwa", "bhadwe", "bhadva", "bhadve",
  "chakka", "chhakka",
  "hijda", "hijde", "hijra",
  "kamina", "kamine",
  "jhand", "jhaant", "jhaat",
  "tatte",
  "phuddi",
  "teri gaand", "teri gand",
  "fuddi",
  "chinal", "chhinal",
  "lanja", "lanje",
  "chod", "chhod", "chodu",
  "nalayak",
  "jhant",
  "mootna",
  "fuddu",
];

const BENGALI_PROFANITY = [
  "bokachoda",
  "magir put",
  "chuda", "chudi", "chude",
  "khanki", "khankir put",
  "baal choda",
  "voda mara",
  "chodon khor",
];

const GUJARATI_PROFANITY = [
  "bhosdo",
  "chodo", "chodi",
  "lodo", "lodi",
  "bhosdi no",
  "bhen no",
  "chutiya no",
  "randi no",
  "harami no",
];

// Combine all blocked words
const ALL_WORDS = [
  ...ENGLISH_PROFANITY,
  ...HINDI_HINGLISH_PROFANITY,
  ...BENGALI_PROFANITY,
  ...GUJARATI_PROFANITY,
];

// ── Whole-word regex builder ───────────────────────────────────────────────
// Uses \b word boundaries. For multi-word phrases, spaces become \s+.
// This is used for containsProfanity (fast check).
function buildWordBoundaryRegex(word: string): RegExp {
  try {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // For phrases (with spaces), replace space with flexible whitespace
    const pattern = escaped.replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${pattern}\\b`, "gi");
  } catch {
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  }
}

// ── Mask-safe regex builder ────────────────────────────────────────────────
// Same as above but also handles light obfuscation (dots, dashes, underscores
// between letters). Still uses \b so it never matches INSIDE a longer word.
function buildMaskRegex(word: string): RegExp | null {
  try {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Allow optional separators between chars to catch "f.u.c.k" etc.
    const flexed = escaped.split("").map(c => {
      if (c === " ") return "\\s+";
      return `${c}[.\\-_]?`;
    }).join("");
    return new RegExp(`\\b${flexed}\\b`, "gi");
  } catch {
    return null;
  }
}

// Pre-compile patterns for fast detection
const DETECTION_PATTERNS: Array<[string, RegExp]> = ALL_WORDS.map(w => [w, buildWordBoundaryRegex(w)]);

// ── Core API ──────────────────────────────────────────────────────────────

/**
 * Check if text contains any profanity.
 * Uses whole-word matching on original text + leet-normalized individual tokens.
 * Never concatenates words across spaces (prevents cross-word false positives).
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;

  // Step 1: check original text with word-boundary regex
  for (const [word, re] of DETECTION_PATTERNS) {
    if (isWhitelisted(word)) continue;
    re.lastIndex = 0;
    if (re.test(text)) return true;
  }

  // Step 2: check each individual token after leet normalization
  // (e.g. "fvck" → "fuck", "sh1t" → "shit")
  // We normalize token-by-token, NOT the concatenated string.
  const tokens = text.split(/\s+/);
  for (const token of tokens) {
    const normalized = normalizeLeetToken(token);
    if (normalized === token.toLowerCase()) continue; // no leet, already checked above
    if (isWhitelisted(normalized)) continue;
    for (const [word, re] of DETECTION_PATTERNS) {
      if (isWhitelisted(word)) continue;
      re.lastIndex = 0;
      if (re.test(normalized)) return true;
    }
  }

  return false;
}

/**
 * Mask every detected profane word with 🤬 repeated to match word length.
 * Respects word boundaries and the whitelist — never touches safe words.
 */
export function maskProfanity(text: string): string {
  if (!text) return text;
  let result = text;

  for (const word of ALL_WORDS) {
    if (isWhitelisted(word)) continue;
    const re = buildMaskRegex(word);
    if (!re) continue;
    result = result.replace(re, (match) => {
      // Double-check: don't censor if the matched surface form is whitelisted
      if (isWhitelisted(match)) return match;
      return match.length <= 20
        ? "🤬".repeat(Math.max(1, match.length))
        : "[Offensive Content 🚫]";
    });
  }

  return result;
}

/**
 * Sanitize text for DB storage: mask profanity so clean content is persisted.
 */
export function sanitizeText(text: string): { cleaned: string; hadProfanity: boolean } {
  const hadProfanity = containsProfanity(text);
  const cleaned = maskProfanity(text);
  return { cleaned, hadProfanity };
}
