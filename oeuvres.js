window.Sonia = window.Sonia || {};

window.Sonia.initOeuvres = function () {
  if (typeof gsap === "undefined") return;

  const oeuvresContainers = Array.from(
    document.querySelectorAll('[data-barba="container"][data-barba-namespace="oeuvres"]')
  );
  const pageRoot = oeuvresContainers.at(-1) || document;
  const sections = Array.from(pageRoot.querySelectorAll(".product-reco__section"));
  if (!sections.length) return;

  const instances = [];

  sections.forEach((section) => {
    if (section.dataset.recoSliderInitialized === "true") return;

    const viewport = section.querySelector(".product-reco__slider");
    const track = section.querySelector(".poster-reco__slider");
    const links = Array.from(section.querySelectorAll(".poster__link"));
    const items = Array.from(section.querySelectorAll(".poster-reco__wrapper"));

    if (!viewport || !track) return;

    section.dataset.recoSliderInitialized = "true";

    const yearStartEl = section.querySelector("[data-reco-year-start-display]");
    const yearSeparatorEl = section.querySelector("[data-reco-year-separator]");
    const yearEndEl = section.querySelector("[data-reco-year-end-display]");
    const quantityEl = section.querySelector("[data-reco-quantity-display]");

    let currentX = 0;
    let targetX = 0;
    let velocityX = 0;
    let minX = 0;
    let maxX = 0;

    let isPointerDown = false;
    let hasDragged = false;
    let dragDistance = 0;
    let startPointerX = 0;
    let startTargetX = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;
    let releaseTimeout = null;
    let resizeObserver = null;

    const clamp = (value) => Math.max(minX, Math.min(maxX, value));
    const formatTwoDigits = (value) => String(value).padStart(2, "0");

    const syncSeriesMeta = () => {
      const years = items
        .map((item) => (item.getAttribute("data-reco-year") || "").trim())
        .filter((value) => value !== "")
        .map((value) => Number(value))
        .filter((year) => Number.isFinite(year));

      if (quantityEl) {
        quantityEl.textContent = formatTwoDigits(items.length + 1);
      }

      if (!yearStartEl || !yearSeparatorEl || !yearEndEl) return;

      if (!years.length) {
        yearStartEl.textContent = "";
        yearStartEl.style.display = "none";
        yearSeparatorEl.style.display = "none";
        yearEndEl.textContent = "";
        yearEndEl.style.display = "none";
        return;
      }

      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      yearStartEl.textContent = String(minYear);
      yearStartEl.style.display = "";

      if (minYear === maxYear) {
        yearSeparatorEl.style.display = "none";
        yearEndEl.textContent = "";
        yearEndEl.style.display = "none";
        return;
      }

      yearSeparatorEl.style.display = "";
      yearEndEl.textContent = String(maxYear);
      yearEndEl.style.display = "";
    };

    const setTrackX = (value) => {
      gsap.set(track, { x: value });
    };

    const updateBounds = () => {
      const viewportWidth = viewport.clientWidth;
      const trackWidth = track.scrollWidth;
      const viewportStyles = window.getComputedStyle(viewport);
      const paddingLeft = parseFloat(viewportStyles.paddingLeft) || 0;
      const paddingRight = parseFloat(viewportStyles.paddingRight) || 0;
      const edgeGap = paddingLeft + paddingRight;

      maxX = 0;
      minX = Math.min(viewportWidth - trackWidth - edgeGap, 0);

      targetX = clamp(targetX);
      currentX = clamp(currentX);
      setTrackX(currentX);
    };

    const canMoveForDelta = (delta) => {
      if (delta > 0) return targetX > minX + 0.5;
      if (delta < 0) return targetX < maxX - 0.5;
      return false;
    };

    const tick = () => {
      if (!isPointerDown) {
        targetX = clamp(targetX + velocityX);
        velocityX *= 0.94;

        if (Math.abs(velocityX) < 0.015) {
          velocityX = 0;
        }
      }

      currentX += (targetX - currentX) * 0.18;

      if (Math.abs(targetX - currentX) < 0.01) {
        currentX = targetX;
      }

      setTrackX(currentX);
    };

    const onWheel = (event) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

      if (!delta) return;
      if (Math.abs(minX) < 2) return;
      if (!canMoveForDelta(delta)) return;

      event.preventDefault();

      targetX = clamp(targetX - delta * 1.05);
      velocityX += -delta * 0.03;
    };

    const onPointerMove = (event) => {
      if (!isPointerDown) return;

      const now = performance.now();
      const deltaX = event.clientX - startPointerX;
      dragDistance = Math.abs(deltaX);

      if (dragDistance > 4) {
        hasDragged = true;
      }

      targetX = clamp(startTargetX + deltaX);

      const moveX = event.clientX - lastPointerX;
      const dt = Math.max(now - lastPointerTime, 1);

      velocityX = (moveX / dt) * 10;

      lastPointerX = event.clientX;
      lastPointerTime = now;
    };

    const endDrag = () => {
      if (!isPointerDown) return;

      isPointerDown = false;
      track.classList.remove("is-dragging");

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);

      releaseTimeout = window.setTimeout(() => {
        hasDragged = false;
      }, 80);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      isPointerDown = true;
      hasDragged = false;
      dragDistance = 0;

      startPointerX = event.clientX;
      startTargetX = targetX;
      lastPointerX = event.clientX;
      lastPointerTime = performance.now();

      window.clearTimeout(releaseTimeout);
      track.classList.add("is-dragging");

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    };

    const onResize = () => {
      updateBounds();
    };

    const linkHandlers = links.map((link) => {
      const onClick = (event) => {
        if (!hasDragged) return;
        event.preventDefault();
        event.stopPropagation();
      };

      link.addEventListener("click", onClick);
      return { link, onClick };
    });

    viewport.addEventListener("wheel", onWheel, { passive: false });
    track.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(updateBounds);
      resizeObserver.observe(viewport);
      resizeObserver.observe(track);
    }

    syncSeriesMeta();
    gsap.ticker.add(tick);
    updateBounds();

    instances.push({
      section,
      viewport,
      track,
      tick,
      onWheel,
      onPointerDown,
      onResize,
      onPointerMove,
      endDrag,
      linkHandlers,
      resizeObserver,
      getReleaseTimeout: () => releaseTimeout
    });
  });

  window.Sonia._oeuvresInstances = instances;
};

window.Sonia.destroyOeuvres = function () {
  const instances = window.Sonia._oeuvresInstances || [];

  instances.forEach((instance) => {
    instance.viewport.removeEventListener("wheel", instance.onWheel);
    instance.track.removeEventListener("pointerdown", instance.onPointerDown);
    window.removeEventListener("resize", instance.onResize);
    window.removeEventListener("pointermove", instance.onPointerMove);
    window.removeEventListener("pointerup", instance.endDrag);
    window.removeEventListener("pointercancel", instance.endDrag);

    instance.linkHandlers.forEach(({ link, onClick }) => {
      link.removeEventListener("click", onClick);
    });

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
    }

    const releaseTimeout = instance.getReleaseTimeout?.();
    if (releaseTimeout) {
      window.clearTimeout(releaseTimeout);
    }

    gsap.ticker.remove(instance.tick);
    instance.section.dataset.recoSliderInitialized = "false";
  });

  window.Sonia._oeuvresInstances = [];
};
