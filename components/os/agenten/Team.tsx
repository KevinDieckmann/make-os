'use client';

// ─── Agenten-Seite: links das Team, wie Ordner (09.10., Paket 2) ───────────────────────────────────────────────────────
// Fragerunde 1: „Heads sind links sozusagen die Ordner — da kann ich mit ZOE sprechen, und sie kann die Heads mit
// Threads erreichen. Ich kann aber auch auf die Heads gehen und habe dann die Threads zu den Mitarbeitern. Wenn ich auf Heads
// bin, chatte ich im nächsten Fenster auch nur mit ihnen.“
// ZOE oben, darunter die Heads nach Bereich (Business, Privat). Je Head: Kugel mit Punkt (läuft gerade), Zahl der offenen
// Freigaben, Zahl der Threads. Aufgeklappt: die Mitarbeiter-Threads eingerückt, darunter die Mitarbeiter ohne offenen Thread.
// Welche Heads es gibt, entscheidet der SERVER (GET /api/agenten); hier wird nur nach dem Kopf-Schalter gruppiert.

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { FARBE as C, ABSTAND, ECKE, LEUCHT, MIKRO, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import type { FadenKurz, HeadKarte } from '@/lib/agenten/typen';
import { Chip, Hinweis, Knopf, Leer, SymbolKnopf } from '../ui';
import { KuerzelKugel, ZoeStandbild, bereichFarbe, fotoVon, headFarbe } from './Avatar';
import { sichtbareHeads, useAgenten } from './kontext';
import { meldeNeu } from './daten';
import { FADEN_STATUS_NAME } from './regeln';
import { EINZUG, KUGEL_GROESSE } from './masse';

function TeamZeile({ aktiv, onClick, links, titel, unter, rechts, einzug = 0, ariaLabel }: {
  aktiv?: boolean; onClick: () => void; links: React.ReactNode; titel: React.ReactNode; unter?: React.ReactNode; rechts?: React.ReactNode; einzug?: number; ariaLabel?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={aktiv ? 'page' : undefined} aria-label={ariaLabel} className="fassbar"
      style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s + 2, width: '100%', minHeight: ZIEL.handy, padding: `${ABSTAND.xs + 2}px ${ABSTAND.s}px ${ABSTAND.xs + 2}px ${ABSTAND.s + einzug}px`,
        borderRadius: ECKE.eingabe, border: `1px solid ${aktiv ? TIEF.rand(C.aktiv) : 'transparent'}`, background: aktiv ? TIEF.flaeche(C.aktiv) : 'transparent',
        color: C.ink, fontFamily: SCHRIFT.text, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
      {links}
      <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
        <span style={{ fontSize: TYP.body, fontWeight: aktiv ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</span>
        {unter && <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unter}</span>}
      </span>
      {rechts}
    </button>
  );
}

const statusFarbe = (s: FadenKurz['status']) => (s === 'laeuft' ? C.aktiv : s === 'wartet' ? LEUCHT.achtung : s === 'fehler' ? LEUCHT.kritisch : C.inkLeise);

function HeadEintrag({ h, offen, umschalten, faeden }: { h: HeadKarte; offen: boolean; umschalten: () => void; faeden: readonly FadenKurz[] }) {
  const { auswahl, oeffne, entwurf, starteEntwurf } = useAgenten();
  const farbe = headFarbe(h.farbe);
  const aktiv = auswahl.art === 'head' && auswahl.headId === h.id;
  // Mitarbeiter-Threads dieses Heads: aus der Thread-Liste der Person, sonst die letzten aus der Head-Karte.
  const threads = (faeden.length ? faeden : h.letzteFaeden).filter(f => f.agent.art === 'mitarbeiter' && f.agent.headId === h.id);
  const mitThread = new Set(threads.map(f => (f.agent.art === 'mitarbeiter' ? f.agent.mitarbeiterId : '')));
  const ohneThread = h.mitarbeiter.filter(m => m.aktiv && !mitThread.has(m.id));
  const gesperrt = h.gesperrt || !h.aktiv;
  return (
    <li style={{ display: 'grid', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: gesperrt ? 0.62 : 1 }}>
        <SymbolKnopf ariaLabel={offen ? `${h.kurz} zuklappen` : `${h.kurz} aufklappen — Mitarbeiter und Threads`} onClick={umschalten}>
          {offen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </SymbolKnopf>
        <TeamZeile aktiv={aktiv} onClick={() => oeffne({ h: h.id })} ariaLabel={`${h.name} öffnen${h.zaehler.freigaben ? ` — ${h.zaehler.freigaben} Freigaben offen` : ''}`}
          links={<KuerzelKugel name={h.kurz} farbe={farbe} bereich={h.bereich} foto={fotoVon(h)} groesse={KUGEL_GROESSE.liste} punkt={h.zaehler.laufend ? C.aktiv : undefined} />}
          titel={h.kurz}
          unter={h.gesperrt ? h.gesperrt.text : h.zaehler.faeden ? `${h.zaehler.faeden} Thread${h.zaehler.faeden === 1 ? '' : 's'}${h.zaehler.laufend ? ` · ${h.zaehler.laufend} läuft` : ''}` : undefined}
          rechts={h.zaehler.freigaben ? <span className={h.zaehler.freigaben ? 'krit-puls' : undefined}><Chip farbe={LEUCHT.achtung}>⚑ {h.zaehler.freigaben}</Chip></span> : undefined} />
      </div>
      {offen && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }} aria-label={`Threads und Mitarbeiter von ${h.kurz}`}>
          {threads.map(f => {
            const m = f.agent.art === 'mitarbeiter' ? h.mitarbeiter.find(x => x.id === (f.agent as { mitarbeiterId: string }).mitarbeiterId) : undefined;
            return (
              <li key={f.id}>
                <TeamZeile einzug={EINZUG + ZIEL.rechner} aktiv={auswahl.art === 'faden' && auswahl.fadenId === f.id} onClick={() => oeffne({ f: f.id })}
                  links={<span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.bedien }}>↳</span>}
                  titel={m?.name ?? 'Mitarbeiter'} unter={`„${f.titel}“`}
                  rechts={<span title={FADEN_STATUS_NAME[f.status]} style={{ width: 8, height: 8, borderRadius: ECKE.eingabe, background: statusFarbe(f.status), flex: '0 0 auto' }} />} />
              </li>
            );
          })}
          {ohneThread.map(m => (
            <li key={m.id}>
              <TeamZeile einzug={EINZUG + ZIEL.rechner} aktiv={!!entwurf && entwurf.mitarbeiterId === m.id} onClick={() => starteEntwurf({ headId: h.id, mitarbeiterId: m.id })}
                links={<span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.bedien }}>↳</span>}
                titel={<span style={{ color: C.inkDim }}>{m.name}</span>} unter={m.aushilfe ? 'hilft hier aus' : 'neuer Thread'} />
            </li>
          ))}
          {!threads.length && !ohneThread.length && <li style={{ paddingLeft: EINZUG + ZIEL.rechner, fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine Mitarbeiter.</li>}
        </ul>
      )}
    </li>
  );
}

