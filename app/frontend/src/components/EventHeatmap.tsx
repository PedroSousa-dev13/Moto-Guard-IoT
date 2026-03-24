import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { alertsAPI } from "../services/api";
import { Loader2, MapPin } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertEvent {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  latitude?: number | null;
  longitude?: number | null;
  occurredAt: string;
  message: string;
  trip?: { id: string; motorcycle?: { name: string; brand?: string } | null } | null;
}

const EVENT_TYPES = [
  "HARD_BRAKING",
  "EXCESSIVE_LEAN",
  "CRASH_DETECTED",
  "RAPID_ACCELERATION",
  "OVERHEAT",
  "LOW_VOLTAGE",
  "HIGH_VIBRATION",
  "SPEEDING",
  "TIRE_PRESSURE_LOW",
  "OIL_PRESSURE_LOW",
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  WARNING: "#f59e0b",
  INFO: "#3b82f6",
};

const TYPE_LABELS: Record<string, string> = {
  HARD_BRAKING: "Travagem Brusca",
  EXCESSIVE_LEAN: "Inclinação Excessiva",
  CRASH_DETECTED: "Queda Detetada",
  RAPID_ACCELERATION: "Aceleração Brusca",
  OVERHEAT: "Sobreaquecimento",
  LOW_VOLTAGE: "Tensão Baixa",
  HIGH_VIBRATION: "Vibração Alta",
  SPEEDING: "Excesso de Velocidade",
  TIRE_PRESSURE_LOW: "Pressão Pneu Baixa",
  OIL_PRESSURE_LOW: "Pressão Óleo Baixa",
};

// ─── Canvas Heatmap Layer ─────────────────────────────────────────────────────

