from flask import Flask, request, jsonify
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
import soundfile as sf
import subprocess
import base64
from pyannote.audio import Pipeline
import logging
from flask_cors import CORS  # Import CORS

app = Flask(__name__)
CORS(app)  # Apply CORS to the app to handle cross-origin requests

# Configuring logging
logging.basicConfig(level=logging.INFO)

# Load transcription model and processor
processor = Wav2Vec2Processor.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")
model = Wav2Vec2ForCTC.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")

# Attempt to load diarization pipeline
try:
    diarization_pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization", use_auth_token='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')
    logging.info("Diarization pipeline loaded successfully.")
except Exception as e:
    diarization_pipeline = None
    logging.error(f"Failed to load diarization pipeline: {e}")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    audio_data = request.data
    if not audio_data:
        logging.error("No audio data received")
        return jsonify({'error': 'No audio data received'}), 400

    try:
        audio_bytes = base64.b64decode(audio_data)
        with open("temp_audio.webm", "wb") as f:
            f.write(audio_bytes)

        # Convert from webm to wav using ffmpeg with overwrite enabled
        command = ['ffmpeg', '-y', '-i', 'temp_audio.webm', '-ar', '16000', '-ac', '1', 'temp_audio.wav']
        subprocess.run(command, check=True)

        # Read the audio file
        speech, sample_rate = sf.read("temp_audio.wav")

        # Perform diarization if pipeline is loaded
        if diarization_pipeline:
            diarization = diarization_pipeline("temp_audio.wav")
            segments = [(segment.start, segment.end, segment.label) for segment in diarization.itersegments()]
        else:
            segments = None
            logging.warning("Diarization not performed due to pipeline loading failure.")

        # Transcription
        input_values = processor(speech, return_tensors="pt", sampling_rate=sample_rate).input_values
        logits = model(input_values).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.batch_decode(predicted_ids)[0]

        results = {
            'transcription': transcription,
            'segments': segments
        }

        return jsonify(results)
    except Exception as e:
        logging.error(f"Error processing audio data: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
