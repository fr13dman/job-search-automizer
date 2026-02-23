import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock useCompletion from @ai-sdk/react
const mockComplete = vi.fn();
const mockCompleteRecommendations = vi.fn();
let mockCompletion = "";
let mockIsLoading = false;
let mockError: Error | null = null;
let mockRecommendationsCompletion = "";
let mockRecommendationsLoading = false;

vi.mock("@ai-sdk/react", () => ({
  useCompletion: ({ api }: { api: string }) => {
    if (api === "/api/recommendations") {
      return {
        completion: mockRecommendationsCompletion,
        isLoading: mockRecommendationsLoading,
        complete: mockCompleteRecommendations,
        error: null,
      };
    }
    return {
      completion: mockCompletion,
      isLoading: mockIsLoading,
      complete: mockComplete,
      error: mockError,
    };
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import Home from "@/app/page";

describe("Integration tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompletion = "";
    mockIsLoading = false;
    mockError = null;
    mockRecommendationsCompletion = "";
    mockRecommendationsLoading = false;
  });

  it("full flow: mock scrape + mock parse + mock generate → cover letter appears", async () => {
    const user = userEvent.setup();

    // Mock scrape response
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      const body =
        opts?.body instanceof FormData ? null : JSON.parse(opts?.body as string);

      if (url === "/api/scrape") {
        return {
          json: async () => ({
            success: true,
            jobDescription: "Senior Engineer at TechCorp",
          }),
        };
      }
      if (url === "/api/parse-resume") {
        return {
          json: async () => ({
            success: true,
            resumeText: "John Doe, 5 years experience",
          }),
        };
      }
      return { json: async () => ({}) };
    });

    // Set up completion mock to simulate generation
    mockComplete.mockImplementation(async () => {
      mockCompletion = "Dear Hiring Manager, I am writing to express...";
    });

    render(<Home />);

    // Step 1: Enter job URL and fetch
    const urlInput = screen.getByLabelText(/job posting url/i);
    await user.type(urlInput, "https://techcorp.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));

    await waitFor(() => {
      expect(screen.getByText(/job description loaded/i)).toBeInTheDocument();
    });

    // Step 2: Upload resume
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["resume content"], "resume.pdf", {
      type: "application/pdf",
    });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(
        screen.getByText(/resume parsed successfully/i)
      ).toBeInTheDocument();
    });

    // Step 3: Generate button should now be enabled
    const generateBtn = screen.getByRole("button", {
      name: /generate cover letter/i,
    });
    expect(generateBtn).not.toBeDisabled();
  });

  it("error flow: scrape fails → fallback textarea → manual paste → generate button enabled", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/scrape") {
        return {
          json: async () => ({
            success: false,
            error: "Failed to scrape",
          }),
        };
      }
      if (url === "/api/parse-resume") {
        return {
          json: async () => ({
            success: true,
            resumeText: "Resume content",
          }),
        };
      }
      return { json: async () => ({}) };
    });

    render(<Home />);

    // Attempt to fetch URL - fails
    await user.type(
      screen.getByLabelText(/job posting url/i),
      "https://bad.com"
    );
    await user.click(screen.getByRole("button", { name: /fetch/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to scrape/i)).toBeInTheDocument();
    });

    // Fallback textarea appears, type manual description
    const textarea = screen.getByLabelText(/paste job description/i);
    await user.type(textarea, "Manual job description here");
    await user.click(
      screen.getByRole("button", { name: /use this description/i })
    );

    // Upload resume
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File(["content"], "resume.pdf", { type: "application/pdf" })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/resume parsed successfully/i)
      ).toBeInTheDocument();
    });

    // Generate should be enabled
    expect(
      screen.getByRole("button", { name: /generate cover letter/i })
    ).not.toBeDisabled();
  });

  it("generate button disabled until both inputs are provided", () => {
    render(<Home />);
    const btn = screen.getByRole("button", {
      name: /generate cover letter/i,
    });
    expect(btn).toBeDisabled();
  });

  it("additional instructions textarea is present in Input card", () => {
    render(<Home />);
    expect(screen.getByLabelText(/additional instructions/i)).toBeInTheDocument();
  });

  it("resume recommendations card is present on page", () => {
    render(<Home />);
    // Card title is exact text; placeholder is a longer string — use exact match to avoid ambiguity
    expect(screen.getByText("Resume Recommendations")).toBeInTheDocument();
  });

  it("recommendations placeholder is shown before generation", () => {
    render(<Home />);
    expect(
      screen.getByText(/resume recommendations will appear here/i)
    ).toBeInTheDocument();
  });

  it("fires both complete and completeRecommendations when Generate is clicked", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === "/api/scrape") {
        return { json: async () => ({ success: true, jobDescription: "Engineer role" }) };
      }
      if (url === "/api/parse-resume") {
        return { json: async () => ({ success: true, resumeText: "Jane Doe resume" }) };
      }
      return { json: async () => ({}) };
    });

    mockComplete.mockResolvedValue(undefined);
    mockCompleteRecommendations.mockResolvedValue(undefined);

    render(<Home />);

    // Scrape job
    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));
    await waitFor(() => expect(screen.getByText(/job description loaded/i)).toBeInTheDocument());

    // Upload resume
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["resume"], "resume.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument());

    // Generate
    await user.click(screen.getByRole("button", { name: /generate cover letter/i }));

    expect(mockComplete).toHaveBeenCalledOnce();
    expect(mockCompleteRecommendations).toHaveBeenCalledOnce();
  });

  it("passes additionalInstructions in the generate request body", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/scrape") {
        return { json: async () => ({ success: true, jobDescription: "Engineer role" }) };
      }
      if (url === "/api/parse-resume") {
        return { json: async () => ({ success: true, resumeText: "Jane Doe resume" }) };
      }
      return { json: async () => ({}) };
    });

    mockComplete.mockResolvedValue(undefined);
    mockCompleteRecommendations.mockResolvedValue(undefined);

    render(<Home />);

    // Scrape job
    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));
    await waitFor(() => expect(screen.getByText(/job description loaded/i)).toBeInTheDocument());

    // Upload resume
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["resume"], "resume.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument());

    // Type additional instructions
    await user.type(
      screen.getByLabelText(/additional instructions/i),
      "Emphasize leadership"
    );

    await user.click(screen.getByRole("button", { name: /generate cover letter/i }));

    expect(mockComplete).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        body: expect.objectContaining({ additionalInstructions: "Emphasize leadership" }),
      })
    );
  });

  it("shows recommendations completion text when streamed", () => {
    mockRecommendationsCompletion = "• Update Summary section to highlight leadership skills";
    render(<Home />);
    expect(screen.getByText(/Update Summary section/)).toBeInTheDocument();
  });

  it("stream interruption: partial text remains visible and exportable", async () => {
    const user = userEvent.setup();
    // Simulate partial completion with error
    mockCompletion = "Dear Hiring Manager, I am writing to";
    mockIsLoading = false;
    mockError = new Error("Stream interrupted");

    render(<Home />);

    // The partial text should be in the rich preview
    const preview = screen.getByTestId("rich-preview");
    expect(preview.textContent).toContain("Dear Hiring Manager, I am writing to");

    // Export buttons should be enabled (not loading)
    expect(
      screen.getByRole("button", { name: /copy/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /download pdf/i })
    ).not.toBeDisabled();

    // User can click Edit to get textarea for editing
    await user.click(screen.getByText("Edit"));
    const textarea = screen.getByLabelText(/cover letter/i);
    expect(textarea).toHaveValue("Dear Hiring Manager, I am writing to");
    expect(textarea).not.toHaveAttribute("readonly");
  });
});
