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
  gpxSending: boolean;
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
  gpxSending,
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
    if (gpxError) {
      onError("");
    }
  };

  const gpxFileBusy = gpxUploading || gpxProcessing;

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
      <div>
        <div className="flex items-center gap-2 text-text font-black tracking-tight mb-2">
          <Navigation size={18} className="text-accent" />
          <span>GPX Upload</span>
        </div>
        <p className="text-[0.75rem] font-medium text-muted leading-relaxed">
          Carrega um ficheiro GPX para importar uma rota e enviá-la para o simulador.
        </p>
      </div>

      <FileUploadComponent
        onFileSelect={onFileSelect}
        onError={onError}
        isUploading={gpxFileBusy}
        progress={uploadProgress}
        disabled={gpxFileBusy}
      />

      {gpxError && (
        <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-[0.75rem] font-bold animate-fade-in">
          {gpxError}
        </div>
      )}

      {gpxRoute && !gpxFileBusy && !gpxError && (
        <div className="p-4 rounded-2xl bg-green/10 border border-green/20 text-green text-[0.75rem] font-bold animate-fade-in">
          GPX processado com sucesso. Revisa a pré-visualização abaixo e envia para o simulador quando estiveres pronto.
        </div>
      )}

      {gpxRoute && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <RoutePreviewComponent
            route={gpxRoute}
            onMapRender={onMapRender}
          />
          
          <RouteActionsComponent
            route={gpxRoute}
            onSendToSimulator={onSendToSimulator}
            onClearRoute={handleClearRoute}
            isSending={gpxSending}
            routeSent={gpxSent}
            disabled={gpxFileBusy}
          />
        </div>
      )}
    </div>
  );
}