import { useEffect, useRef, useState, useCallback } from "react";

interface Droplet {
  x: number;
  y: number;
  r: number;
  opacity: number;
  hlX: number;
  hlY: number;
  tiltX: number;
  tiltY: number;
}

const WIPE_RADIUS = 62;
const CHECK_INTERVAL = 80;
const DISMISS_THRESHOLD = 0.13;

const SteamOverlay = () => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const dropletsRef = useRef<Droplet[]>([]);
  const wipedSteps = useRef(0);
  const [dismissed, setDismissed] = useState(false);
  const [showHint, setShowHint]   = useState(true);

  const buildDroplets = useCallback((w: number, h: number): Droplet[] => {
    const count = Math.floor((w * h) / 3200);
    return Array.from({ length: count }, () => {
      const r = Math.random() * 20 + 4;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r,
        opacity: Math.random() * 0.45 + 0.28,
        hlX: -r * 0.32,
        hlY: -r * 0.32,
        tiltX: (Math.random() - 0.5) * r * 0.6,
        tiltY: (Math.random() - 0.5) * r * 0.6,
      };
    });
  }, []);

  const drawDroplet = useCallback((ctx: CanvasRenderingContext2D, d: Droplet) => {
    ctx.save();

    const body = ctx.createRadialGradient(
      d.x + d.hlX, d.y + d.hlY, d.r * 0.05,
      d.x + d.tiltX * 0.3, d.y + d.tiltY * 0.3, d.r,
    );
    body.addColorStop(0,   `rgba(255,255,255,${Math.min(d.opacity + 0.25, 0.95)})`);
    body.addColorStop(0.35,`rgba(215,230,242,${d.opacity + 0.08})`);
    body.addColorStop(0.75,`rgba(170,200,225,${d.opacity})`);
    body.addColorStop(1,   `rgba(130,170,210,${d.opacity - 0.08})`);

    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r, d.r * 0.93, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(d.x + d.hlX, d.y + d.hlY, d.r * 0.36, d.r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r, d.r * 0.93, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(160,195,225,${d.opacity * 0.55})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.restore();
  }, []);

  const drawSteam = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";

    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0,   "rgba(215,225,235,0.88)");
    base.addColorStop(0.3, "rgba(205,218,230,0.84)");
    base.addColorStop(0.7, "rgba(210,222,232,0.86)");
    base.addColorStop(1,   "rgba(220,228,238,0.88)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 72; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const rw = Math.random() * 260 + 60;
      const rh = Math.random() * 160 + 40;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, Math.max(rw, rh) * 0.8);
      rg.addColorStop(0, `rgba(255,255,255,${Math.random() * 0.18 + 0.04})`);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(px, py, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 18; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const rad = Math.random() * 80 + 30;
      const dark = ctx.createRadialGradient(px, py, 0, px, py, rad);
      dark.addColorStop(0, `rgba(160,180,200,${Math.random() * 0.07})`);
      dark.addColorStop(1, "rgba(160,180,200,0)");
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(px, py, rad, rad * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    dropletsRef.current.forEach(d => drawDroplet(ctx, d));
  }, [drawDroplet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const init = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      dropletsRef.current = buildDroplets(canvas.width, canvas.height);
      drawSteam(ctx, canvas.width, canvas.height);
    };

    init();

    const onResize = () => init();
    window.addEventListener("resize", onResize);

    const checkDismiss = () => {
      const { width: w, height: h } = canvas;
      const step = 4;
      const sample = ctx.getImageData(0, 0, w, h);
      let opaque = 0;
      const total = Math.floor(sample.data.length / (4 * step * step));
      for (let i = 3; i < sample.data.length; i += 4 * step * step) {
        if (sample.data[i] > 18) opaque++;
      }
      if (opaque / total < DISMISS_THRESHOLD) setDismissed(true);
    };

    const wipe = (cx: number, cy: number) => {
      ctx.globalCompositeOperation = "destination-out";
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, WIPE_RADIUS);
      g.addColorStop(0,   "rgba(0,0,0,1)");
      g.addColorStop(0.45,"rgba(0,0,0,0.88)");
      g.addColorStop(0.75,"rgba(0,0,0,0.45)");
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, WIPE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      wipedSteps.current += 1;
      if (wipedSteps.current % CHECK_INTERVAL === 0) checkDismiss();

      setShowHint(false);
    };

    const onMouseMove = (e: MouseEvent) => wipe(e.clientX, e.clientY);

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      Array.from(e.touches).forEach(t => wipe(t.clientX, t.clientY));
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [buildDroplets, drawSteam]);

  if (dismissed) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 9998,
          pointerEvents: "auto",
          cursor: "crosshair",
          touchAction: "none",
        }}
      />

      {showHint && (
        <div
          style={{
            position: "fixed",
            bottom: "28%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            animation: "steamHintPulse 2s ease-in-out infinite",
          }}
        >
          <div style={{
            fontSize: 32,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.18))",
            animation: "steamFingerWave 1.6s ease-in-out infinite",
          }}>
            👆
          </div>
          <div style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(10px)",
            borderRadius: 20,
            padding: "7px 18px",
            fontSize: 13,
            fontWeight: 700,
            color: "#334155",
            letterSpacing: "0.03em",
            boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
            border: "1px solid rgba(255,255,255,0.7)",
            whiteSpace: "nowrap",
          }}>
            Ungli se bhaap saaf karo ✨
          </div>
        </div>
      )}

      <style>{`
        @keyframes steamHintPulse {
          0%,100% { opacity: 0.9; }
          50%      { opacity: 0.55; }
        }
        @keyframes steamFingerWave {
          0%,100% { transform: translateY(0px) rotate(-8deg); }
          50%      { transform: translateY(-8px) rotate(8deg); }
        }
      `}</style>
    </>
  );
};

export default SteamOverlay;
