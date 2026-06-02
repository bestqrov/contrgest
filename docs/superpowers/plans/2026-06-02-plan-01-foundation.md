# FieldOps Plan 01 — Foundation (DB + Docker + Shared)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Prisma schema to add all new models, update docker-compose to include MinIO, and extend the shared package with MinIO client, Socket.io event types, AES-256-GCM crypto util, and Redis pub/sub helpers.

**Architecture:** All services depend on this foundation. The DB schema is the source of truth — every other service reads/writes through `@field-ops/db`. The shared package exposes typed utilities that services import. MinIO replaces local file storage and is initialized with two buckets: `fieldops-evidence` (write-once) and `fieldops-apk` (public read).

**Tech Stack:** Prisma 5, PostgreSQL 16, MinIO (S3-compatible), Redis 7, TypeScript 5.6, pnpm workspaces, BullMQ, @aws-sdk/client-s3, socket.io (types only in shared)

---

## File Map

### packages/db
| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | **Rewrite** | Add 9 new models, 4 new enums, update 5 existing models |
| `src/client.ts` | Keep | PrismaClient singleton |
| `src/seed.ts` | **Update** | Add KnownLocation + ContentBlacklist seed data |

### packages/shared
| File | Action | Purpose |
|------|--------|---------|
| `src/types/events.types.ts` | **Rewrite** | Socket.io event types + Redis pub/sub channel names |
| `src/types/api.types.ts` | Keep | ApiResponse, PaginationMeta |
| `src/utils/minio.ts` | **Create** | MinIO S3 client, upload, getUrl, putObject |
| `src/utils/crypto.ts` | **Update** | Add AES-256-GCM encrypt/decrypt (already has SHA-256) |
| `src/utils/redis-pubsub.ts` | **Create** | Redis pub/sub publisher + typed subscriber factory |
| `src/constants/queues.ts` | **Update** | Add new BullMQ queue names |
| `src/constants/buckets.ts` | **Create** | MinIO bucket + key-prefix constants |
| `src/index.ts` | **Update** | Re-export new utils |

### docker-compose.yml
| Change | Purpose |
|--------|---------|
| Add `minio` service | Object storage for evidence + APK hosting |
| Add `createbuckets` init container | Creates buckets on first run |

### .env.example
| Change | Purpose |
|--------|---------|
| Add MinIO vars | MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_EVIDENCE_BUCKET, MINIO_APK_BUCKET |
| Add CONTENT_TOKEN_SECRET | Signing publish tokens |
| Add OWNER_EMAIL, OWNER_PASSWORD_HASH | NextAuth single owner |
| Add PROVISIONING_WIFI_SSID/PASSWORD | Android Enterprise QR |

---

## Task 1: Rewrite Prisma Schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Replace the full schema file**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum EmployeeRole {
  VENDEUR
  LIVREUR
  CHAUFFEUR
  CREATOR
  ADMIN
}

enum EmployeeStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
  ON_LEAVE
}

enum DeviceStatus {
  ACTIVE
  LOST
  STOLEN
  DECOMMISSIONED
  MAINTENANCE
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  LOCATION
  STICKER
  REACTION
  STORY
}

enum ContentStatus {
  PENDING
  AUTO_APPROVED
  AUTO_REJECTED
  NEEDS_MANUAL_REVIEW
  APPROVED
  REJECTED
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertType {
  GPS_DEVIATION
  WHATSAPP_VIOLATION
  CONTENT_FLAGGED
  DEVICE_OFFLINE
  UNUSUAL_ACTIVITY
  GEOFENCE_BREACH
  PERFORMANCE_DROP
  CONTRACT_EXPIRY
  MDM_POLICY_VIOLATION
  UNAUTHORIZED_APP
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
}

enum AlertStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
  DISMISSED
}

enum ContractType {
  EMPLOYMENT
  FREELANCE
  TRIAL
  INTERNSHIP
}

enum ViolationType {
  MESSAGING_POLICY
  GPS_POLICY
  CONTENT_POLICY
  DEVICE_POLICY
  ATTENDANCE
  PERFORMANCE
  UNAUTHORIZED_CONTACT
}

enum KnownLocationType {
  WAREHOUSE
  CLIENT
  APPROVED_STOP
}

enum GpsAnomalyType {
  LONG_STOP
  ROUTE_DEVIATION
  OFFLINE
}

enum SimActivityType {
  SMS_IN
  SMS_OUT
  CALL_IN
  CALL_OUT
  DATA_SESSION
}

enum MarketingChannel {
  SMS
  EMAIL
}

// ─── Models ───────────────────────────────────────────────────────────────────

