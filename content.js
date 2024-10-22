window.addEventListener('load', function() {
    let mediaRecorder;
    let audioChunks = [];

    // Função para exibir a transcrição na página
    function displayTranscription(transcription) {
        let transcriptionDiv = document.getElementById('transcription');
        if (!transcriptionDiv) {
            transcriptionDiv = document.createElement('div');
            transcriptionDiv.id = 'transcription';
            transcriptionDiv.style.position = 'fixed';
            transcriptionDiv.style.bottom = '10px';
            transcriptionDiv.style.right = '10px';
            transcriptionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            transcriptionDiv.style.color = 'white';
            transcriptionDiv.style.padding = '10px';
            transcriptionDiv.style.zIndex = '1000';
            transcriptionDiv.style.maxWidth = '300px';
            transcriptionDiv.style.overflow = 'auto';
            transcriptionDiv.style.height = '150px';
            document.body.appendChild(transcriptionDiv);
            console.log("Div de transcrição criada.");
        } else {
            console.log("Div de transcrição já existe.");
        }

        console.log("Exibindo transcrição: ", transcription);
        transcriptionDiv.innerHTML += transcription + '<br>';
    }

    // Função para enviar o áudio para o servidor de transcrição
    function transcribeAudio(blob) {
        if (!blob.size) {
            console.error("Nenhum áudio capturado.");
            return;
        }
        console.log("Enviando áudio para transcrição...");
        fetch('http://127.0.0.1:5000/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'audio/webm'
            },
            body: blob
        })
        .then(response => {
            console.log("Resposta recebida do servidor: ", response);
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error('Erro no servidor:', data.error);
            } else {
                console.log("Dados recebidos:", data);
                if (data.length === 0) {
                    console.warn("Nenhuma transcrição retornada.");
                } else {
                    console.log("Transcrições recebidas:", data);
                }
                data.forEach(entry => displayTranscription(`${entry.speaker}: ${entry.transcription}`));
            }
        })
        .catch(error => console.error('Erro ao buscar transcrição:', error));
    }

    // Capturando áudio da página
    function captureAudio() {
        console.log("Iniciando a tentativa de acesso ao microfone...");
        navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            console.log("Acesso ao microfone garantido com sucesso.", stream);
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
                console.log("Gravando áudio...");
            };

            mediaRecorder.onstop = e => {
                console.log("Gravação de áudio parada.");
                const completeBlob = new Blob(audioChunks, { type: 'audio/webm' });
                transcribeAudio(completeBlob);
                audioChunks = [];
            };

            mediaRecorder.start();
            console.log("MediaRecorder iniciou a captura de áudio.");
        })
        .catch(error => {
            console.error("Erro ao acessar dispositivos de mídia.", error);
        });
    }

    // Iniciar ou parar a captura de áudio conforme a mensagem recebida
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Mensagem recebida no content.js:", message);

        if (message.action === 'startTranscription') {
            console.log("Transcrição iniciada...");
            captureAudio();
            sendResponse({ status: 'Audio capture started' });
        } else if (message.action === 'stopTranscription') {
            console.log("Transcrição parada...");
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                console.log("MediaRecorder parando a gravação.");
            }
            sendResponse({ status: 'Audio capture stopped' });
        }
    });

    console.log("Content script carregado e pronto.");
});
