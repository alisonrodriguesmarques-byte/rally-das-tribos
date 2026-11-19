-- RALLY DAS TRIBOS: estrutura completa para Supabase SQL Editor.
-- Execute em um projeto novo. Não apaga nem substitui tabelas existentes.
-- Não copie o schema rally para a lista de schemas expostos na Data API.
BEGIN;
DO $$ BEGIN
 IF to_regclass('rally.pessoas') IS NOT NULL THEN
  RAISE EXCEPTION 'O Rally já foi instalado neste banco. Não execute a instalação novamente; use as migrações do aplicativo.';
 END IF;
END $$;
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.7 (Debian 18.7-1)

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET LOCAL check_function_bodies = false;
SET LOCAL xmloption = content;
SET LOCAL client_min_messages = warning;
SET LOCAL row_security = off;

--
-- Name: rally; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS rally;


SET LOCAL default_tablespace = '';

SET LOCAL default_table_access_method = heap;

--
-- Name: alternativas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.alternativas (
    id integer NOT NULL,
    questao_id integer NOT NULL,
    texto text NOT NULL,
    correta boolean DEFAULT false NOT NULL,
    posicao_correta integer,
    lado character varying(255),
    par_chave character varying(255),
    ordem integer DEFAULT 0 NOT NULL,
    CONSTRAINT alternativas_lado_check CHECK (((lado)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying])::text[])))
);


--
-- Name: alternativas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.alternativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alternativas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.alternativas_id_seq OWNED BY rally.alternativas.id;


