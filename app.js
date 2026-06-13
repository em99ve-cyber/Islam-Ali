const THEME_ANIMATION_MS = 2850;
const themeSwitch = document.getElementById("themeSwitch");
const themeText = themeSwitch?.querySelector(".theme-switch-text");
const themeIcon = themeSwitch?.querySelector(".theme-switch-icon");
const themePortraits = document.querySelectorAll(".theme-portrait");
let isThemeSwitching = false;

function primeThemeAnimationTargets() {
  const targets = [
    ...document.querySelectorAll(".nav, .hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .tab-btn, .arrow-btn, .contact-link, .choice-btn, .request-main-btn, .send-request")
  ];
  targets.forEach((el, index) => {
    el.classList.add("theme-unit");
    el.classList.remove("theme-wide", "theme-tall", "theme-card", "theme-button", "theme-soft");
    if (el.classList.contains("hero-photo")) el.classList.add("theme-tall");
    else if (el.classList.contains("project-card") || el.classList.contains("process-card")) el.classList.add("theme-card");
    else if (el.matches("button, .tab-btn, .arrow-btn, .contact-link, .choice-btn, .send-request")) el.classList.add("theme-button");
    else if (el.classList.contains("nav") || el.classList.contains("hero-copy") || el.classList.contains("tabs-shell") || el.classList.contains("request-card") || el.classList.contains("contact-card")) el.classList.add("theme-wide");
    else el.classList.add("theme-soft");
    const delay = Math.min(index * 26, 560);
    el.style.setProperty("--theme-delay", `${delay}ms`);
    el.style.setProperty("--theme-tilt", index % 2 ? "-16deg" : "16deg");
  });
}

function setThemeAssets(theme) {
  themePortraits.forEach((img) => {
    const nextSrc = theme === "light" ? img.dataset.lightSrc : img.dataset.darkSrc;
    if (nextSrc && img.getAttribute("src") !== nextSrc) img.setAttribute("src", nextSrc);
  });
}

function applyTheme(theme, persist = false) {
  const isLight = theme === "light";
  document.body.classList.toggle("theme-light", isLight);
  setThemeAssets(theme);
  if (themeSwitch) {
    themeSwitch.setAttribute("aria-pressed", String(isLight));
    themeSwitch.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  }
  if (themeText) themeText.textContent = isLight ? "Light" : "Dark";
  if (themeIcon) themeIcon.textContent = "";
  if (persist) {
    try { localStorage.setItem("ezzPortfolioTheme", theme); } catch (error) {}
  }
}

function readSavedTheme() {
  try { return localStorage.getItem("ezzPortfolioTheme") || "dark"; }
  catch (error) { return "dark"; }
}

applyTheme(readSavedTheme());

const INTRO_MAX_MS = 7000;
const introLikelyLowPower = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const INTRO_MIN_MS = introLikelyLowPower ? 4200 : 2800;
const INTRO_BASE_ASSETS = [
  "assets/ezz-profile-dark.jpg",
  "assets/ezz-profile-light.jpg",
  "assets/project-plains-youtube-channel.jpg",
  "assets/project-teleperformance-media-coverage.jpg",
  "assets/project-tamatem-heroes-land-ad.jpg",
  "assets/project-color-grading-raw-footage.jpg",
  "assets/project-urgent-course-reel.jpg",
  "assets/project-waraha-hekaya-editor.jpg",
  "assets/project-automotive-service-center.jpg",
  "assets/project-apartment-visualization.jpg",
  "assets/project-apartment-floor-plan-visualization.jpg",
  "assets/project-comfyui-ai-animation.jpg",
  "assets/project-ai-building-vfx-animation.jpg"
];
const introImageCache = new Map();
const introScreen = document.getElementById("introScreen");
const introProgressText = document.getElementById("introProgressText");

function setIntroProgress(value) {
  const pct = Math.max(0, Math.min(100, value));
  document.documentElement.style.setProperty("--intro-progress", `${pct.toFixed(1)}%`);
  if (introProgressText) introProgressText.textContent = `${Math.round(pct)}%`;
}

function preloadIntroImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ src, ok: false });
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "high";
    const finish = async (ok) => {
      if (ok) {
        try { await image.decode?.(); } catch (error) {}
        introImageCache.set(src, image);
      }
      resolve({ src, ok });
    };
    image.addEventListener("load", () => finish(true), { once: true });
    image.addEventListener("error", () => finish(false), { once: true });
    image.src = src;
  });
}

function waitForTwoFrames() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function waitForIdleSlice(timeout = 520) {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve, { timeout });
      return;
    }
    window.setTimeout(resolve, Math.min(180, timeout));
  });
}

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

function collectIntroAssets() {
  const assets = new Set(INTRO_BASE_ASSETS);
  if (Array.isArray(window.PORTFOLIO_PROJECTS)) {
    window.PORTFOLIO_PROJECTS.forEach((project) => {
      if (project.thumbnail) assets.add(project.thumbnail);
    });
  }
  document.querySelectorAll("img").forEach((img) => {
    if (img.currentSrc || img.src) assets.add(img.currentSrc || img.src);
    if (img.dataset.darkSrc) assets.add(img.dataset.darkSrc);
    if (img.dataset.lightSrc) assets.add(img.dataset.lightSrc);
  });
  return [...assets].filter(Boolean);
}

function warmInitialLayout() {
  return waitForTwoFrames().then(() => {
    document.querySelectorAll(".nav, .hero, .hero-photo, .hero-copy, .project-card, .tabs-shell, .section-head, .request-card").forEach((el) => {
      el.getBoundingClientRect();
    });
  });
}

async function runSmartIntroLoader() {
  if (!introScreen) {
    document.body.classList.add("intro-done");
    return;
  }

  const startedAt = performance.now();
  let completed = 0;
  let finished = false;
  const markComplete = () => { completed += 1; };
  const assets = collectIntroAssets();
  const tasks = [
    ...assets.map((src) => preloadIntroImage(src).finally(markComplete)),
    Promise.resolve(document.fonts?.ready).catch(() => {}).finally(markComplete),
    waitForWindowLoad().finally(markComplete),
    warmInitialLayout().finally(markComplete),
    waitForIdleSlice(introLikelyLowPower ? 900 : 520).finally(markComplete)
  ];
  const totalTasks = tasks.length;
  let progressTimer = null;

  function updateIntroProgress() {
    if (finished) return;
    const elapsedPct = Math.min(92, ((performance.now() - startedAt) / INTRO_MAX_MS) * 92);
    const taskPct = totalTasks ? (completed / totalTasks) * 96 : 96;
    setIntroProgress(Math.min(98, Math.max(elapsedPct, taskPct)));
  }

  updateIntroProgress();
  progressTimer = window.setInterval(updateIntroProgress, 90);

  await Promise.race([
    Promise.allSettled([
      ...tasks,
      new Promise((resolve) => window.setTimeout(resolve, INTRO_MIN_MS))
    ]),
    new Promise((resolve) => window.setTimeout(resolve, INTRO_MAX_MS))
  ]);

  finished = true;
  if (progressTimer) window.clearInterval(progressTimer);
  setIntroProgress(100);
  introScreen.classList.add("intro-complete");
  const hitMaxWait = performance.now() - startedAt >= INTRO_MAX_MS - 40;
  window.setTimeout(() => {
    document.body.classList.add("intro-done");
    window.setTimeout(() => introScreen.remove(), 900);
  }, hitMaxWait ? 0 : 220);
}

themeSwitch?.addEventListener("click", () => {
  if (isThemeSwitching) return;
  isThemeSwitching = true;
  themeSwitch.disabled = true;
  primeThemeAnimationTargets();
  const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
  document.body.classList.add("theme-animating");
  window.setTimeout(() => applyTheme(nextTheme, true), 760);
  window.setTimeout(() => {
    document.body.classList.remove("theme-animating");
    themeSwitch.disabled = false;
    isThemeSwitching = false;
  }, THEME_ANIMATION_MS);
});

