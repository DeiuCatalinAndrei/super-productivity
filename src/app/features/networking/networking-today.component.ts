import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NetworkingService } from './networking.service';
import { getDbDateStr } from '../../util/get-db-date-str';

@Component({
  selector: 'life-networking-today',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    @if (networking.dueContacts().length) {
      <mat-card>
        <mat-card-content>
          <div class="head">
            <div class="title">
              <mat-icon>group</mat-icon>
              <strong>Networking</strong>
              <span>{{ networking.dueContacts().length }}</span>
            </div>
            <a
              mat-button
              routerLink="/networking"
            >
              All contacts
            </a>
          </div>

          @for (contact of networking.dueContacts().slice(0, 6); track contact.id) {
            <a
              class="contact-row"
              routerLink="/networking"
              [queryParams]="{ contact: contact.id }"
            >
              <div class="who">
                <strong>{{ contact.name }}</strong>
                <small>
                  @if (contact.occupation) {
                    {{ contact.occupation }}
                  }
                  @if (contact.company) {
                    · {{ contact.company }}
                  }
                  @if (contact.city) {
                    · {{ contact.city }}
                  }
                </small>
              </div>
              @if (contact.nextTopic) {
                <span class="topic">{{ contact.nextTopic }}</span>
              }
              <span
                class="date"
                [class.overdue]="
                  contact.nextContactDay && contact.nextContactDay < today
                "
                >{{ contact.nextContactDay }}</span
              >
              <mat-icon>chevron_right</mat-icon>
            </a>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        grid-column: 1 / -1;
      }
      .head,
      .title,
      .contact-row,
      .who {
        display: flex;
        align-items: center;
      }
      .head {
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .title {
        gap: 7px;
      }
      .title span {
        opacity: 0.55;
        font-size: 0.8rem;
      }
      .contact-row {
        gap: 9px;
        min-height: 44px;
        padding: 7px 5px;
        border-radius: 7px;
        color: inherit;
        text-decoration: none;
      }
      .contact-row:hover {
        background: rgba(127, 127, 127, 0.1);
      }
      .who {
        flex: 1;
        min-width: 160px;
        flex-direction: column;
        align-items: flex-start;
      }
      .who small {
        opacity: 0.58;
      }
      .topic {
        max-width: 42%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.72;
      }
      .date {
        font-size: 0.75rem;
        opacity: 0.68;
      }
      .date.overdue {
        font-weight: 700;
        opacity: 1;
      }
      @media (max-width: 600px) {
        .topic {
          display: none;
        }
        .who {
          min-width: 0;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingTodayComponent {
  readonly networking = inject(NetworkingService);
  readonly today = getDbDateStr();
}
