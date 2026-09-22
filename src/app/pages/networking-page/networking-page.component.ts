import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { getDbDateStr } from '../../util/get-db-date-str';
import {
  NETWORK_CADENCE_OPTIONS,
  NETWORK_CHANNEL_OPTIONS,
  NETWORK_IMPORTANCE_OPTIONS,
  NETWORK_RELATIONSHIP_OPTIONS,
  NetworkContact,
  NetworkContactCadence,
  NetworkImportance,
  NetworkInteraction,
  NetworkInteractionChannel,
  NetworkRelationshipType,
} from '../../features/networking/networking.model';
import {
  NetworkContactInput,
  NetworkInteractionInput,
  NetworkingService,
} from '../../features/networking/networking.service';
import {
  addCalendarDays,
  getNextContactDay,
  timestampToLocalDay,
} from '../../features/networking/networking.util';
import { TaskDetailItemComponent } from '../../features/tasks/task-detail-panel/task-additional-info-item/task-detail-item.component';
import { DialogDeadlineComponent } from '../../features/tasks/dialog-deadline/dialog-deadline.component';

type NetworkingFilter = 'ALL' | 'DUE' | 'UPCOMING' | 'NO_REMINDER' | 'ARCHIVED';
type ReconnectChoice = 'DEFAULT' | '3D' | '7D' | '14D' | '1M' | 'CUSTOM';
interface ContactDraft {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  city: string;
  region: string;
  country: string;
  occupation: string;
  role: string;
  company: string;
  industry: string;
  metThrough: string;
  introducedByContactId: string;
  metAt: string;
  metOn: string;
  relationshipType: NetworkRelationshipType;
  importance: NetworkImportance;
  tags: string;
  interests: string;
  canHelpWith: string;
  canHelpMeWith: string;
  notes: string;
  cadence: NetworkContactCadence;
  cadenceDays: string;
  nextContactDay: string;
  nextTopic: string;
}

interface InteractionDraft {
  at: string;
  channel: NetworkInteractionChannel;
  channelCustom: string;
  location: string;
  summary: string;
  learned: string;
  iPromised: string;
  theyPromised: string;
  nextStep: string;
  nextTopic: string;
  nextContactDay: string;
  followUpTitle: string;
  followUpDueDay: string;
}

