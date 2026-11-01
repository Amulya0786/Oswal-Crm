export const metadata = { title: "Attendance" };

export default function AttendancePage() {
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Phase 2</p><h1>Attendance</h1><p>Punch, leave and technician presence will live here. The desk does not collect attendance yet.</p></div></div>
      <section className="panel"><p>Planned: daily punch with GPS, leave requests, and a supervisor view. It stays out of the booking flow.</p></section>
    </div>
  );
}
