import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportToolbar } from "@/components/export-toolbar";

vi.mock("@/lib/generate-pdf", () => ({
  downloadPdf: vi.fn(),
}));

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
});

describe("ExportToolbar", () => {
  it("copy button calls clipboard API with current text", async () => {
    render(<ExportToolbar text="Cover letter text" isLoading={false} />);

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Cover letter text");
    });
  });

  it("shows 'Copied!' feedback after copy", async () => {
    const user = userEvent.setup();
    render(<ExportToolbar text="Some text" isLoading={false} />);

    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /copied/i })
      ).toBeInTheDocument();
    });
  });

  it("Download PDF button is present and clickable", async () => {
    const user = userEvent.setup();
    const { downloadPdf } = await import("@/lib/generate-pdf");

    render(<ExportToolbar text="Some text" isLoading={false} />);

    const btn = screen.getByRole("button", { name: /download pdf/i });
    expect(btn).toBeInTheDocument();
    await user.click(btn);

    expect(downloadPdf).toHaveBeenCalledWith("Some text");
  });

  it("both buttons are disabled when isLoading is true", () => {
    render(<ExportToolbar text="Some text" isLoading={true} />);

    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeDisabled();
  });
});
