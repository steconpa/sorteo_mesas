/**
 * Backend (Google Apps Script) para el sorteo de mesas y registro de roles.
 * Desplegar como Web App: Ejecutar como "Yo", acceso "Cualquier persona".
 *
 * Antes de usar, configurar en Project Settings > Script Properties:
 *   APP_TOKEN  -> token secreto compartido con el frontend (config.js)
 *   ID_SALT    -> salt secreto usado para derivar ID_Estudiante a partir
 *                 de la cédula (Identificación). Nunca se expone la cédula
 *                 real al frontend ni se guarda en Sorteos/Roles.
 *
 * Ninguno de estos dos valores debe escribirse en este archivo: viven solo
 * en Script Properties porque este archivo se sube a un repositorio público.
 */

var SHEET_ID = '14QolHPHI9RtBLmBgvnnAhHLs951lABhR_1W8tAf_i2M';
var SHEET_ESTUDIANTES = 'tbl_estudiantes';
var SHEET_SORTEOS = 'Sorteos';
var SHEET_ROLES = 'Roles';

var CURSOS_VALIDOS = ['8B', '8C', '9A', '9B', '9C', '10A', '10B', '10C', '11A', '11B', '11C'];
var PERIODOS_VALIDOS = ['P3', 'P4'];
var ROLES_VALIDOS = [
  'Fotógrafo/observador', 'Programador', 'Analista de datos',
  'Diseñador web', 'Editor', 'Gestor', 'Documentalista'
];

// ---------------------------------------------------------------------
// Entradas HTTP
// ---------------------------------------------------------------------

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var token = params.token;
    if (!checkToken_(token)) return jsonError_(401, 'Token inválido o ausente.');

    switch (params.action) {
      case 'listarEstudiantes':
        return jsonOk_(listarEstudiantes_(params.curso));
      case 'obtenerGruposVigentes':
        return jsonOk_(obtenerGruposVigentes_(params.curso, params.periodo));
      case 'listarHistorialSorteos':
        return jsonOk_(listarHistorialSorteos_(params.curso));
      case 'obtenerRoles':
        return jsonOk_(obtenerRoles_(params.curso, params.periodo));
      default:
        return jsonError_(400, 'Acción GET no reconocida: ' + params.action);
    }
  } catch (err) {
    return jsonError_(400, err.message);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!checkToken_(body.token)) return jsonError_(401, 'Token inválido o ausente.');

    switch (body.action) {
      case 'guardarSorteo':
        return jsonOk_(guardarSorteo_(body.curso, body.periodo, body.mesas));
      case 'guardarRoles':
        return jsonOk_(guardarRoles_(body.curso, body.periodo, body.roles));
      default:
        return jsonError_(400, 'Acción POST no reconocida: ' + body.action);
    }
  } catch (err) {
    return jsonError_(400, err.message);
  }
}

// ---------------------------------------------------------------------
// Seguridad
// ---------------------------------------------------------------------

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  return !!expected && !!token && token === expected;
}

/** Deriva un ID estable y opaco a partir de la cédula real, usando un salt secreto. */
function getIdEstudiante_(identificacion) {
  var salt = PropertiesService.getScriptProperties().getProperty('ID_SALT');
  if (!salt) throw new Error('Falta configurar ID_SALT en Script Properties.');
  var raw = salt + ':' + String(identificacion).trim();
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = digestBytes.map(function (b) {
    var v = (b < 0) ? b + 256 : b;
    var s = v.toString(16);
    return s.length === 1 ? '0' + s : s;
  }).join('');
  return hex.substring(0, 16);
}

function validarCurso_(curso) {
  if (CURSOS_VALIDOS.indexOf(curso) === -1) throw new Error('Curso no válido: ' + curso);
}

function validarPeriodo_(periodo) {
  if (PERIODOS_VALIDOS.indexOf(periodo) === -1) throw new Error('Periodo no válido: ' + periodo);
}

