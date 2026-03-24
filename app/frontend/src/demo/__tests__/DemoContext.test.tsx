import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as fc from "fast-check";
import { DemoProvider, useDemoContext } from "../DemoContext";

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock the API interceptor so it doesn't interfere
vi.mock("../demoAPIInterceptor", () => ({
  setupDemoInterceptor: () => () => {},
}));

function TestConsumer() {
  const ctx = useDemoContext();
  return (
    <div>
      <span data-testid="isDemoMode">{String(ctx.isDemoMode)}</span>
      <span data-testid="demoUserEmail">{ctx.demoUser.email}</span>
      <span data-testid="demoUserName">{ctx.demoUser.name}</span>
      <span data-testid="demoUserId">{ctx.demoUser.id}</span>
      <button onClick={ctx.activateDemo}>activate</button>
      <button onClick={ctx.exitDemoMode}>exit</button>
    </div>
  );
}

function renderWithProvider(initialSessionValue?: string) {
  if (initialSessionValue !== undefined) {
    sessionStorage.setItem("demo_mode", initialSessionValue);
  }
  return render(
    <MemoryRouter>
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("DemoContext — activation", () => {
  it("activateDemo() sets sessionStorage demo_mode=true and isDemoMode=true", async () => {
    renderWithProvider();
    expect(screen.getByTestId("isDemoMode").textContent).toBe("false");

    await act(async () => {
      screen.getByText("activate").click();
    });

    expect(sessionStorage.getItem("demo_mode")).toBe("true");
    expect(screen.getByTestId("isDemoMode").textContent).toBe("true");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("exitDemoMode() removes sessionStorage demo_mode and sets isDemoMode=false", async () => {
    sessionStorage.setItem("demo_mode", "true");
    renderWithProvider();

    await act(async () => {
      screen.getByText("exit").click();
    });

    expect(sessionStorage.getItem("demo_mode")).toBeNull();
    expect(screen.getByTestId("isDemoMode").textContent).toBe("false");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("isDemoMode initializes to true if sessionStorage demo_mode === 'true' on mount", () => {
    renderWithProvider("true");
    expect(screen.getByTestId("isDemoMode").textContent).toBe("true");
  });

  it("isDemoMode initializes to false if sessionStorage is empty", () => {
    renderWithProvider();
    expect(screen.getByTestId("isDemoMode").textContent).toBe("false");
  });
});

describe("DemoContext — demoUser", () => {
  it("demoUser has correct email, name and id", () => {
    renderWithProvider();
    expect(screen.getByTestId("demoUserEmail").textContent).toBe("demo@motoguard.demo");
    expect(screen.getByTestId("demoUserName").textContent).toBe("Demo User");
    expect(screen.getByTestId("demoUserId").textContent).toBe("demo-user-001");
  });
});

describe("DemoContext — useDemoContext outside provider", () => {
  it("throws when used outside DemoProvider", () => {
    // Suppress React error boundary noise
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function BadConsumer() {
      useDemoContext();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useDemoContext must be used within DemoProvider"
    );
    consoleSpy.mockRestore();
  });
});

describe("DemoContext — Property 1: sessionStorage reflete o estado do Demo Mode", () => {
  // Feature: demo-mode, Property 1: sessionStorage reflete o estado do Demo Mode
  it("sessionStorage always reflects isDemoMode state after activate/deactivate", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (activate) => {
        sessionStorage.clear();
        const { unmount } = render(
          <MemoryRouter>
            <DemoProvider>
              <TestConsumer />
            </DemoProvider>
          </MemoryRouter>
        );

        await act(async () => {
          if (activate) {
            screen.getByText("activate").click();
          } else {
            screen.getByText("exit").click();
          }
        });

        if (activate) {
          expect(sessionStorage.getItem("demo_mode")).toBe("true");
        } else {
          expect(sessionStorage.getItem("demo_mode")).toBeNull();
        }

        unmount();
        sessionStorage.clear();
      }),
      { numRuns: 100 }
    );
  });
});
