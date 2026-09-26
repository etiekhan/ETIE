// Etie Phase 1 — mock data layer (not yet wired to UI, for Phase 2-4)
// Mirrors hardcoded values in ETIE draft 2.html so future logic uses one source of truth.
window.ETIE_MOCKS = {
  traveller: {
    id: "trav-etie",
    name: "Etie",
    age: 27,
    home: "Hong Kong",
    role: "traveller",
    interests: ["Football", "Salsa", "Cooking", "Thrift shopping", "Hookmaxxing"],
    personality: { social: 8, spontaneous: 8, curious: 10 },
    lookingFor: ["💎 Hidden Gems"],
    hook: "Play football, find a good salsa night, eat local food and see the city through someone's eyes."
  },
  trip: {
    id: "trip-hk-1",
    destination: "Hong Kong",
    dates: "12–18 September",
    status: "planning",
    country: "HK"
  },
  locals: [
    {
      id: "local-marta",
      name: "Ethan",
      age: 28,
      city: "Hong Kong",
      district: "Central / Soho",
      nationality: "HK",
      interests: ["🍸 Soho Speakeasies & Hidden Bars", "🥟 Dai Pai Dong & Late Night Eats", "📸 Wong Kar-wai & Neon Photo Walks", "🥾 Dragon's Back & Island Hikes"],
      personality: { social: 10, spontaneous: 10, curious: 10 },
      offer: "I know 3 hidden speakeasies in Soho tourists can't find on Google Maps",
      availability: ["Tonight / Today"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 18, reviews: 14, references: 3, rating: 4.9 },
      tier: "Host", hostedCount: 15
    },
    {
      id: "local-javier",
      name: "Chloe",
      age: 26,
      city: "Hong Kong",
      district: "Tsim Sha Tsui",
      nationality: "HK",
      interests: ["🥟 Dai Pai Dong & Late Night Eats", "🛍️ Mong Kok Vintage & Local Markets", "🥟 Dai Pai Dong Food Blitz", "Hookmaxxing"],
      personality: { social: 8, spontaneous: 8, curious: 8 },
      offer: "Dai Pai Dong Food Blitz — 5 stalls, 1 hour, no tourist menu",
      offerTags: ["Street Food", "Foodie Tours"],
      availability: ["Tonight / Today"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 12, reviews: 9, references: 2, rating: 4.8 }
    },
    {
      id: "local-sofia",
      name: "Kai",
      age: 25,
      city: "Hong Kong",
      district: "Mong Kok",
      nationality: "HK",
      interests: ["📸 Wong Kar-wai & Neon Photo Walks", "🛍️ Mong Kok Vintage & Local Markets", "🥾 Dragon's Back & Island Hikes", "☕ Sheung Wan Cafe Hopping"],
      personality: { social: 8, spontaneous: 8, curious: 10 },
      offer: "Mong Kok Neon Walk — capture the city that never sleeps",
      offerTags: ["Photo Walk"],
      availability: ["Tonight / Today"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 9, reviews: 7, references: 1, rating: 4.7 }
    }
  ]
};
