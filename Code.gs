// Code.gs — Apps Script endpoint for Sheets + Gmail notifications

let SHEET_NAME = 'Absences';
function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  const headers = ['Timestamp','RequestID','Student','StudentEmail','EventID','EventTitle','Reason','Note','Status','DirectorNote'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.action === 'ping') {
      return json_({ ok: true, msg: 'apps-script alive' });
    }

    if (payload.action === 'createAbsence') {
      const r = payload.record || {};
      const row = [new Date(), r.id, r.student, r.studentEmail || '', r.eventId, r.eventTitle || '', r.reason, r.note, r.status, r.directorNote || ''];
      getSheet_().appendRow(row);
      return json_({ ok: true });
    }

    if (payload.action === 'updateStatus') {
      const { id, status, directorNote } = payload;
      const sh = getSheet_();
      const values = sh.getDataRange().getValues();
      const headers = values[0];
      const colId = headers.indexOf('RequestID');
      const colStatus = headers.indexOf('Status');
      const colNote = headers.indexOf('DirectorNote');
      const colEmail = headers.indexOf('StudentEmail');
      const colStudent = headers.indexOf('Student');
      const colTitle = headers.indexOf('EventTitle');
      let email = '', student = '', title = '';
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][colId]) === id) {
          if (colStatus >= 0) sh.getRange(i+1, colStatus+1).setValue(status);
          if (colNote >= 0) sh.getRange(i+1, colNote+1).setValue(directorNote || '');
          email = (colEmail >= 0 ? String(values[i][colEmail]) : '');
          student = (colStudent >= 0 ? String(values[i][colStudent]) : '');
          title = (colTitle >= 0 ? String(values[i][colTitle]) : '');
          break;
        }
      }
      if (email) {
        const subj = `[Band] Absence ${status} – ${title}`;
        const body = `Hello ${student},\n\nYour absence request for "${title}" is now ${status}.\n\nDirector note: ${directorNote || '(none)'}\n\nThis is an automated message.`;
        try { GmailApp.sendEmail(email, subj, body); } catch (err) {}
      }
      return json_({ ok: true });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
function doGet(e) {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return json_({ ok: true, rows });
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
