/**
 * Plan-8 Layout: Site & Inventory Configuration
 * =============================================
 * Edit this file to update plot availability, pricing, contact details,
 * and enquiry form destination. Changes reflect immediately on deploy or refresh.
 */
window.PLAN8_CONFIG = {
  // Shown in the header, browser tab, social cards, and plot modals
  project: "Plan-8 Layout",
  subtitle: "Residential plotted layout · 61 sites",

  // Plot availability: move plot numbers between arrays to change status.
  // Any plot number from 1 to 61 not listed in booked/sold/na is treated as available.
  status: {
    available: [3, 4, 6, 9, 12, 13, 14, 18, 20, 24, 27, 28, 32, 33, 38, 40, 41, 45, 47, 49, 52, 53, 55, 57, 59, 60],
    booked:    [7, 10, 17, 25, 34, 42, 46, 54, 61],
    sold:      [1, 2, 5, 8, 11, 15, 16, 19, 21, 22, 23, 26, 29, 30, 31, 35, 36, 37, 39, 43, 44, 48, 50, 51, 56, 58],
    na:        []
  },

  // Optional pricing (in INR):
  // Set rate per sq.ft (e.g. 4200) to auto-calculate price for every plot...
  pricePerSqft: null,
  // ...or specify custom prices for specific plots (overrides rate per sq.ft)
  prices: {
    // 24: 6300000,
  },
  // Corner plot premium percentage (e.g. 10 for +10%)
  cornerPremiumPct: 0,

  // Direct contact buttons in plot sheets. Leave empty to hide.
  contact: {
    phone: "",            // e.g. "+91 98450 00000"
    whatsapp: "",         // digits with country code, e.g. "919845000000"
    email: ""             // e.g. "sales@example.com"
  },

  // Enquiry endpoint:
  // - Defaults to "/api/enquiry" (included Vercel Serverless Function)
  // - Or your Formspree endpoint (e.g. "https://formspree.io/f/xxxx")
  // - Or Google Apps Script web app
  // - Leave empty to run in client demo mode
  enquiryEndpoint: "/api/enquiry"
};
