console.log("Background script loaded");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Mensagem recebida no background.js:", request);

    if (request.action === "startTranscription") {
        console.log("Forwarding start transcription request to content script...");
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            console.log("Resultado da consulta de tabs:", tabs);
            if (tabs.length === 0) {
                console.error("Nenhuma aba ativa encontrada.");
                sendResponse({ status: "No active tab found" });
                return;
            }
            if (tabs[0] && tabs[0].id) {
                console.log("Enviando mensagem ao content script para iniciar a transcrição. Tab ID:", tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startTranscription' }, response => {
                    console.log("Resposta recebida do content script:", response);
                    sendResponse(response);
                });
            } else {
                console.error("Tab ativa encontrada, mas sem um ID válido:", tabs[0]);
                sendResponse({ status: "Active tab found but no valid tab ID" });
            }
        });
        return true; // Indica que a resposta será enviada de forma assíncrona.
    } else if (request.action === "stopTranscription") {
        console.log("Forwarding stop transcription request to content script...");
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            console.log("Resultado da consulta de tabs para parar transcrição:", tabs);
            if (tabs[0] && tabs[0].id) {
                console.log("Enviando mensagem ao content script para parar a transcrição. Tab ID:", tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, { action: 'stopTranscription' }, response => {
                    console.log("Resposta recebida do content script:", response);
                    sendResponse(response);
                });
            } else {
                console.error("Nenhuma aba ativa encontrada ou tab ID inválido.");
                sendResponse({ status: "No active tab found or invalid tab ID" });
            }
        });
        return true; // Indica que a resposta será enviada de forma assíncrona.
    }
});
