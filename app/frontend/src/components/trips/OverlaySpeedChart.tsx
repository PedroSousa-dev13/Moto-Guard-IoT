// =============================================================================
// MotoGuard — OverlaySpeedChart
// =============================================================================
// Gráfico Recharts com duas séries de velocidade normalizadas sobrepostas.
// Eixo X normalizado para [0%, 100%] para comparação independente da duração.
// =============================================================================

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { NormalizedSpeedPoint } from "../../utils/tripComparison";

// ─── Cores das séries ─────────────────────────────────────────────────────────

const COLOR_A = "#5b6af0"; // accent
const COLOR_B = "#f472b6"; // pink

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OverlaySpeedChartProps {
  seriesA: NormalizedSpeedPoint[] | null;
  seriesB: NormalizedSpeedPoint[] | null;
  labelA: string;
  labelB: string;
  avgSpeedA: number | null;
  avgSpeedB: number | null;
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface MergedPoint {
  pct: number;
  speedA?: number;
  speedB?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Funde duas séries num array de pontos com chave `pct`.
 * Cada série contribui com os seus próprios valores de velocidade.
 */
function mergeSeries(
  seriesA: NormalizedSpeedPoint[] | null,
  seriesB: NormalizedSpeedPoint[] | null
): MergedPoint[] {
  const map = new Map<number, MergedPoint>();

  const addSeries = (
    series: NormalizedSpeedPoint[],
    key: "speedA" | "speedB"
  ) => {
    for (const p of series) {
      const pct = Math.round(p.pct * 10) / 10; // arredonda a 1 decimal
      const existing = map.get(pct) ?? { pct };
      map.set(pct, { ...existing, [key]: p.speed });
    }
  };

  if (seriesA && seriesA.length > 0) addSeries(seriesA, "speedA");
  if (seriesB && seriesB.length > 0) addSeries(seriesB, "speedB");

  return Array.from(map.values()).sort((a, b) => a.pct - b.pct);
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: "rgba(18,18,28,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <p style={{ margin: "0 0 4px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        {label != null ? `${label.toFixed(1)}%` : ""}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: "2px 0", color: entry.color }}>
          {entry.name}: <strong>{entry.value.toFixed(1)} km/h</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Tabela acessível (oculta visualmente) ────────────────────────────────────

interface AccessibleDataTableProps {
  seriesA: NormalizedSpeedPoint[] | null;
  seriesB: NormalizedSpeedPoint[] | null;
  labelA: string;
  labelB: string;
}

function AccessibleDataTable({
  seriesA,
  seriesB,
  labelA,
  labelB,
}: AccessibleDataTableProps) {
  const hasA = seriesA && seriesA.length > 0;
  const hasB = seriesB && seriesB.length > 0;

  if (!hasA && !hasB) return null;

  // Amostra de até 20 pontos por série para não sobrecarregar o DOM
  const sample = (series: NormalizedSpeedPoint[]) => {
    if (series.length <= 20) return series;
    const step = Math.floor(series.length / 20);
    return series.filter((_, i) => i % step === 0);
  };

  return (
    <table
      aria-label="Dados de velocidade das viagens"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      <caption>Velocidade ao longo da viagem (eixo X normalizado 0–100%)</caption>
      <thead>
        <tr>
          <th scope="col">Posição (%)</th>
          {hasA && <th scope="col">{labelA} (km/h)</th>}
          {hasB && <th scope="col">{labelB} (km/h)</th>}
        </tr>
      </thead>
      <tbody>
        {hasA &&
          sample(seriesA!).map((p) => (
            <tr key={`a-${p.pct}`}>
              <td>{p.pct.toFixed(1)}</td>
              <td>{p.speed.toFixed(1)}</td>
              {hasB && <td>—</td>}
            </tr>
          ))}
        {hasB &&
          sample(seriesB!).map((p) => (
            <tr key={`b-${p.pct}`}>
              <td>{p.pct.toFixed(1)}</td>
              {hasA && <td>—</td>}
              <td>{p.speed.toFixed(1)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function OverlaySpeedChart({
  seriesA,
  seriesB,
  labelA,
  labelB,
  avgSpeedA,
  avgSpeedB,
}: OverlaySpeedChartProps) {
  const hasA = seriesA != null && seriesA.length > 0;
  const hasB = seriesB != null && seriesB.length > 0;

  // Sem dados de nenhuma série
  if (!hasA && !hasB) {
    return (
      <div
        className="overlay-speed-chart overlay-speed-chart--empty"
        role="status"
        aria-label="Sem dados de telemetria"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 240,
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
          fontStyle: "italic",
        }}
      >
        Sem dados de telemetria
      </div>
    );
  }

  const data = mergeSeries(seriesA, seriesB);

  return (
    <div className="overlay-speed-chart" style={{ position: "relative" }}>
      {/* Nota quando apenas uma série está disponível */}
      {(!hasA || !hasB) && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            fontStyle: "italic",
          }}
          role="note"
        >
          {!hasA
            ? `Dados de telemetria indisponíveis para ${labelA}`
            : `Dados de telemetria indisponíveis para ${labelB}`}
        </p>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />

          <XAxis
            dataKey="pct"
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            label={{
              value: "Progresso da viagem",
              position: "insideBottomRight",
              offset: -4,
              fill: "rgba(255,255,255,0.3)",
              fontSize: 11,
            }}
          />

          <YAxis
            tickFormatter={(v: number) => `${v}`}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            label={{
              value: "km/h",
              angle: -90,
              position: "insideLeft",
              offset: 8,
              fill: "rgba(255,255,255,0.3)",
              fontSize: 11,
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ color: "rgba(255,255,255,0.75)" }}>{value}</span>
            )}
          />

          {/* Linha de referência — velocidade média série A */}
          {hasA && avgSpeedA != null && (
            <ReferenceLine
              y={avgSpeedA}
              stroke={COLOR_A}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
              label={{
                value: `Média A: ${avgSpeedA.toFixed(1)} km/h`,
                position: "insideTopRight",
                fill: COLOR_A,
                fontSize: 10,
              }}
            />
          )}

          {/* Linha de referência — velocidade média série B */}
          {hasB && avgSpeedB != null && (
            <ReferenceLine
              y={avgSpeedB}
              stroke={COLOR_B}
              strokeDasharray="6 3"
              strokeOpacity={0.6}
              label={{
                value: `Média B: ${avgSpeedB.toFixed(1)} km/h`,
                position: "insideBottomRight",
                fill: COLOR_B,
                fontSize: 10,
              }}
            />
          )}

          {/* Série A */}
          {hasA && (
            <Line
              type="monotone"
              dataKey="speedA"
              name={labelA}
              stroke={COLOR_A}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLOR_A }}
              connectNulls={false}
            />
          )}

          {/* Série B */}
          {hasB && (
            <Line
              type="monotone"
              dataKey="speedB"
              name={labelB}
              stroke={COLOR_B}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLOR_B }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Tabela acessível oculta visualmente */}
      <AccessibleDataTable
        seriesA={seriesA}
        seriesB={seriesB}
        labelA={labelA}
        labelB={labelB}
      />
    </div>
  );
}

export default OverlaySpeedChart;
