(function () {
  const curso = getQueryParam('curso');
  const errorEl = document.getElementById('error-global');
  const exitoEl = document.getElementById('mensaje-exito');
  const panelVacio = document.getElementById('panel-vacio');
  const avisoValidacion = document.getElementById('aviso-validacion');
  const gridMesas = document.getElementById('grid-mesas');
  const panelGuardar = document.getElementById('panel-guardar');
  const btnGuardar = document.getElementById('btn-guardar');
  const selectPeriodo = document.getElementById('select-periodo');

  if (!curso || CURSOS.indexOf(curso) === -1) {
    mostrarError(errorEl, 'Curso no especificado o no válido. Vuelve al menú principal.');
    return;
  }
  document.getElementById('titulo-curso').textContent = curso;

  let mesas = [];              // [{mesa, estudiantes:[{idEstudiante, estudiante, fijado}]}]
  const rolAsignado = {};      // idEstudiante -> rol seleccionado

  function opcionesRol(tamanoMesa) {
    return tamanoMesa === 6 ? ROLES_BASE.concat([ROL_DOCUMENTALISTA]) : ROLES_BASE;
  }

  function calcularDuplicados(mesa) {
    if (mesa.estudiantes.length === 6) return new Set(); // en mesas de 6, se permite compartir rol
    const conteo = {};
    mesa.estudiantes.forEach(function (est) {
      const rol = rolAsignado[est.idEstudiante];
      if (!rol) return;
      conteo[rol] = (conteo[rol] || 0) + 1;
    });
    const duplicados = new Set();
    mesa.estudiantes.forEach(function (est) {
      const rol = rolAsignado[est.idEstudiante];
      if (rol && conteo[rol] > 1) duplicados.add(est.idEstudiante);
    });
    return duplicados;
  }

  function renderMesas() {
    gridMesas.innerHTML = '';
    mesas.forEach(function (m) {
      const duplicados = calcularDuplicados(m);
      const card = document.createElement('div');
      card.className = 'mesa-card';

      const h3 = document.createElement('h3');
      h3.textContent = 'Mesa ' + m.mesa + ' (' + m.estudiantes.length + ')';
      card.appendChild(h3);

      const ul = document.createElement('ul');
      m.estudiantes.forEach(function (est) {
        const li = document.createElement('li');
        if (duplicados.has(est.idEstudiante)) li.classList.add('rol-duplicado');

        const filaNombre = document.createElement('div');
        filaNombre.className = 'fila-nombre';
        const span = document.createElement('span');
        span.textContent = est.estudiante;
        filaNombre.appendChild(span);
        li.appendChild(filaNombre);

        const select = document.createElement('select');
        const optVacia = document.createElement('option');
        optVacia.value = '';
        optVacia.textContent = '-- rol --';
        select.appendChild(optVacia);
        opcionesRol(m.estudiantes.length).forEach(function (rol) {
          const opt = document.createElement('option');
          opt.value = rol;
          opt.textContent = rol;
          if (rolAsignado[est.idEstudiante] === rol) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', function () {
          rolAsignado[est.idEstudiante] = select.value;
          renderMesas();
          actualizarValidacionGlobal();
        });
        li.appendChild(select);
        ul.appendChild(li);
      });
      card.appendChild(ul);
      gridMesas.appendChild(card);
    });
  }

  function actualizarValidacionGlobal() {
    let hayDuplicados = false;
    let faltanRoles = false;
    mesas.forEach(function (m) {
      if (calcularDuplicados(m).size > 0) hayDuplicados = true;
      m.estudiantes.forEach(function (est) {
        if (!rolAsignado[est.idEstudiante]) faltanRoles = true;
      });
    });

    if (hayDuplicados) {
      avisoValidacion.textContent = 'Hay roles repetidos en una mesa de 5 o menos integrantes. Corrige antes de guardar.';
      avisoValidacion.classList.remove('oculto');
    } else if (faltanRoles) {
      avisoValidacion.textContent = 'Asigna un rol a cada integrante antes de guardar.';
      avisoValidacion.classList.remove('oculto');
    } else {
      avisoValidacion.classList.add('oculto');
    }
    btnGuardar.disabled = hayDuplicados || faltanRoles || mesas.length === 0;
  }

  async function cargar() {
    ocultarError(errorEl);
    exitoEl.classList.add('oculto');
    gridMesas.innerHTML = '';
    panelVacio.classList.add('oculto');
    panelGuardar.classList.add('oculto');
    avisoValidacion.classList.add('oculto');
    mesas = [];
    if (!selectPeriodo.value) return;

    try {
      const [grupos, roles] = await Promise.all([
        Api.get('obtenerGruposVigentes', { curso: curso, periodo: selectPeriodo.value }),
        Api.get('obtenerRoles', { curso: curso, periodo: selectPeriodo.value })
      ]);
      mesas = grupos.mesas;
      if (!mesas || mesas.length === 0) {
        panelVacio.classList.remove('oculto');
        return;
      }
      Object.keys(rolAsignado).forEach(function (k) { delete rolAsignado[k]; });
      roles.forEach(function (r) { rolAsignado[r.idEstudiante] = r.rol; });

      renderMesas();
      panelGuardar.classList.remove('oculto');
      actualizarValidacionGlobal();
    } catch (err) {
      mostrarError(errorEl, err.message);
    }
  }

  btnGuardar.addEventListener('click', async function () {
    ocultarError(errorEl);
    exitoEl.classList.add('oculto');
    const roles = [];
    mesas.forEach(function (m) {
      m.estudiantes.forEach(function (est) {
        roles.push({ idEstudiante: est.idEstudiante, estudiante: est.estudiante, mesa: m.mesa, rol: rolAsignado[est.idEstudiante] });
      });
    });

    await conBotonOcupado(btnGuardar, 'Guardando...', async function () {
      try {
        const resultado = await Api.post('guardarRoles', { curso: curso, periodo: selectPeriodo.value, roles: roles });
        exitoEl.textContent = 'Roles guardados (' + resultado.creados + ' nuevos, ' + resultado.actualizados + ' actualizados).';
        exitoEl.classList.remove('oculto');
      } catch (err) {
        mostrarError(errorEl, err.message);
      }
    });
  });

  selectPeriodo.addEventListener('change', cargar);
})();
