package com.fmologs.app;

import android.content.res.Resources;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * FmoSystemUi: 获取真实系统栏安全区 inset 并通过 CSS 变量注入 WebView。
 * <p>
 * Android WebView 的 env(safe-area-inset-*) 在许多厂商 ROM 上返回 0px，
 * 本插件通过原生 WindowInsets API 获取真实值，在 JS 层写入 CSS 变量。
 * <p>
 * 关键：WindowInsets.getInsets() 返回的是原始物理像素 (raw px)，
 * 而 WebView 的 CSS px 对应 dp。必须通过 displayMetrics.density
 * 做 px → dp 转换，否则高 DPI 设备上数值会严重偏大。
 * <p>
 * 同时监听 inset 变化（手势/三键导航切换、折叠屏展开/折叠等），
 * 通过 {@code safeAreaChanged} 事件实时通知 JS 更新。
 */
@CapacitorPlugin(name = "FmoSystemUi")
public class FmoSystemUiPlugin extends Plugin {

    private static final String TAG = "FmoSystemUiPlugin";
    private static final int WEBVIEW_VERSION_WITH_SAFE_AREA_FIX = 140;

    /**
     * 屏幕密度，用于 px → dp 转换。1dp = 1px on mdpi, 3dp = 1px on xxhdpi。
     */
    private float density = 1.0f;
    private int webViewMajorVersion = 0;

    @Override
    public void load() {
        webViewMajorVersion = getWebViewMajorVersion();
        if (!shouldApplySafeAreaInsets()) {
            Log.i(TAG, "safe area disabled on sdk=" + Build.VERSION.SDK_INT
                    + ", webViewMajor=" + webViewMajorVersion);
            return;
        }

        try {
            Resources res = getActivity().getResources();
            DisplayMetrics metrics = res.getDisplayMetrics();
            density = metrics.density;
            Log.i(TAG, "density=" + density + " (width=" + metrics.widthPixels
                    + "px, dpi=" + metrics.densityDpi + ", webViewMajor=" + webViewMajorVersion + ")");

            View decor = getActivity().getWindow().getDecorView();
            ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
                JSObject data = buildInsetsResult(insets);
                Log.i(TAG, "safeAreaChanged " + data);
                notifyListeners("safeAreaChanged", data);
                return insets;
            });
            // 主动触发一次 dispatch，确保首次一定能收到 inset 值
            ViewCompat.requestApplyInsets(decor);
        } catch (Exception e) {
            Log.w(TAG, "setOnApplyWindowInsetsListener failed: " + e.getMessage());
        }
    }

    /**
     * getSafeAreaInsets() → { top, bottom, left, right }，单位 dp（与 CSS px 一致）。
     * JS 层在 app 启动时调用一次，拿到真实的安全区值写入 CSS 变量。
     * 若当前 View 尚未完成 layout，返回估算值（dp）。
     */
    @PluginMethod
    public void getSafeAreaInsets(PluginCall call) {
        JSObject result = new JSObject();
        try {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
            if (insets != null) {
                result = buildInsetsResult(insets);
            } else {
                result = buildFallbackResult();
            }
        } catch (Exception e) {
            Log.w(TAG, "getSafeAreaInsets failed: " + e.getMessage());
            result = buildFallbackResult();
        }
        Log.i(TAG, "getSafeAreaInsets → " + result);
        call.resolve(result);
    }

    /**
     * Build a JS result from compat insets.
     */
    private JSObject buildInsetsResult(WindowInsetsCompat insets) {
        JSObject result = new JSObject();
        int statusBarDp = 0;
        int navBarDp = 0;
        if (shouldApplySafeAreaInsets()) {
            statusBarDp = pxToDp(insets.getInsets(WindowInsetsCompat.Type.statusBars()).top);
            navBarDp = pxToDp(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom);
        }
        int left = 0;
        int right = 0;
        if (shouldApplySafeAreaInsets()) {
            left = pxToDp(Math.max(
                    insets.getInsets(WindowInsetsCompat.Type.systemBars()).left,
                    insets.getInsets(WindowInsetsCompat.Type.displayCutout()).left
            ));
            right = pxToDp(Math.max(
                    insets.getInsets(WindowInsetsCompat.Type.systemBars()).right,
                    insets.getInsets(WindowInsetsCompat.Type.displayCutout()).right
            ));
        }
        result.put("top", statusBarDp);
        result.put("bottom", navBarDp);
        result.put("left", left);
        result.put("right", right);
        return result;
    }

    /**
     * Android 15+ enforces edge-to-edge. WebView < 140 cannot reliably expose safe-area
     * values to CSS, so Capacitor SystemBars handles those devices with native padding.
     */
    private boolean shouldApplySafeAreaInsets() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM
                && webViewMajorVersion >= WEBVIEW_VERSION_WITH_SAFE_AREA_FIX;
    }

    private JSObject buildFallbackResult() {
        JSObject result = new JSObject();
        result.put("top", 0);
        result.put("bottom", 0);
        result.put("left", 0);
        result.put("right", 0);
        return result;
    }

    private int getWebViewMajorVersion() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return 0;
        try {
            PackageInfo packageInfo = WebView.getCurrentWebViewPackage();
            if (packageInfo == null || packageInfo.versionName == null) return 0;
            String major = packageInfo.versionName.split("\\.")[0];
            return Integer.parseInt(major);
        } catch (Exception e) {
            Log.w(TAG, "getWebViewMajorVersion failed: " + e.getMessage());
            return 0;
        }
    }

    /**
     * 将原始物理像素转换为 dp（与 WebView CSS px 一致）。
     */
    private int pxToDp(int px) {
        if (density <= 0) return px;
        return Math.round(px / density);
    }
}
