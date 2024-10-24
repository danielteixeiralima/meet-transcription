// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startTabCapture') {
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
            if (chrome.runtime.lastError || !stream) {
                console.error('Erro ao capturar áudio da guia:', chrome.runtime.lastError);
                sendResponse({ success: false });
                return;
            }

            // Envia o stream de áudio da guia de volta para o popup
            sendResponse({ success: true, stream: stream });
        });

        // Indica que a resposta será enviada de forma assíncrona
        return true;
    }
});
