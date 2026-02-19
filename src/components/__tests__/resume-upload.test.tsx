import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResumeUpload } from "@/components/resume-upload";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ResumeUpload", () => {
  const onResumeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file input accepting .pdf and .docx only", () => {
    render(<ResumeUpload onResumeText={onResumeText} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe(".pdf,.docx");
  });

  it("shows success badge after successful parse", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        resumeText: "John Doe, Engineer",
      }),
    });

    render(<ResumeUpload onResumeText={onResumeText} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["pdf content"], "resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument();
    });
    expect(onResumeText).toHaveBeenCalledWith("John Doe, Engineer");
  });

  it("shows error message for failed parse", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: false,
        error: "Unsupported file type",
      }),
    });

    render(<ResumeUpload onResumeText={onResumeText} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["text"], "resume.txt", { type: "text/plain" });
    // Use fireEvent since userEvent.upload respects accept attribute
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
  });

  it("calls onResumeText callback with parsed text", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        resumeText: "Parsed resume content",
      }),
    });

    render(<ResumeUpload onResumeText={onResumeText} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["docx content"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(input, file);

    await waitFor(() => {
      expect(onResumeText).toHaveBeenCalledWith("Parsed resume content");
    });
  });
});
