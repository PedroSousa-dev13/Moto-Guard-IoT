import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { tripsAPI } from "../services/api";
import { loadAlerts } from "../utils/alerts";
import { 
  Gauge, Zap, Thermometer, Battery, 
  Clock, Route, ChevronRight, 
  Cpu, Bell, Moon, Sun, 
  CheckCircle2, AlertTriangle, 
  Activity, Play, Settings, LogOut,
  Maximize2, TrendingUp, Radio
} from "lucide-react";
import { 
  ResponsiveContainer, 
  Tooltip, AreaChart, Area 
} from "recharts";
import type { TripFeedItem } from "../types";
import "./Dashboard.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | undefined | null, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// ── sub-components ────────────────────────────────────────────────────────────

function Sparkline({ data, color, loading }: { data: any[], color: string, loading?: boolean }) {
  if (loading || data.length === 0) {
    return <div className="db-sparkline db-skeleton db-stat-skeleton-spark" />;
  }
  return (
    <div className="db-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2} 
            fillOpacity={1} 
            fill={`url(#grad-${color})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ 
  icon, label, value, unit, color, sparkData, footer, loading 
}: { 
  icon: any, label: string, value: string, unit: string, color: string, sparkData: any[], footer: string, loading?: boolean 
}) {
  return (
    <div className="db-stat-card">
      <div className="db-stat-header">
        <div className="db-stat-icon" style={{ color }}>{icon}</div>
        <span className="db-stat-label">{label}</span>
      </div>
      <div className="db-stat-value-row">
        {loading ? (
          <div className="db-skeleton db-stat-skeleton-val" />
        ) : (
          <>
            <span className="db-stat-value">{value}</span>
            <span className="db-stat-unit">{unit}</span>
          </>
        )}
      </div>
      <Sparkline data={sparkData} color={color} loading={loading} />
      <div className="db-stat-footer">
        <span>{loading ? "A aguardar dados..." : footer}</span>
        <TrendingUp size={12} style={{ opacity: loading ? 0.2 : 1 }} />
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="db-chart-placeholder">
      <div className="db-chart-placeholder-icon">
        <Radio size={32} className="pulse" />
      </div>
      <div className="db-chart-placeholder-text">
        Sem telemetria ao vivo. Inicie o simulador ou ligue o dispositivo para ver os gráficos em tempo real.
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { telemetry, status, tripEndedSignal } = useSocket();
  const [lastTrip, setLastTrip] = useState<TripFeedItem | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { document.title = "Dashboard — MotoGuard"; }, []);

  useEffect(() => {
    tripsAPI.getFeed(undefined, 1)
      .then((r) => setLastTrip(r.data[0] ?? null))
      .catch(() => {});
  }, [tripEndedSignal]);

  const alerts = useMemo(() => loadAlerts(), [tripEndedSignal]);
  const recentAlerts = alerts.slice(0, 3);

  const tel = telemetry?.telemetry;
  const hasData = status.hasData && !!tel;

  useEffect(() => {
    if (hasData && tel) {
      setHistory(prev => {
        const next = [...prev, { 
          time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          speed: tel.speed_kmh,
          rpm: tel.rpm / 100,
          temp: 85 + (Math.random() * 2),
          batt: 14.2 + (Math.random() * 0.1)
        }].slice(-30);
        return next;
      });
    } else if (!status.ws && !status.mqtt) {
      // Clear history if disconnected
      setHistory([]);
    }
  }, [telemetry, hasData, status.ws, status.mqtt]);

  const speedSpark = history.map(h => ({ value: h.speed }));
  const rpmSpark = history.map(h => ({ value: h.rpm }));
  const tempSpark = history.map(h => ({ value: h.temp }));
  const battSpark = history.map(h => ({ value: h.batt }));

  return (
    <div className="db-page">

      {/* ── HEADER ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-header-title">Dashboard</h1>
          <div className="db-header-meta">
            <span className={hasData ? "accent-green" : "accent-orange"}>●</span>
            <span>{hasData ? "Visão geral do seu sistema em tempo real" : "Sistema em modo de espera"}</span>
          </div>
        </div>

        <div className="db-header-right">
          <div className={`db-status-pill ${status.mqtt ? "active" : ""}`}>
            <div className="db-status-dot" />
            <span>MQTT</span>
          </div>
          <div className={`db-status-pill ${status.ws ? "active" : ""}`}>
            <div className="db-status-dot" />
            <span>WS</span>
          </div>
        </div>
      </div>

      <div className="db-grid">
        <div className="db-main-col">
          
          {/* HERO CARD */}
          <div className="db-hero-card">
            <img 
              src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=2070&auto=format&fit=crop" 
              alt="Motorcycle" 
              className="db-hero-img" 
            />
            <div className="db-hero-overlay">
              <div className="db-hero-status-icon" style={{ 
                background: hasData ? "rgba(16, 185, 129, 0.15)" : "rgba(249, 115, 22, 0.15)",
                borderColor: hasData ? "rgba(16, 185, 129, 0.3)" : "rgba(249, 115, 22, 0.3)",
                color: hasData ? "#10b981" : "#f97316"
              }}>
                {hasData ? <CheckCircle2 size={32} /> : <Radio size={32} className="pulse" />}
              </div>
              <h2 className="db-hero-title">{hasData ? "Tudo certo!" : "Pronto para iniciar"}</h2>
              <p className="db-hero-sub">
                {hasData 
                  ? "Sistema ativo e monitorando todos os parâmetros da sua moto." 
                  : "Liga o simulador ou um dispositivo real para começar a monitorizar."}
              </p>
            </div>
          </div>

          {/* STATS ROW */}
          <div className="db-stats-row">
            <StatCard 
              icon={<Gauge size={18} />} 
              label="Velocidade" 
              value={fmt(tel?.speed_kmh)} 
              unit="km/h" 
              color="#3b82f6" 
              sparkData={speedSpark}
              footer={`Média: ${fmt(tel?.speed_kmh ? tel.speed_kmh * 0.8 : 0)} km/h`}
              loading={!hasData}
            />
            <StatCard 
              icon={<Zap size={18} />} 
              label="RPM" 
              value={fmt(tel?.rpm)} 
              unit="rpm" 
              color="#8b5cf6" 
              sparkData={rpmSpark}
              footer={`Máx: ${fmt(tel?.rpm ? tel.rpm * 1.1 : 0)} rpm`}
              loading={!hasData}
            />
            <StatCard 
              icon={<Thermometer size={18} />} 
              label="Temperatura" 
              value={fmt(tel?.engine_temp_c ?? 85)} 
              unit="°C" 
              color="#3b82f6" 
              sparkData={tempSpark}
              footer="Normal"
              loading={!hasData}
            />
            <StatCard 
              icon={<Battery size={18} />} 
              label="Bateria" 
              value={fmt(tel?.voltage ?? 14.2, 1)} 
              unit="V" 
              color="#ef4444" 
              sparkData={battSpark}
              footer="Saudável"
              loading={!hasData}
            />
          </div>

          {/* MAIN CHART */}
          <div className="db-chart-card">
            <div className="db-card-header">
              <span className="db-card-title">Resumo da Viagem</span>
              {hasData && (
                <div className="db-chart-legend">
                  <div className="db-legend-item">
                    <div className="db-legend-color" style={{ background: '#8b5cf6' }} />
                    <span>Velocidade (km/h)</span>
                  </div>
                  <div className="db-legend-item">
                    <div className="db-legend-color" style={{ background: '#10b981' }} />
                    <span>RPM</span>
                  </div>
                </div>
              )}
            </div>

            <div className="db-chart-container">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0d0d1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="speed" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpeed)" />
                    <Area type="monotone" dataKey="rpm" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRpm)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>

            <div className="db-summary-row">
              <div className="db-summary-item">
                <span className="db-summary-label">Duração</span>
                <div className="db-summary-val-row">
                  <div className="db-summary-icon"><Clock size={14} /></div>
                  <span className="db-summary-value">{hasData ? "00:22:14" : "--:--"}</span>
                </div>
              </div>
              <div className="db-summary-item">
                <span className="db-summary-label">Distância</span>
                <div className="db-summary-val-row">
                  <div className="db-summary-icon"><Route size={14} /></div>
                  <span className="db-summary-value">{hasData ? "5.6 km" : "0.0 km"}</span>
                </div>
              </div>
              <div className="db-summary-item">
                <span className="db-summary-label">Vel. Média</span>
                <div className="db-summary-val-row">
                  <div className="db-summary-icon"><Activity size={14} /></div>
                  <span className="db-summary-value">{hasData ? "15 km/h" : "0 km/h"}</span>
                </div>
              </div>
              <div className="db-summary-item">
                <span className="db-summary-label">Vel. Máxima</span>
                <div className="db-summary-val-row">
                  <div className="db-summary-icon"><Maximize2 size={14} /></div>
                  <span className="db-summary-value">{hasData ? "128 km/h" : "0 km/h"}</span>
                </div>
              </div>
              <div className="db-summary-item">
                <span className="db-summary-label">RPM Máx.</span>
                <div className="db-summary-val-row">
                  <div className="db-summary-icon"><Zap size={14} /></div>
                  <span className="db-summary-value">{hasData ? "9,850 rpm" : "0 rpm"}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="db-side-col">
          
          {/* ÚLTIMA VIAGEM */}
          <div className="db-side-card">
            <div className="db-side-card-header">
              <span className="db-card-title">Última Viagem</span>
              <Link to="/trips" className="db-card-link">
                Ver todas <ChevronRight size={14} />
              </Link>
            </div>
            
            <div className="db-map-preview">
              <img 
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" 
                alt="Map" 
                className="db-map-img" 
              />
              {lastTrip && (
                <div className="db-map-overlay">
                  {lastTrip.safetyScore} / 100
                </div>
              )}
            </div>

            <div className="db-last-trip-stats">
              <div className="db-last-trip-item"><Clock size={14} className="accent-purple" /> {lastTrip ? fmtTime(lastTrip.startedAt) : "--:--"}</div>
              <div className="db-last-trip-item"><Route size={14} className="accent-purple" /> {lastTrip ? `${(lastTrip.distanceKm || 0).toFixed(1)} km` : "0.0 km"}</div>
            </div>
          </div>

          {/* ALERTAS RECENTES */}
          <div className="db-side-card">
            <div className="db-side-card-header">
              <span className="db-card-title">Alertas Recentes</span>
              <Link to="/alertas" className="db-card-link">Ver todas</Link>
            </div>
            
            <div className="db-alerts-list">
              {recentAlerts.length > 0 ? recentAlerts.map(a => (
                <div key={a.id} className="db-alert-item">
                  <div className="db-alert-icon-wrap" style={{ 
                    background: a.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(249, 115, 22, 0.1)', 
                    color: a.severity === 'CRITICAL' ? '#ef4444' : '#f97316' 
                  }}>
                    <AlertTriangle size={14} />
                  </div>
                  <span className="db-alert-msg">{a.title}</span>
                  <span className="db-alert-time">{fmtTime(a.timestamp)}</span>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '10px', color: 'var(--muted)', fontSize: '0.8rem' }}>
                  Sem alertas recentes
                </div>
              )}
            </div>
          </div>

          {/* TELEMETRIA AO VIVO */}
          <div className="db-side-card db-live-card">
            <div className="db-telemetry-visual">
              <div className="db-telemetry-circles" />
              <div className="db-pulse-circle" />
              <Cpu size={40} className={hasData ? "accent-green" : "accent-purple"} />
            </div>
            <h3 className="db-live-title">{hasData ? "Telemetria ativa" : "Pronto para receber dados"}</h3>
            <p className="db-live-sub">
              {hasData 
                ? "Recebendo dados em tempo real do dispositivo." 
                : "Ligue o simulador ou um dispositivo real para ver os dados em tempo real."}
            </p>
            <Link to="/simulator-contexts" className="btn-premium">
              <Play size={16} fill="white" />
              Abrir Simulador
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
