// Runs in <head> before the page is painted, so shoppers never see the default
// design (hidden photos, default yellow) flash before the CMS settings arrive.
// storefront-appearance.js removes the class once the settings are applied.
(function () {
  var root = document.documentElement;
  root.classList.add('cms-pending');
  // Failsafe: never leave the page invisible if the settings script fails.
  setTimeout(function () { root.classList.remove('cms-pending'); }, 2500);
  // Apply cached colours now so the background does not change after paint.
  try {
    var cached = JSON.parse(localStorage.getItem('merkaz_appearance_v1:' + location.pathname) || 'null');
    var vars = cached && cached.vars;
    if (vars) for (var name in vars) {
      if (/^--[\w-]+$/.test(name) && /^[#\w.%(),\s-]{1,40}$/.test(vars[name])) root.style.setProperty(name, vars[name]);
    }
  } catch (e) { /* storage unavailable: the page simply waits for the network */ }
})();
