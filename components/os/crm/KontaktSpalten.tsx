'use client';

// ─── Kontakt öffnen · linke und rechte Spalte (28.09., HubSpot-Vorbild) ─────
// Links (schmal): Kontaktdaten (E-Mail mit Kopieren + Mail-Programm, Telefon,
// LinkedIn), Schnellaktionen als runde Knöpfe — Notiz · E-Mail · Anruf ·
// Aufgabe · Meeting — und die wichtigsten Infos als Wahl-Chips (Lifecycle,
// Typ, Kategorie, Besitzer, Kreis).
// Rechts (schmal): Firma · Deals · Mandate · Follow-ups, jede Karte
// einklappbar (je Person gemerkt), „+ Hinzufügen“ über die bestehenden Wege
// (Firma verknüpfen/anlegen, DealAnlegen, /api/crm/followup).
// MAKE OS verschickt nichts: „E-Mail“ = Entwurf + Mail-Programm öffnen,
// „Anruf“ = Telefon-Link + Anruf festhalten, „Meeting“ = Termin festhalten
// (keine Einladung, keine Teilnehmer). Kanäle nur, wo die Ampel nicht rot ist.

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, Punkt, feld, LEUCHT } from '../schlank';
import type { Kontakt, Ergebnis } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import type { FollowUpArt } from '@/lib/crm/typen';
import { kanalLink } from '@/lib/crm/erfassen';
import { profilAdresse, suchLink } from '@/lib/crm/netzwerk';
import { OFFENE_STUFEN, STUFEN } from '@/lib/crm/pipeline';
import { faellige, FOLLOWUP_ARTEN } from '@/lib/crm/followup';
import { ANRUF_ERGEBNISSE, ERGEBNIS_KURZ, meetingText, followupAnker } from '@/lib/crm/aktivitaeten';
import { LIFECYCLE_WAHL, LIFECYCLE_LABEL, type LifecyclePhase } from '@/lib/crm/lifecycle';
import type { WahlVorschlag } from '@/lib/crm/wahl';
import { wertelistenVollstaendig } from '@/lib/crm/wertelisten';
import { TEAM, BEIDE, nameVon, haeltBeziehung } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { type CrmApi, datum, euro, plusTage } from './daten';
import { Wahl } from './Wahl';
import { WertelistenEinzelWahl } from './WertelistenWahl';
import { DealAnlegen } from './DealAnlegen';
import { EntwurfTeil, KREISE, lifecycleFarbe, firmaVerknuepfen, type Setze } from './kontakt-teile';
import { Klappe, leiseKnopf, type Klappen } from './kontakt-klappe';

const zeile = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, fontSize: TYP.bedien, minWidth: 0 } as const;
const klein = { fontSize: 12, color: C.inkLeise } as const;
const eingabe = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' };

/** Lifecycle als Wahl-Chip mit Vorschlag — im Kopf und links unter „Wichtigste Infos“. Kein Leeren: die Phase ist immer eine der sieben. */
export function LifecycleWahl({ k, vorschlag, setze, klein: kleinChip }: { k: Kontakt; vorschlag: WahlVorschlag<LifecyclePhase>; setze: Setze; klein?: boolean }) {
  return (
    <span title={k.phase ? `Lifecycle: ${LIFECYCLE_LABEL[k.phase]} (von Hand)` : `Vorschlag: ${LIFECYCLE_LABEL[vorschlag.id]} — ${vorschlag.grund}`} style={{ display: 'inline-flex', minWidth: 0 }}>
      <Wahl label="Lifecycle" liste={LIFECYCLE_WAHL} wert={k.phase} vorschlag={vorschlag} farbe={lifecycleFarbe(k.phase ?? vorschlag.id)} klein={kleinChip}
        onWahl={phase => void setze({ phase })} />
    </span>
  );
}

// ── Links ────────────────────────────────────────────────────────────────────

/** Eine Zeile Kontaktdaten: Zeichen, Wert, rechts die Aktionen. */
function DatenZeile({ zeichen, titel, children, rechts }: { zeichen: string; titel: string; children: ReactNode; rechts?: ReactNode }) {
  return (
    <div style={zeile}>
      <span aria-hidden title={titel} style={{ width: 18, textAlign: 'center', color: C.inkLeise, flex: '0 0 auto' }}>{zeichen}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
      {rechts && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>{rechts}</span>}
    </div>
  );
}

