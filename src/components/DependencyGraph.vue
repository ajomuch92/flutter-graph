<template>
  <div class="p-4">
    <div class="flex gap-2 mb-4 flex-wrap">
      <input
        v-model="packageName"
        type="text"
        placeholder="Package name (e.g., flutter_riverpod)"
        class="border p-2 rounded grow min-w-50"
        @keyup.enter="loadGraph"
      />
      <input
        v-model.number="maxDepth"
        type="number"
        min="1"
        max="10"
        placeholder="Max depth"
        class="border p-2 rounded w-28"
      />
      <button
        @click="loadGraph"
        class="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Generate Graph
      </button>
    </div>

    <div v-if="loading" class="text-center py-8">Loading dependencies...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <div
      ref="networkContainer"
      class="w-full h-150 border rounded bg-white"
    ></div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';

const packageName = ref('');
const maxDepth = ref(5); // default depth
const loading = ref(false);
const error = ref('');
const networkContainer = ref(null);
let network = null;

// Store graph data
const visitedPackages = new Map(); // name -> { version, metrics, depth }
const edgesList = []; // { from, to }

// --- API helpers (using local proxies) ---
async function getLatestVersion(pkg) {
  const res = await fetch(`/api/package-info?package=${pkg}`);
  const data = await res.json();
  return data.latest.version;
}

async function getDependencies(pkg, version) {
  const res = await fetch(`/api/dependencies?package=${pkg}&version=${version}`);
  const data = await res.json();
  return data.dependencies;
}

async function getMetrics(pkg) {
  try {
    const res = await fetch(`/api/metrics?package=${pkg}`);
    const data = await res.json();
    return {
      likes: data.likes,
      downloads: data.downloads,
      pubPoints: data.pubPoints,
    };
  } catch {
    return { likes: '?', downloads: '?', pubPoints: '?' };
  }
}

// --- Recursive dependency builder ---
async function buildGraph(pkg, parent = null, depth = 0) {
  if (depth > maxDepth.value) return;
  if (visitedPackages.has(pkg)) return;

  // Fetch version and metrics
  let version, metrics;
  try {
    version = await getLatestVersion(pkg);
    metrics = await getMetrics(pkg);
  } catch (err) {
    error.value = `Error fetching ${pkg}: ${err.message}`;
    return;
  }

  visitedPackages.set(pkg, { version, metrics, depth });

  // If there is a parent, add edge
  if (parent) {
    edgesList.push({ from: parent, to: pkg });
  }

  // Fetch dependencies
  let deps = [];
  try {
    deps = await getDependencies(pkg, version);
  } catch (err) {
    return;
  }

  // Process each dependency recursively
  for (const dep of deps) {
    console.log(`Processing ${dep} (depth ${depth + 1})`);
    await buildGraph(dep, pkg, depth + 1);
  }
}

// --- Render graph with vis-network ---
function renderGraph() {
  const nodes = [];
  for (const [name, info] of visitedPackages.entries()) {
    const tooltip = `
        ${name}
        Version: ${info.version}
        👍 Likes: ${info.metrics.likes}
        📊 Downloads: ${info.metrics.downloads}
        🧪 Pub Points: ${info.metrics.pubPoints}
        Depth: ${info.depth}
    `;
    nodes.push({
      id: name,
      label: name,
      title: tooltip,
      shape: 'box',
      font: { size: 12 },
      level: info.depth, // for hierarchical layout (optional)
    });
  }

  const edges = edgesList.map(edge => ({
    from: edge.from,
    to: edge.to,
    arrows: 'to',
  }));

  const container = networkContainer.value;
  if (!container) return;

  const data = {
    nodes: new DataSet(nodes),
    edges: new DataSet(edges),
  };

  const options = {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD', // Up-Down
        sortMethod: 'directed',
      },
    },
    nodes: {
      shape: 'box',
      margin: 10,
      widthConstraint: { minimum: 100 },
      font: { size: 14, face: 'sans-serif' },
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 0.8 } },
      smooth: { type: 'cubicBezier' },
    },
    physics: false, // hierarchical layout works better with physics off
    interaction: { hover: true, tooltipDelay: 200 },
  };

  if (network) network.destroy();
  network = new Network(container, data, options);
}

// --- Main loader ---
async function loadGraph() {
  if (!packageName.value.trim()) return;
  loading.value = true;
  error.value = '';
  visitedPackages.clear();
  edgesList.length = 0;

  try {
    await buildGraph(packageName.value.trim(), null, 0);
    if (visitedPackages.size === 0) {
      error.value = 'No dependencies found or package does not exist.';
    } else {
      renderGraph();
    }
  } catch (err) {
    console.error(err);
    error.value = 'Error loading graph. Check console for details.';
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  if (network) network.destroy();
});
</script>