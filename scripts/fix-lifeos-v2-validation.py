from pathlib import Path


def replace_if_present(path: str, old: str, new: str) -> bool:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        return False
    p.write_text(text.replace(old, new, 1))
    return True


changed = False

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

# Goal Quick Add must not stamp a global/immediate-node priority explicitly.
# TaskService resolves the closest inherited Goal/Project defaults and explicit
# task metadata remains the final override.
changed |= replace_if_present(
    "src/app/pages/goals-page/goals-page.component.ts",
    """      const id = this._taskService.add(\n        title,\n        false,\n        {\n          projectId: project.id,\n          lifePriorityId:\n            project.lifeDefaultPriorityId ?? this.lifeConfig().defaultPriorityId,\n        },\n        true,\n      );\n""",
    """      const id = this._taskService.add(\n        title,\n        false,\n        { projectId: project.id },\n        true,\n      );\n""",
)

print("LifeOS validation fixes applied." if changed else "LifeOS validation fixes already present.")