function Kopieren({ text, was }: { text: string; was: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(false), 1500); return () => clearTimeout(t); }, [ok]);
  return (
    <button type="button" onClick={() => { try { void navigator.clipboard.writeText(text).then(() => setOk(true)); } catch { /* ohne Zwischenablage */ } }}
      aria-label={`${was} kopieren`} title={`${was} kopieren`} className="fassbar" style={{ ...leiseKnopf, color: ok ? LEUCHT.gut : C.inkDim }}>{ok ? 'kopiert ✓' : 'Kopieren'}</button>
  );
}

type Aktion = 'notiz' | 'email' | 'anruf' | 'aufgabe' | 'meeting';
const AKTIONEN: { id: Aktion; label: string; zeichen: string }[] = [
  { id: 'notiz', label: 'Notiz', zeichen: '✎' }, { id: 'email', label: 'E-Mail', zeichen: '✉' }, { id: 'anruf', label: 'Anruf', zeichen: '☏' },
  { id: 'aufgabe', label: 'Aufgabe', zeichen: '✓' }, { id: 'meeting', label: 'Meeting', zeichen: '◷' },
];

export function KontaktLinks({ k, api, heute, ampel, setze, klappen, lifecycle }: {
  k: Kontakt; api: CrmApi; heute: string; ampel: KanalStatus[]; setze: Setze; klappen: Klappen; lifecycle: WahlVorschlag<LifecyclePhase>;
}) {
  const [aktion, setAktion] = useState<Aktion | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  useEffect(() => { setAktion(null); setMeldung(null); }, [k.id]);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 4000); return () => clearTimeout(t); }, [meldung]);
  const status = (kanal: string) => ampel.find(s => s.kanal === kanal);
  const mail = status('mail'), tel = status('telefon');
  const telefon = k.telefon ?? k.sms;
  const mailHref = mail && k.email ? kanalLink(mail, { email: k.email }) : null;
  const telHref = tel && telefon ? kanalLink(tel, { telefon }) : null;
  const profil = profilAdresse(k.linkedin);
  const mailOk = !!mail && mail.farbe !== 'rot';
  const gesperrt = !!k.werbesperre;
  const aus: Partial<Record<Aktion, string>> = gesperrt ? { email: 'Werbesperre — kein Kanal', anruf: 'Werbesperre — kein Kanal' } : {};
  const listen = wertelistenVollstaendig(api.crm?.stand.wertelisten);
  const fertig = (text: string) => { setMeldung(text); setAktion(null); };
  const ampelPunkt = (s?: KanalStatus) => s ? <span title={s.grund} style={{ width: 7, height: 7, borderRadius: '50%', background: s.farbe === 'gruen' ? LEUCHT.gut : s.farbe === 'gelb' ? LEUCHT.achtung : LEUCHT.kritisch, flex: '0 0 auto' }} /> : null;
  const infoZeile = (label: string, inhalt: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', gap: 8, alignItems: 'center', minHeight: 34 }}>
      <span style={{ fontSize: 12.5, color: C.inkLeise }}>{label}</span><div style={{ minWidth: 0 }}>{inhalt}</div>
    </div>
  );
  const besitzerListe = [...TEAM.map(t => ({ id: t.id, label: t.name })), { id: BEIDE, label: 'Beide' }];

  return (
    <>
      <Klappe id="l-kontakt" i={1} klein titel="Kontakt" zu={klappen.istZu('l-kontakt')} umschalten={klappen.umschalten}>
        <div style={{ display: 'grid', gap: 2 }}>
          {k.email
            ? <DatenZeile zeichen="✉" titel="E-Mail" rechts={<><Kopieren text={k.email} was="E-Mail" />{mailHref && <a href={mailHref} title={`Im Mail-Programm öffnen · ${mail?.grund ?? ''}`} style={{ ...leiseKnopf, textDecoration: 'none' }}>Mail ↗</a>}</>}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ampelPunkt(mail)}<span title={k.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.email}</span></span>
              </DatenZeile>
            : <DatenZeile zeichen="✉" titel="E-Mail"><span style={klein}>keine E-Mail</span></DatenZeile>}
          {telefon
            ? <DatenZeile zeichen="☏" titel="Telefon" rechts={<><Kopieren text={telefon} was="Telefon" />{telHref && <a href={telHref} title={`Anrufen · ${tel?.grund ?? ''}`} style={{ ...leiseKnopf, textDecoration: 'none' }}>Anrufen ↗</a>}</>}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ampelPunkt(tel)}{telefon}</span>
              </DatenZeile>
            : <DatenZeile zeichen="☏" titel="Telefon"><span style={klein}>kein Telefon</span></DatenZeile>}
          <DatenZeile zeichen="in" titel="LinkedIn">
            {profil ? <a href={profil} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: 'none' }}>{profil.replace(/^https:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '') || 'Profil'} ↗</a>
              : <a href={suchLink(k)} target="_blank" rel="noopener noreferrer" style={{ color: LEUCHT.business, textDecoration: 'none', fontSize: 12.5 }}>Auf LinkedIn suchen ↗</a>}
          </DatenZeile>
          {mail && mail.farbe !== 'gruen' && <div style={{ ...klein, marginTop: 4, lineHeight: 1.45 }}>Mail: {mail.grund}</div>}
        </div>

        <div role="toolbar" aria-label="Schnellaktionen" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {AKTIONEN.map(a => {
            const an = aktion === a.id, gesperrtHier = aus[a.id];
            return (
              <button key={a.id} type="button" onClick={() => setAktion(an ? null : a.id)} disabled={!!gesperrtHier} aria-pressed={an} title={gesperrtHier ?? a.label} className="fassbar"
                style={{ display: 'grid', justifyItems: 'center', gap: 5, background: 'none', border: 'none', padding: '2px 0', cursor: gesperrtHier ? 'default' : 'pointer', color: gesperrtHier ? C.inkLeise : C.ink, fontFamily: SCHRIFT.text, opacity: gesperrtHier ? 0.5 : 1 }}>
                <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, border: `1px solid ${an ? C.aktiv : 'rgba(255,255,255,.14)'}`, background: an ? `${C.aktiv}22` : 'rgba(255,255,255,.04)', color: an ? C.aktiv : C.ink, transition: 'background .15s ease, border-color .15s ease' }}>{a.zeichen}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{a.label}</span>
              </button>
            );
          })}
        </div>
        {meldung && <div role="status" style={{ fontSize: 12.5, color: LEUCHT.gut, marginTop: 10 }}>{meldung}</div>}
        {aktion && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
            {aktion === 'notiz' && <NotizAktion k={k} api={api} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'email' && <EmailAktion k={k} api={api} mailOk={mailOk} mailHref={mailHref} onFertig={fertig} />}
            {aktion === 'anruf' && <AnrufAktion k={k} api={api} heute={heute} telHref={telHref} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'aufgabe' && <AufgabeAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'meeting' && <MeetingAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          </div>
        )}
      </Klappe>

      <Klappe id="l-infos" i={2} klein titel="Wichtigste Infos" zu={klappen.istZu('l-infos')} umschalten={klappen.umschalten}>
        <div style={{ display: 'grid', gap: 2 }}>
          {infoZeile('Lifecycle', <LifecycleWahl k={k} vorschlag={lifecycle} setze={setze} klein />)}
          {infoZeile('Typ', <WertelistenEinzelWahl liste="typen" werte={listen.typen} wert={k.typ} onWahl={typ => void setze({ typ })} api={api} klein />)}
          {infoZeile('Kategorie', <WertelistenEinzelWahl liste="kategorien" werte={listen.kategorien} wert={k.kategorie} onWahl={kategorie => void setze({ kategorie })} api={api} klein />)}
          {infoZeile('Besitzer', <Wahl label="Besitzer" klein liste={besitzerListe} wert={k.besitzer} leer={`${nameVon(haeltBeziehung(k))} (Standard) ▾`} farbe={LEUCHT.beziehung}
            onWahl={besitzer => void setze({ besitzer })} onLeeren={k.besitzer ? () => void setze({ besitzer: undefined }) : undefined} leerenLabel="Standard (Sales-Verantwortung)" />)}
          {infoZeile('Kreis', <Wahl label="Kreis" klein liste={KREISE} wert={k.kreis} farbe={LEUCHT.beziehung} onWahl={kreis => void setze({ kreis })} onLeeren={() => void setze({ kreis: undefined })} />)}
        </div>
      </Klappe>
    </>
  );
}

