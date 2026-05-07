import { LitElement, css, html } from "lit";
import "./x401-story-timeline.js";

const PAPER_ROUTE = "/papers/medical-study-123";

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
  submit: "shield-check",
  retry: "book-open",
};

const PHASE_PACKET_SUMMARIES = {
  gate: "401 envelope plus the stored verifier challenge record.",
  request: "Signed request object and its OIDC4VP request payload.",
  presentation: "Delegated VP bundle prepared by the local wallet.",
  submit: "Verifier receipt plus credential verification result.",
  retry: "Final protected paper payload returned by the relying party.",
};

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatDidForDisplay(value) {
  return typeof value === "string" ? value.replaceAll("%3A", ":") : value;
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
        expected_status: 401,
        expected_challenge: "x401 envelope with request_uri",
      };
    case "request":
      return app.challengeRecord
        ? {
            challenge_id: app.challenge?.challenge_id,
            authorizationRequestPayload:
              app.challengeRecord.authorizationRequestPayload,
            requestObjectJwt: app.requestObjectJwt ?? "Pending request_uri fetch",
          }
        : { waiting_on: "x401 challenge from the relying party" };
    case "presentation":
      return app.challenge
        ? {
            challenge_id: app.challenge.challenge_id,
            local_wallet_endpoint:
              `/local-agent/wallet/presentations/${app.challenge.challenge_id}`,
            verifier_did:
              app.challengeRecord?.authorizationRequestPayload?.client_id,
            nonce: app.challengeRecord?.authorizationRequestPayload?.nonce,
          }
        : { waiting_on: "Signed verifier request object" };
    case "submit":
      return app.localPresentation
        ? app.localPresentation.authorizationResponsePayload
        : { waiting_on: "Locally generated delegated VP payload" };
    case "retry":
      return app.receipt
        ? {
            route: PAPER_ROUTE,
            method: "GET",
            authorization: `Bearer ${app.receipt}`,
          }
        : { waiting_on: "Verifier receipt token" };
    default:
      return {};
  }
}

