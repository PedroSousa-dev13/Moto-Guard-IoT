﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import { Motorcycle } from "../types";

export default function Profile() {
  const { user, logout } = useAuth();
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    year: "",
    deviceId: "",
    profileId: "",
  });

  const selectedProfile =
    form.profileId ? profiles.find((p) => p.id === form.profileId) ?? null : null;

  useEffect(() => {
    loadData();
  }, []);

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
      console.error("Erro ao carregar dados do perfil:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function setField(field: keyof typeof form) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
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

  function onMotorcycleUpdated(updated: Motorcycle) {
    setMotorcycles((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function onMotorcycleDeleted(id: string) {
    setMotorcycles((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">👤 Perfil</div>
          <div className="page-subtitle">Conta e motas associadas</div>
        </div>
      </div>

      {/* ── User info ─────────────────────────────────────────────────── */}
      <Section title="Informacoes da Conta">
        <div className="tile-grid" style={{ marginBottom: 16 }}>
          {[
            { label: "Nome", val: user?.name ?? "—" },
            { label: "Email", val: user?.email ?? "—" },
            { label: "ID", val: user?.id ? user.id.slice(0, 8) + "…" : "—" },
            {
              label: "Membro desde",
              val: user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("pt-PT")
                : "—",
            },
          ].map(({ label, val }) => (
            <div key={label} className="tile">
              <div className="tile-k">{label}</div>
              <div className="tile-v">{val}</div>
            </div>
          ))}
        </div>
        <button onClick={logout} className="btn btn-danger">
          🚪 Terminar Sessao
        </button>
      </Section>

      {/* ── Motorcycles ───────────────────────────────────────────────── */}
      <Section
        title={`As Minhas Motas (${motorcycles.length})`}
        action={
          <button
            onClick={() => {
              setIsAdding((v) => !v);
              setAddError(null);
            }}
            className={`btn btn-sm ${isAdding ? "btn-ghost" : "btn-primary"}`}
          >
            {isAdding ? "✕ Cancelar" : "+ Adicionar"}
          </button>
        }
      >
        {/* Add form */}
        {isAdding && (
          <form
            onSubmit={handleAddMotorcycle}
            className="subpanel"
          >
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <FormField label="Nome *">
                <input
                  className="control"
                  value={form.name}
                  onChange={setField("name")}
                  required
                  placeholder="Ex: A minha PCX"
                />
              </FormField>
              <FormField label="Marca">
                <input
                  className="control"
                  value={form.brand}
                  onChange={setField("brand")}
                  placeholder="Ex: Honda"
                />
              </FormField>
              <FormField label="Ano">
                <input
                  className="control"
                  type="number"
                  value={form.year}
                  onChange={setField("year")}
                  placeholder="Ex: 2023"
                  min="1900"
                  max="2030"
                />
              </FormField>
              <FormField label="Device ID">
                <input
                  className="control"
                  value={form.deviceId}
                  onChange={setField("deviceId")}
                  placeholder="Ex: MOTOGUARD-SIM-01"
                />
              </FormField>
              <FormField label="Perfil de Mota" span>
                <select
                  className="control"
                  value={form.profileId}
                  onChange={setField("profileId")}
                >
                  <option value="">— Sem perfil —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ccMin}–{p.ccMax} cc)
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            {selectedProfile && (
              <ProfileDetails profile={selectedProfile} />
            )}
            {addError && (
              <div className="alert alert-danger" style={{ marginBottom: 12 }}>
                {addError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? "A guardar..." : "Guardar Mota"}
            </button>
          </form>
        )}

        {/* List */}
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
              <MotoRow
                key={moto.id}
                moto={moto}
                profiles={profiles}
                onUpdated={onMotorcycleUpdated}
                onDeleted={onMotorcycleDeleted}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function FormField({
  label,
  span,
  children,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${span ? "field-span-2" : ""}`}>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

function MotoRow({
  moto,
  profiles,
  onUpdated,
  onDeleted,
}: {
  moto: Motorcycle;
  profiles: any[];
  onUpdated: (m: Motorcycle) => void;
  onDeleted: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    name: moto.name,
    brand: moto.brand ?? "",
    year: moto.year ? String(moto.year) : "",
    deviceId: moto.deviceId ?? "",
    profileId: moto.profileId ?? "",
  });

  const selectedProfile =
    edit.profileId ? profiles.find((p) => p.id === edit.profileId) ?? null : null;

  function setField(field: keyof typeof edit) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setEdit((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function save() {
    setError(null);
    setIsSaving(true);
    try {
      const payload: any = { name: edit.name };
      payload.brand = edit.brand ? edit.brand : null;
      payload.year = edit.year ? parseInt(edit.year, 10) : null;
      payload.deviceId = edit.deviceId ? edit.deviceId : null;
      payload.profileId = edit.profileId ? edit.profileId : null;

      const res = await motorcyclesAPI.update(moto.id, payload);
      onUpdated(res.data);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao guardar alterações");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Apagar a mota "${moto.name}"?`)) return;
    setError(null);
    setIsDeleting(true);
    try {
      await motorcyclesAPI.remove(moto.id);
      onDeleted(moto.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Erro ao apagar mota");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="moto-row">
      <span className="moto-icon">🏍️</span>
      <div className="moto-main">
        {!isEditing ? (
          <>
            <div className="moto-name">
              {moto.name}
              {moto.brand && (
                <span className="moto-muted">
                  {" "}
                  · {moto.brand}
                </span>
              )}
              {moto.year && (
                <span className="moto-muted">
                  {" "}
                  · {moto.year}
                </span>
              )}
            </div>
            <div className="moto-meta">
              {moto.deviceId && (
                <div className="moto-device">
                  📡 {moto.deviceId}
                </div>
              )}
              {moto.profile?.name && (
                <div className="moto-profile">
                  🏷️ {moto.profile.name}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="form-grid">
            <div className="field-span-2">
              <input className="control" value={edit.name} onChange={setField("name")} required />
            </div>
            <input className="control" value={edit.brand} onChange={setField("brand")} placeholder="Marca" />
            <input className="control" value={edit.year} onChange={setField("year")} placeholder="Ano" type="number" />
            <div className="field-span-2">
              <input
                className="control"
                value={edit.deviceId}
                onChange={setField("deviceId")}
                placeholder="Device ID"
              />
            </div>
            <div className="field-span-2">
              <select className="control" value={edit.profileId} onChange={setField("profileId")}>
                <option value="">— Sem perfil —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ccMin}–{p.ccMax} cc)
                  </option>
                ))}
              </select>
            </div>
            {selectedProfile && (
              <div className="field-span-2">
                <ProfileDetails profile={selectedProfile} />
              </div>
            )}
            {error && (
              <div className="alert alert-danger field-span-2">
                {error}
              </div>
            )}
            <div className="moto-edit-actions field-span-2">
              <button
                onClick={save}
                disabled={isSaving}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? "A guardar..." : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  setEdit({
                    name: moto.name,
                    brand: moto.brand ?? "",
                    year: moto.year ? String(moto.year) : "",
                    deviceId: moto.deviceId ?? "",
                    profileId: moto.profileId ?? "",
                  });
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="moto-aside">
        {new Date(moto.createdAt).toLocaleDateString("pt-PT")}
        {!isEditing && (
          <div className="moto-actions">
            <button
              onClick={() => {
                setIsEditing(true);
                setError(null);
              }}
              className="btn btn-ghost btn-sm"
            >
              Editar
            </button>
            <button
              onClick={remove}
              disabled={isDeleting}
              className="btn btn-danger btn-sm"
            >
              {isDeleting ? "..." : "Apagar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: any }) {
  const items = [
    { label: "Cilindrada", val: `${profile.ccMin}–${profile.ccMax} cc` },
    { label: "Velocidade máx.", val: `${profile.maxSpeedKmh} km/h` },
    { label: "RPM máx.", val: `${profile.maxRpm} rpm` },
    { label: "Temperatura", val: `${profile.engineTempMin}–${profile.engineTempMax} °C` },
    { label: "Voltagem", val: `${profile.voltageMin}–${profile.voltageMax} V` },
    { label: "Roll típico", val: `${profile.typicalMaxRollDeg}°` },
    { label: "Queda (roll)", val: `${profile.crashRollThreshold}°` },
    { label: "Queda (pitch)", val: `${profile.crashPitchThreshold}°` },
    { label: "Queda (G)", val: `${profile.crashGForce} G` },
    { label: "Confirmar queda", val: `${profile.crashConfirmSec} s` },
    { label: "RPM crítico", val: `${profile.criticalRpm} rpm` },
    { label: "Temp. crítica", val: `${profile.criticalTemp} °C` },
    { label: "Voltagem crítica", val: `${profile.criticalVoltage} V` },
  ];

  return (
    <div className="subpanel" style={{ marginBottom: 12 }}>
      <div className="panel-title" style={{ marginBottom: 10 }}>
        Thresholds do perfil
      </div>
      <div className="tile-grid">
        {items.map((it) => (
          <div key={it.label} className="tile">
            <div className="tile-k">{it.label}</div>
            <div className="tile-v">{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
