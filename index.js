const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

// السماح بالملفات الثابتة في مجلد public
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// بيانات الأدمن
const adminUser = {
    username: 'admin',
    password: '12345',
    token: 'supersecrettoken123'
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
        .replace(/{{INSTAGRAM}}/g, handle || '')
        .replace(/{{INSTAGRAM_LINK}}/g, instagramLink || '#');

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
    if(username === adminUser.username && password === adminUser.password){
        res.redirect(`/admin?token=${adminUser.token}`);
    } else {
        res.send('اسم المستخدم أو كلمة المرور خاطئة!');
    }
});

// ===== صفحة الأدمن =====
app.get('/admin', (req, res) => {
    const token = req.query.token;
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
    if(req.body.lunaText) content.lunaText = req.body.lunaText;
    if(req.body.storyText) content.lunaText = req.body.storyText;

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
