let CONFIG = null;
let MATERIALS = {}; // Key-value dictionary parsed from CSV

async function initApp() {
  try {
    // Load config.yml and materials.csv in parallel
    const [configResponse, csvResponse] = await Promise.all([
      fetch('data/config.yml'),
      fetch('data/materials.csv')
    ]);

    const yamlText = await configResponse.text();
    const csvText = await csvResponse.text();

    // Parse YAML
    CONFIG = jsyaml.load(yamlText);

    // Parse CSV with PapaParse
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        // Convert array of objects to keyed dictionary
        results.data.forEach(row => {
          MATERIALS[row.id] = {
            name: row.name,
            category: row.category,
            energy_coefficient: parseFloat(row.energy_coefficient) || 1.5,
            allow_cut: row.allow_cut === true || row.allow_cut === 'true',
            allow_etch: row.allow_etch === true || row.allow_etch === 'true',
            max_thickness_mm: parseFloat(row.max_thickness_mm) || 10.0,
            safety_note: row.safety_note || ''
          };
        });

        // Setup Machine Inputs from CONFIG
        document.getElementById('ratedPower').value = CONFIG.machine_info.rated_power_watts;
        document.getElementById('installDate').value = CONFIG.machine_info.tube_install_date;
        document.getElementById('usageIntensity').value = CONFIG.machine_info.weekly_usage;
        document.getElementById('lensType').value = CONFIG.machine_info.installed_lens;
        document.getElementById('airAssist').value = CONFIG.machine_info.air_assist_level;

        // Populate dropdown from CSV data
        populateMaterialDropdown();
        updateCalculator();
      }
    });

  } catch (error) {
    console.error('Failed to initialize application data:', error);
  }
}

function populateMaterialDropdown() {
  const materialSelect = document.getElementById('material');
  materialSelect.innerHTML = '';

  Object.keys(MATERIALS).forEach(key => {
    const mat = MATERIALS[key];
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${mat.name} (${mat.category})`;
    materialSelect.appendChild(option);
  });
}

function updateCalculator() {
  if (!CONFIG || !MATERIALS) return;

  const ratedPower = parseFloat(document.getElementById('ratedPower').value) || 130;
  const installDate = document.getElementById('installDate').value;
  const usage = document.getElementById('usageIntensity').value;
  const matKey = document.getElementById('material').value;
  const taskSelect = document.getElementById('taskMode');
  const thickness = parseFloat(document.getElementById('thickness').value) || 3.0;
  const etchDepth = parseFloat(document.getElementById('etchDepth').value) || 0.5;
  const air = document.getElementById('airAssist').value;

  const selectedMaterial = MATERIALS[matKey] || {};

  // Check cut permission
  if (!selectedMaterial.allow_cut && taskSelect.value === 'cut') {
    taskSelect.value = 'etch';
  }

  const cutOption = taskSelect.querySelector('option[value="cut"]');
  if (cutOption) {
    cutOption.disabled = !selectedMaterial.allow_cut;
  }

  const thicknessGroup = document.getElementById('thicknessGroup');
  const etchDepthGroup = document.getElementById('etchDepthGroup');

  if (taskSelect.value === 'cut') {
    thicknessGroup.classList.remove('hidden');
    etchDepthGroup.classList.add('hidden');
  } else {
    thicknessGroup.classList.add('hidden');
    etchDepthGroup.classList.remove('hidden');
  }

  // Calculate Tube Degradation
  const tubeHealth = calculateTubeHealth(installDate, usage);
  const effectivePowerWatts = ratedPower * tubeHealth;

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
  let focusOffset = '0.0 mm';

  const baseEnergy = selectedMaterial.energy_coefficient || 1.5;
  const airMult = CONFIG.air_assist_multipliers[air] || 1.0;

  if (taskSelect.value === 'cut') {
    const requiredEnergy = baseEnergy * thickness;
    recSpeed = (effectivePowerWatts * 0.8 * airMult) / requiredEnergy;
    recPower = 85;

    if (recSpeed < 3.0) {
      passes = Math.ceil(3.0 / recSpeed);
      recSpeed = recSpeed * passes;
    }

    focusOffset = `-${(thickness / 3).toFixed(1)} mm (1/3 depth)`;
  } else {
    recPower = Math.min(Math.round(40 + (etchDepth * 25)), 90);
    recSpeed = (effectivePowerWatts * 2.2) / (etchDepth * baseEnergy);
    passes = 1;

    if (etchDepth <= 0.2) {
      focusOffset = '0.0 mm (Surface)';
    } else {
      focusOffset = `-${(etchDepth / 2).toFixed(1)} mm (Mid-depth)`;
    }
  }

  recSpeed = Math.min(Math.max(Math.round(recSpeed), 1), 500);

  // Render Speed in mm/s and mm/min
  const speedMms = recSpeed;
  const speedMmin = recSpeed * 60;

  document.getElementById('resSpeed').textContent = `${speedMms} mm/s (${speedMmin} mm/min)`;
  document.getElementById('resPower').textContent = `${recPower}%`;
  document.getElementById('resPasses').textContent = `${passes} pass(es)`;
  document.getElementById('resFocus').textContent = focusOffset;

  // Display Safety Note
  const alertBox = document.getElementById('alertBox');
  if (selectedMaterial.safety_note) {
    alertBox.className = 'alert-box warning';
    alertBox.textContent = selectedMaterial.safety_note;
  } else {
    alertBox.className = 'alert-box hidden';
  }
}

function calculateTubeHealth(installDateStr, intensity) {
  if (!CONFIG) return 1.0;

  const installDate = new Date(installDateStr);
  const now = new Date();
  const elapsedMonths = Math.abs(now - installDate) / (1000 * 60 * 60 * 24 * 30.4375);

  const weeklyHours = CONFIG.tube_degradation.usage_hours_per_week[intensity] || 15;
  const totalOperatingHours = elapsedMonths * 4.33 * weeklyHours;

  const passiveLoss = elapsedMonths * CONFIG.tube_degradation.monthly_passive_decay;
  const activeLoss = (totalOperatingHours / 100) * CONFIG.tube_degradation.active_wear_rate_per_100_hours;

  return Math.max(1.0 - (passiveLoss + activeLoss), 0.40);
}

// Event Listeners
const form = document.getElementById('laserForm');
form.addEventListener('input', updateCalculator);
form.addEventListener('change', updateCalculator);

initApp();
  
