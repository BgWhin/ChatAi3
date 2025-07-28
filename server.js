// server.js (Final dengan Perbaikan Unduhan Latar Belakang)

require('dotenv').config();
process.noDeprecation = true;

const express = require("express");
const path = require("path");
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid'); // Impor uuid di sini

// Impor SEMUA komponen dari file tool masing-masing
const { weatherTool, getWeatherDataWttrIn } = require('./public/cuaca.js');
const { searchTool, performWebSearchImplementation } = require('./public/search.js');
const { getFormatsTool, getYouTubeFormatsImplementation, downloadYouTubeFormatImplementation } = require('./public/video_downloader.js');

const authRoutes = require('./routes/auth.js');
const authMiddleware = require('./middleware/authMiddleware.js');
const ChatMessage = require('./models/ChatMessage.js');

// === PENYIMPANAN SESI SEMENTARA UNTUK DOWNLOAD ===
const userDownloadSessions = {};

// === GABUNGKAN SKEMA TOOL (TANPA TOOL DOWNLOAD LANGSUNG) ===
const tools = [
  { 
    functionDeclarations: [ 
      weatherTool, 
      searchTool, 
      getFormatsTool
    ] 
  }
];

// === KONFIGURASI & SETUP ===
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 }).then(() => console.log('Berhasil terhubung ke MongoDB Atlas!')).catch(err => { console.error('Koneksi ke MongoDB gagal.', err); process.exit(1); });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)){ fs.mkdirSync(downloadsDir, { recursive: true }); }

// === RUTE API ===
app.use('/api/auth', authRoutes);
app.get('/api/chathistory', authMiddleware, async (req, res) => { try { const messages = await ChatMessage.find({ userId: req.user.userId }).sort({ createdAt: 'asc' }); res.json(messages.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }))); } catch (error) { res.status(500).json({ error: "Gagal mengambil riwayat obrolan." }); } });
app.delete('/api/chathistory', authMiddleware, async (req, res) => { try { await ChatMessage.deleteMany({ userId: req.user.userId }); res.status(200).json({ message: 'Riwayat obrolan berhasil dihapus.' }); } catch (error) { res.status(500).json({ error: "Gagal menghapus riwayat obrolan." }); } });
app.get('/downloads/:filename', (req, res) => { const filePath = path.join(__dirname, 'downloads', req.params.filename); if (fs.existsSync(filePath)) { res.download(filePath, (err) => { if (err) console.error("Error mengirim file:", err); fs.unlink(filePath, (unlinkErr) => { if (unlinkErr) console.error(`Error menghapus file ${filePath}:`, unlinkErr); else console.log(`File ${filePath} dihapus setelah diunduh.`); }); }); } else { res.status(404).send("File tidak ditemukan atau sudah kedaluwarsa."); } });
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah.' }); try { const b64 = Buffer.from(req.file.buffer).toString("base64"); let dataURI = "data:" + req.file.mimetype + ";base64," + b64; const result = await cloudinary.uploader.upload(dataURI, { resource_type: "auto", folder: "chatai_uploads" }); res.status(200).json({ message: "File berhasil diunggah!", imageUrl: result.secure_url }); } catch (error) { res.status(500).json({ error: 'Gagal mengunggah file ke Cloudinary.' }); } });

