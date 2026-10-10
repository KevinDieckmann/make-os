'use client';

// ─── Agenten-Seite: „Kosten je Auftrag“ aus der Lauf-Spur (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9, Teil F) ──────────
// Erreichbar über „⋯“ unten im Hintergrund-Feld. Zeigt nur, was der Server für dieses Konto liefert (GET /api/agenten/kosten — eigene Ketten,
// Sicht Privat/Business serverseitig): je Auftrag (Kette ZOE → Head → Mitarbeiter) wann, wer, Dauer, Kosten, Werkzeuge, Cache-Anteil; oben
// Summen 7/30 Tage und die „Zeit bis zum ersten Wort“ von ZOE. Ein Inhaber sieht darunter die Summen der Instanz — nur Zahlen, nie fremde
// Einzelheiten. Nur Messwerte, keine Inhalte.

import { useEffect, useState } from 'react';
import { FARBE as C, ABSTAND, LEUCHT, MIKRO, TYP } from '@/lib/make-one/design';
import { euroText } from '@/lib/ki/kosten';
import type { KetteZeile, KostenAntwort, SpurBereich, SpurErgebnis, SpurSumme } from '@/lib/agenten/spur';
import { Fenster } from '../Fenster';
import { Chip, Eigenschaft, Hinweis, Kennzahl, Leer, Liste, Raster, Zeile } from '../ui';
import { ladeKosten, type Abruf } from './daten';
import { useAgenten } from './kontext';
import { dauerText, zeitKurz } from './regeln';

const ERGEBNIS_NAME: Readonly<Record<SpurErgebnis, string>> = { ok: 'fertig', gestapelt: 'Vorschlag im Stapel', wartet: 'wartet', abgebrochen: 'abgebrochen', gesperrt: 'gesperrt', fehler: 'Fehler' };
const ERGEBNIS_FARBE: Readonly<Record<SpurErgebnis, string>> = { ok: LEUCHT.gut, gestapelt: LEUCHT.gut, wartet: LEUCHT.achtung, abgebrochen: C.inkLeise, gesperrt: C.inkLeise, fehler: LEUCHT.kritisch };
const BEREICH_NAME: Readonly<Record<SpurBereich | 'beide', string>> = { privat: 'Privat', business: 'Business', beide: 'Privat + Business' };

/** Anteil als „42 %“ — ohne Wert ein Strich. */
const prozent = (q: number | null | undefined): string => (q == null ? '—' : `${Math.round(q * 100)} %`);
/** Sekunden mit einer Nachkommastelle — für die Zeit bis zum ersten Wort. */
const sekunden = (ms: number | null | undefined): string => (ms == null ? '—' : `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`);

export function KostenFenster({ onZu }: { onZu: () => void }) {
  const { agenten, bereich, jetzt } = useAgenten();
  const [abruf, setAbruf] = useState<Abruf<KostenAntwort>>({ zustand: 'laedt' });
  useEffect(() => {
    let aktiv = true;
    void ladeKosten(bereich === 'alle' ? undefined : bereich).then(r => { if (aktiv) setAbruf(r); });
    return () => { aktiv = false; };
  }, [bereich]);

  // Namen der Agenten aus dem, was die Seite ohnehin zeigt (die Spur trägt nur Kennungen).
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const name = (schluessel: string): string => {
    if (schluessel === 'zoe') return 'ZOE';
    const [art, headId, mId] = schluessel.split(':');
    const h = heads.find(x => x.id === headId);
    if (art === 'head') return h?.kurz ?? 'Head';
    if (art === 'mitarbeiter') return h?.mitarbeiter.find(m => m.id === mId)?.name ?? 'Mitarbeiter';
    return 'Agent';
  };

  return (
    <Fenster titel="Kosten je Auftrag" onZu={onZu} breit={680}>
      {abruf.zustand === 'laedt' && <Leer>Wird geladen …</Leer>}
      {(abruf.zustand === 'gesperrt' || abruf.zustand === 'fehler' || abruf.zustand === 'kommt') && <Hinweis art={abruf.zustand === 'fehler' ? 'kritisch' : 'info'}>{abruf.text}</Hinweis>}
      {abruf.zustand === 'da' && <Inhalt d={abruf.daten} name={name} jetzt={jetzt} />}
      <Hinweis art="info">Nur Messwerte, keine Inhalte: wann, welche Agenten, wie lange, welches Modell, wie viele Werkzeuge — Kosten sind Schätzungen nach Preisliste. Ein Auftrag umfasst alles, was er angestoßen hat (ZOE → Head → Mitarbeiter).</Hinweis>
    </Fenster>
  );
}

