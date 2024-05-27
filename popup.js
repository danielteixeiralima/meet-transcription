document.getElementById('start-button').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startTranscription' });
    console.log("Start transcription button clicked");
});

window.onload = function() {
    console.log("Popup script loaded");
};
