import Link from "next/link";
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, STATUS_TONE, TYPE_TONE, labelOf } from "@/lib/constants";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-navy">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_TONE[status] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>{labelOf(COMPLAINT_STATUSES, status)}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  return <span className={`badge ${TYPE_TONE[type] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>{labelOf(COMPLAINT_TYPES, type)}</span>;
}

export function Forbidden({ title = "You do not have access to this part of the desk." }: { title?: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="font-display text-xl text-navy">{title}</h1>
      <Link href="/" className="btn btn-navy mt-4">
        Back to dashboard
      </Link>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-6 py-12 text-center">
      <h2 className="font-display text-lg text-navy">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
