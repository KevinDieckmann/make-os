'use client';

// ─── Markttraktion ↔ ZOE (28.09., Paket C7) ─────────────────────────────────
// „ZOE fragen“: öffnet das schwebende ZOE-Fenster mit Bezug (Art + Kennung, nie Text) — ZOE liest dann selbst nach
// (kontakt_akte, firma_akte, pipeline …). „ZOE-Vorschläge“: die offenen Stapel-Einträge der Art „crm“ zu diesem
// Kontakt bzw. dieser Firma — freigeben oder mit Grund ablehnen direkt hier. Freigeben läuft über /api/zoe/stapel
// (Art „crm“, lib/zoe/crm-vorschlag.ts) und damit über die normalen Schreibwege; nichts wird versendet.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT, feld } from '../schlank';
import { ZOE_FRAGEN_EREIGNIS, passtZuBezug, type CrmBezug } from '@/lib/zoe/crm-bezug';
import { WEG } from '@/lib/wege';
import { kontaktAkte } from '@/lib/crm/adresse';

/** ZOE mit Bezug öffnen (ZoePanel hört auf das Ereignis). */
export function zoeFragen(b: CrmBezug) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ZOE_FRAGEN_EREIGNIS, { detail: b }));
}

/** Knopf „ZOE fragen“ — klein für Köpfe von Akten und Reitern. */
export function ZoeFragenKnopf({ bezug, titel = 'ZOE fragen' }: { bezug: CrmBezug; titel?: string }) {
  return (
    <button type="button" onClick={() => zoeFragen(bezug)} className="fassbar" title="ZOE öffnen — sie liest hier selbst nach und schlägt nur vor"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${LEUCHT.agenten}1F`, color: LEUCHT.agenten, border: 'none', borderRadius: 999, padding: '5px 12px', fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${LEUCHT.agenten}` }} />{titel}
    </button>
  );
}

interface Vorschlag { id: string; werkzeug: string; titel: string; vorher?: string; nachher: string; anlass?: string; eingabe: Record<string, unknown>; bezug?: { art: string; id: string }; status: string }

