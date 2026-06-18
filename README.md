# Linear Gauge Home Assistant Card Feature

A Home Assistant custom [card feature](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card-feature/)
that renders a sensor entity as a value on a horizontal, multi-colored region bar with a marker for the current value.

![example](example.png)

## Install

1. Copy `linear-gauge-card-feature.js` into your HA config under `config/www/`
   (e.g. `config/www/linear-gauge-card-feature.js`).
2. Add it as a Lovelace resource:
   - **Settings → Dashboards → ⋮ → Resources → Add Resource**
   - URL: `/local/linear-gauge-card-feature.js`
   - Type: **JavaScript Module**
3. Refresh your browser (hard reload to clear the cache).

## Usage

Add it to the `features:` list of any card that supports features (e.g. the Tile card).

```yaml
type: tile
entity: sensor.pool_ph
name: pH Level
icon: mdi:ph
features:
  - type: custom:linear-gauge
    min: 4
    weighted: true
    segments:
      - { to: 7.0, color: "red", weight: 1 }
      - { to: 7.2, color: "yellow", weight: 2 }
      - { to: 7.6, color: "green", weight: 3 }
      - { to: 7.8, color: "yellow", weight: 2 }
      - { to: 10, color: "red", weight: 1 }
```

## Configuration

| Option         | Type    | Default        | Description                                                         |
| -------------- | ------- | -------------- | ------------------------------------------------------------------- |
| `min`          | number  | `0`            | Left edge of the bar. Right edge is the last segment's `to`.        |
| `segments`     | list    | _see below_    | Colored regions, each running up to `to` from `min`.                |
| `weighted`     | boolean | `false`        | `false`: widths follow value span. `true`: use each segment's `weight`. |
| `show_labels`  | boolean | `true`         | Show the boundary value labels under the bar.                       |

Each `segments` entry is an object:

| Field    | Type   | Default  | Description                                                            |
| -------- | ------ | -------- | --------------------------------------------------------------------- |
| `to`     | number | required | Upper bound of the segment (its right-edge value). Sorted by `to`.    |
| `color`  | string | required | Fill color — a CSS color or HA theme color name.          |
| `weight` | number | `1`      | Relative width when `weighted: true`; ignored otherwise.              |
