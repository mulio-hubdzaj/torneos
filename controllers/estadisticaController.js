const { Estadistica } = require('../models');

const estadisticaController = {
  // Obtener todas las estadísticas
  getAll: async (req, res) => {
    try {
      const estadisticas = await Estadistica.findAll();
      res.json(estadisticas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener una estadística por ID
  getById: async (req, res) => {
    try {
      const estadistica = await Estadistica.findByPk(req.params.id);
      if (estadistica) {
        res.json(estadistica);
      } else {
        res.status(404).json({ error: 'Estadística no encontrada' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = estadisticaController;
