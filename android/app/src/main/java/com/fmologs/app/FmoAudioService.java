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
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

/**
 * FmoAudioService: MEDIA_PLAYBACK 类型前台服务。
 *
 * 设计原则：
 *  - 通知按钮使用“明确动作”（ACTION_MUTE / ACTION_UNMUTE），而非 toggle。
 *    避免 addAction + MediaSession.Callback 双路径同时触发导致互相抵消。
 *  - MediaSession.Callback 也调用明确动作（onPause=mute(true), onPlay=mute(false)）。
 *  - 服务作为单例，允许直接同步刷新 mediaSession 与通知，避免异步 intent 链造成状态闪回。
 */
public class FmoAudioService extends Service {

    private static final String TAG = "FmoAudioService";
    public static final String CHANNEL_ID = "fmo_audio_playback";
    public static final int NOTIFICATION_ID = 0x46_4D_4F_01;

    public static final String ACTION_START = "com.fmologs.app.FMO_AUDIO_START";
    public static final String ACTION_STOP = "com.fmologs.app.FMO_AUDIO_STOP";
    public static final String ACTION_UPDATE = "com.fmologs.app.FMO_AUDIO_UPDATE";
    public static final String ACTION_MUTE = "com.fmologs.app.FMO_AUDIO_MUTE";
    public static final String ACTION_UNMUTE = "com.fmologs.app.FMO_AUDIO_UNMUTE";
    public static final String ACTION_STOP_CLICK = "com.fmologs.app.FMO_AUDIO_STOP_CLICK";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_MUTED = "muted";

    private static volatile String sTitle = "FMO 音频播放中";
    private static volatile String sText = "正在后台播放语音流";
    private static volatile boolean sMuted = false;

    private static volatile FmoAudioService sInstance;

    private MediaSessionCompat mediaSession;

