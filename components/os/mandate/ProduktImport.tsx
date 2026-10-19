'use client';

// ─── Produkte importieren (P4, 19.10.; PRODUKTE_KONZEPT.md › Import) ─────────────────────────────────────────────────────────
// Fenster „Produkte importieren“: Datei (JSON oder Tabelle) wählen oder Text einfügen → Vorschau vom Server (je Produkt neu · ändert · gleich ·
// Fehler · übersprungen, mit den Feldern alt → neu) → „Übernehmen“. Gerechnet und geprüft wird NUR auf dem Server (POST /api/crm/produkte/import,
// Regel in lib/crm/produkt-import.ts) — hier wird nur gelesen, geschickt und gezeigt. Die Vorschau schreibt nie; ändert sich die Eingabe, ist sie
// veraltet und „Übernehmen“ wartet auf eine neue. Design-Standard (components/os/ui), am Handy alles untereinander, Eingaben 16 px.
// Einhängen: <ProduktImportKnopf onFertig={() => void api.laden(true)} /> (Knopf + Fenster in einem).

import { useMemo, useRef, useState } from 'react';
import { FARBE as C, TYP, BEDEUTUNG_FARBE, RAND, ECKE } from '@/lib/make-one/design';
import { Knopf, Chip, Hinweis, Segmente, eingabe } from '../ui';
import { Fenster } from '../Fenster';
import type { ImportArt, ImportZeile } from '@/lib/crm/produkt-import';

interface PlanAnsicht { zeilen: ImportZeile[]; zahlen: Record<ImportArt, number>; fehler: string[]; hinweise: string[]; status: number }
interface Antwort { ok?: boolean; fehler?: string; plan?: PlanAnsicht; angelegt?: number; geaendert?: number; ablauf?: { zugeordnet: number; hinweise: string[] }; treppe?: { verknuepft: number; hinweise: string[] } }

const ART: Record<ImportArt, { name: string; farbe: string }> = {
  neu: { name: 'neu', farbe: BEDEUTUNG_FARBE.gut },
  aendert: { name: 'ändert', farbe: BEDEUTUNG_FARBE.info },
  gleich: { name: 'gleich', farbe: BEDEUTUNG_FARBE.neutral },
  fehler: { name: 'Fehler', farbe: BEDEUTUNG_FARBE.kritisch },
  uebersprungen: { name: 'übersprungen', farbe: BEDEUTUNG_FARBE.achtung },
};
const REIHE: ImportArt[] = ['neu', 'aendert', 'gleich', 'fehler', 'uebersprungen'];
const BEISPIEL = `[{ "name": "Beispiel-Check", "status": "aktiv", "gesellschaft": "ug",
   "leistungstext": "Eine Woche, ein Befund.", "preise": [{ "art": "kostenlos" }], "ebene": 1 }]

oder als Tabelle (aus Excel kopiert):
Name;Stufe;Preis-Art;Betrag;Mindestlaufzeit`;

/** Was geschickt wird: JSON (Liste, `{ produkte }` oder ein einzelnes Produkt) → `produkte`, sonst die Tabelle → `csv`. */
export function importKoerper(text: string): { produkte: unknown } | { csv: string } | { fehler: string } {
  const t = text.trim();
  if (!t) return { fehler: 'Erst eine Datei wählen oder Text einfügen.' };
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const j: unknown = JSON.parse(t);
      if (Array.isArray(j)) return { produkte: j };
      if (j && typeof j === 'object' && Array.isArray((j as { produkte?: unknown }).produkte)) return { produkte: (j as { produkte: unknown[] }).produkte };
      return { produkte: [j] };
    } catch { return { fehler: 'Das sieht aus wie JSON, lässt sich aber nicht lesen — Klammern und Anführungszeichen prüfen.' }; }
  }
  return { csv: t };
}

