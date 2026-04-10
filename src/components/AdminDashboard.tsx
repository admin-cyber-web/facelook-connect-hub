import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  X, Shield, Users, Flag, BarChart3,
  Loader2, Trash2, UserX, UserCheck,
} from "lucide-react";

export const ADMIN_EMAILS = ["tiwarijhumki@gmail.com", "textilevikhyat@gmail.com"];
export const isAdminEmail = (email: string) => ADMIN_EMAILS.includes(email.toLowerCase());

interface Props {
  onClose: () => void;
  currentUserId: string;
  currentUserEmail: string;
}

type Tab = "stats" | "users" | "reports" | "suspended";

interface UserRow {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  account_status: string | null;
  suspension_reason: string | null;
}

interface ReportRow {
  id: string;
  post_id: string;
  reason: string;
  created_at: string;
  postContent: string;
  postAuthor: string;
  reporterName: string;
}

const GRAD = (uid: string) => {
  const cols = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6"];
  let h = 0; for (let i = 0; i < uid.length; i++) h = ((h << 5) + h) ^ uid.charCodeAt(i);
  return cols[Math.abs(h) % cols.length];
};

const AdminDashboard: React.FC<Props> = ({ onClose, currentUserId, currentUserEmail }) => {
  const [tab, setTab] = useState<Tab>("stats");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [usersRes, postsRes, reportsRes] = await Promise.all([
      supabase.from("profiles")
        .select("id, full_name, username, avatar_url, created_at, account_status, suspension_reason")
        .order("created_at", { ascending: false }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("reports")
        .select("id, post_id, reason, created_at, posts(id, content, profiles!author_id(full_name)), profiles!reporter_id(full_name)")
        .order("created_at", { ascending: false }),
    ]);

    setUsers((usersRes.data as UserRow[]) || []);
    setPostCount(postsRes.count || 0);

    const rows: ReportRow[] = ((reportsRes.data as any[]) || []).map((r: any) => ({
      id: r.id,
      post_id: r.post_id,
      reason: r.reason,
      created_at: r.created_at,
      postContent: r.posts?.content ?? "",
      postAuthor: r.posts?.profiles?.full_name ?? "Unknown",
      reporterName: r.profiles?.full_name ?? "Unknown",
    }));
    setReports(rows);
    setLoading(false);
  };

  const suspendedUsers = users.filter(u => u.account_status === "suspended");
  const activeUsers    = users.filter(u => u.account_status !== "suspended");

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspending(true);
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "suspended", suspension_reason: suspendReason.trim() })
      .eq("id", suspendTarget);
    if (error) { toast.error("Could not suspend user"); }
    else {
      toast.success("User suspended ✓");
      setUsers(prev => prev.map(u =>
        u.id === suspendTarget
          ? { ...u, account_status: "suspended", suspension_reason: suspendReason.trim() }
          : u
      ));
      setSuspendTarget(null);
      setSuspendReason("");
    }
    setSuspending(false);
  };

  const handleUnsuspend = async (uid: string) => {
    const { error } = await supabase.from("profiles")
      .update({ account_status: "active", suspension_reason: null })
      .eq("id", uid);
    if (error) { toast.error("Could not unblock user"); }
    else {
      toast.success("User unblocked ✓");
      setUsers(prev => prev.map(u =>
        u.id === uid ? { ...u, account_status: "active", suspension_reason: null } : u
      ));
    }
  };

  const handleDeletePost = async (postId: string, reportId: string) => {
    if (!postId) { toast.error("No post linked to this report"); return; }
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) { toast.error("Could not delete post"); return; }
    await supabase.from("reports").delete().eq("id", reportId);
    toast.success("Post deleted globally ✓");
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const TABS: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: "stats",     icon: <BarChart3 size={14} />, label: "Stats" },
    { key: "users",     icon: <Users size={14} />,     label: "Users",   badge: activeUsers.length },
    { key: "reports",   icon: <Flag size={14} />,      label: "Reports", badge: reports.length },
    { key: "suspended", icon: <UserX size={14} />,     label: "Banned",  badge: suspendedUsers.length },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-0 z-[500] flex flex-col"
      style={{ background: "rgba(5,3,18,0.98)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}>
          <Shield size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">Admin Dashboard</p>
          <p className="text-white/40 text-[10px] mt-0.5 truncate">{currentUserEmail}</p>
        </div>
        <button onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/15 shrink-0">
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/10 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition-all ${
              tab === t.key ? "bg-white/15 text-white border border-white/20" : "text-white/40"
            }`}>
            {t.icon}
            <span>{t.label}</span>
            {!!t.badge && (
              <span className={`rounded-full px-1 text-[9px] font-black ${tab === t.key ? "bg-white/25 text-white" : "bg-white/10 text-white/50"}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-white/30" />
          </div>
        ) : (
          <>
            {/* ── STATS ── */}
            {tab === "stats" && (
              <div className="p-4 space-y-3">
                {[
                  { label: "Total Users",      value: users.length,          color: "#6366f1", icon: <Users size={20} /> },
                  { label: "Total Posts",       value: postCount,             color: "#10b981", icon: <BarChart3 size={20} /> },
                  { label: "Active Reports",    value: reports.length,        color: "#f59e0b", icon: <Flag size={20} /> },
                  { label: "Suspended Users",   value: suspendedUsers.length, color: "#ef4444", icon: <UserX size={20} /> },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: s.color + "22", border: `1px solid ${s.color}44` }}>
                      {React.cloneElement(s.icon as React.ReactElement, { style: { color: s.color } })}
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white">{s.value}</p>
                      <p className="text-xs text-white/50 font-bold">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── USERS ── */}
            {tab === "users" && (
              <div className="p-3 space-y-2">
                {activeUsers.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">No active users</p>
                )}
                {activeUsers.map(u => {
                  const isSelf = u.id === currentUserId;
                  const isOtherAdmin = ADMIN_EMAILS.includes(u.id);
                  const joinDate = new Date(u.created_at).toLocaleDateString("en-IN",
                    { day: "2-digit", month: "short", year: "numeric" });
                  return (
                    <div key={u.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-white/8 bg-white/4">
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/15"
                        style={{ background: GRAD(u.id) }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                              {(u.full_name || "U")[0]}
                            </div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">{u.full_name || "Unknown"}</p>
                        <p className="text-white/40 text-[10px]">@{u.username} · {joinDate}</p>
                      </div>
                      {isSelf ? (
                        <span className="text-[10px] text-amber-400 font-black shrink-0">You</span>
                      ) : isOtherAdmin ? (
                        <span className="text-[10px] text-yellow-400 font-black shrink-0 flex items-center gap-1">
                          <Shield size={10} /> Admin
                        </span>
                      ) : (
                        <button
                          onClick={() => { setSuspendTarget(u.id); setSuspendReason(""); }}
                          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-red-500/15 text-red-400 border border-red-500/25">
                          <UserX size={11} /> Suspend
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── REPORTS ── */}
            {tab === "reports" && (
              <div className="p-3 space-y-3">
                {reports.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">No reports yet 🎉</p>
                )}
                {reports.map(r => (
                  <div key={r.id}
                    className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                    <p className="text-amber-300 text-[10px] font-black uppercase tracking-widest mb-1">
                      🚩 {r.reason}
                    </p>
                    <p className="text-white text-sm leading-snug line-clamp-3 mb-3">
                      {r.postContent || <span className="text-white/30 italic">Post content unavailable</span>}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/50 text-[10px]">
                          By <span className="text-white/70 font-bold">{r.postAuthor}</span>
                        </p>
                        <p className="text-white/30 text-[10px]">
                          Reported by {r.reporterName}
                        </p>
                      </div>
                      <button onClick={() => handleDeletePost(r.post_id, r.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-red-600/20 text-red-400 border border-red-500/30">
                        <Trash2 size={11} /> Delete Post
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── SUSPENDED ── */}
            {tab === "suspended" && (
              <div className="p-3 space-y-2">
                {suspendedUsers.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">No suspended users</p>
                )}
                {suspendedUsers.map(u => {
                  const joinDate = new Date(u.created_at).toLocaleDateString("en-IN",
                    { day: "2-digit", month: "short", year: "numeric" });
                  return (
                    <div key={u.id}
                      className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-red-400/30"
                          style={{ background: "linear-gradient(135deg,#ef4444,#7f1d1d)" }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                                {(u.full_name || "U")[0]}
                              </div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold truncate">{u.full_name || "Unknown"}</p>
                          <p className="text-white/40 text-[10px]">@{u.username} · {joinDate}</p>
                        </div>
                        <button onClick={() => handleUnsuspend(u.id)}
                          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-green-600/20 text-green-400 border border-green-500/30">
                          <UserCheck size={11} /> Unblock
                        </button>
                      </div>
                      {u.suspension_reason && (
                        <div className="bg-black/30 rounded-xl px-3 py-2">
                          <p className="text-red-300/80 text-xs">
                            <span className="font-black">Reason: </span>{u.suspension_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Suspend confirm sheet */}
      <AnimatePresence>
        {suspendTarget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[510] bg-black/70 backdrop-blur-sm"
              onClick={() => setSuspendTarget(null)} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed bottom-0 left-0 right-0 z-[520] rounded-t-3xl p-5 border-t border-white/10"
              style={{ background: "rgba(12,4,28,0.98)" }}
            >
              <p className="text-white font-black text-base mb-1">Suspend User</p>
              <p className="text-white/50 text-xs mb-4">
                This reason will be shown to the user when they try to access the app.
              </p>
              <textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="Enter suspension reason…"
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm text-white bg-white/10 border border-white/15 outline-none font-medium resize-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setSuspendTarget(null)}
                  className="flex-1 py-3 rounded-2xl text-white/60 bg-white/5 border border-white/10 font-bold text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={!suspendReason.trim() || suspending}
                  className="flex-1 py-3 rounded-2xl text-white font-black text-sm disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                  {suspending ? "Suspending…" : "Confirm Suspend"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminDashboard;
