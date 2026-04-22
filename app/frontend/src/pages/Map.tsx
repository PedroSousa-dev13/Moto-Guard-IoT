import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useSocket } from "../hooks/useSocket";
import { MapPin, Navigation, Play, RotateCcw, ChevronDown, ChevronRight, Loader2, Crosshair, Search, X } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { GpxUploadTab } from "../components/gpx";
import { postGpxForParse } from "../utils/gpxParseClient";

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

const TYPE_MAP: Record<PresetRoute["type"], { text: string; bg: string; label: string }> = {
  urbano:      { text: "text-blue", bg: "bg-blue/15", label: "Urbano" },
  nacional:    { text: "text-orange", bg: "bg-orange/15", label: "Nacional" },
  autoestrada: { text: "text-purple", bg: "bg-purple/15", label: "Autoestrada" },
  serra:       { text: "text-green", bg: "bg-green/15", label: "Serra" },
  costeira:    { text: "text-cyan", bg: "bg-cyan/15", label: "Costeira" },
};

const DIFF_MAP: Record<PresetRoute["difficulty"], string> = {
  "fácil":   "text-green",
  "médio":   "text-orange",
  "difícil": "text-red",
};

// ─── Nominatim geocoding ──────────────────────────────────────────────────────
async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=pt`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt" } });
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

interface CustomPoint {
  lat: number;
  lng: number;
  label: string;
}

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
  // Track the last rendered GPX route to avoid re-fitting bounds on tab switch
  const lastRenderedGpxRouteRef = useRef<any | null>(null);

  // ── Preset routes state ──
  const [selectedRoute, setSelectedRoute] = useState<PresetRoute | null>(null);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set(["Vila Real"]));
  const [sent, setSent] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── Custom route state ──
  const [mode, setMode] = useState<"preset" | "custom" | "gpx">("preset");
  const [customStart, setCustomStart] = useState<CustomPoint | null>(null);
  const [customEnd, setCustomEnd] = useState<CustomPoint | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [geoLoading, setGeoLoading] = useState<"start" | "end" | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [customSent, setCustomSent] = useState(false);
  const [customLoadingPreview, setCustomLoadingPreview] = useState(false);
  // which point the next map click sets: null = none, "start" | "end"
  const [clickMode, setClickMode] = useState<"start" | "end" | null>(null);
  const clickModeRef = useRef<"start" | "end" | null>(null);
  const customStartRef = useRef<CustomPoint | null>(null);
  const customEndRef = useRef<CustomPoint | null>(null);

  // ── GPX upload state ──
  const [gpxRoute, setGpxRoute] = useState<any | null>(null);
  const [gpxUploading, setGpxUploading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [gpxProcessing, setGpxProcessing] = useState(false);
  const [gpxUploadProgress, setGpxUploadProgress] = useState(0);
  const [gpxSending, setGpxSending] = useState(false);
  const [gpxSent, setGpxSent] = useState(false);

  const lat = telemetry?.location?.latitude;
  const lng = telemetry?.location?.longitude;

  // Keep refs in sync
  useEffect(() => { clickModeRef.current = clickMode; }, [clickMode]);
  useEffect(() => { customStartRef.current = customStart; }, [customStart]);
  useEffect(() => { customEndRef.current = customEnd; }, [customEnd]);

  // ── Reverse geocode helper ──
  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "pt" } });
      const data = await res.json();
      return data?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  // ── Get current GPS location ──
  function useMyLocation(target: "start" | "end") {
    if (!navigator.geolocation) { setGeoError("Geolocalização não suportada neste browser."); return; }
    setGeoLoading(target);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        const point: CustomPoint = { lat: latitude, lng: longitude, label };
        if (target === "start") { setCustomStart(point); setStartInput(label.split(",")[0]); }
        else { setCustomEnd(point); setEndInput(label.split(",")[0]); }
        setGeoLoading(null);
        mapRef.current?.setView([latitude, longitude], 14, { animate: true });
      },
      (err) => {
        setGeoError(err.code === 1 ? "Permissão de localização negada." : "Não foi possível obter a localização.");
        setGeoLoading(null);
      },
      { timeout: 10000 }
    );
  }

  // ── Geocode search ──
  async function searchAddress(query: string, target: "start" | "end") {
    if (!query.trim()) return;
    setGeoLoading(target);
    setGeoError(null);
    const result = await geocode(query);
    if (!result) { setGeoError(`Endereço não encontrado: "${query}"`); setGeoLoading(null); return; }
    const point: CustomPoint = result;
    if (target === "start") { setCustomStart(point); setStartInput(query); }
    else { setCustomEnd(point); setEndInput(query); }
    setGeoLoading(null);
    mapRef.current?.setView([result.lat, result.lng], 14, { animate: true });
  }

  // ── Draw custom route preview ──
  const drawCustomPreview = useCallback(async (start: CustomPoint, end: CustomPoint) => {
    const map = mapRef.current;
    if (!map) return;
    previewLineRef.current?.remove();
    startDotRef.current?.remove();
    endDotRef.current?.remove();

    startDotRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 9, color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Início", { permanent: false });

    endDotRef.current = L.circleMarker([end.lat, end.lng], {
      radius: 9, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Fim", { permanent: false });

    setCustomLoadingPreview(true);
    const osrm = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    try {
      const r = await fetch(osrm);
      const data = await r.json();
      const coords: [number, number][] = (data?.routes?.[0]?.geometry?.coordinates ?? [])
        .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      if (coords.length >= 2) {
        previewLineRef.current = L.polyline(coords, { color: "#5b6af0", weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
      } else {
        previewLineRef.current = L.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: "#5b6af0", weight: 4, dashArray: "10 6" }).addTo(map);
      }
    } catch {
      previewLineRef.current = L.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: "#5b6af0", weight: 4, dashArray: "10 6" }).addTo(map);
    }
    setCustomLoadingPreview(false);
  }, []);

  // Trigger preview when both custom points are set
  useEffect(() => {
    if (mode !== "custom") return;
    if (customStart && customEnd) {
      void drawCustomPreview(customStart, customEnd);
    } else {
      previewLineRef.current?.remove();
      if (!customStart) startDotRef.current?.remove();
      if (!customEnd) endDotRef.current?.remove();
    }
  }, [customStart, customEnd, mode, drawCustomPreview]);

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

    // Click to set custom points
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const cm = clickModeRef.current;
      if (!cm) return;
      const { lat, lng } = e.latlng;
      const label = await (async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "pt" } });
          const data = await res.json();
          return (data?.display_name as string) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
      })();
      const point: CustomPoint = { lat, lng, label };
      if (cm === "start") {
        setCustomStart(point);
        setStartInput(label.split(",")[0]);
        setClickMode("end"); // auto-advance to end
      } else {
        setCustomEnd(point);
        setEndInput(label.split(",")[0]);
        setClickMode(null);
      }
    });

    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  // Cursor style when in click mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = clickMode ? "crosshair" : "";
  }, [clickMode]);

  // Clear previews and route state when switching tabs
  useEffect(() => {
    if (mode === "preset") {
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setClickMode(null);
      // Clear GPX state when leaving GPX tab
      setGpxRoute(null);
      setGpxError(null);
      setGpxSent(false);
      setGpxUploading(false);
      setGpxProcessing(false);
      setGpxUploadProgress(0);
      setGpxSending(false);
      lastRenderedGpxRouteRef.current = null;
    } else if (mode === "custom") {
      // Clear preset and GPX preview when switching to custom
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setSelectedRoute(null);
      setGpxRoute(null);
      setGpxError(null);
      setGpxSent(false);
      setGpxUploading(false);
      setGpxProcessing(false);
      setGpxUploadProgress(0);
      setGpxSending(false);
      lastRenderedGpxRouteRef.current = null;
    } else if (mode === "gpx") {
      // Clear preset and custom preview when switching to GPX
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setSelectedRoute(null);
      setClickMode(null);
    }
  }, [mode]);

  // ── GPX route rendering ──
  useEffect(() => {
    if (mode !== "gpx") return;
    const map = mapRef.current;

    // Clear previous preview
    previewLineRef.current?.remove(); previewLineRef.current = null;
    startDotRef.current?.remove(); startDotRef.current = null;
    endDotRef.current?.remove(); endDotRef.current = null;

    if (!gpxRoute?.waypoints?.length) return;

    const coords: [number, number][] = gpxRoute.waypoints.map(
      (wp: { latitude: number; longitude: number }) => [wp.latitude, wp.longitude]
    );
    if (coords.length < 2 || !map) return;

    const start = coords[0];
    const end = coords[coords.length - 1];

    startDotRef.current = L.circleMarker(start, {
      radius: 9, color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Início", { permanent: false });

    endDotRef.current = L.circleMarker(end, {
      radius: 9, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Fim", { permanent: false });

    previewLineRef.current = L.polyline(coords, {
      color: "#3b82f6", weight: 5, opacity: 0.85,
    }).addTo(map);

    // Only fit bounds when a new route is loaded, not when switching back to the tab
    const isNewRoute = lastRenderedGpxRouteRef.current !== gpxRoute;
    if (isNewRoute) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
      lastRenderedGpxRouteRef.current = gpxRoute;
    }
  }, [gpxRoute, mode]);

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

    if (!selectedRoute) {
      // Não limpar refs partilhadas em modo GPX ou rota personalizada — o efeito GPX/custom corre antes
      // e este efeito (declarado depois) apagava a polyline inteira, deixando só marcadores sobrepostos.
      if (mode !== "preset") return;

      previewLineRef.current?.remove();
      startDotRef.current?.remove();
      endDotRef.current?.remove();
      previewLineRef.current = null;
      startDotRef.current = null;
      endDotRef.current = null;
      return;
    }

    previewLineRef.current?.remove();
    startDotRef.current?.remove();
    endDotRef.current?.remove();
    previewLineRef.current = null;
    startDotRef.current = null;
    endDotRef.current = null;

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
  }, [selectedRoute, mode]);

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

  function useCustomRoute() {
    if (!customStart || !customEnd) return;
    const cmd = {
      acao: "definir_rota",
      route: {
        start: { latitude: customStart.lat, longitude: customStart.lng },
        end:   { latitude: customEnd.lat,   longitude: customEnd.lng },
        loop: false,
      },
    };
    sendCommand(cmd);
    localStorage.setItem("sim_route", JSON.stringify(cmd.route));
    setCustomSent(true);
    setTimeout(() => navigate("/simulator-contexts"), 800);
  }

  function clearCustomRoute() {
    setCustomStart(null); setCustomEnd(null);
    setStartInput(""); setEndInput("");
    setGeoError(null); setCustomSent(false);
    setClickMode(null);
    previewLineRef.current?.remove(); previewLineRef.current = null;
    startDotRef.current?.remove(); startDotRef.current = null;
    endDotRef.current?.remove(); endDotRef.current = null;
  }

  // ── GPX handling functions ──
  async function handleGpxFileSelect(file: File) {
    setGpxUploading(true);
    setGpxProcessing(true);
    setGpxUploadProgress(0);
    setGpxError(null);
    setGpxRoute(null);
    lastRenderedGpxRouteRef.current = null;

    try {
      const { status, body: result } = await postGpxForParse(file, {
        timeoutMs: 30000,
        onUploadProgress: (p) => setGpxUploadProgress(p),
        onUploadFinished: () => setGpxUploading(false),
      });

      if (status === 503) {
        setGpxError("Server is temporarily unavailable. Please try again later.");
        setGpxUploading(false);
        setGpxProcessing(false);
        setGpxUploadProgress(0);
        return;
      }

      if (!result.success) {
        const errorMsg =
          result.error || "Unable to process GPX file. Please check the file format.";
        const validationErrors = result.validationErrors?.join(", ") || "";
        setGpxError(validationErrors ? `${errorMsg}: ${validationErrors}` : errorMsg);
        setGpxUploading(false);
        setGpxProcessing(false);
        setGpxUploadProgress(0);
        return;
      }

      const route = result.route;
      const transformedRoute = {
        waypoints: route.waypoints.map((wp: any) => ({
          latitude: wp.lat,
          longitude: wp.lon,
          elevation: wp.ele,
          time: wp.time ? new Date(wp.time) : undefined,
        })),
        distanceKm: route.distanceKm,
        totalTimeSec: route.totalTimeSec,
        avgSpeedKmh: route.avgSpeedKmh,
        maxSpeedKmh: route.maxSpeedKmh,
        startedAt: route.startedAt ? new Date(route.startedAt) : undefined,
        endedAt: route.endedAt ? new Date(route.endedAt) : undefined,
        bounds: route.bounds
          ? {
              north: route.bounds.maxLat,
              south: route.bounds.minLat,
              east: route.bounds.maxLon,
              west: route.bounds.minLon,
            }
          : undefined,
        simulatorRoute: route.simulatorRoute,
      };

      setGpxRoute(transformedRoute);
      setGpxUploading(false);
      setGpxProcessing(false);
      setGpxUploadProgress(0);
    } catch (error) {
      console.error("Error uploading GPX file:", error);
      if (error instanceof Error && error.name === "AbortError") {
        setGpxError(
          "Pedido de upload interrompido (ligação cancelada ou página alterada). Tenta enviar o ficheiro outra vez."
        );
      } else {
        setGpxError("Upload failed. Please try again.");
      }
      setGpxUploading(false);
      setGpxProcessing(false);
      setGpxUploadProgress(0);
    }
  }

  function handleGpxError(error: string) {
    setGpxError(error.trim() === "" ? null : error);
  }

  function clearGpxRoute() {
    setGpxRoute(null);
    setGpxError(null);
    setGpxSent(false);
    setGpxProcessing(false);
    setGpxUploading(false);
    setGpxUploadProgress(0);
    setGpxSending(false);
    lastRenderedGpxRouteRef.current = null;
    
    // Clear map preview
    previewLineRef.current?.remove(); previewLineRef.current = null;
    startDotRef.current?.remove(); startDotRef.current = null;
    endDotRef.current?.remove(); endDotRef.current = null;
  }

  function sendGpxToSimulator() {
    if (!gpxRoute?.simulatorRoute) return;

    setGpxSending(true);
    const cmd = {
      acao: "definir_rota",
      route: gpxRoute.simulatorRoute,
    };
    sendCommand(cmd);
    localStorage.setItem("sim_route", JSON.stringify(cmd.route));
    setGpxSent(true);
    setTimeout(() => {
      setGpxSending(false);
      navigate("/simulator-contexts");
    }, 800);
  }

  function handleGpxMapRender(waypoints: any[]) {
    const map = mapRef.current;
    if (!map || !waypoints || waypoints.length === 0) return;

    // Clear previous preview
    previewLineRef.current?.remove();
    startDotRef.current?.remove();
    endDotRef.current?.remove();

    const coords: [number, number][] = waypoints.map(wp => [wp.latitude, wp.longitude]);
    
    // Draw start/end markers
    const start = coords[0];
    const end = coords[coords.length - 1];
    
    startDotRef.current = L.circleMarker(start, {
      radius: 9, color: "#16a34a", fillColor: "#22c55e", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Início", { permanent: false });

    endDotRef.current = L.circleMarker(end, {
      radius: 9, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip("Fim", { permanent: false });

    // Draw route line
    previewLineRef.current = L.polyline(coords, {
      color: "#5b6af0", weight: 5, opacity: 0.85,
    }).addTo(map);

    // Fit map to route bounds
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
  }

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)] animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <MapPin size={22} />
            </span>
            Planeador de Rotas
          </h1>
          <p className="text-muted font-medium text-sm mt-1">Seleciona uma rota oficial ou define o teu próprio percurso para a simulação.</p>
        </div>

        {/* MODE TOGGLE */}
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl shadow-inner shrink-0">
          <button
            className={`px-5 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${mode === "preset" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text"}`}
            onClick={() => setMode("preset")}
          >Rotas Oficiais</button>
          <button
            className={`px-5 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${mode === "custom" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text"}`}
            onClick={() => setMode("custom")}
          >Personalizada</button>
          <button
            className={`px-5 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${mode === "gpx" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text"}`}
            onClick={() => setMode("gpx")}
          >GPX Upload</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 flex-1 min-h-0">
        {/* SIDE PANELS */}
        <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl relative min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50" />
          
          {mode === "preset" ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
              {DISTRICTS.map(district => (
                <div key={district.name} className="flex flex-col gap-2">
                  <button
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group"
                    onClick={() => toggleDistrict(district.name)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white tracking-tight group-hover:text-accent transition-colors">{district.name}</span>
                      <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">{district.region}</span>
                    </div>
                    {expandedDistricts.has(district.name)
                      ? <ChevronDown size={18} className="text-muted" />
                      : <ChevronRight size={18} className="text-muted" />}
                  </button>

                  {expandedDistricts.has(district.name) && (
                    <div className="flex flex-col gap-2 pl-2">
                      {district.routes.map(route => (
                        <button
                          key={route.id}
                          className={`w-full p-4 rounded-xl border transition-all text-left flex flex-col gap-2 ${selectedRoute?.id === route.id ? "bg-accent/10 border-accent/40 shadow-lg" : "bg-black/20 border-white/5 hover:border-white/10"}`}
                          onClick={() => selectRoute(route)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.8rem] font-black text-white leading-tight">{route.name}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[0.55rem] font-black uppercase tracking-widest shrink-0 ${TYPE_MAP[route.type].bg} ${TYPE_MAP[route.type].text}`}>
                              {TYPE_MAP[route.type].label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
                            <span className="flex items-center gap-1"><Navigation size={10} /> {route.distance}</span>
                            <span className="flex items-center gap-1">⏱ {route.duration}</span>
                            <span className={`flex items-center gap-1 ${DIFF_MAP[route.difficulty]}`}>● {route.difficulty}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : mode === "custom" ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              <div>
                <div className="flex items-center gap-2 text-white font-black tracking-tight mb-2">
                  <Navigation size={18} className="text-accent" />
                  <span>Definir Percurso</span>
                </div>
                <p className="text-[0.75rem] font-medium text-muted leading-relaxed">
                  Pesquisa um endereço, usa a tua localização atual ou clica no mapa para definir os pontos.
                </p>
              </div>

              {/* Origin */}
              <div className="flex flex-col gap-4 p-5 rounded-3xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-green">
                  <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  Origem
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-black/20 border border-white/5 rounded-xl py-2.5 px-4 text-xs font-bold text-text focus:outline-none focus:border-accent/40 placeholder:text-muted/40 transition-all"
                      placeholder="Pesquisar endereço..."
                      value={startInput}
                      onChange={e => setStartInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchAddress(startInput, "start")}
                    />
                    <button
                      className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted hover:bg-white/10 hover:text-text transition-all disabled:opacity-30"
                      onClick={() => searchAddress(startInput, "start")}
                      disabled={geoLoading === "start"}
                    >
                      {geoLoading === "start" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                    <button
                      className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all disabled:opacity-30"
                      onClick={() => useMyLocation("start")}
                      disabled={geoLoading === "start"}
                    >
                      <Crosshair size={16} />
                    </button>
                  </div>
                  <button
                    className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${clickMode === "start" ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-muted hover:text-text hover:bg-white/10"}`}
                    onClick={() => setClickMode(prev => prev === "start" ? null : "start")}
                  >
                    <MapPin size={14} />
                    {clickMode === "start" ? "A aguardar clique..." : "Clicar no mapa"}
                  </button>
                  {customStart && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green/5 border border-green/10">
                      <span className="text-[0.7rem] font-bold text-green/80 truncate pr-2">{customStart.label.split(",").slice(0, 2).join(",")}</span>
                      <button className="text-muted hover:text-red transition-colors" onClick={() => { setCustomStart(null); setStartInput(""); }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div className="flex flex-col gap-4 p-5 rounded-3xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-red">
                  <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
                  Destino
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-black/20 border border-white/5 rounded-xl py-2.5 px-4 text-xs font-bold text-text focus:outline-none focus:border-accent/40 placeholder:text-muted/40 transition-all"
                      placeholder="Pesquisar endereço..."
                      value={endInput}
                      onChange={e => setEndInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchAddress(endInput, "end")}
                    />
                    <button
                      className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted hover:bg-white/10 hover:text-text transition-all disabled:opacity-30"
                      onClick={() => searchAddress(endInput, "end")}
                      disabled={geoLoading === "end"}
                    >
                      {geoLoading === "end" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                    <button
                      className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all disabled:opacity-30"
                      onClick={() => useMyLocation("end")}
                      disabled={geoLoading === "end"}
                    >
                      <Crosshair size={16} />
                    </button>
                  </div>
                  <button
                    className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${clickMode === "end" ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "bg-white/5 border-white/10 text-muted hover:text-text hover:bg-white/10"}`}
                    onClick={() => setClickMode(prev => prev === "end" ? null : "end")}
                  >
                    <MapPin size={14} />
                    {clickMode === "end" ? "A aguardar clique..." : "Clicar no mapa"}
                  </button>
                  {customEnd && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red/5 border border-red/10">
                      <span className="text-[0.7rem] font-bold text-red/80 truncate pr-2">{customEnd.label.split(",").slice(0, 2).join(",")}</span>
                      <button className="text-muted hover:text-red transition-colors" onClick={() => { setCustomEnd(null); setEndInput(""); }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {geoError && <div className="p-3 rounded-xl bg-red/10 border border-red/20 text-red text-[0.7rem] font-bold">{geoError}</div>}

              {customStart && customEnd && (
                <div className="flex gap-3 pt-2">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-[0.65rem] font-black uppercase tracking-widest text-muted hover:text-text transition-all" onClick={clearCustomRoute}>
                    <RotateCcw size={14} /> Limpar
                  </button>
                  <button
                    className={`flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-[0.65rem] font-black uppercase tracking-widest transition-all shadow-xl ${customSent ? "bg-green text-white shadow-green/20" : "bg-accent text-white shadow-accent/20"}`}
                    onClick={useCustomRoute}
                    disabled={customLoadingPreview}
                  >
                    {customLoadingPreview
                      ? <><Loader2 size={14} className="animate-spin" /> Calculando...</>
                      : <><Play size={14} />{customSent ? "Enviada ✓" : "Usar Rota"}</>
                    }
                  </button>
                </div>
              )}
            </div>
          ) : (
            <GpxUploadTab
              isActive={mode === "gpx"}
              gpxRoute={gpxRoute}
              gpxUploading={gpxUploading}
              gpxError={gpxError}
              gpxProcessing={gpxProcessing}
              gpxSending={gpxSending}
              gpxSent={gpxSent}
              uploadProgress={gpxUploadProgress}
              onFileSelect={handleGpxFileSelect}
              onClearRoute={clearGpxRoute}
              onSendToSimulator={sendGpxToSimulator}
              onError={handleGpxError}
              onMapRender={handleGpxMapRender}
            />
          )}
        </div>

        {/* MAP AREA */}
        <div className="relative flex flex-col gap-6 overflow-hidden">
          <div className="relative flex-1 bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group">
            <div ref={containerRef} className="w-full h-full z-0" />
            
            {/* MAP OVERLAYS */}
            {mode === "preset" && !selectedRoute && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10 animate-fade-in">
                <div className="text-7xl opacity-50">🗺️</div>
                <div className="text-center flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-white tracking-tight m-0">Seleciona uma rota</h3>
                  <p className="text-sm font-medium text-muted max-w-xs m-0">Escolhe um percurso na lista lateral para pré-visualizar aqui.</p>
                </div>
              </div>
            )}
            {mode === "custom" && !customStart && !customEnd && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10 animate-fade-in">
                <div className="text-7xl opacity-50">📍</div>
                <div className="text-center flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-white tracking-tight m-0">Define o teu percurso</h3>
                  <p className="text-sm font-medium text-muted max-w-xs m-0">Pesquisa endereços ou clica diretamente no mapa para marcar pontos.</p>
                </div>
              </div>
            )}
            {mode === "gpx" && !gpxRoute && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10 animate-fade-in">
                <div className="text-7xl opacity-50">📁</div>
                <div className="text-center flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-white tracking-tight m-0">Carrega um ficheiro GPX</h3>
                  <p className="text-sm font-medium text-muted max-w-xs m-0">Importa rotas externas para simular em trajetos reais.</p>
                </div>
              </div>
            )}

            {/* LOADING OVERLAY */}
            {(loadingPreview || customLoadingPreview || (mode === "gpx" && (gpxUploading || gpxProcessing))) && (
              <div className="absolute top-6 right-6 flex items-center gap-3 px-5 py-3 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl text-white text-xs font-black uppercase tracking-widest z-50 animate-bounce-subtle">
                <Loader2 size={16} className="animate-spin text-accent" />
                {mode === "gpx" && gpxUploading ? "A enviar..." : mode === "gpx" && gpxProcessing ? "A processar..." : "A calcular..."}
              </div>
            )}

            {/* CLICK MODE HINT */}
            {clickMode && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 bg-accent text-white rounded-[2rem] shadow-2xl shadow-accent/40 text-sm font-black uppercase tracking-[0.1em] z-50 flex items-center gap-3 animate-fade-in">
                <MapPin size={18} />
                Clica no mapa para definir {clickMode === "start" ? "A ORIGEM 🟢" : "O DESTINO 🔴"}
              </div>
            )}
          </div>

          {/* ROUTE DETAIL BAR (PRESET) */}
          {mode === "preset" && selectedRoute && (
            <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shrink-0 animate-slide-up">
              <div className="flex-1 flex flex-col gap-2">
                <div className="text-xl font-black text-white tracking-tight leading-none">{selectedRoute.name}</div>
                <div className="text-sm font-medium text-muted leading-relaxed max-w-2xl">{selectedRoute.description}</div>
                <div className="flex flex-wrap items-center gap-6 mt-1 text-[0.7rem] font-black uppercase tracking-widest text-muted">
                  <span className="flex items-center gap-1.5"><Navigation size={14} className="text-accent" /> {selectedRoute.distance}</span>
                  <span className="flex items-center gap-1.5 opacity-60">⏱ {selectedRoute.duration}</span>
                  <span className={`flex items-center gap-1.5 ${TYPE_MAP[selectedRoute.type].text}`}>
                    ● {TYPE_MAP[selectedRoute.type].label}
                  </span>
                  <span className={`flex items-center gap-1.5 ${DIFF_MAP[selectedRoute.difficulty]}`}>
                    ● {selectedRoute.difficulty}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-muted uppercase tracking-widest hover:text-text hover:bg-white/10 transition-all" onClick={() => { setSelectedRoute(null); setSent(false); }}>
                  <RotateCcw size={16} /> Limpar
                </button>
                <button
                  className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${sent ? "bg-green text-white shadow-green/20" : "bg-accent text-white shadow-accent/20 hover:scale-105"}`}
                  onClick={useRoute}
                >
                  <Play size={16} />
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