    // 简单去抖：过滤掉 300ms 内的重复点击，防止 ROM 同时走 Callback + PendingIntent
    private volatile long lastActionTs = 0L;
    private volatile String lastAction = "";

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        ensureChannel();
        mediaSession = new MediaSessionCompat(this, "FmoAudioSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() {
                Log.i(TAG, "MediaSession onPlay");
                applyMute(false, "session.onPlay");
            }
            @Override public void onPause() {
                Log.i(TAG, "MediaSession onPause");
                applyMute(true, "session.onPause");
            }
            @Override public void onStop() {
                Log.i(TAG, "MediaSession onStop");
                if (!debounce("stop")) return;
                FmoAudioPlugin p = FmoAudioPlugin.getInstance();
                if (p != null) p.handleStopFromNotification();
            }
        });
        mediaSession.setActive(true);
        updatePlaybackState(sMuted);
        updateMetadata();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        Log.i(TAG, "onStartCommand action=" + action);

        if (ACTION_MUTE.equals(action)) {
            applyMute(true, "notif.mute");
            return START_NOT_STICKY;
        }
        if (ACTION_UNMUTE.equals(action)) {
            applyMute(false, "notif.unmute");
            return START_NOT_STICKY;
        }
        if (ACTION_STOP_CLICK.equals(action)) {
            if (debounce("stop")) {
                FmoAudioPlugin p = FmoAudioPlugin.getInstance();
                if (p != null) p.handleStopFromNotification();
            }
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE.equals(action) && intent != null) {
            applyExtras(intent);
            refreshNotificationAndState();
            return START_STICKY;
        }

        if (intent != null) applyExtras(intent);
        updatePlaybackState(sMuted);
        Notification notification = buildNotification(this, sTitle, sText, sMuted, mediaSession);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
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
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (sInstance == this) sInstance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /** 去抖：同一 action 在 300ms 内只处理一次 */
    private boolean debounce(String key) {
        long now = System.currentTimeMillis();
        if (key.equals(lastAction) && (now - lastActionTs) < 300L) {
            Log.i(TAG, "debounce dropped: " + key);
            return false;
        }
        lastAction = key;
        lastActionTs = now;
        return true;
    }

    /**
     * 幂等地应用静音状态：更新本地缓存 → 通知插件 → 同步刷新 mediaSession + 通知。
     */
    private void applyMute(boolean muted, String source) {
        if (!debounce(muted ? "mute" : "unmute")) return;
        if (sMuted == muted) {
            Log.i(TAG, "applyMute no-op (already " + muted + ") from " + source);
            refreshNotificationAndState();
            return;
        }
        sMuted = muted;
        Log.i(TAG, "applyMute -> " + muted + " from " + source);
        FmoAudioPlugin p = FmoAudioPlugin.getInstance();
        if (p != null) p.setMutedFromNotification(muted);
        refreshNotificationAndState();
    }

    private void refreshNotificationAndState() {
        updatePlaybackState(sMuted);
        updateMetadata();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(this, sTitle, sText, sMuted, mediaSession));
    }

    /**
     * 同步 MediaMetadata 到 MediaSession。
     * 这是小米/OPPO/vivo/荣耀等 ROM 的"灵动胶囊"以及锁屏媒体卡片读取
     * 标题（呼号）和副标题（地址）的唯一来源。
     */
    private void updateMetadata() {
        if (mediaSession == null) return;
        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, sTitle == null ? "" : sTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, sText == null ? "" : sText)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, sTitle == null ? "" : sTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, sText == null ? "" : sText);
        try {
            Bitmap art = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            if (art != null) {
                mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, art);
                mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
            }
        } catch (Exception ignore) {}
        mediaSession.setMetadata(mb.build());
    }

    private void applyExtras(Intent intent) {
        String t = intent.getStringExtra(EXTRA_TITLE);
        String x = intent.getStringExtra(EXTRA_TEXT);
        if (t != null && !t.isEmpty()) sTitle = t;
        if (x != null) sText = x;
        if (intent.hasExtra(EXTRA_MUTED)) {
            sMuted = intent.getBooleanExtra(EXTRA_MUTED, false);
        }
    }

    private void updatePlaybackState(boolean muted) {
        if (mediaSession == null) return;
        int state = muted ? PlaybackStateCompat.STATE_PAUSED : PlaybackStateCompat.STATE_PLAYING;
        PlaybackStateCompat ps = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY
                        | PlaybackStateCompat.ACTION_PAUSE
                        | PlaybackStateCompat.ACTION_PLAY_PAUSE
                        | PlaybackStateCompat.ACTION_STOP)
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build();
        mediaSession.setPlaybackState(ps);
    }

    private static Notification buildNotification(
            Context ctx, String title, String text, boolean muted, MediaSessionCompat session) {
        Intent launch = new Intent(ctx, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPI = PendingIntent.getActivity(
                ctx, 0, launch,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // 根据当前状态选择明确动作：muted=true 时按钮是"继续"（UNMUTE），否则是"暂停"（MUTE）
        String toggleAction = muted ? ACTION_UNMUTE : ACTION_MUTE;
        Intent togglePI = new Intent(ctx, FmoAudioService.class).setAction(toggleAction);
        PendingIntent togglePendingIntent = PendingIntent.getService(
                ctx, muted ? 11 : 10, togglePI,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent stopIntent = new Intent(ctx, FmoAudioService.class).setAction(ACTION_STOP_CLICK);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                ctx, 2, stopIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        int toggleIcon = muted ? android.R.drawable.ic_media_play : android.R.drawable.ic_media_pause;
        String toggleLabel = muted ? "继续" : "暂停";

        MediaStyle style = new MediaStyle()
                .setShowActionsInCompactView(0, 1)
                .setShowCancelButton(true)
                .setCancelButtonIntent(stopPendingIntent);
        if (session != null) {
            style.setMediaSession(session.getSessionToken());
        }

        Bitmap largeIcon = null;
        try {
            largeIcon = BitmapFactory.decodeResource(ctx.getResources(), R.mipmap.ic_launcher);
        } catch (Exception ignore) {}

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(contentPI)
                .setDeleteIntent(stopPendingIntent)
                .setOngoing(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .addAction(toggleIcon, toggleLabel, togglePendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stopPendingIntent)
                .setStyle(style);
        if (largeIcon != null) b.setLargeIcon(largeIcon);
        return b.build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "FMO 音频播放", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("保持音频流在后台持续播放");
                ch.setShowBadge(false);
                ch.setSound(null, null);
                ch.enableVibration(false);
                ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }
    }

    public static void startService(Context ctx) {
        Intent i = new Intent(ctx, FmoAudioService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stopService(Context ctx) {
        Intent i = new Intent(ctx, FmoAudioService.class).setAction(ACTION_STOP);
        ctx.startService(i);
    }

    /** 更新通知栏标题/副文本/静音图标 */
    public static void updateNotification(Context ctx, String title, String text, boolean muted) {
        // 优先通过单例同步刷新，避免 intent 异步转发
        FmoAudioService inst = sInstance;
        if (inst != null) {
            if (title != null && !title.isEmpty()) sTitle = title;
            if (text != null) sText = text;
            sMuted = muted;
            inst.refreshNotificationAndState();
            return;
        }
        Intent i = new Intent(ctx, FmoAudioService.class)
                .setAction(ACTION_UPDATE)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_TEXT, text)
                .putExtra(EXTRA_MUTED, muted);
        try {
            ctx.startService(i);
        } catch (Exception ignore) {}
    }
}
