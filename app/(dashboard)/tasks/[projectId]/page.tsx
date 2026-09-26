import { ProjectDetail } from '@/components/tasks/ProjectDetail';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage(props: Props) {
  const params = await props.params;
  return <ProjectDetail projectId={params.projectId} />;
}
