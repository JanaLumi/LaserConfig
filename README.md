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
```

## Mathematics Formulas in LaserConfig

Here is the exact mathematical model used by the application for calculating tube health, cutting parameters, and etching parameters.

---

### 1. Tube Degradation & Health

The total operating hours $H$ are derived from the elapsed time in months $M$ and weekly usage hours $U$:

$$H = M \times 4.33 \times U$$

The remaining laser tube power capacity factor $C_{\text{health}}$ is calculated using both passive monthly decay rate $d_{\text{passive}}$ and active wear rate per 100 hours $w_{\text{active}}$:

$$C_{\text{health}} = \max\left(1.0 - \left(M \cdot d_{\text{passive}} + \frac{H}{100} \cdot w_{\text{active}}\right), \, 0.40\right)$$

The effective available power $P_{\text{eff}}$ in Watts is:

$$P_{\text{eff}} = P_{\text{rated}} \times C_{\text{health}}$$

---

### 2. Through-Cut Calculations

For cutting tasks, total required energy depends on the base material energy coefficient $E_{\text{mat}}$ and material thickness $t$:

$$E_{\text{req}} = E_{\text{mat}} \times t$$

The calculated raw cutting speed $S_{\text{raw}}$ (in mm/s) incorporates effective power, $80\%$ duty cycle efficiency, and the air-assist multiplier $A_{\text{mult}}$:

$$S_{\text{raw}} = \frac{P_{\text{eff}} \times 0.8 \times A_{\text{mult}}}{E_{\text{req}}}$$

If $S_{\text{raw}} < 3.0\text{ mm/s}$, multiple passes $N$ are assigned to prevent deep scorching:

$$N = \left\lceil \frac{3.0}{S_{\text{raw}}} \right\rceil, \quad S_{\text{final}} = S_{\text{raw}} \times N$$

Recommended power preset for cutting is fixed at $85\%$. The focal offset $F_{\text{offset}}$ is focused $1/3$ into the material thickness:

$$F_{\text{offset}} = -\frac{t}{3}$$

---

### 3. Etch / Engrave Calculations

For etching, target depth $d$ replaces material thickness. Recommended power $P_{\text{rec}}$ scales with depth, capped at $90\%$:

$$P_{\text{rec}} = \min\left(\text{round}\left(40 + 25 \cdot d\right), \, 90\right)$$

The calculated etching speed $S_{\text{etch}}$ (in mm/s) is derived via:

$$S_{\text{etch}} = \frac{P_{\text{eff}} \times 2.2}{d \times E_{\text{mat}}}$$

The focal offset $F_{\text{offset}}$ targets mid-depth for $d > 0.2\text{ mm}$:

$$F_{\text{offset}} = \begin{cases} 0.0\text{ mm (Surface)} & \text{if } d \le 0.2\text{ mm} \\ -\dfrac{d}{2}\text{ mm (Mid-depth)} & \text{if } d > 0.2\text{ mm} \end{cases}$$
