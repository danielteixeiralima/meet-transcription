# server.py

# Importar as Bibliotecas
import torch
import whisperx
from flask import Flask, request, render_template
import os

# Configurar o Token do Hugging Face
# Substitua 'SEU_TOKEN_AQUI' pelo seu token real
HUGGINGFACE_TOKEN = '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'

# Verificar se o token foi fornecido
if not HUGGINGFACE_TOKEN:
    raise ValueError("Por favor, forneça o token do Hugging Face em HUGGINGFACE_TOKEN.")

# Configurar o Dispositivo
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Usando dispositivo: {device}")

# Inicializar o aplicativo Flask
app = Flask(__name__)

# Carregar o Modelo Whisper
model = whisperx.load_model("medium", device, compute_type="float32")

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        # Verificar se o arquivo foi enviado na requisição
        if 'file' not in request.files:
            return 'Nenhum arquivo enviado.'
        file = request.files['file']
        if file.filename == '':
            return 'Nenhum arquivo selecionado.'
        if file:
            # Salvar o arquivo no servidor
            audio_file = os.path.join('uploads', file.filename)
            file.save(audio_file)
            print(f"Arquivo recebido: {audio_file}")

            try:
                # Transcrever o Áudio
                result = model.transcribe(audio_file)

                # Carregar o Modelo de Alinhamento e Metadados
                model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)

                # Alinhar a Transcrição com Timestamps Precisos
                result_aligned = whisperx.align(result["segments"], model_a, metadata, audio_file, device)

                # Executar a Diarização de Falantes
                diarize_pipeline = whisperx.DiarizationPipeline(
                    use_auth_token=HUGGINGFACE_TOKEN,
                    device=device
                )
                diarization_result = diarize_pipeline(audio_file)

                # Combinar a Transcrição com a Diarização
                result_aligned = whisperx.assign_word_speakers(diarization_result, result_aligned)

                # Preparar o Resultado Final
                transcription = ''
                for segment in result_aligned["segments"]:
                    speaker = segment.get('speaker', 'Desconhecido')
                    start_time = segment.get('start', 0)
                    end_time = segment.get('end', 0)
                    text = segment.get('text', '')
                    transcription += f"[{start_time:.2f}s - {end_time:.2f}s] Falante {speaker}: {text}\n"

                # Retornar a transcrição na resposta
                return render_template('result.html', transcription=transcription)

            except Exception as e:
                # Capturar qualquer exceção e retornar uma mensagem de erro
                print(f"Erro ao processar o áudio: {e}")
                return f"Ocorreu um erro ao processar o áudio: {e}"

    return render_template('upload.html')

if __name__ == '__main__':
    # Criar a pasta de uploads se não existir
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    app.run(host='0.0.0.0', port=5000)
