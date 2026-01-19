/**
 * FATAL ERROR: @forge/bridge not installed
 *
 * The UI requires @forge/bridge to be installed in package.json dependencies.
 * This file is imported at top-level from main.ts to fail the build deterministically
 * if the dependency is missing.
 *
 * ERROR: @forge/bridge is required but missing from package.json
 * FIX: Add "@forge/bridge" to dependencies in atlassian/forge-app/package.json
 */

const FATAL_ERROR = new Error(
  "[FATAL_UI_BRIDGE] @forge/bridge not installed in dependencies. " +
  "Cannot invoke backend resolvers from UI. " +
  "Add '@forge/bridge' to package.json dependencies and reinstall."
);

// Throw at module load time to fail build deterministically
throw FATAL_ERROR;
