/**
 * Centralized wallpaper category configuration.
 *
 * Every category the app currently supports lives in this one array.
 * Adding a new category later means adding one object here — no route,
 * service, or provider file needs to change, per the "must be easy to
 * add categories later" requirement.
 *
 * `search_query` is what actually gets sent to the four providers when
 * a category is browsed (routes/categories.js uses it via
 * wallpaperSearch.searchWallpapers). It's kept separate from `keywords`
 * because `keywords` is the fuller, display-friendly list (useful for
 * chips/tags in the UI or for search suggestions), while `search_query`
 * is the specific, tuned string that gets the best provider results —
 * usually just the top keyword or two, not the whole list.
 *
 * `display` is presentation metadata only (no behavior depends on it)
 * so the frontend has something to render immediately without needing
 * its own hardcoded category-to-color mapping.
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string[]} keywords
 * @property {string} search_query
 * @property {{ color: string, icon: string }} display
 */

/** @type {Category[]} */
export const categories = [
  {
    id: "anime",
    name: "Anime",
    slug: "anime",
    keywords: ["anime wallpaper", "anime art", "manga art", "anime character"],
    search_query: "anime wallpaper",
    display: { color: "#FF6B9D", icon: "sparkles" },
  },
  {
    id: "dark",
    name: "Dark",
    slug: "dark",
    keywords: ["dark wallpaper", "black wallpaper", "dark aesthetic", "amoled"],
    search_query: "dark aesthetic wallpaper",
    display: { color: "#0A0A0A", icon: "moon" },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    slug: "cinematic",
    keywords: ["cinematic wallpaper", "movie scene", "film still", "dramatic lighting"],
    search_query: "cinematic wallpaper",
    display: { color: "#2B2D42", icon: "film" },
  },
  {
    id: "nature",
    name: "Nature",
    slug: "nature",
    keywords: ["nature wallpaper", "forest", "landscape", "wilderness"],
    search_query: "nature landscape wallpaper",
    display: { color: "#4CAF50", icon: "leaf" },
  },
  {
    id: "cars",
    name: "Cars",
    slug: "cars",
    keywords: ["car wallpaper", "sports car", "supercar", "car photography"],
    search_query: "sports car wallpaper",
    display: { color: "#E63946", icon: "car" },
  },
  {
    id: "space",
    name: "Space",
    slug: "space",
    keywords: ["space wallpaper", "galaxy", "nebula", "stars", "planets"],
    search_query: "galaxy space wallpaper",
    display: { color: "#1B1B3A", icon: "orbit" },
  },
  {
    id: "gaming",
    name: "Gaming",
    slug: "gaming",
    keywords: ["gaming wallpaper", "video game art", "game aesthetic", "esports"],
    search_query: "gaming wallpaper",
    display: { color: "#7B2CBF", icon: "gamepad" },
  },
  {
    id: "abstract",
    name: "Abstract",
    slug: "abstract",
    keywords: ["abstract wallpaper", "abstract art", "geometric pattern", "fluid art"],
    search_query: "abstract wallpaper",
    display: { color: "#F72585", icon: "shapes" },
  },
  {
    id: "architecture",
    name: "Architecture",
    slug: "architecture",
    keywords: ["architecture wallpaper", "building", "modern architecture", "skyline"],
    search_query: "architecture wallpaper",
    display: { color: "#6C757D", icon: "building" },
  },
  {
    id: "animals",
    name: "Animals",
    slug: "animals",
    keywords: ["animal wallpaper", "wildlife", "wild animals", "pets"],
    search_query: "wildlife animal wallpaper",
    display: { color: "#D68C45", icon: "paw-print" },
  },
  {
    id: "sports",
    name: "Sports",
    slug: "sports",
    keywords: ["sports wallpaper", "football", "basketball", "athlete"],
    search_query: "sports wallpaper",
    display: { color: "#118AB2", icon: "trophy" },
  },
  {
    id: "minimal",
    name: "Minimal",
    slug: "minimal",
    keywords: ["minimal wallpaper", "minimalist", "simple background", "clean design"],
    search_query: "minimalist wallpaper",
    display: { color: "#EDEDED", icon: "circle" },
  },
  {
    id: "neon",
    name: "Neon",
    slug: "neon",
    keywords: ["neon wallpaper", "neon lights", "cyberpunk", "glow aesthetic"],
    search_query: "neon lights wallpaper",
    display: { color: "#39FF14", icon: "zap" },
  },
  {
    id: "city",
    name: "City",
    slug: "city",
    keywords: ["city wallpaper", "cityscape", "urban", "skyline night"],
    search_query: "cityscape wallpaper",
    display: { color: "#3A0CA3", icon: "building-2" },
  },
  {
    id: "travel",
    name: "Travel",
    slug: "travel",
    keywords: ["travel wallpaper", "destination", "scenic view", "adventure"],
    search_query: "travel destination wallpaper",
    display: { color: "#FFB703", icon: "map" },
  },
  {
    id: "ocean",
    name: "Ocean",
    slug: "ocean",
    keywords: ["ocean wallpaper", "sea", "beach", "underwater", "waves"],
    search_query: "ocean wallpaper",
    display: { color: "#0077B6", icon: "waves" },
  },
  {
    id: "mountains",
    name: "Mountains",
    slug: "mountains",
    keywords: ["mountain wallpaper", "mountains", "peak", "alpine landscape"],
    search_query: "mountain landscape wallpaper",
    display: { color: "#495057", icon: "mountain" },
  },
  {
    id: "luxury",
    name: "Luxury",
    slug: "luxury",
    keywords: ["luxury wallpaper", "luxury lifestyle", "gold aesthetic", "premium"],
    search_query: "luxury aesthetic wallpaper",
    display: { color: "#C9A227", icon: "gem" },
  },
  {
    id: "technology",
    name: "Technology",
    slug: "technology",
    keywords: ["technology wallpaper", "tech", "circuit board", "futuristic tech"],
    search_query: "technology wallpaper",
    display: { color: "#00B4D8", icon: "cpu" },
  },
  {
    id: "photography",
    name: "Photography",
    slug: "photography",
    keywords: ["photography wallpaper", "photo art", "portrait photography"],
    search_query: "photography wallpaper",
    display: { color: "#212529", icon: "camera" },
  },
  {
    id: "fantasy",
    name: "Fantasy",
    slug: "fantasy",
    keywords: ["fantasy wallpaper", "fantasy art", "mythical", "magic aesthetic"],
    search_query: "fantasy art wallpaper",
    display: { color: "#5A189A", icon: "wand" },
  },
  {
    id: "art",
    name: "Art",
    slug: "art",
    keywords: ["art wallpaper", "digital art", "painting", "illustration"],
    search_query: "digital art wallpaper",
    display: { color: "#EF476F", icon: "palette" },
  },
];

/**
 * @returns {Category[]}
 */
export function getAllCategories() {
  return categories;
}

/**
 * @param {string} slug
 * @returns {Category|undefined}
 */
export function getCategoryBySlug(slug) {
  if (!slug) return undefined;
  const normalized = String(slug).toLowerCase().trim();
  return categories.find((category) => category.slug === normalized);
}

export default categories;
