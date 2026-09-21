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
  template: \`
    @if (networking.dueContacts().length) {
      <mat-card class="networking-today-card">
        <mat-card-content>
          <div class="head">
            <div class="title">
              <span class="emoji">🤝</span>
              <div>
                <strong>Networking</strong>
                <small>Persoane cu care e timpul să reiei legătura.</small>
              </div>
            </div>
            <a mat-button routerLink="/networking">
              Vezi toate
              <mat-icon>arrow_forward</mat-icon>
            </a>
          </div>

          <div class="contact-list">
            @for (contact of networking.dueContacts().slice(0, 6); track contact.id) {
              <a
                class="contact-row"
                routerLink="/networking"
                [queryParams]="{ contact: contact.id }"
              >
                <span class="status-icon" [class.overdue]="contact.nextContactDay && contact.nextContactDay < today">
                  <mat-icon>{{
                    contact.nextContactDay === today ? 'today' : 'notification_important'
                  }}</mat-icon>
                </span>

                <span class="who">
                  <span class="name-line">
                    <strong>{{ contact.name }}</strong>
                    <span
                      class="date"
                      [class.overdue]="contact.nextContactDay && contact.nextContactDay < today"
                    >
                      {{ contact.nextContactDay === today ? 'Azi' : contact.nextContactDay }}
                    </span>
                  </span>
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
                </span>

                <mat-icon class="chevron">chevron_right</mat-icon>
              </a>
            }
          </div>

          @if (networking.dueContacts().length > 6) {
            <div class="more-note">
              +{{ networking.dueContacts().length - 6 }} persoane de contactat
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  \`,
  styles: [
    \`
      :host {
        display: block;
        grid-column: 1 / -1;
      }

      .networking-today-card {
        box-shadow: none !important;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius) !important;
        background: var(--task-detail-bg) !important;
      }

      .head,
      .title,
      .contact-row,
      .who,
      .name-line {
        display: flex;
        align-items: center;
      }

      .head {
        justify-content: space-between;
        gap: var(--s);
        margin-bottom: var(--s-half);
      }

      .title {
        min-width: 0;
        gap: var(--s-half);
      }

      .title > div {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }

      .title small,
      .who small,
      .topic,
      .more-note {
        color: var(--text-color-muted);
      }

      .emoji {
        font-size: 22px;
      }

      .contact-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .contact-row {
        min-height: 54px;
        gap: var(--s-half);
        border: 1px solid transparent;
        border-radius: var(--card-border-radius);
        color: inherit;
        padding: var(--s-half);
        text-decoration: none;
        transition: var(--transition-standard);
      }

      .contact-row:hover {
        border-color: var(--divider-color);
        background: var(--task-detail-bg-hover);
      }

      .status-icon {
        display: inline-flex;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--divider-color);
        border-radius: 50%;
        color: var(--c-accent);
      }

      .status-icon.overdue {
        color: var(--c-warn);
      }

      .status-icon mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .who {
        min-width: 0;
        flex: 1;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
      }

      .name-line {
        min-width: 0;
        justify-content: space-between;
        gap: var(--s-half);
      }

      .name-line strong,
      .who small,
      .topic {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .date {
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--bg-lighter);
        padding: 2px 7px;
        color: var(--c-accent);
        font-size: 10px;
        font-weight: 700;
      }

      .date.overdue {
        color: var(--c-warn);
      }

      .topic {
        font-size: 11px;
      }

      .chevron {
        flex: 0 0 auto;
        opacity: 0.35;
      }

      .more-note {
        margin-top: var(--s-half);
        text-align: center;
        font-size: 10px;
      }

      @media (max-width: 600px) {
        .head {
          align-items: flex-start;
        }

        .title small {
          display: none;
        }

        .topic {
          display: none;
        }

        .date {
          display: none;
        }

        .contact-row {
          min-height: 48px;
        }
      }
    \`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingTodayComponent {
  readonly networking = inject(NetworkingService);
  readonly today = getDbDateStr();
}
