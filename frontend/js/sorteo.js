(function () {
  const curso = getQueryParam('curso');
  const errorEl = document.getElementById('error-global');
  const exitoEl = document.getElementById('mensaje-exito');

  if (!curso || CURSOS.indexOf(curso) === -1) {
    mostrarError(errorEl, 'Curso no especificado o no válido. Vuelve al menú principal.');
    return;
  }
  document.getElementById('titulo-curso').textContent = curso;

  const selectPeriodo = document.getElementById('select-periodo');
  const progresoMesas = document.getElementById('progreso-mesas');
  const infoMesaActual = document.getElementById('info-mesa-actual');
  const ruletaNombre = document.getElementById('ruleta-nombre');
  const listaRevelados = document.getElementById('lista-revelados');
  const btnGirar = document.getElementById('btn-girar');
  const btnAceptar = document.getElementById('btn-aceptar');
  const btnRepetir = document.getElementById('btn-repetir');
  const btnReiniciar = document.getElementById('btn-reiniciar');
  const panelPreview = document.getElementById('panel-preview');
  const gridPreview = document.getElementById('grid-preview');
  const btnConfirmar = document.getElementById('btn-confirmar');

  let estudiantes = [];         // [{idEstudiante, estudiante}]
  let targets = [];             // cupo de cada una de las 6 mesas
  let mesaActual = 1;           // 1..6
  let resultadoMesas = {};      // mesa -> [{idEstudiante, estudiante}] ya aceptados
  let mesaEnCurso = [];         // estudiantes ya revelados para la mesa que se está jugando
  let excluidosMesaActual = new Set(); // ids quitados con la "x" en esta mesa: no vuelven a salir aquí
  let ultimoSorteado = null;    // último estudiante cantado: es quien presiona el botón del siguiente
  let juegoIniciado = false;
  let dibujando = false;
  let previewEstudiantes = null; // [{idEstudiante, estudiante, mesa, mesaOriginal}]

  function calcularTamanosMesa(n) {
    const base = Math.floor(n / 6);
    const resto = n % 6;
    const tamanos = [];
    for (let i = 0; i < 6; i++) tamanos.push(i < resto ? base + 1 : base);
    return tamanos;
  }

  function estudiantesRestantes() {
    const asignados = new Set();
    Object.values(resultadoMesas).forEach(function (arr) {
      arr.forEach(function (e) { asignados.add(e.idEstudiante); });
    });
    return estudiantes.filter(function (e) { return !asignados.has(e.idEstudiante); });
  }

  function renderProgreso() {
    progresoMesas.innerHTML = '';
    for (let mesa = 1; mesa <= 6; mesa++) {
      const badge = document.createElement('div');
      badge.className = 'badge-mesa-progreso';
      if (resultadoMesas[mesa]) { badge.classList.add('completa'); badge.textContent = '✓'; }
      else { if (mesa === mesaActual) badge.classList.add('actual'); badge.textContent = mesa; }
      progresoMesas.appendChild(badge);
    }
  }

  function prepararMesaActual() {
    const cupo = targets[mesaActual - 1];
    infoMesaActual.textContent = '🎲 Mesa ' + mesaActual + ' de 6 — cupo: ' + cupo + ' estudiante' + (cupo === 1 ? '' : 's');
    infoMesaActual.classList.remove('cargando');
    ruletaNombre.textContent = ' ';
    mesaEnCurso = [];
    excluidosMesaActual = new Set();
    ultimoSorteado = null;
    listaRevelados.innerHTML = '';
    btnAceptar.classList.add('oculto');
    btnRepetir.classList.add('oculto');
    actualizarBotonSorteo();
    renderProgreso();
  }

  function actualizarBotonSorteo() {
    btnGirar.classList.remove('oculto');
    btnGirar.disabled = false;
    btnGirar.textContent = ultimoSorteado
      ? '🎲 ¡' + ultimoSorteado.estudiante + ' sortea al siguiente!'
      : '🎲 Sortear compañero de mesa';
    btnGirar.classList.remove('resaltar');
    void btnGirar.offsetWidth;
    btnGirar.classList.add('resaltar');
  }

  function renderChip(est) {
    const chip = document.createElement('span');
    chip.className = 'chip-revelado';
    chip.dataset.id = est.idEstudiante;

    const texto = document.createElement('span');
    texto.textContent = est.estudiante;
    chip.appendChild(texto);

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'chip-quitar';
    quitar.setAttribute('aria-label', 'Quitar ' + est.estudiante + ' de esta mesa');
    quitar.textContent = '×';
    chip.appendChild(quitar);

    listaRevelados.appendChild(chip);
  }

  listaRevelados.addEventListener('click', function (e) {
    const boton = e.target.closest('.chip-quitar');
    if (!boton) return;
    const chip = boton.closest('.chip-revelado');
    const id = chip.dataset.id;
    const idx = mesaEnCurso.findIndex(function (e2) { return e2.idEstudiante === id; });
    if (idx === -1) return;
    mesaEnCurso.splice(idx, 1);
    excluidosMesaActual.add(id);
    chip.remove();
    ultimoSorteado = null;
    btnAceptar.classList.add('oculto');
    btnRepetir.classList.add('oculto');
    actualizarBotonSorteo();
  });

  const TICKS_ANIMACION = [60, 60, 70, 70, 80, 90, 100, 120, 150, 180, 220];

  function poolDisponibleParaMesa() {
    const enCurso = new Set(mesaEnCurso.map(function (e) { return e.idEstudiante; }));
    return estudiantesRestantes().filter(function (e) {
      return !enCurso.has(e.idEstudiante) && !excluidosMesaActual.has(e.idEstudiante);
    });
  }

  function iniciarSorteoUnEstudiante() {
    const cupo = targets[mesaActual - 1];
    if (mesaEnCurso.length >= cupo) {
      mostrarBotonesDecision();
      return;
    }
    const pool = poolDisponibleParaMesa();
    if (pool.length === 0) {
      mostrarBotonesDecision();
      return;
    }
    dibujando = true;
    btnGirar.disabled = true;
    btnGirar.classList.remove('resaltar');
    ruletaNombre.classList.add('girando');
    let t = 0;
    (function tick() {
      if (t >= TICKS_ANIMACION.length) {
        ruletaNombre.classList.remove('girando');
        const elegido = pool[Math.floor(Math.random() * pool.length)];
        ruletaNombre.textContent = elegido.estudiante;
        mesaEnCurso.push(elegido);
        renderChip(elegido);
        ultimoSorteado = elegido;
        dibujando = false;
        if (mesaEnCurso.length >= cupo) {
          mostrarBotonesDecision();
        } else {
          actualizarBotonSorteo();
        }
        return;
      }
      const candidato = pool[Math.floor(Math.random() * pool.length)];
      ruletaNombre.textContent = candidato.estudiante;
      setTimeout(tick, TICKS_ANIMACION[t]);
      t++;
    })();
  }

  function mostrarBotonesDecision() {
    dibujando = false;
    btnGirar.classList.add('oculto');
    btnAceptar.textContent = mesaActual === 6 ? '🏁 Finalizar sorteo' : '➡️ Siguiente mesa';
    btnAceptar.classList.remove('oculto');
    btnRepetir.classList.remove('oculto');
  }

  btnGirar.addEventListener('click', function () {
    ocultarError(errorEl);
    if (!selectPeriodo.value) {
      mostrarError(errorEl, 'Selecciona un periodo antes de sortear.');
      return;
    }
    if (!juegoIniciado) {
      juegoIniciado = true;
      selectPeriodo.disabled = true;
      btnReiniciar.classList.remove('oculto');
    }
    iniciarSorteoUnEstudiante();
  });

  btnRepetir.addEventListener('click', function () {
    // Mantiene lo que se haya quitado con la "x" en esta mesa: no debe volver a salir aquí.
    mesaEnCurso = [];
    ultimoSorteado = null;
    listaRevelados.innerHTML = '';
    btnAceptar.classList.add('oculto');
    btnRepetir.classList.add('oculto');
    actualizarBotonSorteo();
  });

  btnAceptar.addEventListener('click', function () {
    resultadoMesas[mesaActual] = mesaEnCurso.slice();
    mesaActual++;
    if (mesaActual > 6) {
      finalizarJuego();
      return;
    }
    prepararMesaActual();
  });

  btnReiniciar.addEventListener('click', function () {
    resultadoMesas = {};
    mesaActual = 1;
    juegoIniciado = false;
    selectPeriodo.disabled = false;
    btnReiniciar.classList.add('oculto');
    panelPreview.classList.add('oculto');
    exitoEl.classList.add('oculto');
    prepararMesaActual();
  });

  function finalizarJuego() {
    renderProgreso();
    infoMesaActual.textContent = '🎉 ¡Sorteo de las 6 mesas completado!';
    ruletaNombre.textContent = ' ';
    listaRevelados.innerHTML = '';
    btnGirar.classList.add('oculto');
    btnAceptar.classList.add('oculto');
    btnRepetir.classList.add('oculto');

    previewEstudiantes = [];
    Object.keys(resultadoMesas).forEach(function (mesa) {
      resultadoMesas[mesa].forEach(function (est) {
        previewEstudiantes.push({
          idEstudiante: est.idEstudiante,
          estudiante: est.estudiante,
          mesa: Number(mesa),
          mesaOriginal: Number(mesa)
        });
      });
    });
    renderPreview();
    panelPreview.classList.remove('oculto');
    panelPreview.scrollIntoView({ behavior: 'smooth' });
  }

  function renderPreview() {
    gridPreview.innerHTML = '';
    for (let mesa = 1; mesa <= 6; mesa++) {
      const integrantes = previewEstudiantes.filter(function (e) { return e.mesa === mesa; })
        .sort(function (a, b) { return a.estudiante.localeCompare(b.estudiante); });

      const card = document.createElement('div');
      card.className = 'mesa-card';
      const h3 = document.createElement('h3');
      h3.textContent = 'Mesa ' + mesa + ' (' + integrantes.length + ')';
      card.appendChild(h3);

      const ul = document.createElement('ul');
      integrantes.forEach(function (est) {
        const li = document.createElement('li');
        const filaNombre = document.createElement('div');
        filaNombre.className = 'fila-nombre';
        const span = document.createElement('span');
        span.textContent = est.estudiante;
        filaNombre.appendChild(span);

        if (est.mesa !== est.mesaOriginal) {
          const badge = document.createElement('span');
          badge.className = 'etiqueta-editado';
          badge.textContent = 'Editado';
          filaNombre.appendChild(badge);
        }
        li.appendChild(filaNombre);

        const select = document.createElement('select');
        for (let m = 1; m <= 6; m++) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = 'Mesa ' + m;
          if (m === mesa) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener('change', function () {
          const registro = previewEstudiantes.find(function (e) { return e.idEstudiante === est.idEstudiante; });
          registro.mesa = Number(select.value);
          renderPreview();
        });
        li.appendChild(select);
        ul.appendChild(li);
      });
      card.appendChild(ul);
      gridPreview.appendChild(card);
    }
  }

  btnConfirmar.addEventListener('click', async function () {
    ocultarError(errorEl);
    exitoEl.classList.add('oculto');
    if (!previewEstudiantes) return;

    const mesas = [];
    for (let mesa = 1; mesa <= 6; mesa++) {
      mesas.push({
        mesa: mesa,
        estudiantes: previewEstudiantes.filter(function (e) { return e.mesa === mesa; })
          .map(function (e) {
            return { idEstudiante: e.idEstudiante, estudiante: e.estudiante, fijado: e.mesa !== e.mesaOriginal };
          })
      });
    }

    await conBotonOcupado(btnConfirmar, 'Guardando...', async function () {
      try {
        const resultado = await Api.post('guardarSorteo', { curso: curso, periodo: selectPeriodo.value, mesas: mesas });
        exitoEl.textContent = '✅ Sorteo guardado y confirmado (' + resultado.totalEstudiantes + ' estudiantes). ' +
          'Puedes revisarlo en "Ver grupos actuales".';
        exitoEl.classList.remove('oculto');
        panelPreview.classList.add('oculto');
      } catch (err) {
        mostrarError(errorEl, err.message);
      }
    });
  });

  (async function init() {
    try {
      estudiantes = await Api.get('listarEstudiantes', { curso: curso });
      targets = calcularTamanosMesa(estudiantes.length);
      btnGirar.disabled = false;
      prepararMesaActual();
    } catch (err) {
      mostrarError(errorEl, err.message);
      infoMesaActual.textContent = '';
    }
  })();
})();
