// =============================================================================
// MotoGuard IoT — CSV_Parser
// =============================================================================
// Módulo puro (sem side effects) que lê e valida um ficheiro CSV de telemetria
// e devolve ParseResult ou ParseError.
// Suporta dois formatos:
// 1. Formato genérico com colunas nomeadas (speed, lat, lon, etc.)
// 2. Formato RiderData (Sensor, Timestamp, Valor_X, Valor_Y, Valor_Z)
// =============================================================================

export interface ParsedRow {
  timestampSec: number;     // sempre em segundos relativos ao início
  latitude: number;
  longitude: number;
  speed_kmh: number;
  rpm: number;
  gear: number;
  throttle_pct: number;
  engine_temp_c: number;
  voltage: number;
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  g_force: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  skippedCount: number;
  columns: string[];
  durationSec: number;      // timestamp da última linha
  errors: string[];         // erros não fatais
  format: 'generic' | 'riderdata'; // formato detectado
}

export interface ParseError {
  type: 'NO_TIMESTAMP_COLUMN' | 'INVALID_EXTENSION' | 'EMPTY_FILE' | 'NO_GPS_DATA';
  message: string;
}

// ---------------------------------------------------------------------------
// Motorcycle Profiles for IRL Data Enhancement
// ---------------------------------------------------------------------------

interface MotorcycleProfile {
  rpm_max: number;
  rpm_idle: number;
  temp_motor_min: number;
  temp_motor_max: number;
  voltagem_nominal: number;
  voltagem_min: number;
  voltagem_max: number;
  transmissao: 'manual' | 'CVT';
  gear_ratios: Record<string, number> | { type: 'CVT'; min_ratio: number; max_ratio: number };
  wheel_diameter_m: number;
  final_drive_ratio: number;
  throttle_response: number;
}

const MOTORCYCLE_PROFILES: Record<string, MotorcycleProfile> = {
  "Scooter": {
    rpm_max: 9000,
    rpm_idle: 1500,
    temp_motor_min: 60,
    temp_motor_max: 90,
    voltagem_nominal: 14.2,
    voltagem_min: 11.5,
    voltagem_max: 14.5,
    transmissao: "CVT",
    gear_ratios: { "type": "CVT", "min_ratio": 2.0, "max_ratio": 0.5 },
    wheel_diameter_m: 0.4,
    final_drive_ratio: 1.0,
    throttle_response: 0.25
  },
  "Naked": {
    rpm_max: 12000,
    rpm_idle: 1200,
    temp_motor_min: 70,
    temp_motor_max: 105,
    voltagem_nominal: 14.2,
    voltagem_min: 11.5,
    voltagem_max: 14.5,
    transmissao: "manual",
    gear_ratios: { "1": 15.0, "2": 12.0, "3": 9.5, "4": 7.5, "5": 6.0, "6": 5.0 },
    wheel_diameter_m: 0.6,
    final_drive_ratio: 2.8,
    throttle_response: 0.35
  },
  "Desportiva": {
    rpm_max: 15000,
    rpm_idle: 1000,
    temp_motor_min: 80,
    temp_motor_max: 110,
    voltagem_nominal: 14.2,
    voltagem_min: 11.5,
    voltagem_max: 14.5,
    transmissao: "manual",
    gear_ratios: { "1": 16.0, "2": 13.0, "3": 10.0, "4": 8.0, "5": 6.5, "6": 5.5 },
    wheel_diameter_m: 0.6,
    final_drive_ratio: 2.5,
    throttle_response: 0.4
  }
};

// Default profile for IRL enhancement
const DEFAULT_IRL_PROFILE = "Naked";

// ---------------------------------------------------------------------------
// IRL Data Enhancement Functions
// ---------------------------------------------------------------------------

function calculateRpmFromSpeed(speedKmh: number, gear: number, profile: MotorcycleProfile): number {
  if (speedKmh <= 0) {
    return profile.rpm_idle;
  }

  if (profile.transmissao === 'CVT') {
    const rpmRange = profile.rpm_max - profile.rpm_idle;
    const speedFraction = Math.min(speedKmh / 200, 1.0); // Assume max speed 200 km/h for scaling
    return profile.rpm_idle + rpmRange * speedFraction;
  } else {
    const manualRatios = profile.gear_ratios as Record<string, number>;
    const gearKey = gear.toString();
    if (!(gearKey in manualRatios)) {
      gear = 1;
    }
    const gearRatio = manualRatios[gear.toString()];
    const wheelCircumference = Math.PI * profile.wheel_diameter_m;
    const finalDrive = profile.final_drive_ratio;

    const wheelAngularVel = (speedKmh * 1000 / 3600) / (wheelCircumference / 2);
    const engineRpm = wheelAngularVel * gearRatio * finalDrive * 60 / (2 * Math.PI);

    return Math.max(profile.rpm_idle, Math.min(profile.rpm_max, engineRpm));
  }
}

