import { CoverLetterForm } from "@/components/cover-letter-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b">
        {/* Muted slate-blue gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-blue-800 to-indigo-800" />
        {/* Subtle light-scatter overlay */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_20%_50%,white,transparent_55%),radial-gradient(ellipse_at_80%_20%,white,transparent_45%)]" />
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                Job Application Helper
              </h1>
              <p className="text-blue-100 mt-0.5 text-sm">
                AI-powered cover letters and tailored resumes — ready in seconds
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <CoverLetterForm />
      </main>
    </div>
  );
}
