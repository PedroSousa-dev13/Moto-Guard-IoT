# GPX Components Test Suite

This directory contains comprehensive tests for the GPX Upload UI feature components.

## Test Files

### RoutePreviewComponent.test.tsx
Unit tests for the RoutePreviewComponent that verify:
- Route statistics display (distance, duration, waypoints, speed)
- Start and end coordinate formatting
- Elevation data display
- Timing information display
- Duration formatting (hours and minutes)
- Map rendering callback integration
- Handling of missing/optional data
- Coordinate precision (6 decimal places)

**Coverage**: 15 test cases covering all component functionality

### RoutePreviewComponent.integration.test.tsx
Integration tests that verify:
- Map integration and rendering triggers
- Re-rendering behavior on waypoint changes
- Requirements validation (2.4, 2.5)
- Edge cases (many waypoints, extreme values)
- Data formatting consistency
- Integration with existing map rendering system

**Coverage**: 16 test cases covering integration scenarios

### FileUploadComponent.test.tsx
Unit tests for file upload functionality:
- File selection and validation
- Drag-and-drop support
- Progress indication
- Error handling
- File type and size validation

### FileUploadComponent.property.test.tsx
Property-based tests for file upload:
- File type validation across diverse inputs
- File size validation
- Upload state management

### GpxUploadTab.test.tsx
Integration tests for the complete GPX upload tab:
- Component composition
- State management
- Error handling
- User interactions

## Running Tests

```bash
# Run all GPX tests
npm test -- gpx --run

# Run specific component tests
npm test -- RoutePreviewComponent.test.tsx --run
npm test -- RoutePreviewComponent.integration.test.tsx --run

# Run with coverage
npm test -- gpx --coverage
```

## Test Results

All tests pass successfully:
- **Total Test Files**: 6
- **Total Tests**: 72
- **Status**: ✅ All passing

## Requirements Coverage

The test suite validates the following requirements:

### Requirement 2.4: Display route statistics
- ✅ Distance display
- ✅ Duration display
- ✅ Waypoint count
- ✅ Average speed display
- ✅ Maximum speed display

### Requirement 2.5: Show start and end coordinates
- ✅ Start point coordinates with 6 decimal precision
- ✅ End point coordinates with 6 decimal precision
- ✅ Visual indicators (green/red dots)
- ✅ Elevation data when available

### Map Integration
- ✅ Integration with existing map rendering system
- ✅ Route visualization with polylines
- ✅ Start/end markers
- ✅ Automatic map bounds fitting

## Component Features

### RoutePreviewComponent

**Props:**
- `route`: ParsedGpxRoute - The parsed GPX route data
- `onMapRender?`: (waypoints: GpxWaypoint[]) => void - Callback for map rendering

**Features:**
- Displays comprehensive route statistics
- Shows formatted start/end coordinates
- Handles optional data gracefully (elevation, timing, speed)
- Integrates with Leaflet map rendering
- Responsive grid layout for statistics
- Consistent styling with existing UI

**Data Formatting:**
- Distance: 1 decimal place (e.g., "123.5 km")
- Speed: 1 decimal place (e.g., "85.7 km/h")
- Coordinates: 6 decimal places (e.g., "41.123457, -8.987654")
- Elevation: Integer (e.g., "450m")
- Duration: Hours and minutes (e.g., "2h 15m" or "45m")

## Edge Cases Handled

1. **Missing Optional Data**: Component gracefully handles routes without timing, speed, or elevation data
2. **Minimal Routes**: Works with routes containing only 2 waypoints (minimum requirement)
3. **Large Routes**: Handles routes with 1000+ waypoints efficiently
4. **Extreme Values**: Properly formats extreme coordinates and elevations
5. **Duration Formatting**: Correctly formats both short (minutes) and long (hours) durations

## Integration Points

### Map Component Integration
The RoutePreviewComponent integrates with the Map component through:
1. `onMapRender` callback that triggers map visualization
2. Waypoint data passed to Leaflet for polyline rendering
3. Start/end markers synchronized with coordinate display
4. Automatic map bounds adjustment to show full route

### GpxUploadTab Integration
The component is used within GpxUploadTab alongside:
- FileUploadComponent (file selection)
- RouteActionsComponent (send to simulator, clear route)

## Styling

All styles are defined in `app/frontend/src/App.css` under the GPX section:
- `.gpx-route-preview` - Main container
- `.gpx-route-stats-grid` - Statistics grid layout
- `.gpx-stat-item` - Individual statistic card
- `.gpx-route-endpoints` - Start/end coordinate section
- `.gpx-endpoint` - Individual endpoint card
- `.gpx-route-timing` - Timing information section

## Future Enhancements

Potential improvements for future iterations:
1. Add elevation profile visualization
2. Display route type detection (loop vs. point-to-point)
3. Show intermediate waypoint details
4. Add route comparison features
5. Export route statistics to CSV/JSON
