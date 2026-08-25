import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DialogDeadlineComponent } from '../tasks/dialog-deadline/dialog-deadline.component';

@Component({
  selector: 'life-date-action',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
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
  readonly label = input.required<string>();
  readonly icon = input('event');
  readonly value = input<string | null>(null);
  readonly valueChange = output<Date>();

  private readonly _dialog = inject(MatDialog);

  open(): void {
    const dialogRef = this._dialog.open(DialogDeadlineComponent, {
      data: {
        targetDeadlineDay: this.value() || undefined,
        isSelectDeadlineOnly: true,
        isDateOnly: true,
        selectDateLabel: `Set ${this.label()}`,
        minDate: new Date(1900, 0, 1),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.date instanceof Date) {
        this.valueChange.emit(result.date);
      }
    });
  }
}
