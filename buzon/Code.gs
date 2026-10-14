/**
 * Buzón de Hábitos Saludables (Google Apps Script, vinculado a una hoja de cálculo).
 * - La app envía cada semana su resumen (POST) → pestaña "Resumenes".
 * - Claude deja el menú de la semana siguiente en la celda A1 de la pestaña "Menu".
 * - La app recoge ese menú (GET ?accion=menu).
 * Despliegue: Implementar → Nueva implementación → Aplicación web → Ejecutar como: yo · Acceso: cualquier usuario.
 */
function doPost(e) {
  var body = JSON.parse(e.postData.contents || '{}');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Resumenes') || ss.insertSheet('Resumenes');
  if (sh.getLastRow() === 0) sh.appendRow(['Recibido', 'Resumen (JSON)']);
  sh.appendRow([new Date(), JSON.stringify(body.datos || body)]);
  return json_({ ok: true });
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Menu') || ss.insertSheet('Menu');
  var txt = String(sh.getRange('A1').getValue() || '{}');
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
