import { describe, it, expect } from 'vitest';

describe('Socket Service', () => {
  it('deve existir e ser importável', async () => {
    const socketService = await import('../backend/src/services/socket.service');
    expect(socketService.socketService).toBeDefined();
  });
});