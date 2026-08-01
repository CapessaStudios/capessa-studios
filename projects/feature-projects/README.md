# Future Projects

Esta pasta está reservada para os próximos jogos e aplicações da Capessa Studios.

Quando um novo projeto estiver pronto para ser publicado:

1. Cria uma subpasta com o `id` do projeto (o mesmo `id` usado em `data/games.json` ou `data/apps.json`), seguindo o padrão de `projects/ludo-chaos/`.
2. Copia a estrutura de `projects/ludo-chaos/index.html` como ponto de partida — o `js/loader.js` já sabe carregar os dados automaticamente a partir de `document.body.dataset.project`.
3. Adiciona a entrada correspondente em `data/games.json` ou `data/apps.json`.
4. (Opcional) Adiciona entradas de changelog em `data/updates.json` com o mesmo `gameId`.

Não é necessário editar HTML fora da nova subpasta — as listagens (`games.html`, `apps.html`, `projects.html`, `web-games.html`) e a home atualizam-se sozinhas a partir dos JSON.
