import { notFound } from "next/navigation";
import { FeedbackForm } from "./form";
import { getFeedback } from "@/server/complaints";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const feedback = await getFeedback(token);
  if (!feedback) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy font-display font-bold text-white">OP</span>
        <span className="font-display text-xl font-semibold text-navy">Oswal Pumps</span>
      </div>
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold text-navy">How did we do?</h1>
        <p className="mt-1 text-sm text-muted">Complaint {feedback.ticketNumber} for {feedback.customerName}{feedback.product ? ` · ${feedback.product}` : ""}.</p>
        {feedback.status === "HAPPY_CALLING_DONE" ? <p className="mt-4 text-sm">Thank you. This visit is already rated {feedback.rating}/5.</p> : null}
        {feedback.status !== "CLOSED" && feedback.status !== "HAPPY_CALLING_DONE" ? <p className="mt-4 text-sm">This complaint is still open. The feedback link starts working after it is closed.</p> : null}
        {feedback.status === "CLOSED" ? <FeedbackForm token={token} /> : null}
      </div>
    </main>
  );
}
