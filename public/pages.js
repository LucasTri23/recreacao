const titles = {times:'Nossos times',jogadores:'Jogadores',movimentacoes:'Movimentações',duplicidades:'Duplicidades','gerenciar-times':'Gerenciar times','dia-de-jogo':'Dia de jogo'};
export function currentPage(hash = location.hash) {
  const key = hash.replace(/^#\/?/,'');
  return Object.hasOwn(titles,key) ? key : 'times';
}
export function setupPages(onChange) {
  function show(focus = false) {
    const page = currentPage();
    document.querySelectorAll('[data-page]').forEach(section => section.hidden = section.dataset.page !== page);
    document.querySelectorAll('[data-nav]').forEach(link => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    document.querySelector('#page-label').textContent = titles[page];
    document.title = `${titles[page]} · Recreação`;
    onChange(page);
    if (focus) {
      const heading = document.querySelector(`[data-page="${page}"] h2, [data-page="${page}"] h1`);
      heading?.setAttribute('tabindex','-1'); heading?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
    }
  }
  window.addEventListener('hashchange',() => show(true));
  show();
}
