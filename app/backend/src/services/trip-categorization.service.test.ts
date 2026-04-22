import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categorizeTrip, categorizeTripById, type CategorizationInput } from './trip-categorization.service';
import { prisma } from './prisma.service';
import { TripStatus } from '../generated/prisma/enums';

vi.mock('./prisma.service', () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('TripCategorizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('categorizeTrip (pure function)', () => {
    it('should categorize as COMMUTE for short slow trips', () => {
      const input: CategorizationInput = {
        trip: { distanceKm: 5, avgSpeedKmh: 30, maxSpeedKmh: 50, maxRollDeg: 10, maxGForce: 1.1 },
        eventCounts: { SPEEDING: 0 }
      };
      const result = categorizeTrip(input);
      expect(result.category).toBe('COMMUTE');
    });

    it('should categorize as WEEKEND_RIDE for longer trips', () => {
      const input: CategorizationInput = {
        trip: { distanceKm: 50, avgSpeedKmh: 70, maxSpeedKmh: 100, maxRollDeg: 25, maxGForce: 1.2 },
        eventCounts: {}
      };
      const result = categorizeTrip(input);
      expect(result.category).toBe('WEEKEND_RIDE');
    });

    it('should categorize as TRACK_DAY for aggressive riding', () => {
      const input: CategorizationInput = {
        trip: { distanceKm: 40, avgSpeedKmh: 90, maxSpeedKmh: 150, maxRollDeg: 45, maxGForce: 1.5 },
        eventCounts: { SPEEDING: 2, EXCESSIVE_LEAN: 2 }
      };
      const result = categorizeTrip(input);
      expect(result.category).toBe('TRACK_DAY');
    });

    it('should categorize as OFF_ROAD for bumpy slow rides', () => {
      const input: CategorizationInput = {
        trip: { distanceKm: 10, avgSpeedKmh: 20, maxSpeedKmh: 40, maxRollDeg: 35, maxGForce: 1.8 },
        eventCounts: { HIGH_VIBRATION: 2 }
      };
      const result = categorizeTrip(input);
      expect(result.category).toBe('OFF_ROAD');
    });
  });

  describe('categorizeTripById', () => {
    it('should fetch from DB and save result', async () => {
      (prisma.trip.findFirst as any).mockResolvedValue({
        id: 't1',
        userId: 'u1',
        status: TripStatus.COMPLETED,
        distanceKm: 100,
        avgSpeedKmh: 80,
        maxSpeedKmh: 120,
        maxRollDeg: 30,
        maxGForce: 1.3,
        events: [],
        motorcycle: { profile: { maxSpeedKmh: 200, typicalMaxRollDeg: 40 } }
      });

      const result = await categorizeTripById('t1', 'u1');
      expect(result?.category).toBe('WEEKEND_RIDE');
      expect(prisma.trip.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ category: 'WEEKEND_RIDE' })
      }));
    });
  });
});
