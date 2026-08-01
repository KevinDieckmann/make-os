import { ProjectDetail } from '@/components/tasks/ProjectDetail';

interface Props {
  params: { projectId: string };
}

export default function ProjectPage({ params }: Props) {
  return <ProjectDetail projectId={params.projectId} />;
}
