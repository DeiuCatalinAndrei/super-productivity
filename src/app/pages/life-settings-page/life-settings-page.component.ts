import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DEFAULT_LIFE_OS_CONFIG } from '../../features/lifeos/life-os.const';
import { LifeOsConfigService } from '../../features/lifeos/life-os-config.service';
import {
  LifeContextOption,
  LifePriorityLevel,
  LifeSmartView,
} from '../../features/lifeos/life-os.model';

@Component({
  selector: 'life-settings-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <main class="settings-page">
      <header class="page-head">
        <div>
          <h1>LifeOS Settings</h1>
          <p>These settings are stored in native Global Config and sync with your other devices.</p>
        </div>
        <a mat-button routerLink="/goals"><mat-icon>flag</mat-icon>Goals</a>
      </header>

      <mat-card>
        <mat-card-content>
          <h2>Priority levels</h2>
          <p class="hint">Default levels are P1, P2 and P3. Rename, reorder or add as many as you need.</p>
          <div class="list-editor">
            @for (level of config().priorityLevels; track level.id; let i = $index) {
              <div class="edit-row">
                <input [value]="level.label" (change)="renamePriority(level.id, $any($event.target).value)" />
                <button mat-icon-button aria-label="Move priority up" (click)="movePriority(i, -1)" [disabled]="i === 0"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button aria-label="Move priority down" (click)="movePriority(i, 1)" [disabled]="i === config().priorityLevels.length - 1"><mat-icon>arrow_downward</mat-icon></button>
                <button mat-icon-button aria-label="Delete priority" (click)="removePriority(level.id)" [disabled]="config().priorityLevels.length <= 1"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <input #priorityName placeholder="New priority, e.g. P0 Critical" />
            <button mat-button (click)="addPriority(priorityName.value); priorityName.value = ''"><mat-icon>add</mat-icon>Add priority</button>
          </div>
          <label class="field">
            <span>Default priority</span>
            <select [value]="config().defaultPriorityId || ''" (change)="setDefaultPriority($any($event.target).value || null)">
              <option value="">None</option>
              @for (level of config().priorityLevels; track level.id) { <option [value]="level.id">{{ level.label }}</option> }
            </select>
          </label>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Locations</h2>
          <p class="hint">Logical places, not GPS tracking. A task can have more than one location.</p>
          <div class="list-editor">
            @for (option of config().locations; track option.id) {
              <div class="edit-row">
                <mat-icon>{{ option.icon || 'place' }}</mat-icon>
                <input [value]="option.label" (change)="renameContext('locations', option.id, $any($event.target).value)" />
                <button mat-icon-button aria-label="Delete location" (click)="removeContext('locations', option.id)"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <input #locationName placeholder="New location" />
            <button mat-button (click)="addContext('locations', locationName.value); locationName.value = ''"><mat-icon>add_location</mat-icon>Add location</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Requires / device / tool</h2>
          <p class="hint">Use this for Phone, Computer, Internet, Printer, Car, Headphones, or any tool required by a task.</p>
          <div class="list-editor">
            @for (option of config().requirements; track option.id) {
              <div class="edit-row">
                <mat-icon>{{ option.icon || 'build' }}</mat-icon>
                <input [value]="option.label" (change)="renameContext('requirements', option.id, $any($event.target).value)" />
                <button mat-icon-button aria-label="Delete requirement" (click)="removeContext('requirements', option.id)"><mat-icon>delete</mat-icon></button>
              </div>
            }
          </div>
          <div class="add-row">
            <input #requirementName placeholder="New device or tool" />
            <button mat-button (click)="addContext('requirements', requirementName.value); requirementName.value = ''"><mat-icon>add</mat-icon>Add requirement</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Smart Views</h2>
          <p class="hint">Saved filters power On the Go, Office, Quick Wins, Deep Work and your own contexts.</p>
          <div class="smart-list">
            @for (view of config().smartViews; track view.id) {
              <details class="smart-card">
                <summary><mat-icon>{{ view.icon || 'filter_alt' }}</mat-icon><strong>{{ view.label }}</strong></summary>
                <div class="smart-grid">
                  <label><span>Name</span><input [value]="view.label" (change)="updateView(view.id, { label: $any($event.target).value })" /></label>
                  <label><span>Max estimate (minutes)</span><input type="number" min="1" [value]="view.maxEstimateMinutes || ''" (change)="updateViewNumber(view.id, 'maxEstimateMinutes', $any($event.target).value)" /></label>
                  <label><span>Minimum focus</span><select [value]="view.minFocus || ''" (change)="updateViewNumber(view.id, 'minFocus', $any($event.target).value)"><option value="">Any</option>@for (n of scale; track n) {<option [value]="n">{{ n }}</option>}</select></label>
                  <label><span>Maximum focus</span><select [value]="view.maxFocus || ''" (change)="updateViewNumber(view.id, 'maxFocus', $any($event.target).value)"><option value="">Any</option>@for (n of scale; track n) {<option [value]="n">{{ n }}</option>}</select></label>
                  <label><span>Minimum energy</span><select [value]="view.minEnergy || ''" (change)="updateViewNumber(view.id, 'minEnergy', $any($event.target).value)"><option value="">Any</option>@for (n of scale; track n) {<option [value]="n">{{ n }}</option>}</select></label>
                  <label><span>Maximum energy</span><select [value]="view.maxEnergy || ''" (change)="updateViewNumber(view.id, 'maxEnergy', $any($event.target).value)"><option value="">Any</option>@for (n of scale; track n) {<option [value]="n">{{ n }}</option>}</select></label>
                  <label><span>Locations</span><select multiple (change)="updateViewMulti(view.id, 'locationIds', $event)">@for (option of config().locations; track option.id) {<option [value]="option.id" [selected]="(view.locationIds || []).includes(option.id)">{{ option.label }}</option>}</select></label>
                  <label><span>Requires</span><select multiple (change)="updateViewMulti(view.id, 'requirementIds', $event)">@for (option of config().requirements; track option.id) {<option [value]="option.id" [selected]="(view.requirementIds || []).includes(option.id)">{{ option.label }}</option>}</select></label>
                  <label><span>Priorities</span><select multiple (change)="updateViewMulti(view.id, 'priorityIds', $event)">@for (level of config().priorityLevels; track level.id) {<option [value]="level.id" [selected]="(view.priorityIds || []).includes(level.id)">{{ level.label }}</option>}</select></label>
                  <label class="check"><input type="checkbox" [checked]="!!view.nextActionsOnly" (change)="updateView(view.id, { nextActionsOnly: $any($event.target).checked })" /><span>Next actions only</span></label>
                </div>
                <button mat-button (click)="removeView(view.id)"><mat-icon>delete</mat-icon>Delete view</button>
              </details>
            }
          </div>
          <div class="add-row">
            <input #viewName placeholder="New Smart View" />
            <button mat-button (click)="addView(viewName.value); viewName.value = ''"><mat-icon>add</mat-icon>Add Smart View</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <h2>Weekly Review</h2>
          <label class="field">
            <span>Review day</span>
            <select [value]="config().weeklyReviewDay" (change)="setWeeklyReviewDay($any($event.target).value)">
              @for (day of weekDays; track day.value) { <option [value]="day.value">{{ day.label }}</option> }
            </select>
          </label>
        </mat-card-content>
      </mat-card>

      <div class="reset-row">
        <button mat-button (click)="resetDefaults()"><mat-icon>restart_alt</mat-icon>Reset LifeOS settings to defaults</button>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display:block; width:100%; }
      .settings-page { max-width: 900px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .page-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
      .page-head h1 { margin:0 0 5px; }
      .page-head p, .hint { margin:0; opacity:.68; }
      h2 { margin:0 0 5px; font-size:1.15rem; }
      .list-editor, .smart-list { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
      .edit-row { display:flex; align-items:center; gap:7px; }
      .edit-row input { flex:1; }
      .add-row { display:flex; gap:8px; margin-top:10px; }
      .add-row input { flex:1; }
      input, select { min-height:42px; border:1px solid rgba(127,127,127,.35); border-radius:8px; padding:8px 10px; background:transparent; color:inherit; font:inherit; box-sizing:border-box; }
      select[multiple] { min-height:88px; }
      option { color: initial; }
      .field { display:flex; flex-direction:column; gap:5px; margin-top:12px; max-width:360px; }
      .field > span, .smart-grid label > span { font-size:.76rem; opacity:.7; }
      .smart-card { border:1px solid rgba(127,127,127,.25); border-radius:8px; padding:9px 10px; }
      .smart-card summary { display:flex; align-items:center; gap:7px; cursor:pointer; }
      .smart-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:12px; }
      .smart-grid label { display:flex; flex-direction:column; gap:5px; }
      .smart-grid .check { flex-direction:row; align-items:center; }
      .reset-row { display:flex; justify-content:flex-end; }
      @media (max-width:600px) {
        .settings-page { padding:12px 9px 92px; }
        .page-head { flex-direction:column; }
        .smart-grid { grid-template-columns:1fr; }
        .add-row { flex-direction:column; }
        input, select { min-height:48px; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeSettingsPageComponent {
  private readonly _life = inject(LifeOsConfigService);
  readonly config = this._life.config;
  readonly scale = [1, 2, 3, 4, 5] as const;
  readonly weekDays = [
    { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  addPriority(raw: string): void {
    const label = raw.trim(); if (!label) return;
    const level: LifePriorityLevel = { id: this._id('priority'), label };
    this._life.update({ priorityLevels: [...this.config().priorityLevels, level] });
  }
  renamePriority(id: string, raw: string): void {
    const label = raw.trim(); if (!label) return;
    this._life.update({ priorityLevels: this.config().priorityLevels.map((item) => item.id === id ? { ...item, label } : item) });
  }
  removePriority(id: string): void {
    const levels = this.config().priorityLevels.filter((item) => item.id !== id);
    const defaultPriorityId = this.config().defaultPriorityId === id ? (levels[0]?.id ?? null) : this.config().defaultPriorityId;
    this._life.update({ priorityLevels: levels, defaultPriorityId });
  }
  movePriority(index: number, delta: number): void {
    const levels = [...this.config().priorityLevels]; const target = index + delta;
    if (target < 0 || target >= levels.length) return;
    [levels[index], levels[target]] = [levels[target], levels[index]];
    this._life.update({ priorityLevels: levels });
  }
  setDefaultPriority(id: string | null): void { this._life.update({ defaultPriorityId: id }); }

  addContext(key: 'locations' | 'requirements', raw: string): void {
    const label = raw.trim(); if (!label) return;
    const option: LifeContextOption = { id: this._id(key === 'locations' ? 'location' : 'requirement'), label };
    this._life.update({ [key]: [...this.config()[key], option] });
  }
  renameContext(key: 'locations' | 'requirements', id: string, raw: string): void {
    const label = raw.trim(); if (!label) return;
    this._life.update({ [key]: this.config()[key].map((item) => item.id === id ? { ...item, label } : item) });
  }
  removeContext(key: 'locations' | 'requirements', id: string): void {
    this._life.update({ [key]: this.config()[key].filter((item) => item.id !== id) });
  }

  addView(raw: string): void {
    const label = raw.trim(); if (!label) return;
    const view: LifeSmartView = { id: this._id('view'), label, icon: 'filter_alt' };
    this._life.update({ smartViews: [...this.config().smartViews, view] });
  }
  removeView(id: string): void { this._life.update({ smartViews: this.config().smartViews.filter((view) => view.id !== id) }); }
  updateView(id: string, changes: Partial<LifeSmartView>): void {
    this._life.update({ smartViews: this.config().smartViews.map((view) => view.id === id ? { ...view, ...changes } : view) });
  }
  updateViewNumber(id: string, key: 'maxEstimateMinutes' | 'minFocus' | 'maxFocus' | 'minEnergy' | 'maxEnergy', raw: string): void {
    const value = raw ? Number(raw) : null; this.updateView(id, { [key]: value });
  }
  updateViewMulti(id: string, key: 'locationIds' | 'requirementIds' | 'priorityIds', event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.updateView(id, { [key]: Array.from(select.selectedOptions).map((option) => option.value) });
  }
  setWeeklyReviewDay(raw: string): void { this._life.update({ weeklyReviewDay: Number(raw) }); }
  resetDefaults(): void { this._life.update({ ...DEFAULT_LIFE_OS_CONFIG }); }
  private _id(prefix: string): string { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
}
