import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobInput } from "@/components/job-input";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("JobInput", () => {
  const onJobDescription = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders URL input and Fetch button", () => {
    render(<JobInput onJobDescription={onJobDescription} />);
    expect(screen.getByLabelText(/job posting url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fetch/i })).toBeInTheDocument();
  });

  it("shows loading state when fetching", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<JobInput onJobDescription={onJobDescription} />);
    const input = screen.getByLabelText(/job posting url/i);
    await user.type(input, "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));

    expect(screen.getByRole("button", { name: /fetching/i })).toBeInTheDocument();
  });

  it("shows success badge and preview on successful scrape", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        jobDescription: "Software Engineer at Acme Corp doing great things",
      }),
    });

    render(<JobInput onJobDescription={onJobDescription} />);
    await user.type(screen.getByLabelText(/job posting url/i), "https://example.com/job");
    await user.click(screen.getByRole("button", { name: /fetch/i }));

    await waitFor(() => {
      expect(screen.getByText(/job description loaded/i)).toBeInTheDocument();
    });
    expect(onJobDescription).toHaveBeenCalledWith(
      "Software Engineer at Acme Corp doing great things"
    );
  });

  it("shows error alert and fallback textarea on failed scrape", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: false,
        error: "Failed to fetch",
      }),
    });

    render(<JobInput onJobDescription={onJobDescription} />);
    await user.type(screen.getByLabelText(/job posting url/i), "https://bad.com");
    await user.click(screen.getByRole("button", { name: /fetch/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/paste job description/i)).toBeInTheDocument();
  });

  it("'Paste manually' link reveals textarea", async () => {
    const user = userEvent.setup();
    render(<JobInput onJobDescription={onJobDescription} />);

    await user.click(screen.getByText(/paste manually/i));
    expect(screen.getByLabelText(/paste job description/i)).toBeInTheDocument();
  });

  it("calls onJobDescription with manually entered text", async () => {
    const user = userEvent.setup();
    render(<JobInput onJobDescription={onJobDescription} />);

    await user.click(screen.getByText(/paste manually/i));
    const textarea = screen.getByLabelText(/paste job description/i);
    await user.type(textarea, "Manual job description");
    await user.click(screen.getByRole("button", { name: /use this description/i }));

    expect(onJobDescription).toHaveBeenCalledWith("Manual job description");
  });
});
