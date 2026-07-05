(function () {
  const curso = getQueryParam('curso');
  const errorEl = document.getElementById('error-global');
  const mensajeCargando = document.getElementById('mensaje-cargando');
  const tabla = document.getElementById('tabla-historial');
  const cuerpo = document.getElementById('cuerpo-historial');

  if (!curso || CURSOS.indexOf(curso) === -1) {
    mostrarError(errorEl, 'Curso no especificado o no válido. Vuelve al menú principal.');
    return;
  }
  document.getElementById('titulo-curso').textContent = curso;

  (async function cargar() {
    try {
      const historial = await Api.get('listarHistorialSorteos', { curso: curso });
      mensajeCargando.classList.add('oculto');
      if (!historial || historial.length === 0) {
        mensajeCargando.textContent = 'Aún no se ha realizado ningún sorteo para este curso.';
        mensajeCargando.classList.remove('oculto');
        return;
      }
      tabla.classList.remove('oculto');
      historial.forEach(function (item) {
        const tr = document.createElement('tr');

        const tdFecha = document.createElement('td');
        tdFecha.textContent = item.fecha;
        tr.appendChild(tdFecha);

        const tdPeriodo = document.createElement('td');
        tdPeriodo.textContent = item.periodo;
        tr.appendChild(tdPeriodo);

        const tdTotal = document.createElement('td');
        tdTotal.textContent = item.totalEstudiantes;
        tr.appendChild(tdTotal);

        const tdEstado = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = item.vigente ? 'badge-vigente' : 'badge-no-vigente';
        badge.textContent = item.vigente ? 'Vigente' : 'Reemplazado';
        tdEstado.appendChild(badge);
        tr.appendChild(tdEstado);

        cuerpo.appendChild(tr);
      });
    } catch (err) {
      mensajeCargando.classList.add('oculto');
      mostrarError(errorEl, err.message);
    }
  })();
})();
