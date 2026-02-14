/**
 * Phase 2: Health Panel UI Component
 * Renders monitoring health status in dashboard
 */

import { invoke } from "@forge/bridge";

type HealthStatusResponse = {
  status: "AVAILABLE" | "UNAVAILABLE";
  lastScanUtc: string;
  nextScanUtc: string;
  driftCountLast30d: number;
  estimatedUsageBytes: number;
  estimatedQuotaBytes: number;
  lastFailureCode: string | null;
};

export class HealthPanel {
  private container: HTMLElement;
  private refreshInterval: number = 60000; // Refresh every 60s

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(): Promise<void> {
    try {
      const health = await invoke<HealthStatusResponse>("getMonitoringHealth");

      const html = `
        <div class="health-panel">
          <h3>Drift Monitoring Status</h3>
          
          <div class="health-grid">
            <div class="health-item">
              <span class="label">Status</span>
              <span class="value status-${health.status}">${health.status.toUpperCase()}</span>
            </div>
            
            <div class="health-item">
              <span class="label">Last Scan</span>
              <span class="value">${new Date(health.lastScanUtc).toLocaleString()}</span>
            </div>
            
            <div class="health-item">
              <span class="label">Next Scan</span>
              <span class="value">${new Date(health.nextScanUtc).toLocaleString()}</span>
            </div>
            
            <div class="health-item">
              <span class="label">Drifts (30d)</span>
              <span class="value">${health.driftCountLast30d}</span>
            </div>
            
            <div class="health-item">
              <span class="label">Storage Usage</span>
              <span class="value">${((health.estimatedUsageBytes / health.estimatedQuotaBytes) * 100).toFixed(1)}%</span>
            </div>
          </div>

          ${
            health.lastFailureCode
              ? `
          <div class="health-failure">
            <strong>Last Failure:</strong> ${health.lastFailureCode}
          </div>
          `
              : ""
          }

          <div class="health-storage-bar">
            <div class="bar" style="width: ${(
                (health.estimatedUsageBytes / health.estimatedQuotaBytes) *
                100
              ).toFixed(1)}%"></div>
          </div>
        </div>
      `;

      this.container.innerHTML = html;
      this.applyStyles();
    } catch (err) {
      console.error("[FT_HEALTH_PANEL_RENDER_FAILED]", err);
      this.container.innerHTML =
        '<div class="error">Failed to load health panel</div>';
    }
  }

  private applyStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .health-panel {
        padding: 16px;
        border-radius: 4px;
        background: #f5f5f5;
      }

      .health-panel h3 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .health-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .health-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .health-item .label {
        font-size: 12px;
        color: #666;
        font-weight: 500;
      }

      .health-item .value {
        font-size: 13px;
        font-weight: 600;
        color: #333;
      }

      .status-healthy {
        color: #2d9b45;
      }

      .status-degraded {
        color: #f79502;
      }

      .status-failed {
        color: #ae2a19;
      }

      .status-initializing {
        color: #0055cc;
      }

      .health-failure {
        padding: 8px 12px;
        background: #fff0f0;
        border-left: 3px solid #ae2a19;
        font-size: 12px;
        margin-bottom: 12px;
        color: #5e4a47;
      }

      .health-storage-bar {
        height: 6px;
        background: #ddd;
        border-radius: 3px;
        overflow: hidden;
      }

      .health-storage-bar .bar {
        height: 100%;
        background: linear-gradient(90deg, #0055cc, #2d9b45);
        transition: width 0.3s ease;
      }
    `;

    document.head.appendChild(style);
  }

  startAutoRefresh(): void {
    setInterval(() => {
      this.render();
    }, this.refreshInterval);
  }
}
