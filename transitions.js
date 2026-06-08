
  window.lenis = window.lenis || new Lenis({
    autoRaf: true
  });

  history.scrollRestoration = "manual";
  window.barba = window.barba || barba;

  const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  let loaderCoverPromise = Promise.resolve();
  let loaderMiddlePromise = Promise.resolve();
  let cachedLoaderEls = null;
  let cachedSignaturePaths = null;

  function getLoaderEls() {
    if (cachedLoaderEls?.root?.isConnected) {
      return cachedLoaderEls;
    }

    cachedLoaderEls = {
      root: document.querySelector(".loader-container"),
      bg: document.querySelector(".loader-background"),
      wrap: document.querySelector(".loader-wrapper"),
      signatureWrap: document.querySelector(".loader-signature-svg-wrapper"),
      progressWrap: document.querySelector(".loader-progress-wrapper"),
      progress: document.querySelector('[data-element="progress"]'),
      signature: document.querySelector('[data-element="signature"]')
    };

    cachedSignaturePaths = null;
    return cachedLoaderEls;
  }

  function getSignaturePaths() {
    const { signature } = getLoaderEls();
    if (!signature) return [];

    if (cachedSignaturePaths?.length && cachedSignaturePaths.every((path) => path.isConnected)) {
      return cachedSignaturePaths;
    }

    cachedSignaturePaths = Array.from(signature.querySelectorAll("path")).sort(
      (a, b) => a.getBBox().x - b.getBBox().x
    );

    return cachedSignaturePaths;
  }

  function formatProgress(value) {
    const rounded = Math.round(value);
    if (rounded >= 100) return "100%";
    return `${String(rounded).padStart(2, "0")}%`;
  }

  function setProgress(value) {
    const { progress } = getLoaderEls();
    if (!progress) return;
    progress.textContent = formatProgress(value);
  }

  function prepareSignaturePaths() {
    const paths = getSignaturePaths();

    paths.forEach((path) => {
      const stroke = path.dataset.originalStroke || path.getAttribute("stroke") || "black";
      const width = path.dataset.originalStrokeWidth || path.getAttribute("stroke-width") || "1";
      const length = path.getTotalLength();

      path.dataset.originalStroke = stroke;
      path.dataset.originalStrokeWidth = width;
      path.dataset.pathLength = String(length);

      path.style.fill = "none";
      path.style.stroke = stroke;
      path.style.strokeWidth = width;
      path.style.strokeLinecap = path.getAttribute("stroke-linecap") || "round";
      path.style.strokeLinejoin = path.getAttribute("stroke-linejoin") || "round";
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.strokeOpacity = "1";
    });
  }

  function finalizeSignaturePaths() {
    const paths = getSignaturePaths();

    paths.forEach((path) => {
      path.style.fill = "none";
      path.style.stroke = path.dataset.originalStroke || path.getAttribute("stroke") || "black";
      path.style.strokeWidth = path.dataset.originalStrokeWidth || path.getAttribute("stroke-width") || "1";
      path.style.strokeDashoffset = "0";
      path.style.strokeOpacity = "1";
    });
  }

  function waitFrames(count = 2) {
    return new Promise((resolve) => {
      const step = () => {
        if (count <= 0) return resolve();
        count -= 1;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function forceImageEagerLoad(img) {
    const src = img.getAttribute("src") || "";
    const srcset = img.getAttribute("srcset") || "";
    const sizes = img.getAttribute("sizes") || "";

    img.removeAttribute("loading");
    img.loading = "eager";
    img.decoding = "async";
    img.fetchPriority = "high";

    if (sizes) img.sizes = sizes;
    if (srcset) img.srcset = srcset;
    if (src) img.src = src;
  }

  function waitForActualImagePaint(img) {
    forceImageEagerLoad(img);

    return new Promise((resolve) => {
      const finish = () => {
        if (img.decode) {
          img.decode().catch(() => {}).finally(resolve);
        } else {
          resolve();
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        finish();
        return;
      }

      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }

  function waitForContainerImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    if (!images.length) return Promise.resolve();
    return Promise.all(images.map(waitForActualImagePaint));
  }

  function waitForVisualStability(container, options = {}) {
    const quietMs = options.quietMs ?? 350;
    const timeoutMs = options.timeoutMs ?? 7000;

    return new Promise((resolve) => {
      let settled = false;
      let quietTimer = null;
      let timeoutTimer = null;
      let runId = 0;

      const finish = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        if (quietTimer) window.clearTimeout(quietTimer);
        if (timeoutTimer) window.clearTimeout(timeoutTimer);
        resolve();
      };

      const scheduleQuietCheck = () => {
        if (quietTimer) window.clearTimeout(quietTimer);

        quietTimer = window.setTimeout(async () => {
          const currentRun = ++runId;

          await waitForContainerImages(container);
          await waitFrames(2);

          if (settled) return;
          if (currentRun !== runId) return;

          finish();
        }, quietMs);
      };

      const observer = new MutationObserver(() => {
        scheduleQuietCheck();
      });

      observer.observe(container, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "sizes", "style", "class"]
      });

      timeoutTimer = window.setTimeout(finish, timeoutMs);
      scheduleQuietCheck();
    });
  }

  function lockPageScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function refreshRuntime() {
    window.lenis?.start?.();
    window.lenis?.resize?.();
    window.dispatchEvent(new Event("resize"));

    if (hasScrollTrigger) {
      ScrollTrigger.refresh();
    }
  }

  function initPageByNamespace(namespace) {
    if (namespace === "home") window.Sonia?.initHome?.();
    if (namespace === "series") window.Sonia?.initSeries?.();
    if (namespace === "oeuvres") window.Sonia?.initOeuvres?.();
    if (namespace === "tattoo") window.Sonia?.initTattoo?.();
  }

  function destroyPageByNamespace(namespace) {
    if (namespace === "home") window.Sonia?.destroyHome?.();
    if (namespace === "series") window.Sonia?.destroySeries?.();
    if (namespace === "oeuvres") window.Sonia?.destroyOeuvres?.();
    if (namespace === "tattoo") window.Sonia?.destroyTattoo?.();
  }

  function resetPage(container) {
    gsap.set(container, {
      clearProps: "position,top,left,right,width,height,zIndex,visibility,opacity,pointerEvents"
    });

    refreshRuntime();
  }

  function setLoaderIdle() {
    const { root, bg, wrap, signatureWrap, progressWrap } = getLoaderEls();
    if (!root || !bg || !wrap || !signatureWrap || !progressWrap) return;

    gsap.killTweensOf([bg, wrap, progressWrap]);
    gsap.killTweensOf(getSignaturePaths());

    gsap.set(root, {
      visibility: "hidden",
      pointerEvents: "none"
    });

    gsap.set(bg, {
      yPercent: 101
    });

    gsap.set(wrap, {
      clipPath: "inset(100% 0% 0% 0%)"
    });

    gsap.set(signatureWrap, {
      clipPath: "inset(0% 0% 0% 0%)"
    });

    gsap.set(progressWrap, {
      opacity: 1,
      yPercent: 0
    });

    prepareSignaturePaths();
    setProgress(0);
  }

  function setLoaderCovered() {
    const { root, bg, wrap, signatureWrap, progressWrap } = getLoaderEls();
    if (!root || !bg || !wrap || !signatureWrap || !progressWrap) return;

    gsap.killTweensOf([bg, wrap, progressWrap]);
    gsap.killTweensOf(getSignaturePaths());

    gsap.set(root, {
      visibility: "visible",
      pointerEvents: "none"
    });

    gsap.set(bg, {
      yPercent: 0
    });

    gsap.set(wrap, {
      clipPath: "inset(0% 0% 0% 0%)"
    });

    gsap.set(signatureWrap, {
      clipPath: "inset(0% 0% 0% 0%)"
    });

    gsap.set(progressWrap, {
      opacity: 1,
      yPercent: 0
    });

    prepareSignaturePaths();
    setProgress(0);
  }

  function runLoaderCover() {
    const { root, bg, wrap, signatureWrap } = getLoaderEls();

    if (!root || !bg || !wrap || !signatureWrap) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      gsap.timeline({
        onStart: () => {
          gsap.set(root, {
            visibility: "visible",
            pointerEvents: "none"
          });

          gsap.set(signatureWrap, {
            clipPath: "inset(0% 0% 0% 0%)"
          });

          prepareSignaturePaths();
          setProgress(0);
        },
        onComplete: () => {
          requestAnimationFrame(resolve);
        }
      })
      .to(bg, {
        yPercent: 0,
        duration: 0.95,
        ease: "power4.inOut"
      }, 0)
      .to(wrap, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 0.95,
        ease: "power4.inOut"
      }, 0);
    });
  }

  function runLoaderMiddle() {
    const paths = getSignaturePaths();
    const progressState = { value: 0 };
    const drawDuration = 1.8;

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          finalizeSignaturePaths();
          requestAnimationFrame(resolve);
        }
      });

      if (paths.length) {
        const pathDuration = drawDuration / paths.length;

        paths.forEach((path, index) => {
          tl.to(path, {
            strokeDashoffset: 0,
            duration: pathDuration,
            ease: "none"
          }, index * pathDuration);
        });
      }

      tl.to(progressState, {
        value: 57,
        duration: 0.42,
        ease: "power2.out",
        onUpdate: () => setProgress(progressState.value)
      }, 0);

      tl.to(progressState, {
        value: 82,
        duration: 0.68,
        ease: "power1.out",
        onUpdate: () => setProgress(progressState.value)
      }, 0.42);

      tl.to(progressState, {
        value: 100,
        duration: 0.70,
        ease: "expo.out",
        onUpdate: () => setProgress(progressState.value)
      }, 1.10);
    });
  }

  function runLoaderOut() {
    const { bg, wrap } = getLoaderEls();
    if (!bg || !wrap) return Promise.resolve();

    return new Promise((resolve) => {
      gsap.timeline({
        onComplete: () => {
          setLoaderIdle();
          resolve();
        }
      })
      .to(bg, {
        yPercent: 101,
        duration: 0.9,
        ease: "power4.inOut"
      }, 0)
      .to(wrap, {
        clipPath: "inset(100% 0% 0% 0%)",
        duration: 0.9,
        ease: "power4.inOut"
      }, 0);
    });
  }

  setLoaderIdle();

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    setLoaderIdle();
  });

  barba.hooks.beforeEnter((data) => {
    gsap.set(data.next.container, {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      width: "100%",
      minHeight: "100vh",
      zIndex: 1,
      visibility: "hidden",
      opacity: 0,
      pointerEvents: "none"
    });
  });

  barba.init({
    debug: false,
    timeout: 7000,
    preventRunning: true,
    transitions: [
      {
        name: "loader",
        sync: true,

        async once(data) {
          lockPageScroll();
          document.body.dataset.barbaTransition = "active";

          setLoaderCovered();

          gsap.set(data.next.container, {
            visibility: "hidden",
            opacity: 0,
            pointerEvents: "none"
          });

          await waitFrames(1);

          initPageByNamespace(data.next.namespace);

          await waitFrames(1);
          await waitForVisualStability(data.next.container);

          refreshRuntime();
          await waitFrames(2);

          window.scrollTo(0, 0);

          gsap.set(data.next.container, {
            visibility: "visible",
            opacity: 1,
            pointerEvents: "none"
          });

          await runLoaderMiddle();
          await runLoaderOut();

          delete document.body.dataset.barbaTransition;
          unlockPageScroll();
          resetPage(data.next.container);
        },

        async leave(data) {
          lockPageScroll();
          document.body.dataset.barbaTransition = "active";

          data.current.container.style.pointerEvents = "none";
          destroyPageByNamespace(data.current.namespace);

          if (hasScrollTrigger) {
            ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
          }

          loaderCoverPromise = runLoaderCover().then(() => {
            data.current.container.style.visibility = "hidden";
          });

          loaderMiddlePromise = loaderCoverPromise.then(() => runLoaderMiddle());

          return loaderCoverPromise;
        },

        async enter(data) {
          await loaderCoverPromise;

          gsap.set(data.next.container, {
            visibility: "visible",
            opacity: 1,
            pointerEvents: "none"
          });

          initPageByNamespace(data.next.namespace);

          await waitFrames(1);
          await waitForVisualStability(data.next.container);

          refreshRuntime();
          await waitFrames(2);

          window.scrollTo(0, 0);

          await loaderMiddlePromise;
          await runLoaderOut();

          delete document.body.dataset.barbaTransition;
          unlockPageScroll();
          resetPage(data.next.container);
        }
      }
    ]
  });
