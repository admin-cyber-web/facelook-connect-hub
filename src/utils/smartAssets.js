const DEFAULT_FLICKS_BANNER_URL =
  "https://i.ibb.co/HT7RvFxs/flicksindia.png";

export const SMART_ASSETS = [
  {
    key: "news",
    label: "News / Alerts",
    keywords: [
      "news",
      "breaking",
      "taza khabar",
      "update",
      "alert",
      "headline",
    ],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789906544/breaking-news-news_kbyw3w.gif",
  },
  {
    key: "weather",
    label: "Rain / Weather",
    keywords: ["rain", "barish", "paani", "weather", "mausam", "storm", "baarish"],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789910032/53559366_poem_51_dsooxk.gif",
  },
  {
    key: "accident",
    label: "Accident / Road / Transport",
    keywords: [
      "accident",
      "road",
      "sadak",
      "train",
      "crash",
      "collision",
      "vehicle",
      "truck",
      "bus",
    ],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789909936/accident_gif_nu6l80.gif",
  },
  {
    key: "love",
    label: "Love / Romance",
    keywords: ["love", "pyaar", "romance", "ishq", "mohabbat", "cute"],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789909951/romance-nithya_ryp0ii.gif",
  },
  {
    key: "intimate",
    label: "Intimate Actions",
    keywords: ["kiss", "hug", "jaanejaan", "partner"],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789909957/hug_nyyvtj.gif",
  },
  {
    key: "crime",
    label: "Crime / Police",
    keywords: [
      "kill",
      "murder",
      "chhor",
      "theif",
      "thief",
      "chor",
      "police",
      "crime",
      "arrest",
      "loot",
    ],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789909991/original-a78492f49551c56543eb2c1d6e9ccef6_kqwqwq.gif",
  },
  {
    key: "politics",
    label: "Politics / Government",
    keywords: ["government", "sarkar", "neta", "minister", "politics", "election", "vote"],
    imageUrl:
      "https://res.cloudinary.com/dzlazqbvf/image/upload/v1789909975/sarkar_neta_fina_w9oouh.gif",
  },
];

const normalizeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const matchesKeyword = (text, keyword) => {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;
  return ` ${text} `.includes(` ${normalizedKeyword} `);
};

export function findSmartAsset(text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  return (
    SMART_ASSETS.find((asset) =>
      asset.keywords.some((keyword) => matchesKeyword(normalizedText, keyword)),
    ) || null
  );
}

export function getSmartPostAsset(text) {
  const match = findSmartAsset(text);

  return {
    url: match?.imageUrl || DEFAULT_FLICKS_BANNER_URL,
    type: "image",
    source: match?.imageUrl ? "keyword" : "fallback",
    key: match?.key || "default",
  };
}

export { DEFAULT_FLICKS_BANNER_URL };