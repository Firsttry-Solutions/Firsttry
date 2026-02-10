/**
 * backend_build_meta.ts
 * CANONICAL SOURCE for backend build metadata
 *
 * This module re-exports BACKEND_BUILD_SHA from src/build/backend_build.ts,
 * ensuring a single source of truth across all resolvers.
 *
 * All resolvers must import FT_BUILD_SHA from this module ONLY.
 * Never import FT_BUILD_SHA from ../shared/build_meta.ts.
 *
 * INVARIANT: FT_BUILD_SHA === BACKEND_BUILD_SHA always.
 */

import { BACKEND_BUILD_SHA } from "../build/backend_build";

/**
 * Canonical build SHA - guaranteed to match BACKEND_BUILD_SHA injected at build time.
 * This is the ONLY place where FT_BUILD_SHA should be defined for import by resolvers.
 */
export const FT_BUILD_SHA = BACKEND_BUILD_SHA;
