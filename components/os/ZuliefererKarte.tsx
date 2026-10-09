'use client';

// ─── Mac-Zulieferer abschalten (08.10., Lücke 10 der Roadmap, Kevin R6) — Karte unter Einstellungen › Verbindungen ─────────
// Kevin: „alles nur auf dem Server führen; wir brauchen nachher im Mac nur noch die API zur Mail, den Rest haben wir ja in MAKE OS.“
// Nur der Inhaber sieht die Karte (GET /api/zulieferer → 403 für alle anderen, dann zeigt sie nichts). Drei Teile:
//   1. Apple-Erinnerungen einmal als Aufgaben übernehmen — Vorschau (Titel, Fälligkeit, Liste → Space, „schon übernommen“), dann
//      Bestätigen (Rückfrage). Zweimal bestätigen legt nichts doppelt an.
//   2. Schalter: an/aus (nach der Übernahme ist er von selbst aus; ausschalten vorher nur ausdrücklich).
//   3. Spiegel vom Mac löschen (erst wenn aus) + der Weg am Mac (scripts/mac-zulieferer-entfernen.sh).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, Hinweis, Schalter, Klappbar, Leer, LEUCHT, useRueckfrage } from './ui';
import { Wahl } from './crm/Wahl';
import type { Vorschau } from '@/lib/zulieferer/erinnerungen';
import { useInhaber } from './useInhaber';

interface Lage { aktiv: boolean; quelle: string; quelleText: string; umgebung: 'an' | 'aus' | null; uebernahmeAm: string | null; altbestand: boolean; spiegel: { erinnerungen: boolean; kontakte: boolean } }
interface Stand {
  lage: Lage;
  spiegel: Record<'erinnerungen' | 'kontakte', { da: boolean; at: string | null; anzahl: number }>;
  uebernahme: { vorschau: Vorschau; spaces: { id: string; label: string; bereich: string }[]; at: string | null; stand: { bestaetigtAm?: string; laeufe: { am: string; neu: number; schon: number }[] } };
}

