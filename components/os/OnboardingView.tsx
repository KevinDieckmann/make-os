'use client';

// ─── MAKE OS — Onboarding „Einrichtung“ ─────────────────────────────────────
// Kevin 08.10. spät: „Ein komplettes Onboarding mit Erklärung, sodass wir alles wirklich sauber verbinden können. Auch alle Zahlen,
// Daten, Fakten sollen sauber rein.“ Paket B0 (ONBOARDING_PLAN.md A5) + Nachbesserung nach der Gegenprüfung (08.10. spät):
//   · Die Übersicht zeigt JEDER Person alle IHRE Schritte (eigene + gemeinsame, bei Inhabern die Instanz) — nach dem Ablauf (R1):
//     Samstag-Kern zuerst (offener Freitag davor), dann „einzeln bis 16.10.“, darin in Etappen-Reihenfolge.
//   · B1 (09.10.): Ebenen statt Namen — die Seiten /os/onboarding/{ich,gemeinsam,instanz} sind Filter je Ebene (`EbeneView`); die Instanz
//     zeigt ihre Schritte nur Inhabern (jedem Inhaber). Die früheren Seiten mit Personen-Kennungen leiten in next.config.mjs weiter.
//   · Ein roter Befund schlägt jedes Häkchen; Schritte mit `bestaetigen` brauchen Prüfung UND Häkchen; alte Häkchen zählen nie
//     („früher abgehakt — bitte bestätigen“). Die Anleitung bleibt bei erledigten Schritten aufklappbar.
// Daten aus /api/onboarding; Inhaber-Schritte und Privat-Schritte prüft der Server (403) — die Oberfläche zeigt es nur an.
// Update 2 (16.10., B4/B10): oben „Nächster Schritt“ mit Anleitung und Fortschritt je Ebene; je Schritt Voraussetzungen („erst …“), worauf
// er wartet und welche Zahl er einträgt (Datenkarte) — alles nur über `fortschrittVon`/`istFertig`/`offeneVoraussetzungen` (keine zweite
// Fertig-Regel). Fällt ein schon einmal grüner Schritt zurück, steht oben „braucht dich“ (`zurueckgefallen`, dieselbe Regel wie auf Heute).
// Rundgang 09.10.: Ablauf, Gruppen, Etappen, Datenkarte und Schritt-Texte mit Daten der gewachsenen Instanz (Upload-Tage, Stichtag, „eure
// Entscheidung vom …“) nur mit Altbestand (`Kontext.altbestand`, der Server entscheidet) — sonst die neutrale Fassung (`ablaufFuer`,
// `gruppenFuer`, `etappenFuer`, `datenkarteFuer`, `texteFuer`). Fertig-Regel und Prüfungen bleiben unverändert.
// Neustart (09.10.): trägt die Instanz die Marke (`ich.neustart`, der Server entscheidet), kommen Etappen, Gruppen, Ablauf und die Fassung jedes
// Schritts aus dem Neustart (`schritteFuer`/`schritteDerEbene` mit Kontext); gezählt wird dann alles außer Optionalem (`alle`), der Kern steht
// eigens darunter. Der Schritt „Plan Business online“ trägt seinen Knopf (`BusinessOnlineVorlage`).

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import {
  EBENEN, ablaufFuer, datenkarteFuer, ebeneMitId, etappenFuer, fortschrittVon, gruppeVon, gruppenFuer, istFertig, offeneVoraussetzungen, schrittFuer, schritteDerEbene,
  restzeitText, schritteFuer, sichtbarFuer, texteFuer, werText, zurueckgefallen, type Ebene, type Gruppe, type Kontext, type PruefBefund, type Schritt,
} from '@/lib/make-one/onboarding-data';
import { BusinessOnlineVorlage } from './BusinessOnlineVorlage';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Chip, Hinweis, HakenZiel, Knopf, Leerzustand, Fortschritt as FortschrittBalken, LEUCHT } from './ui';

