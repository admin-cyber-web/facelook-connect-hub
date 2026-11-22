import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { StickerPackCategory } from "../lib/bunny";
import { preloadCategory } from "../lib/stickerCache";
import {
  STICKER_PACK_CATEGORIES,
  STICKER_PACK_FILES,
  stickerCandidateUrl,
  type StickerPackFile,
} from "../lib/stickerPacks";
import { useToast } from "../hooks/use-toast";

type StickerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onStickerSelect: (stickerUrl: string) => void;
};

/** Per-sticker probe state: which candidate filename we are on, and whether all failed. */
type StickerProbe = Record<string, { index: number; failed: boolean }>;

const probeKey = (category: StickerPackCategory, file: StickerPackFile) => `${category}:${file.id}`;

export const StickerDrawer: React.FC<StickerDrawerProps> = ({
  isOpen,
  onClose,
  onStickerSelect,
}) => {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<StickerPackCategory>("Love");
  const [probe, setProbe] = useState<StickerProbe>({});

  const files = STICKER_PACK_FILES[activeCategory] || STICKER_PACK_FILES.Love;

  // Reset probe state when drawer opens or category switches
  useEffect(() => {
    if (isOpen) {
      setProbe({});
    }
  }, [isOpen, activeCategory]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const firstCandidates = files.map((file) => file.candidates[0]).filter(Boolean);
      void preloadCategory(activeCategory, firstCandidates);
    } catch (err) {
      console.warn("[StickerDrawer] preloadCategory failed:", err);
    }
  }, [isOpen, activeCategory, files]);

  const visibleFiles = useMemo(
    () => files.filter((file) => !probe[probeKey(activeCategory, file)]?.failed),
    [files, probe, activeCategory]
  );

  const srcFor = (file: StickerPackFile) => {
    const key = probeKey(activeCategory, file);
    const index = probe[key]?.index ?? 0;
    return stickerCandidateUrl(activeCategory, file, index);
  };

  const handleImageError = (file: StickerPackFile) => {
    const key = probeKey(activeCategory, file);
    setProbe((prev) => {
      const index = (prev[key]?.index ?? 0) + 1;
      return { ...prev, [key]: { index, failed: index >= file.candidates.length } };
    });
  };

  const handleStickerPress = (file: StickerPackFile) => {
    try {
      const key = probeKey(activeCategory, file);
      const index = probe[key]?.index ?? 0;
      const url = stickerCandidateUrl(activeCategory, file, index);
      onStickerSelect(url);
      onClose();
    } catch (err) {
      console.error("[StickerDrawer] handleStickerPress error:", err);
    }
  };

  const handleCategoryChange = (e: React.MouseEvent | React.TouchEvent, cat: StickerPackCategory) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    setActiveCategory(cat);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
            className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-200 rounded-t-[30px] shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />

            <div className="px-5 pb-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-black font-black text-lg">Stickers</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={18} strokeWidth={2} stroke="currentColor" />
                </button>
              </div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-4">
                Tap a sticker to send
              </p>

              <div
                className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-2"
                onClick={(e) => e.stopPropagation()}
              >
{STICKER_PACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={(e) => handleCategoryChange(e, cat)}
                    onMouseDown={(e) => handleCategoryChange(e, cat)}
                    onTouchStart={(e) => handleCategoryChange(e, cat)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer relative z-10 pointer-events-auto ${
                      activeCategory === cat
                        ? "bg-black text-white border border-black"
                        : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                    aria-pressed={activeCategory === cat}
                    aria-label={`Switch to ${cat} stickers`}
                  >
                    {cat === "emotional" ? "Emotional" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
              {visibleFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                  <span className="text-3xl select-none" role="img" aria-label="stickers unavailable">
                    🎨
                  </span>
                  <p className="text-sm font-bold text-gray-700">Stickers unavailable</p>
                  <p className="text-xs text-gray-400">
                    These stickers could not be loaded. Check your connection and try again.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {visibleFiles.map((file) => (
                    <motion.button
                      key={file.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStickerPress(file);
                      }}
                      className="aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center transition-all duration-200"
                    >
                      <img
                        src={srcFor(file)}
                        alt={file.label}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(file)}
                        decoding="async"
                        loading="lazy"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StickerDrawer;
