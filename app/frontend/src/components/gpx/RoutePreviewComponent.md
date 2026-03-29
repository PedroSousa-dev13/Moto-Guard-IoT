# RoutePreviewComponent

## Overview

The `RoutePreviewComponent` displays parsed GPX route information including statistics, coordinates, and integrates with the existing map rendering system. This component is a key part of the GPX Upload UI feature, providing users with a comprehensive preview of their uploaded routes before sending them to the simulator.

## Features

### Core Functionality
- ✅ Display route statistics (distance, duration, waypoints, speed)
- ✅ Show start and end coordinates with 6 decimal precision
- ✅ Display elevation data when available
- ✅ Show timing information (start/end timestamps)
- ✅ Integrate with Leaflet map rendering system
- ✅ Handle optional data gracefully (N/A for missing values)
- ✅ Responsive grid layout for statistics

### Requirements Satisfied
- **Requirement 2.4**: Display route statistics (distance, duration, waypoints)
- **Requirement 2.5**: Show start and end coordinates
- **Map Integration**: Integrates with existing map rendering system

## Usage

```tsx
import RoutePreviewComponent from './components/gpx/RoutePreviewComponent';

function MyComponent() {
  const route = {
    waypoints: [
      { latitude: 41.2951, longitude: -7.7463, elevation: 450 },
      { latitude: 41.3045, longitude: -7.7388, elevation: 480 }
    ],
    distanceKm: 5.2,
    totalTimeSec: 600,
    avgSpeedKmh: 31.2,
    maxSpeedKmh: 45.8
  };

  const handleMapRender = (waypoints) => {
    // Render waypoints on map
    console.log('Rendering', waypoints.length, 'waypoints');
  };

  return (
    <RoutePreviewComponent 
      route={route} 
      onMapRender={handleMapRender}
    />
  );
}
```

## Props

### `route: ParsedGpxRoute` (required)

The parsed GPX route data containing:

```typescript
interface ParsedGpxRoute {
  waypoints: GpxWaypoint[];           // Required: Array of route waypoints
  distanceKm: number;                 // Required: Total distance in kilometers
  totalTimeSec?: number;              // Optional: Total duration in seconds
  avgSpeedKmh?: number;               // Optional: Average speed in km/h
  maxSpeedKmh?: number;               // Optional: Maximum speed in km/h
  startedAt?: Date;                   // Optional: Route start timestamp
  endedAt?: Date;                     // Optional: Route end timestamp
  bounds?: {                          // Optional: Route bounding box
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface GpxWaypoint {
  latitude: number;                   // Required: Waypoint latitude
  longitude: number;                  // Required: Waypoint longitude
  elevation?: number;                 // Optional: Elevation in meters
  time?: Date;                        // Optional: Waypoint timestamp
}
```

### `onMapRender?: (waypoints: GpxWaypoint[]) => void` (optional)

Callback function invoked when the component mounts or waypoints change. Used to trigger map rendering with the route waypoints.

**When called:**
- On component mount
- When waypoints array changes (reference equality check)

**Parameters:**
- `waypoints`: Array of GpxWaypoint objects to render on the map

## Data Formatting

The component formats data according to these rules:

| Data Type | Format | Example |
|-----------|--------|---------|
| Distance | 1 decimal place + " km" | "123.5 km" |
| Speed | 1 decimal place + " km/h" | "85.7 km/h" |
| Coordinates | 6 decimal places | "41.123457, -8.987654" |
| Elevation | Integer + "m" | "450m" |
| Duration (hours) | "Xh Ym" | "2h 15m" |
| Duration (minutes) | "Ym" | "45m" |
| Missing data | "N/A" | "N/A" |

## Visual Elements

### Statistics Grid
Displays route statistics in a 2-column grid:
- **Distance**: Total route distance in kilometers
- **Duration**: Total time (hours and minutes)
- **Waypoints**: Total number of waypoints
- **Average Speed**: Average speed (only shown if available)

### Endpoints Section
Shows start and end point information:
- **Start Point**: Green dot indicator + coordinates + elevation (if available)
- **End Point**: Red dot indicator + coordinates + elevation (if available)

### Timing Section
Displays route timing information (only shown if available):
- **Start Time**: Route start timestamp (localized to pt-PT)
- **End Time**: Route end timestamp (localized to pt-PT)

## Styling

The component uses CSS classes defined in `app/frontend/src/App.css`:

