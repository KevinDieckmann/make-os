'use client';
// ─── Leichte Markdown-Aufbereitung für MAKE-Ausgaben (fett, Listen, Headings) ─
// 24.09.: auf das lebendige Muster umgezogen — Farben aus design.ts, überall
// die Text-Schrift; Monospace nur für `Code` in Backticks.
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';

const codeStil = { fontFamily: SCHRIFT.mono, fontSize: '.92em', background: 'rgba(255,255,255,.07)', borderRadius: 5, padding: '1px 5px', color: C.ink } as const;

/** `Code` in Backticks wird Monospace — nur bei paarigen Backticks, sonst bleibt der Text, wie er ist. */
function mitCode(p: string, key: string): React.ReactNode {
  const teile = p.split('`');
  if (teile.length < 3 || teile.length % 2 === 0) return p;
  return teile.map((q, j) => j % 2 === 1 ? <code key={`${key}-c${j}`} style={codeStil}>{q}</code> : q);
}

export function renderInline(s: string, key: string): JSX.Element[] {
  return s.split(/\*\*/).map((p, i) => i % 2 === 1
    ? <b key={`${key}-${i}`} style={{ color: C.ink, fontWeight: 700 }}>{mitCode(p, `${key}-${i}`)}</b>
    : <span key={`${key}-${i}`}>{mitCode(p, `${key}-${i}`)}</span>);
}

export function Rich({ text }: { text: string }): JSX.Element {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: JSX.Element[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const { ordered, items } = list;
    const liStyle = { fontFamily: SCHRIFT.text, fontSize: 14, lineHeight: 1.55, color: C.inkDim };
    blocks.push(ordered
      ? <ol key={`l${blocks.length}`} style={{ margin: '6px 0 8px 20px', display: 'flex', flexDirection: 'column', gap: 5 }}>{items.map((it, i) => <li key={i} style={liStyle}>{renderInline(it, `oi${i}`)}</li>)}</ol>
      : <ul key={`l${blocks.length}`} style={{ margin: '6px 0 8px 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>{items.map((it, i) => <li key={i} style={liStyle}>{renderInline(it, `ui${i}`)}</li>)}</ul>);
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); return; }
    const om = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const bm = line.match(/^\s*[-*•]\s+(.*)$/);
    const hm = line.match(/^\s*#{1,3}\s+(.*)$/);
    if (om) { if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; } list.items.push(om[2]); return; }
    if (bm) { if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; } list.items.push(bm[1]); return; }
    flush();
    if (hm) { blocks.push(<div key={`h${idx}`} style={{ fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 700, color: C.ink, margin: '10px 0 2px' }}>{renderInline(hm[1], `h${idx}`)}</div>); return; }
    blocks.push(<p key={`p${idx}`} style={{ fontFamily: SCHRIFT.text, fontSize: 14, lineHeight: 1.6, color: C.inkDim, margin: '4px 0' }}>{renderInline(line, `p${idx}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}
