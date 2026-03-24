// Feature: real-simulator, Property 10: Time format MM:SS is always valid
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { formatTime } from '../utils';

/**
 * Validates: Requirements 5.8
 *
 * Property 10: Time format MM:SS is always valid
 * For any non-negative integer S, formatTime(S) must:
 *   - Match the pattern ^\d{2}:\d{2}$
 *   - Have seconds component in [0, 59]
 *   - Have minutes component equal to Math.floor(S / 60) padded to 2 digits
 *   - Have seconds component equal to S % 60 padded to 2 digits
 */
describe('Property 10: Time format MM:SS is always valid', () => {
  it('formatTime always returns a valid MM:SS string for any non-negative integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999 }),
        (S) => {
          const result = formatTime(S);

          // Assert matches ^\d{2,}:\d{2}$ (minutes can exceed 2 digits for large values)
          expect(result).toMatch(/^\d{2,}:\d{2}$/);

          const [minsPart, secsPart] = result.split(':');

          // Assert seconds component is in [0, 59]
          const secsNum = parseInt(secsPart, 10);
          expect(secsNum).toBeGreaterThanOrEqual(0);
          expect(secsNum).toBeLessThanOrEqual(59);

          // Assert minutes component equals Math.floor(S / 60) padded to 2 digits
          const expectedMins = String(Math.floor(S / 60)).padStart(2, '0');
          expect(minsPart).toBe(expectedMins);

          // Assert seconds component equals S % 60 padded to 2 digits
          const expectedSecs = String(S % 60).padStart(2, '0');
          expect(secsPart).toBe(expectedSecs);
        }
      ),
      { numRuns: 100 }
    );
  });
});
