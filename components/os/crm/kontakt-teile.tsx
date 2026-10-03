'use client';

// ─── Markttraktion · Bausteine einer Person ─────────────────────────────────
// Die Karteikarte (rechts in Kontakte) und „Kontakt öffnen“ (Vollansicht, 25.09.)
// zeigen dieselbe Person — mit denselben Bausteinen, damit beide gleich
// rechnen und gleich speichern: Hinweise (Werbesperre, Art. 14), nächster
// Schritt, Beziehung, Deals & Mandate, Entwurf, Verlauf, Recht und die Matrix
// aller Stammdaten (Felder aus lib/crm/akte.ts).

import { kennengelerntZeilen } from '@/lib/crm/netzwerken-recht';
import { useNachfrage } from './Nachfrage';
import { localDay } from '@/lib/zeit';
import { DealAnlegen } from './DealAnlegen';
import { useEffect, useState, type ReactNode, type KeyboardEvent as TastenEreignis } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Punkt, feld, LEUCHT } from '../schlank';
import { WEG } from '@/lib/wege';
import { anzeigename, STUFE_LABEL, STUFEN, KREIS_TAKT, HERKUNFT, RECHTSGRUNDLAGEN, type Kontakt, type Kreis, type Lebensphase, type Einwilligung, type EinwilligungKanal, type Grundlage, type Stufe, type Herkunft, type Rechtsgrundlage, type AktivitaetArt, ROLLEN as KONTAKT_ROLLEN, ROLLE_LABEL, rollenVon, type Rolle } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';
import { art14 } from '@/lib/crm/recht';
import { nachweisLuecken } from '@/lib/crm/einwilligung';
import { PERSON_FELDER, FIRMA_FELDER, FIRMA_FELDER_IMPORT, EINORDNUNG_FELDER, HERKUNFT_FELDER, gefuellt, vollstaendigkeit, type MatrixFeld } from '@/lib/crm/akte';
import { haeltBeziehung, TEAM, nameVon } from '@/lib/crm/team';
import { netzStufe, profilAdresse, suchLink } from '@/lib/crm/netzwerk';
import { markttraktion, mandateLink } from '@/lib/crm/adresse';
import Link from 'next/link';
import { type CrmApi, datum, euro } from './daten';
import { useTerminZeiten } from '../kalender/TermineAkte';
import { NotizFormular, Verlauf, Feldzeile, Pillen, Feld, festhalten, hatMailEinwilligung } from './teile';
import { Wahl, WahlMehrfach } from './Wahl';
import { anredeVorschlag, kontaktRollenVorschlag } from '@/lib/crm/vorschlaege';
import { KREIS_WORT } from '@/lib/crm/wertelisten';
import { ZustaendigWahl, Uebergeben, Person } from './team';
import { neueFirma, ROLLEN } from './Firmen';
import { FirmaSuchFeld } from './FirmenDatalist';
import { bestehendeFirma } from '@/lib/crm/firmen';
import { wertelistenVollstaendig } from '@/lib/crm/wertelisten';
import { WertelistenWahl, WertelistenMehrfachWahl } from './WertelistenWahl';
import { typenVon, kategorienVon, labelsVon, typenFelder, kategorienFelder } from '@/lib/crm/mehrfach';
import { stationenVon, hauptStation, type KontaktFelder } from '@/lib/crm/stationen';
import { useFirmaWechselFrage, type FirmaWechselFrageFn } from './kontakt/FirmaWechselFrage';
import { phaseVon, PHASE_LABEL, type Phase } from '@/lib/crm/phase';
import type { LifecyclePhase } from '@/lib/crm/lifecycle';
import { geburtstagSaeubern, geburtstagText, naechsterGeburtstag } from '@/lib/kalender/geburtstag';

export const PHASEN: { id: Lebensphase; label: string }[] = [
  { id: 'kontakt', label: 'Kontakt' }, { id: 'interessent', label: 'Interessent' }, { id: 'kunde', label: 'Kunde' }, { id: 'ex_kunde', label: 'Ex-Kunde' }, { id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' },
];
export const KREISE: { id: Kreis; label: string; hinweis: string }[] = (['A', 'B', 'C', 'D'] as Kreis[]).map(k => ({ id: k, label: `${k} · ${KREIS_WORT[k]}`, hinweis: `alle ${KREIS_TAKT[k]} Tage` }));
const ANREDEN: { id: 'Sie' | 'Du'; label: string }[] = [{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }];
const ANSPRACHE = STUFEN.map(s => ({ id: s, label: STUFE_LABEL[s] }));
const KONTAKT_ROLLEN_WAHL = KONTAKT_ROLLEN.map(r => ({ id: r, label: ROLLE_LABEL[r] }));
const VON_HAND: { id: 'partner' | 'multiplikator'; label: string }[] = [{ id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' }];
const PRIOS: { id: Exclude<Kontakt['prio'], ''>; label: string }[] = [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }];
const EIGNUNGEN: { id: Exclude<Kontakt['eignung'], ''>; label: string }[] = [{ id: 'ja', label: 'ja' }, { id: 'vielleicht', label: 'vielleicht' }, { id: 'nein', label: 'nein' }];
const EW_KANAL: { id: EinwilligungKanal; label: string }[] = [{ id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'social', label: 'LinkedIn/Social' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'einladung', label: 'Einladungen' }];
const GRUNDLAGEN: { id: Grundlage; label: string }[] = [{ id: 'einwilligung', label: 'Einwilligung' }, { id: 'anfrage', label: 'Anfrage' }, { id: 'intro_akzeptiert', label: 'Intro akzeptiert' }, { id: 'vertrag', label: 'Vertrag' }];
const RECHTSGRUNDLAGEN_WAHL = RECHTSGRUNDLAGEN.map(r => ({ id: r.id, label: r.label, hinweis: r.norm }));
const HERKUNFT_WAHL = HERKUNFT.map(h => ({ id: h.id, label: h.label, ...(h.fremd ? { hinweis: 'Art. 14' } : {}) }));
export const phaseFarbe = (p?: string) => (p === 'kunde' ? LEUCHT.gut : p === 'partner' || p === 'multiplikator' ? LEUCHT.agenten : p === 'interessent' || p === 'opportunity' ? LEUCHT.business : p === 'ex_kunde' ? C.inkLeise : LEUCHT.puls);
/** Farbe je Lifecycle (28.09.): kalt → warm → Geld → Kunde → Nachbetreuung. */
export const lifecycleFarbe = (p?: LifecyclePhase | null): string => (p === 'kunde' ? LEUCHT.gut : p === 'follow_up' ? LEUCHT.agenten : p === 'angebot' ? LEUCHT.geld : p === 'opportunity' || p === 'sql' ? LEUCHT.business : p === 'mql' ? LEUCHT.puls : C.inkDim);
export const phaseLabel = (p?: string) => (p && p in PHASE_LABEL ? PHASE_LABEL[p as Phase] : undefined) ?? PHASEN.find(x => x.id === p)?.label ?? 'Kontakt';

/** Einen Kontakt ändern — die geänderten Felder (`kontaktTeil`), bei Firmenänderung mit Absicht (`firmaWechsel`). */
export type Setze = (teil: KontaktFelder) => Promise<unknown> | void;

/**
 * Firma an der Person verknüpfen — eine bestehende (Name, Groß-/Kleinschreibung egal) oder eine neue
 * anlegen (crm.firmen) und verknüpfen; leer = Verknüpfung lösen. Derselbe Weg in der Matrix und in
 * der Karte „Firma“ von „Kontakt öffnen“.
 * Stationen (Kevin 28.09.): Hatte die Person schon eine Firma, wird kurz nachgefragt (`frage`):
 * Jobwechsel · Zusätzliche Firma · Korrektur — die Absicht geht als `firmaWechsel` an den Server
 * (lib/crm/stationen.ts `firmaWechselAnwenden`). Abbrechen ändert nichts. Ohne bisherige Firma wie
 * vorher eine einfache Verknüpfung.
 */
export async function firmaVerknuepfen(api: CrmApi, k: Kontakt, name: string, setze: Setze, frage?: FirmaWechselFrageFn): Promise<void> {
  const n = name.trim();
  const firmen = api.crm?.stand.firmen ?? [];
  const jetzt = k.firmaId ? firmen.find(f => f.id === k.firmaId) : undefined;
  if (n === (jetzt?.name ?? k.firma ?? '')) return;
  const haupt = hauptStation(stationenVon(k));
  const vorher = jetzt?.name ?? k.firma;
  if (!n) {
    if (!haupt) return void setze({ firma: undefined, firmaId: undefined });
    const absicht = frage ? await frage({ von: vorher }) : 'korrektur';
    if (!absicht) return;
    return void setze({ firma: undefined, firmaId: undefined, firmaWechsel: absicht });
  }
  // Bestehende Firma (auch „Muster GmbH“ zu „Muster“, gleiche Kennung) verknüpfen statt neu anlegen (F1).
  const f = firmen.find(x => x.name.toLowerCase() === n.toLowerCase()) ?? bestehendeFirma(firmen, n) ?? neueFirma(n);
  if (!haupt) {
    if (!firmen.some(x => x.id === f.id)) await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>);
    return void setze({ firma: f.name, firmaId: f.id });
  }
  const absicht = frage ? await frage({ von: vorher, nach: f.name }) : 'korrektur';
  if (!absicht) return;
  if (!firmen.some(x => x.id === f.id)) await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>);
  void setze({ firma: f.name, firmaId: f.id, firmaWechsel: absicht });
}

