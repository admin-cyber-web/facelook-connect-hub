import { formatDistanceToNow, format, isAfter, subHours } from "date-fns";

/**
 * smartTime — dynamic timestamp formatter.
 *
 * < 24 hours old → relative  ("2 hours ago", "just now")
 * ≥ 24 hours old → absolute  ("May 24, 10:30 PM")
 *
 * Safe with null / undefined / invalid strings — returns "" instead of throwing.
 */
export function smartTime(raw: string | number | Date | null | undefined): string {
  if (!raw) return "";
  const date = raw instanceof Date ? raw : new Date(raw as string | number);
  if (isNaN(date.getTime())) return "";

  const cutoff = subHours(new Date(), 24);
  if (isAfter(date, cutoff)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "MMM d, h:mm a");
}
