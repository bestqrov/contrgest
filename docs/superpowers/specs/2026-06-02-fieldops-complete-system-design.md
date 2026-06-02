# FieldOps Control System — Complete Design Specification
**Date:** 2026-06-02  
**Status:** Approved for implementation  
**Language:** Arabic explanations, English code/identifiers

---

## 1. System Overview & Philosophy

**الفلسفة:** "ما نمنعوش والو — نجمعو كل شي"

الموظف حر يتكلم، يبعث SMS، يفتح WhatsApp، يستعمل SIM2 — **ما كاين والو ممنوع.**
الجهاز ديال الشركة = **نسخة من كل شيء عندنا في الخادم.**
اللي دار شي ضد الشركة — **هو لي جمع الأدلة على راسو بيده.**
العقد واضح: "اللي دار شي يتحمل المسؤولية."

**القاعدة التقنية المطلقة:** MDM لا يحجب أي تطبيق أو اتصال أبداً. `blockedApps` دائماً فارغة. الهدف الوحيد = **جمع + توثيق + حفظ.**

نظام تحكم ميداني متكامل لشركة مغربية. يراقب الموظفين الميدانيين (بائعون، سائقون، منشئو محتوى) على هواتف أندرويد مملوكة للشركة. الموظفون يعلمون بالمراقبة (مذكور في العقد ومقبول). النظام يجمع الأدلة القانونية ويعطي المالك لوحة تحكم لحظية.

### القنوات الست المُراقَبة

| القناة | الوضع | ما يُسجَّل | الهدف القانوني |
|--------|--------|------------|----------------|
| **SIM2** | مفتوحة — تعمل بحرية | كل SMS + مكالمات + بيانات، timestamp + رقم المتصل | الاتصال بمنافس أو تسريب بيانات عملاء = دليل قاطع |
| **WA الشخصي** | مفتوح — غير ممنوع | كل رسالة sent/received، stories، status، صور + فيديو + نصوص | البيع على رقم شخصي أو مشاركة أسرار تجارية = خرق عقد موثّق |
| **TikTok/Reels** | يرفع — ينتظر موافقة | كل draft محفوظ قبل review، hash + screenshot + metadata، حتى المرفوض محفوظ | نشر بدون موافقة أو مسح بعد ما تلاح = proof كامل موجود |
| **Email/SMS Marketing** | مفتوح | كل إرسال مسجل، قائمة المستلمين محفوظة، المحتوى مؤرشف | استعمال قائمة عملاء شخصياً = سرقة بيانات موثّقة |
| **GPS** | مفتوح — يتنقل بحرية | كل route مسجلة، وقفات + مدتها، مقارنة مع التوصيلات | وقف عند منافس أو توصيل خارج القائمة = موثق GPS |
| **Factory Reset** | ممنوع — يتحجب | تنبيه فوري + snapshot كامل للجهاز قبل أي مسح | محاولة إتلاف أدلة = جريمة إضافية في العقد والقانون |

### نظام المكافآت (Cadeaux de Convention)
- شهر بلا مخالفات = bonus تلقائي
- أكبر commission + نقاط نزاهة تتراكم = ترقية

### الحماية القانونية
- الموظف يوقع على: المراقبة معلومة ومقبولة
- الأدلة المجمعة صالحة قانونياً في المغرب
- Factory Reset = إنهاء عقد فوري + تعويضات

---

## 2. Architecture Decisions (Final)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mobile agent framework | **Bare React Native** (not Expo) | Android Enterprise QR provisioning requires native `DeviceAdminReceiver` — impossible in Expo managed workflow |
| APK hosting | **MinIO** public bucket on VPS | Self-hosted, same infrastructure, used for evidence vault too |
| QR provisioning | **Android Enterprise format** (android.app.extra.*) | Native OS provisioning, no app pre-installed, Device Owner guaranteed |
| Dashboard auth | **NextAuth.js v5** wrapping Express JWT | Correct App Router pattern — session stored in httpOnly cookie, middleware.ts protects all routes |
| File storage | **MinIO** (S3-compatible, on VPS) | Write-once buckets, SHA-256 dedup, no delete API exposed |
| Real-time | **Socket.io** in `services/api` | Single connection point for dashboard — GPS, alerts, messages all push here |
| Alert delivery | **Evolution API WhatsApp** + **Socket.io** | WhatsApp for owner's phone, Socket.io for dashboard |
| All hosting | **VPS Hostinger + Coolify** | docker-compose managed by Coolify, everything self-hosted |

