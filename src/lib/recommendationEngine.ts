/**
 * Flicks India — Recommendation Engine
 *
 * Scores & ranks other users for the "People You May Know" and
 * "New in Your Area" discovery surfaces based on:
 *   • Geo-proximity  (pincode > city > district > state)
 *   • Shared interests
 *   • Profile freshness / new-user boost
 *   • Small jitter so lists feel alive
 *
 * Privacy guarantees:
 *   • is_private_mode  → always excluded
 *   • profile_hidden   → always excluded
 *   • blocked users    → excluded on both sides
 *   • viewer prefs     → rec_people_nearby / rec_interests toggles respected
 */

import { supabase } from "./supabaseClient";
import { memGet, memGetOrFetch, memDel } from "./memCache";

// ── Interest catalogue ────────────────────────────────────────────────────────

export const INTERESTS_LIST = [
  "Cricket", "Football", "Music", "Movies", "Web Series", "Comedy", "Gaming",
  "Education", "Business", "Technology", "Food", "Travel", "Photography",
  "Fashion", "Fitness", "Local Culture", "News & Politics", "Entertainment",
  "Art & Drawing", "Dance", "Health & Wellness", "Spirituality", "Farming",
  "Finance", "Bollywood", "Memes", "Cooking", "Yoga", "Startup",
] as const;

