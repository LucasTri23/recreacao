const icons = {
  times:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  jogadores:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  'dia-de-jogo':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h1m3 0h1m3 0h1m-9 3h1m3 0h1"/>',
  movimentacoes:'<path d="M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5"/>',
};
export function setupPresentation() {
  const sidebar = document.querySelector('.sidebar'), nav = sidebar.querySelector('nav');
  sidebar.append(document.querySelector('.header-actions'));
  const labels = {times:'Times',jogadores:'Jogadores','dia-de-jogo':'Dia de jogo',movimentacoes:'Movimentações',duplicidades:'Duplicidades','gerenciar-rodada':'Jogos da semana','gerenciar-acessos':'Acessos','gerenciar-times':'Gestão de times'};
  for (const [page,label] of Object.entries(labels)) {
    const link = nav.querySelector(`[data-nav="${page}"]`);
    if (link) { link.textContent = label; nav.append(link); }
  }
  const stats = document.querySelectorAll('.summary .stat-icon');
  for (const [i,key] of ['times','jogadores','movimentacoes'].entries()) if (stats[i]) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.6'); svg.setAttribute('aria-hidden','true'); svg.innerHTML = icons[key]; stats[i].replaceChildren(svg);
  }
  const heading = document.querySelector('.bid-intro h1');
  heading.innerHTML = '<span>BID DA</span><em>RECREAÇÃO</em>';
  document.querySelector('.bid-intro .eyebrow').textContent = 'BOLETIM INFORMATIVO DIÁRIO';
  document.querySelector('.bid-intro p').textContent = 'INSCRIÇÕES · VÍNCULOS · TRANSFERÊNCIAS';
  document.querySelector('.registry-seal')?.remove();
}
