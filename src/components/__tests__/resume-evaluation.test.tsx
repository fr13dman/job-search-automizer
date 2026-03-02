import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumeEvaluation } from "@/components/resume-evaluation";
import type { ResumeEvaluation as ResumeEvaluationType } from "@/types";

const baseEvaluation: ResumeEvaluationType = {
  atsScore: 85,
  keywordMatches: ["React", "TypeScript", "Node.js"],
  missingKeywords: ["GraphQL", "Docker"],
  hallucinationsFound: false,
  hallucinationDetails: [],
  overallAssessment: "Strong resume. Good keyword coverage for the role.",
};

describe("ResumeEvaluation", () => {
  it("shows placeholder when evaluation is null and not loading", () => {
    render(<ResumeEvaluation evaluation={null} isLoading={false} />);
    expect(screen.getByTestId("evaluation-placeholder")).toBeInTheDocument();
    expect(
      screen.getByText(/evaluation will appear after generation/i)
    ).toBeInTheDocument();
  });

  it("shows loading indicator while evaluating", () => {
    render(<ResumeEvaluation evaluation={null} isLoading={true} />);
    expect(screen.getByTestId("evaluation-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/running ats check/i)
    ).toBeInTheDocument();
  });

  it("does not show placeholder while loading", () => {
    render(<ResumeEvaluation evaluation={null} isLoading={true} />);
    expect(screen.queryByTestId("evaluation-placeholder")).not.toBeInTheDocument();
  });

  it("renders evaluation result when data is provided", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByTestId("evaluation-result")).toBeInTheDocument();
  });

  it("displays the ATS score", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText(/ats score/i)).toBeInTheDocument();
  });

  it("shows 'Strong' label for scores >= 80", () => {
    render(<ResumeEvaluation evaluation={{ ...baseEvaluation, atsScore: 80 }} isLoading={false} />);
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("shows 'Fair' label for scores 60-79", () => {
    render(<ResumeEvaluation evaluation={{ ...baseEvaluation, atsScore: 65 }} isLoading={false} />);
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it("shows 'Weak' label for scores below 60", () => {
    render(<ResumeEvaluation evaluation={{ ...baseEvaluation, atsScore: 45 }} isLoading={false} />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("shows no-hallucination success message when none found", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    const status = screen.getByTestId("hallucination-status");
    expect(status.textContent).toContain("No hallucinations found");
  });

  it("shows hallucination warning when found", () => {
    const evaluation = {
      ...baseEvaluation,
      hallucinationsFound: true,
      hallucinationDetails: ["Added MIT degree not in original resume"],
    };
    render(<ResumeEvaluation evaluation={evaluation} isLoading={false} />);
    const status = screen.getByTestId("hallucination-status");
    expect(status.textContent).toContain("Hallucinations detected");
  });

  it("lists hallucination details when present", () => {
    const evaluation = {
      ...baseEvaluation,
      hallucinationsFound: true,
      hallucinationDetails: ["Added MIT degree", "Inflated metric 10x → 100x"],
    };
    render(<ResumeEvaluation evaluation={evaluation} isLoading={false} />);
    expect(screen.getByText("Added MIT degree")).toBeInTheDocument();
    expect(screen.getByText("Inflated metric 10x → 100x")).toBeInTheDocument();
  });

  it("shows matched keywords as chips", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });

  it("shows matched keyword count", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByText(/matched keywords \(3\)/i)).toBeInTheDocument();
  });

  it("shows missing keywords as chips", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByText("GraphQL")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
  });

  it("shows missing keyword count", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(screen.getByText(/missing keywords \(2\)/i)).toBeInTheDocument();
  });

  it("does not render matched keywords section when empty", () => {
    render(
      <ResumeEvaluation
        evaluation={{ ...baseEvaluation, keywordMatches: [] }}
        isLoading={false}
      />
    );
    expect(screen.queryByText(/matched keywords/i)).not.toBeInTheDocument();
  });

  it("does not render missing keywords section when empty", () => {
    render(
      <ResumeEvaluation
        evaluation={{ ...baseEvaluation, missingKeywords: [] }}
        isLoading={false}
      />
    );
    expect(screen.queryByText(/missing keywords/i)).not.toBeInTheDocument();
  });

  it("displays the overall assessment", () => {
    render(<ResumeEvaluation evaluation={baseEvaluation} isLoading={false} />);
    expect(
      screen.getByText("Strong resume. Good keyword coverage for the role.")
    ).toBeInTheDocument();
  });
});
