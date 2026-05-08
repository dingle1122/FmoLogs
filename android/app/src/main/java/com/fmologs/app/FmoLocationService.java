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
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * FmoLocationService: LOCATION 类型前台服务。
 *
 * 保持进程在后台不被杀死，配合 JS 层定时任务完成 GPS 位置上报至 FMO。
 * 通知栏显示当前上报状态与最近坐标信息。
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

    private static volatile String sTitle = "FMO 位置上报中";
    private static volatile String sText = "正在定时上报GPS位置";
    private static volatile int sIntervalMinutes = 5;

    private static volatile FmoLocationService sInstance;

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        ensureChannel();
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
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
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
        if (t != null && !t.isEmpty()) sTitle = t;
        if (x != null) sText = x;
        if (i > 0) sIntervalMinutes = i;
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
}
