package com.fmologs.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * FmoLocation: 原生 GPS 定位插件。
 * - 负责权限请求、单次定位、持续定位监听
 * - 定位结果通过 notifyListeners("location", ...) 推给 JS
 * - 前台服务 FmoLocationService 通过 Intent 启动/停止
 */
@CapacitorPlugin(name = "FmoLocation")
public class FmoLocationPlugin extends Plugin {

    private static final String TAG = "FmoLocationPlugin";
    private static final int PERM_REQ_LOCATION = 2001;
    private static final int PERM_REQ_BACKGROUND = 2002;
    private static final long LOCATION_MAX_AGE_MS = 60_000L;  // 缓存定位最大有效期 60s

    private static volatile FmoLocationPlugin sInstance;

    public static FmoLocationPlugin getInstance() { return sInstance; }

    private LocationManager locationManager;
    private LocationListener watchingListener;
    private volatile Location lastLocation;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        sInstance = this;
        Context ctx = getContext();
        if (ctx != null) {
            locationManager = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopWatchingInternal();
        sInstance = null;
        super.handleOnDestroy();
    }

    /** 获取最后一次已知位置（供 Service 侧读取） */
    public static Location getLastLocation() {
        FmoLocationPlugin inst = sInstance;
        if (inst == null) return null;
        return inst.lastLocation;
    }

    /** 供 Service 侧刷通知 */
    public static void updateServiceNotification(String title, String text) {
        FmoLocationPlugin inst = sInstance;
        if (inst == null) return;
        Context ctx = inst.getContext();
        if (ctx != null) {
            FmoLocationService.updateNotification(ctx, title, text);
        }
    }

    /** FMO WebSocket 地址（静态存储，供 Service 侧读取） */
    private static volatile String sFmoUrl = "";

