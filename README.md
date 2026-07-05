# Sorteo de mesas y roles

Aplicación para sortear estudiantes en 6 mesas de trabajo por curso (grupos
fijos por período) y registrar los roles rotativos de cada integrante.
Backend en Google Apps Script sobre un Google Sheet existente; frontend
estático (HTML/CSS/JS vanilla) publicado en GitHub Pages.

Cursos soportados: 8B, 8C, 9A, 9B, 9C, 10A, 10B, 10C, 11A, 11B, 11C.

## ⚠️ Dato sensible: estudiantes menores de edad

El Google Sheet contiene nombres reales de menores de edad. El frontend en
GitHub Pages es público por naturaleza. Lee toda la sección **Seguridad**
antes de publicar nada.

## Estructura del repositorio

```
sorteo_mesas/
├── README.md
├── .gitignore
├── frontend/
│   ├── index.html, sorteo.html, grupos.html, roles.html, historial.html
│   ├── css/estilos.css
│   ├── js/api.js, sorteo.js, grupos.js, roles.js, historial.js, index.js
│   └── config.example.js   (plantilla; config.js real NO se sube al repo)
└── backend/
    └── Code.gs
```

## 1. La hoja de estudiantes

La hoja de origen (`tbl_estudiantes`, dentro del spreadsheet
`Tabla_unificada_Estudiantes`) ya existe con estas columnas:

| Columna | Contenido |
|---|---|
| `Curso` | 8B, 8C, 9A, 9B, 9C, 10A, 10B, 10C, 11A, 11B, 11C |
| `Identificación` | Número de documento del estudiante |
| `Estudiante` | Nombre completo |

No es necesario modificar esta hoja. El backend nunca expone la columna
`Identificación` real al frontend: deriva un ID opaco (hash con salt secreto)
para identificar estudiantes en `Sorteos` y `Roles` (ver sección Seguridad).

Las hojas `Sorteos` y `Roles` **no existen todavía**: el propio backend las
crea automáticamente (con sus encabezados) la primera vez que se guarda un
sorteo o un rol. No necesitas crearlas a mano, pero puedes verificarlas
después de la primera prueba.

## 2. Desplegar el backend (Google Apps Script)

