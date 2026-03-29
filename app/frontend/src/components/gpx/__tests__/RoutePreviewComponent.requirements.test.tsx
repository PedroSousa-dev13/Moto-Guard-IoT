import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoutePreviewComponent from '../RoutePreviewComponent';

/**
 * Requirements Validation Tests for RoutePreviewComponent
 * 
 * This test suite validates that the RoutePreviewComponent satisfies
 * all requirements specified in the design document.
 */
describe('RoutePreviewComponent - Requirements Validation', () => {
  describe('Requirement 2.4: Display route statistics', () => {
    it('MUST display distance in kilometers', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 123.456
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Distância')).toBeInTheDocument();
      expect(screen.getByText('123.5 km')).toBeInTheDocument();
    });

    it('MUST display duration when available', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100,
        totalTimeSec: 3600
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Duração')).toBeInTheDocument();
      expect(screen.getByText('1h 0m')).toBeInTheDocument();
    });

    it('MUST display waypoint count', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 41.5, longitude: -8.5 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Pontos')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('MUST display average speed when available', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100,
        avgSpeedKmh: 85.5
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Velocidade Média')).toBeInTheDocument();
      expect(screen.getByText('85.5 km/h')).toBeInTheDocument();
    });

    it('MUST handle missing optional statistics gracefully', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      // Distance and waypoint count should always be present
      expect(screen.getByText('Distância')).toBeInTheDocument();
      expect(screen.getByText('Pontos')).toBeInTheDocument();

      // Duration should show N/A when not available
      expect(screen.getByText('N/A')).toBeInTheDocument();

      // Average speed should not be displayed when not available
      expect(screen.queryByText('Velocidade Média')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 2.5: Show start and end coordinates', () => {
    it('MUST display start coordinates', () => {
      const route = {
        waypoints: [
          { latitude: 41.295100, longitude: -7.746300 },
          { latitude: 42.318000, longitude: -8.705000 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Início')).toBeInTheDocument();
      expect(screen.getByText(/41\.295100, -7\.746300/)).toBeInTheDocument();
    });

    it('MUST display end coordinates', () => {
      const route = {
        waypoints: [
          { latitude: 41.295100, longitude: -7.746300 },
          { latitude: 42.318000, longitude: -8.705000 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Fim')).toBeInTheDocument();
      expect(screen.getByText(/42\.318000, -8\.705000/)).toBeInTheDocument();
    });

    it('MUST format coordinates with 6 decimal places', () => {
      const route = {
        waypoints: [
          { latitude: 41.123456789, longitude: -7.987654321 },
          { latitude: 42.111111111, longitude: -8.999999999 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      // Verify 6 decimal place precision
      expect(screen.getByText(/41\.123457, -7\.987654/)).toBeInTheDocument();
      expect(screen.getByText(/42\.111111, -9\.000000/)).toBeInTheDocument();
    });

    it('MUST display visual indicators for start and end points', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      const { container } = render(<RoutePreviewComponent route={route} />);

      // Verify green dot for start
      const greenDots = container.querySelectorAll('.green-dot');
      expect(greenDots.length).toBeGreaterThan(0);

      // Verify red dot for end
      const redDots = container.querySelectorAll('.red-dot');
      expect(redDots.length).toBeGreaterThan(0);
    });

    it('MUST display elevation data when available', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0, elevation: 450 },
          { latitude: 42.0, longitude: -9.0, elevation: 520 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Altitude: 450m')).toBeInTheDocument();
      expect(screen.getByText('Altitude: 520m')).toBeInTheDocument();
    });

    it('MUST handle missing elevation data gracefully', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.queryByText(/Altitude:/)).not.toBeInTheDocument();
    });
  });

  describe('Map Integration Requirement', () => {
    it('MUST integrate with existing map rendering system', () => {
      const mockOnMapRender = vi.fn();
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(
        <RoutePreviewComponent 
          route={route} 
          onMapRender={mockOnMapRender}
        />
      );

      // Verify map rendering callback is invoked
      expect(mockOnMapRender).toHaveBeenCalledTimes(1);
      expect(mockOnMapRender).toHaveBeenCalledWith(route.waypoints);
    });

    it('MUST pass waypoints to map rendering system', () => {
      const mockOnMapRender = vi.fn();
      const waypoints = [
        { latitude: 41.0, longitude: -8.0, elevation: 450 },
        { latitude: 41.5, longitude: -8.5, elevation: 480 },
        { latitude: 42.0, longitude: -9.0, elevation: 520 }
      ];
      const route = {
        waypoints,
        distanceKm: 100
      };

      render(
        <RoutePreviewComponent 
          route={route} 
          onMapRender={mockOnMapRender}
        />
      );

      // Verify all waypoints are passed
      expect(mockOnMapRender).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ latitude: 41.0, longitude: -8.0 }),
          expect.objectContaining({ latitude: 41.5, longitude: -8.5 }),
          expect.objectContaining({ latitude: 42.0, longitude: -9.0 })
        ])
      );
    });

    it('MUST work without map rendering callback (optional integration)', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      // Should not throw when onMapRender is not provided
      expect(() => {
        render(<RoutePreviewComponent route={route} />);
      }).not.toThrow();

      // Component should still render correctly
      expect(screen.getByText('Rota GPX Carregada')).toBeInTheDocument();
    });
  });

  describe('Data Integrity Requirements', () => {
    it('MUST preserve waypoint data accuracy', () => {
      const mockOnMapRender = vi.fn();
      const waypoints = [
        { latitude: 41.123456, longitude: -7.654321, elevation: 450.5 },
        { latitude: 42.987654, longitude: -8.123456, elevation: 520.8 }
      ];
      const route = {
        waypoints,
        distanceKm: 100
      };

      render(
        <RoutePreviewComponent 
          route={route} 
          onMapRender={mockOnMapRender}
        />
      );

      // Verify exact waypoint data is passed to map
      const passedWaypoints = mockOnMapRender.mock.calls[0][0];
      expect(passedWaypoints[0].latitude).toBe(41.123456);
      expect(passedWaypoints[0].longitude).toBe(-7.654321);
      expect(passedWaypoints[0].elevation).toBe(450.5);
    });

    it('MUST handle all waypoints regardless of count', () => {
      const mockOnMapRender = vi.fn();
      const waypoints = Array.from({ length: 500 }, (_, i) => ({
        latitude: 41.0 + i * 0.001,
        longitude: -8.0 + i * 0.001
      }));
      const route = {
        waypoints,
        distanceKm: 100
      };

      render(
        <RoutePreviewComponent 
          route={route} 
          onMapRender={mockOnMapRender}
        />
      );

      // Verify all 500 waypoints are passed
      expect(mockOnMapRender).toHaveBeenCalledWith(
        expect.arrayContaining(waypoints)
      );
      expect(mockOnMapRender.mock.calls[0][0]).toHaveLength(500);
    });
  });

  describe('UI Consistency Requirements', () => {
    it('MUST use consistent styling with existing map interface', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      const { container } = render(<RoutePreviewComponent route={route} />);

      // Verify consistent CSS classes are used
      expect(container.querySelector('.gpx-route-preview')).toBeInTheDocument();
      expect(container.querySelector('.gpx-route-stats-grid')).toBeInTheDocument();
      expect(container.querySelector('.gpx-route-endpoints')).toBeInTheDocument();
    });

    it('MUST display all required UI elements', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100,
        totalTimeSec: 3600,
        avgSpeedKmh: 100
      };

      render(<RoutePreviewComponent route={route} />);

      // Verify all required UI elements are present
      expect(screen.getByText('Rota GPX Carregada')).toBeInTheDocument();
      expect(screen.getByText('Distância')).toBeInTheDocument();
      expect(screen.getByText('Duração')).toBeInTheDocument();
      expect(screen.getByText('Pontos')).toBeInTheDocument();
      expect(screen.getByText('Velocidade Média')).toBeInTheDocument();
      expect(screen.getByText('Início')).toBeInTheDocument();
      expect(screen.getByText('Fim')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('MUST handle minimum valid route (2 waypoints)', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('100.0 km')).toBeInTheDocument();
    });

    it('MUST handle routes with timing information', () => {
      const route = {
        waypoints: [
          { latitude: 41.0, longitude: -8.0 },
          { latitude: 42.0, longitude: -9.0 }
        ],
        distanceKm: 100,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        endedAt: new Date('2024-01-15T11:00:00Z')
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText('Início:')).toBeInTheDocument();
      expect(screen.getByText('Fim:')).toBeInTheDocument();
    });

    it('MUST handle extreme coordinate values', () => {
      const route = {
        waypoints: [
          { latitude: -90.0, longitude: -180.0 },
          { latitude: 90.0, longitude: 180.0 }
        ],
        distanceKm: 20000
      };

      render(<RoutePreviewComponent route={route} />);

      expect(screen.getByText(/-90\.000000, -180\.000000/)).toBeInTheDocument();
      expect(screen.getByText(/90\.000000, 180\.000000/)).toBeInTheDocument();
    });
  });
});
