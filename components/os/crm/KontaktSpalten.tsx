'use client';

// ─── Kontakt öffnen · linke und rechte Spalte (28.09., HubSpot-Vorbild) ─────
// Links (schmal): Kontaktdaten (E-Mail mit Kopieren + Mail-Programm, Telefon,
// LinkedIn), Schnellaktionen als runde Knöpfe — Notiz · E-Mail · Anruf ·
// Aufgabe · Meeting — und die wichtigsten Infos als Wahl-Chips (Lifecycle,
// BEAN, Typ, Kategorie, Labels, Zuständig, Kreis — Feld `besitzer`).
// Rechts (schmal): Firma · Deals · Mandate · Follow-ups, jede Karte
// einklappbar (je Person gemerkt), „+ Hinzufügen“ über die bestehenden Wege
// (Firma verknüpfen/anlegen, DealAnlegen, /api/crm/followup).
// MAKE OS verschickt nichts: „E-Mail“ = Entwurf + Mail-Programm öffnen,
// „Anruf“ = Telefon-Link + Anruf festhalten. „Meeting“ (seit 30.09., K3) legt einen ECHTEN Termin an
// (Anlege-Dialog des Kalenders, vorbelegt mit der Person) — der Termin wird über `kalender-bezug` zur Aktivität
// „Meeting“ (eine Quelle, keine lose zweite Aktivität). Gäste nur, wenn man sie im Dialog einträgt, und erst nach
// der Rückfrage „Einladung senden?“. Kanäle nur, wo die Ampel nicht rot ist.

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, Punkt, feld, LEUCHT, Hinweis as Meldung } from '../ui';
import type { Kontakt, Ergebnis } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import type { FollowUpArt } from '@/lib/crm/typen';
import { kanalLink } from '@/lib/crm/erfassen';
import { profilAdresse, suchLink } from '@/lib/crm/netzwerk';
import { OFFENE_STUFEN, STUFEN } from '@/lib/crm/pipeline';
import { faellige, FOLLOWUP_ARTEN } from '@/lib/crm/followup';
import { ANRUF_ERGEBNISSE, ERGEBNIS_KURZ, followupAnker } from '@/lib/crm/aktivitaeten';
import { MeetingNeu } from './kontakt/aktivitaeten-teile';
import { TermineAkte } from '../kalender/TermineAkte';
import { LIFECYCLE_WAHL, LIFECYCLE_LABEL, LIFECYCLE_KURZ, type LifecyclePhase } from '@/lib/crm/lifecycle';
import type { BeanErgebnis } from '@/lib/crm/bean';
import type { WahlVorschlag } from '@/lib/crm/wahl';
import { wertelistenVollstaendig } from '@/lib/crm/wertelisten';
import { TEAM, BEIDE, nameVon, haeltBeziehung } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import { mandateLink, angebotLink } from '@/lib/crm/adresse';
import { suchPasst } from '@/lib/text/such-norm';
import { type CrmApi, datum, euro, plusTage } from './daten';
import { Wahl } from './Wahl';
import { WertelistenMehrfachWahl } from './WertelistenWahl';
import { emailsVon, emailsFelder, adresseNorm, EMAIL_ART_WAHL, type EmailAdresse, type EmailArt } from '@/lib/crm/emails';
import { typenVon, kategorienVon, labelsVon, typenFelder, kategorienFelder } from '@/lib/crm/mehrfach';
import { StationenTeil } from './kontakt/StationenTeil';
import { stationenVon } from '@/lib/crm/stationen';
import { DealAnlegen } from './DealAnlegen';
import { EntwurfTeil, KREISE, lifecycleFarbe, firmaVerknuepfen, type Setze } from './kontakt-teile';
import { Klappe, leiseKnopf, type Klappen } from './kontakt-klappe';
import { useStimme } from '@/hooks/useStimme';
import { BeanWahl } from './bean-teile';
import { AufgabenAkte, useAkteAufgaben } from '../aufgaben/AufgabenAkte';
import { useTasks } from '@/context/TasksContext';
import { aufgabeAnlegen } from '../aufgaben/hilfe';
import { mandantSpaceId } from '@/lib/aufgaben/struktur';
import type { Owner } from '@/types/common';
import { ZoeVorschlaege } from './ZoeFragen';

