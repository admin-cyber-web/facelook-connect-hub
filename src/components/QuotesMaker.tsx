import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  Share2,
  Send,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Shuffle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  CATEGORIES,
  LANGS,
  filterQuotes,
  type QuoteCategory,
  type QuoteLang,
} from "@/data/quotesData";

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_SIZE = 1080;
const WATERMARK = "flicksindia.online";

const THEMES: { label: string; stops: string[] }[] = [
  { label: "Royal Night",  stops: ["#1a0030", "#3d0066", "#6600cc"] },
  { label: "Midnight",     stops: ["#0f0c29", "#302b63", "#24243e"] },
  { label: "Sunset Fire",  stops: ["#f12711", "#c0392b", "#f5af19"] },
  { label: "Ocean Deep",   stops: ["#021b79", "#0575e6", "#00b4db"] },
  { label: "Forest Night", stops: ["#0a2e0a", "#1a5c1a", "#0d3d0d"] },
  { label: "Rose Gold",    stops: ["#b76e79", "#c9a96e", "#b76e79"] },
  { label: "Neon Dark",    stops: ["#0d0d0d", "#1a0030", "#2d004d"] },
  { label: "Golden Hour",  stops: ["#f7971e", "#e55d87", "#ffd200"] },
  { label: "Aurora",       stops: ["#00c3ff", "#6b2fa0", "#ee0979"] },
  { label: "Black Marble", stops: ["#232526", "#3a3d40", "#414345"] },
  { label: "Desi Night",   stops: ["#700000", "#3a0066", "#1b1b2f"] },
  { label: "Monsoon",      stops: ["#373b44", "#1a237e", "#4286f4"] },
];

const FONT_OPTIONS: { label: string; value: string; googleId: string }[] = [
  { label: "Playfair",   value: "'Playfair Display', Georgia, serif",  googleId: "Playfair+Display:wght@700" },
  { label: "Poppins",    value: "'Poppins', sans-serif",               googleId: "Poppins:wght@600;700" },
  { label: "Bebas",      value: "'Bebas Neue', Impact, sans-serif",    googleId: "Bebas+Neue" },
  { label: "Dancing",    value: "'Dancing Script', cursive",           googleId: "Dancing+Script:wght@700" },
  { label: "Montserrat", value: "'Montserrat', sans-serif",            googleId: "Montserrat:wght@700;800" },
];

const PALETTE = [
  "#FFFFFF", "#FFF44F", "#FF6B6B", "#4ECDC4",
  "#FFD700", "#FF69B4", "#00FF88", "#FF8C42",
];

const CATEGORY_EMOJI: Record<QuoteCategory, string> = {
  Motivational: "💪", Love: "❤️", Sad: "😔",
  Dhokha: "🗡️", Romantic: "🌹", Happy: "😊",
};

