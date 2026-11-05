-- OPCIONAL - executar SOMENTE depois de validar o backup.
-- Não é necessário executar no Supabase se a carga WELYAB nunca foi importada.

DELETE FROM legio.codigo_postal
WHERE fonte = 'WELYAB_CEP';

ANALYZE legio.codigo_postal;

SELECT
    COUNT(*) AS restantes,
    COUNT(*) FILTER (WHERE fonte = 'WELYAB_CEP') AS welyab_restante
FROM legio.codigo_postal;
