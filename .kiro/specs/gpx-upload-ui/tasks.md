# Implementation Plan: GPX Upload UI

## Overview

This implementation plan creates a new GPX upload tab in the existing Map page, allowing users to upload GPX files, preview routes, and send them directly to the simulator. The implementation leverages existing backend GPX parsing services and follows established UI patterns.

## Tasks

- [x] 1. Create backend API endpoint for GPX parsing
  - [x] 1.1 Add new `/api/gpx/parse` endpoint to GPX controller
    - Create endpoint that parses GPX without database storage
    - Return route data in simulator-compatible format
    - Include file validation and error handling
    - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

  - [x] 1.2 Write property test for GPX parsing endpoint
    - **Property 3: GPX Parsing Completeness**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.3 Write unit tests for GPX parsing endpoint
    - Test file validation edge cases
    - Test error responses for invalid files
    - Test successful parsing scenarios
    - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

- [x] 2. Extend Map component with GPX upload mode
  - [x] 2.1 Update Map component state and mode system
    - Add "gpx" mode to existing "preset" and "custom" modes
    - Add GPX-specific state variables for upload and processing
    - Update mode toggle to include GPX Upload tab
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Create GPX upload tab panel structure
    - Create container component for GPX upload functionality
    - Implement consistent styling with existing map interface
    - Add tab switching logic and state cleanup
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 2.3 Write property test for UI state management
    - **Property 6: UI State Management**
    - **Validates: Requirements 5.3, 6.3, 6.4**

- [x] 3. Implement file upload component
  - [x] 3.1 Create FileUploadComponent with drag-and-drop
    - Implement file input with .gpx extension filter
    - Add drag-and-drop functionality for file selection
    - Include upload progress indicator
    - _Requirements: 1.1, 1.4_

  - [x] 3.2 Add file validation and error handling
    - Validate file extension (.gpx only)
    - Validate file size (max 10MB)
    - Display appropriate error messages for invalid files
    - _Requirements: 1.2, 1.3, 6.1_

  - [x] 3.3 Write property test for file validation
    - **Property 1: File Type Validation**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 3.4 Write property test for file size validation
    - **Property 2: File Size and Content Validation**
    - **Validates: Requirements 6.1, 6.2**

- [x] 4. Checkpoint - Ensure file upload works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement GPX processing and route preview
  - [x] 5.1 Create RoutePreviewComponent for parsed GPX data
    - Display route statistics (distance, duration, waypoints)
    - Show start and end coordinates
    - Integrate with existing map rendering system
    - _Requirements: 2.4, 2.5_

  - [x] 5.2 Add route conversion logic
    - Transform GPX waypoints to simulator route format
    - Set first waypoint as start, last as end coordinates
    - Validate minimum waypoint requirements (at least 2)
    - Set loop property to false for GPX imports
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.3 Write property test for route conversion
    - **Property 4: Route Conversion Consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [x] 5.4 Write property test for minimum waypoint validation
    - **Property 5: Minimum Waypoint Validation**
    - **Validates: Requirements 3.4**

- [x] 6. Implement map integration and visualization
  - [x] 6.1 Add GPX route rendering to map
    - Render GPX route with start/end markers
    - Use existing preview line system for route display
    - Fit map bounds to show entire route
    - _Requirements: 2.5_

  - [x] 6.2 Handle map state cleanup and switching
    - Clear GPX routes when switching tabs
    - Preserve map view during tab switches
    - Reset upload state appropriately
    - _Requirements: 5.3, 6.3, 6.4_

- [x] 7. Create route actions component
  - [x] 7.1 Implement RouteActionsComponent
    - Add "Send to Simulator" button for processed routes
    - Add "Clear Route" functionality
    - Include loading states and visual feedback
    - _Requirements: 4.1, 4.4, 6.4_

  - [x] 7.2 Add WebSocket integration for simulator commands
    - Use existing sendCommand function from useSocket
    - Send route in same format as preset/custom routes
    - Handle command transmission feedback
    - _Requirements: 4.2, 4.3_

  - [x] 7.3 Write property test for WebSocket communication
    - **Property 7: WebSocket Communication Protocol**
    - **Validates: Requirements 4.2, 4.3**

- [x] 8. Implement navigation and completion flow
  - [x] 8.1 Add navigation to simulator after route send
    - Navigate to simulator contexts page after successful send
    - Provide visual confirmation of route transmission
    - _Requirements: 4.4, 4.5_

  - [x] 8.2 Write property test for navigation behavior
    - **Property 10: Navigation Behavior**
    - **Validates: Requirements 4.5**

- [x] 9. Add comprehensive error handling and user feedback
  - [x] 9.1 Implement error handling for all operations
    - Handle network errors gracefully
    - Display descriptive error messages for processing failures
    - Provide recovery options for failed operations
    - _Requirements: 2.3, 6.5_

  - [x] 9.2 Add loading states and user feedback
    - Show upload progress during file transfer
    - Display processing indicators during GPX parsing
    - Provide success confirmations for completed operations
    - _Requirements: 1.4, 1.5, 5.4, 5.5_

  - [x] 9.3 Write property test for error handling
    - **Property 9: Error Handling Robustness**
    - **Validates: Requirements 2.3, 6.5**

  - [x] 9.4 Write property test for UI feedback consistency
    - **Property 8: UI Feedback Consistency**
    - **Validates: Requirements 1.4, 1.5, 4.4, 5.4, 5.5**

- [x] 10. Final integration and testing
  - [x] 10.1 Wire all components together in Map page
    - Integrate all GPX components into Map component
    - Ensure proper state management and cleanup
    - Test complete upload-to-simulator workflow
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 10.2 Add integration tests for complete workflow
    - Test end-to-end GPX upload and processing
    - Verify route preview and map rendering
    - Test simulator command transmission
    - _Requirements: All requirements_

- [x] 11. Final checkpoint - Ensure all functionality works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation builds on existing Map component patterns and GPX service infrastructure