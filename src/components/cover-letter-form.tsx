"use client";

import { useState, useEffect, useRef } from "react";
import { useCompletion } from "@ai-sdk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JobInput } from "@/components/job-input";
import { ResumeUpload } from "@/components/resume-upload";
import { ToneSelector } from "@/components/tone-selector";
import { CoverLetterOutput } from "@/components/cover-letter-output";
import { CuratedResume } from "@/components/curated-resume";
import { ResumeEvaluation } from "@/components/resume-evaluation";
import { ResumeProgress, type ResumePhase } from "@/components/resume-progress";
import { ExportToolbar } from "@/components/export-toolbar";
import { toast } from "sonner";
import type { Tone, ResumeEvaluation as ResumeEvaluationType, AttemptRecord } from "@/types";
import { restoreProtectedFields } from "@/lib/restore-protected-fields";
import { extractResumeSections } from "@/lib/extract-resume-sections";

const MAX_GENERATION_ATTEMPTS = 3;

const GENERATE_PHRASES = [
  "Generate Magnificence",
  "Craft Brilliance",
  "Forge Excellence",
  "Summon Greatness",
  "Conjure Genius",
  "Unleash Potential",
  "Create the Extraordinary",
  "Inspire Brilliance",
  "Elevate Your Story",
  "Shape Your Narrative",
  "Build Something Remarkable",
  "Craft Your Legacy",
];

function pickPhrase(): string {
  return GENERATE_PHRASES[Math.floor(Math.random() * GENERATE_PHRASES.length)];
}

function buildEvaluationFeedback(
  evaluation: ResumeEvaluationType,
  originalResume: string
): string {
  const lines: string[] = [];

  if (evaluation.hallucinationsFound && evaluation.hallucinationDetails.length > 0) {
    lines.push("Hallucinations that MUST be removed entirely:");
    evaluation.hallucinationDetails.forEach((d) => lines.push(`- ${d}`));
  }

  // Include exact original sections as concrete reference text for restoration
  const { contactBlock, educationBlock } = extractResumeSections(originalResume);
  if (contactBlock) {
    lines.push(
      "\nORIGINAL NAME AND CONTACT BLOCK — copy verbatim, character-for-character:"
    );
    lines.push(contactBlock);
  }
  if (educationBlock) {
    lines.push(
      "\nORIGINAL EDUCATION SECTION — copy verbatim, do not alter any school name, degree, or date:"
    );
    lines.push(educationBlock);
  }

  if (evaluation.missingKeywords.length > 0) {
    lines.push(
      `\nMissing keywords to incorporate (only if supported by original): ${evaluation.missingKeywords.join(", ")}`
    );
  }

  lines.push(
    `\nPrevious ATS score: ${evaluation.atsScore}/100. ${evaluation.overallAssessment}`
  );

  return lines.join("\n");
}

