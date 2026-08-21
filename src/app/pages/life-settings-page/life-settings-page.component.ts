import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterModule } from '@angular/router';
import { DEFAULT_LIFE_OS_CONFIG } from '../../features/lifeos/life-os.const';
import { LifeOsConfigService } from '../../features/lifeos/life-os-config.service';
import {
  LifeContextOption,
  LifePriorityLevel,
  LifeSmartView,
} from '../../features/lifeos/life-os.model';
import { LifeFieldPickerComponent } from '../../features/lifeos/life-field-picker.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  LifePickerOption,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from '../../features/lifeos/life-ui.const';

@Component({
  selector: 'life-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    LifeFieldPickerComponent,
  ],
  template: `
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeSettingsPageComponent {
  private readonly _life = inject(LifeOsConfigService);
  readonly config = this._life.config;
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
  readonly weekDays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  addPriority(raw: string): void {
    const label = raw.trim();
    if (!label) return;
    const level: LifePriorityLevel = { id: this._id('priority'), label };
    this._life.update({ priorityLevels: [...this.config().priorityLevels, level] });
  }
  renamePriority(id: string, raw: string): void {
    const label = raw.trim();
    if (!label) return;
    this._life.update({
      priorityLevels: this.config().priorityLevels.map((item) =>
        item.id === id ? { ...item, label } : item,
      ),
    });
  }
  removePriority(id: string): void {
    const levels = this.config().priorityLevels.filter((item) => item.id !== id);
    const defaultPriorityId =
      this.config().defaultPriorityId === id
        ? (levels[0]?.id ?? null)
        : this.config().defaultPriorityId;
    this._life.update({ priorityLevels: levels, defaultPriorityId });
  }
  movePriority(index: number, delta: number): void {
    const levels = [...this.config().priorityLevels];
    const target = index + delta;
    if (target < 0 || target >= levels.length) return;
    [levels[index], levels[target]] = [levels[target], levels[index]];
    this._life.update({ priorityLevels: levels });
  }
  setDefaultPriority(id: string | null): void {
    this._life.update({ defaultPriorityId: id });
  }

  addContext(key: 'locations' | 'requirements', raw: string): void {
    const label = raw.trim();
    if (!label) return;
    const option: LifeContextOption = {
      id: this._id(key === 'locations' ? 'location' : 'requirement'),
      label,
    };
    this._life.update({ [key]: [...this.config()[key], option] });
  }
  renameContext(key: 'locations' | 'requirements', id: string, raw: string): void {
    const label = raw.trim();
    if (!label) return;
    this._life.update({
      [key]: this.config()[key].map((item) =>
        item.id === id ? { ...item, label } : item,
      ),
    });
  }
  removeContext(key: 'locations' | 'requirements', id: string): void {
    this._life.update({ [key]: this.config()[key].filter((item) => item.id !== id) });
  }

  addView(raw: string): void {
    const label = raw.trim();
    if (!label) return;
    const view: LifeSmartView = { id: this._id('view'), label, icon: 'filter_alt' };
    this._life.update({ smartViews: [...this.config().smartViews, view] });
  }
  removeView(id: string): void {
    this._life.update({
      smartViews: this.config().smartViews.filter((view) => view.id !== id),
    });
  }
  updateView(id: string, changes: Partial<LifeSmartView>): void {
    this._life.update({
      smartViews: this.config().smartViews.map((view) =>
        view.id === id ? { ...view, ...changes } : view,
      ),
    });
  }
  updateViewNumber(
    id: string,
    key: 'maxEstimateMinutes' | 'minFocus' | 'maxFocus' | 'minEnergy' | 'maxEnergy',
    raw: string | string[],
  ): void {
    const rawValue = this.singleValue(raw);
    const value = rawValue ? Number(rawValue) : null;
    this.updateView(id, { [key]: value });
  }
  updateViewMulti(
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
  resetDefaults(): void {
    this._life.update({ ...DEFAULT_LIFE_OS_CONFIG });
  }
  private _id(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
