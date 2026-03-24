"""
infer.py — Script de inferência ML para avaliação de viagens.

Comunicação via stdin/stdout JSON (invocado pelo backend Node.js via child_process.spawn).

Input (stdin):
  { "trip": {...}, "events": [...], "profile": {...}, "source": str }

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
from features_gpx import GpxFeatureExtractor, FEATURE_NAMES_GPX

DEFAULT_MODEL_PATH = Path(__file__).parent / "models" / "isolation_forest.pkl"
GPX_MODEL_PATH = Path(__file__).parent / "models" / "gpx_model.pkl"

# ── Mensagens de feedback por feature ────────────────────────────────────────

_FEEDBACK_MESSAGES: dict[str, str] = {
    # Features de telemetria (modelo principal)
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
    # Features GPX (modelo GPX)
    "speed_variance":           "Variação de velocidade inconsistente",
    "acceleration_events":      "Múltiplas mudanças bruscas de velocidade",
    "stop_count":               "Número elevado de paragens",
    "maxElevation":             "Altitude máxima elevada",
    "elevation_gain":           "Ganho de altitude significativo",
    "elevation_loss":           "Perda de altitude significativa",
    "distanceKm":               "Distância percorrida anómala",
    "durationSeconds":          "Duração da viagem anómala",
    "avgSpeedKmh":              "Velocidade média anómala",
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


def _get_dominant_features(feature_vector: np.ndarray, scaler, feature_names: list[str], top_n: int = 3) -> list[str]:
    """
    Identifica as features com maior desvio do padrão normal (maior z-score absoluto).
    """
    mean = scaler.mean_
    std = scaler.scale_
    z_scores = np.abs((feature_vector - mean) / (std + 1e-9))
    top_indices = np.argsort(z_scores)[::-1][:top_n]
    return [feature_names[i] for i in top_indices]


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
    Deteta automaticamente se é viagem GPX ou telemetria e usa o modelo apropriado.

    Retorna dict com mlScore, feedbackLabel, dominantFeatures, modelVersion, inferenceMs.
    Em caso de erro, retorna { error: str, mlScore: null }.
    """
    t0 = time.monotonic()

    try:
        # Detetar tipo de viagem (GPX vs Telemetria)
        trip_source = trip_data.get("trip", {}).get("source") or trip_data.get("source", "")
        is_gpx = trip_source == "GPX_IMPORTED"
        
        # Selecionar modelo e extrator apropriados
        if is_gpx:
            # Usar modelo GPX
            if not GPX_MODEL_PATH.exists():
                return {
                    "error": "Modelo GPX não disponível. Execute train_gpx.py primeiro.",
                    "mlScore": None,
                    "inferenceMs": int((time.monotonic() - t0) * 1000),
                }
            model_path = GPX_MODEL_PATH
            extractor = GpxFeatureExtractor()
            feature_names = FEATURE_NAMES_GPX
            print(f"[infer] Usando modelo GPX: {model_path}", file=sys.stderr)
        else:
            # Usar modelo de telemetria
            extractor = FeatureExtractor()
            feature_names = FEATURE_NAMES
            print(f"[infer] Usando modelo telemetria: {model_path}", file=sys.stderr)
        
        artifact = _load_artifact(model_path)
        model = artifact["model"]
        scaler = artifact["scaler"]
        metadata = artifact["metadata"]

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
        # O range de score_samples varia por modelo e dataset
        # Usar sigmoid para mapear suavemente raw_score → [0, 100]
        # raw_score típico: [-0.6, -0.05] onde mais negativo = mais anómalo
        import math
        k = 15  # steepness (menor = mais suave)
        midpoint = -0.30  # ponto médio ajustado para GPX
        sigmoid = 1 / (1 + math.exp(-k * (raw_score - midpoint)))
        ml_score = round(sigmoid * 100)
        ml_score = max(0, min(100, ml_score))

        dominant_features = _get_dominant_features(feature_vector, scaler, feature_names)
        feedback_label = _build_feedback_label(dominant_features, ml_score)

        inference_ms = int((time.monotonic() - t0) * 1000)
        model_type = "GPX" if is_gpx else "Telemetria"
        print(f"[infer] {model_type} ML_Score={ml_score} raw={raw_score:.4f} inferenceMs={inference_ms}", file=sys.stderr)

        return {
            "mlScore": ml_score,
            "anomalyScore": round(raw_score, 4),
            "feedbackLabel": feedback_label,
            "dominantFeatures": dominant_features,
            "modelVersion": metadata.get("model_version", "unknown"),
            "modelType": model_type,
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
