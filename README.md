# Aire — Phase 3: AI Insights & Predictions

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Testing states (mock services)
Add a query string and reload, e.g. `/insights?mock=nopredict`

- Air quality: `error` · `flaky` · `stale` · `fast` · `partial` · `nopollutants` · `nohistory`
- Predictions: `predicterror` · `nopredict` · `noconfidence` · `nofactors` · `predictstale`

Full list: `src/services/mock.ts`. Real API/ML hookup points: `src/services/airQualityService.ts` and `src/services/predictionService.ts`.
