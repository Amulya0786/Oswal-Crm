"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { can, type Action } from "@/lib/rbac";
import { actionAllowedForStatus, type DeskAction } from "@/lib/workflow";

const ACTION_PERMISSION: Record<DeskAction, Action | null> = {
  note: "note",
  visit: "visit",
  assign: "assign",
  hold: "hold",
  resume: "hold",
  close: "close",
  happy: "happyCall",
  cancel: "cancel",
};

const LABELS: Record<DeskAction, string> = {
  note: "Add note",
  visit: "Log visit",
  assign: "Assign / re-assign",
  hold: "Hold",
  resume: "Resume",
  close: "Close",
  happy: "Happy calling",
  cancel: "Cancel",
};

export function ComplaintActions(props: {
  complaintId: string;
  status: string;
  role: string;
  centers: { id: string; name: string; engineerName: string }[];
  problems: { id: string; name: string }[];
  solutions: { id: string; name: string; problemId: string | null }[];
  holds: { id: string; name: string }[];
  checklist: { id: string; name: string }[];
}) {
  const router = useRouter();
  const actions = (Object.keys(LABELS) as DeskAction[]).filter((action) => {
    const permission = ACTION_PERMISSION[action];
    return permission && can(props.role, permission) && actionAllowedForStatus(action, props.status);
  });
  const [action, setAction] = useState<DeskAction>(actions[0] ?? "note");
  useEffect(() => {
    if (!actions.includes(action)) setAction(actions[0] ?? "note");
  }, [props.status, action, actions]);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [centerId, setCenterId] = useState(props.centers[0]?.id ?? "");
  const [holdId, setHoldId] = useState(props.holds[0]?.id ?? "");
  const [problemId, setProblemId] = useState(props.problems[0]?.id ?? "");
  const [solutionId, setSolutionId] = useState("");
  const [rating, setRating] = useState(5);
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const solutions = useMemo(() => props.solutions.filter((solution) => !solution.problemId || solution.problemId === problemId), [props.solutions, problemId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const payload: Record<string, unknown> = { type: action };
    if (action === "note" || action === "visit") payload.message = message;
    if (action === "assign") payload.serviceCenterId = centerId;
    if (action === "hold") {
      payload.holdStatusId = holdId;
      payload.reason = reason;
    }
    if (action === "close") {
      payload.actualProblemId = problemId;
      payload.actualSolutionId = solutionId || solutions[0]?.id;
      payload.closeNotes = message;
      payload.checklistIds = checks;
    }
    if (action === "happy") {
      payload.rating = rating;
      payload.notes = message;
    }
    if (action === "cancel") payload.reason = reason;
    const response = await fetch(`/api/complaints/${props.complaintId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not update the complaint.");
      setPending(false);
      return;
    }
    setMessage("");
    setReason("");
    setPending(false);
    router.refresh();
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/complaints/${props.complaintId}/attachments`, { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  if (actions.length === 0) return <p className="text-sm text-muted">No further actions for your role.</p>;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <label>
          <span className="label">Action</span>
          <select className="field" value={action} onChange={(event) => setAction(event.target.value as DeskAction)}>
            {actions.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}
          </select>
        </label>
        {action === "assign" ? (
          <label>
            <span className="label">Service centre</span>
            <select className="field" value={centerId} onChange={(event) => setCenterId(event.target.value)}>
              {props.centers.map((center) => <option key={center.id} value={center.id}>{center.name} · {center.engineerName}</option>)}
            </select>
          </label>
        ) : null}
        {action === "hold" ? (
          <>
            <label>
              <span className="label">Hold status</span>
              <select className="field" value={holdId} onChange={(event) => setHoldId(event.target.value)}>
                {props.holds.map((hold) => <option key={hold.id} value={hold.id}>{hold.name}</option>)}
              </select>
            </label>
            <label><span className="label">Reason</span><textarea className="field min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
          </>
        ) : null}
        {action === "close" ? (
          <>
            <label>
              <span className="label">Actual problem</span>
              <select className="field" value={problemId} onChange={(event) => setProblemId(event.target.value)}>
                {props.problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Actual solution</span>
              <select className="field" value={solutionId || solutions[0]?.id || ""} onChange={(event) => setSolutionId(event.target.value)}>
                {solutions.map((solution) => <option key={solution.id} value={solution.id}>{solution.name}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="label">Check list</legend>
              <div className="space-y-1">
                {props.checklist.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checks.includes(item.id)} onChange={(event) => setChecks((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label><span className="label">Close notes</span><textarea className="field min-h-20" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
          </>
        ) : null}
        {action === "happy" ? (
          <>
            <label>
              <span className="label">Rating</span>
              <select className="field" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
              </select>
            </label>
            <label><span className="label">Feedback</span><textarea className="field min-h-20" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
          </>
        ) : null}
        {action === "cancel" ? <label><span className="label">Reason</span><textarea className="field min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} required /></label> : null}
        {action === "note" || action === "visit" ? <label><span className="label">{action === "visit" ? "Visit note" : "Note"}</span><textarea className="field min-h-24" value={message} onChange={(event) => setMessage(event.target.value)} required /></label> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button className="btn btn-accent w-full" disabled={pending}>{pending ? "Saving…" : LABELS[action]}</button>
      </form>
      {can(props.role, "attach") ? (
        <form onSubmit={upload} className="space-y-2 border-t border-line pt-3">
          <span className="label">Attachment</span>
          <input className="block w-full text-sm" type="file" name="file" required />
          <button className="btn btn-ghost">Upload</button>
        </form>
      ) : null}
    </div>
  );
}
