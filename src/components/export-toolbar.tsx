"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadPdf } from "@/lib/generate-pdf";

interface ExportToolbarProps {
  text: string;
  isLoading: boolean;
}

export function ExportToolbar({ text, isLoading }: ExportToolbarProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  function handleDownloadPdf() {
    downloadPdf(text);
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
