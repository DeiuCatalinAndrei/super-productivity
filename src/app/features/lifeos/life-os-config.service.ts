import { computed, inject, Injectable } from '@angular/core';
import { GlobalConfigService } from '../config/global-config.service';
import { DEFAULT_LIFE_OS_CONFIG } from './life-os.const';
import { LifeOsConfig, LifeSmartView } from './life-os.model';
import { Task } from '../tasks/task.model';

@Injectable({ providedIn: 'root' })
export class LifeOsConfigService {
  private readonly _globalConfig = inject(GlobalConfigService);

  readonly config = computed<LifeOsConfig>(() => {
    const stored = this._globalConfig.tasks()?.lifeOs;
    return {
      ...DEFAULT_LIFE_OS_CONFIG,
      ...(stored ?? {}),
      priorityLevels:
        stored?.priorityLevels?.length
          ? stored.priorityLevels
          : DEFAULT_LIFE_OS_CONFIG.priorityLevels,
      locations:
        stored?.locations?.length ? stored.locations : DEFAULT_LIFE_OS_CONFIG.locations,
      requirements:
        stored?.requirements?.length
          ? stored.requirements
          : DEFAULT_LIFE_OS_CONFIG.requirements,
      smartViews:
        stored?.smartViews?.length
          ? stored.smartViews
          : DEFAULT_LIFE_OS_CONFIG.smartViews,
    };
  });

  update(changes: Partial<LifeOsConfig>): void {
    this._globalConfig.updateSection(
      'tasks',
      {
        lifeOs: {
          ...this.config(),
          ...changes,
        },
      },
      true,
    );
  }

  matchesView(task: Task, view: LifeSmartView): boolean {
    if (task.isDone) return false;
    if (view.nextActionsOnly && !task.lifeIsNextAction) return false;
    if (view.priorityIds?.length && !view.priorityIds.includes(task.lifePriorityId ?? '')) {
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
}
