import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

// Mock useCompletion from @ai-sdk/react
const mockComplete = vi.fn();
const mockCompleteRecommendations = vi.fn();
const mockStopCurateResume = vi.fn();
let mockCompletion = "";
let mockIsLoading = false;
let mockError: Error | null = null;
let mockCuratedResumeCompletion = "";
let mockCuratedResumeLoading = false;

// Captured onError callbacks so tests can trigger them
let capturedCoverLetterOnError: ((err: Error) => void) | undefined;
let capturedCurateResumeOnError: ((err: Error) => void) | undefined;

vi.mock("@ai-sdk/react", () => ({
  useCompletion: ({
    api,
    onError,
  }: {
    api: string;
    onError?: (err: Error) => void;
  }) => {
    if (api === "/api/curate-resume") {
      capturedCurateResumeOnError = onError;
      return {
        completion: mockCuratedResumeCompletion,
        isLoading: mockCuratedResumeLoading,
        complete: mockCompleteRecommendations,
        stop: mockStopCurateResume,
        error: null,
      };
    }
    capturedCoverLetterOnError = onError;
    return {
      completion: mockCompletion,
      isLoading: mockIsLoading,
      complete: mockComplete,
      stop: vi.fn(),
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
    mockCuratedResumeCompletion = "";
    mockCuratedResumeLoading = false;
    capturedCoverLetterOnError = undefined;
    capturedCurateResumeOnError = undefined;
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
    const generateBtn = screen.getByTestId("generate-btn");
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
      screen.getByTestId("generate-btn")
    ).not.toBeDisabled();
  });

  it("generate button disabled until both inputs are provided", () => {
    render(<Home />);
    const btn = screen.getByTestId("generate-btn");
    expect(btn).toBeDisabled();
  });

  it("additional instructions textarea is present in Input card", () => {
    render(<Home />);
    expect(screen.getByLabelText(/additional instructions/i)).toBeInTheDocument();
  });

  it("resume curator card is present on page", () => {
    render(<Home />);
    expect(screen.getByText("Resume Curator")).toBeInTheDocument();
  });

  it("curated resume placeholder is shown before generation", () => {
    render(<Home />);
    expect(
      screen.getByText(/your curated resume will appear here/i)
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
    await user.click(screen.getByTestId("generate-btn"));

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

    await user.click(screen.getByTestId("generate-btn"));

    expect(mockComplete).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        body: expect.objectContaining({ additionalInstructions: "Emphasize leadership" }),
      })
    );
  });

  it("shows curated resume text after evaluation completes", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === "/api/scrape") {
        return { ok: true, json: async () => ({ success: true, jobDescription: "Engineer role" }) };
      }
      if (url === "/api/parse-resume") {
        return { ok: true, json: async () => ({ success: true, resumeText: "Jane Doe resume" }) };
      }
      if (url === "/api/evaluate-resume") {
        return {
          ok: true,
          json: async () => ({
            atsScore: 88,
            keywordMatches: ["React"],
            missingKeywords: [],
            hallucinationsFound: false,
            hallucinationDetails: [],
            overallAssessment: "Excellent match.",
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    mockComplete.mockResolvedValue(undefined);
    mockCompleteRecommendations.mockResolvedValue("EXPERIENCE\n- Led backend team");

    render(<Home />);

    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));
    await waitFor(() => expect(screen.getByText(/job description loaded/i)).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["resume"], "resume.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument());

    await user.click(screen.getByTestId("generate-btn"));

    await waitFor(() => {
      const output = screen.getByTestId("curated-resume-output");
      expect(output.textContent).toContain("EXPERIENCE");
    });
  });

  it("shows toast success only after evaluation passes", async () => {
    const user = userEvent.setup();
    const toastSpy = vi.spyOn(toast, "success").mockImplementation(() => ({} as never));

    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/scrape") return { json: async () => ({ success: true, jobDescription: "Engineer role" }) };
      if (url === "/api/parse-resume") return { json: async () => ({ success: true, resumeText: "Jane Doe resume" }) };
      if (url === "/api/evaluate-resume") return {
        ok: true,
        json: async () => ({
          atsScore: 88,
          keywordMatches: ["React"],
          missingKeywords: [],
          hallucinationsFound: false,
          hallucinationDetails: [],
          overallAssessment: "Excellent match.",
        }),
      };
      return { ok: false, json: async () => ({}) };
    });

    mockComplete.mockResolvedValue(undefined);
    mockCompleteRecommendations.mockResolvedValue("EXPERIENCE\n- Led backend team");

    render(<Home />);

    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));
    await waitFor(() => expect(screen.getByText(/job description loaded/i)).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["resume"], "resume.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument());

    await user.click(screen.getByTestId("generate-btn"));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith("Resume curated!");
    });

    toastSpy.mockRestore();
  });

  it("does not show 'Resume curated!' toast when evaluation fails", async () => {
    const user = userEvent.setup();
    const toastSpy = vi.spyOn(toast, "success").mockImplementation(() => ({} as never));

    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/scrape") return { json: async () => ({ success: true, jobDescription: "Engineer role" }) };
      if (url === "/api/parse-resume") return { json: async () => ({ success: true, resumeText: "Jane Doe resume" }) };
      if (url === "/api/evaluate-resume") return {
        ok: true,
        json: async () => ({
          atsScore: 50,
          keywordMatches: [],
          missingKeywords: ["React"],
          hallucinationsFound: true,
          hallucinationDetails: ["MIT degree not in original resume"],
          overallAssessment: "Hallucinations detected.",
        }),
      };
      return { ok: false, json: async () => ({}) };
    });

    mockComplete.mockResolvedValue(undefined);
    mockCompleteRecommendations.mockResolvedValue("EXPERIENCE\n- Led backend team");

    render(<Home />);

    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));
    await waitFor(() => expect(screen.getByText(/job description loaded/i)).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["resume"], "resume.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(/resume parsed successfully/i)).toBeInTheDocument());

    await user.click(screen.getByTestId("generate-btn"));

    // Wait for all 3 attempts to complete
    await waitFor(() => {
      expect(screen.getAllByText("Failed")).toHaveLength(3);
    });

    expect(toastSpy).not.toHaveBeenCalledWith("Resume curated!");
    toastSpy.mockRestore();
  });

  it("cancel button is not shown when not busy", () => {
    render(<Home />);
    expect(screen.queryByTestId("cancel-btn")).not.toBeInTheDocument();
  });

  it("cancel button appears while resume curation is loading", () => {
    mockCuratedResumeLoading = true;
    render(<Home />);
    expect(screen.getByTestId("cancel-btn")).toBeInTheDocument();
  });

  it("clicking cancel calls stop on the curate stream", async () => {
    const user = userEvent.setup();
    mockCuratedResumeLoading = true;
    render(<Home />);
    await user.click(screen.getByTestId("cancel-btn"));
    expect(mockStopCurateResume).toHaveBeenCalledOnce();
  });

  it("cover letter API error message surfaces in toast (not generic fallback)", async () => {
    const toastSpy = vi.spyOn(toast, "error").mockImplementation(() => ({} as never));

    render(<Home />);

    const creditError = new Error(
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
    );
    capturedCoverLetterOnError?.(creditError);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
      );
    });

    toastSpy.mockRestore();
  });

  it("curate resume API error message surfaces in toast (not generic fallback)", async () => {
    const toastSpy = vi.spyOn(toast, "error").mockImplementation(() => ({} as never));

    render(<Home />);

    const creditError = new Error(
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
    );
    capturedCurateResumeOnError?.(creditError);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
      );
    });

    toastSpy.mockRestore();
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
