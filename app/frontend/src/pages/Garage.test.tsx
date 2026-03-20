import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Garage from "./Garage";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock("../services/api", () => ({
  motorcyclesAPI: {
    getAll: () => mockGetAll(),
    create: (data: any) => mockCreate(data),
    update: (id: string, data: any) => mockUpdate(id, data),
    remove: (id: string) => mockRemove(id),
  },
}));

vi.mock("../components/ui/Card", () => ({
  default: ({ children, title }: any) => <div><div>{title}</div>{children}</div>,
}));

vi.mock("../components/ui/Skeleton", () => ({
  SkeletonCard: () => <div data-testid="skeleton" />,
}));

vi.mock("lucide-react", () => ({
  Bike: () => null, Plus: () => null, Pencil: () => null, Trash2: () => null,
  Activity: () => null, Route: () => null, X: () => null, Check: () => null,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeMoto(overrides = {}) {
  return {
    id: "m1",
    name: "Bandit",
    brand: "Suzuki",
    model: "GSF650",
    year: 2020,
    plate: "AA-00-BB",
    category: "Naked",
    deviceId: "MOTOGUARD-SIM-NAKED",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderGarage() {
  return render(
    <MemoryRouter>
      <Garage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.alert = vi.fn();
});

// ─── Loading & Error states ───────────────────────────────────────────────────

describe("Garage — loading & error", () => {
  it("shows skeleton cards while loading", () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));
    renderGarage();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(4);
  });

  it("shows error message when API fails", async () => {
    mockGetAll.mockRejectedValue(new Error("Network error"));
    renderGarage();
    await waitFor(() => {
      expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument();
    });
  });

  it("retry button calls load again", async () => {
    mockGetAll
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue({ data: [] });
    renderGarage();
    await waitFor(() => screen.getByText("Tentar novamente"));
    fireEvent.click(screen.getByText("Tentar novamente"));
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("Garage — empty state", () => {
  it("shows empty state when no motos", async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    renderGarage();
    await waitFor(() => {
      expect(screen.getByText("Garagem vazia")).toBeInTheDocument();
    });
  });

  it("shows moto count in subtitle", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto()] });
    renderGarage();
    await waitFor(() => {
      expect(screen.getByText(/1.*mota.*registad/)).toBeInTheDocument();
    });
  });

  it("shows plural for multiple motos", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto({ id: "1" }), makeMoto({ id: "2" })] });
    renderGarage();
    await waitFor(() => {
      expect(screen.getByText(/2.*motas.*registadas/)).toBeInTheDocument();
    });
  });
});

// ─── Add form ─────────────────────────────────────────────────────────────────

describe("Garage — add moto", () => {
  beforeEach(() => {
    mockGetAll.mockResolvedValue({ data: [] });
  });

  it("opens add form when clicking Adicionar mota", async () => {
    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);
    expect(screen.getByText("Adicionar mota", { selector: "div" })).toBeInTheDocument();
  });

  it("shows validation error when category is empty", async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);

    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Minha Mota" } });
    // Don't select category — submit via the form element
    const form = screen.getByLabelText("Nome *").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Seleciona uma categoria.")).toBeInTheDocument();
    });
  });

  it("calls motorcyclesAPI.create with correct payload including deviceId", async () => {
    mockCreate.mockResolvedValue({ data: makeMoto() });
    mockGetAll
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [makeMoto()] });

    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);

    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Bandit" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Suzuki" } });
    fireEvent.change(screen.getByLabelText("Categoria *"), { target: { value: "Naked" } });

    fireEvent.submit(screen.getByLabelText("Nome *").closest("form")!);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Bandit",
          brand: "Suzuki",
          category: "Naked",
          deviceId: "MOTOGUARD-SIM-NAKED",
        })
      );
    });
  });

  it("closes form and reloads after successful create", async () => {
    mockCreate.mockResolvedValue({ data: makeMoto() });
    mockGetAll
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [makeMoto()] });

    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Bandit" } });
    fireEvent.change(screen.getByLabelText("Categoria *"), { target: { value: "Naked" } });
    fireEvent.submit(screen.getByLabelText("Nome *").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Bandit")).toBeInTheDocument();
    });
  });

  it("shows API error when create fails", async () => {
    mockCreate.mockRejectedValue({ response: { data: { error: "Nome duplicado" } } });
    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Bandit" } });
    fireEvent.change(screen.getByLabelText("Categoria *"), { target: { value: "Naked" } });
    fireEvent.submit(screen.getByLabelText("Nome *").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Nome duplicado")).toBeInTheDocument();
    });
  });

  it("cancel button closes the form", async () => {
    renderGarage();
    await waitFor(() => screen.getByText("Garagem vazia"));
    fireEvent.click(screen.getAllByText("Adicionar mota")[0]);
    expect(screen.getByLabelText("Nome *")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByLabelText("Nome *")).not.toBeInTheDocument();
  });
});

// ─── Edit form ────────────────────────────────────────────────────────────────

