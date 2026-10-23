package com.fmologs.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/** 独立的当前通联通知。音频播放时由调用方隐藏。 */
public final class FmoSpeakerNotification {
    public static final String CHANNEL_ID = "fmo_contact_activity";
    public static final int NOTIFICATION_ID = 0x46_4D_4F_03;
    private static String lastServer = "";
    private static String lastCallsign = "";
    private static String lastAddress = "";
    private static volatile boolean audioPlaying = false;
    private FmoSpeakerNotification() {}
    public static void show(Context ctx, String serverName, String callsign, String address) {
        if (ctx == null) return;
        lastServer = serverName == null ? "" : serverName;
        lastCallsign = callsign == null ? "" : callsign;
        lastAddress = address == null ? "" : address;
        if (audioPlaying) return;
        ensureChannel(ctx);
        String sn = (serverName == null || serverName.isEmpty()) ? "FMO 通联动态" : serverName;
        String title = callsign == null || callsign.isEmpty() ? sn : sn + "：" + callsign;
        String text = callsign == null || callsign.isEmpty() ? "当前无人发言" : callsign;
        if (address != null && !address.isEmpty()) text += " · " + address;
        Intent launch = new Intent(ctx, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, NOTIFICATION_ID, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(ctx, CHANNEL_ID).setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title).setContentText(text).setContentIntent(pi).setOngoing(true)
                .setAutoCancel(false).setSilent(true).setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_LOW).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true).build();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try { nm.notify(NOTIFICATION_ID, n); } catch (SecurityException ignored) { }
        }
    }
    public static void restore(Context ctx) {
        audioPlaying = false;
        show(ctx, lastServer, lastCallsign, lastAddress);
    }
    public static void setAudioPlaying(Context ctx, boolean playing) {
        audioPlaying = playing;
        if (playing) cancel(ctx);
        else restore(ctx);
    }
    public static void cancel(Context ctx) {
        if (ctx == null) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }
    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "FMO 通联动态", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("显示当前通联呼号和位置"); ch.setShowBadge(false); ch.setSound(null, null);
        ch.enableVibration(false); ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); nm.createNotificationChannel(ch);
    }
}
