import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import {
  Bluetooth,
  ChevronDown,
  ChevronUp,
  Loader2,
  Satellite,
  ShieldCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import "./ProximitySatellite.css";

type AdvertisedProfile = {
  userId: string;
  name: string;
  username: string;
  bio: string;
  avatarData: string;
};

type NearbyPeer = AdvertisedProfile & {
  peerToken: string;
  rssi?: number;
  approximateMeters?: number;
};

type NativeSignal = {
  peerToken?: string;
  active?: boolean;
};

type ProximityBlePlugin = {
  start(options: {
    userId: string;
    profile: AdvertisedProfile | null;
    advertising: boolean;
    stealth: boolean;
  }): Promise<{ status?: string }>;
  updateProfile(options: {
    userId: string;
    profile: AdvertisedProfile | null;
    advertising: boolean;
  }): Promise<void>;
  setStealth(options: { enabled: boolean }): Promise<void>;
  reject(options: { peerToken: string; peerId: string }): Promise<void>;
  sync(): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: "peerFound", listener: (peer: NearbyPeer) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "signal", listener: (signal: NativeSignal) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "status", listener: (event: { status?: string }) => void): Promise<PluginListenerHandle>;
};

const NativeProximity = registerPlugin<ProximityBlePlugin>("ProximityBle");
const STEALTH_KEY = "flicks-proximity-stealth-v1";
const PROFILE_CACHE_PREFIX = "flicks-proximity-profile-v1:";
const REQUEST_QUEUE_PREFIX = "flicks-proximity-requests-v1:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProximitySatelliteProps {
  userId: string;
  profile: Record<string, any>;
  canAdvertise: boolean;
}

function readCachedProfile(userId: string): AdvertisedProfile | null {
  try {
    const value = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as AdvertisedProfile;
    return parsed?.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}

async function avatarThumbnail(url: string): Promise<string> {
  if (!url) return "";
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) return "";

    const size = 72;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return "";
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    let thumbnail = canvas.toDataURL("image/jpeg", 0.38);
    if (thumbnail.length > 12_500) {
      canvas.width = 56;
      canvas.height = 56;
      const small = canvas.getContext("2d", { alpha: false });
      if (!small) return "";
      const smallScale = Math.max(56 / image.naturalWidth, 56 / image.naturalHeight);
      const smallWidth = image.naturalWidth * smallScale;
      const smallHeight = image.naturalHeight * smallScale;
      small.drawImage(image, (56 - smallWidth) / 2, (56 - smallHeight) / 2, smallWidth, smallHeight);
      thumbnail = canvas.toDataURL("image/jpeg", 0.3);
    }
    return thumbnail.length <= 12_500 ? thumbnail : "";
  } catch {
    // Keep the last locally cached photo when the device is offline or the image is cross-origin.
    return "";
  }
}

