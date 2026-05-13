import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketService } from './socket.service';
import { Server } from 'socket.io';
import http from 'http';
import { mqttService } from './mqtt.service';
import { prisma } from './prisma.service';

vi.mock('./mqtt.service', () => ({
  mqttService: {
    publishCommand: vi.fn().mockReturnValue(true),
    onTelemetry: vi.fn(),
    connected: true,
  },
}));

vi.mock('./prisma.service', () => ({
  prisma: {
    motorcycle: { findFirst: vi.fn() },
    motorcycleProfile: { findFirst: vi.fn() },
    trip: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    deviceAssociation: { findUnique: vi.fn(), upsert: vi.fn() },
    tripEvent: { create: vi.fn() },
    trip: { 
      findFirst: vi.fn(), 
      update: vi.fn(), 
      create: vi.fn(),
      findUnique: vi.fn()
    },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('./email.service', () => ({
  sendCrashAlert: vi.fn().mockResolvedValue(undefined),
}));

import { sendCrashAlert } from './email.service';

vi.mock('socket.io', () => {
  const io = {
    on: vi.fn(),
    emit: vi.fn(),
  };
  return {
    Server: vi.fn().mockImplementation(function() {
      return io;
    }),
  };
});

describe('SocketService', () => {
  let socketService: SocketService;
  let mockHttpServer: http.Server;

  beforeEach(() => {
    vi.clearAllMocks();
    socketService = new SocketService();
    mockHttpServer = {} as http.Server;
  });

  it('should forward commands to MQTT', () => {
    socketService.init(mockHttpServer);
    const io: any = (Server as any).mock.results[0].value;
    const connectionHandler = io.on.mock.calls.find((call: any) => call[0] === 'connection')[1];
    
    const mockSocket = { 
      emit: vi.fn(), 
      on: vi.fn(),
    };
    
    connectionHandler(mockSocket);
    
    const commandHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'send_command')[1];
    const command = { acao: 'ligar', device_id: 'd1' };
    commandHandler(command);
    
    expect(mqttService.publishCommand).toHaveBeenCalledWith(command);
  });

  it('should handle telemetry update from socket', async () => {
    socketService.init(mockHttpServer);
    const io: any = (Server as any).mock.results[0].value;
    const connectionHandler = io.on.mock.calls.find((call: any) => call[0] === 'connection')[1];
    
    const mockSocket = { 
      emit: vi.fn(), 
      on: vi.fn(),
      broadcast: { emit: vi.fn() }
    };
    
    connectionHandler(mockSocket);
    
    const telemetryHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'telemetry_update')[1];
    const payload = {
      system: { 
        device_id: 'd1', 
        moto_model: 'X', 
        timestamp: new Date().toISOString(),
        event_status: 'NORMAL'
      },
      telemetry: { speed_kmh: 10, engine_temp_c: 90, voltage: 12.5 },
      imu: { roll_deg: 5, g_force: 1.0 },
      location: { latitude: 38.7, longitude: -9.1 },
      health: { oil_pressure_bar: 2.5, tire_pressure_front_bar: 2.2, tire_pressure_rear_bar: 2.5 },
    };
    
    await telemetryHandler(payload);
    
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('telemetry_update', payload);
  });

  it('should forward MQTT telemetry to all clients', async () => {
    socketService.init(mockHttpServer);
    const io: any = (Server as any).mock.results[0].value;
    
    // Pegar o callback registado no mqttService
    const telemetryCallback = mqttService.onTelemetry.mock.calls[0][0];
    
    const payload = {
      system: { 
        device_id: 'd1', 
        moto_model: 'X', 
        timestamp: new Date().toISOString(),
        event_status: 'NORMAL'
      },
      telemetry: { speed_kmh: 10, engine_temp_c: 90, voltage: 12.5 },
      imu: { roll_deg: 5, g_force: 1.0 },
      location: { latitude: 38.7, longitude: -9.1 },
      health: { oil_pressure_bar: 2.5, tire_pressure_front_bar: 2.2, tire_pressure_rear_bar: 2.5 },
    };
    
    await telemetryCallback(payload);
    
    expect(io.emit).toHaveBeenCalledWith('telemetry_update', payload);
  });

  it('should trigger automatic email on CRASH_DETECTED event', async () => {
    vi.useFakeTimers();
    socketService.init(mockHttpServer);
    const io: any = (Server as any).mock.results[0].value;
    
    const telemetryCallback = mqttService.onTelemetry.mock.calls[0][0];
    
    // Mock user with emergency contact
    const mockUser = {
      id: 'u1',
      name: 'John Doe',
      emergencyContact: 'emergency@example.com',
      resendApiKey: 're_mock_key'
    };

    const mockTrip = {
      id: 't1',
      userId: 'u1',
      user: mockUser
    };

    (prisma.trip.findUnique as any).mockResolvedValue(mockTrip);
    (prisma.motorcycleProfile.findFirst as any).mockResolvedValue({
      crashRollThreshold: 60,
      crashPitchThreshold: 60,
      crashGForce: 2.0,
      crashConfirmSec: 0
    });

    // Simulate active trip
    (socketService as any).activeTripIdByDevice.set('d1', 't1');

    const payload = {
      system: { 
        device_id: 'd1', 
        moto_model: 'X', 
        timestamp: new Date().toISOString(),
        event_status: 'CRASH' 
      },
      telemetry: { speed_kmh: 0, engine_temp_c: 90, voltage: 12.5 },
      imu: { roll_deg: 75, g_force: 3.5 }, // Exceeds crash thresholds
      location: { latitude: 38.7, longitude: -9.1 },
      health: { oil_pressure_bar: 0.2, tire_pressure_front_bar: 2.2, tire_pressure_rear_bar: 2.5 },
    };
    
    await telemetryCallback(payload);
    
    // Fast-forward 20 seconds to trigger the SOS email timeout
    vi.advanceTimersByTime(20000);
    // Flush microtasks so the async timeout callback completes past its awaits
    await Promise.resolve();
    
    expect(sendCrashAlert).toHaveBeenCalledWith(expect.objectContaining({
      toEmail: 'emergency@example.com',
      riderName: 'John Doe',
      tripId: 't1'
    }));

    vi.useRealTimers();
  });
});
