package com.fmologs.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * FmoAudio: 原生 WebSocket + AudioTrack 8kHz/MONO/PCM_16 流播放。
 * 脱离 WebView 生命周期，彻底解决息屏/切后台中断问题。
 */
@CapacitorPlugin(name = "FmoAudio")
public class FmoAudioPlugin extends Plugin {

    private static final String TAG = "FmoAudioPlugin";
    private static final int SAMPLE_RATE = 8000;
    private static final int RECONNECT_DELAY_MS = 3000;

    private static volatile FmoAudioPlugin sInstance;

    public static FmoAudioPlugin getInstance() { return sInstance; }

    private OkHttpClient httpClient;
    private WebSocket webSocket;
    private AudioTrack audioTrack;
    private PowerManager.WakeLock wakeLock;
    private final AtomicBoolean serviceStarted = new AtomicBoolean(false);

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean manualStop = new AtomicBoolean(false);
    private final AtomicBoolean muted = new AtomicBoolean(false);
    private final AtomicReference<Float> gain = new AtomicReference<>(5.0f); // 与 Web 端对齐：100% => 5.0

    private String currentUrl;
    private volatile String currentTitle = "FMO 音频播放中";
    private volatile String currentText = "正在后台播放语音流";

    @Override
    public void load() {
        sInstance = this;
        httpClient = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
    }