export type InterestTag = typeof INTERESTS_LIST[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocalProfile {
  state?:             string | null;
  district?:          string | null;
  city?:              string | null;
  pincode?:           string | null;
  interests?:         string[] | null;
  rec_local_first?:   boolean;
  rec_people_nearby?: boolean;
  rec_interests?:     boolean;
  rec_new_users?:     boolean;
}

export interface RecommendedUser {
  id:             string;
  full_name:      string | null;
  avatar_url:     string | null;
  username:       string | null;
  fame_points?:   number;
  state?:         string | null;
  district?:      string | null;
  city?:          string | null;
  pincode?:       string | null;
  interests:      string[];
  created_at?:    string | null;
  reason:         string;   // human-readable: "From Lucknow" / "3 shared interests"
  reasonDetail?:  string;   // full explanation for "Why am I seeing this?"
  score:          number;
  isNew:          boolean;  // joined < 7 days ago
  mutualCount?:   number;   // number of mutual friends
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function geoScore(v: LocalProfile, c: any): number {
  if (!v.state) return 0;
  if (c.pincode  && v.pincode  && c.pincode  === v.pincode)                              return 40;
  if (c.city     && v.city     && c.city    .toLowerCase() === v.city    .toLowerCase()) return 30;
  if (c.district && v.district && c.district.toLowerCase() === v.district.toLowerCase()) return 20;
  if (c.state    && v.state    && c.state   .toLowerCase() === v.state   .toLowerCase()) return 8;
  return 0;
}

function interestScore(viewerInts: string[], candidateInts: string[]): number {
  if (!viewerInts.length || !candidateInts.length) return 0;
  const vSet = new Set(viewerInts.map(i => i.toLowerCase()));
  const matches = candidateInts.filter(i => vSet.has(i.toLowerCase())).length;
  return Math.min(matches * 5, 25);
}

function freshnessScore(createdAt?: string | null): number {
  if (!createdAt) return 0;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (days < 1)  return 20;
  if (days < 3)  return 15;
  if (days < 7)  return 10;
  if (days < 30) return 3;
  return 0;
}

function isNewUser(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) < 7 * 86_400_000;
}

function buildReason(v: LocalProfile, c: any, sharedInterests: number, mutualCount = 0): string {
  if (c.pincode  && v.pincode  && c.pincode  === v.pincode)                              return "From your area";
  if (c.city     && v.city     && c.city    .toLowerCase() === v.city    .toLowerCase()) return `From ${c.city}`;
  if (c.district && v.district && c.district.toLowerCase() === v.district.toLowerCase()) return `From ${c.district}`;
  if (c.state    && v.state    && c.state   .toLowerCase() === v.state   .toLowerCase()) return `From ${c.state}`;
  if (mutualCount >= 2) return `${mutualCount} mutual friends`;
  if (mutualCount === 1) return "1 mutual friend";
  if (sharedInterests >= 3) return `${sharedInterests} shared interests`;
  if (sharedInterests >= 1) return "Similar interests";
  return "On Flicks India";
}

function buildReasonDetail(v: LocalProfile, c: any, sharedInterests: number, mutualCount: number, isNew: boolean): string {
  const parts: string[] = [];
  // Location
  if (c.pincode  && v.pincode  && c.pincode  === v.pincode)                              parts.push("Same pincode as you");
  else if (c.city && v.city    && c.city    .toLowerCase() === v.city    .toLowerCase()) parts.push(`Lives in ${c.city} like you`);
  else if (c.district && v.district && c.district.toLowerCase() === v.district.toLowerCase()) parts.push(`From ${c.district}, same as you`);
  else if (c.state && v.state  && c.state   .toLowerCase() === v.state   .toLowerCase()) parts.push(`From ${c.state}`);
  // Mutual
  if (mutualCount > 0) parts.push(`${mutualCount} mutual friend${mutualCount > 1 ? "s" : ""}`);
  // Interests
  if (sharedInterests > 0) parts.push(`${sharedInterests} shared interest${sharedInterests > 1 ? "s" : ""}`);
  // New
  if (isNew) parts.push("Recently joined Flicks India");
  return parts.length > 0 ? parts.join(" · ") : "Active on Flicks India";
}

// These resources are shared by both discovery surfaces.  Keeping the raw
// rows separate from the ranked results means a second mounted surface can
// reuse an in-flight request without sharing mutable result arrays.
const PROFILE_KEY = "recommendations:public-profiles:v1";
const BLOCK_KEY = (id: string) => `recommendations:blocks:${id}`;
const FRIEND_KEY = (id: string) => `recommendations:friends:${id}`;
const RESOURCE_KEY = (id: string) => `recommendations:resources:${id}`;
let resourceGeneration = 0;

type ProfileRow = {
  id: string; full_name: string | null; avatar_url: string | null;
  username: string | null; fame_points?: number; state?: string | null;
  district?: string | null; city?: string | null; pincode?: string | null;
  interests?: string[] | null; created_at?: string | null;
};

async function getPublicProfiles(): Promise<ProfileRow[]> {
  return memGetOrFetch(PROFILE_KEY, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,username,fame_points,state,district,city,pincode,interests,created_at")
      .eq("is_private_mode", false)
      .eq("profile_hidden", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(150);
    if (error) throw error;
    return (data ?? []) as ProfileRow[];
  });
}

async function getBlocks(currentUserId: string): Promise<Set<string>> {
  const rows = await memGetOrFetch(BLOCK_KEY(currentUserId), async () => {
    const { data, error } = await supabase.from("user_blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`)
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });
  return new Set(rows.map((b: any) => b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id));
}

async function getFriends(currentUserId: string): Promise<Set<string>> {
  const rows = await memGetOrFetch(FRIEND_KEY(currentUserId), async () => {
    const { data, error } = await supabase.from("friend_requests")
      .select("receiver_id,sender_id")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .eq("status", "accepted")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });
  return new Set(rows.map((f: any) => f.sender_id === currentUserId ? f.receiver_id : f.sender_id));
}

type RecommendationResources = {
  candidates: ProfileRow[];
  blocked: Set<string>;
  friends: Set<string>;
};

/**
 * Both recommendation surfaces are mounted in the same feed. Resolve their
 * shared source data through one in-flight/cache entry so the two components
 * never bootstrap the same resource bundle independently.
 */
async function getRecommendationResources(currentUserId: string): Promise<RecommendationResources> {
  return memGetOrFetch(RESOURCE_KEY(currentUserId), async () => {
    const [candidates, blocked, friends] = await Promise.all([
      getPublicProfiles(),
      getBlocks(currentUserId),
      getFriends(currentUserId),
    ]);
    return { candidates, blocked, friends };
  });
}

/** Call after a block, unblock, friend request, or profile/privacy mutation. */
export function invalidateRecommendationCaches(currentUserId: string): void {
  resourceGeneration += 1;
  memDel(PROFILE_KEY);
  memDel(BLOCK_KEY(currentUserId));
  memDel(FRIEND_KEY(currentUserId));
  memDel(RESOURCE_KEY(currentUserId));
}

// ── Public: People You May Know ───────────────────────────────────────────────

export async function fetchRecommendedPeople(
  currentUserId: string,
  viewer: LocalProfile,
  limit = 9,
): Promise<RecommendedUser[]> {
  const cacheKey = `recommendations:${resourceGeneration}:${currentUserId}:${JSON.stringify({
    state: viewer.state ?? null,
    district: viewer.district ?? null,
    city: viewer.city ?? null,
    pincode: viewer.pincode ?? null,
    interests: viewer.interests ?? [],
    nearby: viewer.rec_people_nearby !== false,
    similar: viewer.rec_interests !== false,
    limit,
  })}`;
  const cached = memGet<RecommendedUser[]>(cacheKey);
  if (cached) return cached;
  const { candidates, blocked, friends } =
    await getRecommendationResources(currentUserId);

  // ── Mutual connections: fetch friends-of-friends ──────────────────────────
  // Only run when viewer has ≤ 60 friends (keep query cost bounded)
  const friendsList = Array.from(friends);
  const mutualMap = new Map<string, number>(); // candidate_id → mutual friend count
  if (friendsList.length > 0 && friendsList.length <= 60) {
    const { data: fofRows } = await supabase
      .from("friend_requests")
      .select("sender_id,receiver_id")
      .or(`sender_id.in.(${friendsList.join(",")}),receiver_id.in.(${friendsList.join(",")})`)
      .eq("status", "accepted")
      .limit(1000);
    for (const row of fofRows ?? []) {
      const isFromFriend = friends.has(row.sender_id);
      const other        = isFromFriend ? row.receiver_id : row.sender_id;
      // other must be a non-viewer, non-friend candidate
      if (other !== currentUserId && !friends.has(other)) {
        mutualMap.set(other, (mutualMap.get(other) ?? 0) + 1);
      }
    }
  }

  const viewerInts   = viewer.interests ?? [];
  const useLocation  = viewer.rec_people_nearby !== false;
  const useInterests = viewer.rec_interests     !== false;

  const results = candidates
    .filter(c => c.id !== currentUserId)
    .filter(c => !blocked.has(c.id) && !friends.has(c.id))
    .map(c => {
      const cInts: string[] = Array.isArray(c.interests) ? c.interests : [];
      const vSet      = new Set(viewerInts.map(x => x.toLowerCase()));
      const shared    = cInts.filter(x => vSet.has(x.toLowerCase())).length;
      const mutual    = mutualMap.get(c.id) ?? 0;
      const newUser   = isNewUser(c.created_at);

      const score =
        (useLocation  ? geoScore(viewer, c)              : 0) +
        (useInterests ? interestScore(viewerInts, cInts) : 0) +
        freshnessScore(c.created_at)                         +
        Math.min(mutual * 8, 20)                             + // mutual friends bonus
        Math.random() * 3;                                     // jitter

      return {
        ...c,
        interests:    cInts,
        score,
        reason:       buildReason(viewer, c, shared, mutual),
        reasonDetail: buildReasonDetail(viewer, c, shared, mutual, newUser),
        isNew:        newUser,
        mutualCount:  mutual,
      } as RecommendedUser;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return memGetOrFetch(cacheKey, async () => results);
}

// ── Public: New in Your Area ──────────────────────────────────────────────────

export async function fetchNewInYourArea(
  currentUserId: string,
  viewer: LocalProfile,
  limit = 8,
): Promise<RecommendedUser[]> {
  if (!viewer.state && !viewer.district && !viewer.city) return [];
  const area = viewer.district || viewer.city || viewer.state || "";
  const cacheKey = `new-in-area:${resourceGeneration}:${currentUserId}:${area}:${limit}`;
  const cached = memGet<RecommendedUser[]>(cacheKey);
  if (cached) return cached;
  const { candidates, blocked, friends } =
    await getRecommendationResources(currentUserId);
  const cutoff = Date.now() - 30 * 86_400_000;
  const results = candidates
    .filter(u => u.id !== currentUserId && !blocked.has(u.id) && !friends.has(u.id))
    .filter(u => !u.created_at || new Date(u.created_at).getTime() >= cutoff)
    .filter(u => viewer.district ? u.district === viewer.district
      : viewer.city ? u.city === viewer.city : u.state === viewer.state)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .map(u => ({
      ...u,
      interests: Array.isArray(u.interests) ? u.interests : [],
      score:     freshnessScore(u.created_at) + 50,
      reason:    buildReason(viewer, u, 0),
      isNew:     true,
    }))
    .slice(0, limit);
  return memGetOrFetch(cacheKey, async () => results);
}
