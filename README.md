# Linear Gauge Home Assistant Card Feature

![example](example.png)

A Home Assistant custom [card feature](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card-feature/)
that renders a sensor entity as a value on a horizontal, multi-colored region bar with a marker for the current value.

## Install

1. Copy `linear-gauge-card-feature.js` into your HA config under `config/www/`
   (e.g. `config/www/linear-gauge-card-feature.js`).
2. Add it as a Lovelace resource:
   - **Settings → Dashboards → ⋮ → Resources → Add Resource**
   - URL: `/local/linear-gauge-card-feature.js`
   - Type: **JavaScript Module**
3. Refresh your browser (hard reload to clear the cache).
4. Add it to the `features:` list of any card that supports features (e.g. the Tile card).

## Examples

### Litter Box

![litter-box-example](litter-box-example.png)

```yaml
type: tile
entity: sensor.litter_robot_4_waste_drawer
name: Waste Drawer
icon: mdi:emoticon-poop
features:
  - type: custom:linear-gauge
    show_labels: false
    segments:
      - { to: 60, color: green }
      - { to: 80, color: yellow }
      - { to: 100, color: red }
```

### Pool Chemistry

![pool-chemistry-example](pool-chemistry-example.png)

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

The card feature can be configured from the dashboard's visual editor or in YAML.

| Option              | Type    | Default     | Description                                                             |
| ------------------- | ------- | ----------- | ----------------------------------------------------------------------- |
| `min`               | number  | `0`         | Minimum value (left edge of the bar)                                    |
| `weighted`          | boolean | `false`     | `false`: widths follow value span. `true`: use each segment's `weight`. |
| `show_labels`       | boolean | `true`      | Show the boundary value labels under the bar.                           |
| `segments`          | list    | _see below_ | Colored regions, each running up to `to` from `min`.                    |
| `segments[].to`     | number  | required    | Upper bound of the segment (its right edge).                            |
| `segments[].color`  | string  | required    | HA theme color name or CSS color.                                       |
| `segments[].weight` | number  | `1`         | Relative width when `weighted: true`; ignored otherwise.                |
