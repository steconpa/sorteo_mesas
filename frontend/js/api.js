// Wrapper de fetch hacia el Apps Script Web App.
// Workaround CORS: los POST se envían con Content-Type: text/plain para
// evitar que el navegador dispare un preflight OPTIONS (que Apps Script no
// maneja bien). El cuerpo sigue siendo JSON serializado como texto.

if (typeof CONFIG === 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:sans-serif;color:#900;">' +
      'Falta el archivo config.js. Copia frontend/config.example.js como ' +
      'frontend/config.js y completa APPS_SCRIPT_URL y APP_TOKEN.</p>';
  });
}

const Api = (function () {
  function buildUrl(action, params) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token', CONFIG.APP_TOKEN);
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });
    return url.toString();
  }

  async function parseResponse(response) {
    let json;
    try {
      json = await response.json();
    } catch (err) {
      throw new Error('Respuesta inválida del servidor.');
    }
    if (!json.ok) {
      if (json.code === 401) {
        throw new Error('Token inválido o ausente. Revisa config.js.');
      }
      throw new Error(json.error || 'Error desconocido del servidor.');
    }
    return json.data;
  }

  async function get(action, params) {
    let response;
    try {
      response = await fetch(buildUrl(action, params));
    } catch (err) {
      throw new Error('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
    }
    return parseResponse(response);
  }

  async function post(action, body) {
    const payload = Object.assign({ action: action, token: CONFIG.APP_TOKEN }, body || {});
    let response;
    try {
      response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      throw new Error('No se pudo conectar con el servidor. Revisa tu conexión a internet.');
    }
    return parseResponse(response);
  }

  return { get: get, post: post };
})();

/** Deshabilita un botón mientras se ejecuta una operación async, evitando doble clic. */
async function conBotonOcupado(boton, textoOcupado, fn) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  if (textoOcupado) boton.textContent = textoOcupado;
  try {
    return await fn();
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

function mostrarError(contenedor, mensaje) {
  if (!contenedor) return;
  contenedor.textContent = mensaje;
  contenedor.classList.remove('oculto');
}

function ocultarError(contenedor) {
  if (!contenedor) return;
  contenedor.textContent = '';
  contenedor.classList.add('oculto');
}

const CURSOS = ['8B', '8C', '9A', '9B', '9C', '10A', '10B', '10C', '11A', '11B', '11C'];
const PERIODOS = ['P3', 'P4'];
const ROLES_BASE = ['Fotógrafo/observador', 'Programador', 'Analista de datos', 'Diseñador web', 'Editor', 'Gestor'];
const ROL_DOCUMENTALISTA = 'Documentalista';

function getQueryParam(nombre) {
  return new URLSearchParams(window.location.search).get(nombre);
}
