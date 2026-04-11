<template>
  <div class="p-6 md:p-8">
    <!-- Search Bar -->
    <div class="mb-6">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Package name
          </label>
          <input
            v-model.trim="packageName"
            type="text"
            placeholder="e.g., flutter_riverpod, provider, bloc..."
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            @keyup.enter="loadGraph"
          />
        </div>
        <div class="sm:w-32">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Max depth
          </label>
          <input
            v-model.number="maxDepth"
            type="number"
            min="1"
            max="10"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
          />
        </div>
        <div class="sm:self-end">
          <button
            @click="loadGraph"
            :disabled="loading || !packageName.trim()"
            class="cursor-pointer w-full sm:w-auto px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span v-if="loading">Loading...</span>
            <span v-else>🔍 Generate Graph</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Bar -->
    <div v-if="visitedPackages.size > 0 && !loading" class="mb-4 flex flex-wrap gap-4 text-sm">
      <div class="bg-blue-50 px-4 py-2 rounded-lg">
        <span class="font-semibold text-blue-900">{{ visitedPackages.size }}</span>
        <span class="text-blue-700 ml-1">packages found</span>
      </div>
      <div class="bg-purple-50 px-4 py-2 rounded-lg">
        <span class="font-semibold text-purple-900">{{ edgesList.length }}</span>
        <span class="text-purple-700 ml-1">dependencies</span>
      </div>
      <a :href="`https://pub.dev/packages/${packageName.trim()}`" target="_blank" class="bg-green-50 px-4 py-2 rounded-lg text-green-700 hover:bg-green-100 transition-all">
        View on pub.dev
      </a>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-16">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
      <p class="text-gray-600 font-medium">Analyzing dependencies...</p>
      <p class="text-sm text-gray-500 mt-2">This may take a moment for larger graphs.</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
      <div class="flex items-start gap-3">
        <span class="text-xl">⚠️</span>
        <div>
          <p class="font-medium">Error</p>
          <p class="text-sm">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Graph Container -->
    <div
      v-show="!loading"
      ref="networkContainer"
      class="w-full rounded-xl border-2 border-gray-200 bg-gray-50 transition-all"
      :class="visitedPackages.size > 0 ? 'h-150' : 'h-100'"
    >
      <div v-if="!loading && visitedPackages.size === 0" class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <div class="text-6xl mb-4">🔍</div>
          <p class="text-lg font-medium">Enter a package to begin</p>
          <p class="text-sm mt-2">The graph will appear here</p>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div v-if="visitedPackages.size > 0" class="mt-4 text-sm text-gray-500 text-center">
      💡 Tip: Use your mouse to zoom and drag the graph. Hover over a node to see more details.
    </div>
  </div>
</template>


<script setup>
import { ref, onUnmounted, nextTick } from 'vue';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';

const packageName = ref('');
const maxDepth = ref(5);
const loading = ref(false);
const error = ref('');
const networkContainer = ref(null);
let network = null;

const visitedPackages = new Map();
const edgesList = [];

async function getLatestVersion(pkg) {
  const res = await fetch(`/api/package-info?package=${pkg}`);
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Package "${pkg}" not found`);
    }
    throw new Error(`Failed to fetch package info: ${res.status}`);
  }
  
  const data = await res.json();
  return data.latest.version;
}

async function getDependencies(pkg, version) {
  const res = await fetch(`/api/dependencies?package=${pkg}&version=${version}`);
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Dependencies for "${pkg}@${version}" not found`);
    }
    throw new Error(`Failed to fetch dependencies: ${res.status}`);
  }
  
  const data = await res.json();
  return data.dependencies;
}

async function getMetrics(pkg) {
  try {
    const res = await fetch(`/api/metrics?package=${pkg}`);
    
    if (!res.ok) {
      return { likes: '?', downloads: '?', pubPoints: '?' };
    }
    
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

async function buildGraph(pkg, parent = null, depth = 0) {
  if (depth > maxDepth.value) return;
  if (visitedPackages.has(pkg)) return;

  let version, metrics;
  try {
    version = await getLatestVersion(pkg);
    metrics = await getMetrics(pkg);
  } catch (err) {
    if (depth === 0) {
      throw err;
    }
    console.warn(`Skipping ${pkg}: ${err.message}`);
    return;
  }

  visitedPackages.set(pkg, { version, metrics, depth });

  if (parent) {
    edgesList.push({ from: parent, to: pkg });
  }

  let deps = [];
  try {
    deps = await getDependencies(pkg, version);
  } catch (err) {
    return;
  }

  for (const dep of deps) {
    await buildGraph(dep, pkg, depth + 1);
  }
}

function renderGraph() {
  const nodes = [];
  for (const [name, info] of visitedPackages.entries()) {
    const tooltip = `${name}
Version: ${info.version}
👍 Likes: ${info.metrics.likes}
📥 Downloads: ${info.metrics.downloads}
🏆 Pub Points: ${info.metrics.pubPoints}
📏 Depth: ${info.depth}`;
    
    // Color based on depth
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
    const color = colors[Math.min(info.depth, colors.length - 1)];
    
    nodes.push({
      id: name,
      label: name,
      title: tooltip,
      shape: 'box',
      font: { size: 13, color: '#1F2937' },
      color: {
        background: color,
        border: color,
        highlight: { background: color, border: '#1F2937' }
      },
      borderWidth: 2,
      margin: 12,
      level: info.depth,
    });
  }

  const edges = edgesList.map(edge => ({
    from: edge.from,
    to: edge.to,
    arrows: { to: { enabled: true, scaleFactor: 1 } },
    color: { color: '#9CA3AF', highlight: '#3B82F6' },
    width: 2,
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
        direction: 'UD',
        sortMethod: 'directed',
        levelSeparation: 150,
        nodeSpacing: 120,
      },
    },
    nodes: {
      shape: 'box',
      margin: 12,
      widthConstraint: { minimum: 120, maximum: 200 },
      font: { size: 13, face: 'system-ui, -apple-system, sans-serif', color: '#FFFFFF' },
      borderWidth: 0,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 8, x: 0, y: 2 },
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 1 } },
      smooth: { type: 'cubicBezier', roundness: 0.5 },
      width: 2,
    },
    physics: false,
    interaction: { 
      hover: true, 
      tooltipDelay: 100,
      navigationButtons: true,
      keyboard: true
    },
  };

  if (network) network.destroy();
  network = new Network(container, data, options);
}

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
    error.value = err.message || 'Error loading graph. Check console for details.';
  } finally {
    loading.value = false;
    await nextTick();
    if (network) {
      network.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad'
        }
      });
    }
  }
}

onUnmounted(() => {
  if (network) network.destroy();
});
</script>