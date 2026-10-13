import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, ClipboardList, Copy, CreditCard,
  Image as ImageIcon, Loader2, MapPin, Package, Pencil, Plus, RefreshCw,
  Share2, ShoppingBag, Store, Trash2, User, X, Palette, Ruler, Truck, Phone, Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { subscribeWhileVisible } from "../lib/realtimeVisibility";
import { OrderRouteMap } from "./OrderRouteMap";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const PHONEPAY_UPI_ID = "manoj@ybl";
const PHONEPAY_QR_PATH = "/phonepay-qr.jpg";
const BLUE = "#1457A6";
const RED = "#8B1E2D";
const SHIPPING_STATUSES = [
  "Verification Pending", "Pending", "Confirmed", "Packed", "Shipped", "In Transit",
  "At Regional Hub", "Out for Delivery", "Delivered",
] as const;
const SHIPPED_ORDER_STATUSES = new Set(["Shipped", "In Transit", "At Regional Hub", "Out for Delivery", "Delivered"]);
const STATUS_COLORS: Record<string, string> = {
  "Verification Pending": "#9A6411", Pending: "#9A6411", Confirmed: "#1457A6", Packed: "#1457A6", Shipped: "#1457A6",
  "In Transit": "#1457A6", "At Regional Hub": "#8B1E2D", Cancelled: "#8B1E2D",
  "Out for Delivery": "#8B1E2D", Delivered: "#2F7651",
};
const BADGE_OPTIONS = ["", "New", "Sale", "Hot"];

export interface MarketplaceColorVariant {
  name: string;
  imageUrl: string;
}

export interface MarketplaceItemAttributes {
  category?: string;
  material?: string;
  volumeOptions?: string[];
  weight?: string | number;
  dimensions?: { length?: string | number; width?: string | number; height?: string | number; unit?: string };
  colorVariants?: MarketplaceColorVariant[];
  pricing?: {
    originalPrice?: number | null;
    discountedPrice?: number | null;
    discountPercent?: number | null;
    offerTagline?: string;
  };
  stockQuantity?: number | null;
}

export interface SellerDetails {
  shopName?: string | null;
  pickupAddress?: string | null;
  city?: string | null;
  pincode?: string | null;
  contactNumber?: string | null;
}

interface MarketplaceSellerDetailsRow {
  item_id: string;
  shop_name?: string | null;
  pickup_address?: string | null;
  city?: string | null;
  pincode?: string | null;
  contact_number?: string | null;
}

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
  sizes?: string | null;
  colors?: string | null;
  source_city?: string | null;
  attributes?: MarketplaceItemAttributes | Record<string, unknown> | null;
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
  item_image_url?: string | null;
  item_details?: string | null;
  item_title: string;
  item_price?: string | null;
  selected_size?: string | null;
  selected_volume?: string | null;
  selected_color?: string | null;
  payment_method: string;
  utr_id?: string | null;
  status: string;
  source_city?: string | null;
  destination_city?: string | null;
  current_location?: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  estimated_delivery_at?: string | null;
  created_at: string;
}

type VariantSelection = { size: string; volume: string; color: string };

function isUpiAwaitingVerification(order: Pick<MarketplaceOrder, "payment_method" | "status">): boolean {
  return order.payment_method === "UPI" && ["Verification Pending", "Pending"].includes(order.status);
}

function canCancelMarketplaceOrder(order: Pick<MarketplaceOrder, "status">): boolean {
  return order.status !== "Cancelled" && !SHIPPED_ORDER_STATUSES.has(order.status);
}

const TRACKING_MILESTONES = [
  { title: "Order Dispatch", icon: "📦", etaOffsetDays: 3 },
  { title: "In Transit", icon: "🚚", etaOffsetDays: 2 },
  { title: "Hub Arrived", icon: "🏬", etaOffsetDays: 1 },
  { title: "Out for Delivery", icon: "🏠", etaOffsetDays: 0 },
] as const;

function getTrackingMilestoneIndex(status: string): number {
  switch (status) {
    case "Packed": return 0;
    case "Shipped": return 1;
    case "In Transit": return 1;
    case "At Regional Hub": return 2;
    case "Out for Delivery": return 3;
    case "Delivered": return 4;
    default: return -1;
  }
}

function formatMilestoneEstimate(estimatedDeliveryAt: string | null | undefined, milestoneIndex: number): string {
  if (!estimatedDeliveryAt) return "ETA not set";
  const eta = new Date(estimatedDeliveryAt);
  if (Number.isNaN(eta.getTime())) return "ETA not set";
  eta.setDate(eta.getDate() - TRACKING_MILESTONES[milestoneIndex].etaOffsetDays);
  return `Est. ${new Intl.DateTimeFormat("en-IN", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(eta)}`;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function requestMarketplaceOrderCancellation(orderId: string) {
  return supabase.rpc("cancel_marketplace_order", { p_order_id: orderId });
}

function genTrackingCode(): string {
  return `#FLICKS-${Math.floor(10000 + Math.random() * 90000)}`;
}

function formatOrderTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getAttributes(item: MarketplaceItem): MarketplaceItemAttributes {
  let raw: unknown = item.attributes;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = {}; }
  }
  return raw && typeof raw === "object" ? raw as MarketplaceItemAttributes : {};
}

function itemSizes(item: MarketplaceItem): string[] {
  return (item.sizes ?? "").split(",").map(value => value.trim()).filter(Boolean);
}

function itemVolumes(item: MarketplaceItem): string[] {
  const volumes = getAttributes(item).volumeOptions;
  return Array.isArray(volumes) ? volumes.filter(value => typeof value === "string" && value.trim()) : [];
}

function itemColors(item: MarketplaceItem): string[] {
  const mapped = getAttributes(item).colorVariants?.map(color => color.name).filter(Boolean) ?? [];
  return mapped.length ? mapped : (item.colors ?? "").split(",").map(value => value.trim()).filter(Boolean);
}

function itemImage(item: MarketplaceItem, color?: string): string | null {
  const variant = getAttributes(item).colorVariants?.find(entry => entry.name === color);
  return variant?.imageUrl?.trim() || item.image_url || null;
}

function productSpecificationRows(
  item: MarketplaceItem,
  selection: Partial<VariantSelection> = {},
): [string, string][] {
  const attrs = getAttributes(item);
  const sizes = itemSizes(item);
  const volumes = itemVolumes(item);
  const colors = itemColors(item);
  const rows: [string, string][] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value != null && String(value).trim()) rows.push([label, String(value)]);
  };

  add("Color", selection.color || (colors.length ? colors.join(", ") : null));
  add("Size", selection.size || (sizes.length ? sizes.join(", ") : null));
  add("Weight", attrs.weight);
  add("Volume / capacity", selection.volume || (volumes.length ? volumes.join(", ") : null));

  const dimensions = attrs.dimensions;
  const dimensionValues = [dimensions?.length, dimensions?.width, dimensions?.height];
  if (dimensionValues.some(value => value != null && String(value).trim())) {
    rows.push([
      "Dimensions",
      `${dimensionValues.map(value => value == null || !String(value).trim() ? "—" : String(value)).join(" × ")}${dimensions?.unit ? ` ${dimensions.unit}` : ""}`,
    ]);
  }
  add("Material", attrs.material);
  add("Category", attrs.category);
  if (attrs.stockQuantity != null) {
    rows.push(["Availability", Number(attrs.stockQuantity) > 0 ? `${attrs.stockQuantity} in stock` : "Currently unavailable"]);
  }
  add("Shipping origin", item.source_city);
  return rows;
}

function ProductSpecifications({
  item, selection,
}: {
  item: MarketplaceItem;
  selection?: Partial<VariantSelection>;
}) {
  const rows = productSpecificationRows(item, selection);
  return (
    <section data-testid="product-specifications" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">Product specifications</h3>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {(rows.length ? rows : [["Specifications", "Not provided"] as [string, string]]).map(([label, value], index) => (
            <tr key={label} className={index < rows.length - 1 ? "border-b border-slate-200" : ""}>
              <th scope="row" className="w-[38%] border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">{label}</th>
              <td className="px-3 py-2 font-medium text-slate-800">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function displayPrice(item: MarketplaceItem): string {
  const pricing = getAttributes(item).pricing;
  if (pricing?.discountedPrice != null && Number.isFinite(Number(pricing.discountedPrice))) {
    return `₹${Number(pricing.discountedPrice).toLocaleString("en-IN")}`;
  }
  return item.price || "Price on request";
}

function shareUrl(item: MarketplaceItem): string {
  const url = new URL(window.location.href);
  url.searchParams.set("marketplace_item", item.id);
  return url.toString();
}

async function shareProduct(item: MarketplaceItem): Promise<void> {
  const url = shareUrl(item);
  const image = item.image_url || itemImage(item) || "";
  const price = displayPrice(item);
  const text = `${item.title} · ${price}${image ? `\nProduct image: ${image}` : ""}\nBuy on Famefeed: ${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: item.title, text, url });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Product link copied");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Product details copied");
    } catch {
      toast.error("Could not share this product");
    }
  }
}

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const fieldLabel = "mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-slate-500";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1457A6] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0D478E] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50";

function VariantButtons({
  label, values, selected, onSelect, testPrefix,
}: {
  label: string; values: string[]; selected: string; onSelect: (value: string) => void; testPrefix: string;
}) {
  if (!values.length) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-slate-600">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map(value => (
          <button
            key={value} type="button" aria-pressed={selected === value}
            data-testid={`${testPrefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            onClick={() => onSelect(value)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${selected === value ? "border-[#1457A6] bg-blue-50 text-[#1457A6] ring-1 ring-blue-200" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}
          >{value}</button>
        ))}
      </div>
    </fieldset>
  );
}

