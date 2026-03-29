import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useSocket } from "../hooks/useSocket";
import { MapPin, Navigation, Play, RotateCcw, ChevronDown, ChevronRight, Loader2, Crosshair, Search, X } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { GpxUploadTab } from "../components/gpx";

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

  // Clear custom preview when switching to preset mode
  useEffect(() => {
    if (mode === "preset") {
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setClickMode(null);
    } else if (mode === "custom") {
      // Clear preset and GPX preview when switching to custom
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setSelectedRoute(null);
      setGpxRoute(null);
    } else if (mode === "gpx") {
      // Clear preset and custom preview when switching to GPX
      previewLineRef.current?.remove(); previewLineRef.current = null;
      startDotRef.current?.remove(); startDotRef.current = null;
      endDotRef.current?.remove(); endDotRef.current = null;
      setSelectedRoute(null);
      setClickMode(null);
    }
  }, [mode]);

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
  function handleGpxFileSelect(file: File) {
    setGpxUploading(true);
    setGpxError(null);
    
    // TODO: Implement actual file upload and parsing
    // For now, simulate the upload process
    setTimeout(() => {
      setGpxUploading(false);
      setGpxError("GPX parsing not yet implemented");
    }, 1000);
  }

  function handleGpxError(error: string) {
    setGpxError(error);
  }

  function clearGpxRoute() {
    setGpxRoute(null);
    setGpxError(null);
    setGpxSent(false);
    setGpxProcessing(false);
    setGpxUploading(false);
    
    // Clear map preview
    previewLineRef.current?.remove(); previewLineRef.current = null;
    startDotRef.current?.remove(); startDotRef.current = null;
    endDotRef.current?.remove(); endDotRef.current = null;
  }

  function sendGpxToSimulator() {
    if (!gpxRoute) return;
    
    setGpxProcessing(true);
    
    // TODO: Implement actual GPX to simulator conversion
    // For now, simulate the process
    setTimeout(() => {
      setGpxProcessing(false);
      setGpxSent(true);
      setTimeout(() => navigate("/simulator-contexts"), 800);
    }, 1500);
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
    <div className="page page-full map-routes-page">
      <div className="page-header">
        <div>
          <div className="page-title"><MapPin size={20} style={{ marginRight: 8 }} />Rotas de Simulação</div>
          <div className="page-subtitle">Seleciona uma rota ou define o teu próprio percurso</div>
        </div>
        {/* Mode toggle */}
        <div className="map-mode-toggle">
          <button
            className={`map-mode-btn${mode === "preset" ? " active" : ""}`}
            onClick={() => setMode("preset")}
          >Rotas Pré-definidas</button>
          <button
            className={`map-mode-btn${mode === "custom" ? " active" : ""}`}
            onClick={() => setMode("custom")}
          >Rota Personalizada</button>
          <button
            className={`map-mode-btn${mode === "gpx" ? " active" : ""}`}
            onClick={() => setMode("gpx")}
          >GPX Upload</button>
        </div>
      </div>

      <div className="map-routes-layout">

        {/* ── Painel esquerdo ── */}
        {mode === "preset" ? (
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
        ) : mode === "custom" ? (
          /* ── Custom route panel ── */
          <div className="routes-panel custom-route-panel">
            <div className="custom-route-inner">
              <div className="custom-route-title">
                <Navigation size={16} />
                Definir Percurso
              </div>
              <p className="custom-route-hint">
                Pesquisa um endereço, usa a tua localização atual ou clica no mapa para definir os pontos.
              </p>

              {/* Origin */}
              <div className="custom-point-group">
                <div className="custom-point-label origin-label">
                  <span className="point-dot green-dot" />
                  Origem
                </div>
                <div className="custom-point-inputs">
                  <div className="custom-search-row">
                    <input
                      className="control control-sm"
                      placeholder="Pesquisar endereço..."
                      value={startInput}
                      onChange={e => setStartInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchAddress(startInput, "start")}
                    />
                    <button
                      className="btn btn-sm"
                      title="Pesquisar"
                      onClick={() => searchAddress(startInput, "start")}
                      disabled={geoLoading === "start"}
                    >
                      {geoLoading === "start" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      title="Usar localização atual"
                      onClick={() => useMyLocation("start")}
                      disabled={geoLoading === "start"}
                    >
                      <Crosshair size={14} />
                    </button>
                  </div>
                  <button
                    className={`btn btn-sm btn-block${clickMode === "start" ? " btn-active-click" : ""}`}
                    onClick={() => setClickMode(prev => prev === "start" ? null : "start")}
                  >
                    <MapPin size={13} />
                    {clickMode === "start" ? "A aguardar clique no mapa..." : "Clicar no mapa"}
                  </button>
                  {customStart && (
                    <div className="custom-point-result">
                      <span className="custom-point-addr">{customStart.label.split(",").slice(0, 2).join(",")}</span>
                      <button className="btn-icon-clear" onClick={() => { setCustomStart(null); setStartInput(""); }}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="custom-route-divider" />

              {/* Destination */}
              <div className="custom-point-group">
                <div className="custom-point-label dest-label">
                  <span className="point-dot red-dot" />
                  Destino
                </div>
                <div className="custom-point-inputs">
                  <div className="custom-search-row">
                    <input
                      className="control control-sm"
                      placeholder="Pesquisar endereço..."
                      value={endInput}
                      onChange={e => setEndInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchAddress(endInput, "end")}
                    />
                    <button
                      className="btn btn-sm"
                      title="Pesquisar"
                      onClick={() => searchAddress(endInput, "end")}
                      disabled={geoLoading === "end"}
                    >
                      {geoLoading === "end" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      title="Usar localização atual"
                      onClick={() => useMyLocation("end")}
                      disabled={geoLoading === "end"}
                    >
                      <Crosshair size={14} />
                    </button>
                  </div>
                  <button
                    className={`btn btn-sm btn-block${clickMode === "end" ? " btn-active-click" : ""}`}
                    onClick={() => setClickMode(prev => prev === "end" ? null : "end")}
                  >
                    <MapPin size={13} />
                    {clickMode === "end" ? "A aguardar clique no mapa..." : "Clicar no mapa"}
                  </button>
                  {customEnd && (
                    <div className="custom-point-result">
                      <span className="custom-point-addr">{customEnd.label.split(",").slice(0, 2).join(",")}</span>
                      <button className="btn-icon-clear" onClick={() => { setCustomEnd(null); setEndInput(""); }}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {geoError && <div className="alert alert-danger" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>{geoError}</div>}

              {customStart && customEnd && (
                <div className="custom-route-actions">
                  <button className="btn btn-sm" onClick={clearCustomRoute}>
                    <RotateCcw size={13} /> Limpar
                  </button>
                  <button
                    className={`btn btn-sm ${customSent ? "btn-success" : "btn-primary"}`}
                    onClick={useCustomRoute}
                    disabled={customLoadingPreview}
                  >
                    {customLoadingPreview
                      ? <><Loader2 size={13} className="animate-spin" /> A calcular...</>
                      : <><Play size={13} />{customSent ? "Rota enviada ✓" : "Usar esta rota"}</>
                    }
                  </button>
                </div>
              )}

              {clickMode && (
                <div className="click-mode-hint">
                  Clica no mapa para definir o ponto de {clickMode === "start" ? "origem" : "destino"}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── GPX upload panel ── */
          <GpxUploadTab
            isActive={mode === "gpx"}
            gpxRoute={gpxRoute}
            gpxUploading={gpxUploading}
            gpxError={gpxError}
            gpxProcessing={gpxProcessing}
            gpxSent={gpxSent}
            onFileSelect={handleGpxFileSelect}
            onClearRoute={clearGpxRoute}
            onSendToSimulator={sendGpxToSimulator}
            onError={handleGpxError}
            onMapRender={handleGpxMapRender}
          />
        )}

        {/* ── Mapa ── */}
        <div className="map-routes-right">
          <div className="map-shell" style={{ flex: 1, minHeight: 0 }}>
            <div ref={containerRef} className="map-canvas" style={{ minHeight: 0, height: "100%" }} />
            {mode === "preset" && !selectedRoute && (
              <div className="map-overlay">
                <div className="map-overlay-icon">🗺️</div>
                <div className="map-overlay-title">Seleciona uma rota</div>
                <div className="map-overlay-text">Escolhe um percurso na lista para ver o preview aqui.</div>
              </div>
            )}
            {mode === "custom" && !customStart && !customEnd && (
              <div className="map-overlay">
                <div className="map-overlay-icon">📍</div>
                <div className="map-overlay-title">Define o teu percurso</div>
                <div className="map-overlay-text">Pesquisa um endereço, usa o GPS ou clica no mapa para definir origem e destino.</div>
              </div>
            )}
            {mode === "gpx" && !gpxRoute && (
              <div className="map-overlay">
                <div className="map-overlay-icon">📁</div>
                <div className="map-overlay-title">Carrega um ficheiro GPX</div>
                <div className="map-overlay-text">Seleciona um ficheiro GPX para importar uma rota e visualizá-la no mapa.</div>
              </div>
            )}
            {(loadingPreview || customLoadingPreview || gpxProcessing) && (
              <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: "0.8rem", zIndex: 1000 }}>
                <Loader2 size={14} className="animate-spin" /> 
                {gpxProcessing ? "A processar GPX..." : "A calcular rota..."}
              </div>
            )}
            {clickMode && (
              <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(91,106,240,0.92)", borderRadius: 20, padding: "8px 18px", color: "#fff", fontSize: "0.82rem", fontWeight: 600, zIndex: 1000, pointerEvents: "none" }}>
                Clica no mapa para definir o ponto de {clickMode === "start" ? "origem 🟢" : "destino 🔴"}
              </div>
            )}
          </div>

          {/* Info da rota selecionada (preset) */}
          {mode === "preset" && selectedRoute && (
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
