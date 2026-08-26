import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { of } from 'rxjs';
import { LocalDateStrPipe } from '../../ui/pipes/local-date-str.pipe';
import { getDbDateStr } from '../../util/get-db-date-str';
import { DialogScheduleTaskComponent } from '../planner/dialog-schedule-task/dialog-schedule-task.component';
import { Task } from '../tasks/task.model';
import { TaskDetailItemComponent } from '../tasks/task-detail-panel/task-additional-info-item/task-detail-item.component';
import { TaskService } from '../tasks/task.service';
import { LifeContextEngineService } from './life-context-engine.service';
import { LifeOsConfigService } from './life-os-config.service';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  LifePickerOption,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from './life-ui.const';

export interface LifeTaskPickerSuggestion {
  id: string;
  title: string;
}

type LifeDateField = 'lifeDueDay' | 'lifeFollowUpDay' | 'lifeReviewDay';
type LifeMultiField = 'lifeLocationIds' | 'lifeRequirementIds';
type LifeTaskMetaSection = 'core' | 'dates';

@Component({
  selector: 'life-task-meta',
  standalone: true,
  imports: [
    MatIcon,
    MatIconButton,
    MatMenuModule,
    MatTooltip,
    LocalDateStrPipe,
    TaskDetailItemComponent,
  ],
  template: `
    <section
      class="life-meta-native"
      aria-label="Task intelligence"
    >
      @if (section() === 'core') {
        <task-detail-item
          (editActionTriggered)="priorityTrigger.openMenu()"
          [inputIcon]="task().lifePriorityId ? 'edit' : 'add'"
          class="input-item"
        >
          <ng-container input-title>
            <mat-icon>priority_high</mat-icon>
            <span>Priority</span>
          </ng-container>
          <ng-container input-value>
            <span
              #priorityTrigger="matMenuTrigger"
              [matMenuTriggerFor]="priorityMenu"
              class="menu-anchor"
              aria-hidden="true"
            ></span>
            <span [class.empty-value]="!task().lifePriorityId">{{ priorityValue() }}</span>
          </ng-container>
        </task-detail-item>

        <div class="paired-row">
          <task-detail-item
            (editActionTriggered)="energyTrigger.openMenu()"
            class="input-item paired-item"
          >
            <ng-container input-title>
              <mat-icon>bolt</mat-icon>
              <span>Energy</span>
            </ng-container>
            <ng-container input-value>
              <span
                #energyTrigger="matMenuTrigger"
                [matMenuTriggerFor]="energyMenu"
                class="menu-anchor"
                aria-hidden="true"
              ></span>
              <span [class.empty-value]="task().lifeEnergy == null">{{ energyValue() }}</span>
            </ng-container>
          </task-detail-item>

          <task-detail-item
            (editActionTriggered)="focusTrigger.openMenu()"
            class="input-item paired-item"
          >
            <ng-container input-title>
              <mat-icon>psychology</mat-icon>
              <span>Focus</span>
            </ng-container>
            <ng-container input-value>
              <span
                #focusTrigger="matMenuTrigger"
                [matMenuTriggerFor]="focusMenu"
                class="menu-anchor"
                aria-hidden="true"
              ></span>
              <span [class.empty-value]="task().lifeFocus == null">{{ focusValue() }}</span>
            </ng-container>
          </task-detail-item>
        </div>

        <div class="paired-row">
          <task-detail-item
            (editActionTriggered)="requiresTrigger.openMenu()"
            class="input-item paired-item"
          >
            <ng-container input-title>
              <mat-icon>build</mat-icon>
              <span>Requires</span>
            </ng-container>
            <ng-container input-value>
              <span
                #requiresTrigger="matMenuTrigger"
                [matMenuTriggerFor]="requiresMenu"
                class="menu-anchor"
                aria-hidden="true"
              ></span>
              <span [class.empty-value]="!task().lifeRequirementIds?.length">{{
                requiresValue()
              }}</span>
            </ng-container>
          </task-detail-item>

          <task-detail-item
            (editActionTriggered)="locationTrigger.openMenu()"
            class="input-item paired-item"
          >
            <ng-container input-title>
              <mat-icon>place</mat-icon>
              <span>Location</span>
            </ng-container>
            <ng-container input-value>
              <span
                #locationTrigger="matMenuTrigger"
                [matMenuTriggerFor]="locationMenu"
                class="menu-anchor"
                aria-hidden="true"
              ></span>
              <span [class.empty-value]="!task().lifeLocationIds?.length">{{
                locationValue()
              }}</span>
            </ng-container>
          </task-detail-item>
        </div>
      }

      @if (section() === 'dates') {
        <div class="date-field-group">
          <task-detail-item
            (editActionTriggered)="openLifeDate('lifeDueDay')"
            [inputIcon]="task().lifeDueDay ? 'edit' : 'add'"
            class="input-item"
          >
            <ng-container input-title>
              <mat-icon>event</mat-icon>
              <span>Due</span>
            </ng-container>
            <ng-container input-value>
              <span [class.empty-value]="!task().lifeDueDay">
                {{ task().lifeDueDay ? (task().lifeDueDay | localDateStr: '') : 'Not set' }}
              </span>
              @if (task().lifeDueDay) {
                <button
                  mat-icon-button
                  class="quick-chip"
                  type="button"
                  matTooltip="Clear Due"
                  (click)="clearLifeDate('lifeDueDay', $event)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </ng-container>
          </task-detail-item>
          <div class="field-help">
            Target date when you want the task completed. It is flexible and is not a hard
            deadline.
          </div>
        </div>

        <div class="date-field-group">
          <task-detail-item
            (editActionTriggered)="openLifeDate('lifeFollowUpDay')"
            [inputIcon]="task().lifeFollowUpDay ? 'edit' : 'add'"
            class="input-item"
          >
            <ng-container input-title>
              <mat-icon>notification_important</mat-icon>
              <span>Follow-up</span>
            </ng-container>
            <ng-container input-value>
              <span [class.empty-value]="!task().lifeFollowUpDay">
                {{
                  task().lifeFollowUpDay
                    ? (task().lifeFollowUpDay | localDateStr: '')
                    : 'Not set'
                }}
              </span>
              @if (task().lifeFollowUpDay) {
                <button
                  mat-icon-button
                  class="quick-chip"
                  type="button"
                  matTooltip="Clear Follow-up"
                  (click)="clearLifeDate('lifeFollowUpDay', $event)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </ng-container>
          </task-detail-item>
          <div class="field-help">
            Date when you should check back, chase a response, or continue the task.
          </div>
        </div>

        <div class="date-field-group">
          <task-detail-item
            (editActionTriggered)="openLifeDate('lifeReviewDay')"
            [inputIcon]="task().lifeReviewDay ? 'edit' : 'add'"
            class="input-item"
          >
            <ng-container input-title>
              <mat-icon>rate_review</mat-icon>
              <span>Review</span>
            </ng-container>
            <ng-container input-value>
              <span [class.empty-value]="!task().lifeReviewDay">
                {{
                  task().lifeReviewDay
                    ? (task().lifeReviewDay | localDateStr: '')
                    : 'Not set'
                }}
              </span>
              @if (task().lifeReviewDay) {
                <button
                  mat-icon-button
                  class="quick-chip"
                  type="button"
                  matTooltip="Clear Review"
                  (click)="clearLifeDate('lifeReviewDay', $event)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </ng-container>
          </task-detail-item>
          <div class="field-help">
            Date when you want to revisit and reassess the task without changing its due
            date.
          </div>
        </div>

        <task-detail-item
          (editActionTriggered)="blockedTrigger.openMenu()"
          [inputIcon]="task().lifeBlockedByTaskIds?.length ? 'edit' : 'add'"
          class="input-item blocked-row"
        >
          <ng-container input-title>
            <mat-icon>account_tree</mat-icon>
            <span>Blocked by task</span>
          </ng-container>
          <ng-container input-value>
            <span
              #blockedTrigger="matMenuTrigger"
              [matMenuTriggerFor]="blockedMenu"
              (menuClosed)="blockerQuery.set('')"
              class="menu-anchor"
              aria-hidden="true"
            ></span>
            <span [class.empty-value]="!task().lifeBlockedByTaskIds?.length">{{
              blockedByValue()
            }}</span>
          </ng-container>
        </task-detail-item>
      }
    </section>

    <mat-menu #priorityMenu="matMenu">
      <button
        mat-menu-item
        type="button"
        (click)="setPriority(null)"
      >
        <mat-icon>remove_circle_outline</mat-icon>
        <span>None</span>
      </button>
      @for (option of priorityOptions(); track option.id) {
        <button
          mat-menu-item
          type="button"
          (click)="setPriority(option.id)"
        >
          <mat-icon [style.color]="option.color || null">{{
            option.icon || 'circle'
          }}</mat-icon>
          <span>{{ option.label }}</span>
          @if (task().lifePriorityId === option.id) {
            <mat-icon class="selected-mark">check</mat-icon>
          }
        </button>
      }
    </mat-menu>

    <mat-menu #energyMenu="matMenu">
      <button
        mat-menu-item
        type="button"
        (click)="setEnergy(null)"
      >
        <mat-icon>remove_circle_outline</mat-icon>
        <span>Not set</span>
      </button>
      @for (option of energyOptions; track option.id) {
        <button
          mat-menu-item
          type="button"
          (click)="setEnergy(+option.id)"
        >
          <mat-icon [style.color]="option.color || null">{{ option.icon || 'bolt' }}</mat-icon>
          <span>{{ option.label }}</span>
          @if (task().lifeEnergy === +option.id) {
            <mat-icon class="selected-mark">check</mat-icon>
          }
        </button>
      }
    </mat-menu>

    <mat-menu #focusMenu="matMenu">
      <button
        mat-menu-item
        type="button"
        (click)="setFocus(null)"
      >
        <mat-icon>remove_circle_outline</mat-icon>
        <span>Not set</span>
      </button>
      @for (option of focusOptions; track option.id) {
        <button
          mat-menu-item
          type="button"
          (click)="setFocus(+option.id)"
        >
          <mat-icon [style.color]="option.color || null">{{
            option.icon || 'psychology'
          }}</mat-icon>
          <span>{{ option.label }}</span>
          @if (task().lifeFocus === +option.id) {
            <mat-icon class="selected-mark">check</mat-icon>
          }
        </button>
      }
    </mat-menu>

    <mat-menu #requiresMenu="matMenu">
      <div
        class="persistent-menu"
        (click)="$event.stopPropagation()"
      >
        <button
          class="persistent-menu-item"
          type="button"
          (click)="clearMulti('lifeRequirementIds')"
        >
          <mat-icon>clear_all</mat-icon>
          <span>Anything</span>
        </button>
        @for (option of requirementOptions(); track option.id) {
          <button
            class="persistent-menu-item"
            type="button"
            (click)="toggleMulti('lifeRequirementIds', option.id)"
          >
            <mat-icon [style.color]="option.color || null">{{ option.icon || 'build' }}</mat-icon>
            <span>{{ option.label }}</span>
            @if (task().lifeRequirementIds?.includes(option.id)) {
              <mat-icon class="selected-mark">check</mat-icon>
            }
          </button>
        }
      </div>
    </mat-menu>

    <mat-menu #locationMenu="matMenu">
      <div
        class="persistent-menu"
        (click)="$event.stopPropagation()"
      >
        <button
          class="persistent-menu-item"
          type="button"
          (click)="clearMulti('lifeLocationIds')"
        >
          <mat-icon>clear_all</mat-icon>
          <span>Anywhere</span>
        </button>
        @for (option of locationOptions(); track option.id) {
          <button
            class="persistent-menu-item"
            type="button"
            (click)="toggleMulti('lifeLocationIds', option.id)"
          >
            <mat-icon [style.color]="option.color || null">{{ option.icon || 'place' }}</mat-icon>
            <span>{{ option.label }}</span>
            @if (task().lifeLocationIds?.includes(option.id)) {
              <mat-icon class="selected-mark">check</mat-icon>
            }
          </button>
        }
      </div>
    </mat-menu>

    <mat-menu #blockedMenu="matMenu">
      <div
        class="blocker-menu-body"
        (click)="$event.stopPropagation()"
      >
        <label class="blocker-search">
          <mat-icon>search</mat-icon>
          <input
            type="search"
            placeholder="Search tasks"
            aria-label="Search tasks"
            [value]="blockerQuery()"
            (input)="blockerQuery.set($any($event.target).value)"
            (keydown)="$event.stopPropagation()"
          />
        </label>
        @if (!filteredBlockerCandidates().length) {
          <div class="empty-menu-message">No matching tasks</div>
        }
        @for (candidate of filteredBlockerCandidates(); track candidate.id) {
          <button
            class="persistent-menu-item"
            type="button"
            (click)="toggleBlocker(candidate.id)"
          >
            <mat-icon>task_alt</mat-icon>
            <span>{{ candidate.title }}</span>
            @if (task().lifeBlockedByTaskIds?.includes(candidate.id)) {
              <mat-icon class="selected-mark">check</mat-icon>
            }
          </button>
        }
      </div>
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }

      .life-meta-native {
        display: block;
        min-width: 0;
      }

      .life-meta-native > task-detail-item,
      .date-field-group,
      .blocked-row {
        display: block;
        margin-block: var(--s-half);
      }

      .paired-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s);
        margin: calc(var(--s) + var(--s-quarter)) var(--s);
      }

      :host ::ng-deep .paired-item .input-item {
        margin: 0;
      }

      :host ::ng-deep .paired-item .input-item__title {
        margin-inline: var(--s-half);
        flex-basis: auto;
      }

      :host ::ng-deep .paired-item .input-item__title mat-icon:first-of-type {
        margin-right: var(--s-half);
      }

      :host ::ng-deep .paired-item .input-item__value {
        flex: 0 1 auto;
        margin-right: var(--s-half);
      }

      .date-field-group {
        margin-bottom: calc(var(--s) + var(--s-half));
      }

      .field-help {
        margin: 0 var(--s2);
        padding: 0 var(--s-half);
        color: var(--text-color-muted);
        font-size: 11px;
        line-height: 1.35;
        text-align: left;
      }

      .empty-value {
        color: var(--text-color-muted);
        font-weight: 400;
      }

      .quick-chip {
        margin-left: var(--s-quarter);
      }

      .menu-anchor {
        position: absolute;
        top: 50%;
        right: var(--s2);
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .selected-mark {
        margin-left: auto;
        color: var(--c-accent);
      }

      .persistent-menu {
        min-width: 220px;
        padding-block: var(--s-half);
      }

      .persistent-menu-item {
        display: flex;
        align-items: center;
        gap: var(--s);
        width: 100%;
        min-height: 48px;
        padding: 0 var(--s2);
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text-color);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .persistent-menu-item:hover,
      .persistent-menu-item:focus-visible {
        background: var(--task-detail-bg-hover);
      }

      .persistent-menu-item > mat-icon {
        flex: 0 0 auto;
      }

      .persistent-menu-item > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .blocker-menu-body {
        width: min(360px, calc(100vw - 32px));
        max-height: 420px;
        overflow: auto;
        padding-block: var(--s-half);
      }

      .blocker-search {
        display: flex;
        align-items: center;
        gap: var(--s-half);
        margin: 0 var(--s) var(--s-half);
        padding: 0 var(--s-half);
        min-height: 38px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--bg-lighter);
      }

      .blocker-search mat-icon {
        flex: 0 0 auto;
        color: var(--text-color-muted);
      }

      .blocker-search input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text-color);
        font: inherit;
      }

      .empty-menu-message {
        padding: var(--s) var(--s2);
        color: var(--text-color-muted);
        font-size: 13px;
      }

      @media (max-width: 420px) {
        .paired-row {
          gap: var(--s-half);
          margin-inline: var(--s-half);
        }

        :host ::ng-deep .paired-item .input-item__title,
        :host ::ng-deep .paired-item .input-item__value {
          margin-inline: var(--s-quarter);
          font-size: 12px;
        }

        :host ::ng-deep .paired-item .input-item__title mat-icon:first-of-type {
          margin-right: var(--s-quarter);
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .field-help {
          margin-inline: var(--s);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeTaskMetaComponent {
  readonly task = input.required<Task>();
  readonly section = input<LifeTaskMetaSection>('core');

  private readonly _taskService = inject(TaskService);
  private readonly _lifeConfig = inject(LifeOsConfigService);
  private readonly _contextEngine = inject(LifeContextEngineService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _allTasks = toSignal(this._taskService.allTasks$ ?? of([] as Task[]), {
    initialValue: [] as Task[],
  });

  readonly config = this._lifeConfig.config;
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly blockerQuery = signal('');

  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.config()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.config().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.config().requirements, 'build'),
  );

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

  readonly filteredBlockerCandidates = computed(() => {
    const query = this.blockerQuery().trim().toLocaleLowerCase();
    if (!query) return this.blockerCandidates();
    return this.blockerCandidates().filter((candidate) =>
      candidate.title.toLocaleLowerCase().includes(query),
    );
  });

  readonly priorityValue = computed(() =>
    this._singleLabel(
      this.priorityOptions(),
      this.task().lifePriorityId || null,
      'None',
    ),
  );
  readonly focusValue = computed(() =>
    this._singleLabel(
      this.focusOptions,
      this.task().lifeFocus == null ? null : String(this.task().lifeFocus),
      'Not set',
    ),
  );
  readonly energyValue = computed(() =>
    this._singleLabel(
      this.energyOptions,
      this.task().lifeEnergy == null ? null : String(this.task().lifeEnergy),
      'Not set',
    ),
  );
  readonly requiresValue = computed(() =>
    this._multiLabel(
      this.requirementOptions(),
      this.task().lifeRequirementIds || [],
      'Anything',
    ),
  );
  readonly locationValue = computed(() =>
    this._multiLabel(
      this.locationOptions(),
      this.task().lifeLocationIds || [],
      'Anywhere',
    ),
  );
  readonly blockedByValue = computed(() => {
    const selected = new Set(this.task().lifeBlockedByTaskIds || []);
    const labels = this._allTasks()
      .filter((candidate) => selected.has(candidate.id))
      .map((candidate) => candidate.title);
    return labels.length ? labels.join(', ') : 'None';
  });

  setPriority(priorityId: string | null): void {
    this._update({ lifePriorityId: priorityId });
  }

  setFocus(focus: number | null): void {
    this._update({ lifeFocus: focus });
  }

  setEnergy(energy: number | null): void {
    this._update({ lifeEnergy: energy });
  }

  toggleMulti(field: LifeMultiField, id: string): void {
    const current = this.task()[field] || [];
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
    this._update({ [field]: next } as Partial<Task>);
  }

  clearMulti(field: LifeMultiField): void {
    this._update({ [field]: [] } as Partial<Task>);
  }

  toggleBlocker(blockerId: string): void {
    const current = this.task().lifeBlockedByTaskIds || [];
    const next = current.includes(blockerId)
      ? current.filter((id) => id !== blockerId)
      : [...current, blockerId];
    const tasks = this._allTasks();
    const safeNext = next.filter(
      (id) => !this._contextEngine.wouldCreateDependencyCycle(this.task().id, id, tasks),
    );
    this._update({ lifeBlockedByTaskIds: safeNext });
  }

  openLifeDate(field: LifeDateField): void {
    const currentDay = this.task()[field] || null;
    this._matDialog
      .open(DialogScheduleTaskComponent, {
        autoFocus: false,
        restoreFocus: true,
        data: {
          targetDay: currentDay || undefined,
          isSelectDueOnly: true,
          showQuickAccess: true,
          minDate: null,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (
          result &&
          typeof result === 'object' &&
          'date' in result &&
          result.date instanceof Date
        ) {
          this._update({ [field]: getDbDateStr(result.date) } as Partial<Task>);
        }
      });
  }

  clearLifeDate(field: LifeDateField, event: Event): void {
    event.stopPropagation();
    this._update({ [field]: null } as Partial<Task>);
  }

  private _singleLabel(
    options: LifePickerOption[],
    value: string | null,
    emptyLabel: string,
  ): string {
    if (!value) return emptyLabel;
    return options.find((option) => option.id === value)?.label || emptyLabel;
  }

  private _multiLabel(
    options: LifePickerOption[],
    values: string[],
    emptyLabel: string,
  ): string {
    if (!values.length) return emptyLabel;
    const selected = new Set(values);
    const labels = options
      .filter((option) => selected.has(option.id))
      .map((option) => option.label);
    return labels.length ? labels.join(', ') : emptyLabel;
  }

  private _update(changes: Partial<Task>): void {
    this._taskService.update(this.task().id, changes);
  }
}