const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
const absatz: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: 0 };
const stark: CSSProperties = { color: C.ink, fontWeight: 600, textDecoration: 'none' };

export interface Zustand { erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, PruefBefund>; frueher: string[]; gruen: Record<string, string>; ich: Kontext | null }
const LEER: Zustand = { erledigt: {}, befunde: {}, frueher: [], gruen: {}, ich: null };
/** Gestaffeltes Erscheinen (70 ms je Karte): weiter unten nicht länger warten. */
const MAX_I = 6;

export function useOnboarding() {
  const [z, setZ] = useState<Zustand | null>(null);
  const [meldung, setMeldung] = useState('');

  const laden = useCallback(() => {
    fetch('/api/onboarding', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d) { setMeldung(d?.error ?? d?.fehler ?? 'Der Stand der Einrichtung ließ sich nicht laden — bitte gleich noch einmal öffnen.'); setZ(LEER); return; }
        setZ({ erledigt: d.erledigt ?? {}, befunde: d.befunde ?? {}, frueher: d.frueher ?? [], gruen: d.gruen ?? {}, ich: d.ich ?? null });
      })
      .catch(() => { setMeldung('Keine Verbindung — der Stand der Einrichtung ließ sich nicht laden.'); setZ(LEER); });
  }, []);
  useEffect(laden, [laden]);

  const haken = useCallback(async (id: string, an: boolean) => {
    // Sofort sichtbar, dann geschrieben; der Server antwortet mit dem gültigen Stand (oder einem Grund — dann zurück).
    setMeldung('');
    setZ(alt => alt ? {
      ...alt,
      erledigt: an ? { ...alt.erledigt, [id]: { at: new Date().toISOString(), von: 'dir' } } : Object.fromEntries(Object.entries(alt.erledigt).filter(([k]) => k !== id)),
    } : alt);
    try {
      const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, an }), keepalive: true });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.erledigt) setZ(alt => (alt ? { ...alt, erledigt: d.erledigt, frueher: d.frueher ?? alt.frueher } : alt));
      else { setMeldung(d?.error ?? 'Nicht gespeichert.'); laden(); }
    } catch { setMeldung('Nicht gespeichert — offline?'); laden(); }
  }, [laden]);

  return { z, haken, laden, meldung };
}


/** Fortschritt einer Schrittliste: „12/20 · noch 45 Min.“ mit Balken (Späteres und Optionales zählt erst, wenn getan — mit `alle` zählt Späteres mit). */
export function Fortschritt({ schritte, z, gross, alle }: { schritte: readonly Schritt[]; z: Zustand | null; gross?: boolean; alle?: boolean }) {
  const f = fortschrittVon(schritte, z, { alle });
  const anteil = f.gesamt ? f.fertig / f.gesamt : 0;
  const fertig = f.gesamt > 0 && f.fertig === f.gesamt;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: gross ? 'clamp(28px,4vw,36px)' : TYP.zahl, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: fertig ? LEUCHT.gut : C.ink, fontVariantNumeric: 'tabular-nums' }}>
          {f.fertig}<span style={{ color: C.inkLeise, fontWeight: 400 }}>/{f.gesamt}</span>
        </span>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{fertig ? 'fertig' : `noch ${restzeitText(f.offeneMinuten)}`}</span>
      </div>
      <FortschrittBalken anteil={anteil} farbe={fertig ? LEUCHT.gut : LEUCHT.schlaf} />
    </div>
  );
}

