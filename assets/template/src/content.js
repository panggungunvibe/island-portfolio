import data from "./portfolio.json" with { type: "json" };
import { normalizePortfolio } from "./schema.js";
export const {profile, categories} = normalizePortfolio(data);
export const themes = {
  forest: {
    name: "森屿",
    english: "FOREST ISLAND",
    caption: "把好奇心，走成一座岛。",
    accent: "#3f7761",
    water: "#54bdc5",
    background: "#d5eef0",
  },
  desert: {
    name: "沙洲",
    english: "DESERT OASIS",
    caption: "在每一粒沙里，发现新的可能。",
    accent: "#aa6d3e",
    water: "#9bcfd0",
    background: "#f3e1cc",
  },
  ocean: {
    name: "浅海",
    english: "OCEAN GARDEN",
    caption: "潜入灵感，听见自己的回声。",
    accent: "#527ea4",
    water: "#5a9fc5",
    background: "#dce7f6",
  },
};
