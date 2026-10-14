/**
 * Buzón de Hábitos Saludables (Google Apps Script, proyecto independiente).
 *
 * - La app envía su resumen (POST) → se guarda en el documento "habitos-resumen" de la carpeta del buzón.
 * - Claude deja cada viernes el menú en esa carpeta como "habitos-menu-AAAA-MM-DD.json".
 * - La app pide el menú (GET) → se devuelve el más reciente.
 *
 * Despliegue: Implementar → Nueva implementación → Aplicación web
 *             Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 */
var CARPETA_ID = '11iDsEWBIVfA4szb0PFW_Bv_FyI6twTOL'; // "Hábitos Saludables · Buzón" en tu Google Drive

function doPost(e) {
  var cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  var datos = cuerpo.datos || cuerpo;
  var carpeta = DriveApp.getFolderById(CARPETA_ID);
  var existentes = carpeta.getFilesByName('habitos-resumen');
  var doc;
  if (existentes.hasNext()) {
    doc = DocumentApp.openById(existentes.next().getId());
  } else {
    doc = DocumentApp.create('habitos-resumen');
    DriveApp.getFileById(doc.getId()).moveTo(carpeta);
  }
  doc.getBody().setText('Recibido: ' + new Date().toISOString() + '\n\n' + JSON.stringify(datos, null, 1));
  doc.saveAndClose();
  return salida_({ ok: true });
}

function doGet(e) {
  var carpeta = DriveApp.getFolderById(CARPETA_ID);
  var archivos = carpeta.getFiles();
  var mejor = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    var nombre = f.getName();
    if (/^habitos-menu-\d{4}-\d{2}-\d{2}\.json$/.test(nombre) && (!mejor || nombre > mejor.getName())) mejor = f;
  }
  if (!mejor) return salida_({});
  var menu = JSON.parse(mejor.getBlob().getDataAsString('UTF-8'));
  menu.recibido = mejor.getLastUpdated().toISOString();
  return salida_(menu);
}

// Ejecuta esta función una vez desde el editor para autorizar los permisos.
function probar() {
  Logger.log(DriveApp.getFolderById(CARPETA_ID).getName());
}

function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
