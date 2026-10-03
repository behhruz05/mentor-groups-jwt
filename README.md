# Mentor va gruppalar — JWT bilan

Bu loyihada 3 ta mentor va 20 ta gruppa bor. Har bir gruppa bitta mentorga tegishli.
Mentor login qiladi, token oladi va shu token bilan `GET /groups` ga so'rov yuborsa, **faqat o'zining gruppalari** qaytadi.

Bu faylni **boshidan oxirigacha** o'qing. Darsda code review bo'ladi — har biringiz kodni detalno tushuntirib berasiz.

---

## Ishga tushirish

```bash
git clone https://github.com/behhruz05/mentor-groups-jwt.git
cd mentor-groups-jwt
npm install
```

Keyin `.env.example` fayldan nusxa olib, nomini `.env` qiling va ichini to'ldiring:

```
PORT=3000
JWT_SECRET=ozingizning_maxfiy_sozingiz
MONGO_URL=mongodb+srv://USER:PAROL@cluster0.xxxxx.mongodb.net/mentor_dars
```

```bash
npm start
```

Terminalda shular chiqishi kerak:

```
Database'ga ulandik
Namuna qo'shildi: 3 ta mentor va 20 ta gruppa
Server ishladi: http://localhost:3000
```

---

## Fayllar

| Fayl | Nima uchun kerak |
|---|---|
| `index.js` | Butun kod shu yerda |
| `.env` | Maxfiy qiymatlar (parol, secret). GitHub'ga **chiqmaydi** |
| `.env.example` | `.env` qanday ko'rinishda bo'lishini ko'rsatadigan namuna |
| `.gitignore` | Git'ga qaysi fayllar chiqmasligini aytadi (`node_modules`, `.env`) |
| `package.json` | Loyihada qaysi kutubxonalar ishlatilganini saqlaydi |

**Nega `.env` GitHub'ga chiqmaydi?** Chunki uning ichida database paroli va `JWT_SECRET` bor. Kim shu faylni ko'rsa, database'ga kira oladi va o'zi xohlagan mentor nomidan token yasay oladi.

---

## Kutubxonalar

| Kutubxona | Vazifasi |
|---|---|
| `express` | Server yasaydi, so'rovlarni qabul qiladi |
| `jsonwebtoken` | Token yasaydi (`jwt.sign`) va tekshiradi (`jwt.verify`) |
| `mongoose` | MongoDB database bilan ishlaydi |
| `dotenv` | `.env` fayldagi qiymatlarni `process.env` ga yuklaydi |

---

## `index.js` — qadam-baqadam

Kod ichida `// 1-qadam`, `// 2-qadam` ... degan izohlar bor. Pastdagi tushuntirishlar shu qadamlar bo'yicha.

### 1-qadam: kutubxonalar va sozlamalar

```js
require('dotenv').config();
```

Bu qator `.env` faylni o'qiydi. Shundan keyin `process.env.JWT_SECRET` deb yozsak, `.env` dagi qiymat keladi. Bu qator **eng tepada** turishi kerak — aks holda pastdagi `process.env...` lar bo'sh bo'lib qoladi.

```js
app.use(express.json());
```

Postman'dan JSON yuborilganda, Express uni o'zi o'qimaydi. Shu qator JSON'ni o'qib, `req.body` ga solib beradi. Bu bo'lmasa, login'da `req.body` bo'sh bo'ladi.

### 2-qadam: modellar

```js
const Mentor = mongoose.model('Mentor', { name, username, password });
const Group  = mongoose.model('Group',  { name, mentorId });
```

Model — database'dagi ma'lumot qanday ko'rinishda bo'lishini aytadi.

- `Mentor` → database'da `mentors` kolleksiyasi
- `Group` → database'da `groups` kolleksiyasi

Eng muhim joy — gruppadagi **`mentorId`**. Bu yerga mentorning `_id` si yoziladi. Aynan shu maydon orqali "bu gruppa kimniki" degan savolga javob topamiz.

> Parol bu yerda oddiy matn holida saqlangan (`1111`). Bu **faqat dars uchun**. Haqiqiy loyihada parol `bcrypt` bilan shifrlanadi.

### 3-qadam: namuna ma'lumotlar — `namunaQosh()`

```js
const mentorlarSoni = await Mentor.countDocuments();
if (mentorlarSoni > 0) {
  return;
}
```

