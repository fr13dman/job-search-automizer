"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CoverLetterOutputProps {
  completion: string;
  isLoading: boolean;
  onTextChange: (text: string) => void;
}

function RichPreview({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div
      className="font-mono text-sm leading-relaxed whitespace-pre-wrap rounded-md border bg-muted/30 p-4 min-h-[300px]"
      data-testid="rich-preview"
    >
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-900 text-foreground font-bold px-0.5 rounded"
            >
              {part.slice(2, -2)}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export function CoverLetterOutput({
  completion,
  isLoading,
  onTextChange,
}: CoverLetterOutputProps) {
  const [editedText, setEditedText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsEditing(false);
      setEditedText("");
      setShowRaw(false);
    } else if (completion && !isEditing) {
      setEditedText(completion);
      setIsEditing(true);
      onTextChange(completion);
    }
  }, [completion, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setEditedText(text);
    onTextChange(text);
  }

  const displayText = isEditing ? editedText : completion;

  if (!completion && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground text-sm font-mono">
        Your cover letter will appear here
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="cover-letter-output">Cover Letter</Label>
          {isLoading && (
            <span className="text-sm text-muted-foreground animate-pulse">
              Generating...
            </span>
          )}
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {showRaw ? "Preview" : "Edit"}
          </button>
        )}
      </div>

      {showRaw || isLoading ? (
        <Textarea
          id="cover-letter-output"
          value={displayText}
          onChange={handleChange}
          readOnly={isLoading}
          rows={16}
          className="font-mono text-sm leading-relaxed"
        />
      ) : (
        <RichPreview text={displayText} />
      )}
    </div>
  );
}
