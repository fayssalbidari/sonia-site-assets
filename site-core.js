(function () {
  console.log("site-core file loaded");

  const init = () => {
    console.log("site-core init called");

    const navbar = document.querySelector(".navbar");
    const mobileToggle = document.querySelector(".navbar__menu-mobile");
    const mobileMenu = document.querySelector(".navbar__menu-links");
    const hasGsap = typeof window.gsap !== "undefined";

    console.log("site-core state", {
      navbar: !!navbar,
      mobileToggle: !!mobileToggle,
      mobileMenu: !!mobileMenu,
      hasGsap
    });

    if (!navbar || !mobileToggle || !mobileMenu || !hasGsap) {
      console.log("site-core guard blocked init");
      return;
    }

    if (navbar.dataset.navInitialized === "true") {
      console.log("site-core already initialized");
      return;
    }

    const { gsap } = window;
    navbar.dataset.navInitialized = "true";

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
      console.log("openMenu called", { isMobile: isMobile(), isMenuOpen });

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
      console.log("closeMenu called", { isMobile: isMobile(), isMenuOpen });

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
      console.log("toggleMenu click");

      if (!isMobile()) return;

      if (isMenuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    mobileToggle.setAttribute("aria-expanded", "false");
    mobileToggle.addEventListener("click", toggleMenu);

    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (!isMobile()) return;
        closeMenu();
      });
    });

    window.addEventListener("resize", () => {
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
    });

    window.addEventListener("pageshow", () => {
      if (!isMobile()) return;
      applyClosedState();
    });

    if (isMobile()) {
      applyClosedState();
    } else {
      gsap.set(mobileMenu, {
        clearProps: "transform,visibility,pointerEvents"
      });
    }

    console.log("site-core nav initialized");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
