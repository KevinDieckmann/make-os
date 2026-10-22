'use client';

// ─── Prozesse · Werkstatt — Kopieren und „Als Vorlage speichern“ (22.10.; nach dem Demo-Rundgang: „alles muss anpassbar sein und immer wieder zu bearbeiten“) ──
// Steht unten im Steckbrief (ohne Auswahl): „Kopie anlegen“ legt einen neuen Prozess aus dem Entwurf an (neue Kennungen, Version 1 im Probelauf bzw. Entwurf) und
// führt dorthin; „Als Vorlage speichern“ legt Struktur und Texte in die eigenen Vorlagen des Haushalts (ohne Personen und Fall-Daten — die Galerie „Aus Vorlage
// anlegen“ zeigt sie unter „Eigene Vorlagen“). Beides über den EINEN Schreibweg der Werkstatt, einmalig über `anfrageId`. Rechnet nichts (lib/prozesse/kopie.ts).

import { useState } from 'react';
import { Copy, LayoutTemplate } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, feld } from '../ui';
import { neueKennung } from '@/lib/kennung';
import { PROZESS_TEXT } from '@/lib/prozesse/definition';
import { werkstattSenden } from './werkstatt-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;

export function ProzessKopieren({ prozessId, titel, vorher, onKopiert }: {
  prozessId: string; titel: string;
  /** Ausstehendes vorher speichern (die Kopie nimmt den gespeicherten Entwurf). */
  vorher: () => Promise<boolean>;
  onKopiert: (id: string) => void;
}) {
  const [vorlageOffen, setVorlageOffen] = useState(false);
  const [name, setName] = useState(titel);
  const [beschreibung, setBeschreibung] = useState('');
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'info'; text: string } | null>(null);
  const [anfrage, setAnfrage] = useState(() => ({ kopie: neueKennung('pza'), vorlage: neueKennung('pza') }));
  const kopieren = async () => {
    setMeldung(null);
    if (!(await vorher())) { setMeldung({ art: 'kritisch', text: 'Erst muss der Entwurf gespeichert sein.' }); return; }
    const r = await werkstattSenden(() => ({ aktion: 'kopieren', id: prozessId, anfrageId: anfrage.kopie }));
    const id = (r.j?.eintrag as { id?: string } | undefined)?.id;
    setAnfrage(a => ({ ...a, kopie: neueKennung('pza') }));
    if (r.status === 200 && r.j?.ok && id) { onKopiert(id); return; }
    setMeldung({ art: 'kritisch', text: String(r.j?.fehler ?? 'Die Kopie ließ sich nicht anlegen.') });
  };
  const alsVorlage = async () => {
    setMeldung(null);
    if (!(await vorher())) { setMeldung({ art: 'kritisch', text: 'Erst muss der Entwurf gespeichert sein.' }); return; }
    const r = await werkstattSenden(() => ({ aktion: 'als-vorlage', id: prozessId, titel: name.trim(), beschreibung: beschreibung.trim(), anfrageId: anfrage.vorlage }));
    setAnfrage(a => ({ ...a, vorlage: neueKennung('pza') }));
    if (r.status === 200 && r.j?.ok) {
      const h = Array.isArray(r.j.hinweise) ? (r.j.hinweise as string[]) : [];
      setMeldung({ art: 'gut', text: `Als Vorlage gespeichert — „Aus Vorlage anlegen“ zeigt sie unter „Eigene Vorlagen“.${h.length ? ` ${h.join(' ')}` : ''}` });
      setVorlageOffen(false);
      return;
    }
    setMeldung({ art: 'kritisch', text: String(r.j?.fehler ?? 'Die Vorlage ließ sich nicht speichern.') });
  };
  return (
    <section aria-label="Kopieren und Vorlage" style={{ display: 'grid', gap: 8 }}>
      <div style={{ ...MIKRO }}>Weiterverwenden</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Knopf leise onClick={kopieren} titel="Einen neuen Prozess aus diesem Entwurf anlegen (neue Kennungen, Probelauf bzw. Entwurf)"><span className="pz-knopf-inhalt"><Copy size={14} aria-hidden />Kopie anlegen</span></Knopf>
        <Knopf leise onClick={() => setVorlageOffen(o => !o)} titel="Struktur und Texte als eigene Vorlage des Haushalts speichern — ohne Personen und Fall-Daten"><span className="pz-knopf-inhalt"><LayoutTemplate size={14} aria-hidden />Als Vorlage speichern</span></Knopf>
      </div>
      {vorlageOffen && (
        <form onSubmit={async e => { e.preventDefault(); await alsVorlage(); }} style={{ display: 'grid', gap: 8 }}>
          <p style={klein}>Gespeichert werden Phasen, Bausteine, Texte und Fristen. Eigner und „läuft als“ fallen weg, Personen in Schritten stehen als „Zuständig im Fall“, eigene Postfächer als „Postfach des Laufs“.</p>
          <Feldzeile label="Name der Vorlage *"><input aria-label="Name der Vorlage" value={name} maxLength={PROZESS_TEXT.titel} onChange={e => setName(e.target.value)} style={feld} /></Feldzeile>
          <Feldzeile label="Beschreibung"><textarea aria-label="Beschreibung der Vorlage" value={beschreibung} maxLength={PROZESS_TEXT.beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={3} style={{ ...feld, resize: 'vertical' }} /></Feldzeile>
          <div><Knopf typ="submit" aus={!name.trim()}><span className="pz-knopf-inhalt"><LayoutTemplate size={14} aria-hidden />Speichern</span></Knopf></div>
        </form>
      )}
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
    </section>
  );
}
