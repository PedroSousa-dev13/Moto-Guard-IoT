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
function parseRiderDataFormat(lines: string[]): ParseResult | ParseError {
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
  const parsedRows = convertRiderDataToParsedRows(sensorData);
  
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
 * Converte dados RiderData processados para ParsedRow
 */
function convertRiderDataToParsedRows(sensorData: ProcessedSensorData): ParsedRow[] {
  const { gpsData, ahrsData } = sensorData;
  
  if (gpsData.length === 0) return [];

  // Usar dados GPS como base temporal
  const firstTimestamp = gpsData[0].timestampMs;
  const rows: ParsedRow[] = [];

  for (const gps of gpsData) {
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

    // Calcular g-force aproximada a partir da aceleração (se disponível)
    let gForce = 1.0; // default
    // Poderíamos usar dados do acelerómetro aqui se necessário

    const row: ParsedRow = {
      timestampSec,
      latitude: gps.lat,
      longitude: gps.lng,
      speed_kmh: gps.speed,
      rpm: 0, // não disponível nos dados RiderData
      gear: 1, // default
      throttle_pct: 0, // não disponível
      engine_temp_c: 80, // default
      voltage: 12.5, // default
      roll_deg: nearestAhrs?.roll ?? 0,
      pitch_deg: nearestAhrs?.pitch ?? 0,
      yaw_deg: nearestAhrs?.yaw ?? 0,
      g_force: gForce
    };

    rows.push(row);
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

export function parseCSV(text: string): ParseResult | ParseError {
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
    return parseRiderDataFormat(nonEmpty);
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