```css
.gpx-route-preview          /* Main container */
.gpx-route-header           /* Header section */
.gpx-route-title            /* Title with icon */
.gpx-route-stats-grid       /* Statistics grid (2 columns) */
.gpx-stat-item              /* Individual statistic card */
.gpx-stat-icon              /* Statistic icon */
.gpx-stat-label             /* Statistic label */
.gpx-stat-value             /* Statistic value */
.gpx-route-endpoints        /* Endpoints section */
.gpx-endpoint               /* Individual endpoint card */
.gpx-endpoint-header        /* Endpoint header with dot */
.gpx-endpoint-label         /* Endpoint label (Início/Fim) */
.gpx-endpoint-coords        /* Coordinate text (monospace) */
.gpx-endpoint-elevation     /* Elevation text */
.gpx-route-timing           /* Timing section */
.gpx-timing-item            /* Individual timing row */
.gpx-timing-label           /* Timing label */
.gpx-timing-value           /* Timing value (monospace) */
.green-dot                  /* Start point indicator */
.red-dot                    /* End point indicator */
```

## Integration with Map Component

The component integrates with the Map component through the `onMapRender` callback:

```tsx
// In Map.tsx
function handleGpxMapRender(waypoints: GpxWaypoint[]) {
  const map = mapRef.current;
  if (!map || !waypoints || waypoints.length === 0) return;

  // Clear previous preview
  previewLineRef.current?.remove();
  startDotRef.current?.remove();
  endDotRef.current?.remove();

  const coords = waypoints.map(wp => [wp.latitude, wp.longitude]);
  
  // Draw start/end markers
  startDotRef.current = L.circleMarker(coords[0], {
    radius: 9, color: "#16a34a", fillColor: "#22c55e", 
    fillOpacity: 1, weight: 2
  }).addTo(map);

  endDotRef.current = L.circleMarker(coords[coords.length - 1], {
    radius: 9, color: "#b91c1c", fillColor: "#ef4444", 
    fillOpacity: 1, weight: 2
  }).addTo(map);

  // Draw route line
  previewLineRef.current = L.polyline(coords, {
    color: "#5b6af0", weight: 5, opacity: 0.85
  }).addTo(map);

  // Fit map to route bounds
  map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
}

// Usage in GpxUploadTab
<RoutePreviewComponent 
  route={gpxRoute} 
  onMapRender={handleGpxMapRender}
/>
```

## Edge Cases Handled

1. **Missing Optional Data**: Shows "N/A" for missing duration/speed, hides optional sections
2. **Minimal Routes**: Works with routes containing only 2 waypoints (minimum requirement)
3. **Large Routes**: Efficiently handles routes with 1000+ waypoints
4. **Extreme Values**: Properly formats extreme coordinates (-90 to 90, -180 to 180)
5. **No Elevation**: Gracefully hides elevation data when not available
6. **No Timing**: Hides timing section when timestamps are not available
7. **No Map Callback**: Works without `onMapRender` callback (standalone mode)

## Testing

The component has comprehensive test coverage:

### Unit Tests (`RoutePreviewComponent.test.tsx`)
- 15 test cases covering all component functionality
- Tests for data formatting, display logic, and callback integration

### Integration Tests (`RoutePreviewComponent.integration.test.tsx`)
- 16 test cases covering integration scenarios
- Tests for map integration, re-rendering, and edge cases

### Requirements Tests (`RoutePreviewComponent.requirements.test.tsx`)
- 21 test cases validating all requirements
- Tests for Requirements 2.4, 2.5, and map integration

**Total Coverage**: 52 test cases, all passing ✅

Run tests with:
```bash
npm test -- RoutePreviewComponent --run
```

## Performance Considerations

- **Memoization**: Uses `React.useEffect` with dependency array to prevent unnecessary map re-renders
- **Efficient Rendering**: Only re-renders map when waypoints array reference changes
- **Large Routes**: Handles 1000+ waypoints efficiently without performance degradation
- **Lazy Evaluation**: Optional sections only render when data is available

## Accessibility

- Semantic HTML structure with proper heading hierarchy
- Descriptive labels for all statistics
- Monospace font for coordinates (improved readability)
- Color indicators supplemented with text labels
- Proper contrast ratios for all text elements

## Future Enhancements

Potential improvements for future iterations:
1. Add elevation profile chart visualization
2. Display route type detection (loop vs. point-to-point)
3. Show intermediate waypoint details on hover
4. Add route comparison features
5. Export route statistics to CSV/JSON
6. Add route quality indicators (smoothness, completeness)
7. Display route metadata (name, description from GPX)

## Related Components

- **FileUploadComponent**: Handles GPX file upload
- **RouteActionsComponent**: Provides actions (send to simulator, clear)
- **GpxUploadTab**: Container component that orchestrates all GPX components
- **Map Component**: Parent component that provides map rendering

## Dependencies

- React (hooks: useEffect)
- lucide-react (icons: MapPin, Clock, Route, TrendingUp)
- Leaflet (via Map component for rendering)

## Version History

- **v1.0.0** (2024-01): Initial implementation with all core features
  - Route statistics display
  - Start/end coordinates
  - Map integration
  - Comprehensive test coverage
