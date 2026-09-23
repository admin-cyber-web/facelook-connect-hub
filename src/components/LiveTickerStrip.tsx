/**
 * LiveTickerStrip — real-time horizontal marquee shown on every post card.
 *
 * Sources:
 *   • Community members — from peopleSuggestions + onlineUserIds presence set
 *   • Local weather     — Open-Meteo (free, no key) + BigDataCloud geocoding
 *   • Trending hashtags — extracted live from actual post content in the feed
 *
 * Animation: pure CSS `@keyframes` translateX — zero JS timers, zero RAF loops,
 * zero mobile heating. The track is duplicated so the loop is seamless.
 */
import { memo, useEffect, useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
export interface TickerProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  isOnline: boolean;
}

export interface TickerTag {
  tag: string;
  count: number;
}

interface Props {
  profiles: TickerProfile[];
  trendingTags: TickerTag[];
}

// ── WMO weather-code → [emoji, short label] ──────────────────────────────────
const WMO: Record<number, [string, string]> = {
  0: ["☀️", "Clear"],
  1: ["🌤️", "Mainly Clear"],
  2: ["⛅", "Partly Cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫️", "Foggy"],
  48: ["🌫️", "Icy Fog"],
  51: ["🌦️", "Light Drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌧️", "Heavy Drizzle"],
  61: ["🌧️", "Light Rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy Rain"],
  71: ["🌨️", "Light Snow"],
  73: ["❄️", "Snow"],
  75: ["❄️", "Heavy Snow"],
  80: ["🌧️", "Showers"],
  81: ["🌧️", "Rain Showers"],
  82: ["⛈️", "Heavy Showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Hail Storm"],
  99: ["⛈️", "Hail Storm"],
};

function wmoInfo(code: number): [string, string] {
  return WMO[code] ?? ["🌡️", "Unknown"];
}

// ── Module-level weather singleton — fetched once per browser session ─────────
type WeatherData = {
  temp: number;
  emoji: string;
  condition: string;
  city: string;
};

let _weatherCache: WeatherData | null = null;
let _weatherPromise: Promise<WeatherData | null> | null = null;
const _weatherCallbacks: Array<(d: WeatherData | null) => void> = [];

function loadWeather(): void {
  if (_weatherCache !== null || _weatherPromise !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;

  _weatherPromise = new Promise<WeatherData | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const [meteoRes, geoRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`
            ),
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`
            ),
          ]);
          const meteo = await meteoRes.json();
          const geo = await geoRes.json();
          const code: number = meteo.current?.weather_code ?? 0;
          const temp = Math.round(meteo.current?.temperature_2m ?? 22);
          const [emoji, condition] = wmoInfo(code);
          const city: string =
            geo.city ||
            geo.locality ||
            geo.localityInfo?.administrative?.[3]?.name ||
            geo.principalSubdivision ||
            "Local";
          const data: WeatherData = { temp, emoji, condition, city };
          _weatherCache = data;
          resolve(data);
          _weatherCallbacks.forEach((cb) => cb(data));
          _weatherCallbacks.length = 0;
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { timeout: 9000, maximumAge: 1800000 } // 30 min cache
    );
  });
}

function useWeather(): WeatherData | null {
  const [w, setW] = useState<WeatherData | null>(_weatherCache);
  useEffect(() => {
    if (_weatherCache) { setW(_weatherCache); return; }
    loadWeather();
    if (_weatherPromise) {
      _weatherCallbacks.push(setW);
    }
    return () => {
      const idx = _weatherCallbacks.indexOf(setW);
      if (idx !== -1) _weatherCallbacks.splice(idx, 1);
    };
  }, []);
  return w;
}

// ── CSS injection (once per app lifetime) ────────────────────────────────────
let _cssInjected = false;
function ensureCSS() {
  if (_cssInjected || typeof document === "undefined") return;
  _cssInjected = true;
  const el = document.createElement("style");
  el.dataset.liveTickerStrip = "1";
  el.textContent = `
    @keyframes lt-marquee {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .lt-track {
      display: flex;
      white-space: nowrap;
      animation: lt-marquee 38s linear infinite;
      will-change: transform;
      contain: layout style;
    }
    .lt-track:hover { animation-play-state: paused; }
  `;
  document.head.appendChild(el);
}

// ── Separator atom ────────────────────────────────────────────────────────────
const Sep = () => (
  <span className="mx-3 text-white/15 select-none" aria-hidden>·</span>
);

// ── User chip ─────────────────────────────────────────────────────────────────
const UserChip = ({ p }: { p: TickerProfile }) => (
  <span className="inline-flex items-center gap-1.5 shrink-0">
    {/* Avatar */}
    <span
      className="w-[18px] h-[18px] rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center text-[8px] font-black"
      style={{
        background: p.isOnline
          ? "linear-gradient(135deg,#00F0FF,#2563eb)"
          : "rgba(255,255,255,0.12)",
        boxShadow: p.isOnline ? "0 0 6px rgba(0,240,255,0.5)" : "none",
        color: "#fff",
      }}
    >
      {p.avatar_url ? (
        <img
          src={p.avatar_url}
          className="w-full h-full object-cover"
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        (p.full_name?.[0] ?? "U").toUpperCase()
      )}
    </span>
    {/* Name */}
    <span
      className="text-[10px] font-bold tracking-tight"
      style={{ color: p.isOnline ? "#00F0FF" : "rgba(255,255,255,0.45)" }}
    >
      {p.full_name?.split(" ")[0] ?? "Member"}
    </span>
    {p.isOnline && (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: "#00F0FF", boxShadow: "0 0 4px #00F0FF" }}
      />
    )}
  </span>
);

