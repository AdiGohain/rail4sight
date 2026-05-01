import { useState, useEffect, useRef } from "react";

const ON_TIME_TARGET = 80;

const QUICK_PROMPTS = [
  "Which lines need urgent intervention?",
  "What stations have the worst delays?",
  "Summarise network risk for board briefing",
  "Where should we prioritise capacity?",
];

function KpiCard({ label, value, sub, subColor }) {
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "#fff", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: subColor || "#8888aa", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

function SeverityBar({ rate }) {
  const pct   = Math.min(rate, 100);
  const color = pct > 40 ? "#e24b4a" : pct > 20 ? "#ef9f27" : "#1D9E75";
  const label = pct > 40 ? "High" : pct > 20 ? "Med" : "Low";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "#2a2a4a", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 28 }}>{label}</span>
    </div>
  );
}

export default function Rail4Sight() {
  const [stats, setStats]               = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError]     = useState(null);
  const [messages, setMessages]         = useState([{
    role: "assistant",
    content: "Good morning. I'm your Rail4Sight network planning assistant. I can help you identify underperforming lines and stations, diagnose disruption patterns, model capacity interventions, and produce briefing-ready insights from your delay data. What would you like to analyse?"
  }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(data => { setStats(data); setLoadingStats(false); })
      .catch(e  => { setStatsError(e.message); setLoadingStats(false); });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          stats,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error — please try again." }]);
    }
    setLoading(false);
  }

  const s          = stats || {};
  const onTimeRate = s.delayRate != null ? +(100 - s.delayRate).toFixed(1) : null;
  const delta      = onTimeRate  != null ? (onTimeRate - ON_TIME_TARGET).toFixed(1) : null;
  const deltaColor = delta >= 0 ? "#1D9E75" : "#e24b4a";

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#0d0d1a", minHeight: "100vh", color: "#fff" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: 2 }}>R4S</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}>Rail4Sight — Network Planning Intelligence</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Transport Authority Edition · {loadingStats ? "Loading..." : `${s.total?.toLocaleString() || "—"} records analysed`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#fff" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#9FE1CB", display: "inline-block" }} />
          {loadingStats ? "Connecting..." : "Live dataset"}
        </div>
      </div>

      {statsError && (
        <div style={{ background: "#3a1010", color: "#e24b4a", padding: "10px 24px", fontSize: 13 }}>
          ⚠️ Could not load stats: {statsError}
        </div>
      )}

      {/* KPI Row */}
      <div style={{ padding: "16px 24px", display: "flex", gap: 12 }}>
        <KpiCard
          label="On-time rate"
          value={loadingStats ? "—" : `${onTimeRate}%`}
          sub={loadingStats ? "Loading..." : `${delta >= 0 ? "+" : ""}${delta}pp vs ${ON_TIME_TARGET}% target`}
          subColor={deltaColor}
        />
        <KpiCard
          label="Arrival delay rate"
          value={loadingStats ? "—" : `${s.delayRate}%`}
          sub={loadingStats ? "Loading..." : `Avg ${s.avgArrivalDelay} min when late`}
          subColor="#ef9f27"
        />
        <KpiCard
          label="Departure delay rate"
          value={loadingStats ? "—" : `${s.depDelayRate}%`}
          sub={loadingStats ? "Loading..." : `Avg ${s.avgDepDelay} min when late`}
          subColor="#ef9f27"
        />
        <KpiCard
          label="Max delays recorded"
          value={loadingStats ? "—" : `${s.maxArrivalDelay} min`}
          sub={loadingStats ? "Loading..." : `Dep: ${s.maxDepDelay} min max`}
          subColor="#e24b4a"
        />
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 0, padding: "0 24px 24px" }}>

        {/* Chat panel */}
        <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: "10px 0 0 10px", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a4a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Planning Analyst</span>
            <span style={{ fontSize: 11, background: "#0F3460", color: "#7eb8f7", borderRadius: 20, padding: "3px 10px" }}>Authority Mode</span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, maxHeight: 360 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#0F6E56,#1D9E75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0 }}>AI</div>
                )}
                <div style={{
                  maxWidth: "82%",
                  background: m.role === "user" ? "#0F3460" : "#12122a",
                  borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
                  padding: "10px 14px", fontSize: 13, lineHeight: 1.65,
                  color: m.role === "user" ? "#7eb8f7" : "#d0d0e8",
                  border: "1px solid #2a2a4a",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#0F6E56,#1D9E75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>AI</div>
                <div style={{ background: "#12122a", border: "1px solid #2a2a4a", borderRadius: "4px 12px 12px 12px", padding: "12px 16px", display: "flex", gap: 5 }}>
                  {[0,1,2].map(j => (
                    <span key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75", display: "inline-block", animation: `bounce 1.2s ${j*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "1px solid #2a2a4a" }}>
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => send(p)}
                style={{ fontSize: 12, padding: "5px 11px", borderRadius: 20, border: "1px solid #2a2a4a", background: "#12122a", cursor: "pointer", color: "#8888aa" }}
                onMouseEnter={e => { e.target.style.borderColor="#1D9E75"; e.target.style.color="#1D9E75"; }}
                onMouseLeave={e => { e.target.style.borderColor="#2a2a4a"; e.target.style.color="#8888aa"; }}>
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #2a2a4a", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask a planning or operational question..."
              style={{ flex: 1, fontSize: 13, padding: "9px 13px", background: "#12122a", border: "1px solid #2a2a4a", borderRadius: 8, color: "#fff", outline: "none" }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ padding: "0 16px", fontSize: 16, borderRadius: 8, background: loading || !input.trim() ? "#2a2a4a" : "#1D9E75", color: "#fff", border: "none", cursor: loading || !input.trim() ? "default" : "pointer" }}>
              ↑
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderLeft: "none", borderRadius: "0 10px 10px 0", display: "flex", flexDirection: "column", overflowY: "auto", maxHeight: 600 }}>

          {/* Top delayed lines */}
          <div style={{ padding: "14px", borderBottom: "1px solid #2a2a4a" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8888aa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Top Delayed Lines</div>
            {loadingStats
              ? <div style={{ fontSize: 12, color: "#8888aa" }}>Loading...</div>
              : (s.topLines || []).map((l, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#d0d0e8" }}>{l.line}</span>
                    <span style={{ fontSize: 11, color: "#8888aa" }}>{l.avg_delay_m}m avg</span>
                  </div>
                  <SeverityBar rate={l.delay_rate} />
                </div>
              ))
            }
          </div>

          {/* Delay severity */}
          <div style={{ padding: "14px", borderBottom: "1px solid #2a2a4a" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8888aa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Delay Severity</div>
            {loadingStats
              ? <div style={{ fontSize: 12, color: "#8888aa" }}>Loading...</div>
              : (() => {
                const b = s.delayBuckets || {};
                const t = Object.values(b).reduce((a, v) => a + (+v || 0), 0) || 1;
                return [
                  { label: "On time",      val: b.on_time,     color: "#1D9E75" },
                  { label: "Slight 1–5m",  val: b.slight,      color: "#639922" },
                  { label: "Mod 6–15m",    val: b.moderate,    color: "#ef9f27" },
                  { label: "Sig 16–30m",   val: b.significant, color: "#e07b30" },
                  { label: "Severe 30m+",  val: b.severe,      color: "#e24b4a" },
                ].map(({ label, val, color }, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: "#d0d0e8" }}>{label}</span>
                      <span style={{ fontSize: 11, color: "#8888aa" }}>{Math.round((+val || 0) / t * 100)}%</span>
                    </div>
                    <div style={{ height: 4, background: "#2a2a4a", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((+val || 0) / t * 100)}%`, height: "100%", background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                ));
              })()
            }
          </div>

          {/* Disruption causes */}
          <div style={{ padding: "14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8888aa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Disruption Causes</div>
            {loadingStats
              ? <div style={{ fontSize: 12, color: "#8888aa" }}>Loading...</div>
              : (s.causeList || []).map((c, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: "#d0d0e8", maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.cause}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#8888aa" }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "#2a2a4a", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${c.pct}%`, height: "100%", background: i === 0 ? "#e24b4a" : i === 1 ? "#ef9f27" : "#378ADD", borderRadius: 2 }} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        * { box-sizing: border-box; }
        input::placeholder { color: #4a4a6a; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #12122a; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
      `}</style>
    </div>
  );
}