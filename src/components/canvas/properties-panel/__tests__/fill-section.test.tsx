import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Shape } from "@/types";
import { FillSection } from "../fill-section";

vi.mock("@/store", () => ({
  useCanvasStore: (selector: (state: { updateElements: unknown }) => unknown) => {
    return selector({
      updateElements: vi.fn(),
    });
  },
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <div data-testid="huge-icon" />,
}));
vi.mock("@hugeicons/core-free-icons", () => ({
  PlusSignIcon: "plus-icon",
  MinusSignIcon: "minus-icon",
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/shared/color-input", () => ({
  ColorInput: () => <div data-testid="color-input" />,
}));
vi.mock("../shared", () => ({
  SectionHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe("FillSection", () => {
  it("renders safe with empty elements", () => {
    const { container } = render(<FillSection elements={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with valid elements", () => {
    const rect: Shape = {
      id: "rect1",
      type: "rect",
      name: "Rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "#ff0000",
      stroke: null,
      rotation: 0,
      opacity: 1,
    };
    render(<FillSection elements={[rect]} />);
    expect(screen.getByText("Fill")).toBeDefined();
    expect(screen.getByTestId("color-input")).toBeDefined();
  });
});
