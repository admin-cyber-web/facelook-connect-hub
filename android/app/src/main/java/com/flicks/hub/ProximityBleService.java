package com.flicks.hub;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelUuid;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Owns the local-only BLE radio while the user is signed in. No server, GPS, or
 * network calls are made here. A foreground service keeps Android's low-power
 * scan available while Flicks is in the background.
 */
public class ProximityBleService extends Service {
    static final String ACTION_START = "com.flicks.hub.proximity.START";
    static final String ACTION_STOP = "com.flicks.hub.proximity.STOP";
    static final String ACTION_UPDATE_PROFILE = "com.flicks.hub.proximity.UPDATE_PROFILE";
    static final String ACTION_STEALTH = "com.flicks.hub.proximity.STEALTH";
    static final String ACTION_REJECT = "com.flicks.hub.proximity.REJECT";
    static final String ACTION_SYNC = "com.flicks.hub.proximity.SYNC";
    static final String ACTION_EVENT = "com.flicks.hub.proximity.EVENT";

    static final String EXTRA_USER_ID = "userId";
    static final String EXTRA_PROFILE = "profile";
    static final String EXTRA_ADVERTISE = "advertise";
    static final String EXTRA_STEALTH = "stealth";
    static final String EXTRA_PEER_TOKEN = "peerToken";
    static final String EXTRA_PEER_ID = "peerId";
    static final String EXTRA_EVENT = "event";
    static final String EXTRA_DATA = "data";

    private static final String PREFS = "flicks_proximity_v1";
    private static final String CHANNEL_SERVICE = "flicks_proximity_service";
    private static final String CHANNEL_ALERTS = "flicks_proximity_alerts";
    private static final int SERVICE_NOTIFICATION_ID = 7350;
    private static final int PROFILE_NOTIFICATION_ID_BASE = 7400;
    private static final int RSSI_THRESHOLD_DBM = -90;
    private static final int STALE_PEER_MS = 14_000;
    private static final int SCAN_MODE = ScanSettings.SCAN_MODE_LOW_POWER;
    private static final int MAX_PROFILE_BYTES = 24_000;

    private static final UUID SERVICE_UUID =
        UUID.fromString("3c4e7d20-1f5b-4f2e-9a63-f684ec4a10b1");
    private static final UUID PROFILE_CHARACTERISTIC_UUID =
        UUID.fromString("3c4e7d21-1f5b-4f2e-9a63-f684ec4a10b1");
    private static final UUID CLIENT_CONFIGURATION_UUID =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final ParcelUuid SERVICE_PARCEL_UUID = new ParcelUuid(SERVICE_UUID);

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, PeerSignal> signals = new HashMap<>();
    private final ArrayDeque<PeerCandidate> candidateQueue = new ArrayDeque<>();
    private final Set<String> queuedTokens = new HashSet<>();
    private final Map<String, Integer> mtuByAddress = new HashMap<>();
    private final Map<String, NotificationTransfer> notificationTransfers = new HashMap<>();
    private final Map<String, JSONObject> deliveredProfiles = new HashMap<>();

    private BluetoothManager bluetoothManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner scanner;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;
    private BluetoothGattCharacteristic profileCharacteristic;
    private BluetoothGatt activeClientGatt;
    private BluetoothDevice activeDevice;
    private AdvertiseCallback advertiseCallback;
    private ScanCallback scanCallback;
    private ToneGenerator toneGenerator;

    private boolean running;
    private boolean advertisingEnabled;
    private boolean stealth;
    private boolean profileServiceReady;
    private String currentUserId = "";
    private String deviceToken = "";
    private byte[] profilePayload = new byte[0];
    private PeerCandidate activeCandidate;
    private byte[][] receivedChunks;
    private int receivedChunkCount;

