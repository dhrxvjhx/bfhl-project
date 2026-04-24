const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔴 CHANGE THESE
const USER_ID = "dhruvjha_01012004";
const EMAIL_ID = "dhruv.jha@srmist.edu.in";
const COLLEGE_ROLL_NUMBER = "RA2111026040XXX";

const VALID_EDGE_RE = /^([A-Z])->([A-Z])$/;

// ---------------- VALIDATION ----------------
function parseAndValidate(data) {
  const validEdges = [];
  const invalidEntries = [];
  const duplicateEdges = [];
  const seen = new Set();

  for (let raw of data) {
    const entry = String(raw).trim();
    const match = entry.match(VALID_EDGE_RE);

    if (!match || match[1] === match[2]) {
      invalidEntries.push(raw);
      continue;
    }

    if (seen.has(entry)) {
      if (!duplicateEdges.includes(entry)) duplicateEdges.push(entry);
      continue;
    }

    seen.add(entry);
    validEdges.push({ parent: match[1], child: match[2] });
  }

  return { validEdges, invalidEntries, duplicateEdges };
}

// ---------------- BUILD GRAPH ----------------
function buildHierarchies(validEdges) {
  const parentToChildren = {};
  const childToParent = {};
  const nodes = new Set();

  for (const { parent, child } of validEdges) {
    nodes.add(parent);
    nodes.add(child);

    if (childToParent[child]) continue;

    childToParent[child] = parent;

    if (!parentToChildren[parent]) parentToChildren[parent] = [];
    parentToChildren[parent].push(child);
  }

  // Find roots
  const roots = [...nodes].filter(n => !childToParent[n]);

  const visited = new Set();
  const components = [];

  function dfs(node, comp) {
    if (visited.has(node)) return;
    visited.add(node);
    comp.add(node);
    for (let child of parentToChildren[node] || []) {
      dfs(child, comp);
    }
  }

  for (let r of roots.sort()) {
    if (!visited.has(r)) {
      const comp = new Set();
      dfs(r, comp);
      components.push({ root: r, nodes: comp });
    }
  }

  // Remaining (cycles)
  const remaining = [...nodes].filter(n => !visited.has(n));

  if (remaining.length) {
    const set = new Set(remaining);

    function bfs(start) {
      const q = [start];
      const comp = new Set();

      while (q.length) {
        let n = q.shift();
        if (comp.has(n)) continue;

        comp.add(n);

        for (let child of parentToChildren[n] || []) {
          if (set.has(child)) q.push(child);
        }
        for (let p in childToParent) {
          if (childToParent[p] === n && set.has(p)) q.push(p);
        }
      }
      return comp;
    }

    const seenCycle = new Set();

    for (let n of remaining) {
      if (!seenCycle.has(n)) {
        const comp = bfs(n);
        comp.forEach(x => seenCycle.add(x));
        components.push({
          root: [...comp].sort()[0],
          nodes: comp
        });
      }
    }
  }

  // ---------------- BUILD RESULT ----------------
  const result = [];

  function hasCycle(root, nodes) {
    const stack = new Set();
    const visited = new Set();

    function dfs(n) {
      if (stack.has(n)) return true;
      if (visited.has(n)) return false;

      visited.add(n);
      stack.add(n);

      for (let child of parentToChildren[n] || []) {
        if (nodes.has(child) && dfs(child)) return true;
      }

      stack.delete(n);
      return false;
    }

    return dfs(root);
  }

  function buildTree(node, nodes) {
    let obj = {};
    for (let child of parentToChildren[node] || []) {
      if (nodes.has(child)) {
        obj[child] = buildTree(child, nodes);
      }
    }
    return obj;
  }

  function depth(node, nodes) {
    let max = 0;
    for (let child of parentToChildren[node] || []) {
      if (nodes.has(child)) {
        max = Math.max(max, depth(child, nodes));
      }
    }
    return max + 1;
  }

  for (let { root, nodes } of components) {
    if (hasCycle(root, nodes)) {
      result.push({
        root,
        tree: {},
        has_cycle: true
      });
    } else {
      result.push({
        root,
        tree: { [root]: buildTree(root, nodes) },
        depth: depth(root, nodes)
      });
    }
  }

  return result;
}

// ---------------- ROUTE ----------------
app.post("/bfhl", (req, res) => {
  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data must be array" });
  }

  const { validEdges, invalidEntries, duplicateEdges } =
    parseAndValidate(data);

  const hierarchies = buildHierarchies(validEdges);

  const trees = hierarchies.filter(h => !h.has_cycle);
  const cycles = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = "";
  if (trees.length) {
    trees.sort((a, b) =>
      b.depth !== a.depth
        ? b.depth - a.depth
        : a.root.localeCompare(b.root)
    );
    largest_tree_root = trees[0].root;
  }

  res.json({
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root
    }
  });
});

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);