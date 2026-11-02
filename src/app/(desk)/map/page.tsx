import { ServiceMap } from "@/components/service-map";

export const metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Service</p>
          <h1>Team and GPS history</h1>
          <p className="muted">Pick a date to replay that day's route. Pick a technician to see one trail.</p>
        </div>
      </div>
      <section className="panel">
        <ServiceMap />
      </section>
    </div>
  );
}
