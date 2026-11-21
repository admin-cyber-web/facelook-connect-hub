"use client";

import React, { useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EyeOff, Pencil, Trash2 } from "lucide-react";
import type { Message } from "./ChatSystem";

interface ChatMsgActionMenuProps {
  open: boolean;
  msg: Message;
  x: number;
  y: number;
  onClose: () => void;
  userId: string;
  handleMsgReact: (msgId: string, emoji: string) => void | Promise<void>;
  setReplyTo: (msg: Message | null) => void;
  setEditingMsg: (msg: { id: string; text: string } | null) => void;
  deleteForMe: (msgId: string) => void;
  deleteMessageAt: (msg: Message, x: number, y: number) => void | Promise<void>;
}

export const ChatMsgActionMenu: React.FC<ChatMsgActionMenuProps> = ({
  open,
  msg,
  x,
  y,
  onClose,
  userId,
  handleMsgReact,
  setReplyTo,
  setEditingMsg,
  deleteForMe,
  deleteMessageAt,
}) => {
  const isMine = msg.sender_id === userId;
  const QUICK_EMOJIS = ["❤️", "👍", "😂", "🔥", "😮"];

  const menuW = 220;
  const reactionH = 54;
  const rowH = 46;
  const rowCount = isMine ? 3 : 2;
  const menuH = reactionH + rowCount * rowH;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(x - menuW / 2, 8), vw - menuW - 8);
  const showAbove = y + menuH + 20 > vh;
  const top = showAbove ? Math.max(y - menuH - 14, 8) : y + 14;

  console.log(
    "[ChatMsgActionMenu] Component render — open:",
    open,
    "msgId:",
    msg.id,
    "x:",
    x,
    "y:",
    y,
  );

  const handleReaction = useCallback(
    (emoji: string) => {
      console.log("[ChatMsgAction] Reaction:", emoji, "msgId:", msg.id);
      toast.success("Reaction added");
      void handleMsgReact(msg.id, emoji);
      onClose();
    },
    [msg.id, handleMsgReact, onClose]
  );

  const handleReply = useCallback(() => {
    console.log("[ChatMsgAction] Reply to msgId:", msg.id);
    toast.info("Reply opened");
    setReplyTo(msg);
    onClose();
  }, [msg, setReplyTo, onClose]);

  const handleEdit = useCallback(() => {
    console.log("[ChatMsgAction] Edit msgId:", msg.id);
    toast.info("Edit mode opened");
    setEditingMsg({ id: msg.id, text: msg.content });
    onClose();
  }, [msg.id, msg.content, setEditingMsg, onClose]);

  const handleDeleteForMe = useCallback(() => {
    console.log("[ChatMsgAction] Delete for Me msgId:", msg.id);
    toast.error("Deleted for me");
    deleteForMe(msg.id);
    onClose();
  }, [msg.id, deleteForMe, onClose]);

  const handleDeleteForEveryone = useCallback(() => {
    console.log("[ChatMsgAction] Delete for Everyone msgId:", msg.id);
    toast.error("Deleted for everyone");
    void deleteMessageAt(msg, x, y);
    onClose();
  }, [msg, x, y, deleteMessageAt, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop — sits BEHIND the menu card (lower z-index). pointer-events-auto
              so it can receive outside taps to dismiss. Because the menu card is
              rendered on top with a higher z-index, clicks on buttons never reach it. */}
          <div
            className="fixed inset-0 z-[99990] bg-black/20 backdrop-blur-[1px] pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[ChatMsgAction] Backdrop tapped — closing menu");
              onClose();
            }}
          />
          {/* Menu card — sits ABOVE the backdrop (z-10 > z-[5]). relative + pointer-events-auto
              so it participates in hit-testing and receives clicks on its buttons. */}
          <motion.div
            key="chat-msg-action-float"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 420,
            }}
            className="fixed z-[99991] relative pointer-events-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            data-chat-msg-action-menu="true"
            style={{
              top,
              left,
              width: menuW,
              transformOrigin: showAbove
                ? "bottom center"
                : "top center",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Quick-reactions row */}
            <div className="flex items-center justify-around px-3 py-3 bg-gray-50 border-b border-gray-100">
              {QUICK_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleReaction(emoji);
                  }}
                  className="text-[24px] leading-none cursor-pointer hover:scale-125 transition-transform"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
            {/* Reply */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleReply();
              }}
              className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-800 cursor-pointer hover:bg-gray-100 active:bg-gray-100 transition-colors"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-gray-500"
              >
                <polyline points="9 17 4 12 9 7" />
                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
              Reply
            </button>
            {/* Edit — own text messages only */}
            {isMine && !msg.media_url && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEdit();
                }}
                className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-blue-600 cursor-pointer hover:bg-blue-50 active:bg-blue-50 transition-colors border-t border-gray-50"
              >
                <Pencil size={15} className="text-blue-500" />
                Edit
              </button>
            )}
            {/* Delete for Me */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteForMe();
              }}
              className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 active:bg-gray-100 transition-colors border-t border-gray-50"
            >
              <EyeOff size={15} className="text-gray-400" />
              Delete for Me
            </button>
            {/* Delete for Everyone — only sender */}
            {isMine && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteForEveryone();
                }}
                className="w-full flex items-center gap-3 px-4 py-[13px] text-left text-[14px] font-semibold text-red-600 cursor-pointer hover:bg-red-50 active:bg-red-50 transition-colors border-t border-gray-50"
              >
                <Trash2 size={15} className="text-red-500" />
                Delete for Everyone
              </button>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
