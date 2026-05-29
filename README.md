# Reddit GitHub Pages

靜態頁面：`index.html`

功能：
- 顯示 `r/MSI_Gaming`、`r/buildapc`、`r/asusrog`、`r/pcmasterrace`
- 每區列出近 48 小時內 score 最高的 5 篇
- 頁面優先讀取同 repo 的 `data.json`
- GitHub Action 每小時更新一次 `data.json`

必要設定：
1. 到 Reddit 建立 app：https://www.reddit.com/prefs/apps
2. 類型選 `script`
3. 在 GitHub repo 加入 Secrets：
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
4. 到 Actions 手動執行 `Update Reddit Data`
5. GitHub Pages 指向 repo root

若沒有設定 Reddit Secrets，Reddit 通常會擋匿名請求，頁面就會沒有資料。
