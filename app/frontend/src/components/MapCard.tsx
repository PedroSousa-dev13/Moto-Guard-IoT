import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { LocationData, TelemetryData, SimulatorCommand, IMUData } from "../types/telemetry";
import Card from "./ui/Card";
import { MapPin, Navigation, Trash2, Map as MapIcon, Send, Layers, Eye, Compass } from 'lucide-react';

// Fix ícone default do Leaflet
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
  imu?: IMUData | null;
  msgCount: number;
  resetSignal?: number;
  routeSignal?: number;
  sendCommand: (cmd: SimulatorCommand) => void;
  onRouteStartChange?: (coords: { lat: number; lng: number } | null) => void;
}

const DEFAULT_LAT = 41.2951;
const DEFAULT_LNG = -7.7463;

// Rota padrão: Vila Real, ~1.5 km, ~80 segundos a 1x (velocidade média ~65 km/h)
// Percurso: Centro → Av. Carvalho Araújo → Rotunda Norte
const DEFAULT_ROUTE = {
  start: { latitude: 41.2951, longitude: -7.7463 },
  end:   { latitude: 41.3045, longitude: -7.7388 },
  loop: false,
};

export default function MapCard({ location, telemetry, imu, msgCount, resetSignal, routeSignal, sendCommand, onRouteStartChange }: MapCardProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<L.LatLngTuple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const endMarkerRef = useRef<L.CircleMarker | null>(null);
  const selectionLineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [pilotMode, setPilotMode] = useState(false);
  
  const lat = location?.latitude ?? DEFAULT_LAT;
  const lng = location?.longitude ?? DEFAULT_LNG;
  const yaw = imu?.yaw_deg ?? 0;

  const hasLiveLocation =
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location?.longitude === "number" &&
    Number.isFinite(location.longitude);

  // ── Ler rota do localStorage (lazy init para evitar race condition) ──
  function readStoredRoute(): { start: L.LatLngTuple | null; end: L.LatLngTuple | null } {
    try {
      const raw = localStorage.getItem("sim_route");
      if (!raw) return { start: null, end: null };
      const route = JSON.parse(raw);
      const start: L.LatLngTuple | null =
        typeof route?.start?.latitude === "number" && typeof route?.start?.longitude === "number"
          ? [route.start.latitude, route.start.longitude]
          : null;
      const end: L.LatLngTuple | null =
        typeof route?.end?.latitude === "number" && typeof route?.end?.longitude === "number"
          ? [route.end.latitude, route.end.longitude]
          : null;
      return { start, end };
    } catch { return { start: null, end: null }; }
  }

  const storedRoute = readStoredRoute();
  const [routeStart, setRouteStart] = useState<L.LatLngTuple | null>(storedRoute.start);
  const [routeEnd, setRouteEnd] = useState<L.LatLngTuple | null>(storedRoute.end);
  const routeStartRef = useRef<L.LatLngTuple | null>(storedRoute.start);
  const routeEndRef = useRef<L.LatLngTuple | null>(storedRoute.end);

  useEffect(() => {
    routeStartRef.current = routeStart;
    onRouteStartChange?.(routeStart ? { lat: routeStart[0], lng: routeStart[1] } : null);
  }, [routeStart]);

  useEffect(() => {
    routeEndRef.current = routeEnd;
  }, [routeEnd]);

  // ── Reagir a nova rota enviada (routeSignal) ──────────────────────────
  useEffect(() => {
    if (!routeSignal) return;
    try {
      const raw = localStorage.getItem("sim_route");
      if (!raw) return;
      const route = JSON.parse(raw);
      const start: L.LatLngTuple | null =
        typeof route?.start?.latitude === "number" && typeof route?.start?.longitude === "number"
          ? [route.start.latitude, route.start.longitude] : null;
      const end: L.LatLngTuple | null =
        typeof route?.end?.latitude === "number" && typeof route?.end?.longitude === "number"
          ? [route.end.latitude, route.end.longitude] : null;
      if (start) {
        setRouteStart(start);
        if (mapRef.current) mapRef.current.setView(start, 15, { animate: true });
      }
      if (end) setRouteEnd(end);
    } catch { /* ignorar */ }
  }, [routeSignal]);

  // ── Alternar Tipo de Mapa ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const url = mapType === 'satellite' 
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    
    const attribution = mapType === 'satellite'
      ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      : "&copy; OpenStreetMap";

    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(mapRef.current);
  }, [mapType]);

  // ── Inicializar mapa ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Ler rota guardada para centrar o mapa no ponto de partida desde o início
    let initialLat = DEFAULT_LAT;
    let initialLng = DEFAULT_LNG;
    let storedStart: L.LatLngTuple | null = null;
    let storedEnd: L.LatLngTuple | null = null;
    try {
      const raw = localStorage.getItem("sim_route");
      console.log("🗺️ MapCard init - localStorage:", raw);
      if (raw) {
        const route = JSON.parse(raw);
        console.log("🗺️ MapCard init - parsed route:", route);
        if (typeof route?.start?.latitude === "number" && typeof route?.start?.longitude === "number") {
          initialLat = route.start.latitude;
          initialLng = route.start.longitude;
          storedStart = [route.start.latitude, route.start.longitude];
          console.log("🗺️ MapCard init - using coordinates:", { initialLat, initialLng });
        }
        if (typeof route?.end?.latitude === "number" && typeof route?.end?.longitude === "number") {
          storedEnd = [route.end.latitude, route.end.longitude];
        }
      } else {
        console.log("🗺️ MapCard init - no route in localStorage, using default VR");
      }
    } catch (err) { 
      console.error("🗺️ MapCard init - localStorage parse error:", err);
    }
    
    // Calcular zoom baseado na distância entre pontos (se ambos existirem)
    let initialZoom = 15;
    if (storedStart && storedEnd) {
      const latDiff = Math.abs(storedStart[0] - storedEnd[0]);
      const lngDiff = Math.abs(storedStart[1] - storedEnd[1]);
      const maxDiff = Math.max(latDiff, lngDiff);
      if (maxDiff > 0.1) initialZoom = 11;      // Rotas longas (>10km)
      else if (maxDiff > 0.05) initialZoom = 13; // Rotas médias (5-10km)
      else if (maxDiff > 0.01) initialZoom = 14; // Rotas curtas (1-5km)
      else initialZoom = 16;                     // Rotas muito curtas (<1km)
    }
    
    console.log("🗺️ MapCard init - final setView:", { initialLat, initialLng, initialZoom });
    const map = L.map(containerRef.current, {
      zoomControl: false, 
    }).setView([initialLat, initialLng], initialZoom);
    
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Adicionar o TileLayer inicial (Streets)
    tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
       attribution: "&copy; OpenStreetMap",
       maxZoom: 19,
     }).addTo(map);

    // Criar marker na posição inicial da rota (se existir) ou default
    const markerPos: L.LatLngTuple = storedStart || [DEFAULT_LAT, DEFAULT_LNG];
    const marker = L.marker(markerPos, { opacity: storedStart ? 1 : 0 })
      .addTo(map)
      .bindPopup("MotoGuard IoT");

    const trail = L.polyline([], { 
      color: "#3b82f6", 
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    trailRef.current = trail;

    // ── Desenhar círculos de início/fim se já existir rota guardada ──
    if (storedStart) {
      startMarkerRef.current = L.circleMarker(storedStart, {
        radius: 7, color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.9, weight: 2,
      }).addTo(map);
    }
    if (storedEnd) {
      endMarkerRef.current = L.circleMarker(storedEnd, {
        radius: 7, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2,
      }).addTo(map);
    }
    if (storedStart && storedEnd) {
      // Desenhar linha tracejada inicial (será substituída pela OSRM se disponível)
      selectionLineRef.current = L.polyline([storedStart, storedEnd], {
        color: "#f97316", weight: 3, dashArray: "6 6",
      }).addTo(map);
      
      // Tentar buscar geometria real da rota via OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${storedStart[1]},${storedStart[0]};${storedEnd[1]},${storedEnd[0]}?overview=full&geometries=geojson`;
      fetch(osrmUrl)
        .then(r => r.json())
        .then(data => {
          if (!mapRef.current || !selectionLineRef.current) return;
          const coords: [number, number][] = (data?.routes?.[0]?.geometry?.coordinates ?? [])
            .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          if (coords.length >= 2) {
            // Substituir linha tracejada por geometria real
            selectionLineRef.current.remove();
            selectionLineRef.current = L.polyline(coords, {
              color: "#3b82f6", weight: 4, opacity: 0.8,
            }).addTo(mapRef.current);
          }
        })
        .catch(() => {
          // Manter linha tracejada se OSRM falhar
        });
    }

    const onClick = (e: L.LeafletMouseEvent) => {
      // Se estivermos a arrastar um ponto, não fazemos nada no clique normal
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

    // ── Suporte para Drag and Drop dos botões ──────────────────────────
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer?.getData("pointType");
      if (!type || !mapRef.current) return;

      // Usar o método nativo do Leaflet para converter o evento de rato em coordenadas
      // Isto é muito mais fiável que calcular manualmente os offsets
      try {
        const latlng = mapRef.current.mouseEventToLatLng(e);
        const pos: L.LatLngTuple = [latlng.lat, latlng.lng];

        if (type === "start") {
          setRouteStart(pos);
        } else if (type === "end") {
          setRouteEnd(pos);
        }
      } catch (err) {
        console.error("Erro ao processar drop no mapa:", err);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
    };

    const mapWrapper = containerRef.current?.parentElement;
    mapWrapper?.addEventListener("dragover", handleDragOver);
    mapWrapper?.addEventListener("drop", handleDrop);

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);
    
    // Chamadas agressivas de invalidateSize para evitar mapa cinza
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 500);
    const t3 = setTimeout(handleResize, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
      const mapWrapper = containerRef.current?.parentElement;
      mapWrapper?.removeEventListener("dragover", handleDragOver);
      mapWrapper?.removeEventListener("drop", handleDrop);
      resizeObserver.disconnect();
      map.off("click", onClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Atualizar posição e Rotação (Pilot Mode) ──────────────────────────
  useEffect(() => {
    console.log("🔄 Position update effect triggered:", { hasLiveLocation, lat, lng, msgCount, routeStart, pilotMode });
    
    if (!mapRef.current || !markerRef.current || !trailRef.current) return;

    if (!hasLiveLocation && !routeStart) {
      console.log("🔄 No live location and no route start - hiding marker");
      markerRef.current.setOpacity(0);
      return;
    }

    const pos: L.LatLngTuple = hasLiveLocation ? [lat, lng] : routeStart!;
    console.log("🔄 Setting marker to position:", pos);
    markerRef.current.setOpacity(1);
    markerRef.current.setLatLng(pos);

    if (hasLiveLocation) {
      console.log("🔄 Has live location - updating trail and potentially moving map");
      trailPointsRef.current.push([lat, lng]);
      if (trailPointsRef.current.length > 500) trailPointsRef.current.shift();
      trailRef.current.setLatLngs(trailPointsRef.current);

      // Só mover o mapa se há telemetria real (não usar defaults)
      if (pilotMode) {
        console.log("🔄 Pilot mode - setView to:", pos);
        mapRef.current.setView(pos, mapRef.current.getZoom(), { animate: false });
      } else if (msgCount % 5 === 0) {
        console.log("🔄 Normal mode - panTo:", pos);
        mapRef.current.panTo(pos, { animate: true, duration: 0.5 });
      }
    } else {
      console.log("🔄 No live location but has route start - keeping map position");
    }
    // Se não há telemetria mas há routeStart, não mover o mapa (manter na posição da rota)
  }, [hasLiveLocation, lat, lng, msgCount, routeStart, pilotMode]);

  useEffect(() => {
    console.log("🔄 Reset signal effect triggered:", resetSignal);
    if (!resetSignal || !mapRef.current || !markerRef.current || !trailRef.current) return;
    
    // Só fazer reset se não há rota guardada (reset explícito)
    const hasStoredRoute = localStorage.getItem("sim_route");
    if (hasStoredRoute) {
      console.log("🔄 Reset ignored - has stored route");
      return;
    }
    
    console.log("🔄 Performing reset to Vila Real");
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

  const handleDragStart = (e: React.DragEvent, type: "start" | "end") => {
      e.dataTransfer.setData("pointType", type);
      e.dataTransfer.effectAllowed = "move";
      
      // Criar imagem customizada para o drag (o waypoint verde ou vermelho)
      const dragIcon = document.createElement("div");
      dragIcon.style.width = "24px";
      dragIcon.style.height = "24px";
      dragIcon.style.backgroundColor = type === "start" ? "#16a34a" : "#ef4444";
      dragIcon.style.borderRadius = "50%";
      dragIcon.style.border = "3px solid white";
      dragIcon.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
      dragIcon.style.position = "absolute";
      dragIcon.style.top = "-1000px"; // Esconder o original
      document.body.appendChild(dragIcon);
      
      e.dataTransfer.setDragImage(dragIcon, 12, 12);
      
      // Remover o elemento temporário após o início do drag
      setTimeout(() => document.body.removeChild(dragIcon), 0);
    };

    return (
      <Card 
        title="Localização & Rota" 
        className="map-card"
        headerActions={
          <div className="map-toolbar">
            <button 
              className={`btn-icon ${pilotMode ? 'active' : ''}`} 
              onClick={() => setPilotMode(!pilotMode)}
              title="Modo Piloto (Seguir & Rodar)"
            >
              <Compass size={18} />
            </button>
            <button 
              className={`btn-icon ${mapType === 'satellite' ? 'active' : ''}`} 
              onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
              title="Vista de Satélite"
            >
              <Layers size={18} />
            </button>
            <div className="map-badge-odometer">
              <Navigation size={12} />
              {(telemetry?.odometer_km ?? 0).toFixed(2)} km
            </div>
          </div>
        }
      >
        <div className="map-container-wrapper">
          <div 
            ref={containerRef} 
            id="map" 
            style={{ 
              transform: pilotMode ? `rotate(${-yaw}deg)` : 'none',
              transition: 'transform 0.5s ease-out'
            }} 
          />
          
          {/* Marcador central no modo piloto para não rodar com o mapa */}
          {pilotMode && (
            <div className="pilot-center-marker">
              <div className="bike-arrow" style={{ transform: 'rotate(0deg)' }}>▲</div>
            </div>
          )}
        </div>
        
        <div className="map-controls">
          <div className="map-coordinates">
            <div className="coord-item">
              <span className="coord-label">LAT</span>
              <span className="coord-value">{lat.toFixed(6)}</span>
            </div>
            <div className="coord-item">
              <span className="coord-label">LNG</span>
              <span className="coord-value">{lng.toFixed(6)}</span>
            </div>
          </div>

          <div className="route-selection">
            <div className="route-points">
              <div 
                className={`route-point draggable ${routeStart ? 'active' : ''}`}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, "start")}
                title="Arraste para o mapa para definir o Início"
              >
                <MapPin size={14} className="start-icon" />
                <span>{routeStart ? 'Início' : 'Início'}</span>
              </div>
              <div 
                className={`route-point draggable ${routeEnd ? 'active' : ''}`}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, "end")}
                title="Arraste para o mapa para definir o Fim"
              >
                <MapPin size={14} className="end-icon" />
                <span>{routeEnd ? 'Fim' : 'Fim'}</span>
              </div>
            </div>
          
          <div className="route-actions">
            <button className="btn btn-sm btn-ghost" onClick={clearRouteSelection} title="Limpar">
              <Trash2 size={16} />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                localStorage.setItem("sim_route", JSON.stringify(DEFAULT_ROUTE));
                sendCommand({ acao: "definir_rota", route: DEFAULT_ROUTE });
                clearRouteSelection();
                onRouteStartChange?.({ lat: DEFAULT_ROUTE.start.latitude, lng: DEFAULT_ROUTE.start.longitude });
                if (trailRef.current) {
                  trailPointsRef.current = [];
                  trailRef.current.setLatLngs([]);
                }
                if (mapRef.current) {
                  mapRef.current.setView([DEFAULT_ROUTE.start.latitude, DEFAULT_ROUTE.start.longitude], 15);
                }
              }}
            >
              <MapIcon size={16} />
              <span>Padrão</span>
            </button>
            <button 
              className="btn btn-sm btn-primary" 
              onClick={sendRouteToSimulator} 
              disabled={!routeStart || !routeEnd}
            >
              <Send size={16} />
              <span>Enviar Rota</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
