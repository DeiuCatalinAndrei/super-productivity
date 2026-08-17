import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { addProject, updateProject } from '../../features/project/store/project.actions';
import { selectAllProjectsExceptInbox } from '../../features/project/store/project.selectors';
import { TaskService } from '../../features/tasks/task.service';
import { Task } from '../../features/tasks/task.model';

interface GoalNode {
  project: Project;
  depth: number;
  progress: number;
  doneTasks: number;
  totalTasks: number;
  remainingMs: number;
  childCount: number;
}

@Component({
  selector: 'goals-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <main class="goals-page">
      <header class="page-head">
        <div>
          <h1>🎯 Obiective</h1>
          <p>
            Obiectiv → subobiectiv → proiect → task → subtask. Datele sunt proiecte native
            Super Productivity și se sincronizează împreună cu restul aplicației.
          </p>
        </div>
        <button
          mat-flat-button
          color="primary"
          (click)="addRootGoal()"
        >
          <mat-icon>add</mat-icon>
          Obiectiv nou
        </button>
      </header>

      @if (nodes().length === 0) {
        <mat-card class="empty-card">
          <mat-card-content>
            <mat-icon>flag</mat-icon>
            <h2>Începe cu un obiectiv clar</h2>
            <p>
              Exemplu: „Termin licența până la 15 iunie”. Apoi adaugi subobiective și
              proiecte.
            </p>
            <button
              mat-flat-button
              color="primary"
              (click)="addRootGoal()"
            >
              Creează primul obiectiv
            </button>
          </mat-card-content>
        </mat-card>
      }

      <section class="goal-tree">
        @for (node of nodes(); track node.project.id) {
          <mat-card
            class="goal-card"
            [class.is-project]="node.project.lifeType === 'project'"
            [style.--goal-depth]="node.depth"
          >
            <mat-card-content>
              <div class="goal-topline">
                <div class="goal-title-wrap">
                  <mat-icon>{{
                    node.project.lifeType === 'project' ? 'folder' : 'flag'
                  }}</mat-icon>
                  <div>
                    <div class="kind">
                      {{ kindLabel(node.project.lifeType, node.depth) }}
                    </div>
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

              <mat-progress-bar
                mode="determinate"
                [value]="node.progress"
              ></mat-progress-bar>

              <div class="stats">
                <span
                  ><mat-icon>check_circle</mat-icon>{{ node.doneTasks }}/{{
                    node.totalTasks
                  }}
                  taskuri</span
                >
                @if (node.remainingMs > 0) {
                  <span
                    ><mat-icon>schedule</mat-icon
                    >{{ formatDuration(node.remainingMs) }} rămase</span
                  >
                }
                @if (node.childCount) {
                  <span
                    ><mat-icon>account_tree</mat-icon>{{ node.childCount }} elemente
                    directe</span
                  >
                }
                @if (node.project.isDone) {
                  <span><mat-icon>verified</mat-icon>Finalizat</span>
                }
              </div>

              <div class="dates">
                <label>
                  <span>🎯 Dată țintă</span>
                  <input
                    type="date"
                    [value]="node.project.goalTargetDay || ''"
                    (change)="
                      setGoalDate(
                        node.project.id,
                        'goalTargetDay',
                        $any($event.target).value
                      )
                    "
                  />
                </label>
                <label>
                  <span>🏁 Deadline final</span>
                  <input
                    type="date"
                    [value]="node.project.goalDeadlineDay || ''"
                    (change)="
                      setGoalDate(
                        node.project.id,
                        'goalDeadlineDay',
                        $any($event.target).value
                      )
                    "
                  />
                </label>
              </div>

              <div class="actions">
                @if (node.project.lifeType !== 'project') {
                  <button
                    mat-button
                    (click)="addChild(node.project, 'goal')"
                  >
                    <mat-icon>subdirectory_arrow_right</mat-icon>
                    Subobiectiv
                  </button>
                  <button
                    mat-button
                    (click)="addChild(node.project, 'project')"
                  >
                    <mat-icon>create_new_folder</mat-icon>
                    Proiect
                  </button>
                } @else {
                  <a
                    mat-button
                    [routerLink]="['/project', node.project.id, 'tasks']"
                  >
                    <mat-icon>add_task</mat-icon>
                    Taskuri
                  </a>
                }
                <button
                  mat-button
                  (click)="rename(node.project)"
                >
                  <mat-icon>edit</mat-icon>
                  Redenumește
                </button>
              </div>
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
        max-width: 980px;
        margin: 0 auto;
        padding: 16px;
        box-sizing: border-box;
      }
      .page-head {
        display: flex;
        gap: 16px;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 18px;
      }
      .page-head h1 {
        margin: 0 0 6px;
        font-size: 1.7rem;
      }
      .page-head p {
        margin: 0;
        opacity: 0.72;
        max-width: 680px;
      }
      .goal-tree {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .goal-card {
        overflow: hidden;
        margin-left: calc(var(--goal-depth) * 18px);
      }
      .goal-card.is-project {
        border-inline-start: 3px solid currentColor;
      }
      .goal-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .goal-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .title {
        font-size: 1.05rem;
        font-weight: 650;
        color: inherit;
        text-decoration: none;
      }
      .kind {
        font-size: 0.72rem;
        opacity: 0.65;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .progress-number {
        font-size: 1.15rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 10px;
        font-size: 0.85rem;
        opacity: 0.78;
      }
      .stats span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .stats mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
      .dates {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .dates label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 0.78rem;
        opacity: 0.84;
      }
      .dates input {
        color: inherit;
        background: transparent;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        padding: 10px;
        font: inherit;
        min-height: 44px;
        box-sizing: border-box;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 10px;
      }
      .empty-card {
        text-align: center;
        padding: 22px;
      }
      .empty-card mat-icon {
        font-size: 42px;
        width: 42px;
        height: 42px;
      }
      @media (max-width: 600px) {
        .goals-page {
          padding: 12px 10px 92px;
        }
        .page-head {
          align-items: stretch;
          flex-direction: column;
        }
        .page-head button {
          min-height: 48px;
        }
        .dates {
          grid-template-columns: 1fr;
        }
        .goal-card {
          margin-left: 0;
          border-inline-start: calc(2px + min(var(--goal-depth), 3) * 2px) solid
            rgba(127, 127, 127, 0.28);
        }
        .actions button,
        .actions a {
          min-height: 44px;
          min-width: 0;
          padding-inline: 8px;
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

  private readonly _projects = toSignal(
    this._store.select(selectAllProjectsExceptInbox),
    {
      initialValue: [] as Project[],
    },
  );
  private readonly _tasks = toSignal(this._taskService.allTasks$, {
    initialValue: [] as Task[],
  });

  readonly nodes = computed<GoalNode[]>(() => {
    const projects = this._projects();
    const tasks = this._tasks();
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const children = new Map<string | null, Project[]>();

    for (const project of projects) {
      if (!project.lifeType) continue;
      const parentId = project.parentProjectId ?? null;
      const bucket = children.get(parentId) ?? [];
      bucket.push(project);
      children.set(parentId, bucket);
    }
    for (const bucket of children.values()) {
      bucket.sort((a, b) => a.title.localeCompare(b.title));
    }

    const rootGoals = (children.get(null) ?? []).filter(
      (project) => project.lifeType === 'goal',
    );
    const out: GoalNode[] = [];

    const collectProjectIds = (id: string, visited = new Set<string>()): string[] => {
      if (visited.has(id)) return [];
      visited.add(id);
      const ids = [id];
      for (const child of children.get(id) ?? []) {
        ids.push(...collectProjectIds(child.id, visited));
      }
      return ids;
    };

    const collectTaskIds = (projectIds: string[]): Set<string> => {
      const ids = new Set<string>();
      const visitTask = (id: string): void => {
        if (ids.has(id)) return;
        const task = taskMap.get(id);
        if (!task) return;
        ids.add(id);
        for (const subId of task.subTaskIds ?? []) visitTask(subId);
      };
      for (const projectId of projectIds) {
        const project = projectById.get(projectId);
        if (!project || project.lifeType !== 'project') continue;
        for (const id of [
          ...(project.taskIds ?? []),
          ...(project.backlogTaskIds ?? []),
        ]) {
          visitTask(id);
        }
      }
      return ids;
    };

    const toNode = (project: Project, depth: number, path = new Set<string>()): void => {
      if (path.has(project.id)) return;
      const nextPath = new Set(path);
      nextPath.add(project.id);

      const projectIds = collectProjectIds(project.id);
      const ids = collectTaskIds(projectIds);
      const relevantTasks = [...ids]
        .map((id) => taskMap.get(id))
        .filter((task): task is Task => !!task);
      const leafTasks = relevantTasks.filter(
        (task) => !(task.subTaskIds ?? []).some((id) => ids.has(id)),
      );
      const denominator = leafTasks.reduce(
        (sum, task) => sum + Math.max(task.timeEstimate || 0, 1),
        0,
      );
      const doneWeight = leafTasks.reduce(
        (sum, task) => sum + (task.isDone ? Math.max(task.timeEstimate || 0, 1) : 0),
        0,
      );
      const progress = project.isDone
        ? 100
        : denominator
          ? Math.round((doneWeight / denominator) * 100)
          : 0;
      const remainingMs = leafTasks
        .filter((task) => !task.isDone)
        .reduce(
          (sum, task) =>
            sum + Math.max((task.timeEstimate || 0) - (task.timeSpent || 0), 0),
          0,
        );

      out.push({
        project,
        depth,
        progress,
        doneTasks: leafTasks.filter((task) => task.isDone).length,
        totalTasks: leafTasks.length,
        remainingMs,
        childCount: (children.get(project.id) ?? []).length,
      });
      for (const child of children.get(project.id) ?? []) {
        if (!nextPath.has(child.id)) toNode(child, depth + 1, nextPath);
      }
    };

    rootGoals.forEach((goal) => toNode(goal, 0));
    return out;
  });

  kindLabel(type: LifeProjectType | undefined, depth: number): string {
    if (type === 'project') return 'Proiect';
    return depth > 0 ? 'Subobiectiv' : 'Obiectiv';
  }

  formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
  }

  addRootGoal(): void {
    void this._promptTitle('Numele obiectivului').then((title) => {
      if (title) this._create(title, 'goal', null);
    });
  }

  addChild(parent: Project, type: LifeProjectType): void {
    void this._promptTitle(
      type === 'project' ? 'Numele proiectului' : 'Numele subobiectivului',
    ).then((title) => {
      if (title) this._create(title, type, parent.id);
    });
  }

  rename(project: Project): void {
    void this._promptTitle('Nume', project.title).then((title) => {
      if (!title || title === project.title) return;
      this._store.dispatch(
        updateProject({ project: { id: project.id, changes: { title } } }),
      );
    });
  }

  setGoalDate(id: string, key: 'goalTargetDay' | 'goalDeadlineDay', value: string): void {
    this._store.dispatch(
      updateProject({ project: { id, changes: { [key]: value || null } } }),
    );
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
      isHiddenFromMenu: lifeType === 'goal',
    };
    this._store.dispatch(addProject({ project }));
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
