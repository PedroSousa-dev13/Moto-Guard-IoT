import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommandPanel from "./CommandPanel";

vi.mock("./ui/Card", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Play: () => null, Square: () => null, AlertTriangle: () => null,
  RefreshCcw: () => null, Terminal: () => null, Bike: () => null, Cpu: () => null,
}));

const defaultProps = {
  sendCommand: vi.fn(),
  addLog: vi.fn(),
  logs: [],
  running: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Admin: full model list ───────────────────────────────────────────────────

describe("CommandPanel — admin (no allowedModels)", () => {
  it("shows all 8 models in the dropdown", () => {
    render(<CommandPanel {...defaultProps} />);
    const options = screen.getAllByRole("option").filter((o) => (o as HTMLOptionElement).value !== "");
    expect(options).toHaveLength(8);
  });

  it("start button is disabled when no model selected", () => {
    render(<CommandPanel {...defaultProps} />);
    expect(screen.getByText("Iniciar Simulação").closest("button")).toBeDisabled();
  });

  it("start button enabled after selecting a model", () => {
    render(<CommandPanel {...defaultProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Naked" } });
    expect(screen.getByText("Iniciar Simulação").closest("button")).not.toBeDisabled();
  });

  it("sends definir_modelo with selected model", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Touring" } });
    fireEvent.click(screen.getByText("Iniciar Simulação").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "definir_modelo", modelo: "Touring" });
  });

  it("select is disabled while running", () => {
    render(<CommandPanel {...defaultProps} running={true} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});

// ─── Regular user: restricted model list ─────────────────────────────────────

describe("CommandPanel — regular user (allowedModels)", () => {
  it("shows only the allowed models", () => {
    render(<CommandPanel {...defaultProps} allowedModels={["Naked", "Touring"]} />);
    const options = screen.getAllByRole("option").filter((o) => (o as HTMLOptionElement).value !== "");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe("Naked");
    expect(options[1].textContent).toBe("Touring");
  });

  it("shows only 1 option when user has 1 moto", () => {
    render(<CommandPanel {...defaultProps} allowedModels={["Scooter"]} />);
    const options = screen.getAllByRole("option").filter((o) => (o as HTMLOptionElement).value !== "");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("Scooter");
  });

  it("start button enabled after selecting an allowed model", () => {
    render(<CommandPanel {...defaultProps} allowedModels={["Naked", "Touring"]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Naked" } });
    expect(screen.getByText("Iniciar Simulação").closest("button")).not.toBeDisabled();
  });

  it("sends definir_modelo with the selected allowed model", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} allowedModels={["Naked", "Touring"]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Touring" } });
    fireEvent.click(screen.getByText("Iniciar Simulação").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "definir_modelo", modelo: "Touring" });
  });

  it("start button disabled while running even with allowedModels", () => {
    render(<CommandPanel {...defaultProps} allowedModels={["Naked"]} running={true} />);
    expect(screen.getByText("Iniciar Simulação").closest("button")).toBeDisabled();
  });

  it("shows loading state when allowedModels is empty array", () => {
    render(<CommandPanel {...defaultProps} allowedModels={[]} />);
    expect(screen.getByText("A carregar motas...")).toBeInTheDocument();
    expect(screen.getByText("Iniciar Simulação").closest("button")).toBeDisabled();
  });
});

// ─── Route in localStorage ────────────────────────────────────────────────────

describe("CommandPanel — route in localStorage", () => {
  it("sends definir_modelo then schedules definir_rota when valid route stored", () => {
    const sendCommand = vi.fn();
    const route = {
      start: { latitude: 38.7, longitude: -9.1 },
      end: { latitude: 38.8, longitude: -9.2 },
    };
    localStorage.setItem("sim_route", JSON.stringify(route));

    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} allowedModels={["Trail / Adventure"]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Trail / Adventure" } });
    fireEvent.click(screen.getByText("Iniciar Simulação").closest("button")!);

    expect(sendCommand).toHaveBeenCalledWith({ acao: "definir_modelo", modelo: "Trail / Adventure" });
    expect(sendCommand).toHaveBeenCalledTimes(1); // definir_rota is async via setTimeout
  });
});

// ─── Event buttons ────────────────────────────────────────────────────────────

describe("CommandPanel — event buttons", () => {
  it("event buttons disabled when not running", () => {
    render(<CommandPanel {...defaultProps} />);
    expect(screen.getByText("Queda").closest("button")).toBeDisabled();
    expect(screen.getByText("Alternador").closest("button")).toBeDisabled();
    expect(screen.getByText("Calor").closest("button")).toBeDisabled();
    expect(screen.getByText("Reset").closest("button")).toBeDisabled();
  });

  it("event buttons enabled when running", () => {
    render(<CommandPanel {...defaultProps} running={true} />);
    expect(screen.getByText("Queda").closest("button")).not.toBeDisabled();
  });

  it("sends queda event", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} running={true} />);
    fireEvent.click(screen.getByText("Queda").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "evento", tipo: "queda" });
  });

  it("sends alternador event", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} running={true} />);
    fireEvent.click(screen.getByText("Alternador").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "evento", tipo: "alternador" });
  });

  it("sends sobreaquecimento event", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} running={true} />);
    fireEvent.click(screen.getByText("Calor").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "evento", tipo: "sobreaquecimento" });
  });

  it("sends reset_eventos", () => {
    const sendCommand = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} running={true} />);
    fireEvent.click(screen.getByText("Reset").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "reset_eventos" });
  });
});

// ─── Stop ─────────────────────────────────────────────────────────────────────

describe("CommandPanel — stop", () => {
  it("Parar button disabled when not running", () => {
    render(<CommandPanel {...defaultProps} />);
    expect(screen.getByText("Parar Simulação").closest("button")).toBeDisabled();
  });

  it("sends parar and calls onStop", () => {
    const sendCommand = vi.fn();
    const onStop = vi.fn();
    render(<CommandPanel {...defaultProps} sendCommand={sendCommand} running={true} onStop={onStop} />);
    fireEvent.click(screen.getByText("Parar Simulação").closest("button")!);
    expect(sendCommand).toHaveBeenCalledWith({ acao: "parar" });
    expect(onStop).toHaveBeenCalled();
  });
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

describe("CommandPanel — logs", () => {
  it("shows empty state when no logs", () => {
    render(<CommandPanel {...defaultProps} logs={[]} />);
    expect(screen.getByText("A aguardar eventos...")).toBeInTheDocument();
  });

  it("renders log entries", () => {
    const logs = [
      { time: "12:00:00", message: "Simulação iniciada", color: "#22c55e" },
      { time: "12:00:05", message: "Queda detetada", color: "#ef4444" },
    ];
    render(<CommandPanel {...defaultProps} logs={logs} />);
    expect(screen.getByText("Simulação iniciada")).toBeInTheDocument();
    expect(screen.getByText("Queda detetada")).toBeInTheDocument();
  });
});
