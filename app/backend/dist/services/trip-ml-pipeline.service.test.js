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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const events_1 = require("events");
vitest_1.vi.mock('./prisma.service', () => ({
    prisma: {
        trip: {
            findFirst: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
    },
}));
vitest_1.vi.mock('fs', () => ({
    existsSync: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('child_process', () => ({
    spawn: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../config/env', () => ({
    env: {
        ML_ENABLED: true,
        ML_MODEL_PATH: 'ml/models/isolation_forest.pkl',
    },
}));
const trip_ml_pipeline_service_1 = require("./trip-ml-pipeline.service");
const prisma_service_1 = require("./prisma.service");
const env_1 = require("../config/env");
(0, vitest_1.describe)('TripMlPipelineService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        env_1.env.ML_ENABLED = true;
    });
    (0, vitest_1.it)('should build comparison report correctly', () => {
        const report = (0, trip_ml_pipeline_service_1.buildComparisonReport)(80, 71, ['Speeding']);
        (0, vitest_1.expect)(report.scoreDelta).toBe(-9);
        (0, vitest_1.expect)(report.agreement).toBe(true);
        (0, vitest_1.expect)(report.agreementLevel).toBe('HIGH');
    });
    (0, vitest_1.it)('should return heuristic fallback if ML is disabled', async () => {
        env_1.env.ML_ENABLED = false;
        prisma_service_1.prisma.trip.findFirst.mockResolvedValue({
            id: 't1',
            userId: 'u1',
            maxSpeedKmh: 100,
            maxRollDeg: 20,
            maxGForce: 1.2,
            startedAt: new Date(),
            endedAt: new Date(),
            events: [],
            motorcycle: { profile: { maxSpeedKmh: 120, typicalMaxRollDeg: 30, crashRollThreshold: 60, crashGForce: 2.0 } }
        });
        const result = await (0, trip_ml_pipeline_service_1.runTripMlPipeline)('t1', 'u1');
        (0, vitest_1.expect)(result?.mlScore).toBeNull();
        (0, vitest_1.expect)(result?.mlFeedback).toBe('Modelo ML não disponível');
    });
    (0, vitest_1.it)('should run ML inference if enabled and model exists', async () => {
        fs.existsSync.mockReturnValue(true);
        prisma_service_1.prisma.trip.findFirst.mockResolvedValue({
            id: 't1',
            userId: 'u1',
            maxSpeedKmh: 100,
            maxRollDeg: 20,
            maxGForce: 1.2,
            startedAt: new Date(),
            endedAt: new Date(),
            events: [],
            motorcycle: { profile: { maxSpeedKmh: 120, typicalMaxRollDeg: 30, crashRollThreshold: 60, crashGForce: 2.0 } }
        });
        // Mock spawn
        const mockStdout = new events_1.EventEmitter();
        const mockStderr = new events_1.EventEmitter();
        const mockStdin = { write: vitest_1.vi.fn(), end: vitest_1.vi.fn() };
        const mockProc = new events_1.EventEmitter();
        mockProc.stdout = mockStdout;
        mockProc.stderr = mockStderr;
        mockProc.stdin = mockStdin;
        child_process_1.spawn.mockReturnValue(mockProc);
        const pipelinePromise = (0, trip_ml_pipeline_service_1.runTripMlPipeline)('t1', 'u1');
        // Simular output do Python
        setTimeout(() => {
            mockStdout.emit('data', Buffer.from(JSON.stringify({
                mlScore: 85,
                anomalyScore: 0.1,
                feedbackLabel: 'Boa condução',
                dominantFeatures: [],
                modelVersion: 'v1',
                inferenceMs: 100
            })));
            mockProc.emit('close', 0);
        }, 10);
        const result = await pipelinePromise;
        (0, vitest_1.expect)(result?.mlScore).toBe(85);
    });
});
//# sourceMappingURL=trip-ml-pipeline.service.test.js.map