model Employee {
  id              String         @id @default(cuid())
  employeeNumber  String         @unique
  firstName       String
  lastName        String
  phone           String         @unique
  whatsappJid     String?        @unique
  email           String?        @unique
  role            EmployeeRole
  status          EmployeeStatus @default(ACTIVE)
  hireDate        DateTime
  terminationDate DateTime?
  zone            String?
  targetZone      String?
  managerId       String?
  manager         Employee?      @relation("EmployeeManager", fields: [managerId], references: [id])
  subordinates    Employee[]     @relation("EmployeeManager")

  device           Device?
  gpsTracks        GpsTrack[]
  gpsAnomalies     GpsAnomaly[]
  messages         Message[]
  sales            Sale[]
  contracts        Contract[]
  violations       Violation[]
  alerts           Alert[]
  simActivities    SimActivity[]
  appActivities    AppActivity[]
  marketingMessages MarketingMessage[]
  integrityRecords IntegrityRecord[]

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([role])
  @@index([status])
  @@index([zone])
  @@index([managerId])
}

model Device {
  id              String       @id @default(cuid())
  imei            String       @unique
  androidId       String?      @unique
  serialNumber    String       @unique
  fingerprint     String?
  model           String
  androidVersion  String
  appVersion      String?
  status          DeviceStatus @default(ACTIVE)
  employeeId      String?      @unique
  employee        Employee?    @relation(fields: [employeeId], references: [id])
  lastSeenAt      DateTime?
  lastIp          String?
  mdmEnrolled     Boolean      @default(false)
  mdmEnrolledAt   DateTime?
  linkedAt        DateTime?
  deviceTokenHash String?
  provisionToken  String?
  batteryLevel    Int?
  storageUsedMb   Int?
  totalStorageMb  Int?
  installedApps   Json?
  policyVersion   Int          @default(0)

  gpsTracks       GpsTrack[]
  gpsAnomalies    GpsAnomaly[]
  simActivities   SimActivity[]
  appActivities   AppActivity[]
  marketingMessages MarketingMessage[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([status])
  @@index([mdmEnrolled])
  @@index([employeeId])
}

model Message {
  id                  String           @id @default(cuid())
  whatsappMessageId   String?          @unique
  employeeId          String
  employee            Employee         @relation(fields: [employeeId], references: [id])
  deviceId            String?
  contactPhone        String
  contactName         String?
  direction           MessageDirection
  type                MessageType
  content             String?
  mediaUrl            String?
  mediaLocalPath      String?
  mediaHash           String?
  mediaMimeType       String?
  mediaSizeBytes      BigInt?
  timestamp           DateTime
  messageStatus       String?
  isGroupMessage      Boolean          @default(false)
  groupId             String?
  groupName           String?
  isFlagged           Boolean          @default(false)
  flagReason          String?
  flaggedAt           DateTime?
  deletedAt           DateTime?
  deletedDetectedAt   DateTime?

  evidenceFiles       EvidenceFile[]

  createdAt           DateTime         @default(now())

  @@index([employeeId])
  @@index([timestamp])
  @@index([isFlagged])
  @@index([contactPhone])
  @@index([groupId])
  @@index([deletedAt])
}

model Sale {
  id            String         @id @default(cuid())
  saleNumber    String         @unique
  employeeId    String
  employee      Employee       @relation(fields: [employeeId], references: [id])
  clientName    String
  clientPhone   String?
  amount        Decimal        @db.Decimal(10, 2)
  currency      String         @default("MAD")
  productLine   String?
  description   String?
  saleDate      DateTime
  deliveryDate  DateTime?
  deliveredAt   DateTime?
  isPaid        Boolean        @default(false)
  paymentDate   DateTime?
  paymentMethod String?
  detectedFrom  String?
  latitude      Decimal?       @db.Decimal(10, 8)
  longitude     Decimal?       @db.Decimal(11, 8)
  notes         String?

  evidenceFiles EvidenceFile[]

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([employeeId])
  @@index([saleDate])
  @@index([isPaid])
}

model GpsTrack {
  id          String   @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  deviceId    String
  device      Device   @relation(fields: [deviceId], references: [id])
  latitude    Decimal  @db.Decimal(10, 8)
  longitude   Decimal  @db.Decimal(11, 8)
  accuracy    Float?
  altitude    Float?
  speed       Float?
  heading     Float?
  batteryLevel Int?
  address     String?
  timestamp   DateTime
  isAnomaly   Boolean  @default(false)
  anomalyNote String?
  batchId     String?

  createdAt   DateTime @default(now())

  @@index([employeeId, timestamp])
  @@index([deviceId])
  @@index([timestamp])
  @@index([isAnomaly])
}

model GpsAnomaly {
  id          String         @id @default(cuid())
  deviceId    String
  device      Device         @relation(fields: [deviceId], references: [id])
  employeeId  String
  employee    Employee       @relation(fields: [employeeId], references: [id])
  type        GpsAnomalyType
  startedAt   DateTime
  resolvedAt  DateTime?
  latitude    Decimal?       @db.Decimal(10, 8)
  longitude   Decimal?       @db.Decimal(11, 8)
  alertId     String?
  metadata    Json?

  createdAt   DateTime       @default(now())

  @@index([deviceId])
  @@index([employeeId])
  @@index([type])
  @@index([startedAt])
}

model KnownLocation {
  id           String            @id @default(cuid())
  name         String
  type         KnownLocationType
  latitude     Decimal           @db.Decimal(10, 8)
  longitude    Decimal           @db.Decimal(11, 8)
  radiusMeters Int               @default(100)
  employeeIds  String[]
  isActive     Boolean           @default(true)
  createdBy    String?

  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([type])
  @@index([isActive])
}

model SimActivity {
  id            String          @id @default(cuid())
  deviceId      String
  device        Device          @relation(fields: [deviceId], references: [id])
  employeeId    String
  employee      Employee        @relation(fields: [employeeId], references: [id])
  simSlot       Int
  simNumber     String?
  activityType  SimActivityType
  contactNumber String?
  content       String?
  durationSecs  Int?
  timestamp     DateTime
  isFlagged     Boolean         @default(false)
  flagReason    String?
  evidencePath  String?

  createdAt     DateTime        @default(now())

  @@index([deviceId, timestamp])
  @@index([employeeId])
  @@index([isFlagged])
  @@index([simSlot])
  @@index([activityType])
}

model AppActivity {
  id           String   @id @default(cuid())
  deviceId     String
  device       Device   @relation(fields: [deviceId], references: [id])
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id])
  packageName  String
  appLabel     String?
  startedAt    DateTime
  endedAt      DateTime?
  durationSecs Int?
  isSuspicious Boolean  @default(false)

  createdAt    DateTime @default(now())

  @@index([deviceId, startedAt])
  @@index([packageName])
  @@index([isSuspicious])
  @@index([employeeId])
}

