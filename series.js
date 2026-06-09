window.Sonia = window.Sonia || {};

window.Sonia.initSeries = function () {
  const seriesContainers = Array.from(
    document.querySelectorAll('[data-barba="container"][data-barba-namespace="series"]')
  );
  const pageRoot = seriesContainers.at(-1) || document;
  const hasSeriesPage =
    pageRoot.querySelector('[data-sync="series-gallery"]') ||
    pageRoot.querySelector('[data-series-next-trigger]') ||
    pageRoot.querySelector('[data-series-layout="next"]');

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

  const scheduleRuntimeRefresh = () => {
    if (document.body.dataset.barbaTransition === "active") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(refreshRuntime);
    });
  };

  const root = pageRoot.querySelector('[data-sync="series-gallery"]');

  if (root && root.dataset.seriesGalleryInitialized !== "true") {
    root.dataset.seriesGalleryInitialized = "true";

    const track = root.querySelector('[data-sync-track]');
    const viewport = track?.parentElement || null;
    const texts = Array.from(root.querySelectorAll('[data-sync-text]'));
    const images = Array.from(pageRoot.querySelectorAll('[data-sync-image]'));
    const mediaImages = Array.from(
      pageRoot.querySelectorAll('[data-sync-image] img, .serie-slider__img')
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
      let textOverlay = null;
      let activeTextNode = null;
      let textTimeline = null;
      const parallaxMaxOffset = 6;

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

      const measure = () => {
        itemHeight = texts[0].getBoundingClientRect().height;
      };

      const ensureTextOverlay = () => {
        if (!viewport) return null;
        if (textOverlay?.isConnected) return textOverlay;

        textOverlay = document.createElement("div");
        textOverlay.setAttribute("data-series-sync-overlay", "");

        gsap.set(viewport, { position: "relative" });
        gsap.set(textOverlay, {
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none"
        });

        viewport.appendChild(textOverlay);
        gsap.set(track, { autoAlpha: 0 });

        return textOverlay;
      };

      const createTextNode = (index) => {
        const source = texts[index];
        const overlay = ensureTextOverlay();

        if (!source || !overlay) return null;

        const clone = source.cloneNode(true);
        clone.removeAttribute("data-sync-text");

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
      };

      const setStaticText = (index) => {
        const overlay = ensureTextOverlay();
        const node = createTextNode(index);

        if (!overlay || !node) return;

        textTimeline?.kill();
        overlay.replaceChildren(node);
        activeTextNode = node;
      };

      const animateTextToIndex = (index, direction) => {
        const overlay = ensureTextOverlay();
        const outgoingNode = activeTextNode || createTextNode(activeIndex);
        const incomingNode = createTextNode(index);
        const incomingFromTop = direction < 0;

        if (!overlay || !outgoingNode || !incomingNode) return;

        textTimeline?.kill();

        if (!outgoingNode.isConnected) {
          overlay.appendChild(outgoingNode);
        }

        overlay.appendChild(incomingNode);
        activeTextNode = incomingNode;

        gsap.set(outgoingNode, {
          yPercent: 0,
          clipPath: "inset(0% 0% 0% 0%)"
        });

        gsap.set(incomingNode, {
          yPercent: incomingFromTop ? -100 : 100,
          clipPath: incomingFromTop
            ? "inset(0% 0% 100% 0%)"
            : "inset(100% 0% 0% 0%)"
        });

        textTimeline = gsap.timeline({
          defaults: {
            duration: 0.9,
            ease: "power4.inOut"
          },
          onComplete: () => {
            overlay.replaceChildren(incomingNode);
            activeTextNode = incomingNode;
            textTimeline = null;
          }
        });

        textTimeline.to(outgoingNode, {
          yPercent: incomingFromTop ? 100 : -100,
          clipPath: incomingFromTop
            ? "inset(100% 0% 0% 0%)"
            : "inset(0% 0% 100% 0%)"
        }, 0);

        textTimeline.to(incomingNode, {
          yPercent: 0,
          clipPath: "inset(0% 0% 0% 0%)"
        }, 0);
      };

      const setActiveIndex = (index, { immediate = false } = {}) => {
        if (index < 0 || index >= texts.length) return;
        if (index === activeIndex && !immediate) return;

        const previousIndex = activeIndex;
        activeIndex = index;

        if (previousIndex === -1 || immediate) {
          setStaticText(index);
        } else {
          animateTextToIndex(index, index > previousIndex ? 1 : -1);
        }

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
        const viewportCenter = window.innerHeight * 0.5;

        mediaImages.forEach((image) => {
          const rect = image.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const normalizedDistance = (center - viewportCenter) / window.innerHeight;
          const offset = clamp(normalizedDistance * -parallaxMaxOffset, -parallaxMaxOffset, parallaxMaxOffset);
          gsap.set(image, { yPercent: offset });
        });

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
        setActiveIndex(activeIndex, { immediate: true });
        requestUpdate();
      };

      const onResize = () => {
        measure();
        setActiveIndex(activeIndex, { immediate: true });
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
        textTimeline?.kill();
        textOverlay?.remove();
        gsap.set(mediaImages, { clearProps: "transform" });
        gsap.set(track, { clearProps: "opacity,visibility" });
        imageLoadHandlers.forEach(({ image, onImageLoad }) => {
          image.removeEventListener("load", onImageLoad);
        });
        root.dataset.seriesGalleryInitialized = "false";
      });
    }
  }

  const nextLayout = pageRoot.querySelector('[data-series-layout="next"]');
  const trigger = pageRoot.querySelector('[data-series-next-trigger]');

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

  const nextLink = pageRoot.querySelector(".serie-slider__link");

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
    const metaEntries = Array.from(pageRoot.querySelectorAll("[data-series-meta-entry]"));

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
    let nextSeriesTimeline = null;
    let isNextSeriesPrimed = false;
    let autoNextArmed = false;
    const initialScrollY = window.scrollY;
    const nextSeriesLoader = pageRoot.querySelector(".serie-next__loader");
    const nextSeriesSignature = nextSeriesLoader?.querySelector('[data-element="signature"]');
    const nextSeriesPaths = nextSeriesSignature
      ? Array.from(nextSeriesSignature.querySelectorAll(".mask path")).sort(
          (a, b) => a.getBBox().x - b.getBBox().x
        )
      : [];

    const prepareNextSeriesPaths = () => {
      nextSeriesPaths.forEach((path) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = `${length}`;
      });
    };

    const hideNextSeriesLoader = () => {
      if (!nextSeriesLoader || !nextSeriesSignature) return;
      gsap.set(nextSeriesLoader, { autoAlpha: 0 });
      gsap.set(nextSeriesSignature, { autoAlpha: 0 });
    };

    const showNextSeriesLoader = () => {
      if (!nextSeriesLoader || !nextSeriesSignature) return;
      gsap.set(nextSeriesLoader, { autoAlpha: 1 });
      gsap.set(nextSeriesSignature, { autoAlpha: 1 });
    };

    const animateNextSeriesThenNavigate = () => {
      if (document.body.dataset.barbaTransition === "active") return;
      if (isNavigatingToNextSeries) return;

      if (!nextSeriesLoader || !nextSeriesSignature || !nextSeriesPaths.length) {
        goToNextSeries();
        return;
      }

      if (nextSeriesTimeline) {
        nextSeriesTimeline.kill();
      }

      showNextSeriesLoader();
      prepareNextSeriesPaths();

      const totalDuration = 1.8;
      const orderedPaths = [...nextSeriesPaths];
      const pathDuration = totalDuration / orderedPaths.length;

      nextSeriesTimeline = gsap.timeline({
        onComplete: () => {
          goToNextSeries();
        }
      });

      orderedPaths.forEach((path, index) => {
        nextSeriesTimeline.to(path, {
          strokeDashoffset: 0,
          duration: pathDuration,
          ease: "none"
        }, index * pathDuration);
      });
    };

    const cancelNextSeriesAnimation = () => {
      if (isNavigatingToNextSeries) return;

      if (nextSeriesTimeline) {
        nextSeriesTimeline.kill();
        nextSeriesTimeline = null;
      }

      hideNextSeriesLoader();
      prepareNextSeriesPaths();
    };

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
      animateNextSeriesThenNavigate();
    };

    const onTriggerClick = (event) => {
      if (event.target.closest(".serie-slider__link")) return;
      event.preventDefault();
      animateNextSeriesThenNavigate();
    };

    nextLink.addEventListener("click", onNextLinkClick);
    trigger.addEventListener("click", onTriggerClick);

    const onNextSeriesScroll = () => {
      if (document.body.dataset.barbaTransition === "active") return;

      if (!autoNextArmed) {
        if (Math.abs(window.scrollY - initialScrollY) <= 8) return;
        autoNextArmed = true;
      }

      const scrollBottom = window.scrollY + window.innerHeight;
      const documentBottom = document.documentElement.scrollHeight;
      const isAtBottom = scrollBottom >= documentBottom - 24;

      if (isAtBottom && !isNextSeriesPrimed) {
        isNextSeriesPrimed = true;
        animateNextSeriesThenNavigate();
        return;
      }

      if (!isAtBottom && isNextSeriesPrimed) {
        isNextSeriesPrimed = false;
        cancelNextSeriesAnimation();
      }
    };

    window.addEventListener("scroll", onNextSeriesScroll, { passive: true });

    hideNextSeriesLoader();
    prepareNextSeriesPaths();

    if (document.body.dataset.barbaTransition !== "active") {
      onNextSeriesScroll();
    }

    cleanupFns.push(() => {
      nextLink.removeEventListener("click", onNextLinkClick);
      trigger.removeEventListener("click", onTriggerClick);
      window.removeEventListener("scroll", onNextSeriesScroll);
      nextSeriesTimeline?.kill();
    });
  }
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
