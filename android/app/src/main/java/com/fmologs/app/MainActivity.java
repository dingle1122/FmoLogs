package com.fmologs.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.TextUtils;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    private ValueCallback<Uri[]> pendingFilePathCallback;
    private static final class WebViewDownloadRecord {
        final File file;
        final boolean installAfterDownload;

        WebViewDownloadRecord(File file, boolean installAfterDownload) {
            this.file = file;
            this.installAfterDownload = installAfterDownload;
        }
    }

    private final Map<Long, WebViewDownloadRecord> webViewDownloads = new ConcurrentHashMap<>();
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.StartActivityForResult(),
                    this::handleFileChooserResult
            );
    private final BroadcastReceiver downloadCompleteReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;

            long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            WebViewDownloadRecord record = webViewDownloads.remove(downloadId);
            if (record == null) return;

            if (isDownloadSuccessful(downloadId) && record.file.exists()) {
                if (record.installAfterDownload) {
                    openApkInstaller(record.file);
                } else {
                    Toast.makeText(
                            MainActivity.this,
                            "文件已保存到下载目录: " + record.file.getName(),
                            Toast.LENGTH_SHORT
                    ).show();
                }
            } else {
                Toast.makeText(MainActivity.this, "文件下载失败", Toast.LENGTH_SHORT).show();
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
            installSafeFileChooser(getBridge());
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
                enqueueWebViewDownload(url, userAgent, contentDisposition, mimeType, null);
            } catch (Exception e) {
                Toast.makeText(this, "无法启动下载: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void installSafeFileChooser(Bridge bridge) {
        bridge.getWebView().setWebChromeClient(new SafeBridgeWebChromeClient(bridge));
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
        String filename = uri.getQueryParameter("filename");
        String mimeType = uri.getQueryParameter("mimeType");
        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            Toast.makeText(this, "下载地址为空", Toast.LENGTH_SHORT).show();
            return true;
        }

        try {
            enqueueWebViewDownload(
                    downloadUrl,
                    getBridge().getWebView().getSettings().getUserAgentString(),
                    null,
                    mimeType,
                    filename
            );
        } catch (Exception e) {
            Toast.makeText(this, "无法启动下载: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private boolean showSafeFileChooser(
            ValueCallback<Uri[]> filePathCallback,
            WebChromeClient.FileChooserParams fileChooserParams
    ) {
        if (pendingFilePathCallback != null) {
            pendingFilePathCallback.onReceiveValue(null);
        }
        pendingFilePathCallback = filePathCallback;

        Intent intent;
        try {
            intent = buildSafeFileChooserIntent(fileChooserParams);
        } catch (Exception e) {
            finishPendingFileChooser(null);
            Toast.makeText(this, "无法打开文件选择器: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            return true;
        }

        try {
            fileChooserLauncher.launch(intent);
        } catch (ActivityNotFoundException e) {
            finishPendingFileChooser(null);
            Toast.makeText(this, "设备未找到可用的文件管理器", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            finishPendingFileChooser(null);
            Toast.makeText(this, "无法启动文件选择器: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private Intent buildSafeFileChooserIntent(WebChromeClient.FileChooserParams fileChooserParams) {
        Intent intent;
        try {
            intent = fileChooserParams != null ? fileChooserParams.createIntent() : null;
        } catch (Exception ignored) {
            intent = null;
        }

        if (intent == null) {
            intent = new Intent(Intent.ACTION_GET_CONTENT);
        }

        intent.addCategory(Intent.CATEGORY_OPENABLE);

        if (fileChooserParams != null
                && fileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        String[] validTypes = normalizeAcceptTypes(
                fileChooserParams != null ? fileChooserParams.getAcceptTypes() : null
        );
        String intentType = intent.getType();

        if (validTypes.length > 1) {
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, validTypes);
        } else if (validTypes.length == 1) {
            intent.setType(validTypes[0]);
        } else if (TextUtils.isEmpty(intentType)) {
            intent.setType("*/*");
        } else if (intentType.startsWith(".")) {
            intent.setType("*/*");
        }

        return intent;
    }

    private String[] normalizeAcceptTypes(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) {
            return new String[0];
        }

        List<String> validTypes = new ArrayList<>();
        for (String acceptType : acceptTypes) {
            if (acceptType == null) continue;
            String[] parts = acceptType.split(",");
            for (String rawPart : parts) {
                String part = rawPart == null ? "" : rawPart.trim();
                if (part.isEmpty()) continue;
                if (part.startsWith(".")) continue;
                if (!validTypes.contains(part)) {
                    validTypes.add(part);
                }
            }
        }
        return validTypes.toArray(new String[0]);
    }

    private void handleFileChooserResult(ActivityResult activityResult) {
        Uri[] result = null;
        Intent data = activityResult.getData();

        if (activityResult.getResultCode() == Activity.RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data != null && data.getData() != null) {
                result = new Uri[] { data.getData() };
            }
        }

        finishPendingFileChooser(result);
    }

    private void finishPendingFileChooser(Uri[] result) {
        if (pendingFilePathCallback != null) {
            pendingFilePathCallback.onReceiveValue(result);
            pendingFilePathCallback = null;
        }
    }

    private final class SafeBridgeWebChromeClient extends BridgeWebChromeClient {
        SafeBridgeWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                WebChromeClient.FileChooserParams fileChooserParams
        ) {
            return showSafeFileChooser(filePathCallback, fileChooserParams);
        }
    }

    private void enqueueWebViewDownload(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType,
            String preferredFilename
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

        String filename = (preferredFilename == null || preferredFilename.trim().isEmpty())
                ? URLUtil.guessFileName(url, contentDisposition, mimeType)
                : preferredFilename.trim();
        if (filename == null || filename.trim().isEmpty()) {
            filename = (mimeType != null && APK_MIME_TYPE.equalsIgnoreCase(mimeType.trim()))
                    ? "FmoLogs-update.apk"
                    : "download.bin";
        }
        File apkFile = uniqueDownloadFile(downloadsDir, filename);
        boolean shouldInstallAfterDownload = shouldInstallDownloadedFile(apkFile.getName(), mimeType);

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(apkFile.getName());
        request.setDescription(shouldInstallAfterDownload ? "正在下载 FmoLogs 更新包" : "正在下载文件");
        request.setDestinationUri(Uri.fromFile(apkFile));
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);

        String resolvedMimeType = (mimeType == null || mimeType.trim().isEmpty())
                ? "application/octet-stream"
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
        webViewDownloads.put(
                downloadId,
                new WebViewDownloadRecord(apkFile, shouldInstallAfterDownload)
        );
        Toast.makeText(
                this,
                shouldInstallAfterDownload ? "已在 WebView 中开始下载更新包" : "已在 WebView 中开始下载文件",
                Toast.LENGTH_SHORT
        ).show();
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

    private boolean shouldInstallDownloadedFile(String filename, String mimeType) {
        if (mimeType != null && APK_MIME_TYPE.equalsIgnoreCase(mimeType.trim())) {
            return true;
        }
        return filename != null && filename.toLowerCase().endsWith(".apk");
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
