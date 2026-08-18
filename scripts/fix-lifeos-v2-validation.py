from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# TaskService inheritance must tolerate unit-test stores that intentionally omit
# the PROJECT feature state. Production still reads the same native PROJECT data.
replace_once(
    "src/app/features/tasks/task.service.ts",
    "import { RoundTimeOption } from '../project/project.model';\nimport { selectAllProjects } from '../project/store/project.selectors';\n",
    "import { Project, RoundTimeOption } from '../project/project.model';\nimport { PROJECT_FEATURE_NAME } from '../project/store/project.reducer';\n",
)
replace_once(
    "src/app/features/tasks/task.service.ts",
    "  private _lifeOsProjects = this._store.selectSignal(selectAllProjects);\n",
    """  private _lifeOsProjects = this._store.selectSignal((state: RootState) => {\n    const projectState = state?.[PROJECT_FEATURE_NAME];\n    if (!projectState) return [] as Project[];\n    return (projectState.ids as string[])\n      .map((id) => projectState.entities[id])\n      .filter((project): project is Project => !!project);\n  });\n""",
)

# Existing TaskDetailPanel unit tests use a deliberately tiny TaskService mock.
# Fall back to an empty blocker list when that mock does not expose allTasks$.
replace_once(
    "src/app/features/lifeos/life-task-meta.component.ts",
    "import { toSignal } from '@angular/core/rxjs-interop';\n",
    "import { toSignal } from '@angular/core/rxjs-interop';\nimport { of } from 'rxjs';\n",
)
replace_once(
    "src/app/features/lifeos/life-task-meta.component.ts",
    "  private readonly _allTasks = toSignal(this._taskService.allTasks$, {\n",
    "  private readonly _allTasks = toSignal(\n    this._taskService.allTasks$ ?? of([] as Task[]),\n    {\n",
)
replace_once(
    "src/app/features/lifeos/life-task-meta.component.ts",
    "    initialValue: [] as Task[],\n  });\n\n  readonly config",
    "      initialValue: [] as Task[],\n    },\n  );\n\n  readonly config",
)

# Goal Quick Add must let TaskService resolve the nearest inherited defaults;
# an explicit value here would incorrectly skip an ancestor's priority default.
replace_once(
    "src/app/pages/goals-page/goals-page.component.ts",
    """      const id = this._taskService.add(\n        title,\n        false,\n        {\n          projectId: project.id,\n          lifePriorityId:\n            project.lifeDefaultPriorityId ?? this.lifeConfig().defaultPriorityId,\n        },\n        true,\n      );\n""",
    """      const id = this._taskService.add(\n        title,\n        false,\n        { projectId: project.id },\n        true,\n      );\n""",
)

print("LifeOS v2 validation compatibility fixes applied.")
