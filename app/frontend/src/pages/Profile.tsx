import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authAPI, motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import Card from "../components/ui/Card";
import {
  User, Mail, Calendar, Shield, LogOut, Bike, Plus, X,
  Edit2, Trash2, Check, Key, Cpu, ChevronDown, ChevronUp, Eye, EyeOff,
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
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title"><User className="title-icon" size={24} />Perfil</div>
          <div className="page-subtitle">Conta, segurança e motas associadas</div>
        </div>
      </div>

      {/* ── Hero da conta ── */}
      <div className="glass-panel" style={{
        padding: "32px",
        marginBottom: "28px",
        display: "flex",
        alignItems: "center",
        gap: "28px",
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))",
        border: "1px solid rgba(139, 92, 246, 0.2)",
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background element */}
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'var(--accent)', filter: 'blur(100px)', opacity: 0.15, pointerEvents: 'none' }} />
        
        <div style={{ 
          width: 90, height: 90, borderRadius: '50%', background: 'var(--accent)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 900, color: '#fff', 
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
          border: '4px solid rgba(255,255,255,0.1)'
        }}>
          {initials}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: 'var(--text)', marginBottom: '4px' }}>{user?.name ?? "Utilizador"}</div>
          <div style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '12px', opacity: 0.8 }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', fontSize: '0.8rem' }}>
              <Calendar size={13} style={{ marginRight: 6 }} /> Membro desde {memberSince}
            </span>
            <span className="pill" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent)', fontSize: '0.8rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <Bike size={13} style={{ marginRight: 6 }} /> {motorcycles.length} mota{motorcycles.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        
        <button className="btn btn-danger btn-sm" onClick={logout} style={{ alignSelf: 'flex-start' }}>
          <LogOut size={14} /> Terminar sessão
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* ── Editar dados ── */}
        <Card title="Dados da Conta" className="glass-panel">
          <form onSubmit={(e) => void handleSaveProfile(e)} style={{ display: "grid", gap: 16 }}>
            {profileMsg && (
              <div role="status" className={`alert ${profileMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {profileMsg.text}
              </div>
            )}
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="p-name">Nome</label>
                <input id="p-name" className="control" value={profileName}
                  onChange={(e) => setProfileName(e.target.value)} placeholder="O teu nome" required />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="p-email">Email</label>
                <input id="p-email" className="control" value={user?.email ?? ""} readOnly disabled style={{ opacity: 0.5 }} />
              </div>
              <div className="field field-span-2">
                <label className="field-label" htmlFor="p-emergency">Contacto de emergência</label>
                <input
                  id="p-emergency"
                  className="control"
                  type="email"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="email@exemplo.com"
                />
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                  Notificado automaticamente via GPS em caso de acidente (CRASH_DETECTED).
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />

            <button type="button" className="btn btn-ghost" style={{ justifyContent: 'space-between', width: '100%', padding: '12px 16px' }}
              onClick={() => setShowSecurity((v) => !v)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Key size={16} className="accent-blue" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Segurança & Password</span>
              </div>
              {showSecurity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSecurity && (
              <div className="form-grid" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="field">
                  <label className="field-label" htmlFor="p-cur-pw">Password atual</label>
                  <input id="p-cur-pw" className="control" type="password"
                    value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password" placeholder="••••••••" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="p-new-pw">Nova password</label>
                  <input id="p-new-pw" className="control" type="password"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" minLength={6} />
                </div>
                <div className="field field-span-2">
                  <label className="field-label" htmlFor="p-confirm-pw">Confirmar nova password</label>
                  <input id="p-confirm-pw" className="control" type="password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
                <Check size={14} /> {isSavingProfile ? "A guardar..." : "Guardar alterações"}
              </button>
            </div>
          </form>
        </Card>

        {/* ── Resend API Key ── */}
        <Card title="Email de Emergência — Resend" className="glass-panel">
          <form onSubmit={(e) => void handleSaveResendKey(e)} style={{ display: "grid", gap: 16 }}>
            {resendMsg && (
              <div role="status" className={`alert ${resendMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {resendMsg.text}
              </div>
            )}
            <div className="subpanel" style={{ background: resendConfigured ? 'rgba(34, 197, 94, 0.05)' : 'rgba(234, 179, 8, 0.05)', border: resendConfigured ? '1px solid rgba(34, 197, 94, 0.1)' : '1px solid rgba(234, 179, 8, 0.1)' }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.6 }}>
                {resendConfigured
                  ? "✅ Configurado. Emails enviados via Resend."
                  : "⚠️ Não configurado. Emails de emergência não serão enviados."}
                <div style={{ marginTop: 8 }}>
                  Obtém a tua key em <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700 }}>resend.com/api-keys</a>.
                </div>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-resend-key">API Key Resend</label>
              <div style={{ position: "relative" }}>
                <input
                  id="p-resend-key"
                  className="control"
                  type={showResendKey ? "text" : "password"}
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder={resendConfigured ? "•••••••••••••••••••••" : "re_..."}
                  style={{ paddingRight: 40 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey((v) => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}
                >
                  {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {resendConfigured && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={isSavingResend}
                  onClick={async () => {
                    if (!confirm("Remover API key?")) return;
                    setIsSavingResend(true);
                    try {
                      await authAPI.saveResendApiKey(null);
                      setResendConfigured(false);
                      setResendMsg({ type: "success", text: "Removida." });
                    } catch { setResendMsg({ type: "error", text: "Erro." }); }
                    finally { setIsSavingResend(false); }
                  }}
                >
                  <Trash2 size={14} /> Remover
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={isSavingResend || !resendKey}>
                <Check size={14} /> {isSavingResend ? "A guardar..." : "Guardar key"}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {/* ── Motas ── */}
      <Card
        className="glass-panel"
        title={`As Minhas Motas`}
        subtitle={`${motorcycles.length} veículo${motorcycles.length !== 1 ? "s" : ""} registado${motorcycles.length !== 1 ? "s" : ""}`}
        headerActions={
          <button className={`btn btn-sm ${isAdding ? "btn-ghost" : "btn-primary"}`}
            onClick={() => { setIsAdding((v) => !v); setAddError(null); }}>
            {isAdding ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Adicionar Mota</>}
          </button>
        }
      >
        {isAdding && (
          <form onSubmit={handleAddMotorcycle} className="subpanel" style={{ marginBottom: 24, background: 'rgba(139, 92, 246, 0.03)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="field">
                <label className="field-label">Nome *</label>
                <input className="control" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required placeholder="Ex: Honda CB650R" />
              </div>
              <div className="field">
                <label className="field-label">Marca</label>
                <input className="control" value={form.brand}
                  onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                  placeholder="Ex: Honda" />
              </div>
              <div className="field">
                <label className="field-label">Ano</label>
                <input className="control" type="number" value={form.year}
                  onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                  placeholder="2024" />
              </div>
              <div className="field">
                <label className="field-label">Device ID</label>
                <input className="control" value={form.deviceId}
                  onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))}
                  placeholder="MOTOGUARD-SIM-XX" />
              </div>
              <div className="field field-span-2">
                <label className="field-label">Perfil de Mota</label>
                <select className="control" value={form.profileId}
                  onChange={(e) => setForm((p) => ({ ...p, profileId: e.target.value }))}>
                  <option value="">— Sem perfil (Usa padrão) —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.ccMin}–{p.ccMax} cc)</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{addError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                <Check size={14} /> {isSubmitting ? "A guardar..." : "Confirmar Adição"}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="empty-state" style={{ padding: "48px 0" }}>
            <div className="spinner" style={{ marginBottom: 16 }} />
            <div className="empty-state-title">A carregar garagem...</div>
          </div>
        ) : motorcycles.length === 0 ? (
          <div className="empty-state" style={{ padding: "64px 0" }}>
            <div className="empty-state-icon" style={{ opacity: 0.2 }}><Bike size={64} /></div>
            <div className="empty-state-title" style={{ marginTop: 16 }}>A garagem está vazia</div>
            <div className="empty-state-text">Associa a tua primeira mota para começar a monitorizar.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
    <div className={`subpanel ${isEditing ? 'active' : ''}`} style={{ 
      padding: '16px 20px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px',
      background: isEditing ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
      border: isEditing ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="tile-icon" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)', width: 44, height: 44 }}>
          <Bike size={20} />
        </div>
        
        <div style={{ flex: 1 }}>
          {!isEditing ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>
                {moto.name}
                <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--muted)', marginLeft: 8 }}>
                  {[moto.brand, moto.year].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: 4 }}>
                {moto.deviceId && (
                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>
                    <Cpu size={10} style={{ marginRight: 4 }} /> {moto.deviceId}
                  </span>
                )}
                {currentProfile && (
                  <span className="pill" style={{ fontSize: '0.65rem', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent)', padding: '1px 6px' }}>
                    {currentProfile.name}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontWeight: 800, color: 'var(--accent)' }}>A Editar Veículo</div>
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setIsEditing(true); setError(null); }} className="btn btn-ghost btn-sm">
              <Edit2 size={13} />
            </button>
            <button onClick={remove} disabled={isDeleting} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {!isEditing && currentProfile && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}
            onClick={() => setShowProfile((v) => !v)}>
            {showProfile ? <ChevronUp size={12} style={{ marginRight: 6 }} /> : <ChevronDown size={12} style={{ marginRight: 6 }} />}
            {showProfile ? "Ocultar especificações" : "Ver especificações do perfil"}
          </button>
          {showProfile && <ProfileDetails profile={currentProfile} />}
        </div>
      )}

      {isEditing && (
        <div className="form-grid" style={{ background: 'rgba(0,0,0,0.1)', padding: '20px', borderRadius: '12px' }}>
          <div className="field field-span-2">
            <label className="field-label">Nome *</label>
            <input className="control" value={edit.name}
              onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="field-label">Marca</label>
            <input className="control" value={edit.brand}
              onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} placeholder="Ex: Honda" />
          </div>
          <div className="field">
            <label className="field-label">Ano</label>
            <input className="control" type="number" value={edit.year}
              onChange={(e) => setEdit((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2024" />
          </div>
          <div className="field field-span-2">
            <label className="field-label">Device ID</label>
            <input className="control" value={edit.deviceId}
              onChange={(e) => setEdit((p) => ({ ...p, deviceId: e.target.value }))} />
          </div>
          <div className="field field-span-2">
            <label className="field-label">Perfil de Mota</label>
            <select className="control" value={edit.profileId}
              onChange={(e) => setEdit((p) => ({ ...p, profileId: e.target.value }))}>
              <option value="">— Sem perfil —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.ccMin}–{p.ccMax} cc)</option>
              ))}
            </select>
          </div>
          {selectedProfile && (
            <div className="field-span-2" style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Visualização do Perfil</div>
              <ProfileDetails profile={selectedProfile} />
            </div>
          )}
          {error && <div className="alert alert-danger field-span-2">{error}</div>}
          <div className="field-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => { setIsEditing(false); setError(null); }} className="btn btn-ghost btn-sm">Cancelar</button>
            <button onClick={save} disabled={isSaving} className="btn btn-primary btn-sm">
              <Check size={13} /> {isSaving ? "A guardar..." : "Guardar Alterações"}
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
    { label: "Cilindrada", val: `${profile.ccMin}–${profile.ccMax} cc`, icon: <Activity size={12} /> },
    { label: "Vel. máx.", val: `${profile.maxSpeedKmh} km/h`, icon: <Gauge size={12} /> },
    { label: "Temp. Máx.", val: `${profile.engineTempMax} °C`, icon: <Thermometer size={12} /> },
    { label: "Voltagem", val: `${profile.voltageMin}–${profile.voltageMax} V`, icon: <Zap size={12} /> },
    { label: "Roll Máx.", val: `${profile.typicalMaxRollDeg}°`, icon: <Sliders size={12} /> },
    { label: "Queda", val: `${profile.crashGForce} G`, icon: <Shield size={12} /> },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: '10px', marginTop: '12px' }}>
      {items.map((it) => (
        <div key={it.label} className="subpanel" style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            {it.icon} {it.label}
          </div>
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: 'var(--text)' }}>{it.val}</div>
        </div>
      ))}
    </div>
  );
}
