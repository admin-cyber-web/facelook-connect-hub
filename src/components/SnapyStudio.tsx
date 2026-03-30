import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  RotateCcw,
  Sparkles,
  Loader2,
  Upload,
  Check,
  Scissors,
  SlidersHorizontal,
  ZapOff,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ── LUT Definitions ────────────────────────────────────────────────────────────
const LUTS = [
  {
    id: "natural",
    name: "Natural",
    emoji: "🌿",
    filter: "none",
    grain: 0,
    gradient: "from-green-500/20 to-emerald-500/20",
  },
  {
    id: "cinematic",
    name: "Teal & Orange",
    emoji: "🎬",
    filter:
      "saturate(1.55) contrast(1.12) sepia(0.22) hue-rotate(-18deg) brightness(0.96)",
    grain: 8,
    gradient: "from-teal-500/30 to-orange-500/30",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    emoji: "🌆",
    filter:
      "saturate(2.4) contrast(1.38) hue-rotate(285deg) brightness(0.82)",
    grain: 12,
    gradient: "from-pink-500/30 to-blue-700/30",
  },
  {
    id: "kodak",
    name: "Kodak Film",
    emoji: "📷",
    filter:
      "sepia(0.55) saturate(0.72) contrast(0.86) brightness(1.12)",
    grain: 28,
    gradient: "from-yellow-500/30 to-amber-600/30",
  },
  {
    id: "moody",
    name: "Moody",
    emoji: "🌑",
    filter:
      "contrast(1.62) saturate(0.32) brightness(0.76)",
    grain: 14,
    gradient: "from-slate-600/40 to-slate-900/40",
  },
  {
    id: "noir",
    name: "Noir B&W",
    emoji: "🎞️",
    filter:
      "grayscale(1) contrast(1.72) brightness(0.74)",
    grain: 32,
    gradient: "from-gray-500/30 to-black/50",
  },
] as const;

type LutId = (typeof LUTS)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFilter(
  lut: (typeof LUTS)[number],
  beautyMode: boolean,
  exposure: number,
  saturation: number,
  warmth: number
): string {
  const parts: string[] = [];
  if (beautyMode) parts.push("blur(0.6px) contrast(1.12) brightness(1.04)");
  if (lut.filter !== "none") parts.push(lut.filter);
  parts.push(`brightness(${(1 + exposure / 100).toFixed(2)})`);
  parts.push(`saturate(${Math.max(0, 1 + saturation / 100).toFixed(2)})`);
  if (warmth > 0) parts.push(`sepia(${(warmth / 100).toFixed(2)})`);
  return parts.join(" ") || "none";
}

