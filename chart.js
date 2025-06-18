let sortState = {};

function processFile() {
  const fileInput = document.getElementById('yamlFile');
  const output = document.getElementById('output');
  output.innerHTML = '';

  if (!fileInput.files.length) {
    alert('Please select a YAML file');
    return;
  }

  const file = fileInput.files[0];
  document.getElementById("sourceFile").innerText = `Source file: ${file.name}`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    try {
      const lines = content.split(/\r?\n/);
      const data = jsyaml.load(content);
      const theme = Object.values(data)[0];
      const variables = {};

      lines.forEach((line, index) => {
        const m = line.match(/^\s*([a-zA-Z0-9\-_]+):\s*"?(.+?)"?\s*(?:#.*)?$/);
        if (m) {
          variables[`--${m[1]}`] = { value: m[2].trim(), line: index + 1 };
        }
      });

      const skipKeys = ["font", "border", "padding", "margin", "radius", "gap", "size", "height", "width", "spacing"];
      const usageCount = {};
      const rows = [];

      for (const [key, info] of Object.entries(variables)) {
        if (skipKeys.some(sk => key.toLowerCase().includes(sk))) continue;

        let val = info.value.toLowerCase();
        if (val === '0' || val === 'inherit') continue;
        if (/^\d{1,3},\d{1,3},\d{1,3}$/.test(val)) val = `rgb(${val})`;

        if (
          /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(val) ||
          /^rgb\([^)]+\)$/.test(val) ||
          /^rgba\([^)]+\)$/.test(val) ||
          /^var\([^)]+\)$/.test(val) ||
          val.startsWith('rgb(var(') ||
          val.startsWith('rgba(var(') ||
          val === 'transparent' || val === 'currentcolor' ||
          /^[a-z]+$/.test(val)
        ) {
          const resolved = resolveVar(variables, val, 0, usageCount);
          rows.push({ line: info.line, name: key, value: val, resolved: resolved });
        }
      }

      renderTable(rows, usageCount, output);
    } catch (err) {
      alert('Invalid YAML');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function resolveVar(variables, val, depth = 0, usage = {}) {
  if (depth > 10) return '<span class="unknown">UNKNOWN</span>';

  // rgb(var(--...)) or rgba(var(--...),X)
  let m = val.match(/^(rgb|rgba)\(var\((--[a-z0-9\-_]+)\)(?:,([^)]+))?\)$/);
  if (m) {
    const fn = m[1];
    const ref = m[2];
    const extra = m[3] ? `,${m[3]}` : '';
    if (variables[ref]) {
      usage[ref] = (usage[ref] || 0) + 1;
      let refVal = variables[ref].value.toLowerCase();
      return `${fn}(${refVal}${extra})`;
    } else {
      return '<span class="unknown">UNKNOWN</span>';
    }
  }

  // var(--...)
  m = val.match(/^var\((--[a-z0-9\-_]+)\)$/);
  if (m) {
    const ref = m[1];
    if (variables[ref]) {
      usage[ref] = (usage[ref] || 0) + 1;
      let refVal = variables[ref].value.toLowerCase();
      if (/^\d{1,3},\d{1,3},\d{1,3}$/.test(refVal)) refVal = `rgb(${refVal})`;
      return resolveVar(variables, refVal, depth + 1, usage);
    } else {
      return '<span class="unknown">UNKNOWN</span>';
    }
  }

  return val;
}

function renderTable(rows, usageCount, output) {
  let html = `<table id="colorTable">
    <thead>
      <tr>
        <th>
          <br/><br/><br/>
          Line
        </th>
        <th onclick="sortTable(1)">
          <input class="filter" oninput="filterTable(1, this.value)" placeholder="Filter" /><br/>
          Color Name
        </th>
        <th>
          <button class="reset-filters" onclick="resetFilters()">Reset Filters</button>
          Sample
        </th>
        <th onclick="sortTable(3)">
          <input class="filter" oninput="filterTable(3, this.value)" placeholder="Filter" /><br/>
          Value
        </th>
        <th onclick="sortTable(4)">
          <input class="filter" oninput="filterTable(4, this.value)" placeholder="Filter" /><br/>
          Resolved
        </th>
      </tr>
    </thead>
    <tbody>`;
  rows.forEach(r => {
    const sampleColor = r.resolved.includes('UNKNOWN') ? 'transparent' : r.resolved;
    const usedStr = usageCount[r.name] ? ` - <font color=lightgrey>used ${usageCount[r.name]}x</font>` : '';
    html += `<tr>
      <td>${r.line}</td>
      <td>${r.name}${usedStr}</td>
      <td><div class="sample" style="background:${sampleColor};"></div></td>
      <td>${r.value}</td>
      <td>${r.resolved}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  output.innerHTML = html;
}

function filterTable(col, val) {
  val = val.toLowerCase();
  const rows = document.querySelectorAll("#colorTable tbody tr");
  rows.forEach(row => {
    const cell = row.cells[col];
    row.style.display = cell.innerText.toLowerCase().includes(val) ? "" : "none";
  });
}

function resetFilters() {
  document.querySelectorAll('.filter').forEach(i => i.value = '');
  filterTable(1, '');
  filterTable(3, '');
  filterTable(4, '');
}

function sortTable(col) {
  const table = document.getElementById("colorTable");
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const ths = table.querySelectorAll("thead tr:last-child th");
  
  const current = sortState[col] || 'none';
  const next = current === 'asc' ? 'desc' : 'asc';
  sortState = {}; 
  sortState[col] = next;
  ths.forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
  ths[col].classList.add(`sort-${next}`);

  rows.sort((a, b) => {
    const x = a.cells[col].innerText.toLowerCase();
    const y = b.cells[col].innerText.toLowerCase();
    if (!isNaN(x) && !isNaN(y)) return next === 'asc' ? x - y : y - x;
    return next === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
  });

  const tbody = table.querySelector("tbody");
  rows.forEach(r => tbody.appendChild(r));
}