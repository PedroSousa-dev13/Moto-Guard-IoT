// =============================================================================
// MotoGuard IoT — csvParser unit tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { parseCSV } from '../csvParser';
import type { ParseResult, ParseError } from '../csvParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isError(r: ParseResult | ParseError): r is ParseError {
  return 'type' in r;
}

function isResult(r: ParseResult | ParseError): r is ParseResult {
  return 'rows' in r;
}

// ---------------------------------------------------------------------------
// Basic valid CSV
// ---------------------------------------------------------------------------

describe('parseCSV — valid CSV', () => {
  const csv = [
    'timestamp,lat,lon,speed_kmh,rpm,gear',
    '0.0,38.7169,-9.1399,60,3000,3',
    '1.0,38.7170,-9.1400,65,3200,3',
    '2.0,38.7171,-9.1401,70,3400,4',
  ].join('\n');

  it('returns ParseResult with correct row count', () => {
    const result = parseCSV(csv);
    expect(isResult(result)).toBe(true);
    const r = result as ParseResult;
    expect(r.rows).toHaveLength(3);
    expect(r.skippedCount).toBe(0);
  });

  it('timestamps are relative to first row', () => {
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].timestampSec).toBe(0);
    expect(r.rows[1].timestampSec).toBeCloseTo(1.0);
    expect(r.rows[2].timestampSec).toBeCloseTo(2.0);
  });

  it('maps lat/lon correctly', () => {
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].latitude).toBeCloseTo(38.7169);
    expect(r.rows[0].longitude).toBeCloseTo(-9.1399);
  });

  it('maps speed_kmh, rpm, gear correctly', () => {
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].speed_kmh).toBe(60);
    expect(r.rows[0].rpm).toBe(3000);
    expect(r.rows[0].gear).toBe(3);
  });

  it('durationSec equals last row timestampSec', () => {
    const r = parseCSV(csv) as ParseResult;
    expect(r.durationSec).toBeCloseTo(2.0);
  });

  it('columns contains original header names', () => {
    const r = parseCSV(csv) as ParseResult;
    expect(r.columns).toContain('timestamp');
    expect(r.columns).toContain('lat');
    expect(r.columns).toContain('lon');
  });
});

// ---------------------------------------------------------------------------
// Defaults for missing fields
// ---------------------------------------------------------------------------

describe('parseCSV — defaults for missing fields', () => {
  const csv = [
    'time,latitude,longitude',
    '0,38.7,−9.1',
    '1,38.71,-9.14',
  ].join('\n');

  it('applies defaults when optional columns are absent', () => {
    // Only row 2 has valid coords (row 1 has invalid longitude)
    const csv2 = ['time,latitude,longitude', '0,38.7,-9.1'].join('\n');
    const r = parseCSV(csv2) as ParseResult;
    expect(r.rows[0].gear).toBe(1);
    expect(r.rows[0].throttle_pct).toBe(0);
    expect(r.rows[0].engine_temp_c).toBe(80);
    expect(r.rows[0].voltage).toBe(12.5);
    expect(r.rows[0].roll_deg).toBe(0);
    expect(r.rows[0].pitch_deg).toBe(0);
    expect(r.rows[0].yaw_deg).toBe(0);
    expect(r.rows[0].g_force).toBe(1.0);
    expect(r.rows[0].speed_kmh).toBe(0);
    expect(r.rows[0].rpm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Column alias mapping (case-insensitive)
// ---------------------------------------------------------------------------

describe('parseCSV — column alias mapping', () => {
  it('maps speed alias', () => {
    const csv = ['t,lat,lon,speed', '0,38.7,-9.1,80'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].speed_kmh).toBe(80);
  });

  it('maps throttle alias', () => {
    const csv = ['t,lat,lon,throttle', '0,38.7,-9.1,50'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].throttle_pct).toBe(50);
  });

  it('maps engine_temp alias', () => {
    const csv = ['t,lat,lon,engine_temp', '0,38.7,-9.1,95'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].engine_temp_c).toBe(95);
  });

  it('maps gforce alias', () => {
    const csv = ['t,lat,lon,gforce', '0,38.7,-9.1,1.5'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].g_force).toBe(1.5);
  });

  it('maps roll alias', () => {
    const csv = ['t,lat,lon,roll', '0,38.7,-9.1,30'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].roll_deg).toBe(30);
  });

  it('maps lng alias for longitude', () => {
    const csv = ['t,lat,lng', '0,38.7,-9.1'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].longitude).toBeCloseTo(-9.1);
  });

  it('is case-insensitive for column names', () => {
    const csv = ['TIMESTAMP,LATITUDE,LONGITUDE,SPEED_KMH', '0,38.7,-9.1,100'].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows[0].speed_kmh).toBe(100);
    expect(r.rows[0].latitude).toBeCloseTo(38.7);
  });
});

