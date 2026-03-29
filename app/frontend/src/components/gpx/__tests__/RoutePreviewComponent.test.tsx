import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoutePreviewComponent from '../RoutePreviewComponent';

describe('RoutePreviewComponent', () => {
  const mockWaypoints = [
    { latitude: 41.2951, longitude: -7.7463, elevation: 450 },
    { latitude: 41.3045, longitude: -7.7388, elevation: 480 },
    { latitude: 41.3180, longitude: -7.7050, elevation: 520 }
  ];

  const mockRoute = {
    waypoints: mockWaypoints,
    distanceKm: 5.2,
    totalTimeSec: 600,
    avgSpeedKmh: 31.2,
    maxSpeedKmh: 45.8,
    startedAt: new Date('2024-01-15T10:00:00Z'),
    endedAt: new Date('2024-01-15T10:10:00Z'),
    bounds: {
      north: 41.3180,
      south: 41.2951,
      east: -7.7050,
      west: -7.7463
    }
  };

  it('should render route statistics correctly', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Rota GPX Carregada')).toBeInTheDocument();
    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByText('10m')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('31.2 km/h')).toBeInTheDocument();
  });

  it('should display start and end coordinates', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Fim')).toBeInTheDocument();
    expect(screen.getByText(/41\.295100, -7\.746300/)).toBeInTheDocument();
    expect(screen.getByText(/41\.318000, -7\.705000/)).toBeInTheDocument();
  });

  it('should display elevation data when available', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Altitude: 450m')).toBeInTheDocument();
    expect(screen.getByText('Altitude: 520m')).toBeInTheDocument();
  });

  it('should display timing information when available', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Início:')).toBeInTheDocument();
    expect(screen.getByText('Fim:')).toBeInTheDocument();
  });

  it('should handle routes without timing data', () => {
    const routeWithoutTiming = {
      ...mockRoute,
      totalTimeSec: undefined,
      avgSpeedKmh: undefined,
      maxSpeedKmh: undefined,
      startedAt: undefined,
      endedAt: undefined
    };

    render(<RoutePreviewComponent route={routeWithoutTiming} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('Início:')).not.toBeInTheDocument();
    expect(screen.queryByText('Velocidade Média')).not.toBeInTheDocument();
  });

  it('should handle routes without elevation data', () => {
    const routeWithoutElevation = {
      ...mockRoute,
      waypoints: [
        { latitude: 41.2951, longitude: -7.7463 },
        { latitude: 41.3180, longitude: -7.7050 }
      ]
    };

    render(<RoutePreviewComponent route={routeWithoutElevation} />);

    expect(screen.queryByText(/Altitude:/)).not.toBeInTheDocument();
  });

  it('should format duration correctly for hours and minutes', () => {
    const routeWithLongDuration = {
      ...mockRoute,
      totalTimeSec: 7320 // 2 hours 2 minutes
    };

    render(<RoutePreviewComponent route={routeWithLongDuration} />);

    expect(screen.getByText('2h 2m')).toBeInTheDocument();
  });

  it('should format duration correctly for minutes only', () => {
    const routeWithShortDuration = {
      ...mockRoute,
      totalTimeSec: 300 // 5 minutes
    };

    render(<RoutePreviewComponent route={routeWithShortDuration} />);

    expect(screen.getByText('5m')).toBeInTheDocument();
  });

  it('should call onMapRender with waypoints when provided', () => {
    const onMapRender = vi.fn();

    render(<RoutePreviewComponent route={mockRoute} onMapRender={onMapRender} />);

    expect(onMapRender).toHaveBeenCalledWith(mockWaypoints);
  });

  it('should not call onMapRender when not provided', () => {
    expect(() => {
      render(<RoutePreviewComponent route={mockRoute} />);
    }).not.toThrow();
  });

  it('should display correct number of waypoints', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Pontos')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should format coordinates to 6 decimal places', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    // Check that coordinates are formatted with 6 decimal places
    const coordText = screen.getByText(/41\.295100, -7\.746300/);
    expect(coordText).toBeInTheDocument();
  });

  it('should display all required statistics labels', () => {
    render(<RoutePreviewComponent route={mockRoute} />);

    expect(screen.getByText('Distância')).toBeInTheDocument();
    expect(screen.getByText('Duração')).toBeInTheDocument();
    expect(screen.getByText('Pontos')).toBeInTheDocument();
    expect(screen.getByText('Velocidade Média')).toBeInTheDocument();
  });

  it('should handle minimal route with only required fields', () => {
    const minimalRoute = {
      waypoints: [
        { latitude: 41.0, longitude: -8.0 },
        { latitude: 42.0, longitude: -9.0 }
      ],
      distanceKm: 100.5
    };

    render(<RoutePreviewComponent route={minimalRoute} />);

    expect(screen.getByText('100.5 km')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should render start and end point indicators', () => {
    const { container } = render(<RoutePreviewComponent route={mockRoute} />);

    const greenDots = container.querySelectorAll('.green-dot');
    const redDots = container.querySelectorAll('.red-dot');

    expect(greenDots.length).toBeGreaterThan(0);
    expect(redDots.length).toBeGreaterThan(0);
  });
});
