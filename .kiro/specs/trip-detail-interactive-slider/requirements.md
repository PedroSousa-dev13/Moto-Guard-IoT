# Requirements Document

## Introduction

This document specifies the requirements for an interactive slider feature in the TripDetail page that enables synchronized playback of trip data. The slider will allow users to scrub through trip telemetry, with synchronized updates to the map marker position and chart cursors across all visualizations. This feature must support both simulated trips (telemetry from InfluxDB) and GPX-based trips.

## Glossary

- **TripDetail_Page**: The React component that displays post-trip analysis, including maps, charts, and trip statistics (app/frontend/src/pages/TripDetail.tsx)
- **Playback_Slider**: A range input control that allows users to select a specific time instant within the trip timeline
- **Map_Marker**: A visual indicator on the Leaflet map showing the motorcycle's position at a specific time
- **Chart_Cursor**: A vertical line or reference indicator on Recharts visualizations showing the current playback position
- **Telemetry_Data**: Time-series data from InfluxDB containing speed, RPM, temperature, GPS coordinates, and other sensor readings
- **GPX_Data**: GPS track data imported from GPX files containing waypoints with timestamps, coordinates, and elevation
- **Time_Index**: The current position in the trip timeline, represented as a timestamp or array index
- **Synchronized_Playback**: The coordinated update of all visualizations (map and charts) to reflect the same time instant

## Requirements

### Requirement 1: Slider Control Integration

**User Story:** As a user analyzing trip data, I want a slider control on the TripDetail page, so that I can scrub through the trip timeline interactively.

#### Acceptance Criteria

1. THE TripDetail_Page SHALL render a Playback_Slider control below the map panel
2. WHEN the trip has no telemetry or GPX data, THE Playback_Slider SHALL be disabled
3. THE Playback_Slider SHALL span the full width of the map panel container
4. THE Playback_Slider SHALL display the current time value as formatted text (HH:MM:SS)
5. WHEN the user moves the Playback_Slider, THE TripDetail_Page SHALL update the Time_Index state

### Requirement 2: Map Marker Synchronization

**User Story:** As a user reviewing my trip route, I want the map marker to move when I adjust the slider, so that I can see exactly where I was at any point in time.

#### Acceptance Criteria

1. WHEN the Time_Index changes, THE TripDetail_Page SHALL update the Map_Marker position to the corresponding GPS coordinates
2. WHERE Telemetry_Data is available, THE TripDetail_Page SHALL use latitude and longitude fields from the telemetry point matching the Time_Index
3. WHERE GPX_Data is available, THE TripDetail_Page SHALL use the waypoint coordinates matching the Time_Index
4. IF no GPS coordinates exist for the Time_Index, THEN THE Map_Marker SHALL remain at the last valid position
5. THE Map_Marker SHALL be visually distinct from route polyline and event markers
6. THE Map_Marker SHALL remain visible and centered when the Time_Index changes

### Requirement 3: Chart Cursor Synchronization

**User Story:** As a user analyzing telemetry charts, I want vertical cursors on all charts to move with the slider, so that I can correlate data across different metrics at the same time instant.

#### Acceptance Criteria

1. WHEN the Time_Index changes, THE TripDetail_Page SHALL render Chart_Cursor indicators on all visible Recharts components
2. THE Chart_Cursor SHALL appear as a vertical line at the x-axis position corresponding to the Time_Index
3. WHERE Telemetry_Data is available, THE Chart_Cursor SHALL synchronize across speed, RPM, temperature, roll, oil pressure, and tire pressure charts
4. WHERE GPX_Data is available, THE Chart_Cursor SHALL synchronize across speed, altitude, and distance charts
5. THE Chart_Cursor SHALL display tooltip information for all data series at the Time_Index position
6. THE Chart_Cursor SHALL be visually distinct with a contrasting color (e.g., white or yellow)

### Requirement 4: Telemetry Data Source Support

**User Story:** As a user with simulated trip data, I want the slider to work with InfluxDB telemetry, so that I can review sensor data from my connected motorcycle.

#### Acceptance Criteria

1. WHEN trip.source is not "GPX_IMPORTED", THE TripDetail_Page SHALL use Telemetry_Data for Synchronized_Playback
2. THE Playback_Slider SHALL have a range from 0 to the length of the telemetry data array minus 1
3. WHEN the Time_Index changes, THE TripDetail_Page SHALL retrieve the telemetry point at the corresponding array index
4. THE TripDetail_Page SHALL handle missing or null values in telemetry fields gracefully
5. THE Playback_Slider SHALL initialize at index 0 (trip start) when the component mounts

### Requirement 5: GPX Data Source Support

**User Story:** As a user with imported GPX tracks, I want the slider to work with GPX waypoints, so that I can review my route even without live telemetry.

#### Acceptance Criteria

1. WHEN trip.source is "GPX_IMPORTED", THE TripDetail_Page SHALL use GPX_Data for Synchronized_Playback
2. THE Playback_Slider SHALL have a range from 0 to the length of the gpxSeries array minus 1
3. WHEN the Time_Index changes, THE TripDetail_Page SHALL retrieve the waypoint at the corresponding array index
4. THE TripDetail_Page SHALL use derived speed and distance values from the deriveGpxSeries utility
5. THE Playback_Slider SHALL initialize at index 0 (trip start) when the component mounts

### Requirement 6: Playback State Management

**User Story:** As a user interacting with the slider, I want smooth and responsive updates, so that the playback experience feels natural and performant.

#### Acceptance Criteria

1. THE TripDetail_Page SHALL maintain Time_Index as a React state variable
2. WHEN the Playback_Slider value changes, THE TripDetail_Page SHALL update Time_Index within 16ms (60fps)
3. THE TripDetail_Page SHALL debounce or throttle slider input events to prevent excessive re-renders
4. THE TripDetail_Page SHALL use React.useMemo or React.useCallback to optimize derived data calculations
5. THE Map_Marker and Chart_Cursor updates SHALL not block user interaction with the Playback_Slider

### Requirement 7: Visual Feedback and Accessibility

**User Story:** As a user with accessibility needs, I want the slider to be keyboard-accessible and provide clear visual feedback, so that I can use the feature effectively.

#### Acceptance Criteria

1. THE Playback_Slider SHALL be keyboard-accessible (arrow keys, Home, End)
2. THE Playback_Slider SHALL display a visible focus indicator when focused
3. THE Playback_Slider SHALL have an aria-label describing its purpose
4. THE TripDetail_Page SHALL display the current timestamp in a readable format near the Playback_Slider
5. THE Playback_Slider SHALL have sufficient color contrast (WCAG AA minimum)
6. WHEN the Playback_Slider is disabled, THE TripDetail_Page SHALL display a message explaining why (e.g., "No trip data available")

### Requirement 8: Integration with Existing UI

**User Story:** As a user familiar with the current TripDetail page, I want the slider to integrate seamlessly with the existing layout, so that the interface remains intuitive.

#### Acceptance Criteria

1. THE Playback_Slider SHALL be positioned within the "Rota e eventos" panel, below the map canvas
2. THE Playback_Slider SHALL use existing CSS classes and design tokens for consistent styling
3. THE Playback_Slider SHALL not interfere with existing export, share, or navigation functionality
4. THE TripDetail_Page SHALL maintain all existing features (PDF export, CSV export, GPX export, sharing)
5. THE Playback_Slider SHALL be responsive and adapt to different screen sizes

