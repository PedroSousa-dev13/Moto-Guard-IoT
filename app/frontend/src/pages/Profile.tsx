import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authAPI, motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import Card from "../components/ui/Card";
import {
  User, Mail, Calendar, Shield, LogOut, Bike, Plus, X,
  Edit2, Trash2, Check, Key, Cpu, ChevronDown, ChevronUp, Eye, EyeOff,
  Gauge, Thermometer, Sliders, AlertTriangle, RefreshCw, Zap, Activity, Database
} from "lucide-react";

interface Msg { type: "success" | "error"; text: string }

export default function Profile() {
  const { user, logout } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", brand: "", year: "", deviceId: "", profileId: "" });

  // Profile edit
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  // Resend API key
  const [resendKey, setResendKey] = useState("");
  const [resendConfigured, setResendConfigured] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);
  const [resendMsg, setResendMsg] = useState<Msg | null>(null);

  useEffect(() => {
    document.title = "Perfil — MotoGuard";
    void loadData();
    void authAPI.getResendApiKeyStatus().then((r) => setResendConfigured(r.data.configured)).catch(() => {});
  }, []);

  useEffect(() => { if (user?.name) setProfileName(user.name); }, [user]);
  useEffect(() => { setEmergencyContact(user?.emergencyContact ?? ""); }, [user]);

  async function loadData() {
    try {
      setIsLoading(true);
      const [motosRes, profilesRes] = await Promise.all([
        motorcyclesAPI.getAll(),
        motorcyclesAPI.getProfiles(),
      ]);
      setMotorcycles(motosRes.data);
      setProfiles(profilesRes.data);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveResendKey(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingResend(true);
    setResendMsg(null);
    try {
      const res = await authAPI.saveResendApiKey(resendKey || null);
      setResendConfigured(res.data.configured);
      setResendKey("");
      setResendMsg({ type: "success", text: resendKey ? "API key guardada com sucesso." : "API key removida." });
    } catch {
      setResendMsg({ type: "error", text: "Erro ao guardar API key." });
    } finally {
      setIsSavingResend(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (isSavingProfile) return;
    if (newPassword && newPassword !== confirmPassword) {
      setProfileMsg({ type: "error", text: "As passwords não coincidem." });
      return;
    }
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      if (profileName !== user?.name || emergencyContact !== (user?.emergencyContact ?? "")) {
        await authAPI.updateProfile({ name: profileName, emergencyContact: emergencyContact || null });
      }
      if (newPassword && currentPassword) {
        await authAPI.changePassword(currentPassword, newPassword);
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      }
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso." });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.response?.data?.error ?? "Erro ao atualizar perfil." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAddMotorcycle(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);
    try {
      const payload: any = { name: form.name };
      if (form.brand) payload.brand = form.brand;
      if (form.year) payload.year = parseInt(form.year, 10);
      if (form.deviceId) payload.deviceId = form.deviceId;
      if (form.profileId) payload.profileId = form.profileId;
      const res = await motorcyclesAPI.create(payload);
      setMotorcycles((prev) => [res.data, ...prev]);
      setIsAdding(false);
      setForm({ name: "", brand: "", year: "", deviceId: "", profileId: "" });
    } catch (err: any) {
      setAddError(err.response?.data?.error ?? "Erro ao adicionar mota");
    } finally {
      setIsSubmitting(false);
    }
  }

  const initials = (user?.name ?? user?.email ?? "?")
    .split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-PT", { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-text flex items-center gap-3 tracking-tight">
          <User className="text-accent" size={28} /> Perfil
        </h1>
        <p className="text-muted text-sm font-medium">Gestão de conta, segurança e garagem pessoal.</p>
      </div>

      {/* ── Hero da conta ── */}
      <div className="bg-surface/60 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-xl relative overflow-hidden group">
        {/* Decorative background element */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-accent/20 blur-[100px] pointer-events-none group-hover:bg-accent/30 transition-colors duration-700" />
        
        <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-accent/40 border-4 border-white/10 flex-shrink-0">
          {initials}
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-black text-text mb-1 tracking-tight">{user?.name ?? "Utilizador"}</h2>
          <div className="text-muted font-medium mb-4 flex items-center justify-center md:justify-start gap-2">
            <Mail size={16} className="text-accent/60" /> {user?.email}
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span className="flex items-center gap-2 bg-white/5 border border-white/5 px-4 py-1.5 rounded-xl text-xs font-bold text-muted shadow-inner">
              <Calendar size={14} className="text-accent" /> Membro desde {memberSince}
            </span>
            <span className="flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-1.5 rounded-xl text-xs font-bold text-accent shadow-inner shadow-accent/5">
              <Bike size={14} /> {motorcycles.length} mota{motorcycles.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        
        <button className="flex items-center gap-2 bg-red/10 text-red border border-red/20 px-5 py-2.5 rounded-xl font-bold hover:bg-red/20 transition-all active:scale-95 text-sm md:self-start shadow-lg shadow-red/5" onClick={logout}>
          <LogOut size={16} /> Terminar sessão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Editar dados ── */}
        <Card title="Dados da Conta" className="overflow-hidden">
          <form onSubmit={(e) => void handleSaveProfile(e)} className="flex flex-col gap-6">
            {profileMsg && (
              <div role="status" className={`p-4 rounded-xl font-bold text-sm ${profileMsg.type === "success" ? "bg-green/10 text-green border border-green/20" : "bg-red/10 text-red border border-red/20"}`}>
                {profileMsg.text}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-name">Nome Completo</label>
                <input id="p-name" className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" value={profileName}
                  onChange={(e) => setProfileName(e.target.value)} placeholder="O teu nome" required />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-email">Endereço de Email</label>
                <input id="p-email" className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none opacity-50 cursor-not-allowed" value={user?.email ?? ""} readOnly disabled />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-emergency">Contacto de Emergência (Email)</label>
                <input
                  id="p-emergency"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none"
                  type="email"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="email@exemplo.com"
                />
                <p className="text-[0.7rem] text-muted font-bold leading-relaxed ml-1">
                  Este email será notificado automaticamente via GPS em caso de deteção de acidente.
                </p>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <button type="button" className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
              onClick={() => setShowSecurity((v) => !v)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20 group-hover:scale-110 transition-transform">
                  <Key size={18} />
                </div>
                <span className="font-black text-sm text-text">Segurança & Alterar Password</span>
              </div>
              {showSecurity ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
            </button>

            {showSecurity && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-black/20 border border-white/5 animate-slide-down">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-cur-pw">Password Atual</label>
                  <input id="p-cur-pw" className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" type="password"
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password" placeholder="••••••••" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-new-pw">Nova Password</label>
                  <input id="p-new-pw" className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" type="password"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" minLength={6} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-confirm-pw">Confirmar Nova Password</label>
                  <input id="p-confirm-pw" className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" type="password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" />
                </div>
              </div>
            )}

            <div className="flex justify-end mt-2">
              <button type="submit" className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-xl font-black text-sm hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95" disabled={isSavingProfile}>
                {isSavingProfile ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />} {isSavingProfile ? "A guardar..." : "Guardar Alterações"}
              </button>
            </div>
          </form>
        </Card>

        {/* ── Resend API Key ── */}
        <Card title="Notificações Resend" className="overflow-hidden">
          <form onSubmit={(e) => void handleSaveResendKey(e)} className="flex flex-col gap-6">
            {resendMsg && (
              <div role="status" className={`p-4 rounded-xl font-bold text-sm ${resendMsg.type === "success" ? "bg-green/10 text-green border border-green/20" : "bg-red/10 text-red border border-red/20"}`}>
                {resendMsg.text}
              </div>
            )}
            
            <div className={`p-5 rounded-2xl border flex flex-col gap-3 transition-all ${resendConfigured ? 'bg-green/5 border-green/10' : 'bg-yellow/5 border-yellow/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${resendConfigured ? 'bg-green/10 text-green border-green/20' : 'bg-yellow/10 text-yellow border-yellow/20'}`}>
                  {resendConfigured ? <Check size={20} /> : <AlertTriangle size={20} />}
                </div>
                <div className="font-black text-sm text-text">
                  {resendConfigured ? "Sistema Configurado" : "Aguardar Configuração"}
                </div>
              </div>
              <p className="text-[0.75rem] text-muted font-medium leading-relaxed m-0">
                A Resend API Key é necessária para enviar emails de alerta ao teu contacto de emergência em caso de acidente detetado.
                Obtém a tua key gratuitamente em <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-accent font-black hover:underline">resend.com</a>.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="p-resend-key">Resend API Key</label>
              <div className="relative group">
                <input
                  id="p-resend-key"
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-text font-black focus:border-accent outline-none transition-all group-hover:border-white/20"
                  type={showResendKey ? "text" : "password"}
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder={resendConfigured ? "•••••••••••••••••••••" : "re_..."}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors p-1"
                >
                  {showResendKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              {resendConfigured && (
                <button
                  type="button"
                  className="flex items-center gap-2 bg-red/10 text-red px-5 py-3 rounded-xl font-black text-sm hover:bg-red/20 transition-all active:scale-95"
                  disabled={isSavingResend}
                  onClick={async () => {
                    if (!confirm("Remover API key?")) return;
                    setIsSavingResend(true);
                    try {
                      await authAPI.saveResendApiKey(null);
                      setResendConfigured(false);
                      setResendMsg({ type: "success", text: "API key removida com sucesso." });
                    } catch { setResendMsg({ type: "error", text: "Erro ao remover API key." }); }
                    finally { setIsSavingResend(false); }
                  }}
                >
                  <Trash2 size={16} /> Remover
                </button>
              )}
              <button type="submit" className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-xl font-black text-sm hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95" disabled={isSavingResend || !resendKey}>
                {isSavingResend ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />} {isSavingResend ? "A guardar..." : "Guardar Key"}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {/* ── Motas ── */}
      <Card
        className="overflow-hidden"
        title={`As Minhas Motas`}
        subtitle={`${motorcycles.length} veículo${motorcycles.length !== 1 ? "s" : ""} registado${motorcycles.length !== 1 ? "s" : ""}`}
        headerActions={
          <button className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all active:scale-95 ${isAdding ? "bg-white/10 text-muted hover:text-text" : "bg-accent text-white shadow-lg shadow-accent/20 hover:scale-105"}`}
            onClick={() => { setIsAdding((v) => !v); setAddError(null); }}>
            {isAdding ? <><X size={18} /> Cancelar</> : <><Plus size={18} /> Adicionar Mota</>}
          </button>
        }
      >
        {isAdding && (
          <form onSubmit={handleAddMotorcycle} className="p-8 rounded-3xl bg-accent/5 border border-accent/10 mb-8 animate-slide-down flex flex-col gap-8 shadow-xl shadow-accent/5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-accent ml-1">Nome do Veículo *</label>
                <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required placeholder="Ex: Honda CB650R" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Marca / Modelo</label>
                <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none" value={form.brand}
                  onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                  placeholder="Ex: Honda" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Ano de Fabrico</label>
                <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none" type="number" value={form.year}
                  onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                  placeholder="2024" />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Device ID (Código do Dispositivo)</label>
                <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none" value={form.deviceId}
                  onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))}
                  placeholder="MOTOGUARD-SIM-XX" />
              </div>
              <div className="flex flex-col gap-2 xl:col-span-1">
                <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Perfil de Desempenho</label>
                <select className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-text font-black focus:border-accent outline-none cursor-pointer appearance-none" value={form.profileId}
                  onChange={(e) => setForm((p) => ({ ...p, profileId: e.target.value }))}>
                  <option value="">— Padrão —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.ccMin}–{p.ccMax} cc)</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <div className="p-4 rounded-xl bg-red/10 text-red border border-red/20 font-black text-sm">{addError}</div>}
            <div className="flex justify-end gap-3">
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-xl font-black text-sm hover:shadow-lg transition-all active:scale-95 disabled:opacity-30">
                {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />} {isSubmitting ? "A guardar..." : "Confirmar Adição"}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="text-accent animate-spin" size={48} />
            <div className="text-muted font-black uppercase tracking-widest text-xs">A carregar garagem...</div>
          </div>
        ) : motorcycles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-muted/20">
              <Bike size={64} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black text-text m-0">A garagem está vazia</h3>
              <p className="text-muted text-sm font-medium max-w-xs m-0">Associa a tua primeira mota para começar a monitorizar o teu desempenho e segurança.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {motorcycles.map((moto) => (
              <MotoRow key={moto.id} moto={moto} profiles={profiles}
                onUpdated={(u) => setMotorcycles((prev) => prev.map((m) => m.id === u.id ? u : m))}
                onDeleted={(id) => setMotorcycles((prev) => prev.filter((m) => m.id !== id))} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── MotoRow ─────────────────────────────────────────────────────────────────
function MotoRow({ moto, profiles, onUpdated, onDeleted }: {
  moto: Motorcycle; profiles: any[];
  onUpdated: (m: Motorcycle) => void; onDeleted: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [edit, setEdit] = useState({
    name: moto.name, brand: moto.brand ?? "", year: moto.year ? String(moto.year) : "",
    deviceId: moto.deviceId ?? "", profileId: moto.profileId ?? "",
  });

  const selectedProfile = edit.profileId ? profiles.find((p) => p.id === edit.profileId) ?? null : null;
  const currentProfile = moto.profileId ? profiles.find((p) => p.id === moto.profileId) ?? null : null;

  async function save() {
    setError(null); setIsSaving(true);
    try {
      const payload: any = { name: edit.name };
      payload.brand = edit.brand || null;
      payload.year = edit.year ? parseInt(edit.year, 10) : null;
      payload.deviceId = edit.deviceId || null;
      payload.profileId = edit.profileId || null;
      const res = await motorcyclesAPI.update(moto.id, payload);
      onUpdated(res.data); setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao guardar");
    } finally { setIsSaving(false); }
  }

  async function remove() {
    if (!confirm(`Apagar "${moto.name}"?`)) return;
    setIsDeleting(true);
    try {
      await motorcyclesAPI.remove(moto.id);
      onDeleted(moto.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao apagar");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className={`p-6 rounded-3xl border transition-all duration-300 flex flex-col gap-6 ${isEditing ? 'bg-accent/10 border-accent/40 shadow-xl shadow-accent/5' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 shadow-sm'}`}>
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${isEditing ? 'bg-accent text-white shadow-accent/40' : 'bg-black/40 text-muted border border-white/5 shadow-black/20'}`}>
          <Bike size={28} className={isEditing ? 'scale-110' : ''} />
        </div>
        
        <div className="flex-1">
          {!isEditing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h3 className="font-black text-lg text-text tracking-tight leading-none">{moto.name}</h3>
                <div className="flex gap-2">
                  {[moto.brand, moto.year].filter(Boolean).map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-lg bg-white/5 text-muted text-[0.65rem] font-black uppercase tracking-widest">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center mt-1">
                {moto.deviceId && (
                  <div className="flex items-center gap-2 text-[0.7rem] font-bold text-accent group">
                    <Cpu size={14} className="opacity-60" />
                    <span className="font-mono tracking-wider">{moto.deviceId}</span>
                  </div>
                )}
                {currentProfile && (
                  <div className="flex items-center gap-2 text-[0.7rem] font-bold text-blue">
                    <Zap size={14} className="opacity-60" />
                    <span>{currentProfile.name}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="font-black text-accent text-sm uppercase tracking-[0.2em] animate-pulse">Modo de Edição Ativo</div>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsEditing(true); setError(null); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-muted hover:text-accent hover:bg-accent/10 transition-all active:scale-90" title="Editar">
              <Edit2 size={16} />
            </button>
            <button onClick={remove} disabled={isDeleting} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-muted hover:text-red hover:bg-red/10 transition-all active:scale-90 disabled:opacity-30" title="Remover">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {!isEditing && currentProfile && (
        <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
          <button type="button" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted hover:text-text transition-colors w-fit"
            onClick={() => setShowProfile((v) => !v)}>
            {showProfile ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showProfile ? "Ocultar Especificações" : "Ver Perfil de Desempenho"}
          </button>
          {showProfile && (
            <div className="animate-slide-down">
              <ProfileDetails profile={currentProfile} />
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-black/40 border border-white/5 animate-slide-down shadow-inner">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[0.7rem] font-black uppercase tracking-widest text-accent ml-1">Nome do Veículo *</label>
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" value={edit.name}
              onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Marca / Modelo</label>
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" value={edit.brand}
              onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} placeholder="Ex: Honda" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Ano</label>
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" type="number" value={edit.year}
              onChange={(e) => setEdit((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2024" />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Device ID</label>
            <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none" value={edit.deviceId}
              onChange={(e) => setEdit((p) => ({ ...p, deviceId: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1">Perfil de Mota</label>
            <select className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none cursor-pointer appearance-none" value={edit.profileId}
              onChange={(e) => setEdit((p) => ({ ...p, profileId: e.target.value }))}>
              <option value="">— Sem perfil —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.ccMin}–{p.ccMax} cc)</option>
              ))}
            </select>
          </div>
          {selectedProfile && (
            <div className="md:col-span-2 flex flex-col gap-4 mt-2">
              <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-accent/60 ml-1">Pré-visualização do Perfil</div>
              <ProfileDetails profile={selectedProfile} />
            </div>
          )}
          {error && <div className="p-4 rounded-xl bg-red/10 text-red border border-red/20 font-black text-sm md:col-span-2">{error}</div>}
          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            <button onClick={() => { setIsEditing(false); setError(null); }} className="px-6 py-2.5 rounded-xl text-sm font-black text-muted hover:bg-white/5 transition-all">Cancelar</button>
            <button onClick={save} disabled={isSaving} className="flex items-center gap-2 bg-accent text-white px-8 py-2.5 rounded-xl font-black text-sm hover:shadow-lg transition-all active:scale-95 disabled:opacity-30">
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />} {isSaving ? "A guardar..." : "Guardar Alterações"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProfileDetails ───────────────────────────────────────────────────────────
function ProfileDetails({ profile }: { profile: any }) {
  const items = [
    { label: "Cilindrada", val: `${profile.ccMin}–${profile.ccMax} cc`, icon: <Activity size={16} />, color: "text-blue" },
    { label: "Vel. máx.", val: `${profile.maxSpeedKmh} km/h`, icon: <Gauge size={16} />, color: "text-orange" },
    { label: "Temp. Máx.", val: `${profile.engineTempMax} °C`, icon: <Thermometer size={16} />, color: "text-red" },
    { label: "Voltagem", val: `${profile.voltageMin}–${profile.voltageMax} V`, icon: <Zap size={16} />, color: "text-yellow" },
    { label: "Roll Máx.", val: `${profile.typicalMaxRollDeg}°`, icon: <Sliders size={16} />, color: "text-accent" },
    { label: "Impacto G", val: `${profile.crashGForce} G`, icon: <Shield size={16} />, color: "text-green" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((it) => (
        <div key={it.label} className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 shadow-inner group hover:border-white/10 transition-all">
          <div className={`flex items-center gap-2 text-[0.6rem] font-black uppercase tracking-widest ${it.color} opacity-80`}>
            {it.icon} {it.label}
          </div>
          <div className="text-sm font-black text-text group-hover:text-white transition-colors">{it.val}</div>
        </div>
      ))}
    </div>
  );
}
