(function () {
  'use strict';
  var CFG = window.RECURSOS_CONFIG, DATA = window.CATALOGO;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var MARCAS = {}; DATA.marcas.forEach(function (m) { MARCAS[m.id] = m; });
  var NUEVO_DESDE = '2026-01';
  var POR_PAGINA = 48;

  // ---------- utilidades ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sinTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function url(path) {
    if (/^https?:/.test(path)) return path;
    if (path.indexOf('u:') === 0) return CFG.baseMiniaturas + path.slice(2);
    if (path.indexOf('w:') === 0) return CFG.baseFotosCatalogo + path.slice(2);
    if (path.indexOf('r:') === 0) return CFG.baseR2 + path.slice(2);
    if (path.indexOf('fichas/') === 0) return path;
    return CFG.baseArchivos + path;
  }
  function wsrv(full, p) {
    var q = 'url=' + encodeURIComponent(full.replace(/^https?:\/\//, ''));
    Object.keys(p).forEach(function (k) { if (p[k] !== undefined && p[k] !== null && p[k] !== '') q += '&' + k + '=' + encodeURIComponent(p[k]); });
    return CFG.redimensionador + '?' + q;
  }
  function miniatura(path, w, h, fit) { return wsrv(url(path), { w: w, h: h || '', fit: fit || 'cover', output: 'webp', q: 72, we: 1 }); }
  function mb(b) { if (!b) return ''; return b >= 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
  function nombreArchivo(path) { return decodeURIComponent(path.replace(/^[uwr]:/, '').split('/').pop()); }
  function fmtN(n) { return n.toLocaleString('es-CL'); }
  function aviso(t, ms) {
    var a = $('#aviso'); a.textContent = t; a.hidden = false;
    clearTimeout(aviso._t); aviso._t = setTimeout(function () { a.hidden = true; }, ms || 3500);
  }

  // ---------- preparar datos ----------
  var TOT = { fotos: 0, videos: 0, pdf: 0 };
  DATA.productos.forEach(function (p) {
    var vistos = {}, arch = [];
    p.sets.forEach(function (s) {
      s.a.forEach(function (a) {
        if (vistos[a[2]]) return; vistos[a[2]] = 1;
        arch.push({ tipo: a[0], et: a[1], path: a[2], peso: a[3], th: s.th });
      });
    });
    (p.fp || []).forEach(function (u, i) { arch.splice(i, 0, { tipo: 'producto', et: 'Foto de producto ' + (i + 1), path: u, peso: 0 }); });
    p.arch = arch;
    p.yt = p.yt || [];
    p.nF = arch.filter(function (a) { return a.tipo !== 'video' && a.tipo !== 'pdf'; }).length;
    p.nR = p.sets.length;
    p.nV = arch.filter(function (a) { return a.tipo === 'video'; }).length + p.yt.length;
    p.nP = arch.filter(function (a) { return a.tipo === 'pdf'; }).length + (p.fi ? 1 : 0);
    p.th = (p.sets[0] && p.sets[0].th) || (p.fp && p.fp[0]) || (arch[0] && arch[0].path);
    TOT.fotos += p.nF; TOT.videos += p.nV; TOT.pdf += p.nP;
    p.busq = sinTildes([p.t, p.tr || '', p.cod, MARCAS[p.m].nombre, p.c.join(' '), p.d || '', arch.map(function (a) { return nombreArchivo(a.path); }).join(' ')].join(' ')).replace(/[_\-]/g, ' ');
  });

  // ---------- estado ----------
  var est = { marca: '', cat: '', q: '', video: false, pdf: false, orden: 'nuevo', mostrados: POR_PAGINA, scroll: 0 };
  var opc = leerOpciones();
  var seleccion = {}; // path -> {path, prod}

  function leerOpciones() {
    var d = { medida: 'orig', ajuste: 'contain', formato: 'jpg', calidad: 'media', ancho: 1000, alto: '' };
    try { var g = JSON.parse(localStorage.getItem('recursos_opc') || 'null'); if (g) Object.keys(d).forEach(function (k) { if (g[k] !== undefined) d[k] = g[k]; }); } catch (e) {}
    return d;
  }
  function guardarOpciones() { try { localStorage.setItem('recursos_opc', JSON.stringify(opc)); } catch (e) {} }

  // ---------- inicio ----------
  function pintarCifras() {
    $('#cifras').innerHTML =
      '<div><b>' + fmtN(DATA.productos.length) + '</b>productos</div>' +
      '<div><b>' + fmtN(TOT.fotos) + '</b>fotos</div>' +
      '<div><b>' + fmtN(TOT.videos) + '</b>videos</div>' +
      '<div><b>' + DATA.marcas.length + '</b>marcas</div>';
  }
  function pintarMarcas() {
    var h = '<button class="marca" data-m="" aria-pressed="' + (!est.marca) + '">Todas<small>' + fmtN(DATA.productos.length) + ' productos</small></button>';
    DATA.marcas.forEach(function (m) {
      h += '<button class="marca" data-m="' + m.id + '" aria-pressed="' + (est.marca === m.id) + '">' + esc(m.nombre) + '<small>' + fmtN(m.n) + ' productos</small></button>';
    });
    $('#marcas').innerHTML = h;
    var cats = est.marca ? MARCAS[est.marca].cats : [];
    var hc = '';
    if (cats.length > 1) {
      hc = '<button class="cat" data-c="" aria-pressed="' + (!est.cat) + '">Todas las categorías</button>';
      cats.forEach(function (c) { hc += '<button class="cat" data-c="' + esc(c) + '" aria-pressed="' + (est.cat === c) + '">' + esc(c) + '</button>'; });
    }
    $('#cats').innerHTML = hc;
  }
  function filtrar() {
    var toks = sinTildes(est.q).replace(/[_\-]/g, ' ').split(/\s+/).filter(Boolean);
    var r = DATA.productos.filter(function (p) {
      if (est.marca && p.m !== est.marca) return false;
      if (est.cat && p.c.indexOf(est.cat) < 0) return false;
      if (est.video && !p.nV) return false;
      if (est.pdf && !p.nP) return false;
      if (est.redes && !p.nR) return false;
      for (var i = 0; i < toks.length; i++) if (p.busq.indexOf(toks[i]) < 0) return false;
      return true;
    });
    if (est.orden === 'az') r.sort(function (a, b) { return a.t.localeCompare(b.t, 'es'); });
    else r.sort(function (a, b) { return (b.f || '').localeCompare(a.f || '') || a.t.localeCompare(b.t, 'es'); });
    return r;
  }
  function pintarGrilla() {
    var r = filtrar();
    $('#destacados').hidden = !!(est.marca || est.q || est.cat || est.video || est.pdf || est.redes);
    var parte = r.slice(0, est.mostrados);
    var txt = fmtN(r.length) + (r.length === 1 ? ' producto' : ' productos');
    if (est.q) txt += ' para «' + est.q + '»';
    $('#resultado').textContent = txt;
    if (!r.length) {
      $('#grilla').innerHTML = '<p class="vacio">No encontramos productos con esa búsqueda. Prueba con el código (ej.: D230040) o con otra palabra.</p>';
    } else {
      $('#grilla').innerHTML = parte.map(function (p) {
        var meta = [];
        if (p.nF) meta.push(p.nF + (p.nF === 1 ? ' foto' : ' fotos'));
        if (p.nV) meta.push(p.nV + (p.nV === 1 ? ' video' : ' videos'));
        if (p.nP) meta.push(p.nP + ' PDF');
        return '<a class="tarj" href="#/p/' + encodeURIComponent(p.id) + '">' +
          '<div class="tarj-img">' + (p.th ? '<img loading="lazy" alt="" src="' + esc(miniatura(p.th, 400, 400)) + '">' : '') +
          (p.f >= NUEVO_DESDE ? '<span class="tarj-nuevo">Nuevo</span>' : '') + '</div>' +
          '<div class="tarj-cuerpo"><span class="tarj-marca">' + esc(MARCAS[p.m].nombre) + '</span>' +
          '<span class="tarj-t">' + esc(p.t) + '</span><span class="tarj-meta">' + meta.join(' · ') + '</span></div></a>';
      }).join('');
    }
    $('#ver-mas').hidden = r.length <= est.mostrados;
  }

  // ---------- destacados de la portada ----------
  var PORID = {}; DATA.productos.forEach(function (p) { PORID[p.id] = p; });
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fechaTxt(a, b) {
    var x = a.split('-'), y = b.split('-');
    return +x[2] + (x[1] !== y[1] ? ' de ' + MESES[+x[1] - 1] : '') + ' al ' + +y[2] + ' de ' + MESES[+y[1] - 1];
  }
  function tarjetaMini(p) {
    return '<a class="tarj" href="#/p/' + encodeURIComponent(p.id) + '"><div class="tarj-img"><img loading="lazy" alt="" src="' + esc(miniatura(p.th, 400, 400)) + '">' +
      (p.f >= NUEVO_DESDE ? '<span class="tarj-nuevo">Nuevo</span>' : '') + '</div><div class="tarj-cuerpo"><span class="tarj-marca">' + esc(MARCAS[p.m].nombre) + '</span><span class="tarj-t">' + esc(p.t) + '</span></div></a>';
  }
  function pintarDestacados() {
    var nov = DATA.productos.filter(function (p) { return p.nR && p.th; }).sort(function (a, b) { return (b.f || '').localeCompare(a.f || ''); });
    var vistos = {}, sel = [];
    nov.forEach(function (p) { if (sel.length < 18 && (vistos[p.m] || 0) < 4) { sel.push(p); vistos[p.m] = (vistos[p.m] || 0) + 1; } });
    $('#carril').innerHTML = sel.map(tarjetaMini).join('');
    var I = window.IDEAS;
    if (I && I.semanas.length) {
      var hoy = new Date().toISOString().slice(0, 10), idx = I.semanas.length - 1;
      for (var i = 0; i < I.semanas.length; i++) { if (I.semanas[i].hasta >= hoy) { idx = i; break; } }
      $('#semana').innerHTML = I.semanas.map(function (s, i) { return '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>Semana del ' + fechaTxt(s.desde, s.hasta) + '</option>'; }).join('');
      pintarIdeas(idx);
      var k = 0, C = I.consejos;
      var pc = function () {
        $('#consejo').innerHTML = '<b>' + esc(C[k].titulo) + '</b><p>' + esc(C[k].texto) + '</p>';
        $('#puntos').innerHTML = C.map(function (_, j) { return '<button class="punto" data-consejo="' + j + '" aria-label="Consejo ' + (j + 1) + '"' + (j === k ? ' aria-current="true"' : '') + '></button>'; }).join('');
      };
      pc(); pintarDestacados.consejo = function (j) { k = j; pc(); };
      if (!quieto) setInterval(function () { if (!document.hidden) { k = (k + 1) % C.length; pc(); } }, 8000);
    } else { $('.ideas').hidden = true; }
    var CM = window.COMENTARIOS || [];
    if (CM.length) {
      var j = 0, pcm = function () { var c = CM[j]; $('#comentarios').innerHTML = '<span class="etq">Lo que dicen nuestros clientes</span><blockquote>«' + esc(c.texto) + '»</blockquote><p class="autor">' + esc([c.autor, c.empresa, c.ciudad].filter(Boolean).join(' · ')) + '</p>'; };
      pcm(); if (!quieto && CM.length > 1) setInterval(function () { j = (j + 1) % CM.length; pcm(); }, 9000);
    } else {
      $('#comentarios').innerHTML = '<span class="etq">Tu publicación puede aparecer aquí</span><p><b>¿Publicaste con nuestro material?</b> Envíanos el enlace o una captura y cuéntanos cómo te fue. Mostraremos aquí las mejores publicaciones de nuestros clientes.</p>' +
        '<a class="btn" href="mailto:' + esc(CFG.correoContacto) + '?subject=' + encodeURIComponent('Mi publicación con material Imex') + '">Enviar mi publicación</a>';
    }
    if (!quieto) {
      var car = $('#carril'), pausa = false;
      car.addEventListener('mouseenter', function () { pausa = true; }); car.addEventListener('mouseleave', function () { pausa = false; });
      car.addEventListener('focusin', function () { pausa = true; }); car.addEventListener('focusout', function () { pausa = false; });
      setInterval(function () {
        if (pausa || document.hidden || $('#destacados').hidden || $('#vista-inicio').hidden) return;
        var w = car.firstElementChild ? car.firstElementChild.getBoundingClientRect().width + 16 : 200;
        if (car.scrollLeft + car.clientWidth >= car.scrollWidth - 5) car.scrollTo({ left: 0, behavior: 'smooth' }); else car.scrollBy({ left: w, behavior: 'smooth' });
      }, 4500);
    }
  }
  function pintarIdeas(i) {
    var s = window.IDEAS.semanas[i];
    $('#ideas-por').textContent = s.tema + '. ' + s.por_que;
    $('#ideas').innerHTML = s.ideas.map(function (d, n) {
      var prods = (d.prods || []).map(function (id) { return PORID[id]; }).filter(Boolean);
      return '<article class="idea"><div class="idea-cab"><span class="chip">' + esc(d.marca) + '</span><span class="chip suave">' + esc(d.formato) + '</span></div>' +
        '<h3>' + esc(d.titulo) + '</h3><p class="idea-txt" id="idea-' + n + '">' + esc(d.texto) + '<br><span class="hash">' + esc((d.hashtags || []).join(' ')) + '</span></p>' +
        '<button class="btn sec peq" data-copiar="idea-' + n + '">Copiar texto</button>' +
        '<p class="idea-como"><b>Cómo hacerla:</b> ' + esc(d.como_hacerla) + '</p>' +
        (prods.length ? '<div class="idea-prods">' + prods.map(function (p) { return '<a href="#/p/' + encodeURIComponent(p.id) + '" title="' + esc(p.t) + '"><img loading="lazy" alt="' + esc(p.t) + '" src="' + esc(miniatura(p.th, 160, 160)) + '"><span>Bajar fotos</span></a>'; }).join('') + '</div>' : '') +
        '</article>';
    }).join('');
  }

  // ---------- producto ----------
  var MEDIDAS = [
    ['orig', 'Tamaño original', 'sin cambiar medidas'],
    ['post', 'Post cuadrado', '1080 × 1080'],
    ['vert', 'Post vertical', '1080 × 1350'],
    ['hist', 'Historia / Reel', '1080 × 1920'],
    ['w1200', 'Web grande', '1200 px de ancho'],
    ['w800', 'Web', '800 px de ancho'],
    ['w400', 'Miniatura', '400 px de ancho'],
    ['perso', 'A medida', 'tú eliges']
  ];
  var FIJAS = { post: [1080, 1080], vert: [1080, 1350], hist: [1080, 1920] };
  var CALIDAD = { alta: [90, 'Alta'], media: [80, 'Media'], liviana: [62, 'Liviana'] };

  function paramsDescarga() {
    var p = { output: opc.formato };
    if (opc.formato !== 'png') p.q = CALIDAD[opc.calidad][0];
    if (FIJAS[opc.medida]) { p.w = FIJAS[opc.medida][0]; p.h = FIJAS[opc.medida][1]; p.fit = opc.ajuste; if (opc.ajuste === 'contain') p.cbg = 'white'; }
    else if (opc.medida === 'w1200') { p.w = 1200; p.we = 1; }
    else if (opc.medida === 'w800') { p.w = 800; p.we = 1; }
    else if (opc.medida === 'w400') { p.w = 400; p.we = 1; }
    else if (opc.medida === 'perso') {
      var w = parseInt(opc.ancho, 10) || 0, h = parseInt(opc.alto, 10) || 0;
      if (w) p.w = Math.min(w, 6000);
      if (h) p.h = Math.min(h, 6000);
      if (w && h) { p.fit = opc.ajuste; if (opc.ajuste === 'contain') p.cbg = 'white'; } else p.we = 1;
    }
    if (opc.formato === 'jpg' && !p.cbg) p.bg = 'white';
    return p;
  }
  function sufijo() {
    if (FIJAS[opc.medida]) return '_' + FIJAS[opc.medida].join('x');
    if (opc.medida === 'w1200') return '_w1200';
    if (opc.medida === 'w800') return '_w800';
    if (opc.medida === 'w400') return '_w400';
    if (opc.medida === 'perso') return '_' + (opc.ancho || 'auto') + (opc.alto ? 'x' + opc.alto : 'w');
    return '';
  }
  function nombreSalida(path) {
    var n = nombreArchivo(path).replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
    return n + sufijo() + '.' + opc.formato;
  }
  function urlDescarga(path) { return wsrv(url(path), paramsDescarga()); }
  function resumenOpc() {
    var m = MEDIDAS.filter(function (x) { return x[0] === opc.medida; })[0];
    var t = m[1] + (opc.medida === 'perso' ? ' (' + (opc.ancho || '—') + (opc.alto ? ' × ' + opc.alto : ' px de ancho') + ')' : ' (' + m[2] + ')');
    if (FIJAS[opc.medida] || (opc.medida === 'perso' && opc.ancho && opc.alto)) t += ', ' + (opc.ajuste === 'contain' ? 'sin recortar' : 'recortada al centro');
    t += ' · ' + opc.formato.toUpperCase();
    if (opc.formato !== 'png') t += ' · calidad ' + CALIDAD[opc.calidad][1].toLowerCase();
    return t;
  }

  function panelOpciones() {
    function seg(nombre, items) {
      return '<div class="seg" data-op="' + nombre + '">' + items.map(function (i) {
        return '<button type="button" data-v="' + i[0] + '" aria-pressed="' + (opc[nombre] === i[0]) + '">' + i[1] + (i[2] ? '<small>' + i[2] + '</small>' : '') + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="opciones" id="opciones">' +
      '<h2>¿Cómo quieres descargar las fotos?</h2>' +
      '<p class="ayuda">Elige una vez y aplica a todas las fotos que descargues. Los videos y PDF se descargan tal como están.</p>' +
      '<div class="op-filas">' +
      '<div class="op" style="grid-column:1/-1"><label class="t">Medida</label>' + seg('medida', MEDIDAS) +
      '<div class="op-perso" id="op-perso"' + (opc.medida === 'perso' ? '' : ' hidden') + '>Ancho <input type="number" min="50" max="6000" id="op-ancho" value="' + esc(opc.ancho) + '"> px &nbsp; Alto <input type="number" min="50" max="6000" id="op-alto" placeholder="automático" value="' + esc(opc.alto) + '"> px</div></div>' +
      '<div class="op" id="op-ajuste-caja"><label class="t">Si la foto no calza con la medida</label>' + seg('ajuste', [['contain', 'Sin recortar', 'agrega bordes blancos'], ['cover', 'Recortar al centro', 'llena todo el espacio']]) + '</div>' +
      '<div class="op"><label class="t">Formato</label>' + seg('formato', [['jpg', 'JPG', 'más liviano'], ['png', 'PNG', 'sin pérdida'], ['webp', 'WEBP', 'para web']]) + '</div>' +
      '<div class="op" id="op-cal-caja"><label class="t">Peso</label>' + seg('calidad', [['alta', 'Alta calidad', 'más pesado'], ['media', 'Equilibrado', 'recomendado'], ['liviana', 'Liviano', 'para WhatsApp o web']]) + '</div>' +
      '</div><div class="op-resumen" id="op-resumen">Vas a descargar: <b>' + esc(resumenOpc()) + '</b></div></div>';
  }
  function refrescarOpciones() {
    var cont = $('#opciones'); if (!cont) return;
    cont.querySelectorAll('.seg').forEach(function (s) {
      var k = s.getAttribute('data-op');
      s.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === opc[k])); });
    });
    $('#op-perso').hidden = opc.medida !== 'perso';
    $('#op-ajuste-caja').style.opacity = (FIJAS[opc.medida] || (opc.medida === 'perso' && opc.alto)) ? 1 : .45;
    $('#op-cal-caja').style.opacity = opc.formato === 'png' ? .45 : 1;
    $('#op-resumen').innerHTML = 'Vas a descargar: <b>' + esc(resumenOpc()) + '</b>';
  }

  function tarjetaFoto(a, p) {
    var vert = a.tipo === 'historia';
    var sel = !!seleccion[a.path];
    var pesado = a.peso > 2e6;
    return '<div class="arch' + (sel ? ' sel' : '') + '" data-path="' + esc(a.path) + '">' +
      '<label class="arch-chk"><input type="checkbox" data-sel="' + esc(a.path) + '"' + (sel ? ' checked' : '') + '> Elegir</label>' +
      '<div class="arch-img' + (vert ? ' vert' : '') + '" data-ver="' + esc(a.path) + '"><img loading="lazy" alt="' + esc(a.et) + '" src="' + esc(miniatura(a.path, 360, vert ? 560 : 360, 'inside')) + '"></div>' +
      '<div class="arch-pie"><span class="arch-n">' + esc(a.et) + '</span>' +
      '<span class="arch-p' + (pesado ? ' pesado' : '') + '">' + (a.peso ? 'Archivo: ' + mb(a.peso) + ' · ' : '') + '<a href="' + esc(url(a.path)) + '" target="_blank" rel="noopener">ver en grande</a></span>' +
      '<div class="arch-b"><button class="btn peq" data-desc="' + esc(a.path) + '">Descargar</button></div></div></div>';
  }
  function tarjetaVideo(a, p) {
    var pesado = a.peso > 50e6;
    return '<div class="arch"><div class="video-caja" data-video="' + esc(a.path) + '">' + (a.th ? '<img alt="" loading="lazy" src="' + esc(miniatura(a.th, 360, 480)) + '">' : '') + '<span class="play" aria-label="Reproducir"></span></div>' +
      '<div class="arch-pie"><span class="arch-n">' + esc(a.et) + '</span>' +
      '<span class="arch-p' + (pesado ? ' pesado' : '') + '">' + nombreArchivo(a.path).split('.').pop().toUpperCase() + ' · ' + mb(a.peso) + (pesado ? ' (pesado)' : '') + '</span>' +
      '<div class="arch-b"><a class="btn peq" href="' + esc(url(a.path)) + '" target="_blank" rel="noopener" download>Descargar video</a></div></div></div>';
  }
  function tarjetaPdf(a) {
    return '<div class="arch"><div class="pdf-ic">PDF</div><div class="arch-pie"><span class="arch-n">' + esc(a.et) + '</span><span class="arch-p">' + mb(a.peso) + '</span>' +
      '<div class="arch-b"><a class="btn peq" href="' + esc(url(a.path)) + '" target="_blank" rel="noopener">Abrir o descargar</a></div></div></div>';
  }

  function pintarProducto(p) {
    var m = MARCAS[p.m];
    var grupos = [
      ['producto', 'Fotos del producto (fondo blanco)', function (a) { return a.tipo === 'producto'; }, tarjetaFoto],
      ['post', 'Fotos para publicaciones', function (a) { return a.tipo === 'post' || a.tipo === 'banner'; }, tarjetaFoto],
      ['historia', 'Historias (formato vertical)', function (a) { return a.tipo === 'historia'; }, tarjetaFoto],
      ['video', 'Videos', function (a) { return a.tipo === 'video'; }, tarjetaVideo],
      ['pdf', 'Fichas y catálogos', function (a) { return a.tipo === 'pdf'; }, tarjetaPdf]
    ];
    var h = '<nav class="migas"><a href="#/">Inicio</a> › <a href="#/m/' + p.m + '">' + esc(m.nombre) + '</a> › ' + esc(p.c[0]) + '</nav>' +
      '<div class="prod-cab">' + (p.th ? '<img alt="" src="' + esc(miniatura(p.th, 360, 360)) + '">' : '') +
      '<div class="prod-info"><span class="tarj-marca">' + esc(m.nombre) + ' · ' + esc(p.c.join(', ')) + '</span><h1>' + esc(p.t) + '</h1>' +
      (p.cod ? '<span class="cod">Código ' + esc(p.cod) + '</span>' : '') +
      (p.d ? '<p class="desc">' + esc(p.d) + '</p>' : '') +
      '<p>' + [p.nF ? p.nF + ' fotos' : '', p.nV ? p.nV + ' videos' : '', p.nP ? p.nP + ' PDF' : ''].filter(Boolean).join(' · ') + '</p>' +
      '<div class="prod-acc">' + (p.nF ? '<button class="btn" id="zip-todo">Descargar todas las fotos (ZIP)</button>' : '') +
      (p.fi ? '<a class="btn sec" href="' + esc(p.fi) + '" target="_blank" rel="noopener">Ficha técnica (PDF)</a>' : '') +
      '<button class="btn sec" id="copiar">Copiar enlace de este producto</button></div></div></div>';
    if (p.nF) h += panelOpciones();
    grupos.forEach(function (g) {
      var as = p.arch.filter(g[2]);
      if (!as.length) return;
      var esFoto = g[0] === 'post' || g[0] === 'historia' || g[0] === 'producto';
      h += '<section class="seccion"><div class="seccion-cab"><h2>' + g[1] + ' <span>(' + as.length + ')</span></h2>' +
        (esFoto ? '<button class="btn sec peq" data-selgrupo="' + g[0] + '">Elegir todas</button>' : '') + '</div>' +
        '<div class="archivos">' + as.map(function (a) { return g[3](a, p); }).join('') + '</div></section>';
    });
    if (p.yt.length) {
      h += '<section class="seccion"><div class="seccion-cab"><h2>Videos en YouTube <span>(' + p.yt.length + ')</span></h2></div><div class="archivos">' +
        p.yt.map(function (id) {
          return '<div class="arch"><div class="video-caja yt" data-yt="' + esc(id) + '"><img alt="" loading="lazy" src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg"><span class="play" aria-label="Reproducir"></span></div>' +
            '<div class="arch-pie"><span class="arch-n">Video de YouTube</span><div class="arch-b"><a class="btn peq sec" href="https://www.youtube.com/watch?v=' + esc(id) + '" target="_blank" rel="noopener">Abrir en YouTube</a></div></div></div>';
        }).join('') + '</div></section>';
    }
    if (p.tr && sinTildes(p.tr) !== sinTildes(p.t)) h += '<p class="nota-redes">En el sitio anterior este material aparecía como «' + esc(p.tr) + '».</p>';
    h += '<p class="nota-uso">Uso de este material: puedes publicarlo para promocionar y vender productos originales de nuestras marcas. No lo modifiques de forma que cambie el producto, ni lo uses para otras marcas. ¿Te falta una foto o un formato? <a href="mailto:' + esc(CFG.correoContacto) + '?subject=' + encodeURIComponent('Material que no encuentro: ' + p.t + (p.cod ? ' (' + p.cod + ')' : '')) + '">Pídelo aquí</a>.</p>';
    var v = $('#vista-producto'); v.innerHTML = h; v.dataset.id = p.id;
    if (p.nF) refrescarOpciones();
    document.title = p.t + ' · Recursos Imex';
  }

  // ---------- descargas ----------
  function guardarBlob(blob, nombre) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function traer(u) {
    return fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
  }
  function descargarUna(path, btn) {
    if (opc.medida === 'perso' && !parseInt(opc.ancho, 10) && !parseInt(opc.alto, 10)) { aviso('Escribe el ancho o el alto que necesitas.'); return; }
    var t = btn.textContent; btn.disabled = true; btn.textContent = 'Preparando…';
    traer(urlDescarga(path)).then(function (b) {
      guardarBlob(b, nombreSalida(path));
      aviso('Listo: ' + nombreSalida(path) + ' (' + mb(b.size) + ')');
    }).catch(function () {
      window.open(urlDescarga(path), '_blank', 'noopener');
      aviso('Se abrió la foto en otra pestaña: guárdala con clic derecho › Guardar imagen.', 6000);
    }).then(function () { btn.disabled = false; btn.textContent = t; });
  }
  function descargarZip(items) {
    if (!items.length) return;
    if (!window.JSZip) { aviso('Cargando… intenta de nuevo en un segundo.'); return; }
    var zip = new JSZip(), hechos = 0, fallas = 0, total = items.length, i = 0, usados = {};
    var pr = $('#progreso'), bar = $('#progreso-b'), txt = $('#progreso-t');
    $('#barra-desc').hidden = false; pr.hidden = false; bar.style.width = '0'; $('#sel-zip').disabled = true;
    var zb = $('#zip-todo'); if (zb) zb.disabled = true;
    function sig() {
      if (i >= total) return Promise.resolve();
      var it = items[i++];
      var carpeta = it.prod.t.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60);
      var n = carpeta + '/' + nombreSalida(it.path);
      if (usados[n]) n = n.replace(/(\.\w+)$/, '_' + (++usados[n]) + '$1'); else usados[n] = 1;
      return traer(urlDescarga(it.path)).then(function (b) { zip.file(n, b); }).catch(function () { fallas++; })
        .then(function () { hechos++; bar.style.width = (hechos / total * 100) + '%'; txt.textContent = hechos + ' de ' + total + ' fotos'; return sig(); });
    }
    Promise.all([sig(), sig(), sig(), sig()]).then(function () {
      txt.textContent = 'Armando el ZIP…';
      return zip.generateAsync({ type: 'blob' });
    }).then(function (b) {
      var f = new Date(), nom = 'Recursos_Imex_' + f.getFullYear() + String(f.getMonth() + 1).padStart(2, '0') + String(f.getDate()).padStart(2, '0') + '.zip';
      guardarBlob(b, nom);
      aviso('ZIP listo: ' + (total - fallas) + ' fotos, ' + mb(b.size) + (fallas ? '. ' + fallas + ' no se pudieron bajar.' : '.'), 6000);
    }).catch(function () { aviso('No se pudo armar el ZIP. Intenta con menos fotos.', 6000); })
      .then(function () { pr.hidden = true; $('#sel-zip').disabled = false; if (zb) zb.disabled = false; actualizarBarra(); });
  }
  function actualizarBarra() {
    var n = Object.keys(seleccion).length;
    $('#sel-n').textContent = n + (n === 1 ? ' foto seleccionada' : ' fotos seleccionadas');
    $('#barra-desc').hidden = n === 0 && $('#progreso').hidden;
  }
  function alternarSel(path, on) {
    var p = productoActual(); if (!p) return;
    if (on) seleccion[path] = { path: path, prod: p }; else delete seleccion[path];
    var el = document.querySelector('.arch[data-path="' + CSS.escape(path) + '"]');
    if (el) { el.classList.toggle('sel', on); var c = el.querySelector('input'); if (c) c.checked = on; }
    actualizarBarra();
  }
  function productoActual() {
    var id = $('#vista-producto').dataset.id;
    return DATA.productos.filter(function (p) { return p.id === id; })[0];
  }

  // ---------- rutas ----------
  function ruta() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var vi = $('#vista-inicio'), vp = $('#vista-producto');
    if (h.indexOf('p/') === 0) {
      var p = DATA.productos.filter(function (x) { return x.id === h.slice(2); })[0];
      if (p) {
        if (!vi.hidden) est.scroll = window.scrollY;
        vi.hidden = true; vp.hidden = false; pintarProducto(p); window.scrollTo(0, 0); return;
      }
    }
    var m = h.indexOf('m/') === 0 ? h.slice(2) : '';
    if (m !== est.marca && (m === '' || MARCAS[m])) { est.marca = m; est.cat = ''; est.mostrados = POR_PAGINA; }
    var venia = !vp.hidden;
    vp.hidden = true; vi.hidden = false; document.title = 'Recursos Imex';
    pintarMarcas(); pintarGrilla();
    if (venia) window.scrollTo(0, est.scroll);
  }

  // ---------- eventos ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-ver], [data-video], [data-yt]');
    if (!t) return;
    if (t.hasAttribute('data-car')) { var c = $('#carril'); c.scrollBy({ left: +t.getAttribute('data-car') * c.clientWidth * 0.8, behavior: 'smooth' }); return; }
    if (t.hasAttribute('data-consejo')) { pintarDestacados.consejo(+t.getAttribute('data-consejo')); return; }
    if (t.hasAttribute('data-copiar')) {
      var tx = document.getElementById(t.getAttribute('data-copiar')).innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(tx) : Promise.reject()).then(function () { aviso('Texto copiado. Pégalo en tu publicación.'); }, function () { aviso('No se pudo copiar; selecciona el texto y cópialo.'); });
      return;
    }
    if (t.matches('.marca')) { var m = t.getAttribute('data-m'); location.hash = m ? '#/m/' + m : '#/'; return; }
    if (t.matches('.cat')) { est.cat = t.getAttribute('data-c'); est.mostrados = POR_PAGINA; pintarMarcas(); pintarGrilla(); return; }
    if (t.id === 'ver-mas') { est.mostrados += POR_PAGINA; pintarGrilla(); return; }
    if (t.closest('.seg')) {
      var k = t.closest('.seg').getAttribute('data-op'); opc[k] = t.getAttribute('data-v'); guardarOpciones(); refrescarOpciones(); return;
    }
    if (t.hasAttribute('data-desc')) { descargarUna(t.getAttribute('data-desc'), t); return; }
    if (t.hasAttribute('data-selgrupo')) {
      var g = t.getAttribute('data-selgrupo'), p = productoActual();
      var as = p.arch.filter(function (a) { return g === 'post' ? (a.tipo === 'post' || a.tipo === 'banner') : a.tipo === g; });
      if (as.length > 120) as = as.slice(0, 120);
      var todas = as.every(function (a) { return seleccion[a.path]; });
      as.forEach(function (a) { alternarSel(a.path, !todas); });
      t.textContent = todas ? 'Elegir todas' : 'Quitar todas';
      return;
    }
    if (t.id === 'zip-todo') {
      var pp = productoActual();
      descargarZip(pp.arch.filter(function (a) { return a.tipo !== 'video' && a.tipo !== 'pdf'; }).map(function (a) { return { path: a.path, prod: pp }; }));
      return;
    }
    if (t.id === 'copiar') {
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () { aviso('Enlace copiado.'); }, function () { aviso(location.href, 6000); });
      return;
    }
    if (t.id === 'sel-limpiar') { Object.keys(seleccion).forEach(function (k) { alternarSel(k, false); }); seleccion = {}; actualizarBarra(); return; }
    if (t.id === 'sel-zip') { descargarZip(Object.keys(seleccion).map(function (k) { return seleccion[k]; })); return; }
    if (t.hasAttribute('data-ver')) {
      var v = document.createElement('div'); v.className = 'visor';
      v.innerHTML = '<img alt="" src="' + esc(wsrv(url(t.getAttribute('data-ver')), { w: 1400, h: 1400, fit: 'inside', output: 'webp', q: 82, we: 1 })) + '">';
      v.addEventListener('click', function () { v.remove(); });
      document.body.appendChild(v); return;
    }
    if (t.hasAttribute('data-yt')) {
      t.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(t.getAttribute('data-yt')) + '?autoplay=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0"></iframe>';
      t.removeAttribute('data-yt'); t.style.cursor = 'default'; return;
    }
    if (t.hasAttribute('data-video')) {
      t.innerHTML = '<video controls autoplay playsinline preload="metadata" src="' + esc(url(t.getAttribute('data-video'))) + '"></video>';
      t.removeAttribute('data-video'); t.style.cursor = 'default';
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-sel')) alternarSel(t.getAttribute('data-sel'), t.checked);
    if (t.id === 'f-video') { est.video = t.checked; est.mostrados = POR_PAGINA; pintarGrilla(); }
    if (t.id === 'f-redes') { est.redes = t.checked; est.mostrados = POR_PAGINA; pintarGrilla(); }
    if (t.id === 'semana') pintarIdeas(+t.value);
    if (t.id === 'f-pdf') { est.pdf = t.checked; est.mostrados = POR_PAGINA; pintarGrilla(); }
    if (t.id === 'orden') { est.orden = t.value; est.mostrados = POR_PAGINA; pintarGrilla(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'op-ancho' || t.id === 'op-alto') { opc[t.id === 'op-ancho' ? 'ancho' : 'alto'] = t.value; guardarOpciones(); refrescarOpciones(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var v = $('.visor'); if (v) v.remove(); } });
  var tq;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(tq);
    tq = setTimeout(function () {
      est.q = e.target.value.trim(); est.mostrados = POR_PAGINA;
      if (!$('#vista-producto').hidden) { location.hash = est.marca ? '#/m/' + est.marca : '#/'; return; }
      pintarGrilla();
    }, 180);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { if (en[0].isIntersecting && !$('#ver-mas').hidden) { est.mostrados += POR_PAGINA; pintarGrilla(); } }, { rootMargin: '600px' }).observe($('#ver-mas'));
  }
  ['#contacto-cab', '#contacto-pie'].forEach(function (s) { var a = $(s); a.href = 'mailto:' + CFG.correoContacto; if (s === '#contacto-pie') a.textContent = CFG.correoContacto; });

  window.addEventListener('hashchange', ruta);
  pintarCifras();
  pintarDestacados();
  ruta();
})();