const zeile = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, fontSize: TYP.bedien, minWidth: 0 } as const;
const klein = { fontSize: TYP.bedien, color: C.inkLeise } as const;
const eingabe = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' };

/**
 * Lifecycle als Wahl-Chip — im Kopf und links unter „Wichtigste Infos“. Kein Leeren: die Phase ist immer eine der sieben.
 * Ohne gesetzte Phase gilt „Lead“ (28.09., H4) — gestrichelt; ein Vorschlag erscheint nur, wenn er höher ist
 * (`lifecycleVorschlagHoeher`), und wird nie still gespeichert.
 */
export function LifecycleWahl({ k, vorschlag, setze, klein: kleinChip }: { k: Kontakt; vorschlag: WahlVorschlag<LifecyclePhase> | null; setze: Setze; klein?: boolean }) {
  const titel = k.phase ? `Lifecycle: ${LIFECYCLE_LABEL[k.phase]} (von Hand)`
    : vorschlag ? `Nicht gesetzt — gilt als Lead. Vorschlag: ${LIFECYCLE_LABEL[vorschlag.id]} — ${vorschlag.grund}` : 'Nicht gesetzt — gilt als Lead';
  return (
    <span title={titel} style={{ display: 'inline-flex', minWidth: 0 }}>
      <Wahl label="Lifecycle" liste={LIFECYCLE_WAHL} wert={k.phase} vorschlag={vorschlag} farbe={lifecycleFarbe(k.phase ?? vorschlag?.id ?? 'lead')} klein={kleinChip}
        leer={`${LIFECYCLE_KURZ.lead} ▾`} onWahl={phase => void setze({ phase })} />
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

export function KontaktLinks({ k, api, heute, ampel, setze, klappen, lifecycle, bean, schnellaktionen = true }: {
  k: Kontakt; api: CrmApi; heute: string; ampel: KanalStatus[]; setze: Setze; klappen: Klappen; lifecycle: WahlVorschlag<LifecyclePhase> | null;
  /** Die runden Schnellaktionen hier zeigen (Rechner). Am Handy stehen sie oben als Leiste (kontakt/SchnellLeiste.tsx, 02.10.) — dann nicht doppelt. */
  schnellaktionen?: boolean;
  /** BEAN-Kundengruppe (28.09., H4) — aus beanVon, mit den offenen Angeboten der Ablage. */
  bean: BeanErgebnis;
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
  // Art. 18 (U2): eingeschränkt = nichts festhalten, nichts ansprechen — alle Schnellaktionen aus.
  const aus: Partial<Record<Aktion, string>> = k.eingeschraenkt
    ? Object.fromEntries(AKTIONEN.map(a => [a.id, 'Verarbeitung eingeschränkt (Art. 18)'])) as Partial<Record<Aktion, string>>
    : gesperrt ? { email: 'Werbesperre — kein Kanal', anruf: 'Werbesperre — kein Kanal' } : {};
  const listen = wertelistenVollstaendig(api.crm?.stand.wertelisten);
  const fertig = (text: string) => { setMeldung(text); setAktion(null); };
  const ampelPunkt = (s?: KanalStatus) => s ? <span title={s.grund} style={{ width: 7, height: 7, borderRadius: '50%', background: s.farbe === 'gruen' ? LEUCHT.gut : s.farbe === 'gelb' ? LEUCHT.achtung : LEUCHT.kritisch, flex: '0 0 auto' }} /> : null;
  const infoZeile = (label: string, inhalt: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(0, 1fr)', gap: 8, alignItems: 'center', minHeight: 34 }}>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{label}</span><div style={{ minWidth: 0 }}>{inhalt}</div>
    </div>
  );
  const besitzerListe = [...TEAM.map(t => ({ id: t.id, label: t.name })), { id: BEIDE, label: 'Beide' }];

  return (
    <>
      <Klappe id="l-kontakt" i={1} klein titel="Kontakt" zu={klappen.istZu('l-kontakt')} umschalten={klappen.umschalten}>
        <div style={{ display: 'grid', gap: 2 }}>
          <EmailListe k={k} setze={setze} mail={mail} ampelPunkt={ampelPunkt(mail)} />
          {telefon
            ? <DatenZeile zeichen="☏" titel="Telefon" rechts={<><Kopieren text={telefon} was="Telefon" />{telHref && <a href={telHref} title={`Anrufen · ${tel?.grund ?? ''}`} style={{ ...leiseKnopf, textDecoration: 'none' }}>Anrufen ↗</a>}</>}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ampelPunkt(tel)}{telefon}</span>
              </DatenZeile>
            : <DatenZeile zeichen="☏" titel="Telefon"><span style={klein}>kein Telefon</span></DatenZeile>}
          <DatenZeile zeichen="in" titel="LinkedIn">
            {profil ? <a href={profil} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: 'none' }}>{profil.replace(/^https:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '') || 'Profil'} ↗</a>
              : <a href={suchLink(k)} target="_blank" rel="noopener noreferrer" style={{ color: LEUCHT.business, textDecoration: 'none', fontSize: TYP.bedien }}>Auf LinkedIn suchen ↗</a>}
          </DatenZeile>
          {mail && mail.farbe !== 'gruen' && <div style={{ ...klein, marginTop: 4, lineHeight: 1.45 }}>Mail: {mail.grund}</div>}
        </div>

        {schnellaktionen && <div role="toolbar" aria-label="Schnellaktionen" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {AKTIONEN.map(a => {
            const an = aktion === a.id, gesperrtHier = aus[a.id];
            return (
              <button key={a.id} type="button" onClick={() => setAktion(an ? null : a.id)} disabled={!!gesperrtHier} aria-pressed={an} title={gesperrtHier ?? a.label} className="fassbar"
                style={{ display: 'grid', justifyItems: 'center', gap: 5, background: 'none', border: 'none', padding: '2px 0', cursor: gesperrtHier ? 'default' : 'pointer', color: gesperrtHier ? C.inkLeise : C.ink, fontFamily: SCHRIFT.text, opacity: gesperrtHier ? 0.5 : 1 }}>
                <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, border: `1px solid ${an ? C.aktiv : 'rgba(255,255,255,.14)'}`, background: an ? `${C.aktiv}22` : 'rgba(255,255,255,.04)', color: an ? C.aktiv : C.ink, transition: 'background .15s ease, border-color .15s ease' }}>{a.zeichen}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
              </button>
            );
          })}
        </div>}
        {meldung && <Meldung art="gut" rolle="status">{meldung}</Meldung>}
        {schnellaktionen && aktion && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
            {aktion === 'notiz' && <NotizAktion k={k} api={api} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'email' && <EmailAktion k={k} api={api} mailOk={mailOk} mailHref={mailHref} onFertig={fertig} />}
            {aktion === 'anruf' && <AnrufAktion k={k} api={api} heute={heute} telHref={telHref} anlassNoetig={tel?.farbe === 'gelb'} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'aufgabe' && <AufgabeAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
            {aktion === 'meeting' && <MeetingAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          </div>
        )}
      </Klappe>

      <Klappe id="l-infos" i={2} klein titel="Wichtigste Infos" zu={klappen.istZu('l-infos')} umschalten={klappen.umschalten}>
        <div style={{ display: 'grid', gap: 2 }}>
          {infoZeile('Lifecycle', <LifecycleWahl k={k} vorschlag={lifecycle} setze={setze} klein />)}
          {infoZeile('BEAN', <BeanWahl wert={k.bean} ergebnis={bean} klein onSetze={b => void setze({ bean: b })} />)}
          {/* Typ, Kategorie, Labels mehrfach (28.09., Kevin) — der erste Typ/die erste Kategorie bleibt `typ`/`kategorie`. */}
          {infoZeile('Typ', <WertelistenMehrfachWahl liste="typen" werte={listen.typen} wert={typenVon(k)} onWahl={l => void setze(typenFelder(l))} api={api} klein />)}
          {infoZeile('Kategorie', <WertelistenMehrfachWahl liste="kategorien" werte={listen.kategorien} wert={kategorienVon(k)} onWahl={l => void setze(kategorienFelder(l))} api={api} klein />)}
          {infoZeile('Labels', <WertelistenMehrfachWahl liste="labels" werte={listen.labels} wert={labelsVon(k)} onWahl={labels => void setze({ labels })} api={api} farbe={LEUCHT.agenten} klein />)}
          {infoZeile('Zuständig', <Wahl label="Zuständig" klein liste={besitzerListe} wert={k.besitzer} leer={`${nameVon(haeltBeziehung(k))} (Standard) ▾`} farbe={LEUCHT.beziehung}
            onWahl={besitzer => void setze({ besitzer })} onLeeren={k.besitzer ? () => void setze({ besitzer: undefined }) : undefined} leerenLabel="Standard (Sales-Verantwortung)" />)}
          {infoZeile('Kreis', <Wahl label="Kreis" klein liste={KREISE} wert={k.kreis} farbe={LEUCHT.beziehung} onWahl={kreis => void setze({ kreis })} onLeeren={() => void setze({ kreis: undefined })} />)}
        </div>
      </Klappe>
    </>
  );
}

