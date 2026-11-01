import { ImportWizard } from "@/components/import-wizard";
import { Forbidden, PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/server/current-user";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user.role, "importData")) return <Forbidden title="Only an admin can run the Smartlogics import." />;
  return (
    <div>
      <PageHeader title="Smartlogics import" subtitle="Upload an Excel workbook, map its columns, preview the rows, then create or update complaints, customers, products and users." />
      <ImportWizard />
    </div>
  );
}
