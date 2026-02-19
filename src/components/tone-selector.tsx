"use client";

import { Label } from "@/components/ui/label";
import { TONE_OPTIONS, type Tone } from "@/types";

interface ToneSelectorProps {
  value: Tone;
  onChange: (tone: Tone) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Tone</Label>
      <div className="flex flex-wrap gap-2">
        {TONE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
              value === option.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/50"
            }`}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
