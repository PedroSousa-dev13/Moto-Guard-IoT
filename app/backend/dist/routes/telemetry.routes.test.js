"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
const influx_service_1 = require("../services/influx.service");
const telemetry_store_1 = require("../services/telemetry.store");
vitest_1.vi.mock('../services/influx.service', () => ({
    influxService: {
        queryTripTelemetry: vitest_1.vi.fn(),
        available: true,
    },
}));
vitest_1.vi.mock('../services/prisma.service', () => ({
    prisma: {
        trip: {
            findUnique: vitest_1.vi.fn(),
            findFirst: vitest_1.vi.fn(),
        },
        motorcycle: {
            findFirst: vitest_1.vi.fn(),
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
(0, vitest_1.describe)('Telemetry Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should get latest telemetry', async () => {
        // Mock do store
        telemetry_store_1.telemetryStore.update({ system: { device_id: 'd1' } });
        const response = await (0, supertest_1.default)(index_1.app).get('/api/telemetry/latest');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.data.system.device_id).toBe('d1');
    });
    (0, vitest_1.it)('should get trip telemetry from influx', async () => {
        influx_service_1.influxService.queryTripTelemetry.mockResolvedValue([{ speed: 50 }]);
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../services/prisma.service')));
        prisma.trip.findFirst.mockResolvedValue({
            id: 't1',
            userId: 'test-user-id',
            startedAt: new Date(),
            source: 'DEVICE_REAL'
        });
        prisma.motorcycle.findFirst.mockResolvedValue({ deviceId: 'd1' });
        const response = await (0, supertest_1.default)(index_1.app).get('/api/telemetry/t1');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.data).toHaveLength(1);
    });
});
//# sourceMappingURL=telemetry.routes.test.js.map