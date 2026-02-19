import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportToolbar } from "@/components/export-toolbar";

vi.mock("@/lib/generate-pdf", () => ({
  downloadPdf: vi.fn(),
}));

vi.mock("@/lib/extract-metadata", () => ({
  extractMetadata: vi.fn(() => ({ candidateName: "Test", companyName: "Co" })),
  buildPdfFilename: vi.fn(() => "Cover-Letter_Co_2026.pdf"),
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
  it("copy button strips markdown bold and copies plain text", async () => {
    render(
      <ExportToolbar
        text="I **increased revenue** at work."
        jobDescription="Job desc"
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "I increased revenue at work."
      );
    });
  });

  it("shows 'Copied!' feedback after copy", async () => {
    const user = userEvent.setup();
    render(<ExportToolbar text="Some text" jobDescription="Job desc" isLoading={false} />);

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

    render(<ExportToolbar text="Some text" jobDescription="Job desc" isLoading={false} />);

    const btn = screen.getByRole("button", { name: /download pdf/i });
    expect(btn).toBeInTheDocument();
    await user.click(btn);

    expect(downloadPdf).toHaveBeenCalledWith(
      "Some text",
      { candidateName: "Test", companyName: "Co" },
      "Cover-Letter_Co_2026.pdf"
    );
  });

  it("both buttons are disabled when isLoading is true", () => {
    render(<ExportToolbar text="Some text" jobDescription="Job desc" isLoading={true} />);

    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeDisabled();
  });
});
