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

const app = express();

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
  resave: false,
  saveUninitialized: false
}));

app.use(flash());

// Evita que el navegador muestre pantallas privadas desde el historial luego de cerrar sesion.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use((req, res, next) => {
  res.locals.messages = req.flash();
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

app.get('/', (req, res) => {
  res.render('index');
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
