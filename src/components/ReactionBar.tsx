import { motion, AnimatePresence } from "framer-motion";

export const CHAT_REACTIONS = ["❤️", "👍", "😂", "🔥", "😮"];

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  onClose: () => void;
  align?: "left" | "right";
  className?: string;
}

export const ReactionBar = ({ onReact, onClose, align = "left", className }: ReactionBarProps) => (
  <motion.div
    initial={{ scale: 0.5, opacity: 0, y: 6 }}
    animate={{ scale: 1, opacity: 1, y: 0 }}
    exit={{ scale: 0.5, opacity: 0, y: 6 }}
    transition={{ type: "spring", stiffness: 500, damping: 28 }}
    className={`flex items-center gap-1 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-full px-3 py-2 shadow-2xl border border-gray-100 dark:border-zinc-700 z-50 ${className ?? ""}`}
    style={{ transformOrigin: align === "right" ? "bottom right" : "bottom left" }}
    onClick={(e) => e.stopPropagation()}
  >
    {CHAT_REACTIONS.map((emoji) => (
      <motion.button
        key={emoji}
        whileHover={{ scale: 1.5, y: -4 }}
        whileTap={{ scale: 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        onClick={() => { onReact(emoji); onClose(); }}
        className="text-2xl leading-none select-none hover:drop-shadow-lg"
        aria-label={emoji}
      >
        {emoji}
      </motion.button>
    ))}
  </motion.div>
);

interface ReactionBubblesProps {
  reactions: Record<string, string[]>;
  currentUserId?: string | null;
  align?: "left" | "right";
}

export const ReactionBubbles = ({ reactions, currentUserId, align = "left" }: ReactionBubblesProps) => {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-0.5 mt-0.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      <AnimatePresence>
        {entries.map(([emoji, users]) => {
          const isMe = currentUserId && users.includes(currentUserId);
          return (
            <motion.span
              key={emoji}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold shadow-sm border
                ${isMe
                  ? "bg-blue-100 border-blue-300 text-blue-700"
                  : "bg-white/90 border-gray-200 text-gray-600"}`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              {users.length > 1 && <span>{users.length}</span>}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
