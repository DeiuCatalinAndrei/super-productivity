import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { SelectOptionRowComponent } from '../../ui/select-option-row/select-option-row.component';
import { LifePickerOption } from './life-ui.const';

@Component({
  selector: 'life-field-picker',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, SelectOptionRowComponent],
  template: `
    <div class="field-shell">
      <span class="field-label">{{ label() }}</span>
      <button
        mat-button
        type="button"
        class="picker-btn"
        [class.has-value]="selectedOptions().length > 0"
        [matMenuTriggerFor]="pickerMenu"
      >
        @if (selectedOptions()[0]; as selected) {
          <mat-icon
            class="leading-icon"
            [class.dot-icon]="selected.icon === 'circle'"
            [style.color]="selected.color || null"
            >{{ selected.icon || defaultIcon() }}</mat-icon
          >
          <span class="picker-value">{{ selected.label }}</span>
          @if (multiple() && selectedOptions().length > 1) {
            <span class="more-count">+{{ selectedOptions().length - 1 }}</span>
          }
        } @else {
          <mat-icon class="leading-icon">{{ defaultIcon() }}</mat-icon>
          <span class="picker-value muted">{{ emptyLabel() }}</span>
        }
        <mat-icon class="chevron">arrow_drop_down</mat-icon>
      </button>
    </div>

    <mat-menu #pickerMenu="matMenu">
      @if (multiple()) {
        <div (click)="$event.stopPropagation()">
          @for (option of options(); track option.id) {
            <button
              mat-menu-item
              type="button"
              [class.selected]="isSelected(option.id)"
              (click)="toggle(option.id)"
            >
              <select-option-row
                [title]="option.label"
                [icon]="option.icon"
                [defaultIcon]="defaultIcon()"
                [color]="option.color"
                [isSelected]="isSelected(option.id)"
                [showCheckbox]="true"
              />
            </button>
          }
        </div>
      } @else {
        @if (allowEmpty()) {
          <button
            mat-menu-item
            type="button"
            (click)="selectSingle('')"
          >
            <select-option-row
              [title]="emptyLabel()"
              [defaultIcon]="defaultIcon()"
              [isSelected]="!value()"
              [showCheckbox]="true"
            />
          </button>
        }
        @for (option of options(); track option.id) {
          <button
            mat-menu-item
            type="button"
            [class.selected]="value() === option.id"
            (click)="selectSingle(option.id)"
          >
            <select-option-row
              [title]="option.label"
              [icon]="option.icon"
              [defaultIcon]="defaultIcon()"
              [color]="option.color"
              [isSelected]="value() === option.id"
              [showCheckbox]="true"
            />
          </button>
        }
      }
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .field-shell {
        min-width: 0;
      }

      .field-label {
        display: block;
        margin: 0 0 4px 2px;
        color: var(--text-color-muted);
        font-size: 12px;
        line-height: 16px;
      }

      .picker-btn {
        --mat-button-text-label-text-color: var(--text-color-muted);
        width: 100%;
        min-width: 0;
        min-height: 42px;
        padding-inline: var(--s) !important;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius) !important;
        background: var(--bg-lighter);
        justify-content: flex-start;
        transition:
          background-color var(--transition-fast),
          border-color var(--transition-fast),
          color var(--transition-fast);
      }

      .picker-btn:hover,
      .picker-btn:focus-visible {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-hover);
        border-color: var(--text-color-muted);
      }

      .picker-btn.has-value {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
      }

      .picker-btn ::ng-deep .mdc-button__label {
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 0;
      }

      .leading-icon {
        flex: 0 0 auto;
        margin-inline-end: var(--s-half);
      }

      .leading-icon.dot-icon {
        width: 12px;
        height: 12px;
        font-size: 12px;
      }

      .picker-value {
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: start;
      }

      .picker-value.muted {
        color: var(--text-color-muted);
      }

      .more-count {
        flex: 0 0 auto;
        margin-inline-start: var(--s-half);
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--state-hover);
        font-size: 11px;
      }

      .chevron {
        flex: 0 0 auto;
        margin: 0 0 0 var(--s-half) !important;
        color: var(--text-color-muted);
      }

      @media (max-width: 600px) {
        .picker-btn {
          min-height: 48px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeFieldPickerComponent {
  readonly label = input.required<string>();
  readonly options = input<LifePickerOption[]>([]);
  readonly value = input<string | null>('');
  readonly values = input<string[]>([]);
  readonly multiple = input(false);
  readonly allowEmpty = input(true);
  readonly emptyLabel = input('Any');
  readonly defaultIcon = input('tune');
  readonly valueChange = output<string | string[]>();

  readonly selectedOptions = computed(() => {
    const options = this.options();
    if (this.multiple()) {
      const ids = new Set(this.values());
      return options.filter((option) => ids.has(option.id));
    }
    const selectedId = this.value();
    return selectedId ? options.filter((option) => option.id === selectedId) : [];
  });

  isSelected(id: string): boolean {
    return this.multiple() ? this.values().includes(id) : this.value() === id;
  }

  selectSingle(id: string): void {
    this.valueChange.emit(id);
  }

  toggle(id: string): void {
    const current = this.values();
    this.valueChange.emit(
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
}
