"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const trip_categorization_service_1 = require("./trip-categorization.service");
const prisma_service_1 = require("./prisma.service");
const enums_1 = require("../generated/prisma/enums");
vitest_1.vi.mock('./prisma.service', () => ({
    prisma: {
        trip: {
            findFirst: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
    },
}));
(0, vitest_1.describe)('TripCategorizationService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('categorizeTrip (pure function)', () => {
        (0, vitest_1.it)('should categorize as COMMUTE for short slow trips', () => {
            const input = {
                trip: { distanceKm: 5, avgSpeedKmh: 30, maxSpeedKmh: 50, maxRollDeg: 10, maxGForce: 1.1 },
                eventCounts: { SPEEDING: 0 }
            };
            const result = (0, trip_categorization_service_1.categorizeTrip)(input);
            (0, vitest_1.expect)(result.category).toBe('COMMUTE');
        });
        (0, vitest_1.it)('should categorize as WEEKEND_RIDE for longer trips', () => {
            const input = {
                trip: { distanceKm: 50, avgSpeedKmh: 70, maxSpeedKmh: 100, maxRollDeg: 25, maxGForce: 1.2 },
                eventCounts: {}
            };
            const result = (0, trip_categorization_service_1.categorizeTrip)(input);
            (0, vitest_1.expect)(result.category).toBe('WEEKEND_RIDE');
        });
        (0, vitest_1.it)('should categorize as TRACK_DAY for aggressive riding', () => {
            const input = {
                trip: { distanceKm: 40, avgSpeedKmh: 90, maxSpeedKmh: 150, maxRollDeg: 45, maxGForce: 1.5 },
                eventCounts: { SPEEDING: 2, EXCESSIVE_LEAN: 2 }
            };
            const result = (0, trip_categorization_service_1.categorizeTrip)(input);
            (0, vitest_1.expect)(result.category).toBe('TRACK_DAY');
        });
        (0, vitest_1.it)('should categorize as OFF_ROAD for bumpy slow rides', () => {
            const input = {
                trip: { distanceKm: 10, avgSpeedKmh: 20, maxSpeedKmh: 40, maxRollDeg: 35, maxGForce: 1.8 },
                eventCounts: { HIGH_VIBRATION: 2 }
            };
            const result = (0, trip_categorization_service_1.categorizeTrip)(input);
            (0, vitest_1.expect)(result.category).toBe('OFF_ROAD');
        });
    });
    (0, vitest_1.describe)('categorizeTripById', () => {
        (0, vitest_1.it)('should fetch from DB and save result', async () => {
            prisma_service_1.prisma.trip.findFirst.mockResolvedValue({
                id: 't1',
                userId: 'u1',
                status: enums_1.TripStatus.COMPLETED,
                distanceKm: 100,
                avgSpeedKmh: 80,
                maxSpeedKmh: 120,
                maxRollDeg: 30,
                maxGForce: 1.3,
                events: [],
                motorcycle: { profile: { maxSpeedKmh: 200, typicalMaxRollDeg: 40 } }
            });
            const result = await (0, trip_categorization_service_1.categorizeTripById)('t1', 'u1');
            (0, vitest_1.expect)(result?.category).toBe('WEEKEND_RIDE');
            (0, vitest_1.expect)(prisma_service_1.prisma.trip.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { id: 't1' },
                data: vitest_1.expect.objectContaining({ category: 'WEEKEND_RIDE' })
            }));
        });
    });
});
//# sourceMappingURL=trip-categorization.service.test.js.map