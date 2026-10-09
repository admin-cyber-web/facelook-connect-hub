/**
 * Chat 19 — Anonymous City Radar Chat (Flicks India)
 * Theme: Velvet-Red (#E11D48 / #A01030) on Deep Charcoal (#0D0C0F)
 *
 * Module flow:
 *   1. Onboarding  — Flicks account linking, fake display name with auto-unique
 *                    suffix, gender/preference selectors, custom avatar picker.
 *   2. Location    — city selection (Varanasi, Lucknow, ...) + manual override.
 *   3. Radar       — live active-users counter per city (Supabase Realtime
 *                    presence), animated velvet-red cyber-pulse/virus-scan
 *                    radar with interactive pings, 10 free scans per day.
 *   4. Chat        — private anonymous chat, glowing crimson bubbles, dark
 *                    charcoal background, typing indicators, strict real-name
 *                    hiding (real name / email / phone auto-masked).
 *
 * This file is fully self-contained. No existing Flicks component is modified.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Lock,
  MapPin,
  MessageCircle,
  Radar as RadarIcon,
  Search,
  Send,
  Shuffle,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// ── Storage keys ─────────────────────────────────────────────────────────────
const STORAGE_PROFILE = "chat19_profile_v1";
const STORAGE_TOKENS = "chat19_tokens_v1";
const STORAGE_NAMES = "chat19_name_registry_v1";
const DAILY_FREE_TOKENS = 10;

// ── Types ────────────────────────────────────────────────────────────────────
type Gender = "female" | "male" | "other" | "secret";
type Preference = "everyone" | "female" | "male";

interface Chat19Profile {
  linkedId: string;      // real Flicks account id (never shown to peers)
  linkedEmail: string;   // never shown to peers
  realName: string;      // never shown to peers — scrubbed from messages
  fakeName: string;      // public anonymous identity e.g. "VelvetRider #K7Q2"
  anonId: string;        // stable anonymous presence/room id
  gender: Gender;
  preference: Preference;
  avatar: number;        // index into AVATARS
  city: string;
  manualCity: boolean;
  createdAt: number;
}

interface Peer {
  anonId: string;
  fakeName: string;
  avatar: number;
  gender: Gender;
  ghost?: boolean; // simulated "echo signal" used when nobody else is live
}

interface C19Msg {
  id: string;
  from: string; // anonId of sender
  text: string;
  at: number;
}

type Step = "onboard" | "city" | "radar" | "chat";

// ── Cities (preset list + manual override) ───────────────────────────────────
const PRESET_CITIES = [
  "Varanasi", "Lucknow", "Kanpur", "Prayagraj", "Agra", "Gorakhpur",
  "Jhansi", "Meerut", "Patna", "Ranchi", "Bhopal", "Indore",
  "Jaipur", "Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru",
  "Hyderabad", "Chandigarh",
];

// ── Custom avatar tiles (emoji on velvet gradients) ──────────────────────────
const AVATARS: { emoji: string; grad: string }[] = [
  { emoji: "🦊", grad: "linear-gradient(135deg,#A01030,#3A0412)" },
  { emoji: "🌹", grad: "linear-gradient(135deg,#7A0C24,#1C0108)" },
  { emoji: "🐱", grad: "linear-gradient(135deg,#4C0A1B,#0F0D10)" },
  { emoji: "🎧", grad: "linear-gradient(135deg,#E11D48,#5B0718)" },
  { emoji: "🌙", grad: "linear-gradient(135deg,#2B0A14,#121114)" },
  { emoji: "⚡", grad: "linear-gradient(135deg,#B01236,#24020D)" },
  { emoji: "👑", grad: "linear-gradient(135deg,#8E0F2B,#4A3A07)" },
  { emoji: "🐉", grad: "linear-gradient(135deg,#6B0B22,#16090C)" },
  { emoji: "🎭", grad: "linear-gradient(135deg,#3C0713,#0B0B0F)" },
  { emoji: "🔥", grad: "linear-gradient(135deg,#C21033,#7A2B06)" },
  { emoji: "🥀", grad: "linear-gradient(135deg,#5C0A1E,#1A181C)" },
  { emoji: "🛰️", grad: "linear-gradient(135deg,#930F2C,#2A0A2E)" },
];

const GENDER_OPTS: { k: Gender; l: string; e: string }[] = [
  { k: "female", l: "Girl", e: "👩" },
  { k: "male", l: "Boy", e: "👨" },
  { k: "other", l: "Other", e: "🧑" },
  { k: "secret", l: "Secret", e: "🕶" },
];

const PREF_OPTS: { k: Preference; l: string; e: string }[] = [
  { k: "everyone", l: "Everyone", e: "🌐" },
  { k: "female", l: "Girls", e: "👩" },
  { k: "male", l: "Boys", e: "👨" },
];

// ── Ghost ("echo signal") identities + scripted replies ──────────────────────
const GHOST_BASES = [
  "VelvetRider", "CrimsonSoul", "MidnightRose", "CharcoalFox", "RedSignal",
  "NightBloom", "EchoStranger", "RaniNine", "ShadowLassi", "PureVelvet",
  "DarkCherry", "LostSignal",
];

const GHOST_REPLIES = {
  greeting: [
    "Hey stranger! Kaise ho? 😊",
    "Hi! Radar pe aake accha laga 🌹",
    "Hello hello! Bored ho raha tha, tum aa gaye 💫",
  ],
  question: [
    "Accha sawaal! Tum batao pehle 😄",
    "Hmm… itna sure nahi hoon 🤔",
    "Sach kahun toh pata nahi — tum kya sochte ho?",
  ],
  default: [
    "Haha, nice! 😄",
    "Sahi baat hai 🌹",
    "Aur batao, kya chal raha hai?",
    "Same here yaar 😅",
    "Tumhe radar pe deh ke surprise hua ✨",
    "Chalo baat karte hain, bore mat hona 💬",
  ],
};

// ── Local-storage helpers (fail-safe) ────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — ignore */
  }
}

// ── Daily token (10 free scans) helpers ──────────────────────────────────────
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function msUntilMidnight(): number {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  return mid.getTime() - now.getTime();
}

function fmtCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function loadTokens(): { date: string; used: number } {
  const saved = lsGet<{ date: string; used: number }>(STORAGE_TOKENS, {
    date: todayKey(),
    used: 0,
  });
  if (saved.date !== todayKey()) return { date: todayKey(), used: 0 };
  const used = Math.min(Math.max(Number(saved.used) || 0, 0), DAILY_FREE_TOKENS);
  return { date: saved.date, used };
}

// ── Anonymous identity helpers ───────────────────────────────────────────────
function randSuffix(len = 4): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const buf = new Uint32Array(len);
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
    else throw new Error("no crypto");
  } catch {
    for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(buf, (n) => abc[n % abc.length]).join("");
}

function sanitizeBase(value: string): string {
  return value
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
}

