import { redirect } from "next/navigation";

export default function ScorecardsRedirect() {
  redirect("/performance?tab=cards");
}