    private final Runnable stalePeerSweep = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            long now = System.currentTimeMillis();
            Iterator<Map.Entry<String, PeerSignal>> iterator = signals.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, PeerSignal> entry = iterator.next();
                if (now - entry.getValue().lastStrongSeenAt > STALE_PEER_MS) {
                    JSONObject data = new JSONObject();
                    try {
                        data.put("peerToken", entry.getKey());
                        data.put("active", false);
                    } catch (JSONException ignored) {}
                    emit("signal", data);
                    deliveredProfiles.remove(entry.getKey());
                    queuedTokens.remove(entry.getKey());
                    iterator.remove();
                }
            }
            mainHandler.postDelayed(this, 5_000);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager != null ? bluetoothManager.getAdapter() : null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopRadio();
            stopForegroundCompat();
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        ensureForeground();

        if (intent == null) {
            restoreConfiguration();
            startRadio();
            return START_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            currentUserId = safeString(intent.getStringExtra(EXTRA_USER_ID));
            stealth = intent.getBooleanExtra(EXTRA_STEALTH, false);
            advertisingEnabled = intent.getBooleanExtra(EXTRA_ADVERTISE, false);
            setDeviceTokenForUser(currentUserId);
            applyProfile(intent.getStringExtra(EXTRA_PROFILE), currentUserId);
            persistConfiguration();
            running = true;
            startRadio();
            syncStateToBridge();
        } else if (ACTION_UPDATE_PROFILE.equals(action)) {
            String requestedUserId = safeString(intent.getStringExtra(EXTRA_USER_ID));
            if (currentUserId.isEmpty() || currentUserId.equals(requestedUserId)) {
                currentUserId = requestedUserId;
                advertisingEnabled = intent.getBooleanExtra(EXTRA_ADVERTISE, false);
                setDeviceTokenForUser(currentUserId);
                applyProfile(intent.getStringExtra(EXTRA_PROFILE), currentUserId);
                persistConfiguration();
                refreshGattAndAdvertising();
            }
        } else if (ACTION_STEALTH.equals(action)) {
            stealth = intent.getBooleanExtra(EXTRA_STEALTH, false);
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean("stealth", stealth).apply();
            emitStatus(stealth ? "Stealth alerts muted; BLE stays active" : "Nearby BLE active");
        } else if (ACTION_REJECT.equals(action)) {
            saveRejection(
                safeString(intent.getStringExtra(EXTRA_PEER_TOKEN)),
                safeString(intent.getStringExtra(EXTRA_PEER_ID))
            );
        } else if (ACTION_SYNC.equals(action)) {
            syncStateToBridge();
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void ensureForeground() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launch == null ? null : PendingIntent.getActivity(
            this, 7350, launch, pendingIntentFlags()
        );
        Intent stopIntent = new Intent(this, ProximityBleService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this, 7351, stopIntent, pendingIntentFlags()
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Flicks nearby is active")
            .setContentText("Low-power Bluetooth discovery is running on this device.")
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPending)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                SERVICE_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            );
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification);
        }
    }

    private int pendingIntentFlags() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel serviceChannel = new NotificationChannel(
            CHANNEL_SERVICE, "Nearby discovery", NotificationManager.IMPORTANCE_LOW
        );
        serviceChannel.setDescription("Visible while Flicks performs local Bluetooth discovery.");
        serviceChannel.setSound(null, null);
        serviceChannel.enableVibration(false);
        manager.createNotificationChannel(serviceChannel);

        NotificationChannel alertChannel = new NotificationChannel(
            CHANNEL_ALERTS, "Nearby connection alerts", NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("Local alerts for Flicks users detected nearby.");
        alertChannel.setSound(null, null);
        alertChannel.enableVibration(false);
        manager.createNotificationChannel(alertChannel);
    }

    private void restoreConfiguration() {
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        currentUserId = safeString(prefs.getString("user_id", ""));
        advertisingEnabled = prefs.getBoolean("advertise", false);
        stealth = prefs.getBoolean("stealth", false);
        setDeviceTokenForUser(currentUserId);
        applyProfile(prefs.getString("profile", ""), currentUserId);
        running = true;
    }

    private void persistConfiguration() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString("user_id", currentUserId)
            .putBoolean("advertise", advertisingEnabled)
            .putBoolean("stealth", stealth)
            .putString("profile", new String(profilePayload, StandardCharsets.UTF_8))
            .apply();
    }

    private void setDeviceTokenForUser(String userId) {
        if (userId == null || userId.isEmpty()) return;
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String savedOwner = prefs.getString("token_owner", "");
        if (!userId.equals(savedOwner)) {
            byte[] randomToken = new byte[8];
            new SecureRandom().nextBytes(randomToken);
            deviceToken = toHex(randomToken);
            prefs.edit().putString("device_token", deviceToken)
                .putString("token_owner", userId).apply();
        } else {
            deviceToken = safeString(prefs.getString("device_token", ""));
            if (deviceToken.isEmpty()) {
                byte[] randomToken = new byte[8];
                new SecureRandom().nextBytes(randomToken);
                deviceToken = toHex(randomToken);
                prefs.edit().putString("device_token", deviceToken).apply();
            }
        }
    }

    private void applyProfile(String rawProfile, String ownerId) {
        profilePayload = new byte[0];
        if (rawProfile == null || rawProfile.isEmpty() || ownerId == null || ownerId.isEmpty()) return;
        try {
            JSONObject input = new JSONObject(rawProfile);
            String profileOwner = input.optString("userId", "");
            if (!ownerId.equals(profileOwner)) return;

            JSONObject safe = new JSONObject();
            safe.put("userId", ownerId);
            safe.put("name", truncate(input.optString("name", ""), 100));
            safe.put("username", truncate(input.optString("username", ""), 40));
            safe.put("bio", truncate(input.optString("bio", ""), 480));
            safe.put("avatarData", truncate(input.optString("avatarData", ""), 12_500));
            byte[] encoded = safe.toString().getBytes(StandardCharsets.UTF_8);
            if (encoded.length <= MAX_PROFILE_BYTES) profilePayload = encoded;
        } catch (JSONException ignored) {
            profilePayload = new byte[0];
        }
    }

    private void startRadio() {
        if (!running) return;
        if (bluetoothManager == null || bluetoothAdapter == null) {
            emitStatus("Bluetooth LE is not supported on this device");
            return;
        }
        if (!hasBlePermissions()) {
            emitStatus("Bluetooth permissions are needed");
            return;
        }
        try {
            if (!bluetoothAdapter.isEnabled()) {
                emitStatus("Turn on Bluetooth to start nearby discovery");
                return;
            }
            scanner = bluetoothAdapter.getBluetoothLeScanner();
            advertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            startScanner();
            refreshGattAndAdvertising();
            mainHandler.removeCallbacks(stalePeerSweep);
            mainHandler.postDelayed(stalePeerSweep, 5_000);
            emitStatus(advertisingEnabled && profilePayload.length > 0
                ? "BLE scanner and profile broadcast active"
                : "Anonymous BLE scanning active");
        } catch (SecurityException error) {
            emitStatus("Bluetooth permission is unavailable");
        } catch (RuntimeException error) {
            emitStatus("Bluetooth could not start on this device");
            Log.w("FlicksProximity", "BLE startup failed", error);
        }
    }

    private boolean hasBlePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private void startScanner() {
        if (scanner == null || scanCallback != null) return;
        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                observe(result);
            }

            @Override
            public void onBatchScanResults(java.util.List<ScanResult> results) {
                for (ScanResult result : results) observe(result);
            }

            @Override
            public void onScanFailed(int errorCode) {
                scanCallback = null;
                emitStatus("BLE scan paused (code " + errorCode + ")");
            }
        };

        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(SCAN_MODE)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .build();
        ScanFilter filter = new ScanFilter.Builder()
            .setServiceData(SERVICE_PARCEL_UUID, new byte[] { 0 }, new byte[] { 0 })
            .build();
        try {
            scanner.startScan(Arrays.asList(filter), settings, scanCallback);
        } catch (SecurityException error) {
            scanCallback = null;
            emitStatus("Bluetooth scan permission is unavailable");
        } catch (RuntimeException error) {
            scanCallback = null;
            emitStatus("BLE scanning is unavailable");
            Log.w("FlicksProximity", "startScan failed", error);
        }
    }

    private void observe(ScanResult result) {
        if (!running || result == null || result.getScanRecord() == null) return;
        byte[] tokenBytes = result.getScanRecord().getServiceData(SERVICE_PARCEL_UUID);
        if (tokenBytes == null || tokenBytes.length != 8) return;
        String token = toHex(tokenBytes);
        if (token.isEmpty() || token.equals(deviceToken) || isRejected(token, "")) return;
        int rssi = result.getRssi();
        if (rssi < RSSI_THRESHOLD_DBM) return;

        long now = System.currentTimeMillis();
        PeerSignal signal = signals.get(token);
        if (signal == null) {
            signal = new PeerSignal();
            signals.put(token, signal);
        }
        signal.lastStrongSeenAt = now;
        signal.lastRssi = rssi;
        signal.strongCount++;
        if (!signal.active) {
            signal.active = true;
            JSONObject data = new JSONObject();
            try {
                data.put("peerToken", token);
                data.put("active", true);
                data.put("rssi", rssi);
                data.put("approximateMeters", approximateMeters(rssi));
            } catch (JSONException ignored) {}
            emit("signal", data);
        }

        if (!signal.triggered && signal.strongCount >= 2) {
            signal.triggered = true;
            if (!stealth) {
                playArrivalAlert();
                vibrateArrival();
            }
            queueCandidate(new PeerCandidate(token, result.getDevice(), rssi));
        }
    }

    private void queueCandidate(PeerCandidate candidate) {
        if (candidate == null || queuedTokens.contains(candidate.token)) return;
        queuedTokens.add(candidate.token);
        candidateQueue.add(candidate);
        processNextCandidate();
    }

    private void processNextCandidate() {
        if (!running || activeClientGatt != null || candidateQueue.isEmpty()) return;
        activeCandidate = candidateQueue.poll();
        if (activeCandidate == null) return;
        if (isRejected(activeCandidate.token, "")) {
            queuedTokens.remove(activeCandidate.token);
            activeCandidate = null;
            processNextCandidate();
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                activeClientGatt = activeCandidate.device.connectGatt(
                    this, false, clientCallback, BluetoothDevice.TRANSPORT_LE
                );
            } else {
                activeClientGatt = activeCandidate.device.connectGatt(this, false, clientCallback);
            }
            activeDevice = activeCandidate.device;
            if (activeClientGatt == null) finishClientTransfer();
            else mainHandler.postDelayed(clientTimeout, 16_000);
        } catch (SecurityException | RuntimeException error) {
            finishClientTransfer();
        }
    }

    private final Runnable clientTimeout = new Runnable() {
        @Override
        public void run() {
            finishClientTransfer();
        }
    };

    private final BluetoothGattCallback clientCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (gatt != activeClientGatt) return;
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                boolean requested = false;
                try {
                    requested = gatt.requestMtu(185);
                } catch (SecurityException ignored) {}
                if (!requested) {
                    try { gatt.discoverServices(); } catch (SecurityException ignored) {}
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                finishClientTransfer();
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            if (gatt != activeClientGatt) return;
            try { gatt.discoverServices(); } catch (SecurityException ignored) {}
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (gatt != activeClientGatt || status != BluetoothGatt.GATT_SUCCESS) {
                finishClientTransfer();
                return;
            }
            BluetoothGattService service = gatt.getService(SERVICE_UUID);
            BluetoothGattCharacteristic characteristic = service == null
                ? null : service.getCharacteristic(PROFILE_CHARACTERISTIC_UUID);
            if (characteristic == null) {
                finishClientTransfer();
                return;
            }
            BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CLIENT_CONFIGURATION_UUID);
            if (descriptor == null) {
                finishClientTransfer();
                return;
            }
            try {
                gatt.setCharacteristicNotification(characteristic, true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    int result = gatt.writeDescriptor(
                        descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    );
                    if (result != BluetoothGatt.GATT_SUCCESS) finishClientTransfer();
                } else {
                    descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    if (!gatt.writeDescriptor(descriptor)) finishClientTransfer();
                }
            } catch (SecurityException | RuntimeException error) {
                finishClientTransfer();
            }
        }

        @Override
        public void onCharacteristicChanged(
            BluetoothGatt gatt, BluetoothGattCharacteristic characteristic
        ) {
            if (gatt == activeClientGatt && characteristic.getUuid().equals(PROFILE_CHARACTERISTIC_UUID)) {
                consumeProfileFrame(characteristic.getValue());
            }
        }

        @Override
        public void onCharacteristicChanged(
            BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value
        ) {
            if (gatt == activeClientGatt && characteristic.getUuid().equals(PROFILE_CHARACTERISTIC_UUID)) {
                consumeProfileFrame(value);
            }
        }
    };

    private void consumeProfileFrame(byte[] frame) {
        if (frame == null || frame.length < 4) return;
        int sequence = ((frame[0] & 0xff) << 8) | (frame[1] & 0xff);
        int total = ((frame[2] & 0xff) << 8) | (frame[3] & 0xff);
        if (total < 1 || total > 2048 || sequence >= total) {
            finishClientTransfer();
            return;
        }
        if (receivedChunks == null || receivedChunks.length != total) {
            receivedChunks = new byte[total][];
            receivedChunkCount = 0;
        }
        if (receivedChunks[sequence] == null) {
            receivedChunks[sequence] = Arrays.copyOfRange(frame, 4, frame.length);
            receivedChunkCount++;
        }
        if (receivedChunkCount != total) return;

        int byteCount = 0;
        for (byte[] chunk : receivedChunks) byteCount += chunk.length;
        if (byteCount <= 0 || byteCount > MAX_PROFILE_BYTES) {
            finishClientTransfer();
            return;
        }
        byte[] joined = new byte[byteCount];
        int offset = 0;
        for (byte[] chunk : receivedChunks) {
            System.arraycopy(chunk, 0, joined, offset, chunk.length);
            offset += chunk.length;
        }
        try {
            onRemoteProfile(new JSONObject(new String(joined, StandardCharsets.UTF_8)));
        } catch (JSONException ignored) {
            finishClientTransfer();
        }
    }

    private void onRemoteProfile(JSONObject profile) {
        String userId = profile.optString("userId", "");
        PeerCandidate candidate = activeCandidate;
        if (candidate == null || userId.isEmpty() || userId.equals(currentUserId)) {
            finishClientTransfer();
            return;
        }
        if (isRejected(candidate.token, userId)) {
            finishClientTransfer();
            return;
        }

        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString("peer_user_" + candidate.token, userId).apply();
        JSONObject event = new JSONObject(profile.toString());
        try {
            event.put("peerToken", candidate.token);
            event.put("rssi", candidate.rssi);
            event.put("approximateMeters", approximateMeters(candidate.rssi));
        } catch (JSONException ignored) {}

        deliveredProfiles.put(candidate.token, event);
        emit("peerFound", event);
        if (!stealth) postPeerNotification(profile.optString("name", "Flicks user"), candidate.token);
        finishClientTransfer();
    }

    private void finishClientTransfer() {
        mainHandler.removeCallbacks(clientTimeout);
        BluetoothGatt gatt = activeClientGatt;
        activeClientGatt = null;
        activeDevice = null;
        receivedChunks = null;
        receivedChunkCount = 0;
        if (gatt != null) {
            try { gatt.disconnect(); } catch (SecurityException ignored) {}
            try { gatt.close(); } catch (RuntimeException ignored) {}
        }
        if (activeCandidate != null) queuedTokens.remove(activeCandidate.token);
        activeCandidate = null;
        mainHandler.postDelayed(this::processNextCandidate, 250);
    }

    private void refreshGattAndAdvertising() {
        stopAdvertising();
        closeGattServer();
        if (!running || !advertisingEnabled || profilePayload.length == 0 || advertiser == null) return;
        try {
            if (bluetoothManager == null) return;
            gattServer = bluetoothManager.openGattServer(this, serverCallback);
            if (gattServer == null) {
                emitStatus("BLE profile sharing is unavailable");
                return;
            }
            BluetoothGattService service = new BluetoothGattService(
                SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY
            );
            profileCharacteristic = new BluetoothGattCharacteristic(
                PROFILE_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ
            );
            profileCharacteristic.addDescriptor(new BluetoothGattDescriptor(
                CLIENT_CONFIGURATION_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE
            ));
            service.addCharacteristic(profileCharacteristic);
            profileServiceReady = false;
            gattServer.addService(service);
        } catch (SecurityException | RuntimeException error) {
            emitStatus("BLE profile sharing could not start");
            Log.w("FlicksProximity", "GATT server setup failed", error);
        }
    }

    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            if (!service.getUuid().equals(SERVICE_UUID)) return;
            if (status == BluetoothGatt.GATT_SUCCESS) {
                profileServiceReady = true;
                startAdvertising();
            } else {
                emitStatus("BLE profile service could not be added");
            }
        }

        @Override
        public void onConnectionStateChange(
            BluetoothDevice device, int status, int newState
        ) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                mtuByAddress.put(device.getAddress(), 23);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                mtuByAddress.remove(device.getAddress());
                notificationTransfers.remove(device.getAddress());
            }
        }

        @Override
        public void onMtuChanged(BluetoothDevice device, int mtu) {
            mtuByAddress.put(device.getAddress(), Math.max(23, mtu));
        }

        @Override
        public void onDescriptorWriteRequest(
            BluetoothDevice device,
            int requestId,
            BluetoothGattDescriptor descriptor,
            boolean preparedWrite,
            boolean responseNeeded,
            int offset,
            byte[] value
        ) {
            boolean enabled = descriptor.getUuid().equals(CLIENT_CONFIGURATION_UUID)
                && Arrays.equals(value, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            if (responseNeeded && gattServer != null) {
                try {
                    gattServer.sendResponse(
                        device, requestId,
                        enabled ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_FAILURE,
                        offset, null
                    );
                } catch (SecurityException ignored) {}
            }
            if (enabled && profilePayload.length > 0) {
                notificationTransfers.put(
                    device.getAddress(),
                    new NotificationTransfer(device, profilePayload.clone(), mtuByAddress.getOrDefault(device.getAddress(), 23))
                );
                mainHandler.postDelayed(() -> sendNextNotification(device.getAddress()), 40);
            }
        }

        @Override
        public void onNotificationSent(BluetoothDevice device, int status) {
            String address = device.getAddress();
            if (status != BluetoothGatt.GATT_SUCCESS) {
                notificationTransfers.remove(address);
                return;
            }
            mainHandler.postDelayed(() -> sendNextNotification(address), 25);
        }
    };

    private void sendNextNotification(String address) {
        if (gattServer == null || profileCharacteristic == null) return;
        NotificationTransfer transfer = notificationTransfers.get(address);
        if (transfer == null || transfer.nextSequence >= transfer.totalChunks) {
            notificationTransfers.remove(address);
            return;
        }
        int packetBytes = Math.max(20, transfer.mtu - 3);
        int chunkBytes = Math.max(1, packetBytes - 4);
        int start = transfer.nextSequence * chunkBytes;
        int size = Math.min(chunkBytes, transfer.payload.length - start);
        byte[] packet = new byte[4 + size];
        packet[0] = (byte) ((transfer.nextSequence >> 8) & 0xff);
        packet[1] = (byte) (transfer.nextSequence & 0xff);
        packet[2] = (byte) ((transfer.totalChunks >> 8) & 0xff);
        packet[3] = (byte) (transfer.totalChunks & 0xff);
        System.arraycopy(transfer.payload, start, packet, 4, size);

        try {
            boolean queued;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                queued = gattServer.notifyCharacteristicChanged(
                    transfer.device, profileCharacteristic, false, packet
                ) == BluetoothGatt.GATT_SUCCESS;
            } else {
                profileCharacteristic.setValue(packet);
                queued = gattServer.notifyCharacteristicChanged(
                    transfer.device, profileCharacteristic, false
                );
            }
            if (queued) transfer.nextSequence++;
            else notificationTransfers.remove(address);
        } catch (SecurityException | RuntimeException error) {
            notificationTransfers.remove(address);
        }
    }

    private void startAdvertising() {
        if (!running || !advertisingEnabled || !profileServiceReady || advertiser == null || deviceToken.isEmpty()) return;
        if (advertiseCallback != null) return;
        byte[] token = fromHex(deviceToken);
        if (token.length != 8) return;

        AdvertiseSettings.Builder settingsBuilder = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_LOW)
            .setTimeout(0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settingsBuilder.setConnectable(true);

        AdvertiseData data = new AdvertiseData.Builder()
            .addServiceData(SERVICE_PARCEL_UUID, token)
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .build();
        advertiseCallback = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                emitStatus("Low-power BLE discovery and profile broadcast active");
            }

            @Override
            public void onStartFailure(int errorCode) {
                advertiseCallback = null;
                emitStatus("BLE scanning is active; profile broadcasting is unavailable (" + errorCode + ")");
            }
        };
        try {
            advertiser.startAdvertising(settingsBuilder.build(), data, advertiseCallback);
        } catch (SecurityException | RuntimeException error) {
            advertiseCallback = null;
            emitStatus("BLE scanning is active; profile broadcasting is unavailable");
        }
    }

    private void stopAdvertising() {
        if (advertiser != null && advertiseCallback != null) {
            try { advertiser.stopAdvertising(advertiseCallback); } catch (SecurityException ignored) {}
        }
        advertiseCallback = null;
        profileServiceReady = false;
    }

    private void closeGattServer() {
        notificationTransfers.clear();
        mtuByAddress.clear();
        if (gattServer != null) {
            try { gattServer.close(); } catch (RuntimeException ignored) {}
        }
        gattServer = null;
        profileCharacteristic = null;
    }

    private void stopRadio() {
        running = false;
        mainHandler.removeCallbacks(stalePeerSweep);
        mainHandler.removeCallbacks(clientTimeout);
        if (scanner != null && scanCallback != null) {
            try { scanner.stopScan(scanCallback); } catch (SecurityException | RuntimeException ignored) {}
        }
        scanner = null;
        scanCallback = null;
        stopAdvertising();
        closeGattServer();
        if (activeClientGatt != null) {
            try { activeClientGatt.disconnect(); } catch (SecurityException ignored) {}
            try { activeClientGatt.close(); } catch (RuntimeException ignored) {}
        }
        activeClientGatt = null;
        activeDevice = null;
        activeCandidate = null;
        candidateQueue.clear();
        queuedTokens.clear();
        signals.clear();
        deliveredProfiles.clear();
    }

    private void syncStateToBridge() {
        emitStatus(running ? "Low-power BLE discovery active" : "BLE discovery stopped");
        for (Map.Entry<String, PeerSignal> entry : signals.entrySet()) {
            if (!entry.getValue().active) continue;
            JSONObject data = new JSONObject();
            try {
                data.put("peerToken", entry.getKey());
                data.put("active", true);
                data.put("rssi", entry.getValue().lastRssi);
                data.put("approximateMeters", approximateMeters(entry.getValue().lastRssi));
            } catch (JSONException ignored) {}
            emit("signal", data);
        }
        for (JSONObject peer : deliveredProfiles.values()) emit("peerFound", peer);
    }

    private void saveRejection(String peerToken, String peerId) {
        long now = System.currentTimeMillis();
        android.content.SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if (!peerToken.isEmpty()) editor.putLong("last_reject_timestamp_token_" + peerToken, now);
        if (!peerId.isEmpty()) editor.putLong("last_reject_timestamp_user_" + peerId, now);
        editor.apply();
        if (!peerToken.isEmpty()) deliveredProfiles.remove(peerToken);
    }

    private boolean isRejected(String token, String userId) {
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long cooldownMs = 15 * 60 * 1000L;
        long tokenRejectedAt = token.isEmpty() ? 0
            : prefs.getLong("last_reject_timestamp_token_" + token, 0);
        long userRejectedAt = userId.isEmpty() ? 0
            : prefs.getLong("last_reject_timestamp_user_" + userId, 0);
        String cachedUserId = token.isEmpty() ? ""
            : prefs.getString("peer_user_" + token, "");
        if (!cachedUserId.isEmpty()) {
            userRejectedAt = Math.max(
                userRejectedAt,
                prefs.getLong("last_reject_timestamp_user_" + cachedUserId, 0)
            );
        }
        return (tokenRejectedAt > 0 && now - tokenRejectedAt < cooldownMs)
            || (userRejectedAt > 0 && now - userRejectedAt < cooldownMs);
    }

    private void playArrivalAlert() {
        try {
            if (toneGenerator == null) {
                toneGenerator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 65);
            }
            toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 280);
        } catch (RuntimeException ignored) {}
    }

    private void vibrateArrival() {
        try {
            Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(new long[] { 0, 90, 45, 130 }, -1));
            } else {
                vibrator.vibrate(new long[] { 0, 90, 45, 130 }, -1);
            }
        } catch (RuntimeException ignored) {}
    }

    private void postPeerNotification(String name, String token) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launch == null ? null : PendingIntent.getActivity(
            this, 7500 + Math.abs(token.hashCode() % 10_000), launch, pendingIntentFlags()
        );
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Flicks user nearby")
            .setContentText(truncate(name, 70) + " is within Bluetooth range. Tap Flicks to connect.")
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build();
        try {
            int notificationId = PROFILE_NOTIFICATION_ID_BASE + Math.abs(token.hashCode() % 10_000);
            manager.notify(notificationId, notification);
        } catch (SecurityException ignored) {}
    }

    private void emitStatus(String status) {
        JSONObject data = new JSONObject();
        try { data.put("status", status); } catch (JSONException ignored) {}
        emit("status", data);
    }

    private void emit(String event, JSONObject data) {
        Intent intent = new Intent(ACTION_EVENT);
        intent.setPackage(getPackageName());
        intent.putExtra(EXTRA_EVENT, event);
        intent.putExtra(EXTRA_DATA, data == null ? "{}" : data.toString());
        sendBroadcast(intent);
    }

    private double approximateMeters(int rssi) {
        double estimate = Math.pow(10.0, (-59.0 - rssi) / 22.0);
        return Math.max(1.0, Math.min(50.0, Math.round(estimate * 10.0) / 10.0));
    }

    private String toHex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) value.append(String.format("%02x", b & 0xff));
        return value.toString();
    }

    private byte[] fromHex(String value) {
        if (value == null || value.length() % 2 != 0) return new byte[0];
        byte[] out = new byte[value.length() / 2];
        try {
            for (int i = 0; i < out.length; i++) {
                out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
            }
            return out;
        } catch (NumberFormatException error) {
            return new byte[0];
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return "";
        String clean = value.trim();
        return clean.length() <= maxLength ? clean : clean.substring(0, maxLength);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
    }

    @Override
    public void onDestroy() {
        stopRadio();
        if (toneGenerator != null) {
            try { toneGenerator.release(); } catch (RuntimeException ignored) {}
            toneGenerator = null;
        }
        stopForegroundCompat();
        super.onDestroy();
    }

    private static final class PeerSignal {
        long lastStrongSeenAt;
        int lastRssi;
        int strongCount;
        boolean active;
        boolean triggered;
    }

    private static final class PeerCandidate {
        final String token;
        final BluetoothDevice device;
        final int rssi;

        PeerCandidate(String token, BluetoothDevice device, int rssi) {
            this.token = token;
            this.device = device;
            this.rssi = rssi;
        }
    }

    private static final class NotificationTransfer {
        final BluetoothDevice device;
        final byte[] payload;
        final int mtu;
        final int totalChunks;
        int nextSequence;

        NotificationTransfer(BluetoothDevice device, byte[] payload, int mtu) {
            this.device = device;
            this.payload = payload;
            this.mtu = Math.max(23, mtu);
            int chunkBytes = Math.max(1, this.mtu - 7);
            this.totalChunks = (int) Math.ceil(payload.length / (double) chunkBytes);
        }
    }
}
