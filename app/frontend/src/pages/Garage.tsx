import React, { useEffect, useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
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
          <div className="page-title">🏍️ Garagem</div>
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
        <div>
          <div className="page-title">🏍️ Garagem</div>
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
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {motos.map((moto) => {
            const isDetail = detailId === moto.id;
            const isConfirmDelete = confirmDeleteId === moto.id;
            return (
              <div
                key={moto.id}
                className="subpanel"
                style={{
                  border: isDetail ? "1.5px solid rgba(79,70,229,0.5)" : "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "var(--surface)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{moto.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      {[moto.brand, moto.model, moto.year].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {moto.category && (
                    <span className="badge-pill" style={{ background: "rgba(79,70,229,0.1)", color: "#4f46e5", whiteSpace: "nowrap" }}>
                      {moto.category}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {moto.plate && (
                    <span className="badge-pill" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                      {moto.plate}
                    </span>
                  )}
                </div>

                {/* Detail expandido */}
                {isDetail && (
                  <div style={{ fontSize: 13, color: "var(--muted)", display: "grid", gap: 4 }}>
                    {moto.profile && <div><strong>Perfil:</strong> {moto.profile.name ?? "—"}</div>}
                    {moto.odometer != null && <div><strong>Odómetro:</strong> {moto.odometer.toLocaleString("pt-PT")} km</div>}
                    {moto.lastSeenAt && <div><strong>Última atividade:</strong> {new Date(moto.lastSeenAt).toLocaleString("pt-PT")}</div>}
                    {moto.createdAt && <div><strong>Registada em:</strong> {new Date(moto.createdAt).toLocaleDateString("pt-PT")}</div>}
                  </div>
                )}

                {/* Actions */}
                {isConfirmDelete ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#ef4444", flex: 1 }}>Confirmar remoção?</span>
                    <button className="btn btn-sm" style={{ color: "#ef4444", borderColor: "#ef4444" }} onClick={() => void handleDelete(moto.id)}>Remover</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!moto.category}
                      title={moto.category ? "Abrir simulador para esta mota" : "Sem categoria associada"}
                      onClick={() => navigate(`/simulator-contexts?moto=${moto.id}`)}
                    >
                      <Activity size={13} /> Monitorizar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/trips?moto=${moto.id}`)}
                    >
                      <Route size={13} /> Ver viagens
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDetailId(isDetail ? null : moto.id)}
                    >
                      {isDetail ? "Fechar" : "Detalhes"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(moto)}>
                      <Pencil size={13} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "#ef4444" }}
                      onClick={() => setConfirmDeleteId(moto.id)}
                    >
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
