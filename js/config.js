/* Configuración del sitio de recursos. Es lo único que se edita a mano.
   - baseArchivos: dónde están las fotos, videos y PDF. Hoy siguen en el sitio actual de imex.cl.
     Si mañana se mueven (OneDrive, Google Drive, otro servidor), se cambia solo esta línea
     y se mantiene la misma estructura de carpetas.
   - redimensionador: servicio que entrega cada foto en la medida, formato y peso que el cliente elige. */
window.RECURSOS_CONFIG = {
  baseArchivos: 'https://www.imex.cl/recursos/graficas/',
  baseMiniaturas: 'https://www.imex.cl/recursos/wp-content/uploads/',
  baseFotosCatalogo: 'https://www.imex.cl/wp-content/uploads/',
  redimensionador: 'https://wsrv.nl/',
  correoContacto: 'recursosgraficos@imex.cl'
};
