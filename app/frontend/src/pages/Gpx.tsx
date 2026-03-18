import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { gpxAPI, motorcyclesAPI, tripsAPI } from "../services/api";
import type { Motorcycle, Trip } from "../types";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Gpx() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState<string>("AUTO");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    tripId: string;
    points: number;
    distanceKm: number;
    totalTimeSec: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
  } | null>(null);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    async function load() {
      const [motosRes, tripsRes] = await Promise.all([
        motorcyclesAPI.getAll(),
        tripsAPI.getAll("GPX_IMPORTED"),
      ]);
      setMotorcycles(motosRes.data);
      setTrips(tripsRes.data);
      setLoadingTrips(false);
    }
    void load();
  }, []);

  const canImport = !!file && !importing;

  const selectedMotorcycle = useMemo(() => {
    if (selectedMotorcycleId === "AUTO") return null;
    return motorcycles.find((m) => m.id === selectedMotorcycleId) ?? null;
  }, [motorcycles, selectedMotorcycleId]);

  async function importFile() {
    if (!file) return;
    try {
      setImporting(true);
      setImportError(null);
      setImportSuccess(null);
      const res = await gpxAPI.import(file, selectedMotorcycleId === "AUTO" ? undefined : selectedMotorcycleId);
      setImportSuccess({
        tripId: res.data.tripId,
        points: res.data.stats.points,
        distanceKm: res.data.stats.distanceKm,
        totalTimeSec: res.data.stats.totalTimeSec,
        avgSpeedKmh: res.data.stats.avgSpeedKmh,
        maxSpeedKmh: res.data.stats.maxSpeedKmh,
      });
      const tripsRes = await tripsAPI.getAll("GPX_IMPORTED");
      setTrips(tripsRes.data);
    } catch (err: any) {
      const serverError = err?.response?.data?.error;
      const status = err?.response?.status;
      const fallback = status ? `Falha ao importar GPX (HTTP ${status}).` : `Falha ao importar GPX (${err?.message ?? "erro desconhecido"}).`;
      setImportError(serverError ?? fallback);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">🧭 Viagens Reais (GPX)</div>
          <div className="page-subtitle">Importar e exportar rotas em formato GPX</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Importar GPX</div>
          <a className="btn btn-ghost btn-sm" href="https://www.wikiloc.com/trails/motorcycling" target="_blank" rel="noreferrer">
            consigue aqui os ficheiros gpx
          </a>
        </div>
        <div className="panel-body">
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field field-span-2">
              <div className="field-label">Ficheiro (.gpx)</div>
              <input
                className="control"
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="field field-span-2">
              <div className="field-label">Associar a mota</div>
              <select
                className="control"
                value={selectedMotorcycleId}
                onChange={(e) => setSelectedMotorcycleId(e.target.value)}
              >
                <option value="AUTO">Automático (última mota)</option>
                {motorcycles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.brand ? ` (${m.brand})` : ""}
                  </option>
                ))}
              </select>
              {selectedMotorcycle && (
                <div className="page-subtitle" style={{ marginTop: 8 }}>
                  Vai importar como: <strong>{selectedMotorcycle.name}</strong>
                </div>
              )}
            </div>
          </div>

          {importError && (
            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              {importError}
            </div>
          )}

          {importSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 12 }}>
              <strong>Importação concluída</strong>
              <div style={{ marginTop: 6 }}>
                Pontos: {importSuccess.points} · Distância: {importSuccess.distanceKm.toFixed(2)} km · Vel. média:{" "}
                {importSuccess.avgSpeedKmh.toFixed(1)} km/h · Vel. máx: {importSuccess.maxSpeedKmh.toFixed(1)} km/h
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/trips/${importSuccess.tripId}`)}
                >
                  Abrir análise
                </button>
                <Link className="btn btn-ghost btn-sm" to="/trips">
                  Ver no histórico
                </Link>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={importFile} disabled={!canImport}>
            {importing ? "A importar..." : "Importar"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header">
          <div className="panel-title">Importadas ({trips.length})</div>
        </div>
        <div className="panel-body">
          {loadingTrips ? (
            <div className="empty-state" style={{ padding: "32px 18px" }}>
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-title">A carregar...</div>
            </div>
          ) : trips.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 18px" }}>
              <div className="empty-state-icon">🧭</div>
              <div className="empty-state-title">Ainda não importaste nenhum GPX</div>
              <div className="empty-state-text">Escolhe um ficheiro GPX acima para começar.</div>
            </div>
          ) : (
            <div className="trip-list">
              {trips.map((t) => (
                <div key={t.id} className="trip-card">
                  <div className="trip-row" style={{ cursor: "default" }}>
                    <div className="trip-left">
                      <div className="trip-title-row">
                        <span className="trip-title">
                          🧭 {t.motorcycle?.name ?? "—"}
                          {t.motorcycle?.brand ? ` (${t.motorcycle.brand})` : ""}
                        </span>
                        <span
                          className="badge-pill"
                          style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}
                        >
                          GPX
                        </span>
                      </div>
                      <span className="trip-date">{formatDate(t.startedAt)}</span>
                    </div>
                    <div className="trip-right">
                      {t.distanceKm != null && <div className="mini-stat"><div className="mini-stat-value">{t.distanceKm.toFixed(1)} km</div><div className="mini-stat-label">Distância</div></div>}
                      {t.avgSpeedKmh != null && <div className="mini-stat"><div className="mini-stat-value">{t.avgSpeedKmh.toFixed(0)} km/h</div><div className="mini-stat-label">Vel. média</div></div>}
                      <Link to={`/trips/${t.id}`} className="btn btn-primary btn-sm">
                        Abrir
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
