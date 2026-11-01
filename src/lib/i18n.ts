export const FIELD_COPY = {
  en: {
    title: "Today's visits",
    empty: "No visits scheduled for today.",
    attendance: "Attendance",
    earnings: "Earnings",
    lang: "हिंदी",
    start: "Start travel",
    arrive: "I have arrived",
    scan: "Scan serial",
    close: "Close with OTP",
    hold: "Mark pending",
    in: "Punch in",
    out: "Punch out",
    visits: "Visits this month",
  },
  hi: {
    title: "आज की विज़िट",
    empty: "आज कोई विज़िट निर्धारित नहीं है।",
    attendance: "हाजिरी",
    earnings: "कमाई",
    lang: "English",
    start: "यात्रा शुरू करें",
    arrive: "मैं पहुँच गया",
    scan: "सीरियल स्कैन करें",
    close: "OTP से बंद करें",
    hold: "लंबित करें",
    in: "पंच इन",
    out: "पंच आउट",
    visits: "इस महीने की विज़िट",
  },
} as const;

export type FieldLang = keyof typeof FIELD_COPY;