---

## 3. Monorepo Structure (Final)

```
/apps
  /dashboard        → Next.js 14 App Router (owner only, NextAuth protected)
  /agent            → Bare React Native Android (Device Owner, hidden, persistent)
/services
  /api              → Express REST + Socket.io server (THE central gateway)
  /whatsapp-logger  → Evolution API webhook receiver (BullMQ, <200ms response)
  /content-guard    → Content approval engine (automated checks + manual review)
  /evidence-vault   → MinIO-backed immutable store (SHA-256, write-once)
  /gps-engine       → GPS ingestion + anomaly detection (Bull jobs)
  /mdm-service      → Android Enterprise QR provisioning + device management
  /alert-engine     → Cross-service anomaly detection + notifications
  /creator-module   → UTM tracking + commission calculator + brand score
/packages
  /db               → Prisma schema + migrations + seed
  /shared           → TypeScript types + constants + utils + logger
/docker-compose.yml
/pnpm-workspace.yaml
```

---

## 4. Prisma Schema Changes vs Existing

### 4.1 New Models to Add

```prisma
model KnownLocation {
  id           String   @id @default(cuid())
  name         String
  type         KnownLocationType  // WAREHOUSE | CLIENT | APPROVED_STOP
  lat          Decimal  @db.Decimal(10, 8)
  lng          Decimal  @db.Decimal(11, 8)
  radiusMeters Int      @default(100)
  employeeIds  String[] // empty = all employees
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model GpsAnomaly {
  id          String          @id @default(cuid())
  deviceId    String
  employeeId  String
  type        GpsAnomalyType  // LONG_STOP | ROUTE_DEVIATION | OFFLINE
  startedAt   DateTime
  resolvedAt  DateTime?
  lat         Decimal?        @db.Decimal(10, 8)
  lng         Decimal?        @db.Decimal(11, 8)
  alertId     String?
  metadata    Json?
  createdAt   DateTime        @default(now())
}

model RawWebhookEvent {
  // immutable raw payload from Evolution API — stored before any processing
  id           String   @id @default(cuid())
  sha256Hash   String   @unique
  event        String
  instance     String
  rawPayload   Json
  payloadBytes Int
  receivedAt   DateTime @default(now())
  processedAt  DateTime?
  processingError String?
}

model ContentBlacklist {
  // configurable by owner — keywords, competitor names, off-brand topics
  id        String   @id @default(cuid())
  term      String   @unique
  category  String   // KEYWORD | COMPETITOR | OFF_BRAND
  addedBy   String?
  createdAt DateTime @default(now())
}

model PublishToken {
  // JWT token issued after content approval, expires 2h
  id              String    @id @default(cuid())
  submissionId    String    @unique
  token           String    @unique
  expiresAt       DateTime
  usedAt          DateTime?
  createdAt       DateTime  @default(now())
}

model SimActivity {
  // SIM2 (or any SIM) SMS + call log monitoring — Device Owner permission
  id           String          @id @default(cuid())
  deviceId     String
  employeeId   String
  simSlot      Int             // 0 = SIM1, 1 = SIM2
  simNumber    String?         // phone number of the SIM if readable
  activityType SimActivityType // SMS_IN | SMS_OUT | CALL_IN | CALL_OUT | DATA_SESSION
  contactNumber String?
  content      String?         // SMS body (null for calls)
  durationSecs Int?            // call duration
  timestamp    DateTime
  isFlagged    Boolean         @default(false)
  flagReason   String?
  createdAt    DateTime        @default(now())

  @@index([deviceId, timestamp])
  @@index([employeeId])
  @@index([isFlagged])
  @@index([simSlot])
}

model AppActivity {
  // foreground app tracking — which app employee used and for how long
  id           String   @id @default(cuid())
  deviceId     String
  employeeId   String
  packageName  String   // e.g. com.whatsapp, com.instagram.android
  appLabel     String?  // human-readable name
  startedAt    DateTime
  endedAt      DateTime?
  durationSecs Int?
  isSuspicious Boolean  @default(false) // if package in suspicious list
  createdAt    DateTime @default(now())

  @@index([deviceId, startedAt])
  @@index([packageName])
  @@index([isSuspicious])
}

model MarketingMessage {
  // outgoing SMS/email marketing — logged before send
  id            String              @id @default(cuid())
  deviceId      String
  employeeId    String
  channel       MarketingChannel    // SMS | EMAIL
  recipients    String[]            // list of phone/email addresses
  content       String
  subject       String?             // email subject
  sentAt        DateTime
  recipientCount Int
  isFlagged     Boolean             @default(false)
  flagReason    String?             // e.g. "contains personal client list"
  sha256Hash    String              // content hash for evidence
  createdAt     DateTime            @default(now())

  @@index([deviceId])
  @@index([employeeId])
  @@index([sentAt])
}

model IntegrityRecord {
  // monthly integrity score + bonus calculation
  id              String   @id @default(cuid())
  employeeId      String
  period          String   // "2026-06" format
  violationCount  Int      @default(0)
  bonusAmount     Decimal  @db.Decimal(10, 2) @default(0)
  integrityPoints Int      @default(0) // accumulates month to month
  bonusPaid       Boolean  @default(false)
  bonusPaidAt     DateTime?
  notes           String?
  createdAt       DateTime @default(now())

  @@unique([employeeId, period])
  @@index([employeeId])
  @@index([period])
}
```

