'use client';

// ─── Kontakt öffnen · Reiter „Aktivitäten“ — Karte und Formulare (28.09., H3) ─
// Die Karte je Eintrag (Symbol, Titel, Person, Zeit, Text mit „mehr“, Ergebnis,
// Bezug) und die fünf „+ …“-Formulare. Logik in lib/crm/aktivitaeten.ts.
// MAKE OS verschickt nichts: „+ E-Mail festhalten“ hält nur fest, was außerhalb
// gesendet wurde; „+ Meeting“ legt keine Kalendereinladung an. Geschrieben wird
// nur über die bestehenden Wege: /api/crm/aktivitaet (api.aktivitaet),
// /api/crm/followup (anlegen, erledigen) und — für eigene Notizen — POST
// /api/crm/aktivitaet mit `aktion: 'aendern' | 'loeschen'`, Anker und Stand
// (28.09., H4: 409 statt Überschreiben, Löschmarke gegen Wiederauferstehung).
// „+ Meeting“ legt seit 30.09. (K3) einen echten Termin an (Anlege-Dialog des Kalenders; danach laden die Termin-Listen
// der Akte neu — F3, `termineZuNeuLaden`) — Zeit und Ort liest die
// Akte aus dem Termin (`terminUid`); die alte Form mit `wann`/`ort` (H4) bleibt für den Bestand lesbar.

import Link from 'next/link';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { NOTIZ_FELDER, anzeigename, type Ergebnis, type Kontakt, type AktivitaetArt } from '@/lib/make-one/crm';
import { NeuerTermin } from '../../kalender/NeuerTermin';
import { termineZuNeuLaden } from '../../kalender/TermineAkte';
import type { FollowUpArt } from '@/lib/crm/typen';
import { FOLLOWUP_ARTEN } from '@/lib/crm/followup';
import { nameVon } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import { kanalStatus } from '@/lib/crm/recht';
import {
  ERGEBNIS_KURZ, ERGEBNIS_TITEL, ANRUF_ERGEBNISSE, STATUS_LABEL, darfBearbeiten, bezugAufloesen,
  type Eintrag, type Kategorie,
} from '@/lib/crm/aktivitaeten';
import { Knopf, feld, LEUCHT } from '../../schlank';
import { Wahl } from '../Wahl';
import { NotizFormular, festhalten, hatMailEinwilligung, ERGEBNIS_KNOEPFE } from '../teile';
import { Person, ZustaendigWahl } from '../team';
import { datum, plusTage, type CrmApi } from '../daten';

// ── Symbol je Art ────────────────────────────────────────────────────────────
export const KATEGORIE_FARBE: Record<Kategorie, string> = {
  notizen: LEUCHT.achtung, emails: LEUCHT.agenten, anrufe: LEUCHT.gut, aufgaben: LEUCHT.planung, meetings: LEUCHT.beziehung, system: C.inkLeise,
};

const PFADE: Record<string, ReactNode> = {
  notiz: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  antwort: <><path d="M10 8L4 13l6 5" /><path d="M4 13h10a6 6 0 016 6" /></>,
  linkedin: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13a2.5 2.5 0 015 0v3.5" /></>,
  anruf: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  termin: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  gespraech: <><path d="M4 5h11v8H9l-4 3v-3H4z" /><path d="M15 9h5v8h-1v3l-4-3h-4v-2" /></>,
  event: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  aufgabe: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  system: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>,
};
const pfadVon = (art: Eintrag['art']) => PFADE[art === 'kalender' ? 'termin' : art === 'stufe' || art === 'uebergabe' ? 'system' : art] ?? PFADE.system;

