import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from online_detector import detect_anomalies


class TestDetectAnomalies:
    def test_empty_points_returns_no_anomaly(self):
        result = detect_anomalies([])
        assert result["isAnomaly"] is False
        assert result["anomalyScore"] == 0.0

    def test_few_points_returns_no_anomaly(self):
        result = detect_anomalies([{"speedKmh": 50}])
        assert result["isAnomaly"] is False

    def test_normal_driving_no_anomaly(self):
        points = [
            {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
            {"speedKmh": 53, "rpm": 3200, "rollDeg": 6, "gForce": 1.1},
            {"speedKmh": 55, "rpm": 3300, "rollDeg": 5, "gForce": 1.0},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is False

    def test_sudden_speed_change_detected(self):
        points = [
            {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
            {"speedKmh": 75, "rpm": 6000, "rollDeg": 5, "gForce": 1.5},
            {"speedKmh": 76, "rpm": 6100, "rollDeg": 6, "gForce": 1.4},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is True
        assert result["reason"] == "Variação brusca de velocidade"

    def test_sudden_roll_change_detected(self):
        points = [
            {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
            {"speedKmh": 52, "rpm": 3100, "rollDeg": 40, "gForce": 1.5},
            {"speedKmh": 53, "rpm": 3200, "rollDeg": 42, "gForce": 1.4},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is True
        assert "inclinação" in result["reason"].lower()

    def test_excessive_g_force_detected(self):
        points = [
            {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
            {"speedKmh": 52, "rpm": 3100, "rollDeg": 6, "gForce": 4.0},
            {"speedKmh": 53, "rpm": 3200, "rollDeg": 6, "gForce": 3.8},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is True
        assert "G-Force" in result["reason"]

    def test_high_rpm_at_standstill_detected(self):
        points = [
            {"speedKmh": 0, "rpm": 5500, "rollDeg": 0, "gForce": 0.5},
            {"speedKmh": 0, "rpm": 6000, "rollDeg": 0, "gForce": 0.5},
            {"speedKmh": 0, "rpm": 6200, "rollDeg": 0, "gForce": 0.5},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is True
        assert "RPM" in result["reason"]

    def test_normal_rpm_at_standstill_no_anomaly(self):
        points = [
            {"speedKmh": 0, "rpm": 1200, "rollDeg": 0, "gForce": 0.5},
            {"speedKmh": 0, "rpm": 1300, "rollDeg": 0, "gForce": 0.5},
            {"speedKmh": 0, "rpm": 1250, "rollDeg": 0, "gForce": 0.5},
        ]
        result = detect_anomalies(points)
        assert result["isAnomaly"] is False

    def test_anomaly_score_is_always_float(self):
        points = [
            {"speedKmh": 50, "rpm": 3000, "rollDeg": 5, "gForce": 1.0},
            {"speedKmh": 52, "rpm": 3100, "rollDeg": 6, "gForce": 1.1},
            {"speedKmh": 54, "rpm": 3200, "rollDeg": 5, "gForce": 1.0},
        ]
        result = detect_anomalies(points)
        assert isinstance(result["anomalyScore"], float)