function estimateThrottle(speed: number, prevSpeed: number, dt: number, profile: MotorcycleProfile): number {
  if (dt <= 0 || prevSpeed === undefined) return 0.0;

  const accel = (speed - prevSpeed) / (dt / 3.6); // m/s²
  const maxAccel = 12.0; // km/h/s default
  if (accel <= 0) return 0.0;

  return Math.min(accel / maxAccel * 100, 100);
}

function simulateEngineTemp(currentTemp: number, rpm: number, dt: number, profile: MotorcycleProfile): number {
  const ambientTemp = 20.0;
  const idleTemp = profile.temp_motor_min + 5.0;

  let targetTemp: number;
  if (rpm <= profile.rpm_idle * 1.2) {
    targetTemp = idleTemp;
  } else {
    const rpmFactor = (rpm - profile.rpm_idle) / (profile.rpm_max - profile.rpm_idle);
    targetTemp = profile.temp_motor_min + rpmFactor * (profile.temp_motor_max - profile.temp_motor_min);
  }

  const lerpFactor = 0.03 * dt;
  const newTemp = currentTemp + (targetTemp - currentTemp) * lerpFactor;

  return Math.max(ambientTemp, Math.min(profile.temp_motor_max + 10, newTemp));
}

function simulateVoltage(rpm: number, profile: MotorcycleProfile): number {
  const baseVoltage = profile.voltagem_nominal;

  if (rpm < profile.rpm_idle * 1.2) {
    return baseVoltage * 0.8 + Math.random() * 0.5;
  } else {
    return baseVoltage + (Math.random() - 0.5) * 0.4;
  }
}

function estimateGearFromSpeed(speed: number, profile: MotorcycleProfile): number {
  if (profile.transmissao === 'CVT') return 0;
  
  if (speed <= 0) return 1;
  
  // Escalas de mudança adaptadas à velocidade máxima de cada perfil
  // Usa percentagens da vel_max em vez de valores absolutos hard-coded
  // Isto garante que Scooter e Desportiva usam faixas apropriadas
  
  // Para motas manuais, estimar vel_max baseado em rpm_max e gear ratios
  const gearRatios = profile.gear_ratios as Record<string, number>;
  
  let estimatedVelMax = 200; // default (Naked)
  if (Object.keys(gearRatios).length === 6) {
    // Heurística: Desportiva tem rpm_max alto (15000) e ratios baixos
    if (profile.rpm_max >= 15000) {
      estimatedVelMax = 280;
    } else if (profile.rpm_max >= 12000) {
      estimatedVelMax = 200; // Naked
    }
  }
  
  // Faixas percentuais da vel_max:
  // Gear 1: 0-15%, Gear 2: 15-35%, Gear 3: 35-60%, etc.
  const speedPercentage = speed / estimatedVelMax;
  
  if (speedPercentage <= 0.15) return 1;
  if (speedPercentage <= 0.35) return 2;
  if (speedPercentage <= 0.60) return 3;
  if (speedPercentage <= 0.75) return 4;
  if (speedPercentage <= 0.90) return 5;
  return 6;
}

function estimateGear(speed: number, rpm: number, profile: MotorcycleProfile): number {
  if (profile.transmissao === 'CVT') return 0;

  if (speed <= 0) return 1;

  const wheelCircumference = Math.PI * profile.wheel_diameter_m;
  const finalDrive = profile.final_drive_ratio;

  // Usar a mesma fórmula de calculateRpmFromSpeed, mas para encontrar a melhor gear
  // calculateRpmFromSpeed: engineRpm = wheelAngularVel * gearRatio * finalDrive * 60 / (2 * Math.PI)
  // onde wheelAngularVel = (speedKmh * 1000 / 3600) / (wheelCircumference / 2)
  
  const speedMs = speed * 1000 / 3600; // converter para m/s
  const wheelAngularVel = speedMs / (wheelCircumference / 2);
  const baseFactor = wheelAngularVel * finalDrive * 60 / (2 * Math.PI);

  let bestGear = 1;
  let minDiff = Infinity;

  const manualRatios = profile.gear_ratios as Record<string, number>;
  for (const [gearStr, ratio] of Object.entries(manualRatios)) {
    const expectedRpm = baseFactor * ratio;
    const diff = Math.abs(expectedRpm - rpm);
    if (diff < minDiff) {
      minDiff = diff;
      bestGear = parseInt(gearStr);
    }
  }

  return bestGear;
}

