"use client";

import { ROLES } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";

export function UserForm({ companies, states, districts, brands }: { companies: { id: string; shortName: string }[]; states: { id: string; name: string }[]; districts: { id: string; name: string }[]; brands: { id: string; name: string }[] }) {
  return (
    <form className="panel stack" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/desk/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
          phone: data.get("phone"),
          companyIds: data.getAll("companyIds"),
          stateIds: data.getAll("stateIds"),
          districtIds: data.getAll("districtIds"),
          brandIds: data.getAll("brandIds"),
        }),
      });
      if (response.ok) window.location.reload();
      else alert((await response.json()).error);
    }}>
      <h2>Create user</h2>
      <div className="filters">
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" placeholder="Password" required />
        <input name="phone" placeholder="Mobile" />
        <select name="role">{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}</select>
      </div>
      <div className="filters">
        {companies.map((company) => <label key={company.id} className="chip"><input type="checkbox" name="companyIds" value={company.id} /> {company.shortName}</label>)}
      </div>
      <div className="filters">
        <select name="stateIds" multiple size={4}>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select>
        <select name="districtIds" multiple size={4}>{districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select>
        <select name="brandIds" multiple size={4}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
      </div>
      <button className="btn">Create user</button>
    </form>
  );
}
