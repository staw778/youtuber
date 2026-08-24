# YouTuber 訂閱模擬器

## 檔案
- index.html：畫面
- style.css：外觀
- game.js：遊戲邏輯
- youtubers.json：YouTuber 名稱、初始價格、CPS、圖片路徑
- events.json：事件文字、正負訂閱數範圍、權重
- assets/：可替換圖片

## 開啟
因為遊戲需要 fetch JSON，建議不要直接雙擊 index.html。
如果有 Python，可在此資料夾開終端機：

python -m http.server 8000

再開：
http://localhost:8000/

也可以用 VS Code 的 Live Server。

## 可自訂圖片
把自己的圖片換成相同檔名即可：
assets/default_avatar.png
assets/mystery.png
assets/blue_finger.png
assets/red_finger.png
assets/medals/*.png
assets/youtubers/*.png

玩家大頭貼不是固定路徑，而是玩家在遊戲中選擇圖片後以 Data URL 保存到瀏覽器 localStorage。

## 事件
events.json 範例：
{
  "id": "good",
  "text": "你的影片爆紅，訂閱數 {percent}（{amount}）！",
  "min": 3,
  "max": 8,
  "sign": "positive",
  "weight": 50
}

min/max 是「百分比」，不是固定訂閱數。
negative 會產生 -3% 到 -8%。
positive 會產生 +3% 到 +8%。
{percent} 會顯示百分比，{amount} 會顯示實際增減的訂閱數。

例如目前有 10,000 訂閱，抽到 -5%，就會減少約 500。

## YouTuber 價格
購買價格：
原始價格 × 1.15 ^ 目前等級

例如原始價格 15：
Lv0 -> 15
Lv1 -> ceil(15 × 1.15)
Lv2 -> ceil(15 × 1.15^2)

## 存檔
localStorage 會記錄：
- 頻道名稱
- 玩家頭像
- 訂閱數
- 點擊等級
- ×2 / ×4 是否購買
- YouTuber 等級
- YouTuber 是否永久解鎖
- 已取得獎牌
- 最近一次事件與事件冷卻

關閉網頁後不會計算離線 CPS。
同一個頁面切到其他分頁/背景後再回來，會補算隱藏期間的 CPS。

## 最新 YouTuber CPS
放水 1 / 拇指通 5 / 勞葆 30 / 綠鬼叔叔 100 / 廠長聲名狼藉 500 / 阿灑英文 1000 / 人生肥宅x蹲 3000 / 歐洲董神 5000 / 銅蘭 9000 / Endy老師 25000 / 老矮與小莫 50000 / WhenFun何時爽 120000 / 野獸先生 1000000。

圖片格式：YouTuber 的 image 路徑可以直接使用 .png、.jpg、.webp 或 .gif。瀏覽器會依照檔案副檔名載入；如果是 GIF，<img> 會直接播放動畫，不需要額外程式。
例如：assets/youtubers/fangshui.gif
如果換成 assets/youtubers/fangshui.png，就會載入 PNG。
