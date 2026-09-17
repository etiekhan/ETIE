// Etie Phase 1 — mock data layer (not yet wired to UI, for Phase 2-4)
// Mirrors hardcoded values in ETIE draft 2.html so future logic uses one source of truth.
window.ETIE_MOCKS = {
  traveller: {
    id: "trav-etie",
    name: "Etie",
    age: 27,
    home: "Hong Kong",
    role: "traveller",
    interests: ["Football", "Salsa", "Cooking", "Thrift shopping"],
    personality: { social: 8, spontaneous: 8, curious: 10 },
    lookingFor: ["Coffee or drinks"],
    hook: "Play football, find a good salsa night, eat local food and see the city through someone's eyes."
  },
  trip: {
    id: "trip-lisbon-1",
    destination: "Lisbon",
    dates: "12–18 September",
    status: "planning",
    country: "PT"
  },
  locals: [
    {
      id: "local-marta",
      name: "Marta",
      age: 28,
      city: "Lisbon",
      nationality: "PT",
      interests: ["Salsa", "Cooking", "Tennis", "Surfing"],
      personality: { social: 10, spontaneous: 10, curious: 10 },
      offer: "I love showing visitors the Lisbon I actually live in — small salsa nights, neighbourhood markets and home cooking.",
      availability: ["Friday evening"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 18, reviews: 14, references: 3, rating: 4.9 }
    },
    {
      id: "local-javier",
      name: "Javier",
      age: 30,
      city: "Lisbon",
      nationality: "ES",
      interests: ["Football", "Cooking", "Music"],
      personality: { social: 8, spontaneous: 8, curious: 8 },
      offer: "I'll get you into our Sunday 5-a-side and cook together after.",
      offerTags: ["Football", "Cooking"],
      availability: ["Weekend afternoons"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 12, reviews: 9, references: 2, rating: 4.8 }
    },
    {
      id: "local-sofia",
      name: "Sofia",
      age: 26,
      city: "Lisbon",
      nationality: "PT",
      interests: ["Photography", "Food", "Salsa"],
      personality: { social: 8, spontaneous: 8, curious: 10 },
      offer: "My Lisbon is neighbourhood markets, photo walks and late dinners.",
      offerTags: ["Photography", "Food"],
      availability: ["Weekday evenings"],
      verification: { identity: true, local: true },
      stats: { travellersMet: 9, reviews: 7, references: 1, rating: 4.7 }
    }
  ]
};
