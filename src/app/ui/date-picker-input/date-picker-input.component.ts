import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatFormField,
  MatLabel,
  MatError,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import {
  MatDatepicker,
  MatDatepickerInput,
  MatDatepickerToggle,
} from '@angular/material/datepicker';
import { CommonModule } from '@angular/common';
import { DateTimeFormatService } from 'src/app/core/date-time-format/date-time-format.service';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from 'src/app/t.const';
import { getDbDateStr } from 'src/app/util/get-db-date-str';
import { dateStrToUtcDate } from 'src/app/util/date-str-to-utc-date';

type DateValue = Date | null;

export const DATE_PICKER_MIN_DEFAULT = '1900-01-01';
export const DATE_PICKER_MAX_DEFAULT = '2999-12-31';

@Component({
  selector: 'date-picker-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormField,
    MatLabel,
    MatIconModule,
    MatInput,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatSuffix,
    MatDatepicker,
    MatError,
    TranslatePipe,
  ],
  templateUrl: './date-picker-input.component.html',
  styles: [
    `
      :host.compact-host,
      .compact-wrap {
        display: inline-flex;
        min-width: 0;
      }

      .compact-date-input {
        position: fixed;
        inline-size: 1px;
        block-size: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .compact-date-btn {
        --mat-button-text-label-text-color: var(--text-color-muted);
        min-width: 70px !important;
        min-height: 36px;
        height: 36px;
        padding: 0 var(--s) !important;
        border-radius: var(--card-border-radius) !important;
        background: transparent;
        font-size: 13px;
        flex-shrink: 0;
        transition:
          color var(--transition-fast),
          background-color var(--transition-fast);
      }

      .compact-date-btn:hover,
      .compact-date-btn:focus-visible {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-hover);
      }

      .compact-date-btn.has-value {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
      }

      .compact-date-btn.has-value mat-icon {
        color: var(--brand);
      }

      .compact-date-btn mat-icon {
        flex-shrink: 0;
        margin-right: var(--s-half);
      }

      .compact-date-btn span {
        min-width: 0;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: 600px) {
        .compact-date-btn {
          font-size: 12px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerInputComponent),
      multi: true,
    },
  ],
})
export class DatePickerInputComponent implements ControlValueAccessor {
  readonly T: typeof T = T;
  dateTimeFormatService = inject(DateTimeFormatService);

  label = input<string>('');
  min = input<Date | string | undefined>(DATE_PICKER_MIN_DEFAULT);
  max = input<Date | string | undefined>(DATE_PICKER_MAX_DEFAULT);
  compact = input(false);
  compactIcon = input('event');

  required = input<boolean>(false);
  isInvalid = input<boolean | undefined>(undefined); // boolean - validation control by parent, undefined - internal validation
  errorMessage = input<string | undefined>(undefined); // instead of default error message

  innerValue = signal<DateValue>(null);
  private _cd = inject(ChangeDetectorRef);

  toDate(value: Date | string): Date {
    // Parse YYYY-MM-DD strings to LOCAL midnight (via dateStrToUtcDate),
    // matching both writeValue's parsing and the MatDatepicker's
    // local-midnight selections. `new Date('2026-05-29')` would parse as UTC
    // midnight instead, so in positive-offset timezones a selection equal to a
    // string `min` (e.g. today) compares as "before min" and gets silently
    // rejected (#7768 regression: "can't set start date to today").
    return value instanceof Date ? value : dateStrToUtcDate(value);
  }

  formatDate(value: Date | string | undefined): string {
    if (!value) return '';
    return getDbDateStr(this.toDate(value));
  }

  compactDisplay(): string {
    const value = this.innerValue();
    return value ? getDbDateStr(value) : this.label();
  }

  validateDate(value: Date): boolean {
    const minVal = this.min();
    const maxVal = this.max();
    if (minVal != null) {
      const minDate = this.toDate(minVal);
      if (!isNaN(minDate.getTime()) && value < minDate) return false;
    }
    if (maxVal != null) {
      const maxDate = this.toDate(maxVal);
      if (!isNaN(maxDate.getTime()) && value > maxDate) return false;
    }
    return true;
  }

  writeValue(value: unknown): void {
    if (!value) {
      this.innerValue.set(null);
    } else if (value instanceof Date) {
      this.innerValue.set(value);
    } else if (typeof value === 'string') {
      const parsed = dateStrToUtcDate(value);
      this.innerValue.set(isNaN(parsed.getTime()) ? null : parsed);
    } else {
      this.innerValue.set(null);
    }
    this._cd.markForCheck();
  }

  onValueChange(value: DateValue): void {
    if (!value) {
      this.innerValue.set(null);
      this.onChange(null);
      this.onTouched();
      return;
    }

    if (!this.validateDate(value)) {
      this.innerValue.set(null);
      this.onChange(null);
    } else {
      this.innerValue.set(value);
      this.onChange(value);
    }
    this.onTouched();
  }

  private onChange: (value: DateValue) => void = () => {};

  private onTouched: () => void = () => {};

  registerOnChange(fn: (value: DateValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
