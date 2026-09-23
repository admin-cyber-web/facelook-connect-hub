import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught:", error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-4 m-2 bg-red-50 border border-red-200 rounded-2xl text-center">
          <p className="text-red-600 font-black text-sm mb-2">
            Kuch galat ho gaya
          </p>
          <p className="text-red-400 text-xs mb-3">
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={this.reset}
            className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-full active:scale-95 transition-transform"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
