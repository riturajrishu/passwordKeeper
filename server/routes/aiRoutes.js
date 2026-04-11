import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════
// PHISHING ANALYSIS PROMPT (shared by all AI providers)
// ══════════════════════════════════════════════════════════════════════
const buildPrompt = (text) => `You are an elite Cybersecurity Phishing & Social Engineering Analyst working for an enterprise security firm.

Perform a deep forensic analysis of the following content (email, SMS, URL, or message). Evaluate it for:
1. Social engineering tactics (urgency, fear, authority impersonation)
2. Malicious or suspicious URLs / IP addresses
3. Brand spoofing or domain impersonation
4. Credential harvesting attempts
5. Financial fraud indicators
6. Grammar / formatting anomalies typical of phishing
7. Attachment or download lures
8. Homoglyph attacks (e.g., using "rn" for "m", Cyrillic characters)

You MUST respond with RAW JSON ONLY — no markdown, no explanation, no backticks. 
Use exactly this structure:
{
  "score": <integer 0-100, where 100 = perfectly safe, 0 = confirmed malicious>,
  "riskLabel": <exactly one of: "CRITICAL RISK", "HIGH RISK", "SUSPICIOUS", "LOW RISK", "SAFE">,
  "summary": <1-2 sentence overall verdict explaining the threat level>,
  "flags": [
    { "type": <"critical" | "high" | "medium" | "low" | "safe">, "category": <short category like "Urgency Tactic" | "Suspicious URL" | "Brand Spoofing" etc.>, "text": <concise 1-sentence explanation> }
  ],
  "recommendation": <1 sentence actionable advice for the user>
}

Content to analyze:
"""
${text.replace(/"/g, '\\"')}
"""`;

// ══════════════════════════════════════════════════════════════════════
// PROVIDER 1: Google Gemini 2.5 Flash
// ══════════════════════════════════════════════════════════════════════
const callGemini = async (text) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(text) }] }],
            generationConfig: {
                temperature: 0.15,
                maxOutputTokens: 2048,
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini returned status ${response.status}`);
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Gemini returned empty response');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini response was not valid JSON');

    return JSON.parse(jsonMatch[0]);
};

// ══════════════════════════════════════════════════════════════════════
// PROVIDER 2: Groq (Llama 3.3 70B)
// ══════════════════════════════════════════════════════════════════════
const callGroq = async (text) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an elite cybersecurity phishing analyst. You ONLY respond with raw JSON, never markdown or explanations.' },
                { role: 'user', content: buildPrompt(text) }
            ],
            temperature: 0.15,
            max_tokens: 2048,
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Groq returned status ${response.status}`);
    }

    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) throw new Error('Groq returned empty response');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Groq response was not valid JSON');

    return JSON.parse(jsonMatch[0]);
};

// ══════════════════════════════════════════════════════════════════════
// PROVIDER 3: Hugging Face Inference API (Mistral 7B Instruct)
// ══════════════════════════════════════════════════════════════════════
const callHuggingFace = async (text) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not configured');

    const model = 'mistralai/Mistral-7B-Instruct-v0.3';
    const prompt = `<s>[INST] ${buildPrompt(text)} [/INST]`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 2048,
                temperature: 0.15,
                return_full_text: false,
            },
            options: {
                wait_for_model: true, // Handle cold starts gracefully
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `HuggingFace returned status ${response.status}`);
    }

    const responseText = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    if (!responseText) throw new Error('HuggingFace returned empty response');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('HuggingFace response was not valid JSON');

    return JSON.parse(jsonMatch[0]);
};

// ══════════════════════════════════════════════════════════════════════
// ROUTE: /analyze-phishing — Cascading Fallback (Gemini → Groq → HF)
// ══════════════════════════════════════════════════════════════════════
router.post('/analyze-phishing', verifyToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).json({ success: false, message: "No content provided for analysis." });
        }

        // ── Tier 1: Try Gemini ───────────────────────────────────────
        try {
            console.log('Attempting Gemini Analysis...');
            const result = await callGemini(text);
            console.log('Gemini Analysis Successful.');
            return res.status(200).json({ success: true, data: result, engine: 'gemini' });
        } catch (geminiError) {
            console.warn('Gemini Tier Failed:', geminiError.message);
        }

        // ── Tier 2: Try Groq ─────────────────────────────────────────
        try {
            console.log('Attempting Groq Fallback (Llama 3.3)...');
            const result = await callGroq(text);
            console.log('Groq Analysis Successful.');
            return res.status(200).json({ success: true, data: result, engine: 'groq' });
        } catch (groqError) {
            console.warn('Groq Tier Failed:', groqError.message);
        }

        // ── Tier 3: Try Hugging Face ─────────────────────────────────
        try {
            console.log('Attempting Hugging Face Fallback (Mistral 7B)...');
            const result = await callHuggingFace(text);
            console.log('Hugging Face Analysis Successful.');
            return res.status(200).json({ success: true, data: result, engine: 'huggingface' });
        } catch (hfError) {
            console.error('Hugging Face Tier Also Failed:', hfError.message);
        }

        // ── All AI providers failed ──────────────────────────────────
        console.error('All 3 AI providers exhausted. Returning 503 for local fallback.');
        return res.status(503).json({
            success: false,
            message: 'All cloud AI services are currently unavailable. Falling back to Local Heuristic Engine.'
        });

    } catch (error) {
        console.error("Analysis Route Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "AI analysis failed."
        });
    }
});

export default router;
