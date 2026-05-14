import { LitElement, css, html } from "lit";
import "./x401-story-timeline.js";

const PAPER_ROUTE = "/papers/medical-study-123";
const EXISTING_APP_TOKEN = "demo-existing-application-token";

const ACTOR_DESCRIPTIONS = {
  doctor: "Board-certified physician holding the credential.",
  agent: "Local AI agent acting under delegated presentation rights.",
  issuer: "Texas board issuing the credential and status list.",
  relyingParty: "Research archive verifier guarding the paper route.",
};

const ACTOR_VISUALS = {
  doctor: { icon: "user-doctor", accent: "doctor" },
  agent: { icon: "robot", accent: "agent" },
  issuer: { icon: "building-columns", accent: "issuer" },
  relyingParty: { icon: "shield-check", accent: "relying-party" },
};

const STEP_VISUALS = {
  gate: "route",
  request: "magnifying-glass",
  presentation: "key",
  present: "shield-check",
  retry: "book-open",
};

const PHASE_PACKET_SUMMARIES = {
  gate: "Decoded X401: require payload from the protected route.",
  request: "Agent-created OIDC4VP Authorization Request payload.",
  presentation: "Delegated VP bundle prepared by the local wallet.",
  present: "X401: present request header carrying a VP Artifact.",
  retry: "Final protected paper payload returned by the relying party.",
};

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatDidForDisplay(value) {
  return typeof value === "string" ? value.replaceAll("%3A", ":") : value;
}

