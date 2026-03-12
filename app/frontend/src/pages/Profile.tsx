import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import { Motorcycle } from "../types";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  backgroundColor: "#0f1117",
  border: "1px solid #2a2d3a",
  borderRadius: "6px",
  color: "#e4e4e7",
  fontSize: "0.875rem",
};

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

  return (
    <div
      style={{
        padding: "1.5rem",
        maxWidth: "800px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>👤 Perfil</h1>

      {/* ── User info ─────────────────────────────────────────────────── */}
      <Section title="Informacoes da Conta">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "10px",
            marginBottom: "1.25rem",
          }}
        >
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
            <div
              key={label}
              style={{
                padding: "10px 12px",
                backgroundColor: "#0f1117",
                borderRadius: "8px",
                border: "1px solid #2a2d3a",
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "4px",
                }}
              >
                {label}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{val}</div>
            </div>
          ))}
        </div>
        <button
          onClick={logout}
          style={{
            padding: "0.55rem 1.25rem",
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
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
            style={{
              padding: "0.35rem 0.875rem",
              backgroundColor: isAdding ? "transparent" : "#3b82f6",
              color: isAdding ? "#71717a" : "white",
              border: isAdding ? "1px solid #2a2d3a" : "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {isAdding ? "✕ Cancelar" : "+ Adicionar"}
          </button>
        }
      >
        {/* Add form */}
        {isAdding && (
          <form
            onSubmit={handleAddMotorcycle}
            style={{
              backgroundColor: "#0f1117",
              border: "1px solid #2a2d3a",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <FormField label="Nome *">
                <input
                  style={INPUT}
                  value={form.name}
                  onChange={setField("name")}
                  required
                  placeholder="Ex: A minha PCX"
                />
              </FormField>
              <FormField label="Marca">
                <input
                  style={INPUT}
                  value={form.brand}
                  onChange={setField("brand")}
                  placeholder="Ex: Honda"
                />
              </FormField>
              <FormField label="Ano">
                <input
                  style={INPUT}
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
                  style={INPUT}
                  value={form.deviceId}
                  onChange={setField("deviceId")}
                  placeholder="Ex: MOTOGUARD-SIM-01"
                />
              </FormField>
              <FormField label="Perfil de Mota" span>
                <select
                  style={{ ...INPUT, cursor: "pointer" }}
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
            {addError && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  marginBottom: "8px",
                }}
              >
                {addError}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "0.55rem 1.5rem",
                backgroundColor: isSubmitting ? "#2a2d3a" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              {isSubmitting ? "A guardar..." : "Guardar Mota"}
            </button>
          </form>
        )}

        {/* List */}
        {isLoading ? (
          <p style={{ color: "#71717a", textAlign: "center", padding: "2rem" }}>
            A carregar...
          </p>
        ) : motorcycles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏍️</div>
            <p style={{ color: "#71717a" }}>Ainda nao adicionaste nenhuma mota.</p>
            <p style={{ color: "#52525b", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Clica em "+ Adicionar" para comecar.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {motorcycles.map((moto) => (
              <MotoRow key={moto.id} moto={moto} />
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
    <div
      style={{
        backgroundColor: "#1a1d27",
        border: "1px solid #2a2d3a",
        borderRadius: "12px",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#71717a",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
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
    <div style={span ? { gridColumn: "span 2" } : {}}>
      <label
        style={{
          display: "block",
          fontSize: "0.72rem",
          color: "#71717a",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function MotoRow({ moto }: { moto: Motorcycle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "12px 14px",
        backgroundColor: "#0f1117",
        borderRadius: "8px",
        border: "1px solid #2a2d3a",
      }}
    >
      <span style={{ fontSize: "1.5rem" }}>🏍️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>
          {moto.name}
          {moto.brand && (
            <span style={{ color: "#71717a", fontWeight: 400 }}>
              {" "}
              · {moto.brand}
            </span>
          )}
          {moto.year && (
            <span style={{ color: "#71717a", fontWeight: 400 }}>
              {" "}
              · {moto.year}
            </span>
          )}
        </div>
        {moto.deviceId && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#3b82f6",
              marginTop: "2px",
              fontFamily: "monospace",
            }}
          >
            📡 {moto.deviceId}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          color: "#52525b",
          textAlign: "right",
        }}
      >
        {new Date(moto.createdAt).toLocaleDateString("pt-PT")}
      </div>
    </div>
  );
}
