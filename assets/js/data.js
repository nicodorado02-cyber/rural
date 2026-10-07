/* Datos de ejemplo. En producción, las entidades deben confirmar su participación. */
window.AgroData = {
  procedures: [
    { id: "cedula", name: "Preparar mi trámite de cédula", organization: "Registraduría Nacional", description: "Practica qué datos básicos debes tener listos antes de consultar una oficina oficial.", steps: ["¿Cuál es tu nombre completo?", "¿En qué municipio harás la consulta?", "¿Qué documento de identificación tienes?", "Revisa tus respuestas"] },
    { id: "rut", name: "Preparar mi RUT", organization: "DIAN", description: "Practica los datos básicos que suelen pedir para inscribirte.", steps: ["¿Cuál es tu nombre completo?", "¿En qué municipio vives?", "¿A qué actividad te dedicas?", "Revisa tus respuestas"] },
    { id: "sisben", name: "Conocer el SISBÉN", organization: "Prosperidad Social", description: "Aprende qué información reunir antes de solicitar una encuesta.", steps: ["¿Cuántas personas viven en tu hogar?", "¿Cuál es tu municipio?", "¿Qué documento tienes a mano?", "Revisa tus respuestas"] },
    { id: "predio", name: "Registrar mi predio", organization: "Alcaldía municipal", description: "Organiza la información que puedes necesitar para consultar en tu alcaldía.", steps: ["¿Cómo se llama tu predio?", "¿En qué vereda está?", "¿Qué actividad realizas allí?", "Revisa tus respuestas"] },
    { id: "subsidio", name: "Explorar apoyos al campo", organization: "Entidad pública", description: "Practica cómo describir tu actividad antes de preguntar por un apoyo.", steps: ["¿Qué produces o qué servicio ofreces?", "¿En qué municipio trabajas?", "¿Qué apoyo estás buscando?", "Revisa tus respuestas"] }
  ],
  farms: [
    { id: "roble", name: "Finca El Roble", place: "Salento, Quindío", price: 45000, category: "Café y naturaleza", description: "Recorre cafetales familiares y comparte una taza recién preparada.", image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=75", alt: "Granos de café tostado en una mesa" },
    { id: "luna", name: "Huerta La Luna", place: "Guatavita, Cundinamarca", price: 38000, category: "Huerta y cocina", description: "Cosecha verduras de temporada y prepara un almuerzo campesino.", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=75", alt: "Cultivos verdes en una finca de montaña" },
    { id: "rio", name: "Río Claro", place: "San Agustín, Huila", price: 52000, category: "Caminata rural", description: "Camina por senderos de la finca y conoce sus cultivos de cacao.", image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=75", alt: "Paisaje verde de montaña" }
  ],
  lessons: [
    { id: "celular", title: "Conozcamos el celular", icon: "01", description: "Aprende a encontrar los botones, subir el volumen y cuidar la batería.", body: "Para encender tu celular, mantén presionado el botón lateral unos segundos. Si necesitas ayuda, pide a alguien de confianza que te muestre el botón de volumen." },
    { id: "whatsapp", title: "Enviar un mensaje", icon: "02", description: "Escribe y envía un mensaje de WhatsApp a alguien de confianza.", body: "Abre WhatsApp y toca el nombre de la persona. Toca el espacio para escribir, escribe tu mensaje y pulsa el botón de enviar. Revisa el nombre antes de compartir datos." },
    { id: "correo", title: "Usar el correo", icon: "03", description: "Reconoce el destinatario, el asunto y el botón para enviar.", body: "En un correo nuevo, escribe la dirección de la persona, resume el motivo en el asunto y escribe tu mensaje. Revisa el destinatario antes de tocar enviar." },
    { id: "pagos", title: "Cuidar tus pagos", icon: "04", description: "Aprende a revisar el nombre y proteger tus claves.", body: "Antes de confirmar un pago, revisa el nombre y el valor. Nunca compartas tu clave o códigos por llamada o mensaje. Si algo te parece extraño, detente y consulta a tu banco." }
  ],
  allies: [
    { name: "SENA", mark: "SENA", detail: "Formación para el trabajo", url: "https://www.sena.edu.co/" },
    { name: "MinTIC", mark: "TIC", detail: "Tecnología y conectividad", url: "https://www.mintic.gov.co/" },
    { name: "DIAN", mark: "DIAN", detail: "Orientación tributaria", url: "https://www.dian.gov.co/" },
    { name: "Alcaldía local", mark: "AL", detail: "Consulta en tu municipio", url: "https://www.gov.co/" }
  ]
};