import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import {
  Bluetooth,
  Loader2,
  Satellite,
  ShieldCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  CheckCircle,
  WifiOff,
  Smartphone,
  Settings,
  MessageSquare,
  MapPin,
  Shield,
  AlertTriangle,
  Info,
  Navigation,
  Radar,
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
  addListener(eventName: "errorState", listener: (event: { error?: string }) => void): Promise<PluginListenerHandle>;
  requestPermissions(): Promise<{ bleScan?: string; bleAdvertise?: string; bleConnect?: string; notifications?: string; fineLocation?: string; coarseLocation?: string }>;
  getErrorState(): Promise<{ error?: string }>;
  openBluetoothSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
  startCoarseDiscovery(options: { userId: string; profile: AdvertisedProfile | null }): Promise<{ status?: string }>;
  stopCoarseDiscovery(): Promise<void>;
  setCoarseMode(options: { mode: "satellite" | "local" }): Promise<void>;
};

const NativeProximity = registerPlugin<ProximityBlePlugin>("ProximityBle");
const STEALTH_KEY = "flicks-proximity-stealth-v1";
const PROFILE_CACHE_PREFIX = "flicks-proximity-profile-v1:";
const REQUEST_QUEUE_PREFIX = "flicks-proximity-requests-v1:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Types for permission/error states
// ─────────────────────────────────────────────────────────────────────────────
type AndroidPermissionState = {
  bleScan: "granted" | "denied" | "prompt";
  bleAdvertise: "granted" | "denied" | "prompt";
  bleConnect: "granted" | "denied" | "prompt";
  notifications: "granted" | "denied" | "prompt";
  fineLocation: "granted" | "denied" | "prompt";
  coarseLocation: "granted" | "denied" | "prompt";
};

