import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  loadAlerts,
  saveAlerts,
  ALERT_TYPE_LABELS,
  type AlertItem,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
} from "../utils/alerts";
import { loadSettings } from "../utils/settings";
import { alertsAPI } from "../services/api";
import type { BackendAlertEventDTO } from "../services/api";
import { useNotifications } from "../hooks/useNotifications";
import { 
  RefreshCw, 
  Search, 
  CheckCircle, 
  Filter, 
  X, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Activity, 
  Info, 
  AlertTriangle, 
  AlertCircle,
  ExternalLink,
  History,
  LayoutList,
  Bell,
  Zap,
  Settings
} from "lucide-react";

type StatusFilter = "all" | "unread" | "ack";
type SeverityFilter = "all" | "INFO" | "WARNING" | "CRITICAL";
type TypeFilter = "all" | AlertType;
type ViewMode = "list" | "timeline";

const PAGE_SIZE = 15;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const out = asString(value, "").trim();
  return out ? out : undefined;
}

function lowerText(value: unknown): string {
  return asString(value, "").toLowerCase();
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColorClass(sev: AlertItem["severity"]) {
  switch (sev) {
    case "CRITICAL": return "text-red";
    case "WARNING": return "text-yellow";
    default: return "text-muted";
  }
}

function severityDotColorClass(sev: AlertItem["severity"]) {
  switch (sev) {
    case "CRITICAL": return "bg-red";
    case "WARNING": return "bg-yellow";
    default: return "bg-blue";
  }
}

function typeIcon(type?: AlertType) {
  switch (type) {
    case "SPEED": return <Zap size={18} className="text-blue" />;
    case "BRAKING": return <AlertCircle size={18} className="text-red" />;
    case "TILT": return <Activity size={18} className="text-orange" />;
    case "ENGINE": return <Settings size={18} className="text-muted" />;
    case "BATTERY": return <Zap size={18} className="text-green" />;
    case "GEOFENCE": return <MapPin size={18} className="text-accent" />;
    case "IMPACT": return <AlertTriangle size={18} className="text-red animate-pulse" />;
    case "MAINTENANCE": return <Settings size={18} className="text-muted" />;
    default: return <Info size={18} className="text-accent" />;
  }
}

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  switch (severity) {
    case "CRITICAL": return <AlertCircle size={18} className="text-red" />;
    case "WARNING": return <AlertTriangle size={18} className="text-yellow" />;
    default: return <Info size={18} className="text-muted" />;
  }
}

