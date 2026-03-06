"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileDown, FileText } from "lucide-react";
import { downloadPdf } from "@/lib/generate-pdf";
import { downloadDocx } from "@/lib/generate-docx";
import { extractMetadata, buildPdfFilename, buildCoverLetterDocxFilename } from "@/lib/extract-metadata";
import { toast } from "sonner";

interface ExportToolbarProps {
  text: string;
  jobDescription: string;
  resumeText?: string;
  isLoading: boolean;
}

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function ExportToolbar({ text, jobDescription, resumeText = "", isLoading }: ExportToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(stripMarkdownBold(text));
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  function handleDownloadPdf() {
    const metadata = extractMetadata(text, jobDescription, resumeText);
    const filename = buildPdfFilename(metadata);
    console.log("[ExportToolbar] PDF metadata:", metadata, "filename:", filename);
    downloadPdf(text, metadata, filename);
    toast.success("PDF downloaded");
  }

  async function handleDownloadDocx() {
    setIsDownloadingDocx(true);
    try {
      const metadata = extractMetadata(text, jobDescription, resumeText);
      const filename = buildCoverLetterDocxFilename(metadata);
      await downloadDocx(text, metadata, filename);
      toast.success("DOCX downloaded");
    } catch {
      toast.error("Failed to download DOCX");
    } finally {
      setIsDownloadingDocx(false);
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        disabled={isLoading || !text}
        aria-label={copied ? "Copied!" : "Copy"}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownloadDocx}
        disabled={isLoading || !text || isDownloadingDocx}
        aria-label="Download DOCX"
        title="Download as Word document"
      >
        <FileText className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownloadPdf}
        disabled={isLoading || !text}
        aria-label="Download PDF"
        title="Download as PDF"
      >
        <FileDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
