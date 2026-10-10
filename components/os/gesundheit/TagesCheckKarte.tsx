'use client';

// ─── Gesundheit: Tages-Check „wie im WHOOP-Journal“ (09.10.2026) — selbstladend, 10 Sekunden am Handy ──────────────────
// Die WHOOP-API liefert die Journal-Antworten nicht (research/whoop/FAKTEN_WHOOP.md › 9) — darum fragt MAKE OS selbst: höchstens sechs
// Ja/Nein-Fragen, die die Person wählt (Vorgabe: Koffein spät · Alkohol · genug getrunken · Bildschirm spät · spät gegessen). Vor 14 Uhr
// fragt die Karte nach gestern (Morgen-Check), danach nach heute (Abend-Check). Antworten stehen im EIGENEN Journal (Feld `check`,
// PATCH /api/state/journal) — derselbe Ort wie die drei Abendfragen, kein Bestand daneben. Darunter die Auswertung aus den eigenen
// Tagen (ab 3 Tagen mit und 3 ohne): „An Tagen mit … hattest du im Schnitt … Schlaf“. Einbinden: `<TagesCheckKarte />` (neben „Drei
// Fragen“). Ohne Einwilligung (a): null (bzw. mit `hinweis` ein Hinweis).
// 10.10. (Entscheidung „Nur Anspannung 1–5“): keine Ja/Nein-Frage „Stressiger Tag?“ mehr — Stress steht in der Auswertung aus der Anspannung des
// Morgen-Checks (Befund mit `quelle`); der Hinweis darunter nennt die Quelle.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, ECKE, TIEF, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Klappbar, MehrfachPillen, LEUCHT } from '../ui';
import { CHECK_HINWEIS, ANSPANNUNG_HINWEIS } from '@/lib/gesundheit/tages-check';
import { useAlltag, datumKurz } from './alltag-daten';

