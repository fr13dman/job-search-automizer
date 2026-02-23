"use client";

interface ResumeRecommendationsProps {
  completion: string;
  isLoading: boolean;
}

export function ResumeRecommendations({ completion, isLoading }: ResumeRecommendationsProps) {
  if (!completion && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] text-muted-foreground text-sm font-mono">
        Resume recommendations will appear here
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isLoading && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Analyzing...
          </span>
        )}
      </div>
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap rounded-md border bg-muted/30 p-4 min-h-[120px]">
        {completion}
      </div>
    </div>
  );
}
