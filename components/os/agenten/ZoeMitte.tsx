'use client';

// ─── Agenten-Seite: die Mitte ohne Auswahl — ZOE (09.10., Paket 2) ─────────────────────────────────────────────────────
// Antworten (Agenten-Bereich 1 + Fragerunde 3): oben ein Kurz-Briefing als Text von ZOE, darunter die Überblick-Karte —
// was seit dem letzten Besuch passiert ist, woran je Head gearbeitet wird, was die nächsten Tage ansteht, „Wartet auf dich“ mit
// einem Klick, Bezug zu den Jahreszielen —, eine Zeile „Vorschläge“ (Arbeit für heute) und darunter der ZOE-Chat.
// Der Chat läuft VORERST über /api/kimmi (wie das ZoePanel); Paket 4 stellt ZOE auf Threads um. Ansprechen per @Head (Feld oder
// Chips) schickt die Nachricht direkt in einen Thread dieses Heads („An Head … gesendet ›“).

import { useEffect, useState } from 'react';
import { FARBE as C, ABSTAND, LEUCHT, MIKRO, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Nachricht } from '@/lib/agenten/typen';
import { KiMarke } from '../KiMarke';
import { Chip, Fortschritt, Karte, Knopf, Leer, Wahl } from '../ui';
import { ZoeKopfKugel, headFarbe } from './Avatar';
import { ChatFeld, ChatVerlauf, Schreibt } from './Chat';
import { anfrageId, fadenSenden, stapelEntscheiden, zoeFragen } from './daten';
import { sichtbareHeads, useAgenten } from './kontext';
import {
  ansprache, ansprechbarFuer, gespraechAlsKontext, nachEisenhower, risikoVon, vorschlaegeHeute, wartendeFaeden, zeitKurz,
  type UeberblickZeileMitHead,
} from './regeln';
import { WEG } from '@/lib/wege';
import { useStimme } from '@/hooks/useStimme';
import { fuerStimme } from '@/lib/make-one/zoe-verlauf';

const MERKER = 'make-agenten-zoe-gespraech';
const zeit = () => new Date().toISOString();
let zaehler = 0;
const nr = () => `nr-lokal-${++zaehler}`;

function gemerkt(): Nachricht[] {
  try { const r = sessionStorage.getItem(MERKER); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

function Abschnitt({ titel, rechts, children }: { titel: string; rechts?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: ABSTAND.xs }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: ABSTAND.s }}><span style={{ ...MIKRO }}>{titel}</span>{rechts}</div>
      {children}
    </div>
  );
}

