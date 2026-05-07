import mermaid from "./vendor/mermaid/mermaid.esm.min.mjs";
const FLOW_STEPS = [
  {
    shortTitle: "Request route",
    title: "Holder requests the protected route",
    iconLabel: "REQ",
    description:
      "The caller hits a specific resource or operation before any out-of-band wallet ceremony is imposed.",
    copy:
      "<strong>1.</strong> A holder, app, or agent requests a protected route that may require credential proof.",
    from: "holder",
    to: "verifier",
    sequenceLines: ["holder->>verifier: GET protected route"],
  },
  {
    shortTitle: "Return challenge",
    title: "Verifier returns a x401 challenge",
    iconLabel: "401",
    description:
      "The route responds with 401 Unauthorized, WWW-Authenticate: x401, and a x401 envelope describing the proof contract.",
    copy:
      "<strong>2.</strong> The verifier answers with <strong>401 Unauthorized</strong>, a <strong>WWW-Authenticate: x401</strong> challenge, and a body carrying the x401 envelope.",
    from: "verifier",
    to: "holder",
    sequenceLines: [
      "verifier-->>holder: 401 + WWW-Authenticate: x401<br/>x401 envelope with OIDC4VP request",
    ],
  },
  {
    shortTitle: "Hand to wallet",
    title: "The OIDC4VP request is handed to a wallet",
    iconLabel: "VP",
    description:
      "The client hands the embedded request or request_uri to a wallet-capable component that can satisfy the verifier's policy.",
    copy:
      "<strong>3.</strong> The caller hands the embedded or referenced <strong>OIDC4VP</strong> request to a wallet-capable component for fulfillment.",
    from: "holder",
    to: "wallet",
    sequenceLines: ["holder->>wallet: Hand off the OIDC4VP request"],
  },
  {
    shortTitle: "Present proof",
    title: "Wallet satisfies the proof request",
    iconLabel: "SUB",
    description:
      "The wallet completes the standard OIDC4VP response flow and submits the presentation to the verifier.",
    copy:
      "<strong>4.</strong> The wallet fulfills the proof request using standard <strong>OIDC4VP</strong> response handling and submits the result to the verifier.",
    from: "wallet",
    to: "verifier",
    sequenceLines: ["wallet->>verifier: Submit VP response"],
  },
  {
    shortTitle: "Issue receipt",
    title: "Verifier issues the retry artifact",
    iconLabel: "OK",
    description:
      "After validation, the verifier can mint a receipt, token, or accepted-proof state for the original route to consume.",
    copy:
      "<strong>5.</strong> After validation, the verifier returns a <strong>retry artifact</strong>, accepted-proof state, or equivalent signal for the original route.",
    from: "verifier",
    to: "holder",
    sequenceLines: ["verifier-->>holder: Return verifier receipt or accepted state"],
  },
  {
    shortTitle: "Retry route",
    title: "Holder retries and access is granted",
    iconLabel: "200",
    description:
      "The caller retries the protected route with the expected proof artifact. If payment is still due, the flow can continue separately under HTTP 402.",
    copy:
      "<strong>6.</strong> The caller retries the route with the expected artifact and gets the resource. If payment still remains, the verifier can continue under <strong>402</strong> without overloading proof semantics.",
    from: "holder",
    to: "verifier",
    sequenceLines: [
      "holder->>verifier: Retry with proof artifact",
      "verifier-->>holder: 200 protected resource",
    ],
  },
];

let flowIndex = 0;
let flowRenderToken = 0;
let flowDiagramPromise = null;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  fontFamily: "IBM Plex Mono, SFMono-Regular, monospace",
  themeVariables: {
    background: "#0d1422",
    darkMode: true,
    primaryColor: "#122033",
    primaryBorderColor: "#60a5fa",
    primaryTextColor: "#f3f6fb",
    secondaryColor: "#142236",
    secondaryBorderColor: "rgba(147, 197, 253, 0.32)",
    secondaryTextColor: "#e5eefb",
    tertiaryColor: "#0b1320",
    tertiaryTextColor: "#dbeafe",
    lineColor: "#7dd3fc",
    textColor: "#e5eefb",
    actorBkg: "#122033",
    actorBorder: "#60a5fa",
    actorTextColor: "#f3f6fb",
    actorLineColor: "rgba(255, 255, 255, 0.14)",
    signalColor: "#93c5fd",
    signalTextColor: "#eff6ff",
    labelBoxBkgColor: "#132033",
    labelBoxBorderColor: "rgba(147, 197, 253, 0.26)",
    labelTextColor: "#eff6ff",
    noteBkgColor: "rgba(96, 165, 250, 0.12)",
    noteBorderColor: "rgba(147, 197, 253, 0.34)",
    noteTextColor: "#dbeafe",
    activationBorderColor: "#60a5fa",
    activationBkgColor: "rgba(96, 165, 250, 0.18)",
  },
});

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function wireButtons() {
  document.querySelectorAll("[data-href]").forEach((button) => {
    button.addEventListener("click", () => {
      const href = button.dataset.href;
      if (!href) {
        return;
      }

      if (button.dataset.external === "true") {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }

      window.location.href = href;
    });
  });
}

