/** Sends mail when SMTP_HOST is set. Without it, the caller decides what to tell the user. */
export async function sendMail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  if (!host) return { sent: false as const, reason: "SMTP_HOST is not set" };
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || "desk@oswalpumps.com";
  let nodemailer: { createTransport: (opts: object) => { sendMail: (msg: object) => Promise<unknown> } };
  try {
    const load = new Function("return import('nodemailer')") as () => Promise<typeof nodemailer>;
    nodemailer = await load();
  } catch {
    return { sent: false as const, reason: "nodemailer is not installed" };
  }
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
  await transport.sendMail({ from, to, subject, text });
  return { sent: true as const };
}
