export const SEO_CONFIG = {
  defaultTitle: "Aroma Dhaba, IIM Mumbai - Online Store",
  defaultDescription: "Bestsellers · Maggi · Sandwich · Cold Drinks · Chaat · Shawarma · Biryani · Chinese Rice · Noodles · Paratha / Roti",
  siteUrl: "https://aromadhaba.in",
  campus: "IIM Mumbai",
  campusLocation: "Powai, Mumbai",
  phone: "+919892820940",
  categories: [
    "Bestsellers",
    "Maggi",
    "Sandwich",
    "Cold Drinks",
    "Chaat",
    "Shawarma",
    "Biryani",
    "Chinese Rice",
    "Noodles",
    "Paratha / Roti"
  ],
  keywords: [
    "Aroma Dhaba IIM Mumbai",
    "IIM Mumbai food delivery",
    "late night food IIM Mumbai",
    "Aroma Dhaba online store",
    "campus food delivery Mumbai",
    "Best food IIM Mumbai",
    "Dhaba food IIM Mumbai"
  ]
};

export const getRestaurantSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Aroma Dhaba",
  "alternateName": "Aroma Dhaba IIM Mumbai",
  "image": `${SEO_CONFIG.siteUrl}/logo.png`,
  "@id": SEO_CONFIG.siteUrl,
  "url": SEO_CONFIG.siteUrl,
  "telephone": SEO_CONFIG.phone,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "IIM Mumbai campus, Powai",
    "addressLocality": "Mumbai",
    "postalCode": "400087",
    "addressRegion": "Maharashtra",
    "addressCountry": "India"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 19.1312,
    "longitude": 72.9095
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "11:00",
      "closes": "23:59"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "00:00",
      "closes": "03:30"
    }
  ],
  "servesCuisine": "North Indian, Chinese, Fast Food, Street Food",
  "priceRange": "₹",
  "menu": `${SEO_CONFIG.siteUrl}/categories`,
  "acceptsReservations": "false",
  "hasMenu": {
    "@type": "Menu",
    "name": "Aroma Dhaba Menu",
    "hasMenuSection": SEO_CONFIG.categories.map(category => ({
      "@type": "MenuSection",
      "name": category,
      "description": `Delicious ${category} options from Aroma Dhaba`
    }))
  }
});