const PROJECTS = [
  {
    id: "automotive-service-center",
    category: "threeD",
    categoryLabel: "3D Animation & Rendering",
    title: "Plan -> Model -> Reality",
    subtitle: "Automotive Customer Service Center Visualization",
    cardDescription: "A spatial branding visualization turning a flat service-center plan into a polished, client-ready 3D environment.",
    thumbnail: "assets/project-automotive-service-center.jpg",
    type: "Mixed project",
    client: "Automotive Customer Service Center",
    year: "2026",
    role: "3D modeling and rendering",
    tools: "Blender, Photoshop, ComfyUI",
    mainMedia: { label: "Project film", type: "drive", id: "1ZnTxMSdc6jx3GkUhPu-dsXTbrpYrDF-h" },
    gallery: [
      "108WCYyFM_mW72J1c983kZp-tOUL55JGk", "10YoCiLyNowRK-WmFKyMXC85vD48_XCv2", "1427sCOtQmGH4g_2RVPwjf8zUuQ8lFWyJ", "14Yj0ozJGmVu8L3xim1XRs8VZinrHa3Rm", "1B7H3O60PpaiXEf-zlp0SLzyuN2S_Ti11", "1F0XIQjgommn4BthummzK4_zU61F0XAFJ", "1GIjJvVtb_jJXWJW9LOc-ITWtPTHyOOp9", "1HDBBKxR1Xx53Lmb1-3tjXL3j4zVZGDxE", "1QMl_dT9HIqrA2Sf47U9eLY46YropvBFS", "1RzSCuUtBXO2ON2IWSD83xB_0dtLzHIaM", "1VB0ZBtpIKCgap1cMYSs-moGb1yKa6h4Q", "1VKkgoHCOGMu1zHdH0j73_5TbAwcixZQO", "1dN3qYTVBrJ_Ql5JcnzMQgDPSQBQ4AeP3", "1e22eK7xuyWTQtfgdC8DidFJTOtgO9Faz", "1fDr8kTm_0kTOK-NgG7a7hI-yAUHMyfI5", "1h6vw-hqLDPMwuvweCutE_Ftlgb9xXkHX", "1n4uPsuyumtPV6EfA0Gl2Y27mAv6X9jp6", "1ses_aBFl-Z9WTYRwlfxk3GPJm3JA-YU9", "1xXaqEtrhKlwjhi0qKKav1ABu_HHkRHNi", "1zBCzUcLDLvQRCRo5wSGdZsWvOcmHD0B9"
    ],
    aiRenders: ["1ABuqrFDy1Dx0BZpGa3vLZpJn42R4pPsU", "1Izket4K-IikE9031e7OkEm9U5MIuoXB-", "1OMOkvGMj7SobrCYG4WM0ZJIRCDJRrVT1", "1nocwhes7ucVX8J54pPcgoQIklA3qf1tQ"],
    sketchfab: "https://sketchfab.com/models/c6b54480588c4a7881e04c6ef031e2ff/embed",
    sectionLabels: { aiRenders: { tab: "AI realism samples (4)", item: "AI sample" } },
    lockedSections: {
      gallery: {
        tab: "Protected render gallery (20)",
        item: "Protected render",
        title: "Render gallery protected",
        message: "Selected render images are locked for client privacy. Public previews remain limited, while the AI realism samples are available to explore."
      }
    },
    description: "A full 3D branding visualization that transforms a flat layout into an immersive service-center environment. The project moves from floor plan to 3D build, final renders, AI-assisted realism samples, and an interactive asset preview.",
    highlights: [
      "Translated a 2D layout into a complete 3D spatial story.",
      "Built a visual route that shows process: plan, model, and final rendered experience.",
      "Included AI realism refinements to push selected renders closer to a photographic look."
    ],
    breakdown: "The value of this project is in showing the transformation, not just the final image. It demonstrates how a flat plan can become a branded environment through modeling, material choices, render framing, AI-assisted realism tests, and a supporting interactive 3D asset. Some render previews are intentionally restricted due to client privacy."
  },
  {
    id: "private-apartment-visualization",
    category: "threeD",
    categoryLabel: "3D Animation & Rendering",
    title: "Private Apartment Interior Visualization",
    subtitle: "Photoreal Blender Render Study",
    cardDescription: "A private interior visualization project focused on cinematic lighting, material detailing, and polished render presentation.",
    thumbnail: "assets/project-apartment-visualization.jpg",
    type: "3D visualization",
    client: "Private",
    year: "2025",
    role: "3D modeling and rendering",
    tools: "Blender, Photoshop",
    mainMedia: { label: "Hero render", type: "drive", id: "1Mp1hzlLclSoSisMvUzr87OWgCL1dMwi6" },
    gallery: ["1Mp1hzlLclSoSisMvUzr87OWgCL1dMwi6", "1N8ARrwt66TH01VS9sq_hHA2L8uguaR8Y", "1TckQm89sG1hWbaGzoP4w7YnIaOP9r7fx", "1fUcNfHJtvfkWPEW_6uQNOWvrmHejEXfl", "1i62QaFUR8gSWr2iFtfdn-t6Ax_jw36Jb"],
    screenshots: ["1CiFp-YzDACT2LH732eiexABE8RUCRdg7", "1NsOFOR4kdavBR7MWD9kHgi_Qk5PE4mju", "1m1d1oxg0KFdO4EFrrYa3XoquAu3X_Tr8"],
    sectionLabels: {
      gallery: { tab: "Final renders (5)", item: "Render" },
      screenshots: { tab: "Workflow screenshots (3)", item: "Screenshot" }
    },
    description: "A private apartment visualization built to present interior design details through polished 3D renders. The focus was on lighting, materials, camera framing, and a clean presentation style that makes the space feel tangible before production.",
    highlights: [
      "Created a photoreal interior presentation from a private apartment concept.",
      "Balanced warm lighting, blue accent materials, wood details, and cinematic framing.",
      "Included workflow screenshots to show the Blender build behind the final renders."
    ],
    breakdown: "This project focused on turning a private interior concept into a cohesive visual presentation. The process included 3D modeling, scene layout, lighting setup, material refinement, camera composition, and final Photoshop polish for a more premium apartment visualization."
  },
  {
    id: "apartment-floor-plan-visualization",
    category: "threeD",
    categoryLabel: "3D Animation & Rendering",
    title: "Apartment Interior Visualization",
    subtitle: "From Floor Plan to Furnishing Decisions",
    cardDescription: "A full-apartment 3D visualization translating a client floor plan into realistic room-by-room renders for confident furnishing and design decisions.",
    thumbnail: "assets/project-apartment-floor-plan-visualization.jpg",
    type: "3D visualization",
    client: "Osama",
    year: "2025",
    role: "3D modeling and rendering",
    tools: "Blender",
    mainMedia: { label: "Apartment render", type: "drive", id: "12jyuM1wb9siHtt8HiKgw8PgcTNSdaBIs" },
    gallery: [
      "12jyuM1wb9siHtt8HiKgw8PgcTNSdaBIs", "12pig-Fz9oXvq5sRic9pL3hvYTaCgSz-g", "14CiCAawsEl8H2YPhEiM1hL92nMB01gyy", "1AKE7AK0okGNm8Hl5zn3OmRC57JZtbPYw", "1AV3jOoYEOVie3PxjdZIIMTkKzM4X4Eln", "1CzwhF3w3ZRUEBPRk21qVL-bxhmPtr2Ao", "1DLEfY0WrLJZ2SBDya5viVfMJ6QatfFOt", "1F5yQU-KwJtSEF0NM0f5E9R60Av3_6Lui", "1FBJVaKJufYhEPle6uK00-5-pqXZhl7HB", "1GIEPO0VrljorriHQ1ZIja72UZDDwRQeE", "1JgNfhxucpOj22HrFz3M6XYGtsTEGoect", "1P7EGhAvNz5mlI1Vd3PlQYx_5mc9xzagh", "1RuuPM765g4xvRZE-weFZEeswWTY3uGMu", "1Tp4WIi8WSkBf7W9pzCn6EeTkfrgSBcJK", "1_HaPTDTBXMkl9-0-eMdDs9Nuh5Gh5W4Y", "1bSOVE3b2Bkdcpf9_Qhfj0w4wjT1_DVnt", "1g2ubozqUtcQbSxFpm3Z7s66EuLZZ0rM0", "1oNVXhSGbCKXKPeQnjWhQY1vBkZCUT19I", "1tR_PbFEacuIf4Etj02FLaqzZBOJnYU5q", "1yNKs4SK-KGx6Oa-yNUaG0fq7NgorRIry", "1y_9yQoZWXAK_0P1p0DeR5msoj-Bdmn39"
    ],
    sectionLabels: { gallery: { tab: "Interior render gallery (21)", item: "Render" } },
    description: "A complete apartment interior visualization built from a client floor plan to help communicate furnishing choices, room identity, lighting, and material direction before execution.",
    highlights: [
      "Translated a client floor plan into a full interior visualization.",
      "Presented multiple room types including living, dining, kitchen, bathroom, and bedroom spaces.",
      "Focused on realistic lighting, material readability, and decision-making clarity."
    ],
    breakdown: "This project was designed as a practical visualization tool for a private client. The goal was to move from a flat plan into a believable furnished environment, giving the client a clearer sense of proportions, mood, materials, and furnishing decisions before committing to real-world execution."
  },
  {
    id: "urgent-course-reel",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "2-Hour Turnaround",
    subtitle: "Urgent Course Promo Reel",
    cardDescription: "An urgent education promo reel delivered in 2 hours under deadline pressure for immediate publishing.",
    thumbnail: "assets/project-urgent-course-reel.jpg",
    type: "Reel edit",
    client: "Mr. Ahmed Samak",
    year: "2026",
    role: "Fast-turnaround reel editing",
    tools: "Premiere Pro, social export workflow",
    mainMedia: { label: "Final reel", type: "drive", id: "17M09AAN8D0vzx-_8YHT_WgctG3zGwwjj", aspect: "9 / 16", maxWidth: "360px" },
    description: "A rush educational promo reel created for an urgent course campaign. The client needed the video within 12 hours, and the final edit was delivered only 2 hours after the request.",
    highlights: [
      "Delivered in 2 hours under urgent deadline pressure.",
      "Edited for immediate social media publishing.",
      "Focused on direct pacing, clarity, and fast promotional impact."
    ],
    breakdown: "This project is about reliability under pressure. The edit needed to move quickly from raw material to a usable social-media post while keeping the message clear and the pacing direct enough for a course promotion."
  },
  {
    id: "tamatem-heroes-land-ad",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "أرض الشجعان Game Ad",
    subtitle: "Tamatem Inc. Mobile Game Campaign",
    cardDescription: "A 24-hour ad edit for Tamatem's mobile game, combining Saudi-inspired visual direction, music choices, game footage, and AI-assisted character performance.",
    thumbnail: "assets/project-tamatem-heroes-land-ad.jpg",
    type: "Game ad",
    client: "Tamatem Inc.",
    year: "2026",
    role: "Video editor, AI-assisted character workflow, sound direction",
    tools: "Premiere Pro, AI image workflow, Audio2Vid/lip-sync setup",
    mainMedia: { label: "Final ad video", type: "drive", id: "1rtbVBWQizQNauRLdSu9mdljHUGzseO-5", aspect: "9 / 16", maxWidth: "390px" },
    description: "A fast-turnaround advertising video for Tamatem Inc. and the mobile game أرض الشجعان. The project was completed within 24 hours while matching the requested creative criteria: Saudi cultural cues, music direction that supports regional authenticity, and a punchy structure aimed at young adult players.",
    highlights: [
      "Delivered the completed ad within 24 hours while meeting the client's direction and platform-ready criteria.",
      "Blended gameplay, Saudi-inspired atmosphere, and music selection to make the campaign feel locally relevant and energetic.",
      "Used an AI image plus Audio2Vid/lip-sync setup to create an anime-style character performance with realistic spoken delivery."
    ],
    breakdown: "The work focused on making the ad feel immediate, culturally grounded, and game-first. The edit combined selected gameplay beats, Saudi-inspired presentation elements, music choices, and AI-assisted character/lip-sync production into a short promotional piece for the Google Play title. The goal was to keep the video polished enough for client delivery while moving quickly enough to complete the full request within one day."
  },
  {
    id: "color-grading-raw-footage",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Raw Footage Color Grade",
    subtitle: "Color Grading Request Sample",
    cardDescription: "A focused color grading sample showing how raw-looking footage can be corrected, balanced, and shaped into a cleaner final look.",
    thumbnail: "assets/project-color-grading-raw-footage.jpg",
    type: "Color grading",
    client: "Raw footage sample",
    year: "2026",
    role: "Color grading and finishing",
    tools: "Color correction workflow, scopes, contrast and exposure pass",
    mainMedia: {
      label: "Color grading sample video",
      type: "drive",
      id: "1OLw2dQqd1wN99OL331397whlKA-GYp_6",
      aspect: "16 / 9"
    },
    description: "A short color grading sample built around a raw-to-final comparison. The focus was to take flat/raw-looking footage and give it clearer contrast, stronger color separation, cleaner exposure, and a more finished visual direction.",
    highlights: [
      "Balanced raw footage into a cleaner and more readable final image.",
      "Improved contrast, exposure, saturation, and color separation while preserving the natural look of the scene.",
      "Presented the result as a direct before-and-after comparison so clients can understand the grading value quickly."
    ],
    breakdown: "This project works as a service sample for clients who already have footage and need a more polished final look. The process is centered on correction first, then creative grading: stabilizing exposure, controlling contrast, improving color balance, and shaping the image so the final clip feels more intentional and ready for publishing."
  },
  {
    id: "plains-youtube-channel",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Plains YouTube Channel",
    subtitle: "Co-Creator & Editorial Partner",
    cardDescription: "A long-form channel collaboration supporting content direction, pacing, editing structure, and publish-ready storytelling.",
    thumbnail: "assets/project-plains-youtube-channel.jpg",
    type: "Channel production",
    client: "Plains",
    year: "Ongoing",
    role: "Co-creator and video editing contributor",
    tools: "Premiere Pro, YouTube production workflow",
    mainMedia: { label: "Open YouTube channel", type: "external", url: "https://www.youtube.com/@Plains" },
    youtubeVideos: [
      { id: "WgmfFzcpOmc", title: "دفعت 1000 جنيه لمدرب فالورانت .. والنتيجة غير متوقعة!", duration: "10:38" },
      { id: "1UQBT9-h-Es", title: "مصري متخفي في سيرفر استراليا في فالورانت 🌏", duration: "10:24" },
      { id: "_Nqzup8QzFs", title: "مصري متخفي في سيرفر الهند في فالورانت 🌏", duration: "12:14" },
      { id: "1Myr-s_QAhA", title: "مصري متخفي في سيرفر أمريكا في فالورانت 🌎", duration: "10:29" },
      { id: "_TPOWpsJnhU", title: "لاعبي فالورانت يجربو فورتنايت لأول مره", duration: "7:21" },
      { id: "RFp7mdIQjU0", title: "محترف فالورانت يجرب كاونتر سترايك لأول مره", duration: "11:03" },
      { id: "tPQExFt0rD4", title: "لقيت السيرفر اللي هيخليك غني في فالورانت 🤑", duration: "11:31" },
      { id: "3VohVmtUpXE", title: "البحث عن فتيات الانمي في فالورانت 🍣", duration: "10:04" },
      { id: "Eu9ZOW0AAyk", title: " البحث عن الزوجة الصالحة في فالورانت 👧", duration: "7:21" },
      { id: "S7W0_T7jELA", title: "Valorant | مين احسن شخصية في فالورانت؟", duration: "7:04" },
      { id: "mJaGign9zHM", title: "Valorant | اللغة العربية في فالورنت مضحكة بزيادة", duration: "7:07" },
      { id: "ddXI1_bOW8s", title: "Valorant | فالورنت مع دكتور مكاوي", duration: "7:26" }
    ],
    description: "A co-creative role supporting the development of the Plains YouTube channel through editorial structure, visual pacing, and content packaging for online audiences.",
    highlights: [
      "Contributed to channel direction and video structure.",
      "Supported editing decisions that keep content clear, watchable, and audience-friendly.",
      "Helped shape videos for a consistent YouTube viewing experience."
    ],
    breakdown: "This role reflects ongoing channel-level collaboration rather than a single isolated edit. The focus is on shaping raw ideas and footage into content that feels organized, paced correctly, and ready for YouTube publishing."
  },
  {
    id: "waraha-hekaya-sole-editor",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Waraha Hekaya",
    subtitle: "Sole Video Editor",
    cardDescription: "A dedicated editing role shaping narrative-driven YouTube content into polished, structured, and publish-ready episodes.",
    thumbnail: "assets/project-waraha-hekaya-editor.jpg",
    type: "YouTube editing",
    client: "Waraha Hekaya",
    year: "Ongoing",
    role: "Sole video editor",
    tools: "Premiere Pro, YouTube editing workflow",
    mainMedia: { label: "Open YouTube channel", type: "external", url: "https://www.youtube.com/@Waraha_Hekaya" },
    youtubeVideos: [
      { id: "Btnj4e32VQA", title: "إزاي فقير ويتيم, بني أكبر و اغلى شركة ساعات في العالم و ليه روليكس مبتحققش اى ارباح", duration: "19:00" },
      { id: "7zvICDXjrSY", title: "هل كان نجيب ساويرس رجل اعمال وطني ام ان قوه ونفوز اشهر رجل اعمال عربي كانت من البيزنس المشبوه", duration: "33:21" },
      { id: "fQEIs9v4h7M", title: "إبن بطوطة القصه الكامله بين الوفاء و الخيانة و الصدق و الدجل فى ٢٤ دقيقة", duration: "24:10" },
      { id: "n0qoDzNa5uk", title: "تيتانك القرن الواحد و العشرين قصة حادث سفينة الكوستا كونكورديا و علي متنها 3000 راكب", duration: "9:37" },
      { id: "7C9HDPB9fKY", title: "18 يوم في الجحيم معجزة بقاء 12 طفل مفقودين في كهف الرعب و عملية انقاذهم المجنونة", duration: "8:09" },
      { id: "Pk3Hggs6Cew", title: "بعثة في دايرة القطب الشمالي مات كل افرادها ماعدا ست واحدة عاشت لوحدها لمدة سنة كاملة في جزيرة منعزلة", duration: "8:44" },
      { id: "XNZ0j82kW5U", title: "قصة بون ليم المذهلة رحلة البقاء الأطول في التاريخ البحري", duration: "6:26" },
      { id: "Lf45oAQK5sQ", title: "هروب بنت عمرها 13 سنة من جحيم كوريا الشمالية | قصة يون مى بارك", duration: "9:01" },
      { id: "7SHUSj1C1Ag", title: "فاروق القاسم: العبقري العربي الذي جعل النرويج 🇳🇴 اغنى دوله في العالم", duration: "10:56" },
      { id: "OCGAYj1s4RI", title: "تاجر السلاح السعودى من اغني رجل في العالم في السبيعينات لنهاية مرعبة", duration: "20:21" },
      { id: "632K2y-94hE", title: "كيف يستعد الأغنياء لنهاية العالم", duration: "10:13" },
      { id: "QfuoEykbIb4", title: "من الرياض للفضاء: رحلة الأمير سلطان", duration: "14:24" },
      { id: "DNUUjfnm2ns", title: "مؤسس ويكيليكس الذي فضح جرائم الحكومات | جوليان اسانج", duration: "9:10" },
      { id: "6GYWpH0d6jk", title: "التاريخ الحديث للمافيا اليابانية", duration: "13:22" },
      { id: "_5Mr4v6LUag", title: "المتحكم فى ربع شركات العالم و المسيطر على المال فى الظل BLACKROCK", duration: "13:33" },
      { id: "x4GqCpnRcqg", title: "مؤسس اغنى عائلة فى الوطن العربى  أنسى ساويرس", duration: "11:04" },
      { id: "J8byxnR5FZc", title: "النهاية المؤلمة للأمام الاعظم, من قمة المجد الى زل السجن", duration: "9:43" },
      { id: "FBboQU17_3Y", title: "الجانب المظلم لليابان l اقوى مافيا فى التاريخ و المستفيد الاكبر من الانفجار النووى فى الحرب العالمية", duration: "6:52" },
      { id: "EiEKbveW3Ho", title: "القصة الحقيقية للحشاشين من البداية للنهاية", duration: "16:08" },
      { id: "8X_4WI8bonk", title: "اغنى رجال التاريخ لهم الفضل الاكبر فى قوة امريكا حتى الان رغم الكساد العظيم و الحرب العالمية 1 و 2", duration: "1:21:42" },
      { id: "ctSsvKWENPw", title: "أقوي منظمة إجرامية في التاريخ التريادز الصيني المنتشر في العالم من الصين لروسيا الي الولايات المتحدة", duration: "13:48" },
      { id: "aVfwwWh10Og", title: "الميثولوجيا الأغريقية | حكاية واحده من اقدم القصص علي الارض", duration: "8:43" },
      { id: "yJ87c6WA0Cc", title: "تابوت العهد | اهم كنز لليهود و الذى يهب قوة الرب لحامله, ما هو و اين اختفى؟", duration: "14:06" },
      { id: "pddw-CoH9Ao", title: "قصة أندرو كارنيجي (الجزء الثاني) اسرع من جمع المال و قتل الآلاف", duration: "15:05" },
      { id: "4bL1-X8KzGY", title: "إمبراطور الحديد و الصلب اندرو كارنيجي و الذى بنى أمريكا الحديثة", duration: "12:22" },
      { id: "eb6dMD6WaDU", title: "هل كان توماس اديسون اعظم مخترع فى القرن 19؟ | من طفل يبيع الجرائد الى اعظم مخترع فى القرن ال١٩", duration: "8:46" },
      { id: "3uafLCXUJf4", title: "هنري فورد | الجانب المظلم من حياه اعظم صانع للسيارات في العالم", duration: "20:14" },
      { id: "tbc_hKhxf8k", title: "J.P. MORGAN | الرجل الذي اسس الاقتصاد الامريكي الحديث", duration: "17:43" },
      { id: "r4_TLFFIQr8", title: "عائلة روتشيلد من البداية | كيف حكمت عائلة واحدة إقتصاد أوروبا بالمخابرات الاقتصاديه", duration: "12:08" },
      { id: "GYOBEudQzU0", title: "چون روكفلر | بدأ من طفل يبيع حبوب و أصبح حوت البترول و أغني رجل في التاريخ", duration: "9:12" }
    ],
    description: "A sole-editor role for Waraha Hekaya, focused on turning story material into coherent, engaging YouTube videos with clear rhythm and consistent presentation.",
    highlights: [
      "Handled the editorial shaping of channel content as sole video editor.",
      "Focused on pacing, structure, clarity, and viewer retention.",
      "Prepared episodes for a clean and consistent YouTube publishing workflow."
    ],
    breakdown: "The role requires editorial judgment across the full edit: organizing material, shaping the story, refining pacing, and making the final video feel clear and ready for the channel audience."
  },
  {
    id: "teleperformance-egypt-media-coverage",
    category: "editing",
    categoryLabel: "Video Editing",
    title: "Teleperformance Egypt",
    subtitle: "Corporate Media Coverage",
    cardDescription: "Corporate media work covering events and internal moments through videography, photography, and polished post-production.",
    thumbnail: "assets/project-teleperformance-media-coverage.jpg",
    type: "Corporate media",
    client: "Teleperformance Egypt",
    year: "2026",
    role: "Videographer, photographer, and editor",
    tools: "Premiere Pro, photography workflow, video production workflow",
    mainMedia: { label: "Media coverage role", type: "note", message: "Selected corporate coverage samples may be shared in a limited way depending on client privacy and internal publishing requirements." },
    teleProjects: [
      {
        label: "Eid Al-Adha Cairo Coverage",
        title: "Eid Al-Adha Cairo Coverage",
        type: "Event coverage",
        role: "Editor and videographer",
        contribution: "Edited the Cairo Eid Al-Adha video and filmed two of the six featured locations as part of a wider coverage push across more than twelve sites.",
        result: "Delivered under heavy deadline pressure, with the final post prepared for upload at 5 AM, roughly four hours after filming wrapped.",
        mediaType: "drive",
        id: "11IlhK3V7kDP_o4b-JiwFXUJacCJRTPnt",
        width: 16,
        height: 9
      },
      {
        label: "AI Animation Reel",
        title: "AI-assisted animation reel",
        type: "AI video production",
        role: "AI animation, sound design, and editing support",
        contribution: "Contributed to selected generated animation shots and supported the sound design and editing process alongside the media team.",
        result: "Helped shape an AI-driven brand piece into a more polished, publish-ready reel.",
        src: "https://www.facebook.com/plugins/video.php?height=476&href=https%3A%2F%2Fwww.facebook.com%2Freel%2F992537279983149%2F&show_text=true&width=265&t=0",
        width: 265,
        height: 591
      },
      {
        label: "Train to Hire",
        title: "Train to Hire Program Coverage",
        type: "Program coverage",
        role: "Videographer and co-editor",
        contribution: "Filmed two of the five visited locations and co-edited the final video with other members of the team.",
        result: "Supported a concise social video that communicates the program journey across multiple locations.",
        mediaType: "drive",
        id: "12_LgsdVk2sDeJnwEDyHFyFOZL4VYSuNI",
        width: 16,
        height: 9
      },
      {
        label: "Generated Video Edit",
        title: "Generated Video Edit",
        type: "AI-assisted edit",
        role: "Editing, stitching, and sound design",
        contribution: "Supported a co-worker's generated video by stitching the generated clips, refining the edit, and building the sound design.",
        result: "Turned separate generated assets into a cleaner finished reel with stronger continuity.",
        mediaType: "drive",
        id: "1QQie38L4w3YBiA4rrIRYREBM8Fe5U17h",
        width: 9,
        height: 16
      },
      {
        label: "20-Day Event",
        title: "20-Day Event Coverage",
        type: "Event recap",
        role: "Videographer and sole editor",
        contribution: "Participated in filming the 20-day event with four other team members, then handled the edit independently.",
        result: "Completed the editing, color grading, sound design, and final pacing for a complete event recap.",
        mediaType: "drive",
        id: "14ABaigk9Cv_x68uRd-a0kU_m9KHAVBaF",
        width: 9,
        height: 16
      },
      {
        label: "VFX-Enhanced Edit",
        title: "Edited reel with VFX finishing",
        type: "Post-production",
        role: "Editor, colorist, sound design, and VFX",
        contribution: "Handled the post-production for footage captured by another team member.",
        result: "Delivered the edit, color grade, sound design, and VFX finishing for the final social video.",
        src: "https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2Freel%2F660092163828213%2F&show_text=false&width=560&t=0",
        width: 560,
        height: 314
      }
    ],
    description: "Corporate media coverage work for Teleperformance Egypt as part of the media coverage team, combining on-ground capture with editing for internal and brand-facing communication.",
    highlights: [
      "Covered corporate events and internal brand moments through photo and video.",
      "Worked across capture and post-production instead of editing only.",
      "Created content suitable for corporate communication and social publishing."
    ],
    breakdown: "This role combines practical production and post-production: capturing key moments, organizing media, editing usable pieces, and supporting the visual coverage needs of a large corporate environment."
  },
  {
    id: "comfyui-veneer-animation",
    category: "ai",
    categoryLabel: "AI Video Editing",
    title: "AI Smile Transformation Animation",
    subtitle: "Veneer Case Motion Workflow",
    cardDescription: "A ComfyUI image-to-video workflow turning planned dental before-and-after frames into a cinematic transformation animation.",
    thumbnail: "assets/project-comfyui-ai-animation.jpg",
    type: "AI animation",
    client: "Dr. Saad Tantawy",
    year: "2026",
    role: "AI animation workflow, frame planning, and prompt direction",
    tools: "ComfyUI, Wan 2.2, image-to-video workflow",
    mainMedia: { label: "AI animation", type: "drive", id: "1vZBpsHpuFRtzJGKwiyB60JmP-jZozSzt" },
    description: "A ComfyUI image-to-video workflow using multiple planned input frames to generate a cinematic dental transformation. The project explored how frame quality, prompt control, and AI motion can make a before-and-after result feel more engaging and presentation-ready.",
    highlights: [
      "Built around a batch image-to-video workflow in ComfyUI.",
      "Used Wan 2.2 to create controlled transitions between planned input frames.",
      "Explored how prompt planning and frame quality affect the final AI animation."
    ],
    breakdown: "The project was part of a broader exploration into AI-assisted video production for clinical presentation. The strongest results showed how frame planning and precise prompting can turn static before-and-after visuals into a more engaging animated case reveal."
  },
  {
    id: "ai-building-vfx-animation",
    category: "ai",
    categoryLabel: "AI Video Editing",
    title: "AI-Powered Building VFX Animation",
    subtitle: "Drone Footage to Cinematic Motion",
    cardDescription: "A cinematic AI-assisted VFX sequence built from real drone footage, controlled frames, and a custom image-to-video workflow.",
    thumbnail: "assets/project-ai-building-vfx-animation.jpg",
    type: "AI VFX animation",
    client: "Skidmore, Owings & Merrill (SOM)",
    year: "2026",
    role: "AI VFX video editing",
    tools: "Premiere Pro, ComfyUI",
    mainMedia: { label: "Final AI VFX animation", type: "drive", id: "1R8n950aD5KmSwbZDc7ES66uzDdDf7UNx" },
    description: "A hybrid AI VFX workflow built around real drone footage of a tower. Key frames were extracted from the orbit shot, enhanced with AI-generated visual effects, then processed through a custom frame-to-video pipeline and refined in Premiere Pro.",
    highlights: [
      "Transformed real drone footage into a cinematic AI-assisted VFX sequence.",
      "Built from six controlled frames using a custom image-to-video workflow.",
      "Combined AI image editing, ComfyUI generation, and Premiere Pro finishing."
    ],
    breakdown: "The project started with drone footage orbiting the building. Selected frames were extracted and enhanced using AI image-editing tools to create a consistent VFX direction. Those frames were then processed through a dedicated image-to-video pipeline, with the final animation polished in Premiere Pro for a cleaner, more cinematic result."
  }
];

window.PORTFOLIO_PROJECTS = PROJECTS;

const PROJECT_ORDER = {
  editing: [
    "plains-youtube-channel",
    "teleperformance-egypt-media-coverage",
    "tamatem-heroes-land-ad",
    "color-grading-raw-footage",
    "urgent-course-reel",
    "waraha-hekaya-sole-editor"
  ],
  threeD: [
    "automotive-service-center",
    "private-apartment-visualization",
    "apartment-floor-plan-visualization"
  ],
  ai: [
    "comfyui-veneer-animation",
    "ai-building-vfx-animation"
  ]
};

function sortProjectsForCategory(projects, category) {
  const order = PROJECT_ORDER[category] || [];
  return [...projects].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const root = document.documentElement;
const dot = document.querySelector(".cursor-dot");
const ring = document.querySelector(".cursor-ring");
const glow = document.querySelector(".cursor-glow");
const navBar = document.querySelector(".nav");
const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let playModeActive = false;
let pointerVisualQueued = false;
let pointerVisualX = pointer.x;
let pointerVisualY = pointer.y;
const coarsePointer = window.matchMedia("(pointer: coarse)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lowPowerDevice = coarsePointer.matches || window.innerWidth <= 760 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
document.body.classList.toggle("low-power", lowPowerDevice);

function updateFunHintPosition() {
  if (!navBar) return;
  const rect = navBar.getBoundingClientRect();
  root.style.setProperty("--fun-hint-top", `${Math.ceil(rect.bottom + 8)}px`);
}

window.addEventListener("resize", updateFunHintPosition, { passive: true });
window.addEventListener("load", updateFunHintPosition, { passive: true });
if ("ResizeObserver" in window && navBar) new ResizeObserver(updateFunHintPosition).observe(navBar);
updateFunHintPosition();

let orientationShiftTimer = null;
let viewportOrientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";

function playOrientationShift() {
  document.body.classList.add("orientation-shift");
  updateFunHintPosition();
  if (orientationShiftTimer) window.clearTimeout(orientationShiftTimer);
  orientationShiftTimer = window.setTimeout(() => {
    document.body.classList.remove("orientation-shift");
    updateFunHintPosition();
  }, 720);
}

function watchOrientationShift(force = false) {
  const nextOrientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  if (!force && nextOrientation === viewportOrientation) return;
  viewportOrientation = nextOrientation;
  playOrientationShift();
}

window.addEventListener("resize", () => watchOrientationShift(), { passive: true });
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => watchOrientationShift(true), 80);
}, { passive: true });

function getPlayArenaBounds() {
  const mobile = window.innerWidth <= 720;
  const marginX = mobile ? 18 : 34;
  const top = mobile ? 76 : 82;
  const pageOffset = Math.min(880, window.innerHeight * .84);
  const safeGap = mobile ? 78 : 120;
  const floor = Math.min(top + (mobile ? 230 : 290), pageOffset - (mobile ? 56 : 74));
  const preferred = Math.min(pageOffset - safeGap, window.innerHeight * .68, window.innerHeight - safeGap);
  const bottom = Math.max(floor, preferred);
  return {
    left: marginX,
    right: Math.max(marginX + 220, window.innerWidth - marginX),
    top,
    bottom: Math.min(window.innerHeight - 42, bottom)
  };
}

