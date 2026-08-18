from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# -----------------------------------------------------------------------------
# Goals: avoid a no-unused-expressions ternary and keep accordion semantics clear.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/pages/goals-page/goals-page.component.ts",
    "    next.has(id) ? next.delete(id) : next.add(id);\n    this.collapsed.set(next);",
    "    if (next.has(id)) {\n      next.delete(id);\n    } else {\n      next.add(id);\n    }\n    this.collapsed.set(next);",
)

# -----------------------------------------------------------------------------
# Task Detail: expose native LifeOS metadata and make the Goal/Project field English.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/features/tasks/task-detail-panel/task-detail-panel.component.html",
    "        <span>Obiectiv / proiect</span>",
    "        <span>Goal / project</span>",
)
replace_once(
    "src/app/features/tasks/task-detail-panel/task-detail-panel.component.html",
    "          <span>Nelegat de un obiectiv</span>",
    "          <span>Not linked to a goal</span>",
)
replace_once(
    "src/app/features/tasks/task-detail-panel/task-detail-panel.component.html",
    "  @if (showTimeEstimate()) {\n",
    "  <life-task-meta [task]=\"task()\"></life-task-meta>\n  @if (showTimeEstimate()) {\n",
)

# -----------------------------------------------------------------------------
# Make LifeOS config an official part of synced native TasksConfig.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/features/config/global-config.model.ts",
    "import { TaskReminderOptionId } from '../tasks/task.model';\n",
    "import { TaskReminderOptionId } from '../tasks/task.model';\nimport { LifeOsConfig } from '../lifeos/life-os.model';\n",
)
replace_once(
    "src/app/features/config/global-config.model.ts",
    "  notesTemplate: string;\n}>;",
    "  notesTemplate: string;\n  /** Native synced LifeOS priorities, contexts and Smart Views. */\n  lifeOs?: LifeOsConfig;\n}>;",
)
replace_once(
    "src/app/features/config/default-global-config.const.ts",
    "import { DEFAULT_MAX_BACKUP_FILES } from '../../../../electron/shared-with-frontend/backup-file-cleanup.util';\n",
    "import { DEFAULT_MAX_BACKUP_FILES } from '../../../../electron/shared-with-frontend/backup-file-cleanup.util';\nimport { DEFAULT_LIFE_OS_CONFIG } from '../lifeos/life-os.const';\n",
)
replace_once(
    "src/app/features/config/default-global-config.const.ts",
    "    notesTemplate: defaultTaskNotesTemplate,\n",
    "    notesTemplate: defaultTaskNotesTemplate,\n    lifeOs: DEFAULT_LIFE_OS_CONFIG,\n",
)

# -----------------------------------------------------------------------------
# Task creation: inherit nearest Goal/Project defaults. Explicit task metadata wins.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/features/tasks/task.service.ts",
    "import { RoundTimeOption } from '../project/project.model';\n",
    "import { RoundTimeOption } from '../project/project.model';\nimport { selectAllProjects } from '../project/store/project.selectors';\n",
)
replace_once(
    "src/app/features/tasks/task.service.ts",
    "  private _taskEntities = this._store.selectSignal(selectTaskEntities);\n",
    "  private _taskEntities = this._store.selectSignal(selectTaskEntities);\n  private _lifeOsProjects = this._store.selectSignal(selectAllProjects);\n",
)
marker = "  createNewTaskWithDefaults({\n"
helper = """  private _getLifeOsDefaultsForProject(projectId: string | undefined): Partial<Task> {\n    const projects = this._lifeOsProjects();\n    const byId = new Map(projects.map((project) => [project.id, project]));\n    const visited = new Set<string>();\n\n    let current = projectId ? byId.get(projectId) : undefined;\n    let priorityId: string | null | undefined;\n    let focus: number | null | undefined;\n    let energy: number | null | undefined;\n    let locationIds: string[] | null | undefined;\n    let requirementIds: string[] | null | undefined;\n\n    while (current && !visited.has(current.id)) {\n      visited.add(current.id);\n      priorityId ??= current.lifeDefaultPriorityId;\n      focus ??= current.lifeDefaultFocus;\n      energy ??= current.lifeDefaultEnergy;\n      locationIds ??= current.lifeDefaultLocationIds;\n      requirementIds ??= current.lifeDefaultRequirementIds;\n      current = current.parentProjectId ? byId.get(current.parentProjectId) : undefined;\n    }\n\n    priorityId ??= this._globalConfigService.tasks()?.lifeOs?.defaultPriorityId;\n\n    return {\n      ...(priorityId ? { lifePriorityId: priorityId } : {}),\n      ...(focus != null ? { lifeFocus: focus } : {}),\n      ...(energy != null ? { lifeEnergy: energy } : {}),\n      ...(locationIds?.length ? { lifeLocationIds: [...locationIds] } : {}),\n      ...(requirementIds?.length ? { lifeRequirementIds: [...requirementIds] } : {}),\n    };\n  }\n\n"""
replace_once("src/app/features/tasks/task.service.ts", marker, helper + marker)
replace_once(
    "src/app/features/tasks/task.service.ts",
    "      ...(workContextId === TODAY_TAG.id &&\n      !additional.parentId &&\n      !additional.dueWithTime &&\n      !('dueDay' in additional)\n        ? { dueDay: getDbDateStr() }\n        : {}),\n\n      ...additional,",
    "      ...(workContextId === TODAY_TAG.id &&\n      !additional.parentId &&\n      !additional.dueWithTime &&\n      !('dueDay' in additional)\n        ? { dueDay: getDbDateStr() }\n        : {}),\n\n      ...this._getLifeOsDefaultsForProject(\n        additional.projectId ||\n          (workContextType === WorkContextType.PROJECT\n            ? workContextId\n            : this._globalConfigService.tasks()?.defaultProjectId || INBOX_PROJECT.id),\n      ),\n      ...additional,",
)

