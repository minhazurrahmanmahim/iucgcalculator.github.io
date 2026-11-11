# IU CGPA Calculator

Static website + installable app (PWA) for Islamic University students. No build step, no server.

## Folder structure
```
index.html
manifest.webmanifest
sw.js
css/style.css
js/data.js        <- faculties, departments, degrees, halls, grading scale (edit this)
js/app.js         <- all the logic
assets/logo.png   <- PUT THE IU LOGO HERE (PNG, any size, ideally square/transparent)
assets/icons/     <- app icons (replace with your own if you like, same file names/sizes)
```

## Run on GitHub Pages
1. Create a repository and upload **everything in this folder** (keep the folder structure).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)`.
3. Open `https://<username>.github.io/<repo>/`. Done.

Updating later: after changing any file, change `CACHE = 'iu-cgpa-v1'` in `sw.js` to `v2`, `v3` … so installed apps refresh.

## Editing lists
Open `js/data.js`:
- `faculties[].departments` – add / remove departments.
- `halls` – the hall dropdown.
- `degrees` – all degree options.
- `rules` – roll / registration digit rules.

## CGPA rules used (taken from the sample marksheets)
- PS = credit × GP, TPS = Σ PS
- EC = credits of passed courses
- CGPA = TPS ÷ total credits (failed courses stay in the divisor: 53.125 ÷ 20 = 2.66). Can be switched on the Courses tab.
- Remarks = highest scale entry not above the CGPA.

The printed page always carries the line "This is NOT a marksheet issued by the University administration."
