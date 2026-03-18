// =============================================================================
// MapCard — Mapa GPS com Leaflet (marcador + trilho da rota)
// =============================================================================

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { LocationData, TelemetryData, SimulatorCommand } from "../types/telemetry";

// Fix ícone default do Leaflet (bug conhecido com bundlers)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapCardProps {
  location: LocationData | null;
  telemetry: TelemetryData | null;
  msgCount: number;
  resetSignal?: number;
  sendCommand: (cmd: SimulatorCommand) => void;
}

const DEFAULT_LAT = 41.2951;
const DEFAULT_LNG = -7.7463;

export default function MapCard({ location, telemetry, msgCount, resetSignal, sendCommand }: MapCardProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<L.LatLngTuple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const endMarkerRef = useRef<L.CircleMarker | null>(null);
  const selectionLineRef = useRef<L.Polyline | null>(null);

  const lat = location?.latitude ?? DEFAULT_LAT;
  const lng = location?.longitude ?? DEFAULT_LNG;

  const hasLiveLocation =
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location?.longitude === "number" &&
    Number.isFinite(location.longitude);

  const [routeStart, setRouteStart] = useState<L.LatLngTuple | null>(null);
  const [routeEnd, setRouteEnd] = useState<L.LatLngTuple | null>(null);
  const routeStartRef = useRef<L.LatLngTuple | null>(null);
  const routeEndRef = useRef<L.LatLngTuple | null>(null);

  useEffect(() => {
    routeStartRef.current = routeStart;
  }, [routeStart]);

  useEffect(() => {
    routeEndRef.current = routeEnd;
  }, [routeEnd]);

  // ── Inicializar mapa ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([DEFAULT_LAT, DEFAULT_LNG], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { opacity: 0 })
      .addTo(map)
      .bindPopup("MotoGuard IoT");

    const trail = L.polyline([], { color: "#3b82f6", weight: 3 }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    trailRef.current = trail;

    const onClick = (e: L.LeafletMouseEvent) => {
      const next: L.LatLngTuple = [e.latlng.lat, e.latlng.lng];
      const start = routeStartRef.current;
      const end = routeEndRef.current;
      if (!start) {
        setRouteStart(next);
        setRouteEnd(null);
        return;
      }
      if (!end) {
        setRouteEnd(next);
        return;
      }
      setRouteEnd(next);
    };
    map.on("click", onClick);

    // Fix tamanho do mapa (bug Leaflet em containers hidden)
    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.off("click", onClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Atualizar posição ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;

    if (!hasLiveLocation && !routeStart) {
      markerRef.current.setOpacity(0);
      return;
    }

    const pos: L.LatLngTuple = hasLiveLocation ? [lat, lng] : routeStart!;
    markerRef.current.setOpacity(1);
    markerRef.current.setLatLng(pos);

    if (hasLiveLocation) {
      trailPointsRef.current.push([lat, lng]);
      if (trailPointsRef.current.length > 500) trailPointsRef.current.shift();
      trailRef.current.setLatLngs(trailPointsRef.current);
    }

    // Centrar a cada 5 mensagens
    if (msgCount % 5 === 0) {
      mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [hasLiveLocation, lat, lng, msgCount, routeStart]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;
    trailPointsRef.current = [];
    trailRef.current.setLatLngs([]);
    markerRef.current.setLatLng([DEFAULT_LAT, DEFAULT_LNG]);
    mapRef.current.setView([DEFAULT_LAT, DEFAULT_LNG], 15);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
    setRouteStart(null);
    setRouteEnd(null);
  }, [resetSignal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }
    if (selectionLineRef.current) {
      selectionLineRef.current.remove();
      selectionLineRef.current = null;
    }

    if (routeStart) {
      startMarkerRef.current = L.circleMarker(routeStart, {
        radius: 7,
        color: "#16a34a",
        fillColor: "#22c55e",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);
    }
    if (routeEnd) {
      endMarkerRef.current = L.circleMarker(routeEnd, {
        radius: 7,
        color: "#b91c1c",
        fillColor: "#ef4444",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);
    }
    if (routeStart && routeEnd) {
      selectionLineRef.current = L.polyline([routeStart, routeEnd], {
        color: "#f97316",
        weight: 3,
        dashArray: "6 6",
      }).addTo(map);
    }
  }, [routeEnd, routeStart]);

  function clearRouteSelection() {
    setRouteStart(null);
    setRouteEnd(null);
    localStorage.removeItem("sim_route");
    if (trailRef.current) {
      trailPointsRef.current = [];
      trailRef.current.setLatLngs([]);
    }
    if (markerRef.current) {
      if (!hasLiveLocation) markerRef.current.setOpacity(0);
    }
  }

  function sendRouteToSimulator() {
    if (!routeStart || !routeEnd) return;
    localStorage.setItem(
      "sim_route",
      JSON.stringify({
        start: { latitude: routeStart[0], longitude: routeStart[1] },
        end: { latitude: routeEnd[0], longitude: routeEnd[1] },
        loop: false,
      })
    );
    sendCommand({
      acao: "definir_rota",
      route: {
        start: { latitude: routeStart[0], longitude: routeStart[1] },
        end: { latitude: routeEnd[0], longitude: routeEnd[1] },
        loop: false,
      },
    });
    if (trailRef.current) {
      trailPointsRef.current = [];
      trailRef.current.setLatLngs([]);
    }
    if (markerRef.current) {
      markerRef.current.setLatLng(routeStart);
    }
    if (mapRef.current) {
      mapRef.current.setView(routeStart, 15);
      setTimeout(() => mapRef.current?.invalidateSize(), 200);
    }
  }

  return (
    <div className="card map-card">
      <h2>📍 Localização GPS</h2>
      <div ref={containerRef} id="map" />
      <div className="map-info">
        <div className="info-row">
          <span className="key">Latitude</span>
          <span className="val">{lat.toFixed(6)}</span>
        </div>
        <div className="info-row">
          <span className="key">Longitude</span>
          <span className="val">{lng.toFixed(6)}</span>
        </div>
        <div className="info-row">
          <span className="key">Odómetro</span>
          <span className="val">{(telemetry?.odometer_km ?? 0).toFixed(2)} km</span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="info-row">
          <span className="key">Início</span>
          <span className="val">
            {routeStart ? `${routeStart[0].toFixed(6)}, ${routeStart[1].toFixed(6)}` : "—"}
          </span>
        </div>
        <div className="info-row">
          <span className="key">Fim</span>
          <span className="val">
            {routeEnd ? `${routeEnd[0].toFixed(6)}, ${routeEnd[1].toFixed(6)}` : "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="cmd-btn" onClick={clearRouteSelection}>
            Limpar seleção
          </button>
          <button
            className="cmd-btn"
            onClick={() => {
              sendCommand({ acao: "reset_rota" });
              localStorage.removeItem("sim_route");
              clearRouteSelection();
            }}
          >
            Usar rota padrão
          </button>
          <button className="cmd-btn" onClick={sendRouteToSimulator} disabled={!routeStart || !routeEnd}>
            Enviar trajeto (OSRM)
          </button>
        </div>
      </div>
    </div>
  );
}
