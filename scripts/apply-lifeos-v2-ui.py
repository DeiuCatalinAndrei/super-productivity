from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:150]!r}')
    p.write_text(text.replace(old, new, 1))

# Remaining UI integration after routes/pages were applied directly.
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts',
    "import { TaskProjectMoveService } from '../task-project-move.service';\n",
    "import { TaskProjectMoveService } from '../task-project-move.service';\nimport { LifeTaskMetaComponent } from '../../lifeos/life-task-meta.component';\n",
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts',
    "    TaskContextMenuComponent,\n  ],",
    "    TaskContextMenuComponent,\n    LifeTaskMetaComponent,\n  ],",
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts',
    "  readonly hasGoalProjects = computed(() =>\n    this._projects().some(\n      (project) => project.lifeType === 'project' && !project.isArchived,\n    ),\n  );",
    "  readonly hasGoalProjects = computed(() =>\n    this._projects().some((project) => !!project.lifeType && !project.isArchived),\n  );",
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts',
    "    if (!project || project.lifeType !== 'project') return null;\n",
    "    if (!project || !project.lifeType) return null;\n",
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.html',
    '<span>Obiectiv / proiect</span>',
    '<span>Goal / project</span>',
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.html',
    '<span>Nelegat de un obiectiv</span>',
    '<span>Not linked to a goal</span>',
)
replace_once(
    'src/app/features/tasks/task-detail-panel/task-detail-panel.component.html',
    "  @if (showTimeEstimate()) {\n",
    "  <life-task-meta [task]=\"task()\"></life-task-meta>\n  @if (showTimeEstimate()) {\n",
)

# Sidebar: Today opens the dashboard, Goals is English, Future is first-class.
replace_once(
    'src/app/core-ui/magic-side-nav/magic-nav-config.service.ts',
    "        route: `/tag/${mainContext.id}/tasks`,\n",
    "        route: '/life-today',\n",
)
replace_once(
    'src/app/core-ui/magic-side-nav/magic-nav-config.service.ts',
    "      label: 'Obiective',\n",
    "      label: 'Goals',\n",
)
replace_once(
    'src/app/core-ui/magic-side-nav/magic-nav-config.service.ts',
    "    if (this.isPlannerEnabled()) {\n",
    "    items.push({\n      type: 'route',\n      id: 'future',\n      label: 'Future',\n      icon: 'event_upcoming',\n      route: '/future',\n    });\n\n    if (this.isPlannerEnabled()) {\n",
)
replace_once(
    'src/app/core-ui/magic-side-nav/magic-nav-config.service.ts',
    "      {\n        type: 'route',\n        id: 'settings',\n",
    "      {\n        type: 'route',\n        id: 'life-settings',\n        label: 'LifeOS Settings',\n        icon: 'tune',\n        route: '/life-settings',\n      },\n      {\n        type: 'route',\n        id: 'settings',\n",
)

# Mobile bottom navigation.
replace_once(
    'src/app/core-ui/mobile-bottom-nav/mobile-bottom-nav.component.html',
    '  aria-label="Obiective"\n',
    '  aria-label="Goals"\n',
)
replace_once(
    'src/app/core-ui/mobile-bottom-nav/mobile-bottom-nav.component.html',
    "  <mat-icon>flag</mat-icon>\n</button>\n\n<button\n  mat-button\n  class=\"nav-button add-task-button\"",
    "  <mat-icon>flag</mat-icon>\n</button>\n\n<button\n  mat-button\n  class=\"nav-button\"\n  routerLink=\"/future\"\n  routerLinkActive=\"active\"\n  aria-label=\"Future\"\n>\n  <mat-icon>event_upcoming</mat-icon>\n</button>\n\n<button\n  mat-button\n  class=\"nav-button add-task-button\"",
)

# Native Settings discoverability.
replace_once(
    'src/app/pages/config-page/config-page.component.html',
    "            <h2 class=\"mat-h2 section-title\">\n              {{ 'PS.TABS.TASKS' | translate }}\n            </h2>\n",
    "            <h2 class=\"mat-h2 section-title\">\n              {{ 'PS.TABS.TASKS' | translate }}\n            </h2>\n            <div class=\"lifeos-settings-link\">\n              <a mat-flat-button routerLink=\"/life-settings\">\n                <mat-icon>tune</mat-icon>\n                LifeOS task intelligence, priorities and contexts\n              </a>\n            </div>\n",
)

print('LifeOS v2 remaining UI integration patch applied.')
