// =============================================================================
// MapCard — Mapa GPS com Leaflet (marcador + trilho da rota)
// =============================================================================

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LocationData, TelemetryData } from "../types/telemetry";

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
}

const DEFAULT_LAT = 41.2951;
const DEFAULT_LNG = -7.7463;

export default function MapCard({ location, telemetry, msgCount, resetSignal }: MapCardProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<L.LatLngTuple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const lat = location?.latitude ?? DEFAULT_LAT;
  const lng = location?.longitude ?? DEFAULT_LNG;

  // ── Inicializar mapa ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([DEFAULT_LAT, DEFAULT_LNG], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([DEFAULT_LAT, DEFAULT_LNG])
      .addTo(map)
      .bindPopup("MotoGuard IoT")
      .openPopup();

    const trail = L.polyline([], { color: "#3b82f6", weight: 3 }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    trailRef.current = trail;

    // Fix tamanho do mapa (bug Leaflet em containers hidden)
    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Atualizar posição ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;

    markerRef.current.setLatLng([lat, lng]);

    trailPointsRef.current.push([lat, lng]);
    if (trailPointsRef.current.length > 500) trailPointsRef.current.shift();
    trailRef.current.setLatLngs(trailPointsRef.current);

    // Centrar a cada 5 mensagens
    if (msgCount % 5 === 0) {
      mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [lat, lng, msgCount]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;
    trailPointsRef.current = [];
    trailRef.current.setLatLngs([]);
    markerRef.current.setLatLng([DEFAULT_LAT, DEFAULT_LNG]);
    mapRef.current.setView([DEFAULT_LAT, DEFAULT_LNG], 15);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }, [resetSignal]);

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
    </div>
  );
}