export function CoverLetterForm() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [outputText, setOutputText] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [evaluationResult, setEvaluationResult] = useState<ResumeEvaluationType | null>(null);
  const [finalCuratedResume, setFinalCuratedResume] = useState("");
  const [resumePhase, setResumePhase] = useState<ResumePhase>("idle");
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [attemptHistory, setAttemptHistory] = useState<AttemptRecord[]>([]);
  // Stable initial value for SSR; randomized after hydration
  const [buttonPhrase, setButtonPhrase] = useState(GENERATE_PHRASES[0]);
  useEffect(() => { setButtonPhrase(pickPhrase()); }, []);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [generateCuratedResume, setGenerateCuratedResume] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { completion, isLoading, complete, stop: stopCoverLetter, error } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
    onFinish: async (_prompt, completion) => {
      console.log("[CoverLetterForm] Generation finished, length:", completion.length);
      if (!completion) return; // stream resolved empty — likely a silent API error, no toast
      toast.success("Cover letter generated!");
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti("coverLetter");
    },
    onError: (err) => {
      console.error("[CoverLetterForm] Generation error:", err);
      toast.error(err.message || "Failed to generate cover letter");
    },
  });

  const {
    isLoading: curatedResumeLoading,
    complete: completeCurateResume,
    stop: stopCurateResume,
  } = useCompletion({
    api: "/api/curate-resume",
    streamProtocol: "text",
    onError: (err) => {
      console.error("[CoverLetterForm] Curate resume error:", err);
      if (!abortControllerRef.current?.signal.aborted) {
        toast.error(err.message || "Failed to curate resume");
      }
    },
  });

  async function handleGenerate() {
    if (!jobDescription || !resumeText) return;
    console.log("[CoverLetterForm] Starting generation", {
      jobDescriptionLength: jobDescription.length,
      resumeTextLength: resumeText.length,
      tone,
    });

    // Abort any in-flight previous generation before starting a new one
    abortControllerRef.current?.abort();
    stopCoverLetter();
    stopCurateResume();

    setOutputText("");
    setEvaluationResult(null);
    setFinalCuratedResume("");
    setResumePhase("idle");
    setCurrentAttempt(0);
    setAttemptHistory([]);
    setButtonPhrase(pickPhrase());
    setIsCancelling(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentCurated = "";
    let lastEvaluation: ResumeEvaluationType | null = null;

    try {
      // Cover letter fires once and streams independently — never retried
      if (generateCoverLetter) {
        complete("", {
          body: { resumeText, jobDescription, tone, additionalInstructions: additionalInstructions || undefined },
        }).catch(() => {}); // errors surfaced via the onError callback above
      }

      if (generateCuratedResume) {
        let lastFeedback: string | undefined;

        for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
          if (controller.signal.aborted) break;

          setCurrentAttempt(attempt);
          setResumePhase("curating");

          const curated = await completeCurateResume("", {
            body: {
              resumeText,
              jobDescription,
              evaluationFeedback: lastFeedback,
            },
          });

          if (controller.signal.aborted) break;

          currentCurated = curated ?? "";
          if (!currentCurated) break;

          // Deterministically restore name/contact and EDUCATION before evaluation
          const { text: restoredText, restorations } = restoreProtectedFields(
            currentCurated,
            resumeText
          );
          if (restorations.length > 0) {
            console.log(
              `[CoverLetterForm] Restored ${restorations.length} protected fields:`,
              restorations
            );
          }
          currentCurated = restoredText;

          setResumePhase("evaluating");

          let evaluation: ResumeEvaluationType | null = null;
          let passed = false;
          let evaluationError: string | undefined;

          try {
            const res = await fetch("/api/evaluate-resume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resumeText, jobDescription, curatedResume: currentCurated }),
              signal: controller.signal,
            });

            if (res.ok) {
              evaluation = await res.json();
              lastEvaluation = evaluation;
              passed = !evaluation!.hallucinationsFound;
              console.log(
                `[CoverLetterForm] Evaluation attempt ${attempt}: atsScore=${evaluation!.atsScore}, hallucinationsFound=${evaluation!.hallucinationsFound}`
              );
              if (!controller.signal.aborted && passed) {
                toast.success("Resume curated!");
                const { fireConfetti } = await import("@/lib/confetti");
                fireConfetti("resume");
              }
            } else {
              let details: string | undefined;
              try {
                const errBody = await res.json();
                details = errBody.details as string | undefined;
              } catch {
                // ignore JSON parse failure
              }
              evaluationError = details ?? `Evaluation service returned HTTP ${res.status}.`;
              console.warn(`[CoverLetterForm] Evaluation returned ${res.status} on attempt ${attempt}`, { details });
            }
          } catch (err) {
            if (controller.signal.aborted) break;
            evaluationError = `Evaluation service encountered an error: ${err instanceof Error ? err.message : String(err)}`;
            console.warn(`[CoverLetterForm] Evaluation threw on attempt ${attempt}:`, err);
          }

          // Record this attempt's result in history
          setAttemptHistory((prev) => [
            ...prev,
            { attempt, evaluation, passed, evaluationError },
          ]);

          if (passed || attempt === MAX_GENERATION_ATTEMPTS) break;

          // Build feedback for the next attempt from the failed evaluation
          if (evaluation) {
            lastFeedback = buildEvaluationFeedback(evaluation, resumeText);
            console.log(`[CoverLetterForm] Hallucinations detected, retrying with feedback (attempt ${attempt + 1}/${MAX_GENERATION_ATTEMPTS})`);
          } else {
            console.log(`[CoverLetterForm] Evaluation error, retrying without feedback (attempt ${attempt + 1}/${MAX_GENERATION_ATTEMPTS})`);
          }
        }
      }
    } catch (err) {
      console.warn("[CoverLetterForm] handleGenerate threw:", err);
    } finally {
      if (generateCuratedResume) {
        setResumePhase("done");
        setEvaluationResult(lastEvaluation);
        setFinalCuratedResume(currentCurated);
      }
      setIsCancelling(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    setIsCancelling(true);
    abortControllerRef.current?.abort();
    stopCurateResume();
  }

  const isBusy = isLoading || curatedResumeLoading || resumePhase === "curating" || resumePhase === "evaluating";
  const canGenerate = !!jobDescription && !!resumeText && !isBusy && (generateCoverLetter || generateCuratedResume);

  return (
    <div className="space-y-6">
      {/* ── Row 1: Input + Cover Letter side-by-side ── */}
      <div className={`grid grid-cols-1 gap-6 ${generateCoverLetter ? "lg:grid-cols-2" : ""}`}>
        {/* Input card ── slate-blue accent */}
        <Card className="border-t-4 border-t-blue-600/70 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/60 dark:from-slate-800/50 dark:to-blue-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
            <CardTitle className="text-slate-700 dark:text-slate-200">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <JobInput onJobDescription={setJobDescription} />
            <Separator />
            <ResumeUpload onResumeText={setResumeText} />
            <Separator />
            <ToneSelector value={tone} onChange={setTone} />
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="additional-instructions">Additional instructions (optional)</Label>
              <Textarea
                id="additional-instructions"
                placeholder="e.g. Emphasize leadership experience, mention my interest in remote work, keep it under 300 words..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Generate</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateCoverLetter((v) => !v)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 transition-colors ${
                    generateCoverLetter
                      ? "bg-blue-600 text-white ring-blue-600"
                      : "bg-transparent text-slate-500 ring-slate-300 dark:ring-slate-600 dark:text-slate-400 hover:ring-slate-400"
                  }`}
                >
                  Cover letter
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateCuratedResume((v) => !v)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 transition-colors ${
                    generateCuratedResume
                      ? "bg-blue-600 text-white ring-blue-600"
                      : "bg-transparent text-slate-500 ring-slate-300 dark:ring-slate-600 dark:text-slate-400 hover:ring-slate-400"
                  }`}
                >
                  Curated resume
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="generate-btn"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="btn-gradient-animate flex-1 bg-gradient-to-r from-blue-700 via-violet-600 to-indigo-700 hover:from-blue-800 hover:via-violet-700 hover:to-indigo-800 text-white border-0 shadow-md hover:shadow-lg transition-shadow"
                size="lg"
              >
                {isBusy ? "Generating…" : buttonPhrase}
              </Button>
              {isBusy && (
                <Button
                  data-testid="cancel-btn"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  variant="outline"
                  size="lg"
                  className="shrink-0"
                >
                  {isCancelling ? "Stopping…" : "Stop"}
                </Button>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
                {error.message || "Failed to generate cover letter"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cover Letter Output card ── teal accent */}
        {generateCoverLetter && <Card className="border-t-4 border-t-teal-600/70 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-teal-50/60 dark:from-slate-800/50 dark:to-teal-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-700 dark:text-slate-200">Cover Letter</CardTitle>
              <ExportToolbar
                text={outputText || completion}
                jobDescription={jobDescription}
                resumeText={resumeText}
                isLoading={isLoading}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <CoverLetterOutput
              completion={completion}
              isLoading={isLoading}
              onTextChange={setOutputText}
            />
          </CardContent>
        </Card>}
      </div>

      {/* ── Row 2: Resume Curator / Evaluator — full width ── */}
      {generateCuratedResume && <Card className="border-t-4 border-t-indigo-500/70 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50/60 dark:from-slate-800/50 dark:to-indigo-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
          <CardTitle className="text-slate-700 dark:text-slate-200">Resume Curator</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Generation progress */}
          {resumePhase !== "idle" && (
            <>
              <ResumeProgress
                phase={resumePhase}
                currentAttempt={currentAttempt}
                maxAttempts={MAX_GENERATION_ATTEMPTS}
                history={attemptHistory}
              />
              <Separator />
            </>
          )}

          {/* Final evaluation detail — shown after all attempts complete */}
          {evaluationResult && resumePhase === "done" && (
            <>
              <ResumeEvaluation evaluation={evaluationResult} isLoading={false} />
              <Separator />
            </>
          )}

          {/* Curated resume output */}
          <CuratedResume
            completion={finalCuratedResume}
            isLoading={curatedResumeLoading || resumePhase === "curating" || resumePhase === "evaluating"}
            jobDescription={jobDescription}
          />
        </CardContent>
      </Card>}
    </div>
  );
}