/** Werbesperre und Art.-14-Frist — stehen über allem anderen. */
export function Hinweise({ k, heute, setze }: { k: Kontakt; heute: string; setze: Setze }) {
  const a14 = art14(k, heute);
  return (
    <>
      {k.eingeschraenkt && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.kritisch}18`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Verarbeitung eingeschränkt (Art. 18) seit {datum(k.eingeschraenkt.seit)} — {k.eingeschraenkt.grund}. Nur aufbewahren: kein Kanal, keine Liste, kein Agent, kein Bearbeiten. Aufheben unter Stammdaten › Datenschutz.</div>}
      {k.werbesperre && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.kritisch}18`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Werbesperre seit {datum(k.werbesperre.seit)} — {k.werbesperre.grund}. Kein Kanal, keine Liste, kein Agent.</div>}
      {a14 && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung}14`, fontSize: TYP.bedien, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung }}>Art. 14: Daten stammen nicht von der Person — seit {a14.tage} Tagen nicht informiert (Frist ein Monat).</span>
        <Knopf leise onClick={() => void setze({ art14InformiertAm: heute })}>Informiert</Knopf>
      </div>}
    </>
  );
}

export function NaechsterSchrittTeil({ k, heute, setze }: { k: Kontakt; heute: string; setze: Setze }) {
  return (
    <div>
      <Ueberschrift rechts={k.naechsterSchritt ? <button onClick={() => void setze({ naechsterSchritt: undefined })} style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer', fontSize: 12 }}>✓ erledigt</button> : undefined}>Nächster Schritt</Ueberschrift>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><Feld wert={k.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => void setze({ naechsterSchritt: text.trim() ? { text: text.trim(), datum: k.naechsterSchritt?.datum ?? heute } : undefined })} /></div>
        <Feld typ="date" wert={k.naechsterSchritt?.datum} breite={150} platzhalter="Datum" onFertig={d2 => k.naechsterSchritt && void setze({ naechsterSchritt: { ...k.naechsterSchritt, datum: d2 } })} />
      </div>
    </div>
  );
}

export function BeziehungTeil({ k, api, setze, ohneTitel }: { k: Kontakt; api: CrmApi; setze: Setze; /** In „Kontakt öffnen“ trägt der Abschnitt den Titel. */ ohneTitel?: boolean }) {
  // Phase abgeleitet (27.09.): aus Mandat, Deal, Lead — nicht getippt.
  // Chip + Menü + Vorschlag (27.09. abends): Kreis, Anrede, Ansprache, Rollen und „von Hand“ als Chips in
  // kompakten Zeilen — sichtbar ist nur, was gesetzt ist; Rollen und Anrede schlagen aus den Daten vor.
  const ph = phaseVon(k, api.crm?.stand);
  const firma = k.firmaId ? api.crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const chip = (text: string, farbe: string) => <span style={{ fontSize: 11.5, fontWeight: 600, color: farbe, border: `1px solid ${farbe}55`, borderRadius: 999, padding: '2px 8px' }}>{text}</span>;
  const paar = (label: string, inhalt: ReactNode) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>{label}</span>{inhalt}</span>;
  const vonHand = k.lebensphase === 'partner' || k.lebensphase === 'multiplikator' ? k.lebensphase : null;
  // Rolle entfernen, die nur über die alte Lebensphase kam → Lebensphase mit leeren, sonst käme sie über rollenVon zurück.
  const rollenSetzen = (rollen: Rolle[]) => void setze({ rollen, ...(vonHand && !rollen.includes(vonHand) ? { lebensphase: undefined } : {}) });
  return (
    <div>
      {!ohneTitel && <Ueberschrift>Beziehung</Ueberschrift>}
      <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap', alignItems: 'center', padding: '6px 0' }}>
        {paar('Kreis', <Wahl label="Kreis" liste={KREISE} wert={k.kreis} farbe={LEUCHT.beziehung} onWahl={kreis => void setze({ kreis })} onLeeren={() => void setze({ kreis: undefined })} />)}
        {paar('Anrede', <Wahl label="Anrede" liste={ANREDEN} wert={k.anrede} vorschlag={anredeVorschlag(k)} onWahl={anrede => void setze({ anrede })} onLeeren={() => void setze({ anrede: undefined })} />)}
        {paar('Ansprache', <Wahl label="Ansprache" liste={ANSPRACHE} wert={k.stufe} onWahl={(stufe: Stufe) => void setze({ stufe })} />)}
      </div>
      <Feldzeile label="Rollen"><WahlMehrfach label="Rolle" liste={KONTAKT_ROLLEN_WAHL} wert={rollenVon(k)} vorschlag={kontaktRollenVorschlag(k, firma)} farbe={LEUCHT.business} onWahl={rollenSetzen} /></Feldzeile>
      <Feldzeile label="Lebensphase">
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {chip(PHASE_LABEL[ph.phase], phaseFarbe(ph.phase))}<span style={{ fontSize: 12, color: C.inkLeise }}>{ph.grund}</span>
          <Wahl label="Phase von Hand" leer="von Hand ▾" klein liste={VON_HAND} wert={vonHand} farbe={LEUCHT.agenten}
            onWahl={p => void setze({ lebensphase: p as Lebensphase })} onLeeren={() => void setze({ lebensphase: undefined })} />
        </span>
      </Feldzeile>
      <Feldzeile label="Zuständig"><ZustaendigWahl wert={k.besitzer} welt="sales" onWahl={besitzer => void setze({ besitzer })} /></Feldzeile>
      <Feldzeile label="Geburtstag"><GeburtstagFeld k={k} setze={setze} /></Feldzeile>
      <div style={{ marginTop: 8 }}><Uebergeben api={api} art="kontakt" id={k.id} jetzt={haeltBeziehung(k)} /></div>
    </div>
  );
}

/**
 * Geburtstag (29.09., K2) — optional, mit Zweck (Datensparsamkeit): nur zum Gratulieren/Beziehungspflege. Erscheint im
 * Kalender „Geburtstage“ (Business), in der Glocke am Vortag (für die, die die Beziehung hält) und bei ZOE. Ist die
 * Person auch in der Familie, führt dort der Tag der Familie. „Gratulieren“ ist nur ein Vorschlag für den nächsten
 * Schritt — nichts wird automatisch gesetzt oder verschickt.
 */
function GeburtstagFeld({ k, setze }: { k: Kontakt; setze: Setze }) {
  const heute = localDay();
  const [fehler, setFehler] = useState(false);
  const n = k.geburtstag ? naechsterGeburtstag(k.geburtstag, heute) : null;
  const gratulieren = 'Zum Geburtstag gratulieren';
  const schonGeplant = k.naechsterSchritt?.text === gratulieren && k.naechsterSchritt.datum === n?.tag;
  return (
    <span style={{ display: 'grid', gap: 4 }}>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Feld wert={k.geburtstag} breite={150} platzhalter="TT.MM. oder TT.MM.JJJJ" onFertig={t => {
          const g = t.trim() ? geburtstagSaeubern(t, heute) : undefined;
          if (t.trim() && !g) { setFehler(true); return; }
          setFehler(false); void setze({ geburtstag: g });
        }} />
        {n && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{geburtstagText(k.geburtstag)}{n.inTagen === 0 ? ' · heute' : ` · in ${n.inTagen} Tagen`}{n.alter ? ` · wird ${n.alter}` : ''}</span>}
        {n && n.inTagen <= 14 && !schonGeplant && <Knopf leise onClick={() => void setze({ naechsterSchritt: { text: gratulieren, datum: n.tag } })}>Gratulieren vormerken</Knopf>}
      </span>
      {fehler && <span style={{ fontSize: 12, color: LEUCHT.kritisch }}>Kein gültiges Datum — z. B. „3.10.“ oder „3.10.1990“.</span>}
      {!k.geburtstag && <span style={{ fontSize: 11.5, color: C.inkLeise }}>Optional, nur zum Gratulieren — nicht erfassen, was ihr nicht braucht.</span>}
    </span>
  );
}

/**
 * LinkedIn an der Person (25.09.): Profil, Stand je Profil (Kevin, Malin) und
 * der nächste Schritt für das eigene Profil — dieselben Schritte wie in der
 * Vernetzen-Runde (/api/crm/netzwerk). Versendet wird nichts.
 */
export function LinkedInTeil({ k, api }: { k: Kontakt; api: CrmApi }) {
  const ich = api.ich ?? 'kevin';
  const heute = api.crm?.heute ?? localDay();
  const profil = profilAdresse(k.linkedin);
  const [url, setUrl] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setUrl(''); setFehler(null); }, [k.id]);
  const tun = async (body: Record<string, unknown>) => { setFehler(null); const r = await api.netzwerk({ id: k.id, ...body }); if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.'); };
  const { stufe } = netzStufe(k, ich, heute);
  const zeile = (p: string) => {
    const s = k.netzwerk?.[p];
    const text = !s ? 'nicht vernetzt' : s.status === 'vernetzt' ? `vernetzt seit ${datum(s.vernetztAm)}${s.geschriebenAm ? ` · geschrieben ${datum(s.geschriebenAm)}` : ' · noch nicht geschrieben'}` : s.status === 'angefragt' ? `angefragt ${datum(s.angefragtAm)}` : s.status === 'abgelehnt' ? 'abgelehnt' : 'Anfrage zurückgezogen';
    return <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: s?.status === 'vernetzt' ? C.ink : C.inkDim, padding: '3px 0' }}><Person id={p} groesse={18} /><span>{nameVon(p)}: {text}</span></div>;
  };
  const leise = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0, fontFamily: SCHRIFT.text } as const;
  return (
    <div>
      <Ueberschrift rechts={<Link href={markttraktion('kontakte', 'runde-vernetzen')} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12 }}>Vernetzen-Runde ›</Link>}>LinkedIn</Ueberschrift>
      {profil ? <a href={profil} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: C.inkDim, textDecoration: 'none', overflowWrap: 'anywhere' }}>{profil.replace('https://www.', '')} ↗</a>
        : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={suchLink(k)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: LEUCHT.business, textDecoration: 'none' }}>Auf LinkedIn suchen ↗</a>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Profiladresse einfügen" aria-label="LinkedIn-Profiladresse" onKeyDown={e => { if (e.key === 'Enter' && url.trim()) void tun({ aktion: 'profil', url }); }} style={{ ...feld, flex: 1, minWidth: 160, fontSize: TYP.bedien, padding: '7px 10px' }} />
          {url.trim() && <Knopf leise onClick={() => void tun({ aktion: 'profil', url })}>Speichern</Knopf>}
        </div>}
      <div style={{ marginTop: 6 }}>{TEAM.map(t => zeile(t.id))}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {stufe === 'anfragen' && <><button onClick={() => void tun({ aktion: 'angefragt' })} style={leise}>Meine Anfrage ist raus ✓</button><button onClick={() => void tun({ aktion: 'vernetzt' })} style={leise}>Bin schon vernetzt</button></>}
        {(stufe === 'warten' || stufe === 'zurueckziehen') && <><button onClick={() => void tun({ aktion: 'vernetzt' })} style={leise}>Wurde angenommen ✓</button><button onClick={() => void tun({ aktion: 'zurueckgezogen' })} style={leise}>Zurückgezogen</button></>}
        {stufe === 'schreiben' && <Link href={markttraktion('kontakte', 'runde-vernetzen')} style={{ ...leise, color: LEUCHT.gut, textDecoration: 'none' }}>Angenommen — in der Runde schreiben ›</Link>}
      </div>
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 4 }}>{fehler}</div>}
    </div>
  );
}

export function DealsTeil({ k, api }: { k: Kontakt; api: CrmApi }) {
  const crm = api.crm;
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const [anlegen, setAnlegen] = useState(false);
  const neuerDeal = () => setAnlegen(true);
  return (
    <div>
      <Ueberschrift rechts={<Knopf leise onClick={neuerDeal}>+ Deal</Knopf>}>Deals & Mandate</Ueberschrift>
      {anlegen && <div style={{ marginBottom: 10 }}><DealAnlegen api={api} kontaktId={k.id} onFertig={() => setAnlegen(false)} onAbbruch={() => setAnlegen(false)} /></div>}
      {chancen.map(c => <Link key={c.id} href={WEG.deal(c.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '5px 0', color: C.ink, textDecoration: 'none' }}><Punkt farbe={crm?.ampel[c.id]?.ampel === 'rot' ? LEUCHT.kritisch : crm?.ampel[c.id]?.ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} groesse={7} /> <b style={{ fontWeight: 600 }}>{c.titel}</b> <span style={{ color: C.inkLeise }}>· {crm?.stufen.find(s => s.id === c.stufe)?.label} · {c.wert.betrag ? euro(c.wert.betrag) + (c.wert.basis === 'monat' ? '/Monat' : '') : 'ohne Wert'} ›</span></Link>)}
      {mandate.map(m => <Link key={m.id} href={mandateLink('mandate', m.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '5px 0', color: C.ink, textDecoration: 'none' }}><Punkt farbe={LEUCHT.geld} groesse={7} /> <b style={{ fontWeight: 600 }}>{m.titel.slice(0, 70)}</b> <span style={{ color: C.inkLeise }}>· Mandat {m.status} ›</span></Link>)}
      {!chancen.length && !mandate.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch kein Deal.</div>}
    </div>
  );
}

export function EntwurfTeil({ k, mailOk, ohneTitel }: { k: Kontakt; mailOk: boolean; ohneTitel?: boolean }) {
  const [entwurf, setEntwurf] = useState<{ betreff: string; email: string; linkedin: string; hinweis: string } | 'laedt' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setEntwurf(null); setFehler(null); }, [k.id]);
  if (k.werbesperre) return null;
  const entwerfen = async () => {
    setEntwurf('laedt'); setFehler(null);
    const r = await fetch('/api/crm/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { setFehler(r.error); setEntwurf(null); return; }
    setEntwurf(r);
  };
  return (
    <div>
      {!ohneTitel && <Ueberschrift>Entwurf</Ueberschrift>}
      {!entwurf && <Knopf leise onClick={entwerfen}>ZOE entwerfen lassen</Knopf>}
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 6 }}>{fehler}</div>}
      {entwurf === 'laedt' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>ZOE schreibt …</span>}
      {entwurf && entwurf !== 'laedt' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>{entwurf.betreff}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55 }}>{entwurf.email}</pre>
          {entwurf.linkedin && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 8 }}>{entwurf.linkedin}</pre>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mailOk && <Knopf onClick={() => fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: k.email ?? '', subject: entwurf.betreff, body: entwurf.email }) })}>In Mail öffnen</Knopf>}
            <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(entwurf.linkedin || entwurf.email); } catch { /* egal */ } }}>Text kopieren</Knopf>
            <Knopf leise onClick={() => setEntwurf(null)}>Verwerfen</Knopf>
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise }}>{mailOk ? entwurf.hinweis : 'Mail ist für diese Person nicht freigegeben (Ampel) — den Text nur für ein persönliches Gespräch oder eine Vernetzungsanfrage ohne Werbung nutzen.'}</div>
        </div>
      )}
    </div>
  );
}

/** Verlauf mit Gesprächsnotiz, schnellen Einträgen und Filter nach Art. */
export function VerlaufTeil({ k, api, name, heute, max = 60 }: { k: Kontakt; api: CrmApi; name: (p: string) => string; heute: string; max?: number }) {
  const [notiz, setNotiz] = useState(false);
  const [artFilter, setArtFilter] = useState<'alle' | AktivitaetArt>('alle');
  useEffect(() => { setNotiz(false); setArtFilter('alle'); }, [k.id]);
  const verlauf = (k.aktivitaeten ?? []).filter(a => artFilter === 'alle' || a.art === artFilter);
  const arten = Array.from(new Set((k.aktivitaeten ?? []).map(a => a.art)));
  const log = (art: string) => api.aktivitaet({ id: k.id, art });
  const terminZeiten = useTerminZeiten(k.id); // K6a: Meetings mit Termin an der Zeit ihres Termins
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {!notiz && <Knopf onClick={() => setNotiz(true)}>+ Gesprächsnotiz</Knopf>}
        {[['anruf', 'Angerufen'], ['mail', 'Mail geschickt'], ['linkedin', 'LinkedIn'], ['antwort', 'Antwort erhalten'], ['termin', 'Termin']].map(([a, l]) => <Knopf key={a} leise onClick={() => void log(a)}>{l}</Knopf>)}
      </div>
      {notiz && <div style={{ marginBottom: 10 }}><NotizFormular heute={heute} anrede={k.anrede} einwilligung={!hatMailEinwilligung(k)} onAbbruch={() => setNotiz(false)} onFertig={x => { void festhalten(api, { id: k.id, art: 'gespraech', notiz: x.notiz, naechster: x.naechster }, x.einwilligung, heute); setNotiz(false); }} /></div>}
      {arten.length > 1 && <div style={{ marginBottom: 8 }}><Pillen liste={[{ id: 'alle', label: 'Alle' }, ...arten.map(a => ({ id: a, label: a }))] as { id: 'alle' | AktivitaetArt; label: string }[]} aktiv={artFilter} onWahl={setArtFilter} /></div>}
      <Verlauf liste={verlauf} name={name} heute={heute} max={max} termine={terminZeiten} />
      {verlauf.length > max && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Die jüngsten {max} von {verlauf.length} Einträgen.</div>}
    </div>
  );
}

/** Eine Einwilligung aufnehmen: Kanal, Grundlage, Wortlaut und Beleg sind Pflicht (U2 #55) — Zeitpunkt und Person stempelt der Server. */
interface EwEingabe { kanal: EinwilligungKanal; grundlage: Grundlage; wortlaut: string; version: string; beleg: string; am: string }
const EW_LEER = (heute: string): EwEingabe => ({ kanal: 'mail', grundlage: 'einwilligung', wortlaut: '', version: '', beleg: '', am: heute });
const ewOk = (e: EwEingabe, heute: string) => (e.wortlaut.trim().length >= 3 || !!e.version.trim()) && e.beleg.trim().length >= 2 && !!e.am && e.am <= heute;
const ewAus = (e: EwEingabe): Einwilligung => ({
  kanal: e.kanal, grundlage: e.grundlage, erteiltAm: e.am, nachweis: (e.wortlaut.trim() || e.version.trim()).slice(0, 400),
  ...(e.wortlaut.trim() ? { wortlaut: e.wortlaut.trim() } : {}), ...(e.version.trim() ? { wortlautVersion: e.version.trim() } : {}), belegRef: e.beleg.trim(),
});
const zeitKurz = (iso?: string) => (iso ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');

function EwFormular({ e, setE, heute, knopf, onFertig, onAbbruch, nurEinwilligung }: { e: EwEingabe; setE: (e: EwEingabe) => void; heute: string; knopf: string; onFertig: () => void; onAbbruch: () => void; nurEinwilligung?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Kanal</span><Wahl label="Kanal" liste={EW_KANAL} wert={e.kanal} onWahl={kanal => setE({ ...e, kanal })} /></span>
        {!nurEinwilligung && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Grundlage</span><Wahl label="Grundlage" liste={GRUNDLAGEN} wert={e.grundlage} onWahl={grundlage => setE({ ...e, grundlage })} /></span>}
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>erteilt am</span><input type="date" value={e.am} max={heute} onChange={x => setE({ ...e, am: x.target.value })} aria-label="Erteilt am" style={{ ...feld, width: 150, fontSize: TYP.bedien }} /></span>
      </div>
      <textarea value={e.wortlaut} onChange={x => setE({ ...e, wortlaut: x.target.value })} rows={2} placeholder="Wortlaut (Pflicht): Frage und Antwort bzw. Formulartext — „Darf ich Ihnen … schicken? — Ja“" aria-label="Wortlaut der Einwilligung" style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={e.beleg} onChange={x => setE({ ...e, beleg: x.target.value })} placeholder="Beleg (Pflicht): Dateiablage d-…, Formular, Mail vom …, Gespräch vom …" aria-label="Beleg der Einwilligung" style={{ ...feld, flex: '2 1 240px', fontSize: TYP.bedien }} />
        <input value={e.version} onChange={x => setE({ ...e, version: x.target.value })} placeholder="Fassung des Textes (optional)" aria-label="Fassung des Wortlauts" style={{ ...feld, flex: '1 1 160px', fontSize: TYP.bedien }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf aus={!ewOk(e, heute)} onClick={onFertig}>{knopf}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise }}>Zeitpunkt und wer erfasst hat, stempelt MAKE OS. Eine Visitenkarte ist keine Einwilligung. Newsletter nur per Double-Opt-in. Hinweis, keine Rechtsberatung.</div>
    </div>
  );
}

/** POST an /api/crm/datenschutz (Einschränkung, Frist) — danach neu laden. */
async function datenschutzAktion(api: CrmApi, body: Record<string, unknown>): Promise<boolean> {
  const r = await fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
  // Erst neu laden, dann die Meldung setzen (Ablaufprüfung K1) — sie bleibt als Hinweis stehen, das Laden löscht sie nicht.
  await api.laden(true);
  if (!r.ok) api.setFehler(r.fehler ?? 'Nicht gespeichert.');
  return !!r.ok;
}

/**
 * Stammdaten › Datenschutz (U2, 28.09.): Prüfung der Stammdaten, Rechtsgrundlage, Herkunft (Art. 14), Einwilligungen
 * mit vollem Nachweis, Hinweis bei Erhebung (Bestandskunde), Einschränkung (Art. 18), Werbewiderspruch (Art. 21),
 * Löschfrist, Auskunft und Löschung. Hinweis, keine Rechtsberatung.
 */
export function RechtTeil({ k, api, heute, setze }: { k: Kontakt; api: CrmApi; heute: string; setze: Setze }) {
  const { frage, dialog: nachfrage } = useNachfrage();
  const [ew, setEw] = useState<EwEingabe | null>(null);
  // Werbesperre aufheben (K2 #64): nur zusammen mit einer neuen Einwilligung samt Nachweis — ein Schritt, der Server prüft es.
  const [auf, setAuf] = useState<EwEingabe | null>(null);
  const [hinweisAm, setHinweisAm] = useState(heute);
  useEffect(() => { setEw(null); setAuf(null); setHinweisAm(heute); }, [k.id, heute]);
  const gesperrt = !!k.eingeschraenkt;
  const alt = k.geprueftAm && k.geprueftAm < plusMonate(heute, -12);
  // Netzwerken (03.10.): „kennengelernt für <Kunde> bei <Event>“ aus den Stammdaten des CRM.
  const kennengelernt = kennengelerntZeilen(k, api.crm?.stand.firmen ?? [], api.crm?.stand.events ?? []);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><Ueberschrift>Einschränkung (Art. 18)</Ueberschrift>
        {k.eingeschraenkt ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>Eingeschränkt seit {datum(k.eingeschraenkt.seit)} von {nameVon(k.eingeschraenkt.von)} — {k.eingeschraenkt.grund}{k.eingeschraenkt.antragId ? ` · Antrag ${k.eingeschraenkt.antragId}` : ''}. Gespeichert bleibt alles; verarbeitet, bearbeitet und angesprochen wird nichts.</div>
            <div><Knopf leise onClick={async () => { const g = await frage('Einschränkung aufheben — Grund', { hinweis: 'z. B. „Richtigkeit geprüft und bestätigt“ — steht im Verlauf.' }); if (g?.trim()) void datenschutzAktion(api, { aktion: 'einschraenkung-aufheben', id: k.id, grund: g.trim() }); }}>Aufheben (mit Grund)</Knopf></div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: C.inkLeise }}>Nicht eingeschränkt.</span>
            <Knopf leise onClick={async () => { const g = await frage('Verarbeitung einschränken — Grund', { hinweis: 'z. B. „Richtigkeit bestritten (Art. 18 Abs. 1 lit. a)“. Danach: nur aufbewahren, nichts bearbeiten.' }); if (g?.trim()) void datenschutzAktion(api, { aktion: 'einschraenken', id: k.id, grund: g.trim() }); }}>Verarbeitung einschränken</Knopf>
          </div>
        )}
      </div>
      <div><Ueberschrift>Stammdaten geprüft</Ueberschrift>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: alt || !k.geprueftAm ? LEUCHT.achtung : C.inkDim }}>{k.geprueftAm ? `zuletzt am ${datum(k.geprueftAm)}${k.geprueftVon ? ` von ${nameVon(k.geprueftVon)}` : ''}${alt ? ' — über 12 Monate her' : ''}` : 'noch nie geprüft'}</span>
          {!gesperrt && <Knopf leise onClick={() => void setze({ geprueftAm: heute })}>Stammdaten geprüft</Knopf>}
        </div>
      </div>
      <div><Ueberschrift>Grundlage</Ueberschrift>
        <Feldzeile label="Rechtsgrundlage (Art. 6)"><Wahl label="Rechtsgrundlage" liste={RECHTSGRUNDLAGEN_WAHL} wert={k.rechtsgrundlage} onWahl={(r: Rechtsgrundlage) => void setze({ rechtsgrundlage: r })} /></Feldzeile>
        {k.rechtsgrundlageNotiz && <Feldzeile label="Interessenabwägung"><span style={{ fontSize: 12.5, color: C.inkDim }}>{k.rechtsgrundlageNotiz} — dokumentiert (DATENSCHUTZ_NETZWERKEN.md): Kontaktpflege nach persönlicher Übergabe, keine Werbung ohne Einwilligung, Widerspruch jederzeit.</span></Feldzeile>}
        {!!kennengelernt.length && <Feldzeile label="Kennengelernt für"><div style={{ display: 'grid', gap: 2 }}>{kennengelernt.map(t => <span key={t} style={{ fontSize: 12.5, color: C.inkDim }}>{t.replace(/^kennengelernt für /, '')}</span>)}<span style={{ fontSize: 12, color: C.inkLeise }}>Bei einer Übergabe an den Kunden steht sie mit Empfänger im Protokoll des Events (Auskunft Art. 15, Mitteilung bei Löschung Art. 19).</span></div></Feldzeile>}
        {(k.rechtsgrundlageNotiz || k.datenschutzInformiertAm) && <Feldzeile label="Datenschutzhinweis (Art. 13)">
          {k.datenschutzInformiertAm
            ? <span style={{ fontSize: 12.5, color: C.inkDim }}>erteilt am {datum(k.datenschutzInformiertAm)}</span>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 12.5, color: LEUCHT.achtung }}>noch nicht erteilt — in der Danke-Mail oder beim ersten Kontakt geben</span>{!gesperrt && <Knopf leise onClick={() => void datenschutzAktion(api, { aktion: 'datenschutz-informiert', id: k.id })}>Heute persönlich erteilt</Knopf>}</div>}
        </Feldzeile>}
        <Feldzeile label="Herkunft (Art. 14)"><Wahl label="Herkunft" liste={HERKUNFT_WAHL} wert={k.herkunft} onWahl={(h: Herkunft) => void setze({ herkunft: h, ...(HERKUNFT.find(x => x.id === h)?.fremd ? { fremddaten: true } : { fremddaten: undefined }) })} /></Feldzeile>
        {k.fremddaten && <Feldzeile label="Informiert"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkDim }}>{k.art14InformiertAm ? `am ${datum(k.art14InformiertAm)}` : 'noch nicht'}</span>{!k.art14InformiertAm && <Knopf leise onClick={() => void setze({ art14InformiertAm: heute })}>Heute informiert</Knopf>}</div></Feldzeile>}
        <Feldzeile label="Hinweis bei Erhebung">
          {k.hinweisBeiErhebung
            ? <span style={{ fontSize: 12.5, color: C.inkDim }}>erteilt am {datum(k.hinweisBeiErhebung.am)}{k.hinweisBeiErhebung.von ? ` · vermerkt von ${nameVon(k.hinweisBeiErhebung.von)}` : ''} — Bestandskunden-Werbung per Mail möglich (§ 7 Abs. 3 UWG)</span>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={hinweisAm} max={heute} onChange={x => setHinweisAm(x.target.value)} aria-label="Hinweis erteilt am" style={{ ...feld, width: 150, fontSize: TYP.bedien }} />
                <Knopf leise aus={!hinweisAm || gesperrt} onClick={() => void setze({ hinweisBeiErhebung: { am: hinweisAm } })}>Hinweis vermerken</Knopf>
                <span style={{ fontSize: 12, color: C.inkLeise }}>Widerspruchsrecht bei Erhebung der Adresse genannt? Ohne Vermerk bleibt die Mail-Ampel für Bestandskunden gelb.</span>
              </div>}
        </Feldzeile>
      </div>
      <div>
        <Ueberschrift rechts={!ew && !gesperrt ? <Knopf leise onClick={() => setEw(EW_LEER(heute))}>+ Einwilligung</Knopf> : undefined}>Einwilligungen</Ueberschrift>
        {(k.einwilligungen ?? []).map((e, i) => {
          const fehlt = nachweisLuecken(e);
          return (
            <div key={i} style={{ display: 'grid', gap: 2, fontSize: TYP.bedien, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', color: e.widerrufenAm ? C.inkLeise : C.ink }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontWeight: 600 }}>{EW_KANAL.find(x => x.id === e.kanal)?.label}</b><span style={{ color: C.inkDim }}>{GRUNDLAGEN.find(x => x.id === e.grundlage)?.label ?? e.grundlage} · erteilt {datum(e.erteiltAm)}</span>
                {!e.widerrufenAm && (fehlt.length ? <span title={`Fehlt: ${fehlt.join(', ')}`} style={{ fontSize: 11.5, color: LEUCHT.achtung }}>Nachweis unvollständig</span> : <span style={{ fontSize: 11.5, color: LEUCHT.gut }}>Nachweis vollständig</span>)}
                {!e.widerrufenAm && !gesperrt && <button onClick={() => void setze({ einwilligungen: (k.einwilligungen ?? []).map((x, j) => (j === i ? { ...x, widerrufenAm: heute } : x)) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Widerruf</button>}
              </div>
              {(e.wortlaut || e.nachweis) && <div style={{ fontSize: 12.5, color: C.inkDim }}>„{(e.wortlaut ?? e.nachweis).slice(0, 240)}“{e.wortlautVersion ? ` (Fassung ${e.wortlautVersion})` : ''}</div>}
              <div style={{ fontSize: 12, color: C.inkLeise }}>
                {[e.belegRef ? `Beleg: ${e.belegRef}` : 'kein Beleg', e.zeitpunkt ? `erfasst ${zeitKurz(e.zeitpunkt)}${e.erfasstVon ? ` von ${nameVon(e.erfasstVon)}` : ''}` : 'Erfassung ohne Zeitpunkt', e.widerrufenAm ? `widerrufen ${datum(e.widerrufenAm)}${e.widerrufenVon ? ` (${nameVon(e.widerrufenVon)})` : ''}` : ''].filter(Boolean).join(' · ')}
              </div>
            </div>
          );
        })}
        {!(k.einwilligungen ?? []).length && !ew && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine. Einwilligung im Gespräch einholen und Wortlaut + Beleg festhalten.</div>}
        {ew && <EwFormular e={ew} setE={setEw} heute={heute} knopf="Festhalten" onAbbruch={() => setEw(null)} onFertig={() => { void setze({ einwilligungen: [...(k.einwilligungen ?? []), ewAus(ew)], ...(ew.grundlage === 'einwilligung' && !k.rechtsgrundlage ? { rechtsgrundlage: 'einwilligung' as Rechtsgrundlage } : {}) }); setEw(null); }} />}
      </div>
      <div>
        <Ueberschrift>Werbewiderspruch (Art. 21)</Ueberschrift>
        {!k.werbesperre
          ? <Knopf leise onClick={() => { if (window.confirm('Werbewiderspruch eintragen? Die Person wird aus allen Listen genommen — dauerhaft.')) void setze({ werbesperre: { seit: heute, grund: 'Widerspruch' }, wiedervorlage: undefined, naechsterSchritt: undefined }); }}>Werbesperre eintragen</Knopf>
          : !auf
            ? (!gesperrt && <Knopf leise onClick={() => setAuf({ ...EW_LEER(heute), grundlage: 'einwilligung' })}>Sperre aufheben (nur mit neuer Einwilligung)</Knopf>)
            : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: C.inkDim }}>Gesperrt seit {datum(k.werbesperre.seit)}. Aufheben nur, wenn die Person ausdrücklich wieder eingewilligt hat — Wortlaut und Beleg werden als Einwilligung festgehalten, der Schritt steht im Verlauf.</div>
                <EwFormular e={auf} setE={setAuf} heute={heute} nurEinwilligung knopf="Mit Nachweis aufheben" onAbbruch={() => setAuf(null)} onFertig={() => { void setze({ werbesperre: undefined, einwilligungen: [...(k.einwilligungen ?? []), ewAus(auf)] }); setAuf(null); }} />
              </div>
            )}
      </div>
      {k.loeschfristVerlaengert && <div><Ueberschrift>Löschfrist</Ueberschrift>
        <div style={{ fontSize: 12.5, color: C.inkDim }}>verlängert bis {datum(k.loeschfristVerlaengert.bis)} — {k.loeschfristVerlaengert.grund} ({nameVon(k.loeschfristVerlaengert.von)}, {datum(k.loeschfristVerlaengert.am)})</div>
      </div>}
      <div>
        <Ueberschrift>Betroffenenrechte</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => { window.location.href = `/api/crm/datenschutz?id=${k.id}`; }}>Auskunft (Art. 15) als Datei</Knopf>
          <Knopf leise aus={gesperrt} onClick={async () => {
            if (!window.confirm(`${anzeigename(k)} endgültig löschen (Art. 17)? Besser oft: Werbesperre — dann bleibt „nicht anschreiben“ erhalten.`)) return;
            const grund = await frage('Grund für das Löschprotokoll', { vorgabe: 'Löschverlangen Art. 17', hinweis: 'Ohne Personendaten — der Eintrag bleibt als Nachweis.' });
            if (grund === null) return;
            const r = await fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, grund }) }).then(x => x.json()).catch(() => null);
            if (!r?.ok) { api.setFehler(r?.fehler ?? 'Nicht gelöscht.'); return; }
            // W3 (28.09.): was jetzt zu tun ist — Deals ohne Person, Aufgaben, die den Namen noch nennen.
            const text = loeschErgebnis(r);
            await api.laden(true);
            if (text) api.setHinweis(text);
          }}>Löschen (Art. 17)</Knopf>
          {nachfrage}
        </div>
        {gesperrt && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Löschen erst nach dem Aufheben der Einschränkung — sie heißt „aufbewahren“.</div>}
      </div>
    </div>
  );
}

/**
 * Ergebnis des Löschens (Art. 17) als Hinweis zum Abarbeiten (W3, 28.09.): Deals, an denen nur diese Person hing,
 * und Aufgaben, die sie nur beim Namen nennen (nicht geändert). Nichts offen → null.
 */
function loeschErgebnis(r: { dealsOhnePerson?: { id: string; titel: string }[]; aufgabenPruefen?: string[]; vollstaendig?: boolean; hinweis?: string; warnung?: string; inApple?: number; uebergaben?: string[] }): string | null {
  const deals = r.dealsOhnePerson ?? [];
  const aufgaben = r.aufgabenPruefen ?? [];
  const teile = [
    // Paket D-C (#21): nicht alle Bestände bestätigt — das Löschprotokoll steht auf „unvollständig“, MAKE OS holt es nach.
    r.vollstaendig === false ? (r.hinweis ?? 'Nicht alle Bestände bestätigt — wird automatisch nachgeholt.') : '',
    r.warnung ?? '',
    deals.length ? `${deals.length === 1 ? '1 Deal hat' : `${deals.length} Deals haben`} jetzt keine Person mehr: ${deals.slice(0, 5).map(d => `„${d.titel}“`).join(', ')}${deals.length > 5 ? ' …' : ''} — unter Deals eine Person zuordnen oder den Deal schließen.` : '',
    // Art. 19 (03.10.): an Kunden übergeben — der Empfänger muss von der Löschung erfahren.
    ...(r.uebergaben ?? []),
    aufgaben.length ? `${aufgaben.length === 1 ? '1 Aufgabe nennt' : `${aufgaben.length} Aufgaben nennen`} den Namen noch (nicht geändert) — bitte unter Aufgaben prüfen.` : '',
    // K2 (29.09.): Kalender/Erinnerungen/Kontakte sind Spiegel aus Apple — dort löschen, sonst kommt es mit dem Abgleich zurück.
    r.inApple ? `${r.inApple === 1 ? '1 Eintrag in Apple oder Google (Kalender, Erinnerungen, Kontakte oder Gmail) nennt' : `${r.inApple} Einträge in Apple oder Google (Kalender, Erinnerungen, Kontakte oder Gmail) nennen`} die Person — bitte dort löschen (MAKE OS spiegelt nur).` : '',
  ].filter(Boolean);
  return teile.length ? `Gelöscht.\n${teile.join('\n')}` : null;
}

/** Tag plus/minus n Monate (Monatsende gekappt) — für „über 12 Monate her“. */
function plusMonate(tag: string, n: number): string {
  const [j, m, t] = tag.split('-').map(Number);
  const g = j * 12 + (m - 1) + n, jj = Math.floor(g / 12), mm = ((g % 12) + 12) % 12;
  const letzter = new Date(Date.UTC(jj, mm + 1, 0)).getUTCDate();
  return `${jj}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(t, letzter)).padStart(2, '0')}`;
}

/**
 * Eine Zeile der Matrix: Wert lesen, antippen zum Bearbeiten. Enter (bei
 * Fließtext Cmd/Strg+Enter) oder Verlassen speichert, Esc verwirft.
 * Profil und Webseite lassen sich öffnen (↗); Telefon und Mail nicht — die
 * laufen über die Kanal-Ampel (§ 7 UWG).
 */
/** Raster einer Matrix-Zeile — Textfelder, Auswahl und Firmenzuordnung stehen so bündig untereinander. */
function MatrixRahmen({ label, mittig, children }: { label: string; mittig?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 34%) minmax(0, 1fr)', gap: 12, alignItems: mittig ? 'center' : 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', minHeight: 34 }}>
      <span style={{ fontSize: 12.5, color: C.inkLeise }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function MatrixZeile({ label, wert, lang, link, onFertig }: { label: string; wert?: string; lang?: boolean; link?: boolean; onFertig: (t: string) => void }) {
  const [an, setAn] = useState(false);
  const [t, setT] = useState(wert ?? '');
  useEffect(() => { if (!an) setT(wert ?? ''); }, [wert, an]);
  const fertig = () => { setAn(false); if (t.trim() !== (wert ?? '').trim()) onFertig(t.trim()); };
  const abbruch = () => { setAn(false); setT(wert ?? ''); };
  const leer = !gefuellt(wert);
  const href = link && !leer ? (/^https?:\/\//i.test(wert!) ? wert! : `https://${wert}`) : undefined;
  const taste = (e: TastenEreignis) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); abbruch(); }
    else if (e.key === 'Enter' && (!lang || e.metaKey || e.ctrlKey)) { e.preventDefault(); fertig(); }
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '7px 10px' };
  return (
    <MatrixRahmen label={label} mittig={an}>
      {an ? (lang
        ? <textarea autoFocus rows={3} value={t} aria-label={label} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={taste} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
        : <input autoFocus value={t} aria-label={label} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={taste} style={eingabe} />)
        : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
            <button onClick={() => setAn(true)} title={leer ? `${label} ergänzen` : `${label} bearbeiten`}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'text', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: 1.5, color: leer ? C.inkLeise : C.ink, whiteSpace: lang ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere' }}>
              {leer ? '—' : wert}
            </button>
            {href && <a href={href} target="_blank" rel="noopener noreferrer" title={`${label} öffnen`} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12.5 }}>↗</a>}
          </div>
        )}
    </MatrixRahmen>
  );
}

