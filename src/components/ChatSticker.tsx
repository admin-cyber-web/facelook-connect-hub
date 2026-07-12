import React from "react";
import { motion } from "framer-motion";
import type { StickerType } from "../lib/messageParser";

interface ChatStickerProps {
  type: NonNullable<StickerType>;
  originalText: string;
  isEdited?: boolean;
}

interface StickerConfig {
  emojis: string[];
  label: string;
  gradient: string;
  labelColor: string;
  borderColor: string;
}

const STICKER_CONFIG: Record<NonNullable<StickerType>, StickerConfig> = {
  love: {
    emojis: ["❤️", "💕", "💖", "💗", "🥰"],
    label: "Sending Love",
    gradient: "linear-gradient(135deg, rgba(244,63,94,0.35) 0%, rgba(236,72,153,0.2) 100%)",
    labelColor: "#fda4af",
    borderColor: "rgba(244,63,94,0.3)",
  },
  morning: {
    emojis: ["☀️", "🌸", "😊"],
    label: "Good Morning",
    gradient: "linear-gradient(135deg, rgba(251,191,36,0.35) 0%, rgba(249,115,22,0.2) 100%)",
    labelColor: "#fde68a",
    borderColor: "rgba(251,191,36,0.3)",
  },
  afternoon: {
    emojis: ["🌞", "🌻", "☀️"],
    label: "Good Afternoon",
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.35) 0%, rgba(234,179,8,0.2) 100%)",
    labelColor: "#fdba74",
    borderColor: "rgba(249,115,22,0.3)",
  },
  evening: {
    emojis: ["🌅", "🌇", "✨"],
    label: "Good Evening",
    gradient: "linear-gradient(135deg, rgba(234,88,12,0.35) 0%, rgba(124,58,237,0.2) 100%)",
    labelColor: "#fb923c",
    borderColor: "rgba(234,88,12,0.3)",
  },
  night: {
    emojis: ["🌙", "⭐", "💫", "✨"],
    label: "Good Night",
    gradient: "linear-gradient(135deg, rgba(79,70,229,0.4) 0%, rgba(15,23,42,0.5) 100%)",
    labelColor: "#a5b4fc",
    borderColor: "rgba(79,70,229,0.35)",
  },
  hot_weather: {
    emojis: ["🌡️", "🔥", "☀️", "😅"],
    label: "Bahut Garmi!",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.35) 0%, rgba(249,115,22,0.2) 100%)",
    labelColor: "#fca5a5",
    borderColor: "rgba(239,68,68,0.3)",
  },
  cold_weather: {
    emojis: ["❄️", "🌨️", "🥶", "⛄"],
    label: "Bahut Thandi!",
    gradient: "linear-gradient(135deg, rgba(56,189,248,0.35) 0%, rgba(99,102,241,0.2) 100%)",
    labelColor: "#7dd3fc",
    borderColor: "rgba(56,189,248,0.3)",
  },
  rain: {
    emojis: ["🌧️", "☔", "💧", "🌊"],
    label: "Barish Aa Rahi Hai!",
    gradient: "linear-gradient(135deg, rgba(37,99,235,0.35) 0%, rgba(71,85,105,0.3) 100%)",
    labelColor: "#93c5fd",
    borderColor: "rgba(37,99,235,0.3)",
  },
  anniversary: {
    emojis: ["🎂", "🎊", "💍", "🥂"],
    label: "Happy Anniversary! 🎉",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.35) 0%, rgba(124,58,237,0.25) 100%)",
    labelColor: "#f0abfc",
    borderColor: "rgba(236,72,153,0.3)",
  },
  father_day: {
    emojis: ["👨", "❤️", "🌟", "🎁"],
    label: "Happy Father's Day!",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(99,102,241,0.2) 100%)",
    labelColor: "#93c5fd",
    borderColor: "rgba(59,130,246,0.3)",
  },
  mother_day: {
    emojis: ["👩", "❤️", "🌷", "🎁"],
    label: "Happy Mother's Day!",
    gradient: "linear-gradient(135deg, rgba(244,63,94,0.35) 0%, rgba(251,113,133,0.2) 100%)",
    labelColor: "#fda4af",
    borderColor: "rgba(244,63,94,0.3)",
  },
  diwali: {
    emojis: ["🪔", "✨", "🎆", "🌟"],
    label: "Happy Diwali! 🪔",
    gradient: "linear-gradient(135deg, rgba(234,179,8,0.4) 0%, rgba(249,115,22,0.25) 100%)",
    labelColor: "#fde68a",
    borderColor: "rgba(234,179,8,0.4)",
  },
  holi: {
    emojis: ["🎨", "🌈", "🎉", "💐"],
    label: "Happy Holi! 🌈",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(234,179,8,0.25) 50%, rgba(34,197,94,0.25) 100%)",
    labelColor: "#ffffff",
    borderColor: "rgba(255,255,255,0.2)",
  },
  holiday: {
    emojis: ["🎉", "🏖️", "😄", "🎈"],
    label: "Aaj Chutti Hai!",
    gradient: "linear-gradient(135deg, rgba(34,197,94,0.35) 0%, rgba(20,184,166,0.2) 100%)",
    labelColor: "#86efac",
    borderColor: "rgba(34,197,94,0.3)",
  },
  see_you_tomorrow: {
    emojis: ["👋", "😊", "🌙", "💫"],
    label: "Kal Milte Hain!",
    gradient: "linear-gradient(135deg, rgba(124,58,237,0.35) 0%, rgba(59,130,246,0.2) 100%)",
    labelColor: "#c4b5fd",
    borderColor: "rgba(124,58,237,0.3)",
  },
  warning: {
    emojis: ["⚠️"],
    label: "Content Warning",
    gradient: "linear-gradient(135deg, rgba(234,179,8,0.3) 0%, rgba(239,68,68,0.2) 100%)",
    labelColor: "#fde68a",
    borderColor: "rgba(234,179,8,0.35)",
  },
};

