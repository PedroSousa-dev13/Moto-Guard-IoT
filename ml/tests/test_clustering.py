import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from clustering import label_clusters
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from features import FEATURE_NAMES
import numpy as np


class TestLabelClusters:
    def make_clusters(self, n_samples=30):
        rng = np.random.default_rng(42)
        X = np.column_stack([
            rng.uniform(0, 5, n_samples),   # HARD_BRAKING
            rng.uniform(0, 3, n_samples),   # RAPID_ACCELERATION
            rng.uniform(40, 120, n_samples), # avgSpeedKmh
            rng.uniform(60, 200, n_samples), # maxSpeedKmh
        ])
        # Add remaining 20 features as noise
        X = np.column_stack([X, rng.uniform(0, 1, (n_samples, 20))])
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        kmeans.fit(X_scaled)
        return kmeans, scaler

    def test_returns_dict_with_three_labels(self):
        kmeans, scaler = self.make_clusters()
        labels = label_clusters(kmeans, scaler, FEATURE_NAMES)
        assert isinstance(labels, dict)
        assert len(labels) == 3

    def test_labels_are_valid_styles(self):
        kmeans, scaler = self.make_clusters()
        labels = label_clusters(kmeans, scaler, FEATURE_NAMES)
        valid = {"AGGRESSIVE", "DEFENSIVE", "ECONOMY"}
        for label in labels.values():
            assert label in valid, f"Label inválido: {label}"

    def test_all_clusters_have_unique_labels(self):
        kmeans, scaler = self.make_clusters()
        labels = label_clusters(kmeans, scaler, FEATURE_NAMES)
        assert len(set(labels.values())) == 3, "Clusters devem ter labels únicos"

    def test_aggressive_label_assigned(self):
        kmeans, scaler = self.make_clusters()
        labels = label_clusters(kmeans, scaler, FEATURE_NAMES)
        assert "AGGRESSIVE" in labels.values()
