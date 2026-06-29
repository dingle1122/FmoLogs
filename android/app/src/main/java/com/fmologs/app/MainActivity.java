package com.fmologs.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebSettings;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {
    private final Map<Long, File> webViewDownloads = new ConcurrentHashMap<>();
    private final BroadcastReceiver downloadCompleteReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;

            long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            File apkFile = webViewDownloads.remove(downloadId);
            if (apkFile == null) return;

            if (isDownloadSuccessful(downloadId) && apkFile.exists()) {
                openApkInstaller(apkFile);
            } else {
                Toast.makeText(MainActivity.this, "更新包下载失败", Toast.LENGTH_SHORT).show();
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FmoAudioPlugin.class);
        registerPlugin(FmoEventsPlugin.class);
        registerPlugin(FmoAprsPlugin.class);
        registerPlugin(FmoGridPlugin.class);
        registerPlugin(FmoSystemUiPlugin.class);
        registerPlugin(FmoLocationPlugin.class);
        registerPlugin(FmoUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // Keep H5 text metrics stable across OEM WebView variants such as foldables.
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings webSettings = getBridge().getWebView().getSettings();
            webSettings.setTextZoom(100);
            installWebViewDownloadInterceptor();
            installWebViewDownloadListener(getBridge().getWebView());
        }

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(downloadCompleteReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadCompleteReceiver, filter);
        }
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(downloadCompleteReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was not registered or was already unregistered.
        }
        super.onDestroy();
    }

    private void installWebViewDownloadListener(WebView webView) {
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || url.trim().isEmpty()) return;

            try {
                enqueueWebViewDownload(url, userAgent, contentDisposition, mimeType);
            } catch (Exception e) {
                Toast.makeText(this, "无法启动下载: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void installWebViewDownloadInterceptor() {
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (handleInternalDownloadUrl(uri)) {
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (handleInternalDownloadUrl(Uri.parse(url))) {
                    return true;
                }
                return getBridge().launchIntent(Uri.parse(url));
            }
        });
    }

    private boolean handleInternalDownloadUrl(Uri uri) {
        if (uri == null
                || !"fmologs".equals(uri.getScheme())
                || !"webview-download".equals(uri.getHost())) {
            return false;
        }

        String downloadUrl = uri.getQueryParameter("url");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            Toast.makeText(this, "下载地址为空", Toast.LENGTH_SHORT).show();
            return true;
        }

        try {
            enqueueWebViewDownload(
                    downloadUrl,
                    getBridge().getWebView().getSettings().getUserAgentString(),
                    null,
                    "application/vnd.android.package-archive"
            );
        } catch (Exception e) {
            Toast.makeText(this, "无法启动下载: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void enqueueWebViewDownload(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType
    ) {
        DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            throw new IllegalStateException("系统下载服务不可用");
        }

        File downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) {
            throw new IllegalStateException("下载目录不可用");
        }
        if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
            throw new IllegalStateException("无法创建下载目录");
        }

        String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (filename == null || filename.trim().isEmpty()) {
            filename = "FmoLogs-update.apk";
        }
        File apkFile = uniqueDownloadFile(downloadsDir, filename);

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(apkFile.getName());
        request.setDescription("正在下载 FmoLogs 更新包");
        request.setDestinationUri(Uri.fromFile(apkFile));
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);

        String resolvedMimeType = (mimeType == null || mimeType.trim().isEmpty())
                ? "application/vnd.android.package-archive"
                : mimeType;
        request.setMimeType(resolvedMimeType);

        if (userAgent != null && !userAgent.trim().isEmpty()) {
            request.addRequestHeader("User-Agent", userAgent);
        }
        String cookie = CookieManager.getInstance().getCookie(url);
        if (cookie != null && !cookie.trim().isEmpty()) {
            request.addRequestHeader("Cookie", cookie);
        }

        long downloadId = downloadManager.enqueue(request);
        webViewDownloads.put(downloadId, apkFile);
        Toast.makeText(this, "已在 WebView 中开始下载更新包", Toast.LENGTH_SHORT).show();
    }

    private File uniqueDownloadFile(File dir, String filename) {
        String safeName = filename.replaceAll("[\\\\/:*?\"<>|]", "_");
        File file = new File(dir, safeName);
        if (!file.exists()) return file;

        String base = safeName;
        String ext = "";
        int dot = safeName.lastIndexOf('.');
        if (dot > 0) {
            base = safeName.substring(0, dot);
            ext = safeName.substring(dot);
        }

        int index = 1;
        do {
            file = new File(dir, base + "-" + index + ext);
            index++;
        } while (file.exists());
        return file;
    }

    private boolean isDownloadSuccessful(long downloadId) {
        DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) return false;

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) return false;
            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            return statusIndex >= 0
                    && cursor.getInt(statusIndex) == DownloadManager.STATUS_SUCCESSFUL;
        }
    }

    private void openApkInstaller(File apkFile) {
        Uri uri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                apkFile
        );

        Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        intent.setData(uri);
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(intent);
    }
}
