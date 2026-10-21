const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = null;
try { preference = localStorage.getItem('recreacao-theme'); } catch {}
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const button = document.querySelector('#theme-toggle');
  if (button) {
    button.textContent = dark ? '☀ Claro' : '☾ Escuro';
    button.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
    button.setAttribute('aria-pressed', String(dark));
  }
}
applyTheme(true);
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark');
  document.querySelector('#theme-toggle').onclick = () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('recreacao-theme', preference); } catch {}
    applyTheme(preference === 'dark');
  };
});
media.addEventListener('change', event => { if (!preference) applyTheme(event.matches); });
