'use client';

// ─── Markttraktion · Social › Startpaket laden (26.10.2026) ──────────────────────────────────────────────────────────────────────────
// Eine JSON-Datei (`art: make-os-social-startpaket`) mit Kanälen, Formaten und Folgen — z. B. das Phase-0-Material — in einem Rutsch anlegen.
// Geschrieben wird über DENSELBEN Weg wie jede Eingabe (PATCH /api/social, Einzel-Schritte in Paketen): erst der Kanal, dann seine Formate,
// dann die Folgen mit dem passenden Format. Ein Kanal mit gleichem Namen wird nicht doppelt angelegt (übersprungen, mit Hinweis).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Feldzeile, feld } from '../../ui';
import { SOCIAL_GRENZEN } from '@/lib/social/typen';
import type { SocialApi } from './daten';

interface Paket {
  art?: string;
  kanaele?: { eintrag: Record<string, unknown> & { name?: string }; formate?: Record<string, unknown>[]; folgen?: (Record<string, unknown> & { formatName?: string })[] }[];
}

export function Startpaket({ api, onFertig }: { api: SocialApi; onFertig?: () => void }) {
  const [paket, setPaket] = useState<Paket | null>(null);
  const [name, setName] = useState('');
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'achtung' | 'kritisch'; text: string } | null>(null);
  const datei = async (f: File | undefined) => {
    setMeldung(null); setPaket(null);
    if (!f) return;
    setName(f.name);
    try {
      const p = JSON.parse(await f.text()) as Paket;
      if (p.art !== 'make-os-social-startpaket' || !Array.isArray(p.kanaele)) { setMeldung({ art: 'kritisch', text: 'Das ist kein Social-Startpaket.' }); return; }
      setPaket(p);
    } catch { setMeldung({ art: 'kritisch', text: 'Die Datei ist kein gültiges JSON.' }); }
  };
  const laden = async () => {
    if (!paket?.kanaele) return;
    const berichte: string[] = [];
    for (const k of paket.kanaele) {
      const vorhanden = api.lage?.datei.kanaele.find(x => x.name === k.eintrag.name);
      if (vorhanden) { berichte.push(`„${k.eintrag.name}“ gibt es schon — übersprungen.`); continue; }
      const l1 = await api.schreiben([{ op: 'kanal', eintrag: k.eintrag }]);
      const kanal = l1?.datei.kanaele.find(x => x.name === k.eintrag.name);
      if (!kanal) { setMeldung({ art: 'kritisch', text: `Kanal „${k.eintrag.name}“ nicht angelegt — abgebrochen.` }); return; }
      let lage = l1;
      if (k.formate?.length) lage = await api.schreiben(k.formate.map(f => ({ op: 'format', eintrag: { ...f, kanalId: kanal.id } })));
      const formatId = (n?: string) => (n ? lage?.datei.formate.find(f => f.kanalId === kanal.id && f.name === n)?.id : undefined);
      const ops = (k.folgen ?? []).map(({ formatName, ...f }) => ({ op: 'folge', eintrag: { ...f, kanalId: kanal.id, formatId: formatId(formatName) } }));
      for (let i = 0; i < ops.length; i += SOCIAL_GRENZEN.ops) {
        if (!(await api.schreiben(ops.slice(i, i + SOCIAL_GRENZEN.ops)))) { setMeldung({ art: 'kritisch', text: `Folgen von „${kanal.name}“ ab Nr. ${i + 1} nicht angelegt.` }); return; }
      }
      berichte.push(`„${kanal.name}“: ${k.formate?.length ?? 0} Formate, ${ops.length} Folgen.`);
    }
    setMeldung({ art: 'gut', text: berichte.join(' ') });
    setPaket(null);
    onFertig?.();
  };
  return (
    <Karte>
      <Ueberschrift>Startpaket laden</Ueberschrift>
      <p style={{ color: C.inkLeise, fontSize: TYP.bedien, marginTop: 0 }}>Kanäle, Formate und Folgen aus einer Datei (Startpaket, JSON) — alles kommt als Entwurf an, Formate noch nicht freigegeben.</p>
      <Feldzeile label="Datei (JSON)"><input type="file" accept=".json,application/json" style={feld} onChange={e => void datei(e.target.files?.[0])} /></Feldzeile>
      {paket?.kanaele && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{name}: {paket.kanaele.map(k => `${k.eintrag.name} (${k.folgen?.length ?? 0} Folgen)`).join(' · ')}</span>
          <div><Knopf haupt onClick={laden}>Anlegen</Knopf></div>
        </div>
      )}
      {meldung && <div style={{ marginTop: 12 }}><Hinweis art={meldung.art}>{meldung.text}</Hinweis></div>}
    </Karte>
  );
}
