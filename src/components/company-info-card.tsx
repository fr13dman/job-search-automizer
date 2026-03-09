"use client";

import { useState } from "react";
import { Building2, ExternalLink, Loader2, RotateCcw, Sparkles, Cpu, Newspaper, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { CompanyInfo, CompanyDeepInfo } from "@/types";

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
  const [deepInfo, setDeepInfo] = useState<CompanyDeepInfo | null>(null);
  const [isLoadingDeep, setIsLoadingDeep] = useState(false);

  async function fetchCompanyInfo() {
    setIsLoading(true);
    setInfo(null);
    setDeepInfo(null);
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

  async function fetchDeepInfo() {
    if (!info || !companyName) return;
    setIsLoadingDeep(true);
    setDeepInfo(null);
    try {
      const res = await fetch("/api/company-info-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          sourceUrl,
          existingDescription: info.description,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data: CompanyDeepInfo = await res.json();
      setDeepInfo(data);
    } catch (err) {
      console.error("[CompanyInfoCard] Deep info error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to fetch additional company info");
    } finally {
      setIsLoadingDeep(false);
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

            {/* Deep info sections */}
            {deepInfo && (
              <>
                <Separator />

                {deepInfo.keyFacts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3 w-3" />
                      Key Facts
                    </h3>
                    <ul className="space-y-1">
                      {deepInfo.keyFacts.map((fact, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {deepInfo.techStack.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Cpu className="h-3 w-3" />
                      Tech Stack
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {deepInfo.techStack.map((tech, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {deepInfo.recentHighlights.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Newspaper className="h-3 w-3" />
                      Recent Highlights
                    </h3>
                    <ul className="space-y-1">
                      {deepInfo.recentHighlights.map((highlight, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {deepInfo.additionalLinks.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Additional Links
                    </h3>
                    <ul className="space-y-1.5">
                      {deepInfo.additionalLinks.map((link, i) => (
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
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Get More Info / loading state */}
            <div className="pt-2">
              {isLoadingDeep ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching the web for more on {displayName}…
                </div>
              ) : (
                !deepInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchDeepInfo}
                    disabled={!companyName}
                    className="gap-2 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Get More Info
                  </Button>
                )
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
