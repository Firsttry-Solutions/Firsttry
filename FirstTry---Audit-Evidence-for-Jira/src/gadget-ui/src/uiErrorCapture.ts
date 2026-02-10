/**
 * Deterministic UI Error & Rejection Capture
 * 
 * Captures window "error" and "unhandledrejection" events for frontend diagnostics.
 * Stores in window.__FT_UI_ERRORS and window.__FT_LAST_UI_ERROR.
 * Never throws - all errors caught internally.
 */

export interface UIErrorEvent {
  marker: string;
  type: string;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  ts: string;
}

declare global {
  interface Window {
    __FT_UI_ERRORS?: UIErrorEvent[];
    __FT_LAST_UI_ERROR?: UIErrorEvent;
  }
}

export function initUIErrorCapture(): void {
  try {
    // Initialize array if not present
    if (!window.__FT_UI_ERRORS) {
      window.__FT_UI_ERRORS = [];
    }

    // Listener for window "error" events
    window.addEventListener(
      "error",
      (event: ErrorEvent) => {
        try {
          const errorEvent: UIErrorEvent = {
            marker: "UI_ERROR_EVENT",
            type: "error",
            message: event.message || "unknown error",
            filename: event.filename || undefined,
            lineno: event.lineno || undefined,
            colno: event.colno || undefined,
            stack: event.error?.stack || undefined,
            ts: new Date().toISOString(),
          };
          window.__FT_LAST_UI_ERROR = errorEvent;
          window.__FT_UI_ERRORS!.push(errorEvent);
          console.warn("[UI_ERROR]", errorEvent);
        } catch (err) {
          console.error("[UI_ERROR_CAPTURE_ERROR]", err);
        }
      },
      true // capture phase
    );

    // Listener for unhandled promise rejections
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        try {
          const reason = event.reason;
          const message = reason?.message || String(reason) || "unhandledrejection";
          const stack = reason?.stack || undefined;

          const rejectionEvent: UIErrorEvent = {
            marker: "UI_REJECTION_EVENT",
            type: "unhandledrejection",
            message,
            stack,
            ts: new Date().toISOString(),
          };
          window.__FT_LAST_UI_ERROR = rejectionEvent;
          window.__FT_UI_ERRORS!.push(rejectionEvent);
          console.warn("[UI_REJECTION]", rejectionEvent);
        } catch (err) {
          console.error("[UI_ERROR_CAPTURE_ERROR]", err);
        }
      },
      true // capture phase
    );

    console.log("[UI_ERROR_CAPTURE_READY] enabled");
  } catch (err) {
    console.error("[UI_ERROR_CAPTURE_INIT_ERROR]", err);
  }
}

export function getUIErrors(): UIErrorEvent[] {
  return window.__FT_UI_ERRORS || [];
}

export function getLatestUIError(): UIErrorEvent | undefined {
  return window.__FT_LAST_UI_ERROR;
}

export function hasUIErrors(): boolean {
  return (window.__FT_UI_ERRORS?.length || 0) > 0;
}
