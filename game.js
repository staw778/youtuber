const SAVE_KEY = "youtuber_sub_sim_v2";
const EVENT_CD = 15000;

// 可直接在這裡修改兩個點擊升級價格
const CLICK_UPGRADES = {
  double: { cost: 100, multiplier: 2 },
  quad: { cost: 500, multiplier: 2 }
};

const MEDALS = [
  { key:"100k", threshold:100000, element:"medal100k" },
  { key:"1m", threshold:1000000, element:"medal1m" },
  { key:"10m", threshold:10000000, element:"medal10m" },
  { key:"50m", threshold:50000000, element:"medal50m" },
  { key:"100m", threshold:100000000, element:"medal100m" }
];

let youtubers = [];
let events = [];
let game = createDefaultGame();
let lastTick = Date.now();
let sessionStarted = false;
let hiddenAt = null;
let celebrationCanvas = null;
let celebrationCtx = null;
let celebrationParticles = [];
let celebrationFrame = null;
let celebrationInitialized = false;

function createDefaultGame(){
  return {
    channelName:"我的頻道",
    profileDataUrl:null,
    subscribers:0,
    clickLevel:1,
    doubleBought:false,
    quadBought:false,
    medals:{},
    youtubers:{},
    unlocked:{},
    lastEventAt:0,
    lastEventText:"你的人生充滿了未知的可能。",
    sessionOpen:true,
    lastSavedAt:Date.now(),
    darkMode:false
  };
}

const $ = id => document.getElementById(id);

function format(n){
  if (!Number.isFinite(n)) return "0";
  return Math.floor(n).toLocaleString("zh-TW");
}

function save(){
  game.lastSavedAt = Date.now();
  game.sessionOpen = true;
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}

function loadSave(){
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw) return;
  try{
    const saved = JSON.parse(raw);
    game = {...createDefaultGame(), ...saved};
    game.youtubers = saved.youtubers || {};
    game.unlocked = saved.unlocked || {};
    game.medals = saved.medals || {};
    // 關閉/重新整理後，不追算離線時間
    game.sessionOpen = true;
    game.lastSavedAt = Date.now();
    game.darkMode = !!saved.darkMode;
  }catch(e){
    console.error("存檔讀取失敗",e);
  }
}

async function loadData(){
  const [ytRes,eventRes] = await Promise.all([
    fetch("youtubers.json"),
    fetch("events.json")
  ]);
  youtubers = await ytRes.json();
  events = await eventRes.json();
}

function getLevel(id){
  return Number(game.youtubers[id] || 0);
}

function getCost(yt){
  // Cookie Clicker 式價格：原始價格 * 1.15^目前等級
  return Math.ceil(yt.cost * Math.pow(1.15, getLevel(yt.id)));
}

function getCps(){
  return youtubers.reduce((sum,yt)=>sum + yt.cps * getLevel(yt.id),0);
}

function getClickPower(){
  return game.clickLevel;
}

function addSubscribers(amount){
  game.subscribers += amount;
  if(game.subscribers < 0) game.subscribers = 0;
  checkPermanentUnlocks();
  updateUI();
  save();
}

function checkPermanentUnlocks(){
  const newlyUnlockedMedals = [];
  for(const yt of youtubers){
    // 「錢夠過」一次就永久解鎖，不要求真的購買
    if(!game.unlocked[yt.id] && game.subscribers >= getCost(yt)){
      game.unlocked[yt.id] = true;
    }
  }
  for(const medal of MEDALS){
    if(game.subscribers >= medal.threshold){
      if(!game.medals[medal.key] && celebrationInitialized){
        newlyUnlockedMedals.push(medal);
      }
      game.medals[medal.key] = true;
    }
  }
  for(const medal of newlyUnlockedMedals){
    playMedalCelebration(medal);
  }
}

