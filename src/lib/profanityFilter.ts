// ═══════════════════════════════════════════════════════════════════════════
//  FLICKS INDIA — MULTILINGUAL PROFANITY FILTER ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ── Leet-speak / obfuscation normalization map ─────────────────────────────
const LEET_MAP: Record<string, string> = {
  "@": "a", "4": "a", "^": "a",
  "8": "b",
  "<": "c", "(": "c",
  "3": "e",
  "6": "g", "9": "g",
  "1": "i", "!": "i", "|": "i",
  "0": "o",
  "$": "s", "5": "s",
  "7": "t", "+": "t",
  "v": "u", "\\/": "u",
  "%": "x",
  "2": "z",
};

function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\.\-_]+/g, "")
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/\+/g, "t")
    .replace(/\!/g, "i")
    .replace(/\%/g, "x")
    .replace(/8/g, "b")
    .replace(/6/g, "g")
    .replace(/9/g, "g")
    .replace(/</g, "c")
    .replace(/\(/g, "c")
    .replace(/\|/g, "i")
    .replace(/\^/g, "a");
}

// ── Word lists ────────────────────────────────────────────────────────────
const ENGLISH_PROFANITY = [
  "fuck", "fucking", "fucker", "fucked", "fuk", "fck", "fuking",
  "shit", "shitting", "shitted", "sh1t", "sht",
  "bitch", "b1tch", "bich", "beetch",
  "asshole", "ashole", "a$$hole", "a hole",
  "bastard", "bstrd",
  "damn", "damm",
  "cunt", "cnt",
  "dick", "d1ck", "dik", "dickhead",
  "pussy", "pussies", "pusy",
  "cock", "c0ck", "kok",
  "slut", "slutt",
  "whore", "hore",
  "retard", "rtard",
  "nigger", "nigga", "n1gga", "n1gger",
  "chink", "ch1nk",
  "raghead", "rag head",
  "beaner",
  "wetback",
  "tranny", "trannies",
  "dyke", "dike",
  "fag", "faggot", "fagot",
  "motherfucker", "mothafucka", "mthrfckr",
  "cum", "cumming", "jizz", "sperm",
  "tits", "titty", "titties",
  "boobs", "boobies", "b00bs",
  "penis", "peenis", "vagina", "vag1na",
  "anus", "anal", "arse",
  "bollocks", "wanker", "twat",
];

const HINDI_HINGLISH_PROFANITY = [
  // Core expletives
  "madarchod", "madarchhod", "madharchhod", "madharchod", "madar", "madrchod",
  "bahanchod", "bahanchhod", "behenchod", "behenchhod", "bhenchod", "bhenchhod",
  "betichod", "betichhod", "beti chod", "beti chhod",
  "chut", "choot", "chutiya", "chutiyapa", "chutiy",
  "bhosda", "bhosdi", "bhosda wala", "bhosdi wala", "bhosdike", "bhosdi ke",
  "gand", "gandu", "gandoo", "gandoo", "gand mar", "gand mara",
  "lund", "land", "lund khajao", "lund chus",
  "loda", "laude", "lauda",
  "bur", "boor", "bhoor",
  "chuchi", "chuchiya", "choochi",
  "randi", "r@ndi", "randiya", "randva",
  "kutiya", "kutti", "kutte", "kutta",
  "harami", "haramzada", "haramkhor",
  "suar", "suar ke",
  "gaand", "gaandu", "gaand mara",
  "teri maa", "teri maa ka", "maa ka", "maa ki", "maa ka bhosda",
  "teri bahan", "teri bahin", "bahan ka", "behen ka",
  "bhadwa", "bhadwe", "bhadva", "bhadve",
  "chakka", "chhakka",
  "hijda", "hijde", "hijra",
  "kamina", "kamine",
  "jhand", "jhaant", "jhaat",
  "tatte", "tatty", "tatti",
  "pissa", "pisab", "pesab",
  "saala", "saali", "sala", "sali",
  "chod", "chhod", "chodu",
  "nalayak", "nalayak ke",
  "jhant", "jhant ke",
  "moot", "mootna", "moot di",
  "phuddi", "phuddi wala",
  "teri gaand", "teri gand",
  "fuddi", "fuddu",
  "chinal", "chhinal",
  "nachaniya", "nachaniya",
  "lanja", "lanje",
  "dalla", "dalal",
];

