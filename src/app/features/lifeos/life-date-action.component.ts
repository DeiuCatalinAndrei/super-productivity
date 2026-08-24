import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { DateTimePickerComponent } from '../../ui/datetime-picker/datetime-picker.component';
import { dateStrToUtcDate } from '../../util/date-str-to-utc-date';
import { getNextWeekDayOffset } from '../../util/get-next-week-day-offset';

type QuickDate = 'today' | 'tomorrow' | 'nextWeek' | 'nextMonth';

@Component({
  selector: 'life-date-action',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslatePipe,
    DateTimePickerComponent,
  ],
  providers: [provideNativeDateAdapter()],
  template: `
    <button
      mat-button
      type="button"
      class="action-btn"
      [class.has-value]="!!value()"
      (click)="open()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
      <span>{{ value() || label() }}</span>
    </button>

    <ng-template #dateDialog>
      <mat-dialog-content class="life-date-dialog">
        <datetime-picker
          [selectedDate]="selectedDate()"
          [minDate]="minDate"
          [showQuickAccess]="true"
          quickAccessTranslationPrefix="F.TASK.D_DEADLINE"
          (dateSelected)="selectedDate.set($event)"
          (quickAccessClick)="onQuickAccessClick($event)"
          (enterSubmit)="submit()"
        ></datetime-picker>

        <div class="dialog-actions-and-warnings">
          <mat-dialog-actions align="end">
            <button
              mat-button
              type="button"
              (click)="close()"
            >
              <span class="action-label">{{ T.G.CANCEL | translate }}</span>
            </button>
            <button
              color="primary"
              mat-flat-button
              type="button"
              [disabled]="!selectedDate()"
              (click)="submit()"
            >
              <mat-icon>event_available</mat-icon>
              <span class="action-label">Set {{ label() }}</span>
            </button>
          </mat-dialog-actions>
        </div>
      </mat-dialog-content>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .action-btn {
        --mat-button-text-label-text-color: var(--text-color-muted);
        cursor: pointer;
        display: flex !important;
        align-items: center;
        min-width: 70px !important;
        min-height: 36px;
        height: 36px;
        padding: 0 var(--s) !important;
        border-radius: var(--card-border-radius) !important;
        background: transparent;
        font-size: 13px;
        flex: 0 0 auto;
        transition:
          color var(--transition-fast),
          background-color var(--transition-fast);
      }

      .action-btn:hover,
      .action-btn:focus-visible {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
        background: var(--state-hover);
      }

      .action-btn.has-value {
        --mat-button-text-label-text-color: var(--text-color-most-intense);
      }

      .action-btn.has-value mat-icon {
        color: var(--brand);
      }

      .action-btn mat-icon {
        flex: 0 0 auto;
        margin-right: var(--s-half);
      }

      .action-btn span {
        min-width: 0;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      ::ng-deep .life-date-dialog {
        position: relative;
        padding: 0 !important;
        max-height: calc(
          100vh - 64px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
        ) !important;
      }

      ::ng-deep .life-date-dialog datetime-picker .form-ctrl-wrapper {
        display: none !important;
      }

      ::ng-deep .life-date-dialog .dialog-actions-and-warnings {
        margin: 0 var(--s2) var(--s2);
      }

      ::ng-deep .life-date-dialog mat-dialog-actions {
        padding: 0 0 var(--s2) 0 !important;
        row-gap: calc(var(--s) + var(--s-half));
      }

      ::ng-deep .life-date-dialog .action-label {
        white-space: nowrap;
      }

      @media (max-width: 600px) {
        .action-btn {
          font-size: 12px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeDateActionComponent {
  readonly T = T;
  readonly label = input.required<string>();
  readonly icon = input('event');
  readonly value = input<string | null>(null);
  readonly valueChange = output<Date>();
  readonly selectedDate = signal<Date | null>(null);
  readonly minDate = new Date(1900, 0, 1);

  private readonly _dialog = inject(MatDialog);
  private readonly _dateAdapter = inject(DateAdapter);
  private readonly _dialogTemplate = viewChild<TemplateRef<unknown>>('dateDialog');
  private _dialogRef: MatDialogRef<unknown> | null = null;

  open(): void {
    const template = this._dialogTemplate();
    if (!template) return;

    const currentValue = this.value();
    this.selectedDate.set(currentValue ? dateStrToUtcDate(currentValue) : null);
    this._dialogRef = this._dialog.open(template, {
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'life-date-dialog-panel',
    });

    this._dialogRef.afterClosed().subscribe((result) => {
      if (result instanceof Date) {
        this.valueChange.emit(result);
      }
      this._dialogRef = null;
    });
  }

  close(): void {
    this._dialogRef?.close();
  }

  submit(): void {
    const date = this.selectedDate();
    if (date) {
      this._dialogRef?.close(date);
    }
  }

  onQuickAccessClick(option: QuickDate): void {
    this.selectedDate.set(this._getQuickDate(option));
    this.submit();
  }

  private _getQuickDate(option: QuickDate): Date {
    const date = new Date();
    date.setMinutes(0, 0, 0);

    switch (option) {
      case 'today':
        return date;
      case 'tomorrow':
        date.setDate(date.getDate() + 1);
        return date;
      case 'nextWeek': {
        const dayOffset = getNextWeekDayOffset(this._dateAdapter, date);
        date.setDate(date.getDate() + dayOffset);
        return date;
      }
      case 'nextMonth':
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        return date;
    }
  }
}
