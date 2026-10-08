# AgroConecta Rural

Plataforma web educativa para acercar herramientas digitales a campesinos, personas mayores, pequeños productores y operadores de agroturismo en Colombia. El proyecto prioriza el lenguaje claro, la accesibilidad y el uso desde dispositivos móviles.

## Problema y solución

La conectividad limitada, los trámites difíciles y la baja familiaridad con herramientas digitales reducen las oportunidades de muchas comunidades rurales. AgroConecta Rural reúne prácticas guiadas, un catálogo de experiencias, lecciones digitales, cuentas de cobro y un canal demostrativo de PQRS en una interfaz sencilla.

## Objetivos

- Facilitar la práctica de pasos comunes antes de consultar un trámite oficial.
- Dar visibilidad a experiencias de fincas rurales y permitir solicitudes de reserva.
- Enseñar tareas digitales cotidianas con texto grande y lectura en voz alta.
- Ayudar a organizar cuentas de cobro y solicitudes de servicio.
- Presentar una base accesible, ligera y gratuita que pueda ampliarse con aliados locales.

## Público

Campesinos, productores pequeños, adultos mayores con poca experiencia digital, personas que ofrecen experiencias rurales y organizaciones de acompañamiento.

## Módulos

- **Trámites:** prácticas guiadas de cédula, RUT, SISBÉN, registro del predio y apoyos al campo. Los ejemplos no se envían a ninguna entidad.
- **Fincas:** catálogo, precios de ejemplo y formulario de solicitud de visita.
- **Aprender:** cuatro lecciones con lectura en voz alta del navegador.
- **Cobros:** creación de una cuenta en tres pasos, historial e impresión o guardado como PDF. Una cuenta de cobro no es una factura electrónica.
- **Procesos y PQRS:** actividad local, número de radicado y estado de ejemplo.
- **Administración:** panel para gestionar usuarios, catálogos (crear, editar y eliminar), cobros, procesos, PQRS y mensajes de contacto.

## Accesibilidad y funcionamiento

HTML, CSS y JavaScript sin frameworks de interfaz. Firebase Authentication y Firestore se cargan desde sus SDK web por CDN cuando se configura el proyecto. El texto base mide 18 px, los controles principales tienen al menos 48 px, hay navegación por teclado, etiquetas asociadas, anuncios para lectores de pantalla, ajuste de tamaño, modo claro/oscuro y respeto por la preferencia de movimiento reducido. El menú se envuelve en varias filas en pantallas angostas. Las fotos del catálogo usan enlaces de ejemplo a Unsplash y se ocultan si no cargan; las marcas de entidades son rótulos tipográficos de demostración, no logos oficiales.

La configuración del repositorio viene con valores de ejemplo. Hasta que se complete `assets/js/firebase-config.js`, la aplicación usa el modo local simulado: no verifica contraseñas y no protege roles ni datos. Con una configuración válida usa Firebase Authentication y Firestore; los permisos reales dependen también de publicar `firestore.rules`. El modo local es manipulable desde el navegador y no debe contener información privada.

## Estructura

```text
.
├── index.html       # Punto de entrada para GitHub Pages
├── assets/
│   ├── css/
│   │   └── styles.css # Diseño adaptable, temas y estilos de impresión
│   └── js/
│       ├── firebase-config.js # Configuración web pública de Firebase
│       ├── data.js    # Datos iniciales de catálogo
│       └── app.js     # Navegación, Auth y persistencia Firestore/local
├── firestore.rules   # Reglas de acceso para Firestore
├── WIREFRAMES.md    # Wireframes de baja fidelidad
└── README.md        # Documentación del proyecto
```

## Ejecutar en localhost

No requiere instalación, compilación, dependencias ni conexión a un servicio. La opción recomendada para probar `localStorage` es usar Python 3 si ya está disponible en tu equipo:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000` en tu navegador. Para detener el servidor, vuelve a la terminal y pulsa `Ctrl+C`. También puedes abrir `index.html` directamente; si el navegador limita el almacenamiento local en archivos `file://`, usa la opción de localhost.

Perfiles locales de demostración (no son cuentas reales):

| Rol | Correo |
| --- | --- |
| Administrador | `admin@demo.com` |
| Usuario | `usuario@demo.com` |

Escribe cualquiera de esos correos y una contraseña de ocho caracteres o más; la demo no la valida. También puedes crear un perfil local de prueba. La opción “Borrar datos del sitio” del navegador reinicia la demo. No publiques esos perfiles como si fueran usuarios reales.

## Preparar Firebase para producción

