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

export interface GenerateRequest {
  resumeText: string;
  jobDescription: string;
}

export interface PromptParts {
  system: string;
  user: string;
}
