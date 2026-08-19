import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';
import { Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { LifeOsConfigService } from './life-os-config.service';

@Component({
  selector: 'life-task-meta',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section
      class="life-meta"
      aria-label="Task intelligence"
    >
      <header>
        <mat-icon>tune</mat-icon>
        <strong>Task intelligence</strong>
      </header>

      <div class="meta-grid">
        <label>
          <span>Priority</span>
          <select
            [value]="task().lifePriorityId || config().defaultPriorityId || ''"
            (change)="update('lifePriorityId', $any($event.target).value || null)"
          >
            <option value="">None</option>
            @for (level of config().priorityLevels; track level.id) {
              <option [value]="level.id">{{ level.label }}</option>
            }
          </select>
        </label>

        <label>
          <span>Focus</span>
          <select
            [value]="task().lifeFocus || ''"
            (change)="updateNumber('lifeFocus', $any($event.target).value)"
          >
            <option value="">Not set</option>
            @for (level of scale; track level) {
              <option [value]="level">{{ level }} / 5</option>
            }
          </select>
        </label>

        <label>
          <span>Energy</span>
          <select
            [value]="task().lifeEnergy || ''"
            (change)="updateNumber('lifeEnergy', $any($event.target).value)"
          >
            <option value="">Not set</option>
            @for (level of scale; track level) {
              <option [value]="level">{{ level }} / 5</option>
            }
          </select>
        </label>

        <label>
          <span>Due date</span>
          <input
            type="date"
            [value]="task().lifeDueDay || ''"
            (change)="update('lifeDueDay', $any($event.target).value || null)"
          />
        </label>

        <label>
          <span>Location</span>
          <select
            multiple
            [value]="task().lifeLocationIds || []"
            (change)="updateMulti('lifeLocationIds', $event)"
          >
            @for (option of config().locations; track option.id) {
              <option
                [value]="option.id"
                [selected]="(task().lifeLocationIds || []).includes(option.id)"
              >
                {{ option.label }}
              </option>
            }
          </select>
        </label>

        <label>
          <span>Requires</span>
          <select
            multiple
            [value]="task().lifeRequirementIds || []"
            (change)="updateMulti('lifeRequirementIds', $event)"
          >
            @for (option of config().requirements; track option.id) {
              <option
                [value]="option.id"
                [selected]="(task().lifeRequirementIds || []).includes(option.id)"
              >
                {{ option.label }}
              </option>
            }
          </select>
        </label>
      </div>

      <div class="workflow-grid">
        <label class="check-row">
          <input
            type="checkbox"
            [checked]="!!task().lifeIsNextAction"
            (change)="update('lifeIsNextAction', $any($event.target).checked)"
          />
          <span
            ><strong>Next action</strong
            ><small>Ready to do when context allows.</small></span
          >
        </label>

        <label>
          <span>Waiting for</span>
          <input
            type="text"
            placeholder="Person, reply, event…"
            [value]="task().lifeWaitingFor || ''"
            (change)="update('lifeWaitingFor', $any($event.target).value.trim() || null)"
          />
        </label>

        <label>
          <span>Blocked by</span>
          <select
            multiple
            (change)="updateMulti('lifeBlockedByTaskIds', $event)"
          >
            @for (candidate of blockerCandidates(); track candidate.id) {
              <option
                [value]="candidate.id"
                [selected]="(task().lifeBlockedByTaskIds || []).includes(candidate.id)"
              >
                {{ candidate.title }}
              </option>
            }
          </select>
        </label>

        <label>
          <span>Review date</span>
          <input
            type="date"
            [value]="task().lifeReviewDay || ''"
            (change)="update('lifeReviewDay', $any($event.target).value || null)"
          />
        </label>
      </div>

      <div class="legend">
        <span><strong>Focus</strong>: concentration required</span>
        <span><strong>Energy</strong>: effort required</span>
        <span><strong>Due</strong>: desired completion</span>
        <span
          ><strong>Deadline</strong>: hard limit (kept in the native Deadline field)</span
        >
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
        border-top: 1px solid rgba(127, 127, 127, 0.24);
        border-bottom: 1px solid rgba(127, 127, 127, 0.24);
        padding: 14px 16px;
      }
      header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      header mat-icon {
        opacity: 0.76;
      }
      .meta-grid,
      .workflow-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 12px;
      }
      .workflow-grid {
        margin-top: 12px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }
      label > span:first-child {
        font-size: 0.76rem;
        opacity: 0.72;
      }
      select,
      input[type='date'],
      input[type='text'] {
        box-sizing: border-box;
        width: 100%;
        min-height: 42px;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        padding: 8px 10px;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      select[multiple] {
        min-height: 78px;
      }
      option {
        color: initial;
      }
      .check-row {
        flex-direction: row;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
      }
      .check-row input {
        width: 18px;
        height: 18px;
      }
      .check-row span {
        display: flex;
        flex-direction: column;
        opacity: 1;
      }
      .check-row small {
        opacity: 0.62;
        margin-top: 2px;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-top: 12px;
        font-size: 0.72rem;
        opacity: 0.64;
      }
      @media (max-width: 600px) {
        .life-meta {
          padding-inline: 12px;
        }
        .meta-grid,
        .workflow-grid {
          grid-template-columns: 1fr;
        }
        select,
        input[type='date'],
        input[type='text'] {
          min-height: 48px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeTaskMetaComponent {
  readonly task = input.required<Task>();
  readonly scale = [1, 2, 3, 4, 5] as const;

  private readonly _taskService = inject(TaskService);
  private readonly _lifeConfig = inject(LifeOsConfigService);
  private readonly _allTasks = toSignal(this._taskService.allTasks$ ?? of([] as Task[]), {
    initialValue: [] as Task[],
  });

  readonly config = this._lifeConfig.config;
  readonly blockerCandidates = computed(() =>
    this._allTasks()
      .filter((candidate) => candidate.id !== this.task().id && !candidate.isDone)
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  update(key: keyof Task, value: unknown): void {
    this._update({ [key]: value } as Partial<Task>);
  }

  updateNumber(key: 'lifeFocus' | 'lifeEnergy', raw: string): void {
    const value = raw ? Math.max(1, Math.min(5, Number(raw))) : null;
    this._update({ [key]: value });
  }

  updateMulti(
    key: 'lifeLocationIds' | 'lifeRequirementIds' | 'lifeBlockedByTaskIds',
    event: Event,
  ): void {
    const select = event.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions).map((option) => option.value);
    this._update({ [key]: values });
  }

  private _update(changes: Partial<Task>): void {
    const taskId = this.task().id;
    this._taskService.update(taskId, changes);
    this._taskService.setSelectedId(taskId, true);
  }
}
