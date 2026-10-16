import { useState, type MouseEvent } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useSavedPosts } from "@/context/SavedPostsContext";

export default function SavePostButton({
  postId,
  onToggled,
  className = "",
}: {
  postId: string;
  onToggled?: (saved: boolean) => void;
  className?: string;
}) {
  const { isSaved, isPending, toggleSaved } = useSavedPosts();
  const saved = isSaved(postId);
  const pending = isPending(postId);
  const [localPending, setLocalPending] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (pending || localPending) return;
    setLocalPending(true);
    try {
      const nextSaved = await toggleSaved(postId);
      onToggled?.(nextSaved);
      toast.success(nextSaved ? "Post saved." : "Post removed from saved items.");
    } catch (saveError) {
      console.error("[SavePostButton] save failed:", saveError);
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "The post could not be saved. Please try again.",
      );
    } finally {
      setLocalPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      disabled={pending || localPending}
      aria-label={saved ? "Remove post from saved items" : "Save post"}
      aria-pressed={saved}
      aria-busy={pending || localPending}
      title={saved ? "Remove from Saved Items" : "Save post"}
      data-testid={`button-save-post-${postId}`}
      className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full transition-all hover:bg-white/10 active:scale-90 disabled:cursor-wait disabled:opacity-60 ${
        saved ? "text-lime-300" : "text-white/65"
      } ${className}`}
    >
      <Bookmark
        size={17}
        strokeWidth={2.2}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span className="sr-only">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