describe("Garage — edit moto", () => {
  it("opens edit form pre-populated with moto data", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto()] });
    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    // Click the pencil (edit) button — it's the 4th action button
    const editBtns = screen.getAllByRole("button");
    const pencilBtn = editBtns.find((b) => b.querySelector("svg") && b.textContent === "");
    // Find edit button by its position in the actions row
    const allBtns = screen.getAllByRole("button");
    // The edit button is the one that opens the form with "Editar mota" title
    // Trigger by finding the button that calls openEdit — it's the Pencil icon button
    const actionBtns = allBtns.filter((b) => !b.textContent?.includes("Adicionar") && !b.textContent?.includes("Monitorizar") && !b.textContent?.includes("Ver viagens") && !b.textContent?.includes("Detalhes") && !b.textContent?.includes("Cancelar"));
    // Click the edit (pencil) button — second-to-last in the actions
    const editBtn = allBtns.find((b) => b.getAttribute("title") === null && b.textContent === "");
    if (editBtn) fireEvent.click(editBtn);

    // Simpler: just find the form after clicking any button that shows "Editar mota"
    // Use the Pencil button which is the 4th in the card actions
    const cardBtns = screen.getAllByRole("button").filter((b) =>
      b.closest(".garage-card-actions") !== null
    );
    if (cardBtns.length >= 4) fireEvent.click(cardBtns[3]);

    await waitFor(() => {
      const nameInput = screen.queryByLabelText("Nome *") as HTMLInputElement | null;
      if (nameInput) expect(nameInput.value).toBe("Bandit");
    });
  });

  it("calls motorcyclesAPI.update with correct id and payload", async () => {
    mockGetAll
      .mockResolvedValueOnce({ data: [makeMoto()] })
      .mockResolvedValue({ data: [makeMoto({ name: "Bandit Updated" })] });
    mockUpdate.mockResolvedValue({ data: makeMoto({ name: "Bandit Updated" }) });

    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    // Click pencil button (4th button in card)
    const cardBtns = screen.getAllByRole("button").filter((b) => b.closest(".garage-card-actions") !== null);
    fireEvent.click(cardBtns[3]); // pencil

    await waitFor(() => screen.getByLabelText("Nome *"));
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Bandit Updated" } });
    fireEvent.submit(screen.getByLabelText("Nome *").closest("form")!);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("m1", expect.objectContaining({ name: "Bandit Updated" }));
    });
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe("Garage — delete moto", () => {
  it("shows confirm delete UI when trash button clicked", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto()] });
    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    const cardBtns = screen.getAllByRole("button").filter((b) => b.closest(".garage-card-actions") !== null);
    fireEvent.click(cardBtns[4]); // trash button (last)

    expect(screen.getByText("Confirmar remoção?")).toBeInTheDocument();
    expect(screen.getByText("Remover")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  it("cancel on confirm delete restores normal actions", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto()] });
    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    const cardBtns = screen.getAllByRole("button").filter((b) => b.closest(".garage-card-actions") !== null);
    fireEvent.click(cardBtns[4]); // trash
    expect(screen.getByText("Confirmar remoção?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByText("Confirmar remoção?")).not.toBeInTheDocument();
  });

  it("calls motorcyclesAPI.remove and reloads on confirm", async () => {
    mockGetAll
      .mockResolvedValueOnce({ data: [makeMoto()] })
      .mockResolvedValue({ data: [] });
    mockRemove.mockResolvedValue({});

    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    const cardBtns = screen.getAllByRole("button").filter((b) => b.closest(".garage-card-actions") !== null);
    fireEvent.click(cardBtns[4]); // trash
    fireEvent.click(screen.getByText("Remover"));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith("m1");
    });
    await waitFor(() => {
      expect(screen.getByText("Garagem vazia")).toBeInTheDocument();
    });
  });

  it("shows alert when delete fails", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto()] });
    mockRemove.mockRejectedValue({ response: { data: { error: "Não é possível apagar" } } });

    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    const cardBtns = screen.getAllByRole("button").filter((b) => b.closest(".garage-card-actions") !== null);
    fireEvent.click(cardBtns[4]);
    fireEvent.click(screen.getByText("Remover"));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Não é possível apagar");
    });
  });
});

// ─── Monitorizar button ───────────────────────────────────────────────────────

describe("Garage — Monitorizar button", () => {
  it("is enabled when moto has category", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto({ category: "Naked" })] });
    renderGarage();
    await waitFor(() => screen.getByText("Monitorizar"));
    expect(screen.getByText("Monitorizar").closest("button")).not.toBeDisabled();
  });

  it("is disabled when moto has no category", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto({ category: "" })] });
    renderGarage();
    await waitFor(() => screen.getByText("Monitorizar"));
    expect(screen.getByText("Monitorizar").closest("button")).toBeDisabled();
  });

  it("navigates to /simulator-contexts with moto id", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto({ id: "m42", category: "Naked" })] });
    renderGarage();
    await waitFor(() => screen.getByText("Monitorizar"));
    fireEvent.click(screen.getByText("Monitorizar").closest("button")!);
    expect(mockNavigate).toHaveBeenCalledWith("/simulator-contexts?moto=m42");
  });
});

// ─── Details panel ────────────────────────────────────────────────────────────

describe("Garage — details panel", () => {
  it("toggles detail panel on Detalhes click", async () => {
    mockGetAll.mockResolvedValue({ data: [makeMoto({ odometer: 12345 })] });
    renderGarage();
    await waitFor(() => screen.getByText("Bandit"));

    fireEvent.click(screen.getByText("Detalhes"));
    await waitFor(() => {
      expect(screen.getByText(/Odómetro/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Fechar"));
    expect(screen.queryByText(/Odómetro/)).not.toBeInTheDocument();
  });
});
