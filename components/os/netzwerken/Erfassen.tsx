'use client';

// ─── Netzwerken — Person erfassen (02.10.) ───────────────────────────────────
// Drei Schritte, am Handy mit dem Daumen: (1) Karte fotografieren + Felder + „Kennen wir schon?“, (2) nächster Schritt
// (Pflicht) + Info + Sprachnotiz + wer zuständig ist, (3) bestätigen. Gespeichert wird zuerst in die lokale Warteschlange
// (IndexedDB) und dann gesendet — ohne Netz bleibt alles liegen und geht später raus, nie doppelt (Kennung der Erfassung).
// Das automatische Auslesen der Karte (KI) ist vorbereitet, aber aus (lib/crm/netzwerken-karte.ts).

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import { zufallsUuid } from '@/lib/kennung';
import { anzeigename } from '@/lib/make-one/crm';
import { emailNormal, telefonNormal, linkedinNormal, webNormal } from '@/lib/crm/visitenkarte';
import {
  SCHRITTE, INFO_MAX, MAX_BILDER, kenntWirSchon, kennenText, firmaVorschlaege, followupFrist, schrittLabel, terminArtLabel, NETZWERKEN_QUELLE, KEINE_EINWILLIGUNG,
  type KontaktFelder,
} from '@/lib/crm/netzwerken';
import { karteAuslesen, ausgelesenesUebernehmen } from '@/lib/crm/netzwerken-karte';
import type { NetzwerkSchritt } from '@/lib/crm/typen';
import { WEG } from '@/lib/wege';
import { Fenster } from '../Fenster';
import type { CrmApi } from '../crm/daten';
import { Gross, Wahl, Beschriftung, Feldzeile, Hinweis, eingabe, kopfStil, tagText, ZIEL } from './bausteine';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';