function JaNein({ frage, wert, jaGut, onWahl }: { frage: string; wert: boolean | undefined; jaGut?: boolean; onWahl: (w: boolean | null) => void }) {
  const knopf = (w: boolean) => {
    const an = wert === w;
    const farbe = (w === true) === !!jaGut ? LEUCHT.gut : LEUCHT.achtung;
    return (
      <button type="button" aria-pressed={an} onClick={() => onWahl(an ? null : w)} className="fassbar"
        style={{ minWidth: 64, minHeight: 44, padding: '0 14px', borderRadius: ECKE.eingabe, fontSize: TYP.body, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${an ? TIEF.rand(farbe) : RAND.stark}`, background: an ? TIEF.flaeche(farbe) : 'transparent', color: an ? farbe : C.inkDim }}>
        {w ? 'Ja' : 'Nein'}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48, borderBottom: `1px solid ${RAND.haar}` }}>
      <span style={{ fontSize: TYP.body, color: C.ink, minWidth: 0 }}>{frage}</span>
      <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{knopf(true)}{knopf(false)}</span>
    </div>
  );
}

export function TagesCheckKarte({ i = 0, hinweis = false }: { i?: number; hinweis?: boolean }) {
  const { d, ladeFehler, laden, antworten, einstellen } = useAlltag();
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState<string[]>([]);
  // Nur die eigenen, noch nicht vom Server bestätigten Klicks (null = zurückgenommen) — angezeigt wird Server-Stand + diese.
  const [lokal, setLokal] = useState<Record<string, boolean | null>>({});
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' } | null>(null);
  const c = d?.sicht?.check;
  useEffect(() => { if (c) { setWahl(c.fragen.map(f => f.id)); setLokal({}); } }, [c]);

  if (!d) {
    if (!ladeFehler) return null;
    return <Karte i={i}><Hinweis art="achtung" aktion={<Knopf leise onClick={() => laden(true)}>Noch einmal laden</Knopf>}>Der Tages-Check ließ sich gerade nicht laden.</Hinweis></Karte>;
  }
  if (!d.einwilligung || !c) {
    if (!hinweis) return null;
    return (
      <Karte i={i}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Tages-Check</Ueberschrift>
        <Hinweis art="info" aktion={<Link href="/os/datenschutz#gesundheit" style={{ color: C.ink }}>Zur Einwilligung</Link>}>Die Antworten sind Gesundheitsdaten — der Check speichert erst nach deiner Einwilligung.</Hinweis>
      </Karte>
    );
  }

  const wert = (id: string): boolean | undefined => (id in lokal ? lokal[id] ?? undefined : c.antworten[id]);
  const setzen = async (frage: string, w: boolean | null) => {
    setLokal(l => ({ ...l, [frage]: w }));
    const r = await antworten(c.tag, frage, w);
    // Nicht gespeichert → der Klick fällt zurück (angezeigt wird wieder der Stand des Servers), mit Grund.
    if (!r.ok) setLokal(l => { const n = { ...l }; delete n[frage]; return n; });
    setMeldung(r.ok ? null : { text: r.fehler ?? 'Nicht gespeichert.', art: 'achtung' });
  };
  const fragenSpeichern = async () => {
    const r = await einstellen([{ op: 'check', fragen: wahl }]);
    setMeldung(r.ok ? { text: 'Fragen gespeichert.', art: 'gut' } : { text: r.fehler ?? 'Nicht gespeichert.', art: 'achtung' });
    if (r.ok) setOffen(false);
  };
  const beantwortet = c.fragen.filter(f => typeof wert(f.id) === 'boolean').length;
  const fehlt = c.fortschritt.reduce((m, f) => Math.min(m, f.fehlt), Infinity);
  const befunde = c.befunde.slice(0, 3);

  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={c.fragen.length ? `${c.welcher === 'gestern' ? `Gestern, ${datumKurz(c.tag)}` : 'Heute'} · ${beantwortet}/${c.fragen.length}` : undefined}>Tages-Check</Ueberschrift>
      <div style={{ display: 'grid', gap: 12 }}>
        {c.fragen.length
          ? <div>{c.fragen.map(f => <JaNein key={f.id} frage={f.frage} wert={wert(f.id)} jaGut={f.jaGut} onWahl={w => void setzen(f.id, w)} />)}</div>
          : <div style={{ fontSize: TYP.body, color: C.inkDim }}>Keine Fragen gewählt — unter „Fragen wählen“ bis zu {c.max} einschalten.</div>}
        {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}

        {befunde.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {befunde.map(b => <div key={b.id} style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>{b.satz}</div>)}
            {befunde.some(b => b.quelle) && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{ANSPANNUNG_HINWEIS}</div>}
          </div>
        )}
        {c.befunde.length === 0 && c.fragen.length > 0 && Number.isFinite(fehlt) && (
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Noch ein paar Tage mit und ohne — dann zeigt dir der Check, was mit deinem Schlaf zusammenhängt (frühestens nach {fehlt} weiteren Antworten).</div>
        )}

        <Klappbar id="check-fragen" titel="Fragen wählen" offen={offen} umschalten={() => setOffen(o => !o)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <MehrfachPillen liste={c.katalog.map(f => ({ id: f.id, label: f.kurz }))} aktiv={wahl} onWahl={ids => setWahl(ids)} farbe={LEUCHT.schlaf} />
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{ANSPANNUNG_HINWEIS}</div>
            {wahl.length > c.max && <Hinweis art="achtung">Höchstens {c.max} Fragen — damit der Check in 10 Sekunden geht.</Hinweis>}
            <Knopf haupt aus={wahl.length > c.max} onClick={() => fragenSpeichern()} farbe={LEUCHT.schlaf}>Fragen speichern</Knopf>
          </div>
        </Klappbar>
        <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.5 }}>{CHECK_HINWEIS} Nur du siehst deine Antworten — außer du teilst deine Gesundheit.</p>
      </div>
    </Karte>
  );
}
