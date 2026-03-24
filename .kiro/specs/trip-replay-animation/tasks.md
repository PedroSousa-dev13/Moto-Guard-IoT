# Implementation Plan: Trip Replay Animation

## Overview

This implementation adds animated trip replay functionality to the TripDetail page. The feature builds on the existing PlaybackSlider component by adding automatic timeline advancement with Play, Pause, and Stop controls, plus speed selection (1x, 2x, 5x, 10x). The implementation uses interval-based timing for smooth animation and integrates seamlessly with both telemetry and GPX data sources.

## Tasks

- [x] 1. Create PlaybackControls component
  - Create `app/frontend/src/components/PlaybackControls.tsx` with Play, Pause, Stop buttons and speed selector
  - Implement PlaybackControlsProps interface with isPlaying, playbackSpeed, disabled, and event handlers
  - Add button state management (Play disabled when playing, Pause disabled when stopped)
  - Include ARIA labels and accessibility attributes for all controls
  - Style controls to match existing UI patterns
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.3, 7.1, 7.2, 7.3_

- [ ]* 1.1 Write unit tests for PlaybackControls component
  - Test button enabled/disabled states
  - Test event handler calls
  - Test speed selector options
  - _Requirements: 1.5, 1.6, 2.1_

- [ ] 2. Add playback state management to TripDetail
  - [x] 2.1 Add isPlaying and playbackSpeed state variables
    - Add `const [isPlaying, setIsPlaying] = useState<boolean>(false)`
    - Add `const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)`
    - _Requirements: 1.2, 2.2_
  
  - [x] 2.2 Implement playback control handlers
    - Create handlePlay function (resets to start if at end, sets isPlaying true)
    - Create handlePause function (sets isPlaying false)
    - Create handleStop function (sets isPlaying false, resets timeIndex to 0)
    - Create handleSpeedChange function (updates playbackSpeed)
    - Use useCallback for all handlers
    - _Requirements: 1.2, 1.3, 1.4, 2.4_
  
  - [ ]* 2.3 Write property test for playback state transitions
    - **Property 1: Play Button Starts Playback**
    - **Property 2: Pause Button Stops Advancement**
    - **Property 3: Stop Button Resets Position**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [ ] 3. Implement animation loop
  - [x] 3.1 Create useEffect for interval-based animation
    - Add useEffect that runs when isPlaying, playbackSpeed, or maxIndex changes
    - Use setInterval with 100ms tick rate
    - Increment timeIndex by playbackSpeed on each tick
    - Stop playback automatically when reaching maxIndex
    - Clear interval in cleanup function
    - _Requirements: 2.2, 2.5, 2.6, 2.7, 2.8, 3.1, 3.5, 8.1, 8.3, 8.4_
  
  - [ ]* 3.2 Write property test for speed-based advancement
    - **Property 7: Speed-Based Advancement Rate**
    - **Validates: Requirements 2.2, 2.5, 2.6, 2.7, 2.8**
  
  - [ ]* 3.3 Write property test for automatic stop
    - **Property 6: Automatic Stop at End**
    - **Validates: Requirements 1.7, 3.5**

- [x] 4. Integrate PlaybackControls into TripDetail UI
  - Add PlaybackControls component below PlaybackSlider in "Rota e eventos" panel
  - Pass isPlaying, playbackSpeed, hasPlaybackData, and handler functions as props
  - Ensure controls are disabled when hasPlaybackData is false
  - _Requirements: 5.5, 7.1, 7.4, 7.5_

- [ ]* 4.1 Write property test for UI synchronization
  - **Property 10: Slider Position Synchronization**
  - **Property 11: Map Marker Synchronization**
  - **Property 12: Chart Cursor Synchronization**
  - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 5. Add CSS styles for PlaybackControls
  - Add playback-controls styles to `app/frontend/src/App.css`
  - Style buttons with consistent sizing and spacing
  - Add hover and active states for buttons
  - Style disabled states with reduced opacity
  - Ensure responsive layout for different screen sizes
  - _Requirements: 7.3, 7.4_

- [x] 6. Checkpoint - Verify basic playback functionality
  - Ensure Play button starts animation
  - Ensure Pause button stops animation
  - Ensure Stop button resets to beginning
  - Ensure speed selector changes animation speed
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Test data source compatibility
  - [x] 7.1 Verify telemetry data playback
    - Test with trips that have telemetry data (source !== "GPX_IMPORTED")
    - Verify map marker updates correctly with latitude/longitude fields
    - Verify chart cursors update correctly
    - _Requirements: 4.1, 4.2, 5.1, 5.4_
  
  - [x] 7.2 Verify GPX data playback
    - Test with trips that have GPX data (source === "GPX_IMPORTED")
    - Verify map marker updates correctly with lat/lon fields
    - Verify chart cursors update correctly
    - _Requirements: 4.1, 4.3, 5.2, 5.4_
  
  - [ ]* 7.3 Write property test for data source selection
    - **Property 17: Data Source Selection**
    - **Property 19: Data Structure Handling**
    - **Validates: Requirements 5.1, 5.2, 5.4**

- [ ] 8. Test manual slider interaction during playback
  - [x] 8.1 Verify manual slider adjustment continues playback
    - Start playback, drag slider to new position
    - Verify playback continues from new position without pausing
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 8.2 Write property test for manual slider interaction
    - **Property 21: Manual Slider During Playback**
    - **Property 22: Manual Seek to End**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 9. Test edge cases and error handling
  - [x] 9.1 Test with empty data
    - Verify controls are disabled when no data available
    - Verify appropriate message is displayed
    - _Requirements: 5.5, 7.5_
  
  - [x] 9.2 Test Play at end behavior
    - Click Play when timeIndex === maxIndex
    - Verify playback resets to beginning and starts
    - _Requirements: 1.2, 1.7_
  
  - [x] 9.3 Test rapid Play/Pause clicks
    - Click Play and Pause rapidly multiple times
    - Verify no multiple timers are created
    - Verify state remains consistent
    - _Requirements: 8.4_
  
  - [ ]* 9.4 Write property test for cleanup
    - **Property 24: Component Unmount Cleanup**
    - **Property 27: Single Timer Invariant**
    - **Validates: Requirements 8.1, 8.4**

- [x] 10. Final checkpoint - Comprehensive testing
  - Test with large datasets (>5000 points) at all speeds
  - Test on different screen sizes (mobile, tablet, desktop)
  - Verify no console errors during playback
  - Verify smooth animation at all speeds
  - Verify timer cleanup (no memory leaks)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing PlaybackSlider component remains unchanged
- The existing map marker update logic (playbackMarkerRef) already works with timeIndex changes
- The existing chart ReferenceLine components already use currentTimestamp for synchronization
- No new dependencies are required - all functionality uses existing React hooks and browser APIs
