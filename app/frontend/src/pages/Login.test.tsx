import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Capture props passed to LoginSidebar
let capturedProps: Record<string, any> = {};
vi.mock("../components/auth/LoginSidebar", () => ({
  default: (props: Record<string, any>) => {
    capturedProps = props;
    return <div data-testid="login-sidebar">LoginSidebar</div>;
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import Login from "./Login";

function renderLogin(path = "/login", state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="*" element={<Login />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/garage" element={<div>Garage</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedProps = {};
  mockUseAuth.mockReturnValue({ isAuthenticated: false });
});

describe("Login page", () => {
  it("renders LoginSidebar when not authenticated", () => {
    renderLogin();
    expect(screen.getByTestId("login-sidebar")).toBeInTheDocument();
  });

  it("redirects to /dashboard when already authenticated with no prior location", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("redirects to prior location when already authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/trips" } } }]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/trips" element={<div>Trips</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Trips")).toBeInTheDocument();
  });

  it("onSuccess navigates to /dashboard by default", () => {
    renderLogin();
    capturedProps.onSuccess?.();
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("onSuccess navigates to prior location when state.from is set", () => {
    renderLogin("/login", { from: { pathname: "/analytics" } });
    capturedProps.onSuccess?.();
    expect(mockNavigate).toHaveBeenCalledWith("/analytics", { replace: true });
  });

  it("onRegisterSuccess always navigates to /garage", () => {
    renderLogin();
    capturedProps.onRegisterSuccess?.();
    expect(mockNavigate).toHaveBeenCalledWith("/garage", { replace: true });
  });

  it("onRegisterSuccess navigates to /garage even when state.from is set", () => {
    renderLogin("/login", { from: { pathname: "/analytics" } });
    capturedProps.onRegisterSuccess?.();
    expect(mockNavigate).toHaveBeenCalledWith("/garage", { replace: true });
  });

  it("passes defaultMode=login by default", () => {
    renderLogin("/login");
    expect(capturedProps.defaultMode).toBe("login");
  });

  it("passes defaultMode=register when ?mode=register", () => {
    render(
      <MemoryRouter initialEntries={["/login?mode=register"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );
    expect(capturedProps.defaultMode).toBe("register");
  });
});
