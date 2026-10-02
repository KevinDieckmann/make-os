import { ZielDetail } from '@/components/os/planung/ZielDetail';

// Ein Ziel im Detail (01.10.) — Adresse nur über WEG.ziel(id).
export default async function ZielSeite(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ZielDetail id={decodeURIComponent(id)} />;
}
