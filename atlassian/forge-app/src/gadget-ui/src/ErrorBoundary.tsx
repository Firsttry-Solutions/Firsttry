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
        <div
          style={{
            padding: "16px",
            backgroundColor: "#fee",
            borderLeft: "4px solid #c00",
            fontFamily: "monospace",
            fontSize: "12px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "#333",
          }}
        >
          <strong style={{ color: "#c00" }}>⚠️ UI Error</strong>
          <div style={{ marginTop: "8px", fontSize: "11px" }}>
            {errorMessage}
          </div>
          {errorStack && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "10px",
                opacity: 0.7,
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {errorStack}
            </div>
          )}
          <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.6 }}>
            Refresh the page to retry.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
