import Link from "next/link";
import { MASTER_DEFS } from "@/server/masters";
import { ReferenceLoad } from "@/components/reference-load";

export const metadata = { title: "Masters" };

export default function MastersPage() {
  const groups = [...new Set(MASTER_DEFS.map((item) => item.group))];
  return (
    <div>
      <div className="page-head"><div><h1>Reference data</h1></div></div>
      <ReferenceLoad />
      {groups.map((group) => (
        <section key={group}>
          <div className="section-label">{group}</div>
          <div className="cards">
            {MASTER_DEFS.filter((item) => item.group === group).map((item) => (
              <Link key={item.key} className="master-card" href={`/masters/${item.key}`}><b>{item.title}</b></Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
