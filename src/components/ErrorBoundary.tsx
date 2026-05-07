import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold font-display">Något gick fel</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Ett oväntat fel inträffade på den här sidan. Övriga delar av appen är opåverkade.
            </p>
          </div>
          {this.state.error && (
            <p className="text-xs text-muted-foreground/60 font-mono max-w-xs truncate">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              <RefreshCw className="h-4 w-4" /> Försök igen
            </Button>
            <Button
              className="rounded-xl bg-gradient-primary"
              onClick={() => window.location.reload()}
            >
              Ladda om sidan
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
