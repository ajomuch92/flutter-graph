<!-- src/components/DependencyGraph.vue -->
<template>
  <div class="p-4">
    <div class="flex gap-2 mb-4">
      <input
        v-model="packageName"
        type="text"
        placeholder="Ej: flutter_riverpod"
        class="border p-2 rounded grow"
        @keyup.enter="loadGraph"
      />
      <button
        @click="loadGraph"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Generar gráfico
      </button>
    </div>

    <div v-if="loading" class="text-center py-8">Cargando dependencias...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <div
      ref="networkContainer"
      class="w-full h-150 border rounded bg-white"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';

const packageName = ref('');
const loading = ref(false);
const error = ref('');
const networkContainer = ref(null);
let network = null;

// Conjunto para evitar duplicados (por nombre de paquete)
const visitedPackages = new Set();

// Almacena información de cada nodo (para el tooltip)
const nodesData = new Map();

// --- Funciones de API ---

async function getLatestVersion(pkg) {
  const res = await axios.get(`/api/package-info?package=${pkg}`);
  return res.data.latest.version;
}

async function getDependencies(pkg, version) {
  const res = await axios.get(`/api/dependencies?package=${pkg}&version=${version}`);
  return res.data.dependencies; // ya es un array de strings
}

async function getMetrics(pkg) {
  try {
    const res = await axios.get(`/api/metrics?package=${pkg}`);
    return {
      likes: res.data.likes,
      popularity: res.data.popularity,
      pubPoints: res.data.pubPoints,
    };
  } catch {
    return { likes: '?', popularity: '?', pubPoints: '?' };
  }
}

// --- Construcción recursiva del grafo ---
async function buildGraph(pkg, parentNodeId = null, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return;
  if (visitedPackages.has(pkg)) return;
  visitedPackages.add(pkg);

  // Obtener versión y dependencias
  let version;
  try {
    version = await getLatestVersion(pkg);
  } catch (err) {
    console.error(`No se pudo obtener versión de ${pkg}`, err);
    return;
  }

  // Obtener métricas (para tooltip)
  const metrics = await getMetrics(pkg);
  nodesData.set(pkg, { name: pkg, version, ...metrics });

  // Agregar nodo (más tarde lo renderizamos con vis)
  // (la red se actualizará después de construir todo el grafo)

  const deps = await getDependencies(pkg, version);
  for (const dep of deps) {
    // Agregar arista entre pkg y dep
    if (!visitedPackages.has(dep)) {
      await buildGraph(dep, pkg, depth + 1, maxDepth);
    }
  }
}

// --- Renderizado con vis-network ---
function renderGraph(rootPackage) {
  const nodes = [];
  const edges = [];

  // Construir nodos a partir de nodesData y visitedPackages
  for (const pkg of visitedPackages) {
    const info = nodesData.get(pkg);
    const tooltip = `
        ${info.name}
        Versión: ${info.version}
        👍 Likes: ${info.likes}
        📊 Popularidad: ${info.popularity}
        🧪 Pub Points: ${info.pubPoints}
    `;
    nodes.push({
      id: pkg,
      label: pkg,
      title: tooltip, // vis-network usa 'title' para tooltip HTML
      shape: 'box',
      font: { size: 12 },
    });
  }

  // Construir aristas (necesitamos registrar las relaciones durante el build)
  // Para simplificar, volveremos a recorrer los paquetes y pedir dependencias
  // (mejor: durante buildGraph guardar edges en un array)
  // Como buildGraph ya recorrió todo, podemos reconstruir edges desde cero:
  (async () => {
    for (const pkg of visitedPackages) {
      const version = await getLatestVersion(pkg);
      const deps = await getDependencies(pkg, version);
      for (const dep of deps) {
        if (visitedPackages.has(dep)) {
          edges.push({ from: pkg, to: dep, arrows: 'to' });
        }
      }
    }
    // Renderizar red
    const container = networkContainer.value;
    if (!container) return;

    const data = {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges),
    };
    const options = {
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
      physics: { stabilization: true, barnesHut: { gravitationalConstant: -8000 } },
      interaction: { hover: true, tooltipDelay: 200 },
    };
    if (network) network.destroy();
    network = new Network(container, data, options);
  })();
}

// --- Cargador principal ---
async function loadGraph() {
  if (!packageName.value.trim()) return;
  loading.value = true;
  error.value = '';
  visitedPackages.clear();
  nodesData.clear();

  try {
    await buildGraph(packageName.value.trim(), null, 0, 3); // Profundidad máxima 3
    if (visitedPackages.size === 0) {
      error.value = 'No se encontraron dependencias o el paquete no existe.';
    } else {
      renderGraph(packageName.value);
    }
  } catch (err) {
    console.error(err);
    error.value = 'Error al cargar el gráfico. Revisa la consola.';
  } finally {
    loading.value = false;
  }
}

// Limpiar red al desmontar
onUnmounted(() => {
  if (network) network.destroy();
});
</script>