// ---------------------------------------------------------------------------
// RiderData format processing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RiderData format processing
// ---------------------------------------------------------------------------

interface RiderDataRow {
  sensor: string;
  timestampMs: number;
  valor_x: number;
  valor_y: number;
  valor_z: number;
}

interface ProcessedSensorData {
  gpsData: Array<{ timestampMs: number; lat: number; lng: number; speed: number }>;
  ahrsData: Array<{ timestampMs: number; pitch: number; roll: number; yaw: number }>;
  accelData: Array<{ timestampMs: number; x: number; y: number; z: number }>;
}

/**
 * Detecta se o CSV está no formato RiderData
 */
function isRiderDataFormat(headers: string[]): boolean {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  return lowerHeaders.includes('sensor') && 
         lowerHeaders.includes('timestamp') && 
         (lowerHeaders.includes('valor_x') || lowerHeaders.includes('value_x'));
}

/**
 * Processa dados no formato RiderData
 */
function parseRiderDataFormat(lines: string[], options: ParseOptions = {}): ParseResult | ParseError {
  // Encontrar a linha "COLLECTED DATA" ou o cabeçalho real
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('sensor') && line.includes('timestamp') && 
        (line.includes('valor_x') || line.includes('value_x'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      type: 'NO_TIMESTAMP_COLUMN',
      message: 'Formato RiderData detectado mas cabeçalho não encontrado.'
    };
  }

  const headerLine = lines[headerIndex];
  const headers = splitCSVLine(headerLine).map(h => h.trim().toLowerCase());
  
  // Mapear índices das colunas
  const sensorIndex = headers.indexOf('sensor');
  const timestampIndex = headers.indexOf('timestamp');
  const valorXIndex = headers.findIndex(h => h === 'valor_x' || h === 'value_x');
  const valorYIndex = headers.findIndex(h => h === 'valor_y' || h === 'value_y');
  const valorZIndex = headers.findIndex(h => h === 'valor_z' || h === 'value_z');

  if (sensorIndex === -1 || timestampIndex === -1 || valorXIndex === -1 || 
      valorYIndex === -1 || valorZIndex === -1) {
    return {
      type: 'NO_TIMESTAMP_COLUMN',
      message: 'Colunas obrigatórias não encontradas no formato RiderData.'
    };
  }

  // Processar linhas de dados
  const riderRows: RiderDataRow[] = [];
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = splitCSVLine(line);
    
    const sensor = cells[sensorIndex]?.trim();
    const timestampStr = cells[timestampIndex]?.trim();
    const valorXStr = cells[valorXIndex]?.trim();
    const valorYStr = cells[valorYIndex]?.trim();
    const valorZStr = cells[valorZIndex]?.trim();

    if (!sensor || !timestampStr || !valorXStr || !valorYStr || !valorZStr) {
      skippedCount++;
      continue;
    }

    const timestampMs = Number(timestampStr);
    const valor_x = Number(valorXStr);
    const valor_y = Number(valorYStr);
    const valor_z = Number(valorZStr);

    if (isNaN(timestampMs) || isNaN(valor_x) || isNaN(valor_y) || isNaN(valor_z)) {
      skippedCount++;
      errors.push(`Linha ${i + 1}: valores numéricos inválidos.`);
      continue;
    }

    riderRows.push({ sensor, timestampMs, valor_x, valor_y, valor_z });
  }

  if (riderRows.length === 0) {
    return { type: 'EMPTY_FILE', message: 'Nenhum dado válido encontrado.' };
  }

  // Processar dados por sensor
  const sensorData = processRiderDataBySensor(riderRows);
  
  // Verificar se temos dados GPS
  if (sensorData.gpsData.length === 0) {
    return {
      type: 'NO_GPS_DATA',
      message: 'Nenhum dado GPS encontrado. O simulador requer coordenadas GPS para funcionar.'
    };
  }

  // Converter para ParsedRow
  const parsedRows = convertRiderDataToParsedRows(sensorData, options);
  
  if (parsedRows.length === 0) {
    return { type: 'EMPTY_FILE', message: 'Nenhum dado GPS válido encontrado.' };
  }

  const durationSec = parsedRows[parsedRows.length - 1].timestampSec;

  return {
    rows: parsedRows,
    skippedCount,
    columns: headers,
    durationSec,
    errors,
    format: 'riderdata'
  };
}