// ── Load Google Fonts once ────────────────────────────────────────────────────
let _fontsInjected = false;
function injectFonts() {
  if (_fontsInjected || typeof document === "undefined") return;
  _fontsInjected = true;
  const families = FONT_OPTIONS.map((f) => f.googleId).join("&family=");
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

// ── Draw a gradient background onto ctx ──────────────────────────────────────
function drawGradient(
  ctx: CanvasRenderingContext2D,
  stops: string[],
  size: number,
  angleDeg = 135
) {
  const rad = (angleDeg * Math.PI) / 180;
  const half = size / 2;
  const grd = ctx.createLinearGradient(
    half - Math.cos(rad) * half,
    half - Math.sin(rad) * half,
    half + Math.cos(rad) * half,
    half + Math.sin(rad) * half
  );
  stops.forEach((c, i) => grd.addColorStop(i / Math.max(stops.length - 1, 1), c));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
}

// ── Word-wrap text onto canvas ────────────────────────────────────────────────
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  lineH: number,
  align: CanvasTextAlign
) {
  ctx.textAlign = align;
  const drawX = align === "left" ? cx - maxW / 2 : align === "right" ? cx + maxW / 2 : cx;

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const totalH = lines.length * lineH;
  let y = cy - totalH / 2 + lineH * 0.5;
  for (const l of lines) {
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur  = 14;
    ctx.fillText(l, drawX, y);
    ctx.shadowBlur  = 0;
    y += lineH;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  userId: string;
  userName?: string;           // author's display name — passed from Index.tsx
  onClose?: () => void;
  onPostSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
const QuotesMaker: React.FC<Props> = ({ userId, userName = "", onClose, onPostSuccess }) => {
  // Resolved author display name (prop takes priority; fallback fetched from DB)
  const [resolvedAuthor, setResolvedAuthor] = useState(userName);

  useEffect(() => {
    if (userName) { setResolvedAuthor(userName); return; }
    // Fetch from profiles if prop wasn't provided or was empty
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setResolvedAuthor(data.full_name);
      });
  }, [userId, userName]);

  // Quote state
  const [category, setCategory]   = useState<QuoteCategory>("Motivational");
  const [lang, setLang]           = useState<QuoteLang>("hindi");
  const [selectedQuote, setSelectedQuote] = useState("");
  const [customText, setCustomText]       = useState("");
  const [showList, setShowList]   = useState(false);

  // Canvas / design state
  const [themeIdx, setThemeIdx]   = useState(0);
  const [bgImg, setBgImg]         = useState<HTMLImageElement | null>(null);
  const bgObjectUrlRef = useRef<string | null>(null);
  const [font, setFont]           = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize]   = useState(68);
  const [color, setColor]         = useState("#FFFFFF");
  const [align, setAlign]         = useState<CanvasTextAlign>("center");
  const [textX, setTextX]         = useState(CANVAS_SIZE / 2);
  const [textY, setTextY]         = useState(CANVAS_SIZE / 2);

  // Drag refs
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // UI state
  const [tab, setTab]               = useState<"text" | "design">("text");
  const [posting, setPosting]       = useState(false);
  const [sharing, setSharing]       = useState(false);
  const [postingStory, setPostingStory] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  // Inject Google Fonts once
  useEffect(() => { injectFonts(); }, []);

  // Seed first quote when category / lang changes
  useEffect(() => {
    const pool = filterQuotes(category, lang);
    setSelectedQuote(pool[0]?.text ?? "");
    setCustomText("");
    setTextX(CANVAS_SIZE / 2);
    setTextY(CANVAS_SIZE / 2);
  }, [category, lang]);

  const displayText = customText.trim() || selectedQuote;
  const pool        = filterQuotes(category, lang);

  // ── Master draw ───────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Background
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } else {
      drawGradient(ctx, THEMES[themeIdx].stops, CANVAS_SIZE);
    }

    // Quote text
    if (displayText) {
      ctx.fillStyle = color;
      ctx.font      = `bold ${fontSize}px ${font}`;
      drawWrappedText(
        ctx, displayText,
        textX, textY,
        CANVAS_SIZE * 0.82,
        fontSize * 1.38,
        align
      );
    }

    // Watermark
    ctx.shadowBlur   = 0;
    ctx.fillStyle    = "rgba(255,255,255,0.40)";
    ctx.font         = `500 ${Math.round(CANVAS_SIZE * 0.026)}px 'Poppins', sans-serif`;
    ctx.textAlign    = "right";
    ctx.shadowColor  = "rgba(0,0,0,0.5)";
    ctx.shadowBlur   = 6;
    ctx.fillText(WATERMARK, CANVAS_SIZE - 40, CANVAS_SIZE - 38);
    ctx.shadowBlur   = 0;
  }, [bgImg, themeIdx, displayText, color, font, fontSize, textX, textY, align]);

  useEffect(() => {
    document.fonts.ready.then(() => draw());
  }, [draw]);

  useEffect(() => {
    return () => {
      if (bgObjectUrlRef.current) {
        URL.revokeObjectURL(bgObjectUrlRef.current);
        bgObjectUrlRef.current = null;
      }
    };
  }, []);

  // ── Pointer → canvas coordinate ───────────────────────────────────────────
  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      cx: (clientX - r.left)  * (CANVAS_SIZE / r.width),
      cy: (clientY - r.top)   * (CANVAS_SIZE / r.height),
    };
  };

  const onPtrDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    if (Math.abs(cx - textX) < 240 && Math.abs(cy - textY) < 130) {
      dragging.current = true;
      dragOffset.current = { x: cx - textX, y: cy - textY };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  };
  const onPtrMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    setTextX(Math.max(80, Math.min(CANVAS_SIZE - 80, cx - dragOffset.current.x)));
    setTextY(Math.max(80, Math.min(CANVAS_SIZE - 80, cy - dragOffset.current.y)));
  };
  const onPtrUp = () => { dragging.current = false; };

  // ── Image upload ──────────────────────────────────────────────────────────
  const onImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    if (bgObjectUrlRef.current) URL.revokeObjectURL(bgObjectUrlRef.current);
    bgObjectUrlRef.current = objectUrl;
    img.onload = () => setBgImg(img);
    img.src    = objectUrl;
    e.target.value = "";
  };

  // ── Shuffle ───────────────────────────────────────────────────────────────
  const shuffle = () => {
    if (!pool.length) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQuote(q.text);
    setCustomText("");
  };

  // ── Get blob from canvas ──────────────────────────────────────────────────
  const getBlob = (): Promise<Blob> =>
    new Promise((res, rej) => {
      draw();
      canvasRef.current?.toBlob(
        (b) => (b ? res(b) : rej(new Error("Canvas empty"))),
        "image/jpeg",
        0.93
      );
    });

  // ── Post to FameFeed ──────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!displayText) return toast.error("Pehle koi quote select karo!");
    setPosting(true);
    try {
      const blob     = await getBlob();
      const fileName = `quotes/${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("posts")
        .upload(fileName, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(fileName);

      const payload = {
        author_id:  userId,
        author:     resolvedAuthor || null,
        content:    displayText,
        media_url:  urlData.publicUrl,
        type:       "image",
        media_type: "image",
        post_type:  "quote",
        visibility: "public",
      };

      const { error: dbErr } = await supabase.from("posts").insert(payload);
      if (dbErr) {
        console.error("[QuotesMaker] posts insert failed — payload:", payload, "error:", dbErr);
        throw dbErr;
      }

      toast.success("🎉 FameFeed pe post ho gaya!");
      onPostSuccess?.();
      onClose?.();
    } catch (err: any) {
      console.error("[QuotesMaker] handlePost error:", err);
      toast.error(err?.message ?? "Post nahi ho saka. Try again!");
    } finally {
      setPosting(false);
    }
  };

  // ── Post as 24-hr Story ───────────────────────────────────────────────────
  const handlePostStory = async () => {
    if (!displayText) return toast.error("Pehle koi quote select karo!");
    setPostingStory(true);
    try {
      const blob     = await getBlob();
      const ext      = "jpg";
      const fileName = `stories/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("stories").insert({
        user_id:    userId,
        image_url:  fileName,
        caption:    displayText,
        mood:       null,
        media_type: "image",
      });
      if (dbErr) throw dbErr;

      toast.success("📖 Story 24 ghante ke liye live ho gayi!");
      onClose?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Story post nahi ho saki. Try again!");
    } finally {
      setPostingStory(false);
    }
  };

  // ── Web Share / Download ──────────────────────────────────────────────────
  const handleShare = async () => {
    if (!displayText) return toast.error("Pehle koi quote select karo!");
    setSharing(true);
    try {
      const blob = await getBlob();
      const file = new File([blob], "flicks-quote.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Flicks India — Quote",
          text:  `${displayText}\n\n— flicksindia.online`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href = url; a.download = "flicks-quote.jpg"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Image download ho gayi!");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Share nahi ho saka");
    } finally {
      setSharing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#080012] overflow-hidden select-none">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
        style={{ background: "rgba(8,0,18,0.98)" }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 active:scale-90 transition-transform"
        >
          <X size={18} className="text-white" />
        </button>

        <span className="text-white font-black text-base tracking-wide">
          ✨ Quotes Maker
        </span>

        <button
          onClick={shuffle}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-800/60 active:scale-90 transition-transform"
          title="Random quote"
        >
          <Shuffle size={16} className="text-white" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-44">

        {/* Canvas preview */}
        <div className="px-3 pt-3 pb-2">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ aspectRatio: "1/1" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={onPtrDown}
              onPointerMove={onPtrMove}
              onPointerUp={onPtrUp}
              onPointerLeave={onPtrUp}
            />
            {!displayText && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white/30 text-sm font-semibold px-6 text-center">
                  Neeche Quote tab mein se koi quote choose karo
                </span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 pointer-events-none">
              <span className="bg-black/50 text-white/40 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                Drag to move text
              </span>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 px-3 pt-1 pb-2">
          {(["text", "design"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === s ? "bg-purple-700 text-white" : "bg-white/8 text-white/50"
              }`}
            >
              {s === "text" ? "📝 Quote" : "🎨 Design"}
            </button>
          ))}
        </div>

        {/* ── QUOTE TAB ── */}
        <AnimatePresence mode="wait">
          {tab === "text" && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="px-3 space-y-4"
            >
              {/* Category chips */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Category</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        category === cat
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {CATEGORY_EMOJI[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language toggle */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Language</p>
                <div className="flex gap-2">
                  {LANGS.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => setLang(l.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        lang === l.key
                          ? "bg-pink-700 text-white"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quote list dropdown */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">
                  Choose Quote ({pool.length} available)
                </p>
                <button
                  onClick={() => setShowList((p) => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-left"
                >
                  <span className="text-white/75 text-sm font-medium truncate pr-2 leading-snug">
                    {selectedQuote
                      ? selectedQuote.slice(0, 55) + (selectedQuote.length > 55 ? "…" : "")
                      : "Koi quote choose nahi hua"}
                  </span>
                  {showList
                    ? <ChevronUp size={16} className="text-white/40 shrink-0" />
                    : <ChevronDown size={16} className="text-white/40 shrink-0" />}
                </button>

                <AnimatePresence>
                  {showList && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-1"
                    >
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/6">
                        {pool.map((q) => (
                          <button
                            key={q.id}
                            onClick={() => {
                              setSelectedQuote(q.text);
                              setCustomText("");
                              setShowList(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm leading-snug transition-colors ${
                              selectedQuote === q.text
                                ? "bg-purple-900/60 text-white"
                                : "bg-white/4 text-white/65 active:bg-white/10"
                            }`}
                          >
                            <span className="line-clamp-2">{q.text}</span>
                            {selectedQuote === q.text && (
                              <Check size={12} className="inline ml-1.5 text-purple-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Custom text */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">
                  Ya Khud Likho
                </p>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Apna quote ya shayari yahan likho..."
                  rows={3}
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-sm resize-none outline-none placeholder:text-white/25 focus:border-purple-500/60 transition-colors leading-relaxed"
                />
                {customText && (
                  <button
                    onClick={() => setCustomText("")}
                    className="mt-1 text-xs text-white/30 hover:text-white/60"
                  >
                    Clear custom text
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── DESIGN TAB ── */}
          {tab === "design" && (
            <motion.div
              key="design"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="px-3 space-y-5"
            >
              {/* Cinematic themes */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">
                  Cinematic Themes
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => { setThemeIdx(i); setBgImg(null); }}
                      className={`rounded-xl overflow-hidden aspect-square flex flex-col items-start justify-end p-1.5 transition-all ${
                        themeIdx === i && !bgImg
                          ? "ring-2 ring-purple-400 ring-offset-1 ring-offset-black"
                          : "ring-1 ring-white/10"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${t.stops.join(", ")})`,
                      }}
                    >
                      <span className="text-white/70 text-[8px] font-bold leading-tight line-clamp-1">
                        {t.label}
                      </span>
                    </button>
                  ))}

                  {/* Upload custom BG */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className={`rounded-xl aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed transition-all ${
                      bgImg
                        ? "border-purple-400 ring-2 ring-purple-400 ring-offset-1 ring-offset-black bg-purple-900/20"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    <Upload size={20} className={bgImg ? "text-purple-300" : "text-white/50"} />
                    <span className="text-[9px] font-bold text-white/50">
                      {bgImg ? "Changed!" : "Upload"}
                    </span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImgUpload}
                  />
                </div>
                {bgImg && (
                  <button
                    onClick={() => setBgImg(null)}
                    className="mt-2 text-xs text-red-400/70 hover:text-red-400"
                  >
                    ✕ Remove uploaded image
                  </button>
                )}
              </div>

              {/* Font family */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Font</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFont(f.value)}
                      style={{ fontFamily: f.value }}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm transition-all ${
                        font === f.value
                          ? "bg-purple-700 text-white"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Font Size</p>
                  <span className="text-white/55 text-xs font-bold">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFontSize((p) => Math.max(32, p - 4))}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform shrink-0"
                  >
                    <Minus size={14} className="text-white" />
                  </button>
                  <input
                    type="range" min={32} max={120} value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <button
                    onClick={() => setFontSize((p) => Math.min(120, p + 4))}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform shrink-0"
                  >
                    <Plus size={14} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Text color */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Text Color</p>
                <div className="flex gap-2.5 flex-wrap">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-9 h-9 rounded-full border-2 transition-all active:scale-90 ${
                        color === c ? "border-white scale-110 shadow-lg" : "border-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                  {/* Custom color picker */}
                  <label
                    className="w-9 h-9 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center cursor-pointer relative overflow-hidden"
                    title="Custom color"
                  >
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{ background: !PALETTE.includes(color) ? color : "transparent" }}
                    />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="opacity-0 absolute w-0 h-0"
                    />
                    <span className="relative text-white/60 text-xs font-black">+</span>
                  </label>
                </div>
              </div>

              {/* Text alignment */}
              <div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Alignment</p>
                <div className="flex gap-2">
                  {(
                    [
                      { val: "left"   as CanvasTextAlign, Icon: AlignLeft   },
                      { val: "center" as CanvasTextAlign, Icon: AlignCenter },
                      { val: "right"  as CanvasTextAlign, Icon: AlignRight  },
                    ] as const
                  ).map(({ val, Icon }) => (
                    <button
                      key={val}
                      onClick={() => setAlign(val)}
                      className={`flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all ${
                        align === val ? "bg-purple-700 text-white" : "bg-white/10 text-white/50"
                      }`}
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom action bar (2-row) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 px-4 pt-3 pb-4 border-t border-white/10"
        style={{ background: "rgba(8,0,18,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* Row 1 — primary: Post to FameFeed */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handlePost}
          disabled={posting || !displayText}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white disabled:opacity-40 transition-all"
          style={{
            background: posting
              ? "rgba(100,40,160,0.5)"
              : "linear-gradient(135deg, #6600cc, #cc0066)",
          }}
        >
          {posting
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Send size={16} />}
          Post to FameFeed
        </motion.button>

        {/* Row 2 — secondary: Share + Post as Story */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleShare}
            disabled={sharing || !displayText}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-sm text-white border border-white/20 bg-white/8 disabled:opacity-40 transition-all"
          >
            {sharing
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Share2 size={14} />}
            Share
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handlePostStory}
            disabled={postingStory || !displayText}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-sm disabled:opacity-40 transition-all"
            style={{
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.35)",
              background: "rgba(167,139,250,0.10)",
            }}
          >
            {postingStory
              ? <span className="w-3.5 h-3.5 border-2 border-violet-400/40 border-t-violet-300 rounded-full animate-spin" />
              : <BookOpen size={14} />}
            Post Story
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default QuotesMaker;
