// ============================================
// JOEY VOICE CHATBOT - BACKEND SERVER
// ============================================

// 1. IMPORTS - Load the libraries we installed
require('dotenv').config(); // Load environment variables from .env file
const express = require('express'); // Web framework for creating routes
const axios = require('axios'); // Make HTTP requests to OpenAI APIs
const cors = require('cors'); // Allow browser to safely talk to this server
const fs = require('fs'); // Read/write files
const path = require('path'); // Handle file paths

// 2. INITIALIZE EXPRESS APP
const app = express();
const PORT = process.env.PORT || 3000;

// 3. MIDDLEWARE - Set up how the server handles requests
app.use(cors()); // Enable cross-origin requests
app.use(express.json({ limit: '10mb' })); // Parse JSON data (allow up to 10MB)
app.use(express.static('public')); // Serve HTML/CSS/JS files from 'public' folder

// 4. CHECK IF API KEY EXISTS
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

// Debug: Show key is loaded (masked for security)
const keyPreview = process.env.OPENAI_API_KEY.substring(0, 10) + '...';
console.log(`✅ API Key loaded: ${keyPreview}`);
console.log(`✅ API Key length: ${process.env.OPENAI_API_KEY.length} characters`);

// ============================================
// ROUTE 1: /transcribe - Convert Audio to Text
// ============================================
app.post('/transcribe', async (req, res) => {
  try {
    console.log('📝 Transcribing audio...');
    
    // Get the audio data from the request
    const audioData = req.body.audio;
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Convert base64 string to binary buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
    
    // Create FormData to send to Whisper API
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', audioBuffer, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Whisper will detect English/Hindi

    console.log('🚀 Sending to OpenAI Whisper API...');

    // Send to OpenAI Whisper API
    const whisperResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const transcript = whisperResponse.data.text;
    console.log(`✅ Transcript: "${transcript}"`);
    
    res.json({ transcript });
  } catch (error) {
    console.error('❌ Transcription error:', error.response?.data || error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Transcription failed', 
      details: error.response?.data?.error?.message || error.message 
    });
  }
});

// ============================================
// ROUTE 2: /respond - Generate Joey's Response
// ============================================
app.post('/respond', async (req, res) => {
  try {
    console.log('🤔 Generating response...');
    
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    // Joey's system prompt - this is how we make GPT sound like Joey
    const joeysPersonality = `You are Joey Tribbiani from FRIENDS. You're charming, funny, lovable, and a bit dim-witted. Guidelines:
- Use "How you doin'?" only occasionally (maybe 1 in 4 times), not in every message
- Reference acting, food, romance, or your lifestyle naturally in conversation
- Be enthusiastic, casual, and friendly in tone
- Use casual grammar with dropped g's: "doin'", "thinkin'", "actin'"
- Keep it conversational - speak TO the person, not at them
- Keep responses to 1-2 sentences max for natural back-and-forth
- If user speaks Hindi, respond in English but acknowledge you understood
- Don't be repetitive - vary your responses and keep it fresh
Example good responses: 
  "Pizza's my weakness, dude. You can't go wrong!"
  "Auditions are brutal, but I'm still hoppin' for that big break."
  "Nah, I'm more of a romance guy myself."
Never sound corporate or formal. Be authentic Joey.`;

    // Send to GPT-4o-mini API
    const gptResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: joeysPersonality
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        max_tokens: 100,
        temperature: 0.8 // Balanced: creative but consistent
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const joeyResponse = gptResponse.data.choices[0].message.content;
    console.log(`✅ Joey says: "${joeyResponse}"`);
    
    res.json({ response: joeyResponse });
  } catch (error) {
    console.error('❌ Response generation error:', error.message);
    res.status(500).json({ error: 'Response generation failed', details: error.message });
  }
});

// ============================================
// ROUTE 3: /tts - Convert Text to Speech
// ============================================
app.post('/tts', async (req, res) => {
  try {
    console.log('🎤 Converting text to speech...');
    
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Send to OpenAI TTS API
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1', // Fast text-to-speech model
        voice: 'onyx', // Deep, male Joey voice
        input: text,
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // Get audio as binary data
      }
    );

    // Convert audio to base64 so browser can play it
    const audioBase64 = Buffer.from(ttsResponse.data, 'binary').toString('base64');
    console.log('✅ Audio generated');
    
    res.json({ audio: audioBase64 });
  } catch (error) {
    console.error('❌ TTS error:', error.message);
    res.status(500).json({ error: 'TTS failed', details: error.message });
  }
});

// ============================================
// HEALTH CHECK ROUTE (for testing)
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running! 🚀' });
});

// ============================================
// START THE SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   🎬 JOEY VOICE CHATBOT - Server Ready   ║
╚══════════════════════════════════════════╝
  
  📡 Server running at: http://localhost:${PORT}
  🎙️  Test audio endpoints ready
  ✅ OpenAI APIs connected
  
  Press Ctrl+C to stop the server
  `);
});