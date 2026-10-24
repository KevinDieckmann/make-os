'use client';

// ─── Prozesse · Überführung — Karte im Steckbrief des System-Prozesses und Band in der Werkstatt (22.10., Paket Ü) ──────────────────────────────────────────
// Entscheidung 22.10. (Plan-Seite abgenommen): „Fünf davon ziehen echt in die Werkstatt um: zuerst ein paar Tage im Schatten neben dem alten Code, umgeschaltet wird erst, wenn beide dasselbe tun.
// Hältst du einen überführten Prozess an, läuft der alte Weg wieder.“
//   · `UeberfuehrungKarte` (System-Prozess der festen Liste): was umziehen kann, wie es steht, „In die Werkstatt überführen“ (nur volle Mitglieder — der Server
//     prüft noch einmal), danach der Weg in die Werkstatt.
//   · `UeberfuehrungBand` (Werkstatt-Prozess mit `ersetzt`): wen er ersetzt, welcher Weg gerade arbeitet, der Schatten-Vergleich (nur Zahlen und Kennungen),
//     „Umschalten“ (erst ab N gleichen Läufen / M Tagen — mit Rückfrage) und „Zurück in den Schatten“. Anhalten = der Status „pausiert“ (Steuerung daneben).
// Rechnet nichts selbst — Regeln und Zahlen kommen vom Server (lib/prozesse/ueberfuehrung*.ts). Design-Standard: Bausteine aus `../ui`.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Undo2, Workflow } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Eigenschaft, Knopf, Chip, Hinweis } from '../ui';
import { WEG } from '@/lib/wege';
import { neueKennung } from '@/lib/kennung';
import { ABWEICHUNG_TEXT, STAND_MARKE, STAND_TEXT, ZUSATZ_ART_TEXT, type UeberfuehrungAnsicht, type UeberfuehrungStand } from '@/lib/prozesse/ueberfuehrung';
import type { ProzessDef } from '@/lib/prozesse/typen';
import { werkstattSenden } from './werkstatt-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const STAND_FARBE: Readonly<Record<UeberfuehrungStand, string>> = { moeglich: C.inkDim, schatten: C.aktiv, scharf: C.gut, angehalten: C.achtung };
const tagText = (t: string | undefined) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.` : '');

/** Steckbrief eines System-Prozesses: der Teil, der umziehen kann, und „In die Werkstatt überführen“. */
export function UeberfuehrungKarte({ p, recht, onGeaendert }: { p: ProzessDef; recht: boolean; onGeaendert: () => Promise<void> | void }) {
  const router = useRouter();
  const [anfrageId] = useState(() => neueKennung('pzu'));
  const [fehler, setFehler] = useState<string | null>(null);
  const u = p.ueberfuehrung;
  if (!u || u.rolle !== 'alt') return null;
  const ueberfuehren = async () => {
    setFehler(null);
    const r = await werkstattSenden(() => ({ aktion: 'ueberfuehren', sp: p.id, anfrageId }));
    const id = typeof r.j?.prozessId === 'string' ? r.j.prozessId : null;
    await onGeaendert();
    if ((r.status === 200 || r.status === 409) && id) { router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' }), { scroll: false }); return; }
    setFehler(String(r.j?.fehler ?? 'Das ließ sich nicht überführen.'));
  };
  return (
    <Karte flach>
      <Ueberschrift rechts={<Chip farbe={STAND_FARBE[u.stand]}>{STAND_MARKE[u.stand] ?? 'möglich'}</Chip>}>In die Werkstatt</Ueberschrift>
      <Eigenschaft label="Teil">{u.teil}</Eigenschaft>
      <p style={klein}>{u.satz}</p>
      {u.zusatz && <Eigenschaft label="Neu gegenüber dem alten Weg">{u.zusatz}</Eigenschaft>}
      {u.stand === 'moeglich' ? (
        <>
          <p style={klein}>Zuerst ein paar Tage im Schatten neben dem alten Code — umgeschaltet wird per Klick, wenn beide dasselbe tun. Hältst du den Prozess an, arbeitet wieder der alte Weg.</p>
          {recht
            ? <Knopf haupt onClick={ueberfuehren} titel="Legt einen Prozess in der Werkstatt an (Probelauf, Phase Schatten) — der alte Weg arbeitet weiter"><span className="pz-knopf-inhalt"><Workflow size={15} aria-hidden />In die Werkstatt überführen</span></Knopf>
            : <p style={{ ...klein, color: C.inkLeise }}>Überführen dürfen volle Mitglieder des Haushalts.</p>}
        </>
      ) : (
        <>
          <p style={klein}>{STAND_TEXT[u.stand]}</p>
          {u.prozessId && <Knopf leise href={WEG.prozesse({ p: u.prozessId, ansicht: 'werkstatt' })}>{`„${u.titel ?? 'Prozess'}“ in der Werkstatt öffnen ›`}</Knopf>}
        </>
      )}
      <p style={{ ...klein, color: C.inkLeise }}>Die Stellschrauben darunter gelten für beide Wege — der feste Schritt liest dieselben Werte (eine Wahrheit, keine Kopie).</p>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
    </Karte>
  );
}

/**
 * Werkstatt: das Band eines Prozesses, der einen System-Ablauf ersetzt. `stand()` = Stand des Eintrags aus der letzten Antwort (409 bei fremder Änderung),
 * `darf` = volle Mitglieder (Umschalten, Zurück), `onGeaendert` lädt Eintrag und Läufe neu.
 */
export function UeberfuehrungBand({ prozessId, a, darf, stand, onGeaendert }: { prozessId: string; a: UeberfuehrungAnsicht; darf: boolean; stand: () => string; onGeaendert: () => Promise<void> | void }) {
  const [frage, setFrage] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const senden = async (aktion: 'umschalten' | 'ueberfuehrung-zurueck') => {
    setMeldung(null);
    const r = await werkstattSenden(() => ({ aktion, id: prozessId, stand: stand() }));
    setFrage(false);
    if (r.status === 200 && r.j?.ok) {
      setMeldung({ art: 'gut', text: aktion === 'umschalten' ? 'Umgeschaltet — jetzt arbeitet der neue Weg; der alte ruht, bis du anhältst oder zurückschaltest.' : 'Zurück im Schatten — der alte Weg arbeitet, der Vergleich zählt neu.' });
      await onGeaendert();
      return;
    }
    setMeldung({ art: 'kritisch', text: String(r.j?.fehler ?? 'Das ging nicht.') });
    if (r.status === 409) await onGeaendert();
  };
  const v = a.vergleich;
  return (
    <Karte flach className="pz-ue-band">
      <Ueberschrift rechts={<Chip farbe={STAND_FARBE[a.stand]}>{STAND_MARKE[a.stand] ?? ''}</Chip>}>{`Ersetzt „${a.spTitel}“ · ${a.teil}`}</Ueberschrift>
      <p style={klein}>{`${STAND_TEXT[a.stand]}. ${a.arbeitet === 'neu' ? 'Hältst du den Prozess an, arbeitet wieder der alte Weg.' : ''}`}</p>
      {a.phase === 'schatten' && (
        <>
          <Eigenschaft label="Schatten-Vergleich">
            {v.laeufe ? `${v.laeufe} ${v.laeufe === 1 ? 'Lauf' : 'Läufe'} verglichen · ${v.gleich} gleich · ${v.abweichend} abweichend` : 'noch kein Tag verglichen'}
            {v.gleichLaeufe ? ` · in Folge gleich: ${v.gleichLaeufe}${v.gleichSeit ? ` seit ${tagText(v.gleichSeit)}` : ''}` : ''}
          </Eigenschaft>
          {a.heute && <Eigenschaft label="Heute">{`alter Weg ${a.heute.alt ? '✓' : '—'} · neuer Weg ${a.heute.neu ? '✓' : '—'} (zählt, sobald der Tag vorbei ist)`}</Eigenschaft>}
          {v.letzte && <Eigenschaft label="Letzte Abweichung">{`${tagText(v.letzte.tag)}: ${ABWEICHUNG_TEXT[v.letzte.grund]}${v.letzte.felder?.length ? ` (${v.letzte.felder.join(', ')})` : ''}${v.letzte.kennungen.length ? ` — ${v.letzte.kennungen.join(', ')}` : ''}`}</Eigenschaft>}
          <p style={klein}>{a.umschalten.erlaubt ? `Gleich seit ${a.umschalten.laeufe} Läufen über ${a.umschalten.tage} Tage — du kannst umschalten.` : a.umschalten.grund}</p>
        </>
      )}
      {a.phase === 'scharf' && a.umgeschaltetAm && <Eigenschaft label="Umgeschaltet">{tagText(a.umgeschaltetAm.slice(0, 10))}</Eigenschaft>}
      {a.zusatz && (
        // Ausbau (24.10., Paket Ü 2): was neu ist gegenüber dem alten Weg — nicht im Vergleich; im Schatten nur gezählt, scharf läuft es mit.
        <Eigenschaft label="Neu gegenüber dem alten Weg">
          {a.zusatz.satz}
          {a.zusatz.zaehler?.wirkungen ? ` Im Schatten bisher: ${Object.entries(a.zusatz.zaehler.arten).map(([k, n]) => `${n} ${ZUSATZ_ART_TEXT[k] ?? k}`).join(', ')}${a.zusatz.zaehler.zuletzt ? ` (zuletzt ${tagText(a.zusatz.zaehler.zuletzt)})` : ''} — nichts davon angelegt.` : a.phase === 'schatten' ? ' Im Schatten noch nichts gezählt.' : ''}
        </Eigenschaft>
      )}
      <p style={{ ...klein, color: C.inkLeise }}>{`Dieselben Kennungen wie der Code: ${a.kennung}. ${a.bleibt}`}</p>
      {darf && a.phase === 'schatten' && !frage && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf aus={!a.umschalten.erlaubt} onClick={() => setFrage(true)} titel={a.umschalten.erlaubt ? 'Danach arbeitet der neue Weg, der alte ruht' : a.umschalten.grund}>
            <span className="pz-knopf-inhalt"><ArrowRightLeft size={14} aria-hidden />Umschalten</span>
          </Knopf>
        </div>
      )}
      {frage && (
        <Hinweis art="achtung" titel="Jetzt umschalten?" aktion={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}><Knopf onClick={() => senden('umschalten')}>Ja, umschalten</Knopf><Knopf leise onClick={() => setFrage(false)}>Abbrechen</Knopf></span>}>
          Ab jetzt arbeitet dieser Prozess, der alte Weg im Code ruht. Hältst du ihn an oder schaltest zurück, arbeitet sofort wieder der alte Weg — dieselben Kennungen, nichts doppelt.
        </Hinweis>
      )}
      {darf && a.phase === 'scharf' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf leise onClick={() => senden('ueberfuehrung-zurueck')} titel="Der alte Weg arbeitet wieder, dieser Prozess rechnet nur mit"><span className="pz-knopf-inhalt"><Undo2 size={14} aria-hidden />Zurück in den Schatten</span></Knopf>
        </div>
      )}
      {!darf && <p style={{ ...klein, color: C.inkLeise }}>Umschalten und zurückschalten dürfen volle Mitglieder des Haushalts.</p>}
      {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'gut' ? 'status' : 'alert'}>{meldung.text}</Hinweis>}
    </Karte>
  );
}