export function Team() {
  const w = useAgenten();
  const { agenten, faeden, auswahl, oeffne, dialog } = w;
  const heads = sichtbareHeads(w);
  const alleFaeden = faeden.zustand === 'da' ? faeden.daten.faeden : [];
  // Der gewählte Head klappt auf (sein Ordner ist offen), andere bleiben, wie man sie gelassen hat.
  const gewaehlt = auswahl.art === 'head' ? auswahl.headId : auswahl.art === 'faden' ? auswahl.headId : undefined;
  const [offen, setOffen] = useState<Record<string, boolean>>(() => (gewaehlt ? { [gewaehlt]: true } : {}));
  useEffect(() => { if (gewaehlt) setOffen(o => (o[gewaehlt] ? o : { ...o, [gewaehlt]: true })); }, [gewaehlt]);
  const zoeAktiv = auswahl.art === 'zoe';
  const zoeFaeden = alleFaeden.filter(f => f.agent.art === 'zoe').length;
  const gruppen = (['business', 'privat'] as const).map(b => ({ b, heads: heads.filter(h => h.bereich === b) })).filter(g => g.heads.length);

  return (
    <nav aria-label="Team" style={{ display: 'grid', gap: ABSTAND.m, alignContent: 'start' }}>
      <span style={{ ...MIKRO }}>Team</span>
      <TeamZeile aktiv={zoeAktiv} onClick={() => oeffne({})} ariaLabel="ZOE öffnen"
        links={<ZoeStandbild groesse={KUGEL_GROESSE.liste} punkt={zoeAktiv ? C.aktiv : undefined} />}
        titel="ZOE" unter={zoeFaeden ? `steuert die Heads · ${zoeFaeden} Thread${zoeFaeden === 1 ? '' : 's'}` : 'steuert die Heads'} />

      {agenten.zustand === 'laedt' && <Leer>Das Team wird geladen …</Leer>}
      {agenten.zustand === 'kommt' && <Leer>Die Heads erscheinen hier, sobald der Agenten-Kern läuft. ZOE ist schon da.</Leer>}
      {agenten.zustand === 'gesperrt' && <Hinweis art="info">{agenten.text}</Hinweis>}
      {agenten.zustand === 'fehler' && <Hinweis art="kritisch" aktion={<Knopf leise onClick={meldeNeu}>Noch einmal versuchen</Knopf>}>{agenten.text}</Hinweis>}
      {agenten.zustand === 'da' && !heads.length && <Leer>In diesem Bereich gibt es keine Heads für dich.</Leer>}

      {gruppen.map(g => (
        <section key={g.b} aria-label={g.b === 'business' ? 'Business' : 'Privat'} style={{ display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, ...MIKRO, margin: `${ABSTAND.xs}px 0 ${ABSTAND.xs}px` }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: ECKE.eingabe, background: bereichFarbe(g.b) }} />
            {g.b === 'business' ? 'Business' : 'Privat'}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {g.heads.map(h => <HeadEintrag key={h.id} h={h} faeden={alleFaeden} offen={!!offen[h.id]} umschalten={() => setOffen(o => ({ ...o, [h.id]: !o[h.id] }))} />)}
          </ul>
        </section>
      ))}

      {agenten.zustand === 'da' && heads.length > 0 && (
        <div><Knopf leise onClick={() => dialog({ art: 'mitarbeiter', headId: gewaehlt })}><Plus size={16} aria-hidden /> Mitarbeiter</Knopf></div>
      )}
    </nav>
  );
}
