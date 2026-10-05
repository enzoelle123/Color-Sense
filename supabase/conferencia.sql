-- ============================================================================
-- ColorSense — conferência do banco
-- ============================================================================
-- Rode no SQL Editor do Supabase DEPOIS de aplicar o schema.sql, e também
-- sempre que desconfiar do banco (projeto novo, projeto restaurado de pausa,
-- alguém mexeu no painel). Cada bloco devolve uma linha dizendo "ok" ou o que
-- está faltando: não é preciso saber SQL para ler o resultado.
-- ============================================================================

-- 1. As três tabelas existem e estão com RLS ligado?
select 'tabelas e RLS' as conferencia,
       case when count(*) filter (where rowsecurity) = 3
            then 'ok · 3 tabelas com RLS'
            else 'PROBLEMA · achei ' || count(*) || ' tabela(s), ' ||
                 count(*) filter (where rowsecurity) || ' com RLS'
       end as resultado,
       string_agg(tablename || case when rowsecurity then '' else ' (SEM RLS)' end, ', ' order by tablename) as detalhe
  from pg_tables
 where schemaname = 'public'
   and tablename in ('users','scenes','pattern_rules');

-- 2. As políticas de RLS cobrem leitura e escrita?
select 'políticas de RLS' as conferencia,
       case when count(*) >= 10 then 'ok · ' || count(*) || ' políticas'
            else 'PROBLEMA · só ' || count(*) || ' política(s); o schema.sql cria 10' end as resultado,
       string_agg(tablename || ': ' || policyname, ' | ' order by tablename, policyname) as detalhe
  from pg_policies
 where schemaname = 'public'
   and tablename in ('users','scenes','pattern_rules');

-- 3. O gatilho que cria perfil e cena no cadastro está no lugar?
select 'gatilho de cadastro' as conferencia,
       case when count(*) = 1 then 'ok · ao_criar_usuario ativo'
            else 'PROBLEMA · gatilho ausente: quem se cadastrar não vai ter perfil nem cena' end as resultado,
       coalesce(string_agg(tgname, ', '), '—') as detalhe
  from pg_trigger
 where tgrelid = 'auth.users'::regclass
   and not tgisinternal
   and tgname = 'ao_criar_usuario';

-- 4. As restrições de integridade que o app depende estão ativas?
select 'restrições' as conferencia,
       case when count(*) >= 7 then 'ok · ' || count(*) || ' restrições'
            else 'ATENÇÃO · só ' || count(*) || '; confira se o schema.sql rodou inteiro' end as resultado,
       string_agg(conname, ', ' order by conname) as detalhe
  from pg_constraint
 where connamespace = 'public'::regnamespace
   and contype = 'c'
   and conrelid::regclass::text in ('users','scenes','pattern_rules');

-- 5. Índice que garante no máximo uma cena padrão por pessoa.
select 'uma cena padrão por usuário' as conferencia,
       case when count(*) = 1 then 'ok' else 'PROBLEMA · índice ausente' end as resultado,
       coalesce(string_agg(indexname, ', '), '—') as detalhe
  from pg_indexes
 where schemaname = 'public' and indexname = 'scenes_uma_padrao_por_usuario';

-- 6. Quanta gente e quanta cena existem hoje (serve para saber se o banco é o
--    certo depois de trocar de projeto: um banco novo vem com tudo zerado).
select 'conteúdo' as conferencia,
       (select count(*) from public.users)         || ' usuário(s), ' ||
       (select count(*) from public.scenes)        || ' cena(s), '    ||
       (select count(*) from public.pattern_rules) || ' regra(s) de padrão' as resultado,
       (select coalesce(to_char(max(created_at), 'DD/MM/YYYY HH24:MI'), 'nenhum cadastro')
          from public.users) as detalhe;

-- 7. Alguém ficou sem perfil ou sem cena? (gatilho falhou em algum cadastro)
select 'cadastros incompletos' as conferencia,
       case when count(*) = 0 then 'ok · todo mundo tem perfil e ao menos uma cena'
            else 'PROBLEMA · ' || count(*) || ' conta(s) sem perfil ou sem cena' end as resultado,
       coalesce(string_agg(motivo, ', '), '—') as detalhe
  from (
    select case when u.id is null then 'sem perfil' else 'sem cena' end as motivo
      from auth.users a
      left join public.users  u on u.id = a.id
      left join public.scenes s on s.user_id = a.id
     group by a.id, u.id
    having u.id is null or count(s.id) = 0
  ) q;
