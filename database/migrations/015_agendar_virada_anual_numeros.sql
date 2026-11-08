-- Habilite Supabase Cron / pg_cron em Integrations > Cron, antes de executar.
-- Horario 04:00 UTC do dia 01/01 (aprox. 01:00 de Brasilia).
-- No agendamento, confira timezone do cluster/cron antes de ativar.
-- Execucao idempotente: ON CONFLICT DO NOTHING; nao sobrepoe numeros conferidos.

SELECT cron.schedule(
    'syslegiomariae-virada-anual-numeros',
    '0 4 1 1 *',
    $$
       SELECT legio.fn_iniciar_ano_numeros_unidade(
           EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER
       );
    $$
);

-- Para inspecionar job:
-- SELECT jobid, jobname, schedule, active FROM cron.job
-- WHERE jobname = 'syslegiomariae-virada-anual-numeros';
-- Para desativar:
-- SELECT cron.unschedule('syslegiomariae-virada-anual-numeros');
