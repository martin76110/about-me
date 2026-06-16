/* ------------------------------------------------------------------ *
 *  little easter egg for anyone poking at the code
 *  (you can't really hide front-end code — this is just for fun)
 * ------------------------------------------------------------------ */
(function () {
  const NADA = 'nada';
  const BIG = 'font-size:72px;font-weight:800;color:#e85b9c;text-shadow:0 0 22px #c02f6e;';
  const SUB = 'font-size:14px;color:#ffd9ec;letter-spacing:0.35em;';

  function greet() {
    console.log('%c' + NADA, BIG);
    console.log('%cno hay nada que ver aqui :)', SUB);
  }
  greet();

  // re-troll on the usual "view the code" shortcuts
  window.addEventListener('keydown', function (e) {
    const k = (e.key || '').toLowerCase();
    const isDevtools =
      e.key === 'F12' ||                                   // devtools
      (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || // inspect/console
      (e.ctrlKey && k === 'u');                            // view-source
    if (isDevtools) {
      try { console.clear(); } catch (_) {}
      greet();
    }
  });

  // right-click -> nada
  window.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    greet();
  });
})();
