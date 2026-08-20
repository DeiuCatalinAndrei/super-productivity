import { computed, inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';
import { GlobalConfigService } from '../config/global-config.service';
import { TasksConfig } from '../config/global-config.model';
import { ProjectCopy } from '../project/project.model';
import { updateProject } from '../project/store/project.actions';
import { selectAllProjects } from '../project/store/project.selectors';
import { Task, TaskCopy } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { DEFAULT_LIFE_OS_CONFIG } from './life-os.const';
import { LifeOsConfig, LifeSmartView } from './life-os.model';

type TasksConfigWithLifeOs = TasksConfig & { lifeOs?: LifeOsConfig };

@Injectable({ providedIn: 'root' })
export class LifeOsConfigService {
  private readonly _globalConfig = inject(GlobalConfigService);
  private readonly _taskService = inject(TaskService, { optional: true });
  private readonly _store = inject(Store, { optional: true });

  readonly config = computed<LifeOsConfig>(() => {
    const tasksCfg = this._globalConfig.tasks() as TasksConfigWithLifeOs | undefined;
    const stored = tasksCfg?.lifeOs;
    return {
      ...DEFAULT_LIFE_OS_CONFIG,
      ...(stored ?? {}),
      priorityLevels: stored?.priorityLevels?.length
        ? stored.priorityLevels
        : DEFAULT_LIFE_OS_CONFIG.priorityLevels,
      locations: stored?.locations?.length
        ? stored.locations
        : DEFAULT_LIFE_OS_CONFIG.locations,
      requirements: stored?.requirements?.length
        ? stored.requirements
        : DEFAULT_LIFE_OS_CONFIG.requirements,
      smartViews: stored?.smartViews?.length
        ? stored.smartViews
        : DEFAULT_LIFE_OS_CONFIG.smartViews,
    };
  });

  update(changes: Partial<LifeOsConfig>): void {
    const previous = this.config();
    const merged: LifeOsConfig = {
      ...previous,
      ...changes,
    };

    const priorityIds = new Set(merged.priorityLevels.map((item) => item.id));
    const locationIds = new Set(merged.locations.map((item) => item.id));
    const requirementIds = new Set(merged.requirements.map((item) => item.id));
    const defaultPriorityId =
      merged.defaultPriorityId && priorityIds.has(merged.defaultPriorityId)
        ? merged.defaultPriorityId
        : (merged.priorityLevels[0]?.id ?? null);

    const next: LifeOsConfig = {
      ...merged,
      defaultPriorityId,
      smartViews: merged.smartViews.map((view) => ({
        ...view,
        priorityIds: view.priorityIds?.filter((id) => priorityIds.has(id)),
        locationIds: view.locationIds?.filter((id) => locationIds.has(id)),
        requirementIds: view.requirementIds?.filter((id) => requirementIds.has(id)),
      })),
    };

    const sectionCfg: Partial<TasksConfigWithLifeOs> = { lifeOs: next };
    this._globalConfig.updateSection('tasks', sectionCfg as Partial<TasksConfig>, true);
    this._cleanupRemovedReferences(previous, next);
  }

  matchesView(task: Task, view: LifeSmartView): boolean {
    if (task.isDone) return false;
    if (view.nextActionsOnly && !task.lifeIsNextAction) return false;
    if (
      view.priorityIds?.length &&
      !view.priorityIds.includes(task.lifePriorityId ?? '')
    ) {
      return false;
    }

    const estimateMinutes = Math.round((task.timeEstimate || 0) / 60000);
    if (
      view.maxEstimateMinutes != null &&
      estimateMinutes > 0 &&
      estimateMinutes > view.maxEstimateMinutes
    ) {
      return false;
    }

    const focus = task.lifeFocus ?? 3;
    const energy = task.lifeEnergy ?? 3;
    if (view.minFocus != null && focus < view.minFocus) return false;
    if (view.maxFocus != null && focus > view.maxFocus) return false;
    if (view.minEnergy != null && energy < view.minEnergy) return false;
    if (view.maxEnergy != null && energy > view.maxEnergy) return false;

    if (view.locationIds?.length) {
      const taskLocations = task.lifeLocationIds?.length
        ? task.lifeLocationIds
        : ['anywhere'];
      if (!taskLocations.some((id) => view.locationIds!.includes(id))) return false;
    }

    if (view.requirementIds?.length) {
      const taskRequirements = task.lifeRequirementIds?.length
        ? task.lifeRequirementIds
        : ['any'];
      if (!taskRequirements.some((id) => view.requirementIds!.includes(id))) {
        return false;
      }
    }

    return true;
  }

  private _cleanupRemovedReferences(previous: LifeOsConfig, next: LifeOsConfig): void {
    const nextPriorityIds = new Set(next.priorityLevels.map((item) => item.id));
    const nextLocationIds = new Set(next.locations.map((item) => item.id));
    const nextRequirementIds = new Set(next.requirements.map((item) => item.id));
    const removedPriorityIds = new Set(
      previous.priorityLevels
        .map((item) => item.id)
        .filter((id) => !nextPriorityIds.has(id)),
    );
    const removedLocationIds = new Set(
      previous.locations.map((item) => item.id).filter((id) => !nextLocationIds.has(id)),
    );
    const removedRequirementIds = new Set(
      previous.requirements
        .map((item) => item.id)
        .filter((id) => !nextRequirementIds.has(id)),
    );

    if (
      !removedPriorityIds.size &&
      !removedLocationIds.size &&
      !removedRequirementIds.size
    ) {
      return;
    }

    this._cleanupTaskReferences(
      removedPriorityIds,
      removedLocationIds,
      removedRequirementIds,
      next.defaultPriorityId,
    );
    this._cleanupProjectReferences(
      removedPriorityIds,
      removedLocationIds,
      removedRequirementIds,
      next.defaultPriorityId,
    );
  }

  private _cleanupTaskReferences(
    removedPriorityIds: Set<string>,
    removedLocationIds: Set<string>,
    removedRequirementIds: Set<string>,
    replacementPriorityId: string | null,
  ): void {
    this._taskService?.allTasks$.pipe(take(1)).subscribe((tasks) => {
      for (const task of tasks) {
        const changes: Partial<TaskCopy> = {};
        if (task.lifePriorityId && removedPriorityIds.has(task.lifePriorityId)) {
          changes.lifePriorityId = replacementPriorityId;
        }
        if (task.lifeLocationIds?.some((id) => removedLocationIds.has(id))) {
          changes.lifeLocationIds = task.lifeLocationIds.filter(
            (id) => !removedLocationIds.has(id),
          );
        }
        if (task.lifeRequirementIds?.some((id) => removedRequirementIds.has(id))) {
          changes.lifeRequirementIds = task.lifeRequirementIds.filter(
            (id) => !removedRequirementIds.has(id),
          );
        }
        if (Object.keys(changes).length) {
          this._taskService?.update(task.id, changes);
        }
      }
    });
  }

  private _cleanupProjectReferences(
    removedPriorityIds: Set<string>,
    removedLocationIds: Set<string>,
    removedRequirementIds: Set<string>,
    replacementPriorityId: string | null,
  ): void {
    this._store
      ?.select(selectAllProjects)
      .pipe(take(1))
      .subscribe((projects) => {
        for (const project of projects) {
          const changes: Partial<ProjectCopy> = {};
          if (
            project.lifeDefaultPriorityId &&
            removedPriorityIds.has(project.lifeDefaultPriorityId)
          ) {
            changes.lifeDefaultPriorityId = replacementPriorityId;
          }
          if (project.lifeDefaultLocationIds?.some((id) => removedLocationIds.has(id))) {
            changes.lifeDefaultLocationIds = project.lifeDefaultLocationIds.filter(
              (id) => !removedLocationIds.has(id),
            );
          }
          if (
            project.lifeDefaultRequirementIds?.some((id) => removedRequirementIds.has(id))
          ) {
            changes.lifeDefaultRequirementIds = project.lifeDefaultRequirementIds.filter(
              (id) => !removedRequirementIds.has(id),
            );
          }
          if (Object.keys(changes).length) {
            this._store?.dispatch(
              updateProject({ project: { id: project.id, changes }, isSkipSnack: true }),
            );
          }
        }
      });
  }
}
