/**
 * Demo seed — creates 3 Firebase Auth users + DB rows, 1 patient, 2 medications,
 * and 6 upcoming dose schedules.
 *
 * Run once:  node seed.js
 * Safe to re-run: uses ON CONFLICT to skip already-existing records.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const db    = require('./src/config/database');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const DEMO_USERS = [
  { email: 'nurse@medalert.demo',  password: 'Demo1234!', full_name: 'Sara Al-Qahtani', role: 'nurse'  },
  { email: 'doctor@medalert.demo', password: 'Demo1234!', full_name: 'Dr. Omar Al-Amri',  role: 'doctor' },
  { email: 'admin@medalert.demo',  password: 'Demo1234!', full_name: 'System Admin',       role: 'admin'  },
];

async function getOrCreateFirebaseUser(u) {
  try {
    return await admin.auth().createUser({ email: u.email, password: u.password, displayName: u.full_name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') return admin.auth().getUserByEmail(u.email);
    throw err;
  }
}

async function seed() {
  console.log('Seeding demo data…\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const ids = {};
  for (const u of DEMO_USERS) {
    const fbUser = await getOrCreateFirebaseUser(u);
    const { rows } = await db.query(
      `INSERT INTO users (firebase_uid, email, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [fbUser.uid, u.email, u.full_name, u.role],
    );
    ids[u.role] = rows[0].id;
    console.log(`✓ ${u.role.padEnd(6)} ${u.email}`);
  }

  // ── Patient ────────────────────────────────────────────────────────────────
  const { rows: [pat] } = await db.query(
    `INSERT INTO patients (full_name, date_of_birth, medical_record_no, diagnosis, assigned_nurse_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (medical_record_no) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    ['Mohammed Al-Rashidi', '1985-03-15', 'MRN-0001', 'Type 2 Diabetes, Hypertension', ids.nurse, ids.admin],
  );
  console.log(`✓ patient  Mohammed Al-Rashidi (MRN-0001) → id=${pat.id}`);

  // ── Medications + schedules ────────────────────────────────────────────────
  const MEDS = [
    { name: 'Metformin',   dosage: 500, unit: 'mg', frequency: 'Twice daily', max_dose: 1000, route: 'Oral', start_date: '2025-01-01' },
    { name: 'Amlodipine',  dosage: 5,   unit: 'mg', frequency: 'Once daily',  max_dose: 10,   route: 'Oral', start_date: '2025-01-01' },
  ];

  for (const med of MEDS) {
    const { rows: [m] } = await db.query(
      `INSERT INTO medications (patient_id, name, dosage, unit, frequency, max_dose, route, start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [pat.id, med.name, med.dosage, med.unit, med.frequency, med.max_dose, med.route, med.start_date, ids.doctor],
    );
    console.log(`✓ med      ${med.name} → id=${m.id}`);

    // 3 upcoming doses spaced 6 h apart
    for (let i = 1; i <= 3; i++) {
      const t = new Date();
      t.setHours(t.getHours() + i * 6, 0, 0, 0);
      await db.query(
        `INSERT INTO dose_schedules (medication_id, scheduled_time, status) VALUES ($1, $2, 'pending')`,
        [m.id, t],
      );
    }
    console.log(`  → 3 schedules created`);
  }

  console.log('\n✅ Done!\n');
  console.log('Demo login credentials (password: Demo1234! for all)');
  console.log('  Nurse:  nurse@medalert.demo');
  console.log('  Doctor: doctor@medalert.demo');
  console.log('  Admin:  admin@medalert.demo');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
