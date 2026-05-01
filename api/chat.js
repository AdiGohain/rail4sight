export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Access-Control-Allow-Origin", "*");

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { messages, stats } = body || {};

  if (!messages || !stats) return res.status(400).json({ error: "Missing messages or stats" });

  const systemPrompt = `You are Rail4Sight, an AI network planning assistant for transport authorities.
You have access to the following live delay data summary:

Total records: ${stats.total?.toLocaleString()}
Arrival delay rate: ${stats.delayRate}% of journeys arrived late
Departure delay rate: ${stats.depDelayRate}%
Average arrival delay (when late): ${stats.avgArrivalDelay} minutes
Average departure delay (when late): ${stats.avgDepDelay} minutes
Maximum arrival delay: ${stats.maxArrivalDelay} minutes
Maximum departure delay: ${stats.maxDepDelay} minutes

Delay severity breakdown:
- On time: ${stats.delayBuckets?.on_time?.toLocaleString()}
- Slight (1-5 min): ${stats.delayBuckets?.slight?.toLocaleString()}
- Moderate (6-15 min): ${stats.delayBuckets?.moderate?.toLocaleString()}
- Significant (16-30 min): ${stats.delayBuckets?.significant?.toLocaleString()}
- Severe (30+ min): ${stats.delayBuckets?.severe?.toLocaleString()}

Top delayed lines: ${stats.topLines?.map(l => `${l.line} (${l.delay_rate}% delayed, avg ${l.avg_delay_m}min)`).join(", ")}
Top delayed stations: ${stats.topStations?.map(s => `${s.station}, ${s.city} (${s.delay_rate}% delayed)`).join(", ")}
Disruption causes: ${stats.causeList?.map(c => `${c.cause} ${c.pct}%`).join(", ")}

Your role: identify underperforming lines and stations, diagnose disruption patterns, recommend capacity or operational interventions, and produce briefing-ready insights. Be concise and precise. Respond in 2-4 short paragraphs max.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
        ],
        max_tokens: 1000,
        temperature: 0.4,
      }),
    });

    const data = await response.json();
    console.log("Groq response:", JSON.stringify(data));
    const reply = data.choices?.[0]?.message?.content || "No response received.";
    res.json({ reply });

  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: err.message });
  }
}