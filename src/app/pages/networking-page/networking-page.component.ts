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
import { TaskDetailItemComponent } from '../../features/tasks/task-detail-panel/task-additional-info-item/task-detail-item.component';
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
type ContactEditorSection = 'CONTACT' | 'WORK' | 'CONTEXT' | 'RELATIONSHIP' | 'FOLLOW_UP' | 'NOTES';
type ProfileSection = 'OVERVIEW' | 'DETAILS' | 'HISTORY';
type InteractionSection = 'CONVERSATION' | 'NEXT';

interface ContactGroup {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  contacts: NetworkContact[];
}

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
    TaskDetailItemComponent,
  ],
  template: `
    <main class="networking-page">
      <header class="page-head">
        <div class="page-heading">
          <div class="eyebrow">🤝 LifeOS</div>
          <h1>Networking</h1>
          <p>
            Ține minte oamenii, contextul și promisiunile. LifeOS îți amintește când e
            timpul să reiei legătura.
          </p>
        </div>
        <button
          mat-flat-button
          color="primary"
          class="primary-action"
          (click)="startNewContact()"
        >
          <mat-icon>person_add</mat-icon>
          Persoană nouă
        </button>
      </header>

      <section class="summary-strip" aria-label="Networking overview">
        <button
          class="summary-chip danger"
          [class.active]="filter() === 'DUE'"
          (click)="filter.set('DUE')"
        >
          <span class="summary-emoji">⏰</span>
          <span><strong>{{ networking.overdueContacts().length }}</strong> overdue</span>
        </button>
        <button
          class="summary-chip today"
          [class.active]="filter() === 'DUE'"
          (click)="filter.set('DUE')"
        >
          <span class="summary-emoji">☀️</span>
          <span><strong>{{ networking.todayContacts().length }}</strong> azi</span>
        </button>
        <button
          class="summary-chip"
          [class.active]="filter() === 'UPCOMING'"
          (click)="filter.set('UPCOMING')"
        >
          <span class="summary-emoji">📅</span>
          <span><strong>{{ networking.upcomingContacts().length }}</strong> în 7 zile</span>
        </button>
        <button
          class="summary-chip"
          [class.active]="filter() === 'ALL'"
          (click)="filter.set('ALL')"
        >
          <span class="summary-emoji">👥</span>
          <span><strong>{{ networking.contacts().length }}</strong> persoane</span>
        </button>
      </section>

      <section class="workspace">
        <aside class="people-panel">
          <div class="panel-intro">
            <div>
              <strong>👥 Persoane</strong>
              <small>Găsește rapid pe cine trebuie să contactezi.</small>
            </div>
          </div>

          <label class="search-box">
            <mat-icon>search</mat-icon>
            <input
              type="search"
              placeholder="Caută nume, oraș, companie sau conversații..."
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
            @if (query()) {
              <button
                type="button"
                class="clear-search"
                aria-label="Șterge căutarea"
                (click)="query.set('')"
              >
                <mat-icon>close</mat-icon>
              </button>
            }
          </label>

          <nav class="filter-carousel" aria-label="Filtre networking">
            @for (item of filters; track item.id) {
              <button
                type="button"
                [class.active]="filter() === item.id"
                (click)="filter.set(item.id)"
              >
                <span>{{ item.label }}</span>
                <small>{{ filterCount(item.id) }}</small>
              </button>
            }
          </nav>

          <div class="people-groups">
            @for (group of groupedContacts(); track group.id) {
              @if (group.contacts.length) {
                <section class="people-group">
                  <header class="group-header">
                    <div>
                      <span class="group-emoji">{{ group.emoji }}</span>
                      <strong>{{ group.label }}</strong>
                    </div>
                    <span>{{ group.contacts.length }}</span>
                  </header>
                  <p class="group-hint">{{ group.hint }}</p>

                  <div class="person-list">
                    @for (contact of group.contacts; track contact.id) {
                      <button
                        class="person-row"
                        [class.selected]="selectedId() === contact.id"
                        [class.due]="isDue(contact)"
                        (click)="selectContact(contact.id)"
                      >
                        <span class="person-check">
                          <mat-icon>{{
                            contact.nextContactDay === today
                              ? 'today'
                              : isDue(contact)
                                ? 'notification_important'
                                : 'person'
                          }}</mat-icon>
                        </span>
                        <span class="person-main">
                          <span class="person-title-line">
                            <strong>{{ contact.name }}</strong>
                            @if (contact.nextContactDay) {
                              <span
                                class="contact-date"
                                [class.overdue]="contact.nextContactDay < today"
                                [class.today]="contact.nextContactDay === today"
                              >
                                {{ contact.nextContactDay }}
                              </span>
                            }
                          </span>
                          <span class="person-meta">
                            @if (contact.occupation) {
                              {{ contact.occupation }}
                            }
                            @if (contact.company) {
                              · {{ contact.company }}
                            }
                            @if (contact.city) {
                              · {{ contact.city }}
                            }
                          </span>
                          @if (contact.nextTopic) {
                            <span class="person-topic">💬 {{ contact.nextTopic }}</span>
                          }
                          @if (contact.tags.length) {
                            <span class="chips">
                              @for (tag of contact.tags.slice(0, 3); track tag) {
                                <span class="chip">{{ tag }}</span>
                              }
                            </span>
                          }
                        </span>
                        <mat-icon class="row-chevron">chevron_right</mat-icon>
                      </button>
                    }
                  </div>
                </section>
              }
            }

            @if (!filteredContacts().length) {
              <div class="empty-list">
                <mat-icon>person_search</mat-icon>
                <strong>Nicio persoană aici</strong>
                <p>Schimbă filtrul sau adaugă o persoană nouă.</p>
                <button mat-button (click)="startNewContact()">
                  <mat-icon>person_add</mat-icon>
                  Adaugă persoană
                </button>
              </div>
            }
          </div>
        </aside>

        <section class="detail-panel">
          @if (contactEditorOpen()) {
            <section class="editor-shell">
              <header class="editor-head">
                <div>
                  <span class="eyebrow">{{
                    editingContactId() ? '✏️ Editare contact' : '✨ Contact nou'
                  }}</span>
                  <h2>{{ editingContactId() ? 'Editează persoana' : 'Adaugă o persoană' }}</h2>
                  <p>
                    Completează doar ce îți este util. Poți reveni oricând; nimic din istoricul
                    existent nu este șters.
                  </p>
                </div>
                <button
                  mat-icon-button
                  aria-label="Închide"
                  (click)="cancelContactEdit()"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </header>

              <nav class="editor-carousel" aria-label="Secțiuni contact">
                @for (section of contactSections; track section.id; let i = $index) {
                  <button
                    type="button"
                    [class.active]="contactSection() === section.id"
                    [class.complete]="i < contactSectionIndex()"
                    (click)="contactSection.set(section.id)"
                  >
                    <span class="section-emoji">{{ section.emoji }}</span>
                    <span>{{ section.label }}</span>
                    <small>{{ i + 1 }}/{{ contactSections.length }}</small>
                  </button>
                }
              </nav>

              <div class="carousel-progress">
                @for (section of contactSections; track section.id) {
                  <button
                    type="button"
                    [class.active]="contactSection() === section.id"
                    (click)="contactSection.set(section.id)"
                    [attr.aria-label]="'Mergi la ' + section.label"
                  ></button>
                }
              </div>

              <form class="contact-editor-form" (ngSubmit)="saveContact()">
                @if (contactSection() === 'CONTACT') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>👤</span>
                      <div>
                        <h3>Date de contact</h3>
                        <p>Informațiile de bază pentru a găsi și contacta rapid persoana.</p>
                      </div>
                    </div>

                    <task-detail-item type="fullSizeInput" class="network-field">
                      <ng-container input-title>
                        <mat-icon>person</mat-icon><span>Nume *</span>
                      </ng-container>
                      <ng-container input-value>
                        <input
                          name="name"
                          required
                          placeholder="ex. Andrei Popescu"
                          [(ngModel)]="contactDraft.name"
                        />
                      </ng-container>
                    </task-detail-item>
                    <div class="field-help">✨ Folosește numele după care îl/o vei căuta cel mai ușor.</div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>phone</mat-icon><span>Telefon</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="phone" type="tel" placeholder="07..." [(ngModel)]="contactDraft.phone" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">📞 Numărul principal pentru contact rapid.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>mail</mat-icon><span>Email</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="email" type="email" placeholder="nume@email.com" [(ngModel)]="contactDraft.email" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">✉️ Util pentru conversații profesionale și follow-up-uri.</div>
                      </div>
                    </div>

                    <div class="field-grid three">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>photo_camera</mat-icon><span>Instagram</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="instagram" placeholder="@username" [(ngModel)]="contactDraft.instagram" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">📸 Username sau link.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>public</mat-icon><span>Facebook</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="facebook" placeholder="profil sau link" [(ngModel)]="contactDraft.facebook" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🌐 Profil sau URL complet.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>business_center</mat-icon><span>LinkedIn</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="linkedin" placeholder="profil sau link" [(ngModel)]="contactDraft.linkedin" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">💼 Foarte util pentru networking profesional.</div>
                      </div>
                    </div>
                  </section>
                }

                @if (contactSection() === 'WORK') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>💼</span>
                      <div>
                        <h3>Muncă & expertiză</h3>
                        <p>Context profesional ca să înțelegi imediat cine este și cu ce se ocupă.</p>
                      </div>
                    </div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>badge</mat-icon><span>Ocupație</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="occupation" placeholder="ex. AI Engineer" [(ngModel)]="contactDraft.occupation" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🧠 Rolul general sau profesia persoanei.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>workspace_premium</mat-icon><span>Funcție</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="role" placeholder="ex. Senior Engineer" [(ngModel)]="contactDraft.role" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🏷️ Titlul exact, dacă îl știi.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>apartment</mat-icon><span>Companie</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="company" placeholder="Companie / organizație" [(ngModel)]="contactDraft.company" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🏢 Unde lucrează sau ce organizație reprezintă.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>hub</mat-icon><span>Domeniu</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="industry" placeholder="AI, juridic, contabilitate..." [(ngModel)]="contactDraft.industry" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🧩 Ajută la filtrarea mentală a rețelei tale.</div>
                      </div>
                    </div>
                  </section>
                }

                @if (contactSection() === 'CONTEXT') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>📍</span>
                      <div>
                        <h3>Loc & context</h3>
                        <p>De unde îl/o cunoști și unde se află acum.</p>
                      </div>
                    </div>

                    <div class="field-grid three">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>location_city</mat-icon><span>Oraș</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="city" placeholder="Timișoara" [(ngModel)]="contactDraft.city" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">📍 Unde se află de obicei.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>map</mat-icon><span>Județ / regiune</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="region" [(ngModel)]="contactDraft.region" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🗺️ Opțional, pentru căutare mai precisă.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>language</mat-icon><span>Țară</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="country" [(ngModel)]="contactDraft.country" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🌍 Țara principală.</div>
                      </div>
                    </div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>connect_without_contact</mat-icon><span>De unde îl/o cunosc</span>
                          </ng-container>
                          <ng-container input-value>
                            <input
                              name="metThrough"
                              placeholder="facultate, master, conferință, LinkedIn..."
                              [(ngModel)]="contactDraft.metThrough"
                            />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🤝 Contextul în care a intrat în rețeaua ta.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>place</mat-icon><span>Unde ne-am cunoscut</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="metAt" placeholder="eveniment, firmă, facultate..." [(ngModel)]="contactDraft.metAt" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">📌 Locul sau evenimentul concret.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>event</mat-icon><span>Data întâlnirii</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="metOn" type="date" [(ngModel)]="contactDraft.metOn" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🗓️ Dacă nu o știi, o poți lăsa goală.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>group_add</mat-icon><span>Ne-a făcut cunoștință</span>
                          </ng-container>
                          <ng-container input-value>
                            <select name="introducedBy" [(ngModel)]="contactDraft.introducedByContactId">
                              <option value="">— Nimeni / nu știu —</option>
                              @for (person of introductionOptions(); track person.id) {
                                <option [value]="person.id">{{ person.name }}</option>
                              }
                            </select>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🔗 Leagă relațiile din rețeaua ta.</div>
                      </div>
                    </div>
                  </section>
                }

                @if (contactSection() === 'RELATIONSHIP') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>🤝</span>
                      <div>
                        <h3>Relație & valoare reciprocă</h3>
                        <p>Ce fel de relație aveți și unde există puncte comune.</p>
                      </div>
                    </div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>people</mat-icon><span>Tip relație</span>
                          </ng-container>
                          <ng-container input-value>
                            <select name="relationshipType" [(ngModel)]="contactDraft.relationshipType">
                              @for (item of relationshipOptions; track item.value) {
                                <option [value]="item.value">{{ item.label }}</option>
                              }
                            </select>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🧭 Profesional, prieten, recruiter, mentor, client etc.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>stars</mat-icon><span>Importanță</span>
                          </ng-container>
                          <ng-container input-value>
                            <select name="importance" [(ngModel)]="contactDraft.importance">
                              @for (item of importanceOptions; track item.value) {
                                <option [value]="item.value">{{ item.label }}</option>
                              }
                            </select>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">⭐ Cât de activ vrei să menții relația.</div>
                      </div>
                    </div>

                    <task-detail-item type="fullSizeInput" class="network-field">
                      <ng-container input-title>
                        <mat-icon>sell</mat-icon><span>Tags</span>
                      </ng-container>
                      <ng-container input-value>
                        <input
                          name="tags"
                          placeholder="AI, Timișoara, recruiter, facultate"
                          [(ngModel)]="contactDraft.tags"
                        />
                      </ng-container>
                    </task-detail-item>
                    <div class="field-help">🏷️ Separate prin virgulă. Sunt utile pentru căutare și filtrare.</div>

                    <task-detail-item type="fullSizeInput" class="network-field text-field">
                      <ng-container input-title>
                        <mat-icon>interests</mat-icon><span>Interese</span>
                      </ng-container>
                      <ng-container input-value>
                        <textarea name="interests" rows="3" placeholder="Ce îl/o interesează?" [(ngModel)]="contactDraft.interests"></textarea>
                      </ng-container>
                    </task-detail-item>
                    <div class="field-help">💡 Subiecte bune pentru conversații viitoare.</div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field text-field">
                          <ng-container input-title>
                            <mat-icon>volunteer_activism</mat-icon><span>Pot să ajut cu</span>
                          </ng-container>
                          <ng-container input-value>
                            <textarea name="canHelpWith" rows="3" [(ngModel)]="contactDraft.canHelpWith"></textarea>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🎁 Cum poți aduce valoare relației.</div>
                      </div>
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field text-field">
                          <ng-container input-title>
                            <mat-icon>handshake</mat-icon><span>Mă poate ajuta cu</span>
                          </ng-container>
                          <ng-container input-value>
                            <textarea name="canHelpMeWith" rows="3" [(ngModel)]="contactDraft.canHelpMeWith"></textarea>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🧩 Zone unde ar putea exista colaborare sau ajutor.</div>
                      </div>
                    </div>
                  </section>
                }

                @if (contactSection() === 'FOLLOW_UP') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>🗓️</span>
                      <div>
                        <h3>Ținem legătura</h3>
                        <p>Setează ritmul relației. La termen, persoana apare automat în Today.</p>
                      </div>
                    </div>

                    <div class="info-banner">
                      <mat-icon>lightbulb</mat-icon>
                      <div>
                        <strong>Folosește frecvența pentru relații, nu pentru taskuri.</strong>
                        <span>Un follow-up concret poate fi transformat separat într-un task LifeOS.</span>
                      </div>
                    </div>

                    <div class="field-grid two">
                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>repeat</mat-icon><span>Frecvență</span>
                          </ng-container>
                          <ng-container input-value>
                            <select name="cadence" [(ngModel)]="contactDraft.cadence">
                              @for (item of cadenceOptions; track item.value) {
                                <option [value]="item.value">{{ item.label }}</option>
                              }
                            </select>
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">🔁 Lunar, trimestrial, custom sau fără reminder.</div>
                      </div>

                      @if (contactDraft.cadence === 'CUSTOM') {
                        <div>
                          <task-detail-item type="fullSizeInput" class="network-field">
                            <ng-container input-title>
                              <mat-icon>date_range</mat-icon><span>La câte zile</span>
                            </ng-container>
                            <ng-container input-value>
                              <input name="cadenceDays" type="number" min="1" [(ngModel)]="contactDraft.cadenceDays" />
                            </ng-container>
                          </task-detail-item>
                          <div class="field-help">⚙️ Interval personalizat în zile.</div>
                        </div>
                      }

                      <div>
                        <task-detail-item type="fullSizeInput" class="network-field">
                          <ng-container input-title>
                            <mat-icon>event_available</mat-icon><span>Următorul contact</span>
                          </ng-container>
                          <ng-container input-value>
                            <input name="nextContactDay" type="date" [(ngModel)]="contactDraft.nextContactDay" />
                          </ng-container>
                        </task-detail-item>
                        <div class="field-help">☀️ În această zi persoana va apărea în Today.</div>
                      </div>
                    </div>

                    <task-detail-item type="fullSizeInput" class="network-field">
                      <ng-container input-title>
                        <mat-icon>forum</mat-icon><span>Subiect data viitoare</span>
                      </ng-container>
                      <ng-container input-value>
                        <input
                          name="nextTopic"
                          placeholder="Ce vreau să întreb sau să discut..."
                          [(ngModel)]="contactDraft.nextTopic"
                        />
                      </ng-container>
                    </task-detail-item>
                    <div class="field-help">💬 Îți apare în context ca să nu începi conversația „de la zero”.</div>
                  </section>
                }

                @if (contactSection() === 'NOTES') {
                  <section class="editor-section">
                    <div class="section-copy">
                      <span>📝</span>
                      <div>
                        <h3>Note permanente</h3>
                        <p>Lucruri care rămân relevante în timp, separat de conversațiile individuale.</p>
                      </div>
                    </div>

                    <task-detail-item type="fullSizeInput" class="network-field text-field notes-field">
                      <ng-container input-title>
                        <mat-icon>notes</mat-icon><span>Note</span>
                      </ng-container>
                      <ng-container input-value>
                        <textarea
                          name="notes"
                          rows="8"
                          placeholder="Context general, preferințe, lucruri importante de ținut minte..."
                          [(ngModel)]="contactDraft.notes"
                        ></textarea>
                      </ng-container>
                    </task-detail-item>
                    <div class="field-help">🧠 Pentru conversații folosește istoricul; aici păstrează doar contextul permanent.</div>

                    <div class="finish-card">
                      <span>✅</span>
                      <div>
                        <strong>Gata de salvat</strong>
                        <p>Poți reveni oricând și completa restul informațiilor.</p>
                      </div>
                    </div>
                  </section>
                }

                <footer class="editor-footer">
                  <button
                    type="button"
                    mat-button
                    [disabled]="contactSectionIndex() === 0"
                    (click)="moveContactSection(-1)"
                  >
                    <mat-icon>arrow_back</mat-icon>
                    Înapoi
                  </button>

                  <span class="footer-step">
                    {{ contactSectionIndex() + 1 }} / {{ contactSections.length }}
                  </span>

                  @if (contactSectionIndex() < contactSections.length - 1) {
                    <button
                      type="button"
                      mat-flat-button
                      color="primary"
                      (click)="moveContactSection(1)"
                    >
                      Continuă
                      <mat-icon>arrow_forward</mat-icon>
                    </button>
                  } @else {
                    <button
                      type="submit"
                      mat-flat-button
                      color="primary"
                      [disabled]="!contactDraft.name.trim()"
                    >
                      <mat-icon>save</mat-icon>
                      Salvează persoana
                    </button>
                  }
                </footer>
              </form>
            </section>
          } @else if (selectedContact(); as contact) {
            <section class="profile">
              <header class="profile-head">
                <div class="profile-copy">
                  <span class="eyebrow">👤 Contact</span>
                  <div class="profile-title-line">
                    <h2>{{ contact.name }}</h2>
                    <span class="importance">{{ importanceLabel(contact.importance) }}</span>
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
                    <button mat-flat-button color="primary" (click)="startInteraction()">
                      <mat-icon>forum</mat-icon>
                      Am vorbit
                    </button>
                  }
                  <button mat-button (click)="startEditContact(contact)">
                    <mat-icon>edit</mat-icon>
                    Editează
                  </button>
                </div>
              </header>

              <div class="contact-links">
                @if (contact.phone) {
                  <a [href]="'tel:' + contact.phone"><mat-icon>phone</mat-icon>{{ contact.phone }}</a>
                }
                @if (contact.email) {
                  <a [href]="'mailto:' + contact.email"><mat-icon>mail</mat-icon>{{ contact.email }}</a>
                }
                @if (contact.instagram) {
                  <a [href]="socialUrl('instagram', contact.instagram)" target="_blank" rel="noreferrer">
                    <mat-icon>photo_camera</mat-icon>Instagram
                  </a>
                }
                @if (contact.facebook) {
                  <a [href]="socialUrl('facebook', contact.facebook)" target="_blank" rel="noreferrer">
                    <mat-icon>public</mat-icon>Facebook
                  </a>
                }
                @if (contact.linkedin) {
                  <a [href]="socialUrl('linkedin', contact.linkedin)" target="_blank" rel="noreferrer">
                    <mat-icon>business_center</mat-icon>LinkedIn
                  </a>
                }
              </div>

              <nav class="profile-carousel" aria-label="Detalii persoană">
                @for (section of profileSections; track section.id) {
                  <button
                    type="button"
                    [class.active]="profileSection() === section.id"
                    (click)="profileSection.set(section.id)"
                  >
                    <span>{{ section.emoji }}</span>
                    {{ section.label }}
                  </button>
                }
              </nav>

              @if (profileSection() === 'OVERVIEW') {
                <section class="overview-layout">
                  <div class="context-grid">
                    <mat-card class="soft-card">
                      <mat-card-content>
                        <div class="mini-head">
                          <strong>🗓️ Ținem legătura</strong>
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
                            <dd>{{ contact.lastContactAt ? dateLabel(contact.lastContactAt) : '—' }}</dd>
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
                            <small>💬 Subiect data viitoare</small>
                            <p>{{ contact.nextTopic }}</p>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>

                    <mat-card class="soft-card">
                      <mat-card-content>
                        <div class="mini-head">
                          <strong>🧠 Context rapid</strong>
                          <mat-icon>psychology_alt</mat-icon>
                        </div>
                        @if (latestInteraction(); as last) {
                          <p class="last-summary">{{ last.summary }}</p>
                          @if (last.learned) {
                            <div class="context-line"><b>💡 Am aflat:</b> {{ last.learned }}</div>
                          }
                          @if (last.iPromised) {
                            <div class="context-line"><b>✅ Am promis:</b> {{ last.iPromised }}</div>
                          }
                          @if (last.theyPromised) {
                            <div class="context-line"><b>🤝 A promis:</b> {{ last.theyPromised }}</div>
                          }
                        } @else {
                          <div class="empty-inline">
                            <mat-icon>forum</mat-icon>
                            <span>Nicio conversație încă. Apasă „Am vorbit” după următoarea discuție.</span>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  </div>

                  <mat-card class="soft-card followups-card">
                    <mat-card-content>
                      <div class="section-head">
                        <div>
                          <h3>✅ Follow-up-uri</h3>
                          <p>Acțiuni concrete legate de această persoană.</p>
                        </div>
                        <span>{{ openFollowUps().length }} deschise</span>
                      </div>

                      <div class="followup-add">
                        <input #followUpTitle placeholder="ex. Trimite CV-ul..." />
                        <input #followUpDue type="date" />
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
                        <div class="followup-row" [class.done]="item.status === 'DONE'">
                          <button
                            class="check"
                            type="button"
                            (click)="toggleFollowUp(item.id, item.status)"
                            [attr.aria-label]="item.status === 'DONE' ? 'Redeschide' : 'Finalizat'"
                          >
                            <mat-icon>{{
                              item.status === 'DONE' ? 'check_circle' : 'radio_button_unchecked'
                            }}</mat-icon>
                          </button>
                          <span class="grow">{{ item.title }}</span>
                          @if (item.dueDay) {
                            <span class="chip">{{ item.dueDay }}</span>
                          }
                          @if (item.taskId) {
                            <span class="chip linked">Task creat</span>
                          } @else if (item.status === 'OPEN') {
                            <button mat-button (click)="createTask(item.id)">
                              <mat-icon>add_task</mat-icon>
                              Task
                            </button>
                          }
                        </div>
                      }

                      @if (!followUps().length) {
                        <div class="empty-inline">
                          <mat-icon>task_alt</mat-icon>
                          <span>Nu ai follow-up-uri deschise pentru această persoană.</span>
                        </div>
                      }
                    </mat-card-content>
                  </mat-card>
                </section>
              }

              @if (profileSection() === 'DETAILS') {
                <section class="detail-cards">
                  <mat-card class="soft-card">
                    <mat-card-content>
                      <div class="section-head compact">
                        <div><h3>👤 Despre persoană</h3><p>Date de context și relație.</p></div>
                      </div>
                      <div class="detail-rows">
                        @if (locationLabel(contact)) {
                          <div><span>📍 Locație</span><strong>{{ locationLabel(contact) }}</strong></div>
                        }
                        @if (contact.industry) {
                          <div><span>🧩 Domeniu</span><strong>{{ contact.industry }}</strong></div>
                        }
                        @if (contact.metThrough) {
                          <div><span>🤝 De unde îl/o cunosc</span><strong>{{ contact.metThrough }}</strong></div>
                        }
                        @if (contact.metAt) {
                          <div><span>📌 Unde ne-am cunoscut</span><strong>{{ contact.metAt }}</strong></div>
                        }
                        @if (contact.metOn) {
                          <div><span>🗓️ Când ne-am cunoscut</span><strong>{{ contact.metOn }}</strong></div>
                        }
                        @if (introducedByName(contact)) {
                          <div><span>🔗 Ne-a făcut cunoștință</span><strong>{{ introducedByName(contact) }}</strong></div>
                        }
                        <div><span>👥 Relație</span><strong>{{ relationshipLabel(contact.relationshipType) }}</strong></div>
                        <div><span>⭐ Importanță</span><strong>{{ importanceLabel(contact.importance) }}</strong></div>
                      </div>
                    </mat-card-content>
                  </mat-card>

                  @if (contact.tags.length) {
                    <mat-card class="soft-card">
                      <mat-card-content>
                        <div class="section-head compact"><div><h3>🏷️ Tags</h3><p>Repere rapide pentru căutare.</p></div></div>
                        <div class="chips large">
                          @for (tag of contact.tags; track tag) {
                            <span class="chip">{{ tag }}</span>
                          }
                        </div>
                      </mat-card-content>
                    </mat-card>
                  }

                  @if (contact.interests || contact.canHelpWith || contact.canHelpMeWith) {
                    <div class="context-grid">
                      @if (contact.interests) {
                        <mat-card class="soft-card">
                          <mat-card-content>
                            <div class="mini-head"><strong>💡 Interese</strong></div>
                            <p class="body-copy">{{ contact.interests }}</p>
                          </mat-card-content>
                        </mat-card>
                      }
                      @if (contact.canHelpWith) {
                        <mat-card class="soft-card">
                          <mat-card-content>
                            <div class="mini-head"><strong>🎁 Pot să ajut cu</strong></div>
                            <p class="body-copy">{{ contact.canHelpWith }}</p>
                          </mat-card-content>
                        </mat-card>
                      }
                      @if (contact.canHelpMeWith) {
                        <mat-card class="soft-card">
                          <mat-card-content>
                            <div class="mini-head"><strong>🤝 Mă poate ajuta cu</strong></div>
                            <p class="body-copy">{{ contact.canHelpMeWith }}</p>
                          </mat-card-content>
                        </mat-card>
                      }
                    </div>
                  }

                  @if (contact.notes) {
                    <mat-card class="soft-card">
                      <mat-card-content>
                        <div class="mini-head"><strong>📝 Note permanente</strong></div>
                        <p class="body-copy pre-wrap">{{ contact.notes }}</p>
                      </mat-card-content>
                    </mat-card>
                  }
                </section>
              }

              @if (profileSection() === 'HISTORY') {
                <section class="history-layout">
                  @if (interactionEditorOpen()) {
                    <mat-card class="interaction-editor native-editor">
                      <mat-card-content>
                        <div class="section-head">
                          <div>
                            <h3>💬 Înregistrează conversația</h3>
                            <p>Scrie doar esențialul; data viitoare vei avea tot contextul la îndemână.</p>
                          </div>
                          <button
                            mat-icon-button
                            (click)="interactionEditorOpen.set(false)"
                            aria-label="Închide"
                          >
                            <mat-icon>close</mat-icon>
                          </button>
                        </div>

                        <nav class="interaction-switch">
                          <button
                            type="button"
                            [class.active]="interactionSection() === 'CONVERSATION'"
                            (click)="interactionSection.set('CONVERSATION')"
                          >
                            💬 Conversație
                          </button>
                          <button
                            type="button"
                            [class.active]="interactionSection() === 'NEXT'"
                            (click)="interactionSection.set('NEXT')"
                          >
                            🔁 Ce urmează
                          </button>
                        </nav>

                        <form class="interaction-form" (ngSubmit)="saveInteraction(contact.id)">
                          @if (interactionSection() === 'CONVERSATION') {
                            <div class="field-grid two">
                              <label class="native-input">
                                <span>🗓️ Data și ora</span>
                                <input name="interactionAt" type="datetime-local" [(ngModel)]="interactionDraft.at" />
                              </label>
                              <label class="native-input">
                                <span>📞 Cum am vorbit</span>
                                <select name="channel" [(ngModel)]="interactionDraft.channel">
                                  @for (item of channelOptions; track item.value) {
                                    <option [value]="item.value">{{ item.label }}</option>
                                  }
                                </select>
                              </label>
                            </div>

                            <label class="native-input">
                              <span>📍 Unde / context</span>
                              <input name="interactionLocation" placeholder="telefon, cafea, conferință..." [(ngModel)]="interactionDraft.location" />
                              <small>Opțional — locul sau contextul discuției.</small>
                            </label>

                            <label class="native-input text">
                              <span>💬 Ce am vorbit? *</span>
                              <textarea
                                name="summary"
                                rows="5"
                                required
                                placeholder="Rezumatul conversației și ideile importante..."
                                [(ngModel)]="interactionDraft.summary"
                              ></textarea>
                              <small>Scrie suficient cât să recapeți contextul peste câteva luni.</small>
                            </label>

                            <label class="native-input text">
                              <span>💡 Ce am aflat nou?</span>
                              <textarea name="learned" rows="3" [(ngModel)]="interactionDraft.learned"></textarea>
                              <small>Lucruri noi despre persoană, proiecte, planuri sau interese.</small>
                            </label>
                          }

                          @if (interactionSection() === 'NEXT') {
                            <div class="field-grid two">
                              <label class="native-input text">
                                <span>✅ Ce am promis eu?</span>
                                <textarea name="iPromised" rows="3" [(ngModel)]="interactionDraft.iPromised"></textarea>
                              </label>
                              <label class="native-input text">
                                <span>🤝 Ce a promis persoana?</span>
                                <textarea name="theyPromised" rows="3" [(ngModel)]="interactionDraft.theyPromised"></textarea>
                              </label>
                            </div>

                            <label class="native-input text">
                              <span>➡️ Ce fac în continuare?</span>
                              <textarea name="nextStep" rows="3" [(ngModel)]="interactionDraft.nextStep"></textarea>
                              <small>Un next step clar te ajută să nu pierzi continuitatea relației.</small>
                            </label>

                            <label class="native-input">
                              <span>💬 Subiect data viitoare</span>
                              <input name="nextTopic" placeholder="Ce vreau să întreb data viitoare..." [(ngModel)]="interactionDraft.nextTopic" />
                            </label>

                            <div class="field-grid two">
                              <label class="native-input">
                                <span>🗓️ Reiau legătura la</span>
                                <input name="interactionNextContactDay" type="date" [(ngModel)]="interactionDraft.nextContactDay" />
                                <small>Dacă rămâne gol, se calculează din frecvența persoanei.</small>
                              </label>
                              <label class="native-input">
                                <span>✅ Follow-up de făcut</span>
                                <input name="followUpTitle" placeholder="ex. Trimite CV-ul" [(ngModel)]="interactionDraft.followUpTitle" />
                                <small>Poate fi transformat ulterior într-un task LifeOS.</small>
                              </label>
                            </div>

                            @if (interactionDraft.followUpTitle.trim()) {
                              <label class="native-input">
                                <span>🚩 Termen follow-up</span>
                                <input name="followUpDueDay" type="date" [(ngModel)]="interactionDraft.followUpDueDay" />
                              </label>
                            }
                          }

                          <div class="interaction-actions">
                            @if (interactionSection() === 'CONVERSATION') {
                              <span></span>
                              <button type="button" mat-flat-button color="primary" (click)="interactionSection.set('NEXT')">
                                Continuă
                                <mat-icon>arrow_forward</mat-icon>
                              </button>
                            } @else {
                              <button type="button" mat-button (click)="interactionSection.set('CONVERSATION')">
                                <mat-icon>arrow_back</mat-icon>
                                Înapoi
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
                            }
                          </div>
                        </form>
                      </mat-card-content>
                    </mat-card>
                  } @else {
                    <div class="history-cta">
                      <div>
                        <strong>💬 Ai vorbit cu {{ contact.name }}?</strong>
                        <p>Adaugă conversația cât contextul este încă proaspăt.</p>
                      </div>
                      @if (!contact.isArchived) {
                        <button mat-flat-button color="primary" (click)="startInteraction()">
                          <mat-icon>add_comment</mat-icon>
                          Adaugă conversație
                        </button>
                      }
                    </div>
                  }

                  <mat-card class="timeline-card soft-card">
                    <mat-card-content>
                      <div class="section-head">
                        <div>
                          <h3>🕘 Istoric conversații</h3>
                          <p>Fiecare conversație rămâne în cronologie; nimic nu se suprascrie.</p>
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
                                  <span class="channel">{{ channelLabel(item.channel) }}</span>
                                </div>
                                @if (item.location) {
                                  <span class="muted">📍 {{ item.location }}</span>
                                }
                              </header>
                              <p class="summary">{{ item.summary }}</p>

                              <div class="interaction-details">
                                @if (item.learned) {
                                  <div><small>💡 Ce am aflat</small><p>{{ item.learned }}</p></div>
                                }
                                @if (item.iPromised) {
                                  <div><small>✅ Am promis</small><p>{{ item.iPromised }}</p></div>
                                }
                                @if (item.theyPromised) {
                                  <div><small>🤝 A promis</small><p>{{ item.theyPromised }}</p></div>
                                }
                                @if (item.nextStep) {
                                  <div><small>➡️ Următorul pas</small><p>{{ item.nextStep }}</p></div>
                                }
                                @if (item.nextTopic) {
                                  <div><small>💬 Data viitoare</small><p>{{ item.nextTopic }}</p></div>
                                }
                              </div>
                            </div>
                          </article>
                        }

                        @if (!interactions().length) {
                          <div class="timeline-empty">
                            <mat-icon>forum</mat-icon>
                            <strong>Istoricul este gol</strong>
                            <p>După următoarea discuție apasă „Am vorbit”.</p>
                          </div>
                        }
                      </div>
                    </mat-card-content>
                  </mat-card>
                </section>
              }

              <footer class="danger-zone">
                @if (contact.isArchived) {
                  <button mat-button (click)="networking.archiveContact(contact.id, false)">
                    <mat-icon>unarchive</mat-icon>
                    Reactivează persoana
                  </button>
                } @else {
                  <button mat-button (click)="archiveSelected(contact.id)">
                    <mat-icon>archive</mat-icon>
                    Arhivează persoana
                  </button>
                }
              </footer>
            </section>
          } @else {
            <div class="empty-detail">
              <span class="empty-emoji">🤝</span>
              <h2>Construiește-ți rețeaua, fără să pierzi contextul</h2>
              <p>
                Adaugă o persoană, notează conversațiile și LifeOS îți va aminti când să
                reiei legătura.
              </p>
              <button mat-flat-button color="primary" (click)="startNewContact()">
                <mat-icon>person_add</mat-icon>
                Adaugă prima persoană
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
        max-width: 1440px;
        margin: 0 auto;
        padding: var(--s2);
      }

      .page-head,
      .editor-head,
      .profile-head,
      .section-head,
      .mini-head,
      .group-header,
      .panel-intro,
      .history-cta,
      .interaction-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s);
      }

      .page-head,
      .editor-head,
      .profile-head {
        align-items: flex-start;
      }

      .page-heading,
      .profile-copy,
      .editor-head > div {
        min-width: 0;
      }

      .eyebrow {
        margin-bottom: var(--s-quarter);
        color: var(--text-color-muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }

      .page-head h1,
      .editor-head h2,
      .profile-head h2 {
        margin-bottom: var(--s-quarter);
      }

      .page-head p,
      .editor-head p,
      .profile-head p,
      .section-head p,
      .section-copy p,
      .panel-intro small,
      .group-hint {
        margin-bottom: 0;
        color: var(--text-color-muted);
      }

      .primary-action {
        flex: 0 0 auto;
      }

      .summary-strip {
        display: flex;
        gap: var(--s-half);
        overflow-x: auto;
        margin: var(--s2) 0;
        padding-bottom: var(--s-quarter);
      }

      .summary-chip,
      .filter-carousel button,
      .editor-carousel button,
      .profile-carousel button,
      .interaction-switch button {
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        color: var(--text-color);
        cursor: pointer;
        transition: var(--transition-standard);
      }

      .summary-chip {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        gap: var(--s-half);
        padding: 0 var(--s);
        white-space: nowrap;
      }

      .summary-chip:hover,
      .filter-carousel button:hover,
      .editor-carousel button:hover,
      .profile-carousel button:hover,
      .interaction-switch button:hover {
        background: var(--task-detail-bg-hover);
      }

      .summary-chip.active,
      .filter-carousel button.active,
      .editor-carousel button.active,
      .profile-carousel button.active,
      .interaction-switch button.active {
        border-color: var(--palette-primary-400);
        background: var(--task-detail-bg-hover);
      }

      .summary-emoji {
        font-size: 16px;
      }

      .workspace {
        display: grid;
        grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
        gap: var(--s2);
        min-height: 640px;
      }

      .people-panel,
      .detail-panel {
        min-width: 0;
      }

      .people-panel {
        display: flex;
        flex-direction: column;
        gap: var(--s);
        border-right: 1px solid var(--divider-color);
        padding-right: var(--s2);
      }

      .panel-intro {
        min-height: 46px;
      }

      .panel-intro > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .search-box {
        display: flex;
        min-height: 46px;
        align-items: center;
        gap: var(--s-half);
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        padding: 0 var(--s);
      }

      .search-box:focus-within {
        border-color: var(--palette-primary-400);
      }

      .search-box input,
      .network-field input,
      .network-field select,
      .network-field textarea,
      .native-input input,
      .native-input select,
      .native-input textarea,
      .followup-add input {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text-color);
        font: inherit;
      }

      .search-box input {
        min-height: 42px;
      }

      .clear-search {
        display: inline-flex;
        width: 32px;
        height: 32px;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }

      .clear-search mat-icon {
        font-size: 18px;
      }

      .filter-carousel,
      .editor-carousel,
      .profile-carousel,
      .interaction-switch {
        display: flex;
        gap: var(--s-half);
        overflow-x: auto;
        padding-bottom: var(--s-quarter);
      }

      .filter-carousel button,
      .profile-carousel button,
      .interaction-switch button {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        gap: var(--s-half);
        padding: 0 var(--s);
        white-space: nowrap;
      }

      .filter-carousel small {
        min-width: 22px;
        border-radius: 999px;
        background: var(--bg-lighter);
        padding: 2px 6px;
        text-align: center;
      }

      .people-groups {
        display: flex;
        flex-direction: column;
        gap: var(--s2);
        overflow: auto;
        padding-bottom: var(--s2);
      }

      .people-group {
        min-width: 0;
      }

      .group-header {
        margin-bottom: 2px;
        color: var(--text-color);
        font-size: 12px;
      }

      .group-header > div {
        display: inline-flex;
        align-items: center;
        gap: var(--s-half);
      }

      .group-header > span:last-child {
        color: var(--text-color-muted);
      }

      .group-hint {
        margin: 0 0 var(--s-half);
        padding-left: calc(16px + var(--s-half));
        font-size: 10px;
      }

      .person-list {
        display: flex;
        flex-direction: column;
        gap: var(--s-quarter);
      }

      .person-row {
        position: relative;
        display: flex;
        width: 100%;
        min-height: 58px;
        align-items: center;
        gap: var(--s-half);
        border: 1px solid transparent;
        border-radius: var(--card-border-radius);
        background: transparent;
        color: inherit;
        padding: var(--s-half);
        text-align: left;
        cursor: pointer;
        transition: var(--transition-standard);
      }

      .person-row:hover,
      .person-row.selected {
        background: var(--task-detail-bg-hover);
      }

      .person-row.selected {
        border-color: var(--palette-primary-400);
      }

      .person-check {
        display: inline-flex;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--divider-color);
        border-radius: 50%;
        color: var(--text-color-muted);
      }

      .person-row.due .person-check {
        color: var(--c-accent);
      }

      .person-check mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .person-main {
        display: flex;
        min-width: 0;
        flex: 1;
        flex-direction: column;
        gap: 3px;
      }

      .person-title-line {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-half);
      }

      .person-title-line strong,
      .person-meta,
      .person-topic {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .person-meta,
      .person-topic {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .contact-date {
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--bg-lighter);
        padding: 2px 6px;
        color: var(--text-color-muted);
        font-size: 10px;
      }

      .contact-date.overdue {
        color: var(--c-warn);
        font-weight: 700;
      }

      .contact-date.today {
        color: var(--c-accent);
        font-weight: 700;
      }

      .row-chevron {
        flex: 0 0 auto;
        opacity: 0.35;
      }

      .chips {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        gap: 4px;
      }

      .chip,
      .importance,
      .status-pill,
      .channel {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--bg-lighter);
        padding: 3px 7px;
        color: var(--text-color-muted);
        font-size: 10px;
      }

      .chips.large .chip {
        padding: 5px 9px;
        font-size: 12px;
      }

      .empty-list,
      .empty-detail,
      .timeline-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--s-half);
        text-align: center;
        color: var(--text-color-muted);
      }

      .empty-list {
        min-height: 180px;
      }

      .empty-detail {
        min-height: 520px;
        padding: var(--s2);
      }

      .empty-detail h2,
      .empty-detail p,
      .timeline-empty p {
        max-width: 520px;
        margin-bottom: 0;
      }

      .empty-emoji {
        font-size: 44px;
      }

      .editor-shell,
      .profile {
        min-width: 0;
        padding-bottom: var(--s2);
      }

      .editor-head,
      .profile-head {
        margin-bottom: var(--s);
        padding: calc(var(--s) + var(--s-half));
        border: 1px solid var(--divider-color);
        border-bottom: 2px solid var(--c-primary);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
      }

      .editor-carousel {
        margin-bottom: var(--s-half);
      }

      .editor-carousel button {
        display: flex;
        min-width: 132px;
        min-height: 62px;
        flex: 1 0 132px;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 2px;
        padding: var(--s-half) var(--s);
        text-align: left;
      }

      .editor-carousel button small {
        color: var(--text-color-muted);
        font-size: 9px;
      }

      .editor-carousel button.complete {
        opacity: 0.82;
      }

      .section-emoji {
        font-size: 17px;
      }

      .carousel-progress {
        display: flex;
        justify-content: center;
        gap: 5px;
        margin-bottom: var(--s2);
      }

      .carousel-progress button {
        width: 20px;
        height: 4px;
        border: 0;
        border-radius: 999px;
        background: var(--divider-color);
        cursor: pointer;
        transition: var(--transition-standard);
      }

      .carousel-progress button.active {
        width: 38px;
        background: var(--c-primary);
      }

      .editor-section {
        max-width: 980px;
        margin: 0 auto;
      }

      .section-copy {
        display: flex;
        align-items: flex-start;
        gap: var(--s);
        margin: 0 var(--s) var(--s2);
      }

      .section-copy > span {
        font-size: 30px;
      }

      .section-copy h3,
      .section-copy p {
        margin-bottom: 3px;
      }

      .field-grid {
        display: grid;
        gap: var(--s-half) var(--s);
      }

      .field-grid.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .field-grid.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .network-field {
        display: block;
      }

      :host ::ng-deep .network-field > .input-item {
        margin-block: var(--s-half);
      }

      :host ::ng-deep .network-field .input-item__value {
        text-align: left;
        justify-content: stretch;
      }

      :host ::ng-deep .network-field .input-item__value > * {
        width: 100%;
        margin-left: 0;
        text-align: left;
      }

      :host ::ng-deep .network-field .input-item__title {
        flex: 0 0 180px;
      }

      :host ::ng-deep .network-field input,
      :host ::ng-deep .network-field select,
      :host ::ng-deep .network-field textarea {
        min-height: 36px;
        padding: 4px var(--s-half);
        border-radius: 6px;
      }

      :host ::ng-deep .network-field textarea {
        resize: vertical;
      }

      :host ::ng-deep .network-field input:focus,
      :host ::ng-deep .network-field select:focus,
      :host ::ng-deep .network-field textarea:focus {
        background: var(--bg-lightest);
        box-shadow: inset 0 0 0 1px var(--palette-primary-400);
      }

      :host ::ng-deep .network-field.text-field > .input-item,
      :host ::ng-deep .network-field.notes-field > .input-item {
        min-height: 96px;
      }

      .field-help {
        margin: calc(-1 * var(--s-quarter)) calc(var(--s) + var(--s-half)) var(--s);
        color: var(--text-color-muted);
        font-size: 10px;
        line-height: 1.35;
      }

      .info-banner,
      .finish-card,
      .history-cta {
        display: flex;
        align-items: center;
        gap: var(--s);
        margin: var(--s);
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        padding: var(--s);
      }

      .info-banner mat-icon {
        color: var(--c-accent);
      }

      .info-banner > div,
      .finish-card > div {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 2px;
      }

      .info-banner span,
      .finish-card p {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .finish-card > span {
        font-size: 28px;
      }

      .editor-footer {
        position: sticky;
        bottom: 0;
        z-index: 3;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: var(--s);
        margin-top: var(--s2);
        border-top: 1px solid var(--divider-color);
        background: var(--bg);
        padding: var(--s);
      }

      .editor-footer > button:first-child {
        justify-self: start;
      }

      .editor-footer > button:last-child {
        justify-self: end;
      }

      .footer-step {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      .profile-title-line {
        display: flex;
        align-items: center;
        gap: var(--s-half);
        flex-wrap: wrap;
      }

      .profile-title-line h2 {
        margin: 0;
      }

      .profile-actions,
      .contact-links {
        display: flex;
        align-items: center;
        gap: var(--s-half);
        flex-wrap: wrap;
      }

      .contact-links {
        margin-bottom: var(--s);
      }

      .contact-links a {
        display: inline-flex;
        min-height: 36px;
        align-items: center;
        gap: 5px;
        border: 1px solid var(--divider-color);
        border-radius: 999px;
        background: var(--task-detail-bg);
        padding: 0 var(--s);
        color: inherit;
        text-decoration: none;
      }

      .contact-links a:hover {
        background: var(--task-detail-bg-hover);
      }

      .contact-links mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      .profile-carousel {
        margin-bottom: var(--s2);
      }

      .overview-layout,
      .detail-cards,
      .history-layout {
        display: flex;
        flex-direction: column;
        gap: var(--s);
      }

      .context-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s);
      }

      .soft-card,
      .interaction-editor {
        box-shadow: none !important;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius) !important;
        background: var(--task-detail-bg) !important;
      }

      .mini-head,
      .section-head {
        margin-bottom: var(--s);
      }

      .section-head.compact {
        margin-bottom: var(--s-half);
      }

      .section-head h3,
      .section-head p {
        margin-bottom: 2px;
      }

      .section-head > span {
        color: var(--text-color-muted);
        font-size: 11px;
      }

      dl {
        margin: 0;
      }

      dl > div,
      .detail-rows > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s);
        min-height: 38px;
        border-bottom: 1px solid var(--divider-color);
      }

      dl > div:last-child,
      .detail-rows > div:last-child {
        border-bottom: 0;
      }

      dt,
      .detail-rows span {
        color: var(--text-color-muted);
      }

      dd {
        margin: 0;
      }

      .next-topic {
        margin-top: var(--s);
        border-radius: var(--card-border-radius);
        background: var(--bg-lighter);
        padding: var(--s);
      }

      .next-topic small {
        color: var(--text-color-muted);
      }

      .next-topic p,
      .last-summary,
      .body-copy {
        margin: var(--s-half) 0 0;
        line-height: 1.5;
      }

      .context-line {
        margin-top: var(--s-half);
        color: var(--text-color-less-intense);
        line-height: 1.45;
      }

      .empty-inline {
        display: flex;
        align-items: center;
        gap: var(--s-half);
        color: var(--text-color-muted);
      }

      .followup-add {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 150px auto;
        gap: var(--s-half);
        margin-bottom: var(--s);
      }

      .followup-add input {
        min-height: 38px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--bg-lightest);
        padding: 0 var(--s-half);
      }

      .followup-row {
        display: flex;
        min-height: 44px;
        align-items: center;
        gap: var(--s-half);
        border-top: 1px solid var(--divider-color);
      }

      .followup-row.done {
        opacity: 0.55;
      }

      .followup-row.done .grow {
        text-decoration: line-through;
      }

      .check {
        display: inline-flex;
        width: 32px;
        height: 32px;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }

      .grow {
        min-width: 0;
        flex: 1;
      }

      .linked {
        color: var(--c-accent);
      }

      .history-cta {
        justify-content: space-between;
        margin: 0;
      }

      .history-cta p {
        margin: 3px 0 0;
        color: var(--text-color-muted);
      }

      .interaction-switch {
        margin-bottom: var(--s);
      }

      .interaction-form {
        display: flex;
        flex-direction: column;
        gap: var(--s);
      }

      .native-input {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 5px;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        padding: var(--s);
      }

      .native-input > span {
        font-weight: 600;
      }

      .native-input > small {
        color: var(--text-color-muted);
        font-size: 10px;
      }

      .native-input input,
      .native-input select,
      .native-input textarea {
        min-height: 36px;
        border-radius: 6px;
        background: var(--bg-lightest);
        padding: 6px var(--s-half);
      }

      .native-input textarea {
        resize: vertical;
      }

      .interaction-actions {
        margin-top: var(--s);
      }

      .timeline {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--s);
      }

      .interaction {
        position: relative;
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        gap: var(--s);
      }

      .timeline-marker {
        width: 10px;
        height: 10px;
        margin-top: 7px;
        border: 2px solid var(--c-primary);
        border-radius: 50%;
        background: var(--task-detail-bg);
      }

      .interaction:not(:last-child) .timeline-marker::after {
        content: '';
        position: absolute;
        top: 18px;
        bottom: calc(-1 * var(--s));
        left: 4px;
        width: 1px;
        background: var(--divider-color);
      }

      .interaction-body {
        min-width: 0;
        border: 1px solid var(--divider-color);
        border-radius: var(--card-border-radius);
        background: var(--bg-lightest);
        padding: var(--s);
      }

      .interaction-body header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s);
      }

      .interaction-body header > div {
        display: flex;
        align-items: center;
        gap: var(--s-half);
        flex-wrap: wrap;
      }

      .summary {
        margin: var(--s) 0 0;
        line-height: 1.5;
      }

      .interaction-details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-half);
        margin-top: var(--s);
      }

      .interaction-details > div {
        border-radius: var(--card-border-radius);
        background: var(--task-detail-bg);
        padding: var(--s-half) var(--s);
      }

      .interaction-details small {
        color: var(--text-color-muted);
      }

      .interaction-details p {
        margin: 4px 0 0;
        white-space: pre-wrap;
      }

      .pre-wrap {
        white-space: pre-wrap;
      }

      .status-pill.overdue {
        color: var(--c-warn);
        font-weight: 700;
      }

      .status-pill.due-now {
        color: var(--c-accent);
        font-weight: 700;
      }

      .danger-zone {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--s2);
        border-top: 1px solid var(--divider-color);
        padding-top: var(--s);
      }

      @media (max-width: 1050px) {
        .workspace {
          grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
        }

        .field-grid.three {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        :host ::ng-deep .network-field .input-item__title {
          flex-basis: 150px;
        }
      }

      @media (max-width: 780px) {
        .networking-page {
          padding: var(--s);
          padding-bottom: 92px;
        }

        .page-head {
          flex-direction: column;
        }

        .workspace {
          display: block;
        }

        .people-panel {
          max-height: none;
          margin-bottom: var(--s2);
          border-right: 0;
          border-bottom: 1px solid var(--divider-color);
          padding-right: 0;
          padding-bottom: var(--s2);
        }

        .people-groups {
          max-height: 360px;
        }

        .field-grid.two,
        .field-grid.three,
        .context-grid,
        .interaction-details {
          grid-template-columns: 1fr;
        }

        .editor-carousel button {
          min-width: 118px;
        }

        :host ::ng-deep .network-field .input-item {
          flex-direction: column;
          height: auto;
          min-height: 76px;
          align-items: stretch;
        }

        :host ::ng-deep .network-field .input-item__title {
          min-height: 34px;
          flex: 0 0 auto;
        }

        :host ::ng-deep .network-field .input-item__value {
          min-height: 38px;
          padding: 0 var(--s-half) var(--s-half);
        }

        .field-help {
          margin-left: var(--s);
        }

        .followup-add {
          grid-template-columns: 1fr;
        }

        .profile-head {
          flex-direction: column;
        }

        .profile-actions {
          width: 100%;
        }
      }

      @media (max-width: 520px) {
        .summary-strip {
          margin-block: var(--s);
        }

        .summary-chip {
          min-height: 38px;
        }

        .person-row {
          min-height: 54px;
        }

        .person-topic,
        .chips {
          display: none;
        }

        .contact-date {
          display: none;
        }

        .editor-head,
        .profile-head {
          padding: var(--s);
        }

        .editor-footer {
          grid-template-columns: 1fr 1fr;
        }

        .footer-step {
          display: none;
        }

        .editor-footer > button:last-child {
          justify-self: end;
        }

        .history-cta,
        .interaction-body header {
          align-items: stretch;
          flex-direction: column;
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
  readonly contactSection = signal<ContactEditorSection>('CONTACT');
  readonly profileSection = signal<ProfileSection>('OVERVIEW');
  readonly interactionSection = signal<InteractionSection>('CONVERSATION');

  readonly contactSections: ReadonlyArray<{
    id: ContactEditorSection;
    label: string;
    emoji: string;
  }> = [
    { id: 'CONTACT', label: 'Contact', emoji: '👤' },
    { id: 'WORK', label: 'Work', emoji: '💼' },
    { id: 'CONTEXT', label: 'Context', emoji: '📍' },
    { id: 'RELATIONSHIP', label: 'Relație', emoji: '🤝' },
    { id: 'FOLLOW_UP', label: 'Follow-up', emoji: '🗓️' },
    { id: 'NOTES', label: 'Note', emoji: '📝' },
  ];

  readonly profileSections: ReadonlyArray<{
    id: ProfileSection;
    label: string;
    emoji: string;
  }> = [
    { id: 'OVERVIEW', label: 'Overview', emoji: '🧠' },
    { id: 'DETAILS', label: 'Detalii', emoji: '👤' },
    { id: 'HISTORY', label: 'Istoric', emoji: '💬' },
  ];

  readonly cadenceOptions = NETWORK_CADENCE_OPTIONS;
  readonly relationshipOptions = NETWORK_RELATIONSHIP_OPTIONS;
  readonly importanceOptions = NETWORK_IMPORTANCE_OPTIONS;
  readonly channelOptions = NETWORK_CHANNEL_OPTIONS;

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

  readonly groupedContacts = computed<ContactGroup[]>(() => {
    const contacts = this.filteredContacts();

    if (this.filter() === 'ARCHIVED') {
      return [
        {
          id: 'archived',
          label: 'Arhivate',
          emoji: '🗃️',
          hint: 'Persoane păstrate pentru istoric, dar scoase din networking-ul activ.',
          contacts,
        },
      ];
    }

    const today = this.today;
    const weekEnd = addCalendarDays(today, 7);
    const overdue = contacts.filter(
      (contact) => !!contact.nextContactDay && contact.nextContactDay < today,
    );
    const dueToday = contacts.filter((contact) => contact.nextContactDay === today);
    const thisWeek = contacts.filter(
      (contact) =>
        !!contact.nextContactDay &&
        contact.nextContactDay > today &&
        contact.nextContactDay <= weekEnd,
    );
    const later = contacts.filter(
      (contact) => !!contact.nextContactDay && contact.nextContactDay > weekEnd,
    );
    const noReminder = contacts.filter((contact) => !contact.nextContactDay);

    return [
      {
        id: 'overdue',
        label: 'Overdue',
        emoji: '⏰',
        hint: 'Relații pentru care data de reluare a legăturii a trecut.',
        contacts: overdue,
      },
      {
        id: 'today',
        label: 'Astăzi',
        emoji: '☀️',
        hint: 'Persoane pe care ai planificat să le contactezi azi.',
        contacts: dueToday,
      },
      {
        id: 'week',
        label: 'Săptămâna aceasta',
        emoji: '📅',
        hint: 'Următoarele contacte din cele 7 zile.',
        contacts: thisWeek,
      },
      {
        id: 'later',
        label: 'Mai târziu',
        emoji: '🧭',
        hint: 'Relații programate după săptămâna curentă.',
        contacts: later,
      },
      {
        id: 'none',
        label: 'Fără reminder',
        emoji: '○',
        hint: 'Persoane active fără o dată viitoare de contact.',
        contacts: noReminder,
      },
    ];
  });

  readonly selectedContact = computed(() => this.networking.contact(this.selectedId()));

  readonly interactions = computed(() => {
    const id = this.selectedId();
    return id ? this.networking.interactionsForContact(id) : [];
  });

  readonly latestInteraction = computed(() => this.interactions()[0]);

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
      if (selected && this.networking.contact(selected)) return;

      const first = this.filteredContacts()[0];
      this.selectedId.set(first?.id ?? null);
    });
  }

  contactSectionIndex(): number {
    return Math.max(
      0,
      this.contactSections.findIndex((section) => section.id === this.contactSection()),
    );
  }

  moveContactSection(delta: number): void {
    const index = this.contactSectionIndex();
    const next = Math.max(0, Math.min(this.contactSections.length - 1, index + delta));
    this.contactSection.set(this.contactSections[next].id);
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
    this.profileSection.set('OVERVIEW');
    this.contactEditorOpen.set(false);
    this.interactionEditorOpen.set(false);
  }

  startNewContact(): void {
    this.editingContactId.set(null);
    this.contactDraft = this._emptyContactDraft();
    this.contactSection.set('CONTACT');
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
    this.contactSection.set('CONTACT');
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

  startInteraction(): void {
    this.interactionDraft = this._emptyInteractionDraft();
    this.interactionSection.set('CONVERSATION');
    this.profileSection.set('HISTORY');
    this.interactionEditorOpen.set(true);
  }

  saveInteraction(contactId: string): void {
    if (!this.interactionDraft.summary.trim()) return;
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

    this.networking.logInteraction(contactId, input);
    this.interactionEditorOpen.set(false);
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
    this.selectedId.set(this.networking.contacts()[0]?.id ?? null);
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
      channel: 'MEETING',
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
