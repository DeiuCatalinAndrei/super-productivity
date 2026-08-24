import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { DatePickerInputComponent } from '../../ui/date-picker-input/date-picker-input.component';
import { ChipListInputComponent } from '../../ui/chip-list-input/chip-list-input.component';
import { getDbDateStr } from '../../util/get-db-date-str';
import { LifeOsConfig } from './life-os.model';
import { LifeFieldPickerComponent } from './life-field-picker.component';
import { LifeDateActionComponent } from './life-date-action.component';
import {
  LIFE_ENERGY_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  lifeContextPickerOptions,
  lifePriorityPickerOptions,
} from './life-ui.const';

export interface LifeTaskMetaValue {
  priorityId: string | null;
  focus: number | null;
  energy: number | null;
  dueDay: string | null;
  locationIds: string[];
  requirementIds: string[];
  isNextAction: boolean;
  waitingFor: string | null;
  followUpDay: string | null;
  reviewDay: string | null;
  blockedByTaskIds: string[];
}

export interface LifeTaskPickerSuggestion {
  id: string;
  title: string;
}

export const createEmptyLifeTaskMeta = (
  defaultPriorityId: string | null = null,
): LifeTaskMetaValue => ({
  priorityId: defaultPriorityId,
  focus: null,
  energy: null,
  dueDay: null,
  locationIds: [],
  requirementIds: [],
  isNextAction: false,
  waitingFor: null,
  followUpDay: null,
  reviewDay: null,
  blockedByTaskIds: [],
});

