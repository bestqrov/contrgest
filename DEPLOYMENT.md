# Coolify Deployment Guide

## 🚀 النشر على Coolify/Hostinger VPS

### الخطوات الأساسية

#### 1️⃣ متطلبات الخادم

```bash
# تأكد من:
- Ubuntu 20.04+ أو أي Linux توزيعة
- Docker + Docker Compose
- Git
- Node.js 20+ (اختياري - يستخدم Docker بشكل أساسي)
```

#### 2️⃣ استنساخ المستودع

```bash
cd /opt/apps
git clone https://github.com/bestqrov/contrgest.git fieldops
cd fieldops
```

#### 3️⃣ إعداد ملف البيئة

```bash
# نسخ وتحرير المتغيرات
cp .env.example .env
nano .env

# تأكد من تحديد:
- DATABASE_URL (PostgreSQL)
- REDIS_URL
- MINIO_* (معرفات التخزين)
- JWT_SECRET و NEXTAUTH_SECRET
- النطاقات (DASHBOARD_DOMAIN, API_DOMAIN)
```

#### 4️⃣ بناء الصور

```bash
docker-compose -f docker-compose.coolify.yml build
```

#### 5️⃣ التشغيل

```bash
docker-compose -f docker-compose.coolify.yml up -d
```

#### 6️⃣ التحقق

```bash
# عرض السجلات
docker-compose logs -f

# فحص الخدمات
curl http://localhost:4000/health
```

---

## 🔐 الأمان

### SSL/TLS
استخدم Nginx Reverse Proxy:

```nginx
upstream fieldops-dashboard {
    server localhost:3000;
}

upstream fieldops-api {
    server localhost:4000;
}

server {
    listen 443 ssl http2;
    server_name gestflux.digima.cloud;
    
    ssl_certificate /etc/letsencrypt/live/gestflux.digima.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gestflux.digima.cloud/privkey.pem;
    
    location / {
        proxy_pass http://fieldops-dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://fieldops-api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name gestflux.digima.cloud;
    return 301 https://$server_name$request_uri;
}
```

### Firewall
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 5432  # PostgreSQL (إذا كان متاح خارجياً - غير موصى به)
```

---

## 📊 المراقبة والصيانة

### السجلات
```bash
# عرض جميع السجلات
docker-compose logs -f

# سجلات خدمة محددة
docker-compose logs -f api
docker-compose logs -f dashboard
```

### التحديث
```bash
git pull origin main
docker-compose -f docker-compose.coolify.yml build
docker-compose -f docker-compose.coolify.yml up -d
```

### النسخ الاحتياطي
```bash
# قاعدة البيانات
docker exec fieldops-postgres pg_dump -U fieldops fieldops_db > backup.sql

# MinIO (الملفات)
docker exec fieldops-minio mc cp -r /data backup/
```

---

## 🐛 استكشاف الأخطاء

### الخدمة لا تبدأ
```bash
docker-compose logs api
docker ps
```

### مشاكل قاعدة البيانات
```bash
docker exec fieldops-postgres psql -U fieldops -d fieldops_db -c "SELECT version();"
```

### Redis غير متاح
```bash
docker exec fieldops-redis redis-cli ping
```

---

## 📞 الدعم

**المستودع**: https://github.com/bestqrov/contrgest
**البريد**: canadi205@gmail.com
