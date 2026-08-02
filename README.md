# 職業分類引き

仕事内容、分類名、コードから日本標準職業分類を探し、似た候補の説明と階層を比較する匿名Webサービスです。

- Production: <https://shokugyo-code.yhay81.com>
- Source: e-Stat「日本標準職業分類（平成21年［2009年］12月統計基準設定）」
- Dataset: 415 codes (12 major / 74 middle / 329 minor)
- Stack: Cloudflare Workers, Hono JSX, Vite+, D1, static JSON

```powershell
npm install
npm run data:build
npm run release:check
npm run check
npm test
npm run build
npm run dev
```

`npm run data:build`はe-Stat公開CSVを取得し、SHA-256、分類件数、階層、既知コードを検証します。検索と比較はブラウザ内で行い、仕事内容や選択分類をWorkerへ送りません。

```powershell
npx wrangler d1 migrations apply shokugyo-code --local
npx wrangler d1 migrations apply shokugyo-code --remote
npm run deploy
npm run metrics
npm run indexnow
```