function clampToPlayArena(x, y) {
  const bounds = getPlayArenaBounds();
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, y))
  };
}

function updatePointer(x, y) {
  if (playModeActive) {
    const clamped = clampToPlayArena(x, y);
    x = clamped.x;
    y = clamped.y;
  }
  pointer.x = x;
  pointer.y = y;
  pointerVisualX = x;
  pointerVisualY = y;
  if (pointerVisualQueued) return;
  pointerVisualQueued = true;
  window.requestAnimationFrame(() => {
    if (!playModeActive) {
      root.style.setProperty("--mouse-x", `${pointerVisualX}px`);
      root.style.setProperty("--mouse-y", `${pointerVisualY}px`);
      if (glow) glow.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    }
    if (dot) dot.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    if (ring) ring.style.transform = `translate(${pointerVisualX}px, ${pointerVisualY}px) translate(-50%, -50%)`;
    updatePlayerShipPosition?.();
    pointerVisualQueued = false;
  });
}

window.addEventListener("pointermove", (event) => updatePointer(event.clientX, event.clientY), { passive: true });
window.addEventListener("touchmove", (event) => {
  const touch = event.touches[0];
  if (touch) updatePointer(touch.clientX, touch.clientY);
}, { passive: true });

let activeWeightSurface = null;
const weightSurfaceStates = new WeakMap();

function getWeightState(el) {
  let state = weightSurfaceStates.get(el);
  if (!state) {
    state = {
      current: { rx: 0, ry: 0, tx: 0, ty: 0 },
      target: { rx: 0, ry: 0, tx: 0, ty: 0 },
      frame: 0
    };
    weightSurfaceStates.set(el, state);
  }
  return state;
}

function animateWeightSurface(el) {
  const state = getWeightState(el);
  state.frame = 0;
  const ease = 0.18;
  let active = false;
  ["rx", "ry", "tx", "ty"].forEach((key) => {
    const next = state.current[key] + (state.target[key] - state.current[key]) * ease;
    state.current[key] = Math.abs(next - state.target[key]) < 0.01 ? state.target[key] : next;
    if (Math.abs(state.current[key] - state.target[key]) > 0.01) active = true;
  });

  el.style.setProperty("--weight-rx", `${state.current.rx.toFixed(2)}deg`);
  el.style.setProperty("--weight-ry", `${state.current.ry.toFixed(2)}deg`);
  el.style.setProperty("--weight-tx", `${state.current.tx.toFixed(2)}px`);
  el.style.setProperty("--weight-ty", `${state.current.ty.toFixed(2)}px`);

  if (active) state.frame = window.requestAnimationFrame(() => animateWeightSurface(el));
}

function setWeightTarget(el, target) {
  if (!el?.classList?.contains("weight-reactive")) return;
  const state = getWeightState(el);
  Object.assign(state.target, target);
  if (!state.frame) state.frame = window.requestAnimationFrame(() => animateWeightSurface(el));
}

function resetWeightSurface(el) {
  if (!el?.classList?.contains("weight-reactive")) return;
  setWeightTarget(el, { rx: 0, ry: 0, tx: 0, ty: 0 });
}

function getActiveWeightCandidate(target) {
  return target?.closest?.(".text-weight-reactive, .weight-reactive") || null;
}

function bindInteractiveSurface(el) {
  if (!el || el.dataset.surfaceBound === "true") return;
  el.dataset.surfaceBound = "true";
  el.addEventListener("mouseenter", () => document.body.classList.add("cursor-active"));
  el.addEventListener("mouseleave", () => {
    document.body.classList.remove("cursor-active");
    if (activeWeightSurface === el) activeWeightSurface = null;
    resetWeightSurface(el);
  });
  if (lowPowerDevice) return;
  if (el.matches(".interactive, .nav, .section-head, .gallery-head, .hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .role-card, .choice-btn, .request-main-btn, .send-request, .contact-link, .info-box, .highlight, .media-item, .youtube-card")) {
    el.classList.add("weight-reactive");
  }
  if (el.matches(".section-head h2, .section-head p, .gallery-head h3, .gallery-head p, .request-card h2, .request-card p, .contact-card h2, .contact-card p, .hero-copy h1, .hero-desc")) {
    el.classList.add("text-weight-reactive", "weight-reactive");
  }
  let localQueued = false;
  let localX = 50;
  let localY = 50;
  let weightX = 0;
  let weightY = 0;
  let shouldTilt = false;
  el.addEventListener("pointermove", (event) => {
    const rect = el.getBoundingClientRect();
    localX = ((event.clientX - rect.left) / rect.width) * 100;
    localY = ((event.clientY - rect.top) / rect.height) * 100;
    weightX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width - .5));
    weightY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height - .5));
    const activeCandidate = getActiveWeightCandidate(event.target);
    const canTilt = el.classList.contains("weight-reactive") && activeCandidate === el;
    if (el.classList.contains("weight-reactive") && !canTilt) {
      if (activeWeightSurface === el) activeWeightSurface = null;
      resetWeightSurface(el);
    }
    if (canTilt && activeWeightSurface !== el) {
      resetWeightSurface(activeWeightSurface);
      activeWeightSurface = el;
    }
    shouldTilt = canTilt;
    if (localQueued) return;
    localQueued = true;
    window.requestAnimationFrame(() => {
      el.style.setProperty("--local-x", `${localX}%`);
      el.style.setProperty("--local-y", `${localY}%`);
      if (shouldTilt) {
        setWeightTarget(el, {
          rx: -weightY * 7,
          ry: weightX * 8,
          tx: weightX * 4,
          ty: weightY * 4
        });
      }
      localQueued = false;
    });
  });
}

document.querySelectorAll("a, button, .project-card, .interactive, .section-head, .gallery-head, .section-head h2, .section-head p, .gallery-head h3, .gallery-head p, .request-card h2, .request-card p, .contact-card h2, .contact-card p, .hero-copy h1, .hero-desc, .info-box, .highlight").forEach(bindInteractiveSurface);

const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .13 });

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 45, 360)}ms`;
  observer.observe(item);
});

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    tabContents.forEach((panel) => panel.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function drivePreview(id) { return `https://drive.google.com/file/d/${id}/preview`; }
function driveView(id) { return `https://drive.google.com/file/d/${id}/view`; }
function driveThumbnail(id) { return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`; }

function renderProjects() {
  const tracks = document.querySelectorAll(".project-track");
  tracks.forEach((track) => {
      const category = track.dataset.category;
      const items = sortProjectsForCategory(PROJECTS.filter((project) => project.category === category), category);
    track.innerHTML = items.map((project) => `
      <article class="project-card interactive" tabindex="0" data-project="${project.id}" aria-label="Open project: ${project.title}">
        <div class="project-thumb" style="background-image:url('${project.thumbnail}')">
          <span class="press-label">Press to explore -></span>
        </div>
        <div class="project-body">
          <div>
            <div class="kicker">${project.categoryLabel}</div>
            <h3>${project.title}</h3>
            <p>${project.subtitle}</p>
            <p style="margin-top:10px">${project.cardDescription}</p>
          </div>
          <div class="project-meta">
            <span class="pill orange">${project.type}</span>
            <span class="pill">${project.year}</span>
            <span class="pill">${project.client}</span>
          </div>
        </div>
      </article>
    `).join("");
  });

  document.querySelectorAll(".project-card").forEach((card) => {
    const open = () => openProject(card.dataset.project);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    bindInteractiveSurface(card);
  });
}

renderProjects();
runSmartIntroLoader();

document.querySelectorAll(".arrow-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const track = document.querySelector(`.project-track[data-category="${button.dataset.scroll}"]`);
    const direction = Number(button.dataset.dir);
    track.scrollBy({ left: direction * Math.min(620, window.innerWidth * .82), behavior: "smooth" });
  });
});

const modal = document.getElementById("projectModal");
const stage = document.getElementById("stage");
const mediaTabs = document.getElementById("mediaTabs");
const mediaList = document.getElementById("mediaList");
const openExternal = document.getElementById("openExternal");
const expandBtn = document.getElementById("expandBtn");
const breakdown = document.getElementById("breakdown");
let currentProject = null;
let youtubeScrollTimer = null;

function setStageHTML(html, externalUrl = "#", options = {}) {
  stage.innerHTML = html;
  stage.classList.remove("stage-portrait", "stage-wide", "stage-facebook", "stage-youtube", "stage-drive");
  if (options.className) stage.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  stage.style.setProperty("--stage-aspect", options.aspect || "16 / 9");
  stage.style.setProperty("--stage-max-width", options.maxWidth || "100%");
  openExternal.href = externalUrl;
  openExternal.style.display = externalUrl === "#" ? "none" : "inline-flex";
}

function loadDriveMedia(id, label = "Drive media", options = {}) {
  setStageHTML(
    `<iframe title="${label}" src="${drivePreview(id)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
    driveView(id),
    {
      className: `stage-drive ${options.aspect === "9 / 16" ? "stage-portrait" : ""}`,
      aspect: options.aspect || "16 / 9",
      maxWidth: options.maxWidth || "100%"
    }
  );
}

function loadImageMedia(media = {}) {
  const src = media.src || media.thumbnail || "";
  setStageHTML(
    `<img src="${escapeHTML(src)}" alt="${escapeHTML(media.label || "Project preview")}" loading="lazy" decoding="async" />`,
    media.url || "#",
    {
      className: media.className || "stage-wide",
      aspect: media.aspect || "16 / 9",
      maxWidth: media.maxWidth || "100%"
    }
  );
}

function loadSketchfab(url) {
  setStageHTML(`<iframe title="Interactive 3D model" src="${url}" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen></iframe>`, url.replace("/embed", ""), { className: "stage-wide" });
}

function youtubeThumb(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function youtubeWatch(id) { return `https://www.youtube.com/watch?v=${id}`; }
function youtubeEmbed(id) { return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`; }
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function clearYouTubeNowPlaying() {
  document.getElementById("youtubeNowPlaying")?.remove();
}

function setYouTubeNowPlaying(video) {
  clearYouTubeNowPlaying();
  if (!video || !stage) return;
  const info = document.createElement("div");
  info.id = "youtubeNowPlaying";
  info.className = "youtube-now-playing";
  info.innerHTML = `
    <small>Now playing</small>
    <strong class="youtube-now-title">${escapeHTML(video.title)}</strong>
    <a class="youtube-play-link" href="${youtubeWatch(video.id)}" target="_blank" rel="noopener">Play on YouTube</a>
  `;
  stage.insertAdjacentElement("afterend", info);
}

function loadYouTubeVideo(video) {
  if (!video) return;
  setStageHTML(`<iframe title="${escapeHTML(video.title)}" src="${youtubeEmbed(video.id)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`, youtubeWatch(video.id), { className: "stage-youtube" });
  setYouTubeNowPlaying(video);
}

function loadExternalMedia(media) {
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">-></div>
        <strong>${media.label || "External project link"}</strong>
        <p>${media.message || "Open this project externally to view the related channel or reference."}</p>
      </div>
    </div>
  `, media.url || "#");
}

function loadNoteMedia(media) {
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">i</div>
        <strong>${media.label || "Project note"}</strong>
        <p>${media.message || "Selected media for this project is available on request or shown in a limited way due to client privacy."}</p>
      </div>
    </div>
  `, "#");
}

function getSectionMeta(section) {
  return currentProject?.sectionLabels?.[section] || {};
}

function showLockedSection(section) {
  const locked = currentProject.lockedSections?.[section] || {};
  const count = (currentProject[section] || []).length;
  const itemLabel = locked.item || "Protected media";
  mediaList.innerHTML = Array.from({ length: count }, (_, i) => `
    <button class="media-item" type="button" title="Locked for client privacy" data-locked="true">
      Locked ${itemLabel} ${String(i + 1).padStart(2, "0")}
    </button>
  `).join("");
  setStageHTML(`
    <div class="locked-stage">
      <div>
        <div class="lock-icon">L</div>
        <strong>${locked.title || "Media locked"}</strong>
        <p>${locked.message || "This media is locked for client privacy."}</p>
      </div>
    </div>
  `, "#");
  document.querySelectorAll(".media-item[data-locked='true']").forEach((item) => {
    item.addEventListener("click", () => showLockedSection(section));
  });
}

function showDriveSection(section, index = 0) {
  const items = currentProject[section] || [];
  const meta = getSectionMeta(section);
  const itemLabel = meta.item || (section === "aiRenders" ? "AI sample" : section === "screenshots" ? "Screenshot" : "Render");
  mediaList.innerHTML = items.map((id, i) => `<button class="media-item ${i === index ? "active" : ""}" type="button" data-kind="${section}" data-index="${i}">${itemLabel} ${String(i + 1).padStart(2, "0")}</button>`).join("");
  if (items[index]) loadDriveMedia(items[index], `${itemLabel} ${index + 1}`);
  document.querySelectorAll(".media-item").forEach((item) => {
    item.addEventListener("click", () => showMediaSection(item.dataset.kind, Number(item.dataset.index)));
  });
}

function renderBaseProjectInfo(project) {
  if (!project) return;
  document.getElementById("modalCategory").textContent = project.categoryLabel;
  document.getElementById("modalTitle").innerHTML = `${project.title}<br><span style="color:var(--orange)">${project.subtitle}</span>`;
  document.getElementById("modalDescription").textContent = project.description;
  document.getElementById("modalInfoGrid").innerHTML = `
    <div class="info-box"><small>Client</small><strong>${project.client}</strong></div>
    <div class="info-box"><small>Year</small><strong>${project.year}</strong></div>
    <div class="info-box"><small>Role</small><strong>${project.role}</strong></div>
    <div class="info-box"><small>Tools</small><strong>${project.tools}</strong></div>
  `;
  document.getElementById("modalHighlights").innerHTML = project.highlights.map((item) => `<div class="highlight">${item}</div>`).join("");
  breakdown.innerHTML = `<h3>Full breakdown</h3><p>${project.breakdown}</p>`;
}

function renderTeleProjectInfo(item) {
  document.getElementById("modalCategory").textContent = "Teleperformance Egypt | Media Coverage Role";
  document.getElementById("modalTitle").innerHTML = `${escapeHTML(item.title)}<br><span style="color:var(--orange)">${escapeHTML(item.type)}</span>`;
  document.getElementById("modalDescription").textContent = item.contribution;
  const format = item.height > item.width ? "Vertical reel" : "Landscape social video";
  const platform = item.mediaType === "drive" ? "Google Drive portfolio preview" : "Official public social post";
  document.getElementById("modalInfoGrid").innerHTML = `
    <div class="info-box"><small>Project</small><strong>${escapeHTML(item.label)}</strong></div>
    <div class="info-box"><small>Role</small><strong>${escapeHTML(item.role)}</strong></div>
    <div class="info-box"><small>Source</small><strong>${platform}</strong></div>
    <div class="info-box"><small>Format</small><strong>${format}</strong></div>
  `;
  document.getElementById("modalHighlights").innerHTML = `
    <div class="highlight">${escapeHTML(item.contribution)}</div>
    <div class="highlight">${escapeHTML(item.result)}</div>
  `;
  breakdown.innerHTML = `<h3>Contribution note</h3><p>${escapeHTML(item.result)}</p>`;
  breakdown.classList.remove("open");
  expandBtn.textContent = "Show full breakdown";
}

function getTeleProjectAspect(item) {
  return `${item.width || 16} / ${item.height || 9}`;
}

function loadTeleProjectMedia(item) {
  if (item.mediaType === "drive" && item.id) {
    const portrait = item.height > item.width;
    loadDriveMedia(item.id, item.title, {
      aspect: getTeleProjectAspect(item),
      maxWidth: portrait ? "360px" : "100%"
    });
    return;
  }

  const aspect = `${item.width} / ${item.height}`;
  const portrait = item.height > item.width;
  setStageHTML(
    `<iframe title="${escapeHTML(item.title)}" src="${item.src}" loading="lazy" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`,
    item.src,
    {
      className: `stage-facebook ${portrait ? "stage-portrait" : "stage-wide"}`,
      aspect,
      maxWidth: portrait ? "330px" : "100%"
    }
  );
}

function showTeleProjectsSection(index = 0) {
  const items = currentProject.teleProjects || [];
  mediaList.classList.add("youtube-list", "tele-list");
  mediaList.innerHTML = `
    <div class="tele-projects-title">Projects I worked on</div>
    ${items.map((item, i) => `
      <button class="youtube-card tele-card ${i === index ? "active" : ""}" type="button" data-tele-index="${i}" aria-label="Open ${escapeHTML(item.title)}">
        <span class="youtube-thumb tele-thumb">
          ${item.mediaType === "drive" && item.id
            ? `<img src="${driveThumbnail(item.id)}" alt="${escapeHTML(item.title)}" loading="lazy" />`
            : `<span class="tele-thumb-fallback">${escapeHTML(item.label)}</span>`}
          <span class="youtube-duration">${escapeHTML(item.type)}</span>
        </span>
      </button>
    `).join("")}
    <p class="tele-privacy-note">Additional B2B deliverables are protected by client confidentiality and are not shown here. This selection includes work that is publicly available through official social channels or approved for portfolio viewing.</p>
  `;
  const item = items[index];
  if (item) {
    loadTeleProjectMedia(item);
    renderTeleProjectInfo(item);
  }
  const cards = [...mediaList.querySelectorAll(".tele-card")];
  cards.forEach(bindInteractiveSurface);
  let raf = 0;
  const updateDepth = () => {
    raf = 0;
    const listRect = mediaList.getBoundingClientRect();
    const top = listRect.top + 42;
    const range = Math.max(1, listRect.bottom - top);
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const progress = Math.max(0, Math.min(1, (centerY - top) / range));
      const closeness = Math.max(0, 1 - progress);
      card.style.setProperty("--yt-scale", (.84 + closeness * .16).toFixed(3));
      card.style.setProperty("--yt-opacity", (.52 + closeness * .48).toFixed(3));
      card.style.setProperty("--yt-depth", `${(-42 + closeness * 42).toFixed(1)}px`);
      card.style.setProperty("--yt-tilt", `${(7 - closeness * 7).toFixed(2)}deg`);
    });
  };
  const requestDepthUpdate = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(updateDepth);
  };
  cards.forEach((button) => {
    button.addEventListener("click", () => {
      const nextIndex = Number(button.dataset.teleIndex);
      cards.forEach((card, i) => card.classList.toggle("active", i === nextIndex));
      button.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      const nextItem = items[nextIndex];
      if (nextItem) {
        loadTeleProjectMedia(nextItem);
        renderTeleProjectInfo(nextItem);
      }
      requestDepthUpdate();
    });
  });
  requestDepthUpdate();
  mediaList.onscroll = requestDepthUpdate;
}

