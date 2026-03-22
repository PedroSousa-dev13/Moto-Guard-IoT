# Implementation Plan: Trip Detail Interactive Slider

## Overview

This implementation plan breaks down the interactive slider feature into discrete, testable coding tasks. The feature enables synchronized playback of trip data through a slider control that updates map markers and chart cursors in real-time. The implementation supports both telemetry data (InfluxDB) and GPX data sources.

## Tasks

- [x] 1. Create PlaybackSlider component with basic functionality
  - Create `app/frontend/src/components/PlaybackSlider.tsx` file
  - Implement PlaybackSliderProps interface (value, max, currentTime, disabled, onChange, disabledMessage)
  - Render HTML5 range input with proper ARIA attributes
  - Display formatted current time next to slider
  - Add disabled state with explanatory message
  - Style with inline styles matching existing design patterns
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.2, 7.3, 7.6_

- [ ]* 1.1 Write unit tests for PlaybackSlider component
  - Test component renders with correct props
  - Test disabled state displays message
  - Test ARIA attributes are present
  - Test time display formatting
  - _Requirements: 1.1, 1.2, 1.4, 7.6_

- [x] 2. Add throttling to PlaybackSlider onChange handler
  - Import lodash throttle function
  - Wrap onChange handler with useMemo and throttle (16ms for 60fps)
  - Implement handleChange callback with parseInt for slider value
  - Ensure throttled function is stable across re-renders
  - _Requirements: 1.5, 6.2, 6.3_

- [ ]* 2.1 Write property test for slider throttling
  - **Property 2: Slider State Synchronization**
  - **Validates: Requirements 1.5**
  - Test that slider value changes update timeIndex state
  - Generate random slider values and verify state updates
  - _Requirements: 1.5_

