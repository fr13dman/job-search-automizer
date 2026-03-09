"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import {
  extractMetadata,
  buildFolderName,
  buildJdPdfFilename,
  buildPdfFilename,
  buildResumeFilename,
} from "@/lib/extract-metadata";
import { getCoverLetterPdfBlob } from "@/lib/generate-pdf";
import { getResumePdfBlob } from "@/lib/generate-resume-pdf";
import { getJdPdfBlob } from "@/lib/generate-jd-pdf";

const COOKIE_KEY = "job_search_root_folder";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${encodeURIComponent(name)}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieValue(name: string, value: string, maxAge: number) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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
  const [showInput, setShowInput] = useState(false);
  const [rootFolderInput, setRootFolderInput] = useState("");
  // The currently configured root folder (from cookie — env is checked server-side)
  const [configuredFolder, setConfiguredFolder] = useState<string | null>(null);

  // Read cookie on mount so we can show the configured path
  useEffect(() => {
    const cookie = getCookieValue(COOKIE_KEY);
    if (cookie) setConfiguredFolder(cookie);
  }, []);

  async function getEnvRootFolder(): Promise<string | null> {
    try {
      const res = await fetch("/api/save-documents");
      const data = await res.json();
      return data.rootFolder ?? null;
    } catch {
      return null;
    }
  }

  async function doSave(rootFolder: string) {
    setSaving(true);
    setShowInput(false);
    let failed = false;
    try {
      const base = extractMetadata(coverLetterText ?? "", jobDescription, resumeText);
      const metadata = {
        ...base,
        ...(metaOverrides?.companyName ? { companyName: metaOverrides.companyName } : {}),
        ...(metaOverrides?.jobTitle ? { jobTitle: metaOverrides.jobTitle } : {}),
      };
      const companyName = metadata.companyName ?? "job-application";
      const folderName = buildFolderName(companyName);

      const files: Array<{ name: string; content: string }> = [];

      // Job description PDF — always included
      const jdBlob = getJdPdfBlob(jobDescription, metadata, sourceUrl);
      files.push({ name: buildJdPdfFilename(metadata), content: await blobToBase64(jdBlob) });

      // Cover letter PDF
      if (coverLetterText) {
        const clBlob = getCoverLetterPdfBlob(coverLetterText, metadata);
        files.push({ name: buildPdfFilename(metadata), content: await blobToBase64(clBlob) });
      }

      // Curated resume PDF
      if (curatedResumeText) {
        const resumeBlob = getResumePdfBlob(curatedResumeText);
        const resumeFilename = buildResumeFilename(metadata) + ".pdf";
        files.push({ name: resumeFilename, content: await blobToBase64(resumeBlob) });
      }

      const saveRes = await fetch("/api/save-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootFolder, folderName, files }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        toast.success(
          `Saved ${files.length} file${files.length !== 1 ? "s" : ""} to ${saveData.path}`
        );
      } else {
        const detail = saveData.code ? ` (${saveData.code})` : "";
        toast.error((saveData.error ?? "Failed to save files") + detail);
        failed = true;
      }
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
      failed = true;
    } finally {
      setSaving(false);
      if (failed) {
        // Re-show input form pre-populated with the failing path so user can correct it
        setRootFolderInput(rootFolder);
        setShowInput(true);
      }
    }
  }

  async function handleSave() {
    if (!jobDescription) return;

    // Check env var first, then cookie, then show inline input
    const envFolder = await getEnvRootFolder();
    if (envFolder) {
      await doSave(envFolder);
      return;
    }

    const cookieFolder = getCookieValue(COOKIE_KEY);
    if (cookieFolder) {
      await doSave(cookieFolder);
      return;
    }

    setShowInput(true);
  }

  async function handleConfirm() {
    const folder = rootFolderInput.trim();
    if (!folder) return;
    setCookieValue(COOKIE_KEY, folder, COOKIE_MAX_AGE);
    setConfiguredFolder(folder);
    await doSave(folder);
  }

  function handleChange() {
    setRootFolderInput(configuredFolder ?? "");
    setShowInput(true);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
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
          {saving ? "Saving…" : "Save Documents"}
        </Button>

        {configuredFolder && !showInput && (
          <span className="text-xs text-muted-foreground">
            {configuredFolder}
            {" · "}
            <button
              type="button"
              className="underline hover:text-foreground transition-colors"
              onClick={handleChange}
            >
              change
            </button>
          </span>
        )}
      </div>

      {showInput && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <Label htmlFor="root-folder" className="text-sm">
            Root folder path
          </Label>
          <Input
            id="root-folder"
            placeholder="/Users/yourname/Documents/Job Search"
            value={rootFolderInput}
            onChange={(e) => setRootFolderInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") setShowInput(false);
            }}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Use a full absolute path (e.g.{" "}
            <code className="bg-background px-1 rounded text-xs">
              /Users/yourname/Documents/Job Search
            </code>{" "}
            or{" "}
            <code className="bg-background px-1 rounded text-xs">~/Documents/Job Search</code>).
            Documents will be saved in a subfolder named{" "}
            <code className="bg-background px-1 rounded text-xs">company-mmyyyy</code>. Path is
            remembered in your browser. Set{" "}
            <code className="bg-background px-1 rounded text-xs">ROOT_FOLDER</code> in{" "}
            <code className="bg-background px-1 rounded text-xs">.env</code> to skip this prompt.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirm} disabled={!rootFolderInput.trim()}>
              Save Here
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
