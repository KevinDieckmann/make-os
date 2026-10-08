'use client';

// ─── Gesundheit › Körper: das EIGENE Körper-Profil (08.10. abends, Fragebogen Teil 3, Frage 2) ──────────────────────
// Kevin: „Alles als eigene Daten je Person … Körper-Reiter sieht nur die Person selbst.“ Die Karten zeigen und bearbeiten
// nur das Profil der angemeldeten Person (/api/gesundheit/koerper kennt kein `?fuer=`). In der Ansicht einer anderen
// Person gibt es den Reiter nicht (GesundheitView). Schreiben als kleine Schritte mit Stand (409 → neu geladen).
// Bausteine aus components/os/ui; schlichte Formulare, jede Zeile bearbeiten/entfernen.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { HeartPulse } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Zeile, Chip, Knopf, Leer, Leerzustand, Schalter, Feldzeile, feld, auswahl, LEUCHT } from '../ui';
import {
  KOERPER_GRENZEN as G, KOERPER_TOENE, STUFEN_ZUSTAENDE, TON_NAME, ZUSTAND_NAME, kennzahlLink,
  type KoerperListe, type KoerperOp, type KoerperStand, type KoerperTon,
} from '@/lib/gesundheit/koerper';

// ── Daten ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KoerperZugriff {
  koerper: KoerperStand | null;
  /** Erst nach der ersten Antwort true — vorher weder Leerzustand noch Karten. */
  geladen: boolean;
  fehler: string | null;
  aendern: (ops: KoerperOp[]) => Promise<boolean>;
}

/** Das eigene Profil (nur wenn `aktiv` = eigene Ansicht). Stand aus der letzten Server-Antwort, nie selbst gesetzt. */
export function useKoerper(aktiv: boolean): KoerperZugriff {
  const [koerper, setKoerper] = useState<KoerperStand | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const stand = useRef<string | null>(null);
  const uebernehmen = (d: { koerper?: KoerperStand | null; stand?: string }) => { setKoerper(d.koerper ?? null); stand.current = d.stand ?? null; setGeladen(true); };

  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    fetch('/api/gesundheit/koerper', { cache: 'no-store' }).then(r => r.json()).then(d => { if (lebt && d?.ok) uebernehmen(d); }).catch(() => {});
    return () => { lebt = false; };
  }, [aktiv]);

  const aendern = useCallback(async (ops: KoerperOp[]): Promise<boolean> => {
    setFehler(null);
    try {
      const r = await fetch('/api/gesundheit/koerper', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stand: stand.current, ops }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { uebernehmen(d); return true; }
      if (r.status === 409 && d.konflikt) uebernehmen(d);
      setFehler(d.error ?? d.fehler ?? 'Nicht gespeichert.');
      return false;
    } catch {
      setFehler('Nicht gespeichert — offline?');
      return false;
    }
  }, []);

  return { koerper, geladen, fehler, aendern };
}

// ── Leerzustand ──────────────────────────────────────────────────────────────────────────────────────────────────

export function KoerperLeer({ aendern }: { aendern: KoerperZugriff['aendern'] }) {
  return (
    <Leerzustand symbol={<HeartPulse size={22} />} titel="Noch kein Körper-Profil" ton={LEUCHT.puls}
      aktion={<Knopf haupt voll farbe={LEUCHT.puls} onClick={async () => { await aendern([{ op: 'anlegen' }]); }}>Profil anlegen</Knopf>}>
      Halte fest, was dein Körper gerade braucht: Leitsatz, was Aufmerksamkeit braucht, deine Hebel und den Stufenplan. Nur du siehst es.
    </Leerzustand>
  );
}

// ── Bausteine: ein Textfeld mit Speichern, eine Liste mit Bearbeiten ────────────────────────────────────────────────

