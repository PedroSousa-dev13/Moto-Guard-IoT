// =============================================================================
// MotoGuard IoT — GPX Dropzone
// =============================================================================
// Drag-and-drop GPX file upload with motorcycle profile selector and stats.
// =============================================================================

import { useCallback, useRef, useState } from "react";
import { parseGPX } from "./gpxParser";
import type { GpxStats } from "./gpxParser";
import type { ParseResult } from "../real-simulator/csvParser";

interface GpxDropzoneProps {
  onParsed: (result: ParseResult, stats: GpxStats) => void;
}

const PROFILES = [
  { value: "Naked", label: "🏍️ Naked (6v manual)" },
  { value: "Scooter", label: "🛵 Scooter (CVT)" },
  { value: "Desportiva", label: "🏎️ Desportiva (6v)" },
];

export default function GpxDropzone({ onParsed }: GpxDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GpxStats | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [profile, setProfile] = useState("Naked");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".gpx")) {
        setError("Formato inválido. Seleciona um ficheiro .gpx");
        return;
      }

      setLoading(true);
      setError(null);
      setStats(null);
      setFileName(file.name);

      try {
        const text = await file.text();
        const result = parseGPX(text, { motorcycleProfile: profile });

        if ("type" in result) {
          // ParseError
          setError(result.message);
          setLoading(false);
          return;
        }

        const { gpxStats, ...parseResult } = result;
        setStats(gpxStats);
        onParsed(parseResult, gpxStats);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao processar GPX.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed, profile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Profile selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "rgba(17,24,39,0.6)",
          border: "1px solid #374151",
          borderRadius: 8,
        }}
      >
        <label style={{ fontSize: 13, color: "#9ca3af", whiteSpace: "nowrap" }}>
          Perfil de moto:
        </label>
        <select
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: "#1f2937",
            border: "1px solid #4b5563",
            borderRadius: 6,
            color: "#f9fafb",
            fontSize: 13,
          }}
        >
          {PROFILES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "28px 20px",
          borderRadius: 10,
          border: `2px dashed ${dragging ? "#22d3ee" : error ? "#ef4444" : "#4b5563"}`,
          background: dragging
            ? "rgba(34,211,238,0.06)"
            : error
              ? "rgba(239,68,68,0.04)"
              : "rgba(17,24,39,0.5)",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />

        {loading ? (
          <div style={{ color: "#22d3ee", fontSize: 14 }}>
            ⏳ A processar GPX...
          </div>
        ) : error ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
            <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
              Clica ou arrasta para tentar outro ficheiro
            </div>
          </div>
        ) : stats ? (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <div style={{ color: "#86efac", fontSize: 14, fontWeight: 600 }}>
              {stats.trackName}
            </div>
            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
              {fileName}
            </div>

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: 8,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {[
                { label: "Pontos", value: stats.pointCount.toLocaleString() },
                { label: "Duração", value: formatDuration(stats.durationSec) },
                { label: "Distância", value: `${stats.distanceKm.toFixed(1)} km` },
                { label: "Vel. média", value: `${stats.avgSpeedKmh.toFixed(0)} km/h` },
                { label: "Vel. máx", value: `${stats.maxSpeedKmh.toFixed(0)} km/h` },
                { label: "Elevação", value: `${stats.minElevation}–${stats.maxElevation} m` },
                { label: "Subida", value: `+${stats.elevationGain} m` },
                { label: "Descida", value: `-${stats.elevationLoss} m` },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "6px 4px",
                    background: "rgba(17,24,39,0.6)",
                    borderRadius: 6,
                    border: "1px solid rgba(75,85,99,0.5)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 10 }}>
              Clica ou arrasta para carregar outro ficheiro
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
            <div style={{ color: "#d1d5db", fontSize: 14, fontWeight: 500 }}>
              Arrasta um ficheiro GPX ou clica para selecionar
            </div>
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
              Suporta rotas do Wikiloc, Strava, Komoot e outros
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
