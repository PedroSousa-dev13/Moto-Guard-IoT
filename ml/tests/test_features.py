"""
Testes unitários para ml/features.py — FeatureExtractor.
"""

import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from features import FeatureExtractor, FEATURE_NAMES


def make_trip(
    maxSpeedKmh=80.0,
    maxRollDeg=20.0,
    maxGForce=1.0,
    distanceKm=10.0,
    avgSpeedKmh=60.0,
    startedAt="2026-01-01T10:00:00Z",
    endedAt="2026-01-01T10:30:00Z",
):
    return {
        "maxSpeedKmh": maxSpeedKmh,
        "maxRollDeg": maxRollDeg,
        "maxGForce": maxGForce,
        "distanceKm": distanceKm,
        "avgSpeedKmh": avgSpeedKmh,
        "startedAt": startedAt,
        "endedAt": endedAt,
    }


def make_profile(maxSpeedKmh=120.0, typicalMaxRollDeg=40.0, crashRollThreshold=65.0, crashGForce=3.0):
    return {
        "maxSpeedKmh": maxSpeedKmh,
        "typicalMaxRollDeg": typicalMaxRollDeg,
        "crashRollThreshold": crashRollThreshold,
        "crashGForce": crashGForce,
    }


extractor = FeatureExtractor()


class TestFeatureNames:
    def test_feature_names_count(self):
        assert len(FEATURE_NAMES) == 24

    def test_feature_names_unique(self):
        assert len(FEATURE_NAMES) == len(set(FEATURE_NAMES))


class TestExtractDimension:
    def test_output_shape_is_24(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        assert vec.shape == (24,)

    def test_output_dtype_float64(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        assert vec.dtype == np.float64

    def test_no_nan_or_inf(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        assert np.isfinite(vec).all()


class TestEmptyEvents:
    def test_event_type_counts_are_zero(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        # Primeiras 10 features = contagem por tipo de evento
        assert vec[:10].sum() == 0.0

    def test_severity_counts_are_zero(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        # Features 10, 11, 12 = INFO, WARNING, CRITICAL
        assert vec[10] == 0.0
        assert vec[11] == 0.0
        assert vec[12] == 0.0

    def test_events_per_km_is_zero_when_no_events(self):
        data = {"trip": make_trip(distanceKm=10.0), "events": [], "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("events_per_km")
        assert vec[idx] == 0.0

    def test_critical_ratio_is_zero_when_no_events(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("critical_ratio")
        assert vec[idx] == 0.0


class TestZeroDistance:
    def test_events_per_km_is_zero_when_distance_zero(self):
        events = [{"type": "HARD_BRAKING", "severity": "WARNING"}]
        data = {"trip": make_trip(distanceKm=0.0), "events": events, "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("events_per_km")
        assert vec[idx] == 0.0


class TestEventCounting:
    def test_hard_braking_count(self):
        events = [
            {"type": "HARD_BRAKING", "severity": "WARNING"},
            {"type": "HARD_BRAKING", "severity": "CRITICAL"},
        ]
        data = {"trip": make_trip(), "events": events, "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("count_HARD_BRAKING")
        assert vec[idx] == 2.0

    def test_critical_ratio_correct(self):
        events = [
            {"type": "HARD_BRAKING", "severity": "CRITICAL"},
            {"type": "SPEEDING", "severity": "WARNING"},
            {"type": "OVERHEAT", "severity": "INFO"},
            {"type": "CRASH_DETECTED", "severity": "CRITICAL"},
        ]
        data = {"trip": make_trip(), "events": events, "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("critical_ratio")
        assert abs(vec[idx] - 0.5) < 1e-9  # 2 CRITICAL / 4 total

    def test_events_per_km_correct(self):
        events = [{"type": "SPEEDING", "severity": "WARNING"}] * 5
        data = {"trip": make_trip(distanceKm=10.0), "events": events, "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("events_per_km")
        assert abs(vec[idx] - 0.5) < 1e-9  # 5 / 10


class TestProfileRatios:
    def test_ratios_zero_without_profile(self):
        data = {"trip": make_trip(), "events": [], "profile": None}
        vec = extractor.extract(data)
        assert vec[FEATURE_NAMES.index("speed_ratio")] == 0.0
        assert vec[FEATURE_NAMES.index("roll_ratio")] == 0.0
        assert vec[FEATURE_NAMES.index("gforce_ratio")] == 0.0

    def test_speed_ratio_correct(self):
        data = {"trip": make_trip(maxSpeedKmh=60.0), "events": [], "profile": make_profile(maxSpeedKmh=120.0)}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("speed_ratio")
        assert abs(vec[idx] - 0.5) < 1e-9

    def test_roll_ratio_correct(self):
        data = {"trip": make_trip(maxRollDeg=20.0), "events": [], "profile": make_profile(typicalMaxRollDeg=40.0)}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("roll_ratio")
        assert abs(vec[idx] - 0.5) < 1e-9

    def test_gforce_ratio_correct(self):
        data = {"trip": make_trip(maxGForce=1.5), "events": [], "profile": make_profile(crashGForce=3.0)}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("gforce_ratio")
        assert abs(vec[idx] - 0.5) < 1e-9


class TestDuration:
    def test_duration_30_minutes(self):
        data = {
            "trip": make_trip(startedAt="2026-01-01T10:00:00Z", endedAt="2026-01-01T10:30:00Z"),
            "events": [],
            "profile": None,
        }
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("durationSeconds")
        assert vec[idx] == 1800.0

    def test_duration_zero_when_no_dates(self):
        data = {"trip": {"maxSpeedKmh": 80.0}, "events": [], "profile": None}
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("durationSeconds")
        assert vec[idx] == 0.0

    def test_duration_zero_when_same_timestamps(self):
        data = {
            "trip": make_trip(startedAt="2026-01-01T10:00:00Z", endedAt="2026-01-01T10:00:00Z"),
            "events": [],
            "profile": None,
        }
        vec = extractor.extract(data)
        idx = FEATURE_NAMES.index("durationSeconds")
        assert vec[idx] == 0.0


class TestExtractBatch:
    def test_batch_shape(self):
        trips = [
            {"trip": make_trip(), "events": [], "profile": None},
            {"trip": make_trip(maxSpeedKmh=120.0), "events": [], "profile": None},
            {"trip": make_trip(distanceKm=50.0), "events": [], "profile": None},
        ]
        result = extractor.extract_batch(trips)
        assert result.shape == (3, 24)
