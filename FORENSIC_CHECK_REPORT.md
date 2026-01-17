# FORENSIC_CHECK_REPORT

**Generated:** 20260117T163044Z  
**Environment:** production  
**Nonce Tested:** probe_1768662844441_af14b920  
**Lookback Window:** 120 minutes  
**Report Path:** /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md  
**Evidence Bundle:** /tmp/ft_forensic_20260117T163044Z  

---

## Forge Identity

**User Email:** 
unknown  
**Tenant:** 
unknown  

---

## Log Capture Metadata

**Grouped Logs Used:** /tmp/ft_forensic_20260117T163044Z/logs_grouped_since.txt (grouped (time-windowed))  
**Raw Logs Used:** /tmp/ft_forensic_20260117T163044Z/logs_raw_since.txt (raw (time-windowed))  
**Grouped Size:** 383 bytes  
**Raw Size:** 383 bytes  

---

## Log Sanity Check

**Validity Assessment (Content-Based):**

| Log Type | Valid? | Reason |
|----------|--------|--------|
| Grouped Logs | NO | Checked for real app log markers, not just CLI noise |
| Raw Logs | NO | Checked for real app log markers, not just CLI noise |
| **Overall** | **NO** | **Valid if either format contains real app logs** |

### Grouped Logs HEAD (first 50 lines)

```

Error: Failed to read dynamic configs. Proceeding with defaults.


/workspaces/Firsttry/manifest.yml
0:0     error    To run this command, make sure you're in the top-level directory of your app, and the manifest.yml file is in the same directory.  manifest-file-required


Error: Command failed due to validation error.

Rerunning the command with --verbose may give more details.
```

### Grouped Logs TAIL (last 50 lines)

```

Error: Failed to read dynamic configs. Proceeding with defaults.


/workspaces/Firsttry/manifest.yml
0:0     error    To run this command, make sure you're in the top-level directory of your app, and the manifest.yml file is in the same directory.  manifest-file-required


Error: Command failed due to validation error.

Rerunning the command with --verbose may give more details.
```

### Raw Logs HEAD (first 50 lines)

```

Error: Failed to read dynamic configs. Proceeding with defaults.


/workspaces/Firsttry/manifest.yml
0:0     error    To run this command, make sure you're in the top-level directory of your app, and the manifest.yml file is in the same directory.  manifest-file-required


Error: Command failed due to validation error.

Rerunning the command with --verbose may give more details.
```

### Raw Logs TAIL (last 50 lines)

```

Error: Failed to read dynamic configs. Proceeding with defaults.


/workspaces/Firsttry/manifest.yml
0:0     error    To run this command, make sure you're in the top-level directory of your app, and the manifest.yml file is in the same directory.  manifest-file-required


Error: Command failed due to validation error.

Rerunning the command with --verbose may give more details.
```

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

### ❌ BRANCH D: Log Capture Failed or Invalid

**Summary:**  
Log capture returned data that does not contain real application logs. Grouped logs valid: NO, Raw logs valid: NO. The captured output appears to be CLI errors or empty responses, not actual app logs.

**Immediate Action:**  
Action: (1) Run: forge whoami (verify email and tenant are correct). (2) Run: forge install list --environment production (verify app is listed and installed). (3) If app not installed: forge install --environment production (4) If auth issues: forge logout && forge login (5) Check your Forge environment is correct (--env production). (6) Try again in 1-2 minutes.

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

## Evidence Files (in /tmp/ft_forensic_20260117T163044Z)

- `forge_whoami.txt` - Authentication proof
- `forge_install_list.txt` - Installation proof
- `logs_grouped_full.txt` - Full grouped logs
- `logs_raw_full.txt` - Full raw logs
- `logs_grouped_since.txt` - Logs from last 120 minutes (grouped)
- `logs_raw_since.txt` - Logs from last 120 minutes (raw)
- `head_grouped.txt` - First 50 lines of grouped logs
- `tail_grouped.txt` - Last 50 lines of grouped logs
- `head_raw.txt` - First 50 lines of raw logs
- `tail_raw.txt` - Last 50 lines of raw logs
- `ex_entry.txt` - PROBE_ENTRY excerpts
- `ex_ok.txt` - PROBE_OK excerpts
- `ex_err.txt` - PROBE_ERR excerpts
- `ex_nonce.txt` - Nonce match excerpts

---

## Self-Check: Forensic Commands & Validity Flags

This section documents the exact commands executed and computed validity flags for audit purposes.

### Commands Executed

```bash
# Forge Identity
forge whoami

# Installation Status
forge install list --environment production

# Log Capture (Full)
timeout 90 forge logs --environment production --limit 5000 --grouped > logs_grouped_full.txt
timeout 90 forge logs --environment production --limit 5000 > logs_raw_full.txt

# Log Capture (Time-Windowed)
timeout 90 forge logs --environment production --limit 5000 --since 120m --grouped > logs_grouped_since.txt
timeout 90 forge logs --environment production --limit 5000 --since 120m > logs_raw_since.txt
```

### Log File Sizes

| File | Path | Size (bytes) |
|------|------|-------------|
| Grouped (Full) | /tmp/ft_forensic_20260117T163044Z/logs_grouped_full.txt | 383 |
| Raw (Full) | /tmp/ft_forensic_20260117T163044Z/logs_raw_full.txt | 383 |
| Grouped (Since) | /tmp/ft_forensic_20260117T163044Z/logs_grouped_since.txt | 383 |
| Raw (Since) | /tmp/ft_forensic_20260117T163044Z/logs_raw_since.txt | 383 |
| **Used Grouped** | /tmp/ft_forensic_20260117T163044Z/logs_grouped_since.txt | 383 |
| **Used Raw** | /tmp/ft_forensic_20260117T163044Z/logs_raw_since.txt | 383 |

### Validity Flags (Content-Based Validation)

| Check | Result |
|-------|--------|
| Grouped Logs Valid? | NO |
| Raw Logs Valid? | NO |
| Overall Logs Valid? | NO |
| Nonce Found? | NO |
| Markers Found? | NO |

### Diagnostic Branch Selected

**Branch:** D

This branch was determined by:
1. First checking: Are logs VALID (content-based)? If NO → Branch D
2. Then checking: Is nonce found in logs? If YES → Branch A
3. Then checking: Are markers found but nonce missing? If YES → Branch C
4. Finally: Logs valid but no markers? Then → Branch B

---

## Verification

**Generated:** 2026-01-17 16:30:56 UTC  
**Branch:** D  
**Log Validity:** NO (Grouped: NO, Raw: NO)  
**Report Status:** Generated (see Diagnosis for interpretation)