export function ArtSymbol({ e, groesse = 30 }: { e: Pick<Eintrag, 'art' | 'kategorie' | 'ueberfaellig'>; groesse?: number }) {
  const f = e.ueberfaellig ? LEUCHT.kritisch : KATEGORIE_FARBE[e.kategorie];
  return (
    <span aria-hidden style={{ width: groesse, height: groesse, borderRadius: 10, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: `${f}18`, border: `1px solid ${f}55`, color: f }}>
      <svg width={groesse * 0.55} height={groesse * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{pfadVon(e.art)}</svg>
    </span>
  );
}

const kleinChip = (farbe: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${farbe}1C`, color: farbe, border: `1px solid ${farbe}44`, whiteSpace: 'nowrap' });
const ERGEBNIS_FARBE: Partial<Record<Ergebnis, string>> = { gespraech: LEUCHT.gut, termin: LEUCHT.gut, rueckruf: LEUCHT.puls, mailbox: C.inkDim, nicht_erreicht: C.inkDim, kein_bedarf: LEUCHT.achtung, sperre: LEUCHT.kritisch };
const leiseKnopf: CSSProperties = { background: 'none', border: 'none', padding: '4px 2px', color: C.inkDim, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SCHRIFT.text };
const personName = (p?: string) => (p === 'zoe' ? 'ZOE' : p === 'system' ? 'System' : nameVon(p));
const LANG_AB = 240;
const istLang = (t?: string) => !!t && (t.length > LANG_AB || t.split('\n').length > 4);

// ── Karte ────────────────────────────────────────────────────────────────────
export interface KarteProps {
  e: Eintrag; k: Kontakt; api: CrmApi; heute: string;
  kompakt: boolean; markiert: boolean;
  /** Ein Follow-up erledigen (über /api/crm/followup). */
  onErledigen: (id: string) => Promise<void>;
}

export function AktivitaetKarte({ e, k, api, heute, kompakt, markiert, onErledigen }: KarteProps) {
  const router = useRouter();
  const [mehr, setMehr] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [offen, setOffen] = useState(false);
  const zeigeDetails = !kompakt || offen;
  const bezug = bezugAufloesen(e.bezug, api.crm?.stand);
  const eigene = !!e.aktivitaet && darfBearbeiten(e.aktivitaet, api.ich);
  const wann = `${datum(e.tag, heute)}${e.zeit ? ` · ${e.zeit}` : ''}`;
  const zuBezug = () => {
    if (!bezug) return;
    router.push(bezug.art === 'deal' ? WEG.deal(bezug.id) : bezug.art === 'mandat' ? WEG.mandat(bezug.id) : bezug.art === 'event' ? WEG.event(bezug.id) : bezug.art === 'kampagne' ? WEG.kampagne(bezug.id) : WEG.deal());
  };
  const [fehler, setFehler] = useState<string | null>(null);
  /** Eigene Notiz ändern/löschen: eigene Aktion mit Anker und Stand — bei 409 kommt der aktuelle Kontakt zurück. */
  const notizAktion = async (aktion: 'aendern' | 'loeschen', text?: string): Promise<boolean> => {
    if (!e.aktivitaet) return false;
    setLaeuft(true); setFehler(null);
    try {
      if (!k.stand) { await api.laden(); setFehler('Stand wurde nachgeladen — bitte noch einmal.'); return false; }
      const r = await api.aktivitaet({ aktion, id: k.id, anker: e.anker, stand: k.stand, ...(text !== undefined ? { text } : {}) }) as { ok?: boolean; fehler?: string; error?: string };
      if (!r?.ok) { setFehler(r?.fehler ?? r?.error ?? 'Nicht gespeichert.'); return false; }
      return true;
    } finally { setLaeuft(false); }
  };
  const speichern = async () => {
    if (bearbeiten == null || !bearbeiten.trim()) return;
    if (await notizAktion('aendern', bearbeiten)) setBearbeiten(null);
  };
  const weg = async () => {
    await notizAktion('loeschen');
    setLoeschen(false);
  };
  const statusChip = e.quelle === 'followup' && e.status ? (
    e.status === 'offen' ? (e.ueberfaellig ? <span style={kleinChip(LEUCHT.kritisch)}>überfällig</span> : <span style={kleinChip(LEUCHT.planung)}>offen</span>)
      : <span style={kleinChip(e.status === 'erledigt' ? LEUCHT.gut : C.inkDim)}>{STATUS_LABEL[e.status]}</span>
  ) : null;

  return (
    <article id={e.anker} aria-label={`${e.titel}, ${wann}`} style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, padding: kompakt && !offen ? '9px 12px' : '12px 14px', borderRadius: 14, scrollMarginTop: 90,
      background: markiert ? `${C.aktiv}14` : 'rgba(255,255,255,.025)', border: `1px solid ${markiert ? `${C.aktiv}88` : e.ueberfaellig ? `${LEUCHT.kritisch}33` : 'rgba(255,255,255,.06)'}`,
      transition: 'background .4s ease, border-color .4s ease',
    }}>
      <ArtSymbol e={e} groesse={kompakt && !offen ? 26 : 30} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setOffen(!offen)} aria-expanded={zeigeDetails} className="fassbar"
            style={{ background: 'none', border: 'none', padding: 0, cursor: kompakt ? 'pointer' : 'default', textAlign: 'left', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, minWidth: 0 }}
            disabled={!kompakt}>{e.titel}</button>
          <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{wann}</span>
        </div>
        {zeigeDetails && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 12.5, color: C.inkLeise }}>
              {e.person && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{e.person !== 'system' && e.person !== 'zoe' && <Person id={e.person} groesse={16} />}{personName(e.person)}</span>}
              {e.ergebnis && <span style={kleinChip(ERGEBNIS_FARBE[e.ergebnis] ?? C.inkDim)} title={ERGEBNIS_TITEL[e.ergebnis]}>{ERGEBNIS_KURZ[e.ergebnis]}</span>}
              {statusChip}
              {e.ort && <span>Ort: {e.ort}</span>}
              {bezug && <button type="button" onClick={zuBezug} className="fassbar" style={{ ...leiseKnopf, padding: 0, color: C.aktiv }}>{bezug.art === 'deal' ? 'Deal' : bezug.art === 'mandat' ? 'Mandat' : bezug.art === 'event' ? 'Event' : bezug.art === 'kampagne' ? 'Kampagne' : 'Firma'}: {bezug.titel} ›</button>}
              {e.hinweis && <span>{e.hinweis}</span>}
              {/* K3: Meeting aus einem Kalendertermin — Zeit und Ort kommen aus dem Termin; Klick öffnet ihn. */}
              {e.aktivitaet?.terminUid && <Link href={WEG.termin(e.aktivitaet.terminUid, e.tag)} style={{ color: C.aktiv, textDecoration: 'none' }}>im Kalender ›</Link>}
              {e.anlass && <span>Anlass: {e.anlass}</span>}
            </div>
            {bearbeiten != null ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <textarea value={bearbeiten} onChange={x => setBearbeiten(x.target.value)} rows={4} aria-label="Notiz bearbeiten" autoFocus style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Knopf aus={laeuft || !bearbeiten.trim()} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
                  <Knopf leise onClick={() => setBearbeiten(null)}>Abbrechen</Knopf>
                </div>
              </div>
            ) : e.text ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 13, color: C.inkDim, whiteSpace: 'pre-wrap', lineHeight: 1.55, overflowWrap: 'anywhere',
                  ...(istLang(e.text) && !mehr ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>{e.text}</div>
                {istLang(e.text) && <button type="button" onClick={() => setMehr(!mehr)} className="fassbar" style={{ ...leiseKnopf, color: C.aktiv }}>{mehr ? 'weniger' : 'mehr'}</button>}
              </div>
            ) : null}
            {e.notiz && (
              <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
                {NOTIZ_FELDER.filter(f => e.notiz?.[f.id]).map(f => <div key={f.id} style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.45 }}><span style={{ color: C.inkLeise }}>{f.label}:</span> {e.notiz![f.id]}</div>)}
              </div>
            )}
            {(eigene && bearbeiten == null) || (e.quelle === 'followup' && e.status === 'offen' && e.followupId) ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                {e.quelle === 'followup' && e.status === 'offen' && e.followupId && (
                  <button type="button" disabled={laeuft} onClick={async () => { setLaeuft(true); try { await onErledigen(e.followupId!); } finally { setLaeuft(false); } }} className="fassbar" style={{ ...leiseKnopf, color: LEUCHT.gut }}>{laeuft ? 'Speichert …' : '✓ Erledigt'}</button>
                )}
                {eigene && bearbeiten == null && !loeschen && (
                  <>
                    <button type="button" onClick={() => setBearbeiten(e.text ?? '')} className="fassbar" style={leiseKnopf}>Bearbeiten</button>
                    <button type="button" onClick={() => setLoeschen(true)} className="fassbar" style={leiseKnopf}>Löschen</button>
                  </>
                )}
                {loeschen && (
                  <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
                    Notiz wirklich löschen?
                    <button type="button" disabled={laeuft} onClick={() => void weg()} className="fassbar" style={{ ...leiseKnopf, color: LEUCHT.kritisch }}>Ja, löschen</button>
                    <button type="button" onClick={() => setLoeschen(false)} className="fassbar" style={leiseKnopf}>Nein</button>
                  </span>
                )}
              </div>
            ) : null}
            {fehler && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 6 }}>{fehler}</div>}
          </>
        )}
      </div>
    </article>
  );
}

// ── Formulare „+ …“ ──────────────────────────────────────────────────────────
export type NeuArt = 'notiz' | 'email' | 'anruf' | 'meeting' | 'aufgabe';
export const NEU_KNOEPFE: readonly { id: NeuArt; label: string; kategorie: Kategorie }[] = [
  { id: 'notiz', label: '+ Notiz', kategorie: 'notizen' }, { id: 'email', label: '+ E-Mail festhalten', kategorie: 'emails' },
  { id: 'anruf', label: '+ Anruf festhalten', kategorie: 'anrufe' }, { id: 'aufgabe', label: '+ Aufgabe', kategorie: 'aufgaben' },
  { id: 'meeting', label: '+ Meeting', kategorie: 'meetings' },
];

interface FormProps { k: Kontakt; api: CrmApi; heute: string; onFertig: (text: string) => void; onAbbruch: () => void }

const Hinweis = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>{children}</div>;
const Zeile = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px' } as const;
const Fuss = ({ ok, laeuft, knopf, onSpeichern, onAbbruch }: { ok: boolean; laeuft: boolean; knopf: string; onSpeichern: () => void; onAbbruch: () => void }) => (
  <div style={{ display: 'flex', gap: 8 }}><Knopf aus={!ok || laeuft} onClick={onSpeichern}>{laeuft ? 'Speichert …' : knopf}</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></div>
);

/** Aktivität über /api/crm/aktivitaet — die Regeln (Stufe, letzter Kontakt, Wiedervorlage) laufen dort. */
async function schreiben(api: CrmApi, body: Record<string, unknown>): Promise<boolean> {
  const r = await api.aktivitaet(body).catch(() => null);
  return !!r?.kontakt;
}

export function NotizNeu({ k, api, onFertig, onAbbruch }: FormProps) {
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const los = async () => { setLaeuft(true); try { if (await schreiben(api, { id: k.id, art: 'notiz', text: text.trim() })) onFertig('Notiz festgehalten.'); } finally { setLaeuft(false); } };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus placeholder="Notiz — für alle im Team sichtbar" aria-label="Notiz" style={{ ...eingabe, resize: 'vertical' }} />
      <Hinweis>Die private Notiz (nur für dich) steht unter Daten › Datenschutz.</Hinweis>
      <Fuss ok={!!text.trim()} laeuft={laeuft} knopf="Notiz speichern" onSpeichern={() => void los()} onAbbruch={onAbbruch} />
    </div>
  );
}

const MAIL_ARTEN: readonly { id: Extract<AktivitaetArt, 'mail' | 'antwort' | 'linkedin'>; label: string }[] = [
  { id: 'mail', label: 'E-Mail gesendet' }, { id: 'antwort', label: 'Antwort erhalten' }, { id: 'linkedin', label: 'LinkedIn-Nachricht' },
];

export function EmailNeu({ k, api, onFertig, onAbbruch }: FormProps) {
  const [art, setArt] = useState<(typeof MAIL_ARTEN)[number]['id']>('mail');
  const [betreff, setBetreff] = useState('');
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const inhalt = [betreff.trim() ? `Betreff: ${betreff.trim()}` : '', text.trim()].filter(Boolean).join('\n');
  const los = async () => { setLaeuft(true); try { if (await schreiben(api, { id: k.id, art, text: inhalt })) onFertig('Festgehalten.'); } finally { setLaeuft(false); } };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Zeile><span style={{ fontSize: 12.5, color: C.inkLeise }}>Was</span><Wahl liste={MAIL_ARTEN} wert={art} onWahl={setArt} label="Art" /></Zeile>
      {art !== 'linkedin' && <input value={betreff} onChange={e => setBetreff(e.target.value)} placeholder="Betreff" aria-label="Betreff" style={eingabe} />}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Inhalt oder Kernaussage" aria-label="Inhalt" style={{ ...eingabe, resize: 'vertical' }} />
      <Hinweis>Nur festhalten, was außerhalb gesendet oder empfangen wurde — MAKE OS verschickt nichts. Einen Entwurf gibt es oben im Kopf.</Hinweis>
      <Fuss ok={!!inhalt} laeuft={laeuft} knopf="Festhalten" onSpeichern={() => void los()} onAbbruch={onAbbruch} />
    </div>
  );
}

export function AnrufNeu({ k, api, heute, onFertig, onAbbruch }: FormProps) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [text, setText] = useState('');
  // Anlass (U2 #58): bei gelber Telefon-Ampel Pflicht — die Ampel hier ohne Mandats-/Deal-Kontext, der Server rechnet genau.
  const [anlass, setAnlass] = useState('');
  const anlassNoetig = kanalStatus(k, 'telefon').farbe === 'gelb';
  /** Ereigniszeit (U2 #46): leer = heute. */
  const [wann, setWann] = useState('');
  const extra = { ...(anlass.trim() ? { anlass: anlass.trim() } : {}), ...(wann && wann < heute ? { wann } : {}) };
  const [laeuft, setLaeuft] = useState(false);
  const liste = ANRUF_ERGEBNISSE.map(id => ({ id, label: ERGEBNIS_TITEL[id] }));
  const mitNotiz = !!ergebnis && !!ERGEBNIS_KNOEPFE.find(b => b.id === ergebnis)?.notiz;
  const kurz = async () => {
    if (!ergebnis) return;
    setLaeuft(true);
    try { if (await schreiben(api, { id: k.id, art: 'anruf', ergebnis, ...(text.trim() ? { text: text.trim() } : {}), ...extra })) onFertig('Anruf festgehalten.'); } finally { setLaeuft(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Zeile><span style={{ fontSize: 12.5, color: C.inkLeise }}>Ergebnis</span><Wahl liste={liste} wert={ergebnis} onWahl={setErgebnis} label="Ergebnis" /></Zeile>
      <input value={anlass} onChange={e => setAnlass(e.target.value)} placeholder={anlassNoetig ? 'Anlass aus der Beziehung (Pflicht — gelbe Telefon-Ampel)' : 'Anlass (optional)'} aria-label="Anlass des Anrufs" style={eingabe} />
      <Zeile><span style={{ fontSize: 12.5, color: C.inkLeise }}>Wann</span><input type="date" value={wann} max={heute} onChange={e => setWann(e.target.value)} aria-label="Wann war der Anruf (leer = heute)" style={{ ...eingabe, width: 160 }} /></Zeile>
      {mitNotiz ? (
        <NotizFormular heute={heute} ergebnis={ergebnis!} knopf={laeuft ? 'Speichert …' : 'Festhalten'} onAbbruch={onAbbruch} einwilligung={!hatMailEinwilligung(k)} anrede={k.anrede}
          onFertig={async x => {
            setLaeuft(true);
            try {
              const r = await festhalten(api, { id: k.id, art: 'anruf', ergebnis: ergebnis!, notiz: x.notiz, ...(x.naechster ? { naechster: x.naechster } : {}), ...extra }, x.einwilligung, heute);
              if (r.kontakt) onFertig(r.hinweis ?? 'Anruf festgehalten.');
            } finally { setLaeuft(false); }
          }} />
      ) : (
        <>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Notiz (optional)" aria-label="Notiz zum Anruf" style={{ ...eingabe, resize: 'vertical' }} />
          <Hinweis>Nach einem Gespräch, Termin oder Rückruf öffnet sich die Notizvorlage mit dem nächsten Schritt.</Hinweis>
          <Fuss ok={!!ergebnis && (!anlassNoetig || !!anlass.trim())} laeuft={laeuft} knopf="Festhalten" onSpeichern={() => void kurz()} onAbbruch={onAbbruch} />
        </>
      )}
    </div>
  );
}

/**
 * „+ Meeting“ (30.09., K3): ein ECHTER Termin — der Anlege-Dialog des Kalenders, vorbelegt mit der Person (und ihrer
 * Firma). Aus dem Termin wird die Aktivität „Meeting“ (lib/crm/termin-aktivitaet.ts, eine je Termin); Zeit und Ort liest
 * die Akte aus dem Termin. Auch ein vergangenes Meeting wird so ein Termin (Tag in der Vergangenheit wählen).
 */
export function MeetingNeu({ k, api, heute, onFertig, onAbbruch }: FormProps) {
  const stunde = Math.min(22, new Date().getHours() + 1);
  const vorgabe = useMemo(() => ({ tag: heute, von: `${String(stunde).padStart(2, '0')}:00`, art: 'termin' as const, titel: `Meeting ${anzeigename(k)}`.slice(0, 120), crm: { kontaktId: k.id, ...(k.firmaId ? { firmaId: k.firmaId } : {}) } }), [heute, stunde, k]);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Hinweis>Der Termin landet im Kalender (iCloud) und steht dann hier als Meeting — mit der Zeit aus dem Kalender.</Hinweis>
      <NeuerTermin vorgabe={vorgabe} heute={heute} standardDauer={60} kalender={[]} onZu={onAbbruch}
        onAngelegt={x => { if (x.uid) { void api.laden(true); termineZuNeuLaden(); onFertig(x.gaeste ? `Termin angelegt — Einladung an ${x.gaeste} ${x.gaeste === 1 ? 'Person' : 'Personen'} verschickt.` : 'Termin angelegt — steht unter Aktivitäten als Meeting.'); } }} />
    </div>
  );
}

export function AufgabeNeu({ k, api, heute, onFertig, onAbbruch }: FormProps) {
  const [text, setText] = useState('');
  const [art, setArt] = useState<FollowUpArt>('anruf');
  const [faellig, setFaellig] = useState(plusTage(heute, 3));
  const [uhrzeit, setUhrzeit] = useState('');
  const [zustaendig, setZustaendig] = useState<string | undefined>(k.besitzer);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ok = !!text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(faellig) && faellig >= heute;
  const los = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        aktion: 'anlegen', kontaktId: k.id, bezug: { art: 'kontakt', id: k.id }, art, text: text.trim(), faellig, ...(uhrzeit ? { uhrzeit } : {}), ...(zustaendig ? { zustaendig } : {}),
      }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok: boolean; text?: string; fehler?: string };
      if (r.ok) { await api.laden(); onFertig(r.text ?? 'Aufgabe angelegt.'); } else setFehler(r.fehler ?? 'Nicht angelegt.');
    } finally { setLaeuft(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="Was ist zu tun?" aria-label="Aufgabe" style={eingabe} />
      <Zeile>
        <Wahl liste={FOLLOWUP_ARTEN} wert={art} onWahl={setArt} label="Art" />
        <input type="date" value={faellig} min={heute} onChange={e => setFaellig(e.target.value)} aria-label="Fällig am" style={{ ...eingabe, width: 'auto' }} />
        <input type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} aria-label="Uhrzeit (optional)" style={{ ...eingabe, width: 'auto' }} />
      </Zeile>
      <Zeile><span style={{ fontSize: 12.5, color: C.inkLeise }}>Zuständig</span><ZustaendigWahl wert={zustaendig} welt="sales" onWahl={setZustaendig} /></Zeile>
      <Hinweis>Wird ein Follow-up zur Person — es steht auch unter Follow-up und in der Power Hour.</Hinweis>
      {fehler && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      <Fuss ok={ok} laeuft={laeuft} knopf="Aufgabe anlegen" onSpeichern={() => void los()} onAbbruch={onAbbruch} />
    </div>
  );
}

export function NeuFormular({ art, ...p }: FormProps & { art: NeuArt }) {
  switch (art) {
    case 'notiz': return <NotizNeu {...p} />;
    case 'email': return <EmailNeu {...p} />;
    case 'anruf': return <AnrufNeu {...p} />;
    case 'meeting': return <MeetingNeu {...p} />;
    case 'aufgabe': return <AufgabeNeu {...p} />;
  }
}
