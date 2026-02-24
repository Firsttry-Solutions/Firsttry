# RUNBOOK: Production Authentication State Refresh

## Purpose

Refresh `storageState.json` when the production smoke test indicates that the authentication session has expired or the user is redirected to login. This runbook provides the manual/headed login flow via noVNC desktop access.

---

## When to Refresh (hard triggers)

Refresh authentication state if ANY of the following occur:

1. Smoke test fails due to `final_url.txt` containing `id.atlassian.com` or `/login` path
2. Jira dashboard loads but displays "log in" or "Atlassian account" message
3. `storageState.shape.txt` fails or is missing entirely
4. `e2e/scripts/auth_login.mjs` is executed and does NOT early-exit (meaning it launches a browser instead of reusing existing auth)

---

## Preconditions

- Interactive access to a browser inside Codespaces (noVNC desktop) or equivalent headed display environment
- X11 display server (`:1` or similar) capable of running Chromium
- No VNC/noVNC ports (6080, 5901) left open after completion
- `e2e/scripts/auth_login.mjs` exists and is executable
- Atlassian account credentials available and ready for MFA completion
- Network access to `https://id.atlassian.com` and `https://firsttry.atlassian.net`

---

## Bring Up Desktop (reference)

Your Codespaces environment already has VNC/websockify installed and proven. Minimal startup commands:

**Start VNC server on :1 (localhost only):**
```bash
vncserver :1 -geometry 1280x720 2>/dev/null
```

**Start websockify listening on 6080 (forwarding to VNC on 5901):**
```bash
websockify 0.0.0.0:6080 localhost:5901 &
```

**Verify ports are listening:**
```bash
ss -ltnp | grep -E ':(5901|6080)\b'
```

**Open noVNC via Codespaces Ports tab:**
- In VS Code Codespaces, open Ports tab (bottom panel)
- Forward port 6080 (if not already)
- Click "Open in Browser" or visit `http://localhost:6080/vnc.html`

⚠️ **SECURITY CALLOUT:** If you make port 6080 public, **close it immediately after refresh is complete**. Do not leave it open. Session cookies will be visible on the desktop.

---

## Run Auth Capture (mandatory environment variables)

In the noVNC session (after desktop is visible), run:

```bash
cd /workspaces/Firsttry
DISPLAY=:1 XAUTHORITY="$HOME/.Xauthority" node e2e/scripts/auth_login.mjs
```

**What happens:**
1. Chromium browser window appears on the desktop
2. Script navigates to Jira production and attempts to log in
3. **Operator manually completes Atlassian SSO and MFA** in the browser
4. Upon successful login, the script captures `storageState.json` and exits

**Expected output:** Script early-exits with code 0 after saving storageState. On subsequent runs (e.g., smoke tests), if session is still valid, auth_login.mjs will detect the existing cookies and exit immediately without launching a browser.

---

## Validate storageState (fail-closed)

After `auth_login.mjs` completes, immediately validate the captured state:

**Check file exists:**
```bash
STATE="/workspaces/Firsttry/e2e/.auth/storageState.json"
test -f "$STATE" && echo "PASS: file exists" || (echo "FAIL: not found"; exit 1)
```

**Check minimum size (must be at least 500 bytes):**
```bash
BYTES=$(wc -c < "$STATE")
[ "$BYTES" -ge 500 ] && echo "PASS: $BYTES bytes" || (echo "FAIL: too small"; exit 1)
```

**Validate JSON structure (cookies and origins must be arrays):**
```bash
python3 - <<'PY'
import json, sys
try:
    d = json.load(open("/workspaces/Firsttry/e2e/.auth/storageState.json", "r"))
    assert isinstance(d, dict), "top-level is not an object"
    assert isinstance(d.get("cookies"), list), "cookies is not an array"
    assert isinstance(d.get("origins"), list), "origins is not an array"
    print("PASS: storageState JSON structure valid")
except Exception as e:
    print(f"FAIL: {e}")
    sys.exit(1)
PY
```

**Print SHA256 hash for audit trail:**
```bash
sha256sum "$STATE"
```

---

## Mandatory Shutdown (fail-closed)

After validation is complete, shut down VNC and websockify **immediately**:

**Kill websockify:**
```bash
pkill -f "websockify.*6080" >/dev/null 2>&1 || true
```

**Kill VNC server:**
```bash
vncserver -kill :1 >/dev/null 2>&1 || true
```

**Verify ports are closed:**
```bash
ss -ltnp | grep -E ':(5901|6080)\b' && echo "WARN: ports still open" || echo "PASS: ports closed"
```

---

## Post-Refresh Proof

Run the smoke test to confirm the new storageState works:

```bash
cd /workspaces/Firsttry
e2e/scripts/run_prod_dashboard_smoke_failclosed.sh
```

**Pass condition:** Runner exits 0 and produces `SUCCESS.txt` in the evidence directory.

If test still fails, return to Step A of the triage sequence in RUNBOOK_PROD_SMOKE.md.

---

## Security Rules

- **storageState.json** contains Atlassian session cookies and tokens. Treat as secret.
- Never paste the full contents of `storageState.json` into chat, logs, or public documentation
- Never commit `storageState.json` to git (it is gitignored by design)
- VNC/noVNC must not be published beyond what is required for your specific Codespaces session
- Close port 6080 immediately after refresh to prevent unintended remote access
- Dispose of screenshot/recordings taken during manual login; they may contain authentication flows
