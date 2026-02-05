require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const app = express();
const PORT = 3000;

// السماح بالملفات الثابتة في مجلد public
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// إعدادات Multer للرفع في مجلد public/uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // يخلي public folder متاح للزوار

//
app.get('/content', (req, res) => {
  const data = JSON.parse(fs.readFileSync('content.json', 'utf-8'));
  res.json(data);
});

// Endpoint لتحديث content.json
app.post('/update-content', (req, res) => {
  const token = req.body.token;
  if(token !== 'supersecrettoken123') return res.status(403).send('Unauthorized');

  const data = { ...req.body };
  delete data.token; // نزيل التوكن قبل الحفظ
  fs.writeFileSync('content.json', JSON.stringify(data, null, 2));
  res.send('Content updated successfully!');
});

// Endpoint لرفع الصور والفيديو
app.post('/upload', upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).send('No file uploaded');
  // نرسل الرابط المباشر للملف الجديد
  res.json({ url: `/uploads/${req.file.filename}` });
});

// بيانات الأدمن
const adminUser = {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    token: process.env.ADMIN_TOKEN
};

// ===== HELPER FUNCTION لبناء المينيو =====
function buildMenuItems(categoryData) {
    const items = categoryData.items || [];
    return items.map(item => `
        <div class="menu-item">
            <span>${item.name}</span>
            <span>${item.prices[0]}</span>
            <span>${item.prices[1]}</span>
        </div>
        <hr>
    `).join('');
}

// ===== الصفحة الرئيسية / =====
app.get('/', (req, res) => {
    const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf-8'));
    let html = fs.readFileSync(path.join(__dirname, 'luna.html'), 'utf-8');

    const handle = (content.instagram || '').trim();
    const handleNoAt = handle.startsWith('@') ? handle.slice(1) : handle;
    const instagramLink = handleNoAt ? `https://instagram.com/${handleNoAt}` : '#';

    
      html = html
    .replace('{{LUNATEXT}}', content.lunaText || '')
    .replace('{{lunaImage1}}', content.lunaImage1 || '')
    .replace('{{lunaImage2}}', content.lunaImage2 || '')
    .replace('{{lunaImage3}}', content.lunaImage3 || '')
    .replace(/{{EMAIL}}/g, content.email || '')
    .replace(/{{PHONE}}/g, content.phone || '')
    .replace(/{{INSTAGRAM}}/g, content.instagram || '')
    .replace(/{{INSTAGRAM_LINK}}/g, instagramLink || '#')
    // الحقول الجديدة
    .replace('{{address}}', content.address || '')
    .replace('{{hours}}', content.hours || '')
    .replace('{{video}}', content.video || '')
    .replace('{{maplink}}', content.mapLink || '#');
    res.send(html);
});


// ===== endpoint لجلب محتوى luna (للاستخدام من admin) =====
app.get('/luna', (req, res) => {
    const content = JSON.parse(fs.readFileSync('content.json', 'utf-8'));
    res.json(content);
});

// ===== صفحة المينيو =====
app.get('/menu', (req, res) => {
    const content = JSON.parse(fs.readFileSync('content.json', 'utf-8'));
    let html = fs.readFileSync('menu.html', 'utf-8');

    Object.keys(content).forEach(cat => {
        if(content[cat]?.items){
            const catHTML = buildMenuItems(content[cat]);
            html = html.replace(`{{${cat}}}`, catHTML);
        }
    });

    res.send(html);
});

// ===== صفحة login =====
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// التحقق من login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, hasPassword: !!password });
    console.log('Expected:', { user: adminUser.username, hasPassword: !!adminUser.password });
    if(username === adminUser.username && password === adminUser.password){
        res.redirect(`/admin?token=${adminUser.token}`);
    } else {
        res.send('اسم المستخدم أو كلمة المرور خاطئة!');
    }
});

// ===== صفحة الأدمن =====
app.get('/admin', (req, res) => {
    const token = req.query.token;
    if(!token){
        return res.redirect('/login');
    }
    if(token === adminUser.token){
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.send('Access Denied: غير مصرح لك بالدخول!');
    }
});

// ===== تعديل المحتوى من الأدمن (POST) =====
app.post('/update-content', (req, res) => {
    const token = req.body.token;
    if(token !== adminUser.token){
        return res.send('غير مصرح لك!');
    }

    // قراءة المحتوى الحالي
    const content = JSON.parse(fs.readFileSync('content.json', 'utf-8'));

    // تحديث الصفحة الرئيسية
   // تحديث الصفحة الرئيسية - حقول جديدة
if(req.body.address) content.address = req.body.address;
if(req.body.hours) content.hours = req.body.hours;
if(req.body.video) content.video = req.body.video;
if(req.body.mapLink) content.mapLink = req.body.mapLink;
    if(Array.isArray(req.body.storyImages)) {
        const cleanedImages = req.body.storyImages
            .map(img => String(img || '').trim())
            .filter(Boolean);

        if(cleanedImages[0]) content.lunaImage1 = cleanedImages[0];
        if(cleanedImages[1]) content.lunaImage2 = cleanedImages[1];
        if(cleanedImages[2]) content.lunaImage3 = cleanedImages[2];
    }

    if(req.body.email) content.email = req.body.email;
    if(req.body.phone) content.phone = req.body.phone;
    if(req.body.instagram) content.instagram = req.body.instagram;

    if(req.body.storyText) {
        content.story = content.story || {};
        content.story.text = req.body.storyText;
    }
    if(Array.isArray(req.body.storyImages) && req.body.storyImages.length) {
        content.story = content.story || {};
        content.story.images = req.body.storyImages;
    }
    if(req.body.email || req.body.phone || req.body.instagram) {
        content.contact = content.contact || {};
        if(req.body.email) content.contact.email = req.body.email;
        if(req.body.phone) content.contact.phone = req.body.phone;
        if(req.body.instagram) content.contact.instagram = req.body.instagram;
    }

    // تحديث المينيو (لو موجود)
    if(req.body.menuUpdates){
        Object.keys(req.body.menuUpdates).forEach(cat => {
            content[cat] = req.body.menuUpdates[cat];
        });
    }

    // كتابة التغييرات في JSON
    fs.writeFileSync('content.json', JSON.stringify(content, null, 2));

    res.send('تم تحديث المحتوى بنجاح!');
});

// ===== تشغيل السيرفر =====
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

