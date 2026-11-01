"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/toast";
import { CALL_TYPES, labelOf, PRIORITIES, SOURCES, STATUSES } from "@/lib/labels";
import { SERIAL_UNAVAILABLE_REASONS } from "@/lib/quality";
import { formatDay } from "@/lib/time";

type Option = { id: string; name: string; stateId?: string; districtId?: string; companyId?: string; categoryId?: string | null; code?: string; companyCode?: string; type?: string; shortName?: string; accent?: string; legalName?: string };
type Pin = { code: string; districtId: string; areaId: string | null };
type Suggestion = { engineerId: string; name: string; score: number; reason: string; openCount: number };

export function BookForm({ options, scope }: { options: Record<string, any>; scope: string }) {
  const router = useRouter();
  const companies: Option[] = options.companies;
  const [companyId, setCompanyId] = useState(scope !== "all" ? scope : companies[0]?.id);
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [callType, setCallType] = useState("BREAKDOWN");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [phone, setPhone] = useState("");
  const [serial, setSerial] = useState("");
  const [pincode, setPincode] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [warning, setWarning] = useState<any>(null);
  const [ack, setAck] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [serialUnavailable, setSerialUnavailable] = useState(false);
  const [serialReason, setSerialReason] = useState("STICKER_MISSING");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [engineerId, setEngineerId] = useState("");
  const [assignMode, setAssignMode] = useState<"suggest" | "manual" | "none">("none");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [history, setHistory] = useState<null | {
    customerId: string;
    name: string;
    assets: { id: string; label: string; warranty: string; amc: string }[];
    complaints: { ticketNo: string; status: string; bookDate: string; technician: string | null; problem: string | null; resolution: string | null; spares: string[]; repeatOfTicket: string | null }[];
  }>(null);

  const districts = (options.districts as Option[]).filter((row) => !stateId || row.stateId === stateId);
  const areas = (options.areas as Option[]).filter((row) => !districtId || row.districtId === districtId);
  const categories = (options.categories ?? []) as Option[];
  const products = (options.products as Option[]).filter((row) => !categoryId || row.categoryId === categoryId);
  const brands = (options.brands as Option[]).filter((row) => row.companyId === companyId);

  useEffect(() => {
    const pin = (options.pincodes as Pin[]).find((row) => row.code === pincode);
    if (!pin) return;
    const district = (options.districts as Option[]).find((row) => row.id === pin.districtId);
    if (district?.stateId) setStateId(district.stateId);
    setDistrictId(pin.districtId);
    if (pin.areaId) setAreaId(pin.areaId);
  }, [pincode, options.pincodes, options.districts]);

  useEffect(() => {
    if (phone.replace(/\D/g, "").length < 10 && serial.length < 3) return;
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/desk/lookup?phone=${phone}&serial=${encodeURIComponent(serial)}&companyId=${companyId}`);
      if (!response.ok) { showToast("Lookup failed"); return; }
      const body = await response.json();
      setCustomer(body.customers?.[0] ?? null);
      setHistory(body.history ?? null);
      if (body.history?.name) setCustomerName(body.history.name);
      setWarning(body.duplicates);
      if (body.customers?.[0]) {
        setStateId(body.customers[0].stateId ?? "");
        setDistrictId(body.customers[0].districtId ?? "");
        setAreaId(body.customers[0].areaId ?? "");
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [phone, serial, companyId]);

  useEffect(() => {
    if (!companyId || (!pincode && !districtId)) return;
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/desk/suggest?companyId=${companyId}&pincode=${pincode}&districtId=${districtId}&stateId=${stateId}&productId=${productId}&callType=${callType}`);
      if (!response.ok) { showToast("Could not suggest a technician"); return; }
      const body = await response.json();
      setSuggestions(body.suggestions ?? []);
      if (assignMode === "suggest" && body.suggestions?.[0]) setEngineerId(body.suggestions[0].engineerId);
    }, 250);
    return () => clearTimeout(handle);
  }, [companyId, pincode, districtId, stateId, productId, callType, assignMode]);

  const suggested = useMemo(() => suggestions.find((row) => row.engineerId === engineerId) ?? suggestions[0], [suggestions, engineerId]);

  function companyIdForCategory(id: string) {
    const category = categories.find((row) => row.id === id);
    return companies.find((company) => company.code === category?.companyCode)?.id;
  }

  function chooseCategory(id: string) {
    setCategoryId(id);
    const nextCompany = companyIdForCategory(id);
    if (nextCompany) setCompanyId(nextCompany);
    const current = (options.products as Option[]).find((row) => row.id === productId);
    if (current && current.categoryId !== id) setProductId("");
  }

  function chooseProduct(id: string) {
    setProductId(id);
    const product = (options.products as Option[]).find((row) => row.id === id);
    if (!product?.categoryId) return;
    setCategoryId(product.categoryId);
    const nextCompany = companyIdForCategory(product.categoryId);
    if (nextCompany) setCompanyId(nextCompany);
  }

  async function scanSerial() {
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot scan a code. Type the serial, or mark it not available.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const codes = await new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "code_93"] }).detect(video);
      stream.getTracks().forEach((track) => track.stop());
      const value = codes[0]?.rawValue?.trim();
      if (!value) setError("No code in the frame. Try again, or type the serial.");
      else { setSerial(value); setSerialUnavailable(false); setError(""); }
    } catch {
      setError("The camera could not be opened. Type the serial, or mark it not available.");
    }
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    if (phone.replace(/\D/g, "").length !== 10) {
      setPending(false);
      setError("Enter a 10-digit mobile");
      showToast("Enter a 10-digit mobile");
      return;
    }
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/desk/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        companyId,
        stateId,
        districtId,
        areaId,
        callType,
        categoryId: categoryId || null,
        productId: productId || null,
        engineerId: assignMode === "none" ? null : engineerId,
        assignMode,
        acknowledgeDuplicate: ack,
        duplicateOverrideReason: overrideReason,
        serialUnavailable,
        serialUnavailableReason: serialUnavailable ? serialReason : null,
        serialNo: serialUnavailable ? "" : serial,
        priority: payload.priority,
      }),
    });
    const body = await response.json().catch(() => ({ error: "Could not save, please retry" }));
    setPending(false);
    if (response.status === 409) {
      setWarning({ reason: body.reason, open: body.duplicates ?? [] });
      setError(body.reason ?? body.error);
      return;
    }
    if (!response.ok) {
      const message = body.error ?? "Could not book";
      setError(message);
      showToast(message);
      return;
    }
    router.push(`/complaints/${body.ticketNo}?new=1`);
    router.refresh();
  }

  const districtName = districts.find((row) => row.id === districtId)?.name;
  const productName = products.find((row) => row.id === productId)?.name;
  return (
    <form action={onSubmit} className="book-layout">
      <div className="stack">
      <div className="chips">
        {companies.map((company) => (
          <button type="button" key={company.id} className={`chip ${companyId === company.id ? "on" : ""}`} onClick={() => setCompanyId(company.id)}>{company.shortName}</button>
        ))}
      </div>
      <section className="panel stack form-section">
        <header className="section-head"><span className="step">1</span><h2>Customer</h2></header>
        <div className="filters">
          <label className="stack">Mobile<input name="phone" placeholder="Mobile" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <label className="stack">Serial number<input name="serialNo" placeholder="Serial number" value={serial} onChange={(event) => { setSerial(event.target.value); if (event.target.value.trim()) setSerialUnavailable(false); }} disabled={serialUnavailable} /></label>
          <button type="button" className="btn line" onClick={() => void scanSerial()}>Scan</button>
        </div>
        <label className="chip"><input type="checkbox" checked={serialUnavailable} onChange={(event) => { setSerialUnavailable(event.target.checked); if (event.target.checked) setSerial(""); }} /> Serial not available</label>
        {serialUnavailable && (
          <select value={serialReason} onChange={(event) => setSerialReason(event.target.value)}>
            {SERIAL_UNAVAILABLE_REASONS.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
          </select>
        )}
        {customer && <p>Found {customer.name} · {customer.company?.shortName} · {customer.district?.name}</p>}
        {phone.replace(/\D/g, "").length >= 10 && (
          <div className="history-panel">
            <div className="section-head"><h2>History for this mobile</h2>{history && <a href={`/customers/${history.customerId}`}>Customer 360</a>}</div>
            {!history && <p className="muted">No earlier complaints for this mobile.</p>}
            {history && (
              <>
                <p>{history.assets.length ? history.assets.map((asset) => <span key={asset.id}>{asset.label} · {asset.warranty} · {asset.amc}<br /></span>) : <span className="muted">No installed product on record. </span>}</p>
                {!history.complaints.length && <p className="muted">No complaints yet.</p>}
                {history.complaints.map((row) => (
                  <p key={row.ticketNo}>
                    <a className="mono" href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</a>
                    {" "}· {labelOf(STATUSES, row.status)} · {formatDay(row.bookDate)} · {row.technician ?? "Unassigned"}
                    <span className="muted"> · {row.problem ?? "Problem not recorded"}{row.resolution ? ` · ${row.resolution}` : ""}{row.spares.length ? ` · Spares ${row.spares.join(", ")}` : ""}{row.repeatOfTicket ? ` · repeat of ${row.repeatOfTicket}` : ""}</span>
                  </p>
                ))}
              </>
            )}
          </div>
        )}
        {warning?.reason && (
          <div className="banner">
            {warning.reason}{" "}
            {(warning.open ?? warning.duplicates ?? []).map((row: { ticketNo: string }) => (
              <a key={row.ticketNo} href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</a>
            ))}
            <label><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} /> Override</label>
            <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Reason" />
          </div>
        )}
        <label className="stack">Customer name<input name="customerName" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
      </section>
      <section className="panel stack form-section">
        <header className="section-head"><span className="step">2</span><h2>Location</h2></header>
        <label className="stack">Address<input name="address" defaultValue={customer?.address ?? ""} key={`${customer?.id ?? "new"}-address`} /></label>
        <div className="filters">
          <label className="stack">State<select value={stateId} onChange={(event) => { setStateId(event.target.value); setDistrictId(""); }}>
            <option value="">State</option>
            {(options.states as Option[]).map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
          </select></label>
          <select value={districtId} onChange={(event) => setDistrictId(event.target.value)}>
            <option value="">District</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Area / block</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
          <label className="stack">Pincode<input name="pincode" inputMode="numeric" value={pincode} onChange={(event) => setPincode(event.target.value)} /></label>
        </div>
      </section>
      <section className="panel stack form-section">
        <header className="section-head"><span className="step">3</span><h2>Product</h2></header>
        <div className="filters">
          <select value={categoryId} onChange={(event) => chooseCategory(event.target.value)}>
            <option value="">Product category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={productId} onChange={(event) => chooseProduct(event.target.value)}><option value="">Product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          <label className="stack">Brand<select name="brandId" defaultValue=""><option value="">Brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        </div>
      </section>
      <section className="panel stack form-section">
        <header className="section-head"><span className="step">4</span><h2>Complaint</h2></header>
        <div className="chips">
          {CALL_TYPES.map((type) => <button type="button" key={type.id} className={`chip ${callType === type.id ? "on" : ""}`} onClick={() => setCallType(type.id)}>{type.label}</button>)}
        </div>
        <div className="filters">
          <label className="stack">Nature of complaint<select name="natureId" defaultValue=""><option value="">Nature of complaint</option>{(options.issues as Option[]).map((issue) => <option key={issue.id} value={issue.id}>{issue.name}</option>)}</select></label>
          <select name="priority" defaultValue="NORMAL">{PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select name="source" defaultValue="CALL">{SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <label className="stack">Schedule date<input name="scheduleDate" placeholder="dd/mm/yyyy" inputMode="numeric" /></label>
        </div>
        <details>
          <summary>Scheme, Saral and more</summary>
          <div className="filters">
            <input name="saralId" placeholder="Saral Id" />
            <input name="schemeName" placeholder="MSEDCL or KUSUM" />
            <input name="msedclConsumerNo" placeholder="MSEDCL consumer no" />
            <input name="msedclSubdivision" placeholder="Subdivision" />
            <input name="natureText" placeholder="Nature" />
          </div>
        </details>
      </section>
      <section className="panel form-section">
        <header className="section-head"><span className="step">5</span><h2>Assignment</h2></header>
        {suggested ? <p><b>{suggested.name}</b> · {suggested.reason}</p> : <p className="muted">No technician covers this pincode yet. You can still book it unassigned.</p>}
        <div className="filters">
          <button type="button" className={`chip ${assignMode === "suggest" ? "on" : ""}`} onClick={() => { if (!suggestions[0]) { showToast("No technician covers this pincode"); return; } setAssignMode("suggest"); setEngineerId(suggestions[0].engineerId); }}>Use suggestion</button>
          <button type="button" className={`chip ${assignMode === "none" ? "on" : ""}`} onClick={() => setAssignMode("none")}>Leave open</button>
          <select value={engineerId} onChange={(event) => { setEngineerId(event.target.value); setAssignMode("manual"); }}>
            <option value="">Choose someone else</option>
            {suggestions.map((row) => <option key={row.engineerId} value={row.engineerId}>{row.name} · {row.openCount} open</option>)}
            {(options.engineers as Option[]).filter((row) => row.companyId === companyId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </div>
      </section>
      </div>
      <aside className="submit-bar panel">
        <p className="kicker">Summary</p>
        <p><b>{customerName || customer?.name || "New customer"}</b></p>
        <p className="mono">{phone || "Mobile"}</p>
        <p>{districtName || "Location"}{pincode ? ` · ${pincode}` : ""}</p>
        <p>{productName || "Product"} · {CALL_TYPES.find((type) => type.id === callType)?.label}</p>
        <p className="muted">{assignMode === "none" ? "Leave open" : suggested?.name || "Assignment"}</p>
        {error && <div className="banner bad">{error}</div>}
        <button className="btn" disabled={pending}>{pending ? "Booking…" : "Save complaint"}</button>
      </aside>
    </form>
  );
}