function Gruppe({ titel, zahl, rechts, children }: { titel: string; zahl?: [number, number]; rechts?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Ueberschrift rechts={<>{rechts}{zahl && <span style={{ fontVariantNumeric: 'tabular-nums', color: zahl[0] === zahl[1] ? LEUCHT.gut : C.inkLeise }}>{zahl[0]}/{zahl[1]}</span>}</>}>{titel}</Ueberschrift>
      {children}
    </div>
  );
}

/** Die Gruppen der Matrix — „Kontakt öffnen“ verteilt sie auf Klapp-Abschnitte (Reiter Stammdaten, `t=daten`), die Karteikarte zeigt alle. */
export type MatrixTeil = 'einordnung' | 'person' | 'firma' | 'herkunft' | 'privat';
export const MATRIX_TEILE: MatrixTeil[] = ['einordnung', 'person', 'firma', 'herkunft', 'privat'];
export const MATRIX_TEIL_LABEL: Record<MatrixTeil, string> = { einordnung: 'Einordnung', person: 'Person', firma: 'Firma', herkunft: 'Herkunft der Daten', privat: 'Privat' };

type MatrixArgs = { k: Kontakt; api: CrmApi; setze: Setze; zuFirma: (id: string) => void };
type MatrixInnen = MatrixArgs & { frage: FirmaWechselFrageFn };

