import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { getComplaint } from "@/server/complaints";

export const metadata = { title: "Job card" };

export default async function JobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const { id } = await params;
  const complaint = await getComplaint(user, scope, id);
  if (!complaint) notFound();
  return (
    <article className="job-card">
      <h1>Job card {complaint.ticketNo}</h1>
      <p>{complaint.customerName} · {complaint.phone}</p>
      <p>{complaint.address} · {complaint.districtName}, {complaint.stateName} · {complaint.pincode}</p>
      <p>{complaint.productDetails} · {complaint.serialNo || "Serial pending"} · {complaint.callType}</p>
      <p>{complaint.natureText}</p>
      <p>Technician: {complaint.assignedName || "Unassigned"}</p>
      <style>{`@media print { .topband, .sidebar, .btn { display: none } .job-card { font-size: 14px } }`}</style>
    </article>
  );
}
