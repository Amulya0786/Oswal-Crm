import { COMPLAINT_STATUSES, COMPLAINT_TYPES, labelOf, ROLES } from "@/lib/constants";
import { providerFor, type Channel } from "@/lib/notifications/providers";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function logSend(entry: {
  complaintId?: string | null;
  event: string;
  channel: string;
  toAddress: string;
  subject?: string | null;
  body: string;
  provider: string;
  status: string;
  detail?: string | null;
}) {
  await prisma.notificationLog.create({ data: entry });
}

export async function dispatchComplaintNotice(event: string, complaintId: string) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { customer: true, assignedTo: true, serviceCenter: true, brand: true },
  });
  if (!complaint) return;
  const templates = await prisma.notificationTemplate.findMany({ where: { event, active: true } });
  const vars = {
    ticketNumber: complaint.ticketNumber,
    customerName: complaint.customer.name,
    phone: complaint.customer.phone,
    type: labelOf(COMPLAINT_TYPES, complaint.type),
    status: labelOf(COMPLAINT_STATUSES, complaint.status),
    technicianName: complaint.assignedTo?.name ?? complaint.serviceCenter?.engineerName ?? "our engineer",
    centerName: complaint.serviceCenter?.name ?? "Oswal Service",
    feedbackLink: `${appUrl()}/feedback/${complaint.feedbackToken}`,
    brand: complaint.brand?.name ?? "Oswal",
  };
  for (const template of templates) {
    const channel = template.channel as Channel;
    const to = channel === "email" ? complaint.customer.email : complaint.customer.phone;
    const body = renderTemplate(template.body, vars);
    const subject = template.subject ? renderTemplate(template.subject, vars) : null;
    if (!to) {
      await logSend({ complaintId, event, channel, toAddress: "", subject, body, provider: "none", status: "SKIPPED", detail: "No destination on the customer." });
      continue;
    }
    const provider = providerFor(channel);
    const result = await provider.send({ to, body, subject: subject ?? undefined });
    await logSend({
      complaintId,
      event,
      channel,
      toAddress: to,
      subject,
      body,
      provider: provider.name,
      status: result.ok ? "SENT" : "FAILED",
      detail: result.error ?? result.detail ?? result.id ?? null,
    });
  }
}

export async function dispatchEscalation(complaintId: string, user: { id: string; name: string; email: string; phone: string | null; role: string }) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { customer: true } });
  if (!complaint) return;
  const templates = await prisma.notificationTemplate.findMany({ where: { event: "ESCALATION", active: true } });
  const vars = {
    ticketNumber: complaint.ticketNumber,
    customerName: complaint.customer.name,
    toName: user.name,
    toRole: labelOf(ROLES, user.role),
    feedbackLink: `${appUrl()}/feedback/${complaint.feedbackToken}`,
  };
  for (const template of templates) {
    const channel = template.channel as Channel;
    const to = channel === "email" ? user.email : user.phone;
    const body = renderTemplate(template.body, vars);
    const subject = template.subject ? renderTemplate(template.subject, vars) : null;
    if (!to) {
      await logSend({ complaintId, event: "ESCALATION", channel, toAddress: "", subject, body, provider: "none", status: "SKIPPED", detail: "Escalation target has no destination." });
      continue;
    }
    const provider = providerFor(channel);
    const result = await provider.send({ to, body, subject: subject ?? undefined });
    await logSend({
      complaintId,
      event: "ESCALATION",
      channel,
      toAddress: to,
      subject,
      body,
      provider: provider.name,
      status: result.ok ? "SENT" : "FAILED",
      detail: result.error ?? result.detail ?? null,
    });
  }
}
