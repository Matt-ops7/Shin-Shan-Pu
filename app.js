/**
 * Shin-Shan Pu - Asistente Conversacional
 * Versión reescrita para mayor estabilidad y claridad.
 */

// -----------------------------------------------------------------------------
// 1. CONSTANTES Y ESTADO DE LA APLICACIÓN
// -----------------------------------------------------------------------------

// Se elimina la API Key del código del cliente.
// Todas las peticiones se dirigirán a nuestro proxy seguro en /api/proxy.
const PROXY_URL = "/api/proxy";

const appState = {
    isLiveMode: false,
    isProcessing: false,
    recognition: null,
    userSubtitle: "Di algo...",
    aiSubtitle: "¡Hola! Estoy lista para conversar. Activa el LIVE.",
};

// -----------------------------------------------------------------------------
// 2. SELECTORES DE ELEMENTOS DEL DOM
// -----------------------------------------------------------------------------

const dom = {
    chatHistory: document.getElementById('chatHistory'),
    liveSubtitles: document.getElementById('liveSubtitles'),
    userSubtitleText: document.getElementById('userSubtitleText'),
    aiSubtitleText: document.getElementById('aiSubtitleText'),
    chatInput: document.getElementById('chatInput'),
    sendButton: document.getElementById('sendButton'),
    liveToggleBtn: document.getElementById('liveToggleBtn'),
    sphereContainer: document.getElementById('sphereContainer'),
    liveSphere: document.getElementById('liveSphere'),
};

// -----------------------------------------------------------------------------
// 3. FUNCIONES DE UTILIDAD (Markdown, Audio)
// -----------------------------------------------------------------------------

function markdownToHtml(text) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/^\s*[\*\-]\s(.*)/gm, '<li>$1</li>');

    if (html.includes('<li>')) {
        html = `<ul>${html.replace(/<\/li><li>/g, '</li>\n<li>')}</ul>`;
    }
    return html.replace(/\n/g, '<br>');
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWavBlob(pcmData, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcmData.byteLength);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.byteLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.byteLength, true);

    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    return new Blob([view], { type: 'audio/wav' });
}

// -----------------------------------------------------------------------------
// 4. LÓGICA DE LA INTERFAZ DE USUARIO (UI)
// -----------------------------------------------------------------------------

function setProcessing(isProcessing) {
    appState.isProcessing = isProcessing;
    dom.chatInput.disabled = isProcessing;
    dom.sendButton.disabled = isProcessing;
    dom.liveToggleBtn.disabled = isProcessing || dom.liveToggleBtn.dataset.unavailable === 'true';
}

function setSphereState(state) {
    if (state === 'hidden') {
        dom.sphereContainer.classList.add('hidden');
        return;
    }
    dom.sphereContainer.classList.remove('hidden');
    dom.liveSphere.className = 'live-sphere'; // Reset
    if (state) dom.liveSphere.classList.add(state);
}

function updateLiveModeUI() {
    const isLive = appState.isLiveMode;
    dom.chatHistory.classList.toggle('hidden', isLive);
    dom.liveSubtitles.classList.toggle('hidden', !isLive);

    const micIcon = dom.liveToggleBtn.querySelector('svg');
    dom.liveToggleBtn.classList.toggle('bg-gemini-accent', isLive);
    dom.liveToggleBtn.classList.toggle('hover:bg-purple-700', isLive);
    dom.liveToggleBtn.classList.toggle('bg-gray-600', !isLive);
    dom.liveToggleBtn.classList.toggle('hover:bg-gray-500', !isLive);
    micIcon.classList.toggle('text-white', isLive);
    micIcon.classList.toggle('text-gray-300', !isLive);

    if (isLive) {
        setSphereState('idle');
    } else {
        setSphereState('hidden');
    }
}

