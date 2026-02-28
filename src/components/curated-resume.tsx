"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildResumeFilename } from "@/lib/extract-metadata";

interface CuratedResumeProps {
  completion: string;
  isLoading: boolean;
  jobDescription?: string;
}

export function CuratedResume({ completion, isLoading, jobDescription = "" }: CuratedResumeProps) {
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isAnyDownloading = isDownloadingDocx || isDownloadingPdf;

  async function handleDownloadDocx() {
    setIsDownloadingDocx(true);
    try {
      const { downloadDocx } = await import("@/lib/generate-docx");
      const filename = buildResumeFilename(completion, jobDescription);
      await downloadDocx(completion, `${filename}.docx`);
      toast.success("Resume downloaded as DOCX!");
    } catch (err) {
      console.error("[CuratedResume] DOCX download error:", err);
      toast.error("Failed to download resume");
    } finally {
      setIsDownloadingDocx(false);
    }
  }

  async function handleDownloadPdf() {
    setIsDownloadingPdf(true);
    try {
      const { downloadResumePdf } = await import("@/lib/generate-resume-pdf");
      const filename = buildResumeFilename(completion, jobDescription);
      await downloadResumePdf(completion, `${filename}.pdf`);
      toast.success("Resume downloaded as PDF!");
    } catch (err) {
      console.error("[CuratedResume] PDF download error:", err);
      toast.error("Failed to download resume as PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (!completion && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] text-muted-foreground text-sm font-mono">
        Your curated resume will appear here
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isLoading && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Curating...
          </span>
        )}
        {!isLoading && completion && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadDocx}
              disabled={isAnyDownloading}
            >
              {isDownloadingDocx ? "Downloading..." : "Download DOCX"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isAnyDownloading}
            >
              {isDownloadingPdf ? "Downloading..." : "Download PDF"}
            </Button>
          </>
        )}
      </div>
      <div
        data-testid="curated-resume-output"
        className="font-mono text-sm leading-relaxed whitespace-pre-wrap rounded-md border bg-muted/30 p-4 min-h-[120px]"
      >
        {completion.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{part.replace(/\*\*/g, "")}</span>
          )
        )}
      </div>
    </div>
  );
}
