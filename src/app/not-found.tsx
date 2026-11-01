import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <div className="font-display text-3xl font-semibold text-navy">Not found</div>
        <p className="mt-2 text-sm text-muted">That page is not on the Oswal service desk.</p>
        <Link href="/" className="btn btn-navy mt-4">Dashboard</Link>
      </div>
    </main>
  );
}
