"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { extractJobMeta } from "@/lib/extract-metadata";

export interface JobMeta {
  companyName: string;
  jobTitle: string;
}

interface JobInputProps {
  onJobDescription: (text: string) => void;
  onJobUrl?: (url: string) => void;
  onJobMeta?: (meta: JobMeta) => void;
}

export function JobInput({ onJobDescription, onJobUrl, onJobMeta }: JobInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");

  // Confirmed company / position shown after load — user can edit inline
  const [confirmedCompany, setConfirmedCompany] = useState("");
  const [confirmedTitle, setConfirmedTitle] = useState("");

  function applyJobMeta(jd: string) {
    const extracted = extractJobMeta(jd);
    setConfirmedCompany(extracted.companyName);
    setConfirmedTitle(extracted.jobTitle);
    onJobMeta?.(extracted);
  }

  function handleMetaChange(field: "company" | "title", value: string) {
    if (field === "company") {
      setConfirmedCompany(value);
      onJobMeta?.({ companyName: value, jobTitle: confirmedTitle });
    } else {
      setConfirmedTitle(value);
      onJobMeta?.({ companyName: confirmedCompany, jobTitle: value });
    }
  }

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    setConfirmedCompany("");
    setConfirmedTitle("");

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      console.log("[JobInput] Scrape response:", { success: data.success, textLength: data.jobDescription?.length ?? 0 });

      if (data.success && data.jobDescription) {
        setSuccess(true);
        onJobDescription(data.jobDescription);
        onJobUrl?.(url);
        applyJobMeta(data.jobDescription);
        toast.success("Job description loaded successfully");
      } else {
        console.warn("[JobInput] Scrape failed:", data.error);
        setError(data.error || "Failed to scrape job posting");
        setShowManual(true);
        toast.error("Failed to scrape job posting");
      }
    } catch (err) {
      console.error("[JobInput] Fetch error:", err);
      setError("Failed to fetch job posting");
      setShowManual(true);
      toast.error("Failed to fetch job posting");
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit() {
    const jd = manualText.trim();
    if (!jd) return;
    onJobDescription(jd);
    setSuccess(true);
    applyJobMeta(jd);
    toast.success("Job description loaded successfully");
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="job-url">Job Posting URL</Label>
      <div className="flex gap-2">
        <Input
          id="job-url"
          type="url"
          placeholder="https://example.com/job-posting"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
          disabled={loading}
        />
        <Button onClick={handleFetch} disabled={loading || !url.trim()}>
          {loading ? "Fetching..." : "Fetch"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <div className="space-y-2">
          <div className="rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-800 dark:text-green-200 font-medium">
            Job description loaded — confirm the details below:
          </div>

          {/* Editable company + position confirmation */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="confirmed-company" className="text-xs text-muted-foreground">
                Company
              </Label>
              <Input
                id="confirmed-company"
                value={confirmedCompany}
                onChange={(e) => handleMetaChange("company", e.target.value)}
                placeholder="Company name"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="confirmed-title" className="text-xs text-muted-foreground">
                Position
              </Label>
              <Input
                id="confirmed-title"
                value={confirmedTitle}
                onChange={(e) => handleMetaChange("title", e.target.value)}
                placeholder="Job title"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These are used for file naming and PDF headers — edit if incorrect.
          </p>
        </div>
      )}

      {!showManual && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline hover:text-foreground"
          onClick={() => setShowManual(true)}
        >
          Paste manually instead
        </button>
      )}

      {showManual && (
        <div className="space-y-2">
          <Label htmlFor="manual-job">Paste Job Description</Label>
          <Textarea
            id="manual-job"
            placeholder="Paste the job description here..."
            rows={6}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={handleManualSubmit}
            disabled={!manualText.trim()}
          >
            Use This Description
          </Button>
        </div>
      )}
    </div>
  );
}
