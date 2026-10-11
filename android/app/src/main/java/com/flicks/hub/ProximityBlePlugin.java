package com.flicks.hub;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "ProximityBle",
    permissions = {
        @Permission(alias = "bleScan", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.ACCESS_FINE_LOCATION
        }),
        @Permission(alias = "bleAdvertise", strings = {
            Manifest.permission.BLUETOOTH_ADVERTISE
        }),
        @Permission(alias = "bleConnect", strings = {
            Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "legacyLocation", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION
        }),
        @Permission(alias = "notifications", strings = {
            Manifest.permission.POST_NOTIFICATIONS
        })
    }
)
public class ProximityBlePlugin extends Plugin {
    private boolean receiverRegistered;

    private final BroadcastReceiver serviceEvents = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !ProximityBleService.ACTION_EVENT.equals(intent.getAction())) return;
            String event = intent.getStringExtra(ProximityBleService.EXTRA_EVENT);
            String raw = intent.getStringExtra(ProximityBleService.EXTRA_DATA);
            if (event == null || raw == null) return;
            JSObject data = toJsObject(raw);
            notifyListeners(event, data, true);
        }
    };

    @Override
    public void load() {
        super.load();
        if (receiverRegistered || getContext() == null) return;
        IntentFilter filter = new IntentFilter(ProximityBleService.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(serviceEvents, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(serviceEvents, filter);
        }
        receiverRegistered = true;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!hasRequiredPermissions()) {
            String[] aliases = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? new String[] { "bleScan", "bleAdvertise", "bleConnect", "notifications" }
                    : new String[] { "bleScan", "bleAdvertise", "bleConnect" })
                : new String[] { "legacyLocation" };
            requestPermissionForAliases(aliases, call, "blePermissionResult");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void blePermissionResult(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Nearby Bluetooth permissions were not granted.");
            return;
        }
        startService(call);
    }

    private boolean hasRequiredPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return has(Manifest.permission.BLUETOOTH_SCAN)
                && has(Manifest.permission.BLUETOOTH_ADVERTISE)
                && has(Manifest.permission.BLUETOOTH_CONNECT);
        }
        return has(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    private boolean has(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void startService(PluginCall call) {
        String userId = call.getString("userId", "");
        if (userId == null || userId.trim().isEmpty()) {
            call.reject("A signed-in Flicks profile is required for nearby discovery.");
            return;
        }
        String profile = "{}";
        JSObject profileObject = call.getObject("profile");
        if (profileObject != null) profile = profileObject.toString();

        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_START);
        intent.putExtra(ProximityBleService.EXTRA_USER_ID, userId);
        intent.putExtra(ProximityBleService.EXTRA_PROFILE, profile);
        intent.putExtra(ProximityBleService.EXTRA_ADVERTISE, call.getBoolean("advertising", false));
        intent.putExtra(ProximityBleService.EXTRA_STEALTH, call.getBoolean("stealth", false));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve(new JSObject().put("status", "starting"));
        } catch (RuntimeException error) {
            call.reject("Flicks could not start Android Bluetooth discovery.", error);
        }
    }

    @PluginMethod
    public void updateProfile(PluginCall call) {
        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_UPDATE_PROFILE);
        intent.putExtra(ProximityBleService.EXTRA_USER_ID, call.getString("userId", ""));
        JSObject profile = call.getObject("profile");
        intent.putExtra(ProximityBleService.EXTRA_PROFILE, profile == null ? "{}" : profile.toString());
        intent.putExtra(ProximityBleService.EXTRA_ADVERTISE, call.getBoolean("advertising", false));
        sendServiceCommand(intent);
        call.resolve();
    }

    @PluginMethod
    public void setStealth(PluginCall call) {
        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_STEALTH);
        intent.putExtra(ProximityBleService.EXTRA_STEALTH, call.getBoolean("enabled", false));
        sendServiceCommand(intent);
        call.resolve();
    }

    @PluginMethod
    public void reject(PluginCall call) {
        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_REJECT);
        intent.putExtra(ProximityBleService.EXTRA_PEER_TOKEN, call.getString("peerToken", ""));
        intent.putExtra(ProximityBleService.EXTRA_PEER_ID, call.getString("peerId", ""));
        sendServiceCommand(intent);
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_SYNC);
        sendServiceCommand(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), ProximityBleService.class);
        intent.setAction(ProximityBleService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    private void sendServiceCommand(Intent intent) {
        try {
            getContext().startService(intent);
        } catch (RuntimeException ignored) {}
    }

    private JSObject toJsObject(String raw) {
        JSObject result = new JSObject();
        try {
            JSONObject source = new JSONObject(raw);
            java.util.Iterator<String> keys = source.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = source.get(key);
                result.put(key, value);
            }
        } catch (JSONException ignored) {}
        return result;
    }

    @Override
    protected void handleOnDestroy() {
        if (receiverRegistered && getContext() != null) {
            try { getContext().unregisterReceiver(serviceEvents); } catch (IllegalArgumentException ignored) {}
            receiverRegistered = false;
        }
        super.handleOnDestroy();
    }
}
