// =============================================================================
// MotoGuard IoT — CSV_Parser
// =============================================================================
// Módulo puro (sem side effects) que lê e valida um ficheiro CSV de telemetria
// e devolve ParseResult ou ParseError.
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
}

export interface ParseError {
  type: 'NO_TIMESTAMP_COLUMN' | 'INVALID_EXTENSION' | 'EMPTY_FILE';
  message: string;
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

  // Parse header
  const headerLine = nonEmpty[0];
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
  for (let lineIdx = 1; lineIdx < nonEmpty.length; lineIdx++) {
    const line = nonEmpty[lineIdx];
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
  };
}
