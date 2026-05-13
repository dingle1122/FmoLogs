package com.fmologs.app;

import android.location.Location;
import android.util.Log;

/**
 * 基于恒定速度模型的二维卡尔曼滤波器。
 *
 * 状态向量: [lat, lng, v_lat, v_lng]  (位置 + 速度)
 *
 * 特点：
 * - 根据 GPS 精度动态调整测量噪声 R（精度差 → R 大 → 信任预测）
 * - 根据移动速度动态调整过程噪声 Q（高速 → Q 大 → 信任测量）
 * - 自动处理 GPS 断连后的重置
 * - 支持步行和行驶两种场景的自动适配
 */
public class KalmanFilter {
    private static final String TAG = "KalmanFilter";

    private double lat;        // 滤波后的纬度 (degrees)
    private double lng;        // 滤波后的经度 (degrees)
    private double vLat;       // 纬度方向速度 (m/s)
    private double vLng;       // 经度方向速度 (m/s)

    // 状态估计协方差矩阵 (4x4)
    private double p00, p01, p02, p03;
    private double p10, p11, p12, p13;
    private double p20, p21, p22, p23;
    private double p30, p31, p32, p33;

    private long lastTimestamp;   // 上次更新的时间戳 (ms)
    private boolean initialized;  // 是否已完成初始化
    private long lastInputTime;   // 上次收到有效输入的时间 (ms)
    private int stallCount;       // 静止跳变计数器

    private static final double LAT_DEG_TO_METERS = 111320.0;  // 1度纬度 ≈ 111.32km
    private static final double LNG_DEG_AT_EQ = 111320.0;      // 赤道上1度经度 ≈ 111.32km

    /** 默认过程噪声 (m/s²)² - 控制滤波器对速度变化的敏感度 */
    private static final double DEFAULT_PROCESS_NOISE = 0.5;

    /** GPS 断连超过此时间(ms)则重置滤波器 */
    private static final long RESET_THRESHOLD_MS = 10_000L;

    /** 静止判定半径 (m) - 小于此速度视为静止 */
    private static final double STATIONARY_SPEED_MPS = 0.5;

    /** 强制重置的跳变阈值 (m) - 误差超过此值认为 GPS 严重漂移 */
    private static final double RESET_JUMP_THRESHOLD_METERS = 200.0;

    public KalmanFilter() {
        reset();
    }

    /**
     * 重置滤波器状态
     */
    public void reset() {
        lat = 0;
        lng = 0;
        vLat = 0;
        vLng = 0;
        p00 = p11 = p22 = p33 = -1;  // -1 表示未初始化
        lastTimestamp = 0;
        initialized = false;
        lastInputTime = 0;
        stallCount = 0;
    }

    /**
     * 判断滤波器是否已初始化
     */
    public boolean isInitialized() {
        return initialized;
    }

    /**
     * 将 GPS Location 输入滤波器，返回平滑后的经纬度。
     *
     * @param loc   GPS Location 对象
     * @return 新的 Location 对象（已替换经纬度），或 null（如果被过滤）
     */
    public Location filter(Location loc) {
        if (loc == null) return null;

        double newLat = loc.getLatitude();
        double newLng = loc.getLongitude();
        float accuracy = loc.hasAccuracy() ? loc.getAccuracy() : 15f;
        long timestamp = loc.getTime();

        double[] filtered = filter(newLat, newLng, accuracy, timestamp);

        loc.setLatitude(filtered[0]);
        loc.setLongitude(filtered[1]);
        return loc;
    }

