# # app.py

# from flask import Flask, request, jsonify, Response
# import torch
# from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
# import soundfile as sf
# import subprocess
# import base64
# from pyannote.audio import Pipeline
# import logging
# from flask_cors import CORS
# import os
# import tempfile

# app = Flask(__name__)
# CORS(app, resources={r"/transcribe": {"origins": "*"}})  # Ajustar conforme necessário para produção

# logging.basicConfig(level=logging.INFO)

# processor = Wav2Vec2Processor.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")
# model = Wav2Vec2ForCTC.from_pretrained("jonatasgrosman/wav2vec2-large-xlsr-53-portuguese")


# def load_diarization_pipeline():
#     try:
#         return Pipeline.from_pretrained("pyannote/speaker-diarization",
#                                         use_auth_token='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')
#     except Exception as e:
#         logging.error(f"Failed to load diarization pipeline: {e}")
#         return None


# diarization_pipeline = load_diarization_pipeline()


# @app.route('/transcribe', methods=['POST'])
# def transcribe_audio():
#     content_type = request.headers.get('Content-Type', '')
#     if 'audio/webm' not in content_type:
#         logging.warning(f"Tipo de conteúdo inválido: {content_type}")
#         return jsonify({'error': 'Invalid content type'}), 415

#     audio_data = request.data
#     if not audio_data:
#         logging.warning("Nenhum dado de áudio recebido.")
#         return jsonify({'error': 'No audio data received'}), 400

#     # Verificar se FFmpeg está instalado
#     try:
#         subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
#         logging.info("FFmpeg está instalado e acessível.")
#     except subprocess.CalledProcessError:
#         logging.error("FFmpeg não está instalado ou não está acessível no PATH.")
#         return jsonify({'error': 'FFmpeg not installed or not accessible'}), 500
#     except FileNotFoundError:
#         logging.error("FFmpeg não encontrado. Certifique-se de que está instalado.")
#         return jsonify({'error': 'FFmpeg not installed'}), 500

#     try:
#         with tempfile.TemporaryDirectory() as temp_dir:
#             temp_webm_path = os.path.join(temp_dir, "temp_audio.webm")
#             temp_wav_path = os.path.join(temp_dir, "temp_audio.wav")
#             saved_wav_dir = 'saved_audios'
#             saved_wav_path = os.path.join(saved_wav_dir, 'meeting_audio.wav')

#             # Salvar o arquivo WebM temporariamente
#             with open(temp_webm_path, "wb") as f:
#                 f.write(audio_data)
#             logging.info(f"Arquivo WebM salvo temporariamente em {temp_webm_path}.")

#             # Converter WebM para WAV usando FFmpeg
#             try:
#                 result = subprocess.run(
#                     ['ffmpeg', '-y', '-i', temp_webm_path, '-ar', '16000', '-ac', '1', temp_wav_path],
#                     check=True,
#                     stdout=subprocess.PIPE,
#                     stderr=subprocess.PIPE
#                 )
#                 logging.info("Conversão de WebM para WAV realizada com sucesso.")
#             except subprocess.CalledProcessError as e:
#                 ffmpeg_error = e.stderr.decode('utf-8')
#                 logging.error(f"Erro no FFmpeg: {ffmpeg_error}")
#                 return jsonify({'error': 'Failed to convert audio to WAV format.', 'details': ffmpeg_error}), 500

#             # Garantir que o diretório de salvamento exista
#             os.makedirs(saved_wav_dir, exist_ok=True)

#             # Mover o arquivo WAV convertido para o diretório permanente
#             os.rename(temp_wav_path, saved_wav_path)
#             logging.info(f"Arquivo WAV salvo permanentemente em {saved_wav_path}.")

#             # Ler o arquivo WAV
#             try:
#                 speech, sample_rate = sf.read(saved_wav_path)
#                 logging.info(f"Arquivo WAV lido com sample rate: {sample_rate}.")
#             except Exception as e:
#                 logging.error(f"Erro ao ler o arquivo WAV: {e}")
#                 return jsonify({'error': 'Failed to read WAV file.', 'details': str(e)}), 500

#             # Processamento de diarização e transcrição
#             if diarization_pipeline:
#                 try:
#                     diarization = diarization_pipeline({'uri': 'temp_audio', 'audio': saved_wav_path})
#                     results = []
#                     for turn, _, speaker in diarization.itertracks(yield_label=True):
#                         start, end = turn
#                         if end > start:
#                             segment_audio = speech[int(start * sample_rate):int(end * sample_rate)]
#                             input_values = processor(segment_audio, return_tensors="pt", sampling_rate=sample_rate).input_values
#                             logits = model(input_values).logits
#                             predicted_ids = torch.argmax(logits, dim=-1)
#                             transcription = processor.batch_decode(predicted_ids)[0]
#                             results.append({
#                                 'speaker': speaker,
#                                 'start': start,
#                                 'end': end,
#                                 'transcription': transcription
#                             })
#                     logging.info("Transcrição realizada com sucesso.")
#                     return jsonify(results), 200
#                 except Exception as e:
#                     logging.error(f"Erro durante a diarização/transcrição: {e}", exc_info=True)
#                     return jsonify({'error': 'Error during diarization/transcription.', 'details': str(e)}), 500
#             else:
#                 logging.error("Diarization pipeline não está disponível.")
#                 return jsonify({'error': 'Diarization pipeline not available'}), 500

