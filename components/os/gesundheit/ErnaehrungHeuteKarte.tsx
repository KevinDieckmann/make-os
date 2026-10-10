'use client';

// ─── Gesundheit/Ernährung: „Essen & Trinken heute“ (09.10.2026) — selbstladend, fürs Handy ────────────────────────────
// Wunsch (Sport-Fragebogen, 09.10.): „gesund & einfach“, NUR Plan, kein Tracking — das Essen soll sich nach den WHOOP-Kalorien richten;
// dazu Ergänzungen und Trinken im Blick. Die Karte zeigt EINEN Satz (heute eher mehr / wie sonst / eher leichter) mit Gründen (Trainingsplan,
// Strain gestern und bisher, Alltagsbewegung über die Schritte), den Ø-Verbrauch der 7 Tage als Orientierung (keine Ziel-Zahl, kein
// Zählen), an Lauftagen den Trink-Hinweis — und die eigenen Ergänzungs-Routinen zum Abhaken. Neue Ergänzung = Vorlage antippen, eigene
// Menge eintragen (MAKE OS empfiehlt keine Menge), anlegen → eine eigene Routine (andere sehen nur „Belegt“).
// Gerechnet auf dem Server (lib/ernaehrung/orientierung.ts über /api/gesundheit/alltag — nur die eigene Person). Ohne Einwilligung (a):
// null (bzw. mit `hinweis` ein Hinweis). Einbinden: `<ErnaehrungHeuteKarte />` (Gesundheit › Heute oder über der Ernährung).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Klappbar, Schalter, HakenZiel, Pillen, Feldzeile, eingabe, LEUCHT } from '../ui';
import { ESSEN_HINWEIS, MENGE_MAX, ergaenzungLabel, type ErgaenzungId } from '@/lib/ernaehrung/orientierung';
import { useAlltag } from './alltag-daten';

const TENDENZ = { mehr: { text: 'eher mehr', farbe: LEUCHT.achtung }, normal: { text: 'wie sonst', farbe: LEUCHT.gut }, weniger: { text: 'eher leichter', farbe: LEUCHT.puls } } as const;
const zahl = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

