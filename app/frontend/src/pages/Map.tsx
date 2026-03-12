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
  const { telemetry, msgCount, status } = useSocket();

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

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "calc(100vh - 60px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          🗺️ Mapa em Tempo Real
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <StatusPill active={status.mqtt} label="MQTT" />
          <StatusPill active={status.ws} label="WebSocket" />
        </div>
      </div>

      {/* Info bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "8px",
        }}
      >
        {[
          {
            label: "Velocidade",
            val: telemetry
              ? `${telemetry.telemetry.speed_kmh.toFixed(0)} km/h`
              : "—",
            color: "#3b82f6",
          },
          { label: "Latitude", val: lat.toFixed(6), color: "#e4e4e7" },
          { label: "Longitude", val: lng.toFixed(6), color: "#e4e4e7" },
          {
            label: "Odometro",
            val: telemetry
              ? `${telemetry.telemetry.odometer_km.toFixed(2)} km`
              : "—",
            color: "#e4e4e7",
          },
          {
            label: "Modelo",
            val: telemetry?.system?.moto_model ?? "—",
            color: "#e4e4e7",
          },
          {
            label: "Msgs",
            val: msgCount.toString(),
            color: "#22c55e",
          },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: "#1a1d27",
              border: "1px solid #2a2d3a",
              borderRadius: "8px",
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "4px",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color,
                fontSize: "0.9rem",
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Mapa */}
      <div
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: "#1a1d27",
          border: "1px solid #2a2d3a",
          borderRadius: "12px",
          overflow: "hidden",
          minHeight: "350px",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Overlay quando sem dados */}
        {!status.hasData && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(15,17,23,0.75)",
              backdropFilter: "blur(4px)",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "2.5rem" }}>📡</div>
            <p style={{ color: "#71717a", fontWeight: 500 }}>
              A aguardar dados de telemetria...
            </p>
            <p style={{ color: "#52525b", fontSize: "0.8rem" }}>
              Garante que o simulador esta a correr.
            </p>
          </div>
        )}
      </div>

      {/* Trail info */}
      {trailPointsRef.current.length > 0 && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#52525b",
            textAlign: "center",
          }}
        >
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
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: "20px",
        backgroundColor: active
          ? "rgba(34,197,94,0.15)"
          : "rgba(239,68,68,0.15)",
        color: active ? "#22c55e" : "#ef4444",
      }}
    >
      {label} {active ? "✓" : "✗"}
    </span>
  );
}
