import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { ROLE_LABEL } from "@/lib/labels";
import { ProfileAuthenticator } from "@/components/profile-authenticator";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabled: true } });
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Profile</p><h1>{user.name}</h1><p>{user.email} · {ROLE_LABEL[user.role] ?? user.role}</p></div></div>
      <section className="panel stack">
        <h2>Authenticator</h2>
        <ProfileAuthenticator enabled={Boolean(row?.totpEnabled)} />
      </section>
    </div>
  );
}
