// ============================================
// JOEY VOICE CHATBOT - FRONTEND (Browser)
// ============================================

// 1. GLOBAL VARIABLES
let mediaRecorder; // The object that records audio
let audioChunks = []; // Array to store audio pieces
let isRecording = false; // Track if we're currently recording

// 2. DOM ELEMENTS - Get references to HTML elements
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const audioPlayer = document.getElementById('audioPlayer');
const userMessageBox = document.getElementById('userMessageBox');
const joeyMessageBox = document.getElementById('joeyMessageBox');
const statusBox = document.getElementById('statusBox');
const userMessage = document.getElementById('userMessage');
const joeyMessage = document.getElementById('joeyMessage');
const statusText = document.getElementById('statusText');
const connectionStatus = document.getElementById('connectionStatus');
const chatHistory = document.getElementById('chatHistory');

// 2B. CHAT HISTORY ARRAY
let conversationHistory = [];

// 3. HELPER FUNCTION - Show status updates
function showStatus(message) {
  statusBox.classList.remove('hidden');
  statusText.textContent = message;
}

function hideStatus() {
  statusBox.classList.add('hidden');
}

// 3B. ADD MESSAGE TO HISTORY
function addToHistory(sender, message) {
  conversationHistory.push({ sender, message });
  
  // Create history message element
  const historyMsg = document.createElement('div');
  historyMsg.className = `history-message ${sender === 'user' ? 'user' : 'joey'}`;
  historyMsg.innerHTML = `
    <div class="label">${sender === 'user' ? 'YOU SAID:' : 'JOEY SAYS:'}</div>
    <div>${message}</div>
  `;
  
  // Add to history (remove placeholder if this is first message)
  if (conversationHistory.length === 1) {
    chatHistory.innerHTML = '';
  }
  
  chatHistory.appendChild(historyMsg);
  
  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 4. HELPER FUNCTION - Clear all messages
function clearChat() {
  userMessageBox.classList.add('hidden');
  joeyMessageBox.classList.add('hidden');
  hideStatus();
  audioPlayer.pause();
  audioPlayer.src = '';
  conversationHistory = [];
  chatHistory.innerHTML = '<p class="history-placeholder">Chat history will appear here...</p>';
}

// 5. REQUEST MICROPHONE PERMISSION
async function requestMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Initialize MediaRecorder with the audio stream
    mediaRecorder = new MediaRecorder(stream);
    
    // When audio data is available, store it
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    // When recording stops, process the audio
    mediaRecorder.onstop = handleRecordingStop;
    
    console.log('✅ Microphone access granted');
    return true;
  } catch (error) {
    console.error('❌ Microphone access denied:', error);
    alert('Please allow microphone access to use this app');
    return false;
  }
}

// 6. START RECORDING
async function startRecording() {
  // First time? Request microphone permission
  if (!mediaRecorder) {
    const allowed = await requestMicrophone();
    if (!allowed) return;
  }
  
  audioChunks = []; // Reset audio chunks
  mediaRecorder.start();
  isRecording = true;
  
  // Update UI
  recordBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  showStatus('🎙️ Recording... speak now');
  
  console.log('🔴 Recording started');
}

// 7. STOP RECORDING & PROCESS AUDIO
async function handleRecordingStop() {
  // Create a blob (binary data) from all audio chunks
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  
  // Compress using webp format (smaller file size)
  const canvas = document.createElement('canvas');
  const offscreen = canvas.getContext('2d');
  
  // Convert blob to base64 string for sending to server
  const reader = new FileReader();
  reader.onloadend = async () => {
    let base64Audio = reader.result.split(',')[1]; // Remove "data:audio/wav;base64," prefix
    
    // Limit audio to first 30 seconds to keep payload small
    console.log(`📊 Audio size: ${(base64Audio.length / 1024).toFixed(2)} KB`);
    
    if (base64Audio.length > 1000000) { // If larger than 1MB
      console.warn('⚠️ Audio file too large, trimming...');
      base64Audio = base64Audio.substring(0, 1000000);
    }
    
    await sendToServer(base64Audio);
  };
  reader.readAsDataURL(audioBlob);
}

