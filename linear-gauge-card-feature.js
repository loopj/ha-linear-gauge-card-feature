import {
  LitElement,
  css,
  html,
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

const supportsLinearGaugeCardFeature = (hass, context) => {
  const s = hass.states[context?.entity_id];
  return (
    !!s &&
    s.entity_id.startsWith("sensor.") &&
    (!!s.attributes.unit_of_measurement || !!s.attributes.state_class)
  );
};

// Quick and dirty version of HA's resolveColor()
function resolveColor(color) {
  if (typeof color !== "string") return color;
  const key = color.trim().toLowerCase();
  if (!key) return color;

  const cssVar = `--${key}-color`;
  const isThemeColor =
    getComputedStyle(document.body).getPropertyValue(cssVar).trim() !== "";
  return isThemeColor ? `var(${cssVar})` : color;
}

// Position of a value along a plain linear bar, as a percentage (0–100).
function linearPercent(value, min, max) {
  const clamped = Math.min(max, Math.max(min, value));
  return ((clamped - min) / (max - min)) * 100;
}

// Position of a value along a weighted linear bar, as a percentage (0–100).
function weightedPercent(value, bounds, weights) {
  const total = weights.reduce((a, w) => a + w, 0) || 1;

  let start = 0; // % position where the current segment begins
  for (let i = 0; i < bounds.length - 1; i++) {
    const width = (weights[i] / total) * 100;
    if (value <= bounds[i + 1] || i === bounds.length - 2) {
      const range = bounds[i + 1] - bounds[i];
      const through = range === 0 ? 0 : (value - bounds[i]) / range;
      return Math.min(100, Math.max(0, start + through * width));
    }
    start += width;
  }
  return 0;
}

class LinearGaugeCardFeature extends LitElement {
  static get properties() {
    return {
      hass: undefined,
      context: undefined,
      _config: { state: true },
    };
  }

  static getStubConfig() {
    return {
      type: "custom:linear-gauge",
    };
  }

  static getConfigElement() {
    return document.createElement("linear-gauge-editor");
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = config;
  }

  render() {
    if (
      !this._config ||
      !this.hass ||
      !this.context ||
      !this.context.entity_id ||
      !this.hass.states[this.context.entity_id] ||
      !supportsLinearGaugeCardFeature(this.hass, this.context)
    ) {
      return null;
    }

    const stateObj = this.hass.states[this.context.entity_id];
    const value = parseFloat(stateObj.state);
    const min = this._config.min ?? 0;
    const max = this._config.max ?? 100;

    if (isNaN(value) || min >= max) {
      return null;
    }

    const { weighted = false, boundary_labels = false } = this._config;

    // Sorted segments, or null for a plain bar gauge.
    const segments = this._config.segments?.length
      ? [...this._config.segments].sort((a, b) => a.from - b.from)
      : null;

    // Weighted mode only applies when there are segments to weight.
    const useWeights = weighted && segments;

    // Boundary values along the bar, and (in weighted mode) each segment's weight.
    const bounds = segments
      ? [min, ...segments.slice(1).map((s) => Number(s.from)), max]
      : [min, max];
    const weights = segments?.map((s) => Number(s.weight ?? 1));

    // % position of a value along the bar — weighted mode walks by weight, else linear.
    const valuePercent = (v) =>
      useWeights
        ? weightedPercent(v, bounds, weights)
        : linearPercent(v, min, max);

    // % position of the value marker along the bar.
    const markerPercent = valuePercent(value);

    // The bars to draw, either from the segments or a two-part value fill.
    const bars = segments
      ? segments.map((s, i) => ({
          flex: useWeights ? weights[i] : bounds[i + 1] - bounds[i],
          color: resolveColor(s.color),
        }))
      : [
          { flex: markerPercent, color: "var(--feature-color)" },
          {
            flex: 100 - markerPercent,
            color: "color-mix(in srgb, var(--feature-color) 20%, transparent)",
          },
        ];

    return html`
      <div class="bar-area">
        <div class="bar">
          ${bars.map(
            (s) =>
              html`<div
                class="segment"
                style="flex:${s.flex};background:${s.color}"
              ></div>`,
          )}
        </div>
        ${segments
          ? html`<div class="marker" style="left:${markerPercent}%"></div>`
          : ""}
        ${boundary_labels
          ? html`<div class="labels">
              ${bounds.map((v, i) => {
                const edge =
                  i === 0
                    ? "edge-min"
                    : i === bounds.length - 1
                      ? "edge-max"
                      : "";
                return html`<div
                  class="label ${edge}"
                  style="left:${valuePercent(v)}%"
                >
                  ${v}
                </div>`;
              })}
            </div>`
          : ""}
      </div>
    `;
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

const EDITOR_LABELS = {
  min: "Minimum value",
  max: "Maximum value",
  boundary_labels: "Boundary labels",
  weighted: "Weighted segments",
  segments: "Segments",
};

const EDITOR_SCHEMA = [
  { name: "min", selector: { number: { mode: "box", step: "any" } } },
  { name: "max", selector: { number: { mode: "box", step: "any" } } },
  { name: "boundary_labels", selector: { boolean: {} } },
  { name: "weighted", selector: { boolean: {} } },
  {
    name: "segments",
    selector: {
      object: {
        multiple: true,
        fields: {
          from: {
            label: "From",
            selector: { number: { mode: "box", step: "any" } },
          },
          color: {
            label: "Color",
            selector: { ui_color: {} },
          },
          weight: {
            label: "Weight",
            selector: { number: { mode: "box", step: "any", min: 0 } },
          },
        },
      },
    },
  },
];

class LinearGaugeEditor extends LitElement {
  static get properties() {
    return { hass: {}, context: {}, _config: { state: true } };
  }

  setConfig(config) {
    this._config = config;
  }

  render() {
    if (!this.hass || !this._config) return html``;
    // Seed the feature's defaults so unset toggles display correctly.
    const data = {
      min: 0,
      max: 100,
      boundary_labels: false,
      segments: [],
      ...this._config,
    };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${EDITOR_SCHEMA}
        .computeLabel=${(s) => EDITOR_LABELS[s.name] || s.name}
        @value-changed=${this._changed}
      ></ha-form>
    `;
  }

  _changed(ev) {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: ev.detail.value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

customElements.define("linear-gauge-editor", LinearGaugeEditor);

window.customCardFeatures = window.customCardFeatures || [];
window.customCardFeatures.push({
  type: "linear-gauge",
  name: "Linear Gauge",
  isSupported: supportsLinearGaugeCardFeature,
  configurable: true,
});
