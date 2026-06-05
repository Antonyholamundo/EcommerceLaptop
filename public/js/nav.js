(function () {
  var container = document.getElementById('main-nav-container');
  var toggle = document.getElementById('nav-toggle-btn');
  if (toggle) {
    toggle.addEventListener('click', function () {
      container.classList.toggle('mobile-open');
    });
  }
  document.querySelectorAll('.nav-dropdown > .nav-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (window.innerWidth <= 700) {
        e.preventDefault();
        this.parentElement.classList.toggle('mobile-open');
      }
    });
  });
  var page = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
  var map = {
    'index.html': 'inicio', 'laptops.html': 'pc', 'computadoras.html': 'pc',
    'minipcs.html': 'pc', 'motherboard.html': 'componentes', 'monitores.html': 'monitores',
    'gaming-monitores.html': 'monitores', 'catalogo.html': 'componentes'
  };
  var active = map[page];
  if (active) {
    document.querySelectorAll('.nav-link[data-nav="' + active + '"]').forEach(function (el) {
      el.classList.add('active');
    });
  }
})();
