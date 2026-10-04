'use client';
// ─── MAKE OS — Karte „Team“ (28.09., U4) ────────────────────────────────────
// Hier wird das Team gepflegt: anlegen, ändern, deaktivieren. Kevin und Malin
// kommen fest aus den Konten (Name dort), Kurzwort/Rolle/Bereich hier. Das
// Kurzwort ist ein Wort — es steht im Delegiert-Marker der Aufgaben.
// Ist der Speicher leer, gelten Rollen-Platzhalter und die Karte bittet, das
// Team einmal einzutragen. Keine automatische Übernahme aus alten Ständen.
// DSGVO-Nachtrag 04.10.: Deaktivieren erst nach Rückfrage — 30 Tage danach löscht der Morgenlauf die Kapazitätsdaten der
// Person (lib/kapazitaet/aufraeumen.ts); bis dahin zeigt die Zeile den Löschtag und die Auskunft (Art. 15, nur der Inhaber).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { useTeam } from '@/hooks/useTeam';
import { KURZ_OK, kurzAus, type TeamEintrag, type TeamPerson } from '@/lib/make-one/team-typen';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Leer, feld, LEUCHT, useRueckfrage } from './ui';
import { neueKennung } from '@/lib/kennung';
import { KAPA_LOESCHEN_NACH_TAGEN, kapaLoeschTag } from '@/lib/kapazitaet/aufraeumen';

