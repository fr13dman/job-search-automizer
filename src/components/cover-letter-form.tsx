"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JobInput } from "@/components/job-input";
import { ResumeUpload } from "@/components/resume-upload";
import { ToneSelector } from "@/components/tone-selector";
import { CoverLetterOutput } from "@/components/cover-letter-output";
import { ExportToolbar } from "@/components/export-toolbar";
import type { Tone } from "@/types";

export function CoverLetterForm() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [outputText, setOutputText] = useState("");

  const { completion, isLoading, complete, error } = useCompletion({
    api: "/api/generate",
    streamProtocol: "text",
    onFinish: (_prompt, completion) => {
      console.log("[CoverLetterForm] Generation finished, length:", completion.length);
    },
    onError: (err) => {
      console.error("[CoverLetterForm] Generation error:", err);
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
      await complete("", {
        body: { resumeText, jobDescription, tone },
      });
    } catch (err) {
      console.error("[CoverLetterForm] complete() threw:", err);
    }
  }

  const canGenerate = !!jobDescription && !!resumeText && !isLoading;

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
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Generating..." : "Generate Cover Letter"}
          </Button>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error.message || "Failed to generate cover letter"}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
