import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import { alertsAPI } from "../services/api";
import { Loader2, MapPin, Filter, Activity, ShieldAlert, Layers } from "lucide-react";

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

  // Safely verify that map is loaded and container exists to avoid unmount crashes
  try {
    if (!(map as any)._loaded || !map.getContainer()) {
      return;
    }
  } catch (e) {
    return;
  }

  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  if (points.length === 0) return;

  // Draw each point as a radial gradient
  for (const pt of points) {
    let pos;
    try {
      pos = map.latLngToContainerPoint([pt.lat, pt.lng]);
    } catch (e) {
      continue;
    }
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
  try {
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      if (alpha > 0) {
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
  } catch (e) {
    // ignore canvas manipulation errors during teardown
  }
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

  const pointsRef = useRef<{ lat: number; lng: number; weight: number }[]>([]);
  const layerRef = useRef<any>(null);
  const showHeatmapRef = useRef(showHeatmap);
  const radiusRef = useRef(radius);

  // Sync state refs so they are always up-to-date in Leaflet event handlers without closure issues
  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
    radiusRef.current = radius;
  }, [showHeatmap, radius]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit: 500 };
      if (selectedType !== "ALL") params.type = selectedType;
      if (selectedSeverity !== "ALL") params.severity = selectedSeverity;
      const res = await alertsAPI.getAll(params as any);
      let data: AlertEvent[] = res.data;

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

  // Insights computation
  const stats = useMemo(() => {
    const geoEvents = events.filter(e => e.latitude != null && e.longitude != null);
    const byType: Record<string, number> = {};
    const bySev: Record<string, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    
    events.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      bySev[e.severity] = (bySev[e.severity] || 0) + 1;
    });

    const sortedTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total: events.length, geoTotal: geoEvents.length, byType: sortedTypes, bySev };
  }, [events]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([39.5, -8.0], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

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
        this._updateListener = () => this._update();
        m.on("viewreset moveend zoomend resize", this._updateListener);
        this._update();
      },
      onRemove(m: L.Map) {
        canvasRef.current?.remove();
        if (this._updateListener) {
          try {
            m.off("viewreset moveend zoomend resize", this._updateListener);
          } catch (e) {
            // ignore
          }
        }
      },
      _update() {
        try {
          if (!this._map || !(this._map as any)._loaded || !this._map.getContainer()) {
            return;
          }
          const map = this._map;
          const size = map.getSize();
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = size.x;
            canvas.height = size.y;
            
            const topLeft = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(canvas, topLeft);
            
            if (showHeatmapRef.current) {
              drawHeatmap(canvas, map, pointsRef.current, radiusRef.current);
            } else {
              const ctx = canvas.getContext("2d");
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        } catch (e) {
          // ignore
        }
      },
    });

    const layer = new (CanvasLayer as any)();
    layer.addTo(map);
    layerRef.current = layer;
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

  useEffect(() => {
    const geoEvents = events.filter((e) => e.latitude != null && e.longitude != null);
    pointsRef.current = geoEvents.map((e) => ({
      lat: e.latitude!,
      lng: e.longitude!,
      weight: e.severity === "CRITICAL" ? 1 : e.severity === "WARNING" ? 0.6 : 0.3,
    }));
    layerRef.current?._update();
  }, [events, showHeatmap, radius]);

  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer || !mapRef.current || !(mapRef.current as any)._loaded) return;

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

  return (
    <div className="heatmap-layout" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px" }}>
      <div className="event-heatmap-wrapper" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Toolbar */}
        <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Filter size={16} color="var(--muted)" />
            <select
              className="control control-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: "150px" }}
            >
              <option value="ALL">Todos Tipos</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <select
              className="control control-sm"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{ width: "130px" }}
            >
              <option value="ALL">Severidades</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
              <span>Heatmap</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} />
              <span>Pontos</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--muted)" }}>Raio:</span>
              <input type="range" min={15} max={80} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: "60px" }} />
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div style={{ position: "relative", flex: 1, minHeight: "500px", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          
          {/* Map Overlay Stats */}
          <div style={{ position: "absolute", bottom: "16px", left: "16px", zIndex: 1000, pointerEvents: "none" }}>
            <div className="glass-panel" style={{ padding: "8px 12px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={14} color="var(--accent)" />
              <strong>{stats.geoTotal}</strong> eventos localizados
            </div>
          </div>

          {/* Legend */}
          <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 1000 }}>
            <div className="glass-panel" style={{ padding: "10px", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontWeight: 700, marginBottom: "2px" }}>DENSIDADE</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Baixa</span>
                <div style={{ width: "60px", height: "8px", borderRadius: "4px", background: "linear-gradient(to right, #0000ff, #00ff00, #ffff00, #ff0000)" }} />
                <span>Alta</span>
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Loader2 className="animate-spin" />
                <span>A processar mapa...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Insights */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Activity size={18} color="var(--accent)" />
            <h4 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Incidentes</h4>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {stats.byType.length === 0 && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sem dados no período</div>}
            {stats.byType.map(([type, count]) => (
              <div key={type} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{TYPE_LABELS[type] || type}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
                <div style={{ width: "100%", height: "4px", background: "var(--border)", borderRadius: "2px" }}>
                  <div style={{ width: `${(count / stats.total) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <ShieldAlert size={18} color="var(--accent)" />
            <h4 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Por Severidade</h4>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(stats.bySev).map(([sev, count]) => (
              <div key={sev} className="tile" style={{ padding: "10px 14px", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: SEVERITY_COLORS[sev] }} />
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{sev}</span>
                </div>
                <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Layers size={18} color="var(--accent)" />
            <h4 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Filtro Temporal</h4>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="field">
              <label className="field-label">Desde</label>
              <input type="date" className="control control-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Até</label>
              <input type="date" className="control control-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
