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
    } catch (err: unknown) {
      setSaveError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao guardar mota.");
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
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao remover mota.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-text flex items-center gap-3 tracking-tight">
              <Bike className="text-accent" size={28} /> Garagem
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-surface/60 backdrop-blur-md border border-white/10 rounded-2xl">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-text mb-2">Erro</h2>
        <p className="text-muted mb-6">{error}</p>
        <button className="bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95" onClick={() => void load()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const detail = detailId ? motos.find((m) => m.id === detailId) : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text flex items-center gap-4 tracking-tight">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Bike size={24} />
            </div>
            Minha Garagem
          </h1>
          <p className="text-muted text-sm font-medium mt-1">
            {motos.length} mota{motos.length !== 1 ? "s" : ""} registadas na sua conta premium
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl font-bold hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95" onClick={openAdd}>
            <Plus size={18} /> Adicionar mota
          </button>
        </div>
      </div>

      {/* Formulário add/edit */}
      {showAdd && (
        <div className="bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <h2 className="text-lg font-extrabold text-text uppercase tracking-wider">
              {editId ? "Editar mota" : "Adicionar nova mota"}
            </h2>
            <button onClick={closeForm} className="text-muted hover:text-text transition-colors">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-name">Nome *</label>
                <input id="g-name" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Bandit 650" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-brand">Marca</label>
                <input id="g-brand" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} placeholder="Ex: Suzuki" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-model">Modelo</label>
                <input id="g-model" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="Ex: GSF650" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-year">Ano</label>
                <input id="g-year" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" type="number" min={1900} max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2020" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-plate">Matrícula</label>
                <input id="g-plate" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={form.plate} onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))} placeholder="Ex: AA-00-BB" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-bold uppercase tracking-widest text-muted" htmlFor="g-category">Categoria *</label>
                <select
                  id="g-category"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-text focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none cursor-pointer"
                  required
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="" className="bg-surface">— escolher categoria —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-surface">{c}</option>
                  ))}
                </select>
              </div>
            </div>
            {saveError && <div className="mt-4 p-3 bg-red/10 border border-red/20 text-red text-sm font-bold rounded-xl">{saveError}</div>}
            <div className="flex items-center justify-end gap-3 mt-8">
              <button type="button" className="px-5 py-2.5 rounded-xl font-bold text-muted hover:bg-white/5 transition-all" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="flex items-center gap-2 bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-50" disabled={saving}>
                <Check size={18} /> {saving ? "A guardar..." : editId ? "Guardar Alterações" : "Adicionar à Garagem"}
              </button>
            </div>
          </form>
        </div>
      )}

      {motos.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-12 bg-surface/40 backdrop-blur-md border border-dashed border-white/20 rounded-3xl">
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-6">
            <Bike size={40} className="text-accent" />
          </div>
          <h2 className="text-2xl font-black text-text mb-2">Garagem vazia</h2>
          <p className="text-muted max-w-xs mb-8">Adicione a sua primeira mota para começar a monitorizar o seu desempenho e segurança.</p>
          <button className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95" onClick={openAdd}>
            <Plus size={20} /> Adicionar mota
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {motos.map((moto) => {
            const isDetail = detailId === moto.id;
            const isConfirmDelete = confirmDeleteId === moto.id;
            return (
              <div key={moto.id} className={`relative group bg-surface/60 backdrop-blur-md border ${isDetail ? 'border-accent shadow-lg shadow-accent/10' : 'border-white/10 shadow-sm'} rounded-2xl flex flex-col transition-all duration-300 hover:border-white/20 overflow-hidden min-h-[220px]`}>
                <img 
                  src={imageFromCategory(moto.category)} 
                  alt={moto.category ?? "moto"} 
                  className="moto-card-bg"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-surface/0 pointer-events-none" />
                <div className="p-6 relative z-10 flex-1 flex flex-col">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-xl text-text truncate leading-tight mb-1 group-hover:text-accent transition-colors">{moto.name}</h3>
                    <p className="text-[0.7rem] text-muted font-bold uppercase tracking-wider">
                      {[moto.brand, moto.model, moto.year].filter(Boolean).join(" · ") || "Especificação base"}
                    </p>
                  </div>

                  <div className="badge-row mt-4">
                    <span className="text-[0.65rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/20 shadow-inner">
                      {moto.category}
                    </span>
                    {moto.plate && (
                      <span className="text-[0.65rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-white/5 text-text-2 border border-white/10">
                        {moto.plate}
                      </span>
                    )}
                  </div>

                  {isDetail && (
                    <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-3 animate-fade-in">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted font-bold uppercase tracking-tighter">Odómetro</span>
                        <span className="text-text font-black">{moto.odometer?.toLocaleString("pt-PT") ?? 0} km</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted font-bold uppercase tracking-tighter">Visto em</span>
                        <span className="text-text font-black">{moto.lastSeenAt ? new Date(moto.lastSeenAt).toLocaleString("pt-PT") : "Nunca"}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted font-bold uppercase tracking-tighter">ID Dispositivo</span>
                        <span className="text-accent font-mono text-[0.6rem] font-bold">{moto.deviceId || "—"}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-black/20 border-t border-white/5 flex gap-2 justify-end relative z-10 mt-auto">
                  {isConfirmDelete ? (
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-xs font-bold text-red flex-1 animate-pulse">Confirmar remoção?</span>
                      <button className="bg-red text-white px-4 py-2 rounded-xl text-xs font-bold hover:brightness-110 transition-all" onClick={() => void handleDelete(moto.id)}>Remover</button>
                      <button className="text-muted hover:text-text px-3 py-2 rounded-xl text-xs font-bold transition-all" onClick={() => setConfirmDeleteId(null)}>Voltar</button>
                    </div>
                  ) : (
                    <>
                      <button className="flex-1 flex items-center justify-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
                        disabled={!moto.deviceId}
                        onClick={() => navigate(`/dashboard?device=${moto.deviceId}`)}>
                        <Activity size={14} /> Monitorizar
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-muted hover:text-text hover:bg-white/10 transition-all" onClick={() => navigate(`/trips?moto=${moto.id}`)} title="Ver Viagens">
                        <Route size={18} />
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-muted hover:text-text hover:bg-white/10 transition-all" onClick={() => setDetailId(isDetail ? null : moto.id)} title={isDetail ? "Menos info" : "Mais info"}>
                        {isDetail ? <X size={18} /> : <Activity size={18} className="opacity-50" />}
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-muted hover:text-text hover:bg-white/10 transition-all" onClick={() => openEdit(moto)} title="Editar">
                        <Pencil size={18} />
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-red/60 hover:text-red hover:bg-red/10 transition-all" onClick={() => setConfirmDeleteId(moto.id)} title="Remover">
                        <Trash2 size={18} />
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
