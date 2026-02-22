import { mkdirSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";

/**
 * ONE-TIME DATA DUMP SCRIPT
 *
 * Run this ONCE while your CarDataApi is running locally.
 * It fetches all vehicle data and saves it as a static JSON file.
 * After that, you never need to run the API again.
 *
 * Usage:
 *   1. Start the CarDataApi:  cd CarDataApi && dotnet run
 *   2. Run this script:       node scripts/dump-vehicle-data.js
 *   3. Done! The frontend will use the static JSON from now on.
 */

const API = process.env.API_URL || "https://localhost:44352";

// Allow self-signed certs for localhost
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function fetchJson(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

async function main() {
  console.log("=".repeat(55));
  console.log("  CarDataApi → Static JSON Dump");
  console.log("  API:", API);
  console.log("=".repeat(55));

  // 1. Get all cars (makes)
  console.log("\n[1/5] Fetching makes (cars)...");
  const cars = await fetchJson("/api/cars");
  console.log(`  Found ${cars.length} makes`);

  const tree = {};

  // 2. For each car, get brands (models)
  console.log("[2/5] Fetching models (brands)...");
  let totalModels = 0;
  for (const car of cars) {
    const brands = await fetchJson(`/api/brands/bycar/${car.id}`);
    tree[car.name] = {};
    for (const brand of brands) {
      tree[car.name][brand.name] = { _brandId: brand.id, generations: {} };
    }
    totalModels += brands.length;
    process.stdout.write(`  ${car.name}: ${brands.length} models\r\n`);
  }
  console.log(`  Total: ${totalModels} models`);

  // 3. For each brand, get generations
  console.log("[3/5] Fetching generations...");
  let totalGens = 0;
  for (const carName of Object.keys(tree)) {
    for (const modelName of Object.keys(tree[carName])) {
      const brandId = tree[carName][modelName]._brandId;
      const gens = await fetchJson(`/api/generations/bybrand/${brandId}`);
      for (const gen of gens) {
        tree[carName][modelName].generations[gen.name] = {
          _genId: gen.id,
          engines: {},
        };
      }
      totalGens += gens.length;
    }
  }
  console.log(`  Total: ${totalGens} generations`);

  // 4. For each generation, get engines
  console.log("[4/5] Fetching engines...");
  let totalEngines = 0;
  for (const carName of Object.keys(tree)) {
    for (const modelName of Object.keys(tree[carName])) {
      for (const genName of Object.keys(tree[carName][modelName].generations)) {
        const genId = tree[carName][modelName].generations[genName]._genId;
        const engines = await fetchJson(`/api/engines/bygeneration/${genId}`);
        for (const eng of engines) {
          tree[carName][modelName].generations[genName].engines[eng.name] = {
            _engId: eng.id,
            ecus: [],
          };
        }
        totalEngines += engines.length;
      }
    }
  }
  console.log(`  Total: ${totalEngines} engines`);

  // 5. For each engine, get ECUs
  console.log("[5/5] Fetching ECUs...");
  let totalEcus = 0;
  for (const carName of Object.keys(tree)) {
    for (const modelName of Object.keys(tree[carName])) {
      for (const genName of Object.keys(tree[carName][modelName].generations)) {
        for (const engName of Object.keys(
          tree[carName][modelName].generations[genName].engines,
        )) {
          const engId =
            tree[carName][modelName].generations[genName].engines[engName]
              ._engId;
          const ecus = await fetchJson(`/api/ecus/byengine/${engId}`);
          tree[carName][modelName].generations[genName].engines[engName].ecus =
            ecus.map((e) => e.name);
          totalEcus += ecus.length;
        }
      }
    }
  }
  console.log(`  Total: ${totalEcus} ECUs`);

  // Clean up internal IDs from tree
  function cleanTree(obj) {
    if (Array.isArray(obj)) return obj;
    if (typeof obj !== "object" || obj === null) return obj;
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("_")) continue;
      cleaned[k] = cleanTree(v);
    }
    return cleaned;
  }

  const cleanData = cleanTree(tree);

  // Save to public folder
  const outPath = join(process.cwd(), "public", "vehicle-data.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(cleanData, null, 2));

  const stats = statSync(outPath);
  console.log("\n" + "=".repeat(55));
  console.log("  DONE!");
  console.log(`  Makes:       ${cars.length}`);
  console.log(`  Models:      ${totalModels}`);
  console.log(`  Generations: ${totalGens}`);
  console.log(`  Engines:     ${totalEngines}`);
  console.log(`  ECUs:        ${totalEcus}`);
  console.log(`  File:        ${outPath}`);
  console.log(`  Size:        ${(stats.size / 1024).toFixed(1)} KB`);
  console.log("=".repeat(55));
  console.log("\n  You can now stop the CarDataApi — you won't need it again!");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  console.error("\nMake sure the CarDataApi is running:");
  console.error("  cd CarDataApi && dotnet run");
  process.exit(1);
});
