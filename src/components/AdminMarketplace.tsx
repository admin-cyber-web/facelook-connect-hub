import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, X, Loader2, Trash2,
  Image as ImageIcon, Store, Pencil, Check,
  Copy, Package, RefreshCw, Phone, MapPin,
  User, CreditCard, Palette,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
/**
 * UPDATE THESE to your actual PhonePe UPI ID.
 * The QR image at /phonepay-qr.jpg is already embedded.
 */
const PHONEPAY_UPI_ID = "manoj@ybl";
const PHONEPAY_QR_PATH = "/phonepay-qr.jpg";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MarketplaceItem {
  id: string;
  title: string;
  description?: string | null;
  price?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  badge?: string | null;
  is_active: boolean;
  created_at: string;
  sizes?: string | null;   // comma-separated e.g. "S,M,L,XL"
  colors?: string | null;  // comma-separated e.g. "Red,Blue,Black"
}

export interface MarketplaceOrder {
  id: string;
  tracking_code: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  phone?: string | null;
  address?: string | null;
  item_id?: string | null;
  item_title: string;
  item_price?: string | null;
  selected_size?: string | null;
  selected_color?: string | null;
  payment_method: string;
  utr_id?: string | null;
  status: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genTrackingCode(): string {
  return `#FLICKS-${Math.floor(10000 + Math.random() * 90000)}`;
}

function formatOrderTime(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  Pending:   "#f59e0b",
  Confirmed: "#00F0FF",
  Shipped:   "#a78bfa",
  Delivered: "#4ade80",
};

// ═════════════════════════════════════════════════════════════════════════════
// ── Checkout Drawer ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function CheckoutDrawer({
  item,
  onClose,
  onSuccess,
}: {
  item: MarketplaceItem;
  onClose: () => void;
  onSuccess: (order: MarketplaceOrder) => void;
}) {
  const [name,          setName]          = useState("");
  const [phone,         setPhone]         = useState("");
  const [address,       setAddress]       = useState("");
  const [selectedSize,  setSelectedSize]  = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "UPI">("COD");
  const [utrId,         setUtrId]         = useState("");
  const [placing,       setPlacing]       = useState(false);
  const [upiCopied,     setUpiCopied]     = useState(false);

  const sizes  = item.sizes  ? item.sizes.split(",").map(s => s.trim()).filter(Boolean)  : [];
  const colors = item.colors ? item.colors.split(",").map(c => c.trim()).filter(Boolean) : [];

  // Pre-fill name from auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const n = data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "";
        setName(n);
      }
    });
  }, []);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(PHONEPAY_UPI_ID);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2500);
    } catch {
      toast.success(`UPI ID: ${PHONEPAY_UPI_ID}`);
    }
  };

  const placeOrder = async () => {
    if (!name.trim())    { toast.error("Please enter your name");             return; }
    if (!phone.trim())   { toast.error("Please enter your phone number");     return; }
    if (!address.trim()) { toast.error("Please enter your delivery address"); return; }
    if (sizes.length  > 0 && !selectedSize)  { toast.error("Please select a size");  return; }
    if (colors.length > 0 && !selectedColor) { toast.error("Please select a color"); return; }
    if (paymentMethod === "UPI" && !utrId.trim()) {
      toast.error("Enter your UPI Transaction ID / UTR after paying"); return;
    }
    setPlacing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        tracking_code:  genTrackingCode(),
        user_id:        user?.id        ?? null,
        user_email:     user?.email     ?? null,
        user_name:      name.trim(),
        phone:          phone.trim(),
        address:        address.trim(),
        item_id:        item.id,
        item_title:     item.title,
        item_price:     item.price      ?? null,
        selected_size:  selectedSize    || null,
        selected_color: selectedColor   || null,
        payment_method: paymentMethod,
        utr_id:         utrId.trim()    || null,
        status:         "Pending",
      };
      const { data, error } = await supabase
        .from("marketplace_orders")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      onSuccess(data as MarketplaceOrder);
    } catch {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: "#0d0e16",
          maxHeight: "94dvh",
          borderTop: "1px solid rgba(255,255,255,0.09)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag size={15} className="text-[#00F0FF]" />
            <span className="text-white font-black text-[15px]">Checkout</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-5 py-4 space-y-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
        >
          {/* Product preview */}
          <div
            className="flex gap-3 p-3 rounded-2xl border border-white/[0.07]"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {item.image_url ? (
              <img
                src={item.image_url} alt={item.title}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-white/25" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-[13px] leading-tight">{item.title}</p>
              {item.description && (
                <p className="text-white/40 text-[11px] mt-0.5 line-clamp-2">{item.description}</p>
              )}
              {item.price && (
                <p className="text-[#00F0FF] font-black text-[15px] mt-1">{item.price}</p>
              )}
            </div>
          </div>

          {/* Size picker */}
          {sizes.length > 0 && (
            <div>
              <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">
                Size
              </label>
              <div className="flex flex-wrap gap-2">
                {sizes.map(s => (
                  <button
                    key={s} onClick={() => setSelectedSize(s)}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-black border transition-all active:scale-95"
                    style={selectedSize === s
                      ? { background: "rgba(0,240,255,0.15)", borderColor: "#00F0FF", color: "#00F0FF" }
                      : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color picker */}
          {colors.length > 0 && (
            <div>
              <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Palette size={10} /> Color
              </label>
              <div className="flex flex-wrap gap-2">
                {colors.map(c => (
                  <button
                    key={c} onClick={() => setSelectedColor(c)}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-black border transition-all active:scale-95"
                    style={selectedColor === c
                      ? { background: "rgba(0,240,255,0.15)", borderColor: "#00F0FF", color: "#00F0FF" }
                      : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery details */}
          <div>
            <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
              <User size={10} /> Delivery Details
            </label>
            <div className="space-y-2.5">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full Name *"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
              </div>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Phone Number *" type="tel"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
              </div>
              <div className="relative">
                <MapPin size={13} className="absolute left-3 top-3.5 text-white/25 pointer-events-none" />
                <textarea
                  value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="Delivery Address (House/Flat, Street, City, PIN) *"
                  rows={2}
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40 resize-none"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
              <CreditCard size={10} /> Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ["COD", "Cash on Delivery", "💵"],
                  ["UPI", "PhonePe / UPI",    "📲"],
                ] as const
              ).map(([val, label, emoji]) => (
                <button
                  key={val} onClick={() => setPaymentMethod(val)}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95"
                  style={paymentMethod === val
                    ? { background: "rgba(0,240,255,0.08)", borderColor: "#00F0FF" }
                    : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span
                    className="text-[11px] font-black leading-tight text-center"
                    style={{ color: paymentMethod === val ? "#00F0FF" : "rgba(255,255,255,0.45)" }}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* PhonePe QR section — only when UPI selected */}
          <AnimatePresence>
            {paymentMethod === "UPI" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-2xl border border-white/[0.08] overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  {/* Instructions */}
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-white font-black text-[13px] mb-0.5">Scan & Pay via PhonePe</p>
                    <p className="text-white/40 text-[11px]">
                      Open PhonePe → Scan QR → Pay → Enter Transaction ID below
                    </p>
                  </div>

                  {/* QR image */}
                  <div className="flex justify-center py-5 px-4">
                    <div
                      className="rounded-2xl overflow-hidden border-4 border-white/10"
                      style={{ background: "#fff", padding: 8 }}
                    >
                      <img
                        src={PHONEPAY_QR_PATH}
                        alt="PhonePe QR Code — manoj kumar"
                        className="w-52 h-auto block"
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  </div>

                  {/* UPI ID copy button */}
                  <div className="px-4 pb-4 space-y-3">
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 border border-white/[0.08]"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-[9px] text-white/30 font-black uppercase tracking-wider">UPI ID</p>
                        <p className="text-[13px] text-white font-bold font-mono truncate">{PHONEPAY_UPI_ID}</p>
                      </div>
                      <button
                        onClick={copyUpi}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95"
                        style={upiCopied
                          ? { background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                          : { background: "rgba(0,240,255,0.1)", color: "#00F0FF", border: "1px solid rgba(0,240,255,0.2)" }}
                      >
                        {upiCopied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                      </button>
                    </div>

                    {/* UTR input */}
                    <div>
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider mb-1.5 block">
                        UPI Transaction ID / UTR *
                      </label>
                      <input
                        value={utrId} onChange={e => setUtrId(e.target.value)}
                        placeholder="Enter Transaction ID after paying"
                        className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/25 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      />
                      <p className="text-[10px] text-white/25 mt-1">
                        PhonePe → History → select payment → Transaction ID
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Place Order button */}
        <div
          className="shrink-0 px-5 py-4 border-t border-white/[0.06]"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            background: "#0d0e16",
          }}
        >
          <button
            onClick={placeOrder} disabled={placing}
            className="w-full py-4 rounded-2xl text-black font-black text-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
          >
            {placing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
            {placing ? "Placing Order…" : "Place Order"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Order Success Modal ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function OrderSuccessModal({
  order,
  onClose,
}: {
  order: MarketplaceOrder;
  onClose: () => void;
}) {
  const summaryRows = [
    ["Product",  order.item_title],
    ...(order.selected_size  ? [["Size",  order.selected_size]]  : []),
    ...(order.selected_color ? [["Color", order.selected_color]] : []),
    ["Price",    order.item_price    || "—"],
    ["Payment",  order.payment_method === "UPI" ? "PhonePe UPI" : "Cash on Delivery"],
    ["Status",   "Pending Confirmation"],
  ] as [string, string][];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[700] bg-black/85 backdrop-blur-md flex items-center justify-center p-5"
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#0d0e1a,#111325)",
          border: "1px solid rgba(0,240,255,0.14)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,240,255,0.06) inset",
        }}
      >
        {/* Animated success header */}
        <div
          className="flex flex-col items-center pt-9 pb-6 px-6"
          style={{ background: "linear-gradient(180deg,rgba(0,240,255,0.07),transparent)" }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1] }}
            transition={{ delay: 0.12, duration: 0.55, times: [0, 0.6, 1] }}
            className="w-18 h-18 rounded-full flex items-center justify-center mb-4"
            style={{
              width: 72, height: 72,
              background: "linear-gradient(135deg,rgba(0,240,255,0.15),rgba(37,99,235,0.15))",
              border: "2px solid rgba(0,240,255,0.4)",
            }}
          >
            <Check size={30} className="text-[#00F0FF]" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="text-white font-black text-[22px] text-center leading-tight"
          >
            Order Placed! 🎉
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
            className="text-white/40 text-[12px] text-center mt-1.5 leading-snug"
          >
            Thank you for your order on Flicks India!
          </motion.p>
        </div>

        {/* Tracking code */}
        <div
          className="mx-5 mb-4 rounded-2xl px-4 py-4 text-center"
          style={{
            background: "rgba(0,240,255,0.07)",
            border: "1px solid rgba(0,240,255,0.2)",
          }}
        >
          <p className="text-[10px] font-black text-[#00F0FF] uppercase tracking-widest mb-1.5">
            Your Tracking Code
          </p>
          <p className="text-white font-black text-[24px] tracking-widest">{order.tracking_code}</p>
          <p className="text-white/25 text-[10px] mt-1">Save this code to track your order</p>
        </div>

        {/* Order summary */}
        <div
          className="mx-5 mb-5 rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)" }}
        >
          {summaryRows.map(([label, value], i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
            >
              <span className="text-white/35 text-[11px] font-bold shrink-0">{label}</span>
              <span className="text-white text-[12px] font-black truncate max-w-[58%] text-right ml-3">{value}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-6 flex flex-col gap-2">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-black font-black text-[14px] active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
          >
            Return to Feed
          </button>
          {order.phone && (
            <p className="text-center text-white/22 text-[10px] leading-snug">
              We'll confirm via{" "}
              <span className="text-white/35">{order.phone}</span>
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Feed Card — shown inline in FameFeed every N posts ───────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export function MarketplaceFeedCard({ items }: { items: MarketplaceItem[] }) {
  const active = items.filter(i => i.is_active);
  if (active.length === 0) return null;

  const [checkoutItem,  setCheckoutItem]  = useState<MarketplaceItem | null>(null);
  const [successData,   setSuccessData]   = useState<{ order: MarketplaceOrder; item: MarketplaceItem } | null>(null);

  return (
    <>
      <div
        className="w-full border-b border-white/[0.06]"
        style={{ background: "rgba(10,8,18,0.95)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <Store size={13} className="text-[#00F0FF]" />
            <span className="text-[11px] font-black text-[#00F0FF] uppercase tracking-widest">
              Flicks Marketplace
            </span>
          </div>
          <span className="text-[9px] font-black text-white/25 uppercase tracking-widest border border-white/10 px-2 py-0.5 rounded-full">
            Official
          </span>
        </div>

        {/* Horizontal product strip */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-3 no-scrollbar scroll-smooth">
          {active.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="flex-shrink-0 rounded-2xl overflow-hidden border border-white/[0.08] cursor-pointer active:scale-95 transition-transform"
              style={{ width: 148, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)" }}
              onClick={() => setCheckoutItem(item)}
            >
              {/* Image */}
              <div className="w-full relative" style={{ height: 130, background: "rgba(255,255,255,0.06)" }}>
                {item.image_url ? (
                  <img
                    src={item.image_url} alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy" decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={32} className="text-white/20" />
                  </div>
                )}
                {item.badge && (
                  <span
                    className="absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full text-black"
                    style={{
                      background:
                        item.badge === "Sale" ? "#ff5d5d"
                        : item.badge === "Hot" ? "#f59e0b"
                        : "#00F0FF",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-[12px] font-black text-white leading-tight line-clamp-2 mb-1">
                  {item.title}
                </p>
                {item.price && (
                  <p className="text-[13px] font-black text-[#00F0FF]">{item.price}</p>
                )}
                <div
                  className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 rounded-xl text-[10px] font-black text-black"
                  style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
                >
                  <ShoppingBag size={10} />
                  Shop Now
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Checkout drawer — portalled to body to escape willChange:transform stacking context */}
      {createPortal(
        <AnimatePresence>
          {checkoutItem && (
            <CheckoutDrawer
              item={checkoutItem}
              onClose={() => setCheckoutItem(null)}
              onSuccess={(order) => {
                setCheckoutItem(null);
                setSuccessData({ order, item: checkoutItem });
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Success modal — portalled to body */}
      {createPortal(
        <AnimatePresence>
          {successData && (
            <OrderSuccessModal
              order={successData.order}
              onClose={() => setSuccessData(null)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Admin Marketplace Panel ───────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const BADGE_OPTIONS = ["", "New", "Sale", "Hot"];

interface AdminMarketplacePanelProps {
  onClose: () => void;
}

export function AdminMarketplacePanel({ onClose }: AdminMarketplacePanelProps) {
  const [panelTab, setPanelTab] = useState<"products" | "orders">("products");

  // ── Products state ──────────────────────────────────────────────────────────
  const [items,        setItems]        = useState<MarketplaceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [editItem,     setEditItem]     = useState<MarketplaceItem | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = {
    title: "", description: "", price: "", image_url: "",
    link_url: "", badge: "", sizes: "", colors: "",
  };
  const [form, setForm] = useState(emptyForm);

  // ── Orders state ────────────────────────────────────────────────────────────
  const [orders,           setOrders]           = useState<MarketplaceOrder[]>([]);
  const [loadingOrders,    setLoadingOrders]    = useState(false);
  const [updatingOrderId,  setUpdatingOrderId]  = useState<string | null>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    setLoadingItems(true);
    const { data } = await supabase
      .from("marketplace_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoadingItems(false);
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from("marketplace_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data ?? []);
    setLoadingOrders(false);
  };

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => { if (panelTab === "orders") fetchOrders(); }, [panelTab]);

  // ── Product CRUD ────────────────────────────────────────────────────────────
  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (item: MarketplaceItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      price: item.price ?? "",
      image_url: item.image_url ?? "",
      link_url: item.link_url ?? "",
      badge: item.badge ?? "",
      sizes: item.sizes ?? "",
      colors: item.colors ?? "",
    });
    setShowForm(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `marketplace/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, { upsert: true });
    if (error) { toast.error("Image upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    setForm(f => ({ ...f, image_url: publicUrl }));
    setUploading(false);
  };

  const saveItem = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title:       form.title.trim(),
      description: form.description.trim() || null,
      price:       form.price.trim()       || null,
      image_url:   form.image_url.trim()   || null,
      link_url:    form.link_url.trim()    || null,
      badge:       form.badge              || null,
      is_active:   true,
      sizes:       form.sizes.trim()       || null,
      colors:      form.colors.trim()      || null,
    };
    let error;
    if (editItem) {
      ({ error } = await supabase.from("marketplace_items").update(payload).eq("id", editItem.id));
      if (error) toast.error("Update failed"); else toast.success("Item updated!");
    } else {
      ({ error } = await supabase.from("marketplace_items").insert([payload]));
      if (error) toast.error("Save failed"); else toast.success("Item added to marketplace!");
    }
    setSaving(false);
    if (!error) { setShowForm(false); fetchItems(); }
  };

  const toggleActive = async (item: MarketplaceItem) => {
    await supabase.from("marketplace_items").update({ is_active: !item.is_active }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  };

  const deleteItem = async (id: string) => {
    await supabase.from("marketplace_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Item removed");
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    await supabase.from("marketplace_orders").update({ status }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    setUpdatingOrderId(null);
    toast.success("Order status updated");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="w-full max-w-lg rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col"
          style={{ background: "#0d0e16", maxHeight: "92dvh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-2">
              <Store size={16} className="text-[#00F0FF]" />
              <span className="text-white font-black text-[15px]">Admin Marketplace</span>
            </div>
            <div className="flex items-center gap-2">
              {panelTab === "products" && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1 text-[11px] font-black text-black px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
                  style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
                >
                  <Plus size={12} /> Add Item
                </button>
              )}
              {panelTab === "orders" && (
                <button
                  onClick={fetchOrders}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 active:scale-90"
                >
                  <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 px-5 pt-2 pb-3 shrink-0">
            {([["products", "🛍 Products"], ["orders", "📦 Orders"]] as const).map(([tab, label]) => (
              <button
                key={tab} onClick={() => setPanelTab(tab)}
                className="flex-1 py-2 rounded-xl text-[12px] font-black transition-all active:scale-95"
                style={panelTab === tab
                  ? { background: "rgba(0,240,255,0.12)", color: "#00F0FF", border: "1px solid rgba(0,240,255,0.25)" }
                  : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Products tab ── */}
          {panelTab === "products" && (
            <div
              className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            >
              {loadingItems ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-[#00F0FF]" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-white/25">
                  <Store size={36} className="mb-3 opacity-40" />
                  <p className="text-sm font-black uppercase tracking-widest">No items yet</p>
                  <p className="text-[11px] mt-1">Tap "Add Item" to post your first product</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div
                        className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-white/[0.07]"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        {item.image_url
                          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          : <ShoppingBag size={20} className="text-white/25" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-white truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {item.price && <span className="text-[11px] font-black text-[#00F0FF]">{item.price}</span>}
                          {item.badge && (
                            <span
                              className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-black"
                              style={{ background: item.badge === "Sale" ? "#ff5d5d" : item.badge === "Hot" ? "#f59e0b" : "#00F0FF" }}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.sizes && <span className="text-[9px] text-white/25">{item.sizes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => toggleActive(item)}
                          className="text-[10px] font-black px-2.5 py-1 rounded-lg border transition-colors"
                          style={item.is_active
                            ? { background: "rgba(0,240,255,0.12)", borderColor: "rgba(0,240,255,0.3)", color: "#00F0FF" }
                            : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}
                        >
                          {item.is_active ? "Live" : "Off"}
                        </button>
                        <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 text-white/40 active:scale-90">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => deleteItem(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-500/20 text-red-400 active:scale-90">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Orders tab ── */}
          {panelTab === "orders" && (
            <div
              className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            >
              {loadingOrders ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-[#00F0FF]" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-white/25">
                  <Package size={36} className="mb-3 opacity-40" />
                  <p className="text-sm font-black uppercase tracking-widest">No orders yet</p>
                  <p className="text-[11px] mt-1">Orders appear here when users buy products</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {orders.map(order => (
                    <div key={order.id} className="px-5 py-4">
                      {/* Tracking code + status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-black text-white">{order.tracking_code}</span>
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={e => updateOrderStatus(order.id, e.target.value)}
                          className="text-[10px] font-black rounded-lg px-2 py-1 border outline-none cursor-pointer"
                          style={{
                            background: "#1a1b2a",
                            color: STATUS_COLORS[order.status] || "#fff",
                            borderColor: `${STATUS_COLORS[order.status] || "rgba(255,255,255,0.1)"}55`,
                          }}
                        >
                          {["Pending", "Confirmed", "Shipped", "Delivered"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Product + price */}
                      <p className="text-[12px] text-white/80 font-bold truncate mb-2">
                        {order.item_title}{order.item_price ? ` — ${order.item_price}` : ""}
                      </p>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-2">
                        <span className="text-white/30">Customer</span>
                        <span className="text-white/60 truncate">{order.user_name || "—"}</span>
                        <span className="text-white/30">Phone</span>
                        <span className="text-white/60">{order.phone || "—"}</span>
                        {order.selected_size && (
                          <><span className="text-white/30">Size</span><span className="text-white/60">{order.selected_size}</span></>
                        )}
                        {order.selected_color && (
                          <><span className="text-white/30">Color</span><span className="text-white/60">{order.selected_color}</span></>
                        )}
                        <span className="text-white/30">Payment</span>
                        <span className="text-white/60">{order.payment_method === "UPI" ? "PhonePe UPI" : "Cash on Delivery"}</span>
                        {order.utr_id && (
                          <><span className="text-white/30">UTR</span><span className="text-white/60 font-mono truncate">{order.utr_id}</span></>
                        )}
                      </div>

                      {/* Address + time */}
                      {order.address && (
                        <p className="text-[10px] text-white/28 line-clamp-1">{order.address}</p>
                      )}
                      <p className="text-[9px] text-white/20 mt-1">{formatOrderTime(order.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Add / Edit form sheet ── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[510] bg-black/70 backdrop-blur-sm flex items-end justify-center"
              onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
            >
              <motion.div
                initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 32 }}
                className="w-full max-w-lg rounded-t-3xl border-t border-white/10 overflow-hidden flex flex-col"
                style={{ background: "#0d0e16", maxHeight: "95dvh" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Form header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-white/[0.07] shrink-0">
                  <span className="text-white font-black text-[15px]">{editItem ? "Edit Item" : "Add Product"}</span>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 text-white/50 active:scale-90">
                    <X size={16} />
                  </button>
                </div>

                {/* Scrollable fields — padded so last element is reachable on mobile */}
                <div
                  className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-5 py-4 space-y-4"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}
                >
                  {/* Image */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">
                      Product Image
                    </label>
                    <div
                      className="w-full h-36 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer active:bg-white/5 transition-colors relative overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {form.image_url ? (
                        <>
                          <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-[11px] font-black text-white/70">Tap to change</span>
                          </div>
                        </>
                      ) : uploading ? (
                        <Loader2 size={22} className="animate-spin text-[#00F0FF]" />
                      ) : (
                        <>
                          <ImageIcon size={22} className="text-white/25 mb-1" />
                          <span className="text-[11px] text-white/30">Tap to upload</span>
                        </>
                      )}
                    </div>
                    <input
                      ref={imageInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
                    />
                    <p className="text-[10px] text-white/25 mt-1">Or paste an image URL:</p>
                    <input
                      value={form.image_url}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full mt-1 rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">Product Name *</label>
                    <input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Premium Sports Shoes"
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">Short Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Comfortable, durable, stylish..." rows={2}
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40 resize-none"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>

                  {/* Price + Badge */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">Price</label>
                      <input
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="₹499"
                        className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">Badge</label>
                      <select
                        value={form.badge}
                        onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                        style={{ background: "#1a1b2a" }}
                      >
                        {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b || "None"}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Sizes */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">
                      Sizes (comma-separated)
                    </label>
                    <input
                      value={form.sizes}
                      onChange={e => setForm(f => ({ ...f, sizes: e.target.value }))}
                      placeholder="e.g. S,M,L,XL  or  7,8,9,10"
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                    <p className="text-[10px] text-white/20 mt-1">Leave blank for no size picker</p>
                  </div>

                  {/* Colors */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">
                      Colors (comma-separated)
                    </label>
                    <input
                      value={form.colors}
                      onChange={e => setForm(f => ({ ...f, colors: e.target.value }))}
                      placeholder="e.g. Black,White,Red"
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                    <p className="text-[10px] text-white/20 mt-1">Leave blank for no color picker</p>
                  </div>

                  {/* Buy Link (optional) */}
                  <div>
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-wider mb-2 block">
                      External Buy Link (optional)
                    </label>
                    <input
                      value={form.link_url}
                      onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none border border-white/[0.08] focus:border-[#00F0FF]/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>

                  {/* Save button — inside scroll area, always reachable */}
                  <button
                    onClick={saveItem}
                    disabled={saving || !form.title.trim()}
                    className="w-full py-4 rounded-2xl text-black font-black text-[14px] disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#00F0FF,#2563eb)" }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
                    {editItem ? "Save Changes" : "Add to Marketplace"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
