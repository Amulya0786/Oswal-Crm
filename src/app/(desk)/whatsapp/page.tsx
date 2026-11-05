import { redirect } from "next/navigation";

export default function WhatsAppRedirect() {
  redirect("/settings?tab=whatsapp");
}