const tagDe = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Art. 15: Kapazitätsdaten einer Team-Person als Datei holen — der Server prüft die Rechte (nur der Inhaber). */
async function auskunftHolen(p: TeamPerson): Promise<string | null> {
  try {
    const r = await fetch(`/api/kapazitaet?auskunft=${encodeURIComponent(p.id)}`, { cache: 'no-store' });
    if (!r.ok) return ((await r.json().catch(() => null)) as { fehler?: string } | null)?.fehler ?? `Auskunft nicht erstellt (${r.status}).`;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `kapazitaet-auskunft-${p.id}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  } catch { return 'Keine Verbindung — Auskunft nicht erstellt.'; }
}

type Entwurf = { id?: string; name: string; kurz: string; rolle: string; bereich: string; email: string; kreis: 'kern' | 'partner'; aktiv: boolean; stand?: string; konto: boolean };
const leer: Entwurf = { name: '', kurz: '', rolle: '', bereich: '', email: '', kreis: 'kern', aktiv: true, konto: false };

const ausPerson = (p: TeamPerson): Entwurf => ({
  id: p.id, name: p.name, kurz: p.kurz, rolle: p.rolle, bereich: p.bereich ?? '', email: p.email ?? '',
  kreis: p.kreis, aktiv: p.aktiv, stand: p.stand, konto: p.quelle === 'konto',
});

export function TeamKarte({ i = 3 }: { i?: number }) {
  const { team, ausDaten, geladen, gesperrt, schreiben } = useTeam();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const { fragen, dialog } = useRueckfrage();

  async function speichern() {
    if (!entwurf) return;
    const kurz = entwurf.kurz.trim() || kurzAus(entwurf.name);
    if (!entwurf.name.trim()) { setMeldung('Name fehlt.'); return; }
    if (!KURZ_OK.test(kurz)) { setMeldung('Kurzwort: ein Wort ohne Leerzeichen (höchstens 24 Zeichen).'); return; }
    const eintrag: TeamEintrag = {
      id: entwurf.id ?? neueKennung('t'),
      name: entwurf.name.trim(), kurz, rolle: entwurf.rolle.trim(), aktiv: entwurf.konto ? true : entwurf.aktiv,
      ...(entwurf.bereich.trim() ? { bereich: entwurf.bereich.trim() } : {}),
      ...(!entwurf.konto && entwurf.email.trim() ? { email: entwurf.email.trim() } : {}),
      ...(entwurf.kreis === 'partner' ? { kreis: 'partner' as const } : {}),
    };
    const r = await schreiben([{ op: 'upsert', eintrag, ...(entwurf.stand ? { stand: entwurf.stand } : {}) }]);
    if (r.ok) { setEntwurf(null); setMeldung(null); } else setMeldung(r.fehler ?? 'Nicht gespeichert.');
  }

  async function aktivSetzen(p: TeamPerson, aktiv: boolean) {
    const r = await schreiben([{ op: 'teil', id: p.id, felder: { aktiv }, ...(p.stand ? { stand: p.stand } : {}) }]);
    setMeldung(r.ok ? null : r.fehler ?? 'Nicht gespeichert.');
  }

  const deaktivieren = (p: TeamPerson) => fragen({
    titel: `${p.name} deaktivieren?`,
    text: `Die Person bekommt keine Aufgaben mehr. Ihre Kapazitätsdaten (Grundwert, Urlaub und Blöcke, Zuweisungen, Einwilligung) werden ${KAPA_LOESCHEN_NACH_TAGEN} Tage nach dem Deaktivieren automatisch gelöscht — reaktivierst du sie vorher, bleibt alles.`,
    wahl: [{ label: 'Deaktivieren', ton: 'gefahr', tun: () => aktivSetzen(p, false) }],
  });
  const inaktivText = (p: TeamPerson) => {
    const ab = kapaLoeschTag(p);
    if (!p.deaktiviertAm || !ab) return null;
    const tag = new Date(p.deaktiviertAm).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    return `deaktiviert seit ${tagDe(tag)} · Kapazitätsdaten ${ab <= new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }) ? 'werden beim nächsten Morgenlauf gelöscht' : `werden ab ${tagDe(ab)} gelöscht`}`;
  };

  const kern = team.filter(p => p.kreis === 'kern');
  const partner = team.filter(p => p.kreis !== 'kern');
  const pflegbar = geladen && !gesperrt;

  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.beziehung} rechts={pflegbar && !entwurf ? <Knopf leise onClick={() => { setEntwurf({ ...leer }); setMeldung(null); }}>+ Person</Knopf> : undefined}>Team — wer was trägt</Ueberschrift>
      {pflegbar && !ausDaten && (
        <Leer>Team einmal eintragen: Noch stehen hier nur Rollen als Platzhalter. Leg die Personen mit Name, Kurzwort und Rolle an — Delegation, Inbox und ZOE nutzen dann die echten Namen.</Leer>
      )}
      {entwurf && (
        <div style={{ display: 'grid', gap: 8, margin: '4px 0 14px' }}>
          <input aria-label="Name" placeholder="Name" value={entwurf.name} disabled={entwurf.konto} onChange={e => setEntwurf({ ...entwurf, name: e.target.value })} style={feld} />
          <input aria-label="Kurzwort" placeholder={`Kurzwort (ein Wort, z. B. ${kurzAus(entwurf.name || 'Vorname')})`} value={entwurf.kurz} onChange={e => setEntwurf({ ...entwurf, kurz: e.target.value })} style={feld} />
          <input aria-label="Rolle" placeholder="Rolle (z. B. Finanzen)" value={entwurf.rolle} onChange={e => setEntwurf({ ...entwurf, rolle: e.target.value })} style={feld} />
          <input aria-label="Bereich" placeholder="Bereich / Zuständigkeiten (optional)" value={entwurf.bereich} onChange={e => setEntwurf({ ...entwurf, bereich: e.target.value })} style={feld} />
          {!entwurf.konto && <input aria-label="E-Mail" placeholder="E-Mail (optional)" value={entwurf.email} onChange={e => setEntwurf({ ...entwurf, email: e.target.value })} style={feld} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf leise={entwurf.kreis !== 'kern'} onClick={() => setEntwurf({ ...entwurf, kreis: 'kern' })}>Kern-Team</Knopf>
            <Knopf leise={entwurf.kreis !== 'partner'} onClick={() => setEntwurf({ ...entwurf, kreis: 'partner' })}>Extern</Knopf>
            <span style={{ flex: 1 }} />
            <Knopf leise onClick={() => { setEntwurf(null); setMeldung(null); }}>Abbrechen</Knopf>
            <Knopf onClick={speichern}>Speichern</Knopf>
          </div>
        </div>
      )}
      {meldung && <p style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '0 0 8px' }}>{meldung}</p>}
      <Liste>
        {[...kern, ...partner].map(p => (
          <Zeile key={p.id}
            titel={<span style={{ color: !p.aktiv ? C.inkLeise : p.quelle === 'platzhalter' ? C.inkDim : C.ink }}>{p.name}{p.kurz !== p.name ? <span style={{ color: C.inkLeise }}> · {p.kurz}</span> : null}</span>}
            unter={<span title={[p.rolle, p.bereich].filter(Boolean).join(' · ')}>{[p.rolle, p.bereich].filter(Boolean).join(' · ') || '—'}{!p.aktiv && inaktivText(p) ? <span style={{ display: 'block', color: C.inkLeise }}>{inaktivText(p)}</span> : null}</span>}
            rechts={
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Chip farbe={p.quelle === 'konto' ? LEUCHT.beziehung : p.quelle === 'platzhalter' ? C.inkLeise : p.kreis === 'kern' ? LEUCHT.beziehung : C.inkDim}>
                  {p.quelle === 'konto' ? 'Konto' : p.quelle === 'platzhalter' ? 'Platzhalter' : !p.aktiv ? 'inaktiv' : p.kreis === 'kern' ? 'kern' : 'extern'}
                </Chip>
                {pflegbar && p.quelle !== 'platzhalter' && !entwurf && <Knopf leise onClick={() => { setEntwurf(ausPerson(p)); setMeldung(null); }}>Ändern</Knopf>}
                {pflegbar && p.quelle === 'daten' && !entwurf && <Knopf leise onClick={async () => { if (p.aktiv) deaktivieren(p); else await aktivSetzen(p, true); }}>{p.aktiv ? 'Deaktivieren' : 'Aktivieren'}</Knopf>}
                {pflegbar && p.quelle === 'daten' && !p.aktiv && !entwurf && <Knopf leise ariaLabel={`Auskunft über die Kapazitätsdaten von ${p.name} (Art. 15)`} onClick={async () => setMeldung(await auskunftHolen(p))}>Auskunft</Knopf>}
              </span>
            } />
        ))}
      </Liste>
      {dialog}
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '10px 0 0' }}>Die Grundlage für jede Delegation. Kevin und Malin kommen aus den Konten; das Kurzwort steht im Marker „Delegiert an …“.</p>
    </Karte>
  );
}