/**
 * Alle E-Mail-Adressen (28.09., #11): Haupt-Adresse oben (sie ist `email` — Kanal-Ampel, Entwurf, Export),
 * jede mit Art, Kopieren und Mail-Link; „Haupt“ wählt eine andere, × entfernt eine, „+ Adresse“ hängt an.
 * Geschrieben wird die Liste (`emails`), der Server leitet `email` ab.
 */
function EmailListe({ k, setze, mail, ampelPunkt }: { k: Kontakt; setze: Setze; mail?: KanalStatus; ampelPunkt: ReactNode }) {
  const liste = emailsVon(k);
  const [neu, setNeu] = useState<string | null>(null);
  const [art, setArt] = useState<EmailArt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setNeu(null); setArt(null); setFehler(null); }, [k.id]);
  const schreiben = (l: EmailAdresse[]) => void setze(emailsFelder(k, l));
  const hinzufuegen = () => {
    const a = adresseNorm(neu ?? '');
    if (!a || /\s/.test(a) || !/^[^@]+@[^@]+\.[^@]+$/.test(a)) { setFehler('Keine gültige Adresse.'); return; }
    if (liste.some(x => adresseNorm(x.adresse) === a)) { setFehler('Diese Adresse steht schon da.'); return; }
    schreiben([...liste, { adresse: a, ...(art ? { art } : {}), ...(liste.length ? {} : { haupt: true }) }]);
    setNeu(null); setArt(null); setFehler(null);
  };
  return (
    <>
      {liste.map((a, i) => {
        const haupt = !!a.haupt || (liste.length === 1);
        const href = mail ? kanalLink(mail, { email: a.adresse }) : null;
        return (
          <DatenZeile key={a.adresse} zeichen="✉" titel={haupt ? 'Haupt-Adresse' : 'Weitere Adresse'}
            rechts={<>
              <Kopieren text={a.adresse} was="E-Mail" />
              {href && <a href={href} title={`Im Mail-Programm öffnen · ${mail?.grund ?? ''}`} style={{ ...leiseKnopf, textDecoration: 'none' }}>Mail ↗</a>}
              {!haupt && <button type="button" onClick={() => schreiben(liste.map((x, j) => ({ ...x, haupt: j === i })))} title="Zur Haupt-Adresse machen" className="fassbar" style={leiseKnopf}>Haupt</button>}
              <button type="button" onClick={() => schreiben(liste.filter((_, j) => j !== i))} aria-label={`${a.adresse} entfernen`} title="Adresse entfernen" className="fassbar" style={leiseKnopf}>×</button>
            </>}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {haupt ? ampelPunkt : <span style={{ width: 7 }} />}
              <span title={a.adresse} style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: haupt ? C.ink : C.inkDim }}>{a.adresse}</span>
              <Wahl label="Art der Adresse" klein liste={EMAIL_ART_WAHL} wert={a.art} leer={haupt && liste.length > 1 ? 'Haupt ▾' : 'Art ▾'}
                onWahl={x => schreiben(liste.map((y, j) => (j === i ? { ...y, art: x } : y)))} onLeeren={a.art ? () => schreiben(liste.map((y, j) => (j === i ? (({ art: _a, ...r }) => r)(y) : y))) : undefined} />
            </span>
          </DatenZeile>
        );
      })}
      {!liste.length && neu === null && <DatenZeile zeichen="✉" titel="E-Mail"><span style={klein}>keine E-Mail</span></DatenZeile>}
      {neu === null
        ? <button type="button" onClick={() => setNeu('')} className="fassbar" style={{ ...leiseKnopf, justifySelf: 'start', paddingLeft: 26 }}>+ Adresse</button>
        : (
          <div style={{ display: 'grid', gap: 6, paddingLeft: 26 }}>
            <input autoFocus type="email" value={neu} onChange={e => setNeu(e.target.value)} placeholder="E-Mail-Adresse" aria-label="Neue E-Mail-Adresse"
              onKeyDown={e => { if (e.key === 'Enter') hinzufuegen(); if (e.key === 'Escape') { e.stopPropagation(); setNeu(null); } }} style={eingabe} />
            <Fuss>
              <Wahl label="Art" klein liste={EMAIL_ART_WAHL} wert={art} onWahl={setArt} onLeeren={() => setArt(null)} />
              <Knopf aus={!neu.trim()} onClick={hinzufuegen}>Hinzufügen</Knopf>
              <Knopf leise onClick={() => { setNeu(null); setFehler(null); }}>Abbrechen</Knopf>
            </Fuss>
            {fehler && <Meldung art="kritisch" rolle="alert">{fehler}</Meldung>}
          </div>
        )}
    </>
  );
}

