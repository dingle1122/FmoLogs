package com.fmologs.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.content.FileProvider;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FmoUpdater")
public class FmoUpdaterPlugin extends Plugin {

    private static final String TAG = "FmoUpdaterPlugin";
    private static final String CHANNEL_ID = "fmo_update";
    private static final int NOTIFICATION_ID = 2601;
    private static final int READY_NOTIFICATION_ID = 2602;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 120000;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean cancelRequested = false;
    private volatile HttpURLConnection currentConnection = null;
    private volatile File currentDownloadFile = null;
    private volatile File downloadedApkFile = null;

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("versionCode", info.getLongVersionCode());
            } else {
                ret.put("versionCode", info.versionCode);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "getCurrentVersion failed" : e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String apkUrl = call.getString("apkUrl");
        String sha256 = call.getString("sha256", "");
        if (apkUrl == null || apkUrl.trim().isEmpty()) {
            call.reject("apkUrl is required");
            return;
        }

        cancelRequested = false;
        executor.execute(() -> {
            try {
                File apkFile = downloadApk(apkUrl.trim());
                if (sha256 != null && !sha256.trim().isEmpty()) {
                    String actual = sha256(apkFile);
                    if (!actual.equalsIgnoreCase(sha256.trim())) {
                        call.reject("APK SHA-256 mismatch");
                        return;
                    }
                }
                downloadedApkFile = apkFile;
                showReadyNotification(apkFile);
                JSObject ret = new JSObject();
                ret.put("path", apkFile.getAbsolutePath());
                call.resolve(ret);
                mainHandler.post(() -> installApk(apkFile));
            } catch (Exception e) {
                Log.e(TAG, "downloadAndInstall failed", e);
                call.reject(e.getMessage() == null ? "downloadAndInstall failed" : e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelUpdate(PluginCall call) {
        cancelRequested = true;
        HttpURLConnection conn = currentConnection;
        if (conn != null) {
            conn.disconnect();
        }
        File file = currentDownloadFile;
        if (file != null && file.exists()) {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
        downloadedApkFile = null;
        clearNotification();
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void installDownloadedUpdate(PluginCall call) {
        File apkFile = downloadedApkFile;
        if (apkFile == null || !apkFile.exists()) {
            File fallback = new File(getContext().getCacheDir(), "updates/FmoLogs-update.apk");
            if (fallback.exists()) {
                apkFile = fallback;
                downloadedApkFile = apkFile;
            } else {
                call.reject("No downloaded update found");
                return;
            }
        }
        installApk(apkFile);
        JSObject ret = new JSObject();
        ret.put("path", apkFile.getAbsolutePath());
        call.resolve(ret);
    }

    private File downloadApk(String apkUrl) throws Exception {
        URL url = new URL(apkUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        currentConnection = conn;
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setInstanceFollowRedirects(true);
        conn.connect();

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new IllegalStateException("Download failed: HTTP " + code);
        }
        int totalBytes = conn.getContentLength();

        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Cannot create update cache directory");
        }
        File apkFile = new File(dir, "FmoLogs-update.apk");
        currentDownloadFile = apkFile;

        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apkFile)) {
            byte[] buf = new byte[64 * 1024];
            int len;
            long downloaded = 0;
            while ((len = in.read(buf)) != -1) {
                if (cancelRequested || Thread.currentThread().isInterrupted()) {
                    throw new InterruptedException("Update cancelled");
                }
                out.write(buf, 0, len);
                downloaded += len;
                notifyProgress(totalBytes > 0 ? (downloaded * 100.0 / totalBytes) : 0,
                        downloaded, totalBytes > 0 ? totalBytes : 0, "downloading");
            }
        } finally {
            conn.disconnect();
            currentConnection = null;
            currentDownloadFile = null;
        }

        return apkFile;
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[64 * 1024];
            int len;
            while ((len = in.read(buf)) != -1) {
                digest.update(buf, 0, len);
            }
        }

        byte[] hash = digest.digest();
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    private void installApk(File apkFile) {
        Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
        );

        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        intent.setData(uri);
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
    }

    private void notifyProgress(double percent, long downloadedBytes, long totalBytes, String status) {
        JSObject data = new JSObject();
        data.put("percent", Math.max(0, Math.min(100, percent)));
        data.put("downloadedBytes", downloadedBytes);
        data.put("totalBytes", totalBytes);
        data.put("status", status);
        notifyListeners("progress", data);
        updateNotification((int) Math.round(Math.max(0, Math.min(100, percent))), downloadedBytes, totalBytes, status);
    }

    private void updateNotification(int percent, long downloadedBytes, long totalBytes, String status) {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "应用更新",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("FmoLogs 应用更新进度");
            nm.createNotificationChannel(channel);
        }

        String title = "downloading".equals(status) ? "正在下载更新"
                : "downloaded".equals(status) ? "下载完成，点击更新"
                : "正在安装更新";
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText("downloaded".equals(status)
                        ? "下载完成，点击更新"
                        : totalBytes > 0
                            ? String.format("%d%%  %s / %s", percent, humanBytes(downloadedBytes), humanBytes(totalBytes))
                            : String.format("%d%%", percent))
                .setOnlyAlertOnce(true)
                .setOngoing(!"downloaded".equals(status))
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setProgress("downloaded".equals(status) ? 0 : 100, Math.max(0, Math.min(100, percent)), false);

        nm.notify(NOTIFICATION_ID, builder.build());
    }

    private void showReadyNotification(File apkFile) {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("fmologs://update-install"));

        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                ctx,
                2602,
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "应用更新",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("FmoLogs 应用更新进度");
            nm.createNotificationChannel(channel);
        }

        nm.cancel(NOTIFICATION_ID);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("下载完成，点击更新")
                .setContentText("点击打开安装器")
                .setOnlyAlertOnce(true)
                .setOngoing(false)
                .setAutoCancel(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent);

        nm.notify(READY_NOTIFICATION_ID, builder.build());
    }

    private void clearNotification() {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
            nm.cancel(READY_NOTIFICATION_ID);
        }
    }

    private String humanBytes(long value) {
        if (value <= 0) return "0 B";
        String[] units = {"B", "KB", "MB", "GB"};
        double size = value;
        int unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        return String.format(unit == 0 ? "%.0f %s" : "%.1f %s", size, units[unit]);
    }
}
