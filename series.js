window.Sonia = window.Sonia || {};

window.Sonia.initSeries = function () {
  if (window.Sonia._seriesInitialized === true) return;
  window.Sonia._seriesInitialized = true;

  const cleanupFns = [];
  const normalize = (value) => (value || "").trim().toLowerCase();
  const formatTwoDigits = (value) => String(value).padStart(2, "0");

  const root = document.querySelector('[data-sync="series-gallery"]');

  if (root && root.dataset.seriesGalleryInitialized !== "true") {
    root.dataset.seriesGalleryInitialized = "true";

    const track = root.querySelector('[data-sync-track]');
    const texts = Array.from(root.querySelectorAll('[data-sync-text]'));
    const images = Array.from(document.querySelectorAll('[data-sync-image]'));
    const currentEl = root.querySelector('[data-sync-current]');
    const totalEl = root.querySelector('[data-sync-total]');

    if (track && texts.length && images.length) {
      const textMap = new Map();
      texts.forEach((item, index) => {
        textMap.set(normalize(item.getAttribute("data-sync-id")), index);
      });

      if (totalEl) {
        totalEl.textContent = formatTwoDigits(texts.length);
      }

      let activeIndex = -1;
      let itemHeight = 0;
      let ticking = false;

      const measure = () => {
        itemHeight = texts[0].getBoundingClientRect().height;
      };

      const setActiveIndex = (index) => {
        if (index < 0 || index >= texts.length) return;
        if (index === activeIndex) return;

        activeIndex = index;
        track.style.transform = `translate3d(0, -${index * itemHeight}px, 0)`;

        if (currentEl) {
          currentEl.textContent = formatTwoDigits(index + 1);
        }
      };

      const getClosestImage = () => {
        const viewportCenter = window.innerHeight * 0.5;
        let closestImage = null;
        let closestDistance = Infinity;

        images.forEach((image) => {
          const rect = image.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const distance = Math.abs(center - viewportCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestImage = image;
          }
        });

        return closestImage;
      };

      const update = () => {
        ticking = false;

        const closestImage = getClosestImage();
        if (!closestImage) return;

        const id = normalize(closestImage.getAttribute("data-sync-id"));
        const matchedIndex = textMap.get(id);

        if (typeof matchedIndex === "number") {
          setActiveIndex(matchedIndex);
        }
      };

      const requestUpdate = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      };

      const onLoad = () => {
        measure();
        requestUpdate();
      };

      const onResize = () => {
        measure();
        requestUpdate();
      };

      const onScroll = () => {
        requestUpdate();
      };

      measure();
      requestUpdate();

      window.addEventListener("load", onLoad);
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onScroll, { passive: true });

      cleanupFns.push(() => {
        window.removeEventListener("load", onLoad);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onScroll);
        root.dataset.seriesGalleryInitialized = "false";
      });
    }
  }

  const nextLayout = document.querySelector('[data-series-layout="next"]');
  const trigger = document.querySelector('[data-series-next-trigger]');

  if (
    trigger &&
    nextLayout &&
    nextLayout.dataset.seriesMaskInitialized !== "true"
  ) {
    nextLayout.dataset.seriesMaskInitialized = "true";

    const nextMask = nextLayout.querySelector(".series-layout__mask");

    if (nextMask) {
      let ticking = false;

      const updateNextMask = () => {
        ticking = false;

        const triggerTop = trigger.getBoundingClientRect().top;
        const clipTop = Math.max(0, Math.min(window.innerHeight, triggerTop));

        nextMask.style.clipPath = `inset(${clipTop}px 0 0 0)`;
      };

      const requestUpdate = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateNextMask);
      };

      updateNextMask();

      window.addEventListener("load", requestUpdate);
      window.addEventListener("resize", requestUpdate);
      window.addEventListener("scroll", requestUpdate, { passive: true });

      cleanupFns.push(() => {
        window.removeEventListener("load", requestUpdate);
        window.removeEventListener("resize", requestUpdate);
        window.removeEventListener("scroll", requestUpdate);
        nextLayout.dataset.seriesMaskInitialized = "false";
      });
    }
  }

  const nextLink = document.querySelector(".serie-slider__link");

  if (
    nextLink &&
    nextLayout &&
    nextLayout.dataset.seriesMetaInitialized !== "true"
  ) {
    nextLayout.dataset.seriesMetaInitialized = "true";

    const titleEl = nextLayout.querySelector("[data-next-series-title]");
    const yearStartEl = nextLayout.querySelector("[data-next-series-year-start]");
    const yearSeparatorEl = nextLayout.querySelector("[data-next-series-year-separator]");
    const yearEndEl = nextLayout.querySelector("[data-next-series-year-end]");
    const quantityEl = nextLayout.querySelector("[data-next-series-quantity]");

    const nextSeriesTitle = nextLink.getAttribute("data-next-series-title-source") || "";
    const nextSeriesSlug = normalize(nextLink.getAttribute("data-next-series-slug-source"));

    if (titleEl) {
      titleEl.textContent = nextSeriesTitle;
    }

    const seriesMeta = new Map();
    const metaEntries = Array.from(document.querySelectorAll("[data-series-meta-entry]"));

    metaEntries.forEach((entry) => {
      const slug = normalize(entry.getAttribute("data-series-meta-slug"));
      const rawYear = (entry.getAttribute("data-series-meta-year") || "").trim();

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

    const meta = seriesMeta.get(nextSeriesSlug);
    const hasQuantity = meta && meta.count > 0;
    const hasYears =
      meta &&
      Number.isFinite(meta.minYear) &&
      Number.isFinite(meta.maxYear);

    if (quantityEl) {
      quantityEl.textContent = hasQuantity ? formatTwoDigits(meta.count) : "00";
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
    } else {
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

    cleanupFns.push(() => {
      nextLayout.dataset.seriesMetaInitialized = "false";
    });
  }

  const loader = document.querySelector(".serie-next__loader");
  const signature = loader?.querySelector('[data-element="signature"]');
  const paths = signature ? Array.from(signature.querySelectorAll(".mask path")) : [];

  if (
    trigger &&
    nextLink &&
    loader &&
    signature &&
    paths.length &&
    typeof window.gsap !== "undefined" &&
    trigger.dataset.seriesLoaderInitialized !== "true"
  ) {
    trigger.dataset.seriesLoaderInitialized = "true";

    const { gsap } = window;
    const POSITION_TOLERANCE = 2;

    let hasRedirected = false;
    let animationStarted = false;
    let ticking = false;
    let loaderTimeline = null;

    const isLoaderFullyVisible = () => {
      const rect = loader.getBoundingClientRect();

      const fullyVisibleVertically =
        rect.top >= -POSITION_TOLERANCE &&
        rect.bottom <= window.innerHeight + POSITION_TOLERANCE;

      const fullyVisibleHorizontally =
        rect.left >= -POSITION_TOLERANCE &&
        rect.right <= window.innerWidth + POSITION_TOLERANCE;

      return fullyVisibleVertically && fullyVisibleHorizontally;
    };

    const getOrderedPaths = () => {
      return [...paths].sort((a, b) => a.getBBox().x - b.getBBox().x);
    };

    const preparePaths = () => {
      paths.forEach((path) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = `${length}`;
      });
    };

    const hideLoader = () => {
      gsap.set(loader, { autoAlpha: 0 });
      gsap.set(signature, { autoAlpha: 0 });
    };

    const showLoader = () => {
      gsap.set(loader, { autoAlpha: 1 });
      gsap.set(signature, { autoAlpha: 1 });
    };

    const resetLoader = () => {
      if (loaderTimeline) {
        loaderTimeline.kill();
        loaderTimeline = null;
      }

      animationStarted = false;
      preparePaths();
      hideLoader();
    };

    const hardResetState = () => {
      hasRedirected = false;
      resetLoader();
    };

    const startLoaderAnimation = () => {
      if (animationStarted || hasRedirected) return;

      animationStarted = true;
      showLoader();
      preparePaths();

      const orderedPaths = getOrderedPaths();
      const totalDuration = 2.4;
      const endDelay = 0.3;
      const pathDuration = totalDuration / orderedPaths.length;

      loaderTimeline = gsap.timeline({
        onComplete: () => {
          hasRedirected = true;
          window.location.href = nextLink.href;
        }
      });

      orderedPaths.forEach((path, index) => {
        loaderTimeline.to(path, {
          strokeDashoffset: 0,
          duration: pathDuration,
          ease: "none"
        }, index * pathDuration);
      });

      loaderTimeline.to({}, {
        duration: endDelay
      });
    };

    const updateLoaderState = () => {
      ticking = false;

      if (hasRedirected) return;

      if (isLoaderFullyVisible()) {
        startLoaderAnimation();
      } else {
        resetLoader();
      }
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateLoaderState);
    };

    hideLoader();
    preparePaths();
    requestUpdate();

    const onResize = () => requestUpdate();
    const onScroll = () => requestUpdate();
    const onLoad = () => requestUpdate();
    const onPageShow = () => {
      hardResetState();
      requestUpdate();
    };

    window.addEventListener("load", onLoad);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pageshow", onPageShow);

    cleanupFns.push(() => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pageshow", onPageShow);

      if (loaderTimeline) {
        loaderTimeline.kill();
      }

      trigger.dataset.seriesLoaderInitialized = "false";
    });
  }

  window.Sonia._seriesCleanup = cleanupFns;

  console.log("series real loaded");
};

window.Sonia.destroySeries = function () {
  const cleanupFns = window.Sonia._seriesCleanup || [];
  cleanupFns.forEach((fn) => {
    if (typeof fn === "function") fn();
  });
  window.Sonia._seriesCleanup = [];
  window.Sonia._seriesInitialized = false;
};

if (
  document.querySelector('[data-sync="series-gallery"]') ||
  document.querySelector('[data-series-next-trigger]') ||
  document.querySelector('[data-series-layout="next"]')
) {
  window.Sonia.initSeries();
}
