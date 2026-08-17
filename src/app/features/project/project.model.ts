import { IssueIntegrationCfgs, IssueProviderKey } from '../issue/issue.model';
import {
  WorkContextAdvancedCfgKey,
  WorkContextCommon,
} from '../work-context/work-context.model';
import { EntityState } from '@ngrx/entity';
// Import the unified Project type from plugin-api
import { Project as PluginProject } from '@super-productivity/plugin-api';

export type RoundTimeOption = '5M' | 'QUARTER' | 'HALF' | 'HOUR' | null | undefined;

/**
 * Native hierarchy marker for the personal Goals workflow.
 *
 * These values live directly on the existing PROJECT entity, so they use the
 * same persistence, operation log, backup/restore and cross-device sync path
 * as every other project field. No plugin/localStorage side database is used.
 * All fields remain optional so existing synced snapshots stay backward-compatible.
 */
export type LifeProjectType = 'goal' | 'project';

export interface ProjectBasicCfg {
  title: string;
  /** Goal/subgoal/project hierarchy metadata, synchronized as PROJECT fields. */
  lifeType?: LifeProjectType;
  /** Parent goal/subgoal PROJECT id; null/undefined means a root goal. */
  parentProjectId?: string | null;
  /** Desired completion date (YYYY-MM-DD). */
  goalTargetDay?: string | null;
  /** Hard goal deadline (YYYY-MM-DD). */
  goalDeadlineDay?: string | null;
  // TODO remove maybe
  isArchived?: boolean;
  // Completed projects are a celebrated finish; completing also sets isArchived
  // (so the project hides from the active menu), but isDone stays distinct so a
  // finish can be told apart from a quietly-shelved archive.
  isDone?: boolean;
  doneOn?: number | null;
  isHiddenFromMenu?: boolean;
  isEnableBacklog?: boolean;
  taskIds: string[];
  backlogTaskIds: string[];
  noteIds: string[];
}

// Omit conflicting properties from PluginProject when extending
export interface ProjectCopy
  extends
    Omit<PluginProject, 'advancedCfg' | 'theme'>,
    ProjectBasicCfg,
    WorkContextCommon {
  // Additional app-specific fields
  issueIntegrationCfgs?: IssueIntegrationCfgs;
}

export type Project = Readonly<ProjectCopy>;

export type ProjectCfgFormKey =
  | WorkContextAdvancedCfgKey
  | IssueProviderKey
  | 'basic'
  | 'theme';

export type ProjectState = EntityState<Project>;
