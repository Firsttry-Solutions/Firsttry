/**
 * Mock for @forge/bridge
 * Used in Node.js/vitest environments where window is not defined
 * Real bridge implementation requires browser environment
 */

export const getCallBridge = () => ({
  invoke: async () => Promise.resolve(),
  on: () => {},
  off: () => {},
});

export default {
  getCallBridge,
};
