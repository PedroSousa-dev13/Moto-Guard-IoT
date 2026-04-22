import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import Card from "../components/ui/Card";
import { SkeletonCard } from "../components/ui/Skeleton";
import { CATEGORIES, deviceIdFromCategory } from "../utils/categoryDeviceMap";
import {
  Bike,
  Plus,
  Pencil,
  Trash2,
  Activity,
  Route,
  X,
  Check,
} from "lucide-react";
import { imageFromCategory } from "../utils/categoryImageMap";

interface FormState {
  name: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  category: string;
}

const EMPTY_FORM: FormState = { name: "", brand: "", model: "", year: "", plate: "", category: "" };

export default function Garage() {
  const navigate = useNavigate();
  const [motos, setMotos] = useState<Motorcycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Garagem — MotoGuard";
    void load();
  }, []);

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await motorcyclesAPI.getAll();
      setMotos(res.data);
    } catch {
      setError("Não foi possível carregar as motas. Verifica a ligação ao servidor.");
    } finally {
      setIsLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSaveError(null);
    setShowAdd(true);
  }

  function openEdit(m: Motorcycle) {
    setForm({
      name: m.name ?? "",
      brand: m.brand ?? "",
      model: m.model ?? "",
      year: m.year != null ? String(m.year) : "",
      plate: m.plate ?? "",
      category: m.category ?? "",
    });
    setEditId(m.id);
    setSaveError(null);
    setShowAdd(true);
  }

  function closeForm() {
    setShowAdd(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.category) {
      setSaveError("Seleciona uma categoria.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      year: form.year ? Number(form.year) : undefined,
      plate: form.plate.trim() || undefined,
      category: form.category,
      deviceId: deviceIdFromCategory(form.category),
    };
    try {
      if (editId) {
        await motorcyclesAPI.update(editId, payload);
      } else {
        await motorcyclesAPI.create(payload);
      }
      closeForm();
      await load();
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? "Erro ao guardar mota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await motorcyclesAPI.remove(id);
      setConfirmDeleteId(null);
      if (detailId === id) setDetailId(null);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? "Erro ao remover mota.");
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="header-main">
            <div className="page-title"><Bike className="title-icon" size={24} />Garagem</div>
          </div>
        </div>
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro</div>
          <div className="empty-state-text">{error}</div>
          <button className="btn btn-primary" onClick={() => void load()}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  const detail = detailId ? motos.find((m) => m.id === detailId) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title"><Bike className="title-icon" size={24} />Garagem</div>
          <div className="page-subtitle">{motos.length} mota{motos.length !== 1 ? "s" : ""} registadas</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={16} /> Adicionar mota
          </button>
        </div>
      </div>

      {/* Formulário add/edit */}
      {showAdd && (
        <Card title={editId ? "Editar mota" : "Adicionar mota"}>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="g-name">Nome *</label>
                <input id="g-name" className="control" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Bandit 650" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="g-brand">Marca</label>
                <input id="g-brand" className="control" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} placeholder="Ex: Suzuki" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="g-model">Modelo</label>
                <input id="g-model" className="control" value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="Ex: GSF650" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="g-year">Ano</label>
                <input id="g-year" className="control" type="number" min={1900} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2020" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="g-plate">Matrícula</label>
                <input id="g-plate" className="control" value={form.plate} onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))} placeholder="Ex: AA-00-BB" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="g-category">Categoria *</label>
                <select
                  id="g-category"
                  className="control"
                  required
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="">— escolher categoria —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            {saveError && <div className="alert alert-danger" style={{ marginTop: 10 }}>{saveError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={closeForm}><X size={14} /> Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Check size={14} /> {saving ? "A guardar..." : editId ? "Guardar" : "Adicionar"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {motos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Bike size={48} /></div>
          <div className="empty-state-title">Garagem vazia</div>
          <div className="empty-state-text">Adiciona a tua primeira mota para começar a monitorizar.</div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Adicionar mota</button>
        </div>
      ) : (
        <div className="garage-grid">
          {motos.map((moto) => {
            const isDetail = detailId === moto.id;
            const isConfirmDelete = confirmDeleteId === moto.id;
            return (
              <div key={moto.id} className={`garage-card ${isDetail ? "garage-card-active" : ""}`}>
                <div className="garage-card-header">
                  <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }}>
                    <div className="garage-card-img" style={{ width: 80, height: 60, borderRadius: 8, overflow: "hidden", background: "var(--surface-3)", flexShrink: 0 }}>
                      <img 
                        src={imageFromCategory(moto.category)} 
                        alt={moto.category ?? "moto"} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => console.error("Failed to load image in Garage:", (e.target as HTMLImageElement).src)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="garage-card-name">{moto.name}</div>
                      <div className="garage-card-sub">
                        {[moto.brand, moto.model, moto.year].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    {moto.category && (
                      <span className="badge-pill" style={{ background: "var(--accent-light)", color: "var(--accent)", whiteSpace: "nowrap" }}>
                        {moto.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="garage-card-badges">
                  {moto.plate && (
                    <span className="badge-pill" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                      {moto.plate}
                    </span>
                  )}
                  {moto.deviceId && (
                    <span className="badge-pill" style={{ background: "var(--surface-3)", color: "var(--muted)", fontFamily: "monospace", fontSize: "0.7rem" }}>
                      {moto.deviceId}
                    </span>
                  )}
                </div>

                {isDetail && (
                  <div className="garage-card-detail">
                    {moto.profile && <div className="garage-detail-row"><span>Perfil</span><span>{moto.profile.name ?? "—"}</span></div>}
                    {moto.odometer != null && <div className="garage-detail-row"><span>Odómetro</span><span>{moto.odometer.toLocaleString("pt-PT")} km</span></div>}
                    {moto.lastSeenAt && <div className="garage-detail-row"><span>Última atividade</span><span>{new Date(moto.lastSeenAt).toLocaleString("pt-PT")}</span></div>}
                    {moto.createdAt && <div className="garage-detail-row"><span>Registada em</span><span>{new Date(moto.createdAt).toLocaleDateString("pt-PT")}</span></div>}
                  </div>
                )}

                {isConfirmDelete ? (
                  <div className="garage-confirm-delete">
                    <span>Confirmar remoção?</span>
                    <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(moto.id)}>Remover</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="garage-card-actions">
                    <button className="btn btn-primary btn-sm" disabled={!moto.deviceId}
                      title={moto.deviceId ? "Abrir dashboard para esta mota" : "Sem device ID associado"}
                      onClick={() => navigate(`/dashboard?device=${moto.deviceId}`)}>
                      <Activity size={13} /> Monitorizar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/trips?moto=${moto.id}`)}>
                      <Route size={13} /> Viagens
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(isDetail ? null : moto.id)}>
                      {isDetail ? "Fechar" : "Detalhes"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(moto)}><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirmDeleteId(moto.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
