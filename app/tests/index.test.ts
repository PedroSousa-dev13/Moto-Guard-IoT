import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cors from 'cors';
import * as http from 'http';
import path from 'path';
import { setupStaticServing } from '../backend/src/utils/setup-static-serving';
import { env } from '../backend/src/config/env';
import apiRoutes from '../backend/src/routes';
import { mqttService } from '../backend/src/services/mqtt.service';
import { socketService } from '../backend/src/services/socket.service';
import { prisma } from '../backend/src/services/prisma.service';

vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    listen: vi.fn()
  };
  const expressMock: any = vi.fn(() => mockApp);
  expressMock.json = vi.fn(() => 'json-middleware');
  return {
    default: expressMock
  };
});

vi.mock('cors', () => ({
  default: vi.fn(() => 'cors-middleware')
}));

vi.mock('http', () => {
  const createServer = vi.fn(() => ({
    listen: vi.fn()
  }));
  return { default: { createServer }, createServer };
});

vi.mock('path', () => {
  const join = vi.fn((...args) => args.join('/'));
  return { default: { join }, join };
});

vi.mock('../backend/src/utils/setup-static-serving', () => ({
  setupStaticServing: vi.fn()
}));

vi.mock('../backend/src/config/env', () => ({
  env: {
    PORT: 3000,
    MQTT_BROKER_URL: 'mqtt://test-broker:1883'
  }
}));

vi.mock('../backend/src/routes', () => ({
  default: 'api-routes'
}));

vi.mock('../backend/src/services/mqtt.service', () => ({
  mqttService: {
    connect: vi.fn()
  }
}));

vi.mock('../backend/src/services/socket.service', () => ({
  socketService: {
    init: vi.fn()
  }
}));

vi.mock('../backend/src/services/prisma.service', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../backend/src/services/influx.service', () => ({
  influxService: {
    queryTripTelemetry: vi.fn(),
    ensureBucket: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('src/index.ts', () => {
  let mockApp: any;
  let mockServer: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    mockApp = {
      use: vi.fn(),
      listen: vi.fn()
    };
    
    mockServer = {
      listen: vi.fn((port, callback) => {
        if (callback) callback();
      })
    };
    
    (express as any).mockReturnValue(mockApp);
    (http.createServer as any).mockReturnValue(mockServer);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear process event handlers
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should setup global error handlers', async () => {
    await import('../backend/src/index');
    
    const uncaughtExceptionListeners = process.listeners('uncaughtException');
    const unhandledRejectionListeners = process.listeners('unhandledRejection');
    
    expect(uncaughtExceptionListeners).toHaveLength(1);
    expect(unhandledRejectionListeners).toHaveLength(1);
  });

  it('should create Express app with correct middleware', async () => {
    await import('../backend/src/index');
    
    expect(express).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalledWith('cors-middleware');
    expect(express.json).toHaveBeenCalledWith({ limit: "10mb" });
    expect(mockApp.use).toHaveBeenCalledWith('json-middleware');
    expect(mockApp.use).toHaveBeenCalledWith('/api', 'api-routes');
  });

  it('should setup static serving for frontend', async () => {
    await import('../backend/src/index');
    
    expect(path.join).toHaveBeenCalledWith(
      expect.stringContaining('backend'),
      '..',
      '..',
      'frontend',
      'dist'
    );
    expect(setupStaticServing).toHaveBeenCalledWith(mockApp, expect.any(String));
  });

  it('should initialize MQTT and Socket services', async () => {
    await import('../backend/src/index');
    
    expect(mqttService.connect).toHaveBeenCalled();
    expect(socketService.init).toHaveBeenCalledWith(mockServer);
  });

  it('should connect to PostgreSQL on startup', async () => {
    await import('../backend/src/index');
    
    // Wait for async start function
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(prisma.$connect).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('PostgreSQL conectado');
  });

  it('should handle PostgreSQL connection errors', async () => {
    (prisma.$connect as any).mockRejectedValue(new Error('Connection failed'));
    
    await import('../backend/src/index');
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Falha ao conectar ao PostgreSQL:',
      expect.any(Error)
    );
  });

  it('should start server on correct port', async () => {
    await import('../backend/src/index');
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(consoleLogSpy).toHaveBeenCalledWith('MotoGuard Backend a correr na porta 3000');
    expect(consoleLogSpy).toHaveBeenCalledWith('Dashboard:    http://localhost:3000');
    expect(consoleLogSpy).toHaveBeenCalledWith('Health check: http://localhost:3000/api/health');
    expect(consoleLogSpy).toHaveBeenCalledWith('Telemetria:   http://localhost:3000/api/telemetry/latest');
    expect(consoleLogSpy).toHaveBeenCalledWith('MQTT Broker:  mqtt://test-broker:1883');
  });

  it('should handle SIGINT gracefully', async () => {
    await import('../backend/src/index');
    
    const sigintListeners = process.listeners('SIGINT');
    expect(sigintListeners).toHaveLength(1);
    
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    // Trigger SIGINT
    try {
      process.emit('SIGINT', 'SIGINT');
    } catch (e) {
      // Expected
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
    
    exitSpy.mockRestore();
  });

  it('should handle SIGTERM gracefully', async () => {
    await import('../backend/src/index');
    
    const sigtermListeners = process.listeners('SIGTERM');
    expect(sigtermListeners).toHaveLength(1);
    
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    // Trigger SIGTERM
    try {
      process.emit('SIGTERM', 'SIGTERM');
    } catch (e) {
      // Expected
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
    
    exitSpy.mockRestore();
  });

  it('should handle uncaught exceptions', async () => {
    await import('../backend/src/index');
    
    const error = new Error('Uncaught exception');
    const listeners = process.listeners('uncaughtException');
    
    // Trigger uncaught exception
    listeners[0](error);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[uncaughtException] Erro não capturado:',
      error
    );
  });

  it('should handle unhandled promise rejections', async () => {
    await import('../backend/src/index');
    
    const reason = 'Unhandled rejection reason';
    const listeners = process.listeners('unhandledRejection');
    
    // Trigger unhandled rejection
    listeners[0](reason);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[unhandledRejection] Promise rejeitada sem handler:',
      reason
    );
  });
});