/** Gleiche leere Listen bei jedem Render — sonst rechnen die `useMemo` bei jedem Tippen neu. */
const KEINE: Kontakt[] = [];
const KEINE_FIRMEN: Firma[] = [];
import { fotoVorbereiten, dateiAlsBase64, type Foto } from './bild';
import { Sprachnotiz, type Aufnahme } from './Sprachnotiz';
import { TerminWahl, type TerminEingabe } from './TerminWahl';
import type { EventWahl } from './EventModus';
import type { Person, useWarteschlange } from './useNetzwerken';

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
  id: zufallsUuid(), fotos: [], rueckseiteWeg: false, felder: { anrede: 'Sie' }, neuErzwingen: false, firmaNeu: false, schritt: null, info: '', aufnahme: null, zustaendig,
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

  // Zuständig startet bei der eigenen Person — sobald sie bekannt ist (Kontext lädt nach).
  useEffect(() => { if (zustaendigStart && !e.zustaendig) setE(x => ({ ...x, zustaendig: zustaendigStart })); }, [zustaendigStart, e.zustaendig]);
  // Beim Phasenwechsel nach oben (am Handy sonst mitten in der Seite).
  useEffect(() => { oben.current?.scrollIntoView?.({ block: 'start' }); }, [phase]);

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

  // ── Kennen wir schon? — bei jeder Eingabe (billig genug für ein paar hundert Personen) ──
  const treffer = useMemo(() => kenntWirSchon({ vorname: f.vorname, nachname: f.nachname, firma: f.firma, email: emailNormal(f.email) ?? f.email, telefon: f.telefon, mobil: f.mobil }, kontakte), [f.vorname, f.nachname, f.firma, f.email, f.telefon, f.mobil, kontakte]);
  const starkOffen = !e.vorhandenId && !e.neuErzwingen && treffer.some(t => !t.gesperrt && (t.staerke === 'mail' || t.staerke === 'telefon' || t.staerke === 'name-firma'));
  const gewaehlt = e.vorhandenId ? kontakte.find(k => k.id === e.vorhandenId) : undefined;

  // ── Firma ──
  const firmen = api.crm?.stand.firmen ?? KEINE_FIRMEN;
  const vorschlaege = useMemo(() => (leer(f.firma) || e.vorhandenId ? [] : firmaVorschlaege(f.firma ?? '', firmen)), [f.firma, firmen, e.vorhandenId]);
  const exakt = vorschlaege.find(v => v.exakt)?.firma;
  const firmaVerknuepft = !e.firmaNeu && (e.firmaId ? firmen.find(x => x.id === e.firmaId) : exakt);

  // Kommende Events (für „Zu Make.One einladen“): nicht das heutige, nicht abgesagt.
  const kommende = useMemo(() => (api.crm?.stand.events ?? []).filter(ev => ev.id !== wahl?.eventId && ev.datum >= heute && (ev.status === 'idee' || ev.status === 'geplant' || ev.status === 'einladung')).sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 8), [api.crm, wahl?.eventId, heute]);
  const nachnameOk = !leer(f.nachname) || !!e.vorhandenId;
  const weiter1 = () => {
    if (!wahl) { setFehler('Bitte oben zuerst „Heute bei“ wählen.'); return; }
    if (!nachnameOk) { setFehler('Der Nachname fehlt — bitte eintragen.'); return; }
    if (!felderOk) { setFehler('Bitte die markierten Felder prüfen oder leeren.'); return; }
    if (starkOffen) { setFehler('Diese Person gibt es vielleicht schon — bitte „Diesen nehmen“ oder „Trotzdem neu“ wählen.'); return; }
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
        erfassungId: e.id, erfasstAm: new Date().toISOString(), eventId: wahl.eventId,
        ...(wahl.lokal ? { eventNeu: { titel: wahl.titel, datum: wahl.datum, ...(wahl.ort ? { ort: wahl.ort } : {}) } } : {}),
        kontakt: k,
        ...(e.vorhandenId ? { vorhandenKontaktId: e.vorhandenId } : {}), ...(e.neuErzwingen ? { neuErzwingen: true } : {}),
        ...(!e.vorhandenId && !e.firmaNeu && (e.firmaId || exakt) ? { firmaId: e.firmaId ?? exakt!.id } : {}),
        bilder: e.fotos.map(x => ({ name: x.name, typ: x.typ, daten: x.daten })),
        ...(e.aufnahme ? { sprachnotiz: { typ: e.aufnahme.typ, daten: await dateiAlsBase64(e.aufnahme.blob), ...(e.aufnahme.dauerSek ? { dauerSek: e.aufnahme.dauerSek } : {}) } } : {}),
        schritt: sch, ...(e.info.trim() ? { info: e.info.trim() } : {}), zustaendig: e.zustaendig,
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

  return (
    <div ref={oben} style={{ display: 'grid', gap: 16, scrollMarginTop: 70 }}>
      {phase !== 'fertig' && (
        <ol aria-label="Fortschritt" style={{ display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
          {punkte.map((p, i) => (
            <li key={p} aria-current={i === phaseNr ? 'step' : undefined} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', padding: '9px 2px', borderRadius: 10, whiteSpace: 'nowrap', color: i === phaseNr ? C.aktiv : i < phaseNr ? C.inkDim : C.inkLeise, background: i === phaseNr ? C.aktivSanft : 'rgba(255,255,255,.03)' }}>{i + 1} · {p}</li>
          ))}
        </ol>
      )}

      {phase === 'karte' && (
        <>
          {/* Fotos */}
          <section aria-label="Visitenkarte" style={{ display: 'grid', gap: 10 }}>
            <input ref={kamera} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={x => { const d = x.target.files?.[0]; x.target.value = ''; void fotoDazu(d); }} />
            <input ref={galerie} type="file" accept="image/*" tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={x => { const d = x.target.files?.[0]; x.target.value = ''; void fotoDazu(d); }} />
            {e.fotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                {e.fotos.map((x, i) => (
                  <div key={x.id} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setGross(x)} aria-label={`Foto ${i + 1} vergrößern`} className="fassbar" style={{ display: 'block', width: '100%', padding: 0, border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, overflow: 'hidden', background: '#000', cursor: 'zoom-in' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.dataUrl} alt={`Visitenkarte, Foto ${i + 1}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'contain', background: '#000' }} />
                    </button>
                    <button type="button" onClick={() => fotoWeg(x.id)} aria-label={`Foto ${i + 1} löschen`} style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {e.fotos.length === 0 && <Gross ton="haupt" onClick={() => kamera.current?.click()}><span aria-hidden>📷</span> Visitenkarte fotografieren</Gross>}
            {e.fotos.length === 1 && !e.rueckseiteWeg && (
              <div style={{ display: 'grid', gap: 8 }}>
                <Gross onClick={() => kamera.current?.click()}>Rückseite fotografieren</Gross>
                <Gross onClick={() => up({ rueckseiteWeg: true })} kleinerAbstand>Überspringen</Gross>
              </div>
            )}
            {e.fotos.length >= 1 && (e.fotos.length > 1 || e.rueckseiteWeg) && e.fotos.length < MAX_BILDER && <Gross onClick={() => kamera.current?.click()} kleinerAbstand>+ weiteres Foto</Gross>}
            {e.fotos.length === 0 && <button type="button" onClick={() => galerie.current?.click()} style={{ background: 'none', border: 'none', color: C.inkDim, fontSize: 14, textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>oder ein Foto aus der Mediathek wählen</button>}
            {fotoFehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fotoFehler}</Hinweis>}
            <div style={{ fontSize: 13, color: C.inkLeise, lineHeight: 1.5 }}>Die Fotos werden verkleinert und verschlüsselt an der Person abgelegt. Die Felder trägst du von Hand ein — das automatische Auslesen kommt später.</div>
          </section>

          {/* Felder */}
          <section aria-label="Angaben zur Person" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <Feldzeile label="Vorname"><input value={f.vorname ?? ''} onChange={x => feld({ vorname: x.target.value })} autoComplete="off" autoCapitalize="words" style={eingabe} aria-label="Vorname" /></Feldzeile>
              <Feldzeile label="Nachname *"><input value={f.nachname ?? ''} onChange={x => feld({ nachname: x.target.value })} autoComplete="off" autoCapitalize="words" style={eingabe} aria-label="Nachname" /></Feldzeile>
            </div>

            {/* Kennen wir schon? */}
            {gewaehlt ? (
              <Hinweis farbe={LEUCHT.gut} rolle="status">
                <b>✓ Ich nehme {anzeigename(gewaehlt)}</b>{gewaehlt.firma ? ` · ${gewaehlt.firma}` : ''} — diese Person gibt es schon. Karte, Info und nächster Schritt hängen an ihr; die eingetragenen Felder ändern sie nicht.
                <div style={{ marginTop: 10 }}><Gross onClick={() => up({ vorhandenId: undefined })} kleinerAbstand>Doch neu anlegen</Gross></div>
              </Hinweis>
            ) : treffer.length > 0 && !e.neuErzwingen ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {treffer.map(t => {
                  const x = kennenText(t, nameVon);
                  return (
                    <Hinweis key={t.kontakt.id} farbe={t.gesperrt ? LEUCHT.kritisch : LEUCHT.achtung} rolle="status">
                      {t.gesperrt ? (
                        <><b>{x.name}</b> gibt es schon, ist aber eingeschränkt (Art. 18) — die Verarbeitung ist gesperrt, bitte nicht erfassen.</>
                      ) : (
                        <>
                          <b>Kennen wir schon:</b> {x.name}{x.firma ? ` · ${x.firma}` : ''} · zuständig {x.zustaendig}{x.zuletzt ? ` · zuletzt ${tagText(x.zuletzt)}` : ''}
                          <div style={{ fontSize: 13, color: C.inkDim, marginTop: 2 }}>({t.grund})</div>
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
            {e.neuErzwingen && !gewaehlt && treffer.length > 0 && <div style={{ fontSize: 13, color: C.inkLeise }}>Als neue Person erfasst, obwohl es ähnliche gibt. <button type="button" onClick={() => up({ neuErzwingen: false })} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', minHeight: 44 }}>Treffer wieder zeigen</button></div>}

            <Feldzeile label="Firma">
              <input value={f.firma ?? ''} onChange={x => { feld({ firma: x.target.value }); up({ firmaId: undefined, firmaNeu: false }); }} autoComplete="off" autoCapitalize="words" style={eingabe} aria-label="Firma" />
            </Feldzeile>
            {!leer(f.firma) && !e.vorhandenId && (
              <div style={{ display: 'grid', gap: 8 }}>
                {firmaVerknuepft ? (
                  <Hinweis farbe={LEUCHT.gut}>✓ Bestehende Firma: <b>{firmaVerknuepft.name}</b>. <button type="button" onClick={() => up({ firmaNeu: true, firmaId: undefined })} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 14, textDecoration: 'underline', minHeight: 44 }}>Stattdessen neue anlegen</button></Hinweis>
                ) : (
                  <>
                    {vorschlaege.filter(v => !v.exakt).map(v => <Gross key={v.firma.id} onClick={() => { feld({ firma: v.firma.name }); up({ firmaId: v.firma.id, firmaNeu: false }); }} kleinerAbstand>Bestehende Firma nehmen: {v.firma.name}</Gross>)}
                    <div style={{ fontSize: 13, color: C.inkLeise }}>{e.firmaNeu || !vorschlaege.length ? `Neue Firma „${f.firma!.trim()}“ wird angelegt.` : `Oder neue Firma „${f.firma!.trim()}“ anlegen (so lassen).`}</div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <Feldzeile label="Position"><input value={f.position ?? ''} onChange={x => feld({ position: x.target.value })} autoComplete="off" style={eingabe} aria-label="Position" /></Feldzeile>
              <Feldzeile label="E-Mail" fehler={mailFehler}><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.email ?? ''} onChange={x => feld({ email: x.target.value })} style={eingabe} aria-label="E-Mail" /></Feldzeile>
              <Feldzeile label="Telefon" fehler={telFehler}><input type="tel" inputMode="tel" value={f.telefon ?? ''} onChange={x => feld({ telefon: x.target.value })} style={eingabe} aria-label="Telefon" /></Feldzeile>
              <Feldzeile label="Handy" fehler={mobilFehler}><input type="tel" inputMode="tel" value={f.mobil ?? ''} onChange={x => feld({ mobil: x.target.value })} style={eingabe} aria-label="Handy" /></Feldzeile>
              <Feldzeile label="Webseite" fehler={webFehler}><input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.webseite ?? ''} onChange={x => feld({ webseite: x.target.value })} style={eingabe} aria-label="Webseite" /></Feldzeile>
            </div>
            <div>
              <Wahl klein an={mehr} onClick={() => setMehr(m => !m)}>{mehr ? 'Weniger' : 'Mehr: Anschrift, LinkedIn'}</Wahl>
              {mehr && (
                <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                  <Feldzeile label="Anschrift (optional)"><textarea value={f.anschrift ?? ''} onChange={x => feld({ anschrift: x.target.value })} rows={3} autoComplete="off" style={{ ...eingabe, resize: 'vertical' }} aria-label="Anschrift" /></Feldzeile>
                  <Feldzeile label="LinkedIn (optional)" fehler={linkFehler}><input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={f.linkedin ?? ''} onChange={x => feld({ linkedin: x.target.value })} style={eingabe} aria-label="LinkedIn" /></Feldzeile>
                </div>
              )}
            </div>
            <div>
              <Beschriftung>Anrede</Beschriftung>
              <div style={{ display: 'flex', gap: 8 }}>
                <Wahl an={f.anrede === 'Du'} onClick={() => feld({ anrede: 'Du' })}>Du</Wahl>
                <Wahl an={f.anrede === 'Sie'} onClick={() => feld({ anrede: 'Sie' })}>Sie</Wahl>
              </div>
            </div>
          </section>

          {!wahl && <Hinweis farbe={LEUCHT.achtung} rolle="alert">Bitte oben zuerst „Heute bei“ wählen — damit die Person dem Event zugeordnet wird.</Hinweis>}
          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
          <Gross ton="haupt" onClick={weiter1}>Weiter: nächster Schritt</Gross>
          {offline && <div style={{ fontSize: 13, color: C.inkLeise }}>Kein Netz erkannt — du kannst trotzdem erfassen, alles wird gesendet, sobald Netz da ist. „Kennen wir schon?“ prüft dann nur, was zuletzt geladen wurde.</div>}
        </>
      )}

      {phase === 'schritt' && (
        <>
          <section aria-label="Nächster Schritt" style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ ...kopfStil, fontSize: 18 }}>Nächster Schritt <span style={{ color: LEUCHT.achtung }}>*</span></h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {SCHRITTE.map(s => <Wahl key={s.id} an={sch === s.id} onClick={() => up({ schritt: s.id })}>{s.label}</Wahl>)}
            </div>
            {sch && <div style={{ fontSize: 13, color: C.inkDim }}>{SCHRITTE.find(s => s.id === sch)!.kurz}.</div>}
          </section>

          <section aria-label="Zuständig" style={{ display: 'grid', gap: 8 }}>
            <Beschriftung>Wer ist zuständig?</Beschriftung>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[...personen].sort((a, b) => Number(b.id === ich) - Number(a.id === ich)).map(p => <Wahl key={p.id} an={e.zustaendig === p.id} onClick={() => up({ zustaendig: p.id, ...(sch === 'termin' ? { termin: { ...e.termin, start: '' } } : {}) })}>{p.name}{p.id === ich ? ' (ich)' : ''}</Wahl>)}
              {!personen.length && <span style={{ fontSize: 14, color: C.inkLeise }}>Personen werden geladen …</span>}
            </div>
            {e.zustaendig && e.zustaendig !== ich && <div style={{ fontSize: 13, color: C.inkDim }}>{nameVon(e.zustaendig)} bekommt eine Meldung{sch === 'termin' ? ' mit dem Termin' : ''} und sieht es beim nächsten Öffnen.</div>}
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
              <div style={{ fontSize: 13, color: C.inkDim }}>Fällig am {e.followupFaellig ? tagText(e.followupFaellig) : '—'} bei {nameVon(e.zustaendig)}.</div>
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
            <Beschriftung rechts={`${e.info.length}/${INFO_MAX}`}>Info zum Gespräch</Beschriftung>
            <textarea value={e.info} onChange={x => up({ info: x.target.value })} rows={5} placeholder="Worüber habt ihr gesprochen? Was wurde zugesagt?" style={{ ...eingabe, resize: 'vertical', minHeight: 120 }} aria-label="Info zum Gespräch" />
            <div style={{ fontSize: 13, color: C.inkDim }}><span aria-hidden>🎤</span> Diktieren über die Tastatur — am iPhone das Mikrofon-Symbol unten rechts auf der Tastatur antippen.</div>
            <Sprachnotiz wert={e.aufnahme} onWert={a => up({ aufnahme: a })} />
          </section>

          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'grid', gap: 8 }}>
            <Gross ton="haupt" onClick={weiter2}>Weiter: bestätigen</Gross>
            <Gross onClick={() => { setPhase('karte'); setFehler(null); }} kleinerAbstand>Zurück</Gross>
          </div>
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
              <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 120px) 1fr', gap: 12, padding: '11px 14px', borderTop: i ? '1px solid rgba(255,255,255,.06)' : undefined, fontSize: 15, lineHeight: 1.45 }}>
                <span style={{ color: C.inkLeise, fontSize: 13 }}>{k}</span><span style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{v}</span>
              </div>
            ))}
          </section>
          {!e.vorhandenId && <Hinweis>Quelle „{NETZWERKEN_QUELLE}“ · <b>keine Werbe-Einwilligung</b> — {KEINE_EINWILLIGUNG}. Die Danke-Mail liegt ab morgen als Entwurf bereit; verschickt wird nur per Klick.</Hinweis>}
          {offline && <Hinweis farbe={LEUCHT.achtung}>Kein Netz erkannt — die Erfassung bleibt auf dem Gerät und wird gesendet, sobald Netz da ist.</Hinweis>}
          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'grid', gap: 8 }}>
            <Gross ton="gut" onClick={() => void speichern()} aus={speichert}>{speichert ? 'Speichert …' : '✓ Bestätigen und speichern'}</Gross>
            <Gross onClick={() => { setPhase('schritt'); setFehler(null); }} kleinerAbstand>Zurück</Gross>
          </div>
        </>
      )}

      {phase === 'fertig' && gesendetId && <Fertig id={gesendetId} warte={warte} onNochEine={nochEine} onBericht={onBericht} />}

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

/** Nach dem Speichern: was gerade passiert — gesendet, wartet aufs Netz oder abgelehnt. */
function Fertig({ id, warte, onNochEine, onBericht }: { id: string; warte: Warte; onNochEine: () => void; onBericht: () => void }) {
  const e = warte.eintraege.find(x => x.id === id);
  const a = warte.antworten[id];
  const wartet = e?.status === 'wartet';
  const fehlt = e?.status === 'fehler';
  return (
    <section aria-label="Gespeichert" style={{ display: 'grid', gap: 14 }}>
      {!e ? (
        <Hinweis farbe={LEUCHT.gut} rolle="status"><b style={{ fontSize: 17 }}>✓ Gespeichert</b>
          {a?.zusammengefuehrt ? <div style={{ marginTop: 6 }}>Die Person gab es schon — die Erfassung hängt an der bestehenden.</div> : null}
          {(a?.hinweise ?? []).map((h, i) => <div key={i} style={{ marginTop: 6, color: C.inkDim }}>{h}</div>)}
        </Hinweis>
      ) : fehlt ? (
        <Hinweis farbe={LEUCHT.achtung} rolle="alert"><b>Noch nicht ganz gespeichert.</b><div style={{ marginTop: 6 }}>{e.hinweis}</div></Hinweis>
      ) : (
        <Hinweis farbe={LEUCHT.achtung} rolle="status"><b style={{ fontSize: 17 }}>Auf dem Gerät gespeichert</b><div style={{ marginTop: 6 }}>{warte.laeuft ? 'Wird gerade gesendet …' : (e.hinweis ?? 'Wird gesendet, sobald Netz da ist.')}</div>{warte.neuLaden && <div style={{ marginTop: 6 }}>MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Erfassung bleibt auf dem Gerät.</div>}</Hinweis>
      )}
      {fehlt && e && <div style={{ display: 'grid', gap: 8 }}><Gross ton="haupt" onClick={() => void warte.erneut(e.id)}>Erneut versuchen</Gross><Gross onClick={() => void warte.verwerfen(e.id)} kleinerAbstand>Verwerfen</Gross></div>}
      {!wartet && !fehlt && a?.kontaktId && <Link href={WEG.akte(a.kontaktId)} className="fassbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: ZIEL, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', color: C.ink, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>Zur Person ›</Link>}
      {!wartet && !fehlt && a?.angebotId && <Link href={WEG.angebot({ angebotId: a.angebotId })} className="fassbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: ZIEL, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', color: C.ink, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>Angebots-Entwurf öffnen ›</Link>}
      <Gross ton="haupt" onClick={onNochEine}>Nächste Karte</Gross>
      <Gross onClick={onBericht} kleinerAbstand>Heute erfasst ansehen</Gross>
    </section>
  );
}