--
-- Name: auditoria; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.auditoria (
    id integer NOT NULL,
    entidade character varying(255) NOT NULL,
    entidade_id integer NOT NULL,
    acao character varying(255) NOT NULL,
    antes_json text,
    depois_json text,
    usuario_id integer,
    em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.auditoria_id_seq OWNED BY rally.auditoria.id;


--
-- Name: categorias; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.categorias (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    cor character varying(255),
    ativa boolean DEFAULT true NOT NULL
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.categorias_id_seq OWNED BY rally.categorias.id;


--
-- Name: dinamicas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.dinamicas (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    missao_id integer,
    categoria_id integer,
    titulo character varying(255) NOT NULL,
    tema character varying(255),
    descricao text,
    data_encontro date,
    responsavel_pessoa_id integer,
    pontos_previstos integer,
    status character varying(255) DEFAULT 'pendente'::character varying NOT NULL,
    resultado text,
    evidencia_url character varying(255),
    observacao_admin text,
    lancamento_id integer,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dinamicas_status_check CHECK (((status)::text = ANY ((ARRAY['pendente'::character varying, 'enviada'::character varying, 'aprovada'::character varying, 'realizada'::character varying, 'nao_realizada'::character varying])::text[])))
);


--
-- Name: dinamicas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.dinamicas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dinamicas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.dinamicas_id_seq OWNED BY rally.dinamicas.id;


--
-- Name: encontros; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.encontros (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    data date NOT NULL,
    titulo character varying(255)
);


--
-- Name: encontros_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.encontros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encontros_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.encontros_id_seq OWNED BY rally.encontros.id;


--
-- Name: knex_migrations; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.knex_migrations_id_seq OWNED BY rally.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.knex_migrations_lock_index_seq OWNED BY rally.knex_migrations_lock.index;


--
-- Name: lancamentos; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.lancamentos (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    categoria_id integer,
    pessoa_id integer,
    pontos integer NOT NULL,
    motivo character varying(255) NOT NULL,
    origem_tipo character varying(255) NOT NULL,
    origem_id integer,
    data_referencia date NOT NULL,
    status character varying(255) DEFAULT 'ativo'::character varying NOT NULL,
    criado_por integer NOT NULL,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cancelado_por integer,
    cancelado_em timestamp with time zone,
    motivo_cancelamento character varying(255),
    CONSTRAINT lancamentos_origem_tipo_check CHECK (((origem_tipo)::text = ANY ((ARRAY['missao'::character varying, 'dinamica'::character varying, 'prova'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT lancamentos_status_check CHECK (((status)::text = ANY ((ARRAY['ativo'::character varying, 'cancelado'::character varying])::text[])))
);


--
-- Name: lancamentos_historico; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.lancamentos_historico (
    id integer NOT NULL,
    lancamento_id integer NOT NULL,
    acao character varying(255) NOT NULL,
    pontos_anteriores integer,
    pontos_novos integer,
    motivo character varying(255),
    usuario_id integer NOT NULL,
    em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT lancamentos_historico_acao_check CHECK (((acao)::text = ANY ((ARRAY['criacao'::character varying, 'edicao'::character varying, 'cancelamento'::character varying, 'reativacao'::character varying])::text[])))
);


--
-- Name: lancamentos_historico_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.lancamentos_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lancamentos_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.lancamentos_historico_id_seq OWNED BY rally.lancamentos_historico.id;


--
-- Name: lancamentos_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.lancamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lancamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.lancamentos_id_seq OWNED BY rally.lancamentos.id;


--
-- Name: membros_tribo; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.membros_tribo (
    id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    pessoa_id integer NOT NULL,
    entrou_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    saiu_em timestamp with time zone,
    motivo_saida character varying(255),
    status character varying(255) DEFAULT 'ativo'::character varying NOT NULL,
    CONSTRAINT membros_tribo_status_check CHECK (((status)::text = ANY ((ARRAY['ativo'::character varying, 'inativo'::character varying])::text[])))
);


--
-- Name: membros_tribo_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.membros_tribo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: membros_tribo_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.membros_tribo_id_seq OWNED BY rally.membros_tribo.id;


--
-- Name: missao_entregas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.missao_entregas (
    id integer NOT NULL,
    missao_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    quantidade integer,
    pontos_manual integer,
    evidencia_url character varying(255),
    observacao text,
    status character varying(255) DEFAULT 'enviada'::character varying NOT NULL,
    enviado_por integer,
    enviado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    avaliado_por integer,
    avaliado_em timestamp with time zone,
    observacao_admin text,
    lancamento_id integer,
    CONSTRAINT missao_entregas_status_check CHECK (((status)::text = ANY ((ARRAY['enviada'::character varying, 'aprovada'::character varying, 'rejeitada'::character varying])::text[])))
);


--
-- Name: missao_entregas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.missao_entregas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: missao_entregas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.missao_entregas_id_seq OWNED BY rally.missao_entregas.id;


--
-- Name: missao_tribos; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.missao_tribos (
    missao_id integer NOT NULL,
    rally_tribo_id integer NOT NULL
);


--
-- Name: missoes; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.missoes (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    categoria_id integer,
    titulo character varying(255) NOT NULL,
    descricao text,
    observacoes text,
    data_inicio date NOT NULL,
    data_limite date,
    tipo_pontuacao character varying(255) NOT NULL,
    pontos integer,
    meta_quantidade integer,
    limite_por_tribo integer,
    requer_aprovacao boolean DEFAULT true NOT NULL,
    todas_tribos boolean DEFAULT true NOT NULL,
    status character varying(255) DEFAULT 'aberta'::character varying NOT NULL,
    criado_por integer,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT missoes_status_check CHECK (((status)::text = ANY ((ARRAY['aberta'::character varying, 'encerrada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT missoes_tipo_pontuacao_check CHECK (((tipo_pontuacao)::text = ANY ((ARRAY['fixa'::character varying, 'quantidade'::character varying, 'meta'::character varying, 'manual'::character varying])::text[])))
);


--
-- Name: missoes_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.missoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: missoes_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.missoes_id_seq OWNED BY rally.missoes.id;


--
-- Name: pessoas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.pessoas (
    id integer NOT NULL,
    nome_completo character varying(255) NOT NULL,
    apelido character varying(255),
    foto_url character varying(255),
    telefone character varying(255),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: pessoas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.pessoas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pessoas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.pessoas_id_seq OWNED BY rally.pessoas.id;


--
-- Name: presencas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.presencas (
    encontro_id integer NOT NULL,
    pessoa_id integer NOT NULL,
    chegou_em timestamp with time zone
);


--
-- Name: prova_resultados; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.prova_resultados (
    id integer NOT NULL,
    prova_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    pontos integer NOT NULL,
    lancamento_id integer,
    calculado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: prova_resultados_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.prova_resultados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prova_resultados_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.prova_resultados_id_seq OWNED BY rally.prova_resultados.id;


--
-- Name: prova_tribos; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.prova_tribos (
    prova_id integer NOT NULL,
    rally_tribo_id integer NOT NULL
);


--
-- Name: provas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.provas (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    categoria_id integer,
    titulo character varying(255) NOT NULL,
    descricao text,
    modo character varying(255) DEFAULT 'tribo'::character varying NOT NULL,
    agregacao character varying(255) DEFAULT 'soma'::character varying NOT NULL,
    disponivel_de timestamp with time zone,
    disponivel_ate timestamp with time zone,
    tempo_limite_seg integer,
    max_tentativas integer,
    embaralhar boolean DEFAULT false NOT NULL,
    todas_tribos boolean DEFAULT true NOT NULL,
    status character varying(255) DEFAULT 'rascunho'::character varying NOT NULL,
    criado_por integer,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT provas_agregacao_check CHECK (((agregacao)::text = ANY ((ARRAY['soma'::character varying, 'media'::character varying, 'melhor'::character varying])::text[]))),
    CONSTRAINT provas_modo_check CHECK (((modo)::text = ANY ((ARRAY['tribo'::character varying, 'individual'::character varying])::text[]))),
    CONSTRAINT provas_status_check CHECK (((status)::text = ANY ((ARRAY['rascunho'::character varying, 'publicada'::character varying, 'encerrada'::character varying, 'cancelada'::character varying])::text[])))
);


--
-- Name: provas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.provas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.provas_id_seq OWNED BY rally.provas.id;


--
-- Name: questoes; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.questoes (
    id integer NOT NULL,
    prova_id integer NOT NULL,
    tipo character varying(255) NOT NULL,
    enunciado text NOT NULL,
    referencia_biblica character varying(255),
    imagem_url character varying(255),
    video_url character varying(255),
    pontos integer DEFAULT 100 NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    removida boolean DEFAULT false NOT NULL,
    CONSTRAINT questoes_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['multipla_escolha'::character varying, 'verdadeiro_falso'::character varying, 'complete'::character varying, 'aberta'::character varying, 'associacao'::character varying, 'ordem'::character varying])::text[])))
);


--
-- Name: questoes_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.questoes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questoes_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.questoes_id_seq OWNED BY rally.questoes.id;


--
-- Name: rallies; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.rallies (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    status character varying(255) DEFAULT 'planejado'::character varying NOT NULL,
    criado_por integer,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT rallies_status_check CHECK (((status)::text = ANY ((ARRAY['planejado'::character varying, 'ativo'::character varying, 'encerrado'::character varying])::text[])))
);


--
-- Name: rallies_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.rallies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rallies_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.rallies_id_seq OWNED BY rally.rallies.id;


--
-- Name: rally_tribos; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.rally_tribos (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    tribo_id integer NOT NULL,
    cabeca_pessoa_id integer,
    auxiliar_pessoa_id integer
);


--
-- Name: rally_tribos_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.rally_tribos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rally_tribos_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.rally_tribos_id_seq OWNED BY rally.rally_tribos.id;


--
-- Name: relatorios_almas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.relatorios_almas (
    id integer NOT NULL,
    rally_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    semana_inicio date NOT NULL,
    semana_fim date NOT NULL,
    dias_json text NOT NULL,
    novas integer NOT NULL,
    afastadas integer NOT NULL,
    status character varying(255) DEFAULT 'rascunho'::character varying NOT NULL,
    responsavel_id integer NOT NULL,
    responsavel_nome character varying(255) NOT NULL,
    enviado_em timestamp with time zone,
    avaliado_por integer,
    avaliado_em timestamp with time zone,
    observacao_admin text,
    atualizado_em timestamp with time zone NOT NULL,
    CONSTRAINT relatorios_almas_status_check CHECK (((status)::text = ANY ((ARRAY['rascunho'::character varying, 'enviado'::character varying, 'conferido'::character varying])::text[])))
);


--
-- Name: relatorios_almas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.relatorios_almas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: relatorios_almas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.relatorios_almas_id_seq OWNED BY rally.relatorios_almas.id;


--
-- Name: respostas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.respostas (
    id integer NOT NULL,
    tentativa_id integer NOT NULL,
    questao_id integer NOT NULL,
    alternativa_id integer,
    texto text,
    resposta_json text,
    correta boolean,
    pontos_obtidos integer,
    corrigida_por integer,
    corrigida_em timestamp with time zone
);


--
-- Name: respostas_aceitas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.respostas_aceitas (
    id integer NOT NULL,
    questao_id integer NOT NULL,
    texto character varying(255) NOT NULL
);


--
-- Name: respostas_aceitas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.respostas_aceitas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: respostas_aceitas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.respostas_aceitas_id_seq OWNED BY rally.respostas_aceitas.id;


--
-- Name: respostas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.respostas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: respostas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.respostas_id_seq OWNED BY rally.respostas.id;


--
-- Name: tentativas; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.tentativas (
    id integer NOT NULL,
    prova_id integer NOT NULL,
    rally_tribo_id integer NOT NULL,
    pessoa_id integer,
    usuario_id integer,
    numero integer DEFAULT 1 NOT NULL,
    iniciada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finalizada_em timestamp with time zone,
    pontos_obtidos integer,
    fora_do_tempo boolean DEFAULT false NOT NULL,
    status character varying(255) DEFAULT 'em_andamento'::character varying NOT NULL,
    CONSTRAINT tentativas_status_check CHECK (((status)::text = ANY ((ARRAY['em_andamento'::character varying, 'aguardando_correcao'::character varying, 'corrigida'::character varying, 'anulada'::character varying])::text[])))
);


--
-- Name: tentativas_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.tentativas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tentativas_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.tentativas_id_seq OWNED BY rally.tentativas.id;


--
-- Name: tribos; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.tribos (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    cor character varying(255),
    ordem integer NOT NULL
);


--
-- Name: tribos_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.tribos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tribos_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.tribos_id_seq OWNED BY rally.tribos.id;


--
-- Name: usuarios; Type: TABLE; Schema: rally; Owner: -
--

CREATE TABLE rally.usuarios (
    id integer NOT NULL,
    pessoa_id integer,
    email character varying(255) NOT NULL,
    senha_hash character varying(255) NOT NULL,
    papel character varying(255) DEFAULT 'membro'::character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ultimo_login timestamp with time zone,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT usuarios_papel_check CHECK (((papel)::text = ANY ((ARRAY['admin'::character varying, 'membro'::character varying])::text[])))
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: rally; Owner: -
--

CREATE SEQUENCE rally.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: rally; Owner: -
--

ALTER SEQUENCE rally.usuarios_id_seq OWNED BY rally.usuarios.id;


--
-- Name: alternativas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.alternativas ALTER COLUMN id SET DEFAULT nextval('rally.alternativas_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.auditoria ALTER COLUMN id SET DEFAULT nextval('rally.auditoria_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.categorias ALTER COLUMN id SET DEFAULT nextval('rally.categorias_id_seq'::regclass);


--
-- Name: dinamicas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas ALTER COLUMN id SET DEFAULT nextval('rally.dinamicas_id_seq'::regclass);


--
-- Name: encontros id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.encontros ALTER COLUMN id SET DEFAULT nextval('rally.encontros_id_seq'::regclass);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.knex_migrations ALTER COLUMN id SET DEFAULT nextval('rally.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('rally.knex_migrations_lock_index_seq'::regclass);


--
-- Name: lancamentos id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos ALTER COLUMN id SET DEFAULT nextval('rally.lancamentos_id_seq'::regclass);


--
-- Name: lancamentos_historico id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos_historico ALTER COLUMN id SET DEFAULT nextval('rally.lancamentos_historico_id_seq'::regclass);


--
-- Name: membros_tribo id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.membros_tribo ALTER COLUMN id SET DEFAULT nextval('rally.membros_tribo_id_seq'::regclass);


--
-- Name: missao_entregas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas ALTER COLUMN id SET DEFAULT nextval('rally.missao_entregas_id_seq'::regclass);


--
-- Name: missoes id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missoes ALTER COLUMN id SET DEFAULT nextval('rally.missoes_id_seq'::regclass);


--
-- Name: pessoas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.pessoas ALTER COLUMN id SET DEFAULT nextval('rally.pessoas_id_seq'::regclass);


--
-- Name: prova_resultados id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados ALTER COLUMN id SET DEFAULT nextval('rally.prova_resultados_id_seq'::regclass);


--
-- Name: provas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.provas ALTER COLUMN id SET DEFAULT nextval('rally.provas_id_seq'::regclass);


--
-- Name: questoes id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.questoes ALTER COLUMN id SET DEFAULT nextval('rally.questoes_id_seq'::regclass);


--
-- Name: rallies id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rallies ALTER COLUMN id SET DEFAULT nextval('rally.rallies_id_seq'::regclass);


--
-- Name: rally_tribos id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos ALTER COLUMN id SET DEFAULT nextval('rally.rally_tribos_id_seq'::regclass);


--
-- Name: relatorios_almas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas ALTER COLUMN id SET DEFAULT nextval('rally.relatorios_almas_id_seq'::regclass);


--
-- Name: respostas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas ALTER COLUMN id SET DEFAULT nextval('rally.respostas_id_seq'::regclass);


--
-- Name: respostas_aceitas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas_aceitas ALTER COLUMN id SET DEFAULT nextval('rally.respostas_aceitas_id_seq'::regclass);


--
-- Name: tentativas id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas ALTER COLUMN id SET DEFAULT nextval('rally.tentativas_id_seq'::regclass);


--
-- Name: tribos id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tribos ALTER COLUMN id SET DEFAULT nextval('rally.tribos_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.usuarios ALTER COLUMN id SET DEFAULT nextval('rally.usuarios_id_seq'::regclass);


--
-- Name: alternativas alternativas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.alternativas
    ADD CONSTRAINT alternativas_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_nome_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.categorias
    ADD CONSTRAINT categorias_nome_unique UNIQUE (nome);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: dinamicas dinamicas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_pkey PRIMARY KEY (id);


--
-- Name: encontros encontros_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.encontros
    ADD CONSTRAINT encontros_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: lancamentos_historico lancamentos_historico_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos_historico
    ADD CONSTRAINT lancamentos_historico_pkey PRIMARY KEY (id);


--
-- Name: lancamentos lancamentos_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_pkey PRIMARY KEY (id);


--
-- Name: membros_tribo membros_tribo_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.membros_tribo
    ADD CONSTRAINT membros_tribo_pkey PRIMARY KEY (id);


--
-- Name: missao_entregas missao_entregas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_pkey PRIMARY KEY (id);


--
-- Name: missao_tribos missao_tribos_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_tribos
    ADD CONSTRAINT missao_tribos_pkey PRIMARY KEY (missao_id, rally_tribo_id);


--
-- Name: missoes missoes_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missoes
    ADD CONSTRAINT missoes_pkey PRIMARY KEY (id);


--
-- Name: pessoas pessoas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.pessoas
    ADD CONSTRAINT pessoas_pkey PRIMARY KEY (id);


--
-- Name: presencas presencas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.presencas
    ADD CONSTRAINT presencas_pkey PRIMARY KEY (encontro_id, pessoa_id);


--
-- Name: prova_resultados prova_resultados_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados
    ADD CONSTRAINT prova_resultados_pkey PRIMARY KEY (id);


--
-- Name: prova_resultados prova_resultados_prova_id_rally_tribo_id_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados
    ADD CONSTRAINT prova_resultados_prova_id_rally_tribo_id_unique UNIQUE (prova_id, rally_tribo_id);


--
-- Name: prova_tribos prova_tribos_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_tribos
    ADD CONSTRAINT prova_tribos_pkey PRIMARY KEY (prova_id, rally_tribo_id);


--
-- Name: provas provas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.provas
    ADD CONSTRAINT provas_pkey PRIMARY KEY (id);


--
-- Name: questoes questoes_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.questoes
    ADD CONSTRAINT questoes_pkey PRIMARY KEY (id);


--
-- Name: rallies rallies_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rallies
    ADD CONSTRAINT rallies_pkey PRIMARY KEY (id);


--
-- Name: rally_tribos rally_tribos_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_pkey PRIMARY KEY (id);


--
-- Name: rally_tribos rally_tribos_rally_id_tribo_id_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_rally_id_tribo_id_unique UNIQUE (rally_id, tribo_id);


--
-- Name: relatorios_almas relatorios_almas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_pkey PRIMARY KEY (id);


--
-- Name: relatorios_almas relatorios_almas_rally_tribo_id_semana_inicio_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_rally_tribo_id_semana_inicio_unique UNIQUE (rally_tribo_id, semana_inicio);


--
-- Name: respostas_aceitas respostas_aceitas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas_aceitas
    ADD CONSTRAINT respostas_aceitas_pkey PRIMARY KEY (id);


--
-- Name: respostas respostas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_pkey PRIMARY KEY (id);


--
-- Name: respostas respostas_tentativa_id_questao_id_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_tentativa_id_questao_id_unique UNIQUE (tentativa_id, questao_id);


--
-- Name: tentativas tentativas_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas
    ADD CONSTRAINT tentativas_pkey PRIMARY KEY (id);


--
-- Name: tribos tribos_nome_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tribos
    ADD CONSTRAINT tribos_nome_unique UNIQUE (nome);


--
-- Name: tribos tribos_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tribos
    ADD CONSTRAINT tribos_pkey PRIMARY KEY (id);


--
-- Name: tribos tribos_slug_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tribos
    ADD CONSTRAINT tribos_slug_unique UNIQUE (slug);


--
-- Name: usuarios usuarios_email_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.usuarios
    ADD CONSTRAINT usuarios_email_unique UNIQUE (email);


--
-- Name: usuarios usuarios_pessoa_id_unique; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.usuarios
    ADD CONSTRAINT usuarios_pessoa_id_unique UNIQUE (pessoa_id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: auditoria_entidade_entidade_id_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX auditoria_entidade_entidade_id_index ON rally.auditoria USING btree (entidade, entidade_id);


--
-- Name: lancamentos_origem_tipo_origem_id_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX lancamentos_origem_tipo_origem_id_index ON rally.lancamentos USING btree (origem_tipo, origem_id);


--
-- Name: lancamentos_rally_id_data_referencia_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX lancamentos_rally_id_data_referencia_index ON rally.lancamentos USING btree (rally_id, data_referencia);


--
-- Name: lancamentos_rally_id_status_rally_tribo_id_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX lancamentos_rally_id_status_rally_tribo_id_index ON rally.lancamentos USING btree (rally_id, status, rally_tribo_id);


--
-- Name: membros_tribo_pessoa_id_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX membros_tribo_pessoa_id_index ON rally.membros_tribo USING btree (pessoa_id);


--
-- Name: membros_tribo_rally_tribo_id_status_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX membros_tribo_rally_tribo_id_status_index ON rally.membros_tribo USING btree (rally_tribo_id, status);


--
-- Name: missoes_rally_id_data_inicio_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX missoes_rally_id_data_inicio_index ON rally.missoes USING btree (rally_id, data_inicio);


--
-- Name: pessoas_nome_completo_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX pessoas_nome_completo_index ON rally.pessoas USING btree (nome_completo);


--
-- Name: questoes_prova_id_ordem_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX questoes_prova_id_ordem_index ON rally.questoes USING btree (prova_id, ordem);


--
-- Name: relatorios_almas_rally_id_semana_inicio_status_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX relatorios_almas_rally_id_semana_inicio_status_index ON rally.relatorios_almas USING btree (rally_id, semana_inicio, status);


--
-- Name: tentativas_prova_id_rally_tribo_id_index; Type: INDEX; Schema: rally; Owner: -
--

CREATE INDEX tentativas_prova_id_rally_tribo_id_index ON rally.tentativas USING btree (prova_id, rally_tribo_id);


--
-- Name: alternativas alternativas_questao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.alternativas
    ADD CONSTRAINT alternativas_questao_id_foreign FOREIGN KEY (questao_id) REFERENCES rally.questoes(id);


--
-- Name: auditoria auditoria_usuario_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.auditoria
    ADD CONSTRAINT auditoria_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES rally.usuarios(id);


--
-- Name: dinamicas dinamicas_categoria_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_categoria_id_foreign FOREIGN KEY (categoria_id) REFERENCES rally.categorias(id);


--
-- Name: dinamicas dinamicas_lancamento_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_lancamento_id_foreign FOREIGN KEY (lancamento_id) REFERENCES rally.lancamentos(id);


--
-- Name: dinamicas dinamicas_missao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_missao_id_foreign FOREIGN KEY (missao_id) REFERENCES rally.missoes(id);


--
-- Name: dinamicas dinamicas_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: dinamicas dinamicas_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: dinamicas dinamicas_responsavel_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.dinamicas
    ADD CONSTRAINT dinamicas_responsavel_pessoa_id_foreign FOREIGN KEY (responsavel_pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: encontros encontros_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.encontros
    ADD CONSTRAINT encontros_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: lancamentos lancamentos_cancelado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_cancelado_por_foreign FOREIGN KEY (cancelado_por) REFERENCES rally.usuarios(id);


--
-- Name: lancamentos lancamentos_categoria_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_categoria_id_foreign FOREIGN KEY (categoria_id) REFERENCES rally.categorias(id);


--
-- Name: lancamentos lancamentos_criado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_criado_por_foreign FOREIGN KEY (criado_por) REFERENCES rally.usuarios(id);


--
-- Name: lancamentos_historico lancamentos_historico_lancamento_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos_historico
    ADD CONSTRAINT lancamentos_historico_lancamento_id_foreign FOREIGN KEY (lancamento_id) REFERENCES rally.lancamentos(id);


--
-- Name: lancamentos_historico lancamentos_historico_usuario_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos_historico
    ADD CONSTRAINT lancamentos_historico_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES rally.usuarios(id);


--
-- Name: lancamentos lancamentos_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_pessoa_id_foreign FOREIGN KEY (pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: lancamentos lancamentos_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: lancamentos lancamentos_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.lancamentos
    ADD CONSTRAINT lancamentos_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: membros_tribo membros_tribo_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.membros_tribo
    ADD CONSTRAINT membros_tribo_pessoa_id_foreign FOREIGN KEY (pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: membros_tribo membros_tribo_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.membros_tribo
    ADD CONSTRAINT membros_tribo_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: missao_entregas missao_entregas_avaliado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_avaliado_por_foreign FOREIGN KEY (avaliado_por) REFERENCES rally.usuarios(id);


--
-- Name: missao_entregas missao_entregas_enviado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_enviado_por_foreign FOREIGN KEY (enviado_por) REFERENCES rally.usuarios(id);


--
-- Name: missao_entregas missao_entregas_lancamento_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_lancamento_id_foreign FOREIGN KEY (lancamento_id) REFERENCES rally.lancamentos(id);


--
-- Name: missao_entregas missao_entregas_missao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_missao_id_foreign FOREIGN KEY (missao_id) REFERENCES rally.missoes(id);


--
-- Name: missao_entregas missao_entregas_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_entregas
    ADD CONSTRAINT missao_entregas_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: missao_tribos missao_tribos_missao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_tribos
    ADD CONSTRAINT missao_tribos_missao_id_foreign FOREIGN KEY (missao_id) REFERENCES rally.missoes(id);


--
-- Name: missao_tribos missao_tribos_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missao_tribos
    ADD CONSTRAINT missao_tribos_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: missoes missoes_categoria_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missoes
    ADD CONSTRAINT missoes_categoria_id_foreign FOREIGN KEY (categoria_id) REFERENCES rally.categorias(id);


--
-- Name: missoes missoes_criado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missoes
    ADD CONSTRAINT missoes_criado_por_foreign FOREIGN KEY (criado_por) REFERENCES rally.usuarios(id);


--
-- Name: missoes missoes_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.missoes
    ADD CONSTRAINT missoes_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: presencas presencas_encontro_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.presencas
    ADD CONSTRAINT presencas_encontro_id_foreign FOREIGN KEY (encontro_id) REFERENCES rally.encontros(id);


--
-- Name: presencas presencas_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.presencas
    ADD CONSTRAINT presencas_pessoa_id_foreign FOREIGN KEY (pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: prova_resultados prova_resultados_lancamento_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados
    ADD CONSTRAINT prova_resultados_lancamento_id_foreign FOREIGN KEY (lancamento_id) REFERENCES rally.lancamentos(id);


--
-- Name: prova_resultados prova_resultados_prova_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados
    ADD CONSTRAINT prova_resultados_prova_id_foreign FOREIGN KEY (prova_id) REFERENCES rally.provas(id);


--
-- Name: prova_resultados prova_resultados_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_resultados
    ADD CONSTRAINT prova_resultados_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: prova_tribos prova_tribos_prova_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_tribos
    ADD CONSTRAINT prova_tribos_prova_id_foreign FOREIGN KEY (prova_id) REFERENCES rally.provas(id);


--
-- Name: prova_tribos prova_tribos_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.prova_tribos
    ADD CONSTRAINT prova_tribos_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: provas provas_categoria_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.provas
    ADD CONSTRAINT provas_categoria_id_foreign FOREIGN KEY (categoria_id) REFERENCES rally.categorias(id);


--
-- Name: provas provas_criado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.provas
    ADD CONSTRAINT provas_criado_por_foreign FOREIGN KEY (criado_por) REFERENCES rally.usuarios(id);


--
-- Name: provas provas_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.provas
    ADD CONSTRAINT provas_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: questoes questoes_prova_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.questoes
    ADD CONSTRAINT questoes_prova_id_foreign FOREIGN KEY (prova_id) REFERENCES rally.provas(id);


--
-- Name: rallies rallies_criado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rallies
    ADD CONSTRAINT rallies_criado_por_foreign FOREIGN KEY (criado_por) REFERENCES rally.usuarios(id);


--
-- Name: rally_tribos rally_tribos_auxiliar_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_auxiliar_pessoa_id_foreign FOREIGN KEY (auxiliar_pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: rally_tribos rally_tribos_cabeca_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_cabeca_pessoa_id_foreign FOREIGN KEY (cabeca_pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: rally_tribos rally_tribos_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: rally_tribos rally_tribos_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.rally_tribos
    ADD CONSTRAINT rally_tribos_tribo_id_foreign FOREIGN KEY (tribo_id) REFERENCES rally.tribos(id);


--
-- Name: relatorios_almas relatorios_almas_avaliado_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_avaliado_por_foreign FOREIGN KEY (avaliado_por) REFERENCES rally.usuarios(id);


--
-- Name: relatorios_almas relatorios_almas_rally_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_rally_id_foreign FOREIGN KEY (rally_id) REFERENCES rally.rallies(id);


--
-- Name: relatorios_almas relatorios_almas_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: relatorios_almas relatorios_almas_responsavel_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.relatorios_almas
    ADD CONSTRAINT relatorios_almas_responsavel_id_foreign FOREIGN KEY (responsavel_id) REFERENCES rally.usuarios(id);


--
-- Name: respostas_aceitas respostas_aceitas_questao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas_aceitas
    ADD CONSTRAINT respostas_aceitas_questao_id_foreign FOREIGN KEY (questao_id) REFERENCES rally.questoes(id);


--
-- Name: respostas respostas_alternativa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_alternativa_id_foreign FOREIGN KEY (alternativa_id) REFERENCES rally.alternativas(id);


--
-- Name: respostas respostas_corrigida_por_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_corrigida_por_foreign FOREIGN KEY (corrigida_por) REFERENCES rally.usuarios(id);


--
-- Name: respostas respostas_questao_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_questao_id_foreign FOREIGN KEY (questao_id) REFERENCES rally.questoes(id);


--
-- Name: respostas respostas_tentativa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.respostas
    ADD CONSTRAINT respostas_tentativa_id_foreign FOREIGN KEY (tentativa_id) REFERENCES rally.tentativas(id);


--
-- Name: tentativas tentativas_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas
    ADD CONSTRAINT tentativas_pessoa_id_foreign FOREIGN KEY (pessoa_id) REFERENCES rally.pessoas(id);


--
-- Name: tentativas tentativas_prova_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas
    ADD CONSTRAINT tentativas_prova_id_foreign FOREIGN KEY (prova_id) REFERENCES rally.provas(id);


--
-- Name: tentativas tentativas_rally_tribo_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas
    ADD CONSTRAINT tentativas_rally_tribo_id_foreign FOREIGN KEY (rally_tribo_id) REFERENCES rally.rally_tribos(id);


--
-- Name: tentativas tentativas_usuario_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.tentativas
    ADD CONSTRAINT tentativas_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES rally.usuarios(id);


--
-- Name: usuarios usuarios_pessoa_id_foreign; Type: FK CONSTRAINT; Schema: rally; Owner: -
--

ALTER TABLE ONLY rally.usuarios
    ADD CONSTRAINT usuarios_pessoa_id_foreign FOREIGN KEY (pessoa_id) REFERENCES rally.pessoas(id);


--
-- PostgreSQL database dump complete
--



INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (1, 'Rúben', 'ruben', '#c0392b', 1);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (2, 'Simeão', 'simeao', '#16a085', 2);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (3, 'Levi', 'levi', '#7f8c8d', 3);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (4, 'Judá', 'juda', '#d4a017', 4);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (5, 'Dã', 'da', '#2c3e50', 5);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (6, 'Naftali', 'naftali', '#27ae60', 6);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (7, 'Gade', 'gade', '#8e44ad', 7);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (8, 'Aser', 'aser', '#e67e22', 8);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (9, 'Issacar', 'issacar', '#2980b9', 9);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (10, 'Zebulom', 'zebulom', '#1abc9c', 10);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (11, 'Manassés', 'manasses', '#9b59b6', 11);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (12, 'Efraim', 'efraim', '#6366f1', 12);
INSERT INTO rally.tribos ("id", "nome", "slug", "cor", "ordem") VALUES (13, 'Benjamim', 'benjamim', '#e74c3c', 13);
SELECT pg_catalog.setval(pg_get_serial_sequence('rally.tribos', 'id'), 13, true);

INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (1, 'Quiz', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (2, 'Complete o versículo', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (3, 'Verdadeiro ou falso', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (4, 'Dinâmica', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (5, 'Evangelização', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (6, 'Presença', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (7, 'Convidados', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (8, 'Organização', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (9, 'Missões especiais', NULL, TRUE);
INSERT INTO rally.categorias ("id", "nome", "cor", "ativa") VALUES (10, 'Outros', NULL, TRUE);
SELECT pg_catalog.setval(pg_get_serial_sequence('rally.categorias', 'id'), 10, true);

INSERT INTO rally.knex_migrations ("id", "name", "batch", "migration_time") VALUES (1, '001_esquema_inicial.js', 1, '2026-11-19T13:44:13.692Z');
INSERT INTO rally.knex_migrations ("id", "name", "batch", "migration_time") VALUES (2, '002_tribos_relatorios_almas.js', 1, '2026-11-19T13:44:13.704Z');
SELECT pg_catalog.setval(pg_get_serial_sequence('rally.knex_migrations', 'id'), 2, true);

INSERT INTO rally.knex_migrations_lock ("index", "is_locked") VALUES (1, 0);
SELECT pg_catalog.setval(pg_get_serial_sequence('rally.knex_migrations_lock', 'index'), 1, true);

-- Somente o backend (conexão PostgreSQL) deve acessar este schema.
REVOKE ALL ON SCHEMA rally FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA rally FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA rally FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA rally FROM %I', role_name);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA rally FROM %I', role_name);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA rally FROM %I', role_name);
 END LOOP;
END $$;
COMMIT;
-- O administrador é criado com o segundo arquivo SQL ou no primeiro início do app.
SELECT 'Instalação concluída' AS resultado, (SELECT count(*) FROM rally.tribos) AS tribos;
