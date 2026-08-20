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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { Project } from '../project/project.model';
import { selectAllProjectsExceptInbox } from '../project/store/project.selectors';
import { Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { getDbDateStr } from '../../util/get-db-date-str';
import { LifeOsConfigService } from './life-os-config.service';

type ReviewStepId =
  | 'overdue'
  | 'waiting'
  | 'blocked'
  | 'review-dates'
  | 'goals'
  | 'next-actions';

interface ReviewStep {
  id: ReviewStepId;
  label: string;
  icon: string;
  description: string;
  count: () => number;
}

interface ReviewOverdueItem {
  id: string;
  title: string;
  date: string;
  kind: 'scheduled' | 'due' | 'deadline';
  taskId: string;
}

@Component({
  selector: 'life-weekly-review',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <section class="guided-review">
      <mat-card class="review-guide">
        <mat-card-content>
          <div class="review-title-row">
            <div>
              <h2>Weekly Review</h2>
              <p class="hint">
                Configured review day: {{ reviewDayLabel() }}. Work through every step,
                then complete the review.
              </p>
            </div>
            <div class="last-review">
              <span>Last completed</span>
              <strong>{{ lastReviewLabel() }}</strong>
            </div>
          </div>

          <mat-progress-bar
            mode="determinate"
            [value]="reviewProgress()"
          ></mat-progress-bar>

          <nav
            class="review-steps"
            aria-label="Weekly review steps"
          >
            @for (step of reviewSteps; track step.id; let i = $index) {
              <button
                mat-button
                [class.active]="reviewStepIndex() === i"
                (click)="reviewStepIndex.set(i)"
              >
                <mat-icon>{{ step.icon }}</mat-icon>
                <span>{{ step.label }}</span>
                @if (step.count()) {
                  <span class="count">{{ step.count() }}</span>
                }
              </button>
            }
          </nav>

          @if (activeReviewStep(); as step) {
            <section class="review-step-panel">
              <header class="review-step-head">
                <div>
                  <small>
                    Step {{ reviewStepIndex() + 1 }} / {{ reviewSteps.length }}
                  </small>
                  <h3>{{ step.label }}</h3>
                  <p>{{ step.description }}</p>
                </div>
                <span class="step-count">{{ step.count() }}</span>
              </header>

              @switch (step.id) {
                @case ('overdue') {
                  @for (item of overdueItems(); track item.id) {
                    <button
                      class="review-row"
                      (click)="openTask(item.taskId)"
                    >
                      <mat-icon>{{ iconForOverdue(item.kind) }}</mat-icon>
                      <span class="date">{{ item.date }}</span>
                      <span class="grow">{{ item.title }}</span>
                      <span class="chip">{{ labelForOverdue(item.kind) }}</span>
                    </button>
                  }
                  @if (!overdueItems().length) {
                    <p class="empty">Nothing overdue. This step is clear.</p>
                  }
                }
                @case ('waiting') {
                  @for (task of waitingTasks(); track task.id) {
                    <button
                      class="review-row"
                      (click)="openTask(task.id)"
                    >
                      <mat-icon>hourglass_top</mat-icon>
                      <span class="grow two-lines">
                        <strong>{{ task.title }}</strong>
                        <small>{{ task.lifeWaitingFor }}</small>
                      </span>
                      @if (task.lifeFollowUpDay) {
                        <span class="chip">Follow up {{ task.lifeFollowUpDay }}</span>
                      }
                    </button>
                  }
                  @if (!waitingTasks().length) {
                    <p class="empty">No waiting-for items to chase.</p>
                  }
                }
                @case ('blocked') {
                  @for (task of blockedTasks(); track task.id) {
                    <button
                      class="review-row"
                      (click)="openTask(task.id)"
                    >
                      <mat-icon>block</mat-icon>
                      <span class="grow two-lines">
                        <strong>{{ task.title }}</strong>
                        <small>{{ blockerLabel(task) }}</small>
                      </span>
                    </button>
                  }
                  @if (!blockedTasks().length) {
                    <p class="empty">No active blockers.</p>
                  }
                }
                @case ('review-dates') {
                  @for (task of reviewTasks(); track task.id) {
                    <button
                      class="review-row"
                      (click)="openTask(task.id)"
                    >
                      <mat-icon>rate_review</mat-icon>
                      <span class="grow">{{ task.title }}</span>
                      <span class="chip">{{ task.lifeReviewDay }}</span>
                    </button>
                  }
                  @if (!reviewTasks().length) {
                    <p class="empty">No task review dates are due.</p>
                  }
                }
                @case ('goals') {
                  @for (goal of activeGoals(); track goal.id) {
                    <a
                      class="review-row"
                      routerLink="/goals"
                    >
                      <mat-icon>flag</mat-icon>
                      <span class="grow two-lines">
                        <strong>{{ goal.title }}</strong>
                        <small>
                          @if (goal.goalTargetDay) {
                            Due {{ goal.goalTargetDay }}
                          }
                          @if (goal.goalDeadlineDay) {
                            · Deadline {{ goal.goalDeadlineDay }}
                          }
                        </small>
                      </span>
                    </a>
                  }
                  @if (!activeGoals().length) {
                    <p class="empty">No active root goals.</p>
                  }
                }
                @case ('next-actions') {
                  @for (task of allNextActions(); track task.id) {
                    <button
                      class="review-row"
                      (click)="openTask(task.id)"
                    >
                      <mat-icon>play_arrow</mat-icon>
                      <span class="grow">{{ task.title }}</span>
                    </button>
                  }
                  @if (!allNextActions().length) {
                    <p class="empty">
                      No Next Actions are marked. Pick at least one actionable task before
                      finishing the review.
                    </p>
                  }
                }
              }
            </section>
          }

          <footer class="review-actions">
            <button
              mat-button
              (click)="previousReviewStep()"
              [disabled]="reviewStepIndex() === 0"
            >
              <mat-icon>arrow_back</mat-icon>
              Previous
            </button>
            <span class="grow"></span>
            @if (isLastReviewStep()) {
              <button
                mat-flat-button
                color="primary"
                (click)="completeWeeklyReview()"
              >
                <mat-icon>done_all</mat-icon>
                Complete review
              </button>
            } @else {
              <button
                mat-flat-button
                color="primary"
                (click)="nextReviewStep()"
              >
                Next
                <mat-icon>arrow_forward</mat-icon>
              </button>
            }
          </footer>
        </mat-card-content>
      </mat-card>

      <section class="review-summary">
        <mat-card>
          <mat-card-content>
            <div class="card-head">
              <h2>Open review items</h2>
              <span>{{ reviewOpenCount() }}</span>
            </div>
            <p class="hint">
              Overdue, waiting, blocked and explicitly scheduled review items still need
              attention.
            </p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="card-head">
              <h2>Next Actions</h2>
              <span>{{ allNextActions().length }}</span>
            </div>
            <p class="hint">
              Keep concrete, context-ready work available for the coming week.
            </p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="card-head">
              <h2>Active Goals</h2>
              <span>{{ activeGoals().length }}</span>
            </div>
            <p class="hint">
              Every active goal should still deserve attention and action.
            </p>
          </mat-card-content>
        </mat-card>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .guided-review {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      h2,
      h3,
      p {
        margin-top: 0;
      }
      .review-title-row,
      .review-step-head,
      .review-actions,
      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .hint,
      .empty {
        opacity: 0.62;
        font-size: 0.84rem;
      }
      .last-review {
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        align-items: flex-end;
        font-size: 0.75rem;
      }
      .last-review span {
        opacity: 0.55;
      }
      .review-steps {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin: 12px 0;
        padding-bottom: 4px;
      }
      .review-steps button {
        white-space: nowrap;
      }
      .review-steps button.active {
        background: rgba(127, 127, 127, 0.17);
      }
      .count,
      .chip {
        padding: 2px 6px;
        border-radius: 99px;
        background: rgba(127, 127, 127, 0.16);
        font-size: 0.68rem;
        white-space: nowrap;
      }
      .review-step-panel {
        min-height: 220px;
        padding: 12px;
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
      }
      .review-step-head {
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .review-step-head small {
        opacity: 0.55;
      }
      .review-step-head h3 {
        margin: 3px 0;
      }
      .review-step-head p {
        margin-bottom: 0;
        opacity: 0.68;
      }
      .step-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 38px;
        min-height: 38px;
        border-radius: 99px;
        background: rgba(127, 127, 127, 0.14);
        font-weight: 750;
      }
      .review-row {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 8px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        padding: 8px 6px;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
      }
      .review-row:hover {
        background: rgba(127, 127, 127, 0.1);
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .two-lines {
        display: flex;
        flex-direction: column;
      }
      .two-lines small {
        margin-top: 2px;
        opacity: 0.62;
      }
      .date {
        min-width: 86px;
        opacity: 0.7;
        font-size: 0.74rem;
      }
      .review-actions {
        margin-top: 12px;
      }
      .review-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .card-head h2 {
        margin-bottom: 0;
        font-size: 1rem;
      }
      .card-head span {
        opacity: 0.55;
      }
      .review-summary p {
        margin: 8px 0 0;
      }
      @media (max-width: 700px) {
        .review-title-row,
        .review-step-head {
          flex-direction: column;
          align-items: stretch;
        }
        .last-review {
          align-items: flex-start;
        }
        .review-summary {
          grid-template-columns: 1fr;
        }
        .review-row {
          min-height: 44px;
        }
        .date {
          min-width: 76px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeWeeklyReviewComponent {
  private readonly _tasksService = inject(TaskService);
  private readonly _life = inject(LifeOsConfigService);
  private readonly _store = inject(Store);
  private readonly _dateTimeFormat = inject(DateTimeFormatService);
  private readonly _tasks = toSignal(this._tasksService.allTasks$, {
    initialValue: [] as Task[],
  });
  private readonly _projects = toSignal(
    this._store.select(selectAllProjectsExceptInbox),
    { initialValue: [] as Project[] },
  );

  readonly reviewStepIndex = signal(0);

  readonly overdueItems = computed<ReviewOverdueItem[]>(() => {
    const today = getDbDateStr();
    const result: ReviewOverdueItem[] = [];
    for (const task of this._tasks()) {
      if (task.isDone || task.parentId) continue;
      const scheduled =
        task.dueDay ||
        (task.dueWithTime ? this._dayForTimestamp(task.dueWithTime) : null);
      if (scheduled && scheduled < today) {
        result.push({
          id: `scheduled-${task.id}`,
          title: task.title,
          date: scheduled,
          kind: 'scheduled',
          taskId: task.id,
        });
      }
      if (task.lifeDueDay && task.lifeDueDay < today) {
        result.push({
          id: `due-${task.id}`,
          title: task.title,
          date: task.lifeDueDay,
          kind: 'due',
          taskId: task.id,
        });
      }
      const deadline =
        task.deadlineDay ||
        (task.deadlineWithTime ? this._dayForTimestamp(task.deadlineWithTime) : null);
      if (deadline && deadline < today) {
        result.push({
          id: `deadline-${task.id}`,
          title: task.title,
          date: deadline,
          kind: 'deadline',
          taskId: task.id,
        });
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly waitingTasks = computed(() =>
    this._tasks()
      .filter((task) => !task.isDone && !task.parentId && !!task.lifeWaitingFor)
      .sort((a, b) =>
        (a.lifeFollowUpDay || a.lifeDueDay || '9999').localeCompare(
          b.lifeFollowUpDay || b.lifeDueDay || '9999',
        ),
      ),
  );

  readonly blockedTasks = computed(() => {
    const byId = new Map(this._tasks().map((task) => [task.id, task]));
    return this._tasks().filter(
      (task) =>
        !task.isDone &&
        !task.parentId &&
        (task.lifeBlockedByTaskIds || []).some((id) => {
          const blocker = byId.get(id);
          return !!blocker && !blocker.isDone;
        }),
    );
  });

  readonly reviewTasks = computed(() => {
    const today = getDbDateStr();
    return this._tasks()
      .filter(
        (task) =>
          !task.isDone &&
          !task.parentId &&
          !!task.lifeReviewDay &&
          task.lifeReviewDay <= today,
      )
      .sort((a, b) => (a.lifeReviewDay || '').localeCompare(b.lifeReviewDay || ''));
  });

  readonly allNextActions = computed(() =>
    this._tasks().filter(
      (task) => !task.isDone && !task.parentId && task.lifeIsNextAction,
    ),
  );

  readonly activeGoals = computed(() =>
    this._projects().filter(
      (project) =>
        project.lifeType === 'goal' &&
        !project.parentProjectId &&
        !project.isDone &&
        !project.isArchived,
    ),
  );

  readonly reviewDayLabel = computed(
    () =>
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        this._life.config().weeklyReviewDay
      ] || 'Sunday',
  );

  readonly lastReviewLabel = computed(() => {
    const value = this._life.config().lastWeeklyReviewAt;
    if (!value) return 'Never';
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  });

  readonly reviewOpenCount = computed(
    () =>
      this.overdueItems().length +
      this.waitingTasks().length +
      this.blockedTasks().length +
      this.reviewTasks().length,
  );

  readonly reviewSteps: ReviewStep[] = [
    {
      id: 'overdue',
      label: 'Overdue',
      icon: 'warning',
      description:
        'Reschedule, finish, delegate or consciously drop anything that slipped behind.',
      count: () => this.overdueItems().length,
    },
    {
      id: 'waiting',
      label: 'Waiting',
      icon: 'hourglass_top',
      description:
        'Check every delegated or pending item and decide whether a follow-up is needed.',
      count: () => this.waitingTasks().length,
    },
    {
      id: 'blocked',
      label: 'Blocked',
      icon: 'block',
      description:
        'Remove stale dependencies and identify the next action that can unblock progress.',
      count: () => this.blockedTasks().length,
    },
    {
      id: 'review-dates',
      label: 'Review dates',
      icon: 'rate_review',
      description: 'Process tasks that explicitly asked to come back to your attention.',
      count: () => this.reviewTasks().length,
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: 'flag',
      description:
        'Check that active goals are still relevant and have real projects or actions behind them.',
      count: () => this.activeGoals().length,
    },
    {
      id: 'next-actions',
      label: 'Next Actions',
      icon: 'play_arrow',
      description:
        'Finish by making sure there is concrete work ready for the coming week.',
      count: () => this.allNextActions().length,
    },
  ];

  readonly activeReviewStep = computed(
    () => this.reviewSteps[this.reviewStepIndex()] ?? this.reviewSteps[0],
  );

  readonly reviewProgress = computed(
    () => ((this.reviewStepIndex() + 1) / this.reviewSteps.length) * 100,
  );

  readonly isLastReviewStep = computed(
    () => this.reviewStepIndex() >= this.reviewSteps.length - 1,
  );

  openTask(id: string): void {
    this._tasksService.setSelectedId(id);
  }

  previousReviewStep(): void {
    this.reviewStepIndex.update((index) => Math.max(0, index - 1));
  }

  nextReviewStep(): void {
    this.reviewStepIndex.update((index) =>
      Math.min(this.reviewSteps.length - 1, index + 1),
    );
  }

  completeWeeklyReview(): void {
    this._life.update({ lastWeeklyReviewAt: Date.now() });
    this.reviewStepIndex.set(0);
  }

  blockerLabel(task: Task): string {
    const byId = new Map(this._tasks().map((item) => [item.id, item]));
    const active = (task.lifeBlockedByTaskIds || [])
      .map((id) => byId.get(id))
      .filter((item): item is Task => !!item && !item.isDone)
      .map((item) => item.title);
    return active.length ? `Blocked by: ${active.join(', ')}` : 'Blocker completed';
  }

  iconForOverdue(kind: ReviewOverdueItem['kind']): string {
    return kind === 'scheduled' ? 'event' : kind === 'due' ? 'track_changes' : 'flag';
  }

  labelForOverdue(kind: ReviewOverdueItem['kind']): string {
    return kind === 'scheduled' ? 'Scheduled' : kind === 'due' ? 'Due' : 'Deadline';
  }

  private _dayForTimestamp(value: number): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
