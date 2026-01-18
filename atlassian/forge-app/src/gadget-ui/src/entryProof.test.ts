import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEntryScriptSrc, formatEntryProofForBanner } from './entryProof';

describe('getEntryScriptSrc (L0.C Entry Detection)', () => {
  beforeEach(() => {
    // Clear any existing script tags from previous test
    document.querySelectorAll('script[data-test]').forEach(el => el.remove());
    delete (window as any).__FT_RUNTIME_ENTRY_PROOF__;
  });

  afterEach(() => {
    // Cleanup
    document.querySelectorAll('script[data-test]').forEach(el => el.remove());
  });

  it('should detect entry script with govGadget2141 and app.<sha>.js pattern', () => {
    const script = document.createElement('script');
    script.src =
      'https://cdn.example.com/govGadget2141/app.f1c06fb.js';
    script.setAttribute('data-test', 'entry');
    document.head.appendChild(script);

    const entry = getEntryScriptSrc();
    expect(entry).toBe('https://cdn.example.com/govGadget2141/app.f1c06fb.js');
  });

  it('should return null when no matching script found', () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.example.com/other/app.js';
    script.setAttribute('data-test', 'other');
    document.head.appendChild(script);

    const entry = getEntryScriptSrc();
    expect(entry).toBeNull();
  });

  it('should reject app.js?v=... (query-param cache bust)', () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.example.com/govGadget2141/app.js?v=123';
    script.setAttribute('data-test', 'query-param');
    document.head.appendChild(script);

    const entry = getEntryScriptSrc();
    expect(entry).toBeNull();
  });

  it('should match entry and ignore other scripts', () => {
    // Add irrelevant script
    const other1 = document.createElement('script');
    other1.src = 'https://cdn.example.com/lib.js';
    other1.setAttribute('data-test', 'other1');
    document.head.appendChild(other1);

    // Add actual entry
    const entry1 = document.createElement('script');
    entry1.src = 'https://cdn.example.com/govGadget2141/app.abc1234.js';
    entry1.setAttribute('data-test', 'entry1');
    document.head.appendChild(entry1);

    // Add another irrelevant script
    const other2 = document.createElement('script');
    other2.src = 'https://cdn.example.com/app.js';
    other2.setAttribute('data-test', 'other2');
    document.head.appendChild(other2);

    const detected = getEntryScriptSrc();
    expect(detected).toBe(
      'https://cdn.example.com/govGadget2141/app.abc1234.js'
    );
  });

  it('formatEntryProofForBanner should extract filename from URL', () => {
    (window as any).__FT_RUNTIME_ENTRY_PROOF__ = {
      entry_script_src: 'https://cdn.example.com/govGadget2141/app.f1c06fb.js',
    };

    const banner = formatEntryProofForBanner();
    expect(banner).toBe('ENTRY=app.f1c06fb.js');
  });

  it('formatEntryProofForBanner should return ENTRY=NONE when no entry', () => {
    (window as any).__FT_RUNTIME_ENTRY_PROOF__ = {
      entry_script_src: null,
    };

    const banner = formatEntryProofForBanner();
    expect(banner).toBe('ENTRY=NONE');
  });

  it('formatEntryProofForBanner should return ENTRY=NONE when proof undefined', () => {
    delete (window as any).__FT_RUNTIME_ENTRY_PROOF__;

    const banner = formatEntryProofForBanner();
    expect(banner).toBe('ENTRY=NONE');
  });
});
