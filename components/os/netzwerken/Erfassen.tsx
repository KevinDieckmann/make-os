'use client';

// ─── Netzwerken — Person erfassen (02.10.) ───────────────────────────────────
// Drei Schritte, am Handy mit dem Daumen: (1) Karte fotografieren + Felder + „Kennen wir schon?“, (2) nächster Schritt
// (Pflicht) + Info + Sprachnotiz + wer zuständig ist, (3) bestätigen. Gespeichert wird zuerst in die lokale Warteschlange
// (IndexedDB) und dann gesendet — ohne Netz bleibt alles liegen und geht später raus, nie doppelt (Kennung der Erfassung).
// Das automatische Auslesen der Karte (KI) ist vorbereitet, aber aus (lib/crm/netzwerken-karte.ts).

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRightLeft, BookUser, CalendarClock, Camera, Euro, ImagePlus, ListChecks, Mic, PenLine, Sparkles, Star, UserCheck, type LucideIcon } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';
import { zufallsUuid } from '@/lib/kennung';
import { anzeigename } from '@/lib/make-one/crm';
import { emailNormal, telefonNormal, linkedinNormal, webNormal, firmaZurKarte, firmaVorschlagAusDomain } from '@/lib/crm/visitenkarte';
import {
  SCHRITTE, INFO_MAX, MAX_BILDER, kenntWirSchon, kennenText, firmaVorschlaege, followupFrist, schrittLabel, terminArtLabel, NETZWERKEN_QUELLE, KEINE_EINWILLIGUNG,
  type KontaktFelder,
} from '@/lib/crm/netzwerken';
import { karteAuslesen, ausgelesenesUebernehmen } from '@/lib/crm/netzwerken-karte';
import type { NetzwerkSchritt } from '@/lib/crm/typen';
import { WEG } from '@/lib/wege';
import { Fenster } from '../Fenster';
import type { CrmApi } from '../crm/daten';
import { Gross, Wahl, Beschriftung, Feldzeile, Hinweis, Fortschritt, Aktionsleiste, Initialen, LinkChips, useGemerkt, type LinkChip, eingabe, kopfStil, tagText, ZIEL } from './bausteine';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';

/** Gleiche leere Listen bei jedem Render — sonst rechnen die `useMemo` bei jedem Tippen neu. */
const KEINE: Kontakt[] = [];
const KEINE_FIRMEN: Firma[] = [];
/** Lange Mail-Adressen brechen an sinnvollen Stellen um (nach @ . - _), nicht mitten im Wort (Praxis-Prüfung): unsichtbare Umbruchstellen nur in Wörtern mit „@“. */
export const weicheUmbrueche = (t: string): string => t.replace(/\S+@\S+/g, m => m.replace(/([@._-])/g, '$1\u200b'));
import { fotoVorbereiten, dateiAlsBase64, type Foto } from './bild';
import { Sprachnotiz, type Aufnahme } from './Sprachnotiz';
import { TerminWahl, type TerminEingabe } from './TerminWahl';
import { OhneTerminKnopf, linksAusAntwort } from './Ergebnis';
import type { EventWahl } from './EventModus';
import type { Person, useWarteschlange } from './useNetzwerken';
import { NUR_RAM_HINWEIS } from '@/lib/netzwerken/warteschlange';
import { istNetzwerkenEvent } from '@/lib/crm/marke';
import { handyKarteAusErfassung, handyKarteAusKontakt, handyTeilen, handyMeldung, HANDY_SPEICHER_KEY, type HandyErgebnis } from '@/lib/netzwerken/handy';

type Warte = ReturnType<typeof useWarteschlange>;
type Phase = 'karte' | 'schritt' | 'bestaetigen' | 'fertig';

interface Entwurf {
  id: string;
  fotos: Foto[];
  rueckseiteWeg: boolean;
  felder: Required<Pick<KontaktFelder, 'anrede'>> & Omit<KontaktFelder, 'anrede'>;
  vorhandenId?: string;
  neuErzwingen: boolean;
  firmaId?: string;
  firmaNeu: boolean;
  schritt: NetzwerkSchritt | null;
  info: string;
  /** „Wir haben persönlich gesprochen“ (Standard an, § 7 UWG): nur dann gibt es morgen einen Danke-Entwurf. */
  gesprochen: boolean;
  aufnahme: Aufnahme | null;
  zustaendig: string;
  termin: TerminEingabe;
  followupFaellig: string;
  vermittelnAn: string;
  /** Make.One: das kommende Event, für das die Person vorgemerkt wird. */
  makeoneEventId?: string;
  andereText: string;
  andereFaellig: string;
}

const neuerEntwurf = (zustaendig: string, heute: string): Entwurf => ({
  id: zufallsUuid(), fotos: [], rueckseiteWeg: false, felder: { anrede: 'Sie' }, neuErzwingen: false, firmaNeu: false, schritt: null, info: '', gesprochen: true, aufnahme: null, zustaendig,
  termin: { art: 'kennenlernen', dauer: 45, start: '' }, followupFaellig: followupFrist(heute), vermittelnAn: '', andereText: '', andereFaellig: '',
});

const leer = (v?: string) => !(v ?? '').trim();

