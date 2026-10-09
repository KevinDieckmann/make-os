'use client';

// ─── Agenten-Seite: links die Liste — ZOE, Heads, Threads (09.10., Paket 2; Aufräumen 09.10. abends nach dem Claude-Muster) ──────
// Fragerunde 1: „Heads sind links sozusagen die Ordner — da kann ich mit ZOE sprechen, und sie kann die Heads mit Threads erreichen.
// Ich kann aber auch auf die Heads gehen und habe dann die Threads zu den Mitarbeitern.“
// Aufräumen 09.10. (Auftrag: „bei Claude sieht das aufgeräumter aus“): eine ruhige Liste wie in der Claude-App —
//   oben „Neu ▾“ und das Suchfeld (filtert Heads und Threads nach Namen), dann ZOE, dann Business/Privat (nach dem Kopf-Schalter);
//   Heads NUR mit Namen (keine Untertitel — Design-Regel „Namen stehen allein“), ein kleiner Punkt nur bei Zustand (läuft · wartet ·
//   Freigabe, kritisch pulsiert); aufgeklappt die Threads des Heads und seiner Mitarbeiter (nur Titel, Punkt bei läuft/wartet/Fehler),
//   ab sechs „+ n weitere“ (nichts unerreichbar); „+ Mitarbeiter“ unauffällig unten.
// Mitarbeiter ohne Thread stehen nicht mehr hier: „Thread starten“ unter Info › Mitarbeiter des Heads und „Neu ▾ › Auftrag“.
// Welche Heads und Threads es gibt, entscheidet der SERVER (GET /api/agenten, …/faden); hier wird nur gruppiert und gefiltert.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, Plus, X } from 'lucide-react';
import { FARBE as C, ABSTAND, ECKE, LEUCHT, MIKRO, RADIUS, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import type { FadenKurz, HeadKarte } from '@/lib/agenten/typen';
import { suchPasst } from '@/lib/text/such-norm';
import { Hinweis, Knopf, Leer, SymbolKnopf, feld } from '../ui';
import { KuerzelKugel, ZoeStandbild, bereichFarbe, fotoVon, headFarbe } from './Avatar';
import { felderVon, sichtbareHeads, useAgenten } from './kontext';
import { meldeNeu } from './daten';
import { NeuMenue } from './Kopfleiste';
import { fadenStatusFarbe, fadenStatusName, wartendeFaeden } from './regeln';
import { TASTE_TEXT } from './klappen';
import { KUGEL_GROESSE, LISTE_THREADS, SPALTE_EINS } from './masse';

/** Ein kleiner Zustandspunkt — nur, wenn es einen Zustand gibt (läuft · wartet · Freigabe · Fehler). */
function Punkt({ farbe, puls }: { farbe: string; puls?: boolean }) {
  return <span aria-hidden className={puls ? 'krit-puls' : undefined} style={{ width: 8, height: 8, borderRadius: RADIUS.pille, background: farbe, flex: '0 0 auto' }} />;
}

/** Eine Zeile der Liste: nur der Name bzw. Titel — Zustand als Punkt, Details im Tooltip und in der Ansage. */
function ListenZeile({ aktiv, onClick, links, titel, rechts, einzug = 0, ariaLabel, hinweis }: {
  aktiv?: boolean; onClick: () => void; links?: ReactNode; titel: ReactNode; rechts?: ReactNode; einzug?: number; ariaLabel?: string; hinweis?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={aktiv ? 'page' : undefined} aria-label={ariaLabel} title={hinweis} className="fassbar"
      style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s + 2, width: '100%', flex: '1 1 auto', minWidth: 0, minHeight: ZIEL.handy, padding: `${ABSTAND.xs}px ${ABSTAND.s}px ${ABSTAND.xs}px ${ABSTAND.s + einzug}px`,
        borderRadius: ECKE.eingabe, border: `1px solid ${aktiv ? TIEF.rand(C.aktiv) : 'transparent'}`, background: aktiv ? TIEF.flaeche(C.aktiv) : 'transparent',
        color: aktiv ? C.ink : C.inkDim, fontFamily: SCHRIFT.text, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
      {links}
      <span style={{ flex: 1, minWidth: 0, fontSize: einzug ? TYP.bedien : TYP.body, fontWeight: aktiv ? 700 : 600, color: aktiv ? C.ink : einzug ? C.inkDim : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</span>
      {rechts}
    </button>
  );
}

/** Punkt eines Threads — ein bloß eingereihter Lauf zählt wie „läuft“ (nicht wie „wartet auf dich“, `fadenStatusFarbe`). */
const fadenPunkt = (f: FadenKurz): { farbe: string; puls?: boolean } | null => {
  const s = fadenStatusFarbe(f);
  return s === 'laeuft' ? { farbe: C.aktiv } : s === 'wartet' ? { farbe: LEUCHT.achtung, puls: true } : s === 'fehler' ? { farbe: LEUCHT.kritisch } : null;
};
const neuesteZuerst = (a: FadenKurz, b: FadenKurz) => b.aktualisiert.localeCompare(a.aktualisiert);
/** Zustand eines Heads als EIN Punkt: Freigabe (pulsiert) vor wartet vor läuft. */
function headPunkt(h: HeadKarte, threads: readonly FadenKurz[]): { farbe: string; puls?: boolean; text: string } | null {
  if (h.zaehler.freigaben) return { farbe: LEUCHT.achtung, puls: true, text: `${h.zaehler.freigaben} ${h.zaehler.freigaben === 1 ? 'Freigabe' : 'Freigaben'} offen` };
  const wartet = wartendeFaeden(threads).length;
  if (wartet) return { farbe: LEUCHT.achtung, puls: true, text: `${wartet} ${wartet === 1 ? 'Thread wartet' : 'Threads warten'} auf dich` };
  if (h.zaehler.laufend) return { farbe: C.aktiv, text: `${h.zaehler.laufend} läuft` };
  return null;
}

/** Die Threads unter einem Ordner (ZOE oder Head): nur Titel, Punkt bei Zustand, ab `LISTE_THREADS` „+ n weitere“. */
function ThreadListe({ threads, wer, aktivId, oeffnen, alle, ariaLabel }: {
  threads: readonly FadenKurz[]; wer: (f: FadenKurz) => string; aktivId?: string; oeffnen: (f: FadenKurz) => void; alle?: boolean; ariaLabel: string;
}) {
  const [mehr, setMehr] = useState(false);
  const zeigen = alle || mehr ? threads : threads.slice(0, LISTE_THREADS);
  const rest = threads.length - zeigen.length;
  if (!threads.length) return <div style={{ padding: `${ABSTAND.xs}px ${ABSTAND.s}px ${ABSTAND.xs}px ${ZIEL.rechner + ABSTAND.s}px`, fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine Threads.</div>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: 2, minWidth: 0 }} aria-label={ariaLabel}>
      {zeigen.map(f => {
        const p = fadenPunkt(f);
        const name = wer(f);
        return (
          <li key={f.id}>
            <ListenZeile einzug={ZIEL.rechner} aktiv={aktivId === f.id} onClick={() => oeffnen(f)} titel={f.titel}
              ariaLabel={`Thread „${f.titel}“ öffnen — ${name}, ${fadenStatusName(f)}`} hinweis={`${name} · ${fadenStatusName(f)}`}
              rechts={p ? <Punkt farbe={p.farbe} puls={p.puls} /> : undefined} />
          </li>
        );
      })}
      {rest > 0 && (
        <li style={{ paddingLeft: ZIEL.rechner }}>
          <Knopf leise onClick={() => setMehr(true)} ariaLabel={`${rest} weitere Threads zeigen`}>+ {rest} weitere</Knopf>
        </li>
      )}
    </ul>
  );
}

function HeadEintrag({ h, offen, umschalten, threads, suche }: { h: HeadKarte; offen: boolean; umschalten: () => void; threads: readonly FadenKurz[]; suche: boolean }) {
  const { auswahl, oeffne } = useAgenten();
  const aktiv = auswahl.art === 'head' && auswahl.headId === h.id;
  const gesperrt = h.gesperrt || !h.aktiv;
  const p = headPunkt(h, threads);
  const maName = (f: FadenKurz) => (f.agent.art === 'mitarbeiter' ? h.mitarbeiter.find(m => m.id === (f.agent as { mitarbeiterId: string }).mitarbeiterId)?.name ?? 'Mitarbeiter' : h.kurz);
  const aktivId = auswahl.art === 'faden' || auswahl.art === 'head' ? auswahl.fadenId : undefined;
  return (
    <li style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, opacity: gesperrt ? 0.62 : 1 }}>
        <SymbolKnopf ariaLabel={offen ? `${h.kurz} zuklappen` : `${h.kurz} aufklappen — Threads`} offen={offen} onClick={umschalten}>
          {offen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </SymbolKnopf>
        <ListenZeile aktiv={aktiv && !aktivId} onClick={() => oeffne({ h: h.id })}
          ariaLabel={`${h.name} öffnen${p ? ` — ${p.text}` : ''}${h.gesperrt ? ` — ${h.gesperrt.text}` : ''}`} hinweis={h.gesperrt?.text ?? p?.text}
          links={<KuerzelKugel name={h.kurz} farbe={headFarbe(h.farbe)} bereich={h.bereich} foto={fotoVon(h)} groesse={KUGEL_GROESSE.klein} />}
          titel={h.kurz} rechts={p ? <Punkt farbe={p.farbe} puls={p.puls} /> : undefined} />
      </div>
      {offen && <ThreadListe threads={threads} wer={maName} aktivId={aktivId} alle={suche} ariaLabel={`Threads von ${h.kurz}`}
        oeffnen={f => oeffne(f.agent.art === 'head' ? { h: h.id, f: f.id } : { f: f.id })} />}
    </li>
  );
}

export function Team() {
  const w = useAgenten();
  const { agenten, faeden, auswahl, oeffne, dialog, form } = w;
  const felder = form === 'handy' ? null : felderVon(w);
  const heads = sichtbareHeads(w);
  const alleFaeden = useMemo(() => (faeden.zustand === 'da' ? faeden.daten.faeden : []), [faeden]);
  const [suche, setSuche] = useState('');
  const sucht = suche.trim().length > 0;
  // Der gewählte Head klappt auf (sein Ordner ist offen), andere bleiben, wie man sie gelassen hat.
  const gewaehlt = auswahl.art === 'head' ? auswahl.headId : auswahl.art === 'faden' ? auswahl.headId : auswahl.art === 'zoe' && auswahl.fadenId ? 'zoe' : undefined;
  const [offen, setOffen] = useState<Record<string, boolean>>(() => (gewaehlt ? { [gewaehlt]: true } : {}));
  useEffect(() => { if (gewaehlt) setOffen(o => (o[gewaehlt] ? o : { ...o, [gewaehlt]: true })); }, [gewaehlt]);
  const umschalten = (id: string) => setOffen(o => ({ ...o, [id]: !o[id] }));

  // Threads je Ordner (neueste zuerst): aus der Thread-Liste der Person, sonst die letzten aus der Head-Karte.
  const zoeThreads = alleFaeden.filter(f => f.agent.art === 'zoe').sort(neuesteZuerst);
  const threadsVon = (h: HeadKarte) => (alleFaeden.length ? alleFaeden : h.letzteFaeden)
    .filter(f => f.agent.art !== 'zoe' && (f.agent as { headId: string }).headId === h.id).sort(neuesteZuerst);
  // Suche: ein Head passt mit Namen (dann alle seine Threads) oder mit einem Thread-Titel (dann nur diese Threads, aufgeklappt).
  const zoePasst = !sucht || suchPasst(['ZOE'], suche);
  const zoeTreffer = sucht ? zoeThreads.filter(f => suchPasst([f.titel], suche)) : zoeThreads;
  const zeilen = heads.map(h => {
    const alle = threadsVon(h);
    if (!sucht) return { h, threads: alle };
    if (suchPasst([h.name, h.kurz], suche)) return { h, threads: alle };
    const t = alle.filter(f => suchPasst([f.titel], suche));
    return t.length ? { h, threads: t } : null;
  }).filter((x): x is { h: HeadKarte; threads: FadenKurz[] } => !!x);
  const gruppen = (['business', 'privat'] as const).map(b => ({ b, zeilen: zeilen.filter(z => z.h.bereich === b) })).filter(g => g.zeilen.length);
  const zoeAktiv = auswahl.art === 'zoe';
  const zoeOffen = sucht ? zoeTreffer.length > 0 : !!offen.zoe;
  const keinTreffer = sucht && !zoePasst && !zoeTreffer.length && !zeilen.length;

  return (
    <nav aria-label="Team" style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: ABSTAND.m, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.xs }}>
        <NeuMenue />
        {form !== 'handy' && felder && (
          <SymbolKnopf ariaLabel={`Liste zuklappen (${TASTE_TEXT.links})`} offen steuert="agenten-liste" onClick={() => felder.umschalten('links', false)}><PanelLeftClose size={18} /></SymbolKnopf>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <input type="search" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen" aria-label="Heads und Threads suchen" style={{ ...feld, paddingRight: ZIEL.rechner + ABSTAND.xs }} />
        {sucht && (
          <span style={{ position: 'absolute', right: ABSTAND.xs / 2, top: '50%', transform: 'translateY(-50%)' }}>
            <SymbolKnopf ariaLabel="Suche leeren" onClick={() => setSuche('')}><X size={16} /></SymbolKnopf>
          </span>
        )}
      </div>

      {(zoePasst || zoeTreffer.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <SymbolKnopf ariaLabel={zoeOffen ? 'ZOE-Gespräche zuklappen' : 'ZOE-Gespräche aufklappen'} offen={zoeOffen} onClick={() => umschalten('zoe')}>
              {zoeOffen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </SymbolKnopf>
            <ListenZeile aktiv={zoeAktiv && !auswahl.fadenId} onClick={() => oeffne({})} ariaLabel="ZOE öffnen"
              links={<ZoeStandbild groesse={KUGEL_GROESSE.klein} />} titel="ZOE" />
          </div>
          {zoeOffen && <ThreadListe threads={zoeTreffer} wer={() => 'ZOE'} aktivId={zoeAktiv ? auswahl.fadenId : undefined} alle={sucht} ariaLabel="Gespräche mit ZOE" oeffnen={f => oeffne({ f: f.id })} />}
        </div>
      )}

      {agenten.zustand === 'laedt' && <Leer>Das Team wird geladen …</Leer>}
      {agenten.zustand === 'kommt' && <Leer>Die Heads erscheinen hier, sobald der Agenten-Kern läuft. ZOE ist schon da.</Leer>}
      {agenten.zustand === 'gesperrt' && <Hinweis art="info">{agenten.text}</Hinweis>}
      {agenten.zustand === 'fehler' && <Hinweis art="kritisch" aktion={<Knopf leise onClick={meldeNeu}>Noch einmal versuchen</Knopf>}>{agenten.text}</Hinweis>}
      {agenten.zustand === 'da' && !heads.length && <Leer>In diesem Bereich gibt es keine Heads für dich.</Leer>}
      {keinTreffer && <Leer symbol="⌕" aktion={<Knopf leise onClick={() => setSuche('')}>Suche leeren</Knopf>}>Nichts gefunden für „{suche.trim()}“.</Leer>}

      {gruppen.map(g => (
        <section key={g.b} aria-label={g.b === 'business' ? 'Business' : 'Privat'} style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, ...MIKRO, margin: `${ABSTAND.xs}px 0`, paddingLeft: ABSTAND.s }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: RADIUS.pille, background: bereichFarbe(g.b) }} />
            {g.b === 'business' ? 'Business' : 'Privat'}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: 2, minWidth: 0 }}>
            {g.zeilen.map(z => <HeadEintrag key={z.h.id} h={z.h} threads={z.threads} suche={sucht} offen={sucht ? z.threads.length > 0 && !suchPasst([z.h.name, z.h.kurz], suche) || !!offen[z.h.id] : !!offen[z.h.id]} umschalten={() => umschalten(z.h.id)} />)}
          </ul>
        </section>
      ))}

      {agenten.zustand === 'da' && heads.length > 0 && (
        <div><Knopf leise onClick={() => dialog({ art: 'mitarbeiter', headId: auswahl.art === 'zoe' ? undefined : auswahl.headId })}><Plus size={16} aria-hidden /> Mitarbeiter</Knopf></div>
      )}
    </nav>
  );
}
