import { prisma } from "./db";
import { createComplaint } from "./complaints";
import { chatTurn, freshChat, type ChatLang, type ChatSession, type ChatStep } from "@/lib/chatbot";
import { suggestBooking } from "@/lib/phase3";
import { normalizePhone } from "@/lib/mask";
import { labelOf, STATUSES } from "@/lib/labels";

function readSession(row: { lang: string; step: string; draft: string } | null): ChatSession {
  if (!row) return freshChat();
  let draft = {};
  try { draft = JSON.parse(row.draft); } catch { draft = {}; }
  const lang: ChatLang = row.lang === "hi" ? "hi" : "en";
  return { lang, step: row.step as ChatStep, draft };
}

export async function runChat(phoneRaw: string, text: string) {
  const phone = normalizePhone(phoneRaw);
  const existing = await prisma.whatsAppSession.findUnique({ where: { phone } });
  const session = readSession(existing);
  const prior = await prisma.complaint.count({
    where: { phone, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, excludeFromMis: false },
  });
  const turn = chatTurn(session, text, prior > 0);
  await prisma.whatsAppSession.upsert({
    where: { phone },
    create: { phone, lang: turn.session.lang, step: turn.session.step, draft: JSON.stringify(turn.session.draft) },
    update: { lang: turn.session.lang, step: turn.session.step, draft: JSON.stringify(turn.session.draft) },
  });
  const messages = [...turn.messages];
  if (turn.action?.type === "status") {
    const row = await prisma.complaint.findFirst({ where: { phone }, orderBy: { bookDate: "desc" } });
    messages.push(row
      ? `${row.ticketNo}: ${labelOf(STATUSES, row.status)}. ${row.assignedName ? row.assignedName.split(" ")[0] : "No technician yet"}.`
      : (turn.session.lang === "hi" ? "कोई शिकायत नहीं मिली।" : "No complaint found for this mobile."));
  }
  if (turn.action?.type === "agent") {
    await prisma.callback.create({ data: { phone, name: session.draft.name ?? null, note: "WhatsApp: talk to a person", status: "OPEN" } });
  }
  if (turn.action?.type === "book") {
    const draft = turn.action.draft;
    const hint = suggestBooking(`${draft.product ?? ""} ${draft.problem ?? ""}`, prior > 0);
    const company = await prisma.company.findUnique({ where: { code: turn.action.company } });
    const pin = draft.pincode ? await prisma.pincode.findUnique({ where: { code: draft.pincode } }) : null;
    const district = pin
      ? await prisma.district.findUnique({ where: { id: pin.districtId } })
      : await prisma.district.findFirst({ where: { name: { equals: draft.place ?? "", mode: "insensitive" } } });
    if (!company || !district) {
      messages.push(turn.session.lang === "hi"
        ? "यह पिनकोड या जिला अभी मास्टर में नहीं है। कॉल सेंटर दर्ज करेगा।"
        : "That pincode or district is not in the master yet. The call centre will book it.");
      await prisma.callback.create({ data: { phone, name: draft.name, note: `Book: ${draft.product} · ${draft.problem} · ${draft.place}`, status: "OPEN" } });
    } else {
    try {
      const created = await createComplaint(null, {
        companyId: company.id,
        customerName: draft.name || "Customer",
        phone,
        address: draft.place,
        districtId: district.id,
        stateId: district.stateId,
        pincode: draft.pincode,
        callType: "BREAKDOWN",
        productDetails: draft.product,
        natureText: draft.problem || hint.fault,
        serialNo: draft.serial,
        serialUnavailable: !draft.serial,
        serialUnavailableReason: draft.serial ? null : "OTHER",
        priority: hint.priority,
        source: "WHATSAPP",
        categoryId: null,
        acknowledgeDuplicate: prior > 0,
        duplicateOverrideReason: prior > 0 ? "WhatsApp repeat of an open complaint" : undefined,
      }, { publicForm: true });
      messages.push(`${created.ticketNo}`);
    } catch (error) {
      messages.push(error instanceof Error ? error.message : "Could not book");
      await prisma.callback.create({ data: { phone, name: draft.name, note: `Book failed: ${draft.product} · ${draft.problem}`, status: "OPEN" } });
    }
    }
  }
  return { messages, action: turn.action?.type ?? null };
}