function renderWelcomeMessage() {
    dom.chatHistory.innerHTML = `
        <div class="flex justify-center mb-10">
            <div class="ai-bubble text-gray-200 rounded-xl max-w-lg px-6 py-4 shadow-xl text-center">
                <p class="text-xl font-bold mb-2">Hola, soy Shin-Shan Pu. ¿En qué puedo ayudarte hoy?</p>
                <p class="text-sm text-gray-400">Asistente de tecnología de la UTCD. Escribe o usa el modo LIVE para comenzar.</p>
            </div>
        </div>
        <div id="suggestion-container" class="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            <button data-suggestion="¿Qué es la arquitectura de microservicios?" class="suggestion-button text-sm font-semibold text-white py-2 px-4 rounded-full bg-gemini-card hover:bg-gray-700 whitespace-nowrap">¿Qué es la arquitectura de microservicios?</button>
            <button data-suggestion="Explícame la diferencia entre SQL y NoSQL." class="suggestion-button text-sm font-semibold text-white py-2 px-4 rounded-full bg-gemini-card hover:bg-gray-700 whitespace-nowrap">Explícame la diferencia entre SQL y NoSQL.</button>
            <button data-suggestion="Necesito ayuda con un concepto de análisis de sistemas." class="suggestion-button text-sm font-semibold text-white py-2 px-4 rounded-full bg-gemini-card hover:bg-gray-700 whitespace-nowrap">Necesito ayuda con un concepto de análisis de sistemas.</button>
            <button data-suggestion="Dime las últimas tendencias en IA." class="suggestion-button text-sm font-semibold text-white py-2 px-4 rounded-full bg-gemini-card hover:bg-gray-700 whitespace-nowrap">Dime las últimas tendencias en IA.</button>
        </div>
    `;
}

function appendMessage(role, text) {
    // Si es el primer mensaje, limpiar la bienvenida
    if (dom.chatHistory.querySelector('#suggestion-container')) {
        dom.chatHistory.innerHTML = '';
    }

    const isUser = role === 'user';
    const messageEl = document.createElement('div');
    messageEl.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`;
    messageEl.innerHTML = `
        <div class="max-w-3xl px-4 py-3 rounded-xl shadow-md ${isUser ? 'user-bubble' : 'ai-bubble'} markdown-content">
            ${markdownToHtml(text)}
        </div>
    `;
    dom.chatHistory.appendChild(messageEl);
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
    return messageEl;
}

function showThinkingIndicator() {
    const indicator = appendMessage('model', '...');
    indicator.querySelector('.markdown-content').innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
            <div class="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style="animation-delay: 0.2s;"></div>
            <div class="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style="animation-delay: 0.4s;"></div>
        </div>
    `;
    return indicator;
}

// -----------------------------------------------------------------------------
// 5. LÓGICA DE COMUNICACIÓN CON LA API
// -----------------------------------------------------------------------------

async function fetchTextResponse(text, systemPrompt) {
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No he podido procesar esa respuesta.";
}

async function fetchAudioResponse(text) {
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "input": { "text": text },
            "voice": { "languageCode": "es-US", "name": "es-US-Studio-B" },
            "audioConfig": { "audioEncoding": "LINEAR16", "sampleRateHertz": 24000 }
        })
    });
    if (!response.ok) throw new Error(`TTS API Error: ${response.statusText}`);
    const result = await response.json();
    return result.audioContent; // Base64 encoded audio
}

// -----------------------------------------------------------------------------
// 6. LÓGICA PRINCIPAL DEL CHAT (TEXTO Y VOZ)
// -----------------------------------------------------------------------------

async function handleTextMessage() {
    const userText = dom.chatInput.value.trim();
    if (!userText || appState.isProcessing) return;

    dom.chatInput.value = '';
    setProcessing(true);

    appendMessage('user', userText);
    const thinkingIndicator = showThinkingIndicator();

    try {
        const systemPrompt = "Eres un experto en tecnología y análisis de sistemas, capaz de generar respuestas detalladas usando Markdown (listas, negritas, cursivas). Mantén un tono profesional y educativo.";
        const aiText = await fetchTextResponse(userText, systemPrompt);
        thinkingIndicator.remove();
        appendMessage('model', aiText);
    } catch (error) {
        console.error("Error en la conversación:", error);
        thinkingIndicator.remove();
        appendMessage('model', `[ERROR] Lo siento, hubo un problema de comunicación: ${error.message}`);
    } finally {
        setProcessing(false);
    }
}

