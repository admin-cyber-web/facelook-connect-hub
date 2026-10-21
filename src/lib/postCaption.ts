type CaptionRecord = Record<string, unknown>;

const asRecord = (value: unknown): CaptionRecord | null => {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as CaptionRecord)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CaptionRecord)
    : null;
};

export function getPostCaption(post: unknown): string {
  if (!post || typeof post !== "object" || Array.isArray(post)) return "";

  const row = post as CaptionRecord;
  const metadata = asRecord(row.metadata);
  const metadataPost = asRecord(metadata?.post);
  const metadataReel = asRecord(metadata?.reel);
  const candidates = [
    row.content,
    row.caption,
    row.description,
    metadata?.caption,
    metadata?.content,
    metadata?.description,
    metadata?.text,
    metadataPost?.caption,
    metadataPost?.content,
    metadataReel?.caption,
    metadataReel?.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}
