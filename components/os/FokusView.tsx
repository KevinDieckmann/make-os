'use client';

// ─── MAKE OS — Fokus: die Steuerungsseite (24.09., neu gebaut 10.10.) ───────────────────────────────────────────────────────────
// Entscheidung 10.10.: „Fokus und Kompass zusammenlegen und bei Planung rausnehmen — Planung soll nur Planung sein. Prio und Fokus geben
// wir im Fokus-Bereich. Den Fokus-Bereich oben rechts aufbauen. Dort auch das Thema Zeit — Privat wie Business einzeln, ausgebaut auf die
// spezifischen Themen. Eine riesige Steuerungsseite: was und wie wir etwas machen wollen, welche Zeit wir dafür reingeben wollen und wo der
// Fokus draufgeht.“ Einstieg: der Fokus-Knopf oben rechts im Kopf. Die Seite folgt dem Kopf-Schalter Privat · Business (Konto „nur
// Business“: immer Business) — und zeigt in Business NIE Privat-Themen, in Privat nie Business-Themen; gefiltert wird auf dem Server
// (Fokus-Tafel, /api/fokus/steuerung, /api/scores?sicht=, /api/state/zeit*?sicht=).
// Abschnitte (Klappbar, Anker #<abschnitt>, offen/zu je Browser gemerkt):
//   Fokus        — Unser Fokus · Mein Fokus je Horizont (FokusTafel, fester Bereich), darunter die Lichtfäden des Bereichs
//   Prioritäten  — die Themen des Bereichs: Rang, Gewicht, Zeit-Quellen (früher Kompass: Reihenfolge und Säulen-Regler)
//   Zeit         — je Thema Soll (h/Woche) gegen Ist (7 Tage) mit der Ampel „Fokus und Zeit passen (nicht) zusammen“, dazu
//                  Business: Zeit je Einheit, Fokus-Blöcke, Zeit je Mandat · Privat: Fokus-Blöcke (und die Arbeit der Privat-Einheiten)
//   Wirkung      — der Score des Bereichs (früher die Seite „Wachstum“)
//   Tagesform    — nur Privat
//   Wie wir arbeiten — nur Privat (Kompass-Bestand gehört zum Bereich Privat): Lage, Regler, eigene Filter, Stichworte, Bezeichnungen
// Hauptaktion: „Fokus starten“ (Thema wählen) bzw. die laufende Uhr mit „Beenden“ — derselbe Zähler wie im Kopf.

import { useEffect, useState } from 'react';
import { Square, Timer } from 'lucide-react';
import { FARBE as C, TYP, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { useSpace } from '@/hooks/useSpace';
import { gemerkterFokus, fokusFuerThema, FOKUS_EREIGNIS, type LaufenderFokus } from '@/lib/zeitmessung/fokus-laufend';
import { einheitAusGesellschaft, PRIVAT_GESELLSCHAFTEN, privatArbeitsEinheit } from '@/lib/einheiten';
import type { FokusAbschnitt } from '@/lib/wege';
import type { SteuerBereich } from '@/lib/fokus/steuerung';
import { Seite, Karte, Ueberschrift, Klappbar, Knopf, Hinweis, Leer, Reiter, auswahl, useRueckfrage } from './ui';
import { ZeitJeEinheitKarte, FokusBloeckeKarte } from './zeit/ZeitJeEinheit';
import { ZeitJeMandatKarte } from './zeit/ZeitJeMandat';
import { fokusBeenden, uhr } from './zeit/fokus-beenden';
import { Lichtfaeden } from './lichtfaeden/Lichtfaeden';
import { FokusTafel } from './planung/FokusTafel';
import { useNurBusiness } from './useInhaber';
import { useSteuerung } from './fokus/useSteuerung';
import { Prioritaeten } from './fokus/Prioritaeten';
import { ZeitSteuerung } from './fokus/ZeitSteuerung';
import { Wirkung } from './fokus/Wirkung';
import { Tagesform } from './fokus/Tagesform';
import { WieWirArbeiten } from './fokus/WieWirArbeiten';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';

/** Die Abschnitte je Bereich — Tagesform und „Wie wir arbeiten“ gibt es nur in Privat. */
const ABSCHNITTE: Record<SteuerBereich, { id: FokusAbschnitt; label: string }[]> = {
  privat: [
    { id: 'fokus', label: 'Fokus' }, { id: 'prioritaeten', label: 'Prioritäten' }, { id: 'zeit', label: 'Zeit' }, { id: 'wirkung', label: 'Wirkung' },
    { id: 'tagesform', label: 'Tagesform' }, { id: 'arbeiten', label: 'Wie wir arbeiten' },
  ],
  business: [{ id: 'fokus', label: 'Fokus' }, { id: 'prioritaeten', label: 'Prioritäten' }, { id: 'zeit', label: 'Zeit' }, { id: 'wirkung', label: 'Wirkung' }],
};
/** Zugeklappt, solange niemand sie öffnet: die Feineinstellungen. */
const VORGABE_ZU: readonly FokusAbschnitt[] = ['arbeiten'];
const MERKER = 'make-fokus-abschnitte';
/** Gibt es Privat-Einheiten, deren Zeit Arbeit ist (unsere Instanz: die Selbstständigkeit)? Dann zeigt Privat auch deren Zeit je Einheit. */
const PRIVAT_ARBEIT = PRIVAT_GESELLSCHAFTEN.some(g => !!privatArbeitsEinheit(g));

function useOffen(): [Record<string, boolean>, (id: string, an?: boolean) => void] {
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { const g = JSON.parse(localStorage.getItem(MERKER) ?? '{}') as Record<string, boolean>; if (g && typeof g === 'object') setOffen(g); } catch { /* egal */ }
  }, []);
  const setzen = (id: string, an?: boolean) => setOffen(o => {
    const aktuell = o[id] ?? !VORGABE_ZU.includes(id as FokusAbschnitt);
    const n = { ...o, [id]: an ?? !aktuell };
    try { localStorage.setItem(MERKER, JSON.stringify(n)); } catch { /* egal */ }
    return n;
  });
  return [offen, setzen];
}