const popIn = {
  initial: { scale: 0.7, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 22 },
  },
};

export const ChatSticker: React.FC<ChatStickerProps> = ({ type, originalText, isEdited }) => {
  const cfg = STICKER_CONFIG[type];

  // ── Warning state — no animation, just a badge ──────────────────────────
  if (type === "warning") {
    return (
      <motion.div
        variants={popIn}
        initial="initial"
        animate="animate"
        style={{
          background: cfg.gradient,
          border: `1px solid ${cfg.borderColor}`,
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          minWidth: 180,
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
        <div>
          <p style={{ color: cfg.labelColor, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
            Content Warning
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontStyle: "italic" }}>
            This message contains inappropriate language.
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Animated sticker ─────────────────────────────────────────────────────
  return (
    <motion.div
      variants={popIn}
      initial="initial"
      animate="animate"
      style={{
        background: cfg.gradient,
        border: `1px solid ${cfg.borderColor}`,
        borderRadius: 18,
        padding: "12px 16px",
        minWidth: 150,
        textAlign: "center",
      }}
    >
      {/* Floating emoji row */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {cfg.emojis.map((emoji, i) => (
          <motion.span
            key={i}
            style={{ display: "inline-block", fontSize: 24 }}
            animate={{
              y: [0, -(6 + i * 3), 0],
              scale: [1, 1.18, 1],
              rotate: [0, i % 2 === 0 ? 8 : -8, 0],
            }}
            transition={{
              duration: 1.6 + i * 0.25,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.18,
            }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>

      {/* Label */}
      <p style={{
        color: cfg.labelColor,
        fontSize: 11,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 6,
      }}>
        {cfg.label}
      </p>

      {/* Original text */}
      <p style={{
        color: "rgba(255,255,255,0.75)",
        fontSize: 12,
        fontStyle: "italic",
        lineHeight: 1.4,
        wordBreak: "break-word",
      }}>
        {originalText}
      </p>

      {isEdited && (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 4, fontStyle: "italic" }}>
          (edited)
        </p>
      )}
    </motion.div>
  );
};

export default ChatSticker;
