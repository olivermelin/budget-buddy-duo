// Supabase Edge Function: financial-health-advice
//
// Tar emot den färdigräknade ekonomiska hälsobilden (score, basis, findings) från
// regelmotorn i src/lib/financial-health.ts och låter Claude formulera en kort,
// personlig svensk sammanfattning. AI:n får ALDRIG ändra siffrorna — bara formulera
// dem. Klienten faller tillbaka på en deterministisk sammanfattning om denna
// funktion saknas, saknar ANTHROPIC_API_KEY, eller fallerar.
//
// Deploy:  supabase functions deploy financial-health-advice
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk@^0.70.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Finding {
  status: "good" | "warn" | "bad";
  title: string;
  detail: string;
  source: string;
  action?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Endast POST" }, 405);

  // verify_jwt är på som standard, men kräv ändå en Authorization-header explicit.
  if (!req.headers.get("Authorization")) return json({ error: "Ej inloggad" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI-rådgivning ej konfigurerad" }, 503);

  let payload: { score?: number; grade?: string; basis?: Record<string, number>; findings?: Finding[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ogiltig JSON" }, 400);
  }

  const { score, grade, basis, findings = [] } = payload;

  const findingLines = findings
    .map(f => `- [${f.status}] ${f.title}: ${f.detail}${f.action ? ` (Förslag: ${f.action})` : ""} (Källa: ${f.source})`)
    .join("\n");

  const userContent = [
    `Hälsoscore: ${score}/100 (${grade}).`,
    basis ? `Underlag: inkomst ${Math.round(basis.income)} kr/mån, fasta ${Math.round(basis.fixed)} kr, rörliga ${Math.round(basis.variable)} kr, sparande ${Math.round(basis.savings)} kr, sparkvot ${Math.round((basis.savingsRate ?? 0) * 100)} %, lånekostnad ${Math.round((basis.debtService ?? 0) * 100)} % av inkomst.` : "",
    "",
    "Fynd:",
    findingLines || "(inga fynd)",
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system:
        "Du är en varm, konkret privatekonomisk rådgivare för ett svenskt par. " +
        "Skriv en kort sammanfattning på svenska (2–4 meningar) av deras ekonomiska hälsa. " +
        "Lyft det viktigaste de bör göra först. Var uppmuntrande men ärlig. " +
        "Använd ENBART siffrorna och fynden du får — hitta aldrig på belopp eller fakta. " +
        "Skriv flytande prosa, inga punktlistor, ingen rubrik.",
      messages: [{ role: "user", content: userContent }],
    });

    const advice = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    if (!advice) return json({ error: "Tomt svar" }, 502);
    return json({ advice }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "AI-fel" }, 502);
  }
});
