'use client';

// ─── WhatsApp — Vorlage wählen, Platzhalter füllen, per Einzelklick senden (07.10.2026) ──────────────────────────────────
// Zum Einhängen in der Inbox (Antwort-Bereich eines WhatsApp-Gesprächs), immer dann, wenn das 24-h-Fenster zu ist — oder bewusst auch
// bei offenem Fenster: `<VorlagenWaehler gespraech={g.id} onGesendet={…} />`.
// Liest GET /api/whatsapp/vorlagen (genehmigte zuerst; andere sichtbar, aber nicht wählbar — mit Status), zeigt die Vorschau mit den
// eingegebenen Werten und sendet erst auf den Klick „Vorlage senden“ (POST /api/whatsapp/senden, Anfrage-Kennung gegen Doppeltes).
// Fehler kommen vom Server als ganzer deutscher Satz (z. B. „nicht genehmigt“, „Limit erreicht“, „Verbindung erneuern“).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, auswahl, eingabe } from '../ui';
import { vorlageFuellen, type Vorlage } from '@/lib/whatsapp/typen';

const KATEGORIE: Record<string, string> = { MARKETING: 'Werbung', UTILITY: 'Service', AUTHENTICATION: 'Bestätigungscode' };
const STATUS: Record<string, string> = { APPROVED: 'genehmigt', PENDING: 'in Prüfung', REJECTED: 'abgelehnt', PAUSED: 'pausiert', DISABLED: 'gesperrt' };
const schluessel = (v: Pick<Vorlage, 'name' | 'sprache'>) => `${v.name}|${v.sprache}`;
const anfrageId = () => `wa-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function VorlagenWaehler({ gespraech, onGesendet, onAbbrechen }: { gespraech: string; onGesendet?: (text: string) => void; onAbbrechen?: () => void }) {
  const [liste, setListe] = useState<Vorlage[] | null>(null);
  const [fehler, setFehler] = useState('');
  const [wahl, setWahl] = useState('');
  const [werte, setWerte] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [id, setId] = useState(anfrageId);

  const laden = async (neu = false) => {
    setFehler('');
    const r = await fetch(`/api/whatsapp/vorlagen${neu ? '?neu=1' : ''}`, { cache: 'no-store' }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as { ok?: boolean; vorlagen?: Vorlage[]; fehler?: string } : { fehler: 'Keine Verbindung zu MAKE OS.' };
    if (d.ok && d.vorlagen) setListe(d.vorlagen); else { setListe([]); setFehler(d.fehler ?? 'Die Vorlagen ließen sich nicht laden.'); }
  };
  useEffect(() => { void laden(); }, []);

  const v = useMemo(() => liste?.find(x => schluessel(x) === wahl) ?? null, [liste, wahl]);
  useEffect(() => { setWerte(v ? v.parameter.map(() => '') : []); setId(anfrageId()); }, [v]);
  const genehmigt = (liste ?? []).filter(x => x.status === 'APPROVED');
  const andere = (liste ?? []).filter(x => x.status !== 'APPROVED');
  const fertig = !!v && werte.every(w => w.trim());

  const senden = async () => {
    if (!v || !fertig) return;
    setLaeuft(true); setFehler('');
    const r = await fetch('/api/whatsapp/senden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gespraech, art: 'vorlage', vorlage: { name: v.name, sprache: v.sprache, parameter: werte.map(w => w.trim()) }, anfrageId: id }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as { ok?: boolean; text?: string; fehler?: string } : { fehler: 'Keine Verbindung zu MAKE OS — nichts gesendet.' };
    setLaeuft(false);
    if (d.ok) { setWahl(''); onGesendet?.(d.text ?? 'Vorlage gesendet.'); return; }
    setFehler(d.fehler ?? 'Die Vorlage ging nicht raus.');
  };

  return (
    <div data-whatsapp="vorlagen" style={{ display: 'grid', gap: 12 }}>
      {liste === null && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Vorlagen werden geladen …</div>}
      {liste && !liste.length && !fehler && (
        <Hinweis art="info" titel="Noch keine Vorlage">Vorlagen legst du bei Meta im WhatsApp Manager an; nach der Genehmigung erscheinen sie hier („Neu laden“).</Hinweis>
      )}
      {liste && liste.length > 0 && (
        <Feldzeile label="Vorlage">
          <select value={wahl} onChange={e => setWahl(e.target.value)} style={{ ...auswahl, width: '100%' }} aria-label="Vorlage wählen">
            <option value="">— bitte wählen —</option>
            {genehmigt.map(x => <option key={schluessel(x)} value={schluessel(x)}>{x.name} · {x.sprache} · {KATEGORIE[x.kategorie] ?? x.kategorie}</option>)}
            {andere.map(x => <option key={schluessel(x)} value={schluessel(x)} disabled>{x.name} · {x.sprache} — {STATUS[x.status] ?? x.status}</option>)}
          </select>
        </Feldzeile>
      )}
      {v && (
        <>
          {v.parameter.map((p, i) => (
            <Feldzeile key={`${p}-${i}`} label={`Platzhalter {{${p}}}`}>
              <input value={werte[i] ?? ''} onChange={e => setWerte(w => w.map((x, j) => (j === i ? e.target.value : x)))} maxLength={1000} style={eingabe} />
            </Feldzeile>
          ))}
          <div aria-label="Vorschau" style={{ whiteSpace: 'pre-wrap', fontSize: TYP.body, lineHeight: 1.55, color: C.ink, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.linie}` }}>
            {v.kopf && <div style={{ fontWeight: 700, marginBottom: 6 }}>{v.kopf}</div>}
            {vorlageFuellen(v.text, werte.map((w, i) => w.trim() || `{{${v.parameter[i]}}}`))}
            {v.fuss && <div style={{ marginTop: 6, color: C.inkDim, fontSize: TYP.bedien }}>{v.fuss}</div>}
          </div>
          {v.kategorie === 'MARKETING' && <Hinweis art="achtung">Werbe-Vorlage: nur an Personen mit Einwilligung (§ 7 UWG). Meta berechnet Werbe-Vorlagen immer.</Hinweis>}
        </>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert" titel="Nicht gesendet">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf onClick={senden} aus={!fertig || laeuft} ton="gut">{laeuft ? 'Sendet …' : 'Vorlage senden'}</Knopf>
        <Knopf leise onClick={() => laden(true)}>Neu laden</Knopf>
        {onAbbrechen && <Knopf leise onClick={onAbbrechen}>Abbrechen</Knopf>}
      </div>
    </div>
  );
}
