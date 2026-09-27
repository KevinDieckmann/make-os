// Alte Adresse /jarvis → /zoe (Umbenennung 27.09.). Lesezeichen und Verknüpfungen bleiben gültig.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AlteZoeSeite(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {};
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) { if (typeof v === 'string') q.set(k, v); else if (Array.isArray(v)) v.forEach(x => q.append(k, x)); }
  redirect(q.toString() ? `/zoe?${q}` : '/zoe');
}
