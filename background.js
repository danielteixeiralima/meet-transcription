chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "startTranscription") {
        console.log("Starting transcription...");
        startRecording(request.tabId, request.tabUrl);
    }
});

function startRecording(tabId, tabUrl) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        console.log("Audio stream captured.");
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
                console.log("Audio data available, sending to server...");
                sendAudioData(event.data);
            } else {
                console.error("No audio data captured.");
            }
        };

        mediaRecorder.start(1000); // Record in chunks of 1 second
        console.log("MediaRecorder started.");
    }).catch(error => {
        console.error("Error capturing audio stream:", error);
    });
}

function sendAudioData(blob) {
    const reader = new FileReader();
    reader.onloadend = function () {
        const base64data = reader.result.split(',')[1];
        fetch('http://127.0.0.1:5000/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: base64data
        }).then(response => response.json()).then(data => {
            console.log("Transcription result:", data);
        }).catch(error => {
            console.error("Error sending audio data:", error);
        });
    };
    reader.readAsDataURL(blob);
}
