import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type PostActionMenuPosition = {
  top: number;
  right: number;
};

type Props = {
  isOpen: boolean;
  position: PostActionMenuPosition;
  children: ReactNode;
};

export default function PostActionMenuPortal({
  isOpen,
  position,
  children,
}: Props) {
  if (!isOpen) return null;

  return createPortal(
    <div
      role="menu"
      data-fame-post-menu
      data-post-action-menu
      className="fixed z-[9999] w-52 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#1a0d1e] shadow-2xl pointer-events-auto"
      style={{
        top: position.top,
        right: position.right,
        pointerEvents: "auto",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
