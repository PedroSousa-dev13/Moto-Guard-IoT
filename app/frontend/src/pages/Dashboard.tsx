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
import Card from "../components/ui/Card";
import AnimatedGauge from "../components/ui/AnimatedGauge";
import LastTripMiniMap from "../components/dashboard/LastTripMiniMap";

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
    return <div className="h-10 w-full mt-1 bg-panel animate-pulse rounded-lg" />;
  }
  return (
    <div className="h-10 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
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
            fill={`url(#grad-${color.replace('#', '')})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ 
  icon, label, value, unit, color, sparkData, footer, loading, children 
}: { 
  icon: any, label: string, value?: string, unit?: string, color: string, sparkData?: any[], footer: string, loading?: boolean, children?: React.ReactNode
}) {
  return (
    <div className="bg-surface/60 backdrop-blur-md border border-border-glass rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:bg-panel group relative overflow-hidden">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-panel flex items-center justify-center transition-colors group-hover:bg-panel-hover" style={{ color }}>
          {icon}
        </div>
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted">{label}</span>
      </div>
      
      <div className="flex-1 flex flex-col justify-center py-2">
        {loading ? (
          <div className="h-20 w-full bg-panel animate-pulse rounded-lg" />
        ) : children ? (
          <div className="flex justify-center items-center h-full">{children}</div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-text tracking-tighter leading-none">{value}</span>
            <span className="text-xs font-bold text-muted">{unit}</span>
          </div>
        )}
      </div>

      {sparkData && !children && <Sparkline data={sparkData} color={color} loading={loading} />}
      
      <div className="flex justify-between items-center text-[0.65rem] font-bold text-muted mt-1">
        <span>{loading ? "A aguardar dados..." : footer}</span>
        <TrendingUp size={12} className={loading ? "opacity-20" : "opacity-100"} />
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center gap-4 p-8">
      <div className="w-16 h-16 rounded-full bg-panel flex items-center justify-center text-muted border border-border-glass-subtle">
        <Radio size={32} className="animate-pulse" />
      </div>
      <p className="text-sm text-muted font-medium max-w-xs leading-relaxed">
        Sem telemetria ao vivo. Inicie o simulador ou ligue o dispositivo para ver os gráficos em tempo real.
      </p>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { telemetry, status, tripEndedSignal, realtimeAnomaly } = useSocket();
  const [lastTrip, setLastTrip] = useState<TripFeedItem | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { document.title = "Dashboard — MotoGuard"; }, []);

  useEffect(() => {
    tripsAPI.getFeed(undefined, undefined, 1)
      .then((r) => setLastTrip(r.data[0] ?? null))
      .catch(() => {});
  }, [tripEndedSignal]);

  const alerts = useMemo(() => loadAlerts(), [tripEndedSignal]);
  const recentAlerts = alerts.slice(0, 2);

  const tel = telemetry?.telemetry;
  const hasData = status.hasData && !!tel;

  useEffect(() => {
    if (hasData && tel) {
      setHistory(prev => {
        const next = [...prev, { 
          time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          speed: tel.speed_kmh,
          rpm: tel.rpm / 100,
          temp: tel.engine_temp_c,
          batt: tel.voltage
        }].slice(-300);
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

  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const container = document.getElementById("dashboard-scroll-container");
      if (!container) return;
      
      const target = e.target as HTMLElement;
      if (container.contains(target)) {
        return;
      }
      
      // Ignore wheel events inside sidebar or navbar to keep them fully native/static
      if (target.closest("aside") || target.closest("nav")) {
        return;
      }
      
      container.scrollTop += e.deltaY;
    };
    
    window.addEventListener("wheel", handleGlobalWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
    };
  }, []);

  return (
    <div 
      id="dashboard-scroll-container" 
      className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-8 relative"
    >
      {/* Floating Realtime Anomaly Alert */}
      {realtimeAnomaly && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className="bg-red/90 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-white">
            <AlertTriangle size={24} className="text-white" />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest opacity-70">ML Real-time Anomaly</span>
              <span className="text-sm font-bold">{realtimeAnomaly.reason}</span>
            </div>
          </div>
        </div>
      )}


      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text tracking-tight m-0">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`w-2 h-2 rounded-full ${hasData ? "bg-green shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-orange shadow-[0_0_10px_rgba(249,115,22,0.5)]"}`} />
            <span className="text-muted">{hasData ? "Visão geral do seu sistema em tempo real" : "Sistema em modo de espera"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[0.7rem] font-black uppercase tracking-widest border transition-all ${status.mqtt ? "bg-green/10 text-green border-green/20" : "bg-panel text-muted border-border-glass-subtle opacity-50"}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${status.mqtt ? 'animate-pulse' : ''}`} />
            MQTT
          </div>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[0.7rem] font-black uppercase tracking-widest border transition-all ${status.ws ? "bg-green/10 text-green border-green/20" : "bg-panel text-muted border-border-glass-subtle opacity-50"}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${status.ws ? 'animate-pulse' : ''}`} />
            WS
          </div>
        </div>
      </div>

      {/* ROW 1: Hero & Last Trip */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        {/* HERO CARD */}
        <div className="flex-1 min-w-0 relative rounded-3xl overflow-hidden border border-border-glass shadow-2xl group bg-surface/40 min-h-[320px] lg:min-h-0">
          <img 
            src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=2070&auto=format&fit=crop" 
            alt="Motorcycle" 
            className="absolute inset-0 w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute inset-0 flex flex-col justify-center p-10 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-2xl mb-6 transition-all duration-500 mx-0 ${hasData ? "bg-green/20 text-green border-green/30 shadow-green/20 scale-110" : "bg-white/10 text-white border-white/30 shadow-white/20"}`}>
              {hasData ? <CheckCircle2 size={36} className="text-green" /> : <Radio size={36} className="text-white animate-pulse" />}
            </div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{hasData ? "Tudo certo!" : "Pronto para iniciar"}</h2>
            <p className="text-white/80 text-sm font-medium max-w-xs leading-relaxed">
              {hasData 
                ? "Sistema ativo e monitorizando todos os parâmetros da sua moto em tempo real." 
                : "Ligue o simulador ou um dispositivo real para começar a monitorizar a sua viagem."}
            </p>
          </div>
        </div>

        {/* ÚLTIMA VIAGEM */}
        <Card className="lg:w-[280px] lg:h-[280px] lg:shrink-0" bodyClassName="flex flex-col gap-4 h-full justify-between">
          <div className="flex items-center justify-between px-1">
            <span className="text-[0.7rem] font-black uppercase tracking-widest text-text opacity-60">Última Viagem</span>
            <Link to="/trips" className="text-[0.65rem] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-1">
              Histórico <ChevronRight size={14} />
            </Link>
          </div>
          
          <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl flex-1 h-[120px] min-h-[120px] relative">
            <LastTripMiniMap trip={lastTrip} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 group/stat hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                <Clock size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-text tabular-nums leading-none">{lastTrip ? fmtTime(lastTrip.startedAt) : "--:--"}</span>
                <span className="text-[0.5rem] font-black text-muted uppercase tracking-widest opacity-40 leading-none mt-1">Início</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 group/stat hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                <Route size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-text tabular-nums leading-none">{lastTrip ? `${(lastTrip.distanceKm || 0).toFixed(1)}` : "0.0"} <span className="text-[0.6rem] opacity-40">km</span></span>
                <span className="text-[0.5rem] font-black text-muted uppercase tracking-widest opacity-40 leading-none mt-1">Distância</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 2: Measures & Alertas Recentes */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        {/* VALORES DE MEDIDAS */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={<Gauge size={20} />} 
            label="Velocidade" 
            color="var(--accent)" 
            footer={`Máxima: ${fmt(tel?.speed_kmh)} km/h`}
            loading={!hasData}
          >
            <AnimatedGauge 
              value={tel?.speed_kmh ?? 0} 
              max={220} 
              label="km/h" 
              unit="Velocidade" 
              color="var(--accent)" 
              size={100}
              strokeWidth={8}
            />
          </StatCard>
          
          <StatCard 
            icon={<Zap size={20} />} 
            label="RPM" 
            color="var(--green)" 
            footer={`Máxima: ${fmt(tel?.rpm)} rpm`}
            loading={!hasData}
          >
            <AnimatedGauge 
              value={(tel?.rpm ?? 0) / 100} 
              max={120} 
              label="x100" 
              unit="RPM" 
              color="var(--green)" 
              size={100}
              strokeWidth={8}
            />
          </StatCard>

          <StatCard 
            icon={<Thermometer size={20} />} 
            label="Temperatura" 
            value={fmt(tel?.engine_temp_c ?? 85)} 
            unit="°C" 
            color="var(--yellow)" 
            sparkData={tempSpark}
            footer="Normal"
            loading={!hasData}
          />
          <StatCard 
            icon={<Battery size={20} />} 
            label="Bateria" 
            value={fmt(tel?.voltage ?? 12.5)} 
            unit="V" 
            color="var(--red)" 
            sparkData={battSpark}
            footer="Saudável"
            loading={!hasData}
          />
        </div>

        {/* ALERTAS RECENTES */}
        <Card className="lg:w-[280px] lg:h-[280px] lg:shrink-0" bodyClassName="flex flex-col gap-4 h-full justify-between">
          <div className="flex items-center justify-between px-1">
            <span className="text-[0.7rem] font-black uppercase tracking-widest text-text opacity-60">Alertas Recentes</span>
            <Link to="/alertas" className="text-[0.65rem] font-black uppercase tracking-widest text-accent hover:underline">Ver Todos</Link>
          </div>
          
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 justify-start">
            {recentAlerts.length > 0 ? recentAlerts.map(a => (
              <Link
                key={a.id}
                to="/alertas"
                state={{ selectedAlertId: a.id }}
                className="flex items-center gap-4 p-3 rounded-2xl bg-panel border border-border-glass-subtle hover:bg-panel-hover transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110 ${a.severity === 'CRITICAL' ? 'bg-red/10 text-red border-red/20' : 'bg-orange/10 text-orange border-orange/20'}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="flex flex-col flex-1 gap-0.5">
                  <span className="text-sm font-black text-text leading-tight">{a.title}</span>
                  <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest">{fmtTime(a.timestamp)}</span>
                </div>
              </Link>
            )) : (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2 opacity-50">
                <CheckCircle2 size={32} className="text-muted" />
                <span className="text-xs font-black uppercase tracking-widest">Sem alertas ativos</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ROW 3: Live Telemetry & Telemetry Status */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        {/* MAIN CHART */}
        <Card className="flex-1 min-w-0 lg:h-[280px]" bodyClassName="flex flex-col gap-4 h-full justify-between overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-[0.7rem] font-black uppercase tracking-widest text-text opacity-60 ml-1">Telemetria ao Vivo</span>
            {hasData && (
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted">
                  <div className="w-2.5 h-1 rounded-full bg-accent" />
                  Velocidade
                </div>
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted">
                  <div className="w-2.5 h-1 rounded-full bg-green" />
                  RPM
                </div>
              </div>
            )}
          </div>

          <div className="h-[140px] w-full -mx-4 flex-1">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--green)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="rpm" stroke="var(--green)" strokeWidth={3} fillOpacity={1} fill="url(#colorRpm)" animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder />
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-border-glass-subtle">
            {[
              { label: "Duração", icon: <Clock size={16} />, val: hasData ? "00:22:14" : "--:--" },
              { label: "Distância", icon: <Route size={16} />, val: hasData ? "5.6 km" : "0.0 km" },
              { label: "Vel. Média", icon: <Activity size={16} />, val: hasData ? "15 km/h" : "0 km/h" },
              { label: "Vel. Máxima", icon: <Maximize2 size={16} />, val: hasData ? "128 km/h" : "0 km/h" },
              { label: "RPM Máx.", icon: <Zap size={16} />, val: hasData ? "9,850 rpm" : "0 rpm" }
            ].map(item => (
              <div key={item.label} className="flex flex-col gap-1">
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-panel flex items-center justify-center text-muted border border-border-glass-subtle shadow-inner">
                    {item.icon}
                  </div>
                  <span className="text-base font-black text-text tracking-tight">{item.val}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* TELEMETRIA AO VIVO STATUS */}
        <Card className="lg:w-[280px] lg:h-[280px] lg:shrink-0 relative overflow-hidden group" bodyClassName="flex flex-col items-center text-center justify-between gap-3 h-full">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative w-20 h-20 flex items-center justify-center mx-auto">
            <div className="absolute inset-0 border border-accent/5 rounded-full" />
            <div className="absolute inset-2 border border-accent/10 rounded-full" />
            <div className="absolute inset-4 border border-accent/20 rounded-full" />
            <div className={`absolute inset-0 border-2 border-accent rounded-full animate-ping opacity-0 ${hasData ? 'opacity-20' : ''}`} />
            <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 mx-auto ${hasData ? "bg-green text-white shadow-green/40 scale-110" : "bg-accent text-white shadow-accent/40"}`}>
              <Cpu size={24} />
            </div>
          </div>

          <div className="flex flex-col gap-1 max-w-[280px] px-1 mx-auto">
            <h3 className="text-lg font-black text-text m-0 tracking-tight">{hasData ? "Telemetria Ativa" : "Sistema em Standby"}</h3>
            <p className="text-xs text-muted font-medium leading-relaxed m-0 opacity-60">
              {hasData 
                ? "Recebendo fluxo constante de dados do motor e sensores periféricos." 
                : "Aguardando conexão com o dispositivo ou simulador para processar dados."}
            </p>
          </div>

          <Link to="/simulator-contexts" className="w-full max-w-[290px] mx-auto">
            <button className="w-full flex items-center justify-center gap-3 bg-accent text-white py-2.5 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all group/btn">
              <Play size={18} fill="white" className="transition-transform group-hover/btn:scale-110" />
              Abrir Simulador
            </button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