function stopRecording() {
  mediaRecorder.stop();
  isRecording = false;
  
  // Update UI
  stopBtn.classList.add('hidden');
  recordBtn.classList.remove('hidden');
  showStatus('⏳ Processing audio...');
  
  console.log('⏹️ Recording stopped');
}

// 8. MAIN FUNCTION - Send audio to server & get response
async function sendToServer(base64Audio) {
  try {
    // Step 1: TRANSCRIBE - Send audio to /transcribe endpoint
    console.log('📤 Sending audio to server...');
    showStatus('📝 Transcribing...');
    
    const transcribeResponse = await fetch('http://localhost:3000/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64Audio })
    });
    
    if (!transcribeResponse.ok) {
      throw new Error('Transcription failed');
    }
    
    const transcribeData = await transcribeResponse.json();
    const transcript = transcribeData.transcript;
    
    console.log(`✅ Transcript: "${transcript}"`);
    
    // Add to history (don't show in current box to avoid duplication)
    addToHistory('user', transcript);
    
    // Step 2: GET RESPONSE - Send transcript to /respond endpoint
    console.log('🤖 Getting Joey response...');
    showStatus('🤔 Joey is thinking...');
    
    const respondResponse = await fetch('http://localhost:3000/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcript })
    });
    
    if (!respondResponse.ok) {
      throw new Error('Response generation failed');
    }
    
    const respondData = await respondResponse.json();
    const joeyResponse = respondData.response;
    
    console.log(`✅ Joey says: "${joeyResponse}"`);
    
    // Add to history
    addToHistory('joey', joeyResponse);
    
    // Also show in current box for immediate feedback
    joeyMessage.textContent = joeyResponse;
    joeyMessageBox.classList.remove('hidden');
    
    // Step 3: TEXT TO SPEECH - Convert response to audio
    console.log('🎤 Converting to speech...');
    showStatus('🎙️ Generating voice...');
    
    const ttsResponse = await fetch('http://localhost:3000/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: joeyResponse })
    });
    
    if (!ttsResponse.ok) {
      throw new Error('TTS failed');
    }
    
    const ttsData = await ttsResponse.json();
    const audioBase64 = ttsData.audio;
    
    console.log('✅ Audio generated');
    
    // Step 4: PLAY AUDIO
    const audioData = new Uint8Array(
      atob(audioBase64)
        .split('')
        .map(c => c.charCodeAt(0))
    );
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    audioPlayer.src = audioUrl;
    hideStatus();
    
    // Remove any old play buttons
    const oldButtons = joeyMessageBox.querySelectorAll('button');
    oldButtons.forEach(btn => btn.remove());
    
    // Show a play button for the user to click
    const playBtn = document.createElement('button');
    playBtn.textContent = '▶️ Play Joey\'s Voice';
    playBtn.className = 'btn btn-primary';
    playBtn.style.marginTop = '10px';
    playBtn.style.width = '100%';
    playBtn.onclick = () => {
      audioPlayer.play();
      playBtn.textContent = '⏸️ Playing...';
      audioPlayer.onended = () => {
        playBtn.textContent = '▶️ Play Joey\'s Voice';
      };
    };
    joeyMessageBox.appendChild(playBtn);
    
    console.log('▶️ Audio ready to play');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    showStatus(`❌ Error: ${error.message}`);
    recordBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

// 9. EVENT LISTENERS - Connect buttons to functions
recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
clearBtn.addEventListener('click', clearChat);

// 10. CHECK SERVER CONNECTION ON PAGE LOAD
window.addEventListener('load', async () => {
  try {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    console.log('✅ Connected to server:', data.status);
    connectionStatus.textContent = '● Connected to server';
    connectionStatus.style.color = '#27ae60';
  } catch (error) {
    console.error('❌ Cannot connect to server');
    connectionStatus.textContent = '● Cannot connect to server';
    connectionStatus.style.color = '#e74c3c';
    alert('❌ Cannot connect to server. Make sure "npm start" is running!');
  }
});