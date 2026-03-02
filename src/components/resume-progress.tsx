"use client";

import { useState } from "react";
import type { AttemptRecord } from "@/types";

export type ResumePhase = "idle" | "curating" | "evaluating" | "done";

interface ResumeProgressProps {
  phase: ResumePhase;
  currentAttempt: number;
  maxAttempts: number;
  history: AttemptRecord[];
}

type StepStatus = "pending" | "active" | "done" | "failed";

function StepBubble({ status, label }: { status: StepStatus; label: string }) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0";

  const style =
    status === "active"
      ? `${base} border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400`
      : status === "done"
      ? `${base} bg-emerald-500 border-2 border-emerald-500 text-white`
      : status === "failed"
      ? `${base} bg-red-500 border-2 border-red-500 text-white`
      : `${base} border-2 border-muted-foreground/20 text-muted-foreground/30`;

  const icon =
    status === "active" ? "↻" : status === "done" ? "✓" : status === "failed" ? "✗" : "○";

  const labelStyle =
    status === "active"
      ? "text-blue-600 dark:text-blue-400 font-semibold"
      : status === "done"
      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
      : status === "failed"
      ? "text-red-600 dark:text-red-400 font-semibold"
      : "text-muted-foreground/40";

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className={`${style} ${status === "active" ? "animate-spin" : ""}`}>{icon}</div>
      <span className={`text-[10px] uppercase tracking-wide ${labelStyle}`}>{label}</span>
    </div>
  );
}

function Pipe({ filled }: { filled: boolean }) {
  return (
    <div
      className={`flex-1 h-0.5 mb-4 transition-colors duration-500 ${
        filled ? "bg-emerald-400" : "bg-muted/40"
      }`}
    />
  );
}

function EvalSummary({ record }: { record: AttemptRecord }) {
  const [expanded, setExpanded] = useState(false);

  if (!record.evaluation) {
    return (
      <div className="mt-1 ml-1 pl-3 border-l-2 border-muted/40 text-xs text-muted-foreground space-y-1">
        <p>
          Evaluation unavailable —{" "}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded ? "hide details" : "view details"}
          </button>
        </p>
        {expanded && (
          <p className="italic text-muted-foreground/70">
            {record.evaluationError ?? "The evaluation service did not return a response. The resume will be retried automatically."}
          </p>
        )}
      </div>
    );
  }

  const { atsScore, hallucinationsFound, hallucinationDetails, missingKeywords, overallAssessment } =
    record.evaluation;

  return (
    <div
      className={`mt-2 ml-1 pl-3 border-l-2 text-xs space-y-1 ${
        record.passed ? "border-emerald-400" : "border-red-400"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`font-semibold ${
            record.passed
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          ATS {atsScore}/100
        </span>
        {hallucinationsFound ? (
          <span className="text-red-500 dark:text-red-400 font-medium">⚠ Hallucinations found</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">✓ No hallucinations</span>
        )}
      </div>

      {hallucinationDetails.length > 0 && (
        <ul className="space-y-0.5 text-red-600 dark:text-red-400">
          {hallucinationDetails.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      )}

      {missingKeywords.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium">Missing keywords:</span> {missingKeywords.join(", ")}
        </p>
      )}

      <p className="text-muted-foreground italic leading-relaxed">{overallAssessment}</p>
    </div>
  );
}

interface AttemptRowProps {
  attemptNumber: number;
  maxAttempts: number;
  curatingStatus: StepStatus;
  evaluatingStatus: StepStatus;
  resultLabel: string;
  resultStatus: StepStatus;
  record?: AttemptRecord;
}

function AttemptRow({
  attemptNumber,
  maxAttempts,
  curatingStatus,
  evaluatingStatus,
  resultLabel,
  resultStatus,
  record,
}: AttemptRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        Attempt {attemptNumber}
        {maxAttempts > 1 && (
          <span className="font-normal text-muted-foreground/60"> of {maxAttempts}</span>
        )}
      </p>
      <div className="flex items-center">
        <StepBubble status={curatingStatus} label="Curating" />
        <Pipe filled={curatingStatus === "done"} />
        <StepBubble status={evaluatingStatus} label="Evaluating" />
        <Pipe filled={evaluatingStatus === "done" || evaluatingStatus === "failed"} />
        <StepBubble status={resultStatus} label={resultLabel} />
      </div>
      {record && <EvalSummary record={record} />}
    </div>
  );
}

export function ResumeProgress({
  phase,
  currentAttempt,
  maxAttempts,
  history,
}: ResumeProgressProps) {
  if (phase === "idle") return null;

  return (
    <div data-testid="resume-progress" className="space-y-5">
      {/* Completed attempts */}
      {history.map((rec) => (
        <AttemptRow
          key={rec.attempt}
          attemptNumber={rec.attempt}
          maxAttempts={maxAttempts}
          curatingStatus="done"
          evaluatingStatus={rec.passed ? "done" : "failed"}
          resultStatus={rec.passed ? "done" : "failed"}
          resultLabel={rec.passed ? "Passed" : "Failed"}
          record={rec}
        />
      ))}

      {/* Current in-progress attempt */}
      {(phase === "curating" || phase === "evaluating") && (
        <AttemptRow
          attemptNumber={currentAttempt}
          maxAttempts={maxAttempts}
          curatingStatus={phase === "curating" ? "active" : "done"}
          evaluatingStatus={phase === "evaluating" ? "active" : "pending"}
          resultStatus="pending"
          resultLabel="Result"
        />
      )}
    </div>
  );
}
