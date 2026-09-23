import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { ChevronLeft, Loader2, TrendingUp, Send, Inbox, ExternalLink } from "lucide-react";
import { formatReach, AvatarPill } from "./MagnetSystem";

interface DashboardEntry {
  id: string;
  post_id: string;
  post_type: string;
  depth: number;
  created_at: string;
  is_killed: boolean;
  // for "sent": user we invited
  target?: { full_name: string; avatar_url: string | null };
  // for "received": user who invited us
  inviter?: { full_name: string; avatar_url: string | null };
  // post info
  post_content?: string;
  post_author?: string;
}

interface MagnetDashboardProps {
  userId: string;             // whose dashboard to show
  viewerUserId: string | null;// current logged-in user
  userName?: string;
  onBack: () => void;
}

export default function MagnetDashboard({ userId, viewerUserId, userName, onBack }: MagnetDashboardProps) {
  const [tab, setTab]           = useState<"sent" | "received">("sent");
  const [sent, setSent]         = useState<DashboardEntry[]>([]);
  const [received, setReceived] = useState<DashboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [totalSent, setTotalSent]         = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [maxDepth, setMaxDepth]           = useState(0);

  const isOwnDashboard = viewerUserId === userId;

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    setLoading(true);

    // SENT: from magnet_invites where sender_id = userId (I invited others)
    let sentRaw: any[] = [];
    let sentCount      = 0;
    const sentRes = await supabase
      .from("magnet_invites")
      .select("id, post_id, created_at, target:profiles!receiver_id(full_name, avatar_url)", { count: "exact" })
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (sentRes.error) {
      // Fallback: magnet_chains invited_by column
      const fb = await supabase
        .from("magnet_chains")
        .select("id, post_id, post_type, depth, created_at, is_killed, target:profiles!magnet_chains_user_id_fkey(full_name, avatar_url)", { count: "exact" })
        .eq("invited_by", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      sentRaw   = fb.data   ?? [];
      sentCount = fb.count  ?? 0;
    } else {
      sentRaw   = sentRes.data  ?? [];
      sentCount = sentRes.count ?? 0;
    }

    // RECEIVED: magnet_chains where user_id = userId (I joined — any method)
    const { data: receivedRaw, count: receivedCount } = await supabase
      .from("magnet_chains")
      .select(`
        id, post_id, post_type, depth, created_at, is_killed,
        inviter:profiles!magnet_chains_invited_by_fkey(full_name, avatar_url)
      `, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Compute max depth from all entries
    const allDepths = [...sentRaw, ...(receivedRaw || [])].map(e => e.depth ?? 0);
    setMaxDepth(allDepths.length ? Math.max(...allDepths) : 0);

    // Enrich with post content
    const postIds = [...new Set([
      ...sentRaw.map(e => e.post_id),
      ...(receivedRaw || []).map(e => e.post_id),
    ])];

    let postMap: Record<string, { content: string; author: string }> = {};
    if (postIds.length) {
      const { data: posts } = await supabase
        .from("posts").select("id,content,author").in("id", postIds);
      (posts || []).forEach(p => { postMap[p.id] = { content: p.content, author: p.author }; });
    }

    const enrich = (rows: any[]): DashboardEntry[] =>
      (rows || []).map(r => ({
        ...r,
        post_content: postMap[r.post_id]?.content,
        post_author:  postMap[r.post_id]?.author,
      }));

    setSent(enrich(sentRaw));
    setReceived(enrich(receivedRaw || []));
    setTotalSent(sentCount);
    setTotalReceived(receivedCount ?? 0);
    setLoading(false);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const EntryCard = ({ entry, type }: { entry: DashboardEntry; type: "sent" | "received" }) => {
    const person = type === "sent" ? entry.target : entry.inviter;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-3 p-4 rounded-2xl border mb-2 ${
          entry.is_killed ? "bg-red-50 border-red-100 opacity-60" : "bg-white border-gray-100"
        }`}
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* Avatar */}
        <AvatarPill url={person?.avatar_url} name={person?.full_name} size={38} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-bold text-sm leading-tight truncate">
            {person?.full_name || "Someone"}
          </p>
          <p className="text-gray-400 text-[10px] font-semibold mt-0.5">
            {type === "sent" ? "Linked to this person" : "Linked to you"}
            {" · "}Depth {entry.depth}
          </p>
          {entry.post_content && (
            <p className="text-gray-500 text-[11px] mt-1 line-clamp-1 italic">
              "{entry.post_content.slice(0, 60)}{entry.post_content.length > 60 ? "…" : ""}"
            </p>
          )}
          {entry.post_author && (
            <p className="text-gray-400 text-[10px] mt-0.5">by @{entry.post_author}</p>
          )}
        </div>

        {/* Time + depth badge */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-gray-400">{timeAgo(entry.created_at)}</p>
          <div className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black"
            style={{
              background: entry.is_killed ? "#fee2e2" : "rgba(139,92,246,0.1)",
              color: entry.is_killed ? "#dc2626" : "#7c3aed",
            }}>
            {entry.is_killed ? "Killed" : `Lv${entry.depth}`}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(var(--cap-safe-top) + 12px)", background: "linear-gradient(135deg,#7c3aed,#db2777)", boxShadow: "0 2px 16px rgba(124,58,237,0.3)" }}>
        <button onClick={onBack}
          className="p-2 bg-white/20 rounded-xl text-white hover:bg-white/30 transition-all">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-black text-base leading-none">🔗 Link Hub</h1>
          <p className="text-white/70 text-[10px] mt-0.5">
            {isOwnDashboard ? "Your viral link activity" : `${userName || "User"}'s public links`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
          <TrendingUp size={12} className="text-white" />
          <span className="text-white text-[11px] font-black">Viral Chain Engine</span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-2">
        {[
          { label: "Links Sent",     value: formatReach(totalSent),     icon: "📤", color: "#7c3aed" },
          { label: "Links Received", value: formatReach(totalReceived), icon: "📥", color: "#db2777" },
          { label: "Max Depth",      value: maxDepth > 0 ? `Lv ${maxDepth}` : "—", icon: "🔗", color: "#059669" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-gray-100"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <p className="text-2xl mb-0.5">{s.icon}</p>
            <p className="font-black text-lg leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-gray-400 text-[9px] font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Toggle */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex bg-white rounded-xl p-1 border border-gray-100">
          <button onClick={() => setTab("sent")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[12px] font-black transition-all ${
              tab === "sent" ? "text-purple-700 shadow-sm" : "text-gray-400"
            }`}
            style={{ background: tab === "sent" ? "linear-gradient(90deg,rgba(139,92,246,0.1),rgba(219,39,119,0.1))" : "transparent" }}>
            <Send size={12} /> Sent ({totalSent})
          </button>
          <button onClick={() => setTab("received")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[12px] font-black transition-all ${
              tab === "received" ? "text-pink-700 shadow-sm" : "text-gray-400"
            }`}
            style={{ background: tab === "received" ? "linear-gradient(90deg,rgba(219,39,119,0.1),rgba(139,92,246,0.1))" : "transparent" }}>
            <Inbox size={12} /> Received ({totalReceived})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-purple-400" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === "sent" ? (
              <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {sent.length === 0 ? (
                  <div className="flex flex-col items-center py-20 text-gray-400">
                    <span className="text-4xl mb-3">🔗</span>
                    <p className="font-black text-sm">No links sent yet</p>
                    <p className="text-xs mt-1">Open any post and click 🔗 to start a viral chain!</p>
                  </div>
                ) : (
                  sent.map(e => <EntryCard key={e.id} entry={e} type="sent" />)
                )}
              </motion.div>
            ) : (
              <motion.div key="received" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {received.length === 0 ? (
                  <div className="flex flex-col items-center py-20 text-gray-400">
                    <span className="text-4xl mb-3">📥</span>
                    <p className="font-black text-sm">No links received yet</p>
                    <p className="text-xs mt-1">When someone links a post to you, it appears here</p>
                  </div>
                ) : (
                  received.map(e => <EntryCard key={e.id} entry={e} type="received" />)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
