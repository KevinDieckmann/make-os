'use client';

// ─── Gesundheit: Schlaf-Hilfe (09.10.2026) — selbstladend, fürs Handy gebaut ───────────────────────────────────────────
// Wunsch (Sport-Fragebogen, 09.10.): beim Schlaf aktiv helfen, morgens den Schlaf zuerst zeigen, eine Ziel-Aufstehzeit schrittweise
// erreichen (z. B. 15 Min. alle 3 Tage). Die Karte zeigt: letzte Nacht gegen den Bedarf (große Zahl),
// Schlafenszeit heute, Aufstehzeit der heutigen Stufe, Schuld der 7 Tage, Rhythmus (Streuung) — und EINEN Tipp. Darunter „Einstellen“:
// Aufstehzeit heute und Ziel, Schrittweite, eigenes Schlafziel (ohne WHOOP), Abend-Erinnerung (Glocke, auf Wunsch auch Handy — immer
// neutral). Gerechnet wird NUR auf dem Server (lib/gesundheit/schlaf.ts über /api/gesundheit/alltag — nur die eigene Person).
// Ohne Einwilligung (a): null (bzw. mit `hinweis` ein Hinweis). Einbinden: `<SchlafHilfeKarte />` (Gesundheit › Heute, gern oben).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Fortschritt, Klappbar, Schalter, Pillen, Feldzeile, eingabe, LEUCHT } from '../ui';
import { SCHLAF_HINWEIS } from '@/lib/gesundheit/schlaf';
import { useAlltag, hm, datumKurz } from './alltag-daten';

const BEWERTUNG = { gleichmaessig: { text: 'gleichmäßig', farbe: LEUCHT.gut }, schwankt: { text: 'schwankt etwas', farbe: LEUCHT.achtung }, unruhig: { text: 'unruhig', farbe: LEUCHT.achtung } } as const;
const SCHRITTE = [10, 15, 20, 30].map(n => ({ id: String(n), label: `${n} Min.` }));
const TAGE = [2, 3, 4, 5].map(n => ({ id: String(n), label: `alle ${n} Tage` }));
const VORLAUF = [15, 30, 45, 60].map(n => ({ id: String(n), label: `${n} Min. vorher` }));

function Wert({ label, wert, unter, farbe }: { label: string; wert?: string; unter?: string; farbe?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{label}</div>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.zahl, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: wert ? farbe ?? C.ink : C.inkLeise }}>{wert ?? '—'}</div>
      {unter && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>{unter}</div>}
    </div>
  );
}

