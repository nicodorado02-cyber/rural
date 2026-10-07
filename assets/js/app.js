(() => {
  const main = document.querySelector("#main-content");
  const nav = document.querySelector("#primary-nav");
  const logoutButton = document.querySelector("#logout-button");
  const fontToggle = document.querySelector("#font-toggle");
  const themeToggle = document.querySelector("#theme-toggle");
  const storageKey = "agroconecta-demo-v1";
  const pages = [
    ["home", "Inicio", "⌂"], ["procedures", "Trámites", "▤"], ["tourism", "Fincas", "⌖"],
    ["learning", "Aprender", "Aa"], ["billing", "Cobros", "$"], ["processes", "Procesos", "✓"],
    ["pqrs", "PQRS", "♡"], ["contact", "Contacto", "i"]
  ];
  const adminPage = ["admin", "Administración", "⚙"];
  let state = loadState();
  let view = state.session ? "home" : "login";
  let loginMode = false;
  let selectedProcedure = "";
  let procedureStep = 0;
  let procedureAnswers = [];
  let bookingFarm = "";
  let invoiceStep = 0;
  let adminTab = "overview";
  let invoiceDraft = { name: "", document: "", product: "", quantity: 1, price: 0, note: "" };

  function defaults() {
    return {
      session: null,
      users: [
        { email: "admin@demo.com", name: "Rosa Administradora", role: "admin" },
        { email: "usuario@demo.com", name: "María Productora", role: "user" }
      ],
      procedures: window.AgroData.procedures,
      farms: window.AgroData.farms,
      lessons: window.AgroData.lessons,
      completions: [], bookings: [], invoices: [], pqrs: []
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return defaults();
      const initial = defaults();
      return {
        ...initial,
        ...saved,
        procedures: mergeCatalog(initial.procedures, saved.procedures),
        farms: mergeCatalog(initial.farms, saved.farms),
        lessons: mergeCatalog(initial.lessons, saved.lessons)
      };
    } catch (error) {
      return defaults();
    }
  }

  function mergeCatalog(initialItems, savedItems = []) {
    const stored = new Map(savedItems.map((item) => [item.id, item]));
    const initialIds = new Set(initialItems.map((item) => item.id));
    return [
      ...initialItems.map((item) => ({ ...item, ...stored.get(item.id) })),
      ...savedItems.filter((item) => !initialIds.has(item.id))
    ];
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (error) { announce("No fue posible guardar los cambios en este navegador."); }
  }

  function announce(message) {
    const live = document.querySelector("#live-message");
    if (live) live.textContent = message;
  }

  function esc(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function money(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString().slice(-7)}-${Math.floor(Math.random() * 90 + 10)}`;
  }

  function isAdmin() { return state.session?.role === "admin"; }

  function setRoute(route) {
    view = route;
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  function renderNav() {
    const items = isAdmin() ? [...pages, adminPage] : pages;
    nav.innerHTML = items.map(([id, label, icon]) => `<a class="nav-link" href="#${id}" data-route="${id}" ${view === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span> ${label}</a>`).join("");
    nav.hidden = !state.session;
    logoutButton.hidden = !state.session;
  }

  function render() {
    renderNav();
    if (!state.session) view = "login";
    const renderers = {
      login: renderLogin, home: renderHome, procedures: renderProcedures, tourism: renderTourism,
      learning: renderLearning, billing: renderBilling, processes: renderProcesses,
      pqrs: renderPqrs, contact: renderContact, admin: renderAdmin
    };
    main.innerHTML = (renderers[view] || renderHome)();
    if (view === "admin" && !isAdmin()) { view = "home"; render(); }
  }

  function renderLogin() {
    return `<div class="page-wrap"><div class="login-layout">
      <section class="login-intro"><p class="eyebrow">Tecnología cercana, vida rural</p><h1>Tu campo, más conectado.</h1>
      <p class="lead">Practica trámites, comparte lo que haces y aprende a tu ritmo. Un paso sencillo a la vez.</p>
      <div class="login-art" role="img" aria-label="Ilustración de montañas y campos de cultivo"></div></section>
      <section class="login-panel" aria-labelledby="login-title"><h2 id="login-title">${loginMode ? "Crear una cuenta" : "Bienvenido, bienvenida"}</h2>
      <p class="muted">${loginMode ? "Regístrate para empezar. No pedimos datos sensibles." : "Entra con tu correo o prueba una cuenta."}</p>
      <form id="login-form" novalidate>
        ${loginMode ? `<div class="field"><label for="login-name">Tu nombre</label><input id="login-name" name="name" autocomplete="name" required></div>` : ""}
        <div class="field"><label for="login-email">Correo electrónico</label><input id="login-email" name="email" type="email" autocomplete="email" required placeholder="nombre@correo.com"></div>
        <div class="field"><label for="login-password">Clave de prueba</label><input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="4"><span class="field-help">Demo local: puedes escribir cualquier clave de 4 caracteres.</span></div>
        <p class="form-error" id="login-error" role="alert" hidden></p>
        <button class="button" type="submit">${loginMode ? "Crear mi cuenta" : "Entrar"}</button>
      </form>
      ${loginMode ? "" : `<div class="demo-options"><button class="button secondary" type="button" data-login="usuario@demo.com">Entrar como usuario</button><button class="button secondary" type="button" data-login="admin@demo.com">Entrar como administrador</button></div>`}
      <button class="text-button" type="button" data-action="toggle-register">${loginMode ? "Ya tengo una cuenta" : "Crear una cuenta nueva"}</button>
      <p class="hint">Tus datos se guardan solo en este dispositivo. Este sitio es una demostración, no realiza trámites oficiales.</p>
      </section></div></div>`;
  }

  function renderHome() {
    const name = state.session.name.split(" ")[0];
    const recent = [...state.completions, ...state.bookings, ...state.invoices, ...state.pqrs].slice(-3).reverse();
    const titles = { procedure: "Práctica de trámite", booking: "Reserva", invoice: "Cuenta de cobro", pqrs: "Solicitud PQRS" };
    return `<div class="page-wrap"><section class="welcome-band"><div><p class="eyebrow">Bienvenida, ${esc(name)}</p><h1>¿Qué necesitas hacer hoy?</h1><p class="lead">Elige una opción y te acompañamos paso a paso.</p></div><div class="welcome-art" role="img" aria-label="Lomas verdes de cultivo"></div></section>
      <div class="grid grid-3">
        ${tile("procedures", "▤", "Practicar un trámite", "Ensaya sin riesgo y a tu ritmo.")}
        ${tile("tourism", "⌖", "Mostrar mi finca", "Conoce experiencias del campo.")}
        ${tile("learning", "Aa", "Aprender con el celular", "Lecciones claras con lectura en voz alta.")}
        ${tile("billing", "$", "Hacer una cuenta de cobro", "Organiza cliente, producto y total.")}
        ${tile("processes", "✓", "Ver mis procesos", "Consulta lo que has hecho.")}
        ${tile("pqrs", "♡", "Pedir ayuda", "Escribe una solicitud y sigue su estado.")}
      </div>
      <div class="section-title"><h2>Mis actividades recientes</h2><a href="#processes" data-route="processes">Ver todo</a></div>
      <section class="panel">${recent.length ? `<ul class="record-list">${recent.map((item) => `<li><span>${esc(titles[item.type] || "Actividad")} · ${esc(item.label || item.number || item.name || "Registrada")}</span><span class="status ${item.status === "Completado" ? "done" : ""}">${esc(item.status || "Guardado")}</span></li>`).join("")}</ul>` : `<p class="muted">Aquí aparecerán tus trámites de práctica, reservas y solicitudes.</p>`}</section>
      ${isAdmin() ? `<p class="button-row"><a class="button secondary" href="#admin" data-route="admin">Abrir administración</a></p>` : ""}</div>`;
  }

  function tile(route, icon, title, description) {
    return `<a class="tile" href="#${route}" data-route="${route}"><span class="tile-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${description}</span></a>`;
  }

  function renderProcedures() {
    if (!selectedProcedure) return `<div class="page-wrap"><p class="eyebrow">Practica sin riesgo</p><h1 class="page-heading">Trámites paso a paso</h1><p class="lead">Esto es una práctica guiada: no envía información a ninguna entidad.</p>
      <div class="grid grid-2">${state.procedures.map((item) => `<article class="panel"><p class="eyebrow">${esc(item.organization)}</p><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><button class="button" type="button" data-procedure="${esc(item.id)}">Empezar práctica</button></article>`).join("")}</div>
      <div class="section-title"><h2>Alianzas públicas</h2></div>${alliesMarkup()}</div>`;
    const procedure = state.procedures.find((item) => item.id === selectedProcedure);
    if (!procedure) { selectedProcedure = ""; return renderProcedures(); }
    const total = procedure.steps.length;
    const prompt = procedure.steps[procedureStep];
    const isReview = procedureStep === total - 1;
    const currentValue = procedureAnswers[procedureStep] || "";
    return `<div class="page-wrap"><p class="eyebrow">Práctica · ${esc(procedure.organization)}</p><h1 class="page-heading">${esc(procedure.name)}</h1>
      <ol class="step-indicator" aria-label="Progreso del trámite">${procedure.steps.map((step, index) => `<li class="${index === procedureStep ? "current" : index < procedureStep ? "complete" : ""}" ${index === procedureStep ? 'aria-current="step"' : ""}><span class="step-number">${index + 1}</span><span>${index === total - 1 ? "Revisar" : `Paso ${index + 1}`}</span></li>`).join("")}</ol>
      <div class="progress-track" role="progressbar" aria-label="Progreso de la práctica" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${procedureStep + 1}"><span style="width:${Math.round(((procedureStep + 1) / total) * 100)}%"></span></div>
      <section class="panel" aria-live="polite"><h2>${isReview ? "Revisa tu práctica" : esc(prompt)}</h2>
      ${isReview ? `<p>Has llegado al final de la práctica. Tus respuestas de ejemplo no se envían a ninguna entidad.</p><ul>${procedure.steps.slice(0, -1).map((step, index) => `<li><strong>${esc(step)}</strong><br>${esc(procedureAnswers[index] || "Sin respuesta")}</li>`).join("")}</ul><p class="success-message">¡Muy bien! Ya conoces los pasos para prepararte.</p>` : `<div class="field"><label for="procedure-answer">${esc(prompt)}</label><input id="procedure-answer" value="${esc(currentValue)}" placeholder="Escribe tu respuesta" autocomplete="off"><span class="field-help">Ejemplo: ${procedure.id === "rut" && procedureStep === 2 ? "cultivo y venta de café" : "escribe la información que recuerdes"}.</span></div><p class="hint">No escribas claves, números bancarios ni información privada.</p>`}
      <div class="button-row"><button class="button secondary" type="button" data-action="procedure-back">${procedureStep ? "Paso anterior" : "Ver otros trámites"}</button>${isReview ? `<button class="button" type="button" data-action="procedure-finish">Terminar práctica</button>` : `<button class="button" type="button" data-action="procedure-next">${procedureStep === total - 2 ? "Revisar" : "Continuar"}</button>`}</div></section></div>`;
  }

  function alliesMarkup() {
    return `<div class="allies">${window.AgroData.allies.map((ally) => `<a class="ally" href="${esc(ally.url)}" target="_blank" rel="noopener noreferrer"><span class="ally-mark" aria-hidden="true">${esc(ally.mark || ally.name.slice(0, 4))}</span><strong>${esc(ally.name)}</strong><span>${esc(ally.detail)}</span></a>`).join("")}</div><p class="hint">Entidades de referencia y logos tipográficos de ejemplo. La mención no implica una alianza oficial.</p>`;
  }

  function renderTourism() {
    const farm = state.farms.find((item) => item.id === bookingFarm);
    return `<div class="page-wrap"><p class="eyebrow">Experiencias de nuestra tierra</p><h1 class="page-heading">Fincas y agroturismo</h1><p class="lead">Conoce iniciativas rurales. Los precios son de ejemplo y la reserva es una solicitud de demostración.</p>
      ${farm ? `<section class="panel" aria-labelledby="booking-heading"><h2 id="booking-heading">Solicitar visita a ${esc(farm.name)}</h2><form id="booking-form"><input type="hidden" name="farmId" value="${esc(farm.id)}"><div class="grid grid-2"><div class="field"><label for="booking-date">Fecha que prefieres</label><input id="booking-date" name="date" type="date" required min="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label for="booking-people">Número de personas</label><input id="booking-people" name="people" type="number" min="1" max="20" value="2" required></div></div><div class="field"><label for="booking-phone">Teléfono de contacto</label><input id="booking-phone" name="phone" type="tel" autocomplete="tel" required></div><p class="hint">La solicitud queda guardada en este dispositivo; no se envía a la finca.</p><div class="button-row"><button class="button" type="submit">Guardar solicitud</button><button class="button secondary" type="button" data-action="cancel-booking">Volver a las fincas</button></div></form></section>` : ""}
      <div class="grid grid-3">${state.farms.map((item) => `<article class="farm-card"><img class="farm-photo" src="${esc(item.image || "")}" alt="${esc(item.alt || item.name)}" loading="lazy" onerror="this.hidden=true"><div class="farm-content"><p class="eyebrow">${esc(item.category)}</p><h3>${esc(item.name)}</h3><p class="farm-meta">⌖ ${esc(item.place)}</p><p>${esc(item.description)}</p><p class="price">${money(item.price)} <span class="muted">/ persona</span></p><button class="button" type="button" data-book="${esc(item.id)}">Consultar fecha</button></div></article>`).join("")}</div></div>`;
  }

  function renderLearning() {
    const done = state.completions.filter((item) => item.type === "lesson").map((item) => item.label);
    return `<div class="page-wrap"><p class="eyebrow">Aprende a tu ritmo</p><h1 class="page-heading">Aprender con el celular</h1><p class="lead">Lecciones breves y claras. Pulsa “Escuchar” para oír el texto en voz alta.</p>
      <div class="grid grid-2">${state.lessons.map((lesson) => `<article class="panel lesson-card"><span class="lesson-number" aria-hidden="true">${esc(lesson.icon || "Aa")}</span><h2>${esc(lesson.title)}</h2><p>${esc(lesson.description)}</p><div class="button-row"><button class="button secondary" type="button" data-speak="${esc(lesson.id)}">Escuchar lección</button><button class="button" type="button" data-lesson-done="${esc(lesson.id)}">${done.includes(lesson.id) ? "Lección completada" : "Marcar como aprendida"}</button></div><details><summary>Leer la lección</summary><p>${esc(lesson.body)}</p></details></article>`).join("")}</div><p class="hint" id="speech-status" aria-live="polite">La lectura en voz alta depende de las opciones de voz de tu dispositivo.</p></div>`;
  }

  function renderBilling() {
    const steps = ["Cliente", "Productos", "Total"];
    const stepNav = `<ol class="step-indicator" aria-label="Pasos para crear una cuenta">${steps.map((label, index) => `<li class="${index === invoiceStep ? "current" : index < invoiceStep ? "complete" : ""}" ${index === invoiceStep ? 'aria-current="step"' : ""}><span class="step-number">${index + 1}</span><span>${label}</span></li>`).join("")}</ol>`;
    let formContent = "";
    if (invoiceStep === 0) formContent = `<h2>¿A quién le cobras?</h2><div class="field"><label for="invoice-name">Nombre del cliente</label><input id="invoice-name" name="name" value="${esc(invoiceDraft.name)}" required autocomplete="name"></div><div class="field"><label for="invoice-document">Documento (opcional)</label><input id="invoice-document" name="document" value="${esc(invoiceDraft.document)}" autocomplete="off"></div><div class="field"><label for="invoice-note">Descripción (opcional)</label><input id="invoice-note" name="note" value="${esc(invoiceDraft.note)}" placeholder="Ejemplo: venta de cosecha"></div>`;
    if (invoiceStep === 1) formContent = `<h2>¿Qué producto o servicio?</h2><div class="field"><label for="invoice-product">Producto o servicio</label><input id="invoice-product" name="product" value="${esc(invoiceDraft.product)}" required placeholder="Ejemplo: canastilla de tomate"></div><div class="grid grid-2"><div class="field"><label for="invoice-quantity">Cantidad</label><input id="invoice-quantity" name="quantity" type="number" min="1" value="${Number(invoiceDraft.quantity) || 1}" required></div><div class="field"><label for="invoice-price">Precio por unidad (pesos)</label><input id="invoice-price" name="price" type="number" min="0" value="${Number(invoiceDraft.price) || ""}" required></div></div><p class="hint">Total: ${money((Number(invoiceDraft.quantity) || 0) * (Number(invoiceDraft.price) || 0))}</p>`;
    if (invoiceStep === 2) formContent = `<h2>Revisa tu cuenta de cobro</h2><div class="print-only"><p>AgroConecta Rural · Cuenta de cobro</p></div><dl><dt>Cliente</dt><dd>${esc(invoiceDraft.name)}</dd><dt>Documento</dt><dd>${esc(invoiceDraft.document || "No indicado")}</dd><dt>Concepto</dt><dd>${esc(invoiceDraft.product)} ${invoiceDraft.note ? `· ${esc(invoiceDraft.note)}` : ""}</dd><dt>Cantidad</dt><dd>${Number(invoiceDraft.quantity) || 0}</dd><dt>Valor unitario</dt><dd>${money(invoiceDraft.price)}</dd><dt>Total</dt><dd><strong>${money((Number(invoiceDraft.quantity) || 0) * (Number(invoiceDraft.price) || 0))}</strong></dd></dl><p class="notice">Esta cuenta de cobro es una ayuda para organizar tus ventas. No es una factura electrónica ni reemplaza los requisitos de la DIAN.</p>`;
    return `<div class="page-wrap"><p class="eyebrow">Tus ventas, más sencillas</p><h1 class="page-heading">Cuenta de cobro</h1><p class="lead">En tres pasos puedes organizar un cobro para imprimir o guardar como PDF.</p><div class="grid grid-2"><section class="panel">${stepNav}<form id="invoice-form">${formContent}<div class="button-row">${invoiceStep ? `<button class="button secondary" type="button" data-action="invoice-back">Volver</button>` : ""}<button class="button" type="submit">${invoiceStep === 2 ? "Guardar cuenta" : invoiceStep === 1 ? "Ver total" : "Continuar"}</button>${invoiceStep === 2 ? `<button class="button secondary" type="button" data-action="print">Imprimir o guardar PDF</button>` : ""}</div></form></section>
      <section class="panel"><h2>Mis cuentas guardadas</h2>${state.invoices.length ? `<ul class="record-list">${[...state.invoices].reverse().map((invoice) => `<li><span>${esc(invoice.number)} · ${esc(invoice.name)}<br><strong>${money(invoice.total)}</strong></span><button class="button secondary small" type="button" data-print-invoice="${esc(invoice.id)}">Imprimir</button></li>`).join("")}</ul>` : `<p class="muted">Aquí verás las cuentas de cobro que guardes.</p>`}</section></div></div>`;
  }

  function renderProcesses() {
    const records = [
      ...state.completions.map((item) => ({ ...item, date: item.date || "" })),
      ...state.bookings.map((item) => ({ ...item, label: `Visita a ${item.name} · ${item.date}`, type: "booking" })),
      ...state.invoices.map((item) => ({ ...item, label: `${item.number} · ${item.name}`, type: "invoice" })),
      ...state.pqrs.map((item) => ({ ...item, label: `${item.number} · ${item.subject}`, type: "pqrs" }))
    ].reverse();
    return `<div class="page-wrap"><p class="eyebrow">Tu actividad</p><h1 class="page-heading">Mis procesos</h1><p class="lead">Consulta tus prácticas, reservas y solicitudes guardadas en este dispositivo.</p><section class="panel">${records.length ? `<ul class="record-list">${records.map((item) => `<li><span><strong>${esc(item.label || "Actividad")}</strong><br><span class="muted">${esc(item.date || "Fecha no disponible")}</span></span><span class="status ${item.status === "Completado" ? "done" : ""}">${esc(item.status || "Guardado")}</span></li>`).join("")}</ul>` : `<p>Aún no tienes actividades. Puedes empezar con una práctica de trámite o una lección.</p><a class="button" href="#procedures" data-route="procedures">Ver trámites</a>`}</section></div>`;
  }

  function renderPqrs() {
    return `<div class="page-wrap"><p class="eyebrow">Estamos para escucharte</p><h1 class="page-heading">Peticiones y ayuda</h1><p class="lead">Cuéntanos qué necesitas. Recibirás un número de radicado para consultar el estado en este dispositivo.</p><div class="grid grid-2"><section class="panel"><h2>Escribir una solicitud</h2><form id="pqrs-form"><div class="field"><label for="pqrs-type">Tipo de solicitud</label><select id="pqrs-type" name="type"><option>Petición</option><option>Queja</option><option>Reclamo</option><option>Sugerencia</option></select></div><div class="field"><label for="pqrs-subject">Tema</label><input id="pqrs-subject" name="subject" required maxlength="80"></div><div class="field"><label for="pqrs-message">¿Cómo podemos ayudarte?</label><textarea id="pqrs-message" name="message" required maxlength="1000"></textarea></div><button class="button" type="submit">Radicar solicitud</button><p class="hint">No incluyas claves ni datos bancarios. La solicitud no se transmite a una entidad real.</p></form></section>
      <section class="panel"><h2>Mis radicados</h2>${state.pqrs.length ? `<ul class="record-list">${[...state.pqrs].reverse().map((item) => `<li><span><strong>${esc(item.number)}</strong><br>${esc(item.type)} · ${esc(item.subject)}</span><span class="status">${esc(item.status)}</span></li>`).join("")}</ul>` : `<p class="muted">Cuando radiques una solicitud, aparecerá aquí su número y estado.</p>`}</section></div></div>`;
  }

  function renderContact() {
    return `<div class="page-wrap"><p class="eyebrow">Cerca de ti</p><h1 class="page-heading">Contacto y alianzas</h1><p class="lead">Busca orientación en los canales oficiales de tu municipio o de la entidad correspondiente.</p><div class="notice">AgroConecta Rural es un prototipo educativo. Los enlaces son informativos y las entidades aquí mencionadas no necesariamente tienen una alianza con este proyecto.</div><div class="section-title"><h2>Entidades para consultar</h2></div>${alliesMarkup()}<div class="section-title"><h2>¿Necesitas ayuda con esta plataforma?</h2></div><section class="panel"><p>Radica una petición en la sección PQRS. En esta demostración el mensaje solo se guarda en tu dispositivo.</p><a class="button" href="#pqrs" data-route="pqrs">Ir a PQRS</a></section></div>`;
  }

  function renderAdmin() {
    if (!isAdmin()) return "";
    const counts = [["Cuentas de usuario", state.users.length], ["Fincas publicadas", state.farms.length], ["Trámites de práctica", state.procedures.length], ["PQRS pendientes", state.pqrs.filter((item) => item.status !== "Respondida").length]];
    const tabs = [["overview", "Resumen"], ["users", "Usuarios"], ["content", "Contenido"], ["pqrs", "PQRS"]];
    let body = "";
    if (adminTab === "overview") body = `<div class="grid grid-2">${counts.map(([label, number]) => `<div class="stat"><strong>${number}</strong><span>${label}</span></div>`).join("")}</div><p class="hint">Los datos son locales a este navegador y sirven para demostrar los roles.</p>`;
    if (adminTab === "users") body = `<h2>Usuarios de demostración</h2><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>${state.users.map((user, index) => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td><label class="sr-only" for="role-${index}">Rol de ${esc(user.email)}</label><select id="role-${index}" data-user-role="${esc(user.email)}"><option value="user" ${user.role !== "admin" ? "selected" : ""}>Usuario</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option></select></td></tr>`).join("")}</tbody></table></div>`;
    if (adminTab === "content") body = `<h2>Administrar el contenido de esta demo</h2><div class="grid grid-3"><form class="panel" id="add-farm-form"><h3>Añadir una finca</h3><div class="field"><label for="new-farm-name">Nombre</label><input id="new-farm-name" name="name" required></div><div class="field"><label for="new-farm-place">Municipio</label><input id="new-farm-place" name="place" required></div><div class="field"><label for="new-farm-price">Precio de ejemplo</label><input id="new-farm-price" name="price" type="number" min="0" required></div><button class="button" type="submit">Añadir finca</button></form>
      <form class="panel" id="add-procedure-form"><h3>Añadir un trámite de práctica</h3><div class="field"><label for="new-procedure-name">Nombre</label><input id="new-procedure-name" name="name" required></div><div class="field"><label for="new-procedure-org">Entidad de referencia</label><input id="new-procedure-org" name="organization" required></div><button class="button" type="submit">Añadir trámite</button></form>
      <form class="panel" id="add-lesson-form"><h3>Añadir una lección</h3><div class="field"><label for="new-lesson-name">Título</label><input id="new-lesson-name" name="title" required></div><div class="field"><label for="new-lesson-body">Texto para leer y escuchar</label><textarea id="new-lesson-body" name="body" required></textarea></div><button class="button" type="submit">Añadir lección</button></form></div><p class="hint">Las fincas añadidas muestran texto; no solicitan imágenes externas.</p>`;
    if (adminTab === "pqrs") body = `<h2>Todas las solicitudes</h2>${state.pqrs.length ? `<div class="table-wrap"><table><thead><tr><th>Radicado</th><th>Solicitud</th><th>Mensaje</th><th>Estado / respuesta</th></tr></thead><tbody>${state.pqrs.map((item) => `<tr><td>${esc(item.number)}</td><td>${esc(item.type)} · ${esc(item.subject)}<br><span class="muted">${esc(item.email)}</span></td><td>${esc(item.message)}</td><td><label class="sr-only" for="status-${esc(item.id)}">Estado de ${esc(item.number)}</label><select id="status-${esc(item.id)}" data-pqrs-status="${esc(item.id)}"><option ${item.status === "Recibida" ? "selected" : ""}>Recibida</option><option ${item.status === "En revisión" ? "selected" : ""}>En revisión</option><option ${item.status === "Respondida" ? "selected" : ""}>Respondida</option></select><label class="sr-only" for="reply-${esc(item.id)}">Respuesta para ${esc(item.number)}</label><input class="inline-field" id="reply-${esc(item.id)}" data-pqrs-reply="${esc(item.id)}" value="${esc(item.reply || "")}" placeholder="Escribir respuesta"><button class="button small" type="button" data-reply="${esc(item.id)}">Guardar respuesta</button></td></tr>`).join("")}</tbody></table></div>` : `<p>No hay solicitudes por responder.</p>`}`;
    return `<div class="page-wrap"><p class="eyebrow">Herramientas de administración</p><h1 class="page-heading">Administración</h1><p class="lead">Resumen y gestión local de la demostración.</p><div class="admin-tools" role="group" aria-label="Secciones de administración">${tabs.map(([id, label]) => `<button class="button secondary small" type="button" data-admin-tab="${id}" aria-pressed="${adminTab === id}">${label}</button>`).join("")}</div><section class="panel">${body}</section></div>`;
  }

  function login(email) {
    const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!user) return false;
    state.session = { ...user };
    save();
    view = "home";
    render();
    main.focus({ preventScroll: true });
    return true;
  }

  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]");
    if (route) { event.preventDefault(); setRoute(route.dataset.route); return; }
    const loginButton = event.target.closest("[data-login]");
    if (loginButton) { login(loginButton.dataset.login); return; }
    const procedure = event.target.closest("[data-procedure]");
    if (procedure) { selectedProcedure = procedure.dataset.procedure; procedureStep = 0; procedureAnswers = []; setRoute("procedures"); return; }
    const booking = event.target.closest("[data-book]");
    if (booking) { bookingFarm = booking.dataset.book; render(); document.querySelector("#booking-heading")?.focus(); return; }
    const lessonDone = event.target.closest("[data-lesson-done]");
    if (lessonDone) {
      const lesson = state.lessons.find((item) => item.id === lessonDone.dataset.lessonDone);
      if (lesson && !state.completions.some((item) => item.type === "lesson" && item.label === lesson.id)) state.completions.push({ type: "lesson", label: lesson.id, status: "Completado", date: new Date().toLocaleDateString("es-CO") });
      save(); render(); announce("¡Muy bien! Lección marcada como aprendida."); return;
    }
    const speak = event.target.closest("[data-speak]");
    if (speak) {
      const lesson = state.lessons.find((item) => item.id === speak.dataset.speak);
      const status = document.querySelector("#speech-status");
      if ("speechSynthesis" in window && lesson) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`${lesson.title}. ${lesson.body}`);
        utterance.lang = "es-CO";
        window.speechSynthesis.speak(utterance);
        status.textContent = "Leyendo la lección en voz alta.";
      } else if (status) status.textContent = "Tu navegador no ofrece lectura en voz alta. Puedes leer el texto en pantalla.";
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "toggle-register") { loginMode = !loginMode; render(); return; }
    if (action === "procedure-back") {
      if (procedureStep > 0) procedureStep -= 1;
      else selectedProcedure = "";
      render(); return;
    }
    if (action === "procedure-next") {
      const answer = document.querySelector("#procedure-answer");
      if (!answer?.value.trim()) { answer?.focus(); answer?.setCustomValidity("Escribe una respuesta para continuar."); answer?.reportValidity(); return; }
      procedureAnswers[procedureStep] = answer.value.trim();
      procedureStep += 1; render(); document.querySelector("#procedure-answer")?.focus(); return;
    }
    if (action === "procedure-finish") {
      const item = state.procedures.find((entry) => entry.id === selectedProcedure);
      state.completions.push({ type: "procedure", label: item?.name || "Trámite", status: "Completado", date: new Date().toLocaleDateString("es-CO") });
      save(); selectedProcedure = ""; procedureAnswers = []; setRoute("procedures"); announce("¡Muy bien! Terminaste la práctica."); return;
    }
    if (action === "cancel-booking") { bookingFarm = ""; render(); return; }
    if (action === "invoice-back") { invoiceStep = Math.max(0, invoiceStep - 1); render(); return; }
    if (action === "print") { window.print(); return; }
    const printInvoice = event.target.closest("[data-print-invoice]");
    if (printInvoice) { printSavedInvoice(printInvoice.dataset.printInvoice); return; }
    const admin = event.target.closest("[data-admin-tab]");
    if (admin) { adminTab = admin.dataset.adminTab; render(); return; }
    const reply = event.target.closest("[data-reply]");
    if (reply) { saveReply(reply.dataset.reply); return; }
  });

  main.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.id === "login-form") {
      const values = formValues(form);
      const email = values.email.trim().toLowerCase();
      const error = document.querySelector("#login-error");
      if (loginMode) {
        if (state.users.some((user) => user.email.toLowerCase() === email)) { error.textContent = "Ya existe una cuenta con ese correo. Prueba entrar."; error.hidden = false; return; }
        const user = { email, name: values.name.trim(), role: "user" };
        if (!user.name || !email || values.password.length < 4) { error.textContent = "Completa tu nombre, correo y una clave de al menos 4 caracteres."; error.hidden = false; return; }
        state.users.push(user); save(); login(email);
      } else if (!login(email)) { error.textContent = "No encontramos ese correo. Usa una cuenta demo o crea una cuenta."; error.hidden = false; }
      return;
    }
    if (form.id === "booking-form") {
      const values = formValues(form);
      const farm = state.farms.find((item) => item.id === values.farmId);
      state.bookings.push({ type: "booking", id: makeId("res"), name: farm?.name || "Finca", date: values.date, people: values.people, phone: values.phone, status: "Solicitud guardada", label: farm?.name || "Finca" });
      save(); bookingFarm = ""; setRoute("processes"); announce("Solicitud de reserva guardada en este dispositivo."); return;
    }
    if (form.id === "invoice-form") {
      const values = formValues(form);
      if (invoiceStep === 0) {
        invoiceDraft = { ...invoiceDraft, name: values.name.trim(), document: values.document.trim(), note: values.note.trim() };
        if (!invoiceDraft.name) return;
        invoiceStep = 1; render(); document.querySelector("#invoice-product")?.focus(); return;
      }
      if (invoiceStep === 1) {
        invoiceDraft = { ...invoiceDraft, product: values.product.trim(), quantity: Math.max(1, Number(values.quantity)), price: Math.max(0, Number(values.price)) };
        if (!invoiceDraft.product || !Number.isFinite(invoiceDraft.price)) return;
        invoiceStep = 2; render(); return;
      }
      const total = Number(invoiceDraft.quantity) * Number(invoiceDraft.price);
      const invoice = { id: makeId("fac"), type: "invoice", number: `CC-${Date.now().toString().slice(-6)}`, name: invoiceDraft.name, document: invoiceDraft.document, product: invoiceDraft.product, quantity: invoiceDraft.quantity, price: invoiceDraft.price, note: invoiceDraft.note, total, status: "Guardada", date: new Date().toLocaleDateString("es-CO") };
      state.invoices.push(invoice); save(); invoiceStep = 0; invoiceDraft = { name: "", document: "", product: "", quantity: 1, price: 0, note: "" }; render(); announce(`Cuenta ${invoice.number} guardada.`); return;
    }
    if (form.id === "pqrs-form") {
      const values = formValues(form);
      const item = { id: makeId("pqrs"), type: "pqrs", number: `AC-${Date.now().toString().slice(-6)}`, email: state.session.email, ...values, status: "Recibida", date: new Date().toLocaleDateString("es-CO") };
      state.pqrs.push(item); save(); setRoute("pqrs"); announce(`Solicitud radicada con el número ${item.number}.`); return;
    }
    if (form.id === "add-farm-form") {
      const values = formValues(form);
      state.farms.push({ id: makeId("finca"), name: values.name.trim(), place: values.place.trim(), price: Number(values.price), category: "Nueva experiencia", description: "Experiencia rural añadida por administración.", image: "", alt: values.name });
      save(); render(); announce("Finca añadida."); return;
    }
    if (form.id === "add-procedure-form") {
      const values = formValues(form);
      state.procedures.push({ id: makeId("tramite"), name: values.name.trim(), organization: values.organization.trim(), description: "Práctica guiada de ejemplo.", steps: ["¿Cuál es tu nombre?", "¿En qué municipio vives?", "¿Qué información necesitas preparar?", "Revisa tus respuestas"] });
      save(); render(); announce("Trámite de práctica añadido."); return;
    }
    if (form.id === "add-lesson-form") {
      const values = formValues(form);
      state.lessons.push({ id: makeId("leccion"), title: values.title.trim(), icon: "05", description: "Lección añadida por administración.", body: values.body.trim() });
      save(); render(); announce("Lección añadida.");
    }
  });

  main.addEventListener("change", (event) => {
    const roleSelect = event.target.closest("[data-user-role]");
    if (roleSelect && isAdmin()) {
      const user = state.users.find((item) => item.email === roleSelect.dataset.userRole);
      if (user) { user.role = roleSelect.value; save(); if (user.email === state.session.email) state.session.role = user.role; render(); }
    }
    const statusSelect = event.target.closest("[data-pqrs-status]");
    if (statusSelect && isAdmin()) {
      const item = state.pqrs.find((entry) => entry.id === statusSelect.dataset.pqrsStatus);
      if (item) { item.status = statusSelect.value; save(); }
    }
  });

  function saveReply(id) {
    const item = state.pqrs.find((entry) => entry.id === id);
    const input = document.querySelector(`[data-pqrs-reply="${CSS.escape(id)}"]`);
    if (!item || !input) return;
    item.reply = input.value.trim();
    if (item.reply) item.status = "Respondida";
    save(); render(); announce("Respuesta guardada.");
  }

  function printSavedInvoice(id) {
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice) return;
    const original = main.innerHTML;
    main.innerHTML = `<div class="page-wrap"><section class="panel"><div class="print-only"><p>AgroConecta Rural · Cuenta de cobro</p></div><p class="eyebrow">Cuenta de cobro ${esc(invoice.number)}</p><h1 class="page-heading">${esc(invoice.name)}</h1><p>Documento: ${esc(invoice.document || "No indicado")}</p><p>Concepto: ${esc(invoice.product)} · Cantidad: ${invoice.quantity}</p><p>Valor unitario: ${money(invoice.price)}</p><p><strong>Total: ${money(invoice.total)}</strong></p><p>${esc(invoice.note || "")}</p><p class="notice">Documento de apoyo. No es una factura electrónica.</p><button class="button no-print" type="button" onclick="window.print()">Imprimir o guardar PDF</button><button class="button secondary no-print" type="button" id="return-billing">Volver</button></section></div>`;
    document.querySelector("#return-billing").addEventListener("click", () => { main.innerHTML = original; });
  }

  logoutButton.addEventListener("click", () => { state.session = null; save(); view = "login"; selectedProcedure = ""; render(); });
  fontToggle.addEventListener("click", () => {
    const large = document.body.classList.toggle("large-text");
    fontToggle.setAttribute("aria-label", large ? "Restablecer tamaño del texto" : "Aumentar tamaño del texto");
    fontToggle.textContent = large ? "A−" : "A+";
    try { localStorage.setItem("agroconecta-large-text", String(large)); } catch (error) { /* Preferencia temporal. */ }
  });
  themeToggle.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark-mode");
    themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    try { localStorage.setItem("agroconecta-dark-mode", String(dark)); } catch (error) { /* Preferencia temporal. */ }
  });
  try {
    if (localStorage.getItem("agroconecta-large-text") === "true") {
      document.body.classList.add("large-text");
      fontToggle.textContent = "A−";
      fontToggle.setAttribute("aria-label", "Restablecer tamaño del texto");
    }
    if (localStorage.getItem("agroconecta-dark-mode") === "true") {
      document.body.classList.add("dark-mode");
      themeToggle.setAttribute("aria-label", "Cambiar a modo claro");
    }
  } catch (error) { /* La app también funciona sin preferencias guardadas. */ }
  render();
})();