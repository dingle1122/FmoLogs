package com.fmologs.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * FmoEvents: 原生 WebSocket 多连接事件订阅插件。
 * - 每个 addressId 一条 /events 连接，互相独立重连。
 * - OkHttp pingInterval 20s 主动探活，对抗息屏半开连接。
 * - 指数退避重连：3→5→10→30s 封顶，连上后归零。
 */
@CapacitorPlugin(name = "FmoEvents")
public class FmoEventsPlugin extends Plugin {

    private static final String TAG = "FmoEventsPlugin";
    private static final long[] BACKOFF_MS = { 3000L, 5000L, 10000L, 30000L };

    private OkHttpClient httpClient;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, ConnectionState> connections = new ConcurrentHashMap<>();

    @Override
    public void load() {
        httpClient = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String addressId = call.getString("addressId");
        String url = call.getString("url");
        if (addressId == null || addressId.isEmpty() || url == null || url.isEmpty()) {
            call.reject("addressId and url are required");
            return;
        }

        // 若已存在同 id 连接，先彻底关闭
        ConnectionState existing = connections.get(addressId);
        if (existing != null) {
            existing.manualClose.set(true);
            existing.cancelReconnect();
            if (existing.ws != null) {
                try { existing.ws.cancel(); } catch (Exception ignore) {}
            }
        }

        ConnectionState state = new ConnectionState(addressId, url);
        connections.put(addressId, state);
        openWebSocket(state);
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String addressId = call.getString("addressId");
        if (addressId != null) {
            closeConnection(addressId);
        }
        call.resolve();
    }

    @PluginMethod
    public void disconnectAll(PluginCall call) {
        for (String id : connections.keySet().toArray(new String[0])) {
            closeConnection(id);
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (String id : connections.keySet().toArray(new String[0])) {
            closeConnection(id);
        }
        super.handleOnDestroy();
    }

    private void closeConnection(String addressId) {
        ConnectionState state = connections.remove(addressId);
        if (state == null) return;
        state.manualClose.set(true);
        state.cancelReconnect();
        if (state.ws != null) {
            try { state.ws.cancel(); } catch (Exception ignore) {}
        }
    }

    private void openWebSocket(final ConnectionState state) {
        if (state.manualClose.get()) return;
        Request request = new Request.Builder().url(state.url).build();
        Log.i(TAG, "[" + state.addressId + "] opening WS: " + state.url);
        state.ws = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                Log.i(TAG, "[" + state.addressId + "] onOpen");
                state.reconnectAttempts.set(0);
                emitStatus(state.addressId, "connected");
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                emitMessage(state.addressId, text);
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull ByteString bytes) {
                emitMessage(state.addressId, bytes.utf8());
            }

            @Override
            public void onClosing(@NonNull WebSocket ws, int code, @NonNull String reason) {
                try { ws.close(1000, null); } catch (Exception ignore) {}
            }

            @Override
            public void onClosed(@NonNull WebSocket ws, int code, @NonNull String reason) {
                Log.w(TAG, "[" + state.addressId + "] onClosed code=" + code + " reason=" + reason);
                scheduleReconnect(state);
            }

            @Override
            public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, Response response) {
                Log.w(TAG, "[" + state.addressId + "] onFailure: " + t.getMessage());
                scheduleReconnect(state);
            }
        });
    }

    private void scheduleReconnect(final ConnectionState state) {
        // 已被主动关闭或已被新连接替换，不再重连
        if (state.manualClose.get() || connections.get(state.addressId) != state) {
            emitStatus(state.addressId, "disconnected");
            return;
        }
        int attempts = state.reconnectAttempts.getAndIncrement();
        long delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
        Log.i(TAG, "[" + state.addressId + "] reconnect in " + delay + "ms (attempt " + (attempts + 1) + ")");
        emitStatus(state.addressId, "reconnecting");

        state.cancelReconnect();
        state.reconnectTask = new Runnable() {
            @Override
            public void run() {
                if (!state.manualClose.get() && connections.get(state.addressId) == state) {
                    openWebSocket(state);
                }
            }
        };
        handler.postDelayed(state.reconnectTask, delay);
    }

    private void emitMessage(String addressId, String text) {
        JSObject obj = new JSObject();
        obj.put("addressId", addressId);
        obj.put("data", text);
        notifyListeners("message", obj);
    }

    private void emitStatus(String addressId, String status) {
        JSObject obj = new JSObject();
        obj.put("addressId", addressId);
        obj.put("status", status);
        notifyListeners("status", obj);
    }

    private class ConnectionState {
        final String addressId;
        final String url;
        volatile WebSocket ws;
        final AtomicInteger reconnectAttempts = new AtomicInteger(0);
        final AtomicBoolean manualClose = new AtomicBoolean(false);
        volatile Runnable reconnectTask;

        ConnectionState(String addressId, String url) {
            this.addressId = addressId;
            this.url = url;
        }

        void cancelReconnect() {
            Runnable t = reconnectTask;
            if (t != null) {
                handler.removeCallbacks(t);
                reconnectTask = null;
            }
        }
    }
}
