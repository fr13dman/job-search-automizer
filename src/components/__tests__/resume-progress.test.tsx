import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResumeProgress } from "@/components/resume-progress";
import type { AttemptRecord } from "@/types";

const baseEvaluation = {
  atsScore: 78,
  keywordMatches: ["React", "TypeScript"],
  missingKeywords: ["GraphQL"],
  hallucinationsFound: false,
  hallucinationDetails: [],
  overallAssessment: "Good match overall.",
};

function makeRecord(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    attempt: 1,
    evaluation: baseEvaluation,
    passed: true,
    ...overrides,
  };
}

describe("ResumeProgress", () => {
  it("renders nothing when phase is idle", () => {
    const { container } = render(
      <ResumeProgress phase="idle" currentAttempt={0} maxAttempts={3} history={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the progress container when phase is curating", () => {
    render(
      <ResumeProgress phase="curating" currentAttempt={1} maxAttempts={3} history={[]} />
    );
    expect(screen.getByTestId("resume-progress")).toBeInTheDocument();
  });

  it("renders the progress container when phase is evaluating", () => {
    render(
      <ResumeProgress phase="evaluating" currentAttempt={1} maxAttempts={3} history={[]} />
    );
    expect(screen.getByTestId("resume-progress")).toBeInTheDocument();
  });

  it("renders the progress container when phase is done", () => {
    render(
      <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={[makeRecord()]} />
    );
    expect(screen.getByTestId("resume-progress")).toBeInTheDocument();
  });

  it("shows Curating step label", () => {
    render(
      <ResumeProgress phase="curating" currentAttempt={1} maxAttempts={3} history={[]} />
    );
    expect(screen.getByText("Curating")).toBeInTheDocument();
  });

  it("shows Evaluating step label", () => {
    render(
      <ResumeProgress phase="evaluating" currentAttempt={1} maxAttempts={3} history={[]} />
    );
    expect(screen.getByText("Evaluating")).toBeInTheDocument();
  });

  it("shows attempt number", () => {
    render(
      <ResumeProgress phase="curating" currentAttempt={2} maxAttempts={3} history={[]} />
    );
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
  });

  it("shows 'of N' when maxAttempts > 1", () => {
    render(
      <ResumeProgress phase="curating" currentAttempt={1} maxAttempts={3} history={[]} />
    );
    expect(screen.getByText(/of 3/i)).toBeInTheDocument();
  });

  it("does not show 'of N' when maxAttempts is 1", () => {
    render(
      <ResumeProgress phase="curating" currentAttempt={1} maxAttempts={1} history={[]} />
    );
    expect(screen.queryByText(/of 1/i)).not.toBeInTheDocument();
  });

  it("shows history attempt rows alongside current in-progress row", () => {
    const history = [makeRecord({ attempt: 1, passed: false })];
    render(
      <ResumeProgress phase="curating" currentAttempt={2} maxAttempts={3} history={history} />
    );
    // Attempt 1 from history + Attempt 2 in-progress
    expect(screen.getByText(/attempt 1/i)).toBeInTheDocument();
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
  });

  it("shows 'Passed' label for a passed history record", () => {
    const history = [makeRecord({ attempt: 1, passed: true })];
    render(
      <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
    );
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("shows 'Failed' label for a failed history record", () => {
    const history = [makeRecord({ attempt: 1, passed: false })];
    render(
      <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  describe("EvalSummary — null evaluation", () => {
    it("shows 'Evaluation unavailable' when evaluation is null", () => {
      const history = [makeRecord({ evaluation: null, passed: false })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/evaluation unavailable/i)).toBeInTheDocument();
    });

    it("shows 'view details' link when evaluation is null", () => {
      const history = [makeRecord({ evaluation: null, passed: false })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByRole("button", { name: /view details/i })).toBeInTheDocument();
    });

    it("expands error message when 'view details' is clicked", () => {
      const history = [
        makeRecord({
          evaluation: null,
          passed: false,
          evaluationError: "TypeError: AI model timeout",
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      fireEvent.click(screen.getByRole("button", { name: /view details/i }));
      expect(screen.getByText("TypeError: AI model timeout")).toBeInTheDocument();
    });

    it("shows 'hide details' after expanding", () => {
      const history = [makeRecord({ evaluation: null, passed: false })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      fireEvent.click(screen.getByRole("button", { name: /view details/i }));
      expect(screen.getByRole("button", { name: /hide details/i })).toBeInTheDocument();
    });

    it("collapses error message when 'hide details' is clicked", () => {
      const history = [
        makeRecord({
          evaluation: null,
          passed: false,
          evaluationError: "TypeError: AI model timeout",
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      fireEvent.click(screen.getByRole("button", { name: /view details/i }));
      fireEvent.click(screen.getByRole("button", { name: /hide details/i }));
      expect(screen.queryByText("TypeError: AI model timeout")).not.toBeInTheDocument();
    });

    it("shows fallback message when evaluationError is undefined", () => {
      const history = [makeRecord({ evaluation: null, passed: false, evaluationError: undefined })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      fireEvent.click(screen.getByRole("button", { name: /view details/i }));
      expect(
        screen.getByText(/evaluation service did not return a response/i)
      ).toBeInTheDocument();
    });
  });

  describe("EvalSummary — non-null evaluation", () => {
    it("displays the ATS score", () => {
      const history = [makeRecord({ evaluation: { ...baseEvaluation, atsScore: 82 } })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/82\/100/)).toBeInTheDocument();
    });

    it("shows hallucination warning when hallucinationsFound is true", () => {
      const history = [
        makeRecord({
          evaluation: {
            ...baseEvaluation,
            hallucinationsFound: true,
            hallucinationDetails: ["Degree not in original"],
          },
          passed: false,
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/hallucinations found/i)).toBeInTheDocument();
    });

    it("shows hallucination detail items", () => {
      const history = [
        makeRecord({
          evaluation: {
            ...baseEvaluation,
            hallucinationsFound: true,
            hallucinationDetails: ["Added MIT degree not in original"],
          },
          passed: false,
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/added mit degree not in original/i)).toBeInTheDocument();
    });

    it("shows 'No hallucinations' check when hallucinationsFound is false", () => {
      const history = [makeRecord({ evaluation: { ...baseEvaluation, hallucinationsFound: false } })];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/no hallucinations/i)).toBeInTheDocument();
    });

    it("shows missing keywords when present", () => {
      const history = [
        makeRecord({
          evaluation: { ...baseEvaluation, missingKeywords: ["GraphQL", "Docker"] },
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText(/missing keywords/i)).toBeInTheDocument();
      expect(screen.getByText(/GraphQL/)).toBeInTheDocument();
      expect(screen.getByText(/Docker/)).toBeInTheDocument();
    });

    it("does not render missing keywords section when list is empty", () => {
      const history = [
        makeRecord({ evaluation: { ...baseEvaluation, missingKeywords: [] } }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.queryByText(/missing keywords/i)).not.toBeInTheDocument();
    });

    it("shows overall assessment text", () => {
      const history = [
        makeRecord({
          evaluation: { ...baseEvaluation, overallAssessment: "Strong ATS performance expected." },
        }),
      ];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.getByText("Strong ATS performance expected.")).toBeInTheDocument();
    });

    it("does not show 'Evaluation unavailable' when evaluation exists", () => {
      const history = [makeRecord()];
      render(
        <ResumeProgress phase="done" currentAttempt={1} maxAttempts={3} history={history} />
      );
      expect(screen.queryByText(/evaluation unavailable/i)).not.toBeInTheDocument();
    });
  });
});
