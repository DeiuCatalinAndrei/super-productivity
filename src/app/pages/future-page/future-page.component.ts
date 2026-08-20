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
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { LifeWeeklyReviewComponent } from '../../features/lifeos/life-weekly-review.component';
import { Project } from '../../features/project/project.model';
import { selectAllProjectsExceptInbox } from '../../features/project/store/project.selectors';
import { Task } from '../../features/tasks/task.model';
import { TaskService } from '../../features/tasks/task.service';
import { getDbDateStr } from '../../util/get-db-date-str';

type FutureTab = 'upcoming' | 'waiting' | 'blocked' | 'review';

interface UpcomingItem {
  id: string;
  kind: 'scheduled' | 'due' | 'deadline' | 'goal-due' | 'goal-deadline';
  date: string;
  title: string;
  taskId?: string;
  projectId?: string;
}

@Component({
  selector: 'future-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    LifeWeeklyReviewComponent,
  ],
  template: `
    <main class="future-page">
      <header class="page-head">
        <div>
          <h1>Future</h1>
          <p>
            Everything approaching: planned work, due dates, deadlines, waiting items and
            review prompts.
          </p>
        </div>
        <a
          mat-button
          routerLink="/life-settings"
          ><mat-icon>tune</mat-icon>Settings</a
        >
      </header>

      <nav class="tabs">
        @for (item of tabs; track item.id) {
          <button
            mat-button
            [class.active]="tab() === item.id"
            (click)="tab.set(item.id)"
          >
            <mat-icon>{{ item.icon }}</mat-icon
            >{{ item.label }}
            @if (item.count()) {
              <span class="count">{{ item.count() }}</span>
            }
          </button>
        }
      </nav>

      @if (tab() === 'upcoming') {
        <section class="timeline">
          <div class="bucket">
            <h2>Overdue</h2>
            @for (item of overdue(); track item.id) {
              <ng-container
                *ngTemplateOutlet="upcomingRow; context: { $implicit: item }"
              ></ng-container>
            }
            @if (!overdue().length) {
              <p class="empty">Nothing overdue.</p>
            }
          </div>

          <div class="bucket">
            <h2>Tomorrow</h2>
            @for (item of tomorrow(); track item.id) {
              <ng-container
                *ngTemplateOutlet="upcomingRow; context: { $implicit: item }"
              ></ng-container>
            }
            @if (!tomorrow().length) {
              <p class="empty">Nothing scheduled or due tomorrow.</p>
            }
          </div>

          <div class="bucket">
            <h2>Next 7 Days</h2>
            @for (item of nextSeven(); track item.id) {
              <ng-container
                *ngTemplateOutlet="upcomingRow; context: { $implicit: item }"
              ></ng-container>
            }
            @if (!nextSeven().length) {
              <p class="empty">No upcoming items in the next seven days.</p>
            }
          </div>

          <div class="bucket">
            <h2>Later</h2>
            @for (item of later(); track item.id) {
              <ng-container
                *ngTemplateOutlet="upcomingRow; context: { $implicit: item }"
              ></ng-container>
            }
            @if (!later().length) {
              <p class="empty">Nothing later yet.</p>
            }
          </div>
        </section>
      }

      @if (tab() === 'waiting') {
        <section class="list-panel">
          <h2>Waiting For</h2>
          @for (task of waitingTasks(); track task.id) {
            <button
              class="task-row"
              (click)="openTask(task.id)"
            >
              <mat-icon>hourglass_top</mat-icon
              ><span class="grow"
                ><strong>{{ task.title }}</strong
                ><small>{{ task.lifeWaitingFor }}</small></span
              >
              @if (task.lifeFollowUpDay) {
                <span class="chip">Follow up {{ task.lifeFollowUpDay }}</span>
              } @else if (task.lifeDueDay) {
                <span class="chip">Due {{ task.lifeDueDay }}</span>
              }
            </button>
          }
          @if (!waitingTasks().length) {
            <p class="empty">No tasks are waiting on someone or something.</p>
          }
        </section>
      }

      @if (tab() === 'blocked') {
        <section class="list-panel">
          <h2>Blocked</h2>
          @for (task of blockedTasks(); track task.id) {
            <button
              class="task-row"
              (click)="openTask(task.id)"
            >
              <mat-icon>block</mat-icon
              ><span class="grow"
                ><strong>{{ task.title }}</strong
                ><small>{{ blockerLabel(task) }}</small></span
              >
            </button>
          }
          @if (!blockedTasks().length) {
            <p class="empty">No active tasks are blocked.</p>
          }
        </section>
      }

      @if (tab() === 'review') {
        <life-weekly-review />
      }

      <ng-template
        #upcomingRow
        let-item
      >
        <button
          class="upcoming-row"
          (click)="openUpcoming(item)"
        >
          <mat-icon>{{ iconFor(item.kind) }}</mat-icon>
          <span class="date">{{ item.date }}</span>
          <span class="grow">{{ item.title }}</span>
          <span
            class="kind"
            [class.hard]="item.kind === 'deadline' || item.kind === 'goal-deadline'"
            >{{ labelFor(item.kind) }}</span
          >
        </button>
      </ng-template>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .future-page {
        max-width: 1040px;
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
      .tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin: 14px 0;
      }
      .tabs button {
        white-space: nowrap;
      }
      .tabs button.active {
        background: rgba(127, 127, 127, 0.17);
      }
      .count {
        margin-left: 5px;
        padding: 1px 5px;
        border-radius: 99px;
        background: rgba(127, 127, 127, 0.16);
        font-size: 0.68rem;
      }
      .timeline {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .bucket,
      .list-panel {
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 10px;
        padding: 11px;
      }
      .bucket h2,
      .list-panel h2 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      .upcoming-row,
      .task-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        padding: 8px 6px;
        text-align: left;
        cursor: pointer;
      }
      .upcoming-row:hover,
      .task-row:hover {
        background: rgba(127, 127, 127, 0.1);
      }
      .date {
        font-size: 0.74rem;
        opacity: 0.7;
        min-width: 86px;
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .task-row .grow {
        display: flex;
        flex-direction: column;
      }
      .task-row small {
        opacity: 0.62;
        margin-top: 2px;
      }
      .kind,
      .chip {
        font-size: 0.67rem;
        padding: 2px 6px;
        border-radius: 99px;
        background: rgba(127, 127, 127, 0.16);
        white-space: nowrap;
      }
      .kind.hard {
        font-weight: 800;
      }
      .empty {
        opacity: 0.58;
        font-size: 0.84rem;
      }
      .task-row mat-icon,
      .upcoming-row mat-icon {
        flex: 0 0 auto;
      }
      @media (max-width: 600px) {
        .future-page {
          padding: 12px 9px 92px;
        }
        .page-head {
          flex-direction: column;
        }
        .timeline {
          grid-template-columns: 1fr;
        }
        .date {
          min-width: 76px;
        }
        .kind {
          display: none;
        }
        .upcoming-row,
        .task-row {
          min-height: 44px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FuturePageComponent {
  private readonly _tasksService = inject(TaskService);
  private readonly _store = inject(Store);
  private readonly _router = inject(Router);
  private readonly _tasks = toSignal(this._tasksService.allTasks$, {
    initialValue: [] as Task[],
  });
  private readonly _projects = toSignal(
    this._store.select(selectAllProjectsExceptInbox),
    { initialValue: [] as Project[] },
  );

  readonly tab = signal<FutureTab>('upcoming');
  readonly tabs = [
    {
      id: 'upcoming' as const,
      label: 'Upcoming',
      icon: 'event_upcoming',
      count: () => this.upcoming().length,
    },
    {
      id: 'waiting' as const,
      label: 'Waiting',
      icon: 'hourglass_top',
      count: () => this.waitingTasks().length,
    },
    {
      id: 'blocked' as const,
      label: 'Blocked',
      icon: 'block',
      count: () => this.blockedTasks().length,
    },
    {
      id: 'review' as const,
      label: 'Review',
      icon: 'rate_review',
      count: () => this.reviewAttentionCount(),
    },
  ];

  readonly upcoming = computed<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    for (const task of this._tasks()) {
      if (task.isDone || task.parentId) continue;
      const scheduled =
        task.dueDay ||
        (task.dueWithTime ? this._dayForTimestamp(task.dueWithTime) : null);
      if (scheduled) {
        items.push({
          id: `scheduled-${task.id}`,
          kind: 'scheduled',
          date: scheduled,
          title: task.title,
          taskId: task.id,
        });
      }
      if (task.lifeDueDay) {
        items.push({
          id: `due-${task.id}`,
          kind: 'due',
          date: task.lifeDueDay,
          title: task.title,
          taskId: task.id,
        });
      }
      const deadline =
        task.deadlineDay ||
        (task.deadlineWithTime ? this._dayForTimestamp(task.deadlineWithTime) : null);
      if (deadline) {
        items.push({
          id: `deadline-${task.id}`,
          kind: 'deadline',
          date: deadline,
          title: task.title,
          taskId: task.id,
        });
      }
    }

    for (const project of this._projects()) {
      if (!project.lifeType || project.isDone) continue;
      if (project.goalTargetDay) {
        items.push({
          id: `goal-due-${project.id}`,
          kind: 'goal-due',
          date: project.goalTargetDay,
          title: project.title,
          projectId: project.id,
        });
      }
      if (project.goalDeadlineDay) {
        items.push({
          id: `goal-deadline-${project.id}`,
          kind: 'goal-deadline',
          date: project.goalDeadlineDay,
          title: project.title,
          projectId: project.id,
        });
      }
    }

    return items.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || this._kindRank(a.kind) - this._kindRank(b.kind),
    );
  });

  readonly overdue = computed(() => {
    const today = getDbDateStr();
    return this.upcoming().filter((item) => item.date < today);
  });

  readonly tomorrow = computed(() => {
    const day = this._addDays(getDbDateStr(), 1);
    return this.upcoming().filter((item) => item.date === day);
  });

  readonly nextSeven = computed(() => {
    const tomorrow = this._addDays(getDbDateStr(), 1);
    const end = this._addDays(getDbDateStr(), 7);
    return this.upcoming().filter((item) => item.date > tomorrow && item.date <= end);
  });

  readonly later = computed(() => {
    const end = this._addDays(getDbDateStr(), 7);
    return this.upcoming().filter((item) => item.date > end);
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
    return this._tasks().filter(
      (task) =>
        !task.isDone &&
        !task.parentId &&
        !!task.lifeReviewDay &&
        task.lifeReviewDay <= today,
    );
  });

  readonly reviewAttentionCount = computed(
    () =>
      this.overdue().length +
      this.waitingTasks().length +
      this.blockedTasks().length +
      this.reviewTasks().length,
  );

  openTask(id: string): void {
    this._tasksService.setSelectedId(id);
  }

  openUpcoming(item: UpcomingItem): void {
    if (item.taskId) {
      this.openTask(item.taskId);
    } else if (item.projectId) {
      void this._router.navigate(['/goals']);
    }
  }

  blockerLabel(task: Task): string {
    const byId = new Map(this._tasks().map((item) => [item.id, item]));
    const active = (task.lifeBlockedByTaskIds || [])
      .map((id) => byId.get(id))
      .filter((item): item is Task => !!item && !item.isDone)
      .map((item) => item.title);
    return active.length ? `Blocked by: ${active.join(', ')}` : 'Blocker completed';
  }

  iconFor(kind: UpcomingItem['kind']): string {
    return kind === 'scheduled'
      ? 'event'
      : kind === 'due' || kind === 'goal-due'
        ? 'track_changes'
        : 'flag';
  }

  labelFor(kind: UpcomingItem['kind']): string {
    return kind === 'scheduled'
      ? 'Scheduled'
      : kind === 'due'
        ? 'Due'
        : kind === 'deadline'
          ? 'Deadline'
          : kind === 'goal-due'
            ? 'Goal due'
            : 'Goal deadline';
  }

  private _kindRank(kind: UpcomingItem['kind']): number {
    return kind.includes('deadline') ? 0 : kind.includes('due') ? 1 : 2;
  }

  private _dayForTimestamp(value: number): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private _addDays(day: string, count: number): string {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + count);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