async function handleLiveResponse(userText) {
    setProcessing(true);
    dom.userSubtitleText.textContent = userText;
    dom.aiSubtitleText.textContent = "Pensando...";
    setSphereState('active');

    try {
        const systemPrompt = "Eres Shin-Shan Pu, un asistente de IA amigable y conciso. Responde como si estuvieras en una conversación de voz.";
        const aiText = await fetchTextResponse(userText, systemPrompt);
        dom.aiSubtitleText.textContent = `[Generando voz] ${aiText}`;

        const audioBase64 = await fetchAudioResponse(aiText);
        if (!audioBase64) throw new Error("La respuesta de audio estaba vacía.");

        dom.aiSubtitleText.textContent = aiText;
        const pcmData = base64ToArrayBuffer(audioBase64);
        const wavBlob = pcmToWavBlob(pcmData, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setProcessing(false);
            startSpeechRecognition(); // Reiniciar escucha
        };
        audio.play();

    } catch (error) {
        console.error("Error en modo LIVE:", error);
        dom.aiSubtitleText.textContent = `[ERROR] ${error.message}`;
        setProcessing(false);
        setTimeout(startSpeechRecognition, 2000); // Intentar reiniciar tras un error
    }
}

// -----------------------------------------------------------------------------
// 7. LÓGICA DE RECONOCIMIENTO DE VOZ (STT)
// -----------------------------------------------------------------------------

function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        throw new Error("Speech Recognition no es soportado por este navegador.");
    }

    appState.recognition = new SpeechRecognition();
    const rec = appState.recognition;
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
        dom.userSubtitleText.textContent = "🎙️ Escuchando...";
        setSphereState('active');
    };

    rec.onend = () => {
        setSphereState('idle');
        // Si el modo LIVE está activo y no estamos procesando una respuesta, reiniciar.
        if (appState.isLiveMode && !appState.isProcessing) {
            setTimeout(startSpeechRecognition, 300);
        }
    };

    rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleLiveResponse(transcript);
    };

    rec.onerror = (event) => {
        console.error('Error de Speech Recognition:', event.error);
        dom.userSubtitleText.textContent = `[Error de voz: ${event.error}]`;
    };
}

function startSpeechRecognition() {
    if (appState.recognition && appState.isLiveMode && !appState.isProcessing) {
        try {
            appState.recognition.start();
        } catch (e) {
            // Suele pasar si ya está iniciado, es seguro ignorarlo.
            console.warn("STT no se pudo iniciar (posiblemente ya activo).", e.message);
        }
    }
}

function stopSpeechRecognition() {
    if (appState.recognition) {
        appState.recognition.stop();
    }
}

// -----------------------------------------------------------------------------
// 8. MANEJADORES DE EVENTOS E INICIALIZACIÓN
// -----------------------------------------------------------------------------

function toggleLiveMode() {
    if (appState.isProcessing) return;
    appState.isLiveMode = !appState.isLiveMode;

    updateLiveModeUI();

    if (appState.isLiveMode) {
        startSpeechRecognition();
    } else {
        stopSpeechRecognition();
    }
}

function handleSuggestionClick(event) {
    if (event.target.matches('.suggestion-button')) {
        const suggestionText = event.target.dataset.suggestion;
        if (suggestionText) {
            dom.chatInput.value = suggestionText;
            handleTextMessage();
        }
    }
}

function initializeApp() {
    // Configurar manejadores de eventos principales
    dom.sendButton.addEventListener('click', handleTextMessage);
    dom.chatInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleTextMessage();
    });
    dom.liveToggleBtn.addEventListener('click', toggleLiveMode);
    dom.chatHistory.addEventListener('click', handleSuggestionClick);

    // Intentar inicializar el reconocimiento de voz de forma segura
    try {
        initializeSpeechRecognition();
    } catch (error) {
        console.error("Fallo al inicializar Speech Recognition:", error);
        console.warn("El modo LIVE no estará disponible. Causa común: la página no se sirve sobre HTTPS o localhost.");
        dom.liveToggleBtn.disabled = true;
        dom.liveToggleBtn.dataset.unavailable = 'true';
        dom.liveToggleBtn.classList.add('opacity-50', 'cursor-not-allowed');
        dom.liveToggleBtn.title = "Modo LIVE no disponible (contexto no seguro o navegador no compatible)";
    }

    // Renderizar el estado inicial de la UI
    renderWelcomeMessage();
}

// Iniciar la aplicación cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', initializeApp);