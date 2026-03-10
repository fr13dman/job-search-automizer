"use client";

import { Loader2, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Lightbulb, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { CoverLetterEvaluation } from "@/types";

interface CoverLetterEvaluationProps {
  evaluation: CoverLetterEvaluation | null;
  isLoading: boolean;
  error?: string | null;
}

function VerdictBadge({ evaluation }: { evaluation: CoverLetterEvaluation }) {
  const configs = {
    "Looks Human": {
      icon: ShieldCheck,
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      ring: "ring-emerald-200 dark:ring-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    "Borderline": {
      icon: ShieldAlert,
      bg: "bg-amber-50 dark:bg-amber-950/40",
      ring: "ring-amber-200 dark:ring-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    "Likely AI": {
      icon: ShieldX,
      bg: "bg-red-50 dark:bg-red-950/40",
      ring: "ring-red-200 dark:ring-red-800",
      text: "text-red-700 dark:text-red-300",
      dot: "bg-red-500",
    },
  };

  const cfg = configs[evaluation.verdict];
  const Icon = cfg.icon;

  return (
    <div className={`inline-flex items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ${cfg.bg} ${cfg.ring}`}>
      <Icon className={`h-4 w-4 shrink-0 ${cfg.text}`} />
      <div>
        <div className={`text-sm font-semibold leading-none ${cfg.text}`}>
          {evaluation.verdict}
        </div>
        <div className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>
          Human score: {evaluation.humanScore}/100
        </div>
      </div>
      {/* Score bar */}
      <div className="ml-1 h-1.5 w-20 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${cfg.dot}`}
          style={{ width: `${evaluation.humanScore}%` }}
        />
      </div>
    </div>
  );
}

export function CoverLetterEvaluationPanel({
  evaluation,
  isLoading,
  error,
}: CoverLetterEvaluationProps) {
  if (!isLoading && !evaluation && !error) return null;

  return (
    <div className="space-y-4">
      <Separator />
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI Detection Check
        </h3>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analysing for AI patterns…
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-start gap-2.5 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2.5 ring-1 ring-red-200 dark:ring-red-800">
            <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">AI detection check failed</p>
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {evaluation && (
          <div className="space-y-4">
            <VerdictBadge evaluation={evaluation} />

            {evaluation.aiSignals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Flagged Signals
                </h4>
                <ul className="space-y-1.5">
                  {evaluation.aiSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-3 w-3 text-violet-500" />
                  Suggestions
                </h4>
                <ul className="space-y-1.5">
                  {evaluation.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
