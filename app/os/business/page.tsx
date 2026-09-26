import { redirect } from 'next/navigation';

// Seit 25.09. lebt das Business-Cockpit unter Zahlen → Business. Alte Links
// (/os/business?f=…&k=…) bleiben gültig und landen an derselben Stelle.
export default async function BusinessPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const q = new URLSearchParams({ s: 'business' });
  for (const k of ['f', 'k'] as const) { const v = searchParams[k]; if (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v)) q.set(k, v); }
  redirect(`/os/finanzen?${q.toString()}`);
}
