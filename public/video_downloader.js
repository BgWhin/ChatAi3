// public/video_downloader.js (Versi Final untuk Polling)
const ytdl = require('yt-dlp-exec');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const getFormatsTool = {
  name: "getYouTubeFormats",
  description: "Gunakan tool ini SETIAP KALI pengguna mengirim URL YouTube (youtube.com atau youtu.be). Tool ini akan menganalisis URL untuk mendapatkan judul, thumbnail, dan daftar format video/audio yang tersedia untuk diunduh.",
  parameters: { type: "OBJECT", properties: { url: { type: "STRING", description: "URL lengkap dari video YouTube." } }, required: ["url"] }
};

const getYouTubeFormatsImplementation = async (url) => {
    try {
        const metadata = await ytdl(url, { dumpSingleJson: true, noWarnings: true });
        const title = metadata.title || 'Video Tanpa Judul';
        const thumbnail = metadata.thumbnail || '';
        let availableFormats = [];
        if (metadata.formats) {
            const seenResolutions = new Set();
            const videoFormats = metadata.formats.filter(f => f.vcodec !== 'none' && f.ext === 'mp4' && f.filesize && f.resolution !== 'audio only' && !seenResolutions.has(f.height)).map(f => { seenResolutions.add(f.height); return f; });
            const bestAudio = metadata.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.filesize).sort((a, b) => b.abr - a.abr)[0];
            let index = 1;
            availableFormats = videoFormats.sort((a, b) => a.height - b.height).map(f => ({ index: index++, formatId: f.acodec === 'none' ? `${f.format_id}+bestaudio` : f.format_id, quality: f.format_note, label: `${f.format_note} (${(f.filesize / 1024 / 1024).toFixed(1)} MB)` }));
            if (bestAudio) { availableFormats.push({ index: index++, formatId: bestAudio.format_id, quality: 'Audio Only', label: `Audio Only (${(bestAudio.filesize / 1024 / 1024).toFixed(1)} MB)` }); }
        }
        if (availableFormats.length === 0) return { error: "Tidak ditemukan format unduhan yang valid." };
        return { url, title, thumbnail, availableFormats };
    } catch (error) { return { error: `Gagal menganalisis video. Error: ${error.message}` }; }
};

// Fungsi ini sekarang menerima outputPath dari server.js
const downloadYouTubeFormatImplementation = async (url, formatId, qualityLabel, outputPath) => {
    console.log(`[Downloader] Mengunduh format '${formatId}' ke path: ${outputPath}`);
    try {
        const options = { format: formatId, output: outputPath };
        if (qualityLabel === 'Audio Only') {
            options['extract-audio'] = true;
            options['audio-format'] = 'mp3';
        } else {
            options['merge-output-format'] = 'mp4';
        }
        await ytdl(url, options);
        // Cukup kembalikan true jika berhasil, karena server sudah tahu nama filenya
        return true;
    } catch (error) {
        console.error('[Downloader] Error:', error);
        throw new Error(`Gagal mengunduh format '${qualityLabel}'.`);
    }
};

module.exports = { getFormatsTool, getYouTubeFormatsImplementation, downloadYouTubeFormatImplementation };