function Inhalt({ d, name, jetzt }: { d: KostenAntwort; name: (s: string) => string; jetzt: Date }) {
  const e = d.eigene;
  if (!d.bereiche.length) return <Leer symbol="◷">In dieser Sicht gibt es für dein Konto keine Läufe.</Leer>;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l }}>
      <Raster min={150}>
        <Kennzahl klein wert={euroText(e.tage7.euroCent)} label="Letzte 7 Tage" unter={`${e.tage7.ketten} Aufträge`} />
        <Kennzahl klein wert={euroText(e.tage30.euroCent)} label="Letzte 30 Tage" unter={`${e.tage30.ketten} Aufträge`} />
        <Kennzahl klein wert={e.zoe.ttftP50 != null ? sekunden(e.zoe.ttftP50) : undefined} label="Zeit bis zum ersten Wort (ZOE)" unter={e.zoe.ttftP95 != null ? `95 % unter ${sekunden(e.zoe.ttftP95)}` : 'noch nicht gemessen'} />
        <Kennzahl klein wert={e.tage30.cacheQuote != null ? prozent(e.tage30.cacheQuote) : undefined} label="Aus dem Zwischenspeicher" unter="Anteil der Eingabe" />
      </Raster>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Aufträge der letzten 30 Tage</span>
        {e.ketten.length
          ? <Liste>{e.ketten.map(k => <KetteZeileAnzeige key={k.kette} k={k} name={name} jetzt={jetzt} />)}</Liste>
          : <Leer symbol="◷">Noch keine gemessenen Aufträge — sobald ZOE oder ein Head arbeitet, steht hier, was es gekostet hat.</Leer>}
      </div>
      {d.instanz && <Instanz d={d} />}
    </div>
  );
}

function KetteZeileAnzeige({ k, name, jetzt }: { k: KetteZeile; name: (s: string) => string; jetzt: Date }) {
  const wer = k.agenten.length ? k.agenten.map(name).join(' → ') : 'Modellaufruf';
  const teile = [
    zeitKurz(k.start, jetzt), dauerText(k.dauerMs), `${k.werkzeuge} ${k.werkzeuge === 1 ? 'Werkzeug' : 'Werkzeuge'}`,
    k.ttftMs != null ? `erstes Wort ${sekunden(k.ttftMs)}` : '', k.cacheQuote != null ? `Zwischenspeicher ${prozent(k.cacheQuote)}` : '',
  ].filter(Boolean);
  return (
    <Zeile umbrechen titel={wer} unter={<span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{teile.join(' · ')}</span>}
      rechts={(
        <span style={{ display: 'grid', justifyItems: 'end', gap: ABSTAND.xs }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euroText(k.euroCent)}</span>
          {k.ergebnis !== 'ok' && <Chip farbe={ERGEBNIS_FARBE[k.ergebnis]}>{ERGEBNIS_NAME[k.ergebnis]}</Chip>}
        </span>
      )} />
  );
}

function SummeZeile({ titel, s }: { titel: string; s: SpurSumme | undefined }) {
  if (!s) return null;
  return (
    <Eigenschaft label={titel}>
      {euroText(s.euroCent)} · {s.ketten} Aufträge · Fehler {prozent(s.fehlerQuote)} · Zwischenspeicher {prozent(s.cacheQuote)}
    </Eigenschaft>
  );
}

/** Nur für einen Inhaber: Summen der Instanz je Bereich — ohne Personen, Agenten oder Kennungen (der Server liefert gar nichts anderes). */
function Instanz({ d }: { d: KostenAntwort }) {
  const i = d.instanz!;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.s }}>
      <span style={{ ...MIKRO }}>Ganze Instanz (nur Summen)</span>
      {d.bereiche.map(b => <SummeZeile key={`30-${b}`} titel={`${BEREICH_NAME[b]} · 30 Tage`} s={i.tage30[b]} />)}
      {d.bereiche.map(b => <SummeZeile key={`7-${b}`} titel={`${BEREICH_NAME[b]} · 7 Tage`} s={i.tage7[b]} />)}
      <Eigenschaft label="Erstes Wort von ZOE (alle, 30 Tage)">{i.zoe30.zuege ? `${sekunden(i.zoe30.ttftP50)} im Mittel · 95 % unter ${sekunden(i.zoe30.ttftP95)}` : 'noch nicht gemessen'}</Eigenschaft>
    </div>
  );
}
