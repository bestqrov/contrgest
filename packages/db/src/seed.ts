import { prisma } from './client';
import {
  EmployeeRole,
  EmployeeStatus,
  ContractType,
  KnownLocationType,
} from '@prisma/client';

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin / Owner ──────────────────────────────────────────────────────────
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

  // ── Vendeurs ───────────────────────────────────────────────────────────────
  const vendeurs = [
    { num: 'EMP-0002', first: 'Youssef', last: 'Amrani', phone: '+212600000002', zone: 'Casablanca-Nord' },
    { num: 'EMP-0003', first: 'Fatima',  last: 'Benali',  phone: '+212600000003', zone: 'Casablanca-Sud'  },
    { num: 'EMP-0004', first: 'Hassan',  last: 'Tazi',    phone: '+212600000004', zone: 'Rabat'           },
    { num: 'EMP-0005', first: 'Khadija', last: 'Idrissi', phone: '+212600000005', zone: 'Marrakech'       },
  ];

  for (const v of vendeurs) {
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

  // ── Livreurs ───────────────────────────────────────────────────────────────
  await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-0006' },
    update: {},
    create: {
      employeeNumber: 'EMP-0006',
      firstName: 'Rachid',
      lastName: 'Ouali',
      phone: '+212600000006',
      whatsappJid: '212600000006@s.whatsapp.net',
      role: EmployeeRole.LIVREUR,
      status: EmployeeStatus.ACTIVE,
      hireDate: new Date('2024-04-01'),
      zone: 'Casablanca',
      managerId: admin.id,
    },
  });

  // ── Known Locations ────────────────────────────────────────────────────────
  const locations = [
    {
      id: 'loc-warehouse-casa',
      name: 'Entrepôt Principal Casablanca',
      type: KnownLocationType.WAREHOUSE,
      lat: '33.5731', lng: '-7.5898', radius: 200,
    },
    {
      id: 'loc-bureau-rabat',
      name: 'Bureau Rabat',
      type: KnownLocationType.WAREHOUSE,
      lat: '34.0209', lng: '-6.8416', radius: 150,
    },
    {
      id: 'loc-client-marjane',
      name: 'Client Marjane Hay Hassani',
      type: KnownLocationType.CLIENT,
      lat: '33.5481', lng: '-7.6372', radius: 100,
    },
    {
      id: 'loc-stop-ziz',
      name: 'Station-service Ziz Casa',
      type: KnownLocationType.APPROVED_STOP,
      lat: '33.5601', lng: '-7.6201', radius: 80,
    },
    {
      id: 'loc-client-carrefour',
      name: 'Client Carrefour Sidi Maarouf',
      type: KnownLocationType.CLIENT,
      lat: '33.5274', lng: '-7.6606', radius: 100,
    },
  ];

  for (const loc of locations) {
    await prisma.knownLocation.upsert({
      where: { id: loc.id },
      update: {},
      create: {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        latitude: loc.lat,
        longitude: loc.lng,
        radiusMeters: loc.radius,
        isActive: true,
        employeeIds: [],
        createdBy: admin.id,
      },
    });
  }

  // ── Content Blacklist ──────────────────────────────────────────────────────
  const blacklist = [
    // Competitors
    { term: 'concurrent',      category: 'COMPETITOR' },
    { term: 'concurrents',     category: 'COMPETITOR' },
    { term: 'menafis',         category: 'COMPETITOR' },
    { term: 'منافس',           category: 'COMPETITOR' },
    { term: 'منافسين',         category: 'COMPETITOR' },
    // Off-book / policy violations
    { term: 'prix perso',      category: 'KEYWORD' },
    { term: 'prix personnel',  category: 'KEYWORD' },
    { term: 'whatsapp perso',  category: 'KEYWORD' },
    { term: 'num perso',       category: 'KEYWORD' },
    { term: 'telegram',        category: 'KEYWORD' },
    { term: 'signal',          category: 'KEYWORD' },
    { term: 'paye cash direct',category: 'KEYWORD' },
    { term: 'نقدي مباشر',     category: 'KEYWORD' },
    { term: 'كاش مباشرة',     category: 'KEYWORD' },
    { term: 'sans facture',    category: 'KEYWORD' },
    { term: 'bla facture',     category: 'KEYWORD' },
  ];

  for (const item of blacklist) {
    await prisma.contentBlacklist.upsert({
      where: { term: item.term },
      update: {},
      create: { term: item.term, category: item.category, addedBy: admin.id },
    });
  }

  console.log('✅ Seed complete');
  console.log(`   • ${vendeurs.length + 2} employees`);
  console.log(`   • ${locations.length} known locations`);
  console.log(`   • ${blacklist.length} blacklist terms`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
