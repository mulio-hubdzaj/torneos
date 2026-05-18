# CONTEXTO-001

Fecha de registro: 2026-05-06 14:47

Estado inicial de la revision:
- Proyecto: gestion de torneos en Express + EJS + Sequelize + PostgreSQL.
- Vista principal activa: views/torneos/index.ejs.
- La copia SQL en public es solo para referencia; no se toca la DB real.
- Regla acordada: rol_id = 99 es super admin y no requiere entity_id al login.
- Para super admin, entity_id se resuelve segun el contexto de entrada cuando haga inserciones o cambios.
- Para cualquier otro rol, entity_id es obligatorio.
- Hay flujos ya presentes para torneos, grupos, equipos, jugadores, partidos, finanzas y auditoria.
- Pendientes detectados: vistas faltantes en algunos render, desalineacion de campos en estado de partido, y placeholders activos en algunos controladores.

Proposito de este archivo:
- Guardar un contexto incremental para retomar el trabajo en una siguiente sesion.
- La siguiente version sera CONTEXTO-002.