/**
 * Agrupa dados RiderData por tipo de sensor
 */
function processRiderDataBySensor(rows: RiderDataRow[]): ProcessedSensorData {
  const gpsData: Array<{ timestampMs: number; lat: number; lng: number; speed: number }> = [];
  const ahrsData: Array<{ timestampMs: number; pitch: number; roll: number; yaw: number }> = [];
  const accelData: Array<{ timestampMs: number; x: number; y: number; z: number }> = [];

  for (const row of rows) {
    switch (row.sensor.toUpperCase()) {
      case 'GPS':
        // GPS: Value_X = latitude (degrees), Value_Y = longitude (degrees), Value_Z = speed (km/h)
        gpsData.push({
          timestampMs: row.timestampMs,
          lat: row.valor_x,
          lng: row.valor_y,
          speed: row.valor_z
        });
        break;
      
      case 'AHRS':
        // AHRS: Value_X = pitch, Value_Y = roll, Value_Z = yaw (all in degrees)
        ahrsData.push({
          timestampMs: row.timestampMs,
          pitch: row.valor_x,
          roll: row.valor_y,
          yaw: row.valor_z
        });
        break;
      
      case 'ACEL':
        // Accelerometer: Value_X, Value_Y, Value_Z in m/s²
        accelData.push({
          timestampMs: row.timestampMs,
          x: row.valor_x,
          y: row.valor_y,
          z: row.valor_z
        });
        break;
      
      // GYRO data is available but not used in current implementation
    }
  }

  return { gpsData, ahrsData, accelData };
}

/**
 * Converte dados RiderData processados para ParsedRow com aprimoramento IRL
 */
function convertRiderDataToParsedRows(sensorData: ProcessedSensorData, options: ParseOptions = {}): ParsedRow[] {
  const { gpsData, ahrsData, accelData } = sensorData;

  if (gpsData.length === 0) return [];

  // Usar perfil especificado ou padrão
  const profileName = options.motorcycleProfile || DEFAULT_IRL_PROFILE;
  const profile = MOTORCYCLE_PROFILES[profileName] || MOTORCYCLE_PROFILES[DEFAULT_IRL_PROFILE];
  const enableEnhancement = options.enableIRLEnhancement ?? true; // Default to true for IRL data

  // Usar dados GPS como base temporal
  const firstTimestamp = gpsData[0].timestampMs;
  const rows: ParsedRow[] = [];

  let prevSpeed = 0;
  let currentTemp = profile.temp_motor_min + 5.0; // Começar em temperatura de marcha lenta

  for (let i = 0; i < gpsData.length; i++) {
    const gps = gpsData[i];
    const timestampSec = (gps.timestampMs - firstTimestamp) / 1000;

    // Encontrar dados AHRS mais próximos no tempo
    let nearestAhrs = ahrsData.length > 0 ? ahrsData[0] : null;
    let minTimeDiff = Infinity;

    for (const ahrs of ahrsData) {
      const timeDiff = Math.abs(ahrs.timestampMs - gps.timestampMs);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        nearestAhrs = ahrs;
      }
    }

    // Calcular dt para aceleração
    const dt = i > 0 ? (gps.timestampMs - gpsData[i-1].timestampMs) / 1000 : 1.0;

    let rpm = 0;
    let gear = 1;
    let throttlePct = 0;
    let engineTemp = 80;
    let voltage = 12.5;

    if (enableEnhancement) {
      // Estimar gear baseado em velocidade (heurística mais confiável sem RPM real)
      gear = estimateGearFromSpeed(gps.speed, profile);

      // Calcular RPM baseado na marcha estimada
      rpm = calculateRpmFromSpeed(gps.speed, gear, profile);

      // Estimar throttle
      throttlePct = estimateThrottle(gps.speed, prevSpeed, dt, profile);

      // Simular temperatura
      currentTemp = simulateEngineTemp(currentTemp, rpm, dt, profile);
      engineTemp = Math.round(currentTemp);

      // Simular voltagem
      voltage = Math.round(simulateVoltage(rpm, profile) * 10) / 10;
    }

    // Calcular g-force aproximada
    let gForce = 1.0;
    if (accelData.length > 0) {
      // Encontrar aceleração mais próxima
      let nearestAccel = accelData[0];
      minTimeDiff = Infinity;
      for (const accel of accelData) {
        const timeDiff = Math.abs(accel.timestampMs - gps.timestampMs);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          nearestAccel = accel;
        }
      }
      gForce = Math.sqrt(
        nearestAccel.x ** 2 +
        nearestAccel.y ** 2 +
        nearestAccel.z ** 2
      ) / 9.81;
    }

    const row: ParsedRow = {
      timestampSec,
      latitude: gps.lat,
      longitude: gps.lng,
      speed_kmh: gps.speed,
      rpm: Math.round(rpm),
      gear,
      throttle_pct: Math.round(throttlePct),
      engine_temp_c: engineTemp,
      voltage,
      roll_deg: nearestAhrs?.roll ?? 0,
      pitch_deg: nearestAhrs?.pitch ?? 0,
      yaw_deg: nearestAhrs?.yaw ?? 0,
      g_force: Math.round(gForce * 100) / 100 // 2 casas decimais
    };

    rows.push(row);
    prevSpeed = gps.speed;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Column alias maps (case-insensitive — keys are lowercased)
