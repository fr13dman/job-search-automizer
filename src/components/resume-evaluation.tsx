"use client";

import type { ResumeEvaluation } from "@/types";

interface ResumeEvaluationProps {
  evaluation: ResumeEvaluation | null;
  isLoading: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-200 dark:ring-emerald-800"
      : score >= 60
        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-amber-200 dark:ring-amber-800"
        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 ring-red-200 dark:ring-red-800";

  const label = score >= 80 ? "Strong" : score >= 60 ? "Fair" : "Weak";

  return (
    <div className={`inline-flex flex-col items-center justify-center w-20 h-20 rounded-full ring-2 ${color}`}>
      <span className="text-2xl font-bold leading-none">{score}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

function Chip({ label, variant }: { label: string; variant: "match" | "missing" }) {
  return (
    <span
      className={
        variant === "match"
          ? "inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }
    >
      {label}
    </span>
  );
}

export function ResumeEvaluation({ evaluation, isLoading }: ResumeEvaluationProps) {
  if (!evaluation && !isLoading) {
    return (
      <div
        data-testid="evaluation-placeholder"
        className="flex items-center justify-center min-h-[80px] text-muted-foreground text-sm font-mono"
      >
        Evaluation will appear after generation
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <span
          data-testid="evaluation-loading"
          className="text-sm text-muted-foreground animate-pulse"
        >
          Running ATS check and hallucination scan…
        </span>
      </div>
    );
  }

  const { atsScore, keywordMatches, missingKeywords, hallucinationsFound, hallucinationDetails, overallAssessment } =
    evaluation!;

  return (
    <div data-testid="evaluation-result" className="space-y-4 text-sm">
      {/* Header row: score + hallucination status */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <ScoreBadge score={atsScore} />
          <span className="text-xs text-muted-foreground">ATS Score</span>
        </div>

        <div className="flex-1 space-y-2">
          {/* Hallucination check */}
          <div
            data-testid="hallucination-status"
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
              hallucinationsFound
                ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <span className="mt-0.5 shrink-0">{hallucinationsFound ? "✗" : "✓"}</span>
            <div>
              <span className="font-medium">
                {hallucinationsFound ? "Hallucinations detected" : "No hallucinations found"}
              </span>
              {hallucinationsFound && hallucinationDetails.length > 0 && (
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs opacity-90">
                  {hallucinationDetails.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyword matches */}
      {keywordMatches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Matched keywords ({keywordMatches.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keywordMatches.map((kw) => (
              <Chip key={kw} label={kw} variant="match" />
            ))}
          </div>
        </div>
      )}

      {/* Missing keywords */}
      {missingKeywords.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Missing keywords ({missingKeywords.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => (
              <Chip key={kw} label={kw} variant="missing" />
            ))}
          </div>
        </div>
      )}

      {/* Overall assessment */}
      <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">{overallAssessment}</p>
    </div>
  );
}
