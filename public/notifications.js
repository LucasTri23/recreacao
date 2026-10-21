export function setupNotifications(document) {
  const box = document.querySelector('#toast'), notice = document.querySelector('#mode-notice');
  let timer, previousNotice = '';
  box.setAttribute('aria-live','polite'); box.setAttribute('aria-atomic','true');
  const toast = message => {
    box.textContent = message; box.style.display = 'block';
    if (typeof box.showPopover === 'function') { box.setAttribute('popover','manual'); if (!box.matches(':popover-open')) box.showPopover(); }
    clearTimeout(timer); timer = setTimeout(() => {
      if (typeof box.hidePopover === 'function' && box.matches(':popover-open')) box.hidePopover();
      box.style.display = 'none';
    },5000);
  };
  const observer = new document.defaultView.MutationObserver(() => {
    const message = notice.textContent.trim();
    if (message && message !== previousNotice) { previousNotice = message; toast(message); }
  });
  observer.observe(notice,{childList:true,characterData:true,subtree:true});
  toast.dispose = () => { clearTimeout(timer); observer.disconnect(); };
  return toast;
}
