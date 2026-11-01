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
  const [assignMode] = useState<"none">("none");
  const [step, setStep] = useState(1);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaHits, setAreaHits] = useState<{ id: string; label: string }[]>([]);
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
        engineerId: null,
        assignMode: "none",
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
          <label className="stack">Mobile <span className="req">*</span><input name="phone" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required /></label>
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
        <label className="stack">Customer name <span className="req">*</span><input name="customerName" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
        <label className="stack">Alternate mobile<input name="altPhone" inputMode="numeric" maxLength={10} /></label>
        <label className="stack">Email<input name="email" type="email" /></label>
        <button type="button" className="btn" disabled={!/^[6-9]\d{9}$/.test(phone) || customerName.trim().length < 2} onClick={() => setStep(2)}>Next</button>
      </section>
      <section className="panel stack form-section" hidden={step < 2}>
        <header className="section-head"><span className="step">2</span><h2>Address</h2></header>
        <label className="stack">Address<input name="address" defaultValue={customer?.address ?? ""} key={`${customer?.id ?? "new"}-address`} /></label>
        <div className="filters">
          <label className="stack">State<select value={stateId} onChange={(event) => { setStateId(event.target.value); setDistrictId(""); }}>
            <option value="">State</option>
            {(options.states as Option[]).map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
          </select></label>
          <label className="stack">District <span className="req">*</span><select value={districtId} onChange={(event) => { const id = event.target.value; setDistrictId(id); const row = districts.find((item) => item.id === id); if (row?.stateId) setStateId(row.stateId); }}>
            <option value="">District</option>
            {districts.filter((district) => !stateId || district.stateId === stateId).map((district) => <option key={district.id} value={district.id}>{district.name}, {(options.states as Option[]).find((state) => state.id === district.stateId)?.name}</option>)}
          </select></label>
          <label className="stack">Block / tehsil<input value={areaQuery} onChange={async (event) => {
            const value = event.target.value;
            setAreaQuery(value);
            if (!districtId || value.length < 2) return;
            const response = await fetch(`/api/desk/geo?kind=area&districtId=${districtId}&q=${encodeURIComponent(value)}`);
            if (response.ok) setAreaHits((await response.json()).rows ?? []);
          }} />
            {areaHits.map((hit) => <button type="button" key={hit.id} className="chip" onClick={() => { setAreaId(hit.id); setAreaQuery(hit.label); setAreaHits([]); }}>{hit.label}</button>)}
          </label>
          <label className="stack">Pincode <span className="req">*</span><input name="pincode" inputMode="numeric" maxLength={6} required value={pincode} onChange={async (event) => {
            const value = event.target.value.replace(/\D/g, "").slice(0, 6);
            setPincode(value);
            if (/^[1-9]\d{5}$/.test(value)) {
              const response = await fetch(`/api/desk/geo?kind=pin&q=${value}`);
              const body = await response.json();
              const hit = body.rows?.[0];
              if (hit) { setDistrictId(hit.districtId); setStateId(hit.stateId); if (hit.areaId) { setAreaId(hit.areaId); setAreaQuery(hit.area); } }
            }
          }} /></label>
        </div>
        <button type="button" className="btn" disabled={!districtId || !/^[1-9]\d{5}$/.test(pincode)} onClick={() => setStep(3)}>Next</button>
      </section>
      <section className="panel stack form-section" hidden={step < 3}>
        <header className="section-head"><span className="step">3</span><h2>Product</h2></header>
        <div className="filters">
          <label className="stack">Category<select value={categoryId} onChange={(event) => chooseCategory(event.target.value)}>
            <option value="">Product category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>
          <label className="stack">Product<select value={productId} onChange={(event) => chooseProduct(event.target.value)}><option value="">Product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label className="stack">Brand<select name="brandId" defaultValue=""><option value="">Brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        </div>
        <label className="stack">Product name<input name="productDetails" /></label>
        <label className="stack">Purchase date<input name="purchaseDate" placeholder="dd/mm/yyyy" /></label>
        <button type="button" className="btn" onClick={() => setStep(4)}>Next</button>
      </section>
      <section className="panel stack form-section" hidden={step < 4}>
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
            <label className="stack">Saral / beneficiary id<input name="saralId" /></label>
            <label className="stack">Portal<input name="portal" /></label>
            <label className="stack">Sub-type<input name="subType" /></label>
            <label className="stack">Scheme<input name="schemeName" /></label>
            <label className="stack">MSEDCL request no<input name="msedclRequestNo" /></label>
            <label className="stack">MSEDCL status<input name="msedclStatus" /></label>
            <label className="stack">Request subtype<input name="requestSubtype" /></label>
            <label className="stack">MSEDCL consumer no<input name="msedclConsumerNo" /></label>
            <label className="stack">Subdivision<input name="msedclSubdivision" /></label>
            <label className="stack">Nature<input name="natureText" /></label>
          </div>
        </details>
        <button type="button" className="btn" onClick={() => setStep(5)}>Review</button>
      </section>
      <section className="panel form-section" hidden={step < 5}>
        <header className="section-head"><span className="step">5</span><h2>Review</h2></header>
        <p>{customerName || "Customer"} · {phone}</p>
        <p>{districtName || "Location"}{pincode ? ` · ${pincode}` : ""}</p>
        <p>{productName || "Product"} · {CALL_TYPES.find((type) => type.id === callType)?.label}</p>
        <p>Assignment happens after this complaint is saved.</p>
      </section>
      </div>
      <aside className="submit-bar panel">
        <p className="kicker">Summary</p>
        <p><b>{customerName || customer?.name || "New customer"}</b></p>
        <p className="mono">{phone || "Mobile"}</p>
        <p>{districtName || "Location"}{pincode ? ` · ${pincode}` : ""}</p>
        <p>{productName || "Product"} · {CALL_TYPES.find((type) => type.id === callType)?.label}</p>
        <p className="muted">Unassigned until a state head confirms</p>
        {error && <div className="banner bad">{error}</div>}
        <button className="btn" disabled={pending}>{pending ? "Booking…" : "Save complaint"}</button>
      </aside>
    </form>
  );
}
