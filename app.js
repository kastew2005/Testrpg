(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const KEY = "ash_kingdom_save_v1";
  const tg = window.Telegram?.WebApp || null;
  if (tg) {
    try {
      tg.ready(); tg.expand();
      tg.disableVerticalSwipes?.();
      tg.setHeaderColor?.("#10100e");
      tg.setBackgroundColor?.("#10100e");
      tg.requestFullscreen?.();
    } catch (e) { console.warn("Telegram API:", e); }
  }

  const RACES = {
    human:{name:"Человек",hp:100,mp:50,str:5,agi:3,luck:5,gold:35,passive:"Королевская закалка: +5% к удаче и больше золота в находках.",skill:"Королевский выпад",skillCost:10,bonus:"+5 силы, +5% удачи, +10 золота",weak:"Нет выраженной слабости."},
    elf:{name:"Эльф",hp:90,mp:75,str:2,agi:12,luck:3,gold:25,passive:"Лёгкий шаг: повышенный шанс уклониться от атаки.",skill:"Лунная стрела",skillCost:12,bonus:"+25 маны, +12 ловкости",weak:"Меньше здоровья."},
    orc:{name:"Орк",hp:135,mp:35,str:13,agi:1,luck:0,gold:20,passive:"Кровавая ярость: усиленные физические удары.",skill:"Сокрушительный удар",skillCost:8,bonus:"+35 здоровья, +13 силы",weak:"Меньше маны и удачи."},
    undead:{name:"Нежить",hp:100,mp:60,str:4,agi:4,luck:-5,gold:25,passive:"Вампиризм: 15% нанесённого урона возвращается в здоровье.",skill:"Проклятие могилы",skillCost:14,bonus:"Вампиризм, +10 маны",weak:"Низкая удача."}
  };
  const ZONES = [
    {name:"Сумрачный лес",level:1,enemy:["Лесной мародёр","Голодный волк","Падший страж"],color:"#35563a"},
    {name:"Затопленные руины",level:5,enemy:["Болотный рыцарь","Топляк","Слизень из руин"],color:"#31545a"},
    {name:"Рубиновый перевал",level:10,enemy:["Пепельный голем","Красный дракончик","Рыцарь пепла"],color:"#6a3530"},
    {name:"Чёрная цитадель",level:15,enemy:["Проклятый паладин","Теневой маг","Хранитель цитадели"],color:"#45364f"}
  ];
  let selectedRace = null, state = null, enemy = null, currentTab = "world";
  let actionBusy = false, toastTimer = null, mapW=0,mapH=0, lastSave=0, lastFloat={};
  const mapCanvas=$("world-map"), mapCtx=mapCanvas.getContext("2d");
  const enemyCanvas=$("enemy-canvas"), enemyCtx=enemyCanvas.getContext("2d");
  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const prefersReduced=!!motionQuery?.matches;

  function freshState(raceId,tutorial) {
    const r=RACES[raceId];
    return {version:1,race:raceId,name:r.name+" — Странник",level:1,xp:0,xpNext:100,
      hp:r.hp,maxHp:r.hp,mp:r.mp,maxMp:r.mp,str:r.str,agi:r.agi,luck:r.luck,gold:r.gold,
      potions:2,weapon:"Ржавый меч",weaponDamage:5,armorName:"Походная одежда",armor:0,
      kills:0,explored:1,zone:0,tutorial:!!tutorial,sound:false,effects:true,
      unlockedZones:[0],inventory:["Ржавый меч","Малое зелье","Малое зелье"],lastSave:Date.now()};
  }
  function showScreen(id) {
    ["creation","loading","game"].forEach(s=>$(s).classList.toggle("hidden",s!==id));
    if(id==="game") requestAnimationFrame(resizeMap);
  }
  function selectRace(id) {
    selectedRace=id;
    document.querySelectorAll(".race-card").forEach(c=>{
      const on=c.dataset.race===id;c.classList.toggle("selected",on);c.setAttribute("aria-pressed",String(on));
    });
    const r=RACES[id];
    $("race-info").innerHTML=`<h2>${r.name}</h2><p>${raceDescription(id)}</p><p class="good">${r.bonus}</p><p class="bad">${r.weak}</p><p class="passive">Особенность: ${r.passive}</p>`;
    $("start-game").disabled=false;
    if(tg?.HapticFeedback)try{tg.HapticFeedback.selectionChanged()}catch(_){}
  }
  function raceDescription(id) {
    return ({
      human:"Наследники павших королевств. Их воля крепче стали, а торговые пути полны возможностей.",
      elf:"Древние хранители лесов. Их стрелы находят цель прежде, чем враг заметит движение.",
      orc:"Непокорённые воины гор. Они принимают удар и отвечают сокрушительной силой.",
      undead:"Пробуждённые проклятием. Между жизнью и смертью они черпают силу из чужой боли."
    })[id];
  }
  document.querySelectorAll(".race-card").forEach(c=>c.addEventListener("click",()=>selectRace(c.dataset.race)));
  $("start-game").addEventListener("click",()=>{
    if(!selectedRace){toast("Сначала выбери расу.");return;}
    state=freshState(selectedRace,$("tutorial-toggle").checked);
    showScreen("loading");
    const lines=["Пепел помнит твоё имя","Старые дороги пробуждаются","Королевство ждёт своего героя"];
    let i=0;$("loading-message").textContent=lines[0];
    const timer=setInterval(()=>{$("loading-message").textContent=lines[++i%lines.length]},550);
    setTimeout(()=>{clearInterval(timer);showScreen("game");renderAll();log("world","Ты вступаешь в Сумрачный лес. Впереди — забытые земли.");log("world","Исследуй окрестности, собирай добычу и готовься к сражениям.");save(false);if(state.tutorial)showTutorial();},1700);
  });
  $("continue-game").addEventListener("click",()=>{if(loadSave()){showScreen("game");renderAll();log("world","Летопись восстановлена. Твоё путешествие продолжается.");}});
  try{if(localStorage.getItem(KEY))$("continue-game").classList.remove("hidden")}catch(_){}

  function renderAll() {
    if(!state)return;
    $("hero-name").textContent=state.name;$("hero-level").textContent="УР. "+state.level;
    $("location-name").textContent=ZONES[state.zone].name;
    setResource("hp",state.hp,state.maxHp);setResource("mp",state.mp,state.maxMp);
    setResource("gold",state.gold,Math.max(100,state.gold));setResource("xp",state.xp,state.xpNext);
    $("level-label").textContent="УРОВЕНЬ "+state.level;
    $("zone-title").textContent=ZONES[state.zone].name;$("zone-level").textContent="Рекомендуемый уровень: "+ZONES[state.zone].level;
    $("hero-sheet-name").textContent=state.name;$("hero-race-label").textContent=RACES[state.race].name;
    $("hero-passive").textContent=RACES[state.race].passive;
    $("stat-strength").textContent=state.str;$("stat-agility").textContent=state.agi;
    $("stat-luck").textContent=state.luck+"%";$("stat-armor").textContent=state.armor;
    $("stat-kills").textContent=state.kills;$("stat-explored").textContent=state.explored+" зон";
    $("weapon-name").textContent=state.weapon;$("weapon-damage").textContent="+"+state.weaponDamage+" урона";
    $("armor-name").textContent=state.armorName;$("armor-value").textContent=state.armor+" защиты";
    $("potion-count").textContent="Осталось: "+state.potions;
    $("hero-potion").textContent="Выпить зелье здоровья ("+state.potions+")";
    $("sound-toggle").checked=state.sound;$("effects-toggle").checked=state.effects;
    document.body.classList.toggle("no-effects",!state.effects);
    renderLocks();renderEnemy();requestAnimationFrame(resizeMap);
  }
  function setResource(key,value,max) {
    const pct=max>0?clamp(value/max*100,0,100):0;
    $(key+"-value").textContent=key==="gold"?String(value):`${value}/${max}`;
    $(key+"-meter").style.width=pct+"%";
  }
  function floatResource(key,delta,label) {
    const card=$(key+"-card");card.classList.remove("pulse");void card.offsetWidth;card.classList.add("pulse");
    const el=document.createElement("span");el.className="float-number "+(delta>=0?"positive":"negative");
    el.textContent=(delta>=0?"+":"")+delta+" "+label;card.appendChild(el);setTimeout(()=>el.remove(),1000);
  }
  function changeResource(key,delta,label) {
    if(!state)return;
    const map={hp:["hp","maxHp"],mp:["mp","maxMp"],gold:["gold",null]};
    const [valueKey,maxKey]=map[key];
    const old=state[valueKey];state[valueKey]=maxKey?clamp(old+delta,0,state[maxKey]):Math.max(0,old+delta);
    const actual=state[valueKey]-old;
    if(actual)floatResource(key,actual,label);
    return actual;
  }
  function log(where,message) {
    const target=$(where==="combat"?"combat-log":"world-log");if(!target)return;
    const item=document.createElement("div");item.className="log-entry";
    const time=document.createElement("time");time.textContent=new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
    const text=document.createElement("span");text.textContent=message;item.append(time,text);target.appendChild(item);
    while(target.children.length>28)target.removeChild(target.firstChild);
    target.scrollTop=target.scrollHeight;
  }
  function toast(message) {const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
  function modal(title,body,buttons=[{label:"Понятно",className:"gold-button",action:closeModal}]) {
    $("modal-title").textContent=title;$("modal-body").innerHTML=body;$("modal-actions").replaceChildren();
    buttons.forEach(b=>{const btn=document.createElement("button");btn.textContent=b.label;btn.className=b.className||"action-button";btn.addEventListener("click",b.action);$("modal-actions").appendChild(btn)});
    $("modal").classList.remove("hidden");
  }
  function closeModal(){$("modal").classList.add("hidden")}
  function showTutorial(){modal("Первые шаги",`<p><strong>Искать врага</strong> запускает бой. Победа приносит опыт и золото.</p><p><strong>Искать предметы</strong> помогает найти монеты, зелья и экипировку.</p><p><strong>Отдых у костра</strong> восстанавливает здоровье и ману.</p><p>Во время боя нижняя навигация запечатывается. Заверши бой или победи врага — только после этого вернутся остальные вкладки.</p>`)}
  function renderLocks() {
    const inCombat=!!enemy;
    document.querySelectorAll(".nav-button").forEach(btn=>{
      const tab=btn.dataset.tab,blocked=inCombat&&tab!=="combat";
      btn.classList.toggle("locked",blocked);btn.disabled=blocked;
      const lock=btn.querySelector(".chain-lock");if(lock)lock.classList.toggle("hidden",!blocked);
    });
    $("nav-combat").classList.toggle("active",currentTab==="combat");
  }
  function switchTab(tab) {
    if(enemy&&tab!=="combat"){toast("Бой не окончен. Заверши сражение.");return}
    currentTab=tab;
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+tab));
    document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
    renderLocks();if(tab==="world")requestAnimationFrame(resizeMap);if(tab==="combat")renderEnemy();
  }
  document.querySelectorAll(".nav-button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

  // Procedural world map and level-gated fog of war.
  const forestTrees=[[.1,.2],[.19,.12],[.29,.27],[.12,.48],[.29,.53],[.42,.16],[.52,.32],[.7,.12],[.83,.23],[.9,.42],[.13,.78],[.31,.83],[.47,.72],[.7,.81],[.88,.74]];
  function resizeMap() {
    if($("tab-world").classList.contains("active")===false)return;
    const r=mapCanvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const dpr=Math.min(devicePixelRatio||1,2);mapCanvas.width=Math.round(r.width*dpr);mapCanvas.height=Math.round(r.height*dpr);
    mapCtx.setTransform(dpr,0,0,dpr,0,0);mapW=r.width;mapH=r.height;drawMap(performance.now());
  }
  function drawTree(x,y,s,t) {
    const sway=Math.sin(t/850+x)*1.8*s;mapCtx.fillStyle="#513b25";mapCtx.fillRect(x-2*s,y,4*s,9*s);
    mapCtx.fillStyle="#21452f";mapCtx.beginPath();mapCtx.moveTo(x,y-22*s);mapCtx.lineTo(x-12*s+sway,y);mapCtx.lineTo(x+12*s+sway,y);mapCtx.closePath();mapCtx.fill();
    mapCtx.fillStyle="#38663d";mapCtx.beginPath();mapCtx.moveTo(x,y-30*s);mapCtx.lineTo(x-8*s+sway,y-11*s);mapCtx.lineTo(x+8*s+sway,y-11*s);mapCtx.closePath();mapCtx.fill();
  }
  function drawMap(t=performance.now()) {
    if(!mapW||!mapH||!state)return;
    const c=mapCtx,w=mapW,h=mapH,z=state.zone;
    c.clearRect(0,0,w,h);c.fillStyle=ZONES[z].color;c.fillRect(0,0,w,h);
    const grad=c.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#61714b");grad.addColorStop(.5,"#2d5037");grad.addColorStop(1,"#1b2f25");c.fillStyle=grad;c.fillRect(0,0,w,h);
    for(let i=0;i<100;i++){c.fillStyle=i%2?"#d6c77b10":"#0c1e1530";c.fillRect((i*71+7)%w,(i*43+19)%h,2,2)}
    // River and road.
    c.beginPath();c.moveTo(0,h*.34);c.bezierCurveTo(w*.25,h*.48,w*.25,h*.1,w*.55,h*.22);c.bezierCurveTo(w*.74,h*.31,w*.8,h*.1,w,h*.16);c.strokeStyle="#142a27";c.lineWidth=13;c.stroke();c.strokeStyle="#4c8581";c.lineWidth=8;c.stroke();
    c.beginPath();c.moveTo(w*.04,h*.87);c.bezierCurveTo(w*.26,h*.61,w*.4,h*.91,w*.56,h*.56);c.bezierCurveTo(w*.65,h*.38,w*.72,h*.5,w*.8,h*.28);c.strokeStyle="#9b855a";c.lineWidth=9;c.stroke();c.strokeStyle="#d3b97d";c.lineWidth=1;c.stroke();
    forestTrees.forEach((p,i)=>drawTree(p[0]*w,p[1]*h,.6+(i%3)*.13,t));
    // Zones are placed along the route.
    const places=ZONES.map((zone,i)=>({x:w*(.2+i*.2),y:h*(.73-i*.17),zone,i}));
    places.forEach(p=>{
      const unlocked=state.level>=p.zone.level;
      const pulse=4+Math.sin(t/320+p.i)*1.6;
      c.beginPath();c.arc(p.x,p.y,7+pulse,0,Math.PI*2);c.strokeStyle=unlocked?"#e5c77b77":"#a3b0a155";c.lineWidth=1;c.stroke();
      c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fillStyle=unlocked?"#ffdc80":"#5d7169";c.fill();
      c.font="bold 9px Georgia";c.textAlign="center";c.fillStyle=unlocked?"#f5e1b5":"#b3b6a8";c.fillText(p.zone.name,p.x,p.y+16);
      c.font="8px Georgia";c.fillStyle=unlocked?"#e4d0a2":"#7f8a7c";c.fillText("УР. "+p.zone.level,p.x,p.y+26);
    });
    // Player marker.
    const px=w*(.2+state.zone*.2),py=h*(.73-state.zone*.17);
    c.beginPath();c.arc(px,py,11+Math.sin(t/240)*1.5,0,Math.PI*2);c.fillStyle="#e6c26c44";c.fill();
    c.beginPath();c.arc(px,py,5,0,Math.PI*2);c.fillStyle="#ffe7a0";c.strokeStyle="#fff5c8";c.lineWidth=1.5;c.fill();c.stroke();
    // Fog overlays level-locked zones; animation gently ripples the edges.
    places.forEach(p=>{
      if(state.level>=p.zone.level)return;
      c.save();c.beginPath();c.arc(p.x,p.y,Math.max(25,Math.min(w,h)*.18),0,Math.PI*2);c.clip();
      c.fillStyle="#101612bb";c.fillRect(p.x-60,p.y-60,120,120);
      for(let i=0;i<7;i++){
        const fx=p.x+Math.sin(t/950+i*1.8)*22+i*3-10,fy=p.y+Math.cos(t/800+i)*16;
        const g=c.createRadialGradient(fx,fy,1,fx,fy,23);g.addColorStop(0,"#b5c6b833");g.addColorStop(1,"#a6b6a000");c.fillStyle=g;c.fillRect(fx-24,fy-24,48,48);
      }
      c.restore();
    });
    // Edge vignette.
    const vignette=c.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.18,w*.5,h*.48,Math.max(w,h)*.75);
    vignette.addColorStop(0,"#080e0b00");vignette.addColorStop(1,"#080b09aa");c.fillStyle=vignette;c.fillRect(0,0,w,h);
    if(!prefersReduced)requestAnimationFrame(drawMap);
  }
  mapCanvas.addEventListener("click",e=>{
    if(!state||enemy)return;const r=mapCanvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    const i=Math.round((x-.2)/.2);if(i<0||i>=ZONES.length)return;
    const p={x:.2+i*.2,y:.73-i*.17};
    if(Math.hypot(x-p.x,y-p.y)>.13)return;
    const z=ZONES[i];
    if(state.level<z.level){toast("Эта область запечатана. Требуется уровень "+z.level+".");return}
    state.zone=i;state.explored=Math.max(state.explored,i+1);renderAll();log("world","Ты отправляешься в новую область: "+z.name+".");save();
  });
  window.addEventListener("resize",resizeMap);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&currentTab==="world")resizeMap()});

  // Exploration actions.
  $("explore-enemy").addEventListener("click",()=>{
    if(!state||enemy||actionBusy)return;actionBusy=true;setTimeout(()=>actionBusy=false,350);
    const z=ZONES[state.zone],roll=Math.random();
    if(roll<.14){const g=rand(5,15)+Math.max(0,state.luck);changeResource("gold",g,"Gold");log("world",`На обочине найден тайник: ${g} золотых монет.`);renderAll();save();return}
    const base=[{hp:35,damage:8,xp:24,gold:12},{hp:42,damage:9,xp:30,gold:15},{hp:29,damage:7,xp:20,gold:9}][rand(0,2)];
    const scale=1+state.zone*.45+Math.floor((state.level-1)/3)*.18;
    enemy={name:pick(z.enemy),hp:Math.round(base.hp*scale),maxHp:Math.round(base.hp*scale),damage:Math.round(base.damage*scale),xp:base.xp+state.zone*10,gold:base.gold+state.zone*5};
    $("combat-empty").classList.add("hidden");$("combat-arena").classList.remove("hidden");
    switchTab("combat");renderEnemy();log("world",`Из тумана выходит противник: ${enemy.name}.`);log("combat",`Начался бой с противником: ${enemy.name}.`);
    $("combat-message").textContent="Противник готовится к атаке. Выбери действие.";
    renderLocks();drawEnemy(performance.now());
    if(tg?.HapticFeedback)try{tg.HapticFeedback.impactOccurred("medium")}catch(_){}
    save();
  });
  $("explore-loot").addEventListener("click",()=>{
    if(!state||enemy||actionBusy)return;actionBusy=true;setTimeout(()=>actionBusy=false,300);
    const r=Math.random(),luck=Math.max(0,state.luck)*.004;
    if(r<.43+luck){const g=rand(8,22)+Math.max(0,state.luck);changeResource("gold",g,"Gold");log("world",`В зарослях найден кошель с ${g} золотыми монетами.`)}
    else if(r<.7){state.potions++;state.inventory.push("Малое зелье");log("world","Ты нашёл малое зелье здоровья. Оно добавлено в сумку.")}
    else if(r<.88){const bonus=rand(2,4);state.weaponDamage+=bonus;state.weapon="Клинок пограничья";state.inventory.push(state.weapon);log("world",`Среди обломков найден клинок пограничья: +${bonus} к урону.`)}
    else{state.armor=Math.min(12,state.armor+1);state.armorName="Усиленная дорожная броня";log("world","Ты находишь усиленную броню. Защита увеличена на 1.")}
    state.explored++;renderAll();save();
  });
  $("rest-fire").addEventListener("click",()=>{
    if(!state||enemy||actionBusy)return;actionBusy=true;setTimeout(()=>actionBusy=false,300);
    const h=Math.min(state.maxHp-state.hp,Math.ceil(state.maxHp*.28)),m=Math.min(state.maxMp-state.mp,Math.ceil(state.maxMp*.32));
    if(!h&&!m){toast("Ты уже полон сил.");return}
    if(h)changeResource("hp",h,"HP");if(m)changeResource("mp",m,"MP");
    log("world",`У костра восстановлено ${h} здоровья и ${m} маны.`);renderAll();save();
  });

  // Combat lock is state-based: no tab can be switched while enemy exists.
  function renderEnemy() {
    $("combat-empty").classList.toggle("hidden",!!enemy);
    $("combat-arena").classList.toggle("hidden",!enemy);
    if(!enemy)return;
    $("enemy-title").textContent=enemy.name;$("enemy-hp-label").textContent=`${enemy.hp}/${enemy.maxHp}`;
    $("enemy-hp-meter").style.width=(enemy.hp/enemy.maxHp*100)+"%";
    $("race-skill").querySelector("b").textContent=RACES[state.race].skill;
    $("skill-cost").textContent=RACES[state.race].skillCost+" маны";
    $("potion-count").textContent="Осталось: "+state.potions;
  }
  function drawEnemy(t=0) {
    if(!enemy||!enemyCtx)return;
    const c=enemyCtx,w=enemyCanvas.width,h=enemyCanvas.height;c.clearRect(0,0,w,h);
    const breath=Math.sin(t/360)*3;
    const glow=c.createRadialGradient(w/2,h*.55,10,w/2,h*.55,120);glow.addColorStop(0,"#9c4a2e44");glow.addColorStop(1,"#0b0b0900");c.fillStyle=glow;c.fillRect(0,0,w,h);
    // silhouette, hood and armour.
    c.fillStyle="#241b19";c.beginPath();c.moveTo(75,210);c.quadraticCurveTo(65,150,105,125);c.lineTo(195,125);c.quadraticCurveTo(235,155,225,210);c.closePath();c.fill();
    c.fillStyle="#5c4431";c.beginPath();c.moveTo(105,145);c.lineTo(94,67);c.quadraticCurveTo(150,5,206,67);c.lineTo(195,145);c.closePath();c.fill();
    const metal=c.createLinearGradient(100,0,205,0);metal.addColorStop(0,"#312b29");metal.addColorStop(.45,"#8c7661");metal.addColorStop(1,"#302824");c.fillStyle=metal;c.beginPath();c.moveTo(105,145);c.lineTo(100,74);c.quadraticCurveTo(150,14,200,74);c.lineTo(195,145);c.closePath();c.fill();c.strokeStyle="#b18b53";c.lineWidth=2;c.stroke();
    c.fillStyle="#17100e";c.beginPath();c.moveTo(112,86);c.lineTo(188,86);c.lineTo(179,116);c.lineTo(121,116);c.closePath();c.fill();
    c.shadowColor="#ff5a36";c.shadowBlur=12;c.fillStyle="#ff7744";c.fillRect(122,94,14,4);c.fillRect(164,94,14,4);c.shadowBlur=0;
    c.strokeStyle="#bc9a60";c.lineWidth=5;c.beginPath();c.moveTo(207,98);c.lineTo(239,181);c.stroke();
    c.fillStyle="#9b9c92";c.beginPath();c.moveTo(205,55);c.lineTo(237,83);c.lineTo(222,116);c.lineTo(199,91);c.closePath();c.fill();
    c.strokeStyle="#d9c7a1";c.lineWidth=2;c.stroke();
    if(!prefersReduced)requestAnimationFrame(drawEnemy);
  }
  function enemyHitAnimation(strong=false) {
    $("enemy-stage").classList.remove("hit");$("hit-flash").classList.remove("active");void $("enemy-stage").offsetWidth;
    $("enemy-stage").classList.add("hit");$("hit-flash").classList.add("active");
    if(strong){document.body.classList.add("shake-screen");setTimeout(()=>document.body.classList.remove("shake-screen"),280)}
    if(tg?.HapticFeedback)try{tg.HapticFeedback.impactOccurred(strong?"heavy":"light")}catch(_){}
  }
  function playerAttack(special=false) {
    if(!enemy||!state||actionBusy)return;
    if(special&&state.mp<RACES[state.race].skillCost){toast("Недостаточно маны.");return}
    actionBusy=true;
    let dmg;
    if(special){
      const cost=RACES[state.race].skillCost;changeResource("mp",-cost,"MP");
      dmg=rand(11,17)+state.level*2+Math.floor(state.str*.6);
      if(state.race==="elf")dmg+=9;
      if(state.race==="orc")dmg+=8;
      if(state.race==="undead")dmg+=4;
      if(state.race==="human")dmg+=5;
      $("combat-message").textContent=RACES[state.race].skill+" наносит "+dmg+" урона!";
    } else {
      dmg=rand(5,10)+state.str+state.weaponDamage;
      if(state.race==="orc")dmg+=4;
      $("combat-message").textContent="Твой удар наносит "+dmg+" урона.";
    }
    enemy.hp=Math.max(0,enemy.hp-dmg);
    if(state.race==="undead"){const heal=Math.floor(dmg*.15);if(heal>0){changeResource("hp",heal,"HP");log("combat","Вампиризм возвращает "+heal+" здоровья.")}}
    enemyHitAnimation(dmg>=20);renderEnemy();renderAll();log("combat",`${special?"Особый приём":"Обычный удар"}: ${dmg} урона.`);
    if(enemy.hp<=0){winBattle();actionBusy=false;return}
    setTimeout(enemyTurn,480);setTimeout(()=>{actionBusy=false},520);save();
  }
  function enemyTurn() {
    if(!enemy||!state)return;
    const dodge=clamp(state.agi/100,0,.38);
    if(Math.random()<dodge){$("combat-message").textContent="Ты уклоняешься от удара.";log("combat","Ты избежал атаки противника.");return}
    const dmg=Math.max(1,enemy.damage-state.armor);
    changeResource("hp",-dmg,"HP");$("combat-message").textContent=enemy.name+" наносит "+dmg+" урона.";
    log("combat",`${enemy.name} наносит ${dmg} урона.`);
    if(state.hp<=0){defeat();return}
    renderAll();save();
  }
  function winBattle() {
    const defeated=enemy;enemy=null;
    state.kills++;changeResource("gold",defeated.gold+rand(0,5),"Gold");
    gainXP(defeated.xp);
    $("combat-message").textContent="Победа! Противник повержен.";
    log("combat",`Победа! Получено ${defeated.xp} опыта и ${defeated.gold} золота.`);
    log("world",`Ты победил противника: ${defeated.name}.`);
    $("combat-arena").classList.add("hidden");$("combat-empty").classList.remove("hidden");
    $("combat-empty").querySelector("h3").textContent="Победа за тобой";
    $("combat-empty").querySelector("p").textContent="Враг повержен. Можешь вернуться к исследованию земель.";
    renderLocks();renderAll();save();toast("Победа!");actionBusy=false;
  }
  function gainXP(n) {
    state.xp+=n;
    while(state.xp>=state.xpNext){
      state.xp-=state.xpNext;state.level++;state.xpNext=Math.floor(state.xpNext*1.35);
      state.maxHp+=12;state.maxMp+=7;state.str+=2;state.hp=state.maxHp;state.mp=state.maxMp;
      log("world","Новый уровень: "+state.level+". Максимальные ресурсы и сила увеличены.");
      const before=state.unlockedZones.length;
      ZONES.forEach((z,i)=>{if(state.level>=z.level&&!state.unlockedZones.includes(i))state.unlockedZones.push(i)});
      if(state.unlockedZones.length>before)log("world","Туман рассеивается. Открыта новая область: "+ZONES[state.unlockedZones[state.unlockedZones.length-1]].name+".");
    }
  }
  function defeat() {
    const loss=Math.min(state.gold,Math.ceil(state.gold*.15));state.gold-=loss;
    state.hp=Math.max(1,Math.floor(state.maxHp*.35));state.mp=Math.floor(state.maxMp*.2);
    enemy=null;$("combat-arena").classList.add("hidden");$("combat-empty").classList.remove("hidden");
    $("combat-empty").querySelector("h3").textContent="Ты потерпел поражение";
    $("combat-empty").querySelector("p").textContent=`Лекарь нашёл тебя на дороге. Потеряно ${loss} золота. Ты восстановил часть сил.`;
    $("combat-message").textContent="Бой окончен.";log("world",`Поражение. Лекарь спас тебя; потеряно ${loss} золота.`);
    renderLocks();renderAll();save();toast("Ты вернулся к жизни.");actionBusy=false;
  }
  $("basic-attack").addEventListener("click",()=>playerAttack(false));
  $("race-skill").addEventListener("click",()=>playerAttack(true));
  function usePotion() {
    if(!state||state.potions<=0){toast("Зелий больше нет.");return}
    if(state.hp===state.maxHp){toast("Здоровье уже полное.");return}
    state.potions--;const heal=Math.min(36,state.maxHp-state.hp);changeResource("hp",heal,"HP");
    const idx=state.inventory.indexOf("Малое зелье");if(idx>=0)state.inventory.splice(idx,1);
    log(enemy?"combat":"world",`Зелье восстановило ${heal} здоровья.`);
    renderAll();if(enemy)setTimeout(enemyTurn,350);save();
  }
  $("use-potion").addEventListener("click",()=>{if(enemy)usePotion()});
  $("hero-potion").addEventListener("click",()=>{if(enemy){toast("Во время боя используй зелье на арене.");return}usePotion()});
  $("flee-combat").addEventListener("click",()=>{
    if(!enemy)return;
    if(Math.random()<.68){log("combat","Ты отступаешь, оставив врага позади.");log("world","Ты смог оторваться от противника.");enemy=null;$("combat-arena").classList.add("hidden");$("combat-empty").classList.remove("hidden");$("combat-empty").querySelector("h3").textContent="Ты отступил";$("combat-empty").querySelector("p").textContent="Ты избежал дальнейшей схватки. Найди другой путь.";renderLocks();renderAll();save();toast("Ты отступил.");}
    else{$("combat-message").textContent="Путь к отступлению закрыт!";log("combat","Побег не удался.");enemyTurn()}
  });

  // Settings and persistence.
  $("sound-toggle").addEventListener("change",e=>{if(state){state.sound=e.target.checked;save()}});
  $("effects-toggle").addEventListener("change",e=>{if(state){state.effects=e.target.checked;document.body.classList.toggle("no-effects",!state.effects);save()}});
  $("save-now").addEventListener("click",()=>save(true));
  $("reset-game").addEventListener("click",()=>modal("Начать новую летопись","<p>Текущий прогресс будет удалён с этого устройства. Это действие нельзя отменить.</p>",[
    {label:"Отмена",className:"action-button",action:closeModal},
    {label:"Удалить и начать",className:"danger-button",action:()=>{localStorage.removeItem(KEY);state=null;enemy=null;selectedRace=null;closeModal();$("continue-game").classList.add("hidden");$("start-game").disabled=true;document.querySelectorAll(".race-card").forEach(c=>c.classList.remove("selected"));$("race-info").innerHTML="<h2>Выбери наследие</h2><p>Нажми на одну из рас, чтобы увидеть её преимущества и слабости.</p>";showScreen("creation");toast("Новая летопись готова.")}}
  ]));
  function save(show=true) {
    if(!state)return;
    try{state.lastSave=Date.now();localStorage.setItem(KEY,JSON.stringify(state));$("save-status").textContent="Сохранено: "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});lastSave=Date.now();if(show)toast("Летопись сохранена.");}
    catch(e){$("save-status").textContent="Сохранение недоступно в этом браузере.";if(show)toast("Не удалось сохранить прогресс.");}
  }
  function loadSave() {
    try{
      const s=JSON.parse(localStorage.getItem(KEY)||"null");
      if(!s||s.version!==1||!RACES[s.race]||!Number.isFinite(s.level)||!Array.isArray(s.inventory))return false;
      const numeric=["level","xp","xpNext","hp","maxHp","mp","maxMp","str","agi","luck","gold","potions","weaponDamage","armor","kills","explored","zone"];
      if(!numeric.every(k=>Number.isFinite(s[k])&&s[k]>=0))return false;
      state=s;selectedRace=s.race;return true;
    }catch(_){return false}
  }
  document.addEventListener("visibilitychange",()=>{if(document.hidden)save(false)});
  window.addEventListener("pagehide",()=>save(false));
  setInterval(()=>{if(state&&Date.now()-lastSave>15000)save(false)},15000);
  document.addEventListener("gesturestart",e=>e.preventDefault(),{passive:false});
  document.addEventListener("gesturechange",e=>e.preventDefault(),{passive:false});
  let lastTouch=0;document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouch<280)e.preventDefault();lastTouch=now},{passive:false});
})();