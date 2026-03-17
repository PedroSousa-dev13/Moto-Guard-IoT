import { useEffect, useRef } from "react";
import L from "leaflet";
import { useSocket } from "../hooks/useSocket";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix icone Leaflet (bug conhecido com bundlers)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_LAT = 41.2951;
const DEFAULT_LNG = -7.7463;

export default function Map() {
  const { telemetry, msgCount, status, devices, activeDeviceId, setActiveDeviceId } = useSocket();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<L.LatLngTuple[]>([]);

  const lat = telemetry?.location?.latitude ?? DEFAULT_LAT;
  const lng = telemetry?.location?.longitude ?? DEFAULT_LNG;

  // Inicializar mapa uma vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(
      [DEFAULT_LAT, DEFAULT_LNG],
      15,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG])
      .addTo(map)
      .bindPopup("MotoGuard IoT");
    const trail = L.polyline([], { color: "#3b82f6", weight: 3 }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    trailRef.current = trail;

    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar posicao com cada mensagem de telemetria
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;

    markerRef.current.setLatLng([lat, lng]);

    trailPointsRef.current.push([lat, lng]);
    if (trailPointsRef.current.length > 1000) trailPointsRef.current.shift();
    trailRef.current.setLatLngs(trailPointsRef.current);

    if (msgCount % 5 === 0) {
      mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, msgCount]);

  useEffect(() => {
    if (!trailRef.current) return;
    trailPointsRef.current = [];
    trailRef.current.setLatLngs([]);
  }, [activeDeviceId]);

  return (
    <div className="page page-full map-page">
      <div className="page-header">
        <div>
          <div className="page-title">🗺️ Mapa em Tempo Real</div>
          <div className="page-subtitle">Posição e trilho ao vivo</div>
        </div>
        <div className="page-actions">
          {devices.length > 1 && (
            <select
              className="control control-sm"
              value={activeDeviceId ?? ""}
              onChange={(e) => setActiveDeviceId(e.target.value)}
              style={{ width: 220 }}
            >
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <StatusPill active={status.mqtt} label="MQTT" />
          <StatusPill active={status.ws} label="WebSocket" />
        </div>
      </div>

      {/* Info bar */}
      <div className="tile-grid">
        {[
          {
            label: "Velocidade",
            val: telemetry
              ? `${telemetry.telemetry.speed_kmh.toFixed(0)} km/h`
              : "—",
            color: "var(--accent)",
          },
          { label: "Latitude", val: lat.toFixed(6), color: "var(--text)" },
          { label: "Longitude", val: lng.toFixed(6), color: "var(--text)" },
          {
            label: "Odometro",
            val: telemetry
              ? `${telemetry.telemetry.odometer_km.toFixed(2)} km`
              : "—",
            color: "var(--text)",
          },
          {
            label: "Modelo",
            val: telemetry?.system?.moto_model ?? "—",
            color: "var(--text)",
          },
          {
            label: "Msgs",
            val: msgCount.toString(),
            color: "var(--green)",
          },
        ].map(({ label, val, color }) => (
          <div key={label} className="tile">
            <div className="tile-k">{label}</div>
            <div className="tile-v" style={{ color }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Mapa */}
      <div className="map-shell">
        <div ref={containerRef} className="map-canvas" />

        {/* Overlay quando sem dados */}
        {!status.hasData && (
          <div className="map-overlay">
            <div className="map-overlay-icon">📡</div>
            <div className="map-overlay-title">A aguardar dados de telemetria...</div>
            <div className="map-overlay-text">Garante que o simulador está a correr.</div>
          </div>
        )}
      </div>

      {/* Trail info */}
      {trailPointsRef.current.length > 0 && (
        <div className="map-trail">
          Trilho: {trailPointsRef.current.length} pontos registados
        </div>
      )}
    </div>
  );
}

function StatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`pill ${active ? "pill-success" : "pill-danger"}`}
    >
      {label} {active ? "✓" : "✗"}
    </span>
  );
}