Avval database'da mentor bor-yo'qligini tekshiramiz. Agar bor bo'lsa, funksiya shu yerda to'xtaydi. Bu tekshiruv bo'lmasa, serverni har safar yoqqanda yana 3 ta mentor va 20 ta gruppa qo'shilaverardi.

Keyin 3 ta mentor yaratiladi va `for` sikl 1 dan 20 gacha aylanadi:

| Gruppalar | Mentor | Login |
|---|---|---|
| Gruppa 1–7 | Ali | `ali` / `1111` |
| Gruppa 8–14 | Vali | `vali` / `2222` |
| Gruppa 15–20 | Sardor | `sardor` / `3333` |

`mentorId: mentor._id` — har bir gruppaga o'z mentorining ID'si yoziladi.

### 4-qadam: `POST /login`

1. `req.body` dan `username` va `password` olinadi.
2. `Mentor.findOne({ username })` — shu username'li mentor database'dan qidiriladi.
3. Mentor topilmasa **yoki** parol to'g'ri kelmasa → `401` va `"Username yoki parol xato"`.
4. Hammasi to'g'ri bo'lsa, token yasaladi:

```js
const token = jwt.sign({ mentorId: mentor._id }, JWT_SECRET, { expiresIn: '1h' });
```

- `{ mentorId: mentor._id }` — token **ichiga** yoziladigan ma'lumot
- `JWT_SECRET` — tokenga imzo qo'yadigan maxfiy so'z
- `expiresIn: '1h'` — token 1 soatdan keyin yaroqsiz bo'ladi

**Nega "username xato" va "parol xato" alohida aytilmaydi?** Chunki alohida aytilsa, begona odam qaysi username'lar borligini bilib oladi.

### 5-qadam: middleware — `tokenniTekshir`

Middleware — so'rov asosiy funksiyaga yetib borishidan **oldin** ishlaydigan funksiya. U xuddi eshik oldidagi qorovulga o'xshaydi.

1. `req.headers.authorization` o'qiladi. U shunday keladi: `Bearer eyJhbGci...`
2. Header yo'q bo'lsa yoki `Bearer ` bilan boshlanmasa → `401` `"Token yo'q"`.
3. `header.split(' ')[1]` — bo'sh joy bo'yicha ikkiga bo'lib, ikkinchi qismini (tokenning o'zini) oladi.
4. `jwt.verify(token, JWT_SECRET)` — tokenni tekshiradi:
   - imzo bizning `JWT_SECRET` bilan qo'yilganmi?
   - muddati o'tmaganmi?
5. Token to'g'ri bo'lsa: `req.mentorId = malumot.mentorId` va `next()` — so'rov keyingi funksiyaga o'tadi.
6. Token noto'g'ri bo'lsa, `jwt.verify` xato tashlaydi, `catch` ushlaydi → `401` `"Token yaroqsiz"`.

`next()` chaqirilmasa, so'rov shu yerda to'xtab qoladi va `/groups` ichidagi kod umuman ishlamaydi.

### 6-qadam: `GET /groups`

```js
app.get('/groups', tokenniTekshir, async (req, res) => {
  const gruppalar = await Group.find({ mentorId: req.mentorId });
  res.json(gruppalar);
});
```

E'tibor bering: `tokenniTekshir` yo'l nomi bilan asosiy funksiya **orasida** turibdi. Ya'ni avval qorovul tekshiradi, keyin asosiy kod ishlaydi.

`Group.find({ mentorId: req.mentorId })` — database'dan faqat `mentorId` si shu mentorga teng gruppalarni oladi.

**Eng muhim qoida:** mentor ID `req.body` yoki `req.query` dan **olinmaydi**. Faqat tekshirilgan tokendan olinadi.

Nega? Agar `req.query.mentorId` dan olganimizda, Ali `/groups?mentorId=VALINING_ID` deb yozib, Valining gruppalarini ko'rib olardi. Body va query'ni foydalanuvchi o'zi yozadi — xohlagan narsasini yozishi mumkin. Tokenni esa o'zgartira olmaydi, chunki imzo buziladi.

### 7-qadam: ishga tushirish — `boshlash()`

Tartib muhim:

