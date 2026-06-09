window.Sonia = window.Sonia || {};

window.Sonia.initHome = function () {
  const { gsap } = window;
  const homeContainers = Array.from(
    document.querySelectorAll('[data-barba="container"][data-barba-namespace="home"]')
  );
  const pageRoot = homeContainers.at(-1) || document;
  const homeRoot = pageRoot.querySelector(".page-home");
  const hasHomePage =
    homeRoot &&
    homeRoot.querySelector('[data-home-sync="gallery"]') &&
    pageRoot.querySelector('[data-work="section"]');

  if (!gsap || !hasHomePage) return;

  const workSection = pageRoot.querySelector('[data-work="section"]');
  const workItems = Array.from(pageRoot.querySelectorAll('[data-work="item"]'));
  const syncRoot = homeRoot.querySelector('[data-home-sync="gallery"]');

  if (!workSection || !workItems.length || !syncRoot) return;
  if (workSection.dataset.homeInitialized === "true") return;

  workSection.dataset.homeInitialized = "true";

  const syncViewport = syncRoot.querySelector('[data-home-sync-viewport]');
  const syncTrack = syncRoot.querySelector('[data-home-sync-track]');
  const syncTexts = Array.from(syncRoot.querySelectorAll('[data-home-sync-text]'));
  const yearStartEl = syncRoot.querySelector('[data-home-year-start-display]');
  const yearSeparatorEl = syncRoot.querySelector('[data-home-year-separator]');
  const yearEndEl = syncRoot.querySelector('[data-home-year-end-display]');
  const quantityValueEl = syncRoot.querySelector('[data-home-quantity-display]');

  const normalize = (value) => (value || "").trim().toLowerCase();
  const formatTwoDigits = (value) => String(value).padStart(2, "0");
  const isMobile = () => window.innerWidth <= 767;
  const refreshRuntime = () => {
    window.lenis?.start?.();
    window.lenis?.resize?.();
    window.ScrollTrigger?.refresh?.();
  };

  const scheduleRuntimeRefresh = () => {
    if (document.body.dataset.barbaTransition === "active") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(refreshRuntime);
    });
  };

  const textMap = new Map();
  syncTexts.forEach((item, index) => {
    const id = normalize(item.getAttribute("data-home-sync-id"));
    if (id) textMap.set(id, index);
  });

  const seriesMeta = new Map();
  const metaEntries = Array.from(homeRoot.querySelectorAll('[data-home-series-entry]'));

  metaEntries.forEach((entry) => {
    const slug = normalize(entry.getAttribute("data-home-series-slug"));
    const rawYear = (entry.getAttribute("data-home-series-year") || "").trim();

    if (!slug) return;

    if (!seriesMeta.has(slug)) {
      seriesMeta.set(slug, {
        count: 0,
        minYear: null,
        maxYear: null
      });
    }

    const meta = seriesMeta.get(slug);
    meta.count += 1;

    if (!rawYear) return;

    const year = Number(rawYear);
    if (!Number.isFinite(year)) return;

    meta.minYear = meta.minYear === null ? year : Math.min(meta.minYear, year);
    meta.maxYear = meta.maxYear === null ? year : Math.max(meta.maxYear, year);
  });

  let textItemHeight = 0;
  let activeIndex = 0;
  let touchStartY = 0;
  let currentTimeline = null;
  let currentIncomingIndex = null;
  let textOverlay = null;
  let activeTextNode = null;
  let activeTextIndex = null;
  const rootOverflow = document.documentElement.style.overflow;
  const bodyOverflow = document.body.style.overflow;
  const bodyTouchAction = document.body.style.touchAction;
  const pageHomeOverflow = homeRoot.style.overflow;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wheelThreshold = 12;
  const touchThreshold = 40;
  const idleScale = 1.22;
  const idleOffset = 8;
  const travelOffset = 6;
  const textTransitionDuration = 0.9;

  const slides = workItems.map((item) => ({
    item,
    id: item.getAttribute("data-home-sync-id"),
    imageWrapper: item.querySelector('[data-work="image-wrapper"]')
  }));
  const mediaImages = Array.from(homeRoot.querySelectorAll('[data-work="image"]'));

  const wrapIndex = (index) => (index + slides.length) % slides.length;

  function measureTextTrack() {
    if (!syncTexts.length) return;
    textItemHeight = syncTexts[0].getBoundingClientRect().height;
  }

  function getTextIndexById(id) {
    if (!textMap.size || !textItemHeight) return null;
    const index = textMap.get(normalize(id));
    if (typeof index !== "number") return null;
    return index;
  }

  function ensureTextOverlay() {
    if (!syncViewport) return null;
    if (textOverlay?.isConnected) return textOverlay;

    textOverlay = document.createElement("div");
    textOverlay.setAttribute("data-home-sync-overlay", "");

    gsap.set(syncViewport, { position: "relative" });
    gsap.set(textOverlay, {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none"
    });

    syncViewport.appendChild(textOverlay);

    if (syncTrack) {
      gsap.set(syncTrack, { autoAlpha: 0 });
    }

    return textOverlay;
  }

  function createTextNode(index) {
    const source = syncTexts[index];
    const overlay = ensureTextOverlay();

    if (!source || !overlay) return null;

    const clone = source.cloneNode(true);
    clone.removeAttribute("data-home-sync-text");

    gsap.set(clone, {
      position: "absolute",
      inset: 0,
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "inherit",
      margin: 0,
      yPercent: 0,
      clipPath: "inset(0% 0% 0% 0%)"
    });

    return clone;
  }

  function setActiveText(index) {
    const overlay = ensureTextOverlay();
    const nextNode = createTextNode(index);

    if (!overlay || !nextNode) return;

    overlay.replaceChildren(nextNode);
    activeTextNode = nextNode;
    activeTextIndex = index;
  }

  function syncTextById(id) {
    const index = getTextIndexById(id);
    if (index === null) return;
    setActiveText(index);
  }

  function syncMeta(id) {
    const meta = seriesMeta.get(normalize(id));
    const hasQuantity = meta && meta.count > 0;
    const hasYears =
      meta &&
      Number.isFinite(meta.minYear) &&
      Number.isFinite(meta.maxYear);

    if (quantityValueEl) {
      quantityValueEl.textContent = hasQuantity ? formatTwoDigits(meta.count) : "00";
      quantityValueEl.style.display = "";
    }

    if (!hasYears) {
      if (yearStartEl) {
        yearStartEl.textContent = "";
        yearStartEl.style.display = "none";
      }

      if (yearSeparatorEl) {
        yearSeparatorEl.style.display = "none";
      }

      if (yearEndEl) {
        yearEndEl.textContent = "";
        yearEndEl.style.display = "none";
      }

      return;
    }

    const sameYear = meta.minYear === meta.maxYear;

    if (yearStartEl) {
      yearStartEl.textContent = String(meta.minYear);
      yearStartEl.style.display = "";
    }

    if (yearSeparatorEl) {
      yearSeparatorEl.style.display = sameYear ? "none" : "";
    }

    if (yearEndEl) {
      yearEndEl.textContent = sameYear ? "" : String(meta.maxYear);
      yearEndEl.style.display = sameYear ? "none" : "";
    }
  }

  function setSlideState(slide, isActive) {
    gsap.set(slide.item, {
      zIndex: isActive ? 1 : 0,
      clipPath: isActive ? "inset(0% 0 0% 0)" : "inset(100% 0 0% 0)"
    });

    if (slide.imageWrapper) {
      gsap.set(slide.imageWrapper, {
        scale: isActive ? 1 : idleScale,
        yPercent: isActive ? 0 : idleOffset
      });
    }
  }

  function settleOnSlide(index) {
    activeIndex = index;

    slides.forEach((slide, slideIndex) => {
      setSlideState(slide, slideIndex === activeIndex);
    });

    const activeId = slides[activeIndex]?.id;
    syncTextById(activeId);
    syncMeta(activeId);
  }

  function finishCurrentTransition() {
    return !!(currentTimeline && currentTimeline.isActive());
  }

  function goToSlide(direction) {
    if (direction === 0 || finishCurrentTransition()) return;

    const outgoingIndex = activeIndex;
    const incomingIndex = wrapIndex(activeIndex + direction);
    const outgoingSlide = slides[outgoingIndex];
    const incomingSlide = slides[incomingIndex];
    const revealFromTop = direction < 0;

    slides.forEach((slide, index) => {
      if (index !== outgoingIndex && index !== incomingIndex) {
        setSlideState(slide, false);
      }
    });

    gsap.set(outgoingSlide.item, {
      zIndex: 1,
      clipPath: "inset(0% 0 0% 0)"
    });

    gsap.set(incomingSlide.item, {
      zIndex: 2,
      clipPath: revealFromTop ? "inset(0% 0 100% 0)" : "inset(100% 0 0% 0)"
    });

    if (outgoingSlide.imageWrapper) {
      gsap.set(outgoingSlide.imageWrapper, {
        scale: 1,
        yPercent: 0
      });
    }

    if (incomingSlide.imageWrapper) {
      gsap.set(incomingSlide.imageWrapper, {
        scale: idleScale,
        yPercent: revealFromTop ? -travelOffset : travelOffset
      });
    }

    currentIncomingIndex = incomingIndex;
    syncMeta(incomingSlide.id);

    const overlay = ensureTextOverlay();
    const outgoingTextNode = activeTextNode || createTextNode(outgoingIndex);
    const incomingTextNode = createTextNode(incomingIndex);
    const textIncomingFromTop = direction < 0;

    if (overlay && outgoingTextNode && incomingTextNode) {
      if (!outgoingTextNode.isConnected) {
        overlay.appendChild(outgoingTextNode);
      }

      overlay.appendChild(incomingTextNode);

      gsap.set(outgoingTextNode, {
        yPercent: 0,
        clipPath: "inset(0% 0% 0% 0%)"
      });

      gsap.set(incomingTextNode, {
        yPercent: textIncomingFromTop ? -100 : 100,
        clipPath: textIncomingFromTop
          ? "inset(0% 0% 100% 0%)"
          : "inset(100% 0% 0% 0%)"
      });
    }

    currentTimeline = gsap.timeline({
      defaults: {
        duration: 1,
        ease: "power4.inOut"
      },
      onComplete: () => {
        settleOnSlide(incomingIndex);
        currentTimeline = null;
        currentIncomingIndex = null;
      }
    });

    currentTimeline.to(incomingSlide.item, {
      clipPath: "inset(0% 0 0% 0)"
    }, 0);

    if (incomingSlide.imageWrapper) {
      currentTimeline.to(incomingSlide.imageWrapper, {
        scale: 1,
        yPercent: 0
      }, 0);
    }

    if (overlay && outgoingTextNode && incomingTextNode) {
      currentTimeline.to(outgoingTextNode, {
        yPercent: textIncomingFromTop ? 100 : -100,
        clipPath: textIncomingFromTop
          ? "inset(100% 0% 0% 0%)"
          : "inset(0% 0% 100% 0%)",
        duration: textTransitionDuration,
        ease: "power4.inOut"
      }, 0);

      currentTimeline.to(incomingTextNode, {
        yPercent: 0,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: textTransitionDuration,
        ease: "power4.inOut"
      }, 0);
    }
  }

  const onResize = () => {
    applyMobileScrollLock();
    measureTextTrack();
    const activeId = slides[activeIndex]?.id;
    syncTextById(activeId);
    syncMeta(activeId);
  };

  const onWheel = (event) => {
    if (Math.abs(event.deltaY) < wheelThreshold) return;
    event.preventDefault();
    goToSlide(event.deltaY > 0 ? 1 : -1);
  };

  const onKeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      goToSlide(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      goToSlide(-1);
    }
  };

  const onTouchStart = (event) => {
    touchStartY = event.touches[0].clientY;
  };

  const onTouchEnd = (event) => {
    const deltaY = touchStartY - event.changedTouches[0].clientY;
    if (Math.abs(deltaY) < touchThreshold) return;
    goToSlide(deltaY > 0 ? 1 : -1);
  };

  const preventNativeScroll = (event) => {
    if (!isMobile()) return;
    if (!event.cancelable) return;
    event.preventDefault();
  };

  const applyMobileScrollLock = () => {
    if (!isMobile()) {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.touchAction = bodyTouchAction;
      homeRoot.style.overflow = pageHomeOverflow;
      return;
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    homeRoot.style.overflow = "hidden";
  };

  measureTextTrack();
  applyMobileScrollLock();
  settleOnSlide(activeIndex);
  scheduleRuntimeRefresh();

  const imageLoadHandlers = mediaImages
    .map((image) => {
      if (image.complete) return null;

      const onImageLoad = () => {
        onResize();
        scheduleRuntimeRefresh();
      };

      image.addEventListener("load", onImageLoad);
      return { image, onImageLoad };
    })
    .filter(Boolean);

  window.addEventListener("resize", onResize);

  if (!prefersReducedMotion) {
    workSection.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeydown);
    workSection.addEventListener("touchstart", onTouchStart, { passive: true });
    workSection.addEventListener("touchend", onTouchEnd, { passive: true });
    workSection.addEventListener("touchmove", preventNativeScroll, { passive: false });
  }

  window.Sonia.destroyHome = function () {
    window.removeEventListener("resize", onResize);

    if (!prefersReducedMotion) {
      workSection.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeydown);
      workSection.removeEventListener("touchstart", onTouchStart);
      workSection.removeEventListener("touchend", onTouchEnd);
      workSection.removeEventListener("touchmove", preventNativeScroll);
    }

    document.documentElement.style.overflow = rootOverflow;
    document.body.style.overflow = bodyOverflow;
    document.body.style.touchAction = bodyTouchAction;
    homeRoot.style.overflow = pageHomeOverflow;

    if (currentTimeline) {
      currentTimeline.kill();
      currentTimeline = null;
    }

    imageLoadHandlers.forEach(({ image, onImageLoad }) => {
      image.removeEventListener("load", onImageLoad);
    });

    textOverlay?.remove();
    textOverlay = null;
    activeTextNode = null;
    activeTextIndex = null;

    if (syncTrack) {
      gsap.set(syncTrack, { clearProps: "opacity,visibility" });
    }

    workSection.dataset.homeInitialized = "false";
  };

};