@Component({
  selector: 'life-task-fields',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    DatePickerInputComponent,
    ChipListInputComponent,
    LifeFieldPickerComponent,
    LifeDateActionComponent,
  ],
  providers: [provideNativeDateAdapter()],
  host: {
    '[class.compact-host]': 'compact()',
  },
  template: `
    @if (compact()) {
      <div class="life-action-bar">
        <life-field-picker
          label="Priority"
          defaultIcon="priority_high"
          emptyLabel="None"
          [compact]="true"
          [options]="priorityOptions()"
          [value]="value().priorityId || ''"
          (valueChange)="setString('priorityId', $event)"
        />

        <life-date-action
          label="Due"
          icon="event"
          [value]="value().dueDay"
          (valueChange)="setDate('dueDay', $event)"
        />

        <life-field-picker
          label="Focus"
          defaultIcon="psychology"
          emptyLabel="Not set"
          [compact]="true"
          [options]="focusOptions"
          [value]="numberValue(value().focus)"
          (valueChange)="setNumber('focus', $event)"
        />

        <life-field-picker
          label="Energy"
          defaultIcon="bolt"
          emptyLabel="Not set"
          [compact]="true"
          [options]="energyOptions"
          [value]="numberValue(value().energy)"
          (valueChange)="setNumber('energy', $event)"
        />

        <button
          mat-button
          type="button"
          class="action-btn more-btn"
          [class.menu-open]="expanded()"
          (click)="expanded.set(!expanded())"
        >
          <mat-icon>{{ expanded() ? 'expand_less' : 'tune' }}</mat-icon>
          <span>{{ expanded() ? 'Less' : 'More' }}</span>
        </button>
      </div>

      @if (expanded()) {
        <div class="life-action-bar secondary">
          <life-field-picker
            label="Location"
            defaultIcon="place"
            emptyLabel="Anywhere"
            [compact]="true"
            [options]="locationOptions()"
            [values]="value().locationIds"
            [multiple]="true"
            (valueChange)="setMulti('locationIds', $event)"
          />

          <life-field-picker
            label="Requires"
            defaultIcon="build"
            emptyLabel="Anything"
            [compact]="true"
            [options]="requirementOptions()"
            [values]="value().requirementIds"
            [multiple]="true"
            (valueChange)="setMulti('requirementIds', $event)"
          />

          <mat-checkbox
            class="workflow-action"
            [checked]="value().isNextAction"
            (change)="patch({ isNextAction: $event.checked })"
          >
            Next Action
          </mat-checkbox>

          <label
            class="waiting-action"
            [class.has-value]="!!value().waitingFor"
          >
            <mat-icon>hourglass_top</mat-icon>
            <input
              class="waiting-input"
              [value]="value().waitingFor || ''"
              placeholder="Waiting for"
              aria-label="Waiting for"
              (input)="setWaitingFor($any($event.target).value)"
            />
          </label>

          <life-date-action
            label="Follow-up"
            icon="notification_important"
            [value]="value().followUpDay"
            (valueChange)="setDate('followUpDay', $event)"
          />

          <life-date-action
            label="Review"
            icon="rate_review"
            [value]="value().reviewDay"
            (valueChange)="setDate('reviewDay', $event)"
          />
        </div>

        <div class="blocked-picker compact-blocked-picker">
          <chip-list-input
            label="Blocked by task"
            [suggestions]="blockerSuggestions()"
            [model]="value().blockedByTaskIds"
            (addItem)="addBlocker($event)"
            (removeItem)="removeBlocker($event)"
          />
        </div>
      }
    } @else {
      <div class="quick-grid">
        <life-field-picker
          label="Priority"
          defaultIcon="priority_high"
          emptyLabel="None"
          [options]="priorityOptions()"
          [value]="value().priorityId || ''"
          (valueChange)="setString('priorityId', $event)"
        />

        <date-picker-input
          label="Due"
          [ngModel]="value().dueDay"
          (ngModelChange)="setDate('dueDay', $event)"
        />

        <life-field-picker
          label="Focus"
          defaultIcon="psychology"
          emptyLabel="Not set"
          [options]="focusOptions"
          [value]="numberValue(value().focus)"
          (valueChange)="setNumber('focus', $event)"
        />

        <life-field-picker
          label="Energy"
          defaultIcon="bolt"
          emptyLabel="Not set"
          [options]="energyOptions"
          [value]="numberValue(value().energy)"
          (valueChange)="setNumber('energy', $event)"
        />
      </div>

      <div class="more-grid">
        <life-field-picker
          label="Location"
          defaultIcon="place"
          emptyLabel="Anywhere"
          [options]="locationOptions()"
          [values]="value().locationIds"
          [multiple]="true"
          (valueChange)="setMulti('locationIds', $event)"
        />

        <life-field-picker
          label="Requires"
          defaultIcon="build"
          emptyLabel="Anything"
          [options]="requirementOptions()"
          [values]="value().requirementIds"
          [multiple]="true"
          (valueChange)="setMulti('requirementIds', $event)"
        />

        <div class="next-action-wrap">
          <span class="field-label">Workflow</span>
          <mat-checkbox
            [checked]="value().isNextAction"
            (change)="patch({ isNextAction: $event.checked })"
          >
            Next Action
          </mat-checkbox>
        </div>

        <mat-form-field>
          <mat-label>Waiting for</mat-label>
          <input
            matInput
            [value]="value().waitingFor || ''"
            placeholder="Person, reply, event…"
            (input)="setWaitingFor($any($event.target).value)"
          />
        </mat-form-field>

        <date-picker-input
          label="Follow-up"
          [ngModel]="value().followUpDay"
          (ngModelChange)="setDate('followUpDay', $event)"
        />

        <date-picker-input
          label="Review"
          [ngModel]="value().reviewDay"
          (ngModelChange)="setDate('reviewDay', $event)"
        />

        <div class="blocked-picker">
          <chip-list-input
            label="Blocked by task"
            [suggestions]="blockerSuggestions()"
            [model]="value().blockedByTaskIds"
            (addItem)="addBlocker($event)"
            (removeItem)="removeBlocker($event)"
          />
          <small>Search and select tasks by name.</small>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      :host.compact-host {
        display: contents;
      }

      :host.compact-host .life-action-bar {
        display: contents;
      }

      .life-action-bar {
        position: relative;
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
      }

      .life-action-bar.secondary {
        border-top: 1px solid var(--divider-color);
      }

      :host.compact-host .life-action-bar.secondary {
        border-top: 0;
      }

      .life-action-bar > * {
        flex: 0 0 auto;
      }

      .action-btn {
        --mat-button-text-label-text-color: var(--text-color-muted);
        cursor: pointer;
        display: flex !important;
        align-items: center;
        overflow: hidden;
        font-size: 13px;
        min-width: 70px !important;
        min-height: 36px;
        height: 36px;
        flex-shrink: 0;
        padding: 0 var(--s) !important;
        background: transparent;
        border-radius: var(--card-border-radius) !important;
        transition:
          color var(--transition-fast),
          background-color var(--transition-fast);
      }

      .action-btn:hover,
      .action-btn:focus-visible {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-hover);
      }

      .action-btn.menu-open {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-focus);
      }

      .action-btn mat-icon {
        flex-shrink: 0;
        margin-right: var(--s-half);
      }

      .workflow-action {
        min-height: 36px;
        height: 36px;
        padding-inline: var(--s-half);
        color: var(--text-color-muted);
        white-space: nowrap;
        border-radius: var(--card-border-radius);
        flex: 0 0 auto;
      }

      .workflow-action:hover {
        background: var(--state-hover);
        color: var(--text-color-most-intense);
      }

      .waiting-action {
        display: inline-flex;
        align-items: center;
        min-width: 118px;
        height: 36px;
        padding: 0 var(--s);
        box-sizing: border-box;
        border-radius: var(--card-border-radius);
        color: var(--text-color-muted);
        flex: 0 0 auto;
        transition:
          color var(--transition-fast),
          background-color var(--transition-fast);
      }

      .waiting-action:hover,
      .waiting-action:focus-within {
        color: var(--text-color-most-intense);
        background: var(--state-hover);
      }

      .waiting-action.has-value {
        color: var(--text-color-most-intense);
      }

      .waiting-action.has-value mat-icon {
        color: var(--brand);
      }

      .waiting-action mat-icon {
        flex: 0 0 auto;
        margin-right: var(--s-half);
      }

      .waiting-input {
        width: 104px;
        min-width: 72px;
        border: 0;
        outline: 0;
        padding: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
      }

      .waiting-input::placeholder {
        color: var(--text-color-muted);
        opacity: 1;
      }

      .compact-blocked-picker {
        flex: 1 0 100%;
        width: 100%;
        box-sizing: border-box;
        padding: var(--s-half) var(--s) var(--s);
        border-top: 1px solid var(--divider-color);
      }

      .quick-grid,
      .more-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--s);
        align-items: start;
      }

      .more-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: var(--s);
      }

      .next-action-wrap {
        min-width: 0;
      }

      .field-label {
        display: block;
        margin: 0 0 4px 2px;
        color: var(--text-color-muted);
        font-size: 12px;
        line-height: 16px;
      }

      mat-form-field,
      date-picker-input,
      life-field-picker,
      chip-list-input {
        width: 100%;
        min-width: 0;
      }

      .life-action-bar date-picker-input,
      .life-action-bar life-field-picker {
        width: auto;
      }

      .blocked-picker {
        grid-column: 1 / -1;
        min-width: 0;
      }

      .blocked-picker small {
        display: block;
        margin-top: 2px;
        color: var(--text-color-muted);
        font-size: 11px;
      }

      @media (max-width: 900px) {
        .quick-grid,
        .more-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .blocked-picker {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 600px) {
        .action-btn,
        .waiting-input {
          font-size: 12px;
        }
      }

      @media (max-width: 520px) {
        .quick-grid,
        .more-grid {
          grid-template-columns: 1fr;
        }

        .blocked-picker {
          grid-column: auto;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeTaskFieldsComponent {
  readonly config = input.required<LifeOsConfig>();
  readonly value = input.required<LifeTaskMetaValue>();
  readonly blockerSuggestions = input<LifeTaskPickerSuggestion[]>([]);
  readonly compact = input(false);
  readonly valueChange = output<LifeTaskMetaValue>();

  readonly expanded = signal(false);
  readonly focusOptions = LIFE_FOCUS_OPTIONS;
  readonly energyOptions = LIFE_ENERGY_OPTIONS;
  readonly priorityOptions = computed(() => lifePriorityPickerOptions(this.config()));
  readonly locationOptions = computed(() =>
    lifeContextPickerOptions(this.config().locations, 'place'),
  );
  readonly requirementOptions = computed(() =>
    lifeContextPickerOptions(this.config().requirements, 'build'),
  );

  numberValue(value: number | null): string {
    return value == null ? '' : String(value);
  }

  setString(key: 'priorityId', raw: string | string[]): void {
    const value = Array.isArray(raw) ? raw[0] || '' : raw;
    this.patch({ [key]: value || null });
  }

  setNumber(key: 'focus' | 'energy', raw: string | string[]): void {
    const value = Array.isArray(raw) ? raw[0] || '' : raw;
    this.patch({ [key]: value ? Number(value) : null });
  }

  setMulti(key: 'locationIds' | 'requirementIds', raw: string | string[]): void {
    this.patch({ [key]: Array.isArray(raw) ? raw : raw ? [raw] : [] });
  }

  setDate(key: 'dueDay' | 'followUpDay' | 'reviewDay', raw: Date | null): void {
    this.patch({ [key]: raw ? getDbDateStr(raw) : null });
  }

  setWaitingFor(raw: string): void {
    const waitingFor = raw.trim() || null;
    this.patch({
      waitingFor,
      ...(waitingFor ? {} : { followUpDay: null }),
    });
  }

  addBlocker(id: string): void {
    if (!this.value().blockedByTaskIds.includes(id)) {
      this.patch({ blockedByTaskIds: [...this.value().blockedByTaskIds, id] });
    }
  }

  removeBlocker(id: string): void {
    this.patch({
      blockedByTaskIds: this.value().blockedByTaskIds.filter((value) => value !== id),
    });
  }

  patch(changes: Partial<LifeTaskMetaValue>): void {
    this.valueChange.emit({ ...this.value(), ...changes });
  }
}
