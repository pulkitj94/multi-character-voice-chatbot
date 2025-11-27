// ============================================
// MULTI-CHARACTER VOICE CHATBOT - SERVER.JS
// ============================================
// This is the backend that handles:
// 1. Recording audio from browser → Whisper API (transcribe)
// 2. Generating character responses → GPT-4o-mini
// 3. Converting text to speech → OpenAI TTS API
// 4. Managing chat history per character

require('dotenv').config(); // Load API key from .env file
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// ============================================
// INITIALIZE EXPRESS APP & MIDDLEWARE
// ============================================
const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // Store files in memory temporarily

// Enable CORS (allow frontend to talk to backend)
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI client with API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// CHARACTER DEFINITIONS & SYSTEM PROMPTS
// ============================================
// Each character has a unique personality that guides GPT's responses
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
    greeting: `Attention! This is Dwight Kurt Schrute III. As Assistant Regional Manager, I'm prepared to engage in conversation. State your business.`
  },
  dhruv: {
    name: 'Dhruv Rathee',
    source: 'YouTuber / Social Commentator',
    systemPrompt: `You are Dhruv Rathee, a popular Indian YouTuber known for making analytical, fact-based videos on current events, politics, and social issues. You're intelligent, articulate, and passionate about truth and justice. You speak clearly and explain concepts well. You're secular and progressive. Keep responses short (1-2 sentences) and stay in character. Feel free to discuss Indian and global topics. Never break character or mention you're an AI.`,
    greeting: `Namaste! I'm Dhruv Rathee. Thanks for joining me. I'm here to have meaningful conversations on topics you care about. What would you like to discuss?`
  }
};

// ============================================
// IN-MEMORY CHAT HISTORY STORAGE
// ============================================
// In production, you'd use a database (MongoDB, PostgreSQL)
// For now, we store in-memory (resets when server restarts)
const chatHistories = {
  joey: [],
  dwight: [],
  dhruv: []
};

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// ============================================
// API ROUTE 1: /api/transcribe
// ============================================
// Purpose: Convert audio file (user speech) to text using Whisper API
// Input: Audio file from browser microphone
// Output: Transcribed text
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    // Check if audio file was received
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('[TRANSCRIBE] Audio file received, size:', req.file.size);

    // Create a temporary file for Whisper API
    // Whisper API requires a file object, not a buffer
    const tempFilePath = path.join(__dirname, 'temp_audio.wav');
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Call Whisper API to transcribe audio
    console.log('[TRANSCRIBE] Calling OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en',
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    const userText = transcription.text;
    console.log('[TRANSCRIBE] Success:', userText);

    // Send transcribed text back to frontend
    res.json({ transcription: userText });
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error.message);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// ============================================
// API ROUTE 2: /api/respond
// ============================================
// Purpose: Generate character response using GPT-4o-mini
// Input: User text + character type
// Output: Character's spoken response (text)
app.post('/api/respond', async (req, res) => {
  try {
    const { userMessage, character } = req.body;

    console.log('[RESPOND] User:', userMessage, 'Character:', character);

    // Validate inputs
    if (!userMessage || !character) {
      return res.status(400).json({ error: 'Missing userMessage or character' });
    }

    if (!characters[character]) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    // Get the character's system prompt (personality guidelines)
    const characterData = characters[character];
    const systemPrompt = characterData.systemPrompt;

    // Get this character's chat history (for context)
    const chatHistory = chatHistories[character] || [];

    // ✅ FIXED: Build message array with system prompt as first message
    const messages = [
      { role: 'system', content: systemPrompt }, // Character personality instructions
      ...chatHistory, // All previous messages in this character's chat
      { role: 'user', content: userMessage } // New user message
    ];

    console.log(`[RESPOND] Generating response from ${character}...`);

    // Call GPT-4o-mini to generate character response
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast, efficient model
      messages: messages,
      max_tokens: 150, // Keep responses short (for voice)
      temperature: 0.7, // Slightly creative but consistent
    });

    const assistantMessage = response.choices[0].message.content;
    console.log(`[RESPOND] Response: "${assistantMessage}"`);

    // Store this exchange in chat history (without the system prompt)
    chatHistories[character].push({ role: 'user', content: userMessage });
    chatHistories[character].push({ role: 'assistant', content: assistantMessage });

    res.json({ response: assistantMessage, character });
  } catch (error) {
    console.error('[RESPOND] Error:', error.message);
    res.status(500).json({ error: 'Response generation failed', details: error.message });
  }
});

// ============================================
// API ROUTE 3: /api/tts
// ============================================
// Purpose: Convert character response text to speech audio
// Input: Text to speak + character name
// Output: Base64 encoded audio (MP3)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, character } = req.body;

    console.log('[TTS] Converting to speech for', character);

    if (!text || !character) {
      return res.status(400).json({ error: 'Missing text or character' });
    }

    if (!characters[character]) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    // Map characters to OpenAI TTS voice options
    const voiceMap = {
      joey: 'onyx', // Joey gets a friendly, upbeat voice
      dwight: 'echo', // Dwight gets a deep, serious voice
      dhruv: 'fable' // Dhruv gets a clear, articulate voice
    };

    const voice = voiceMap[character];

    // Call OpenAI TTS API to generate speech
    console.log(`[TTS] Creating audio with voice: ${voice}`);
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      speed: 1.0
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Convert to base64 for sending to frontend
    const base64Audio = buffer.toString('base64');

    console.log('[TTS] Audio generated, size:', base64Audio.length);

    // Send base64 audio to frontend
    res.json({ audio: base64Audio, character });
  } catch (error) {
    console.error('[TTS] Error:', error.message);
    res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
  }
});

// ============================================
// API ROUTE 4: /api/characters
// ============================================
// Purpose: Get list of all available characters
app.get('/api/characters', (req, res) => {
  const charList = Object.keys(characters).map(key => ({
    id: key,
    name: characters[key].name,
    source: characters[key].source,
    greeting: characters[key].greeting
  }));
  res.json(charList);
});

// ============================================
// API ROUTE 5: /api/clear-history
// ============================================
// Purpose: Clear chat history for a specific character
app.post('/api/clear-history', (req, res) => {
  const character = req.body.character;

  if (!characters[character]) {
    return res.status(400).json({ error: 'Invalid character' });
  }

  chatHistories[character] = [];
  res.json({ message: `Chat history for ${characters[character].name} cleared` });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   VOICE CHATBOT SERVER RUNNING           ║
║   http://localhost:${PORT}                 ║
╚══════════════════════════════════════════╝
Available characters:
${Object.keys(characters).map(key => `  • ${characters[key].name} (${characters[key].source})`).join('\n')}

Endpoints:
  POST /api/transcribe  - Convert audio to text
  POST /api/respond     - Generate character response
  POST /api/tts         - Convert text to speech
  GET  /api/characters  - List all characters
  POST /api/clear-history - Clear chat history
  `);
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});