app.post("/api/generate", authMiddleware, async (req, res) => {
    const { prompt, imageUrl } = req.body;
    const userId = req.user.userId;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Gemini API Key tidak dikonfigurasi." });

    if (prompt.startsWith('/dl ')) {
        await new ChatMessage({ userId, role: 'user', content: prompt }).save();
        const choiceIndex = parseInt(prompt.split(' ')[1], 10);
        const userSession = userDownloadSessions[userId];

        if (!userSession || !userSession.formats) {
            const msg = "Sesi unduhan Anda telah berakhir atau tidak ditemukan. Silakan kirim ulang URL video.";
            await new ChatMessage({ userId, role: 'model', content: msg }).save();
            return res.json({ response: msg });
        }

        const selectedFormat = userSession.formats.find(f => f.index === choiceIndex);
        if (!selectedFormat) {
            const msg = `Pilihan tidak valid. Silakan gunakan angka antara 1 dan ${userSession.formats.length}.`;
            await new ChatMessage({ userId, role: 'model', content: msg }).save();
            return res.json({ response: msg });
        }
        
        delete userDownloadSessions[userId];
        
        const processingMsg = `Baik, saya akan memproses format **${selectedFormat.quality}**. Mohon tunggu sebentar, proses ini bisa memakan waktu...`;
        await new ChatMessage({ userId, role: 'model', content: processingMsg }).save();
        res.json({ response: processingMsg });
        
        try {
            const uniqueId = uuidv4();
            const extension = (selectedFormat.quality === 'Audio Only') ? 'mp3' : 'mp4';
            const filename = `${userSession.title}.${extension}`;
            const outputPath = path.join(__dirname, 'downloads', filename);

            await downloadYouTubeFormatImplementation(userSession.url, selectedFormat.formatId, selectedFormat.quality, outputPath);
            const downloadLink = `/downloads/${filename}`;
            const successMsg = `Video **${userSession.title}** (${selectedFormat.quality}) Anda siap! \n\nTautan unduhan: ${downloadLink}`;
            await new ChatMessage({ userId, role: 'model', content: successMsg }).save();
        } catch (error) {
            const errorMsg = `Maaf, terjadi kesalahan saat mengunduh: ${error.message}`;
            await new ChatMessage({ userId, role: 'model', content: errorMsg }).save();
        }
        return;
    }
    
    let userMessageContent = prompt;
    if (imageUrl) userMessageContent += `\n[Gambar Terlampir: ${imageUrl}]`;

    try {
        await new ChatMessage({ userId, role: 'user', content: userMessageContent }).save();
        const recentHistory = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(20);
        recentHistory.reverse();
        const historyForGemini = recentHistory.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }));
        historyForGemini.pop();
        let currentContents = [...historyForGemini];
        
        const userParts = [{ text: prompt }];
        if (imageUrl) {
            const extension = path.extname(new URL(imageUrl).pathname).toLowerCase();
            let mimeType = 'image/jpeg';
            if (extension === '.png') mimeType = 'image/png';
            userParts.push({ file_data: { mime_type: mimeType, file_uri: imageUrl } });
        }
        currentContents.push({ role: "user", parts: userParts });

        const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
        
        for (let i = 0; i < 5; i++) {
            const payload = { contents: currentContents, tools: tools };
            const apiResponse = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: `Gemini API error: ${apiResponse.statusText}` });
            const geminiResponseData = await apiResponse.json();
            if (!geminiResponseData.candidates?.length) return res.status(400).json({ error: "Permintaan diblokir." });
            const candidate = geminiResponseData.candidates[0];
            if (candidate.finishReason === "SAFETY") return res.status(400).json({ error: "Respons diblokir oleh filter keamanan." });
            if (candidate.content?.parts?.length > 0) {
                const part = candidate.content.parts[0];
                if (part.functionCall) {
                    const { name, args } = part.functionCall;
                    let functionResponseData;
                    switch (name) {
                        case "getCurrentWeather": functionResponseData = await getWeatherDataWttrIn(args.city); break;
                        case "performWebSearch": functionResponseData = await performWebSearchImplementation(args.query); break;
                        case "getYouTubeFormats":
                            functionResponseData = await getYouTubeFormatsImplementation(args.url);
                            if (functionResponseData && functionResponseData.availableFormats) {
                                userDownloadSessions[userId] = { url: functionResponseData.url, title: functionResponseData.title, formats: functionResponseData.availableFormats };
                            }
                            break;
                        default: functionResponseData = { error: `Fungsi ${name} tidak dikenal.` };
                    }
                    currentContents.push({ role: "model", parts: [part] });
                    currentContents.push({ role: "user", parts: [{ functionResponse: { name, response: functionResponseData } }] });
                } else if (part.text) {
                    let responseText = part.text;
                    try {
                        const toolResponse = JSON.parse(responseText.replace(/```json\n?/, '').replace(/```$/, ''));
                        if (toolResponse.title && toolResponse.availableFormats) {
                            responseText = `Video ditemukan: **${toolResponse.title}**\n\nSilakan pilih format yang diinginkan dengan mengetik perintah yang sesuai:\n`;
                            toolResponse.availableFormats.forEach(f => {
                                responseText += `\n- **${f.label}**: Gunakan \`/dl ${f.index}\``;
                            });
                        }
                    } catch(e) { /* Bukan JSON, biarkan apa adanya */ }
                    await new ChatMessage({ userId, role: 'model', content: responseText }).save();
                    return res.json({ response: responseText });
                } else { return res.status(500).json({ error: "Format respons tidak dikenali." }); }
            } else { return res.status(500).json({ error: `Respons tidak valid. Alasan: ${candidate.finishReason}` }); }
        }
        return res.status(500).json({ error: "Gagal mendapat respons setelah beberapa upaya." });
    } catch (err) {
        console.error("General error in /api/generate:", err);
        return res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}. Terhubung ke DB dan siap menerima request.`));