1. Ve a [script.google.com](https://script.google.com) y crea un proyecto
   nuevo (standalone, no hace falta que esté vinculado al Sheet).
2. Borra el contenido de `Code.gs` por defecto y pega el contenido de
   [`backend/Code.gs`](backend/Code.gs) de este repo.
3. Guarda el proyecto.
4. Ve a **Configuración del proyecto (⚙️) → Propiedades del script → Añadir
   propiedad del script** y crea dos propiedades:
   - `APP_TOKEN`: el token secreto de la aplicación.
   - `ID_SALT`: un segundo secreto usado únicamente para derivar el ID
     interno de cada estudiante a partir de su documento de identidad.

   **Estos dos valores nunca deben escribirse dentro de `Code.gs`**, porque
   ese archivo se sube a un repositorio público. Solo viven en Script
   Properties. Genera ambos con un valor aleatorio largo (32+ caracteres);
   si no tienes uno, cualquier generador de contraseñas/UUID sirve.
5. La primera vez que ejecutes cualquier función desde el editor (por
   ejemplo, selecciona `doGet` y presiona "Ejecutar"), Google pedirá
   autorizar el script contra tu cuenta y contra el Sheet. Acepta los
   permisos (son tuyos, solo tu cuenta ejecuta el script).
6. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (tu cuenta).
   - Quién tiene acceso: **Cualquier persona**.
7. Copia la **URL de la aplicación web** resultante (termina en `/exec`).
   Esa es tu `APPS_SCRIPT_URL`.

Cada vez que modifiques `Code.gs`, debes crear una **nueva versión** de la
implementación (Implementar → Gestionar implementaciones → Editar → Nueva
versión) para que los cambios queden en línea; la URL no cambia.

## 3. Configurar el frontend

1. En `frontend/`, copia `config.example.js` como `config.js`:
   ```
   cp frontend/config.example.js frontend/config.js
   ```
2. Edita `frontend/config.js` con la URL real y el token real:
   ```js
   const CONFIG = {
     APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXX/exec",
     APP_TOKEN: "el-mismo-valor-que-pusiste-en-APP_TOKEN"
   };
   ```
3. `config.js` está en `.gitignore` y **no se sube al repositorio**. Cada
   persona que despliegue su propia copia crea su propio `config.js` local.

## 4. Publicar en GitHub Pages

1. Crea un repositorio en GitHub (público — GitHub Pages gratuito para
   cuentas personales requiere que el repo sea público; el sitio publicado
   es de todas formas accesible por cualquiera que tenga la URL, sin
   importar si el repo es público o privado).
2. Sube todo el contenido de este proyecto **excepto** `frontend/config.js`
   (ya está en `.gitignore`, así que `git add` no lo incluirá).
3. En GitHub: **Settings → Pages → Branch**: selecciona la rama principal y
   la carpeta `/frontend` (o mueve el contenido de `frontend/` a la raíz del
   repo si prefieres servir desde `/`).
4. Sube manualmente tu `config.js` real a la carpeta publicada (por ejemplo,
   con `git add -f frontend/config.js`, que ignora el `.gitignore` para ese
   archivo puntual) — asumiendo que cualquier persona que inspeccione el
   código fuente de la página publicada verá el token en texto plano (ver
   Seguridad). Este repo ya tiene `frontend/config.js` publicado con este
   criterio.

## 5. Seguridad y privacidad (obligatorio, léelo)

1. **Token de aplicación**: todas las acciones del backend validan `token`
   contra `Script Properties` (`APP_TOKEN`). Si no coincide, se responde
   `{"ok": false, "code": 401, ...}` y no se ejecuta ninguna lectura ni
   escritura. (Nota técnica: Apps Script no permite fijar el código de
   estado HTTP real de la respuesta de un Web App; el código 401 va dentro
   del cuerpo JSON, y el frontend lo interpreta así.)
2. **ID de estudiante opaco**: la columna `Identificación` (cédula) del
   Sheet original **nunca** se envía al frontend ni se copia en `Sorteos`
   o `Roles`. El backend deriva `ID_Estudiante` con
   `SHA-256(ID_SALT + ":" + identificación)` truncado a 16 caracteres. Sin
   conocer `ID_SALT` (que solo vive en Script Properties) no es posible
   reconstruir la cédula real a partir del ID expuesto.
3. **Mínima exposición**: `listarEstudiantes` solo devuelve `idEstudiante`
   y `estudiante` (nombre completo) — nunca la cédula ni otras columnas.
4. **El token en `config.js` es visible para cualquiera** que abra las
   herramientas de desarrollador del navegador en el sitio publicado. Esto
   es una limitación inherente a un sitio 100% estático: no es
   autenticación fuerte, es una mitigación básica contra el uso casual o
   accidental por parte de terceros que no conocen la URL. Por eso:
   - No publicites la URL de GitHub Pages fuera del uso interno docente.
   - Como mejora futura, si el colegio tiene Google Workspace for
     Education, considera restringir el propio Web App de Apps Script a
     cuentas del dominio institucional en vez de "Cualquier persona".
5. **El Google Sheet original nunca debe compartirse como "cualquiera con
   el enlace"**. Debe permanecer privado, compartido solo con el/los
   docentes que lo usan. Solo el Apps Script (que corre como tu cuenta)
   necesita acceso de escritura.
6. **Ediciones manuales en la vista previa**: si el docente mueve a un
   estudiante de mesa en la vista previa final (ver sección 6), la
   aplicación solo registra *que* hubo un cambio manual
   (`Fijado_manualmente = TRUE`), nunca el motivo.

## 6. Reglas de negocio implementadas

- **6 mesas siempre**, tamaño calculado dinámicamente a partir del número
  real de estudiantes leídos del Sheet en el momento del sorteo (no
  hardcodeado): `base = floor(N/6)`, `resto = N % 6`; `resto` mesas reciben
  `base + 1` y el resto recibe `base`.
- **Sorteo gamificado, estudiante por estudiante**: en vez de sortear las 6
  mesas de una sola vez, se juega mesa por mesa y, dentro de cada mesa,
  estudiante por estudiante. Cada clic en el botón "Sortear" corre una
  animación tipo ruleta y revela a un solo compañero; el botón entonces
  cambia a "¡{ese estudiante} sortea al siguiente!", así que puede ser el
  propio estudiante sorteado quien pase al frente y presione el botón para
  su compañero de mesa, hasta completar el cupo calculado de esa mesa.
  Cada estudiante ya revelado tiene un icono "×" para quitarlo de esa mesa;
  al quitarlo, ese estudiante no vuelve a salir sorteado en esa misma mesa
  (sí puede salir en otra), y el cupo libre queda pendiente de un nuevo
  clic. Al completar el cupo aparecen dos opciones: **Repetir** (descarta
  el grupo — mantiene las exclusiones por "×" — y vuelve a sortear esta
  misma mesa desde cero) o **Siguiente mesa** / **Finalizar sorteo** (fija
  el resultado localmente y avanza). El progreso de las 6 mesas se muestra
  como una fila de círculos (pendiente / en curso / completa). Un botón
  "Reiniciar sorteo completo" permite empezar de cero en cualquier momento
  antes de confirmar.
- **Vista previa editable al final**: tras aceptar la mesa 6, se muestra la
  vista previa de las 6 mesas con un selector de mesa por estudiante — ahí
  es donde el docente hace cualquier ajuste manual (por ejemplo, por
  necesidades de accesibilidad), sin necesidad de fijar a nadie antes de
  sortear. Un estudiante movido de la mesa que le tocó por sorteo aparece
  marcado como "Editado" y se guarda con `Fijado_manualmente = TRUE`.
- **Historial, no sobrescritura**: cada sorteo confirmado agrega filas
  nuevas a `Sorteos`; las filas del sorteo anterior de ese mismo
  curso+periodo pasan `Vigente` a `FALSE` (nunca se borran).
- **Confirmación explícita**: nada se escribe en el Sheet hasta presionar
  "Guardar y confirmar" sobre la vista previa final.
- **Roles**: en mesas de 6 integrantes se permite compartir rol o usar
  "Documentalista"; en mesas de 5 o menos, cada integrante debe tener un rol
  distinto (la interfaz bloquea el guardado mientras haya duplicados).

## 7. Probar localmente

Puedes abrir `frontend/index.html` directamente en el navegador (o servirlo
con cualquier servidor estático) una vez tengas `frontend/config.js`
configurado con la URL real del Web App ya desplegado — no hace falta
ningún paso de build.

## 8. Licencia

Ver [LICENSE](LICENSE). Todos los derechos reservados — el código es
visible por estar en un repositorio público (requisito de GitHub Pages),
pero no está disponible para reutilización sin permiso del autor.
