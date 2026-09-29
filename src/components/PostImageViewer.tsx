import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface PostImageViewerProps {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const PostImageViewer = ({
  urls,
  index,
  onIndexChange,
  onClose,
}: PostImageViewerProps) => {
  const touchStartX = useRef<number | null>(null);
  const safeIndex = Math.min(Math.max(index, 0), Math.max(urls.length - 1, 0));

  const showPrevious = () => {
    onIndexChange((safeIndex - 1 + urls.length) % urls.length);
  };

  const showNext = () => {
    onIndexChange((safeIndex + 1) % urls.length);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && urls.length > 1) showPrevious();
      if (event.key === "ArrowRight" && urls.length > 1) showNext();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  if (!urls.length) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/95 p-3 text-white backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${safeIndex + 1} of ${urls.length}`}
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (startX == null || endX == null || urls.length < 2) return;
        const distance = endX - startX;
        if (Math.abs(distance) < 42) return;
        if (distance > 0) showPrevious();
        else showNext();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90 sm:right-6 sm:top-6"
      >
        <X size={22} />
      </button>

      <div
        className="relative flex h-full w-full max-w-6xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          key={urls[safeIndex]}
          src={urls[safeIndex]}
          alt={`Post image ${safeIndex + 1} of ${urls.length}`}
          className="max-h-[82dvh] max-w-full select-none object-contain"
          draggable={false}
        />

        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Previous image"
              className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90 sm:left-3"
            >
              <ChevronLeft size={25} />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Next image"
              className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90 sm:right-3"
            >
              <ChevronRight size={25} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
              {safeIndex + 1} / {urls.length}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PostImageViewer;