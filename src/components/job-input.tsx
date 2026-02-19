"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

interface JobInputProps {
  onJobDescription: (text: string) => void;
}

export function JobInput({ onJobDescription }: JobInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");

  async function handleFetch() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setSuccess(false);

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
        setPreview(data.jobDescription.slice(0, 200) + "...");
        onJobDescription(data.jobDescription);
      } else {
        console.warn("[JobInput] Scrape failed:", data.error);
        setError(data.error || "Failed to scrape job posting");
        setShowManual(true);
      }
    } catch (err) {
      console.error("[JobInput] Fetch error:", err);
      setError("Failed to fetch job posting");
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit() {
    if (manualText.trim()) {
      onJobDescription(manualText.trim());
      setSuccess(true);
      setPreview(manualText.trim().slice(0, 200) + "...");
    }
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
        <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-800 dark:text-green-200">
          <span className="font-medium">Job description loaded.</span>{" "}
          <span className="text-green-600 dark:text-green-400">{preview}</span>
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
