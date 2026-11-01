import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent font-display text-lg font-bold">OP</span>
          <span>
            <span className="block font-display text-2xl font-semibold leading-none">Oswal Pumps</span>
            <span className="mt-1 block text-xs font-semibold tracking-[0.2em] text-white/60">SERVICE CRM</span>
          </span>
        </div>
        <div>
          <h1 className="max-w-md font-display text-4xl font-semibold leading-tight">The field-service desk for pumps, motors and solar.</h1>
          <p className="mt-4 max-w-md text-white/70">
            Book a complaint, assign the engineer on that pincode, watch the SLA, and close the call with the actual problem and solution.
          </p>
        </div>
        <p className="text-sm text-white/50">Oswal Pumps Ltd · Karnal, Haryana</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <LoginForm />
      </section>
    </div>
  );
}