// ---------------------------------------------------------------------------

const TIMESTAMP_ALIASES = new Set(['timestamp', 'time', 't']);

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  speed: 'speed_kmh',
  speed_kmh: 'speed_kmh',
  rpm: 'rpm',
  gear: 'gear',
  throttle: 'throttle_pct',
  throttle_pct: 'throttle_pct',
  engine_temp: 'engine_temp_c',
  engine_temp_c: 'engine_temp_c',
  voltage: 'voltage',
  lat: 'latitude',
  latitude: 'latitude',
  lon: 'longitude',
  lng: 'longitude',
  longitude: 'longitude',
  roll: 'roll_deg',
  roll_deg: 'roll_deg',
  pitch: 'pitch_deg',
  pitch_deg: 'pitch_deg',
  yaw: 'yaw_deg',
  yaw_deg: 'yaw_deg',
  g_force: 'g_force',
  gforce: 'g_force',
};

// ---------------------------------------------------------------------------
// Defaults for missing fields
// ---------------------------------------------------------------------------

const DEFAULTS: Omit<ParsedRow, 'timestampSec' | 'latitude' | 'longitude'> = {
  speed_kmh: 0,
  rpm: 0,
  gear: 1,
  throttle_pct: 0,
  engine_temp_c: 80,
  voltage: 12.5,
  roll_deg: 0,
  pitch_deg: 0,
  yaw_deg: 0,
  g_force: 1.0,
};

// ---------------------------------------------------------------------------
// Timestamp parsing
// ---------------------------------------------------------------------------

/**
 * Parses a timestamp string to seconds relative to the first row.
 * Supports:
 *   - Numeric strings: "0", "1.5", "120.0"  → seconds as-is
 *   - ISO 8601: "2024-01-15T10:30:00.000Z"  → ms since epoch / 1000
 *
 * Returns null if the value cannot be parsed.
 */
function parseTimestampRaw(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  // Try numeric first
  const numeric = Number(trimmed);
  if (!isNaN(numeric) && isFinite(numeric)) {
    return numeric;
  }

  // Try ISO 8601
  const ms = Date.parse(trimmed);
  if (!isNaN(ms)) {
    return ms / 1000;
  }

  return null;
}

// ---------------------------------------------------------------------------
// CSV line splitter (handles quoted fields)
// ---------------------------------------------------------------------------

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Main parseCSV function
// ---------------------------------------------------------------------------

export interface ParseOptions {
  enableIRLEnhancement?: boolean;
  motorcycleProfile?: string;
}