type ErrorState = 
  | { type: "none" }
  | { type: "bluetooth_off"; message: string; actionLabel: string }
  | { type: "permissions_denied"; message: string; actionLabel: string; permanentlyDenied: boolean }
  | { type: "service_unavailable"; message: string; actionLabel: string }
  | { type: "no_ble_hardware"; message: string }
  | { type: "location_required"; message: string; actionLabel: string }
  | { type: "generic"; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Web Bluetooth fallback (Chrome/Edge desktop & Android, not iOS Safari)
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_UUID = "0000f1a7-0000-1000-8000-00805f9b34fb"; // Matches Android SERVICE_PARCEL_UUID
const CHARACTERISTIC_UUID = "0000f1a8-0000-1000-8000-00805f9b34fb";

interface WebBleState {
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
  scanning: boolean;
  advertising: boolean;
  error: string | null;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

interface ProximitySatelliteProps {
  userId: string;
  profile: Record<string, unknown>;
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
  const iosNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  const webPlatform = !androidNative && !iosNative && typeof navigator !== "undefined";
  const webBleSupported = webPlatform && "bluetooth" in navigator;
  
  const [stealth, setStealth] = useState(
    () => localStorage.getItem(STEALTH_KEY) === "true",
  );
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(
    androidNative
      ? "Starting local Bluetooth…"
      : webBleSupported
      ? "Web Bluetooth available — click to scan"
      : iosNative
      ? "iOS native proximity coming soon"
      : "Browser fallback simulation · BLE unavailable",
  );
  const [nativeReady, setNativeReady] = useState(false);
  const [preparedProfile, setPreparedProfile] = useState<AdvertisedProfile | null>(
    () => readCachedProfile(userId),
  );
  const [activeSignals, setActiveSignals] = useState<Set<string>>(() => new Set());
  const [nearbyDevices, setNearbyDevices] = useState<NearbyPeer[]>([]);
  const [peerQueue, setPeerQueue] = useState<NearbyPeer[]>([]);
  const [busy, setBusy] = useState(false);
  const [webBleState, setWebBleState] = useState<WebBleState>({
    device: null,
    server: null,
    characteristic: null,
    scanning: false,
    advertising: false,
    error: null,
  });
  const [permissionState, setPermissionState] = useState<"granted" | "denied" | "prompt" | "unavailable">(
    androidNative ? "granted" : webBleSupported ? "prompt" : "unavailable"
  );
  
  // Android permission & error state management
  const [androidPermissions, setAndroidPermissions] = useState<AndroidPermissionState>({
    bleScan: "prompt",
    bleAdvertise: "prompt",
    bleConnect: "prompt",
    notifications: "prompt",
    fineLocation: "prompt",
    coarseLocation: "prompt",
  });
  const [errorState, setErrorState] = useState<ErrorState>({ type: "none" });
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [coarseDiscoveryActive, setCoarseDiscoveryActive] = useState(false);
  const [coarseMode, setCoarseMode] = useState<"satellite" | "local">("satellite");
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // Coarse Discovery (SATELLITE/LOCAL) handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const startCoarseDiscovery = useCallback(async () => {
    if (!androidNative || !userId || !preparedProfile) return;
    try {
      setStatus("Starting coarse discovery…");
      await NativeProximity.startCoarseDiscovery({
        userId,
        profile: preparedProfile,
      });
      setCoarseDiscoveryActive(true);
      setStatus(`Coarse discovery: ${coarseMode.toUpperCase()}`);
    } catch (error) {
      setStatus("Failed to start coarse discovery: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [androidNative, userId, preparedProfile, coarseMode]);

  const stopCoarseDiscovery = useCallback(async () => {
    if (!androidNative) return;
    try {
      await NativeProximity.stopCoarseDiscovery();
      setCoarseDiscoveryActive(false);
      setStatus("Coarse discovery stopped");
    } catch (error) {
      setStatus("Failed to stop coarse discovery: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [androidNative]);

  const toggleCoarseMode = useCallback(async () => {
    if (!androidNative) return;
    const nextMode = coarseMode === "satellite" ? "local" : "satellite";
    try {
      await NativeProximity.setCoarseMode({ mode: nextMode });
      setCoarseMode(nextMode);
      setStatus(`Coarse mode: ${nextMode.toUpperCase()}`);
    } catch (error) {
      setStatus("Failed to set coarse mode: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [androidNative, coarseMode]);
  const announcedTokens = useRef(new Set<string>());
  const queuedTokens = useRef(new Set<string>());
  const stealthRef = useRef(stealth);
  const peerQueueRef = useRef(peerQueue);
  const webBleScanRef = useRef<() => void>();
  const webBleAdvertiseRef = useRef<() => void>();

  useEffect(() => {
    stealthRef.current = stealth;
    localStorage.setItem(STEALTH_KEY, String(stealth));
    if (androidNative && nativeReady) {
      void NativeProximity.setStealth({ enabled: stealth }).catch(() => {});
    } else if (webBleSupported && webBleState.advertising) {
      // Re-advertise with updated stealth (no-op for now, stealth affects notifications only)
    }
  }, [stealth, androidNative, nativeReady, webBleSupported, webBleState.advertising]);

  useEffect(() => {
    peerQueueRef.current = peerQueue;
  }, [peerQueue]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Web Bluetooth: request permission and start scan/advertise
  // ─────────────────────────────────────────────────────────────────────────────
  const requestWebBlePermission = useCallback(async () => {
    if (!webBleSupported) return false;
    try {
      // Request device to trigger permission prompt
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      setPermissionState("granted");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPermissionState("denied");
        setStatus("Bluetooth permission denied. Enable in site settings to use proximity.");
      } else {
        setStatus("Bluetooth unavailable: " + (error instanceof Error ? error.message : String(error)));
      }
      return false;
    }
  }, [webBleSupported]);

  const startWebBleScan = useCallback(async () => {
    if (!webBleSupported || webBleState.scanning) return;
    
    const hasPermission = permissionState === "granted" || (await requestWebBlePermission());
    if (!hasPermission) return;

    setWebBleState((s) => ({ ...s, scanning: true, error: null }));
    setStatus("Scanning for nearby Flicks devices…");

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      device.addEventListener("gattserverdisconnected", () => {
        setWebBleState((s) => ({ ...s, device: null, server: null, characteristic: null, scanning: false }));
        setStatus("Disconnected from peer");
      });

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      setWebBleState((s) => ({ ...s, device, server, characteristic, scanning: false }));
      setStatus("Connected to nearby device");

      // Read the peer's token from the characteristic
      const value = await characteristic.readValue();
      const token = toHex(value.buffer);
      
      // Emit peerFound-like event
      const peer: NearbyPeer = {
        userId: "web-ble-peer", // Would need proper ID exchange
        peerToken: token,
        name: device.name || "Web BLE Peer",
        username: "",
        bio: "",
        avatarData: "",
        rssi: undefined,
        approximateMeters: undefined,
      };
      
      if (!queuedTokens.current.has(token)) {
        queuedTokens.current.add(token);
        announcedTokens.current.add(token);
        setPeerQueue((current) => [...current.filter((item) => item.peerToken !== token), peer]);
        setNearbyDevices((current) => [...current.filter((item) => item.peerToken !== token), peer]);
        setActiveSignals((current) => new Set(current).add(token));
      }

      // Start notifications for RSSI updates
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const val = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (val) {
          const rssi = new Int8Array(val.buffer)[0]; // Simplified
          setStatus(`Signal: ${rssi} dBm`);
        }
      });

    } catch (error) {
      setWebBleState((s) => ({ ...s, scanning: false, error: String(error) }));
      setStatus("Scan failed: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [webBleSupported, webBleState.scanning, permissionState, requestWebBlePermission]);

  const startWebBleAdvertise = useCallback(async () => {
    if (!webBleSupported || webBleState.advertising) return;
    if (!preparedProfile?.name) return;
    
    const hasPermission = permissionState === "granted" || (await requestWebBlePermission());
    if (!hasPermission) return;

    setWebBleState((s) => ({ ...s, advertising: true, error: null }));
    setStatus("Advertising your profile…");

    try {
      // Web Bluetooth doesn't support peripheral/advertising mode in most browsers yet
      // This is a placeholder for when the Web Bluetooth Peripheral API lands
      // For now, we simulate by just showing the state
      setStatus("Web advertising not yet supported in browsers. Scanning only.");
      setWebBleState((s) => ({ ...s, advertising: false }));
    } catch (error) {
      setWebBleState((s) => ({ ...s, advertising: false, error: String(error) }));
      setStatus("Advertise failed: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [webBleSupported, webBleState.advertising, permissionState, requestWebBlePermission, preparedProfile]);

  const stopWebBle = useCallback(async () => {
    if (webBleState.device) {
      try {
        await webBleState.device.gatt?.disconnect();
      } catch (_) {
        // Ignore disconnect errors during cleanup
      }
    }
    if (webBleScanRef.current) webBleScanRef.current();
    if (webBleAdvertiseRef.current) webBleAdvertiseRef.current();
    setWebBleState({
      device: null,
      server: null,
      characteristic: null,
      scanning: false,
      advertising: false,
      error: null,
    });
    setActiveSignals(new Set());
    setNearbyDevices([]);
    setPeerQueue([]);
    queuedTokens.current.clear();
    announcedTokens.current.clear();
  }, [webBleState.device]);

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
      } catch (_) {
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
                await NativeProximity.addListener("errorState", ({ error }) => {
                  if (error) {
                    handleNativeError(error);
                  }
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
            setNearbyDevices((current) => current.filter((peer) => peer.peerToken !== token));
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
            setNearbyDevices((current) => [
              ...current.filter((item) => item.peerToken !== peerToken),
              peer,
            ]);
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
  }, [androidNative, userId, canAdvertise, preparedProfile]);

  // ─────────────────────────────────────────────────────────────────────────────
// Android Error State Handler
// ─────────────────────────────────────────────────────────────────────────────
  const handleNativeError = useCallback((error: string) => {
    const lower = error.toLowerCase();
    
    if (lower.includes("bluetooth") && (lower.includes("off") || lower.includes("disabled") || lower.includes("turned off"))) {
      setErrorState({
        type: "bluetooth_off",
        message: "Bluetooth is turned off. Enable it to discover nearby people.",
        actionLabel: "Open Bluetooth Settings",
      });
      setShowPermissionDialog(true);
      return;
    }
    
    if (lower.includes("permission") && (lower.includes("denied") || lower.includes("not granted"))) {
      // Check if permanently denied by trying to request again
      const permanentlyDenied = lower.includes("permanently") || lower.includes("never ask again");
      setErrorState({
        type: "permissions_denied",
        message: "Bluetooth permissions are required for nearby discovery. Please grant them in settings.",
        actionLabel: permanentlyDenied ? "Open App Settings" : "Grant Permissions",
        permanentlyDenied,
      });
      setShowPermissionDialog(true);
      return;
    }
    
    if (lower.includes("service") && (lower.includes("unavailable") || lower.includes("stopped") || lower.includes("not running"))) {
      setErrorState({
        type: "service_unavailable",
        message: "Proximity service is unavailable. Try restarting the app.",
        actionLabel: "Restart App",
      });
      setShowPermissionDialog(true);
      return;
    }
    
    if (lower.includes("hardware") || lower.includes("not supported") || lower.includes("no bluetooth")) {
      setErrorState({
        type: "no_ble_hardware",
        message: "This device doesn't support Bluetooth Low Energy required for proximity.",
      });
      return;
    }
    
    if (lower.includes("location") && (lower.includes("required") || lower.includes("permission") || lower.includes("denied"))) {
      setErrorState({
        type: "location_required",
        message: "Location permission is required for Bluetooth scanning on Android. Please enable it.",
        actionLabel: "Open Location Settings",
      });
      setShowPermissionDialog(true);
      return;
    }
    
    setErrorState({
      type: "generic",
      message: error,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Android Permission Request Flow
  // ─────────────────────────────────────────────────────────────────────────────
  const checkAndroidPermissions = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      const perms = await NativeProximity.requestPermissions();
      setAndroidPermissions((prev) => ({
        bleScan: perms.bleScan as any ?? prev.bleScan,
        bleAdvertise: perms.bleAdvertise as any ?? prev.bleAdvertise,
        bleConnect: perms.bleConnect as any ?? prev.bleConnect,
        notifications: perms.notifications as any ?? prev.notifications,
        fineLocation: perms.fineLocation as any ?? prev.fineLocation,
        coarseLocation: perms.coarseLocation as any ?? prev.coarseLocation,
      }));
      return perms;
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to check permissions:", error);
    }
  }, [androidNative, nativeReady]);

  const requestAndroidPermissions = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      // The native plugin will trigger the system permission dialogs
      const perms = await NativeProximity.requestPermissions();
      setAndroidPermissions((prev) => ({
        bleScan: perms.bleScan as any ?? prev.bleScan,
        bleAdvertise: perms.bleAdvertise as any ?? prev.bleAdvertise,
        bleConnect: perms.bleConnect as any ?? prev.bleConnect,
        notifications: perms.notifications as any ?? prev.notifications,
        fineLocation: perms.fineLocation as any ?? prev.fineLocation,
        coarseLocation: perms.coarseLocation as any ?? prev.coarseLocation,
      }));
      // After permissions granted, restart the service
      if (perms.bleScan === "granted" && perms.bleAdvertise === "granted" && perms.bleConnect === "granted") {
        setErrorState({ type: "none" });
        setShowPermissionDialog(false);
        await NativeProximity.sync();
      }
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to request permissions:", error);
    }
  }, [androidNative, nativeReady]);

  const openBluetoothSettings = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      await NativeProximity.openBluetoothSettings();
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to open Bluetooth settings:", error);
    }
  }, [androidNative, nativeReady]);

  const openLocationSettings = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      await NativeProximity.openLocationSettings();
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to open Location settings:", error);
    }
  }, [androidNative, nativeReady]);

  const openAppSettings = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      await NativeProximity.openAppSettings();
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to open App settings:", error);
    }
  }, [androidNative, nativeReady]);

  const checkBluetoothEnabled = useCallback(async () => {
    if (!androidNative || !nativeReady) return;
    try {
      const { enabled } = await NativeProximity.isBluetoothEnabled();
      if (!enabled) {
        setErrorState({
          type: "bluetooth_off",
          message: "Bluetooth is turned off. Enable it to discover nearby people.",
          actionLabel: "Open Bluetooth Settings",
        });
        setShowPermissionDialog(true);
      }
    } catch (error) {
      console.warn("[ProximitySatellite] Failed to check Bluetooth state:", error);
    }
  }, [androidNative, nativeReady]);

  // Check Bluetooth state on mount and when native becomes ready
  useEffect(() => {
    if (androidNative && nativeReady) {
      checkAndroidPermissions();
      checkBluetoothEnabled();
    }
  }, [androidNative, nativeReady, checkAndroidPermissions, checkBluetoothEnabled]);

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
    } catch (_) {
        // The device cooldown is also recorded locally below.
      }
    try {
      localStorage.setItem(
        `flicks-proximity-reject:${userId}:${currentPeer.userId}`,
        String(Date.now()),
      );
    } catch (_) {
        // Ignore localStorage errors
      }
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
      <div className="proximity-satellite">
        <AnimatePresence>
          {expanded && (
            <motion.button
              key="satellite-outside"
              type="button"
              className="proximity-satellite__outside"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              aria-label="Collapse satellite tray"
            />
          )}
          {expanded && (
            <motion.section
              key="satellite-tray"
              className="proximity-satellite__tray"
              initial={{ x: "105%" }}
              animate={{ x: 0 }}
              exit={{ x: "105%" }}
              transition={{ type: "spring", stiffness: 290, damping: 30, mass: 0.82 }}
              aria-label="Satellite proximity controls"
            >
                <div className="proximity-satellite__tray-rail" aria-hidden="true" />
                <div className="proximity-satellite__panel-head">
                  <div className="proximity-satellite__panel-icon"><Satellite size={17} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">SATELLITE / LOCAL</p>
                    <p className="text-[10px] text-white/50">Proximity control deck</p>
                  </div>
                  <button
                    type="button"
                    className="proximity-satellite__close"
                    onClick={() => setExpanded(false)}
                    aria-label="Collapse tray"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="proximity-satellite__tray-status">
                  <span className={`proximity-satellite__status-led ${alerting ? "is-red" : "is-blue"}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                      Scan status
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-white">
                      {androidNative ? status : "Browser fallback simulation"}
                    </p>
                    {!androidNative && (
                      <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                        This preview does not scan or simulate nearby devices.
                      </p>
                    )}
                  </div>
<span className="proximity-satellite__status-tag">
                    {androidNative ? coarseMode.toUpperCase() : "DEMO"}
                  </span>
                </div>

                <div className="proximity-satellite__tray-controls">
                  <div className="proximity-satellite__mode-toggle">
                    <span className="proximity-satellite__mode-label">MODE</span>
                    <div className="proximity-satellite__mode-buttons">
                      <button
                        type="button"
                        className={`proximity-satellite__mode-btn ${coarseMode === "satellite" ? "active" : ""}`}
                        onClick={() => toggleCoarseMode()}
                        disabled={!androidNative || coarseDiscoveryActive || coarseMode === "satellite"}
                        aria-pressed={coarseMode === "satellite"}
                      >
                        <Satellite size={13} />
                        <span>SATELLITE</span>
                      </button>
                      <button
                        type="button"
                        className={`proximity-satellite__mode-btn ${coarseMode === "local" ? "active" : ""}`}
                        onClick={() => toggleCoarseMode()}
                        disabled={!androidNative || coarseDiscoveryActive || coarseMode === "local"}
                        aria-pressed={coarseMode === "local"}
                      >
                        <Navigation size={13} />
                        <span>LOCAL</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`proximity-satellite__coarse-btn ${coarseDiscoveryActive ? "active" : ""}`}
                    onClick={coarseDiscoveryActive ? stopCoarseDiscovery : startCoarseDiscovery}
                    disabled={!androidNative || !userId || !preparedProfile}
                    aria-pressed={coarseDiscoveryActive}
                  >
                    {coarseDiscoveryActive ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>STOP COARSE</span>
                      </>
                    ) : (
                      <>
                        <Radar size={14} />
                        <span>START COARSE</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="proximity-satellite__tray-metrics">
                  <div>
                    <span>NEARBY SIGNALS</span>
                    <strong className={alerting ? "is-alert" : ""}>{activeSignals.size}</strong>
                  </div>
                  <div>
                    <span>DISCOVERY</span>
                    <strong>
                      {androidNative
                        ? "AUTO"
                        : webBleSupported
                        ? webBleState.scanning
                          ? "SCANNING"
                          : webBleState.advertising
                          ? "ADVERTISING"
                          : "MANUAL"
                        : iosNative
                        ? "PENDING"
                        : "SIMULATION"}
                    </strong>
                  </div>
                </div>

                <div className="proximity-satellite__device-section">
                  <div className="proximity-satellite__section-title">
                    <span>Nearby devices</span>
                    <span>{nearbyDevices.length.toString().padStart(2, "0")}</span>
                  </div>
                  {nearbyDevices.length > 0 ? (
                    <div className="proximity-satellite__device-list">
                      {nearbyDevices.map((peer) => (
                        <div className="proximity-satellite__device" key={peer.peerToken}>
                          {peer.avatarData ? (
                            <img src={peer.avatarData} alt="" className="proximity-satellite__avatar" />
                          ) : (
                            <span className="proximity-satellite__avatar-fallback">
                              {peer.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-white">{peer.name}</p>
                            <p className="truncate text-[10px] text-white/40">
                              {peer.username ? `@${peer.username}` : "Flicks device"}
                            </p>
                          </div>
                          <span className="proximity-satellite__device-signal" aria-label="Signal active" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="proximity-satellite__empty">
                      <span className="proximity-satellite__empty-ring"><Bluetooth size={15} /></span>
                      <span>{androidNative ? "Listening for nearby Flicks devices" : "No simulated devices"}</span>
                    </div>
                  )}
                </div>

                <div className="proximity-satellite__tray-footer">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold text-white">
                      {stealth ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      Stealth / mute alerts
                    </p>
                    <p className="mt-1 text-[10px] text-white/40">Discovery remains active</p>
                  </div>
                  <label className="proximity-satellite__stealth">
                    <input
                      type="checkbox"
                      checked={stealth}
                      onChange={toggleStealth}
                      aria-label="Mute proximity audio, vibration, and red signal"
                    />
                    <span className="proximity-satellite__switch" aria-hidden="true" />
                  </label>
                </div>
                <div className="proximity-satellite__tray-note">
                  <ShieldCheck size={13} />
                  <span>Profile exchange is local. Connection requests sync when online.</span>
                </div>
            </motion.section>
          )}
        </AnimatePresence>

        {!expanded && (
          <button
            type="button"
            className="proximity-satellite__edge-trigger"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            aria-label="Open satellite tray"
            title="Open satellite controls"
          >
            <span
              className={`proximity-satellite__wall-led ${
                stealth ? "is-stealth" : alerting ? "is-alert" : "is-scanning"
              }`}
              aria-hidden="true"
            >
              <i className="proximity-satellite__led-blue" />
              <i className="proximity-satellite__led-red" />
            </span>
          </button>
        )}

        {/* Permission / Error Dialog */}
        <AnimatePresence>
          {showPermissionDialog && errorState.type !== "none" && (
            <motion.div
              className="proximity-satellite__permission-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="proximity-satellite__permission-dialog"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="proximity-permission-title"
              >
                <div className="proximity-satellite__permission-header">
                  {errorState.type === "bluetooth_off" && <Bluetooth size={24} className="text-amber-400" />}
                  {errorState.type === "permissions_denied" && <AlertTriangle size={24} className="text-amber-400" />}
                  {errorState.type === "service_unavailable" && <Smartphone size={24} className="text-amber-400" />}
                  {errorState.type === "no_ble_hardware" && <WifiOff size={24} className="text-red-400" />}
                  {errorState.type === "location_required" && <MapPin size={24} className="text-amber-400" />}
                  {errorState.type === "generic" && <AlertCircle size={24} className="text-amber-400" />}
                </div>
                <h3 id="proximity-permission-title" className="proximity-satellite__permission-title">
                  {errorState.type === "bluetooth_off" && "Bluetooth Off"}
                  {errorState.type === "permissions_denied" && "Permissions Required"}
                  {errorState.type === "service_unavailable" && "Service Unavailable"}
                  {errorState.type === "no_ble_hardware" && "No BLE Hardware"}
                  {errorState.type === "location_required" && "Location Required"}
                  {errorState.type === "generic" && "Error"}
                </h3>
                <p className="proximity-satellite__permission-message">{errorState.message}</p>
                <div className="proximity-satellite__permission-actions">
                  {errorState.actionLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        if (errorState.type === "bluetooth_off") void openBluetoothSettings();
                        if (errorState.type === "location_required") void openLocationSettings();
                        if (errorState.type === "permissions_denied" || errorState.type === "service_unavailable") void openAppSettings();
                      }}
                      className="proximity-satellite__permission-btn primary"
                    >
                      {errorState.type === "bluetooth_off" && <Settings size={14} />}
                      {errorState.type === "location_required" && <MapPin size={14} />}
                      {errorState.type === "permissions_denied" && <Shield size={14} />}
                      {errorState.type === "service_unavailable" && <Settings size={14} />}
                      {errorState.actionLabel}
                    </button>
                  )}
                  {(errorState.type === "permissions_denied" && errorState.permanentlyDenied) || errorState.type === "service_unavailable" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPermissionDialog(false);
                        setErrorState({ type: "none" });
                      }}
                      className="proximity-satellite__permission-btn secondary"
                    >
                      Dismiss
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (errorState.type === "bluetooth_off" || errorState.type === "location_required" || errorState.type === "permissions_denied") {
                          void requestAndroidPermissions();
                        }
                        if (errorState.type === "service_unavailable") {
                          void NativeProximity.sync();
                        }
                      }}
                      className="proximity-satellite__permission-btn primary"
                    >
                      <Loader2 size={14} className="animate-spin" />
                      Retry
                    </button>
                  )}
                </div>
                {errorState.type === "no_ble_hardware" && (
                  <p className="proximity-satellite__permission-note">
                    This device cannot use Bluetooth proximity features. You can still discover people using coarse location when online.
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
