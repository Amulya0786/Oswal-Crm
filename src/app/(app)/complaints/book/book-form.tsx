"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPLAINT_SOURCES, COMPLAINT_TYPES, PRIORITIES, SCHEMES } from "@/lib/constants";

type Option = { id: string; name: string };
type Match = {
  customer: { id: string; name: string; phone: string; email?: string | null; address?: string | null; village?: string | null; stateId?: string | null; districtId?: string | null; areaId?: string | null; pincode?: string | null; state?: string | null; district?: string | null };
  asset: { serialNumber: string } | null;
  product: { id: string; name: string; brandId: string | null } | null;
};

export function BookForm(props: {
  states: Option[];
  districts: { id: string; name: string; stateId: string }[];
  areas: { id: string; name: string; districtId: string }[];
  products: { id: string; name: string; brandId: string | null }[];
  issues: { id: string; name: string; complaintType: string | null }[];
  centers: { id: string; name: string; engineerName: string; districtId: string | null }[];
  brands: Option[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [serial, setSerial] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [pincode, setPincode] = useState("");
  const [productId, setProductId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [type, setType] = useState("BREAKDOWN");
  const [source, setSource] = useState("CALL");
  const [issueId, setIssueId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [scheme, setScheme] = useState("");
  const [consumerNumber, setConsumerNumber] = useState("");
  const [description, setDescription] = useState("");
  const [serviceCenterId, setServiceCenterId] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const districts = useMemo(() => props.districts.filter((district) => !stateId || district.stateId === stateId), [props.districts, stateId]);
  const areas = useMemo(() => props.areas.filter((area) => !districtId || area.districtId === districtId), [props.areas, districtId]);
  const issues = useMemo(() => props.issues.filter((issue) => !issue.complaintType || issue.complaintType === type), [props.issues, type]);

  useEffect(() => {
    if (!pincode && !districtId) return;
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/assignee?pincode=${encodeURIComponent(pincode)}&districtId=${encodeURIComponent(districtId)}`);
      const data = (await response.json()) as { reason?: string; serviceCenter?: { name: string; engineerName: string } | null };
      setSuggestion(data.serviceCenter ? `${data.serviceCenter.name} · ${data.serviceCenter.engineerName}. ${data.reason ?? ""}` : data.reason ?? "");
    }, 250);
    return () => clearTimeout(handle);
  }, [pincode, districtId]);

  async function lookup() {
    setError("");
    const params = new URLSearchParams();
    if (phone.trim()) params.set("phone", phone.trim());
    if (serial.trim()) params.set("serial", serial.trim());
    const response = await fetch(`/api/complaints/lookup?${params}`);
    const data = (await response.json()) as { matches?: Match[]; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Lookup failed.");
      return;
    }
    setMatches(data.matches ?? []);
    if ((data.matches ?? []).length === 0) setError("No customer matched. Fill the form to create one.");
  }

  function apply(match: Match) {
    setCustomerId(match.customer.id);
    setName(match.customer.name);
    setPhone(match.customer.phone);
    setEmail(match.customer.email ?? "");
    setVillage(match.customer.village ?? "");
    setAddress(match.customer.address ?? "");
    setStateId(match.customer.stateId ?? "");
    setDistrictId(match.customer.districtId ?? "");
    setAreaId(match.customer.areaId ?? "");
    setPincode(match.customer.pincode ?? "");
    if (match.asset) setSerial(match.asset.serialNumber);
    if (match.product) {
      setProductId(match.product.id);
      if (match.product.brandId) setBrandId(match.product.brandId);
    }
    setError("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customerId || undefined,
        customerName: name,
        phone,
        email,
        address,
        village,
        stateId,
        districtId,
        areaId: areaId || undefined,
        pincode,
        serialNumber: serial,
        productId: productId || undefined,
        brandId: brandId || undefined,
        type,
        source,
        issueId: issueId || undefined,
        description,
        priority,
        scheme: scheme || undefined,
        consumerNumber,
        serviceCenterId: serviceCenterId || undefined,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string; ticketNumber?: string };
    if (!response.ok || !data.id) {
      setError(data.error ?? "Could not book the complaint.");
      setPending(false);
      return;
    }
    router.push(`/complaints/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <section className="card space-y-3 p-4 lg:col-span-2">
        <h2 className="font-display text-lg font-semibold text-navy">Find the customer</h2>
        <p className="text-sm text-muted">Try mobile 9811000001 or serial OSW00001 from the demo data.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Mobile</span><input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile" /></label>
          <label><span className="label">Serial number</span><input className="field" value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="OSW00001" /></label>
        </div>
        <button type="button" className="btn btn-ghost" onClick={lookup}>Look up</button>
        {matches.length > 0 ? (
          <div className="grid gap-2">
            {matches.map((match) => (
              <button type="button" key={match.customer.id} className="rounded-xl border border-line px-3 py-2 text-left hover:border-accent" onClick={() => apply(match)}>
                <div className="font-semibold text-navy">{match.customer.name} · {match.customer.phone}</div>
                <div className="text-xs text-muted">{match.customer.district ?? "No district"} {match.asset ? `· ${match.asset.serialNumber}` : ""} {match.product ? `· ${match.product.name}` : ""}</div>
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Customer name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label><span className="label">Email</span><input className="field" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span className="label">Village</span><input className="field" value={village} onChange={(event) => setVillage(event.target.value)} /></label>
          <label><span className="label">Pincode</span><input className="field" value={pincode} onChange={(event) => setPincode(event.target.value)} /></label>
          <label className="sm:col-span-2"><span className="label">Address</span><textarea className="field min-h-20" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label>
            <span className="label">State</span>
            <select className="field" value={stateId} onChange={(event) => { setStateId(event.target.value); setDistrictId(""); setAreaId(""); }} required>
              <option value="">Select</option>
              {props.states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">District</span>
            <select className="field" value={districtId} onChange={(event) => { setDistrictId(event.target.value); setAreaId(""); }} required>
              <option value="">Select</option>
              {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Area / block</span>
            <select className="field" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
              <option value="">Select</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold text-navy">Complaint</h2>
        <label>
          <span className="label">Type</span>
          <select className="field" value={type} onChange={(event) => setType(event.target.value)}>
            {COMPLAINT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Source</span>
          <select className="field" value={source} onChange={(event) => setSource(event.target.value)}>
            {COMPLAINT_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Product</span>
          <select className="field" value={productId} onChange={(event) => {
            const id = event.target.value;
            setProductId(id);
            const product = props.products.find((item) => item.id === id);
            if (product?.brandId) setBrandId(product.brandId);
          }}>
            <option value="">Select</option>
            {props.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Brand</span>
          <select className="field" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
            <option value="">Select</option>
            {props.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Issue</span>
          <select className="field" value={issueId} onChange={(event) => setIssueId(event.target.value)}>
            <option value="">Select</option>
            {issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Priority</span>
          <select className="field" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {type === "SCHEME" ? (
          <>
            <label>
              <span className="label">Scheme</span>
              <select className="field" value={scheme} onChange={(event) => setScheme(event.target.value)} required>
                <option value="">Select</option>
                {SCHEMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label><span className="label">Consumer number</span><input className="field" value={consumerNumber} onChange={(event) => setConsumerNumber(event.target.value)} /></label>
          </>
        ) : null}
        <label><span className="label">Narration</span><textarea className="field min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>
          <span className="label">Assignment</span>
          <select className="field" value={serviceCenterId} onChange={(event) => setServiceCenterId(event.target.value)}>
            <option value="">Auto from pincode / district</option>
            {props.centers.map((center) => <option key={center.id} value={center.id}>{center.name} · {center.engineerName}</option>)}
          </select>
        </label>
        {suggestion ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">{suggestion}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button className="btn btn-accent w-full" disabled={pending}>{pending ? "Booking…" : "Create ticket"}</button>
      </section>
    </form>
  );
}