/** Offene ZOE-Vorschläge zu einem Kontakt/einer Firma — `null`, wenn es keine gibt (keine leere Karte). */
export function ZoeVorschlaege({ art, id, onUebernommen }: { art: 'kontakt' | 'firma'; id: string; onUebernommen?: () => void }) {
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const [grund, setGrund] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState<Record<string, { ok: boolean; text: string }>>({});

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/zoe/stapel', { cache: 'no-store' });
      const d = await r.json() as { vorschlaege?: Vorschlag[] };
      setListe((d.vorschlaege ?? []).filter(v => v.status === 'offen' && passtZuBezug(v, art, id)));
    } catch { /* ohne Stapel keine Karte */ }
  }, [art, id]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    const neu = () => { void laden(); };
    window.addEventListener('focus', neu);
    return () => window.removeEventListener('focus', neu);
  }, [laden]);

  const entscheiden = async (v: Vorschlag, entscheidung: 'freigeben' | 'ablehnen') => {
    const r = await fetch('/api/zoe/stapel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, entscheidung, ...(entscheidung === 'ablehnen' ? { grund: grund[v.id] ?? '' } : {}) }) });
    const d = await r.json().catch(() => ({})) as { ok?: boolean; ergebnis?: string; error?: string };
    setMeldung(m => ({ ...m, [v.id]: { ok: !!d.ok, text: d.ok ? (entscheidung === 'ablehnen' ? 'Abgelehnt.' : d.ergebnis ?? 'Übernommen.') : d.error ?? 'Nicht übernommen.' } }));
    if (d.ok) { await laden(); if (entscheidung === 'freigeben') onUebernommen?.(); }
  };

  if (!liste.length && !Object.keys(meldung).length) return null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: LEUCHT.agenten }} />ZOE-Vorschläge{liste.length ? ` · ${liste.length}` : ''}
      </div>
      {liste.map(v => {
        const t = typeof v.eingabe.text === 'string' && ['nachricht_entwurf', 'anruf_leitfaden', 'einladung_entwurf', 'danke_entwurf', 'beitrag_entwurf'].includes(String(v.eingabe.art)) ? v.eingabe.text : '';
        const mailto = typeof v.eingabe._mailto === 'string' ? v.eingabe._mailto : '';
        return (
          <div key={v.id} style={{ display: 'grid', gap: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${LEUCHT.agenten}22` }}>
            <div style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink }}>{v.titel}</div>
            {v.vorher && <div style={{ fontSize: 12, color: C.inkLeise }}>vorher: {v.vorher}</div>}
            <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{v.nachher}</div>
            {t && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: C.inkDim, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px', maxHeight: 200, overflowY: 'auto', lineHeight: 1.5 }}>{t}</div>}
            {v.anlass && <div style={{ fontSize: 12, color: C.inkLeise }}>Warum: {v.anlass}</div>}
            <input value={grund[v.id] ?? ''} onChange={e => setGrund(g => ({ ...g, [v.id]: e.target.value }))} placeholder="Grund fürs Ablehnen (optional)" aria-label="Grund fürs Ablehnen" style={{ ...feld, padding: '7px 10px', fontSize: 12.5 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Knopf onClick={async () => { await entscheiden(v, 'freigeben'); }}>{t ? 'Übernehmen' : 'Freigeben'}</Knopf>
              <Knopf leise onClick={async () => { await entscheiden(v, 'ablehnen'); }}>Ablehnen</Knopf>
              {t && <button type="button" onClick={() => { void navigator.clipboard?.writeText(t); }} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5, fontFamily: SCHRIFT.text }}>Kopieren</button>}
              {mailto && <a href={mailto} style={{ color: C.aktiv, fontSize: 12.5, textDecoration: 'none' }}>Im Mail-Programm öffnen ↗</a>}
            </div>
          </div>
        );
      })}
      {Object.entries(meldung).map(([vid, m]) => <div key={vid} style={{ fontSize: 12, color: m.ok ? LEUCHT.gut : LEUCHT.kritisch }}>{m.text}</div>)}
      <div style={{ fontSize: 11.5, color: C.inkLeise }}>ZOE schlägt nur vor — erst dein Klick übernimmt. Versendet wird nichts.</div>
    </div>
  );
}

/**
 * Im Stapel (Aufträge & Freigaben): was ZOE in der Markttraktion vorbereitet hat — Text zum Kopieren, Mail-Programm
 * (nur bei zulässigem Kanal vorbereitet) und der Sprung zum Kontakt/zur Firma. Freigeben/Ablehnen macht der Stapel selbst.
 */
export function CrmStapelDetail({ v }: { v: { eingabe: Record<string, unknown>; bezug?: { art: string; id: string } } }) {
  const e = v.eingabe;
  const t = typeof e.text === 'string' ? e.text : typeof e.inhalt === 'string' ? e.inhalt : '';
  const mailto = typeof e._mailto === 'string' ? e._mailto : '';
  const [art, id] = (v.bezug?.id ?? '').split(':');
  const ziel = !id ? '' : art === 'kontakt' ? kontaktAkte(id) : art === 'firma' ? WEG.firma(id) : art === 'deal' ? WEG.deal(id) : '';
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
      {t && <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 12px', maxHeight: 240, overflowY: 'auto', lineHeight: 1.5 }}>{t}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {t && <button type="button" onClick={() => { void navigator.clipboard?.writeText(t); }} style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontSize: 12.5, fontFamily: SCHRIFT.text }}>Kopieren</button>}
        {mailto && <a href={mailto} style={{ color: C.aktiv, fontSize: 12.5, textDecoration: 'none' }}>Im Mail-Programm öffnen ↗</a>}
        {ziel && <Link href={ziel} style={{ color: C.aktiv, fontSize: 12.5, textDecoration: 'none' }}>In der Markttraktion öffnen ›</Link>}
      </div>
    </div>
  );
}
