import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronLeft,
  Send,
  Paperclip,
  Music,
  Video,
  ImageIcon,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatContact {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  last_message?: string;
  last_message_at?: string;
  last_media_type?: string;
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
    size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-11 h-11 text-sm";
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

// ── Media preview in message bubble ───────────────────────────────────────────
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
    return (
      <video
        src={url}
        controls
        className="max-w-[220px] rounded-2xl"
      />
    );
  if (type.startsWith("audio/"))
    return (
      <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl">
        <Music size={16} className="text-blue-400 shrink-0" />
        <audio src={url} controls className="h-8 max-w-[180px]" />
      </div>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-blue-400 underline text-xs"
    >
      Open file
    </a>
  );
};

// ── Main ChatSystem Component ──────────────────────────────────────────────────
const ChatSystem: React.FC<ChatSystemProps> = ({ isOpen, onClose, userId }) => {
  // Sidebar state
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Chat window state
  const [selectedUser, setSelectedUser] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Mobile: "list" or "chat"
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scroll to bottom whenever messages change ────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch recent chat contacts on open ────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      // Get all messages involving the current user
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, media_type, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (!msgs || msgs.length === 0) {
        setContacts([]);
        setLoadingContacts(false);
        return;
      }

      // Build a map: other_user_id → latest message info
      const contactMap = new Map<
        string,
        { last_message: string; last_message_at: string; last_media_type?: string }
      >();

      for (const msg of msgs) {
        const otherId =
          msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, {
            last_message: msg.content || "",
            last_message_at: msg.created_at,
            last_media_type: msg.media_type,
          });
        }
      }

      // Fetch profiles for all contact IDs
      const contactIds = Array.from(contactMap.keys());
      if (contactIds.length === 0) {
        setContacts([]);
        setLoadingContacts(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", contactIds);

      if (!profiles) {
        setLoadingContacts(false);
        return;
      }

      const result: ChatContact[] = profiles.map((p) => ({
        id: p.id,
        full_name: p.full_name || p.username || "Unknown",
        username: p.username || "",
        avatar_url: p.avatar_url || "",
        ...contactMap.get(p.id),
      }));

      // Sort by most recent message
      result.sort((a, b) =>
        (b.last_message_at || "") > (a.last_message_at || "") ? 1 : -1
      );

      setContacts(result);
    } finally {
      setLoadingContacts(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchContacts();
  }, [isOpen, fetchContacts]);

  // ── Search profiles as user types ────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
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

  // ── Fetch messages when a user is selected ────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;

    const loadMessages = async () => {
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

    loadMessages();

    // Real-time subscription for new messages
    const channel = supabase
      .channel(`chat-${userId}-${selectedUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === userId && msg.receiver_id === selectedUser.id) ||
            (msg.sender_id === selectedUser.id && msg.receiver_id === userId)
          ) {
            setMessages((prev) => {
              // Avoid duplicate if optimistic insert already added it
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Refresh contacts so sidebar snippet updates
            fetchContacts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser, userId, fetchContacts]);

  // ── Select a user and switch to chat view ────────────────────────────────
  const handleSelectUser = (user: ChatContact) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSearchResults([]);
    setMobileView("chat");
  };

  // ── Send text message ─────────────────────────────────────────────────────
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

  // ── Send media message ────────────────────────────────────────────────────
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    e.target.value = "";

    setIsUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
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

  // ── Sidebar list to display ───────────────────────────────────────────────
  const displayList: ChatContact[] =
    searchQuery.trim() ? searchResults : contacts;

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
            className={`
              flex flex-col w-full sm:w-72 border-r border-white/10 shrink-0
              ${mobileView === "chat" ? "hidden sm:flex" : "flex"}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
              <p className="text-base font-black text-white tracking-tight">Messages</p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />
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

            {/* Contact / Search List */}
            <div className="flex-1 overflow-y-auto">
              {(loadingContacts || isSearching) ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-white/30" />
                </div>
              ) : displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <MessageSquare size={24} className="text-white/20" />
                  </div>
                  <p className="text-sm font-black text-white/30">
                    {searchQuery ? "No users found" : "No conversations yet"}
                  </p>
                  <p className="text-xs text-white/20">
                    {searchQuery
                      ? "Try a different name or username"
                      : "Search for someone to start chatting"}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {searchQuery && (
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-5 pt-3 pb-1">
                      Search Results
                    </p>
                  )}
                  {!searchQuery && contacts.length > 0 && (
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest px-5 pt-3 pb-1">
                      Recent Chats
                    </p>
                  )}
                  {displayList.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectUser(contact)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                        selectedUser?.id === contact.id ? "bg-blue-600/10 border-r-2 border-blue-500" : ""
                      }`}
                    >
                      <Avatar
                        url={contact.avatar_url}
                        name={contact.full_name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate leading-tight">
                          {contact.full_name}
                        </p>
                        <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">
                          {contact.last_message !== undefined
                            ? lastMsgPreview(contact) || (
                                <span className="italic text-white/20">Start chatting</span>
                              )
                            : `@${contact.username}`}
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
            </div>
          </div>

          {/* ── CHAT WINDOW ─────────────────────────────────────────────── */}
          <div
            className={`
              flex-1 flex flex-col min-w-0
              ${mobileView === "list" ? "hidden sm:flex" : "flex"}
            `}
          >
            {selectedUser ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setMobileView("list")}
                    className="sm:hidden p-1.5 rounded-xl bg-white/5 text-white/60 hover:text-white border border-white/10"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <Avatar
                    url={selectedUser.avatar_url}
                    name={selectedUser.full_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate leading-tight">
                      {selectedUser.full_name}
                    </p>
                    <p className="text-[10px] text-white/40">
                      @{selectedUser.username}
                    </p>
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
                      <Avatar
                        url={selectedUser.avatar_url}
                        name={selectedUser.full_name}
                        size="lg"
                      />
                      <p className="text-sm font-black text-white/50">
                        {selectedUser.full_name}
                      </p>
                      <p className="text-xs text-white/25">
                        Say hello to start the conversation!
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === userId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
                          >
                            {msg.media_url && msg.media_type ? (
                              <div
                                className={`rounded-[1.5rem] overflow-hidden ${
                                  isMe ? "rounded-tr-sm" : "rounded-tl-sm"
                                }`}
                              >
                                <MediaBubble
                                  url={msg.media_url}
                                  type={msg.media_type}
                                />
                              </div>
                            ) : null}
                            {msg.content && (
                              <div
                                className={`px-4 py-2.5 text-sm font-semibold leading-relaxed ${
                                  isMe
                                    ? "bg-blue-600 text-white rounded-[1.5rem] rounded-tr-sm"
                                    : "bg-white/10 text-white border border-white/10 rounded-[1.5rem] rounded-tl-sm"
                                }`}
                              >
                                {msg.content}
                              </div>
                            )}
                            <span className="text-[9px] text-white/25 px-1">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="px-3 py-3 border-t border-white/10 bg-white/5 shrink-0 flex items-end gap-2">
                  {/* Media upload button */}
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
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 120) + "px";
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
              /* No user selected — desktop empty state */
              <div className="flex-col items-center justify-center h-full gap-4 text-center px-8 hidden sm:flex">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <MessageSquare size={28} className="text-white/20" />
                </div>
                <p className="text-base font-black text-white/30">
                  Select a conversation
                </p>
                <p className="text-xs text-white/20">
                  Pick someone from the left or search by name to start chatting.
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