function takenNames(extra: string[] = []): Set<string> {
  const registry = lsGet<string[]>(STORAGE_NAMES, []);
  const set = new Set<string>();
  registry.forEach((n) => set.add(String(n).toUpperCase()));
  extra.forEach((n) => set.add(String(n).toUpperCase()));
  return set;
}

/** Rolls the auto-unique suffix until the full display name is unused. */
function makeUniqueFakeName(base: string, taken: Set<string>): string {
  for (let i = 0; i < 14; i++) {
    const candidate = `${base} #${randSuffix()}`;
    if (!taken.has(candidate.toUpperCase())) return candidate;
  }
  return `${base} #${randSuffix(6)}`;
}

function registerFakeName(name: string): void {
  const registry = lsGet<string[]>(STORAGE_NAMES, []);
  if (!registry.includes(name)) registry.push(name);
  lsSet(STORAGE_NAMES, registry.slice(-40));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "city";
}

function hashStr(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Deterministic polar position for a ping inside the radar dial (in %). */
function pingPos(id: string): { x: number; y: number } {
  const h = hashStr(id);
  const angle = ((h % 360) * Math.PI) / 180;
  const radius = 0.24 + ((h >>> 3) % 62) / 100; // 0.24 → 0.85 of half-dial
  const x = 50 + Math.cos(angle) * radius * 50;
  const y = 50 + Math.sin(angle) * radius * 50;
  return { x: Math.min(92, Math.max(8, x)), y: Math.min(92, Math.max(8, y)) };
}

/** Symmetric room key so both strangers join the same DM channel. */
function roomFor(a: string, b: string): string {
  return [a, b].sort().join("_");
}

function msgStoreKey(room: string): string {
  return `chat19_msgs_v1_${room}`;
}

function loadMsgs(room: string): C19Msg[] {
  const list = lsGet<C19Msg[]>(msgStoreKey(room), []);
  return Array.isArray(list) ? list : [];
}

function saveMsgs(room: string, msgs: C19Msg[]): void {
  lsSet(msgStoreKey(room), msgs.slice(-300));
}

function uid(): string {
  return `${Date.now().toString(36)}-${randSuffix(6)}`;
}

function ghostName(seed: number): string {
  const base = GHOST_BASES[seed % GHOST_BASES.length];
  return `${base} #${1000 + (seed % 9000)}`;
}

/**
 * STRICT REAL-NAME HIDING — masks my own real name, both linked emails,
 * every email address and 10-digit phone numbers inside message text.
 */
function buildScrubber(parts: string[]): (text: string) => string {
  const clean = parts.map((p) => p.trim()).filter((p) => p.length >= 3);
  return (text: string) => {
    let out = text;
    for (const part of clean) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(escaped, "gi"), "▓▓▓");
    }
    out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "▓▓▓@hidden");
    out = out.replace(/\b\d{10}\b/g, "▓▓▓▓▓▓▓▓▓▓");
    return out;
  };
}

/** Broadcast send that never throws (channel may be absent/reconnecting). */
function safeSend(
  ch: ReturnType<typeof supabase.channel> | null,
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!ch) return;
  try {
    void Promise.resolve(ch.send({ type: "broadcast", event, payload })).catch(() => {});
  } catch {
    /* channel torn down mid-send — ignore */
  }
}

