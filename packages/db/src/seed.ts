import { prisma } from './client';
import { EmployeeRole, EmployeeStatus, ContractType, AlertSeverity } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin employee
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

  // Create sample vendeurs
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

  // Default MDM policy
  await prisma.mdmPolicy.upsert({
    where: { name: 'default-field-policy' },
    update: {},
    create: {
      name: 'default-field-policy',
      version: 1,
      allowedApps: [
        'com.yourcompany.fieldops',
        'com.whatsapp',
        'com.android.camera',
        'com.google.android.maps',
      ],
      blockedApps: [
        'com.facebook.katana',
        'com.instagram.android',
        'com.twitter.android',
        'com.snapchat.android',
      ],
      wifiNetworks: [{ ssid: 'FieldOps-Corp', security: 'WPA2' }],
      screenLockSecs: 300,
      requireEncrypt: true,
      disableCamera: false,
      disableBluetooth: false,
      policyJson: {
        androidPolicies: {
          applications: [],
          networkEscapeHatchEnabled: false,
          bluetoothContactSharingDisabled: true,
        },
      },
      isActive: true,
    },
  });

  // Default geofences (Morocco major cities)
  const geofences = [
    { name: 'Casablanca Centre', lat: '33.5731', lon: '-7.5898', radius: 15000, zones: ['Casablanca-Nord', 'Casablanca-Sud'] },
    { name: 'Rabat Centre', lat: '34.0209', lon: '-6.8416', radius: 12000, zones: ['Rabat'] },
    { name: 'Marrakech Centre', lat: '31.6295', lon: '-7.9811', radius: 12000, zones: ['Marrakech'] },
  ];

  for (const gf of geofences) {
    await prisma.geofence.upsert({
      where: { id: `geo-${gf.name.toLowerCase().replace(/\s/g, '-')}` },
      update: {},
      create: {
        id: `geo-${gf.name.toLowerCase().replace(/\s/g, '-')}`,
        name: gf.name,
        centerLat: gf.lat,
        centerLon: gf.lon,
        radiusMeters: gf.radius,
        isActive: true,
        zones: gf.zones,
      },
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
