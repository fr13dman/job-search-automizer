import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@ai-sdk/react", () => ({
  useCompletion: () => ({
    completion: "",
    isLoading: false,
    complete: vi.fn(),
    error: null,
  }),
}));

import Home from "@/app/page";

describe("Home page", () => {
  it("renders header with title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /job application helper/i })
    ).toBeInTheDocument();
  });

  it("renders job input section", () => {
    render(<Home />);
    expect(screen.getByLabelText(/job posting url/i)).toBeInTheDocument();
  });

  it("renders resume upload section", () => {
    render(<Home />);
    expect(screen.getByText(/upload resume/i)).toBeInTheDocument();
  });

  it("renders tone selector with all options", () => {
    render(<Home />);
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Friendly")).toBeInTheDocument();
    expect(screen.getByText("Concise")).toBeInTheDocument();
  });

  it("generate button is disabled when inputs are incomplete", () => {
    render(<Home />);
    const generateBtn = screen.getByRole("button", {
      name: /generate cover letter/i,
    });
    expect(generateBtn).toBeDisabled();
  });
});