    /**
     * JS 告知原生侧 FMO 服务器地址与上报间隔。
     * 原生 Service 通过 Intent EXTRA_FMO_URL 读取，但此处也缓存一份供静态查询。
     */
    @PluginMethod
    public void setFmoConfig(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.isEmpty()) {
            sFmoUrl = url;
            Log.i(TAG, "setFmoConfig url=" + url);
        }
        call.resolve();
    }

    /** 供 Service 侧向 JS 推送上报结果 */
    public void notifyJsReportResult(JSObject result) {
        notifyListeners("reportStatus", result);
    }

    // ---- 权限 ----

    /**
     * 仅检查权限状态（不弹出系统对话框）。
     * 返回：{ granted, notificationGranted, backgroundGranted, needRationale }
     */
    @PluginMethod
    public void checkPermission(PluginCall call) {
        Activity act = getActivity();
        if (act == null) {
            JSObject result = new JSObject();
            result.put("granted", false);
            result.put("notificationGranted", false);
            result.put("backgroundGranted", false);
            result.put("needRationale", false);
            call.resolve(result);
            return;
        }
        boolean fineGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean locGranted = fineGranted || coarseGranted;

        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }

        boolean bgGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            bgGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }

        boolean needRationale = false;
        if (!locGranted) {
            needRationale = ActivityCompat.shouldShowRequestPermissionRationale(act, Manifest.permission.ACCESS_FINE_LOCATION);
        }

        JSObject result = new JSObject();
        result.put("granted", locGranted);
        result.put("notificationGranted", notifGranted);
        result.put("backgroundGranted", bgGranted);
        result.put("needRationale", needRationale);
        call.resolve(result);
    }

    /**
     * 请求前台定位与通知权限（弹出系统对话框）。
     * 不包含后台定位——Android 11+ 不允许同时请求前后台定位，否则系统不弹框。
     */
    @PluginMethod
    public void requestPermission(PluginCall call) {
        Activity act = getActivity();
        if (act == null) {
            call.resolve(new JSObject().put("granted", false));
            return;
        }
        boolean fineGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean notifGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }

        // 前台定位已有即视为已满足（通知权限非强依赖）
        if (fineGranted || coarseGranted) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }

        // 保存调用，等待 handleRequestPermissionsResult 中处理结果
        saveCall(call);

        java.util.ArrayList<String> perms = new java.util.ArrayList<>();
        if (!fineGranted) perms.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (!coarseGranted) perms.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (!notifGranted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        act.runOnUiThread(() -> {
            try {
                ActivityCompat.requestPermissions(act, perms.toArray(new String[0]), PERM_REQ_LOCATION);
            } catch (Exception e) {
                Log.w(TAG, "requestPermissions failed", e);
                PluginCall savedCall = getSavedCall();
                if (savedCall != null) {
                    savedCall.resolve(new JSObject().put("granted", false));
                }
            }
        });
    }

    /**
     * 单独请求后台定位权限（ACCESS_BACKGROUND_LOCATION）。
     * Android 11+ 需在前台定位授权后再单独请求，系统才会提供「始终允许」选项。
     */
    @PluginMethod
    public void requestBackgroundPermission(PluginCall call) {
        Activity act = getActivity();
        if (act == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.resolve(new JSObject().put("granted", false));
            return;
        }
        boolean bgGranted = ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        if (bgGranted) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }

        saveCall(call);
        act.runOnUiThread(() -> {
            try {
                ActivityCompat.requestPermissions(act,
                        new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                        PERM_REQ_BACKGROUND);
            } catch (Exception e) {
                Log.w(TAG, "requestBackgroundPermission failed", e);
                PluginCall savedCall = getSavedCall();
                if (savedCall != null) {
                    savedCall.resolve(new JSObject().put("granted", false));
                }
            }
        });
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);

        PluginCall savedCall = getSavedCall();
        if (savedCall == null) return;

        if (requestCode == PERM_REQ_LOCATION) {
            // 前台定位：任一定位权限授予即为成功
            boolean locGranted = false;
            if (grantResults != null) {
                for (int i = 0; i < permissions.length; i++) {
                    String perm = permissions[i];
                    if ((Manifest.permission.ACCESS_FINE_LOCATION.equals(perm)
                            || Manifest.permission.ACCESS_COARSE_LOCATION.equals(perm))
                            && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                        locGranted = true;
                        break;
                    }
                }
            }
            JSObject result = new JSObject();
            result.put("granted", locGranted);
            savedCall.resolve(result);
        } else if (requestCode == PERM_REQ_BACKGROUND) {
            // 后台定位
            boolean bgGranted = grantResults != null && grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            JSObject result = new JSObject();
            result.put("granted", bgGranted);
            savedCall.resolve(result);
        }
    }

    // ---- 单次定位 ----

    /**
     * 获取当前位置：始终使用 requestSingleUpdate 主动请求实时定位。
     * 用户点击「获取定位」或「立即上报」时确保获取的是最新坐标。
     * 30s 超时后回退到系统缓存兜底。
     */
    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (locationManager == null) {
            call.reject("LocationManager not available");
            return;
        }
        Activity act = getActivity();
        if (act == null) {
            call.reject("Activity not available");
            return;
        }
        if (!hasLocationPermission()) {
            call.reject("Location permission not granted");
            return;
        }

        try {
            // 请求实时定位
            final boolean[] resolved = {false};
            LocationListener onceListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        if (location != null) {
                            lastLocation = location;
                            JSObject result = new JSObject();
                            result.put("latitude", location.getLatitude());
                            result.put("longitude", location.getLongitude());
                            result.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 0);
                            call.resolve(result);
                        } else {
                            call.reject("Unable to get location");
                        }
                    }
                    try {
                        locationManager.removeUpdates(this);
                    } catch (Exception ignore) {}
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}
                @Override
                public void onProviderEnabled(String provider) {}
                @Override
                public void onProviderDisabled(String provider) {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        call.reject("Location provider disabled");
                    }
                    try {
                        locationManager.removeUpdates(this);
                    } catch (Exception ignore) {}
                }
            };

            // 同时使用 GPS 和网络定位
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, onceListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, onceListener, Looper.getMainLooper());
            }

            // 超时兜底（30 秒）
            mainHandler.postDelayed(() -> {
                try {
                    locationManager.removeUpdates(onceListener);
                } catch (Exception ignore) {}
                if (!resolved[0]) {
                    resolved[0] = true;
                    // 尝试用 lastKnownLocation 兜底（即使是过期的）
                    Location fallback = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (fallback == null) {
                        fallback = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    }
                    if (fallback != null) {
                        lastLocation = fallback;
                        JSObject result = new JSObject();
                        result.put("latitude", fallback.getLatitude());
                        result.put("longitude", fallback.getLongitude());
                        result.put("accuracy", fallback.hasAccuracy() ? fallback.getAccuracy() : 0);
                        call.resolve(result);
                    } else {
                        call.reject("Location request timed out");
                    }
                }
            }, 30_000);

        } catch (SecurityException se) {
            call.reject("Location permission denied: " + se.getMessage());
        }
    }

    /**
     * 获取系统缓存的定位，仅当定位年龄不超过 LOCATION_MAX_AGE_MS 时才返回。
     * 回退链路：GPS → NETWORK → PASSIVE，均检查新鲜度。
     * 供 Service 侧定时上报超时回退使用。
     */
    private Location getFreshCachedLocation() {
        if (locationManager == null) return null;
        Location loc = null;
        try {
            long now = System.currentTimeMillis();
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                loc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (loc != null && (now - loc.getTime()) > LOCATION_MAX_AGE_MS) {
                Log.i(TAG, "getFreshCachedLocation: GPS cached too old, discarding");
                loc = null;
            }
            if (loc == null) {
                loc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (loc != null && (now - loc.getTime()) > LOCATION_MAX_AGE_MS) {
                    Log.i(TAG, "getFreshCachedLocation: NETWORK cached too old, discarding");
                    loc = null;
                }
            }
            if (loc == null) {
                loc = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
                if (loc != null && (now - loc.getTime()) > LOCATION_MAX_AGE_MS) {
                    Log.i(TAG, "getFreshCachedLocation: PASSIVE cached too old, discarding");
                    loc = null;
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "getFreshCachedLocation: permission denied", e);
        }
        return loc;
    }

    // ---- 持续定位 ----

    @PluginMethod
    public void startWatching(PluginCall call) {
        if (!hasLocationPermission()) {
            call.reject("Location permission not granted");
            return;
        }
        int intervalSeconds = call.getInt("intervalSeconds", 5);
        if (intervalSeconds < 1) intervalSeconds = 1;

        stopWatchingInternal();

        watchingListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location == null) return;
                lastLocation = location;
                JSObject data = new JSObject();
                data.put("latitude", location.getLatitude());
                data.put("longitude", location.getLongitude());
                notifyListeners("location", data);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override
            public void onProviderEnabled(String provider) {}
            @Override
            public void onProviderDisabled(String provider) {}
        };

        long minTime = intervalSeconds * 1000L;
        float minDistance = 0f;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER, minTime, minDistance, watchingListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER, minTime, minDistance, watchingListener, Looper.getMainLooper());
            }
            Log.i(TAG, "startWatching intervalSeconds=" + intervalSeconds);
            call.resolve();
        } catch (SecurityException se) {
            call.reject("Location permission denied");
        }
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        stopWatchingInternal();
        call.resolve();
    }

    private void stopWatchingInternal() {
        if (watchingListener != null && locationManager != null) {
            try {
                locationManager.removeUpdates(watchingListener);
            } catch (Exception ignore) {}
            watchingListener = null;
            Log.i(TAG, "stopWatching");
        }
    }

    // ---- 前台服务 ----

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        String title = call.getString("title", "FMO 位置上报中");
        String text = call.getString("text", "正在定时上报GPS位置");
        int intervalSeconds = call.getInt("intervalSeconds", 300);

        Intent intent = new Intent(getContext(), FmoLocationService.class)
                .setAction(FmoLocationService.ACTION_START)
                .putExtra(FmoLocationService.EXTRA_TITLE, title)
                .putExtra(FmoLocationService.EXTRA_TEXT, text)
                .putExtra(FmoLocationService.EXTRA_INTERVAL_SECONDS, intervalSeconds)
                .putExtra(FmoLocationService.EXTRA_FMO_URL, sFmoUrl);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            Log.i(TAG, "startForegroundService title=" + title + " intervalSeconds=" + intervalSeconds + " fmoUrl=" + sFmoUrl);
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "startForegroundService failed", e);
            call.reject("startForegroundService failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Context ctx = getContext();
        if (ctx != null) {
            FmoLocationService.stopService(ctx);
        }
        call.resolve();
    }

    // ---- 辅助 ----

    private boolean hasLocationPermission() {
        Activity act = getActivity();
        if (act == null) return false;
        return ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }
}
