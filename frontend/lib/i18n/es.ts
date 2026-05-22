export const es = {

  statuses: {

    awaiting_receiver: 'Esperando al receptor',

    pending: 'Pendiente de aceptación',

    accepted: 'Aceptado',

    refused: 'Rechazado',

    paid: 'Pagado',

    in_transit: 'En tránsito',

    delivered: 'Entregado',

    disputed: 'Disputa abierta',

    refunded: 'Reembolsado',

    open: 'Disponible',

    full: 'Completo',

    completed: 'Terminado',

    cancelled: 'Cancelado',

    cancelled_by_sender: 'Cancelado por el remitente',

    cancelled_by_carrier: 'Cancelado por el transportista',

    pickup_failed: 'Paquete no entregado',

  },

  auth: {

    login_title: 'Iniciar sesión',

    login_subtitle: 'Envía, Viaja, Comparte',

    email_label: 'Correo electrónico / Teléfono',

    email_placeholder: 'ejemplo@kipar.fr',

    password_label: 'Contraseña',

    forgot_password: '¿Has olvidado tu contraseña?',

    login_btn: 'INICIAR SESIÓN',

    or_connect_with: 'O conéctate con:',

    no_account: '¿Nuevo en Kipar?',

    sign_up: 'Registrarse',

    register_title: 'Crear una cuenta',

    register_subtitle: 'Únete a la comunidad Kipar',

    first_name: 'Nombre',

    last_name: 'Apellido',

    register_btn: 'CREAR MI CUENTA',

    already_account: '¿Ya tienes una cuenta?',

    sign_in: 'Iniciar sesión',

    google: 'Continuar con Google',

    stat_carriers: 'Transportistas',

    stat_destinations: 'Destinos',

    stat_rating: 'Nota media',

    stat_carriers_value: '10K+',

    stat_destinations_value: '50+',

    stat_rating_value: '4.9★',

    apple: 'Continuar con Apple',
    confirm_password: 'Confirmar contrasena',
    password_min_placeholder: 'Minimo 8 caracteres',
    first_name_placeholder: 'Nombre',
    last_name_placeholder: 'Apellido',

  },

  nav: {

    home: 'Inicio',

    my_packages: 'Mis paquetes',

    trips: 'Viajes',

    profile: 'Perfil',

    carrier: 'Transportista',

    messages: 'Mensajes',

  },

  dashboard: {

    greeting: 'Hola',

    search_placeholder: 'Buscar un viaje...',

    popular_corridors: 'Rutas populares',

    available_trips: 'Viajes disponibles',

    no_trips: 'No hay viajes disponibles en esta ruta',

    hero_sub: 'Encuentra un transportista de confianza para tus paquetes',

    no_trips_sub: 'No hay viajes disponibles en esta ruta',

    loading: 'Cargando...',

  },

  trip: {

    available_kg: 'kg disponibles',

    max_per_package: 'Máx/paquete',

    departure: 'Salida',

    price_per_kg: '€/kg',

    kg_available: '{n} kg disp.',

    max_kg: 'Máx {n} kg',

    trust_score: 'KiparTrust',

    kyc_verified: '✓ KYC Verificado',

    send_package: 'Enviar un paquete →',

    trip_detail: 'Detalle del viaje',

    verified_carrier: 'Transportista verificado Kipar',

    insurance_available: 'Seguro de paquete disponible',

    insurance_desc: 'Protege tu paquete — 3% del valor declarado',

    not_found: 'Viaje no encontrado',

    trips_done: 'viajes',

    reviews: 'opiniones',

    member_since: 'Miembro desde',

  },

  booking: {

    title: 'Describe tu paquete',

    subtitle: 'Esta información será compartida con el transportista',

    receiver_label: 'Correo del receptor',

    receiver_placeholder: 'receptor@email.com',

    content_label: 'Contenido del paquete',

    content_placeholder: 'Ropa, libros, medicamentos...',

    weight_label: 'Peso (kg)',

    value_label: 'Valor declarado (€)',

    transport_cost: 'Transporte',

    commission: 'Gastos de gestión Kipar',

    total: 'Total',

    confirm_btn: 'Confirmar reserva →',

    fill_fields: 'Por favor, rellena todos los campos obligatorios',

    insurance_label: 'Seguro de paquete',

    insurance_desc: '3% del valor declarado',

    insurance_enter_value: 'Introduce un valor',
    reminder_label: 'Recordatorio de entrega',
    reminder_desc: 'Notificar al receptor X horas antes de la cita',
    reminder_none: 'Sin recordatorio',
    reminder_2h: '2h antes',
    reminder_6h: '6h antes',
    reminder_12h: '12h antes',
    reminder_24h: '24h antes',

    insurance_line: 'Seguro',
    urgent_notice_title: 'Paquete urgente',
    urgent_notice_desc: 'Tarifa urgente: 10€ (salida en menos de 36h)',
    urgent_unavailable_title: 'Viaje no disponible',
    urgent_unavailable_desc: 'Este viaje ya no puede reservarse (salida en menos de 36h)',
    weight_exceeds_available: 'Peso solicitado superior al disponible',
    weight_exceeds_max: 'Peso máximo por paquete superado',

  },

  payment: {

    title: 'Método de pago',

    card: 'Tarjeta bancaria',

    card_desc: 'Visa, Mastercard, Apple Pay',

    mobile_money: 'Mobile Money',

    mobile_money_desc: 'Orange Money, Wave, MTN MoMo',

    subtotal: 'Subtotal',

    insurance: 'Seguro de paquete (3%)',

    total: 'Total',

    pay_btn: 'Pagar ahora →',

    secure: 'Pago seguro · Fondos retenidos hasta la entrega',

    simulated: 'Pago simulado — mostrando seguimiento',

      cancel_policy_title: 'Politica de cancelacion',

    cancel_policy_full: 'Cancelacion gratuita hasta 3 dias antes de la salida.',

    cancel_policy_partial: 'Cancelacion entre 1 y 3 dias antes de la salida: reembolso del 50%.',

    cancel_policy_none: 'Cancelacion el dia de la salida: sin reembolso.',

    success: "Pago confirmado!",

    pawapay_waiting: 'Esperando confirmación en su teléfono...',
    pawapay_success: '¡Pago Mobile Money confirmado!',
    pawapay_failed: 'Pago fallido, por favor inténtelo de nuevo.',
    pawapay_phone_label: 'Número Mobile Money',
    pawapay_phone_placeholder: 'Ej: +221 77 000 00 00',
    pawapay_provider_label: 'Operador',
    
    pay_mobile_money: "Pagar con Mobile Money",
    pay_pawapay: "Confirmar pago Mobile Money",

},

  tracking: {

    title: 'Seguimiento del paquete',

    step_confirmed: 'Reserva confirmada',

    step_waiting: 'Esperando aceptación',

    step_escrow: 'Pago seguro (escrow)',

    step_transit: 'Paquete en tránsito',

    step_delivered: 'Entrega confirmada',

    code_label: 'Código para el transportista',

    code_valid: 'Válido hasta la entrega',

    carrier_notified: 'Transportista notificado',

    today: 'Hoy',

  },

  packages: {

    title: 'Mis paquetes',

    empty: 'No hay reservas por el momento',

    login_required: 'Inicia sesión para ver tus paquetes',

    empty_sub: 'Encuentra un viaje y envía tu primer paquete',

    booking_count_one: '{n} reserva',

    booking_count_many: '{n} reservas',

    default_content: 'Paquete',

    tab_listings: 'Mis anuncios',

    tab_bookings: 'Mis reservas',

    filter_all: 'Todos',

    cancel_booking: 'Cancelar reserva',

    confirm_cancel: 'Confirmar cancelacion',

    booking_cancelled: 'Reserva cancelada',

    refund_full: 'Reembolso completo',

    refund_partial: 'Reembolso parcial (50%)',

    refund_none: 'Sin reembolso',

    cancel_reason_placeholder: 'Explique el motivo de su cancelacion...',
    pickup_failed_reported: 'Incidente de recogida reportado',
    delivery_failed_reported: 'Incidente de entrega reportado',
    in_transit_sender_title: 'Paquete en tránsito',
    in_transit_sender_desc: 'El transportista está en camino y gestionando la entrega con el destinatario.',
    pickup_failed_btn: 'Fallo en la recogida',
    delivery_failed_btn: 'Fallo en la entrega',
    support_btn: 'Reportar problema',
    incident_reason_placeholder: 'Explica la situación...',

    cancel_reason_required: 'Por favor, indique un motivo antes de confirmar.',
    flight_tracking_title: 'Seguimiento del vuelo',
    flight_status_scheduled: 'Programado',
    flight_status_active: 'En vuelo',
    flight_status_landed: 'Aterrizado',
    flight_status_delayed: 'Retrasado',
    flight_status_cancelled: 'Cancelado',
    flight_status_unknown: 'Desconocido',
    flight_departure: 'Salida',
    flight_arrival_estimated: 'Llegada estimada',
    flight_arrival_actual: 'Llegada real',
    flight_last_updated: 'Última actualización',
    flight_no_tracking: 'Seguimiento no disponible para este vuelo',
    status_disputed_title: 'Disputa en curso',
    status_disputed_desc: 'Se ha abierto una disputa. El equipo de Kipar está revisando el caso.',
    status_cancelled_title: 'Reserva cancelada',
    status_cancelled_desc: 'Esta reserva ha sido cancelada.',
    status_delivered_title: 'Paquete entregado con éxito',
    status_delivered_desc: 'La entrega ha sido confirmada. Los fondos han sido liberados.',
    status_delivered_review_btn: 'Dejar una reseña',
    delivery_failed_response_title: 'Fallo de entrega reportado',
    delivery_failed_declared_by_you: 'Has reportado un fallo de entrega. Esperando respuesta de la otra parte.',
    delivery_failed_declared_by_other: 'La otra parte reportó un fallo de entrega. Debes responder en 48h.',
    delivery_failed_deadline: 'Plazo de respuesta',
    delivery_failed_accept_btn: 'Acepto',
    delivery_failed_contest_btn: 'Impugno',
    delivery_failed_contest_placeholder: 'Explica por qué impugnas...',
    delivery_failed_accepted: 'Incidente aceptado — procesando',
    delivery_failed_contested: 'Impugnación registrada — disputa abierta',
    pickup_failed_response_title: 'Fallo de recogida reportado',
    pickup_failed_declared_by_you: 'Has reportado un fallo de recogida. Esperando respuesta de la otra parte.',
    pickup_failed_declared_by_other: 'La otra parte reportó un fallo de recogida. Debes responder en 48h.',
    pickup_failed_deadline: 'Plazo de respuesta',
    pickup_failed_accept_btn: 'Acepto — cancelar la reserva',
    pickup_failed_contest_btn: 'Impugno',
    pickup_failed_contest_placeholder: 'Explica por qué impugnas...',
    pickup_failed_accepted: 'Fallo aceptado — la reserva será cancelada',
    pickup_failed_contested: 'Impugnación registrada — disputa abierta',
    rdv_error_past: 'La fecha y hora propuestas están en el pasado',
    rdv_error_too_late: 'La cita debe ser al menos 3h antes de la salida',
    rdv_error_before_arrival: 'La cita debe ser posterior a la llegada del vuelo',
    section_pickup_security: 'Seguridad de la entrega',
    section_transit: 'Estado del tránsito',
    section_delivery_rdv: 'Cita de entrega',
    section_handover: 'Entrega al destinatario',
    section_participants: 'Participantes',

    cancel_reason_label: 'Motivo de cancelacion',

    pickup_failed_title: 'Reportar paquete no entregado',

    pickup_failed_warning: 'Esta accion notifica al remitente. Se requiere un comentario obligatorio.',

    pickup_failed_placeholder: 'Describa por que no se pudo entregar el paquete...',

    pickup_failed_success: 'Reporte enviado al remitente',

    pickup_failed_confirmed: 'Cancelacion confirmada',

    confirm_pickup_failed: 'Confirmar no entrega',

    dispute_btn: 'Disputar',

    dispute_title: 'Disputar la no entrega',

    dispute_placeholder: 'Explique por que esta disputando...',

    dispute_opened: 'Disputa abierta — nuestro equipo revisara la situacion',

    dispute_type: 'Tipo de incidente',
    dispute_stage: 'Cuando ocurrio',
    dispute_value: 'Valor declarado (EUR)',
    dispute_value_placeholder: 'Ej: 150',
    dispute_reason_label: 'Motivo (obligatorio)',
    dispute_photos: 'Fotos de prueba',
    dispute_type_pickup: 'No recogido',
    dispute_type_delivery: 'No entregado',
    dispute_type_damaged: 'Paquete danado',
    dispute_type_lost: 'Paquete perdido',
    dispute_type_wrong_content: 'Contenido incorrecto',
    dispute_type_other: 'Otro',
    dispute_stage_pickup: 'En la recogida',
    dispute_stage_transit: 'En transito',
    dispute_stage_delivery: 'En la entrega',
    dispute_airline: 'Aerolínea',
    dispute_airline_placeholder: 'Seleccione una aerolínea',
    dispute_airlines: ['Air France','Air Senegal','Royal Air Maroc','Ethiopian Airlines','Kenya Airways','EgyptAir','South African Airways','Air Ivoire','Air Mali','Brussels Airlines','Corsair','Transavia','Turkish Airlines','Emirates','Qatar Airways','Vueling','easyJet','Ryanair','British Airways','Lufthansa','KLM','Iberia','TAP Air Portugal','Swiss','Otro'],
    reason_required: 'Se requiere una razon',
    meeting_set_success: 'Cita programada con éxito',
    pickup_meeting_propose_btn: 'Proponer cita de recogida',
    pickup_meeting_reschedule_btn: 'Reprogramar cita de recogida',
    pickup_meeting_proposed: 'Propuesta enviada — esperando confirmación',
    pickup_meeting_confirmed: '¡Cita de recogida confirmada!',
    pickup_meeting_waiting: 'Esperando confirmación de la otra parte',
    pickup_meeting_label: 'Cita de recogida confirmada',
    pickup_meeting_pending_label: 'Propuesta pendiente',
    pickup_meeting_none: 'Ninguna cita de recogida fijada',
    pickup_code_generate_btn: 'Recogí el paquete — Generar código',
    pickup_code_label: 'Código para dar al remitente',
    pickup_code_input_placeholder: 'Introducir código del transportista',
    pickup_validated: '¡Recogida validada — el paquete está en tránsito!',
    pickup_code_invalid: 'Código incorrecto',
    pickup_date_constraint: 'La cita debe ser al menos 3h antes de la salida del vuelo',
    pickup_rdv_required: 'Primero confirma la fecha de la cita de recogida',
    delivery_meeting_propose_btn: 'Proponer cita de entrega',
    delivery_meeting_reschedule_btn: 'Proponer otro horario',
    delivery_meeting_proposed: 'Propuesta enviada — esperando confirmación',
    delivery_meeting_confirmed: '¡Cita de entrega confirmada!',
    delivery_meeting_waiting: 'Esperando confirmación de la otra parte',
    delivery_meeting_label: 'Cita de entrega confirmada',
    delivery_meeting_pending_label: 'Propuesta pendiente',
    delivery_meeting_none: 'Ninguna cita de entrega fijada',
    delivery_meeting_locked: 'La entrega se desbloqueará a la hora de la cita',
    delivery_code_generate_btn: 'Generar mi código de recepción',
    delivery_code_label: 'Código a mostrar al transportista',
    delivery_code_input_placeholder: 'Introducir código del receptor',
    delivery_confirmed: '¡Entrega confirmada!',
    delivery_code_invalid: 'Código incorrecto',
    delivery_date_constraint: 'La cita debe ser posterior a la llegada del vuelo',
    delivery_rdv_required: 'La entrega se desbloqueará una vez confirmada la cita',
    delivery_reschedule_count: 'Reprogramar',
    delivery_reschedule_max: 'Número máximo de reprogramaciones alcanzado (3/3)',
    delivery_alternative_proof_btn: 'Procedimiento alternativo (foto ID + paquete)',
    delivery_alternative_proof_sent: 'Prueba enviada — pendiente de validación del admin',
    accept: 'Aceptar',
    refuse: 'Rechazar',
    invalid_code: 'El código introducido es incorrecto',

  },

  profile: {

    title: 'Mi perfil',

    trust_score: 'Puntuación KiparTrust',

    kyc_status: 'Estado KYC',

    kyc_verified: '✓ Verificado',

    kyc_pending: 'Pendiente',

    my_bookings: 'Mis reservas',

    logout: 'Cerrar sesión',

  },

  search: {

    title: 'Buscar',

    origin_label: 'Origen',

    origin_placeholder: 'Ej: CDG, París...',

    dest_label: 'Destino',

    dest_placeholder: 'Ej: DSS, Dakar...',

    search_btn: 'Buscar',

    no_results: 'No se han encontrado viajes',

    empty_title: 'No hay viajes por el momento',

    empty_subtitle: 'Introduce un destino para buscar viajes',

    filter_date: 'Fecha',

    filter_sort: 'Ordenar por',

    sort_price_asc: 'Precio ascendente',

    sort_price_desc: 'Precio descendente',

    sort_date: 'Fecha de salida',

    results_count: 'viaje encontrado',

    no_results_sub: 'Prueba con otros criterios de búsqueda',

    results_count_plural: 'viajes encontrados',
    show_own_trips: 'Incluir mis viajes',
    hide_own_trips: 'Ocultar mis viajes',
    filter_urgent: 'Acepta urgentes',
    filter_urgent_active: 'Solo urgentes',

  },

  carrier: {

    onboarding_title: 'Conviértete en transportista',

    onboarding_sub: 'Rentabiliza tu equipaje transportando paquetes para la comunidad Kipar',

    onboarding_btn: 'Activar modo transportista',

    onboarding_kyc: 'Se requiere verificación KYC para ser transportista',

    dashboard_title: 'Mi espacio de transportista',

    my_trips: 'Mis anuncios',

    new_trip: 'Nuevo anuncio',

    pending_bookings: 'Reservas pendientes',

    no_trips: 'No has publicado anuncios',

    no_bookings: 'No hay reservas pendientes',

    accept: 'Aceptar',

    pickup_btn: 'Recogí el paquete',

    refuse: 'Rechazar',

    trip_form_title: 'Publicar un anuncio',

    origin_label: 'Aeropuerto de salida',

    dest_label: 'Aeropuerto de destino',

    date_label: 'Fecha de salida',

    departure_time_label: 'Hora de salida',

    arrival_time_label: 'Hora de llegada',
  arrival_date_label: 'Fecha de llegada',
  flight_valid: 'Vuelo encontrado',
  flight_invalid: 'Vuelo no encontrado',
  flight_not_found_advisory: 'Vuelo no encontrado en nuestra base — verifique el número pero puede continuar',

    flight_label: 'Número de vuelo',

    kg_label: 'Kg disponibles',

    max_kg_label: 'Máx kg por paquete',

    price_label: 'Precio por kg (€)',

    step1: 'Activa el modo transportista',

    step2: 'Completa tu verificación KYC',

    step3: 'Publica tus anuncios de viaje',

    no_bookings_sub: 'Las nuevas reservas aparecerán aquí',

    no_treated_bookings: 'Sin reservas procesadas',

    no_treated_bookings_sub: 'Las reservas aceptadas y rechazadas aparecerán aquí',

    no_trips_sub: 'Publica tu primer anuncio',

    submit_btn: 'Publicar mi anuncio',

    tab_pending: 'Pendientes',

    tab_treated: 'Seguimiento',

    tab_trips: 'Mis anuncios',

    accepted_bookings: 'Aceptadas',

    refused_bookings: 'Rechazadas',



    section_departure: 'Salida',

    section_destination: 'Destino',

    section_flight: 'Vuelo',

    section_capacity: 'Capacidad y Precio',

    airport_selected: '✓ Seleccionado',

    accepts_urgent_label: 'Aceptar paquetes urgentes',
    accepts_urgent_desc: 'Paquetes depositados menos de 36h antes de la salida',
    accepts_urgent_premium: 'Función Premium',
    accepts_urgent_sender_fee: 'Tarifa urgente: 10€ (en lugar de 1,50€)',
    trip_published: '¡Anuncio publicado!',

  trip_delete_confirm: '¿Eliminar este anuncio?',

  weight_unit_label: 'Unidad de peso',
  currency_label: 'Divisa',
  trip_deleted: 'Anuncio eliminado',
  price_suggestion_corridor: 'Precios observados en este corredor:',
  net_per_unit: 'Neto recibido',
  price_suggestion_global: 'Precios indicativos de la plataforma:',


  },

  profile_public: {

    member_since: 'Miembro desde hace',

    months: 'meses',

    years: 'años',

    year: 'año',

    deliveries_as_sender: 'Paquetes enviados',

    deliveries_as_carrier: 'Paquetes entregados',

    trips_posted: 'Viajes publicados',

    reviews_received: 'Valoraciones recibidas',

    avg_rating: 'Nota media',

    kyc_verified: 'Identidad verificada',

    kyc_pending: 'KYC pendiente',

    is_carrier_badge: 'Transportista',

    is_sender_badge: 'Remitente',

    no_reviews: 'Sin valoraciones por ahora',

    no_reviews_sub: 'Las valoraciones aparecerán tras las primeras entregas',

    reviews_title: 'Valoraciones recibidas',

    see_all: 'Ver todas',

    load_more: 'Cargar más',

    see_less: 'Ver menos',

    user_not_found: 'Usuario no encontrado',

    loading: 'Cargando perfil...',

    back: 'Volver',

    no_comment: 'Sin comentarios',

  },

  profile_edit: {

    title: 'Mi cuenta',

    subtitle: 'Gestiona tu información y preferencias',

    section_info: 'Información personal',

    section_preferences: 'Preferencias',

    section_security: 'Seguridad',

    section_danger: 'Zona de peligro',

    field_email: 'Correo electrónico',

    field_first_name: 'Nombre',

    field_last_name: 'Apellido',

    field_phone: 'Teléfono',

    field_phone_empty: 'No indicado',

    field_member_since: 'Miembro desde',

    view_public_profile: 'Ver mi perfil público',

    change_photo: 'Cambiar foto',

    edit: 'Editar',

    save: 'Guardar',

    cancel: 'Cancelar',

    saving: 'Guardando...',

    modal_phone_title: 'Modificar teléfono',

    modal_phone_desc: 'Se recomienda formato internacional',

    modal_phone_placeholder: '+34 600 000 000',

    modal_phone_format: 'Formato aceptado: +34600000000 o 600000000',

    error_iban_invalid: 'IBAN inválido',

    error_phone_invalid: 'Formato de teléfono inválido',

    error_phone_already_used: 'Este número ya está en uso',

    success_phone_updated: 'Teléfono actualizado',

    success_weight_unit_updated: 'Unidad de peso actualizada',

    weight_unit_active_listings: "No se puede cambiar la unidad de peso: tienes anuncios activos. Elimínalos primero.",

    edit_btn: 'Editar',

    add_btn: 'Agregar',

    modal_password_title: 'Cambiar contraseña',

    modal_password_desc: 'Elige una nueva contraseña segura',

    field_old_password: 'Contraseña actual',

    field_new_password: 'Nueva contraseña',

    field_confirm_password: 'Confirmar nueva contraseña',

    password_requirements: 'Mín. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial',

    error_password_old_invalid: 'Contraseña actual incorrecta',

    error_password_same: 'La nueva contraseña debe ser diferente',

    error_password_mismatch: 'Las contraseñas no coinciden',

    error_password_weak: 'Contraseña demasiado débil',

    success_password_changed: 'Contraseña modificada',

    modal_avatar_title: 'Foto de perfil',

    modal_avatar_desc: 'JPG, PNG o WebP — Máx 5 MB',

    upload_choose: 'Elegir archivo',

    upload_uploading: 'Subiendo...',

    upload_success: 'Foto actualizada',

    upload_error: 'Error al subir la foto',

    upload_too_large: 'Archivo demasiado grande (Máx 5 MB)',

    upload_wrong_type: 'Formato no soportado (solo JPG, PNG o WebP)',

    avatar_remove: 'Eliminar foto',

    pref_language: 'Idioma',

    pref_language_desc: 'Idioma de la interfaz',

    lang_fr: 'Français',

    lang_en: 'English',

    lang_es: 'Español',

    success_language_updated: 'Idioma actualizado',

    pref_weight: 'Unidad de peso',

    pref_payout: 'Preferencias de pago',

    pref_payout_desc: 'Divisa y método de cobro',

    pref_currency: 'Divisa',

    pref_payment_method: 'Método de pago',

    payment_method_iban: 'Transferencia IBAN',

    payment_method_mobile: 'Mobile Money',

    pref_payment_country: 'País',

    pref_iban: 'IBAN',

    pref_mobile_money: 'Número Mobile Money',

    pref_mobile_money_placeholder: 'Ej: +241 07 00 00 00',

        criteria_punctuality: 'Puntualidad',

    criteria_communication: 'Comunicación',

    criteria_package_care: 'Cuidado del paquete',

    criteria_compliance: 'Conformidad',

    criteria_package_prepared: 'Paquete bien preparado',

    criteria_dropoff_punctuality: 'Puntualidad en la entrega',

    criteria_reliability: 'Seriedad',

    criteria_availability: 'Disponibilidad',

    criteria_delivery_punctuality: 'Puntualidad en la recogida',

    criteria_professionalism: 'Profesionalismo',

    section_review: 'Dejar una valoración',

    review_btn: 'Dejar una valoración',

    review_submitted: 'Valoración enviada',

    review_already: 'Valoración ya enviada',

    review_comment_placeholder: 'Comentario opcional...',

    review_submit_btn: 'Enviar valoración',

    success_payout_updated: 'Preferencias de pago actualizadas',

    field_username: "Nombre de usuario",

    field_address: "Dirección",

    field_username_hint: "4 a 15 caracteres, letras minúsculas, dígitos, guion bajo",

    username_cooldown: "Próximo cambio disponible el",

    username_taken: "Nombre de usuario ya en uso",

    username_available: "Nombre de usuario disponible",

    username_checking: "Verificando...",

    success_username_updated: "Nombre de usuario actualizado",

    success_name_updated: "Nombre actualizado",

    success_address_updated: "Dirección actualizada",

        currency_EUR: 'Euro',

    currency_GBP: 'Libra esterlina',

    currency_USD: 'Dólar estadounidense',

    currency_CHF: 'Franco suizo',

    currency_CAD: 'Dólar canadiense',

    currency_AUD: 'Dólar australiano',

    currency_XOF: 'Franco CFA (UEMOA)',

    currency_XAF: 'Franco CFA (CEMAC)',

    currency_MAD: 'Dírham marroquí',

    currency_EGP: 'Libra egipcia',

    currency_KES: 'Chelín keniano',

    currency_NGN: 'Naira nigeriana',

    currency_GHS: 'Cedi ghaneés',

    currency_ZAR: 'Rand sudafricano',

    currency_HTG: 'Gourde haitiana',

    currency_BRL: 'Real brasileño',

    currency_MXN: 'Peso mexicano',

    currency_AED: 'Dírham emiratí',

    currency_INR: 'Rupia india',

    currency_CNY: 'Yuan chino',

    pref_weight_desc: 'Unidad utilizada para introducir pesos',

    weight_unit_kg: 'kg',

    weight_unit_lb: 'lb',

    weight_unit_g: 'g',
    weight_unit_kg_long: 'kg — Kilogramo',
    weight_unit_lb_long: 'lb — Libra',
    weight_unit_g_long: 'g — Gramo',



    pref_theme: 'Tema',

    pref_theme_desc: 'Apariencia de la aplicación',

    theme_light: 'Claro',

    theme_dark: 'Oscuro',

    theme_auto: 'Automático',

    pref_notifications: 'Notificaciones',

    notify_by_email: 'Correo electrónico',

    notify_by_email_desc: 'Actualizaciones de reservas, facturas, seguridad',

    notify_by_push: 'Notificaciones push',

    notify_by_push_desc: 'Alertas en tiempo real en este dispositivo',

    notify_by_sms: 'SMS',

    notify_by_sms_desc: 'Solo para acciones urgentes',

    success_notifications_updated: 'Preferencias actualizadas',

    kyc_title: 'Verificación de identidad',

    kyc_status_verified: 'Identidad verificada',

    kyc_status_pending: 'KYC pendiente',

    kyc_status_unverified: 'No verificada',

    kyc_action_verify: 'Verificar mi identidad',









    logout: 'Cerrar sesión',

    danger_title: 'Eliminar mi cuenta',

    danger_desc: 'Esta acción es definitiva. Tus paquetes entregados e historial de pagos se conservarán (obligación legal) pero tu perfil será anonimizado.',

    delete_account: 'Eliminar mi cuenta',

    modal_delete_title: 'Confirmar eliminación',

    modal_delete_warning: 'Esta acción es irreversible.',

    modal_delete_desc: 'Tus datos personales se borrarán y tu cuenta se desactivará. El historial de transacciones se conservará por motivos legales.',

    modal_delete_password_label: 'Confirma con tu contraseña',

    modal_delete_password_placeholder: 'Contraseña actual',

    delete_confirm: 'Eliminar definitivamente',

    error_delete_password_invalid: 'Contraseña incorrecta',

    success_account_deleted: 'Cuenta eliminada',

  },

  errors: {

    server_unreachable: 'No se puede conectar con el servidor',

    invalid_credentials: 'Credenciales incorrectas',

    generic: 'Ha ocurrido un error',

  },

  package_detail: {

    not_found: 'Reserva no encontrada',

    section_package: 'Paquete',

    section_carrier: 'Transportista',

    section_sender: 'Remitente',

    section_receiver: 'Receptor',

    section_photos: 'Fotos KiparScan',

    field_content: 'Contenido',

    field_weight: 'Peso',

    field_declared_value: 'Valor declarado',

    field_amount_paid: 'Monto pagado',

    field_insurance: 'Seguro',

    insurance_yes: 'Sí',

    insurance_no: 'No',

    ai_flag_warning: 'Contenido reportado por KiparScan',

    role_carrier: 'Transportista',

    role_sender: 'Remitente',

    role_receiver: 'Receptor',

    see_profile: 'Perfil',

    kyc_verified: 'KYC Verificado',
    section_flight: 'Vuelo',
    field_route: 'Trayecto',
    field_flight: 'N° de vuelo',
    field_departure: 'Salida',
    field_arrival: 'Llegada estimada',

  },

  kiparscan: {

    btn: 'KiparScan IA',

    scanning: 'Analizando...',

    result_title: 'Resultado KiparScan',

    description: 'Descripción',

    weight: 'Peso estimado',

    dimensions: 'Dimensiones',

    confidence: 'Confianza',

    confidence_low: 'Baja',

    confidence_medium: 'Media',

    confidence_high: 'Alta',

    prohibited_flag: 'Contenido potencialmente prohibido',

    prohibited_reason: 'Razón',

    simulated: 'Simulación (sin clave OpenAI)',

    apply_btn: 'Prerrellenar formulario',

    error: 'Error en el análisis KiparScan',

  },

  requests: {

    title: 'Anuncios de paquetes',

    my_requests: 'Mis anuncios',

    new_request: '+ Nuevo anuncio',

    empty: 'Sin anuncios por el momento',

    empty_sub: 'Publica tu primer anuncio para encontrar un transportista',

    post_btn: 'Encontrar transportista',

    create_alert_btn: 'Crear una alerta',

    form_title: 'Describir mi paquete',

    field_content: 'Descripción del paquete',

    field_content_placeholder: 'Ropa, libros, medicamentos...',

    field_weight: 'Peso (kg)',

    field_value: 'Valor declarado (€)',

    field_budget: 'Presupuesto máx (€/kg)',

    field_deadline: 'Fecha límite',

    field_receiver: 'Email o teléfono del receptor',

    field_photos: 'Fotos (máx 3)',

    submit_btn: 'Publicar mi anuncio',

    success_created: '¡Anuncio publicado!',

    applications: 'Candidaturas',

    other_accepted: 'Otro transportista aceptado',

    no_applications: 'Sin candidaturas por el momento',

    accept_btn: 'Elegir este transportista',

    accepted: 'Transportista elegido',

    budget_label: 'Presupuesto',

    deadline_label: 'Fecha límite',

    apply_btn: 'Candidater',

    apply_success: '¡Candidatura enviada!',

    already_applied: 'Ya candidatado',

    price_above_budget: 'El presupuesto máximo del remitente está superado',

    carrier_requests: 'Anuncios de remitentes',

    no_carrier_requests: 'Sin anuncios disponibles',

    no_carrier_requests_sub: 'Los anuncios de remitentes que coincidan con tus viajes aparecerán aquí',

    status_open: 'Abierto',

    status_matched: 'Asignado',

    status_expired: 'Expirado',

    status_cancelled: 'Cancelado',

    delete_confirm: '¿Eliminar este anuncio?',

    deleted: 'Anuncio eliminado',

  },

  delivery: {

    section_code: 'Código de entrega',

    code_label: 'Muestra este código al transportista',

    qr_label: 'o escanea este código QR',

    expires: 'Válido hasta',

    generate_hint: '¿Recibiste tu paquete? Genera tu código para confirmar la entrega.',

    generate_btn: 'Generar código de entrega',

    generating: 'Generando...',

    confirm_title: 'Confirmar entrega',

    enter_code: 'Código de 6 dígitos',

    code_placeholder: '000000',

    scan_qr: 'Escanear código QR',

    confirm_btn: 'Confirmar entrega',

    confirming: 'Confirmando...',

    delivered_toast: 'Entrega confirmada',

    invalid_code: 'Código inválido',

    error_generic: 'Se produjo un error',

    status_delivered: 'Entregado ✓',

  },

  receiver: {

    loading: 'Cargando...',

    title: '¡Un paquete está en camino !',

    from: 'De parte de',

    route: 'Ruta',

    content: 'Contenido',

    weight: 'Peso',

    value: 'Valor declarado',

    expires: 'Enlace válido hasta',

    confirm_btn: 'Confirmo la recepción',

    refuse_btn: 'Rechazar',

    confirming: 'Confirmando...',

    refusing: 'Rechazando...',

    confirmed_title: '¡Recepción confirmada !',

    confirmed_desc: 'Tu cuenta Kipar ha sido creada. Inicia sesión con tu correo y la contraseña temporal a continuación.',

    confirmed_existing: '¡Gracias! La reserva está confirmada. Puedes seguir el paquete en tu espacio Kipar.',

    temp_password_label: 'Contraseña temporal',

    temp_password_note: 'Cámbiala tras tu primer inicio de sesión.',

    login_btn: 'Iniciar sesión en Kipar',

    refused_title: 'Invitación rechazada',

    refused_desc: 'El remitente será notificado y podrá designar otro receptor.',

    expired_title: 'Enlace expirado',

    expired_desc: 'Este enlace ya no es válido. Contacta al remitente para obtener un nuevo enlace.',

    already_title: 'Ya procesado',

    already_desc: 'Esta invitación ya fue aceptada o rechazada.',

    not_found_title: 'Enlace inválido',

    not_found_desc: 'Este enlace de recepción no se encuentra.',

    error_generic: 'Se produjo un error. Inténtalo de nuevo.',

    insurance_label: 'Seguro',

    insurance_yes: 'Incluido',

  },

  verify: {

    email_label: 'Correo electrónico',

    phone_label: 'Teléfono',

    verified: 'Verificado',

    not_verified: 'No verificado',

    verify_btn: 'Verificar',

    code_sent: 'Código enviado. Revisa tu bandeja de entrada.',

    code_sent_phone: 'Código enviado por SMS.',

    enter_code: 'Introduce el código de 6 dígitos',

    resend: 'Reenviar código',

    confirm_btn: 'Confirmar',

    sending: 'Enviando...',

    confirming: 'Verificando...',

    email_verified: 'Correo verificado ✓',

    phone_verified: 'Teléfono verificado ✓',

    invalid_code: 'Código inválido o expirado',

    modal_email_title: 'Verificar tu correo',

    modal_phone_title: 'Verificar tu teléfono',

    modal_email_desc: 'Se enviará un código de 6 dígitos a tu correo electrónico.',

    modal_phone_desc: 'Se enviará un código de 6 dígitos por SMS a tu número.',

  },

  notifications: {

    title: 'Notificaciones',

    empty: 'Sin notificaciones',

    mark_all_read: 'Marcar todo como leido',

    trip_match: 'Nuevo viaje disponible',

    new_application: 'Nueva candidatura',

    just_now: 'Ahora mismo',

  see_all: 'Ver todo',

    delete_read: 'Eliminar leídas',

  },

  chat: {

    title: 'Mensajería',

    placeholder: 'Tu mensaje...',

    readonly_notice: 'Conversación archivada — solo lectura',

    send: 'Enviar',

    you: 'Tú',

    loading: 'Cargando...',

    error_connect: 'No se puede conectar al chat',

    error_send: 'Error al enviar el mensaje',

  },

  support: {

    section_title: 'Soporte',

    chat_label: 'Contactar soporte',

    chat_desc: 'Nuestro equipo está disponible para ayudarte',

    faq_label: 'FAQ',

    faq_desc: 'Consulta nuestras preguntas frecuentes',

  },

  onboarding: {

    step_label: "Paso",

    personal_title: "Tu informacion",

    personal_subtitle: "Completa tu perfil para empezar",

    pref_title: "Tus preferencias",

    pref_subtitle: "Personaliza tu experiencia en Kipar",

    payment_title: "Tus datos bancarios",

    payment_subtitle: "Para recibir pagos como transportista",

    identity_title: "Verificacion de identidad",

    identity_subtitle: "Sube tus documentos para ser verificado KYC",

    id_front: "Documento identidad anverso",

    id_back: "Documento identidad reverso",

    selfie: "Selfie con tu documento",

    upload_btn: "Haz clic para subir",

    done_title: "Perfil completado",

    done_subtitle: "Bienvenido a Kipar.",

    done_btn: "Ir al panel",

    next_btn: "Continuar",

    back_btn: "Atras",

    finish_btn: "Finalizar",

    skip_btn: "Omitir este paso",

    field_first_name: "Nombre",

    field_last_name: "Apellido",

    field_username: "Nombre de usuario",

    field_username_hint: "4 a 15 caracteres, letras minúsculas, dígitos, guion bajo",

    field_address: "Dirección",

    field_address_hint: "Ingrese su dirección o busquela",

    username_available: "Nombre de usuario disponible",

    username_taken: "Nombre de usuario ya en uso",

    username_invalid: "Formato inválido (4-15 car., minúsculas, dígitos, _)",

    username_checking: "Verificando...",

  },

  landing: {

    hero_badge: "Transportistas verificados KiparTrust",

    hero_title_1: "Cada paquete",

    hero_title_2: "merece",

    hero_title_3: "un transportista",

    hero_title_4: "de confianza.",

    hero_tagline: "Envía, Viaja, Comparte.",

    hero_desc: "El primer marketplace de transporte de paquetes entre particulares con verificación de identidad y puntuación KiparTrust.",

    hero_cta_primary: "Comenzar gratis",

    hero_cta_secondary: "Cómo funciona",

    stat_carriers: "Transportistas activos",

    stat_destinations: "Destinos",

    stat_success: "Entregas exitosas",

    stat_rating: "Calificación media",

    how_tag: "Simple y Rápido",

    how_title: "¿Cómo funciona?",

    how_step1_title: "Publica tu anuncio",

    how_step1_desc: "Describe tu paquete, su peso y destino. Nuestra IA KiparScan analiza tus fotos para validar el contenido.",

    how_step2_title: "Elige un transportista",

    how_step2_desc: "Navega por los viajeros verificados KiparTrust en tu corredor. Consulta su puntuación de confianza, reseñas y tarifas.",

    how_step3_title: "Entrega segura",

    how_step3_desc: "El transportista entrega el paquete con un código QR único. El pago se libera solo tras confirmar la recepción.",

    role_sender: "Remitente",

    role_sender_desc: "Envía tus paquetes con tranquilidad",

    role_carrier: "Transportista",

    role_carrier_desc: "Rentabiliza tus viajes",

    role_receiver: "Receptor",

    role_receiver_desc: "Recibe tus paquetes de forma segura",

    video_title: "KIPAR en acción",

    video_placeholder: "Vídeo de presentación — próximamente",

    why_tag: "Nuestra promesa",

    why_title: "¿Por qué elegir KIPAR?",

    why_trust_title: "KiparTrust",

    why_trust_desc: "Nuestro sistema único de puntuación de confianza verifica cada transportista: identidad, historial, reseñas.",

    why_scan_title: "KiparScan IA",

    why_scan_desc: "Nuestra IA analiza las fotos de tus paquetes para validar el contenido y acelerar la conexión.",

    why_globe_title: "50+ destinos",

    why_globe_desc: "CDG, ORY, LYS hacia Abiyán, Dakar, Libreville, Lagos, Casablanca y mucho más.",

    why_community_title: "Comunidad verificada",

    why_community_desc: "Cada miembro es verificado mediante nuestro proceso KYC. Email, teléfono, documento de identidad.",

    corridors_title: "Corredores populares",

    testimonials_tag: "Confían en nosotros",

    testimonials_title: "Lo que dicen de KIPAR",

    cta_title_1: "Listo para unirte",

    cta_title_2: "a la comunidad",

    cta_desc: "Unéte a miles de miembros que confían en KIPAR para sus envíos internacionales.",

    cta_primary: "Crear cuenta gratis",

    cta_secondary: "Iniciar sesión",

    nav_how: "Cómo funciona",

    nav_why: "Por qué KIPAR",

    nav_testimonials: "Testimonios",

    nav_login: "Iniciar sesión",

    nav_login_mobile: "Entrar",

    mockup_verified: "Verificados",
    footer_rights: "KIPAR. Todos los derechos reservados.",
    footer_privacy: "Privacidad",
    footer_terms: "CGU",
    footer_contact: "Contacto",
    video_play: "Ver el vídeo de presentación",
    testimonial1_name: "Aminata D.",
    testimonial1_role: "Remitente, París",
    testimonial1_text: "Envío paquetes a mi familia en Dakar con regularidad. Con KIPAR, elijo un transportista de confianza y me siento tranquila en cada envío.",
    testimonial2_name: "Kofi A.",
    testimonial2_role: "Transportista, Lyon",
    testimonial2_text: "Viajo mucho por trabajo. KIPAR me permite aprovechar mis maletas vacías. El proceso es sencillo y los pagos son seguros.",
    testimonial3_name: "Marie-Claire N.",
    testimonial3_role: "Remitente, Burdeos",
    testimonial3_text: "La puntuación KiparTrust es una verdadera revolución. Sé exactamente a quién le confío mi paquete antes de entregárselo.",

  },

  premium: {
    title: 'KIPAR Premium',
    headline: 'Transporta sin límites',
    subtitle: 'Desbloquea todas las funciones de KIPAR.',
    plan_monthly: 'Mensual',
    plan_annual: 'Anual',
    plan_annual_badge: '-33%',
    plan_monthly_price: '9,99€',
    plan_monthly_per: 'por mes',
    plan_annual_price: '79,99€',
    plan_annual_per: 'por año · 6,67€/mes',
    pay_stripe: 'Pagar con Stripe',
    no_commitment: 'Cancela cuando quieras · Sin compromiso',
    included: 'Qué incluye',
    active_status: 'Suscripción Premium activa',
    cancel_renewal: 'Cancelar renovación',
    cancel_confirm: '¿Cancelar la renovación automática?',
    legal: 'Al suscribirte, aceptas nuestros Términos.',
    feature_bookings: 'Reservas ilimitadas',
    feature_bookings_sub: 'Máx. 3 en gratuito',
    feature_trips: 'Viajes ilimitados',
    feature_trips_sub: 'Máx. 2 en gratuito',
    feature_requests: 'Anuncios ilimitados',
    feature_requests_sub: 'Máx. 2 en gratuito',
    feature_photos: '5 fotos por paquete',
    feature_photos_sub: '2 fotos en gratuito',
    feature_kiparscan: 'KiparScan ilimitado',
    feature_kiparscan_sub: '3 escáneres/mes en gratuito',
    feature_tracking: 'Seguimiento de vuelo en vivo',
    feature_tracking_sub: 'No disponible en gratuito',
    feature_reminder: 'Recordatorio antes de aterrizar',
    feature_reminder_sub: 'No disponible en gratuito',
    feature_export: 'Exportación financiera y fiscal',
    feature_export_sub: 'No disponible en gratuito',
    feature_badge: 'Insignia Premium y mayor visibilidad',
    feature_badge_sub: 'No disponible en gratuito',
    feature_reviews: 'Historial completo de reseñas',
    feature_reviews_sub: 'Últimas 5 en gratuito',
    feature_support: 'Soporte prioritario (SLA 4h)',
    feature_support_sub: 'Soporte estándar en gratuito',
    upgrade_cta: 'Ir a Premium',
    upgrade_bookings: 'Límite: 3 reservas. Actualiza a Premium.',
    upgrade_trips: 'Límite: 2 viajes. Actualiza a Premium.',
    upgrade_requests: 'Límite: 2 anuncios. Actualiza a Premium.',
    upgrade_photos: 'Límite de fotos. Actualiza a Premium.',
    upgrade_tracking: 'Seguimiento disponible en Premium.',
    upgrade_export: 'Exportación disponible en Premium.',
    upgrade_kiparscan: 'Cuota agotada. Actualiza o compra créditos.',
  },

}