# -----------------------------------------------------------------------------
# Sidebar: Today dashboard, Goals, Future and LifeOS Settings. Hide subprojects from
# the flat Projects tree while leaving first-level projects visible.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "  private readonly _projectNavTree = computed<MenuTreeViewNode[]>(() =>\n    this._menuTreeService.buildProjectViewTree(this._visibleProjects()),\n  );",
    "  private readonly _visibleProjectsForNav = computed(() => {\n    const byId = new Map(\n      this._allProjectsExceptInbox().map((project) => [project.id, project]),\n    );\n    return this._visibleProjects().filter((project) => {\n      if (project.lifeType === 'goal') return false;\n      if (project.lifeType === 'project' && project.parentProjectId) {\n        const parent = byId.get(project.parentProjectId);\n        if (parent?.lifeType === 'project') return false;\n      }\n      return true;\n    });\n  });\n  private readonly _projectNavTree = computed<MenuTreeViewNode[]>(() =>\n    this._menuTreeService.buildProjectViewTree(this._visibleProjectsForNav()),\n  );",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "    const visibleProjects = this._visibleProjects();\n",
    "    const visibleProjects = this._visibleProjectsForNav();\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "      const projects = this._visibleProjects();\n",
    "      const projects = this._visibleProjectsForNav();\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "            : this._visibleProjects().map((project) => ({\n",
    "            : this._visibleProjectsForNav().map((project) => ({\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "        route: `/tag/${mainContext.id}/tasks`,\n",
    "        route: '/life-today',\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "      label: 'Obiective',\n",
    "      label: 'Goals',\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "    if (this.isPlannerEnabled()) {\n",
    "    items.push({\n      type: 'route',\n      id: 'future',\n      label: 'Future',\n      icon: 'event_upcoming',\n      route: '/future',\n    });\n\n    if (this.isPlannerEnabled()) {\n",
)
replace_once(
    "src/app/core-ui/magic-side-nav/magic-nav-config.service.ts",
    "      {\n        type: 'route',\n        id: 'settings',\n",
    "      {\n        type: 'route',\n        id: 'life-settings',\n        label: 'LifeOS Settings',\n        icon: 'tune',\n        route: '/life-settings',\n      },\n      {\n        type: 'route',\n        id: 'settings',\n",
)

# -----------------------------------------------------------------------------
# Mobile bottom nav: Today dashboard + Goals + Planner + Future + Add + Menu.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/core-ui/mobile-bottom-nav/mobile-bottom-nav.component.html",
    "    [routerLink]=\"todayRoute\"\n",
    "    routerLink=\"/life-today\"\n",
)
replace_once(
    "src/app/core-ui/mobile-bottom-nav/mobile-bottom-nav.component.html",
    "    aria-label=\"Obiective\"\n",
    "    aria-label=\"Goals\"\n",
)
replace_once(
    "src/app/core-ui/mobile-bottom-nav/mobile-bottom-nav.component.html",
    "  <button\n    mat-fab\n    class=\"add-task-button\"",
    "  <button\n    mat-button\n    class=\"nav-button\"\n    routerLink=\"/future\"\n    routerLinkActive=\"active\"\n    aria-label=\"Future\"\n  >\n    <mat-icon>event_upcoming</mat-icon>\n  </button>\n\n  <button\n    mat-fab\n    class=\"add-task-button\"",
)

# -----------------------------------------------------------------------------
# Native Settings discoverability.
# -----------------------------------------------------------------------------
replace_once(
    "src/app/pages/config-page/config-page.component.html",
    "            <h2 class=\"mat-h2 section-title\">\n              {{ 'PS.TABS.TASKS' | translate }}\n            </h2>\n",
    "            <h2 class=\"mat-h2 section-title\">\n              {{ 'PS.TABS.TASKS' | translate }}\n            </h2>\n            <div class=\"lifeos-settings-link\">\n              <a mat-flat-button routerLink=\"/life-settings\">\n                <mat-icon>tune</mat-icon>\n                LifeOS task intelligence, priorities and contexts\n              </a>\n            </div>\n",
)

print("LifeOS v2 final integration changes applied.")
