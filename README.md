# FieldOps Control System

**نظام إدارة ومراقبة الموظفين والعاملين في الميدان**

## 📦 نظرة عامة

FieldOps هو نظام متكامل لإدارة وتتبع الموظفين والعاملين في الميدان (VENDEUR, LIVREUR, CHAUFFEUR, CREATOR) مع:

- ✅ **Dashboard** - لوحة تحكم (Next.js + NextAuth)
- ✅ **Agent App** - تطبيق الموظفين (React Native)
- ✅ **Microservices** - 7 خدمات متخصصة
- ✅ **Real-time Monitoring** - GPS, WhatsApp, MDM, Alerts

## 🏗️ البنية

```
apps/
  ├── dashboard/    (Next.js - Port 3000)
  └── agent/        (React Native)
  
services/
  ├── api/          (Port 4000)
  ├── whatsapp-logger/    (Port 4001)
  ├── content-guard/      (Port 4002)
  ├── evidence-vault/     (Port 4003)
  ├── gps-engine/         (Port 4004)
  ├── mdm-service/        (Port 4005)
  ├── alert-engine/       (Port 4006)
  └── creator-module/     (Port 4007)

packages/
  ├── db/     (Prisma + PostgreSQL)
  └── shared/ (Types & Utils)
```

## 🚀 التشغيل السريع

### المتطلبات
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose

### الخطوات

```bash
# 1. التثبيت
pnpm install

# 2. شغّل الخدمات
docker-compose up -d

# 3. إعداد قاعدة البيانات
pnpm db:migrate
pnpm db:seed

# 4. شغّل التطبيق
pnpm dev
```

## 🌐 الروابط

- Dashboard: http://localhost:3000
- API: http://localhost:4000
- MinIO: http://localhost:9000
- Prisma Studio: http://localhost:5555

## 🔐 متغيرات البيئة

انسخ `.env.example` إلى `.env` وأكمل البيانات:

```bash
cp .env.example .env
```

## 📋 الأوامر المتاحة

```bash
# التطوير
pnpm dev           # شغّل جميع الخدمات
pnpm build         # بناء للإنتاج
pnpm lint          # فحص الأخطاء
pnpm typecheck     # تحقق من الأنواع

# قاعدة البيانات
pnpm db:migrate    # تطبيق الهجرات
pnpm db:seed       # ملء البيانات
pnpm db:studio     # Prisma Studio
```

## 🐳 Docker Deployment

```bash
# بناء الصور
docker-compose build

# تشغيل الإنتاج
docker-compose -f docker-compose.coolify.yml up -d
```

## 📚 التوثيق

- [نموذج المنظومة](docs/superpowers/specs/2026-06-02-fieldops-complete-system-design.md)
- [خطة التطوير](docs/superpowers/plans/2026-06-02-plan-01-foundation.md)

## 🤝 المساهمة

```bash
git checkout -b feature/your-feature
# اعمل على الميزة
git commit -m "feat: description"
git push origin feature/your-feature
```

## 📝 الترخيص

جميع الحقوق محفوظة © 2026 FieldOps Control System

---

**Contact**: canadi205@gmail.com
