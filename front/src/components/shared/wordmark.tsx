import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif text-2xl tracking-tight text-ink", className)}>
      Vera<span className="text-accent">.</span>
    </span>
  );
}
