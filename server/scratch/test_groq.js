import dotenv from 'dotenv';
dotenv.config();

const testGroq = async () => {
    const apiKey = process.env.GROQ_API_KEY;
    console.log('Testing Groq Key:', apiKey ? 'Loaded (starts with ' + apiKey.substring(0, 10) + ')' : 'MISSING');

    if (!apiKey) return;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Say hello' }],
                max_tokens: 10
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
};

testGroq();