function showYouTubeSection(index = 0) {
  const videos = currentProject.youtubeVideos || [];
  mediaList.classList.add("youtube-list");
  mediaList.innerHTML = videos.map((video, i) => `
    <button class="youtube-card ${i === index ? "active" : ""}" type="button" data-youtube-index="${i}" aria-label="Play ${escapeHTML(video.title)}">
      <span class="youtube-thumb">
        <img src="${youtubeThumb(video.id)}" alt="${escapeHTML(video.title)}" loading="lazy" />
        <span class="youtube-duration">${video.duration}</span>
      </span>
    </button>
  `).join("");
  loadYouTubeVideo(videos[index]);
  const cards = [...mediaList.querySelectorAll(".youtube-card")];
  cards.forEach(bindInteractiveSurface);
  let raf = 0;
  const setActive = (nextIndex, play = true) => {
    cards.forEach((button, i) => button.classList.toggle("active", i === nextIndex));
    if (play) loadYouTubeVideo(videos[nextIndex]);
  };
  const updateDepth = () => {
    raf = 0;
    const listRect = mediaList.getBoundingClientRect();
    const top = listRect.top + 8;
    const bottom = listRect.bottom;
    const range = Math.max(1, bottom - top);
    let nearest = { i: 0, dist: Infinity };
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const progress = Math.max(0, Math.min(1, (centerY - top) / range));
      const closeness = Math.max(0, 1 - progress);
      const scale = .84 + closeness * .16;
      const opacity = .46 + closeness * .54;
      const depth = -46 + closeness * 46;
      const tilt = 8 - closeness * 8;
      card.style.setProperty("--yt-scale", scale.toFixed(3));
      card.style.setProperty("--yt-opacity", opacity.toFixed(3));
      card.style.setProperty("--yt-depth", `${depth.toFixed(1)}px`);
      card.style.setProperty("--yt-tilt", `${tilt.toFixed(2)}deg`);
      const dist = Math.abs(rect.top - top);
      if (dist < nearest.dist) nearest = { i, dist };
    });
    cards.forEach((button, i) => button.classList.toggle("active", i === nearest.i));
  };
  const requestDepthUpdate = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(updateDepth);
  };
  cards.forEach((item) => {
    item.addEventListener("click", () => {
      const nextIndex = Number(item.dataset.youtubeIndex);
      item.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      setActive(nextIndex);
      requestDepthUpdate();
    });
  });
  requestDepthUpdate();
  mediaList.onscroll = () => {
    requestDepthUpdate();
    if (youtubeScrollTimer) window.clearTimeout(youtubeScrollTimer);
    youtubeScrollTimer = window.setTimeout(() => {
      const listRect = mediaList.getBoundingClientRect();
      const top = listRect.top + 8;
      const nearest = cards
        .map((card, i) => ({ i, dist: Math.abs(card.getBoundingClientRect().top - top) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (nearest) setActive(nearest.i, true);
    }, 140);
  };
}

function showMediaSection(section, index = 0) {
  if (!currentProject) return;
  renderBaseProjectInfo(currentProject);
  document.querySelectorAll(".media-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.section === section));
  mediaList.innerHTML = "";
  mediaList.classList.remove("youtube-list", "tele-list");
  mediaList.onscroll = null;
  clearYouTubeNowPlaying();
  modal.querySelector(".modal-card")?.classList.toggle("youtube-mode", section === "youtube");
  modal.querySelector(".modal-card")?.classList.toggle("facebook-mode", Boolean(currentProject.teleProjects?.length));

  if (section === "main") {
    if (currentProject.teleProjects?.length) {
      showTeleProjectsSection(index);
      return;
    }
    const media = currentProject.mainMedia || {};
    if (media.type === "external") loadExternalMedia(media);
    else if (media.type === "note") loadNoteMedia(media);
    else if (media.type === "image") loadImageMedia(media);
    else loadDriveMedia(media.id, media.label, media);
    return;
  }

  if (currentProject.lockedSections?.[section]) {
    showLockedSection(section);
    return;
  }

  if (section === "gallery" || section === "aiRenders" || section === "screenshots") {
    showDriveSection(section, index);
    return;
  }

  if (section === "youtube") {
    showYouTubeSection(index);
    return;
  }

  if (section === "sketchfab") {
    loadSketchfab(currentProject.sketchfab);
  }
}

function openProject(projectId) {
  currentProject = PROJECTS.find((project) => project.id === projectId);
  if (!currentProject) return;

  renderBaseProjectInfo(currentProject);
  breakdown.classList.remove("open");
  expandBtn.textContent = "Show full breakdown";

  const sectionLabel = (id, fallback) => currentProject.lockedSections?.[id]?.tab || currentProject.sectionLabels?.[id]?.tab || fallback;
  const sections = [];
  if (currentProject.youtubeVideos?.length) sections.push({ id: "youtube", label: `Full YouTube videos (${currentProject.youtubeVideos.length})` });
  sections.push({ id: "main", label: currentProject.mainMedia.label || "Main media" });
  if (currentProject.gallery?.length) sections.push({ id: "gallery", label: sectionLabel("gallery", `Render gallery (${currentProject.gallery.length})`) });
  if (currentProject.aiRenders?.length) sections.push({ id: "aiRenders", label: sectionLabel("aiRenders", `AI realism (${currentProject.aiRenders.length})`) });
  if (currentProject.screenshots?.length) sections.push({ id: "screenshots", label: sectionLabel("screenshots", `Workflow screenshots (${currentProject.screenshots.length})`) });
  if (currentProject.sketchfab) sections.push({ id: "sketchfab", label: "Interactive 3D model" });
  mediaTabs.innerHTML = sections.map((section, i) => `<button class="media-tab ${i === 0 ? "active" : ""}" type="button" data-section="${section.id}">${section.label}</button>`).join("");
  document.querySelectorAll(".media-tab").forEach((tab) => tab.addEventListener("click", () => showMediaSection(tab.dataset.section)));
  showMediaSection(sections[0]?.id || "main");

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProject() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.querySelector(".modal-card")?.classList.remove("youtube-mode", "facebook-mode");
  clearYouTubeNowPlaying();
  stage.innerHTML = "";
  mediaList.innerHTML = "";
  currentProject = null;
  document.body.style.overflow = "";
}

document.querySelector(".close-modal").addEventListener("click", closeProject);
modal.addEventListener("click", (event) => { if (event.target === modal) closeProject(); });
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeProject();
  if (event.key === "Escape" && mailConfirmation?.classList.contains("open")) closeMailConfirmation();
});
expandBtn.addEventListener("click", () => {
  breakdown.classList.toggle("open");
  expandBtn.textContent = breakdown.classList.contains("open") ? "Hide full breakdown" : "Show full breakdown";
});

const requestTool = document.getElementById("requestTool");
const makeRequestBtn = document.getElementById("makeRequestBtn");
const requestChoices = document.getElementById("requestChoices");
const requestSubChoices = document.getElementById("requestSubChoices");
const requestForm = document.getElementById("requestForm");
const requestTypeSelect = document.getElementById("requestTypeSelect");
const requestDetails = document.getElementById("requestDetails");
const sendRequestBtn = document.getElementById("sendRequestBtn");
const mailOptions = document.getElementById("mailOptions");
const mailConfirmation = document.getElementById("mailConfirmation");
const mailConfirmationClose = document.getElementById("mailConfirmationClose");
const mailConfirmationText = document.getElementById("mailConfirmationText");
const REQUEST_EMAIL = "contact@ezz-tantawy.org";
let selectedRequestCategory = "";
let selectedRequestType = "3D Modeling & Visualization - Interior Design";

const requestGroups = {
  threeD: {
    label: "3D Modeling & Visualization",
    prompt: "Choose a 3D focus",
    options: [
      {
        value: "3D Modeling & Visualization - Interior Design",
        label: "Interior Design Visualization",
        body: "Hello Ezz,\n\nI would like to request support with an interior design visualization project.\n\nProject overview:\nSpace type and approximate size:\nDesign style or references:\nAvailable plans, photos, or measurements:\nPreferred deliverables:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "3D Modeling & Visualization - Product Visualization",
        label: "Product Visualization",
        body: "Hello Ezz,\n\nI would like to request product visualization work for a brand or product presentation.\n\nProduct overview:\nRequired visuals or animation:\nAvailable product files, photos, or references:\nPreferred style, mood, or examples:\nUsage platform:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "3D Modeling & Visualization - 3D Animation",
        label: "3D Animation",
        body: "Hello Ezz,\n\nI would like to request a 3D animation project.\n\nProject goal:\nScene, product, or space to animate:\nApproximate duration:\nVisual references or style direction:\nAvailable assets:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      }
    ]
  },
  editing: {
    label: "Video Editing",
    prompt: "Choose an editing focus",
    options: [
      {
        value: "Video Editing - Short-Form Reel Editing",
        label: "Short-Form Reel Editing",
        body: "Hello Ezz,\n\nI would like to request short-form reel editing.\n\nProject goal:\nPlatform and format:\nApproximate number of reels:\nFootage status:\nPreferred pacing, captions, or reference style:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "Video Editing - Long-Form Video Editing",
        label: "Long-Form Video Editing",
        body: "Hello Ezz,\n\nI would like to request long-form video editing.\n\nProject goal:\nApproximate final duration:\nFootage status and total raw footage length:\nStructure, story, or reference videos:\nRequired graphics, captions, or sound work:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "Video Editing - Motion Design",
        label: "Motion Design",
        body: "Hello Ezz,\n\nI would like to request motion design support.\n\nProject goal:\nType of motion graphics needed:\nBrand assets or visual guidelines:\nPreferred animation style or references:\nFinal format and usage platform:\nTimeline or deadline:\nAdditional notes:\n\nThank you,"
      }
    ]
  },
  longTerm: {
    label: "Long-Term Project Request",
    prompt: "Choose a collaboration window",
    options: [
      {
        value: "Long-Term Project Request - 1-3 Months",
        label: "1-3 Months",
        body: "Hello Ezz,\n\nI would like to discuss a 1-3 month creative collaboration.\n\nProject or brand overview:\nSupport needed:\nExpected weekly or monthly workload:\nMain deliverables:\nCommunication and review rhythm:\nIdeal start date:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "Long-Term Project Request - 3-6 Months",
        label: "3-6 Months",
        body: "Hello Ezz,\n\nI would like to discuss a 3-6 month production collaboration.\n\nProject or brand overview:\nSupport needed:\nExpected weekly or monthly workload:\nMain deliverables:\nCommunication and review rhythm:\nIdeal start date:\nAdditional notes:\n\nThank you,"
      },
      {
        value: "Long-Term Project Request - 6+ Months",
        label: "6+ Months",
        body: "Hello Ezz,\n\nI would like to discuss an ongoing creative partnership for more than 6 months.\n\nProject or brand overview:\nSupport needed:\nExpected weekly or monthly workload:\nMain deliverables:\nCommunication and review rhythm:\nIdeal start date:\nAdditional notes:\n\nThank you,"
      }
    ]
  }
};

const requestOptionsByValue = Object.fromEntries(
  Object.entries(requestGroups).flatMap(([category, group]) => (
    group.options.map((option) => [option.value, { ...option, category, categoryLabel: group.label }])
  ))
);

function openRequestChoices() {
  requestTool.classList.add("choices-open");
  requestChoices.setAttribute("aria-hidden", "false");
}

function renderRequestSubChoices(category) {
  const group = requestGroups[category];
  if (!group) return;
  selectedRequestCategory = category;
  requestSubChoices.innerHTML = `
    <div class="request-step-label" id="requestSubLabel">${group.prompt}</div>
    ${group.options.map((option) => `<button class="choice-btn subchoice-btn interactive" type="button" data-request-value="${option.value}">${option.label}</button>`).join("")}
  `;
  requestSubChoices.querySelectorAll(".subchoice-btn").forEach(bindInteractiveSurface);
  refreshDamageTargets?.();
  document.querySelectorAll(".request-choices .choice-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === category));
  requestTool.classList.add("choices-open", "subchoices-open");
  requestTool.classList.remove("mail-open");
  requestChoices.setAttribute("aria-hidden", "false");
  requestSubChoices.setAttribute("aria-hidden", "false");
  requestForm.setAttribute("aria-hidden", "true");
  mailOptions.setAttribute("aria-hidden", "true");
  sendRequestBtn.querySelector("span").textContent = "Send request";
}

function selectRequestCategory(category) {
  renderRequestSubChoices(category);
  requestTool.classList.remove("form-open");
}

function updateAutoRequestText(option) {
  requestDetails.value = option.body;
  requestDetails.placeholder = "Add details, remove anything that does not apply, or leave the prepared note as it is.";
}

function selectRequestType(type) {
  const option = requestOptionsByValue[type] || requestOptionsByValue[selectedRequestType];
  if (!option) return;
  selectedRequestType = option.value;
  if (selectedRequestCategory !== option.category) renderRequestSubChoices(option.category);
  requestTypeSelect.value = option.value;
  document.querySelectorAll(".subchoice-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.requestValue === option.value));
  document.querySelectorAll(".request-choices .choice-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.category === option.category));
  requestTool.classList.add("choices-open", "subchoices-open", "form-open");
  requestTool.classList.remove("mail-open");
  requestChoices.setAttribute("aria-hidden", "false");
  requestSubChoices.setAttribute("aria-hidden", "false");
  requestForm.setAttribute("aria-hidden", "false");
  mailOptions.setAttribute("aria-hidden", "true");
  updateAutoRequestText(option);
  sendRequestBtn.querySelector("span").textContent = "Send request";
  window.setTimeout(() => requestDetails.focus({ preventScroll: true }), 260);
}

makeRequestBtn.addEventListener("click", openRequestChoices);

requestTypeSelect.addEventListener("change", () => selectRequestType(requestTypeSelect.value));
function buildEmailUrls() {
  const type = requestTypeSelect.value || selectedRequestType || "General Project";
  const subject = `Request | ${type} |`;
  const body = requestDetails.value.trim();
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(REQUEST_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(REQUEST_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  };
}

function showMailOptions() {
  requestTool.classList.add("mail-open");
  mailOptions.setAttribute("aria-hidden", "false");
  sendRequestBtn.querySelector("span").textContent = "Choose email app";
}

function sendProjectRequest(provider) {
  const urls = buildEmailUrls();
  const labels = { gmail: "Gmail", outlook: "Outlook" };
  const selectedProvider = provider in urls ? provider : "gmail";
  const openedWindow = window.open(urls[selectedProvider], "_blank");
  if (openedWindow) openedWindow.opener = null;
  if (mailConfirmationText) {
    mailConfirmationText.textContent = `${labels[selectedProvider]} should now open your prepared request in a new tab or mail app. Please review the draft and press send when you are ready. If no window appeared, allow popups and choose the email app again.`;
  }
  mailConfirmation?.classList.add("open");
  mailConfirmation?.setAttribute("aria-hidden", "false");
}

function closeMailConfirmation() {
  mailConfirmation?.classList.remove("open");
  mailConfirmation?.setAttribute("aria-hidden", "true");
}

requestDetails.placeholder = "A short project intro will appear here after you choose a request focus. You can edit it, add details, or clear it before sending.";

sendRequestBtn.addEventListener("click", showMailOptions);
mailConfirmationClose?.addEventListener("click", closeMailConfirmation);
mailConfirmation?.addEventListener("click", (event) => {
  if (event.target === mailConfirmation) closeMailConfirmation();
});

document.addEventListener("click", (event) => {
  const makeButton = event.target.closest?.("#makeRequestBtn");
  const categoryButton = event.target.closest?.(".choice-btn[data-category]");
  const subchoiceButton = event.target.closest?.(".subchoice-btn[data-request-value]");
  const sendButton = event.target.closest?.("#sendRequestBtn");
  const mailButton = event.target.closest?.(".mail-option[data-provider]");

  if (makeButton) {
    event.preventDefault();
    event.stopPropagation();
    openRequestChoices();
  }

  if (categoryButton) {
    event.preventDefault();
    event.stopPropagation();
    selectRequestCategory(categoryButton.dataset.category);
  }

  if (subchoiceButton) {
    event.preventDefault();
    event.stopPropagation();
    selectRequestType(subchoiceButton.dataset.requestValue);
  }

  if (sendButton) {
    event.preventDefault();
    event.stopPropagation();
    showMailOptions();
  }

  if (mailButton) {
    event.preventDefault();
    event.stopPropagation();
    sendProjectRequest(mailButton.dataset.provider);
  }
});

document.getElementById("discordLink").addEventListener("click", (event) => {
  event.preventDefault();
  navigator.clipboard?.writeText("ezeldeentantawy");
  event.currentTarget.querySelector("span:last-child").textContent = "Copied: ezeldeentantawy";
});

const playModeBtn = document.getElementById("playModeBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const gameRequestBtn = document.getElementById("gameRequestBtn");
const closeGameOverBtn = document.getElementById("closeGameOverBtn");
const soundToggle = document.getElementById("soundToggle");
const arenaStatus = document.getElementById("arenaStatus");
const bossStatus = document.getElementById("bossStatus");
const playerShip = document.getElementById("playerShip");
const gameOverPanel = document.getElementById("gameOverPanel");
const gameOverBackdrop = document.getElementById("gameOverBackdrop");
const levelTransitionPanel = document.getElementById("levelTransitionPanel");
const levelTransitionKicker = document.getElementById("levelTransitionKicker");
const levelTransitionTitle = document.getElementById("levelTransitionTitle");
const levelTransitionText = document.getElementById("levelTransitionText");
const levelRestartBtn = document.getElementById("levelRestartBtn");
const scrollLockWarning = document.getElementById("scrollLockWarning");
const levelStatus = document.getElementById("levelStatus");
const killsStatus = document.getElementById("killsStatus");
const healthStatus = document.getElementById("healthStatus");
const healthBar = document.getElementById("healthBar");
const shieldStatus = document.getElementById("shieldStatus");
const shieldBar = document.getElementById("shieldBar");
const powerupStatus = document.getElementById("powerupStatus");
const FINAL_LEVEL = 10;
const PLAYER_DAMAGE_MULTIPLIER = .25;
const BASE_SHIP_HP = 12;
const BASE_BOSS_HP_MULTIPLIER = 3;
const SHIELD_MAX = 100;
const SHIELD_PICKUP = 25;
const isMobileViewport = () => window.innerWidth <= 720 || coarsePointer.matches;
const particleBudget = (desktop, mobile) => lowPowerDevice ? Math.max(1, Math.floor(mobile * .65)) : (isMobileViewport() ? mobile : desktop);
let gameLost = false;
let gameWon = false;
let gameAudio = null;
let melodyTimer = null;
let musicStep = 0;
let musicBar = 0;
let bossMusicMode = false;
let audioMuted = false;
let score = 0;
let playerHealth = 100;
let shieldHP = 0;
let currentLevel = 1;
let currentLevelPattern = 1;
let enemyHealthMultiplier = 1;
let levelItemDropped = false;
let straightStacks = 0;
let diagonalStacks = 0;
let blastStacks = 0;
let lastPlayerShot = 0;
let lastEnemyShot = 0;
let playerInvulnerableUntil = 0;
let pointerShooting = false;
let lockedScrollY = 0;
let warningTimer = null;
let levelTransitionTimer = null;
let levelOverlayTimer = null;
let lastBossCollision = 0;
const playerBullets = [];
const enemyProjectiles = [];
const enemyLasers = [];
const powerUps = [];

if (closeGameOverBtn) closeGameOverBtn.textContent = "X";

function updatePlayerShipPosition() {
  root.style.setProperty("--player-x", `${pointer.x}px`);
  root.style.setProperty("--player-y", `${pointer.y}px`);
}

function hideLevelTransition(force = false) {
  if (!force && gameWon) return;
  if (levelOverlayTimer) window.clearTimeout(levelOverlayTimer);
  levelOverlayTimer = null;
  document.body.classList.remove("level-transition");
  levelTransitionPanel?.setAttribute("aria-hidden", "true");
}

function showLevelTransition(kicker, title, text, duration = 1300, keepOpen = false) {
  if (levelOverlayTimer) window.clearTimeout(levelOverlayTimer);
  if (levelTransitionKicker) levelTransitionKicker.textContent = kicker;
  if (levelTransitionTitle) levelTransitionTitle.textContent = title;
  if (levelTransitionText) levelTransitionText.textContent = text;
  levelTransitionPanel?.setAttribute("aria-hidden", "false");
  document.body.classList.remove("level-transition");
  if (levelTransitionPanel) void levelTransitionPanel.offsetWidth;
  document.body.classList.add("level-transition");
  if (!keepOpen) {
    levelOverlayTimer = window.setTimeout(() => hideLevelTransition(true), duration);
  }
}

function updateGameHud() {
  shipCounter.textContent = `SCORE ${String(score).padStart(5, "0")}`;
  levelStatus.textContent = `${currentLevel}`;
  killsStatus.textContent = `${destroyedShipCount}`;
  healthStatus.textContent = `${Math.max(0, Math.ceil(playerHealth))}/100`;
  shieldStatus.textContent = `${Math.ceil(shieldHP)}`;
  healthBar.style.setProperty("--bar", `${Math.max(0, Math.min(100, playerHealth))}%`);
  const shieldPct = Math.max(0, Math.min(100, shieldHP / SHIELD_MAX * 100));
  shieldBar.style.setProperty("--bar", `${shieldPct}%`);
  playerShip.style.setProperty("--shield-opacity", shieldHP > 0 ? `${.22 + shieldPct / 100 * .72}` : "0");
  playerShip.style.setProperty("--shield-scale", `${.76 + shieldPct / 100 * .38}`);
  const powerParts = [];
  if (straightStacks) powerParts.push(`STRAIGHT +${straightStacks}`);
  if (diagonalStacks) powerParts.push(`DIAG +${diagonalStacks}`);
  if (blastStacks) powerParts.push(`BLAST +${blastStacks}`);
  powerupStatus.textContent = powerParts.length ? powerParts.join(" | ") : "Base blaster";
  arenaStatus.textContent = playModeActive
    ? (gameWon ? "You won | Play again or return" : (gameLost ? "Game lost | Try again" : `HP ${Math.ceil(playerHealth)} | Click or X to fire`))
    : "Arena ready";
}

function initGameAudio() {
  if (gameAudio) return gameAudio;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = audioMuted ? 0 : .18;
  master.connect(ctx.destination);

  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneGain.connect(master);
  [55, 82.41].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = index ? "triangle" : "sawtooth";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = index ? .24 : .18;
    osc.connect(gain).connect(droneGain);
    osc.start();
  });

  gameAudio = { ctx, master, droneGain };
  return gameAudio;
}

function setMusicActive(active) {
  const audio = gameAudio;
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const target = active && playModeActive && !audioMuted ? .035 : 0;
  audio.droneGain.gain.cancelScheduledValues(now);
  audio.droneGain.gain.setTargetAtTime(target, now, .08);
}

function stopGameAudio() {
  if (melodyTimer) {
    window.clearInterval(melodyTimer);
    melodyTimer = null;
  }
  setMusicActive(false);
}

function updateSoundToggle() {
  soundToggle?.classList.toggle("muted", audioMuted);
  soundToggle?.setAttribute("aria-pressed", String(audioMuted));
  soundToggle?.setAttribute("aria-label", audioMuted ? "Unmute sound" : "Mute sound");
  soundToggle?.setAttribute("title", audioMuted ? "Unmute sound" : "Mute sound");
  if (gameAudio) {
    const now = gameAudio.ctx.currentTime;
    gameAudio.master.gain.cancelScheduledValues(now);
    gameAudio.master.gain.setTargetAtTime(audioMuted ? 0 : .18, now, .04);
  }
  if (gameAudio) setMusicActive(playModeActive && !audioMuted);
}

soundToggle?.addEventListener("click", () => {
  audioMuted = !audioMuted;
  initGameAudio()?.ctx.resume?.();
  updateSoundToggle();
});

updateSoundToggle();

function playTone(freq, start, duration, type = "square", volume = .18, destination = null) {
  const audio = initGameAudio();
  if (!audio) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + .01);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  osc.connect(gain).connect(destination || audio.master);
  osc.start(start);
  osc.stop(start + duration + .03);
}

function playKick(start, boss = false) {
  const audio = initGameAudio();
  if (!audio) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(boss ? 150 : 122, start);
  osc.frequency.exponentialRampToValueAtTime(boss ? 34 : 46, start + .28);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(boss ? .26 : .2, start + .008);
  gain.gain.exponentialRampToValueAtTime(.001, start + .34);
  osc.connect(gain).connect(audio.master);
  osc.start(start);
  osc.stop(start + .38);
}

function playNoise(start, duration, volume, filterType = "highpass", freq = 4200) {
  const audio = initGameAudio();
  if (!audio) return;
  const ctx = audio.ctx;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + .006);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  source.connect(filter).connect(gain).connect(audio.master);
  source.start(start);
  source.stop(start + duration + .02);
}

function playSnare(start, boss = false) {
  playNoise(start, boss ? .18 : .14, boss ? .11 : .08, "bandpass", boss ? 1900 : 2400);
  playTone(boss ? 156 : 186, start, .08, "triangle", boss ? .05 : .035);
}

function playHat(start, open = false) {
  playNoise(start, open ? .15 : .045, open ? .045 : .027, "highpass", open ? 5200 : 7200);
}

function playBass(freq, start, duration, boss = false) {
  playTone(freq, start, duration, boss ? "sawtooth" : "square", boss ? .07 : .052);
  if (boss) playTone(freq / 2, start, duration * .72, "triangle", .045);
}

function playLead(freq, start, duration, boss = false) {
  playTone(freq, start, duration, boss ? "sawtooth" : "triangle", boss ? .042 : .035);
  playTone(freq * (boss ? 1.505 : 2), start + .015, duration * .74, "square", boss ? .018 : .014);
}

function playMusicStep() {
  if (!playModeActive || audioMuted || gameLost || gameWon) return;
  const audio = initGameAudio();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const boss = activeBosses().length > 0;
  if (boss !== bossMusicMode) {
    bossMusicMode = boss;
    musicStep = 0;
    musicBar = 0;
    playNoise(now, .55, boss ? .11 : .07, "bandpass", boss ? 900 : 1600);
  }

  const step = musicStep % 64;
  const beat = step % 16;
  const barInPhrase = Math.floor(step / 16);
  const drop = barInPhrase === 3;
  const root = boss ? 82.41 : 110;
  const bassPattern = boss
    ? [0, 0, 3, 0, 6, 0, 5, 3, 0, 0, 8, 0, 6, 5, 3, 0]
    : [0, 0, 7, 0, 5, 0, 3, 5, 0, 0, 10, 7, 5, 3, 5, 0];
  const leadPattern = boss
    ? [12, null, 10, null, 15, null, 13, 10, 12, null, 18, null, 17, 15, 13, 10]
    : [12, null, 15, 19, null, 17, null, 15, 12, null, 10, null, 12, 15, 17, 19];
  const semitone = bassPattern[beat] || 0;
  const bassFreq = root * Math.pow(2, semitone / 12);

  if (!drop || beat < 12 || boss) {
    if (beat % 4 === 0 || (boss && beat % 3 === 0)) playKick(now, boss);
    if (beat === 4 || beat === 12 || (boss && beat === 10)) playSnare(now, boss);
    if (beat % 2 === 1 || (drop && beat > 11)) playHat(now, drop && beat > 11);
    if ([0, 3, 6, 8, 11, 14].includes(beat) || boss) playBass(bassFreq, now, boss ? .16 : .13, boss);
  }

  if (drop && beat >= 12) {
    playKick(now, true);
    playNoise(now, .08, .04, "highpass", 6800);
  }

  const leadSemitone = leadPattern[beat];
  if (leadSemitone != null && (beat % (boss ? 2 : 3) === 0 || drop)) {
    const leadFreq = root * 2 * Math.pow(2, leadSemitone / 12);
    playLead(leadFreq, now, boss ? .11 : .095, boss);
  }

  if (beat === 15) {
    musicBar += 1;
    if (drop || boss) playNoise(now, boss ? .34 : .24, boss ? .08 : .052, "bandpass", boss ? 760 : 1400);
  }

  musicStep += 1;
}

function startGameAudio() {
  const audio = initGameAudio();
  if (!audio) return;
  audio.ctx.resume?.();
  setMusicActive(true);
  if (melodyTimer) return;
  musicStep = 0;
  musicBar = 0;
  bossMusicMode = activeBosses().length > 0;
  melodyTimer = window.setInterval(playMusicStep, 118);
}

function blastSfx() {
  const audio = initGameAudio();
  if (!audio) return;
  audio.ctx.resume?.();
  const now = audio.ctx.currentTime;
  playTone(190, now, .13, "sawtooth", .16);
  playTone(62, now + .02, .24, "triangle", .12);
}

function shipExplosionSfx() {
  const audio = initGameAudio();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  playTone(90, now, .32, "sawtooth", .18);
  playTone(280, now, .08, "square", .08);
}

function shieldHitSfx() {
  const audio = initGameAudio();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  playTone(520, now, .10, "square", .11);
  playTone(740, now + .04, .11, "triangle", .08);
}

function bossExplosionSfx() {
  const audio = initGameAudio();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  [70, 52, 44].forEach((freq, index) => playTone(freq, now + index * .08, .46, "sawtooth", .2 - index * .04));
  playTone(640, now, .18, "square", .12);
}

function letterPopSfx() {
  const audio = initGameAudio();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  playTone(880 + Math.random() * 240, now, .05, "triangle", .025);
}

function clearPowerUps() {
  [...powerUps].forEach((item) => item.el.remove());
  powerUps.length = 0;
}

function resetGameStats() {
  gameLost = false;
  gameWon = false;
  currentLevel = 1;
  currentLevelPattern = 1;
  enemyHealthMultiplier = 1;
  playerHealth = 100;
  shieldHP = 0;
  levelItemDropped = false;
  straightStacks = 0;
  diagonalStacks = 0;
  blastStacks = 0;
  score = 0;
  destroyedShipCount = 0;
  playerInvulnerableUntil = performance.now() + 1500;
  playerShip.classList.remove("player-exploded", "player-crash", "player-hit", "player-shield");
  document.body.classList.remove("game-lost", "game-won", "level-transition");
  gameOverPanel.setAttribute("aria-hidden", "true");
  hideLevelTransition(true);
}

function startGameSession(resetStats = true) {
  ensureEnemyShips();
  playModeActive = true;
  window.scrollTo(0, 0);
  lockedScrollY = 0;
  document.body.classList.add("play-mode");
  document.body.classList.remove("game-lost", "game-won", "level-transition");
  updateSpaceScroll();
  playerShip.classList.remove("player-exploded", "player-crash", "player-hit", "player-shield");
  document.getElementById("gameHudPanel").setAttribute("aria-hidden", "false");
  document.getElementById("arenaHud").setAttribute("aria-hidden", "false");
  playModeBtn.textContent = "Playing";
  startGameAudio();
  clearProjectiles();
  clearPowerUps();
  if (resetStats) resetGameStats();
  queueNextShipFrame();
  const clamped = clampToPlayArena(pointer.x, pointer.y);
  updatePointer(clamped.x, clamped.y);
  updatePlayerShipPosition();
  setupLevel(currentLevel);
  updateGameHud();
}

function endGameSession() {
  playModeActive = false;
  pointerShooting = false;
  document.body.classList.remove("play-mode", "game-lost", "game-won", "level-transition", "show-scroll-warning");
  updateSpaceScroll();
  gameWon = false;
  document.getElementById("gameHudPanel").setAttribute("aria-hidden", "true");
  document.getElementById("arenaHud").setAttribute("aria-hidden", "true");
  playModeBtn.textContent = "Play";
  gameOverPanel.setAttribute("aria-hidden", "true");
  playerShip.classList.remove("player-exploded", "player-crash", "player-hit", "player-shield");
  if (levelTransitionTimer) window.clearTimeout(levelTransitionTimer);
  if (levelOverlayTimer) window.clearTimeout(levelOverlayTimer);
  if (bossTimer) window.clearTimeout(bossTimer);
  levelTransitionTimer = null;
  levelOverlayTimer = null;
  bossTimer = null;
  clearProjectiles();
  clearPowerUps();
  stopGameAudio();
  restoreBossShip();
  levelTransitionPanel?.setAttribute("aria-hidden", "true");
  enemyShips.forEach((ship) => {
    ship.standby = false;
    ship.destroyed = false;
    ship.type = "scout";
    ship.hp = BASE_SHIP_HP;
    ship.maxHp = BASE_SHIP_HP;
    ship.el.classList.remove("standby-ship", "destroyed-ship", "ship-damage-1", "ship-damage-2", "ship-damage-3", "laser-ship");
    positionShip(ship, performance.now());
  });
  updateGameHud();
}

function togglePlayMode() {
  if (playModeActive) endGameSession();
  else {
    playModeBtn.textContent = "Loading";
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => startGameSession(true)));
  }
}

playModeBtn.addEventListener("click", togglePlayMode);
tryAgainBtn.addEventListener("click", () => startGameSession(true));
gameRequestBtn?.addEventListener("click", () => {
  endGameSession();
  document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function dismissGameOverPopup() {
  document.body.classList.remove("game-lost");
  gameOverPanel.setAttribute("aria-hidden", "true");
  playerShip.classList.remove("player-exploded", "player-hit", "player-crash");
}

closeGameOverBtn?.addEventListener("click", dismissGameOverPopup);
gameOverBackdrop?.addEventListener("click", dismissGameOverPopup);
levelRestartBtn?.addEventListener("click", () => startGameSession(true));

let spaceScrollQueued = false;
let currentShipScroll = 0;
function updateSpaceScroll() {
  if (spaceScrollQueued) return;
  spaceScrollQueued = true;
  window.requestAnimationFrame(() => {
    const scrollY = window.scrollY || 0;
    root.style.setProperty("--space-scroll", `${-(scrollY * .22) % 420}px`);
    const shipRange = window.innerHeight + 380;
    currentShipScroll = playModeActive ? 0 : (-(scrollY * .34) % shipRange);
    document.getElementById("spaceWar")?.style.setProperty("--ship-scroll", `${currentShipScroll}px`);
    spaceScrollQueued = false;
  });
}

window.addEventListener("scroll", updateSpaceScroll, { passive: true });
updateSpaceScroll();

const spaceWar = document.getElementById("spaceWar");
const shipCounter = document.getElementById("shipCounter");
const enemyShips = [];
let shipsInitialized = false;
let destroyedShipCount = 0;
let lastShipFrame = performance.now();
let lastAmbientShipTick = 0;
let shipFrameScheduled = false;

function queueNextShipFrame(delay = 0) {
  if (shipFrameScheduled) return;
  shipFrameScheduled = true;
  const run = () => requestAnimationFrame((now) => {
    shipFrameScheduled = false;
    animateEnemyShips(now);
  });
  if (delay > 0) {
    window.setTimeout(run, delay);
  } else {
    run();
  }
}

function updateShipCounter() {
  updateGameHud();
}

function wrapShipY(y) {
  const margin = 190;
  const range = window.innerHeight + margin * 2;
  return ((((y + margin) % range) + range) % range) - margin;
}

function randomShipY() {
  if (playModeActive) {
    const bounds = getPlayArenaBounds();
    return bounds.top + Math.random() * Math.max(160, bounds.bottom - bounds.top - 48);
  }
  return -160 + Math.random() * (window.innerHeight + 320);
}

function createEnemyShip(index) {
  const ship = document.createElement("span");
  ship.className = "space-ship";
  ship.innerHTML = `<span class="ship-beam"></span><span class="ship-dome"></span><span class="ship-body"></span><span class="ship-lights"></span><span class="ship-thrusters"><span class="ship-thruster"></span><span class="ship-thruster"></span><span class="ship-thruster"></span></span><span class="ship-smoke"></span>`;
  const size = 24 + Math.random() * 24;
  const direction = Math.random() > .5 ? 1 : -1;
  const speed = (18 + Math.random() * 34) * direction;
  const data = {
    el: ship,
    x: Math.random() * window.innerWidth,
    y: randomShipY(),
    vx: speed,
    vy: (Math.random() - .5) * 18,
    size,
    phase: Math.random() * Math.PI * 2,
    wobble: .35 + Math.random() * .7,
    orbit: 8 + Math.random() * 34,
    orbitSpeed: 520 + Math.random() * 920,
    scrollFactor: .34 + Math.random() * .78,
    swarmOffsetX: (Math.random() - .5) * 180,
    swarmOffsetY: -80 - Math.random() * 150,
    aggression: .78 + Math.random() * .52,
    type: "scout",
    destroyed: false,
    standby: false,
    hp: BASE_SHIP_HP,
    maxHp: BASE_SHIP_HP,
    index
  };
  ship.style.setProperty("--ship-size", `${size}px`);
  ship.style.opacity = `${.52 + Math.random() * .38}`;
  spaceWar.appendChild(ship);
  enemyShips.push(data);
  return data;
}

function createEnemyShips(count = (isMobileViewport() ? 7 : 9)) {
  while (enemyShips.length < count) createEnemyShip(enemyShips.length);
  shipsInitialized = enemyShips.length > 0;
  updateShipCounter();
}

function ensureEnemyShips() {
  createEnemyShips(isMobileViewport() ? 14 : 16);
  queueNextShipFrame();
}

function getShipRenderPosition(ship, now) {
  const sway = Math.sin(now / 760 + ship.phase) * 16 * ship.wobble;
  const orbitX = Math.sin(now / ship.orbitSpeed + ship.phase) * ship.orbit;
  const orbitY = Math.cos(now / (ship.orbitSpeed * 1.28) + ship.phase) * ship.orbit * .42;
  const left = ship.x + orbitX;
  const top = playModeActive ? ship.y + sway : wrapShipY(ship.y + sway + orbitY);
  const angle = Math.sin(now / 900 + ship.phase) * 6 + (playModeActive ? 0 : Math.sin(now / (ship.orbitSpeed * .7) + ship.phase) * 5);
  return {
    left,
    top,
    angle,
    centerX: left + ship.size * .95,
    centerY: top + ship.size * .5
  };
}

function positionShip(ship, now) {
  const render = getShipRenderPosition(ship, now);
  ship.render = render;
  ship.el.style.setProperty("--ship-x", `${render.left}px`);
  ship.el.style.setProperty("--ship-y", `${render.top}px`);
  ship.el.style.setProperty("--ship-rot", `${render.angle}deg`);
}

function getCachedShipRender(ship) {
  const render = ship.render || getShipRenderPosition(ship, performance.now());
  if (playModeActive || !currentShipScroll) return render;
  return { ...render, top: render.top + currentShipScroll, centerY: render.centerY + currentShipScroll };
}

function getLevelConfig(level) {
  const pattern = ((level - 1) % 5) + 1;
  const doubled = level > 5;
  const suffix = doubled ? " | Elite hulls" : "";
  if (pattern === 1) return { pattern, ships: 7, bosses: 0, label: `Level ${level} | Scout ships${suffix}`, title: "Scout Run", text: "Warm up the engines. A quick scout wave is crossing your screen." };
  if (pattern === 2) return { pattern, ships: 0, bosses: 1, label: `Level ${level} | Boss duel${suffix}`, title: "Boss Duel", text: "One heavy saucer is stepping in. Crack the shield, keep moving, and do not let it corner you." };
  if (pattern === 3) return { pattern, ships: 14, bosses: 0, lasers: 3, label: `Level ${level} | Swarm pressure${suffix}`, title: "Swarm Pressure", text: "You are doing well. Now the swarm gets louder and laser ships join the fight." };
  if (pattern === 4) return { pattern, ships: 10, bosses: 1, lasers: 3, label: `Level ${level} | Boss swarm${suffix}`, title: "Guarded Boss", text: "The boss brought company. Clear a path, then commit to the big target." };
  return { pattern, ships: 8, bosses: 2, lasers: 2, label: `Level ${level} | Twin bosses${suffix}`, title: "Twin Bosses", text: "Two bosses at once. Stay calm, split the pressure, and make the arena yours." };
}

function setupLevel(level) {
  if (!playModeActive || gameWon) return;
  if (level > FINAL_LEVEL) {
    winGame();
    return;
  }
  if (levelTransitionTimer) window.clearTimeout(levelTransitionTimer);
  levelTransitionTimer = null;
  const config = getLevelConfig(level);
  currentLevel = level;
  currentLevelPattern = config.pattern;
  enemyHealthMultiplier = Math.pow(2, Math.floor((level - 1) / 5));
  levelItemDropped = false;
  clearProjectiles();
  restoreBossShip();
  const bounds = getPlayArenaBounds();
  enemyShips.forEach((ship, index) => {
    const active = index < config.ships;
    ship.standby = !active;
    ship.destroyed = false;
    const laserActive = active && level >= 3 && index >= Math.max(0, config.ships - (config.lasers || 0));
    ship.type = laserActive ? "laser" : "scout";
    const levelHpBase = level === 1 ? BASE_SHIP_HP * .25 : BASE_SHIP_HP;
    ship.maxHp = levelHpBase * (laserActive ? 1.35 : 1) * enemyHealthMultiplier;
    ship.hp = ship.maxHp;
    ship.x = bounds.left + Math.random() * Math.max(120, bounds.right - bounds.left - ship.size);
    ship.y = randomShipY();
    ship.vx = (Math.random() > .5 ? 1 : -1) * (34 + Math.random() * 42 + currentLevelPattern * 5);
    ship.swarmOffsetX = ((index % 7) - 3) * (34 + Math.random() * 18) + (Math.random() - .5) * 44;
    ship.swarmOffsetY = -56 - (index % 4) * 32 - Math.random() * 78;
    if ((index + level) % 6 === 0) ship.swarmOffsetY = -18 - Math.random() * 42;
    ship.aggression = .84 + Math.random() * .48 + currentLevelPattern * .04;
    ship.el.classList.toggle("standby-ship", !active);
    ship.el.classList.toggle("laser-ship", laserActive);
    ship.el.classList.remove("destroyed-ship", "ship-damage-1", "ship-damage-2", "ship-damage-3");
    positionShip(ship, performance.now());
  });
  for (let i = 0; i < config.bosses; i += 1) spawnBoss(i);
  lastEnemyShot = performance.now() + 900;
  showLevelTransition(`Level ${level} / ${FINAL_LEVEL}`, config.title, config.text, 1550);
  arenaStatus.textContent = `${config.label} | HP ${Math.ceil(playerHealth)}`;
  updateGameHud();
}

function checkLevelComplete() {
  if (!playModeActive || gameLost || gameWon || levelTransitionTimer) return;
  const remainingShips = enemyShips.some((ship) => !ship.standby && !ship.destroyed);
  const remainingBosses = activeBosses().length > 0;
  if (remainingShips || remainingBosses) return;
  if (!levelItemDropped) grantLevelBonusPowerUp();
  if (currentLevel >= FINAL_LEVEL) {
    arenaStatus.textContent = "Final chapter clear | Mission complete";
    showLevelTransition("Final level clear", "That was the final wave.", "You cleared the full run. One last flash, then the victory screen is yours.", 1400);
    levelTransitionTimer = window.setTimeout(() => {
      levelTransitionTimer = null;
      winGame();
    }, 1250);
    return;
  }
  arenaStatus.textContent = `Level ${currentLevel} clear | Next chapter incoming`;
  showLevelTransition(`Level ${currentLevel} clear`, "You made it to the next level.", `Nice flying. Level ${currentLevel + 1} is loading in with a fresh wave.`, 1450);
  levelTransitionTimer = window.setTimeout(() => {
    currentLevel += 1;
    levelTransitionTimer = null;
    setupLevel(currentLevel);
  }, 1500);
}

function winGame() {
  if (gameWon) return;
  gameWon = true;
  pointerShooting = false;
  stopGameAudio();
  clearProjectiles();
  clearPowerUps();
  restoreBossShip();
  enemyShips.forEach((ship) => {
    ship.standby = true;
    ship.destroyed = true;
    ship.el.classList.add("standby-ship");
  });
  document.body.classList.add("game-won");
  showLevelTransition("Mission complete", "You won. Beautiful run.", "You cleared level 10, handled the bosses, and kept the ship alive through the full arcade sequence.", 0, true);
  playModeBtn.textContent = "Won";
  arenaStatus.textContent = "You won | Press Play to return";
  updateGameHud();
  bossExplosionSfx();
}

function createPlayerExplosion(x, y) {
  bossExplosionSfx();
  createBlastVisual(x, y);
  capTransientNodes(".destruction-piece", particleBudget(88, 48));
  const pieces = particleBudget(12, 7);
  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement("span");
    piece.className = "destruction-piece";
    piece.style.setProperty("--x", `${x + (Math.random() - .5) * 46}px`);
    piece.style.setProperty("--y", `${y + (Math.random() - .5) * 50}px`);
    piece.style.setProperty("--dx", `${(Math.random() - .5) * 300}px`);
    piece.style.setProperty("--dy", `${70 + Math.random() * 230}px`);
    piece.style.setProperty("--r", `${(Math.random() - .5) * 900}deg`);
    piece.style.setProperty("--w", `${6 + Math.random() * 18}px`);
    piece.style.setProperty("--h", `${5 + Math.random() * 14}px`);
    piece.style.setProperty("--t", `${.78 + Math.random() * .7}s`);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1400);
  }
}

function loseGame() {
  if (gameLost || gameWon) return;
  gameLost = true;
  pointerShooting = false;
  stopGameAudio();
  hideLevelTransition(true);
  createPlayerExplosion(pointer.x, pointer.y);
  playerShip.classList.remove("player-exploded");
  void playerShip.offsetWidth;
  playerShip.classList.add("player-exploded");
  playModeActive = false;
  document.body.classList.remove("play-mode", "level-transition", "show-scroll-warning");
  updateSpaceScroll();
  document.body.classList.add("game-lost");
  document.getElementById("gameHudPanel").setAttribute("aria-hidden", "true");
  document.getElementById("arenaHud").setAttribute("aria-hidden", "true");
  playModeBtn.textContent = "Play";
  gameOverPanel.setAttribute("aria-hidden", "false");
  clearProjectiles();
  clearPowerUps();
  restoreBossShip();
  updateGameHud();
}

function createPlayerBullet() {
  if (!playModeActive || gameLost || gameWon || playerHealth <= 0) return;
  const now = performance.now();
  if (now - lastPlayerShot < (lowPowerDevice ? 210 : 165)) return;
  lastPlayerShot = now;
  startGameAudio();
  const shots = [];
  const straightCount = Math.min(lowPowerDevice ? 5 : 9, 1 + straightStacks);
  const spread = 13;
  for (let i = 0; i < straightCount; i += 1) {
    shots.push({ x: pointer.x + (i - (straightCount - 1) / 2) * spread, y: pointer.y - 30, vx: 0, vy: -820 });
  }
  for (let i = 1; i <= Math.min(lowPowerDevice ? 2 : 5, diagonalStacks); i += 1) {
    const angle = (.18 + i * .045);
    const speed = 780;
    shots.push({ x: pointer.x - 8, y: pointer.y - 24, vx: -Math.sin(angle) * speed, vy: -Math.cos(angle) * speed });
    shots.push({ x: pointer.x + 8, y: pointer.y - 24, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed });
  }
  const maxBullets = lowPowerDevice ? 42 : 82;
  while (playerBullets.length > maxBullets) removeProjectile(playerBullets[0], playerBullets);
  shots.forEach((shot) => {
    const el = document.createElement("span");
    el.className = "player-bullet";
    document.body.appendChild(el);
    playerBullets.push({
      el,
      x: shot.x,
      y: shot.y,
      vx: shot.vx,
      vy: shot.vy,
      r: 8,
      damage: PLAYER_DAMAGE_MULTIPLIER,
      blast: blastStacks
    });
  });
  playTone(760, gameAudio.ctx.currentTime, .06, "square", .08);
}

function createEnemyProjectile(x, y, tx = pointer.x, ty = pointer.y, options = {}) {
  if (!playModeActive || gameWon) return;
  if (enemyProjectiles.length > (lowPowerDevice ? 10 : 16)) removeProjectile(enemyProjectiles[0], enemyProjectiles);
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = options.speed || (125 + Math.random() * 55);
  const levelPressure = Math.max(0, currentLevel - 1);
  const dangerRamp = Math.max(0, currentLevel - 2);
  const radius = options.radius || ((options.boss ? 14 : 10) + dangerRamp * 1.55);
  const damage = options.damage || ((options.boss ? 2 : 1) + dangerRamp * .38);
  const el = document.createElement("span");
  el.className = `enemy-projectile${options.boss ? " boss-shot" : ""}`;
  el.style.setProperty("--shot-size", `${radius * 2}px`);
  document.body.appendChild(el);
  enemyProjectiles.push({
    el,
    x,
    y,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    r: radius,
    damage
  });
}

function createEnemyLaser(x, y, tx = pointer.x, ty = pointer.y) {
  if (!playModeActive || gameWon) return;
  if (enemyLasers.length > 5) removeLaser(enemyLasers[0]);
  const dx = tx - x;
  const dy = ty - y;
  const length = Math.max(120, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const levelPressure = Math.max(0, currentLevel - 1);
  const width = 6 + Math.min(9, Math.max(0, currentLevel - 2) * 1.1);
  const el = document.createElement("span");
  el.className = "enemy-laser";
  el.style.setProperty("--laser-x", `${x}px`);
  el.style.setProperty("--laser-y", `${y}px`);
  el.style.setProperty("--laser-rot", `${angle}rad`);
  el.style.setProperty("--laser-length", `${length}px`);
  el.style.setProperty("--laser-width", `${width}px`);
  document.body.appendChild(el);
  enemyLasers.push({
    el,
    x,
    y,
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    length,
    width,
    born: performance.now(),
    duration: particleBudget(620, 500),
    tick: 0,
    damage: .55 + Math.max(0, currentLevel - 2) * .20
  });
  playTone(1040, gameAudio?.ctx?.currentTime || 0, .08, "sawtooth", .045);
}

function createBossVolley(x, y) {
  const spread = [-.24, .24];
  const baseDx = pointer.x - x;
  const baseDy = pointer.y - y;
  const baseAngle = Math.atan2(baseDy, baseDx);
  spread.forEach((offset, index) => {
    const angle = baseAngle + offset;
    const targetX = x + Math.cos(angle) * 420;
    const targetY = y + Math.sin(angle) * 420;
    window.setTimeout(() => createEnemyProjectile(x, y, targetX, targetY, { boss: true, speed: 175 + index * 22 }), index * 45);
  });
}

function removeProjectile(item, list) {
  item.el.remove();
  const index = list.indexOf(item);
  if (index !== -1) list.splice(index, 1);
}

function removeLaser(item) {
  item.el.remove();
  const index = enemyLasers.indexOf(item);
  if (index !== -1) enemyLasers.splice(index, 1);
}

function clearProjectiles() {
  [...playerBullets].forEach((item) => removeProjectile(item, playerBullets));
  [...enemyProjectiles].forEach((item) => removeProjectile(item, enemyProjectiles));
  [...enemyLasers].forEach(removeLaser);
}

function damagePlayer(amount = 1, force = false) {
  if (!playModeActive || gameLost || gameWon || playerHealth <= 0) return;
  const now = performance.now();
  if (!force && now < playerInvulnerableUntil) return;
  playerInvulnerableUntil = now + 260;
  let incoming = amount;
  if (shieldHP > 0) {
    const absorbed = Math.min(shieldHP, incoming);
    shieldHP -= absorbed;
    incoming -= absorbed;
  }
  playerHealth = Math.max(0, playerHealth - incoming);
  updateGameHud();
  playerShip.classList.remove("player-hit");
  void playerShip.offsetWidth;
  playerShip.classList.add("player-hit", "player-shield");
  window.setTimeout(() => playerShip.classList.remove("player-shield"), 260);
  playTone(120, gameAudio?.ctx?.currentTime || 0, .18, "sawtooth", .13);
  if (playerHealth <= 0) {
    loseGame();
    for (let i = 0; i < 3; i += 1) {
      window.setTimeout(() => createBlastVisual(pointer.x + (Math.random() - .5) * 50, pointer.y + (Math.random() - .5) * 50), i * 120);
    }
  }
}

const powerUpTypes = [
  { type: "health", label: "HP", color: "rgba(255,106,0,.78)" },
  { type: "diagonal", label: "DIAG", color: "rgba(94,226,210,.78)" },
  { type: "straight", label: "SHOT", color: "rgba(255,247,234,.82)" },
  { type: "shield", label: "SHLD", color: "rgba(94,226,210,.9)" },
  { type: "blast", label: "AOE", color: "rgba(255,106,0,.88)" }
];

function spawnPowerUps(x, y, count = 1) {
  if (!playModeActive || gameLost || gameWon) return;
  if (count > 0) levelItemDropped = true;
  for (let i = 0; i < count; i += 1) {
    const info = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const el = document.createElement("span");
    el.className = "power-up";
    el.textContent = info.label;
    el.style.setProperty("--power-color", info.color);
    document.body.appendChild(el);
    powerUps.push({
      el,
      type: info.type,
      x: x + (Math.random() - .5) * 90,
      y: y + (Math.random() - .5) * 60,
      vx: (Math.random() - .5) * 60,
      vy: 38 + Math.random() * 36,
      rot: (Math.random() - .5) * 30
    });
  }
}

function applyPowerUp(type) {
  if (type === "health") playerHealth = Math.min(100, playerHealth + 12);
  if (type === "diagonal") diagonalStacks = Math.min(2, diagonalStacks + 1);
  if (type === "straight") straightStacks = Math.min(3, straightStacks + 1);
  if (type === "shield") shieldHP = Math.min(SHIELD_MAX, shieldHP + SHIELD_PICKUP);
  if (type === "blast") blastStacks = Math.min(3, blastStacks + 1);
  score += 25;
  shieldHitSfx();
  updateGameHud();
}

function grantLevelBonusPowerUp() {
  const info = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
  levelItemDropped = true;
  applyPowerUp(info.type);
  arenaStatus.textContent = `Level bonus acquired | ${info.label}`;
  createBlastVisual(pointer.x, Math.max(86, pointer.y - 74));
}

function applyBlastDamage(x, y, stacks, ignoredShip = null) {
  const radius = 74 + stacks * 26;
  const damage = Math.max(PLAYER_DAMAGE_MULTIPLIER, Math.ceil(stacks / 2) * PLAYER_DAMAGE_MULTIPLIER);
  createBlastVisual(x, y);
  enemyShips.forEach((ship) => {
    if (ship === ignoredShip || ship.destroyed || ship.standby) return;
    const render = getCachedShipRender(ship);
      const dx = render.centerX - x;
      const dy = render.centerY - y;
      if (dx * dx + dy * dy < radius * radius) {
      damageEnemyShip(ship, render.centerX, render.centerY, damage);
    }
  });
  activeBosses().forEach((boss) => {
    const rect = boss.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const bossRadius = radius + 80;
    const bossDx = cx - x;
    const bossDy = cy - y;
    if (bossDx * bossDx + bossDy * bossDy < bossRadius * bossRadius) boss.hp -= damage;
    if (boss.hp <= 0) destroyBossShip(boss, cx, cy);
  });
  updateBossStatus();
}

function damageEnemyShip(ship, x, y, amount = PLAYER_DAMAGE_MULTIPLIER) {
  if (!ship || ship.destroyed) return;
  ship.hp = (ship.hp ?? ship.maxHp ?? BASE_SHIP_HP) - amount;
  const maxHp = ship.maxHp || BASE_SHIP_HP;
  const damageLevel = Math.max(1, Math.min(3, Math.ceil((1 - Math.max(0, ship.hp) / maxHp) * 3)));
  ship.el.classList.remove("ship-damage-1", "ship-damage-2", "ship-damage-3");
  ship.el.classList.add(`ship-damage-${damageLevel}`);
  ship.el.classList.remove("ship-impact");
  void ship.el.offsetWidth;
  ship.el.classList.add("ship-impact");
  window.setTimeout(() => ship.el.classList.remove("ship-impact"), 320);
  if (ship.hp <= 0) explodeShip(ship, x, y);
  else shieldHitSfx();
}

function updateProjectiles(dt) {
  for (const bullet of [...playerBullets]) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.el.style.setProperty("--x", `${bullet.x}px`);
    bullet.el.style.setProperty("--y", `${bullet.y}px`);
    if (bullet.y < -40 || bullet.x < -60 || bullet.x > window.innerWidth + 60) {
      removeProjectile(bullet, playerBullets);
      continue;
    }

    let consumed = false;
    if (hitBossShip(bullet.x, bullet.y, true, bullet.damage || 1)) {
      if (bullet.blast) applyBlastDamage(bullet.x, bullet.y, bullet.blast);
      removeProjectile(bullet, playerBullets);
      consumed = true;
    }
    if (consumed) continue;

    for (const ship of enemyShips) {
      if (ship.destroyed || ship.standby) continue;
      const render = getCachedShipRender(ship);
      const shipX = render.centerX;
      const shipY = render.centerY;
        const hitRadius = Math.max(34, ship.size * 1.05);
        const hitDx = shipX - bullet.x;
        const hitDy = shipY - bullet.y;
        if (hitDx * hitDx + hitDy * hitDy < hitRadius * hitRadius) {
        damageEnemyShip(ship, shipX, shipY, bullet.damage || 1);
        if (bullet.blast) applyBlastDamage(shipX, shipY, bullet.blast, ship);
        removeProjectile(bullet, playerBullets);
        break;
      }
    }
  }

  for (const shot of [...enemyProjectiles]) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.el.style.setProperty("--x", `${shot.x}px`);
    shot.el.style.setProperty("--y", `${shot.y}px`);
    if (shot.x < -40 || shot.x > window.innerWidth + 40 || shot.y < -40 || shot.y > window.innerHeight + 40) {
      removeProjectile(shot, enemyProjectiles);
      continue;
    }
    const shotRadius = (shot.r || 10) + 7;
    const shotDx = shot.x - pointer.x;
    const shotDy = shot.y - pointer.y;
    if (shotDx * shotDx + shotDy * shotDy < shotRadius * shotRadius) {
      removeProjectile(shot, enemyProjectiles);
      damagePlayer(shot.damage || 1);
    }
  }

  const now = performance.now();
  for (const laser of [...enemyLasers]) {
    const age = now - laser.born;
    if (age > laser.duration) {
      removeLaser(laser);
      continue;
    }
    const px = pointer.x - laser.x;
    const py = pointer.y - laser.y;
    const along = px * laser.dx + py * laser.dy;
    const closestX = laser.x + laser.dx * Math.max(0, Math.min(laser.length, along));
    const closestY = laser.y + laser.dy * Math.max(0, Math.min(laser.length, along));
    const distance = Math.hypot(pointer.x - closestX, pointer.y - closestY);
    if (distance < laser.width + 16 && now > laser.tick) {
      laser.tick = now + 135;
      damagePlayer(laser.damage, true);
    }
  }
}

