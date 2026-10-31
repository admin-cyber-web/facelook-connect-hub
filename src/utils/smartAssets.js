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
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
  },
  {
    key: "weather",
    label: "Rain / Weather",
    keywords: ["rain", "barish", "paani", "weather", "mausam", "storm", "baarish"],
    imageUrl:
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
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
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
  },
  {
    key: "love",
    label: "Love / Romance",
    keywords: ["love", "pyaar", "romance", "ishq", "mohabbat", "cute"],
    imageUrl:
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
  },
  {
    key: "intimate",
    label: "Intimate Actions",
    keywords: ["kiss", "hug", "jaanejaan", "partner"],
    imageUrl:
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
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
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
  },
  {
    key: "politics",
    label: "Politics / Government",
    keywords: ["government", "sarkar", "neta", "minister", "politics", "election", "vote"],
    imageUrl:
      "https://i.ibb.co/HT7RvFxs/flicksindia.png",
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
