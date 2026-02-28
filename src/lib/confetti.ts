export async function fireConfetti(
  type: "coverLetter" | "resume" = "coverLetter"
): Promise<void> {
  const confetti = (await import("canvas-confetti")).default;

  if (type === "coverLetter") {
    // Big celebration burst from center
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.55 },
      colors: ["#a855f7", "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"],
    });
    // Secondary burst slightly delayed
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        angle: 75,
        origin: { x: 0.2, y: 0.6 },
        colors: ["#c084fc", "#818cf8", "#f472b6"],
      });
      confetti({
        particleCount: 80,
        spread: 60,
        angle: 105,
        origin: { x: 0.8, y: 0.6 },
        colors: ["#34d399", "#fbbf24", "#60a5fa"],
      });
    }, 200);
  } else {
    // Smaller side burst for resume
    confetti({
      particleCount: 90,
      spread: 55,
      angle: 100,
      origin: { x: 0.95, y: 0.65 },
      colors: ["#a855f7", "#c084fc", "#e879f9", "#818cf8"],
    });
  }
}