export function Fuss({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}
export const Hinweis = ({ children }: { children: ReactNode }) => <div style={{ ...klein, lineHeight: 1.45 }}>{children}</div>;

export function NotizAktion({ k, api, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [text, setText] = useState('');
  // Sprachnotiz (02.10., Paket B): der Mikrofon-Knopf diktiert in das Feld (Spracherkennung des Browsers, deutsch) — nichts wird aufgezeichnet oder gespeichert, nur der erkannte Text.
  const stimme = useStimme(satz => setText(t => `${t}${t && !/\s$/.test(t) ? ' ' : ''}${satz}`));
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    if (!text.trim() || laeuft) return;
    setLaeuft(true);
    // Ein Netzfehler darf „Notiz festhalten“ nicht dauerhaft sperren (Ablaufprüfung 28.09.).
    try {
      const r = await api.aktivitaet({ id: k.id, art: 'notiz', text: text.trim() });
      if (r.kontakt) onFertig('Notiz festgehalten.');
    } catch { /* Hinweis kommt aus api (fehlschlag) */ }
    finally { setLaeuft(false); }
  };
  return (
    <>
      <textarea autoFocus rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Notiz für das Team …" aria-label="Notiz"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void speichern(); if (e.key === 'Escape') { e.stopPropagation(); onAbbruch(); } }} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
      {stimme.teil && <div aria-live="polite" style={{ ...klein, fontStyle: 'italic' }}>{stimme.teil} …</div>}
      {stimme.fehler && <Meldung art="kritisch" rolle="alert">{stimme.fehler}</Meldung>}
      <Fuss>
        <Knopf aus={!text.trim() || laeuft} onClick={() => void speichern()}>Notiz festhalten</Knopf>
        {stimme.kannHoeren && <button type="button" onClick={() => (stimme.hoert ? stimme.hoerAuf() : stimme.hoerZu())} aria-pressed={stimme.hoert} aria-label={stimme.hoert ? 'Diktat beenden' : 'Notiz diktieren'} className="fassbar"
          style={{ minHeight: 44, minWidth: 44, padding: '0 14px', borderRadius: 11, border: `1px solid ${stimme.hoert ? LEUCHT.kritisch : 'rgba(255,255,255,.14)'}`, background: stimme.hoert ? `${LEUCHT.kritisch}22` : 'rgba(255,255,255,.04)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer' }}>{stimme.hoert ? '● Diktat beenden' : '🎙 Diktieren'}</button>}
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </Fuss>
      <Hinweis>Steht im Verlauf (Aktivitäten › Notizen) — für alle im Team.</Hinweis>
    </>
  );
}

export function EmailAktion({ k, api, mailOk, mailHref, onFertig }: { k: Kontakt; api: CrmApi; mailOk: boolean; mailHref: string | null; onFertig: (t: string) => void }) {
  return (
    <>
      <EntwurfTeil k={k} mailOk={mailOk} ohneTitel />
      <Fuss>
        {mailHref && <a href={mailHref} className="fassbar" style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink, textDecoration: 'none', padding: '8px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)' }}>Mail-Programm öffnen ↗</a>}
        {/* Knopf sperrt sich bis zur Antwort — ein Doppelklick ergibt nicht zwei Aktivitäten. */}
        {k.email && <Knopf leise onClick={async () => { try { const r = await api.aktivitaet({ id: k.id, art: 'mail' }); if (r.kontakt) onFertig('Mail festgehalten.'); } catch { /* Hinweis kommt aus api */ } }}>Mail ist raus — festhalten</Knopf>}
      </Fuss>
      <Hinweis>{mailHref ? 'MAKE OS verschickt nichts — die Mail geht aus deinem eigenen Programm.' : 'Mail ist für diese Person nicht freigegeben (Ampel) oder es fehlt die Adresse — den Entwurf nur im persönlichen Gespräch nutzen.'}</Hinweis>
    </>
  );
}