1. `.env` da `JWT_SECRET` va `MONGO_URL` borligini tekshiradi.
2. `mongoose.connect(MONGO_URL)` — database'ga ulanadi.
3. `namunaQosh()` — kerak bo'lsa namuna qo'shadi.
4. `app.listen(PORT)` — shundan keyingina server so'rov qabul qila boshlaydi.

Avval database, keyin server. Teskari bo'lsa, server yoqilgan, lekin database hali ulanmagan paytda so'rov kelib, xato berishi mumkin.

---

## Token nima?

Token 3 qismdan iborat, orasida nuqta bor:

```
eyJhbGciOi...  .  eyJtZW50b3JJZCI6...  .  SflKxwRJSMeKKF2QT4...
   header              payload                  imzo
```

- **payload** — ichida `mentorId` va tokenning muddati bor
- **imzo** — payload va `JWT_SECRET` dan hisoblanadi

Tokenni https://jwt.io saytiga qo'yib, ichini ko'rishingiz mumkin. Demak token **shifrlanmagan** — uni hamma o'qiy oladi. Shuning uchun token ichiga parol yozilmaydi.

Lekin tokenni **o'zgartirib bo'lmaydi**. Kimdir payload'dagi `mentorId` ni boshqasiga almashtirsa, imzo to'g'ri kelmay qoladi va `jwt.verify` xato beradi. To'g'ri imzo qo'yish uchun `JWT_SECRET` ni bilish kerak, u esa faqat serverda.

---

## Bitta so'rovning to'liq yo'li

Ali o'z gruppalarini ko'rmoqchi:

1. Postman → `POST /login`, body: `{ "username": "ali", "password": "1111" }`
2. Server Alini database'dan topadi, parolni solishtiradi
3. Server ichida Alining ID'si bor token yasab qaytaradi
4. Postman → `GET /groups`, header: `Authorization: Bearer TOKEN`
5. `tokenniTekshir` tokenni tekshiradi, `req.mentorId` ga Alining ID'sini yozadi
6. `Group.find({ mentorId: req.mentorId })` — faqat Alining 7 ta gruppasi topiladi
7. Server shu 7 ta gruppani JSON qilib qaytaradi

---

## Postman'da tekshirish

**1. Login**

- `POST http://localhost:3000/login`
- Body → raw → JSON:

```json
{ "username": "ali", "password": "1111" }
```

Javob: `{ "token": "eyJ..." }`

**2. Gruppalar**

- `GET http://localhost:3000/groups`
- Authorization → Bearer Token → tokenni qo'ying

**3. O'zingiz sinab ko'ring**

| Nima qilasiz | Nima qaytishi kerak |
|---|---|
| `ali` tokeni bilan `/groups` | Gruppa 1–7 |
| `vali` tokeni bilan `/groups` | Gruppa 8–14 |
| `sardor` tokeni bilan `/groups` | Gruppa 15–20 |
| Tokensiz `/groups` | `401` `"Token yo'q"` |
| Tokenning bitta harfini o'zgartirib | `401` `"Token yaroqsiz"` |
| Xato parol bilan login | `401` `"Username yoki parol xato"` |
| Ali tokeni bilan `/groups?mentorId=boshqa` | Baribir Gruppa 1–7 |

---

## Code review savollari

Darsda har biringizdan shu savollar so'raladi. Javobni yodlab emas, **tushunib** ayting.

1. `require('dotenv').config()` nima qiladi? Nega u eng tepada turadi?
2. `app.use(express.json())` ni o'chirib tashlasak, nima buziladi?
3. Gruppadagi `mentorId` nima uchun kerak?
4. `namunaQosh()` ichidagi `if (mentorlarSoni > 0) return;` bo'lmasa nima bo'ladi?
5. Login'da qachon `401` qaytadi?
6. `jwt.sign` ning uchta qiymati nima degani?
7. Token ichida nima bor? Uni begona odam o'qiy oladimi? O'zgartira oladimi?
8. Middleware nima? `next()` ni yozmasak nima bo'ladi?
9. `header.split(' ')[1]` nima qaytaradi?
10. `jwt.verify` qaysi hollarda xato beradi?
11. Nega mentor ID'ni `req.query` dan emas, tokendan olamiz?
12. Nega avval database'ga ulanamiz, keyin `app.listen` qilamiz?
13. `.env` nega GitHub'ga chiqmaydi? `JWT_SECRET` ni kimdir bilib olsa, nima qila oladi?
14. Oddiy parol saqlash nega xavfli?
