(function () {
  const gridCursos = document.getElementById('grid-cursos');
  const panelAcciones = document.getElementById('panel-acciones');
  const cursoElegidoSpan = document.getElementById('curso-elegido');

  CURSOS.forEach(function (curso) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-curso';
    btn.textContent = curso;
    btn.addEventListener('click', function () {
      document.querySelectorAll('.btn-curso').forEach(function (b) { b.classList.remove('activo'); });
      btn.classList.add('activo');
      seleccionarCurso(curso);
    });
    gridCursos.appendChild(btn);
  });

  function seleccionarCurso(curso) {
    cursoElegidoSpan.textContent = curso;
    panelAcciones.classList.remove('oculto');
    document.getElementById('link-sorteo').href = 'sorteo.html?curso=' + encodeURIComponent(curso);
    document.getElementById('link-grupos').href = 'grupos.html?curso=' + encodeURIComponent(curso);
    document.getElementById('link-roles').href = 'roles.html?curso=' + encodeURIComponent(curso);
    document.getElementById('link-historial').href = 'historial.html?curso=' + encodeURIComponent(curso);
  }
})();
