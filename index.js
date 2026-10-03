// 1-qadam: kerakli kutubxonalarni chaqiramiz
require('dotenv').config(); // .env fayldagi qiymatlarni o'qiydi
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); // body'dagi JSON'ni o'qish uchun

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET; // maxfiy so'z .env fayldan olinadi
const MONGO_URL = process.env.MONGO_URL; // database manzili ham .env fayldan

// 2-qadam: database'dagi jadvallar (model) qanday ko'rinishini yozamiz
const Mentor = mongoose.model('Mentor', {
  name: String,
  username: String,
  password: String, // DIQQAT: oddiy parol faqat dars uchun! Haqiqiy loyihada bcrypt bilan shifrlanadi
});

const Group = mongoose.model('Group', {
  name: String,
  mentorId: mongoose.Schema.Types.ObjectId, // bu gruppa qaysi mentorga tegishli
});

// 3-qadam: namuna uchun 3 ta mentor va 20 ta gruppa qo'shamiz
// Bu funksiya faqat database bo'sh bo'lsa ishlaydi
async function namunaQosh() {
  const mentorlarSoni = await Mentor.countDocuments();
  if (mentorlarSoni > 0) {
    return; // mentorlar allaqachon bor, qayta qo'shmaymiz
  }

  const ali = await Mentor.create({ name: 'Ali', username: 'ali', password: '1111' });
  const vali = await Mentor.create({ name: 'Vali', username: 'vali', password: '2222' });
  const sardor = await Mentor.create({ name: 'Sardor', username: 'sardor', password: '3333' });

  // 1-7 gruppalar Aliga, 8-14 Valiga, 15-20 Sardorga
  for (let i = 1; i <= 20; i++) {
    let mentor;
    if (i <= 7) {
      mentor = ali;
    } else if (i <= 14) {
      mentor = vali;
    } else {
      mentor = sardor;
    }
    await Group.create({ name: 'Gruppa ' + i, mentorId: mentor._id });
  }

  console.log('Namuna qo\'shildi: 3 ta mentor va 20 ta gruppa');
}

// 4-qadam: LOGIN — username va parol to'g'ri bo'lsa, token beramiz
app.post('/login', async (req, res) => {
  const body = req.body || {};
  const username = body.username;
  const password = body.password;

  // mentorni username bo'yicha database'dan qidiramiz
  const mentor = await Mentor.findOne({ username: username });

  if (!mentor || mentor.password !== password) {
    return res.status(401).json({ message: 'Username yoki parol xato' });
  }

  // token ichiga mentorning ID'sini yozamiz
  const token = jwt.sign({ mentorId: mentor._id }, JWT_SECRET, { expiresIn: '1h' });

  res.json({ token: token });
});

// 5-qadam: MIDDLEWARE — tokenni tekshiradi
function tokenniTekshir(req, res, next) {
  const header = req.headers.authorization; // "Bearer TOKEN" ko'rinishida keladi

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token yo\'q' });
  }

  const token = header.split(' ')[1]; // "Bearer" so'zidan keyingi qism

  try {
    const malumot = jwt.verify(token, JWT_SECRET); // token haqiqiymi, tekshiramiz
    req.mentorId = malumot.mentorId; // mentor ID'sini keyingi funksiyaga uzatamiz
    next();
  } catch (xato) {
    return res.status(401).json({ message: 'Token yaroqsiz' });
  }
}

// 6-qadam: GRUPPALAR — faqat tokendagi mentorning gruppalari qaytadi
app.get('/groups', tokenniTekshir, async (req, res) => {
  // MUHIM: mentor ID body yoki query'dan EMAS, tekshirilgan tokendan olinadi
  const gruppalar = await Group.find({ mentorId: req.mentorId });

  res.json(gruppalar);
});

// 7-qadam: avval database'ga ulanamiz, keyin serverni yoqamiz
async function boshlash() {
  if (!JWT_SECRET || !MONGO_URL) {
    console.log('.env faylda JWT_SECRET va MONGO_URL bo\'lishi kerak');
    return;
  }

  await mongoose.connect(MONGO_URL);
  console.log('Database\'ga ulandik');

  await namunaQosh();

  app.listen(PORT, () => {
    console.log('Server ishladi: http://localhost:' + PORT);
  });
}

boshlash();
