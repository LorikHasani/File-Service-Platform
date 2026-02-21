import { useState, useEffect, useRef } from 'react';

interface Option {
  value: string;
  label: string;
}

/**
 * Vehicle data structure (from vehicle-data.json):
 * {
 *   "BMW": {                          // Make (Car)
 *     "3 Series": {                   // Model (Brand)
 *       "generations": {
 *         "E90 (2005-2012)": {        // Generation
 *           "engines": {
 *             "320d 2.0 177hp": {     // Engine
 *               "ecus": ["Bosch EDC17CP02", ...]  // ECUs
 *             }
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 */

interface VehicleTree {
  [make: string]: {
    [model: string]: {
      generations: {
        [gen: string]: {
          engines: {
            [eng: string]: {
              ecus: string[];
            };
          };
        };
      };
    };
  };
}

export function useVehicleApi() {
  const [data, setData] = useState<VehicleTree | null>(null);

  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState('');
  const [selectedEngine, setSelectedEngine] = useState('');
  const [selectedEcu, setSelectedEcu] = useState('');

  const [loadingMakes, setLoadingMakes] = useState(true);

  // Load static JSON once on mount
  useEffect(() => {
    fetch('/vehicle-data.json')
      .then((r) => r.json())
      .then((d: VehicleTree) => setData(d))
      .catch((e) => console.error('Failed to load vehicle data:', e))
      .finally(() => setLoadingMakes(false));
  }, []);

  // Reset downstream selections when upstream changes
  useEffect(() => { setSelectedModel(''); }, [selectedMake]);
  useEffect(() => { setSelectedGeneration(''); }, [selectedModel]);
  useEffect(() => { setSelectedEngine(''); }, [selectedGeneration]);
  useEffect(() => { setSelectedEcu(''); }, [selectedEngine]);

  // Derive options from static data
  const makes: Option[] = data
    ? Object.keys(data).sort().map((m) => ({ value: m, label: m }))
    : [];

  const models: Option[] = (data && selectedMake && data[selectedMake])
    ? Object.keys(data[selectedMake]).sort().map((m) => ({ value: m, label: m }))
    : [];

  const generations: Option[] = (data && selectedMake && selectedModel && data[selectedMake]?.[selectedModel]?.generations)
    ? Object.keys(data[selectedMake][selectedModel].generations).sort().map((g) => ({ value: g, label: g }))
    : [];

  const engines: Option[] = (data && selectedMake && selectedModel && selectedGeneration
    && data[selectedMake]?.[selectedModel]?.generations?.[selectedGeneration]?.engines)
    ? Object.keys(data[selectedMake][selectedModel].generations[selectedGeneration].engines).sort().map((e) => ({ value: e, label: e }))
    : [];

  const ecus: Option[] = (data && selectedMake && selectedModel && selectedGeneration && selectedEngine
    && data[selectedMake]?.[selectedModel]?.generations?.[selectedGeneration]?.engines?.[selectedEngine]?.ecus)
    ? data[selectedMake][selectedModel].generations[selectedGeneration].engines[selectedEngine].ecus
        .sort()
        .map((e) => ({ value: e, label: e }))
    : [];

  return {
    selectedMake, selectedModel, selectedGeneration, selectedEngine, selectedEcu,
    setSelectedMake, setSelectedModel, setSelectedGeneration, setSelectedEngine, setSelectedEcu,
    makes, models, generations, engines, ecus,
    loadingMakes,
    loadingModels: false,
    loadingGenerations: false,
    loadingEngines: false,
    loadingEcus: false,
  };
}
