import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeRecommendations } from "@/components/resume-recommendations";

describe("ResumeRecommendations", () => {
  it("shows placeholder when no completion and not loading", () => {
    render(<ResumeRecommendations completion="" isLoading={false} />);
    expect(
      screen.getByText(/resume recommendations will appear here/i)
    ).toBeInTheDocument();
  });

  it("does not show placeholder while loading", () => {
    render(<ResumeRecommendations completion="" isLoading={true} />);
    expect(
      screen.queryByText(/resume recommendations will appear here/i)
    ).not.toBeInTheDocument();
  });

  it("shows Analyzing indicator while loading", () => {
    render(<ResumeRecommendations completion="" isLoading={true} />);
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  it("does not show Analyzing indicator when not loading", () => {
    render(
      <ResumeRecommendations
        completion="• Update skills section"
        isLoading={false}
      />
    );
    expect(screen.queryByText(/analyzing/i)).not.toBeInTheDocument();
  });

  it("displays streamed bullet points while loading", () => {
    render(
      <ResumeRecommendations
        completion="• Add metrics to Experience section"
        isLoading={true}
      />
    );
    expect(
      screen.getByText(/Add metrics to Experience section/)
    ).toBeInTheDocument();
  });

  it("displays completed bullet points after loading", () => {
    const bullets =
      "• Update Summary section to highlight leadership\n• Add quantified metrics to work experience";
    render(<ResumeRecommendations completion={bullets} isLoading={false} />);
    expect(screen.getByText(/Update Summary section/)).toBeInTheDocument();
    expect(screen.getByText(/Update Summary section/)).toBeInTheDocument();
  });

  it("renders content in a monospace container", () => {
    const { container } = render(
      <ResumeRecommendations
        completion="• Some recommendation"
        isLoading={false}
      />
    );
    const content = container.querySelector(".font-mono");
    expect(content).toBeInTheDocument();
  });
});
