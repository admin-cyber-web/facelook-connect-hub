import React from "react";

const CurvedEdgeOverlay = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 pointer-events-none"
    style={{ zIndex: 9990 }}
  >
    {/* ── LEFT EDGE — Light reflection (white shimmer) ── */}
    <div
      className="absolute top-0 left-0 h-full"
      style={{
        width: "14px",
        background:
          "linear-gradient(to right, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)",
        backdropFilter: "blur(1.5px)",
        WebkitBackdropFilter: "blur(1.5px)",
        borderRadius: "inherit",
      }}
    />

    {/* ── RIGHT EDGE — Depth shadow (dark curve) ── */}
    <div
      className="absolute top-0 right-0 h-full"
      style={{
        width: "14px",
        background:
          "linear-gradient(to left, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 60%, transparent 100%)",
        backdropFilter: "blur(1.5px)",
        WebkitBackdropFilter: "blur(1.5px)",
        borderRadius: "inherit",
      }}
    />

    {/* ── INSET SHADOW — 3D glass depth on both sides ── */}
    <div
      className="absolute inset-0"
      style={{
        boxShadow:
          "inset 8px 0 20px rgba(255,255,255,0.09), inset -8px 0 20px rgba(0,0,0,0.22)",
        borderRadius: "inherit",
      }}
    />

    {/* ── TOP EDGE FADE — subtle vignette top ── */}
    <div
      className="absolute top-0 left-0 right-0"
      style={{
        height: "32px",
        background:
          "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 100%)",
      }}
    />

    {/* ── BOTTOM EDGE FADE — subtle vignette bottom ── */}
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{
        height: "32px",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.10) 0%, transparent 100%)",
      }}
    />
  </div>
);

export default CurvedEdgeOverlay;