// ---------------------------------------------------------------------
// Utilidades de hoja
// ---------------------------------------------------------------------

function ss_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getSheetOrCreate_(name, headers) {
  var sheet = ss_().getSheetByName(name);
  if (!sheet) {
    sheet = ss_().insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

/** Convierte una hoja con fila de encabezados en un arreglo de objetos {encabezado: valor}. */
function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j];
    rows.push(obj);
  }
  return rows;
}

function jsonOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(code, message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, code: code, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------
// listarEstudiantes
// ---------------------------------------------------------------------

function listarEstudiantes_(curso) {
  validarCurso_(curso);
  var sheet = ss_().getSheetByName(SHEET_ESTUDIANTES);
  if (!sheet) throw new Error('No se encontró la hoja ' + SHEET_ESTUDIANTES);

  var out = [];
  sheetToObjects_(sheet).forEach(function (r) {
    if (String(r['Curso']).trim() === curso) {
      out.push({
        idEstudiante: getIdEstudiante_(r['Identificación']),
        estudiante: String(r['Estudiante']).trim()
      });
    }
  });
  out.sort(function (a, b) { return a.estudiante.localeCompare(b.estudiante); });
  return out;
}

// ---------------------------------------------------------------------
// guardarSorteo / obtenerGruposVigentes / listarHistorialSorteos
// ---------------------------------------------------------------------

/**
 * mesas: [{ mesa: 1, estudiantes: [{ idEstudiante, estudiante, fijado }] }, ...]
 */
function guardarSorteo_(curso, periodo, mesas) {
  validarCurso_(curso);
  validarPeriodo_(periodo);
  if (!Array.isArray(mesas) || mesas.length === 0) throw new Error('Se requiere el arreglo de mesas.');

  var sheet = getSheetOrCreate_(SHEET_SORTEOS,
    ['ID_Sorteo', 'Fecha', 'Periodo', 'Curso', 'Mesa', 'ID_Estudiante', 'Estudiante', 'Fijado_manualmente', 'Vigente']);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || [];
    var colCurso = headers.indexOf('Curso');
    var colPeriodo = headers.indexOf('Periodo');
    var colVigente = headers.indexOf('Vigente');

    for (var i = 1; i < data.length; i++) {
      if (data[i][colCurso] === curso && data[i][colPeriodo] === periodo && data[i][colVigente] === true) {
        sheet.getRange(i + 1, colVigente + 1).setValue(false);
      }
    }

    var ahora = new Date();
    var fechaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    var idSorteo = fechaStr + '_' + curso;

    var nuevasFilas = [];
    mesas.forEach(function (m) {
      (m.estudiantes || []).forEach(function (est) {
        nuevasFilas.push([
          idSorteo, fechaStr, periodo, curso, m.mesa,
          est.idEstudiante, est.estudiante, !!est.fijado, true
        ]);
      });
    });

    if (nuevasFilas.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, nuevasFilas.length, 9).setValues(nuevasFilas);
    }
    return { idSorteo: idSorteo, totalEstudiantes: nuevasFilas.length };
  } finally {
    lock.releaseLock();
  }
}

function obtenerGruposVigentes_(curso, periodo) {
  validarCurso_(curso);
  validarPeriodo_(periodo);
  var sheet = ss_().getSheetByName(SHEET_SORTEOS);
  if (!sheet) return { mesas: [] };

  var porMesa = {};
  sheetToObjects_(sheet).forEach(function (r) {
    if (r['Curso'] === curso && r['Periodo'] === periodo && r['Vigente'] === true) {
      var mesa = r['Mesa'];
      if (!porMesa[mesa]) porMesa[mesa] = [];
      porMesa[mesa].push({
        idEstudiante: r['ID_Estudiante'],
        estudiante: r['Estudiante'],
        fijado: r['Fijado_manualmente'] === true
      });
    }
  });

  var mesas = Object.keys(porMesa).map(Number).sort(function (a, b) { return a - b; })
    .map(function (n) {
      return {
        mesa: n,
        estudiantes: porMesa[n].sort(function (a, b) { return a.estudiante.localeCompare(b.estudiante); })
      };
    });
  return { mesas: mesas };
}

