'use strict';
(() => {
const mobileNavigation=window.matchMedia('(max-width: 767px)');
const setMobileMenu=open=>{
 document.body.classList.toggle('nav-open',open);document.getElementById('sidebarBackdrop').hidden=!open;
 document.getElementById('appSidebar').inert=mobileNavigation.matches&&!open;
 document.getElementById('menuToggle').setAttribute('aria-expanded',String(open));
 document.getElementById('menuToggle').setAttribute('aria-label',open?'Close navigation':'Open navigation');
};
mobileNavigation.addEventListener('change',()=>setMobileMenu(false));
setMobileMenu(false);
document.getElementById('menuToggle').onclick=()=>setMobileMenu(!document.body.classList.contains('nav-open'));
document.getElementById('sidebarBackdrop').onclick=()=>setMobileMenu(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){setMobileMenu(false);document.getElementById('menuToggle').focus();}});
document.getElementById('navSearch').oninput=e=>{let matches=0;for(const link of document.querySelectorAll('[data-view]')){link.hidden=!link.textContent.toLowerCase().includes(e.target.value.toLowerCase());if(!link.hidden)matches++;}document.getElementById('navEmpty').hidden=matches>0;};
// Older tools render wide tables without responsive wrappers.
if(document.querySelector('.legacy-shell')){
 for(const table of document.querySelectorAll('.legacy-shell ~ .container table')){
  if(table.closest('.table-responsive'))continue;
  const wrapper=document.createElement('div');wrapper.className='table-responsive';
  table.before(wrapper);wrapper.appendChild(table);
 }
}
window.ProviderShell={setMobileMenu};
})();
