package com.fmologs.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
 * FmoLocationService: LOCATION 类型前台服务。
 *
 * 使用 Handler.postDelayed 原生定时器驱动 GPS 定位获取与 FMO 上报，
 * 息屏后不受 WebView JS 线程挂起影响。
 * 通过 OkHttp WebSocket + WebViewAuthHelper 认证头与 FMO 通信。
 */
public class FmoLocationService extends Service {

    private static final String TAG = "FmoLocationService";
    public static final String CHANNEL_ID = "fmo_location_report";
    public static final int NOTIFICATION_ID = 0x46_4D_4F_02;

    public static final String ACTION_START = "com.fmologs.app.FMO_LOCATION_START";
    public static final String ACTION_STOP = "com.fmologs.app.FMO_LOCATION_STOP";
    public static final String ACTION_UPDATE = "com.fmologs.app.FMO_LOCATION_UPDATE";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_INTERVAL_MINUTES = "intervalMinutes";
    public static final String EXTRA_FMO_URL = "fmoUrl";

    // GPS 可靠性阈值
    private static final float ACCURACY_THRESHOLD = 100f; // 精度 > 100m 视为不可靠
    private static final float DRIFT_THRESHOLD = 10f;      // 偏移 < 10m 视为未移动

    private static volatile String sTitle = "FMO 位置上报中";
    private static volatile String sText = "正在定时上报GPS位置";
    private static volatile int sIntervalMinutes = 5;
    private static volatile String sFmoUrl = "";
    private static volatile double sLastReportedLat = 0;
    private static volatile double sLastReportedLng = 0;
    private static volatile long sLastReportTime = 0;

    private static volatile FmoLocationService sInstance;

    private OkHttpClient httpClient;
    private LocationManager locationManager;
    private final Handler reportHandler = new Handler(Looper.getMainLooper());
    private Runnable reportRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        ensureChannel();
        httpClient = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.i(TAG, "onStartCommand action=" + action);

        if (ACTION_UPDATE.equals(action) && intent != null) {
            applyExtras(intent);
            refreshNotification();
            return START_STICKY;
        }

        if (intent != null) applyExtras(intent);

