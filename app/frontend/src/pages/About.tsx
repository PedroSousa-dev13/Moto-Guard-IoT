import { ReactNode, useState } from "react";
import {
  Activity, Gauge, Thermometer, Zap, Navigation, Wind,
  AlertTriangle, Shield, BarChart2, Info,
  ChevronDown, ChevronUp, Bike, Square, Rocket, TrendingUp,
  Smartphone, Battery, Droplets, CircleDot, Bell
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
  fields: DataField[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTION_THEME: Record<string, { bg: string; text: string; border: string }> = {
  telemetry: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
  imu: { bg: "bg-blue/10", text: "text-blue", border: "border-blue/20" },
  health: { bg: "bg-yellow/10", text: "text-yellow", border: "border-yellow/20" },
  scores: { bg: "bg-green/10", text: "text-green", border: "border-green/20" },
};

const SECTIONS: Section[] = [
  {
    id: "telemetry",
    title: "Telemetria de Condução",
    icon: <Gauge size={20} />,
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
    info: "bg-blue/10 text-blue border-blue/20",
    warn: "bg-yellow/10 text-yellow border-yellow/20",
    critical: "bg-red/10 text-red border-red/20",
  };
  const labels = { info: "INFO", warn: "AVISO", critical: "CRÍTICO" };
  
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest border ${classes[severity]}`}>
      {labels[severity]}
    </span>
  );
}

// ─── Field card ───────────────────────────────────────────────────────────────

function FieldCard({ field }: { field: DataField }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface/40 backdrop-blur-md border border-border-glass rounded-xl overflow-hidden mb-3 transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-panel transition-all"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-black text-sm text-text">{field.label}</span>
          <span className="px-2 py-0.5 rounded-lg bg-panel text-muted text-[0.7rem] font-bold border border-border-glass">
            {field.unit}
          </span>
          <span className="text-[0.75rem] text-muted truncate opacity-80 font-medium">
            {field.description.split(".")[0]}
          </span>
        </div>
        <div className="text-muted">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-border-glass animate-fade-in">
          <p className="text-sm text-text-2 my-4 leading-relaxed font-medium">{field.description}</p>

          <div className="text-[0.65rem] font-black uppercase tracking-widest text-accent mb-3">Impacto no sistema</div>
          <ul className="space-y-2 mb-5">
            {field.impacts.map((imp, i) => (
              <li key={i} className="text-xs text-text flex items-start gap-2 leading-relaxed">
                <span className="text-accent mt-1">•</span> {imp}
              </li>
            ))}
          </ul>

          {field.thresholds && field.thresholds.length > 0 && (
            <>
              <div className="text-[0.65rem] font-black uppercase tracking-widest text-accent mb-3">Limiares</div>
              <div className="flex flex-col gap-2">
                {field.thresholds.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-panel border border-border-glass">
                    <SeverityBadge severity={t.severity} />
                    <span className="text-xs text-muted font-bold">{t.label}</span>
                    <span className="ml-auto font-black text-text text-sm">{t.value}</span>
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
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-text flex items-center gap-3 tracking-tight">
          <Info className="text-accent" size={28} /> Como Funciona o Simulador
        </h1>
        <p className="text-muted text-sm font-medium">O que cada dado mede e como impacta os seus scores de segurança e performance</p>
      </div>

      {/* Intro */}
      <div className="bg-gradient-to-br from-accent/20 to-blue/10 border border-accent/20 rounded-2xl p-6 shadow-xl shadow-accent/5">
        <div className="flex gap-5 items-start">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent flex-shrink-0 border border-accent/30 shadow-inner">
            <Bike size={24} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-black text-text">Arquitetura de dados em tempo real</h2>
            <p className="text-sm text-text-2 leading-relaxed font-medium m-0">
              O simulador Python gera um tick por segundo com ~20 campos de telemetria. O backend Node.js processa cada tick,
              aplica heurísticas de deteção de risco e emite eventos via WebSocket para o frontend.
              No fim de cada viagem, o <strong className="text-text">Safety Score</strong> e o <strong className="text-text">Performance Score</strong> são calculados
              com base nos eventos detetados e nas métricas máximas registadas.
            </p>
          </div>
        </div>
      </div>

      {/* Flow */}
      <div className="flex items-center gap-2.5 flex-wrap overflow-x-auto pb-2 no-scrollbar">
        {[
          { icon: <Wind size={14} />, label: "Simulador Python", color: "text-accent" },
          { icon: null, label: "→", color: "text-muted" },
          { icon: <Activity size={14} />, label: "MQTT Broker", color: "text-blue" },
          { icon: null, label: "→", color: "text-muted" },
          { icon: <BarChart2 size={14} />, label: "Heurísticas", color: "text-orange" },
          { icon: null, label: "→", color: "text-muted" },
          { icon: <Shield size={14} />, label: "Safety Score", color: "text-green" },
        ].map((step, i) => (
          step.icon ? (
            <div key={i} className={`flex items-center gap-2 px-4 py-2 bg-surface/60 border border-border-glass rounded-xl whitespace-nowrap shadow-sm`}>
              <span className={step.color}>{step.icon}</span>
              <span className={`text-[0.7rem] font-black uppercase tracking-widest ${step.color}`}>{step.label}</span>
            </div>
          ) : (
            <span key={i} className="text-muted font-light text-xl px-1">{step.label}</span>
          )
        ))}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <div key={section.id} className="bg-surface/60 backdrop-blur-md border border-border-glass rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
              className={`w-full flex items-center gap-4 px-6 py-5 text-left transition-all ${activeSection === section.id ? 'bg-panel' : 'hover:bg-panel'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-inner ${SECTION_THEME[section.id]?.bg ?? 'bg-accent/10'} ${SECTION_THEME[section.id]?.text ?? 'text-accent'} ${SECTION_THEME[section.id]?.border ?? 'border-accent/20'}`}>
                {section.icon}
              </div>
              <span className="font-black text-base text-text flex-1">{section.title}</span>
              <span className="px-2.5 py-1 rounded-lg bg-surface-2 text-muted text-[0.65rem] font-black uppercase tracking-wider border border-border-glass">
                {section.fields.length} campos
              </span>
              <div className="text-muted ml-2">
                {activeSection === section.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {activeSection === section.id && (
              <div className="px-6 py-5 border-t border-border-glass animate-fade-in bg-surface">
                {section.fields.map((field) => (
                  <FieldCard key={field.key} field={field} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Event types summary */}
      <div className="bg-surface/60 backdrop-blur-md border border-border-glass rounded-2xl overflow-hidden shadow-lg mt-8">
        <div className="px-6 py-4 bg-red/10 border-b border-red/10 flex items-center gap-4">
          <AlertTriangle size={20} className="text-red" />
          <h2 className="text-sm font-black text-text uppercase tracking-widest">Tipos de Eventos Detetados</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Square className="text-red" size={24} />, name: "HARD_BRAKING", label: "Travagem Brusca", desc: "Desaceleração > 0.35G com travão > 60%" },
              { icon: <Rocket className="text-orange" size={24} />, name: "RAPID_ACCELERATION", label: "Aceleração Brusca", desc: "Aceleração > 0.30G com throttle > 70%" },
              { icon: <TrendingUp className="text-yellow" size={24} />, name: "EXCESSIVE_LEAN", label: "Inclinação Excessiva", desc: "Roll > 110% do típico a > 25 km/h" },
              { icon: <Smartphone className="text-purple" size={24} />, name: "HIGH_VIBRATION", label: "Vibração Anómala", desc: "G-force > média + 0.65G com roll < 20°" },
              { icon: <Thermometer className="text-yellow" size={24} />, name: "OVERHEAT", label: "Sobreaquecimento", desc: "Temperatura acima do limiar crítico do perfil" },
              { icon: <Battery className="text-green" size={24} />, name: "LOW_VOLTAGE", label: "Voltagem Baixa", desc: "Tensão abaixo do limiar crítico — possível falha de alternador" },
              { icon: <Droplets className="text-blue" size={24} />, name: "OIL_PRESSURE_LOW", label: "Pressão de Óleo Baixa", desc: "< 0.9 bar a velocidade > 25 km/h" },
              { icon: <CircleDot className="text-orange" size={24} />, name: "TIRE_PRESSURE_LOW", label: "Pressão de Pneus Baixa", desc: "< 1.3 bar em qualquer pneu" },
              { icon: <Zap className="text-red" size={24} />, name: "CRASH_DETECTED", label: "Queda Detetada", desc: "Roll + G-force acima dos limiares de queda do perfil" },
              { icon: <Bell className="text-red" size={24} />, name: "SPEEDING", label: "Excesso de Velocidade", desc: "> 10% acima do limite legal durante 3+ ticks (WARNING); > 25% → CRITICAL" },
            ].map((ev) => (
              <div key={ev.name} className="flex gap-4 p-4 rounded-xl bg-panel border border-border-glass hover:border-white/10 transition-all group">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 group-hover:scale-110 transition-transform">{ev.icon}</div>
                <div className="flex flex-col gap-1">
                  <div className="font-black text-sm text-text leading-tight">{ev.label}</div>
                  <div className="text-[0.65rem] text-accent font-black font-mono tracking-tighter opacity-80">{ev.name}</div>
                  <div className="text-xs text-muted leading-relaxed font-medium mt-1">{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