function CheckoutDrawer({
  item, onClose, onSuccess, initialSelection,
}: {
  item: MarketplaceItem; onClose: () => void; onSuccess: (order: MarketplaceOrder) => void;
  initialSelection: VariantSelection;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [selectedSize, setSelectedSize] = useState(initialSelection.size);
  const [selectedVolume, setSelectedVolume] = useState(initialSelection.volume);
  const [selectedColor, setSelectedColor] = useState(initialSelection.color);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "UPI">("COD");
  const [utrId, setUtrId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const authUserRef = useRef<SupabaseUser | null>(null);
  const authUserReadyRef = useRef<ReturnType<typeof supabase.auth.getUser> | null>(null);
  const sizes = itemSizes(item);
  const volumes = itemVolumes(item);
  const colors = itemColors(item);

  useEffect(() => {
    const request = supabase.auth.getUser();
    authUserReadyRef.current = request;
    request.then(({ data }) => {
      authUserRef.current = data.user ?? null;
      if (data.user) setName(data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "");
    });
  }, []);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(PHONEPAY_UPI_ID);
      setUpiCopied(true);
      window.setTimeout(() => setUpiCopied(false), 2200);
    } catch { toast.success(`UPI ID: ${PHONEPAY_UPI_ID}`); }
  };

  const placeOrder = async () => {
    const sourceCity = item.source_city?.trim();
    if (!sourceCity) { toast.error("This product needs a shipping source city before it can be ordered"); return; }
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) { toast.error("Please enter a valid phone number"); return; }
    if (!address.trim()) { toast.error("Please enter your delivery address"); return; }
    if (!destinationCity.trim()) { toast.error("Please enter your delivery city"); return; }
    if (sizes.length && !selectedSize) { toast.error("Please select a size"); return; }
    if (volumes.length && !selectedVolume) { toast.error("Please select a volume or capacity"); return; }
    if (colors.length && !selectedColor) { toast.error("Please select a color"); return; }
    if (paymentMethod === "UPI" && !utrId.trim()) { toast.error("Enter your UPI Transaction ID / UTR after paying"); return; }
    setPlacing(true);
    try {
      const user = authUserRef.current ?? (await authUserReadyRef.current)?.data?.user ?? null;
      const payload = {
        tracking_code: genTrackingCode(), user_id: user?.id ?? null, user_email: user?.email ?? null,
        user_name: name.trim(), phone: phone.trim(), address: address.trim(),
        source_city: sourceCity, destination_city: destinationCity.trim(),
        item_id: item.id, item_title: item.title, item_price: displayPrice(item),
        item_image_url: itemImage(item, selectedColor || undefined),
        item_details: item.description?.trim() || null,
        selected_size: selectedSize || null, selected_volume: selectedVolume || null,
        selected_color: selectedColor || null, payment_method: paymentMethod,
        utr_id: paymentMethod === "UPI" ? utrId.trim() : null,
        status: paymentMethod === "UPI" ? "Verification Pending" : "Pending",
      };
      const { data, error } = await supabase.from("marketplace_orders").insert([payload])
        .select("id,tracking_code,user_id,user_email,user_name,phone,address,source_city,destination_city,current_location,item_id,item_image_url,item_details,item_title,item_price,selected_size,selected_volume,selected_color,payment_method,utr_id,status,delivery_partner_name,delivery_partner_phone,estimated_delivery_at,created_at")
        .single();
      if (error) throw error;
      onSuccess(data as MarketplaceOrder);
    } catch {
      toast.error("Failed to place order. Please try again.");
    } finally { setPlacing(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-5"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        role="dialog" aria-modal="true" aria-label={`Checkout for ${item.title}`}
        className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1457A6]"><ShoppingBag size={19} /></span>
            <div><h2 className="text-base font-extrabold text-slate-900">Secure your order</h2><p className="text-xs text-slate-500">Famefeed community marketplace</p></div>
          </div>
          <button type="button" aria-label="Close checkout" data-testid="button-close-checkout" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={17} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5" data-testid="checkout-product-summary">
            {itemImage(item, selectedColor) ? <img src={itemImage(item, selectedColor)!} alt={item.title} className="h-20 w-20 shrink-0 rounded-xl bg-white object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-300"><ShoppingBag size={25} /></div>}
            <div className="min-w-0 self-center"><p className="line-clamp-2 text-sm font-extrabold text-slate-900">{item.title}</p>{item.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>}<p className="mt-2 text-base font-extrabold text-[#1457A6]">{displayPrice(item)}</p></div>
          </div>
          <ProductSpecifications item={item} selection={{ size: selectedSize, volume: selectedVolume, color: selectedColor }} />
          <div className="space-y-4">
            <VariantButtons label="Size" values={sizes} selected={selectedSize} onSelect={setSelectedSize} testPrefix="checkout-size" />
            <VariantButtons label="Volume / capacity" values={volumes} selected={selectedVolume} onSelect={setSelectedVolume} testPrefix="checkout-volume" />
            <VariantButtons label="Color" values={colors} selected={selectedColor} onSelect={setSelectedColor} testPrefix="checkout-color" />
          </div>
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><User size={15} className="text-[#1457A6]" /> Delivery details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={fieldLabel}>Full name *</span><input data-testid="input-checkout-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Name of recipient" className={fieldClass} /></label>
              <label><span className={fieldLabel}>Phone number *</span><input data-testid="input-checkout-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91" className={fieldClass} /></label>
              <label><span className={fieldLabel}>Delivery city *</span><input data-testid="input-checkout-city" autoComplete="address-level2" value={destinationCity} onChange={event => setDestinationCity(event.target.value)} placeholder="City" className={fieldClass} /></label>
              <label className="sm:col-span-2"><span className={fieldLabel}>Delivery address *</span><textarea data-testid="input-checkout-address" autoComplete="street-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="House / flat, street, area and PIN code" rows={3} className={`${fieldClass} resize-y`} /></label>
            </div>
          </section>
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><CreditCard size={15} className="text-[#1457A6]" /> Payment method</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["COD", "UPI"] as const).map(method => (
                <button key={method} type="button" data-testid={`button-payment-${method.toLowerCase()}`} aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-3 py-3 text-left transition ${paymentMethod === method ? "border-[#1457A6] bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                  <span className={`block text-sm font-extrabold ${paymentMethod === method ? "text-[#1457A6]" : "text-slate-700"}`}>{method === "COD" ? "Cash on Delivery" : "PhonePe / UPI"}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{method === "COD" ? "Pay when it arrives" : "Submit UTR for manual verification"}</span>
                </button>
              ))}
            </div>
          </section>
          <AnimatePresence>
            {paymentMethod === "UPI" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-extrabold text-slate-900">Scan &amp; pay via PhonePe</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Open PhonePe → Scan QR → Pay → Enter your Transaction ID below. Famefeed records the submitted UTR; it does not process payments.</p>
                  <div className="my-4 flex justify-center rounded-xl border border-slate-200 bg-white p-3">
                    <img src={PHONEPAY_QR_PATH} alt="PhonePe payment QR code" className="w-48 rounded-lg" />
                  </div>
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">UPI ID</p><p className="font-mono text-sm font-bold text-slate-800">{PHONEPAY_UPI_ID}</p></div>
                    <button type="button" data-testid="button-copy-upi-id" onClick={copyUpi} className={secondaryButton}>{upiCopied ? <Check size={14} /> : <Copy size={14} />}{upiCopied ? "Copied" : "Copy"}</button>
                  </div>
                  <label><span className={fieldLabel}>UPI Transaction ID / UTR *</span><input data-testid="input-checkout-utr" value={utrId} onChange={event => setUtrId(event.target.value)} placeholder="Enter Transaction ID after paying" className={fieldClass} /><span className="mt-1 block text-[11px] text-slate-500">PhonePe → History → select payment → Transaction ID</span></label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <button type="button" data-testid="button-place-marketplace-order" onClick={placeOrder} disabled={placing} className={`${primaryButton} w-full py-3.5 text-base`}>
            {placing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={17} />}
            {placing ? "Placing order…" : `Place order · ${displayPrice(item)}`}
          </button>
        </footer>
      </motion.section>
    </motion.div>
  );
}

function OrderSuccessModal({
  order, item, onClose, onCancelOrder,
}: {
  order: MarketplaceOrder;
  item: MarketplaceItem;
  onClose: () => void;
  onCancelOrder: (orderId: string) => Promise<{ error: unknown }>;
}) {
  const [showRoute, setShowRoute] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const awaitingUpiVerification = isUpiAwaitingVerification(order);
  const rows: [string, string][] = [
    ...(order.selected_size ? [["Size", order.selected_size] as [string, string]] : []),
    ...(order.selected_volume ? [["Volume", order.selected_volume] as [string, string]] : []),
    ...(order.selected_color ? [["Color", order.selected_color] as [string, string]] : []),
    ["Delivery address", [order.address, order.destination_city].filter(Boolean).join(", ") || "—"],
    ["Order status", order.status],
    ["Payment method", order.payment_method === "UPI" ? "PhonePe UPI" : "Cash on Delivery"],
    ...(order.payment_method === "UPI" ? [["Payment verification", order.status === "Cancelled" ? "Cancelled" : awaitingUpiVerification ? "Pending manual verification" : "Verified"] as [string, string]] : []),
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/50 p-4">
      <motion.section role="dialog" aria-modal="true" aria-label="Order confirmation" initial={{ scale: .94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[26px] bg-white shadow-2xl">
        <div className="px-6 pb-4 pt-7 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[#1457A6]"><Check size={27} strokeWidth={3} /></div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">{order.status === "Cancelled" ? "Order cancelled" : awaitingUpiVerification ? "Order received" : "Order placed"}</h2>
          <p className="mt-1 text-sm text-slate-500">{order.status === "Cancelled" ? "This order has been cancelled." : awaitingUpiVerification ? "Your order is awaiting payment verification." : "Thanks for shopping with Famefeed."}</p>
          {awaitingUpiVerification && <p data-testid="text-upi-verification-notice" className="mx-auto mt-3 max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs font-medium leading-relaxed text-amber-900">Your order is in processing and has been forwarded to the Payment Verification Department. Once payment is matched and verified, your order status will be updated.</p>}
        </div>
        <div className="mx-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          {itemImage(item, order.selected_color || undefined) ? <img src={itemImage(item, order.selected_color || undefined)!} alt={item.title} className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-blue-50 text-blue-300"><Package size={24} /></div>}
          <div className="min-w-0"><p data-testid="text-success-item-title" className="line-clamp-2 text-sm font-extrabold text-slate-900">{order.item_title}</p><p data-testid="text-success-paid-price" className="mt-1 text-base font-black text-[#1457A6]">{order.item_price || displayPrice(item)}</p></div>
        </div>
        <div className="mx-5 mt-4 rounded-2xl border border-[#ead7da] bg-[#fffafb] p-4 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#8B1E2D]">{awaitingUpiVerification ? "Order reference" : "Tracking code"}</p>
          <p data-testid="text-order-tracking-code" className="mt-1 font-mono text-2xl font-black tracking-wider text-slate-900">{order.tracking_code}</p>
        </div>
        <div className="mx-5 my-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 px-4">
          {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2.5 text-xs"><span className="shrink-0 font-semibold text-slate-500">{label}</span><span className="max-w-[68%] text-right font-bold text-slate-800">{value}</span></div>)}
        </div>
        <div className="px-5 pb-5">
          {!awaitingUpiVerification && order.status !== "Cancelled" && showRoute && order.source_city && order.destination_city && (
            <div className="mb-4" data-testid="success-shipment-route">
              <OrderRouteMap sourceCity={order.source_city} destinationCity={order.destination_city} destinationAddress={order.address} currentLocation={order.current_location} status={order.status} />
            </div>
          )}
          {!awaitingUpiVerification && order.status !== "Cancelled" && order.source_city && order.destination_city && (
            <button type="button" data-testid="button-success-track-shipment" onClick={() => setShowRoute(value => !value)} className={`${secondaryButton} mb-2 w-full border-blue-200 text-[#1457A6]`}>
              <Truck size={16} /> {showRoute ? "Hide shipment map" : "View shipment map"}
            </button>
          )}
          {canCancelMarketplaceOrder(order) && (
            <button
              type="button"
              data-testid="button-cancel-order-details"
              disabled={cancelling}
              onClick={async () => {
                if (!window.confirm(`Cancel order ${order.tracking_code}? This cannot be undone.`)) return;
                setCancelling(true);
                try {
                  const { error } = await onCancelOrder(order.id);
                  if (error) toast.error("Could not cancel this order. It may already have shipped.");
                  else toast.success("Order cancelled");
                } catch {
                  toast.error("Could not cancel this order. Please try again.");
                } finally {
                  setCancelling(false);
                }
              }}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-extrabold text-[#8B1E2D] hover:bg-rose-100 disabled:opacity-60"
            >
              {cancelling ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
              {cancelling ? "Cancelling…" : "Cancel Order"}
            </button>
          )}
          <button type="button" data-testid="button-success-return-feed" onClick={onClose} className={`${primaryButton} w-full py-3`}>Return to feed</button>
          {order.phone && <p className="mt-3 text-center text-[11px] text-slate-500">We’ll confirm order details via {order.phone}.</p>}
        </div>
      </motion.section>
    </motion.div>
  );
}

export function MyOrdersDrawer({
  onClose, focusOrderId,
}: { onClose: () => void; focusOrderId?: string | null }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [visible, setVisible] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setOrders([]);
      setLoading(Boolean(session?.user?.id));
    });
    supabase.auth.getUser().then(({ data }) => { if (mounted) setUserId(data.user?.id ?? null); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!userId) { setOrders([]); setLoading(false); setLoadError(""); return; }
    let active = true;
    setLoading(true);
    setLoadError("");
    supabase.from("marketplace_orders")
      .select("id,tracking_code,user_id,user_email,user_name,phone,address,source_city,destination_city,current_location,item_id,item_image_url,item_details,item_title,item_price,selected_size,selected_volume,selected_color,payment_method,utr_id,status,delivery_partner_name,delivery_partner_phone,estimated_delivery_at,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError("Could not load your orders. Please try again.");
        else setOrders((data ?? []) as MarketplaceOrder[]);
        setLoading(false);
      }, () => {
        if (active) { setLoadError("Could not load your orders. Please try again."); setLoading(false); }
      });
    return () => { active = false; };
  }, [userId, refreshCount]);

  useEffect(() => {
    if (!focusOrderId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`marketplace-order-${focusOrderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusOrderId, loading, orders]);

  const cancelOrder = async (order: MarketplaceOrder) => {
    if (!canCancelMarketplaceOrder(order) || cancellingOrderId) return;
    if (!window.confirm(`Cancel order ${order.tracking_code}? This cannot be undone.`)) return;
    setCancellingOrderId(order.id);
    try {
      const { error } = await requestMarketplaceOrderCancellation(order.id);
      if (error) {
        toast.error("Could not cancel this order. It may already have shipped.");
      } else {
        setOrders(previous => previous.map(current => current.id === order.id ? { ...current, status: "Cancelled" } : current));
        toast.success("Order cancelled");
      }
    } catch {
      toast.error("Could not cancel this order. Please try again.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    if (!userId || !visible) return;
    const channel = supabase.channel(`marketplace-orders-user-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_orders", filter: `user_id=eq.${userId}` }, () => setRefreshCount(count => count + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, visible]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[650] flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-5" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 30 }} role="dialog" aria-modal="true" aria-label="My Orders" className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]" onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1457A6]"><ClipboardList size={18} /></span><div><h2 className="font-extrabold text-slate-900">My Orders</h2><p className="text-xs text-slate-500">Shipment updates for your purchases</p></div></div>
          <div className="flex gap-2">
            <button type="button" data-testid="button-refresh-my-orders" aria-label="Refresh orders" onClick={() => setRefreshCount(count => count + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
            <button type="button" data-testid="button-close-my-orders" aria-label="Close my orders" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500"><X size={16} /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
          {!userId ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center"><User size={25} className="mx-auto mb-3 text-[#1457A6]" /><p className="font-extrabold text-slate-800">Sign in to view your orders</p><p className="mt-1 text-xs text-slate-500">Orders are private to the account used at checkout.</p></div>
          : loading ? <div className="space-y-3" aria-label="Loading orders">{[0, 1].map(value => <div key={value} className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-white" />)}</div>
          : loadError && !orders.length ? <div className="rounded-2xl border border-rose-200 bg-white p-7 text-center"><p className="font-bold text-[#8B1E2D]">{loadError}</p><button type="button" data-testid="button-retry-my-orders" onClick={() => setRefreshCount(count => count + 1)} className={`${secondaryButton} mt-4`}>Retry</button></div>
          : !orders.length ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center"><Package size={28} className="mx-auto mb-3 text-slate-300" /><p className="font-extrabold text-slate-800">No orders yet</p><p className="mt-1 text-xs text-slate-500">Your purchases and tracking details will appear here.</p></div>
           : orders.map(order => {
             const milestoneIndex = getTrackingMilestoneIndex(order.status);
             const partnerPhone = order.delivery_partner_phone?.trim();
             const callHref = partnerPhone?.replace(/[^\d+]/g, "");
             return (
               <article id={`marketplace-order-${order.id}`} key={order.id} data-testid={`card-my-order-${order.id}`} className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${focusOrderId === order.id ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}>
                 <div className="flex items-start justify-between gap-3">
                   <div className="min-w-0">
                     <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B1E2D]">Flicks Marketplace</p>
                     <p className="mt-1 truncate font-mono text-xs font-extrabold text-slate-700">{order.tracking_code}</p>
                     <p className="mt-1 text-[10px] text-slate-500">Placed {formatOrderTime(order.created_at)}</p>
                   </div>
                   <span data-testid={`status-order-${order.id}`} className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold" style={{ color: STATUS_COLORS[order.status] || BLUE, borderColor: `${STATUS_COLORS[order.status] || BLUE}35`, background: `${STATUS_COLORS[order.status] || BLUE}0c` }}>{order.status}</span>
                 </div>

                 {isUpiAwaitingVerification(order)
                   ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">Payment verification is pending. Shipment updates will appear here after the submitted UTR is matched.</p>
                   : order.status === "Cancelled"
                     ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-[#8B1E2D]">This order was cancelled.</p>
                     : order.source_city?.trim() && order.destination_city?.trim()
                       ? <OrderRouteMap sourceCity={order.source_city} destinationCity={order.destination_city} destinationAddress={order.address} currentLocation={order.current_location} status={order.status} />
                       : <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Route unavailable: source or delivery city was not recorded.</p>}

                 {order.status !== "Cancelled" && !isUpiAwaitingVerification(order) && (
                   <>
                     <section aria-label="Shipment milestones" className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                       <div className="mb-3 flex items-center justify-between gap-2">
                         <h3 className="text-xs font-extrabold text-slate-900">Tracking milestones</h3>
                         <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Clock3 size={12} />{order.estimated_delivery_at ? formatMilestoneEstimate(order.estimated_delivery_at, 3) : "Delivery ETA pending"}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                         {TRACKING_MILESTONES.map((milestone, index) => {
                           const complete = order.status === "Delivered" || (milestoneIndex >= 0 && index < milestoneIndex);
                           const active = order.status !== "Delivered" && milestoneIndex === index;
                           const badge = complete ? "Complete" : active ? "Current" : "Upcoming";
                           return (
                             <div key={milestone.title} data-testid={`milestone-${index}-${order.id}`} className={`min-w-0 rounded-xl border p-2.5 ${active ? "border-blue-200 bg-blue-50" : complete ? "border-emerald-100 bg-emerald-50/70" : "border-slate-200 bg-white"}`}>
                               <div className="flex items-center justify-between gap-1"><span className="text-base" aria-hidden="true">{milestone.icon}</span><span className={`truncate rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${complete ? "bg-emerald-100 text-emerald-700" : active ? "bg-blue-100 text-[#1457A6]" : "bg-slate-100 text-slate-500"}`}>{badge}</span></div>
                               <p className="mt-2 text-[10px] font-extrabold leading-tight text-slate-800">{milestone.title}</p>
                               <p className="mt-1 text-[9px] font-medium text-slate-500">{formatMilestoneEstimate(order.estimated_delivery_at, index)}</p>
                             </div>
                           );
                         })}
                       </div>
                     </section>

                     <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
                       <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200">
                         <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                           <h3 className="text-xs font-extrabold text-slate-900">Product specifications</h3>
                         </div>
                         <div className="overflow-x-auto">
                           <table className="w-full min-w-[600px] border-collapse text-left text-[10px]">
                             <thead><tr className="bg-white">{["Item", "Color", "Size", "Volume", "Details"].map(label => <th key={label} className="border-b border-r border-slate-200 px-2.5 py-2 font-extrabold uppercase tracking-wide text-slate-500 last:border-r-0">{label}</th>)}</tr></thead>
                             <tbody><tr className="align-top">
                               <td className="max-w-[130px] border-r border-slate-200 px-2.5 py-2.5 font-bold text-slate-800">{order.item_title}</td>
                               <td className="border-r border-slate-200 px-2.5 py-2.5 text-slate-700">{order.selected_color || "—"}</td>
                               <td className="border-r border-slate-200 px-2.5 py-2.5 text-slate-700">{order.selected_size || "—"}</td>
                               <td className="border-r border-slate-200 px-2.5 py-2.5 text-slate-700">{order.selected_volume || "—"}</td>
                               <td className="max-w-[230px] px-2.5 py-2.5 leading-relaxed text-slate-600">{order.item_details?.trim() || "No additional product details"}</td>
                             </tr></tbody>
                           </table>
                         </div>
                       </section>

                       <section className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                         <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-rose-100 text-[#1457A6]"><User size={20} /></div>
                         <div className="min-w-0 flex-1">
                           <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Delivery Boy</p>
                           <p className="truncate text-xs font-extrabold text-slate-900">{order.delivery_partner_name || "Not assigned yet"}</p>
                           <p className="truncate text-[10px] text-slate-500">{partnerPhone || "Contact appears after assignment"}</p>
                         </div>
                         {callHref
                           ? <a href={`tel:${callHref}`} data-testid={`button-call-delivery-partner-${order.id}`} aria-label={`Call ${order.delivery_partner_name || "delivery boy"}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1457A6] px-3 py-2.5 text-[10px] font-extrabold text-white shadow-sm hover:bg-blue-800"><Phone size={14} />Call</a>
                           : <button type="button" disabled aria-label="Delivery boy phone not assigned" className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-[10px] font-extrabold text-slate-400"><Phone size={14} />Call</button>}
                       </section>
                     </div>
                   </>
                 )}

                 <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-rose-50 p-3">
                   <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white bg-white shadow-sm">
                     {order.item_image_url
                       ? <img src={order.item_image_url} alt={order.item_title} className="h-full w-full object-cover" loading="lazy" />
                       : <div className="grid h-full place-items-center text-blue-300"><Package size={21} /></div>}
                   </div>
                   <div className="min-w-0 flex-1">
                     <p className="line-clamp-2 text-xs font-extrabold text-slate-900">{order.item_title}</p>
                     <p className="mt-1 text-sm font-black text-[#1457A6]">{order.item_price || "Price unavailable"}</p>
                   </div>
                   <button
                     type="button"
                     data-testid={`button-cancel-order-${order.id}`}
                     disabled={!canCancelMarketplaceOrder(order) || cancellingOrderId === order.id}
                     title={!canCancelMarketplaceOrder(order) ? "Cancellation is unavailable after dispatch" : undefined}
                     onClick={() => void cancelOrder(order)}
                     className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-extrabold text-[#8B1E2D] hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
                   >
                     {cancellingOrderId === order.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                     {cancellingOrderId === order.id ? "Cancelling…" : order.status === "Cancelled" ? "Order cancelled" : "Cancel Order"}
                   </button>
                 </div>
               </article>
             );
           })}
        </div>
      </motion.section>
    </motion.div>
  );
}

function ProductDetail({
  item, suggestions, onBack, onBuyNow, onOpenSuggestion,
}: {
  item: MarketplaceItem; suggestions: MarketplaceItem[]; onBack: () => void;
  onBuyNow: (selection: VariantSelection) => void; onOpenSuggestion: (item: MarketplaceItem) => void;
}) {
  const sizes = itemSizes(item);
  const volumes = itemVolumes(item);
  const colors = itemColors(item);
  const attrs = getAttributes(item);
  const [size, setSize] = useState("");
  const [volume, setVolume] = useState("");
  const [color, setColor] = useState("");
  const image = itemImage(item, color);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed inset-0 z-[550] overflow-y-auto bg-slate-900/45 p-0 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onBack(); }}>
      <section role="dialog" aria-modal="true" aria-label={`${item.title} product details`} className="mx-auto min-h-full w-full max-w-5xl bg-white shadow-2xl sm:my-4 sm:min-h-0 sm:overflow-hidden sm:rounded-[26px]" onClick={event => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" data-testid="button-detail-back" onClick={onBack} className={secondaryButton}><ArrowLeft size={15} /> Back to marketplace</button>
          <button type="button" data-testid={`button-share-detail-${item.id}`} aria-label={`Share ${item.title}`} onClick={() => void shareProduct(item)} className={secondaryButton}><Share2 size={15} /><span className="hidden sm:inline">Share product</span></button>
        </header>
        <div className="grid md:grid-cols-[1.05fr_.95fr]">
          <div className="bg-[#F4F7FB] p-4 sm:p-7">
            <div className="relative mx-auto flex min-h-[300px] max-h-[540px] aspect-square w-full max-w-[540px] items-center justify-center overflow-hidden rounded-2xl bg-white">
              {image ? <img data-testid={`img-detail-product-${item.id}`} src={image} alt={item.title} className="h-full w-full object-contain" /> : <ShoppingBag size={56} className="text-slate-200" />}
              {item.badge && <span className="absolute left-4 top-4 rounded-full bg-[#8B1E2D] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">{item.badge}</span>}
            </div>
            {attrs.colorVariants?.length ? <div className="mt-3 flex gap-2 overflow-x-auto">{attrs.colorVariants.map(variant => <button key={variant.name} type="button" aria-label={`View ${variant.name} product image`} data-testid={`button-color-image-${variant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setColor(variant.name)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${color === variant.name ? "border-[#1457A6]" : "border-white"}`}><img src={variant.imageUrl || item.image_url || ""} alt={variant.name} className="h-full w-full object-cover" /></button>)}</div> : null}
          </div>
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#8B1E2D]">{attrs.category || "Famefeed marketplace"}</p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-slate-900 sm:text-3xl">{item.title}</h1>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tracking-tight text-[#1457A6]">{displayPrice(item)}</span>
              {attrs.pricing?.originalPrice != null && Number(attrs.pricing.originalPrice) > Number(attrs.pricing.discountedPrice ?? 0) && <span className="text-sm text-slate-400 line-through">₹{Number(attrs.pricing.originalPrice).toLocaleString("en-IN")}</span>}
              {attrs.pricing?.discountPercent ? <span className="rounded-md bg-[#8B1E2D] px-2 py-1 text-[10px] font-black text-white">{attrs.pricing.discountPercent}% off</span> : null}
            </div>
            {attrs.pricing?.offerTagline && <p className="mt-2 text-sm font-bold text-[#8B1E2D]">{attrs.pricing.offerTagline}</p>}
            {item.description && <p className="mt-5 whitespace-pre-line text-sm leading-6 text-slate-600">{item.description}</p>}
            <div className="my-6 space-y-4">
              <VariantButtons label="Choose size" values={sizes} selected={size} onSelect={setSize} testPrefix="detail-size" />
              <VariantButtons label="Choose volume / capacity" values={volumes} selected={volume} onSelect={setVolume} testPrefix="detail-volume" />
              <VariantButtons label="Choose color" values={colors} selected={color} onSelect={setColor} testPrefix="detail-color" />
              <ProductSpecifications item={item} selection={{ size, volume, color }} />
            </div>
            <button type="button" data-testid={`button-buy-now-${item.id}`} onClick={() => onBuyNow({ size, volume, color })} disabled={attrs.stockQuantity === 0} className={`${primaryButton} mt-7 w-full py-3.5 text-base`}><ShoppingBag size={17} /> Buy now</button>
            <p className="mt-3 text-center text-[11px] text-slate-500">Checkout records COD or submitted UPI/UTR only.</p>
          </div>
        </div>
        {suggestions.length > 0 && <section className="border-t border-slate-100 px-5 py-6 sm:px-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#8B1E2D]">Made to go together</p><h2 className="mt-1 text-lg font-black text-slate-900">Frequently bought together</h2></div><span className="text-xs text-slate-500">From active listings</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{suggestions.map(product => <button key={product.id} type="button" data-testid={`card-suggestion-${product.id}`} onClick={() => onOpenSuggestion(product)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-md"><div className="aspect-[4/3] bg-slate-50">{itemImage(product) ? <img src={itemImage(product)!} alt={product.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center text-slate-200"><ShoppingBag size={24} /></div>}</div><div className="p-3"><p className="line-clamp-2 text-xs font-bold text-slate-800">{product.title}</p><p className="mt-1 text-sm font-black text-[#1457A6]">{displayPrice(product)}</p></div></button>)}</div></section>}
      </section>
    </motion.div>
  );
}

export function MarketplaceFeedCard({ items }: { items: MarketplaceItem[] }) {
  const active = useMemo(() => items.filter(item => item.is_active), [items]);
  const [checkoutItem, setCheckoutItem] = useState<MarketplaceItem | null>(null);
  const [checkoutSelection, setCheckoutSelection] = useState<VariantSelection>({ size: "", volume: "", color: "" });
  const [successData, setSuccessData] = useState<{ order: MarketplaceOrder; item: MarketplaceItem } | null>(null);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const handledSharedId = useRef("");

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("marketplace_item");
    if (!sharedId || sharedId === handledSharedId.current) return;
    const matched = active.find(item => item.id === sharedId);
    if (matched) { setDetailItem(matched); handledSharedId.current = sharedId; }
  }, [active]);

  const openCheckout = (item: MarketplaceItem, selection: VariantSelection = { size: "", volume: "", color: "" }) => {
    setCheckoutSelection(selection);
    setCheckoutItem(item);
  };
  const closeDetail = () => {
    setDetailItem(null);
    if (new URLSearchParams(window.location.search).has("marketplace_item")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("marketplace_item");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  };
  const showDetail = (item: MarketplaceItem) => {
    setDetailItem(item);
    const url = new URL(window.location.href);
    url.searchParams.set("marketplace_item", item.id);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  return (
    <>
      <section data-testid="marketplace-feed-catalog" aria-label="Flicks Marketplace" className="w-full border-y border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#1457A6]"><Store size={17} /></span><div><h2 className="text-sm font-black tracking-tight text-slate-900">Flicks Marketplace</h2><p className="text-[10px] text-slate-500">Shop products shared by the community</p></div></div>
          <button type="button" data-testid="button-open-my-orders" onClick={() => setShowMyOrders(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-extrabold text-[#1457A6] hover:bg-blue-100"><ClipboardList size={13} /> My Orders</button>
        </header>
        {active.length ? <div className="flex gap-3 overflow-x-auto px-4 pb-4 no-scrollbar sm:px-5">{active.map(item => (
          <motion.article key={item.id} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} data-testid={`card-marketplace-product-${item.id}`} className="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[190px]">
            <div data-testid={`button-open-detail-image-${item.id}`} className="relative aspect-[4/3] cursor-pointer bg-slate-50" onClick={() => showDetail(item)} role="button" tabIndex={0} aria-label={`View ${item.title} details`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") showDetail(item); }}>
              {itemImage(item) ? <img src={itemImage(item)!} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-200"><ShoppingBag size={32} /></div>}
              {item.badge && <span className="absolute left-2 top-2 rounded-md bg-[#8B1E2D] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">{item.badge}</span>}
              <button type="button" data-testid={`button-share-card-${item.id}`} aria-label={`Share ${item.title}`} onClick={event => { event.stopPropagation(); void shareProduct(item); }} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm hover:text-[#1457A6]"><Share2 size={14} /></button>
            </div>
            <button type="button" data-testid={`button-open-detail-${item.id}`} onClick={() => showDetail(item)} className="block w-full px-3 pt-3 text-left"><span className="line-clamp-2 min-h-9 text-xs font-extrabold leading-4 text-slate-800">{item.title}</span><span className="mt-1 block text-sm font-black text-[#1457A6]">{displayPrice(item)}</span></button>
            <div className="px-3 pb-3 pt-2"><button type="button" data-testid={`button-shop-now-${item.id}`} onClick={() => showDetail(item)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1457A6] py-2 text-[11px] font-extrabold text-white hover:bg-[#0D478E]"><ShoppingBag size={12} /> View details</button></div>
          </motion.article>
        ))}</div> : <div className="px-5 pb-5"><div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center"><Store size={20} className="mx-auto mb-2 text-slate-300" /><p className="text-xs font-bold text-slate-700">No active listings right now</p><p className="mt-1 text-[11px] text-slate-500">New community finds will appear here.</p></div></div>}
      </section>

      {typeof document !== "undefined" && createPortal(<AnimatePresence>
        {detailItem && <ProductDetail key={detailItem.id} item={detailItem} suggestions={active.filter(item => item.id !== detailItem.id).slice(0, 3)} onBack={closeDetail} onBuyNow={selection => openCheckout(detailItem, selection)} onOpenSuggestion={showDetail} />}
        {checkoutItem && <CheckoutDrawer item={checkoutItem} initialSelection={checkoutSelection} onClose={() => setCheckoutItem(null)} onSuccess={order => { setCheckoutItem(null); closeDetail(); setSuccessData({ order, item: checkoutItem }); }} />}
        {successData && <OrderSuccessModal
          order={successData.order}
          item={successData.item}
          onClose={() => setSuccessData(null)}
          onCancelOrder={async orderId => {
            const result = await requestMarketplaceOrderCancellation(orderId);
            if (!result.error) {
              setSuccessData(current => current ? { ...current, order: { ...current.order, status: "Cancelled" } } : current);
            }
            return { error: result.error };
          }}
        />}
        {showMyOrders && <MyOrdersDrawer onClose={() => setShowMyOrders(false)} />}
      </AnimatePresence>, document.body)}
    </>
  );
}

interface AdminMarketplacePanelProps { onClose: () => void; }
interface FulfillmentDraft {
  partnerName: string;
  partnerPhone: string;
  estimatedDeliveryAt: string;
}
interface AdminForm {
  title: string; description: string; price: string; image_url: string; link_url: string; badge: string;
  sizes: string; colors: string; source_city: string; category: string; material: string; shopName: string; pickupAddress: string;
  pincode: string; contactNumber: string; volumes: string; weight: string; length: string;
  width: string; height: string; dimensionUnit: string; originalPrice: string; discountedPrice: string;
  discountPercent: string; offerTagline: string; stockQuantity: string;
}
const EMPTY_FORM: AdminForm = {
  title: "", description: "", price: "", image_url: "", link_url: "", badge: "", sizes: "", colors: "",
  source_city: "", category: "", material: "", shopName: "", pickupAddress: "", pincode: "", contactNumber: "",
  volumes: "", weight: "", length: "", width: "", height: "", dimensionUnit: "cm",
  originalPrice: "", discountedPrice: "", discountPercent: "", offerTagline: "", stockQuantity: "",
};

export function AdminMarketplacePanel({ onClose }: AdminMarketplacePanelProps) {
  const [panelTab, setPanelTab] = useState<"products" | "orders">("products");
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [sellerDetailsByItemId, setSellerDetailsByItemId] = useState<Record<string, SellerDetails>>({});
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MarketplaceItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<AdminForm>(EMPTY_FORM);
  const [colorVariants, setColorVariants] = useState<MarketplaceColorVariant[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({});
  const [updatingLocationId, setUpdatingLocationId] = useState<string | null>(null);
  const [fulfillmentDrafts, setFulfillmentDrafts] = useState<Record<string, FulfillmentDraft>>({});
  const [updatingFulfillmentId, setUpdatingFulfillmentId] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoadingItems(true); setItemsError("");
    const { data, error } = await supabase.from("marketplace_items")
      .select("id,title,description,price,image_url,link_url,badge,is_active,created_at,sizes,colors,source_city,attributes")
      .order("created_at", { ascending: false }).limit(100);
    if (error) {
      setItemsError("Could not load products. Check the marketplace attributes schema update.");
      setSellerDetailsByItemId({});
    } else {
      const loadedItems = (data ?? []) as MarketplaceItem[];
      setItems(loadedItems);
      if (!loadedItems.length) setSellerDetailsByItemId({});
      else {
        const { data: sellerRows, error: sellerError } = await supabase
          .from("marketplace_item_seller_details")
          .select("item_id,shop_name,pickup_address,city,pincode,contact_number")
          .in("item_id", loadedItems.map(item => item.id));
        if (sellerError) {
          setSellerDetailsByItemId({});
          toast.error("Products loaded, but private seller details are unavailable. Check the seller-details migration and admin policy.");
        } else {
          setSellerDetailsByItemId(Object.fromEntries(((sellerRows ?? []) as MarketplaceSellerDetailsRow[]).map(row => [String(row.item_id), {
            shopName: row.shop_name,
            pickupAddress: row.pickup_address,
            city: row.city,
            pincode: row.pincode,
            contactNumber: row.contact_number,
          }])));
        }
      }
    }
    setLoadingItems(false);
  };
  const fetchOrders = async () => {
    setLoadingOrders(true); setOrdersError("");
    const { data, error } = await supabase.from("marketplace_orders")
      .select("id,tracking_code,user_id,user_email,user_name,phone,address,source_city,destination_city,current_location,item_id,item_image_url,item_details,item_title,item_price,selected_size,selected_volume,selected_color,payment_method,utr_id,status,delivery_partner_name,delivery_partner_phone,estimated_delivery_at,created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) setOrdersError("Could not load orders. Apply the marketplace delivery tracking migration, then retry.");
    else {
      const loadedOrders = (data ?? []) as MarketplaceOrder[];
      setOrders(loadedOrders);
      setLocationDrafts(Object.fromEntries(loadedOrders.map(order => [order.id, order.current_location ?? ""])));
      setFulfillmentDrafts(Object.fromEntries(loadedOrders.map(order => [order.id, {
        partnerName: order.delivery_partner_name ?? "",
        partnerPhone: order.delivery_partner_phone ?? "",
        estimatedDeliveryAt: toDateTimeLocal(order.estimated_delivery_at),
      }])));
    }
    setLoadingOrders(false);
  };
  useEffect(() => { void fetchItems(); }, []);
  useEffect(() => {
    if (panelTab !== "orders") return;
    void fetchOrders();
    return subscribeWhileVisible(
      () => supabase.channel("admin-marketplace-order-updates")
        .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_orders" }, () => { void fetchOrders(); })
        .subscribe(),
      { onVisible: () => { void fetchOrders(); } },
    );
  }, [panelTab]);

  const openAdd = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setColorVariants([]); setShowForm(true); };
  const openEdit = (item: MarketplaceItem) => {
    const attrs = getAttributes(item);
    const pricing = attrs.pricing ?? {};
    const seller = sellerDetailsByItemId[item.id] ?? {};
    setEditItem(item);
    setForm({
      ...EMPTY_FORM, title: item.title, description: item.description ?? "", price: item.price ?? "",
      image_url: item.image_url ?? "", link_url: item.link_url ?? "", badge: item.badge ?? "",
      sizes: item.sizes ?? "", colors: item.colors ?? "", source_city: seller.city || item.source_city || "",
      category: attrs.category ?? "", material: attrs.material ?? "", shopName: seller.shopName ?? "",
      pickupAddress: seller.pickupAddress ?? "", pincode: seller.pincode ?? "",
      contactNumber: seller.contactNumber ?? "", volumes: (attrs.volumeOptions ?? []).join(", "),
      weight: attrs.weight == null ? "" : String(attrs.weight),
      length: attrs.dimensions?.length == null ? "" : String(attrs.dimensions.length),
      width: attrs.dimensions?.width == null ? "" : String(attrs.dimensions.width),
      height: attrs.dimensions?.height == null ? "" : String(attrs.dimensions.height),
      dimensionUnit: attrs.dimensions?.unit || "cm",
      originalPrice: pricing.originalPrice == null ? "" : String(pricing.originalPrice),
      discountedPrice: pricing.discountedPrice == null ? "" : String(pricing.discountedPrice),
      discountPercent: pricing.discountPercent == null ? "" : String(pricing.discountPercent),
      offerTagline: pricing.offerTagline ?? "",
      stockQuantity: attrs.stockQuantity == null ? "" : String(attrs.stockQuantity),
    });
    setColorVariants(attrs.colorVariants?.map(variant => ({ name: variant.name ?? "", imageUrl: variant.imageUrl ?? "" })) ?? []);
    setShowForm(true);
  };
  const setField = (key: keyof AdminForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `marketplace/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, { upsert: true });
    if (error) { toast.error("Image upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
    setField("image_url", publicUrl);
    setUploading(false);
  };
  const saveItem = async () => {
    if (!form.title.trim()) { toast.error("Product name is required"); return; }
    if (!form.source_city.trim()) { toast.error("Seller city is required for route tracking"); return; }
    for (const [label, value] of [["Original price", form.originalPrice], ["Discount price", form.discountedPrice], ["Discount percent", form.discountPercent], ["Stock quantity", form.stockQuantity]] as const) {
      if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        toast.error(`${label} must be a valid non-negative number`);
        return;
      }
    }
    if (colorVariants.some(variant => Boolean(variant.name.trim()) !== Boolean(variant.imageUrl.trim()))) {
      toast.error("Add both a color name and image URL for each color variant"); return;
    }
    setSaving(true);
    const originalPrice = form.originalPrice.trim() ? Number(form.originalPrice) : null;
    const discountedPrice = form.discountedPrice.trim() ? Number(form.discountedPrice) : null;
    const computedDiscount = originalPrice && discountedPrice && originalPrice > discountedPrice
      ? Math.round((1 - discountedPrice / originalPrice) * 100) : null;
    const attributes: MarketplaceItemAttributes = {
      category: form.category.trim() || undefined,
      material: form.material.trim() || undefined,
      volumeOptions: form.volumes.split(",").map(value => value.trim()).filter(Boolean),
      weight: form.weight.trim() || undefined,
      dimensions: { length: form.length.trim() || undefined, width: form.width.trim() || undefined, height: form.height.trim() || undefined, unit: form.dimensionUnit },
      colorVariants: colorVariants.filter(variant => variant.name.trim() && variant.imageUrl.trim()).map(variant => ({ name: variant.name.trim(), imageUrl: variant.imageUrl.trim() })),
      pricing: {
        originalPrice, discountedPrice,
        discountPercent: form.discountPercent.trim() ? Number(form.discountPercent) : computedDiscount,
        offerTagline: form.offerTagline.trim() || undefined,
      },
      stockQuantity: form.stockQuantity.trim() ? Number(form.stockQuantity) : null,
    };
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null,
      price: discountedPrice != null ? `₹${discountedPrice.toLocaleString("en-IN")}` : form.price.trim() || (originalPrice != null ? `₹${originalPrice.toLocaleString("en-IN")}` : null),
      image_url: form.image_url.trim() || null, link_url: form.link_url.trim() || null,
      badge: form.badge || null, is_active: editItem?.is_active ?? true,
      sizes: form.sizes.trim() || null,
      colors: Array.from(new Set([
        ...form.colors.split(",").map(value => value.trim()).filter(Boolean),
        ...colorVariants.map(variant => variant.name.trim()).filter(Boolean),
      ])).join(", ") || null,
      source_city: form.source_city.trim(), attributes,
    };
    let itemId = editItem?.id;
    let itemSaveError: { message: string } | null = null;
    if (editItem) {
      const result = await supabase.from("marketplace_items").update(payload).eq("id", editItem.id);
      itemSaveError = result.error;
    } else {
      const result = await supabase.from("marketplace_items").insert([payload]).select("id").single();
      itemSaveError = result.error;
      itemId = result.data?.id;
    }
    if (itemSaveError || !itemId) {
      setSaving(false);
      toast.error(editItem ? "Update failed" : "Save failed");
      return;
    }
    const { error: sellerSaveError } = await supabase.from("marketplace_item_seller_details").upsert({
      item_id: itemId,
      shop_name: form.shopName.trim() || null,
      pickup_address: form.pickupAddress.trim() || null,
      city: form.source_city.trim() || null,
      pincode: form.pincode.trim() || null,
      contact_number: form.contactNumber.trim() || null,
    }, { onConflict: "item_id" });
    setSaving(false);
    if (sellerSaveError) {
      toast.error("Listing saved, but private seller details could not be saved. Check the seller-details table and admin policy.");
      void fetchItems();
      return;
    }
    toast.success(editItem ? "Product updated" : "Product added to marketplace");
    setShowForm(false);
    void fetchItems();
  };
  const toggleActive = async (item: MarketplaceItem) => {
    const { error } = await supabase.from("marketplace_items").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) { toast.error("Could not change listing status"); return; }
    setItems(previous => previous.map(current => current.id === item.id ? { ...current, is_active: !item.is_active } : current));
  };
  const deleteItem = async (item: MarketplaceItem) => {
    if (!window.confirm(`Remove “${item.title}” from the marketplace?`)) return;
    const { error } = await supabase.from("marketplace_items").delete().eq("id", item.id);
    if (error) { toast.error("Could not remove product"); return; }
    setItems(previous => previous.filter(current => current.id !== item.id));
    toast.success("Product removed");
  };
  const updateOrderStatus = async (orderId: string, status: string) => {
    const order = orders.find(current => current.id === orderId);
    if (order?.status === "Cancelled") return;
    if (order && isUpiAwaitingVerification(order)) {
      toast.error("Match the UTR against the bank statement before updating shipment status");
      return;
    }
    setUpdatingOrderId(orderId);
    const { error } = await supabase.from("marketplace_orders").update({ status }).eq("id", orderId);
    if (error) toast.error("Could not update shipping milestone");
    else { setOrders(previous => previous.map(order => order.id === orderId ? { ...order, status } : order)); toast.success("Shipping milestone updated"); }
    setUpdatingOrderId(null);
  };
  const verifyUpiOrder = async (order: MarketplaceOrder) => {
    if (!order.utr_id?.trim()) { toast.error("This order has no submitted UTR to verify"); return; }
    if (!window.confirm(`Match UTR ${order.utr_id} against the bank statement before confirming this payment. Continue only if the amount and transaction match.`)) return;
    setUpdatingOrderId(order.id);
    const { error } = await supabase.from("marketplace_orders").update({ status: "Confirmed" }).eq("id", order.id);
    if (error) toast.error("Could not confirm payment verification");
    else {
      setOrders(previous => previous.map(current => current.id === order.id ? { ...current, status: "Confirmed" } : current));
      toast.success("Payment verified. Shipment status can now be updated.");
    }
    setUpdatingOrderId(null);
  };
  const updateCurrentLocation = async (orderId: string) => {
    const current_location = locationDrafts[orderId]?.trim() || null;
    setUpdatingLocationId(orderId);
    const { error } = await supabase.from("marketplace_orders").update({ current_location }).eq("id", orderId);
    if (error) toast.error("Could not update current shipment location");
    else { setOrders(previous => previous.map(order => order.id === orderId ? { ...order, current_location } : order)); toast.success("Current location updated"); }
    setUpdatingLocationId(null);
  };
  const saveOrderFulfillment = async (orderId: string) => {
    const order = orders.find(current => current.id === orderId);
    if (!order || order.status === "Cancelled") return;
    const draft = fulfillmentDrafts[orderId] ?? { partnerName: "", partnerPhone: "", estimatedDeliveryAt: "" };
    const partnerName = draft.partnerName.trim();
    const partnerPhone = draft.partnerPhone.trim();
    const phoneDigits = partnerPhone.replace(/\D/g, "");
    if (partnerPhone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      toast.error("Enter a valid delivery partner phone number");
      return;
    }
    const parsedEta = draft.estimatedDeliveryAt ? new Date(draft.estimatedDeliveryAt) : null;
    if (parsedEta && Number.isNaN(parsedEta.getTime())) {
      toast.error("Enter a valid estimated delivery date and time");
      return;
    }
    const estimated_delivery_at = parsedEta?.toISOString() ?? null;
    setUpdatingFulfillmentId(orderId);
    const { error } = await supabase.from("marketplace_orders").update({
      delivery_partner_name: partnerName || null,
      delivery_partner_phone: partnerPhone || null,
      estimated_delivery_at,
    }).eq("id", orderId);
    if (error) {
      toast.error("Could not save delivery partner and ETA");
    } else {
      setOrders(previous => previous.map(current => current.id === orderId
        ? { ...current, delivery_partner_name: partnerName || null, delivery_partner_phone: partnerPhone || null, estimated_delivery_at }
        : current));
      setFulfillmentDrafts(previous => ({
        ...previous,
        [orderId]: { partnerName, partnerPhone, estimatedDeliveryAt: toDateTimeLocal(estimated_delivery_at) },
      }));
      toast.success("Delivery partner and ETA saved");
    }
    setUpdatingFulfillmentId(null);
  };

  const formInput = (name: keyof AdminForm, label: string, placeholder = "", type = "text") => (
    <label><span className={fieldLabel}>{label}</span><input data-testid={`input-admin-${name}`} type={type} value={form[name]} onChange={event => setField(name, event.target.value)} placeholder={placeholder} className={fieldClass} /></label>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-5" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }} role="dialog" aria-modal="true" aria-label="Admin Marketplace" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]" onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1457A6]"><Store size={18} /></span><div><h2 className="font-extrabold text-slate-900">Marketplace manager</h2><p className="text-xs text-slate-500">Manage listings and community orders</p></div></div>
          <div className="flex items-center gap-2">
            {panelTab === "products" ? <button type="button" data-testid="button-add-marketplace-product" onClick={openAdd} className={primaryButton}><Plus size={15} /> Add product</button> : <button type="button" data-testid="button-refresh-admin-orders" aria-label="Refresh orders" onClick={() => void fetchOrders()} className={secondaryButton}><RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} /></button>}
            <button type="button" data-testid="button-close-marketplace-admin" aria-label="Close marketplace manager" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500"><X size={16} /></button>
          </div>
        </header>
        <nav className="grid grid-cols-2 gap-2 border-b border-slate-100 px-5 py-3">
          {(["products", "orders"] as const).map(tab => <button key={tab} type="button" data-testid={`tab-marketplace-${tab}`} aria-selected={panelTab === tab} onClick={() => setPanelTab(tab)} className={`rounded-xl px-4 py-2.5 text-xs font-extrabold capitalize ${panelTab === tab ? "bg-[#1457A6] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tab === "products" ? `Products · ${items.length}` : "Orders"}</button>)}
        </nav>

        {panelTab === "products" && <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70">
          {loadingItems ? <div className="space-y-3 p-5">{[0, 1, 2].map(value => <div key={value} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>
          : itemsError ? <div className="m-5 rounded-2xl border border-rose-200 bg-white p-7 text-center"><p className="font-bold text-[#8B1E2D]">{itemsError}</p><button type="button" data-testid="button-retry-admin-products" onClick={() => void fetchItems()} className={`${secondaryButton} mt-4`}>Retry</button></div>
          : !items.length ? <div className="px-5 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[#1457A6]"><Store size={24} /></span><p className="mt-4 font-extrabold text-slate-800">No marketplace listings yet</p><p className="mt-1 text-xs text-slate-500">Add the first product to make it discoverable in the feed.</p><button type="button" onClick={openAdd} className={`${primaryButton} mt-4`}><Plus size={15} /> Add a product</button></div>
          : <div className="space-y-3 p-4 sm:p-5">{items.map(item => {
            const attrs = getAttributes(item);
            return <article key={item.id} data-testid={`row-admin-product-${item.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-nowrap">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">{itemImage(item) ? <img src={itemImage(item)!} alt={item.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300"><ImageIcon size={20} /></div>}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-900">{item.title}</p><p className="mt-1 text-xs font-bold text-[#1457A6]">{displayPrice(item)}{attrs.pricing?.originalPrice ? <span className="ml-2 font-normal text-slate-400 line-through">₹{attrs.pricing.originalPrice}</span> : null}</p><p className="mt-1 truncate text-[10px] text-slate-500">{attrs.category || "Uncategorized"} · {sellerDetailsByItemId[item.id]?.shopName || "Seller"} · {item.source_city || "No seller city"}{attrs.stockQuantity != null ? ` · Stock ${attrs.stockQuantity}` : ""}</p></div>
              <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                <button type="button" data-testid={`button-toggle-product-${item.id}`} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.title}`} onClick={() => void toggleActive(item)} className={`rounded-lg border px-2.5 py-2 text-[10px] font-extrabold ${item.is_active ? "border-blue-100 bg-blue-50 text-[#1457A6]" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{item.is_active ? "Live" : "Off"}</button>
                <button type="button" data-testid={`button-edit-product-${item.id}`} aria-label={`Edit ${item.title}`} onClick={() => openEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#1457A6]"><Pencil size={14} /></button>
                <button type="button" data-testid={`button-delete-product-${item.id}`} aria-label={`Delete ${item.title}`} onClick={() => void deleteItem(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-100 text-[#8B1E2D] hover:bg-rose-50"><Trash2 size={14} /></button>
              </div>
            </article>;
          })}</div>}
        </div>}

         {panelTab === "orders" && <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70">
           <div className="m-4 mb-0 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
             <p className="font-extrabold">Orders &amp; payment verification</p>
             <p className="mt-1">Compare every submitted PhonePe UTR with the bank statement before confirming payment. Shipment status updates are enabled only after verification.</p>
           </div>
          {loadingOrders ? <div className="space-y-3 p-5">{[0, 1].map(value => <div key={value} className="h-56 animate-pulse rounded-2xl bg-white" />)}</div>
          : ordersError ? <div className="m-5 rounded-2xl border border-rose-200 bg-white p-7 text-center"><p className="font-bold text-[#8B1E2D]">{ordersError}</p><button type="button" onClick={() => void fetchOrders()} className={`${secondaryButton} mt-4`}>Retry</button></div>
          : !orders.length ? <div className="px-5 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[#1457A6]"><Package size={24} /></span><p className="mt-4 font-extrabold text-slate-800">No orders to manage</p><p className="mt-1 text-xs text-slate-500">Orders will appear after a customer checks out.</p></div>
          : <div className="space-y-3 p-4 sm:p-5">{orders.map(order => <article key={order.id} data-testid={`row-admin-order-${order.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
             <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-sm font-black text-slate-900">{order.tracking_code}</p><p className="mt-1 text-[10px] text-slate-500">{formatOrderTime(order.created_at)}</p></div><label><span className="sr-only">Shipment status for {order.tracking_code}</span><select data-testid={`select-order-status-${order.id}`} value={order.status} disabled={updatingOrderId === order.id || isUpiAwaitingVerification(order) || order.status === "Cancelled"} onChange={event => void updateOrderStatus(order.id, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400">{[order.status, ...SHIPPING_STATUSES.filter(status => !["Pending", "Verification Pending", order.status].includes(status))].map(status => <option key={status} value={status}>{status}</option>)}</select></label></div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-xs">
              <span className="text-slate-400">Product</span><span className="truncate font-bold text-slate-800">{order.item_title}</span>
              <span className="text-slate-400">Price</span><span className="font-bold text-[#1457A6]">{order.item_price || "—"}</span>
              <span className="text-slate-400">Customer</span><span className="truncate font-semibold text-slate-700">{order.user_name || "—"}</span>
              <span className="text-slate-400">Phone</span><span className="font-semibold text-slate-700">{order.phone || "—"}</span>
              {order.selected_size && <><span className="text-slate-400">Size</span><span className="font-semibold text-slate-700">{order.selected_size}</span></>}
              {order.selected_volume && <><span className="text-slate-400">Volume</span><span className="font-semibold text-slate-700">{order.selected_volume}</span></>}
              {order.selected_color && <><span className="text-slate-400">Color</span><span className="font-semibold text-slate-700">{order.selected_color}</span></>}
              <span className="text-slate-400">Ships from</span><span className="truncate font-semibold text-slate-700">{order.source_city || "Not recorded"}</span>
              <span className="text-slate-400">Deliver to</span><span className="truncate font-semibold text-slate-700">{order.destination_city || "Not recorded"}</span>
              <span className="text-slate-400">Payment</span><span className="font-semibold text-slate-700">{order.payment_method === "UPI" ? "PhonePe UPI" : "Cash on Delivery"}</span>
              {order.utr_id && <><span className="text-slate-400">UTR</span><span className="truncate font-mono font-semibold text-slate-700">{order.utr_id}</span></>}
            </div>
            {order.address && <p className="mt-3 flex gap-2 text-xs text-slate-600"><MapPin size={14} className="mt-0.5 shrink-0 text-[#8B1E2D]" />{order.address}</p>}
             {isUpiAwaitingVerification(order) && <div data-testid={`upi-verification-${order.id}`} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
               <p className="text-xs font-extrabold text-amber-900">Verification pending</p>
               <p className="mt-1 break-all font-mono text-xs font-bold text-slate-800">UTR: {order.utr_id || "Not submitted"}</p>
               <p className="mt-1 text-[11px] leading-relaxed text-amber-900">Match this transaction and amount against the bank statement. Do not approve based on the customer’s submission alone.</p>
               <button type="button" data-testid={`button-verify-upi-${order.id}`} disabled={updatingOrderId === order.id || !order.utr_id?.trim()} onClick={() => void verifyUpiOrder(order)} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1457A6] px-3 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
                 {updatingOrderId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Match UTR &amp; confirm payment
               </button>
             </div>}
              {order.status !== "Cancelled" && order.source_city && order.destination_city && <div className="mt-3"><OrderRouteMap sourceCity={order.source_city} destinationCity={order.destination_city} destinationAddress={order.address} status={order.status} currentLocation={order.current_location} /></div>}
              <div className="mt-3 flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Current shipment location</span><input data-testid={`input-order-location-${order.id}`} disabled={order.status === "Cancelled"} value={locationDrafts[order.id] ?? order.current_location ?? ""} onChange={event => setLocationDrafts(previous => ({ ...previous, [order.id]: event.target.value }))} placeholder="Current city or shipping hub" className={fieldClass} /></label><button type="button" data-testid={`button-save-order-location-${order.id}`} disabled={updatingLocationId === order.id || order.status === "Cancelled"} onClick={() => void updateCurrentLocation(order.id)} className={secondaryButton}>{updatingLocationId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}<span className="hidden sm:inline">Save location</span></button></div>
              <section className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div><h4 className="text-xs font-extrabold text-slate-900">Delivery partner &amp; ETA</h4><p className="mt-0.5 text-[10px] text-slate-500">Saved details appear on the customer tracking card.</p></div>
                  {order.estimated_delivery_at && <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-[#1457A6]"><Clock3 size={12} />{formatMilestoneEstimate(order.estimated_delivery_at, 3)}</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label><span className="mb-1 block text-[9px] font-bold text-slate-500">Partner name</span><input data-testid={`input-delivery-partner-name-${order.id}`} disabled={order.status === "Cancelled"} value={fulfillmentDrafts[order.id]?.partnerName ?? ""} onChange={event => setFulfillmentDrafts(previous => ({ ...previous, [order.id]: { ...(previous[order.id] ?? { partnerName: "", partnerPhone: "", estimatedDeliveryAt: "" }), partnerName: event.target.value } }))} placeholder="Name" className={fieldClass} /></label>
                  <label><span className="mb-1 block text-[9px] font-bold text-slate-500">Partner phone</span><input data-testid={`input-delivery-partner-phone-${order.id}`} type="tel" disabled={order.status === "Cancelled"} value={fulfillmentDrafts[order.id]?.partnerPhone ?? ""} onChange={event => setFulfillmentDrafts(previous => ({ ...previous, [order.id]: { ...(previous[order.id] ?? { partnerName: "", partnerPhone: "", estimatedDeliveryAt: "" }), partnerPhone: event.target.value } }))} placeholder="+91…" className={fieldClass} /></label>
                  <label><span className="mb-1 block text-[9px] font-bold text-slate-500">Estimated delivery</span><input data-testid={`input-estimated-delivery-${order.id}`} type="datetime-local" disabled={order.status === "Cancelled"} value={fulfillmentDrafts[order.id]?.estimatedDeliveryAt ?? ""} onChange={event => setFulfillmentDrafts(previous => ({ ...previous, [order.id]: { ...(previous[order.id] ?? { partnerName: "", partnerPhone: "", estimatedDeliveryAt: "" }), estimatedDeliveryAt: event.target.value } }))} className={fieldClass} /></label>
                </div>
                <button type="button" data-testid={`button-save-delivery-details-${order.id}`} disabled={updatingFulfillmentId === order.id || order.status === "Cancelled"} onClick={() => void saveOrderFulfillment(order.id)} className={`${secondaryButton} mt-2.5 w-full sm:w-auto`}>
                  {updatingFulfillmentId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Save partner &amp; ETA
                </button>
              </section>
          </article>)}</div>}
        </div>}

        <AnimatePresence>
          {showForm && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[510] flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-5" onClick={event => { if (event.target === event.currentTarget) setShowForm(false); }}>
            <motion.section initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 32 }} role="dialog" aria-modal="true" aria-label={editItem ? "Edit product" : "Add product"} className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]" onClick={event => event.stopPropagation()}>
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-extrabold text-slate-900">{editItem ? "Edit marketplace listing" : "Create a product listing"}</h3><p className="text-xs text-slate-500">Seller, fulfillment, variants and offer details</p></div><button type="button" data-testid="button-close-product-form" aria-label="Close product form" onClick={() => setShowForm(false)} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500"><X size={16} /></button></header>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <section className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <div><span className={fieldLabel}>Product image</span><button type="button" data-testid="button-upload-product-image" onClick={() => imageInputRef.current?.click()} className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">{form.image_url ? <><img src={form.image_url} alt="Product preview" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-slate-900/65 py-2 text-xs font-bold text-white">Change image</span></> : uploading ? <Loader2 size={22} className="animate-spin" /> : <span className="flex flex-col items-center gap-2"><ImageIcon size={25} /><span className="text-xs font-bold">Upload image</span></span>}</button><input ref={imageInputRef} data-testid="input-upload-product-image" type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void handleImageUpload(file); event.target.value = ""; }} /></div>
                  <div className="space-y-4"><label><span className={fieldLabel}>Product image URL</span><input data-testid="input-admin-image_url" value={form.image_url} onChange={event => setField("image_url", event.target.value)} placeholder="https://…" className={fieldClass} /></label>{formInput("title", "Product name *", "Product title")}<label><span className={fieldLabel}>Product description</span><textarea data-testid="input-admin-description" value={form.description} onChange={event => setField("description", event.target.value)} rows={3} placeholder="Materials, use, fit and other helpful details" className={`${fieldClass} resize-y`} /></label></div>
                </section>
                <section><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><Store size={15} className="text-[#1457A6]" /> Seller &amp; category</h4><div className="grid gap-3 sm:grid-cols-2">{formInput("shopName", "Shop / seller name", "Seller or shop name")}{formInput("category", "Category / product type", "For example: Home, fashion, personal care")}<label className="sm:col-span-2"><span className={fieldLabel}>Pickup address</span><textarea data-testid="input-admin-pickupAddress" value={form.pickupAddress} onChange={event => setField("pickupAddress", event.target.value)} rows={2} placeholder="Seller collection address" className={`${fieldClass} resize-y`} /></label>{formInput("source_city", "Seller city / shipping origin *", "City")}{formInput("pincode", "Pickup PIN code", "6-digit PIN")}{formInput("contactNumber", "Seller contact number", "+91", "tel")}</div></section>
                <section><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><CreditCard size={15} className="text-[#1457A6]" /> Pricing &amp; stock</h4><div className="grid gap-3 sm:grid-cols-2">{formInput("originalPrice", "Original price (₹)", "e.g. 1299", "number")}{formInput("discountedPrice", "Discount price (₹)", "e.g. 999", "number")}{formInput("discountPercent", "Discount percent", "Auto-calculated when blank", "number")}{formInput("offerTagline", "Offer tagline", "For example: Introductory offer")}{formInput("stockQuantity", "Stock quantity", "Units available", "number")}<label><span className={fieldLabel}>Listing badge</span><select data-testid="input-admin-badge" value={form.badge} onChange={event => setField("badge", event.target.value)} className={fieldClass}>{BADGE_OPTIONS.map(badge => <option key={badge} value={badge}>{badge || "No badge"}</option>)}</select></label>{!form.discountedPrice && formInput("price", "Legacy display price", "₹499")}</div></section>
                 <section><h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><Ruler size={15} className="text-[#1457A6]" /> Product options</h4><div className="grid gap-3 sm:grid-cols-2"><label><span className={fieldLabel}>Sizes (comma-separated)</span><input data-testid="input-admin-sizes" value={form.sizes} onChange={event => setField("sizes", event.target.value)} placeholder="S, M, L or 7, 8, 9" className={fieldClass} /></label><label><span className={fieldLabel}>Legacy colors (comma-separated)</span><input data-testid="input-admin-colors" value={form.colors} onChange={event => setField("colors", event.target.value)} placeholder="Black, White, Red" className={fieldClass} /></label><label><span className={fieldLabel}>Volume / capacity options</span><input data-testid="input-admin-volumes" value={form.volumes} onChange={event => setField("volumes", event.target.value)} placeholder="250 ml, 500 ml" className={fieldClass} /></label>{formInput("weight", "Weight", "e.g. 450 g")}{formInput("material", "Material", "e.g. Cotton, steel, glass")}{formInput("length", "Length", "e.g. 24", "number")}{formInput("width", "Width", "e.g. 18", "number")}{formInput("height", "Height", "e.g. 8", "number")}<label><span className={fieldLabel}>Dimensions unit</span><select data-testid="input-admin-dimensionUnit" value={form.dimensionUnit} onChange={event => setField("dimensionUnit", event.target.value)} className={fieldClass}><option value="cm">cm</option><option value="mm">mm</option><option value="in">in</option></select></label></div></section>
                <section><div className="mb-3 flex items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><Palette size={15} className="text-[#1457A6]" /> Color &amp; image variants</h4><button type="button" data-testid="button-add-color-variant" onClick={() => setColorVariants(current => [...current, { name: "", imageUrl: "" }])} className={secondaryButton}><Plus size={14} /> Add color</button></div>
                  {colorVariants.length ? <div className="space-y-2">{colorVariants.map((variant, index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1.6fr_auto]"><label><span className={fieldLabel}>Color name</span><input data-testid={`input-color-name-${index}`} value={variant.name} onChange={event => setColorVariants(current => current.map((entry, row) => row === index ? { ...entry, name: event.target.value } : entry))} placeholder="Midnight blue" className={fieldClass} /></label><label><span className={fieldLabel}>Color image URL</span><input data-testid={`input-color-image-${index}`} value={variant.imageUrl} onChange={event => setColorVariants(current => current.map((entry, row) => row === index ? { ...entry, imageUrl: event.target.value } : entry))} placeholder="https://…" className={fieldClass} /></label><button type="button" data-testid={`button-remove-color-${index}`} aria-label={`Remove color variant ${index + 1}`} onClick={() => setColorVariants(current => current.filter((_entry, row) => row !== index))} className="mt-5 grid h-10 w-10 place-items-center rounded-lg border border-rose-100 bg-white text-[#8B1E2D]"><Trash2 size={15} /></button></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">Add named colors and image URLs to let buyers preview each variant.</p>}
                </section>
                <section className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className={fieldLabel}>External product link (optional)</span><input data-testid="input-admin-link_url" value={form.link_url} onChange={event => setField("link_url", event.target.value)} placeholder="https://…" className={fieldClass} /></label></section>
              </div>
              <footer className="flex shrink-0 gap-3 border-t border-slate-100 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"><button type="button" data-testid="button-cancel-product-form" onClick={() => setShowForm(false)} className={`${secondaryButton} flex-1`}>Cancel</button><button type="button" data-testid="button-save-marketplace-product" disabled={saving || !form.title.trim()} onClick={() => void saveItem()} className={`${primaryButton} flex-[2]`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Saving…" : editItem ? "Save changes" : "Publish listing"}</button></footer>
            </motion.section>
          </motion.div>}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
