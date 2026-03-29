import React from 'react';
import { Navigation } from 'lucide-react';
import FileUploadComponent from './FileUploadComponent';
import RoutePreviewComponent from './RoutePreviewComponent';
import RouteActionsComponent from './RouteActionsComponent';

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
  simulatorRoute?: {
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    loop: boolean;
  };
}

interface GpxUploadTabProps {
  isActive: boolean;
  gpxRoute: ParsedGpxRoute | null;
  gpxUploading: boolean;
  gpxError: string | null;
  gpxProcessing: boolean;
  gpxSent: boolean;
  uploadProgress?: number;
  onFileSelect: (file: File) => void;
  onClearRoute: () => void;
  onSendToSimulator: () => void;
  onError: (error: string) => void;
  onMapRender?: (waypoints: GpxWaypoint[]) => void;
}

export default function GpxUploadTab({
  isActive,
  gpxRoute,
  gpxUploading,
  gpxError,
  gpxProcessing,
  gpxSent,
  uploadProgress = 0,
  onFileSelect,
  onClearRoute,
  onSendToSimulator,
  onError,
  onMapRender
}: GpxUploadTabProps) {
  if (!isActive) return null;

  const handleClearRoute = () => {
    onClearRoute();
    // Clear any error states
    if (gpxError) {
      onError('');
    }
  };

  return (
    <div className="routes-panel custom-route-panel">
      <div className="custom-route-inner">
        <div className="custom-route-title">
          <Navigation size={16} />
          GPX Upload
        </div>
        <p className="custom-route-hint">
          Carrega um ficheiro GPX para importar uma rota e enviá-la para o simulador.
        </p>

        <FileUploadComponent
          onFileSelect={onFileSelect}
          onError={onError}
          isUploading={gpxUploading}
          progress={uploadProgress}
          disabled={gpxProcessing}
        />

        {gpxError && (
          <div className="alert alert-danger" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
            {gpxError}
          </div>
        )}

        {gpxRoute && (
          <>
            <RoutePreviewComponent
              route={gpxRoute}
              onMapRender={onMapRender}
            />
            
            <RouteActionsComponent
              route={gpxRoute}
              onSendToSimulator={onSendToSimulator}
              onClearRoute={handleClearRoute}
              isSending={gpxProcessing}
              routeSent={gpxSent}
              disabled={gpxUploading}
            />
          </>
        )}
      </div>
    </div>
  );
}