export function ErnaehrungHeuteKarte({ i = 0, hinweis = false }: { i?: number; hinweis?: boolean }) {
  const { d, ladeFehler, laden, einstellen, abhaken, ergaenzungAnlegen } = useAlltag();
  const [offen, setOffen] = useState(false);
  const [vorlage, setVorlage] = useState<ErgaenzungId | null>(null);
  const [menge, setMenge] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' } | null>(null);
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  // Nach jedem Neuladen gilt der Stand des Servers (ein anderes Gerät kann inzwischen abgehakt haben).
  useEffect(() => { setLokal({}); }, [d]);

  if (!d) {
    if (!ladeFehler) return null;
    return <Karte i={i}><Hinweis art="achtung" aktion={<Knopf leise onClick={() => laden(true)}>Noch einmal laden</Knopf>}>„Essen & Trinken“ ließ sich gerade nicht laden.</Hinweis></Karte>;
  }
  const e = d.sicht?.essen;
  if (!d.einwilligung || !e) {
    if (!hinweis) return null;
    return (
      <Karte i={i}>
        <Ueberschrift farbe={LEUCHT.gut}>Essen & Trinken heute</Ueberschrift>
        <Hinweis art="info" aktion={<Link href="/os/datenschutz#gesundheit" style={{ color: C.ink }}>Zur Einwilligung</Link>}>Die Orientierung rechnet mit deinen WHOOP-Werten (Gesundheitsdaten) — erst nach deiner Einwilligung.</Hinweis>
      </Karte>
    );
  }
  const o = e.orientierung;

  const haken = async (routine: string, an: boolean) => {
    setLokal(l => ({ ...l, [routine]: an }));
    const r = await abhaken(routine, an);
    if (!r.ok) { setLokal(l => ({ ...l, [routine]: !an })); setMeldung({ text: r.fehler ?? 'Nicht gespeichert.', art: 'achtung' }); }
  };
  const anlegen = async () => {
    if (!vorlage) return;
    if (menge.trim().length > MENGE_MAX) { setMeldung({ text: `Höchstens ${MENGE_MAX} Zeichen.`, art: 'achtung' }); return; }
    const r = await ergaenzungAnlegen(vorlage, ergaenzungLabel(vorlage, menge));
    setMeldung(r.ok ? { text: 'Angelegt — steht jetzt auch unter deinen Routinen.', art: 'gut' } : { text: r.fehler ?? 'Nicht angelegt.', art: 'achtung' });
    if (r.ok) { setVorlage(null); setMenge(''); }
  };
  const orientierung = async (an: boolean) => {
    const r = await einstellen([{ op: 'essen', orientierung: an }]);
    if (!r.ok) setMeldung({ text: r.fehler ?? 'Nicht gespeichert.', art: 'achtung' });
  };

  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={o ? <Chip farbe={TENDENZ[o.tendenz].farbe}>{TENDENZ[o.tendenz].text}</Chip> : undefined}>Essen & Trinken heute</Ueberschrift>
      <div style={{ display: 'grid', gap: 14 }}>
        {o && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.titel, lineHeight: 1.3, color: C.ink }}>{o.satz}</div>
            {o.gruende.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{o.gruende.map(g => <Chip key={g} farbe={C.inkDim}>{g}</Chip>)}</div>}
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
              {o.kcal7 !== undefined
                ? <>Dein Verbrauch lag zuletzt bei rund <b style={{ color: C.ink }}>{zahl(o.kcal7)} kcal</b> am Tag{o.kcalGestern !== undefined ? <>, gestern {zahl(o.kcalGestern)} kcal</> : null} (WHOOP).</>
                : 'Ohne WHOOP-Energiewerte (ab 3 Tagen) nur die Orientierung aus Plan und Belastung.'}
            </div>
            {o.trinken && <Hinweis art="info">{o.trinken}</Hinweis>}
          </div>
        )}
        {!o && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Orientierung nach WHOOP ist aus.</div>}

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Ergänzungen & Trinken</div>
          {e.ergaenzungen.map(z => {
            const an = lokal[z.routine] ?? z.erledigt;
            return (
              <div key={z.routine} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderBottom: `1px solid ${RAND.haar}` }}>
                <HakenZiel an={an} onChange={() => void haken(z.routine, !an)} farbe={LEUCHT.gut} label={z.label} />
                <span style={{ fontSize: TYP.body, color: an ? C.inkDim : C.ink, textDecoration: an ? 'line-through' : 'none' }}>{z.label}</span>
              </div>
            );
          })}
          {!e.ergaenzungen.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Noch keine — unten eine Vorlage wählen und deine eigene Menge eintragen.</div>}
        </div>
        {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}

        <Klappbar id="essen-einstellen" titel="Ergänzung hinzufügen · Einstellen" offen={offen} umschalten={() => setOffen(x => !x)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Pillen liste={e.vorlagen.map(v => ({ id: v.id, label: v.label }))} aktiv={vorlage} onWahl={v => setVorlage(v)} farbe={LEUCHT.gut} />
            {vorlage && (
              <form onSubmit={ev => { ev.preventDefault(); void anlegen(); }} style={{ display: 'grid', gap: 10 }}>
                <Feldzeile label={`Deine Menge (${e.vorlagen.find(v => v.id === vorlage)?.hinweis ?? 'frei'})`}>
                  <input value={menge} maxLength={MENGE_MAX} onChange={ev => setMenge(ev.target.value)} style={eingabe} placeholder="frei lassen geht auch" />
                </Feldzeile>
                <Knopf haupt typ="submit" farbe={LEUCHT.gut}>{ergaenzungLabel(vorlage, menge)} anlegen</Knopf>
              </form>
            )}
            <Schalter karte an={e.an} onChange={v => void orientierung(v)} farbe={LEUCHT.gut} beschreibung="Ein Satz am Tag aus deinen WHOOP-Werten und deinem Trainingsplan.">Orientierung nach WHOOP</Schalter>
          </div>
        </Klappbar>
        <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.5 }}>{ESSEN_HINWEIS} MAKE OS empfiehlt keine Mengen.</p>
      </div>
    </Karte>
  );
}
