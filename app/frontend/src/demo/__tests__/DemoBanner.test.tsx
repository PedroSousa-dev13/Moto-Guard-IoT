import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DemoBanner from "../DemoBanner";

// Mock useDemoContext
const mockExitDemoMode = vi.fn();
const mockUseDemoContext = vi.fn();

vi.mock("../DemoContext", () => ({
  useDemoContext: () => mockUseDemoContext(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DemoBanner — rendering", () => {
  it("returns null when isDemoMode is false", () => {
    mockUseDemoContext.mockReturnValue({ isDemoMode: false, exitDemoMode: mockExitDemoMode });
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with 'Modo Demo — dados simulados' when isDemoMode is true", () => {
    mockUseDemoContext.mockReturnValue({ isDemoMode: true, exitDemoMode: mockExitDemoMode });
    render(<DemoBanner />);
    expect(screen.getByText("Modo Demo — dados simulados")).toBeInTheDocument();
  });

  it("renders 'Sair do Modo Demo' button when isDemoMode is true", () => {
    mockUseDemoContext.mockReturnValue({ isDemoMode: true, exitDemoMode: mockExitDemoMode });
    render(<DemoBanner />);
    expect(screen.getByRole("button", { name: "Sair do Modo Demo" })).toBeInTheDocument();
  });
});

describe("DemoBanner — interaction", () => {
  it("clicking 'Sair do Modo Demo' calls exitDemoMode()", async () => {
    mockUseDemoContext.mockReturnValue({ isDemoMode: true, exitDemoMode: mockExitDemoMode });
    render(<DemoBanner />);
    const button = screen.getByRole("button", { name: "Sair do Modo Demo" });
    await userEvent.click(button);
    expect(mockExitDemoMode).toHaveBeenCalledTimes(1);
  });
});