- [x] 3. Add CSS styles for PlaybackSlider
  - Add playback slider styles to `app/frontend/src/App.css`
  - Style range input track (webkit and moz variants)
  - Style range input thumb with yellow color (#eab308)
  - Add focus indicators with box-shadow
  - Add disabled state styles
  - Style playback-marker class with z-index
  - _Requirements: 7.2, 7.5, 8.2_

- [x] 4. Add state management to TripDetail component
  - Add timeIndex state variable (useState<number>(0))
  - Add playbackMarkerRef (useRef<L.Marker | null>(null))
  - Import PlaybackSlider component
  - _Requirements: 6.1_

- [x] 5. Implement data point selector utility in TripDetail
  - Create getCurrentDataPoint callback function using useCallback
  - Handle GPX_IMPORTED source (return lat, lon, time, speedKmh from gpxSeries)
  - Handle telemetry source (return latitude, longitude, time, speed_kmh from telemetryRes.data)
  - Return null for invalid indices
  - Include all telemetry fields in returned object
  - _Requirements: 2.2, 2.3, 4.1, 4.3, 5.1, 5.3_

- [ ]* 5.1 Write property test for data source routing
  - **Property 3: Data Source Routing**
  - **Validates: Requirements 2.2, 2.3, 4.1, 5.1**
  - Generate trips with different source values
  - Verify correct data source is used for each trip type
  - _Requirements: 2.2, 2.3, 4.1, 5.1_

- [ ]* 5.2 Write property test for data point retrieval
  - **Property 6: Data Point Retrieval**
  - **Validates: Requirements 4.3, 5.3**
  - Generate random valid indices within data array bounds
  - Verify retrieved data point matches array element at that index
  - _Requirements: 4.3, 5.3_

- [ ]* 5.3 Write property test for null value handling
  - **Property 7: Null Value Handling**
  - **Validates: Requirements 4.4**
  - Generate data points with null/missing field values
  - Verify system handles gracefully without errors
  - _Requirements: 4.4_

- [x] 6. Add derived values for slider state in TripDetail
  - Implement maxIndex using useMemo (gpxSeries.length - 1 or telemetryRes.data.length - 1)
  - Implement currentTimeFormatted using useMemo (format with toLocaleTimeString pt-PT)
  - Implement currentTimestamp using useMemo (getTime() in milliseconds)
  - Implement hasPlaybackData using useMemo (check if data arrays have length > 0)
  - _Requirements: 1.4, 4.2, 5.2, 6.4_

- [ ]* 6.1 Write property test for time display formatting
  - **Property 1: Time Display Formatting**
  - **Validates: Requirements 1.4**
  - Generate random valid timestamps
  - Verify formatted time matches HH:MM:SS pattern in pt-PT locale
  - _Requirements: 1.4_

- [ ]* 6.2 Write property test for slider range calculation
  - **Property 5: Slider Range Calculation**
  - **Validates: Requirements 4.2, 5.2**
  - Generate trips with varying data array lengths
  - Verify slider max equals data length minus 1
  - _Requirements: 4.2, 5.2_

- [ ]* 6.3 Write property test for slider disabled state
  - **Property 13: Slider Disabled State**
  - **Validates: Requirements 1.2**
  - Generate trips with and without data
  - Verify slider is disabled when no data available
  - _Requirements: 1.2_

- [x] 7. Checkpoint - Verify slider renders and state updates
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement map playback marker in TripDetail
  - Create useEffect hook that depends on timeIndex
  - Create playback marker with L.divIcon (yellow circle, 16px, white border)
  - Add marker to map on first render
  - Update marker position using setLatLng when timeIndex changes
  - Get coordinates from getCurrentDataPoint(timeIndex)
  - Handle null coordinates gracefully (keep marker at last position)
  - _Requirements: 2.1, 2.4, 2.5_

- [x] 9. Add popup content to playback marker
  - Create popup HTML with playback position title
  - Display current time formatted
  - Display speed if available
  - Bind popup to marker using bindPopup
  - _Requirements: 2.1_

- [ ]* 9.1 Write property test for map marker synchronization
  - **Property 4: Map Marker Position Synchronization**
  - **Validates: Requirements 2.1**
  - Generate random valid timeIndex values
  - Verify map marker position matches GPS coordinates at that index
  - _Requirements: 2.1_

- [x] 10. Integrate PlaybackSlider into TripDetail JSX
  - Add PlaybackSlider component below map canvas in "Rota e eventos" panel
  - Pass timeIndex as value prop
  - Pass maxIndex as max prop
  - Pass currentTimeFormatted as currentTime prop
  - Pass !hasPlaybackData as disabled prop
  - Pass setTimeIndex as onChange prop
  - _Requirements: 1.1, 8.1_

- [x] 11. Add ReferenceLine cursors to telemetry charts
  - Add ReferenceLine to Speed chart (LineChart for chartSeries speed)
  - Add ReferenceLine to RPM vs Speed chart (ScatterChart)
  - Add ReferenceLine to Temperature chart (LineChart for chartSeries temp)
  - Add ReferenceLine to Roll chart (LineChart for chartSeries roll)
  - Configure ReferenceLine: x={currentTimestamp}, stroke="#eab308", strokeWidth={2}, strokeDasharray="3 3"
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 12. Add ReferenceLine cursors to GPX charts
  - Add ReferenceLine to GPX Speed chart (LineChart for gpxSeries speedKmh)
  - Add ReferenceLine to Altitude chart (LineChart for gpxSeries ele)
  - Add ReferenceLine to Distance chart (LineChart for gpxSeries distanceKm)
  - Configure ReferenceLine: x={currentTimestamp}, stroke="#eab308", strokeWidth={2}, strokeDasharray="3 3"
  - _Requirements: 3.1, 3.2, 3.4_

- [ ]* 12.1 Write property test for chart cursor rendering
  - **Property 8: Chart Cursor Rendering**
  - **Validates: Requirements 3.1**
  - Generate random timeIndex changes
  - Verify chart cursors are rendered on all visible charts
  - _Requirements: 3.1_

- [ ]* 12.2 Write property test for chart cursor position
  - **Property 9: Chart Cursor Position**
  - **Validates: Requirements 3.2**
  - Generate random timeIndex values
  - Verify cursor x-axis position matches timestamp at that index
  - _Requirements: 3.2_

- [ ]* 12.3 Write property test for telemetry chart synchronization
  - **Property 10: Chart Cursor Synchronization (Telemetry)**
  - **Validates: Requirements 3.3**
  - Generate telemetry-based trips
  - Verify all telemetry charts display cursor at same timestamp
  - _Requirements: 3.3_

- [ ]* 12.4 Write property test for GPX chart synchronization
  - **Property 11: Chart Cursor Synchronization (GPX)**
  - **Validates: Requirements 3.4**
  - Generate GPX-based trips
  - Verify all GPX charts display cursor at same timestamp
  - _Requirements: 3.4_

- [x] 13. Checkpoint - Verify map and chart synchronization
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add keyboard accessibility to PlaybackSlider
  - Verify HTML5 range input supports arrow keys by default
  - Verify Home/End keys work by default
  - Test keyboard navigation manually
  - _Requirements: 7.1_

- [ ]* 14.1 Write property test for keyboard accessibility
  - **Property 14: Keyboard Accessibility**
  - **Validates: Requirements 7.1**
  - Simulate keyboard events (ArrowLeft, ArrowRight, Home, End)
  - Verify timeIndex updates according to keyboard input
  - _Requirements: 7.1_

- [x] 15. Verify lodash dependency is installed
  - Check if lodash is in package.json dependencies
  - If not installed, add installation instructions to documentation
  - Verify @types/lodash is in devDependencies for TypeScript support
  - _Requirements: 6.3_

- [ ]* 15.1 Write integration tests for existing features
  - **Property 16: Existing Features Preservation**
  - **Validates: Requirements 8.3, 8.4**
  - Test PDF export still works after slider integration
  - Test CSV export still works
  - Test GPX export still works
  - Test share functionality still works
  - _Requirements: 8.3, 8.4_

- [x] 16. Add error handling for edge cases
  - Add bounds checking for timeIndex (clamp to 0 and maxIndex)
  - Add null checks in getCurrentDataPoint
  - Add try-catch in map marker update effect
  - Log warnings in development mode for out-of-bounds access
  - _Requirements: 4.4_

- [ ]* 16.1 Write property test for GPX series derivation
  - **Property 17: GPX Series Derivation**
  - **Validates: Requirements 5.4**
  - Generate GPX-based trips
  - Verify speed and distance values are derived using deriveGpxSeries
  - _Requirements: 5.4_

- [x] 17. Final checkpoint - End-to-end testing
  - Test slider with telemetry data trips
  - Test slider with GPX data trips
  - Test slider disabled state with no data
  - Test map marker updates smoothly
  - Test all chart cursors synchronize
  - Test keyboard navigation
  - Test on different screen sizes
  - Verify no console errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with React, Leaflet for maps, and Recharts for visualizations
- Throttling ensures 60fps performance even with large datasets
- All existing features (exports, sharing) remain unaffected by this implementation
