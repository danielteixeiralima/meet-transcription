document.addEventListener('DOMContentLoaded', function () {
    console.log("Popup script loaded"); // Verifique se isso aparece

    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
  
    startButton.addEventListener('click', () => {
        // Enviando mensagem para background.js para começar a transcrição
        chrome.runtime.sendMessage({ action: 'startTranscription' }, (response) => {
            console.log("Start transcription button clicked", response); // Verifique se aparece
        });
    });
  
    stopButton.addEventListener('click', () => {
        // Enviando mensagem para background.js para parar a transcrição
        chrome.runtime.sendMessage({ action: 'stopTranscription' }, (response) => {
            console.log("Stop transcription button clicked", response); // Verifique se aparece
        });
    });

    console.log("Popup script loaded and event listeners attached");
});
