const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const entidadRoutes = require('./routes/entidadRoutes');
const torneoRoutes = require('./routes/torneoRoutes');
const equipoRoutes = require('./routes/equipoRoutes');
const grupoRoutes = require('./routes/grupoRoutes');
const jugadorRoutes = require('./routes/jugadorRoutes');
const jugadorEquipoRoutes = require('./routes/jugadorEquipoRoutes');
const partidoRoutes = require('./routes/partidoRoutes');
const itemRoutes = require('./routes/itemRoutes');
const { Entity } = require('./models');

const app = express();
const DEFAULT_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const sessionMaxAgeMsEnv = Number(process.env.SESSION_MAX_AGE_MS);
const sessionMaxAgeMs = Number.isFinite(sessionMaxAgeMsEnv) && sessionMaxAgeMsEnv > 0
  ? sessionMaxAgeMsEnv
  : DEFAULT_SESSION_MAX_AGE_MS;
const DEFAULT_ABANDON_TIMEOUT_MS = 1000 * 60 * 5;
const abandonTimeoutMsEnv = Number(process.env.ABANDON_TIMEOUT_MS);
const abandonTimeoutMs = Number.isFinite(abandonTimeoutMsEnv) && abandonTimeoutMsEnv > 0
  ? abandonTimeoutMsEnv
  : DEFAULT_ABANDON_TIMEOUT_MS;

app.use((req, res, next) => {
  const requestedPath = decodeURIComponent(req.path || '').toLowerCase();
  const sensitivePublicFile =
    requestedPath.endsWith('.sql') ||
    requestedPath.endsWith('.doc') ||
    /\/contexto_\d+\.md$/.test(requestedPath) ||
    requestedPath.includes('auditoria_detalle');

  if (sensitivePublicFile) {
    return res.status(404).send('Not found');
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: sessionMaxAgeMs
  }
}));

app.use(flash());

app.use((req, res, next) => {
  const ahora = Date.now();
  const rutaPublica =
    req.path === '/' ||
    req.path === '/login' ||
    req.path === '/registro' ||
    req.path.startsWith('/publico') ||
    req.path.startsWith('/css') ||
    req.path.startsWith('/js') ||
    req.path.startsWith('/images') ||
    req.path.startsWith('/uploads') ||
    req.path === '/session/heartbeat';

  if (req.session?.usuario_id || req.session?.vista_publica_activa) {
    const ultimoHeartbeat = Number(req.session.ultimo_heartbeat || ahora);
    if (ahora - ultimoHeartbeat >= abandonTimeoutMs && req.path !== '/logout') {
      return req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return res.redirect('/');
      });
    }

    if (!rutaPublica) {
      req.session.ultimo_heartbeat = ahora;
    }
  }

  next();
});

// Evita que el navegador muestre pantallas privadas desde el historial luego de cerrar sesion.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.abandonTimeoutMs = abandonTimeoutMs;
  next();
});

function requiereSesion(req, res, next) {
  if (!req.session.usuario_id) {
    return res.redirect('/login');
  }
  if (req.session.debe_cambiar_contrasena) {
    return res.redirect('/cambiar-contrasena');
  }
  next();
}

app.get('/', async (req, res) => {
  try {
    const comunidades = await Entity.findAll({
      where: { activo: true },
      order: [['codigo', 'ASC']]
    });

    res.render('index', {
      comunidades: comunidades.map(comunidad => comunidad.get({ plain: true }))
    });
  } catch (error) {
    console.error('Error al cargar comunidades en inicio:', error);
    res.render('index', { comunidades: [] });
  }
});

app.get('/session/heartbeat', (req, res) => {
  if (req.session) {
    req.session.ultimo_heartbeat = Date.now();
  }
  res.status(204).end();
});

app.use('/', authRoutes);
app.use('/admin', requiereSesion, adminRoutes);
app.use('/entidad', requiereSesion, entidadRoutes);
app.use('/torneos', requiereSesion, torneoRoutes);
app.use('/equipos', requiereSesion);
app.use('/equipos', equipoRoutes);
app.use('/grupos', requiereSesion, grupoRoutes);
app.use('/jugadores', requiereSesion, jugadorRoutes);
app.use('/jugador-equipo', requiereSesion, jugadorEquipoRoutes);
app.use('/partidos', requiereSesion);
app.use('/partidos', partidoRoutes);
app.use('/items', requiereSesion, itemRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