        Notification notification = buildNotification(this, sTitle, sText);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (ACTION_STOP.equals(action)) {
            stopTimer();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        // 启动定时上报循环
        startTimer();
        // 立即执行首次上报
        doReport();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopTimer();
        if (sInstance == this) sInstance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void applyExtras(Intent intent) {
        String t = intent.getStringExtra(EXTRA_TITLE);
        String x = intent.getStringExtra(EXTRA_TEXT);
        int i = intent.getIntExtra(EXTRA_INTERVAL_MINUTES, 0);
        String url = intent.getStringExtra(EXTRA_FMO_URL);
        if (t != null && !t.isEmpty()) sTitle = t;
        if (x != null) sText = x;
        if (i > 0) sIntervalMinutes = i;
        if (url != null && !url.isEmpty()) sFmoUrl = url;
    }

    private void refreshNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification(this, sTitle, sText));
        }
    }

    private static Notification buildNotification(Context ctx, String title, String text) {
        Intent launch = new Intent(ctx, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPI = PendingIntent.getActivity(
                ctx, 0, launch,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent stopIntent = new Intent(ctx, FmoLocationService.class).setAction(ACTION_STOP);
        PendingIntent stopPI = PendingIntent.getService(
                ctx, 1, stopIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Bitmap largeIcon = null;
        try {
            largeIcon = BitmapFactory.decodeResource(ctx.getResources(), R.mipmap.ic_launcher);
        } catch (Exception ignore) {}

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(contentPI)
                .setOngoing(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止上报", stopPI);
        if (largeIcon != null) b.setLargeIcon(largeIcon);
        return b.build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "FMO 位置上报", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("显示位置上报服务运行状态");
                ch.setShowBadge(false);
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }
    }

    // ---- 定时上报核心逻辑 ----

    private void startTimer() {
        stopTimer();
        long intervalMs = sIntervalMinutes * 60L * 1000L;
        reportRunnable = new Runnable() {
            @Override
            public void run() {
                doReport();
                if (reportHandler != null && reportRunnable != null) {
                    reportHandler.postDelayed(reportRunnable, intervalMs);
                }
            }
        };
        reportHandler.postDelayed(reportRunnable, intervalMs);
        Log.i(TAG, "startTimer intervalMs=" + intervalMs);
    }

    private void stopTimer() {
        if (reportHandler != null && reportRunnable != null) {
            reportHandler.removeCallbacks(reportRunnable);
        }
        reportRunnable = null;
        Log.i(TAG, "stopTimer");
    }

    private void doReport() {
        String checkTime = formatNow();

        // 1. 获取 GPS
        Location loc = getBestLocation();
        if (loc == null) {
            Log.w(TAG, "doReport: no location available");
            updateNotificationText("定位失败", checkTime);
            return;
        }

        double lat = loc.getLatitude();
        double lng = loc.getLongitude();

        // 2. 精度门限检查
        if (loc.hasAccuracy() && loc.getAccuracy() > ACCURACY_THRESHOLD) {
            Log.w(TAG, "doReport: accuracy too low: " + loc.getAccuracy() + "m");
            updateNotificationText("精度不足", checkTime);
            notifyJs(false, lat, lng, checkTime, "GPS精度不足(" + (int) loc.getAccuracy() + "m)");
            return;
        }

        // 3. 漂移过滤：与上次上报位置比较
        if (sLastReportTime > 0 && sLastReportedLat != 0) {
            float[] results = new float[1];
            Location.distanceBetween(sLastReportedLat, sLastReportedLng, lat, lng, results);
            float dist = results[0];
            if (dist < DRIFT_THRESHOLD) {
                Log.i(TAG, "doReport: position unchanged (" + dist + "m), skip");
                updateNotificationText("位置未变", checkTime);
                notifyJs(true, lat, lng, checkTime, "位置未变化(偏移" + String.format("%.1f", dist) + "m)，跳过上报");
                return;
            }
        }

        // 4. 上报到 FMO
        reportToFmo(lat, lng, checkTime);
    }

    private Location getBestLocation() {
        if (locationManager == null) return null;
        Location loc = null;
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                loc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (loc == null) {
                loc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (loc == null) {
                loc = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
            }
        } catch (SecurityException e) {
            Log.w(TAG, "getBestLocation: permission denied", e);
        }
        return loc;
    }

    private void reportToFmo(final double lat, final double lng, final String checkTime) {
        if (sFmoUrl.isEmpty()) {
            Log.w(TAG, "reportToFmo: no FMO URL configured");
            updateNotificationText("未配置地址", checkTime);
            return;
        }

        // ws/wss → http/https (OkHttp Request.Builder.url 仅接受 http/https)
        String reqUrl = sFmoUrl;
        if (reqUrl.startsWith("wss://")) {
            reqUrl = "https://" + reqUrl.substring("wss://".length());
        } else if (reqUrl.startsWith("ws://")) {
            reqUrl = "http://" + reqUrl.substring("ws://".length());
        }

        Request.Builder rbuilder = new Request.Builder().url(reqUrl);
        WebViewAuthHelper.addAuthHeaders(getApplicationContext(), rbuilder, sFmoUrl);
        Request request = rbuilder.build();

        Log.i(TAG, "reportToFmo: connecting to " + reqUrl);

        httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                try {
                    JSONObject body = new JSONObject();
                    body.put("type", "config");
                    body.put("subType", "setCordinate");
                    JSONObject data = new JSONObject();
                    data.put("latitude", lat);
                    data.put("longitude", lng);
                    body.put("data", data);
                    ws.send(body.toString());
                    Log.i(TAG, "reportToFmo: sent setCordinate lat=" + lat + " lng=" + lng);
                } catch (Exception e) {
                    Log.w(TAG, "reportToFmo: send failed", e);
                    ws.close(1000, null);
                }
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                Log.i(TAG, "reportToFmo: received response");
                sLastReportedLat = lat;
                sLastReportedLng = lng;
                sLastReportTime = System.currentTimeMillis();
                updateNotificationText("最近上报", checkTime);
                notifyJs(true, lat, lng, checkTime, "上报成功");
                ws.close(1000, null);

                // 上报成功后 5s 从 FMO 拉取坐标确认
                reportHandler.postDelayed(() -> fetchFmoCoordinateOnce(), 5000);
            }

            @Override
            public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, Response response) {
                Log.w(TAG, "reportToFmo: failed", t);
                updateNotificationText("上报失败", checkTime);
                notifyJs(false, lat, lng, checkTime, "上报失败: " + t.getMessage());
            }
        });
    }

    private void fetchFmoCoordinateOnce() {
        if (sFmoUrl.isEmpty()) return;

        String reqUrl = sFmoUrl;
        if (reqUrl.startsWith("wss://")) {
            reqUrl = "https://" + reqUrl.substring("wss://".length());
        } else if (reqUrl.startsWith("ws://")) {
            reqUrl = "http://" + reqUrl.substring("ws://".length());
        }

        Request.Builder rbuilder = new Request.Builder().url(reqUrl);
        WebViewAuthHelper.addAuthHeaders(getApplicationContext(), rbuilder, sFmoUrl);
        Request request = rbuilder.build();

        httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                try {
                    JSONObject body = new JSONObject();
                    body.put("type", "config");
                    body.put("subType", "getCordinate");
                    body.put("data", new JSONObject());
                    ws.send(body.toString());
                } catch (Exception e) {
                    ws.close(1000, null);
                }
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                try {
                    JSONObject msg = new JSONObject(text);
                    if (msg.optInt("code", -1) == 0) {
                        JSONObject respData = msg.optJSONObject("data");
                        if (respData != null && respData.has("latitude") && respData.has("longitude")) {
                            double fmoLat = respData.getDouble("latitude");
                            double fmoLng = respData.getDouble("longitude");
                            notifyJsFmoCoord(fmoLat, fmoLng);
                            Log.i(TAG, "fetchFmoCoordinate: got fmoLat=" + fmoLat + " fmoLng=" + fmoLng);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "fetchFmoCoordinate: parse failed", e);
                }
                ws.close(1000, null);
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull okio.ByteString bytes) {
                String s = bytes.utf8();
                onMessage(ws, s);
            }

            @Override
            public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, Response response) {
                Log.w(TAG, "fetchFmoCoordinate: failed", t);
            }
        });
    }

    private void updateNotificationText(String label, String time) {
        Location loc = getBestLocation();
        if (loc != null) {
            sText = label + ": " + String.format("%.6f", loc.getLatitude())
                    + ", " + String.format("%.6f", loc.getLongitude())
                    + " (" + time + ")";
        } else {
            sText = label + " (" + time + ")";
        }
        refreshNotification();
    }

    private static String formatNow() {
        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());
        return sdf.format(new Date());
    }

    private void notifyJs(boolean success, double lat, double lng, String time, String message) {
        FmoLocationPlugin plugin = FmoLocationPlugin.getInstance();
        if (plugin == null) return;
        try {
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("latitude", lat);
            result.put("longitude", lng);
            result.put("time", time);
            result.put("message", message);
            plugin.notifyJsReportResult(result);
        } catch (Exception e) {
            Log.w(TAG, "notifyJs failed", e);
        }
    }

    private void notifyJsFmoCoord(double lat, double lng) {
        FmoLocationPlugin plugin = FmoLocationPlugin.getInstance();
        if (plugin == null) return;
        try {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("latitude", lat);
            result.put("longitude", lng);
            result.put("isFmoCoord", true);
            plugin.notifyJsReportResult(result);
        } catch (Exception e) {
            Log.w(TAG, "notifyJsFmoCoord failed", e);
        }
    }

    // ---- 静态方法 ----

    public static void startService(Context ctx) {
        Intent i = new Intent(ctx, FmoLocationService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stopService(Context ctx) {
        Intent i = new Intent(ctx, FmoLocationService.class).setAction(ACTION_STOP);
        ctx.startService(i);
    }

    /**
     * 更新通知栏标题/文案。
     * Android 12+ 后台限制：仅在服务已运行时直接刷新；未运行时只写静态缓存。
     */
    public static void updateNotification(Context ctx, String title, String text) {
        if (title != null && !title.isEmpty()) sTitle = title;
        if (text != null) sText = text;

        FmoLocationService inst = sInstance;
        if (inst != null) {
            inst.refreshNotification();
        }
    }

    /** 获取当前通知静态缓存 */
    public static String getCachedTitle() { return sTitle; }
    public static String getCachedText() { return sText; }
    public static String getCachedFmoUrl() { return sFmoUrl; }
}
