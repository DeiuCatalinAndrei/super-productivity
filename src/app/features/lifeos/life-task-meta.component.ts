import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { setSelectedTask } from '../tasks/store/task.actions';
import { LifeContextEngineService } from './life-context-engine.service';
import { LifeOsConfigService } from './life-os-config.service';
import {
  LifeTaskFieldsComponent,
  LifeTaskMetaValue,
  LifeTaskPickerSuggestion,
} from './life-task-fields.component';

@Component({
  selector: 'life-task-meta',
  standalone: true,
  imports: [MatIconModule, LifeTaskFieldsComponent],
  template: `
    <section
      class="life-meta"
      aria-label="Task intelligence"
    >
      <header>
        <mat-icon>tune</mat-icon>
        <strong>Task intelligence</strong>
      </header>

      <life-task-fields
        [config]="config()"
        [value]="metaValue()"
        [blockerSuggestions]="blockerCandidates()"
        (valueChange)="onValueChange($event)"
      />

      <div class="legend">
        <span><strong>Focus</strong>: concentration required</span>
        <span><strong>Energy</strong>: effort required</span>
        <span><strong>Due</strong>: desired completion</span>
        <span><strong>Deadline</strong>: hard limit in the native Deadline field</span>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .life-meta {
        border-top: 1px solid var(--divider-color);
        border-bottom: 1px solid var(--divider-color);
        padding: 14px 16px;
      }

      header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      header mat-icon {
        color: var(--brand);
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-top: 12px;
        color: var(--text-color-muted);
        font-size: 0.72rem;
      }

      @media (max-width: 600px) {
        .life-meta {
          padding-inline: 12px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeTaskMetaComponent {
  readonly task = input.required<Task>();

  private readonly _taskService = inject(TaskService);
  private readonly _store = inject(Store);
  private readonly _lifeConfig = inject(LifeOsConfigService);
  private readonly _contextEngine = inject(LifeContextEngineService);
  private readonly _allTasks = toSignal(this._taskService.allTasks$ ?? of([] as Task[]), {
    initialValue: [] as Task[],
  });

  readonly config = this._lifeConfig.config;

  readonly metaValue = computed<LifeTaskMetaValue>(() => {
    const task = this.task();
    return {
      priorityId: task.lifePriorityId || this.config().defaultPriorityId || null,
      focus: task.lifeFocus ?? null,
      energy: task.lifeEnergy ?? null,
      dueDay: task.lifeDueDay || null,
      locationIds: task.lifeLocationIds || [],
      requirementIds: task.lifeRequirementIds || [],
      isNextAction: !!task.lifeIsNextAction,
      waitingFor: task.lifeWaitingFor || null,
      followUpDay: task.lifeFollowUpDay || null,
      reviewDay: task.lifeReviewDay || null,
      blockedByTaskIds: task.lifeBlockedByTaskIds || [],
    };
  });

  readonly blockerCandidates = computed<LifeTaskPickerSuggestion[]>(() => {
    const current = this.task();
    const selected = new Set(current.lifeBlockedByTaskIds || []);
    const tasks = this._allTasks();
    return tasks
      .filter(
        (candidate) =>
          candidate.id !== current.id &&
          !candidate.isDone &&
          (selected.has(candidate.id) ||
            !this._contextEngine.wouldCreateDependencyCycle(
              current.id,
              candidate.id,
              tasks,
            )),
      )
      .map((candidate) => ({ id: candidate.id, title: candidate.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  onValueChange(value: LifeTaskMetaValue): void {
    const tasks = this._allTasks();
    const blockedByTaskIds = value.blockedByTaskIds.filter(
      (blockerId) =>
        !this._contextEngine.wouldCreateDependencyCycle(this.task().id, blockerId, tasks),
    );

    this._update({
      lifePriorityId: value.priorityId,
      lifeFocus: value.focus,
      lifeEnergy: value.energy,
      lifeDueDay: value.dueDay,
      lifeLocationIds: value.locationIds,
      lifeRequirementIds: value.requirementIds,
      lifeIsNextAction: value.isNextAction,
      lifeWaitingFor: value.waitingFor,
      lifeFollowUpDay: value.waitingFor ? value.followUpDay : null,
      lifeReviewDay: value.reviewDay,
      lifeBlockedByTaskIds: blockedByTaskIds,
    });
  }

  private _update(changes: Partial<Task>): void {
    const taskId = this.task().id;
    this._taskService.update(taskId, changes);
    this._store.dispatch(
      setSelectedTask({
        id: taskId,
        isSkipToggle: true,
      }),
    );
  }
}
