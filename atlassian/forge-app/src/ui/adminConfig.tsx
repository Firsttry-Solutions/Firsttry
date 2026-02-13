/**
 * Phase 2: Admin Configuration Panel
 * Allows Jira admins to configure allowed domains and webhooks
 */

import { invoke } from "@forge/bridge";

export class AdminConfigPanel {
  private container: HTMLElement;
  private isAdmin: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(): Promise<void> {
    try {
      // Check if user is admin
      const currentUser = await invoke("getCurrentUser");
      this.isAdmin = currentUser.isAdmin || false;

      if (!this.isAdmin) {
        this.renderReadOnlyView();
        return;
      }

      await this.renderEditView();
    } catch (err) {
      console.error("[FT_ADMIN_CONFIG_RENDER_FAILED]", err);
      this.container.innerHTML =
        '<div class="error">Failed to load admin configuration</div>';
    }
  }

  private renderReadOnlyView(): void {
    this.container.innerHTML = `
      <div class="admin-config-readonly">
        <p>Drift monitoring configuration is available to Jira administrators only.</p>
      </div>
    `;
  }

  private async renderEditView(): Promise<void> {
    try {
      const config = await invoke("getMonitoringConfig");

      const allowedDomainsText = config.allowedDomains.join("\n");
      const slackUrl = config.webhooks?.slackWebhookUrl || "";
      const genericUrl = config.webhooks?.genericWebhookUrl || "";

      const html = `
        <div class="admin-config-panel">
          <h3>Drift Monitoring Configuration</h3>

          <form id="driftConfigForm">
            <div class="form-group">
              <label for="domains">Allowed Email Domains</label>
              <textarea
                id="domains"
                placeholder="example.com&#10;company.org"
                rows="5"
              >${allowedDomainsText}</textarea>
              <small>One domain per line (lowercase, no wildcards)</small>
            </div>

            <div class="form-group">
              <label for="slackWebhook">Slack Webhook URL (Optional)</label>
              <input
                type="password"
                id="slackWebhook"
                placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
                value="${slackUrl}"
              />
              <small>Must be https://hooks.slack.com</small>
            </div>

            <div class="form-group">
              <label for="genericWebhook">Generic Webhook URL (Optional)</label>
              <input
                type="password"
                id="genericWebhook"
                placeholder="https://your-domain.com/alerts"
                value="${genericUrl}"
              />
              <small>Must be allowlisted in manifest (for relay services)</small>
            </div>

            <button type="submit" class="save-btn">Save Configuration</button>
          </form>

          <div id="statusMsg" class="status-message" style="display: none;"></div>
        </div>
      `;

      this.container.innerHTML = html;
      this.applyStyles();
      this.attachEventListeners();
    } catch (err) {
      console.error("[FT_ADMIN_CONFIG_LOAD_FAILED]", err);
      this.container.innerHTML =
        '<div class="error">Failed to load configuration</div>';
    }
  }

  private attachEventListeners(): void {
    const form = document.getElementById("driftConfigForm") as HTMLFormElement;
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const domainsText = (
        document.getElementById("domains") as HTMLTextAreaElement
      ).value;
      const slackUrl = (document.getElementById("slackWebhook") as HTMLInputElement)
        .value;
      const genericUrl = (document.getElementById("genericWebhook") as HTMLInputElement)
        .value;

      // Normalize domains
      const allowedDomains = domainsText
        .split("\n")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      const uniqueDomains = Array.from(new Set(allowedDomains)).sort();

      try {
        await invoke("saveMonitoringConfig", {
          allowedDomains: uniqueDomains,
          webhooks: {
            slackWebhookUrl: slackUrl || undefined,
            genericWebhookUrl: genericUrl || undefined,
          },
        });

        this.showStatus("Configuration saved successfully", "success");
      } catch (err) {
        console.error("[FT_ADMIN_CONFIG_SAVE_FAILED]", err);
        this.showStatus("Failed to save configuration", "error");
      }
    });
  }

  private showStatus(message: string, type: "success" | "error"): void {
    const msg = document.getElementById("statusMsg");
    if (!msg) return;

    msg.textContent = message;
    msg.className = `status-message status-${type}`;
    msg.style.display = "block";

    setTimeout(() => {
      msg.style.display = "none";
    }, 5000);
  }

  private applyStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .admin-config-panel {
        padding: 16px;
        max-width: 600px;
      }

      .admin-config-panel h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .admin-config-readonly {
        padding: 16px;
        background: #f5f5f5;
        border-radius: 4px;
        color: #666;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 13px;
      }

      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        box-sizing: border-box;
      }

      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #0055cc;
        box-shadow: 0 0 0 3px rgba(0, 85, 204, 0.1);
      }

      .form-group small {
        display: block;
        margin-top: 4px;
        color: #666;
        font-size: 12px;
      }

      .save-btn {
        background: #0055cc;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        font-size: 13px;
      }

      .save-btn:hover {
        background: #0044a3;
      }

      .status-message {
        padding: 12px;
        border-radius: 4px;
        margin-top: 16px;
        font-size: 13px;
      }

      .status-success {
        background: #dffcf0;
        color: #216e4e;
        border-left: 3px solid #2d9b45;
      }

      .status-error {
        background: #fff0f0;
        color: #5e4a47;
        border-left: 3px solid #ae2a19;
      }
    `;

    document.head.appendChild(style);
  }
}
