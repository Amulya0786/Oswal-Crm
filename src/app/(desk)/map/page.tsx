import { ServiceMap } from "@/components/service-map";

export const metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Service</p>
          <h1>Open complaints</h1>
          <p>Green pins are complaints. Gold pins are technicians. Nearest, skill, load and SLA risk still decide the suggestion.</p>
        </div>
      </div>
      <section className="panel">
        <ServiceMap />
      </section>
    </div>
  );
}
