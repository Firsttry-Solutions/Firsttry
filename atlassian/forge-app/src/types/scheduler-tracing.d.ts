declare module 'scheduler/tracing' {
  // Minimal tracing shim for React scheduler types during local type-check.
  export function unstable_wrap(callback: Function): any;
}