function listarHistorialSorteos_(curso) {
  validarCurso_(curso);
  var sheet = ss_().getSheetByName(SHEET_SORTEOS);
  if (!sheet) return [];

  var porSorteo = {};
  sheetToObjects_(sheet).forEach(function (r) {
    if (r['Curso'] === curso) {
      var id = r['ID_Sorteo'];
      if (!porSorteo[id]) {
        porSorteo[id] = { idSorteo: id, fecha: r['Fecha'], periodo: r['Periodo'], vigente: false, totalEstudiantes: 0 };
      }
      porSorteo[id].totalEstudiantes++;
      if (r['Vigente'] === true) porSorteo[id].vigente = true;
    }
  });

  return Object.keys(porSorteo).map(function (k) { return porSorteo[k]; })
    .sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
}

// ---------------------------------------------------------------------
// guardarRoles / obtenerRoles
// ---------------------------------------------------------------------

/** roles: [{ idEstudiante, estudiante, mesa, rol }, ...] */
function guardarRoles_(curso, periodo, roles) {
  validarCurso_(curso);
  validarPeriodo_(periodo);
  if (!Array.isArray(roles) || roles.length === 0) throw new Error('Se requiere el arreglo de roles.');

  roles.forEach(function (r) {
    if (ROLES_VALIDOS.indexOf(r.rol) === -1) throw new Error('Rol no válido: ' + r.rol);
  });

  var sheet = getSheetOrCreate_(SHEET_ROLES,
    ['Periodo', 'Curso', 'Mesa', 'ID_Estudiante', 'Estudiante', 'Rol', 'Fecha_asignacion']);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = sheet.getDataRange().getValues();
    var headers = data[0] || ['Periodo', 'Curso', 'Mesa', 'ID_Estudiante', 'Estudiante', 'Rol', 'Fecha_asignacion'];
    var colPeriodo = headers.indexOf('Periodo');
    var colCurso = headers.indexOf('Curso');
    var colId = headers.indexOf('ID_Estudiante');
    var colRol = headers.indexOf('Rol');
    var colFecha = headers.indexOf('Fecha_asignacion');

    var ahora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

    var filaExistentePorId = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][colCurso] === curso && data[i][colPeriodo] === periodo) {
        filaExistentePorId[data[i][colId]] = i + 1; // fila 1-based
      }
    }

    var filasNuevas = [];
    var actualizados = 0;
    roles.forEach(function (r) {
      var fila = filaExistentePorId[r.idEstudiante];
      if (fila) {
        sheet.getRange(fila, colRol + 1).setValue(r.rol);
        sheet.getRange(fila, colFecha + 1).setValue(ahora);
        actualizados++;
      } else {
        filasNuevas.push([periodo, curso, r.mesa, r.idEstudiante, r.estudiante, r.rol, ahora]);
      }
    });

    if (filasNuevas.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, filasNuevas.length, 7).setValues(filasNuevas);
    }
    return { actualizados: actualizados, creados: filasNuevas.length };
  } finally {
    lock.releaseLock();
  }
}

function obtenerRoles_(curso, periodo) {
  validarCurso_(curso);
  validarPeriodo_(periodo);
  var sheet = ss_().getSheetByName(SHEET_ROLES);
  if (!sheet) return [];

  return sheetToObjects_(sheet)
    .filter(function (r) { return r['Curso'] === curso && r['Periodo'] === periodo; })
    .map(function (r) {
      return { idEstudiante: r['ID_Estudiante'], estudiante: r['Estudiante'], mesa: r['Mesa'], rol: r['Rol'] };
    });
}
