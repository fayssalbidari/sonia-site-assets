window.Sonia = window.Sonia || {};

window.Sonia.initHome = function () {
  const { gsap } = window;
  const homeRoot = document.querySelector(".page-home");
  const hasHomePage =
    homeRoot &&
    homeRoot.querySelector('[data-home-sync="gallery"]') &&
    document.querySelector('[data-work="section"]');

  if (!gsap || !hasHomePage) return;

  const workSection = document.querySelector('[data-work="section"]');
  const workItems = Array.from(document.querySelectorAll('[data-work="item"]'));
  const syncRoot = homeRoot.querySelector('[data-home-sync="gallery"]');

  if (!workSection || !workItems.length || !syncRoot) return;
  if (workSection.dataset.homeInitialized === "true") return;

  workSection.dataset.homeInitialized = "true";

  const syncTrack = syncRoot.querySelector('[data-home-sync-track]');
  const syncTexts = Array.from(syncRoot.querySelectorAll('[data-home-sync-text]'));
  const yearStartEl = syncRoot.querySelector('[data-home-year-start-display]');
  const yearSeparatorEl = syncRoot.querySelector('[data-home-year-separator]');
  const yearEndEl = syncRoot.querySelector('[data-home-year-end-display]');
  const quantityValueEl = syncRoot.querySelector('[data-home-quantity-display]');

  const normalize = (value) => (value || "").trim().toLowerCase();
  const formatTwoDigits = (value) => String(value).padStart(2, "0");
  const refreshRuntime = () => {
    window.lenis?.start?.();
    window.lenis?.resize?.();
    window.ScrollTrigger?.refresh?.();
  };

  const refreshTimeoutIds = [];
  const scheduleRuntimeRefresh = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(refreshRuntime);
    });

    refreshTimeoutIds.push(window.setTimeout(refreshRuntime, 120));
    refreshTimeoutIds.push(window.setTimeout(refreshRuntime, 360));
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

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const unlockThreshold = 0.7;
  const wheelThreshold = 12;
  const touchThreshold = 40;
  const idleScale = 1.22;
  const idleOffset = 8;
  const travelOffset = 6;

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

  function syncTextById(id) {
    if (!syncTrack || !textMap.size || !textItemHeight) return;
    const index = textMap.get(normalize(id));
    if (typeof index !== "number") return;
    syncTrack.style.transform = `translate3d(0, -${index * textItemHeight}px, 0)`;
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
    if (!currentTimeline || !currentTimeline.isActive()) return false;
    if (currentTimeline.progress() < unlockThreshold) return true;

    currentTimeline.kill();

    if (currentIncomingIndex !== null) {
      settleOnSlide(currentIncomingIndex);
    }

    currentTimeline = null;
    currentIncomingIndex = null;
    return false;
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
    syncTextById(incomingSlide.id);
    syncMeta(incomingSlide.id);

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
  }

  const onResize = () => {
    measureTextTrack();
    const activeId = slides[activeIndex]?.id;
    syncTextById(activeId);
    syncMeta(activeId);
  };

  const onWheel = (event) => {
    event.preventDefault();
    if (Math.abs(event.deltaY) < wheelThreshold) return;
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
    if (!event.cancelable) return;
    event.preventDefault();
  };

  measureTextTrack();
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
  }

  workSection.addEventListener("touchmove", preventNativeScroll, { passive: false });

  window.Sonia.destroyHome = function () {
    window.removeEventListener("resize", onResize);

    if (!prefersReducedMotion) {
      workSection.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeydown);
      workSection.removeEventListener("touchstart", onTouchStart);
      workSection.removeEventListener("touchend", onTouchEnd);
    }

    workSection.removeEventListener("touchmove", preventNativeScroll);

    if (currentTimeline) {
      currentTimeline.kill();
      currentTimeline = null;
    }

    imageLoadHandlers.forEach(({ image, onImageLoad }) => {
      image.removeEventListener("load", onImageLoad);
    });

    refreshTimeoutIds.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    workSection.dataset.homeInitialized = "false";
  };

};
