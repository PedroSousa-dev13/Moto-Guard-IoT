import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileUploadComponent from '../FileUploadComponent';

describe('FileUploadComponent', () => {
  const defaultProps = {
    onFileSelect: vi.fn(),
    onError: vi.fn(),
    isUploading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area with correct text', () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    expect(screen.getByText('Arrasta um ficheiro GPX ou clica para selecionar')).toBeInTheDocument();
    expect(screen.getByText('Máximo 10MB • Apenas ficheiros .gpx')).toBeInTheDocument();
  });

  it('shows loading state when uploading', () => {
    render(<FileUploadComponent {...defaultProps} isUploading={true} />);
    
    expect(screen.getByText('A carregar ficheiro...')).toBeInTheDocument();
  });

  it('shows progress bar when uploading with progress', () => {
    render(<FileUploadComponent {...defaultProps} isUploading={true} progress={50} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
    const progressBar = document.querySelector('.gpx-progress-fill');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('validates file extension correctly', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
    });
  });

  it('validates file size correctly', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'test.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('O ficheiro é demasiado grande. Máximo permitido: 10MB');
    });
  });

  it('accepts valid GPX file', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(validFile);
    });
  });

  it('handles drag and drop correctly', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const dropArea = document.querySelector('.gpx-upload-area') as HTMLElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    // Test drag over
    fireEvent.dragOver(dropArea);
    expect(dropArea).toHaveClass('drag-over');
    
    // Test drag leave
    fireEvent.dragLeave(dropArea);
    expect(dropArea).not.toHaveClass('drag-over');
    
    // Test drop
    fireEvent.drop(dropArea, {
      dataTransfer: {
        files: [validFile],
      },
    });
    
    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(validFile);
    });
  });

  it('shows selected file information', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('test.gpx')).toBeInTheDocument();
      expect(screen.getByText(/KB/)).toBeInTheDocument();
    });
  });

  it('allows clearing selected file', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('test.gpx')).toBeInTheDocument();
    });
    
    const clearButton = screen.getByTitle('Remover ficheiro');
    fireEvent.click(clearButton);
    
    expect(screen.queryByText('test.gpx')).not.toBeInTheDocument();
  });

  it('disables interaction when disabled prop is true', () => {
    render(<FileUploadComponent {...defaultProps} disabled={true} />);
    
    const dropArea = document.querySelector('.gpx-upload-area') as HTMLElement;
    expect(dropArea).toHaveClass('disabled');
    
    // Should not respond to drag over when disabled
    fireEvent.dragOver(dropArea);
    expect(dropArea).not.toHaveClass('drag-over');
  });

  it('supports keyboard navigation', () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const dropArea = document.querySelector('.gpx-upload-area') as HTMLElement;
    
    // Should be focusable
    expect(dropArea).toHaveAttribute('tabIndex', '0');
    expect(dropArea).toHaveAttribute('role', 'button');
    
    // Should trigger file selection on Enter key
    fireEvent.keyDown(dropArea, { key: 'Enter' });
    // Note: We can't easily test the file input click in jsdom, but the event handler is there
    
    // Should trigger file selection on Space key
    fireEvent.keyDown(dropArea, { key: ' ' });
    // Note: We can't easily test the file input click in jsdom, but the event handler is there
  });

  it('has proper accessibility attributes', () => {
    render(<FileUploadComponent {...defaultProps} isUploading={true} progress={75} />);
    
    const dropArea = document.querySelector('.gpx-upload-area') as HTMLElement;
    expect(dropArea).toHaveAttribute('aria-label', 'Selecionar ficheiro GPX para upload');
    
    const progressBar = document.querySelector('.gpx-progress-bar') as HTMLElement;
    expect(progressBar).toHaveAttribute('role', 'progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Progresso do upload do ficheiro GPX');
  });

  it('validates empty file', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const emptyFile = new File([], 'empty.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [emptyFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('O ficheiro selecionado está vazio');
      expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
    });
  });

  it('validates file extension case-insensitively', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const upperCaseFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.GPX', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [upperCaseFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(upperCaseFile);
      expect(defaultProps.onError).not.toHaveBeenCalled();
    });
  });

  it('rejects files with .gpx in the middle of the name but wrong extension', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['content'], 'my.gpx.backup.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('Por favor seleciona um ficheiro .gpx');
      expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
    });
  });

  it('validates file at exactly 10MB boundary', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const exactSizeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'exact.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [exactSizeFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onFileSelect).toHaveBeenCalledWith(exactSizeFile);
      expect(defaultProps.onError).not.toHaveBeenCalled();
    });
  });

  it('rejects file just over 10MB', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const overSizeFile = new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'over.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [overSizeFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('O ficheiro é demasiado grande. Máximo permitido: 10MB');
      expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
    });
  });

  it('prevents drag and drop when uploading', () => {
    render(<FileUploadComponent {...defaultProps} isUploading={true} />);
    
    const dropArea = document.querySelector('.gpx-upload-area') as HTMLElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    // Should not set drag over state when uploading
    fireEvent.dragOver(dropArea);
    expect(dropArea).not.toHaveClass('drag-over');
    
    // Should not process drop when uploading
    fireEvent.drop(dropArea, {
      dataTransfer: {
        files: [validFile],
      },
    });
    
    expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
  });

  it('clears file input value when clearing file', async () => {
    render(<FileUploadComponent {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['<?xml version="1.0"?><gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    // Mock the value property to be writable for testing
    Object.defineProperty(fileInput, 'value', {
      value: 'test.gpx',
      writable: true,
      configurable: true,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('test.gpx')).toBeInTheDocument();
    });
    
    const clearButton = screen.getByTitle('Remover ficheiro');
    fireEvent.click(clearButton);
    
    expect(fileInput.value).toBe('');
  });
});