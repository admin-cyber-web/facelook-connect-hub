import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { bunnyStickerUrl, type StickerPackCategory } from "../lib/bunny";
import { fetchStickerImage, preloadCategory } from "../lib/stickerCache";

type StickerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onStickerSelect: (stickerUrl: string) => void;
};

const STICKER_CATEGORIES: StickerPackCategory[] = ["Love", "Sad", "emotional", "Angry"];

const STICKER_FILES: Record<StickerPackCategory, string[]> = {
  Love: ["love-1.png", "love-2.png", "love-3.png", "heart.png", "kiss.png", "cute.png"],
  Sad: ["sad-1.png", "sad-2.png", "tears.png", "broken-heart.png", "lonely.png"],
  emotional: ["emotional-1.png", "emotional-2.png", "touching.png", "miss-you.png"],
  Angry: ["angry-1.png", "angry-2.png", "mad.png", "grr.png"],
};

export const StickerDrawer: React.FC<StickerDrawerProps> = ({
  isOpen,
  onClose,
  onStickerSelect,
}) => {
  const [activeCategory, setActiveCategory] = useState<StickerPackCategory>("Love");
  const [loadingStickers, setLoadingStickers] = useState<Set<string>>(new Set());
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const files = STICKER_FILES[activeCategory] || STICKER_FILES.Love;

  useEffect(() => {
    if (!isOpen) return;
    try {
      void preloadCategory(activeCategory, files);
    } catch (err) {
      console.warn("[StickerDrawer] preloadCategory failed:", err);
    }
  }, [isOpen, activeCategory, files]);

  useEffect(() => {
    let isMounted = true;
    const resolveAll = async () => {
      try {
        const next: Record<string, string> = {};
        await Promise.all(
          files.map(async (file) => {
            try {
              const url = bunnyStickerUrl(activeCategory, file);
              const res = await fetchStickerImage(url);
              if (isMounted) {
                next[file] = res || url;
              }
            } catch (e) {
              if (isMounted) {
                next[file] = bunnyStickerUrl(activeCategory, file);
              }
            }
          })
        );
        if (isMounted) setResolvedUrls(next);
      } catch (err) {
        console.warn("[StickerDrawer] resolveAll error:", err);
      }
    };
    resolveAll();
    return () => {
      isMounted = false;
    };
  }, [activeCategory, files]);

  const isLoading = (file: string) => loadingStickers.has(file);

  const handleStickerPress = (file: string) => {
    try {
      setLoadingStickers((prev) => new Set([...prev, file]));
      const url = resolvedUrls[file] || bunnyStickerUrl(activeCategory, file);
      onStickerSelect(url);
      onClose();
    } catch (err) {
      console.error("[StickerDrawer] handleStickerPress error:", err);
    } finally {
      setLoadingStickers((prev) => {
        const next = new Set(prev);
        next.delete(file);
        return next;
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
            className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-200 rounded-t-[30px] shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />

            <div className="px-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-black font-black text-lg">Stickers</h3>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={18} strokeWidth={2} stroke="currentColor" />
                </button>
              </div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-4">
                Tap a sticker to send
              </p>

              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-2">
                {STICKER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeCategory === cat ? "bg-black text-white border border-black" : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-900"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-2">
                {files.map((file) => {
                  const isLoadingImg = isLoading(file);
                  const hasFailed = failedImages.has(file);
                  const imageSrc = resolvedUrls[file] || bunnyStickerUrl(activeCategory, file);
                  return (
                    <motion.button
                      key={file}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => handleStickerPress(file)}
                      className="aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center transition-all duration-200"
                    >
                      {isLoadingImg ? (
                        <Loader2 size={16} className="text-gray-400 animate-spin" />
                      ) : hasFailed ? (
                        <span className="text-2xl select-none" role="img" aria-label="sticker fallback">🎨</span>
                      ) : (
                        <img
                          src={imageSrc}
                          alt={file}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setFailedImages((prev) => new Set(prev).add(file));
                          }}
                          decoding="async"
                          loading="lazy"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StickerDrawer;
