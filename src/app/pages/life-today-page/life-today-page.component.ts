import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { HabitTrackerComponent } from '../../features/simple-counter/habit-tracker/habit-tracker.component';
import { SimpleCounterService } from '../../features/simple-counter/simple-counter.service';
import { LifeOsConfigService } from '../../features/lifeos/life-os-config.service';
import { LifeContextEngineService } from '../../features/lifeos/life-context-engine.service';
import { LifeSmartView } from '../../features/lifeos/life-os.model';
import { Task } from '../../features/tasks/task.model';
import { TaskService } from '../../features/tasks/task.service';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { INBOX_PROJECT } from '../../features/project/project.const';
import { getDbDateStr } from '../../util/get-db-date-str';

export type LifeTodayTab =
  | 'overview'
  | 'now'
  | 'tasks'
  | 'habits'
  | 'priority'
  | 'focus'
  | 'energy'
  | 'context';

@Component({
  selector: 'life-today-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    HabitTrackerComponent,
  ],
  template: `
    <main class="today-page">
      <header class="page-head">
        <div>
          <h1>Today</h1>
          <p>Choose what is realistic now by priority, focus, energy and context.</p>
        </div>
        <a
          mat-button
          routerLink="/life-settings"
          ><mat-icon>tune</mat-icon>Settings</a
        >
      </header>

      <section class="quick-capture">
        <div class="quick-title">
          <mat-icon>add_circle</mat-icon><strong>Quick Capture</strong>
        </div>
        <div class="quick-grid">
          <input
            #quickTitle
            class="title-input"
            placeholder="What needs to be done?"
            (keydown.enter)="
              quickAdd(
                quickTitle.value,
                quickPriority.value,
                quickFocus.value,
                quickEnergy.value,
                quickMinutes.value,
                quickLocation.value,
                quickRequirement.value
              );
              quickTitle.value = ''
            "
          />
          <select #quickPriority>
            <option value="">Priority</option>
            @for (level of config().priorityLevels; track level.id) {
              <option
                [value]="level.id"
                [selected]="level.id === config().defaultPriorityId"
              >
                {{ level.label }}
              </option>
            }
          </select>
          <select #quickFocus>
            <option value="">Focus</option>
            @for (n of scale; track n) {
              <option [value]="n">F{{ n }}</option>
            }
          </select>
          <select #quickEnergy>
            <option value="">Energy</option>
            @for (n of scale; track n) {
              <option [value]="n">E{{ n }}</option>
            }
          </select>
          <input
            #quickMinutes
            type="number"
            min="1"
            placeholder="Minutes"
          />
          <select #quickLocation>
            <option value="">Location</option>
            @for (option of config().locations; track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
          <select #quickRequirement>
            <option value="">Requires</option>
            @for (option of config().requirements; track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
          <button
            mat-flat-button
            color="primary"
            (click)="
              quickAdd(
                quickTitle.value,
                quickPriority.value,
                quickFocus.value,
                quickEnergy.value,
                quickMinutes.value,
                quickLocation.value,
                quickRequirement.value
              );
              quickTitle.value = ''
            "
          >
            <mat-icon>add</mat-icon>Add
          </button>
        </div>
      </section>

      <nav
        class="tabs"
        aria-label="Today views"
      >
        @for (item of tabs; track item.id) {
          <button
            mat-button
            [class.active]="tab() === item.id"
            (click)="tab.set(item.id)"
          >
            <mat-icon>{{ item.icon }}</mat-icon
            >{{ item.label }}
          </button>
        }
      </nav>

      @if (tab() === 'overview') {
        <section class="dashboard-grid">
          <mat-card class="wide best-now-card">
            <mat-card-content>
              <div class="card-title">
                <div class="best-now-title">
                  <mat-icon>auto_awesome</mat-icon><strong>Best Now</strong>
                </div>
                <button
                  mat-button
                  (click)="tab.set('now')"
                >
                  Tune context
                </button>
              </div>
              @for (recommendation of bestNowPreview(); track recommendation.task.id) {
                <button
                  class="recommendation-row"
                  (click)="openTask(recommendation.task.id)"
                >
                  <span class="rank-score">{{ recommendation.score }}</span>
                  <span class="task-title">{{ recommendation.task.title }}</span>
                  <span class="reason-list">
                    @for (reason of recommendation.reasons; track reason) {
                      <span class="chip">{{ reason }}</span>
                    }
                  </span>
                </button>
              }
              @if (!bestNowPreview().length) {
                <p class="empty">
                  No actionable task matches the current context. Adjust your available
                  time, focus, energy, location or tools.
                </p>
              }
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-content>
              <div class="card-title">
                <strong>Next Actions</strong><span>{{ nextActions().length }}</span>
              </div>
              @for (task of nextActions(); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
              @if (!nextActions().length) {
                <p class="empty">No next actions marked for today.</p>
              }
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-content>
              <div class="card-title">
                <strong>Due Soon</strong><span>{{ dueSoon().length }}</span>
              </div>
              @for (task of dueSoon(); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
              @if (!dueSoon().length) {
                <p class="empty">Nothing due in the next three days.</p>
              }
            </mat-card-content>
          </mat-card>

          <mat-card class="wide">
            <mat-card-content>
              <div class="card-title">
                <strong>Today's Tasks</strong><span>{{ todayTasks().length }}</span>
              </div>
              @for (task of todayTasks(); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
              @if (!todayTasks().length) {
                <p class="empty">No tasks scheduled for today.</p>
              }
            </mat-card-content>
          </mat-card>

          <mat-card class="wide">
            <mat-card-content>
              <div class="card-title"><strong>Habits</strong></div>
              <habit-tracker
                [simpleCounters]="(simpleCounters$ | async) || []"
                [disabledSimpleCounters]="[]"
              ></habit-tracker>
            </mat-card-content>
          </mat-card>
        </section>
      }

      @if (tab() === 'now') {
        <section class="now-view">
          <div class="now-context">
            <div class="context-heading">
              <div>
                <h2>What can I do now?</h2>
                <p class="empty">
                  Recommendations automatically exclude waiting and blocked work.
                </p>
              </div>
              <span>{{ bestNow().length }} recommendations</span>
            </div>
            <div class="now-controls">
              <label>
                <span>Available time</span>
                <select
                  [value]="availableMinutes() || ''"
                  (change)="setAvailableMinutes($any($event.target).value)"
                >
                  <option value="">Any</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">90 minutes</option>
                  <option value="120">2 hours</option>
                </select>
              </label>
              <label>
                <span>Focus available</span>
                <select
                  [value]="currentFocus() || ''"
                  (change)="setCurrentFocus($any($event.target).value)"
                >
                  <option value="">Any</option>
                  @for (n of scale; track n) {
                    <option [value]="n">{{ n }} / 5</option>
                  }
                </select>
              </label>
              <label>
                <span>Energy available</span>
                <select
                  [value]="currentEnergy() || ''"
                  (change)="setCurrentEnergy($any($event.target).value)"
                >
                  <option value="">Any</option>
                  @for (n of scale; track n) {
                    <option [value]="n">{{ n }} / 5</option>
                  }
                </select>
              </label>
              <label>
                <span>Location</span>
                <select
                  [value]="currentLocationId()"
                  (change)="currentLocationId.set($any($event.target).value)"
                >
                  @for (option of config().locations; track option.id) {
                    <option [value]="option.id">{{ option.label }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Available tool / device</span>
                <select
                  [value]="currentRequirementId()"
                  (change)="currentRequirementId.set($any($event.target).value)"
                >
                  @for (option of config().requirements; track option.id) {
                    <option [value]="option.id">{{ option.label }}</option>
                  }
                </select>
              </label>
            </div>
          </div>

          <div class="recommendations-list">
            @for (
              recommendation of bestNow();
              track recommendation.task.id;
              let i = $index
            ) {
              <button
                class="recommendation-card"
                (click)="openTask(recommendation.task.id)"
              >
                <span class="recommendation-rank">{{ i + 1 }}</span>
                <span class="recommendation-main">
                  <strong>{{ recommendation.task.title }}</strong>
                  <span class="reason-list">
                    @for (reason of recommendation.reasons; track reason) {
                      <span class="chip">{{ reason }}</span>
                    }
                  </span>
                </span>
                <span class="score-box">
                  <small>score</small><strong>{{ recommendation.score }}</strong>
                </span>
              </button>
            }
            @if (!bestNow().length) {
              <div class="no-recommendations">
                <mat-icon>filter_alt_off</mat-icon>
                <strong>No actionable match right now</strong>
                <p>
                  Change the context above or mark a task as a Next Action. Waiting and
                  actively blocked tasks are intentionally excluded.
                </p>
              </div>
            }
          </div>
        </section>
      }

      @if (tab() === 'tasks') {
        <section class="single-list">
          <h2>Scheduled Today</h2>
          @for (task of todayTasks(); track task.id) {
            <ng-container
              *ngTemplateOutlet="taskRow; context: { $implicit: task }"
            ></ng-container>
          }
        </section>
      }

      @if (tab() === 'habits') {
        <section class="habit-view">
          <habit-tracker
            [simpleCounters]="(simpleCounters$ | async) || []"
            [disabledSimpleCounters]="[]"
          ></habit-tracker>
        </section>
      }

      @if (tab() === 'priority') {
        <section class="group-view">
          @for (level of config().priorityLevels; track level.id) {
            <div class="group">
              <h2>{{ level.label }}</h2>
              @for (task of tasksForPriority(level.id); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
            </div>
          }
        </section>
      }

      @if (tab() === 'focus') {
        <section class="group-view">
          @for (level of scaleDesc; track level) {
            <div class="group">
              <h2>Focus {{ level }}</h2>
              @for (task of tasksForFocus(level); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
            </div>
          }
        </section>
      }

      @if (tab() === 'energy') {
        <section class="group-view">
          @for (level of scale; track level) {
            <div class="group">
              <h2>Energy {{ level }}</h2>
              @for (task of tasksForEnergy(level); track task.id) {
                <ng-container
                  *ngTemplateOutlet="taskRow; context: { $implicit: task }"
                ></ng-container>
              }
            </div>
          }
        </section>
      }

      @if (tab() === 'context') {
        <section class="context-view">
          <div class="smart-buttons">
            @for (view of config().smartViews; track view.id) {
              <button
                mat-button
                [class.active]="selectedSmartViewId() === view.id"
                (click)="selectedSmartViewId.set(view.id)"
              >
                <mat-icon>{{ view.icon || 'filter_alt' }}</mat-icon
                >{{ view.label }}
              </button>
            }
          </div>
          @if (selectedSmartView(); as view) {
            <div class="context-heading">
              <h2>{{ view.label }}</h2>
              <span>{{ contextTasks().length }} available</span>
            </div>
            @for (task of contextTasks(); track task.id) {
              <ng-container
                *ngTemplateOutlet="taskRow; context: { $implicit: task }"
              ></ng-container>
            }
            @if (!contextTasks().length) {
              <p class="empty">No unfinished tasks match this context.</p>
            }
          }
        </section>
      }

      <ng-template
        #taskRow
        let-task
      >
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
            [attr.aria-label]="task.isDone ? 'Mark task not done' : 'Mark task done'"
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
            <span class="chip priority">{{ priority }}</span>
          }
          @if (task.timeEstimate) {
            <span class="chip">{{ estimateLabel(task.timeEstimate) }}</span>
          }
          @if (task.lifeFocus) {
            <span class="chip">F{{ task.lifeFocus }}</span>
          }
          @if (task.lifeEnergy) {
            <span class="chip">E{{ task.lifeEnergy }}</span>
          }
          @if (task.lifeDueDay) {
            <span class="chip due">Due {{ task.lifeDueDay }}</span>
          }
          @if (task.deadlineDay || task.deadlineWithTime) {
            <span class="chip deadline">Deadline</span>
          }
        </div>
      </ng-template>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .today-page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 16px;
      }
      .page-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .page-head h1 {
        margin: 0 0 5px;
      }
      .page-head p {
        margin: 0;
        opacity: 0.68;
      }
      .quick-capture,
      .now-context {
        margin: 14px 0;
        padding: 12px;
        border: 1px solid rgba(127, 127, 127, 0.25);
        border-radius: 10px;
      }
      .quick-title,
      .best-now-title {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 8px;
      }
      .best-now-title {
        margin-bottom: 0;
      }
      .quick-grid {
        display: grid;
        grid-template-columns: minmax(220px, 2fr) repeat(6, minmax(88px, 1fr)) auto;
        gap: 7px;
      }
      .now-controls {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .now-controls label {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 5px;
      }
      .now-controls label > span {
        font-size: 0.72rem;
        opacity: 0.68;
      }
      input,
      select {
        min-height: 42px;
        min-width: 0;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        padding: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        box-sizing: border-box;
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
      .tabs,
      .smart-buttons {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        padding-bottom: 4px;
        margin-bottom: 12px;
      }
      .tabs button,
      .smart-buttons button {
        white-space: nowrap;
      }
      button.active {
        background: rgba(127, 127, 127, 0.17);
      }
      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .card-title,
      .context-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 7px;
      }
      .card-title > span,
      .context-heading > span {
        opacity: 0.55;
        font-size: 0.8rem;
      }
      .task-row,
      .recommendation-row,
      .recommendation-card {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 7px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        padding: 8px 5px;
        text-align: left;
        cursor: pointer;
      }
      .task-row:hover,
      .recommendation-row:hover,
      .recommendation-card:hover {
        background: rgba(127, 127, 127, 0.1);
      }
      .task-row mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
      .task-toggle {
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
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
        background: rgba(127, 127, 127, 0.14);
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
        opacity: 0.55;
      }
      .chip {
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(127, 127, 127, 0.15);
        font-size: 0.66rem;
        white-space: nowrap;
      }
      .reason-list {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 4px;
      }
      .rank-score,
      .recommendation-rank {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-width: 30px;
        min-height: 30px;
        border-radius: 999px;
        background: rgba(127, 127, 127, 0.14);
        font-size: 0.72rem;
        font-weight: 750;
      }
      .recommendations-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .recommendation-card {
        min-height: 64px;
        padding: 10px;
        border: 1px solid rgba(127, 127, 127, 0.18);
      }
      .recommendation-main {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 6px;
      }
      .recommendation-main .reason-list {
        justify-content: flex-start;
      }
      .score-box {
        display: flex;
        flex: 0 0 auto;
        min-width: 48px;
        flex-direction: column;
        align-items: center;
      }
      .score-box small {
        opacity: 0.5;
      }
      .score-box strong {
        font-size: 1.05rem;
      }
      .no-recommendations {
        display: flex;
        min-height: 180px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        opacity: 0.7;
      }
      .no-recommendations mat-icon {
        width: 34px;
        height: 34px;
        font-size: 34px;
      }
      .no-recommendations p {
        max-width: 520px;
        margin: 0;
      }
      .priority {
        font-weight: 750;
      }
      .due {
        font-weight: 600;
      }
      .deadline {
        font-weight: 800;
      }
      .empty {
        opacity: 0.55;
        font-size: 0.86rem;
      }
      .single-list,
      .habit-view,
      .context-view {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
        padding: 12px;
      }
      .single-list h2,
      .group h2,
      .context-heading h2 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      .group-view {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 10px;
      }
      .group {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
        padding: 10px;
      }
      @media (max-width: 900px) {
        .quick-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .title-input {
          grid-column: 1/-1;
        }
        .now-controls {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 600px) {
        .today-page {
          padding: 12px 9px 92px;
        }
        .page-head {
          flex-direction: column;
        }
        .quick-grid,
        .now-controls {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .title-input {
          grid-column: 1/-1;
        }
        .quick-grid button {
          min-height: 48px;
        }
        input,
        select {
          min-height: 48px;
        }
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
        .wide {
          grid-column: auto;
        }
        .chip:nth-of-type(n + 4) {
          display: none;
        }
        .task-row,
        .recommendation-card {
          min-height: 44px;
        }
        .recommendation-row .reason-list {
          display: none;
        }
        .recommendation-card .reason-list .chip:nth-child(n + 3) {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeTodayPageComponent {
  private readonly _taskService = inject(TaskService);
  private readonly _life = inject(LifeOsConfigService);
  private readonly _contextEngine = inject(LifeContextEngineService);
  private readonly _counterService = inject(SimpleCounterService);
  private readonly _globalConfig = inject(GlobalConfigService);
  private readonly _router = inject(Router);

  readonly config = this._life.config;
  readonly isSmartViewsRoute = this._router.url.startsWith('/smart-views');
  readonly tab = signal<LifeTodayTab>(this.isSmartViewsRoute ? 'context' : 'overview');
  readonly scale = [1, 2, 3, 4, 5] as const;
  readonly scaleDesc = [5, 4, 3, 2, 1] as const;
  readonly tabs: { id: LifeTodayTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'now', label: 'Now', icon: 'auto_awesome' },
    { id: 'tasks', label: 'Tasks', icon: 'checklist' },
    { id: 'habits', label: 'Habits', icon: 'heart_check' },
    { id: 'priority', label: 'Priority', icon: 'priority_high' },
    { id: 'focus', label: 'Focus', icon: 'psychology' },
    { id: 'energy', label: 'Energy', icon: 'battery_charging_full' },
    { id: 'context', label: 'Context', icon: 'filter_alt' },
  ];
  readonly simpleCounters$ = this._counterService.enabledSimpleCounters$;
  private readonly _tasks = toSignal(this._taskService.allTasks$, {
    initialValue: [] as Task[],
  });
  readonly selectedSmartViewId = signal<string>('on-the-go');
  readonly availableMinutes = signal<number | null>(30);
  readonly currentFocus = signal<number | null>(3);
  readonly currentEnergy = signal<number | null>(3);
  readonly currentLocationId = signal<string>('anywhere');
  readonly currentRequirementId = signal<string>('any');

  readonly todayTasks = computed(() => {
    const today = getDbDateStr();
    return this._tasks()
      .filter((task) => !task.parentId && this._isScheduledOn(task, today))
      .sort(
        (a, b) =>
          Number(a.isDone) - Number(b.isDone) ||
          this._priorityIndex(a) - this._priorityIndex(b),
      );
  });

  readonly nextActions = computed(() =>
    this.todayTasks().filter((task) => task.lifeIsNextAction && !task.isDone),
  );

  readonly dueSoon = computed(() => {
    const today = getDbDateStr();
    const end = this._addDays(today, 3);
    return this._tasks()
      .filter(
        (task) =>
          !task.isDone &&
          !!task.lifeDueDay &&
          task.lifeDueDay >= today &&
          task.lifeDueDay <= end,
      )
      .sort((a, b) => (a.lifeDueDay || '').localeCompare(b.lifeDueDay || ''));
  });

  readonly bestNow = computed(() =>
    this._contextEngine.rankTasks(
      this._tasks(),
      this.config(),
      {
        day: getDbDateStr(),
        availableMinutes: this.availableMinutes(),
        focus: this.currentFocus(),
        energy: this.currentEnergy(),
        locationIds: this.currentLocationId() ? [this.currentLocationId()] : [],
        requirementIds: this.currentRequirementId() ? [this.currentRequirementId()] : [],
      },
      8,
    ),
  );

  readonly bestNowPreview = computed(() => this.bestNow().slice(0, 3));

  readonly selectedSmartView = computed<LifeSmartView | null>(
    () =>
      this.config().smartViews.find((view) => view.id === this.selectedSmartViewId()) ??
      this.config().smartViews[0] ??
      null,
  );

  readonly contextTasks = computed(() => {
    const view = this.selectedSmartView();
    if (!view) return [];
    return this._tasks()
      .filter((task) => !task.parentId && this._life.matchesView(task, view))
      .sort(
        (a, b) =>
          this._priorityIndex(a) - this._priorityIndex(b) ||
          (a.lifeDueDay || '9999').localeCompare(b.lifeDueDay || '9999'),
      );
  });

  quickAdd(
    titleRaw: string,
    priority: string,
    focusRaw: string,
    energyRaw: string,
    minutesRaw: string,
    location: string,
    requirement: string,
  ): void {
    const title = titleRaw.trim();
    if (!title) return;
    const minutes = Number(minutesRaw || 0);
    const configuredProjectId = this._globalConfig.tasks()?.defaultProjectId;
    const projectId =
      typeof configuredProjectId === 'string' ? configuredProjectId : INBOX_PROJECT.id;
    const id = this._taskService.add(
      title,
      false,
      {
        projectId,
        dueDay: getDbDateStr(),
        lifePriorityId: priority || this.config().defaultPriorityId,
        lifeFocus: focusRaw ? Number(focusRaw) : null,
        lifeEnergy: energyRaw ? Number(energyRaw) : null,
        timeEstimate: minutes > 0 ? minutes * 60000 : 0,
        lifeLocationIds: location ? [location] : [],
        lifeRequirementIds: requirement ? [requirement] : [],
      },
      true,
    );
    this._taskService.setSelectedId(id);
  }

  setAvailableMinutes(raw: string): void {
    this.availableMinutes.set(raw ? Math.max(1, Number(raw)) : null);
  }

  setCurrentFocus(raw: string): void {
    this.currentFocus.set(raw ? Math.max(1, Math.min(5, Number(raw))) : null);
  }

  setCurrentEnergy(raw: string): void {
    this.currentEnergy.set(raw ? Math.max(1, Math.min(5, Number(raw))) : null);
  }

  tasksForPriority(id: string): Task[] {
    return this.todayTasks().filter(
      (task) => (task.lifePriorityId || this.config().defaultPriorityId) === id,
    );
  }

  tasksForFocus(level: number): Task[] {
    return this.todayTasks().filter((task) => task.lifeFocus === level);
  }

  tasksForEnergy(level: number): Task[] {
    return this.todayTasks().filter((task) => task.lifeEnergy === level);
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

  priorityLabel(id: string | null | undefined): string | null {
    if (!id) return null;
    return this.config().priorityLevels.find((level) => level.id === id)?.label ?? id;
  }

  estimateLabel(ms: number): string {
    const min = Math.round(ms / 60000);
    return min >= 60
      ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`
      : `${min}m`;
  }

  private _priorityIndex(task: Task): number {
    const id = task.lifePriorityId || this.config().defaultPriorityId;
    const index = this.config().priorityLevels.findIndex((level) => level.id === id);
    return index < 0 ? 999 : index;
  }

  private _isScheduledOn(task: Task, day: string): boolean {
    if (task.dueDay === day) return true;
    if (!task.dueWithTime) return false;
    const date = new Date(task.dueWithTime);
    const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return local === day;
  }

  private _addDays(day: string, count: number): string {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + count);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