export default function Alertas() {
  const location = useLocation();
  const navigate = useNavigate();
  const { markAllRead } = useNotifications();
  const [alerts, setAlerts] = useState<AlertItem[]>(() => loadAlerts());
  const [backendAlerts, setBackendAlerts] = useState<AlertItem[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Carregar histórico persistido do backend
  const loadBackendAlerts = useCallback(async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      const res = await alertsAPI.getAll({ limit: 200 });
      const mapped: AlertItem[] = res.data.map((ev: BackendAlertEventDTO) => {
        const eventType = asString(ev?.type, "UNKNOWN");
        const titleMapping: Record<string, string> = {
          ENGINE_OVERREV: "Rotações Excessivas",
          WHEELIE_DETECTED: "Wheelie Detetado",
          STOPPIE_DETECTED: "Stoppie Detetado",
          SAFETY_SYSTEM_ACTIVE: "Sistema de Segurança Ativo",
          HARD_BRAKING: "Travagem Brusca",
          EXCESSIVE_LEAN: "Inclinação Excessiva",
          HIGH_VIBRATION: "Vibração Anómala",
          OVERHEAT: "Sobreaquecimento",
          LOW_VOLTAGE: "Voltagem Baixa",
          CRASH_DETECTED: "Queda Detetada",
          RAPID_ACCELERATION: "Aceleração Brusca",
          TIRE_PRESSURE_LOW: "Pressão Pneus Baixa",
          OIL_PRESSURE_LOW: "Pressão Óleo Baixa",
          SPEEDING: "Excesso Velocidade",
        };
        
        const typeMapping: Record<string, AlertType> = {
          WHEELIE_DETECTED: "TILT",
          STOPPIE_DETECTED: "TILT",
          EXCESSIVE_LEAN: "TILT",
          SPEEDING: "SPEED",
          HARD_BRAKING: "BRAKING",
          RAPID_ACCELERATION: "SPEED",
          ENGINE_OVERREV: "ENGINE",
          OVERHEAT: "ENGINE",
          LOW_VOLTAGE: "BATTERY",
          OIL_PRESSURE_LOW: "ENGINE",
          TIRE_PRESSURE_LOW: "OTHER",
          CRASH_DETECTED: "IMPACT",
          SAFETY_SYSTEM_ACTIVE: "OTHER",
        };

        return {
          id: `backend:${asString(ev?.id, crypto.randomUUID())}`,
          title: titleMapping[eventType] ?? eventType.replace(/_/g, " "),
          message: asString(ev?.message, eventType),
          severity: ev.severity as AlertSeverity,
          type: typeMapping[eventType] ?? "OTHER",
          status: "ack" as AlertStatus,
          timestamp: asString(ev?.occurredAt, new Date().toISOString()),
          deviceId: asOptionalString(ev?.trip?.motorcycle?.deviceId),
          motoModel: asOptionalString(ev?.trip?.motorcycle?.name),
          tripId: asOptionalString(ev?.tripId),
          lat: typeof ev?.latitude === "number" ? ev.latitude : undefined,
          lng: typeof ev?.longitude === "number" ? ev.longitude : undefined,
          meta: {
            speedKmh: ev.speedKmh,
            rollDeg: ev.rollDeg,
            gForce: ev.gForce,
            engineTempC: ev.engineTempC,
            voltage: ev.voltage,
            source: ev.trip?.source,
          },
        };
      });
      setBackendAlerts(mapped);
    } catch {
      setBackendError("Erro ao carregar histórico.");
    } finally {
      setBackendLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendAlerts();
  }, [loadBackendAlerts]);

  useEffect(() => {
    document.title = "Alertas & Eventos — MotoGuard";
  }, []);

  useEffect(() => {
    const onUpdate = () => setAlerts(loadAlerts());
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, []);

  const allAlerts = useMemo(() => {
    const localIds = new Set(alerts.map((a) => a.id));
    const merged = [
      ...alerts,
      ...backendAlerts.filter((a) => !localIds.has(a.id)),
    ];
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, backendAlerts]);

  const devices = useMemo(() => {
    const set = new Set<string>();
    allAlerts.forEach((a) => { if (a.deviceId) set.add(a.deviceId); });
    return Array.from(set).sort();
  }, [allAlerts]);

  const types = useMemo(() => {
    const set = new Set<AlertType>();
    allAlerts.forEach((a) => { if (a.type) set.add(a.type); });
    return Array.from(set).sort();
  }, [allAlerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return allAlerts
      .filter((a) => status === "all" || a.status === status)
      .filter((a) => severity === "all" || a.severity === severity)
      .filter((a) => type === "all" || a.type === type)
      .filter((a) => deviceFilter === "all" || a.deviceId === deviceFilter)
      .filter((a) => {
        if (fromTs && new Date(a.timestamp).getTime() < fromTs) return false;
        if (toTs && new Date(a.timestamp).getTime() > toTs) return false;
        return true;
      })
      .filter((a) => {
        if (!q) return true;
        return (
          lowerText(a.title).includes(q) ||
          lowerText(a.message).includes(q) ||
          lowerText(a.deviceId).includes(q) ||
          lowerText(a.motoModel).includes(q)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allAlerts, query, severity, status, type, deviceFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [query, status, severity, type, deviceFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return allAlerts.find((a) => a.id === selectedId) ?? null;
  }, [allAlerts, selectedId]);

  useEffect(() => {
    const state = location.state as { selectedAlertId?: unknown } | null;
    const selectedFromState = typeof state?.selectedAlertId === "string" ? state.selectedAlertId : null;
    if (!selectedFromState) return;
    if (!allAlerts.some((a) => a.id === selectedFromState)) return;
    setSelectedId(selectedFromState);
  }, [allAlerts, location.state]);

  useEffect(() => {
    if (!selectedId) return;
    const settings = loadSettings();
    if (!settings.alerts.autoAckOnOpen) return;
    const current = allAlerts.find((a) => a.id === selectedId);
    if (!current || current.status !== "unread") return;
    const out = alerts.map<AlertItem>((a) =>
      a.id === selectedId ? { ...a, status: "ack" as AlertStatus } : a,
    );
    setAlerts(out);
    saveAlerts(out);
  }, [allAlerts, alerts, selectedId]);

  function setAlert(next: AlertItem) {
    const out = alerts.map((a) => (a.id === next.id ? next : a));
    setAlerts(out);
    saveAlerts(out);
  }

  function clearFilters() {
    setStatus("all");
    setSeverity("all");
    setType("all");
    setDeviceFilter("all");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  }

  const hasFilters = status !== "all" || severity !== "all" || type !== "all" || deviceFilter !== "all" || dateFrom || dateTo || query;

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-230px)] min-h-[550px] animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Bell size={24} />
            </div>
            Alertas <span className="text-muted/40 font-light">&</span> Eventos
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-accent font-black text-[0.6rem] uppercase tracking-widest">
                {allAlerts.filter((a) => a.status === "unread").length} Pendentes
              </span>
            </div>
            <span className="text-muted/20 font-black text-[0.65rem] uppercase tracking-widest">•</span>
            <span className="text-muted font-bold text-[0.65rem] uppercase tracking-widest">{filtered.length} visíveis</span>
            <span className="text-muted/20 font-black text-[0.65rem] uppercase tracking-widest">•</span>
            <span className="text-muted font-bold text-[0.65rem] uppercase tracking-widest">{allAlerts.length} total</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[0.65rem] font-black text-text uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-30 group"
            onClick={loadBackendAlerts}
            disabled={backendLoading}
          >
            <RefreshCw size={14} className={`${backendLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            Atualizar
          </button>
          {allAlerts.filter((a) => a.status === "unread").length > 0 && (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-[0.65rem] font-black text-accent uppercase tracking-widest hover:bg-accent/20 transition-all"
              onClick={() => { markAllRead(); setAlerts(loadAlerts()); }}
            >
              <CheckCircle size={14} />
              Marcar lidas
            </button>
          )}
          <div className="glass-panel p-1 flex gap-1 rounded-2xl bg-black/20">
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${viewMode === "list" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setViewMode("list")}
            >
              <LayoutList size={14} /> Lista
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${viewMode === "timeline" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setViewMode("timeline")}
            >
              <History size={14} /> Timeline
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 flex-1 min-h-0">
        {/* FILTER BAR */}
        <div className="p-2.5 bg-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col xl:flex-row gap-2.5 items-stretch xl:items-center shadow-xl shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="w-full bg-black/20 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-[0.7rem] font-bold text-text focus:outline-none focus:border-accent/40 placeholder:text-muted/40 transition-all"
              placeholder="Pesquisar mensagens, dispositivos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select
              className="bg-black/20 border border-white/5 rounded-xl py-1.5 px-3 text-[0.6rem] font-black text-text focus:outline-none focus:border-accent/40 appearance-none cursor-pointer hover:bg-black/30 transition-all min-w-[110px]"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">Estado: Todos</option>
              <option value="unread">Por ler</option>
              <option value="ack">Reconhecidos</option>
            </select>
            
            <select
              className="bg-black/20 border border-white/5 rounded-xl py-1.5 px-3 text-[0.6rem] font-black text-text focus:outline-none focus:border-accent/40 appearance-none cursor-pointer hover:bg-black/30 transition-all min-w-[110px]"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
            >
              <option value="all">Severidade</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
            </select>

            <select
              className="bg-black/20 border border-white/5 rounded-xl py-1.5 px-3 text-[0.6rem] font-black text-text focus:outline-none focus:border-accent/40 appearance-none cursor-pointer hover:bg-black/30 transition-all min-w-[130px]"
              value={type}
              onChange={(e) => setType(e.target.value as TypeFilter)}
            >
              <option value="all">Tipo de Evento</option>
              {types.map((t) => (
                <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
              ))}
            </select>

            {devices.length > 1 && (
              <select
                className="bg-black/20 border border-white/5 rounded-xl py-1.5 px-3 text-[0.6rem] font-black text-text focus:outline-none focus:border-accent/40 appearance-none cursor-pointer hover:bg-black/30 transition-all min-w-[130px]"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
              >
                <option value="all">Dispositivos</option>
                {devices.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {hasFilters && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[0.55rem] font-black text-red uppercase tracking-widest hover:bg-red/10 transition-all" onClick={clearFilters}>
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 flex-1 min-h-0">
          {/* LIST PANE */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-30 p-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-4xl">📭</div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-black text-white m-0 tracking-tight">Vazio</h3>
                    <p className="text-sm font-medium m-0 max-w-[200px]">Sem alertas que correspondam aos teus critérios.</p>
                  </div>
                </div>
              ) : viewMode === "list" ? (
                paginated.map((a) => (
                  <button
                    key={a.id}
                    className={`relative w-full p-5 rounded-2xl border transition-all text-left flex flex-col gap-3.5 overflow-hidden group min-h-[110px] ${selectedId === a.id ? "bg-accent/10 border-accent/40 shadow-lg" : "bg-white/[0.03] border-white/5 hover:border-white/20"}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    {a.status === "unread" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent shadow-[0_0_10px_rgba(139,92,246,0.5)]" />}
                    <div className="flex items-center justify-between gap-4 relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 transition-all ${selectedId === a.id ? "scale-110 bg-accent/20 border-accent/20" : "group-hover:scale-105"}`}>
                          {typeIcon(a.type)}
                        </div>
                        <span className={`text-[0.8rem] font-black tracking-tight transition-colors ${selectedId === a.id ? "text-accent" : "text-text group-hover:text-accent"}`}>{a.title}</span>
                      </div>
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest whitespace-nowrap opacity-60 flex items-center gap-1">
                        <Clock size={10} /> {formatDateTime(a.timestamp).split(',')[1].trim()}
                      </span>
                    </div>
                    <p className="text-[0.7rem] font-medium text-text-2 m-0 line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity">{a.message}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-[0.1em] opacity-40">{a.motoModel || a.deviceId || "SISTEMA"}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${severityDotColorClass(a.severity)}`} />
                        <span className={`text-[0.55rem] font-black uppercase tracking-widest ${severityColorClass(a.severity)}`}>{a.severity}</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="relative pl-10 flex flex-col gap-6 py-4">
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10" />
                  {paginated.map((a) => (
                    <div key={a.id} className="relative group">
                      <div className={`absolute -left-[31px] top-2.5 w-6 h-6 rounded-full border-4 border-[#0a0a0a] z-10 transition-transform group-hover:scale-110 shadow-lg ${severityDotColorClass(a.severity)}`} />
                      <button 
                        className={`w-full p-4 rounded-xl border transition-all text-left flex flex-col gap-2 ${selectedId === a.id ? "bg-accent/10 border-accent/40 shadow-lg" : "bg-white/[0.03] border-white/5 hover:border-white/20"}`}
                        onClick={() => setSelectedId(a.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {typeIcon(a.type)}
                            <span className="text-[0.8rem] font-black text-text tracking-tight">{a.title}</span>
                          </div>
                          <span className="text-[0.55rem] font-black text-muted opacity-60 uppercase tracking-widest">{formatDateTime(a.timestamp).split(',')[1].trim()}</span>
                        </div>
                        <p className="text-[0.7rem] font-medium text-text-2 m-0 line-clamp-1 opacity-70">{a.message}</p>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl shrink-0">
                <button 
                  className="px-3 py-1.5 rounded-lg text-[0.55rem] font-black uppercase tracking-widest text-muted hover:text-white disabled:opacity-20 transition-all hover:bg-white/5" 
                  onClick={() => setPage((p) => Math.max(1, p - 1))} 
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-black text-accent uppercase tracking-widest">{page}</span>
                  <span className="text-[0.65rem] font-black text-muted/30">/</span>
                  <span className="text-[0.65rem] font-black text-muted/60">{totalPages}</span>
                </div>
                <button 
                  className="px-3 py-1.5 rounded-lg text-[0.55rem] font-black uppercase tracking-widest text-muted hover:text-white disabled:opacity-20 transition-all hover:bg-white/5" 
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* DETAIL PANE */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative min-h-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12 text-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-accent/20 blur-[60px] rounded-full animate-pulse" />
                  <div className="relative w-32 h-32 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-6xl shadow-2xl transform hover:rotate-6 transition-transform duration-500">
                    🧾
                  </div>
                </div>
                <div className="flex flex-col gap-3 max-w-xs">
                  <h3 className="text-2xl font-black text-white m-0 tracking-tight">Seleciona um alerta</h3>
                  <p className="text-sm font-medium text-muted m-0 leading-relaxed opacity-60">Escolhe um item na lista para ver todos os detalhes e métricas de telemetria em tempo real.</p>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl font-black text-accent">{allAlerts.length}</span>
                    <span className="text-[0.5rem] font-black text-muted uppercase tracking-[0.2em]">Total</span>
                  </div>
                  <div className="w-px h-8 bg-white/10 self-center" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl font-black text-red">{allAlerts.filter(a => a.severity === 'CRITICAL').length}</span>
                    <span className="text-[0.5rem] font-black text-muted uppercase tracking-[0.2em]">Críticos</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent shrink-0">
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="flex-1 flex flex-col gap-2">
                      <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter m-0 flex items-center gap-4">
                        <span className="text-3xl md:text-4xl">{typeIcon(selected.type)}</span>
                        {selected.title}
                      </h2>
                      <div className="flex items-center gap-3 text-muted text-[0.65rem] font-bold uppercase tracking-widest opacity-60">
                        <Clock size={12} className="text-accent/60" /> {formatDateTime(selected.timestamp)}
                        {selected.motoModel && <><span className="text-accent/30">•</span> {selected.motoModel}</>}
                      </div>
                    </div>
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[0.6rem] font-black uppercase tracking-widest transition-all ${selected.status === "unread" ? "bg-accent text-white shadow-xl shadow-accent/20" : "bg-white/5 border border-white/10 text-muted hover:text-text hover:bg-white/10"}`}
                      onClick={() => setAlert({ ...selected, status: selected.status === "unread" ? "ack" : "unread" })}
                    >
                      {selected.status === "unread" ? <CheckCircle size={14} /> : <Search size={14} />}
                      {selected.status === "unread" ? "Reconhecer" : "Marcar por ler"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[0.55rem] font-black uppercase tracking-widest ${severityColorClass(selected.severity)} border-current/20 bg-current/10`}>
                      <SeverityIcon severity={selected.severity} />
                      {selected.severity}
                    </span>
                    {selected.type && (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-[0.55rem] font-black uppercase tracking-widest">
                        <Activity size={14} /> {ALERT_TYPE_LABELS[selected.type]}
                      </span>
                    )}
                    {selected.deviceId && (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted text-[0.55rem] font-black uppercase tracking-widest">
                        ID: {selected.deviceId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-8 custom-scrollbar">
                  <div className="flex flex-col gap-4">
                    <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-40">Mensagem do Sistema</span>
                    <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-base md:text-lg font-bold text-text leading-relaxed shadow-inner">
                      {selected.message}
                    </div>
                  </div>

                  {selected.meta && Object.keys(selected.meta).length > 0 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-40">Telemetria no Instante</span>
                        <div className="h-px flex-1 mx-4 bg-white/5" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(selected.meta).map(([key, value]) => {
                          if (value == null) return null;
                          return (
                            <div key={key} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1 group hover:border-accent/40 transition-all">
                              <span className="text-[0.5rem] font-black text-muted uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-base font-black text-white tracking-tight flex items-baseline gap-1">
                                {typeof value === 'number' ? value.toFixed(key.toLowerCase().includes('temp') ? 1 : 2) : String(value)}
                                <span className="text-[0.55rem] text-muted font-bold">
                                  {key.toLowerCase().includes('kmh') && "KM/H"}
                                  {key.toLowerCase().includes('temp') && "°C"}
                                  {key.toLowerCase().includes('voltage') && "V"}
                                  {key.toLowerCase().includes('deg') && "°"}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-40">Ações Rápidas & Localização</span>
                      <div className="h-px flex-1 mx-4 bg-white/5" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selected.lat != null && selected.lng != null && (
                        <a 
                          href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[0.65rem] font-black text-text uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-105"
                        >
                          <ExternalLink size={14} className="text-accent" /> Google Maps
                        </a>
                      )}
                      {selected.lat != null && (
                        <button className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[0.65rem] font-black text-text uppercase tracking-widest hover:bg-white/10 transition-all hover:scale-105" onClick={() => navigate(`/map`)}>
                          <MapPin size={14} className="text-accent" /> Ver no Mapa
                        </button>
                      )}
                      {selected.tripId && (
                        <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-white text-[0.65rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-accent/20" onClick={() => navigate(`/trips/${selected.tripId}`)}>
                          Analisar Viagem <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {selected.lat != null && selected.lng != null && (
                    <div className="p-6 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-4">
                      <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-40">Coordenadas GPS</span>
                      <div className="flex gap-12">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[0.5rem] font-black text-muted uppercase opacity-40">Latitude</span>
                          <code className="text-sm font-black text-accent tracking-wider">{selected.lat.toFixed(6)}</code>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[0.5rem] font-black text-muted uppercase opacity-40">Longitude</span>
                          <code className="text-sm font-black text-accent tracking-wider">{selected.lng.toFixed(6)}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