function Fuss({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}
const Hinweis = ({ children }: { children: ReactNode }) => <div style={{ ...klein, lineHeight: 1.45 }}>{children}</div>;

function NotizAktion({ k, api, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    if (!text.trim() || laeuft) return;
    setLaeuft(true);
    const r = await api.aktivitaet({ id: k.id, art: 'notiz', text: text.trim() });
    setLaeuft(false);
    if (r.kontakt) onFertig('Notiz festgehalten.');
  };
  return (
    <>
      <textarea autoFocus rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Notiz für das Team …" aria-label="Notiz"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void speichern(); if (e.key === 'Escape') { e.stopPropagation(); onAbbruch(); } }} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
      <Fuss><Knopf aus={!text.trim() || laeuft} onClick={() => void speichern()}>Notiz festhalten</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
      <Hinweis>Steht im Verlauf (Aktivitäten › Notizen) — für alle im Team.</Hinweis>
    </>
  );
}

function EmailAktion({ k, api, mailOk, mailHref, onFertig }: { k: Kontakt; api: CrmApi; mailOk: boolean; mailHref: string | null; onFertig: (t: string) => void }) {
  return (
    <>
      <EntwurfTeil k={k} mailOk={mailOk} ohneTitel />
      <Fuss>
        {mailHref && <a href={mailHref} className="fassbar" style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink, textDecoration: 'none', padding: '8px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)' }}>Mail-Programm öffnen ↗</a>}
        {k.email && <button type="button" onClick={() => void api.aktivitaet({ id: k.id, art: 'mail' }).then(r => { if (r.kontakt) onFertig('Mail festgehalten.'); })} style={leiseKnopf}>Mail ist raus — festhalten</button>}
      </Fuss>
      <Hinweis>{mailHref ? 'MAKE OS verschickt nichts — die Mail geht aus deinem eigenen Programm.' : 'Mail ist für diese Person nicht freigegeben (Ampel) oder es fehlt die Adresse — den Entwurf nur im persönlichen Gespräch nutzen.'}</Hinweis>
    </>
  );
}

