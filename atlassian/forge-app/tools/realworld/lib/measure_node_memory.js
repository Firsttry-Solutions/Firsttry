#!/usr/bin/env node
/**
 * Memory Measurement Utility
 * 
 * Reports current Node.js memory usage in stable JSON format.
 * Used by run_realworld_gates.sh to capture memory metrics.
 */

const mem = process.memoryUsage();

const result = {
  rss: mem.rss,
  heapTotal: mem.heapTotal,
  heapUsed: mem.heapUsed,
  external: mem.external,
  arrayBuffers: mem.arrayBuffers || 0
};

// Output as single-line JSON for easy parsing
console.log(JSON.stringify(result));
