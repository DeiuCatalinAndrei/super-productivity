from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    txt = p.read_text(encoding='utf-8')
    if old not in txt:
        raise SystemExit(f'Expected snippet not found in {path}: {old[:120]!r}')
    p.write_text(txt.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, extra: str) -> None:
    p = Path(path)
    txt = p.read_text(encoding='utf-8')
    if marker in txt:
        return
    p.write_text(txt.rstrip() + '\n\n' + extra.strip() + '\n', encoding='utf-8')

# 1) Habit simple completion toggles 0 <-> 1 instead of incrementing forever.
replace_once(
    'src/app/features/simple-counter/habit-tracker/habit-tracker.component.ts',
    """    if (\n      counter.type === SimpleCounterType.ClickCounter ||\n      counter.type === SimpleCounterType.RepeatedCountdownReminder\n    ) {\n      // Increment for ClickCounters on left click\n      const newVal = currentValue + 1;\n      this._simpleCounterService.setCounterForDate(counter.id, date, newVal);\n    } else {\n""",
    """    if (this.isSimpleCompletion(counter)) {\n      // A simple habit is a real checkbox: click once to complete, click again to undo.\n      this._simpleCounterService.setCounterForDate(\n        counter.id,\n        date,\n        currentValue > 0 ? 0 : 1,\n      );\n    } else if (\n      counter.type === SimpleCounterType.ClickCounter ||\n      counter.type === SimpleCounterType.RepeatedCountdownReminder\n    ) {\n      const newVal = currentValue + 1;\n      this._simpleCounterService.setCounterForDate(counter.id, date, newVal);\n    } else {\n""",
)