/** Der Haken: automatisch geprüft = Anzeige; von Hand (auch „Prüfung + Bestätigung“) = Haken (44 px); fremder Inhaber-Schritt = gesperrt. */
function SchrittHaken({ s, fertig, hand, automatisch, darf, onKlick }: { s: Schritt; fertig: boolean; hand: boolean; automatisch: boolean; darf: boolean; onKlick: () => void }) {
  if (automatisch || !darf) {
    return (
      <span title={automatisch ? 'Das prüft die Software selbst' : 'Diesen Schritt hakt nur der Inhaber ab'} aria-label={`${s.titel} ${fertig ? 'erledigt' : 'offen'}`}
        style={{ width: 44, height: 44, flex: '0 0 auto', display: 'grid', placeItems: 'center' }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', boxSizing: 'border-box', border: `2px solid ${fertig ? LEUCHT.gut : C.inkLeise}`, background: fertig ? `${LEUCHT.gut}33` : 'transparent', color: LEUCHT.gut, fontSize: 13, fontWeight: 800, opacity: darf || fertig ? 1 : 0.5 }}>{fertig ? '✓' : ''}</span>
      </span>
    );
  }
  return <HakenZiel an={hand} onChange={onKlick} farbe={C.inkLeise} label={s.titel} />;
}

/** Was zu tun ist — offen ausgeklappt, bei erledigten Schritten aufklappbar (die Anleitung geht nie verloren). */
function Anleitung({ s }: { s: Schritt }) {
  return (
    <>
      <p style={absatz}>{s.warum}</p>
      <ol style={{ margin: '8px 0 0', paddingLeft: 17 }}>
        {s.wie.map((w, i) => <li key={i} style={{ ...absatz, marginBottom: 3 }}>{w}</li>)}
      </ol>
      {s.befehl && (
        <pre style={{ margin: '9px 0 0', padding: '9px 11px', background: 'rgba(255,255,255,.05)', borderRadius: 9, fontFamily: SCHRIFT.mono, fontSize: TYP.bedien, color: LEUCHT.geld, overflowX: 'auto', whiteSpace: 'pre' }}>{s.befehl}</pre>
      )}
      {s.danach && <p style={{ ...absatz, marginTop: 8 }}><span style={stark}>Danach: </span>{s.danach}</p>}
    </>
  );
}

/** Farbe eines Befunds: grün getan, gedämpft „nichts zu prüfen“, sonst Achtung. */
const befundFarbe = (b: PruefBefund) => (b.erfuellt ? LEUCHT.gut : b.leer ? C.inkLeise : LEUCHT.achtung);

/**
 * Hinweise eines Schritts (B4): offene Voraussetzungen („erst 3.6 · 0-Punkt“, nur über `offeneVoraussetzungen` → `istFertig`), worauf er
 * wartet, und welche Zahlen der Datenkarte er einträgt. Nichts davon sperrt — es sind Hinweise.
 */
function SchrittHinweise({ s, z }: { s: Schritt; z: Zustand | null }) {
  const offen = offeneVoraussetzungen(s, z?.ich ?? null, z).map(v => texteFuer(v, z?.ich));
  const karte = datenkarteFuer(!!z?.ich?.altbestand);
  const orte = (s.datenOrt ?? []).map(id => karte.find(d => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
  if (!offen.length && !s.wartetAuf && !orte.length) return null;
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
      {offen.length > 0 && <p style={{ ...absatz, color: LEUCHT.achtung }}>Erst: {offen.map(v => `${v.nr} · ${v.titel}${!schrittFuer(v, z?.ich ?? null) ? ' (Inhaber)' : ''}`).join(' · ')}</p>}
      {s.wartetAuf && <p style={absatz}><span style={stark}>Wartet auf: </span>{s.wartetAuf}</p>}
      {orte.map(d => <p key={d.id} style={absatz}><span style={{ color: LEUCHT.gut }}>Hier tragt ihr ein: </span>{d.fakt}{d.nicht !== '–' && <><span style={{ color: LEUCHT.achtung }}> · nicht: </span>{d.nicht}</>}</p>)}
    </div>
  );
}

/** Eine Schritt-Zeile. Funktion statt Komponente — sonst baut React sie bei jedem Klick neu auf. `laden` holt den Stand nach einer Aktion neu. */
function schrittZeile(roh: Schritt, z: Zustand | null, haken: (id: string, an: boolean) => void, mitWann: boolean, laden?: () => void) {
  const s = texteFuer(roh, z?.ich);
  const befund = s.pruefung ? z?.befunde[s.pruefung] : undefined;
  // Ein „leerer“ Befund (nichts zu prüfen) lässt das Häkchen entscheiden — dann ist der Haken klickbar.
  const automatisch = !!befund && !befund.leer && !s.bestaetigen;
  const hand = !!z?.erledigt[s.id];
  const fertig = istFertig(s, z);
  const darf = !s.nurInhaber || !!z?.ich?.inhaber;
  const wann = hand ? z?.erledigt[s.id] : undefined;
  const frueher = !fertig && !hand && !!z?.frueher.includes(s.id);
  return (
    <div key={s.id} style={{ opacity: fertig ? 0.72 : 1 }}>
      <Zeile umbrechen
        links={<SchrittHaken s={s} fertig={fertig} hand={hand} automatisch={automatisch} darf={darf} onKlick={() => haken(s.id, !hand)} />}
        titel={<><span style={{ color: C.inkLeise, fontWeight: 400 }}>{s.nr} · </span><span style={{ color: fertig ? C.inkDim : C.ink, textDecoration: fertig ? 'line-through' : 'none' }}>{s.titel}</span></>}
        rechts={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip farbe={s.ebene === 'ich' ? LEUCHT.schlaf : s.nurInhaber ? LEUCHT.puls : LEUCHT.beziehung}>{werText(s)}</Chip>
            {mitWann && <Chip farbe={C.inkLeise}>{gruppenFuer(!!z?.ich?.altbestand, !!z?.ich?.neustart)[gruppeVon(s)].titel}</Chip>}
            {s.optional && <Chip farbe={C.inkLeise}>optional</Chip>}
            {frueher && <Chip farbe={LEUCHT.achtung}>früher abgehakt — bitte bestätigen</Chip>}
            {befund && <Chip umbrechen farbe={befundFarbe(befund)}>{befund.erfuellt ? '✓ ' : befund.leer ? '○ ' : '◇ '}{befund.wert}</Chip>}
            {!!z?.gruen[s.id] && befund && !befund.erfuellt && !befund.leer && <Chip farbe={LEUCHT.kritisch}>war schon grün — braucht dich</Chip>}
            {s.bestaetigen && befund?.erfuellt && !hand && <Chip farbe={LEUCHT.achtung}>noch bestätigen</Chip>}
            <Chip farbe={C.inkLeise}>{s.minuten} Min.</Chip>
          </div>
        } />
      <div style={{ padding: '2px 2px 14px 54px' }}>
        {fertig
          ? <details><summary style={{ ...absatz, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Anleitung</summary><Anleitung s={s} /></details>
          : <Anleitung s={s} />}
        {!fertig && <SchrittHinweise s={s} z={z} />}
        {s.id === 'business-online' && <BusinessOnlineVorlage onFertig={laden} />}
        {(s.wo || wann) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: fertig ? 0 : 8, fontSize: TYP.bedien, color: C.inkLeise }}>
            {s.wo && <Link href={s.wo.href} style={link}>{s.wo.label} ›</Link>}
            {wann && <span>abgehakt von {wann.von}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Schritte nach Etappen gruppiert — mit Satz und den Hinweisen der Etappe (entschieden, aber noch nicht gebaut). */
/** `hinweise`: ja/nein — oder die Etappen, deren Hinweise schon weiter oben standen (dort nicht noch einmal). */
function NachEtappen({ schritte, z, haken, laden, start, mitWann = false, hinweise = true }: { schritte: readonly Schritt[]; z: Zustand | null; haken: (id: string, an: boolean) => void; laden?: () => void; start: number; mitWann?: boolean; hinweise?: boolean | ReadonlySet<number> }) {
  const etappen = etappenFuer(!!z?.ich?.altbestand, !!z?.ich?.neustart).filter(e => schritte.some(s => s.etappe === e.nr));
  return (
    <>
      {etappen.map((e, i) => {
        const liste = schritte.filter(s => s.etappe === e.nr);
        const fertig = liste.filter(s => istFertig(s, z)).length;
        return (
          <Karte key={e.nr} i={Math.min(start + i, MAX_I)}>
            <Ueberschrift rechts={`${fertig} von ${liste.length}`}>{`Etappe ${e.nr} · ${e.titel}`}</Ueberschrift>
            <p style={{ ...absatz, marginBottom: 10 }}>{e.satz}</p>
            {(typeof hinweise === 'boolean' ? hinweise : !hinweise.has(e.nr)) && (e.hinweise ?? []).map(h => (
              <div key={h.titel} style={{ marginBottom: 10 }}><Hinweis art="info" titel={`${h.titel} — ${h.wann}`}>{h.satz}</Hinweis></div>
            ))}
            {e.datenkarte && <p style={{ ...absatz, marginBottom: 10 }}>Welche Zahl wohin gehört, steht in der <Link href="/os/onboarding#datenkarte" style={stark}>Datenkarte ›</Link></p>}
            <Liste>{liste.map(s => schrittZeile(s, z, haken, mitWann, laden))}</Liste>
          </Karte>
        );
      })}
    </>
  );
}

/** Die Datenkarte (ONBOARDING_PLAN.md A3): je Fakt EIN Eingabeort. `altbestand`: mit den Daten der gewachsenen Instanz (sonst neutral). */
export function DatenkarteKarte({ i, altbestand = false }: { i: number; altbestand?: boolean }) {
  const DATENKARTE = datenkarteFuer(altbestand);
  return (
    <Karte i={i} id="datenkarte">
      <Ueberschrift rechts={`${DATENKARTE.length} Fakten`}>Datenkarte — welche Zahl wohin</Ueberschrift>
      <p style={{ ...absatz, marginBottom: 10 }}>Jede Zahl hat genau einen Eingabeort. Wo es heute noch einen zweiten gibt, steht er rechts — dort nicht (noch einmal) pflegen.</p>
      <Liste>
        {DATENKARTE.map(d => (
          <Zeile key={d.fakt} umbrechen titel={d.fakt}
            unter={<span><span style={{ color: LEUCHT.gut }}>hier: </span>{d.href ? <Link href={d.href} style={{ color: C.ink, textDecoration: 'none' }}>{d.hier} ›</Link> : d.hier}{d.nicht !== '–' && <><span style={{ color: LEUCHT.achtung }}> · nicht: </span>{d.nicht}</>}</span>} />
        ))}
      </Liste>
    </Karte>
  );
}

function Meldung({ text }: { text: string }) {
  return text ? <Hinweis art="achtung" rolle="alert">{text}</Hinweis> : null;
}

/**
 * Die Schritte einer Ebene, die diese Person auf der Ebenen-Seite sieht: „Meine Einrichtung“ und Instanz genau wie in der Übersicht
 * (`schrittFuer` — Rolle, eingeladen, Zahl der Konten); „Gemeinsam“ alle sichtbaren (auch die, die nur ein Inhaber abhakt — alle sehen
 * den Stand). Rein, aus dem Konto — nie ein Name.
 */
export function schritteAufEbene(ebene: Ebene, ich: Kontext | null): Schritt[] {
  return schritteDerEbene(ebene, ich).filter(s => (ebene === 'gemeinsam' ? sichtbarFuer(s, ich) && !(s.nurMitMehreren && ich && ich.personen < 2) : schrittFuer(s, ich)));
}

export function EbeneView({ ebene }: { ebene: Ebene }) {
  const { z, haken, laden, meldung } = useOnboarding();
  const meta = ebeneMitId(ebene)!;
  const ich = z?.ich ?? null;
  // Instanz: nur Inhaber (jeder Inhaber). Die Schrittliste ist nichts Geheimes — die Prüfungen filtert ohnehin der Server
  // (andere sehen nur „Instanz eingerichtet: ja/nein“); hier zeigt die Seite Nicht-Inhabern nur den Hinweis.
  const gesperrt = !!meta.nurInhaber && !!z && !ich?.inhaber;
  const schritte = gesperrt ? [] : schritteAufEbene(ebene, ich);
  const alle = !!ich?.neustart;
  const f = fortschrittVon(schritte, z, { alle });
  const namen = gruppenFuer(!!ich?.altbestand, alle);
  const weiter = [{ id: 'alles', titel: 'Einrichtung — alle deine Schritte', satz: `${namen.freitag.titel.split(' · ')[0]}, ${namen.samstag.titel} und „${namen.spaeter.titel}“ in der richtigen Reihenfolge.`, href: '/os/onboarding' },
    ...EBENEN.filter(e => e.id !== ebene && (!e.nurInhaber || !!ich?.inhaber))];
  return (
    <Seite titel={meta.titel} unter={meta.satz} rechts={<Knopf leise href="/os/onboarding">Einrichtung ›</Knopf>}>
      <Meldung text={meldung} />
      {gesperrt ? (
        <Karte i={0}>
          <Leerzustand symbol="⚙" titel="Das richten die Inhaber ein" aktion={<Knopf href="/os/onboarding">Zur Einrichtung</Knopf>}>Server, Sicherheit und Einstellungen der Instanz pflegen die Inhaber. Ob die Instanz eingerichtet ist, siehst du in deiner Einrichtung.</Leerzustand>
        </Karte>
      ) : (
        <>
          <Karte i={0} ton={LEUCHT.schlaf}>
            <Ueberschrift farbe={LEUCHT.schlaf} rechts={`${f.fertig} von ${f.gesamt}`}>Stand</Ueberschrift>
            <Fortschritt schritte={schritte} z={z} gross alle={alle} />
            {f.naechster && <NaechsterSchritt s={f.naechster} z={z} laden={laden} />}
            <p style={{ ...absatz, marginTop: 12 }}>
              Ein Filter auf die Einrichtung. {ebene === 'ich' ? 'Prüfung und Häkchen gelten immer der Person, die gerade angemeldet ist. ' : ebene === 'gemeinsam' ? 'Eine Person trägt ein, alle sehen den Stand; Schritte mit „Inhaber“ hakt ein Inhaber ab. ' : ''}
              Den ganzen Ablauf in der richtigen Reihenfolge zeigt die <Link href="/os/onboarding" style={stark}>Einrichtung ›</Link>
            </p>
          </Karte>
          <NachEtappen schritte={schritte} z={z} haken={haken} laden={laden} start={1} mitWann />
          {ebene === 'gemeinsam' && <DatenkarteKarte i={MAX_I} altbestand={!!ich?.altbestand} />}
        </>
      )}
      <Karte i={MAX_I}>
        <Ueberschrift>Weiter</Ueberschrift>
        <Liste>
          {weiter.map(s => (
            <Link key={s.id} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile onClick={() => {}} titel={s.titel} unter={s.satz} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}

/** Reihenfolge der Abschnitte: offener Freitag zuerst (er ist dran), sonst der Samstag zuerst; „einzeln“ immer zuletzt. */
function abschnitte(meine: readonly Schritt[], z: Zustand | null): Gruppe[] {
  const freitagOffen = meine.some(s => gruppeVon(s) === 'freitag' && !istFertig(s, z));
  const reihe: Gruppe[] = freitagOffen ? ['freitag', 'samstag', 'spaeter'] : ['samstag', 'freitag', 'spaeter'];
  return reihe.filter(g => meine.some(s => gruppeVon(s) === g));
}

/**
 * B10: Schritte, die schon einmal grün waren und jetzt rot sind („braucht dich“) — dieselbe Regel `zurueckgefallen` wie die Karte auf Heute.
 * Ohne solche Schritte keine Karte.
 */
function BrauchtDich({ schritte, z }: { schritte: readonly Schritt[]; z: Zustand | null }) {
  const zurueck = zurueckgefallen(schritte, z).map(s => texteFuer(s, z?.ich));
  if (!zurueck.length) return null;
  return (
    <Hinweis art="kritisch" rolle="status" titel={zurueck.length === 1 ? '1 Punkt braucht dich' : `${zurueck.length} Punkte brauchen dich`}>
      War schon eingerichtet und ist zurückgefallen:{' '}
      {zurueck.map((s, i) => <span key={s.id}>{i > 0 && ' · '}{s.wo ? <Link href={s.wo.href} style={stark}>{s.nr} · {s.titel}</Link> : <strong style={stark}>{s.nr} · {s.titel}</strong>}{s.pruefung && z?.befunde[s.pruefung] ? ` (${z.befunde[s.pruefung].wert})` : ''}</span>)}
    </Hinweis>
  );
}

/** B4: der nächste Schritt oben — mit Anleitung, Ort und den Hinweisen (über `fortschrittVon`, keine eigene Reihenfolge). */
function NaechsterSchritt({ s: roh, z, laden }: { s: Schritt; z: Zustand | null; laden?: () => void }) {
  const s = texteFuer(roh, z?.ich);
  const befund = s.pruefung ? z?.befunde[s.pruefung] : undefined;
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.linie}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ ...absatz, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: TYP.mikro }}>Nächster Schritt</span>
        <Chip farbe={s.ebene === 'ich' ? LEUCHT.schlaf : s.nurInhaber ? LEUCHT.puls : LEUCHT.beziehung}>{werText(s)}</Chip>
        <Chip farbe={C.inkLeise}>{s.minuten} Min.</Chip>
        {befund && <Chip umbrechen farbe={befundFarbe(befund)}>{befund.wert}</Chip>}
      </div>
      <div style={{ fontSize: TYP.titel, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{s.nr} · {s.titel}</div>
      <Anleitung s={s} />
      <SchrittHinweise s={s} z={z} />
      {s.id === 'business-online' ? <BusinessOnlineVorlage onFertig={laden} /> : s.wo && <div style={{ marginTop: 12 }}><Knopf href={s.wo.href}>{s.wo.label} ›</Knopf></div>}
    </div>
  );
}

/** Fortschritt je Ebene (B4) — dieselbe Auswahl wie die Ebenen-Seiten (`schritteAufEbene`). */
function EbenenStand({ z }: { z: Zustand | null }) {
  const ebenen = EBENEN.filter(e => !e.nurInhaber || !!z?.ich?.inhaber);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14, marginTop: 14 }}>
      {ebenen.map(e => (
        <Link key={e.id} href={e.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', minHeight: 44 }}>
          <div style={{ ...absatz, color: C.ink, fontWeight: 600, marginBottom: 6 }}>{e.titel} ›</div>
          <Fortschritt schritte={schritteAufEbene(e.id, z?.ich ?? null)} z={z} alle={!!z?.ich?.neustart} />
        </Link>
      ))}
    </div>
  );
}

export function OnboardingUebersicht() {
  const { z, haken, laden, meldung } = useOnboarding();
  const meine = schritteFuer(z?.ich ?? null);
  // Neustart: alles außer Optionalem zählt sofort (wie die Karte auf Heute); der Kern steht eigens darunter.
  const neustart = !!z?.ich?.neustart;
  const f = fortschrittVon(meine, z, { alle: neustart });
  const gruppen = abschnitte(meine, z);
  const alt = !!z?.ich?.altbestand;
  const namen = gruppenFuer(alt, neustart);
  const kern = meine.filter(s => gruppeVon(s) === 'samstag');
  return (
    <Seite titel="Einrichtung" unter="Alles verbinden und eure echten Zahlen eintragen — Schritt für Schritt, mit Erklärung.">
      <Meldung text={meldung} />
      <BrauchtDich schritte={meine} z={z} />
      <Karte i={0} ton={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={`${f.fertig} von ${f.gesamt} Schritten`}>Dein Stand</Ueberschrift>
        <Fortschritt schritte={meine} z={z} gross alle={neustart} />
        {neustart && kern.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...absatz, color: C.ink, fontWeight: 600, marginBottom: 6 }}>{namen.samstag.titel}</div>
            <Fortschritt schritte={kern} z={z} />
          </div>
        )}
        <EbenenStand z={z} />
        {f.naechster && <NaechsterSchritt s={f.naechster} z={z} laden={laden} />}
        <p style={{ ...absatz, marginTop: 12 }}>
          Gezählt werden deine Schritte („Meine Einrichtung“), die gemeinsamen{z?.ich?.inhaber ? ' und — als Inhaber — die der Instanz' : ''}{neustart
            ? `: alles außer Optionalem, auch „${namen.spaeter.titel}“ — die Karte auf Heute bleibt, bis alles steht. „${namen.samstag.titel}“ steht eigens darüber.`
            : `, für „${namen.freitag.titel}“ und „${namen.samstag.titel}“. „${namen.spaeter.titel}“ und Optionales zählt erst, wenn es getan ist.`}
          {' '}Vieles prüft die Software selbst; ein roter Befund schlägt jedes Häkchen.
          Wie weit die Daten insgesamt sind, zeigt die <Link href="/os/datenbasis" style={stark}>Datenbasis ›</Link>
        </p>
      </Karte>

      <Karte i={1}>
        <Ueberschrift>So läuft die Einrichtung</Ueberschrift>
        <Liste>{ablaufFuer(alt, neustart).map(a => <Zeile key={a.wann} umbrechen titel={a.wann} unter={a.was} />)}</Liste>
        <p style={{ ...absatz, marginTop: 10 }}>
          Drei Ebenen: <strong style={stark}>Instanz</strong> (Server und Einstellungen — nur die Inhaber), <strong style={stark}>Gemeinsam</strong> (Haushalt und
          Firmen — alle sehen den Stand) und <strong style={stark}>Meine Einrichtung</strong> (jede Person für sich). Prüfungen zeigen nur ja/nein oder Zähler — nie
          Werte. Nichts geht ohne euren Klick nach außen; Schritte am Server zeigen nur den Befehl, nie einen Wert.
        </p>
      </Karte>

      {gruppen.map((g, gi) => {
        const liste = meine.filter(s => gruppeVon(s) === g);
        const fertig = liste.filter(s => istFertig(s, z)).length;
        // Hinweise einer Etappe nur einmal: im Neustart in der ersten Gruppe, in der die Etappe vorkommt; sonst nie unter „später“.
        const frueher = new Set(meine.filter(s => gruppen.indexOf(gruppeVon(s)) < gi).map(s => s.etappe));
        return (
          <div key={g} style={{ display: 'contents' }}>
            <Karte i={Math.min(2 + gi, MAX_I)} flach>
              <Ueberschrift rechts={`${fertig} von ${liste.length}`}>{namen[g].titel}</Ueberschrift>
              <p style={absatz}>{namen[g].satz}</p>
            </Karte>
            <NachEtappen schritte={liste} z={z} haken={haken} laden={laden} start={3 + gi} hinweise={neustart ? frueher : g !== 'spaeter'} />
          </div>
        );
      })}

      <Karte i={MAX_I} flach>
        <Ueberschrift>Nach Ebenen</Ueberschrift>
        <p style={{ ...absatz, marginBottom: 10 }}>Dieselben Schritte als Filter — die Regeln fürs Nebeneinander stehen unter <Link href="/os/onboarding/zusammenarbeit" style={stark}>Zusammenarbeit</Link>.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(268px, 100%), 1fr))', gap: 14 }}>
          {EBENEN.filter(e => !e.nurInhaber || !!z?.ich?.inhaber).map(e => (
            <Link key={e.id} href={e.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <Karte i={MAX_I} style={{ height: '100%' }}>
                <Ueberschrift rechts={<span>›</span>}>{e.titel}</Ueberschrift>
                <p style={{ ...absatz, margin: '0 0 12px' }}>{e.satz}</p>
                <Fortschritt schritte={schritteAufEbene(e.id, z?.ich ?? null)} z={z} />
              </Karte>
            </Link>
          ))}
        </div>
      </Karte>
      <DatenkarteKarte i={MAX_I} altbestand={alt} />
    </Seite>
  );
}