function TextFeld({ label, wert, max, lang, leer, onSpeichern }: { label: string; wert: string; max: number; lang?: boolean; leer: string; onSpeichern: (t: string) => Promise<boolean> }) {
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState(wert);
  const zuLang = entwurf.length > max;
  const speichern = async (e?: FormEvent) => { e?.preventDefault(); if (zuLang) return; if (await onSpeichern(entwurf)) setOffen(false); };
  if (!offen) {
    return (
      <Zeile titel={wert.trim() ? wert : <span style={{ color: C.inkLeise }}>{leer}</span>} umbrechen
        rechts={<Knopf leise onClick={() => { setEntwurf(wert); setOffen(true); }} ariaLabel={`${label} bearbeiten`}>Bearbeiten</Knopf>} />
    );
  }
  return (
    <form onSubmit={speichern} style={{ display: 'grid', gap: 10, margin: '6px 0 12px' }}>
      <Feldzeile label={label} fehler={zuLang ? `Höchstens ${max} Zeichen — es wird nichts gekürzt.` : undefined}>
        {lang
          ? <textarea value={entwurf} onChange={e => setEntwurf(e.target.value)} rows={4} style={{ ...feld, resize: 'vertical' }} />
          : <input value={entwurf} onChange={e => setEntwurf(e.target.value)} style={feld} />}
      </Feldzeile>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf typ="submit" aus={zuLang} onClick={async () => { await speichern(); }}>Speichern</Knopf>
        <Knopf leise onClick={() => setOffen(false)}>Abbrechen</Knopf>
      </div>
    </form>
  );
}

interface FeldDef { key: string; label: string; art: 'text' | 'lang' | 'wahl'; max?: number; optionen?: { wert: string; name: string }[]; pflicht?: boolean }

/** Eine Liste des Profils: Zeilen (antippen = bearbeiten), „+ neu“, Formular mit Speichern · Entfernen · Abbrechen. */
function EintragsListe<T extends { id: string }>({ liste, eintraege, felder, zeile, leer, neuLabel, aendern }: {
  liste: KoerperListe; eintraege: T[]; felder: FeldDef[]; leer: string; neuLabel: string;
  zeile: (e: T, bearbeiten: () => void) => ReactNode;
  aendern: KoerperZugriff['aendern'];
}) {
  const [offen, setOffen] = useState<string | null>(null); // Kennung oder 'neu'
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const oeffnen = (e?: T) => {
    const werte: Record<string, string> = {};
    for (const f of felder) werte[f.key] = e ? String((e as unknown as Record<string, unknown>)[f.key] ?? '') : (f.art === 'wahl' && f.pflicht ? f.optionen?.[0]?.wert ?? '' : '');
    setEntwurf(werte);
    setOffen(e ? e.id : 'neu');
  };
  const zuLang = felder.find(f => f.max != null && (entwurf[f.key] ?? '').length > f.max);
  const fehlt = felder.find(f => f.pflicht && !(entwurf[f.key] ?? '').trim());
  const speichern = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (zuLang || fehlt) return;
    const eintrag: Record<string, unknown> = { ...(offen && offen !== 'neu' ? { id: offen } : {}) };
    for (const f of felder) eintrag[f.key] = f.art === 'wahl' && !entwurf[f.key] ? null : entwurf[f.key] ?? '';
    if (await aendern([{ op: 'eintrag', liste, eintrag }])) setOffen(null);
  };
  const entfernen = async () => { if (offen && offen !== 'neu' && await aendern([{ op: 'weg', liste, id: offen }])) setOffen(null); };

  const formular = (
    <form onSubmit={speichern} style={{ display: 'grid', gap: 10, margin: '6px 0 14px' }}>
      {felder.map(f => (
        <Feldzeile key={f.key} label={f.label} fehler={zuLang?.key === f.key ? `Höchstens ${f.max} Zeichen — es wird nichts gekürzt.` : undefined}>
          {f.art === 'lang'
            ? <textarea value={entwurf[f.key] ?? ''} onChange={e => setEntwurf(w => ({ ...w, [f.key]: e.target.value }))} rows={3} style={{ ...feld, resize: 'vertical' }} />
            : f.art === 'wahl'
              ? <select value={entwurf[f.key] ?? ''} onChange={e => setEntwurf(w => ({ ...w, [f.key]: e.target.value }))} style={auswahl}>
                  {!f.pflicht && <option value="">—</option>}
                  {(f.optionen ?? []).map(o => <option key={o.wert} value={o.wert}>{o.name}</option>)}
                </select>
              : <input value={entwurf[f.key] ?? ''} onChange={e => setEntwurf(w => ({ ...w, [f.key]: e.target.value }))} style={feld} />}
        </Feldzeile>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf typ="submit" aus={!!zuLang || !!fehlt} onClick={async () => { await speichern(); }}>Speichern</Knopf>
        {offen !== 'neu' && <Knopf leise farbe={LEUCHT.kritisch} onClick={entfernen}>Entfernen</Knopf>}
        <Knopf leise onClick={() => setOffen(null)}>Abbrechen</Knopf>
      </div>
    </form>
  );

  return (
    <div>
      {!eintraege.length && offen !== 'neu' && <Leer>{leer}</Leer>}
      {eintraege.map(e => <div key={e.id}>{offen === e.id ? formular : zeile(e, () => oeffnen(e))}</div>)}
      {offen === 'neu' ? formular : (
        eintraege.length < G.eintraege && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => oeffnen()}>{neuLabel}</Knopf></div>
      )}
    </div>
  );
}

const tonFarbe = (t: KoerperTon) => (t === 'kritisch' ? LEUCHT.kritisch : t === 'achtung' ? LEUCHT.achtung : LEUCHT.gut);

// ── Die Karten (jede steht in GesundheitView als eigene Kachel) ──────────────────────────────────────────────────

export function ProfilKarte({ k, aendern, zumVerlauf }: { k: KoerperStand; aendern: KoerperZugriff['aendern']; zumVerlauf: () => void }) {
  return (
    <Karte i={1}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={<button onClick={zumVerlauf} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Verlauf ›</button>}>Profil</Ueberschrift>
      <TextFeld label="Leitsatz" wert={k.leitsatz} max={G.leitsatz} leer="Noch kein Leitsatz — ein Satz, woran du dich hältst." onSpeichern={t => aendern([{ op: 'felder', felder: { leitsatz: t } }])} />
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '14px 0 2px' }}>Stufenplan</div>
      <EintragsListe liste="stufen" eintraege={k.stufen} aendern={aendern} leer="Noch kein Stufenplan." neuLabel="+ Stufe"
        felder={[
          { key: 'phase', label: 'Phase', art: 'text', max: G.status },
          { key: 'name', label: 'Name', art: 'text', max: G.name, pflicht: true },
          { key: 'beschreibung', label: 'Beschreibung', art: 'lang', max: G.lang },
          { key: 'zustand', label: 'Zustand', art: 'wahl', pflicht: true, optionen: STUFEN_ZUSTAENDE.map(z => ({ wert: z, name: ZUSTAND_NAME[z] })) },
        ]}
        zeile={(s, bearbeiten) => <Zeile onClick={bearbeiten} links={<span style={{ fontSize: 11, color: C.inkLeise, width: 56, letterSpacing: '.04em', textTransform: 'uppercase', flex: '0 0 auto' }}>{ZUSTAND_NAME[s.zustand]}</span>}
          titel={s.phase ? `${s.phase} · ${s.name}` : s.name} unter={s.beschreibung || undefined} umbrechen />} />
    </Karte>
  );
}

