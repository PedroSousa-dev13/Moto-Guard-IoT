import React, { useEffect, useMemo, useState, useRef } from 'react';
import L from 'leaflet';
import { 
  Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, ResponsiveContainer 
} from 'recharts';
import { tripsAPI } from '../../services/api';
import type { TripFeedItem } from '../../types';
import { MapPin, ShieldAlert } from 'lucide-react';

interface LastTripMiniMapProps {
  trip: TripFeedItem | null;
}

const LastTripMiniMap: React.FC<LastTripMiniMapProps> = ({ trip }) => {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!trip) {
        setRoutePoints([]);
        return;
    }

    let cancelled = false;
    setIsLoading(true);
    
    const fetchRoute = async () => {
      try {
        if (trip.source === "GPX_IMPORTED") {
          const res = await tripsAPI.getById(trip.id);
          if (cancelled) return;
          const points = res.data.gpxData?.waypoints?.map(p => [p.lat, p.lon] as [number, number]) ?? [];
          setRoutePoints(points);
        } else {
          const res = await tripsAPI.getTelemetry(trip.id, { limit: 1000 });
          if (cancelled) return;
          const points = res.data.data
            .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
            .map(p => [p.latitude, p.longitude] as [number, number]);
          setRoutePoints(points);
        }
      } catch (err) {
        if (!cancelled) setRoutePoints([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchRoute();
    return () => { cancelled = true; };
  }, [trip]);

  useEffect(() => {
    if (!mapContainerRef.current || routePoints.length <= 1) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
      polylineRef.current = L.polyline(routePoints, { color: '#3b82f6', weight: 4 }).addTo(mapRef.current);
      
      setTimeout(() => {
        if (mapRef.current && polylineRef.current) {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [15, 15] });
        }
      }, 100);
    } else if (polylineRef.current) {
      polylineRef.current.setLatLngs(routePoints);
      mapRef.current.invalidateSize();
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [15, 15] });
    }
  }, [routePoints]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const radarData = useMemo(() => {
    if (!trip) return [];
    return [
      { subject: 'Vel.', A: trip.safetyScore ? trip.safetyScore * 0.8 : 70, fullMark: 100 },
      { subject: 'Inc.', A: trip.safetyScore ? trip.safetyScore * 0.9 : 85, fullMark: 100 },
      { subject: 'Suav.', A: trip.safetyScore ?? 80, fullMark: 100 },
      { subject: 'Seg.', A: trip.safetyScore ?? 90, fullMark: 100 },
      { subject: 'Cons.', A: 75, fullMark: 100 },
    ];
  }, [trip]);

  const hasRoute = routePoints.length > 1;

  if (!trip) return null;

  return (
    <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-border-glass-subtle bg-surface-2 group shadow-inner">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm z-50">
          <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className={`h-full w-full grayscale-[0.5] brightness-[0.7] contrast-[1.2] transition-opacity duration-500 ${hasRoute ? 'opacity-100' : 'opacity-0 absolute invisible'}`}
      />

      {/* Radar Chart Container (Fallback) */}
      {!hasRoute && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pt-4">
          <div className="w-full h-full min-h-0 flex-1">
            <ResponsiveContainer width="99%" height="99%">
              <RadarChart cx="50%" cy="40%" outerRadius="65%" data={radarData}>
                <PolarGrid stroke="var(--glass-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 9, fontWeight: 'bold' }} />
                <Radar
                  name="Desempenho"
                  dataKey="A"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute top-2 right-2 bg-surface shadow-sm border border-border-glass-subtle p-1.5 rounded-lg text-muted">
            <ShieldAlert size={14} />
          </div>
        </div>
      )}

      {hasRoute && (
        <div className="absolute top-2 right-2 bg-accent-light backdrop-blur-md border border-accent/30 p-1.5 rounded-lg text-accent z-[400]">
          <MapPin size={14} />
        </div>
      )}
      
      <div className="absolute bottom-3 left-3 bg-surface shadow-md border border-border-glass-subtle px-2.5 py-1 rounded-xl flex items-center gap-2 z-[400]">
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[0.6rem] font-black text-text uppercase tracking-widest">
            {hasRoute ? (trip.source === "GPX_IMPORTED" ? "Rota GPX" : "Rota Registada") : "Análise de Estilo"}
        </span>
      </div>
    </div>
  );
};

export default LastTripMiniMap;