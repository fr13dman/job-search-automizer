"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CoverLetterOutputProps {
  completion: string;
  isLoading: boolean;
  onTextChange: (text: string) => void;
}

export function CoverLetterOutput({
  completion,
  isLoading,
  onTextChange,
}: CoverLetterOutputProps) {
  const [editedText, setEditedText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsEditing(false);
      setEditedText("");
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
      <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground text-sm">
        Your cover letter will appear here
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="cover-letter-output">Cover Letter</Label>
        {isLoading && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Generating...
          </span>
        )}
      </div>
      <Textarea
        id="cover-letter-output"
        value={displayText}
        onChange={handleChange}
        readOnly={isLoading}
        rows={16}
        className="font-serif text-sm leading-relaxed"
      />
    </div>
  );
}
