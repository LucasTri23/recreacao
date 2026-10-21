# Recreação

Organização de times sem placar ou ranking, com oito times iniciais e catálogo gerenciável pela administração. Hospedagem no GitHub Pages e login Google + banco Cloud Firestore no plano gratuito Spark. Não usa Cloud Functions, cartão ou plano Blaze. O uso está sujeito às cotas gratuitas do Firebase; ao esgotá-las, o serviço pode ficar indisponível até a renovação da cota.

## Rodar localmente

Execute `npm start` e abra http://localhost:3000. O projeto já contém a configuração pública do Firebase recreacao-17154. Ative Google em Authentication e crie o Firestore em modo de produção. Em Authentication → Settings → Authorized domains, adicione `localhost` para testes locais e o domínio `SEU-USUARIO.github.io` para produção (sem caminho de repositório).

Com `firebaseConfig = null` em `public/firebase-config.js`, o site funciona apenas como demonstração local. Nesse modo, não há autenticação nem dados compartilhados.

## Publicar as regras do banco

Execute uma vez `npm install`, depois `npm run firebase:login` e `npm run deploy:rules`. O comando publica apenas as regras do Firestore. Não ativa funções ou serviços pagos. Também é possível copiar `firestore.rules` para a aba Rules do console Firestore e publicar por lá.

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub (necessário para Pages com conta GitHub Free).
2. Envie os arquivos deste projeto para a branch `main`, incluindo `.github/workflows`.
3. Em Settings → Pages → Build and deployment, selecione GitHub Actions.
4. Execute o workflow Publicar no GitHub Pages, ou faça um push na branch main.
5. Adicione o domínio do endereço publicado aos domínios autorizados no Firebase Authentication.

O workflow executa `npm run build` e publica a pasta `dist`. Os arquivos JavaScript e CSS recebem nomes por versão para impedir que o cache misture módulos de publicações diferentes. As regras do Firestore são publicadas separadamente pelo comando acima. Não salve dados de jogadores ou credenciais privadas no GitHub.

## Liberar contas

Cada diretor entra com Google uma vez; o site cria uma solicitação pendente com nome e e-mail da conta. O administrador abre **Gerenciar acessos**, escolhe o time e clica em Salvar. Pode trocar o time ou selecionar Sem acesso para suspender o vínculo. A mudança aparece automaticamente na sessão do diretor.

Apenas o primeiro administrador precisa ser provisionado no console: entre no site, copie seu UID em Firebase Authentication → Users e altere `users/UID` no Firestore para `role: "admin"`. A interface não permite criar administradores, alterar a própria permissão ou remover o acesso de outro administrador. As regras restringem todos os vínculos a contas administradoras.

## Regras e integridade

Cada jogador é identificado por um hash de nome completo + congregação. Cliente e regras normalizam caixa, espaços e acentos usuais do português. As regras verificam o hash para impedir documentos duplicados com o mesmo nome/congregação. Grafias diferentes ainda exigem revisão humana; homônimos na mesma congregação precisam de tratamento administrativo antes do cadastro.

Diretores leem a relação geral e inscrevem apenas no próprio time. Cada jogador tem um ou dois times distintos. Durante a janela aberta, o diretor do time de origem pode transferir para outro time, preservando a segunda inscrição. Só administradores alteram a janela e os vínculos de acesso. A administração pode corrigir nome e congregação; cada alteração preserva o histórico e impede sobrescrever outra identidade existente.

Toda alteração de jogador usa transação e exige um registro de histórico na mesma operação. As regras verificam permissões, janela, identidade e limite mesmo em acessos diretos ao banco. Nenhum dado pessoal é servido sem autenticação autorizada.

## Verificação

`npm test` verifica identidade, limite de times e transferência. Antes de liberar aos diretores, confira com contas reais: cadastro no próprio time, bloqueio de outro time, segunda e terceira inscrições, cadastro simultâneo e transferência com janela fechada/aberta. Checagem de compilação das regras não substitui esses testes de acesso.

