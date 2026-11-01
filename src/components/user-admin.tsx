"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, labelOf } from "@/lib/constants";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  employeeCode: string;
  active: boolean;
  stateIds: string[];
  districtIds: string[];
  brandIds: string[];
};

export function UserAdmin({
  users,
  states,
  districts,
  brands,
}: {
  users: UserRow[];
  states: { id: string; name: string }[];
  districts: { id: string; name: string; stateId: string }[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not create the user.");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-3">
        <h2 className="font-display text-lg font-semibold text-navy md:col-span-3">Create user</h2>
        <input className="field" name="name" placeholder="Name" required />
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="employeeCode" placeholder="Employee code" required />
        <input className="field" name="phone" placeholder="Mobile" />
        <select className="field" name="role" defaultValue="CALL_CENTRE">
          {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
        <input className="field" name="password" type="password" placeholder="Password (8+)" required />
        {error ? <p className="text-sm text-rose-700 md:col-span-3">{error}</p> : null}
        <div><button className="btn btn-accent">Create user</button></div>
      </form>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Email</th><th>Code</th><th>Access</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted">{user.active ? "Active" : "Inactive"}</div>
                </td>
                <td>{labelOf(ROLES, user.role)}</td>
                <td>{user.email}</td>
                <td>{user.employeeCode}</td>
                <td className="text-xs text-muted">{user.role === "ADMIN" ? "All" : `${user.stateIds.length} states · ${user.districtIds.length} districts · ${user.brandIds.length} brands`}</td>
                <td><button className="text-sm font-semibold text-navy" onClick={() => setOpenId(openId === user.id ? null : user.id)}>{openId === user.id ? "Close" : "Permissions"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.filter((user) => user.id === openId).map((user) => (
        <PermissionEditor key={user.id} user={user} states={states} districts={districts} brands={brands} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function PermissionEditor({
  user,
  states,
  districts,
  brands,
  onSaved,
}: {
  user: UserRow;
  states: { id: string; name: string }[];
  districts: { id: string; name: string; stateId: string }[];
  brands: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [stateIds, setStateIds] = useState(user.stateIds);
  const [districtIds, setDistrictIds] = useState(user.districtIds);
  const [brandIds, setBrandIds] = useState(user.brandIds);
  const [active, setActive] = useState(user.active);
  const [role, setRole] = useState(user.role);
  const [message, setMessage] = useState("");

  function toggle(list: string[], id: string, set: (value: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function save() {
    setMessage("");
    const profile = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, active }),
    });
    const profileBody = await profile.json();
    if (!profile.ok) {
      setMessage(profileBody.error ?? "Could not update the user.");
      return;
    }
    const access = await fetch(`/api/users/${user.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stateIds, districtIds, brandIds }),
    });
    const accessBody = await access.json();
    if (!access.ok) {
      setMessage(accessBody.error ?? "Could not save permissions.");
      return;
    }
    setMessage("Saved.");
    onSaved();
  }

  const visibleDistricts = districts.filter((district) => stateIds.length === 0 || stateIds.includes(district.stateId));

  return (
    <section className="card p-4">
      <h2 className="font-display text-lg font-semibold text-navy">{user.name}</h2>
      <p className="text-sm text-muted">Admin ignores these lists and sees every complaint. A technician sees complaints assigned to them. Everyone else must match state, and district or brand when those lists are set.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-sm">Role
          <select className="field mt-1" value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CheckList title="States" items={states} selected={stateIds} onToggle={(id) => toggle(stateIds, id, setStateIds)} />
        <CheckList title="Districts" items={visibleDistricts} selected={districtIds} onToggle={(id) => toggle(districtIds, id, setDistrictIds)} />
        <CheckList title="Brands" items={brands} selected={brandIds} onToggle={(id) => toggle(brandIds, id, setBrandIds)} />
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      <button className="btn btn-accent mt-3" onClick={save}>Save permissions</button>
    </section>
  );
}

function CheckList({ title, items, selected, onToggle }: { title: string; items: { id: string; name: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            {item.name}
          </label>
        ))}
      </div>
    </div>
  );
}