export function Erfassen({ api, ich, personen, heute, wahl, warte, offline, onBericht }: { api: CrmApi; ich: string | null; personen: Person[]; heute: string; wahl: EventWahl | null; warte: Warte; offline: boolean; onBericht: () => void }) {
  const zustaendigStart = ich ?? personen[0]?.id ?? '';
  const [e, setE] = useState<Entwurf>(() => neuerEntwurf(zustaendigStart, heute));
  const [phase, setPhase] = useState<Phase>('karte');
  const [gross, setGross] = useState<Foto | null>(null);
  const [mehr, setMehr] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fotoFehler, setFotoFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [gesendetId, setGesendetId] = useState<string | null>(null);
  const kamera = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);
  const oben = useRef<HTMLDivElement>(null);
  const trefferRef = useRef<HTMLDivElement>(null);
  const nachnameRef = useRef<HTMLInputElement>(null);

  // Zuständig startet bei der eigenen Person — sobald sie bekannt ist (Kontext lädt nach).
  useEffect(() => { if (zustaendigStart && !e.zustaendig) setE(x => ({ ...x, zustaendig: zustaendigStart })); }, [zustaendigStart, e.zustaendig]);
  // Beim Phasenwechsel nach oben (am Handy sonst mitten in der Seite) — nicht beim ersten Zeigen: sonst ist der Event-Kopf sofort weggescrollt.
  const ersteAnzeige = useRef(true);
  useEffect(() => { if (ersteAnzeige.current) { ersteAnzeige.current = false; return; } oben.current?.scrollIntoView?.({ block: 'start' }); }, [phase]);

  const up = (p: Partial<Entwurf>) => setE(x => ({ ...x, ...p }));
  const feld = (p: Partial<KontaktFelder>) => setE(x => ({ ...x, felder: { ...x.felder, ...p } as Entwurf['felder'] }));
  const nameVon = (id: string) => personen.find(p => p.id === id)?.name ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : '—');
  const kontakte = api.kontakte ?? KEINE;
  const zustaendigPerson = personen.find(p => p.id === e.zustaendig);

  // ── Fotos ──
  const fotoDazu = async (datei: File | undefined) => {
    if (!datei) return;
    setFotoFehler(null);
    if (e.fotos.length >= MAX_BILDER) { setFotoFehler(`Höchstens ${MAX_BILDER} Fotos je Karte.`); return; }
    const r = await fotoVorbereiten(datei, zufallsUuid(), e.fotos.length + 1);
    if ('fehler' in r) { setFotoFehler(r.fehler); return; }
    setE(x => ({ ...x, fotos: [...x.fotos, r] }));
    // Vorbereitet, heute aus: die spätere Erkennung füllt nur leere Felder.
    const erkannt = await karteAuslesen([...e.fotos, r].map(f => ({ daten: f.daten, typ: f.typ }))).catch(() => null);
    if (erkannt) setE(x => ({ ...x, felder: ausgelesenesUebernehmen(x.felder, erkannt) as Entwurf['felder'] }));
  };
  const fotoWeg = (id: string) => setE(x => ({ ...x, fotos: x.fotos.filter(f => f.id !== id) }));

  // ── Prüfungen der Felder ──
  const f = e.felder;
  const mailFehler = !leer(f.email) && !emailNormal(f.email) ? 'Die E-Mail-Adresse sieht unvollständig aus.' : undefined;
  const telFehler = !leer(f.telefon) && !telefonNormal(f.telefon) ? 'Bitte mit Vorwahl (z. B. 0221 … oder +49 …).' : undefined;
  const mobilFehler = !leer(f.mobil) && !telefonNormal(f.mobil) ? 'Bitte mit Vorwahl (z. B. 0171 … oder +49 …).' : undefined;
  const webFehler = !leer(f.webseite) && !webNormal(f.webseite) ? 'Die Webseite sieht nicht gültig aus.' : undefined;
  const linkFehler = !leer(f.linkedin) && !linkedinNormal(f.linkedin) ? 'Bitte die Profil-Adresse (linkedin.com/in/…).' : undefined;
  const felderOk = !mailFehler && !telFehler && !mobilFehler && !webFehler && !linkFehler;
  // „Mehr“ geht von selbst auf, wenn dort ein Feld markiert ist — versteckte Fehler würden „Weiter“ sonst rätselhaft blockieren.
  const mehrAuf = mehr || !!(telFehler || webFehler || linkFehler);
  const mehrGefuellt = !leer(f.position) || !leer(f.telefon) || !leer(f.webseite) || !leer(f.linkedin) || !leer(f.anschrift);

  // ── Kennen wir schon? — bei jeder Eingabe (billig genug für ein paar hundert Personen) ──
  const treffer = useMemo(() => kenntWirSchon({ vorname: f.vorname, nachname: f.nachname, firma: f.firma, email: emailNormal(f.email) ?? f.email, telefon: f.telefon, mobil: f.mobil }, kontakte), [f.vorname, f.nachname, f.firma, f.email, f.telefon, f.mobil, kontakte]);
  const starkOffen = !e.vorhandenId && !e.neuErzwingen && treffer.some(t => !t.gesperrt && (t.staerke === 'mail' || t.staerke === 'telefon' || t.staerke === 'name-firma'));
  const gewaehlt = e.vorhandenId ? kontakte.find(k => k.id === e.vorhandenId) : undefined;
  /** Treffer über Mail/Telefon, aber mit anderem Namen (z. B. Zentrale) — das soll man vor „Diesen nehmen“ sehen. */
  const nameWeichtAb = (k: Kontakt) => !leer(f.nachname) && !!k.nachname && k.nachname.trim().toLowerCase() !== (f.nachname ?? '').trim().toLowerCase();

  // ── Auch im Handy speichern (03.10.): vCard aus den erfassten Feldern — liegt lokal vor, auch solange die Erfassung noch wartet ──
  const [handyAn, setHandyAn] = useGemerkt<boolean>(HANDY_SPEICHER_KEY, false);
  const handy: HandyErgebnis = useMemo(
    () => (gewaehlt ? handyKarteAusKontakt(gewaehlt, { event: wahl?.titel, datum: wahl?.datum }) : handyKarteAusErfassung(f, { event: wahl?.titel, datum: wahl?.datum })),
    [gewaehlt, f, wahl?.titel, wahl?.datum],
  );

  // ── Firma ──
  const firmen = api.crm?.stand.firmen ?? KEINE_FIRMEN;
  const vorschlaege = useMemo(() => (leer(f.firma) || e.vorhandenId ? [] : firmaVorschlaege(f.firma ?? '', firmen)), [f.firma, firmen, e.vorhandenId]);
  // Dieselbe Funktion wie der Server (`firmaZurKarte`): Name gewinnt, die Domain nur bei passendem Namen — Bestätigen zeigt die TATSÄCHLICH verwendete Firma (M1).
  const exakt = useMemo(() => (leer(f.firma) || e.vorhandenId ? undefined : firmaZurKarte({ firma: f.firma ?? '', email: f.email, webseite: f.webseite }, firmen as Firma[])), [f.firma, f.email, f.webseite, firmen, e.vorhandenId]);
  const firmaVerknuepft = !e.firmaNeu && (e.firmaId ? firmen.find(x => x.id === e.firmaId) : exakt);
  const domainVorschlag = useMemo(() => (!leer(f.firma) || e.vorhandenId ? undefined : firmaVorschlagAusDomain({ email: f.email, webseite: f.webseite }, firmen as Firma[])), [f.firma, f.email, f.webseite, firmen, e.vorhandenId]);

  // Kommende Events (für „Zu Make.One einladen“): nicht das heutige, nicht abgesagt.
  const kommende = useMemo(() => (api.crm?.stand.events ?? []).filter(ev => ev.id !== wahl?.eventId && !istNetzwerkenEvent(ev) && ev.datum >= heute && (ev.status === 'idee' || ev.status === 'geplant' || ev.status === 'einladung')).sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 8), [api.crm, wahl?.eventId, heute]);
  const nachnameOk = !leer(f.nachname) || !!e.vorhandenId;
  const weiter1 = () => {
    if (!wahl) { setFehler('Bitte oben zuerst „Heute bei“ wählen.'); return; }
    if (!nachnameOk) { setFehler('Der Nachname fehlt — bitte eintragen.'); nachnameRef.current?.focus(); return; }
    if (!felderOk) { setFehler('Bitte die markierten Felder prüfen oder leeren.'); return; }
    if (starkOffen) { setFehler('Diese Person gibt es vielleicht schon — bitte oben „Diesen nehmen“ oder „Trotzdem neu“ wählen.'); trefferRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); return; }
    setFehler(null); setPhase('schritt');
  };

  // ── Schritt ──
  const sch = e.schritt;
  const terminOk = sch !== 'termin' || (!!e.termin.start && !!zustaendigPerson?.kalender);
  const schrittOk = !!sch && terminOk
    && (sch !== 'vermitteln' || e.vermittelnAn.trim().length >= 2)
    && (sch !== 'andere' || e.andereText.trim().length >= 2)
    && (sch !== 'followup' || /^\d{4}-\d{2}-\d{2}$/.test(e.followupFaellig))
    && e.info.length <= INFO_MAX;
  const weiter2 = () => {
    if (!sch) { setFehler('Bitte einen nächsten Schritt wählen — ohne ihn verliert sich die Person.'); return; }
    if (!schrittOk) { setFehler(sch === 'termin' ? (zustaendigPerson?.kalender ? 'Bitte eine Zeit für den Termin wählen.' : `Für ${nameVon(e.zustaendig)} gibt es keinen Kalender.`) : sch === 'vermitteln' ? 'An wen vermitteln?' : sch === 'andere' ? 'Was soll getan werden?' : e.info.length > INFO_MAX ? `Die Info ist zu lang (höchstens ${INFO_MAX} Zeichen).` : 'Bitte die Angaben ergänzen.'); return; }
    setFehler(null); setPhase('bestaetigen');
  };

  // ── Speichern: erst lokal in die Warteschlange, dann senden ──
  const speichern = async () => {
    if (speichert || !wahl || !sch) return;
    setSpeichert(true); setFehler(null);
    try {
      const k: Record<string, string> = {};
      for (const [name, wert] of Object.entries(f)) if (typeof wert === 'string' && wert.trim()) k[name] = wert.trim();
      const koerper: Record<string, unknown> = {
        erfassungId: e.id, erfasstAm: new Date().toISOString(), eventId: wahl.eventId, ...(ich ? { erfasstVon: ich } : {}),
        // IMMER mit: wird das Event gelöscht, während die Erfassung wartet (oder war es nur lokal da), legt der Server es daraus neu an — sonst hinge sie ewig (H1).
        eventNeu: { titel: wahl.titel, datum: wahl.datum, ...(wahl.ort ? { ort: wahl.ort } : {}), ...(wahl.fuer?.art === 'kunde' && wahl.fuer.firmaId ? { fuer: wahl.fuer } : {}) },
        kontakt: k,
        ...(e.vorhandenId ? { vorhandenKontaktId: e.vorhandenId } : {}), ...(e.neuErzwingen ? { neuErzwingen: true } : {}),
        ...(!e.vorhandenId && !e.firmaNeu && (e.firmaId || exakt) ? { firmaId: e.firmaId ?? exakt!.id } : {}),
        bilder: e.fotos.map(x => ({ name: x.name, typ: x.typ, daten: x.daten })),
        ...(e.aufnahme ? { sprachnotiz: { typ: e.aufnahme.typ, daten: await dateiAlsBase64(e.aufnahme.blob), ...(e.aufnahme.dauerSek ? { dauerSek: e.aufnahme.dauerSek } : {}) } } : {}),
        schritt: sch, ...(e.info.trim() ? { info: e.info.trim() } : {}), ...(e.gesprochen ? {} : { gesprochen: false }), zustaendig: e.zustaendig,
        ...(sch === 'followup' ? { followup: { faellig: e.followupFaellig } } : {}),
        ...(sch === 'termin' ? { termin: { art: e.termin.art, dauer: e.termin.dauer, start: e.termin.start } } : {}),
        ...(sch === 'vermitteln' ? { vermitteln: { an: e.vermittelnAn.trim() } } : {}),
        ...(sch === 'makeone' && e.makeoneEventId ? { makeone: { eventId: e.makeoneEventId } } : {}),
        ...(sch === 'andere' ? { andere: { text: e.andereText.trim(), ...(e.andereFaellig ? { faellig: e.andereFaellig } : {}) } } : {}),
      };
      const name = gewaehlt ? anzeigename(gewaehlt) : [f.vorname, f.nachname].filter(x => x?.trim()).join(' ').trim() || 'Person';
      await warte.ablegen(koerper, { name, schritt: schrittLabel(sch), eventTitel: wahl.titel, ...(sch === 'termin' ? { termin: `${tagText(e.termin.start.slice(0, 10))} ${e.termin.start.slice(11, 16)}` } : {}) });
      setGesendetId(e.id);
      setPhase('fertig');
    } catch {
      setFehler('Das Speichern auf dem Gerät hat nicht geklappt — bitte noch einmal tippen. Die Eingaben bleiben stehen.');
    } finally { setSpeichert(false); }
  };

  const nochEine = () => { setE(neuerEntwurf(zustaendigStart, heute)); setPhase('karte'); setGesendetId(null); setFehler(null); setMehr(false); };

  // ── Darstellung ──
  const punkte = ['Karte', 'Schritt', 'Bestätigen'];
  const phaseNr = phase === 'karte' ? 0 : phase === 'schritt' ? 1 : phase === 'bestaetigen' ? 2 : 3;
  const personName = gewaehlt ? anzeigename(gewaehlt) : [f.vorname, f.nachname].filter(x => x?.trim()).join(' ').trim();
  const personFirma = gewaehlt ? gewaehlt.firma : f.firma?.trim();
  const klarLink: CSSProperties = { background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, textDecoration: 'underline', minHeight: 44, padding: '0 4px', fontFamily: 'inherit' };

  return (
    <div ref={oben} style={{ display: 'grid', gap: 16, scrollMarginTop: 70 }}>
      {phase !== 'fertig' && <Fortschritt punkte={punkte} nr={phaseNr} />}
      {phase !== 'karte' && phase !== 'fertig' && <PersonKopf name={personName || 'Person'} firma={personFirma} zusatz={wahl?.titel} />}

      {phase === 'karte' && (
        <>
          {/* Fotos */}
          <section aria-label="Visitenkarte" style={{ display: 'grid', gap: 10 }}>
            <input ref={kamera} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={x => { const d = x.target.files?.[0]; x.target.value = ''; void fotoDazu(d); }} />
            <input ref={galerie} type="file" accept="image/*" tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={x => { const d = x.target.files?.[0]; x.target.value = ''; void fotoDazu(d); }} />
            {e.fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {e.fotos.map((x, i) => (
                  <div key={x.id} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setGross(x)} aria-label={`Foto ${i + 1} vergrößern`} className="fassbar" style={{ display: 'block', width: '100%', padding: 0, border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, overflow: 'hidden', background: '#000', cursor: 'zoom-in', boxShadow: '0 10px 26px -14px rgba(0,0,0,.8)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.dataUrl} alt={`Visitenkarte, Foto ${i + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', background: '#000' }} />
                    </button>
                    <button type="button" onClick={() => fotoWeg(x.id)} aria-label={`Foto ${i + 1} löschen`} style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {e.fotos.length === 0 && (
              <button type="button" onClick={() => kamera.current?.click()} className="fassbar" style={{ display: 'grid', justifyItems: 'center', gap: 8, width: '100%', minHeight: 132, boxSizing: 'border-box', padding: '20px 16px', borderRadius: 18, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.aktiv,
                border: `1.5px dashed ${TIEF.rand(C.aktiv)}`, background: `linear-gradient(160deg, ${C.aktiv}1F, ${C.aktiv}08)` }}>
                <span aria-hidden style={{ width: 48, height: 48, borderRadius: 24, display: 'grid', placeItems: 'center', background: TIEF.flaeche(C.aktiv), border: `1px solid ${TIEF.rand(C.aktiv)}` }}><Camera size={24} /></span>
                <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>Visitenkarte fotografieren</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 500 }}>Vorderseite — die Rückseite ist optional</span>
              </button>
            )}
            {e.fotos.length === 1 && !e.rueckseiteWeg && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Gross onClick={() => kamera.current?.click()} kleinerAbstand>Rückseite fotografieren</Gross>
                <Gross onClick={() => up({ rueckseiteWeg: true })} kleinerAbstand>Überspringen</Gross>
              </div>
            )}
            {e.fotos.length >= 1 && (e.fotos.length > 1 || e.rueckseiteWeg) && e.fotos.length < MAX_BILDER && <Gross onClick={() => kamera.current?.click()} kleinerAbstand>+ weiteres Foto</Gross>}
            {e.fotos.length === 0 && <button type="button" onClick={() => galerie.current?.click()} style={{ ...klarLink, color: C.inkDim, justifySelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ImagePlus size={16} aria-hidden /> oder ein Foto aus der Mediathek wählen</button>}
            {fotoFehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fotoFehler}</Hinweis>}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Nur die Visitenkarte fotografieren, keine Personen. Verkleinert und verschlüsselt abgelegt, nach 6 Monaten gelöscht. Felder bitte von Hand eintragen — das Auslesen kommt später.</div>
          </section>

          {/* Person — zuerst, was man für den nächsten Schritt wirklich braucht: Name, Firma, E-Mail, Handy. Der Rest liegt unter „Mehr“. */}
          <section aria-label="Angaben zur Person" style={{ display: 'grid', gap: 12 }}>
            <Beschriftung>Person</Beschriftung>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <Feldzeile label="Vorname"><input value={f.vorname ?? ''} onChange={x => feld({ vorname: x.target.value })} autoComplete="off" autoCapitalize="words" enterKeyHint="next" style={eingabe} aria-label="Vorname" /></Feldzeile>
              <Feldzeile label="Nachname *"><input ref={nachnameRef} value={f.nachname ?? ''} onChange={x => feld({ nachname: x.target.value })} autoComplete="off" autoCapitalize="words" enterKeyHint="next" style={eingabe} aria-label="Nachname" /></Feldzeile>
            </div>

            {/* Kennen wir schon? */}
            {gewaehlt ? (
              <Hinweis farbe={LEUCHT.gut} rolle="status">
                <b>✓ Ich nehme {anzeigename(gewaehlt)}</b>{gewaehlt.firma ? ` · ${gewaehlt.firma}` : ''} — diese Person gibt es schon. Karte, Info und nächster Schritt hängen an ihr; leere Felder (Telefon, Handy, Position, LinkedIn, Website) werden ergänzt, nichts wird überschrieben.
                <div style={{ marginTop: 10 }}><Gross onClick={() => up({ vorhandenId: undefined })} kleinerAbstand>Doch neu anlegen</Gross></div>
              </Hinweis>
            ) : treffer.length > 0 && !e.neuErzwingen ? (
              <div ref={trefferRef} style={{ display: 'grid', gap: 10, scrollMarginTop: 80 }}>
                {treffer.map(t => {
                  const x = kennenText(t, nameVon);
                  return (
                    <Hinweis key={t.kontakt.id} farbe={t.gesperrt ? LEUCHT.kritisch : LEUCHT.achtung} rolle="status">
                      {t.gesperrt ? (
                        <><b>{x.name}</b> gibt es schon, ist aber eingeschränkt (Art. 18) — die Verarbeitung ist gesperrt, bitte nicht erfassen.</>
                      ) : (
                        <>
                          <b>Kennen wir schon:</b> {x.name}{x.firma ? ` · ${x.firma}` : ''} · zuständig {x.zustaendig}{x.zuletzt ? ` · zuletzt ${tagText(x.zuletzt)}` : ''}
                          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>({t.grund}{nameWeichtAb(t.kontakt) ? ' — der Name weicht ab, evtl. Zentrale oder Kollege' : ''})</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                            <Gross ton="gut" onClick={() => up({ vorhandenId: t.kontakt.id })} kleinerAbstand>Diesen nehmen</Gross>
                            <Gross onClick={() => up({ neuErzwingen: true })} kleinerAbstand>Trotzdem neu</Gross>
                          </div>
                        </>
                      )}
                    </Hinweis>
                  );
                })}
              </div>
            ) : null}
            {e.neuErzwingen && !gewaehlt && treffer.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Als neue Person erfasst, obwohl es ähnliche gibt. <button type="button" onClick={() => up({ neuErzwingen: false })} style={klarLink}>Treffer wieder zeigen</button></div>}

            <Feldzeile label="Firma">
              <input value={f.firma ?? ''} onChange={x => { feld({ firma: x.target.value }); up({ firmaId: undefined, firmaNeu: false }); }} autoComplete="off" autoCapitalize="words" style={eingabe} aria-label="Firma" />
            </Feldzeile>
            {!leer(f.firma) && !e.vorhandenId && (
              <div style={{ display: 'grid', gap: 8 }}>
                {firmaVerknuepft ? (
                  <Hinweis farbe={LEUCHT.gut}>✓ Bestehende Firma: <b>{firmaVerknuepft.name}</b>. <button type="button" onClick={() => up({ firmaNeu: true, firmaId: undefined })} style={klarLink}>Stattdessen neue anlegen</button></Hinweis>
                ) : (
                  <>
                    {vorschlaege.filter(v => v.firma.id !== exakt?.id).map(v => <Gross key={v.firma.id} onClick={() => { feld({ firma: v.firma.name }); up({ firmaId: v.firma.id, firmaNeu: false }); }} kleinerAbstand>Bestehende Firma nehmen: {v.firma.name}</Gross>)}
                    <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{e.firmaNeu || !vorschlaege.length ? `Neue Firma „${f.firma!.trim()}“ wird angelegt.` : `Oder neue Firma „${f.firma!.trim()}“ anlegen (so lassen).`}</div>
                  </>
                )}
              </div>
            )}
            {domainVorschlag && <Gross onClick={() => { feld({ firma: domainVorschlag.name }); up({ firmaId: domainVorschlag.id, firmaNeu: false }); }} kleinerAbstand>Gleiche Mail-Domain: {domainVorschlag.name} — als Firma nehmen?</Gross>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <Feldzeile label="E-Mail" fehler={mailFehler}><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={f.email ?? ''} onChange={x => feld({ email: x.target.value })} style={eingabe} aria-label="E-Mail" /></Feldzeile>
              <Feldzeile label="Handy" fehler={mobilFehler}><input type="tel" inputMode="tel" enterKeyHint="done" value={f.mobil ?? ''} onChange={x => feld({ mobil: x.target.value })} style={eingabe} aria-label="Handy" /></Feldzeile>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, flex: '0 0 auto' }}>Anrede</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
                <Wahl klein an={f.anrede === 'Du'} onClick={() => feld({ anrede: 'Du' })}>Du</Wahl>
                <Wahl klein an={f.anrede === 'Sie'} onClick={() => feld({ anrede: 'Sie' })}>Sie</Wahl>
              </div>
            </div>
            <div>
              <Wahl klein an={mehrAuf} onClick={() => setMehr(m => !m)}>{mehrAuf ? 'Weniger' : `Mehr: Position, Telefon, Webseite${mehrGefuellt ? ' ✓' : ''}`}</Wahl>
              {mehrAuf && (
                <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                  <Feldzeile label="Position"><input value={f.position ?? ''} onChange={x => feld({ position: x.target.value })} autoComplete="off" style={eingabe} aria-label="Position" /></Feldzeile>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                    <Feldzeile label="Telefon (Festnetz)" fehler={telFehler}><input type="tel" inputMode="tel" value={f.telefon ?? ''} onChange={x => feld({ telefon: x.target.value })} style={eingabe} aria-label="Telefon" /></Feldzeile>
                    <Feldzeile label="Webseite" fehler={webFehler}><input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.webseite ?? ''} onChange={x => feld({ webseite: x.target.value })} style={eingabe} aria-label="Webseite" /></Feldzeile>
                  </div>
                  <Feldzeile label="LinkedIn (optional)" fehler={linkFehler}><input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.linkedin ?? ''} onChange={x => feld({ linkedin: x.target.value })} style={eingabe} aria-label="LinkedIn" /></Feldzeile>
                  <Feldzeile label="Anschrift (optional)"><textarea value={f.anschrift ?? ''} onChange={x => feld({ anschrift: x.target.value })} rows={3} autoComplete="off" style={{ ...eingabe, resize: 'vertical' }} aria-label="Anschrift" /></Feldzeile>
                </div>
              )}
            </div>
          </section>

          {offline && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Kein Netz erkannt — du kannst trotzdem erfassen, alles wird gesendet, sobald Netz da ist. „Kennen wir schon?“ prüft dann nur, was zuletzt geladen wurde.</div>}
          {!wahl && <Hinweis farbe={LEUCHT.achtung} rolle="alert">Bitte oben zuerst „Heute bei“ wählen — damit die Person dem Event zugeordnet wird.</Hinweis>}
          <Aktionsleiste>
            {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
            <Gross ton="haupt" onClick={weiter1}>Weiter: nächster Schritt</Gross>
          </Aktionsleiste>
        </>
      )}

      {phase === 'schritt' && (
        <>
          <section aria-label="Nächster Schritt" style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ ...kopfStil, fontSize: TYP.titel }}>Nächster Schritt <span style={{ color: LEUCHT.achtung }}>*</span></h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {SCHRITTE.map(s => {
                const an = sch === s.id;
                const Symbol = SCHRITT_SYMBOL[s.id];
                return (
                  <button key={s.id} type="button" aria-pressed={an} onClick={() => up({ schritt: s.id })} className="fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, lineHeight: 1.25,
                    border: `1px solid ${an ? TIEF.rand(C.aktiv) : 'rgba(255,255,255,.1)'}`, background: an ? TIEF.flaeche(C.aktiv) : 'rgba(255,255,255,.04)', color: an ? C.aktiv : C.ink }}>
                    <Symbol size={20} aria-hidden style={{ flex: '0 0 auto', opacity: an ? 1 : 0.7 }} /><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, minHeight: 20 }}>{sch ? `${SCHRITTE.find(s => s.id === sch)!.kurz}.` : 'Ohne nächsten Schritt verliert sich die Person — einer genügt.'}</div>
          </section>

          <section aria-label="Zuständig" style={{ display: 'grid', gap: 8 }}>
            <Beschriftung>Wer ist zuständig?</Beschriftung>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[...personen].sort((a, b) => Number(b.id === ich) - Number(a.id === ich)).map(p => <Wahl key={p.id} an={e.zustaendig === p.id} onClick={() => up({ zustaendig: p.id, ...(sch === 'termin' ? { termin: { ...e.termin, start: '' } } : {}) })}>{p.name}{p.id === ich ? ' (ich)' : ''}</Wahl>)}
              {!personen.length && <span style={{ fontSize: TYP.body, color: C.inkLeise }}>Personen werden geladen …</span>}
            </div>
            {e.zustaendig && e.zustaendig !== ich && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{nameVon(e.zustaendig)} bekommt eine Meldung{sch === 'termin' ? ' mit dem Termin' : ''} und sieht es beim nächsten Öffnen.</div>}
          </section>

          {sch === 'termin' && (
            <TerminWahl person={e.zustaendig} personName={nameVon(e.zustaendig)} kalenderDa={!!zustaendigPerson?.kalender} wert={e.termin} onWert={t => up({ termin: t })} />
          )}
          {sch === 'followup' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <Beschriftung>Frist</Beschriftung>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Wahl klein an={e.followupFaellig === followupFrist(heute)} onClick={() => up({ followupFaellig: followupFrist(heute) })}>in 2 Werktagen</Wahl>
                <Wahl klein an={e.followupFaellig === followupFrist(followupFrist(heute))} onClick={() => up({ followupFaellig: followupFrist(followupFrist(heute)) })}>in 4 Werktagen</Wahl>
              </div>
              <Feldzeile label="oder ein anderer Tag"><input type="date" value={e.followupFaellig} min={heute} onChange={x => up({ followupFaellig: x.target.value })} style={eingabe} aria-label="Frist" /></Feldzeile>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Fällig am {e.followupFaellig ? tagText(e.followupFaellig) : '—'} bei {nameVon(e.zustaendig)}.</div>
            </section>
          )}
          {sch === 'vermitteln' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <Feldzeile label="Vermitteln an …"><input value={e.vermittelnAn} onChange={x => up({ vermittelnAn: x.target.value })} placeholder="Name der Person oder Firma" autoCapitalize="words" style={eingabe} aria-label="Vermitteln an" /></Feldzeile>
              <Hinweis>Es entsteht ein Deal der Art „Vermittlung“ in der Pipeline (wie „Vermitteln“ in der Kontaktakte) mit dem nächsten Schritt „Vermitteln an …“.</Hinweis>
            </section>
          )}
          {sch === 'andere' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <Feldzeile label="Was soll getan werden?"><input value={e.andereText} onChange={x => up({ andereText: x.target.value })} placeholder="z. B. Studie zuschicken" style={eingabe} aria-label="Aufgabe" /></Feldzeile>
              <Feldzeile label="Bis wann (optional)"><input type="date" value={e.andereFaellig} min={heute} onChange={x => up({ andereFaellig: x.target.value })} style={eingabe} aria-label="Frist" /></Feldzeile>
            </section>
          )}
          {sch === 'qualifizieren' && <Hinweis>Die Person (bzw. ihre Firma) kommt in die Qualifizierungsrunde — Status „Qualifizierung“.</Hinweis>}
          {sch === 'angebot' && <Hinweis>Im Angebots-Tool entsteht ein Entwurf mit Bezug zur Person. Nichts wird gestellt oder verschickt.</Hinweis>}
          {sch === 'makeone' && (
            <section style={{ display: 'grid', gap: 10 }}>
              <Beschriftung>Für welches Event vormerken?</Beschriftung>
              {kommende.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {kommende.map(ev => <Wahl key={ev.id} an={e.makeoneEventId === ev.id} onClick={() => up({ makeoneEventId: e.makeoneEventId === ev.id ? undefined : ev.id })}>{ev.titel} · {tagText(ev.datum)}</Wahl>)}
                </div>
              ) : <Hinweis>{api.crm ? 'Kein kommendes Event geplant — die Person wird mit Label und Aufgabe vorgemerkt.' : 'Die Events werden geladen …'}</Hinweis>}
              <Hinweis>Vorgemerkt wird als Gast („vorgemerkt“, wie „Make.One einladen“ in der Kontaktakte); der Einladungsweg folgt der Ampel (§ 7 UWG). Eingeladen wird nicht von hier — das machst du später von Hand.</Hinweis>
            </section>
          )}
          {sch === 'nur-kontakt' && <Hinweis>Nur der Kontakt wird gespeichert — „Kennengelernt bei {wahl?.titel ?? 'dem Event'}“ steht im Verlauf.</Hinweis>}

          <section aria-label="Info" style={{ display: 'grid', gap: 10 }}>
            <Beschriftung rechts={`${e.info.length}/${INFO_MAX}`}>Info zum Gespräch (optional)</Beschriftung>
            <textarea value={e.info} onChange={x => up({ info: x.target.value })} rows={4} placeholder="Worüber habt ihr gesprochen? Was wurde zugesagt?" style={{ ...eingabe, resize: 'vertical', minHeight: 104 }} aria-label="Info zum Gespräch" />
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, display: 'flex', alignItems: 'center', gap: 6 }}><Mic size={14} aria-hidden /> Diktieren: am iPhone das Mikrofon-Symbol auf der Tastatur antippen.</div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>Keine sensiblen Angaben (Gesundheit, Religion, Politik).</div>
            <Sprachnotiz wert={e.aufnahme} onWert={a => up({ aufnahme: a })} />
          </section>

          {/* M12 (Praxis-Prüfung): der Haken steht sichtbar direkt über „Weiter“ — wer nur eine Karte bekam, schaltet ihn aus (dann keine Danke-Mail, § 7 UWG). */}
          <GespraechSchalter an={e.gesprochen} onUm={v => up({ gesprochen: v })} />

          <Aktionsleiste>
            {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
            <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8 }}>
              <Gross onClick={() => { setPhase('karte'); setFehler(null); }}>Zurück</Gross>
              <Gross ton="haupt" onClick={weiter2}>Weiter: bestätigen</Gross>
            </div>
          </Aktionsleiste>
        </>
      )}

      {phase === 'bestaetigen' && (
        <>
          <section aria-label="Zusammenfassung" style={{ display: 'grid', gap: 0, borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', overflow: 'hidden' }}>
            {([
              ['Event', wahl ? `${wahl.titel} · ${tagText(wahl.datum)}` : '—'],
              ['Person', gewaehlt ? `${anzeigename(gewaehlt)} (bestehend)` : [f.vorname, f.nachname].filter(x => x?.trim()).join(' ') || '—'],
              ['Firma', e.vorhandenId ? (gewaehlt?.firma ?? '—') : (f.firma?.trim() ? `${f.firma.trim()}${firmaVerknuepft ? ' (bestehend)' : ' (neu)'}` : '—')],
              ['Erreichbar', [f.email, f.telefon, f.mobil].filter(x => x?.trim()).join(' · ') || '—'],
              ['Fotos', e.fotos.length ? `${e.fotos.length} Foto${e.fotos.length === 1 ? '' : 's'}` : 'keine'],
              ['Sprachnotiz', e.aufnahme ? 'ja — Abschrift folgt (KI)' : 'keine'],
              ['Nächster Schritt', `${schrittLabel(sch ?? '')}${sch === 'termin' ? ` · ${terminArtLabel(e.termin.art)}, ${tagText(e.termin.start.slice(0, 10))} ${e.termin.start.slice(11, 16)} (${e.termin.dauer} Min.)` : sch === 'followup' ? ` · bis ${tagText(e.followupFaellig)}` : sch === 'vermitteln' ? ` · an ${e.vermittelnAn.trim()}` : sch === 'andere' ? ` · ${e.andereText.trim()}` : sch === 'makeone' ? ` · ${kommende.find(x => x.id === e.makeoneEventId)?.titel ?? 'ohne Event (Aufgabe)'}` : ''}`],
              ['Zuständig', nameVon(e.zustaendig)],
              ['Info', e.info.trim() || '—'],
            ] as [string, string][]).map(([k, v], i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 120px) 1fr', gap: 12, padding: '11px 14px', borderTop: i ? '1px solid rgba(255,255,255,.06)' : undefined, fontSize: TYP.body, lineHeight: 1.45 }}>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{k}</span><span style={{ overflowWrap: 'break-word', whiteSpace: 'pre-wrap', fontWeight: k === 'Nächster Schritt' ? 700 : 400 }}>{weicheUmbrueche(v)}</span>
              </div>
            ))}
          </section>
          {!e.vorhandenId && <Hinweis>Quelle „{NETZWERKEN_QUELLE}“ · <b>keine Werbe-Einwilligung</b> — {KEINE_EINWILLIGUNG}. {e.gesprochen ? 'Die Danke-Mail liegt ab morgen als Entwurf bereit (mit Datenschutzhinweis); verschickt wird nur per Klick.' : 'Ohne Gespräch gibt es keine Danke-Mail — den Datenschutzhinweis beim ersten Kontakt geben.'}</Hinweis>}
          <GespraechSchalter an={e.gesprochen} onUm={v => up({ gesprochen: v })} />
          <HandySchalter an={handyAn && handy.ok} onUm={setHandyAn} grund={handy.ok ? undefined : handy.grund} />
          {offline && <Hinweis farbe={LEUCHT.achtung}>Kein Netz erkannt — die Erfassung bleibt auf dem Gerät und wird gesendet, sobald Netz da ist.</Hinweis>}
          <Aktionsleiste>
            {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
            <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8 }}>
              <Gross onClick={() => { setPhase('schritt'); setFehler(null); }}>Zurück</Gross>
              <Gross ton="gut" onClick={() => void speichern()} aus={speichert}>{speichert ? 'Speichert …' : '✓ Speichern'}</Gross>
            </div>
          </Aktionsleiste>
        </>
      )}

      {phase === 'fertig' && gesendetId && <Fertig id={gesendetId} warte={warte} name={personName || 'Person'} zustaendig={nameVon(e.zustaendig)} foto={e.fotos[0]?.dataUrl ?? null} onNochEine={nochEine} onBericht={onBericht} schritt={sch ?? undefined} handy={handy} hervor={handyAn} offline={offline} />}

      {gross && (
        <Fenster titel={`Foto ${e.fotos.findIndex(x => x.id === gross.id) + 1}`} onZu={() => setGross(null)} breit={900}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gross.dataUrl} alt="Visitenkarte vergrößert" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12, background: '#000' }} />
          <Gross onClick={() => { fotoWeg(gross.id); setGross(null); }} kleinerAbstand>Foto löschen</Gross>
        </Fenster>
      )}
    </div>
  );
}

