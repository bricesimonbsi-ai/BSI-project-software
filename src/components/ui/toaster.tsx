import { useToastStore } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start justify-between gap-2 rounded-md border border-border bg-card p-4 shadow-lg",
            t.variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground"
          )}
        >
          <div>
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-1 text-sm opacity-90">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
