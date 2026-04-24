let lastResponse = null;

function parseInput(raw) {
  return raw.split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function send() {
  const data = parseInput(document.getElementById("input").value);
  const url = document.getElementById("apiUrl").value;

  const res = await fetch(url + "/bfhl", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ data })
  });

  const json = await res.json();
  lastResponse = json;

  renderSummary(json.summary);
  renderTreeVisualization(json.hierarchies);

  document.getElementById("output").textContent =
    JSON.stringify(json, null, 2);
}

function showTrees() {
  if (!lastResponse) return;

  const filtered = {
    ...lastResponse,
    hierarchies: lastResponse.hierarchies.filter(h => !h.has_cycle)
  };

  document.getElementById("output").textContent =
    JSON.stringify(filtered, null, 2);
}

function clearAll() {
  document.getElementById("input").value = "";
  document.getElementById("output").textContent = "";
  document.getElementById("summary").innerHTML = "";
}

function renderSummary(s) {
  document.getElementById("summary").innerHTML = `
    <div class="summary-card">
      <h2>${s.total_trees}</h2>
      <p>Trees</p>
    </div>
    <div class="summary-card">
      <h2>${s.total_cycles}</h2>
      <p>Cycles</p>
    </div>
    <div class="summary-card">
      <h2>${s.largest_tree_root || '-'}</h2>
      <p>Largest Root</p>
    </div>
  `;
}

function renderTreeVisualization(hierarchies) {
  const container = document.getElementById("treeContainer");
  container.innerHTML = "";

  hierarchies.forEach((h, index) => {
    if (h.has_cycle) {
      const div = document.createElement("div");
      div.innerHTML = `<p style="color:#ef4444;">Cycle detected at root ${h.root}</p>`;
      container.appendChild(div);
      return;
    }

    const data = convertToD3Format(h.tree);

    const width = 400;
    const height = 250;

    const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .style("margin-bottom", "20px");

    const root = d3.hierarchy(data);

    const treeLayout = d3.tree().size([width - 40, height - 40]);
    treeLayout(root);

    const g = svg.append("g").attr("transform", "translate(20,20)");

    // links
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );

    // nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle").attr("r", 6);

    node.append("text")
      .attr("dy", -10)
      .attr("text-anchor", "middle")
      .text(d => d.data.name);

    container.appendChild(svg.node());
  });
}

// convert your tree to D3 format
function convertToD3Format(tree) {
  const rootKey = Object.keys(tree)[0];

  function build(nodeKey, obj) {
    return {
      name: nodeKey,
      children: Object.entries(obj[nodeKey] || {}).map(([k]) =>
        build(k, obj[nodeKey])
      )
    };
  }

  return build(rootKey, tree);
}