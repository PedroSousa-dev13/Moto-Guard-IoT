// =============================================================================
// MotoGuard IoT — GPX Dropzone
// =============================================================================
// Drag-and-drop GPX file upload with motorcycle profile selector and stats.
// =============================================================================

import React, { useCallback, useRef, useState, ChangeEvent, DragEvent } from "react";
import { parseGPX } from "./gpxParser";
import type { GpxStats } from "./gpxParser";
import type { ParseResult } from "../real-simulator/csvParser";
import { RefreshCcw, AlertTriangle, CheckCircle2, Map as MapIcon } from "lucide-react";

interface GpxDropzoneProps {
  onParsed: (result: ParseResult, stats: GpxStats, meta: { fileName: string; fileSize: number; rawText: string }) => void;
  profileName?: string;
}

export default function GpxDropzone({ onParsed, profileName = "Naked" }: GpxDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GpxStats | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
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
        const result = parseGPX(text, { motorcycleProfile: profileName });

        if ("type" in result) {
          // ParseError
          setError(result.message);
          setLoading(false);
          return;
        }

        const { gpxStats, ...parseResult } = result;
        setStats(gpxStats);
        onParsed(parseResult, gpxStats, { fileName: file.name, fileSize: file.size, rawText: text });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao processar GPX.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed, profileName]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
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
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-12 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
          dragging 
            ? "bg-accent/10 border-accent shadow-lg shadow-accent/5 scale-[1.01]" 
            : error 
              ? "bg-red/5 border-red/40" 
              : stats 
                ? "bg-green/5 border-green/40" 
                : "bg-panel border-border-glass-subtle hover:bg-panel-hover hover:border-border-glass"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx"
          onChange={handleFileInput}
          className="hidden"
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCcw size={40} className="text-accent animate-spin" />
            <span className="text-sm font-black text-accent uppercase tracking-widest">A processar GPX...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 animate-shake">
            <div className="w-16 h-16 rounded-2xl bg-red/10 flex items-center justify-center text-red">
              <AlertTriangle size={32} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-black text-red uppercase tracking-widest text-center">{error}</span>
              <span className="text-[0.65rem] font-medium text-muted opacity-40 uppercase tracking-widest">Clica ou arrasta para tentar outro ficheiro</span>
            </div>
          </div>
        ) : stats ? (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center text-green">
              <CheckCircle2 size={32} />
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg font-black text-green tracking-tight text-center">{stats.trackName}</span>
              <span className="text-[0.65rem] font-medium text-muted opacity-40 uppercase tracking-widest">{fileName}</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              {[
                { label: "Pontos", value: stats.pointCount.toLocaleString() },
                { label: "Duração", value: formatDuration(stats.durationSec) },
                { label: "Distância", value: `${stats.distanceKm.toFixed(1)} km` },
                { label: "Vel. Média", value: `${stats.avgSpeedKmh.toFixed(0)} km/h` },
                { label: "Vel. Máx", value: `${stats.maxSpeedKmh.toFixed(0)} km/h` },
                { label: "Elevação", value: `${stats.minElevation}–${stats.maxElevation} m` },
                { label: "Subida", value: `+${stats.elevationGain} m` },
                { label: "Descida", value: `-${stats.elevationLoss} m` },
              ].map((s) => (
                <div key={s.label} className="bg-surface/50 border border-border-glass-subtle rounded-xl p-3 flex flex-col gap-0.5 shadow-inner">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">{s.label}</span>
                  <span className="text-xs font-black text-text tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>

            <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">Clica ou arrasta para carregar outro ficheiro</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-muted group-hover:text-accent group-hover:bg-accent/10 transition-all">
              <MapIcon size={32} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-black text-text uppercase tracking-widest">Importar Rota GPX</span>
              <span className="text-[0.65rem] font-medium text-muted opacity-40 uppercase tracking-widest text-center">
                Suporta rotas do Wikiloc, Strava, Komoot e outros.<br/>Arrasta um ficheiro ou clica para selecionar.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