async function senden(text: string, vorschau: boolean): Promise<Antwort & { status: number }> {
  const k = importKoerper(text);
  if ('fehler' in k) return { status: 400, fehler: k.fehler };
  try {
    const r = await fetch('/api/crm/produkte/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...k, vorschau }) });
    const d = await r.json().catch(() => ({})) as Antwort;
    return { ...d, status: r.status };
  } catch { return { status: 0, fehler: 'Keine Verbindung — nichts gespeichert.' }; }
}

/** Knopf „Produkte importieren“ + das Fenster — eine Zeile zum Einhängen. */
export function ProduktImportKnopf({ onFertig }: { onFertig?: () => void }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <Knopf leise onClick={() => setOffen(true)}>Produkte importieren</Knopf>
      {offen && <ProduktImport onZu={() => setOffen(false)} onFertig={onFertig} />}
    </>
  );
}

export function ProduktImport({ onZu, onFertig }: { onZu: () => void; onFertig?: () => void }) {
  const [quelle, setQuelle] = useState<'datei' | 'text'>('datei');
  const [text, setText] = useState('');
  const [datei, setDatei] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanAnsicht | null>(null);
  const [planFuer, setPlanFuer] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const [ablaufHinweise, setAblaufHinweise] = useState<string[]>([]);
  const dateiRef = useRef<HTMLInputElement>(null);

  const aktuell = planFuer !== null && planFuer === text;
  const zuTun = plan ? plan.zahlen.neu + plan.zahlen.aendert : 0;
  const kannUebernehmen = !!plan && aktuell && plan.status === 200 && zuTun > 0 && !fertig;

  const eingabeNeu = (t: string) => { setText(t); setFertig(null); setFehler(null); };
  const dateiLesen = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) { setFehler('Die Datei ist größer als 1 MB — bitte aufteilen.'); return; }
    setDatei(f.name);
    eingabeNeu(await f.text());
  };
  const vorschau = async () => {
    setFehler(null); setFertig(null); setAblaufHinweise([]);
    const a = await senden(text, true);
    if (!a.plan) { setPlan(null); setPlanFuer(null); setFehler(a.fehler ?? 'Die Vorschau ging nicht — bitte noch einmal.'); return; }
    setPlan(a.plan); setPlanFuer(text);
  };
  const uebernehmen = async () => {
    setFehler(null);
    const a = await senden(text, false);
    if (a.plan) { setPlan(a.plan); setPlanFuer(text); }
    if (!a.ok) { setFehler(a.fehler ?? 'Nicht übernommen — nichts gespeichert.'); return; }
    const teile = [a.angelegt ? `${a.angelegt} angelegt` : '', a.geaendert ? `${a.geaendert} geändert` : '', a.ablauf?.zugeordnet ? `${a.ablauf.zugeordnet} Abläufe zugeordnet` : '', a.treppe?.verknuepft ? `${a.treppe.verknuepft} Treppen-Stufen verknüpft` : ''].filter(Boolean);
    setFertig(teile.length ? `Übernommen: ${teile.join(' · ')}.` : 'Übernommen.');
    setAblaufHinweise([...(a.ablauf?.hinweise ?? []), ...(a.treppe?.hinweise ?? [])]);
    onFertig?.();
  };

  const zeilen = useMemo(() => [...(plan?.zeilen ?? [])].sort((a, b) => REIHE.indexOf(a.art) - REIHE.indexOf(b.art) || a.nr - b.nr), [plan]);

  return (
    <Fenster titel="Produkte importieren" onZu={onZu} breit={820}>
      <p style={{ margin: 0, fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>
        Produkt-Karten als JSON oder eine Tabelle (Excel, CSV). Abgeglichen wird über den Namen — Bestehendes ändert sich nur in den gelieferten Feldern.
        Erst die Vorschau, dann übernehmen.
      </p>
      <Segmente liste={[{ id: 'datei', label: 'Datei' }, { id: 'text', label: 'Text einfügen' }]} aktiv={quelle} onWahl={setQuelle} />
      {quelle === 'datei' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input ref={dateiRef} type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/plain" style={{ display: 'none' }}
            onChange={e => { void dateiLesen(e.target.files?.[0]); e.target.value = ''; }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Knopf leise onClick={() => dateiRef.current?.click()}>Datei wählen</Knopf>
            <span style={{ fontSize: TYP.bedien, color: datei ? C.ink : C.inkLeise, overflowWrap: 'anywhere' }}>{datei ?? 'JSON, CSV oder TXT, höchstens 1 MB'}</span>
          </div>
        </div>
      ) : (
        <textarea value={text} onChange={e => eingabeNeu(e.target.value)} placeholder={BEISPIEL} rows={9} spellCheck={false} aria-label="Produkte als JSON oder Tabelle"
          style={{ ...eingabe, minHeight: 180, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, lineHeight: 1.45, resize: 'vertical' }} />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Knopf leise={kannUebernehmen} aus={!text.trim()} onClick={vorschau}>{plan && !aktuell ? 'Vorschau erneuern' : 'Vorschau'}</Knopf>
        <Knopf haupt aus={!kannUebernehmen} onClick={uebernehmen}>{zuTun ? `Übernehmen (${zuTun})` : 'Übernehmen'}</Knopf>
      </div>

      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {fertig && <Hinweis art="gut" rolle="status">{fertig}</Hinweis>}
      {ablaufHinweise.map((h, i) => <Hinweis key={`a${i}`} art="achtung">{h}</Hinweis>)}
      {plan && !aktuell && <Hinweis art="info">Die Eingabe hat sich geändert — bitte die Vorschau erneuern.</Hinweis>}

      {plan && (
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Zusammenfassung">
            {REIHE.filter(a => plan.zahlen[a]).map(a => <Chip key={a} farbe={ART[a].farbe}>{plan.zahlen[a]} {ART[a].name}</Chip>)}
          </div>
          {plan.fehler.map((f, i) => <Hinweis key={`f${i}`} art="kritisch">{f}</Hinweis>)}
          {plan.status !== 200 && !plan.fehler.length && <Hinweis art="kritisch">Erst die Fehler beheben — übernommen wird nur eine Lieferung ohne Fehler.</Hinweis>}
          {plan.hinweise.map((h, i) => <Hinweis key={`h${i}`} art="info">{h}</Hinweis>)}
          <div style={{ display: 'grid', gap: 10 }}>
            {zeilen.map(z => <ImportZeileAnsicht key={z.nr} z={z} />)}
          </div>
        </div>
      )}
    </Fenster>
  );
}

function ImportZeileAnsicht({ z }: { z: ImportZeile }) {
  const a = ART[z.art];
  return (
    <section style={{ border: `1px solid ${z.art === 'fehler' ? `${a.farbe}66` : RAND.flaeche}`, borderRadius: ECKE.flach, padding: '12px 14px', display: 'grid', gap: 8, minWidth: 0, background: 'rgba(255,255,255,.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        <Chip farbe={a.farbe}>{a.name}</Chip>
        <strong style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere', minWidth: 0 }}>{z.name}</strong>
      </div>
      {z.felder.length > 0 && (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 11rem) minmax(0, 1fr)', columnGap: 12, rowGap: 6 }}>
          {z.felder.map(f => (
            <div key={f.feld} style={{ display: 'contents' }}>
              <dt style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>{f.label}</dt>
              <dd style={{ margin: 0, fontSize: TYP.bedien, color: C.ink, overflowWrap: 'anywhere', lineHeight: 1.45 }}>
                {f.alt !== '—' && <><span style={{ color: C.inkLeise, textDecoration: 'line-through' }}>{f.alt}</span>{' → '}</>}{f.neu}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {z.fehler.map((f, i) => <div key={`f${i}`} role="alert" style={{ fontSize: TYP.bedien, color: BEDEUTUNG_FARBE.kritisch, lineHeight: 1.45 }}>{f}</div>)}
      {z.hinweise.map((h, i) => <div key={`h${i}`} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>{h}</div>)}
    </section>
  );
}
