"use client";

import { useState } from "react";
import { Building2, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CompanyInfo } from "@/types";

interface CompanyInfoCardProps {
  jobDescription: string;
  companyName?: string;
  sourceUrl?: string;
}

export function CompanyInfoCard({
  jobDescription,
  companyName,
  sourceUrl,
}: CompanyInfoCardProps) {
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchCompanyInfo() {
    setIsLoading(true);
    setInfo(null);
    try {
      const res = await fetch("/api/company-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, companyName, sourceUrl }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data: CompanyInfo = await res.json();
      setInfo(data);
    } catch (err) {
      console.error("[CompanyInfoCard] Error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to research company");
    } finally {
      setIsLoading(false);
    }
  }

  const displayName = companyName || "Company";

  return (
    <Card className="border-t-4 border-t-violet-500/70 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-violet-50/60 dark:from-slate-800/50 dark:to-violet-950/30 rounded-t-[calc(var(--radius-lg)-1px)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            Company Intelligence
          </CardTitle>
          {info && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCompanyInfo}
              aria-label="Re-research company"
              title="Re-research company"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Initial / retry state */}
        {!info && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              Research {displayName} — extract company values, mission, and relevant links from the job description.
            </p>
            <Button
              onClick={fetchCompanyInfo}
              disabled={!jobDescription}
              variant="outline"
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              Research {displayName}
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Researching {displayName}…
          </div>
        )}

        {/* Results */}
        {info && !isLoading && (
          <div className="space-y-6">
            {/* Description */}
            {info.description && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  About
                </h3>
                <p className="text-sm leading-relaxed text-foreground">
                  {info.description}
                </p>
              </div>
            )}

            {/* Values */}
            {info.values.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Values & Culture
                </h3>
                <div className="flex flex-wrap gap-2">
                  {info.values.map((value, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 px-3 py-1 text-sm font-medium text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-800"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {info.links.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Useful Links
                </h3>
                <ul className="space-y-1.5">
                  {info.links.map((link, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {link.label}
                      </a>
                      {link.sourced === "inferred" && (
                        <span className="text-xs text-muted-foreground">(suggested)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