const SCHRITT_SYMBOL: Record<NetzwerkSchritt, LucideIcon> = {
  termin: CalendarClock, qualifizieren: Star, followup: ListChecks, vermitteln: ArrowRightLeft, andere: PenLine, angebot: Euro, makeone: Sparkles, 'nur-kontakt': UserCheck,
};

/** Wer gerade erfasst wird — oben in Schritt 2 und 3, damit man nie raten muss, für wen der Schritt gilt. */
function PersonKopf({ name, firma, zusatz }: { name: string; firma?: string; zusatz?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
      <Initialen name={name} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{name}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>{[firma, zusatz].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    </div>
  );
}

/** Der Platzhalter, wenn die Karte nicht fotografiert wurde: eine gezeichnete Visitenkarte mit den Initialen. */
function KartenPlatzhalter({ name }: { name: string }) {
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: 14, padding: 14, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignContent: 'center', alignItems: 'center', background: 'linear-gradient(145deg, #1D252A, #12171A)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 14px 30px -12px rgba(0,0,0,.8)' }}>
      <Initialen name={name} groesse={44} farbe={C.aktiv} />
      <div style={{ display: 'grid', gap: 7 }}>
        <span style={{ height: 8, width: '78%', borderRadius: 4, background: 'rgba(255,255,255,.34)' }} />
        <span style={{ height: 6, width: '52%', borderRadius: 3, background: 'rgba(255,255,255,.16)' }} />
      </div>
      <span style={{ gridColumn: '1 / -1', height: 5, width: '64%', borderRadius: 3, background: 'rgba(255,255,255,.1)' }} />
    </div>
  );
}

