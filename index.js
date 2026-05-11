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
const jugadorRoutes = require('./routes/jugadorRoutes');          // ✅ coincide con jugadorRoutes.js
const jugadorEquipoRoutes = require('./routes/jugadorEquipoRoutes'); // ✅ coincide con jugadorEquipoRoutes.js
const partidoRoutes = require('./routes/partidoRoutes'); // ✅ Rutas de partidos/sorteos
const itemRoutes = require('./routes/itemRoutes');

const app = express();

// Servir archivos estáticos (CSS, imágenes, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para parsear formularios
app.use(express.urlencoded({ extended: true }));
app.use(express.json());




// Configuración de sesión
app.use(session({
  secret: 'tu_secreto_seguro',   // cámbialo por algo robusto en producción
  resave: false,
  saveUninitialized: false
}));

// Configuración de flash
app.use(flash());

// Evitar que el navegador muestre pantallas privadas desde el historial luego de cerrar sesion.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Middleware para pasar mensajes flash a todas las vistas
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

// Ruta raíz
app.get('/', (req, res) => {
  res.render('index');
});

// Rutas específicas
app.use('/', authRoutes);
app.use('/admin', requiereSesion, adminRoutes);
app.use('/entidad', requiereSesion, entidadRoutes);
app.use('/torneos', requiereSesion, torneoRoutes);
app.use('/equipos', requiereSesion);
app.use('/equipos', equipoRoutes);   // ✅ aquí ya están incluidas las nuevas funciones
app.use('/grupos', requiereSesion, grupoRoutes);
app.use('/jugadores', requiereSesion, jugadorRoutes);
app.use('/jugador-equipo', requiereSesion, jugadorEquipoRoutes);
app.use('/partidos', requiereSesion);
app.use('/partidos', partidoRoutes); // ✅ Rutas de partidos/sorteos
app.use('/items', requiereSesion, itemRoutes);

// Servidor
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
