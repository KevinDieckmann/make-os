'use client';

// ─── Agenten-Seite: die Mitte mit einem Mitarbeiter-Thread (09.10., Paket 2) ───────────────────────────────────────────
// Brotkrumen „Head › Mitarbeiter › Thread“, darunter der Auftrag des Heads (Ziel · Format · Grenzen · Quellen), der Fortschritt
// in Schritten mit Dauer und Kosten, der Verlauf und das eigene Feld — mit jedem Mitarbeiter kann man direkt sprechen
// (Antwort 4). „Zweite Meinung“ (Fragerunde 10) schickt das Ergebnis zur Prüfung an den Head zurück — in seinen Thread.
// Ohne Kennung (`entwurf`) ist es ein neuer Thread: das erste Senden legt ihn an.

import { useState } from 'react';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, MIKRO, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import type { FadenAntwort, HeadKarte, LaufSchritt, Nachricht } from '@/lib/agenten/typen';
import { Chip, Eigenschaft, Hinweis, Karte, Knopf, Leer, Leerzustand } from '../ui';
import { KuerzelKugel, headFarbe } from './Avatar';
import { ChatFeld, ChatVerlauf, Schreibt } from './Chat';
import { anfrageId, fadenSenden, ladeFaden, laeufeSenden, meldeNeu, useAbruf, type Abruf } from './daten';
import { headKarte, useAgenten } from './kontext';
import { agentAusSchluessel, dauerText, delegationTeile, euro, FADEN_STATUS_NAME, zeitKurz } from './regeln';
import { KUGEL_GROESSE } from './masse';

const SCHRITT_ZEICHEN: Readonly<Record<LaufSchritt['status'], string>> = { offen: '○', laeuft: '◐', fertig: '✓', fehler: '✕', uebersprungen: '–' };
const SCHRITT_FARBE: Readonly<Record<LaufSchritt['status'], string>> = { offen: C.inkLeise, laeuft: C.aktiv, fertig: LEUCHT.gut, fehler: LEUCHT.kritisch, uebersprungen: C.inkLeise };

