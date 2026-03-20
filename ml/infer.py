"""
infer.py — Script de inferência ML para avaliação de viagens.

Comunicação via stdin/stdout JSON (invocado pelo backend Node.js via child_process.spawn).

Input (stdin):
  { "trip": {...}, "events": [...], "profile": {...} }

Output (stdout):
  { "mlScore": int, "anomalyScore": float, "feedbackLabel": str,
    "dominantFeatures": [str], "modelVersion": str, "inferenceMs": int }

Output de erro (stdout):
  { "error": str, "mlScore": null }
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent))
from features import FeatureExtractor, FEATURE_NAMES

DEFAULT_MODEL_PATH = Path(__file__).parent / "models" / "isolation_forest.pkl"

# ── Mensagens de feedback por feature ────────────────────────────────────────

_FEEDBACK_MESSAGES: dict[str, str] = {
    "count_HARD_BRAKING":       "Número elevado de travagens bruscas",
    "count_EXCESSIVE_LEAN":     "Inclinação acima do padrão normal",
    "count_HIGH_VIBRATION":     "Vibrações anómalas detetadas",
    "count_OVERHEAT":           "Episódios de sobreaquecimento",
    "count_LOW_VOLTAGE":        "Problemas de voltagem detetados",
    "count_CRASH_DETECTED":     "Queda confirmada durante a viagem",
    "count_RAPID_ACCELERATION": "Acelerações bruscas frequentes",
    "count_TIRE_PRESSURE_LOW":  "Pressão de pneus abaixo do normal",
    "count_OIL_PRESSURE_LOW":   "Pressão de óleo baixa",
    "count_SPEEDING":           "Excesso de velocidade registado",
    "count_CRITICAL":           "Múltiplos eventos críticos",
    "count_WARNING":            "Vários avisos durante a viagem",
    "maxSpeedKmh":              "Velocidade máxima elevada",
    "maxRollDeg":               "Inclinação máxima elevada",
    "maxGForce":                "Picos de G-force acima do normal",
    "speed_ratio":              "Velocidade acima do limite do perfil",
    "roll_ratio":               "Inclinação acima do típico para este perfil",
    "gforce_ratio":             "G-force próximo do limiar de queda",
    "events_per_km":            "Alta densidade de eventos por quilómetro",
    "critical_ratio":           "Alta proporção de eventos críticos",
}


def _load_artifact(model_path: Path) -> dict:
    """Carrega o Model_Artifact. Lança exceção descritiva se inválido."""
    if not model_path.exists():
        raise FileNotFoundError(f"Model artifact não encontrado: {model_path}")

    try:
        artifact = joblib.load(model_path)
    except Exception as e:
        raise RuntimeError(f"Falha ao deserializar model artifact ({model_path}): {e}") from e

    # Validar estrutura mínima
    required_keys = {"model", "scaler", "metadata"}
    if not isinstance(artifact, dict) or not required_keys.issubset(artifact.keys()):
        raise ValueError(
            f"Model artifact inválido ou versão incompatível. "
            f"Chaves esperadas: {required_keys}. "
            f"Chaves encontradas: {set(artifact.keys()) if isinstance(artifact, dict) else type(artifact)}"
        )

    return artifact


def _raw_score_to_ml_score(raw_score: float) -> int:
    """
    Converte score do Isolation Forest [-1, 1] → ML_Score [0, 100].
    raw_score próximo de 1 = normal → ML_Score alto
    raw_score próximo de -1 = anómalo → ML_Score baixo
    """
    ml_score = round((raw_score + 1) / 2 * 100)
    return max(0, min(100, ml_score))


def _get_dominant_features(feature_vector: np.ndarray, scaler, top_n: int = 3) -> list[str]:
    """
    Identifica as features com maior desvio do padrão normal (maior z-score absoluto).
    """
    mean = scaler.mean_
    std = scaler.scale_
    z_scores = np.abs((feature_vector - mean) / (std + 1e-9))
    top_indices = np.argsort(z_scores)[::-1][:top_n]
    return [FEATURE_NAMES[i] for i in top_indices]


def _build_feedback_label(dominant_features: list[str], ml_score: int) -> str:
    """Gera uma frase explicativa legível baseada nas features dominantes."""
    if ml_score >= 80:
        base = "Condução dentro dos padrões normais."
    elif ml_score >= 60:
        base = "Condução com alguns desvios do padrão."
    elif ml_score >= 40:
        base = "Condução com padrões anómalos detetados."
    else:
        base = "Condução com padrões altamente anómalos."

    factors = [_FEEDBACK_MESSAGES.get(f) for f in dominant_features if f in _FEEDBACK_MESSAGES]
    factors = [f for f in factors if f]  # remover None

    if factors:
        return base + " " + ". ".join(factors[:2]) + "."
    return base


def infer(trip_data: dict, model_path: Path = DEFAULT_MODEL_PATH) -> dict:
    """
    Executa inferência para uma viagem.

    Retorna dict com mlScore, feedbackLabel, dominantFeatures, modelVersion, inferenceMs.
    Em caso de erro, retorna { error: str, mlScore: null }.
    """
    t0 = time.monotonic()

    try:
        artifact = _load_artifact(model_path)
        model = artifact["model"]
        scaler = artifact["scaler"]
        metadata = artifact["metadata"]

        extractor = FeatureExtractor()
        feature_vector = extractor.extract(trip_data)

        # Verificar NaN/Inf
        if not np.isfinite(feature_vector).all():
            feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=0.0, neginf=0.0)

        X = feature_vector.reshape(1, -1)
        X_scaled = scaler.transform(X)

        # score_samples retorna o anomaly score médio das árvores
        # Valores mais altos = mais normal; mais baixos = mais anómalo
        raw_scores = model.score_samples(X_scaled)
        raw_score = float(raw_scores[0])

        # Normalizar para [0, 100]
        # score_samples está tipicamente em [-0.5, 0.5] para IsolationForest
        # Normalizar para [-1, 1] antes de converter
        normalized = max(-1.0, min(1.0, raw_score * 2))
        ml_score = _raw_score_to_ml_score(normalized)

        dominant_features = _get_dominant_features(feature_vector, scaler)
        feedback_label = _build_feedback_label(dominant_features, ml_score)

        inference_ms = int((time.monotonic() - t0) * 1000)
        print(f"[infer] ML_Score={ml_score} raw={raw_score:.4f} inferenceMs={inference_ms}", file=sys.stderr)

        return {
            "mlScore": ml_score,
            "anomalyScore": round(raw_score, 4),
            "feedbackLabel": feedback_label,
            "dominantFeatures": dominant_features,
            "modelVersion": metadata.get("model_version", "unknown"),
            "inferenceMs": inference_ms,
        }

    except Exception as e:
        inference_ms = int((time.monotonic() - t0) * 1000)
        print(f"[infer] ERRO: {e}", file=sys.stderr)
        return {
            "error": str(e),
            "mlScore": None,
            "inferenceMs": inference_ms,
        }


if __name__ == "__main__":
    # Ler JSON de stdin
    try:
        raw_input = sys.stdin.read()
        trip_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        result = {"error": f"JSON inválido no stdin: {e}", "mlScore": None}
        print(json.dumps(result))
        sys.exit(1)

    import os
    model_path_env = os.environ.get("ML_MODEL_PATH")
    model_path = Path(model_path_env) if model_path_env else DEFAULT_MODEL_PATH

    result = infer(trip_data, model_path=model_path)
    print(json.dumps(result))
