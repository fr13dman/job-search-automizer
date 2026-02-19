export interface ScrapeResult {
  success: boolean;
  jobDescription?: string;
  error?: string;
}

export interface ParseResumeResult {
  success: boolean;
  resumeText?: string;
  error?: string;
}

export type Tone = "professional" | "friendly" | "concise" | "enthusiastic" | "confident";

export const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Polished and formal" },
  { value: "friendly", label: "Friendly", description: "Warm and approachable" },
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "enthusiastic", label: "Enthusiastic", description: "Energetic and passionate" },
  { value: "confident", label: "Confident", description: "Bold and assertive" },
];

export interface GenerateRequest {
  resumeText: string;
  jobDescription: string;
  tone: Tone;
}

export interface PromptParts {
  system: string;
  user: string;
}

export interface PdfMetadata {
  candidateName?: string;
  companyName?: string;
  jobTitle?: string;
}
