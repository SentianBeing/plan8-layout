# Plan-8 Layout · Interactive Plot Layout Website

An interactive 2D architectural site plan and inventory visualizer for **Plan-8 Layout** (61 residential plots). Ready for one-click deployment to **Vercel**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSentianBeing%2Fplan8-layout)

![Plan-8 Social Banner](public/og-banner.jpg)

---

## ✨ Features

- **Interactive 2D Site Plan**: Smooth pan and zoom with vector curbs, roads, trees, parks, and survey boundary markers.
- **Real-Time Plot Status**: Available (green), Booked (amber), Sold (red), or Reserved.
- **Dynamic Search & Filters**: Search plots by number, filter by status, facing (East, West, North, South), and plot dimensions (30×50, 30×40, odd sites).
- **Interactive Measurement Units**: Instant toggle between Metres and Feet & Inches, plus Survey No. overlays.
- **Plot Detail Cards & Vector Sketches**: Generates individual plot geometry with compass orientation, side lengths, area conversions (sq.ft, m², cents, guntas), and pricing.
- **Deep Linking & Sharing**: Deep links directly to any plot (e.g. `#plot-24`) with one-click clipboard link copying.
- **Instant Contact & Lead Capture**: Direct WhatsApp & Phone call buttons, plus built-in Enquiry form powered by Vercel Serverless Functions.
- **Mobile Responsive & Dark Mode**: Glassmorphism controls, responsive bottom sheet drawer on smartphones, docked panel on desktop.

---

## 🚀 How to Deploy to Vercel

You can deploy this project to Vercel in any of the following 3 ways:

### Option 1: Deploy with Vercel CLI (Fastest)

1. Open your terminal in this project folder:
   ```bash
   cd plan8-layout
   ```
2. Run the Vercel deployment command:
   ```bash
   npx vercel
   ```
3. Follow the 3 short prompts:
   - **Set up and deploy?** Press `y`
   - **Which scope?** Press `Enter` (selects your account)
   - **Link to existing project?** `N`
   - **What's your project's name?** Press `Enter` (or enter `plan8-layout`)
4. To deploy directly to production:
   ```bash
   npx vercel --prod
   ```

### Option 2: Deploy via GitHub (Recommended for Continuous Updates)

1. Initialize Git and commit the files (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Plan-8 Layout website"
   ```
2. Push this folder to a GitHub repository.
3. Go to [vercel.com/new](https://vercel.com/new).
4. Click **Import** next to your GitHub repository.
5. Vercel automatically detects the static / Vite configuration.
6. Click **Deploy**!

### Option 3: Drag & Drop on Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new).
2. Drag and drop the `plan8-layout` folder directly onto the Vercel dashboard.
3. Your website will be live in seconds with a free `.vercel.app` URL and free SSL certificate.

---

## 🛠️ How to Customize

All site inventory, pricing, and contact information is organized in a single file: **`js/config.js`**.

```javascript
window.PLAN8_CONFIG = {
  project: "Plan-8 Layout",
  subtitle: "Residential plotted layout · 61 sites",

  // 1. UPDATE AVAILABILITY: Move plot numbers between these lists
  status: {
    available: [3, 4, 6, 9, 12, 13, 14, 18, 20, 24, ...],
    booked:    [7, 10, 17, 25, 34, 42, ...],
    sold:      [1, 2, 5, 8, 11, 15, ...],
    na:        []
  },

  // 2. PRICING: Set a uniform rate per sq.ft or custom prices per plot
  pricePerSqft: 4200, // in INR
  prices: {
    24: 6500000 // custom price for Plot 24
  },
  cornerPremiumPct: 10, // +10% premium for corner plots

  // 3. CONTACT BUTTONS: Add your sales details (leave empty to hide)
  contact: {
    phone: "+91 98450 00000",
    whatsapp: "919845000000",
    email: "sales@example.com"
  },

  // 4. LEAD ENQUIRIES: Defaults to the included Vercel serverless function
  enquiryEndpoint: "/api/enquiry"
};
```

### Lead Notifications (Slack / Discord / Zapier / Google Sheets)

The website includes a serverless lead handler in `api/enquiry.js`. When a customer submits an enquiry:
- If you set a `WEBHOOK_URL` environment variable in your **Vercel Project Settings > Environment Variables**, every lead will be instantly forwarded to your Slack, Discord channel, or Zapier webhook!

---

## 💻 Local Development

To test and run the site locally:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

---

## 📁 Project Directory Structure

```text
plan8-layout/
├── index.html          # Semantic HTML5 entry page with SEO & OpenGraph tags
├── vercel.json         # Vercel deployment headers, caching & clean URLs
├── package.json        # NPM scripts for Vite dev server & production build
├── vite.config.js      # Vite build configuration
├── .gitignore          # Git ignore rules
├── README.md           # Deployment & configuration documentation
├── css/
│   └── style.css       # Design system, glassmorphism, responsive styles
├── js/
│   ├── config.js       # Client configuration (availability, pricing, contacts)
│   ├── plan-data.js    # Surveyor CAD coordinates, boundaries, roads, parks
│   └── app.js          # Interactive map engine, matrix transforms, modal & filters
├── api/
│   └── enquiry.js      # Vercel Serverless Function for lead form submissions
└── public/
    ├── favicon.svg     # Brand vector favicon
    ├── og-banner.jpg   # Social preview banner for WhatsApp, iMessage, Twitter
    └── site.webmanifest# PWA manifest
```
