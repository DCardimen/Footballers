
/* ===== v139 THE DOCK IS NOT A LID =====
 * `.screen` reserved a flat 108px at the foot of every page for a `.dock` that is
 * `position:fixed` and as tall as whatever it happens to hold. On the prestige tree that is a
 * branch strip over two rows of buttons — 325px on a 390px phone — so the last two hundred
 * pixels of the node list sat under the dock at full scroll and could not be read or tapped.
 * The reserve is measured off the dock itself now, and re-measured whenever it changes. */
(function () {
  var last = -1, ro = null;
  function sync() {
    try {
      var d = document.getElementById("dock");
      if (d && ro && !d.__v139) { d.__v139 = 1; ro.observe(d) }
      var n = document.getElementById("navV139");
      var nh = (n && n.classList.contains("on")) ? Math.round(n.getBoundingClientRect().height) : 0;
      /* the bar owns the very bottom; the dock rides on top of it, and the page reserves both */
      document.documentElement.style.setProperty("--navH-v139", nh + "px");
      var h = Math.round((d && d.getBoundingClientRect().height) || 0) + nh;
      if (h === last) return;
      last = h;
      document.documentElement.style.setProperty("--dockH-v139", (h ? h + 18 : 108) + "px");
    } catch (e) {}
  }
  try { ro = new ResizeObserver(sync) } catch (e) {}
  try { new MutationObserver(sync).observe(document.body, { childList: true, subtree: true }) } catch (e) {}
  addEventListener("resize", sync);
  setInterval(sync, 400);
  sync();
  window.__DOCK_V139 = { sync: sync, h: function () { return last } };
})();
