// File: /middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    // 1. Ambil token dari header 'Authorization'
    // Format yang diharapkan adalah: "Bearer <TOKEN_ANDA>"
    const authHeader = req.headers.authorization;

    // 2. Periksa jika header tidak ada atau formatnya salah
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Jika tidak ada token, tolak akses
        return res.status(401).json({ message: 'Akses ditolak. Token tidak tersedia atau format salah.' });
    }

    try {
        // 3. Ambil token-nya saja (tanpa kata "Bearer ")
        const token = authHeader.split(' ')[1];

        // 4. Verifikasi keaslian token menggunakan kunci rahasia dari file .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Jika token valid, tambahkan informasi pengguna (dari token) ke dalam objek request
        //    agar bisa digunakan oleh rute selanjutnya (misalnya untuk tahu siapa yang mengirim pesan)
        req.user = decoded; 

        // 6. Lanjutkan proses ke handler rute yang sebenarnya
        next();
    } catch (error) {
        // 7. Jika token tidak valid (misalnya, kadaluarsa atau salah), kirim error
        res.status(401).json({ message: 'Token tidak valid.' });
    }
};

// 8. Ini adalah bagian paling penting:
//    Ekspor fungsi 'authMiddleware' agar bisa di-require() oleh file lain (server.js)
module.exports = authMiddleware;
