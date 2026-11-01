import { openApi } from "@/lib/openapi";
import { getScope } from "@/server/auth";

export const metadata = { title: "API" };

export default async function DevelopersPage() {
  const { user } = await getScope();
  if (!user?.caps.security) return <main className="main"><p>API notes are for admins.</p></main>;
  return (
    <main className="main">
      <p className="kicker">API</p>
      <h1 style={{ fontFamily: "var(--display)" }}>Oswal Service API</h1>
      <p>Header <span className="mono">x-api-key</span>. The demo key is in the environment file. Webhooks fire on ticket events when an endpoint is saved in Settings.</p>
      <p><a href="/api/openapi">OpenAPI JSON</a></p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Path</th><th>Methods</th></tr></thead>
          <tbody>
            {Object.entries(openApi.paths).map(([path, methods]) => (
              <tr key={path}><td className="mono">/api/v1{path}</td><td>{Object.keys(methods).join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
