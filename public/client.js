// ============================================
// MULTI-CHARACTER VOICE CHATBOT - FRONTEND
// ============================================

// GLOBAL VARIABLES
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentCharacter = 'joey';

let chatHistories = {
  joey: [],
  dwight: [],
  dhruv: []
};

let audioPlayer = null;
let currentlyPlayingIndex = null;
let currentlyPlayingCharacter = null;

let recordBtn, stopBtn, clearBtn, statusBox, statusText, connectionStatus, chatHistory;

// Format timestamp
function formatTimestamp() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const day = now.getDate();
  const month = now.toLocaleString('default', { month: 'short' });
  return `${hours}:${minutes} • ${day} ${month}`;
}

// Show/hide status
function showStatus(message) {
  if (statusBox) {
    statusBox.classList.remove('hidden');
    statusText.textContent = message;
  }
}

function hideStatus() {
  if (statusBox) {
    statusBox.classList.add('hidden');
  }
}

// Select a character
function selectCharacter(characterName) {
  console.log(`👤 Selected character: ${characterName}`);
  currentCharacter = characterName;
  
  const buttons = document.querySelectorAll('.character-btn');
  buttons.forEach(btn => {
    if (btn.dataset.character === characterName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  loadCharacterHistory(characterName);
  updateCharacterDisplay(characterName);
  hideStatus();
}

// Load character's chat history
function loadCharacterHistory(character) {
  const history = chatHistories[character];
  chatHistory.innerHTML = '';
  
  if (history.length === 0) {
    chatHistory.innerHTML = '<p class="history-placeholder">Start speaking to see the conversation here...</p>';
    return;
  }
  
  console.log(`📜 Loading ${history.length} messages for ${character}`);
  
  history.forEach((item, index) => {
    const historyMsg = document.createElement('div');
    historyMsg.className = `history-message ${item.sender === 'user' ? 'user' : 'character'}`;
    
    // Create label for user messages
    if (item.sender === 'user') {
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = 'You';
      historyMsg.appendChild(label);
    }
    
    // Create message bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // Create message text
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = item.message;
    bubble.appendChild(textDiv);
    
    // Create play button for character messages with audio
    if (item.sender === 'character' && item.audio) {
      const playBtn = document.createElement('button');
      playBtn.className = 'play-button-inline';
      playBtn.id = `play-btn-${character}-${index}`;
      playBtn.textContent = '▶️';
      playBtn.onclick = () => playMessageAudio(character, index);
      bubble.appendChild(playBtn);
      console.log(`✅ Loaded play button for ${character} message ${index}`);
    }
    
    historyMsg.appendChild(bubble);
    
    // Create timestamp
    if (item.timestamp) {
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'message-timestamp';
      timestampDiv.textContent = item.timestamp;
      historyMsg.appendChild(timestampDiv);
    }
    
    chatHistory.appendChild(historyMsg);
  });
  
  updatePlayButtonStates();
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Update play button states
function updatePlayButtonStates() {
  const buttons = document.querySelectorAll('.play-button-inline');
  
  buttons.forEach(btn => {
    const btnId = btn.id;
    
    if (currentlyPlayingIndex !== null && currentlyPlayingCharacter !== null) {
      const currentId = `play-btn-${currentlyPlayingCharacter}-${currentlyPlayingIndex}`;
      
      if (btnId === currentId) {
        btn.textContent = '⏸️';
      } else {
        btn.textContent = '▶️';
      }
    } else {
      btn.textContent = '▶️';
    }
  });
}

// Play audio from message
function playMessageAudio(character, messageIndex) {
  console.log(`🎵 Playing ${character} message ${messageIndex}`);
  
  if (!audioPlayer) {
    alert('Audio player not available. Refresh the page.');
    return;
  }
  
  const history = chatHistories[character];
  if (!history || messageIndex >= history.length) {
    console.error('Invalid message index');
    return;
  }
  
  const message = history[messageIndex];
  if (!message.audio) {
    alert('No audio available for this message.');
    return;
  }
  
  // Toggle pause if already playing this message
  if (currentlyPlayingIndex === messageIndex && currentlyPlayingCharacter === character && !audioPlayer.paused) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    currentlyPlayingIndex = null;
    currentlyPlayingCharacter = null;
    updatePlayButtonStates();
    console.log('⏸️ Paused audio');
    return;
  }
  
  try {
    const audioData = new Uint8Array(
      atob(message.audio).split('').map(c => c.charCodeAt(0))
    );
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentlyPlayingIndex = messageIndex;
    currentlyPlayingCharacter = character;
    
    audioPlayer.src = audioUrl;
    audioPlayer.play()
      .then(() => {
        console.log('✅ Playing audio');
        updatePlayButtonStates();
      })
      .catch(err => {
        console.error('❌ Playback blocked:', err);
        alert('Click the ▶️ button again to play (browser blocked first attempt)');
        currentlyPlayingIndex = null;
        currentlyPlayingCharacter = null;
        updatePlayButtonStates();
      });
    
    audioPlayer.onended = () => {
      console.log('✅ Audio finished');
      currentlyPlayingIndex = null;
      currentlyPlayingCharacter = null;
      updatePlayButtonStates();
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error playing audio');
  }
}

// Update character display
function updateCharacterDisplay(character) {
  const info = {
    joey: { name: 'Joey Tribbiani', source: 'From F.R.I.E.N.D.S' },
    dwight: { name: 'Dwight K. Schrute', source: 'From The Office' },
    dhruv: { name: 'Dhruv Rathee', source: 'YouTuber / Social Commentator' }
  };
  
  document.getElementById('characterName').textContent = info[character].name;
  document.getElementById('characterSource').textContent = info[character].source;
}

// Add message to history
function addToHistory(sender, message, audio = null) {
  console.log(`📥 addToHistory called - Sender: ${sender}, Audio: ${audio ? 'YES' : 'NO'}`);
  
  const timestamp = formatTimestamp();
  
  const historyItem = { 
    sender, 
    message,
    audio,
    timestamp
  };
  
  chatHistories[currentCharacter].push(historyItem);
  const messageIndex = chatHistories[currentCharacter].length - 1;
  
  console.log(`💾 Added to history: ${currentCharacter} index ${messageIndex}`);
  if (audio) {
    console.log(`🎵 Audio stored for message ${messageIndex}`);
  }
  
  // Remove placeholder
  const placeholder = chatHistory.querySelector('.history-placeholder');
  if (placeholder) placeholder.remove();
  
  // Create message element
  const historyMsg = document.createElement('div');
  historyMsg.className = `history-message ${sender === 'user' ? 'user' : 'character'}`;
  
  // Create label for user messages
  if (sender === 'user') {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = 'You';
    historyMsg.appendChild(label);
  }
  
  // Create message bubble
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  // Create message text
  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = message;
  bubble.appendChild(textDiv);
  
  // Create play button for character messages with audio
  if (sender === 'character' && audio) {
    console.log(`🎯 CREATING BUTTON NOW...`);
    const playBtn = document.createElement('button');
    playBtn.className = 'play-button-inline';
    playBtn.id = `play-btn-${currentCharacter}-${messageIndex}`;
    playBtn.textContent = '▶️';
    playBtn.onclick = () => playMessageAudio(currentCharacter, messageIndex);
    bubble.appendChild(playBtn);
    console.log(`✅ Play button CREATED for ${currentCharacter} message ${messageIndex}`);
  }
  
  historyMsg.appendChild(bubble);
  
  // Create timestamp
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'message-timestamp';
  timestampDiv.textContent = timestamp;
  historyMsg.appendChild(timestampDiv);
  
  // Add to chat history
  chatHistory.appendChild(historyMsg);
  
  updatePlayButtonStates();
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  console.log(`✅ Message rendered in DOM`);
}

// Clear chat
function clearChat() {
  if (confirm('Clear chat history for this character?')) {
    chatHistories[currentCharacter] = [];
    chatHistory.innerHTML = '<p class="history-placeholder">Start speaking to see the conversation here...</p>';
    hideStatus();
    
    if (currentlyPlayingCharacter === currentCharacter && audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      currentlyPlayingIndex = null;
      currentlyPlayingCharacter = null;
    }
    
    console.log(`🗑️ Cleared chat for ${currentCharacter}`);
  }
}

// Request microphone
async function requestMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = handleRecordingStop;
    console.log('✅ Microphone access granted');
    return true;
  } catch (error) {
    console.error('❌ Microphone denied:', error);
    alert('Please allow microphone access');
    return false;
  }
}

// Start recording
async function startRecording() {
  if (!mediaRecorder) {
    const allowed = await requestMicrophone();
    if (!allowed) return;
  }
  
  audioChunks = [];
  mediaRecorder.start();
  
  recordBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  showStatus('🎙️ Recording... speak now');
  
  console.log('🔴 Recording started');
}

// Stop recording
function stopRecording() {
  mediaRecorder.stop();
  stopBtn.classList.add('hidden');
  recordBtn.classList.remove('hidden');
  showStatus('⏳ Processing...');
  
  console.log('⏹️ Recording stopped');
}

// Handle recording stop
async function handleRecordingStop() {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  await sendToServer(formData);
}

// Send to server
async function sendToServer(formData) {
  try {
    // Step 1: Transcribe
    showStatus('📝 Transcribing...');
    const transcribeRes = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });
    
    if (!transcribeRes.ok) throw new Error('Transcription failed');
    
    const { transcription } = await transcribeRes.json();
    console.log('✅ Transcript:', transcription);
    
    addToHistory('user', transcription);
    
    // Step 2: Get response
    showStatus(`🤔 ${currentCharacter} is thinking...`);
    const respondRes = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userMessage: transcription, 
        character: currentCharacter 
      })
    });
    
    if (!respondRes.ok) throw new Error('Response generation failed');
    
    const { response } = await respondRes.json();
    console.log('✅ Response:', response);
    
    // Step 3: Get audio
    showStatus('🎙️ Generating voice...');
    const ttsRes = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: response, 
        character: currentCharacter 
      })
    });
    
    if (!ttsRes.ok) throw new Error('TTS failed');
    
    const { audio } = await ttsRes.json();
    console.log('✅ Audio generated');
    
    // Add to history with audio - ✅ FIXED: Pass 'character' not currentCharacter
    addToHistory('character', response, audio);
    
    // Try autoplay
    try {
      const audioData = new Uint8Array(
        atob(audio).split('').map(c => c.charCodeAt(0))
      );
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const messageIndex = chatHistories[currentCharacter].length - 1;
      currentlyPlayingIndex = messageIndex;
      currentlyPlayingCharacter = currentCharacter;
      
      audioPlayer.src = audioUrl;
      audioPlayer.play()
        .then(() => {
          console.log('✅ Audio autoplaying');
          hideStatus();
          updatePlayButtonStates();
        })
        .catch(err => {
          console.warn('⚠️ Autoplay blocked:', err);
          hideStatus();
          currentlyPlayingIndex = null;
          currentlyPlayingCharacter = null;
        });
      
      audioPlayer.onended = () => {
        console.log('✅ Audio finished');
        currentlyPlayingIndex = null;
        currentlyPlayingCharacter = null;
        updatePlayButtonStates();
      };
    } catch (autoplayError) {
      console.error('❌ Autoplay error:', autoplayError);
      hideStatus();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    showStatus(`❌ Error: ${error.message}`);
    recordBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

// Setup event listeners
function setupEventListeners() {
  recordBtn = document.getElementById('recordBtn');
  stopBtn = document.getElementById('stopBtn');
  clearBtn = document.getElementById('clearBtn');
  statusBox = document.getElementById('statusBox');
  statusText = document.getElementById('statusText');
  connectionStatus = document.getElementById('connectionStatus');
  chatHistory = document.getElementById('chatHistory');
  
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
  clearBtn.addEventListener('click', clearChat);
  
  console.log('✅ Event listeners set up');
}

// Initialize on page load
window.addEventListener('load', async () => {
  try {
    audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer) {
      console.error('❌ Audio player element not found!');
      alert('Error: Audio player missing. Check HTML.');
      return;
    }
    console.log('✅ Audio player initialized');
    
    setupEventListeners();
    
    const response = await fetch('/health');
    const data = await response.json();
    console.log('✅ Connected to server:', data.status);
    connectionStatus.textContent = '● Connected to server';
    connectionStatus.style.color = '#27ae60';
    
    updateCharacterDisplay('joey');
    console.log('✅ Initialized with Joey');
    
  } catch (error) {
    console.error('❌ Cannot connect to server:', error);
    if (connectionStatus) {
      connectionStatus.textContent = '● Cannot connect to server';
      connectionStatus.style.color = '#e74c3c';
    }
    alert('❌ Server not running. Start with: npm start');
  }
});