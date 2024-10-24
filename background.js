// // background.js

// let mediaRecorder = null; // Inicializa a variável do MediaRecorder
// let audioChunks = []; // Array para armazenar os chunks de áudio
// let recording = false; // Estado da gravação
// let tabStream = null; // Armazena o stream da aba

// // Função para enviar notificações
// function sendNotification(title, message) {
//     chrome.notifications.create({
//         type: 'basic',
//         iconUrl: 'images/icon48.png', // Certifique-se de que este ícone existe na pasta images/
//         title: title,
//         message: message
//     });
// }

// // Função para iniciar a gravação
// async function startRecording(tabId) {
//     if (recording) {
//         console.log('Gravação já está em andamento.');
//         return;
//     }

//     try {
//         // Verifica se a API tabCapture está disponível
//         if (!chrome.tabCapture || !chrome.tabCapture.capture) {
//             throw new Error('chrome.tabCapture.capture não está disponível.');
//         }

//         // Captura o áudio da guia específica
//         tabStream = await new Promise((resolve, reject) => {
//             chrome.tabCapture.capture(
//                 { audio: true, video: false, targetTabId: tabId },
//                 (stream) => {
//                     if (chrome.runtime.lastError || !stream) {
//                         console.error('Erro ao capturar a guia:', chrome.runtime.lastError);
//                         reject(chrome.runtime.lastError || new Error('Falha ao capturar a guia'));
//                     } else {
//                         resolve(stream);
//                     }
//                 }
//             );
//         });

//         console.log('Stream da guia capturado:', tabStream);

//         // Inicializa o MediaRecorder com o stream capturado
//         mediaRecorder = new MediaRecorder(tabStream, { mimeType: 'audio/webm' });

//         mediaRecorder.start();
//         recording = true;
//         console.log('Gravação iniciada');
//         sendNotification('Gravação Iniciada', 'A gravação da reunião foi iniciada.');

//         mediaRecorder.ondataavailable = event => {
//             if (event.data.size > 0) {
//                 audioChunks.push(event.data);
//                 console.log('Chunk de áudio disponível:', event.data);
//             }
//         };

//         mediaRecorder.onstop = async () => {
//             console.log('Gravação parada');
//             sendNotification('Gravação Finalizada', 'A gravação da reunião foi finalizada e o áudio foi salvo.');
//             const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
//             console.log('Blob de áudio criado:', audioBlob);

//             try {
//                 // Cria uma URL para o Blob
//                 const url = URL.createObjectURL(audioBlob);
//                 console.log('URL do Blob criado:', url);

//                 // Inicia o download do arquivo webm na pasta especificada dentro da pasta de downloads padrão
//                 chrome.downloads.download({
//                     url: url,
//                     filename: 'meet-transcription/audios/captura_audio.webm', // Salvando como webm
//                     saveAs: true
//                 }, (downloadId) => {
//                     if (downloadId) {
//                         console.log('Download iniciado com ID:', downloadId);
//                     } else {
//                         console.error('Falha ao iniciar o download');
//                     }
//                 });
//             } catch (error) {
//                 console.error('Erro ao processar o áudio:', error);
//             }

//             audioChunks = [];
//             recording = false;
//         };
        
//         // Monitoramento do encerramento do stream
//         tabStream.getAudioTracks()[0].onended = () => {
//             console.log('Stream de áudio interrompido.');
//             if (recording) {
//                 stopRecording();
//             }
//         };
        
//     } catch (error) {
//         console.error('Erro ao iniciar a captura de áudio:', error);
//     }
// }

// // Função para parar a gravação
// function stopRecording() {
//     if (!recording) {
//         console.log('Não há gravação em andamento para parar.');
//         return;
//     }

//     if (mediaRecorder && mediaRecorder.state !== "inactive") {
//         try {
//             mediaRecorder.stop();
//         } catch (error) {
//             console.error('Erro ao parar o MediaRecorder:', error);
//         }
//     }

//     // Verifica se o stream ainda está ativo antes de parar
//     if (tabStream && tabStream.active) {
//         let tracks = tabStream.getTracks();
//         tracks.forEach(track => track.stop()); // Para todas as trilhas de áudio
//     }

//     mediaRecorder = null;
//     tabStream = null;
//     recording = false;

//     console.log('Gravação finalizada e stream encerrada');
//     sendNotification('Gravação Finalizada', 'A gravação da reunião foi finalizada e o áudio foi salvo.');
// }

// // Escuta mensagens do content script
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === 'stopRecording') {
//         console.log('Mensagem recebida para parar a gravação.');
//         stopRecording();
//         sendResponse({ status: 'Recording stopped' });
//     }
//     return true;
// });

// // Função para verificar se a URL corresponde a uma reunião no Google Meet
// function isMeetingUrl(url) {
//     const meetingPattern = /^https?:\/\/meet\.google\.com\/.*/;
//     return meetingPattern.test(url);
// }

// // Função para iniciar a gravação quando a aba está pronta
// function handleTabUpdated(tabId, changeInfo, tab) {
//     if (changeInfo.status === 'complete' && tab.active && tab.url) {
//         if (isMeetingUrl(tab.url)) {
//             console.log('Reunião detectada na aba:', tab.url);
//             startRecording(tabId);
//         } else {
//             // Se a aba não corresponde a uma reunião, pare a gravação se estiver ativa
//             if (recording) {
//                 console.log('Reunião encerrada ou não detectada, parando a gravação.');
//                 stopRecording();
//             }
//         }
//     }
// }

// // Unificar os listeners do onUpdated
// chrome.tabs.onUpdated.addListener(handleTabUpdated);

// // Listener para quando a aba é ativada
// chrome.tabs.onActivated.addListener((activeInfo) => {
//     chrome.tabs.get(activeInfo.tabId, (tab) => {
//         if (chrome.runtime.lastError || !tab) {
//             console.error('Erro ao obter a aba ativa:', chrome.runtime.lastError);
//             return;
//         }

//         if (tab.url && isMeetingUrl(tab.url)) {
//             console.log('Aba ativada contém uma reunião:', tab.url);
//             startRecording(tab.id);
//         } else {
//             if (recording) {
//                 console.log('Aba ativada não contém uma reunião, parando a gravação.');
//                 stopRecording();
//             }
//         }
//     });
// });

// // Listener para quando a aba é removida
// chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
//     if (recording) {
//         console.log('Aba fechada, parando a gravação.');
//         stopRecording(); // Certifique-se de parar a gravação
//     }
// });

// // Listener para mudanças na URL da aba (navegação dentro da mesma aba)
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     if (changeInfo.status === 'complete' && changeInfo.url && recording) {
//         stopRecording(); // Para a gravação se a URL mudar e estiver gravando
//     }
// });
