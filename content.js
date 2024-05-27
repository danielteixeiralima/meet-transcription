// content.js - Transcription handling script for Google Meet or similar web applications
let isRecording = false;

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
    }
    transcriptionDiv.textContent += transcription + ' ';
}

function transcribeAudio(blob) {
    if (!blob.size) {
        console.error("No audio data captured.");
        isRecording = false;
        return;
    }
    const reader = new FileReader();
    reader.onloadend = function() {
        const base64data = reader.result.split(',')[1];
        fetch('http://127.0.0.1:5000/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: base64data
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch from server with status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error('Server error:', data.error);
            } else if (data.transcription) {
                displayTranscription(data.transcription);
            } else {
                console.error('Transcription failed without error message.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        })
        .finally(() => {
            isRecording = false; // Allow new recording
        });
    };
    reader.readAsDataURL(blob);
}

function setupMediaRecorder(stream) {
    const mediaRecorder = new MediaRecorder(stream);
    let chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = e => {
        const completeBlob = new Blob(chunks, { type: 'audio/webm' });
        transcribeAudio(completeBlob);
        chunks = [];
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 10000); // Collect 10 seconds of audio
}

function captureAudio() {
    if (isRecording) return;
    isRecording = true;

    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(setupMediaRecorder)
    .catch(error => {
        console.error('Error accessing media devices.', error);
        isRecording = false;
    });
}

setInterval(captureAudio, 15000); // Try capturing every 15 seconds
