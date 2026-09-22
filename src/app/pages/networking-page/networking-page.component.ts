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
import { addCalendarDays } from '../../features/networking/networking.util';

type NetworkingFilter = 'ALL' | 'DUE' | 'UPCOMING' | 'NO_REMINDER' | 'ARCHIVED';
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
                              {{ channelLabel(last.channel) }} ·
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
                        <span class="channel-emoji">{{
                                channelIcon(last.channel)
                              }}</span>
                        {{ channelLabel(last.channel) }} ·
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
          @if (interactionEditorOpen()) {
            <mat-card class="quick-interaction-panel">
              <mat-card-content>
                <div class="section-head quick-panel-head">
                  <div>
                    <h2>Am vorbit</h2>
                    <p>Înregistrează conversația în câteva secunde.</p>
                  </div>
                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Închide"
                    (click)="closePanel()"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                <form
                  class="quick-interaction-form"
                  (ngSubmit)="saveInteraction()"
                >
                  <label class="quick-contact-select">
                    <span>Persoană</span>
                    <select
                      name="quickInteractionContact"
                      [ngModel]="interactionContactId()"
                      (ngModelChange)="interactionContactId.set($event)"
                    >
                      <option value="">Alege persoana...</option>
                      @for (person of networking.contacts(); track person.id) {
                        <option [value]="person.id">{{ person.name }}</option>
                      }
                    </select>
                  </label>

                  <div class="quick-field">
                    <span class="quick-label">Cum ați vorbit?</span>
                    <div class="channel-picker">
                      @for (item of quickChannelOptions; track item.value) {
                        <button
                          type="button"
                          class="channel-choice"
                          [class.active]="interactionDraft.channel === item.value"
                          (click)="interactionDraft.channel = item.value"
                        >
                          <span>{{ channelIcon(item.value) }}</span>
                          <strong>{{ item.label }}</strong>
                        </button>
                      }
                    </div>
                  </div>

                  <label>
                    <span>Când?</span>
                    <input
                      name="quickInteractionAt"
                      type="datetime-local"
                      [(ngModel)]="interactionDraft.at"
                    />
                  </label>

                  <label>
                    <span>Ce a fost important? <small>opțional</small></span>
                    <textarea
                      name="quickInteractionSummary"
                      rows="3"
                      placeholder="O notă scurtă ca să îți amintești contextul..."
                      [(ngModel)]="interactionDraft.summary"
                    ></textarea>
                  </label>

                  <div class="quick-field">
                    <span class="quick-label">Când vrei să vorbiți din nou?</span>
                    <div class="reconnect-presets">
                      <button
                        type="button"
                        (click)="setInteractionNextContact(3)"
                      >
                        3 zile
                      </button>
                      <button
                        type="button"
                        (click)="setInteractionNextContact(7)"
                      >
                        1 săpt
                      </button>
                      <button
                        type="button"
                        (click)="setInteractionNextContact(14)"
                      >
                        2 săpt
                      </button>
                      <button
                        type="button"
                        (click)="setInteractionNextContact(30)"
                      >
                        1 lună
                      </button>
                    </div>
                    <input
                      name="quickNextContactDay"
                      type="date"
                      [(ngModel)]="interactionDraft.nextContactDay"
                    />
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

                  <div class="form-actions">
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
                      [disabled]="!interactionContactId()"
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
                <div class="section-head">
                  <div>
                    <h2>
                      {{ editingContactId() ? 'Editează persoana' : 'Persoană nouă' }}
                    </h2>
                    <p>Un singur formular simplu. Completează doar ce îți este util.</p>
                  </div>
                  <button
                    mat-icon-button
                    aria-label="Închide"
                    (click)="cancelContactEdit()"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

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
                  <label>
                    <span>Următorul contact</span>
                    <small
                      >Poți seta manual data sau o poți lăsa să urmeze frecvența.</small
                    >
                    <input
                      name="nextContactDay"
                      type="date"
                      [(ngModel)]="contactDraft.nextContactDay"
                    />
                  </label>
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
            <section class="profile">
              <header class="profile-head">
                <div>
                  <div class="profile-title-line">
                    <h2>{{ contact.name }}</h2>
                    <span class="importance">
                      {{ importanceLabel(contact.importance) }}
                    </span>
                  </div>
                  <p>
                    @if (contact.occupation) {
                      {{ contact.occupation }}
                    }
                    @if (contact.role) {
                      · {{ contact.role }}
                    }
                    @if (contact.company) {
                      · {{ contact.company }}
                    }
                    @if (contact.city) {
                      · {{ contact.city }}
                    }
                  </p>
                </div>
                <div class="profile-actions">
                  @if (!contact.isArchived) {
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="startInteraction()"
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
                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Închide detaliile"
                    (click)="closePanel()"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </header>

              <div class="contact-links">
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

              <section class="context-grid">
                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>Ținem legătura</strong>
                      @if (contact.nextContactDay) {
                        <span
                          class="status-pill"
                          [class.overdue]="contact.nextContactDay < today"
                          [class.due-now]="contact.nextContactDay === today"
                        >
                          {{ contact.nextContactDay }}
                        </span>
                      }
                    </div>
                    <dl>
                      <div>
                        <dt>Ultimul contact</dt>
                        <dd>
                          {{
                            contact.lastContactAt ? dateLabel(contact.lastContactAt) : '—'
                          }}
                        </dd>
                      </div>
                      <div>
                        <dt>Frecvență</dt>
                        <dd>{{ cadenceLabel(contact.cadence, contact.cadenceDays) }}</dd>
                      </div>
                      <div>
                        <dt>Data viitoare</dt>
                        <dd>{{ contact.nextContactDay || '—' }}</dd>
                      </div>
                    </dl>
                    @if (contact.nextTopic) {
                      <div class="next-topic">
                        <small>Data viitoare</small>
                        <p>{{ contact.nextTopic }}</p>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>

                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>Context rapid</strong>
                      <mat-icon>psychology_alt</mat-icon>
                    </div>
                    @if (latestInteraction(); as last) {
                      <p class="last-summary">{{ last.summary }}</p>
                      @if (last.learned) {
                        <div class="context-line">
                          <b>Am aflat:</b> {{ last.learned }}
                        </div>
                      }
                      @if (last.iPromised) {
                        <div class="context-line">
                          <b>Am promis:</b> {{ last.iPromised }}
                        </div>
                      }
                      @if (last.theyPromised) {
                        <div class="context-line">
                          <b>A promis:</b> {{ last.theyPromised }}
                        </div>
                      }
                    } @else {
                      <p class="muted">Nu există încă nicio conversație înregistrată.</p>
                    }
                  </mat-card-content>
                </mat-card>
              </section>

              @if (interactionEditorOpen()) {
                <mat-card class="interaction-editor">
                  <mat-card-content>
                    <div class="section-head">
                      <div>
                        <h3>Înregistrează conversația</h3>
                        <p>
                          Scrie esențialul, ca data viitoare să ai imediat tot contextul.
                        </p>
                      </div>
                      <button
                        mat-icon-button
                        (click)="interactionEditorOpen.set(false)"
                        aria-label="Închide"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>

                    <form
                      class="interaction-form"
                      (ngSubmit)="saveInteraction(contact.id)"
                    >
                      <label>
                        <span>Data și ora</span>
                        <input
                          name="interactionAt"
                          type="datetime-local"
                          [(ngModel)]="interactionDraft.at"
                        />
                      </label>
                      <label>
                        <span>Cum am vorbit</span>
                        <select
                          name="channel"
                          [(ngModel)]="interactionDraft.channel"
                        >
                          @for (item of channelOptions; track item.value) {
                            <option [value]="item.value">{{ item.label }}</option>
                          }
                        </select>
                      </label>
                      <label class="wide">
                        <span>Unde / context</span>
                        <input
                          name="interactionLocation"
                          [(ngModel)]="interactionDraft.location"
                        />
                      </label>
                      <label class="wide">
                        <span>Ce am vorbit? *</span>
                        <textarea
                          name="summary"
                          rows="5"
                          required
                          placeholder="Rezumatul conversației și ideile importante..."
                          [(ngModel)]="interactionDraft.summary"
                        ></textarea>
                      </label>
                      <label class="wide">
                        <span>Ce am aflat nou?</span>
                        <textarea
                          name="learned"
                          rows="3"
                          [(ngModel)]="interactionDraft.learned"
                        ></textarea>
                      </label>
                      <label>
                        <span>Ce am promis eu?</span>
                        <textarea
                          name="iPromised"
                          rows="3"
                          [(ngModel)]="interactionDraft.iPromised"
                        ></textarea>
                      </label>
                      <label>
                        <span>Ce a promis persoana?</span>
                        <textarea
                          name="theyPromised"
                          rows="3"
                          [(ngModel)]="interactionDraft.theyPromised"
                        ></textarea>
                      </label>
                      <label class="wide">
                        <span>Următorul pas</span>
                        <input
                          name="nextStep"
                          [(ngModel)]="interactionDraft.nextStep"
                        />
                      </label>
                      <label class="wide">
                        <span>Despre ce să vorbesc data viitoare?</span>
                        <input
                          name="interactionNextTopic"
                          [(ngModel)]="interactionDraft.nextTopic"
                        />
                      </label>
                      <label>
                        <span>Următorul contact</span>
                        <input
                          name="interactionNextContactDay"
                          type="date"
                          [(ngModel)]="interactionDraft.nextContactDay"
                        />
                        <small
                          >Dacă rămâne gol, se calculează din frecvența persoanei.</small
                        >
                      </label>
                      <label>
                        <span>Follow-up de făcut</span>
                        <input
                          name="followUpTitle"
                          placeholder="ex. Trimite CV-ul"
                          [(ngModel)]="interactionDraft.followUpTitle"
                        />
                      </label>
                      @if (interactionDraft.followUpTitle.trim()) {
                        <label>
                          <span>Termen follow-up</span>
                          <input
                            name="followUpDueDay"
                            type="date"
                            [(ngModel)]="interactionDraft.followUpDueDay"
                          />
                        </label>
                      }

                      <div class="form-actions wide">
                        <button
                          type="button"
                          mat-button
                          (click)="interactionEditorOpen.set(false)"
                        >
                          Anulează
                        </button>
                        <button
                          type="submit"
                          mat-flat-button
                          color="primary"
                          [disabled]="!interactionDraft.summary.trim()"
                        >
                          <mat-icon>save</mat-icon>
                          Salvează conversația
                        </button>
                      </div>
                    </form>
                  </mat-card-content>
                </mat-card>
              }

              <section class="profile-grid">
                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>Despre persoană</strong>
                      <span>{{ relationshipLabel(contact.relationshipType) }}</span>
                    </div>
                    <dl>
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
                      @if (contact.metOn) {
                        <div>
                          <dt>Din</dt>
                          <dd>{{ contact.metOn }}</dd>
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
                      <div class="text-block">
                        <small>Interese</small>
                        <p>{{ contact.interests }}</p>
                      </div>
                    }
                    @if (contact.notes) {
                      <div class="text-block">
                        <small>Note</small>
                        <p>{{ contact.notes }}</p>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>

                <mat-card>
                  <mat-card-content>
                    <div class="mini-head">
                      <strong>Relație reciprocă</strong>
                      <mat-icon>handshake</mat-icon>
                    </div>
                    <div class="text-block">
                      <small>Pot să îl/o ajut cu</small>
                      <p>{{ contact.canHelpWith || '—' }}</p>
                    </div>
                    <div class="text-block">
                      <small>Mă poate ajuta cu</small>
                      <p>{{ contact.canHelpMeWith || '—' }}</p>
                    </div>
                  </mat-card-content>
                </mat-card>
              </section>

              <mat-card class="followup-card">
                <mat-card-content>
                  <div class="section-head">
                    <div>
                      <h3>Follow-ups & promisiuni</h3>
                      <p>Acțiuni concrete separate de simplul reminder de networking.</p>
                    </div>
                    <span>{{ openFollowUps().length }} deschise</span>
                  </div>

                  <div class="quick-followup">
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
                      Adaugă
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
                        [attr.aria-label]="
                          item.status === 'DONE' ? 'Redeschide' : 'Finalizat'
                        "
                      >
                        <mat-icon>{{
                          item.status === 'DONE'
                            ? 'check_circle'
                            : 'radio_button_unchecked'
                        }}</mat-icon>
                      </button>
                      <span class="grow">{{ item.title }}</span>
                      @if (item.dueDay) {
                        <span class="chip">{{ item.dueDay }}</span>
                      }
                      @if (item.taskId) {
                        <span class="chip linked">Task creat</span>
                      } @else if (item.status === 'OPEN') {
                        <button
                          mat-button
                          (click)="createTask(item.id)"
                        >
                          <mat-icon>add_task</mat-icon>
                          Task
                        </button>
                      }
                    </div>
                  }
                  @if (!followUps().length) {
                    <p class="muted">Nu există follow-up-uri pentru această persoană.</p>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card class="timeline-card">
                <mat-card-content>
                  <div class="section-head">
                    <div>
                      <h3>Istoric conversații</h3>
                      <p>
                        Fiecare conversație rămâne în cronologie; nimic nu se suprascrie.
                      </p>
                    </div>
                    <span>{{ interactions().length }}</span>
                  </div>

                  <div class="timeline">
                    @for (item of interactions(); track item.id) {
                      <article class="interaction">
                        <div class="timeline-marker"></div>
                        <div class="interaction-body">
                          <header>
                            <div>
                              <strong>{{ dateTimeLabel(item.at) }}</strong>
                              <span class="channel">
                                {{ channelLabel(item.channel) }}
                              </span>
                            </div>
                            @if (item.location) {
                              <span class="muted">{{ item.location }}</span>
                            }
                          </header>
                          <p class="summary">{{ item.summary }}</p>

                          <div class="interaction-details">
                            @if (item.learned) {
                              <div>
                                <small>Ce am aflat</small>
                                <p>{{ item.learned }}</p>
                              </div>
                            }
                            @if (item.iPromised) {
                              <div>
                                <small>Am promis</small>
                                <p>{{ item.iPromised }}</p>
                              </div>
                            }
                            @if (item.theyPromised) {
                              <div>
                                <small>A promis</small>
                                <p>{{ item.theyPromised }}</p>
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
                      <div class="timeline-empty">
                        <mat-icon>forum</mat-icon>
                        <p>
                          Nu ai înregistrat încă o conversație. După următoarea discuție
                          apasă „Am vorbit”.
                        </p>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>

              <footer class="danger-zone">
                @if (contact.isArchived) {
                  <button
                    mat-button
                    (click)="networking.archiveContact(contact.id, false)"
                  >
                    <mat-icon>unarchive</mat-icon>
                    Reactivează persoana
                  </button>
                } @else {
                  <button
                    mat-button
                    (click)="archiveSelected(contact.id)"
                  >
                    <mat-icon>archive</mat-icon>
                    Arhivează persoana
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkingPageComponent {
  readonly networking = inject(NetworkingService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _dateTimeFormat = inject(DateTimeFormatService);
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
  }

  saveInteraction(contactId?: string): void {
    const targetId = contactId || this.interactionContactId();
    if (!targetId) return;
    const at = new Date(this.interactionDraft.at).getTime();
    const safeAt = Number.isFinite(at) ? at : Date.now();

    const input: NetworkInteractionInput = {
      at: safeAt,
      channel: this.interactionDraft.channel,
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
    this.selectedId.set(null);
  }

  setInteractionNextContact(days: number): void {
    this.interactionDraft.nextContactDay = addCalendarDays(this.today, days);
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