/**
 * Inhalt und Kopfzeile je Gruppe der Matrix — jedes Feld der Masterdatei
 * für diese Person: Einordnung (Typ und Kategorie zuerst — Malin 27.09.),
 * Person, Firma (Branchen aus der Werteliste), Herkunft der Daten, private
 * Notiz. Gehört die Person zu einer Firma, bearbeitet die Firmengruppe den
 * Firmeneintrag (für alle ihre Personen); sonst die Firmenfelder aus dem
 * Import. Typ, Kategorie und Branchen kommen aus den Wertelisten: Typ,
 * Kategorie und Labels als Mehrfach-Chips mit Menü, Suche und „+ neu …“
 * (WertelistenMehrfachWahl, 28.09.), Branchen als scrollbare Mehrfachwahl (WertelistenWahl);
 * „+ neu“ legt in beiden in der Werteliste an.
 */
function matrixTeile({ k, api, setze, zuFirma, frage }: MatrixInnen): { inhalt: Record<MatrixTeil, ReactNode>; zahl: Partial<Record<MatrixTeil, [number, number]>>; rechts: Partial<Record<MatrixTeil, ReactNode>> } {
  const crm = api.crm;
  const firmen = crm?.stand.firmen ?? [];
  const firma: Firma | undefined = k.firmaId ? firmen.find(f => f.id === k.firmaId) : undefined;
  const v = vollstaendigkeit(k, firma);
  const listen = wertelistenVollstaendig(crm?.stand.wertelisten);
  // Typ, Kategorie, Labels mehrfach (28.09.) — der erste Typ/die erste Kategorie bleibt `typ`/`kategorie`.
  const mehrfach = (label: string, liste: 'typen' | 'kategorien' | 'labels', wert: string[], setzen: (w: string[]) => void) => (
    <MatrixRahmen key={label} label={label} mittig><WertelistenMehrfachWahl liste={liste} werte={listen[liste]} wert={wert} onWahl={setzen} api={api} /></MatrixRahmen>
  );
  const branchenWahl = (aktiv: string[], setzen: (b: string[]) => void) => (
    <MatrixRahmen label="Branchen"><WertelistenWahl liste="branchen" mehrfach werte={listen.branchen} aktiv={aktiv} onWahl={setzen} api={api} /></MatrixRahmen>
  );
  const kf = (m: MatrixFeld<keyof Kontakt>) => <MatrixZeile key={m.feld} label={m.label} lang={m.lang} link={m.link} wert={String(k[m.feld] ?? '')} onFertig={t => void setze({ [m.feld]: (m.feld === 'email' ? t.toLowerCase() : t) || undefined } as Partial<Kontakt>)} />;
  const ff = (f: Firma, m: MatrixFeld<keyof Firma>) => <MatrixZeile key={m.feld} label={m.label} lang={m.lang} link={m.link} wert={String(f[m.feld] ?? '')} onFertig={t => void api.teil('firmen', f.id, { [m.feld]: t })} />;
  const firmaZuordnen = (n: string) => firmaVerknuepfen(api, k, n, setze, frage);
  const inhalt: Record<MatrixTeil, ReactNode> = {
    einordnung: <>
      {mehrfach('Typ', 'typen', typenVon(k), l => void setze(typenFelder(l)))}
      {mehrfach('Kategorie', 'kategorien', kategorienVon(k), l => void setze(kategorienFelder(l)))}
      {mehrfach('Labels', 'labels', labelsVon(k), labels => void setze({ labels }))}
      <MatrixRahmen label="Prio" mittig><Wahl label="Prio" klein liste={PRIOS} wert={k.prio || null} onWahl={prio => void setze({ prio })} onLeeren={() => void setze({ prio: '' })} /></MatrixRahmen>
      <MatrixRahmen label="Eignung" mittig><Wahl label="Eignung" klein liste={EIGNUNGEN} wert={k.eignung || null} onWahl={eignung => void setze({ eignung })} onLeeren={() => void setze({ eignung: '' })} /></MatrixRahmen>
      {EINORDNUNG_FELDER.filter(m => m.feld !== 'typ' && m.feld !== 'kategorie').map(kf)}
    </>,
    person: <>{PERSON_FELDER.map(kf)}</>,
    firma: <>
      <MatrixRahmen label="Firma" mittig>
        <div>
          <FirmaSuchFeld id="crm-firmen-matrix" key={`${k.id}-${firma?.id ?? ''}`} firmen={firmen} anfang={firma?.name ?? k.firma ?? ''} platzhalter="Firma zuordnen …"
            onFertig={name => void firmaZuordnen(name)} stil={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px' }} />
        </div>
      </MatrixRahmen>
      {firma && <MatrixRahmen label="Rolle"><span style={{ fontSize: TYP.bedien, color: ROLLEN.find(r => r.id === firma.rolle)?.farbe ?? C.inkDim }}>{ROLLEN.find(r => r.id === firma.rolle)?.label ?? firma.rolle}</span></MatrixRahmen>}
      {firma ? branchenWahl(firma.branchen ?? (firma.branche ? firma.branche.split(' · ').map(x => x.trim()).filter(Boolean) : []), b => void api.teil('firmen', firma.id, { branchen: b, branche: b.join(' · ') }))
        : branchenWahl(k.firmaBranche ? k.firmaBranche.split(' · ').map(x => x.trim()).filter(Boolean) : [], b => void setze({ firmaBranche: b.join(' · ') || undefined }))}
      {firma ? FIRMA_FELDER.filter(m => m.feld !== 'branche').map(m => ff(firma, m)) : FIRMA_FELDER_IMPORT.filter(m => m.feld !== 'firmaBranche').map(kf)}
      {firma && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Firmenfelder gelten für alle Personen dieser Firma.</div>}
    </>,
    herkunft: <>
      {HERKUNFT_FELDER.map(kf)}
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Importiert {datum(k.importiertAm)} · geändert {datum(k.geaendertAm)} · Kennung {k.id}</div>
    </>,
    privat: <MatrixRahmen label="Deine Notiz" mittig><Feld wert={k.privatNotiz} onFertig={privatNotiz => void setze({ privatNotiz: privatNotiz || undefined })} /></MatrixRahmen>,
  };
  return {
    inhalt,
    zahl: { einordnung: v.gruppen.einordnung, person: v.gruppen.person, firma: v.gruppen.firma },
    rechts: {
      firma: firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Firma öffnen ›</button> : undefined,
      privat: <span>nur für dich sichtbar · nie an Agenten</span>,
    },
  };
}

/** Eine Gruppe der Matrix ohne eigene Überschrift — für die Klapp-Abschnitte von „Kontakt öffnen“, die den Titel selbst tragen. */
export function MatrixTeilInhalt({ teil, ...args }: MatrixArgs & { teil: MatrixTeil }) {
  const { frage, dialog } = useFirmaWechselFrage();
  return <>{matrixTeile({ ...args, frage }).inhalt[teil]}{dialog}</>;
}

/** Zähler „gefüllt/gesamt“ einer Gruppe — für die Kopfzeile eines Klapp-Abschnitts. */
export function MatrixZahl({ teil, k, api }: { teil: MatrixTeil; k: Kontakt; api: CrmApi }) {
  const firma = k.firmaId ? api.crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const v = vollstaendigkeit(k, firma).gruppen;
  const z = teil === 'einordnung' ? v.einordnung : teil === 'person' ? v.person : teil === 'firma' ? v.firma : null;
  if (!z) return null;
  return <span style={{ fontVariantNumeric: 'tabular-nums', color: z[0] === z[1] ? LEUCHT.gut : C.inkLeise }}>{z[0]}/{z[1]}</span>;
}

/** Die ganze Matrix mit Gruppen-Überschriften (Karteikarte) — `teile` wählt Gruppen aus. */
export function Matrix({ teile = MATRIX_TEILE, ...args }: MatrixArgs & { teile?: MatrixTeil[] }) {
  const { frage, dialog } = useFirmaWechselFrage();
  const m = matrixTeile({ ...args, frage });
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {dialog}
      {teile.map(t => <Gruppe key={t} titel={MATRIX_TEIL_LABEL[t]} zahl={m.zahl[t]} rechts={m.rechts[t]}>{m.inhalt[t]}</Gruppe>)}
    </div>
  );
}
