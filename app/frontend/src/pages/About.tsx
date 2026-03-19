import React, { useState } from "react";
import {
  Activity, Gauge, Thermometer, Zap, Navigation, Wind,
  AlertTriangle, Shield, TrendingDown, BarChart2, Info,
  ChevronDown, ChevronUp, Bike
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataField {
  key: string;
  label: string;
  unit: string;
  description: string;
  impacts: string[];
  thresholds?: { label: string; value: string; severity: "info" | "warn" | "critical" }[];
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  fields: DataField[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "telemetry",
    title: "Telemetria de Condução",
    icon: <Gauge size={20} />,
    color: "#4f46e5",
    fields: [
      {
        key: "speed_kmh",
        label: "Velocidade",
        unit: "km/h",
        description: "Velocidade instantânea da mota. Calculada a cada tick do simulador.",
        impacts: ["Safety Score — penalização se exceder 90–105% do máximo do perfil", "Performance Score — contribui para a velocidade média da viagem", "Ativa deteção de travagem brusca e aceleração brusca"],
        thresholds: [
          { label: "> 105% do máximo do perfil", value: "−20 pts safety", severity: "critical" },
          { label: "> 90% do máximo do perfil", value: "−10 pts safety", severity: "warn" },
        ],
      },
      {
        key: "rpm",
        label: "RPM",
        unit: "rpm",
        description: "Rotações por minuto do motor. Indica o regime de funcionamento.",
        impacts: ["Usado em conjunto com a velocidade para detetar padrões de condução agressiva", "RPM crítico por perfil pode indicar stress mecânico"],
      },
      {
        key: "throttle_pct",
        label: "Acelerador",
        unit: "%",
        description: "Percentagem de abertura do acelerador. Valor entre 0 e 100%.",
        impacts: ["Throttle > 70% + aceleração > 0.30G → evento RAPID_ACCELERATION", "Contribui para o Performance Score"],
        thresholds: [
          { label: "> 70% + aceleração > 0.70G", value: "CRITICAL", severity: "critical" },
          { label: "> 70% + aceleração > 0.50G", value: "WARNING", severity: "warn" },
          { label: "> 70% + aceleração > 0.30G", value: "INFO", severity: "info" },
        ],
      },
      {
        key: "brake_front_pct",
        label: "Travão Dianteiro",
        unit: "%",
        description: "Pressão aplicada no travão dianteiro. Principal travão de paragem.",
        impacts: ["Travão > 60% + desaceleração > 0.35G → evento HARD_BRAKING", "Combinado com travão traseiro para calcular intensidade de travagem"],
        thresholds: [
          { label: "> 60% + desacel. > 0.75G", value: "CRITICAL", severity: "critical" },
          { label: "> 60% + desacel. > 0.55G", value: "WARNING", severity: "warn" },
          { label: "> 60% + desacel. > 0.35G", value: "INFO", severity: "info" },
        ],
      },
      {
        key: "brake_rear_pct",
        label: "Travão Traseiro",
        unit: "%",
        description: "Pressão aplicada no travão traseiro.",
        impacts: ["Travão traseiro > 50% contribui para deteção de HARD_BRAKING", "Usado em conjunto com o dianteiro"],
      },
    ],
  },
  {
    id: "imu",
    title: "IMU — Unidade de Medição Inercial",
    icon: <Activity size={20} />,
    color: "#0ea5e9",
    fields: [
      {
        key: "roll_deg",
        label: "Inclinação (Roll)",
        unit: "°",
        description: "Ângulo de inclinação lateral da mota. Crítico em curvas. Cada perfil tem um máximo típico e um limiar de queda.",
        impacts: ["Safety Score — penalização se exceder 115% do típico ou 90% do limiar de queda", "Evento EXCESSIVE_LEAN se velocidade > 25 km/h e roll > 110% do típico", "Combinado com G-force para deteção de queda"],
        thresholds: [
          { label: "> 90% do limiar de queda", value: "−20 pts safety + CRITICAL", severity: "critical" },
          { label: "> 115% do típico do perfil", value: "−10 pts safety + WARNING", severity: "warn" },
          { label: "> 110% do típico do perfil", value: "INFO", severity: "info" },
        ],
      },
      {
        key: "pitch_deg",
        label: "Inclinação Frontal (Pitch)",
        unit: "°",
        description: "Ângulo de inclinação frontal/traseiro. Relevante em acelerações e travagens bruscas.",
        impacts: ["Monitorizado para deteção de empinamentos e travagens extremas"],
      },
      {
        key: "g_force",
        label: "Força G",
        unit: "G",
        description: "Força gravitacional resultante. Mede a intensidade dos movimentos. 1G = gravidade normal.",
        impacts: ["Safety Score — penalização se ≥ limiar de queda do perfil", "Evento HIGH_VIBRATION se G > média + 0.65 e roll < 20°", "Usado na deteção de queda (crash detection)"],
        thresholds: [
          { label: "≥ limiar de queda do perfil", value: "−12 pts safety", severity: "critical" },
          { label: "≥ 70% do limiar de queda", value: "−6 pts safety", severity: "warn" },
          { label: "> média + 0.65G (vibração)", value: "HIGH_VIBRATION", severity: "warn" },
        ],
      },
    ],
  },
  {
    id: "health",
    title: "Saúde Mecânica",
    icon: <Thermometer size={20} />,
    color: "#f97316",
    fields: [
      {
        key: "engine_temp_c",
        label: "Temperatura do Motor",
        unit: "°C",
        description: "Temperatura do motor em graus Celsius. Cada perfil tem um limiar crítico diferente (ex: Scooter ~115°C, Desportiva ~130°C).",
        impacts: ["3 ticks consecutivos acima do limiar → OVERHEAT WARNING", "8+ ticks consecutivos → OVERHEAT CRITICAL", "Tendência de subida rápida → alerta INFO preventivo", "Performance Score: −12 pts por evento OVERHEAT"],
        thresholds: [
          { label: "≥ limiar crítico por 8+ ticks", value: "CRITICAL", severity: "critical" },
          { label: "≥ limiar crítico por 3 ticks", value: "WARNING", severity: "warn" },
          { label: "Tendência de subida acelerada", value: "INFO preventivo", severity: "info" },
        ],
      },
      {
        key: "voltage",
        label: "Voltagem",
        unit: "V",
        description: "Tensão elétrica do sistema. Normal entre 12.5V–14.5V. Queda indica falha de alternador ou bateria.",
        impacts: ["3 ticks abaixo do limiar crítico → LOW_VOLTAGE WARNING", "8+ ticks → LOW_VOLTAGE CRITICAL (falha de alternador)", "Tendência de descida → alerta INFO preventivo", "Performance Score: −10 pts por evento LOW_VOLTAGE"],
        thresholds: [
          { label: "≤ limiar crítico por 8+ ticks", value: "CRITICAL — falha alternador", severity: "critical" },
          { label: "≤ limiar crítico por 3 ticks", value: "WARNING", severity: "warn" },
          { label: "Tendência de descida", value: "INFO preventivo", severity: "info" },
        ],
      },
      {
        key: "oil_pressure_bar",
        label: "Pressão do Óleo",
        unit: "bar",
        description: "Pressão do óleo do motor. Abaixo de 0.9 bar a velocidade > 25 km/h é crítico.",
        impacts: ["< 0.9 bar a > 25 km/h → OIL_PRESSURE_LOW", "Performance Score: −12 pts por evento"],
        thresholds: [
          { label: "< 0.6 bar", value: "CRITICAL", severity: "critical" },
          { label: "< 0.9 bar", value: "WARNING", severity: "warn" },
        ],
      },
      {
        key: "tire_pressure",
        label: "Pressão dos Pneus",
        unit: "bar",
        description: "Pressão dos pneus dianteiro e traseiro. Abaixo de 1.3 bar é considerado baixo.",
        impacts: ["< 1.3 bar em qualquer pneu → TIRE_PRESSURE_LOW", "Tendência de descida lenta → alerta INFO preventivo", "Performance Score: −10 pts por evento"],
        thresholds: [
          { label: "< 1.05 bar", value: "CRITICAL", severity: "critical" },
          { label: "< 1.3 bar", value: "WARNING", severity: "warn" },
          { label: "Tendência de descida", value: "INFO preventivo", severity: "info" },
        ],
      },
    ],
  },
  {
    id: "scores",
    title: "Safety Score & Performance Score",
    icon: <Shield size={20} />,
    color: "#22c55e",
    fields: [
      {
        key: "safety_score",
        label: "Safety Score",
        unit: "0–100",
        description: "Pontuação de segurança calculada no fim de cada viagem. Começa em 100 e é penalizado por eventos e métricas extremas.",
        impacts: [
          "−25 pts por evento CRITICAL",
          "−12 pts por evento WARNING",
          "−5 pts por evento INFO",
          "−20 pts se velocidade > 105% do máximo do perfil",
          "−10 pts se velocidade > 90% do máximo do perfil",
          "−20 pts se inclinação próxima do limiar de queda",
          "−10 pts se inclinação > 115% do típico",
          "−12 pts se G-force ≥ limiar de queda",
          "−6 pts se G-force ≥ 70% do limiar de queda",
        ],
        thresholds: [
          { label: "≥ 80", value: "Bom (verde)", severity: "info" },
          { label: "60–79", value: "Atenção (amarelo)", severity: "warn" },
          { label: "< 60", value: "Risco (vermelho)", severity: "critical" },
        ],
      },
      {
        key: "performance_score",
        label: "Performance Score",
        unit: "0–100",
        description: "Pontuação de performance baseada em eventos mecânicos e ritmo de condução.",
        impacts: [
          "−6 pts por HARD_BRAKING",
          "−5 pts por RAPID_ACCELERATION",
          "−6 pts por HIGH_VIBRATION",
          "−12 pts por OVERHEAT",
          "−10 pts por LOW_VOLTAGE",
          "−10 pts por TIRE_PRESSURE_LOW",
          "−12 pts por OIL_PRESSURE_LOW",
          "Bónus de ritmo: velocidade média vs. máximo do perfil (25% do score)",
        ],
        thresholds: [
          { label: "≥ 80", value: "Bom (verde)", severity: "info" },
          { label: "60–79", value: "Atenção (amarelo)", severity: "warn" },
          { label: "< 60", value: "Risco (vermelho)", severity: "critical" },
        ],
      },
    ],
  },
];

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: "info" | "warn" | "critical" }) {
  const styles = {
    info:     { bg: "rgba(14,165,233,0.12)",  color: "#0ea5e9", label: "INFO" },
    warn:     { bg: "rgba(234,179,8,0.12)",   color: "#ca8a04", label: "AVISO" },
    critical: { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", label: "CRÍTICO" },
  };
  const s = styles[severity];
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

// ─── Field card ───────────────────────────────────────────────────────────────

function FieldCard({ field }: { field: DataField }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
      background: "var(--surface)", marginBottom: 8,
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "none", border: "none", cursor: "pointer", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{field.label}</span>
          <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface-2)", borderRadius: 6, padding: "1px 7px" }}>
            {field.unit}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {field.description.split(".")[0]}
          </span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: "var(--muted)", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0 10px" }}>{field.description}</p>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Impacto no sistema
          </div>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {field.impacts.map((imp, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text)" }}>{imp}</li>
            ))}
          </ul>

          {field.thresholds && field.thresholds.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Limiares
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {field.thresholds.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <SeverityBadge severity={t.severity} />
                    <span style={{ color: "var(--muted)" }}>{t.label}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--text)" }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title">
            <Info className="title-icon" size={24} />
            Como Funciona o Simulador
          </div>
          <div className="page-subtitle">
            O que cada dado mede e como impacta os resultados
          </div>
        </div>
      </div>

      {/* Intro */}
      <div style={{
        background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(14,165,233,0.06))",
        border: "1px solid rgba(79,70,229,0.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Bike size={28} style={{ color: "#4f46e5", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Arquitetura de dados em tempo real</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              O simulador Python gera um tick por segundo com ~20 campos de telemetria. O backend Node.js processa cada tick,
              aplica heurísticas de deteção de risco e emite eventos via WebSocket para o frontend.
              No fim de cada viagem, o <strong>Safety Score</strong> e o <strong>Performance Score</strong> são calculados
              com base nos eventos detetados e nas métricas máximas registadas.
            </p>
          </div>
        </div>
      </div>

      {/* Flow */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 8 } as React.CSSProperties}>
        {[
          { icon: <Wind size={14} />, label: "Simulador Python", color: "#4f46e5" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <Activity size={14} />, label: "MQTT Broker", color: "#0ea5e9" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <BarChart2 size={14} />, label: "Heurísticas", color: "#f97316" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <Shield size={14} />, label: "Safety Score", color: "#22c55e" },
        ].map((step, i) => (
          step.icon ? (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              background: `${step.color}18`, border: `1px solid ${step.color}30`,
              borderRadius: 8, fontSize: 12, fontWeight: 600, color: step.color,
            }}>
              {step.icon}{step.label}
            </div>
          ) : (
            <span key={i} style={{ color: "var(--muted)", fontSize: 16, fontWeight: 300 }}>{step.label}</span>
          )
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {SECTIONS.map((section) => (
          <div key={section.id} style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "16px 20px", background: `${section.color}08`,
                borderBottom: activeSection === section.id ? "1px solid var(--border)" : "none",
                border: "none", cursor: "pointer",
              }}
            >
              <span style={{ color: section.color }}>{section.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 15, flex: 1, textAlign: "left" }}>{section.title}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{section.fields.length} campos</span>
              {activeSection === section.id
                ? <ChevronUp size={18} style={{ color: "var(--muted)" }} />
                : <ChevronDown size={18} style={{ color: "var(--muted)" }} />}
            </button>

            {activeSection === section.id && (
              <div style={{ padding: "16px 20px" }}>
                {section.fields.map((field) => (
                  <FieldCard key={field.key} field={field} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Event types summary */}
      <div style={{ marginTop: 28, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", background: "rgba(239,68,68,0.06)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={18} style={{ color: "#ef4444" }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Tipos de Eventos Detetados</span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {[
              { icon: "🛑", name: "HARD_BRAKING", label: "Travagem Brusca", desc: "Desaceleração > 0.35G com travão > 60%" },
              { icon: "🚀", name: "RAPID_ACCELERATION", label: "Aceleração Brusca", desc: "Aceleração > 0.30G com throttle > 70%" },
              { icon: "↗️", name: "EXCESSIVE_LEAN", label: "Inclinação Excessiva", desc: "Roll > 110% do típico a > 25 km/h" },
              { icon: "📳", name: "HIGH_VIBRATION", label: "Vibração Anómala", desc: "G-force > média + 0.65G com roll < 20°" },
              { icon: "🌡️", name: "OVERHEAT", label: "Sobreaquecimento", desc: "Temperatura acima do limiar crítico do perfil" },
              { icon: "🔋", name: "LOW_VOLTAGE", label: "Voltagem Baixa", desc: "Tensão abaixo do limiar crítico — possível falha de alternador" },
              { icon: "🛢️", name: "OIL_PRESSURE_LOW", label: "Pressão de Óleo Baixa", desc: "< 0.9 bar a velocidade > 25 km/h" },
              { icon: "🛞", name: "TIRE_PRESSURE_LOW", label: "Pressão de Pneus Baixa", desc: "< 1.3 bar em qualquer pneu" },
              { icon: "💥", name: "CRASH_DETECTED", label: "Queda Detetada", desc: "Roll + G-force acima dos limiares de queda do perfil" },
            ].map((ev) => (
              <div key={ev.name} style={{
                display: "flex", gap: 10, padding: "10px 12px",
                background: "var(--surface-2)", borderRadius: 10, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{ev.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{ev.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace", marginBottom: 2 }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
