import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBackOnline(true);
        setTimeout(() => setShowBackOnline(false), 3000);
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-elegant",
        "transition-all duration-300 animate-in-up",
        isOnline
          ? "bg-success text-success-foreground"
          : "bg-destructive text-destructive-foreground"
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-success-foreground/80 animate-pulse" />
          Tillbaka online
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          Ingen uppkoppling
        </>
      )}
    </div>
  );
}
