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
import { ResumeRecommendations } from "@/components/resume-recommendations";
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
    onFinish: (_prompt, completion) => {
      console.log("[CoverLetterForm] Generation finished, length:", completion.length);
      toast.success("Cover letter generated!");
    },
    onError: (err) => {
      console.error("[CoverLetterForm] Generation error:", err);
      toast.error("Failed to generate cover letter");
    },
  });

  const {
    completion: recommendationsCompletion,
    isLoading: recommendationsLoading,
    complete: completeRecommendations,
  } = useCompletion({
    api: "/api/recommendations",
    streamProtocol: "text",
    onError: (err) => {
      console.error("[CoverLetterForm] Recommendations error:", err);
      toast.error("Failed to generate recommendations");
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
      const recommendationsPromise = completeRecommendations("", {
        body: { resumeText, jobDescription },
      });
      await Promise.all([coverLetterPromise, recommendationsPromise]);
    } catch (err) {
      console.error("[CoverLetterForm] complete() threw:", err);
    }
  }

  const canGenerate = !!jobDescription && !!resumeText && !isLoading && !recommendationsLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
            className="w-full"
            size="lg"
          >
            {isLoading || recommendationsLoading ? "Generating..." : "Generate Cover Letter"}
          </Button>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error.message || "Failed to generate cover letter"}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Output</CardTitle>
              <ExportToolbar
                text={outputText || completion}
                jobDescription={jobDescription}
                isLoading={isLoading}
              />
            </div>
          </CardHeader>
          <CardContent>
            <CoverLetterOutput
              completion={completion}
              isLoading={isLoading}
              onTextChange={setOutputText}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ResumeRecommendations
              completion={recommendationsCompletion}
              isLoading={recommendationsLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
