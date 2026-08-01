import { StubModule } from '@/components/shared/StubModule';
import { PawPrint } from 'lucide-react';

export default function DogPage() {
  return (
    <StubModule
      title="Luna Dashboard"
      description="Gassi-Tracking, Fütterungsroutine, Tierarzttermine und Futtervorrat für Luna."
      icon={PawPrint}
    />
  );
}