### 4.2 Model Updates

**Device** — add:
- `androidId String? @unique`
- `fingerprint String?`
- `deviceTokenHash String?` (bcrypt hash — raw token only on device)
- `linkedAt DateTime?`
- `provisionToken String?` (one-time, cleared after use)

**Message (WaMessage)** — add:
- `deletedAt DateTime?` (when WhatsApp deletion detected)
- `deletedDetectedAt DateTime?` (when our system detected it)
- `messageStatus String?` (SENT|DELIVERED|READ|PLAYED|DELETED)
- `deviceId String?` (link to sending device)

**ContentSubmission** — add:
- `publishToken String?`
- `publishTokenExpiresAt DateTime?`
- `deletedExternallyAt DateTime?`
- `autoCheckResult Json?` (keyword hits, competitor hits, off-brand score)
- `caption String?`

**Creator** — add:
- `utmCode String? @unique`
- `waNumber String?`
- `brandScore Int @default(100)`

**Alert** — add:
- `evidenceLinks String[]` (array of EvidenceFile IDs)
- `recommendedAction String?`
- `deviceId String?`

### 4.3 New Enums

```prisma
enum KnownLocationType  { WAREHOUSE CLIENT APPROVED_STOP }
enum GpsAnomalyType     { LONG_STOP ROUTE_DEVIATION OFFLINE }
enum SimActivityType    { SMS_IN SMS_OUT CALL_IN CALL_OUT DATA_SESSION }
enum MarketingChannel   { SMS EMAIL }

// Extend AlertType with:
FACTORY_RESET_ATTEMPT
MESSAGE_DELETED
UNPAID_SALE_DETECTED
DUPLICATE_IMEI
CONTENT_PUBLISHED_WITHOUT_TOKEN
CONTENT_DELETED_EXTERNALLY
COMMISSION_DISCREPANCY
SIM2_SUSPICIOUS_CONTACT
PERSONAL_WA_VIOLATION
MARKETING_DATA_MISUSE
```

### 4.4 New Service: services/sim-monitor

**Role:** Reads SIM2 activity (SMS + calls) as Device Owner. Flags suspicious contacts.

**Android side (agent):**
- `READ_SMS` + `READ_CALL_LOG` permissions granted as Device Owner (no user prompt needed)
- Polls every 60s via `ContentResolver` for new SMS/calls across all SIM slots
- Sends batch to `POST /api/v1/sim-activity` (encrypted)

**Server side (new routes in api service):**
- `POST /api/v1/sim-activity` → store `SimActivity` records → check against known suspicious numbers
- Suspicious = number appears in competitor blacklist OR never appeared in any sale/client record
- If SIM2 activity detected to competitor number → Alert(HIGH, SIM2_SUSPICIOUS_CONTACT) + evidence

### 4.5 New Service: services/app-monitor (part of agent, stored via api)

**Role:** Track which apps are open and for how long (UsageStatsManager).