function AnrufAktion({ k, api, heute, telHref, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; heute: string; telHref: string | null; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [text, setText] = useState('');
  const [schritt, setSchritt] = useState('');
  const [am, setAm] = useState(plusTage(heute, 2));
  const [laeuft, setLaeuft] = useState(false);
  const liste = ANRUF_ERGEBNISSE.map(e => ({ id: e, label: ERGEBNIS_KURZ[e] }));
  const speichern = async () => {
    if (!ergebnis || laeuft) return;
    setLaeuft(true);
    const r = await api.aktivitaet({ id: k.id, art: 'anruf', ergebnis, ...(text.trim() ? { text: text.trim() } : {}), ...(schritt.trim() && am ? { naechster: { text: schritt.trim(), datum: am } } : {}) });
    setLaeuft(false);
    if (r.kontakt) onFertig(r.hinweis ? `Anruf festgehalten — ${r.hinweis}` : 'Anruf festgehalten.');
  };
  return (
    <>
      {telHref ? <a href={telHref} className="fassbar" style={{ justifySelf: 'start', fontSize: TYP.bedien, fontWeight: 700, color: C.ink, textDecoration: 'none', padding: '8px 13px', borderRadius: 11, border: `1px solid ${LEUCHT.gut}55`, background: `${LEUCHT.gut}14` }}>☏ Anrufen</a>
        : <Hinweis>Kein freigegebenes Telefon — Kaltanruf nur mit Anlass (Ampel).</Hinweis>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Ergebnis</span><Wahl label="Ergebnis" klein liste={liste} wert={ergebnis} onWahl={setErgebnis} /></div>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Kurz: worum ging es?" aria-label="Notiz zum Anruf" style={eingabe} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={schritt} onChange={e => setSchritt(e.target.value)} placeholder="Nächster Schritt (optional)" aria-label="Nächster Schritt" style={{ ...eingabe, flex: 1, minWidth: 0 }} />
        <input type="date" value={am} min={heute} onChange={e => setAm(e.target.value)} aria-label="Datum des nächsten Schritts" style={{ ...eingabe, width: 136, flex: '0 0 auto' }} />
      </div>
      <Fuss><Knopf aus={!ergebnis || laeuft} onClick={() => void speichern()}>Anruf festhalten</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
    </>
  );
}

function AufgabeAktion({ k, api, heute, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; heute: string; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [text, setText] = useState('');
  const [faellig, setFaellig] = useState(plusTage(heute, 2));
  const [art, setArt] = useState<FollowUpArt>('anruf');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const anlegen = async () => {
    if (!text.trim() || !faellig || laeuft) return;
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'anlegen', kontaktId: k.id, text: text.trim(), faellig, art, ...(api.ich ? { zustaendig: api.ich } : {}) }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok?: boolean; fehler?: string; text?: string };
    setLaeuft(false);
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht angelegt.'); return; }
    void api.laden();
    onFertig(r.text ?? 'Aufgabe steht.');
  };
  return (
    <>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Was ist zu tun?" aria-label="Aufgabe" onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} style={eingabe} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={faellig} min={heute} onChange={e => setFaellig(e.target.value)} aria-label="Fällig am" style={{ ...eingabe, width: 150 }} />
        <Wahl label="Art" klein liste={FOLLOWUP_ARTEN} wert={art} onWahl={setArt} />
      </div>
      {fehler && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      <Fuss><Knopf aus={!text.trim() || laeuft} onClick={() => void anlegen()}>Aufgabe anlegen</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
      <Hinweis>Landet als Follow-up in Follow-up › Fällig und hier rechts.</Hinweis>
    </>
  );
}

function MeetingAktion({ k, api, heute, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; heute: string; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [tag, setTag] = useState(heute);
  const [zeit, setZeit] = useState('');
  const [ort, setOrt] = useState('');
  const [notiz, setNotiz] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || laeuft) return;
    setLaeuft(true);
    const r = await api.aktivitaet({ id: k.id, art: 'termin', text: meetingText({ tag, ...(zeit ? { zeit } : {}), ...(ort.trim() ? { ort } : {}), ...(notiz.trim() ? { notiz } : {}) }) });
    setLaeuft(false);
    if (r.kontakt) onFertig('Meeting festgehalten.');
  };
  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="date" value={tag} onChange={e => setTag(e.target.value)} aria-label="Datum des Meetings" style={{ ...eingabe, flex: 1, minWidth: 0 }} />
        <input type="time" value={zeit} onChange={e => setZeit(e.target.value)} aria-label="Uhrzeit" style={{ ...eingabe, width: 104, flex: '0 0 auto' }} />
      </div>
      <input value={ort} onChange={e => setOrt(e.target.value)} placeholder="Ort oder Video (optional)" aria-label="Ort" style={eingabe} />
      <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Worum geht es? (optional)" aria-label="Notiz zum Meeting" style={eingabe} />
      <Fuss><Knopf aus={laeuft} onClick={() => void speichern()}>Meeting festhalten</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
      <Hinweis>Nur festgehalten (Aktivitäten › Meetings) — keine Kalendereinladung, keine Teilnehmer.</Hinweis>
    </>
  );
}

