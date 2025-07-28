// public/search.js
require('dotenv').config();

async function performWebSearchImplementation(query) {
    const API_KEY = process.env.GOOGLE_SEARCH_API_KEY, CSE_ID = process.env.GOOGLE_CSE_ID;
    if (!API_KEY || !CSE_ID) return { error: "Layanan pencarian tidak dikonfigurasi." };
    if (!query) return { error: "Query pencarian tidak diberikan." };
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=3`;
    console.log(`[Search] Mencari: "${query}"`);
    try {
        const response = await fetch(url), data = await response.json();
        if (data.error) return { error: `Error API Google: ${data.error.message}` };
        if (data.items?.length > 0) return { results: data.items.map(item => ({ title: item.title, link: item.link, snippet: item.snippet })) };
        else return { results: "Tidak ada hasil yang relevan ditemukan." };
    } catch (error) { return { error: "Gagal melakukan pencarian." }; }
}
// Skema Tool
const searchTool = { name: "performWebSearch", description: "Mencari informasi di internet menggunakan Google Search. Alat ini sangat berguna untuk mendapatkan data real-time, berita terbaru, atau informasi yang mungkin tidak ada dalam data pelatihan model. Gunakan alat ini untuk pertanyaan tentang harga (seperti saham, mata uang kripto seperti Bitcoin), peristiwa terkini, skor pertandingan, biografi orang, detail produk, atau definisi spesifik. gunakan juga alat ini jika kau tidak tau pasti untuk menjawab pertanyaan user.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Kata kunci atau pertanyaan yang akan dicari di Google. Contoh: 'harga Bitcoin hari ini', 'cari jawaban menggunakan user toosl ini jika tidak dapat menemukan jawaban dimodel', 'hasil pertandingan Real Madrid vs Barcelona'." } }, required: ["query"] } };

// Ekspor keduanya
module.exports = { performWebSearchImplementation, searchTool };