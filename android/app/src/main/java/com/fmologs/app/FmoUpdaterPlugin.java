package com.fmologs.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.content.FileProvider;

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
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 120000;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

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

                installApk(apkFile);
                JSObject ret = new JSObject();
                ret.put("path", apkFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "downloadAndInstall failed", e);
                call.reject(e.getMessage() == null ? "downloadAndInstall failed" : e.getMessage());
            }
        });
    }

    private File downloadApk(String apkUrl) throws Exception {
        URL url = new URL(apkUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setInstanceFollowRedirects(true);
        conn.connect();

        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new IllegalStateException("Download failed: HTTP " + code);
        }

        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Cannot create update cache directory");
        }
        File apkFile = new File(dir, "FmoLogs-update.apk");

        try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apkFile)) {
            byte[] buf = new byte[64 * 1024];
            int len;
            while ((len = in.read(buf)) != -1) {
                out.write(buf, 0, len);
            }
        } finally {
            conn.disconnect();
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

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
    }
}