#     except Exception as e:
#         logging.error(f"Erro ao processar os dados de áudio: {e}", exc_info=True)
#         return jsonify({'error': str(e)}), 500


# @app.route('/save_transcription', methods=['POST'])
# def save_transcription():
#     content_type = request.headers.get('Content-Type', '')
#     if 'audio/webm' not in content_type:
#         logging.warning(f"Tipo de conteúdo inválido para salvar transcrição: {content_type}")
#         return jsonify({'error': 'Invalid content type'}), 415

#     audio_data = request.data
#     if not audio_data:
#         logging.warning("Nenhum dado de áudio recebido para salvar transcrição.")
#         return jsonify({'error': 'No audio data received'}), 400

#     # Verificar se FFmpeg está instalado
#     try:
#         subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
#         logging.info("FFmpeg está instalado e acessível para salvar transcrição.")
#     except subprocess.CalledProcessError:
#         logging.error("FFmpeg não está instalado ou não está acessível no PATH para salvar transcrição.")
#         return jsonify({'error': 'FFmpeg not installed or not accessible'}), 500
#     except FileNotFoundError:
#         logging.error("FFmpeg não encontrado para salvar transcrição. Certifique-se de que está instalado.")
#         return jsonify({'error': 'FFmpeg not installed'}), 500

#     try:
#         with tempfile.TemporaryDirectory() as temp_dir:
#             temp_webm_path = os.path.join(temp_dir, "temp_audio.webm")
#             temp_wav_path = os.path.join(temp_dir, "temp_audio.wav")
#             saved_wav_dir = 'saved_audios'
#             saved_wav_path = os.path.join(saved_wav_dir, 'meeting_audio.wav')

#             # Salvar o arquivo WebM temporariamente
#             with open(temp_webm_path, "wb") as f:
#                 f.write(audio_data)
#             logging.info("Arquivo WebM salvo temporariamente para salvar transcrição.")

#             # Converter WebM para WAV usando FFmpeg
#             try:
#                 result = subprocess.run(
#                     ['ffmpeg', '-y', '-i', temp_webm_path, '-ar', '16000', '-ac', '1', temp_wav_path],
#                     check=True,
#                     stdout=subprocess.PIPE,
#                     stderr=subprocess.PIPE
#                 )
#                 logging.info("Conversão de FFmpeg para WAV realizada com sucesso para salvar transcrição.")
#             except subprocess.CalledProcessError as e:
#                 ffmpeg_error = e.stderr.decode('utf-8')
#                 logging.error(f"Erro do FFmpeg ao salvar transcrição: {ffmpeg_error}")
#                 return jsonify({'error': 'Failed to convert audio to WAV format.', 'details': ffmpeg_error}), 500

#             # Garantir que o diretório de salvamento exista
#             os.makedirs(saved_wav_dir, exist_ok=True)

#             # Mover o arquivo WAV convertido para o diretório permanente
#             os.rename(temp_wav_path, saved_wav_path)
#             logging.info(f"Arquivo WAV salvo em {saved_wav_path} para salvar transcrição.")

#             # Ler o arquivo WAV
#             try:
#                 speech, sample_rate = sf.read(saved_wav_path)
#                 logging.info(f"Arquivo WAV lido com sample rate: {sample_rate} para salvar transcrição.")
#             except Exception as e:
#                 logging.error(f"Erro ao ler o arquivo WAV para transcrição: {e}")
#                 return jsonify({'error': 'Failed to read WAV file.', 'details': str(e)}), 500

#             transcription = ""
#             if diarization_pipeline:
#                 try:
#                     diarization = diarization_pipeline({'uri': 'temp_audio', 'audio': saved_wav_path})
#                     for turn, _, speaker in diarization.itertracks(yield_label=True):
#                         start, end = turn
#                         if end > start:
#                             segment_audio = speech[int(start * sample_rate):int(end * sample_rate)]
#                             input_values = processor(segment_audio, return_tensors="pt", sampling_rate=sample_rate).input_values
#                             logits = model(input_values).logits
#                             predicted_ids = torch.argmax(logits, dim=-1)
#                             segment_transcription = processor.batch_decode(predicted_ids)[0]
#                             transcription += f"Speaker {speaker}: {segment_transcription}\n"
#                     directory = './transcriptions'
#                     if not os.path.exists(directory):
#                         os.makedirs(directory)
#                     with open(os.path.join(directory, 'complete_transcription.txt'), 'w') as file:
#                         file.write(transcription)
#                     logging.info("Transcrição completa salva com sucesso.")
#                     return jsonify({'status': 'success', 'message': 'Transcription saved successfully'}), 200
#                 except Exception as e:
#                     logging.error(f"Erro durante a diarização/transcrição para salvar: {e}", exc_info=True)
#                     return jsonify({'error': 'Error during diarization/transcription.', 'details': str(e)}), 500
#             else:
#                 logging.error("Diarization pipeline não está disponível para salvar transcrição.")
#                 return jsonify({'error': 'Diarization pipeline not available'}), 500

#     except Exception as e:
#         logging.error(f"Erro ao processar os dados de áudio para transcrição: {e}", exc_info=True)
#         return jsonify({'error': str(e)}), 500


# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5000, debug=True)
