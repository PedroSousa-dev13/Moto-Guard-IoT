import { useCallback, useEffect, useMemo, useRef, useState, memo, startTransition } from "react";
import { Link, useParams } from "react-router-dom";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { gpxAPI, tripsAPI } from "../services/api";
import type { Trip, TripTelemetryResponse, TripEvent, TripEvaluationResponse } from "../types/index";
import { deriveGpxSeries } from "../utils/gpx";
import { PlaybackSlider } from "../components/PlaybackSlider";
import { PlaybackControls } from "../components/PlaybackControls";
import { LazyChart } from "../components/LazyChart";
import TripCategoryBadge from "../components/trips/TripCategoryBadge";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventColor(severity: TripEvent["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return "#ef4444";
    case "WARNING":
      return "#eab308";
    default:
      return "#71717a";
  }
}

// Downsample array to max N points using Largest-Triangle-Three-Buckets (simplified)
// Keeps the shape of the curve while drastically reducing point count
function downsample<T extends { t: number }>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: T[] = [data[0]];
  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    result.push(data[idx]);
  }
  result.push(data[data.length - 1]);
  return result;
}

const MAX_CHART_POINTS = 1000;

export default function TripDetail() {
  const { id } = useParams();
  const tripId = id as string | undefined;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [telemetryRes, setTelemetryRes] = useState<TripTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingGpx, setExportingGpx] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<import("../types/index").TripEvaluationResponse | null>(null);
  const [timeIndex, setTimeIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isPreloading, setIsPreloading] = useState<boolean>(false);

  // Ref to track current index without triggering re-renders on every tick
  const timeIndexRef = useRef<number>(0);
  const lastRenderRef = useRef<number>(0);
  const lastPanRef = useRef<number>(0);
  // Refs to data arrays so the animation loop doesn't need closure over large arrays
  const gpxSeriesRef = useRef<ReturnType<typeof deriveGpxSeries>>([]);
  const telemetryDataRef = useRef<TripTelemetryResponse["data"] | null>(null);
  const tripSourceRef = useRef<string | undefined>(undefined);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const tId = tripId;
    if (!tId) return;
    let cancelled = false;

    async function load(id: string) {
      try {
        setIsLoading(true);
        setError(null);

        const tripRes = await tripsAPI.getById(id);
        if (cancelled) return;
        setTrip(tripRes.data);

        if (tripRes.data.source !== "GPX_IMPORTED") {
          const telem = await tripsAPI.getTelemetry(id);
          if (cancelled) return;
          setTelemetryRes(telem.data);
          telemetryDataRef.current = telem.data.data;
          tripSourceRef.current = tripRes.data.source;
        } else {
          setTelemetryRes(null);
          telemetryDataRef.current = null;
        }

        // Carregar avaliação ML (não bloqueia o carregamento principal)
        if (tripRes.data.status === "COMPLETED") {
          tripsAPI.getEvaluation(id)
            .then((r) => { if (!cancelled) setEvaluation(r.data); })
            .catch(() => { /* fallback silencioso */ });
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error ?? "Não foi possível carregar a viagem.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load(tId);
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const routePoints = useMemo<L.LatLngTuple[]>(() => {
    if (trip?.gpxData?.waypoints?.length) {
      return trip.gpxData.waypoints.map((p) => [p.lat, p.lon]);
    }
    const points = telemetryRes?.data ?? [];
    const out: L.LatLngTuple[] = [];
    for (const p of points) {
      if (typeof p.latitude === "number" && typeof p.longitude === "number") {
        out.push([p.latitude, p.longitude]);
      }
    }
    return out;
  }, [telemetryRes, trip?.gpxData?.waypoints]);

  const chartSeries = useMemo(() => {
    const points = telemetryRes?.data ?? [];
    const full = points
      .map((p) => ({
        t: new Date(p.time).getTime(),
        time: p.time,
        speed: typeof p.speed_kmh === "number" ? p.speed_kmh : null,
        rpm: typeof p.rpm === "number" ? p.rpm : null,
        temp: typeof p.engine_temp_c === "number" ? p.engine_temp_c : null,
        roll: typeof p.roll_deg === "number" ? p.roll_deg : null,
        oil: typeof p.oil_pressure_bar === "number" ? p.oil_pressure_bar : null,
        tireF: typeof p.tire_pressure_front_bar === "number" ? p.tire_pressure_front_bar : null,
        tireR: typeof p.tire_pressure_rear_bar === "number" ? p.tire_pressure_rear_bar : null,
      }))
      .filter((p) => Number.isFinite(p.t));
    if (full.length > MAX_CHART_POINTS) {
      console.log(`[CHART] Telemetria: ${full.length} pontos → downsample para ${MAX_CHART_POINTS}`);
    }
    return downsample(full, MAX_CHART_POINTS);
  }, [telemetryRes]);

  const gpxSeries = useMemo(() => {
    if (trip?.source !== "GPX_IMPORTED") return [];
    const pts = trip.gpxData?.waypoints ?? [];
    const series = deriveGpxSeries(pts);
    // Store full-resolution data in ref for map/slider/animation
    gpxSeriesRef.current = series;
    tripSourceRef.current = trip?.source;
    const count = series.length;
    if (count > MAX_CHART_POINTS) {
      console.log(`[CHART] GPX: ${count} pontos → downsample para ${MAX_CHART_POINTS} para gráficos`);
    }
    // Return downsampled version for charts only
    return downsample(series, MAX_CHART_POINTS);
  }, [trip?.gpxData?.waypoints, trip?.source]);

  const rpmVsSpeed = useMemo(() => {
    const points = telemetryRes?.data ?? [];
    const out: Array<{ speed: number; rpm: number; t: number }> = [];
    for (const p of points) {
      if (typeof p.speed_kmh === "number" && typeof p.rpm === "number") {
        out.push({ speed: p.speed_kmh, rpm: p.rpm, t: new Date(p.time).getTime() });
      }
    }
    return downsample(out, MAX_CHART_POINTS);
  }, [telemetryRes]);

  const summary = useMemo(() => {
    if (trip?.source === "GPX_IMPORTED") {
      const maxEle = gpxSeries.reduce<number | null>((acc, p) => {
        if (p.ele == null) return acc;
        if (acc == null) return p.ele;
        return Math.max(acc, p.ele);
      }, null);

      const maxSpeed = gpxSeries.reduce<number | null>((acc, p) => {
        if (p.speedKmh == null) return acc;
        if (acc == null) return p.speedKmh;
        return Math.max(acc, p.speedKmh);
      }, null);

      const avgSpeed = typeof trip.avgSpeedKmh === "number" ? trip.avgSpeedKmh : null;
      const distanceKm = typeof trip.distanceKm === "number" ? trip.distanceKm : (gpxSeries.at(-1)?.distanceKm ?? null);

      return {
        points: trip.gpxData?.waypoints?.length ?? 0,
        gpsPoints: trip.gpxData?.waypoints?.length ?? 0,
        avgSpeed,
        maxSpeed,
        maxRoll: null,
        maxTemp: null,
        maxEle,
        distanceKm,
      };
    }

    const points = telemetryRes?.data ?? [];
    let maxSpeed = -Infinity;
    let maxAbsRoll = 0;
    let maxTemp = -Infinity;
    let speedSum = 0;
    let speedCount = 0;
    let validGps = 0;

    for (const p of points) {
      if (typeof p.speed_kmh === "number") {
        maxSpeed = Math.max(maxSpeed, p.speed_kmh);
        speedSum += p.speed_kmh;
        speedCount++;
      }
      if (typeof p.roll_deg === "number") {
        maxAbsRoll = Math.max(maxAbsRoll, Math.abs(p.roll_deg));
      }
      if (typeof p.engine_temp_c === "number") {
        maxTemp = Math.max(maxTemp, p.engine_temp_c);
      }
      if (typeof p.latitude === "number" && typeof p.longitude === "number") {
        validGps++;
      }
    }

    return {
      points: points.length,
      gpsPoints: validGps,
      avgSpeed:
        speedCount > 0
          ? speedSum / speedCount
          : (typeof trip?.avgSpeedKmh === "number" ? trip.avgSpeedKmh : null),
      maxSpeed:
        Number.isFinite(maxSpeed)
          ? maxSpeed
          : (typeof trip?.maxSpeedKmh === "number" ? trip.maxSpeedKmh : null),
      maxRoll:
        maxAbsRoll > 0
          ? maxAbsRoll
          : (typeof trip?.maxRollDeg === "number" ? trip.maxRollDeg : null),
      maxTemp: Number.isFinite(maxTemp) ? maxTemp : null,
      maxEle: null,
      distanceKm: typeof trip?.distanceKm === "number" ? trip.distanceKm : null,
    };
  }, [gpxSeries, telemetryRes, trip]);

  // Always read from full-resolution refs so slider/animation are in sync for long trips
  const getCurrentDataPoint = useCallback((index: number) => {
    if (tripSourceRef.current === "GPX_IMPORTED") {
      const point = gpxSeriesRef.current[index];
      if (!point) return null;
      return {
        lat: point.lat,
        lon: point.lon,
        time: point.time,
        speedKmh: point.speedKmh ?? undefined,
      };
    }
    const point = telemetryDataRef.current?.[index];
    if (!point) return null;
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      time: point.time,
      speed_kmh: point.speed_kmh,
      rpm: point.rpm,
      engine_temp_c: point.engine_temp_c,
      roll_deg: point.roll_deg,
      oil_pressure_bar: point.oil_pressure_bar,
      tire_pressure_front_bar: point.tire_pressure_front_bar,
      tire_pressure_rear_bar: point.tire_pressure_rear_bar,
    };
  }, []); // no deps — reads from refs only

  const maxIndex = useMemo(() => {
    if (trip?.source === "GPX_IMPORTED") {
      // Use full-resolution ref length so slider matches animation loop
      return Math.max(0, gpxSeriesRef.current.length - 1);
    }
    return Math.max(0, (telemetryDataRef.current?.length ?? 0) - 1);
  }, [trip?.source, trip?.gpxData?.waypoints, telemetryRes]);

  const currentTimeFormatted = useMemo(() => {
    const point = getCurrentDataPoint(timeIndex);
    if (!point) return "00:00:00";
    return new Date(point.time).toLocaleTimeString("pt-PT");
  }, [timeIndex, getCurrentDataPoint]);

  // Total duration string derived from first/last data point timestamps
  const totalDurationFormatted = useMemo(() => {
    const first = getCurrentDataPoint(0);
    const last = getCurrentDataPoint(maxIndex);
    if (!first || !last) return "";
    const diffMs = new Date(last.time).getTime() - new Date(first.time).getTime();
    if (diffMs <= 0) return "";
    const totalSec = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }, [maxIndex, getCurrentDataPoint]);

  // Elapsed time from start to current position
  const elapsedTimeFormatted = useMemo(() => {
    const first = getCurrentDataPoint(0);
    const current = getCurrentDataPoint(timeIndex);
    if (!first || !current) return "0:00";
    const diffMs = new Date(current.time).getTime() - new Date(first.time).getTime();
    if (diffMs < 0) return "0:00";
    const totalSec = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }, [timeIndex, getCurrentDataPoint]);

  // Aggressive throttle for currentTimestamp to minimize chart re-renders
  const currentTimestamp = useMemo(() => {
    // During playback, throttle heavily — charts update at most every 500ms anyway
    const throttleFactor = isPlaying ? (playbackSpeed >= 5 ? 50 : 30) : 1;
    const throttledIndex = Math.floor(timeIndex / throttleFactor) * throttleFactor;
    const point = getCurrentDataPoint(throttledIndex);
    if (!point) return 0;
    return new Date(point.time).getTime();
  }, [Math.floor(timeIndex / (isPlaying ? (playbackSpeed >= 5 ? 50 : 30) : 1)), getCurrentDataPoint, isPlaying, playbackSpeed]);

  const hasPlaybackData = useMemo(() => {
    if (trip?.source === "GPX_IMPORTED") {
      return gpxSeriesRef.current.length > 0;
    }
    return (telemetryDataRef.current?.length ?? 0) > 0;
  }, [trip?.source, trip?.gpxData?.waypoints, telemetryRes]);

  // Always show chart cursors
  const showChartCursors = true;

  const handlePlay = useCallback(() => {
    if (timeIndex >= maxIndex) {
      setTimeIndex(0);
      timeIndexRef.current = 0;
    }
    const dataSize = tripSourceRef.current === "GPX_IMPORTED"
      ? gpxSeriesRef.current.length
      : (telemetryDataRef.current?.length ?? 0);
    console.log(`[REPLAY] A preparar — source: ${tripSourceRef.current}, pontos: ${dataSize}, speed: ${playbackSpeed}x`);
    // Preload: give browser one frame to settle before starting animation
    setIsPreloading(true);
    setTimeout(() => {
      setIsPreloading(false);
      setIsPlaying(true);
    }, 400);
  }, [timeIndex, maxIndex, playbackSpeed]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setTimeIndex(0);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(
      [41.2951, -7.7463],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    routeLayerRef.current = L.polyline([], { color: "#3b82f6", weight: 4 }).addTo(map);
    eventsLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const invalidateTimeout = window.setTimeout(() => {
      if (mapRef.current) map.invalidateSize();
    }, 300);

    return () => {
      window.clearTimeout(invalidateTimeout);
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      eventsLayerRef.current = null;
    };
  }, [isLoading]);

  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current || !eventsLayerRef.current) return;

    routeLayerRef.current.setLatLngs(routePoints);
    eventsLayerRef.current.clearLayers();

    const evs = trip?.events ?? [];
    for (const ev of evs) {
      if (typeof ev.latitude !== "number" || typeof ev.longitude !== "number") continue;
      const c = eventColor(ev.severity);
      const marker = L.circleMarker([ev.latitude, ev.longitude], {
        radius: 7,
        color: c,
        fillColor: c,
        fillOpacity: 0.85,
        weight: 2,
      }).bindPopup(
        `<div style="min-width:180px">
          <div style="font-weight:600;margin-bottom:6px">${ev.severity} — ${ev.type}</div>
          <div style="margin-bottom:6px">${ev.message}</div>
          <div style="color:#71717a">${formatDateTime(ev.occurredAt)}</div>
        </div>`,
      );
      marker.addTo(eventsLayerRef.current);
    }

    if (routePoints.length > 1) {
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
    } else if (routePoints.length === 1) {
      mapRef.current.setView(routePoints[0], 16);
    } else {
      mapRef.current.setView([41.2951, -7.7463], 13);
    }
  }, [routePoints, trip?.events]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Create playback marker if it doesn't exist
    if (!playbackMarkerRef.current) {
      const icon = L.divIcon({
        className: 'playback-marker',
        html: '<div style="background: #eab308; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      playbackMarkerRef.current = L.marker([0, 0], { icon, interactive: true }).addTo(mapRef.current);
    }

    // Always update marker when slider is dragged (not playing)
    if (!isPlaying) {
      const point = getCurrentDataPoint(timeIndex);
      if (point) {
        const lat = 'lat' in point ? point.lat : point.latitude;
        const lon = 'lon' in point ? point.lon : point.longitude;
        const speed = 'speedKmh' in point ? point.speedKmh : point.speed_kmh;
        if (typeof lat === 'number' && typeof lon === 'number') {
          playbackMarkerRef.current.setLatLng([lat, lon]);
          // Pan map smoothly to follow the dragged position
          mapRef.current.panTo([lat, lon], { animate: true, duration: 0.25 });
          const popupContent = `<div style="min-width:150px"><div style="font-weight:600;margin-bottom:4px">Posição</div><div style="font-size:12px;color:#71717a">${currentTimeFormatted}</div>${speed != null ? `<div style="font-size:12px;margin-top:4px">${speed.toFixed(1)} km/h</div>` : ''}</div>`;
          playbackMarkerRef.current.bindPopup(popupContent);
        }
      }
    }
  }, [timeIndex, isPlaying, getCurrentDataPoint, currentTimeFormatted]);

  // Single unified animation loop — reads from refs, zero closure over large arrays
  useEffect(() => {
    if (!isPlaying) return;

    timeIndexRef.current = timeIndex;
    lastRenderRef.current = Date.now();
    lastPanRef.current = Date.now();

    let frameCount = 0;
    let totalFrameTime = 0;
    let slowFrames = 0;
    const sessionStart = Date.now();

    console.log(`[REPLAY] Iniciado — source: ${tripSourceRef.current}, maxIndex: ${maxIndex}, speed: ${playbackSpeed}x`);

    const intervalId = setInterval(() => {
      const frameStart = Date.now();
      const nextIndex = timeIndexRef.current + playbackSpeed;

      if (nextIndex >= maxIndex) {
        timeIndexRef.current = maxIndex;
        setTimeIndex(maxIndex);
        setIsPlaying(false);
        const totalTime = Date.now() - sessionStart;
        console.log(`[REPLAY] Concluído — ${frameCount} frames em ${totalTime}ms, frames lentos (>150ms): ${slowFrames}`);
        return;
      }

      timeIndexRef.current = nextIndex;
      const idx = Math.floor(nextIndex);

      // Read position directly from refs — no React closure over large arrays
      let lat: number | undefined;
      let lon: number | undefined;
      if (tripSourceRef.current === "GPX_IMPORTED") {
        const pt = gpxSeriesRef.current[idx];
        if (pt) { lat = pt.lat; lon = pt.lon; }
      } else {
        const pt = telemetryDataRef.current?.[idx];
        if (pt && typeof pt.latitude === "number" && typeof pt.longitude === "number") {
          lat = pt.latitude; lon = pt.longitude;
        }
      }

      // Update map marker directly (no React re-render)
      if (lat !== undefined && lon !== undefined && playbackMarkerRef.current && mapRef.current) {
        playbackMarkerRef.current.setLatLng([lat, lon]);
        // Pan map only every 500ms to avoid blocking Leaflet
        const nowPan = Date.now();
        if (nowPan - lastPanRef.current >= 500) {
          mapRef.current.setView([lat, lon], mapRef.current.getZoom(), { animate: false });
          lastPanRef.current = nowPan;
        }
      }

      // Throttle React state update to every 500ms (for slider + charts) — non-urgent transition
      const now = Date.now();
      if (now - lastRenderRef.current >= 500) {
        lastRenderRef.current = now;
        startTransition(() => {
          setTimeIndex(idx);
        });
      }

      // Track frame performance
      const frameDuration = Date.now() - frameStart;
      frameCount++;
      totalFrameTime += frameDuration;
      if (frameDuration > 150) {
        slowFrames++;
        console.warn(`[REPLAY] Frame lento — idx: ${idx}, duração: ${frameDuration}ms`);
      }
      // Log summary every 50 frames
      if (frameCount % 50 === 0) {
        const avg = (totalFrameTime / frameCount).toFixed(1);
        console.log(`[REPLAY] ${frameCount} frames — avg: ${avg}ms/frame, lentos: ${slowFrames}, idx: ${idx}/${maxIndex}`);
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
      if (frameCount > 0) {
        const avg = (totalFrameTime / frameCount).toFixed(1);
        console.log(`[REPLAY] Parado — ${frameCount} frames, avg: ${avg}ms/frame, lentos: ${slowFrames}`);
      }
    };
  }, [isPlaying, playbackSpeed, maxIndex]);

  if (isLoading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">A carregar viagem...</div>
          <div className="empty-state-text">A preparar análise e gráficos.</div>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Não foi possível abrir a viagem</div>
          <div className="empty-state-text" style={{ marginBottom: 14 }}>
            {error ?? "Viagem não encontrada."}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <Link to="/trips" className="btn btn-ghost">
              Voltar ao histórico
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    if (!trip) return;
    if (!telemetryRes?.data?.length) return;
    try {
      setExportingCsv(true);
      const rows = telemetryRes.data;
      const headers = Array.from(
        rows.reduce((acc, r) => {
          Object.keys(r).forEach((k) => acc.add(k));
          return acc;
        }, new Set<string>()),
      );
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const csv =
        headers.join(",") +
        "\n" +
        rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")).join("\n");
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `telemetria-${trip.id}.csv`,
      );
    } finally {
      setExportingCsv(false);
    }
  }

  async function exportPdf() {
    if (!trip) return;
    if (!reportRef.current) return;
    try {
      setExportingPdf(true);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0b0b0f",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-${trip.id}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  async function exportGpx() {
    if (!trip) return;
    try {
      setExportingGpx(true);
      const res = await gpxAPI.exportTrip(trip.id);
      const blob = new Blob([res.data], { type: "application/gpx+xml" });
      downloadBlob(blob, `viagem-${trip.id}.gpx`);
    } finally {
      setExportingGpx(false);
    }
  }

  async function shareTrip() {
    if (!trip) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Viagem — ${trip.motorcycle?.name ?? "MotoGuard"}`,
          text: `Análise de viagem em ${trip.motorcycle?.name ?? "MotoGuard"} — ${formatDateTime(trip.startedAt)}`,
          url,
        });
      } catch {
        // utilizador cancelou
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copiado para a área de transferência");
      setTimeout(() => setShareMsg(null), 2500);
    }
  }

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">📈 Análise Pós‑Viagem</div>
          <div className="page-subtitle">
            {trip.motorcycle?.name ?? "—"} · {formatDateTime(trip.startedAt)}
          </div>
        </div>
        <div className="page-actions">
          <Link to="/trips" className="btn btn-ghost btn-sm">
            ← Histórico
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={exportGpx}
            disabled={exportingGpx}
            title="Exportar a rota para GPX (para Strava, Relive, etc.)"
          >
            {exportingGpx ? "GPX..." : "Exportar GPX"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={exportCsv}
            disabled={exportingCsv || !telemetryRes?.data?.length}
            title="Exportar CSV com dados brutos de telemetria"
          >
            {exportingCsv ? "CSV..." : "Exportar CSV"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={exportPdf}
            disabled={exportingPdf}
            title="Exportar relatório em PDF (inclui mapas e gráficos)"
          >
            {exportingPdf ? "PDF..." : "Exportar PDF"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void shareTrip()}
            title="Partilhar esta viagem"
          >
            Partilhar
          </button>
          {shareMsg && (
            <span style={{ fontSize: 13, color: "var(--green, #22c55e)", alignSelf: "center" }}>
              {shareMsg}
            </span>
          )}
        </div>
      </div>

      <div ref={reportRef}>
        <div className="tile-grid">
          {[
            { label: "Origem", val: trip.source },
            { label: "Estado", val: trip.status },
            { label: "Pontos", val: summary.points.toString() },
            { label: "GPS", val: summary.gpsPoints.toString() },
            ...(summary.distanceKm != null
              ? [{ label: "Distância", val: `${summary.distanceKm.toFixed(2)} km` }]
              : []),
            {
              label: "Vel. Máx.",
              val: summary.maxSpeed != null ? `${summary.maxSpeed.toFixed(1)} km/h` : "—",
            },
            {
              label: "Vel. Média",
              val: summary.avgSpeed != null ? `${summary.avgSpeed.toFixed(1)} km/h` : "—",
            },
            ...(trip.source !== "GPX_IMPORTED"
              ? [
                  {
                    label: "Inclin. Máx.",
                    val: summary.maxRoll != null ? `${summary.maxRoll.toFixed(1)}°` : "—",
                  },
                  {
                    label: "Temp. Máx.",
                    val: summary.maxTemp != null ? `${summary.maxTemp.toFixed(1)} °C` : "—",
                  },
                ]
              : []),
            ...(trip.source === "GPX_IMPORTED"
              ? [
                  {
                    label: "Alt. Máx.",
                    val: summary.maxEle != null ? `${summary.maxEle.toFixed(0)} m` : "—",
                  },
                ]
              : []),
          ].map(({ label, val }) => (
            <div key={label} className="tile">
              <div className="tile-k">{label}</div>
              <div className="tile-v">{val}</div>
            </div>
          ))}
        </div>

        {trip.category != null && (
          <div style={{ marginTop: 10 }}>
            <TripCategoryBadge category={trip.category} confidence={trip.categoryConfidence} />
          </div>
        )}

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div className="panel-title">🤖 Avaliação de Condução</div>
          </div>
          <div className="panel-body">
            {evaluation ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Scores lado a lado */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <div className="tile" style={{ flex: 1, minWidth: 120 }}>
                    <div className="tile-k">Score Heurístico</div>
                    <div className="tile-v" style={{ color: evaluation.score >= 70 ? "#22c55e" : evaluation.score >= 40 ? "#eab308" : "#ef4444", fontSize: 28 }}>
                      {evaluation.score}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>regras fixas</div>
                  </div>
                  <div className="tile" style={{ flex: 1, minWidth: 120 }}>
                    <div className="tile-k">Score ML</div>
                    {evaluation.mlScore !== null ? (
                      <>
                        <div className="tile-v" style={{ color: evaluation.mlScore >= 70 ? "#22c55e" : evaluation.mlScore >= 40 ? "#eab308" : "#ef4444", fontSize: 28 }}>
                          {evaluation.mlScore}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Isolation Forest</div>
                      </>
                    ) : (
                      <>
                        <div className="tile-v" style={{ color: "var(--text-muted)", fontSize: 18 }}>—</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>não disponível</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Feedback ML */}
                {evaluation.mlFeedback && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: 6 }}>
                    {evaluation.mlFeedback}
                  </div>
                )}

                {/* Comparison Report */}
                {evaluation.comparisonReport && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Concordância:</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                        background: evaluation.comparisonReport.agreementLevel === "HIGH" ? "rgba(34,197,94,0.15)" :
                                    evaluation.comparisonReport.agreementLevel === "MEDIUM" ? "rgba(234,179,8,0.15)" : "rgba(239,68,68,0.15)",
                        color: evaluation.comparisonReport.agreementLevel === "HIGH" ? "#22c55e" :
                               evaluation.comparisonReport.agreementLevel === "MEDIUM" ? "#eab308" : "#ef4444",
                      }}>
                        {evaluation.comparisonReport.agreementLevel === "HIGH" ? "✓ Alta" :
                         evaluation.comparisonReport.agreementLevel === "MEDIUM" ? "~ Média" : "✗ Baixa"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Δ {evaluation.comparisonReport.scoreDelta > 0 ? "+" : ""}{evaluation.comparisonReport.scoreDelta} pontos
                      </span>
                    </div>
                    {evaluation.comparisonReport.dominantFactors.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Fatores dominantes: {evaluation.comparisonReport.dominantFactors.join(", ")}
                      </div>
                    )}
                    {evaluation.comparisonReport.note && (
                      <div style={{ fontSize: 12, color: "#f97316", padding: "6px 10px", background: "rgba(249,115,22,0.1)", borderRadius: 4 }}>
                        ⚠️ {evaluation.comparisonReport.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : trip?.status === "COMPLETED" ? (
              <div className="empty-state" style={{ padding: "20px 0" }}>
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-title">A calcular avaliação...</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Avaliação disponível após a viagem ser concluída.
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div className="panel-title">🗺️ Rota e eventos</div>
            <div className="page-subtitle" style={{ margin: 0 }}>
              {routePoints.length} ponto{routePoints.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="panel-body">
            <div className="map-shell">
              <div ref={mapContainerRef} className="map-canvas" />
            </div>
            
            <PlaybackSlider
              value={timeIndex}
              max={maxIndex}
              currentTime={currentTimeFormatted}
              elapsedTime={elapsedTimeFormatted}
              totalDuration={totalDurationFormatted}
              disabled={!hasPlaybackData}
              onChange={setTimeIndex}
            />
            
            <PlaybackControls
              isPlaying={isPlaying}
              isPreloading={isPreloading}
              playbackSpeed={playbackSpeed}
              disabled={!hasPlaybackData}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSpeedChange={handleSpeedChange}
            />
            
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span className="badge-pill" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                Rota
              </span>
              <span className="badge-pill" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                CRITICAL
              </span>
              <span className="badge-pill" style={{ backgroundColor: "rgba(234,179,8,0.12)", color: "#eab308" }}>
                WARNING
              </span>
              <span className="badge-pill" style={{ backgroundColor: "rgba(113,113,122,0.12)", color: "#71717a" }}>
                INFO
              </span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <div className="panel-title">📉 Gráficos</div>
            <div className="page-subtitle" style={{ margin: 0 }}>
              Interativos
            </div>
          </div>
          <div className="panel-body">
            {trip.source === "GPX_IMPORTED" ? (
              <div className="tile-grid" style={{ gap: 14 }}>
                <ChartCard interactive={!isPlaying} title="Velocidade (km/h) — derivada do GPX">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={gpxSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="speedKmh" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Altitude (m)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={gpxSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="ele" stroke="#22c55e" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Distância acumulada (km)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={gpxSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="distanceKm" stroke="#a855f7" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            ) : (
              <div className="tile-grid" style={{ gap: 14 }}>
                <ChartCard interactive={!isPlaying} title="Velocidade (km/h)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="RPM vs Velocidade">
                  <ResponsiveContainer width="100%" height={240}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="speed" type="number" name="Velocidade" unit=" km/h" />
                      <YAxis dataKey="rpm" type="number" name="RPM" />
                      {!isPlaying && <Tooltip cursor={{ strokeDasharray: "3 3" }} />}
                      <Scatter data={rpmVsSpeed} fill="#22c55e" />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Temperatura do motor (°C)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="temp" stroke="#f97316" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Inclinação (roll °)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="roll" stroke="#a855f7" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Pressão do óleo (bar)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="oil" stroke="#38bdf8" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard interactive={!isPlaying} title="Pressão dos pneus (bar)">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                      />
                      <YAxis />
                      {!isPlaying && <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />}
                      <Line type="monotone" dataKey="tireF" name="Frente" stroke="#22c55e" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="tireR" name="Trás" stroke="#eab308" dot={false} isAnimationActive={false} />
                      {showChartCursors && (
                        <ReferenceLine
                          x={currentTimestamp}
                          stroke="#eab308"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ChartCard = memo(function ChartCard({ title, children, interactive = true }: { title: string; children: React.ReactNode; interactive?: boolean }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      </div>
      <LazyChart>
        <div style={{ position: "relative" }}>
          {children}
          {!interactive && (
            <div style={{
              position: "absolute", inset: 0,
              cursor: "default", zIndex: 10,
            }} />
          )}
        </div>
      </LazyChart>
    </div>
  );
});