# 2) Goals task rows: separate completion checkbox from opening task details.
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """                  @for (task of node.directTasks; track task.id) {\n                    <button\n                      class=\"task-row\"\n                      (click)=\"openTask(task.id)\"\n                    >\n                      <mat-icon>{{\n                        task.isDone ? 'check_circle' : 'radio_button_unchecked'\n                      }}</mat-icon>\n""",
    """                  @for (task of node.directTasks; track task.id) {\n                    <div\n                      class=\"task-row\"\n                      role=\"button\"\n                      tabindex=\"0\"\n                      (click)=\"openTask(task.id)\"\n                      (keydown.enter)=\"openTask(task.id)\"\n                    >\n                      <button\n                        class=\"task-toggle\"\n                        type=\"button\"\n                        [attr.aria-label]=\"task.isDone ? 'Mark task not done' : 'Mark task done'\"\n                        (click)=\"toggleTaskDone(task, $event)\"\n                      >\n                        <mat-icon>{{\n                          task.isDone ? 'check_circle' : 'radio_button_unchecked'\n                        }}</mat-icon>\n                      </button>\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """                      @if (task.lifeIsNextAction) {\n                        <span class=\"chip next\">Next</span>\n                      }\n                    </button>\n                  }\n""",
    """                      @if (task.lifeIsNextAction) {\n                        <span class=\"chip next\">Next</span>\n                      }\n                    </div>\n                  }\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """                    @for (task of node.directTasks; track task.id) {\n                      <button (click)=\"openTask(task.id)\">\n                        <mat-icon>{{\n                          task.isDone ? 'check' : 'check_box_outline_blank'\n                        }}</mat-icon>\n                        {{ task.title }}\n                      </button>\n                    }\n""",
    """                    @for (task of node.directTasks; track task.id) {\n                      <div class=\"tree-task-row\" (click)=\"openTask(task.id)\">\n                        <button\n                          class=\"task-toggle\"\n                          type=\"button\"\n                          (click)=\"toggleTaskDone(task, $event)\"\n                          [attr.aria-label]=\"task.isDone ? 'Mark task not done' : 'Mark task done'\"\n                        >\n                          <mat-icon>{{\n                            task.isDone ? 'check_box' : 'check_box_outline_blank'\n                          }}</mat-icon>\n                        </button>\n                        <span [class.done]=\"task.isDone\">{{ task.title }}</span>\n                      </div>\n                    }\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """      option {\n        color: initial;\n      }\n""",
    """      select {\n        color-scheme: light dark;\n        background: Canvas;\n        color: CanvasText;\n      }\n      option {\n        background: Canvas;\n        color: CanvasText;\n      }\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """      .task-row mat-icon {\n        width: 18px;\n        height: 18px;\n        font-size: 18px;\n      }\n""",
    """      .task-row mat-icon {\n        width: 18px;\n        height: 18px;\n        font-size: 18px;\n      }\n      .task-toggle {\n        flex: 0 0 auto;\n        width: 32px;\n        height: 32px;\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        border: 0;\n        border-radius: 50%;\n        background: transparent;\n        color: inherit;\n        cursor: pointer;\n        padding: 0;\n      }\n      .task-toggle:hover {\n        background: rgba(127, 127, 127, 0.14);\n      }\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """      .tree-tasks button {\n        display: flex;\n        align-items: center;\n        gap: 6px;\n        border: 0;\n        background: transparent;\n        color: inherit;\n        padding: 5px;\n        text-align: left;\n        cursor: pointer;\n      }\n""",
    """      .tree-task-row {\n        display: flex;\n        align-items: center;\n        gap: 6px;\n        padding: 4px;\n        border-radius: 6px;\n        cursor: pointer;\n      }\n      .tree-task-row:hover {\n        background: rgba(127, 127, 127, 0.1);\n      }\n      .tree-task-row .done {\n        text-decoration: line-through;\n        opacity: 0.58;\n      }\n""",
)
replace_once(
    'src/app/pages/goals-page/goals-page.component.ts',
    """  openTask(id: string): void {\n    this._taskService.setSelectedId(id);\n  }\n\n""",
    """  openTask(id: string): void {\n    this._taskService.setSelectedId(id);\n  }\n\n  toggleTaskDone(task: Task, event: Event): void {\n    event.stopPropagation();\n    if (task.isDone) {\n      this._taskService.setUnDone(task.id);\n    } else {\n      this._taskService.setDone(task.id);\n    }\n  }\n\n""",
)

# 3) Today + Smart Views task completion and direct Smart Views route behavior.
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    "import { RouterModule } from '@angular/router';",
    "import { Router, RouterModule } from '@angular/router';",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """        <button\n          class=\"task-row\"\n          (click)=\"openTask(task.id)\"\n        >\n          <mat-icon>{{\n            task.isDone ? 'check_circle' : 'radio_button_unchecked'\n          }}</mat-icon>\n""",
    """        <div\n          class=\"task-row\"\n          role=\"button\"\n          tabindex=\"0\"\n          (click)=\"openTask(task.id)\"\n          (keydown.enter)=\"openTask(task.id)\"\n        >\n          <button\n            class=\"task-toggle\"\n            type=\"button\"\n            [attr.aria-label]=\"task.isDone ? 'Mark task not done' : 'Mark task done'\"\n            (click)=\"toggleTaskDone(task, $event)\"\n          >\n            <mat-icon>{{\n              task.isDone ? 'check_circle' : 'radio_button_unchecked'\n            }}</mat-icon>\n          </button>\n""",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """          @if (task.deadlineDay || task.deadlineWithTime) {\n            <span class=\"chip deadline\">Deadline</span>\n          }\n        </button>\n""",
    """          @if (task.deadlineDay || task.deadlineWithTime) {\n            <span class=\"chip deadline\">Deadline</span>\n          }\n        </div>\n""",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """      option {\n        color: initial;\n      }\n""",
    """      select {\n        color-scheme: light dark;\n        background: Canvas;\n        color: CanvasText;\n      }\n      option {\n        background: Canvas;\n        color: CanvasText;\n      }\n""",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """      .task-row mat-icon {\n        width: 18px;\n        height: 18px;\n        font-size: 18px;\n      }\n""",
    """      .task-row mat-icon {\n        width: 18px;\n        height: 18px;\n        font-size: 18px;\n      }\n      .task-toggle {\n        flex: 0 0 auto;\n        width: 32px;\n        height: 32px;\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        border: 0;\n        border-radius: 50%;\n        background: transparent;\n        color: inherit;\n        cursor: pointer;\n        padding: 0;\n      }\n      .task-toggle:hover {\n        background: rgba(127, 127, 127, 0.14);\n      }\n""",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """  private readonly _globalConfig = inject(GlobalConfigService);\n\n  readonly config = this._life.config;\n  readonly tab = signal<LifeTodayTab>('overview');\n""",
    """  private readonly _globalConfig = inject(GlobalConfigService);\n  private readonly _router = inject(Router);\n\n  readonly config = this._life.config;\n  readonly isSmartViewsRoute = this._router.url.startsWith('/smart-views');\n  readonly tab = signal<LifeTodayTab>(this.isSmartViewsRoute ? 'context' : 'overview');\n""",
)
replace_once(
    'src/app/pages/life-today-page/life-today-page.component.ts',
    """  openTask(id: string): void {\n    this._taskService.setSelectedId(id);\n  }\n\n""",
    """  openTask(id: string): void {\n    this._taskService.setSelectedId(id);\n  }\n\n  toggleTaskDone(task: Task, event: Event): void {\n    event.stopPropagation();\n    if (task.isDone) {\n      this._taskService.setUnDone(task.id);\n    } else {\n      this._taskService.setDone(task.id);\n    }\n  }\n\n""",
)

# 4) Dedicated Smart Views route and sidebar button.
replace_once(
    'src/app/app.routes.ts',
    """  {\n    path: 'goals',\n    loadComponent: () =>\n      import('./routes/pages.routes').then((m) => m.GoalsPageComponent),\n    data: { page: 'goals' },\n    canActivate: [FocusOverlayOpenGuard],\n  },\n""",
    """  {\n    path: 'smart-views',\n    loadComponent: () =>\n      import('./routes/pages.routes').then((m) => m.LifeTodayPageComponent),\n    data: { page: 'smart-views' },\n    canActivate: [FocusOverlayOpenGuard],\n  },\n  {\n    path: 'goals',\n    loadComponent: () =>\n      import('./routes/pages.routes').then((m) => m.GoalsPageComponent),\n    data: { page: 'goals' },\n    canActivate: [FocusOverlayOpenGuard],\n  },\n""",
)
replace_once(
    'src/app/core-ui/magic-side-nav/magic-nav-config.service.ts',
    """    items.push({\n      type: 'route',\n      id: 'goals',\n      label: 'Goals',\n      icon: 'flag',\n      route: '/goals',\n    });\n\n""",
    """    items.push({\n      type: 'route',\n      id: 'smart-views',\n      label: 'Smart Views',\n      icon: 'filter_alt',\n      route: '/smart-views',\n    });\n\n    items.push({\n      type: 'route',\n      id: 'goals',\n      label: 'Goals',\n      icon: 'flag',\n      route: '/goals',\n    });\n\n""",
)

# 5) Add New Task gets LifeOS metadata before submit.
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    "import { SelectOptionRowComponent } from '../../../ui/select-option-row/select-option-row.component';",
    "import { SelectOptionRowComponent } from '../../../ui/select-option-row/select-option-row.component';\nimport { LifeOsConfigService } from '../../lifeos/life-os-config.service';",
)
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    """  readonly stateService = inject(AddTaskBarStateService);\n\n  T = T;\n""",
    """  readonly stateService = inject(AddTaskBarStateService);\n  private readonly _lifeOsConfigService = inject(LifeOsConfigService);\n\n  T = T;\n  readonly lifeConfig = this._lifeOsConfigService.config;\n  readonly lifeMetaExpanded = signal(false);\n  readonly lifePriorityId = signal('');\n  readonly lifeFocus = signal<number | null>(null);\n  readonly lifeEnergy = signal<number | null>(null);\n  readonly lifeDueDay = signal('');\n  readonly lifeLocationId = signal('');\n  readonly lifeRequirementId = signal('');\n  readonly lifeIsNextAction = signal(false);\n  readonly lifeWaitingFor = signal('');\n  readonly lifeFollowUpDay = signal('');\n  readonly lifeReviewDay = signal('');\n  readonly lifeBlockedByIds = signal('');\n""",
)
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    """  ngOnInit(): void {\n    this._setProjectInitially();\n""",
    """  ngOnInit(): void {\n    this.lifePriorityId.set(this.lifeConfig().defaultPriorityId || '');\n    this._setProjectInitially();\n""",
)
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    """      const note = this.stateService.noteTxt().trim();\n""",
    """      taskData.lifePriorityId = this.lifePriorityId() || null;\n      taskData.lifeFocus = this.lifeFocus();\n      taskData.lifeEnergy = this.lifeEnergy();\n      taskData.lifeDueDay = this.lifeDueDay() || null;\n      taskData.lifeLocationIds = this.lifeLocationId() ? [this.lifeLocationId()] : [];\n      taskData.lifeRequirementIds = this.lifeRequirementId()\n        ? [this.lifeRequirementId()]\n        : [];\n      taskData.lifeIsNextAction = this.lifeIsNextAction();\n      taskData.lifeWaitingFor = this.lifeWaitingFor().trim() || null;\n      taskData.lifeFollowUpDay = this.lifeFollowUpDay() || null;\n      taskData.lifeReviewDay = this.lifeReviewDay() || null;\n      taskData.lifeBlockedByTaskIds = this.lifeBlockedByIds()\n        .split(',')\n        .map((id) => id.trim())\n        .filter(Boolean);\n\n      const note = this.stateService.noteTxt().trim();\n""",
)
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    """      this._resetAfterAdd();\n    } finally {\n""",
    """      this._resetAfterAdd();\n      this._resetLifeMeta();\n    } finally {\n""",
)
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.ts',
    """  onSubmitBtnClick(): void {\n""",
    """  private _resetLifeMeta(): void {\n    this.lifePriorityId.set(this.lifeConfig().defaultPriorityId || '');\n    this.lifeFocus.set(null);\n    this.lifeEnergy.set(null);\n    this.lifeDueDay.set('');\n    this.lifeLocationId.set('');\n    this.lifeRequirementId.set('');\n    this.lifeIsNextAction.set(false);\n    this.lifeWaitingFor.set('');\n    this.lifeFollowUpDay.set('');\n    this.lifeReviewDay.set('');\n    this.lifeBlockedByIds.set('');\n  }\n\n  onSubmitBtnClick(): void {\n""",
)

