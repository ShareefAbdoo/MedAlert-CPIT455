const db    = require('../config/database');
const audit = require('../services/auditService');
const logger = require('../utils/logger');

// ─── Shared data builder ──────────────────────────────────────────────────────

async function buildReportData(patientId) {
  const { rows: patRows } = await db.query(
    `SELECT p.*, u.full_name AS nurse_name
     FROM patients p LEFT JOIN users u ON u.id = p.assigned_nurse_id
     WHERE p.id = $1`,
    [patientId]
  );
  if (!patRows.length) {
    const err = new Error('Patient not found');
    err.status = 404;
    throw err;
  }
  const patient = patRows[0];

  const { rows: medications } = await db.query(
    `SELECT * FROM medications WHERE patient_id = $1 ORDER BY start_date DESC`,
    [patientId]
  );

  const { rows: doseLogs } = await db.query(
    `SELECT dl.*, m.name AS medication_name, m.unit, u.full_name AS nurse_name
     FROM dose_logs dl
     JOIN medications m ON m.id = dl.medication_id
     JOIN users       u ON u.id = dl.nurse_id
     WHERE dl.patient_id = $1
     ORDER BY dl.administered_at ASC`,
    [patientId]
  );

  const total        = doseLogs.length;
  const administered = doseLogs.filter((l) => l.status === 'administered').length;
  const missed       = doseLogs.filter((l) => l.status === 'missed').length;
  const skipped      = doseLogs.filter((l) => l.status === 'skipped').length;

  // Index medications, attach their dose logs
  const medMap = {};
  for (const m of medications) {
    medMap[m.id] = {
      id: m.id, name: m.name, dosage: m.dosage, unit: m.unit,
      route: m.route, frequency: m.frequency, maxDose: m.max_dose,
      startDate: m.start_date, endDate: m.end_date,
      administered: 0, missed: 0, skipped: 0, doses: [],
    };
  }
  for (const log of doseLogs) {
    const entry = medMap[log.medication_id];
    if (entry) {
      entry[log.status] = (entry[log.status] || 0) + 1;
      entry.doses.push(log);
    }
  }

  return {
    patient: {
      id:               patient.id,
      fullName:         patient.full_name,
      medicalRecordNo:  patient.medical_record_no,
      dateOfBirth:      patient.date_of_birth,
      diagnosis:        patient.diagnosis,
      assignedNurse:    patient.nurse_name || 'Unassigned',
    },
    generatedAt: new Date().toISOString(),
    summary: {
      totalDoses:     total,
      administered,
      missed,
      skipped,
      complianceRate: total > 0 ? `${Math.round((administered / total) * 100)}%` : 'N/A',
    },
    medications: Object.values(medMap),
    doseLogs,
  };
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

async function getReportJson(req, res, next) {
  try {
    const data = await buildReportData(req.params.patientId);
    await audit.log({
      userId: req.user.id, action: 'REPORT_EXPORTED',
      entityType: 'patients', entityId: Number(req.params.patientId),
      details: { format: 'json' }, ipAddress: req.ip,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

async function getReportCsv(req, res, next) {
  try {
    const data = await buildReportData(req.params.patientId);

    const headerRow = [
      'Date & Time', 'Medication', 'Actual Dose', 'Unit',
      'Status', 'Nurse', 'Notes',
    ];

    const dataRows = data.doseLogs.map((l) => [
      new Date(l.administered_at).toLocaleString('en-US', { hour12: true }),
      l.medication_name,
      l.actual_dosage,
      l.unit,
      l.status,
      l.nurse_name,
      l.notes || '',
    ]);

    const csv = [headerRow, ...dataRows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\r\n');

    const filename = `MedAlert_Report_${data.patient.medicalRecordNo}_${Date.now()}.csv`;

    await audit.log({
      userId: req.user.id, action: 'REPORT_EXPORTED',
      entityType: 'patients', entityId: Number(req.params.patientId),
      details: { format: 'csv' }, ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function getReportPdf(req, res, next) {
  let doc;
  try {
    const data     = await buildReportData(req.params.patientId);
    const PDFDocument = require('pdfkit');
    doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    const filename = `MedAlert_Report_${data.patient.medicalRecordNo}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const BLUE   = '#1d4ed8';
    const RED    = '#dc2626';
    const GREEN  = '#16a34a';
    const GRAY   = '#6b7280';
    const DARK   = '#111827';
    const LIGHT  = '#f9fafb';
    const W      = 495; // usable width (595 - 2×50)

    // ── Header ──
    doc.rect(0, 0, 595, 80).fill(BLUE);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('MedAlert', 50, 22, { continued: true })
       .font('Helvetica').fontSize(11).fillColor('#bfdbfe')
       .text('  ·  Medication History Report', { baseline: 'middle' });
    doc.fillColor('#dbeafe').fontSize(9)
       .text('CPIT 455 — Clinic Medication Management System', 50, 50);
    doc.moveDown(3);

    // ── Patient block ──
    doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold')
       .text('Patient Information', 50, doc.y);
    doc.moveDown(0.4);

    const pInfo = [
      ['Full Name',          data.patient.fullName],
      ['Medical Record No.', data.patient.medicalRecordNo],
      ['Date of Birth',      data.patient.dateOfBirth ? new Date(data.patient.dateOfBirth).toLocaleDateString('en-US') : '—'],
      ['Diagnosis',          data.patient.diagnosis || '—'],
      ['Assigned Nurse',     data.patient.assignedNurse],
      ['Report Generated',   new Date(data.generatedAt).toLocaleString('en-US')],
    ];

    doc.rect(50, doc.y, W, pInfo.length * 20 + 16).fill(LIGHT).stroke('#e5e7eb');
    let rowY = doc.y + 8;
    for (const [label, value] of pInfo) {
      doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text(label, 58, rowY, { width: 130 });
      doc.fillColor(DARK).font('Helvetica').text(value, 192, rowY, { width: 300 });
      rowY += 20;
    }
    doc.y = rowY + 8;
    doc.moveDown(1);

    // ── Summary ──
    doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.4);

    const s = data.summary;
    const cols = [
      { label: 'Total Doses',     value: s.totalDoses,     color: DARK },
      { label: 'Administered',    value: s.administered,   color: GREEN },
      { label: 'Missed',          value: s.missed,         color: s.missed > 0 ? RED : DARK },
      { label: 'Skipped',         value: s.skipped,        color: GRAY },
      { label: 'Compliance Rate', value: s.complianceRate, color: parseFloat(s.complianceRate) >= 80 ? GREEN : RED },
    ];
    const boxW  = Math.floor(W / cols.length) - 4;
    let boxX    = 50;
    const boxY  = doc.y;
    for (const col of cols) {
      doc.rect(boxX, boxY, boxW, 56).fill('#ffffff').stroke('#e5e7eb');
      doc.fillColor(col.color).fontSize(20).font('Helvetica-Bold')
         .text(String(col.value), boxX + 4, boxY + 8, { width: boxW - 8, align: 'center' });
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
         .text(col.label, boxX + 4, boxY + 36, { width: boxW - 8, align: 'center' });
      boxX += boxW + 5;
    }
    doc.y = boxY + 68;
    doc.moveDown(1);

    // ── Dose Log Table ──
    doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text('Dose History');
    doc.moveDown(0.5);

    const tHeaders = ['Date & Time', 'Medication', 'Dose', 'Status', 'Nurse', 'Notes'];
    const tWidths  = [110, 110, 55, 65, 90, 65];

    // Table header row
    let tx = 50;
    const thY = doc.y;
    doc.rect(50, thY, W, 18).fill(BLUE);
    for (let i = 0; i < tHeaders.length; i++) {
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text(tHeaders[i], tx + 3, thY + 4, { width: tWidths[i] - 6 });
      tx += tWidths[i];
    }
    doc.y = thY + 18;

    const STATUS_COLOR = { administered: GREEN, missed: RED, skipped: GRAY };

    for (let li = 0; li < data.doseLogs.length; li++) {
      const l   = data.doseLogs[li];
      const rY  = doc.y;
      const rH  = 16;

      // Page break
      if (rY + rH > doc.page.height - 60) {
        doc.addPage();
        doc.y = 50;
      }

      const bg = li % 2 === 0 ? '#ffffff' : LIGHT;
      doc.rect(50, doc.y, W, rH).fill(bg);

      const cells = [
        new Date(l.administered_at).toLocaleString('en-US', { hour12: true, dateStyle: 'short', timeStyle: 'short' }),
        l.medication_name,
        `${l.actual_dosage} ${l.unit}`,
        l.status,
        l.nurse_name,
        l.notes || '—',
      ];
      tx = 50;
      for (let ci = 0; ci < cells.length; ci++) {
        const color = ci === 3 ? (STATUS_COLOR[cells[ci]] || DARK) : DARK;
        doc.fillColor(color).fontSize(7.5).font(ci === 3 ? 'Helvetica-Bold' : 'Helvetica')
           .text(cells[ci], tx + 3, doc.y + 3, { width: tWidths[ci] - 6, lineBreak: false });
        tx += tWidths[ci];
      }
      doc.y += rH;
    }

    // ── Footer on every page ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica')
         .text(
           `MedAlert — Confidential Medical Record   |   Page ${i + 1} of ${totalPages}`,
           50, doc.page.height - 30, { width: W, align: 'center' }
         );
    }

    doc.end();

    await audit.log({
      userId: req.user.id, action: 'REPORT_EXPORTED',
      entityType: 'patients', entityId: Number(req.params.patientId),
      details: { format: 'pdf' }, ipAddress: req.ip,
    });
  } catch (err) {
    if (doc && !doc.writableEnded) doc.end();
    next(err);
  }
}

module.exports = { getReportJson, getReportCsv, getReportPdf };
