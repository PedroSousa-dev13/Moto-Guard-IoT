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
const email_service_1 = require("./email.service");
const resend_1 = require("resend");
const mockSend = vitest_1.vi.fn().mockResolvedValue({ id: 'mock-id' });
vitest_1.vi.mock('resend', () => {
    return {
        Resend: vitest_1.vi.fn().mockImplementation(function () {
            return {
                emails: {
                    send: mockSend,
                },
            };
        }),
    };
});
(0, vitest_1.describe)('EmailService', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should send an email if API key is provided', async () => {
        const payload = {
            toEmail: 'emergency@example.com',
            riderName: 'Test Rider',
            timestamp: new Date().toISOString(),
            deviceId: 'D123',
            resendApiKey: 're_123',
        };
        await (0, email_service_1.sendCrashAlert)(payload);
        (0, vitest_1.expect)(resend_1.Resend).toHaveBeenCalledWith('re_123');
        (0, vitest_1.expect)(mockSend).toHaveBeenCalled();
    });
    (0, vitest_1.it)('should log warning and not send email if no API key is available', async () => {
        const payload = {
            toEmail: 'emergency@example.com',
            riderName: 'Test Rider',
            timestamp: new Date().toISOString(),
            deviceId: 'D123',
            resendApiKey: null,
        };
        // Backup env key
        const { env } = await Promise.resolve().then(() => __importStar(require('../config/env')));
        const oldKey = env.RESEND_API_KEY;
        env.RESEND_API_KEY = '';
        const consoleSpy = vitest_1.vi.spyOn(console, 'warn');
        await (0, email_service_1.sendCrashAlert)(payload);
        (0, vitest_1.expect)(consoleSpy).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Resend API key não configurada'));
        (0, vitest_1.expect)(mockSend).not.toHaveBeenCalled();
        env.RESEND_API_KEY = oldKey;
    });
});
//# sourceMappingURL=email.service.test.js.map