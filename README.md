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

O menu separa Nossos times, Jogadores, Movimentações e Duplicidades em telas com endereços próprios: #/times, #/jogadores, #/movimentacoes e #/duplicidades. Os endereços funcionam no GitHub Pages e permitem voltar/avançar pelo navegador. Clicar em um time abre a página de jogadores com esse time selecionado. Movimentações mostra os 100 registros mais recentes e atualiza automaticamente. Duplicidades continua restrita à administração; a confirmação de unificação permanece em diálogo.

## Gerenciar jogadores

Na página Jogadores, administradores podem editar nome e congregação, inativar, ativar e excluir cadastros. Os filtros Ativos, Inativos, Excluídos e Todas as situações ajudam a localizar cada jogador. Os totais dos times incluem apenas jogadores ativos.

Inativar preserva os times e bloqueia novas inscrições e transferências. Excluir retira o jogador da relação principal de forma recuperável: os dados e o histórico permanecem no banco, e Restaurar devolve o jogador à situação ativa. Essas ações exigem confirmação na interface e ficam registradas em Movimentações.

Editar preserva times e situação. Se a identidade mudar, o cadastro antigo passa a apontar para o corrigido, para impedir uma nova inscrição separada pelo nome antigo. Identidades já existentes exigem revisão de duplicidades. Diretores não podem executar essas ações administrativas. Publique as regras atualizadas antes de usar.

## Gerenciar times

A página Gerenciar times (#/gerenciar-times) é exclusiva da administração. Permite criar times, editar nome, cor e emblema, inativar, ativar, excluir e restaurar. Os filtros mostram times ativos, inativos, excluídos ou todos. O nome deve ser único, incluindo times inativos e excluídos.

O catálogo fica em settings/teams. Na ausência desse documento, cliente e regras usam os oito times iniciais; a primeira alteração administrativa salva o catálogo completo. Os identificadores dos times atuais são preservados. Novos times recebem identificadores estáveis; renomear altera apenas a apresentação, mantendo jogadores e diretores vinculados.

Inativar ou excluir é recuperável, retira o time da página principal e bloqueia inscrições, transferências de entrada e novos vínculos de diretores. Os jogadores e diretores existentes são preservados, assim como o histórico. Transferências de saída continuam permitidas durante a janela. O limite de dois times por jogador inclui os vínculos preservados com times inativos/excluídos. Toda alteração do catálogo usa transação com histórico e exige perfil de administrador nas regras do banco.
