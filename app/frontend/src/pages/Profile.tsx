﻿import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authAPI, motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import Card from "../components/ui/Card";
import {
  User, Mail, Calendar, Shield, LogOut, Bike, Plus, X,
  Edit2, Trash2, Check, Key, Cpu, ChevronDown, ChevronUp,
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  useEffect(() => {
    document.title = "Perfil — MotoGuard";
    void loadData();
  }, []);

  useEffect(() => { if (user?.name) setProfileName(user.name); }, [user]);

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
      if (profileName !== user?.name) await authAPI.updateProfile({ name: profileName });
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
      <div className="profile-hero">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-hero-info">
          <div className="profile-hero-name">{user?.name ?? "Utilizador"}</div>
          <div className="profile-hero-email">{user?.email}</div>
          <div className="profile-hero-meta">
            <span><Calendar size={13} /> Membro desde {memberSince}</span>
            <span><Bike size={13} /> {motorcycles.length} mota{motorcycles.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <button className="btn btn-danger btn-sm profile-logout" onClick={logout}>
          <LogOut size={14} /> Terminar sessão
        </button>
      </div>

      {/* ── Editar dados ── */}
      <Card title="Dados da Conta">
        <form onSubmit={(e) => void handleSaveProfile(e)} style={{ display: "grid", gap: 16 }}>
          {profileMsg && (
            <div role="status" className={`alert ${profileMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
              {profileMsg.text}
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="p-name">
                <User size={12} style={{ marginRight: 4 }} />Nome
              </label>
              <input id="p-name" className="control" value={profileName}
                onChange={(e) => setProfileName(e.target.value)} placeholder="O teu nome" required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-email">
                <Mail size={12} style={{ marginRight: 4 }} />Email
              </label>
              <input id="p-email" className="control" value={user?.email ?? ""} readOnly disabled style={{ opacity: 0.6 }} />
            </div>
          </div>

          {/* Segurança — expansível */}
          <button type="button" className="settings-section-toggle"
            onClick={() => setShowSecurity((v) => !v)}>
            <Key size={15} /> Alterar password
            {showSecurity ? <ChevronUp size={15} style={{ marginLeft: "auto" }} /> : <ChevronDown size={15} style={{ marginLeft: "auto" }} />}
          </button>

          {showSecurity && (
            <div className="form-grid security-fields">
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
                  autoComplete="new-password" placeholder="••••••••" minLength={newPassword ? 6 : undefined} />
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

      {/* ── Motas ── */}
      <Card
        title={`As Minhas Motas (${motorcycles.length})`}
        headerActions={
          <button className={`btn btn-sm ${isAdding ? "btn-ghost" : "btn-primary"}`}
            onClick={() => { setIsAdding((v) => !v); setAddError(null); }}>
            {isAdding ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Adicionar</>}
          </button>
        }
      >
        {isAdding && (
          <form onSubmit={handleAddMotorcycle} className="subpanel" style={{ marginBottom: 16 }}>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="field">
                <label className="field-label">Nome *</label>
                <input className="control" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required placeholder="Ex: A minha PCX" />
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
                  placeholder="Ex: 2023" min="1900" max="2030" />
              </div>
              <div className="field">
                <label className="field-label">Device ID</label>
                <input className="control" value={form.deviceId}
                  onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))}
                  placeholder="Ex: MOTOGUARD-SIM-01" />
              </div>
              <div className="field field-span-2">
                <label className="field-label">Perfil de Mota</label>
                <select className="control" value={form.profileId}
                  onChange={(e) => setForm((p) => ({ ...p, profileId: e.target.value }))}>
                  <option value="">— Sem perfil —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.ccMin}–{p.ccMax} cc)</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{addError}</div>}
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              <Check size={14} /> {isSubmitting ? "A guardar..." : "Guardar Mota"}
            </button>
          </form>
        )}

        {isLoading ? (
          <div className="empty-state" style={{ padding: "32px 18px" }}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">A carregar...</div>
          </div>
        ) : motorcycles.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 18px" }}>
            <div className="empty-state-icon">🏍️</div>
            <div className="empty-state-title">Ainda não adicionaste nenhuma mota</div>
            <div className="empty-state-text">Clica em "+ Adicionar" para começar.</div>
          </div>
        ) : (
          <div className="profile-moto-list">
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
    if (!confirm(`Apagar a mota "${moto.name}"?`)) return;
    setIsDeleting(true);
    try {
      await motorcyclesAPI.remove(moto.id);
      onDeleted(moto.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao apagar");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className="moto-row">
      <div className="moto-avatar">
        <Bike size={20} />
      </div>
      <div className="moto-main">
        {!isEditing ? (
          <>
            <div className="moto-name">
              {moto.name}
              {moto.brand && <span className="moto-muted"> · {moto.brand}</span>}
              {moto.year && <span className="moto-muted"> · {moto.year}</span>}
            </div>
            <div className="moto-meta">
              {moto.deviceId && (
                <span className="moto-device"><Cpu size={11} /> {moto.deviceId}</span>
              )}
              {currentProfile && (
                <span className="moto-profile">{currentProfile.name}</span>
              )}
            </div>
            {currentProfile && (
              <button type="button" className="moto-profile-toggle"
                onClick={() => setShowProfile((v) => !v)}>
                {showProfile ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showProfile ? "Ocultar thresholds" : "Ver thresholds do perfil"}
              </button>
            )}
            {showProfile && currentProfile && <ProfileDetails profile={currentProfile} />}
            {error && <div className="alert alert-danger" style={{ marginTop: 8 }}>{error}</div>}
          </>
        ) : (
          <div className="form-grid">
            <div className="field field-span-2">
              <label className="field-label">Nome *</label>
              <input className="control" value={edit.name}
                onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label className="field-label">Marca</label>
              <input className="control" value={edit.brand}
                onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} placeholder="Honda" />
            </div>
            <div className="field">
              <label className="field-label">Ano</label>
              <input className="control" type="number" value={edit.year}
                onChange={(e) => setEdit((p) => ({ ...p, year: e.target.value }))} placeholder="2023" />
            </div>
            <div className="field field-span-2">
              <label className="field-label">Device ID</label>
              <input className="control" value={edit.deviceId}
                onChange={(e) => setEdit((p) => ({ ...p, deviceId: e.target.value }))} placeholder="MOTOGUARD-SIM-01" />
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
              <div className="field-span-2"><ProfileDetails profile={selectedProfile} /></div>
            )}
            {error && <div className="alert alert-danger field-span-2">{error}</div>}
            <div className="moto-edit-actions field-span-2">
              <button onClick={save} disabled={isSaving} className="btn btn-primary btn-sm">
                <Check size={13} /> {isSaving ? "A guardar..." : "Guardar"}
              </button>
              <button onClick={() => { setIsEditing(false); setError(null); }} className="btn btn-ghost btn-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="moto-aside">
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {new Date(moto.createdAt).toLocaleDateString("pt-PT")}
        </span>
        {!isEditing && (
          <div className="moto-actions">
            <button onClick={() => { setIsEditing(true); setError(null); }} className="btn btn-ghost btn-sm">
              <Edit2 size={13} /> Editar
            </button>
            <button onClick={remove} disabled={isDeleting} className="btn btn-danger btn-sm">
              <Trash2 size={13} /> {isDeleting ? "..." : "Apagar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProfileDetails ───────────────────────────────────────────────────────────
function ProfileDetails({ profile }: { profile: any }) {
  const items = [
    { label: "Cilindrada", val: `${profile.ccMin}–${profile.ccMax} cc` },
    { label: "Vel. máx.", val: `${profile.maxSpeedKmh} km/h` },
    { label: "RPM máx.", val: `${profile.maxRpm}` },
    { label: "Temp.", val: `${profile.engineTempMin}–${profile.engineTempMax} °C` },
    { label: "Voltagem", val: `${profile.voltageMin}–${profile.voltageMax} V` },
    { label: "Roll típico", val: `${profile.typicalMaxRollDeg}°` },
    { label: "Queda G", val: `${profile.crashGForce} G` },
    { label: "Confirmar", val: `${profile.crashConfirmSec} s` },
  ];
  return (
    <div className="subpanel" style={{ marginTop: 10 }}>
      <div className="panel-title" style={{ marginBottom: 10 }}>Thresholds — {profile.name}</div>
      <div className="tile-grid">
        {items.map((it) => (
          <div key={it.label} className="tile">
            <div className="tile-k">{it.label}</div>
            <div className="tile-v" style={{ fontSize: "1.1rem" }}>{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
