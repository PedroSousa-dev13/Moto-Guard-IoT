import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useSocket } from "../hooks/useSocket";
import { MapPin, Navigation, Play, RotateCcw, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// ─── Rotas pré-definidas por distrito ────────────────────────────────────────
interface PresetRoute {
  id: string;
  name: string;
  description: string;
  distance: string;
  duration: string;
  type: "urbano" | "nacional" | "autoestrada" | "serra" | "costeira";
  difficulty: "fácil" | "médio" | "difícil";
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  center: [number, number];
  zoom: number;
}

interface District {
  name: string;
  region: string;
  routes: PresetRoute[];
}

const DISTRICTS: District[] = [
  {
    name: "Vila Real",
    region: "Trás-os-Montes",
    routes: [
      {
        id: "vr-centro-univ",
        name: "Centro → Universidade",
        description: "Percurso urbano pelo centro histórico de Vila Real até à UTAD.",
        distance: "1.3 km", duration: "~2 min",
        type: "urbano", difficulty: "fácil",
        start: { lat: 41.2951, lng: -7.7463 },
        end:   { lat: 41.3045, lng: -7.7388 },
        center: [41.2998, -7.7426], zoom: 15,
      },
      {
        id: "vr-mateus",
        name: "Vila Real → Mateus",
        description: "Nacional pela Quinta de Mateus, paisagem vinhateira do Douro.",
        distance: "4.2 km", duration: "~5 min",
        type: "nacional", difficulty: "fácil",
        start: { lat: 41.2951, lng: -7.7463 },
        end:   { lat: 41.3180, lng: -7.7050 },
        center: [41.3065, -7.7257], zoom: 14,
      },
      {
        id: "vr-sabrosa",
        name: "Vila Real → Sabrosa",
        description: "Nacional sinuosa pela serra do Marão, curvas técnicas e paisagem de altitude.",
        distance: "13 km", duration: "~15 min",
        type: "serra", difficulty: "difícil",
        start: { lat: 41.2951, lng: -7.7463 },
        end:   { lat: 41.2700, lng: -7.5800 },
        center: [41.2826, -7.6632], zoom: 12,
      },
    ],
  },
  {
    name: "Porto",
    region: "Grande Porto",
    routes: [
      {
        id: "porto-ribeira-foz",
        name: "Ribeira → Foz do Douro",
        description: "Marginal do Douro desde a Ribeira até à Foz, vista sobre o rio.",
        distance: "6.5 km", duration: "~10 min",
        type: "urbano", difficulty: "fácil",
        start: { lat: 41.1408, lng: -8.6140 },
        end:   { lat: 41.1510, lng: -8.6760 },
        center: [41.1459, -8.6450], zoom: 14,
      },
      {
        id: "porto-circunvalacao",
        name: "Circunvalação Norte",
        description: "Anel viário norte do Porto, tráfego misto e vias rápidas.",
        distance: "11 km", duration: "~12 min",
        type: "nacional", difficulty: "médio",
        start: { lat: 41.1760, lng: -8.5980 },
        end:   { lat: 41.1850, lng: -8.6600 },
        center: [41.1805, -8.6290], zoom: 13,
      },
      {
        id: "porto-a28-matosinhos",
        name: "Porto → Matosinhos (A28)",
        description: "Autoestrada litoral até Matosinhos, velocidades elevadas.",
        distance: "9 km", duration: "~8 min",
        type: "autoestrada", difficulty: "fácil",
        start: { lat: 41.1579, lng: -8.6291 },
        end:   { lat: 41.1833, lng: -8.6980 },
        center: [41.1706, -8.6636], zoom: 13,
      },
    ],
  },
  {
    name: "Braga",
    region: "Minho",
    routes: [
      {
        id: "braga-centro-bom-jesus",
        name: "Centro → Bom Jesus",
        description: "Subida ao santuário do Bom Jesus, estrada sinuosa com declive.",
        distance: "5.8 km", duration: "~8 min",
        type: "serra", difficulty: "médio",
        start: { lat: 41.5454, lng: -8.4265 },
        end:   { lat: 41.5530, lng: -8.3780 },
        center: [41.5492, -8.4023], zoom: 14,
      },
      {
        id: "braga-guimaraes",
        name: "Braga → Guimarães",
        description: "Nacional entre as duas cidades históricas do Minho.",
        distance: "22 km", duration: "~22 min",
        type: "nacional", difficulty: "fácil",
        start: { lat: 41.5454, lng: -8.4265 },
        end:   { lat: 41.4425, lng: -8.2918 },
        center: [41.4940, -8.3592], zoom: 12,
      },
    ],
  },
  {
    name: "Lisboa",
    region: "Grande Lisboa",
    routes: [
      {
        id: "lisboa-belem-cascais",
        name: "Belém → Cascais",
        description: "Marginal de Lisboa, estrada costeira com vista para o Tejo e Atlântico.",
        distance: "30 km", duration: "~30 min",
        type: "costeira", difficulty: "fácil",
        start: { lat: 38.6970, lng: -9.2060 },
        end:   { lat: 38.6979, lng: -9.4215 },
        center: [38.6975, -9.3138], zoom: 12,
      },
      {
        id: "lisboa-sintra",
        name: "Lisboa → Sintra",
        description: "IC19 e estradas da serra de Sintra, curvas técnicas e paisagem.",
        distance: "28 km", duration: "~28 min",
        type: "serra", difficulty: "médio",
        start: { lat: 38.7223, lng: -9.1393 },
        end:   { lat: 38.7978, lng: -9.3900 },
        center: [38.7601, -9.2647], zoom: 12,
      },
      {
        id: "lisboa-a2-setubal",
        name: "Lisboa → Setúbal (A2)",
        description: "Autoestrada sul, travessia da Ponte 25 de Abril e planície alentejana.",
        distance: "48 km", duration: "~35 min",
        type: "autoestrada", difficulty: "fácil",
        start: { lat: 38.7223, lng: -9.1393 },
        end:   { lat: 38.5244, lng: -8.8882 },
        center: [38.6234, -9.0138], zoom: 11,
      },
    ],
  },
  {
    name: "Faro",
    region: "Algarve",
    routes: [
      {
        id: "faro-lagos",
        name: "Faro → Lagos",
        description: "EN125 pelo Algarve, estrada nacional com aldeias e paisagem mediterrânica.",
        distance: "75 km", duration: "~60 min",
        type: "nacional", difficulty: "médio",
        start: { lat: 37.0194, lng: -7.9322 },
        end:   { lat: 37.1028, lng: -8.6731 },
        center: [37.0611, -8.3027], zoom: 11,
      },
      {
        id: "faro-monchique",
        name: "Portimão → Monchique",
        description: "Subida à serra de Monchique, estrada de montanha com curvas fechadas.",
        distance: "24 km", duration: "~25 min",
        type: "serra", difficulty: "difícil",
        start: { lat: 37.1359, lng: -8.5380 },
        end:   { lat: 37.3190, lng: -8.5500 },
        center: [37.2275, -8.5440], zoom: 12,
      },
    ],
  },
  {
    name: "Coimbra",
    region: "Centro",
    routes: [
      {
        id: "coimbra-lousã",
        name: "Coimbra → Lousã",
        description: "Nacional pela serra da Lousã, floresta densa e curvas técnicas.",
        distance: "28 km", duration: "~28 min",
        type: "serra", difficulty: "difícil",
        start: { lat: 40.2033, lng: -8.4103 },
        end:   { lat: 40.1100, lng: -8.2490 },
        center: [40.1567, -8.3297], zoom: 12,
      },
      {
        id: "coimbra-aveiro",
        name: "Coimbra → Aveiro (A1)",
        description: "Autoestrada entre as duas cidades universitárias.",
        distance: "55 km", duration: "~38 min",
        type: "autoestrada", difficulty: "fácil",
        start: { lat: 40.2033, lng: -8.4103 },
        end:   { lat: 40.6443, lng: -8.6455 },
        center: [40.4238, -8.5279], zoom: 11,
      },
    ],
  },
];

const TYPE_COLORS: Record<PresetRoute["type"], string> = {
  urbano:      "#3b82f6",
  nacional:    "#f97316",
  autoestrada: "#8b5cf6",
  serra:       "#22c55e",
  costeira:    "#06b6d4",
};

const TYPE_LABELS: Record<PresetRoute["type"], string> = {
  urbano:      "Urbano",
  nacional:    "Nacional",
  autoestrada: "Autoestrada",
  serra:       "Serra",
  costeira:    "Costeira",
};

const DIFF_COLORS: Record<PresetRoute["difficulty"], string> = {
  "fácil":   "#22c55e",
  "médio":   "#f97316",
  "difícil": "#ef4444",
};

export default function Map() {
  const { telemetry, msgCount, sendCommand } = useSocket();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPointsRef = useRef<L.LatLngTuple[]>([]);
  const previewLineRef = useRef<L.Polyline | null>(null);
  const startDotRef = useRef<L.CircleMarker | null>(null);
  const endDotRef = useRef<L.CircleMarker | null>(null);

  const [selectedRoute, setSelectedRoute] = useState<PresetRoute | null>(null);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set(["Vila Real"]));
  const [sent, setSent] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const lat = telemetry?.location?.latitude;
  const lng = telemetry?.location?.longitude;

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([39.5, -8.0], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([39.5, -8.0]).addTo(map).bindPopup("MotoGuard");
    const trail = L.polyline([], { color: "#3b82f6", weight: 3, opacity: 0.7 }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;
    trailRef.current = trail;
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  // Live position
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current || !lat || !lng) return;
    markerRef.current.setLatLng([lat, lng]);
    trailPointsRef.current.push([lat, lng]);
    if (trailPointsRef.current.length > 1000) trailPointsRef.current.shift();
    trailRef.current.setLatLngs(trailPointsRef.current);
  }, [lat, lng, msgCount]);

  // Preview selected route — fetch real geometry from OSRM
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous preview
    previewLineRef.current?.remove();
    startDotRef.current?.remove();
    endDotRef.current?.remove();
    previewLineRef.current = null;
    startDotRef.current = null;
    endDotRef.current = null;

    if (!selectedRoute) return;

    const { start, end, center, zoom } = selectedRoute;
    map.setView(center, zoom, { animate: true });

    // Draw start/end dots immediately
    startDotRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 9, color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Início", { permanent: false });

    endDotRef.current = L.circleMarker([end.lat, end.lng], {
      radius: 9, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Fim", { permanent: false });

    // Fetch real route geometry from OSRM
    setLoadingPreview(true);
    const osrm = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    let cancelled = false;

    fetch(osrm)
      .then(r => r.json())
      .then(data => {
        if (cancelled || !mapRef.current) return;
        const coords: [number, number][] = (data?.routes?.[0]?.geometry?.coordinates ?? [])
          .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
        if (coords.length >= 2) {
          previewLineRef.current = L.polyline(coords, {
            color: "#3b82f6", weight: 5, opacity: 0.85,
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
        } else {
          // Fallback: straight dashed line
          previewLineRef.current = L.polyline(
            [[start.lat, start.lng], [end.lat, end.lng]],
            { color: "#3b82f6", weight: 4, dashArray: "10 6", opacity: 0.7 }
          ).addTo(mapRef.current);
        }
      })
      .catch(() => {
        if (cancelled || !mapRef.current) return;
        // Fallback on error
        previewLineRef.current = L.polyline(
          [[start.lat, start.lng], [end.lat, end.lng]],
          { color: "#3b82f6", weight: 4, dashArray: "10 6", opacity: 0.7 }
        ).addTo(mapRef.current);
      })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });

    return () => { cancelled = true; };
  }, [selectedRoute]);

  function toggleDistrict(name: string) {
    setExpandedDistricts(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function selectRoute(route: PresetRoute) {
    setSelectedRoute(route);
    setSent(false);
  }

  function useRoute() {
    if (!selectedRoute) return;
    const cmd = {
      acao: "definir_rota",
      route: {
        start: { latitude: selectedRoute.start.lat, longitude: selectedRoute.start.lng },
        end:   { latitude: selectedRoute.end.lat,   longitude: selectedRoute.end.lng },
        loop: false,
      },
    };
    sendCommand(cmd);
    localStorage.setItem("sim_route", JSON.stringify(cmd.route));
    setSent(true);
    setTimeout(() => navigate("/simulator-contexts"), 800);
  }

  return (
    <div className="page page-full map-routes-page">
      <div className="page-header">
        <div>
          <div className="page-title"><MapPin size={20} style={{ marginRight: 8 }} />Rotas de Simulação</div>
          <div className="page-subtitle">Seleciona uma rota para preview e envia para o simulador</div>
        </div>
      </div>

      <div className="map-routes-layout">

        {/* ── Painel esquerdo: lista de rotas ── */}
        <div className="routes-panel">
          <div className="routes-panel-inner">
            {DISTRICTS.map(district => (
              <div key={district.name} className="district-group">
                <button
                  className="district-header"
                  onClick={() => toggleDistrict(district.name)}
                >
                  <span className="district-name">{district.name}</span>
                  <span className="district-region">{district.region}</span>
                  {expandedDistricts.has(district.name)
                    ? <ChevronDown size={16} className="district-chevron" />
                    : <ChevronRight size={16} className="district-chevron" />}
                </button>

                {expandedDistricts.has(district.name) && (
                  <div className="district-routes">
                    {district.routes.map(route => (
                      <button
                        key={route.id}
                        className={`route-card${selectedRoute?.id === route.id ? " selected" : ""}`}
                        onClick={() => selectRoute(route)}
                      >
                        <div className="route-card-top">
                          <span className="route-name">{route.name}</span>
                          <span
                            className="route-type-badge"
                            style={{ background: TYPE_COLORS[route.type] + "22", color: TYPE_COLORS[route.type] }}
                          >
                            {TYPE_LABELS[route.type]}
                          </span>
                        </div>
                        <div className="route-card-meta">
                          <span>{route.distance}</span>
                          <span>{route.duration}</span>
                          <span style={{ color: DIFF_COLORS[route.difficulty] }}>● {route.difficulty}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Mapa ── */}
        <div className="map-routes-right">
          <div className="map-shell" style={{ flex: 1, minHeight: 0 }}>
            <div ref={containerRef} className="map-canvas" style={{ minHeight: 0, height: "100%" }} />
            {!selectedRoute && (
              <div className="map-overlay">
                <div className="map-overlay-icon">🗺️</div>
                <div className="map-overlay-title">Seleciona uma rota</div>
                <div className="map-overlay-text">Escolhe um percurso na lista para ver o preview aqui.</div>
              </div>
            )}
            {loadingPreview && (
              <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: "0.8rem", zIndex: 1000 }}>
                <Loader2 size={14} className="animate-spin" /> A carregar rota...
              </div>
            )}
          </div>

          {/* Info da rota selecionada */}
          {selectedRoute && (
            <div className="route-detail-bar">
              <div className="route-detail-info">
                <div className="route-detail-name">{selectedRoute.name}</div>
                <div className="route-detail-desc">{selectedRoute.description}</div>
                <div className="route-detail-stats">
                  <span><Navigation size={13} /> {selectedRoute.distance}</span>
                  <span>⏱ {selectedRoute.duration}</span>
                  <span style={{ color: TYPE_COLORS[selectedRoute.type] }}>
                    ● {TYPE_LABELS[selectedRoute.type]}
                  </span>
                  <span style={{ color: DIFF_COLORS[selectedRoute.difficulty] }}>
                    ● {selectedRoute.difficulty}
                  </span>
                </div>
              </div>
              <div className="route-detail-actions">
                <button className="btn" onClick={() => { setSelectedRoute(null); setSent(false); }}>
                  <RotateCcw size={14} /> Limpar
                </button>
                <button
                  className={`btn ${sent ? "btn-success" : "btn-primary"}`}
                  onClick={useRoute}
                >
                  <Play size={14} />
                  {sent ? "Rota enviada ✓" : "Usar esta rota"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