function updatePowerUps(dt) {
  for (const item of [...powerUps]) {
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rot += 90 * dt;
    item.el.style.setProperty("--x", `${item.x}px`);
    item.el.style.setProperty("--y", `${item.y}px`);
    item.el.style.setProperty("--r", `${item.rot}deg`);
    const itemDx = item.x - pointer.x;
    const itemDy = item.y - pointer.y;
    if (itemDx * itemDx + itemDy * itemDy < 1024) {
      applyPowerUp(item.type);
      item.el.remove();
      powerUps.splice(powerUps.indexOf(item), 1);
      continue;
    }
    if (item.y > window.innerHeight + 60 || item.x < -80 || item.x > window.innerWidth + 80) {
      item.el.remove();
      powerUps.splice(powerUps.indexOf(item), 1);
    }
  }
}

function checkPlayerShipCollisions() {
  if (!playModeActive || gameLost || gameWon) return;
  enemyShips.forEach((ship) => {
    if (ship.destroyed || ship.standby) return;
    const render = getCachedShipRender(ship);
      const hitRadius = ship.size * 1.05 + 18;
      const hitDx = render.centerX - pointer.x;
      const hitDy = render.centerY - pointer.y;
      if (hitDx * hitDx + hitDy * hitDy < hitRadius * hitRadius) {
      explodeShip(ship, render.centerX, render.centerY);
      damagePlayer(5 + Math.max(0, currentLevel - 2) * .8, true);
      playerShip.classList.remove("player-crash");
      void playerShip.offsetWidth;
      playerShip.classList.add("player-crash");
      window.setTimeout(() => playerShip.classList.remove("player-crash"), 680);
    }
  });

  const now = performance.now();
  activeBosses().forEach((boss) => {
    if (now - lastBossCollision < 900) return;
    const rect = boss.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hitRadius = Math.max(92, rect.width * .42);
    const bossDx = cx - pointer.x;
    const bossDy = cy - pointer.y;
    if (bossDx * bossDx + bossDy * bossDy > hitRadius * hitRadius) return;
    lastBossCollision = now;
    boss.hp -= 2 * PLAYER_DAMAGE_MULTIPLIER;
    boss.el.classList.remove("shield-hit");
    void boss.el.offsetWidth;
    boss.el.classList.add("shield-hit");
    window.setTimeout(() => boss.el.classList.remove("shield-hit"), 380);
    createBlastVisual(pointer.x, pointer.y);
    shieldHitSfx();
    damagePlayer(20, true);
    const bounds = getPlayArenaBounds();
    updatePointer(pointer.x, Math.min(bounds.bottom, pointer.y + 86));
    playerShip.classList.remove("player-crash");
    void playerShip.offsetWidth;
    playerShip.classList.add("player-crash");
    window.setTimeout(() => playerShip.classList.remove("player-crash"), 680);
    updateBossStatus();
    if (boss.hp <= 0) destroyBossShip(boss, cx, cy);
  });
}

