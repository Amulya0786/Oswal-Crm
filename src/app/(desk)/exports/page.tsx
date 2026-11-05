import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatWhen } from "@/lib/time";

export const metadata = { title: "Exports" };

export default async function ExportsPage() {
  const { user } = await getScope();
  if (!user) return null;
  const jobs = await prisma.exportJob.findMany({ where: user.caps.security ? {} : { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Exports</p><h1>Background downloads</h1><p>Large complaint extracts are written to a file so the desk stays quick.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Status</th><th>Rows</th><th></th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{formatWhen(job.createdAt)}</td>
                <td>{job.status}{job.error ? ` · ${job.error}` : ""}</td>
                <td>{job.rowCount ?? "—"}</td>
                <td>{job.status === "DONE" && <a href={`/api/desk/exports/${job.id}/file`}>Download</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!jobs.length && <p className="muted">No exports yet. Start one from the complaint list.</p>}
      <p><Link href="/complaints">Back to complaints</Link></p>
    </div>
  );
}