/** Nach dem Speichern: was gerade passiert — gesendet, wartet aufs Netz oder abgelehnt. Bei „gesendet“ landet die Karte in der Kartei. */
function Fertig({ id, warte, name, zustaendig, foto, onNochEine, onBericht, schritt, handy, hervor, offline }: { offline: boolean; handy: HandyErgebnis; hervor: boolean; id: string; warte: Warte; name: string; zustaendig: string; foto: string | null; onNochEine: () => void; onBericht: () => void; schritt?: NetzwerkSchritt }) {
  const e = warte.eintraege.find(x => x.id === id);
  const a = warte.antworten[id];
  const wartet = e?.status === 'wartet';
  const fehlt = e?.status === 'fehler';
  const verlinkt: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: ZIEL, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: C.ink, textDecoration: 'none', fontWeight: 700, fontSize: 16 };
  // Termin · Deal · Follow-up · Event aus den Kennungen, die der Server liefert (der Kontakt hat oben seinen eigenen Link).
  const verknuepfungen: LinkChip[] = linksAusAntwort(a, schritt, id).filter(l => l.id !== 'kontakt');
  return (
    <section aria-label="Gespeichert" style={{ display: 'grid', gap: 14 }}>
      {!e ? (
        <>
          {/* Highlight a: das Foto (oder ein Platzhalter) schrumpft in den Chip — danach steht nur noch der Chip da. */}
          <div className="netz-buehne" aria-hidden>
            <div className="netz-karte-landet">
              {foto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={foto} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 14px 30px -12px rgba(0,0,0,.8)' }} />
                : <KartenPlatzhalter name={name} />}
            </div>
          </div>
          <div role="status" className="netz-chip-ein" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, border: `1px solid ${TIEF.rand(LEUCHT.gut)}`, background: TIEF.flaeche(LEUCHT.gut) }}>
            <span className="netz-haken-kreis" aria-hidden style={{ width: 32, height: 32, borderRadius: 16, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: LEUCHT.gut, color: C.grund }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path className="netz-haken" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span style={{ minWidth: 0, fontSize: TYP.body, lineHeight: 1.4, overflowWrap: 'anywhere' }}><b>Gespeichert</b> · {name} · zuständig {zustaendig}</span>
          </div>
          {a?.zusammengefuehrt ? <div style={{ fontSize: TYP.body, color: C.inkDim }}>Die Person gab es schon — die Erfassung hängt an der bestehenden.</div> : null}
          {(a?.hinweise ?? []).map((h, i) => <div key={i} style={{ fontSize: TYP.body, color: C.inkDim }}>{h}</div>)}
        </>
      ) : fehlt ? (
        <Hinweis farbe={LEUCHT.achtung} rolle="alert"><b>Noch nicht ganz gespeichert.</b><div style={{ marginTop: 6 }}>{e.hinweis}</div>{warte.nurImRam && <div style={{ marginTop: 6 }}><b>{NUR_RAM_HINWEIS}</b></div>}</Hinweis>
      ) : (
        // Eine Zeile statt einer zweiten Box: die Einzelheiten (Liste, „Jetzt senden“, Neu laden) stehen oben im Streifen der Warteschlange.
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, border: `1px solid ${TIEF.rand(LEUCHT.achtung)}`, background: TIEF.flaeche(LEUCHT.achtung) }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, flex: '0 0 auto', background: LEUCHT.achtung, boxShadow: `0 0 10px ${LEUCHT.achtung}66` }} />
          <span style={{ minWidth: 0, fontSize: TYP.body, lineHeight: 1.4, overflowWrap: 'anywhere' }}><b>{warte.nurImRam ? 'Noch nicht gesendet' : 'Auf dem Gerät gespeichert'}</b> · {name} — {warte.laeuft ? 'wird gerade gesendet …' : offline ? 'kein Netz, geht automatisch raus' : 'wird gesendet'}</span>
        </div>
      )}
      {fehlt && e && <div style={{ display: 'grid', gap: 8 }}><Gross ton="haupt" onClick={() => void warte.erneut(e.id)}>Erneut versuchen</Gross><OhneTerminKnopf e={e} onOhneTermin={x => void warte.ohneTermin(x)} /><Gross onClick={() => void warte.verwerfen(e.id)} kleinerAbstand>Verwerfen</Gross></div>}
      {!wartet && !fehlt && a?.kontaktId && <Link href={WEG.akte(a.kontaktId)} className="fassbar" style={verlinkt}>Zum Kontakt ›</Link>}
      {/* Platz für die Verknüpfungen der Erfassung (Termin · Deal · Follow-up · Event): eine Zeile Chips, leer = unsichtbar. */}
      {!wartet && !fehlt && <LinkChips links={verknuepfungen} />}
      <HandyKnopf handy={handy} hervor={hervor} />
      <Aktionsleiste>
        <Gross ton="haupt" onClick={onNochEine}>Nächste Karte</Gross>
        <Gross onClick={onBericht} kleinerAbstand>Heute erfasst ansehen</Gross>
      </Aktionsleiste>
    </section>
  );
}

