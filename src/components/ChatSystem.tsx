import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronLeft,
  Send,
  Paperclip,
  Music,
  Loader2,
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Check,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
}

interface ChatContact extends Profile {
  last_message?: string;
  last_message_at?: string;
  last_media_type?: string;
}

interface FriendshipInfo {
  id: string;
  status: "pending" | "accepted" | "rejected";
  direction: "sent" | "received"; // relative to current user
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
}

interface ChatSystemProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

// ── Avatar helper ──────────────────────────────────────────────────────────────
const Avatar = ({
  url,
  name,
  size = "md",
}: {
  url?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}) => {
  const dim =
    size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-xl"
        : "w-11 h-11 text-sm";
  return url ? (
    <img
      src={url}
      className={`${dim} rounded-full object-cover border-2 border-white/10 shrink-0`}
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-blue-600 flex items-center justify-center text-white font-black shrink-0`}
    >
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
};

// ── Media bubble ───────────────────────────────────────────────────────────────
const MediaBubble = ({ url, type }: { url: string; type: string }) => {
  if (type.startsWith("image/"))
    return (
      <img
        src={url}
        className="max-w-[220px] rounded-2xl object-cover cursor-pointer"
        onClick={() => window.open(url, "_blank")}
      />
    );
  if (type.startsWith("video/"))
    return <video src={url} controls className="max-w-[220px] rounded-2xl" />;
  if (type.startsWith("audio/"))
    return (
      <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl">
        <Music size={16} className="text-blue-400 shrink-0" />
        <audio src={url} controls className="h-8 max-w-[180px]" />
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 underline text-xs">
      Open file
    </a>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChatSystem: React.FC<ChatSystemProps> = ({ isOpen, onClose, userId }) => {
  const { openProfile } = useProfileViewer();
  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState<"chats" | "requests">("chats");

  // Friendship data
  const [friendshipMap, setFriendshipMap] = useState<Map<string, FriendshipInfo>>(new Map());
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string>(""); // friendshipId being processed

  // Contacts (accepted friends with message history)
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Chat window
  const [selectedUser, setSelectedUser] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Mobile view
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch all friendships for current user ─────────────────────────────────
  const fetchFriendships = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (!data) return;

    const map = new Map<string, FriendshipInfo>();
    for (const row of data) {
      const otherId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      map.set(otherId, {
        id: row.id,
        status: row.status,
        direction: row.sender_id === userId ? "sent" : "received",
      });
    }
    setFriendshipMap(map);
  }, [userId]);

  // ── Fetch pending incoming requests ───────────────────────────────────────
  const fetchPendingRequests = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select("id, sender_id, created_at")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setPendingRequests([]);
      setPendingCount(0);
      return;
    }

    const senderIds = data.map((r) => r.sender_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", senderIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const requests: FriendRequest[] = data.map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      created_at: r.created_at,
      profile: profileMap.get(r.sender_id) || {
        id: r.sender_id,
        full_name: "Unknown",
        username: "",
        avatar_url: "",
      },
    }));

    setPendingRequests(requests);
    setPendingCount(requests.length);
  }, [userId]);

  // ── Fetch accepted-friends with chat history ───────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      // Step 1: get accepted friend IDs
      const { data: friendRows } = await supabase
        .from("friendships")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted");

      if (!friendRows || friendRows.length === 0) {
        setContacts([]);
        return;
      }

      const friendIds = friendRows.map((r) =>
        r.sender_id === userId ? r.receiver_id : r.sender_id
      );

      // Step 2: get latest message per friend (among accepted friends only)
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, media_type, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      const contactMap = new Map<
        string,
        { last_message: string; last_message_at: string; last_media_type?: string }
      >();

      for (const msg of msgs || []) {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (friendIds.includes(otherId) && !contactMap.has(otherId)) {
          contactMap.set(otherId, {
            last_message: msg.content || "",
            last_message_at: msg.created_at,
            last_media_type: msg.media_type,
          });
        }
      }

      // Step 3: fetch profiles for friends (even if no messages yet)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", friendIds);

      const result: ChatContact[] = (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name || p.username || "Unknown",
        username: p.username || "",
        avatar_url: p.avatar_url || "",
        ...(contactMap.get(p.id) || {}),
      }));

      result.sort((a, b) =>
        (b.last_message_at || "") > (a.last_message_at || "") ? 1 : -1
      );

      setContacts(result);
    } finally {
      setLoadingContacts(false);
    }
  }, [userId]);

  // ── Bootstrap on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetchFriendships();
    fetchPendingRequests();
    fetchContacts();
  }, [isOpen, fetchFriendships, fetchPendingRequests, fetchContacts]);

  // ── Real-time: friendships table ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel(`friendships-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        (payload) => {
          const row = payload.new as any;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            if (row.receiver_id === userId && row.status === "pending") {
              fetchPendingRequests();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships" },
        (payload) => {
          const row = payload.new as any;
          if (row.receiver_id === userId || row.sender_id === userId) {
            fetchFriendships();
            fetchPendingRequests();
            if (row.status === "accepted") {
              fetchContacts();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userId, fetchFriendships, fetchPendingRequests, fetchContacts]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .neq("id", userId)
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20);
      setSearchResults(
        (data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name || p.username || "Unknown",
          username: p.username || "",
          avatar_url: p.avatar_url || "",
        }))
      );
      setIsSearching(false);
    }, 300);
  }, [searchQuery, userId]);

  // ── Messages for selected user ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;

    const load = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${userId})`
        )
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      setLoadingMessages(false);
    };

    load();

    const channel = supabase
      .channel(`chat-${userId}-${selectedUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          const relevant =
            (msg.sender_id === userId && msg.receiver_id === selectedUser.id) ||
            (msg.sender_id === selectedUser.id && msg.receiver_id === userId);
          if (relevant) {
            setMessages((prev) =>
              prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
            fetchContacts();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, userId, fetchContacts]);

  // ── Friend actions ─────────────────────────────────────────────────────────
  const sendFriendRequest = async (targetId: string) => {
    setActionLoading(targetId);
    try {
      // Always use the live auth session uid as the sender
      const { data: { session } } = await supabase.auth.getSession();
      const senderId = session?.user?.id ?? userId;

      if (!senderId) {
        toast.error("Not authenticated — please log in again.");
        return;
      }

      console.log("[sendFriendRequest] sender:", senderId, "→ receiver:", targetId);

      const { error } = await supabase.from("friendships").insert({
        sender_id: senderId,
        receiver_id: targetId,
        status: "pending",
      });

      if (error) {
        console.error("[sendFriendRequest] insert error:", error);
        toast.error(`Friend request failed: ${error.message}`);
        return;
      }

      toast.success("Friend request sent!");
      await fetchFriendships();
    } catch (err: any) {
      console.error("[sendFriendRequest] exception:", err);
      toast.error(err?.message ?? "Something went wrong sending the request.");
    } finally {
      setActionLoading("");
    }
  };

  const acceptRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", req.id);
      if (error) {
        console.error("[acceptRequest] error:", error);
        toast.error(`Could not accept request: ${error.message}`);
        return;
      }
      toast.success("Friend request accepted!");
      await Promise.all([fetchFriendships(), fetchPendingRequests(), fetchContacts()]);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setActionLoading("");
    }
  };

  const rejectRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "rejected" })
        .eq("id", req.id);
      if (error) {
        console.error("[rejectRequest] error:", error);
        toast.error(`Could not reject request: ${error.message}`);
        return;
      }
      await Promise.all([fetchFriendships(), fetchPendingRequests()]);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setActionLoading("");
    }
  };

  // ── Open chat (only for accepted friends) ────────────────────────────────
  const handleSelectContact = (user: ChatContact) => {
    const fs = friendshipMap.get(user.id);
    if (!fs || fs.status !== "accepted") return;
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);
    setMobileView("chat");
  };

  const handleSelectFromSearch = (user: Profile) => {
    const fs = friendshipMap.get(user.id);
    if (!fs || fs.status !== "accepted") return;
    const contact: ChatContact = { ...user };
    setSelectedUser(contact);
    setSearchQuery("");
    setSearchResults([]);
    setMobileView("chat");
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || isSending) return;
    const text = newMessage.trim();
    setNewMessage("");
    setIsSending(true);
    await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: selectedUser.id,
      content: text,
    });
    setIsSending(false);
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
      const { error } = await supabase.storage
        .from("chat-media")
        .upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("chat-media")
        .getPublicUrl(fileName);
      await supabase.from("messages").insert({
        sender_id: userId,
        receiver_id: selectedUser.id,
        content: "",
        media_url: urlData.publicUrl,
        media_type: file.type,
      });
    } catch (err) {
      console.error("Media upload failed:", err);
    } finally {
      setIsUploadingMedia(false);
    }
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

  // ── Search result action button ────────────────────────────────────────────
  const FriendActionBtn = ({ user }: { user: Profile }) => {
    const fs = friendshipMap.get(user.id);
    const loading = actionLoading === user.id;

    if (fs?.status === "accepted") {
      return (
        <button
          onClick={() => handleSelectFromSearch(user)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-black hover:bg-blue-600/30 transition-all"
        >
          <MessageSquare size={12} /> Chat
        </button>
      );
    }
    if (fs?.status === "pending" && fs.direction === "sent") {
      return (
        <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/30 text-xs font-black cursor-not-allowed">
          <Clock size={12} /> Sent
        </span>
      );
    }
    if (fs?.status === "pending" && fs.direction === "received") {
      return (
        <button
          onClick={() => {
            const req = pendingRequests.find((r) => r.sender_id === user.id);
            if (req) acceptRequest(req);
          }}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 text-xs font-black hover:bg-green-600/30 transition-all disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
          Accept
        </button>
      );
    }
    // No friendship
    return (
      <button
        onClick={() => sendFriendRequest(user.id)}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-black hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserPlus size={12} />
        )}
        Add
      </button>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-[150] flex
            h-[92vh]
            sm:h-[600px] sm:w-[720px] sm:right-6 sm:left-auto sm:bottom-6 sm:inset-x-auto
            bg-slate-900/95 backdrop-blur-3xl
            rounded-t-[2.5rem] sm:rounded-[2.5rem]
            shadow-2xl border border-white/10 overflow-hidden"
        >
          {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
          <div
            className={`flex flex-col w-full sm:w-72 border-r border-white/10 shrink-0 ${
              mobileView === "chat" ? "hidden sm:flex" : "flex"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
              <p className="text-base font-black text-white tracking-tight">Messages</p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0">
              <button
                onClick={() => setSidebarTab("chats")}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                  sidebarTab === "chats"
                    ? "text-white border-b-2 border-blue-500"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <MessageSquare size={12} /> Chats
                </div>
              </button>
              <button
                onClick={() => setSidebarTab("requests")}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-all relative ${
                  sidebarTab === "requests"
                    ? "text-white border-b-2 border-blue-500"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Users size={12} /> Requests
                  {pendingCount > 0 && (
                    <span className="w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Search (only on Chats tab) */}
            {sidebarTab === "chats" && (
              <div className="px-4 py-3 border-b border-white/10 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-2.5 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* List area */}
            <div className="flex-1 overflow-y-auto">

              {/* ── REQUESTS TAB ────────────────────────────────────────── */}
              {sidebarTab === "requests" && (
                <>
                  {pendingRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <UserPlus size={24} className="text-white/20" />
                      </div>
                      <p className="text-sm font-black text-white/30">No pending requests</p>
                      <p className="text-xs text-white/20">Friend requests will appear here</p>
                    </div>
                  ) : (
                    <div className="py-2 space-y-0">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-5 pt-3 pb-1">
                        Incoming Requests
                      </p>
                      {pendingRequests.map((req) => {
                        const busy = actionLoading === req.id;
                        return (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <Avatar
                              url={req.profile.avatar_url}
                              name={req.profile.full_name}
                              size="md"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-white truncate leading-tight">
                                {req.profile.full_name}
                              </p>
                              <p className="text-[10px] text-white/40 leading-tight">
                                @{req.profile.username}
                              </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => acceptRequest(req)}
                                disabled={busy}
                                className="w-8 h-8 rounded-xl bg-green-600/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-600/40 transition-all disabled:opacity-40"
                              >
                                {busy ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Check size={13} />
                                )}
                              </button>
                              <button
                                onClick={() => rejectRequest(req)}
                                disabled={busy}
                                className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-600/20 transition-all disabled:opacity-40"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── CHATS TAB ───────────────────────────────────────────── */}
              {sidebarTab === "chats" && (
                <>
                  {/* Search results */}
                  {searchQuery.trim() && (
                    <div className="py-1">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-5 pt-3 pb-1">
                        Search Results
                      </p>
                      {isSearching ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="animate-spin text-white/30" />
                        </div>
                      ) : searchResults.length === 0 ? (
                        <p className="text-xs text-white/20 px-5 py-3">No users found</p>
                      ) : (
                        searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <Avatar url={user.avatar_url} name={user.full_name} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-white truncate leading-tight">
                                {user.full_name}
                              </p>
                              <p className="text-[10px] text-white/40 leading-tight">
                                @{user.username}
                              </p>
                            </div>
                            <FriendActionBtn user={user} />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Recent chats (accepted friends only) */}
                  {!searchQuery.trim() && (
                    <>
                      {loadingContacts ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 size={20} className="animate-spin text-white/30" />
                        </div>
                      ) : contacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <MessageSquare size={24} className="text-white/20" />
                          </div>
                          <p className="text-sm font-black text-white/30">No chats yet</p>
                          <p className="text-xs text-white/20">
                            Add friends first, then start chatting
                          </p>
                        </div>
                      ) : (
                        <div className="py-1">
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-5 pt-3 pb-1">
                            Friends
                          </p>
                          {contacts.map((contact) => (
                            <button
                              key={contact.id}
                              onClick={() => handleSelectContact(contact)}
                              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                                selectedUser?.id === contact.id
                                  ? "bg-blue-600/10 border-r-2 border-blue-500"
                                  : ""
                              }`}
                            >
                              <Avatar url={contact.avatar_url} name={contact.full_name} size="md" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white truncate leading-tight">
                                  {contact.full_name}
                                </p>
                                <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">
                                  {contact.last_message_at
                                    ? lastMsgPreview(contact) || (
                                        <span className="italic text-white/20">Say hello!</span>
                                      )
                                    : (
                                        <span className="italic text-white/20">Start chatting</span>
                                      )}
                                </p>
                              </div>
                              {contact.last_message_at && (
                                <span className="text-[10px] text-white/30 shrink-0">
                                  {formatTime(contact.last_message_at)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── CHAT WINDOW ─────────────────────────────────────────────── */}
          <div
            className={`flex-1 flex flex-col min-w-0 ${
              mobileView === "list" ? "hidden sm:flex" : "flex"
            }`}
          >
            {selectedUser ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
                  <button
                    onClick={() => setMobileView("list")}
                    className="sm:hidden p-1.5 rounded-xl bg-white/5 text-white/60 hover:text-white border border-white/10"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="cursor-pointer" onClick={() => selectedUser.id && openProfile(selectedUser.id)}>
                    <Avatar url={selectedUser.avatar_url} name={selectedUser.full_name} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => selectedUser.id && openProfile(selectedUser.id)}>
                    <p className="text-sm font-black text-white truncate">{selectedUser.full_name}</p>
                    <p className="text-[10px] text-white/40">@{selectedUser.username}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="sm:hidden w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin text-white/30" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                      <Avatar url={selectedUser.avatar_url} name={selectedUser.full_name} size="lg" />
                      <p className="text-sm font-black text-white/50">{selectedUser.full_name}</p>
                      <p className="text-xs text-white/25">Say hello to start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === userId;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                            {msg.media_url && msg.media_type && (
                              <div className={`rounded-[1.5rem] overflow-hidden ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
                                <MediaBubble url={msg.media_url} type={msg.media_type} />
                              </div>
                            )}
                            {msg.content && (
                              <div className={`px-4 py-2.5 text-sm font-semibold leading-relaxed ${
                                isMe
                                  ? "bg-blue-600 text-white rounded-[1.5rem] rounded-tr-sm"
                                  : "bg-white/10 text-white border border-white/10 rounded-[1.5rem] rounded-tl-sm"
                              }`}>
                                {msg.content}
                              </div>
                            )}
                            <span className="text-[9px] text-white/25 px-1">{formatTime(msg.created_at)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-white/10 bg-white/5 shrink-0 flex items-end gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingMedia}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0 disabled:opacity-40"
                  >
                    {isUploadingMedia ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Paperclip size={16} />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*,video/*,audio/*"
                    onChange={handleMediaUpload}
                  />
                  <textarea
                    rows={1}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none leading-relaxed overflow-hidden"
                    style={{ minHeight: "40px" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 transition-all flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-col items-center justify-center h-full gap-4 text-center px-8 hidden sm:flex">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <MessageSquare size={28} className="text-white/20" />
                </div>
                <p className="text-base font-black text-white/30">Select a conversation</p>
                <p className="text-xs text-white/20">
                  Pick a friend from the left or search to find someone.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSystem;
