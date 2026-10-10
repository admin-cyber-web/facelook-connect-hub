import type {
  ShareAnchor,
  ShareMode,
  SharePostData,
} from "../components/SharePopup";

export const SHARE_MODAL_EVENT = "flicks:open-share-modal";

export interface ShareModalRequest {
  post: SharePostData;
  anchor: ShareAnchor;
  onShare?: (mode: ShareMode, post: SharePostData) => void;
  canvas?: HTMLCanvasElement | null;
}

export function requestShareModal(
  post: SharePostData,
  anchorElement?: HTMLElement | null,
  options: Pick<ShareModalRequest, "onShare" | "canvas"> = {},
): void {
  if (typeof window === "undefined") return;
  const rect = anchorElement?.getBoundingClientRect();
  const anchor: ShareAnchor = rect
    ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 };

  window.dispatchEvent(
    new CustomEvent<ShareModalRequest>(SHARE_MODAL_EVENT, {
      detail: { post, anchor, ...options },
    }),
  );
}
