/**
 * Future Roadmap: Structured content for roadmap display
 * Auto-suppression: Items with capability=true won't be rendered
 * (Already-shipped features are hidden from roadmap)
 */

export type RoadmapItem = {
  title: string;
  capabilities: string[]; // Keys from CURRENT_CAPABILITIES to check
  description: string;
  whyMatters: string;
  bullets: string[];
};

export type RoadmapSection = {
  title: string;
  items: RoadmapItem[];
};

export const FUTURE_ROADMAP: RoadmapSection[] = [
  {
    title: "Planned Capabilities",
    items: [
      {
        title: "PDF Export",
        capabilities: ["exportPdf"],
        description: "Download governance snapshots as formatted PDF reports.",
        whyMatters: "Enables offline sharing and archival of audit evidence with stakeholders and compliance teams.",
        bullets: [
          "Render dashboard state as PDF with charts and metadata",
          "Include timestamp, build ID, and freshness indicators",
          "Same snapshot ID and data as JSON/CSV exports for consistency"
        ]
      },
      {
        title: "Historical Comparisons",
        capabilities: ["historicalComparisons"],
        description: "Compare governance metrics across time periods to identify trends.",
        whyMatters: "Reveals patterns: whether configuration drift is accelerating, whether incident response is improving.",
        bullets: [
          "Month-over-month comparison of key metrics",
          "Trend analysis of failure rates and stale data incidents",
          "Export trend reports for stakeholder reviews"
        ]
      },
      {
        title: "Dependency Awareness",
        capabilities: ["dependencyAwareness"],
        description: "Surface workflow, permission, and configuration dependencies affecting risk.",
        whyMatters: "Helps teams understand blast radius of configuration changes and identify single points of failure.",
        bullets: [
          "Map workflow scheme dependencies to projects",
          "Identify permission scheme overlaps and conflicts",
          "Highlight custom fields used in multiple workflows"
        ]
      },
      {
        title: "Custom Metric Views",
        capabilities: ["customMetricViews"],
        description: "Let teams define and track their own governance metrics.",
        whyMatters: "Enables domain-specific monitoring: security teams track permission changes, ops teams track automation reliability.",
        bullets: [
          "Pluggable metric collectors via SDK",
          "Custom thresholds and alerting rules",
          "Export custom metrics alongside standard reports"
        ]
      },
      {
        title: "Predictive Signals",
        capabilities: ["predictiveSignals"],
        description: "Forecast governance risks before they become incidents.",
        whyMatters: "Shifts from reactive alerting to proactive risk management.",
        bullets: [
          "Predict when stale data will occur based on collection patterns",
          "Forecast permission scheme complexity growth",
          "Recommend retention policy updates based on trends"
        ]
      },
      {
        title: "Portfolio Rollups",
        capabilities: ["portfolioRollups"],
        description: "Aggregate governance metrics across multiple Jira instances.",
        whyMatters: "Enterprises need single pane of glass for multi-instance compliance.",
        bullets: [
          "Combine metrics from multiple Jira Cloud instances",
          "Cross-instance trend analysis and risk scoring",
          "Consolidated audit export for multi-instance compliance audits"
        ]
      }
    ]
  },
  {
    title: "Explicitly Not Planned",
    items: [] // Will be populated via staticNotPlanned
  },
  {
    title: "Enterprise Assurance",
    items: [] // Will be populated via staticAssurance
  }
];

export const STATIC_NOT_PLANNED = {
  title: "Explicitly Not Planned",
  items: [
    {
      title: "Jira Configuration Changes",
      description: "FirstTry does not make changes to Jira configuration. We observe only."
    },
    {
      title: "Recommendations or Auto-Remediation",
      description: "FirstTry reports facts only. Decision-making and remediation remain with human teams."
    },
    {
      title: "External Data Ingestion",
      description: "FirstTry monitors Jira only. We do not pull data from external compliance systems."
    },
    {
      title: "Jira Workflow Modifications",
      description: "We never modify workflows, permissions, or any Jira configuration."
    }
  ]
};

export const STATIC_ASSURANCE = {
  title: "Enterprise Assurance",
  items: [
    {
      title: "Fail-Closed Design",
      description: "Missing tenant identity, permission issues, or storage errors result in ERROR state with explicit reason."
    },
    {
      title: "Audit Trail",
      description: "All snapshots are immutable and timestamped. Export includes snapshot ID and generation time for traceability."
    },
    {
      title: "Tenant Isolation",
      description: "Data is keyed by tenant (cloudId). No cross-tenant data leaks or sharing."
    },
    {
      title: "No External Egress",
      description: "FirstTry does not initiate outbound network requests (verified by network surface scanner)."
    },
    {
      title: "Transparent Data Retention",
      description: "Retention policies are documented in docs/PRIVACY.md. Snapshots are retained per policy; exports include snapshot metadata."
    }
  ]
};
