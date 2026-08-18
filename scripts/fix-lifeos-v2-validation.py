from pathlib import Path


def replace_if_present(path: str, old: str, new: str) -> bool:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        return False
    p.write_text(text.replace(old, new, 1))
    return True


changed = False

# -----------------------------------------------------------------------------
# Task Detail compatibility
# -----------------------------------------------------------------------------
# Existing TaskDetailPanel tests use a deliberately tiny TaskService mock that
# does not expose allTasks$. Production still uses the real observable; isolated
# tests simply receive an empty blocker-candidate list.
changed |= replace_if_present(
    "src/app/features/lifeos/life-task-meta.component.ts",
    "import { MatIconModule } from '@angular/material/icon';\n",
    "import { MatIconModule } from '@angular/material/icon';\nimport { of } from 'rxjs';\n",
)
changed |= replace_if_present(
    "src/app/features/lifeos/life-task-meta.component.ts",
    """  private readonly _allTasks = toSignal(this._taskService.allTasks$, {\n    initialValue: [] as Task[],\n  });\n""",
    """  private readonly _allTasks = toSignal(\n    this._taskService.allTasks$ ?? of([] as Task[]),\n    { initialValue: [] as Task[] },\n  );\n""",
)

# -----------------------------------------------------------------------------
# Goals: inheritance + archive-stable progress + recursive remaining estimate
# -----------------------------------------------------------------------------
changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    "  computed,\n  inject,\n  signal,\n",
    "  computed,\n  effect,\n  inject,\n  signal,\n",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """  private readonly _tasks = toSignal(this._taskService.allTasks$, {\n    initialValue: [] as Task[],\n  });\n\n  readonly nodes = computed<GoalNode[]>(() => {\n""",
    """  private readonly _tasks = toSignal(this._taskService.allTasks$, {\n    initialValue: [] as Task[],\n  });\n  private readonly _archiveTasks = signal<Task[]>([]);\n  private _archiveLoadGeneration = 0;\n\n  constructor() {\n    effect(() => {\n      this._tasks();\n      void this._reloadArchive();\n    });\n  }\n\n  readonly nodes = computed<GoalNode[]>(() => {\n""",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """    const projects = this._projects().filter((project) => !!project.lifeType);\n    const tasks = this._tasks();\n    const byId = new Map(projects.map((project) => [project.id, project]));\n    const children = new Map<string | null, Project[]>();\n    const directTasks = new Map<string, Task[]>();\n""",
    """    const projects = this._projects().filter((project) => !!project.lifeType);\n    const liveTasks = this._tasks();\n    const taskById = new Map<string, Task>();\n    for (const task of this._archiveTasks()) taskById.set(task.id, task);\n    for (const task of liveTasks) taskById.set(task.id, task);\n    const tasks = [...taskById.values()];\n    const byId = new Map(projects.map((project) => [project.id, project]));\n    const children = new Map<string | null, Project[]>();\n    const directTasks = new Map<string, Task[]>();\n    const directLiveTasks = new Map<string, Task[]>();\n""",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """    for (const task of tasks) {\n      if (task.parentId || !byId.has(task.projectId)) continue;\n      const bucket = directTasks.get(task.projectId) ?? [];\n      bucket.push(task);\n      directTasks.set(task.projectId, bucket);\n    }\n    for (const bucket of directTasks.values()) {\n      bucket.sort(\n        (a, b) => Number(a.isDone) - Number(b.isDone) || a.title.localeCompare(b.title),\n      );\n    }\n\n    const taskById = new Map(tasks.map((task) => [task.id, task]));\n""",
    """    for (const task of tasks) {\n      if (task.parentId || !byId.has(task.projectId)) continue;\n      const bucket = directTasks.get(task.projectId) ?? [];\n      bucket.push(task);\n      directTasks.set(task.projectId, bucket);\n    }\n    for (const task of liveTasks) {\n      if (task.parentId || !byId.has(task.projectId)) continue;\n      const bucket = directLiveTasks.get(task.projectId) ?? [];\n      bucket.push(task);\n      directLiveTasks.set(task.projectId, bucket);\n    }\n    for (const bucket of [...directTasks.values(), ...directLiveTasks.values()]) {\n      bucket.sort(\n        (a, b) => Number(a.isDone) - Number(b.isDone) || a.title.localeCompare(b.title),\n      );\n    }\n\n""",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """    const roots = (children.get(null) ?? []).filter(\n      (project) => project.lifeType === 'goal',\n    );\n""",
    """    const remainingMemo = new Map<string, number>();\n    const nodeRemaining = (project: Project, path = new Set<string>()): number => {\n      const memo = remainingMemo.get(project.id);\n      if (memo != null) return memo;\n      if (path.has(project.id)) return 0;\n      const nextPath = new Set(path);\n      nextPath.add(project.id);\n      const value =\n        this._remainingEstimate(directTasks.get(project.id) ?? [], taskById) +\n        (children.get(project.id) ?? []).reduce(\n          (sum, child) => sum + nodeRemaining(child, nextPath),\n          0,\n        );\n      remainingMemo.set(project.id, value);\n      return value;\n    };\n\n    const roots = (children.get(null) ?? []).filter(\n      (project) => project.lifeType === 'goal',\n    );\n""",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """      const direct = directTasks.get(project.id) ?? [];\n      output.push({\n        project,\n        depth,\n        progress: nodeProgress(project),\n        directTasks: direct,\n        childCount: (children.get(project.id) ?? []).length,\n        remainingMs: this._remainingEstimate(direct, taskById),\n      });\n""",
    """      const direct = directLiveTasks.get(project.id) ?? [];\n      output.push({\n        project,\n        depth,\n        progress: nodeProgress(project),\n        directTasks: direct,\n        childCount: (children.get(project.id) ?? []).length,\n        remainingMs: nodeRemaining(project),\n      });\n""",
)

