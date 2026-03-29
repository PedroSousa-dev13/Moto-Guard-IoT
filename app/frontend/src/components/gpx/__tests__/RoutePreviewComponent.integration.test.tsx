import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoutePreviewComponent from '../RoutePreviewComponent';

describe('RoutePreviewComponent - Integration Tests', () => {
  describe('Map Integration', () => {
    it('should trigger map rendering when route is provided', () => {
      const mockOnMapRender = vi.fn();
      const mockRoute = {
        waypoints: [
          { latitude: 41.2951, longitude: -7.7463, elevation: 450 },
          { latitude: 41.3045, longitude: -7.7388, elevation: 480 },
          { latitude: 41.3180, longitude: -7.7050, elevation: 520 }
        ],
        distanceKm: 5.2,
        totalTimeSec: 600,
        avgSpeedKmh: 31.2
      };

      render(
        <RoutePreviewComponent 
          route={mockRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      expect(mockOnMapRender).toHaveBeenCalledTimes(1);
      expect(mockOnMapRender).toHaveBeenCalledWith(mockRoute.waypoints);
    });

    it('should re-render map when waypoints change', () => {
      const mockOnMapRender = vi.fn();
      const initialRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      const { rerender } = render(
        <RoutePreviewComponent 
          route={initialRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      expect(mockOnMapRender).toHaveBeenCalledTimes(1);

      const updatedRoute = {
        waypoints: [
          { latitude: 43.0, longitude: -10.0 },
          { latitude: 44.0, longitude: -11.0 }
        ],
        distanceKm: 150
      };

      rerender(
        <RoutePreviewComponent 
          route={updatedRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      expect(mockOnMapRender).toHaveBeenCalledTimes(2);
      expect(mockOnMapRender).toHaveBeenLastCalledWith(updatedRoute.waypoints);
    });

    it('should not re-render map when non-waypoint properties change', () => {
      const mockOnMapRender = vi.fn();
      const initialRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      const { rerender } = render(
        <RoutePreviewComponent 
          route={initialRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      expect(mockOnMapRender).toHaveBeenCalledTimes(1);

      // Change only distance, not waypoints
      const updatedRoute = {
        ...initialRoute,
        distanceKm: 150
      };

      rerender(
        <RoutePreviewComponent 
          route={updatedRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      // Should still be called only once since waypoints didn't change
      expect(mockOnMapRender).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy Requirement 2.4: Display route statistics', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100.5,
        totalTimeSec: 3600,
        avgSpeedKmh: 100.5,
        maxSpeedKmh: 120.0
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      // Verify all required statistics are displayed
      expect(screen.getByText('Distância')).toBeInTheDocument();
      expect(screen.getByText('100.5 km')).toBeInTheDocument();
      expect(screen.getByText('Duração')).toBeInTheDocument();
      expect(screen.getByText('1h 0m')).toBeInTheDocument();
      expect(screen.getByText('Pontos')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Velocidade Média')).toBeInTheDocument();
      expect(screen.getByText('100.5 km/h')).toBeInTheDocument();
    });

    it('should satisfy Requirement 2.5: Show start and end coordinates', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.295100, longitude: -7.746300 },
          { latitude: 41.318000, longitude: -7.705000 }
        ],
        distanceKm: 5.2
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      // Verify start coordinates
      expect(screen.getByText('Início')).toBeInTheDocument();
      expect(screen.getByText(/41\.295100, -7\.746300/)).toBeInTheDocument();

      // Verify end coordinates
      expect(screen.getByText('Fim')).toBeInTheDocument();
      expect(screen.getByText(/41\.318000, -7\.705000/)).toBeInTheDocument();
    });

    it('should integrate with existing map rendering system', () => {
      const mockOnMapRender = vi.fn();
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(
        <RoutePreviewComponent 
          route={mockRoute} 
          onMapRender={mockOnMapRender}
        />
      );

      // Verify integration with map rendering system
      expect(mockOnMapRender).toHaveBeenCalled();
      expect(mockOnMapRender).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ latitude: 41.0, longitude: -8.0 }),
          expect.objectContaining({ latitude: 42.0, longitude: -9.0 })
        ])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle route with many waypoints', () => {
      const waypoints = Array.from({ length: 1000 }, (_, i) => ({
        latitude: 41.0 + i * 0.001,
        longitude: -8.0 + i * 0.001
      }));

      const mockRoute = {
        waypoints,
        distanceKm: 150.5
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('150.5 km')).toBeInTheDocument();
    });

    it('should handle route with exactly 2 waypoints (minimum)', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should handle very long duration', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 500,
        totalTimeSec: 36000 // 10 hours
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('10h 0m')).toBeInTheDocument();
    });

    it('should handle very short duration', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 1,
        totalTimeSec: 60 // 1 minute
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('1m')).toBeInTheDocument();
    });

    it('should handle extreme coordinate values', () => {
      const mockRoute = {
        waypoints: [
          { latitude: -90.0, longitude: -180.0 },
          { latitude: 90.0, longitude: 180.0 }
        ],
        distanceKm: 20000
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText(/-90\.000000, -180\.000000/)).toBeInTheDocument();
      expect(screen.getByText(/90\.000000, 180\.000000/)).toBeInTheDocument();
    });

    it('should handle very high elevation values', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0, elevation: 8848 }, // Mt. Everest height
          { latitude: 42.0, longitude: -9.0, elevation: 8900 }
        ],
        distanceKm: 10
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('Altitude: 8848m')).toBeInTheDocument();
      expect(screen.getByText('Altitude: 8900m')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('should format distance with one decimal place', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 123.456789
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('123.5 km')).toBeInTheDocument();
    });

    it('should format speed with one decimal place', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100,
        avgSpeedKmh: 85.678
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('85.7 km/h')).toBeInTheDocument();
    });

    it('should format coordinates with six decimal places', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.123456789, longitude: -8.987654321 },
          { latitude: 42.111111111, longitude: -9.999999999 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText(/41\.123457, -8\.987654/)).toBeInTheDocument();
      expect(screen.getByText(/42\.111111, -10\.000000/)).toBeInTheDocument();
    });

    it('should format elevation as integer', () => {
      const mockRoute = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0, elevation: 450.789 },
          { latitude: 42.0, longitude: -9.0, elevation: 520.123 }
        ],
        distanceKm: 10
      };

      render(<RoutePreviewComponent route={mockRoute} />);

      expect(screen.getByText('Altitude: 451m')).toBeInTheDocument();
      expect(screen.getByText('Altitude: 520m')).toBeInTheDocument();
    });
  });
});
