const res = await fetch("http://localhost:3000/api/scan/full", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://navigator.global/gb", useAi: true }),
});

if (!res.ok) {
  const body = await res.json();
  console.error("HTTP error", res.status, body);
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const ev = JSON.parse(line.slice(6));
    if (ev.type === "progress") {
      console.log(`[progress] ${ev.stage} ${ev.percent}% — ${ev.message}`);
    } else if (ev.type === "complete") {
      console.log("\n=== COMPLETE ===");
      console.log("warnings:", ev.result.warnings);
      console.log("useAi:", ev.result.useAi);
      const sources = [...new Set(ev.result.components.map((c) => c.source))];
      console.log("component sources:", sources);
      console.log("component count:", ev.result.components.length);
    } else if (ev.type === "error") {
      console.error("\n=== ERROR ===", ev.message);
    }
  }
}
