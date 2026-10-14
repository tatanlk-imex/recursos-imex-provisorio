/* Configuración del sitio de recursos. Es lo único que se edita a mano.
   - baseArchivos: dónde están las fotos, videos y PDF. Hoy siguen en el sitio actual de imex.cl.
     Si mañana se mueven (OneDrive, Google Drive, otro servidor), se cambia solo esta línea
     y se mantiene la misma estructura de carpetas.
   - redimensionador: servicio que entrega cada foto en la medida, formato y peso que el cliente elige. */
window.RECURSOS_CONFIG = {
  baseArchivos: 'https://www.imex.cl/recursos/graficas/',
  baseMiniaturas: 'https://www.imex.cl/recursos/wp-content/uploads/',
  baseFotosCatalogo: 'https://www.imex.cl/wp-content/uploads/',
  // Fotos aligeradas en Cloudflare R2 (cuenta de prueba de Jonathan, 14-10-2026). Videos y PDF siguen en imex.cl.
  baseR2: 'https://pub-b2103fb011594be89cfff5a632fbbf9e.r2.dev/',
  redimensionador: 'https://wsrv.nl/',
  correoContacto: 'recursosgraficos@imex.cl'
};
