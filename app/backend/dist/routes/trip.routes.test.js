"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
const prisma_service_1 = require("../services/prisma.service");
// Mock do prisma e auth middleware
vitest_1.vi.mock('../services/prisma.service', () => ({
    prisma: {
        trip: {
            findMany: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            findFirst: vitest_1.vi.fn(),
        },
        $connect: vitest_1.vi.fn().mockResolvedValue(undefined),
        $disconnect: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
// Mock do middleware de autenticação para injetar userId
vitest_1.vi.mock('../middleware/auth.middleware', () => ({
    authMiddleware: (req, res, next) => {
        req.userId = 'test-user-id';
        next();
    },
}));
(0, vitest_1.describe)('Trip Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should list trips for a user', async () => {
        prisma_service_1.prisma.trip.findMany.mockResolvedValue([
            { id: 'trip-1', status: 'COMPLETED', startedAt: new Date() },
        ]);
        const response = await (0, supertest_1.default)(index_1.app).get('/api/trips');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(response.body)).toBe(true);
        (0, vitest_1.expect)(response.body[0].id).toBe('trip-1');
    });
    (0, vitest_1.it)('should return 404 for non-existent trip', async () => {
        prisma_service_1.prisma.trip.findFirst.mockResolvedValue(null);
        const response = await (0, supertest_1.default)(index_1.app).get('/api/trips/non-existent');
        (0, vitest_1.expect)(response.status).toBe(404);
    });
});
//# sourceMappingURL=trip.routes.test.js.map