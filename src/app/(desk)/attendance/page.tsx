import Link from "next/link";

export const metadata = { title: "Attendance" };

export default function AttendancePage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Service</p>
          <h1>Attendance</h1>
          <p>Technicians punch in and out from the field app. The punch carries their last GPS point when the phone allows it.</p>
        </div>
        <Link className="btn" href="/field">Open the technician app</Link>
      </div>
      <section className="panel">
        <p className="muted">No punches on this desk login. A technician sees their own punches inside the app.</p>
      </section>
    </div>
  );
}
