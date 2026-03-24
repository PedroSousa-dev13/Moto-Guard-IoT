// =============================================================================
// MotoGuard IoT — csvParser property-based tests
// =============================================================================
// Feature: real-simulator, Property 1: CSV parsing preserves row count minus skipped rows

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { parseCSV } from '../csvParser';
import type { ParseResult, ParseError } from '../csvParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isResult(r: ParseResult | ParseError): r is ParseResult {
  return 'rows' in r;
}

/**
 * Builds a CSV string with N valid rows and K invalid rows (missing lat/lon).
 * The header always includes timestamp, lat, lon.
 * Valid rows have numeric lat/lon; invalid rows have empty lat or lon.
 */
function buildCSV(
  validRows: Array<{ ts: number; lat: number; lon: number }>,
  invalidRows: Array<{ ts: number; missingLat: boolean }>,
): string {
  const header = 'timestamp,lat,lon';

  // Interleave valid and invalid rows in a deterministic order
  const allRows: string[] = [];

  for (const row of validRows) {
    allRows.push(`${row.ts},${row.lat},${row.lon}`);
  }

  for (const row of invalidRows) {
    if (row.missingLat) {
      // Missing latitude — lon present
      allRows.push(`${row.ts},,-9.1`);
    } else {
      // Missing longitude — lat present
      allRows.push(`${row.ts},38.7,`);
    }
  }

  return [header, ...allRows].join('\n');
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// A valid row: timestamp is a non-negative finite number, lat/lon are finite
const validRowArb = fc.record({
  ts: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
  lat: fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  lon: fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
});

// An invalid row: timestamp is valid, but lat or lon is missing
const invalidRowArb = fc.record({
  ts: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
  missingLat: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 1: CSV parsing preserves row count minus skipped rows
// Validates: Requirements 1.6
// ---------------------------------------------------------------------------

describe('Property 1 — Row count', () => {
  it('rows.length === N - K and skippedCount === K for any N valid and K invalid rows', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 0, maxLength: 20 }),
        fc.array(invalidRowArb, { minLength: 0, maxLength: 10 }),
        (validRows, invalidRows) => {
          // Need at least one row total to avoid EMPTY_FILE error
          if (validRows.length === 0 && invalidRows.length === 0) return true;

          const csv = buildCSV(validRows, invalidRows);
          const result = parseCSV(csv);

          if (!isResult(result)) {
            // If we get a ParseError it should only happen when there are no rows at all
            // (EMPTY_FILE when all rows are skipped and rows.length === 0)
            return validRows.length === 0;
          }

          const N = validRows.length;
          const K = invalidRows.length;

          return result.rows.length === N && result.skippedCount === K;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Timestamp parsing round-trip
// Feature: real-simulator, Property 2: Timestamp parsing round-trip
// Validates: Requirements 1.7, 2.5
// ---------------------------------------------------------------------------

describe('Property 2 — Timestamp round-trip', () => {
  it('numeric: |result.rows[0].timestampSec - S| < 0.001 for any S >= 0', () => {
    fc.assert(
      fc.property(
        // Generate a non-negative finite float for the timestamp
        fc.float({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (S, lat, lon) => {
          const csv = `timestamp,lat,lon\n${S},${lat},${lon}`;
          const result = parseCSV(csv);

          if (!isResult(result)) return false;
          if (result.rows.length !== 1) return false;

          // First row's timestampSec should be 0 (relative to itself)
          // The absolute value S is the base, so relative = S - S = 0
          return Math.abs(result.rows[0].timestampSec - 0) < 0.001;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('numeric two-row: |rows[1].timestampSec - (S2 - S1)| < 0.001 for any S1 <= S2', () => {
    fc.assert(
      fc.property(
        // S1 is the first timestamp, delta is the offset for the second
        fc.float({ min: 0, max: 50000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 50000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (S1, delta, lat, lon) => {
          const S2 = S1 + delta;
          const csv = [
            'timestamp,lat,lon',
            `${S1},${lat},${lon}`,
            `${S2},${lat},${lon}`,
          ].join('\n');
          const result = parseCSV(csv);

          if (!isResult(result)) return false;
          if (result.rows.length !== 2) return false;

          const expected = S2 - S1;
          return Math.abs(result.rows[1].timestampSec - expected) < 0.001;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ISO 8601 two-row: |rows[1].timestampSec - (D2 - D1) / 1000| < 0.001 for any D1 <= D2', () => {
    fc.assert(
      fc.property(
        // Generate two dates where D2 >= D1
        fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') }),
        fc.integer({ min: 0, max: 86400000 }), // offset in ms (0 to 24h)
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        (D1, offsetMs, lat, lon) => {
          const D2 = new Date(D1.getTime() + offsetMs);
          const iso1 = D1.toISOString();
          const iso2 = D2.toISOString();

          const csv = [
            'timestamp,lat,lon',
            `${iso1},${lat},${lon}`,
            `${iso2},${lat},${lon}`,
          ].join('\n');
          const result = parseCSV(csv);

          if (!isResult(result)) return false;
          if (result.rows.length !== 2) return false;

          const expectedSec = offsetMs / 1000;
          return Math.abs(result.rows[1].timestampSec - expectedSec) < 0.001;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Column mapping is case-insensitive and complete
// Feature: real-simulator, Property 3: Column mapping is case-insensitive and complete
// Validates: Requirements 2.1, 2.3
// ---------------------------------------------------------------------------

describe('Property 3 — Column mapping case-insensitive and complete', () => {
  // Randomise the case of a string using a fast-check arbitrary
  const randomCaseArb = (s: string) =>
    fc.array(fc.boolean(), { minLength: s.length, maxLength: s.length }).map((flips) =>
      s
        .split('')
        .map((ch, i) => (flips[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(''),
    );

  // Known values for each field
  const KNOWN_VALUES = {
    speed_kmh: 55.5,
    rpm: 3200,
    gear: 3,
    throttle_pct: 42.0,
    engine_temp_c: 95.0,
    voltage: 13.8,
    latitude: 38.7,
    longitude: -9.1,
    roll_deg: 5.0,
    pitch_deg: -2.0,
    yaw_deg: 180.0,
    g_force: 1.5,
  };

  // One representative alias per field (the canonical name)
  const FIELD_ALIASES: Record<keyof typeof KNOWN_VALUES, string[]> = {
    speed_kmh: ['speed', 'speed_kmh'],
    rpm: ['rpm'],
    gear: ['gear'],
    throttle_pct: ['throttle', 'throttle_pct'],
    engine_temp_c: ['engine_temp', 'engine_temp_c'],
    voltage: ['voltage'],
    latitude: ['lat', 'latitude'],
    longitude: ['lon', 'lng', 'longitude'],
    roll_deg: ['roll', 'roll_deg'],
    pitch_deg: ['pitch', 'pitch_deg'],
    yaw_deg: ['yaw', 'yaw_deg'],
    g_force: ['g_force', 'gforce'],
  };

  it('all fields are correctly mapped regardless of column name case', () => {
    // For each field, pick one alias and randomise its case
    const fieldKeys = Object.keys(KNOWN_VALUES) as Array<keyof typeof KNOWN_VALUES>;

    // Build an arbitrary that picks one alias per field and randomises its case
    const columnNamesArb = fc.tuple(
      ...fieldKeys.map((field) =>
        fc
          .constantFrom(...FIELD_ALIASES[field])
          .chain((alias) => randomCaseArb(alias)),
      ),
    );

    fc.assert(
      fc.property(columnNamesArb, (columnNames) => {
        // Build CSV header: timestamp + one column per field
        const header = ['timestamp', ...columnNames].join(',');

        // Build data row: ts=0 + known values in the same order as columnNames
        const dataValues = fieldKeys.map((field) => KNOWN_VALUES[field]);
        const dataRow = ['0', ...dataValues].join(',');

        const csv = [header, dataRow].join('\n');
        const result = parseCSV(csv);

        if (!isResult(result)) return false;
        if (result.rows.length !== 1) return false;

        const row = result.rows[0];

        // Assert every field matches the known value (within float tolerance)
        for (const field of fieldKeys) {
          const expected = KNOWN_VALUES[field];
          const actual = row[field];
          if (Math.abs((actual as number) - expected) > 0.0001) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  it('fields absent from CSV receive their documented default values', () => {
    // CSV with only timestamp + lat + lon — all other fields should be defaults
    const DEFAULTS = {
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

    // Randomise case of 'timestamp', 'lat', 'lon'
    const headerArb = fc.tuple(
      randomCaseArb('timestamp'),
      randomCaseArb('lat'),
      randomCaseArb('lon'),
    );

    fc.assert(
      fc.property(
        headerArb,
        fc.float({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
        ([tsCol, latCol, lonCol], lat, lon) => {
          const header = [tsCol, latCol, lonCol].join(',');
          const dataRow = `0,${lat},${lon}`;
          const csv = [header, dataRow].join('\n');

          const result = parseCSV(csv);
          if (!isResult(result)) return false;
          if (result.rows.length !== 1) return false;

          const row = result.rows[0];

          for (const [field, expected] of Object.entries(DEFAULTS)) {
            const actual = row[field as keyof ParsedRow] as number;
            if (Math.abs(actual - expected) > 0.0001) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