function Brotkrumen({ k, mitarbeiter, titel }: { k: HeadKarte | null; mitarbeiter: string; titel?: string }) {
  const { oeffne } = useAgenten();
  return (
    <nav aria-label="Brotkrumen" style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.xs, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
      {k ? <button type="button" onClick={() => oeffne({ h: k.id })} className="fassbar" style={{ background: 'none', border: 'none', padding: `0 ${ABSTAND.xs}px`, minHeight: ZIEL.rechner, color: C.inkDim, font: 'inherit', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>{k.kurz}</button> : <span>Head</span>}
      <span aria-hidden>›</span>
      <span>{mitarbeiter}</span>
      {titel && <><span aria-hidden>›</span><span style={{ color: C.ink, fontWeight: 600 }}>„{titel}“</span></>}
    </nav>
  );
}

function Auftrag({ n, k }: { n: Nachricht; k: HeadKarte | null }) {
  const { jetzt } = useAgenten();
  const d = delegationTeile(n.text);
  return (
    <Karte flach>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Auftrag von {k?.name ?? 'Head'} · {zeitKurz(n.zeit, jetzt)}</span>
        {d ? (
          <div style={{ display: 'grid', gap: ABSTAND.xs }}>
            {d.ziel && <Eigenschaft label="Ziel">{d.ziel}</Eigenschaft>}
            {d.format && <Eigenschaft label="Format">{d.format}</Eigenschaft>}
            {d.grenzen && <Eigenschaft label="Grenzen">{d.grenzen}</Eigenschaft>}
            {d.quellen && <Eigenschaft label="Quellen">{d.quellen}</Eigenschaft>}
          </div>
        ) : <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</div>}
      </div>
    </Karte>
  );
}

function LaufKopf({ fa }: { fa: FadenAntwort }) {
  const { laeufe, melde, bestaetigen, jetzt } = useAgenten();
  const l = fa.faden.lauf;
  if (!l) return null;
  const lauf = laeufe.zustand === 'da' ? laeufe.daten.laeufe.find(x => x.fadenId === fa.faden.id) : undefined;
  const fertig = l.schritte.filter(s => s.status === 'fertig').length;
  const dauer = l.ende ? Date.parse(l.ende) - Date.parse(l.start) : jetzt.getTime() - Date.parse(l.start);
  const tu = async (aktion: 'abbrechen' | 'neu-starten') => {
    if (!lauf) { melde('Diesen Lauf kennt die Liste der Hintergrundaufgaben noch nicht.', 'info'); return; }
    if (aktion === 'abbrechen' && !(await bestaetigen({ titel: 'Lauf abbrechen?', text: 'Was schon fertig ist, bleibt im Thread.', ja: 'Abbrechen', gefahr: true }))) return;
    const r = await laeufeSenden({ aktion, laufId: lauf.id });
    if (r.ok) melde(aktion === 'abbrechen' ? 'Lauf abgebrochen.' : 'Lauf startet neu.', 'gut');
    else melde(r.kommt ? 'Abbrechen und Neu starten kommen mit dem nächsten Paket.' : r.text, r.kommt ? 'info' : 'kritisch');
  };
  const farbe = l.status === 'laeuft' ? C.aktiv : l.status === 'fehler' ? LEUCHT.kritisch : l.status === 'fertig' ? LEUCHT.gut : C.inkDim;
  return (
    <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: `${ABSTAND.m}px ${ABSTAND.l}px`, display: 'grid', gap: ABSTAND.s, borderColor: TIEF.rand(farbe) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
        <Chip farbe={farbe}>{l.status === 'laeuft' ? 'läuft' : l.status === 'fertig' ? 'fertig' : l.status === 'fehler' ? 'Fehler' : l.status}</Chip>
        <span>Schritt {Math.min(fertig + (l.status === 'laeuft' ? 1 : 0), l.schritte.length)}/{l.schritte.length}</span>
        <span>· {dauerText(dauer)}</span>
        <span>· {euro(l.kostenCent)}{l.kostenGrenzeCent ? ` von ${euro(l.kostenGrenzeCent)}` : ''}</span>
        <span style={{ flex: 1 }} />
        {l.status === 'laeuft' && <Knopf leise onClick={() => tu('abbrechen')}>Stopp</Knopf>}
        {(l.status === 'fehler' || l.status === 'abgebrochen') && <Knopf leise onClick={() => tu('neu-starten')}>Neu starten</Knopf>}
      </div>
      <ol aria-label="Schritte" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: ABSTAND.m, flexWrap: 'wrap' }}>
        {l.schritte.map(s => (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.xs, fontSize: TYP.bedien, color: s.status === 'offen' ? C.inkLeise : C.ink }}>
            <span aria-hidden className={s.status === 'laeuft' ? 'krit-puls' : undefined} style={{ color: SCHRITT_FARBE[s.status], fontWeight: 700 }}>{SCHRITT_ZEICHEN[s.status]}</span>{s.titel}
          </li>
        ))}
      </ol>
      {l.fehler && <Hinweis art="kritisch">{l.fehler}</Hinweis>}
    </div>
  );
}