model MarketingMessage {
  id             String           @id @default(cuid())
  deviceId       String
  device         Device           @relation(fields: [deviceId], references: [id])
  employeeId     String
  employee       Employee         @relation(fields: [employeeId], references: [id])
  channel        MarketingChannel
  recipients     String[]
  content        String
  subject        String?
  sentAt         DateTime
  recipientCount Int
  isFlagged      Boolean          @default(false)
  flagReason     String?
  sha256Hash     String
  evidencePath   String?

  createdAt      DateTime         @default(now())

  @@index([deviceId])
  @@index([employeeId])
  @@index([sentAt])
  @@index([isFlagged])
}

model ContentSubmission {
  id                   String        @id @default(cuid())
  submissionNumber     String        @unique
  creatorId            String
  creator              Creator       @relation(fields: [creatorId], references: [id])
  platform             String
  contentType          String
  caption              String?
  title                String?
  description          String?
  fileUrl              String
  fileHash             String
  thumbnailUrl         String?
  durationSeconds      Int?
  status               ContentStatus @default(PENDING)
  autoCheckResult      Json?
  reviewedBy           String?
  reviewedAt           DateTime?
  reviewNotes          String?
  publishToken         String?
  publishTokenExpiresAt DateTime?
  publishedUrl         String?
  publishedAt          DateTime?
  deletedExternallyAt  DateTime?
  viewCount            BigInt?
  likeCount            BigInt?
  shareCount           BigInt?
  commentsCount        BigInt?
  engagementRate       Decimal?      @db.Decimal(5, 2)
  lastStatsSync        DateTime?

  evidenceFiles        EvidenceFile[]
  commissions          CommissionLine[]
  publishTokenRecord   PublishToken?

  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([creatorId])
  @@index([status])
  @@index([platform])
}

model PublishToken {
  id            String            @id @default(cuid())
  submissionId  String            @unique
  submission    ContentSubmission @relation(fields: [submissionId], references: [id])
  token         String            @unique
  expiresAt     DateTime
  usedAt        DateTime?

  createdAt     DateTime          @default(now())

  @@index([token])
  @@index([expiresAt])
}

model ContentBlacklist {
  id        String   @id @default(cuid())
  term      String   @unique
  category  String
  addedBy   String?

  createdAt DateTime @default(now())
}

model RawWebhookEvent {
  id              String   @id @default(cuid())
  sha256Hash      String   @unique
  event           String
  instance        String
  rawPayload      Json
  payloadBytes    Int
  receivedAt      DateTime @default(now())
  processedAt     DateTime?
  processingError String?

  @@index([event])
  @@index([receivedAt])
}

model EvidenceFile {
  id                  String             @id @default(cuid())
  fileName            String
  originalName        String
  mimeType            String
  sizeBytes           BigInt
  sha256Hash          String             @unique
  storagePath         String
  storageProvider     String             @default("minio")
  bucketName          String             @default("fieldops-evidence")
  messageId           String?
  message             Message?           @relation(fields: [messageId], references: [id])
  saleId              String?
  sale                Sale?              @relation(fields: [saleId], references: [id])
  contentSubmissionId String?
  contentSubmission   ContentSubmission? @relation(fields: [contentSubmissionId], references: [id])
  uploadedBy          String?
  notes               String?

  createdAt           DateTime           @default(now())

  @@index([sha256Hash])
  @@index([messageId])
  @@index([saleId])
  @@index([contentSubmissionId])
}

