/**
 * Handler for scheduled asapp_shape_probe trigger
 * Runs every minute (or closest supported interval)
 */

import { asappShapeProbe } from "./asapp_shape_probe";

export async function handleProbeScheduled(): Promise<void> {
  asappShapeProbe();
}
