let mediaRecorder;
let audioChunks = [];

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "startTranscription") {
        console.log("Starting transcription...");
        startRecording(request.tabId, request.tabUrl);
    } else if (request.action === "stopTranscription") {
        console.log("Stopping transcription...");
        stopRecording();
    } else if (request.action === "saveTranscription") {
        console.log("Saving transcription...");
        saveCurrentTranscription();
    }
});

function startRecording(tabId, tabUrl) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        console.log("Audio stream captured.");
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = []; // Reset the chunks array at the start

        mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = function () {
            console.log("Recording stopped, sending data...");
            const completeBlob = new Blob(audioChunks, { type: 'audio/webm' });
            sendAudioData(completeBlob);
            audioChunks = []; // Clear the chunks array after sending
        };

        mediaRecorder.start(1000); // Record in chunks of 1 second
        console.log("MediaRecorder started.");
    }).catch(error => {
        console.error("Error capturing audio stream:", error);
    });
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop(); // This triggers the 'onstop' event
    }
}

function saveCurrentTranscription() {
    if (mediaRecorder && audioChunks.length > 0) {
        mediaRecorder.stop(); // This will trigger the 'onstop' event and send data
        // mediaRecorder will be restarted if needed after data is sent
    }
}

function sendAudioData(blob, saveOnly = false) {
    const reader = new FileReader();
    reader.onloadend = function () {
        const base64data = reader.result.split(',')[1];
        const endpoint = saveOnly ? 'save_transcription' : 'transcribe';
        fetch(`http://127.0.0.1:5000/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: base64data
        }).then(response => response.json()).then(data => {
            console.log("Transcription result:", data);
            if (saveOnly) {
                console.log("Transcription saved successfully.");
                // Optionally restart recording if needed
                startRecording(); // Call this only if continuous recording is required
            }
        }).catch(error => {
            console.error("Error sending audio data:", error);
        });
    };
    reader.readAsDataURL(blob);
}