**Android side:**
- `PACKAGE_USAGE_STATS` permission granted as Device Owner
- Every 5min: read `UsageStatsManager.queryUsageStats()` → send to `POST /api/v1/app-activity`
- Personal WhatsApp (`com.whatsapp`) usage: log open time, duration, notification count
- Suspicious apps (per configurable list): flag immediately

**Why this works for personal WhatsApp monitoring:**
We can't read personal WhatsApp message content directly (end-to-end encrypted).
But we CAN log: when the app was opened, for how long, notification metadata (via `NotificationListenerService` as Device Owner).
This is sufficient to show "employee used personal WhatsApp at 14:32 for 23 minutes during work hours" — legally significant.

### 4.6 Reward Engine (part of creator-module or new integrity-engine)

**Monthly job (runs on 1st of each month):**
```
For each active employee:
  violations = count Violation records this month
  integrityPoints = max(0, 100 - violations × 10)
  
  if violations == 0:
    bonus = baseSalary × bonusRate (configurable per role)
    create IntegrityRecord { bonusAmount, integrityPoints: +2 }
  else:
    create IntegrityRecord { bonusAmount: 0, integrityPoints: -10 per violation }
  
  if integrityPoints accumulated >= threshold → notify owner for promotion
```

---

## 5. Service Specifications

### 5.1 services/api — Central Gateway

**Role:** Single entry point for all clients (devices + dashboard).

**New additions to existing service:**
- Socket.io server (same Express app, same port 4000)
- Rooms: `alerts`, `gps-live`, `messages`, `content`
- Events emitted: `alert:new`, `gps:update`, `message:new`, `content:submitted`
- `POST /api/v1/gps/location` — main device ingestion endpoint (renamed from /track)
- `POST /api/v1/devices/heartbeat` — 5-min device status ping
- Routes for `KnownLocation` CRUD (admin only)

**Auth flow (NextAuth integration):**
- Dashboard calls NextAuth → NextAuth calls `POST /api/v1/auth/login` → stores API access token in NextAuth session
- All dashboard API calls: NextAuth session token used as Bearer
- Device calls: device token (AES-256 encrypted payload) — separate middleware

---

### 5.2 services/whatsapp-logger — Webhook Receiver

**Flow (complete rewrite of existing stub):**

```
POST /webhook/whatsapp
  │
  ├─ [sync, <5ms]  Verify HMAC signature
  ├─ [sync, <10ms] SHA-256 raw payload → INSERT RawWebhookEvent (immutable)
  ├─ [sync, <5ms]  Enqueue to Bull queue 'whatsapp:events'
  └─ [sync]        Return 200 ← total must be <200ms
  
Bull Worker:
  ├─ Parse event type
  ├─ messages.upsert  → store Message, detect employee by JID
  ├─ messages.update  → detect deletion (protocolMessage.type=0)
  │     └─ if deleted: flag Message.deletedAt + alert (HIGH) + Socket.io emit
  ├─ stories.upsert   → store as Message (type=STORY)
  ├─ If media: enqueue 'whatsapp:media' job (HIGH priority, media expires)
  └─ Run flag checker (Arabic+French violation patterns)

Media Worker (separate queue, concurrency=3):
  ├─ Download from Evolution API /message/downloadMediaMessage/{instance}
  ├─ Store in MinIO (evidence-vault bucket)
  └─ Update Message.mediaHash + Message.mediaLocalPath
```

**Immutability:** No DELETE or UPDATE routes. `RawWebhookEvent` is insert-only.

---

### 5.3 services/gps-engine — GPS + Anomaly Detection

**Ingestion:** Devices call `services/api` → API stores in DB and emits `gps:update` via Socket.io + publishes to Redis channel `gps:raw`.

**GPS Engine** subscribes to Redis, runs Bull jobs every 60s:

```
Job: anomaly-detector
  For each active device:
    ├─ LONG_STOP: last 20+ points within 200m radius + outside all KnownLocations → GpsAnomaly(LONG_STOP) + Alert(HIGH)
    ├─ OFFLINE: lastSeenAt > 15min during work hours (08:00-19:00 +01:00) → Alert(MEDIUM)
    └─ ROUTE_DEVIATION: compare path vs expected delivery route → Alert(HIGH)
      (expected route = straight-line corridor between KnownLocations assigned to employee)
```

