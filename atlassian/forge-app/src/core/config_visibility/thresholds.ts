/**
 * CONFIG VISIBILITY THRESHOLDS
 * 
 * Neutral scale bands for Jira configuration complexity.
 * These thresholds indicate observed scale ranges only.
 * They are NOT value judgments (good/bad, ideal/suboptimal).
 * No enforcement, recommendations, or prescriptive guidance.
 */

export interface Threshold {
  LOW: number;
  MEDIUM_START: number;
  HIGH_START: number;
}

/**
 * Static thresholds. No env overrides.
 * Comment explains each band is a neutral scale range.
 */
export const THRESHOLDS = {
  // Custom fields: scale bands indicate observed configuration scope
  customFieldCount: {
    LOW: 250,
    MEDIUM_START: 251,
    HIGH_START: 1001,
  } as Threshold,

  // Workflows: scale bands indicate observed workflow volume
  workflowCount: {
    LOW: 100,
    MEDIUM_START: 101,
    HIGH_START: 501,
  } as Threshold,

  // Workflow schemes: scale bands indicate observed scheme complexity
  workflowSchemeCount: {
    LOW: 50,
    MEDIUM_START: 51,
    HIGH_START: 201,
  } as Threshold,

  // Screens: scale bands indicate observed screen configuration scope
  screenCount: {
    LOW: 200,
    MEDIUM_START: 201,
    HIGH_START: 801,
  } as Threshold,

  // Permission schemes: scale bands indicate observed permission scope
  permissionSchemeCount: {
    LOW: 50,
    MEDIUM_START: 51,
    HIGH_START: 201,
  } as Threshold,

  // Max workflows per scheme: scale band indicates workflow distribution depth
  maxWorkflowsPerScheme: {
    LOW: 25,
    MEDIUM_START: 26,
    HIGH_START: 76,
  } as Threshold,

  // Max projects per permission scheme: scale band indicates permission mapping breadth
  maxProjectsPerPermissionScheme: {
    LOW: 10,
    MEDIUM_START: 11,
    HIGH_START: 51,
  } as Threshold,
};
