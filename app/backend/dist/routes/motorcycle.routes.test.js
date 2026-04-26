"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
const prisma_service_1 = require("../services/prisma.service");
vitest_1.vi.mock('../services/prisma.service', () => ({
    prisma: {
        motorcycle: {
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            findFirst: vitest_1.vi.fn(),
        },
        motorcycleProfile: {
            findMany: vitest_1.vi.fn(),
        },
        $connect: vitest_1.vi.fn().mockResolvedValue(undefined),
        $disconnect: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
vitest_1.vi.mock('../middleware/auth.middleware', () => ({
    authMiddleware: (req, res, next) => {
        req.userId = 'test-user-id';
        next();
    },
}));
(0, vitest_1.describe)('Motorcycle Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should list motorcycles for a user', async () => {
        prisma_service_1.prisma.motorcycle.findMany.mockResolvedValue([
            { id: 'm1', name: 'Yamaha R6', brand: 'Yamaha' }
        ]);
        const response = await (0, supertest_1.default)(index_1.app).get('/api/motorcycles');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body[0].name).toBe('Yamaha R6');
    });
    (0, vitest_1.it)('should create a new motorcycle', async () => {
        prisma_service_1.prisma.motorcycle.create.mockResolvedValue({ id: 'm2', name: 'Honda CBR' });
        const response = await (0, supertest_1.default)(index_1.app)
            .post('/api/motorcycles')
            .send({ name: 'Honda CBR', brand: 'Honda', category: 'Sport' });
        (0, vitest_1.expect)(response.status).toBe(201);
        (0, vitest_1.expect)(response.body.name).toBe('Honda CBR');
    });
    (0, vitest_1.it)('should list user profiles', async () => {
        prisma_service_1.prisma.motorcycleProfile.findMany.mockResolvedValue([{ id: 'p1', name: 'Sport' }]);
        const response = await (0, supertest_1.default)(index_1.app).get('/api/motorcycle-profiles');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toHaveLength(1);
        (0, vitest_1.expect)(response.body[0].name).toBe('Sport');
    });
    (0, vitest_1.it)('should update a motorcycle', async () => {
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValue({ id: 'm1', userId: 'test-user-id' });
        prisma_service_1.prisma.motorcycle.update.mockResolvedValue({ id: 'm1', name: 'Updated Name' });
        const response = await (0, supertest_1.default)(index_1.app)
            .put('/api/motorcycles/m1')
            .send({ name: 'Updated Name' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.name).toBe('Updated Name');
    });
    (0, vitest_1.it)('should delete a motorcycle', async () => {
        prisma_service_1.prisma.motorcycle.findFirst.mockResolvedValue({ id: 'm1', userId: 'test-user-id' });
        prisma_service_1.prisma.motorcycle.delete.mockResolvedValue({ id: 'm1' });
        const response = await (0, supertest_1.default)(index_1.app).delete('/api/motorcycles/m1');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.success).toBe(true);
    });
});
//# sourceMappingURL=motorcycle.routes.test.js.map