// ── Weather chip ──────────────────────────────────────────────────────────────
const WeatherChip = ({ w }: { w: WeatherData }) => (
  <span className="inline-flex items-center gap-1 shrink-0">
    <span className="text-[12px] leading-none">{w.emoji}</span>
    <span
      className="text-[10px] font-bold"
      style={{ color: "#fbbf24" }}
    >
      {w.temp}°C
    </span>
    <span
      className="text-[10px] font-medium"
      style={{ color: "rgba(251,191,36,0.6)" }}
    >
      {w.city} · {w.condition}
    </span>
  </span>
);

// ── Tag chip ──────────────────────────────────────────────────────────────────
const TagChip = ({ tag, count }: TickerTag) => (
  <span className="inline-flex items-center gap-1 shrink-0">
    {count >= 3 && (
      <span className="text-[10px] leading-none">🔥</span>
    )}
    <span
      className="text-[10px] font-black tracking-tight"
      style={{ color: "#f472b6" }}
    >
      {tag}
    </span>
    {count >= 2 && (
      <span
        className="text-[9px] font-bold"
        style={{ color: "rgba(244,114,182,0.5)" }}
      >
        ×{count}
      </span>
    )}
  </span>
);

// ── Main ticker component ────────────────────────────────────────────────────
const LiveTickerStrip = memo(function LiveTickerStrip({ profiles, trendingTags }: Props) {
  // Inject CSS on first render
  useEffect(() => { ensureCSS(); }, []);

  // Kick off weather load
  useEffect(() => { loadWeather(); }, []);

  const weather = useWeather();

  // Build the ticker item list
  const items = useMemo<React.ReactNode[]>(() => {
    const online = profiles.filter((p) => p.isOnline);
    const offline = profiles.filter((p) => !p.isOnline);
    const all: React.ReactNode[] = [];

    // --- Online users first ---
    for (const p of online.slice(0, 5)) {
      all.push(<UserChip key={`u-on-${p.id}`} p={p} />);
      all.push(<Sep key={`s-on-${p.id}`} />);
    }

    // --- Weather ---
    if (weather) {
      all.push(<WeatherChip key="weather" w={weather} />);
      all.push(<Sep key="s-weather" />);
    }

    // --- Top trending tags ---
    for (const t of trendingTags.slice(0, 6)) {
      all.push(<TagChip key={`tag-${t.tag}`} tag={t.tag} count={t.count} />);
      all.push(<Sep key={`s-tag-${t.tag}`} />);
    }

    // --- Offline / cycling members ---
    for (const p of offline.slice(0, 4)) {
      all.push(<UserChip key={`u-off-${p.id}`} p={p} />);
      all.push(<Sep key={`s-off-${p.id}`} />);
    }

    // --- Activity filler when sparse ---
    if (online.length > 0) {
      all.push(
        <span key="active-count" className="inline-flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold" style={{ color: "#00F0FF" }}>
            {online.length}
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {online.length === 1 ? "member" : "members"} active now
          </span>
        </span>
      );
      all.push(<Sep key="s-active" />);
    }

    return all;
  }, [profiles, trendingTags, weather]);

  // Don't render until we have at least something to show
  if (items.length === 0) return null;

  return (
    <div
      className="lt-wrap border-t border-b"
      style={{
        borderColor: "rgba(255,255,255,0.04)",
        background: "rgba(0,0,0,0.28)",
        height: 30,
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* LIVE badge — pinned left, outside the scroll */}
      <span
        className="shrink-0 text-[8px] font-black tracking-widest px-2 border-r flex items-center gap-1"
        style={{
          color: "#00F0FF",
          borderColor: "rgba(0,240,255,0.15)",
          height: "100%",
          background: "rgba(0,240,255,0.06)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "#00F0FF", boxShadow: "0 0 4px #00F0FF" }}
        />
        LIVE
      </span>

      {/* Scrolling track — content duplicated for seamless loop */}
      <div className="overflow-hidden flex-1" style={{ height: "100%" }}>
        <div
          className="lt-track h-full items-center"
          style={{ width: "max-content" }}
        >
          {/* First copy */}
          <span className="inline-flex items-center px-4" style={{ gap: 0 }}>
            {items}
          </span>
          {/* Second copy (enables seamless loop) */}
          <span className="inline-flex items-center px-4" style={{ gap: 0 }}>
            {items}
          </span>
        </div>
      </div>
    </div>
  );
});

export default LiveTickerStrip;