    /**
     * 核心滤波方法：给定新的 GPS 观测值，返回平滑后的经纬度。
     *
     * @param newLat    新观测纬度
     * @param newLng    新观测经度
     * @param accuracy  GPS 精度 (m)
     * @param timestamp 时间戳 (ms)
     * @return [filteredLat, filteredLng]
     */
    public double[] filter(double newLat, double newLng, float accuracy, long timestamp) {
        long now = System.currentTimeMillis();

        // ---- 异常检测：GPS 时间跳变或严重断连 → 重置 ----
        if (initialized && lastTimestamp > 0) {
            long dtTimestamp = timestamp - lastTimestamp;
            if (dtTimestamp < 0) {
                // GPS 时间倒流，重置
                Log.w(TAG, "GPS time reversed, resetting filter");
                reset();
            } else if (dtTimestamp > RESET_THRESHOLD_MS) {
                // GPS 断连超过阈值，重置
                Log.w(TAG, "GPS gap > " + RESET_THRESHOLD_MS + "ms, resetting filter");
                reset();
            } else {
                // 检查与上次输出的距离跳变
                double dist = metersBetween(lat, lng, newLat, newLng);
                if (dist > RESET_JUMP_THRESHOLD_METERS) {
                    // 单次跳变过大，可能是 GPS 严重漂移，重置
                    Log.w(TAG, "GPS jump " + dist + "m > threshold, resetting filter");
                    reset();
                }
            }
        }

        // ---- 初始化 ----
        if (!initialized) {
            lat = newLat;
            lng = newLng;
            vLat = 0;
            vLng = 0;
            initCovariance(accuracy);
            lastTimestamp = timestamp;
            lastInputTime = now;
            initialized = true;
            return new double[]{lat, lng};
        }

        // ---- 计算时间差 dt (秒) ----
        double dt = (timestamp - lastTimestamp) / 1000.0;
        if (dt <= 0) dt = 0.1;  // 防止除零
        if (dt > 30) dt = 30;   // 防止过大 dt 导致滤波器发散

        lastTimestamp = timestamp;
        lastInputTime = now;

        // ---- 动态 Q (过程噪声) ----
        // 速度越快，Q 越大 → 滤波器越灵敏，能跟上高速运动
        double speed = Math.sqrt(vLat * vLat + vLng * vLng);
        double processNoise = DEFAULT_PROCESS_NOISE;
        if (speed > STATIONARY_SPEED_MPS) {
            // 移动中：适当增加过程噪声以跟上高速运动
            processNoise = Math.max(DEFAULT_PROCESS_NOISE, speed * 0.3);
        }
        double q = processNoise * processNoise * dt;

        // ---- 预测 (Predict) ----
        // 状态转移: X_k = F * X_{k-1}
        // lat_new = lat + vLat * dt
        // lng_new = lng + vLng * dt
        double predictedLat = lat + vLat * dt;
        double predictedLng = lng + vLng * dt;

        // 协方差预测: P_k = F * P_{k-1} * F^T + Q
        // 简化的 2x2 对角形式（速度分量独立）
        p00 += dt * dt * p22 + q;   // lat 位置方差
        p11 += dt * dt * p33 + q;   // lng 位置方差
        p22 += q / (dt * dt + 0.01); // lat 速度方差（避免除零）
        p33 += q / (dt * dt + 0.01); // lng 速度方差

        // 确保协方差矩阵正定
        p00 = Math.max(p00, 1e-10);
        p11 = Math.max(p11, 1e-10);
        p22 = Math.max(p22, 1e-10);
        p33 = Math.max(p33, 1e-10);

        // ---- 更新 (Update) ----
        // 测量噪声 R 根据 GPS 精度动态调整
        double r = accuracy * accuracy;
        // GPS 精度差时增大 R，精度好时减小 R
        r = Math.max(r, 4.0);  // 最小 4m²，防止精度过高时滤波器过于自信
        r = Math.min(r, 10000.0);  // 最大 10000m²，防止精度极差时滤波器完全失效

        // 卡尔曼增益
        double kLat = p00 / (p00 + r);
        double kLng = p11 / (p11 + r);

        // 更新状态
        double innovationLat = newLat - predictedLat;
        double innovationLng = newLng - predictedLng;

        lat = predictedLat + kLat * innovationLat;
        lng = predictedLng + kLng * innovationLng;

        // 更新速度估计（基于位置变化）
        if (dt > 0.01) {
            double measuredVLat = innovationLat * LAT_DEG_TO_METERS / dt;
            double measuredVLng = innovationLng * LNG_DEG_AT_EQ / dt;
            vLat = vLat * 0.7 + measuredVLat * 0.3;  // 低通滤波平滑速度
            vLng = vLng * 0.7 + measuredVLng * 0.3;
        }

        // 更新协方差
        double kLatComplement = 1 - kLat;
        double kLngComplement = 1 - kLng;
        p00 = kLatComplement * p00;
        p11 = kLngComplement * p11;

        // ---- 静止检测 ----
        speed = Math.sqrt(vLat * vLat + vLng * vLng);
        if (speed < STATIONARY_SPEED_MPS) {
            stallCount++;
            if (stallCount > 3) {
                // 连续静止，降低速度方差，让滤波器更稳定
                p22 *= 0.9;
                p33 *= 0.9;
                if (vLat != 0 || vLng != 0) {
                    vLat *= 0.95;
                    vLng *= 0.95;
                }
            }
        } else {
            stallCount = 0;
        }

        return new double[]{lat, lng};
    }

    /**
     * 获取当前滤波后的速度 (m/s)
     */
    public double getSpeed() {
        return Math.sqrt(vLat * vLat + vLng * vLng);
    }

    /**
     * 获取当前滤波后的经纬度
     */
    public double[] getPosition() {
        return new double[]{lat, lng};
    }

    /**
     * 手动重置滤波器
     */
    public void forceReset() {
        reset();
    }

    private void initCovariance(float accuracy) {
        // 初始协方差：位置方差等于 GPS 精度，速度方差设一个合理初始值
        p00 = accuracy * accuracy;
        p11 = accuracy * accuracy;
        p22 = 1.0;  // 初始速度方差 1 (m/s)²
        p33 = 1.0;
        p01 = p02 = p03 = p10 = p12 = p13 = p20 = p21 = p23 = p30 = p31 = p32 = 0;
    }

    /**
     * 计算两个经纬度点之间的距离 (m)
     */
    private double metersBetween(double lat1, double lng1, double lat2, double lng2) {
        double dLat = (lat2 - lat1) * LAT_DEG_TO_METERS;
        double dLng = (lng2 - lng1) * LNG_DEG_AT_EQ;
        return Math.sqrt(dLat * dLat + dLng * dLng);
    }
}