import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
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
}

@Component({
  selector: 'dialog-select-goal-project',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>🎯 Obiectiv / proiect</h2>
    <mat-dialog-content>
      <p class="hint">
        Alege proiectul în care se execută taskul. Obiectivele și subobiectivele doar
        organizează proiectele; taskurile nu sunt mutate direct într-un obiectiv.
      </p>

      @if (options().length === 0) {
        <div class="empty">
          <mat-icon>flag</mat-icon>
          <strong>Nu există încă proiecte în Obiective.</strong>
          <span>Creează mai întâi un obiectiv și un proiect din pagina Obiective.</span>
        </div>
      } @else {
        <div class="options">
          @for (option of options(); track option.project.id) {
            <button
              mat-button
              class="project-option"
              (click)="select(option.project.id)"
            >
              <mat-icon>{{
                option.project.id === data.currentProjectId ? 'check_circle' : 'folder'
              }}</mat-icon>
              <span class="project-copy">
                <strong>{{ option.project.title }}</strong>
                <small>{{ option.path }}</small>
              </span>
            </button>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="close()"
      >
        Anulează
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .hint {
        margin-top: 0;
        opacity: 0.75;
        max-width: 560px;
      }
      .options {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: min(520px, 78vw);
      }
      .project-option {
        min-height: 52px;
        height: auto;
        justify-content: flex-start;
        text-align: left;
        padding-block: 8px;
      }
      .project-copy {
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: flex-start;
        margin-left: 8px;
      }
      .project-copy strong,
      .project-copy small {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .project-copy small {
        margin-top: 2px;
        opacity: 0.65;
      }
      .empty {
        display: flex;
        min-width: min(460px, 76vw);
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 8px;
        text-align: center;
      }
      .empty mat-icon {
        width: 40px;
        height: 40px;
        font-size: 40px;
      }
      @media (max-width: 600px) {
        .options,
        .empty {
          min-width: 0;
        }
        .project-option {
          min-height: 56px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogSelectGoalProjectComponent {
  private readonly _store = inject(Store);
  private readonly _dialogRef = inject(MatDialogRef<DialogSelectGoalProjectComponent>);
  readonly data = inject<GoalProjectPickerData>(MAT_DIALOG_DATA);

  private readonly _projects = toSignal(this._store.select(selectAllProjectsExceptInbox), {
    initialValue: [] as Project[],
  });

  readonly options = computed<GoalProjectOption[]>(() => {
    const projects = this._projects();
    const byId = new Map(projects.map((project) => [project.id, project]));

    return projects
      .filter((project) => project.lifeType === 'project' && !project.isArchived)
      .map((project) => ({
        project,
        path: this._buildGoalPath(project, byId),
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.project.title.localeCompare(b.project.title));
  });

  select(projectId: string): void {
    this._dialogRef.close(projectId);
  }

  close(): void {
    this._dialogRef.close();
  }

  private _buildGoalPath(project: Project, byId: Map<string, Project>): string {
    const titles: string[] = [];
    const visited = new Set<string>();
    let parentId = project.parentProjectId;

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (parent.lifeType === 'goal') titles.unshift(parent.title);
      parentId = parent.parentProjectId;
    }

    return titles.length ? titles.join(' › ') : 'Obiective';
  }
}