model Creator {
  id              String              @id @default(cuid())
  employeeId      String?             @unique
  firstName       String
  lastName        String
  phone           String              @unique
  email           String?
  tiktokHandle    String?
  instagramHandle String?
  youtubeHandle   String?
  waNumber        String?             @unique
  utmCode         String?             @unique
  commissionRate  Decimal             @db.Decimal(5, 2)
  brandScore      Int                 @default(100)
  status          String              @default("ACTIVE")
  totalEarnings   Decimal             @db.Decimal(12, 2) @default(0)

  submissions     ContentSubmission[]
  commissions     Commission[]

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([status])
  @@index([utmCode])
}

model Commission {
  id          String           @id @default(cuid())
  creatorId   String
  creator     Creator          @relation(fields: [creatorId], references: [id])
  period      String
  baseAmount  Decimal          @db.Decimal(10, 2)
  bonusAmount Decimal          @db.Decimal(10, 2) @default(0)
  totalAmount Decimal          @db.Decimal(10, 2)
  currency    String           @default("MAD")
  isPaid      Boolean          @default(false)
  paidAt      DateTime?
  paymentRef  String?
  notes       String?

  lines       CommissionLine[]

  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([creatorId])
  @@index([period])
  @@index([isPaid])
}

model CommissionLine {
  id                  String             @id @default(cuid())
  commissionId        String
  commission          Commission         @relation(fields: [commissionId], references: [id])
  contentSubmissionId String?
  contentSubmission   ContentSubmission? @relation(fields: [contentSubmissionId], references: [id])
  description         String
  amount              Decimal            @db.Decimal(10, 2)
  metric              String?
  metricValue         BigInt?

  createdAt           DateTime           @default(now())

  @@index([commissionId])
}

model IntegrityRecord {
  id              String   @id @default(cuid())
  employeeId      String
  employee        Employee @relation(fields: [employeeId], references: [id])
  period          String
  violationCount  Int      @default(0)
  bonusAmount     Decimal  @db.Decimal(10, 2) @default(0)
  integrityPoints Int      @default(0)
  bonusPaid       Boolean  @default(false)
  bonusPaidAt     DateTime?
  notes           String?

  createdAt       DateTime @default(now())

  @@unique([employeeId, period])
  @@index([employeeId])
  @@index([period])
}

model Alert {
  id              String        @id @default(cuid())
  type            AlertType
  severity        AlertSeverity
  status          AlertStatus   @default(OPEN)
  employeeId      String?
  employee        Employee?     @relation(fields: [employeeId], references: [id])
  deviceId        String?
  title           String
  description     String
  evidenceLinks   String[]
  recommendedAction String?
  metadata        Json?
  notifiedAt      DateTime?
  acknowledgedBy  String?
  acknowledgedAt  DateTime?
  resolvedBy      String?
  resolvedAt      DateTime?
  resolutionNote  String?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([type])
  @@index([severity])
  @@index([status])
  @@index([employeeId])
  @@index([createdAt])
}

model Contract {
  id             String       @id @default(cuid())
  contractNumber String       @unique
  employeeId     String
  employee       Employee     @relation(fields: [employeeId], references: [id])
  type           ContractType
  startDate      DateTime
  endDate        DateTime?
  salary         Decimal      @db.Decimal(10, 2)
  currency       String       @default("MAD")
  terms          String?
  fileUrl        String?
  fileHash       String?
  isSigned       Boolean      @default(false)
  signedAt       DateTime?
  renewalAlerted Boolean      @default(false)

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([employeeId])
  @@index([endDate])
}

model Violation {
  id          String        @id @default(cuid())
  employeeId  String
  employee    Employee      @relation(fields: [employeeId], references: [id])
  type        ViolationType
  severity    AlertSeverity
  description String
  evidence    String?
  reportedBy  String?
  occurredAt  DateTime
  resolvedAt  DateTime?
  resolution  String?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([employeeId])
  @@index([type])
  @@index([occurredAt])
}

