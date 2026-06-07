window.Sonia = window.Sonia || {};

window.Sonia.initTattoo = function () {
  if (window.Sonia._tattooInitialized === true) return;

  const selectors = {
    section: ".mwg_effect026",
    container: ".container",
    sourceContent: ".content:not([aria-hidden='true'])",
    mediaItem: "[data-media-item], .media",
    overlay: "[data-overlay], .tattoo-overlay",
    overlayPanel: "[data-overlay-panel], .tattoo-overlay__panel",
    beforeCompare: "[data-overlay-compare='before'], .tattoo-overlay__compare:first-child",
    afterCompare: "[data-overlay-compare='after'], .tattoo-overlay__compare:last-child",
    compareLabel: "[data-overlay-compare-label]",
    beforeSlot: "[data-overlay-slot='before']",
    afterSlot: "[data-overlay-slot='after']",
    closeButton: "[data-overlay-close], .tattoo-overlay__close",
    previousButton: "[data-overlay-nav='previous'], .tattoo-overlay .previous, .tattoo-overlay__nav--previous",
    nextButton: "[data-overlay-nav='next'], .tattoo-overlay .next, .tattoo-overlay__nav--next",
    previewMedia: "[data-media-preview]",
    beforeMedia: "[data-media-before]",
    afterMedia: "[data-media-after]",
    filterButtons: ".navbar__link[data-filter-key]",
    slotCover: ".media-overlay__cover"
  };

  const section = document.querySelector(selectors.section);
  if (!section) return;
  if (section.dataset.tattooInitialized === "true") return;

  section.dataset.tattooInitialized = "true";

  const container = section.querySelector(selectors.container);
  const content = container?.querySelector(selectors.sourceContent);
  const overlay = document.querySelector(selectors.overlay);

  if (
    !container ||
    !content ||
    !overlay ||
    typeof gsap === "undefined" ||
    typeof Observer === "undefined"
  ) return;

  window.Sonia._tattooInitialized = true;

  const cleanupFns = [];
  const overlayPanel = overlay.querySelector(selectors.overlayPanel);
  const beforeCompare = overlay.querySelector(selectors.beforeCompare);
  const afterCompare = overlay.querySelector(selectors.afterCompare);
  const beforeLabel = beforeCompare?.querySelector(selectors.compareLabel);
  const afterLabel = afterCompare?.querySelector(selectors.compareLabel);
  const beforeSlot = overlay.querySelector(selectors.beforeSlot);
  const afterSlot = overlay.querySelector(selectors.afterSlot);
  const closeButton = overlay.querySelector(selectors.closeButton);
  const previousButton = overlay.querySelector(selectors.previousButton);
  const nextButton = overlay.querySelector(selectors.nextButton);
  const filterButtons = Array.from(document.querySelectorAll(selectors.filterButtons));
  const overlayNavs = Array.from(overlay.querySelectorAll(".tattoo-overlay__nav"));

  if (
    !overlayPanel ||
    !beforeCompare ||
    !afterCompare ||
    !beforeSlot ||
    !afterSlot ||
    !closeButton ||
    !previousButton ||
    !nextButton
  ) return;

  const MOBILE_BREAKPOINT = 767;
  const isMobileGallery = () => window.innerWidth <= MOBILE_BREAKPOINT;

  container.querySelectorAll(".content[aria-hidden='true']").forEach((clone) => clone.remove());

  const slugify = (value) => {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const getMediaTypeKey = (media) => {
    const attributeValue = media.getAttribute("data-tattoo-type");
    return slugify(attributeValue);
  };

  const getFilterKey = (button) => {
    const explicitValue = button.getAttribute("data-filter-key");
    return slugify(explicitValue);
  };

  const masterItems = Array.from(content.querySelectorAll(selectors.mediaItem)).map((item, index) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("data-master-index", index);
    clone.setAttribute("data-tattoo-type-resolved", getMediaTypeKey(clone));
    return clone;
  });

  let sourceMedias = [];
  let medias = [];
  let mediaCount = 0;
  let wrapIndex = (index) => index;
  let activeIndex = 0;
  let activeFilter = null;
  let galleryObserver = null;
  let xTo = null;
  let yTo = null;
  let incrX = 0;
  let incrY = 0;
  let isFilterTransitioning = false;
  let isOverlayTransitioning = false;
  let motionMediaItems = [];
  let clipResetDelay = null;
  let wasMobileGallery = isMobileGallery();
  const clipProxy = { value: 0 };

  const isOverlayOpen = () => overlay.getAttribute("aria-hidden") === "false";

  const updateContainerPosition = () => {
    if (!xTo || !yTo) return;
    xTo(incrX);
    yTo(incrY);
  };

  const resetContainerPosition = () => {
    const contentWidth = content.offsetWidth || 1;
    const contentHeight = content.offsetHeight || 1;

    incrX = -contentWidth;
    incrY = -contentHeight;

    gsap.set(container, {
      x: incrX,
      y: incrY,
      force3D: true
    });

    updateContainerPosition();
  };

  const syncScrollerBounds = () => {
    const contentWidth = content.offsetWidth || 1;
    const contentHeight = content.offsetHeight || 1;

    const localWrapX = gsap.utils.wrap(-2 * contentWidth, 0);
    const localWrapY = gsap.utils.wrap(-2 * contentHeight, 0);

    xTo = gsap.quickTo(container, "x", {
      duration: 1.5,
      ease: "power4",
      modifiers: {
        x: gsap.utils.unitize(localWrapX)
      }
    });

    yTo = gsap.quickTo(container, "y", {
      duration: 1.5,
      ease: "power4",
      modifiers: {
        y: gsap.utils.unitize(localWrapY)
      }
    });

    resetContainerPosition();
  };

  const centerMediaElement = (media) => {
    if (!media || isMobileGallery()) return false;

    const rect = media.getBoundingClientRect();
    const deltaX = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const deltaY = window.innerHeight / 2 - (rect.top + rect.height / 2);

    incrX += deltaX;
    incrY += deltaY;
    updateContainerPosition();
    return true;
  };

  const centerMediaByIndex = (index) => {
    if (isMobileGallery()) return;

    const normalizedIndex = wrapIndex(index);
    const candidates = medias.filter((media) => Number(media.dataset.sourceIndex) === normalizedIndex);
    if (!candidates.length) return;

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    const closestMedia = candidates.reduce((best, candidate) => {
      const rect = candidate.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.abs(viewportCenterX - centerX) + Math.abs(viewportCenterY - centerY);

      if (!best || distance < best.distance) {
        return { node: candidate, distance };
      }

      return best;
    }, null);

    centerMediaElement(closestMedia?.node);
  };

  const getVisibleMedia = (sourceMedia) => {
    return sourceMedia.querySelector(selectors.previewMedia) || sourceMedia.querySelector("img, video");
  };

  const getVariantMedia = (sourceMedia, variant) => {
    const selector = variant === "before" ? selectors.beforeMedia : selectors.afterMedia;
    const media = sourceMedia.querySelector(selector);
    if (!media) return null;

    const src = media.getAttribute("src") || "";
    const isEmpty =
      media.classList.contains("w-dyn-bind-empty") ||
      src.includes("/plugins/Basic/assets/placeholder");

    return isEmpty ? null : media;
  };

  const getVariantDatasetSrc = (sourceMedia, variant) => {
    const key = variant === "before" ? "beforeSrc" : "afterSrc";
    const value = (sourceMedia?.dataset?.[key] || "").trim();
    return value || null;
  };

  const hasVariantMedia = (sourceMedia, variant) => {
    return !!getVariantDatasetSrc(sourceMedia, variant) || !!getVariantMedia(sourceMedia, variant);
  };

  const cloneMedia = (index, variant = "after", usePreviewFallback = false) => {
    const sourceMedia = sourceMedias[wrapIndex(index)];
    const previewMedia = sourceMedia ? getVisibleMedia(sourceMedia) : null;
    if (!previewMedia) return null;

    const variantMedia = getVariantMedia(sourceMedia, variant);
    const variantSrc = getVariantDatasetSrc(sourceMedia, variant);
    const cloneSource = variantMedia || (usePreviewFallback ? previewMedia : null);
    if (!cloneSource) return null;

    const clone = cloneSource.cloneNode(true);
    clone.classList.remove("hide", "w-dyn-bind-empty");
    clone.removeAttribute("hidden");
    clone.style.display = "";

    if (variantSrc && "src" in clone) {
      clone.src = variantSrc;
    }

    if (clone.tagName === "VIDEO") {
      clone.muted = true;
      clone.loop = true;
      clone.autoplay = true;
      clone.playsInline = true;
    }

    return clone;
  };

  const fillSlot = (slot, index, variant, usePreviewFallback = false) => {
    slot.replaceChildren();

    const media = cloneMedia(index, variant, usePreviewFallback);
    if (!media) return false;

    const mediaWrapper = document.createElement("div");
    mediaWrapper.className = "media-overlay__media";
    mediaWrapper.append(media);
    slot.append(mediaWrapper);

    const mediaCover = document.createElement("div");
    mediaCover.className = "media-overlay__cover";
    slot.append(mediaCover);

    return true;
  };

  const animateImages = () => {
    const mediaCovers = overlay.querySelectorAll(selectors.slotCover);

    gsap.killTweensOf(mediaCovers);
    gsap.set(mediaCovers, {
      scaleY: 1,
      transformOrigin: "50% 0%"
    });

    gsap.to(mediaCovers, {
      scaleY: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08
    });
  };

  const getAllContentBlocks = () => {
    return Array.from(container.querySelectorAll(".content"));
  };

  const getAllGalleryItems = () => {
    return Array.from(container.querySelectorAll(selectors.mediaItem));
  };

  const refreshMotionMediaItems = () => {
    motionMediaItems = getAllGalleryItems();
  };

  const applyMediaClip = (value) => {
    const insetValue = `${value}%`;

    motionMediaItems.forEach((item) => {
      item.style.clipPath = `inset(${insetValue} ${insetValue} ${insetValue} ${insetValue})`;
    });
  };

  const animateMediaClip = (targetValue) => {
    gsap.killTweensOf(clipProxy);

    gsap.to(clipProxy, {
      value: targetValue,
      duration: 0.14,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        applyMediaClip(clipProxy.value);
      }
    });
  };

  const releaseMediaClip = () => {
    gsap.killTweensOf(clipProxy);

    gsap.to(clipProxy, {
      value: 0,
      duration: 0.45,
      ease: "power3.out",
      overwrite: true,
      onUpdate: () => {
        applyMediaClip(clipProxy.value);
      }
    });
  };

  const pulseMediaClipFromDelta = (deltaX = 0, deltaY = 0) => {
    if (isMobileGallery()) return;

    const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    if (delta <= 0) return;

    const clipAmount = gsap.utils.clamp(
      0,
      30,
      gsap.utils.mapRange(0, 260, 0, 30, delta)
    );

    animateMediaClip(clipAmount);

    if (clipResetDelay) {
      clipResetDelay.kill();
    }

    clipResetDelay = gsap.delayedCall(0.12, () => {
      releaseMediaClip();
    });
  };

  const setCompareLabelsVisibility = (showLabels) => {
    if (beforeLabel) beforeLabel.classList.toggle("hide", !showLabels);
    if (afterLabel) afterLabel.classList.toggle("hide", !showLabels);
  };

  const setOverlayInitialState = () => {
    gsap.set(overlay, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      pointerEvents: "none"
    });

    gsap.set(overlayPanel, {
      clipPath: "inset(50% 50% 50% 50%)"
    });

    gsap.set(overlayNavs, {
      clipPath: "inset(50% 50% 50% 50%)"
    });
  };

  const animateOverlayIn = () => {
    isOverlayTransitioning = true;

    gsap.set(overlay, {
      pointerEvents: "auto"
    });

    const tl = gsap.timeline({
      onComplete: () => {
        isOverlayTransitioning = false;
      }
    });

    tl.fromTo(overlay, {
      backgroundColor: "rgba(0, 0, 0, 0)"
    }, {
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      duration: 0.28,
      ease: "power2.out"
    }, 0);

    tl.fromTo(overlayPanel, {
      clipPath: "inset(50% 50% 50% 50%)"
    }, {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 0.55,
      ease: "power3.out"
    }, 0.04);

    tl.fromTo(overlayNavs, {
      clipPath: "inset(50% 50% 50% 50%)"
    }, {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 0.4,
      ease: "power3.out",
      stagger: 0.03
    }, 0.12);

    return tl;
  };

  const animateOverlayOut = (onComplete) => {
    isOverlayTransitioning = true;

    const tl = gsap.timeline({
      onComplete: () => {
        isOverlayTransitioning = false;
        gsap.set(overlay, {
          pointerEvents: "none"
        });
        onComplete?.();
      }
    });

    tl.to(overlayNavs, {
      clipPath: "inset(50% 50% 50% 50%)",
      duration: 0.2,
      ease: "power2.inOut",
      stagger: 0.02
    }, 0);

    tl.to(overlayPanel, {
      clipPath: "inset(50% 50% 50% 50%)",
      duration: 0.26,
      ease: "power2.inOut"
    }, 0.03);

    tl.to(overlay, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      duration: 0.22,
      ease: "power2.out"
    }, 0.08);

    return tl;
  };

  const renderOverlay = () => {
    const sourceMedia = sourceMedias[wrapIndex(activeIndex)];
    if (!sourceMedia) return;

    const hasBefore = hasVariantMedia(sourceMedia, "before");
    const hasAfter = hasVariantMedia(sourceMedia, "after");
    const showLabels = hasBefore && hasAfter;

    beforeSlot.replaceChildren();
    afterSlot.replaceChildren();

    beforeCompare.classList.add("hide");
    afterCompare.classList.add("hide");
    setCompareLabelsVisibility(false);

    if (hasBefore) {
      beforeCompare.classList.remove("hide");
      fillSlot(beforeSlot, activeIndex, "before");
    }

    if (hasAfter) {
      afterCompare.classList.remove("hide");
      fillSlot(afterSlot, activeIndex, "after");
    }

    if (!hasBefore && !hasAfter) {
      afterCompare.classList.remove("hide");
      fillSlot(afterSlot, activeIndex, "after", true);
    }

    setCompareLabelsVisibility(showLabels);
  };

  const closeOverlay = (immediate = false) => {
    if (!isOverlayOpen()) {
      if (immediate) setOverlayInitialState();
      return;
    }

    if (isOverlayTransitioning && !immediate) return;

    const finalize = () => {
      overlay.setAttribute("aria-hidden", "true");
      if (!isMobileGallery()) galleryObserver?.enable();
    };

    if (immediate) {
      finalize();
      setOverlayInitialState();
      return;
    }

    animateOverlayOut(finalize);
  };

  const openOverlay = (index, clickedMedia = null) => {
    if (isOverlayTransitioning) return;

    activeIndex = wrapIndex(index);
    renderOverlay();

    overlay.setAttribute("aria-hidden", "false");
    if (!isMobileGallery()) galleryObserver?.disable();

    if (!centerMediaElement(clickedMedia)) {
      centerMediaByIndex(activeIndex);
    }

    animateOverlayIn();
    animateImages();
  };

  const showPrevious = () => {
    activeIndex = wrapIndex(activeIndex - 1);
    renderOverlay();
    centerMediaByIndex(activeIndex);
    animateImages();
  };

  const showNext = () => {
    activeIndex = wrapIndex(activeIndex + 1);
    renderOverlay();
    centerMediaByIndex(activeIndex);
    animateImages();
  };

  const updateFilterButtons = () => {
    filterButtons.forEach((button) => {
      const key = getFilterKey(button);
      button.style.opacity = activeFilter === key ? "0.3" : "1";
    });
  };

  const getFilteredMasterItems = (filterKey) => {
    const filteredItems = !filterKey
      ? masterItems
      : masterItems.filter((item) => item.getAttribute("data-tattoo-type-resolved") === filterKey);

    return filteredItems.length ? filteredItems : masterItems;
  };

  const buildMobileItemsForFilter = (filterKey) => {
    return getFilteredMasterItems(filterKey).map((item) => item.cloneNode(true));
  };

  const buildTemplatesForSlots = (filterKey, slotCount) => {
    const sourcePool = getFilteredMasterItems(filterKey);
    const templates = [];

    for (let i = 0; i < slotCount; i++) {
      const template = sourcePool[i % sourcePool.length].cloneNode(true);

      if (i >= sourcePool.length) {
        template.setAttribute("data-generated-fill", "");
      } else {
        template.removeAttribute("data-generated-fill");
      }

      templates.push(template);
    }

    return templates;
  };

  const syncNodeWithTemplate = (node, template) => {
    const preservedAttributes = new Set([
      "data-interactions-bound",
      "data-source-index",
      "role",
      "tabindex",
      "aria-label"
    ]);

    Array.from(node.attributes).forEach((attr) => {
      if (!preservedAttributes.has(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });

    Array.from(template.attributes).forEach((attr) => {
      node.setAttribute(attr.name, attr.value);
    });

    node.className = template.className;
    node.innerHTML = template.innerHTML;
  };

  const mediaBindings = [];

  const attachMediaInteractions = () => {
    medias.forEach((media, index) => {
      const normalizedIndex = mediaCount ? index % mediaCount : 0;
      media.dataset.sourceIndex = normalizedIndex;

      media.tabIndex = 0;
      media.setAttribute("role", "button");
      media.setAttribute("aria-label", `Ouvrir le media ${normalizedIndex + 1}`);

      if (media.dataset.interactionsBound === "true") return;

      const onClick = () => openOverlay(normalizedIndex, media);
      const onKeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openOverlay(normalizedIndex, media);
      };

      media.addEventListener("click", onClick);
      media.addEventListener("keydown", onKeydown);

      media.dataset.interactionsBound = "true";
      mediaBindings.push({ media, onClick, onKeydown });
    });
  };

  const setFilterButtonsDisabled = (disabled) => {
    filterButtons.forEach((button) => {
      button.style.pointerEvents = disabled ? "none" : "";
    });
  };

  const rebuildGallery = () => {
    closeOverlay(true);

    if (isMobileGallery()) {
      const mobileItems = buildMobileItemsForFilter(activeFilter);

      content.replaceChildren(...mobileItems);
      container.replaceChildren(content);

      sourceMedias = Array.from(content.querySelectorAll(selectors.mediaItem));
      medias = [...sourceMedias];
      mediaCount = sourceMedias.length;
      wrapIndex = gsap.utils.wrap(0, mediaCount);
      activeIndex = 0;

      gsap.set(container, {
        clearProps: "x,y"
      });

      xTo = null;
      yTo = null;
      incrX = 0;
      incrY = 0;

      galleryObserver?.disable();

      attachMediaInteractions();
      updateFilterButtons();

      gsap.set(getAllGalleryItems(), {
        scale: 1,
        autoAlpha: 1,
        clearProps: "y",
        transformOrigin: "50% 50%"
      });

      refreshMotionMediaItems();
      applyMediaClip(0);
      return;
    }

    content.replaceChildren();

    const slotCount = Math.max(15, Math.ceil(masterItems.length / 5) * 5);
    const baseItems = buildTemplatesForSlots(activeFilter, slotCount);
    baseItems.forEach((item) => content.appendChild(item));

    const clones = Array.from({ length: 8 }, () => {
      const clone = content.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      return clone;
    });

    container.replaceChildren(
      clones[0],
      clones[1],
      clones[2],
      clones[3],
      content,
      clones[4],
      clones[5],
      clones[6],
      clones[7]
    );

    sourceMedias = Array.from(content.querySelectorAll(selectors.mediaItem));
    medias = Array.from(container.querySelectorAll(selectors.mediaItem));
    mediaCount = sourceMedias.length;
    wrapIndex = gsap.utils.wrap(0, mediaCount);
    activeIndex = 0;

    syncScrollerBounds();
    galleryObserver?.enable();
    attachMediaInteractions();
    updateFilterButtons();

    gsap.set(getAllGalleryItems(), {
      scale: 1,
      autoAlpha: 1,
      clearProps: "y",
      transformOrigin: "50% 50%"
    });

    refreshMotionMediaItems();
    applyMediaClip(0);
  };

  const finishFilterTransition = () => {
    sourceMedias = Array.from(content.querySelectorAll(selectors.mediaItem));
    medias = isMobileGallery()
      ? [...sourceMedias]
      : Array.from(container.querySelectorAll(selectors.mediaItem));

    mediaCount = sourceMedias.length;
    wrapIndex = gsap.utils.wrap(0, mediaCount);
    activeIndex = mediaCount ? wrapIndex(activeIndex) : 0;

    attachMediaInteractions();

    gsap.set(getAllGalleryItems(), {
      scale: 1,
      autoAlpha: 1,
      y: 0,
      pointerEvents: "auto"
    });

    refreshMotionMediaItems();
    applyMediaClip(0);

    isFilterTransitioning = false;
    setFilterButtonsDisabled(false);

    if (isMobileGallery()) {
      galleryObserver?.disable();
    } else {
      galleryObserver?.enable();
    }
  };

  const runMobileFilterTransition = (nextFilter) => {
    const currentNodes = Array.from(content.querySelectorAll(selectors.mediaItem));

    isFilterTransitioning = true;
    setFilterButtonsDisabled(true);

    activeFilter = nextFilter;
    updateFilterButtons();

    gsap.killTweensOf(currentNodes);

    gsap.to(currentNodes, {
      scale: 0,
      autoAlpha: 0,
      duration: 0.22,
      ease: "power2.inOut",
      stagger: {
        each: 0.01,
        from: "center"
      },
      onComplete: () => {
        const nextNodes = buildMobileItemsForFilter(nextFilter);

        content.replaceChildren(...nextNodes);

        sourceMedias = Array.from(content.querySelectorAll(selectors.mediaItem));
        medias = [...sourceMedias];
        mediaCount = sourceMedias.length;
        wrapIndex = gsap.utils.wrap(0, mediaCount);

        attachMediaInteractions();

        const refreshedNodes = getAllGalleryItems();

        gsap.set(refreshedNodes, {
          scale: 0,
          autoAlpha: 0,
          transformOrigin: "50% 50%",
          pointerEvents: "none"
        });

        gsap.to(refreshedNodes, {
          scale: 1,
          autoAlpha: 1,
          duration: 0.34,
          ease: "power3.out",
          stagger: {
            each: 0.01,
            from: "center"
          },
          onComplete: finishFilterTransition
        });
      }
    });
  };

  const runDesktopFilterTransition = (nextFilter) => {
    const blocks = getAllContentBlocks();
    if (!blocks.length) return;

    isFilterTransitioning = true;
    setFilterButtonsDisabled(true);
    galleryObserver?.disable();

    activeFilter = nextFilter;
    updateFilterButtons();

    const slotCount = Array.from(content.querySelectorAll(selectors.mediaItem)).length;
    const nextTemplates = buildTemplatesForSlots(nextFilter, slotCount);
    const allNodes = getAllGalleryItems();

    gsap.killTweensOf(allNodes);

    gsap.to(allNodes, {
      scale: 0,
      autoAlpha: 0,
      duration: 0.22,
      ease: "power2.inOut",
      onComplete: () => {
        blocks.forEach((block) => {
          const nodes = Array.from(block.querySelectorAll(selectors.mediaItem));

          nodes.forEach((node, index) => {
            const template = nextTemplates[index];
            if (!template) return;
            syncNodeWithTemplate(node, template);
          });
        });

        const refreshedNodes = getAllGalleryItems();

        gsap.set(refreshedNodes, {
          scale: 0,
          autoAlpha: 0,
          transformOrigin: "50% 50%",
          pointerEvents: "none"
        });

        gsap.to(refreshedNodes, {
          scale: 1,
          autoAlpha: 1,
          duration: 0.34,
          ease: "power3.out",
          onComplete: finishFilterTransition
        });
      }
    });
  };

  const toggleFilter = (key) => {
    if (isFilterTransitioning) return;

    const nextFilter = activeFilter === key ? null : key;

    if (isMobileGallery()) {
      runMobileFilterTransition(nextFilter);
      return;
    }

    runDesktopFilterTransition(nextFilter);
  };

  const onCloseClick = (event) => {
    event.preventDefault();
    closeOverlay();
  };

  const onPreviousClick = (event) => {
    event.preventDefault();
    showPrevious();
  };

  const onNextClick = (event) => {
    event.preventDefault();
    showNext();
  };

  const onOverlayClick = (event) => {
    if (!isOverlayOpen()) return;
    if (isOverlayTransitioning) return;

    const clickedInsidePanel = overlayPanel.contains(event.target);
    const clickedPrevious = previousButton.contains(event.target);
    const clickedNext = nextButton.contains(event.target);

    if (!clickedInsidePanel && !clickedPrevious && !clickedNext) {
      closeOverlay();
    }
  };

  const onWindowKeydown = (event) => {
    if (!isOverlayOpen()) return;
    if (isOverlayTransitioning) return;

    if (event.key === "Escape") closeOverlay();
    if (event.key === "ArrowLeft") showPrevious();
    if (event.key === "ArrowRight") showNext();
  };

  closeButton.addEventListener("click", onCloseClick);
  previousButton.addEventListener("click", onPreviousClick);
  nextButton.addEventListener("click", onNextClick);
  overlay.addEventListener("click", onOverlayClick);
  window.addEventListener("keydown", onWindowKeydown);

  cleanupFns.push(() => {
    closeButton.removeEventListener("click", onCloseClick);
    previousButton.removeEventListener("click", onPreviousClick);
    nextButton.removeEventListener("click", onNextClick);
    overlay.removeEventListener("click", onOverlayClick);
    window.removeEventListener("keydown", onWindowKeydown);
  });

  const filterBindings = [];

  filterButtons.forEach((button) => {
    button.style.cursor = "pointer";

    const onClick = (event) => {
      event.preventDefault();
      toggleFilter(getFilterKey(button));
    };

    button.addEventListener("click", onClick);
    filterBindings.push({ button, onClick });
  });

  cleanupFns.push(() => {
    filterBindings.forEach(({ button, onClick }) => {
      button.removeEventListener("click", onClick);
    });
  });

  galleryObserver = Observer.create({
    target: window,
    type: "wheel,touch,pointer",
    preventDefault: true,

    onChangeX: (self) => {
      if (isMobileGallery()) return;

      const deltaX = self.event.type === "wheel" ? -self.deltaX : self.deltaX * 2;
      incrX += deltaX;
      updateContainerPosition();
      pulseMediaClipFromDelta(deltaX, 0);
    },

    onChangeY: (self) => {
      if (isMobileGallery()) return;

      const deltaY = self.event.type === "wheel" ? -self.deltaY : self.deltaY * 2;
      incrY += deltaY;
      updateContainerPosition();
      pulseMediaClipFromDelta(0, deltaY);
    }
  });

  cleanupFns.push(() => {
    galleryObserver?.kill();
    galleryObserver = null;
  });

  const onResize = () => {
    const isNowMobileGallery = isMobileGallery();

    if (isNowMobileGallery !== wasMobileGallery) {
      wasMobileGallery = isNowMobileGallery;
      rebuildGallery();
      return;
    }

    if (!isNowMobileGallery) {
      syncScrollerBounds();
    }
  };

  window.addEventListener("resize", onResize);

  cleanupFns.push(() => {
    window.removeEventListener("resize", onResize);
  });

  cleanupFns.push(() => {
    if (clipResetDelay) {
      clipResetDelay.kill();
      clipResetDelay = null;
    }

    gsap.killTweensOf(clipProxy);
  });

  cleanupFns.push(() => {
    mediaBindings.forEach(({ media, onClick, onKeydown }) => {
      media.removeEventListener("click", onClick);
      media.removeEventListener("keydown", onKeydown);
      media.dataset.interactionsBound = "false";
    });
  });

  cleanupFns.push(() => {
    closeOverlay(true);
    section.dataset.tattooInitialized = "false";
  });

  overlay.classList.remove("hide");
  overlay.setAttribute("aria-hidden", "true");

  rebuildGallery();
  setOverlayInitialState();

  window.Sonia._tattooCleanup = cleanupFns;

  console.log("tattoo real loaded");
};

window.Sonia.destroyTattoo = function () {
  const cleanupFns = window.Sonia._tattooCleanup || [];
  cleanupFns.forEach((fn) => {
    if (typeof fn === "function") fn();
  });
  window.Sonia._tattooCleanup = [];
  window.Sonia._tattooInitialized = false;
};

if (document.querySelector(".mwg_effect026")) {
  window.Sonia.initTattoo();
}
