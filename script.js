let CONFIG = null;

async function loadConfig() {
  try {
    const response = await fetch('config.yml');
    const yamlText = await response.text();
    CONFIG = jsyaml.load(yamlText);

    // Populate default machine setup from config
    document.getElementById('ratedPower').value = CONFIG.machine_info.rated_power_watts;
    document.getElementById('installDate').value = CONFIG.machine_info.tube_install_date;
    document.getElementById('usageIntensity').value = CONFIG.machine_info.weekly_usage;
    document.getElementById('lensType').value = CONFIG.machine_info.installed_lens;
    document.getElementById('airAssist').value = CONFIG.machine_info.air_assist_level;

    updateCalculator();
  } catch (error) {
    console.error('Failed to load config.yml:', error);
  }
}

function calculateTubeHealth(installDateStr, intensity) {
  if (!CONFIG) return 1.0;

  const installDate = new Date(installDateStr);
  const now = new Date();
  const elapsedMonths = Math.abs(now - installDate) / (1000 * 60 * 60 * 24 * 30.4375);

  const weeklyHours = CONFIG.tube_degradation.usage_hours_per_week[intensity] || 10;
  const totalOperatingHours = elapsedMonths * 4.33 * weeklyHours;

  const passiveLoss = elapsedMonths * CONFIG.tube_degradation.monthly_passive_decay;
  const activeLoss = (totalOperatingHours / 100) * CONFIG.tube_degradation.active_wear_rate_per_100_hours;

  return Math.max(1.0 - (passiveLoss + activeLoss), 0.40);
}

function updateCalculator() {
  if (!CONFIG) return;

  const ratedPower = parseFloat(document.getElementById('ratedPower').value) || 80;
  const installDate = document.getElementById('installDate').value;
  const usage = document.getElementById('usageIntensity').value;
  const material = document.getElementById('material').value;
  const task = document.getElementById('taskMode').value;
  const thickness = parseFloat(document.getElementById('thickness').value) || 1.0;
  const etchDepth = parseFloat(document.getElementById('etchDepth').value) || 0.5;
  const air = document.getElementById('airAssist').value;

  const thicknessGroup = document.getElementById('thicknessGroup');
  const etchDepthGroup = document.getElementById('etchDepthGroup');
  const taskSelect = document.getElementById('taskMode');

  // Handle constraints for Anodised Aluminium (Engrave/Etch only)
  if (material === 'aluminium') {
    if (task === 'cut') {
      taskSelect.value = 'etch';
    }
    thicknessGroup.classList.add('hidden');
    etchDepthGroup.classList.remove('hidden');
  } else if (task === 'cut') {
    thicknessGroup.classList.remove('hidden');
    etchDepthGroup.classList.add('hidden');
  } else {
    thicknessGroup.classList.add('hidden');
    etchDepthGroup.classList.remove('hidden');
  }

  // Calculate Tube Degradation
  const tubeHealth = calculateTubeHealth(installDate, usage);
  const effectivePowerWatts = ratedPower * tubeHealth;

  // Update Health Badge
  const healthPercent = Math.round(tubeHealth * 100);
  const healthSpan = document.getElementById('healthValue');
  const badge = document.getElementById('tubeHealthBadge');
  healthSpan.textContent = `${healthPercent}%`;

  if (healthPercent < 70) {
    badge.style.background = '#fee2e2'; badge.style.color = '#dc2626';
  } else if (healthPercent < 85) {
    badge.style.background = '#fef3c7'; badge.style.color = '#d97706';
  } else {
    badge.style.background = '#dcfce7'; badge.style.color = '#16a34a';
  }

  // Speed and Power Logic
  let recSpeed = 20;
  let recPower = 80;
  let passes = 1;
  let focusOffset = '0.0';

  const baseEnergy = CONFIG.material_energy_coefficients[material] || 1.5;
  const airMult = CONFIG.air_assist_multipliers[air] || 1.0;

  if (task === 'cut' && material !== 'aluminium') {
    // CUTTING: Proportional to total sheet thickness
    const requiredEnergy = baseEnergy * thickness;
    recSpeed = (effectivePowerWatts * 0.8 * airMult) / requiredEnergy;
    recPower = 85;

    if (recSpeed < 3.0) {
      passes = Math.ceil(3.0 / recSpeed);
      recSpeed = recSpeed * passes;
    }

    focusOffset = `-${(thickness / 3).toFixed(1)} (1/3 depth)`;
  } else {
    // ETCHING: Scaled directly by target etch depth input
    recPower = Math.min(Math.round(40 + (etchDepth * 25)), 90);
    recSpeed = (effectivePowerWatts * 2.2) / (etchDepth * baseEnergy);
    passes = 1;

    if (etchDepth <= 0.2) {
      focusOffset = '0.0 (Surface)';
    } else {
      focusOffset = `-${(etchDepth / 2).toFixed(1)} (Mid-depth)`;
    }
  }

  recSpeed = Math.min(Math.max(Math.round(recSpeed), 1), 500);

  // Render UI
  document.getElementById('resSpeed').textContent = recSpeed;
  document.getElementById('resPower').textContent = recPower;
  document.getElementById('resPasses').textContent = passes;
  document.getElementById('resFocus').textContent = focusOffset;

  const alertBox = document.getElementById('alertBox');
  alertBox.className = 'alert-box hidden';

  if (material === 'aluminium') {
    alertBox.textContent = 'Note: Standard CO2 lasers etch/bleach the surface coating or oxide layer on aluminium. Raw through-cutting is not supported.';
    alertBox.className = 'alert-box warning';
  } else if (healthPercent < 70) {
    alertBox.textContent = 'Laser tube health is below 70%. Consider tube replacement or checking optical beam alignment.';
    alertBox.className = 'alert-box danger';
  }
}

// Event Listeners
const form = document.getElementById('laserForm');
form.addEventListener('input', updateCalculator);
form.addEventListener('change', updateCalculator);

loadConfig();
