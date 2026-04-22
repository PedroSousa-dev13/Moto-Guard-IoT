import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCrashAlert } from './email.service';
import { Resend } from 'resend';

const mockSend = vi.fn().mockResolvedValue({ id: 'mock-id' });

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(function() {
      return {
        emails: {
          send: mockSend,
        },
      };
    }),
  };
});

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send an email if API key is provided', async () => {
    const payload = {
      toEmail: 'emergency@example.com',
      riderName: 'Test Rider',
      timestamp: new Date().toISOString(),
      deviceId: 'D123',
      resendApiKey: 're_123',
    };

    await sendCrashAlert(payload);
    
    expect(Resend).toHaveBeenCalledWith('re_123');
    expect(mockSend).toHaveBeenCalled();
  });

  it('should log warning and not send email if no API key is available', async () => {
    const payload = {
      toEmail: 'emergency@example.com',
      riderName: 'Test Rider',
      timestamp: new Date().toISOString(),
      deviceId: 'D123',
      resendApiKey: null,
    };
    
    // Backup env key
    const { env } = await import('../config/env');
    const oldKey = env.RESEND_API_KEY;
    (env as any).RESEND_API_KEY = '';

    const consoleSpy = vi.spyOn(console, 'warn');
    await sendCrashAlert(payload);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Resend API key não configurada'));
    expect(mockSend).not.toHaveBeenCalled();

    (env as any).RESEND_API_KEY = oldKey;
  });
});
