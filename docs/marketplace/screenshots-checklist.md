# Marketplace Screenshots Checklist

**Last Updated**: January 2, 2026

## Overview

This checklist guides the creation of screenshots for the Atlassian Marketplace listing. Screenshots must be captured manually from a non-production environment.

## General Requirements

- **Resolution**: Minimum 1280x720 pixels
- **Format**: PNG or JPEG
- **Tenant**: Use a non-production Jira Cloud tenant
- **Redaction**: Remove all personal data, email addresses, and sensitive identifiers

## Required Screenshots

### 1. App Installation Confirmation
- **What to capture**: Forge app installed confirmation screen in Jira
- **Purpose**: Shows the app is successfully installed
- **Redaction**: Remove any visible tenant URLs or admin emails

### 2. Admin Dashboard Overview
- **What to capture**: Main administrative dashboard showing governance metrics
- **Purpose**: Primary interface view
- **Redaction**: Redact project names, issue keys, user names, email addresses

### 3. Configuration Panel (if applicable)
- **What to capture**: App configuration settings page
- **Purpose**: Shows available configuration options
- **Redaction**: Remove any custom field names that might reveal sensitive context

### 4. Sample Report Output
- **What to capture**: A generated governance report showing representative data
- **Purpose**: Demonstrates reporting capabilities
- **Redaction**: 
  - Replace real issue keys with dummy values (e.g., DEMO-123)
  - Remove user names and emails
  - Generalize project names (e.g., "Project A", "Project B")
  - Remove any dates that reveal production timeline

### 5. Feature Highlight (Optional)
- **What to capture**: Key feature demonstration (e.g., disclosure envelope, evidence bundle)
- **Purpose**: Highlights unique selling point
- **Redaction**: Same as report output

## Screenshot Capture Process

1. **Prepare Test Environment**
   - Create a non-production Jira Cloud tenant OR use a dedicated test tenant
   - Install the App in test mode
   - Populate with representative but non-sensitive test data

2. **Capture Screenshots**
   - Use browser screenshot tools or OS screen capture
   - Ensure full UI elements are visible (no cut-off buttons or text)
   - Capture at appropriate zoom level (100% recommended)

3. **Redaction**
   - Use image editing software to:
     - Black out or blur sensitive text
     - Replace real values with generic placeholders
     - Remove email addresses and URLs
   - Verify no sensitive data is visible before saving

4. **File Naming**
   - Use descriptive names: `01_installation.png`, `02_dashboard_overview.png`, etc.
   - Keep file sizes reasonable (< 5MB per image)

5. **Review**
   - Double-check each screenshot for:
     - No personal data visible
     - No production URLs or tenant names
     - No sensitive project or issue identifiers
     - Clear, readable UI elements
     - Professional appearance

## Prohibited Content

Do NOT include in screenshots:
- Real user email addresses
- Production tenant URLs
- Sensitive project names or codes
- Real issue keys from production
- Internal company identifiers
- Personal identifiable information (PII)
- Authentication tokens or credentials

## Storage

Store captured and redacted screenshots in:
- `docs/marketplace/screenshots/` (not committed to repo)
- Upload directly to Marketplace listing portal

Do NOT commit screenshots to the Git repository unless they are generic demo images with zero sensitive data.

## Compliance Note

Screenshots are for demonstration purposes only and do not constitute guarantees of functionality, performance, or compliance outcomes.

---

**Reminder**: All screenshots must be manually reviewed by a human before uploading to the Marketplace listing. Automated tools cannot guarantee complete redaction of sensitive data.
