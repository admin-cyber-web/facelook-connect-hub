const RUPEE_MARKERS = /(?:₹|INR|Rs\.?)/gi;

export function parseRupeeAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const cleaned = value
    .trim()
    .replace(RUPEE_MARKERS, "")
    .replace(/\/-/g, "")
    .replace(/[,\s]/g, "");
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return null;

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

export function formatRupeePrice(
  value: unknown,
  fallback = "Price on request",
): string {
  const amount = parseRupeeAmount(value);
  if (amount == null) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}/-`;
}

export function normalizeRupeeInput(value: string): string {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const decimalIndex = cleaned.indexOf(".");
  if (decimalIndex < 0) return cleaned;
  return `${cleaned.slice(0, decimalIndex)}.${cleaned.slice(decimalIndex + 1).replace(/\./g, "")}`;
}
