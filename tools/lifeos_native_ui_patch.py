from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing marker for {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_i = text.find(start)
    if start_i < 0:
        raise RuntimeError(f"Missing start marker for {label}")
    end_i = text.find(end, start_i)
    if end_i < 0:
        raise RuntimeError(f"Missing end marker for {label}")
    return text[:start_i] + replacement + text[end_i:]


# ---------------------------------------------------------------------------
# Add Task: one shared LifeOS form, native SP date picker/menu controls,
# and Blocked By task-name autocomplete.
# ---------------------------------------------------------------------------
path = "src/app/features/tasks/add-task-bar/add-task-bar.component.html"
text = read(path)
text = replace_between(
    text,
    '    <div class="lifeos-quick-fields">',
    '    @if (stateService.isNoteExpanded()) {',
    '''    <div class="lifeos-fields">
      <life-task-fields
        [config]="lifeConfig()"
        [value]="lifeMeta()"
        [blockerSuggestions]="lifeBlockerSuggestions()"
        [compact]="true"
        (valueChange)="onLifeMetaChange($event)"
      />
    </div>

''',
    "add-task LifeOS form",
)
write(path, text)

path = "src/app/features/tasks/add-task-bar/add-task-bar.component.ts"
text = read(path)
text = must_replace(
    text,
    "import { TaskCopy, TaskReminderOptionId } from '../task.model';",
    "import { Task, TaskCopy, TaskReminderOptionId } from '../task.model';",
    "add-task Task import",
)
text = must_replace(
    text,
    "import { LifeOsConfigService } from '../../lifeos/life-os-config.service';",
    """import { LifeOsConfigService } from '../../lifeos/life-os-config.service';
import {
  createEmptyLifeTaskMeta,
  LifeTaskFieldsComponent,
  LifeTaskMetaValue,
  LifeTaskPickerSuggestion,
} from '../../lifeos/life-task-fields.component';""",
    "add-task LifeOS imports",
)
text = must_replace(
    text,
    "    SelectOptionRowComponent,\n  ],",
    "    SelectOptionRowComponent,\n    LifeTaskFieldsComponent,\n  ],",
    "add-task standalone import",
)
old_signals = """  T = T;
  readonly lifeConfig = this._lifeOsConfigService.config;
  readonly lifeMetaExpanded = signal(false);
  readonly lifePriorityId = signal('');
  readonly lifeFocus = signal<number | null>(null);
  readonly lifeEnergy = signal<number | null>(null);
  readonly lifeDueDay = signal('');
  readonly lifeLocationId = signal('');
  readonly lifeRequirementId = signal('');
  readonly lifeIsNextAction = signal(false);
  readonly lifeWaitingFor = signal('');
  readonly lifeFollowUpDay = signal('');
  readonly lifeReviewDay = signal('');
  readonly lifeBlockedByIds = signal('');
"""
new_signals = """  T = T;
  readonly lifeConfig = this._lifeOsConfigService.config;
  readonly lifeMeta = signal<LifeTaskMetaValue>(createEmptyLifeTaskMeta());
  private readonly _allTasksForLife = toSignal(this._taskService.allTasks$, {
    initialValue: [] as Task[],
  });
  readonly lifeBlockerSuggestions = computed<LifeTaskPickerSuggestion[]>(() =>
    this._allTasksForLife()
      .filter((task) => !task.isDone)
      .map((task) => ({ id: task.id, title: task.title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  );
"""
text = must_replace(text, old_signals, new_signals, "add-task signals")
text = must_replace(
    text,
    "    this.lifePriorityId.set(this.lifeConfig().defaultPriorityId || '');",
    "    this.lifeMeta.set(createEmptyLifeTaskMeta(this.lifeConfig().defaultPriorityId));",
    "add-task init",
)
old_submit = """      taskData.lifePriorityId = this.lifePriorityId() || null;
      taskData.lifeFocus = this.lifeFocus();
      taskData.lifeEnergy = this.lifeEnergy();
      taskData.lifeDueDay = this.lifeDueDay() || null;
      taskData.lifeLocationIds = this.lifeLocationId() ? [this.lifeLocationId()] : [];
      taskData.lifeRequirementIds = this.lifeRequirementId()
        ? [this.lifeRequirementId()]
        : [];
      taskData.lifeIsNextAction = this.lifeIsNextAction();
      taskData.lifeWaitingFor = this.lifeWaitingFor().trim() || null;
      taskData.lifeFollowUpDay = this.lifeFollowUpDay() || null;
      taskData.lifeReviewDay = this.lifeReviewDay() || null;
      taskData.lifeBlockedByTaskIds = this.lifeBlockedByIds()
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
"""
new_submit = """      const lifeMeta = this.lifeMeta();
      taskData.lifePriorityId = lifeMeta.priorityId;
      taskData.lifeFocus = lifeMeta.focus;
      taskData.lifeEnergy = lifeMeta.energy;
      taskData.lifeDueDay = lifeMeta.dueDay;
      taskData.lifeLocationIds = lifeMeta.locationIds;
      taskData.lifeRequirementIds = lifeMeta.requirementIds;
      taskData.lifeIsNextAction = lifeMeta.isNextAction;
      taskData.lifeWaitingFor = lifeMeta.waitingFor;
      taskData.lifeFollowUpDay = lifeMeta.waitingFor ? lifeMeta.followUpDay : null;
      taskData.lifeReviewDay = lifeMeta.reviewDay;
      taskData.lifeBlockedByTaskIds = lifeMeta.blockedByTaskIds;
"""
text = must_replace(text, old_submit, new_submit, "add-task submit metadata")
old_reset = """  private _resetLifeMeta(): void {
    this.lifePriorityId.set(this.lifeConfig().defaultPriorityId || '');
    this.lifeFocus.set(null);
    this.lifeEnergy.set(null);
    this.lifeDueDay.set('');
    this.lifeLocationId.set('');
    this.lifeRequirementId.set('');
    this.lifeIsNextAction.set(false);
    this.lifeWaitingFor.set('');
    this.lifeFollowUpDay.set('');
    this.lifeReviewDay.set('');
    this.lifeBlockedByIds.set('');
  }
"""
new_reset = """  onLifeMetaChange(value: LifeTaskMetaValue): void {
    this.lifeMeta.set(value);
  }

  private _resetLifeMeta(): void {
    this.lifeMeta.set(createEmptyLifeTaskMeta(this.lifeConfig().defaultPriorityId));
  }
"""
text = must_replace(text, old_reset, new_reset, "add-task reset")
write(path, text)

path = "src/app/features/tasks/add-task-bar/add-task-bar.component.scss"
text = read(path)
marker = "\n.lifeos-quick-fields,"
pos = text.find(marker)
if pos < 0:
    raise RuntimeError("Missing add-task LifeOS SCSS marker")
text = text[:pos] + """

.lifeos-fields {
  padding: var(--s) var(--s2) 0;
  border-top: 1px solid var(--divider-color);
}

@media (max-width: 600px) {
  .lifeos-fields {
    padding-inline: var(--s);
  }
}
"""
write(path, text)


# ---------------------------------------------------------------------------
# Goals: native SP date picker + same dropdown component for defaults.
# ---------------------------------------------------------------------------
path = "src/app/pages/goals-page/goals-page.component.ts"
text = read(path)
text = must_replace(
    text,
    "import { CommonModule } from '@angular/common';",
    "import { CommonModule } from '@angular/common';\nimport { FormsModule } from '@angular/forms';",
    "goals forms import",
)
text = must_replace(
    text,
    "import { LifeGoalViewMode } from '../../features/lifeos/life-os.model';",
    """import { LifeGoalViewMode } from '../../features/lifeos/life-os.model';
import { DatePickerInputComponent } from '../../ui/date-picker-input/date-picker-input.component';
import { LifeFieldPickerComponent } from '../../features/lifeos/life-field-picker.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../features/lifeos/life-ui.const';
import { getDbDateStr } from '../../util/get-db-date-str';""",
    "goals native UI imports",
)
text = must_replace(
    text,
    "    CommonModule,\n    RouterModule,",
    "    CommonModule,\n    FormsModule,\n    RouterModule,",
    "goals forms standalone",
)
text = must_replace(
    text,
    "    MatProgressBarModule,\n  ],",
    "    MatProgressBarModule,\n    DatePickerInputComponent,\n    LifeFieldPickerComponent,\n  ],",
    "goals picker standalone",
)
text = replace_between(
    text,
    '                <div class="dates">',
    '                <details class="defaults">',
    '''                <div class="dates">
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

''',
    "goals date pickers",
)
text = replace_between(
    text,
    '                <details class="defaults">',
    '                <section class="direct-tasks">',
    '''                <details class="defaults">
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

''',
    "goals defaults pickers",
)
text = must_replace(
    text,
    "  readonly lifeConfig = this._lifeConfigService.config;",
    """  readonly lifeConfig = this._lifeConfigService.config;
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.lifeConfig()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.lifeConfig().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.lifeConfig().requirements, 'build'),
  );""",
    "goals picker options",
)
insert = """  numberPickerValue(value: number | null | undefined): string {
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

"""
text = must_replace(text, "  setGoalDate(id: string,", insert + "  setGoalDate(id: string,", "goals picker methods")
write(path, text)


# ---------------------------------------------------------------------------
# Today: native Material inputs + shared dropdown controls in Quick Capture and
# Best Now context controls.
# ---------------------------------------------------------------------------
path = "src/app/pages/life-today-page/life-today-page.component.ts"
text = read(path)
text = must_replace(
    text,
    "import { MatIconModule } from '@angular/material/icon';",
    """import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';""",
    "today material fields",
)
text = must_replace(
    text,
    "import { getDbDateStr } from '../../util/get-db-date-str';",
    """import { getDbDateStr } from '../../util/get-db-date-str';
import { LifeFieldPickerComponent } from '../../features/lifeos/life-field-picker.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  LifePickerOption,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../features/lifeos/life-ui.const';""",
    "today LifeOS picker imports",
)
text = must_replace(
    text,
    "    MatIconModule,\n    HabitTrackerComponent,",
    """    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    LifeFieldPickerComponent,
    HabitTrackerComponent,""",
    "today standalone controls",
)
quick_start = '        <div class="quick-grid">'
quick_end = '      </section>\n\n      <nav'
text = replace_between(
    text,
    quick_start,
    quick_end,
    '''        <div class="quick-grid">
          <mat-form-field
            class="title-input"
            subscriptSizing="dynamic"
          >
            <mat-label>What needs to be done?</mat-label>
            <input
              matInput
              #quickTitle
              (keydown.enter)="quickAddFromUi(quickTitle.value, quickMinutes.value); quickTitle.value = ''"
            />
          </mat-form-field>

          <life-field-picker
            label="Priority"
            defaultIcon="priority_high"
            emptyLabel="None"
            [options]="priorityOptions()"
            [value]="quickPriorityId()"
            (valueChange)="quickPriorityId.set(singlePickerValue($event))"
          />
          <life-field-picker
            label="Focus"
            defaultIcon="psychology"
            emptyLabel="Any"
            [options]="focusOptions"
            [value]="numberPickerValue(quickFocus())"
            (valueChange)="quickFocus.set(numberFromPicker($event))"
          />
          <life-field-picker
            label="Energy"
            defaultIcon="bolt"
            emptyLabel="Any"
            [options]="energyOptions"
            [value]="numberPickerValue(quickEnergy())"
            (valueChange)="quickEnergy.set(numberFromPicker($event))"
          />

          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Estimate</mat-label>
            <input
              matInput
              #quickMinutes
              type="number"
              min="1"
              placeholder="Minutes"
            />
          </mat-form-field>

          <life-field-picker
            label="Location"
            defaultIcon="place"
            emptyLabel="Anywhere"
            [options]="locationOptions()"
            [value]="quickLocationId()"
            (valueChange)="quickLocationId.set(singlePickerValue($event))"
          />
          <life-field-picker
            label="Requires"
            defaultIcon="build"
            emptyLabel="Anything"
            [options]="requirementOptions()"
            [value]="quickRequirementId()"
            (valueChange)="quickRequirementId.set(singlePickerValue($event))"
          />

          <button
            mat-flat-button
            color="primary"
            class="quick-add-btn"
            (click)="quickAddFromUi(quickTitle.value, quickMinutes.value); quickTitle.value = ''"
          >
            <mat-icon>add</mat-icon>Add
          </button>
        </div>
''',
    "today quick capture",
)
text = replace_between(
    text,
    '            <div class="now-controls">',
    '            </div>\n          </div>\n\n          <div class="recommendations-list">',
    '''            <div class="now-controls">
              <life-field-picker
                label="Available time"
                defaultIcon="schedule"
                emptyLabel="Any"
                [options]="availableTimeOptions"
                [value]="numberPickerValue(availableMinutes())"
                (valueChange)="setAvailableMinutes(singlePickerValue($event))"
              />
              <life-field-picker
                label="Focus available"
                defaultIcon="psychology"
                emptyLabel="Any"
                [options]="focusOptions"
                [value]="numberPickerValue(currentFocus())"
                (valueChange)="setCurrentFocus(singlePickerValue($event))"
              />
              <life-field-picker
                label="Energy available"
                defaultIcon="bolt"
                emptyLabel="Any"
                [options]="energyOptions"
                [value]="numberPickerValue(currentEnergy())"
                (valueChange)="setCurrentEnergy(singlePickerValue($event))"
              />
              <life-field-picker
                label="Location"
                defaultIcon="place"
                emptyLabel="Anywhere"
                [options]="locationOptions()"
                [value]="currentLocationId()"
                (valueChange)="currentLocationId.set(singlePickerValue($event))"
              />
              <life-field-picker
                label="Available tool / device"
                defaultIcon="build"
                emptyLabel="Anything"
                [options]="requirementOptions()"
                [value]="currentRequirementId()"
                (valueChange)="currentRequirementId.set(singlePickerValue($event))"
              />
            </div>
''',
    "today now controls",
)
text = must_replace(
    text,
    "  readonly scaleDesc = [5, 4, 3, 2, 1] as const;",
    """  readonly scaleDesc = [5, 4, 3, 2, 1] as const;
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly availableTimeOptions: LifePickerOption[] = [
    { id: '10', label: '10 minutes', icon: 'schedule', color: '#26a69a' },
    { id: '15', label: '15 minutes', icon: 'schedule', color: '#42a5f5' },
    { id: '30', label: '30 minutes', icon: 'schedule', color: '#5c6bc0' },
    { id: '45', label: '45 minutes', icon: 'schedule', color: '#7e57c2' },
    { id: '60', label: '1 hour', icon: 'schedule', color: '#ab47bc' },
    { id: '90', label: '90 minutes', icon: 'schedule', color: '#ec407a' },
    { id: '120', label: '2 hours', icon: 'schedule', color: '#ef5350' },
  ];
  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.config()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.config().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.config().requirements, 'build'),
  );""",
    "today picker option state",
)
text = must_replace(
    text,
    "  readonly selectedSmartViewId = signal<string>('on-the-go');",
    """  readonly selectedSmartViewId = signal<string>('on-the-go');
  readonly quickPriorityId = signal<string>(this.config().defaultPriorityId || '');
  readonly quickFocus = signal<number | null>(null);
  readonly quickEnergy = signal<number | null>(null);
  readonly quickLocationId = signal<string>('');
  readonly quickRequirementId = signal<string>('');""",
    "today quick picker signals",
)
method_insert = """  singlePickerValue(raw: string | string[]): string {
    return Array.isArray(raw) ? raw[0] || '' : raw;
  }

  numberPickerValue(value: number | null): string {
    return value == null ? '' : String(value);
  }

  numberFromPicker(raw: string | string[]): number | null {
    const value = this.singlePickerValue(raw);
    return value ? Number(value) : null;
  }

  quickAddFromUi(title: string, minutes: string): void {
    this.quickAdd(
      title,
      this.quickPriorityId(),
      this.numberPickerValue(this.quickFocus()),
      this.numberPickerValue(this.quickEnergy()),
      minutes,
      this.quickLocationId(),
      this.quickRequirementId(),
    );
  }

"""
text = must_replace(text, "  quickAdd(\n", method_insert + "  quickAdd(\n", "today helper methods")
# Remove native input/select styling rule if present; Material/shared components own their look.
text = re.sub(
    r"\n      input,\n      select \{.*?\n      option \{\n        background: Canvas;\n        color: CanvasText;\n      \}",
    "",
    text,
    count=1,
    flags=re.S,
)
write(path, text)


# ---------------------------------------------------------------------------
# Settings: full native Material/shared-control template. Keep business logic,
# change picker handlers to accept component values instead of DOM select events.
# ---------------------------------------------------------------------------
path = "src/app/pages/life-settings-page/life-settings-page.component.ts"
text = read(path)
text = must_replace(
    text,
    "import { ChangeDetectionStrategy, Component, inject } from '@angular/core';",
    "import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';",
    "settings computed import",
)
text = must_replace(
    text,
    "import { MatIconModule } from '@angular/material/icon';",
    """import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';""",
    "settings material controls",
)
text = must_replace(
    text,
    "} from '../../features/lifeos/life-os.model';",
    """} from '../../features/lifeos/life-os.model';
import { LifeFieldPickerComponent } from '../../features/lifeos/life-field-picker.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  LifePickerOption,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../features/lifeos/life-ui.const';""",
    "settings LifeOS picker imports",
)
old_imports = "  imports: [CommonModule, RouterModule, MatButtonModule, MatCardModule, MatIconModule],"
new_imports = """  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    LifeFieldPickerComponent,
  ],"""
text = must_replace(text, old_imports, new_imports, "settings standalone imports")
new_template_styles = r'''template: `
    <main class="settings-page">
      <header class="page-head">
        <div>
          <h1>LifeOS Settings</h1>
          <p>Native Super Productivity controls, stored in synced Global Config.</p>
        </div>
        <a mat-button routerLink="/goals"><mat-icon>flag</mat-icon>Goals</a>
      </header>

      <mat-card>
        <mat-card-content>
          <h2>Priority levels</h2>
          <p class="hint">Rename, reorder or add priority levels. Colors follow their order.</p>
          <div class="list-editor">
            @for (level of config().priorityLevels; track level.id; let i = $index) {
              <div class="edit-row">
                <span class="priority-dot" [style.background]="priorityOptions()[i]?.color"></span>
                <mat-form-field class="grow" subscriptSizing="dynamic">
                  <mat-label>Priority name</mat-label>
                  <input matInput [value]="level.label" (change)="renamePriority(level.id, $any($event.target).value)" />
                </mat-form-field>
                <button mat-icon-button aria-label="Move priority up" (click)="movePriority(i, -1)" [disabled]="i === 0"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button aria-label="Move priority down" (click)="movePriority(i, 1)" [disabled]="i === config().priorityLevels.length - 1"><mat-icon>arrow_downward</mat-icon></button>
                <button mat-icon-button aria-label="Delete priority" (click)="removePriority(level.id)" [disabled]="config().priorityLevels.length <= 1"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <mat-form-field class="grow" subscriptSizing="dynamic">
              <mat-label>New priority</mat-label>
              <input matInput #priorityName placeholder="P0 Critical" (keydown.enter)="addPriority(priorityName.value); priorityName.value = ''" />
            </mat-form-field>
            <button mat-stroked-button (click)="addPriority(priorityName.value); priorityName.value = ''"><mat-icon>add</mat-icon>Add priority</button>
          </div>
          <div class="single-field">
            <life-field-picker label="Default priority" defaultIcon="priority_high" emptyLabel="None" [options]="priorityOptions()" [value]="config().defaultPriorityId || ''" (valueChange)="setDefaultPriority(singleValue($event) || null)" />
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Locations</h2>
          <p class="hint">Logical places, not GPS tracking. Tasks can use multiple locations.</p>
          <div class="list-editor">
            @for (option of config().locations; track option.id) {
              <div class="edit-row">
                <mat-icon class="context-icon">{{ option.icon || 'place' }}</mat-icon>
                <mat-form-field class="grow" subscriptSizing="dynamic">
                  <mat-label>Location</mat-label>
                  <input matInput [value]="option.label" (change)="renameContext('locations', option.id, $any($event.target).value)" />
                </mat-form-field>
                <button mat-icon-button aria-label="Delete location" (click)="removeContext('locations', option.id)"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <mat-form-field class="grow" subscriptSizing="dynamic">
              <mat-label>New location</mat-label>
              <input matInput #locationName (keydown.enter)="addContext('locations', locationName.value); locationName.value = ''" />
            </mat-form-field>
            <button mat-stroked-button (click)="addContext('locations', locationName.value); locationName.value = ''"><mat-icon>add_location</mat-icon>Add location</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Requires / device / tool</h2>
          <p class="hint">Phone, Computer, Internet, Printer, Car, Headphones or any required tool.</p>
          <div class="list-editor">
            @for (option of config().requirements; track option.id) {
              <div class="edit-row">
                <mat-icon class="context-icon">{{ option.icon || 'build' }}</mat-icon>
                <mat-form-field class="grow" subscriptSizing="dynamic">
                  <mat-label>Requirement</mat-label>
                  <input matInput [value]="option.label" (change)="renameContext('requirements', option.id, $any($event.target).value)" />
                </mat-form-field>
                <button mat-icon-button aria-label="Delete requirement" (click)="removeContext('requirements', option.id)"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <mat-form-field class="grow" subscriptSizing="dynamic">
              <mat-label>New device or tool</mat-label>
              <input matInput #requirementName (keydown.enter)="addContext('requirements', requirementName.value); requirementName.value = ''" />
            </mat-form-field>
            <button mat-stroked-button (click)="addContext('requirements', requirementName.value); requirementName.value = ''"><mat-icon>add</mat-icon>Add requirement</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Smart Views</h2>
          <p class="hint">Saved filters use the same native pickers as task metadata.</p>
          <div class="smart-list">
            @for (view of config().smartViews; track view.id) {
              <details class="smart-card">
                <summary><mat-icon>{{ view.icon || 'filter_alt' }}</mat-icon><strong>{{ view.label }}</strong></summary>
                <div class="smart-grid">
                  <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Name</mat-label>
                    <input matInput [value]="view.label" (change)="updateView(view.id, { label: $any($event.target).value })" />
                  </mat-form-field>
                  <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Max estimate (minutes)</mat-label>
                    <input matInput type="number" min="1" [value]="view.maxEstimateMinutes || ''" (change)="updateViewNumber(view.id, 'maxEstimateMinutes', $any($event.target).value)" />
                  </mat-form-field>
                  <life-field-picker label="Minimum focus" defaultIcon="psychology" emptyLabel="Any" [options]="focusOptions" [value]="numberValue(view.minFocus)" (valueChange)="updateViewNumber(view.id, 'minFocus', $event)" />
                  <life-field-picker label="Maximum focus" defaultIcon="psychology" emptyLabel="Any" [options]="focusOptions" [value]="numberValue(view.maxFocus)" (valueChange)="updateViewNumber(view.id, 'maxFocus', $event)" />
                  <life-field-picker label="Minimum energy" defaultIcon="bolt" emptyLabel="Any" [options]="energyOptions" [value]="numberValue(view.minEnergy)" (valueChange)="updateViewNumber(view.id, 'minEnergy', $event)" />
                  <life-field-picker label="Maximum energy" defaultIcon="bolt" emptyLabel="Any" [options]="energyOptions" [value]="numberValue(view.maxEnergy)" (valueChange)="updateViewNumber(view.id, 'maxEnergy', $event)" />
                  <life-field-picker label="Locations" defaultIcon="place" emptyLabel="Anywhere" [options]="locationOptions()" [values]="view.locationIds || []" [multiple]="true" (valueChange)="updateViewMulti(view.id, 'locationIds', $event)" />
                  <life-field-picker label="Requires" defaultIcon="build" emptyLabel="Anything" [options]="requirementOptions()" [values]="view.requirementIds || []" [multiple]="true" (valueChange)="updateViewMulti(view.id, 'requirementIds', $event)" />
                  <life-field-picker label="Priorities" defaultIcon="priority_high" emptyLabel="Any" [options]="priorityOptions()" [values]="view.priorityIds || []" [multiple]="true" (valueChange)="updateViewMulti(view.id, 'priorityIds', $event)" />
                  <div class="checkbox-field"><mat-checkbox [checked]="!!view.nextActionsOnly" (change)="updateView(view.id, { nextActionsOnly: $event.checked })">Next actions only</mat-checkbox></div>
                </div>
                <button mat-button (click)="removeView(view.id)"><mat-icon>delete</mat-icon>Delete view</button>
              </details>
            }
          </div>
          <div class="add-row">
            <mat-form-field class="grow" subscriptSizing="dynamic">
              <mat-label>New Smart View</mat-label>
              <input matInput #viewName (keydown.enter)="addView(viewName.value); viewName.value = ''" />
            </mat-form-field>
            <button mat-stroked-button (click)="addView(viewName.value); viewName.value = ''"><mat-icon>add</mat-icon>Add Smart View</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Weekly Review</h2>
          <div class="single-field">
            <life-field-picker label="Review day" defaultIcon="event_repeat" [allowEmpty]="false" [options]="weekDayOptions" [value]="String(config().weeklyReviewDay)" (valueChange)="setWeeklyReviewDay($event)" />
          </div>
        </mat-card-content>
      </mat-card>

      <div class="reset-row">
        <button mat-button (click)="resetDefaults()"><mat-icon>restart_alt</mat-icon>Reset LifeOS settings to defaults</button>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; width: 100%; }
      .settings-page { max-width: 900px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .page-head h1 { margin: 0 0 5px; }
      .page-head p, .hint { margin: 0; color: var(--text-color-muted); }
      h2 { margin: 0 0 5px; font-size: 1.15rem; }
      .list-editor, .smart-list { display: flex; flex-direction: column; gap: var(--s); margin-top: var(--s2); }
      .edit-row, .add-row { display: flex; align-items: center; gap: var(--s); }
      .add-row { margin-top: var(--s2); }
      .grow { flex: 1; min-width: 0; }
      .priority-dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; }
      .context-icon { color: var(--brand); }
      .single-field { max-width: 360px; margin-top: var(--s2); }
      .smart-card { border: 1px solid var(--divider-color); border-radius: var(--card-border-radius); padding: var(--s) var(--s2); background: var(--bg-lighter); }
      .smart-card summary { display: flex; align-items: center; gap: var(--s); cursor: pointer; }
      .smart-card summary mat-icon { color: var(--brand); }
      .smart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s2); margin-top: var(--s2); }
      .checkbox-field { display: flex; min-height: 42px; align-items: center; }
      .reset-row { display: flex; justify-content: flex-end; }
      mat-form-field, life-field-picker { width: 100%; min-width: 0; }
      @media (max-width: 600px) {
        .settings-page { padding: 12px 9px 92px; }
        .page-head, .add-row { flex-direction: column; align-items: stretch; }
        .smart-grid { grid-template-columns: 1fr; }
        .edit-row { align-items: center; }
      }
    `,
  ],'''
pattern = r"template: `.*?`,\n  styles: \[\n    `.*?`,\n  \],"
text, n = re.subn(pattern, new_template_styles, text, count=1, flags=re.S)
if n != 1:
    raise RuntimeError("Failed to replace settings template/styles")
text = must_replace(
    text,
    "  readonly config = this._life.config;\n  readonly scale = [1, 2, 3, 4, 5] as const;",
    """  readonly config = this._life.config;
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.config()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.config().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.config().requirements, 'build'),
  );
  readonly weekDayOptions: LifePickerOption[] = [
    { id: '0', label: 'Sunday', icon: 'event_repeat', color: '#7e57c2' },
    { id: '1', label: 'Monday', icon: 'event_repeat', color: '#42a5f5' },
    { id: '2', label: 'Tuesday', icon: 'event_repeat', color: '#26a69a' },
    { id: '3', label: 'Wednesday', icon: 'event_repeat', color: '#66bb6a' },
    { id: '4', label: 'Thursday', icon: 'event_repeat', color: '#fbc02d' },
    { id: '5', label: 'Friday', icon: 'event_repeat', color: '#ff9800' },
    { id: '6', label: 'Saturday', icon: 'event_repeat', color: '#ec407a' },
  ];
  readonly weekDays = [""",
    "settings picker options",
)
# close duplicated readonly weekDays opening caused by insertion above: we intentionally
# preserve original array body by removing its old declaration prefix only.
text = text.replace("  readonly weekDays = [\n  readonly weekDays = [", "  readonly weekDays = [", 1)
# Replace handlers to work with shared picker outputs.
text = re.sub(
    r"  updateViewNumber\(\n    id: string,\n    key: 'maxEstimateMinutes' \| 'minFocus' \| 'maxFocus' \| 'minEnergy' \| 'maxEnergy',\n    raw: string,\n  \): void \{\n    const value = raw \? Number\(raw\) : null;",
    """  updateViewNumber(
    id: string,
    key: 'maxEstimateMinutes' | 'minFocus' | 'maxFocus' | 'minEnergy' | 'maxEnergy',
    raw: string | string[],
  ): void {
    const rawValue = this.singleValue(raw);
    const value = rawValue ? Number(rawValue) : null;""",
    text,
    count=1,
)
old_multi = """  updateViewMulti(
    id: string,
    key: 'locationIds' | 'requirementIds' | 'priorityIds',
    event: Event,
  ): void {
    const select = event.target as HTMLSelectElement;
    this.updateView(id, {
      [key]: Array.from(select.selectedOptions).map((option) => option.value),
    });
  }
  setWeeklyReviewDay(raw: string): void {
    this._life.update({ weeklyReviewDay: Number(raw) });
  }
"""
new_multi = """  updateViewMulti(
    id: string,
    key: 'locationIds' | 'requirementIds' | 'priorityIds',
    raw: string | string[],
  ): void {
    this.updateView(id, { [key]: Array.isArray(raw) ? raw : raw ? [raw] : [] });
  }
  singleValue(raw: string | string[]): string {
    return Array.isArray(raw) ? raw[0] || '' : raw;
  }
  numberValue(value: number | null | undefined): string {
    return value == null ? '' : String(value);
  }
  setWeeklyReviewDay(raw: string | string[]): void {
    this._life.update({ weeklyReviewDay: Number(this.singleValue(raw)) });
  }
"""
text = must_replace(text, old_multi, new_multi, "settings picker handlers")
write(path, text)

print("LifeOS native UI patch applied")
