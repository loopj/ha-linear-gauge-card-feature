import {
  LitElement,
  css,
  html,
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

// Generic fallback segments, used until the config supplies its own.
const DEFAULT_SEGMENTS = [
  { to: 20, color: "red" },
  { to: 40, color: "yellow" },
  { to: 60, color: "green" },
  { to: 80, color: "yellow" },
  { to: 100, color: "red" },
];

// Map a segment's `color` to a CSS background: HA theme colors (`--<name>-color`) resolve, else pass through.
function resolveColor(color) {
  if (typeof color !== "string") return color;
  const key = color.trim().toLowerCase();
  if (!key) return color;

  // A name is a theme color when the active theme defines a matching `--<name>-color`.
  const cssVar = `--${key}-color`;
  const isThemeColor =
    getComputedStyle(document.body).getPropertyValue(cssVar).trim() !== "";
  return isThemeColor ? `var(${cssVar})` : color;
}

// Maps the user's `number_format` preference to a locale (HA's numberFormatToLocale).
const numberFormatToLocale = (locale) => {
  switch (locale?.number_format) {
    case "comma_decimal":
      return ["en-US", "en"];
    case "decimal_comma":
      return ["de", "es", "it"];
    case "space_comma":
      return ["fr", "sv", "cs"];
    case "quote_decimal":
      return ["de-CH"];
    case "system":
      return undefined;
    default:
      return locale?.language;
  }
};

// Formats a number using the user's locale and entity's display precision.
const formatNumber = (num, locale, options) =>
  locale?.number_format === "none"
    ? new Intl.NumberFormat("en-US", { ...options, useGrouping: false }).format(
        num,
      )
    : new Intl.NumberFormat(numberFormatToLocale(locale), options).format(num);

// HA's getNumberFormatOptions: honor the entity's display precision, else drop decimals for integer states.
const numberFormatOptions = (stateObj, entry) => {
  const precision = entry?.display_precision;
  if (precision != null) {
    return {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    };
  }
  if (
    Number.isInteger(Number(stateObj?.attributes?.step)) &&
    Number.isInteger(Number(stateObj?.state))
  ) {
    return { maximumFractionDigits: 0 };
  }
  return undefined;
};

// The feature supports any sensor entity with a unit or state class.
const supportsLinearGauge = (hass, context) => {
  const s = hass.states[context?.entity_id];
  return (
    !!s &&
    s.entity_id.startsWith("sensor.") &&
    (!!s.attributes.unit_of_measurement || !!s.attributes.state_class)
  );
};

class LinearGaugeCardFeature extends LitElement {
  static get properties() {
    // hass & context are assigned by HA; _config is derived internal state.
    return {
      hass: undefined,
      context: undefined,
      _config: { state: true },
    };
  }

  static getStubConfig() {
    return {
      type: "custom:linear-gauge",
      min: 0,
      segments: DEFAULT_SEGMENTS,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");

    const { show_labels = true, weighted = false } = config;

    const segments = (
      config.segments?.length ? config.segments : DEFAULT_SEGMENTS
    )
      .slice()
      .sort((a, b) => Number(a.to) - Number(b.to));

    // The bar spans `min` (left edge) to the last segment's `to` (right edge).
    const min = config.min != null ? Number(config.min) : 0;
    const boundaries = [min, ...segments.map((s) => Number(s.to))];

    // Segment width follows its value span, or its `weight` when `weighted`; `edges` are cumulative positions (%).
    const weights = segments.map((s, i) =>
      weighted ? Number(s.weight ?? 1) : boundaries[i + 1] - boundaries[i],
    );
    const total = weights.reduce((a, w) => a + w, 0) || 1;
    const edges = [0];
    for (const w of weights) edges.push(edges.at(-1) + (w / total) * 100);

    this._config = {
      segments: segments.map((s, i) => ({
        flex: Math.max(0, weights[i]),
        color: resolveColor(s.color),
      })),
      boundaries,
      edges,
      show_labels,
    };
  }

  render() {
    if (!this._config || !this.hass) return null;
    const { segments, boundaries, edges, show_labels } = this._config;

    // Non-numeric states (unavailable/unknown/no entity) give NaN, which hides the marker.
    const stateObj = this.hass.states[this.context?.entity_id];
    const value = stateObj ? parseFloat(stateObj.state) : NaN;

    return html`
      <div class="bar-area">
        <div class="bar">
          ${segments.map(
            (s) =>
              html`<div
                class="segment"
                style="flex:${s.flex};background:${s.color}"
              ></div>`,
          )}
        </div>
        ${Number.isNaN(value)
          ? ""
          : html`<div
              class="marker"
              style="left:${this._valueToPercent(value)}%"
            ></div>`}
        ${show_labels
          ? html`<div class="labels">
              ${boundaries.map((v, i) => {
                // First/last labels align to the bar ends so they don't overflow.
                const edge =
                  i === 0
                    ? "edge-min"
                    : i === boundaries.length - 1
                      ? "edge-max"
                      : "";
                return html`<div
                  class="label ${edge}"
                  style="left:${edges[i]}%"
                >
                  ${this._formatLabel(v)}
                </div>`;
              })}
            </div>`
          : ""}
      </div>
    `;
  }

  // Map a value to a position (0..100%) by piecewise interpolation through the segment edges.
  _valueToPercent(v) {
    const { boundaries, edges } = this._config;
    const last = boundaries.length - 1;
    const x = Math.min(boundaries[last], Math.max(boundaries[0], v));
    for (let i = 0; i < last; i++) {
      const a = boundaries[i];
      const b = boundaries[i + 1];
      if (x <= b || i === last - 1) {
        const t = a === b ? 0 : (x - a) / (b - a);
        return edges[i] + t * (edges[i + 1] - edges[i]);
      }
    }
    return 0;
  }

  // Format a boundary label the way HA renders the entity's numbers.
  _formatLabel(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    const id = this.context?.entity_id;
    const options = numberFormatOptions(
      this.hass.states[id],
      this.hass.entities?.[id],
    );
    return formatNumber(n, this.hass.locale, options);
  }

  static get styles() {
    return css`
      :host {
        display: block;
        pointer-events: none;
      }
      .bar-area {
        position: relative;
      }
      .bar {
        display: flex;
        width: 100%;
        height: var(--feature-height, 42px);
        border-radius: var(--feature-border-radius, 12px);
        overflow: hidden;
      }
      .segment {
        height: 100%;
      }
      .marker {
        position: absolute;
        top: -5px;
        height: calc(var(--feature-height, 42px) + 10px);
        width: 3px;
        border-radius: 2px;
        background: var(
          --linear-gauge-marker-color,
          var(--primary-text-color, #111)
        );
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
        transform: translateX(-50%);
        transition: left 180ms ease-in-out;
      }
      .labels {
        position: relative;
        height: 1.2em;
        margin-top: 6px;
        font-size: 0.8em;
        color: var(--secondary-text-color);
      }
      .label {
        position: absolute;
        transform: translateX(-50%);
        white-space: nowrap;
      }
      .label.edge-min {
        transform: translateX(0);
      }
      .label.edge-max {
        transform: translateX(-100%);
      }
    `;
  }
}

customElements.define("linear-gauge", LinearGaugeCardFeature);

window.customCardFeatures = window.customCardFeatures || [];
window.customCardFeatures.push({
  type: "linear-gauge",
  name: "Linear Gauge",
  isSupported: supportsLinearGauge,
});
