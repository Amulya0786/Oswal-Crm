import { companyCodeForCategory, type CompanyCode } from "./company-tag";

export type ChatLang = "en" | "hi";
export type ChatStep = "menu" | "name" | "product" | "problem" | "place" | "serial" | "confirm";

export type ChatDraft = {
  name?: string;
  product?: string;
  problem?: string;
  place?: string;
  pincode?: string;
  serial?: string;
};

export type ChatSession = { lang: ChatLang; step: ChatStep; draft: ChatDraft };

export type ChatAction =
  | { type: "book"; draft: ChatDraft; company: CompanyCode; duplicate: boolean }
  | { type: "status" }
  | { type: "agent"; note: string };

export type ChatTurn = { session: ChatSession; messages: string[]; action?: ChatAction };

const MENU = {
  en: "Oswal Service\n1 Book a complaint\n2 Check status\n3 Talk to a person\n9 हिंदी",
  hi: "ओसवाल सेवा\n1 शिकायत दर्ज करें\n2 स्थिति देखें\n3 व्यक्ति से बात\n9 English",
};

export function freshChat(lang: ChatLang = "en"): ChatSession {
  return { lang, step: "menu", draft: {} };
}

export function chatTurn(session: ChatSession, text: string, priorOpen = false): ChatTurn {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (lower === "menu" || lower === "0" || raw === "मेनू") return { session: { ...session, step: "menu", draft: {} }, messages: [MENU[session.lang]] };
  if (raw === "9") {
    const lang: ChatLang = session.lang === "en" ? "hi" : "en";
    return { session: { ...session, lang, step: "menu", draft: {} }, messages: [MENU[lang]] };
  }
  if (session.step === "menu") {
    if (raw === "1") return { session: { ...session, step: "name", draft: {} }, messages: [session.lang === "hi" ? "आपका नाम?" : "Your name?"] };
    if (raw === "2") return { session, messages: [session.lang === "hi" ? "स्थिति भेजी जा रही है।" : "Sending your latest complaint status."], action: { type: "status" } };
    if (raw === "3") return { session: { ...session, step: "menu", draft: {} }, messages: [session.lang === "hi" ? "हमारे साथी आपको कॉल करेंगे।" : "A colleague will call you back."], action: { type: "agent", note: raw } };
    return { session, messages: [MENU[session.lang]] };
  }
  if (session.step === "name") {
    if (raw.length < 2) return { session, messages: [session.lang === "hi" ? "पूरा नाम लिखें।" : "Please type your full name."] };
    return { session: { ...session, step: "product", draft: { ...session.draft, name: raw } }, messages: [session.lang === "hi" ? "उत्पाद क्या है? जैसे पंप, कंट्रोलर, पैनल।" : "What is the product? For example pump, controller, or panel."] };
  }
  if (session.step === "product") {
    return { session: { ...session, step: "problem", draft: { ...session.draft, product: raw } }, messages: [session.lang === "hi" ? "समस्या क्या है?" : "What is the problem?"] };
  }
  if (session.step === "problem") {
    return { session: { ...session, step: "place", draft: { ...session.draft, problem: raw } }, messages: [session.lang === "hi" ? "पता और पिनकोड लिखें।" : "Type the address and pincode."] };
  }
  if (session.step === "place") {
    const pin = raw.match(/\b(\d{6})\b/);
    return {
      session: { ...session, step: "serial", draft: { ...session.draft, place: raw, pincode: pin?.[1] } },
      messages: [session.lang === "hi" ? "सीरियल नंबर लिखें, या SKIP।" : "Type the serial number, or SKIP."],
    };
  }
  if (session.step === "serial") {
    const serial = /^skip$/i.test(raw) || raw === "छोड़ें" ? "" : raw;
    const draft = { ...session.draft, serial };
    const company = companyCodeForCategory(`${draft.product ?? ""} ${draft.problem ?? ""}`);
    const companyName = company === "SOLAR" ? "Oswal Solar" : "Oswal Pumps";
    const summary = session.lang === "hi"
      ? `${draft.name}, ${draft.product}, ${draft.problem}. कंपनी ${companyName}.${priorOpen ? " पहले से एक शिकायत खुली है।" : ""} दर्ज करने के लिए YES लिखें।`
      : `${draft.name}, ${draft.product}, ${draft.problem}. Company ${companyName}.${priorOpen ? " An open complaint already exists." : ""} Reply YES to book.`;
    return { session: { ...session, step: "confirm", draft }, messages: [summary] };
  }
  if (session.step === "confirm") {
    if (!/^yes$|^y$|^हाँ$/i.test(raw)) return { session: { ...session, step: "menu", draft: {} }, messages: [session.lang === "hi" ? "रद्द। " + MENU.hi : "Cancelled. " + MENU.en] };
    const company = companyCodeForCategory(`${session.draft.product ?? ""} ${session.draft.problem ?? ""}`);
    return {
      session: { ...session, step: "menu", draft: {} },
      messages: [session.lang === "hi" ? "शिकायत दर्ज हो रही है।" : "Booking your complaint."],
      action: { type: "book", draft: session.draft, company, duplicate: priorOpen },
    };
  }
  return { session, messages: [MENU[session.lang]] };
}