const STEP_BLUEPRINTS = [
  {
    id: "gate",
    shortLabel: "Encounter Gate",
    title: "The AI agent asks for the protected medical study",
    meta: "401 challenge",
    pendingNote:
      "The first request goes straight to the relying party and hits the proof gate on the paper route.",
    pendingOutcome:
      "The verifier will answer with a x401 challenge, a request URI, and a credential acquisition hint.",
    actionLabel: "Run the protected paper request",
    annotationPending: "Waiting for the first paper request.",
    annotationLocked: "This phase starts the story.",
    async run(app) {
      const response = await fetch(PAPER_ROUTE);
      const envelope = await parseJson(response);

      if (response.status !== 401) {
        throw new Error(`Expected a 401 proof challenge but received ${response.status}.`);
      }

      const challengeRecordResponse = await fetch(
        `/demo/api/challenges/${envelope.challenge_id}`,
      );
      const challengeRecord = await parseJson(challengeRecordResponse);

      if (!challengeRecordResponse.ok) {
        throw new Error("The demo could not recover the stored challenge record.");
      }

      app.challenge = envelope;
      app.challengeRecord = challengeRecord;
      app.requestObjectJwt = challengeRecord.requestObjectJwt;

      return {
        annotation: "x401 challenge issued by the relying party.",
        note:
          "The paper route blocked access and pushed the proof requirement out as a by-reference verifier challenge.",
        outcome:
          "The agent now holds a challenge ID, a request URI, and the issuer hint needed to continue.",
        highlights: [
          `HTTP ${response.status} with WWW-Authenticate: x401`,
          `Challenge ${envelope.challenge_id}`,
          `Request URI ${envelope.proof.request_uri}`,
        ],
        payload: {
          httpStatus: response.status,
          wwwAuthenticate: response.headers.get("WWW-Authenticate"),
          envelope,
          challengeRecord,
        },
      };
    },
  },
  {
    id: "request",
    shortLabel: "Resolve Request",
    title: "The agent resolves the signed verifier request",
    meta: "request_uri",
    pendingNote:
      "The request URI is dereferenced so the agent can inspect the verifier DID, nonce, state, and direct_post target.",
    pendingOutcome:
      "The holder-side flow becomes concrete enough to drive the local delegated presentation step.",
    actionLabel: "Fetch the signed request object",
    annotationPending: "Ready to resolve the verifier request URI.",
    annotationLocked: "Waiting for the challenge to exist.",
    async run(app) {
      if (!app.challenge?.proof?.request_uri) {
        throw new Error("No request URI is available yet.");
      }

      const response = await fetch(app.challenge.proof.request_uri);
      const requestObjectJwt = await response.text();

      if (!response.ok) {
        throw new Error("The verifier request object could not be recovered.");
      }

      app.requestObjectJwt = requestObjectJwt;

      return {
        annotation: "Signed request object recovered from the request URI.",
        note:
          "The agent pulled the verifier-signed request and matched it to the stored challenge state.",
        outcome:
          "The relying party DID, nonce, state, and direct_post destination are now available for the holder flow.",
        highlights: [
          `client_id ${formatDidForDisplay(app.challengeRecord.authorizationRequestPayload.client_id)}`,
          `nonce ${app.challengeRecord.authorizationRequestPayload.nonce}`,
          `response_uri ${app.challengeRecord.authorizationRequestPayload.response_uri}`,
        ],
        payload: {
          requestObjectJwt,
          authorizationRequestPayload:
            app.challengeRecord.authorizationRequestPayload,
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
    annotationLocked: "Waiting for the signed request object.",
    async run(app) {
      if (!app.challenge?.challenge_id) {
        throw new Error("No challenge exists yet for wallet presentation.");
      }

      const data = await fetchJsonOrThrow(
        `/local-agent/wallet/presentations/${app.challenge.challenge_id}`,
        { method: "POST" },
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
    id: "submit",
    shortLabel: "Submit VP",
    title: "The verifier validates the proof bundle",
    meta: "verifier receipt",
    pendingNote:
      "The delegated authorization response is posted to the verifier's direct_post endpoint.",
    pendingOutcome:
      "The verifier will check the presentation, delegation scope, issuer metadata, and status list before minting a receipt token.",
    actionLabel: "Submit the VP to the verifier",
    annotationPending: "Ready to send the proof bundle to the verifier.",
    annotationLocked: "Waiting for the delegated VP payload.",
    async run(app) {
      if (!app.challenge?.challenge_id) {
        throw new Error("No challenge exists yet for verifier submission.");
      }

      const data = await fetchJsonOrThrow(
        `/demo/api/challenges/${app.challenge.challenge_id}/submit`,
        { method: "POST" },
      );

      app.submission = data;
      app.receipt = data.body?.receipt_token ?? null;

      return {
        annotation: "Verifier accepted the proof and minted a receipt.",
        note:
          "The verifier validated the VP, the board credential, the delegation scope, the issuer metadata endpoints, and the status list entry.",
        outcome:
          "The proof phase is complete and the original paper route can now be replayed with the verifier-issued bearer receipt.",
        highlights: [
          `holder ${formatDidForDisplay(data.body.verification.holderDid)}`,
          `agent ${formatDidForDisplay(data.body.verification.agentDid)}`,
          `revoked ${String(data.body.verification.revoked)}`,
        ],
        payload: data,
      };
    },
  },
  {
    id: "retry",
    shortLabel: "Retry Route",
    title: "The agent retries the paper route with the verifier receipt",
    meta: "paper unlocked",
    pendingNote:
      "The protected route is retried with the verifier receipt token in the Authorization header.",
    pendingOutcome:
      "The paper should be released because the active board certification proof was already accepted.",
    actionLabel: "Replay the paper route with the receipt",
    annotationPending: "Ready to replay the original route with the receipt.",
    annotationLocked: "Waiting for the verifier receipt token.",
    async run(app) {
      if (!app.receipt) {
        throw new Error("No verifier receipt exists yet for the retry.");
      }

      const response = await fetch(PAPER_ROUTE, {
        headers: {
          Authorization: `Bearer ${app.receipt}`,
        },
      });
      const paper = await parseJson(response);

      if (!response.ok) {
        throw new Error("The relying party rejected the verifier receipt.");
      }

      app.paper = paper;

      return {
        annotation: "Protected paper released to the AI agent.",
        note:
          "The relying party recognized the verifier receipt and skipped the challenge branch on the retry.",
        outcome:
          "The study is now accessible because the doctor's active Texas board certification was proven end to end.",
        highlights: [
          `HTTP ${response.status} final route response`,
          paper.title,
          paper.reason,
        ],
        payload: paper,
      };
    },
  },
];

export class x401DemoApp extends LitElement {
  static properties = {
    overview: { type: Object },
    challenge: { type: Object },
    challengeRecord: { type: Object },
    requestObjectJwt: { type: String },
    localPresentation: { type: Object },
    submission: { type: Object },
    receipt: { type: String },
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
    this.challenge = null;
    this.challengeRecord = null;
    this.requestObjectJwt = null;
    this.localPresentation = null;
    this.submission = null;
    this.receipt = null;
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
    this.challenge = null;
    this.challengeRecord = null;
    this.requestObjectJwt = null;
    this.localPresentation = null;
    this.submission = null;
    this.receipt = null;
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
