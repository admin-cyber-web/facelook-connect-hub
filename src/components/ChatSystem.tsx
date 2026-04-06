import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ChevronLeft, Send, Paperclip, Music, Loader2,
  MessageSquare, UserPlus, UserCheck, Clock, Check, Users,
  Bell, BookOpen, Settings, LogOut, Archive, MoreVertical,
  Trash2, EyeOff, Eye, Volume2, VolumeX, Droplets, Leaf,
  Square, LayoutGrid, ShieldCheck, Info, MapPin, GraduationCap,
  User, ArrowLeft, Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
type Theme = "water" | "nature" | "plain";
type BottomTab = "chat" | "story" | "alert" | "menu";
type MenuPanel = "main" | "settings" | "archive" | "requests";

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio?: string;
  school?: string;
  location?: string;
}
interface ChatContact extends Profile {
  last_message?: string;
  last_message_at?: string;
  last_media_type?: string;
}
interface FriendshipInfo {
  id: string;
  status: "pending" | "accepted" | "rejected";
  direction: "sent" | "received";
}
interface FriendRequest {
  id: string;
  sender_id: string;
  created_at: string;
  profile: Profile;
}
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  deleted?: boolean;
}
interface ChatSystemProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onLogout?: () => void;
}

// ── Theme config ───────────────────────────────────────────────────────────────
const THEME_CFG = {
  water: {
    wrap:       "bg-gradient-to-b from-sky-950 via-blue-950 to-slate-950",
    sidebar:    "bg-sky-950/95 border-sky-800/40",
    chat:       "bg-gradient-to-b from-sky-900/98 to-blue-950/98",
    topbar:     "bg-sky-950/90 backdrop-blur-2xl border-sky-800/30",
    input:      "bg-sky-900/80 backdrop-blur-2xl border-sky-700/40",
    nav:        "bg-sky-950/98 border-sky-800/40",
    bubbleSent: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-900/40",
    bubbleRecv: "bg-white/10 backdrop-blur-md border border-white/10 text-white",
    text1:      "text-white",
    text2:      "text-sky-300",
    text3:      "text-white/40",
    accent:     "bg-sky-500",
    accentText: "text-sky-400",
    icon:       "💧",
    label:      "Water",
    divider:    "border-sky-800/40",
    searchBg:   "bg-white/5 border-white/10 text-white placeholder:text-white/25",
    msgMenuBg:  "bg-slate-800 border-slate-700",
    pill:       "bg-sky-500/20 text-sky-300 border border-sky-500/30",
  },
  nature: {
    wrap:       "bg-gradient-to-b from-stone-100 via-green-50 to-emerald-50",
    sidebar:    "bg-stone-50/98 border-stone-200",
    chat:       "bg-gradient-to-b from-green-50 to-emerald-50",
    topbar:     "bg-white/95 backdrop-blur-2xl border-stone-200",
    input:      "bg-white/95 backdrop-blur-2xl border-stone-200",
    nav:        "bg-white/98 border-stone-200",
    bubbleSent: "bg-emerald-500 text-white shadow-md shadow-emerald-200",
    bubbleRecv: "bg-white text-stone-800 border border-stone-200 shadow-sm",
    text1:      "text-stone-900",
    text2:      "text-emerald-700",
    text3:      "text-stone-400",
    accent:     "bg-emerald-500",
    accentText: "text-emerald-600",
    icon:       "🌿",
    label:      "Nature",
    divider:    "border-stone-200",
    searchBg:   "bg-stone-100 border-stone-200 text-stone-900 placeholder:text-stone-400",
    msgMenuBg:  "bg-white border-stone-200 shadow-xl",
    pill:       "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  plain: {
    wrap:       "bg-white",
    sidebar:    "bg-white border-gray-200",
    chat:       "bg-gray-50",
    topbar:     "bg-white border-gray-200",
    input:      "bg-white border-gray-200",
    nav:        "bg-white border-gray-200",
    bubbleSent: "bg-blue-500 text-white shadow-md",
    bubbleRecv: "bg-gray-100 text-gray-900",
    text1:      "text-gray-900",
    text2:      "text-blue-600",
    text3:      "text-gray-400",
    accent:     "bg-blue-500",
    accentText: "text-blue-500",
    icon:       "⚪",
    label:      "Plain",
    divider:    "border-gray-200",
    searchBg:   "bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400",
    msgMenuBg:  "bg-white border-gray-200 shadow-xl",
    pill:       "bg-blue-50 text-blue-600 border border-blue-200",
  },
};

