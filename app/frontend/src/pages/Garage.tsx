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
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="panel-header" style={{ padding: '0 0 16px 0', marginBottom: '20px', background: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="panel-title" style={{ fontSize: '1rem', color: 'var(--text)' }}>
              {editId ? "Editar mota" : "Adicionar mota"}
            </span>
          </div>
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
            {saveError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{saveError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button type="button" className="btn btn-ghost" onClick={closeForm}><X size={14} /> Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Check size={14} /> {saving ? "A guardar..." : editId ? "Guardar Alterações" : "Adicionar à Garagem"}
              </button>
            </div>
          </form>
        </div>
      )}

      {motos.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-state-icon"><Bike size={48} /></div>
          <div className="empty-state-title">Garagem vazia</div>
          <div className="empty-state-text">Adiciona a tua primeira mota para começar a monitorizar.</div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Adicionar mota</button>
        </div>
      ) : (
        <div className="tile-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {motos.map((moto) => {
            const isDetail = detailId === moto.id;
            const isConfirmDelete = confirmDeleteId === moto.id;
            return (
              <div key={moto.id} className={`glass-panel ${isDetail ? "active" : ""}`} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                border: isDetail ? '1.5px solid var(--accent)' : undefined,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ 
                      width: 100, 
                      height: 70, 
                      borderRadius: 12, 
                      overflow: "hidden", 
                      background: "rgba(255,255,255,0.03)", 
                      flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '4px'
                    }}>
                      <img 
                        src={imageFromCategory(moto.category)} 
                        alt={moto.category ?? "moto"} 
                        style={{ width: "100%", height: "100%", objectFit: "contain", filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '4px' }}>{moto.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                        {[moto.brand, moto.model, moto.year].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: "rgba(139, 92, 246, 0.1)", color: "var(--accent)", border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                      {moto.category}
                    </span>
                    {moto.plate && (
                      <span className="pill" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-2)", border: '1px solid rgba(255,255,255,0.1)' }}>
                        {moto.plate}
                      </span>
                    )}
                    {moto.deviceId && (
                      <span className="pill" style={{ background: "rgba(255,255,255,0.03)", color: "var(--muted)", fontSize: '0.65rem', fontFamily: 'monospace' }}>
                        ID: {moto.deviceId}
                      </span>
                    )}
                  </div>

                  {isDetail && (
                    <div style={{ 
                      marginTop: '20px', 
                      paddingTop: '16px', 
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Odómetro</span>
                        <span style={{ color: 'var(--text)', fontWeight: 700 }}>{moto.odometer?.toLocaleString("pt-PT") ?? 0} km</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Visto em</span>
                        <span style={{ color: 'var(--text)', fontWeight: 700 }}>{moto.lastSeenAt ? new Date(moto.lastSeenAt).toLocaleString("pt-PT") : "Nunca"}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Registada em</span>
                        <span style={{ color: 'var(--text)', fontWeight: 700 }}>{moto.createdAt ? new Date(moto.createdAt).toLocaleDateString("pt-PT") : "—"}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ 
                  marginTop: 'auto', 
                  padding: '16px 20px', 
                  background: 'rgba(0,0,0,0.15)', 
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end'
                }}>
                  {isConfirmDelete ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--red)', flex: 1 }}>Confirmar remoção?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(moto.id)}>Remover</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Voltar</button>
                    </div>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" disabled={!moto.deviceId}
                        style={{ flex: 1 }}
                        onClick={() => navigate(`/dashboard?device=${moto.deviceId}`)}>
                        <Activity size={14} /> Monitorizar
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/trips?moto=${moto.id}`)} title="Ver Viagens">
                        <Route size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(isDetail ? null : moto.id)} title={isDetail ? "Menos info" : "Mais info"}>
                        {isDetail ? <X size={16} /> : <Activity size={16} style={{ opacity: 0.5 }} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(moto)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirmDeleteId(moto.id)} title="Remover">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
