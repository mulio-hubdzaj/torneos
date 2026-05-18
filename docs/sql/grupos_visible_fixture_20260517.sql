ALTER TABLE grupos
ADD COLUMN IF NOT EXISTS visible_fixture boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN grupos.visible_fixture IS
'Controla si los partidos del grupo se muestran en Fixture. Si es false, el historico sigue disponible para dashboard/estadisticas.';