function maybeEnemyFire(now) {
  const activeBossList = activeBosses();
  const bossActive = activeBossList.length > 0;
  const levelRamp = Math.max(0, currentLevel - 2);
  const fireInterval = bossActive
    ? Math.max(520, 1180 - currentLevel * 44)
    : Math.max(currentLevel >= 3 ? 430 : 620, 1280 - currentLevel * 76 - levelRamp * 42);
  if (!playModeActive || gameLost || gameWon || now - lastEnemyShot < fireInterval) return;
  lastEnemyShot = now;
  activeBossList.forEach((boss) => {
    const rect = boss.el.getBoundingClientRect();
    createBossVolley(rect.left + rect.width / 2, rect.top + rect.height * .72);
  });
  const activeShips = enemyShips.filter((ship) => !ship.destroyed && !ship.standby);
  const laserShips = activeShips.filter((ship) => ship.type === "laser");
  const laserCount = Math.min(laserShips.length, currentLevel >= 8 ? 2 : 1);
  for (let i = 0; i < laserCount; i += 1) {
    const ship = laserShips[(Math.floor(Math.random() * laserShips.length) + i) % laserShips.length];
    if (!ship) continue;
    const render = getCachedShipRender(ship);
    createEnemyLaser(render.centerX, render.centerY + ship.size * .2);
  }
  const count = bossActive ? 2 : Math.min(4, 1 + Math.floor(currentLevelPattern / 2));
  for (let i = 0; i < count && activeShips.length; i += 1) {
    const projectileShips = activeShips.filter((ship) => ship.type !== "laser");
    const ship = (projectileShips.length ? projectileShips : activeShips)[Math.floor(Math.random() * (projectileShips.length || activeShips.length))];
    const render = getCachedShipRender(ship);
    createEnemyProjectile(render.centerX, render.centerY + ship.size * .3);
  }
}

