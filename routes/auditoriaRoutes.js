const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const usuario = req.session.usuario;
  if (!usuario) {
    req.flash('error', 'Debes iniciar sesión');
    return res.redirect('/login');
  }

  res.render('admin/index', { 
    messages: req.flash(), 
    usuario 
  });
});

module.exports = router;
