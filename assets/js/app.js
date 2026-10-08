(() => {
  const main = document.querySelector("#main-content");
  const nav = document.querySelector("#primary-nav");
  const logoutButton = document.querySelector("#logout-button");
  const fontToggle = document.querySelector("#font-toggle");
  const themeToggle = document.querySelector("#theme-toggle");
  const storageKey = "agroconecta-demo-v1";
  const firebaseConfig = window.AgroFirebaseConfig || {};
  const firebaseEnabled = Boolean(window.firebase && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("REEMPLAZAR") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("REEMPLAZAR"));
  const firebaseAuth = firebaseEnabled ? (firebase.initializeApp(firebaseConfig), firebase.auth()) : null;
  const firestore = firebaseEnabled ? firebase.firestore() : null;
  let cloudSnapshot = null;
  let cloudQueue = Promise.resolve();
  let profileSubscription = null;
  let authReady = !firebaseEnabled;
  let firebaseRegistrationPending = false;
  let loginErrorMessage = "";
  const pages = [
    ["home", "Inicio", "⌂"], ["procedures", "Trámites", "▤"], ["tourism", "Fincas", "⌖"],
    ["learning", "Aprender", "Aa"], ["billing", "Cobros", "$"], ["processes", "Procesos", "✓"],
    ["pqrs", "PQRS", "♡"], ["contact", "Contacto", "i"]
  ];
  const adminPage = ["admin", "Administración", "⚙"];
  let state = loadState();
  let view = state.session ? "home" : "login";
  let loginMode = false;
  let requestedRole = "user";
  let requestedRegistrationRole = "user";
  let registrationNotice = "";
  let selectedProcedure = "";
  let procedureStep = 0;
  let procedureAnswers = [];
  let bookingFarm = "";
  let editingFarmId = "";
  let invoiceStep = 0;
  let adminTab = "overview";
  let invoiceDraft = { name: "", document: "", product: "", quantity: 1, price: 0, note: "" };

  function defaults() {
    return {
      session: null,
      users: firebaseEnabled ? [] : [
        { id: "demo-admin", email: "admin@demo.com", name: "Rosa Administradora", role: "admin", adminRequest: "no_solicitada", disabled: false },
        { id: "demo-user", email: "usuario@demo.com", name: "María Productora", role: "user", adminRequest: "no_solicitada", disabled: false }
      ],
      procedures: window.AgroData.procedures,
      farms: window.AgroData.farms,
      lessons: window.AgroData.lessons,
      completions: [], bookings: [], invoices: [], pqrs: [], contacts: []
    };
  }

  function loadState() {
    if (firebaseEnabled) return defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return defaults();
      const initial = defaults();
      const users = (saved.users || initial.users).map((user, index) => ({
        ...user,
        id: user.id || `legacy-user-${index}`,
        adminRequest: user.adminRequest || "no_solicitada",
        disabled: Boolean(user.disabled)
      }));
      const sessionUser = saved.session ? users.find((user) => user.email === saved.session.email) : null;
      return {
        ...initial,
        ...saved,
        users,
        session: sessionUser || null,
        contacts: saved.contacts || [],
        pqrs: (saved.pqrs || []).map((item) => ({
          ...item,
          status: ({ "Recibida": "Pendiente", "En revisión": "En proceso", "Respondida": "Resuelta" })[item.status] || item.status || "Pendiente"
        })),
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
    if (firebaseEnabled) {
      if (firebaseAuth.currentUser && cloudSnapshot) {
        cloudQueue = cloudQueue.then(persistCloudState).catch(() => announce("No fue posible sincronizar los cambios con Firebase."));
      }
      return;
    }
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (error) { announce("No fue posible guardar los cambios en este navegador."); }
  }

  const cloudCollections = {
    users: "users", procedures: "procedures", farms: "farms", lessons: "lessons",
    completions: "processes", bookings: "bookings", invoices: "invoices", pqrs: "pqrs", contacts: "contacts"
  };

  function recordData(item) {
    const { id, ...data } = item;
    return data;
  }

  function cloudStateSnapshot() {
    return Object.fromEntries(Object.entries(cloudCollections).map(([key]) => [
      key,
      new Map((state[key] || []).map((item) => [item.id, JSON.stringify(recordData(item))]))
    ]));
  }

  async function loadCloudCollection(name, uid, administrator) {
    let query = firestore.collection(name);
    if (!administrator) query = query.where("ownerId", "==", uid);
    const result = await query.get();
    return result.docs.map((document) => ({ ...document.data(), id: document.id }));
  }

  async function bootstrapFirebaseUser(authUser) {
    try {
      const profileReference = firestore.collection("users").doc(authUser.uid);
      let profileDocument = await profileReference.get();
      if (!profileDocument.exists) {
        await profileReference.set({ email: authUser.email, name: authUser.displayName || authUser.email, role: "user", disabled: false, adminRequest: "no_solicitada" });
        profileDocument = await profileReference.get();
      }
      const profile = profileDocument.data();
      if (profile.disabled) throw new Error("disabled-profile");
      if (requestedRole === "admin" && profile.role !== "admin") {
        loginErrorMessage = profile.adminRequest === "pendiente"
          ? "Tu solicitud de administrador aún no ha sido aprobada."
          : "Esta cuenta no tiene permisos de administrador.";
        throw new Error("role-mismatch");
      }
      if (!["user", "admin"].includes(profile.role)) throw new Error("invalid-role");

      const administrator = profile.role === "admin";
      const session = { ...profile, id: authUser.uid, email: authUser.email, name: profile.name || authUser.displayName || authUser.email, role: profile.role };
      const userPromise = administrator
        ? firestore.collection("users").get().then((result) => result.docs.map((document) => ({ ...document.data(), id: document.id })))
        : Promise.resolve([session]);
      const [users, procedures, farms, lessons, bookings, invoices, completions, pqrs, contacts] = await Promise.all([
        userPromise,
        firestore.collection("procedures").get().then((result) => result.docs.map((document) => ({ ...document.data(), id: document.id }))),
        firestore.collection("farms").get().then((result) => result.docs.map((document) => ({ ...document.data(), id: document.id }))),
        firestore.collection("lessons").get().then((result) => result.docs.map((document) => ({ ...document.data(), id: document.id }))),
        loadCloudCollection("bookings", authUser.uid, administrator),
        loadCloudCollection("invoices", authUser.uid, administrator),
        loadCloudCollection("processes", authUser.uid, administrator),
        loadCloudCollection("pqrs", authUser.uid, administrator),
        loadCloudCollection("contacts", authUser.uid, administrator)
      ]);
      state = {
        ...state, session, users,
        procedures: mergeCatalog(window.AgroData.procedures, procedures),
        farms: mergeCatalog(window.AgroData.farms, farms),
        lessons: mergeCatalog(window.AgroData.lessons, lessons),
        bookings, invoices, completions, pqrs, contacts
      };
      cloudSnapshot = cloudStateSnapshot();
      if (profileSubscription) profileSubscription();
      profileSubscription = firestore.collection("users").doc(authUser.uid).onSnapshot((document) => {
        if (!document.exists || document.data().disabled) {
          loginErrorMessage = "Esta cuenta está desactivada. Contacta con administración.";
          firebaseAuth.signOut();
          return;
        }
        const updated = document.data();
        if (updated.role !== state.session.role) {
          bootstrapFirebaseUser(authUser);
          return;
        }
        state.session = { ...state.session, ...updated, id: authUser.uid, email: authUser.email };
        state.users = state.users.map((user) => user.id === authUser.uid ? { ...user, ...updated, id: authUser.uid } : user);
        render();
      });
      loginErrorMessage = "";
      view = window.location.hash.slice(1) || "home";
      authReady = true;
      render();
    } catch (error) {
      if (firebaseAuth.currentUser) await firebaseAuth.signOut();
      state.session = null;
      view = "login";
      authReady = true;
      if (!loginErrorMessage) loginErrorMessage = error.message === "disabled-profile"
        ? "Esta cuenta está desactivada. Contacta con administración."
        : "No se pudo verificar el perfil de esta cuenta en Firebase.";
      render();
    }
  }

  async function persistCloudState() {
    if (!firebaseEnabled || !firebaseAuth.currentUser || !cloudSnapshot) return;
    const uid = firebaseAuth.currentUser.uid;
    const administrator = isAdmin();
    const currentSnapshot = cloudStateSnapshot();
    const writes = [];
    for (const [key, collectionName] of Object.entries(cloudCollections)) {
      const canManageCollection = ["users", "procedures", "lessons"].includes(key);
      if (canManageCollection && !administrator) continue;
      const previous = cloudSnapshot[key] || new Map();
      const currentItems = state[key] || [];
      const currentIds = new Set(currentItems.map((item) => item.id));
      for (const item of currentItems) {
        const ownerCanWrite = item.ownerId === uid && ["farms", "completions", "bookings", "invoices", "pqrs", "contacts"].includes(key);
        if (!administrator && !ownerCanWrite) continue;
        const encoded = currentSnapshot[key].get(item.id);
        if (previous.get(item.id) !== encoded) writes.push(firestore.collection(collectionName).doc(item.id).set(recordData(item)));
      }
      for (const [id] of previous) {
        if (currentIds.has(id) || key === "users") continue;
        const previousData = JSON.parse(previous.get(id) || "{}");
        const wasOwned = previousData.ownerId === uid;
        const ownerCanDelete = ["farms", "bookings", "invoices", "processes"].includes(key);
        if (administrator || (ownerCanDelete && wasOwned)) writes.push(firestore.collection(collectionName).doc(id).delete());
      }
    }
    await Promise.all(writes);
    cloudSnapshot = cloudStateSnapshot();
  }

  function announce(message, visible = false) {
    let live = document.querySelector("#live-message");
    if (!live) {
      live = document.createElement("p");
      live.id = "live-message";
      live.className = visible ? "form-error access-message" : "sr-only";
      live.setAttribute("role", "status");
      main.append(live);
    }
    live.className = visible ? "form-error access-message" : "sr-only";
    live.textContent = message;
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

  function visibleRecords(records) {
    if (isAdmin()) return records;
    return records.filter((item) => item.ownerId === state.session?.id);
  }

  function setRoute(route) {
    if (route === "admin" && !isAdmin()) {
      view = "home";
      render();
      announce("Acceso denegado", true);
      return;
    }
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
    if (firebaseEnabled && !authReady) {
      nav.hidden = true;
      logoutButton.hidden = true;
      main.innerHTML = '<div class="page-wrap"><p role="status">Conectando con Firebase…</p></div>';
      return;
    }
    renderNav();
    if (!state.session) view = "login";
    const renderers = {
      login: renderLogin, home: renderHome, procedures: renderProcedures, tourism: renderTourism,
      learning: renderLearning, billing: renderBilling, processes: renderProcesses,
      pqrs: renderPqrs, contact: renderContact, admin: renderAdmin
    };
    const routeDenied = view === "admin" && !isAdmin();
    if (routeDenied) view = state.session ? "home" : "login";
    main.innerHTML = (renderers[view] || renderHome)();
    if (routeDenied) announce("Acceso denegado", true);
    if (firebaseEnabled && view === "tourism") {
      const bookingHint = main.querySelector("#booking-form .hint");
      if (bookingHint) bookingHint.textContent = "La solicitud se guarda en tu cuenta; no se envía directamente a la finca.";
    }
  }

  function renderLogin() {
    return `<div class="page-wrap"><div class="login-layout">
      <section class="login-intro"><p class="eyebrow">Tecnología cercana, vida rural</p><h1>Tu campo, más conectado.</h1>
      <p class="lead">Practica trámites, comparte lo que haces y aprende a tu ritmo. Un paso sencillo a la vez.</p>
      <div class="login-art" role="img" aria-label="Ilustración de montañas y campos de cultivo"></div></section>
      <section class="login-panel" aria-labelledby="login-title"><h2 id="login-title">${loginMode ? "Crear una cuenta" : requestedRole === "admin" ? "Acceso de administrador" : "Bienvenido, bienvenida"}</h2>
      <p class="muted">${loginMode ? requestedRegistrationRole === "admin" ? "Tu cuenta se creará como usuario y tu solicitud de administrador quedará pendiente de aprobación." : "Tu cuenta tendrá permisos de usuario." : "Ingresa con tu correo y contraseña."}</p>
      ${loginMode ? "" : `<div class="role-picker" role="group" aria-label="Tipo de acceso"><button class="button secondary" type="button" data-role="user" aria-pressed="${requestedRole === "user"}"><span aria-hidden="true">♙</span> Soy usuario</button><button class="button secondary" type="button" data-role="admin" aria-pressed="${requestedRole === "admin"}"><span aria-hidden="true">♜</span> Soy administrador</button></div>`}
      <form id="login-form" novalidate>
        ${loginMode ? `<div class="field"><label for="login-name">Tu nombre</label><input id="login-name" name="name" autocomplete="name" required></div>` : ""}
        <div class="field"><label for="login-email">Correo electrónico</label><input id="login-email" name="email" type="email" autocomplete="email" required placeholder="nombre@correo.com"></div>
        <div class="field"><label for="login-password">Contraseña</label><div class="password-field"><input id="login-password" name="password" type="password" autocomplete="${loginMode ? "new-password" : "current-password"}" required minlength="8"><button class="button secondary small" type="button" data-action="toggle-password" aria-label="Mostrar contraseña">Mostrar</button></div></div>
        <p class="form-error" id="login-error" role="alert" ${loginErrorMessage ? "" : "hidden"}>${esc(loginErrorMessage)}</p>
        ${loginMode ? `<fieldset class="registration-role"><legend>Quiero registrarme como:</legend><div class="role-picker"><button class="button secondary" type="button" data-register-role="user" aria-pressed="${requestedRegistrationRole === "user"}">Usuario</button><button class="button secondary" type="button" data-register-role="admin" aria-pressed="${requestedRegistrationRole === "admin"}">Administrador</button></div></fieldset>` : ""}
        <button class="button" type="submit">${loginMode ? "Crear mi cuenta" : "Iniciar sesión"}</button>
      </form>
      ${requestedRole === "user" || loginMode ? `<button class="text-button" type="button" data-action="toggle-register">${loginMode ? "Ya tengo una cuenta" : "Crear cuenta"}</button>` : ""}
      <p class="hint">${firebaseEnabled ? "Firebase gestiona tu contraseña. El rol se consulta desde tu perfil y los datos se guardan en la nube." : "Demostración local: no verifica contraseñas ni protege datos reales. No uses información privada."}</p>
      </section></div></div>`;
  }

  function renderHome() {
    if (isAdmin()) return renderAdminHome();
    const name = state.session.name.split(" ")[0];
    const recent = [...visibleRecords(state.completions), ...visibleRecords(state.bookings), ...visibleRecords(state.invoices), ...visibleRecords(state.pqrs)].slice(-3).reverse();
    const titles = { procedure: "Práctica de trámite", booking: "Reserva", invoice: "Cuenta de cobro", pqrs: "Solicitud PQRS" };
    return `<div class="page-wrap">${registrationNotice ? `<p class="success-message" role="status">${esc(registrationNotice)}</p>` : ""}<section class="welcome-band"><div><p class="eyebrow">Bienvenida, ${esc(name)}</p><h1>¿Qué necesitas hacer hoy?</h1><p class="lead">Elige una opción y te acompañamos paso a paso.</p></div><div class="welcome-art" role="img" aria-label="Lomas verdes de cultivo"></div></section>
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

  function renderAdminHome() {
    const counts = [
      ["Usuarios", state.users.filter((user) => !user.disabled).length],
      ["PQRS pendientes", state.pqrs.filter((item) => item.status === "Pendiente").length],
      ["Cobros", state.invoices.length],
      ["Mensajes", state.contacts.length]
    ];
    return `<div class="page-wrap"><section class="welcome-band"><div><p class="eyebrow">Gestión de AgroConecta</p><h1>Panel de administrador, ${esc(state.session.name.split(" ")[0])}</h1><p class="lead">Revisa actividad y administra los contenidos de la plataforma.</p></div><div class="welcome-art" role="img" aria-label="Lomas verdes de cultivo"></div></section>
      <div class="grid grid-3">
        ${adminTile("users", "♙", "Gestionar usuarios", "Consulta roles y estado de las cuentas.")}
        ${adminTile("content", "▤", "Ver todos los trámites", "Administra el catálogo de prácticas.")}
        ${adminTile("pqrs", "♡", "Revisar PQRS pendientes", "Lee y responde las solicitudes.")}
        ${adminTile("records", "$", "Ver cobros de todos", "Consulta cuentas de cobro registradas.")}
        ${adminTile("contacts", "✉", "Ver mensajes de contacto", "Consulta los mensajes recibidos.")}
        ${adminTile("content", "Aa", "Gestionar lecciones", "Administra el catálogo de aprendizaje.")}
      </div><div class="section-title"><h2>Resumen</h2><a href="#admin" data-route="admin">Abrir administración</a></div>
      <div class="grid grid-2">${counts.map(([label, number]) => `<div class="stat"><strong>${number}</strong><span>${label}</span></div>`).join("")}</div></div>`;
  }

  function tile(route, icon, title, description) {
    return `<a class="tile" href="#${route}" data-route="${route}"><span class="tile-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${description}</span></a>`;
  }

  function adminTile(tab, icon, title, description) {
    return `<a class="tile" href="#admin" data-route="admin" data-admin-tab="${tab}"><span class="tile-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${description}</span></a>`;
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
      ${!isAdmin() ? renderFarmEditor() : ""}
      ${farm ? `<section class="panel" aria-labelledby="booking-heading"><h2 id="booking-heading">Solicitar visita a ${esc(farm.name)}</h2><form id="booking-form"><input type="hidden" name="farmId" value="${esc(farm.id)}"><div class="grid grid-2"><div class="field"><label for="booking-date">Fecha que prefieres</label><input id="booking-date" name="date" type="date" required min="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label for="booking-people">Número de personas</label><input id="booking-people" name="people" type="number" min="1" max="20" value="2" required></div></div><div class="field"><label for="booking-phone">Teléfono de contacto</label><input id="booking-phone" name="phone" type="tel" autocomplete="tel" required></div><p class="hint">La solicitud queda guardada en este dispositivo; no se envía a la finca.</p><div class="button-row"><button class="button" type="submit">Guardar solicitud</button><button class="button secondary" type="button" data-action="cancel-booking">Volver a las fincas</button></div></form></section>` : ""}
      <div class="grid grid-3">${state.farms.map((item) => `<article class="farm-card"><img class="farm-photo" src="${esc(item.image || "")}" alt="${esc(item.alt || item.name)}" loading="lazy" onerror="this.hidden=true"><div class="farm-content"><p class="eyebrow">${esc(item.category)}</p><h3>${esc(item.name)}</h3><p class="farm-meta">⌖ ${esc(item.place)}</p><p>${esc(item.description)}</p><p class="price">${money(item.price)} <span class="muted">/ persona</span></p><button class="button" type="button" data-book="${esc(item.id)}">Consultar fecha</button>${!isAdmin() && item.ownerId === state.session.id ? `<div class="button-row"><button class="button secondary small" type="button" data-edit-own-farm="${esc(item.id)}">Editar mi finca</button><button class="button secondary small" type="button" data-delete-own-farm="${esc(item.id)}">Retirar mi finca</button></div>` : ""}</div></article>`).join("")}</div></div>`;
  }

  function renderFarmEditor() {
    const ownFarm = state.farms.find((item) => item.id === editingFarmId && item.ownerId === state.session.id);
    return `<section class="panel farm-editor"><h2>${ownFarm ? "Editar mi finca" : "Publicar mi finca"}</h2><form id="farm-owner-form"><div class="grid grid-2"><div class="field"><label for="owner-farm-name">Nombre de la finca</label><input id="owner-farm-name" name="name" value="${esc(ownFarm?.name || "")}" required maxlength="100"></div><div class="field"><label for="owner-farm-place">Municipio o vereda</label><input id="owner-farm-place" name="place" value="${esc(ownFarm?.place || "")}" required maxlength="100"></div></div><div class="field"><label for="owner-farm-description">Descripción</label><textarea id="owner-farm-description" name="description" required maxlength="500">${esc(ownFarm?.description || "")}</textarea></div><div class="field"><label for="owner-farm-price">Precio de referencia por persona</label><input id="owner-farm-price" name="price" type="number" min="0" value="${Number(ownFarm?.price) || ""}" required></div><div class="button-row"><button class="button" type="submit">${ownFarm ? "Guardar cambios" : "Publicar finca"}</button>${ownFarm ? `<button class="button secondary" type="button" data-action="cancel-farm-edit">Cancelar</button>` : ""}</div></form><p class="hint">${firebaseEnabled ? "El anuncio se guarda en Firestore y se muestra en el catálogo." : "Esta demostración publica el anuncio en el navegador actual."}</p></section>`;
  }

  function renderLearning() {
    const done = visibleRecords(state.completions).filter((item) => item.type === "lesson").map((item) => item.label);
    return `<div class="page-wrap"><p class="eyebrow">Aprende a tu ritmo</p><h1 class="page-heading">Aprender con el celular</h1><p class="lead">Lecciones breves y claras. Pulsa “Escuchar” para oír el texto en voz alta.</p>
      <div class="grid grid-2">${state.lessons.map((lesson) => `<article class="panel lesson-card"><span class="lesson-number" aria-hidden="true">${esc(lesson.icon || "Aa")}</span><h2>${esc(lesson.title)}</h2><p>${esc(lesson.description)}</p><div class="button-row"><button class="button secondary" type="button" data-speak="${esc(lesson.id)}">Escuchar lección</button><button class="button" type="button" data-lesson-done="${esc(lesson.id)}">${done.includes(lesson.id) ? "Lección completada" : "Marcar como aprendida"}</button></div><details><summary>Leer la lección</summary><p>${esc(lesson.body)}</p></details></article>`).join("")}</div><p class="hint" id="speech-status" aria-live="polite">La lectura en voz alta depende de las opciones de voz de tu dispositivo.</p></div>`;
  }

  function renderBilling() {
    const invoices = visibleRecords(state.invoices);
    const steps = ["Cliente", "Productos", "Total"];
    const stepNav = `<ol class="step-indicator" aria-label="Pasos para crear una cuenta">${steps.map((label, index) => `<li class="${index === invoiceStep ? "current" : index < invoiceStep ? "complete" : ""}" ${index === invoiceStep ? 'aria-current="step"' : ""}><span class="step-number">${index + 1}</span><span>${label}</span></li>`).join("")}</ol>`;
    let formContent = "";
    if (invoiceStep === 0) formContent = `<h2>¿A quién le cobras?</h2><div class="field"><label for="invoice-name">Nombre del cliente</label><input id="invoice-name" name="name" value="${esc(invoiceDraft.name)}" required autocomplete="name"></div><div class="field"><label for="invoice-document">Documento (opcional)</label><input id="invoice-document" name="document" value="${esc(invoiceDraft.document)}" autocomplete="off"></div><div class="field"><label for="invoice-note">Descripción (opcional)</label><input id="invoice-note" name="note" value="${esc(invoiceDraft.note)}" placeholder="Ejemplo: venta de cosecha"></div>`;
    if (invoiceStep === 1) formContent = `<h2>¿Qué producto o servicio?</h2><div class="field"><label for="invoice-product">Producto o servicio</label><input id="invoice-product" name="product" value="${esc(invoiceDraft.product)}" required placeholder="Ejemplo: canastilla de tomate"></div><div class="grid grid-2"><div class="field"><label for="invoice-quantity">Cantidad</label><input id="invoice-quantity" name="quantity" type="number" min="1" value="${Number(invoiceDraft.quantity) || 1}" required></div><div class="field"><label for="invoice-price">Precio por unidad (pesos)</label><input id="invoice-price" name="price" type="number" min="0" value="${Number(invoiceDraft.price) || ""}" required></div></div><p class="hint">Total: ${money((Number(invoiceDraft.quantity) || 0) * (Number(invoiceDraft.price) || 0))}</p>`;
    if (invoiceStep === 2) formContent = `<h2>Revisa tu cuenta de cobro</h2><div class="print-only"><p>AgroConecta Rural · Cuenta de cobro</p></div><dl><dt>Cliente</dt><dd>${esc(invoiceDraft.name)}</dd><dt>Documento</dt><dd>${esc(invoiceDraft.document || "No indicado")}</dd><dt>Concepto</dt><dd>${esc(invoiceDraft.product)} ${invoiceDraft.note ? `· ${esc(invoiceDraft.note)}` : ""}</dd><dt>Cantidad</dt><dd>${Number(invoiceDraft.quantity) || 0}</dd><dt>Valor unitario</dt><dd>${money(invoiceDraft.price)}</dd><dt>Total</dt><dd><strong>${money((Number(invoiceDraft.quantity) || 0) * (Number(invoiceDraft.price) || 0))}</strong></dd></dl><p class="notice">Esta cuenta de cobro es una ayuda para organizar tus ventas. No es una factura electrónica ni reemplaza los requisitos de la DIAN.</p>`;
    return `<div class="page-wrap"><p class="eyebrow">Tus ventas, más sencillas</p><h1 class="page-heading">Cuenta de cobro</h1><p class="lead">En tres pasos puedes organizar un cobro para imprimir o guardar como PDF.</p><div class="grid grid-2"><section class="panel">${stepNav}<form id="invoice-form">${formContent}<div class="button-row">${invoiceStep ? `<button class="button secondary" type="button" data-action="invoice-back">Volver</button>` : ""}<button class="button" type="submit">${invoiceStep === 2 ? "Guardar cuenta" : invoiceStep === 1 ? "Ver total" : "Continuar"}</button>${invoiceStep === 2 ? `<button class="button secondary" type="button" data-action="print">Imprimir o guardar PDF</button>` : ""}</div></form></section>
      <section class="panel"><h2>${isAdmin() ? "Cuentas de todos" : "Mis cuentas guardadas"}</h2>${invoices.length ? `<ul class="record-list">${[...invoices].reverse().map((invoice) => `<li><span>${esc(invoice.number)} · ${esc(invoice.name)}<br><strong>${money(invoice.total)}</strong>${isAdmin() ? `<br><span class="muted">${esc(invoice.ownerEmail || "")}</span>` : ""}</span><button class="button secondary small" type="button" data-print-invoice="${esc(invoice.id)}">Imprimir</button></li>`).join("")}</ul>` : `<p class="muted">Aquí verás las cuentas de cobro que guardes.</p>`}</section></div></div>`;
  }

  function renderProcesses() {
    const records = [
      ...visibleRecords(state.completions).map((item) => ({ ...item, date: item.date || "" })),
      ...visibleRecords(state.bookings).map((item) => ({ ...item, label: `Visita a ${item.name} · ${item.date}`, type: "booking" })),
      ...visibleRecords(state.invoices).map((item) => ({ ...item, label: `${item.number} · ${item.name}`, type: "invoice" })),
      ...visibleRecords(state.pqrs).map((item) => ({ ...item, label: `${item.number} · ${item.subject}`, type: "pqrs" }))
    ].reverse();
    return `<div class="page-wrap"><p class="eyebrow">Tu actividad</p><h1 class="page-heading">Mis procesos</h1><p class="lead">${firebaseEnabled ? "Consulta tus actividades guardadas en tu cuenta." : "Consulta tus prácticas, reservas y solicitudes guardadas en este dispositivo."}</p><section class="panel">${records.length ? `<ul class="record-list">${records.map((item) => `<li><span><strong>${esc(item.label || "Actividad")}</strong><br><span class="muted">${esc(item.date || "Fecha no disponible")}</span></span><span class="status ${item.status === "Completado" ? "done" : ""}">${esc(item.status || "Guardado")}</span></li>`).join("")}</ul>` : `<p>Aún no tienes actividades. Puedes empezar con una práctica de trámite o una lección.</p><a class="button" href="#procedures" data-route="procedures">Ver trámites</a>`}</section></div>`;
  }

  function renderPqrs() {
    const requests = visibleRecords(state.pqrs);
    return `<div class="page-wrap"><p class="eyebrow">Estamos para escucharte</p><h1 class="page-heading">Peticiones y ayuda</h1><p class="lead">Cuéntanos qué necesitas. Recibirás un número de radicado para consultar el estado ${firebaseEnabled ? "en tu cuenta" : "en este dispositivo"}.</p><div class="grid grid-2"><section class="panel"><h2>Escribir una solicitud</h2><form id="pqrs-form"><div class="field"><label for="pqrs-type">Tipo de solicitud</label><select id="pqrs-type" name="type"><option>Petición</option><option>Queja</option><option>Reclamo</option><option>Sugerencia</option></select></div><div class="field"><label for="pqrs-subject">Tema</label><input id="pqrs-subject" name="subject" required maxlength="80"></div><div class="field"><label for="pqrs-message">¿Cómo podemos ayudarte?</label><textarea id="pqrs-message" name="message" required maxlength="1000"></textarea></div><button class="button" type="submit">Radicar solicitud</button><p class="hint">No incluyas claves ni datos bancarios. La solicitud no se envía a una entidad pública desde esta plataforma.</p></form></section>
      <section class="panel"><h2>Mis radicados</h2>${requests.length ? `<ul class="record-list">${[...requests].reverse().map((item) => `<li><span><strong>${esc(item.number)}</strong><br>${esc(item.type)} · ${esc(item.subject)}${item.reply ? `<br><span class="muted">Respuesta: ${esc(item.reply)}</span>` : ""}</span><span class="status">${esc(item.status)}</span></li>`).join("")}</ul>` : `<p class="muted">Cuando radiques una solicitud, aparecerá aquí su número y estado.</p>`}</section></div></div>`;
  }

  function renderContact() {
    return `<div class="page-wrap"><p class="eyebrow">Cerca de ti</p><h1 class="page-heading">Contacto y alianzas</h1><p class="lead">Busca orientación en los canales oficiales de tu municipio o de la entidad correspondiente.</p><div class="notice">AgroConecta Rural es un prototipo educativo. Los enlaces son informativos y las entidades aquí mencionadas no necesariamente tienen una alianza con este proyecto.</div><div class="section-title"><h2>Entidades para consultar</h2></div>${alliesMarkup()}<div class="section-title"><h2>Escríbenos</h2></div><section class="panel"><form id="contact-form"><div class="field"><label for="contact-subject">Asunto</label><input id="contact-subject" name="subject" required maxlength="100"></div><div class="field"><label for="contact-message">Mensaje</label><textarea id="contact-message" name="message" required maxlength="1000"></textarea></div><button class="button" type="submit">Enviar mensaje</button><p class="hint">${firebaseEnabled ? "El mensaje se guarda en tu cuenta de AgroConecta." : "El mensaje se guarda solo en este navegador."}</p></form></section></div>`;
  }

  function renderAdmin() {
    if (!isAdmin()) return "";
    const counts = [["Cuentas de usuario", state.users.filter((user) => !user.disabled).length], ["Fincas publicadas", state.farms.length], ["Trámites de práctica", state.procedures.length], ["PQRS pendientes", state.pqrs.filter((item) => item.status === "Pendiente").length]];
    const tabs = [["overview", "Resumen"], ["users", "Usuarios"], ["admin-requests", "Solicitudes de administrador"], ["records", "Cobros y procesos"], ["content", "Contenido"], ["pqrs", "PQRS"], ["contacts", "Contacto"]];
    let body = "";
    if (adminTab === "overview") body = `<div class="grid grid-2">${counts.map(([label, number]) => `<div class="stat"><strong>${number}</strong><span>${label}</span></div>`).join("")}</div><p class="hint">${firebaseEnabled ? "Los datos se cargan desde Firestore según el rol y la propiedad." : "Los datos son locales a este navegador y sirven para demostrar los roles."}</p>`;
    if (adminTab === "users") body = `<h2>${firebaseEnabled ? "Usuarios" : "Usuarios de demostración"}</h2><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Cuenta</th></tr></thead><tbody>${state.users.map((user, index) => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td><label class="sr-only" for="role-${index}">Rol de ${esc(user.email)}</label><select id="role-${index}" data-user-role="${esc(user.id)}" ${user.id === state.session.id ? "disabled" : ""}><option value="user" ${user.role !== "admin" ? "selected" : ""}>Usuario</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option></select></td><td><button class="button secondary small" type="button" data-toggle-user="${esc(user.id)}" ${user.id === state.session.id ? "disabled" : ""}>${user.disabled ? "Activar" : "Desactivar"}</button></td></tr>`).join("")}</tbody></table></div>`;
    if (adminTab === "admin-requests") body = renderAdminRequests();
    if (adminTab === "content") body = `<h2>${firebaseEnabled ? "Gestionar catálogos" : "Administrar el contenido de esta demo"}</h2><div class="grid grid-3"><form class="panel" id="add-farm-form"><h3>Añadir una finca</h3><div class="field"><label for="new-farm-name">Nombre</label><input id="new-farm-name" name="name" required></div><div class="field"><label for="new-farm-place">Municipio</label><input id="new-farm-place" name="place" required></div><div class="field"><label for="new-farm-price">Precio de ejemplo</label><input id="new-farm-price" name="price" type="number" min="0" required></div><button class="button" type="submit">Añadir finca</button></form>
      <form class="panel" id="add-procedure-form"><h3>Añadir un trámite de práctica</h3><div class="field"><label for="new-procedure-name">Nombre</label><input id="new-procedure-name" name="name" required></div><div class="field"><label for="new-procedure-org">Entidad de referencia</label><input id="new-procedure-org" name="organization" required></div><button class="button" type="submit">Añadir trámite</button></form>
      <form class="panel" id="add-lesson-form"><h3>Añadir una lección</h3><div class="field"><label for="new-lesson-name">Título</label><input id="new-lesson-name" name="title" required></div><div class="field"><label for="new-lesson-body">Texto para leer y escuchar</label><textarea id="new-lesson-body" name="body" required></textarea></div><button class="button" type="submit">Añadir lección</button></form></div>${catalogEditors()}<p class="hint">Las fincas añadidas muestran texto; no solicitan imágenes externas.</p>`;
    if (adminTab === "pqrs") body = `<h2>Todas las solicitudes</h2>${state.pqrs.length ? `<div class="table-wrap"><table><thead><tr><th>Radicado</th><th>Solicitud</th><th>Mensaje</th><th>Estado / respuesta</th></tr></thead><tbody>${state.pqrs.map((item) => `<tr><td>${esc(item.number)}</td><td>${esc(item.type)} · ${esc(item.subject)}<br><span class="muted">${esc(item.ownerEmail || item.email || "")}</span></td><td>${esc(item.message)}</td><td><label class="sr-only" for="status-${esc(item.id)}">Estado de ${esc(item.number)}</label><select id="status-${esc(item.id)}" data-pqrs-status="${esc(item.id)}"><option value="Pendiente" ${item.status === "Pendiente" ? "selected" : ""}>Pendiente</option><option value="En proceso" ${item.status === "En proceso" ? "selected" : ""}>En proceso</option><option value="Resuelta" ${item.status === "Resuelta" ? "selected" : ""}>Resuelta</option></select><label class="sr-only" for="reply-${esc(item.id)}">Respuesta para ${esc(item.number)}</label><input class="inline-field" id="reply-${esc(item.id)}" data-pqrs-reply="${esc(item.id)}" value="${esc(item.reply || "")}" placeholder="Escribir respuesta"><button class="button small" type="button" data-reply="${esc(item.id)}">Guardar respuesta</button></td></tr>`).join("")}</tbody></table></div>` : `<p>No hay solicitudes por responder.</p>`}`;
    if (adminTab === "records") body = `<h2>Cobros y procesos de todos</h2><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Tipo</th><th>Detalle</th><th>Fecha / estado</th></tr></thead><tbody>${[...state.invoices.map((item) => ({ ...item, recordType: "Cobro", detail: `${item.number} · ${item.name}` })), ...state.bookings.map((item) => ({ ...item, recordType: "Reserva", detail: item.name })), ...state.completions.map((item) => ({ ...item, recordType: "Proceso", detail: item.label }))].map((item) => `<tr><td>${esc(item.ownerEmail || "")}</td><td>${esc(item.recordType)}</td><td>${esc(item.detail || "")}</td><td>${esc(item.date || item.status || "")}</td></tr>`).join("")}</tbody></table></div>`;
    if (adminTab === "contacts") body = `<h2>Mensajes recibidos</h2>${state.contacts.length ? `<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Asunto</th><th>Mensaje</th><th>Fecha</th></tr></thead><tbody>${state.contacts.map((item) => `<tr><td>${esc(item.ownerEmail || "")}</td><td>${esc(item.subject)}</td><td>${esc(item.message)}</td><td>${esc(item.date)}</td></tr>`).join("")}</tbody></table></div>` : `<p>No hay mensajes recibidos.</p>`}`;
    return `<div class="page-wrap"><p class="eyebrow">Herramientas de administración</p><h1 class="page-heading">Administración</h1><p class="lead">${firebaseEnabled ? "Gestión de datos y cuentas del proyecto." : "Resumen y gestión local de la demostración."}</p><div class="admin-tools" role="group" aria-label="Secciones de administración">${tabs.map(([id, label]) => `<button class="button secondary small" type="button" data-admin-tab="${id}" aria-pressed="${adminTab === id}">${label}</button>`).join("")}</div><section class="panel">${body}</section></div>`;
  }

  function renderAdminRequests() {
    const pending = state.users.filter((user) => user.adminRequest === "pendiente");
    return `<h2>Solicitudes de administrador</h2>${pending.length ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${pending.map((user) => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${user.adminRequestDate ? esc(new Date(user.adminRequestDate).toLocaleString("es-CO")) : "No disponible"}</td><td><div class="button-row"><button class="button small" type="button" data-admin-request-action="aprobar" data-user-id="${esc(user.id)}">Aprobar</button><button class="button secondary small" type="button" data-admin-request-action="rechazar" data-user-id="${esc(user.id)}">Rechazar</button></div></td></tr>`).join("")}</tbody></table></div>` : `<p>No hay solicitudes pendientes.</p>`}`;
  }

  function catalogEditors() {
    const makeEditor = (collection, item, title, fields) => `<form class="catalog-editor" data-catalog-edit="${collection}" data-item-id="${esc(item.id)}"><h3>${esc(title)}</h3>${fields}<div class="button-row"><button class="button small" type="submit">Guardar cambios</button><button class="button secondary small" type="button" data-delete-catalog="${collection}" data-item-id="${esc(item.id)}">Eliminar</button></div></form>`;
    const farms = state.farms.map((item) => makeEditor("farms", item, item.name,
      `<div class="field"><label for="farm-name-${esc(item.id)}">Nombre</label><input id="farm-name-${esc(item.id)}" name="name" value="${esc(item.name)}" required></div><div class="field"><label for="farm-place-${esc(item.id)}">Ubicación</label><input id="farm-place-${esc(item.id)}" name="place" value="${esc(item.place)}" required></div><div class="field"><label for="farm-price-${esc(item.id)}">Precio</label><input id="farm-price-${esc(item.id)}" name="price" type="number" min="0" value="${Number(item.price) || 0}" required></div><div class="field"><label for="farm-description-${esc(item.id)}">Descripción</label><textarea id="farm-description-${esc(item.id)}" name="description" required>${esc(item.description)}</textarea></div>`)).join("");
    const procedures = state.procedures.map((item) => makeEditor("procedures", item, item.name,
      `<div class="field"><label for="procedure-name-${esc(item.id)}">Nombre</label><input id="procedure-name-${esc(item.id)}" name="name" value="${esc(item.name)}" required></div><div class="field"><label for="procedure-org-${esc(item.id)}">Entidad de referencia</label><input id="procedure-org-${esc(item.id)}" name="organization" value="${esc(item.organization)}" required></div><div class="field"><label for="procedure-description-${esc(item.id)}">Descripción</label><textarea id="procedure-description-${esc(item.id)}" name="description" required>${esc(item.description)}</textarea></div>`)).join("");
    const lessons = state.lessons.map((item) => makeEditor("lessons", item, item.title,
      `<div class="field"><label for="lesson-title-${esc(item.id)}">Título</label><input id="lesson-title-${esc(item.id)}" name="title" value="${esc(item.title)}" required></div><div class="field"><label for="lesson-body-${esc(item.id)}">Texto de la lección</label><textarea id="lesson-body-${esc(item.id)}" name="body" required>${esc(item.body)}</textarea></div>`)).join("");
    return `<div class="section-title"><h2>Editar o eliminar elementos existentes</h2></div><div class="catalog-editor-list"><h3>Fincas</h3><div class="grid grid-2">${farms}</div><h3>Trámites</h3><div class="grid grid-2">${procedures}</div><h3>Lecciones</h3><div class="grid grid-2">${lessons}</div></div>`;
  }

  function firebaseAuthMessage(code) {
    return ({
      "auth/invalid-email": "Escribe un correo electrónico válido.",
      "auth/user-not-found": "No existe una cuenta con ese correo.",
      "auth/wrong-password": "La contraseña es incorrecta.",
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/too-many-requests": "Hubo demasiados intentos. Espera un momento e inténtalo de nuevo.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
      "auth/weak-password": "La contraseña debe tener al menos 8 caracteres."
    })[code] || "No fue posible iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
  }

  async function login(email, password, errorElement) {
    if (firebaseEnabled) {
      try {
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        loginErrorMessage = "";
        return true;
      } catch (error) {
        const message = firebaseAuthMessage(error.code);
        if (errorElement) { errorElement.textContent = message; errorElement.hidden = false; }
        return false;
      }
    }
    const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    const error = errorElement || document.querySelector("#login-error");
    if (!user) { error.textContent = "No existe una cuenta con ese correo."; return false; }
    if (user.disabled) { error.textContent = "Esta cuenta está desactivada. Contacta con administración."; return false; }
    if (requestedRole === "admin" && user.role !== "admin") {
      state.session = null;
      save();
      error.textContent = user.adminRequest === "pendiente"
        ? "Tu solicitud de administrador aún no ha sido aprobada."
        : "Esta cuenta no tiene permisos de administrador.";
      return false;
    }
    state.session = { ...user };
    save();
    view = "home";
    render();
    main.focus({ preventScroll: true });
    return true;
  }

  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

  function ownerFields() {
    return { ownerId: state.session.id, ownerEmail: state.session.email };
  }

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]");
    if (route) { event.preventDefault(); if (route.dataset.adminTab) adminTab = route.dataset.adminTab; setRoute(route.dataset.route); return; }
    const loginButton = event.target.closest("[data-login]");
    if (loginButton) { login(loginButton.dataset.login); return; }
    const roleButton = event.target.closest("[data-role]");
    if (roleButton) { requestedRole = roleButton.dataset.role; render(); return; }
    const registerRoleButton = event.target.closest("[data-register-role]");
    if (registerRoleButton && loginMode) { requestedRegistrationRole = registerRoleButton.dataset.registerRole; render(); return; }
    const procedure = event.target.closest("[data-procedure]");
    if (procedure) { selectedProcedure = procedure.dataset.procedure; procedureStep = 0; procedureAnswers = []; setRoute("procedures"); return; }
    const booking = event.target.closest("[data-book]");
    if (booking) { bookingFarm = booking.dataset.book; render(); document.querySelector("#booking-heading")?.focus(); return; }
    const editFarm = event.target.closest("[data-edit-own-farm]");
    if (editFarm && !isAdmin()) { editingFarmId = editFarm.dataset.editOwnFarm; render(); document.querySelector("#owner-farm-name")?.focus(); return; }
    const deleteFarm = event.target.closest("[data-delete-own-farm]");
    if (deleteFarm && !isAdmin()) {
      const index = state.farms.findIndex((item) => item.id === deleteFarm.dataset.deleteOwnFarm && item.ownerId === state.session.id);
      if (index >= 0) { state.farms.splice(index, 1); save(); render(); announce("Tu finca se retiró del catálogo."); }
      return;
    }
    const lessonDone = event.target.closest("[data-lesson-done]");
    if (lessonDone) {
      const lesson = state.lessons.find((item) => item.id === lessonDone.dataset.lessonDone);
      if (lesson && !state.completions.some((item) => item.type === "lesson" && item.label === lesson.id && item.ownerId === state.session.id)) state.completions.push({ type: "lesson", ...ownerFields(), label: lesson.id, status: "Completado", date: new Date().toLocaleDateString("es-CO") });
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
    if (action === "toggle-register") { loginMode = !loginMode; requestedRole = "user"; requestedRegistrationRole = "user"; loginErrorMessage = ""; render(); return; }
    if (action === "toggle-password") {
      const input = document.querySelector("#login-password");
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        event.target.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
        event.target.setAttribute("aria-label", input.type === "password" ? "Mostrar contraseña" : "Ocultar contraseña");
      }
      return;
    }
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
      state.completions.push({ type: "procedure", ...ownerFields(), label: item?.name || "Trámite", status: "Completado", date: new Date().toLocaleDateString("es-CO") });
      save(); selectedProcedure = ""; procedureAnswers = []; setRoute("procedures"); announce("¡Muy bien! Terminaste la práctica."); return;
    }
    if (action === "cancel-booking") { bookingFarm = ""; render(); return; }
    if (action === "cancel-farm-edit") { editingFarmId = ""; render(); return; }
    if (action === "invoice-back") { invoiceStep = Math.max(0, invoiceStep - 1); render(); return; }
    if (action === "print") { window.print(); return; }
    const printInvoice = event.target.closest("[data-print-invoice]");
    if (printInvoice) { printSavedInvoice(printInvoice.dataset.printInvoice); return; }
    const admin = event.target.closest("[data-admin-tab]");
    if (admin) { adminTab = admin.dataset.adminTab; render(); return; }
    const toggleUser = event.target.closest("[data-toggle-user]");
    if (toggleUser && isAdmin()) {
      const user = state.users.find((item) => item.id === toggleUser.dataset.toggleUser);
      if (user) {
        user.disabled = !user.disabled;
        if (user.id === state.session.id && user.disabled) state.session = null;
        save(); view = state.session ? "admin" : "login"; render();
      }
      return;
    }
    const adminRequestAction = event.target.closest("[data-admin-request-action]");
    if (adminRequestAction && isAdmin()) {
      const user = state.users.find((item) => item.id === adminRequestAction.dataset.userId && item.adminRequest === "pendiente");
      if (user) {
        const approved = adminRequestAction.dataset.adminRequestAction === "aprobar";
        user.adminRequest = approved ? "aprobada" : "rechazada";
        if (approved) user.role = "admin";
        save(); render();
        announce(approved ? "Solicitud aprobada. La cuenta ahora es administradora." : "Solicitud rechazada.");
      }
      return;
    }
    const deleteCatalog = event.target.closest("[data-delete-catalog]");
    if (deleteCatalog && isAdmin()) {
      const collection = deleteCatalog.dataset.deleteCatalog;
      if (["farms", "procedures", "lessons"].includes(collection) && window.confirm("¿Eliminar este elemento del catálogo?")) {
        state[collection] = state[collection].filter((item) => item.id !== deleteCatalog.dataset.itemId);
        save(); render(); announce("Elemento eliminado del catálogo.");
      }
      return;
    }
    const reply = event.target.closest("[data-reply]");
    if (reply) { saveReply(reply.dataset.reply); return; }
  });

  main.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.id === "login-form") {
      const values = formValues(form);
      const email = values.email.trim().toLowerCase();
      const error = document.querySelector("#login-error");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error.textContent = "Escribe un correo electrónico válido."; error.hidden = false; return; }
      if (values.password.length < 8) { error.textContent = "La contraseña debe tener al menos 8 caracteres."; error.hidden = false; return; }
      if (loginMode) {
        if (!firebaseEnabled && state.users.some((user) => user.email.toLowerCase() === email)) { error.textContent = "Ya existe una cuenta con ese correo. Prueba entrar."; error.hidden = false; return; }
        if (!values.name.trim()) { error.textContent = "Escribe tu nombre para crear la cuenta."; error.hidden = false; return; }
        if (firebaseEnabled) {
          firebaseRegistrationPending = true;
          try {
            const credential = await firebaseAuth.createUserWithEmailAndPassword(email, values.password);
            await credential.user.updateProfile({ displayName: values.name.trim() });
            const profile = {
              email,
              name: values.name.trim(),
              role: "user",
              disabled: false,
              adminRequest: requestedRegistrationRole === "admin" ? "pendiente" : "no_solicitada"
            };
            if (profile.adminRequest === "pendiente") profile.adminRequestDate = new Date().toISOString();
            await firestore.collection("users").doc(credential.user.uid).set(profile);
            loginMode = false;
            requestedRole = "user";
            registrationNotice = requestedRegistrationRole === "admin"
              ? "Tu cuenta fue creada como usuario. Tu solicitud de administrador está pendiente de aprobación."
              : "";
            await bootstrapFirebaseUser(credential.user);
            firebaseRegistrationPending = false;
          } catch (registrationError) {
            firebaseRegistrationPending = false;
            if (firebaseAuth.currentUser) await firebaseAuth.signOut();
            error.textContent = firebaseAuthMessage(registrationError.code);
            error.hidden = false;
          }
          return;
        }
        const user = {
          id: makeId("user"), email, name: values.name.trim(), role: "user", disabled: false,
          adminRequest: requestedRegistrationRole === "admin" ? "pendiente" : "no_solicitada",
          ...(requestedRegistrationRole === "admin" ? { adminRequestDate: new Date().toISOString() } : {})
        };
        state.users.push(user); save();
        registrationNotice = requestedRegistrationRole === "admin"
          ? "Tu cuenta fue creada como usuario. Tu solicitud de administrador está pendiente de aprobación."
          : "";
        loginMode = false;
        requestedRole = "user";
        await login(email, values.password, error);
      } else if (!(await login(email, values.password, error))) { error.hidden = false; }
      return;
    }
    if (form.id === "booking-form") {
      const values = formValues(form);
      const farm = state.farms.find((item) => item.id === values.farmId);
      state.bookings.push({ type: "booking", id: makeId("res"), ...ownerFields(), name: farm?.name || "Finca", date: values.date, people: values.people, phone: values.phone, status: "Solicitud guardada", label: farm?.name || "Finca" });
      save(); bookingFarm = ""; setRoute("processes"); announce(firebaseEnabled ? "Solicitud de reserva guardada en tu cuenta." : "Solicitud de reserva guardada en este dispositivo."); return;
    }
    if (form.id === "farm-owner-form" && !isAdmin()) {
      const values = formValues(form);
      const ownFarm = state.farms.find((item) => item.id === editingFarmId && item.ownerId === state.session.id);
      if (ownFarm) Object.assign(ownFarm, { name: values.name.trim(), place: values.place.trim(), description: values.description.trim(), price: Number(values.price) });
      else state.farms.push({ id: makeId("finca"), ...ownerFields(), name: values.name.trim(), place: values.place.trim(), price: Number(values.price), category: "Experiencia comunitaria", description: values.description.trim(), image: "", alt: values.name.trim() });
      editingFarmId = ""; save(); render(); announce(ownFarm ? "Cambios de la finca guardados." : "Finca publicada en este navegador."); return;
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
      const invoice = { id: makeId("fac"), type: "invoice", ...ownerFields(), number: `CC-${Date.now().toString().slice(-6)}`, name: invoiceDraft.name, document: invoiceDraft.document, product: invoiceDraft.product, quantity: invoiceDraft.quantity, price: invoiceDraft.price, note: invoiceDraft.note, total, status: "Guardada", date: new Date().toLocaleDateString("es-CO") };
      state.invoices.push(invoice); save(); invoiceStep = 0; invoiceDraft = { name: "", document: "", product: "", quantity: 1, price: 0, note: "" }; render(); announce(`Cuenta ${invoice.number} guardada.`); return;
    }
    if (form.id === "pqrs-form") {
      const values = formValues(form);
      const item = { id: makeId("pqrs"), ...ownerFields(), type: "pqrs", number: `AC-${Date.now().toString().slice(-6)}`, email: state.session.email, ...values, status: "Pendiente", date: new Date().toLocaleDateString("es-CO") };
      state.pqrs.push(item); save(); setRoute("pqrs"); announce(`Solicitud radicada con el número ${item.number}.`); return;
    }
    if (form.id === "add-farm-form") {
      if (!isAdmin()) return;
      const values = formValues(form);
      state.farms.push({ id: makeId("finca"), name: values.name.trim(), place: values.place.trim(), price: Number(values.price), category: "Nueva experiencia", description: "Experiencia rural añadida por administración.", image: "", alt: values.name });
      save(); render(); announce("Finca añadida."); return;
    }
    if (form.id === "add-procedure-form") {
      if (!isAdmin()) return;
      const values = formValues(form);
      state.procedures.push({ id: makeId("tramite"), name: values.name.trim(), organization: values.organization.trim(), description: "Práctica guiada de ejemplo.", steps: ["¿Cuál es tu nombre?", "¿En qué municipio vives?", "¿Qué información necesitas preparar?", "Revisa tus respuestas"] });
      save(); render(); announce("Trámite de práctica añadido."); return;
    }
    if (form.id === "add-lesson-form") {
      if (!isAdmin()) return;
      const values = formValues(form);
      state.lessons.push({ id: makeId("leccion"), title: values.title.trim(), icon: "05", description: "Lección añadida por administración.", body: values.body.trim() });
      save(); render(); announce("Lección añadida.");
      return;
    }
    if (form.id === "contact-form") {
      const values = formValues(form);
      state.contacts.push({ id: makeId("contact"), ...ownerFields(), ...values, date: new Date().toLocaleDateString("es-CO") });
      save(); render(); announce("Mensaje guardado.");
    }
    if (form.dataset.catalogEdit && isAdmin()) {
      const collection = form.dataset.catalogEdit;
      const item = state[collection]?.find((entry) => entry.id === form.dataset.itemId);
      if (!item) return;
      const values = formValues(form);
      if (collection === "farms") Object.assign(item, { name: values.name.trim(), place: values.place.trim(), price: Number(values.price), description: values.description.trim(), alt: values.name.trim() });
      if (collection === "procedures") Object.assign(item, { name: values.name.trim(), organization: values.organization.trim(), description: values.description.trim() });
      if (collection === "lessons") Object.assign(item, { title: values.title.trim(), body: values.body.trim() });
      save(); render(); announce("Cambios guardados.");
    }
  });

  main.addEventListener("change", (event) => {
    const roleSelect = event.target.closest("[data-user-role]");
    if (roleSelect && isAdmin()) {
      const user = state.users.find((item) => item.id === roleSelect.dataset.userRole);
      if (user) {
        user.role = roleSelect.value;
        save();
        if (user.id === state.session.id) {
          state.session.role = user.role;
          if (user.role !== "admin") view = "home";
        }
        render();
      }
    }
    const statusSelect = event.target.closest("[data-pqrs-status]");
    if (statusSelect && isAdmin()) {
      const item = state.pqrs.find((entry) => entry.id === statusSelect.dataset.pqrsStatus);
      if (item) { item.status = statusSelect.value; save(); }
    }
  });

  function saveReply(id) {
    if (!isAdmin()) return;
    const item = state.pqrs.find((entry) => entry.id === id);
    const input = document.querySelector(`[data-pqrs-reply="${CSS.escape(id)}"]`);
    if (!item || !input) return;
    item.reply = input.value.trim();
    if (item.reply) item.status = "Resuelta";
    save(); render(); announce("Respuesta guardada.");
  }

  function printSavedInvoice(id) {
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice) return;
    const original = main.innerHTML;
    main.innerHTML = `<div class="page-wrap"><section class="panel"><div class="print-only"><p>AgroConecta Rural · Cuenta de cobro</p></div><p class="eyebrow">Cuenta de cobro ${esc(invoice.number)}</p><h1 class="page-heading">${esc(invoice.name)}</h1><p>Documento: ${esc(invoice.document || "No indicado")}</p><p>Concepto: ${esc(invoice.product)} · Cantidad: ${invoice.quantity}</p><p>Valor unitario: ${money(invoice.price)}</p><p><strong>Total: ${money(invoice.total)}</strong></p><p>${esc(invoice.note || "")}</p><p class="notice">Documento de apoyo. No es una factura electrónica.</p><button class="button no-print" type="button" onclick="window.print()">Imprimir o guardar PDF</button><button class="button secondary no-print" type="button" id="return-billing">Volver</button></section></div>`;
    document.querySelector("#return-billing").addEventListener("click", () => { main.innerHTML = original; });
  }

  logoutButton.addEventListener("click", async () => {
    selectedProcedure = "";
    requestedRole = "user";
    registrationNotice = "";
    loginErrorMessage = "";
    if (firebaseEnabled) { await firebaseAuth.signOut(); return; }
    state.session = null; save(); view = "login"; render();
  });
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
  if (!firebaseEnabled && window.location.hash) setRoute(window.location.hash.slice(1));
  window.addEventListener("hashchange", () => {
    const route = window.location.hash.slice(1);
    if (route && authReady) setRoute(route);
  });
  if (firebaseEnabled) {
    firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
      firebaseAuth.onAuthStateChanged((authUser) => {
        if (firebaseRegistrationPending) return;
        if (!authUser) {
          if (profileSubscription) { profileSubscription(); profileSubscription = null; }
          state.session = null;
          view = "login";
          authReady = true;
          render();
          return;
        }
        bootstrapFirebaseUser(authUser);
      });
    }).catch(() => {
      authReady = true;
      loginErrorMessage = "No fue posible inicializar Firebase Authentication.";
      render();
    });
  }
})();