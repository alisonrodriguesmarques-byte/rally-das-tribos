-- Execute DEPOIS de 01_instalar_rally.sql, no Supabase SQL Editor.
-- Edite SOMENTE email_admin, senha_admin e nome_admin abaixo.
-- Não compartilhe ou publique sua cópia preenchida com a senha.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $admin$
DECLARE
  email_admin text := 'SEU_EMAIL_AQUI';
  senha_admin text := 'DEFINA_UMA_SENHA_FORTE';
  nome_admin text := 'Administrador';
  pessoa_id_nova integer;
  hash_senha text;
  schema_crypto text;
BEGIN
  IF to_regclass('rally.usuarios') IS NULL THEN
    RAISE EXCEPTION 'Execute primeiro 01_instalar_rally.sql.';
  END IF;
  IF email_admin = 'SEU_EMAIL_AQUI' OR email_admin !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Preencha email_admin com seu e-mail.';
  END IF;
  IF senha_admin = 'DEFINA_UMA_SENHA_FORTE' OR length(senha_admin) < 12 OR octet_length(senha_admin) > 72 THEN
    RAISE EXCEPTION 'Preencha senha_admin: de 12 caracteres a 72 bytes, respeitando o limite bcrypt.';
  END IF;
  IF EXISTS (SELECT 1 FROM rally.usuarios WHERE papel = 'admin') THEN
    RAISE EXCEPTION 'Já existe um administrador. Este SQL não troca nem apaga sua senha. Use o login existente.';
  END IF;
  SELECT n.nspname INTO schema_crypto
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';
  -- bcrypt compatível com o bcryptjs já usado pelo backend.
  EXECUTE format('SELECT %I.crypt($1, %I.gen_salt(''bf'', 10))', schema_crypto, schema_crypto)
    INTO hash_senha USING senha_admin;
  INSERT INTO rally.pessoas (nome_completo) VALUES (nome_admin) RETURNING id INTO pessoa_id_nova;
  INSERT INTO rally.usuarios (pessoa_id, email, senha_hash, papel)
    VALUES (pessoa_id_nova, lower(trim(email_admin)), hash_senha, 'admin');
END $admin$;
COMMIT;
SELECT 'Administrador criado. Use o e-mail e a senha definidos acima no site do Rally.' AS resultado;
