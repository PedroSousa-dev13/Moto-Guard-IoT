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
from infer import infer, _raw_score_to_ml_score, _build_feedback_label, _get_dominant_features
from features import FeatureExtractor, FEATURE_NAMES


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


# ── Testes de _raw_score_to_ml_score ─────────────────────────────────────────

class TestRawScoreToMlScore:
    def test_score_1_maps_to_100(self):
        assert _raw_score_to_ml_score(1.0) == 100

    def test_score_minus1_maps_to_0(self):
        assert _raw_score_to_ml_score(-1.0) == 0

    def test_score_0_maps_to_50(self):
        assert _raw_score_to_ml_score(0.0) == 50

    def test_output_always_in_range(self):
        for raw in [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]:
            score = _raw_score_to_ml_score(raw)
            assert 0 <= score <= 100, f"Score fora do intervalo para raw={raw}: {score}"


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

    def test_dominant_features_are_valid_names(self, tmp_path):
        artifact = make_artifact()
        model_path = tmp_path / "isolation_forest.pkl"
        save_artifact(artifact, model_path)

        result = infer(make_trip_data(), model_path=model_path)

        for feat in result["dominantFeatures"]:
            assert feat in FEATURE_NAMES, f"Feature desconhecida: {feat}"
