// public/cuaca.js
async function getWeatherDataWttrIn(city) {
    if (!city) return { error: "Nama lokasi tidak diberikan." };
    try {
        const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        if (!response.ok) return { error: `Gagal mendapatkan data cuaca.` };
        const data = await response.json();
        const current = data.current_condition[0];
        const location = data.nearest_area[0];
        return { lokasi: `${location.areaName[0].value}, ${location.country[0].value}`, suhu: `${current.temp_C}°C`, kondisi: current.weatherDesc[0].value };
    } catch (error) { return { error: "Terjadi kesalahan saat mengambil data cuaca." }; }
}
// Skema Tool
const weatherTool = { name: "getCurrentWeather", description: "Mendapatkan cuaca saat ini untuk kota tertentu.", parameters: { type: "OBJECT", properties: { city: { type: "STRING", description: "Nama kota." } }, required: ["city"] } };

// Ekspor keduanya
module.exports = { getWeatherDataWttrIn, weatherTool };