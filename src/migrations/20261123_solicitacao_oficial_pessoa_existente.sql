-- Executar após backup, antes de subir o Backend atualizado.
-- Preserva as solicitações anteriores e permite referenciar pessoa sem membro.
BEGIN;
ALTER TABLE legio.solicitacao_oficial
    ADD COLUMN IF NOT EXISTS pessoa_id BIGINT;
-- Para solicitações antigas de membros, preencher a referência automaticamente.
UPDATE legio.solicitacao_oficial so
SET pessoa_id = m.pessoa_id
FROM legio.membro m
WHERE so.membro_id = m.id AND so.pessoa_id IS NULL;
-- Não remove nem renomeia outras colunas.
COMMIT;

-- Verificação opcional:
-- SELECT id, membro_id, pessoa_id, status FROM legio.solicitacao_oficial ORDER BY id DESC LIMIT 20;