function animateEnemyShips(now = performance.now()) {
  if (!playModeActive) {
    const ambientDelay = isMobileViewport() ? 260 : 180;
    if (now - lastAmbientShipTick < ambientDelay) {
      queueNextShipFrame(ambientDelay - (now - lastAmbientShipTick));
      return;
    }
    lastAmbientShipTick = now;
  }
  const dt = Math.min(2.4, (now - lastShipFrame) / 1000);
  lastShipFrame = now;
  const bossActive = playModeActive && activeBosses().length > 0;
  const ambientLimit = playModeActive ? Infinity : particleBudget(7, 4);
  enemyShips.forEach((ship) => {
    if (!playModeActive && ship.index >= ambientLimit) return;
    if (ship.destroyed || ship.standby) return;
    ship.x += ship.vx * dt;
    if (playModeActive) {
      const bounds = getPlayArenaBounds();
      const shipCenter = ship.x + ship.size;
      const chaseStrength = (bossActive ? .62 : .46) * (ship.aggression || 1);
      const sideWeave = Math.sin(now / (420 + ship.index * 13) + ship.phase) * (34 + currentLevelPattern * 6);
      const verticalWeave = Math.cos(now / (620 + ship.index * 17) + ship.phase) * (22 + currentLevelPattern * 5);
      const targetX = pointer.x + (ship.swarmOffsetX || 0) + sideWeave;
      const targetY = pointer.y + (ship.swarmOffsetY || -100) + verticalWeave;
      ship.y += (targetY - ship.y) * chaseStrength * .72 * dt;
      ship.x += (targetX - shipCenter) * chaseStrength * .52 * dt;
      ship.x += Math.sin(now / 460 + ship.phase) * (22 + currentLevelPattern * 4) * dt;
      ship.x = Math.max(bounds.left - ship.size * .6, Math.min(bounds.right - ship.size * 1.5, ship.x));
      ship.y = Math.max(bounds.top + 20, Math.min(bounds.bottom - ship.size * 1.8, ship.y));
    } else {
      ship.y += ship.vy * dt;
      ship.vx += Math.sin(now / 1400 + ship.phase) * .012;
      ship.vx = Math.max(-62, Math.min(62, ship.vx));
      if (ship.y > window.innerHeight + 210) ship.y = -210;
      if (ship.y < -230) ship.y = window.innerHeight + 210;
    }
    if (ship.vx > 0 && ship.x > window.innerWidth + 90) {
      ship.x = -90;
      ship.y = randomShipY();
    }
    if (ship.vx < 0 && ship.x < -90) {
      ship.x = window.innerWidth + 90;
      ship.y = randomShipY();
    }
    positionShip(ship, now);
  });
  animateBoss(now, dt);
  updateProjectiles(dt);
  updatePowerUps(dt);
  if (pointerShooting) createPlayerBullet();
  checkPlayerShipCollisions();
  maybeEnemyFire(now);
  queueNextShipFrame(playModeActive ? 0 : (lowPowerDevice ? 280 : 190));
}

function explodeShip(ship, x, y) {
  if (!ship || ship.destroyed) return;
  ship.destroyed = true;
  ship.el.classList.add("destroyed-ship");
  destroyedShipCount += 1;
  score += 100 * enemyHealthMultiplier;
  if (Math.random() < .30) spawnPowerUps(x, y, 1);
  updateShipCounter();
  updateRestoreButton();
  shipExplosionSfx();
  createBlastVisual(x, y);
  capTransientNodes(".destruction-piece", particleBudget(88, 48));
  const pieceCount = particleBudget(8, 5);
  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "destruction-piece";
    piece.style.setProperty("--x", `${x + (Math.random() - .5) * ship.size}px`);
    piece.style.setProperty("--y", `${y + (Math.random() - .5) * ship.size}px`);
    piece.style.setProperty("--dx", `${(Math.random() - .5) * 180}px`);
    piece.style.setProperty("--dy", `${60 + Math.random() * 160}px`);
    piece.style.setProperty("--r", `${(Math.random() - .5) * 640}deg`);
    piece.style.setProperty("--w", `${5 + Math.random() * 14}px`);
    piece.style.setProperty("--h", `${4 + Math.random() * 10}px`);
    piece.style.setProperty("--t", `${.75 + Math.random() * .6}s`);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1200);
  }
  checkLevelComplete();
}

function hitEnemyShips(x, y) {
  let hitCount = 0;
  if (hitBossShip(x, y)) hitCount += 1;
  enemyShips.forEach((ship) => {
    if (ship.destroyed || ship.standby) return;
    const render = getCachedShipRender(ship);
    const shipX = render.centerX;
    const shipY = render.centerY;
    const hitRadius = Math.max(48, ship.size * 1.35);
      const hitDx = shipX - x;
      const hitDy = shipY - y;
      if (hitDx * hitDx + hitDy * hitDy <= hitRadius * hitRadius) {
      damageEnemyShip(ship, shipX, shipY);
      hitCount += 1;
    }
  });
  return hitCount;
}

function restoreEnemyShips() {
  enemyShips.forEach((ship) => {
    ship.destroyed = false;
    ship.standby = false;
    ship.type = "scout";
    ship.hp = BASE_SHIP_HP;
    ship.maxHp = BASE_SHIP_HP;
    ship.x = Math.random() * window.innerWidth;
    ship.y = randomShipY();
    ship.el.classList.remove("standby-ship", "destroyed-ship", "ship-damage-1", "ship-damage-2", "ship-damage-3", "laser-ship");
    positionShip(ship, performance.now());
  });
  destroyedShipCount = 0;
  score = 0;
  updateShipCounter();
  updateRestoreButton();
}

let bossShip = null;
let bossTimer = null;
const bossShips = [];

function ensureBossShip(index = 0) {
  if (bossShips[index]) return bossShips[index];
  const el = document.createElement("span");
  el.className = "boss-ship";
  el.innerHTML = `<span class="boss-shield"></span><span class="boss-core"></span>`;
  spaceWar.appendChild(el);
  const boss = {
    el,
    index,
    active: false,
    hp: 0,
    maxHp: 10,
    x: window.innerWidth / 2 - 120,
    y: 82,
    vx: index % 2 ? -48 : 48,
    phase: Math.random() * Math.PI * 2
  };
  bossShips[index] = boss;
  if (index === 0) bossShip = boss;
  return boss;
}

function activeBosses() {
  return bossShips.filter((boss) => boss?.active);
}

function updateBossStatus() {
  const active = activeBosses();
  if (!active.length) {
    bossStatus.textContent = "Boss: waiting";
    return;
  }
  bossStatus.textContent = active.map((boss) => {
    const tag = boss.el.classList.contains("elite-boss") ? `ELITE ${boss.index + 1}` : `B${boss.index + 1}`;
    return `${tag} ${Math.max(0, Math.ceil(boss.hp))}/${Math.ceil(boss.maxHp)}`;
  }).join(" | ");
  active.forEach((boss) => boss.el.style.setProperty("--shield-opacity", `${Math.max(.18, boss.hp / boss.maxHp)}`));
}

function scheduleBoss(delay = 7000 + Math.random() * 9000, index = 0) {
  if (bossTimer) window.clearTimeout(bossTimer);
  if (!playModeActive || gameWon) return;
  bossTimer = window.setTimeout(() => {
    if (playModeActive && !gameLost && !gameWon) spawnBoss(index);
  }, delay);
}

function spawnBoss(index = 0) {
  const boss = ensureBossShip(index);
  if (boss.active || gameLost || gameWon) return;
  const baseHp = window.innerWidth < 720 ? 8 : 12;
  const eliteBoss = currentLevel > 5;
  const eliteHpMultiplier = eliteBoss ? 2 : 1;
  const bossWidth = eliteBoss ? Math.min(300, window.innerWidth * .52) : Math.min(240, window.innerWidth * .44);
  boss.active = true;
  boss.maxHp = Math.max(4, baseHp * BASE_BOSS_HP_MULTIPLIER * enemyHealthMultiplier * eliteHpMultiplier);
  boss.hp = boss.maxHp;
  boss.x = window.innerWidth * (index % 2 ? .66 : .34) - bossWidth / 2;
  boss.y = 70 + Math.random() * 70 + index * 34;
  boss.vx = (index % 2 ? -1 : 1) * (58 + currentLevelPattern * 4);
  boss.el.classList.toggle("elite-boss", eliteBoss);
  boss.el.classList.add("active");
  boss.el.style.setProperty("--shield-opacity", eliteBoss ? ".98" : ".92");
  updateBossStatus();
  shieldHitSfx();
}

function animateBoss(now, dt) {
  bossShips.forEach((boss) => {
    if (!boss?.active) return;
    boss.x += boss.vx * dt;
    const bossWidth = boss.el.classList.contains("elite-boss") ? Math.min(300, window.innerWidth * .52) : Math.min(240, window.innerWidth * .44);
    if (boss.x < 24) {
      boss.x = 24;
      boss.vx = Math.abs(boss.vx);
    }
    if (boss.x > window.innerWidth - bossWidth - 24) {
      boss.x = window.innerWidth - bossWidth - 24;
      boss.vx = -Math.abs(boss.vx);
    }
    const drift = Math.sin(now / 760 + boss.phase) * (16 + currentLevelPattern * 2);
    boss.el.style.setProperty("--boss-x", `${boss.x}px`);
    boss.el.style.setProperty("--boss-y", `${boss.y + drift}px`);
  });
}

function hitBossShip(x, y, fromBullet = false, damage = PLAYER_DAMAGE_MULTIPLIER) {
  if (gameWon) return false;
  let didHit = false;
  activeBosses().forEach((boss) => {
    const rect = boss.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hitRadius = Math.max(96, rect.width * .48);
    const hitDx = cx - x;
    const hitDy = cy - y;
    if (hitDx * hitDx + hitDy * hitDy > hitRadius * hitRadius) return;
    boss.hp -= damage;
    boss.el.classList.remove("shield-hit");
    void boss.el.offsetWidth;
    boss.el.classList.add("shield-hit");
    window.setTimeout(() => boss.el.classList.remove("shield-hit"), 360);
    if (!fromBullet) createBlastVisual(x, y);
    shieldHitSfx();
    updateBossStatus();
    didHit = true;
    if (boss.hp <= 0) destroyBossShip(boss, cx, cy);
  });
  return didHit;
}

function destroyBossShip(boss, x, y) {
  if (!boss?.active) return;
  boss.active = false;
  boss.el.classList.remove("active", "shield-hit");
  destroyedShipCount += 5;
  score += 1000 * enemyHealthMultiplier;
  spawnPowerUps(x, y, 2);
  updateShipCounter();
  updateRestoreButton();
  bossExplosionSfx();
  for (let i = 0; i < particleBudget(3, 2); i += 1) {
    window.setTimeout(() => createBlastVisual(x + (Math.random() - .5) * 180, y + (Math.random() - .5) * 90), i * 120);
  }
  capTransientNodes(".destruction-piece", particleBudget(88, 48));
  const pieceCount = particleBudget(18, 10);
  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "destruction-piece";
    piece.style.setProperty("--x", `${x + (Math.random() - .5) * 180}px`);
    piece.style.setProperty("--y", `${y + (Math.random() - .5) * 90}px`);
    piece.style.setProperty("--dx", `${(Math.random() - .5) * 420}px`);
    piece.style.setProperty("--dy", `${80 + Math.random() * 300}px`);
    piece.style.setProperty("--r", `${(Math.random() - .5) * 980}deg`);
    piece.style.setProperty("--w", `${8 + Math.random() * 26}px`);
    piece.style.setProperty("--h", `${5 + Math.random() * 18}px`);
    piece.style.setProperty("--t", `${1 + Math.random() * 1.1}s`);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1500);
  }
  updateBossStatus();
  checkLevelComplete();
}

function restoreBossShip() {
  if (bossTimer) window.clearTimeout(bossTimer);
  bossTimer = null;
  bossShips.forEach((boss) => {
    if (!boss) return;
    boss.active = false;
    boss.hp = 0;
    boss.el.classList.remove("active", "shield-hit", "elite-boss");
  });
  updateBossStatus();
}

window.setTimeout(() => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      createEnemyShips(isMobileViewport() ? 5 : 7);
      queueNextShipFrame(320);
    }, { timeout: 2200 });
  } else {
    createEnemyShips(isMobileViewport() ? 5 : 7);
    queueNextShipFrame(320);
  }
}, 1200);

function capTransientNodes(selector, maxCount) {
  const nodes = document.querySelectorAll(selector);
  const overflow = nodes.length - maxCount;
  for (let i = 0; i < overflow; i += 1) nodes[i].remove();
}

function createBlastVisual(x, y) {
  capTransientNodes(".blast", particleBudget(8, 5));
  const blast = document.createElement("div");
  blast.className = "blast";
  blast.style.setProperty("--x", `${x}px`);
  blast.style.setProperty("--y", `${y}px`);
  blast.innerHTML = `<span class="blast-ring"></span><span class="blast-core"></span>`;
  const colors = ["#ff6a00", "#fff7ea", "#5ee2d2", "#ffb36e"];
  const particleCount = particleBudget(14, 8);
  for (let i = 0; i < particleCount; i += 1) {
    const particle = document.createElement("span");
    particle.className = "blast-particle";
    particle.style.setProperty("--a", `${(360 / particleCount) * i + Math.random() * 10}deg`);
    particle.style.setProperty("--d", `${70 + Math.random() * 130}px`);
    particle.style.setProperty("--s", `${3 + Math.random() * 7}px`);
    particle.style.setProperty("--t", `${.45 + Math.random() * .32}s`);
    particle.style.setProperty("--c", colors[i % colors.length]);
    blast.appendChild(particle);
  }
  document.body.appendChild(blast);
  window.setTimeout(() => blast.remove(), 820);
}

const physicsSelector = ".nav, .hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .role-card, .choice-btn, .request-main-btn, .send-request, .contact-link, textarea, select";
const destroyableSelector = ".hero-photo, .hero-copy, .panel, .tabs-shell, .project-card, .process-card, .request-card, .contact-card, .metric, .role-card";
const textSelector = "h1, h2, h3, p, .kicker, .eyebrow, .chip, .pill, .photo-tags span, .metric span, .contact-link span, .brand span, .tab-btn, .choice-btn, .request-main-btn, .send-request span, .mail-option, .nav-links a, .highlight, .info-box strong, .info-box small";
const restoreWorldBtn = document.getElementById("restoreWorldBtn");
const destroyedElements = new Map();
const elementDamage = new Map();
const textDamage = new Map();
let blastHistory = [];
let physicsTargets = [];
let destroyableTargets = [];
let textTargets = [];

function refreshDamageTargets() {
  physicsTargets = [...document.querySelectorAll(physicsSelector)];
  destroyableTargets = [...document.querySelectorAll(destroyableSelector)];
  textTargets = [...document.querySelectorAll(textSelector)];
}

refreshDamageTargets();

function updateRestoreButton() {
  const count = destroyedElements.size + elementDamage.size + textDamage.size;
  document.body.classList.toggle("has-destruction", count > 0);
  restoreWorldBtn.textContent = count > 0 ? `Restore ${count}` : "Restore";
}

function createDestructionDebris(rect, x, y) {
  capTransientNodes(".destruction-piece", particleBudget(88, 48));
  const colors = ["rgba(255,106,0,.92)", "rgba(255,247,234,.86)", "rgba(94,226,210,.78)", "rgba(255,179,110,.86)"];
  const pieceCount = particleBudget(9, 5);
  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "destruction-piece";
    const px = Math.min(rect.right, Math.max(rect.left, x + (Math.random() - .5) * rect.width * .85));
    const py = Math.min(rect.bottom, Math.max(rect.top, y + (Math.random() - .5) * rect.height * .85));
    const dx = (Math.random() - .5) * 190;
    const dy = 72 + Math.random() * 150;
    piece.style.setProperty("--x", `${px}px`);
    piece.style.setProperty("--y", `${py}px`);
    piece.style.setProperty("--dx", `${dx}px`);
    piece.style.setProperty("--dy", `${dy}px`);
    piece.style.setProperty("--r", `${(Math.random() - .5) * 760}deg`);
    piece.style.setProperty("--w", `${8 + Math.random() * 24}px`);
    piece.style.setProperty("--h", `${5 + Math.random() * 16}px`);
    piece.style.setProperty("--t", `${.68 + Math.random() * .55}s`);
    piece.style.background = colors[i % colors.length];
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1350);
  }
}

function removePersistentCracks(el) {
  el.querySelectorAll?.(".crack-overlay.persistent").forEach((crack) => crack.remove());
  if (!el.querySelector?.(".crack-overlay")) el.classList.remove("has-crack");
}

function clearElementDamage(el) {
  const damage = elementDamage.get(el);
  if (damage?.timer) window.clearTimeout(damage.timer);
  elementDamage.delete(el);
  el.classList.remove("damage-static", "damage-level-1", "damage-level-2", "damage-level-3");
  el.style.removeProperty("--damage-x");
  el.style.removeProperty("--damage-y");
  el.style.removeProperty("--damage-r");
  removePersistentCracks(el);
}

function setCrackOrigin(el, crack, x, y) {
  const rect = el.getBoundingClientRect();
  if (Number.isFinite(x) && Number.isFinite(y) && rect.width && rect.height) {
    const localX = Math.max(8, Math.min(92, ((x - rect.left) / rect.width) * 100));
    const localY = Math.max(8, Math.min(92, ((y - rect.top) / rect.height) * 100));
    crack.style.setProperty("--crack-x", `${localX.toFixed(1)}%`);
    crack.style.setProperty("--crack-y", `${localY.toFixed(1)}%`);
    return;
  }
  crack.style.setProperty("--crack-x", `${(34 + Math.random() * 32).toFixed(1)}%`);
  crack.style.setProperty("--crack-y", `${(34 + Math.random() * 32).toFixed(1)}%`);
}

function addPersistentCrack(el, x, y) {
  if (el.matches("textarea, select, input")) return;
  el.classList.add("has-crack");
  const crack = document.createElement("span");
  crack.className = "crack-overlay persistent";
  crack.style.setProperty("--crack-r", `${((Math.random() - .5) * 34).toFixed(1)}deg`);
  crack.style.setProperty("--crack-s", `${(.86 + Math.random() * .32).toFixed(2)}`);
  setCrackOrigin(el, crack, x, y);
  el.appendChild(crack);
}

function isProtectedHeader(el) {
  return Boolean(el?.closest?.(".nav"));
}

function applyElementDamage(el, x, y, force) {
  if (!el || isProtectedHeader(el) || destroyedElements.has(el) || el.closest(".modal") || el.classList.contains("space-ship")) return;
  const previous = elementDamage.get(el);
  const level = Math.min(4, (previous?.level || 0) + 1);
  if (previous?.timer) window.clearTimeout(previous.timer);
  if (level >= 4) {
    clearElementDamage(el);
    destroyElement(el, x, y);
    return;
  }

  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = cx - x;
  const dy = cy - y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const push = 8 + force * (22 + level * 8);
  const rot = ((dx / dist) * (3 + level * 2) + (Math.random() - .5) * 2.4).toFixed(2);
  el.classList.add("damage-static", `damage-level-${level}`);
  el.classList.remove("damage-level-1", "damage-level-2", "damage-level-3");
  el.classList.add(`damage-level-${level}`);
  window.setTimeout(() => {
    if (destroyedElements.has(el)) return;
    el.style.setProperty("--damage-x", `${((dx / dist) * push).toFixed(2)}px`);
    el.style.setProperty("--damage-y", `${((dy / dist) * push).toFixed(2)}px`);
    el.style.setProperty("--damage-r", `${rot}deg`);
  }, 760);
  if (level >= 2) addPersistentCrack(el, x, y);
  if (level >= 3) addPersistentCrack(el, x, y);
  const timer = window.setTimeout(() => {
    clearElementDamage(el);
    updateRestoreButton();
  }, 25000);
  elementDamage.set(el, { level, timer });
}

