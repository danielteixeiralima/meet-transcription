// offscreen.js

let mediaRecorder = null; // Inicializa a variável do MediaRecorder
let audioChunks = []; // Array para armazenar os chunks de áudio

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'offscreen-startRecording') {
        startRecording();
    } else if (message.action === 'offscreen-stopRecording') {
        stopRecording();
    }
});

async function startRecording() {
    console.log('Iniciando gravação no documento offscreen'); // Log de início

    try {
        // Captura o áudio do microfone
        const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Captura o áudio da guia
        chrome.tabCapture.capture({ audio: true, video: false }, (tabStream) => {
            if (chrome.runtime.lastError || !tabStream) {
                console.error('Erro ao capturar áudio da guia:', chrome.runtime.lastError); // Log de erro
                return;
            }

            console.log('Streams capturadas:', microphoneStream, tabStream); // Log das streams capturadas

            // Cria um AudioContext
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Cria nós de origem para cada stream
            const source1 = audioContext.createMediaStreamSource(microphoneStream);
            const source2 = audioContext.createMediaStreamSource(tabStream);

            // Cria um nó de destino para mixar os streams
            const destination = audioContext.createMediaStreamDestination();

            // Conecta as fontes ao destino
            source1.connect(destination);
            source2.connect(destination);

            // Cria um MediaRecorder a partir do stream combinado
            mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' });

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data); // Adiciona os dados de áudio ao array
                    console.log('Chunk de áudio disponível:', event.data); // Log do chunk disponível
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('Gravação parada'); // Log de gravação parada
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Cria um Blob com os dados de áudio
                console.log('Blob de áudio criado:', audioBlob); // Log do Blob criado

                try {
                    // Decodifica o Blob para AudioBuffer
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await decodeAudioData(arrayBuffer);
                    console.log('AudioBuffer decodificado:', audioBuffer); // Log do AudioBuffer

                    // Codifica o AudioBuffer para WAV
                    const wavBuffer = encodeWAV(audioBuffer);
                    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
                    const url = URL.createObjectURL(wavBlob); // Cria uma URL para o Blob
                    console.log('URL do WAV criado:', url); // Log da URL criada

                    // Envia mensagem ao service worker para iniciar o download
                    chrome.runtime.sendMessage({ action: 'download', url: url });
                } catch (error) {
                    console.error('Erro ao processar o áudio:', error); // Log de erro no processamento
                }

                audioChunks = []; // Reseta o array de chunks
                audioContext.close(); // Fecha o AudioContext
            };

            mediaRecorder.start(); // Inicia a gravação
            console.log('Gravação iniciada'); // Log de gravação iniciada
        });
    } catch (error) {
        console.error('Erro ao capturar o áudio do microfone:', error); // Log de erro
    }
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop(); // Para a gravação
        mediaRecorder = null; // Reseta o MediaRecorder
    }
}

// Função para decodificar ArrayBuffer para AudioBuffer
function decodeAudioData(arrayBuffer) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
}

// Função para codificar AudioBuffer para WAV
function encodeWAV(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels,
          sampleRate = audioBuffer.sampleRate,
          format = 1, // PCM
          bitDepth = 16;

    let length = audioBuffer.length * numOfChan * (bitDepth / 8) + 44;
    let buffer = new ArrayBuffer(length);
    let view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + audioBuffer.length * numOfChan * (bitDepth / 8), true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, audioBuffer.length * numOfChan * (bitDepth / 8), true);

    // Escreve os samples PCM
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            let sample = audioBuffer.getChannelData(channel)[i];
            // Limita o sample
            sample = Math.max(-1, Math.min(1, sample));
            // Escala para inteiro de 16 bits
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }

    return buffer;
}

// Função para escrever strings no DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
