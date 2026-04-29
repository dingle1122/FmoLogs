package com.fmologs.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Iterator;
import java.util.LinkedList;
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
    // 发言历史保留时长：1 小时
    private static final long HISTORY_RETENTION_MS = 60L * 60L * 1000L;

    private OkHttpClient httpClient;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, ConnectionState> connections = new ConcurrentHashMap<>();
    // 原生侧维护的业务状态（JS 冻结期间也持续累积），按 addressId 隔离
    private final Map<String, BusinessState> business = new ConcurrentHashMap<>();

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
        business.put(addressId, new BusinessState());
        openWebSocket(state);
        call.resolve();
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        String addressId = call.getString("addressId");
        JSObject result = new JSObject();
        JSArray list = new JSArray();
        if (addressId != null && !addressId.isEmpty()) {
            BusinessState bs = business.get(addressId);
            if (bs != null) {
                list.put(buildSnapshot(addressId, bs));
            }
        } else {
            for (Map.Entry<String, BusinessState> e : business.entrySet()) {
                list.put(buildSnapshot(e.getKey(), e.getValue()));
            }
        }
        result.put("connections", list);
        call.resolve(result);
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
        business.remove(addressId);
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
                Log.i(TAG, "[" + state.addressId + "] recv len=" + text.length()
                        + " preview=" + text.substring(0, Math.min(120, text.length())));
                processBusinessMessage(state.addressId, text);
                emitMessage(state.addressId, text);
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull ByteString bytes) {
                String s = bytes.utf8();
                Log.i(TAG, "[" + state.addressId + "] recv(bytes) len=" + s.length()
                        + " preview=" + s.substring(0, Math.min(120, s.length())));
                processBusinessMessage(state.addressId, s);
                emitMessage(state.addressId, s);
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

    /**
     * 解析 qso/callsign 消息，更新原生侧 currentSpeaker 与 history。
     * 业务规则与 JS 端 handleEventMessage 完全一致：
     * - 开始发言：将所有未结束记录 endTime=now；若历史里已有同 callsign 记录则提到队首并重置
     *   startTime/endTime/grid，否则新增一条；currentSpeaker = callsign
     * - 结束发言：将所有未结束记录 endTime=now；currentSpeaker = ""
     * - 每次操作后清理 (endTime||startTime) < now-1h 的记录
     */
    private void processBusinessMessage(String addressId, String text) {
        BusinessState bs = business.get(addressId);
        if (bs == null) return;
        try {
            JSONObject msg = new JSONObject(text);
            if (!"qso".equals(msg.optString("type"))) return;
            if (!"callsign".equals(msg.optString("subType"))) return;
            JSONObject data = msg.optJSONObject("data");
            if (data == null) return;

            String callsign = data.optString("callsign", "");
            boolean isSpeaking = data.optBoolean("isSpeaking", false);
            String grid = data.optString("grid", "");
            long now = System.currentTimeMillis();

            synchronized (bs) {
                if (isSpeaking && callsign != null && !callsign.isEmpty()) {
                    // 结束所有未结束记录
                    for (HistoryEntry h : bs.history) {
                        if (h.endTime == null) h.endTime = now;
                    }
                    bs.currentSpeaker = callsign;
                    bs.currentGrid = grid;
                    // 查找已有同 callsign 记录
                    HistoryEntry existing = null;
                    Iterator<HistoryEntry> it = bs.history.iterator();
                    while (it.hasNext()) {
                        HistoryEntry h = it.next();
                        if (callsign.equals(h.callsign)) {
                            existing = h;
                            it.remove();
                            break;
                        }
                    }
                    if (existing != null) {
                        existing.startTime = now;
                        existing.endTime = null;
                        existing.grid = grid;
                        bs.history.addFirst(existing);
                    } else {
                        bs.history.addFirst(new HistoryEntry(callsign, grid, now));
                    }
                } else {
                    for (HistoryEntry h : bs.history) {
                        if (h.endTime == null) h.endTime = now;
                    }
                    bs.currentSpeaker = "";
                    bs.currentGrid = "";
                }
                // 清理 > 1h
                long cutoff = now - HISTORY_RETENTION_MS;
                Iterator<HistoryEntry> it = bs.history.iterator();
                while (it.hasNext()) {
                    HistoryEntry h = it.next();
                    long t = h.endTime != null ? h.endTime : h.startTime;
                    if (t < cutoff) it.remove();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "[" + addressId + "] parse business failed: " + e.getMessage());
        }
    }

    private JSObject buildSnapshot(String addressId, BusinessState bs) {
        JSObject obj = new JSObject();
        obj.put("addressId", addressId);
        synchronized (bs) {
            // 进场先清理一下
            long cutoff = System.currentTimeMillis() - HISTORY_RETENTION_MS;
            Iterator<HistoryEntry> it = bs.history.iterator();
            while (it.hasNext()) {
                HistoryEntry h = it.next();
                long t = h.endTime != null ? h.endTime : h.startTime;
                if (t < cutoff) it.remove();
            }
            obj.put("currentSpeaker", bs.currentSpeaker == null ? "" : bs.currentSpeaker);
            obj.put("currentGrid", bs.currentGrid == null ? "" : bs.currentGrid);
            JSArray arr = new JSArray();
            for (HistoryEntry h : bs.history) {
                JSObject entry = new JSObject();
                entry.put("callsign", h.callsign);
                entry.put("grid", h.grid == null ? "" : h.grid);
                entry.put("startTime", h.startTime);
                if (h.endTime != null) {
                    entry.put("endTime", h.endTime.longValue());
                } else {
                    entry.put("endTime", JSONObject.NULL);
                }
                arr.put(entry);
            }
            obj.put("history", arr);
        }
        return obj;
    }

    private static class HistoryEntry {
        String callsign;
        String grid;
        long startTime;
        Long endTime; // null = 进行中

        HistoryEntry(String callsign, String grid, long startTime) {
            this.callsign = callsign;
            this.grid = grid;
            this.startTime = startTime;
            this.endTime = null;
        }
    }

    private static class BusinessState {
        volatile String currentSpeaker = "";
        volatile String currentGrid = "";
        final LinkedList<HistoryEntry> history = new LinkedList<>();
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