function restoreElement(el) {
  if (!destroyedElements.has(el)) return;
  window.clearTimeout(destroyedElements.get(el));
  destroyedElements.delete(el);
  clearElementDamage(el);
  restoreContainedTextDamage(el);
  el.classList.remove("destroyed-element");
  el.style.removeProperty("--destroy-x");
  el.style.removeProperty("--destroy-y");
  el.style.removeProperty("--destroy-r");
  el.classList.add("restore-pop");
  window.setTimeout(() => el.classList.remove("restore-pop"), 650);
  updateRestoreButton();
}

function restoreDestroyedElements() {
  [...destroyedElements.keys()].forEach(restoreElement);
  [...elementDamage.keys()].forEach(clearElementDamage);
  [...textDamage.keys()].forEach(restoreTextDamage);
  restoreEnemyShips();
  restoreBossShip();
  clearProjectiles();
  clearPowerUps();
  playerHealth = 100;
  shieldHP = 0;
  if (playModeActive) {
    resetGameStats();
    setupLevel(1);
  }
  playerInvulnerableUntil = performance.now() + 900;
  playerShip.classList.remove("player-hit", "player-shield");
  blastHistory = [];
  updateGameHud();
  updateRestoreButton();
}

function isOutOfViewportForRestore(el) {
  if (!el?.isConnected) return true;
  const rect = el.getBoundingClientRect();
  const margin = 96;
  return rect.bottom < -margin || rect.top > window.innerHeight + margin || rect.right < -margin || rect.left > window.innerWidth + margin;
}

function hasDestroyedAncestor(el) {
  return [...destroyedElements.keys()].some((container) => container !== el && container.contains?.(el));
}

let offscreenRestoreQueued = false;

function restoreOffscreenDamage() {
  offscreenRestoreQueued = false;
  let changed = false;
  [...destroyedElements.keys()].forEach((el) => {
    if (isOutOfViewportForRestore(el)) {
      restoreElement(el);
      changed = true;
    }
  });
  [...elementDamage.keys()].forEach((el) => {
    if (destroyedElements.has(el)) return;
    if (isOutOfViewportForRestore(el)) {
      clearElementDamage(el);
      changed = true;
    }
  });
  [...textDamage.keys()].forEach((el) => {
    if (hasDestroyedAncestor(el)) return;
    if (isOutOfViewportForRestore(el)) {
      restoreTextDamage(el);
      changed = true;
    }
  });
  if (changed) updateRestoreButton();
}

function queueOffscreenRestoreCheck() {
  if (offscreenRestoreQueued || playModeActive) return;
  offscreenRestoreQueued = true;
  window.requestAnimationFrame(restoreOffscreenDamage);
}

window.addEventListener("scroll", queueOffscreenRestoreCheck, { passive: true });
window.addEventListener("resize", queueOffscreenRestoreCheck, { passive: true });

restoreWorldBtn.addEventListener("click", restoreDestroyedElements);

function destroyElement(el, x, y) {
  if (!el || isProtectedHeader(el) || destroyedElements.has(el) || el.closest(".modal")) return;
  clearElementDamage(el);
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = cx - x;
  const dy = cy - y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const push = Math.min(90, Math.max(34, 120 - dist * .15));
  el.style.setProperty("--destroy-x", `${(dx / dist * push).toFixed(2)}px`);
  el.style.setProperty("--destroy-y", `${(dy / dist * push).toFixed(2)}px`);
  el.style.setProperty("--destroy-r", `${((dx / dist) * 18 + (Math.random() - .5) * 16).toFixed(2)}deg`);
  addCrack(el, x, y);
  createDestructionDebris(rect, x, y);
  el.classList.remove("physics-hit", "restore-pop");
  void el.offsetWidth;
  el.classList.add("destroyed-element");
  const restoreTimer = window.setTimeout(() => restoreElement(el), 25000);
  destroyedElements.set(el, restoreTimer);
  updateRestoreButton();
}

function destroyNearbyElements(x, y, pressure) {
  const radius = 260;
  const candidates = destroyableTargets
    .filter((el) => !destroyedElements.has(el) && !el.closest(".modal"))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const dist = Math.hypot(dx, dy);
      return { el, dist, rect };
    })
    .filter((item) => item.rect.width > 0 && item.rect.height > 0 && item.rect.bottom > -80 && item.rect.top < window.innerHeight + 80 && item.dist < radius)
    .sort((a, b) => a.dist - b.dist);

  const amount = pressure >= 7 ? 2 : 1;
  candidates.slice(0, amount).forEach((item, index) => {
    window.setTimeout(() => destroyElement(item.el, x, y), index * 130);
  });
}

function registerBlastPressure(x, y) {
  const now = performance.now();
  const sameSpotRadius = 115;
  const windowMs = 8500;
  blastHistory = blastHistory.filter((blast) => now - blast.t < windowMs);
  blastHistory.push({ x, y, t: now });
  const pressure = blastHistory.filter((blast) => Math.hypot(blast.x - x, blast.y - y) < sameSpotRadius).length;
  if (pressure >= 4) {
    destroyNearbyElements(x, y, pressure);
    blastHistory = blastHistory.filter((blast) => Math.hypot(blast.x - x, blast.y - y) >= sameSpotRadius);
  }
}

function addCrack(el, x, y) {
  if (el.matches("textarea, select, input")) return;
  el.classList.add("has-crack");
  const crack = document.createElement("span");
  crack.className = "crack-overlay";
  crack.style.setProperty("--crack-r", `${((Math.random() - .5) * 38).toFixed(1)}deg`);
  crack.style.setProperty("--crack-s", `${(.82 + Math.random() * .38).toFixed(2)}`);
  setCrackOrigin(el, crack, x, y);
  el.appendChild(crack);
  window.setTimeout(() => crack.remove(), 6400);
  window.setTimeout(() => {
    if (!el.querySelector(".crack-overlay")) el.classList.remove("has-crack");
  }, 6500);
}

function joltElements(x, y, options = {}) {
  const radius = lowPowerDevice ? Math.min(420, Math.max(260, window.innerWidth * .50)) : Math.min(620, Math.max(380, window.innerWidth * .58));
  let affected = 0;
  const maxAffected = lowPowerDevice ? 9 : 18;
  physicsTargets.forEach((el) => {
    if (affected >= maxAffected) return;
    if (destroyedElements.has(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom < -80 || rect.top > window.innerHeight + 80) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    if (dist > radius) return;
    const force = Math.pow(1 - dist / radius, 1.7);
    const push = 12 + force * 54;
    const nx = dx / dist;
    const ny = dy / dist;
    const tx = nx * push;
    const ty = ny * push;
    const rot = (nx * 8 + (Math.random() - .5) * 3) * force;
    el.style.setProperty("--blast-x", `${tx.toFixed(2)}px`);
    el.style.setProperty("--blast-y", `${ty.toFixed(2)}px`);
    el.style.setProperty("--blast-r", `${rot.toFixed(2)}deg`);
    el.style.setProperty("--recoil-x", `${(-tx * .22).toFixed(2)}px`);
    el.style.setProperty("--recoil-y", `${(-ty * .22).toFixed(2)}px`);
    el.style.setProperty("--recoil-r", `${(-rot * .32).toFixed(2)}deg`);
    el.classList.remove("physics-hit");
    void el.offsetWidth;
    el.classList.add("physics-hit");
    window.setTimeout(() => el.classList.remove("physics-hit"), 900);
    affected += 1;
    if (!options.visualOnly && force > .10) applyElementDamage(el, x, y, force);
  });
}

function collectColliderRects(sourceEl) {
  return physicsTargets
    .filter((el) => el !== sourceEl && !destroyedElements.has(el))
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight)
    .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
}

let lastLetterPop = 0;

function explodeLetterParticle(item) {
  if (item.exploded) return;
  item.exploded = true;
  capTransientNodes(".letter-spark", particleBudget(72, 36));
  const colors = ["#fff7ea", "#ff6a00", "#5ee2d2"];
  const sparkCount = particleBudget(4, 2);
  for (let i = 0; i < sparkCount; i += 1) {
    const spark = document.createElement("span");
    spark.className = "letter-spark";
    spark.style.setProperty("--x", `${item.x}px`);
    spark.style.setProperty("--y", `${item.y}px`);
    spark.style.setProperty("--dx", `${(Math.random() - .5) * 82}px`);
    spark.style.setProperty("--dy", `${(Math.random() - .5) * 82}px`);
    spark.style.setProperty("--r", `${(Math.random() - .5) * 420}deg`);
    spark.style.setProperty("--s", `${2 + Math.random() * 5}px`);
    spark.style.setProperty("--t", `${.34 + Math.random() * .28}s`);
    spark.style.setProperty("--c", colors[i % colors.length]);
    document.body.appendChild(spark);
    window.setTimeout(() => spark.remove(), 760);
  }
  item.el.remove();
  const now = performance.now();
  if (now - lastLetterPop > 90) {
    letterPopSfx();
    lastLetterPop = now;
  }
}

function animateLetterParticles(items, colliders, duration = 4600) {
  let last = performance.now();
  const started = last;
  function tick(now) {
    const dt = Math.min(2, (now - last) / 16.67);
    const elapsed = now - started;
    last = now;
    items.forEach((item) => {
      if (item.exploded) return;
      item.vy += .48 * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.rot += item.vr * dt;

      if (item.x < 6 || item.x > window.innerWidth - 18 || item.y < 6 || item.y > window.innerHeight - 18) {
        item.x = Math.max(6, Math.min(window.innerWidth - 18, item.x));
        item.y = Math.max(6, Math.min(window.innerHeight - 18, item.y));
        if (elapsed > 760) {
          explodeLetterParticle(item);
          return;
        }
        item.vx *= -.58;
        item.vy *= -.48;
        return;
      }

      for (const c of colliders) {
        if (item.x > c.left && item.x < c.right && item.y > c.top && item.y < c.bottom) {
          const distances = [
            { side: "left", d: Math.abs(item.x - c.left) },
            { side: "right", d: Math.abs(c.right - item.x) },
            { side: "top", d: Math.abs(item.y - c.top) },
            { side: "bottom", d: Math.abs(c.bottom - item.y) }
          ].sort((a, b) => a.d - b.d);
          const hit = distances[0].side;
          if (hit === "left") { item.x = c.left - 2; item.vx = -Math.abs(item.vx) * .72; }
          if (hit === "right") { item.x = c.right + 2; item.vx = Math.abs(item.vx) * .72; }
          if (hit === "top") { item.y = c.top - 2; item.vy = -Math.abs(item.vy) * .56; item.vx *= .88; }
          if (hit === "bottom") { item.y = c.bottom + 2; item.vy = Math.abs(item.vy) * .56; }
        }
      }

      item.el.style.opacity = "1";
      item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rot}deg)`;
    });

    if (elapsed < duration && items.some((item) => !item.exploded)) requestAnimationFrame(tick);
    else items.forEach(explodeLetterParticle);
  }
  requestAnimationFrame(tick);
}

function shatterTextBox(el) {
  const rect = el.getBoundingClientRect();
  const raw = (el.value && el.value.trim()) ? el.value : (el.placeholder || "Add project details");
  const text = raw.replace(/\s+/g, " ").slice(0, particleBudget(72, 42));
  if (!text) return;
  el.classList.remove("text-blast");
  void el.offsetWidth;
  el.classList.add("text-blast");
  window.setTimeout(() => el.classList.remove("text-blast"), 700);

  const colliders = collectColliderRects(el);
  const items = [];
  [...text].forEach((char, i) => {
    if (char === " ") return;
    const letter = document.createElement("span");
    letter.className = "fall-letter";
    letter.textContent = char;
    const columns = Math.max(8, Math.floor(rect.width / 16));
    const row = Math.floor(i / columns);
    const col = i % columns;
    const startX = rect.left + 18 + col * 13 + Math.random() * 5;
    const startY = rect.top + 18 + row * 20;
    document.body.appendChild(letter);
    items.push({
      el: letter,
      x: startX,
      y: startY,
      vx: (Math.random() - .5) * 8,
      vy: -6 - Math.random() * 7,
      rot: (Math.random() - .5) * 90,
      vr: (Math.random() - .5) * 11
    });
  });

  animateLetterParticles(items, colliders, particleBudget(3400, 2400));
}

function getTextNodes(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, textarea, select, option")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function copyLetterStyle(source, letter) {
  const style = getComputedStyle(source);
  letter.style.fontFamily = style.fontFamily;
  letter.style.fontSize = style.fontSize;
  letter.style.fontWeight = style.fontWeight;
  letter.style.fontStyle = style.fontStyle;
  letter.style.letterSpacing = style.letterSpacing;
  letter.style.lineHeight = style.lineHeight;
  letter.style.color = style.color;
}

function shatterTextElement(el, blastX, blastY) {
  if (!el || el.classList.contains("shattered-text-source") || el.closest(".modal")) return false;
  const sourceRect = el.getBoundingClientRect();
  if (sourceRect.width === 0 || sourceRect.height === 0) return false;
  const existing = textDamage.get(el);
  if (existing?.timer) window.clearTimeout(existing.timer);
  const originalHtml = existing?.html ?? el.innerHTML;

  const colliders = collectColliderRects(el);
  const items = [];
  const range = document.createRange();
  let emitted = 0;
  const maxLetters = particleBudget(130, 72);

  getTextNodes(el).some((node) => {
    for (let i = 0; i < node.nodeValue.length; i += 1) {
      const char = node.nodeValue[i];
      if (/\s/.test(char)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const letter = document.createElement("span");
      letter.className = "fall-letter";
      letter.textContent = char;
      copyLetterStyle(node.parentElement || el, letter);
      document.body.appendChild(letter);

      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const dx = startX - blastX;
      const dy = startY - blastY;
      const dist = Math.max(14, Math.hypot(dx, dy));
      const closeness = Math.max(0, 1 - dist / 520);
      const impulse = 4 + closeness * 13;
      items.push({
        el: letter,
        x: startX,
        y: startY,
        vx: (dx / dist) * impulse + (Math.random() - .5) * 4,
        vy: (dy / dist) * impulse - 5 - closeness * 5 + (Math.random() - .5) * 2,
        rot: (Math.random() - .5) * 80,
        vr: (Math.random() - .5) * (9 + closeness * 12)
      });

      emitted += 1;
      if (emitted >= maxLetters) return true;
    }
    return false;
  });
  range.detach();
  if (!items.length) return false;

  el.classList.add("shattered-text-source");
  el.classList.remove("text-blast");
  void el.offsetWidth;
  el.classList.add("text-blast");
  textDamage.set(el, { level: 2, html: originalHtml, timer: null });
  updateRestoreButton();
  window.setTimeout(() => {
    el.classList.remove("text-blast");
  }, particleBudget(3600, 2600));
  animateLetterParticles(items, colliders, particleBudget(3400, 2400));
  return true;
}

function restoreTextDamage(el) {
  const damage = textDamage.get(el);
  if (!damage) return;
  if (damage.timer) window.clearTimeout(damage.timer);
  if (damage.html != null) el.innerHTML = damage.html;
  el.classList.remove("text-damaged", "shattered-text-source", "text-blast");
  textDamage.delete(el);
  updateRestoreButton();
}

function restoreContainedTextDamage(container) {
  [...textDamage.keys()].forEach((el) => {
    if (el === container || container.contains?.(el)) restoreTextDamage(el);
  });
}

function misalignTextElement(el) {
  if (!el || el.closest(".modal") || el.classList.contains("shattered-text-source")) return false;
  const text = el.textContent;
  if (!text || !text.trim()) return false;
  const existing = textDamage.get(el);
  if (existing?.timer) window.clearTimeout(existing.timer);
  const originalHtml = existing?.html ?? el.innerHTML;
  const escapeChar = (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char);
  el.innerHTML = [...text].map((char, index) => {
    if (char === " ") return " ";
    const tx = ((index % 3) - 1) * (1.5 + Math.random() * 2.5);
    const ty = ((index % 4) - 1.5) * (1 + Math.random() * 1.8);
    const tr = ((index % 5) - 2) * (1.4 + Math.random() * 2.2);
    return `<span class="damage-letter" style="--tx:${tx.toFixed(1)}px;--ty:${ty.toFixed(1)}px;--tr:${tr.toFixed(1)}deg">${escapeChar(char)}</span>`;
  }).join("");
  el.classList.add("text-damaged");
  textDamage.set(el, { level: 1, html: originalHtml, timer: null });
  updateRestoreButton();
  return true;
}

function handleTextHit(el, x, y) {
  if (!el) return false;
  if (el.classList.contains("shattered-text-source")) return true;
  const damage = textDamage.get(el);
  if (damage?.level >= 2) return true;
  if (!damage) return misalignTextElement(el);
  return shatterTextElement(el, x, y);
}

function shatterTextNear(x, y, directTarget) {
  const directText = directTarget?.closest?.(textSelector);
  if (directText && !isProtectedHeader(directText) && handleTextHit(directText, x, y)) return true;

  const candidates = textTargets
    .filter((el) => !isProtectedHeader(el) && !el.closest(".modal") && !el.classList.contains("shattered-text-source") && el.textContent.trim().length > 1)
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      return { el, rect, dist: Math.hypot(dx, dy) };
    })
    .filter((item) => item.rect.width > 0 && item.rect.height > 0 && item.rect.bottom > 0 && item.rect.top < window.innerHeight && item.dist < 44)
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  if (candidates[0]) return handleTextHit(candidates[0].el, x, y);
  return false;
}

function triggerFunBlast(x = pointer.x, y = pointer.y) {
  blastSfx();
  createBlastVisual(x, y);
  hitEnemyShips(x, y);
  const target = document.elementFromPoint(x, y);
  const textTarget = target?.closest?.("textarea, input[type='text'], input[type='email'], input:not([type]), [contenteditable='true']");
  let textHandled = false;
  if (textTarget) {
    shatterTextBox(textTarget);
    textHandled = true;
  } else {
    textHandled = shatterTextNear(x, y, target);
  }
  joltElements(x, y, { visualOnly: textHandled });
}

window.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const typing = tag === "textarea" || tag === "input" || tag === "select" || document.activeElement?.isContentEditable;
  if (typing) return;
  if (event.key.toLowerCase() === "x" && !event.repeat) {
    if (playModeActive) {
      event.preventDefault();
      createPlayerBullet();
      return;
    }
    triggerFunBlast(pointer.x, pointer.y);
  }
});

let lastMobileTap = null;

function showScrollLockWarning() {
  if (!playModeActive) return;
  document.body.classList.add("show-scroll-warning");
  if (warningTimer) window.clearTimeout(warningTimer);
  warningTimer = window.setTimeout(() => document.body.classList.remove("show-scroll-warning"), 2200);
}

window.addEventListener("pointerdown", (event) => {
  updatePointer(event.clientX, event.clientY);
  if (playModeActive) {
    pointerShooting = true;
    createPlayerBullet();
    event.preventDefault();
    return;
  }
}, { passive: false });

window.addEventListener("pointermove", (event) => {
  if (playModeActive && pointerShooting) {
    updatePointer(event.clientX, event.clientY);
    return;
  }
}, { passive: true });

["pointerup", "pointercancel"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    pointerShooting = false;
    if (eventName !== "pointerup" || playModeActive || event.pointerType === "mouse") return;
    const interactiveTarget = event.target?.closest?.("a, button, input, textarea, select, label");
    if (interactiveTarget) return;
    const now = performance.now();
    const tap = { x: event.clientX, y: event.clientY, t: now };
    if (lastMobileTap && now - lastMobileTap.t < 340 && Math.hypot(tap.x - lastMobileTap.x, tap.y - lastMobileTap.y) < 34) {
      updatePointer(tap.x, tap.y);
      triggerFunBlast(tap.x, tap.y);
      lastMobileTap = null;
      event.preventDefault();
      return;
    }
    lastMobileTap = tap;
  }, { passive: false });
});

window.addEventListener("wheel", (event) => {
  if (!playModeActive) return;
  event.preventDefault();
  window.scrollTo(0, lockedScrollY);
  showScrollLockWarning();
}, { passive: false });

window.addEventListener("touchmove", (event) => {
  if (!playModeActive) return;
  const touch = event.touches[0];
  if (touch && pointerShooting) updatePointer(touch.clientX, touch.clientY);
  if (!pointerShooting) showScrollLockWarning();
  event.preventDefault();
}, { passive: false });

window.addEventListener("scroll", () => {
  if (!playModeActive) return;
  if (Math.abs(window.scrollY - lockedScrollY) > 2) {
    window.scrollTo(0, lockedScrollY);
    showScrollLockWarning();
  }
}, { passive: true });

document.getElementById("year").textContent = new Date().getFullYear();
