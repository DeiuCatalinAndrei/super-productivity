// Native LifeOS types are intentionally stored on existing synced Super Productivity entities.
export interface LifePriorityLevel {
  id: string;
  label: string;
}

export interface LifeContextOption {
  id: string;
  label: string;
  icon?: string;
}

export interface LifeSmartView {
  id: string;
  label: string;
  icon?: string;
  priorityIds?: string[];
  locationIds?: string[];
  requirementIds?: string[];
  maxEstimateMinutes?: number | null;
  minFocus?: number | null;
  maxFocus?: number | null;
  minEnergy?: number | null;
  maxEnergy?: number | null;
  nextActionsOnly?: boolean;
}

export interface LifeOsConfig {
  priorityLevels: LifePriorityLevel[];
  defaultPriorityId: string | null;
  locations: LifeContextOption[];
  requirements: LifeContextOption[];
  smartViews: LifeSmartView[];
  weeklyReviewDay: number;
}

export type LifeGoalViewMode = 'full' | 'tree' | 'goals' | 'compact';

export const clampLifeScale = (value: number | null | undefined): number | null => {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
};
