import { LitElement, css, html } from "lit";

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

export class x401StoryTimeline extends LitElement {
  static properties = {
    items: { type: Array },
    selectedIndex: { type: Number, attribute: "selected-index" },
    completedIndex: { type: Number, attribute: "completed-index" },
    running: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      color: var(--ink, #1a231c);
    }

    .timeline {
      display: grid;
      gap: 1rem;
    }

    .timeline__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .timeline__status {
      display: grid;
      gap: 0.2rem;
    }

    .timeline__status span,
    .timeline__status p {
      margin: 0;
    }

    .timeline__status span {
      color: var(--brand, #16614a);
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .timeline__status p {
      color: var(--muted, #5b665d);
      line-height: 1.45;
    }

    .stage-window {
      position: relative;
      overflow: hidden;
      padding: 0.2rem 0;
      border-radius: 1.75rem;
    }

    .stage-window::before,
    .stage-window::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 7rem;
      pointer-events: none;
      z-index: 2;
    }

    .stage-window::before {
      left: 0;
      background: linear-gradient(
        90deg,
        rgba(255, 250, 243, 0.96),
        rgba(255, 250, 243, 0)
      );
    }

    .stage-window::after {
      right: 0;
      background: linear-gradient(
        270deg,
        rgba(255, 250, 243, 0.96),
        rgba(255, 250, 243, 0)
      );
    }

    .stage-deck {
      display: grid;
      grid-template-columns: minmax(0, 16rem) minmax(0, 1fr) minmax(0, 16rem);
      gap: 1rem;
      align-items: stretch;
    }

    .peek {
      display: flex;
      align-items: stretch;
      width: 136%;
      min-height: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
      transition: transform 180ms ease, opacity 180ms ease;
    }

    .peek--prev {
      justify-self: end;
      transform: translateX(-24%);
    }

    .peek--next {
      justify-self: start;
      transform: translateX(24%);
    }

    .peek:hover {
      opacity: 0.9;
    }

    .peek__card {
      width: 100%;
      height: 100%;
    }

    .peek__card::part(base) {
      height: 100%;
      border-radius: 1.5rem;
      border: 1px solid rgba(26, 35, 28, 0.08);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(250, 246, 238, 0.74)),
        rgba(255, 255, 255, 0.8);
      opacity: 0.66;
      transform: scale(0.94);
    }

    .peek__body {
      display: grid;
      gap: 0.65rem;
    }

    .peek__label,
    .peek__meta {
      margin: 0;
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted, #5b665d);
    }

    .peek__body h3,
    .peek__body p {
      margin: 0;
    }

    .peek__body h3 {
      font-size: 1rem;
      line-height: 1.15;
      font-weight: 650;
    }

    .peek__body p:not(.peek__label):not(.peek__meta) {
      color: var(--muted, #5b665d);
      line-height: 1.45;
    }

    .stage {
      min-width: 0;
    }

    .stage__card::part(base) {
      border-radius: 1.7rem;
      border: 1px solid rgba(26, 35, 28, 0.1);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(252, 247, 239, 0.84)),
        rgba(255, 255, 255, 0.92);
      box-shadow: 0 24px 56px rgba(18, 27, 22, 0.11);
    }

    .stage__header,
    .stage__footer {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
    }

    .stage__eyebrow {
      margin: 0 0 0.4rem;
      color: var(--brand, #16614a);
      font-family: var(--font-mono, monospace);
      font-size: 0.74rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .stage__title {
      margin: 0;
      line-height: 1.02;
      font-size: clamp(1.55rem, 2.6vw, 2.45rem);
      font-weight: 650;
    }

    .stage__body {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr);
      gap: 1rem;
      align-items: start;
    }

    .stage__story {
      display: grid;
      gap: 0.9rem;
    }

    .stage__annotation {
      margin: 0;
      color: var(--brand, #16614a);
      font-family: var(--font-mono, monospace);
      font-size: 0.76rem;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    .stage__note {
      margin: 0;
      font-size: 1.02rem;
      line-height: 1.65;
    }

    .stage__outcome {
      padding: 0.9rem 1rem;
      border-radius: 1.1rem;
      background: rgba(22, 97, 74, 0.08);
      display: grid;
      gap: 0.3rem;
    }

    .stage__outcome span,
    .stage__packet-header span,
    .stage__next span {
      color: var(--muted, #5b665d);
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .stage__outcome p,
    .stage__packet-header p,
    .stage__next p {
      margin: 0;
      line-height: 1.55;
    }

    .stage__highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .stage__highlights span {
      padding: 0.55rem 0.7rem;
      border-radius: 999px;
      background: rgba(205, 106, 47, 0.1);
      color: var(--brand-deep, #0f3b2d);
      font-family: var(--font-mono, monospace);
      font-size: 0.74rem;
      line-height: 1.35;
    }

    .stage__packet {
      padding: 0.95rem;
      border-radius: 1.2rem;
      border: 1px solid rgba(26, 35, 28, 0.08);
      background: rgba(255, 255, 255, 0.62);
      display: grid;
      gap: 0.75rem;
      align-content: start;
    }

    .stage__packet-header {
      display: grid;
      gap: 0.25rem;
    }

    .stage__packet pre {
      margin: 0;
      padding: 0.95rem;
      overflow: auto;
      border-radius: 0.95rem;
      background: #121913;
      color: #edf7ee;
      font-family: var(--font-mono, monospace);
      font-size: 0.73rem;
      line-height: 1.58;
    }

    .stage__footer {
      align-items: end;
    }

    .stage__next {
      display: grid;
      gap: 0.25rem;
      max-width: 34ch;
    }

    .stage__action {
      min-width: 240px;
    }

    .timeline__nav {
      position: relative;
      padding: 0.9rem 0 0.2rem;
    }

    .timeline__line,
    .timeline__fill {
      position: absolute;
      left: 1rem;
      right: 1rem;
      top: 2rem;
      height: 0.22rem;
      border-radius: 999px;
      pointer-events: none;
    }

    .timeline__line {
      background: rgba(26, 35, 28, 0.12);
    }

    .timeline__fill {
      right: auto;
      width: calc((100% - 2rem) * var(--progress, 0) / 100);
      background: linear-gradient(90deg, rgba(205, 106, 47, 0.9), rgba(22, 97, 74, 0.96));
    }

    .timeline__steps {
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--step-count), minmax(0, 1fr));
      gap: 0.45rem;
      z-index: 1;
    }

    .timeline__step {
      display: grid;
      gap: 0.45rem;
      justify-items: center;
      text-align: center;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
      color: inherit;
    }

    .timeline__step-marker {
      display: grid;
      place-items: center;
      width: 2.7rem;
      height: 2.7rem;
      border-radius: 999px;
      border: 0.18rem solid rgba(22, 97, 74, 0.16);
      background: rgba(255, 255, 255, 0.98);
      color: var(--brand-deep, #0f3b2d);
      font-family: var(--font-mono, monospace);
      font-size: 0.82rem;
      font-weight: 700;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .timeline__step-label {
      color: var(--muted, #5b665d);
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      line-height: 1.35;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .timeline__step:hover .timeline__step-marker {
      transform: translateY(-0.06rem);
    }

    .timeline__step--completed .timeline__step-marker {
      background: var(--brand, #16614a);
      color: white;
    }

    .timeline__step--ready .timeline__step-marker {
      background: var(--accent, #cd6a2f);
      color: white;
    }

    .timeline__step--active .timeline__step-marker {
      transform: scale(1.08);
      box-shadow: 0 12px 28px rgba(205, 106, 47, 0.18);
    }

    @media (max-width: 980px) {
      .stage-deck {
        grid-template-columns: 1fr;
      }

      .peek {
        display: none;
      }

      .stage-window::before,
      .stage-window::after {
        display: none;
      }

      .stage__body,
      .stage__footer {
        grid-template-columns: 1fr;
        flex-direction: column;
      }

      .stage__action {
        width: 100%;
      }
    }

    @media (max-width: 720px) {
      .timeline__bar {
        flex-direction: column;
        align-items: start;
      }

      .timeline__steps {
        gap: 0.2rem;
      }

      .timeline__step-label {
        font-size: 0.66rem;
      }
    }
  `;

  constructor() {
    super();
    this.items = [];
    this.selectedIndex = 0;
    this.completedIndex = -1;
    this.running = false;
  }

  emit(name, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  progressPercent() {
    if (this.items.length < 2 || this.completedIndex < 0) {
      return 0;
    }

    return (Math.min(this.completedIndex, this.items.length - 1) /
      (this.items.length - 1)) *
      100;
  }

  statusBadge(item) {
    switch (item.status) {
      case "completed":
        return { label: "Done", variant: "success", appearance: "filled" };
      case "ready":
        return { label: "Active", variant: "warning", appearance: "filled" };
      default:
        return { label: "Preview", variant: "neutral", appearance: "outlined" };
    }
  }

  renderPeek(item, direction, label, index) {
    if (!item) {
      return html`<div></div>`;
    }

    return html`
      <button
        class=${`peek peek--${direction}`}
        type="button"
        @click=${() => this.emit("timeline-select", { index })}
      >
        <wa-card class="peek__card" appearance="filled-outlined">
          <div class="peek__body">
            <p class="peek__label">${label}</p>
            <h3>${item.shortLabel}</h3>
            <p>${item.previewText}</p>
            <p class="peek__meta">${item.meta}</p>
          </div>
        </wa-card>
      </button>
    `;
  }

  renderActiveStage(item) {
    const badge = this.statusBadge(item);

    return html`
      <wa-card class="stage__card" with-header with-footer appearance="filled-outlined">
        <div slot="header" class="stage__header">
          <div>
            <p class="stage__eyebrow">Step ${this.selectedIndex + 1} of ${this.items.length}</p>
            <h3 class="stage__title">${item.title}</h3>
          </div>
          <wa-badge variant=${badge.variant} appearance=${badge.appearance}>
            ${badge.label}
          </wa-badge>
        </div>

        <div class="stage__body">
          <section class="stage__story">
            <p class="stage__annotation">${item.annotation}</p>
            <p class="stage__note">${item.note}</p>

            <div class="stage__outcome">
              <span>Outcome</span>
              <p>${item.outcome}</p>
            </div>

            ${item.highlights?.length
              ? html`
                  <div class="stage__highlights">
                    ${item.highlights.map(
                      (highlight) => html`<span>${highlight}</span>`,
                    )}
                  </div>
                `
              : null}
          </section>

          <aside class="stage__packet">
            <div class="stage__packet-header">
              <span>Protocol packet</span>
              <p>${item.packetSummary}</p>
            </div>

            <wa-details summary="Inspect phase packet JSON" appearance="plain">
              <pre>${formatJson(item.packetValue)}</pre>
            </wa-details>
          </aside>
        </div>

        <div slot="footer" class="stage__footer">
          <div class="stage__next">
            <span>Next action</span>
            <p>${item.ctaHint}</p>
          </div>

          <wa-button
            class="stage__action"
            variant=${item.ctaVariant ?? "brand"}
            appearance=${item.ctaAppearance ?? "filled"}
            ?disabled=${this.running}
            @click=${() => this.emit("timeline-action", { index: this.selectedIndex })}
          >
            ${this.running ? "Running the current transition..." : item.ctaLabel}
          </wa-button>
        </div>
      </wa-card>
    `;
  }

  render() {
    const completedCount = Math.max(this.completedIndex + 1, 0);
    const active = this.items[this.selectedIndex];
    const previous =
      this.selectedIndex > 0 ? this.items[this.selectedIndex - 1] : null;
    const next =
      this.selectedIndex < this.items.length - 1
        ? this.items[this.selectedIndex + 1]
        : null;

    if (!active) {
      return null;
    }

    return html`
      <div class="timeline">
        <div class="timeline__bar">
          <div class="timeline__status">
            <span>${completedCount} of ${this.items.length} complete</span>
            <p>
              The centered panel is the active phase. Use the large action button
              to advance, or tap the side previews and step dots to inspect other phases.
            </p>
          </div>

          <wa-button
            variant="neutral"
            appearance="outlined"
            ?disabled=${this.selectedIndex === 0}
            @click=${() => this.emit("timeline-back", { index: this.selectedIndex })}
          >
            <wa-icon slot="start" name="arrow-left"></wa-icon>
            Back
          </wa-button>
        </div>

        <div class="stage-window">
          <div class="stage-deck">
            ${this.renderPeek(previous, "prev", "Previous", this.selectedIndex - 1)}
            <div class="stage">${this.renderActiveStage(active)}</div>
            ${this.renderPeek(next, "next", "Next", this.selectedIndex + 1)}
          </div>
        </div>

        <div
          class="timeline__nav"
          style=${`--progress:${this.progressPercent()}; --step-count:${this.items.length};`}
        >
          <div class="timeline__line"></div>
          <div class="timeline__fill"></div>

          <div class="timeline__steps">
            ${this.items.map(
              (item, index) => html`
                <button
                  class=${`timeline__step timeline__step--${item.status} ${index === this.selectedIndex ? "timeline__step--active" : ""}`}
                  type="button"
                  @click=${() => this.emit("timeline-select", { index })}
                >
                  <span class="timeline__step-marker">${index + 1}</span>
                  <span class="timeline__step-label">${item.shortLabel}</span>
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("x401-story-timeline", x401StoryTimeline);
