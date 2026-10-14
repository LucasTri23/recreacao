# Recreação

Organização de oito times sem placar ou ranking. Hospedagem no GitHub Pages e login Google + banco Cloud Firestore no plano gratuito Spark. Não usa Cloud Functions, cartão ou plano Blaze. O uso está sujeito às cotas gratuitas do Firebase; ao esgotá-las, o serviço pode ficar indisponível até a renovação da cota.

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

O workflow publica somente a pasta `public`. As regras do Firestore são publicadas separadamente pelo comando acima. Não salve dados de jogadores ou credenciais privadas no GitHub.

## Liberar contas

Entre com Google no site uma vez. Copie o UID da conta em Firebase Authentication → Users. No console Firestore, crie o documento `users/UID` com `role: "admin"` para a administração; para cada diretor, crie `role: "director"` e `team` com um nome exato: BRANCO, PRETO, BLUES, COIOTES, VETOR NORTE, AMARELO, LARANJA ou VERDE. Saia e entre para carregar o perfil. Permissões são atribuídas somente pelo console administrativo.

## Regras e integridade

Cada jogador é identificado por um hash de nome completo + congregação. Cliente e regras normalizam caixa, espaços e acentos usuais do português. As regras verificam o hash para impedir documentos duplicados com o mesmo nome/congregação. Grafias diferentes ainda exigem revisão humana; homônimos na mesma congregação precisam de tratamento administrativo antes do cadastro.

Diretores leem a relação geral e inscrevem apenas no próprio time. Cada jogador tem um ou dois times distintos. Durante a janela aberta, o diretor do time de origem pode transferir para outro time, preservando a segunda inscrição. Só administradores alteram a janela. Nomes, congregações, perfis e histórico não podem ser alterados pelo navegador depois da criação.

Toda alteração de jogador usa transação e exige um registro de histórico na mesma operação. As regras verificam permissões, janela, identidade e limite mesmo em acessos diretos ao banco. Nenhum dado pessoal é servido sem autenticação autorizada.

## Verificação

`npm test` verifica identidade, limite de times e transferência. Antes de liberar aos diretores, confira com contas reais: cadastro no próprio time, bloqueio de outro time, segunda e terceira inscrições, cadastro simultâneo e transferência com janela fechada/aberta. Checagem de compilação das regras não substitui esses testes de acesso.
