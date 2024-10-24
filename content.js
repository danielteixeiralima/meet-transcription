// // content.js

// // Função para detectar quando a reunião é encerrada
// function detectMeetingEnd() {
//     let meetingOngoing = false;

//     // Função para verificar se o botão de sair está presente
//     function checkLeaveButton() {
//         const leaveButton = document.querySelector('[aria-label="Sair da reunião"]') ||
//                             document.querySelector('[aria-label="Leave call"]');
//         return !!leaveButton;
//     }

//     // Inicialmente, espera até que o botão de sair esteja presente
//     const checkMeetingInterval = setInterval(() => {
//         if (checkLeaveButton()) {
//             meetingOngoing = true;
//             console.log('Reunião em andamento detectada pelo content script.');
//             clearInterval(checkMeetingInterval);
//             // Inicia a observação após detectar o início da reunião
//             observer.observe(document.body, { childList: true, subtree: true });
//         }
//     }, 1000); // Verifica a cada 1 segundo

//     // Cria um MutationObserver para observar mudanças no DOM
//     const observer = new MutationObserver((mutations, obs) => {
//         const currentlyPresent = checkLeaveButton();

//         if (meetingOngoing && !currentlyPresent) {
//             // Reunião foi encerrada
//             console.log('Reunião encerrada detectada pelo content script.');
//             chrome.runtime.sendMessage({action: 'stopRecording'});
//             obs.disconnect();
//         }

//         // Atualiza o estado da reunião
//         meetingOngoing = currentlyPresent;
//     });

//     // Inicia a observação no body
//     if (document.body) {
//         // A observação é iniciada após detectar que a reunião está em andamento
//     }
// }

// // Detecta quando a página é carregada completamente
// window.addEventListener('load', () => {
//     detectMeetingEnd();
// });
