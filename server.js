// ============================================
// MULTI-CHARACTER VOICE CHATBOT - SERVER.JS
// VERCEL-COMPATIBLE WITH ENVIRONMENT VARIABLES
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CRITICAL: Get API key from environment - works on both local and Vercel
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY is not set in environment variables!');
  console.error('   For local: Add to .env file');
  console.error('   For Vercel: Run "vercel env add OPENAI_API_KEY"');
}

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Character definitions
const characters = {
  joey: {
    name: 'Joey Tribbiani',
    source: 'Friends',
    systemPrompt: `You are Joey Tribbiani from the TV show Friends. You're a struggling actor known for being charming, funny, and not very intelligent. You say "How you doin'?" a lot. You think everything is about acting or dating. You're loyal to your friends but often misunderstand things. Keep responses short (1-2 sentences) and stay in character. Never break character or mention you're an AI.`,
    greeting: `Hey there! How you doin'? I'm Joey Tribbiani, and I'm here to chat with ya. What's up?`
  },
  dwight: {
    name: 'Dwight K. Schrute',
    source: 'The Office',
    systemPrompt: `You are Dwight K. Schrute from The Office. You're intense, competitive, serious, and obsessed with authority, efficiency, and your beet farm. You speak formally and take everything very seriously. You often mention your role as Assistant Regional Manager or Assistant to the Regional Manager (you care which title it is). You're loyal but difficult. Keep responses short (1-2 sentences) and stay in character. Never break character or mention you're an AI.`,
    greeting: `Question. What brings you here today? I'm Dwight K. Schrute, Assistant Regional Manager, and I don't have time for nonsense.`
  },
  dhruv: {
    name: 'Dhruv Rathee',
    source: 'YouTuber / Social Commentator',
    systemPrompt: `You are Dhruv Rathee, a popular Indian YouTuber and educator known for explaining complex topics in simple terms. You focus on political analysis, social issues, and education. You're calm, articulate, fact-based, and balanced in your approach. You often reference data and research. Keep responses short (1-2 sentences) and stay in character. Never break character or mention you're an AI.`,
    greeting: `Hello! I'm Dhruv Rathee. I'm here to discuss important topics and share insights. What would you like to know about?`
  }
};

const chatHistories = {
  joey: [],
  dwight: [],
  dhruv: []
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// API ROUTE 1: /api/transcribe
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!OPENAI_API_KEY) {
      console.error('[Transcribe] No API key found');
      return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }

    // Save audio to temporary file (use /tmp on Vercel, __dirname locally)
    const tempDir = process.env.VERCEL ? '/tmp' : __dirname;
    const tempFilePath = path.join(tempDir, `temp_audio_${Date.now()}.wav`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    console.log('[Transcribe] Calling Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en',
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    console.log('[Transcribe] Success:', transcription.text);
    res.json({ transcription: transcription.text });
  } catch (error) {
    console.error('[Transcribe] Error:', error.message);
    console.error('[Transcribe] Full error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// API ROUTE 2: /api/respond
app.post('/api/respond', async (req, res) => {
  try {
    const { userMessage, character } = req.body;

    if (!userMessage || !character) {
      return res.status(400).json({ error: 'Missing userMessage or character' });
    }

    if (!characters[character]) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    if (!OPENAI_API_KEY) {
      console.error('[Respond] No API key found');
      return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }

    const systemPrompt = characters[character].systemPrompt;
    const history = chatHistories[character];

    history.push({ role: 'user', content: userMessage });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history
    ];

    console.log(`[Respond] Generating response for ${character}...`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 150,
      temperature: 0.9
    });

    const assistantMessage = response.choices[0].message.content;
    history.push({ role: 'assistant', content: assistantMessage });

    console.log('[Respond] Success:', assistantMessage);
    res.json({ response: assistantMessage });
  } catch (error) {
    console.error('[Respond] Error:', error.message);
    console.error('[Respond] Full error:', error);
    res.status(500).json({ error: 'Response generation failed', details: error.message });
  }
});

// API ROUTE 3: /api/tts
app.post('/api/tts', async (req, res) => {
  try {
    const { text, character } = req.body;

    if (!text || !character) {
      return res.status(400).json({ error: 'Missing text or character' });
    }

    if (!OPENAI_API_KEY) {
      console.error('[TTS] No API key found');
      return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }

    const voiceMap = {
      joey: 'onyx',
      dwight: 'echo',
      dhruv: 'fable'
    };

    const voice = voiceMap[character];

    console.log(`[TTS] Creating audio with voice: ${voice}`);
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    console.log('[TTS] Audio generated, size:', base64Audio.length);
    res.json({ audio: base64Audio, character });
  } catch (error) {
    console.error('[TTS] Error:', error.message);
    console.error('[TTS] Full error:', error);
    res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
  }
});

// API ROUTE 4: /api/characters
app.get('/api/characters', (req, res) => {
  const charList = Object.keys(characters).map(key => ({
    id: key,
    name: characters[key].name,
    source: characters[key].source,
    greeting: characters[key].greeting
  }));
  res.json(charList);
});

// API ROUTE 5: /api/clear-history
app.post('/api/clear-history', (req, res) => {
  const { character } = req.body;
  if (character && chatHistories[character]) {
    chatHistories[character] = [];
    console.log(`[Clear] Cleared history for ${character}`);
    res.json({ success: true, message: `Chat history cleared for ${character}` });
  } else {
    res.status(400).json({ error: 'Invalid character' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log('   🎤 VOICE CHATBOT SERVER RUNNING');
  console.log('   📍 http://localhost:' + PORT);
  console.log('   🔑 API Key:', OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
  console.log('═'.repeat(50) + '\n');
  console.log('Available characters:');
  Object.values(characters).forEach(char => {
    console.log(`  • ${char.name} (${char.source})`);
  });
  console.log('\n');
});