function Zeilen({ zeilen }: { zeilen: readonly UeberblickZeileMitHead[] }) {
  const { oeffne, jetzt } = useAgenten();
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
      {zeilen.map(z => (
        <li key={z.id} style={{ display: 'flex', alignItems: 'flex-start', gap: ABSTAND.s, fontSize: TYP.body, lineHeight: 1.45, color: C.ink }}>
          <span aria-hidden style={{ color: z.farbe ?? C.inkLeise }}>●</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {z.headId ? <button type="button" onClick={() => oeffne({ h: z.headId })} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>{z.text}</button> : z.text}
          </span>
          {z.zeit && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap', lineHeight: 1.7 }}>{zeitKurz(z.zeit, jetzt)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Die Überblick-Karte über dem Chat — die EINE Fokus-Karte dieser Ansicht. */
export function Ueberblick() {
  const w = useAgenten();
  const { agenten, laeufe, stapel, faeden, jetzt, melde } = w;
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const farbeVon = (id?: string) => (id ? headFarbe(heads.find(h => h.id === id)?.farbe) : undefined);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  const naechste = laeufe.zustand === 'da' ? nachEisenhower(laeufe.daten.naechstes).filter(n => n.art !== 'freigabe').slice(0, 4) : [];
  const vorschlaege = stapel.zustand === 'da' ? stapel.daten.vorschlaege : [];
  const offen = stapel.zustand === 'da' ? stapel.daten.offen : ue?.freigaben.anzahl ?? 0;
  const risikoarm = vorschlaege.filter(v => risikoVon(v) === 'risikoarm').length;
  const wartend = faeden.zustand === 'da' ? wartendeFaeden(faeden.daten.faeden).length : 0;
  const alleRisikoarmen = async () => {
    const r = await stapelEntscheiden({ alle: true });
    if (r.ok) melde(`${r.daten.erledigt ?? 0} risikoarme Freigaben erledigt${r.daten.einzeln ? ` — ${r.daten.einzeln} brauchen je einen Blick` : ''}.`, 'gut');
    else melde(r.text, 'kritisch');
  };
  return (
    <Karte ton="fokus" netz ariaLabel="Überblick">
      <div style={{ display: 'grid', gap: ABSTAND.l }}>
        <Abschnitt titel={ue?.seit ? `Seit deinem letzten Besuch (${zeitKurz(ue.seit, jetzt)})` : 'Was passiert ist'}>
          {ue ? (ue.passiert.length ? <Zeilen zeilen={ue.passiert.map(z => ({ ...z, farbe: farbeVon(z.headId) }))} /> : <span style={{ fontSize: TYP.body, color: C.inkDim }}>Seitdem ist nichts passiert.</span>)
            : <Leer>{agenten.zustand === 'laedt' ? 'Der Überblick wird geladen …' : 'Was passiert ist und woran gearbeitet wird, steht hier, sobald der Agenten-Kern läuft.'}</Leer>}
        </Abschnitt>
        {ue && (
          <Abschnitt titel="Woran gearbeitet wird">
            {ue.inArbeit.length ? <Zeilen zeilen={ue.inArbeit.map(z => ({ ...z, farbe: farbeVon(z.headId) }))} /> : <span style={{ fontSize: TYP.body, color: C.inkDim }}>Gerade arbeitet kein Head im Hintergrund.</span>}
          </Abschnitt>
        )}
        {naechste.length > 0 && (
          <Abschnitt titel="Die nächsten Tage">
            <Zeilen zeilen={naechste.map(n => ({ id: n.id, text: n.titel, zeit: n.wann, headId: n.headId, farbe: n.kritisch ? LEUCHT.kritisch : farbeVon(n.headId) }))} />
          </Abschnitt>
        )}
        <Abschnitt titel="Wartet auf dich">
          <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
            <span style={{ fontSize: TYP.body, color: offen || wartend ? C.ink : C.inkDim }}>
              {offen ? `${offen} Freigabe${offen === 1 ? '' : 'n'}` : 'Keine Freigabe offen'}{wartend ? ` · ${wartend} Thread${wartend === 1 ? '' : 's'} mit Rückfrage` : ''}
            </span>
            {risikoarm > 0 && <Knopf onClick={alleRisikoarmen}>{risikoarm} risikoarme freigeben</Knopf>}
            {offen > 0 && <Knopf leise href={WEG.freigaben()}>Alle ansehen ›</Knopf>}
          </div>
        </Abschnitt>
        {ue && ue.ziele.length > 0 && (
          <Abschnitt titel="Jahresziele">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: ABSTAND.s }}>
              {ue.ziele.map(z => (
                <li key={z.id} style={{ display: 'grid', gap: ABSTAND.xs }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: ABSTAND.s, fontSize: TYP.body }}>
                    <Knopf leise href={z.link}>{z.titel} ›</Knopf>
                    <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>{z.fortschritt == null ? '—' : `${z.fortschritt} %`}</span>
                  </div>
                  {z.fortschritt != null && <Fortschritt anteil={z.fortschritt / 100} farbe={C.aktiv} />}
                </li>
              ))}
            </ul>
          </Abschnitt>
        )}
      </div>
    </Karte>
  );
}

export function ZoeMitte() {
  const w = useAgenten();
  const { agenten, laeufe, stapel, faeden, space, melde, oeffne, form } = w;
  const [zuege, setZuege] = useState<Nachricht[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [vorlesen, setVorlesen] = useState(false);
  const stimme = useStimme(() => { /* nur Vorlesen — Diktat sitzt im Feld */ });
  useEffect(() => { setZuege(gemerkt()); }, []);
  useEffect(() => { try { sessionStorage.setItem(MERKER, JSON.stringify(zuege.slice(-60))); } catch { /* egal */ } }, [zuege]);

  const heads = sichtbareHeads(w);
  const ansprechbar = ansprechbarFuer('zoe', heads);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  const offen = stapel.zustand === 'da' ? stapel.daten.offen : ue?.freigaben.anzahl ?? 0;
  const vorschlaege = vorschlaegeHeute({
    freigaben: offen,
    naechstes: laeufe.zustand === 'da' ? laeufe.daten.naechstes : [],
    wartend: faeden.zustand === 'da' ? wartendeFaeden(faeden.daten.faeden).length : 0,
  });

  const senden = async (text: string): Promise<boolean> => {
    const an = ansprache(text, ansprechbar);
    const meins: Nachricht = { id: nr(), rolle: 'person', von: 'ich', text, zeit: zeit() };
    if (an && an.ziel.art === 'head') {
      if (!an.rest) { melde(`Was soll ${an.ziel.name} tun? Schreib den Auftrag hinter @${an.ziel.name}.`, 'info'); return false; }
      setLaeuft(true);
      const r = await fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: an.ziel.id }, text: an.rest, anfrageId: anfrageId() });
      setLaeuft(false);
      if (!r.ok) { melde(r.kommt ? 'Head-Chats kommen mit dem Agenten-Kern — die Nachricht ist noch nicht gesendet.' : r.text, r.kommt ? 'info' : 'kritisch'); return false; }
      const f = r.daten.faden;
      setZuege(z => [...z, meins, { id: nr(), rolle: 'system', von: 'system', text: `An ${an.ziel.name} gesendet`, zeit: zeit(), verweis: { art: 'gesendet', fadenId: f.id, titel: f.titel } }]);
      melde(`An ${an.ziel.name} gesendet.`, 'gut');
      return true;
    }
    const vorher = zuege.filter(z => z.rolle !== 'system').map(z => ({ wer: z.rolle === 'person' ? 'ich' as const : 'zoe' as const, text: z.text }));
    setZuege(z => [...z, meins]);
    setLaeuft(true);
    const kontext = gespraechAlsKontext(vorher);
    const r = await zoeFragen({ message: text, space, ...(kontext ? { context: kontext } : {}) });
    setLaeuft(false);
    const antwort: Nachricht = r.ok
      ? { id: nr(), rolle: 'agent', von: 'zoe', text: r.daten.reply ?? 'Ich habe gerade keine Antwort.', zeit: zeit(), ...(r.daten.ki ? { ki: true as const } : {}),
        ...(r.daten.ran?.length ? { werkzeuge: r.daten.ran.map(x => ({ name: x.agent, ok: x.ok })) } : {}) }
      : { id: nr(), rolle: 'agent', von: 'zoe', text: r.text || 'Ich konnte gerade nicht antworten — versuch es noch einmal.', zeit: zeit() };
    setZuege(z => [...z, antwort]);
    if (vorlesen && r.ok) stimme.lies(fuerStimme(antwort.text));
    return true;
  };

  return (
    <div style={{ display: 'grid', gap: ABSTAND.l, alignContent: 'start' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.m }}>
        <ZoeKopfKugel denkt={laeuft} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink }}>ZOE</h2>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Steuert die Heads, bündelt Freigaben und Berichte.</div>
        </div>
      </header>

      {ue?.briefing && (
        <div style={{ display: 'grid', gap: ABSTAND.xs }}>
          <p style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.6, color: C.ink }}>{ue.briefing}</p>
          {agenten.zustand === 'da' && agenten.daten.ki && <KiMarke text="Briefing von ZOE — bitte prüfen" />}
        </div>
      )}

      <Ueberblick />

      <div style={{ display: 'grid', gap: ABSTAND.xs }}>
        <span style={{ ...MIKRO }}>Vorschläge für heute</span>
        <div className="ui-pillen ui-pillen-einzeilig">
          {vorschlaege.map(v => <Wahl key={v.id} klein an={false} onClick={() => { if (!laeuft) void senden(v.frage); }}>{v.text}</Wahl>)}
        </div>
      </div>

      <ChatVerlauf nachrichten={zuege} stapel={stapel}
        leer={<Leer>Frag ZOE etwas — oder sprich einen Head direkt an: <b>@{ansprechbar[0]?.name ?? 'Head'}</b> und dein Auftrag.</Leer>}
        unten={laeuft ? <Schreibt name="ZOE" /> : undefined} />
      {zuege.length > 0 && (
        <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => setZuege([])}>Neues Gespräch</Knopf>
          {heads.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, alignSelf: 'center' }}>Heads direkt: {heads.slice(0, 3).map(h => (
            <button key={h.id} type="button" onClick={() => oeffne({ h: h.id })} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkDim, font: 'inherit', cursor: 'pointer', padding: `0 ${ABSTAND.xs}px` }}><Chip farbe={headFarbe(h.farbe)}>{h.kurz}</Chip></button>
          ))}</span>}
        </div>
      )}
      <ChatFeld platzhalter="Nachricht an ZOE … (@Head spricht einen Head an)" ansprechbar={ansprechbar} onSenden={senden} laeuft={laeuft}
        vorlesen={{ an: vorlesen, umschalten: setVorlesen }} unten={form === 'handy' ? 'var(--agenten-feld-unten, 0px)' : undefined} />
    </div>
  );
}