export function BeschwerdenKarte({ k, aendern }: { k: KoerperStand; aendern: KoerperZugriff['aendern'] }) {
  return (
    <Karte i={2}>
      <Ueberschrift farbe={LEUCHT.achtung}>Was Aufmerksamkeit braucht</Ueberschrift>
      <EintragsListe liste="beschwerden" eintraege={k.beschwerden} aendern={aendern} leer="Nichts eingetragen." neuLabel="+ Eintrag"
        felder={[
          { key: 'name', label: 'Name', art: 'text', max: G.name, pflicht: true },
          { key: 'status', label: 'Stand (kurz)', art: 'text', max: G.status },
          { key: 'notiz', label: 'Notiz', art: 'lang', max: G.lang },
          { key: 'ton', label: 'Einschätzung', art: 'wahl', pflicht: true, optionen: KOERPER_TOENE.map(t => ({ wert: t, name: TON_NAME[t] })) },
        ]}
        zeile={(b, bearbeiten) => <Zeile onClick={bearbeiten} titel={b.name} unter={b.notiz || undefined} umbrechen
          rechts={b.status ? <Chip farbe={tonFarbe(b.ton)}>{b.status}</Chip> : undefined} />} />
    </Karte>
  );
}

/** Kennzahl des Gesundheits-Index (live) — für Link und Wert der Hebel. */
export interface IndexKennzahl { id: string; label: string; anzeige: string | null; ampel: string; gemessen: boolean }

