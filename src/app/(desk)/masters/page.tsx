import Link from "next/link";
import { MASTER_DEFS } from "@/server/masters";

export const metadata = { title: "Masters" };

export default function MastersPage() {
  const groups = [...new Set(MASTER_DEFS.map((item) => item.group))];
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Masters</p><h1>Reference data</h1><p>States through beneficiary uploads. Admins can add, edit and import.</p></div></div>
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