function initCelebrationCanvas(){
  celebrationCanvas = document.createElement("canvas");
  celebrationCanvas.id = "celebrationCanvas";
  celebrationCanvas.className = "celebration-canvas";
  document.body.prepend(celebrationCanvas);
  celebrationCtx = celebrationCanvas.getContext("2d");
  resizeCelebrationCanvas();
  window.addEventListener("resize", resizeCelebrationCanvas);
}

function resizeCelebrationCanvas(){
  if(!celebrationCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  celebrationCanvas.width = Math.floor(window.innerWidth*dpr);
  celebrationCanvas.height = Math.floor(window.innerHeight*dpr);
  celebrationCanvas.style.width = `${window.innerWidth}px`;
  celebrationCanvas.style.height = `${window.innerHeight}px`;
  celebrationCtx.setTransform(dpr,0,0,dpr,0,0);
}

function playMedalCelebration(medal){
  if(!celebrationCtx) return;

  const w=window.innerWidth, h=window.innerHeight;
  // 背景慶祝：避開主要文字區，分布在畫面上方與兩側。
  const bursts=[
    {x:w*0.16,y:h*0.18},
    {x:w*0.50,y:h*0.12},
    {x:w*0.82,y:h*0.20}
  ];

  for(const b of bursts){
    for(let i=0;i<42;i++){
      const angle=(Math.PI*2*i/42)+Math.random()*0.22;
      const speed=2.2+Math.random()*5.8;
      celebrationParticles.push({
        type:"spark", x:b.x, y:b.y,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed-1.0,
        life:55+Math.random()*35, maxLife:90,
        size:2+Math.random()*3.5, alpha:1, hue:Math.random()*360
      });
    }
  }

  // 緞帶從上方落下，不蓋住主要 UI。
  for(let i=0;i<70;i++){
    celebrationParticles.push({
      type:"ribbon",
      x:Math.random()*w, y:-10-Math.random()*80,
      vx:(Math.random()-.5)*1.8,
      vy:1.2+Math.random()*2.5,
      life:130+Math.random()*80, maxLife:210,
      size:3+Math.random()*4, alpha:1,
      hue:Math.random()*360, phase:Math.random()*Math.PI*2
    });
  }

  if(!celebrationFrame) celebrationFrame=requestAnimationFrame(drawCelebration);
}

function drawCelebration(){
  if(!celebrationCtx) return;
  const ctx=celebrationCtx;
  ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
  celebrationParticles=celebrationParticles.filter(p=>p.life>0);
  for(const p of celebrationParticles){
    p.life--;
    p.x+=p.vx; p.y+=p.vy;
    if(p.type==="spark"){
      p.vy+=0.08;
      ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
      ctx.fillStyle=`hsl(${p.hue},90%,60%)`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    }else{
      p.vy+=0.035; p.phase+=0.18;
      p.x+=Math.sin(p.phase)*0.8;
      ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
      ctx.strokeStyle=`hsl(${p.hue},90%,60%)`; ctx.lineWidth=p.size; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-10,p.y+18); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  if(celebrationParticles.length){ celebrationFrame=requestAnimationFrame(drawCelebration); }
  else { celebrationFrame=null; ctx.clearRect(0,0,window.innerWidth,window.innerHeight); }
}

function renderYoutubers(){
  const list = $("youtuberList");
  list.innerHTML = "";
  for(const yt of youtubers){
    const row = document.createElement("div");
    row.className = "youtuber";
    row.dataset.id = yt.id;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.innerHTML = `
      <img class="yt-image" alt="">
      <div class="yt-main"><div class="yt-name"></div><div class="yt-cost"></div></div>
      <div class="yt-level"></div>
      <div class="yt-tooltip"></div>`;
    list.appendChild(row);
  }
  updateYoutuberListUI();
}

function updateYoutuberListUI(){
  const list = $("youtuberList");
  if(!list) return;
  youtubers.forEach((yt,index)=>{
    const row=list.children[index];
    if(!row) return;
    const level=getLevel(yt.id);
    const cost=getCost(yt);
    const canBuy=game.subscribers>=cost;
    const revealed=!!game.unlocked[yt.id];
    row.className="youtuber"+(level===0?" unowned":"");
    const imageEl = row.querySelector(".yt-image");
    const desiredSrc = revealed ? yt.image : "assets/mystery.png";
    // 不要每次 updateUI 都重新指定 GIF 的 src，否則 GIF 會一直被重設到第一格。
    if(imageEl.getAttribute("src") !== desiredSrc){
      imageEl.src = desiredSrc;
    }
    imageEl.alt=revealed?yt.name:"???";
    row.querySelector(".yt-name").textContent=revealed?yt.name:"???";
    const costText=row.querySelector(".yt-cost");
    costText.className="yt-cost "+(canBuy?"can":"no");
    costText.textContent=format(cost);
    row.querySelector(".yt-level").textContent=level;
    row.querySelector(".yt-tooltip").textContent=`${format(yt.cps*level)} 訂閱 / 秒`;
  });
}

function buyYoutuber(id){
  const yt=youtubers.find(x=>x.id===id);
  if(!yt) return;
  const cost=getCost(yt);
  if(game.subscribers<cost){ showToast("訂閱數不足"); return; }
  game.subscribers-=cost;
  game.youtubers[id]=getLevel(id)+1;
  game.unlocked[id]=true;
  updateUI();
  save();
}

function buyClickUpgrade(type){
  const upgrade = CLICK_UPGRADES[type];
  const boughtKey = type === "double" ? "doubleBought" : "quadBought";
  if(!upgrade) return;
  if(game[boughtKey]){ showToast("這個升級已經購買"); return; }
  if(game.subscribers < upgrade.cost){
    showToast(`訂閱數不足，需要 ${format(upgrade.cost)} 訂閱`);
    return;
  }

  game.subscribers -= upgrade.cost;
  game[boughtKey] = true;
  game.clickLevel *= upgrade.multiplier;
  updateUI();
  save();
}

function applyTheme(){
  document.body.classList.toggle("dark-mode",!!game.darkMode);
  const button=$("themeToggle");
  if(button){button.textContent=game.darkMode?"☀":"☾";button.title=game.darkMode?"切換成白色模式":"切換成深色模式";}
}
function toggleTheme(){game.darkMode=!game.darkMode;applyTheme();save();}

function renderClickUpgrades(){
  const d = $("doubleClick");
  const q = $("quadClick");
  if(!d || !q) return;

  d.classList.toggle("bought", !!game.doubleBought);
  q.classList.toggle("bought", !!game.quadBought);

  const dPrice = d.querySelector("em");
  const qPrice = q.querySelector("em");
  if(dPrice){
    dPrice.textContent = game.doubleBought ? "已購買" : `${format(CLICK_UPGRADES.double.cost)} 訂閱`;
  }
  if(qPrice){
    qPrice.textContent = game.quadBought ? "已購買" : `${format(CLICK_UPGRADES.quad.cost)} 訂閱`;
  }
}

function updateUI(){
  applyTheme();
  $("channelName").value = game.channelName;
  $("subscriberCount").textContent = format(game.subscribers);
  $("cps").textContent = format(getCps());
  $("eventText").textContent = game.lastEventText;

  if(game.profileDataUrl){
    $("profileImage").src = game.profileDataUrl;
  }

  renderClickUpgrades();
  const ytList = $("youtuberList");
  if(ytList.children.length !== youtubers.length){
    renderYoutubers();
  }else{
    updateYoutuberListUI();
  }
  renderMedals();
  updateEventButton();
}

function renderMedals(){
  for(const medal of MEDALS){
    const img = $(medal.element).parentElement;
    img.classList.toggle("unlocked",!!game.medals[medal.key]);
  }
}

function showClickNumber(amount,x,y){
  const el = document.createElement("div");
  el.className = "float-number";
  el.textContent = `+${amount}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),800);
}

$("subscribeButton").addEventListener("click",(e)=>{
  const power = getClickPower();
  addSubscribers(power);
  showClickNumber(power,e.clientX,e.clientY - 20);
});

$("doubleClick").addEventListener("click",()=>buyClickUpgrade("double"));
$("quadClick").addEventListener("click",()=>buyClickUpgrade("quad"));

$("channelName").addEventListener("input",()=>{
  game.channelName = $("channelName").value || "我的頻道";
  fitChannelName();
  save();
});

function fitChannelName(){
  const input = $("channelName");
  let size = Math.min(45, Math.max(20, window.innerWidth * .033));
  input.style.fontSize = `${size}px`;
  while(input.scrollWidth > input.clientWidth && size > 18){
    size -= 1;
    input.style.fontSize = `${size}px`;
  }
}
window.addEventListener("resize",fitChannelName);

$("profileInput").addEventListener("change",()=>{
  const file = $("profileInput").files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = ()=>{
    game.profileDataUrl = reader.result;
    updateUI();
    save();
  };
  reader.readAsDataURL(file);
});

$("profileImage").addEventListener("click",()=> $("profileInput").click());

function chooseEvent(){
  const now = Date.now();
  if(now - game.lastEventAt < EVENT_CD){
    return;
  }

  if(!events.length) return;

  const total = events.reduce((s,e)=>s+(e.weight ?? 1),0);
  let r = Math.random()*total;
  let event = events[events.length-1];

  for(const e of events){
    r -= e.weight ?? 1;
    if(r <= 0){ event=e; break; }
  }

  // 事件是「總訂閱數的百分比」變化，而不是固定數字。
  // 例如目前 10,000 訂閱，抽到 -5% 就會變成 -500。
  const percent = Math.floor(
    Math.random() * (event.max - event.min + 1)
  ) + event.min;

  const signedPercent = event.sign === "negative" ? -percent : percent;
  const amount = Math.round(game.subscribers * signedPercent / 100);

  game.subscribers += amount;
  if(game.subscribers < 0) game.subscribers=0;

  game.lastEventAt = now;
  const percentText = `${signedPercent > 0 ? "+" : ""}${signedPercent}%`;
  const amountText = `${amount >= 0 ? "+" : ""}${format(amount)}`;
  game.lastEventText = event.text
    .replaceAll("{percent}", percentText)
    .replaceAll("{amount}", amountText);

  checkPermanentUnlocks();
  updateUI();
  save();
}

function updateEventButton(){
  const elapsed = Date.now() - game.lastEventAt;
  const remaining = Math.max(0,EVENT_CD-elapsed);
  const button = $("eventButton");
  const fill = $("eventFill");
  const text = button.querySelector(".event-button-text");

  if(remaining > 0){
    button.classList.add("cooldown");
    fill.style.width = `${(remaining/EVENT_CD)*100}%`;
    text.textContent = `冷卻 ${Math.ceil(remaining/1000)} 秒`;
  }else{
    button.classList.remove("cooldown");
    fill.style.width = "0%";
    text.textContent = "抽事件卡";
  }
}
$("eventButton").addEventListener("click",chooseEvent);

function tick(){
  const now = Date.now();
  const delta = Math.max(0,now-lastTick);
  lastTick = now;

  // 每秒 CPS；用實際經過時間，不依賴 setInterval 是否被瀏覽器降速
  const cps = getCps();
  if(cps > 0 && delta > 0){
    game.subscribers += cps * (delta/1000);
    checkPermanentUnlocks();
  }

  updateUI();
  save();
}

function startGameLoop(){
  lastTick = Date.now();
  setInterval(tick,250);
}

// 分頁/視窗切出去：回來時補算隱藏期間
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    hiddenAt = Date.now();
    lastTick = Date.now();
    save();
  }else{
    const now = Date.now();
    // 只有同一個頁面生命週期的 hidden -> visible 才補算
    if(hiddenAt !== null){
      const delta = Math.max(0,now-hiddenAt);
      const cps = getCps();
      if(cps > 0){
        game.subscribers += cps*(delta/1000);
        checkPermanentUnlocks();
      }
      hiddenAt = null;
      lastTick = now;
      updateUI();
      save();
    }else{
      lastTick = now;
    }
  }
});

// 瀏覽器視窗最小化/背景情況，時間戳仍會讓下一次 tick 補回
window.addEventListener("focus",()=>{
  const now=Date.now();
  const delta=Math.max(0,now-lastTick);
  if(delta>1000){
    const cps=getCps();
    game.subscribers += cps*(delta/1000);
    checkPermanentUnlocks();
    updateUI();
    save();
  }
  lastTick=now;
});

window.addEventListener("beforeunload",()=>{
  // 關閉頁面時只保存狀態，不保存「應該繼續累積」的離線時間
  game.sessionOpen=false;
  game.lastSavedAt=Date.now();
  localStorage.setItem(SAVE_KEY,JSON.stringify(game));
});

$("deleteGame").addEventListener("click",()=>{
  if(!confirm("確定要刪除全部遊戲紀錄嗎？")){
    return;
  }
  try {
    localStorage.removeItem(SAVE_KEY);
    sessionStorage.removeItem(SAVE_KEY);
  } catch(e) {
    console.error("刪除存檔失敗", e);
  }
  game = createDefaultGame();
  location.reload();
});

$("themeToggle").addEventListener("click", toggleTheme);

// YouTuber ScrollView：原生滾輪 + 滑鼠拖曳。
// 不使用 pointer capture，避免與 row 的購買 click 衝突。
const ytList=$("youtuberList");
let scrollDrag={active:false,startY:0,startScroll:0,moved:false,suppressClick:false};

ytList.addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse" && e.button!==0) return;
  scrollDrag.active=true;
  scrollDrag.startY=e.clientY;
  scrollDrag.startScroll=ytList.scrollTop;
  scrollDrag.moved=false;
  scrollDrag.suppressClick=false;
});

document.addEventListener("pointermove",e=>{
  if(!scrollDrag.active) return;
  const dy=e.clientY-scrollDrag.startY;
  if(Math.abs(dy)>5){scrollDrag.moved=true;scrollDrag.suppressClick=true;}
  if(scrollDrag.moved) ytList.scrollTop=scrollDrag.startScroll-dy;
});

document.addEventListener("pointerup",()=>{
  if(!scrollDrag.active) return;
  scrollDrag.active=false;
  if(scrollDrag.suppressClick){ setTimeout(()=>scrollDrag.suppressClick=false,50); }
});
document.addEventListener("pointercancel",()=>{scrollDrag.active=false;scrollDrag.suppressClick=false;});

ytList.addEventListener("click",e=>{
  if(scrollDrag.suppressClick){e.preventDefault();e.stopPropagation();scrollDrag.suppressClick=false;return;}
  const row=e.target.closest(".youtuber");
  if(row && ytList.contains(row)) buyYoutuber(row.dataset.id);
});
ytList.addEventListener("keydown",e=>{
  if(e.key!=="Enter" && e.key!==" ") return;
  const row=e.target.closest(".youtuber");
  if(!row) return;
  e.preventDefault();
  buyYoutuber(row.dataset.id);
});
ytList.addEventListener("dragstart",e=>e.preventDefault());

function showToast(text){
  const toast=$("toast");
  toast.textContent=text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.classList.remove("show"),1200);
}

async function init(){
  try{
    await loadData();
    loadSave();
    initCelebrationCanvas();
    // 先同步已存在的永久解鎖，不在載入存檔時播放慶祝。
    celebrationInitialized = false;
    checkPermanentUnlocks();
    // 從這裡開始，之後新達成的獎牌才會觸發慶祝。
    celebrationInitialized = true;
    updateUI();
    fitChannelName();
    startGameLoop();
  }catch(e){
    console.error(e);
    $("eventText").textContent="資料載入失敗，請使用 Web Server 開啟此遊戲。";
  }
}

init();
