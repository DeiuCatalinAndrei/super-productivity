import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { nanoid } from 'nanoid';
import { firstValueFrom } from 'rxjs';

import { DialogPromptComponent } from '../../ui/dialog-prompt/dialog-prompt.component';
import { LifeProjectType, Project } from '../../features/project/project.model';
import { DEFAULT_PROJECT } from '../../features/project/project.const';
import {
  addProject,
  completeProject,
  reopenProject,
  updateProject,
} from '../../features/project/store/project.actions';
import { selectAllProjectsExceptInbox } from '../../features/project/store/project.selectors';
import { Task } from '../../features/tasks/task.model';
import { TaskService } from '../../features/tasks/task.service';
import { LifeOsConfigService } from '../../features/lifeos/life-os-config.service';
import { LifeGoalViewMode } from '../../features/lifeos/life-os.model';
import { DatePickerInputComponent } from '../../ui/date-picker-input/date-picker-input.component';
import { LifeFieldPickerComponent } from '../../features/lifeos/life-field-picker.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../features/lifeos/life-ui.const';
import { getDbDateStr } from '../../util/get-db-date-str';

interface GoalNode {
  project: Project;
  depth: number;
  progress: number;
  directTasks: Task[];
  childCount: number;
  remainingMs: number;
}

@Component({
  selector: 'goals-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    DatePickerInputComponent,
    LifeFieldPickerComponent,
  ],
  template: `
    <main class="goals-page">
      <header class="page-head">
        <div>
          <h1>Goals</h1>
          <p>
            Goal → Subgoal → Project → Subproject → Task → Subtask. Tasks can live
            directly on any goal or project level and everything uses native Super
            Productivity entities and sync.
          </p>
        </div>
        <div class="header-actions">
          <a
            mat-button
            routerLink="/life-settings"
          >
            <mat-icon>tune</mat-icon>
            Settings
          </a>
          <button
            mat-flat-button
            color="primary"
            (click)="addRootGoal()"
          >
            <mat-icon>add</mat-icon>
            New Goal
          </button>
        </div>
      </header>

      <nav
        class="view-switch"
        aria-label="Goals view"
      >
        @for (mode of viewModes; track mode.id) {
          <button
            mat-button
            [class.active]="viewMode() === mode.id"
            (click)="viewMode.set(mode.id)"
          >
            <mat-icon>{{ mode.icon }}</mat-icon>
            {{ mode.label }}
          </button>
        }
      </nav>

      @if (nodes().length === 0) {
        <mat-card class="empty-card">
          <mat-card-content>
            <mat-icon>flag</mat-icon>
            <h2>Start with one clear goal</h2>
            <p>
              Create a goal, then add direct tasks, subgoals, projects or subprojects.
            </p>
            <button
              mat-flat-button
              color="primary"
              (click)="addRootGoal()"
            >
              Create first goal
            </button>
          </mat-card-content>
        </mat-card>
      }

      <section
        class="goal-tree"
        [class.compact-view]="viewMode() === 'compact'"
      >
        @for (node of nodes(); track node.project.id) {
          <mat-card
            class="goal-card"
            [class.is-project]="node.project.lifeType === 'project'"
            [class.title-only]="viewMode() === 'tree' || viewMode() === 'compact'"
            [style.--goal-depth]="node.depth"
          >
            <mat-card-content>
              <div class="goal-topline">
                <button
                  class="collapse-btn"
                  mat-icon-button
                  [attr.aria-label]="isCollapsed(node.project.id) ? 'Expand' : 'Collapse'"
                  (click)="toggleCollapsed(node.project.id)"
                >
                  <mat-icon>{{
                    isCollapsed(node.project.id) ? 'chevron_right' : 'expand_more'
                  }}</mat-icon>
                </button>

                <div class="goal-title-wrap">
                  <mat-icon>{{
                    node.project.lifeType === 'project' ? 'folder' : 'flag'
                  }}</mat-icon>
                  <div class="title-copy">
                    <div class="kind">{{ kindLabel(node.project, node.depth) }}</div>
                    @if (node.project.lifeType === 'project') {
                      <a
                        class="title"
                        [routerLink]="['/project', node.project.id, 'tasks']"
                      >
                        {{ node.project.title }}
                      </a>
                    } @else {
                      <span class="title">{{ node.project.title }}</span>
                    }
                  </div>
                </div>

                <div class="progress-number">{{ node.progress }}%</div>
              </div>

              @if (viewMode() !== 'compact' && viewMode() !== 'tree') {
                <mat-progress-bar
                  mode="determinate"
                  [value]="node.progress"
                ></mat-progress-bar>
              }

              @if (!isCollapsed(node.project.id) && viewMode() === 'full') {
                <div class="stats">
                  <span
                    ><mat-icon>task_alt</mat-icon>{{ node.directTasks.length }} direct
                    tasks</span
                  >
                  <span
                    ><mat-icon>account_tree</mat-icon>{{ node.childCount }} direct
                    children</span
                  >
                  @if (node.remainingMs > 0) {
                    <span
                      ><mat-icon>schedule</mat-icon
                      >{{ formatDuration(node.remainingMs) }} remaining</span
                    >
                  }
                  @if (node.project.isDone) {
                    <span><mat-icon>verified</mat-icon>Completed</span>
                  }
                </div>

                <div class="dates">
                  <date-picker-input
                    label="Due date"
                    [ngModel]="node.project.goalTargetDay"
                    (ngModelChange)="
                      setGoalDateFromPicker(node.project.id, 'goalTargetDay', $event)
                    "
                  />
                  <date-picker-input
                    label="Deadline"
                    [ngModel]="node.project.goalDeadlineDay"
                    (ngModelChange)="
                      setGoalDateFromPicker(node.project.id, 'goalDeadlineDay', $event)
                    "
                  />
                </div>

                <details class="defaults">
                  <summary>Defaults for new tasks</summary>
                  <div class="defaults-grid">
                    <life-field-picker
                      label="Priority"
                      defaultIcon="priority_high"
                      emptyLabel="Use global default"
                      [options]="priorityOptions()"
                      [value]="node.project.lifeDefaultPriorityId || ''"
                      (valueChange)="
                        setProjectPickerDefault(
                          node.project.id,
                          'lifeDefaultPriorityId',
                          $event
                        )
                      "
                    />
                    <life-field-picker
                      label="Focus"
                      defaultIcon="psychology"
                      emptyLabel="Not set"
                      [options]="focusOptions"
                      [value]="numberPickerValue(node.project.lifeDefaultFocus)"
                      (valueChange)="
                        setProjectNumberPickerDefault(
                          node.project.id,
                          'lifeDefaultFocus',
                          $event
                        )
                      "
                    />
                    <life-field-picker
                      label="Energy"
                      defaultIcon="bolt"
                      emptyLabel="Not set"
                      [options]="energyOptions"
                      [value]="numberPickerValue(node.project.lifeDefaultEnergy)"
                      (valueChange)="
                        setProjectNumberPickerDefault(
                          node.project.id,
                          'lifeDefaultEnergy',
                          $event
                        )
                      "
                    />
                    <life-field-picker
                      label="Location"
                      defaultIcon="place"
                      emptyLabel="Anywhere"
                      [options]="locationOptions()"
                      [values]="node.project.lifeDefaultLocationIds || []"
                      [multiple]="true"
                      (valueChange)="
                        setProjectMultiPickerDefault(
                          node.project.id,
                          'lifeDefaultLocationIds',
                          $event
                        )
                      "
                    />
                    <life-field-picker
                      label="Requires"
                      defaultIcon="build"
                      emptyLabel="Anything"
                      [options]="requirementOptions()"
                      [values]="node.project.lifeDefaultRequirementIds || []"
                      [multiple]="true"
                      (valueChange)="
                        setProjectMultiPickerDefault(
                          node.project.id,
                          'lifeDefaultRequirementIds',
                          $event
                        )
                      "
                    />
                  </div>
                </details>

                <section class="direct-tasks">
                  <div class="section-head">
                    <strong>Tasks</strong>
                    <button
                      mat-button
                      (click)="addTask(node.project)"
                    >
                      <mat-icon>add_task</mat-icon>
                      Add Task
                    </button>
                  </div>
                  @if (!node.directTasks.length) {
                    <div class="task-empty">No direct tasks at this level.</div>
                  }
                  @for (task of node.directTasks; track task.id) {
                    <div
                      class="task-row"
                      role="button"
                      tabindex="0"
                      (click)="openTask(task.id)"
                      (keydown.enter)="openTask(task.id)"
                    >
                      <button
                        class="task-toggle"
                        type="button"
                        [attr.aria-label]="
                          task.isDone ? 'Mark task not done' : 'Mark task done'
                        "
                        (click)="toggleTaskDone(task, $event)"
                      >
                        <mat-icon>{{
                          task.isDone ? 'check_circle' : 'radio_button_unchecked'
                        }}</mat-icon>
                      </button>
                      <span
                        class="task-title"
                        [class.done]="task.isDone"
                        >{{ task.title }}</span
                      >
                      @if (priorityLabel(task.lifePriorityId); as priority) {
                        <span class="chip">{{ priority }}</span>
                      }
                      @if (task.lifeFocus) {
                        <span class="chip">F{{ task.lifeFocus }}</span>
                      }
                      @if (task.lifeEnergy) {
                        <span class="chip">E{{ task.lifeEnergy }}</span>
                      }
                      @if (task.lifeDueDay) {
                        <span class="chip">Due {{ task.lifeDueDay }}</span>
                      }
                      @if (task.lifeIsNextAction) {
                        <span class="chip next">Next</span>
                      }
                    </div>
                  }
                </section>

                <div class="actions">
                  @if (node.project.lifeType === 'goal') {
                    <button
                      mat-button
                      (click)="addChild(node.project, 'goal')"
                    >
                      <mat-icon>subdirectory_arrow_right</mat-icon>
                      Add Subgoal
                    </button>
                    <button
                      mat-button
                      (click)="addChild(node.project, 'project')"
                    >
                      <mat-icon>create_new_folder</mat-icon>
                      Add Project
                    </button>
                  } @else {
                    <button
                      mat-button
                      (click)="addChild(node.project, 'project')"
                    >
                      <mat-icon>create_new_folder</mat-icon>
                      Add Subproject
                    </button>
                  }

                  <button
                    mat-button
                    (click)="addTask(node.project)"
                  >
                    <mat-icon>add_task</mat-icon>
                    Add Task
                  </button>

                  @if (node.project.isDone) {
                    <button
                      mat-button
                      (click)="reopen(node.project)"
                    >
                      <mat-icon>restart_alt</mat-icon>
                      Reopen
                    </button>
                  } @else {
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="complete(node.project)"
                    >
                      <mat-icon>verified</mat-icon>
                      Complete
                    </button>
                  }

                  <button
                    mat-button
                    (click)="rename(node.project)"
                  >
                    <mat-icon>edit</mat-icon>
                    Rename
                  </button>
                </div>
              } @else if (!isCollapsed(node.project.id) && viewMode() === 'tree') {
                @if (node.directTasks.length) {
                  <div class="tree-tasks">
                    @for (task of node.directTasks; track task.id) {
                      <div
                        class="tree-task-row"
                        (click)="openTask(task.id)"
                      >
                        <button
                          class="task-toggle"
                          type="button"
                          (click)="toggleTaskDone(task, $event)"
                          [attr.aria-label]="
                            task.isDone ? 'Mark task not done' : 'Mark task done'
                          "
                        >
                          <mat-icon>{{
                            task.isDone ? 'check_box' : 'check_box_outline_blank'
                          }}</mat-icon>
                        </button>
                        <span [class.done]="task.isDone">{{ task.title }}</span>
                      </div>
                    }
                  </div>
                }
              }
            </mat-card-content>
          </mat-card>
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .goals-page {
        max-width: 920px;
        margin: 0 auto;
        padding: 20px 22px 96px;
        box-sizing: border-box;
      }

      .page-head {
        display: flex;
        gap: 18px;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .page-head h1 {
        margin: 0 0 3px;
        font-size: 1.48rem;
        font-weight: 600;
        letter-spacing: -0.015em;
      }

      .page-head p {
        margin: 0;
        max-width: 620px;
        color: var(--text-color-muted);
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .header-actions {
        display: flex;
        gap: 4px;
        flex-wrap: nowrap;
      }

      .header-actions > * {
        min-height: 36px;
        white-space: nowrap;
      }

      .view-switch {
        display: inline-flex;
        gap: 2px;
        max-width: 100%;
        overflow-x: auto;
        margin: 0 0 12px;
        padding: 2px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: color-mix(in srgb, var(--bg-lighter) 80%, transparent);
      }

      .view-switch button {
        --mat-button-text-label-text-color: var(--text-color-muted);
        min-width: 0;
        min-height: 32px;
        height: 32px;
        padding-inline: 9px;
        border-radius: calc(var(--card-border-radius) - 2px) !important;
        font-size: 12px;
        white-space: nowrap;
      }

      .view-switch button mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
        margin-right: 5px;
      }

      .view-switch button.active {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-selected);
      }

      .goal-tree {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .goal-card {
        --mdc-elevated-card-container-color: transparent;
        --mdc-elevated-card-container-elevation: none;
        overflow: hidden;
        margin-left: calc(var(--goal-depth) * 14px);
        border: 1px solid color-mix(in srgb, var(--divider-color) 78%, transparent);
        border-radius: var(--card-border-radius);
        box-shadow: none !important;
        background: transparent;
        transition:
          background-color var(--transition-fast),
          border-color var(--transition-fast);
      }

      .goal-card:hover {
        border-color: color-mix(in srgb, var(--text-color-muted) 34%, transparent);
        background: color-mix(in srgb, var(--state-hover) 46%, transparent);
      }

      .goal-card.is-project {
        border-inline-start: 1px solid
          color-mix(in srgb, var(--brand) 45%, var(--divider-color));
      }

      .goal-topline {
        display: flex;
        align-items: center;
        min-height: 36px;
        gap: 4px;
      }

      .collapse-btn {
        --mat-icon-button-icon-color: var(--text-color-muted);
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        padding: 4px;
      }

      .collapse-btn mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .goal-title-wrap {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        flex: 1;
      }

      .goal-title-wrap > mat-icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        font-size: 18px;
        color: var(--text-color-muted);
        opacity: 0.82;
      }

      .title-copy {
        min-width: 0;
      }

      .title {
        display: block;
        font-size: 0.94rem;
        font-weight: 520;
        color: inherit;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kind {
        font-size: 0.63rem;
        color: var(--text-color-muted);
        text-transform: uppercase;
        letter-spacing: 0.055em;
      }

      .progress-number {
        flex: 0 0 auto;
        margin-inline-start: 6px;
        padding: 2px 6px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--state-hover) 65%, transparent);
        color: var(--text-color-muted);
        font-size: 0.68rem;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
      }

      mat-progress-bar {
        margin-top: 8px;
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 9px;
        color: var(--text-color-muted);
        font-size: 0.76rem;
      }

      .stats span {
        display: inline-flex;
        gap: 4px;
        align-items: center;
      }

      .stats mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }

      .dates,
      .defaults-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 0.76rem;
      }

      input,
      select {
        color: inherit;
        background: transparent;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        padding: 8px;
        font: inherit;
        min-height: 40px;
        box-sizing: border-box;
      }

      select[multiple] {
        min-height: 72px;
      }

      select {
        color-scheme: light dark;
        background: Canvas;
        color: CanvasText;
      }

      option {
        background: Canvas;
        color: CanvasText;
      }

      .defaults {
        margin-top: 10px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        padding: 7px 9px;
      }

      .defaults summary {
        cursor: pointer;
        color: var(--text-color-muted);
        font-size: 0.78rem;
        font-weight: 550;
      }

      .direct-tasks {
        margin-top: 10px;
        border-top: 1px solid var(--divider-color);
        padding-top: 7px;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .task-empty {
        padding: 7px 0;
        color: var(--text-color-muted);
        font-size: 0.78rem;
      }

      .task-row {
        width: 100%;
        display: flex;
        gap: 6px;
        align-items: center;
        color: inherit;
        background: transparent;
        border: 0;
        border-radius: 6px;
        padding: 6px 5px;
        text-align: left;
        cursor: pointer;
      }

      .task-row:hover {
        background: var(--state-hover);
      }

      .task-row mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      .task-toggle {
        --mat-icon-button-icon-color: var(--text-color-muted);
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
        padding: 0;
      }

      .task-toggle:hover {
        background: var(--state-hover);
      }

      .task-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .task-title.done {
        text-decoration: line-through;
        opacity: 0.58;
      }

      .chip {
        font-size: 0.64rem;
        padding: 2px 6px;
        border-radius: 999px;
        background: var(--state-hover);
        color: var(--text-color-muted);
        white-space: nowrap;
      }

      .chip.next {
        color: var(--text-color-most-intense);
        font-weight: 600;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        margin-top: 8px;
      }

      .actions button {
        min-height: 34px;
        font-size: 12px;
      }

      .title-only mat-card-content {
        padding: 3px 7px;
      }

      .title-only .kind {
        display: none;
      }

      .tree-tasks {
        margin: 1px 0 4px 39px;
        padding-inline-start: 6px;
        display: flex;
        flex-direction: column;
        border-inline-start: 1px solid var(--divider-color);
      }

      .tree-task-row {
        display: flex;
        align-items: center;
        gap: 5px;
        min-height: 28px;
        padding: 1px 4px;
        border-radius: 5px;
        color: var(--text-color-muted);
        font-size: 0.84rem;
        cursor: pointer;
      }

      .tree-task-row:hover {
        background: var(--state-hover);
        color: var(--text-color-most-intense);
      }

      .tree-task-row .done {
        text-decoration: line-through;
        opacity: 0.58;
      }

      .tree-tasks mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }

      .tree-task-row .task-toggle {
        width: 24px;
        height: 24px;
      }

      .compact-view .goal-card {
        margin-left: 0;
      }

      .empty-card {
        --mdc-elevated-card-container-elevation: none;
        max-width: 520px;
        margin: 28px auto 0;
        padding: 20px;
        text-align: center;
        border: 1px solid var(--divider-color);
        box-shadow: none !important;
      }

      .empty-card mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--text-color-muted);
      }

      .empty-card h2 {
        margin-block: 8px 4px;
        font-size: 1.05rem;
        font-weight: 600;
      }

      .empty-card p {
        color: var(--text-color-muted);
        font-size: 0.82rem;
      }

      @media (max-width: 600px) {
        .goals-page {
          padding: 12px 9px 92px;
        }

        .page-head {
          align-items: stretch;
          flex-direction: column;
          gap: 10px;
        }

        .page-head p {
          font-size: 0.76rem;
        }

        .header-actions > * {
          min-height: 40px;
          flex: 1;
        }

        .view-switch {
          display: flex;
          width: 100%;
          box-sizing: border-box;
        }

        .view-switch button {
          flex: 1 0 auto;
        }

        .goal-card {
          margin-left: calc(min(var(--goal-depth), 3) * 5px);
        }

        .dates,
        .defaults-grid {
          grid-template-columns: 1fr;
        }

        .actions button,
        .actions a {
          min-height: 40px;
          min-width: 0;
          padding-inline: 7px;
        }

        .task-row {
          min-height: 40px;
        }

        .tree-tasks {
          margin-left: 32px;
        }

        .chip:nth-of-type(n + 4) {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsPageComponent {
  private readonly _store = inject(Store);
  private readonly _taskService = inject(TaskService);
  private readonly _dialog = inject(MatDialog);
  private readonly _lifeConfigService = inject(LifeOsConfigService);

  readonly viewMode = signal<LifeGoalViewMode>('tree');
  readonly collapsed = signal<Set<string>>(new Set());
  readonly scale = [1, 2, 3, 4, 5] as const;
  readonly lifeConfig = this._lifeConfigService.config;
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.lifeConfig()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.lifeConfig().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.lifeConfig().requirements, 'build'),
  );
  readonly viewModes: { id: LifeGoalViewMode; label: string; icon: string }[] = [
    { id: 'full', label: 'Full', icon: 'view_agenda' },
    { id: 'tree', label: 'Tree', icon: 'account_tree' },
    { id: 'goals', label: 'Goals', icon: 'flag' },
    { id: 'compact', label: 'Compact', icon: 'reorder' },
  ];

  private readonly _projects = toSignal(
    this._store.select(selectAllProjectsExceptInbox),
    { initialValue: [] as Project[] },
  );
  private readonly _tasks = toSignal(this._taskService.allTasks$, {
    initialValue: [] as Task[],
  });
  private readonly _archiveTasks = signal<Task[]>([]);
  private _archiveLoadGeneration = 0;

  constructor() {
    effect(() => {
      this._tasks();
      void this._reloadArchive();
    });
  }

  readonly nodes = computed<GoalNode[]>(() => {
    const projects = this._projects().filter((project) => !!project.lifeType);
    const liveTasks = this._tasks();
    const taskById = new Map<string, Task>();
    for (const task of this._archiveTasks()) taskById.set(task.id, task);
    for (const task of liveTasks) taskById.set(task.id, task);
    const tasks = [...taskById.values()];
    const byId = new Map(projects.map((project) => [project.id, project]));
    const children = new Map<string | null, Project[]>();
    const directTasks = new Map<string, Task[]>();
    const directLiveTasks = new Map<string, Task[]>();

    for (const project of projects) {
      const parentId = project.parentProjectId ?? null;
      const bucket = children.get(parentId) ?? [];
      bucket.push(project);
      children.set(parentId, bucket);
    }
    for (const bucket of children.values())
      bucket.sort((a, b) => a.title.localeCompare(b.title));

    for (const task of tasks) {
      if (task.parentId || !byId.has(task.projectId)) continue;
      const bucket = directTasks.get(task.projectId) ?? [];
      bucket.push(task);
      directTasks.set(task.projectId, bucket);
    }
    for (const task of liveTasks) {
      if (task.parentId || !byId.has(task.projectId)) continue;
      const bucket = directLiveTasks.get(task.projectId) ?? [];
      bucket.push(task);
      directLiveTasks.set(task.projectId, bucket);
    }
    for (const bucket of [...directTasks.values(), ...directLiveTasks.values()]) {
      bucket.sort(
        (a, b) => Number(a.isDone) - Number(b.isDone) || a.title.localeCompare(b.title),
      );
    }

    const taskProgress = (task: Task, path = new Set<string>()): number => {
      if (task.isDone) return 100;
      if (path.has(task.id)) return 0;
      const nextPath = new Set(path);
      nextPath.add(task.id);
      const subs = (task.subTaskIds ?? [])
        .map((id) => taskById.get(id))
        .filter((sub): sub is Task => !!sub);
      if (!subs.length) return 0;
      return Math.round(
        subs.reduce((sum, sub) => sum + taskProgress(sub, nextPath), 0) / subs.length,
      );
    };

    const progressMemo = new Map<string, number>();
    const nodeProgress = (project: Project, path = new Set<string>()): number => {
      if (project.isDone) return 100;
      const memo = progressMemo.get(project.id);
      if (memo != null) return memo;
      if (path.has(project.id)) return 0;
      const nextPath = new Set(path);
      nextPath.add(project.id);
      const parts = [
        ...(children.get(project.id) ?? []).map((child) => nodeProgress(child, nextPath)),
        ...(directTasks.get(project.id) ?? []).map((task) => taskProgress(task)),
      ];
      const value = parts.length
        ? Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length)
        : 0;
      progressMemo.set(project.id, value);
      return value;
    };

    const remainingMemo = new Map<string, number>();
    const nodeRemaining = (project: Project, path = new Set<string>()): number => {
      const memo = remainingMemo.get(project.id);
      if (memo != null) return memo;
      if (path.has(project.id)) return 0;
      const nextPath = new Set(path);
      nextPath.add(project.id);
      const value =
        this._remainingEstimate(directTasks.get(project.id) ?? [], taskById) +
        (children.get(project.id) ?? []).reduce(
          (sum, child) => sum + nodeRemaining(child, nextPath),
          0,
        );
      remainingMemo.set(project.id, value);
      return value;
    };

    const roots = (children.get(null) ?? []).filter(
      (project) => project.lifeType === 'goal',
    );
    const output: GoalNode[] = [];
    const mode = this.viewMode();
    const collapsed = this.collapsed();

    const visit = (project: Project, depth: number, path = new Set<string>()): void => {
      if (path.has(project.id)) return;
      const nextPath = new Set(path);
      nextPath.add(project.id);
      const direct = directLiveTasks.get(project.id) ?? [];
      output.push({
        project,
        depth,
        progress: nodeProgress(project),
        directTasks: direct,
        childCount: (children.get(project.id) ?? []).length,
        remainingMs: nodeRemaining(project),
      });
      if (mode === 'goals' || mode === 'compact' || collapsed.has(project.id)) return;
      for (const child of children.get(project.id) ?? [])
        visit(child, depth + 1, nextPath);
    };

    roots.forEach((root) => visit(root, 0));
    return output;
  });

  isCollapsed(id: string): boolean {
    return this.collapsed().has(id);
  }

  toggleCollapsed(id: string): void {
    const next = new Set(this.collapsed());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.collapsed.set(next);
  }

  kindLabel(project: Project, depth: number): string {
    if (project.lifeType === 'goal') return depth > 0 ? 'Subgoal' : 'Goal';
    const parent = this._projects().find(
      (candidate) => candidate.id === project.parentProjectId,
    );
    return parent?.lifeType === 'project' ? 'Subproject' : 'Project';
  }

  priorityLabel(priorityId: string | null | undefined): string | null {
    if (!priorityId) return null;
    return (
      this.lifeConfig().priorityLevels.find((level) => level.id === priorityId)?.label ??
      priorityId
    );
  }

  formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
  }

  addRootGoal(): void {
    void this._promptTitle('Goal name').then(
      (title) => title && this._create(title, 'goal', null),
    );
  }

  addChild(parent: Project, type: LifeProjectType): void {
    const placeholder =
      type === 'goal'
        ? 'Subgoal name'
        : parent.lifeType === 'project'
          ? 'Subproject name'
          : 'Project name';
    void this._promptTitle(placeholder).then(
      (title) => title && this._create(title, type, parent.id),
    );
  }

  addTask(project: Project): void {
    void this._promptTitle('Task title').then((title) => {
      if (!title) return;
      const id = this._taskService.add(title, false, { projectId: project.id }, true);
      this._taskService.setSelectedId(id);
    });
  }

  openTask(id: string): void {
    this._taskService.setSelectedId(id);
  }

  toggleTaskDone(task: Task, event: Event): void {
    event.stopPropagation();
    if (task.isDone) {
      this._taskService.setUnDone(task.id);
    } else {
      this._taskService.setDone(task.id);
    }
  }

  complete(project: Project): void {
    this._store.dispatch(completeProject({ id: project.id, doneOn: Date.now() }));
  }

  reopen(project: Project): void {
    this._store.dispatch(reopenProject({ id: project.id }));
  }

  rename(project: Project): void {
    void this._promptTitle('Name', project.title).then((title) => {
      if (!title || title === project.title) return;
      this._store.dispatch(
        updateProject({ project: { id: project.id, changes: { title } } }),
      );
    });
  }

  numberPickerValue(value: number | null | undefined): string {
    return value == null ? '' : String(value);
  }

  setGoalDateFromPicker(
    id: string,
    key: 'goalTargetDay' | 'goalDeadlineDay',
    value: Date | null,
  ): void {
    this.setGoalDate(id, key, value ? getDbDateStr(value) : '');
  }

  setProjectPickerDefault(
    id: string,
    key: 'lifeDefaultPriorityId',
    raw: string | string[],
  ): void {
    const value = Array.isArray(raw) ? raw[0] || '' : raw;
    this.setProjectDefault(id, key, value || null);
  }

  setProjectNumberPickerDefault(
    id: string,
    key: 'lifeDefaultFocus' | 'lifeDefaultEnergy',
    raw: string | string[],
  ): void {
    const value = Array.isArray(raw) ? raw[0] || '' : raw;
    this.setProjectNumberDefault(id, key, value);
  }

  setProjectMultiPickerDefault(
    id: string,
    key: 'lifeDefaultLocationIds' | 'lifeDefaultRequirementIds',
    raw: string | string[],
  ): void {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    this._store.dispatch(updateProject({ project: { id, changes: { [key]: values } } }));
  }

  setGoalDate(id: string, key: 'goalTargetDay' | 'goalDeadlineDay', value: string): void {
    this._store.dispatch(
      updateProject({ project: { id, changes: { [key]: value || null } } }),
    );
  }

  setProjectDefault(
    id: string,
    key: 'lifeDefaultPriorityId',
    value: string | null,
  ): void {
    this._store.dispatch(updateProject({ project: { id, changes: { [key]: value } } }));
  }

  setProjectNumberDefault(
    id: string,
    key: 'lifeDefaultFocus' | 'lifeDefaultEnergy',
    raw: string,
  ): void {
    const value = raw ? Math.max(1, Math.min(5, Number(raw))) : null;
    this._store.dispatch(updateProject({ project: { id, changes: { [key]: value } } }));
  }

  setProjectMultiDefault(
    id: string,
    key: 'lifeDefaultLocationIds' | 'lifeDefaultRequirementIds',
    event: Event,
  ): void {
    const select = event.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions).map((option) => option.value);
    this._store.dispatch(updateProject({ project: { id, changes: { [key]: values } } }));
  }

  private _create(
    title: string,
    lifeType: LifeProjectType,
    parentProjectId: string | null,
  ): void {
    const project: Project = {
      ...DEFAULT_PROJECT,
      id: nanoid(),
      title,
      taskIds: [],
      backlogTaskIds: [],
      noteIds: [],
      lifeType,
      parentProjectId,
      goalTargetDay: null,
      goalDeadlineDay: null,
      lifeDefaultPriorityId: null,
      lifeDefaultFocus: null,
      lifeDefaultEnergy: null,
      lifeDefaultLocationIds: [],
      lifeDefaultRequirementIds: [],
      isHiddenFromMenu: lifeType === 'goal',
    };
    this._store.dispatch(addProject({ project }));
  }

  private async _reloadArchive(): Promise<void> {
    const loadGeneration = ++this._archiveLoadGeneration;
    const loader = this._taskService.getArchivedTasks?.bind(this._taskService);
    if (!loader) {
      this._archiveTasks.set([]);
      return;
    }
    try {
      const tasks = await loader();
      if (loadGeneration === this._archiveLoadGeneration) {
        this._archiveTasks.set(tasks);
      }
    } catch {
      if (loadGeneration === this._archiveLoadGeneration) {
        this._archiveTasks.set([]);
      }
    }
  }

  private _remainingEstimate(directTasks: Task[], taskById: Map<string, Task>): number {
    const visited = new Set<string>();
    const sumTask = (task: Task): number => {
      if (visited.has(task.id) || task.isDone) return 0;
      visited.add(task.id);
      const subtasks = (task.subTaskIds ?? [])
        .map((id) => taskById.get(id))
        .filter((sub): sub is Task => !!sub);
      if (subtasks.length) return subtasks.reduce((sum, sub) => sum + sumTask(sub), 0);
      return Math.max((task.timeEstimate || 0) - (task.timeSpent || 0), 0);
    };
    return directTasks.reduce((sum, task) => sum + sumTask(task), 0);
  }

  private async _promptTitle(placeholder: string, value = ''): Promise<string | null> {
    const result = await firstValueFrom(
      this._dialog
        .open(DialogPromptComponent, {
          restoreFocus: true,
          data: { placeholder, txtValue: value },
        })
        .afterClosed(),
    );
    const title = typeof result === 'string' ? result.trim() : '';
    return title || null;
  }
}
