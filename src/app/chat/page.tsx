"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/chrome";
import { chatTurn, freshChat, type ChatSession } from "@/lib/chatbot";

export default function ChatPreviewPage() {
  const [session, setSession] = useState<ChatSession>(freshChat());
  const [lines, setLines] = useState<string[]>(["Oswal Service\n1 Book a complaint\n2 Check status\n3 Talk to a person\n9 हिंदी"]);
  const [text, setText] = useState("");
  return (
    <main className="main" style={{ maxWidth: 480 }}>
      <BrandLogo />
      <p className="kicker">WhatsApp preview</p>
      <h1 style={{ fontFamily: "var(--display)" }}>Chat menu</h1>
      <p className="muted">This is a local preview. Nothing is sent. A real chat uses the WhatsApp webhook.</p>
      <section className="panel stack">
        {lines.map((line, index) => <p key={index} style={{ whiteSpace: "pre-wrap" }}>{line}</p>)}
        <form className="filters" onSubmit={(event) => {
          event.preventDefault();
          const turn = chatTurn(session, text, false);
          setSession(turn.session);
          setLines((current) => [...current, `You: ${text}`, ...turn.messages]);
          setText("");
        }}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="1, 2, 3 or a reply" />
          <button className="btn">Send</button>
        </form>
      </section>
    </main>
  );
}