# Goal Quick Add must not stamp a global/immediate-node priority explicitly.
# TaskService resolves the closest inherited Goal/Project defaults and explicit
# task metadata remains the final override.
changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """      const id = this._taskService.add(\n        title,\n        false,\n        {\n          projectId: project.id,\n          lifePriorityId:\n            project.lifeDefaultPriorityId ?? this.lifeConfig().defaultPriorityId,\n        },\n        true,\n      );\n""",
    """      const id = this._taskService.add(\n        title,\n        false,\n        { projectId: project.id },\n        true,\n      );\n""",
)

changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """  private _remainingEstimate(directTasks: Task[], taskById: Map<string, Task>): number {\n""",
    """  private async _reloadArchive(): Promise<void> {\n    const loadGeneration = ++this._archiveLoadGeneration;\n    const loader = this._taskService.getArchivedTasks?.bind(this._taskService);\n    if (!loader) {\n      this._archiveTasks.set([]);\n      return;\n    }\n    try {\n      const tasks = await loader();\n      if (loadGeneration === this._archiveLoadGeneration) {\n        this._archiveTasks.set(tasks);\n      }\n    } catch {\n      if (loadGeneration === this._archiveLoadGeneration) {\n        this._archiveTasks.set([]);\n      }\n    }\n  }\n\n  private _remainingEstimate(directTasks: Task[], taskById: Map<string, Task>): number {\n""",
)

# -----------------------------------------------------------------------------
# Today: Quick Capture must never inherit whichever project happened to be active
# before navigating to the standalone Today dashboard.
# -----------------------------------------------------------------------------
changed |= replace_if_present(
    "src/app/pages/life-today-page/life-today-page.component.ts",
    "import { TaskService } from '../../features/tasks/task.service';\n",
    "import { TaskService } from '../../features/tasks/task.service';\nimport { GlobalConfigService } from '../../features/config/global-config.service';\nimport { INBOX_PROJECT } from '../../features/project/project.const';\n",
)
changed |= replace_if_present(
    "src/app/pages/life-today-page/life-today-page.component.ts",
    """  private readonly _counterService = inject(SimpleCounterService);\n\n  readonly config = this._life.config;\n""",
    """  private readonly _counterService = inject(SimpleCounterService);\n  private readonly _globalConfig = inject(GlobalConfigService);\n\n  readonly config = this._life.config;\n""",
)
changed |= replace_if_present(
    "src/app/pages/life-today-page/life-today-page.component.ts",
    """    const minutes = Number(minutesRaw || 0);\n    const id = this._taskService.add(\n""",
    """    const minutes = Number(minutesRaw || 0);\n    const configuredProjectId = this._globalConfig.tasks()?.defaultProjectId;\n    const projectId =\n      typeof configuredProjectId === 'string' ? configuredProjectId : INBOX_PROJECT.id;\n    const id = this._taskService.add(\n""",
)
changed |= replace_if_present(
    "src/app/pages/life-today-page/life-today-page.component.ts",
    """      {\n        dueDay: getDbDateStr(),\n""",
    """      {\n        projectId,\n        dueDay: getDbDateStr(),\n""",
)

# -----------------------------------------------------------------------------
# Future: Goal timeline rows navigate somewhere useful and only live unfinished
# blocker tasks keep another task blocked. Deleted/archived blockers are resolved.
# -----------------------------------------------------------------------------
changed |= replace_if_present(
    "src/app/pages/future-page/future-page.component.ts",
    "import { RouterModule } from '@angular/router';\n",
    "import { Router, RouterModule } from '@angular/router';\n",
)
changed |= replace_if_present(
    "src/app/pages/future-page/future-page.component.ts",
    """  private readonly _store = inject(Store);\n  private readonly _tasks = toSignal(this._tasksService.allTasks$, {\n""",
    """  private readonly _store = inject(Store);\n  private readonly _router = inject(Router);\n  private readonly _tasks = toSignal(this._tasksService.allTasks$, {\n""",
)
changed |= replace_if_present(
    "src/app/pages/future-page/future-page.component.ts",
    """  readonly blockedTasks = computed(() => {\n    const done = new Set(\n      this._tasks()\n        .filter((task) => task.isDone)\n        .map((task) => task.id),\n    );\n    return this._tasks().filter(\n      (task) =>\n        !task.isDone &&\n        !task.parentId &&\n        (task.lifeBlockedByTaskIds || []).some((id) => !done.has(id)),\n    );\n  });\n""",
    """  readonly blockedTasks = computed(() => {\n    const byId = new Map(this._tasks().map((task) => [task.id, task]));\n    return this._tasks().filter(\n      (task) =>\n        !task.isDone &&\n        !task.parentId &&\n        (task.lifeBlockedByTaskIds || []).some((id) => {\n          const blocker = byId.get(id);\n          return !!blocker && !blocker.isDone;\n        }),\n    );\n  });\n""",
)
changed |= replace_if_present(
    "src/app/pages/future-page/future-page.component.ts",
    """  openUpcoming(item: UpcomingItem): void {\n    if (item.taskId) this.openTask(item.taskId);\n  }\n""",
    """  openUpcoming(item: UpcomingItem): void {\n    if (item.taskId) {\n      this.openTask(item.taskId);\n    } else if (item.projectId) {\n      void this._router.navigate(['/goals']);\n    }\n  }\n""",
)

print("LifeOS validation and functional fixes applied." if changed else "LifeOS fixes already present.")
