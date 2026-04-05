import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GpxUploadTab from '../GpxUploadTab';

describe('GpxUploadTab', () => {
  const defaultProps = {
    isActive: true,
    gpxRoute: null,
    gpxUploading: false,
    gpxError: null,
    gpxProcessing: false,
    gpxSending: false,
    gpxSent: false,
    onFileSelect: vi.fn(),
    onClearRoute: vi.fn(),
    onSendToSimulator: vi.fn(),
    onError: vi.fn(),
  };

  it('renders when active', () => {
    render(<GpxUploadTab {...defaultProps} />);
    
    expect(screen.getByText('GPX Upload')).toBeInTheDocument();
    expect(screen.getByText(/Carrega um ficheiro GPX/)).toBeInTheDocument();
  });

  it('does not render when inactive', () => {
    render(<GpxUploadTab {...defaultProps} isActive={false} />);
    
    expect(screen.queryByText('GPX Upload')).not.toBeInTheDocument();
  });

  it('displays error message when present', () => {
    const errorMessage = 'Test error message';
    render(<GpxUploadTab {...defaultProps} gpxError={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('shows route preview when gpxRoute is provided', () => {
    const mockRoute = {
      waypoints: [
        { latitude: 41.1579, longitude: -8.6291 },
        { latitude: 41.1833, longitude: -8.6980 }
      ],
      distanceKm: 5.2,
      totalTimeSec: 300
    };

    render(<GpxUploadTab {...defaultProps} gpxRoute={mockRoute} />);
    
    expect(screen.getByText('Rota GPX Carregada')).toBeInTheDocument();
    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // waypoints count
  });
});