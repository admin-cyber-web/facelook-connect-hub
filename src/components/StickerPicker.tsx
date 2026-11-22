import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CHAT_STICKERS, type StickerItem } from "../lib/stickers";

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerSelect: (sticker: StickerItem) => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({
  isOpen,
  onClose,
  onStickerSelect,
}) => {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleStickerClick = (sticker: StickerItem, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onStickerSelect(sticker);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50"
          onClick={handleBackdropClick}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-0 left-0 right-0 mx-auto max-w-md"
            style={{
              maxHeight: "60vh",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                Stickers
              </h3>
            </div>

            <div
              style={{
                padding: 12,
                maxHeight: "calc(60vh - 56px)",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 8,
              }}
            >
              {CHAT_STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={(e) => handleStickerClick(sticker, e)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    borderRadius: 12,
                    overflow: "hidden",
                    transition: "transform 0.1s ease",
                    aspectRatio: "1 / 1",
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.9)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <img
                    src={sticker.url}
                    alt={`Sticker ${sticker.filename}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      borderRadius: 8,
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};