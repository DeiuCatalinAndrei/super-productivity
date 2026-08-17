import { inject, Injectable } from '@angular/core';
import { Update } from '@ngrx/entity';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, forkJoin } from 'rxjs';
import { delay, first } from 'rxjs/operators';

import { DialogConfirmComponent } from '../../ui/dialog-confirm/dialog-confirm.component';
import { T } from '../../t.const';
import { _MISSING_PROJECT_ } from '../project/project.const';
import { ProjectService } from '../project/project.service';
import { TaskRepeatCfgService } from '../task-repeat-cfg/task-repeat-cfg.service';
import { Task, TaskCopy, TaskWithSubTasks } from './task.model';
import { TaskService } from './task.service';
import { selectTaskByIdWithSubTaskData } from './store/task.selectors';

@Injectable({ providedIn: 'root' })
export class TaskProjectMoveService {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _taskRepeatCfgService = inject(TaskRepeatCfgService);
  private readonly _projectService = inject(ProjectService);
  private readonly _matDialog = inject(MatDialog);

  /**
   * Moves a native task to another native project while preserving repeat-config
   * semantics. Goals never own tasks directly; callers pass only executable
   * project ids, so task -> project remains the single source of truth.
   */
  async moveTaskToProject(
    task: TaskWithSubTasks | Task,
    projectId: string,
  ): Promise<boolean> {
    if (projectId === task.projectId) {
      return false;
    }

    const taskWithSubTasks = await this._getTaskWithSubtasks(task.id);
    if (!task.repeatCfgId) {
      this._taskService.moveToProject(taskWithSubTasks, projectId);
      return true;
    }

    const [repeatCfg, nonArchiveInstances, archiveInstances, targetProject] =
      await firstValueFrom(
        forkJoin([
          this._taskRepeatCfgService
            .getTaskRepeatCfgByIdAllowUndefined$(task.repeatCfgId)
            .pipe(first()),
          this._taskService
            .getTasksWithSubTasksByRepeatCfgId$(task.repeatCfgId)
            .pipe(first()),
          this._taskService.getArchiveTasksForRepeatCfgId(task.repeatCfgId),
          this._projectService.getByIdOnce$(projectId),
        ]),
      );

    // A remote client may have removed the repeat config while this task still
    // references it. In that case moving the concrete task is still safe.
    if (!repeatCfg) {
      this._taskService.moveToProject(taskWithSubTasks, projectId);
      return true;
    }

    if (nonArchiveInstances.length === 1 && archiveInstances.length === 0) {
      this._taskRepeatCfgService.updateTaskRepeatCfg(repeatCfg.id, { projectId });
      this._taskService.moveToProject(taskWithSubTasks, projectId);
      return true;
    }

    const isConfirm = await firstValueFrom(
      this._matDialog
        .open(DialogConfirmComponent, {
          data: {
            okTxt: T.F.TASK_REPEAT.D_CONFIRM_MOVE_TO_PROJECT.OK,
            message: T.F.TASK_REPEAT.D_CONFIRM_MOVE_TO_PROJECT.MSG,
            translateParams: {
              projectName: targetProject?.title ?? _MISSING_PROJECT_,
              tasksNr: nonArchiveInstances.length + archiveInstances.length,
            },
          },
        })
        .afterClosed(),
    );

    if (!isConfirm) {
      return false;
    }

    this._taskRepeatCfgService.updateTaskRepeatCfg(repeatCfg.id, { projectId });
    nonArchiveInstances.forEach((instance) => {
      this._taskService.moveToProject(instance, projectId);
    });

    const archiveUpdates: Update<TaskCopy>[] = [];
    archiveInstances.forEach((archiveTask) => {
      archiveUpdates.push({
        id: archiveTask.id,
        changes: { projectId },
      });
      archiveTask.subTaskIds.forEach((subTaskId) => {
        archiveUpdates.push({
          id: subTaskId,
          changes: { projectId },
        });
      });
    });
    this._taskService.updateArchiveTasks(archiveUpdates);
    return true;
  }

  private async _getTaskWithSubtasks(taskId: string): Promise<TaskWithSubTasks> {
    const task = await firstValueFrom(
      this._store
        .select(selectTaskByIdWithSubTaskData, { id: taskId })
        .pipe(first(), delay(50)),
    );
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task;
  }
}
