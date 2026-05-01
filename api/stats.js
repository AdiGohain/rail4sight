import duckdb from "duckdb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const PARQUET_URL = process.env.PARQUET_URL;
  if (!PARQUET_URL) return res.status(500).json({ error: "PARQUET_URL not set" });

  const db   = new duckdb.Database(":memory:");
  const conn = db.connect();
  const query = (sql) =>
    new Promise((resolve, reject) =>
      conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

  try {
    await query(`INSTALL httpfs; LOAD httpfs;`);
    const base = `FROM read_parquet('${PARQUET_URL}')`;

    const [totals] = await query(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(CASE WHEN arrival_delay_m   > 0 THEN 1.0 ELSE 0 END) * 100, 1) AS delay_rate,
        ROUND(AVG(CASE WHEN departure_delay_m > 0 THEN 1.0 ELSE 0 END) * 100, 1) AS dep_delay_rate,
        ROUND(AVG(CASE WHEN arrival_delay_m   > 0 THEN arrival_delay_m   END), 1) AS avg_arrival_delay,
        ROUND(AVG(CASE WHEN departure_delay_m > 0 THEN departure_delay_m END), 1) AS avg_dep_delay,
        MAX(arrival_delay_m)   AS max_arrival_delay,
        MAX(departure_delay_m) AS max_dep_delay
      ${base}
    `);

    const topLines = await query(`
      SELECT
        line,
        COUNT(*) AS total,
        SUM(CASE WHEN arrival_delay_m > 0 THEN 1 ELSE 0 END) AS delayed,
        ROUND(AVG(CASE WHEN arrival_delay_m > 0 THEN 1.0 ELSE 0 END)*100,1) AS delay_rate,
        ROUND(AVG(CASE WHEN arrival_delay_m > 0 THEN arrival_delay_m END),1) AS avg_delay_m
      ${base}
      WHERE line IS NOT NULL
      GROUP BY line
      ORDER BY delay_rate DESC
      LIMIT 6
    `);

    const topStations = await query(`
      SELECT
        station, city,
        COUNT(*) AS total,
        ROUND(AVG(CASE WHEN arrival_delay_m > 0 THEN 1.0 ELSE 0 END)*100,1) AS delay_rate,
        ROUND(AVG(CASE WHEN arrival_delay_m > 0 THEN arrival_delay_m END),1) AS avg_delay_m
      ${base}
      WHERE station IS NOT NULL
      GROUP BY station, city
      ORDER BY delay_rate DESC
      LIMIT 6
    `);

    const [buckets] = await query(`
      SELECT
        SUM(CASE WHEN arrival_delay_m <= 0              THEN 1 ELSE 0 END) AS on_time,
        SUM(CASE WHEN arrival_delay_m BETWEEN 1  AND 5  THEN 1 ELSE 0 END) AS slight,
        SUM(CASE WHEN arrival_delay_m BETWEEN 6  AND 15 THEN 1 ELSE 0 END) AS moderate,
        SUM(CASE WHEN arrival_delay_m BETWEEN 16 AND 30 THEN 1 ELSE 0 END) AS significant,
        SUM(CASE WHEN arrival_delay_m > 30              THEN 1 ELSE 0 END) AS severe
      ${base}
    `);

    const causeList = await query(`
      SELECT
        info AS cause,
        COUNT(*) AS count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
      ${base}
      WHERE info IS NOT NULL AND info != ''
      GROUP BY info
      ORDER BY count DESC
      LIMIT 8
    `);

    conn.close();

    // Convert BigInt to Number so JSON.stringify works
    const safe = (obj) => JSON.parse(JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? Number(v) : v
    ));

    res.json(safe({
      total:           Number(totals.total),
      delayRate:       totals.delay_rate,
      depDelayRate:    totals.dep_delay_rate,
      avgArrivalDelay: totals.avg_arrival_delay,
      avgDepDelay:     totals.avg_dep_delay,
      maxArrivalDelay: totals.max_arrival_delay,
      maxDepDelay:     totals.max_dep_delay,
      topLines,
      topStations,
      delayBuckets:    buckets,
      causeList,
    }));

  } catch (err) {
    console.error("stats error:", err);
    res.status(500).json({ error: err.message });
  }
}