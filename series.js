window.Sonia = window.Sonia || {};

window.Sonia.initSeries = function () {
  const hasSeriesPage =
    document.querySelector('[data-sync="series-gallery"]') ||
    document.querySelector('[data-series-next-trigger]') ||
    document.querySelector('[data-series-layout="next"]');

  if (!hasSeriesPage) return;
  if (window.Sonia._seriesInitialized === true) return;
  window.Sonia._seriesInitialized = true;

  const cleanupFns = [];
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

  const root = document.querySelector('[data-sync="series-gallery"]');

  if (root && root.dataset.seriesGalleryInitialized !== "true") {
    root.dataset.seriesGalleryInitialized = "true";

    const track = root.querySelector('[data-sync-track]');
    const texts = Array.from(root.querySelectorAll('[data-sync-text]'));
    const images = Array.from(document.querySelectorAll('[data-sync-image]'));
    const mediaImages = Array.from(
      document.querySelectorAll('[data-sync-image] img, .serie-slider__img')
    );
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

      const imageLoadHandlers = mediaImages
        .map((image) => {
          if (image.complete) return null;

          const onImageLoad = () => {
            measure();
            requestUpdate();
            scheduleRuntimeRefresh();
          };

          image.addEventListener("load", onImageLoad);
          return { image, onImageLoad };
        })
        .filter(Boolean);

      measure();
      requestUpdate();
      scheduleRuntimeRefresh();

      window.addEventListener("load", onLoad);
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onScroll, { passive: true });

      cleanupFns.push(() => {
        window.removeEventListener("load", onLoad);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onScroll);
        imageLoadHandlers.forEach(({ image, onImageLoad }) => {
          image.removeEventListener("load", onImageLoad);
        });
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

  if (trigger && nextLink) {
    let isNavigatingToNextSeries = false;
    let nextSeriesObserver = null;

    const goToNextSeries = () => {
      if (isNavigatingToNextSeries) return;

      const nextHref = nextLink.href;
      if (!nextHref) return;

      const nextUrl = new URL(nextHref, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return;
      }

      isNavigatingToNextSeries = true;

      if (window.barba?.go) {
        window.barba.go(nextHref);
        return;
      }

      window.location.href = nextHref;
    };

    const onNextLinkClick = (event) => {
      event.preventDefault();
      goToNextSeries();
    };

    const onTriggerClick = (event) => {
      if (event.target.closest(".serie-slider__link")) return;
      event.preventDefault();
      goToNextSeries();
    };

    nextLink.addEventListener("click", onNextLinkClick);
    trigger.addEventListener("click", onTriggerClick);

    if ("IntersectionObserver" in window) {
      nextSeriesObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.isIntersecting) return;
          if (entry.intersectionRatio < 0.98) return;
          goToNextSeries();
        },
        {
          threshold: [0.98, 1]
        }
      );

      nextSeriesObserver.observe(trigger);
    }

    cleanupFns.push(() => {
      nextLink.removeEventListener("click", onNextLinkClick);
      trigger.removeEventListener("click", onTriggerClick);
      nextSeriesObserver?.disconnect();
    });
  }

  cleanupFns.push(() => {
    refreshTimeoutIds.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
  });

  window.Sonia._seriesCleanup = cleanupFns;
};

window.Sonia.destroySeries = function () {
  const cleanupFns = window.Sonia._seriesCleanup || [];
  cleanupFns.forEach((fn) => {
    if (typeof fn === "function") fn();
  });
  window.Sonia._seriesCleanup = [];
  window.Sonia._seriesInitialized = false;
};