export function FadenMitte({ fadenId }: { fadenId?: string }) {
  const w = useAgenten();
  const { entwurf, starteEntwurf, oeffne, stapel, melde, dialog, form } = w;
  const vorgegeben = fadenId ? w.vorlage?.faeden?.[fadenId] : undefined;
  const geladen = useAbruf<FadenAntwort>(fadenId && !vorgegeben ? `faden:${fadenId}` : null, () => ladeFaden(fadenId!));
  const stand: Abruf<FadenAntwort> = vorgegeben ? { zustand: 'da', daten: vorgegeben } : geladen.stand;
  const fa = stand.zustand === 'da' ? stand.daten : null;
  const [wartend, setWartend] = useState<Nachricht | null>(null);

  const agent = fa ? fa.faden.agent : entwurf ? { art: 'mitarbeiter' as const, ...entwurf } : null;
  const k = agent && agent.art !== 'zoe' ? headKarte(w, agent.headId) : null;
  const m = agent?.art === 'mitarbeiter' ? k?.mitarbeiter.find(x => x.id === agent.mitarbeiterId) : undefined;
  const name = m?.name ?? (agent?.art === 'head' ? k?.kurz : undefined) ?? 'Mitarbeiter';
  const farbe = headFarbe(k?.farbe);

  if (!agent) {
    if (stand.zustand === 'kommt') return <Leerzustand symbol="↳" titel="Threads kommen">Mitarbeiter-Threads erscheinen hier, sobald der Agenten-Kern läuft.</Leerzustand>;
    if (stand.zustand === 'fehler' || stand.zustand === 'gesperrt') return <Hinweis art="kritisch" aktion={<Knopf leise onClick={meldeNeu}>Noch einmal versuchen</Knopf>}>{stand.text}</Hinweis>;
    return <Leer>Thread wird geladen …</Leer>;
  }

  // Der erste Text des Heads im Thread ist der Auftrag (C3: Ziel, Format, Grenzen, Quellen).
  const alle = fa?.faden.nachrichten ?? [];
  const auftragIndex = alle.findIndex(n => n.rolle === 'agent' && agentAusSchluessel(n.von)?.art === 'head');
  const auftrag = auftragIndex === 0 ? alle[0] : null;
  const rest = auftrag ? alle.slice(1) : alle;

  const senden = async (text: string): Promise<boolean> => {
    setWartend({ id: 'nr-wartet', rolle: 'person', von: 'ich', text, zeit: new Date().toISOString() });
    const r = await fadenSenden({ aktion: 'senden', agent, text, ...(fa ? { fadenId: fa.faden.id, stand: fa.stand } : {}), anfrageId: anfrageId() });
    setWartend(null);
    if (!r.ok) {
      melde(r.kommt ? `Der Thread mit ${name} kommt mit dem Agenten-Kern — die Nachricht ist noch nicht gesendet.` : r.status === 409 ? 'Der Thread hat sich geändert — neu geladen. Bitte noch einmal senden.' : r.text, r.kommt ? 'info' : 'kritisch');
      if (r.status === 409) meldeNeu();
      return false;
    }
    if (!fa) { starteEntwurf(null); oeffne({ f: r.daten.faden.id }); }
    return true;
  };

  const zweiteMeinung = async () => {
    if (!fa || !k) return;
    const text = `Zweite Meinung bitte: Prüf das Ergebnis aus Thread „${fa.faden.titel}“ (${name}) kritisch — was fehlt, was stimmt nicht, was würdest du anders machen?`;
    const r = await fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: k.id }, text, ...(fa.faden.elternId ? { fadenId: fa.faden.elternId } : {}), anfrageId: anfrageId() });
    if (r.ok) { melde(`${k.kurz} prüft das Ergebnis.`, 'gut'); oeffne({ h: k.id, f: r.daten.faden.id }); }
    else melde(r.kommt ? 'Die zweite Meinung kommt mit dem Agenten-Kern.' : r.text, r.kommt ? 'info' : 'kritisch');
  };

  const nachrichten = [...rest, ...(wartend ? [wartend] : [])];
  return (
    <div style={{ display: 'grid', gap: ABSTAND.l, alignContent: 'start' }}>
      <Brotkrumen k={k} mitarbeiter={name} titel={fa?.faden.titel} />
      <header style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.m }}>
        <KuerzelKugel name={name} farbe={farbe} bereich={k?.bereich} groesse={KUGEL_GROESSE.kopf} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink }}>{name}</h2>
          <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>{m?.rolle ?? (fa ? FADEN_STATUS_NAME[fa.faden.status] : '')}</div>
        </div>
        {fa && <Chip farbe={fa.faden.status === 'wartet' ? LEUCHT.achtung : fa.faden.status === 'fehler' ? LEUCHT.kritisch : C.inkDim}>{FADEN_STATUS_NAME[fa.faden.status]}</Chip>}
      </header>
      {fa?.faden.fremdGelesen && <Hinweis art="info">Dieser Thread hat fremden Text gelesen (Web, Mails, Notizen) — alles Schreibende geht ab jetzt nur als Vorschlag.</Hinweis>}
      {fa && <LaufKopf fa={fa} />}
      {auftrag && <Auftrag n={auftrag} k={k} />}
      <ChatVerlauf nachrichten={nachrichten} kinder={fa?.kinder ?? []} stapel={stapel}
        leer={fa ? <Leer>Noch keine Antwort in diesem Thread.</Leer> : <Leerzustand symbol="↳" titel={`Neuer Thread mit ${name}`}>Schreib den Auftrag: Ziel, Format, Grenzen und Quellen — dann arbeitet {name} los.</Leerzustand>}
        onAlsSkill={k ? (n) => dialog({ art: 'skill', headId: k.id, entwurf: { anleitung: n.text, quelle: 'gespraech', ...(m ? { mitarbeiterId: m.id } : {}) } }) : undefined}
        unten={wartend ? <Schreibt name={name} /> : undefined} />
      <ChatFeld platzhalter={fa ? `Nachricht an ${name} …` : `Auftrag an ${name} — Ziel, Format, Grenzen, Quellen …`} onSenden={senden} laeuft={!!wartend}
        zusatz={fa && k ? <Knopf leise onClick={zweiteMeinung}>Zweite Meinung</Knopf> : undefined}
        unten={form === 'handy' ? 'var(--agenten-feld-unten, 0px)' : undefined} />
    </div>
  );
}