const tag = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—');
const zeit = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function ZuliefererKarte({ i = 0 }: { i?: number }) {
  const [s, setS] = useState<Stand | null>(null);
  const [darf, setDarf] = useState(true);
  const [spaces, setSpaces] = useState<Record<string, string>>({});
  const [ohne, setOhne] = useState<Set<string>>(new Set());
  const [erledigte, setErledigte] = useState(false);
  const [nurIch, setNurIch] = useState(true);
  const [zeilenOffen, setZeilenOffen] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'info'; text: string } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = async () => {
    const r = await fetch('/api/zulieferer', { cache: 'no-store' }).catch(() => null);
    if (!r || r.status === 401 || r.status === 403) { setDarf(false); return; }
    const d = await r.json().catch(() => null) as (Stand & { ok?: boolean }) | null;
    if (d?.ok) setS(d);
  };
  // Nur Inhaber (die Route ist die Schranke) — sonst gar keine Anfrage (09.10., Seiten-Durchlauf: 403 in der Konsole der zweiten Person).
  const inhaber = useInhaber();
  useEffect(() => { if (inhaber) void laden(); else if (inhaber === false) setDarf(false); }, [inhaber]);

  const v = s?.uebernahme.vorschau;
  const neue = useMemo(() => (v?.zeilen ?? []).filter(z => !z.schon && !ohne.has(z.kennung) && (erledigte || !z.erledigt)), [v, ohne, erledigte]);
  if (!darf) return null;
  if (!s) return <Karte i={i}><Ueberschrift farbe={LEUCHT.puls}>Mac-Zulieferer</Ueberschrift><Leer>lade …</Leer></Karte>;

  const { lage } = s;
  const spaceListe = s.uebernahme.spaces.map(x => ({ id: x.id, label: x.label }));
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/zulieferer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as Record<string, unknown> : {};
    return { ok: !!r?.ok && d.ok !== false, status: r?.status ?? 0, d };
  };

  const uebernehmen = async () => {
    setMeldung(null);
    const ok = await bestaetigen({ titel: `${neue.length} Erinnerung${neue.length === 1 ? '' : 'en'} als Aufgaben anlegen?`, text: `Verantwortlich bist du; im Space Privat ${nurIch ? 'mit „nur ich“' : 'für den Haushalt sichtbar'}. Notiz und Fälligkeit wandern mit.\nWas schon übernommen ist, wird nicht noch einmal angelegt. Danach ist der Zulieferer aus.`, ja: 'Übernehmen' });
    if (!ok) return;
    const r = await post({ aktion: 'uebernehmen', wahl: { spaces, ohne: Array.from(ohne), erledigte, nurIchPrivat: nurIch } });
    if (r.ok) setMeldung({ art: 'gut', text: `${Number(r.d.neu ?? 0)} Aufgabe${Number(r.d.neu) === 1 ? '' : 'n'} angelegt${Number(r.d.schon) ? ` · ${Number(r.d.schon)} waren schon da` : ''}${r.d.fortgesetzt ? ' · eine unterbrochene Übernahme wurde fertig gestellt' : ''}.` });
    else setMeldung({ art: 'kritisch', text: String(r.d.fehler ?? 'Die Übernahme ging nicht durch.') });
    await laden();
  };

  const schalten = async (an: boolean) => {
    setMeldung(null);
    let r = await post({ aktion: 'schalten', an });
    if (!r.ok && r.status === 409 && typeof r.d.offen === 'number') {
      const ja = await bestaetigen({ titel: 'Ohne Übernahme ausschalten?', text: `${String(r.d.fehler)}\nDie Erinnerungen bleiben in Apple; der Spiegel hier bleibt, bis du ihn löschst.`, ja: 'Trotzdem ausschalten', gefahr: true });
      if (!ja) return;
      r = await post({ aktion: 'schalten', an, ohneUebernahme: true });
    }
    if (!r.ok) setMeldung({ art: 'kritisch', text: String(r.d.fehler ?? 'Nicht umgeschaltet.') });
    await laden();
  };

  const spiegelLoeschen = async (art: 'erinnerungen' | 'kontakte') => {
    setMeldung(null);
    const offenUebrig = art === 'erinnerungen' && !lage.uebernahmeAm && (v?.zaehler.neuOffen ?? 0) > 0;
    const ok = await bestaetigen({
      titel: art === 'erinnerungen' ? 'Erinnerungs-Spiegel löschen?' : 'Adressbuch-Spiegel löschen?',
      text: `Die Kopie vom Mac auf dem Server geht ganz weg (auch die Tageskopien). In Apple bleibt alles, wie es ist.${offenUebrig ? `\nAchtung: ${v?.zaehler.neuOffen} offene Erinnerungen sind noch nicht übernommen.` : ''}`,
      ja: 'Löschen', gefahr: true,
    });
    if (!ok) return;
    const r = await post({ aktion: 'spiegel-loeschen', art });
    setMeldung(r.ok ? { art: 'gut', text: r.d.war ? 'Spiegel gelöscht.' : 'Es gab keinen Spiegel mehr.' } : { art: 'kritisch', text: String(r.d.fehler ?? 'Nicht gelöscht.') });
    await laden();
  };

  const chip = lage.aktiv ? { label: 'läuft', farbe: LEUCHT.achtung } : { label: 'aus', farbe: LEUCHT.gut };
  return (
    <Karte i={i} akzent={lage.aktiv ? LEUCHT.achtung : undefined}>
      {dialog}
      <Ueberschrift farbe={LEUCHT.puls} rechts={<Chip farbe={chip.farbe}>{chip.label}</Chip>}>Mac-Zulieferer</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
        {lage.quelleText}{lage.uebernahmeAm ? ` · Erinnerungen übernommen am ${tag(lage.uebernahmeAm)}` : ''}. Kalender und Mail holt der Server selbst; am Mac bleibt nur der Mail-Zugang.
      </div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis></div>}

      {s.spiegel.erinnerungen.da && v && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <div style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>Apple-Erinnerungen als Aufgaben übernehmen</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
            Stand vom Mac: {zeit(s.uebernahme.at)} · {v.zaehler.offen} offen · {v.zaehler.erledigt} erledigt{v.zaehler.schon ? ` · ${v.zaehler.schon} schon übernommen` : ''}
          </div>
          {v.listen.map(l => (
            <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 44 }}>
              <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: TYP.bedien, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name} <span style={{ color: C.inkLeise }}>· {l.anzahl}</span></span>
              <Wahl label={`Space für „${l.name}“`} liste={spaceListe} wert={spaces[l.name] ?? l.space} onWahl={id => setSpaces(x => ({ ...x, [l.name]: id }))} klein />
            </div>
          ))}
          <Schalter an={nurIch} onChange={setNurIch}>Im Space Privat „nur ich“</Schalter>
          {v.zaehler.erledigt > 0 && <Schalter an={erledigte} onChange={setErledigte}>Erledigte mitnehmen ({v.zaehler.erledigt})</Schalter>}
          <Klappbar id="zulieferer-zeilen" titel="Einzeln ansehen und abwählen" offen={zeilenOffen} umschalten={() => setZeilenOffen(o => !o)} zaehler={v.zeilen.length}>
            <div style={{ display: 'grid', gap: 2 }}>
              {v.zeilen.filter(z => erledigte || !z.erledigt || z.schon).map(z => (
                <label key={z.kennung} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: TYP.bedien, color: z.schon ? C.inkLeise : C.ink, cursor: z.schon ? 'default' : 'pointer' }}>
                  <input type="checkbox" disabled={z.schon} checked={!z.schon && !ohne.has(z.kennung)} onChange={() => setOhne(o => { const n = new Set(o); if (n.has(z.kennung)) n.delete(z.kennung); else n.add(z.kennung); return n; })} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: z.erledigt ? 'line-through' : undefined }}>{z.titel}</span>
                  <span style={{ color: C.inkLeise, fontFamily: SCHRIFT.mono, whiteSpace: 'nowrap' }}>{z.schon ? 'schon übernommen' : z.tag ? `${tag(z.tag)}${z.zeit ? ` ${z.zeit}` : ''}` : ''}</span>
                </label>
              ))}
            </div>
          </Klappbar>
          <div><Knopf haupt aus={!neue.length} onClick={uebernehmen}>{neue.length ? `${neue.length} als Aufgaben übernehmen` : 'Nichts mehr zu übernehmen'}</Knopf></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {lage.umgebung === null && lage.aktiv && <Knopf leise onClick={() => schalten(false)}>Zulieferer ausschalten</Knopf>}
        {lage.umgebung === null && !lage.aktiv && lage.altbestand && <Knopf leise onClick={() => schalten(true)}>Wieder einschalten</Knopf>}
        {!lage.aktiv && s.spiegel.erinnerungen.da && <Knopf leise onClick={() => spiegelLoeschen('erinnerungen')}>Erinnerungs-Spiegel löschen</Knopf>}
        {!lage.aktiv && s.spiegel.kontakte.da && <Knopf leise onClick={() => spiegelLoeschen('kontakte')}>Adressbuch-Spiegel löschen ({s.spiegel.kontakte.anzahl})</Knopf>}
      </div>
      {!lage.aktiv && lage.altbestand && (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12, lineHeight: 1.6 }}>
          Am Mac den Dienst entfernen: <code style={{ fontFamily: SCHRIFT.mono }}>bash scripts/mac-zulieferer-entfernen.sh</code> (zeigt erst nur an), dann mit <code style={{ fontFamily: SCHRIFT.mono }}>--ausfuehren</code>.
        </div>
      )}
    </Karte>
  );
}
