import { motion } from "framer-motion";

interface OrderRouteMapProps {
  sourceCity: string;
  destinationCity: string;
  status: string;
  currentLocation?: string | null;
}

interface RoutePoint {
  x: number;
  y: number;
}

const STATUS_PROGRESS: Record<string, number> = {
  Pending: 0,
  Confirmed: 0,
  Packed: 1,
  Shipped: 1,
  "In Transit": 2,
  "At Regional Hub": 3,
  "Out for Delivery": 3,
  Delivered: 4,
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
  const startY = 118 + ((hash >>> 3) % 39);
  const endY = 42 + ((hash >>> 11) % 45);
  const bend = 18 + ((hash >>> 19) % 28);

  const start = { x: 28, y: startY };
  const end = { x: 332, y: endY };
  const hubs = [0.29, 0.58, 0.82].map((t, index) => {
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

export function OrderRouteMap({
  sourceCity,
  destinationCity,
  status,
  currentLocation,
}: OrderRouteMapProps) {
  const points = makeRoute(sourceCity, destinationCity);
  const startY = points[0].y;
  const endY = points[points.length - 1].y;
  const progressIndex = Math.max(0, Math.min(4, STATUS_PROGRESS[status] ?? 0));
  const currentPoint = points[progressIndex];
  const completedPath = makePath(points.slice(0, progressIndex + 1));
  const milestoneLabels = ["", "Transit 1", "Transit 2", "Local Hub", ""];
  const defaultLocation = progressIndex === 4
    ? destinationCity
    : milestoneLabels[progressIndex] || sourceCity;
  const displayedLocation = currentLocation?.trim() || defaultLocation;

  return (
    <section
      aria-label={`Illustrative order route from ${sourceCity} to ${destinationCity}`}
      data-testid="order-route-map"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black text-slate-900">Shipment route</p>
          <p className="mt-0.5 text-[9px] font-bold text-slate-500">Illustrative schematic · not to scale</p>
        </div>
        <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black text-[#1457A6]">
          {status}
        </span>
      </div>

      <div
        className="mx-3 mt-2 overflow-hidden rounded-xl border border-blue-100"
        style={{
          backgroundColor: "#F4F8FD",
          backgroundImage:
            "linear-gradient(rgba(20,87,166,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(20,87,166,.055) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <svg
          viewBox="0 0 360 184"
          role="img"
          aria-label={`Route progress: ${sourceCity} to ${destinationCity}; current location ${displayedLocation}`}
          className="block h-[158px] w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d={makePath(points)}
            fill="none"
            stroke="rgba(100,116,139,.36)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 8"
          />
          {progressIndex > 0 && (
            <motion.path
              key={`${sourceCity}-${destinationCity}-${status}`}
              d={completedPath}
              fill="none"
              stroke="#8B1E2D"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          )}

          {points.map((point, index) => {
            const isCurrent = index === progressIndex;
            const hasPassed = index < progressIndex;
            return (
              <g key={`route-node-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isCurrent ? 6 : 4.5}
                  fill={hasPassed ? "#8B1E2D" : "#FFFFFF"}
                  stroke={hasPassed || isCurrent ? "#8B1E2D" : "#94A3B8"}
                  strokeWidth="2"
                />
                {index > 0 && index < points.length - 1 && (
                  <text
                    x={point.x}
                    y={point.y < 80 ? point.y + 19 : point.y - 10}
                    textAnchor="middle"
                    className="fill-slate-500"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {milestoneLabels[index]}
                  </text>
                )}
              </g>
            );
          })}

          <motion.circle
            key={`current-pulse-${sourceCity}-${destinationCity}-${progressIndex}`}
            cx={currentPoint.x}
            cy={currentPoint.y}
            fill="rgba(20,87,166,.17)"
            stroke="#1457A6"
            strokeWidth="1.5"
            animate={{ r: [8, 14, 8], opacity: [0.95, 0.12, 0.95] }}
            transition={{ duration: 1.65, repeat: Infinity, ease: "easeInOut" }}
          />
          <circle cx={currentPoint.x} cy={currentPoint.y} r="4.5" fill="#1457A6" stroke="#FFFFFF" strokeWidth="1.5" />

          <text x="28" y={Math.min(176, startY + 24)} textAnchor="middle" fill="#475569" fontSize="8" fontWeight="800">
            ORIGIN
          </text>
          <text x="332" y={Math.max(12, endY - 12)} textAnchor="middle" fill="#475569" fontSize="8" fontWeight="800">
            DESTINATION
          </text>
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">From</p>
          <p className="truncate text-[11px] font-black text-slate-800">{sourceCity}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1457A6] opacity-30" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1457A6]" />
          </span>
          <span className="max-w-[110px] truncate text-[9px] font-black text-[#1457A6]">{displayedLocation}</span>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">To</p>
          <p className="truncate text-[11px] font-black text-slate-800">{destinationCity}</p>
        </div>
      </div>
    </section>
  );
}
