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
  var pathname = window.location.pathname;
  var active = null;
  if (pathname === '/' || pathname === '/index.html' || pathname === '') {
    active = 'inicio';
  } else if (pathname.includes('laptops-gaming') || pathname.includes('laptops.html') || pathname.includes('computadoras') || pathname.includes('mini-pcs') || pathname.includes('minipcs.html')) {
    active = 'pc';
  } else if (pathname.includes('motherboards') || pathname.includes('motherboard.html') || pathname.includes('componentes') || pathname.includes('catalogo.html')) {
    active = 'componentes';
  } else if (pathname.includes('monitores') || pathname.includes('gaming-monitores.html')) {
    active = 'monitores';
  }
  if (active) {
    document.querySelectorAll('.nav-link[data-nav="' + active + '"]').forEach(function (el) {
      el.classList.add('active');
    });
  }
})();
