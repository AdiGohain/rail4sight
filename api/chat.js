export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Parse body if it's a string (Vercel sometimes doesn't auto-parse)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { messages, stats } = body || {};
  
  console.log("Request body received:", JSON.stringify({ messages: messages?.length, stats: !!stats }));
  
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
    const geminiMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.4 }
        }),
      }
    );

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
    res.json({ reply });

  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: err.message });
  }
}