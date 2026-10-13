import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

interface OrderRouteMapProps {
  sourceCity: string;
  destinationCity: string;
  destinationAddress?: string | null;
  status: string;
  currentLocation?: string | null;
}

interface RoutePoint {
  x: number;
  y: number;
}

const STATUS_PROGRESS: Record<string, number> = {
  "Verification Pending": 0.02,
  Pending: 0.02,
  Confirmed: 0.08,
  Packed: 0.18,
  Shipped: 0.34,
  "In Transit": 0.56,
  "At Regional Hub": 0.76,
  "Out for Delivery": 0.91,
  Delivered: 1,
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRoute(sourceCity: string, destinationCity: string): RoutePoint[] {
  const hash = stableHash(`${sourceCity.trim().toLowerCase()}->${destinationCity.trim().toLowerCase()}`);
  const startY = 150 + ((hash >>> 3) % 25);
  const endY = 54 + ((hash >>> 11) % 35);
  const bend = 19 + ((hash >>> 19) % 25);
  const start = { x: 30, y: startY };
  const end = { x: 330, y: endY };
  const hubs = [0.28, 0.54, 0.79].map((t, index) => {
    const baseY = startY + (endY - startY) * t;
    const direction = index % 2 === 0 ? 1 : -1;
    const variation = Math.sin(Math.PI * t) * bend * direction;
    return { x: start.x + (end.x - start.x) * t, y: baseY + variation };
  });
  return [start, ...hubs, end];
}

function makePath(points: RoutePoint[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getPointAtProgress(points: RoutePoint[], progress: number) {
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = totalLength * Math.max(0, Math.min(1, progress));

  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    const start = points[index];
    const end = points[index + 1];
    if (remaining <= length || index === lengths.length - 1) {
      const portion = length === 0 ? 0 : Math.min(1, remaining / length);
      const point = {
        x: start.x + (end.x - start.x) * portion,
        y: start.y + (end.y - start.y) * portion,
      };
      return { point, completedPath: makePath([...points.slice(0, index + 1), point]) };
    }
    remaining -= length;
  }
  return { point: points[0], completedPath: makePath([points[0]]) };
}

export function OrderRouteMap({
  sourceCity,
  destinationCity,
  destinationAddress,
  status,
  currentLocation,
}: OrderRouteMapProps) {
  const prefersReducedMotion = useReducedMotion();
  const instanceId = useId().replace(/:/g, "");
  const landGradientId = `route-land-${instanceId}`;
  const routeGlowId = `route-glow-${instanceId}`;
  const points = makeRoute(sourceCity, destinationCity);
  const progress = STATUS_PROGRESS[status] ?? 0.02;
  const { point: truckPoint, completedPath } = getPointAtProgress(points, progress);
  const displayedLocation = currentLocation?.trim()
    || (progress >= 1 ? destinationCity : progress < 0.2 ? sourceCity : "Shipment in transit");
  const landmarks = [
    { x: points[1].x - 5, y: points[1].y - 30, icon: "🌳", label: "Park" },
    { x: points[2].x + 13, y: points[2].y + 27, icon: "🏬", label: "Market" },
    { x: points[3].x - 11, y: points[3].y - 29, icon: "🏙️", label: "City" },
  ];

  return (
    <section
      aria-label={`Order route from ${sourceCity} to ${destinationCity}`}
      data-testid="order-route-map"
      className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black text-slate-900">Live shipment route</p>
          <p className="mt-0.5 text-[9px] font-semibold text-slate-400">Illustrated route · updates with shipment status</p>
        </div>
        <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-black text-[#1457A6]">
          {status}
        </span>
      </div>

      <div className="relative mx-3 mt-2 overflow-hidden rounded-xl border border-sky-100 bg-[#eaf5fb]">
        <svg
          viewBox="0 0 360 205"
          role="img"
          aria-label={`Route progress: ${sourceCity} to ${destinationCity}; current location ${displayedLocation}`}
          className="block h-[188px] w-full sm:h-[218px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={landGradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f6f8df" />
              <stop offset="100%" stopColor="#dff1df" />
            </linearGradient>
            <filter id={routeGlowId} x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="360" height="205" fill={`url(#${landGradientId})`} />

          <path d="M0 17 C51 29 52 58 24 81 C7 95 11 130 0 145Z" fill="#c3e7f3" />
          <path d="M360 112 C334 103 332 75 348 57 C356 48 353 31 360 23Z" fill="#c3e7f3" />
          <path d="M89 0 C112 20 127 19 148 0 M241 205 C265 177 301 183 360 169" fill="none" stroke="#c6e8c4" strokeWidth="25" opacity=".72" />
          <path d="M0 52 L360 151 M21 205 L311 0 M116 205 L190 0 M0 121 L360 44" fill="none" stroke="#d8d6c8" strokeWidth="13" opacity=".74" />
          <path d="M0 52 L360 151 M21 205 L311 0 M116 205 L190 0 M0 121 L360 44" fill="none" stroke="#fffdf1" strokeWidth="8" opacity=".98" />
          <path d="M0 52 L360 151 M21 205 L311 0 M116 205 L190 0 M0 121 L360 44" fill="none" stroke="#c3bfae" strokeWidth="1" strokeDasharray="3 5" opacity=".8" />

          <path d={makePath(points)} fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <path d={makePath(points)} fill="none" stroke="#a9b7c8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 8" />
          <motion.path
            key={`route-progress-${sourceCity}-${destinationCity}-${status}`}
            d={completedPath}
            fill="none"
            stroke="#e8435b"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0.45 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: "easeOut" }}
          />

          {landmarks.map(landmark => (
            <g key={landmark.label} transform={`translate(${landmark.x}, ${landmark.y})`}>
              <circle r="12" fill="#fff" stroke="#d7e7d7" strokeWidth="1.5" />
              <text x="0" y="4.5" textAnchor="middle" fontSize="13">{landmark.icon}</text>
            </g>
          ))}

          {points.slice(1, -1).map((routePoint, index) => (
            <g key={`hub-${index}`} transform={`translate(${routePoint.x}, ${routePoint.y})`}>
              <circle r="5.5" fill="#fff" stroke="#8da2b6" strokeWidth="2" />
              <circle r="1.5" fill="#e8435b" />
            </g>
          ))}

          {[points[0], points[points.length - 1]].map((pin, index) => (
            <g key={index} transform={`translate(${pin.x}, ${pin.y})`}>
              <motion.circle
                r="10"
                fill={index === 0 ? "#0f9f75" : "#e8435b"}
                opacity=".22"
                filter={`url(#${routeGlowId})`}
                animate={prefersReducedMotion ? undefined : { r: [10, 19, 10], opacity: [.36, 0, .36] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <path
                d="M0 9 C-2 5 -8 -1 -8 -6 A8 8 0 1 1 8 -6 C8 -1 2 5 0 9Z"
                fill={index === 0 ? "#0f9f75" : "#e8435b"}
                stroke="#fff"
                strokeWidth="2"
              />
              <circle cy="-6" r="2.5" fill="#fff" />
            </g>
          ))}

          <motion.g
            initial={false}
            animate={{ x: truckPoint.x, y: truckPoint.y }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 62, damping: 15 }}
            aria-label="Delivery truck position"
          >
            <g transform="translate(-16,-13)" filter={`url(#${routeGlowId})`}>
              <rect x="0" y="2" width="21" height="13" rx="3" fill="#1457a6" stroke="#fff" strokeWidth="1.5" />
              <path d="M21 6h7l5 5v4H21Z" fill="#e8435b" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M23 7.5h4l3 3.5h-7Z" fill="#c9f0ff" />
              <circle cx="7" cy="17" r="3" fill="#26364b" stroke="#fff" strokeWidth="1.4" />
              <circle cx="27" cy="17" r="3" fill="#26364b" stroke="#fff" strokeWidth="1.4" />
            </g>
          </motion.g>

          <g>
            <rect x="13" y={Math.max(7, points[0].y - 30)} width="84" height="17" rx="8.5" fill="#fff" opacity=".92" />
            <text x="55" y={Math.max(19, points[0].y - 18)} textAnchor="middle" fill="#087653" fontSize="8" fontWeight="800">{sourceCity}</text>
            <rect x="263" y={Math.max(7, points[points.length - 1].y - 32)} width="84" height="17" rx="8.5" fill="#fff" opacity=".92" />
            <text x="305" y={Math.max(19, points[points.length - 1].y - 20)} textAnchor="middle" fill="#b52e45" fontSize="8" fontWeight="800">{destinationCity}</text>
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">Pickup</p>
          <p className="truncate text-[11px] font-black text-slate-800">{sourceCity}</p>
        </div>
        <div className="flex min-w-0 max-w-[48%] items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1457A6] opacity-30" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1457A6]" />
          </span>
          <span className="truncate text-[9px] font-black text-[#1457A6]">{displayedLocation}</span>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">Destination</p>
          <p className="truncate text-[11px] font-black text-slate-800">{destinationCity}</p>
        </div>
      </div>
      {destinationAddress?.trim() && (
        <p className="border-t border-slate-100 px-3.5 py-2 text-[10px] leading-relaxed text-slate-600">
          <span className="font-extrabold text-slate-800">Deliver to:</span> {destinationAddress}
        </p>
      )}
    </section>
  );
}
