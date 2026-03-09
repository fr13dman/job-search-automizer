"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import {
  extractMetadata,
  buildJdPdfFilename,
  buildPdfFilename,
  buildResumeFilename,
} from "@/lib/extract-metadata";
import { getCoverLetterPdfBlob } from "@/lib/generate-pdf";
import { getResumePdfBlob } from "@/lib/generate-resume-pdf";
import { getJdPdfBlob } from "@/lib/generate-jd-pdf";

interface SaveToFolderProps {
  jobDescription: string;
  sourceUrl?: string;
  coverLetterText?: string;
  curatedResumeText?: string;
  resumeText?: string;
  disabled?: boolean;
  metaOverrides?: { companyName?: string; jobTitle?: string };
}

export function SaveToFolder({
  jobDescription,
  sourceUrl,
  coverLetterText,
  curatedResumeText,
  resumeText = "",
  disabled = false,
  metaOverrides,
}: SaveToFolderProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!jobDescription) return;
    setSaving(true);
    try {
      const base = extractMetadata(coverLetterText ?? "", jobDescription, resumeText);
      const metadata = {
        ...base,
        ...(metaOverrides?.companyName ? { companyName: metaOverrides.companyName } : {}),
        ...(metaOverrides?.jobTitle ? { jobTitle: metaOverrides.jobTitle } : {}),
      };

      const files: Array<{ name: string; blob: Blob }> = [];

      // Job description PDF — always included
      files.push({
        name: buildJdPdfFilename(metadata),
        blob: getJdPdfBlob(jobDescription, metadata, sourceUrl),
      });

      if (coverLetterText) {
        files.push({
          name: buildPdfFilename(metadata),
          blob: getCoverLetterPdfBlob(coverLetterText, metadata),
        });
      }

      if (curatedResumeText) {
        files.push({
          name: buildResumeFilename(metadata) + ".pdf",
          blob: getResumePdfBlob(curatedResumeText),
        });
      }

      // Use File System Access API if available (Chrome/Edge) so the user can
      // pick a destination folder. Fall back to individual <a download> triggers.
      if ("showDirectoryPicker" in window) {
        const dirHandle = await (
          window as typeof window & {
            showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker({ mode: "readwrite" });

        for (const file of files) {
          const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(file.blob);
          await writable.close();
        }

        toast.success(
          `Saved ${files.length} file${files.length !== 1 ? "s" : ""} to selected folder`
        );
      } else {
        // Fallback: trigger a browser download for each file
        for (const file of files) {
          const url = URL.createObjectURL(file.blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        toast.success(`Downloading ${files.length} file${files.length !== 1 ? "s" : ""}…`);
      }
    } catch (err) {
      // User cancelled the directory picker — not an error worth surfacing
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSave}
      disabled={disabled || saving || !jobDescription}
      className="gap-2"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FolderOpen className="h-4 w-4" />
      )}
      {saving ? "Saving…" : "Save Files"}
    </Button>
  );
}
