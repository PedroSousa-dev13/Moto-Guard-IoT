import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OnboardingGuard from "./OnboardingGuard";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock motorcyclesAPI
const mockGetAll = vi.fn();
vi.mock("../../services/api", () => ({
  motorcyclesAPI: { getAll: () => mockGetAll() },
}));

// Render the guard as a layout route (the way App.tsx uses it)
function renderGuard(path: string, user: { email: string } | null = null) {
  mockUseAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <OnboardingGuard>
              {/* children prop used in tests */}
            </OnboardingGuard>
          }
        >
          <Route path="/dashboard" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/garage" element={<div>Garage Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OnboardingGuard — admin bypass", () => {
  it("renders children immediately for admin without API call", async () => {
    mockUseAuth.mockReturnValue({ user: { email: "admin@admin.com" } });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<OnboardingGuard />}>
            <Route path="/dashboard" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(mockGetAll).not.toHaveBeenCalled();
  });
});

describe("OnboardingGuard — regular user with motas", () => {
  it("shows loading spinner initially", () => {
    mockGetAll.mockReturnValue(new Promise(() => {})); // never resolves
    renderGuard("/dashboard", { email: "user@example.com" });
    expect(screen.getByText("A verificar garagem...")).toBeInTheDocument();
  });

  it("renders children when user has at least 1 mota", async () => {
    mockGetAll.mockResolvedValue({ data: [{ id: "1", name: "Bandit" }] });
    renderGuard("/dashboard", { email: "user@example.com" });
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("redirects to /garage when user has 0 motas", async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    renderGuard("/dashboard", { email: "user@example.com" });
    await waitFor(() => {
      expect(screen.getByText("Garage Page")).toBeInTheDocument();
    });
  });

  it("does not re-fetch on subsequent navigations (caches result)", async () => {
    mockGetAll.mockResolvedValue({ data: [{ id: "1", name: "Bandit" }] });
    mockUseAuth.mockReturnValue({ user: { email: "user@example.com" } });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<OnboardingGuard />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/trips" element={<div>Trips</div>} />
          </Route>
          <Route path="/garage" element={<div>Garage Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText("Dashboard"));
    // API should have been called exactly once
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingGuard — API error", () => {
  it("shows error state with retry button when API fails", async () => {
    mockGetAll.mockRejectedValue(new Error("Network error"));
    renderGuard("/dashboard", { email: "user@example.com" });
    await waitFor(() => {
      expect(screen.getByText("Erro de verificação")).toBeInTheDocument();
      expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    });
  });

  it("shows the error message text", async () => {
    mockGetAll.mockRejectedValue(new Error("fail"));
    renderGuard("/dashboard", { email: "user@example.com" });
    await waitFor(() => {
      expect(screen.getByText("Não foi possível verificar as tuas motas.")).toBeInTheDocument();
    });
  });
});
