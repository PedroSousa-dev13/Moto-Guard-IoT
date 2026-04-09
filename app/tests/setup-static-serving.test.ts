import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Application } from 'express';
import { setupStaticServing } from '../backend/src/utils/setup-static-serving';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('setupStaticServing', () => {
  let mockApp: Application;
  let mockResponse: any;
  let consoleLogSpy: any;
  let pathJoinSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    pathJoinSpy = vi.spyOn(path, 'join').mockImplementation((...args: string[]) => args.join('/'));
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockResponse = {
      sendFile: vi.fn()
    };

    mockApp = {
      use: vi.fn(),
      get: vi.fn()
    } as any;

    (fs.existsSync as any).mockReturnValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    pathJoinSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should return false when dist path does not exist', () => {
    (fs.existsSync as any).mockReturnValue(false);

    const result = setupStaticServing(mockApp, '/path/to/dist');

    expect(result).toBe(false);
    expect(mockApp.use).not.toHaveBeenCalled();
    expect(mockApp.get).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Frontend estático não encontrado — modo dev (Vite separado).');
  });

  it('should return true when dist path exists', () => {
    const result = setupStaticServing(mockApp, '/path/to/dist');

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/dist');
  });

  it('should setup static middleware when dist exists', () => {
    setupStaticServing(mockApp, '/path/to/dist');

    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    expect(mockApp.use).toHaveBeenCalledTimes(1);
  });

  it('should setup SPA fallback route', () => {
    setupStaticServing(mockApp, '/path/to/dist');

    expect(mockApp.get).toHaveBeenCalledWith(/^(?!\/api).*$/, expect.any(Function));
  });

  it('should send index.html for SPA fallback', () => {
    setupStaticServing(mockApp, '/path/to/dist');

    const calls = (mockApp.get as any).mock.calls as any[];
    const fallbackCall = calls.find(c => c[0] instanceof RegExp);
    expect(fallbackCall).toBeDefined();

    const fallbackHandler = fallbackCall[1];
    const mockRequest = {};
    fallbackHandler(mockRequest, mockResponse);

    expect(pathJoinSpy).toHaveBeenCalledWith('/path/to/dist', 'index.html');
    expect(mockResponse.sendFile).toHaveBeenCalledWith('path/to/dist/index.html');
  });

  it('should log static serving setup', () => {
    setupStaticServing(mockApp, '/path/to/dist');

    expect(consoleLogSpy).toHaveBeenCalledWith('Frontend estático: /path/to/dist');
  });

  it('should handle different dist path formats', () => {
    const testPaths = [
      '/absolute/path/to/dist',
      './relative/path/to/dist',
      '../parent/path/to/dist',
      'C:\Windows\path\to\dist'
    ];

    testPaths.forEach(distPath => {
      vi.clearAllMocks();
      (pathJoinSpy as any).mockClear();
      (fs.existsSync as any).mockReturnValue(true);

      setupStaticServing(mockApp, distPath);

      expect(fs.existsSync).toHaveBeenCalledWith(distPath);
    });
  });
});