function drawHeatmap(
  canvas: HTMLCanvasElement,
  map: L.Map,
  points: { lat: number; lng: number; weight: number }[],
  radius: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  if (points.length === 0) return;

  // Draw each point as a radial gradient
  for (const pt of points) {
    const pos = map.latLngToContainerPoint([pt.lat, pt.lng]);
    const x = pos.x;
    const y = pos.y;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const alpha = Math.min(0.8, 0.3 + pt.weight * 0.5);
    grad.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
    grad.addColorStop(0.4, `rgba(255, 100, 0, ${alpha * 0.6})`);
    grad.addColorStop(1, "rgba(255, 0, 0, 0)");

    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Apply colormap via pixel manipulation
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha > 0) {
      // Map alpha to color: blue → yellow → red
      if (alpha < 0.33) {
        data[i] = 0; data[i + 1] = Math.round(alpha * 3 * 255); data[i + 2] = 255;
      } else if (alpha < 0.66) {
        const t = (alpha - 0.33) * 3;
        data[i] = Math.round(t * 255); data[i + 1] = 255; data[i + 2] = Math.round((1 - t) * 255);
      } else {
        const t = (alpha - 0.66) * 3;
        data[i] = 255; data[i + 1] = Math.round((1 - t) * 255); data[i + 2] = 0;
      }
      data[i + 3] = Math.round(alpha * 200);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  defaultEventType?: string;
}

export default function EventHeatmap({ defaultEventType }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>(defaultEventType ?? "ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [radius, setRadius] = useState(35);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit: 500 };
      if (selectedType !== "ALL") params.type = selectedType;
      if (selectedSeverity !== "ALL") params.severity = selectedSeverity;
      const res = await alertsAPI.getAll(params as any);
      let data: AlertEvent[] = res.data;

      // Client-side date filter
      if (fromDate) {
        const from = new Date(fromDate).getTime();
        data = data.filter((e) => new Date(e.occurredAt).getTime() >= from);
      }
      if (toDate) {
        const to = new Date(toDate + "T23:59:59").getTime();
        data = data.filter((e) => new Date(e.occurredAt).getTime() <= to);
      }

      setEvents(data);
    } catch {
      setError("Não foi possível carregar os eventos.");
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedSeverity, fromDate, toDate]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([39.5, -8.0], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Canvas overlay for heatmap
    const CanvasLayer = L.Layer.extend({
      onAdd(m: L.Map) {
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "400";
        (m.getPanes().overlayPane as HTMLElement).appendChild(canvas);
        canvasRef.current = canvas;
        this._map = m;
        this._resize();
        m.on("moveend zoomend resize", () => this._resize());
      },
      onRemove(m: L.Map) {
        canvasRef.current?.remove();
        m.off("moveend zoomend resize");
      },
      _resize() {
        const size = this._map.getSize();
        if (canvasRef.current) {
          canvasRef.current.width = size.x;
          canvasRef.current.height = size.y;
        }
      },
    });

    new (CanvasLayer as any)().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Render heatmap + markers when events or options change
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !canvas || !markersLayer) return;

    // Clear markers
    markersLayer.clearLayers();

    const geoEvents = events.filter((e) => e.latitude != null && e.longitude != null);

    // Heatmap
    if (showHeatmap) {
      const points = geoEvents.map((e) => ({
        lat: e.latitude!,
        lng: e.longitude!,
        weight: e.severity === "CRITICAL" ? 1 : e.severity === "WARNING" ? 0.6 : 0.3,
      }));
      drawHeatmap(canvas, map, points, radius);

      // Redraw on map move
      const redraw = () => drawHeatmap(canvas, map, points, radius);
      map.on("moveend zoomend", redraw);
      return () => { map.off("moveend zoomend", redraw); };
    } else {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [events, showHeatmap, radius]);

  // Markers layer
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (!showMarkers) return;

    const geoEvents = events.filter((e) => e.latitude != null && e.longitude != null);

    for (const ev of geoEvents) {
      const color = SEVERITY_COLORS[ev.severity] ?? "#6b7280";
      const marker = L.circleMarker([ev.latitude!, ev.longitude!], {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 1.5,
      });
      const label = TYPE_LABELS[ev.type] ?? ev.type;
      const date = new Date(ev.occurredAt).toLocaleString("pt-PT");
      const moto = ev.trip?.motorcycle ? `${ev.trip.motorcycle.brand ?? ""} ${ev.trip.motorcycle.name}`.trim() : "—";
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.5">
          <strong>${label}</strong><br/>
          <span style="color:${color}">${ev.severity}</span><br/>
          ${date}<br/>
          <span style="color:#9ca3af">${moto}</span>
        </div>`,
        { maxWidth: 200 }
      );
      markersLayer.addLayer(marker);
    }
  }, [events, showMarkers]);

  const geoCount = events.filter((e) => e.latitude != null && e.longitude != null).length;

  return (
    <div className="event-heatmap-wrapper">
      {/* Controls */}
      <div className="heatmap-controls">
        <div className="heatmap-filters">
          <select
            className="control control-sm"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Tipo de evento"
          >
            <option value="ALL">Todos os tipos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select
            className="control control-sm"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            aria-label="Severidade"
          >
            <option value="ALL">Todas as severidades</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>

          <input
            className="control control-sm"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Data de início"
            title="De"
          />
          <input
            className="control control-sm"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Data de fim"
            title="Até"
          />
        </div>

        <div className="heatmap-options">
          <label className="heatmap-toggle">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
            />
            Heatmap
          </label>
          <label className="heatmap-toggle">
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(e) => setShowMarkers(e.target.checked)}
            />
            Marcadores
          </label>
          <label className="heatmap-toggle" style={{ gap: 6 }}>
            Raio:
            <input
              type="range"
              min={15}
              max={80}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: 80 }}
              aria-label="Raio do heatmap"
            />
            <span style={{ minWidth: 24 }}>{radius}</span>
          </label>
        </div>

        <div className="heatmap-stats">
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
              <Loader2 size={14} className="animate-spin" /> A carregar...
            </span>
          ) : error ? (
            <span style={{ color: "#ef4444" }}>{error}</span>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              <MapPin size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
              {geoCount} eventos com localização ({events.length} total)
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Densidade:</span>
        <div className="heatmap-legend-gradient" />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Baixa</span>
        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>Alta</span>
        <div style={{ width: 16 }} />
        {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
          <span key={sev} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
            {sev}
          </span>
        ))}
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="heatmap-map"
        style={{ height: 480, borderRadius: 8, overflow: "hidden", position: "relative" }}
      />
    </div>
  );
}
