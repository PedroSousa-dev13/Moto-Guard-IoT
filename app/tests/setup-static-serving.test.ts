import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Application } from 'express';
import { setupStaticServing } from '../backend/src/utils/setup-static-serving';

vi.mock('fs');
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/'))
  };
});
vi.mock('express', async (importOriginal) => {
  const actual = await importOriginal<typeof import('express')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      static: vi.fn(() => 'static-middleware')
    }
  };
});

describe('setupStaticServing', () => {
  let mockApp: Application;
  let mockResponse: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
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
    vi.restoreAllMocks();
  });

  it('should return false when dist path does not exist', () => {
    (fs.existsSync as any).mockReturnValue(false);
    
    const result = setupStaticServing(mockApp, '/path/to/dist');
    
    expect(result).toBe(false);
    expect(mockApp.use).not.toHaveBeenCalled();
    expect(mockApp.get).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Frontend estático não encontrado — modo dev (Vite separado).');
  });

  it('should return true when dist path exists', () => {
    const result = setupStaticServing(mockApp, '/path/to/dist');
    
    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/dist');
  });

  it('should setup static middleware when dist exists', () => {
    setupStaticServing(mockApp, '/path/to/dist');
    
    expect(mockApp.use).toHaveBeenCalledWith('static-middleware');
    expect(express.default.static).toHaveBeenCalledWith('/path/to/dist');
  });

  it('should setup SPA fallback route', () => {
    setupStaticServing(mockApp, '/path/to/dist');
    
    expect(mockApp.get).toHaveBeenCalledWith('*', expect.any(Function));
  });

  it('should send index.html for SPA fallback', () => {
    setupStaticServing(mockApp, '/path/to/dist');
    
    // Get the fallback route handler
    const fallbackHandler = (mockApp.get as any).mock.calls.find(
      call => call[0] === '*'
    )?.[1];
    
    expect(fallbackHandler).toBeDefined();
    
    // Call the handler
    const mockRequest = {};
    fallbackHandler(mockRequest, mockResponse);
    
    expect(path.join).toHaveBeenCalledWith('/path/to/dist', 'index.html');
    expect(mockResponse.sendFile).toHaveBeenCalledWith('/path/to/dist/index.html');
  });

  it('should log static serving setup', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    setupStaticServing(mockApp, '/path/to/dist');
    
    expect(consoleLogSpy).toHaveBeenCalledWith('Frontend estático: /path/to/dist');
    
    consoleLogSpy.mockRestore();
  });

  it('should handle different dist path formats', () => {
    const testPaths = [
      '/absolute/path/to/dist',
      './relative/path/to/dist',
      '../parent/path/to/dist',
      'C:\\Windows\\path\\to\\dist'
    ];
    
    testPaths.forEach(distPath => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(true);
      
      setupStaticServing(mockApp, distPath);
      
      expect(fs.existsSync).toHaveBeenCalledWith(distPath);
      expect(express.default.static).toHaveBeenCalledWith(distPath);
    });
  });
});