## Aparência e login

O botão Claro/Escuro acompanha o tema do sistema até você escolher uma preferência; a escolha fica salva neste navegador. A logo vetorial está em `public/logo.svg`. Em telas pequenas, jogadores aparecem em cartões com os times e ações.

Se o login mostrar erro de permissão, publique as regras atuais: `npm.cmd install`, `npm.cmd run firebase:login` e `npm.cmd run deploy:rules`. Contas existentes continuam entrando se somente a atualização opcional de nome/e-mail for bloqueada por regras antigas. O primeiro acesso ainda depende das regras corretas para criar o pedido pendente.

## Evitar cadastros duplicados

Ao digitar pelo menos três letras do nome em **Adicionar jogador**, aparecem nomes parecidos com congregação e times atuais. Escolha **É a mesma pessoa · usar cadastro** para aproveitar a inscrição existente. Se for outra pessoa, confira as sugestões e marque a confirmação antes de salvar. Os alertas ajudam na revisão; nomes parecidos não comprovam que seja a mesma pessoa.

Administradores têm a página **Duplicidades** no menu. Abra um par, confira as duas identidades e escolha qual cadastro manter. A confirmação unifica os times em uma transação e registra a operação no histórico. Se a união superar dois times, regularize as inscrições antes: a unificação não descarta times automaticamente.

O cadastro antigo fica arquivado, com referência ao mantido. Não conta mais como jogador ativo; inscrições futuras com a identidade antiga são redirecionadas ao cadastro mantido, respeitando o limite de dois times. O histórico anterior permanece preservado. Apenas administradores podem unificar; as regras verificam os dois cadastros e o histórico na mesma operação. Publique `firestore.rules` junto desta atualização.

## Navegação

O menu separa Nossos times, Jogadores, Movimentações e Duplicidades em telas com endereços próprios: #/times, #/jogadores, #/movimentacoes e #/duplicidades. Os endereços funcionam no GitHub Pages e permitem voltar/avançar pelo navegador. Clicar em um time abre a página de jogadores com esse time selecionado. Movimentações carrega inicialmente 100 registros, atualiza automaticamente e permite carregar mais. Duplicidades continua restrita à administração; a confirmação de unificação permanece em diálogo.

## Gerenciar jogadores

Na página Jogadores, administradores podem editar nome e congregação, inativar, ativar e excluir cadastros. Os filtros Ativos, Inativos, Excluídos e Todas as situações ajudam a localizar cada jogador. Os totais dos times incluem apenas jogadores ativos.

Inativar preserva os times e bloqueia novas inscrições e transferências. Excluir retira o jogador da relação principal de forma recuperável: os dados e o histórico permanecem no banco, e Restaurar devolve o jogador à situação ativa. Essas ações exigem confirmação na interface e ficam registradas em Movimentações.

Editar preserva times e situação. Se a identidade mudar, o cadastro antigo passa a apontar para o corrigido, para impedir uma nova inscrição separada pelo nome antigo. Identidades já existentes exigem revisão de duplicidades. Diretores não podem executar essas ações administrativas. Publique as regras atualizadas antes de usar.

## Gerenciar times

