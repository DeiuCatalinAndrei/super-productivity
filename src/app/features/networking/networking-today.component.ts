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
              <span class="network-emoji">🤝</span>
              <div>
                <strong>Networking</strong>
                <small>Persoane cu care e momentul să reiei legătura</small>
              </div>
              <span class="count">{{ networking.dueContacts().length }}</span>
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
              <span
                class="status-dot"
                [class.overdue]="contact.nextContactDay && contact.nextContactDay < today"
              ></span>
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
                @if (contact.nextTopic) {
                  <span class="topic">💬 {{ contact.nextTopic }}</span>
                }
              </div>
              <span
                class="date"
                [class.overdue]="contact.nextContactDay && contact.nextContactDay < today"
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
        gap: 8px;
      }
      .title > div {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .title small {
        opacity: 0.55;
        font-size: 0.67rem;
        font-weight: 400;
      }
      .network-emoji {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 9px;
        background: rgba(127, 127, 127, 0.1);
        font-size: 1rem;
      }
      .count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 5px;
        border-radius: 999px;
        background: rgba(127, 127, 127, 0.12);
        opacity: 0.75;
        font-size: 0.7rem;
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
        gap: 2px;
      }
      .status-dot {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--c-accent);
      }
      .status-dot.overdue {
        background: var(--c-warn);
      }
      .who small {
        opacity: 0.58;
      }
      .topic {
        display: block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.72;
        font-size: 0.7rem;
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
          max-width: 100%;
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