const BENGALI_PROFANITY = [
  "boka", "bokachoda", "bokachoda", "bokachoda",
  "magir", "magi", "magir put",
  "shala", "shali",
  "choda", "chudi", "chude",
  "gud", "gud mara",
  "boro bokachoda",
  "khanki", "khankir put",
  "baal", "baal choda",
  "pacha", "pachar bata",
  "voda", "voda mara",
  "chodon", "chodon khor",
];

const GUJARATI_PROFANITY = [
  "bhosdo", "bhosdi",
  "chodo", "chodi",
  "gando", "gandi", "gandno",
  "lodo", "lodi",
  "bhosdi no",
  "bhen no",
  "ma no",
  "chutiya no",
  "randi no",
  "harami no",
];

// Combine all
const ALL_WORDS = [
  ...ENGLISH_PROFANITY,
  ...HINDI_HINGLISH_PROFANITY,
  ...BENGALI_PROFANITY,
  ...GUJARATI_PROFANITY,
];

// Build regex patterns
// We try exact word boundary first, then allow common obfuscation gaps
function buildRegex(word: string): RegExp {
  try {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flexiblePattern = escapedWord.split("").map(char => `${char}[\\s._-]*`).join("");
    return new RegExp(`\\b(${flexiblePattern})\\b`, "gi");
  } catch (e) {
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  }
}

const COMPILED_PATTERNS: RegExp[] = ALL_WORDS.map(buildRegex);

// ── Core API ──────────────────────────────────────────────────────────────

/**
 * Check if text contains any profanity.
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeLeet(text);
  for (const re of COMPILED_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) return true;
    re.lastIndex = 0;
    if (re.test(normalized)) return true;
  }
  return false;
}

/**
 * Mask every detected profane word with 🤬 repeated to match length.
 * Falls back to [Offensive Content 🚫] if the match is very long.
 */
export function maskProfanity(text: string): string {
  if (!text) return text;
  let result = text;
  const normalized = normalizeLeet(text);

  // ── Helper: safe regex builder (never throws) ──
  function escapeCharForRegex(c: string): string {
    if (c === " ") return "[\\s._-]*";
    return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildSafeRegex(word: string): RegExp | null {
    try {
      const spaced = word.replace(/\s+/g, "[\\s._-]*");
      const loosePat = spaced
        .split("")
        .map((c) => {
          if (/[aà-åāăąä]/.test(c)) return "[a@à-åāăąä]";
          if (/[eè-ëēĕėęě]/.test(c)) return "[e3è-ëēĕėęě]";
          if (/[iì-ïīĭįı]/.test(c)) return "[i1!ì-ïīĭįı]";
          if (/[oò-öōŏő]/.test(c)) return "[o0ò-öōŏő]";
          if (/[sśŝşš]/.test(c)) return "[s$5śŝşš]";
          if (/[tţťŧ]/.test(c)) return "[t7+ţťŧ]";
          if (/[uù-üũūŭůűų]/.test(c)) return "[uvù-üũūŭůűų]";
          if (/[b]/.test(c)) return "[b8]";
          if (/[g]/.test(c)) return "[g69]";
          if (/[c]/.test(c)) return "[c<(]";
          return escapeCharForRegex(c);
        })
        .join("[\\W_]*");
      return new RegExp(loosePat, "gi");
    } catch (err) {
      console.error(`[ProfanityFilter] buildSafeRegex failed for "${word}":`, err);
      return null;
    }
  }

  // Track matches on original text via loose pattern
  for (const word of ALL_WORDS) {
    const re = buildSafeRegex(word);
    if (!re) continue;
    result = result.replace(re, (match) => {
      if (match.length <= 20) {
        return "🤬".repeat(Math.max(1, match.length));
      }
      return "[Offensive Content 🚫]";
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