export function SchlafHilfeKarte({ i = 0, hinweis = false }: { i?: number; hinweis?: boolean }) {
  const { d, ladeFehler, laden, einstellen } = useAlltag();
  const [offen, setOffen] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' } | null>(null);
  const s = d?.einstellung.schlaf;
  const [form, setForm] = useState({ aufstehen: '', ziel: '', schrittMin: '15', schrittTage: '3', schlafziel: '', erinnerung: false, vorlauf: '30', handy: false });
  useEffect(() => {
    // Während „Einstellen“ offen ist, überschreibt ein Neuladen (andere Karte hat gespeichert) die Eingaben nicht.
    if (!s || offen) return;
    setForm({ aufstehen: s.aufstehen ?? '', ziel: s.aufstehenZiel ?? '', schrittMin: String(s.schrittMin), schrittTage: String(s.schrittTage), schlafziel: s.schlafziel !== undefined ? String(s.schlafziel).replace('.', ',') : '', erinnerung: s.erinnerung, vorlauf: String(s.vorlaufMin), handy: s.handy });
  }, [s, offen]);

  if (!d) {
    if (!ladeFehler) return null;
    return <Karte i={i}><Hinweis art="achtung" aktion={<Knopf leise onClick={() => laden(true)}>Noch einmal laden</Knopf>}>Die Schlaf-Hilfe ließ sich gerade nicht laden.</Hinweis></Karte>;
  }
  if (!d.einwilligung || !d.sicht) {
    if (!hinweis) return null;
    return (
      <Karte i={i}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Schlaf-Hilfe</Ueberschrift>
        <Hinweis art="info" aktion={<Link href="/os/datenschutz#gesundheit" style={{ color: C.ink }}>Zur Einwilligung</Link>}>Schlafwerte sind Gesundheitsdaten — die Schlaf-Hilfe rechnet erst nach deiner Einwilligung.</Hinweis>
      </Karte>
    );
  }
  const l = d.sicht.schlaf;
  const befund = d.sicht.check.befunde[0];
  const stufe = l.stufe;

  const speichern = async () => {
    const zahl = (x: string) => Number(x.replace(',', '.'));
    const schlafziel = form.schlafziel.trim() ? zahl(form.schlafziel) : null;
    if (schlafziel !== null && !(schlafziel >= 4 && schlafziel <= 12)) { setMeldung({ text: 'Schlafziel: 4 bis 12 Stunden.', art: 'achtung' }); return; }
    const r = await einstellen([{ op: 'schlaf', felder: {
      aufstehen: form.aufstehen || null, aufstehenZiel: form.ziel || null, schrittMin: zahl(form.schrittMin), schrittTage: zahl(form.schrittTage),
      schlafziel, erinnerung: form.erinnerung, vorlaufMin: zahl(form.vorlauf), handy: form.handy,
    } }]);
    setMeldung(r.ok ? { text: 'Gespeichert.', art: 'gut' } : { text: r.fehler ?? 'Nicht gespeichert.', art: 'achtung' });
    if (r.ok) setOffen(false);
  };

  const anteil = l.letzte?.dauer !== undefined && l.letzte.bedarf ? l.letzte.dauer / l.letzte.bedarf : undefined;
  const k = l.konsistenz;
  const streuung = k ? Math.max(k.einschlafStreuung ?? 0, k.aufwachStreuung ?? 0) : 0;

  return (
    <Karte i={i} akzent={LEUCHT.schlaf}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={stufe && !stufe.fertig ? <Chip farbe={LEUCHT.schlaf}>Stufe {stufe.schritt + 1} von {stufe.schritte + 1}</Chip> : undefined}>Schlaf-Hilfe</Ueberschrift>
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Letzte Nacht zuerst — morgens der wichtigste Blick. */}
        <div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{l.letzte ? (l.letzte.tag === d.sicht.heute ? 'Letzte Nacht' : `Nacht bis ${datumKurz(l.letzte.tag)}`) : 'Letzte Nacht'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.held * 0.75, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: l.letzte?.dauer !== undefined ? C.ink : C.inkLeise }}>{l.letzte?.dauer !== undefined ? hm(l.letzte.dauer) : '—'}</span>
            {l.letzte?.bedarf !== undefined && <span style={{ fontSize: TYP.body, color: C.inkDim }}>von {hm(l.letzte.bedarf)} Bedarf</span>}
          </div>
          {anteil !== undefined && <div style={{ marginTop: 8 }}><Fortschritt anteil={anteil} farbe={LEUCHT.schlaf} /></div>}
          {l.letzte?.fehlt !== undefined && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>{l.letzte.fehlt > 0.05 ? `${hm(l.letzte.fehlt)} unter dem Bedarf` : 'Bedarf gedeckt'}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <Wert label="Heute ins Bett" wert={l.schlafenszeit} farbe={LEUCHT.schlaf} unter={l.ziel ? `${hm(l.ziel.stunden)} Schlaf${l.ziel.ausgleich ? ` (inkl. ${Math.round(l.ziel.ausgleich * 60)} Min. Ausgleich)` : ''}` : undefined} />
          <Wert label="Aufstehen" wert={stufe?.aufstehen} unter={stufe?.ziel && !stufe.fertig ? `Ziel ${stufe.ziel}${stufe.naechsteAm ? ` · nächste Stufe ${datumKurz(stufe.naechsteAm)}` : ''}` : stufe?.ziel ? 'Ziel erreicht' : undefined} />
          <Wert label="Schuld · 7 Tage" wert={l.schuld ? hm(l.schuld.stunden) : undefined} unter={l.schuld ? `aus ${l.schuld.naechte} Nächten` : undefined} farbe={l.schuld && l.schuld.stunden >= 2 ? LEUCHT.achtung : undefined} />
          <Wert label="Rhythmus" wert={k?.bewertung ? `±${streuung} Min.` : k?.whoop !== undefined ? `${k.whoop} %` : undefined}
            unter={k?.bewertung ? `${BEWERTUNG[k.bewertung].text}${k.whoop !== undefined ? ` · WHOOP ${k.whoop} %` : ''}` : k?.whoop !== undefined ? 'Konsistenz laut WHOOP' : undefined}
            farbe={k?.bewertung ? BEWERTUNG[k.bewertung].farbe : undefined} />
        </div>

        <Hinweis art="info">{l.tipp}</Hinweis>
        {befund && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Aus deinem Tages-Check: {befund.satz}</div>}
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
          {s?.erinnerung && l.erinnerungUm ? `Erinnerung um ${l.erinnerungUm} — in der Glocke${s.handy ? ' und aufs Handy' : ''}, ohne Werte.` : 'Abend-Erinnerung aus.'}
        </div>
        {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}

        <Klappbar id="schlaf-einstellen" titel="Einstellen" offen={offen} umschalten={() => setOffen(o => !o)}>
          <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Feldzeile label="Aufstehzeit heute"><input type="time" value={form.aufstehen} onChange={e => setForm(f => ({ ...f, aufstehen: e.target.value }))} style={eingabe} /></Feldzeile>
              <Feldzeile label="Ziel-Aufstehzeit"><input type="time" value={form.ziel} onChange={e => setForm(f => ({ ...f, ziel: e.target.value }))} style={eingabe} /></Feldzeile>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Schrittweise dorthin</span>
              <Pillen liste={SCHRITTE} aktiv={form.schrittMin} onWahl={v => setForm(f => ({ ...f, schrittMin: v }))} farbe={LEUCHT.schlaf} />
              <Pillen liste={TAGE} aktiv={form.schrittTage} onWahl={v => setForm(f => ({ ...f, schrittTage: v }))} farbe={LEUCHT.schlaf} />
            </div>
            <Feldzeile label="Eigenes Schlafziel in Stunden (gilt ohne WHOOP-Bedarf)">
              <input inputMode="decimal" value={form.schlafziel} placeholder="z. B. 8" onChange={e => setForm(f => ({ ...f, schlafziel: e.target.value }))} style={eingabe} />
            </Feldzeile>
            <Schalter karte an={form.erinnerung} onChange={v => setForm(f => ({ ...f, erinnerung: v }))} farbe={LEUCHT.schlaf} beschreibung="In der Glocke zur Schlafenszeit — ein neutraler Satz, keine Werte.">Abend-Erinnerung</Schalter>
            {form.erinnerung && <Pillen liste={VORLAUF} aktiv={form.vorlauf} onWahl={v => setForm(f => ({ ...f, vorlauf: v }))} farbe={LEUCHT.schlaf} />}
            {form.erinnerung && <Schalter karte an={form.handy} onChange={v => setForm(f => ({ ...f, handy: v }))} farbe={LEUCHT.schlaf} beschreibung="Über deinen ZOE-Kanal (WhatsApp/Telegram) — nur „Zeit, den Tag ausklingen zu lassen“ mit Link.">Auch aufs Handy</Schalter>}
            <Knopf haupt typ="submit" farbe={LEUCHT.schlaf}>Speichern</Knopf>
          </form>
        </Klappbar>
        <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.5 }}>{SCHLAF_HINWEIS} Nur du siehst diese Karte.</p>
      </div>
    </Karte>
  );
}
