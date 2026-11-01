import Link from "next/link";
import { notFound } from "next/navigation";
import { MasterScreen } from "@/components/master-screen";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/server/current-user";
import { getMaster, toDTO } from "@/server/masters/registry";
import { AppError } from "@/lib/errors";

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return { title: entity };
}

export default async function MasterPage({ params }: { params: Promise<{ entity: string }> }) {
  const user = await requireUser();
  const { entity } = await params;
  try {
    const master = getMaster(entity);
    return (
      <div>
        <PageHeader title={master.label} subtitle={master.blurb} actions={<Link href="/masters" className="btn btn-ghost">All masters</Link>} />
        <MasterScreen entity={entity} def={toDTO(master)} canWrite={can(user.role, "manageMasters")} />
      </div>
    );
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
}