**Endpoints:**
- `GET /live` → all active devices, last position, employee info, anomaly status
- `GET /replay/:deviceId/:date` → full chronological array for PDF route
- `GET /export/:deviceId/:date` → generate PDF (puppeteer/html-pdf) with route map + stats

---

### 5.4 services/content-guard — Content Approval Engine

**Submission flow:**

```
POST /submit { creatorId, contentUrl, caption, platform }
  │
  ├─ [Step 1] Archive to evidence-vault (screenshot + metadata + hash) — BEFORE any decision
  ├─ [Step 2] Automated checks:
  │     ├─ Keyword blacklist (query ContentBlacklist table)
  │     ├─ Competitor names (ContentBlacklist category=COMPETITOR)
  │     └─ Off-brand wordlist (ContentBlacklist category=OFF_BRAND)
  ├─ [Step 3] Decision:
  │     ├─ 0 hits → AUTO_APPROVED + generate PublishToken (JWT, 2h)
  │     ├─ critical hit → AUTO_REJECTED + alert (MEDIUM)
  │     └─ soft hit → NEEDS_MANUAL_REVIEW
  │           └─ WhatsApp to owner: preview link + approve/reject buttons
  └─ Return { submissionId, status, publishToken? }

POST /review/:submissionId { decision: approve|reject, reviewerNote? }
  ├─ APPROVED → generate PublishToken (JWT, 2h, signed with CONTENT_TOKEN_SECRET)
  └─ REJECTED → notify creator

Background job (every 5min):
  For each APPROVED submission with publishedUrl:
    ├─ HTTP HEAD request to publishedUrl
    ├─ If 404/410 → flag deletedExternallyAt + archive deletion evidence + Alert(CRITICAL)
    └─ Update engagement stats (views/likes) if platform API available
```

---

### 5.5 services/mdm-service — Android Enterprise MDM

**QR Provisioning payload** (generated by `POST /provision/generate`):

```json
{
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
    "ma.yourcompany.fieldops/ma.yourcompany.fieldops.DeviceAdminReceiver",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
    "https://cdn.yourcompany.ma/agent-latest.apk",
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
    "<BASE64URL_SHA256_APK_CERT>",
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
  "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": false,
  "android.app.extra.PROVISIONING_WIFI_SSID": "${PROVISIONING_WIFI_SSID}",
  "android.app.extra.PROVISIONING_WIFI_PASSWORD": "${PROVISIONING_WIFI_PASSWORD}",
  "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "server_url": "${API_URL}",
    "provision_token": "<ONE_TIME_TOKEN>",
    "company_id": "fieldops"
  }
}
```

**Server routes:**
- `POST /provision/generate` → create one-time provisionToken in Redis (24h TTL) → encode QR → return PNG
- `POST /provision/complete` → device sends {imei, androidId, fingerprint, provisionToken} → validate token → create Device record → return encrypted deviceToken
- Duplicate IMEI → reject + Alert(CRITICAL, DUPLICATE_IMEI)
- `POST /device/heartbeat` → update lastSeenAt, battery, appVersion, activeApps
- `POST /device/factory-reset-attempt` → receive last snapshot → store in evidence vault → Alert(CRITICAL, FACTORY_RESET_ATTEMPT) → emit Socket.io event

**Android agent requirements (native):**
- `DeviceAdminReceiver` registered in `AndroidManifest.xml`
- Hidden from launcher (`<category android:name="android.intent.category.LAUNCHER"/>` removed)
- Persistent foreground service (priority=max, `BOOT_COMPLETED` receiver)
- AES-256-GCM payload encryption using deviceToken as key seed (HKDF derivation)
- `DeviceAdminReceiver.onDisableRequested()` → trigger factory reset alert before allowing

---

### 5.6 services/alert-engine — Cross-Service Anomaly Detection

**Consumes events via Redis pub/sub channels:**

| Channel | Trigger | Alert |
|---------|---------|-------|
| `wa:message:deleted` | Message deleted <10min after send | HIGH |
| `wa:sale:detected` | Sale keyword in WA, not in Sales DB within 30min | HIGH |
| `gps:anomaly` | Anomaly from gps-engine | MEDIUM/HIGH |
| `content:published:no-token` | Published URL with no valid PublishToken | CRITICAL |
| `device:offline` | No heartbeat 15min during work hours | MEDIUM |
| `device:factory-reset` | Factory reset attempt received | CRITICAL |
| `mdm:duplicate-imei` | Same IMEI re-provision attempt | CRITICAL |
| `commission:discrepancy` | Creator commission >5% discrepancy | MEDIUM |

