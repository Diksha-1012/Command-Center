import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * NEXUS ERROR BOUNDARY
 * ======================================================================
 * A rendering error anywhere in the tree degrades to an honest, recoverable
 * panel instead of a blank screen — the app must never crash on a bad record,
 * a missing relation or a failed network call.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("NEXUS recovered from a render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 p-6">
        <div className="max-w-lg rounded-2xl border border-rose-400/25 bg-rose-500/8 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/30 bg-rose-500/12 text-rose-300">
            <AlertTriangle size={22} />
          </div>
          <h1 className="mt-4 text-base font-semibold text-slate-100">Something went wrong on this screen</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            NEXUS caught the error before it could crash the app. Your live operational data is safe — it is stored
            separately from the view that failed.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-white/8 bg-black/30 p-3 text-left text-[11px] text-rose-200">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <RefreshCw size={14} /> Reload workspace
          </button>
        </div>
      </div>
    );
  }
}
