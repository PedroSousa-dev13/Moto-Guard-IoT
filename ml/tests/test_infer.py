"""
Testes unitários para ml/infer.py — função infer().
"""

import json
import sys
import tempfile
from pathlib import Path

import joblib
import numpy as np
import pytest
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).parent.parent))
from infer import infer, _sigmoid_score_to_ml, _build_feedback_label, _get_dominant_features
from features import FeatureExtractor, FEATURE_NAMES
from features_gpx import GpxFeatureExtractor, FEATURE_NAMES_GPX


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_artifact(n_samples: int = 50) -> dict:
    """Cria um Model_Artifact mínimo com dados sintéticos."""
    extractor = FeatureExtractor()
    rng = np.random.default_rng(42)

    trips = []
    for _ in range(n_samples):
        trips.append({
            "trip": {
                "maxSpeedKmh": float(rng.uniform(40, 120)),
                "maxRollDeg": float(rng.uniform(5, 35)),
                "maxGForce": float(rng.uniform(0.3, 2.0)),
                "distanceKm": float(rng.uniform(5, 80)),
                "avgSpeedKmh": float(rng.uniform(30, 90)),
                "startedAt": "2026-01-01T10:00:00Z",
                "endedAt": "2026-01-01T11:00:00Z",
            },
            "events": [],
            "profile": None,
        })

    X = extractor.extract_batch(trips)
    scaler = StandardScaler().fit(X)
    model = IsolationForest(n_estimators=10, random_state=42).fit(scaler.transform(X))

    return {
        "model": model,
        "scaler": scaler,
        "metadata": {
            "model_version": "test-v1",
            "trained_at": "2026-01-01T00:00:00Z",
            "n_samples": n_samples,
        },
    }


def save_artifact(artifact: dict, path: Path) -> None:
    joblib.dump(artifact, path)


def make_trip_data(
    maxSpeedKmh=80.0,
    maxRollDeg=20.0,
    maxGForce=1.0,
    distanceKm=10.0,
    avgSpeedKmh=60.0,
    events=None,
):
    return {
        "trip": {
            "maxSpeedKmh": maxSpeedKmh,
            "maxRollDeg": maxRollDeg,
            "maxGForce": maxGForce,
            "distanceKm": distanceKm,
            "avgSpeedKmh": avgSpeedKmh,
            "startedAt": "2026-01-01T10:00:00Z",
            "endedAt": "2026-01-01T10:30:00Z",
        },
        "events": events or [],
        "profile": None,
    }


# ── Testes de _sigmoid_score_to_ml ──────────────────────────────────────────

class TestSigmoidScoreToMl:
    def test_high_raw_score_high_ml(self):
        score = _sigmoid_score_to_ml(0.0, midpoint=-0.30, k=15)
        assert score > 95

    def test_low_raw_score_low_ml(self):
        score = _sigmoid_score_to_ml(-0.60, midpoint=-0.30, k=15)
        assert score < 10

    def test_output_always_in_range(self):
        for raw in [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]:
            score = _sigmoid_score_to_ml(raw)
            assert 0 <= score <= 100, f"Score fora do intervalo para raw={raw}: {score}"

    def test_default_params_match_telemetry(self):
        score = _sigmoid_score_to_ml(-0.30, midpoint=-0.30, k=15)
        assert score == 50  # midpoint = -0.30 → sigmoid 0.5 → 50


# ── Testes de _build_feedback_label ──────────────────────────────────────────

class TestBuildFeedbackLabel:
    def test_high_score_returns_normal_message(self):
        label = _build_feedback_label([], 85)
        assert "normais" in label.lower()

    def test_low_score_returns_anomalous_message(self):
        label = _build_feedback_label([], 30)
        assert "anómalos" in label.lower()

    def test_dominant_features_included_in_label(self):
        label = _build_feedback_label(["count_HARD_BRAKING"], 50)
        assert "travagens" in label.lower()

    def test_unknown_feature_does_not_crash(self):
        label = _build_feedback_label(["unknown_feature_xyz"], 70)
        assert isinstance(label, str)


# ── Testes de infer() ─────────────────────────────────────────────────────────