// ---------------------------------------------------------------------------
// Skipping invalid rows
// ---------------------------------------------------------------------------

describe('parseCSV — skipping invalid rows', () => {
  it('skips rows with missing latitude', () => {
    const csv = [
      'timestamp,lat,lon',
      '0,,−9.1',
      '1,38.71,-9.14',
    ].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(1);
    expect(r.skippedCount).toBe(1);
  });

  it('skips rows with missing longitude', () => {
    const csv = [
      'timestamp,lat,lon',
      '0,38.7,',
      '1,38.71,-9.14',
    ].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(1);
    expect(r.skippedCount).toBe(1);
  });

  it('skips rows with invalid timestamp', () => {
    const csv = [
      'timestamp,lat,lon',
      'not-a-time,38.7,-9.1',
      '1,38.71,-9.14',
    ].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(1);
    expect(r.skippedCount).toBe(1);
  });

  it('ignores unknown columns without error', () => {
    const csv = [
      'timestamp,lat,lon,unknown_col,another_unknown',
      '0,38.7,-9.1,foo,bar',
    ].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(1);
    expect(r.skippedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ISO 8601 timestamps
// ---------------------------------------------------------------------------

describe('parseCSV — ISO 8601 timestamps', () => {
  it('parses ISO 8601 and makes timestamps relative', () => {
    const csv = [
      'timestamp,lat,lon',
      '2024-01-15T10:30:00.000Z,38.7,-9.1',
      '2024-01-15T10:30:01.000Z,38.71,-9.14',
      '2024-01-15T10:30:02.500Z,38.72,-9.15',
    ].join('\n');
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0].timestampSec).toBe(0);
    expect(r.rows[1].timestampSec).toBeCloseTo(1.0);
    expect(r.rows[2].timestampSec).toBeCloseTo(2.5);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('parseCSV — error cases', () => {
  it('returns EMPTY_FILE for empty string', () => {
    const r = parseCSV('') as ParseError;
    expect(r.type).toBe('EMPTY_FILE');
  });

  it('returns EMPTY_FILE for whitespace-only string', () => {
    const r = parseCSV('   \n  \n') as ParseError;
    expect(r.type).toBe('EMPTY_FILE');
  });

  it('returns NO_TIMESTAMP_COLUMN when no timestamp column present', () => {
    const csv = ['lat,lon,speed', '38.7,-9.1,60'].join('\n');
    const r = parseCSV(csv) as ParseError;
    expect(r.type).toBe('NO_TIMESTAMP_COLUMN');
    expect(r.message).toBeTruthy();
  });

  it('returns EMPTY_FILE when header exists but no data rows', () => {
    const csv = 'timestamp,lat,lon';
    const r = parseCSV(csv) as ParseError;
    expect(r.type).toBe('EMPTY_FILE');
  });
});

// ---------------------------------------------------------------------------
// CRLF line endings
// ---------------------------------------------------------------------------

describe('parseCSV — CRLF line endings', () => {
  it('handles Windows CRLF line endings', () => {
    const csv = 'timestamp,lat,lon\r\n0,38.7,-9.1\r\n1,38.71,-9.14\r\n';
    const r = parseCSV(csv) as ParseResult;
    expect(r.rows).toHaveLength(2);
  });
});
