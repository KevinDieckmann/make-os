import { MeilensteinDetail } from '@/components/os/planung/MeilensteinDetail';

// Ein Meilenstein im Detail (30.09.) — Adresse nur über WEG.meilenstein(id, r).
export default async function MeilensteinSeite(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <MeilensteinDetail id={decodeURIComponent(id)} />;
}