class TestInfer:
    def test_ml_score_in_range(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        assert "error" not in result or result.get("error") is None
        assert 0 <= result["mlScore"] <= 100

    def test_result_has_required_keys(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        for key in ("mlScore", "anomalyScore", "feedbackLabel", "dominantFeatures", "modelVersion", "inferenceMs"):
            assert key in result, f"Chave '{key}' em falta no resultado"

    def test_model_version_matches_artifact(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        assert result["modelVersion"] == "test-v1"

    def test_roundtrip_same_score(self, tmp_path):
        """Serializar e deserializar o artifact deve produzir o mesmo score."""
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        trip = make_trip_data()
        result1 = infer(trip, model_path=model_path)
        result2 = infer(trip, model_path=model_path)

        assert result1["mlScore"] == result2["mlScore"]

    def test_missing_model_returns_error(self, tmp_path):
        model_path = tmp_path / "nonexistent.pkl"
        result = infer(make_trip_data(), model_path=model_path)

        assert "error" in result
        assert result["mlScore"] is None

    def test_corrupted_model_returns_error(self, tmp_path):
        model_path = tmp_path / "corrupted.pkl"
        model_path.write_bytes(b"isto nao e um pickle valido")

        result = infer(make_trip_data(), model_path=model_path)

        assert "error" in result
        assert result["mlScore"] is None

    def test_invalid_artifact_structure_returns_error(self, tmp_path):
        """Artifact sem chaves obrigatórias deve retornar erro descritivo."""
        model_path = tmp_path / "bad_artifact.pkl"
        joblib.dump({"wrong_key": "value"}, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        assert "error" in result
        assert result["mlScore"] is None

    def test_inference_ms_is_non_negative(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        assert result["inferenceMs"] >= 0

    def test_anomaly_score_is_normalized_to_0_1_range(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        assert 0.0 <= result["anomalyScore"] <= 1.0

    def test_dominant_features_are_valid_names(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        for feat in result["dominantFeatures"]:
            assert feat in FEATURE_NAMES, f"Feature desconhecida: {feat}"


# ── Testes de inferência GPX ─────────────────────────────────────────────────

def make_gpx_artifact(n_samples: int = 50) -> dict:
    """Cria um Model_Artifact GPX mínimo com dados sintéticos."""
    extractor = GpxFeatureExtractor()
    rng = np.random.default_rng(42)

    trips = []
    for _ in range(n_samples):
        waypoints = []
        t = 0.0
        for i in range(20):
            waypoints.append({
                "lat": 38.7 + rng.uniform(-0.01, 0.01),
                "lon": -9.1 + rng.uniform(-0.01, 0.01),
                "ele": float(rng.uniform(50, 200)),
                "time": f"2026-01-01T10:00:{int(t):02d}Z",
                "speedKmh": float(rng.uniform(40, 100)),
            })
            t += 5.0
        trips.append({
            "trip": {
                "maxSpeedKmh": float(rng.uniform(60, 120)),
                "avgSpeedKmh": float(rng.uniform(40, 80)),
                "distanceKm": float(rng.uniform(10, 60)),
                "startedAt": "2026-01-01T10:00:00Z",
                "endedAt": "2026-01-01T11:00:00Z",
            },
            "gpx_waypoints": waypoints,
        })

    X = extractor.extract_batch(trips)
    scaler = StandardScaler().fit(X)
    model = IsolationForest(n_estimators=10, random_state=42).fit(scaler.transform(X))

    return {
        "model": model,
        "scaler": scaler,
        "metadata": {
            "model_version": "gpx-test-v1",
            "trained_at": "2026-01-01T00:00:00Z",
            "n_samples": n_samples,
            "model_type": "gpx",
            "sigmoid_midpoint": -0.30,
            "sigmoid_k": 15,
        },
    }


def make_gpx_trip_data(
    maxSpeedKmh=80.0,
    avgSpeedKmh=60.0,
    distanceKm=20.0,
):
    rng = np.random.default_rng(42)
    waypoints = []
    t = 0.0
    for i in range(20):
        waypoints.append({
            "lat": 38.7 + rng.uniform(-0.005, 0.005),
            "lon": -9.1 + rng.uniform(-0.005, 0.005),
            "ele": float(rng.uniform(50, 150)),
            "time": f"2026-01-01T10:00:{int(t):02d}Z",
            "speedKmh": float(rng.uniform(40, 80)),
        })
        t += 5.0
    return {
        "trip": {
            "id": "gpx-trip-test",
            "source": "GPX_IMPORTED",
            "maxSpeedKmh": maxSpeedKmh,
            "avgSpeedKmh": avgSpeedKmh,
            "distanceKm": distanceKm,
            "startedAt": "2026-01-01T10:00:00Z",
            "endedAt": "2026-01-01T10:30:00Z",
        },
        "gpx_waypoints": waypoints,
    }


class TestGpxInfer:
    def test_gpx_ml_score_in_range(self, tmp_path):
        artifact = make_gpx_artifact()
        model_path = tmp_path / "gpx_model.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_gpx_trip_data(), model_path=model_path)

        assert "error" not in result or result.get("error") is None
        assert 0 <= result["mlScore"] <= 100

    def test_gpx_uses_model_type_gpx(self, tmp_path):
        artifact = make_gpx_artifact()
        model_path = tmp_path / "gpx_model.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_gpx_trip_data(), model_path=model_path)

        assert result["modelType"] == "GPX"

    def test_gpx_model_version_matches_artifact(self, tmp_path):
        artifact = make_gpx_artifact()
        model_path = tmp_path / "gpx_model.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_gpx_trip_data(), model_path=model_path)

        assert result["modelVersion"] == "gpx-test-v1"

    def test_gpx_return_has_required_keys(self, tmp_path):
        artifact = make_gpx_artifact()
        model_path = tmp_path / "gpx_model.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_gpx_trip_data(), model_path=model_path)

        for key in ("mlScore", "anomalyScore", "feedbackLabel", "dominantFeatures", "modelVersion", "inferenceMs"):
            assert key in result, f"Chave '{key}' em falta no resultado GPX"

    def test_gpx_dominant_features_are_valid_names(self, tmp_path):
        artifact = make_gpx_artifact()
        model_path = tmp_path / "gpx_model.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_gpx_trip_data(), model_path=model_path)

        for feat in result["dominantFeatures"]:
            assert feat in FEATURE_NAMES_GPX, f"Feature GPX desconhecida: {feat}"

    def test_gpx_missing_model_returns_error(self, tmp_path):
        gpx_path = tmp_path / "nonexistent.pkl"
        result = infer({"trip": {"source": "GPX_IMPORTED"}}, model_path=gpx_path)

        assert "error" in result
        assert "GPX" in result["error"]
        assert result["mlScore"] is None
