import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { bunnyStickerUrl, type StickerPackCategory } from "../lib/bunny";

type StickerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onStickerSelect: (stickerUrl: string) => void;
};

/** Category folders exposed on the BunnyCDN pull zone. */
const STICKER_CATEGORIES: StickerPackCategory[] = ["Love", "Sad", "emotional", "Angry"];

/**
 * Sticker file names per category.
 * Replace these placeholder filenames with the actual files you have uploaded
 * to each category folder on https://flicksindiacdn.b-cdn.net
 */
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
  const [activeCategory, setActiveCategory] = useState<StickerPackCategory>(
    "Love"
  );
  const files = STICKER_FILES[activeCategory];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — tap to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
            className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 rounded-t-[30px] shadow-2xl max-h-[82vh] flex flex-col"
          >
            {/* Drawer handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-2" />

            {/* Header */}
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-black text-lg">
                  Stickers
                </h3>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3">
                Tap a sticker to send
              </p>

              {/* Category tabs */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-1">
                {STICKER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      activeCategory === cat
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticker grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-2">
                {files.map((file) => {
                  const url = bunnyStickerUrl(activeCategory, file);
                  return (
                    <button
                      key={file}
                      onClick={() => {
                        onStickerSelect(url);
                        onClose();
                      }}
                      className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 hover:scale-105 transition-all duration-200"
                    >
                      <img
                        src={url}
                        alt={file}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          // Fallback emoji label when image is missing
                          target.parentElement?.classList.add("flex", "items-center", "justify-center");
                          target.parentElement?.classList.remove("overflow-hidden");
                          (target.parentElement as HTMLElement).innerHTML = "🎨";
                        }}
                        decoding="async"
                        loading="lazy"
                      />
                    </button>
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
