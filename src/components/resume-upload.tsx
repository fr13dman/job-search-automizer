"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ResumeUploadProps {
  onResumeText: (text: string) => void;
}

export function ResumeUpload({ onResumeText }: ResumeUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSuccess(false);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log("[ResumeUpload] Parse response:", { success: data.success, textLength: data.resumeText?.length ?? 0 });

      if (data.success && data.resumeText) {
        setSuccess(true);
        onResumeText(data.resumeText);
      } else {
        console.warn("[ResumeUpload] Parse failed:", data.error);
        setError(data.error || "Failed to parse resume");
      }
    } catch (err) {
      console.error("[ResumeUpload] Fetch error:", err);
      setError("Failed to upload resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="resume-upload">Upload Resume</Label>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? "Parsing..." : "Choose File"}
        </Button>
        <input
          ref={inputRef}
          id="resume-upload"
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        {fileName && (
          <span className="text-sm text-muted-foreground">{fileName}</span>
        )}
      </div>

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-800 dark:text-green-200">
          <span className="font-medium">Resume parsed successfully.</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
