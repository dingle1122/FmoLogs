package com.fmologs.app;

import android.location.Location;
import android.util.Log;

/**
 * 高级卡尔曼滤波器 (CA模型 - Constant Acceleration)
 * 深度整合 GPS 原生速度与位置数据。
 * 
 * 改进点：
 * 1. 初始化阶段：利用 GPS 速度和航向初始化状态向量，避免初次定位速度为 0。
 * 2. 观测扩展：将 GPS 原生速度 (vx, vy) 引入 update 阶段，不再纯依赖位置差分。
 * 3. 动态 R 矩阵：使用 getSpeedAccuracyMetersPerSecond 动态决定速度权重。
 * 4. 坐标系修正：航向角 (Bearing) 与经纬度偏移方向的三角函数映射。
 */
public class AdvancedKalmanFilter {
    private static final String TAG = "AdvancedKF";

    // 状态向量: [x, y, vx, vy, ax, ay]^T
    private double[] X = new double[6];
    // 协方差矩阵
    private double[][] P = new double[6][6];

    private long lastTimestamp = 0;
    private double originLat = 0;
    private double originLng = 0;
    private boolean isInitialized = false;

    // 参数配置
    private static final double MAX_JUMP_DISTANCE = 50.0; // 米
    private static final double DEFAULT_SPEED_ACCURACY = 1.5; // m/s 默认速度标准差

    public AdvancedKalmanFilter() {
        reset();
    }

    public void reset() {
        X = new double[6];
        P = new double[6][6];
        for (int i = 0; i < 6; i++) {
            P[i][i] = 1.0; 
        }
        P[0][0] = 5.0; // 初始位置不确定性
        P[1][1] = 5.0;
        P[2][2] = 2.0; // 初始速度不确定性
        P[3][3] = 2.0;
        isInitialized = false;
        lastTimestamp = 0;
    }

    /**
     * 输入原始 Location，返回平滑后的 [lat, lng]
     */
    public double[] process(Location location) {
        if (location == null) return null;

        long currentTimestamp = location.getTime();
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        double accuracy = location.getAccuracy();

        if (!isInitialized) {
            init(location);
            return new double[]{lat, lng};
        }

        double dt = (currentTimestamp - lastTimestamp) / 1000.0;
        
        // 处理时间断点
        if (dt <= 0) return new double[]{lat, lng};
        if (dt > 15.0) { 
            init(location);
            return new double[]{lat, lng};
        }

        // 1. 坐标转换: 将当前经纬度转换为相对于 origin 的偏移 (x, y) 单位：米
        float[] results = new float[1];
        Location.distanceBetween(originLat, originLng, lat, originLng, results);
        double y = results[0] * (lat < originLat ? -1 : 1);
        Location.distanceBetween(lat, originLng, lat, lng, results);
        double x = results[0] * (lng < originLng ? -1 : 1);

        // 提取 GPS 原生速度向量
        double vX = 0, vY = 0;
        boolean hasGpsSpeed = location.hasSpeed() && location.hasBearing();
        if (hasGpsSpeed) {
            double speed = location.getSpeed();
            double bearingRad = Math.toRadians(location.getBearing()); // Bearing 为 0 是北
            vX = speed * Math.sin(bearingRad); // 对应经度方向 (X)
            vY = speed * Math.cos(bearingRad); // 对应纬度方向 (Y)
        }

        // 2. 预测阶段 (Predict)
        predict(dt, location.getSpeed());

        // 3. 异常点检测 (Outlier Rejection)
        double predictedDist = Math.sqrt(Math.pow(X[0] - x, 2) + Math.pow(X[1] - y, 2));
        boolean isJump = (predictedDist > MAX_JUMP_DISTANCE && accuracy > 15.0);

        // 4. 更新阶段 (Update) - 同时输入位置和原生速度进行校正
        if (!isJump) {
            update(x, y, vX, vY, accuracy, location);
        } else {
            Log.d(TAG, "Jump detected: " + predictedDist + "m. Dead reckoning used.");
        }

        lastTimestamp = currentTimestamp;

        // 5. 坐标逆转换: (x, y) -> (lat, lng)
        return metersToLatLng(X[0], X[1]);
    }

    private void init(Location loc) {
        originLat = loc.getLatitude();
        originLng = loc.getLongitude();
        X = new double[6];
        if (loc.hasSpeed() && loc.hasBearing()) {
            double s = loc.getSpeed();
            double b = Math.toRadians(loc.getBearing());
            X[2] = s * Math.sin(b);
            X[3] = s * Math.cos(b);
        }
        lastTimestamp = loc.getTime();
        isInitialized = true;
    }

    /**
     * 状态预测: 使用 CA 模型
     */
    private void predict(double dt, double currentSpeed) {
        double dt2 = dt * dt;
        double dt3 = dt2 * dt;

        // X = F * X
        X[0] = X[0] + X[2] * dt + 0.5 * X[4] * dt2;
        X[1] = X[1] + X[3] * dt + 0.5 * X[5] * dt2;
        X[2] = X[2] + X[4] * dt;
        X[3] = X[3] + X[5] * dt;
        // ax, ay 保持恒定预测

        // 自适应过程噪声 Q
        double accelNoiseVariance = (currentSpeed < 0.5) ? 0.01 : 0.6; 
        
        P[0][0] += 0.5 * dt3 * accelNoiseVariance; // x
        P[1][1] += 0.5 * dt3 * accelNoiseVariance; // y
        P[2][2] += dt2 * accelNoiseVariance;       // vx
        P[3][3] += dt2 * accelNoiseVariance;       // vy
        P[4][4] += dt * accelNoiseVariance;        // ax
        P[5][5] += dt * accelNoiseVariance;        // ay
    }

    /**
     * 测量更新: 整合位置和原生速度
     */
    private void update(double zx, double zy, double zvx, double zvy, double accuracy, Location loc) {
        // 测量噪声 R
        double R_pos = Math.max(accuracy, 3.0);
        double R_vel = loc.hasSpeedAccuracy() ? loc.getSpeedAccuracyMetersPerSecond() : DEFAULT_SPEED_ACCURACY;

        // 将 [x, y, vx, vy] 作为观测输入
        double[] z = {zx, zy, zvx, zvy};
        double[] r = {R_pos, R_pos, R_vel, R_vel};

        for (int i = 0; i < 4; i++) {
            // 如果 GPS 没有速度数据，跳过对 vx, vy 的更新
            if (i >= 2 && !loc.hasSpeed()) continue;

            double innovation = z[i] - X[i];
            double s = P[i][i] + r[i];
            double k = P[i][i] / s;

            X[i] += k * innovation;
            P[i][i] *= (1.0 - k);
            
            // 联动更新更高阶状态（简化关联）
            if (i < 2) { 
                X[i + 2] += (k / 2.0) * innovation; // 位置更新影响速度
            } else {
                X[i + 2] += (k / 2.0) * innovation; // 速度更新影响加速度
            }
        }
    }

    private double[] metersToLatLng(double mx, double my) {
        double resLat = originLat + (my / 111319.9);
        double resLng = originLng + (mx / (111319.9 * Math.cos(Math.toRadians(originLat))));
        return new double[]{resLat, resLng};
    }
}