function readRequestQueue(userId: string): Array<{ peerId: string; queuedAt: number }> {
  try {
    const value = localStorage.getItem(`${REQUEST_QUEUE_PREFIX}${userId}`);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => UUID_PATTERN.test(item?.peerId || "")).slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

function saveRequestQueue(userId: string, queue: Array<{ peerId: string; queuedAt: number }>) {
  try {
    localStorage.setItem(`${REQUEST_QUEUE_PREFIX}${userId}`, JSON.stringify(queue.slice(0, 100)));
  } catch {
    // A failed local save is reported to the user by the caller.
  }
}

export default function ProximitySatellite({
  userId,
  profile,
  canAdvertise,
}: ProximitySatelliteProps) {
  const androidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [stealth, setStealth] = useState(
    () => localStorage.getItem(STEALTH_KEY) === "true",
  );
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(
    androidNative ? "Starting local Bluetooth…" : "Use the Android app for automatic BLE",
  );
  const [nativeReady, setNativeReady] = useState(false);
  const [preparedProfile, setPreparedProfile] = useState<AdvertisedProfile | null>(
    () => readCachedProfile(userId),
  );
  const [activeSignals, setActiveSignals] = useState<Set<string>>(() => new Set());
  const [peerQueue, setPeerQueue] = useState<NearbyPeer[]>([]);
  const [busy, setBusy] = useState(false);
  const announcedTokens = useRef(new Set<string>());
  const queuedTokens = useRef(new Set<string>());
  const stealthRef = useRef(stealth);
  const peerQueueRef = useRef(peerQueue);

  useEffect(() => {
    stealthRef.current = stealth;
    localStorage.setItem(STEALTH_KEY, String(stealth));
  }, [stealth]);

  useEffect(() => {
    peerQueueRef.current = peerQueue;
  }, [peerQueue]);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedProfile(userId);
    if (cached) setPreparedProfile(cached);

    const name = String(profile?.full_name || profile?.name || "").trim().slice(0, 100);
    const username = String(profile?.username || "").trim().slice(0, 40);
    const bio = String(profile?.bio || "").trim().slice(0, 480);
    const avatarUrl = String(profile?.avatar_url || "");

    if (!name && !username && !cached) return;
    void (async () => {
      let avatarData = cached?.avatarData || "";
      if (avatarUrl && cached?.avatarUrl !== avatarUrl) {
        const thumbnail = await avatarThumbnail(avatarUrl);
        if (thumbnail) avatarData = thumbnail;
      }
      const next: AdvertisedProfile = {
        userId,
        name: name || cached?.name || username || "Flicks user",
        username: username || cached?.username || "",
        bio: bio || cached?.bio || "",
        avatarData,
      };
      if (cancelled) return;
      setPreparedProfile(next);
      try {
        localStorage.setItem(
          `${PROFILE_CACHE_PREFIX}${userId}`,
          JSON.stringify({ ...next, avatarUrl }),
        );
      } catch {
        // The native service still keeps the most recent profile in private app storage.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profile?.full_name, profile?.name, profile?.username, profile?.bio, profile?.avatar_url]);

  useEffect(() => {
    if (!androidNative || !userId) return;
    let cancelled = false;
    let started = false;
    const listeners: PluginListenerHandle[] = [];

    const removeListeners = () => {
      listeners.forEach((listener) => void listener.remove());
      listeners.length = 0;
    };

    void (async () => {
      try {
        listeners.push(
          await NativeProximity.addListener("status", ({ status: nextStatus }) => {
            if (nextStatus) setStatus(nextStatus);
          }),
        );
        listeners.push(
          await NativeProximity.addListener("signal", (signal) => {
            const token = signal.peerToken;
            if (!token) return;
            if (signal.active) {
              announcedTokens.current.add(token);
              setActiveSignals((current) => new Set(current).add(token));
              return;
            }
            announcedTokens.current.delete(token);
            setActiveSignals((current) => {
              const next = new Set(current);
              next.delete(token);
              return next;
            });
          }),
        );
        listeners.push(
          await NativeProximity.addListener("peerFound", (rawPeer) => {
            const peerToken = String(rawPeer?.peerToken || "");
            const peerId = String(rawPeer?.userId || "");
            if (!peerToken || !UUID_PATTERN.test(peerId) || peerId === userId) return;
            if (queuedTokens.current.has(peerToken)) return;
            queuedTokens.current.add(peerToken);
            announcedTokens.current.add(peerToken);
            const peer: NearbyPeer = {
              userId: peerId,
              peerToken,
              name: String(rawPeer.name || rawPeer.username || "Flicks user").slice(0, 100),
              username: String(rawPeer.username || "").slice(0, 40),
              bio: String(rawPeer.bio || "").slice(0, 480),
              avatarData: String(rawPeer.avatarData || ""),
              rssi: Number(rawPeer.rssi) || undefined,
              approximateMeters: Number(rawPeer.approximateMeters) || undefined,
            };
            setPeerQueue((current) => [...current.filter((item) => item.peerToken !== peerToken), peer]);
          }),
        );

        if (cancelled) {
          removeListeners();
          return;
        }
        const cachedProfile = readCachedProfile(userId) || preparedProfile;
        await NativeProximity.start({
          userId,
          profile: cachedProfile,
          advertising: Boolean(canAdvertise && cachedProfile?.name),
          stealth: stealthRef.current,
        });
        started = true;
        if (cancelled) {
          await NativeProximity.stop();
          removeListeners();
          return;
        }
        setNativeReady(true);
        await NativeProximity.sync();
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Bluetooth permission is needed to start nearby discovery",
        );
      }
    })();

    return () => {
      cancelled = true;
      removeListeners();
      if (started) void NativeProximity.stop();
      setNativeReady(false);
    };
  }, [androidNative, userId]);

  useEffect(() => {
    if (!androidNative || !nativeReady) return;
    void NativeProximity.setStealth({ enabled: stealth }).catch(() => {});
  }, [androidNative, nativeReady, stealth]);

  useEffect(() => {
    if (!androidNative || !nativeReady) return;
    void NativeProximity.updateProfile({
      userId,
      profile: preparedProfile,
      advertising: Boolean(canAdvertise && preparedProfile?.name),
    }).catch(() => {});
  }, [androidNative, nativeReady, userId, preparedProfile, canAdvertise]);

  const currentPeer = peerQueue[0] || null;
  const signalActive = activeSignals.size > 0;
  const alerting = signalActive && !stealth;

  const finishCurrentPeer = useCallback(() => {
    const peer = peerQueueRef.current[0];
    if (peer) queuedTokens.current.delete(peer.peerToken);
    setPeerQueue((current) => current.slice(1));
  }, []);

  const rejectPeer = useCallback(async () => {
    if (!currentPeer) return;
    try {
      await NativeProximity.reject({
        peerToken: currentPeer.peerToken,
        peerId: currentPeer.userId,
      });
    } catch {
      // The device cooldown is also recorded locally below.
    }
    try {
      localStorage.setItem(
        `flicks-proximity-reject:${userId}:${currentPeer.userId}`,
        String(Date.now()),
      );
    } catch {}
    finishCurrentPeer();
  }, [currentPeer, finishCurrentPeer, userId]);

  const sendFriendRequest = useCallback(async (peerId: string) => {
    if (!UUID_PATTERN.test(peerId) || peerId === userId) {
      throw new Error("This nearby profile can’t receive a connection request.");
    }
    const { data: existing, error: lookupError } = await supabase
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.status === "accepted") return "already-connected";
    if (existing?.status === "pending") {
      if (existing.receiver_id === userId) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", existing.id);
        if (error) throw error;
        return "connected";
      }
      return "already-pending";
    }
    if (existing?.status === "rejected") {
      const { error } = await supabase.from("friendships").delete().eq("id", existing.id);
      if (error) throw error;
    }
    const { error } = await supabase.from("friendships").insert({
      sender_id: userId,
      receiver_id: peerId,
      status: "pending",
    });
    if (error) throw error;
    return "sent";
  }, [userId]);

  const connectPeer = useCallback(async () => {
    if (!currentPeer || busy) return;
    setBusy(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const queue = readRequestQueue(userId);
        if (!queue.some((item) => item.peerId === currentPeer.userId)) {
          queue.push({ peerId: currentPeer.userId, queuedAt: Date.now() });
          saveRequestQueue(userId, queue);
        }
        toast.success("Saved on this device. The request will send when you’re back online.");
        finishCurrentPeer();
        return;
      }
      const result = await sendFriendRequest(currentPeer.userId);
      if (result === "sent") toast.success("Connection request sent.");
      else if (result === "connected" || result === "already-connected") {
        toast.success("You’re connected.");
        window.dispatchEvent(new Event("flicks:open-chat"));
      } else toast.info("A connection request is already waiting.");
      finishCurrentPeer();
    } catch (error) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const queue = readRequestQueue(userId);
        if (!queue.some((item) => item.peerId === currentPeer.userId)) {
          queue.push({ peerId: currentPeer.userId, queuedAt: Date.now() });
          saveRequestQueue(userId, queue);
        }
        toast.success("Saved on this device. The request will send when you’re back online.");
        finishCurrentPeer();
      } else {
        toast.error(error instanceof Error ? error.message : "Could not send the connection request.");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, currentPeer, finishCurrentPeer, sendFriendRequest, userId]);

  useEffect(() => {
    const flushQueuedRequests = async () => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      const queue = readRequestQueue(userId);
      const remaining: typeof queue = [];
      for (const item of queue) {
        try {
          await sendFriendRequest(item.peerId);
        } catch {
          remaining.push(item);
        }
      }
      saveRequestQueue(userId, remaining);
    };
    void flushQueuedRequests();
    window.addEventListener("online", flushQueuedRequests);
    return () => window.removeEventListener("online", flushQueuedRequests);
  }, [sendFriendRequest, userId]);

  const toggleStealth = () => {
    setStealth((current) => !current);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className={`proximity-satellite ${alerting ? "proximity-satellite--alert" : ""}`}>
        <AnimatePresence>
          {expanded && (
            <motion.section
              className="proximity-satellite__panel"
              initial={{ opacity: 0, x: 14, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 14, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              aria-label="Satellite proximity controls"
            >
              <div className="proximity-satellite__panel-head">
                <div className="proximity-satellite__panel-icon"><Satellite size={17} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">Local Satellite</p>
                  <p className="text-[10px] text-white/55">Automatic Bluetooth discovery</p>
                </div>
                <button
                  type="button"
                  className="proximity-satellite__close"
                  onClick={() => setExpanded(false)}
                  aria-label="Collapse satellite controls"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="proximity-satellite__status-card">
                <span className={`proximity-satellite__status-dot ${alerting ? "is-red" : "is-blue"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{androidNative ? "This phone" : "Android app required"}</p>
                  <p className="text-[10px] leading-relaxed text-white/55">
                    {androidNative ? status : "The browser cannot scan or broadcast BLE automatically."}
                  </p>
                </div>
              </div>

              <div className="proximity-satellite__stat-row">
                <span><Bluetooth size={13} /> Scanner</span>
                <strong className={androidNative ? "text-sky-300" : "text-white/45"}>
                  {androidNative ? "Auto" : "Unavailable"}
                </strong>
              </div>
              <div className="proximity-satellite__stat-row">
                <span><Satellite size={13} /> Nearby signals</span>
                <strong className={alerting ? "text-red-300" : "text-white/75"}>
                  {stealth ? "Muted" : activeSignals.size}
                </strong>
              </div>
              <div className="proximity-satellite__privacy-note">
                <ShieldCheck size={13} />
                <span>Proximity and profile exchange stay on-device. Connection requests sync when online.</span>
              </div>

              <label className="proximity-satellite__stealth">
                <span className="flex items-center gap-2 text-xs font-bold text-white">
                  {stealth ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  Stealth / Mute alerts
                </span>
                <input
                  type="checkbox"
                  checked={stealth}
                  onChange={toggleStealth}
                  aria-label="Mute proximity audio, vibration, and red signal"
                />
                <span className="proximity-satellite__switch" aria-hidden="true" />
              </label>
              <p className="proximity-satellite__stealth-help">
                Discovery remains active; mute hides the red alert and silences sound and vibration.
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        <button
          type="button"
          className="proximity-satellite__button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse Satellite widget" : "Expand Satellite widget"}
          title="Local Satellite"
        >
          <span className={`proximity-satellite__signal ${alerting ? "proximity-satellite__signal--red" : "proximity-satellite__signal--blue"}`} />
          <Satellite size={21} strokeWidth={2.1} />
          <span className="proximity-satellite__expand-icon">
            {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {currentPeer && (
          <motion.div
            className="proximity-satellite__dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
          >
            <motion.section
              className="proximity-satellite__dialog"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="proximity-request-title"
            >
              <div className="proximity-satellite__dialog-glow" />
              <div className="relative">
                <div className="flex items-center gap-3">
                  {currentPeer.avatarData ? (
                    <img
                      src={currentPeer.avatarData}
                      alt={`${currentPeer.name} profile`}
                      className="h-16 w-16 rounded-2xl border border-white/15 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-sky-500/15 text-xl font-black text-sky-200">
                      {currentPeer.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Local BLE match</p>
                    <h2 id="proximity-request-title" className="mt-1 truncate text-xl font-black text-white">
                      {currentPeer.name}
                    </h2>
                    {currentPeer.username && (
                      <p className="truncate text-xs text-white/55">@{currentPeer.username}</p>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-white/90">
                  Flicks user <span className="font-black">{currentPeer.name}</span> is nearby, approximately 10–20m away. Connect?
                </p>
                {currentPeer.bio && (
                  <p className="mt-3 max-h-24 overflow-y-auto rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-white/65">
                    {currentPeer.bio}
                  </p>
                )}
                <p className="mt-2 text-[10px] text-white/35">
                  Range is estimated from Bluetooth signal strength and can vary by device and surroundings.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void rejectPeer()}
                    disabled={busy}
                    className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm font-bold text-white/75 transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void connectPeer()}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-3 text-sm font-black text-white shadow-lg shadow-sky-950/35 transition-colors hover:bg-sky-400 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Connect
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
