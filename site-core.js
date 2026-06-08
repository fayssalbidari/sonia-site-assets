window.Sonia = window.Sonia || {};

const getLatestBarbaContainer = () => {
  const containers = Array.from(document.querySelectorAll('[data-barba="container"]'));
  return containers.at(-1) || null;
};

window.Sonia.initSiteCore = function () {
  const pageRoot = getLatestBarbaContainer() || document;
  const navbar = pageRoot.querySelector(".navbar");
  const mobileToggle = pageRoot.querySelector(".navbar__menu-mobile");
  const mobileMenu = pageRoot.querySelector(".navbar__menu-links");

  if (!navbar || !mobileToggle || !mobileMenu || typeof gsap === "undefined") return;
  if (window.Sonia._siteCoreNavbar === navbar) return;

  window.Sonia.destroySiteCore?.();

  navbar.dataset.navInitialized = "true";

  const cleanupFns = [];
  const isMobile = () => window.innerWidth <= 767;
  const menuLinks = Array.from(mobileMenu.querySelectorAll("a"));
  let menuTween = null;
  let isMenuOpen = false;

  const getClosedY = () => window.innerHeight + 40;

  const applyClosedState = () => {
    gsap.set(mobileMenu, {
      y: getClosedY(),
      visibility: "hidden",
      pointerEvents: "none"
    });

    navbar.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    mobileToggle.setAttribute("aria-expanded", "false");
    isMenuOpen = false;
  };

  const applyOpenState = () => {
    gsap.set(mobileMenu, {
      y: 0,
      visibility: "visible",
      pointerEvents: "auto"
    });

    navbar.classList.add("is-open");
    document.body.classList.add("nav-open");
    mobileToggle.setAttribute("aria-expanded", "true");
    isMenuOpen = true;
  };

  const openMenu = () => {
    if (!isMobile() || isMenuOpen) return;

    menuTween?.kill();

    navbar.classList.add("is-open");
    document.body.classList.add("nav-open");
    mobileToggle.setAttribute("aria-expanded", "true");

    menuTween = gsap.timeline({
      defaults: {
        ease: "power3.inOut"
      }
    });

    menuTween.set(mobileMenu, {
      visibility: "visible",
      pointerEvents: "auto",
      y: getClosedY()
    });

    menuTween.to(mobileMenu, {
      y: 0,
      duration: 0.65
    });

    isMenuOpen = true;
  };

  const closeMenu = () => {
    if (!isMobile() || !isMenuOpen) return;

    menuTween?.kill();
    mobileToggle.setAttribute("aria-expanded", "false");

    menuTween = gsap.timeline({
      defaults: {
        ease: "power3.inOut"
      },
      onComplete: () => {
        gsap.set(mobileMenu, {
          visibility: "hidden",
          pointerEvents: "none"
        });

        navbar.classList.remove("is-open");
        document.body.classList.remove("nav-open");
        isMenuOpen = false;
      }
    });

    menuTween.to(mobileMenu, {
      y: getClosedY(),
      duration: 0.55
    });
  };

  const toggleMenu = (event) => {
    event.preventDefault();

    if (!isMobile()) return;

    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const onResize = () => {
    if (!isMobile()) {
      menuTween?.kill();
      gsap.set(mobileMenu, {
        clearProps: "transform,visibility,pointerEvents"
      });
      navbar.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      mobileToggle.setAttribute("aria-expanded", "false");
      isMenuOpen = false;
      return;
    }

    if (isMenuOpen) {
      applyOpenState();
    } else {
      applyClosedState();
    }
  };

  const onPageShow = () => {
    if (!isMobile()) return;
    applyClosedState();
  };

  mobileToggle.setAttribute("aria-expanded", "false");
  mobileToggle.addEventListener("click", toggleMenu);
  cleanupFns.push(() => {
    mobileToggle.removeEventListener("click", toggleMenu);
  });

  menuLinks.forEach((link) => {
    const onLinkClick = () => {
      if (!isMobile()) return;
      closeMenu();
    };

    link.addEventListener("click", onLinkClick);
    cleanupFns.push(() => {
      link.removeEventListener("click", onLinkClick);
    });
  });

  window.addEventListener("resize", onResize);
  window.addEventListener("pageshow", onPageShow);

  cleanupFns.push(() => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pageshow", onPageShow);
  });

  if (isMobile()) {
    applyClosedState();
  } else {
    gsap.set(mobileMenu, {
      clearProps: "transform,visibility,pointerEvents"
    });
  }

  cleanupFns.push(() => {
    menuTween?.kill();
    navbar.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    mobileToggle.setAttribute("aria-expanded", "false");
    navbar.dataset.navInitialized = "false";
    gsap.set(mobileMenu, {
      clearProps: "transform,visibility,pointerEvents"
    });
  });

  window.Sonia._siteCoreCleanup = cleanupFns;
  window.Sonia._siteCoreNavbar = navbar;
  window.Sonia._siteCoreContainer = pageRoot;
};

window.Sonia.destroySiteCore = function () {
  const cleanupFns = window.Sonia._siteCoreCleanup || [];
  cleanupFns.forEach((fn) => {
    if (typeof fn === "function") fn();
  });

  window.Sonia._siteCoreCleanup = [];
  window.Sonia._siteCoreNavbar = null;
  window.Sonia._siteCoreContainer = null;
};

(function () {
  const watchContainers = () => {
    if (window.Sonia._siteCoreContainerObserverBound) return;
    window.Sonia._siteCoreContainerObserverBound = true;

    let queued = false;

    const syncToLatestContainer = () => {
      queued = false;

      const latestContainer = getLatestBarbaContainer();
      if (!latestContainer) return;
      if (window.Sonia._siteCoreContainer === latestContainer) return;

      window.Sonia.destroySiteCore?.();
      window.Sonia.initSiteCore?.();
    };

    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(syncToLatestContainer);
    });

    observer.observe(document.body, {
      childList: true
    });

    window.Sonia._siteCoreContainerObserver = observer;
  };

  const bindBarbaHooks = () => {
    if (window.Sonia._siteCoreBarbaHooksBound) return;
    if (!window.barba?.hooks) {
      window.setTimeout(bindBarbaHooks, 50);
      return;
    }

    window.Sonia._siteCoreBarbaHooksBound = true;

    window.barba.hooks.beforeLeave(() => {
      window.Sonia.destroySiteCore?.();
    });

    window.barba.hooks.afterEnter(() => {
      window.Sonia.initSiteCore?.();
    });
  };

  const boot = () => {
    window.Sonia.initSiteCore?.();
    watchContainers();
    bindBarbaHooks();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