export function AnrufAktion({ k, api, heute, telHref, anlassNoetig, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; heute: string; telHref: string | null; /** Gelbe Telefon-Ampel (U2 #58): Anlass Pflicht. */ anlassNoetig: boolean; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [text, setText] = useState('');
  const [anlass, setAnlass] = useState('');
  /** Ereigniszeit (U2 #46): ein nachgetragener Anruf trägt seinen Tag — leer = heute. */
  const [wann, setWann] = useState('');
  const [schritt, setSchritt] = useState('');
  const [am, setAm] = useState(plusTage(heute, 2));
  const [laeuft, setLaeuft] = useState(false);
  const liste = ANRUF_ERGEBNISSE.map(e => ({ id: e, label: ERGEBNIS_KURZ[e] }));
  const speichern = async () => {
    if (!ergebnis || laeuft || (anlassNoetig && !anlass.trim())) return;
    setLaeuft(true);
    const r = await api.aktivitaet({ id: k.id, art: 'anruf', ergebnis, ...(text.trim() ? { text: text.trim() } : {}), ...(anlass.trim() ? { anlass: anlass.trim() } : {}), ...(wann && wann < heute ? { wann } : {}), ...(schritt.trim() && am ? { naechster: { text: schritt.trim(), datum: am } } : {}) });
    setLaeuft(false);
    if (r.kontakt) onFertig(r.hinweis ? `Anruf festgehalten — ${r.hinweis}` : 'Anruf festgehalten.');
  };
  return (
    <>
      {telHref ? <a href={telHref} className="fassbar" style={{ justifySelf: 'start', fontSize: TYP.bedien, fontWeight: 700, color: C.ink, textDecoration: 'none', padding: '8px 13px', borderRadius: 11, border: `1px solid ${LEUCHT.gut}55`, background: `${LEUCHT.gut}14` }}>☏ Anrufen</a>
        : <Hinweis>Kein freigegebenes Telefon — Kaltanruf nur mit Anlass (Ampel).</Hinweis>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ergebnis</span><Wahl label="Ergebnis" klein liste={liste} wert={ergebnis} onWahl={setErgebnis} /></div>
      <input value={anlass} onChange={e => setAnlass(e.target.value)} placeholder={anlassNoetig ? 'Anlass aus der Beziehung (Pflicht — gelbe Ampel)' : 'Anlass (optional)'} aria-label="Anlass des Anrufs" style={eingabe} />
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Kurz: worum ging es?" aria-label="Notiz zum Anruf" style={eingabe} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wann</span><input type="date" value={wann} max={heute} onChange={e => setWann(e.target.value)} aria-label="Wann war der Anruf (leer = heute)" style={{ ...eingabe, width: 150, flex: '0 0 auto' }} /></div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={schritt} onChange={e => setSchritt(e.target.value)} placeholder="Nächster Schritt (optional)" aria-label="Nächster Schritt" style={{ ...eingabe, flex: 1, minWidth: 0 }} />
        <input type="date" value={am} min={heute} onChange={e => setAm(e.target.value)} aria-label="Datum des nächsten Schritts" style={{ ...eingabe, width: 136, flex: '0 0 auto' }} />
      </div>
      <Fuss><Knopf aus={!ergebnis || laeuft || (anlassNoetig && !anlass.trim())} onClick={() => void speichern()}>Anruf festhalten</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
    </>
  );
}

/**
 * „Aufgabe anlegen“ am Kontakt (29.09., #99 — Follow-up = Aufgabe): legt eine echte AUFGABE mit Bezug auf die Person
 * (und ihre Firma) an — bei aktivem Mandat im Mandanten-Space, sonst in KD Ventures. Sie steht in Aufgaben, in der Glocke,
 * rechts in „Aufgaben“ und in Follow-up › Fällig. Vorher wurde es ein Follow-up, das in den Aufgaben fehlte.
 */
export function AufgabeAktion({ k, api, heute, onFertig, onAbbruch }: { k: Kontakt; api: CrmApi; heute: string; onFertig: (t: string) => void; onAbbruch: () => void }) {
  const { state, dispatch } = useTasks();
  const [text, setText] = useState('');
  const [faellig, setFaellig] = useState(plusTage(heute, 2));
  const [art, setArt] = useState<FollowUpArt>('anruf');
  const [fehler, setFehler] = useState<string | null>(null);
  const mandat = (api.crm?.stand.mandate ?? []).find(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id) && m.firmaId);
  const anlegen = async () => {
    if (!text.trim() || !faellig) return;
    if (faellig < heute) { setFehler('Das Datum liegt in der Vergangenheit.'); return; }
    setFehler(null);
    const artLabel = FOLLOWUP_ARTEN.find(a => a.id === art)?.label;
    const firmaId = k.firmaId ?? mandat?.firmaId;
    aufgabeAnlegen(dispatch, state, { spaceId: mandat?.firmaId ? mandantSpaceId(mandat.firmaId) : 'kdv' }, {
      title: text.trim().slice(0, 300), dueDate: faellig, ...(api.ich ? { assignee: api.ich as Owner } : {}),
      bezug: { kontaktId: k.id, ...(firmaId ? { firmaId } : {}) }, ...(artLabel && art !== 'sonstig' ? { description: `Art: ${artLabel}` } : {}),
    });
    onFertig(`Aufgabe „${text.trim().slice(0, 60)}“ am ${faellig} steht — in Aufgaben und hier rechts.`);
  };
  return (
    <>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Was ist zu tun?" aria-label="Aufgabe" onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} style={eingabe} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={faellig} min={heute} onChange={e => setFaellig(e.target.value)} aria-label="Fällig am" style={{ ...eingabe, width: 150 }} />
        <Wahl label="Art" klein liste={FOLLOWUP_ARTEN} wert={art} onWahl={setArt} />
      </div>
      {fehler && <Meldung art="kritisch" rolle="alert">{fehler}</Meldung>}
      <Fuss><Knopf aus={!text.trim()} onClick={anlegen}>Aufgabe anlegen</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></Fuss>
      <Hinweis>Wird eine Aufgabe mit Bezug auf die Person — in Aufgaben, in Follow-up › Fällig und hier rechts.</Hinweis>
    </>
  );
}

/** „+ Meeting“ (K3): derselbe echte Termin wie im Reiter Aktivitäten (MeetingNeu, kontakt/aktivitaeten-teile.tsx). */
export function MeetingAktion(p: { k: Kontakt; api: CrmApi; heute: string; onFertig: (t: string) => void; onAbbruch: () => void }) {
  return <MeetingNeu {...p} />;
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
  const akteAufgaben = useAkteAufgaben({ kontaktId: k.id });
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
            {/* Nie abschneiden: Vorschläge nach dem Suchtext gefiltert statt die ersten 400. */}
            <datalist id="kontakt-firmen">{(firmaNeu.trim() ? firmen.filter(f => suchPasst([f.name, f.domain], firmaNeu)) : firmen).map(f => <option key={f.id} value={f.name} />)}</datalist>
            <Fuss>
              <Knopf aus={!firmaNeu.trim()} onClick={() => void firmaVerknuepfen(api, k, firmaNeu, setze).then(() => setFirmaNeu(null))}>{firmen.some(f => f.name.toLowerCase() === firmaNeu.trim().toLowerCase()) ? 'Verknüpfen' : firmaNeu.trim() ? 'Anlegen und verknüpfen' : 'Verknüpfen'}</Knopf>
              <Knopf leise onClick={() => setFirmaNeu(null)}>Abbrechen</Knopf>
            </Fuss>
          </div>
        ) : <div style={klein}>{k.firma ? `„${k.firma}“ aus dem Import — noch keine Firma verknüpft.` : 'Keine Firma verknüpft.'}</div>}
        {/* Stationen (28.09.): alle Firmen der Person mit Rolle und Historie — Jobwechsel beendet die alte Station. */}
        {stationenVon(k).length > 0 && firmaNeu === null && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ ...klein, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 2 }}>Stationen</div>
            <StationenTeil k={k} api={api} heute={heute} setze={setze} zuFirma={zuFirma} />
          </div>
        )}
      </Klappe>

      <Klappe id="r-deals" i={2} klein titel={`Deals${deals.length ? ` · ${offeneDeals ? `${offeneDeals} offen` : deals.length}` : ''}`} zu={klappen.istZu('r-deals')} umschalten={klappen.umschalten}
        rechts={!dealNeu ? <span style={{ display: 'inline-flex', gap: 10 }}><Link href={angebotLink({ kontaktId: k.id, firmaId: k.firmaId })} style={{ ...leiseKnopf, textDecoration: 'none' }}>Angebot erstellen</Link>{plus('Hinzufügen', () => setDealNeu(true))}</span> : undefined}>
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

      {/* Termine (30.09., K3): über den Bezug am Termin (Kontakt oder Gast), Klick öffnet den Kalender; vergangene → „Nachbereiten“. */}
      <Klappe id="r-termine" i={5} klein titel="Termine" zu={klappen.istZu('r-termine')} umschalten={klappen.umschalten}>
        <TermineAkte frage={{ kontakte: [k.id] }} kontaktId={k.id} heute={heute} />
      </Klappe>

      {/* Aufgaben (28.09. abends): mit der Person verknüpfte Aufgaben der Aufgaben-Seite; bei aktivem Mandat im Mandanten-Space. */}
      <Klappe id="r-aufgaben" i={5} klein titel={`Aufgaben${akteAufgaben.length ? ` · ${akteAufgaben.length}` : ''}`} zu={klappen.istZu('r-aufgaben')} umschalten={klappen.umschalten}>
        <AufgabenAkte kontaktId={k.id} mandantFirmaId={aktiveMandate.find(m => m.firmaId)?.firmaId} />
      </Klappe>

      {/* ZOE-Vorschläge (28.09., C7): was ZOE zu dieser Person vorbereitet hat — freigeben/ablehnen hier; ohne Vorschläge keine Karte. */}
      <ZoeVorschlaege art="kontakt" id={k.id} onUebernommen={() => void api.laden(true)} />
    </>
  );
}
