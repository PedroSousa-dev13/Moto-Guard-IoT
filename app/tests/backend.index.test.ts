import { describe, it, expect } from 'vitest';

describe('Backend Index', () => {
  it('deve existir e ser importável', async () => {
    expect(async () => {
      await import('../backend/src/index');
    }).not.toThrow();
  });
});