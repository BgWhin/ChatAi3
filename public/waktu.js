// public/waktu.js

// Skema Tool untuk Gemini
const timeTool = {
  name: "getCurrentTime",
  description: "Mendapatkan waktu dan tanggal saat ini. Gunakan tool ini jika pengguna bertanya tentang 'hari ini', 'sekarang', 'tanggal berapa', atau 'jam berapa'.",
  parameters: {
    type: "OBJECT",
    properties: {
      timezone: {
        type: "STRING",
        description: "Zona waktu opsional dalam format IANA (misalnya, 'Asia/Jakarta', 'America/New_York'). Jika tidak diberikan, akan menggunakan waktu server."
      }
    },
    // Tidak ada parameter yang wajib
  }
};

// Fungsi implementasi untuk mendapatkan waktu
async function getCurrentTimeImplementation(timezone = 'Asia/Jakarta') {
  try {
    const now = new Date();
    
    // Opsi untuk memformat tanggal dan waktu ke dalam format Bahasa Indonesia
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timezone,
      hour12: false // Gunakan format 24 jam
    };
    
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const formattedDateTime = formatter.format(now);
    
    return {
      datetime: formattedDateTime,
      timezone: timezone
    };
  } catch (error) {
    console.error("[Waktu] Error:", error);
    // Jika timezone tidak valid, kembali ke default
    if (error instanceof RangeError) {
      return getCurrentTimeImplementation('Asia/Jakarta');
    }
    return { error: "Gagal mendapatkan waktu saat ini." };
  }
}

// Ekspor keduanya
module.exports = {
  timeTool,
  getCurrentTimeImplementation
};