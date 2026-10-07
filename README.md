# Cheezy — Build Your Own Pizza

A demo pizza-builder site. Pick a size, crust and sauce, drag toppings onto the pizza (or tap to drop one at a random spot), then place a fake order. No backend, no real orders.

## Features
- Drag-and-drop toppings with mouse, touch or pen; move them, or drag off the pizza / onto the trash to remove
- Undo (Ctrl/Cmd+Z), Clear, "Surprise me", up to 40 toppings
- Live price, quantity stepper, delivery fee (free over $25)
- Fun extras: Pizza Score, badges, 60-second Challenge mode, optional sound
- Order form with validation, confirmation dialog and success screen
- Pizza is saved in `localStorage`; respects `prefers-reduced-motion`

## Run it
Plain HTML/CSS/JS, no build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Icons load from the Lucide CDN, so an internet connection is needed for them.

## Structure
- `index.html` — page markup
- `styles.css` — site styles
- `app.js` — state, drag-and-drop, pricing, order flow
- `assets/` — pizza, ingredient and people images
- `_ds/` — Pizzalio design system tokens (colors, fonts, spacing)

To add a topping, add one line to `INGREDIENTS` in `app.js` plus an image in `assets/ingredients/`.
