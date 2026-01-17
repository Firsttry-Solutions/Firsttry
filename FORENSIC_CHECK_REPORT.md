# FORENSIC_CHECK_REPORT

**Generated:** 20260117T161736Z  
**Environment:** production  
**Nonce Tested:** probe_1768662844441_af14b920  
**Lookback Window:** 120 minutes  
**Report Path:** /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md  
**Evidence Bundle:** /tmp/ft_forensic_20260117T161736Z  

---

## Forge Identity

**User Email:** 
unknown  
**Tenant:** 
unknown  

---

## Log Capture Metadata

**Grouped Logs Used:** /tmp/ft_forensic_20260117T161736Z/logs_grouped_since.txt (grouped (time-windowed))  
**Raw Logs Used:** /tmp/ft_forensic_20260117T161736Z/logs_raw_since.txt (raw (time-windowed))  
**Grouped Size:** 383 bytes  
**Raw Size:** 383 bytes  

---

## Evidence Search Results

| Evidence | Grouped Count | Raw Count | Found? |
|----------|---------------|-----------|--------|
| **Nonce** (probe_1768662844441_af14b920) | 0 | 0 | NO |
| **PROBE_ENTRY** | 0 | 0 | NO |
| **PROBE_OK** | 0 | 0 | NO |
| **PROBE_ERR** | 0 | 0 | NO |
| **JSON marker** (\"marker\":\"PROBE) | 0 | 0 | NO |

---

## Diagnosis

### ⚠️ BRANCH B: Logs Captured But Probe Not Invoked

**Summary:**  
Production logs were successfully captured (383 bytes grouped, 383 bytes raw), but NO probe markers were found (no PROBE_ENTRY/PROBE_OK/PROBE_ERR, no JSON marker, no nonce). This means the probe resolver was not invoked.

**Immediate Action:**  
Action: (1) Verify 'Run Probe' button exists in Jira gadget. (2) Click the button. (3) Within 1-2 minutes, run: bash tools/forensic_report.sh --nonce <nonce_from_ui> --minutes 120

---

## Evidence Excerpts

### Forge Authentication (forge whoami)

```
Logged in as Arnab Poddar (contact@firsttry.run)
Account ID: 712020:5bb8dbe7-8759-4663-bbb2-106a55710cb2
```

### Installation Status (forge install list)

```
Error captured
```

### Probe Entry Markers (PROBE_ENTRY, max 30 lines)

```

```

### Probe Success Markers (PROBE_OK, max 30 lines)

```

```

### Probe Error Markers (PROBE_ERR, max 30 lines)

```

```

### Nonce Matches (probe_1768662844441_af14b920, max 30 lines)

```

```

---

## How to Use This Report

1. **If Branch A (SUCCESS):** Proof is complete. Nonce found in logs.
2. **If Branch B (Not Invoked):** Click "Run Probe" button in Jira, wait 1-2 min, re-run this script.
3. **If Branch C (Markers but No Nonce):** Re-run probe with new nonce, run this script immediately after.
4. **If Branch D (Capture Failed):** Verify Forge authentication and app installation, then retry.

---

## Evidence Files (in /tmp/ft_forensic_20260117T161736Z)

- `forge_whoami.txt` - Authentication proof
- `forge_install_list.txt` - Installation proof
- `logs_grouped_full.txt` - Full grouped logs
- `logs_raw_full.txt` - Full raw logs
- `logs_grouped_since.txt` - Logs from last 120 minutes (grouped)
- `logs_raw_since.txt` - Logs from last 120 minutes (raw)
- `ex_entry.txt` - PROBE_ENTRY excerpts
- `ex_ok.txt` - PROBE_OK excerpts
- `ex_err.txt` - PROBE_ERR excerpts
- `ex_nonce.txt` - Nonce match excerpts

---

## Verification

**Generated:** 2026-01-17 16:17:48 UTC  
**Branch:** B  
**Report Status:** Generated (see Diagnosis for interpretation)
