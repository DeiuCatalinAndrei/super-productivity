import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';

import { Project } from '../../project.model';
import { selectAllProjectsExceptInbox } from '../../store/project.selectors';

interface GoalProjectPickerData {
  currentProjectId?: string | null;
}

interface GoalProjectOption {
  project: Project;
  path: string;
  kind: 'Goal' | 'Subgoal' | 'Project' | 'Subproject';
}

@Component({
  selector: 'dialog-select-goal-project',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Goal / project</h2>
    <mat-dialog-content>
      <p class="hint">
        Assign this task directly to any Goal, Subgoal, Project or Subproject. The task
        remains a native Super Productivity task and syncs normally.
      </p>

      @if (options().length === 0) {
        <div class="empty">
          <mat-icon>flag</mat-icon>
          <strong>No goals yet.</strong>
          <span>Create a goal from the Goals page first.</span>
        </div>
      } @else {
        <div class="options">
          @for (option of options(); track option.project.id) {
            <button mat-button class="project-option" (click)="select(option.project.id)">
              <mat-icon>{{ option.project.id === data.currentProjectId ? 'check_circle' : option.project.lifeType === 'goal' ? 'flag' : 'folder' }}</mat-icon>
              <span class="project-copy">
                <strong>{{ option.project.title }}</strong>
                <small>{{ option.kind }} · {{ option.path }}</small>
              </span>
            </button>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button (click)="close()">Cancel</button></mat-dialog-actions>
  `,
  styles: [
    `
      .hint{margin-top:0;opacity:.75;max-width:560px}.options{display:flex;flex-direction:column;gap:4px;min-width:min(540px,78vw)}.project-option{min-height:54px;height:auto;justify-content:flex-start;text-align:left;padding-block:8px}.project-copy{display:flex;min-width:0;flex-direction:column;align-items:flex-start;margin-left:8px}.project-copy strong,.project-copy small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-copy small{margin-top:2px;opacity:.65}.empty{display:flex;min-width:min(460px,76vw);flex-direction:column;align-items:center;gap:8px;padding:24px 8px;text-align:center}.empty mat-icon{width:40px;height:40px;font-size:40px}@media(max-width:600px){.options,.empty{min-width:0}.project-option{min-height:58px}}
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogSelectGoalProjectComponent {
  private readonly _store = inject(Store);
  private readonly _dialogRef = inject(MatDialogRef<DialogSelectGoalProjectComponent>);
  readonly data = inject<GoalProjectPickerData>(MAT_DIALOG_DATA);
  private readonly _projects = toSignal(this._store.select(selectAllProjectsExceptInbox), { initialValue: [] as Project[] });

  readonly options = computed<GoalProjectOption[]>(() => {
    const projects = this._projects().filter((project) => !!project.lifeType && !project.isArchived);
    const byId = new Map(projects.map((project) => [project.id, project]));
    return projects
      .map((project) => ({ project, path: this._buildPath(project, byId), kind: this._kind(project, byId) }))
      .sort((a,b) => a.path.localeCompare(b.path) || a.project.title.localeCompare(b.project.title));
  });

  select(projectId: string): void { this._dialogRef.close(projectId); }
  close(): void { this._dialogRef.close(); }

  private _buildPath(project: Project, byId: Map<string, Project>): string {
    const titles = [project.title];
    const visited = new Set<string>([project.id]);
    let parentId = project.parentProjectId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      titles.unshift(parent.title);
      parentId = parent.parentProjectId;
    }
    return titles.join(' › ');
  }

  private _kind(project: Project, byId: Map<string, Project>): GoalProjectOption['kind'] {
    if (project.lifeType === 'goal') return project.parentProjectId ? 'Subgoal' : 'Goal';
    const parent = project.parentProjectId ? byId.get(project.parentProjectId) : undefined;
    return parent?.lifeType === 'project' ? 'Subproject' : 'Project';
  }
}
