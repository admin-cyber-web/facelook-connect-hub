import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { memGet, memSet } from "@/lib/memCache";
import { toast } from "sonner";
import {
  X,
  Shield,
  Users,
  Flag,
  BarChart3,
  Loader2,
  Trash2,
  UserX,
  UserCheck,
  Search,
  Activity,
  TrendingUp,
  Calendar,
  User as UserIcon,
  BadgeCheck,
  Zap,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useProfileViewer } from "../context/ProfileViewerContext";
import { useOnlineUsers } from "../context/OnlineUsersContext";

export { ADMIN_EMAILS, isAdminEmail } from "../lib/adminConfig";
import { ADMIN_EMAILS } from "../lib/adminConfig";

interface Props {
  onClose: () => void;
  currentUserId: string;
  currentUserEmail: string;
}

type Tab = "stats" | "users" | "reports" | "suspended" | "studio";

interface UserRow {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  account_status: string | null;
  suspension_reason: string | null;
  last_seen: string | null;
  welcomed_at: string | null;
  is_verified: boolean | null;
}

const LIVE_WINDOW_MS = 10 * 60 * 1000; // "Active" = seen within last 10 minutes

interface ReportRow {
  id: string;
  post_id: string | null;
  target_id: string | null;
  reason: string;
  created_at: string;
  postContent: string;
  postAuthor: string;
  postAuthorId: string | null;
  reporterName: string;
  reporterId: string | null;
  targetName: string | null;
  targetUsername: string | null;
}

interface NameChangeRow {
  id: string;
  profile_id: string;
  creator_id: string | null;
  current_name: string;
  requested_name: string;
  reason: string;
  status: string;
  created_at: string;
  requesterName: string;
  requesterUsername: string;
}

const GRAD = (uid: string) => {
  const cols = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
  ];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) + h) ^ uid.charCodeAt(i);
  return cols[Math.abs(h) % cols.length];
};