// ── Sound: Web Audio API ───────────────────────────────────────────────────────
const playSound = (type: "send" | "receive" | "delete") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(); osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (_) {}
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
const Avatar = ({
  url, name, size = "md", online,
}: {
  url?: string; name?: string; size?: "sm" | "md" | "lg"; online?: boolean;
}) => {
  const dim = size === "sm" ? "w-9 h-9 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-11 h-11 text-sm";
  return (
    <div className="relative shrink-0">
      {url ? (
        <img src={url} className={`${dim} rounded-full object-cover border-2 border-white/20`} />
      ) : (
        <div className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0`}>
          {name?.[0]?.toUpperCase() || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
        />
      )}
    </div>
  );
};

// ── MediaBubble ────────────────────────────────────────────────────────────────
const MediaBubble = ({ url, type }: { url: string; type: string }) => {
  if (type.startsWith("image/"))
    return <img src={url} className="max-w-[200px] rounded-2xl object-cover cursor-pointer" onClick={() => window.open(url, "_blank")} />;
  if (type.startsWith("video/"))
    return <video src={url} controls className="max-w-[200px] rounded-2xl" />;
  if (type.startsWith("audio/"))
    return (
      <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl">
        <Music size={14} className="text-blue-400 shrink-0" />
        <audio src={url} controls className="h-7 max-w-[160px]" />
      </div>
    );
  return <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 underline text-xs">Open file</a>;
};

// ── Smoke Particle ─────────────────────────────────────────────────────────────
const SmokeParticle = ({ x, y, onDone }: { x: number; y: number; onDone: () => void }) => {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    dist: 30 + Math.random() * 50,
    size: 6 + Math.random() * 10,
    delay: Math.random() * 0.1,
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed pointer-events-none z-[999]" style={{ left: x, top: y }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 0.8, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
            y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
            opacity: 0,
            scale: 0.2,
          }}
          transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
          className="absolute rounded-full bg-gray-400/60"
          style={{ width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
        />
      ))}
    </div>
  );
};

// ── Emoji Blast ────────────────────────────────────────────────────────────────
const EmojiBlast = ({ emoji, onDone }: { emoji: string; onDone: () => void }) => {
  const blasts = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    endY: -120 - Math.random() * 300,
    size: 28 + Math.random() * 32,
    delay: Math.random() * 0.4,
    rotate: (Math.random() - 0.5) * 720,
  }));
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {blasts.map((b) => (
        <motion.div
          key={b.id}
          initial={{ x: b.x, y: window.innerHeight, opacity: 1, rotate: 0, scale: 0.5 }}
          animate={{ y: window.innerHeight + b.endY, opacity: 0, rotate: b.rotate, scale: 1.5 }}
          transition={{ duration: 1.4, delay: b.delay, ease: "easeOut" }}
          className="absolute text-4xl select-none"
          style={{ fontSize: b.size }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChatSystem: React.FC<ChatSystemProps> = ({ isOpen, onClose, userId, onLogout }) => {
  const { openProfile } = useProfileViewer();

  // ── Persisted: theme, active status, muted chats, archived chats ──────────
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("cx_theme") as Theme) || "water");
  const [activeStatus, setActiveStatus] = useState(() => localStorage.getItem("cx_active_status") !== "false");
  const [mutedChats, setMutedChats] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cx_muted") || "[]")); } catch { return new Set(); }
  });
  const [archivedChats, setArchivedChats] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cx_archived") || "[]")); } catch { return new Set(); }
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [bottomTab, setBottomTab] = useState<BottomTab>("chat");
  const [menuPanel, setMenuPanel] = useState<MenuPanel>("main");

  // ── Friendship / contacts ─────────────────────────────────────────────────
  const [friendshipMap, setFriendshipMap] = useState<Map<string, FriendshipInfo>>(new Map());
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── Active chat ────────────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);

  // ── Fun ────────────────────────────────────────────────────────────────────
  const [smokeParticles, setSmokeParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [emojiBlast, setEmojiBlast] = useState<{ id: number; emoji: string } | null>(null);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const smokeIdRef = useRef(0);
  const blastIdRef = useRef(0);

  // ── Profile / settings ────────────────────────────────────────────────────
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Notifications (alerts) ────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<{ id: string; text: string; time: string; read: boolean }[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCount = useRef(0);

  const T = THEME_CFG[theme];

  // ── Persist settings ───────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("cx_theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("cx_active_status", String(activeStatus)); }, [activeStatus]);
  useEffect(() => { localStorage.setItem("cx_muted", JSON.stringify([...mutedChats])); }, [mutedChats]);
  useEffect(() => { localStorage.setItem("cx_archived", JSON.stringify([...archivedChats])); }, [archivedChats]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > prevMsgCount.current) {
      const last = messages[messages.length - 1];
      if (last?.sender_id !== userId) playSound("receive");
    }
    prevMsgCount.current = messages.length;
  }, [messages, userId]);

  // ── Fetch my profile ───────────────────────────────────────────────────────
  const fetchMyProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, school, location")
      .eq("id", userId)
      .single();
    if (data) {
      setMyProfile(data as Profile);
      setEditBio(data.bio || "");
      setEditSchool(data.school || "");
      setEditLocation(data.location || "");
    }
  }, [userId]);

  // ── Fetch friendships ─────────────────────────────────────────────────────
  const fetchFriendships = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!data) return;
    const map = new Map<string, FriendshipInfo>();
    for (const row of data) {
      const otherId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      map.set(otherId, { id: row.id, status: row.status, direction: row.sender_id === userId ? "sent" : "received" });
    }
    setFriendshipMap(map);
  }, [userId]);

  // ── Fetch pending requests ─────────────────────────────────────────────────
  const fetchPendingRequests = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, created_at")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setPendingRequests([]); setPendingCount(0); return; }
    const senderIds = data.map((r) => r.sender_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", senderIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const reqs: FriendRequest[] = data.map((r) => ({
      id: r.id, sender_id: r.sender_id, created_at: r.created_at,
      profile: profileMap.get(r.sender_id) || { id: r.sender_id, full_name: "Unknown", username: "", avatar_url: "" },
    }));
    setPendingRequests(reqs);
    setPendingCount(reqs.length);
    if (reqs.length > 0) {
      setAlerts((prev) => {
        const newAlerts = reqs
          .filter((r) => !prev.find((a) => a.id === `req-${r.id}`))
          .map((r) => ({
            id: `req-${r.id}`,
            text: `${r.profile.full_name} sent you a friend request`,
            time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            read: false,
          }));
        return [...newAlerts, ...prev].slice(0, 50);
      });
    }
  }, [userId]);

  // ── Fetch contacts ─────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { data: friendRows } = await supabase
        .from("friendships")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted");
      if (!friendRows || friendRows.length === 0) { setContacts([]); return; }
      const friendIds = friendRows.map((r) => r.sender_id === userId ? r.receiver_id : r.sender_id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, media_type, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      const contactMap = new Map<string, { last_message: string; last_message_at: string; last_media_type?: string }>();
      for (const msg of msgs || []) {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (friendIds.includes(otherId) && !contactMap.has(otherId))
          contactMap.set(otherId, { last_message: msg.content || "", last_message_at: msg.created_at, last_media_type: msg.media_type });
      }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", friendIds);
      const result: ChatContact[] = (profiles || []).map((p) => ({
        id: p.id, full_name: p.full_name || p.username || "Unknown", username: p.username || "", avatar_url: p.avatar_url || "",
        ...(contactMap.get(p.id) || {}),
      }));
      result.sort((a, b) => (b.last_message_at || "") > (a.last_message_at || "") ? 1 : -1);
      setContacts(result);
    } finally { setLoadingContacts(false); }
  }, [userId]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetchFriendships();
    fetchPendingRequests();
    fetchContacts();
    fetchMyProfile();
  }, [isOpen, fetchFriendships, fetchPendingRequests, fetchContacts, fetchMyProfile]);

  // ── Realtime: friendships ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const ch = supabase.channel(`friendships-rt-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships" }, (p) => {
        const row = p.new as any;
        if (row.receiver_id === userId || row.sender_id === userId) {
          fetchFriendships();
          if (row.receiver_id === userId && row.status === "pending") fetchPendingRequests();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friendships" }, (p) => {
        const row = p.new as any;
        if (row.receiver_id === userId || row.sender_id === userId) {
          fetchFriendships(); fetchPendingRequests();
          if (row.status === "accepted") fetchContacts();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isOpen, userId, fetchFriendships, fetchPendingRequests, fetchContacts]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data } = await supabase.from("profiles")
        .select("id, full_name, username, avatar_url")
        .neq("id", userId)
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);
      setSearchResults((data || []).map((p) => ({ id: p.id, full_name: p.full_name || p.username || "Unknown", username: p.username || "", avatar_url: p.avatar_url || "" })));
      setIsSearching(false);
    }, 300);
  }, [searchQuery, userId]);

  // ── Messages for selected user ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;
    const load = async () => {
      setLoadingMessages(true);
      const { data } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${userId})`)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      setLoadingMessages(false);
    };
    load();
    const ch = supabase.channel(`chat-${userId}-${selectedUser.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const msg = p.new as Message;
        const relevant = (msg.sender_id === userId && msg.receiver_id === selectedUser.id) ||
          (msg.sender_id === selectedUser.id && msg.receiver_id === userId);
        if (relevant) {
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
          fetchContacts();
          if (msg.sender_id !== userId && !mutedChats.has(selectedUser.id)) {
            setAlerts((prev) => [{ id: `msg-${msg.id}`, text: `${selectedUser.full_name}: ${msg.content || "📎 Media"}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), read: false }, ...prev].slice(0, 50));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedUser, userId, fetchContacts, mutedChats]);

  // ── Friend actions ─────────────────────────────────────────────────────────
  const sendFriendRequest = async (targetId: string) => {
    setActionLoading(targetId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const senderId = session?.user?.id ?? userId;
      const { error } = await supabase.from("friendships").insert({ sender_id: senderId, receiver_id: targetId, status: "pending" });
      if (error) { toast.error(`Request failed: ${error.message}`); return; }
      toast.success("Friend request sent!");
      await fetchFriendships();
    } catch (err: any) { toast.error(err?.message ?? "Error"); } finally { setActionLoading(""); }
  };
  const acceptRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", req.id);
      if (error) { toast.error(`Error: ${error.message}`); return; }
      toast.success("Friend request accepted!");
      await Promise.all([fetchFriendships(), fetchPendingRequests(), fetchContacts()]);
    } catch (err: any) { toast.error(err?.message ?? "Error"); } finally { setActionLoading(""); }
  };
  const rejectRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      await supabase.from("friendships").update({ status: "rejected" }).eq("id", req.id);
      await Promise.all([fetchFriendships(), fetchPendingRequests()]);
    } finally { setActionLoading(""); }
  };

  // ── Open chat ──────────────────────────────────────────────────────────────
  const handleSelectContact = (user: ChatContact) => {
    const fs = friendshipMap.get(user.id);
    if (!fs || fs.status !== "accepted") return;
    setSelectedUser(user);
    setSearchQuery(""); setSearchResults([]);
    setShowChatSearch(false); setChatSearch("");
    setShowEmojiGrid(false); setMsgMenuId(null);
  };
  const handleSelectFromSearch = (user: Profile) => {
    const fs = friendshipMap.get(user.id);
    if (!fs || fs.status !== "accepted") return;
    handleSelectContact({ ...user } as ChatContact);
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || isSending) return;
    const text = newMessage.trim();
    setNewMessage("");
    setIsSending(true);
    playSound("send");
    await supabase.from("messages").insert({ sender_id: userId, receiver_id: selectedUser.id, content: text });
    setIsSending(false);
  };

  // ── Delete message ─────────────────────────────────────────────────────────
  const deleteMessage = async (msg: Message, e: React.MouseEvent) => {
    if (msg.sender_id !== userId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    playSound("delete");
    const newId = ++smokeIdRef.current;
    setSmokeParticles((prev) => [...prev, { id: newId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
    setMsgMenuId(null);
    await supabase.from("messages").delete().eq("id", msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  // ── Media upload ───────────────────────────────────────────────────────────
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    e.target.value = "";
    setIsUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("chat-media").upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
      playSound("send");
      await supabase.from("messages").insert({ sender_id: userId, receiver_id: selectedUser.id, content: "", media_url: urlData.publicUrl, media_type: file.type });
    } catch (err) { console.error("Upload failed:", err); } finally { setIsUploadingMedia(false); }
  };

  // ── Save profile settings ──────────────────────────────────────────────────
  const saveProfileSettings = async () => {
    setSavingProfile(true);
    await supabase.from("profiles").update({ bio: editBio, school: editSchool, location: editLocation }).eq("id", userId);
    setSavingProfile(false);
    toast.success("Profile updated!");
    fetchMyProfile();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const lastMsgPreview = (c: ChatContact) => {
    if (c.last_media_type) {
      if (c.last_media_type.startsWith("image/")) return "📷 Photo";
      if (c.last_media_type.startsWith("video/")) return "🎥 Video";
      if (c.last_media_type.startsWith("audio/")) return "🎵 Audio";
      return "📎 File";
    }
    return c.last_message || "";
  };
  const toggleMute = (id: string) => setMutedChats((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleArchive = (id: string) => setArchivedChats((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visibleContacts = contacts.filter((c) => !archivedChats.has(c.id));
  const archivedContactsList = contacts.filter((c) => archivedChats.has(c.id));
  const filteredMessages = chatSearch.trim()
    ? messages.filter((m) => m.content?.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages;

  // ── Friend Action Button ───────────────────────────────────────────────────
  const FriendActionBtn = ({ user }: { user: Profile }) => {
    const fs = friendshipMap.get(user.id);
    const loading = actionLoading === user.id || actionLoading === fs?.id;
    if (fs?.status === "accepted")
      return (
        <button onClick={() => handleSelectFromSearch(user)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${T.pill}`}>
          <MessageSquare size={11} /> Chat
        </button>
      );
    if (fs?.status === "pending" && fs.direction === "sent")
      return <span className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black opacity-40 ${T.pill}`}><Clock size={11} /> Sent</span>;
    if (fs?.status === "pending" && fs.direction === "received")
      return (
        <button onClick={() => { const req = pendingRequests.find((r) => r.sender_id === user.id); if (req) acceptRequest(req); }} disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-black disabled:opacity-40">
          {loading ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />} Accept
        </button>
      );
    return (
      <button onClick={() => sendFriendRequest(user.id)} disabled={loading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all disabled:opacity-40 ${T.pill}`}>
        {loading ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />} Add
      </button>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`fixed inset-0 z-[150] flex flex-col ${T.wrap}`}
        >
          {/* ── Smoke particles ────────────────────────────────────────────── */}
          {smokeParticles.map((p) => (
            <SmokeParticle key={p.id} x={p.x} y={p.y}
              onDone={() => setSmokeParticles((prev) => prev.filter((s) => s.id !== p.id))} />
          ))}

          {/* ── Emoji blast ────────────────────────────────────────────────── */}
          {emojiBlast && (
            <EmojiBlast key={emojiBlast.id} emoji={emojiBlast.emoji}
              onDone={() => setEmojiBlast(null)} />
          )}

          {/* ── Main content ───────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ════════════════ CHAT TAB ════════════════ */}
            {bottomTab === "chat" && !selectedUser && (
              <div className={`flex flex-col flex-1 overflow-hidden ${T.sidebar} border-r ${T.divider}`}>

                {/* Header */}
                <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider}`}>
                  <div>
                    <p className={`text-xl font-black tracking-tight ${T.text1}`}>Messages</p>
                    <p className={`text-xs font-semibold ${T.text3}`}>{visibleContacts.length} conversations</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Theme Switcher */}
                    <div className="flex items-center gap-1 bg-black/10 rounded-2xl p-1">
                      {(["water", "nature", "plain"] as Theme[]).map((t) => (
                        <button key={t} onClick={() => setTheme(t)}
                          className={`w-7 h-7 rounded-xl text-sm flex items-center justify-center transition-all ${theme === t ? "bg-white/20 scale-110" : "opacity-40 hover:opacity-70"}`}>
                          {THEME_CFG[t].icon}
                        </button>
                      ))}
                    </div>
                    <button onClick={onClose}
                      className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3} hover:${T.text1} transition-all`}>
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Search bar */}
                <div className={`px-4 py-3 border-b ${T.divider}`}>
                  <div className="relative">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${T.text3}`} />
                    <input type="text" placeholder="Search people..."
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full rounded-2xl pl-9 pr-4 py-2.5 text-sm font-semibold outline-none border focus:ring-2 focus:ring-blue-500/30 transition-all ${T.searchBg}`} />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className={`absolute right-3 top-1/2 -translate-y-1/2 ${T.text3}`}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {searchQuery.trim() ? (
                    <>
                      <p className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}>Search Results</p>
                      {isSearching ? (
                        <div className="flex items-center justify-center py-8"><Loader2 size={18} className={`animate-spin ${T.text3}`} /></div>
                      ) : searchResults.length === 0 ? (
                        <p className={`text-xs px-5 py-3 ${T.text3}`}>No users found</p>
                      ) : (
                        searchResults.map((user) => (
                          <div key={user.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors`}>
                            <Avatar url={user.avatar_url} name={user.full_name} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black truncate ${T.text1}`}>{user.full_name}</p>
                              <p className={`text-[10px] ${T.text3}`}>@{user.username}</p>
                            </div>
                            <FriendActionBtn user={user} />
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {loadingContacts ? (
                        <div className="flex items-center justify-center py-10"><Loader2 size={20} className={`animate-spin ${T.text3}`} /></div>
                      ) : visibleContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                          <div className={`w-16 h-16 rounded-3xl bg-white/5 border ${T.divider} flex items-center justify-center`}>
                            <MessageSquare size={28} className={T.text3} />
                          </div>
                          <p className={`text-base font-black ${T.text3}`}>No chats yet</p>
                          <p className={`text-xs ${T.text3}`}>Add friends first, then start chatting</p>
                        </div>
                      ) : (
                        <>
                          <p className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}>Recent Chats</p>
                          {visibleContacts.map((c) => (
                            <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer active:scale-98`}
                              onClick={() => handleSelectContact(c)}>
                              <Avatar url={c.avatar_url} name={c.full_name} online={activeStatus} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className={`text-sm font-black truncate ${T.text1}`}>{c.full_name}</p>
                                  {c.last_message_at && <p className={`text-[10px] font-medium shrink-0 ml-2 ${T.text3}`}>{formatTime(c.last_message_at)}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  {mutedChats.has(c.id) && <VolumeX size={10} className={T.text3} />}
                                  <p className={`text-xs truncate ${T.text3}`}>{lastMsgPreview(c) || "Start a conversation"}</p>
                                </div>
                              </div>
                              {/* 3-dot menu */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === `contact-${c.id}` ? null : `contact-${c.id}`); }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center ${T.text3} hover:bg-white/10 transition-all`}>
                                <MoreVertical size={14} />
                              </button>
                              <AnimatePresence>
                                {msgMenuId === `contact-${c.id}` && (
                                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                    className={`absolute right-12 z-50 rounded-2xl border shadow-xl overflow-hidden min-w-[140px] ${T.msgMenuBg}`}
                                    onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => { toggleMute(c.id); setMsgMenuId(null); }}
                                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 transition-all ${T.text1}`}>
                                      {mutedChats.has(c.id) ? <><Volume2 size={14} /> Unmute</> : <><VolumeX size={14} /> Mute</>}
                                    </button>
                                    <button onClick={() => { toggleArchive(c.id); setMsgMenuId(null); }}
                                      className={`flex items-center gap-2 w-full px-4 py-3 text-sm font-bold hover:bg-white/5 transition-all ${T.text1}`}>
                                      <EyeOff size={14} /> Hide Chat
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════ FULL-SCREEN CHAT VIEW ════════════════ */}
            {bottomTab === "chat" && selectedUser && (
              <div className={`flex flex-col flex-1 overflow-hidden ${T.chat}`}>

                {/* Top Bar */}
                <div className={`flex items-center gap-3 px-4 py-3 border-b ${T.topbar} ${T.divider} shrink-0`}>
                  <button onClick={() => { setSelectedUser(null); setMessages([]); setShowChatSearch(false); setChatSearch(""); setShowEmojiGrid(false); }}
                    className={`w-10 h-10 rounded-2xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 transition-all active:scale-90`}>
                    <ArrowLeft size={20} />
                  </button>

                  <div className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" onClick={() => openProfile?.(selectedUser.id)}>
                    <Avatar url={selectedUser.avatar_url} name={selectedUser.full_name} size="md" online={activeStatus} />
                    <div className="min-w-0">
                      <p className={`text-base font-black truncate leading-tight ${T.text1}`}>{selectedUser.full_name}</p>
                      <p className={`text-[11px] font-semibold ${activeStatus ? "text-green-400" : "text-red-400"}`}>
                        {activeStatus ? "● Online" : "● Offline"}
                      </p>
                    </div>
                  </div>

                  {/* Chat search toggle */}
                  <button onClick={() => setShowChatSearch(!showChatSearch)}
                    className={`w-9 h-9 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text1} hover:bg-white/20 transition-all`}>
                    <Search size={16} />
                  </button>

                  {/* Emoji war button */}
                  <div className="relative">
                    <button onClick={() => setShowEmojiGrid(!showEmojiGrid)}
                      className={`w-9 h-9 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center text-base hover:bg-white/20 transition-all`}>
                      🥊
                    </button>
                    <AnimatePresence>
                      {showEmojiGrid && (
                        <motion.div initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 8 }}
                          className={`absolute right-0 top-12 z-50 rounded-2xl border p-2 grid grid-cols-2 gap-1.5 shadow-2xl ${T.msgMenuBg}`}>
                          {["🥊", "😂", "💩", "🔥"].map((em) => (
                            <button key={em} onClick={() => { setEmojiBlast({ id: ++blastIdRef.current, emoji: em }); setShowEmojiGrid(false); }}
                              className="w-12 h-12 rounded-xl text-2xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90">
                              {em}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Chat search bar */}
                <AnimatePresence>
                  {showChatSearch && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className={`px-4 py-2 border-b overflow-hidden ${T.divider}`}>
                      <div className="relative">
                        <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${T.text3}`} />
                        <input autoFocus type="text" placeholder="Search in conversation..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)}
                          className={`w-full rounded-2xl pl-9 pr-4 py-2 text-sm font-semibold outline-none border ${T.searchBg}`} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
                  onClick={() => { setMsgMenuId(null); setShowEmojiGrid(false); }}>
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-10"><Loader2 size={20} className={`animate-spin ${T.text3}`} /></div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <p className="text-4xl">💬</p>
                      <p className={`text-sm font-black ${T.text3}`}>{chatSearch ? "No messages found" : "Say hello!"}</p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isMine = msg.sender_id === userId;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMine ? "justify-end" : "justify-start"} group relative`}>
                          <div className="relative max-w-[78%]">
                            <div className={`px-4 py-2.5 rounded-2xl ${isMine ? `${T.bubbleSent} rounded-tr-sm` : `${T.bubbleRecv} rounded-tl-sm`}`}>
                              {msg.media_url && msg.media_type ? (
                                <MediaBubble url={msg.media_url} type={msg.media_type} />
                              ) : (
                                <p className="text-lg font-bold leading-snug break-words">{msg.content}</p>
                              )}
                              <p className={`text-[10px] mt-0.5 font-medium ${isMine ? "text-white/50" : T.text3} text-right`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>

                            {/* 3-dot on my message */}
                            {isMine && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); }}
                                className={`absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${T.text3} hover:bg-white/10`}>
                                <MoreVertical size={13} />
                              </button>
                            )}

                            {/* Message action menu */}
                            <AnimatePresence>
                              {msgMenuId === msg.id && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                  className={`absolute ${isMine ? "right-0" : "left-0"} bottom-full mb-1 z-50 rounded-2xl border shadow-xl overflow-hidden min-w-[130px] ${T.msgMenuBg}`}>
                                  {isMine && (
                                    <button
                                      onClick={(e) => deleteMessage(msg, e)}
                                      className="flex items-center gap-2 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all">
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className={`px-4 py-3 border-t ${T.divider} ${T.input} shrink-0`}>
                  <div className="flex items-end gap-2">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingMedia}
                      className={`w-10 h-10 rounded-2xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3} hover:bg-white/20 transition-all shrink-0 disabled:opacity-40`}>
                      {isUploadingMedia ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleMediaUpload}
                      accept="image/*,video/*,audio/*" />

                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Type a message..."
                      rows={1}
                      className={`flex-1 rounded-2xl px-4 py-2.5 text-lg font-bold outline-none border resize-none max-h-28 overflow-y-auto ${T.searchBg} focus:ring-2 focus:ring-blue-500/30 transition-all`}
                    />

                    <button onClick={sendMessage} disabled={!newMessage.trim() || isSending}
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 transition-all active:scale-90 disabled:opacity-40 ${T.accent}`}>
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════ STORY TAB ════════════════ */}
            {bottomTab === "story" && (
              <div className={`flex flex-col flex-1 overflow-hidden ${T.sidebar}`}>
                <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider}`}>
                  <div>
                    <p className={`text-xl font-black ${T.text1}`}>Stories</p>
                    <p className={`text-xs font-semibold ${T.text3}`}>Your daily status gallery</p>
                  </div>
                  <button onClick={onClose} className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}>
                    <X size={15} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  {/* Add Story */}
                  <div className={`flex items-center gap-4 p-4 rounded-2xl border ${T.divider} bg-white/5 mb-6 cursor-pointer hover:bg-white/10 transition-all`}>
                    <div className={`w-14 h-14 rounded-full border-2 border-dashed ${T.accentText} flex items-center justify-center text-2xl`}>+</div>
                    <div>
                      <p className={`text-base font-black ${T.text1}`}>Add to Your Story</p>
                      <p className={`text-xs ${T.text3}`}>Share a photo, video, or text</p>
                    </div>
                  </div>

                  {/* Friends stories */}
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${T.text3}`}>Friends' Stories</p>
                  <div className="grid grid-cols-2 gap-3">
                    {visibleContacts.slice(0, 6).map((c) => (
                      <div key={c.id}
                        className={`relative h-44 rounded-2xl overflow-hidden border ${T.divider} cursor-pointer hover:scale-105 transition-transform`}
                        onClick={() => toast.info("Story viewer coming soon!")}>
                        <div className="w-full h-full bg-gradient-to-b from-purple-600/50 to-blue-900/80 flex items-end p-3">
                          <div className="absolute top-3 left-3">
                            <div className={`w-10 h-10 rounded-full border-3 border-pink-500 overflow-hidden`}>
                              <Avatar url={c.avatar_url} name={c.full_name} size="sm" />
                            </div>
                          </div>
                          <p className={`text-xs font-black text-white truncate`}>{c.full_name.split(" ")[0]}</p>
                        </div>
                      </div>
                    ))}
                    {visibleContacts.length === 0 && (
                      <div className={`col-span-2 flex flex-col items-center justify-center py-16 gap-3 text-center`}>
                        <p className="text-5xl">📖</p>
                        <p className={`text-sm font-black ${T.text3}`}>No stories yet</p>
                        <p className={`text-xs ${T.text3}`}>Add friends to see their stories here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════ ALERT TAB ════════════════ */}
            {bottomTab === "alert" && (
              <div className={`flex flex-col flex-1 overflow-hidden ${T.sidebar}`}>
                <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider}`}>
                  <div>
                    <p className={`text-xl font-black ${T.text1}`}>Alerts</p>
                    <p className={`text-xs font-semibold ${T.text3}`}>{alerts.filter((a) => !a.read).length} unread</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                      <button onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))}
                        className={`text-xs font-black px-3 py-1.5 rounded-xl ${T.pill} transition-all`}>
                        Mark all read
                      </button>
                    )}
                    <button onClick={onClose} className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {pendingCount > 0 && (
                    <div className={`mx-4 mt-4 p-4 rounded-2xl border ${T.divider} bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 transition-all`}
                      onClick={() => { setBottomTab("menu"); setMenuPanel("requests"); }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <Users size={18} className="text-blue-400" />
                        </div>
                        <div>
                          <p className={`text-sm font-black ${T.text1}`}>{pendingCount} Friend Request{pendingCount > 1 ? "s" : ""}</p>
                          <p className={`text-xs ${T.text3}`}>Tap to view and respond</p>
                        </div>
                        <span className="ml-auto w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">{pendingCount}</span>
                      </div>
                    </div>
                  )}
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                      <p className="text-5xl">🔔</p>
                      <p className={`text-base font-black ${T.text3}`}>All clear!</p>
                      <p className={`text-xs ${T.text3}`}>Chat and system notifications will appear here</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {alerts.map((a) => (
                        <div key={a.id}
                          className={`flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer ${!a.read ? "bg-blue-500/5" : ""}`}
                          onClick={() => setAlerts((prev) => prev.map((x) => x.id === a.id ? { ...x, read: true } : x))}>
                          <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${a.read ? "bg-transparent" : "bg-blue-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold leading-snug ${T.text1}`}>{a.text}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${T.text3}`}>{a.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════ MENU TAB ════════════════ */}
            {bottomTab === "menu" && (
              <div className={`flex flex-col flex-1 overflow-hidden ${T.sidebar}`}>

                {/* Menu Header */}
                <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${T.divider}`}>
                  <div className="flex items-center gap-2">
                    {menuPanel !== "main" && (
                      <button onClick={() => setMenuPanel("main")} className={`w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center ${T.text1}`}>
                        <ArrowLeft size={16} />
                      </button>
                    )}
                    <div>
                      <p className={`text-xl font-black ${T.text1}`}>
                        {menuPanel === "main" ? "Menu" : menuPanel === "settings" ? "Settings" : menuPanel === "archive" ? "Archived Chats" : "Message Requests"}
                      </p>
                    </div>
                  </div>
                  <button onClick={onClose} className={`w-8 h-8 rounded-xl bg-white/10 border ${T.divider} flex items-center justify-center ${T.text3}`}>
                    <X size={15} />
                  </button>
                </div>

                {/* ── Menu Main ── */}
                {menuPanel === "main" && (
                  <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2">

                    {/* Profile preview */}
                    {myProfile && (
                      <div className={`flex items-center gap-4 p-4 rounded-2xl border ${T.divider} bg-white/5 mb-4`}>
                        <Avatar url={myProfile.avatar_url} name={myProfile.full_name} size="lg" online={activeStatus} />
                        <div>
                          <p className={`text-base font-black ${T.text1}`}>{myProfile.full_name}</p>
                          <p className={`text-xs ${T.text3}`}>@{myProfile.username}</p>
                          {myProfile.bio && <p className={`text-xs mt-0.5 italic ${T.text2}`}>"{myProfile.bio}"</p>}
                        </div>
                      </div>
                    )}

                    {[
                      { icon: <Settings size={18} />, label: "Settings", desc: "Personal info, status, themes", action: () => setMenuPanel("settings") },
                      { icon: <Archive size={18} />, label: "Archive", desc: `${archivedContactsList.length} hidden chat${archivedContactsList.length !== 1 ? "s" : ""}`, action: () => setMenuPanel("archive") },
                      { icon: <Users size={18} />, label: "Message Requests", desc: `${pendingCount} pending`, action: () => setMenuPanel("requests"), badge: pendingCount },
                    ].map((item) => (
                      <button key={item.label} onClick={item.action}
                        className={`flex items-center justify-between w-full p-4 rounded-2xl border ${T.divider} bg-white/5 hover:bg-white/10 transition-all text-left`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ${T.text2}`}>{item.icon}</div>
                          <div>
                            <p className={`text-sm font-black ${T.text1}`}>{item.label}</p>
                            <p className={`text-[10px] ${T.text3}`}>{item.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge ? <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center">{item.badge}</span> : null}
                          <ChevronLeft size={14} className={`rotate-180 ${T.text3}`} />
                        </div>
                      </button>
                    ))}

                    <button onClick={onLogout || onClose}
                      className={`flex items-center gap-3 w-full p-4 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all text-left mt-4`}>
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400"><LogOut size={18} /></div>
                      <div>
                        <p className="text-sm font-black text-red-400">Logout</p>
                        <p className={`text-[10px] ${T.text3}`}>Sign out of your account</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* ── Settings Panel ── */}
                {menuPanel === "settings" && (
                  <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">

                    {/* Theme */}
                    <div className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}>
                      <p className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}>Chat Theme</p>
                      <div className="flex gap-3">
                        {(["water", "nature", "plain"] as Theme[]).map((t) => (
                          <button key={t} onClick={() => setTheme(t)}
                            className={`flex-1 py-3 rounded-2xl border-2 transition-all font-black text-sm ${theme === t ? `border-blue-500 bg-blue-500/10 ${T.text1}` : `border-transparent bg-white/5 ${T.text3}`}`}>
                            <div className="text-xl mb-1">{THEME_CFG[t].icon}</div>
                            {THEME_CFG[t].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Status */}
                    <div className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}>
                      <p className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}>Privacy</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-black ${T.text1}`}>Active Status</p>
                          <p className={`text-xs ${T.text3}`}>{activeStatus ? "Others can see you as Online (🟢)" : "You appear as Offline (🔴)"}</p>
                        </div>
                        <button onClick={() => setActiveStatus(!activeStatus)}
                          className={`relative w-12 h-6 rounded-full transition-all border ${activeStatus ? "bg-green-500 border-green-400" : "bg-gray-500 border-gray-400"}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${activeStatus ? "left-6" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {/* Personal Info */}
                    <div className={`p-4 rounded-2xl border ${T.divider} bg-white/5`}>
                      <p className={`text-xs font-black uppercase tracking-widest mb-3 ${T.text3}`}>Personal Info</p>
                      <div className="space-y-3">
                        {[
                          { icon: <Info size={14} />, label: "Bio", value: editBio, setter: setEditBio, placeholder: "Write a short bio..." },
                          { icon: <GraduationCap size={14} />, label: "School / College", value: editSchool, setter: setEditSchool, placeholder: "Your school or college..." },
                          { icon: <MapPin size={14} />, label: "Location", value: editLocation, setter: setEditLocation, placeholder: "City, Country..." },
                        ].map((f) => (
                          <div key={f.label}>
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1 ${T.text3}`}>{f.icon}{f.label}</p>
                            <input value={f.value} onChange={(e) => f.setter(e.target.value)}
                              placeholder={f.placeholder}
                              className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border focus:ring-2 focus:ring-blue-500/30 transition-all ${T.searchBg}`} />
                          </div>
                        ))}
                        <button onClick={saveProfileSettings} disabled={savingProfile}
                          className={`w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all ${T.accent}`}>
                          {savingProfile ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Archive Panel ── */}
                {menuPanel === "archive" && (
                  <div className="flex-1 overflow-y-auto">
                    {archivedContactsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                        <p className="text-5xl">📦</p>
                        <p className={`text-base font-black ${T.text3}`}>No hidden chats</p>
                        <p className={`text-xs ${T.text3}`}>Long-press a chat and tap "Hide" to archive it</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        <p className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}>Hidden Chats</p>
                        {archivedContactsList.map((c) => (
                          <div key={c.id} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer`}
                            onClick={() => { handleSelectContact(c); setBottomTab("chat"); setMenuPanel("main"); }}>
                            <Avatar url={c.avatar_url} name={c.full_name} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black truncate ${T.text1}`}>{c.full_name}</p>
                              <p className={`text-xs truncate ${T.text3}`}>{lastMsgPreview(c) || "No messages"}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleArchive(c.id); }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${T.pill}`}>
                              <Eye size={11} /> Unhide
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Message Requests ── */}
                {menuPanel === "requests" && (
                  <div className="flex-1 overflow-y-auto">
                    {pendingRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
                        <p className="text-5xl">📨</p>
                        <p className={`text-base font-black ${T.text3}`}>No requests</p>
                        <p className={`text-xs ${T.text3}`}>Friend requests from new people appear here</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        <p className={`text-[10px] font-black uppercase tracking-widest px-5 pt-3 pb-1 ${T.text3}`}>Incoming Requests ({pendingCount})</p>
                        {pendingRequests.map((req) => {
                          const busy = actionLoading === req.id;
                          return (
                            <motion.div key={req.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors">
                              <Avatar url={req.profile.avatar_url} name={req.profile.full_name} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black truncate ${T.text1}`}>{req.profile.full_name}</p>
                                <p className={`text-[10px] ${T.text3}`}>@{req.profile.username}</p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => acceptRequest(req)} disabled={busy}
                                  className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/40 transition-all disabled:opacity-40">
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                </button>
                                <button onClick={() => rejectRequest(req)} disabled={busy}
                                  className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40">
                                  <X size={13} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════════════ BOTTOM NAVIGATION ════════════════ */}
          {!selectedUser && (
            <div className={`shrink-0 border-t ${T.nav} ${T.divider}`}>
              <div className="flex items-center px-2 pb-safe">
                {[
                  { tab: "chat" as BottomTab, icon: <MessageSquare size={22} />, label: "Chat", badge: 0 },
                  { tab: "story" as BottomTab, icon: <BookOpen size={22} />, label: "Story", badge: 0 },
                  { tab: "alert" as BottomTab, icon: <Bell size={22} />, label: "Alert", badge: alerts.filter((a) => !a.read).length },
                  { tab: "menu" as BottomTab, icon: <LayoutGrid size={22} />, label: "Menu", badge: pendingCount },
                ].map(({ tab, icon, label, badge }) => (
                  <button key={tab} onClick={() => { setBottomTab(tab); if (tab !== "menu") setMenuPanel("main"); }}
                    className={`flex-1 flex flex-col items-center gap-1 py-3.5 transition-all relative ${bottomTab === tab ? T.accentText : T.text3}`}>
                    <div className={`relative transition-transform ${bottomTab === tab ? "scale-110" : "scale-100"}`}>
                      {icon}
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${bottomTab === tab ? T.accentText : T.text3}`}>{label}</span>
                    {bottomTab === tab && (
                      <motion.div layoutId="nav-indicator"
                        className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${T.accent}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSystem;
