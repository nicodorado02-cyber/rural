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
- **Administración:** panel para gestionar usuarios y roles, añadir trámites, fincas y lecciones, y responder PQRS.

## Accesibilidad y funcionamiento

HTML, CSS y JavaScript sin frameworks, paquetes ni descargas de fuentes. El texto base mide 18 px, los controles principales tienen al menos 48 px, hay navegación por teclado, etiquetas asociadas, anuncios para lectores de pantalla, ajuste de tamaño, modo claro/oscuro y respeto por la preferencia de movimiento reducido. Las fotos del catálogo usan enlaces de ejemplo a Unsplash y se ocultan si no cargan; el resto de la aplicación puede usarse sin ellas. Las marcas de entidades son rótulos tipográficos de demostración, no logos oficiales.

Los registros y la sesión se guardan en `localStorage` del navegador. No existe servidor, transmisión de datos, autenticación real ni sincronización entre dispositivos. No uses información privada. La demostración no reemplaza asesoría ni trámites oficiales.

## Estructura

```text
.
├── index.html       # Punto de entrada para GitHub Pages
├── assets/
│   ├── css/
│   │   └── styles.css # Diseño adaptable, temas y estilos de impresión
│   └── js/
│       ├── data.js    # Datos iniciales de demostración
│       └── app.js     # Navegación, módulos y almacenamiento local
├── WIREFRAMES.md    # Wireframes de baja fidelidad
└── README.md        # Documentación del proyecto
```

## Ejecutar en localhost

No requiere instalación, compilación, dependencias ni conexión a un servicio. La opción recomendada para probar `localStorage` es usar Python 3 si ya está disponible en tu equipo:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000` en tu navegador. Para detener el servidor, vuelve a la terminal y pulsa `Ctrl+C`. También puedes abrir `index.html` directamente; si el navegador limita el almacenamiento local en archivos `file://`, usa la opción de localhost.

Las cuentas de demo se crean al iniciar por primera vez:

| Rol | Correo |
| --- | --- |
| Administrador | `admin@demo.com` |
| Usuario | `usuario@demo.com` |

Pulsa el botón de la cuenta deseada en la pantalla de entrada; no hace falta conocer una clave. También puedes crear un usuario de prueba. La opción “Borrar datos del sitio” del navegador reinicia la demo.

## Probar los flujos

1. **Usuario:** entra como `usuario@demo.com`. En **Trámites**, inicia “Preparar mi trámite de cédula”, completa cada paso y termina la práctica. Comprueba el registro en **Procesos**.
2. **Reserva:** abre **Fincas**, consulta una fecha, elige fecha y personas, y guarda la solicitud. Revisa su estado en **Procesos**.
3. **Lección:** en **Aprender**, abre una lección, usa “Escuchar lección” y márcala como aprendida. La voz depende de lo que admita tu navegador.
4. **Cuenta de cobro:** en **Cobros**, completa cliente, producto y total. Guarda y usa **Imprimir o guardar PDF** para abrir el diálogo de impresión del navegador.
5. **PQRS:** radica una solicitud como usuario y anota su número. Cierra sesión y entra como `admin@demo.com`; abre **Administración → PQRS**, actualiza estado y respuesta. Vuelve a entrar como usuario para consultar el radicado.
6. **Administración:** en **Usuarios**, cambia el rol de una cuenta de prueba. En **Contenido**, añade una finca, un trámite y una lección; aparecerán en sus respectivos módulos.

Los dos roles comparten el almacenamiento de ese navegador porque no existe servidor. Usa contenido ficticio durante la demostración.

## Publicar gratis en GitHub Pages

1. Crea un repositorio público en GitHub y sube estos archivos a la rama `main`.
2. Abre **Settings → Pages** en el repositorio.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/(root)`; pulsa **Save**.
5. Espera la publicación y visita la dirección que GitHub Pages muestra en esa página.

No necesita secretos, backend ni proceso de compilación. Las rutas relativas mantienen compatibilidad con repositorios de proyecto.

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