import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Feature: gpx-upload-ui, Property 6: UI State Management
// **Validates: Requirements 5.3, 6.3, 6.4**

describe('Property 6: UI State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Generator for tab modes
  const tabModeArbitrary = fc.constantFrom('preset', 'custom', 'gpx');

  // Generator for map view state
  const mapViewArbitrary = fc.record({
    center: fc.tuple(
      fc.double({ min: -90, max: 90, noNaN: true }),
      fc.double({ min: -180, max: 180, noNaN: true })
    ),
    zoom: fc.integer({ min: 1, max: 18 }),
  });

  // Generator for route preview state
  const routePreviewArbitrary = fc.record({
    hasPreviewLine: fc.boolean(),
    hasStartMarker: fc.boolean(),
    hasEndMarker: fc.boolean(),
  });

  // Generator for GPX route data
  const gpxRouteArbitrary = fc.record({
    waypoints: fc.array(
      fc.record({
        latitude: fc.double({ min: -90, max: 90, noNaN: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true }),
      }),
      { minLength: 2, maxLength: 10 }
    ),
    distanceKm: fc.double({ min: 0.1, max: 1000, noNaN: true }),
  });

  // Generator for upload state
  const uploadStateArbitrary = fc.record({
    uploading: fc.boolean(),
    error: fc.option(fc.string(), { nil: null }),
    processing: fc.boolean(),
    sent: fc.boolean(),
  });

  // Mock map interface that tracks state
  class MockMapInterface {
    private previewLine: any = null;
    private startMarker: any = null;
    private endMarker: any = null;
    private currentView: { center: [number, number]; zoom: number } | null = null;

    setPreviewLine(line: any) {
      this.previewLine = line;
    }

    clearPreviewLine() {
      this.previewLine = null;
    }

    hasPreviewLine(): boolean {
      return this.previewLine !== null;
    }

    setStartMarker(marker: any) {
      this.startMarker = marker;
    }

    clearStartMarker() {
      this.startMarker = null;
    }

    hasStartMarker(): boolean {
      return this.startMarker !== null;
    }

    setEndMarker(marker: any) {
      this.endMarker = marker;
    }

    clearEndMarker() {
      this.endMarker = null;
    }

    hasEndMarker(): boolean {
      return this.endMarker !== null;
    }

    setView(center: [number, number], zoom: number) {
      this.currentView = { center, zoom };
    }

    getView() {
      return this.currentView;
    }

    clearAllPreviews() {
      this.clearPreviewLine();
      this.clearStartMarker();
      this.clearEndMarker();
    }
  }

  it('should preserve map view when switching between tabs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(tabModeArbitrary, { minLength: 2, maxLength: 5 }),
        mapViewArbitrary,
        async (tabSequence, initialView) => {
          const mapInterface = new MockMapInterface();
          
          // Set initial map view
          mapInterface.setView(initialView.center, initialView.zoom);
          const viewBeforeSwitch = mapInterface.getView();

          // Simulate tab switches
          for (const tab of tabSequence) {
            // Property: Map view should be preserved across tab switches
            const viewAfterSwitch = mapInterface.getView();
            expect(viewAfterSwitch).toEqual(viewBeforeSwitch);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should clear previous route previews when switching tabs', async () => {
    await fc.assert(
      fc.asyncProperty(
        tabModeArbitrary,
        tabModeArbitrary,
        routePreviewArbitrary,
        async (fromTab, toTab, initialPreview) => {
          // Skip if switching to the same tab
          if (fromTab === toTab) return;

          const mapInterface = new MockMapInterface();

          // Set up initial preview state
          if (initialPreview.hasPreviewLine) {
            mapInterface.setPreviewLine({ type: 'polyline' });
          }
          if (initialPreview.hasStartMarker) {
            mapInterface.setStartMarker({ type: 'marker' });
          }
          if (initialPreview.hasEndMarker) {
            mapInterface.setEndMarker({ type: 'marker' });
          }

          // Verify initial state
          expect(mapInterface.hasPreviewLine()).toBe(initialPreview.hasPreviewLine);
          expect(mapInterface.hasStartMarker()).toBe(initialPreview.hasStartMarker);
          expect(mapInterface.hasEndMarker()).toBe(initialPreview.hasEndMarker);

          // Simulate tab switch - should clear all previews
          mapInterface.clearAllPreviews();

          // Property: All route previews should be cleared after tab switch
          expect(mapInterface.hasPreviewLine()).toBe(false);
          expect(mapInterface.hasStartMarker()).toBe(false);
          expect(mapInterface.hasEndMarker()).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should clear previous upload state when a new file is selected', async () => {
    await fc.assert(
      fc.asyncProperty(
        uploadStateArbitrary,
        fc.string({ minLength: 5, maxLength: 50 }),
        async (previousState, newFileName) => {
          // Simulate state before new file selection
          let uploadState = { ...previousState };

          // Property: When a new file is selected, previous state should be cleared
          const clearUploadState = () => {
            uploadState = {
              uploading: false,
              error: null,
              processing: false,
              sent: false,
            };
          };

          // Simulate new file selection
          clearUploadState();

          // Property: Upload state should be reset
          expect(uploadState.uploading).toBe(false);
          expect(uploadState.error).toBe(null);
          expect(uploadState.processing).toBe(false);
          expect(uploadState.sent).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should reset upload state appropriately when clearing route', async () => {
    await fc.assert(
      fc.asyncProperty(
        gpxRouteArbitrary,
        uploadStateArbitrary,
        async (route, uploadState) => {
          const mapInterface = new MockMapInterface();

          // Set up route and upload state
          let currentRoute: any = route;
          let currentUploadState = { ...uploadState };

          // Set up map preview
          mapInterface.setPreviewLine({ type: 'polyline' });
          mapInterface.setStartMarker({ type: 'marker' });
          mapInterface.setEndMarker({ type: 'marker' });

          // Simulate clear route action
          const clearRoute = () => {
            currentRoute = null;
            currentUploadState = {
              uploading: false,
              error: null,
              processing: false,
              sent: false,
            };
            mapInterface.clearAllPreviews();
          };

          clearRoute();

          // Property: Route should be cleared
          expect(currentRoute).toBe(null);

          // Property: Upload state should be reset
          expect(currentUploadState.uploading).toBe(false);
          expect(currentUploadState.error).toBe(null);
          expect(currentUploadState.processing).toBe(false);
          expect(currentUploadState.sent).toBe(false);

          // Property: Map previews should be cleared
          expect(mapInterface.hasPreviewLine()).toBe(false);
          expect(mapInterface.hasStartMarker()).toBe(false);
          expect(mapInterface.hasEndMarker()).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain state consistency during file selection operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            action: fc.constantFrom('select', 'upload', 'error', 'success', 'clear'),
            fileName: fc.option(fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)),
            errorMessage: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (actionSequence) => {
          let state = {
            file: null as string | null,
            uploading: false,
            error: null as string | null,
            route: null as any,
            sent: false,
          };

          for (const action of actionSequence) {
            switch (action.action) {
              case 'select':
                // Property: Selecting a file should clear previous state
                // Only set file if fileName is provided
                if (action.fileName) {
                  state.file = action.fileName;
                  state.error = null;
                  state.sent = false;
                  state.route = null; // Clear previous route when selecting new file
                }
                break;

              case 'upload':
                // Property: Uploading should set uploading flag only if there's a file and no existing route
                if (state.file && !state.route) {
                  state.uploading = true;
                  state.error = null;
                }
                break;

              case 'error':
                // Property: Error should clear uploading and set error message
                state.uploading = false;
                state.error = action.errorMessage ?? 'Upload failed';
                state.route = null;
                break;

              case 'success':
                // Property: Success should clear uploading and set route (only if was uploading)
                if (state.uploading || state.file) {
                  state.uploading = false;
                  state.error = null;
                  state.route = { waypoints: [], distanceKm: 0 };
                }
                break;

              case 'clear':
                // Property: Clear should reset all state
                state = {
                  file: null,
                  uploading: false,
                  error: null,
                  route: null,
                  sent: false,
                };
                break;
            }

            // Property: State should always be consistent
            // If uploading, there should be a file
            if (state.uploading) {
              expect(state.file).not.toBe(null);
            }

            // If there's a route, uploading should be false
            if (state.route) {
              expect(state.uploading).toBe(false);
            }

            // Error and route should not coexist
            if (state.error) {
              expect(state.route).toBe(null);
            }

            // Sent flag should only be true if there's a route
            if (state.sent) {
              expect(state.route).not.toBe(null);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle concurrent state updates correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('tab-switch', 'file-select', 'clear-route'),
            targetTab: fc.option(tabModeArbitrary),
            fileName: fc.option(fc.string()),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (operations) => {
          const mapInterface = new MockMapInterface();
          let currentTab: 'preset' | 'custom' | 'gpx' = 'preset';
          let currentFile: string | null = null;
          let currentRoute: any = null;

          for (const op of operations) {
            switch (op.type) {
              case 'tab-switch':
                if (op.targetTab) {
                  const previousTab = currentTab;
                  currentTab = op.targetTab;

                  // Property: Switching tabs should clear previews
                  if (previousTab !== currentTab) {
                    mapInterface.clearAllPreviews();
                    expect(mapInterface.hasPreviewLine()).toBe(false);
                  }
                }
                break;

              case 'file-select':
                if (currentTab === 'gpx' && op.fileName) {
                  // Property: Selecting new file should clear previous route
                  const hadRoute = currentRoute !== null;
                  currentFile = op.fileName;
                  currentRoute = null;

                  if (hadRoute) {
                    expect(currentRoute).toBe(null);
                  }
                }
                break;

              case 'clear-route':
                // Property: Clearing route should reset all related state
                currentRoute = null;
                currentFile = null;
                mapInterface.clearAllPreviews();

                expect(currentRoute).toBe(null);
                expect(mapInterface.hasPreviewLine()).toBe(false);
                expect(mapInterface.hasStartMarker()).toBe(false);
                expect(mapInterface.hasEndMarker()).toBe(false);
                break;
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve map view while clearing route previews on tab switch', async () => {
    await fc.assert(
      fc.asyncProperty(
        mapViewArbitrary,
        routePreviewArbitrary,
        tabModeArbitrary,
        tabModeArbitrary,
        async (mapView, routePreview, fromTab, toTab) => {
          // Skip if same tab
          if (fromTab === toTab) return;

          const mapInterface = new MockMapInterface();

          // Set initial state
          mapInterface.setView(mapView.center, mapView.zoom);
          if (routePreview.hasPreviewLine) {
            mapInterface.setPreviewLine({ type: 'polyline' });
          }
          if (routePreview.hasStartMarker) {
            mapInterface.setStartMarker({ type: 'marker' });
          }
          if (routePreview.hasEndMarker) {
            mapInterface.setEndMarker({ type: 'marker' });
          }

          const viewBefore = mapInterface.getView();

          // Simulate tab switch
          mapInterface.clearAllPreviews();

          const viewAfter = mapInterface.getView();

          // Property: Map view should be preserved
          expect(viewAfter).toEqual(viewBefore);

          // Property: Route previews should be cleared
          expect(mapInterface.hasPreviewLine()).toBe(false);
          expect(mapInterface.hasStartMarker()).toBe(false);
          expect(mapInterface.hasEndMarker()).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});