function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function encodeBase64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeBase64UrlJson(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseX401Header(value) {
  if (!value) {
    return null;
  }

  if (value.includes(",")) {
    throw new Error("Expected a single X401 message, but the header contained a comma-separated value.");
  }

  const match = value.trim().match(/^([A-Za-z][A-Za-z0-9_-]*)\s+([A-Za-z0-9_-]+)$/);

  if (!match) {
    throw new Error("The X401 header did not match '<action> <base64url-json>'.");
  }

  return {
    raw: value,
    action: match[1].toLowerCase(),
    encoded: match[2],
    payload: decodeBase64UrlJson(match[2]),
  };
}

function getActorDid(app, id, fallback) {
  return app.overview?.actors?.find((actor) => actor.id === id)?.did ?? fallback;
}

function getRequirementProof(app) {
  return app.requirementPayload?.proof ?? {};
}

function getChallengeValue(app) {
  return getRequirementProof(app).challenge?.value ?? app.challengeId;
}

function getChallengeIdFromRequirement(payload) {
  return (
    payload?.proof?.challenge?.id ??
    payload?.proof?.challenge_id ??
    payload?.challenge_id ??
    payload?.proof?.challenge?.value ??
    null
  );
}

function buildAuthorizationRequestPayload(app) {
  const proof = getRequirementProof(app);
  const agentDid = getActorDid(app, "agent", "did:web:agent.example");
  const challenge = proof.challenge?.value;

  if (!challenge) {
    throw new Error("The x401 requirement did not include proof.challenge.value.");
  }

  if (proof.presentation_protocol !== "openid4vp") {
    throw new Error("This demo expects proof.presentation_protocol to be openid4vp.");
  }

  if (!proof.dcql_query) {
    throw new Error("The x401 requirement did not include proof.dcql_query.");
  }

  return {
    response_type: "vp_token",
    client_id: agentDid,
    response_mode: "direct_post",
    response_uri: `${globalThis.location.origin}/local-agent/wallet/callback/${encodeURIComponent(challenge)}`,
    nonce: challenge,
    state: proof.request_id ?? challenge,
    dcql_query: proof.dcql_query,
  };
}

function getWalletResponsePayload(localPresentation) {
  return (
    localPresentation?.authorizationResponsePayload ??
    localPresentation?.body?.authorizationResponsePayload ??
    localPresentation?.body ??
    localPresentation
  );
}

function buildVpArtifact(app) {
  const proof = getRequirementProof(app);
  const walletPayload = getWalletResponsePayload(app.localPresentation);
  const vpToken = walletPayload?.vp_token ?? walletPayload?.vpToken;

  if (!vpToken) {
    throw new Error("The wallet response did not include a vp_token for the VP Artifact.");
  }

  const artifact = {
    agent_id: app.authorizationRequestPayload?.client_id,
    challenge: proof.challenge?.value,
    vp_token: vpToken,
  };

  if (proof.request_id) {
    artifact.request_id = proof.request_id;
  }

  if (walletPayload.presentation_submission) {
    artifact.presentation_submission = walletPayload.presentation_submission;
  }

  if (walletPayload.state) {
    artifact.state = walletPayload.state;
  }

  return artifact;
}

function buildX401TokenObject(accessToken) {
  return {
    scheme: "x401",
    version: "0.1.0",
    token_type: "Bearer",
    access_token: accessToken,
  };
}

function getVerificationToken(data) {
  return (
    data?.access_token ??
    data?.verification_token ??
    data?.token?.access_token ??
    data?.body?.access_token ??
    data?.body?.receipt_token ??
    null
  );
}

function getX401ErrorMessage(message) {
  const error = message?.payload;
  const code = error?.error ?? "x401_error";
  const description = error?.error_description ? `: ${error.error_description}` : "";

  return `${code}${description}`;
}

async function parseJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchJsonOrThrow(url, options) {
  const response = await fetch(url, options);
  const data = await parseJson(response);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function buildExpectedPacket(app, stepId) {
  switch (stepId) {
    case "gate":
      return {
        route: PAPER_ROUTE,
        method: "GET",
        expected_header: "X401: require <base64url-x401-payload>",
        requirement_source: "X401 header, not response body",
      };
    case "request":
      return app.authorizationRequestPayload
        ? {
            authorizationRequestPayload: app.authorizationRequestPayload,
            preserved_nonce: app.authorizationRequestPayload.nonce,
            dcql_query: app.authorizationRequestPayload.dcql_query,
          }
        : { waiting_on: "decoded x401 proof requirement from the relying party" };
    case "presentation":
      return app.authorizationRequestPayload
        ? {
            challenge: getChallengeValue(app),
            local_wallet_endpoint:
              `/local-agent/wallet/presentations/${encodeURIComponent(getChallengeValue(app))}`,
            agent_id: app.authorizationRequestPayload.client_id,
            nonce: app.authorizationRequestPayload.nonce,
          }
        : { waiting_on: "Agent-created OIDC4VP Authorization Request" };
    case "present":
      return app.vpArtifact
        ? {
            route: PAPER_ROUTE,
            method: "GET",
            x401: `present ${app.x401PresentValue}`,
            decoded_vp_artifact: app.vpArtifact,
          }
        : { waiting_on: "Locally generated delegated VP payload" };
    case "retry":
      return app.verificationToken
        ? {
            route: PAPER_ROUTE,
            method: "GET",
            authorization: `Bearer ${EXISTING_APP_TOKEN}`,
            x401: `token ${app.x401TokenValue ?? "<base64url-x401-token-object>"}`,
            decoded_x401_token: app.x401TokenObject,
          }
        : { waiting_on: "x401 Verification Token" };
    default:
      return {};
  }
}

const STEP_BLUEPRINTS = [
  {
    id: "gate",
    shortLabel: "Encounter Gate",
    title: "The AI agent asks for the protected medical study",
    meta: "X401 proof requirement",
    pendingNote:
      "The first request goes straight to the relying party and hits the proof gate on the paper route.",
    pendingOutcome:
      "The verifier will answer with X401: require and a base64url-encoded x401 payload.",
    actionLabel: "Run the protected paper request",
    annotationPending: "Waiting for the first paper request.",
    annotationLocked: "This phase starts the story.",
    async run(app) {
      const response = await fetch(PAPER_ROUTE);
      const x401Header = response.headers.get("X401");
      const x401Message = parseX401Header(x401Header);

      if (!x401Message) {
        throw new Error(`Expected an X401 proof requirement but received HTTP ${response.status}.`);
      }

      if (x401Message.action !== "require") {
        throw new Error(`Expected X401: require but received X401: ${x401Message.action}.`);
      }

      app.requirementPayload = x401Message.payload;
      app.challengeId = getChallengeIdFromRequirement(x401Message.payload);

      return {
        annotation: "x401 proof requirement issued by the relying party.",
        note:
          "The paper route exposed the complete route-scoped proof requirement through the X401 header.",
        outcome:
          "The agent decoded the proof requirement without needing to parse the response body for protocol state.",
        highlights: [
          `HTTP ${response.status} with X401: require`,
          `Verifier Challenge ${getChallengeValue(app)}`,
          `Presentation protocol ${getRequirementProof(app).presentation_protocol}`,
        ],
        payload: {
          httpStatus: response.status,
          x401: x401Message.raw,
          action: x401Message.action,
          decodedPayload: x401Message.payload,
        },
      };
    },
  },
  {
    id: "request",
    shortLabel: "Build Request",
    title: "The agent builds the wallet-facing presentation request",
    meta: "agent OIDC4VP",
    pendingNote:
      "The decoded x401 payload supplies the DCQL query and Verifier Challenge the agent needs for OIDC4VP.",
    pendingOutcome:
      "The holder-side flow becomes concrete enough to drive the local delegated presentation step.",
    actionLabel: "Create the OIDC4VP request",
    annotationPending: "Ready to create the wallet-facing request.",
    annotationLocked: "Waiting for the proof requirement to exist.",
    async run(app) {
      if (!app.requirementPayload) {
        throw new Error("No decoded x401 requirement is available yet.");
      }

      app.authorizationRequestPayload = buildAuthorizationRequestPayload(app);

      return {
        annotation: "Agent-created OIDC4VP request assembled from x401.",
        note:
          "The agent preserved the verifier's DCQL query and used the exact x401 Verifier Challenge as the OIDC4VP nonce.",
        outcome:
          "The wallet-facing request now targets the agent and carries the route's proof requirements forward.",
        highlights: [
          `client_id ${formatDidForDisplay(app.authorizationRequestPayload.client_id)}`,
          `nonce ${app.authorizationRequestPayload.nonce}`,
          `response_uri ${app.authorizationRequestPayload.response_uri}`,
        ],
        payload: {
          authorizationRequestPayload: app.authorizationRequestPayload,
          sourceRequirement: app.requirementPayload,
        },
      };
    },
  },
  {
    id: "presentation",
    shortLabel: "Create VP",
    title: "The local wallet builds the delegated holder presentation",
    meta: "delegated vp",
    pendingNote:
      "The loopback wallet endpoint prepares a VP from the doctor's DID while carrying delegation authority for the AI agent DID.",
    pendingOutcome:
      "The response will include the board certification VC, the delegation VC, and the verifier-ready authorization response payload.",
    actionLabel: "Generate the delegated VP locally",
    annotationPending: "Ready to generate the local delegated presentation.",
    annotationLocked: "Waiting for the Agent-created OIDC4VP request.",
    async run(app) {
      const challenge = getChallengeValue(app);

      if (!challenge || !app.authorizationRequestPayload) {
        throw new Error("No Agent-created presentation request exists yet.");
      }

      const data = await fetchJsonOrThrow(
        `/local-agent/wallet/presentations/${encodeURIComponent(challenge)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            authorizationRequestPayload: app.authorizationRequestPayload,
            x401Requirement: app.requirementPayload,
          }),
        },
      );

      app.localPresentation = data;

      return {
        annotation: "Doctor DID signed the VP and attached delegation evidence.",
        note:
          "The holder key stayed inside the local wallet boundary while the delegated VP was assembled for the AI agent.",
        outcome:
          "The agent now has a verifier-ready authorization response with both the board credential and delegation credential attached.",
        highlights: [
          `holder ${formatDidForDisplay(data.holderDid)}`,
          `agent ${formatDidForDisplay(data.agentDid)}`,
          "Board certification VC plus delegation VC included",
        ],
        payload: data,
      };
    },
  },
  {
    id: "present",
    shortLabel: "Present VP",
    title: "The agent presents the VP Artifact to the original route",
    meta: "X401 present",
    pendingNote:
      "The wallet result is packaged as a VP Artifact and sent back on the same paper route.",
    pendingOutcome:
      "The verifier will process X401: present and either accept the proof, issue a reusable token, or return X401: error.",
    actionLabel: "Present the VP on the route",
    annotationPending: "Ready to present the VP Artifact to the original route.",
    annotationLocked: "Waiting for the delegated VP payload.",
    async run(app) {
      if (!app.localPresentation) {
        throw new Error("No local presentation exists yet for X401: present.");
      }

      app.vpArtifact = buildVpArtifact(app);
      app.x401PresentValue = encodeBase64UrlJson(app.vpArtifact);

      const response = await fetch(PAPER_ROUTE, {
        headers: {
          X401: `present ${app.x401PresentValue}`,
        },
      });
      const data = await parseJson(response);
      const x401Response = parseX401Header(response.headers.get("X401"));

      if (x401Response?.action === "error") {
        app.x401Error = x401Response.payload;
        throw new Error(`X401 proof error ${getX401ErrorMessage(x401Response)}`);
      }

      if (!response.ok) {
        throw new Error("The relying party rejected the X401: present proof artifact.");
      }

      app.presentationResult = data;
      app.verificationToken = getVerificationToken(data);

      return {
        annotation: "Verifier accepted the VP Artifact on the protected route.",
        note:
          "The route processed X401: present, decoded the VP Artifact, and validated the presentation, delegation scope, issuer metadata, and status list entry.",
        outcome:
          "The proof phase is complete. This demo uses the returned Verification Token to show the X401: token retry shape.",
        highlights: [
          `HTTP ${response.status} after X401: present`,
          `holder ${formatDidForDisplay(data?.body?.verification?.holderDid ?? data?.verification?.holderDid ?? "verified")}`,
          `token ${app.verificationToken ? "issued" : "not returned"}`,
        ],
        payload: {
          request: {
            route: PAPER_ROUTE,
            method: "GET",
            x401: `present ${app.x401PresentValue}`,
            decodedVpArtifact: app.vpArtifact,
          },
          response: data,
        },
      };
    },
  },
  {
    id: "retry",
    shortLabel: "Retry Route",
    title: "The agent retries with app auth plus X401 token",
    meta: "paper unlocked",
    pendingNote:
      "The protected route is retried with the existing app Authorization token and separate x401 proof satisfaction in X401: token.",
    pendingOutcome:
      "The paper should be released because the app token and x401 Verification Token bind to the same accepted caller context.",
    actionLabel: "Replay the route with X401 token",
    annotationPending: "Ready to replay the original route with the x401 token.",
    annotationLocked: "Waiting for the x401 Verification Token.",
    async run(app) {
      if (!app.verificationToken) {
        throw new Error("No x401 Verification Token exists yet for the retry.");
      }

      app.x401TokenObject = buildX401TokenObject(app.verificationToken);
      app.x401TokenValue = encodeBase64UrlJson(app.x401TokenObject);

      const response = await fetch(PAPER_ROUTE, {
        headers: {
          Authorization: `Bearer ${EXISTING_APP_TOKEN}`,
          X401: `token ${app.x401TokenValue}`,
        },
      });
      const paper = await parseJson(response);
      const x401Response = parseX401Header(response.headers.get("X401"));

      if (x401Response?.action === "error") {
        app.x401Error = x401Response.payload;
        throw new Error(`X401 token error ${getX401ErrorMessage(x401Response)}`);
      }

      if (!response.ok) {
        throw new Error("The relying party rejected the x401 token retry.");
      }

      app.paper = paper;

      return {
        annotation: "Protected paper released to the AI agent.",
        note:
          "The relying party preserved ordinary Authorization for the app and used X401: token only for x401 proof satisfaction.",
        outcome:
          "The study is now accessible because the doctor's active Texas board certification was proven end to end.",
        highlights: [
          `HTTP ${response.status} final route response`,
          "Authorization plus X401: token",
          paper.title,
          paper.reason,
        ],
        payload: {
          request: {
            route: PAPER_ROUTE,
            method: "GET",
            authorization: `Bearer ${EXISTING_APP_TOKEN}`,
            x401: `token ${app.x401TokenValue}`,
            decodedX401Token: app.x401TokenObject,
          },
          response: paper,
        },
      };
    },
  },
];

export class x401DemoApp extends LitElement {
  static properties = {
    overview: { type: Object },
    requirementPayload: { type: Object },
    challengeId: { type: String },
    authorizationRequestPayload: { type: Object },
    localPresentation: { type: Object },
    vpArtifact: { type: Object },
    presentationResult: { type: Object },
    verificationToken: { type: String },
    x401PresentValue: { type: String },
    x401TokenObject: { type: Object },
    x401TokenValue: { type: String },
    x401Error: { type: Object },
    paper: { type: Object },
    stepResults: { type: Array },
    completedStepIndex: { type: Number, attribute: false },
    selectedStepIndex: { type: Number, attribute: false },
    isRunning: { type: Boolean, attribute: false },
    errorMessage: { type: String, attribute: false },
    loadingOverview: { type: Boolean, attribute: false },
  };

  static styles = css`
    :host {
      display: block;
      color: var(--ink, #1a231c);
    }

    .app {
      width: min(1440px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 24px 0 56px;
    }

    .panel {
      margin-bottom: 1rem;
      padding: 1.2rem;
      border: 1px solid rgba(26, 35, 28, 0.1);
      border-radius: 2rem;
      background:
        linear-gradient(180deg, rgba(255, 253, 248, 0.94), rgba(252, 247, 239, 0.8)),
        rgba(255, 255, 255, 0.88);
      box-shadow: var(--shadow, 0 28px 70px rgba(18, 27, 22, 0.12));
      backdrop-filter: blur(10px);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.3fr);
      gap: 1rem;
      align-items: stretch;
    }

    .hero__intro {
      display: grid;
      gap: 0.8rem;
      align-content: start;
      padding: 0.2rem;
    }

    .hero__intro h1,
    .story__header h2 {
      margin: 0;
      line-height: 0.98;
      font-weight: 650;
    }

    .hero__intro h1 {
      font-size: clamp(2.8rem, 5vw, 3.5rem);
    }

    .hero__intro p,
    .story__header p,
    .loading {
      margin: 0;
      color: var(--muted, #5b665d);
      line-height: 1.55;
    }

    .eyebrow {
      margin: 0;
      color: var(--brand, #16614a);
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .hero__route {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      gap: 0.45rem;
      padding: 0.55rem 0.8rem;
      border: 1px solid rgba(22, 97, 74, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.66);
      color: var(--brand-deep, #0f3b2d);
      font-family: var(--font-mono, monospace);
      font-size: 0.74rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .actor-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .actor-tile {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.8rem;
      padding: 0.95rem;
      border: 1px solid rgba(26, 35, 28, 0.08);
      border-radius: 1.4rem;
      background: rgba(255, 255, 255, 0.66);
      min-height: 132px;
    }

    .actor-tile__avatar {
      display: grid;
      place-items: center;
      width: 3.1rem;
      height: 3.1rem;
      border-radius: 999px;
      color: white;
      background: linear-gradient(135deg, rgba(22, 97, 74, 0.92), rgba(13, 53, 42, 0.98));
      box-shadow: 0 10px 24px rgba(18, 27, 22, 0.12);
      font-size: 1.15rem;
    }

    .actor-tile__avatar--agent {
      background: linear-gradient(135deg, rgba(205, 106, 47, 0.92), rgba(133, 65, 26, 0.98));
    }

    .actor-tile__avatar--issuer {
      background: linear-gradient(135deg, rgba(67, 98, 181, 0.92), rgba(38, 61, 126, 0.98));
    }

    .actor-tile__copy {
      display: grid;
      gap: 0.36rem;
      align-content: start;
    }

    .actor-tile__copy h3,
    .actor-tile__copy p,
    .actor-tile__copy code {
      margin: 0;
    }

    .actor-tile__copy h3 {
      font-size: 0.98rem;
      line-height: 1.1;
      font-weight: 650;
    }

    .actor-tile__copy p {
      color: var(--muted, #5b665d);
      font-size: 0.88rem;
      line-height: 1.45;
    }

    .actor-tile__copy code {
      padding: 0.5rem 0.6rem;
      border-radius: 0.85rem;
      background: rgba(22, 97, 74, 0.08);
      color: var(--brand-deep, #0f3b2d);
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      line-height: 1.5;
      word-break: break-word;
    }

    .story {
      display: grid;
      gap: 0.9rem;
    }

    .story__header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
    }

    .story__header h2 {
      font-size: clamp(1.45rem, 2.4vw, 2.1rem);
    }

    .loading {
      padding: 1rem 0;
    }

    @media (max-width: 1080px) {
      .hero {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .app {
        width: min(100vw - 16px, 100%);
      }

      .panel {
        padding: 1rem;
        border-radius: 1.5rem;
      }

      .actor-grid {
        grid-template-columns: 1fr;
      }

      .story__header {
        flex-direction: column;
      }
    }
  `;

  constructor() {
    super();
    this.overview = null;
    this.requirementPayload = null;
    this.challengeId = null;
    this.authorizationRequestPayload = null;
    this.localPresentation = null;
    this.vpArtifact = null;
    this.presentationResult = null;
    this.verificationToken = null;
    this.x401PresentValue = null;
    this.x401TokenObject = null;
    this.x401TokenValue = null;
    this.x401Error = null;
    this.paper = null;
    this.stepResults = Array.from({ length: STEP_BLUEPRINTS.length }, () => null);
    this.completedStepIndex = -1;
    this.selectedStepIndex = 0;
    this.isRunning = false;
    this.errorMessage = "";
    this.loadingOverview = true;
    this.handleTimelineSelect = this.handleTimelineSelect.bind(this);
    this.handleTimelineBack = this.handleTimelineBack.bind(this);
    this.handleTimelineAction = this.handleTimelineAction.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadOverview();
  }

  async loadOverview() {
    try {
      this.loadingOverview = true;
      this.overview = await fetchJsonOrThrow("/demo/api/overview");
      this.errorMessage = "";
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "The demo overview could not be loaded.";
    } finally {
      this.loadingOverview = false;
    }
  }

  resetStory() {
    this.requirementPayload = null;
    this.challengeId = null;
    this.authorizationRequestPayload = null;
    this.localPresentation = null;
    this.vpArtifact = null;
    this.presentationResult = null;
    this.verificationToken = null;
    this.x401PresentValue = null;
    this.x401TokenObject = null;
    this.x401TokenValue = null;
    this.x401Error = null;
    this.paper = null;
    this.stepResults = Array.from({ length: STEP_BLUEPRINTS.length }, () => null);
    this.completedStepIndex = -1;
    this.selectedStepIndex = 0;
    this.isRunning = false;
    this.errorMessage = "";
  }

  getStepStatus(index) {
    if (index <= this.completedStepIndex) {
      return "completed";
    }

    if (index === this.completedStepIndex + 1) {
      return "ready";
    }

    return "locked";
  }

  getCurrentReadyIndex() {
    return Math.min(this.completedStepIndex + 1, STEP_BLUEPRINTS.length - 1);
  }

  buildTimelineItems() {
    const currentReadyIndex = this.getCurrentReadyIndex();

    return STEP_BLUEPRINTS.map((step, index) => {
      const result = this.stepResults[index];
      const status = this.getStepStatus(index);
      const nextBlueprint = STEP_BLUEPRINTS[index + 1];
      let ctaLabel = step.actionLabel;
      let ctaVariant = status === "ready" ? "brand" : "neutral";
      let ctaAppearance = status === "ready" ? "filled" : "outlined";
      let ctaHint = "Run the next protocol transition from this phase.";

      if (status === "completed") {
        if (index === STEP_BLUEPRINTS.length - 1) {
          ctaLabel = "Reset and replay the story";
          ctaHint = "Start the demo flow over from the first paper request.";
        } else if (index + 1 <= this.completedStepIndex) {
          ctaLabel = `View next completed phase`;
          ctaHint = "Move the spotlight forward without rerunning protocol work.";
        } else {
          ctaLabel = `Run next step`;
          ctaVariant = "brand";
          ctaAppearance = "filled";
          ctaHint = `Continue from here into ${nextBlueprint.shortLabel.toLowerCase()}.`;
        }
      } else if (status === "locked") {
        ctaLabel = `Go to current runnable step`;
        ctaHint = `This phase is a preview until ${STEP_BLUEPRINTS[currentReadyIndex].shortLabel.toLowerCase()} is complete.`;
      }

      return {
        id: step.id,
        shortLabel: step.shortLabel,
        title: step.title,
        meta: step.meta,
        icon: STEP_VISUALS[step.id],
        status,
        annotation:
          result?.annotation ??
          (status === "locked" ? step.annotationLocked : step.annotationPending),
        note: result?.note ?? step.pendingNote,
        outcome: result?.outcome ?? step.pendingOutcome,
        highlights: result?.highlights ?? [],
        ctaLabel,
        ctaVariant,
        ctaAppearance,
        ctaHint,
        packetSummary: PHASE_PACKET_SUMMARIES[step.id],
        packetValue: result?.payload ?? buildExpectedPacket(this, step.id),
        previewText:
          result?.outcome ??
          (status === "locked" ? step.annotationLocked : step.pendingOutcome),
      };
    });
  }

  async runStep(index) {
    if (index !== this.completedStepIndex + 1 || this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;
      this.errorMessage = "";
      const result = await STEP_BLUEPRINTS[index].run(this);
      this.stepResults = this.stepResults.map((entry, entryIndex) =>
        entryIndex === index ? result : entry,
      );
      this.completedStepIndex = index;
      this.selectedStepIndex =
        index === STEP_BLUEPRINTS.length - 1 ? index : index + 1;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "The timeline step failed.";
      this.selectedStepIndex = index;
    } finally {
      this.isRunning = false;
    }
  }

  handleTimelineSelect(event) {
    const index = event.detail.index;

    if (typeof index !== "number" || index < 0 || index >= STEP_BLUEPRINTS.length) {
      return;
    }

    this.selectedStepIndex = index;
  }

  handleTimelineBack() {
    if (this.selectedStepIndex === 0) {
      return;
    }

    this.selectedStepIndex -= 1;
  }

  handleTimelineAction(event) {
    const index = event.detail.index;
    const status = this.getStepStatus(index);
    const nextIndex = index + 1;

    if (status === "ready") {
      this.runStep(index);
      return;
    }

    if (status === "locked") {
      this.selectedStepIndex = this.getCurrentReadyIndex();
      return;
    }

    if (index === STEP_BLUEPRINTS.length - 1) {
      this.resetStory();
      return;
    }

    if (nextIndex <= this.completedStepIndex) {
      this.selectedStepIndex = nextIndex;
      return;
    }

    this.selectedStepIndex = nextIndex;
    this.runStep(nextIndex);
  }

  renderActorTile(actor) {
    const visual = ACTOR_VISUALS[actor.id] ?? ACTOR_VISUALS.doctor;

    return html`
      <div class="actor-tile" title=${actor.did}>
        <div class=${`actor-tile__avatar actor-tile__avatar--${visual.accent}`}>
          <wa-icon name=${visual.icon}></wa-icon>
        </div>
        <div class="actor-tile__copy">
          <h3>${actor.label}</h3>
          <p>${ACTOR_DESCRIPTIONS[actor.id] ?? "Seeded protocol actor."}</p>
          <code>${formatDidForDisplay(actor.did)}</code>
        </div>
      </div>
    `;
  }

  render() {
    const actors = this.overview?.actors ?? [];
    const timelineItems = this.buildTimelineItems();

    return html`
      <div class="app">
        <section class="panel hero">
          <div class="hero__intro">
            <p class="eyebrow">Use case</p>
            <h1>Board-certified doctor opens gated medical research.</h1>
            <p>
              Shows how the doctor's AI agent proves active Texas board certification
              through x401, OIDC4VP, and a locally delegated presentation to unlock
              the protected paper route.
            </p>
            <div class="hero__route">
              <wa-icon name="route"></wa-icon>
              <span>${PAPER_ROUTE}</span>
            </div>
          </div>

          <div class="hero__actors">
            ${this.loadingOverview
              ? html`<p class="loading">Loading the four seeded actors...</p>`
              : html`
                  <div class="actor-grid">
                    ${actors.map((actor) => this.renderActorTile(actor))}
                  </div>
                `}
          </div>
        </section>

        <section class="panel story">
          <div class="story__header">
            <div>
              <p class="eyebrow">Protocol story</p>
              <h2>Step through the proof flow</h2>
            </div>
            <wa-button
              variant="neutral"
              appearance="plain"
              size="small"
              @click=${() => this.resetStory()}
            >
              <wa-icon slot="start" name="rotate-left"></wa-icon>
              Reset
            </wa-button>
          </div>

          ${this.errorMessage
            ? html`
                <wa-callout variant="danger" appearance="filled-outlined" size="small">
                  <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
                  ${this.errorMessage}
                </wa-callout>
              `
            : null}

          <x401-story-timeline
            .items=${timelineItems}
            .selectedIndex=${this.selectedStepIndex}
            .completedIndex=${this.completedStepIndex}
            .running=${this.isRunning}
            @timeline-select=${(event) => this.handleTimelineSelect(event)}
            @timeline-back=${() => this.handleTimelineBack()}
            @timeline-action=${(event) => this.handleTimelineAction(event)}
          ></x401-story-timeline>
        </section>
      </div>
    `;
  }
}

customElements.define("x401-demo-app", x401DemoApp);
