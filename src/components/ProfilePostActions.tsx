import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Flag, MoreVertical, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import PostActionMenuPortal, {
  type PostActionMenuPosition,
} from "./PostActionMenuPortal";

type Props = {
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  currentUserId: string;
  onEdited: (postId: string, content: string) => void;
  onDeleted: (postId: string) => void;
  onShare: (postId: string) => void | Promise<void>;
};

const REPORT_REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Hate speech",
  "Harassment",
  "Other",
];

export default function ProfilePostActions({
  postId,
  authorId,
  authorName,
  content,
  currentUserId,
  onEdited,
  onDeleted,
  onShare,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState<PostActionMenuPosition>({
    top: 12,
    right: 12,
  });
  const [dialog, setDialog] = useState<"edit" | "delete" | "report" | null>(null);
  const [editValue, setEditValue] = useState(content);
  const [busy, setBusy] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const isOwner = Boolean(currentUserId && authorId === currentUserId);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest("[data-fame-post-menu]") ||
        target.closest("[data-fame-post-menu-trigger]")
      ) {
        return;
      }
      setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsidePointerDown,
        true,
      );
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const toggleMenu = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!menuOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = Math.min(208, Math.max(160, window.innerWidth - 24));
      const right = Math.max(
        12,
        Math.min(
          Math.max(12, window.innerWidth - menuWidth - 12),
          window.innerWidth - rect.right,
        ),
      );
      const estimatedMenuHeight = isOwner ? 180 : 150;
      const top =
        rect.bottom + estimatedMenuHeight + 8 <= window.innerHeight
          ? rect.bottom + 8
          : Math.max(12, rect.top - estimatedMenuHeight - 8);
      setPosition({ top, right });
    }
    setMenuOpen((open) => !open);
  };

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.stopPropagation();
    if (!menuOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({
        top: Math.max(12, Math.min(window.innerHeight - 180, rect.bottom + 8)),
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setMenuOpen((open) => !open);
  };

  const runMenuAction = (event: ReactMouseEvent, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    action();
  };

  const saveEdit = async () => {
    const nextContent = editValue.trim();
    if (!currentUserId || !isOwner || !nextContent || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .update({ content: nextContent })
        .eq("id", postId)
        .eq("author_id", currentUserId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Post was not updated. Check your permissions.");
      onEdited(postId, nextContent);
      setDialog(null);
      toast.success("Post updated.");
    } catch (error) {
      console.error("[ProfilePostActions] edit failed:", error);
      toast.error(error instanceof Error ? error.message : "Post could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    if (!currentUserId || !isOwner || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", currentUserId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Post was not deleted. Check your permissions.");
      onDeleted(postId);
      setDialog(null);
      toast.success("Post deleted.");
    } catch (error) {
      console.error("[ProfilePostActions] delete failed:", error);
      toast.error(error instanceof Error ? error.message : "Post could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (reason: string) => {
    if (!currentUserId || isOwner || busy) {
      if (!currentUserId) toast.error("Please sign in to report this post.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        post_id: postId,
        target_id: authorId || null,
        type: "post",
        reason,
        status: "pending",
      });
      if (error) throw error;
      setDialog(null);
      setReportReason("");
      toast.success("Report submitted successfully.");
    } catch (error) {
      console.error("[ProfilePostActions] report failed:", error);
      toast.error("Report submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="relative z-[60] pointer-events-auto"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Post actions for ${authorName}'s post`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-fame-post-menu-trigger
          data-testid={`button-profile-post-actions-${postId}`}
          onPointerDown={toggleMenu}
          onKeyDown={handleTriggerKeyDown}
          className="relative z-[60] flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-lime-300 transition-colors hover:bg-lime-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60"
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      </div>

      <PostActionMenuPortal isOpen={menuOpen} position={position}>
        {isOwner ? (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={(event) =>
                runMenuAction(event, () => {
                  setEditValue(content);
                  setDialog("edit");
                })
              }
              className="pointer-events-auto flex w-full items-center gap-3 border-b border-white/10 px-4 py-3.5 text-left text-sm font-semibold text-blue-300 hover:bg-white/10 cursor-pointer"
            >
              <span aria-hidden="true">✏️</span> Edit Post
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(event) =>
                runMenuAction(event, () => setDialog("delete"))
              }
              className="pointer-events-auto flex w-full items-center gap-3 border-b border-white/10 px-4 py-3.5 text-left text-sm font-semibold text-red-400 hover:bg-white/10 cursor-pointer"
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            role="menuitem"
            onClick={(event) =>
              runMenuAction(event, () => {
                setReportReason("");
                setDialog("report");
              })
            }
            className="pointer-events-auto flex w-full items-center gap-3 border-b border-white/10 px-4 py-3.5 text-left text-sm font-semibold text-orange-400 hover:bg-white/10 cursor-pointer"
          >
            <Flag size={15} aria-hidden="true" /> Report
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={(event) =>
            runMenuAction(event, () => {
              void Promise.resolve(onShare(postId)).catch((error) => {
                console.error("[ProfilePostActions] share failed:", error);
                toast.error("The post could not be shared. Please try again.");
              });
            })
          }
          className="pointer-events-auto flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-white/80 hover:bg-white/10 cursor-pointer"
        >
          <Share2 size={15} aria-hidden="true" /> Share
        </button>
      </PostActionMenuPortal>

      {dialog &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            onClick={() => {
              if (!busy) setDialog(null);
            }}
          >
            <section
              role={dialog === "delete" ? "alertdialog" : "dialog"}
              aria-modal="true"
              aria-label={
                dialog === "edit"
                  ? "Edit post"
                  : dialog === "delete"
                    ? "Delete post"
                    : "Report post"
              }
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a0d1e] p-5 text-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {dialog === "edit" && (
                <>
                  <h2 className="text-base font-black">Edit post</h2>
                  <textarea
                    autoFocus
                    rows={4}
                    maxLength={5000}
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    aria-label="Post text"
                    className="mt-4 w-full resize-y rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-white outline-none focus:border-lime-300/60"
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDialog(null)}
                      disabled={busy}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={busy || !editValue.trim()}
                      className="flex-1 rounded-xl bg-lime-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )}
              {dialog === "delete" && (
                <>
                  <h2 className="text-base font-black">Delete this post?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    This will permanently remove your post from the timeline.
                  </p>
                  {content && (
                    <p className="mt-3 line-clamp-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/45">
                      {content}
                    </p>
                  )}
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDialog(null)}
                      disabled={busy}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePost()}
                      disabled={busy}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      {busy ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </>
              )}
              {dialog === "report" && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black">Report post</h2>
                    <button
                      type="button"
                      aria-label="Close report dialog"
                      onClick={() => setDialog(null)}
                      disabled={busy}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-sm text-white/70"
                    >
                      ×
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    Select a reason to submit your report.
                  </p>
                  <div className="mt-4 space-y-2">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        disabled={busy}
                      onClick={() => {
                        setReportReason(reason);
                        void submitReport(reason);
                      }}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        <span className="mr-2 text-orange-300">
                          {reportReason === reason ? "●" : "○"}
                        </span>
                        {reason}
                      </button>
                    ))}
                  </div>
                  {busy && (
                    <p className="mt-3 text-center text-xs text-white/50">
                      Submitting report…
                    </p>
                  )}
                </>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
