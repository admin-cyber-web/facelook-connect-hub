// Shared mention utilities — parsing, validation, types.

export type MentionKind = "friend" | "pin" | "team";

export interface Mention {
  kind: MentionKind;
  /** Display token used in caption (e.g. "pin", "team", or a friend's username/full_name) */
  username: string;
  /** Friendly display name (full_name) */
  name?: string;
  /** Resolved user id for "friend" kind. Undefined for pin/team. */
  user_id?: string;
  /** Circle id for "team" kind (the user's active circle). */
  circle_id?: string;
}

/** Match @something where "something" can include letters, digits, _, and spaces inside _ tokens. */
export const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g;

/** Parse raw mentions out of caption text. Returns unique tokens (lowercased). */
export function extractMentionTokens(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (!content) return out;
  let m: RegExpExecArray | null;
  // Reset regex state — global regex carries lastIndex across calls.
  const re = new RegExp(MENTION_REGEX.source, "g");
  while ((m = re.exec(content)) !== null) {
    const token = m[1].toLowerCase();
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/** Build a slug-style username from a full name (lowercase, underscores). */
export function nameToUsername(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}
