import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useSocket } from '../hooks/useSocket';
import { MapPin, Loader2, Crosshair } from 'lucide-react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { GpxUploadTab } from '../components/gpx';
import { postGpxForParse } from '../utils/gpxParseClient';
import { DISTRICTS, type PresetRoute } from '../data/routes';
import PresetRoutePanel from '../components/map/PresetRoutePanel';
import RouteDetailBar from '../components/map/RouteDetailBar';
import MapModeToggle from '../components/map/MapModeToggle';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

type MapMode = 'preset' | 'custom' | 'gpx';

interface CustomPoint {
  lat: number;
  lng: number;
  label: string;
}

async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=pt`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt' } });
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'pt' } },
    );
    const data = await res.json();
    return data?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function drawRouteLine(map: L.Map, coords: [number, number][], color = '#3b82f6', weight = 5) {
  if (coords.length >= 2) {
    const line = L.polyline(coords, { color, weight, opacity: 0.85 }).addTo(map);
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
    return line;
  }
  return null;
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
  const lastGpxRef = useRef<any | null>(null);

  const [mode, setMode] = useState<MapMode>('preset');
  const [selectedRoute, setSelectedRoute] = useState<PresetRoute | null>(null);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set(['Vila Real']));
  const [sent, setSent] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [customStart, setCustomStart] = useState<CustomPoint | null>(null);
  const [customEnd, setCustomEnd] = useState<CustomPoint | null>(null);
  const [geoLoading, setGeoLoading] = useState<'start' | 'end' | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [customSent, setCustomSent] = useState(false);
  const [customLoadingPreview, setCustomLoadingPreview] = useState(false);
  const [clickMode, setClickMode] = useState<'start' | 'end' | null>(null);
  const clickModeRef = useRef<'start' | 'end' | null>(null);
  const customStartRef = useRef<CustomPoint | null>(null);
  const customEndRef = useRef<CustomPoint | null>(null);

  const [gpxRoute, setGpxRoute] = useState<any | null>(null);
  const [gpxUploading, setGpxUploading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [gpxProcessing, setGpxProcessing] = useState(false);
  const [gpxUploadProgress, setGpxUploadProgress] = useState(0);
  const [gpxSending, setGpxSending] = useState(false);
  const [gpxSent, setGpxSent] = useState(false);

  const lat = telemetry?.location?.latitude;
  const lng = telemetry?.location?.longitude;

  useEffect(() => { clickModeRef.current = clickMode; }, [clickMode]);
  useEffect(() => { customStartRef.current = customStart; }, [customStart]);
  useEffect(() => { customEndRef.current = customEnd; }, [customEnd]);

  function clearPreview() {
    previewLineRef.current?.remove(); previewLineRef.current = null;
    startDotRef.current?.remove(); startDotRef.current = null;
    endDotRef.current?.remove(); endDotRef.current = null;
  }

  function clearCustom() {
    setCustomStart(null); setCustomEnd(null);
    setGeoError(null); setCustomSent(false);
    setClickMode(null);
    clearPreview();
  }

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([39.5, -8.0], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.marker([39.5, -8.0]).addTo(map).bindPopup('MotoGuard');
    trailRef.current = L.polyline([], { color: '#3b82f6', weight: 3, opacity: 0.7 }).addTo(map);
    mapRef.current = map;

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const cm = clickModeRef.current;
      if (!cm) return;
      const { lat, lng } = e.latlng;
      const label = await reverseGeocode(lat, lng);
      const point: CustomPoint = { lat, lng, label };
      if (cm === 'start') {
        setCustomStart(point);
        setClickMode('end');
      } else {
        setCustomEnd(point);
        setClickMode(null);
      }
    });

    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = clickMode ? 'crosshair' : '';
  }, [clickMode]);

  // Live position
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !trailRef.current || !lat || !lng) return;
    markerRef.current.setLatLng([lat, lng]);
    trailPointsRef.current.push([lat, lng]);
    if (trailPointsRef.current.length > 1000) trailPointsRef.current.shift();
    trailRef.current.setLatLngs(trailPointsRef.current);
  }, [lat, lng, msgCount]);

  // Preview preset route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedRoute || mode !== 'preset') {
      if (mode === 'preset') clearPreview();
      return;
    }

    clearPreview();
    const { start, end, center, zoom } = selectedRoute;
    map.setView(center, zoom, { animate: true });

    startDotRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 9, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Início', { permanent: false });

    endDotRef.current = L.circleMarker([end.lat, end.lng], {
      radius: 9, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Fim', { permanent: false });

    setLoadingPreview(true);
    const osrm = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    let cancelled = false;

    fetch(osrm)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !mapRef.current) return;
        const coords: [number, number][] = (data?.routes?.[0]?.geometry?.coordinates ?? [])
          .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
        const line = drawRouteLine(mapRef.current, coords);
        if (line) previewLineRef.current = line;
      })
      .catch(() => {
        if (cancelled || !mapRef.current) return;
        previewLineRef.current = L.polyline(
          [[start.lat, start.lng], [end.lat, end.lng]],
          { color: '#3b82f6', weight: 4, dashArray: '10 6', opacity: 0.7 },
        ).addTo(mapRef.current);
      })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });

    return () => { cancelled = true; };
  }, [selectedRoute, mode]);

  // Custom route preview
  const drawCustomPreview = useCallback(async (start: CustomPoint, end: CustomPoint) => {
    const map = mapRef.current;
    if (!map) return;
    clearPreview();

    startDotRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 9, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Início', { permanent: false });

    endDotRef.current = L.circleMarker([end.lat, end.lng], {
      radius: 9, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Fim', { permanent: false });

    setCustomLoadingPreview(true);
    const osrm = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    try {
      const r = await fetch(osrm);
      const data = await r.json();
      const coords: [number, number][] = (data?.routes?.[0]?.geometry?.coordinates ?? [])
        .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      const line = drawRouteLine(map, coords, '#5b6af0');
      if (line) previewLineRef.current = line;
    } catch {
      previewLineRef.current = L.polyline(
        [[start.lat, start.lng], [end.lat, end.lng]],
        { color: '#5b6af0', weight: 4, dashArray: '10 6' },
      ).addTo(map);
    }
    setCustomLoadingPreview(false);
  }, []);

  useEffect(() => {
    if (mode !== 'custom') return;
    if (customStart && customEnd) {
      void drawCustomPreview(customStart, customEnd);
    } else {
      clearPreview();
    }
  }, [customStart, customEnd, mode, drawCustomPreview]);

  // Mode switch cleanup
  useEffect(() => {
    clearPreview();
    if (mode === 'preset') {
      setGpxRoute(null); setGpxSent(false); setGpxError(null);
      setGpxUploading(false); setGpxProcessing(false); setGpxUploadProgress(0);
      setGpxSending(false); lastGpxRef.current = null;
    } else if (mode === 'custom') {
      setSelectedRoute(null);
      setGpxRoute(null); setGpxSent(false); setGpxError(null);
      setGpxUploading(false); setGpxProcessing(false); setGpxUploadProgress(0);
      setGpxSending(false); lastGpxRef.current = null;
    } else {
      setSelectedRoute(null);
      setClickMode(null);
    }
  }, [mode]);

  // GPX rendering
  useEffect(() => {
    if (mode !== 'gpx' || !gpxRoute?.waypoints?.length || !mapRef.current) return;
    clearPreview();
    const coords: [number, number][] = gpxRoute.waypoints.map(
      (wp: { latitude: number; longitude: number }) => [wp.latitude, wp.longitude],
    );
    if (coords.length < 2) return;
    const start = coords[0], end = coords[coords.length - 1];

    startDotRef.current = L.circleMarker(start, {
      radius: 9, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2,
    }).addTo(mapRef.current).bindTooltip('Início', { permanent: false });

    endDotRef.current = L.circleMarker(end, {
      radius: 9, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2,
    }).addTo(mapRef.current).bindTooltip('Fim', { permanent: false });

    previewLineRef.current = L.polyline(coords, { color: '#5b6af0', weight: 5, opacity: 0.85 }).addTo(mapRef.current);

    if (lastGpxRef.current !== gpxRoute) {
      mapRef.current.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
      lastGpxRef.current = gpxRoute;
    }
  }, [gpxRoute, mode]);

  // Geolocation
  function useMyLocation(target: 'start' | 'end') {
    if (!navigator.geolocation) { setGeoError('Geolocalização não suportada neste browser.'); return; }
    setGeoLoading(target); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        const point: CustomPoint = { lat: latitude, lng: longitude, label };
        if (target === 'start') setCustomStart(point);
        else setCustomEnd(point);
        setGeoLoading(null);
        mapRef.current?.setView([latitude, longitude], 14, { animate: true });
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter a localização.');
        setGeoLoading(null);
      },
      { timeout: 10000 },
    );
  }

  async function searchAddress(query: string, target: 'start' | 'end') {
    if (!query.trim()) return;
    setGeoLoading(target); setGeoError(null);
    const result = await geocode(query);
    if (!result) { setGeoError(`Endereço não encontrado: "${query}"`); setGeoLoading(null); return; }
    const point: CustomPoint = result;
    if (target === 'start') setCustomStart(point);
    else setCustomEnd(point);
    setGeoLoading(null);
    mapRef.current?.setView([result.lat, result.lng], 14, { animate: true });
  }

  function toggleDistrict(name: string) {
    setExpandedDistricts((prev) => {
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
      acao: 'definir_rota',
      route: {
        start: { latitude: selectedRoute.start.lat, longitude: selectedRoute.start.lng },
        end: { latitude: selectedRoute.end.lat, longitude: selectedRoute.end.lng },
        loop: false,
      },
    };
    sendCommand(cmd);
    localStorage.setItem('sim_route', JSON.stringify(cmd.route));
    setSent(true);
    setTimeout(() => navigate('/simulator-contexts'), 800);
  }

  function useCustomRoute() {
    if (!customStart || !customEnd) return;
    const cmd = {
      acao: 'definir_rota',
      route: {
        start: { latitude: customStart.lat, longitude: customStart.lng },
        end: { latitude: customEnd.lat, longitude: customEnd.lng },
        loop: false,
      },
    };
    sendCommand(cmd);
    localStorage.setItem('sim_route', JSON.stringify(cmd.route));
    setCustomSent(true);
    setTimeout(() => navigate('/simulator-contexts'), 800);
  }

  async function handleGpxFileSelect(file: File) {
    setGpxUploading(true); setGpxProcessing(true);
    setGpxUploadProgress(0); setGpxError(null); setGpxRoute(null);
    lastGpxRef.current = null;

    try {
      const { status, body: result } = await postGpxForParse(file, {
        timeoutMs: 30000,
        onUploadProgress: (p) => setGpxUploadProgress(p),
        onUploadFinished: () => setGpxUploading(false),
      });

      if (status === 503 || !result.success) {
        const errorMsg = result.error || 'Unable to process GPX file.';
        const valErrors = result.validationErrors?.join(', ') || '';
        setGpxError(valErrors ? `${errorMsg}: ${valErrors}` : errorMsg);
        setGpxUploading(false); setGpxProcessing(false); setGpxUploadProgress(0);
        return;
      }

      const route = result.route;
      setGpxRoute({
        waypoints: route.waypoints.map((wp: any) => ({
          latitude: wp.lat, longitude: wp.lon, elevation: wp.ele,
          time: wp.time ? new Date(wp.time) : undefined,
        })),
        distanceKm: route.distanceKm, totalTimeSec: route.totalTimeSec,
        avgSpeedKmh: route.avgSpeedKmh, maxSpeedKmh: route.maxSpeedKmh,
        startedAt: route.startedAt ? new Date(route.startedAt) : undefined,
        endedAt: route.endedAt ? new Date(route.endedAt) : undefined,
        bounds: route.bounds
          ? { north: route.bounds.maxLat, south: route.bounds.minLat, east: route.bounds.maxLon, west: route.bounds.minLon }
          : undefined,
        simulatorRoute: route.simulatorRoute,
      });
    } catch (error) {
      setGpxError(error instanceof Error && error.name === 'AbortError'
        ? 'Pedido de upload interrompido. Tenta novamente.'
        : 'Upload failed. Please try again.');
    } finally {
      setGpxUploading(false); setGpxProcessing(false); setGpxUploadProgress(0);
    }
  }

  function clearGpxRoute() {
    setGpxRoute(null); setGpxError(null); setGpxSent(false);
    setGpxProcessing(false); setGpxUploading(false);
    setGpxUploadProgress(0); setGpxSending(false); lastGpxRef.current = null;
    clearPreview();
  }

  function sendGpxToSimulator() {
    if (!gpxRoute?.simulatorRoute) return;
    setGpxSending(true);
    sendCommand({ acao: 'definir_rota', route: gpxRoute.simulatorRoute });
    localStorage.setItem('sim_route', JSON.stringify(gpxRoute.simulatorRoute));
    setGpxSent(true);
    setTimeout(() => { setGpxSending(false); navigate('/simulator-contexts'); }, 800);
  }

  const showLoading = loadingPreview || customLoadingPreview || (mode === 'gpx' && (gpxUploading || gpxProcessing));
  const showEmpty =
    (mode === 'preset' && !selectedRoute) ||
    (mode === 'custom' && !customStart && !customEnd) ||
    (mode === 'gpx' && !gpxRoute);

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <MapPin size={22} />
            </span>
            Planeador de Rotas
          </h1>
          <p className="text-muted font-medium text-sm mt-1">
            Seleciona uma rota oficial ou define o teu próprio percurso para a simulação.
          </p>
        </div>
        <MapModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 flex-1 min-h-0">
        {/* SIDE PANEL */}
        <div className="bg-surface/40 backdrop-blur-xl border border-border-glass rounded-[2rem] overflow-hidden flex flex-col shadow-2xl relative min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50" />

          {mode === 'preset' && (
            <PresetRoutePanel
              districts={DISTRICTS}
              expandedDistricts={expandedDistricts}
              selectedRoute={selectedRoute}
              onToggleDistrict={toggleDistrict}
              onSelectRoute={selectRoute}
            />
          )}

          {mode === 'custom' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              <div>
                <div className="flex items-center gap-2 text-text font-black tracking-tight mb-2">
                  <MapPin size={18} className="text-accent" />
                  <span>Definir Percurso</span>
                </div>
                <p className="text-[0.75rem] font-medium text-muted leading-relaxed">
                  Pesquisa um endereço, usa a tua localização ou clica no mapa.
                </p>
              </div>

              {/* Origin */}
              <div className="flex flex-col gap-4 p-5 rounded-3xl bg-surface border border-border-glass-subtle">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-green">
                  <span className="w-2 h-2 rounded-full bg-green animate-pulse" /> Origem
                </div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${
                      clickMode === 'start'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-panel border-border-glass-subtle text-muted hover:text-text'
                    }`}
                    onClick={() => setClickMode(clickMode === 'start' ? null : 'start')}
                  >
                    <MapPin size={14} />
                    {clickMode === 'start' ? 'A aguardar clique...' : 'Clicar no mapa'}
                  </button>
                  <button
                    className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 disabled:opacity-30"
                    onClick={() => useMyLocation('start')}
                    disabled={geoLoading === 'start'}
                  >
                    {geoLoading === 'start' ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
                  </button>
                </div>
              </div>

              {/* Destination */}
              <div className="flex flex-col gap-4 p-5 rounded-3xl bg-surface border border-border-glass-subtle">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-red">
                  <span className="w-2 h-2 rounded-full bg-red animate-pulse" /> Destino
                </div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${
                      clickMode === 'end'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-panel border-border-glass-subtle text-muted hover:text-text'
                    }`}
                    onClick={() => setClickMode(clickMode === 'end' ? null : 'end')}
                  >
                    <MapPin size={14} />
                    {clickMode === 'end' ? 'A aguardar clique...' : 'Clicar no mapa'}
                  </button>
                  <button
                    className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 disabled:opacity-30"
                    onClick={() => useMyLocation('end')}
                    disabled={geoLoading === 'end'}
                  >
                    {geoLoading === 'end' ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
                  </button>
                </div>
              </div>

              {geoError && (
                <div className="p-3 rounded-xl bg-red/10 border border-red/20 text-red text-[0.7rem] font-bold">{geoError}</div>
              )}

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-2xl bg-panel border border-border-glass-subtle text-[0.65rem] font-black uppercase tracking-widest text-muted hover:text-text transition-all"
                  onClick={clearCustom}
                >
                  Limpar
                </button>
                <button
                  className={`flex-[2] py-3 rounded-2xl text-[0.65rem] font-black uppercase tracking-widest transition-all shadow-xl ${
                    customSent
                      ? 'bg-green/10 text-green border border-green/20'
                      : 'bg-accent text-white shadow-accent/20'
                  }`}
                  onClick={useCustomRoute}
                  disabled={customLoadingPreview || !customStart || !customEnd}
                >
                  {customLoadingPreview ? 'Calculando...' : customSent ? 'Enviada ✓' : 'Usar Rota'}
                </button>
              </div>
            </div>
          )}

          {mode === 'gpx' && (
            <GpxUploadTab
              isActive
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
              onError={(e) => setGpxError(e?.trim() ? e : null)}
              onMapRender={() => {}}
            />
          )}
        </div>

        {/* MAP AREA */}
        <div className="relative flex flex-col gap-6 overflow-hidden">
          <div className="relative flex-1 bg-surface/40 backdrop-blur-xl border border-border-glass rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div ref={containerRef} className="w-full h-full z-0" />

            {showEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10 animate-fade-in">
                <div className="text-7xl opacity-50">
                  {mode === 'preset' ? '🗺️' : mode === 'custom' ? '📍' : '📁'}
                </div>
                <div className="text-center flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-text tracking-tight m-0">
                    {mode === 'preset'
                      ? 'Seleciona uma rota'
                      : mode === 'custom'
                        ? 'Define o teu percurso'
                        : 'Carrega um ficheiro GPX'}
                  </h3>
                  <p className="text-sm font-medium text-muted max-w-xs m-0">
                    {mode === 'preset'
                      ? 'Escolhe um percurso na lista lateral para pré-visualizar aqui.'
                      : mode === 'custom'
                        ? 'Pesquisa endereços ou clica diretamente no mapa para marcar pontos.'
                        : 'Importa rotas externas para simular em trajetos reais.'}
                  </p>
                </div>
              </div>
            )}

            {showLoading && (
              <div className="absolute top-6 right-6 flex items-center gap-3 px-5 py-3 bg-surface/90 border border-border-glass rounded-2xl shadow-2xl text-text text-xs font-black uppercase tracking-widest z-50">
                <Loader2 size={16} className="animate-spin text-accent" />
                {mode === 'gpx' && gpxUploading ? 'A enviar...' : mode === 'gpx' && gpxProcessing ? 'A processar...' : 'A calcular...'}
              </div>
            )}

            {clickMode && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 bg-accent text-white rounded-[2rem] shadow-2xl shadow-accent/40 text-sm font-black uppercase tracking-[0.1em] z-50 flex items-center gap-3 animate-fade-in">
                <MapPin size={18} />
                Clica no mapa para definir {clickMode === 'start' ? 'A ORIGEM' : 'O DESTINO'}
              </div>
            )}
          </div>

          {mode === 'preset' && selectedRoute && (
            <RouteDetailBar route={selectedRoute} sent={sent} onClear={() => { setSelectedRoute(null); setSent(false); }} onUse={useRoute} />
          )}
        </div>
      </div>
    </div>
  );
}
