# Shubhsitedeveloper

Cinematic websites, 3D sites, apps and marketing for growing Indian businesses.

Live: https://shubhsitedeveloper.github.io/

Static site: `index.html`, `style.css`, `main.js`, `scene.js` (three.js hero). Libraries are bundled in `assets/`.

## Adding a customer review

Customers send reviews from the "Write a review" form. It opens WhatsApp with the review already written, so it reaches you first.

To publish a review, add it to `reviews.json` and commit. The site shows it automatically, with the average rating.

```json
[
  {
    "name": "Customer name",
    "business": "Business, City",
    "rating": 5,
    "text": "Their review, exactly as they wrote it.",
    "date": "Dec 2026",
    "project": "See their website",
    "url": "https://their-website.com"
  }
]
```

`project` and `url` are optional. Only add reviews from real clients, word for word.