**Each alert:**
1. Insert `Alert` record (immutable — no delete route)
2. WhatsApp to owner via Evolution API
3. Emit `alert:new` via Socket.io
4. Include `evidenceLinks[]` and `recommendedAction`

---

### 5.7 services/creator-module — UTM + Commission Engine

- Each creator: `utmCode` (unique, e.g. `UTM-YOUSSEF-2024`) + `waNumber` (dedicated WA number)
- `POST /sale/utm` → UTM param in request → auto-attribute sale to creator → calculate commission
- `POST /sale/whatsapp` → waNumber match → attribute sale
- Brand score: starts 100, -10/violation, +5/approved content, +2/clean month
- `GET /leaderboard` → ranked by (sales × brandScore)
- `GET /creator/:id/report` → PDF: sales history, commissions, content, brand timeline

---

### 5.8 apps/dashboard — Next.js 14

**Auth:** NextAuth.js v5 with Credentials provider. Single owner account in `.env` (`OWNER_EMAIL`, `OWNER_PASSWORD_HASH`). All routes protected by `middleware.ts`.

**Pages:**

| Route | Content |
|-------|---------|
| `/` | Live overview: device map (Leaflet), today sales, pending approvals, open alerts — all real-time Socket.io |
| `/whatsapp` | All WA conversations by employee, deleted messages shown with 🔴 indicator, media preview |
| `/sales` | Sales board: auto-detected + manual, chart vs ad spend, filter employee/date/product |
| `/gps` | Leaflet live map all devices + click → today route + anomalies highlighted + replay mode |
| `/content` | Approval queue (pending first) + history + brand score per creator + approve/reject buttons |
| `/creators` | Commission dashboard, leaderboard, UTM analytics, PDF export per creator |
| `/evidence` | Searchable vault: filter by employee/date/type, SHA-256 verify button, download, legal PDF |
| `/alerts` | All alerts with severity badges + evidence links + recommended action + resolve button |
| `/devices` | MDM panel: status, last seen, battery, app version, kill-switch button, re-provision QR |

**Real-time Socket.io events received:**
- `alert:new` → toast notification + update alerts page
- `gps:update` → move device marker on map
- `message:new` → update WhatsApp page badge
- `content:submitted` → update content queue count

---

### 5.9 apps/agent — Bare React Native Android

**Key capabilities:**
- Device Owner via Android Enterprise QR provisioning
- Hidden from launcher
- Persistent foreground service (survives reboot via `BOOT_COMPLETED`)
- AES-256-GCM encrypted payloads (per-device key from deviceToken)
- Every 30s: GPS + battery + active app + network type → `POST /api/v1/gps/location`
- Every 60s: SIM activity poll → `READ_SMS` + `READ_CALL_LOG` → `POST /api/v1/sim-activity`
- Every 5min: heartbeat + app usage stats → `POST /api/v1/devices/heartbeat`
- Every 5min: `UsageStatsManager` → `POST /api/v1/app-activity` (app open/close events)
- `NotificationListenerService` → capture WhatsApp notification metadata (sender hash, time) — no message content
- Factory reset interception → `DeviceAdminReceiver.onDisableRequested()` → snapshot upload → Alert(CRITICAL)
- No visible UI after provisioning (status bar notification only, required by Android)
- All data encrypted AES-256-GCM before transmission

---

## 6. Storage Architecture

```
MinIO (self-hosted on VPS — Coolify managed)
├── bucket: fieldops-evidence  (WORM policy — write-once, read-many, NO delete API exposed)
│     ├── whatsapp-media/{year}/{month}/{day}/{sha256}.{ext}
│     ├── whatsapp-raw-events/{date}/{eventId}.json
│     ├── content-submissions/{submissionId}/{sha256}.{ext}
│     ├── device-snapshots/{deviceId}/{timestamp}.json.aes  (encrypted)
│     ├── sim-activity/{deviceId}/{date}/{sha256}.json
│     ├── app-activity/{deviceId}/{date}/{sha256}.json
│     ├── marketing-messages/{employeeId}/{date}/{sha256}.json
│     └── gps-routes/{deviceId}/{date}/route.json
└── bucket: fieldops-apk  (public read — for Android Enterprise QR provisioning)
      ├── agent-latest.apk
      └── agent-{version}.apk
```

