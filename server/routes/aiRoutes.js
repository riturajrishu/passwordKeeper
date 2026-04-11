import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Gemini 2.5 Flash — Direct REST API (v1 endpoint) ──────────────────
const GEMINI_MODEL = 'gemini-2.5-flash';

router.post('/analyze-phishing', verifyToken, async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ 
                success: false, 
                message: "Gemini API key is not configured. Please add GEMINI_API_KEY to your server .env file." 
            });
        }

        const { text } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).json({ success: false, message: "No content provided for analysis." });
        }

        const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        const prompt = `You are an elite Cybersecurity Phishing & Social Engineering Analyst working for an enterprise security firm.

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

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.15,
                    maxOutputTokens: 2048,
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `Gemini API returned status ${response.status}`);
        }

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error("Gemini returned an empty response.");
        }

        // Extract JSON from response (handles edge cases where AI wraps in backticks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI response was not valid JSON.");
        }

        const parsed = JSON.parse(jsonMatch[0]);

        res.status(200).json({
            success: true,
            data: parsed
        });

    } catch (error) {
        console.error("Gemini Analysis Error:", error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message || "AI analysis failed. Please try again." 
        });
    }
});

export default router;