export function parseCSV(text: string, options: ParseOptions = {}): ParseResult | ParseError {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Filter out completely empty lines
  const nonEmpty = lines.filter((l) => l.trim() !== '');

  if (nonEmpty.length === 0) {
    return { type: 'EMPTY_FILE', message: 'O ficheiro CSV está vazio.' };
  }

  // Detectar formato RiderData primeiro
  const hasRiderDataFormat = nonEmpty.some(line => {
    const lower = line.toLowerCase();
    return lower.includes('sensor') && lower.includes('timestamp') && 
           (lower.includes('valor_x') || lower.includes('value_x'));
  });

  if (hasRiderDataFormat) {
    return parseRiderDataFormat(nonEmpty, options);
  }

  // Processar formato genérico
  return parseGenericFormat(nonEmpty);
}

/**
 * Processa formato genérico com colunas nomeadas
 */
function parseGenericFormat(lines: string[]): ParseResult | ParseError {
  // Parse header
  const headerLine = lines[0];
  const rawHeaders = splitCSVLine(headerLine).map((h) => h.trim());
  const headers = rawHeaders.map((h) => h.toLowerCase());

  // Detect timestamp column index
  const tsIndex = headers.findIndex((h) => TIMESTAMP_ALIASES.has(h));
  if (tsIndex === -1) {
    return {
      type: 'NO_TIMESTAMP_COLUMN',
      message: `Coluna de timestamp não encontrada. Colunas reconhecidas: ${[...TIMESTAMP_ALIASES].join(', ')}. Colunas encontradas: ${rawHeaders.join(', ')}.`,
    };
  }

  // Build column → field mapping for data columns
  const colMapping: Array<{ colIndex: number; field: keyof ParsedRow }> = [];
  for (let i = 0; i < headers.length; i++) {
    if (i === tsIndex) continue;
    const field = COLUMN_MAP[headers[i]];
    if (field) {
      // Avoid duplicate mappings (first alias wins)
      if (!colMapping.some((m) => m.field === field)) {
        colMapping.push({ colIndex: i, field });
      }
    }
  }

  const rows: ParsedRow[] = [];
  let skippedCount = 0;
  const errors: string[] = [];
  let firstTimestampAbsSec: number | null = null;

  // Process data rows
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const cells = splitCSVLine(line).map((c) => c.trim());

    // Parse timestamp
    const tsRaw = cells[tsIndex] ?? '';
    const tsAbsSec = parseTimestampRaw(tsRaw);
    if (tsAbsSec === null) {
      skippedCount++;
      errors.push(`Linha ${lineIdx + 1}: timestamp inválido "${tsRaw}".`);
      continue;
    }

    // Establish relative base from first valid timestamp
    if (firstTimestampAbsSec === null) {
      firstTimestampAbsSec = tsAbsSec;
    }
    const timestampSec = tsAbsSec - firstTimestampAbsSec;

    // Parse latitude and longitude — required fields
    let latitude: number | null = null;
    let longitude: number | null = null;

    for (const { colIndex, field } of colMapping) {
      if (field === 'latitude') {
        const raw = (cells[colIndex] ?? '').trim();
        const v = raw !== '' ? Number(raw) : NaN;
        latitude = isNaN(v) ? null : v;
      } else if (field === 'longitude') {
        const raw = (cells[colIndex] ?? '').trim();
        const v = raw !== '' ? Number(raw) : NaN;
        longitude = isNaN(v) ? null : v;
      }
    }

    if (latitude === null || longitude === null) {
      skippedCount++;
      continue;
    }

    // Build row with defaults
    const row: ParsedRow = {
      timestampSec,
      latitude,
      longitude,
      ...DEFAULTS,
    };

    // Fill mapped columns
    for (const { colIndex, field } of colMapping) {
      if (field === 'latitude' || field === 'longitude') continue;
      const raw = (cells[colIndex] ?? '').trim();
      if (raw === '') continue;
      const v = Number(raw);
      if (!isNaN(v)) {
        (row as unknown as Record<string, number>)[field] = v;
      }
    }

    rows.push(row);
  }

  if (rows.length === 0 && skippedCount === 0) {
    return { type: 'EMPTY_FILE', message: 'O ficheiro CSV não contém linhas de dados.' };
  }

  const durationSec = rows.length > 0 ? rows[rows.length - 1].timestampSec : 0;

  return {
    rows,
    skippedCount,
    columns: rawHeaders,
    durationSec,
    errors,
    format: 'generic'
  };
}