// Paint static film grain onto a canvas; returns the canvas
function makeGrainCanvas(w: number, h: number, intensity: number): HTMLCanvasElement {
  const gc = document.createElement("canvas");
  gc.width = w;
  gc.height = h;
  const gx = gc.getContext("2d")!;
  const id = gx.createImageData(w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = ((Math.random() - 0.5) * intensity) | 0;
    d[i] = 128 + v;
    d[i + 1] = 128 + v;
    d[i + 2] = 128 + v;
    d[i + 3] = Math.min(255, Math.abs(v) * 3.5);
  }
  gx.putImageData(id, 0, 0);
  return gc;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface SnapyStudioProps {
  userId: string;
}

type StudioState = "camera" | "preview" | "saving" | "done";

const SnapyStudio: React.FC<SnapyStudioProps> = ({ userId }) => {
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Captured image
  const rawDataRef = useRef<ImageData | null>(null); // untouched raw pixels
  const capturedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string>("");
  const [removedBgUrl, setRemovedBgUrl] = useState<string>("");

  // UI state
  const [state, setState] = useState<StudioState>("camera");
  const [selectedLut, setSelectedLut] = useState<LutId>("natural");
  const [beautyMode, setBeautyMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState("");

  // Adjustments
  const [exposure, setExposure] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);

  // Processing
  const [removingBg, setRemovingBg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // Grain canvas cache
  const grainRef = useRef<HTMLCanvasElement | null>(null);

  const currentLut = LUTS.find((l) => l.id === selectedLut)!;

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(err.message || "Camera access denied.");
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  // ── Live render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "camera") return;

    const canvas = liveCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const lut = LUTS.find((l) => l.id === selectedLut)!;
    // Regenerate grain canvas when lut changes
    grainRef.current = null;

    const render = () => {
      if (!canvas || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }

      const ctx = canvas.getContext("2d")!;

      // Apply filter + draw video
      ctx.filter = buildFilter(lut, beautyMode, exposure, saturation, warmth);
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.filter = "none";

      // Grain overlay
      if (lut.grain > 0) {
        if (!grainRef.current) {
          grainRef.current = makeGrainCanvas(vw, vh, lut.grain);
        }
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.4;
        ctx.drawImage(grainRef.current, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, selectedLut, beautyMode, exposure, saturation, warmth]);

  // ── Re-render captured photo when adjustments change ──────────────────────
  useEffect(() => {
    if (state !== "preview") return;
    const raw = rawDataRef.current;
    const cap = capturedCanvasRef.current;
    if (!raw || !cap) return;

    const ctx = cap.getContext("2d")!;
    ctx.putImageData(raw, 0, 0); // restore raw pixels

    // Apply filter by drawing to a temp canvas and reading back
    const tmp = document.createElement("canvas");
    tmp.width = cap.width;
    tmp.height = cap.height;
    const tx = tmp.getContext("2d")!;
    tx.filter = buildFilter(currentLut, false, exposure, saturation, warmth);
    tx.drawImage(cap, 0, 0);
    tx.filter = "none";

    if (currentLut.grain > 0) {
      const grain = makeGrainCanvas(cap.width, cap.height, currentLut.grain);
      tx.globalCompositeOperation = "overlay";
      tx.globalAlpha = 0.4;
      tx.drawImage(grain, 0, 0);
      tx.globalCompositeOperation = "source-over";
      tx.globalAlpha = 1;
    }

    ctx.clearRect(0, 0, cap.width, cap.height);
    ctx.drawImage(tmp, 0, 0);
    setRemovedBgUrl(""); // reset BG removal if adjustments change
    setCapturedUrl(cap.toDataURL("image/jpeg", 0.95));
  }, [state, exposure, saturation, warmth, selectedLut]);

  // ── Capture ───────────────────────────────────────────────────────────────
  const capture = () => {
    const live = liveCanvasRef.current;
    if (!live) return;
    cancelAnimationFrame(rafRef.current);

    // Create capture canvas at full res
    const cap = document.createElement("canvas");
    cap.width = live.width;
    cap.height = live.height;
    const ctx = cap.getContext("2d")!;
    ctx.drawImage(live, 0, 0);

    // Save raw pixels for re-adjustment
    rawDataRef.current = ctx.getImageData(0, 0, cap.width, cap.height);
    capturedCanvasRef.current = cap;
    setCapturedUrl(cap.toDataURL("image/jpeg", 0.95));
    setExposure(0);
    setSaturation(0);
    setWarmth(0);
    setRemovedBgUrl("");
    setState("preview");
  };

  // ── Retake ────────────────────────────────────────────────────────────────
  const retake = () => {
    setRemovedBgUrl("");
    setCapturedUrl("");
    setUploadDone(false);
    setState("camera");
  };

  // ── Remove Background ────────────────────────────────────────────────────
  const handleRemoveBg = async () => {
    const cap = capturedCanvasRef.current;
    if (!cap || removingBg) return;
    setRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await new Promise<Blob>((res) =>
        cap.toBlob((b) => res(b!), "image/png")
      );
      const resultBlob = await removeBackground(blob);
      setRemovedBgUrl(URL.createObjectURL(resultBlob));
    } catch (e) {
      console.error("BG removal failed:", e);
    } finally {
      setRemovingBg(false);
    }
  };

  // ── Save & Post ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    const cap = capturedCanvasRef.current;
    if (!cap || uploading) return;
    setUploading(true);
    try {
      let blob: Blob;
      if (removedBgUrl) {
        // Use the BG-removed image
        const resp = await fetch(removedBgUrl);
        blob = await resp.blob();
      } else {
        blob = await new Promise<Blob>((res) =>
          cap.toBlob((b) => res(b!), "image/jpeg", 0.92)
        );
      }

      const ext = removedBgUrl ? "png" : "jpg";
      const fileName = `snapy/${userId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("posts")
        .upload(fileName, blob, { contentType: blob.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(fileName);

      await supabase.from("posts").insert({
        user_id: userId,
        image_url: urlData.publicUrl,
        caption: "📸 Shot with Snapy Studio",
      });

      setUploadDone(true);
      setTimeout(() => setState("done"), 800);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setUploading(false);
    }
  };

  // ── Flip camera ───────────────────────────────────────────────────────────
  const flipCamera = () =>
    setFacingMode((f) => (f === "user" ? "environment" : "user"));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden">
      {/* ─── Camera error ─────────────────────────────────────────────── */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Camera size={28} className="text-white/30" />
          </div>
          <p className="text-white font-black text-lg">Camera Unavailable</p>
          <p className="text-white/40 text-sm">{cameraError}</p>
          <button
            onClick={startCamera}
            className="mt-2 px-6 py-3 bg-blue-600 rounded-2xl text-white text-sm font-black"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Hidden video element ──────────────────────────────────────── */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* ─── Top Bar ──────────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-safe pt-4 pb-2">
        {state === "preview" || state === "done" ? (
          <button
            onClick={retake}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-black"
          >
            <RotateCcw size={16} /> Retake
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBeautyMode((b) => !b)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition-all ${
                beautyMode
                  ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              {beautyMode ? <Zap size={12} /> : <ZapOff size={12} />}
              Beauty
            </button>
          </div>
        )}

        <p className="absolute left-1/2 -translate-x-1/2 text-white font-black text-sm tracking-widest uppercase">
          Snapy Studio
        </p>

        {state === "camera" && (
          <button
            onClick={flipCamera}
            className="p-2 bg-white/10 rounded-full border border-white/10 text-white/70 hover:text-white"
          >
            <RotateCcw size={16} />
          </button>
        )}

        {state === "preview" && (
          <button
            onClick={handleRemoveBg}
            disabled={removingBg}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition-all ${
              removedBgUrl
                ? "bg-green-500/20 border-green-500/40 text-green-300"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {removingBg ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Scissors size={12} />
            )}
            {removedBgUrl ? "BG Removed" : "Remove BG"}
          </button>
        )}
      </div>

      {/* ─── Main viewfinder / preview area ───────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Live canvas */}
        <canvas
          ref={liveCanvasRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            state === "camera" ? "opacity-100" : "opacity-0 pointer-events-none absolute"
          }`}
          style={{ objectFit: "cover" }}
        />

        {/* Captured image preview */}
        <AnimatePresence>
          {(state === "preview" || state === "saving" || state === "done") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <img
                src={removedBgUrl || capturedUrl}
                className="w-full h-full object-contain"
                style={{
                  background: removedBgUrl
                    ? "repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 0 0 / 20px 20px"
                    : "transparent",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done overlay */}
        <AnimatePresence>
          {state === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-4"
            >
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-2xl">
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>
              <p className="text-white font-black text-lg">Posted!</p>
              <button
                onClick={retake}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-2xl text-white font-black text-sm"
              >
                Take Another
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter name badge on live view */}
        {state === "camera" && selectedLut !== "natural" && (
          <div className="absolute top-3 right-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <span className="text-white text-xs font-black">
              {currentLut.emoji} {currentLut.name}
            </span>
          </div>
        )}
      </div>

      {/* ─── Bottom Controls ───────────────────────────────────────────── */}
      <div className="relative z-20 pb-safe pb-8 pt-2">

        {/* ── Filter Picker ────────────────────────────────────────────── */}
        <div className="overflow-x-auto pb-2 no-scrollbar">
          <div className="flex gap-3 px-5 w-max">
            {LUTS.map((lut) => (
              <button
                key={lut.id}
                onClick={() => setSelectedLut(lut.id)}
                className={`flex flex-col items-center gap-1.5 transition-all ${
                  selectedLut === lut.id ? "scale-110" : "opacity-60"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${lut.gradient} border-2 flex items-center justify-center text-2xl transition-all ${
                    selectedLut === lut.id
                      ? "border-white shadow-[0_0_16px_rgba(255,255,255,0.3)]"
                      : "border-white/20"
                  }`}
                >
                  {lut.emoji}
                </div>
                <span className="text-[9px] font-black text-white/80 uppercase tracking-wide leading-tight text-center w-14">
                  {lut.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Post-capture sliders ──────────────────────────────────────── */}
        <AnimatePresence>
          {state === "preview" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-5 mt-3 space-y-2"
            >
              {(
                [
                  { label: "Exposure", value: exposure, set: setExposure, icon: "☀️" },
                  { label: "Saturation", value: saturation, set: setSaturation, icon: "🎨" },
                  { label: "Warmth", value: warmth, set: setWarmth, icon: "🔥", min: 0, max: 80 },
                ] as const
              ).map(({ label, value, set, icon, ...rest }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-base w-6 shrink-0">{icon}</span>
                  <span className="text-[10px] font-black text-white/40 uppercase w-16 shrink-0">
                    {label}
                  </span>
                  <input
                    type="range"
                    min={(rest as any).min ?? -50}
                    max={(rest as any).max ?? 50}
                    value={value}
                    onChange={(e) => (set as any)(Number(e.target.value))}
                    className="flex-1 h-1 accent-white rounded-full appearance-none bg-white/10 cursor-pointer"
                  />
                  <span className="text-[10px] text-white/30 w-8 text-right shrink-0">
                    {value > 0 ? `+${value}` : value}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action row ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center mt-4 px-5 gap-6">
          {state === "camera" && (
            <>
              <div className="w-10" />
              {/* Shutter button */}
              <button
                onClick={capture}
                className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-90 transition-transform relative"
              >
                <div className="w-16 h-16 rounded-full border-4 border-black/10 flex items-center justify-center">
                  <Camera size={28} className="text-slate-700" />
                </div>
              </button>
              <div className="w-10" />
            </>
          )}

          {state === "preview" && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleSave}
              disabled={uploading || uploadDone}
              className="flex-1 max-w-xs py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Uploading…
                </>
              ) : uploadDone ? (
                <>
                  <Check size={18} /> Posted!
                </>
              ) : (
                <>
                  <Upload size={18} /> Save & Post
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* Global no-scrollbar style */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default SnapyStudio;
