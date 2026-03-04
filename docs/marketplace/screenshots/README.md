# Marketplace Screenshots

This directory contains screenshots for Atlassian Marketplace submission.

## Requirements

- Minimum 3 screenshots
- Each screenshot must be:
  - PNG or JPEG format
  - Minimum 30 KB file size
  - Real image data (validated via file magic bytes)
  - Named: marketplace_01_*.png, marketplace_02_*.png, marketplace_03_*.png

## Automated Generation

Generate screenshots automatically:

```bash
# 1. Start Forge tunnel
cd atlassian/forge-app
forge tunnel

# 2. Export tunnel URL
export FORGE_TUNNEL_URL='https://your-tunnel-id.tunnel.env'

# 3. Run screenshot capture
bash tools/marketplace/readiness/capture_marketplace_screenshots.sh
```

## Manual Creation

If automated generation fails:
1. Take 3 screenshots of the running app
2. Save as PNG files (>=30 KB each)
3. Name them:
   - marketplace_01_main.png
   - marketplace_02_evidence.png
   - marketplace_03_about.png
4. Place in this directory

## Validation

Screenshots are validated by Phase 16 of the marketplace readiness audit:
- File magic signature check (PNG: 89504e470d0a1a0a, JPEG: ffd8ff)
- Minimum size check (30 KB)
- Real image data validation

**No placeholder or fake images allowed.**
