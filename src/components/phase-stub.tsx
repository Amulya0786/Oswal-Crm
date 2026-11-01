import { PageHeader } from "./ui";

export function PhaseStub({ phase, title, body }: { phase: string; title: string; body: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle={phase} />
      <div className="card max-w-2xl p-6">
        <p className="text-sm leading-6 text-ink">{body}</p>
      </div>
    </div>
  );
}
