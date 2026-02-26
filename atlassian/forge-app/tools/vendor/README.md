# tools/vendor/

Vendored (pinned) third-party libraries committed directly to the repo.
No runtime network access required; deterministic builds.

| File | Package | Version | License | SHA-256 of downloaded file |
|------|---------|---------|---------|---------------------------|
| marked.min.js | [marked](https://github.com/markedjs/marked) | 9.1.6 | MIT | see below |

## Pinning

```
curl -sSL https://unpkg.com/marked@9.1.6/marked.min.js \
  | sha256sum
```

Run the above to verify the pinned file has not drifted.

## Usage in build_trust_portal.mjs

```javascript
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const { marked } = _require('./vendor/marked.min.js');
```
