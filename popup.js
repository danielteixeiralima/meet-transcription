// popup.js

let mediaRecorder = null; // Initialize MediaRecorder
let audioChunks = []; // Array to store audio chunks
let audioContext = null; // AudioContext variable
let microphoneStream = null; // Microphone stream
let tabStream = null; // Tab audio stream

document.getElementById('startBtn').addEventListener('click', () => {
    console.log('Iniciando transcrição'); // Log start
    document.getElementById('startBtn').disabled = true; // Disable start button
    document.getElementById('stopBtn').disabled = false; // Enable stop button

    startRecording();
});

document.getElementById('stopBtn').addEventListener('click', () => {
    console.log('Parando gravação'); // Log stop
    document.getElementById('stopBtn').disabled = true; // Disable stop button
    document.getElementById('startBtn').disabled = false; // Enable start button

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); // Stop recording
    }
});

async function startRecording() {
    console.log('Iniciando gravação'); // Log start

    try {
        // Capture microphone audio
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Stream do microfone capturada:', microphoneStream);

        // Capture tab audio directly in popup.js
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
            if (chrome.runtime.lastError || !stream) {
                console.error('Erro ao capturar áudio da guia:', chrome.runtime.lastError); // Log error
                document.getElementById('startBtn').disabled = false; // Re-enable start button
                document.getElementById('stopBtn').disabled = true; // Disable stop button
                return;
            }

            tabStream = stream;
            console.log('Stream da guia capturada:', tabStream);

            // Create AudioContext
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create source nodes for each stream
            const source1 = audioContext.createMediaStreamSource(microphoneStream);
            const source2 = audioContext.createMediaStreamSource(tabStream);

            // Create a destination node to mix the streams
            const destination = audioContext.createMediaStreamDestination();

            // Connect sources to destination
            source1.connect(destination);
            source2.connect(destination);

            // Create MediaRecorder from the combined stream
            mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' });

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data); // Add audio data to array
                    console.log('Chunk de áudio disponível:', event.data); // Log chunk
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('Gravação parada'); // Log stop
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Create Blob from audio data
                console.log('Blob de áudio criado:', audioBlob); // Log Blob

                try {
                    // Decode Blob to AudioBuffer
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    console.log('AudioBuffer decodificado:', audioBuffer); // Log AudioBuffer

                    // Encode AudioBuffer to WAV
                    const wavBuffer = encodeWAV(audioBuffer);
                    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
                    const url = URL.createObjectURL(wavBlob); // Create URL for Blob
                    console.log('URL do WAV criado:', url); // Log URL

                    // Initiate download of WAV file
                    chrome.downloads.download({
                        url: url,
                        filename: 'meet-transcription/audios/captura_audio.wav',
                        saveAs: false
                    }, (downloadId) => {
                        if (downloadId) {
                            console.log('Download iniciado com ID:', downloadId); // Log download
                        } else {
                            console.error('Falha ao iniciar o download'); // Log download failure
                        }
                    });
                } catch (error) {
                    console.error('Erro ao processar o áudio:', error); // Log processing error
                }

                audioChunks = []; // Reset chunks array
                audioContext.close(); // Close AudioContext

                // Stop tracks of the streams
                microphoneStream.getTracks().forEach(track => track.stop());
                tabStream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(); // Start recording
            console.log('Gravação iniciada'); // Log recording started
        });
    } catch (error) {
        console.error('Erro ao capturar o áudio do microfone:', error); // Log error
        document.getElementById('startBtn').disabled = false; // Re-enable start button
        document.getElementById('stopBtn').disabled = true; // Disable stop button
    }
}

// Function to encode AudioBuffer to WAV
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

    // Write PCM samples
    let offset = 44;
    let interleaved;

    if (numOfChan === 2) {
        interleaved = interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1));
    } else {
        interleaved = audioBuffer.getChannelData(0);
    }

    for (let i = 0; i < interleaved.length; i++, offset += 2) {
        let sample = interleaved[i];
        // Clamp the sample
        sample = Math.max(-1, Math.min(1, sample));
        // Scale to 16-bit integer
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
    }

    return buffer;
}

function interleave(inputL, inputR) {
    let length = inputL.length + inputR.length;
    let result = new Float32Array(length);

    let index = 0,
        inputIndex = 0;

    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

// Function to write strings into DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
