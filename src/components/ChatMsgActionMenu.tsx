import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Reply as ReplyIcon, Trash2, Users } from "lucide-react";
import { CHAT_REACTIONS } from "./ReactionBar";

const EDGE_PADDING = 10;

/** Clamp a floating card so it always stays inside the visible viewport. */
function useClampedPosition(
  x: number,
  y: number,
  preferred: "above" | "below",
) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const maxLeft = Math.max(
        EDGE_PADDING,
        window.innerWidth - rect.width - EDGE_PADDING,
      );
      const left = Math.min(Math.max(EDGE_PADDING, x - rect.width / 2), maxLeft);

      let top = preferred === "above" ? y - rect.height - 12 : y + 14;
      if (top < EDGE_PADDING) top = Math.min(y + 14, window.innerHeight - rect.height - EDGE_PADDING);
      if (top + rect.height > window.innerHeight - EDGE_PADDING) {
        top = Math.max(EDGE_PADDING, window.innerHeight - rect.height - EDGE_PADDING);
      }
      setPosition({ left, top });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [x, y, preferred]);

  return { ref, position };
}

function useEscapeToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
}

interface ChatMsgActionMenuProps {
  open: boolean;
  x: number;
  y: number;
  isMine: boolean;
  canEdit: boolean;
  currentReaction?: string | null;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onClose: () => void;
}

const backdropClasses = "fixed inset-0 z-[400]";

export function ChatMsgActionMenu({
  open,
  x,
  y,
  isMine,
  canEdit,
  currentReaction,
  onReact,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}: ChatMsgActionMenuProps) {
  useEscapeToClose(open, onClose);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={backdropClasses}>
          <div
            className="absolute inset-0"
            onPointerDown={(event) => {
              event.stopPropagation();
              onClose();
            }}
          />
          <MenuSurface
            x={x}
            y={y}
            isMine={isMine}
            canEdit={canEdit}
            currentReaction={currentReaction}
            onReact={onReact}
            onReply={onReply}
            onEdit={onEdit}
            onDeleteForMe={onDeleteForMe}
            onDeleteForEveryone={onDeleteForEveryone}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MenuSurface({
  x,
  y,
  isMine,
  canEdit,
  currentReaction,
  onReact,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}: Omit<ChatMsgActionMenuProps, "open" | "onClose">) {
  const { ref, position } = useClampedPosition(x, y, "above");

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: position ? 0 : 8 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      className="absolute z-[401] w-[232px] overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/95 text-white shadow-2xl backdrop-blur-xl"
      style={{
        left: position?.left ?? x,
        top: position?.top ?? y,
        visibility: position ? "visible" : "hidden",
        transformOrigin: "bottom center",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-0.5 px-2 py-2">
        {CHAT_REACTIONS.map((emoji) => {
          const active = currentReaction === emoji;
          return (
            <motion.button
              key={emoji}
              type="button"
              whileTap={{ scale: 0.82 }}
              onClick={() => onReact(emoji)}
              aria-label={`React ${emoji}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none transition-colors ${
                active ? "bg-white/25 ring-1 ring-white/40" : "hover:bg-white/10"
              }`}
            >
              {emoji}
            </motion.button>
          );
        })}
      </div>
      <div className="h-px bg-white/10" />
      <MenuItem icon={<ReplyIcon size={16} />} label="Reply" onClick={onReply} />
      {canEdit && (
        <MenuItem icon={<Pencil size={16} />} label="Edit message" onClick={onEdit} />
      )}
      <MenuItem
        icon={<Trash2 size={16} />}
        label="Delete for me"
        onClick={onDeleteForMe}
      />
      {isMine && (
        <MenuItem
          icon={<Users size={16} />}
          label="Delete for everyone"
          onClick={onDeleteForEveryone}
          danger
        />
      )}
    </motion.div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-semibold transition-colors active:bg-white/15 ${
        danger ? "text-red-400 hover:bg-red-500/15" : "text-white hover:bg-white/10"
      }`}
    >
      <span className={danger ? "text-red-400" : "text-white/70"}>{icon}</span>
      {label}
    </button>
  );
}

interface ChatReactionPickerProps {
  open: boolean;
  x: number;
  y: number;
  currentReaction?: string | null;
  onReact: (emoji: string) => void;
  onClose: () => void;
}

export function ChatReactionPicker({
  open,
  x,
  y,
  currentReaction,
  onReact,
  onClose,
}: ChatReactionPickerProps) {
  useEscapeToClose(open, onClose);
  const { ref, position } = useClampedPosition(x, y, "above");

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={backdropClasses}>
          <div
            className="absolute inset-0"
            onPointerDown={(event) => {
              event.stopPropagation();
              onClose();
            }}
          />
          <motion.div
            ref={ref}
            role="menu"
            aria-label="Pick a reaction"
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 8 }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
            className="absolute z-[401] flex items-center gap-2 rounded-full border border-white/20 bg-zinc-900/95 px-3 py-2 shadow-2xl backdrop-blur-xl"
            style={{
              left: position?.left ?? x,
              top: position?.top ?? y,
              visibility: position ? "visible" : "hidden",
              transformOrigin: "bottom center",
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {CHAT_REACTIONS.map((emoji) => {
              const active = currentReaction === emoji;
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  whileHover={{ scale: 1.25, y: -2 }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  onClick={() => onReact(emoji)}
                  aria-label={`React ${emoji}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none ${
                    active ? "bg-white/25 ring-1 ring-white/40" : "hover:bg-white/10"
                  }`}
                >
                  {emoji}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
