import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockDownloadDocx, mockDownloadResumePdf } = vi.hoisted(() => ({
  mockDownloadDocx: vi.fn(),
  mockDownloadResumePdf: vi.fn(),
}));

vi.mock("@/lib/generate-docx", () => ({
  downloadDocx: mockDownloadDocx,
}));

vi.mock("@/lib/generate-resume-pdf", () => ({
  downloadResumePdf: mockDownloadResumePdf,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { CuratedResume } from "@/components/curated-resume";
import { toast } from "sonner";

describe("CuratedResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadDocx.mockResolvedValue(undefined);
    mockDownloadResumePdf.mockResolvedValue(undefined);
  });

  it("shows placeholder when empty and not loading", () => {
    render(<CuratedResume completion="" isLoading={false} />);
    expect(
      screen.getByText(/your curated resume will appear here/i)
    ).toBeInTheDocument();
  });

  it("does not show placeholder while loading", () => {
    render(<CuratedResume completion="" isLoading={true} />);
    expect(
      screen.queryByText(/your curated resume will appear here/i)
    ).not.toBeInTheDocument();
  });

  it("shows Curating indicator while loading", () => {
    render(<CuratedResume completion="" isLoading={true} />);
    expect(screen.getByText(/curating/i)).toBeInTheDocument();
  });

  it("does not show download DOCX button while loading", () => {
    render(<CuratedResume completion="EXPERIENCE" isLoading={true} />);
    expect(
      screen.queryByRole("button", { name: /download docx/i })
    ).not.toBeInTheDocument();
  });

  it("does not show download PDF button while loading", () => {
    render(<CuratedResume completion="EXPERIENCE" isLoading={true} />);
    expect(
      screen.queryByRole("button", { name: /download pdf/i })
    ).not.toBeInTheDocument();
  });

  it("shows both download buttons after loading completes with content", () => {
    render(<CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />);
    expect(
      screen.getByRole("button", { name: /download docx/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).toBeInTheDocument();
  });

  // DOCX download tests
  it("calls downloadDocx with correct arguments on button click", async () => {
    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => {
      expect(mockDownloadDocx).toHaveBeenCalledWith(
        "EXPERIENCE\n- Led team",
        expect.stringMatching(/\.docx$/)
      );
    });
  });

  it("shows toast success after DOCX download", async () => {
    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Resume downloaded as DOCX!");
    });
  });

  it("shows toast error when DOCX download fails", async () => {
    mockDownloadDocx.mockRejectedValue(new Error("DOCX failed"));

    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("DOCX button shows Downloading and is disabled during DOCX download", async () => {
    let resolveDownload!: () => void;
    mockDownloadDocx.mockReturnValue(
      new Promise<void>((res) => { resolveDownload = res; })
    );

    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /downloading/i })
      ).toBeDisabled();
    });

    resolveDownload();
  });

  it("PDF button is also disabled while DOCX is downloading", async () => {
    let resolveDownload!: () => void;
    mockDownloadDocx.mockReturnValue(
      new Promise<void>((res) => { resolveDownload = res; })
    );

    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download docx/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /download pdf/i })
      ).toBeDisabled();
    });

    resolveDownload();
  });

  // PDF download tests
  it("calls downloadResumePdf with correct arguments on button click", async () => {
    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(mockDownloadResumePdf).toHaveBeenCalledWith(
        "EXPERIENCE\n- Led team",
        expect.stringMatching(/\.pdf$/)
      );
    });
  });

  it("shows toast success after PDF download", async () => {
    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Resume downloaded as PDF!");
    });
  });

  it("shows toast error when PDF download fails", async () => {
    mockDownloadResumePdf.mockRejectedValue(new Error("PDF failed"));

    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("DOCX button is also disabled while PDF is downloading", async () => {
    let resolveDownload!: () => void;
    mockDownloadResumePdf.mockReturnValue(
      new Promise<void>((res) => { resolveDownload = res; })
    );

    render(
      <CuratedResume completion={"EXPERIENCE\n- Led team"} isLoading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /download docx/i })
      ).toBeDisabled();
    });

    resolveDownload();
  });

  it("shows completion content in output area", () => {
    render(
      <CuratedResume
        completion="EXPERIENCE\n- Led backend team"
        isLoading={false}
      />
    );
    const output = screen.getByTestId("curated-resume-output");
    expect(output.textContent).toContain("EXPERIENCE");
    expect(output.textContent).toContain("Led backend team");
  });

  it("renders content in a monospace container", () => {
    const { container } = render(
      <CuratedResume completion="Some content" isLoading={false} />
    );
    const mono = container.querySelector(".font-mono");
    expect(mono).toBeInTheDocument();
  });
});