    private void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return; // TIRAMISU
        final Activity act = getActivity();
        if (act == null) return;
        if (ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) return;
        // requestPermissions 必须在 UI 线程调用，@PluginMethod 默认在后台线程
        act.runOnUiThread(() -> {
            try {
                ActivityCompat.requestPermissions(
                        act,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        1001);
            } catch (Exception e) {
                Log.w(TAG, "requestPermissions failed", e);
            }
        });
    }

    private void acquireWakeLock() {
        Context ctx = getContext();
        if (ctx == null) return;
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FmoAudio:wakelock");
        wakeLock.setReferenceCounted(false);
        try {
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 上限 24h
            Log.i(TAG, "WakeLock acquired");
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire failed", e);
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.i(TAG, "WakeLock released");
            }
        } catch (Exception ignore) {}
        wakeLock = null;
    }

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        Integer volumePercent = call.getInt("volumePercent", 100);
        Boolean mutedInit = call.getBoolean("muted", false);

        gain.set(percentToGain(volumePercent));
        muted.set(Boolean.TRUE.equals(mutedInit));
        currentUrl = url;
        manualStop.set(false);

        Log.i(TAG, "start(): url=" + url + " gain=" + gain.get() + " muted=" + muted.get());
        try {
            ensureNotificationPermission();
            // 启动自己的前台服务，挂起进程保命
            try {
                FmoAudioService.startService(getContext());
                serviceStarted.set(true);
            } catch (Exception svcErr) {
                Log.w(TAG, "FmoAudioService start failed", svcErr);
            }
            acquireWakeLock();
            initAudioTrack();
            openWebSocket(url);
            running.set(true);
            emitStatus("connecting");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "start failed", e);
            releaseInternal();
            call.reject("start failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        manualStop.set(true);
        releaseInternal();
        emitStatus("disconnected");
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Integer volumePercent = call.getInt("volumePercent", 100);
        gain.set(percentToGain(volumePercent));
        call.resolve();
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        boolean m = Boolean.TRUE.equals(call.getBoolean("muted", false));
        muted.set(m);
        // 同步通知栏按钮图标
        if (serviceStarted.get()) {
            Context ctx = getContext();
            if (ctx != null) FmoAudioService.updateNotification(ctx, currentTitle, currentText, m);
        }
        call.resolve();
    }

    @PluginMethod
    public void updateInfo(PluginCall call) {
        String title = call.getString("title", "FMO 音频播放中");
        String text = call.getString("text", "");
        currentTitle = title != null ? title : "FMO 音频播放中";
        currentText = text != null ? text : "";
        if (serviceStarted.get()) {
            Context ctx = getContext();
            if (ctx != null) FmoAudioService.updateNotification(ctx, currentTitle, currentText, muted.get());
        }
        call.resolve();
    }

    /** 通知按钮回调：明确的静音/解除静音动作（幂等）。
     *  由 FmoAudioService 在已同步刷新 mediaSession + 通知后调用，
     *  本方法只管播放对象的 muted 标志和前端同步。 */
    public void setMutedFromNotification(boolean newMuted) {
        if (muted.get() == newMuted) return;
        muted.set(newMuted);
        Log.i(TAG, "setMutedFromNotification -> muted=" + newMuted);
        JSObject data = new JSObject();
        data.put("muted", newMuted);
        notifyListeners("muteChanged", data);
    }

    /** 兼容旧调用：翻转静音状态。不再被 Service 使用。 */
    public void handleToggleFromNotification() {
        boolean newMuted = !muted.get();
        muted.set(newMuted);
        Log.i(TAG, "notification toggle -> muted=" + newMuted);
        Context ctx = getContext();
        if (ctx != null) FmoAudioService.updateNotification(ctx, currentTitle, currentText, newMuted);
        JSObject data = new JSObject();
        data.put("muted", newMuted);
        notifyListeners("muteChanged", data);
    }

    /** 通知按钮回调：停止 */
    public void handleStopFromNotification() {
        Log.i(TAG, "notification stop");
        manualStop.set(true);
        releaseInternal();
        emitStatus("disconnected");
    }

    @Override
    protected void handleOnDestroy() {
        manualStop.set(true);
        releaseInternal();
        super.handleOnDestroy();
    }

    // --- Internal ---

    private void initAudioTrack() {
        int minBuf = AudioTrack.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
        // 放大缓冲，抵御网络抖动
        int bufferSize = Math.max(minBuf * 4, SAMPLE_RATE); // 至少 1s

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
        AudioFormat fmt = new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();

        if (audioTrack != null) {
            try { audioTrack.release(); } catch (Exception ignore) {}
            audioTrack = null;
        }

        audioTrack = new AudioTrack.Builder()
                .setAudioAttributes(attrs)
                .setAudioFormat(fmt)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
        audioTrack.play();
    }

    private void openWebSocket(@NonNull String url) {
        if (webSocket != null) {
            try { webSocket.cancel(); } catch (Exception ignore) {}
            webSocket = null;
        }
        Request request = new Request.Builder().url(url).build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                Log.i(TAG, "WS onOpen");
                emitStatus("connected");
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull ByteString bytes) {
                handlePcm(bytes);
            }

            @Override
            public void onClosing(@NonNull WebSocket ws, int code, @NonNull String reason) {
                Log.w(TAG, "WS onClosing code=" + code + " reason=" + reason);
                try { ws.close(1000, null); } catch (Exception ignore) {}
            }

            @Override
            public void onClosed(@NonNull WebSocket ws, int code, @NonNull String reason) {
                Log.w(TAG, "WS onClosed code=" + code + " reason=" + reason);
                handleDisconnect();
            }

            @Override
            public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, Response response) {
                Log.w(TAG, "WS onFailure: " + t.getMessage(), t);
                handleDisconnect();
            }
        });
    }

    private void handlePcm(ByteString bytes) {
        if (!running.get() || audioTrack == null) return;

        byte[] src = bytes.toByteArray();
        int len = src.length - (src.length & 1); // 16-bit 对齐
        if (len <= 0) return;

        if (muted.get()) {
            // 静音：写入等长零数据，保持时间线
            byte[] zero = new byte[len];
            safeWrite(zero, len);
            return;
        }

        float g = gain.get();
        // 软件增益 + clamp
        ByteBuffer in = ByteBuffer.wrap(src, 0, len).order(ByteOrder.LITTLE_ENDIAN);
        byte[] out = new byte[len];
        ByteBuffer ob = ByteBuffer.wrap(out).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < len; i += 2) {
            short s = in.getShort(i);
            int v = Math.round(s * g);
            if (v > 32767) v = 32767;
            else if (v < -32768) v = -32768;
            ob.putShort(i, (short) v);
        }
        safeWrite(out, len);

        // 首次出声时广播播放状态
        if (firstChunk.compareAndSet(true, false)) {
            Log.i(TAG, "first pcm chunk arrived, len=" + len);
            emitStatus("playing");
        }

        // 每 5 秒打一次心跳日志，用于识别后台数据是否继续到达
        long now = System.currentTimeMillis();
        long last = lastBeatMs;
        if (now - last > 5000) {
            lastBeatMs = now;
            Log.d(TAG, "heartbeat: writing pcm len=" + len + " gain=" + g + " muted=" + muted.get());
        }
    }

    private volatile long lastBeatMs = 0;

    private final AtomicBoolean firstChunk = new AtomicBoolean(true);

    private void safeWrite(byte[] data, int len) {
        try {
            audioTrack.write(data, 0, len);
        } catch (Exception e) {
            Log.w(TAG, "audioTrack.write failed", e);
        }
    }

    private void handleDisconnect() {
        if (manualStop.get() || !running.get()) {
            emitStatus("disconnected");
            return;
        }
        emitStatus("reconnecting");
        getActivity().runOnUiThread(() -> {
            new android.os.Handler().postDelayed(() -> {
                if (!manualStop.get() && running.get() && currentUrl != null) {
                    firstChunk.set(true);
                    try {
                        openWebSocket(currentUrl);
                    } catch (Exception e) {
                        Log.w(TAG, "reconnect failed", e);
                    }
                }
            }, RECONNECT_DELAY_MS);
        });
    }

    private void releaseInternal() {
        running.set(false);
        firstChunk.set(true);
        if (webSocket != null) {
            try { webSocket.cancel(); } catch (Exception ignore) {}
            webSocket = null;
        }
        if (audioTrack != null) {
            try { audioTrack.pause(); } catch (Exception ignore) {}
            try { audioTrack.flush(); } catch (Exception ignore) {}
            try { audioTrack.release(); } catch (Exception ignore) {}
            audioTrack = null;
        }
        releaseWakeLock();
        // 仅在服务确实启动过时才去停，避免首次 stop() 空启服务
        if (serviceStarted.compareAndSet(true, false)) {
            try {
                Context ctx = getContext();
                if (ctx != null) FmoAudioService.stopService(ctx);
            } catch (Exception ignore) {}
        }
    }

    private void emitStatus(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("status", data);
    }

    /**
     * 与 Web 端保持一致的音量曲线：gain = 5 * (p/100)^1.5
     */
    private static float percentToGain(Integer percent) {
        if (percent == null || percent <= 0) return 0f;
        double ratio = percent / 100.0;
        return (float) (5.0 * Math.pow(ratio, 1.5));
    }
}