export function FokusView() {
  const { space } = useSpace();
  const nurBusiness = useNurBusiness();
  // Konto „nur Business“: immer Business (der Server lehnt Privat ohnehin ab). Vor dem Lesen des Kontos nichts laden.
  const bereich: SteuerBereich | null = nurBusiness === null ? null : nurBusiness ? 'business' : space;
  const steuerung = useSteuerung(bereich);
  const [offen, setzen] = useOffen();
  const istOffen = (id: FokusAbschnitt) => offen[id] ?? !VORGABE_ZU.includes(id);

  // Ein Anker in der Adresse (#zeit, aus der Leiste eines Widgets oder einer alten Adresse) öffnet seinen Abschnitt.
  useEffect(() => {
    const anker = () => { const h = window.location.hash.slice(1); if (h) setzen(h, true); };
    anker();
    window.addEventListener('hashchange', anker);
    return () => window.removeEventListener('hashchange', anker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bereich) return <Seite titel="Fokus"><Karte><Leer>lädt …</Leer></Karte></Seite>;
  const abschnitte = ABSCHNITTE[bereich];
  const name = bereich === 'privat' ? 'Privat' : 'Business';
  const springen = (id: FokusAbschnitt) => {
    setzen(id, true);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try { history.replaceState(null, '', `#${id}`); } catch { /* egal */ }
  };
  let i = 0;
  return (
    <Seite titel="Fokus" ton={SPACE_FARBE[bereich]}
      unter={`${name}: was wir wollen, welche Zeit wir hineingeben und wo der Fokus draufgeht.`}
      rechts={<FokusStart bereich={bereich} themen={steuerung.sicht?.themen ?? []} />}>
      {/* In der wischbaren Zeile wie überall (Gesamtprüfung 12.10.: ohne sie ragten die Reiter am Handy über den Rand). */}
      <div className="ui-reiter-zeile">
        <Reiter<FokusAbschnitt> ariaLabel="Abschnitte der Fokus-Seite" liste={abschnitte.map(a => ({ id: a.id, label: a.label }))} aktiv={null} onWahl={springen} />
      </div>

      <Klappbar id="fokus" titel="Fokus" offen={istOffen('fokus')} umschalten={() => setzen('fokus')}>
        <Karte i={i++} ton="fokus" netz>
          <Ueberschrift farbe={LEUCHT.planung}>Unser Fokus · Mein Fokus</Ueberschrift>
          {/* Fester Bereich: die Tafel bietet keinen Wechsel an — der Bereich kommt vom Kopf-Schalter. */}
          <FokusTafel bereich={bereich} />
        </Karte>
        {/* Lichtfäden (03.10.): nur die Stränge dieses Bereichs (Wurzel `space:<bereich>`), zuerst die eigenen. */}
        <Lichtfaeden wurzel={`space:${bereich}`} person="ich" titel="Wo alles zusammenläuft" i={i++} />
      </Klappbar>

      <Klappbar id="prioritaeten" titel="Prioritäten" offen={istOffen('prioritaeten')} umschalten={() => setzen('prioritaeten')}>
        {steuerung.sicht ? <Prioritaeten s={steuerung.sicht} themenSetzen={steuerung.themenSetzen} vorgabe={steuerung.vorgabe} i={i++} />
          : <Karte i={i++}>{steuerung.fehler ? <Hinweis art="achtung">{steuerung.fehler}</Hinweis> : <Leer>lädt …</Leer>}</Karte>}
      </Klappbar>

      <Klappbar id="zeit" titel="Zeit" offen={istOffen('zeit')} umschalten={() => setzen('zeit')}>
        {steuerung.sicht ? <ZeitSteuerung s={steuerung.sicht} bereich={bereich} sollSetzen={steuerung.sollSetzen} i={i++} />
          : <Karte i={i++}>{steuerung.fehler ? <Hinweis art="achtung">{steuerung.fehler}</Hinweis> : <Leer>lädt …</Leer>}</Karte>}
        {/* Zeit je Einheit und je Mandat: im Business die Gesellschaften, in Privat nur die Arbeit der Privat-Einheiten — gefiltert auf dem Server (`?sicht=`). */}
        {(bereich === 'business' || PRIVAT_ARBEIT) && <ZeitJeEinheitKarte i={i++} sicht={bereich} />}
        <FokusBloeckeKarte i={i++} sicht={bereich} />
        {bereich === 'business' && <ZeitJeMandatKarte i={i++} sicht={bereich} />}
      </Klappbar>

      <Klappbar id="wirkung" titel="Wirkung" offen={istOffen('wirkung')} umschalten={() => setzen('wirkung')}>
        <Wirkung bereich={bereich} i={i++} />
      </Klappbar>

      {bereich === 'privat' && (
        <Klappbar id="tagesform" titel="Tagesform" offen={istOffen('tagesform')} umschalten={() => setzen('tagesform')}>
          <Tagesform i={i++} />
        </Klappbar>
      )}
      {bereich === 'privat' && (
        <Klappbar id="arbeiten" titel="Wie wir arbeiten" offen={istOffen('arbeiten')} umschalten={() => setzen('arbeiten')}>
          <WieWirArbeiten i={i++} />
        </Klappbar>
      )}
    </Seite>
  );
}

/**
 * Die Hauptaktion: „Fokus starten“ für ein Thema des Bereichs (oder ohne Thema) — läuft schon einer, die Uhr mit „Beenden“ (dieselbe
 * Stelle wie der Knopf im Kopf, components/os/zeit/fokus-beenden.ts). Der Block zählt im Bereich der Seite, nie im anderen.
 */
function FokusStart({ bereich, themen }: { bereich: SteuerBereich; themen: { id: string; label: string; zeit: string[]; einheit?: string }[] }) {
  const [laufend, setLaufend] = useState<LaufenderFokus | null>(null);
  const [jetzt, setJetzt] = useState(0);
  const [wahl, setWahl] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();
  useEffect(() => {
    const lesen = () => { setLaufend(gemerkterFokus()); setJetzt(Date.now()); };
    lesen();
    window.addEventListener(FOKUS_EREIGNIS, lesen);
    return () => window.removeEventListener(FOKUS_EREIGNIS, lesen);
  }, []);
  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [laufend]);
  if (laufend) {
    const sek = Math.max(0, Math.round((jetzt - Date.parse(laufend.von)) / 1000));
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: C.aktiv, boxShadow: `0 0 8px ${C.aktiv}` }} />
          <b style={{ fontFamily: SCHRIFT.display, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{uhr(sek)}</b> {laufend.label}
        </span>
        <Knopf haupt onClick={() => fokusBeenden(laufend, bestaetigen)} ariaLabel={`Fokus „${laufend.label}“ beenden`}><Square size={14} fill="currentColor" strokeWidth={0} /> Beenden</Knopf>
        {dialog}
      </span>
    );
  }
  const starten = () => {
    const t = themen.find(x => x.id === wahl);
    fokusFuerThema(t
      ? { bereich, label: t.label, quelle: t.einheit ? 'fokus' : t.zeit[0], ...(t.einheit ? { einheit: einheitAusGesellschaft(t.einheit) ?? t.einheit } : {}) }
      : { bereich, label: 'Fokus' });
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select value={wahl} onChange={e => setWahl(e.target.value)} aria-label="Wofür Fokus" style={{ ...auswahl, minHeight: 48, width: 'auto', maxWidth: 220 }}>
        <option value="">ohne Thema</option>
        {themen.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <Knopf haupt onClick={starten}><Timer size={16} /> Fokus starten</Knopf>
    </span>
  );
}