// ── Rechts ───────────────────────────────────────────────────────────────────

export function KontaktRechts({ k, api, heute, setze, klappen, zuFirma, zuAufgabe }: {
  k: Kontakt; api: CrmApi; heute: string; setze: Setze; klappen: Klappen; zuFirma: (id: string) => void;
  /** Sprung in den Reiter Aktivitäten › Aufgaben zu diesem Follow-up (Anker). */
  zuAufgabe: (anker: string) => void;
}) {
  const crm = api.crm;
  const firmen = crm?.stand.firmen ?? [];
  const firma = k.firmaId ? firmen.find(f => f.id === k.firmaId) : undefined;
  const [firmaNeu, setFirmaNeu] = useState<string | null>(null);
  const [dealNeu, setDealNeu] = useState(false);
  const [aufgabeNeu, setAufgabeNeu] = useState(false);
  useEffect(() => { setFirmaNeu(null); setDealNeu(false); setAufgabeNeu(false); }, [k.id]);
  const deals = useMemo(() => {
    const l = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
    return [...l].sort((a, b) => Number(OFFENE_STUFEN.includes(b.stufe)) - Number(OFFENE_STUFEN.includes(a.stufe)) || (b.geaendert ?? '').localeCompare(a.geaendert ?? ''));
  }, [crm, k.id]);
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const aktiveMandate = mandate.filter(m => m.status === 'aktiv');
  const followups = useMemo(() => (crm ? faellige([k], crm.stand, heute, { horizont: 365, wertelisten: crm.stand.wertelisten }).filter(f => f.kontaktId === k.id) : []), [crm, k, heute]);
  const offeneDeals = deals.filter(c => OFFENE_STUFEN.includes(c.stufe)).length;
  const plus = (label: string, an: () => void) => <button type="button" onClick={an} style={leiseKnopf}>+ {label}</button>;

  return (
    <>
      <Klappe id="r-firma" i={1} klein titel="Firma" zu={klappen.istZu('r-firma')} umschalten={klappen.umschalten}
        rechts={!firma && firmaNeu === null ? plus('Hinzufügen', () => setFirmaNeu('')) : undefined}>
        {firma ? (
          <div style={{ display: 'grid', gap: 2 }}>
            <button type="button" onClick={() => zuFirma(firma.id)} className="fassbar" style={{ ...zeile, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, textAlign: 'left' }}>
              <b style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firma.name}</b><span aria-hidden style={{ color: C.inkLeise }}>›</span>
            </button>
            {(firma.domain || firma.webseite) && <DatenZeile zeichen="⌂" titel="Domain"><a href={/^https?:\/\//i.test(firma.webseite ?? '') ? firma.webseite : `https://${firma.domain ?? firma.webseite}`} target="_blank" rel="noopener noreferrer" style={{ color: C.inkDim, textDecoration: 'none' }}>{firma.domain ?? firma.webseite} ↗</a></DatenZeile>}
            {firma.telefon && <DatenZeile zeichen="☏" titel="Telefon der Firma" rechts={<Kopieren text={firma.telefon} was="Telefon" />}>{firma.telefon}</DatenZeile>}
            {(firma.branche || firma.stadt) && <div style={{ ...klein, marginTop: 2 }}>{[firma.branche, firma.stadt].filter(Boolean).join(' · ')}</div>}
          </div>
        ) : firmaNeu !== null ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <input autoFocus list="kontakt-firmen" value={firmaNeu} onChange={e => setFirmaNeu(e.target.value)} placeholder="Firma suchen oder neu …" aria-label="Firma"
              onKeyDown={e => { if (e.key === 'Enter' && firmaNeu.trim()) void firmaVerknuepfen(api, k, firmaNeu, setze).then(() => setFirmaNeu(null)); if (e.key === 'Escape') { e.stopPropagation(); setFirmaNeu(null); } }} style={eingabe} />
            <datalist id="kontakt-firmen">{firmen.slice(0, 400).map(f => <option key={f.id} value={f.name} />)}</datalist>
            <Fuss>
              <Knopf aus={!firmaNeu.trim()} onClick={() => void firmaVerknuepfen(api, k, firmaNeu, setze).then(() => setFirmaNeu(null))}>{firmen.some(f => f.name.toLowerCase() === firmaNeu.trim().toLowerCase()) ? 'Verknüpfen' : firmaNeu.trim() ? 'Anlegen und verknüpfen' : 'Verknüpfen'}</Knopf>
              <Knopf leise onClick={() => setFirmaNeu(null)}>Abbrechen</Knopf>
            </Fuss>
          </div>
        ) : <div style={klein}>{k.firma ? `„${k.firma}“ aus dem Import — noch keine Firma verknüpft.` : 'Keine Firma verknüpft.'}</div>}
      </Klappe>

      <Klappe id="r-deals" i={2} klein titel={`Deals${deals.length ? ` · ${offeneDeals ? `${offeneDeals} offen` : deals.length}` : ''}`} zu={klappen.istZu('r-deals')} umschalten={klappen.umschalten}
        rechts={!dealNeu ? plus('Hinzufügen', () => setDealNeu(true)) : undefined}>
        {dealNeu && <div style={{ marginBottom: 10 }}><DealAnlegen api={api} kontaktId={k.id} onFertig={() => setDealNeu(false)} onAbbruch={() => setDealNeu(false)} /></div>}
        {deals.slice(0, 8).map(c => {
          const offen = OFFENE_STUFEN.includes(c.stufe);
          const ampel = crm?.ampel[c.id]?.ampel;
          return (
            <Link key={c.id} href={WEG.deal(c.id)} className="fassbar" style={{ display: 'grid', gap: 1, padding: '6px 0', color: offen ? C.ink : C.inkLeise, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,.045)' }}>
              <span style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0 }}>
                <Punkt farbe={!offen ? C.inkLeise : ampel === 'rot' ? LEUCHT.kritisch : ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} groesse={7} />
                <b style={{ fontWeight: 600, fontSize: TYP.bedien, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titel}</b>
              </span>
              <span style={{ ...klein, paddingLeft: 14 }}>{STUFEN.find(s => s.id === c.stufe)?.label ?? c.stufe} · {c.wert.betrag ? `${euro(c.wert.betrag)}${c.wert.basis === 'monat' ? '/Monat' : c.wert.basis === 'jahr' ? '/Jahr' : ''}` : 'ohne Wert'}</span>
            </Link>
          );
        })}
        {deals.length > 8 && <div style={{ ...klein, marginTop: 6 }}>… und {deals.length - 8} weitere im Reiter Umsatz.</div>}
        {!deals.length && !dealNeu && <div style={klein}>Noch kein Deal.</div>}
      </Klappe>

      <Klappe id="r-mandate" i={3} klein titel={`Mandate${aktiveMandate.length ? ` · ${aktiveMandate.length} aktiv` : ''}`} zu={klappen.istZu('r-mandate')} umschalten={klappen.umschalten}
        rechts={mandate.length > aktiveMandate.length ? <Link href={mandateLink('mandate')} style={{ ...leiseKnopf, textDecoration: 'none' }}>alle ›</Link> : undefined}>
        {aktiveMandate.map(m => (
          <Link key={m.id} href={mandateLink('mandate', m.id)} className="fassbar" style={{ display: 'grid', gap: 1, padding: '6px 0', color: C.ink, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,.045)' }}>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center', minWidth: 0 }}><Punkt farbe={LEUCHT.geld} groesse={7} /><b style={{ fontWeight: 600, fontSize: TYP.bedien, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titel}</b></span>
            <span style={{ ...klein, paddingLeft: 14 }}>{m.honorar?.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'ohne Honorar'}{m.start ? ` · seit ${datum(m.start, heute)}` : ''}</span>
          </Link>
        ))}
        {!aktiveMandate.length && <div style={klein}>{mandate.length ? `Kein aktives Mandat (${mandate.length} beendet oder pausiert).` : 'Kein Mandat.'}</div>}
      </Klappe>

      <Klappe id="r-followups" i={4} klein titel={`Follow-ups${followups.length ? ` · ${followups.length}` : ''}`} zu={klappen.istZu('r-followups')} umschalten={klappen.umschalten}
        rechts={!aufgabeNeu ? plus('Hinzufügen', () => setAufgabeNeu(true)) : undefined}>
        {aufgabeNeu && <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}><AufgabeAktion k={k} api={api} heute={heute} onFertig={() => setAufgabeNeu(false)} onAbbruch={() => setAufgabeNeu(false)} /></div>}
        {followups.slice(0, 8).map(f => {
          const ueber = f.tageUeber > 0;
          return (
            <button key={f.id} type="button" onClick={() => zuAufgabe(followupAnker(f.id))} className="fassbar"
              style={{ display: 'grid', gap: 1, width: '100%', padding: '6px 0', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.045)', cursor: 'pointer', textAlign: 'left', color: C.ink, fontFamily: SCHRIFT.text }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.text}</span>
              <span style={{ ...klein, color: ueber ? LEUCHT.kritisch : C.inkLeise }}>{ueber ? `seit ${f.tageUeber} T überfällig` : `fällig ${datum(f.faellig, heute)}`}{f.uhrzeit ? ` · ${f.uhrzeit}` : ''} · {nameVon(f.zustaendig)}</span>
            </button>
          );
        })}
        {followups.length > 8 && <div style={{ ...klein, marginTop: 6 }}>… und {followups.length - 8} weitere unter Aktivitäten › Aufgaben.</div>}
        {!followups.length && !aufgabeNeu && <div style={klein}>Nichts offen.</div>}
      </Klappe>
    </>
  );
}
