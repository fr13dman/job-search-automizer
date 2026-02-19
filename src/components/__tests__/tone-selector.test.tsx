import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToneSelector } from "@/components/tone-selector";

describe("ToneSelector", () => {
  const onChange = vi.fn();

  it("renders all tone options", () => {
    render(<ToneSelector value="professional" onChange={onChange} />);
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Friendly")).toBeInTheDocument();
    expect(screen.getByText("Concise")).toBeInTheDocument();
    expect(screen.getByText("Enthusiastic")).toBeInTheDocument();
    expect(screen.getByText("Confident")).toBeInTheDocument();
  });

  it("highlights the selected tone", () => {
    render(<ToneSelector value="friendly" onChange={onChange} />);
    const friendlyBtn = screen.getByText("Friendly");
    expect(friendlyBtn.className).toContain("bg-primary");
  });

  it("calls onChange when a tone is clicked", async () => {
    const user = userEvent.setup();
    render(<ToneSelector value="professional" onChange={onChange} />);
    await user.click(screen.getByText("Concise"));
    expect(onChange).toHaveBeenCalledWith("concise");
  });

  it("does not highlight unselected tones with primary style", () => {
    render(<ToneSelector value="professional" onChange={onChange} />);
    const friendlyBtn = screen.getByText("Friendly");
    expect(friendlyBtn.className).not.toContain("bg-primary");
  });
});
