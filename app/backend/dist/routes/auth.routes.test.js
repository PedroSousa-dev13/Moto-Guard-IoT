"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock do middleware de autenticação para injetar userId
vitest_1.vi.mock('../middleware/auth.middleware', () => ({
    authMiddleware: (req, res, next) => {
        req.userId = 'test-user-id';
        next();
    },
}));
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
const prisma_service_1 = require("../services/prisma.service");
// Mock do prisma
vitest_1.vi.mock('../services/prisma.service', () => ({
    prisma: {
        user: {
            findUnique: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
        $connect: vitest_1.vi.fn().mockResolvedValue(undefined),
        $disconnect: vitest_1.vi.fn().mockResolvedValue(undefined),
    },
}));
(0, vitest_1.describe)('Auth Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        process.env.NODE_ENV = 'test';
    });
    (0, vitest_1.it)('should return 400 if login fields are missing', async () => {
        const response = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/login')
            .send({});
        (0, vitest_1.expect)(response.status).toBe(400);
        (0, vitest_1.expect)(response.body).toHaveProperty('error');
    });
    (0, vitest_1.it)('should return 401 for invalid credentials', async () => {
        prisma_service_1.prisma.user.findUnique.mockResolvedValue(null);
        const response = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/login')
            .send({ email: 'wrong@example.com', password: 'password123' });
        (0, vitest_1.expect)(response.status).toBe(401);
    });
    (0, vitest_1.it)('should get current user profile', async () => {
        prisma_service_1.prisma.user.findUnique.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' });
        const response = await (0, supertest_1.default)(index_1.app)
            .get('/api/auth/me');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.email).toBe('test@example.com');
    });
    (0, vitest_1.it)('should update profile', async () => {
        prisma_service_1.prisma.user.update.mockResolvedValue({ id: 'test-user-id', name: 'New Name' });
        const response = await (0, supertest_1.default)(index_1.app)
            .put('/api/auth/profile')
            .send({ name: 'New Name' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.name).toBe('New Name');
    });
});
//# sourceMappingURL=auth.routes.test.js.map