La integración está preparada, pero Firebase permanece inactivo mientras `assets/js/firebase-config.js` conserve los valores `REEMPLAZAR_*`. Las reglas de `firestore.rules` deben publicarse por separado: el cliente no puede aplicar reglas al proyecto.

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/), registra una aplicación web y copia `apiKey`, `authDomain`, `projectId` y `appId` del objeto de configuración web a `assets/js/firebase-config.js`. Esa configuración identifica el proyecto; nunca incluyas una clave privada de service account en GitHub Pages.
2. En **Authentication → Sign-in method**, habilita **Email/Password**. En **Settings → Authorized domains**, añade `nicodorado02-cyber.github.io` y el dominio local que uses para probar.
3. Crea una base Firestore y publica `firestore.rules` desde **Firestore Database → Rules**.
4. Para usuarios nuevos, crea la cuenta con Firebase Authentication y crea `users/{uid}` con `email`, `name`, `role: "user"` y `disabled: false`. El rol se asigna en el servidor; la opción elegida en el formulario nunca concede permisos.
5. Para el primer administrador, crea su usuario desde **Authentication → Users → Add user**. Copia el UID y, desde Firestore Console, crea `users/{uid}` con su correo, nombre, `role: "admin"` y `disabled: false`. No habilites registro público de administradores.
6. Guarda registros privados con `ownerId` igual al UID autenticado: `bookings`, `invoices`, `processes`, `pqrs` y `contacts`. Los catálogos son `procedures`, `farms` y `lessons`; nombres de colecciones y campos deben coincidir con las reglas.
7. Publica el sitio por HTTPS y recárgalo. Con una configuración válida, `app.js` usa `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `onAuthStateChanged`, `signOut` y Firestore. El cliente toma el rol de `users/{uid}`; si se pide acceso de administrador y el perfil no lo tiene, cierra sesión y muestra “Esta cuenta no tiene permisos de administrador”.

Desactivar `users/{uid}` bloquea operaciones de Firestore mediante las reglas, pero no deshabilita por sí solo Firebase Authentication. Para impedir también nuevos inicios de sesión, se necesita una Cloud Function con Firebase Admin SDK o una operación administrativa segura del servidor. Nunca pongas credenciales privilegiadas en el navegador.

### Por qué hacen falta reglas

GitHub Pages entrega JavaScript público: quien visita la página puede inspeccionar o modificarlo, cambiar `localStorage` y llamar Firestore directamente. Ocultar un enlace o comprobar `role` en el cliente mejora la interfaz, pero no bloquea esas acciones. Firebase Authentication prueba la identidad y Firestore Rules valida en cada petición el UID, el rol guardado y la propiedad (`ownerId`). Prueba las reglas con Firebase Emulator Suite antes de usar datos reales.

## Probar los flujos

1. **Usuario:** en modo local, entra como `usuario@demo.com` con cualquier contraseña de ocho caracteres o más. En modo Firebase, crea una cuenta desde **Crear cuenta**. En **Trámites**, inicia “Preparar mi trámite de cédula”, completa cada paso y termina la práctica. Comprueba el registro en **Procesos**.
2. **Reserva:** abre **Fincas**, consulta una fecha, elige fecha y personas, y guarda la solicitud. Revisa su estado en **Procesos**.
3. **Lección:** en **Aprender**, abre una lección, usa “Escuchar lección” y márcala como aprendida. La voz depende de lo que admita tu navegador.
4. **Cuenta de cobro:** en **Cobros**, completa cliente, producto y total. Guarda y usa **Imprimir o guardar PDF** para abrir el diálogo de impresión del navegador.
5. **PQRS:** radica una solicitud como usuario y anota su número. Cierra sesión y entra como `admin@demo.com`; abre **Administración → PQRS**, actualiza estado y respuesta. Vuelve a entrar como usuario para consultar el radicado.
6. **Administración:** en **Usuarios**, cambia el rol de una cuenta de prueba. En **Contenido**, añade una finca, un trámite y una lección; aparecerán en sus respectivos módulos.

En modo local, los dos perfiles comparten el almacenamiento del navegador; los filtros son solo demostrativos. En modo Firebase, las reglas aíslan los registros por UID. Los datos de `localStorage` no se migran automáticamente a Firestore: revisa la propiedad antes de trasladar cualquier registro.

## Publicar gratis en GitHub Pages

1. Crea un repositorio público en GitHub y sube estos archivos a la rama `main`.
2. Abre **Settings → Pages** en el repositorio.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/(root)`; pulsa **Save**.
5. Espera la publicación y visita la dirección que GitHub Pages muestra en esa página.

No necesita proceso de compilación. Para autenticación y datos compartidos sí necesita un proyecto Firebase configurado y las reglas publicadas; las rutas relativas mantienen compatibilidad con repositorios de proyecto.

## Capturas

El repositorio no incluye capturas previas. Para generarlas, abre la página publicada y captura la vista móvil y escritorio de Inicio, Trámites, Fincas, Cobros y Administración.

## Aporte social

El prototipo pone el diseño inclusivo al servicio de la autonomía digital: invita a aprender sin temor a equivocarse, ayuda a organizar información para conversar con entidades y productores, y visibiliza experiencias rurales. Una futura implementación debe construirse con las comunidades, funcionar sin conexión donde sea posible y validar contenidos y alianzas con las entidades locales antes de presentarlos como oficiales.

## Commits sugeridos

```text
feat: crear estructura estática accesible de AgroConecta Rural
feat: añadir simuladores, catálogo rural y solicitudes de reserva
feat: agregar lecciones, cuentas de cobro y módulo PQRS
feat: habilitar paneles demo para usuario y administrador
style: definir identidad visual rural adaptable y de alto contraste
docs: explicar uso, límites de la demo y despliegue en GitHub Pages
```