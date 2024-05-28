from flask import Flask, request, jsonify
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
import soundfile as sf
import subprocess
import base64
from pyannote.audio import Pipeline
import logging
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

processor = Wav2Vec2Processor.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")
model = Wav2Vec2ForCTC.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")

def load_diarization_pipeline():
    try:
        return Pipeline.from_pretrained("pyannote/speaker-diarization", use_auth_token='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')
    except Exception as e:
        logging.error(f"Failed to load diarization pipeline: {e}")
        return None

diarization_pipeline = load_diarization_pipeline()

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    audio_data = request.data
    if not audio_data:
        logging.error("No audio data received")
        return jsonify({'error': 'No audio data received'}), 400

    try:
        audio_bytes = base64.b64decode(audio_data)
        temp_webm_path = "temp_audio.webm"
        temp_wav_path = "temp_audio.wav"
        with open(temp_webm_path, "wb") as f:
            f.write(audio_bytes)
        subprocess.run(['ffmpeg', '-y', '-i', temp_webm_path, '-ar', '16000', '-ac', '1', temp_wav_path], check=True)
        logging.info("Conversion to WAV completed.")

        if not os.path.exists(temp_wav_path):
            logging.error("WAV file not created.")
            return jsonify({'error': 'WAV file not created'}), 500

        speech, sample_rate = sf.read(temp_wav_path)
        logging.info("WAV file loaded.")

        if diarization_pipeline:
            diarization = diarization_pipeline({'uri': 'temp_audio', 'audio': temp_wav_path})
            results = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                start, end = turn
                if end > start:  # Ensure positive duration
                    segment_audio = speech[int(start * sample_rate):int(end * sample_rate)]
                    input_values = processor(segment_audio, return_tensors="pt", sampling_rate=sample_rate).input_values
                    logits = model(input_values).logits
                    predicted_ids = torch.argmax(logits, dim=-1)
                    transcription = processor.batch_decode(predicted_ids)[0]
                    results.append({'speaker': speaker, 'start': start, 'end': end, 'transcription': transcription})
                else:
                    logging.warning(f"Skipped segment from {start} to {end} due to non-positive duration.")

            return jsonify(results), 200
        else:
            logging.error("Diarization pipeline not available")
            return jsonify({'error': 'Diarization pipeline not available'}), 500
    except Exception as e:
        logging.error(f"Error processing audio data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/save_transcription', methods=['POST'])
def save_transcription():
    audio_data = request.data
    if not audio_data:
        logging.error("No audio data received")
        return jsonify({'error': 'No audio data received'}), 400

    try:
        audio_bytes = base64.b64decode(audio_data)
        temp_webm_path = "temp_audio.webm"
        temp_wav_path = "temp_audio.wav"
        with open(temp_webm_path, "wb") as f:
            f.write(audio_bytes)
        subprocess.run(['ffmpeg', '-y', '-i', temp_webm_path, '-ar', '16000', '-ac', '1', temp_wav_path], check=True)
        speech, sample_rate = sf.read(temp_wav_path)
        transcription = ""

        if diarization_pipeline:
            diarization = diarization_pipeline({'uri': 'temp_audio', 'audio': temp_wav_path})
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                start, end = turn
                if end > start:
                    segment_audio = speech[int(start * sample_rate):int(end * sample_rate)]
                    input_values = processor(segment_audio, return_tensors="pt", sampling_rate=sample_rate).input_values
                    logits = model(input_values).logits
                    predicted_ids = torch.argmax(logits, dim=-1)
                    segment_transcription = processor.batch_decode(predicted_ids)[0]
                    transcription += f"Speaker {speaker}: {segment_transcription}\n"

            directory = './transcriptions'
            if not os.path.exists(directory):
                os.makedirs(directory)
            with open(os.path.join(directory, 'complete_transcription.txt'), 'w') as file:
                file.write(transcription)
            return jsonify({'status': 'success', 'message': 'Transcription saved successfully'}), 200
        else:
            return jsonify({'error': 'Diarization pipeline not available'}), 500
    except Exception as e:
        logging.error(f"Error processing audio data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
