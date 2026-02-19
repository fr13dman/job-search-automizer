"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadPdf } from "@/lib/generate-pdf";
import { extractMetadata, buildPdfFilename } from "@/lib/extract-metadata";

interface ExportToolbarProps {
  text: string;
  jobDescription: string;
  isLoading: boolean;
}

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function ExportToolbar({ text, jobDescription, isLoading }: ExportToolbarProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(stripMarkdownBold(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  function handleDownloadPdf() {
    const metadata = extractMetadata(text, jobDescription);
    const filename = buildPdfFilename(metadata);
    console.log("[ExportToolbar] PDF metadata:", metadata, "filename:", filename);
    downloadPdf(text, metadata, filename);
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        disabled={isLoading || !text}
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadPdf}
        disabled={isLoading || !text}
      >
        Download PDF
      </Button>
    </div>
  );
}
