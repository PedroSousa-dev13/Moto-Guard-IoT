import React from 'react';
import { Play, RotateCcw, Loader2, CheckCircle } from 'lucide-react';

interface ParsedGpxRoute {
  waypoints: Array<{
    latitude: number;
    longitude: number;
    elevation?: number;
    time?: Date;
  }>;
  distanceKm: number;
  totalTimeSec?: number;
  simulatorRoute?: {
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    loop: boolean;
  };
}

interface RouteActionsComponentProps {
  route: ParsedGpxRoute | null;
  onSendToSimulator: () => void;
  onClearRoute: () => void;
  isSending: boolean;
  routeSent: boolean;
  disabled?: boolean;
}

export default function RouteActionsComponent({
  route,
  onSendToSimulator,
  onClearRoute,
  isSending,
  routeSent,
  disabled = false
}: RouteActionsComponentProps) {
  if (!route) return null;

  const canSendToSimulator = route.waypoints && route.waypoints.length >= 2;

  return (
    <div className="gpx-route-actions">
      <div className="custom-route-actions">
        <button 
          className="btn btn-sm" 
          onClick={onClearRoute}
          disabled={disabled || isSending}
          title="Limpar rota carregada"
        >
          <RotateCcw size={13} /> 
          Limpar
        </button>
        
        <button
          className={`btn btn-sm ${routeSent ? "btn-success" : "btn-primary"}`}
          onClick={onSendToSimulator}
          disabled={disabled || isSending || !canSendToSimulator}
          title={
            !canSendToSimulator 
              ? "A rota deve ter pelo menos 2 pontos" 
              : routeSent 
                ? "Rota enviada com sucesso" 
                : "Enviar rota para o simulador"
          }
        >
          {isSending ? (
            <>
              <Loader2 size={13} className="animate-spin" /> 
              A enviar...
            </>
          ) : routeSent ? (
            <>
              <CheckCircle size={13} /> 
              Rota enviada ✓
            </>
          ) : (
            <>
              <Play size={13} /> 
              Usar esta rota
            </>
          )}
        </button>
      </div>

      {!canSendToSimulator && route.waypoints && (
        <div className="gpx-route-warning">
          <div className="alert alert-warning" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
            A rota deve conter pelo menos 2 pontos para ser enviada ao simulador.
            Pontos atuais: {route.waypoints.length}
          </div>
        </div>
      )}

      {routeSent && (
        <div className="gpx-route-success">
          <div className="alert alert-success" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
            Rota enviada com sucesso! A redirecionar para o simulador...
          </div>
        </div>
      )}
    </div>
  );
}