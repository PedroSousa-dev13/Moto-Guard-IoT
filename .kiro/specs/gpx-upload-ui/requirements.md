# Requirements Document

## Introduction

The GPX Upload UI feature enables users to upload GPX files through the web interface, convert them to simulation routes, and send them directly to the simulator for execution. This feature bridges the gap between external GPX data and the existing simulation system by providing an intuitive upload interface integrated into the Map page.

## Glossary

- **GPX_File**: A GPS Exchange Format file containing waypoint, track, and route data
- **Upload_Component**: The UI component that handles file selection and upload
- **GPX_Service**: The existing backend service that parses and processes GPX files
- **Simulator**: The headless simulator that executes routes and generates telemetry
- **Route_Converter**: The component that transforms GPX waypoints into simulator route format
- **Map_Interface**: The existing Map.tsx page where the upload functionality will be integrated

## Requirements

### Requirement 1: GPX File Upload Interface

**User Story:** As a user, I want to upload GPX files through the web interface, so that I can use external route data for simulation.

#### Acceptance Criteria

1. THE Upload_Component SHALL display a file input that accepts only .gpx files
2. WHEN a GPX file is selected, THE Upload_Component SHALL validate the file extension
3. WHEN an invalid file type is selected, THE Upload_Component SHALL display an error message
4. THE Upload_Component SHALL show upload progress during file transfer
5. WHEN upload completes successfully, THE Upload_Component SHALL display success confirmation

### Requirement 2: GPX File Processing

**User Story:** As a user, I want uploaded GPX files to be automatically processed, so that I can see route information before simulation.

#### Acceptance Criteria

1. WHEN a GPX file is uploaded, THE GPX_Service SHALL parse the file content
2. THE GPX_Service SHALL extract waypoints, distance, and timing information
3. IF the GPX file is invalid or corrupted, THEN THE GPX_Service SHALL return a descriptive error message
4. THE Map_Interface SHALL display parsed route information including distance and estimated duration
5. THE Map_Interface SHALL render the GPX route on the map with start and end markers

### Requirement 3: Route Conversion and Validation

**User Story:** As a user, I want GPX routes to be converted to simulator format, so that they can be executed by the simulation system.

#### Acceptance Criteria

1. THE Route_Converter SHALL transform GPX waypoints into simulator route format
2. THE Route_Converter SHALL set the first waypoint as route start coordinates
3. THE Route_Converter SHALL set the last waypoint as route end coordinates
4. WHEN the GPX contains fewer than 2 waypoints, THE Route_Converter SHALL return an error
5. THE Route_Converter SHALL preserve route loop setting as false for GPX imports

### Requirement 4: Simulator Integration

**User Story:** As a user, I want to send converted GPX routes to the simulator, so that I can execute real-world routes in simulation.

#### Acceptance Criteria

1. WHEN a GPX route is successfully processed, THE Map_Interface SHALL display a "Send to Simulator" button
2. WHEN the send button is clicked, THE Map_Interface SHALL transmit the route to the Simulator via WebSocket
3. THE Simulator SHALL receive and process the route command in the same format as existing routes
4. THE Map_Interface SHALL provide visual feedback when the route is successfully sent
5. AFTER sending the route, THE Map_Interface SHALL navigate to the simulator contexts page

### Requirement 5: User Interface Integration

**User Story:** As a user, I want GPX upload functionality integrated into the existing map interface, so that I have a unified route management experience.

#### Acceptance Criteria

1. THE Map_Interface SHALL include a new "GPX Upload" tab alongside existing "Preset Routes" and "Custom Route" tabs
2. THE Upload_Component SHALL maintain consistent styling with existing map interface components
3. WHEN switching between tabs, THE Map_Interface SHALL preserve the current map view and clear previous route previews
4. THE Map_Interface SHALL display appropriate loading states during GPX processing
5. THE Map_Interface SHALL handle and display error states for failed uploads or processing

### Requirement 6: File Management and Cleanup

**User Story:** As a user, I want uploaded files to be properly managed, so that the system remains performant and secure.

#### Acceptance Criteria

1. THE Upload_Component SHALL limit file uploads to a maximum size of 10MB
2. THE GPX_Service SHALL validate file content before processing
3. THE Upload_Component SHALL clear previous upload state when a new file is selected
4. THE Map_Interface SHALL provide a way to clear uploaded routes and reset the interface
5. THE Upload_Component SHALL handle network errors gracefully with appropriate user feedback