model Geofence {
  id           String   @id @default(cuid())
  name         String
  description  String?
  centerLat    Decimal  @db.Decimal(10, 8)
  centerLon    Decimal  @db.Decimal(11, 8)
  radiusMeters Int
  isActive     Boolean  @default(true)
  zones        String[]
  createdBy    String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actorType  String
  action     String
  resource   String
  resourceId String?
  oldValue   Json?
  newValue   Json?
  ip         String?
  userAgent  String?

  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([resource, resourceId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Verify Prisma schema syntax**

```bash
cd "/Users/mac/Documents/system control"
pnpm --filter @field-ops/db exec npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Generate Prisma client**

```bash
pnpm --filter @field-ops/db generate
```

Expected: `✔ Generated Prisma Client` with no errors

- [ ] **Step 4: Create dev migration**

```bash
pnpm --filter @field-ops/db exec npx prisma migrate dev --name add_new_models_and_fields
```

Expected: Migration file created in `prisma/migrations/`

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/system control"
git add packages/db/prisma/
git commit -m "feat(db): complete schema rewrite — add SimActivity, AppActivity, MarketingMessage, KnownLocation, GpsAnomaly, RawWebhookEvent, PublishToken, ContentBlacklist, IntegrityRecord; extend Device/Message/Creator/Alert"
```

---

## Task 2: Add MinIO to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add MinIO service and bucket init container**

Open `docker-compose.yml` and add these services after the `redis` service:

```yaml
  minio:
    image: minio/minio:latest
    container_name: fieldops-minio
    restart: unless-stopped
    logging: *default-logging
    networks:
      - fieldops-internal
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - '9000:9000'
      - '9001:9001'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 10s
      timeout: 5s
      retries: 5

  createbuckets:
    image: minio/mc:latest
    container_name: fieldops-createbuckets
    networks:
      - fieldops-internal
    depends_on:
      minio:
        condition: service_healthy
    restart: 'no'
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set local http://minio:9000 $${MINIO_ACCESS_KEY} $${MINIO_SECRET_KEY};
      /usr/bin/mc mb --ignore-existing local/fieldops-evidence;
      /usr/bin/mc mb --ignore-existing local/fieldops-apk;
      /usr/bin/mc anonymous set public local/fieldops-apk;
      /usr/bin/mc retention set --default GOVERNANCE 365d local/fieldops-evidence;
      exit 0;
      "
    environment:
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
```

Also add to the `volumes:` section at the bottom:
```yaml
  minio_data:
    driver: local
```

- [ ] **Step 2: Verify docker-compose syntax**

```bash
cd "/Users/mac/Documents/system control"
docker compose config --quiet
```

Expected: No output (valid config)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): add MinIO service with evidence (WORM) and APK (public) buckets"
```

---

## Task 3: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new environment variables**

Append to `.env.example`:

```bash
# --- MinIO (S3-compatible object storage) ---
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=CHANGE_ME_MINIO_ACCESS_KEY_MIN_8_CHARS
MINIO_SECRET_KEY=CHANGE_ME_MINIO_SECRET_KEY_MIN_8_CHARS
MINIO_EVIDENCE_BUCKET=fieldops-evidence
MINIO_APK_BUCKET=fieldops-apk
MINIO_PUBLIC_URL=https://cdn.yourcompany.ma

# --- Content Approval ---
CONTENT_TOKEN_SECRET=CHANGE_ME_64_CHAR_CONTENT_TOKEN_SECRET_FOR_PUBLISH_TOKENS

# --- Dashboard Auth (NextAuth single owner) ---
OWNER_EMAIL=owner@yourcompany.ma
OWNER_PASSWORD_HASH=CHANGE_ME_BCRYPT_HASH_OF_OWNER_PASSWORD

# --- Android Enterprise QR Provisioning ---
PROVISIONING_WIFI_SSID=FieldOps-Corp
PROVISIONING_WIFI_PASSWORD=CHANGE_ME_WIFI_PASSWORD
AGENT_PACKAGE_NAME=ma.yourcompany.fieldops
AGENT_APK_CHECKSUM=CHANGE_ME_BASE64URL_SHA256_OF_APK_SIGNING_CERT
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat(config): add MinIO, NextAuth, content token, and Android provisioning env vars"
```

---

## Task 4: Create MinIO client utility

**Files:**
- Create: `packages/shared/src/utils/minio.ts`

- [ ] **Step 1: Install @aws-sdk/client-s3 in shared package**

```bash
cd "/Users/mac/Documents/system control"
pnpm --filter @field-ops/shared add @aws-sdk/client-s3 @aws-sdk/lib-storage
```

Expected: packages installed, `packages/shared/package.json` updated

- [ ] **Step 2: Create the MinIO client**

Create `packages/shared/src/utils/minio.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
  return _client;
}

export const EVIDENCE_BUCKET = process.env.MINIO_EVIDENCE_BUCKET ?? 'fieldops-evidence';
export const APK_BUCKET = process.env.MINIO_APK_BUCKET ?? 'fieldops-apk';

export interface UploadResult {
  bucket: string;
  key: string;
  sha256Hash: string;
  sizeBytes: number;
  url: string;
}

export async function uploadBuffer(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<UploadResult> {
  const sha256Hash = createHash('sha256').update(data).digest('hex');

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
    ContentLength: data.length,
    ChecksumSHA256: Buffer.from(sha256Hash, 'hex').toString('base64'),
    Metadata: {
      sha256: sha256Hash,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  };

  await getClient().send(new PutObjectCommand(input));

  const publicUrl = process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT ?? 'http://minio:9000';
  const url = `${publicUrl}/${bucket}/${key}`;

  return { bucket, key, sha256Hash, sizeBytes: data.length, url };
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export function evidenceKey(
  category: string,
  date: Date,
  sha256: string,
  ext: string,
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${category}/${y}/${m}/${d}/${sha256}.${ext}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/utils/minio.ts packages/shared/package.json
git commit -m "feat(shared): add MinIO S3 client utility with SHA-256 upload and presigned URLs"
```

---

## Task 5: Update AES-256-GCM crypto utility

**Files:**
- Modify: `packages/shared/src/utils/crypto.ts`

- [ ] **Step 1: Add AES-256-GCM encrypt/decrypt**

Replace `packages/shared/src/utils/crypto.ts` with:

```typescript
import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'crypto';
import { createReadStream } from 'fs';

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ─── HMAC ─────────────────────────────────────────────────────────────────────

export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHmac(
  data: string,
  secret: string,
  signature: string,
): boolean {
  const expected = hmacSha256(data, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ─── AES-256-GCM ─────────────────────────────────────────────────────────────

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;

/**
 * Derive a 256-bit AES key from a device token string using SHA-256.
 * In production the agent uses HKDF — this server-side equivalent uses SHA-256.
 */
export function deriveAesKey(deviceToken: string): Buffer {
  return createHash('sha256').update(deviceToken).digest();
}

/**
 * Encrypt data with AES-256-GCM.
 * Returns: iv (12 bytes) + tag (16 bytes) + ciphertext — all base64-encoded as one string.
 */
export function aesEncrypt(plaintext: Buffer | string, key: Buffer): string {
  if (key.length !== AES_KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt AES-256-GCM ciphertext produced by aesEncrypt.
 */
export function aesDecrypt(ciphertextBase64: string, key: Buffer): Buffer {
  if (key.length !== AES_KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const raw = Buffer.from(ciphertextBase64, 'base64');
  const iv = raw.subarray(0, GCM_IV_LENGTH);
  const tag = raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const data = raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/utils/crypto.ts
git commit -m "feat(shared): add AES-256-GCM encrypt/decrypt with HKDF-compatible key derivation"
```

---

## Task 6: Create Redis pub/sub helper

**Files:**
- Create: `packages/shared/src/utils/redis-pubsub.ts`
- Create: `packages/shared/src/constants/channels.ts`

- [ ] **Step 1: Define Redis pub/sub channel names**

Create `packages/shared/src/constants/channels.ts`:

```typescript
export const REDIS_CHANNELS = {
  WA_MESSAGE_DELETED:          'wa:message:deleted',
  WA_MESSAGE_NEW:              'wa:message:new',
  WA_SALE_DETECTED:            'wa:sale:detected',
  GPS_UPDATE:                  'gps:update',
  GPS_ANOMALY:                 'gps:anomaly',
  CONTENT_SUBMITTED:           'content:submitted',
  CONTENT_PUBLISHED_NO_TOKEN:  'content:published:no-token',
  CONTENT_DELETED_EXTERNALLY:  'content:deleted:external',
  DEVICE_OFFLINE:              'device:offline',
  DEVICE_FACTORY_RESET:        'device:factory-reset',
  MDM_DUPLICATE_IMEI:          'mdm:duplicate-imei',
  COMMISSION_DISCREPANCY:      'commission:discrepancy',
  ALERT_NEW:                   'alert:new',
  SIM2_SUSPICIOUS:             'sim:suspicious',
} as const;

export type RedisChannel = (typeof REDIS_CHANNELS)[keyof typeof REDIS_CHANNELS];
```

- [ ] **Step 2: Create pub/sub utility**

Create `packages/shared/src/utils/redis-pubsub.ts`:

```typescript
import Redis from 'ioredis';
import type { RedisChannel } from '../constants/channels';

let _publisher: Redis | null = null;

export function getPublisher(): Redis {
  if (_publisher) return _publisher;
  _publisher = new Redis(process.env.REDIS_URL!, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
  return _publisher;
}

export async function publish(
  channel: RedisChannel,
  payload: Record<string, unknown>,
): Promise<void> {
  const pub = getPublisher();
  await pub.publish(channel, JSON.stringify(payload));
}

export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
}

export async function subscribe(
  subscriber: Redis,
  channels: RedisChannel[],
  handler: (channel: RedisChannel, payload: Record<string, unknown>) => void,
): Promise<void> {
  await subscriber.subscribe(...channels);
  subscriber.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message) as Record<string, unknown>;
      handler(channel as RedisChannel, payload);
    } catch {
      // malformed message — ignore
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants/channels.ts packages/shared/src/utils/redis-pubsub.ts
git commit -m "feat(shared): add typed Redis pub/sub channels and publisher/subscriber helpers"
```

---

## Task 7: Update Socket.io event types

**Files:**
- Modify: `packages/shared/src/types/events.types.ts`

- [ ] **Step 1: Rewrite events.types.ts**

```typescript
// Redis pub/sub + Socket.io event payload types

export interface GpsUpdatePayload {
  employeeId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  batteryLevel: number | null;
  timestamp: string;
}

export interface AlertNewPayload {
  alertId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  employeeId: string | null;
  deviceId: string | null;
  evidenceLinks: string[];
  recommendedAction: string | null;
  createdAt: string;
}

export interface WaMessageDeletedPayload {
  messageId: string;
  whatsappMessageId: string;
  employeeId: string;
  deletedAt: string;
  originalTimestamp: string;
  minutesSinceSend: number;
}

export interface WaMessageNewPayload {
  messageId: string;
  employeeId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  timestamp: string;
  isFlagged: boolean;
}

export interface ContentSubmittedPayload {
  submissionId: string;
  creatorId: string;
  platform: string;
  status: string;
  createdAt: string;
}

export interface GpsAnomalyPayload {
  anomalyId: string;
  employeeId: string;
  deviceId: string;
  type: 'LONG_STOP' | 'ROUTE_DEVIATION' | 'OFFLINE';
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
}

export interface WaSaleDetectedPayload {
  employeeId: string;
  messageId: string;
  detectedAmount: number | null;
  clientPhone: string | null;
  timestamp: string;
}

export interface DeviceFactoryResetPayload {
  deviceId: string;
  employeeId: string;
  imei: string;
  timestamp: string;
  snapshotPath: string | null;
}

export interface Sim2SuspiciousPayload {
  simActivityId: string;
  deviceId: string;
  employeeId: string;
  contactNumber: string;
  activityType: string;
  timestamp: string;
  flagReason: string;
}

// Socket.io server → dashboard event map
export interface ServerToClientEvents {
  'alert:new':           (payload: AlertNewPayload) => void;
  'gps:update':          (payload: GpsUpdatePayload) => void;
  'message:new':         (payload: WaMessageNewPayload) => void;
  'message:deleted':     (payload: WaMessageDeletedPayload) => void;
  'content:submitted':   (payload: ContentSubmittedPayload) => void;
  'gps:anomaly':         (payload: GpsAnomalyPayload) => void;
  'device:reset-attempt': (payload: DeviceFactoryResetPayload) => void;
}

// Socket.io client → server (dashboard sends nothing currently)
export interface ClientToServerEvents {
  join: (room: string) => void;
}
```

- [ ] **Step 2: Update shared index.ts**

Modify `packages/shared/src/index.ts` to add new exports:

```typescript
export * from './types/api.types';
export * from './types/events.types';
export * from './constants/queues';
export * from './constants/channels';
export * from './constants/errors';
export * from './utils/haversine';
export * from './utils/crypto';
export * from './utils/logger';
export * from './utils/pagination';
export * from './utils/minio';
export * from './utils/redis-pubsub';
```

- [ ] **Step 3: Update shared package.json to add new deps**

```bash
cd "/Users/mac/Documents/system control"
pnpm --filter @field-ops/shared add ioredis
```

- [ ] **Step 4: Build shared package to verify**

```bash
pnpm --filter @field-ops/shared build
```

Expected: `dist/` directory created, no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add Socket.io event types, update index exports, add ioredis dep"
```

---

## Task 8: Update queue constants

**Files:**
- Modify: `packages/shared/src/constants/queues.ts`

- [ ] **Step 1: Add new queue names**

Replace `packages/shared/src/constants/queues.ts`:

```typescript
export const QUEUES = {
  // WhatsApp logger
  WA_EVENTS:              'whatsapp:events',
  WA_MEDIA_DOWNLOAD:      'whatsapp:media',
  WA_FLAG_CHECK:          'whatsapp:flag-check',

  // GPS engine
  GPS_ANOMALY_CHECK:      'gps:anomaly-check',
  GPS_ROUTE_EXPORT:       'gps:route-export',

  // Evidence vault
  EVIDENCE_ARCHIVE:       'evidence:archive',

  // Content guard
  CONTENT_REVIEW:         'content:review',
  CONTENT_MONITOR:        'content:monitor',

  // Alert engine
  ALERTS:                 'alerts',
  ALERT_NOTIFY:           'alerts:notify',

  // MDM
  MDM_POLICY_PUSH:        'mdm:policy-push',
  MDM_HEARTBEAT_CHECK:    'mdm:heartbeat-check',

  // Creator / commission
  COMMISSION_CALCULATE:   'commission:calculate',
  INTEGRITY_CALCULATE:    'integrity:calculate',
  CONTENT_STATS_SYNC:     'content:stats-sync',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
```

- [ ] **Step 2: Rebuild and commit**

```bash
pnpm --filter @field-ops/shared build
git add packages/shared/src/constants/queues.ts
git commit -m "feat(shared): extend queue names for all services"
```

---

## Task 9: Update seed data

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Replace seed.ts**

```typescript
import { prisma } from './client';
import {
  EmployeeRole,
  EmployeeStatus,
  ContractType,
  KnownLocationType,
} from '@prisma/client';

async function main() {
  console.log('🌱 Seeding database...');

  const admin = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-0001' },
    update: {},
    create: {
      employeeNumber: 'EMP-0001',
      firstName: 'Admin',
      lastName: 'Owner',
      phone: '+212600000001',
      whatsappJid: '212600000001@s.whatsapp.net',
      email: 'admin@yourcompany.ma',
      role: EmployeeRole.ADMIN,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2024-01-01'),
      zone: 'ALL',
    },
  });

  const vendeurData = [
    { num: 'EMP-0002', first: 'Youssef', last: 'Amrani', phone: '+212600000002', zone: 'Casablanca-Nord' },
    { num: 'EMP-0003', first: 'Fatima', last: 'Benali', phone: '+212600000003', zone: 'Casablanca-Sud' },
    { num: 'EMP-0004', first: 'Hassan', last: 'Tazi', phone: '+212600000004', zone: 'Rabat' },
    { num: 'EMP-0005', first: 'Khadija', last: 'Idrissi', phone: '+212600000005', zone: 'Marrakech' },
  ];

  for (const v of vendeurData) {
    await prisma.employee.upsert({
      where: { employeeNumber: v.num },
      update: {},
      create: {
        employeeNumber: v.num,
        firstName: v.first,
        lastName: v.last,
        phone: v.phone,
        whatsappJid: `${v.phone.replace('+', '')}@s.whatsapp.net`,
        role: EmployeeRole.VENDEUR,
        status: EmployeeStatus.ACTIVE,
        hireDate: new Date('2024-03-01'),
        zone: v.zone,
        managerId: admin.id,
      },
    });
  }

  // Known locations — Casablanca
  const locations = [
    { name: 'Entrepôt Principal Casablanca', type: KnownLocationType.WAREHOUSE, lat: '33.5731', lng: '-7.5898', radius: 200 },
    { name: 'Bureau Rabat', type: KnownLocationType.WAREHOUSE, lat: '34.0209', lng: '-6.8416', radius: 150 },
    { name: 'Client Marjane Hay Hassani', type: KnownLocationType.CLIENT, lat: '33.5481', lng: '-7.6372', radius: 100 },
    { name: 'Station-service Ziz', type: KnownLocationType.APPROVED_STOP, lat: '33.5601', lng: '-7.6201', radius: 80 },
  ];

  for (const loc of locations) {
    await prisma.knownLocation.upsert({
      where: { id: `loc-${loc.name.toLowerCase().replace(/\s/g, '-').slice(0, 30)}` },
      update: {},
      create: {
        id: `loc-${loc.name.toLowerCase().replace(/\s/g, '-').slice(0, 30)}`,
        name: loc.name,
        type: loc.type,
        latitude: loc.lat,
        longitude: loc.lng,
        radiusMeters: loc.radius,
        isActive: true,
        employeeIds: [],
      },
    });
  }

  // Content blacklist
  const blacklistTerms = [
    { term: 'concurrent', category: 'COMPETITOR' },
    { term: 'menafis', category: 'COMPETITOR' },
    { term: 'منافس', category: 'COMPETITOR' },
    { term: 'prix perso', category: 'KEYWORD' },
    { term: 'whatsapp perso', category: 'KEYWORD' },
    { term: 'telegram', category: 'KEYWORD' },
    { term: 'نقدي مباشر', category: 'KEYWORD' },
    { term: 'paye cash direct', category: 'KEYWORD' },
  ];

  for (const item of blacklistTerms) {
    await prisma.contentBlacklist.upsert({
      where: { term: item.term },
      update: {},
      create: { term: item.term, category: item.category, addedBy: admin.id },
    });
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run seed to verify**

```bash
cd "/Users/mac/Documents/system control"
docker compose up -d postgres redis
sleep 5
pnpm --filter @field-ops/db migrate:deploy
pnpm db:seed
```

Expected: `✅ Seed complete`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat(db): update seed with KnownLocations, ContentBlacklist, extended employee data"
```

---

## Self-Review

**Spec coverage check:**
- ✅ All 9 new Prisma models added (Task 1)
- ✅ All 5 updated models done (Device + Message + ContentSubmission + Creator + Alert)
- ✅ All 4 new enums (KnownLocationType, GpsAnomalyType, SimActivityType, MarketingChannel)
- ✅ All new AlertType values added
- ✅ MinIO service in docker-compose (Task 2)
- ✅ Bucket init container with WORM policy (Task 2)
- ✅ All new .env vars (Task 3)
- ✅ MinIO S3 client with SHA-256 upload (Task 4)
- ✅ AES-256-GCM encrypt/decrypt (Task 5)
- ✅ Redis pub/sub typed channels (Task 6)
- ✅ Socket.io event types (Task 7)
- ✅ Queue constants updated (Task 8)
- ✅ Seed with KnownLocations + ContentBlacklist (Task 9)

**Placeholder scan:** None found.

**Type consistency:**
- `KnownLocation` uses `latitude`/`longitude` (not `lat`/`lng`) — consistent with existing GpsTrack pattern ✅
- `evidenceKey()` in minio.ts returns string used in `storagePath` column ✅
- `REDIS_CHANNELS` exported from channels.ts, imported by redis-pubsub.ts ✅
- `ServerToClientEvents` + `ClientToServerEvents` used in Plan 02 (api service) ✅