---

## 7. Security

| Layer | Mechanism |
|-------|-----------|
| Device ↔ API | HTTPS + AES-256-GCM payload encryption (per-device key via HKDF) |
| deviceToken | bcrypt-hashed in DB — raw token only in device EncryptedSharedPreferences |
| Dashboard | NextAuth httpOnly cookie session, rate-limited, single owner only |
| Evidence vault | MinIO WORM bucket — no delete API exposed, SHA-256 integrity check |
| Internal services | `X-Internal-Secret` HMAC header |
| Webhook | HMAC-SHA256 signature from Evolution API |

---

## 8. docker-compose Services

| Container | Image | Port |
|-----------|-------|------|
| postgres | postgres:16-alpine | 5432 |
| redis | redis:7-alpine | 6379 |
| minio | minio/minio | 9000/9001 |
| postgres | postgres:16-alpine | 5432 |
| redis | redis:7-alpine | 6379 |
| minio | minio/minio | 9000/9001 |
| api | fieldops/api | 4000 |
| whatsapp-logger | fieldops/whatsapp-logger | 4001 |
| content-guard | fieldops/content-guard | 4002 |
| evidence-vault | fieldops/evidence-vault | 4003 |
| gps-engine | fieldops/gps-engine | 4004 |
| mdm-service | fieldops/mdm-service | 4005 |
| alert-engine | fieldops/alert-engine | 4006 |
| creator-module | fieldops/creator-module | 4007 |
| dashboard | fieldops/dashboard | 3000 |

---

## 9. Implementation Order (Final — 15 steps)

### Phase 1 — Foundation
1. **packages/db** — complete schema rewrite with all new models + enums + field additions
2. **docker-compose.yml** — add MinIO service with WORM bucket init
3. **packages/shared** — Socket.io event types, MinIO client util, AES-256-GCM crypto util, Redis pub/sub helpers

### Phase 2 — Core Services
4. **services/api** — add Socket.io server, SimActivity routes, AppActivity routes, KnownLocation CRUD, MarketingMessage routes
5. **services/evidence-vault** — complete rewrite: MinIO client, WORM policy, SHA-256 dedup, no-delete enforcement
6. **services/whatsapp-logger** — complete rewrite: BullMQ + RawWebhookEvent (immutable) + media download via Evolution API + delete detection + Redis pub/sub emit

### Phase 3 — Intelligence Services
7. **services/gps-engine** — KnownLocation-aware stop detection + route deviation + offline detection + replay/export PDF
8. **services/mdm-service** — Android Enterprise QR generation + duplicate IMEI alert + factory reset handling + device heartbeat
9. **services/content-guard** — URL submission + automated blacklist checks + publish token + external deletion monitor
10. **services/alert-engine** — Redis pub/sub consumers for all 11 alert types + WhatsApp delivery + Socket.io emit + immutable storage
11. **services/creator-module** — UTM attribution + waNumber matching + brand score calculation + integrity bonus engine + PDF report

### Phase 4 — Frontend
12. **apps/dashboard** — NextAuth v5 (credentials, single owner) + all 9 pages + Socket.io real-time + Leaflet maps

### Phase 5 — Mobile Agent
13. **apps/agent** — Bare React Native:
    - `DeviceAdminReceiver` + `DevicePolicyManager` (Device Owner)
    - Hidden from launcher (manifest)
    - Persistent foreground service + `BOOT_COMPLETED` receiver
    - AES-256-GCM encrypted uploads
    - GPS every 30s
    - SIM activity poll every 60s (`READ_SMS` + `READ_CALL_LOG`)
    - App usage every 5min (`UsageStatsManager`)
    - `NotificationListenerService` for WA notification metadata
    - Factory reset interception (`onDisableRequested`)
    - Marketing SMS intercept (`SMS_SENT` broadcast)

### Phase 6 — Integration & Deployment
14. **scripts/** — setup.sh update, MinIO bucket init script, APK signing + upload script
15. **.env.example** — add all new variables (MinIO, CONTENT_TOKEN_SECRET, MINIO_APK_BUCKET, etc.)
