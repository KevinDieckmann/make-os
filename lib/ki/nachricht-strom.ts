// ─── Messages-API im Strom: aus den Ereignissen wieder EINE Antwort bauen (09.10., rein) ───────────────────────────────────────
// `askStream` in lib/anthropic.ts liest die Server-Sent Events der Messages-API (`stream: true`) und gibt am Ende dieselbe Form zurück
// wie ohne Strom (`content`, `stop_reason`, `usage`) — die Schleife (lib/agenten/schleife.ts) reicht `content` unverändert in die nächste
// Runde weiter. Deshalb baut diese Stelle jeden Block vollständig nach: Text, Werkzeug-Aufrufe (Eingabe als JSON-Stücke), Denken samt
// Signatur (muss bei Werkzeug-Runden unverändert zurück), Server-Werkzeuge (Web-Suche) und Zitate.
// Ereignisse laut Doku der Messages-API (Streaming): message_start · content_block_start · content_block_delta (text_delta,
// input_json_delta, thinking_delta, signature_delta, citations_delta) · content_block_stop · message_delta · message_stop · ping · error.
// Nach außen geht als Stück NUR Antworttext (`text_delta`) — nie Denken, nie Werkzeug-Eingaben.

type Obj = Record<string, unknown>;

export interface Verbrauch { ein: number; aus: number; cacheLesen: number; cacheSchreiben: number }

const istObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const kopie = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null)) as T;
const EINGABE_BLOECKE = new Set(['tool_use', 'server_tool_use', 'mcp_tool_use']);

export class NachrichtZusammenbau {
  private start: Obj | null = null;
  private bloecke: (Obj | undefined)[] = [];
  private teilJson = new Map<number, string>();
  private usage: Obj = {};
  private textGezeigt = false;
  private blockMitText = new Set<number>();
  stopReason: string | undefined;
  stopSequence: string | null | undefined;
  fertig = false;
  fehler: { art: string; text: string } | undefined;

  /** Ein Ereignis anwenden. Rückgabe: ein Stück Antworttext für die Oberfläche (oder null). */
  anwenden(name: string, roh: unknown): string | null {
    const d = istObj(roh) ? roh : {};
    switch (name) {
      case 'message_start': {
        this.start = istObj(d.message) ? kopie(d.message) : {};
        if (istObj(this.start.usage)) this.usage = { ...this.start.usage };
        return null;
      }
      case 'content_block_start': {
        const i = Number(d.index);
        if (!Number.isInteger(i) || i < 0 || !istObj(d.content_block)) return null;
        const b = kopie(d.content_block);
        this.bloecke[i] = b;
        if (EINGABE_BLOECKE.has(String(b.type))) this.teilJson.set(i, '');
        return null;
      }
      case 'content_block_delta': {
        const i = Number(d.index);
        const b = this.bloecke[i];
        const delta = istObj(d.delta) ? d.delta : {};
        if (!b) return null;
        switch (delta.type) {
          case 'text_delta': {
            const t = typeof delta.text === 'string' ? delta.text : '';
            b.text = `${typeof b.text === 'string' ? b.text : ''}${t}`;
            if (!t) return null;
            // Zwei Text-Blöcke in einer Antwort stehen ohne Strom mit Zeilenumbruch untereinander (extractText) — im Strom ebenso.
            const vorweg = this.textGezeigt && !this.blockMitText.has(i) ? '\n' : '';
            this.blockMitText.add(i); this.textGezeigt = true;
            return vorweg + t;
          }
          case 'input_json_delta':
            this.teilJson.set(i, `${this.teilJson.get(i) ?? ''}${typeof delta.partial_json === 'string' ? delta.partial_json : ''}`);
            return null;
          case 'thinking_delta':
            b.thinking = `${typeof b.thinking === 'string' ? b.thinking : ''}${typeof delta.thinking === 'string' ? delta.thinking : ''}`;
            return null;
          case 'signature_delta':
            b.signature = `${typeof b.signature === 'string' ? b.signature : ''}${typeof delta.signature === 'string' ? delta.signature : ''}`;
            return null;
          case 'citations_delta':
            if (delta.citation !== undefined) b.citations = [...(Array.isArray(b.citations) ? b.citations : []), delta.citation];
            return null;
          default:
            return null;
        }
      }
      case 'content_block_stop': {
        const i = Number(d.index);
        const b = this.bloecke[i];
        if (b && this.teilJson.has(i)) {
          const j = (this.teilJson.get(i) ?? '').trim();
          if (j) { try { b.input = JSON.parse(j); } catch { b.input = {}; } }
          else if (!istObj(b.input)) b.input = {};
          this.teilJson.delete(i);
        }
        return null;
      }
      case 'message_delta': {
        const delta = istObj(d.delta) ? d.delta : {};
        if (typeof delta.stop_reason === 'string') this.stopReason = delta.stop_reason;
        if (delta.stop_sequence !== undefined) this.stopSequence = delta.stop_sequence as string | null;
        if (istObj(d.usage)) for (const [k, v] of Object.entries(d.usage)) if (typeof v === 'number') this.usage[k] = v;
        return null;
      }
      case 'message_stop':
        this.fertig = true;
        return null;
      case 'error': {
        const e = istObj(d.error) ? d.error : {};
        this.fehler = { art: String(e.type ?? 'error'), text: String(e.message ?? 'Fehler im Strom').slice(0, 220) };
        return null;
      }
      default:
        return null; // ping, unbekannte Ereignisse
    }
  }

  /** Die Antwort in der Form ohne Strom (für `raw`, `extractText` und die nächste Runde). */
  nachricht(): Obj {
    return {
      ...(this.start ?? {}),
      content: this.bloecke.filter((b): b is Obj => !!b),
      stop_reason: this.stopReason ?? null,
      stop_sequence: this.stopSequence ?? null,
      usage: { ...this.usage },
    };
  }

  /** Verbrauch, sobald `message_start` da war — auch bei Abbruch (die Eingabe ist dann schon bezahlt). */
  verbrauch(): Verbrauch | undefined {
    if (!this.start) return undefined;
    const n = (k: string) => (typeof this.usage[k] === 'number' ? this.usage[k] as number : 0);
    return { ein: n('input_tokens'), aus: n('output_tokens'), cacheLesen: n('cache_read_input_tokens'), cacheSchreiben: n('cache_creation_input_tokens') };
  }
}
