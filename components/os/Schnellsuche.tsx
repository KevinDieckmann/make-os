'use client';
import { suchPasst } from '@/lib/text/such-norm';
import { useSpace } from '@/hooks/useSpace';

// ─── MAKE OS — Schnellsuche (⌘K / Strg+K) ──────────────────────────────────
// Von jeder Seite aus: Kontakte, Firmen, Chancen, Mandate, Kampagnen — und die
// Bereiche selbst. Pfeile wählen, Enter springt hinein, Esc schließt. Oben im
// Kopf gibt es dafür auch die Lupe (Ereignis „make-suche“).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from './ui';
import { useTasks } from '@/context/TasksContext';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { einheitName } from '@/lib/einheiten';
import { WEG } from '@/lib/wege';
import type { Task } from '@/types/tasks';

interface Treffer { art: string; id: string; titel: string; unter?: string; href: string; space?: 'privat' | 'business' }
const SEITEN: Treffer[] = [
  { art: 'seite', id: 'home', titel: 'Home · dein Dashboard', href: '/os' }, { art: 'seite', id: 'heute', titel: 'Heute', href: '/os/heute' }, { art: 'seite', id: 'wachstum', titel: 'Wachstum · Gesamtansicht & Score', href: '/os/wachstum' },
  { art: 'seite', id: 'uebersicht-privat', titel: 'Privat · Übersicht', href: '/os/uebersicht?space=privat', space: 'privat' }, { art: 'seite', id: 'uebersicht-business', titel: 'Business · Übersicht', href: '/os/uebersicht?space=business', space: 'business' },
  { art: 'seite', id: 'markttraktion', titel: 'Markttraktion · Überblick', href: '/os/markttraktion', space: 'business' }, { art: 'seite', id: 'powerhour', titel: 'Follow-up · Power Hour', href: '/os/markttraktion?s=followup&a=powerhour', space: 'business' },
  { art: 'seite', id: 'kontakte', titel: 'Markttraktion · Kontakte', href: '/os/markttraktion?s=kontakte', space: 'business' },
  { art: 'seite', id: 'followup', titel: 'Follow-up · Fällig', href: '/os/markttraktion?s=followup', space: 'business' }, { art: 'seite', id: 'leads', titel: 'Firmen · Leads qualifizieren', href: '/os/markttraktion?s=firmen&a=leads', space: 'business' }, { art: 'seite', id: 'deals-auswertung', titel: 'Deals · Auswertung', href: '/os/markttraktion?s=deals&a=auswertung', space: 'business' },
  { art: 'seite', id: 'firmen', titel: 'Markttraktion · Firmen', href: '/os/markttraktion?s=firmen', space: 'business' }, { art: 'seite', id: 'pipeline', titel: 'Deals · Board', href: '/os/markttraktion?s=deals', space: 'business' },
  { art: 'seite', id: 'kunden', titel: 'Produkte & Mandate', href: '/os/mandate', space: 'business' }, { art: 'seite', id: 'produkte', titel: 'Produkte (Leistungskatalog)', href: '/os/mandate?s=produkte', space: 'business' }, { art: 'seite', id: 'kampagnen', titel: 'Kampagnen', href: '/os/markttraktion?s=sales&a=kampagnen', space: 'business' },
  { art: 'seite', id: 'marketing', titel: 'Marketing', href: '/os/markttraktion?s=marketing', space: 'business' },
  { art: 'seite', id: 'qualifizierung', titel: 'Markttraktion · Qualifizierung', href: '/os/markttraktion?s=qualifizierung', space: 'business' }, { art: 'seite', id: 'angebot', titel: 'Markttraktion · Angebot', href: '/os/markttraktion?s=angebot', space: 'business' },
  { art: 'seite', id: 'events', titel: 'Events (besuchte Veranstaltungen)', href: '/os/markttraktion?s=besuche', space: 'business' }, { art: 'seite', id: 'makeone', titel: 'Make.One (eigene Abende)', href: '/os/markttraktion?s=event', space: 'business' }, { art: 'seite', id: 'stammdaten', titel: 'Markttraktion · Stammdaten', href: '/os/markttraktion?s=stammdaten', space: 'business' },
  { art: 'seite', id: 'finanzen-business', titel: 'Zahlen · Business', href: '/os/finanzen?s=business', space: 'business' }, { art: 'seite', id: 'agenten', titel: 'Agenten', href: '/os/agenten', space: 'business' },
  // Netzwerken (03.10.): unterwegs erfassen und die eigenen Visitenkarten (QR) — in jedem Space auffindbar.
  { art: 'seite', id: 'netzwerken', titel: 'Netzwerken · Person erfassen, Abendbericht', href: WEG.netzwerken() }, { art: 'seite', id: 'netzwerken-karte', titel: 'Netzwerken · Meine Visitenkarten', href: WEG.netzwerkenKarte() },
  { art: 'seite', id: 'aufgaben', titel: 'Aufgaben', href: '/os/aufgaben' }, { art: 'seite', id: 'finanzen', titel: 'Zahlen · Privat', href: '/os/finanzen?s=privat', space: 'privat' },
  { art: 'seite', id: 'familie', titel: 'Familie & Partnerschaft', href: '/os/familie', space: 'privat' }, { art: 'seite', id: 'menschen', titel: 'Kontakte · privat (unsere Menschen)', href: '/os/menschen', space: 'privat' }, { art: 'seite', id: 'fokus', titel: 'Fokus', href: '/os/fokus' },
  { art: 'seite', id: 'gesundheit', titel: 'Gesundheit', href: '/os/gesundheit', space: 'privat' }, { art: 'seite', id: 'ernaehrung', titel: 'Ernährung & Einkauf', href: '/os/gesundheit?s=ernaehrung', space: 'privat' }, { art: 'seite', id: 'sport', titel: 'Sport · Hyrox, Running, Gym, Erholung', href: '/os/sport', space: 'privat' }, { art: 'seite', id: 'wissen', titel: 'Brain', href: '/os/wissen' },
];
const ART: Record<string, { label: string; farbe: string }> = {
  kontakt: { label: 'Person', farbe: LEUCHT.business }, firma: { label: 'Firma', farbe: LEUCHT.puls }, chance: { label: 'Deal', farbe: LEUCHT.achtung },
  mandat: { label: 'Mandat', farbe: LEUCHT.geld }, kampagne: { label: 'Kampagne', farbe: LEUCHT.beziehung }, seite: { label: 'Bereich', farbe: C.inkDim }, mensch: { label: 'Mensch', farbe: LEUCHT.beziehung },
  aufgabe: { label: 'Aufgabe', farbe: LEUCHT.achtung },
  // Events (M4): besuchte Veranstaltungen (Reiter „Events“) und unsere eigenen Abende (Make.One) getrennt gekennzeichnet — der Link kommt vom Server (`eventLink`).
  besuch: { label: 'Event', farbe: LEUCHT.beziehung }, event: { label: 'Make.One', farbe: LEUCHT.beziehung },
};

