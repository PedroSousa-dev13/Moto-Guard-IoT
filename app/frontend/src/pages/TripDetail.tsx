import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { gpxAPI, tripsAPI } from "../services/api";
import type { Trip, TripTelemetryResponse, TripEvent } from "../types";
import { deriveGpxSeries } from "../utils/gpx";
import { imageFromCategory } from "../utils/categoryImageMap";
import TripStatCard from "../components/trips/TripStatCard";
import TripChartCard from "../components/trips/TripChartCard";
import { 
  MapPin, 
  Activity, 
  ShieldCheck, 
  Gauge, 
  Clock, 
  Thermometer, 
  Milestone, 
  Download, 
  FileText, 
  ChevronLeft,
  Share2,
  Calendar,
  Zap,
  Navigation,
  Mountain,
  AlertTriangle
} from "lucide-react";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function formatDateTime(date: string) {
  const d = new Date(date);
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function eventColor(severity: TripEvent["severity"] | "INFO") {
  switch (severity) {
    case "CRITICAL":
      return "#ef4444";
    case "WARNING":
      return "#f59e0b";
    case "INFO":
      return "#3b82f6";
    default:
      return "#64748b";
  }
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tripId = id as string | undefined;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [telemetryRes, setTelemetryRes] = useState<TripTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingGpx, setExportingGpx] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

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
        console.debug("[TripDetail] Trip loaded:", tripRes.data);
        setTrip(tripRes.data);

        // Carregar telemetria InfluxDB para TODOS os tipos de viagem
        // (GPX_IMPORTED agora também tem dados no InfluxDB via GPX Simulator)
        try {
          const telem = await tripsAPI.getTelemetry(id);
          if (cancelled) return;
          console.debug("[TripDetail] Telemetry loaded:", telem.data);
          setTelemetryRes(telem.data);
        } catch {
          if (cancelled) return;
          console.warn("[TripDetail] Could not load telemetry, using GPX waypoints only.");
          setTelemetryRes(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Não foi possível carregar a viagem.");
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
    if (trip?.gpxData?.waypoints && Array.isArray(trip.gpxData.waypoints)) {
      return (trip.gpxData.waypoints as any[]).map((p) => {
        const lat = p.lat ?? p.latitude;
        const lon = p.lon ?? p.longitude;
        return [lat, lon] as L.LatLngTuple;
      }).filter(p => typeof p[0] === 'number' && typeof p[1] === 'number');
    }
    const points = telemetryRes?.data ?? [];
    const out: L.LatLngTuple[] = [];
    for (const p of points) {
      const lat = p.latitude;
      const lon = p.longitude;
      if (typeof lat === "number" && typeof lon === "number") {
        out.push([lat, lon]);
      }
    }
    return out;
  }, [telemetryRes, trip?.gpxData?.waypoints]);

  const chartSeries = useMemo(() => {
    const points = telemetryRes?.data ?? [];
    return points
      .map((p) => ({
        t: new Date(p.time).getTime(),
        time: p.time,
        speed: typeof p.speed_kmh === "number" ? p.speed_kmh : null,
        rpm: typeof p.rpm === "number" ? p.rpm : null,
        temp: typeof p.engine_temp_c === "number" ? p.engine_temp_c : null,
        roll: typeof p.roll_deg === "number" ? p.roll_deg : null,
        pitch: typeof p.pitch_deg === "number" ? p.pitch_deg : null,
        oil: typeof p.oil_pressure_bar === "number" ? p.oil_pressure_bar : null,
        tireF: typeof p.tire_pressure_front_bar === "number" ? p.tire_pressure_front_bar : null,
        tireR: typeof p.tire_pressure_rear_bar === "number" ? p.tire_pressure_rear_bar : null,
      }))
      .filter((p) => Number.isFinite(p.t));
  }, [telemetryRes]);

  const gpxSeries = useMemo(() => {
    if (trip?.source !== "GPX_IMPORTED") return [];
    const pts = trip.gpxData?.waypoints ?? [];
    return deriveGpxSeries(pts);
  }, [trip?.gpxData?.waypoints, trip?.source]);

  const rpmVsSpeed = useMemo(() => {
    const points = telemetryRes?.data ?? [];
    const out: Array<{ speed: number; rpm: number }> = [];
    for (const p of points) {
      if (typeof p.speed_kmh === "number" && typeof p.rpm === "number") {
        out.push({ speed: p.speed_kmh, rpm: p.rpm });
      }
    }
    return out;
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
      const distanceKm = typeof trip.distanceKm === "number" ? trip.distanceKm : (gpxSeries.length > 0 ? gpxSeries[gpxSeries.length - 1].distanceKm : null);

      const waypoints = Array.isArray(trip.gpxData?.waypoints) ? trip.gpxData.waypoints : [];
      
      return {
        points: waypoints.length,
        gpsPoints: waypoints.length,
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
      hasStunts: trip?.events?.some(e => e.type === "WHEELIE_DETECTED" || e.type === "STOPPIE_DETECTED") ?? false,
    };
  }, [gpxSeries, telemetryRes, trip]);

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
      routeLayerRef.current.setLatLngs(routePoints);

      // Add green start marker
      const startIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10" fill="#22c55e" stroke="#16a34a" stroke-width="3"/></svg>'),
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(routePoints[0], { icon: startIcon })
        .bindPopup(`<div style="font-weight:600;color:#22c55e">Início da Viagem</div><div style="color:#71717a">${formatDateTime(trip.startedAt)}</div>`)
        .addTo(eventsLayerRef.current!);

      // Add red end marker
      const endIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10" fill="#ef4444" stroke="#dc2626" stroke-width="3"/></svg>'),
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(routePoints[routePoints.length - 1], { icon: endIcon })
        .bindPopup(`<div style="font-weight:600;color:#ef4444">Fim da Viagem</div><div style="color:#71717a">${trip.endedAt ? formatDateTime(trip.endedAt) : 'Em curso'}</div>`)
        .addTo(eventsLayerRef.current!);

      mapRef.current!.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
    } else if (routePoints.length === 1) {
      mapRef.current.setView(routePoints[0], 16);
    } else {
      mapRef.current.setView([41.2951, -7.7463], 13);
    }
  }, [routePoints, trip?.events]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-8">
        <div className="w-24 h-24 rounded-full border-8 border-accent/10 border-t-accent animate-spin shadow-2xl" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-text tracking-tight">A carregar viagem...</h2>
          <p className="text-muted text-sm font-medium animate-pulse uppercase tracking-widest">Preparando análise e gráficos de telemetria</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-8">
        <div className="w-24 h-24 rounded-full bg-red/10 border border-red/20 flex items-center justify-center text-red shadow-2xl">
          <AlertTriangle size={48} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-text tracking-tight">Não foi possível carregar a viagem</h2>
          <p className="text-muted text-sm font-medium max-w-sm">{error ?? "Viagem não encontrada no sistema."}</p>
        </div>
        <button onClick={() => navigate("/trips")} className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:scale-105 transition-all">
          <ChevronLeft size={18} /> Voltar ao Histórico
        </button>
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
        backgroundColor: "#06060c",
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

  return (
    <div className="flex flex-col gap-12 animate-fade-in pb-20">
      {/* HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <button onClick={() => navigate("/trips")} className="flex items-center gap-2 text-muted hover:text-accent font-black text-[0.65rem] uppercase tracking-widest transition-colors mb-2 group shrink-0 w-fit">
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Voltar ao Histórico
          </button>
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <Activity className="text-accent" size={32} /> Análise Pós‑Viagem
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-[0.65rem] font-black uppercase tracking-widest text-text hover:bg-white/10 transition-all disabled:opacity-30 shadow-lg"
            onClick={exportGpx}
            disabled={exportingGpx}
          >
            <Navigation size={16} className="text-accent" /> {exportingGpx ? "A exportar..." : "GPX"}
          </button>
          <button
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-[0.65rem] font-black uppercase tracking-widest text-text hover:bg-white/10 transition-all disabled:opacity-30 shadow-lg"
            onClick={exportCsv}
            disabled={exportingCsv || !telemetryRes?.data?.length}
          >
            <Download size={16} className="text-accent" /> {exportingCsv ? "A exportar..." : "CSV"}
          </button>
          <button
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-accent text-white text-[0.65rem] font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
            onClick={exportPdf}
            disabled={exportingPdf}
          >
            <FileText size={18} /> {exportingPdf ? "Gerando..." : "Relatório PDF"}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="flex flex-col gap-10">
        {/* HERO SECTION */}
        <div className="relative bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden shadow-2xl group min-h-[260px]">
          <img src={imageFromCategory((trip.motorcycle as any)?.category)} alt="moto" className="moto-card-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent pointer-events-none" />
          <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-accent/10 blur-[120px] pointer-events-none group-hover:bg-accent/20 transition-colors" />
          
          <div className="flex-1 relative z-10 flex flex-col gap-5 text-center md:text-left justify-center">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter m-0 leading-tight flex flex-wrap items-center gap-4">
              {trip.motorcycle?.name ?? "Viagem Sem Nome"}
              {summary.hasStunts && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-orange/10 border border-orange/20 text-orange font-black text-[0.6rem] uppercase tracking-widest animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                  <Activity size={12} />
                  Manobras Detetadas
                </div>
              )}
            </h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-8">
              <div className="flex items-center gap-2.5 text-sm font-bold text-muted">
                <Calendar size={20} className="text-accent/60" /> {formatDateTime(trip.startedAt)}
              </div>
              <div className="flex items-center gap-2.5 text-[0.65rem] font-black text-muted uppercase tracking-[0.2em] opacity-80">
                <Zap size={20} className="text-accent/60" /> {trip.source}
              </div>
              <div className="flex items-center gap-2.5 text-[0.65rem] font-black text-muted uppercase tracking-[0.2em] opacity-80">
                <Activity size={20} className="text-accent/60" /> {trip.status}
              </div>
            </div>
          </div>
          
          <div className="flex gap-6 relative z-10 items-center">
            {trip.safetyScore != null && (
              <div className="bg-black/40 backdrop-blur-lg border border-white/5 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-3 min-w-[170px] shadow-inner group/score hover:border-accent/40 transition-all">
                <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Safety Score</span>
                <span className={`text-6xl font-black tracking-tighter tabular-nums transition-transform group-hover/score:scale-110 drop-shadow-2xl`} style={{ color: eventColor(trip.safetyScore >= 80 ? 'INFO' : (trip.safetyScore >= 50 ? 'WARNING' : 'CRITICAL')) }}>
                  {trip.safetyScore}
                </span>
                <ShieldCheck size={32} className="opacity-20 mt-1" />
              </div>
            )}
            {trip.performanceScore != null && (
              <div className="bg-black/40 backdrop-blur-lg border border-white/5 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-3 min-w-[170px] shadow-inner group/score hover:border-accent/40 transition-all">
                <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Performance</span>
                <span className={`text-6xl font-black tracking-tighter tabular-nums transition-transform group-hover/score:scale-110 drop-shadow-2xl`} style={{ color: eventColor(trip.performanceScore >= 80 ? 'INFO' : (trip.performanceScore >= 50 ? 'WARNING' : 'CRITICAL')) }}>
                  {trip.performanceScore}
                </span>
                <Gauge size={32} className="opacity-20 mt-1" />
              </div>
            )}
          </div>
        </div>

        {/* MAIN GRID: MAP + SIDE STATS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shadow-lg">
                  <MapPin size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-text tracking-tight uppercase tracking-widest">Mapa de Rota</span>
                  <span className="text-[0.65rem] font-black text-muted uppercase tracking-[0.2em] opacity-60">{routePoints.length} coordenadas registadas</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-[0.6rem] font-black uppercase tracking-widest">Trajeto Principal</span>
                <span className="px-4 py-1.5 rounded-xl bg-red/10 border border-red/20 text-red text-[0.6rem] font-black uppercase tracking-widest">Eventos Críticos</span>
                <span className="px-4 py-1.5 rounded-xl bg-yellow/10 border border-yellow/20 text-yellow text-[0.6rem] font-black uppercase tracking-widest">Avisos</span>
              </div>
            </div>
            <div className="flex-1 min-h-[550px] relative">
              <div ref={mapContainerRef} className="absolute inset-0 grayscale-[0.2] brightness-[0.8] invert-[0.1]" />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <TripStatCard icon={<Milestone size={28} />} label="Distância Total" value={summary.distanceKm?.toFixed(2) ?? "—"} unit="km" />
            <TripStatCard icon={<Gauge size={28} />} label="Velocidade Máx." value={summary.maxSpeed?.toFixed(1) ?? "—"} unit="km/h" />
            <TripStatCard icon={<Activity size={28} />} label="Velocidade Média" value={summary.avgSpeed?.toFixed(1) ?? "—"} unit="km/h" />
            
            {(chartSeries.length > 0 || trip.source !== "GPX_IMPORTED") ? (
              <>
                <TripStatCard icon={<Zap size={28} />} label="Inclinação Máx." value={summary.maxRoll?.toFixed(1) ?? "—"} unit="°" />
                <TripStatCard icon={<Thermometer size={28} />} label="Temp. Máxima" value={summary.maxTemp?.toFixed(1) ?? "—"} unit="°C" />
              </>
            ) : (
              <TripStatCard icon={<Mountain size={28} />} label="Altitude Máx." value={summary.maxEle?.toFixed(0) ?? "—"} unit="m" />
            )}
            
            <TripStatCard icon={<MapPin size={28} />} label="Pontos GPS" value={summary.gpsPoints.toString()} unit="pts" />
          </div>
        </div>

        {/* TELEMETRY ANALYSIS SECTION */}
        <div className="flex flex-col gap-10 mt-6">
          <div className="flex items-center gap-5">
            <span className="text-[0.7rem] font-black uppercase tracking-[0.4em] text-accent">Análise de Performance e Dinâmica</span>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {(chartSeries.length === 0 && trip.source === "GPX_IMPORTED") ? (
              <>
                <TripChartCard title="Perfil de Velocidade" icon={<Gauge size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={gpxSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="speedKmh" stroke="#3b82f6" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>

                <TripChartCard title="Variação de Altitude" icon={<Mountain size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={gpxSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="ele" stroke="#10b981" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>
              </>
            ) : (
              <>
                <TripChartCard title="Velocidade & Ritmo" icon={<Gauge size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>

                <TripChartCard title="Eficiência (RPM vs Velocidade)" icon={<Zap size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="speed" type="number" name="Velocidade" unit=" km/h" tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <YAxis dataKey="rpm" type="number" name="RPM" tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        cursor={{ strokeDasharray: "3 3" }} 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                      />
                      <Scatter data={rpmVsSpeed} fill="#10b981" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </TripChartCard>
              </>
            )}
          </div>

          {(chartSeries.length > 0) && (
            <>
              <div className="flex items-center gap-5 mt-12">
                <span className="text-[0.7rem] font-black uppercase tracking-[0.4em] text-accent">Saúde do Motor e Monitorização Avançada</span>
                <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <TripChartCard title="Temperatura do Motor" icon={<Thermometer size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="temp" stroke="#f97316" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>

                <TripChartCard title="Dinâmica de Inclinação (Roll)" icon={<Activity size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="roll" stroke="#8b5cf6" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>
                
                <TripChartCard title="Dinâmica Longitudinal (Pitch)" icon={<Activity size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="pitch" stroke="#f43f5e" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>

                <TripChartCard title="Pressão do Óleo (Bar)" icon={<Activity size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="oil" stroke="#0ea5e9" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>

                <TripChartCard title="Sistemas de Pneus (Pressão)" icon={<Activity size={20} />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-PT")}
                        tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}}
                        stroke="rgba(255,255,255,0.1)"
                      />
                      <YAxis tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900}} stroke="rgba(255,255,255,0.1)" />
                      <Tooltip 
                        contentStyle={{backgroundColor: 'rgba(10,10,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} 
                      />
                      <Line type="monotone" dataKey="tireF" name="Frente" stroke="#10b981" dot={false} strokeWidth={4} animationDuration={2000} />
                      <Line type="monotone" dataKey="tireR" name="Trás" stroke="#f59e0b" dot={false} strokeWidth={4} animationDuration={2000} />
                    </LineChart>
                  </ResponsiveContainer>
                </TripChartCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



