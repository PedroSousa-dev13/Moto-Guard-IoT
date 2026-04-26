"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const socket_service_1 = require("./socket.service");
const socket_io_1 = require("socket.io");
const mqtt_service_1 = require("./mqtt.service");
const prisma_service_1 = require("./prisma.service");
vitest_1.vi.mock('./mqtt.service', () => ({
    mqttService: {
        publishCommand: vitest_1.vi.fn().mockReturnValue(true),
        onTelemetry: vitest_1.vi.fn(),
        connected: true,
    },
}));
vitest_1.vi.mock('./prisma.service', () => ({
    prisma: {
        motorcycle: { findFirst: vitest_1.vi.fn() },
        motorcycleProfile: { findFirst: vitest_1.vi.fn() },
        trip: { findFirst: vitest_1.vi.fn(), update: vitest_1.vi.fn(), create: vitest_1.vi.fn() },
        deviceAssociation: { findUnique: vitest_1.vi.fn(), upsert: vitest_1.vi.fn() },
        tripEvent: { create: vitest_1.vi.fn() },
        trip: {
            findFirst: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn()
        },
        user: { findUnique: vitest_1.vi.fn() },
    },
}));
vitest_1.vi.mock('./email.service', () => ({
    sendCrashAlert: vitest_1.vi.fn().mockResolvedValue(undefined),
}));
const email_service_1 = require("./email.service");
vitest_1.vi.mock('socket.io', () => {
    const io = {
        on: vitest_1.vi.fn(),
        emit: vitest_1.vi.fn(),
    };
    return {
        Server: vitest_1.vi.fn().mockImplementation(function () {
            return io;
        }),
    };
});
(0, vitest_1.describe)('SocketService', () => {
    let socketService;
    let mockHttpServer;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        socketService = new socket_service_1.SocketService();
        mockHttpServer = {};
    });
    (0, vitest_1.it)('should forward commands to MQTT', () => {
        socketService.init(mockHttpServer);
        const io = socket_io_1.Server.mock.results[0].value;
        const connectionHandler = io.on.mock.calls.find((call) => call[0] === 'connection')[1];
        const mockSocket = {
            emit: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
        };
        connectionHandler(mockSocket);
        const commandHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'send_command')[1];
        const command = { acao: 'ligar', device_id: 'd1' };
        commandHandler(command);
        (0, vitest_1.expect)(mqtt_service_1.mqttService.publishCommand).toHaveBeenCalledWith(command);
    });
    (0, vitest_1.it)('should handle telemetry update from socket', async () => {
        socketService.init(mockHttpServer);
        const io = socket_io_1.Server.mock.results[0].value;
        const connectionHandler = io.on.mock.calls.find((call) => call[0] === 'connection')[1];
        const mockSocket = {
            emit: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
            broadcast: { emit: vitest_1.vi.fn() }
        };
        connectionHandler(mockSocket);
        const telemetryHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'telemetry_update')[1];
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
        (0, vitest_1.expect)(mockSocket.broadcast.emit).toHaveBeenCalledWith('telemetry_update', payload);
    });
    (0, vitest_1.it)('should forward MQTT telemetry to all clients', async () => {
        socketService.init(mockHttpServer);
        const io = socket_io_1.Server.mock.results[0].value;
        // Pegar o callback registado no mqttService
        const telemetryCallback = mqtt_service_1.mqttService.onTelemetry.mock.calls[0][0];
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
        (0, vitest_1.expect)(io.emit).toHaveBeenCalledWith('telemetry_update', payload);
    });
    (0, vitest_1.it)('should trigger automatic email on CRASH_DETECTED event', async () => {
        socketService.init(mockHttpServer);
        const io = socket_io_1.Server.mock.results[0].value;
        const telemetryCallback = mqtt_service_1.mqttService.onTelemetry.mock.calls[0][0];
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
        prisma_service_1.prisma.trip.findUnique.mockResolvedValue(mockTrip);
        prisma_service_1.prisma.motorcycleProfile.findFirst.mockResolvedValue({
            crashRollThreshold: 60,
            crashPitchThreshold: 60,
            crashGForce: 2.0,
            crashConfirmSec: 0
        });
        // Simulate active trip
        socketService.activeTripIdByDevice.set('d1', 't1');
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
        // Wait for the async "fire and forget" email trigger
        await new Promise(resolve => setTimeout(resolve, 50));
        (0, vitest_1.expect)(email_service_1.sendCrashAlert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            toEmail: 'emergency@example.com',
            riderName: 'John Doe',
            tripId: 't1'
        }));
    });
});
//# sourceMappingURL=socket.service.test.js.map