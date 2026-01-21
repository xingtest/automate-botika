require('dotenv').config();

const apiKey = process.env.API_KEY_GEMINI;

// List available models via Gemini API
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
        console.log('📋 Available Gemini Models:\n');

        if (data.models) {
            data.models
                .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                .forEach(model => {
                    console.log(`✅ ${model.name}`);
                });
        } else {
            console.log('Error:', JSON.stringify(data, null, 2));
        }
    })
    .catch(err => console.error('Error:', err));
