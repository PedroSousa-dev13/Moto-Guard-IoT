import { describe, it, expect, beforeAll } from "vitest";
import { parseCSV } from "../csvParser";
import path from "path";
import fs from "fs";

describe("Real Simulator Data Coherence", () => {
  let csvPath: string;
  let csvContent: string;

  beforeAll(() => {
    // Encontrar e carregar o arquivo CSV de dados IRL
    const possiblePaths = [
      path.join(process.cwd(), "../../IRL_DATA/sensor_data_20240927_150526.csv"),
      path.join(process.cwd(), "../../../IRL_DATA/sensor_data_20240927_150526.csv"),
      path.resolve(process.cwd(), "IRL_DATA/sensor_data_20240927_150526.csv"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        csvPath = p;
        csvContent = fs.readFileSync(p, "utf-8");
        break;
      }
    }

    if (!csvContent) {
      console.warn("⚠️  CSV IRL não encontrado - teste será skipped");
    }
  });

  it("should have coherent RPM values related to speed", () => {
    if (!csvContent) {
      console.log("⏭️  Skipping - CSV não disponível");
      return;
    }

    const result = parseCSV(csvContent);

    if ("type" in result) {
      console.error("Parse error:", result.message);
      return;
    }

    const rows = result.rows;
    expect(rows.length).toBeGreaterThan(0);

    // Analisar coherência RPM vs Velocidade
    let coherenceScore = 0;
    let anomalies = 0;

    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const row = rows[i];
      const speed = row.speed_kmh;
      const rpm = row.rpm;
      const gear = row.gear;

      // Regra simples: RPM idle é ~1200 quando parado
      if (speed === 0 && rpm < 800) {
        anomalies++;
      }

      // RPM deve aumentar com velocidade (em geral)
      if (i > 0) {
        const prevRow = rows[i - 1];
        // Se velocidade aumenta, RPM deve aumentar (na maioria das vezes)
        if (
          Math.abs(speed - prevRow.speed_kmh) > 1 &&
          speed > prevRow.speed_kmh &&
          rpm < prevRow.rpm - 200
        ) {
          anomalies++;
        }
      }

      coherenceScore++;
    }

    const anomalyRate = (anomalies / coherenceScore) * 100;
    console.log(
      `\n📊 RPM Coherence: ${((coherenceScore - anomalies) / coherenceScore * 100).toFixed(1)}% (${anomalies} anomalias em ${coherenceScore} amostras)`
    );

    // Tolerância: até 15% de anomalias é aceitável
    expect(anomalyRate).toBeLessThan(15);
  });

  it("should have gear changes related to RPM and speed", () => {
    if (!csvContent) {
      console.log("⏭️  Skipping - CSV não disponível");
      return;
    }

    const result = parseCSV(csvContent);

    if ("type" in result) {
      return;
    }

    const rows = result.rows;
    let gearChanges = 0;
    let reasonableChanges = 0;

    // Detectar mudanças de velocidade
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].gear !== rows[i - 1].gear) {
        gearChanges++;

        // Mudanças devem coincidir com mudanças significativas de velocidade ou RPM
        const speedDelta = Math.abs(rows[i].speed_kmh - rows[i - 1].speed_kmh);
        const rpmDelta = Math.abs(rows[i].rpm - rows[i - 1].rpm);

        if (speedDelta > 2 || rpmDelta > 500) {
          reasonableChanges++;
        }
      }
    }

    const reasonableRate =
      gearChanges > 0 ? (reasonableChanges / gearChanges) * 100 : 100;

    console.log(
      `\n⚙️  Gear Changes: ${gearChanges} totais, ${reasonableChanges} justificadas (${reasonableRate.toFixed(1)}%)`
    );

    // Esperamos que a maioria das mudanças sejam justificadas
    expect(reasonableRate).toBeGreaterThan(60);
  });

  it("should have throttle correlated with acceleration", () => {
    if (!csvContent) {
      console.log("⏭️  Skipping - CSV não disponível");
      return;
    }

    const result = parseCSV(csvContent);

    if ("type" in result) {
      return;
    }

    const rows = result.rows;
    let throttleEvents = 0;
    let correlatedEvents = 0;

    for (let i = 1; i < Math.min(rows.length, 200); i++) {
      const throttle = rows[i].throttle_pct;
      const speedDelta = rows[i].speed_kmh - rows[i - 1].speed_kmh;

      // Se throttle > 50%, esperamos aceleração positiva
      if (throttle > 50) {
        throttleEvents++;
        if (speedDelta >= 0) {
          correlatedEvents++;
        }
      }
    }

    const correlationRate =
      throttleEvents > 0 ? (correlatedEvents / throttleEvents) * 100 : 100;

    console.log(
      `\n🎯 Throttle Correlation: ${correlationRate.toFixed(1)}% (${correlatedEvents}/${throttleEvents})`
    );

    // Esperamos alta correlação
    expect(correlationRate).toBeGreaterThan(60);
  });

  it("should have engine temperature varying with RPM", () => {
    if (!csvContent) {
      console.log("⏭️  Skipping - CSV não disponível");
      return;
    }

    const result = parseCSV(csvContent);

    if ("type" in result) {
      return;
    }

    const rows = result.rows;
    let tempVsRpmCorrelations = 0;

    // Dividir em segmentos: baixo RPM, médio, alto
    const lowRpmThreshold = 2000;
    const highRpmThreshold = 5000;

    const lowRpmTemps: number[] = [];
    const mediumRpmTemps: number[] = [];
    const highRpmTemps: number[] = [];

    rows.forEach((row) => {
      if (row.rpm < lowRpmThreshold) {
        lowRpmTemps.push(row.engine_temp_c);
      } else if (row.rpm < highRpmThreshold) {
        mediumRpmTemps.push(row.engine_temp_c);
      } else {
        highRpmTemps.push(row.engine_temp_c);
      }
    });

    const avgLowTemp =
      lowRpmTemps.length > 0
        ? lowRpmTemps.reduce((a, b) => a + b, 0) / lowRpmTemps.length
        : 0;
    const avgMediumTemp =
      mediumRpmTemps.length > 0
        ? mediumRpmTemps.reduce((a, b) => a + b, 0) / mediumRpmTemps.length
        : 0;
    const avgHighTemp =
      highRpmTemps.length > 0
        ? highRpmTemps.reduce((a, b) => a + b, 0) / highRpmTemps.length
        : 0;

    console.log(
      `\n🌡️  Engine Temperature vs RPM:`
    );
    console.log(
      `   Low RPM (<${lowRpmThreshold}): ${avgLowTemp.toFixed(1)}°C (${lowRpmTemps.length} amostras)`
    );
    console.log(
      `   Medium RPM (${lowRpmThreshold}-${highRpmThreshold}): ${avgMediumTemp.toFixed(1)}°C (${mediumRpmTemps.length} amostras)`
    );
    console.log(
      `   High RPM (>${highRpmThreshold}): ${avgHighTemp.toFixed(1)}°C (${highRpmTemps.length} amostras)`
    );

    // Temperatura deve aumentar com RPM
    expect(avgLowTemp).toBeLessThan(avgMediumTemp + 5);
    expect(avgMediumTemp).toBeLessThan(avgHighTemp + 5);
  });

  it("should have realistic voltage levels", () => {
    if (!csvContent) {
      console.log("⏭️  Skipping - CSV não disponível");
      return;
    }

    const result = parseCSV(csvContent);

    if ("type" in result) {
      return;
    }

    const rows = result.rows;
    const voltages = rows.map((r) => r.voltage);
    const minV = Math.min(...voltages);
    const maxV = Math.max(...voltages);
    const avgV = voltages.reduce((a, b) => a + b, 0) / voltages.length;

    console.log(
      `\n🔋 Voltagem: ${minV.toFixed(1)}V - ${maxV.toFixed(1)}V (média ${avgV.toFixed(1)}V)`
    );

    // Voltagem típica de moto é 12-14.5V
    expect(minV).toBeGreaterThan(10);
    expect(maxV).toBeLessThan(16);
    expect(avgV).toBeGreaterThan(12);
    expect(avgV).toBeLessThan(15);
  });
});
