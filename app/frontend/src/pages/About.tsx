import { CSSProperties, ReactNode, useState } from "react";
import {
  Activity, Gauge, Thermometer, Zap, Navigation, Wind,
  AlertTriangle, Shield, BarChart2, Info,
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
  icon: ReactNode;
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
          "−15 pts por SPEEDING CRITICAL (> 25% acima do limite)",
          "−8 pts por SPEEDING WARNING (> 10% acima do limite)",
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
  const classes = {
    info: "pill-success", // Using success for info as a placeholder or defining new ones
    warn: "pill-warning",
    critical: "pill-danger",
  };
  const labels = { info: "INFO", warn: "AVISO", critical: "CRÍTICO" };
  
  return (
    <span className={`pill ${classes[severity]}`} style={{ fontSize: '10px' }}>
      {labels[severity]}
    </span>
  );
}

// ─── Field card ───────────────────────────────────────────────────────────────

function FieldCard({ field }: { field: DataField }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-panel" style={{ marginBottom: '10px', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", border: "none", textAlign: 'left'
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>{field.label}</span>
          <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.7rem' }}>
            {field.unit}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>
            {field.description.split(".")[0]}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', margin: "14px 0" }}>{field.description}</p>

          <div className="section-label" style={{ marginBottom: '10px' }}>Impacto no sistema</div>
          <ul style={{ margin: "0 0 16px", paddingLeft: '1.2rem', display: "flex", flexDirection: "column", gap: '6px' }}>
            {field.impacts.map((imp, i) => (
              <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{imp}</li>
            ))}
          </ul>

          {field.thresholds && field.thresholds.length > 0 && (
            <>
              <div className="section-label" style={{ marginBottom: '10px' }}>Limiares</div>
              <div style={{ display: "flex", flexDirection: "column", gap: '8px' }}>
                {field.thresholds.map((t, i) => (
                  <div key={i} className="subpanel" style={{ display: "flex", alignItems: "center", gap: 12, padding: '8px 12px' }}>
                    <SeverityBadge severity={t.severity} />
                    <span style={{ color: "var(--muted)", fontSize: '0.8rem', fontWeight: 600 }}>{t.label}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--text)", fontSize: '0.85rem' }}>{t.value}</span>
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
      <div className="glass-panel" style={{
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05))",
        border: "1px solid rgba(139, 92, 246, 0.2)",
        padding: "24px",
        marginBottom: "28px",
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div className="tile-icon tile-icon-blue" style={{ width: 48, height: 48 }}>
            <Bike size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '6px', color: 'var(--text)' }}>Arquitetura de dados em tempo real</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
              O simulador Python gera um tick por segundo com ~20 campos de telemetria. O backend Node.js processa cada tick,
              aplica heurísticas de deteção de risco e emite eventos via WebSocket para o frontend.
              No fim de cada viagem, o <strong>Safety Score</strong> e o <strong>Performance Score</strong> são calculados
              com base nos eventos detetados e nas métricas máximas registadas.
            </p>
          </div>
        </div>
      </div>

      {/* Flow */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: '10px' }}>
        {[
          { icon: <Wind size={14} />, label: "Simulador Python", color: "var(--accent)" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <Activity size={14} />, label: "MQTT Broker", color: "var(--blue)" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <BarChart2 size={14} />, label: "Heurísticas", color: "var(--orange)" },
          { icon: null, label: "→", color: "var(--muted)" },
          { icon: <Shield size={14} />, label: "Safety Score", color: "var(--green)" },
        ].map((step, i) => (
          step.icon ? (
            <div key={i} className="pill" style={{ 
              padding: '6px 14px', 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: step.color,
              fontWeight: 800
            }}>
              {step.icon} {step.label}
            </div>
          ) : (
            <span key={i} style={{ color: "var(--muted)", fontSize: '1.2rem', fontWeight: 300 }}>{step.label}</span>
          )
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {SECTIONS.map((section) => (
          <div key={section.id} className="glass-panel" style={{ overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "18px 24px", background: activeSection === section.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: "none", cursor: "pointer", transition: 'all 0.2s ease'
              }}
            >
              <div className="tile-icon" style={{ background: `${section.color}15`, color: section.color, width: 36, height: 36 }}>
                {section.icon}
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', flex: 1, textAlign: "left", color: 'var(--text)' }}>{section.title}</span>
              <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{section.fields.length} campos</span>
              {activeSection === section.id
                ? <ChevronUp size={20} />
                : <ChevronDown size={20} />}
            </button>

            {activeSection === section.id && (
              <div style={{ padding: "20px 24px", borderTop: '1px solid var(--border)' }}>
                {section.fields.map((field) => (
                  <FieldCard key={field.key} field={field} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Event types summary */}
      <div className="glass-panel" style={{ marginTop: 32, overflow: "hidden" }}>
        <div className="panel-header" style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.1)" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} style={{ color: "var(--red)" }} />
            <span className="panel-title" style={{ color: 'var(--text)', fontSize: '1rem' }}>Tipos de Eventos Detetados</span>
          </div>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
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
              { icon: "🚨", name: "SPEEDING", label: "Excesso de Velocidade", desc: "> 10% acima do limite legal durante 3+ ticks (WARNING); > 25% → CRITICAL" },
            ].map((ev) => (
              <div key={ev.name} className="subpanel" style={{
                display: "flex", gap: 14, padding: "14px", alignItems: "flex-start",
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{ev.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '2px' }}>{ev.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace', marginBottom: '6px', opacity: 0.8 }}>{ev.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
