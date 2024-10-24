// popup.js

let mediaRecorder = null; // Inicializa a variável do MediaRecorder
let audioChunks = []; // Array para armazenar os chunks de áudio

document.getElementById('startBtn').addEventListener('click', () => {
    console.log('Iniciando transcrição'); // Log de início
    document.getElementById('startBtn').disabled = true; // Desabilita o botão iniciar
    document.getElementById('stopBtn').disabled = false; // Habilita o botão parar

    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => { // Captura o áudio da guia
        if (chrome.runtime.lastError || !stream) {
            console.error('Erro ao capturar áudio:', chrome.runtime.lastError); // Log de erro
            document.getElementById('startBtn').disabled = false; // Reabilita o botão iniciar
            document.getElementById('stopBtn').disabled = true; // Desabilita o botão parar
            return;
        }

        console.log('Stream capturado:', stream); // Log do stream capturado
        const audioTracks = stream.getAudioTracks();
        console.log('Número de tracks de áudio:', audioTracks.length); // Log do número de tracks de áudio

        if (audioTracks.length === 0) {
            console.error('Nenhuma track de áudio encontrada no stream.'); // Log se não houver tracks de áudio
            document.getElementById('startBtn').disabled = false; // Reabilita o botão iniciar
            document.getElementById('stopBtn').disabled = true; // Desabilita o botão parar
            return;
        }

        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); // Cria uma nova instância de MediaRecorder com MIME type suportado
        } catch (e) {
            console.error('MediaRecorder não suportado:', e); // Log de erro se MediaRecorder não for suportado
            document.getElementById('startBtn').disabled = false; // Reabilita o botão iniciar
            document.getElementById('stopBtn').disabled = true; // Desabilita o botão parar
            return;
        }

        mediaRecorder.start(); // Inicia a gravação
        console.log('Gravação iniciada'); // Log de gravação iniciada

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

                // Inicia o download do arquivo WAV na pasta especificada dentro da pasta de downloads padrão
                chrome.downloads.download({
                    url: url,
                    filename: 'meet-transcription/audios/captura_audio.wav', // Define o caminho relativo do arquivo
                    saveAs: false
                }, (downloadId) => {
                    if (downloadId) {
                        console.log('Download iniciado com ID:', downloadId); // Log do download
                    } else {
                        console.error('Falha ao iniciar o download'); // Log de falha no download
                    }
                });
            } catch (error) {
                console.error('Erro ao processar o áudio:', error); // Log de erro no processamento
            }

            audioChunks = []; // Reseta o array de chunks
        };
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    console.log('Parando transcrição'); // Log de parada
    document.getElementById('stopBtn').disabled = true; // Desabilita o botão parar
    document.getElementById('startBtn').disabled = false; // Reabilita o botão iniciar

    if (mediaRecorder) {
        mediaRecorder.stop(); // Para a gravação
        mediaRecorder = null; // Reseta o MediaRecorder
    }
});

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

    // Write the PCM samples
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            let sample = audioBuffer.getChannelData(channel)[i];
            // Clamp the sample
            sample = Math.max(-1, Math.min(1, sample));
            // Scale to 16-bit integer
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