/** „Wir haben persönlich gesprochen“ (§ 7 UWG): nur dann gibt es morgen einen Danke-Entwurf. Standard an; ohne Gespräch beim ersten Kontakt den Datenschutzhinweis geben. */
export function GespraechSchalter({ an, onUm }: { an: boolean; onUm: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={an} onClick={() => onUm(!an)} className="fassbar" data-testid="gespraech-schalter"
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: ZIEL, padding: '10px 14px', borderRadius: 14, textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.body, color: C.ink, cursor: 'pointer',
        border: `1px solid ${an ? TIEF.rand(C.aktiv) : 'rgba(255,255,255,.12)'}`, background: an ? TIEF.flaeche(C.aktiv) : 'rgba(255,255,255,.04)' }}>
      <span style={{ flex: 1, minWidth: 0 }}><b>Wir haben persönlich gesprochen</b><span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{an ? 'Danke-Entwurf ab morgen. Aus = keine Danke-Mail.' : 'Aus: keine Danke-Mail — nur Karte erhalten. Datenschutzhinweis beim ersten Kontakt geben.'}</span></span>
      <span aria-hidden style={{ flex: '0 0 auto', width: 44, height: 26, borderRadius: 13, position: 'relative', background: an ? C.aktiv : 'rgba(255,255,255,.18)' }}>
        <span style={{ position: 'absolute', top: 3, left: an ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
}

/** Bestätigen: „Auch im Handy speichern“ — gemerkt je Gerät. Teilt nicht selbst (iOS erlaubt das nur nach einem Tipp), blendet nur auf der Fertig-Ansicht den Knopf hervorgehoben ein. */
export function HandySchalter({ an, onUm, grund }: { an: boolean; onUm: (v: boolean) => void; grund?: string }) {
  const aus = !!grund;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button type="button" role="switch" aria-checked={an} disabled={aus} onClick={() => onUm(!an)} className="fassbar" data-testid="handy-schalter"
        style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: ZIEL, padding: '10px 14px', borderRadius: 14, textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.body, color: aus ? C.inkLeise : C.ink, cursor: aus ? 'default' : 'pointer',
          border: `1px solid ${an ? TIEF.rand(C.aktiv) : 'rgba(255,255,255,.12)'}`, background: an ? TIEF.flaeche(C.aktiv) : 'rgba(255,255,255,.04)' }}>
        <BookUser size={20} aria-hidden style={{ flex: '0 0 auto', color: an ? C.aktiv : C.inkDim }} />
        <span style={{ flex: 1, minWidth: 0 }}><b>Auch im Handy speichern</b><span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{aus ? grund : 'Danach liegt der Kontakt-Knopf bereit — die Daten bleiben im Browser. Im Handy liegt er dann in Apple Kontakte (iCloud) — Löschen und Auskunft dort selbst.'}</span></span>
        <span aria-hidden style={{ flex: '0 0 auto', width: 44, height: 26, borderRadius: 13, position: 'relative', background: an ? C.aktiv : 'rgba(255,255,255,.18)' }}>
          <span style={{ position: 'absolute', top: 3, left: an ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left .15s' }} />
        </span>
      </button>
    </div>
  );
}

/** Fertig-Ansicht: der Knopf „Auch im Handy speichern“ — funktioniert auch, solange die Erfassung noch wartet (die Daten liegen lokal vor). `hervor`: Schalter war an. */
export function HandyKnopf({ handy, hervor }: { handy: HandyErgebnis; hervor: boolean }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const tipp = async () => {
    if (!handy.ok) return;
    setMeldung(null);
    const r = await handyTeilen(handy.karte);
    setMeldung(handyMeldung(r));
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Gross ton={hervor ? 'haupt' : 'leise'} onClick={() => void tipp()} aus={!handy.ok} titel={handy.ok ? 'Kontakt im Handy speichern' : handy.grund}>
        <BookUser size={20} aria-hidden />Auch im Handy speichern
      </Gross>
      {!handy.ok && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{handy.grund}</div>}
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>✓ {meldung}</div>}
    </div>
  );
}
