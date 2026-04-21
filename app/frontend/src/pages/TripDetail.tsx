import { useEffect, useMemo, useRef, useState } from "react";
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
        setTrip(tripRes.data);

        if (tripRes.data.source !== "GPX_IMPORTED") {
          const telem = await tripsAPI.getTelemetry(id);
          if (cancelled) return;
          setTelemetryRes(telem.data);
        } else {
          setTelemetryRes(null);
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
    return points
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
                <ChartCard title="Velocidade (km/h) — derivada do GPX">
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
                      <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />
                      <Line type="monotone" dataKey="speedKmh" stroke="#3b82f6" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Altitude (m)">
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
                      <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />
                      <Line type="monotone" dataKey="ele" stroke="#22c55e" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Distância acumulada (km)">
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
                      <Tooltip labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")} />
                      <Line type="monotone" dataKey="distanceKm" stroke="#a855f7" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            ) : (
              <div className="tile-grid" style={{ gap: 14 }}>
                <ChartCard title="Velocidade (km/h)">
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
                      <Tooltip
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")}
                      />
                      <Line type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="RPM vs Velocidade">
                  <ResponsiveContainer width="100%" height={240}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="speed" type="number" name="Velocidade" unit=" km/h" />
                      <YAxis dataKey="rpm" type="number" name="RPM" />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter data={rpmVsSpeed} fill="#22c55e" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Temperatura do motor (°C)">
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
                      <Tooltip
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")}
                      />
                      <Line type="monotone" dataKey="temp" stroke="#f97316" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Inclinação (roll °)">
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
                      <Tooltip
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")}
                      />
                      <Line type="monotone" dataKey="roll" stroke="#a855f7" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Pressão do óleo (bar)">
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
                      <Tooltip
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")}
                      />
                      <Line type="monotone" dataKey="oil" stroke="#38bdf8" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Pressão dos pneus (bar)">
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
                      <Tooltip
                        labelFormatter={(v) => new Date(v as number).toLocaleTimeString("pt-PT")}
                      />
                      <Line type="monotone" dataKey="tireF" name="Frente" stroke="#22c55e" dot={false} />
                      <Line type="monotone" dataKey="tireR" name="Trás" stroke="#eab308" dot={false} />
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}
