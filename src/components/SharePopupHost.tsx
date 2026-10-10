import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SharePopup from "./SharePopup";
import {
  SHARE_MODAL_EVENT,
  type ShareModalRequest,
} from "../lib/shareModal";

export default function SharePopupHost() {
  const [request, setRequest] = useState<ShareModalRequest | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<ShareModalRequest>).detail;
      if (detail?.post) setRequest(detail);
    };

    window.addEventListener(SHARE_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(SHARE_MODAL_EVENT, handleOpen);
  }, []);

  if (!request) return null;

  return createPortal(
    <SharePopup
      post={request.post}
      anchor={request.anchor}
      canvas={request.canvas}
      onClose={() => setRequest(null)}
      onShare={(mode, post) => request.onShare?.(mode, post)}
    />,
    document.body,
  );
}
