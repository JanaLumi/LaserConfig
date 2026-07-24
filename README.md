# LaserConfig
A lasercutter material configuration webapp

An interactive, client-side web application designed to compute optimal speed, power percentage, multi-pass counts, and focal offsets for $CO_2$ laser cutters.

It dynamically compensates for laser tube aging based on installation date and weekly duty cycle parameters configured in `config.yml`.

## How to Update Machine Specs

All machine hardware, tube replacement dates, and material speed multipliers are managed in **`config.yml`**.

Simply edit `config.yml` directly in GitHub or your local folder:

```yaml
machine_info:
  rated_power_watts: 80
  tube_install_date: "2025-10-15"  # Update this when installing a new tube
  weekly_usage: "medium"
  installed_lens: "2.0"
