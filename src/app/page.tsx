import { CoverLetterForm } from "@/components/cover-letter-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Cover Letter Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Paste a job URL and upload your resume to generate a tailored cover
            letter
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <CoverLetterForm />
      </main>
    </div>
  );
}
