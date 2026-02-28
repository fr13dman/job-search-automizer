"use client";

import { useState } from "react";
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
import { ExportToolbar } from "@/components/export-toolbar";
import { toast } from "sonner";
import type { Tone } from "@/types";

export function CoverLetterForm() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [outputText, setOutputText] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const { completion, isLoading, complete, error } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
    onFinish: async (_prompt, completion) => {
      console.log("[CoverLetterForm] Generation finished, length:", completion.length);
      toast.success("Cover letter generated!");
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti("coverLetter");
    },
    onError: (err) => {
      console.error("[CoverLetterForm] Generation error:", err);
      toast.error("Failed to generate cover letter");
    },
  });

  const {
    completion: curatedResumeCompletion,
    isLoading: curatedResumeLoading,
    complete: completeCurateResume,
  } = useCompletion({
    api: "/api/curate-resume",
    streamProtocol: "text",
    onFinish: async (_prompt, completion) => {
      console.log("[CoverLetterForm] Resume curated, length:", completion.length);
      toast.success("Resume curated!");
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti("resume");
    },
    onError: (err) => {
      console.error("[CoverLetterForm] Curate resume error:", err);
      toast.error("Failed to curate resume");
    },
  });

  async function handleGenerate() {
    if (!jobDescription || !resumeText) return;
    console.log("[CoverLetterForm] Starting generation", {
      jobDescriptionLength: jobDescription.length,
      resumeTextLength: resumeText.length,
      tone,
    });
    setOutputText("");
    try {
      const coverLetterPromise = complete("", {
        body: { resumeText, jobDescription, tone, additionalInstructions: additionalInstructions || undefined },
      });
      const curateResumePromise = completeCurateResume("", {
        body: { resumeText, jobDescription },
      });
      await Promise.all([coverLetterPromise, curateResumePromise]);
    } catch (err) {
      console.error("[CoverLetterForm] complete() threw:", err);
    }
  }

  const canGenerate = !!jobDescription && !!resumeText && !isLoading && !curatedResumeLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Input card ── slate-blue accent */}
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
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white border-0 shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            {isLoading || curatedResumeLoading ? "Generating..." : "Generate Cover Letter"}
          </Button>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error.message || "Failed to generate cover letter"}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {/* ── Output card ── teal accent */}
        <Card className="border-t-4 border-t-teal-600/70 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-teal-50/60 dark:from-slate-800/50 dark:to-teal-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-700 dark:text-slate-200">Output</CardTitle>
              <ExportToolbar
                text={outputText || completion}
                jobDescription={jobDescription}
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
        </Card>

        {/* ── Curated Resume card ── indigo accent */}
        <Card className="border-t-4 border-t-indigo-500/70 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50/60 dark:from-slate-800/50 dark:to-indigo-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
            <CardTitle className="text-slate-700 dark:text-slate-200">Curated Resume</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <CuratedResume
              completion={curatedResumeCompletion}
              isLoading={curatedResumeLoading}
              jobDescription={jobDescription}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