// ── Small presentational helpers ─────────────────────────────────────────────
function GlowBtn({
  children,
  onClick,
  disabled,
  ghost = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ghost?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 font-black text-[12.5px] uppercase tracking-[0.14em] rounded-2xl py-3.5 transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={
        ghost
          ? {
              background: "rgba(225,29,72,.08)",
              border: "1.5px solid rgba(225,29,72,.45)",
              color: "#FF6B85",
            }
          : {
              background: "linear-gradient(135deg,#A01030,#5E0719)",
              border: "1.5px solid rgba(255,77,110,.45)",
              color: "#fff",
              boxShadow: "0 0 22px rgba(225,29,72,.38), inset 0 1px 0 rgba(255,255,255,.14)",
            }
      }
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-[12px] font-black transition-all active:scale-95 ${className}`}
      style={
        active
          ? {
              background: "linear-gradient(135deg,#A01030,#6B0719)",
              border: "1.5px solid rgba(255,77,110,.65)",
              color: "#fff",
              boxShadow: "0 0 14px rgba(225,29,72,.4)",
            }
          : {
              background: "rgba(255,255,255,.04)",
              border: "1.5px solid rgba(225,29,72,.18)",
              color: "rgba(255,255,255,.62)",
            }
      }
    >
      {children}
    </button>
  );
}

/** Typing indicator — three crimson dots. */
function Dots() {
  return (
    <span className="inline-flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "#FF4D6D",
            boxShadow: "0 0 6px rgba(225,29,72,.8)",
            animation: `c19-dot 1.1s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

function AvatarBadge({
  idx,
  size = 40,
  ring = true,
}: {
  idx: number;
  size?: number;
  ring?: boolean;
}) {
  const a = AVATARS[((idx % AVATARS.length) + AVATARS.length) % AVATARS.length];
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: a.grad,
        border: ring ? "1.5px solid rgba(255,77,110,.55)" : "1.5px solid rgba(255,255,255,.12)",
        boxShadow: ring ? "0 0 12px rgba(225,29,72,.35)" : undefined,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
    >
      {a.emoji}
    </div>
  );
}

/** Velvet-red cyber keyframes (injected once per mount). */
const C19_KEYFRAMES = `
@keyframes c19-sweep { to { transform: rotate(360deg); } }
@keyframes c19-wave {
  0%   { transform: scale(.30); opacity: .9; }
  80%  { opacity: .12; }
  100% { transform: scale(1.22); opacity: 0; }
}
@keyframes c19-ping {
  0%, 100% { transform: translate(-50%,-50%) scale(1); }
  50%      { transform: translate(-50%,-50%) scale(1.3); }
}
@keyframes c19-halo {
  0%   { transform: translate(-50%,-50%) scale(.55); opacity: .75; }
  100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; }
}
@keyframes c19-burst {
  0%   { transform: scale(.15); opacity: 1; }
  100% { transform: scale(1.5);  opacity: 0; }
}
@keyframes c19-dot {
  0%, 60%, 100% { transform: translateY(0);   opacity: .45; }
  30%           { transform: translateY(-4px); opacity: 1; }
}
@keyframes c19-scanline {
  0%   { top: -6%; opacity: 0; }
  12%  { opacity: 1; }
  88%  { opacity: 1; }
  100% { top: 104%; opacity: 0; }
}
@keyframes c19-blip {
  0%, 100% { opacity: .35; }
  50%      { opacity: 1; }
}
.c19-scroll::-webkit-scrollbar { width: 5px; }
.c19-scroll::-webkit-scrollbar-thumb { background: rgba(225,29,72,.35); border-radius: 99px; }
.c19-scroll::-webkit-scrollbar-track { background: transparent; }
`;

// ── Main component ───────────────────────────────────────────────────────────
interface Chat19Props {
  onClose?: () => void;
}

const Chat19 = ({ onClose }: Chat19Props) => {
  const navigate = useNavigate();
  const close = onClose ?? (() => navigate("/"));

  // ── Flicks account link (real identity — ONLY shown on this onboarding card) ─
  const [linked, setLinked] = useState<{
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  } | null>(null);
  const [linking, setLinking] = useState(true);

  // ── Persisted anonymous profile ────────────────────────────────────────────
  const [profile, setProfile] = useState<Chat19Profile | null>(() =>
    lsGet<Chat19Profile | null>(STORAGE_PROFILE, null),
  );
  const [step, setStep] = useState<Step>(() =>
    lsGet<Chat19Profile | null>(STORAGE_PROFILE, null) ? "radar" : "onboard",
  );

  // Onboarding form
  const [baseName, setBaseName] = useState("");
  const [suffix, setSuffix] = useState(() => randSuffix());
  const [gender, setGender] = useState<Gender>("secret");
  const [preference, setPreference] = useState<Preference>("everyone");
  const [avatarIdx, setAvatarIdx] = useState(0);

  // City form
  const [cityQuery, setCityQuery] = useState("");
  const [manualOn, setManualOn] = useState(false);
  const [manualCity, setManualCity] = useState("");
  const [pickedCity, setPickedCity] = useState<string | null>(null);

  // Radar
  const [peers, setPeers] = useState<Peer[]>([]);
  const [liveCount, setLiveCount] = useState(1);
  const [signalLive, setSignalLive] = useState(false);
  const [tokens, setTokens] = useState(loadTokens);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selectedPing, setSelectedPing] = useState<Peer | null>(null);
  const [incoming, setIncoming] = useState<{ peer: Peer; room: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ghostSalt] = useState(() => Math.floor(Math.random() * 1_000_000));

  // Chat
  const [activePeer, setActivePeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<C19Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const cityChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dmChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomRef = useRef<string>("");
  const scrubRef = useRef<(t: string) => string>((t) => t);
  const typingHideRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<Chat19Profile | null>(profile);
  profileRef.current = profile;

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  // ── Link the signed-in Flicks account ─────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", session.user.id)
            .maybeSingle();
          if (dead) return;
          setLinked({
            id: session.user.id,
            email: session.user.email || "",
            name:
              prof?.full_name ||
              session.user.user_metadata?.full_name ||
              (session.user.email || "").split("@")[0] ||
              "Flicks User",
            avatar: prof?.avatar_url || session.user.user_metadata?.avatar_url || null,
          });
        }
      } catch {
        /* offline / no session — guest mode still works */
      } finally {
        if (!dead) setLinking(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Auto-seed the fake-name base from the linked account (first word only)
  useEffect(() => {
    if (!baseName && linked?.name) {
      const first = sanitizeBase(linked.name.split(" ")[0]);
      if (first) setBaseName(first);
    }
  }, [linked, baseName]);

  // STRICT REAL-NAME HIDING — keep the scrubber in sync with linked identity
  useEffect(() => {
    scrubRef.current = buildScrubber([
      profileRef.current?.realName || linked?.name || "",
      profileRef.current?.linkedEmail || linked?.email || "",
    ]);
  }, [profile?.realName, profile?.linkedEmail, linked?.name, linked?.email]);

  // Seed the city form from the saved profile
  useEffect(() => {
    if (!profile) return;
    setPickedCity(profile.city || null);
    setManualOn(profile.manualCity);
    setManualCity(profile.manualCity ? profile.city : "");
  }, [profile]);

  // Pre-fill the identity form when editing an existing profile
  useEffect(() => {
    if (!profile || step !== "onboard") return;
    const [base, sfx] = profile.fakeName.split("#");
    setBaseName(sanitizeBase(base));
    if (sfx) setSuffix(sfx.trim());
    setGender(profile.gender);
    setPreference(profile.preference);
    setAvatarIdx(profile.avatar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Radar ticker — rolls the 10 free tokens over at midnight
  useEffect(() => {
    if (step !== "radar") return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      const fresh = loadTokens();
      setTokens((prev) => (prev.date === fresh.date && prev.used === fresh.used ? prev : fresh));
    }, 15_000);
    return () => window.clearInterval(id);
  }, [step]);

  // Auto-scroll the chat to the newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, peerTyping, step]);

  // Cleanup every pending timer on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      if (typingHideRef.current) window.clearTimeout(typingHideRef.current);
    };
  }, []);

  // ── CITY PRESENCE CHANNEL — live counter + radar pings + invites ──────────
  const onRadar = step === "radar";
  useEffect(() => {
    if (!onRadar || !profile) return;
    let cancelled = false;

    const ch = supabase.channel(`chat19-city-${slug(profile.city)}`, {
      config: { presence: { key: profile.anonId } },
    });
    cityChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      if (cancelled) return;
      const state = ch.presenceState<{
        fakeName: string;
        avatar: number;
        gender: Gender;
        anonId: string;
      }>();
      const rows = Object.values(state).flat();
      const seen = new Set<string>();
      const allIds = new Set<string>();
      const list: Peer[] = [];
      rows.forEach((row) => {
        if (!row?.anonId || row.anonId === profile.anonId) return;
        allIds.add(row.anonId);
        if (seen.has(row.anonId)) return;
        seen.add(row.anonId);
        if (profile.preference !== "everyone" && row.gender !== profile.preference) return;
        list.push({
          anonId: row.anonId,
          fakeName: row.fakeName || "Stranger",
          avatar: Number(row.avatar) || 0,
          gender: row.gender || "secret",
        });
      });
      setPeers(list);
      // Live counter = EVERYONE active in this city (preference only filters pings)
      setLiveCount(allIds.size + 1);
    });

    ch.on("broadcast", { event: "invite" }, ({ payload }) => {
      if (cancelled || !payload) return;
      if (payload.target !== profile.anonId || !payload.from || !payload.room) return;
      setIncoming({
        peer: {
          anonId: String(payload.from),
          fakeName: String(payload.name || "Stranger"),
          avatar: Number(payload.avatar) || 0,
          gender: (payload.gender as Gender) || "secret",
        },
        room: String(payload.room),
      });
    });

    ch.subscribe((status) => {
      if (cancelled) return;
      setSignalLive(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") {
        void Promise.resolve(
          ch.track({
            fakeName: profile.fakeName,
            avatar: profile.avatar,
            gender: profile.gender,
            anonId: profile.anonId,
          }),
        ).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      cityChannelRef.current = null;
      setSignalLive(false);
      setPeers([]);
      setLiveCount(1);
      setIncoming(null);
      void Promise.resolve(supabase.removeChannel(ch)).catch(() => {});
    };
  }, [onRadar, profile]);

  // ── DM ROOM CHANNEL — realtime messages + typing indicators ───────────────
  useEffect(() => {
    const p = profileRef.current;
    if (step !== "chat" || !activePeer || activePeer.ghost || !p) return;
    const room = roomFor(p.anonId, activePeer.anonId);
    roomRef.current = room;

    const ch = supabase.channel(`chat19-dm-${room}`, {
      config: { broadcast: { self: false } },
    });
    dmChannelRef.current = ch;

    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      if (!payload || typeof payload.text !== "string") return;
      if (payload.from === p.anonId) return;
      const incomingMsg: C19Msg = {
        id: String(payload.id || uid()),
        from: String(payload.from || activePeer.anonId),
        text: scrubRef.current(String(payload.text)),
        at: Number(payload.at) || Date.now(),
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        const next = [...prev, incomingMsg];
        saveMsgs(room, next);
        return next;
      });
    });

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.from === p.anonId) return;
      setPeerTyping(true);
      if (typingHideRef.current) window.clearTimeout(typingHideRef.current);
      typingHideRef.current = window.setTimeout(() => setPeerTyping(false), 2_800);
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        safeSend(ch, "hello", { from: p.anonId, name: p.fakeName });
      }
    });

    return () => {
      if (typingHideRef.current) window.clearTimeout(typingHideRef.current);
      setPeerTyping(false);
      dmChannelRef.current = null;
      void Promise.resolve(supabase.removeChannel(ch)).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activePeer?.anonId, activePeer?.ghost, profile?.anonId]);

  // ── ACTIONS ────────────────────────────────────────────────────────────────

  /** Step 1 → saves the anonymous identity (fake name + auto-unique suffix). */
  const finishOnboard = () => {
    const base = sanitizeBase(baseName);
    if (base.length < 2) {
      toast.error("Fake name needs at least 2 characters");
      return;
    }
    const taken = takenNames(peers.map((p) => p.fakeName));
    // Honour the visible suffix first, then re-roll on collision for uniqueness.
    let fakeName = `${base} #${suffix}`;
    if (taken.has(fakeName.toUpperCase())) fakeName = makeUniqueFakeName(base, taken);
    registerFakeName(fakeName);

    const next: Chat19Profile = {
      linkedId: linked?.id || profile?.linkedId || "guest",
      linkedEmail: linked?.email || profile?.linkedEmail || "",
      realName: linked?.name || profile?.realName || "",
      fakeName,
      anonId: profile?.anonId || randSuffix(10),
      gender,
      preference,
      avatar: avatarIdx,
      city: profile?.city || "",
      manualCity: profile?.manualCity || false,
      createdAt: profile?.createdAt || Date.now(),
    };
    setProfile(next);
    lsSet(STORAGE_PROFILE, next);
    setStep(next.city ? "radar" : "city");
    toast.success(`Identity locked: ${fakeName}`);
  };

  /** Step 2 — city selection with manual override. */
  const commitCity = () => {
    const finalCity = manualOn ? manualCity.trim() : pickedCity;
    if (!finalCity) {
      toast.error("Select a city — or switch on manual override and type one");
      return;
    }
    if (!profile) {
      setStep("onboard");
      return;
    }
    const next: Chat19Profile = { ...profile, city: finalCity, manualCity: manualOn };
    setProfile(next);
    lsSet(STORAGE_PROFILE, next);
    setScanned(false);
    setSelectedPing(null);
    setIncoming(null);
    setStep("radar");
  };

  const remainingTokens = DAILY_FREE_TOKENS - (tokens.date === todayKey() ? tokens.used : 0);

  /** Step 3 — one CYBER SCAN costs one of the 10 daily free tokens. */
  const runScan = () => {
    if (scanning) return;
    if (remainingTokens <= 0) {
      toast.error(`⚡ All 10 free scans used — resets in ${fmtCountdown(msUntilMidnight())}`);
      return;
    }
    setScanning(true);
    const fresh = loadTokens();
    const next = { date: todayKey(), used: Math.min(fresh.used + 1, DAILY_FREE_TOKENS) };
    setTokens(next);
    lsSet(STORAGE_TOKENS, next);
    schedule(() => {
      setScanning(false);
      setScanned(true);
      setSelectedPing(null);
    }, 1_700);
  };

  /** Simulated peer ("echo signal") reply with typing indicator. */
  const ghostReact = useCallback(
    (raw: string, peer: Peer) => {
      const trimmed = raw.trim();
      const pool = /\?/.test(trimmed)
        ? GHOST_REPLIES.question
        : /^(hi|hello|hey|namaste|hola|kaise|yo)\b/i.test(trimmed)
          ? GHOST_REPLIES.greeting
          : GHOST_REPLIES.default;
      const line = pool[Math.floor(Math.random() * pool.length)];
      schedule(() => setPeerTyping(true), 700);
      schedule(
        () => {
          const p = profileRef.current;
          if (!p) return;
          const room = roomFor(p.anonId, peer.anonId);
          if (roomRef.current !== room) return;
          setPeerTyping(false);
          const reply: C19Msg = {
            id: uid(),
            from: peer.anonId,
            text: scrubRef.current(line),
            at: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev, reply];
            saveMsgs(room, next);
            return next;
          });
        },
        2_300 + Math.random() * 1_300,
      );
    },
    [schedule],
  );

  /** Opens a chat room with a ping (live peer or echo signal). */
  const openChat = useCallback((peer: Peer, notify = true) => {
    const p = profileRef.current;
    if (!p) return;
    const room = roomFor(p.anonId, peer.anonId);
    roomRef.current = room;
    setMessages(loadMsgs(room));
    setDraft("");
    setPeerTyping(false);
    setSelectedPing(null);
    setIncoming(null);
    setActivePeer(peer);
    setStep("chat");
    // Realtime invite so the other stranger sees an accept banner
    if (!peer.ghost && notify) {
      safeSend(cityChannelRef.current, "invite", {
        from: p.anonId,
        name: p.fakeName,
        avatar: p.avatar,
        gender: p.gender,
        target: peer.anonId,
        room,
      });
    }
  }, []);

  /** Sends the draft — scrubbed, broadcast, persisted. */
  const sendDraft = () => {
    const p = profileRef.current;
    const peer = activePeer;
    if (!p || !peer) return;
    const raw = draft.trim();
    if (!raw) return;
    const msg: C19Msg = {
      id: uid(),
      from: p.anonId,
      text: scrubRef.current(raw),
      at: Date.now(),
    };
    const next = [...messages, msg];
    setMessages(next);
    setDraft("");
    saveMsgs(roomRef.current, next);
    if (!peer.ghost) safeSend(dmChannelRef.current, "msg", { ...msg });
    else ghostReact(raw, peer);
  };

  /** Throttled "typing…" broadcast while composing. */
  const onDraftChange = (value: string) => {
    setDraft(value);
    const ch = dmChannelRef.current;
    if (ch && Date.now() - lastTypingSentRef.current > 1_500) {
      lastTypingSentRef.current = Date.now();
      safeSend(ch, "typing", { from: profileRef.current?.anonId || "" });
    }
  };

  /** Local-only wipe of the visible room history. */
  const wipeRoom = () => {
    if (!roomRef.current) return;
    saveMsgs(roomRef.current, []);
    setMessages([]);
    toast.success("Room wiped locally 🧽");
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const pings = useMemo(() => {
    if (!scanned) return [] as Peer[];
    const need = Math.max(0, Math.min(3, 3 - peers.length));
    const ghosts: Peer[] = Array.from({ length: need }, (_, i) => {
      const seed = (ghostSalt + i * 7_919) >>> 0;
      return {
        anonId: `echo-${seed}`,
        fakeName: ghostName(seed),
        avatar: seed % AVATARS.length,
        gender: (["female", "male", "other"] as Gender[])[seed % 3],
        ghost: true,
      };
    });
    return [...peers, ...ghosts];
  }, [scanned, peers, ghostSalt]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return PRESET_CITIES;
    return PRESET_CITIES.filter((c) => c.toLowerCase().includes(q));
  }, [cityQuery]);

  const activeCity = manualOn ? manualCity.trim() : pickedCity;
  const msLeft = msUntilMidnight();

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const stepTitle =
    step === "onboard"
      ? "IDENTITY SETUP"
      : step === "city"
        ? "LOCATION SYSTEM"
        : step === "radar"
          ? "LIVE RADAR"
          : "PRIVATE ROOM";

  const handleBack = () => {
    if (step === "chat") {
      setStep("radar");
      setActivePeer(null);
      return;
    }
    if (step === "radar") {
      setStep("city");
      return;
    }
    if (step === "city") {
      setStep(profile ? "radar" : "onboard");
      return;
    }
    close();
  };

  const cardStyle: CSSProperties = {
    background: "rgba(255,255,255,.035)",
    border: "1.5px solid rgba(225,29,72,.20)",
    boxShadow: "0 8px 30px rgba(0,0,0,.35)",
  };
  const inputStyle: CSSProperties = {
    background: "rgba(0,0,0,.38)",
    border: "1.5px solid rgba(225,29,72,.30)",
    color: "#fff",
  };
  const labelCls = "text-[10px] font-black tracking-[.2em] text-white/55";

  return (
    <div
      className="h-[100dvh] w-full flex flex-col text-white overflow-hidden"
      style={{
        background: [
          "radial-gradient(900px 460px at 50% -6%, rgba(140,14,44,.32), transparent 62%)",
          "radial-gradient(700px 420px at 86% 106%, rgba(90,6,26,.38), transparent 60%)",
          "#0D0C0F",
        ].join(", "),
      }}
    >
      <style>{C19_KEYFRAMES}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(13,12,15,.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(225,29,72,.18)",
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(225,29,72,.12)", border: "1px solid rgba(225,29,72,.32)" }}
        >
          <ArrowLeft size={16} className="text-[#FF6B85]" />
        </button>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] font-black tracking-[.24em] leading-none"
            style={{ color: "#FFE9ED", textShadow: "0 0 14px rgba(225,29,72,.55)" }}
          >
            CHAT 19
          </p>
          <p
            className="text-[9px] mt-1 uppercase tracking-[.3em]"
            style={{ color: "rgba(255,120,145,.75)" }}
          >
            {stepTitle}
          </p>
        </div>
        {profile && step !== "onboard" && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ border: "1px solid rgba(225,29,72,.35)", background: "rgba(225,29,72,.10)" }}
          >
            <Lock size={10} className="text-[#FF6B85]" />
            <span className="text-[9px] font-black tracking-wider" style={{ color: "#FF9AB0" }}>
              ID HIDDEN
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close Chat 19"
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)" }}
        >
          <X size={16} className="text-white/60" />
        </button>
      </div>

      {/* ── Scrollable stage ───────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto c19-scroll">
        <AnimatePresence mode="wait">
          {/* ═══ 1 · ONBOARDING & IDENTITY ═════════════════════════════════ */}
          {step === "onboard" && (
            <motion.section
              key="onboard"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.26 }}
              className="px-4 pt-5 pb-10 max-w-lg mx-auto"
            >
              {/* Hero */}
              <div className="text-center mb-5">
                <div
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    background: "linear-gradient(135deg,#A01030,#4E0516)",
                    boxShadow: "0 0 28px rgba(225,29,72,.55)",
                  }}
                >
                  <RadarIcon size={30} className="text-white" />
                </div>
                <h1
                  className="text-xl font-black tracking-[.2em]"
                  style={{ color: "#FFE9ED", textShadow: "0 0 18px rgba(225,29,72,.6)" }}
                >
                  CHAT 19
                </h1>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,120,145,.85)" }}>
                  Anonymous city radar · Velvet-Red &amp; Deep Charcoal
                </p>
              </div>

              {/* 1 · Flicks account linking */}
              <div className="rounded-2xl p-4 mb-4" style={cardStyle}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className={labelCls}>1 · FLICKS ACCOUNT LINKING</p>
                  {linking ? (
                    <span className="text-[9px] font-black text-white/40">LINKING…</span>
                  ) : linked ? (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                      style={{
                        background: "rgba(34,197,94,.15)",
                        color: "#4ADE80",
                        border: "1px solid rgba(34,197,94,.4)",
                      }}
                    >
                      <Check size={9} /> LINKED
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-white/40">GUEST MODE</span>
                  )}
                </div>
                {linking ? (
                  <p className="text-[12px] text-white/45">Fetching your Flicks account…</p>
                ) : linked ? (
                  <div className="flex items-center gap-3">
                    {linked.avatar ? (
                      <img
                        src={linked.avatar}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover"
                        style={{ border: "1.5px solid rgba(225,29,72,.5)" }}
                        decoding="async"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center font-black text-[16px]"
                        style={{ background: "linear-gradient(135deg,#A01030,#4E0516)" }}
                      >
                        {(linked.name || "F")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate">{linked.name}</p>
                      <p className="text-[10.5px] text-white/40 truncate">
                        {linked.email || "linked account"}
                      </p>
                    </div>
                    <Check size={18} className="text-emerald-400 shrink-0" />
                  </div>
                ) : (
                  <GlowBtn
                    ghost
                    onClick={() => {
                      setLinking(true);
                      window.location.reload();
                    }}
                  >
                    LINK FLICKS ACCOUNT
                  </GlowBtn>
                )}
                <p
                  className="text-[10px] mt-2.5 leading-relaxed"
                  style={{ color: "rgba(255,140,160,.6)" }}
                >
                  🔒 Sirf tumhe dikh raha hai — iska asli naam kabhi do strangers ko nahi dikhega.
                </p>
              </div>

              {/* 2 · Fake display name with auto-unique suffix */}
              <div className="rounded-2xl p-4 mb-4" style={cardStyle}>
                <p className={labelCls}>2 · FAKE DISPLAY NAME</p>
                <div className="flex gap-2 mt-2.5">
                  <input
                    value={baseName}
                    onChange={(e) => setBaseName(sanitizeBase(e.target.value))}
                    placeholder="e.g. VelvetRider"
                    maxLength={14}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setSuffix(randSuffix())}
                    aria-label="Shuffle unique suffix"
                    className="shrink-0 w-11 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                    style={{
                      background: "rgba(225,29,72,.14)",
                      border: "1.5px solid rgba(225,29,72,.4)",
                    }}
                  >
                    <Shuffle size={15} className="text-[#FF6B85]" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <p className="text-[10px] text-white/40">Auto-unique suffix</p>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-black"
                    style={{
                      background: "linear-gradient(90deg,#A01030,#E11D48)",
                      boxShadow: "0 0 12px rgba(225,29,72,.45)",
                    }}
                  >
                    {baseName || "Striker"} #{suffix}
                  </span>
                </div>
              </div>

              {/* 3 · Gender + 4 · Preference */}
              <div className="rounded-2xl p-4 mb-4" style={cardStyle}>
                <p className={labelCls}>3 · GENDER</p>
                <div className="grid grid-cols-4 gap-2 mt-2.5">
                  {GENDER_OPTS.map((o) => (
                    <Chip key={o.k} active={gender === o.k} onClick={() => setGender(o.k)}>
                      <span className="mr-1">{o.e}</span>
                      {o.l}
                    </Chip>
                  ))}
                </div>
                <p className={`${labelCls} mt-4`}>4 · SHOW ME ON RADAR</p>
                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  {PREF_OPTS.map((o) => (
                    <Chip key={o.k} active={preference === o.k} onClick={() => setPreference(o.k)}>
                      <span className="mr-1">{o.e}</span>
                      {o.l}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* 5 · Custom avatar */}
              <div className="rounded-2xl p-4 mb-5" style={cardStyle}>
                <p className={labelCls}>5 · CUSTOM AVATAR</p>
                <div className="grid grid-cols-6 gap-2.5 mt-3">
                  {AVATARS.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatarIdx(i)}
                      aria-label={`Avatar ${i + 1}`}
                      className="aspect-square rounded-full flex items-center justify-center transition-all active:scale-95"
                      style={{
                        background: a.grad,
                        border: avatarIdx === i ? "2.5px solid #FF3355" : "2px solid rgba(255,255,255,.12)",
                        boxShadow: avatarIdx === i ? "0 0 14px rgba(225,29,72,.65)" : "none",
                        fontSize: 20,
                        transform: avatarIdx === i ? "scale(1.08)" : "scale(1)",
                      }}
                    >
                      {a.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <GlowBtn onClick={finishOnboard}>
                {profile ? "SAVE IDENTITY" : "ENTER CHAT 19"} <ChevronRight size={15} />
              </GlowBtn>
              <p className="text-center text-[10px] mt-3 text-white/35">
                Real identity stays hidden — sirf fake name + avatar radar pe jayega.
              </p>
            </motion.section>
          )}

          {/* ═══ 2 · LOCATION SYSTEM ═══════════════════════════════════════ */}
          {step === "city" && (
            <motion.section
              key="city"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.26 }}
              className="px-4 pt-5 pb-10 max-w-lg mx-auto"
            >
              <div className="rounded-2xl p-4 mb-4" style={cardStyle}>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={14} className="text-[#FF6B85]" />
                  <p className={labelCls}>SELECT YOUR CITY</p>
                </div>
                <p className="text-[11px] text-white/40">
                  Radar sirf is city ke andar scan karega.
                </p>
                <div className="relative mt-3">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="Search city…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {filteredCities.map((c) => (
                    <Chip
                      key={c}
                      active={!manualOn && pickedCity === c}
                      onClick={() => {
                        setPickedCity(c);
                        setManualOn(false);
                      }}
                    >
                      {c}
                    </Chip>
                  ))}
                  {!filteredCities.length && (
                    <p className="col-span-3 text-[11px] text-white/35">
                      No match — switch on manual override below ↓
                    </p>
                  )}
                </div>
              </div>

              {/* Manual override */}
              <div className="rounded-2xl p-4 mb-4" style={cardStyle}>
                <button
                  type="button"
                  onClick={() => setManualOn((v) => !v)}
                  className="w-full flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px]">🛠</span>
                    <p className="text-[12px] font-black tracking-wide">MANUAL OVERRIDE</p>
                  </div>
                  <span
                    className="w-11 h-6 rounded-full relative shrink-0 transition-all"
                    style={{
                      background: manualOn
                        ? "linear-gradient(90deg,#A01030,#E11D48)"
                        : "rgba(255,255,255,.12)",
                      boxShadow: manualOn ? "0 0 12px rgba(225,29,72,.5)" : "none",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{ left: manualOn ? 22 : 2 }}
                    />
                  </span>
                </button>
                {manualOn && (
                  <input
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value.slice(0, 24))}
                    placeholder="Type any city… (e.g. Azamgarh)"
                    className="w-full mt-3 px-3 py-2.5 rounded-xl text-[13px] outline-none"
                    style={inputStyle}
                  />
                )}
                <p className="text-[10px] mt-2 text-white/35">
                  Manual override ON = preset list ignore ho jayegi.
                </p>
              </div>

              {profile?.city && (
                <div
                  className="rounded-xl px-3.5 py-2.5 mb-4 flex items-center gap-2"
                  style={{
                    background: "rgba(225,29,72,.10)",
                    border: "1px solid rgba(225,29,72,.3)",
                  }}
                >
                  <MapPin size={12} className="text-[#FF6B85]" />
                  <span className="text-[11px] font-bold" style={{ color: "#FFB3C2" }}>
                    Current radar city: {profile.city}
                  </span>
                </div>
              )}

              <GlowBtn onClick={commitCity} disabled={!activeCity}>
                CONTINUE TO RADAR <ChevronRight size={15} />
              </GlowBtn>
            </motion.section>
          )}

          {/* ═══ 3 · LIVE COUNTER & RADAR DISCOVERY ════════════════════════ */}
          {step === "radar" && (
            <motion.section
              key="radar"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.26 }}
              className="px-4 pt-4 pb-10 max-w-lg mx-auto"
            >
              {/* City / live / tokens row */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setStep("city")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-black active:scale-95 transition-transform"
                  style={{
                    background: "rgba(225,29,72,.12)",
                    border: "1.5px solid rgba(225,29,72,.4)",
                    color: "#FFB3C2",
                  }}
                >
                  <MapPin size={12} />
                  {profile?.city || "Set city"}
                </button>
                <div
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-xl"
                  style={{
                    background: "rgba(34,197,94,.10)",
                    border: "1px solid rgba(34,197,94,.35)",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: signalLive ? "#22C55E" : "#EF4444",
                      animation: "c19-blip 1.4s ease-in-out infinite",
                    }}
                  />
                  <Users size={11} className="text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-300">{liveCount} LIVE</span>
                </div>
                <div
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl"
                  style={{
                    background: "rgba(225,29,72,.12)",
                    border: "1px solid rgba(225,29,72,.4)",
                  }}
                >
                  <Zap size={11} className="text-[#FF6B85]" />
                  <span className="text-[11px] font-black" style={{ color: "#FFB3C2" }}>
                    {remainingTokens}/10
                  </span>
                </div>
              </div>

              {/* Incoming invite banner */}
              <AnimatePresence>
                {incoming && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl p-3 mb-3 flex items-center gap-3"
                    style={{
                      background: "linear-gradient(120deg, rgba(160,16,48,.4), rgba(20,10,14,.92))",
                      border: "1.5px solid rgba(255,77,110,.55)",
                      boxShadow: "0 0 20px rgba(225,29,72,.3)",
                    }}
                  >
                    <AvatarBadge idx={incoming.peer.avatar} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-black truncate">{incoming.peer.fakeName}</p>
                      <p className="text-[10px] text-white/55">wants to connect ✉</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openChat(incoming.peer, false)}
                      className="px-3 py-2 rounded-xl text-[11px] font-black text-white active:scale-95"
                      style={{
                        background: "linear-gradient(135deg,#A01030,#E11D48)",
                        boxShadow: "0 0 14px rgba(225,29,72,.5)",
                      }}
                    >
                      ACCEPT
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncoming(null)}
                      aria-label="Decline"
                      className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,.06)" }}
                    >
                      <X size={13} className="text-white/50" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── The radar dial ─────────────────────────────────────────── */}
              <div
                className="relative mx-auto rounded-full overflow-hidden"
                style={{
                  width: "min(86vw, 340px)",
                  height: "min(86vw, 340px)",
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(90,7,24,.45) 0%, rgba(13,12,15,.95) 72%)",
                  border: "1.5px solid rgba(225,29,72,.35)",
                  boxShadow: "0 0 40px rgba(225,29,72,.25), inset 0 0 44px rgba(120,10,34,.35)",
                }}
              >
                {/* grid dots */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "radial-gradient(rgba(255,77,110,.16) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                />
                {/* concentric rings */}
                {[8, 24, 40].map((inset) => (
                  <div
                    key={inset}
                    className="absolute rounded-full"
                    style={{ inset: `${inset}%`, border: "1px solid rgba(225,29,72,.22)" }}
                  />
                ))}
                {/* cross-hairs */}
                <div
                  className="absolute left-1/2 top-0 h-full w-px"
                  style={{ background: "rgba(225,29,72,.16)" }}
                />
                <div
                  className="absolute top-1/2 left-0 w-full h-px"
                  style={{ background: "rgba(225,29,72,.16)" }}
                />

                {/* cyber-pulse waves */}
                {[0, 1.6].map((delay) => (
                  <div
                    key={delay}
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: "1.5px solid rgba(255,77,110,.55)",
                      animation: `c19-wave 3.2s ease-out ${delay}s infinite`,
                    }}
                  />
                ))}
                {/* rotating velvet-red sweep beam */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(255,51,85,.10) 300deg, rgba(255,51,85,.45) 342deg, rgba(255,255,255,.75) 357deg, transparent 360deg)",
                    animation: "c19-sweep 3.4s linear infinite",
                  }}
                />
                {/* virus-scan burst while scanning */}
                {scanning && (
                  <>
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        border: "2.5px solid rgba(255,120,150,.9)",
                        animation: "c19-burst 1.6s ease-out infinite",
                      }}
                    />
                    <div
                      className="absolute left-0 w-full h-[3px]"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,80,115,.95), transparent)",
                        boxShadow: "0 0 16px rgba(255,45,85,.9)",
                        animation: "c19-scanline 1.7s linear infinite",
                      }}
                    />
                  </>
                )}

                {/* interactive pings */}
                {!scanning &&
                  pings.map((p, i) => {
                    const pos = pingPos(p.anonId);
                    const isSel = selectedPing?.anonId === p.anonId;
                    return (
                      <button
                        key={p.anonId}
                        type="button"
                        onClick={() => setSelectedPing(isSel ? null : p)}
                        aria-label={`Signal: ${p.fakeName}`}
                        className="absolute"
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          transform: "translate(-50%,-50%)",
                          animation: `c19-ping ${2.1 + (i % 4) * 0.35}s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      >
                        <span
                          className="block w-3.5 h-3.5 rounded-full"
                          style={{
                            background: p.ghost ? "#FF7A93" : "#FF2D55",
                            border: "1.5px solid rgba(255,255,255,.85)",
                            boxShadow: p.ghost
                              ? "0 0 12px rgba(255,122,147,.95)"
                              : "0 0 14px rgba(255,45,85,1)",
                          }}
                        />
                        <span
                          className="absolute left-1/2 top-1/2 w-8 h-8 rounded-full"
                          style={{
                            border: "1.5px solid rgba(255,77,110,.85)",
                            animation: "c19-halo 1.9s ease-out infinite",
                          }}
                        />
                        {isSel && (
                          <span
                            className="absolute left-1/2 -translate-x-1/2 top-6 whitespace-nowrap px-2 py-0.5 rounded-full text-[9px] font-black"
                            style={{
                              background: "rgba(10,6,8,.92)",
                              border: "1px solid rgba(255,77,110,.65)",
                              color: "#FF9AB0",
                            }}
                          >
                            {p.fakeName}
                          </span>
                        )}
                      </button>
                    );
                  })}

                {/* centre — me */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <AvatarBadge idx={profile?.avatar ?? 0} size={40} />
                </div>
              </div>

              {/* Stats + scan */}
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-5">
                  <div>
                    <p
                      className="text-2xl font-black leading-none"
                      style={{ color: "#FFE9ED", textShadow: "0 0 18px rgba(255,45,85,.65)" }}
                    >
                      {liveCount}
                    </p>
                    <p className="text-[9px] tracking-[.18em] text-white/45 font-black mt-1">
                      ACTIVE NOW
                    </p>
                  </div>
                  <div className="w-px h-9" style={{ background: "rgba(225,29,72,.3)" }} />
                  <div>
                    <p
                      className="text-2xl font-black leading-none"
                      style={{ color: "#FFE9ED", textShadow: "0 0 18px rgba(255,45,85,.65)" }}
                    >
                      {pings.length}
                    </p>
                    <p className="text-[9px] tracking-[.18em] text-white/45 font-black mt-1">
                      SIGNALS
                    </p>
                  </div>
                  <div className="w-px h-9" style={{ background: "rgba(225,29,72,.3)" }} />
                  <div>
                    <p
                      className="text-2xl font-black leading-none"
                      style={{ color: "#FFE9ED", textShadow: "0 0 18px rgba(255,45,85,.65)" }}
                    >
                      {remainingTokens}
                    </p>
                    <p className="text-[9px] tracking-[.18em] text-white/45 font-black mt-1">
                      SCANS LEFT
                    </p>
                  </div>
                </div>
                <p className="text-[10.5px] mt-2.5 text-white/45">
                  {scanning
                    ? "SCANNING CITY GRID…"
                    : scanned
                      ? `${profile?.city || "City"} grid locked · tap a ping to connect`
                      : "Run a cyber scan to reveal live signals"}
                </p>
              </div>

              <div className="mt-4">
                <GlowBtn onClick={runScan} disabled={scanning || remainingTokens <= 0}>
                  <RadarIcon size={15} />
                  {scanning
                    ? "SCANNING…"
                    : remainingTokens > 0
                      ? "CYBER SCAN · 1 TOKEN"
                      : "NO SCANS LEFT TODAY"}
                </GlowBtn>
                <p
                  className="text-center text-[10px] mt-2"
                  style={{ color: "rgba(255,140,160,.6)" }}
                >
                  ⚡ {remainingTokens}/{DAILY_FREE_TOKENS} free scans today · resets at 00:00 (in{" "}
                  {fmtCountdown(msLeft)})
                </p>
              </div>

              {/* Selected ping card */}
              <AnimatePresence>
                {selectedPing && !scanning && (
                  <motion.div
                    key="pingcard"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="mt-4 rounded-2xl p-4 flex items-center gap-3"
                    style={cardStyle}
                  >
                    <AvatarBadge idx={selectedPing.avatar} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-black truncate">{selectedPing.fakeName}</p>
                      <p
                        className="text-[10px]"
                        style={{ color: "rgba(255,140,160,.8)" }}
                      >
                        {selectedPing.ghost
                          ? "Echo signal · instant responder"
                          : signalLive
                            ? "Live signal · same city"
                            : "Signal · reconnecting…"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openChat(selectedPing)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[11px] font-black text-white active:scale-95 transition-transform shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#A01030,#E11D48)",
                        boxShadow: "0 0 16px rgba(225,29,72,.5)",
                      }}
                    >
                      <MessageCircle size={13} /> CHAT
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {!scanned && (
                <p className="text-center text-[10px] mt-4 text-white/30">
                  🔒 Identity hidden · {profile?.fakeName} · radar sirf{" "}
                  {profile?.city || "selected city"} me
                </p>
              )}
            </motion.section>
          )}

          {/* ═══ 4 · PRIVATE ANONYMOUS CHAT ════════════════════════════════ */}
          {step === "chat" && activePeer && (
            <motion.section
              key="chat"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.24 }}
              className="h-full flex flex-col"
            >
              {/* Room header */}
              <div
                className="shrink-0 flex items-center gap-3 px-4 py-3"
                style={{
                  background: "rgba(16,13,17,.95)",
                  borderBottom: "1px solid rgba(225,29,72,.22)",
                }}
              >
                <AvatarBadge idx={activePeer.avatar} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black truncate">{activePeer.fakeName}</p>
                  <p
                    className="text-[9.5px] flex items-center gap-1 mt-0.5"
                    style={{ color: "rgba(255,140,160,.85)" }}
                  >
                    <Lock size={9} />
                    REAL IDENTITY HIDDEN ·{" "}
                    {activePeer.ghost ? "ECHO SIGNAL" : signalLive ? "LIVE SIGNAL" : "SIGNAL"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={wipeRoom}
                  aria-label="Wipe chat locally"
                  className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <Trash2 size={14} className="text-white/50" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto c19-scroll px-4 py-4 space-y-2.5">
                <div
                  className="mx-auto max-w-[88%] text-center text-[9.5px] leading-relaxed py-2 px-3 rounded-xl"
                  style={{
                    background: "rgba(225,29,72,.08)",
                    border: "1px dashed rgba(225,29,72,.35)",
                    color: "rgba(255,150,170,.9)",
                  }}
                >
                  🔒 Strict mode ON — real names, emails &amp; phone numbers auto-mask ho jate hain.
                  You are chatting as <b>{profile?.fakeName}</b>.
                </div>

                {messages.length === 0 && (
                  <div className="text-center pt-8">
                    <p className="text-[28px] mb-2">🌙</p>
                    <p className="text-[12px] font-black" style={{ color: "#FF9AB0" }}>
                      Signal locked with {activePeer.fakeName}
                    </p>
                    <p className="text-[10.5px] text-white/40 mt-1">
                      Pehla message bhejo — strictly anonymous.
                    </p>
                  </div>
                )}

                {messages.map((m) => {
                  const mine = m.from === profile?.anonId;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`max-w-[78%] px-3.5 py-2 text-[13.5px] leading-snug break-words ${
                        mine
                          ? "ml-auto rounded-2xl rounded-br-md"
                          : "mr-auto rounded-2xl rounded-bl-md"
                      }`}
                      style={
                        mine
                          ? {
                              background: "linear-gradient(135deg,#9C0F2E,#570616)",
                              border: "1px solid rgba(255,90,120,.5)",
                              boxShadow:
                                "0 0 16px rgba(225,29,72,.4), inset 0 1px 0 rgba(255,255,255,.10)",
                              color: "#fff",
                            }
                          : {
                              background: "#1A181D",
                              border: "1px solid rgba(225,29,72,.30)",
                              boxShadow: "0 0 12px rgba(225,29,72,.14)",
                              color: "rgba(255,255,255,.92)",
                            }
                      }
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <p
                        className={`mt-1 text-[9px] ${
                          mine ? "text-white/50 text-right" : "text-white/35"
                        }`}
                      >
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </motion.div>
                  );
                })}

                {peerTyping && (
                  <div
                    className="mr-auto flex items-center gap-2 px-3 py-2 rounded-2xl rounded-bl-md"
                    style={{
                      background: "#1A181D",
                      border: "1px solid rgba(225,29,72,.3)",
                    }}
                  >
                    <Dots />
                    <span className="text-[9.5px] text-white/45">typing…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div
                className="shrink-0 px-3 py-3"
                style={{
                  background: "rgba(10,9,11,.96)",
                  borderTop: "1px solid rgba(225,29,72,.22)",
                }}
              >
                <div className="flex items-end gap-2">
                  <input
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !(e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
                        e.preventDefault();
                        sendDraft();
                      }
                    }}
                    placeholder="Type anonymously…"
                    maxLength={500}
                    className="flex-1 min-w-0 px-4 py-3 rounded-2xl text-[13.5px] outline-none"
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1.5px solid rgba(225,29,72,.30)",
                      color: "#fff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendDraft}
                    disabled={!draft.trim()}
                    aria-label="Send message"
                    className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg,#A01030,#E11D48)",
                      boxShadow: "0 0 16px rgba(225,29,72,.5)",
                    }}
                  >
                    <Send size={17} className="text-white" />
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Chat19;

