/** Offene Aufgaben des aktiven Space, deren Titel passt — im Business mit der Einheit im Untertitel (27.09.). */
function aufgabenTreffer(tasks: readonly Task[], q: string, space: 'privat' | 'business'): Treffer[] {
  return tasks
    .filter(a => a.status !== 'done' && suchPasst([a.title], q) && spaceVonAufgabe(a) === space)
    .slice(0, 4)
    .map(a => ({
      art: 'aufgabe', id: a.id, titel: a.title, href: WEG.aufgabe(a.id), space,
      unter: [space === 'business' ? einheitName(a.einheit) ?? 'ohne Einheit' : '', a.dueDate ? `fällig ${a.dueDate.slice(8)}.${a.dueDate.slice(5, 7)}.` : ''].filter(Boolean).join(' · ') || undefined,
    }));
}

export function Schnellsuche() {
  const { space } = useSpace();
  const router = useRouter();
  const { state: aufgabenStand } = useTasks();
  const aufgabenRef = useRef<readonly Task[]>(aufgabenStand.tasks);
  aufgabenRef.current = aufgabenStand.tasks;
  const [offen, setOffen] = useState(false);
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [i, setI] = useState(0);
  const feldRef = useRef<HTMLInputElement>(null);
  const schliessen = useCallback(() => { setOffen(false); setQ(''); setTreffer([]); setI(0); }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOffen(o => !o); } };
    const auf = () => setOffen(true);
    window.addEventListener('keydown', taste);
    window.addEventListener('make-suche', auf);
    return () => { window.removeEventListener('keydown', taste); window.removeEventListener('make-suche', auf); };
  }, []);
  useEffect(() => { if (offen) setTimeout(() => feldRef.current?.focus(), 30); }, [offen]);
  useEffect(() => {
    if (!offen) return;
    const t = q.trim();
    // Im aktiven Space zuerst (Malin 26.09.): Seiten des anderen Space nur, wenn der Begriff sie direkt trifft.
    const seiten = SEITEN.filter(s => (!t || suchPasst([s.titel], t)) && (!s.space || s.space === space || !!t));
    if (t.length < 2) { setTreffer(seiten.slice(0, 8)); setI(0); return; }
    const ab = new AbortController();
    const timer = setTimeout(() => {
      if (space === 'privat') {
        // Privat-Space (26.09.): eure Menschen statt der Kartei — das Business-Kontaktbuch ist die Markttraktion.
        fetch('/api/familie', { signal: ab.signal }).then(r => (r.ok ? r.json() : null)).then(d => {
          const menschen = ((d?.familie?.menschen ?? []) as { id: string; name: string; rolle: string; notiz?: string }[])
            .filter(m => suchPasst([m.name, m.rolle, m.notiz], t)).slice(0, 8)
            .map(m => ({ art: 'mensch', id: m.id, titel: m.name, unter: m.rolle, href: '/os/menschen' }));
          setTreffer([...menschen, ...aufgabenTreffer(aufgabenRef.current, t, 'privat'), ...seiten.slice(0, 3)]); setI(0);
        }).catch(() => {});
        return;
      }
      fetch(`/api/crm/suche?q=${encodeURIComponent(t)}`, { signal: ab.signal }).then(r => r.json()).then(d => { setTreffer([...(d.treffer ?? []), ...aufgabenTreffer(aufgabenRef.current, t, 'business'), ...seiten.slice(0, 3)]); setI(0); }).catch(() => {});
    }, 140);
    return () => { clearTimeout(timer); ab.abort(); };
  }, [q, offen, space]);

  const oeffne = (t: Treffer) => { schliessen(); router.push(t.href); };
  if (!offen) return null;
  return (
    <div onClick={schliessen} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(5,7,8,.62)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh', paddingInline: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Schnellsuche" style={{ width: 'min(640px, 100%)', background: C.flaeche, borderRadius: 16, boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)', border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
        <input ref={feldRef} value={q} onChange={e => setQ(e.target.value)} placeholder={space === 'business' ? 'Business: Person, Firma, Chance, Mandat, Aufgabe oder Seite …' : 'Privat: Familie, Aufgabe, Gesundheit, Zahlen oder Seite …'} aria-label="Suchen"
          onKeyDown={e => {
            if (e.key === 'Escape') schliessen();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(treffer.length - 1, x + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
            else if (e.key === 'Enter' && treffer[i]) oeffne(treffer[i]);
          }}
          style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '18px 20px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 17, outline: 'none' }} />
        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {treffer.map((t, j) => (
            <button key={`${t.art}-${t.id}`} onMouseEnter={() => setI(j)} onClick={() => oeffne(t)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: j === i ? 'rgba(255,255,255,.07)' : 'transparent', color: C.ink }}>
              <span style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: ART[t.art]?.farbe ?? C.inkDim, width: 66, flex: '0 0 auto' }}>{ART[t.art]?.label ?? t.art}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: TYP.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                {t.unter && <span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.unter}</span>}
              </span>
            </button>
          ))}
          {!treffer.length && q.trim().length >= 2 && <div style={{ padding: '14px 16px', color: C.inkLeise, fontSize: TYP.bedien }}>Nichts gefunden.</div>}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: TYP.bedien, color: C.inkLeise }}>↑↓ wählen · Enter öffnen · Esc schließen · ⌘K von überall</div>
      </div>
    </div>
  );
}