A página Gerenciar times (#/gerenciar-times) é exclusiva da administração. Permite criar times, editar nome, cor e emblema, inativar, ativar, excluir e restaurar. Os filtros mostram times ativos, inativos, excluídos ou todos. O nome deve ser único, incluindo times inativos e excluídos.

O catálogo fica em settings/teams. Na ausência desse documento, cliente e regras usam os oito times iniciais; a primeira alteração administrativa salva o catálogo completo. Os identificadores dos times atuais são preservados. Novos times recebem identificadores estáveis; renomear altera apenas a apresentação, mantendo jogadores e diretores vinculados.

Inativar ou excluir é recuperável, retira o time da página principal e bloqueia inscrições, transferências de entrada e novos vínculos de diretores. Os jogadores e diretores existentes são preservados, assim como o histórico. Transferências de saída continuam permitidas durante a janela. O limite de dois times por jogador inclui os vínculos preservados com times inativos/excluídos. Toda alteração do catálogo usa transação com histórico e exige perfil de administrador nas regras do banco.

## Exportar e imprimir relações

Em Nossos times ou Jogadores, use **Exportar / imprimir**. Escolha todos os times ativos ou um time específico. A relação contém apenas jogadores ativos, em ordem alfabética, com congregação, todos os times do jogador, campo de conferência e data de geração em horário de Brasília. Times sem jogadores aparecem como vazios; times inativos/excluídos podem ser selecionados individualmente para conferência.

**Baixar CSV** gera um arquivo com acentos e separador ponto e vírgula. **Baixar relação offline** gera um HTML independente, que pode ser aberto sem internet e tem botão de impressão. **Imprimir / salvar PDF** abre a impressão do navegador em A4 paisagem, com cada time começando em uma nova página. O relatório é uma cópia do momento da geração; não recebe atualizações depois de baixado. A exportação só fica habilitada após carregar os times e jogadores de uma sessão autorizada.

## Concluir revisões de duplicidade

Na página Duplicidades, o admin pode escolher **São pessoas diferentes**, conferir as duas identidades e confirmar. A decisão é compartilhada entre administradores, sai das pendências e fica no filtro **Pessoas diferentes · concluídas**, com opção de **Reabrir revisão**. Cada decisão fica registrada em Movimentações. Os dados ficam em duplicateReviews, com leitura e escrita exclusivas de administradores e histórico na mesma transação.

A decisão vale para aquele par e para os nomes/congregações revisados. Se uma identidade mudar, a revisão deixa de ocultar o alerta. As sugestões durante um novo cadastro continuam disponíveis para evitar novas inscrições duplicadas.

## Regressão das regras de edição

Execute `npm.cmd run test:rules` com o Firebase CLI autenticado para simular 21 verificações de edição no serviço de regras, usando apenas cadastros fictícios e mocks de leitura. Não altera jogadores reais. O teste cobre a mudança de identidade, o histórico, a recusa a diretores, a preservação dos times e a prevenção de sobrescrita, com catálogo inicial ou persistido. Os timestamps das fixtures são representados por um valor fixo para isolar a lógica das regras.

As permissões de jogadores selecionam a validação pelo tipo de operação antes de executar verificações completas, evitando exceder o limite de avaliação do Firestore durante uma edição. Os testes de transação com mocks de SDK (`npm test`) não substituem essa verificação das regras.

## Filtros de movimentações

A página Movimentações permite combinar jogador (nome atual ou anterior), time, tipo de ação e datas inicial/final. A pesquisa ignora caixa e acentos; o período inclui os dias inteiros no horário de Brasília. Limpar filtros restaura a listagem. O contador informa quantos resultados correspondem aos registros carregados. Use Carregar mais movimentações para ampliar a consulta em blocos de 100; os filtros continuam aplicados e não exigem índices compostos no Firestore.

Inscrições e transferências usam os times registrados no evento; unificações usam os times envolvidos. Novas edições, alterações de situação e revisões de duplicidade guardam os times do momento no histórico. Eventos antigos dessas ações, quando não têm times salvos, usam os vínculos atuais do jogador (incluindo referências de cadastros corrigidos/unificados). Esse limite está indicado na própria página. Movimentações gerais da janela não pertencem a um time específico.

## Cidade no cadastro

A edição permite voltar a um nome/congregação/cidade anteriores quando o registro de destino é uma identidade arquivada do próprio jogador (até três redirecionamentos, limite validado também nas regras). Um cadastro de outra pessoa continua bloqueando a alteração. Times, situação, goleiro e histórico são preservados. As sugestões de congregação respeitam a cidade já selecionada e não a substituem silenciosamente. Nomes de congregação com hífen são separados da cidade pelo último separador.

O cadastro e a edição usam um seletor obrigatório de Cidade com os 34 municípios definidos. Não aceita digitação livre. Cadastros antigos no formato “congregação - cidade” são separados na interface; BH é reconhecido como Belo Horizonte. Sufixos desconhecidos não são adivinhados e precisam de conferência do admin na edição. Internamente a congregação mantém o formato combinado para preservar pesquisa, exportação e identificadores legados; novos registros também gravam `city`. Abreviações e separadores conhecidos são reutilizados para evitar criar uma nova identidade só pela padronização da cidade. Inscrições em cadastros existentes preservam seus dados; alterações são feitas em Editar. As regras exigem cidade válida em novos cadastros e compatível com o sufixo da congregação. A lista reduz variações de escrita, mas não comprova a identidade ou a cidade informada.

Publicação: em 19/10/2026 foi confirmado que o seletor de Cidade já estava na interface pública. Os 71 cenários de regras passaram no simulador, incluindo a edição de cadastros antigos com Cidade, e as regras foram publicadas no Firebase. Isso corrige a recusa de edições causada pela interface nova usando regras antigas. Em futuras mudanças de campos obrigatórios, publicar a interface compatível antes de ativar a exigência nas regras.

## Goleiros

O cadastro oferece o botão “🧤 Ele é GOLEIRO?”. Goleiros podem ter inscrições em qualquer quantidade de times, respeitando o acesso do diretor ao próprio time e sem inscrição repetida no mesmo time. Jogadores de linha continuam limitados a dois times. Em cadastros existentes, somente o admin altera a classificação por Editar; para retirar a marcação, é preciso reduzir as inscrições para no máximo duas. Na unificação, vale a classificação do cadastro que será mantido.

## Dia de jogo

O admin pode excluir qualquer confronto em Jogos da semana, mesmo com escalações enviadas: clicar em Excluir confronto e depois Salvar programação. Excluir todos fecha a rodada sem jogos. As escalações desses times saem da consulta pública e não reaparecem automaticamente se o confronto for recriado. Cadastros de jogadores e registros do histórico são preservados.

Ao editar uma escalação publicada, o elenco já abre com os jogadores da última versão marcados. É possível desmarcar ou remover e depois publicar a atualização. Alternar entre elenco e TXT preserva os jogadores escolhidos; a escalação publicada permanece igual até confirmar a nova publicação.

A consulta pública fica em `#/dia-de-jogo`. A programação fica somente em `#/gerenciar-rodada`, com formulário visível apenas para admins. O diretor já vê seu próprio confronto e entra por “Montar minha escalação”; se já publicou, “Editar minha escalação” carrega a versão atual. O envio tem três etapas: escolher, conferir e publicar. O elenco possui busca sem acentos, contador e selecionados primeiro; o TXT exibe resumo e mantém as correspondências confirmadas recolhidas, com as pendências abertas. Na etapa final todos os nomes e avisos são apresentados antes da confirmação. No celular o botão principal fica fixo no rodapé, mudando conforme a etapa. O prazo e as permissões continuam sendo verificados pelo banco.

Gerenciar acessos usa a página `#/gerenciar-acessos`, restrita à administração, com busca por nome/e-mail/time. Os avisos gerais da antiga faixa superior e as notificações de ações aparecem no canto superior direito por cinco segundos; erros de campos permanecem no formulário para correção.

A consulta pública mostra um resumo dos times que enviaram a escalação e dos que ainda estão pendentes. Envio não significa ausência de irregularidades: os avisos continuam nos confrontos. Cada confronto oferece “Copiar confronto para WhatsApp”, com data, horário, campo, observações públicas e as últimas escalações publicadas, incluindo pendências de vínculo. Não compartilha congregações. Se o navegador bloquear a área de transferência, um campo permite copiar o texto manualmente. O botão apenas copia; o usuário escolhe onde enviar.

Cada confronto tem horário (Brasília) e campo/local opcionais, exibidos publicamente; quando não preenchidos, aparecem como “a definir”. O horário deve estar em HH:MM e o local aceita até 120 caracteres em uma linha. Esses dados acompanham o confronto ao remover outros pares e são recuperados ao editar a programação. A data continua sendo a mesma para a rodada inteira.

O admin monta cada confronto escolhendo dois times e pode adicionar outro par com as equipes restantes. Uma equipe não pode repetir na rodada. Os pares são preservados na ordem da lista `teams` (posições 0/1, 2/3 etc.) e exibidos juntos na consulta pública. Programações antigas com quantidade ímpar precisam ser completadas ou ajustadas antes de salvar. Os seletores e as escalações ficam em uma coluna nas telas pequenas.

A aba **Dia de jogo** (#/dia-de-jogo) é de consulta pública, inclusive sem login. Exibe os times programados, os nomes publicados e os avisos de pendência. Os dados de congregação ficam na área de conferência do editor, e não são gravados nas entradas públicas. Somente o admin configura a rodada, sua data, os times participantes e a abertura/fechamento do envio.

Diretores só enviam pelo próprio time quando ele está programado e ativo. O prazo é até o fim da quinta-feira anterior ou igual à data do jogo, no horário de Brasília. Depois do prazo ou com o envio fechado, o admin pode corrigir. O papel do usuário é verificado novamente pelo banco nas operações de escrita.

Existem duas opções de escalação: **Escolher jogadores da lista do time**, com caixas de seleção, ou **Colar uma lista TXT**, com um nome por linha (até 50). A comparação sugere correspondências de nomes do próprio time. Quando não há confirmação, o nome pode ser publicado com aviso; não ocorre cadastro ou transferência automática.

A publicação aceita nomes sem cadastro confirmado, jogadores inativos e jogadores de outro time, mas grava o problema como `unknown`, `inactive` ou `otherTeam`. A interface pública destaca as pendências e informa que esses nomes não devem ser considerados confirmados no time. As regras impedem que um vínculo irregular seja gravado como confirmado. Jogadores identificados repetidos continuam bloqueados; linhas podem ser ignoradas explicitamente.

O diretor autorizado ou admin pode clicar em **Ajustar: escolher jogador do time**, selecionar a pessoa correta na lista do próprio time e publicar uma nova versão. **Usar última escalação enviada** também carrega a lista anterior para correção. A confirmação de publicação informa que nomes e avisos ficarão públicos.

O armazenamento usa gameWeeks, gameDrafts, gameEntries e gameSquads. Cada entrada é validada em uma transação pequena e a versão oficial só muda depois da conclusão do envio. Falhas de rede, mudança de dados durante a gravação ou envio concorrente preservam a versão anterior. A leitura pública das entradas exige que pertençam à versão oficial atual; os rascunhos não são públicos. Eventos da programação e dos envios ficam em Movimentações.

Os testes locais estão em tests/game-day.test.js e tests/game-store.test.js. `npm.cmd run test:game-rules` simula permissões de envio, leitura pública e classificação dos avisos no Firebase, com cadastros fictícios. Em 19/10/2026, após autorização, os 58 cenários de regras passaram no simulador e as regras foram publicadas no projeto `recreacao-17154`. Também foi corrigida a normalização de acentos maiúsculos nas regras, que recusava cadastros como “GLÓRIA - BH” por divergência no identificador. A publicação da interface é separada da publicação das regras.

## Consulta pública do BID
Visitantes acessam somente Times, Dia de jogo e Movimentações. Os resumos em publicEvents guardam apenas ação, jogador/time, data e vínculos envolvidos; o histórico completo, as congregações dos cadastros e as contas continuam restritos. As novas movimentações publicam o resumo na mesma transação. Para sincronizar registros antigos, use node scripts/sync-public-history.mjs com a conta administrativa autenticada no Firebase CLI. O script preserva o histórico original. node scripts/check-public-rules.mjs valida o acesso com dados fictícios, sem gravar cadastros.