life_html = """\n    <div class=\"lifeos-quick-fields\">\n      <label>\n        <span>Priority</span>\n        <select [value]=\"lifePriorityId()\" (change)=\"lifePriorityId.set($any($event.target).value)\">\n          <option value=\"\">None</option>\n          @for (level of lifeConfig().priorityLevels; track level.id) {\n            <option [value]=\"level.id\">{{ level.label }}</option>\n          }\n        </select>\n      </label>\n      <label>\n        <span>Due</span>\n        <input type=\"date\" [value]=\"lifeDueDay()\" (change)=\"lifeDueDay.set($any($event.target).value)\" />\n      </label>\n      <label>\n        <span>Focus</span>\n        <select [value]=\"lifeFocus() || ''\" (change)=\"lifeFocus.set($any($event.target).value ? +$any($event.target).value : null)\">\n          <option value=\"\">Any</option>\n          @for (n of [1, 2, 3, 4, 5]; track n) { <option [value]=\"n\">{{ n }} / 5</option> }\n        </select>\n      </label>\n      <label>\n        <span>Energy</span>\n        <select [value]=\"lifeEnergy() || ''\" (change)=\"lifeEnergy.set($any($event.target).value ? +$any($event.target).value : null)\">\n          <option value=\"\">Any</option>\n          @for (n of [1, 2, 3, 4, 5]; track n) { <option [value]=\"n\">{{ n }} / 5</option> }\n        </select>\n      </label>\n      <button type=\"button\" class=\"lifeos-more-btn\" (click)=\"lifeMetaExpanded.set(!lifeMetaExpanded())\">\n        <mat-icon>{{ lifeMetaExpanded() ? 'expand_less' : 'tune' }}</mat-icon>\n        {{ lifeMetaExpanded() ? 'Less' : 'More' }}\n      </button>\n    </div>\n\n    @if (lifeMetaExpanded()) {\n      <div class=\"lifeos-more-fields\">\n        <label>\n          <span>Location</span>\n          <select [value]=\"lifeLocationId()\" (change)=\"lifeLocationId.set($any($event.target).value)\">\n            <option value=\"\">Anywhere</option>\n            @for (option of lifeConfig().locations; track option.id) { <option [value]=\"option.id\">{{ option.label }}</option> }\n          </select>\n        </label>\n        <label>\n          <span>Requires</span>\n          <select [value]=\"lifeRequirementId()\" (change)=\"lifeRequirementId.set($any($event.target).value)\">\n            <option value=\"\">Anything</option>\n            @for (option of lifeConfig().requirements; track option.id) { <option [value]=\"option.id\">{{ option.label }}</option> }\n          </select>\n        </label>\n        <label class=\"lifeos-check\">\n          <input type=\"checkbox\" [checked]=\"lifeIsNextAction()\" (change)=\"lifeIsNextAction.set($any($event.target).checked)\" />\n          <span>Next Action</span>\n        </label>\n        <label><span>Waiting for</span><input [value]=\"lifeWaitingFor()\" (input)=\"lifeWaitingFor.set($any($event.target).value)\" placeholder=\"Person / response / event\" /></label>\n        <label><span>Follow-up</span><input type=\"date\" [value]=\"lifeFollowUpDay()\" (change)=\"lifeFollowUpDay.set($any($event.target).value)\" /></label>\n        <label><span>Review</span><input type=\"date\" [value]=\"lifeReviewDay()\" (change)=\"lifeReviewDay.set($any($event.target).value)\" /></label>\n        <label class=\"lifeos-wide\"><span>Blocked by task IDs</span><input [value]=\"lifeBlockedByIds()\" (input)=\"lifeBlockedByIds.set($any($event.target).value)\" placeholder=\"task-id-1, task-id-2\" /></label>\n      </div>\n    }\n"""
replace_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.html',
    """    </add-task-bar-actions>\n\n    @if (stateService.isNoteExpanded()) {\n""",
    """    </add-task-bar-actions>\n""" + life_html + """\n    @if (stateService.isNoteExpanded()) {\n""",
)
append_once(
    'src/app/features/tasks/add-task-bar/add-task-bar.component.scss',
    '.lifeos-quick-fields',
    """
.lifeos-quick-fields,
.lifeos-more-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 8px;
  padding: 8px 12px 0;
}
.lifeos-more-fields {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-bottom: 8px;
}
.lifeos-quick-fields label,
.lifeos-more-fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
}
.lifeos-quick-fields select,
.lifeos-more-fields select,
.lifeos-quick-fields input,
.lifeos-more-fields input {
  min-height: 38px;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 8px;
  padding: 7px 9px;
  color-scheme: light dark;
  background: Canvas;
  color: CanvasText;
  font: inherit;
}
.lifeos-quick-fields option,
.lifeos-more-fields option {
  background: Canvas;
  color: CanvasText;
}
.lifeos-more-btn {
  align-self: end;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.lifeos-check {
  flex-direction: row !important;
  align-items: center;
  align-self: end;
  min-height: 38px;
}
.lifeos-check input {
  min-height: auto;
  width: 18px;
  height: 18px;
}
.lifeos-wide {
  grid-column: 1 / -1;
}
@media (max-width: 720px) {
  .lifeos-quick-fields,
  .lifeos-more-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lifeos-more-btn,
  .lifeos-wide {
    grid-column: 1 / -1;
  }
}
""",
)

print('LifeOS UX patch applied successfully')