const AdminDashboard: React.FC<Props> = ({
  onClose,
  currentUserId,
  currentUserEmail,
}) => {
  const { openProfile } = useProfileViewer();
  const onlineUserIds = useOnlineUsers();
  const [tab, setTab] = useState<Tab>("stats");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [studioRequests, setStudioRequests] = useState<NameChangeRow[]>([]);
  const [approvingNcId, setApprovingNcId] = useState<string | null>(null);
  const [rejectingNcId, setRejectingNcId] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [totalMemberCount, setTotalMemberCount] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    postId: string;
    reportId: string;
    preview: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [welcomingId, setWelcomingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [, setNowTick] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, []);

  useEffect(() => {
    const q = userSearch.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, created_at, account_status, suspension_reason, last_seen, welcomed_at, is_verified",
        )
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,id.eq.${q}`)
        .limit(30);
      setSearchResults((data as UserRow[]) || []);
      setSearchLoading(false);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [userSearch]);

  useEffect(() => {
    const ch = supabase
      .channel(`admin-dash-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.new?.id) {
            setUsers((prev) => [payload.new as UserRow, ...prev]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => fetchAll(true),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "profiles" },
        () => fetchAll(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => fetchAll(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => fetchAll(true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const fetchAll = async (force = false) => {
    const cKey = `adminDash_${currentUserId}`;
    if (!force) {
      const hit = memGet<{
        users: UserRow[];
        reports: ReportRow[];
        postCount: number;
      }>(cKey);
      if (hit) {
        setUsers(hit.users);
        setReports(hit.reports);
        setPostCount(hit.postCount);
        setLoading(false);
        return;
      }
    }

    const [usersRes, postsRes, reportsRes, countRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, created_at, account_status, suspension_reason, last_seen, welcomed_at, is_verified",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase
        .from("reports")
        .select(
          "id, post_id, target_id, reporter_id, reason, created_at, posts(id, content, author_id)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const userList = (usersRes.data as UserRow[]) || [];
    setUsers(userList);
    setPostCount(postsRes.count || 0);
    setTotalMemberCount(countRes.count || userList.length);

    const reportRows = (reportsRes.data as any[]) || [];

    const missingPostIds = reportRows
      .filter((r: any) => r.post_id && !r.posts)
      .map((r: any) => r.post_id);
    if (missingPostIds.length > 0) {
      const { data: fetchedPosts } = await supabase
        .from("posts")
        .select("id, content, author_id")
        .in("id", missingPostIds);
      const postMap = new Map((fetchedPosts || []).map((p: any) => [p.id, p]));
      for (const r of reportRows) {
        if (r.post_id && !r.posts && postMap.has(r.post_id))
          r.posts = postMap.get(r.post_id);
      }
    }
    const idsNeeded = new Set<string>();
    for (const r of reportRows) {
      if (r.reporter_id) idsNeeded.add(r.reporter_id);
      if (r.target_id) idsNeeded.add(r.target_id);
      if (r.posts?.author_id) idsNeeded.add(r.posts.author_id);
    }
    const profileMap = new Map<
      string,
      { full_name: string; username: string }
    >();
    for (const u of userList) {
      profileMap.set(u.id, {
        full_name: u.full_name || "Unknown",
        username: u.username || "",
      });
    }
    const missing = [...idsNeeded].filter((id) => !profileMap.has(id));
    if (missing.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", missing);
      for (const p of data || []) {
        profileMap.set(p.id, {
          full_name: p.full_name || "Unknown",
          username: p.username || "",
        });
      }
    }

    const rows: ReportRow[] = reportRows.map((r: any) => {
      const reporter = profileMap.get(r.reporter_id);
      const target = r.target_id ? profileMap.get(r.target_id) : null;
      const author = r.posts?.author_id
        ? profileMap.get(r.posts.author_id)
        : null;
      return {
        id: r.id,
        post_id: r.post_id || null,
        target_id: r.target_id || null,
        reason: r.reason,
        created_at: r.created_at,
        postContent: r.posts?.content ?? "",
        postAuthor: author?.full_name ?? "Unknown",
        postAuthorId: r.posts?.author_id ?? null,
        reporterName: reporter?.full_name ?? "Unknown",
        reporterId: r.reporter_id || null,
        targetName: target?.full_name ?? null,
        targetUsername: target?.username ?? null,
      };
    });
    setReports(rows);

    if (ADMIN_EMAILS.includes(currentUserEmail)) {
      const { data: ncData } = await supabase
        .from("name_change_requests")
        .select(
          "id, profile_id, current_name, requested_name, reason, status, created_at, profiles!name_change_requests_profile_id_fkey(full_name, username, creator_id)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (ncData) {
        const ncRows: NameChangeRow[] = (ncData as any[]).map((r) => ({
          id: r.id,
          profile_id: r.profile_id,
          creator_id: r.profiles?.creator_id ?? null,
          current_name: r.current_name ?? "",
          requested_name: r.requested_name,
          reason: r.reason ?? "",
          status: r.status,
          created_at: r.created_at,
          requesterName:
            r.profiles?.full_name ??
            profileMap.get(r.profile_id)?.full_name ??
            "Unknown",
          requesterUsername:
            r.profiles?.username ??
            profileMap.get(r.profile_id)?.username ??
            "",
        }));
        setStudioRequests(ncRows);
      }
    }

    memSet(cKey, {
      users: userList,
      reports: rows,
      postCount: postsRes.count || 0,
    });
    setLoading(false);
  };

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const last24hMs = now - 24 * 60 * 60 * 1000;

  const joinedLast24h = users.filter(
    (u) => u.created_at && new Date(u.created_at).getTime() >= last24hMs,
  );
  const joinedToday = users.filter(
    (u) =>
      u.created_at &&
      new Date(u.created_at).getTime() >= startOfToday.getTime(),
  );
  const joinedThisMonth = users.filter(
    (u) =>
      u.created_at &&
      new Date(u.created_at).getTime() >= startOfMonth.getTime(),
  );

  const sendWelcome = async (u: UserRow) => {
    setWelcomingId(u.id);
    const msg =
      "Welcome to Flicks India! 🇮🇳 Khul kar share karein apni kahani.";
    const { error } = await supabase.from("notifications").insert({
      notifier_id: u.id,
      actor_id: currentUserId,
      type: "welcome",
      entity_id: null,
      content: msg,
      is_read: false,
    });
    if (error) {
      toast.error("Could not send welcome");
    } else {
      await supabase
        .from("profiles")
        .update({ welcomed_at: new Date().toISOString() })
        .eq("id", u.id);
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, welcomed_at: new Date().toISOString() } : x,
        ),
      );
      toast.success(`Welcomed ${u.full_name || "user"} 🎉`);
    }
    setWelcomingId(null);
  };

  const suspendedUsers = users.filter((u) => u.account_status === "suspended");
  const activeUsers = users.filter((u) => u.account_status !== "suspended");
  const q = userSearch.trim().toLowerCase();

  const filteredActive =
    searchResults !== null
      ? searchResults
      : q
        ? users.filter(
            (u) =>
              (u.full_name || "").toLowerCase().includes(q) ||
              (u.username || "").toLowerCase().includes(q) ||
              u.id.toLowerCase().includes(q),
          )
        : activeUsers;

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspending(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        account_status: "suspended",
        suspension_reason: suspendReason.trim(),
      })
      .eq("id", suspendTarget);
    if (error) {
      toast.error("Could not suspend user");
    } else {
      toast.success("User suspended ✓");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === suspendTarget
            ? {
                ...u,
                account_status: "suspended",
                suspension_reason: suspendReason.trim(),
              }
            : u,
        ),
      );
      setSuspendTarget(null);
      setSuspendReason("");
    }
    setSuspending(false);
  };

  const handleUnsuspend = async (uid: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "active", suspension_reason: null })
      .eq("id", uid);
    if (error) {
      toast.error("Could not unblock user");
    } else {
      toast.success("User unblocked ✓");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === uid
            ? { ...u, account_status: "active", suspension_reason: null }
            : u,
        ),
      );
    }
  };

  const handleVerify = async (u: UserRow) => {
    setVerifyingId(u.id);
    const newVal = !u.is_verified;
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: newVal })
      .eq("id", u.id);
    if (error) {
      toast.error("Could not update verification");
    } else {
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, is_verified: newVal } : x)),
      );
      toast.success(
        newVal
          ? `✅ ${u.full_name} verified`
          : `Verification removed from ${u.full_name}`,
      );
    }
    setVerifyingId(null);
  };

  const dismissSafe = async (r: ReportRow) => {
    setDismissingId(r.id);
    await supabase.from("reports").delete().eq("id", r.id);
    const notifs = [];
    if (r.reporterId) {
      notifs.push({
        notifier_id: r.reporterId,
        actor_id: currentUserId,
        type: "report_resolved_safe",
        entity_id: r.post_id,
        content: "Review complete. Content follows community guidelines.",
        is_read: false,
      });
    }
    if (r.postAuthorId) {
      notifs.push({
        notifier_id: r.postAuthorId,
        actor_id: currentUserId,
        type: "report_resolved_safe",
        entity_id: r.post_id,
        content:
          "Your post is safe and doing great! It follows our community guidelines.",
        is_read: false,
      });
    }
    if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
    setReports((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Report dismissed as safe ✓ — both parties notified");
    setDismissingId(null);
  };

  const confirmDeletePost = async () => {
    if (!deleteTarget) return;
    const { postId, reportId } = deleteTarget;
    if (!postId) {
      toast.error("No post linked to this report");
      return;
    }
    setDeleting(true);
    const report = reports.find((r) => r.id === reportId);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      toast.error("Could not delete post");
      setDeleting(false);
      return;
    }
    await supabase.from("reports").delete().eq("id", reportId);
    const notifs = [];
    if (report?.reporterId) {
      notifs.push({
        notifier_id: report.reporterId,
        actor_id: currentUserId,
        type: "report_resolved_removed",
        entity_id: postId,
        content: "Your report was actioned. The content was removed.",
        is_read: false,
      });
    }
    if (report?.postAuthorId) {
      notifs.push({
        notifier_id: report.postAuthorId,
        actor_id: currentUserId,
        type: "report_post_removed",
        entity_id: postId,
        content: "Someone reported your post. After review, it was removed.",
        is_read: false,
      });
    }
    if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
    toast.success("Post removed ✓ — reporter & author notified");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleApproveNameChange = async (req: NameChangeRow) => {
    setApprovingNcId(req.id);
    try {
      await supabase
        .from("profiles")
        .update({ full_name: req.requested_name })
        .eq("id", req.profile_id);
      await supabase
        .from("name_change_requests")
        .update({ status: "approved" })
        .eq("id", req.id);
      setStudioRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(`✅ Name changed to "${req.requested_name}"`);
    } catch (e) {
      toast.error("Could not approve name change");
    } finally {
      setApprovingNcId(null);
    }
  };

  const handleRejectNameChange = async (req: NameChangeRow) => {
    setRejectingNcId(req.id);
    try {
      await supabase
        .from("name_change_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);
      setStudioRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success("Request rejected.");
    } catch (e) {
      toast.error("Could not reject request");
    } finally {
      setRejectingNcId(null);
    }
  };

  const isStudioAdmin = ADMIN_EMAILS.includes(currentUserEmail);

  const TABS: {
    key: Tab;
    icon: React.ReactNode;
    label: string;
    badge?: number;
  }[] = [
    { key: "stats", icon: <BarChart3 size={14} />, label: "Stats" },
    {
      key: "users",
      icon: <Users size={14} />,
      label: "Users",
      badge: activeUsers.length,
    },
    {
      key: "reports",
      icon: <Flag size={14} />,
      label: "Reports",
      badge: reports.length,
    },
    {
      key: "suspended",
      icon: <UserX size={14} />,
      label: "Banned",
      badge: suspendedUsers.length,
    },
    ...(isStudioAdmin
      ? [
          {
            key: "studio" as Tab,
            icon: <Zap size={14} />,
            label: "Studio ⚡",
            badge: studioRequests.length || undefined,
          },
        ]
      : []),
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
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
        >
          <Shield size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-none">
            Admin Dashboard
          </p>
          <p className="text-white/40 text-[10px] mt-0.5 truncate">
            {currentUserEmail}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/15 shrink-0"
        >
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/10 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition-all ${
              tab === t.key
                ? "bg-white/15 text-white border border-white/20"
                : "text-white/40"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {!!t.badge && (
              <span
                className={`rounded-full px-1 text-[9px] font-black ${tab === t.key ? "bg-white/25 text-white" : "bg-white/10 text-white/50"}`}
              >
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
                <div
                  className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-500/30"
                  style={{
                    background: "linear-gradient(135deg,#10b98122,#05966922)",
                  }}
                >
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: "#10b98133",
                        border: "1px solid #10b98166",
                      }}
                    >
                      <Activity size={20} style={{ color: "#10b981" }} />
                    </div>
                    {onlineUserIds.size > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-ping" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl font-black text-white leading-none">
                      {onlineUserIds.size}
                      <span className="text-xs text-emerald-300 font-bold ml-2 align-middle">
                        ● LIVE NOW
                      </span>
                    </p>
                    <p className="text-[11px] text-white/50 font-bold mt-1">
                      Online via Supabase Presence
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Last 24 Hours",
                      value: joinedLast24h.length,
                      color: "#f59e0b",
                      icon: <Activity size={18} />,
                    },
                    {
                      label: "Joined Today",
                      value: joinedToday.length,
                      color: "#06b6d4",
                      icon: <Calendar size={18} />,
                    },
                    {
                      label: "This Month",
                      value: joinedThisMonth.length,
                      color: "#a855f7",
                      icon: <TrendingUp size={18} />,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-3 rounded-2xl border border-white/10 bg-white/5"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
                        style={{
                          background: s.color + "22",
                          border: `1px solid ${s.color}44`,
                        }}
                      >
                        {React.cloneElement(s.icon as React.ReactElement, {
                          style: { color: s.color },
                        })}
                      </div>
                      <p className="text-2xl font-black text-white leading-none">
                        {s.value}
                      </p>
                      <p className="text-[10px] text-white/50 font-bold mt-1">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                {[
                  {
                    label: "Total Members",
                    value: totalMemberCount,
                    color: "#6366f1",
                    icon: <Users size={20} />,
                  },
                  {
                    label: "Total Posts",
                    value: postCount,
                    color: "#10b981",
                    icon: <BarChart3 size={20} />,
                  },
                  {
                    label: "Active Reports",
                    value: reports.length,
                    color: "#f59e0b",
                    icon: <Flag size={20} />,
                  },
                  {
                    label: "Suspended Users",
                    value: suspendedUsers.length,
                    color: "#ef4444",
                    icon: <UserX size={20} />,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: s.color + "22",
                        border: `1px solid ${s.color}44`,
                      }}
                    >
                      {React.cloneElement(s.icon as React.ReactElement, {
                        style: { color: s.color },
                      })}
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white">
                        {s.value}
                      </p>
                      <p className="text-xs text-white/50 font-bold">
                        {s.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── USERS ── */}
            {tab === "users" && (
              <div className="p-3 space-y-2">
                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                  />
                  <input
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      if (!e.target.value.trim()) setSearchResults(null);
                    }}
                    placeholder="Search by name, @username, or user ID…"
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-gray-800 text-gray-100 text-sm placeholder:text-gray-500 border border-white/10 outline-none focus:border-amber-400/50"
                  />
                  {searchLoading ? (
                    <Loader2
                      size={13}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 animate-spin"
                    />
                  ) : userSearch ? (
                    <button
                      onClick={() => {
                        setUserSearch("");
                        setSearchResults(null);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
                    >
                      <X size={12} className="text-white/60" />
                    </button>
                  ) : null}
                </div>

                {userSearch && searchResults !== null && (
                  <p className="text-white/30 text-[10px] font-bold mb-2 px-1">
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""} for "{userSearch}"
                  </p>
                )}

                {filteredActive.length === 0 && !searchLoading && (
                  <p className="text-white/30 text-sm text-center py-10">
                    {userSearch
                      ? `No users found for "${userSearch}"`
                      : "No active users"}
                  </p>
                )}

                {filteredActive.map((u) => {
                  const isBanned = u.account_status === "suspended";
                  const isSelf = u.id === currentUserId;
                  const isOtherAdmin = ADMIN_EMAILS.includes(u.id);
                  const joinDate = new Date(u.created_at).toLocaleDateString(
                    "en-IN",
                    { day: "2-digit", month: "short", year: "numeric" },
                  );
                  const isLive =
                    u.last_seen &&
                    now - new Date(u.last_seen).getTime() < LIVE_WINDOW_MS;
                  const alreadyWelcomed = !!u.welcomed_at;

                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-white/8 bg-white/4"
                    >
                      <button
                        onClick={() => openProfile(u.id)}
                        className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/15"
                        style={{ background: GRAD(u.id) }}
                      >
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            className="w-full h-full object-cover"
                            loading="lazy"
                           decoding="async"/>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">
                            {(u.full_name || "U")[0]}
                          </div>
                        )}
                        {isLive && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#050312]" />
                        )}
                      </button>

                      <button
                        onClick={() => openProfile(u.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-white text-sm font-bold truncate flex items-center gap-1.5">
                          {u.full_name || "Unknown"}
                          {isLive && (
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                              live
                            </span>
                          )}
                          {isBanned && (
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/25">
                              Banned
                            </span>
                          )}
                        </p>
                        <p className="text-white/40 text-[10px]">
                          @{u.username} · {joinDate}
                        </p>
                      </button>

                      <div className="flex flex-col gap-1 shrink-0">
                        {isSelf ? (
                          <span className="text-[10px] text-amber-400 font-black">
                            You
                          </span>
                        ) : isOtherAdmin ? (
                          <span className="text-[10px] text-yellow-400 font-black flex items-center gap-1">
                            <Shield size={10} /> Admin
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openProfile(u.id)}
                              className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            >
                              <UserIcon size={10} /> View Profile
                            </button>
                            <button
                              onClick={() => handleVerify(u)}
                              disabled={verifyingId === u.id}
                              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border disabled:opacity-50 ${u.is_verified ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-white/5 text-white/50 border-white/15"}`}
                            >
                              {verifyingId === u.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <>
                                  <BadgeCheck size={10} />{" "}
                                  {u.is_verified ? "Verified" : "Verify"}
                                </>
                              )}
                            </button>
                            {!alreadyWelcomed ? (
                              <button
                                onClick={() => sendWelcome(u)}
                                disabled={welcomingId === u.id}
                                className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 disabled:opacity-50"
                              >
                                {welcomingId === u.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  "Welcome 🎉"
                                )}
                              </button>
                            ) : (
                              <span className="text-center text-[9px] text-white/30 font-medium py-0.5">
                                Welcomed ✓
                              </span>
                            )}
                            <button
                              onClick={() => setSuspendTarget(u.id)}
                              className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-500/15 text-red-300 border border-red-500/30"
                            >
                              <UserX size={10} /> Ban User
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── REPORTS ── */}
            {tab === "reports" && (
              <div className="p-3 space-y-3">
                {reports.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">
                    No active reports
                  </p>
                )}
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-white font-bold text-xs">
                          Reporter:{" "}
                          <span className="text-amber-400">
                            {r.reporterName}
                          </span>
                        </p>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          Reason:{" "}
                          <span className="text-red-300 font-medium">
                            {r.reason}
                          </span>
                        </p>
                      </div>
                      <span className="text-[9px] text-white/30 font-mono">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {r.post_id ? (
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-wider">
                          Reported Post (Author: {r.postAuthor})
                        </p>
                        <p className="text-white/80 text-xs italic">
                          "
                          {r.postContent ||
                            "[Image/Media content without text]"}
                          "
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[11px] flex items-center gap-1.5">
                        <AlertTriangle size={12} /> Target User Profile:{" "}
                        <span className="underline font-bold">
                          @{r.targetUsername || r.target_id}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => dismissSafe(r)}
                        disabled={dismissingId === r.id}
                        className="flex-1 py-2 rounded-xl text-[11px] font-black border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center gap-1"
                      >
                        {dismissingId === r.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <Check size={12} /> Mark Safe
                          </>
                        )}
                      </button>
                      {r.post_id && (
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              postId: r.post_id!,
                              reportId: r.id,
                              preview: r.postContent,
                            })
                          }
                          className="flex-1 py-2 rounded-xl text-[11px] font-black border border-red-500/30 bg-red-500/10 text-red-400 flex items-center justify-center gap-1"
                        >
                          <Trash2 size={12} /> Delete Post
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── BANNED/SUSPENDED ── */}
            {tab === "suspended" && (
              <div className="p-3 space-y-2">
                {suspendedUsers.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">
                    No users currently banned
                  </p>
                )}
                {suspendedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-red-500/20 bg-red-500/5"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold truncate">
                        {u.full_name || "Unknown"}
                      </p>
                      <p className="text-white/40 text-[10px]">@{u.username}</p>
                      {u.suspension_reason && (
                        <p className="text-[11px] text-red-300/80 mt-1 italic truncate">
                          Reason: {u.suspension_reason}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnsuspend(u.id)}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black bg-white/10 text-white border border-white/15 hover:bg-white/20 transition-all flex items-center gap-1"
                    >
                      <UserCheck size={11} /> Unban
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── STUDIO QUEUE (Name Changes) ── */}
            {tab === "studio" && isStudioAdmin && (
              <div className="p-3 space-y-3">
                {studioRequests.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-10">
                    No pending name changes
                  </p>
                )}
                {studioRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-3"
                  >
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/40">
                        @{req.requesterUsername || "user"}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="text-red-400 line-through">
                          {req.current_name}
                        </span>
                        <span>➔</span>
                        <span className="text-emerald-400 text-sm font-black">
                          {req.requested_name}
                        </span>
                      </div>
                      {req.reason && (
                        <p className="text-[11px] text-white/60 bg-black/20 p-2 rounded-lg mt-1 italic">
                          "{req.reason}"
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveNameChange(req)}
                        disabled={approvingNcId === req.id}
                        className="flex-1 py-1.5 rounded-xl text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1"
                      >
                        {approvingNcId === req.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          "Approve ✓"
                        )}
                      </button>
                      <button
                        onClick={() => handleRejectNameChange(req)}
                        disabled={rejectingNcId === req.id}
                        className="flex-1 py-1.5 rounded-xl text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/40 flex items-center justify-center gap-1"
                      >
                        {rejectingNcId === req.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          "Reject X"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL OVERLAYS ── */}
      <AnimatePresence>
        {/* Suspension Reason Overlay */}
        {suspendTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-gray-900 p-4 space-y-4"
            >
              <div>
                <p className="text-white font-black text-sm">
                  Reason for Suspension
                </p>
                <p className="text-[11px] text-white/40">
                  Provide community violation guidelines details
                </p>
              </div>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g., Toxic behavior, spamming, continuous misinformation posts..."
                className="w-full h-24 p-2.5 rounded-xl bg-black/40 text-white text-xs border border-white/10 outline-none resize-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSuspendTarget(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={suspending || !suspendReason.trim()}
                  className="flex-1 py-2 rounded-xl text-xs font-black bg-red-500 text-white flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  {suspending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    "Confirm Ban"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Post Confirmation Overlay */}
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-gray-900 p-4 space-y-4"
            >
              <div>
                <p className="text-white font-black text-sm text-red-400">
                  Confirm Post Deletion
                </p>
                <p className="text-[11px] text-white/40">
                  This will permanently remove the content and notify both user
                  parties.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-white/60 italic">
                "{deleteTarget.preview || "No content string preview available"}
                "
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePost}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-xl text-xs font-black bg-red-600 text-white flex items-center justify-center gap-1"
                >
                  {deleting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    "Delete Permanently"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminDashboard;
