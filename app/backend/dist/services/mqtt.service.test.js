"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mqtt_service_1 = require("./mqtt.service");
const mqtt_1 = __importDefault(require("mqtt"));
// Mock do mqtt.connect
vitest_1.vi.mock('mqtt', () => {
    const client = {
        on: vitest_1.vi.fn(),
        subscribe: vitest_1.vi.fn(),
        publish: vitest_1.vi.fn(),
    };
    return {
        default: {
            connect: vitest_1.vi.fn().mockReturnValue(client),
        },
        connect: vitest_1.vi.fn().mockReturnValue(client),
    };
});
(0, vitest_1.describe)('MqttService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should be disconnected by default', () => {
        (0, vitest_1.expect)(mqtt_service_1.mqttService.connected).toBe(false);
    });
    (0, vitest_1.it)('should call mqtt.connect when connect() is called', () => {
        mqtt_service_1.mqttService.connect();
        (0, vitest_1.expect)(mqtt_1.default.connect).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should publish commands when connected', () => {
        mqtt_service_1.mqttService.connect();
        const mockClient = mqtt_1.default.connect.mock.results[0].value;
        const connectHandler = mockClient.on.mock.calls.find((call) => call[0] === 'connect')[1];
        connectHandler(); // Simula conexão
        (0, vitest_1.expect)(mqtt_service_1.mqttService.connected).toBe(true);
        const command = { acao: 'test' };
        const result = mqtt_service_1.mqttService.publishCommand(command);
        (0, vitest_1.expect)(result).toBe(true);
        (0, vitest_1.expect)(mockClient.publish).toHaveBeenCalled();
    });
});
//# sourceMappingURL=mqtt.service.test.js.map