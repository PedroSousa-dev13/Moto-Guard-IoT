import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tripsAPI, motorcyclesAPI, gpxAPI } from "../services/api";
import { Motorcycle } from "../types";
import { Activity, Navigation, AlertTriangle, CheckCircle, Zap } from "lucide-react";

export default function Gpx() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<any | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    void loadMotorcycles();
    void loadTrips();
  }, []);

  async function loadMotorcycles() {
    try {
      const res = await motorcyclesAPI.getAll();
      setMotorcycles(res.data);
      if (res.data.length > 0) setSelectedMotorcycleId(res.data[0].id);
    } catch (err) {
      console.error("Erro ao carregar motas", err);
    }
  }

  async function loadTrips() {
    try {
      setLoadingTrips(true);
      const res = await tripsAPI.getAll("GPX_IMPORTED");
      setTrips(res.data);
    } catch (err) {
      console.error("Erro ao carregar viagens", err);
    } finally {
      setLoadingTrips(false);
    }
  }

  async function importFile() {
    if (!file || !selectedMotorcycleId) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const res = await gpxAPI.import(file, selectedMotorcycleId);
      setImportSuccess(res.data);
      await loadTrips();
    } catch (err: any) {
      setImportError(err.response?.data?.error ?? "Erro ao importar ficheiro GPX");
    } finally {
      setImporting(false);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const hasMotorcycles = motorcycles.length > 0;
  const canImport = file && selectedMotorcycleId && !importing;

  return (
    <div className="flex flex-col gap-10 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-lg">
              <Activity size={24} />
            </span>
            Viagens Reais (GPX)
          </h1>
          <p className="text-muted font-medium text-sm">Importar e exportar rotas em formato GPX para análise detalhada.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10">
        <div className="flex flex-col gap-10">
          {/* IMPORT PANEL */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col gap-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50" />
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white tracking-tight m-0 flex items-center gap-3">
                <Navigation className="text-accent" size={24} /> Importar GPX
              </h2>
              <a 
                className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-accent hover:text-white transition-colors"
                href="https://www.wikiloc.com/trails/motorcycling" 
                target="_blank" 
                rel="noreferrer"
              >
                Conseguir ficheiros Wikiloc ↗
              </a>
            </div>

            <div className="flex flex-col gap-8">
              {!hasMotorcycles && (
                <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3">
                  <AlertTriangle size={18} />
                  <span>Não tens motas registadas. <Link to="/garage" className="underline hover:text-white transition-colors">Adiciona uma mota na Garagem</Link> antes de importar.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60">Ficheiro (.gpx)</span>
                  <input
                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-text focus:outline-none focus:border-accent/40 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[0.6rem] file:font-black file:uppercase file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
                    type="file"
                    accept=".gpx,application/gpx+xml,application/xml,text/xml"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60">Associar a Mota</span>
                  <select
                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-text focus:outline-none focus:border-accent/40 transition-all appearance-none cursor-pointer"
                    value={selectedMotorcycleId}
                    onChange={(e) => setSelectedMotorcycleId(e.target.value)}
                    disabled={!hasMotorcycles}
                  >
                    {motorcycles.length === 0 ? (
                      <option value="">— sem motas registadas —</option>
                    ) : (
                      motorcycles.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900">
                          {m.name}{m.brand ? ` (${m.brand})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {importError && (
                <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3">
                  <AlertTriangle size={18} />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-6 rounded-[2rem] bg-green/10 border border-green/20 flex flex-col gap-5 animate-slide-up">
                  <div className="flex items-center gap-3 text-green">
                    <CheckCircle size={20} />
                    <span className="text-sm font-black uppercase tracking-widest">Importação Concluída</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Pontos</span>
                      <span className="text-lg font-black text-white tabular-nums">{importSuccess.stats.points}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Distância</span>
                      <span className="text-lg font-black text-white tabular-nums">{importSuccess.stats.distanceKm.toFixed(2)} km</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Vel. Média</span>
                      <span className="text-lg font-black text-white tabular-nums">{importSuccess.stats.avgSpeedKmh.toFixed(1)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Vel. Máx</span>
                      <span className="text-lg font-black text-white tabular-nums">{importSuccess.stats.maxSpeedKmh.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      className="flex-1 px-6 py-3 rounded-xl bg-green text-white text-[0.65rem] font-black uppercase tracking-widest shadow-lg shadow-green/20 hover:scale-[1.02] transition-all"
                      onClick={() => navigate(`/trips/${importSuccess.tripId}`)}
                    >
                      Abrir Análise ↗
                    </button>
                    <Link 
                      className="flex-1 flex items-center justify-center px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[0.65rem] font-black uppercase tracking-widest text-text hover:bg-white/10 transition-all text-center"
                      to="/trips"
                    >
                      Ver no Histórico
                    </Link>
                  </div>
                </div>
              )}

              <button 
                className={`w-full py-4 rounded-2xl text-[0.7rem] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${importing ? 'bg-white/10 text-muted' : 'bg-accent text-white shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]'}`} 
                onClick={importFile} 
                disabled={!canImport}
              >
                {importing ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-muted border-t-accent animate-spin rounded-full" />
                    <span>A importar rota...</span>
                  </div>
                ) : (
                  "Confirmar Importação"
                )}
              </button>
            </div>
          </div>

          {/* TRIPS LIST */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white tracking-tight m-0">Importadas ({trips.length})</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-6" />
            </div>

            {loadingTrips ? (
              <div className="py-20 flex flex-col items-center justify-center gap-6 opacity-40">
                <div className="w-12 h-12 border-4 border-white/10 border-t-accent animate-spin rounded-full" />
                <span className="text-[0.6rem] font-black uppercase tracking-widest">Carregando viagens...</span>
              </div>
            ) : trips.length === 0 ? (
              <div className="bg-surface/20 border border-white/5 rounded-[2rem] py-20 flex flex-col items-center justify-center gap-6 text-center">
                <div className="text-6xl grayscale opacity-20">🧭</div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-black text-white tracking-tight m-0">Sem viagens importadas</h3>
                  <p className="text-sm font-medium text-muted max-w-[280px]">Importa o teu primeiro ficheiro GPX acima para começar a análise.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trips.map((t) => (
                  <Link 
                    key={t.id} 
                    to={`/trips/${t.id}`}
                    className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-6 hover:border-accent/40 hover:bg-white/5 transition-all shadow-xl group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-black text-white tracking-tight group-hover:text-accent transition-colors">
                          {t.motorcycle?.name ?? "Mota Desconhecida"}
                        </span>
                        <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
                          {formatDate(t.startedAt)}
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-lg bg-green/10 border border-green/20 text-green text-[0.55rem] font-black uppercase tracking-widest">
                        GPX
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Distância</span>
                        <span className="text-sm font-black text-text tabular-nums">{t.distanceKm?.toFixed(1) ?? "0.0"} km</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Vel. Média</span>
                        <span className="text-sm font-black text-text tabular-nums">{t.avgSpeedKmh?.toFixed(0) ?? "0"} km/h</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SIDE INFO */}
        <div className="flex flex-col gap-6">
          <div className="bg-accent/10 border border-accent/20 rounded-3xl p-8 flex flex-col gap-5 shadow-inner">
            <h3 className="text-sm font-black text-accent uppercase tracking-widest flex items-center gap-2 m-0">
              <Zap size={16} /> Dica de Performance
            </h3>
            <p className="text-xs font-medium text-accent/80 leading-relaxed m-0">
              O sistema MotoGuard analisa os pontos GPS para detetar acelerações laterais e padrões de inclinação aproximados. 
              Importa ficheiros com alta frequência (1Hz ou superior) para melhores resultados.
            </p>
          </div>
          
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 m-0">
              <Activity size={16} className="text-accent" /> Sobre GPX
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-accent shrink-0">1</div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-white uppercase tracking-tight">Privacidade</span>
                  <p className="text-[0.7rem] text-muted leading-relaxed">Os teus dados de localização são encriptados e nunca partilhados com terceiros.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-accent shrink-0">2</div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black text-white uppercase tracking-tight">Compatibilidade</span>
                  <p className="text-[0.7rem] text-muted leading-relaxed">Suportamos ficheiros exportados de Strava, Wikiloc, Garmin e apps mobile.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
