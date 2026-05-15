import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('./prisma.service', () => ({
  prisma: {
    trip: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: {
    ML_ENABLED: true,
    ML_MODEL_PATH: 'ml/models/isolation_forest.pkl',
  },
}));

import { runTripMlPipeline, buildComparisonReport } from './trip-ml-pipeline.service';
import { prisma } from './prisma.service';
import { env } from '../config/env';

describe('TripMlPipelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).ML_ENABLED = true;
  });

  it('should build comparison report correctly', () => {
    const report = buildComparisonReport(80, 71, ['Speeding']);
    expect(report.scoreDelta).toBe(-9);
    expect(report.agreement).toBe(true);
    expect(report.agreementLevel).toBe('HIGH');
  });

  it('should return heuristic fallback if ML is disabled', async () => {
    (env as any).ML_ENABLED = false;

    (prisma.trip.findFirst as any).mockResolvedValue({
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

    const result = await runTripMlPipeline('t1', 'u1');
    expect(result?.mlScore).toBeNull();
    expect(result?.mlFeedback).toBe('Modelo ML não disponível');
  });

  it('should run ML inference if enabled and model exists', async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (prisma.trip.findFirst as any).mockResolvedValue({
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
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    const mockStdin = { write: vi.fn(), end: vi.fn() };
    const mockProc = new EventEmitter() as any;
    mockProc.stdout = mockStdout;
    mockProc.stderr = mockStderr;
    mockProc.stdin = mockStdin;
    
    (spawn as any).mockReturnValue(mockProc);

    const pipelinePromise = runTripMlPipeline('t1', 'u1');

    // Simular output do Python
    setTimeout(() => {
      mockStdout.emit('data', Buffer.from(JSON.stringify({
        mlScore: 85,
        anomalyScore: 0.15,
        feedbackLabel: 'Boa condução',
        dominantFeatures: [],
        modelVersion: 'v1',
        inferenceMs: 100
      })));
      mockProc.emit('close', 0);
    }, 10);

    const result = await pipelinePromise;
    expect(result?.mlScore).toBe(85);
  });
});
