import { useEffect, useRef } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default icon URLs broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface RouteMapProps {
  gpsTrack: Array<{ lat: number; lng: number }>;
  currentPosition: { lat: number; lng: number } | null;
}

export default function RouteMap({ gpsTrack, currentPosition }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const endMarkerRef = useRef<L.CircleMarker | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([39.5, -8.0], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    
    // Invalidate size on container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw full route polyline + start/end markers when gpsTrack changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gpsTrack.length === 0) {
      polylineRef.current?.remove();
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      polylineRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      return;
    }

    const latLngs: L.LatLngTuple[] = gpsTrack.map((p) => [p.lat, p.lng]);

    if (polylineRef.current) {
      // Update existing polyline in place (avoid flicker/disappearing)
      polylineRef.current.setLatLngs(latLngs);
    } else {
      // Create polyline for the full route
      polylineRef.current = L.polyline(latLngs, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
    }

    // Green marker at start (only create once)
    if (!startMarkerRef.current && latLngs.length > 0) {
      startMarkerRef.current = L.circleMarker(latLngs[0], {
        radius: 9,
        color: "#16a34a",
        fillColor: "#22c55e",
        fillOpacity: 1,
        weight: 2,
      })
        .addTo(map)
        .bindTooltip("Início", { permanent: false });
    }

    // Red marker at end (only create once, update position if track changes)
    if (latLngs.length > 0) {
      const last = latLngs[latLngs.length - 1];
      if (endMarkerRef.current) {
        endMarkerRef.current.setLatLng(last);
      } else {
        endMarkerRef.current = L.circleMarker(last, {
          radius: 9,
          color: "#b91c1c",
          fillColor: "#ef4444",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip("Fim", { permanent: false });
      }
    }

    // Fit map to the route bounds (only on first load)
    if (gpsTrack.length > 1 && !polylineRef.current) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], animate: true });
    }
  }, [gpsTrack]);

  // Update current position marker during playback
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!currentPosition) {
      currentMarkerRef.current?.remove();
      currentMarkerRef.current = null;
      return;
    }

    const { lat, lng } = currentPosition;

    if (currentMarkerRef.current) {
      currentMarkerRef.current.setLatLng([lat, lng]);
    } else {
      currentMarkerRef.current = L.marker([lat, lng])
        .addTo(map)
        .bindTooltip("Posição atual", { permanent: false });
    }
  }, [currentPosition]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
    />
  );
}
