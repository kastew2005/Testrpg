/* Canvas portrait renderer: procedural art only; no image assets or emoji. */
(() => {
  "use strict";
  const canvases = [...document.querySelectorAll("canvas[data-avatar]")];
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const palette = {
    human: {skin:"#c78f69",shadow:"#754b38",hair:"#39271d",metal:"#9ba8ad",bright:"#e1e9e6",eye:"#6f9aa5"},
    elf: {skin:"#d5b18b",shadow:"#88694f",hair:"#b5c57b",metal:"#477b63",bright:"#d8efbd",eye:"#7be4c2"},
    orc: {skin:"#638d51",shadow:"#29472f",hair:"#392d21",metal:"#7c8884",bright:"#c5d1b4",eye:"#f5bd59"},
    undead: {skin:"#a8a6a0",shadow:"#54535f",hair:"#31243e",metal:"#62517c",bright:"#b6ff9a",eye:"#a4ff6c"}
  };
  const active = new Map();

  function draw(ctx, type, w, h, t) {
    const p = palette[type] || palette.human;
    const s = Math.min(w, h) / 150;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(w / 150, h / 150);
    const blink = Math.max(0, 1 - Math.abs((t % 3600) - 3500) / 100);
    const breath = Math.sin(t / 700) * 1.4;
    // Medallion backdrop.
    const bg = ctx.createRadialGradient(75, 62, 5, 75, 70, 78);
    bg.addColorStop(0, type === "undead" ? "#3d3154" : "#5a3c1d");
    bg.addColorStop(1, "#12100d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 150, 150);
    ctx.strokeStyle = "#c39b4c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(75, 72, 66, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = "#f0d68a55"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(75, 72, 60, 0, Math.PI*2); ctx.stroke();
    // Floating embers / arcane motes.
    for (let i=0;i<9;i++) {
      const a = i*2.399 + t/1700;
      const r = 45 + 5*Math.sin(t/500+i);
      const x=75+Math.cos(a)*r, y=72+Math.sin(a)*r;
      ctx.fillStyle = type === "undead" ? "#a7ff8c88" : "#f5cc6c88";
      ctx.beginPath(); ctx.arc(x,y,1.2+(i%3)*.45,0,Math.PI*2); ctx.fill();
    }
    // Body / shoulders.
    ctx.fillStyle = type === "undead" ? "#40354e" : type === "orc" ? "#344a2d" : "#283a37";
    ctx.beginPath(); ctx.moveTo(30,145); ctx.quadraticCurveTo(32,105,57,103); ctx.lineTo(93,103); ctx.quadraticCurveTo(120,110,122,145); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="#b68d4a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(45,133);ctx.lineTo(105,133);ctx.stroke();
    // Ears for elves and orcs.
    if(type==="elf"){
      ctx.fillStyle=p.skin;ctx.beginPath();ctx.moveTo(49,57);ctx.lineTo(12,34);ctx.lineTo(37,75);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(101,57);ctx.lineTo(138,34);ctx.lineTo(113,75);ctx.closePath();ctx.fill();
    } else if(type==="orc"){
      ctx.fillStyle=p.skin;ctx.beginPath();ctx.moveTo(47,58);ctx.lineTo(22,42);ctx.lineTo(39,78);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(103,58);ctx.lineTo(128,42);ctx.lineTo(111,78);ctx.closePath();ctx.fill();
    }
    // Hair / hood.
    ctx.fillStyle=p.hair;
    ctx.beginPath();ctx.moveTo(42,59);ctx.quadraticCurveTo(34,14,76,19);ctx.quadraticCurveTo(117,16,111,59);ctx.lineTo(105,90);ctx.lineTo(45,90);ctx.closePath();ctx.fill();
    if(type==="elf"){
      ctx.strokeStyle="#d9e6a0";ctx.lineWidth=2;
      for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(45+i*5,32);ctx.quadraticCurveTo(25+i*5,65,40+i*5,100);ctx.stroke();}
    }
    if(type==="undead"){
      ctx.fillStyle="#282130";ctx.beginPath();ctx.moveTo(40,47);ctx.lineTo(75,13);ctx.lineTo(110,47);ctx.lineTo(102,82);ctx.lineTo(48,82);ctx.closePath();ctx.fill();
      ctx.strokeStyle="#77619b";ctx.lineWidth=2;ctx.stroke();
    }
    // Face or skull.
    const faceY = type==="orc" ? 47+breath : 45+breath;
    ctx.fillStyle=p.skin;
    ctx.beginPath();
    if(type==="undead"){
      ctx.moveTo(49,44);ctx.quadraticCurveTo(75,31,101,44);ctx.lineTo(98,87);ctx.lineTo(84,105);ctx.lineTo(66,105);ctx.lineTo(52,87);ctx.closePath();
    } else {
      ctx.moveTo(46,faceY);ctx.quadraticCurveTo(75,31+breath,104,faceY);ctx.lineTo(99,84);ctx.quadraticCurveTo(75,111,51,84);ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle=p.shadow;ctx.lineWidth=1.5;ctx.stroke();
    // Helmet for human; tusks for orc.
    if(type==="human"){
      const metal=ctx.createLinearGradient(40,20,105,60);metal.addColorStop(0,"#515e67");metal.addColorStop(.4,p.bright);metal.addColorStop(1,"#4d5a62");
      ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(38,55);ctx.lineTo(36,36);ctx.quadraticCurveTo(75,2,114,36);ctx.lineTo(112,56);ctx.lineTo(97,48);ctx.lineTo(53,48);ctx.closePath();ctx.fill();ctx.strokeStyle="#e7d4a2";ctx.stroke();
      ctx.fillStyle="#4b3a24";ctx.fillRect(52,48,46,5);ctx.fillStyle="#d7bd78";ctx.fillRect(73,23,4,25);
    } else if(type==="orc"){
      ctx.fillStyle="#e9d9b2";
      ctx.beginPath();ctx.moveTo(54,84);ctx.lineTo(59,101);ctx.lineTo(66,87);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(96,84);ctx.lineTo(91,101);ctx.lineTo(84,87);ctx.closePath();ctx.fill();
    }
    // Eyes with blinking lids.
    const eyeY=type==="undead"?68:66+breath*.25;
    ctx.fillStyle=type==="undead"?"#171220":"#231a15";
    ctx.beginPath();ctx.ellipse(61,eyeY,8,Math.max(1,4*(1-blink)),0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(89,eyeY,8,Math.max(1,4*(1-blink)),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.eye;
    ctx.shadowColor=p.eye;ctx.shadowBlur=type==="undead"?15:4;
    ctx.beginPath();ctx.arc(61,eyeY,2.4*(1-blink*.7),0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(89,eyeY,2.4*(1-blink*.7),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // Nose and mouth / skull teeth.
    ctx.strokeStyle=p.shadow;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(75,68);ctx.lineTo(71,79);ctx.lineTo(78,80);ctx.stroke();
    if(type==="undead"){
      ctx.strokeStyle="#514b57";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,89);ctx.lineTo(90,89);ctx.stroke();
      for(let x=64;x<=86;x+=6){ctx.beginPath();ctx.moveTo(x,88);ctx.lineTo(x,96);ctx.stroke();}
    } else {
      ctx.strokeStyle=p.shadow;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(65,91);ctx.quadraticCurveTo(75,96,85,91);ctx.stroke();
    }
    // Signature weapon to the right.
    ctx.save();ctx.translate(119,77);ctx.rotate(Math.sin(t/900)*.11);
    if(type==="human"){
      ctx.fillStyle="#6c4827";ctx.fillRect(-2,8,4,43);ctx.fillStyle="#9da8ae";ctx.beginPath();ctx.moveTo(-1,8);ctx.lineTo(-7,-24);ctx.lineTo(0,-37);ctx.lineTo(7,-24);ctx.lineTo(2,8);ctx.closePath();ctx.fill();ctx.strokeStyle="#e3e8df";ctx.stroke();ctx.fillStyle="#c79c4f";ctx.fillRect(-9,5,18,4);
    } else if(type==="elf"){
      ctx.strokeStyle="#8ddcbb";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-5,0,23,-1.2,1.2);ctx.stroke();ctx.strokeStyle="#f2d991";ctx.beginPath();ctx.moveTo(-15,-22);ctx.quadraticCurveTo(15,0,-15,22);ctx.stroke();ctx.fillStyle="#b6f9dd";ctx.beginPath();ctx.arc(-5,0,2.5,0,Math.PI*2);ctx.fill();
    } else if(type==="orc"){
      ctx.fillStyle="#6b4929";ctx.fillRect(-2,0,5,49);ctx.fillStyle="#8e9b9b";ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(22,-19);ctx.lineTo(16,1);ctx.lineTo(0,6);ctx.closePath();ctx.fill();ctx.strokeStyle="#d1d6ca";ctx.stroke();
    } else {
      ctx.strokeStyle="#8a5bd0";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-2,0,20,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#aaff8c";ctx.beginPath();ctx.moveTo(-2,-23);ctx.lineTo(-2,23);ctx.stroke();ctx.fillStyle="#aaff8c";ctx.shadowColor="#aaff8c";ctx.shadowBlur=12;ctx.beginPath();ctx.arc(-2,0,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    ctx.restore();
    ctx.restore();
  }

  function loop(now) {
    active.forEach((entry, canvas) => {
      if (!canvas.isConnected) { active.delete(canvas); return; }
      if (document.hidden) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round((rect.width || 100)*dpr));
      const height = Math.max(1, Math.round((rect.height || rect.width || 100)*dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
      const ctx=canvas.getContext("2d");
      draw(ctx, canvas.dataset.avatar || "human", canvas.width, canvas.height, reducedMotion ? 0 : now);
    });
    requestAnimationFrame(loop);
  }
  canvases.forEach(canvas => active.set(canvas, true));
  requestAnimationFrame(loop);
  window.AshPortraits = { drawStatic(canvas, type) {
    const ctx=canvas.getContext("2d");
    draw(ctx,type,canvas.width,canvas.height,0);
  }};
})();