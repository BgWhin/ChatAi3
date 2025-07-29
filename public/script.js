// public/script.js (Final & Lengkap dengan Polling Status Unduhan)

document.addEventListener('DOMContentLoaded', () => {
    marked.setOptions({ highlight: (code, lang) => hljs.highlight(lang || 'plaintext', code).value, breaks: true });
    let isGenerating = false;
    let selectedFile = null;
    let pollingInterval = null; // Variabel untuk interval polling
    const TOKEN_KEY = 'gemini_chat_token', USERNAME_KEY = 'gemini_chat_username';

    const authContainer = document.getElementById('auth-container'), chatAppContainer = document.getElementById('chat-app'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), chatContainer = document.getElementById('chat-container'), promptInput = document.getElementById('prompt'), submitBtn = document.getElementById('submit-btn'), settingsBtn = document.getElementById('settings-btn'), settingsModal = document.getElementById('settings-modal'), closeSettingsBtn = document.getElementById('close-settings-btn'), clearHistoryBtn = document.getElementById('clear-history-btn'), modalLogoutBtn = document.getElementById('modal-logout-btn'), attachFileBtn = document.getElementById('attach-file-btn'), fileInput = document.getElementById('file-input'), imagePreviewContainer = document.getElementById('image-preview-container'), imagePreview = document.getElementById('image-preview'), removeImageBtn = document.getElementById('remove-image-btn');

    const startPollingForNewMessages = () => {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(async () => {
            if (isGenerating) return;
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) { clearInterval(pollingInterval); return; }
            await loadChatHistory();
        }, 5000);
    };

    const stopPolling = () => {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = null;
    };

    const showChatView = async () => {
        authContainer.classList.add('hidden');
        chatAppContainer.classList.remove('hidden');
        document.getElementById('username-display').textContent = `Login sebagai ${localStorage.getItem(USERNAME_KEY)}`;
        promptInput.focus();
        await loadChatHistory();
        startPollingForNewMessages();
    };

    const showAuthView = () => {
        authContainer.classList.remove('hidden');
        chatAppContainer.classList.add('hidden');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        chatContainer.innerHTML = '';
        stopPolling();
    };

    const handleAuth = async (endpoint, body, errorDiv) => { try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan'); return data; } catch (error) { errorDiv.textContent = error.message; return null; } };
    loginForm.addEventListener('submit', async e => { e.preventDefault(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; const errorDiv = document.getElementById('login-error'); errorDiv.textContent = ''; const data = await handleAuth('/api/auth/login', { username, password }, errorDiv); if (data) { localStorage.setItem(TOKEN_KEY, data.token); localStorage.setItem(USERNAME_KEY, data.username); showToast(`Selamat datang kembali, ${data.username}!`); showChatView(); } });
    registerForm.addEventListener('submit', async e => { e.preventDefault(); const username = document.getElementById('register-username').value; const password = document.getElementById('register-password').value; const errorDiv = document.getElementById('register-error'); errorDiv.textContent = ''; const data = await handleAuth('/api/auth/register', { username, password }, errorDiv); if (data) { showToast('Pendaftaran berhasil! Silakan login.'); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); loginForm.reset(); } });
    const handleLogout = () => { if (confirm("Apakah Anda yakin ingin logout?")) { showAuthView(); showToast("Anda telah berhasil logout."); } };
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });
    modalLogoutBtn.addEventListener('click', handleLogout);
    clearHistoryBtn.addEventListener('click', async () => { if (confirm("PERINGATAN: Aksi ini tidak dapat diurungkan.\nApakah Anda yakin ingin menghapus seluruh riwayat obrolan secara permanen?")) { const token = localStorage.getItem(TOKEN_KEY); try { const response = await fetch('/api/chathistory', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error('Gagal menghapus riwayat.'); chatContainer.innerHTML = ''; appendMessage("Halo! Saya Gemini. Ada yang bisa saya bantu?", 'model'); showToast("Riwayat obrolan berhasil dihapus."); settingsModal.classList.add('hidden'); } catch (error) { showToast(error.message); } } });
    
    attachFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { selectedFile = file; const reader = new FileReader(); reader.onload = (event) => { imagePreview.src = event.target.result; imagePreviewContainer.classList.remove('hidden'); }; reader.readAsDataURL(file); } });
    removeImageBtn.addEventListener('click', () => { selectedFile = null; fileInput.value = ''; imagePreviewContainer.classList.add('hidden'); });
    const toggleStopButton = (show) => { if (show) { submitBtn.innerHTML = '<i class="fas fa-stop"></i>'; submitBtn.style.backgroundColor = '#dc2626'; submitBtn.onclick = () => { if(currentAbortController) currentAbortController.abort(); }; } else { submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; submitBtn.style.backgroundColor = '#4f46e5'; submitBtn.onclick = generateContent; } };
    
    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem(TOKEN_KEY);
        try {
            showToast('Mengunggah gambar...');
            const response = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (!response.ok) throw new Error('Gagal mengunggah file.');
            const data = await response.json();
            showToast('Unggah berhasil!');
            return data.imageUrl;
        } catch (error) { showToast(`Error: ${error.message}`); return null; }
    }

    function pollDownloadStatus(taskId, originalMessageDiv) {
        const intervalId = setInterval(async () => {
            try {
                const token = localStorage.getItem(TOKEN_KEY);
                const response = await fetch(`/api/download-status/${taskId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (response.status === 404) return;
                if (!response.ok) throw new Error('Gagal memeriksa status.');
                const data = await response.json();
                if (data.status === 'complete') {
                    clearInterval(intervalId);
                    const successMsg = `Video **${data.title}** (${data.quality}) Anda siap! \n\nTautan unduhan: ${data.downloadLink}`;
                    originalMessageDiv.innerHTML = marked.parse(successMsg).replace(/\n/g, '<br>').replace(/\/downloads\/[a-f0-9-]+\.(mp4|mp3)/g, (url) => {
                        return `<a href="${url}" class="download-video-btn" download><i class="fas fa-download"></i> Download File</a>`;
                    });
                } else if (data.status === 'error') {
                    clearInterval(intervalId);
                    originalMessageDiv.innerHTML = marked.parse(`Maaf, terjadi kesalahan saat mengunduh. **Error:** ${data.message}`);
                }
            } catch (error) {
                console.error("Polling error:", error);
                clearInterval(intervalId);
            }
        }, 3000);
    }

    const appendMessage = (content, role, imageUrl = null) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
        let htmlContent = role === 'model' ? marked.parse(content) : content.replace(/</g, "<").replace(/>/g, ">");
        if (imageUrl) { htmlContent += `<br><img src="${imageUrl}" alt="Gambar Terlampir" class="message-image">`; }
        const downloadLinkRegex = /\/downloads\/[a-f0-9-]+\.(mp4|mp3|webm|mkv)/g;
        htmlContent = htmlContent.replace(downloadLinkRegex, (url) => `<a href="${url}" class="download-video-btn" download><i class="fas fa-download"></i> Download File</a>`);
        messageDiv.innerHTML = htmlContent;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };
    
    const loadChatHistory = async () => {
        const currentMessageCount = chatContainer.children.length;
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        try {
            const res = await fetch('/api/chathistory', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) { showToast("Sesi berakhir."); showAuthView(); return; }
            const history = await res.json();
            if (history.length !== currentMessageCount) {
                chatContainer.innerHTML = '';
                if (history.length > 0) {
                    history.forEach(msg => {
                        const text = msg.parts[0].text;
                        const urlRegex = /\[Gambar Terlampir: (https?:\/\/[^\s]+)\]/;
                        const match = text.match(urlRegex);
                        if (match) {
                            const plainText = text.replace(urlRegex, '').trim();
                            appendMessage(plainText, msg.role, match[1]);
                        } else {
                            appendMessage(text, msg.role);
                        }
                    });
                } else {
                    appendMessage("Halo! Saya Gemini. Ada yang bisa saya bantu?", 'model');
                }
            }
        } catch (error) { console.error("Gagal memuat riwayat obrolan:", error); }
    };
    
    const generateContent = async () => {
        const prompt = promptInput.value.trim();
        const token = localStorage.getItem(TOKEN_KEY);
        if (!prompt && !selectedFile) return;
        if (isGenerating) return;
        isGenerating = true;
        promptInput.disabled = true;
        submitBtn.disabled = true;

        let imageUrl = null;
        if (selectedFile) {
            const uploadedUrl = await uploadFile(selectedFile);
            if (!uploadedUrl) {
                isGenerating = false; promptInput.disabled = false; submitBtn.disabled = false; return;
            }
            imageUrl = uploadedUrl;
        }
        
        appendMessage(prompt, 'user', imageUrl);
        const typingIndicator = showTypingIndicator();
        promptInput.value = '';
        removeImageBtn.click();
        promptInput.style.height = 'auto';

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ prompt, imageUrl }),
            });
            removeTypingIndicator(typingIndicator);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Gagal mendapat respons'); }
            const data = await response.json();
            appendMessage(data.response, 'model');

            if (data.taskId) {
                const allMessages = document.querySelectorAll('.message');
                const lastMessageDiv = allMessages[allMessages.length - 1];
                pollDownloadStatus(data.taskId, lastMessageDiv);
            }
        } catch (error) {
            removeTypingIndicator(typingIndicator);
            appendMessage(`Error: ${error.message}`, 'model');
        } finally {
            isGenerating = false;
            promptInput.disabled = false;
            submitBtn.disabled = false;
        }
    };
    
    submitBtn.addEventListener('click', generateContent);
    promptInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateContent(); promptInput.style.height = 'auto'; } });
    promptInput.addEventListener('input', () => { promptInput.style.height = 'auto'; promptInput.style.height = `${promptInput.scrollHeight}px`; });

    const showToast = (message) => { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); };
    const showTypingIndicator = () => { const typingDiv = document.createElement('div'); typingDiv.className = 'typing-indicator'; typingDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`; chatContainer.appendChild(typingDiv); chatContainer.scrollTop = chatContainer.scrollHeight; return typingDiv; };
    const removeTypingIndicator = (indicator) => { if (indicator && indicator.parentElement) { indicator.remove(); } };
    
    const initializeApp = () => { const token = localStorage.getItem(TOKEN_KEY); if (token) { showChatView(); } else { showAuthView(); } };
    initializeApp();
});