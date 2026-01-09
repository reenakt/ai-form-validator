import { NextResponse } from "next/server";

const DEFAULT_TIMEOUT = 10_000;
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonFromReply(reply: string) {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callAi(fullPrompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: fullPrompt }],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await res.text();

      if (res.ok) return text;

      // retry on rate limits / service unavailable
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get("retry-after");
        let waitMs = BASE_DELAY * 2 ** attempt + Math.floor(Math.random() * 300);
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!Number.isNaN(parsed)) waitMs = parsed * 1000;
        }
        // try to parse suggestion like "retry in 12.7s"
        const secsMatch = text.match(/retry in ([0-9.]+)s/i);
        if (secsMatch) {
          const parsed = parseFloat(secsMatch[1]);
          if (!Number.isNaN(parsed)) waitMs = Math.ceil(parsed * 1000);
        }

        await sleep(waitMs);
        continue;
      }

      throw new Error(`AI API error ${res.status}: ${text}`);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") {
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY * 2 ** attempt);
          continue;
        }
        throw new Error("AI request timed out");
      }
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY * 2 ** attempt + Math.floor(Math.random() * 300));
        continue;
      }
      throw err;
    }
  }

  throw new Error("AI request failed after retries");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' in request body" },
        { status: 400 }
      );
    }

    const useMock =
      process.env.USE_MOCK_AI === "1" || process.env.USE_MOCK_AI === "true";

    if (useMock) {
      return NextResponse.json({
        validationRules: ["email: required, must be a valid email"],
        accessibility: ["Ensure all form fields have associated labels"],
        uxSuggestions: ["Show inline validation messages as user types"],
        edgeCases: ["Empty optional fields with default values"],
      });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY / GOOGLE_GEMINI_API_KEY");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const systemPrompt = `
You are a senior frontend engineer specializing in forms, UX, and accessibility.

Analyze the provided form definition and return STRICT JSON with:
- validationRules: array of strings
- accessibility: array of strings
- uxSuggestions: array of strings
- edgeCases: array of strings

Do NOT include explanations or markdown.
Return ONLY valid JSON.
`;

    const fullPrompt = `${systemPrompt}\nForm:\n${prompt}`;

    const text = await callAi(fullPrompt, apiKey);

    // Try interpreting as JSON response from API first
    let parsedReply: any = null;
    try {
      const apiJson = JSON.parse(text);
      parsedReply = apiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? text;
    } catch {
      parsedReply = text;
    }

    const extracted = extractJsonFromReply(parsedReply);
    if (!extracted) {
      console.error("Invalid AI response, couldn't extract JSON", parsedReply);
      return NextResponse.json({ error: "Invalid AI response format", raw: parsedReply }, { status: 500 });
    }

    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error("Server error:", error?.message ?? error);
    if (error?.message?.includes("timed out")) {
      return NextResponse.json({ error: "AI request timed out" }, { status: 504 });
    }
    if (error?.message?.includes("AI API error")) {
      return NextResponse.json({ error: "AI API error", details: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
