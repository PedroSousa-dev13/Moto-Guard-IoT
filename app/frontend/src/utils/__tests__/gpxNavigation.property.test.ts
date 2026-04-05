// Feature: gpx-upload-ui, Property 10: Navigation Behavior
// Validates: Requirements 4.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pure function that determines whether navigation should occur after a send attempt.
 * Navigation should happen only when a route exists AND was successfully sent.
 */
export function shouldNavigateAfterSend(routeSent: boolean, hasRoute: boolean): boolean {
  return routeSent && hasRoute;
}

/**
 * Returns the navigation target for post-send navigation.
 */
export function getNavigationTarget(): string {
  return '/simulator-contexts';
}

describe('Property 10: Navigation Behavior', () => {
  /**
   * **Validates: Requirements 4.5**
   *
   * For any valid route (hasRoute=true) that was successfully sent (routeSent=true),
   * shouldNavigateAfterSend must return true.
   */
  it('returns true when route exists and was successfully sent', () => {
    fc.assert(
      fc.property(fc.constant(true), fc.constant(true), (routeSent, hasRoute) => {
        expect(shouldNavigateAfterSend(routeSent, hasRoute)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * For any case where route is null/missing (hasRoute=false),
   * shouldNavigateAfterSend must return false regardless of routeSent.
   */
  it('returns false when route is missing (hasRoute=false)', () => {
    fc.assert(
      fc.property(fc.boolean(), (routeSent) => {
        expect(shouldNavigateAfterSend(routeSent, false)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * For any case where route was not sent yet (routeSent=false),
   * shouldNavigateAfterSend must return false regardless of hasRoute.
   */
  it('returns false when route was not sent (routeSent=false)', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasRoute) => {
        expect(shouldNavigateAfterSend(false, hasRoute)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * getNavigationTarget always returns "/simulator-contexts" regardless of any input.
   */
  it('getNavigationTarget always returns "/simulator-contexts"', () => {
    fc.assert(
      fc.property(fc.anything(), (_input) => {
        expect(getNavigationTarget()).toBe('/simulator-contexts');
      }),
      { numRuns: 100 }
    );
  });
});