export function HebelKarte({ k, aendern, kennzahlen, zumIndex }: { k: KoerperStand; aendern: KoerperZugriff['aendern']; kennzahlen: IndexKennzahl[] | null; zumIndex: () => void }) {
  return (
    <Karte i={3}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<button onClick={zumIndex} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Index ›</button>}>Hebel · live</Ueberschrift>
      <EintragsListe liste="hebel" eintraege={k.hebel} aendern={aendern} leer="Noch keine Hebel." neuLabel="+ Hebel"
        felder={[
          { key: 'name', label: 'Name', art: 'text', max: G.name, pflicht: true },
          { key: 'notiz', label: 'Notiz', art: 'lang', max: G.lang },
          { key: 'kennzahl', label: 'Kennzahl im Gesundheits-Index', art: 'wahl', optionen: (kennzahlen ?? []).map(x => ({ wert: x.id, name: x.label })) },
        ]}
        zeile={(h, bearbeiten) => {
          const kz = h.kennzahl ? kennzahlen?.find(x => x.id === h.kennzahl) : undefined;
          const f = !kz || !kz.gemessen ? C.inkLeise : kz.ampel === 'gruen' ? LEUCHT.gut : kz.ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.kritisch;
          return <Zeile onClick={bearbeiten} titel={h.name} umbrechen
            unter={kz ? (kz.gemessen ? kz.label : `${kz.label} · noch nicht messbar`) : h.notiz || undefined}
            rechts={h.kennzahl
              ? <Link href={kennzahlLink(h.kennzahl)} onClick={e => e.stopPropagation()} style={{ fontWeight: 700, fontSize: 16, color: f, textDecoration: 'none' }} aria-label={`${h.name} im Index öffnen`}>{kz?.gemessen ? kz.anzeige : '—'}</Link>
              : undefined} />;
        }} />
    </Karte>
  );
}

export function ZusammenhaengeKarte({ k, aendern }: { k: KoerperStand; aendern: KoerperZugriff['aendern'] }) {
  return (
    <Karte i={5}>
      <Ueberschrift>Zusammenhänge</Ueberschrift>
      <EintragsListe liste="zusammenhaenge" eintraege={k.zusammenhaenge} aendern={aendern} leer="Noch keine Zusammenhänge — was wirkt worauf?" neuLabel="+ Zusammenhang"
        felder={[{ key: 'text', label: 'Was wirkt worauf', art: 'text', max: G.satz, pflicht: true }]}
        zeile={(z, bearbeiten) => <Zeile onClick={bearbeiten} titel={z.text} umbrechen />} />
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '14px 0 2px' }}>Eigener Hinweis</div>
      <TextFeld label="Eigener Hinweis" wert={k.hinweis} max={G.lang} lang leer="Kein eigener Hinweis." onSpeichern={t => aendern([{ op: 'felder', felder: { hinweis: t } }])} />
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '14px 0 0', lineHeight: 1.5 }}>Struktur und eigene Notizen — keine ärztliche Beratung. Nur du siehst dieses Profil.</p>
    </Karte>
  );
}

/** Was auf „Heute“ erscheint: Symptom-Regler (mit Namen), Zähler „Sauber geblieben“, Sätze unter Routinen. */
export function AnzeigeKarte({ k, aendern, routinen }: { k: KoerperStand; aendern: KoerperZugriff['aendern']; routinen: { id: string; label: string }[] }) {
  const routineName = (id: string) => routinen.find(r => r.id === id)?.label ?? id;
  return (
    <Karte i={6}>
      <Ueberschrift>Anzeige auf „Heute“</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '2px 0 2px' }}>Symptom-Regler (0–10, abends) — ohne Namen kein Regler</div>
      <TextFeld label="Name des Symptoms" wert={k.symptom?.name ?? ''} max={G.name} leer="Kein Symptom-Regler."
        onSpeichern={t => aendern([{ op: 'felder', felder: { symptom: t.trim() ? { name: t } : null } }])} />
      <div style={{ margin: '14px 0' }}>
        <Schalter karte an={k.sauberZaehler} onChange={an => { void aendern([{ op: 'felder', felder: { sauberZaehler: an } }]); }}
          ariaLabel="Zähler „Sauber geblieben“ anzeigen" beschreibung="Tage seit dem letzten Rückfall, abends abhaken.">Zähler „Sauber geblieben“</Schalter>
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '2px 0 2px' }}>Sätze unter Routinen</div>
      <EintragsListe liste="routinenHinweise" eintraege={k.routinenHinweise} aendern={aendern} leer="Keine Sätze unter Routinen." neuLabel="+ Satz"
        felder={[
          { key: 'routine', label: 'Routine', art: 'wahl', pflicht: true, optionen: routinen.map(r => ({ wert: r.id, name: r.label })) },
          { key: 'text', label: 'Satz', art: 'text', max: G.satz, pflicht: true },
        ]}
        zeile={(h, bearbeiten) => <Zeile onClick={bearbeiten} titel={h.text} unter={routineName(h.routine)} umbrechen />} />
    </Karte>
  );
}
