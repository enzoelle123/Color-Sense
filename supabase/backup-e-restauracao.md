# Banco: backup, pausa e restauração

Em outubro de 2026 o projeto do Supabase ficou fora do ar no meio da coleta do
estudo: o endereço parou de resolver no DNS e ninguém conseguia criar conta nem
entrar no ColorSense. Este arquivo existe para que isso não volte a acontecer —
e para que, se acontecer, a volta leve minutos.

## O que acontece no plano gratuito

- Sem atividade por **7 dias**, o projeto é **pausado**. Pausado, o endereço
  `https://<ref>.supabase.co` some do DNS: o app mostra erro de conexão, igual a
  "projeto apagado". Os dois sintomas são iguais vistos de fora.
- Um projeto pausado pode ser **restaurado pelo painel** (botão *Restore* /
  *Resume project*). Projeto **apagado não volta**: não há backup recuperável no
  plano gratuito.
- Projeto em plano pago **não é pausado** por inatividade.

Documentação: <https://supabase.com/docs/guides/platform/free-project-pausing> ·
<https://supabase.com/docs/guides/troubleshooting/nxdomain-error-connecting-to-a-supabase-project>

## Se o app parar de entrar

1. Abra <https://supabase.com/dashboard> e veja o projeto.
   - Aparece **Paused** com botão de restaurar → restaure. Em alguns minutos o
     endereço volta, **com o mesmo URL e a mesma chave**: nada no app precisa
     mudar.
   - O projeto **não aparece** na lista → foi apagado. Crie um projeto novo, rode
     `schema.sql` e depois `conferencia.sql`, atualize o `.env` e gere uma versão
     nova do aplicativo (o endereço fica embutido no executável).
2. Rode `supabase/conferencia.sql` no SQL Editor. Ele diz, em português, se as
   tabelas, o RLS, o gatilho de cadastro e as restrições estão no lugar.
3. Confirme pelo próprio app: criar conta, entrar, criar uma cena.

## Como evitar

- **Keep-alive**: o repositório tem `.github/workflows/manter-banco-acordado.yml`,
  que faz uma consulta mínima 3 vezes por semana. Configure os segredos
  `SUPABASE_URL` e `SUPABASE_KEY` em *Settings > Secrets and variables > Actions*.
  Se o banco cair, a tarefa falha e o GitHub manda e-mail.
- **Durante a coleta do estudo**, considere o plano Pro (a partir de US$ 25/mês
  por organização): projeto em plano pago não é pausado. Dá para voltar ao
  gratuito depois da defesa.
- **Backup**: o plano gratuito não tem backup automático restaurável. Tire um
  você mesmo, ao menos uma vez por semana durante a coleta (veja abaixo).

## Backup manual (5 minutos)

Pelo painel: *Project Settings > Database > Connection string > URI*. Copie a
string (ela contém a senha do banco; não coloque isso no Git).

Com o `pg_dump` instalado (vem com o PostgreSQL):

```bash
# estrutura + dados das tabelas do app
pg_dump "postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -f colorsense-banco-$(date +%Y-%m-%d).sql
```

Ou, com a CLI do Supabase (`npm i -g supabase`):

```bash
supabase login
supabase link --project-ref <ref>
supabase db dump --file colorsense-banco.sql            # estrutura
supabase db dump --data-only --file colorsense-dados.sql # dados
```

Guarde o arquivo fora do Supabase (Drive, OneDrive, pendrive). Com ele, montar
um projeto novo é rodar `schema.sql` e depois o dump de dados.

## Atenção ao trocar de projeto

O endereço do Supabase vai **embutido no executável** (`.env` no momento da
compilação). Trocar de projeto significa:

1. Atualizar `.env` (`SUPABASE_URL` e `SUPABASE_KEY`).
2. Gerar e publicar uma versão nova do aplicativo.
3. **Publicar a versão nova antes de desligar o projeto antigo** — quem está na
   versão anterior precisa do app funcionando para receber a atualização
   automática.
4. Avisar que será preciso **entrar de novo**: a sessão salva é de outro projeto
   e não vale no novo (contas e cenas antigas não migram sozinhas).
