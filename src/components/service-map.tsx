"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { showToast } from "@/components/toast";

type Pin = { id: string; ticketNo?: string; name?: string; status?: string; lat: number; lng: number; districtName?: string | null; bookDate?: string };

export function ServiceMap() {
  const node = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [note, setNote] = useState("Loading the map…");

  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/desk/map");
      if (!response.ok) showToast("Could not load the map");
      const body = response.ok ? await response.json() : { complaints: [], engineers: [], provider: "osm" };
      if (cancelled || !node.current) return;
      const complaints = (body.complaints ?? []) as Pin[];
      const engineers = (body.engineers ?? []) as Pin[];
      setEmpty(complaints.length + engineers.length === 0);
      const L = (await import("leaflet")).default;
      map = L.map(node.current).setView([22.5, 82], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { attribution: "India, including Jammu & Kashmir and Ladakh" }).addTo(map as never);
      const boundary = await fetch("/maps/india.json").then((item) => item.json()).catch(() => null);
      if (boundary) {
        const layer = L.geoJSON(boundary, { style: { color: "#02502f", weight: 2, fillColor: "#02502f", fillOpacity: 0.08 } }).addTo(map as never);
        map.fitBounds(layer.getBounds(), { padding: [12, 12] });
      }
      for (const pin of complaints) {
        L.circleMarker([pin.lat, pin.lng], { radius: 8, color: "#02502f" }).addTo(map as never).bindPopup(`${pin.ticketNo} · ${pin.status}`);
      }
      for (const pin of engineers) {
        L.circleMarker([pin.lat, pin.lng], { radius: 7, color: "#ffce30" }).addTo(map as never).bindPopup(pin.name ?? "Technician");
      }
      setNote(body.provider === "google" ? "Google Maps" : "OpenStreetMap");
    })().catch(() => setNote("The map tiles did not load. Pins still use the desk data."));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <div>
      <div ref={node} className="service-map" />
      <p className="muted">{note}{empty ? " · No open complaints or technician pins yet. A check-in from the field app drops a pin." : ""}</p>
    </div>
  );
}
