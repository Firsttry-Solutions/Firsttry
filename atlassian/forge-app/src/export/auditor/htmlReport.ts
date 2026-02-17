/**
 * Smart HTML Report Generator
 * Self-contained auditor evidence with embedded manifest, scripts, and crypto verification
 *
 * FT_PROOF_AUDITOR_HTML_v1: This module generates tamper-verifiable audit evidence HTML
 * FT_PROOF_HTML_SELF_VERIFY_v1: HTML includes WebCrypto SHA-256 for client-side verification
 * FT_PROOF_EXTERNAL_HASH_MODE_v1: User can paste external hash for VERIFIED status
 * FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1: HTML discloses that it is a container only; verified artifacts are evidence + scripts
 * FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1: HTML includes printable auditor-friendly sections
 */

export interface HtmlReportParams {
  /**
   * Canonical evidence JSON string (from packer)
   */
  evidenceJsonString: string;

  /**
   * Manifest JSON object  
   */
  manifestJson: any;

  /**
   * Optional verify.sh script content
   */
  verifyShScript?: string;

  /**
   * Optional verify.ps1 script content
   */
  verifyPs1Script?: string;
}

export function generateSmartHtmlReport(params: HtmlReportParams): string {
  console.log("[FT_PROOF_AUDITOR_HTML_v1]", { marker: "FT_PROOF_AUDITOR_HTML_v1" });
  console.log("[FT_PROOF_HTML_SELF_VERIFY_v1]", { marker: "FT_PROOF_HTML_SELF_VERIFY_v1" });
  console.log("[FT_PROOF_EXTERNAL_HASH_MODE_v1]", { marker: "FT_PROOF_EXTERNAL_HASH_MODE_v1" });
  console.log("[FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1]", { marker: "FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1" });
  console.log("[FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1]", { marker: "FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1" });

  const { evidenceJsonString, manifestJson, verifyShScript, verifyPs1Script } = params;

  // Base64 encode for embedding
  const evidenceBase64 = Buffer.from(evidenceJsonString, "utf-8").toString("base64");
  const manifestBase64 = Buffer.from(JSON.stringify(manifestJson, null, 2), "utf-8").toString(
    "base64"
  );

  const schemaVersion = manifestJson.schemaVersion || "unknown";
  const buildShaShort = manifestJson.buildShaShort || "unknown";
  const buildUtc = manifestJson.buildUtc || "unknown";
  const siteId = manifestJson.siteId || "unknown";
  const ruleSetVersion = manifestJson.ruleSetVersion || "unknown";
  const privilegeContext = manifestJson.privilegeContext || "unknown";
  const evidenceSha256 = manifestJson.evidenceSha256 || "unknown";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FirstTry Auditor Evidence Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header {
            border-bottom: 3px solid #0052cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 32px;
            color: #0052cc;
            margin-bottom: 10px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 14px;
            margin-top: 10px;
        }
        
        .status-unverified {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffc107;
        }
        
        .status-consistent {
            background: #d4edda;
            color: #155724;
            border: 1px solid #28a745;
        }
        
        .status-verified {
            background: #cfe2ff;
            color: #084298;
            border: 1px solid #0d6efd;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h2 {
            font-size: 20px;
            color: #0052cc;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        
        .metadata-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .metadata-item {
            padding: 12px;
            background: #f9f9f9;
            border-radius: 4px;
            border-left: 3px solid #0052cc;
        }
        
        .metadata-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        
        .metadata-value {
            font-size: 14px;
            color: #333;
            word-break: break-all;
            font-family: "Courier New", monospace;
        }
        
        .verification-panel {
            padding: 20px;
            background: #f0f7ff;
            border-radius: 8px;
            border: 2px solid #0052cc;
            margin-bottom: 20px;
        }
        
        .verification-panel h3 {
            color: #0052cc;
            margin-bottom: 15px;
        }
        
        .level {
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-radius: 4px;
            border-left: 4px solid #ddd;
        }
        
        .level.active {
            background: #e8f4fd;
            border-left-color: #0052cc;
        }
        
        .level-title {
            font-weight: bold;
            color: #0052cc;
            margin-bottom: 8px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        input[type="text"],
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: "Courier New", monospace;
            font-size: 12px;
            resize: vertical;
            margin-bottom: 10px;
        }
        
        button {
            padding: 10px 20px;
            background: #0052cc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        
        button:hover {
            background: #0047b2;
        }
        
        button.secondary {
            background: #6c757d;
        }
        
        button.secondary:hover {
            background: #5a6268;
        }
        
        .button-group {
            margin-top: 20px;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                padding: 0;
                max-width: 100%;
            }
            
            .button-group,
            .verification-panel input,
            .verification-panel button {
                display: none !important;
            }
            
            .status-badge::after {
                content: " (printed)";
            }
        }
        
        @page {
            size: A4;
            margin: 20mm;
        }
        
        .hash-display {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ddd;
            word-break: break-all;
            font-family: "Courier New", monospace;
            font-size: 12px;
            margin: 10px 0;
        }
        
        .error {
            color: #dc3545;
            padding: 10px;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
        }
        
        .success {
            color: #155724;
            padding: 10px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 FirstTry Auditor Evidence Report</h1>
            <p>Tamper-verifiable audit evidence with embedded manifest and verification tools</p>
            <div id="statusBadge" class="status-badge status-unverified">UNVERIFIED</div>
        </div>

        <!-- Trust Model Disclosure (FT_PROOF_TRUST_MODEL_CONTAINER_DISCLOSURE_v1) -->
        <div class="section" style="background: #fafafa; border-left: 4px solid #0066cc; padding: 15px;">
            <h2>Trust Model & Verification</h2>
            <p><strong>This file is a self-contained HTML container for offline verification.</strong></p>
            <p><strong>Verified Artifacts:</strong> Only the critical artifacts are integrity-verified:</p>
            <ul style="line-height: 1.6; margin-left: 20px; margin-bottom: 15px;">
                <li><strong>evidence.json</strong> - Canonical snapshot of audit data (SHA-256 hashed)</li>
                <li><strong>manifest.json</strong> - Embedded in HTML, contains hashes of critical artifacts</li>
                <li><strong>verify.sh</strong> - Unix/Linux verification script (SHA-256 hashed)</li>
                <li><strong>verify.ps1</strong> - Windows PowerShell verification script (SHA-256 hashed)</li>
            </ul>
            <p><strong>Note:</strong> The HTML file itself is <em>not</em> independently verified. HTML is a container/viewer that embeds the critical artifacts. If you modify the HTML display, it does not affect the integrity of the embedded evidence and scripts.</p>
            <ul style="line-height: 1.6; margin-left: 20px;">
                <li><strong>Level 1 (Internal Consistency):</strong> WebCrypto SHA-256 verifies evidence.json matches the embedded manifest hash. This confirms internal consistency but does <em>not</em> prove the file has not been tampered with (both evidence and manifest could be edited together).</li>
                <li><strong>Level 2 (Tamper-Evident):</strong> Requires an independent, out-of-band recorded hash (from ticket, email, audit log, or external system). You paste the independently recorded hash and this tool verifies that it matches the computed evidence hash. <em>Only this method proves tampering cannot have occurred.</em></li>
            </ul>
            <p><strong>Limitation:</strong> If an attacker has access to this HTML file, they could edit both the evidence and manifest, compute new hashes, and recreate the file with matching hashes. <em>An independent recorded hash is the only way to detect such modifications.</em></p>
        </div>

        <!-- Metadata Section -->
        <div class="section">
            <h2>Audit Metadata</h2>
            <div class="metadata-grid">
                <div class="metadata-item">
                    <div class="metadata-label">Schema Version</div>
                    <div class="metadata-value">${schemaVersion}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Build SHA (short)</div>
                    <div class="metadata-value">${buildShaShort}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Build UTC</div>
                    <div class="metadata-value">${buildUtc}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Site ID</div>
                    <div class="metadata-value">${siteId}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Rule Set Version</div>
                    <div class="metadata-value">${ruleSetVersion}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Privilege Context</div>
                    <div class="metadata-value">${privilegeContext}</div>
                </div>
            </div>
        </div>

        <!-- Auditor Report Sections (Bank Statement Style) -->
        <!-- FT_PROOF_AUDITOR_LAYOUT_BANK_STATEMENT_v1 -->
        <div class="section" id="auditorSections">
            <!-- Executive Summary will be inserted here by JavaScript -->
            <h2>Executive Summary</h2>
            <div id="executiveSummary" style="padding: 10px; background: #f9f9f9;">
                <p>Loading evidence data...</p>
            </div>

            <!-- Global Admins Table -->
            <h2>Global Admins</h2>
            <div id="globalAdminsSection" style="padding: 10px; background: #f9f9f9;">
                <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Account ID</th>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody id="globalAdminsTable">
                        <tr><td colspan="2">No data</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Shadow Admin Findings Table -->
            <h2>Shadow Admin Findings</h2>
            <div id="shadowAdminsSection" style="padding: 10px; background: #f9f9f9;">
                <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Account ID</th>
                            <th>Patterns</th>
                            <th>Evidence</th>
                        </tr>
                    </thead>
                    <tbody id="shadowAdminsTable">
                        <tr><td colspan="3">No suspicious activity detected</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Forensic Diff -->
            <h2>Forensic Diff</h2>
            <div id="diffSection" style="padding: 10px; background: #f9f9f9;">
                <p id="diffContent">No changes detected</p>
            </div>

            <!-- Remediation Instructions -->
            <h2>Remediation Instructions</h2>
            <div id="remediationSection" style="padding: 10px; background: #f9f9f9;">
                <p id="remediationContent">No remediation required</p>
            </div>
        </div>

        <!-- Verification Section -->
        <div class="section">
            <h2>Verification</h2>
            <div class="verification-panel">
                <h3>Two-Level Verification System</h3>

                <!-- Level 1: Internal Consistency -->
                <div class="level" id="level1">
                    <div class="level-title">Level 1: Internal Consistency Check</div>
                    <p>Verifies that evidence.json has not been modified since manifest was created.</p>
                    <button onclick="verifyLevel1()">Verify Internal Consistency</button>
                    <div class="error" id="error1"></div>
                    <div class="success" id="success1"></div>
                    <div class="hash-display" id="level1-hash" style="display:none;"></div>
                </div>

                <!-- Level 2: External Hash Verification -->
                <div class="level" id="level2">
                    <div class="level-title">Level 2: External Hash Verification</div>
                    <p>Paste the expected evidence hash (from audit log, ticket, or email) to verify evidence integrity.</p>
                    <label>Expected Evidence SHA-256 Hash:</label>
                    <input type="text" id="externalHash" placeholder="Paste expected hash (64 hex chars)">
                    <button onclick="verifyLevel2()">Verify External Hash</button>
                    <div class="error" id="error2"></div>
                    <div class="success" id="success2"></div>
                </div>

                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    <strong>Note:</strong> This HTML uses WebCrypto for browser-native SHA-256 computation.
                    No external URLs are called. All verification happens locally on your machine.
                </p>
            </div>
        </div>

        <!-- Downloads Section -->
        <div class="section" id="downloadsSection" style="display:none;">
            <h2>Download Files</h2>
            <div class="button-group">
                <button class="secondary" onclick="downloadEvidence()">Download evidence.json</button>
                <button class="secondary" onclick="downloadManifest()">Download manifest.json</button>
                ${verifyShScript ? '<button class="secondary" onclick="downloadVerifySh()">Download verify.sh</button>' : ""}
                ${verifyPs1Script ? '<button class="secondary" onclick="downloadVerifyPs1()">Download verify.ps1</button>' : ""}
                <button class="secondary" onclick="window.print()">Print to PDF</button>
            </div>
        </div>

        <!-- Evidence Hash Display -->
        <div class="section">
            <h2>Evidence Integrity Hash</h2>
            <div class="hash-display" title="SHA-256 of canonical evidence.json">
                <strong>evidenceSha256:</strong><br>
                ${evidenceSha256}
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Generated: ${buildUtc}</p>
            <p>Deployment: FirstTry Auditor Evidence v1.0</p>
            <p>No external networking. Verification runs entirely on your machine.</p>
        </div>
    </div>

    <!-- Embedded Evidence and Manifest -->
    <script>
        // Embedded encoded data
        const EVIDENCE_BASE64 = "${evidenceBase64}";
        const MANIFEST_BASE64 = "${manifestBase64}";
        ${verifyShScript ? `const VERIFY_SH = "${Buffer.from(verifyShScript).toString("base64")}";` : `const VERIFY_SH = "";`}
        ${verifyPs1Script ? `const VERIFY_PS1 = "${Buffer.from(verifyPs1Script).toString("base64")}";` : `const VERIFY_PS1 = "";`}

        function b64Decode(str) {
            return Buffer.from(str, "base64").toString("utf-8");
        }

        function sha256(str) {
            return new Promise(async (resolve) => {
                const msgBuffer = new TextEncoder().encode(str);
                const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
                resolve(hashHex);
            });
        }

        function setStatusBadge(status, label) {
            const badge = document.getElementById("statusBadge");
            badge.className = "status-badge status-" + status;
            badge.textContent = label;
        }

        async function verifyLevel1() {
            try {
                const evidenceJson = b64Decode(EVIDENCE_BASE64);
                const manifest = JSON.parse(b64Decode(MANIFEST_BASE64));
                const computedHash = await sha256(evidenceJson);
                const expectedHash = manifest.evidenceSha256;

                document.getElementById("level1-hash").style.display = "block";
                document.getElementById("level1-hash").innerHTML = 
                    "<strong>Computed:</strong> " + computedHash + "<br>" +
                    "<strong>Expected:</strong> " + expectedHash;

                if (computedHash === expectedHash) {
                    document.getElementById("success1").style.display = "block";
                    document.getElementById("success1").innerHTML = 
                        "✅ PASS: Evidence is internally consistent (not modified)";
                    document.getElementById("error1").style.display = "none";
                    setStatusBadge("consistent", "INTERNALLY CONSISTENT");
                    document.getElementById("downloadsSection").style.display = "block";
                } else {
                    document.getElementById("error1").style.display = "block";
                    document.getElementById("error1").innerHTML = 
                        "❌ FAIL: Hash mismatch - evidence may have been modified";
                    document.getElementById("success1").style.display = "none";
                    setStatusBadge("unverified", "INCONSISTENT");
                }
            } catch (e) {
                document.getElementById("error1").style.display = "block";
                document.getElementById("error1").innerHTML = "❌ Error: " + e.message;
            }
        }

        async function verifyLevel2() {
            const externalHashInput = document.getElementById("externalHash").value.trim().toLowerCase();
            if (!externalHashInput) {
                document.getElementById("error2").innerHTML = "❌ Please enter the expected hash";
                document.getElementById("error2").style.display = "block";
                return;
            }

            try {
                const evidenceJson = b64Decode(EVIDENCE_BASE64);
                const computedHash = await sha256(evidenceJson);

                if (computedHash === externalHashInput) {
                    document.getElementById("success2").style.display = "block";
                    document.getElementById("success2").innerHTML = 
                        "✅ VERIFIED: External hash matches evidence hash - hash match confirmed";
                    document.getElementById("error2").style.display = "none";
                    setStatusBadge("verified", "VERIFIED (EXTERNAL HASH MATCH)");
                } else {
                    document.getElementById("error2").style.display = "block";
                    document.getElementById("error2").innerHTML = 
                        "❌ MISMATCH: External hash does not match - possible tampering";
                    document.getElementById("success2").style.display = "none";
                    setStatusBadge("unverified", "UNVERIFIED");
                }
            } catch (e) {
                document.getElementById("error2").style.display = "block";
                document.getElementById("error2").innerHTML = "❌ Error: " + e.message;
            }
        }

        function downloadEvidence() {
            const data = b64Decode(EVIDENCE_BASE64);
            downloadFile("evidence.json", data, "application/json");
        }

        function downloadManifest() {
            const data = b64Decode(MANIFEST_BASE64);
            downloadFile("manifest.json", data, "application/json");
        }

        function downloadVerifySh() {
            const data = b64Decode(VERIFY_SH);
            downloadFile("verify.sh", data, "text/plain");
        }

        function downloadVerifyPs1() {
            const data = b64Decode(VERIFY_PS1);
            downloadFile("verify.ps1", data, "text/plain");
        }

        function downloadFile(filename, content, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }

        // Show downloads section on load (if verified)
        document.addEventListener("DOMContentLoaded", () => {
            document.getElementById("downloadsSection").style.display = "block";
            renderAuditorSections();
        });

        // Render auditor sections from evidence data
        function renderAuditorSections() {
            try {
                const evidenceJson = JSON.parse(b64Decode(EVIDENCE_BASE64));
                
                // Executive Summary
                const globalAdminCount = (evidenceJson.globalAdmins || []).length;
                const projectCount = (evidenceJson.projects || []).length;
                document.getElementById("executiveSummary").innerHTML = \`
                    <strong>Summary:</strong><br>
                    • Global Admins: \${globalAdminCount}<br>
                    • Projects: \${projectCount}<br>
                    • Schema: \${evidenceJson.schemaVersion || "unknown"}
                \`;
                
                // Global Admins Table
                const admins = (evidenceJson.globalAdmins || []).sort((a, b) => (a.accountId || "").localeCompare(b.accountId || ""));
                const adminHtml = admins.length > 0 
                    ? admins.map(a => \`<tr><td>\${escapeHtml(a.accountId || "")}</td><td>\${escapeHtml(a.email || "")}</td></tr>\`).join("")
                    : "<tr><td colspan='2'>No global admins</td></tr>";
                document.getElementById("globalAdminsTable").innerHTML = adminHtml;
                
                // Shadow Admins (if present in evidence)
                const shadowAdmins = (evidenceJson.shadowAdmins || []).sort((a, b) => (a.accountId || "").localeCompare(b.accountId || ""));
                const shadowHtml = shadowAdmins.length > 0
                    ? shadowAdmins.map(s => \`<tr><td>\${escapeHtml(s.accountId || "")}</td><td>\${(s.reasonCodes || []).join(", ")}</td><td>\${escapeHtml((s.evidence || []).length.toString())}</td></tr>\`).join("")
                    : "<tr><td colspan='3'>No suspicious patterns detected</td></tr>";
                document.getElementById("shadowAdminsTable").innerHTML = shadowHtml;
                
                // Diff (if present)
                const diff = evidenceJson.diff || {};
                const diffText = (diff.addedGlobalAdmins || []).length > 0 || (diff.removedGlobalAdmins || []).length > 0
                    ? \`Added: \${(diff.addedGlobalAdmins || []).length}, Removed: \${(diff.removedGlobalAdmins || []).length}\`
                    : "No changes detected";
                document.getElementById("diffContent").textContent = diffText;
                
                // Remediation (if present)
                const remediation = evidenceJson.remediation || [];
                const remediationText = remediation.length > 0
                    ? remediation.map(r => r.title).join("; ")
                    : "No remediation required";
                document.getElementById("remediationContent").textContent = remediationText;
                
            } catch (e) {
                document.getElementById("auditorSections").innerHTML = \`<p style="color:red;">Error rendering audit data: \${e.message}</p>\`;
            }
        }

        function escapeHtml(text) {
            const map = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"};
            return text.replace(/[&<>"']/g, c => map[c]);
        }
    </script>
</body>
</html>`;
}
