import { PhaseStub } from "@/components/phase-stub";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <PhaseStub
      phase="Phase 2"
      title="Expenses"
      body="Expense claims will use the Expense Types master that is already on this desk. Submitting a claim, spare-parts stock and warranty lookup arrive with the technician tools in Phase 2."
    />
  );
}
