import React from 'react';
import { MapPin, Clock, Route, TrendingUp } from 'lucide-react';

interface GpxWaypoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: Date;
}

interface ParsedGpxRoute {
  waypoints: GpxWaypoint[];
  distanceKm: number;
  totalTimeSec?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  startedAt?: Date;
  endedAt?: Date;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface RoutePreviewComponentProps {
  route: ParsedGpxRoute;
  onMapRender?: (waypoints: GpxWaypoint[]) => void;
}

export default function RoutePreviewComponent({
  route,
  onMapRender
}: RoutePreviewComponentProps) {
  React.useEffect(() => {
    if (onMapRender && route.waypoints) {
      onMapRender(route.waypoints);
    }
  }, [route.waypoints, onMapRender]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSpeed = (speed?: number): string => {
    if (!speed) return 'N/A';
    return `${speed.toFixed(1)} km/h`;
  };

  const formatCoordinate = (coord: number): string => {
    return coord.toFixed(6);
  };

  const startPoint = route.waypoints[0];
  const endPoint = route.waypoints[route.waypoints.length - 1];

  return (
    <div className="gpx-route-preview">
      <div className="gpx-route-header">
        <h4 className="gpx-route-title">
          <Route size={16} />
          Rota GPX Carregada
        </h4>
      </div>

      <div className="gpx-route-stats-grid">
        <div className="gpx-stat-item">
          <div className="gpx-stat-icon">
            <Route size={14} />
          </div>
          <div className="gpx-stat-content">
            <div className="gpx-stat-label">Distância</div>
            <div className="gpx-stat-value">{route.distanceKm.toFixed(1)} km</div>
          </div>
        </div>

        <div className="gpx-stat-item">
          <div className="gpx-stat-icon">
            <Clock size={14} />
          </div>
          <div className="gpx-stat-content">
            <div className="gpx-stat-label">Duração</div>
            <div className="gpx-stat-value">{formatDuration(route.totalTimeSec)}</div>
          </div>
        </div>

        <div className="gpx-stat-item">
          <div className="gpx-stat-icon">
            <MapPin size={14} />
          </div>
          <div className="gpx-stat-content">
            <div className="gpx-stat-label">Pontos</div>
            <div className="gpx-stat-value">{route.waypoints.length}</div>
          </div>
        </div>

        {route.avgSpeedKmh && (
          <div className="gpx-stat-item">
            <div className="gpx-stat-icon">
              <TrendingUp size={14} />
            </div>
            <div className="gpx-stat-content">
              <div className="gpx-stat-label">Velocidade Média</div>
              <div className="gpx-stat-value">{formatSpeed(route.avgSpeedKmh)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="gpx-route-endpoints">
        <div className="gpx-endpoint">
          <div className="gpx-endpoint-header">
            <span className="point-dot green-dot" />
            <span className="gpx-endpoint-label">Início</span>
          </div>
          <div className="gpx-endpoint-coords">
            {formatCoordinate(startPoint.latitude)}, {formatCoordinate(startPoint.longitude)}
          </div>
          {startPoint.elevation && (
            <div className="gpx-endpoint-elevation">
              Altitude: {startPoint.elevation.toFixed(0)}m
            </div>
          )}
        </div>

        <div className="gpx-endpoint">
          <div className="gpx-endpoint-header">
            <span className="point-dot red-dot" />
            <span className="gpx-endpoint-label">Fim</span>
          </div>
          <div className="gpx-endpoint-coords">
            {formatCoordinate(endPoint.latitude)}, {formatCoordinate(endPoint.longitude)}
          </div>
          {endPoint.elevation && (
            <div className="gpx-endpoint-elevation">
              Altitude: {endPoint.elevation.toFixed(0)}m
            </div>
          )}
        </div>
      </div>

      {route.startedAt && route.endedAt && (
        <div className="gpx-route-timing">
          <div className="gpx-timing-item">
            <span className="gpx-timing-label">Início:</span>
            <span className="gpx-timing-value">
              {route.startedAt.toLocaleString('pt-PT')}
            </span>
          </div>
          <div className="gpx-timing-item">
            <span className="gpx-timing-label">Fim:</span>
            <span className="gpx-timing-value">
              {route.endedAt.toLocaleString('pt-PT')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}