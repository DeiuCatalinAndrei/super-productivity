from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# GLOBAL_CONFIG gets one synced LifeOS subsection inside existing TasksConfig.
replace_once(
    'src/app/features/config/global-config.model.ts',
    "import { TaskReminderOptionId } from '../tasks/task.model';\n",
    "import { TaskReminderOptionId } from '../tasks/task.model';\nimport { LifeOsConfig } from '../lifeos/life-os.model';\n",
)
replace_once(
    'src/app/features/config/global-config.model.ts',
    "  notesTemplate: string;\n}>;",
    "  notesTemplate: string;\n  /** Native LifeOS task metadata dictionaries and saved context views. */\n  lifeOs?: LifeOsConfig;\n}>;",
)

replace_once(
    'src/app/features/config/default-global-config.const.ts',
    "import { DEFAULT_MAX_BACKUP_FILES } from '../../../../electron/shared-with-frontend/backup-file-cleanup.util';\n",
    "import { DEFAULT_MAX_BACKUP_FILES } from '../../../../electron/shared-with-frontend/backup-file-cleanup.util';\nimport { DEFAULT_LIFE_OS_CONFIG } from '../lifeos/life-os.const';\n",
)
replace_once(
    'src/app/features/config/default-global-config.const.ts',
    "    notesTemplate: defaultTaskNotesTemplate,\n  },",
    "    notesTemplate: defaultTaskNotesTemplate,\n    lifeOs: DEFAULT_LIFE_OS_CONFIG,\n  },",
)

# TASK fields remain on the native TASK entity and therefore travel through the
# normal operation log / backup / sync path.
replace_once(
    'src/app/features/tasks/task.model.ts',
    "  // Additional app-specific fields\n\n  /**\n   * Scheduled time as Unix timestamp (ms). For tasks scheduled with a specific time.\n",
    "  // Additional app-specific fields\n\n  /** LifeOS priority id (configured in GLOBAL_CONFIG.tasks.lifeOs). */\n  lifePriorityId?: string | null;\n  /** Concentration required, from 1 (light) to 5 (deep focus). */\n  lifeFocus?: number | null;\n  /** Energy required, from 1 (very low) to 5 (very demanding). */\n  lifeEnergy?: number | null;\n  /** Soft due date, separate from Scheduled (dueDay) and hard Deadline. */\n  lifeDueDay?: string | null;\n  /** Logical locations where the task can be performed. */\n  lifeLocationIds?: string[];\n  /** Devices/tools/requirements needed to perform the task. */\n  lifeRequirementIds?: string[];\n  /** GTD-style next action marker. */\n  lifeIsNextAction?: boolean;\n  /** Waiting-for person/event/free-form note. */\n  lifeWaitingFor?: string | null;\n  /** Native TASK ids that currently block this task. */\n  lifeBlockedByTaskIds?: string[];\n  /** Optional date on which this task should surface in Weekly Review. */\n  lifeReviewDay?: string | null;\n\n  /**\n   * Scheduled time as Unix timestamp (ms). For tasks scheduled with a specific time.\n",
)
replace_once(
    'src/app/features/tasks/task.model.ts',
    "  attachments: [],\n};",
    "  attachments: [],\n  lifeLocationIds: [],\n  lifeRequirementIds: [],\n  lifeBlockedByTaskIds: [],\n};",
)

# PROJECT is also the native Goal/Subgoal/Subproject entity. Defaults are optional
# and are inherited by new tasks without overwriting explicit task values.
replace_once(
    'src/app/features/project/project.model.ts',
    "  /** Hard goal deadline (YYYY-MM-DD). */\n  goalDeadlineDay?: string | null;\n",
    "  /** Hard goal deadline (YYYY-MM-DD). */\n  goalDeadlineDay?: string | null;\n  /** Default LifeOS metadata inherited by newly-created tasks. */\n  lifeDefaultPriorityId?: string | null;\n  lifeDefaultFocus?: number | null;\n  lifeDefaultEnergy?: number | null;\n  lifeDefaultLocationIds?: string[];\n  lifeDefaultRequirementIds?: string[];\n",
)

# Allow TaskService.add(..., {projectId}) to create directly in any native Goal,
# Subgoal, Project or Subproject. Inherit context defaults only when caller did
# not explicitly supply a value.
replace_once(
    'src/app/features/tasks/task.service.ts',
    "import { INBOX_PROJECT } from '../project/project.const';\n",
    "import { INBOX_PROJECT } from '../project/project.const';\nimport { selectProjectFeatureState } from '../project/store/project.selectors';\n",
)
replace_once(
    'src/app/features/tasks/task.service.ts',
    "  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);\n",
    "  private readonly _taskEntities = this._store.selectSignal(selectTaskEntities);\n  private readonly _projectState = this._store.selectSignal(selectProjectFeatureState);\n",
)
old = """    const workContextId = this._workContextService.activeWorkContextId as string;
    const workContextType = this._workContextService
      .activeWorkContextType as WorkContextType;
    const task = this.createNewTaskWithDefaults({
      title,
      additional,
      workContextType,
      workContextId,
    });
"""
new = """    const explicitProjectId = additional.projectId || null;
    const workContextId =
      explicitProjectId || (this._workContextService.activeWorkContextId as string);
    const workContextType = explicitProjectId
      ? WorkContextType.PROJECT
      : (this._workContextService.activeWorkContextType as WorkContextType);

    const targetProject = explicitProjectId
      ? this._projectState().entities[explicitProjectId]
      : workContextType === WorkContextType.PROJECT
        ? this._projectState().entities[workContextId]
        : undefined;
    const inherited: Partial<Task> = targetProject
      ? {
          lifePriorityId: targetProject.lifeDefaultPriorityId ?? undefined,
          lifeFocus: targetProject.lifeDefaultFocus ?? undefined,
          lifeEnergy: targetProject.lifeDefaultEnergy ?? undefined,
          lifeLocationIds: targetProject.lifeDefaultLocationIds ?? undefined,
          lifeRequirementIds: targetProject.lifeDefaultRequirementIds ?? undefined,
        }
      : {};
    const task = this.createNewTaskWithDefaults({
      title,
      additional: { ...inherited, ...additional },
      workContextType,
      workContextId,
    });
"""
replace_once('src/app/features/tasks/task.service.ts', old, new)

print('LifeOS v2 core model patch applied.')
