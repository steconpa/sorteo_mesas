(function () {
  const curso = getQueryParam('curso');
  const errorEl = document.getElementById('error-global');
  const panelVacio = document.getElementById('panel-vacio');
  const gridMesas = document.getElementById('grid-mesas');
  const selectPeriodo = document.getElementById('select-periodo');

  if (!curso || CURSOS.indexOf(curso) === -1) {
    mostrarError(errorEl, 'Curso no especificado o no válido. Vuelve al menú principal.');
    return;
  }
  document.getElementById('titulo-curso').textContent = curso;

  const periodoQuery = getQueryParam('periodo');
  if (periodoQuery && PERIODOS.indexOf(periodoQuery) !== -1) selectPeriodo.value = periodoQuery;

  function renderMesas(mesas) {
    gridMesas.innerHTML = '';
    if (!mesas || mesas.length === 0) {
      panelVacio.classList.remove('oculto');
      return;
    }
    panelVacio.classList.add('oculto');

    mesas.forEach(function (m) {
      const card = document.createElement('div');
      card.className = 'mesa-card';

      const h3 = document.createElement('h3');
      h3.textContent = 'Mesa ' + m.mesa + ' (' + m.estudiantes.length + ')';
      card.appendChild(h3);

      const ul = document.createElement('ul');
      m.estudiantes.forEach(function (est) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = est.estudiante;
        li.appendChild(span);
        if (est.fijado) {
          const badge = document.createElement('span');
          badge.className = 'etiqueta-fijado';
          badge.textContent = 'Fijado';
          li.appendChild(badge);
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
      gridMesas.appendChild(card);
    });
  }

  async function cargar() {
    ocultarError(errorEl);
    gridMesas.innerHTML = '';
    panelVacio.classList.add('oculto');
    if (!selectPeriodo.value) return;
    try {
      const data = await Api.get('obtenerGruposVigentes', { curso: curso, periodo: selectPeriodo.value });
      renderMesas(data.mesas);
    } catch (err) {
      mostrarError(errorEl, err.message);
    }
  }

  selectPeriodo.addEventListener('change', cargar);
  cargar();
})();