@Component({
  selector: 'networking-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TaskDetailItemComponent,
  ],
  template: `
    <main class="networking-page">
      <header class="page-head">
        <div>
          <h1>Networking</h1>
          <p>
            Păstrează contextul relațiilor, istoricul conversațiilor și momentul potrivit
            pentru a lua din nou legătura.
          </p>
        </div>
        <div class="page-actions">
          <button
            mat-button
            (click)="startInteraction()"
          >
            <mat-icon>forum</mat-icon>
            Am vorbit
          </button>
          <button
            mat-flat-button
            color="primary"
            (click)="startNewContact()"
          >
            <mat-icon>person_add</mat-icon>
            Adaugă persoană
          </button>
        </div>
      </header>

      <section class="summary-grid">
        <button
          class="summary-card"
          [class.active]="filter() === 'DUE'"
          (click)="filter.set('DUE')"
        >
          <mat-icon>notifications_active</mat-icon>
          <strong>{{ networking.dueContacts().length }}</strong>
          <span>De contactat</span>
        </button>
        <button
          class="summary-card"
          (click)="filter.set('DUE')"
        >
          <mat-icon>today</mat-icon>
          <strong>{{ networking.todayContacts().length }}</strong>
          <span>Astăzi</span>
        </button>
        <button
          class="summary-card"
          [class.active]="filter() === 'UPCOMING'"
          (click)="filter.set('UPCOMING')"
        >
          <mat-icon>event_upcoming</mat-icon>
          <strong>{{ networking.upcomingContacts().length }}</strong>
          <span>Următoarele 7 zile</span>
        </button>
        <button
          class="summary-card"
          [class.active]="filter() === 'ALL'"
          (click)="filter.set('ALL')"
        >
          <mat-icon>groups</mat-icon>
          <strong>{{ networking.contacts().length }}</strong>
          <span>Persoane active</span>
        </button>
      </section>

      <section
        class="workspace"
        [class.panel-open]="panelOpen()"
      >
        <aside class="people-panel">
          <div class="search-row">
            <label class="search-box">
              <mat-icon>search</mat-icon>
              <input
                type="search"
                placeholder="Caută nume, oraș, ocupație, discuții..."
                [ngModel]="query()"
                (ngModelChange)="query.set($event)"
              />
            </label>
          </div>

          <nav class="filters">
            @for (item of filters; track item.id) {
              <button
                type="button"
                [class.active]="filter() === item.id"
                (click)="filter.set(item.id)"
              >
                {{ item.label }}
                <span>{{ filterCount(item.id) }}</span>
              </button>
            }
          </nav>

          <div class="people-list">
            @if (filter() === 'ALL' && !query().trim()) {
              @for (group of groupedContacts(); track group.id) {
                @if (group.contacts.length) {
                  <section class="people-group">
                    <header class="people-group-head">
                      <span class="group-emoji">{{ group.emoji }}</span>
                      <strong>{{ group.label }}</strong>
                      <span>{{ group.contacts.length }}</span>
                    </header>
                    @for (contact of group.contacts; track contact.id) {
                      <button
                        class="person-row"
                        [class.selected]="selectedId() === contact.id"
                        [class.due]="isDue(contact)"
                        (click)="selectContact(contact.id)"
                      >
                        <span
                          class="person-status-dot"
                          [class.overdue]="
                            contact.nextContactDay && contact.nextContactDay < today
                          "
                        ></span>
                        <span class="person-main">
                          <span class="person-top">
                            <strong>{{ contact.name }}</strong>
                            @if (contact.nextContactDay) {
                              <span
                                class="contact-date"
                                [class.overdue]="contact.nextContactDay < today"
                              >
                                {{ contact.nextContactDay }}
                              </span>
                            }
                          </span>
                          <span class="person-meta">
                            <span>{{ relationshipLabel(contact.relationshipType) }}</span>
                            @if (contact.occupation) {
                              <span>· {{ contact.occupation }}</span>
                            }
                            @if (contact.company) {
                              <span>· {{ contact.company }}</span>
                            }
                          </span>
                          @if (latestInteractionFor(contact.id); as last) {
                            <span class="person-last">
                              <span class="channel-emoji">{{
                                channelIcon(last.channel)
                              }}</span>
                              {{ channelDisplayLabel(last) }} ·
                              {{ relativeTimeLabel(last.at) }}
                            </span>
                          } @else {
                            <span class="person-last muted">Nicio conversație încă</span>
                          }
                          <span
                            class="person-next"
                            [class.overdue]="
                              contact.nextContactDay && contact.nextContactDay < today
                            "
                            [class.due-now]="contact.nextContactDay === today"
                          >
                            {{ nextContactLabel(contact) }}
                          </span>
                          @if (contact.nextTopic) {
                            <small class="person-topic">💬 {{ contact.nextTopic }}</small>
                          }
                          @if (contact.tags.length) {
                            <span class="chips">
                              @for (tag of contact.tags.slice(0, 3); track tag) {
                                <span class="chip">{{ tag }}</span>
                              }
                              @if (contact.tags.length > 3) {
                                <span class="chip more-chip"
                                  >+{{ contact.tags.length - 3 }}</span
                                >
                              }
                            </span>
                          }
                        </span>
                        <mat-icon class="person-chevron">chevron_right</mat-icon>
                      </button>
                    }
                  </section>
                }
              }
            } @else {
              @for (contact of filteredContacts(); track contact.id) {
                <button
                  class="person-row"
                  [class.selected]="selectedId() === contact.id"
                  [class.due]="isDue(contact)"
                  (click)="selectContact(contact.id)"
                >
                  <span
                    class="person-status-dot"
                    [class.overdue]="
                      contact.nextContactDay && contact.nextContactDay < today
                    "
                  ></span>
                  <span class="person-main">
                    <span class="person-top">
                      <strong>{{ contact.name }}</strong>
                      @if (contact.nextContactDay) {
                        <span
                          class="contact-date"
                          [class.overdue]="contact.nextContactDay < today"
                        >
                          {{ contact.nextContactDay }}
                        </span>
                      }
                    </span>
                    <span class="person-meta">
                      <span>{{ relationshipLabel(contact.relationshipType) }}</span>
                      @if (contact.occupation) {
                        <span>· {{ contact.occupation }}</span>
                      }
                      @if (contact.company) {
                        <span>· {{ contact.company }}</span>
                      }
                    </span>
                    @if (latestInteractionFor(contact.id); as last) {
                      <span class="person-last">
                        <span class="channel-emoji">{{ channelIcon(last.channel) }}</span>
                        {{ channelDisplayLabel(last) }} ·
                        {{ relativeTimeLabel(last.at) }}
                      </span>
                    } @else {
                      <span class="person-last muted">Nicio conversație încă</span>
                    }
                    <span
                      class="person-next"
                      [class.overdue]="
                        contact.nextContactDay && contact.nextContactDay < today
                      "
                      [class.due-now]="contact.nextContactDay === today"
                    >
                      {{ nextContactLabel(contact) }}
                    </span>
                    @if (contact.nextTopic) {
                      <small class="person-topic">💬 {{ contact.nextTopic }}</small>
                    }
                    @if (contact.tags.length) {
                      <span class="chips">
                        @for (tag of contact.tags.slice(0, 3); track tag) {
                          <span class="chip">{{ tag }}</span>
                        }
                      </span>
                    }
                  </span>
                  <mat-icon class="person-chevron">chevron_right</mat-icon>
                </button>
              }
            }

            @if (!filteredContacts().length) {
              <div class="empty-list">
                <mat-icon>person_search</mat-icon>
                <strong>Nu am găsit persoane aici</strong>
                <p>
                  Schimbă filtrul sau caută după nume, oraș, companie ori un subiect din
                  conversații.
                </p>
              </div>
            }
          </div>
        </aside>

        <section class="detail-panel">
          <button
            class="panel-edge-close"
            type="button"
            aria-label="Închide panelul"
            (click)="closePanel()"
          >
            <mat-icon>chevron_right</mat-icon>
          </button>

          @if (interactionEditorOpen()) {
            <mat-card class="quick-interaction-panel">
              <mat-card-content>
                <header class="panel-title-wrapper">
                  <div class="panel-title-copy">
                    <h2>Am vorbit</h2>
                    @if (interactionContact(); as person) {
                      <small>
                        {{ person.name }} · Default:
                        {{ cadenceExactLabel(person.cadence, person.cadenceDays) }}
                      </small>
                    } @else {
                      <small>Înregistrează conversația în câteva secunde.</small>
                    }
                  </div>
                </header>

                <form
                  class="quick-interaction-form"
                  (ngSubmit)="saveInteraction()"
                >
                  <task-detail-item
                    type="fullSizeInput"
                    class="networking-detail-item"
                  >
                    <ng-container input-title>
                      <mat-icon>person</mat-icon>
                      <span>Persoană</span>
                    </ng-container>
                    <ng-container input-value>
                      <select
                        class="panel-inline-control"
                        name="quickInteractionContact"
                        [ngModel]="interactionContactId()"
                        (ngModelChange)="onInteractionContactChange($event)"
                      >
                        <option value="">Alege persoana...</option>
                        @for (person of networking.contacts(); track person.id) {
                          <option [value]="person.id">{{ person.name }}</option>
                        }
                      </select>
                    </ng-container>
                  </task-detail-item>

                  <div class="quick-channel-section">
                    <span class="quick-label">Cum ați vorbit?</span>
                    <div class="channel-picker">
                      @for (item of quickChannelOptions; track item.value) {
                        <button
                          type="button"
                          class="channel-choice"
                          [class.active]="interactionDraft.channel === item.value"
                          (click)="selectInteractionChannel(item.value)"
                        >
                          <span>{{ channelIcon(item.value) }}</span>
                          <strong>{{ item.label }}</strong>
                        </button>
                      }
                    </div>
                    @if (interactionDraft.channel === 'OTHER') {
                      <label class="other-channel-field">
                        <span>Care?</span>
                        <input
                          name="quickCustomChannel"
                          placeholder="ex. Discord, Telegram, eveniment..."
                          [(ngModel)]="interactionDraft.channelCustom"
                        />
                      </label>
                    }
                  </div>

                  <task-detail-item
                    (editActionTriggered)="openInteractionDateDialog()"
                    [inputIcon]="'edit'"
                    class="networking-detail-item"
                  >
                    <ng-container input-title>
                      <mat-icon>schedule</mat-icon>
                      <span>Când?</span>
                    </ng-container>
                    <ng-container input-value>
                      <span>{{ interactionAtLabel() }}</span>
                    </ng-container>
                  </task-detail-item>

                  <div class="panel-textarea-wrap">
                    <label>
                      <span>Ce a fost important? <small>opțional</small></span>
                      <textarea
                        name="quickInteractionSummary"
                        rows="3"
                        placeholder="O notă scurtă ca să îți amintești contextul..."
                        [(ngModel)]="interactionDraft.summary"
                      ></textarea>
                    </label>
                  </div>

                  <div class="reconnect-section">
                    <div class="reconnect-head">
                      <span class="quick-label">Când vrei să vorbiți din nou?</span>
                      @if (interactionContact(); as person) {
                        <small>
                          Default ·
                          {{ cadenceExactLabel(person.cadence, person.cadenceDays) }}
                        </small>
                      }
                    </div>

                    <div class="reconnect-presets">
                      @if (interactionContact(); as person) {
                        <button
                          type="button"
                          [class.active]="reconnectChoice() === 'DEFAULT'"
                          (click)="setInteractionDefaultNextContact()"
                        >
                          Default ·
                          {{ cadenceExactLabel(person.cadence, person.cadenceDays) }}
                        </button>
                      }
                      <button
                        type="button"
                        [class.active]="reconnectChoice() === '3D'"
                        (click)="setInteractionNextContact(3, '3D')"
                      >
                        3 zile
                      </button>
                      <button
                        type="button"
                        [class.active]="reconnectChoice() === '7D'"
                        (click)="setInteractionNextContact(7, '7D')"
                      >
                        1 săpt
                      </button>
                      <button
                        type="button"
                        [class.active]="reconnectChoice() === '14D'"
                        (click)="setInteractionNextContact(14, '14D')"
                      >
                        2 săpt
                      </button>
                      <button
                        type="button"
                        [class.active]="reconnectChoice() === '1M'"
                        (click)="setInteractionNextMonth()"
                      >
                        1 lună
                      </button>
                    </div>

                    <task-detail-item
                      (editActionTriggered)="openNextContactDateDialog()"
                      [inputIcon]="interactionDraft.nextContactDay ? 'edit' : 'add'"
                      class="networking-detail-item reconnect-date-item"
                    >
                      <ng-container input-title>
                        <mat-icon>event</mat-icon>
                        <span>Data exactă</span>
                      </ng-container>
                      <ng-container input-value>
                        <span>{{ reconnectSelectionLabel() }}</span>
                      </ng-container>
                    </task-detail-item>
                  </div>

                  <details class="interaction-more">
                    <summary>Mai multe detalii</summary>
                    <div class="interaction-more-grid">
                      <label>
                        <span>Unde / context</span>
                        <input
                          name="quickInteractionLocation"
                          placeholder="ex. curs, cafenea, conferință"
                          [(ngModel)]="interactionDraft.location"
                        />
                      </label>
                      <label>
                        <span>Ce am aflat nou?</span>
                        <textarea
                          name="quickLearned"
                          rows="2"
                          [(ngModel)]="interactionDraft.learned"
                        ></textarea>
                      </label>
                      <label>
                        <span>Următorul pas</span>
                        <input
                          name="quickNextStep"
                          [(ngModel)]="interactionDraft.nextStep"
                        />
                      </label>
                      <label>
                        <span>Subiect data viitoare</span>
                        <input
                          name="quickNextTopic"
                          [(ngModel)]="interactionDraft.nextTopic"
                        />
                      </label>
                      <label>
                        <span>Follow-up</span>
                        <input
                          name="quickFollowUpTitle"
                          placeholder="ex. Trimite materialele"
                          [(ngModel)]="interactionDraft.followUpTitle"
                        />
                      </label>
                      @if (interactionDraft.followUpTitle.trim()) {
                        <label>
                          <span>Termen follow-up</span>
                          <input
                            name="quickFollowUpDueDay"
                            type="date"
                            [(ngModel)]="interactionDraft.followUpDueDay"
                          />
                        </label>
                      }
                    </div>
                  </details>

                  <div class="panel-form-actions">
                    <button
                      type="button"
                      mat-button
                      (click)="closePanel()"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      mat-flat-button
                      color="primary"
                      [disabled]="
                        !interactionContactId() ||
                        (interactionDraft.channel === 'OTHER' &&
                          !interactionDraft.channelCustom.trim())
                      "
                    >
                      <mat-icon>check</mat-icon>
                      Salvează
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          } @else if (contactEditorOpen()) {
            <mat-card class="editor-card">
              <mat-card-content>
                <header class="panel-title-wrapper editor-panel-title">
                  <div class="panel-title-copy">
                    <h2>
                      {{ editingContactId() ? 'Editează persoana' : 'Persoană nouă' }}
                    </h2>
                    <small>Completează doar informațiile pe care chiar le folosești.</small>
                  </div>
                </header>

                <form
                  class="contact-form"
                  (ngSubmit)="saveContact()"
                >
                  <div class="form-section wide">
                    <mat-icon>person</mat-icon>
                    <div>
                      <strong>Date de contact</strong>
                      <small
                        >Completează doar informațiile pe care chiar le folosești.</small
                      >
                    </div>
                  </div>

                  <label class="wide">
                    <span>Nume *</span>
                    <input
                      name="name"
                      required
                      [(ngModel)]="contactDraft.name"
                    />
                  </label>

                  <label>
                    <span>Telefon</span>
                    <input
                      name="phone"
                      type="tel"
                      [(ngModel)]="contactDraft.phone"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      [(ngModel)]="contactDraft.email"
                    />
                  </label>
                  <label>
                    <span>Instagram</span>
                    <input
                      name="instagram"
                      placeholder="@username sau link"
                      [(ngModel)]="contactDraft.instagram"
                    />
                  </label>
                  <label>
                    <span>Facebook</span>
                    <input
                      name="facebook"
                      placeholder="profil sau link"
                      [(ngModel)]="contactDraft.facebook"
                    />
                  </label>
                  <label>
                    <span>LinkedIn</span>
                    <input
                      name="linkedin"
                      placeholder="profil sau link"
                      [(ngModel)]="contactDraft.linkedin"
                    />
                  </label>

                  <div class="form-section wide">
                    <mat-icon>work</mat-icon>
                    <div>
                      <strong>Profesie și locație</strong>
                      <small
                        >Contextul profesional și locul în care se află persoana.</small
                      >
                    </div>
                  </div>

                  <label>
                    <span>Oraș</span>
                    <input
                      name="city"
                      [(ngModel)]="contactDraft.city"
                    />
                  </label>
                  <label>
                    <span>Județ / regiune</span>
                    <input
                      name="region"
                      [(ngModel)]="contactDraft.region"
                    />
                  </label>
                  <label>
                    <span>Țară</span>
                    <input
                      name="country"
                      [(ngModel)]="contactDraft.country"
                    />
                  </label>

                  <label>
                    <span>Ocupație</span>
                    <input
                      name="occupation"
                      placeholder="ex. AI Engineer"
                      [(ngModel)]="contactDraft.occupation"
                    />
                  </label>
                  <label>
                    <span>Funcție</span>
                    <input
                      name="role"
                      [(ngModel)]="contactDraft.role"
                    />
                  </label>
                  <label>
                    <span>Companie / organizație</span>
                    <input
                      name="company"
                      [(ngModel)]="contactDraft.company"
                    />
                  </label>
                  <label>
                    <span>Domeniu</span>
                    <input
                      name="industry"
                      placeholder="AI, juridic, contabilitate..."
                      [(ngModel)]="contactDraft.industry"
                    />
                  </label>

                  <div class="form-section wide">
                    <mat-icon>handshake</mat-icon>
                    <div>
                      <strong>Context și relație</strong>
                      <small
                        >Cum v-ați cunoscut și ce fel de relație vrei să menții.</small
                      >
                    </div>
                  </div>

                  <label>
                    <span>De unde îl/o cunosc</span>
                    <input
                      name="metThrough"
                      placeholder="facultate, conferință, prin cineva..."
                      [(ngModel)]="contactDraft.metThrough"
                    />
                  </label>
                  <label>
                    <span>Unde ne-am cunoscut</span>
                    <input
                      name="metAt"
                      [(ngModel)]="contactDraft.metAt"
                    />
                  </label>
                  <label>
                    <span>Data când ne-am cunoscut</span>
                    <input
                      name="metOn"
                      type="date"
                      [(ngModel)]="contactDraft.metOn"
                    />
                  </label>
                  <label>
                    <span>Ne-a făcut cunoștință</span>
                    <select
                      name="introducedBy"
                      [(ngModel)]="contactDraft.introducedByContactId"
                    >
                      <option value="">—</option>
                      @for (person of introductionOptions(); track person.id) {
                        <option [value]="person.id">{{ person.name }}</option>
                      }
                    </select>
                  </label>

                  <label>
                    <span>Tip relație</span>
                    <select
                      name="relationshipType"
                      [(ngModel)]="contactDraft.relationshipType"
                    >
                      @for (item of relationshipOptions; track item.value) {
                        <option [value]="item.value">{{ item.label }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    <span>Importanță relație</span>
                    <select
                      name="importance"
                      [(ngModel)]="contactDraft.importance"
                    >
                      @for (item of importanceOptions; track item.value) {
                        <option [value]="item.value">{{ item.label }}</option>
                      }
                    </select>
                  </label>

                  <label class="wide">
                    <span>Tags</span>
                    <input
                      name="tags"
                      placeholder="AI, Timișoara, recruiter, facultate"
                      [(ngModel)]="contactDraft.tags"
                    />
                    <small>Separate prin virgulă.</small>
                  </label>

                  <div class="form-section wide">
                    <mat-icon>notes</mat-icon>
                    <div>
                      <strong>Note utile</strong>
                      <small>
                        Păstrează lucrurile stabile; conversațiile rămân separat în
                        istoric.
                      </small>
                    </div>
                  </div>

                  <label class="wide">
                    <span>Interese</span>
                    <textarea
                      name="interests"
                      rows="2"
                      [(ngModel)]="contactDraft.interests"
                    ></textarea>
                  </label>
                  <label class="wide">
                    <span>Pot să îl/o ajut cu</span>
                    <textarea
                      name="canHelpWith"
                      rows="2"
                      [(ngModel)]="contactDraft.canHelpWith"
                    ></textarea>
                  </label>
                  <label class="wide">
                    <span>Mă poate ajuta cu</span>
                    <textarea
                      name="canHelpMeWith"
                      rows="2"
                      [(ngModel)]="contactDraft.canHelpMeWith"
                    ></textarea>
                  </label>
                  <label class="wide">
                    <span>Note permanente</span>
                    <textarea
                      name="notes"
                      rows="4"
                      [(ngModel)]="contactDraft.notes"
                    ></textarea>
                  </label>

                  <div class="form-section wide">
                    <mat-icon>event_repeat</mat-icon>
                    <div>
                      <strong>Ținem legătura</strong>
                      <small>Setează când vrei să apară din nou persoana în Today.</small>
                    </div>
                  </div>
                  <label>
                    <span>Frecvență</span>
                    <select
                      name="cadence"
                      [(ngModel)]="contactDraft.cadence"
                    >
                      @for (item of cadenceOptions; track item.value) {
                        <option [value]="item.value">{{ item.label }}</option>
                      }
                    </select>
                  </label>
                  @if (contactDraft.cadence === 'CUSTOM') {
                    <label>
                      <span>La câte zile</span>
                      <input
                        name="cadenceDays"
                        type="number"
                        min="1"
                        [(ngModel)]="contactDraft.cadenceDays"
                      />
                    </label>
                  }
                  <task-detail-item
                    type="fullSizeInput"
                    class="wide networking-detail-item contact-editor-date"
                  >
                    <ng-container input-title>
                      <mat-icon>event_repeat</mat-icon>
                      <span>Următorul contact</span>
                    </ng-container>
                    <ng-container input-value>
                      <button
                        type="button"
                        mat-button
                        (click)="openContactDraftNextDateDialog()"
                      >
                        {{
                          contactDraft.nextContactDay
                            ? dayLabel(contactDraft.nextContactDay)
                            : 'Alege data'
                        }}
                      </button>
                    </ng-container>
                  </task-detail-item>
                  <label class="wide">
                    <span>Subiect data viitoare</span>
                    <small>
                      O propoziție scurtă ca să știi imediat de unde reiei conversația.
                    </small>
                    <input
                      name="nextTopic"
                      placeholder="Ce vreau să întreb / discut data viitoare"
                      [(ngModel)]="contactDraft.nextTopic"
                    />
                  </label>

                  <div class="form-actions wide">
                    <button
                      type="button"
                      mat-button
                      (click)="cancelContactEdit()"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      mat-flat-button
                      color="primary"
                      [disabled]="!contactDraft.name.trim()"
                    >
                      <mat-icon>save</mat-icon>
                      Salvează
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          } @else if (selectedContact(); as contact) {
            <section class="profile native-profile">
              <header class="panel-title-wrapper profile-native-title">
                <div class="panel-title-copy">
                  <h2>{{ contact.name }}</h2>
                  <small>
                    {{ relationshipLabel(contact.relationshipType) }}
                    @if (contact.occupation) {
                      · {{ contact.occupation }}
                    }
                    @if (contact.company) {
                      · {{ contact.company }}
                    }
                  </small>
                </div>
              </header>

              <div class="profile-actions native-profile-actions">
                @if (!contact.isArchived) {
                  <button
                    mat-flat-button
                    color="primary"
                    (click)="startInteraction(contact.id)"
                  >
                    <mat-icon>forum</mat-icon>
                    Am vorbit
                  </button>
                }
                <button
                  mat-button
                  (click)="startEditContact(contact)"
                >
                  <mat-icon>edit</mat-icon>
                  Editează
                </button>
              </div>

              <task-detail-item
                (editActionTriggered)="openContactNextDateDialog(contact)"
                [inputIcon]="contact.nextContactDay ? 'edit' : 'add'"
                [class.color-warn]="
                  !!contact.nextContactDay && contact.nextContactDay < today
                "
                class="networking-detail-item"
              >
                <ng-container input-title>
                  <mat-icon>event_repeat</mat-icon>
                  <span>Următorul contact</span>
                </ng-container>
                <ng-container input-value>
                  <span>
                    @if (contact.nextContactDay) {
                      {{ dayLabel(contact.nextContactDay) }}
                    } @else {
                      Fără reminder
                    }
                  </span>
                </ng-container>
              </task-detail-item>

              <task-detail-item
                type="fullSizeInput"
                class="networking-detail-item"
              >
                <ng-container input-title>
                  <mat-icon>repeat</mat-icon>
                  <span>Default</span>
                </ng-container>
                <ng-container input-value>
                  <span>
                    {{ cadenceExactLabel(contact.cadence, contact.cadenceDays) }}
                  </span>
                </ng-container>
              </task-detail-item>

              <task-detail-item
                type="fullSizeInput"
                class="networking-detail-item"
              >
                <ng-container input-title>
                  <mat-icon>forum</mat-icon>
                  <span>Ultima conversație</span>
                </ng-container>
                <ng-container input-value>
                  @if (latestInteraction(); as last) {
                    <span>
                      {{ channelIcon(last.channel) }}
                      {{ channelDisplayLabel(last) }} · {{ relativeTimeLabel(last.at) }}
                    </span>
                  } @else {
                    <span>—</span>
                  }
                </ng-container>
              </task-detail-item>

              @if (contact.nextTopic) {
                <div class="panel-context-note">
                  <mat-icon>chat_bubble_outline</mat-icon>
                  <div>
                    <small>Data viitoare</small>
                    <p>{{ contact.nextTopic }}</p>
                  </div>
                </div>
              }

              <div class="contact-links native-contact-links">
                @if (contact.phone) {
                  <a [href]="'tel:' + contact.phone">
                    <mat-icon>phone</mat-icon>{{ contact.phone }}
                  </a>
                }
                @if (contact.email) {
                  <a [href]="'mailto:' + contact.email">
                    <mat-icon>mail</mat-icon>{{ contact.email }}
                  </a>
                }
                @if (contact.instagram) {
                  <a
                    [href]="socialUrl('instagram', contact.instagram)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>photo_camera</mat-icon>Instagram
                  </a>
                }
                @if (contact.facebook) {
                  <a
                    [href]="socialUrl('facebook', contact.facebook)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>public</mat-icon>Facebook
                  </a>
                }
                @if (contact.linkedin) {
                  <a
                    [href]="socialUrl('linkedin', contact.linkedin)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <mat-icon>business_center</mat-icon>LinkedIn
                  </a>
                }
              </div>

              <task-detail-item
                type="panel"
                [expanded]="false"
                class="networking-detail-item"
              >
                <ng-container panel-header>
                  <mat-icon>person</mat-icon>
                  <span>Detalii persoană</span>
                </ng-container>
                <ng-container panel-content>
                  <dl class="compact-profile-list">
                    @if (contact.city || contact.region || contact.country) {
                      <div>
                        <dt>Locație</dt>
                        <dd>{{ locationLabel(contact) }}</dd>
                      </div>
                    }
                    @if (contact.industry) {
                      <div>
                        <dt>Domeniu</dt>
                        <dd>{{ contact.industry }}</dd>
                      </div>
                    }
                    @if (contact.metThrough) {
                      <div>
                        <dt>De unde o cunosc</dt>
                        <dd>{{ contact.metThrough }}</dd>
                      </div>
                    }
                    @if (contact.metAt) {
                      <div>
                        <dt>Ne-am cunoscut la</dt>
                        <dd>{{ contact.metAt }}</dd>
                      </div>
                    }
                    @if (introducedByName(contact)) {
                      <div>
                        <dt>Introducere prin</dt>
                        <dd>{{ introducedByName(contact) }}</dd>
                      </div>
                    }
                  </dl>
                  @if (contact.tags.length) {
                    <div class="chips roomy">
                      @for (tag of contact.tags; track tag) {
                        <span class="chip">{{ tag }}</span>
                      }
                    </div>
                  }
                  @if (contact.interests) {
                    <div class="compact-text-block">
                      <small>Interese</small>
                      <p>{{ contact.interests }}</p>
                    </div>
                  }
                  @if (contact.notes) {
                    <div class="compact-text-block">
                      <small>Note</small>
                      <p>{{ contact.notes }}</p>
                    </div>
                  }
                  @if (contact.canHelpWith || contact.canHelpMeWith) {
                    <div class="compact-two-col">
                      <div>
                        <small>Pot să îl/o ajut cu</small>
                        <p>{{ contact.canHelpWith || '—' }}</p>
                      </div>
                      <div>
                        <small>Mă poate ajuta cu</small>
                        <p>{{ contact.canHelpMeWith || '—' }}</p>
                      </div>
                    </div>
                  }
                </ng-container>
              </task-detail-item>

              <task-detail-item
                type="panel"
                [expanded]="false"
                class="networking-detail-item"
              >
                <ng-container panel-header>
                  <mat-icon>checklist</mat-icon>
                  <span>Follow-ups ({{ openFollowUps().length }})</span>
                </ng-container>
                <ng-container panel-content>
                  <div class="quick-followup native-quick-followup">
                    <input
                      #followUpTitle
                      placeholder="Adaugă follow-up..."
                      (keydown.enter)="
                        addFollowUp(contact.id, followUpTitle.value, followUpDue.value);
                        followUpTitle.value = ''
                      "
                    />
                    <input
                      #followUpDue
                      type="date"
                    />
                    <button
                      mat-button
                      (click)="
                        addFollowUp(contact.id, followUpTitle.value, followUpDue.value);
                        followUpTitle.value = ''
                      "
                    >
                      <mat-icon>add</mat-icon>
                    </button>
                  </div>

                  @for (item of followUps(); track item.id) {
                    <div
                      class="followup-row"
                      [class.done]="item.status === 'DONE'"
                    >
                      <button
                        class="check"
                        type="button"
                        (click)="toggleFollowUp(item.id, item.status)"
                      >
                        <mat-icon>{{
                          item.status === 'DONE'
                            ? 'check_circle'
                            : 'radio_button_unchecked'
                        }}</mat-icon>
                      </button>
                      <span class="grow">{{ item.title }}</span>
                      @if (item.dueDay) {
                        <span class="chip">{{ dayLabel(item.dueDay) }}</span>
                      }
                      @if (!item.taskId && item.status === 'OPEN') {
                        <button
                          mat-icon-button
                          type="button"
                          aria-label="Creează task"
                          (click)="createTask(item.id)"
                        >
                          <mat-icon>add_task</mat-icon>
                        </button>
                      }
                    </div>
                  }
                  @if (!followUps().length) {
                    <p class="muted compact-empty">Niciun follow-up.</p>
                  }
                </ng-container>
              </task-detail-item>

              <task-detail-item
                type="panel"
                [expanded]="true"
                class="networking-detail-item"
              >
                <ng-container panel-header>
                  <mat-icon>history</mat-icon>
                  <span>Istoric ({{ interactions().length }})</span>
                </ng-container>
                <ng-container panel-content>
                  <div class="timeline compact-timeline">
                    @for (item of interactions(); track item.id) {
                      <article class="interaction">
                        <div class="timeline-marker"></div>
                        <div class="interaction-body">
                          <header>
                            <div>
                              <strong>{{ dateTimeLabel(item.at) }}</strong>
                              <span class="channel">
                                {{ channelIcon(item.channel) }}
                                {{ channelDisplayLabel(item) }}
                              </span>
                            </div>
                            @if (item.location) {
                              <span class="muted">{{ item.location }}</span>
                            }
                          </header>
                          @if (item.summary) {
                            <p class="summary">{{ item.summary }}</p>
                          }
                          <div class="interaction-details">
                            @if (item.learned) {
                              <div>
                                <small>Ce am aflat</small>
                                <p>{{ item.learned }}</p>
                              </div>
                            }
                            @if (item.nextStep) {
                              <div>
                                <small>Următorul pas</small>
                                <p>{{ item.nextStep }}</p>
                              </div>
                            }
                            @if (item.nextTopic) {
                              <div>
                                <small>Data viitoare</small>
                                <p>{{ item.nextTopic }}</p>
                              </div>
                            }
                          </div>
                        </div>
                      </article>
                    }
                    @if (!interactions().length) {
                      <p class="muted compact-empty">Nicio conversație înregistrată.</p>
                    }
                  </div>
                </ng-container>
              </task-detail-item>

              <footer class="danger-zone native-danger-zone">
                @if (contact.isArchived) {
                  <button
                    mat-button
                    (click)="networking.archiveContact(contact.id, false)"
                  >
                    <mat-icon>unarchive</mat-icon>
                    Reactivează
                  </button>
                } @else {
                  <button
                    mat-button
                    (click)="archiveSelected(contact.id)"
                  >
                    <mat-icon>archive</mat-icon>
                    Arhivează
                  </button>
                }
              </footer>
            </section>
          } @else {
            <div class="empty-detail">
              <mat-icon>groups</mat-icon>
              <h2>Networking-ul tău începe aici</h2>
              <p>
                Adaugă o persoană sau selectează una din listă pentru a vedea contextul
                relației.
              </p>
              <button
                mat-flat-button
                color="primary"
                (click)="startNewContact()"
              >
                <mat-icon>person_add</mat-icon>
                Adaugă persoană
              </button>
            </div>
          }
        </section>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .networking-page {
        width: min(1440px, 100%);
        margin: 0 auto;
        padding: 18px 18px 96px;
        box-sizing: border-box;
      }

      .page-head,
      .section-head,
      .profile-head,
      .profile-title-line,
      .profile-actions,
      .mini-head,
      .person-top,
      .followup-row,
      .quick-followup {
        display: flex;
        align-items: center;
      }

      .page-head,
      .section-head,
      .profile-head,
      .mini-head,
      .person-top {
        justify-content: space-between;
      }

      .page-head {
        gap: 18px;
        margin-bottom: 14px;
      }

      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }

      .page-head h1 {
        margin-bottom: 3px;
        font-size: 1.5rem;
      }

      .page-head p,
      .section-head p,
      .profile-head p {
        margin-bottom: 0;
        color: var(--text-color-muted);
        font-size: 0.82rem;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .summary-card {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
        column-gap: 9px;
        align-items: center;
        min-height: 68px;
        padding: 10px 12px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .summary-card:hover,
      .summary-card.active {
        background: var(--state-hover);
      }

      .summary-card mat-icon {
        grid-row: 1 / 3;
      }

      .summary-card strong {
        font-size: 1.1rem;
      }

      .summary-card span {
        color: var(--text-color-muted);
        font-size: 0.74rem;
      }

      .workspace {
        display: grid;
        grid-template-columns: 330px minmax(0, 1fr);
        gap: 12px;
        min-height: 620px;
      }

      .people-panel,
      .detail-panel {
        min-width: 0;
      }

      .people-panel {
        overflow: hidden;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: color-mix(in srgb, var(--bg-lighter) 72%, transparent);
      }

      .search-row {
        padding: 10px;
        border-bottom: 1px solid var(--divider-color);
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 9px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }

      .search-box input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: inherit;
      }

      .filters {
        display: flex;
        gap: 3px;
        overflow-x: auto;
        padding: 7px;
        border-bottom: 1px solid var(--divider-color);
      }

      .filters button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 8px;
        border: 0;
        border-radius: 99px;
        background: transparent;
        color: inherit;
        white-space: nowrap;
        cursor: pointer;
      }

      .filters button:hover,
      .filters button.active {
        background: var(--state-selected);
      }

      .filters span {
        opacity: 0.55;
        font-size: 0.72rem;
      }

      .people-list {
        max-height: calc(100vh - 275px);
        overflow: auto;
        padding: 5px;
      }

      .person-row {
        display: block;
        width: 100%;
        padding: 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .person-row:hover,
      .person-row.selected {
        background: var(--state-hover);
      }

      .person-row.due:not(.selected) {
        box-shadow: inset 3px 0 0 var(--c-accent);
      }

      .person-meta,
      .person-topic {
        display: block;
        margin-top: 3px;
        overflow: hidden;
        color: var(--text-color-muted);
        font-size: 0.75rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .contact-date {
        opacity: 0.65;
        font-size: 0.7rem;
      }

      .contact-date.overdue,
      .status-pill.overdue {
        font-weight: 700;
        color: var(--c-warn);
      }

      .status-pill.due-now {
        font-weight: 700;
        color: var(--c-accent);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .chips.roomy {
        margin-block: 10px;
      }

      .chip,
      .importance,
      .channel,
      .status-pill {
        display: inline-flex;
        padding: 2px 7px;
        border-radius: 99px;
        background: var(--state-hover);
        font-size: 0.68rem;
      }

      .detail-panel {
        min-height: 600px;
      }

      .editor-card,
      .interaction-editor,
      .profile-grid,
      .context-grid,
      .followup-card,
      .timeline-card {
        margin-bottom: 10px;
      }

      .profile {
        display: block;
      }

      .profile-head {
        gap: 12px;
        margin-bottom: 9px;
      }

      .profile-title-line {
        gap: 8px;
      }

      .profile-title-line h2 {
        margin-bottom: 0;
      }

      .profile-actions {
        gap: 4px;
      }

      .contact-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }

      .contact-links a {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 32px;
        padding: 3px 8px;
        border: 1px solid var(--divider-color);
        border-radius: 7px;
        color: inherit;
        text-decoration: none;
      }

      .contact-links mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      .context-grid,
      .profile-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .mini-head {
        gap: 8px;
        margin-bottom: 7px;
      }

      .mini-head > span {
        color: var(--text-color-muted);
        font-size: 0.75rem;
      }

      dl {
        margin: 0;
      }

      dl > div {
        display: grid;
        grid-template-columns: minmax(105px, 0.4fr) 1fr;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--divider-color) 60%, transparent);
      }

      dt,
      .text-block small,
      .next-topic small,
      .interaction-details small {
        color: var(--text-color-muted);
        font-size: 0.72rem;
      }

      dd {
        margin: 0;
      }

      .next-topic,
      .text-block {
        margin-top: 9px;
      }

      .next-topic p,
      .text-block p {
        margin: 3px 0 0;
        white-space: pre-wrap;
      }

      .last-summary {
        margin-bottom: 8px;
        white-space: pre-wrap;
      }

      .context-line {
        margin-top: 5px;
        font-size: 0.82rem;
      }

      .people-group + .people-group {
        margin-top: 10px;
      }

      .people-group-head {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px 9px 5px;
        color: var(--text-color-muted);
        font-size: 0.72rem;
        letter-spacing: 0.01em;
      }

      .people-group-head strong {
        flex: 1;
        color: inherit;
        font-size: inherit;
        text-transform: uppercase;
      }

      .group-emoji {
        font-size: 0.9rem;
      }

      .person-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .person-main {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 4px;
        text-align: left;
      }

      .person-status-dot {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        margin-top: 7px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--text-color-muted) 55%, transparent);
      }

      .person-row.due .person-status-dot {
        background: var(--c-accent);
      }

      .person-status-dot.overdue {
        background: var(--c-warn);
      }

      .person-chevron {
        flex: 0 0 auto;
        margin-top: 2px;
        opacity: 0.35;
      }

      .more-chip {
        opacity: 0.65;
      }

      .editor-card {
        overflow: hidden;
      }

      .editor-carousel {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        padding: 2px 0 8px;
        scrollbar-width: thin;
      }

      .editor-carousel-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
        min-height: 38px;
        padding: 7px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 999px;
        background: transparent;
        color: var(--text-color-muted);
        cursor: pointer;
        font: inherit;
        font-size: 0.78rem;
      }

      .editor-carousel-item:hover {
        background: var(--state-hover);
        color: inherit;
      }

      .editor-carousel-item.active {
        border-color: color-mix(in srgb, var(--c-accent) 65%, var(--divider-color));
        background: color-mix(in srgb, var(--c-accent) 12%, transparent);
        color: inherit;
        font-weight: 700;
      }

      .editor-carousel-emoji {
        font-size: 1rem;
      }

      .editor-progress {
        display: flex;
        align-items: center;
        gap: 9px;
        margin: 0 0 12px;
        color: var(--text-color-muted);
        font-size: 0.7rem;
      }

      .editor-progress-track {
        position: relative;
        display: block;
        flex: 1;
        height: 3px;
        overflow: hidden;
        border-radius: 999px;
        background: color-mix(in srgb, var(--divider-color) 70%, transparent);
      }

      .editor-progress-track > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--c-accent);
        transition: width 180ms ease;
      }

      .editor-section-shell {
        min-height: 360px;
        padding: 13px;
        border: 1px solid color-mix(in srgb, var(--divider-color) 88%, transparent);
        border-radius: 12px;
        background: color-mix(in srgb, var(--card-bg) 88%, transparent);
      }

      .editor-section-head {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        margin-bottom: 12px;
      }

      .editor-section-head h3 {
        margin: 0 0 3px;
        font-size: 1rem;
      }

      .editor-section-head p {
        margin: 0;
        color: var(--text-color-muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }

      .section-emoji {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--state-hover);
        font-size: 1.15rem;
      }

      .task-panel-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .detail-field {
        display: grid !important;
        grid-template-columns: 28px minmax(110px, 0.72fr) minmax(130px, 1fr);
        align-items: center;
        gap: 8px !important;
        min-width: 0;
        padding: 8px 9px;
        border: 1px solid color-mix(in srgb, var(--divider-color) 78%, transparent);
        border-radius: 9px;
        background: var(--bg);
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }

      .detail-field:hover,
      .detail-field:focus-within {
        border-color: color-mix(in srgb, var(--c-accent) 50%, var(--divider-color));
        background: color-mix(in srgb, var(--state-hover) 55%, var(--bg));
      }

      .detail-field.full {
        grid-column: 1 / -1;
      }

      .field-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: var(--state-hover);
        font-size: 0.95rem;
      }

      .detail-field-copy {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }

      .detail-field-copy strong {
        font-size: 0.78rem;
      }

      .detail-field-copy small {
        color: var(--text-color-muted);
        font-size: 0.66rem;
        line-height: 1.3;
      }

      .native-control {
        min-width: 0;
        border: 0 !important;
        border-bottom: 1px solid color-mix(in srgb, var(--divider-color) 85%, transparent) !important;
        border-radius: 0 !important;
        background: transparent !important;
        padding: 7px 2px !important;
      }

      .native-control:focus {
        border-bottom-color: var(--c-accent) !important;
      }

      .textarea-field {
        align-items: flex-start;
      }

      .textarea-field .field-icon {
        margin-top: 3px;
      }

      .notes-control {
        min-height: 150px;
      }

      .editor-tip {
        display: flex;
        gap: 9px;
        margin-top: 10px;
        padding: 10px 11px;
        border-radius: 9px;
        background: color-mix(in srgb, var(--c-accent) 8%, var(--state-hover));
      }

      .editor-tip > span {
        font-size: 1.1rem;
      }

      .editor-tip strong {
        font-size: 0.78rem;
      }

      .editor-tip p {
        margin: 2px 0 0;
        color: var(--text-color-muted);
        font-size: 0.72rem;
        line-height: 1.4;
      }

      .editor-footer {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
      }

      .editor-footer-spacer {
        flex: 1;
      }

      .form-section {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-top: 7px;
        padding: 10px 0 5px;
        border-top: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
      }

      .form-section:first-child {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
      }

      .form-section mat-icon {
        width: 20px;
        height: 20px;
        color: var(--text-color-muted);
        font-size: 20px;
      }

      .form-section > div {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .form-section strong {
        font-size: 0.8rem;
        font-weight: 600;
      }

      .form-section small {
        color: var(--text-color-muted);
        font-size: 0.67rem;
        line-height: 1.35;
      }

      .editor-card {
        overflow: visible;
      }

      .contact-form,
      .interaction-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .contact-form label,
      .interaction-form label {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 4px;
      }

      label > span {
        color: var(--text-color-muted);
        font-size: 0.73rem;
      }

      label > small {
        color: var(--text-color-muted);
        font-size: 0.65rem;
      }

      input,
      textarea,
      select {
        width: 100%;
        box-sizing: border-box;
        min-height: 38px;
        padding: 8px 9px;
        border: 1px solid color-mix(in srgb, var(--divider-color) 82%, transparent);
        border-radius: 6px;
        outline: 0;
        background: color-mix(in srgb, var(--bg) 94%, var(--state-hover));
        color: inherit;
        font: inherit;
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }

      input:focus,
      textarea:focus,
      select:focus {
        border-color: color-mix(in srgb, var(--c-accent) 65%, var(--divider-color));
        background: var(--bg);
      }

      textarea {
        resize: vertical;
      }

      .wide {
        grid-column: 1 / -1;
      }

      .form-divider {
        margin-top: 5px;
        padding-top: 9px;
        border-top: 1px solid var(--divider-color);
        font-weight: 700;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .quick-followup {
        gap: 6px;
        margin: 8px 0;
      }

      .quick-followup input:first-child {
        flex: 1;
      }

      .quick-followup input[type='date'] {
        width: auto;
      }

      .followup-row {
        min-height: 38px;
        gap: 7px;
        border-top: 1px solid color-mix(in srgb, var(--divider-color) 65%, transparent);
      }

      .followup-row.done {
        opacity: 0.55;
      }

      .followup-row.done .grow {
        text-decoration: line-through;
      }

      .check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }

      .linked {
        opacity: 0.7;
      }

      .grow {
        flex: 1;
        min-width: 0;
      }

      .timeline {
        position: relative;
      }

      .interaction {
        position: relative;
        display: grid;
        grid-template-columns: 20px 1fr;
        gap: 8px;
        padding-bottom: 16px;
      }

      .interaction:not(:last-child)::before {
        position: absolute;
        top: 18px;
        bottom: -2px;
        left: 7px;
        width: 1px;
        background: var(--divider-color);
        content: '';
      }

      .timeline-marker {
        z-index: 1;
        width: 9px;
        height: 9px;
        margin-top: 5px;
        margin-left: 3px;
        border: 2px solid var(--c-accent);
        border-radius: 50%;
        background: var(--bg);
      }

      .interaction-body header {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .interaction-body header > div {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .summary {
        margin: 6px 0;
        white-space: pre-wrap;
      }

      .interaction-details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .interaction-details > div {
        padding: 6px 8px;
        border-radius: 7px;
        background: var(--state-hover);
      }

      .interaction-details p {
        margin: 3px 0 0;
        white-space: pre-wrap;
      }

      .danger-zone {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
        opacity: 0.8;
      }

      .muted {
        color: var(--text-color-muted);
      }

      .empty-list,
      .empty-detail,
      .timeline-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 28px 16px;
        color: var(--text-color-muted);
        text-align: center;
      }

      .empty-detail {
        min-height: 440px;
      }

      .empty-detail mat-icon,
      .timeline-empty mat-icon {
        width: 40px;
        height: 40px;
        font-size: 40px;
      }

      @media (max-width: 900px) {
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .workspace {
          grid-template-columns: 270px minmax(0, 1fr);
        }

        .context-grid,
        .profile-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 700px) {
        .editor-section-shell {
          min-height: 0;
          padding: 10px;
        }

        .task-panel-fields {
          grid-template-columns: 1fr;
        }

        .detail-field,
        .detail-field.full {
          grid-column: auto;
          grid-template-columns: 28px minmax(0, 1fr);
        }

        .detail-field .native-control {
          grid-column: 1 / -1;
        }

        .editor-footer {
          position: sticky;
          bottom: 0;
          z-index: 2;
          margin: 12px -8px -8px;
          padding: 8px;
          border-top: 1px solid var(--divider-color);
          background: var(--card-bg);
        }

        .editor-carousel-item {
          min-height: 42px;
        }

        .networking-page {
          padding: 12px 9px 96px;
        }

        .page-head,
        .profile-head {
          align-items: stretch;
          flex-direction: column;
        }

        .workspace {
          display: block;
        }

        .people-panel {
          margin-bottom: 10px;
        }

        .people-list {
          max-height: 310px;
        }

        .contact-form,
        .interaction-form,
        .interaction-details {
          grid-template-columns: 1fr;
        }

        .wide {
          grid-column: auto;
        }

        .profile-actions {
          flex-wrap: wrap;
        }

        .quick-followup {
          align-items: stretch;
          flex-direction: column;
        }

        .quick-followup input[type='date'] {
          width: 100%;
        }

        input,
        select {
          min-height: 44px;
        }
      }

      /* Fast daily Networking layout */
      .page-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .workspace {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
        min-height: 620px;
      }

      .workspace.panel-open {
        grid-template-columns: minmax(0, 1fr) minmax(390px, 470px);
        align-items: start;
      }

      .workspace:not(.panel-open) .detail-panel {
        display: none;
      }

      .people-panel {
        overflow: visible;
      }

      .people-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
        max-height: none;
        overflow: visible;
        padding: 10px;
      }

      .people-group {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
        margin: 0;
      }

      .people-group + .people-group {
        margin-top: 6px;
      }

      .people-group-head {
        grid-column: 1 / -1;
        padding: 10px 2px 2px;
      }

      .person-row {
        min-height: 124px;
        padding: 12px;
        border: 1px solid color-mix(in srgb, var(--divider-color) 82%, transparent);
        border-radius: 11px;
        background: color-mix(in srgb, var(--card-bg) 84%, transparent);
        transition:
          border-color 120ms ease,
          background 120ms ease,
          transform 120ms ease;
      }

      .person-row:hover {
        border-color: color-mix(in srgb, var(--c-accent) 42%, var(--divider-color));
        background: var(--state-hover);
        transform: translateY(-1px);
      }

      .person-row.selected {
        border-color: color-mix(in srgb, var(--c-accent) 58%, var(--divider-color));
        background: color-mix(in srgb, var(--c-accent) 9%, var(--card-bg));
      }

      .person-row.due:not(.selected) {
        box-shadow: inset 3px 0 0 var(--c-accent);
      }

      .person-main {
        gap: 5px;
      }

      .person-top strong {
        overflow: hidden;
        font-size: 0.95rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .person-meta {
        margin-top: 0;
      }

      .person-last,
      .person-next {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        color: var(--text-color-muted);
        font-size: 0.73rem;
      }

      .person-next {
        margin-top: 1px;
        font-weight: 600;
      }

      .person-next.overdue {
        color: var(--c-warn);
      }

      .person-next.due-now {
        color: var(--c-accent);
      }

      .channel-emoji {
        flex: 0 0 auto;
        font-size: 0.9rem;
      }

      .detail-panel {
        position: sticky;
        top: 12px;
        align-self: start;
        max-height: calc(100vh - 96px);
        overflow: auto;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        background: var(--bg);
        box-shadow: 0 12px 34px rgba(0, 0, 0, 0.12);
      }

      .quick-interaction-panel {
        margin: 0;
        box-shadow: none !important;
      }

      .quick-panel-head {
        margin-bottom: 14px;
      }

      .quick-interaction-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .quick-interaction-form label,
      .interaction-more-grid label {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .quick-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .quick-label {
        color: var(--text-color-muted);
        font-size: 0.73rem;
      }

      .channel-picker {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }

      .channel-choice {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 46px;
        padding: 8px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 9px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .channel-choice:hover {
        background: var(--state-hover);
      }

      .channel-choice.active {
        border-color: color-mix(in srgb, var(--c-accent) 65%, var(--divider-color));
        background: color-mix(in srgb, var(--c-accent) 12%, transparent);
      }

      .channel-choice > span {
        font-size: 1.05rem;
      }

      .channel-choice strong {
        font-size: 0.78rem;
      }

      .reconnect-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .reconnect-presets button {
        min-height: 34px;
        padding: 5px 9px;
        border: 1px solid var(--divider-color);
        border-radius: 999px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }

      .reconnect-presets button:hover {
        background: var(--state-hover);
      }

      .interaction-more {
        padding: 9px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 9px;
      }

      .interaction-more summary {
        cursor: pointer;
        color: var(--text-color-muted);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .interaction-more-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 9px;
        margin-top: 10px;
      }

      .quick-interaction-form .form-actions {
        margin-top: 2px;
      }

      @media (max-width: 1100px) {
        .workspace.panel-open {
          grid-template-columns: minmax(0, 1fr) 410px;
        }

        .workspace.panel-open .people-list,
        .workspace.panel-open .people-group {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 800px) {
        .page-head {
          align-items: stretch;
        }

        .page-actions {
          justify-content: flex-end;
        }

        .people-list,
        .people-group {
          grid-template-columns: 1fr;
        }

        .workspace.panel-open {
          display: block;
        }

        .workspace.panel-open .people-panel {
          display: none;
        }

        .detail-panel {
          position: static;
          max-height: none;
          overflow: visible;
          padding: 8px;
          box-shadow: none;
        }
      }

      /* Native Super Productivity right-panel treatment */
      .workspace.panel-open {
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 0;
        align-items: stretch;
      }

      .detail-panel {
        position: sticky;
        top: 0;
        align-self: start;
        min-height: 620px;
        max-height: calc(100vh - 72px);
        overflow: auto;
        padding: 0;
        border: 0;
        border-left: 1px solid var(--separator-color);
        border-radius: 0;
        background: var(--right-panel-bg);
        box-shadow: none;
      }

      .panel-edge-close {
        position: absolute;
        z-index: 5;
        top: 50%;
        left: -8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 48px;
        padding: 0;
        transform: translateY(-50%);
        border: 0;
        border-radius: 3px 8px 8px 3px;
        background: var(--bg-lightest);
        box-shadow: var(--whiteframe-shadow-2dp);
        color: var(--text-color);
        cursor: pointer;
      }

      .panel-edge-close mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }

      .panel-title-wrapper {
        display: flex;
        align-items: center;
        min-height: var(--bar-height);
        margin: calc(var(--s2) + var(--s-half)) var(--s) var(--s);
        border-bottom: 2px solid var(--c-primary);
      }

      .panel-title-copy {
        min-width: 0;
        flex: 1;
        padding: var(--s) var(--s-half);
      }

      .panel-title-copy h2 {
        margin: 0;
        overflow: hidden;
        font-size: 17px;
        font-weight: 600;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .panel-title-copy small {
        display: block;
        margin-top: 2px;
        overflow: hidden;
        color: var(--text-color-muted);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .quick-interaction-panel,
      .editor-card {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none !important;
      }

      :host ::ng-deep .quick-interaction-panel > .mat-mdc-card-content,
      :host ::ng-deep .editor-card > .mat-mdc-card-content {
        padding: 0 !important;
      }

      .quick-interaction-form {
        gap: 0;
      }

      .networking-detail-item {
        display: block;
      }

      :host ::ng-deep .networking-detail-item > .input-item,
      :host ::ng-deep .networking-detail-item > .mat-expansion-panel {
        margin-block: calc(var(--s-half) + var(--s-quarter));
      }

      .panel-inline-control {
        min-height: 34px;
        padding: 4px 6px;
        border: 0;
        border-bottom: 1px solid var(--divider-color);
        border-radius: 0;
        background: transparent;
      }

      .quick-channel-section,
      .reconnect-section,
      .panel-textarea-wrap,
      .interaction-more {
        margin: var(--s);
      }

      .quick-channel-section,
      .reconnect-section {
        display: flex;
        flex-direction: column;
        gap: var(--s-half);
      }

      .quick-label,
      .reconnect-head small {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .reconnect-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s-half);
      }

      .channel-picker {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-half);
      }

      .channel-choice {
        min-height: 40px;
        padding: var(--s-half) var(--s);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
      }

      .channel-choice.active,
      .reconnect-presets button.active {
        border-color: var(--palette-primary-400);
        background: var(--task-detail-bg-hover);
        color: var(--text-color);
      }

      .other-channel-field {
        display: flex;
        flex-direction: column;
        gap: var(--s-quarter);
        margin-top: var(--s-quarter);
      }

      .other-channel-field input {
        min-height: 38px;
      }

      .panel-textarea-wrap label {
        display: flex;
        flex-direction: column;
        gap: var(--s-quarter);
      }

      .panel-textarea-wrap textarea {
        min-height: 74px;
      }

      .reconnect-presets {
        gap: var(--s-half);
      }

      .reconnect-presets button {
        min-height: 32px;
        padding: 4px 8px;
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        font-size: 12px;
      }

      .reconnect-date-item {
        margin: 0 calc(-1 * var(--s));
      }

      .interaction-more {
        padding: 0;
        border: 0;
        border-top: 1px solid var(--divider-color);
        border-radius: 0;
      }

      .interaction-more summary {
        padding: var(--s) 0 var(--s-half);
      }

      .interaction-more-grid {
        gap: var(--s-half);
        margin-top: 0;
      }

      .panel-form-actions {
        position: sticky;
        bottom: 0;
        z-index: 3;
        display: flex;
        justify-content: flex-end;
        gap: var(--s-half);
        margin-top: var(--s);
        padding: var(--s);
        border-top: 1px solid var(--divider-color);
        background: var(--right-panel-bg);
      }

      .native-profile-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-half);
        margin: 0 var(--s) var(--s-half);
      }

      .native-contact-links {
        gap: var(--s-half);
        margin: var(--s);
      }

      .native-contact-links a {
        min-height: 30px;
        padding: 2px 7px;
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        font-size: 12px;
      }

      .panel-context-note {
        display: flex;
        gap: var(--s);
        margin: var(--s-half) var(--s);
        padding: var(--s-half) var(--s);
        color: var(--text-color-less-intense);
      }

      .panel-context-note mat-icon {
        flex: 0 0 auto;
        color: var(--text-color-muted);
      }

      .panel-context-note small {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .panel-context-note p {
        margin: 2px 0 0;
        white-space: pre-wrap;
      }

      .compact-profile-list > div {
        grid-template-columns: minmax(90px, 0.45fr) 1fr;
        padding: var(--s-half) 0;
      }

      .compact-text-block {
        margin-top: var(--s);
      }

      .compact-text-block small,
      .compact-two-col small {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .compact-text-block p,
      .compact-two-col p {
        margin: 3px 0 0;
        white-space: pre-wrap;
      }

      .compact-two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s);
        margin-top: var(--s);
      }

      .native-quick-followup {
        margin: 0 0 var(--s-half);
      }

      .native-quick-followup input {
        min-height: 34px;
      }

      .compact-timeline .interaction {
        padding-bottom: var(--s);
      }

      .compact-timeline .interaction-details {
        grid-template-columns: 1fr;
      }

      .compact-timeline .interaction-details > div {
        padding: var(--s-half);
      }

      .compact-empty {
        margin: var(--s-half) 0;
      }

      .native-danger-zone {
        margin: var(--s-half) var(--s) var(--s2);
      }

      @media (max-width: 1100px) {
        .workspace.panel-open {
          grid-template-columns: minmax(0, 1fr) 320px;
        }
      }

      @media (max-width: 800px) {
        .workspace.panel-open {
          display: block;
        }

        .workspace.panel-open .people-panel {
          display: none;
        }

        .detail-panel {
          position: static;
          min-height: 0;
          max-height: none;
          overflow: visible;
          border-left: 0;
        }

        .panel-edge-close {
          display: none;
        }

        .compact-two-col {
          grid-template-columns: 1fr;
        }
      }

      .detail-panel .contact-form {
        grid-template-columns: 1fr;
        gap: var(--s-half);
        padding: 0 var(--s);
      }

      .detail-panel .contact-form .wide {
        grid-column: auto;
      }

      .detail-panel .contact-form .form-section {
        margin-top: var(--s-half);
        padding: var(--s) 0 var(--s-half);
      }

      .detail-panel .contact-form label {
        gap: var(--s-quarter);
      }

      .contact-editor-date {
        margin-inline: calc(-1 * var(--s));
      }

      .editor-panel-title {
        margin-bottom: var(--s-half);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingPageComponent {
  readonly networking = inject(NetworkingService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _dateTimeFormat = inject(DateTimeFormatService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly today = getDbDateStr();
  readonly query = signal('');
  readonly filter = signal<NetworkingFilter>('ALL');
  readonly selectedId = signal<string | null>(null);
  readonly contactEditorOpen = signal(false);
  readonly editingContactId = signal<string | null>(null);
  readonly interactionEditorOpen = signal(false);
  readonly interactionContactId = signal<string>('');
  readonly reconnectChoice = signal<ReconnectChoice>('DEFAULT');

  readonly cadenceOptions = NETWORK_CADENCE_OPTIONS;
  readonly relationshipOptions = NETWORK_RELATIONSHIP_OPTIONS;
  readonly importanceOptions = NETWORK_IMPORTANCE_OPTIONS;
  readonly channelOptions = NETWORK_CHANNEL_OPTIONS;
  readonly quickChannelOptions = NETWORK_CHANNEL_OPTIONS.filter((item) =>
    [
      'WHATSAPP',
      'INSTAGRAM',
      'UNIVERSITY',
      'IN_PERSON',
      'MEETING',
      'ONLINE_MEETING',
      'PHONE',
      'OTHER',
    ].includes(item.value),
  );

  readonly filters: ReadonlyArray<{ id: NetworkingFilter; label: string }> = [
    { id: 'ALL', label: 'Toate' },
    { id: 'DUE', label: 'De contactat' },
    { id: 'UPCOMING', label: 'Urmează' },
    { id: 'NO_REMINDER', label: 'Fără reminder' },
    { id: 'ARCHIVED', label: 'Arhivate' },
  ];

  contactDraft: ContactDraft = this._emptyContactDraft();
  interactionDraft: InteractionDraft = this._emptyInteractionDraft();

  readonly filteredContacts = computed(() => {
    const source =
      this.filter() === 'ARCHIVED'
        ? this.networking.archivedContacts()
        : this.networking.search(this.query());

    const query = this.query().trim();
    const data =
      this.filter() === 'ARCHIVED' && query
        ? source.filter((contact) =>
            this.networking
              .search(query, true)
              .some((candidate) => candidate.id === contact.id),
          )
        : source;

    switch (this.filter()) {
      case 'DUE':
        return data.filter((contact) => this.isDue(contact));
      case 'UPCOMING':
        return data.filter(
          (contact) =>
            !!contact.nextContactDay &&
            contact.nextContactDay > this.today &&
            contact.nextContactDay <= addCalendarDays(this.today, 7),
        );
      case 'NO_REMINDER':
        return data.filter((contact) => !contact.nextContactDay);
      case 'ARCHIVED':
      case 'ALL':
      default:
        return data;
    }
  });

  readonly groupedContacts = computed(() => {
    const contacts = this.filteredContacts();
    const overdue = contacts.filter(
      (contact) => !!contact.nextContactDay && contact.nextContactDay < this.today,
    );
    const today = contacts.filter((contact) => contact.nextContactDay === this.today);
    const upcoming = contacts.filter(
      (contact) =>
        !!contact.nextContactDay &&
        contact.nextContactDay > this.today &&
        contact.nextContactDay <= addCalendarDays(this.today, 7),
    );
    const later = contacts.filter(
      (contact) =>
        !!contact.nextContactDay &&
        contact.nextContactDay > addCalendarDays(this.today, 7),
    );
    const noReminder = contacts.filter((contact) => !contact.nextContactDay);

    return [
      { id: 'overdue', label: 'Necesită atenție', emoji: '🔴', contacts: overdue },
      { id: 'today', label: 'Astăzi', emoji: '🟡', contacts: today },
      { id: 'upcoming', label: 'În următoarele 7 zile', emoji: '🟢', contacts: upcoming },
      { id: 'later', label: 'Mai târziu', emoji: '🔵', contacts: later },
      { id: 'no-reminder', label: 'Fără reminder', emoji: '⚪', contacts: noReminder },
    ];
  });

  readonly selectedContact = computed(() => this.networking.contact(this.selectedId()));
  readonly interactionContact = computed(() =>
    this.networking.contact(this.interactionContactId()),
  );

  readonly interactions = computed(() => {
    const id = this.selectedId();
    return id ? this.networking.interactionsForContact(id) : [];
  });

  readonly latestInteraction = computed(() => this.interactions()[0]);

  readonly panelOpen = computed(
    () =>
      this.contactEditorOpen() ||
      this.interactionEditorOpen() ||
      !!this.selectedContact(),
  );

  readonly followUps = computed(() => {
    const id = this.selectedId();
    return id ? this.networking.followUpsForContact(id) : [];
  });

  readonly openFollowUps = computed(() =>
    this.followUps().filter((item) => item.status === 'OPEN'),
  );

  constructor() {
    effect(() => {
      const queryContact = this._queryParams().get('contact');
      if (queryContact && this.networking.contact(queryContact)) {
        this.selectedId.set(queryContact);
        this.filter.set('ALL');
        return;
      }

      const selected = this.selectedId();
      if (selected && !this.networking.contact(selected)) {
        this.selectedId.set(null);
      }
    });
  }

  filterCount(filter: NetworkingFilter): number {
    switch (filter) {
      case 'DUE':
        return this.networking.dueContacts().length;
      case 'UPCOMING':
        return this.networking.upcomingContacts().length;
      case 'NO_REMINDER':
        return this.networking.contacts().filter((contact) => !contact.nextContactDay)
          .length;
      case 'ARCHIVED':
        return this.networking.archivedContacts().length;
      case 'ALL':
      default:
        return this.networking.contacts().length;
    }
  }

  isDue(contact: NetworkContact): boolean {
    return !!contact.nextContactDay && contact.nextContactDay <= this.today;
  }

  selectContact(id: string): void {
    this.selectedId.set(id);
    this.contactEditorOpen.set(false);
    this.interactionEditorOpen.set(false);
  }

  startNewContact(): void {
    this.editingContactId.set(null);
    this.contactDraft = this._emptyContactDraft();
    this.contactEditorOpen.set(true);
    this.interactionEditorOpen.set(false);
  }

  startEditContact(contact: NetworkContact): void {
    this.editingContactId.set(contact.id);
    this.contactDraft = {
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      instagram: contact.instagram || '',
      facebook: contact.facebook || '',
      linkedin: contact.linkedin || '',
      city: contact.city || '',
      region: contact.region || '',
      country: contact.country || '',
      occupation: contact.occupation || '',
      role: contact.role || '',
      company: contact.company || '',
      industry: contact.industry || '',
      metThrough: contact.metThrough || '',
      introducedByContactId: contact.introducedByContactId || '',
      metAt: contact.metAt || '',
      metOn: contact.metOn || '',
      relationshipType: contact.relationshipType,
      importance: contact.importance,
      tags: contact.tags.join(', '),
      interests: contact.interests || '',
      canHelpWith: contact.canHelpWith || '',
      canHelpMeWith: contact.canHelpMeWith || '',
      notes: contact.notes || '',
      cadence: contact.cadence,
      cadenceDays: contact.cadenceDays ? String(contact.cadenceDays) : '',
      nextContactDay: contact.nextContactDay || '',
      nextTopic: contact.nextTopic || '',
    };
    this.contactEditorOpen.set(true);
    this.interactionEditorOpen.set(false);
  }

  cancelContactEdit(): void {
    this.contactEditorOpen.set(false);
    this.editingContactId.set(null);
  }

  saveContact(): void {
    const name = this.contactDraft.name.trim();
    if (!name) return;

    const input: NetworkContactInput = {
      name,
      phone: this._clean(this.contactDraft.phone),
      email: this._clean(this.contactDraft.email),
      instagram: this._clean(this.contactDraft.instagram),
      facebook: this._clean(this.contactDraft.facebook),
      linkedin: this._clean(this.contactDraft.linkedin),
      city: this._clean(this.contactDraft.city),
      region: this._clean(this.contactDraft.region),
      country: this._clean(this.contactDraft.country),
      occupation: this._clean(this.contactDraft.occupation),
      role: this._clean(this.contactDraft.role),
      company: this._clean(this.contactDraft.company),
      industry: this._clean(this.contactDraft.industry),
      metThrough: this._clean(this.contactDraft.metThrough),
      introducedByContactId: this.contactDraft.introducedByContactId || null,
      metAt: this._clean(this.contactDraft.metAt),
      metOn: this.contactDraft.metOn || null,
      relationshipType: this.contactDraft.relationshipType,
      importance: this.contactDraft.importance,
      tags: this._tags(this.contactDraft.tags),
      interests: this._clean(this.contactDraft.interests),
      canHelpWith: this._clean(this.contactDraft.canHelpWith),
      canHelpMeWith: this._clean(this.contactDraft.canHelpMeWith),
      notes: this._clean(this.contactDraft.notes),
      cadence: this.contactDraft.cadence,
      cadenceDays: this.contactDraft.cadenceDays
        ? Math.max(1, Number(this.contactDraft.cadenceDays))
        : null,
      nextContactDay: this.contactDraft.nextContactDay || null,
      nextTopic: this._clean(this.contactDraft.nextTopic),
    };

    const editingId = this.editingContactId();
    if (editingId) {
      this.networking.updateContact(editingId, input);
      this.selectedId.set(editingId);
    } else {
      this.selectedId.set(this.networking.addContact(input));
    }

    this.contactEditorOpen.set(false);
    this.editingContactId.set(null);
    this.filter.set('ALL');
  }

  startInteraction(contactId?: string): void {
    this.interactionDraft = this._emptyInteractionDraft();
    this.interactionContactId.set(contactId || this.selectedId() || '');
    this.contactEditorOpen.set(false);
    this.interactionEditorOpen.set(true);
    this.setInteractionDefaultNextContact();
  }

  onInteractionContactChange(contactId: string): void {
    this.interactionContactId.set(contactId);
    this.setInteractionDefaultNextContact();
  }

  selectInteractionChannel(channel: NetworkInteractionChannel): void {
    this.interactionDraft.channel = channel;
    if (channel !== 'OTHER') {
      this.interactionDraft.channelCustom = '';
    }
  }

  saveInteraction(contactId?: string): void {
    const targetId = contactId || this.interactionContactId();
    if (!targetId) return;
    const at = new Date(this.interactionDraft.at).getTime();
    const safeAt = Number.isFinite(at) ? at : Date.now();

    const input: NetworkInteractionInput = {
      at: safeAt,
      channel: this.interactionDraft.channel,
      channelCustom:
        this.interactionDraft.channel === 'OTHER'
          ? this._clean(this.interactionDraft.channelCustom)
          : undefined,
      location: this._clean(this.interactionDraft.location),
      summary: this.interactionDraft.summary.trim(),
      learned: this._clean(this.interactionDraft.learned),
      iPromised: this._clean(this.interactionDraft.iPromised),
      theyPromised: this._clean(this.interactionDraft.theyPromised),
      nextStep: this._clean(this.interactionDraft.nextStep),
      nextTopic: this._clean(this.interactionDraft.nextTopic),
      nextContactDay: this.interactionDraft.nextContactDay || undefined,
      followUpTitle: this._clean(this.interactionDraft.followUpTitle),
      followUpDueDay: this.interactionDraft.followUpDueDay || null,
    };

    this.networking.logInteraction(targetId, input);
    this.selectedId.set(targetId);
    this.interactionEditorOpen.set(false);
    this.interactionContactId.set('');
    this.reconnectChoice.set('DEFAULT');
    this.interactionDraft = this._emptyInteractionDraft();
  }

  addFollowUp(contactId: string, title: string, dueDay: string): void {
    if (!title.trim()) return;
    this.networking.addFollowUp(contactId, title, dueDay || null);
  }

  toggleFollowUp(id: string, current: string): void {
    this.networking.setFollowUpStatus(id, current === 'DONE' ? 'OPEN' : 'DONE');
  }

  createTask(id: string): void {
    this.networking.createTaskForFollowUp(id);
  }

  archiveSelected(id: string): void {
    this.networking.archiveContact(id, true);
    this.filter.set('ALL');
    this.selectedId.set(null);
  }

  closePanel(): void {
    this.contactEditorOpen.set(false);
    this.interactionEditorOpen.set(false);
    this.editingContactId.set(null);
    this.interactionContactId.set('');
    this.reconnectChoice.set('DEFAULT');
    this.selectedId.set(null);
  }

  setInteractionDefaultNextContact(): void {
    const contact = this.interactionContact();
    this.reconnectChoice.set('DEFAULT');
    if (!contact) {
      this.interactionDraft.nextContactDay = '';
      return;
    }

    const at = new Date(this.interactionDraft.at).getTime();
    const fromDay = timestampToLocalDay(Number.isFinite(at) ? at : Date.now());
    this.interactionDraft.nextContactDay =
      getNextContactDay(contact.cadence, fromDay, contact.cadenceDays) || '';
  }

  setInteractionNextContact(days: number, choice: ReconnectChoice): void {
    const at = new Date(this.interactionDraft.at).getTime();
    const fromDay = timestampToLocalDay(Number.isFinite(at) ? at : Date.now());
    this.interactionDraft.nextContactDay = addCalendarDays(fromDay, days);
    this.reconnectChoice.set(choice);
  }

  setInteractionNextMonth(): void {
    const at = new Date(this.interactionDraft.at).getTime();
    const fromDay = timestampToLocalDay(Number.isFinite(at) ? at : Date.now());
    this.interactionDraft.nextContactDay =
      getNextContactDay('MONTHLY', fromDay) || addCalendarDays(fromDay, 30);
    this.reconnectChoice.set('1M');
  }

  openInteractionDateDialog(): void {
    const current = new Date(this.interactionDraft.at);
    const day = Number.isFinite(current.getTime()) ? getDbDateStr(current) : this.today;
    const time = Number.isFinite(current.getTime())
      ? `${String(current.getHours()).padStart(2, '0')}:${String(
          current.getMinutes(),
        ).padStart(2, '0')}`
      : undefined;

    this._matDialog
      .open(DialogDeadlineComponent, {
        data: {
          isSelectDeadlineOnly: true,
          isDateOnly: false,
          selectDateLabel: 'Alege data',
          targetDeadlineDay: day,
          targetDeadlineTime: time,
          minDate: new Date(2000, 0, 1),
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result?.date) return;
        const selected = new Date(result.date);
        if (result.time) {
          const [hours, minutes] = result.time.split(':').map(Number);
          selected.setHours(hours || 0, minutes || 0, 0, 0);
        } else {
          selected.setHours(12, 0, 0, 0);
        }
        this.interactionDraft.at = this._toLocalDateTimeInput(selected);
        this._recalculateReconnectFromInteractionDate();
      });
  }

  openNextContactDateDialog(): void {
    this._openNetworkingDateDialog(
      this.interactionDraft.nextContactDay || undefined,
      'Alege data următorului contact',
      (day) => {
        this.interactionDraft.nextContactDay = day;
        this.reconnectChoice.set('CUSTOM');
      },
    );
  }

  openContactDraftNextDateDialog(): void {
    this._openNetworkingDateDialog(
      this.contactDraft.nextContactDay || undefined,
      'Alege următorul contact',
      (day) => {
        this.contactDraft.nextContactDay = day;
      },
    );
  }

  openContactNextDateDialog(contact: NetworkContact): void {
    this._openNetworkingDateDialog(
      contact.nextContactDay || undefined,
      'Alege următorul contact',
      (day) => this.networking.updateContact(contact.id, { nextContactDay: day }),
    );
  }

  interactionAtLabel(): string {
    const at = new Date(this.interactionDraft.at).getTime();
    return Number.isFinite(at) ? this.dateTimeLabel(at) : 'Alege data';
  }

  reconnectSelectionLabel(): string {
    const day = this.interactionDraft.nextContactDay;
    const contact = this.interactionContact();
    const choice = this.reconnectChoice();

    if (!day) {
      return choice === 'DEFAULT' && contact
        ? `Default · ${this.cadenceExactLabel(contact.cadence, contact.cadenceDays)} · fără reminder`
        : 'Alege data';
    }

    const prefix =
      choice === 'DEFAULT' && contact
        ? `Default · ${this.cadenceExactLabel(contact.cadence, contact.cadenceDays)}`
        : choice === '3D'
          ? '3 zile'
          : choice === '7D'
            ? '1 săptămână'
            : choice === '14D'
              ? '2 săptămâni'
              : choice === '1M'
                ? '1 lună'
                : 'Dată aleasă';

    return `${prefix} · ${this.dayLabel(day)}`;
  }

  cadenceExactLabel(value: NetworkContactCadence, cadenceDays?: number | null): string {
    switch (value) {
      case 'WEEKLY':
        return '1 săptămână';
      case 'BIWEEKLY':
        return '2 săptămâni';
      case 'MONTHLY':
        return '1 lună';
      case 'BIMONTHLY':
        return '2 luni';
      case 'QUARTERLY':
        return '3 luni';
      case 'HALF_YEAR':
        return '6 luni';
      case 'YEARLY':
        return '1 an';
      case 'CUSTOM':
        return cadenceDays ? `${cadenceDays} zile` : 'Personalizat';
      case 'NONE':
      default:
        return 'Fără reminder';
    }
  }

  dayLabel(day: string): string {
    const date = new Date(`${day}T12:00:00`);
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  channelDisplayLabel(interaction: NetworkInteraction): string {
    if (interaction.channel === 'OTHER' && interaction.channelCustom) {
      return interaction.channelCustom;
    }
    return this.channelLabel(interaction.channel);
  }

  latestInteractionFor(contactId: string): NetworkInteraction | undefined {
    return this.networking.interactionsForContact(contactId)[0];
  }

  nextContactLabel(contact: NetworkContact): string {
    if (!contact.nextContactDay) return 'Fără reminder';
    const diff = this._dayDiff(contact.nextContactDay);
    if (diff < 0) {
      const days = Math.abs(diff);
      return `Întârziat ${days} ${days === 1 ? 'zi' : 'zile'}`;
    }
    if (diff === 0) return 'Contactează azi';
    if (diff === 1) return 'Mâine';
    return `Peste ${diff} zile`;
  }

  relativeTimeLabel(timestamp: number): string {
    const day = new Date(timestamp);
    const today = new Date();
    day.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
    if (diff <= 0) return 'azi';
    if (diff === 1) return 'ieri';
    if (diff < 7) return `acum ${diff} zile`;
    const weeks = Math.floor(diff / 7);
    if (weeks < 5) return `acum ${weeks} ${weeks === 1 ? 'săptămână' : 'săptămâni'}`;
    const months = Math.floor(diff / 30);
    return `acum ${Math.max(1, months)} ${months === 1 ? 'lună' : 'luni'}`;
  }

  channelIcon(value: NetworkInteractionChannel): string {
    switch (value) {
      case 'WHATSAPP':
        return '💬';
      case 'INSTAGRAM':
        return '📸';
      case 'UNIVERSITY':
        return '🎓';
      case 'IN_PERSON':
        return '🤝';
      case 'MEETING':
        return '👥';
      case 'ONLINE_MEETING':
        return '💻';
      case 'PHONE':
        return '📞';
      case 'EMAIL':
        return '✉️';
      case 'LINKEDIN':
        return '💼';
      case 'FACEBOOK':
        return '🌐';
      case 'EVENT':
        return '🎟️';
      default:
        return '•••';
    }
  }

  introductionOptions(): NetworkContact[] {
    const editingId = this.editingContactId();
    return this.networking.contacts().filter((contact) => contact.id !== editingId);
  }

  introducedByName(contact: NetworkContact): string {
    return this.networking.contact(contact.introducedByContactId)?.name || '';
  }

  locationLabel(contact: NetworkContact): string {
    return [contact.city, contact.region, contact.country].filter(Boolean).join(', ');
  }

  relationshipLabel(value: NetworkRelationshipType): string {
    return this.relationshipOptions.find((item) => item.value === value)?.label ?? value;
  }

  importanceLabel(value: NetworkImportance): string {
    return this.importanceOptions.find((item) => item.value === value)?.label ?? value;
  }

  cadenceLabel(value: NetworkContactCadence, cadenceDays?: number | null): string {
    if (value === 'CUSTOM' && cadenceDays) return `Every ${cadenceDays} days`;
    return this.cadenceOptions.find((item) => item.value === value)?.label ?? value;
  }

  channelLabel(value: NetworkInteractionChannel): string {
    return this.channelOptions.find((item) => item.value === value)?.label ?? value;
  }

  dateLabel(timestamp: number): string {
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(timestamp));
  }

  dateTimeLabel(timestamp: number): string {
    return new Intl.DateTimeFormat(this._dateTimeFormat.textLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  socialUrl(type: 'instagram' | 'facebook' | 'linkedin', raw: string): string {
    const value = raw.trim();
    if (/^https?:\/\//i.test(value)) return value;
    const clean = value.replace(/^@/, '').replace(/^\/+/, '');
    if (type === 'instagram') return `https://instagram.com/${clean}`;
    if (type === 'facebook') return `https://facebook.com/${clean}`;
    return clean.includes('linkedin.com')
      ? `https://${clean}`
      : `https://linkedin.com/in/${clean}`;
  }

  private _emptyContactDraft(): ContactDraft {
    return {
      name: '',
      phone: '',
      email: '',
      instagram: '',
      facebook: '',
      linkedin: '',
      city: '',
      region: '',
      country: 'România',
      occupation: '',
      role: '',
      company: '',
      industry: '',
      metThrough: '',
      introducedByContactId: '',
      metAt: '',
      metOn: '',
      relationshipType: 'PROFESSIONAL',
      importance: 'NORMAL',
      tags: '',
      interests: '',
      canHelpWith: '',
      canHelpMeWith: '',
      notes: '',
      cadence: 'MONTHLY',
      cadenceDays: '',
      nextContactDay: '',
      nextTopic: '',
    };
  }

  private _emptyInteractionDraft(): InteractionDraft {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    return {
      at: localIso,
      channel: 'WHATSAPP',
      channelCustom: '',
      location: '',
      summary: '',
      learned: '',
      iPromised: '',
      theyPromised: '',
      nextStep: '',
      nextTopic: '',
      nextContactDay: '',
      followUpTitle: '',
      followUpDueDay: '',
    };
  }

  private _recalculateReconnectFromInteractionDate(): void {
    switch (this.reconnectChoice()) {
      case '3D':
        this.setInteractionNextContact(3, '3D');
        break;
      case '7D':
        this.setInteractionNextContact(7, '7D');
        break;
      case '14D':
        this.setInteractionNextContact(14, '14D');
        break;
      case '1M':
        this.setInteractionNextMonth();
        break;
      case 'CUSTOM':
        break;
      case 'DEFAULT':
      default:
        this.setInteractionDefaultNextContact();
    }
  }

  private _openNetworkingDateDialog(
    currentDay: string | undefined,
    label: string,
    onSelect: (day: string) => void,
  ): void {
    this._matDialog
      .open(DialogDeadlineComponent, {
        data: {
          isSelectDeadlineOnly: true,
          isDateOnly: true,
          selectDateLabel: label,
          targetDeadlineDay: currentDay,
          minDate: new Date(),
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result?.date) return;
        onSelect(getDbDateStr(new Date(result.date)));
      });
  }

  private _toLocalDateTimeInput(date: Date): string {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private _dayDiff(day: string): number {
    const target = new Date(`${day}T12:00:00`);
    const base = new Date(`${this.today}T12:00:00`);
    return Math.round((target.getTime() - base.getTime()) / 86400000);
  }

  private _clean(value: string): string | undefined {
    const clean = value.trim();
    return clean || undefined;
  }

  private _tags(raw: string): string[] {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}