function updateCurrentYear() {
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(year);
  });
}

function configureLocalOnlyState() {
  document.documentElement.dataset.localDemo = isLocalHost(window.location.hostname)
    ? "true"
    : "false";
}

function fetchGithubStars() {
  const starsNode = document.querySelector("[data-github-stars]");
  if (!starsNode) {
    return;
  }

  fetch("https://api.github.com/repos/csuwildcat/x401")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}`);
      }

      return response.json();
    })
    .then((data) => {
      if (typeof data?.stargazers_count !== "number") {
        return;
      }

      starsNode.textContent = `★ ${data.stargazers_count.toLocaleString()}`;
      starsNode.hidden = false;
    })
    .catch(() => {
      starsNode.hidden = true;
    });
}

function setupHeaderState() {
  const header = document.querySelector("[data-site-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const panel = document.querySelector("[data-nav-panel]");
  const root = document.documentElement;
  if (!(header instanceof HTMLElement) || !(toggle instanceof HTMLElement) || !panel) {
    return;
  }

  const syncScrollState = () => {
    header.dataset.scrolled = window.scrollY > 10 ? "true" : "false";
  };

  const closeNav = () => {
    header.dataset.open = "false";
    root.dataset.navOpen = "false";
    toggle.setAttribute("aria-expanded", "false");
  };

  const openNav = () => {
    header.dataset.open = "true";
    root.dataset.navOpen = "true";
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    if (header.dataset.open === "true") {
      closeNav();
      return;
    }

    openNav();
  });

  document.addEventListener("click", (event) => {
    if (header.dataset.open !== "true") {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (header.contains(target)) {
      if (target instanceof HTMLElement && target.closest(".site-nav a")) {
        closeNav();
      }

      return;
    }

    closeNav();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) {
      closeNav();
    }
  });

  syncScrollState();
  window.addEventListener("scroll", syncScrollState, { passive: true });
}

function buildMermaidFlow() {
  return [
    "sequenceDiagram",
    "accTitle: x401 protected-route proof flow",
    "accDescr: x401 protected-route proof flow with all steps rendered in a single sequence diagram.",
    "participant wallet as Wallet",
    "participant holder as Caller",
    "participant verifier as Verifier / Route",
    ...FLOW_STEPS.flatMap((item) => item.sequenceLines),
  ].join("\n");
}

function sortNodesInDocumentOrder(nodes) {
  return [...nodes].sort((left, right) => {
    if (left === right) {
      return 0;
    }

    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

function annotateFlowDiagramSteps(diagram) {
  const svg = diagram.querySelector("svg");
  if (!(svg instanceof SVGElement)) {
    return false;
  }

  const messageTexts = Array.from(svg.querySelectorAll(".messageText"));
  const messageLines = Array.from(svg.querySelectorAll(".messageLine0, .messageLine1"));
  const totalMessages = FLOW_STEPS.reduce((count, step) => count + step.sequenceLines.length, 0);

  if (messageTexts.length !== totalMessages || messageLines.length !== totalMessages) {
    console.warn("Unexpected Mermaid sequence structure; step fades were not applied.");
    return false;
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  let messageOffset = 0;

  FLOW_STEPS.forEach((step, index) => {
    const stepGroup = document.createElementNS(svgNamespace, "g");
    stepGroup.setAttribute("class", "flow-sequence-step");
    stepGroup.dataset.flowStep = String(index);

    // A logical step can span multiple Mermaid messages, so slice by sequenceLines length.
    const stepMessageCount = step.sequenceLines.length;
    const nodes = sortNodesInDocumentOrder([
      ...messageTexts.slice(messageOffset, messageOffset + stepMessageCount),
      ...messageLines.slice(messageOffset, messageOffset + stepMessageCount),
    ]);
    messageOffset += stepMessageCount;

    const firstNode = nodes[0];
    firstNode.parentNode?.insertBefore(stepGroup, firstNode);

    nodes.forEach((node) => {
      stepGroup.appendChild(node);
    });
  });

  return messageOffset === totalMessages;
}

function syncFlowDiagramVisibility() {
  const diagram = document.querySelector("#flow-diagram");
  if (!(diagram instanceof HTMLElement)) {
    return;
  }

  diagram.querySelectorAll("[data-flow-step]").forEach((group) => {
    const stepIndex = Number(group.getAttribute("data-flow-step"));
    group.setAttribute("data-flow-visible", stepIndex <= flowIndex ? "true" : "false");
  });
}

async function renderFlowDiagram() {
  const diagram = document.querySelector("#flow-diagram");
  if (!(diagram instanceof HTMLElement)) {
    return;
  }

  if (flowDiagramPromise) {
    await flowDiagramPromise;
    syncFlowDiagramVisibility();
    return;
  }

  const renderToken = ++flowRenderToken;
  const diagramId = `flow-diagram-full-${renderToken}`;

  try {
    flowDiagramPromise = mermaid.render(diagramId, buildMermaidFlow());
    const { svg, bindFunctions } = await flowDiagramPromise;

    if (renderToken !== flowRenderToken) {
      return;
    }

    diagram.innerHTML = svg;
    bindFunctions?.(diagram);
    annotateFlowDiagramSteps(diagram);
    syncFlowDiagramVisibility();
  } catch (error) {
    if (renderToken !== flowRenderToken) {
      return;
    }

    diagram.innerHTML = `
      <div class="flow-stage__fallback">
        <p>Unable to render the x401 swimlane diagram for this step.</p>
      </div>
    `;
    console.error("Failed to render Mermaid flow diagram", error);
  } finally {
    if (!diagram.querySelector("[data-flow-step]")) {
      flowDiagramPromise = null;
    }
  }
}

function renderFlowSlides() {
  return FLOW_STEPS.map((step, index) => {
    return `
      <wa-carousel-item>
        <div class="flow-step">
          <div class="flow-step__header">
            <div class="flow-step__icon">${step.iconLabel}</div>
            <div>
              <p class="flow-step__count">Step ${index + 1} of ${FLOW_STEPS.length}</p>
              <h3>${step.title}</h3>
            </div>
          </div>
          <p class="flow-step__description">${step.description}</p>
        </div>
      </wa-carousel-item>
    `;
  }).join("");
}

function syncFlowState(nextIndex) {
  const dots = document.querySelectorAll(".flow-dot");
  const step = FLOW_STEPS[nextIndex];

  if (!step) {
    return;
  }

  flowIndex = nextIndex;
  syncFlowDiagramVisibility();

  dots.forEach((dot, index) => {
    dot.dataset.active = index === flowIndex ? "true" : "false";
    dot.setAttribute("aria-pressed", index === flowIndex ? "true" : "false");
  });
}

function goToFlowSlide(carousel, nextIndex, behavior = "smooth") {
  if (typeof carousel?.goToSlide === "function") {
    carousel.goToSlide(nextIndex, behavior);
    return true;
  }

  return false;
}

function moveFlowSlide(carousel, direction) {
  if (direction === "next" && typeof carousel?.next === "function") {
    carousel.next("smooth");
    return true;
  }

  if (direction === "previous" && typeof carousel?.previous === "function") {
    carousel.previous("smooth");
    return true;
  }

  return false;
}

function buildFlowSection() {
  const flowRoot = document.querySelector("[data-flow-root]");
  const carousel = document.querySelector("#flow-carousel");
  const dots = document.querySelector("#flow-dots");
  const prev = document.querySelector("#flow-prev");
  const next = document.querySelector("#flow-next");

  if (!flowRoot || !carousel || !dots || !prev || !next) {
    return;
  }

  carousel.innerHTML = renderFlowSlides();

  dots.innerHTML = FLOW_STEPS.map((step, index) => {
    return `
      <button
        class="flow-dot"
        type="button"
        data-flow-index="${index}"
        data-active="false"
        aria-label="Show ${step.shortTitle}"
        aria-pressed="false"
      ></button>
    `;
  }).join("");

  flowRoot.querySelectorAll("[data-flow-index]").forEach((dot) => {
    dot.addEventListener("click", () => {
      const nextIndex = Number(dot.getAttribute("data-flow-index"));
      if (!goToFlowSlide(carousel, nextIndex)) {
        syncFlowState(nextIndex);
      }
    });
  });

  carousel.addEventListener("wa-slide-change", (event) => {
    const nextIndex = event.detail?.index;
    if (typeof nextIndex !== "number") {
      return;
    }

    syncFlowState(nextIndex);
  });

  prev.addEventListener("click", () => {
    if (!moveFlowSlide(carousel, "previous")) {
      const nextIndex = flowIndex === 0 ? FLOW_STEPS.length - 1 : flowIndex - 1;
      syncFlowState(nextIndex);
    }
  });

  next.addEventListener("click", () => {
    if (!moveFlowSlide(carousel, "next")) {
      const nextIndex = flowIndex === FLOW_STEPS.length - 1 ? 0 : flowIndex + 1;
      syncFlowState(nextIndex);
    }
  });

  syncFlowState(0);
  goToFlowSlide(carousel, 0, "auto");
  void renderFlowDiagram();
}

configureLocalOnlyState();
wireButtons();
updateCurrentYear();
fetchGithubStars();
setupHeaderState();
buildFlowSection();
