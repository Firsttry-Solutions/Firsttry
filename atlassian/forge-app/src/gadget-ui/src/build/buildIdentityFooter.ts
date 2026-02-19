import { UI_GIT_SHA_SHORT, UI_BUILD_TIME_UTC, UI_APP_VERSION } from './buildIdentity.gen';

const FOOTER_MARKER = 'FT_PROOF_UI_BUILD_IDENTITY_FOOTER_V1' as const;

function normalizeBackendShaShort(input: unknown): string {
  if (typeof input !== 'string') return 'UNKNOWN';
  const value = input.trim();
  if (!/^[0-9a-f]{7,40}$/i.test(value)) return 'UNKNOWN';
  return value.slice(0, 7).toLowerCase();
}

export function buildIdentityFooter(backendGitShaShort?: string): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'ft-build-identity-footer';
  footer.setAttribute('data-ft-proof', FOOTER_MARKER);

  const backendShort = normalizeBackendShaShort(backendGitShaShort);
  const matchStatus = backendShort === 'UNKNOWN' ? 'UNKNOWN' : (backendShort === UI_GIT_SHA_SHORT ? 'MATCH' : 'MISMATCH');

  const line = document.createElement('div');
  line.className = 'ft-build-identity-footer-line';
  line.textContent =
    `${FOOTER_MARKER} | ui=${UI_GIT_SHA_SHORT} | backend=${backendShort} | status=${matchStatus} | version=${UI_APP_VERSION} | commitUtc=${UI_BUILD_TIME_UTC}`;
  footer.appendChild(line);

  return footer;
}

export function createBuildIdentityFooter(backendGitShaShort?: string): HTMLElement {
  return buildIdentityFooter(backendGitShaShort);
}

export function renderBuildIdentityFooterInto(container: HTMLElement, backendGitShaShort?: string): HTMLElement {
  if (!(container instanceof HTMLElement)) {
    throw new Error('BUILD_IDENTITY_FOOTER_CONTAINER_INVALID');
  }
  container.innerHTML = '';
  const footer = createBuildIdentityFooter(backendGitShaShort);
  container.appendChild(footer);
  return footer;
}
