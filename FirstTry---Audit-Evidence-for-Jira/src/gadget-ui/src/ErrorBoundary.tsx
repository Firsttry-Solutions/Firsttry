/**
 * ErrorBoundary.tsx
 * 
 * React ErrorBoundary component that catches and displays errors gracefully.
 * Ensures the UI never goes blank or freezes silently.
 * 
 * CRITICAL: This component is a safety net. It should never be triggered in normal operation.
 */

import React, { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "Unknown error";
      const errorStack = this.state.errorInfo?.componentStack || "";

      return (
        <div className="error-boundary-container">
          <strong className="error-boundary-title">⚠️ UI Error</strong>
          <div className="error-boundary-message">
            {errorMessage}
          </div>
          {errorStack && (
            <div className="error-boundary-stack">
              {errorStack}
            </div>
          )}
          <div className="error-boundary-footer">
            Refresh the page to retry.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
