/* Shared browser UI. Games supply state and receive intent; no game economy lives here. */
(function(){
'use strict';
const base=new URL('.',document.currentScript.src).href;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currency='';
// The go button doubles as cash out when the game says so; older games are recognised
// by the wording they use on it.
const goIsCash=s=>s.goCash!==undefined?!!s.goCash:s.goTitle==='CASH OUT';
const money=v=>currency?Number(v||0).toFixed(2)+' '+currency:'$'+Number(v||0).toFixed(2);
const icon=(name)=>'<img class="icon" alt="" src="'+base+'assets/icons/'+name+(name==='play.svg'?'?v=rounded-2':'')+'">';
const avatar=(name,players=[])=>{let i=players.indexOf(name);if(i<0)i=5;return '<span class="avatar" role="img" aria-label="'+esc(name)+'" style="--avatar-x:'+((i%3)*50)+'%;--avatar-y:'+(i<3?0:100)+'%"></span>'};
const button=(action,text,cls='')=>'<button type="button" class="button '+cls+'" data-action="'+action+'">'+text+'</button>';
// Betting feedback belongs to the UI; the cashout-ready tone plays once per round, not on every re-enable between steps.
class BettingSound {
 constructor(){this.enabled=false;this.last=-Infinity;this.next=0;this.pools={};for(const name of ['click','confirm'])this.pools[name]=Array.from({length:4},()=>{const clip=new Audio(base+'assets/audio/'+name+'.ogg');clip.preload='auto';clip.preservesPitch=false;clip.volume=name==='click'?0.14:0.12;return clip});soundLevels.then(l=>{for(const name of ['click','confirm'])if(Number.isFinite(l[name]))for(const clip of this.pools[name])clip.volume=l[name]})}
 updateCashReady(state){const active=!!state.canCash&&(!!state.showCash||goIsCash(state))&&!state.win;const round=state.game+':'+state.rounds;if(this.game===state.game&&this.cashReady===false&&active&&this.chimedRound!==round){this.play('cash-ready');this.chimedRound=round}this.game=state.game;this.cashReady=active}
 setEnabled(value){this.enabled=value;if(!value)for(const pool of Object.values(this.pools))for(const clip of pool)clip.pause()}
 play(action){if(!this.enabled||document.hidden)return;const confirm=action==='cash-ready';if(!confirm&&!['go','cash','min','max','minus','plus','preset','auto','difficulty','chooseDifficulty'].includes(action))return;const now=performance.now();if(!confirm&&now-this.last<55)return;if(!confirm)this.last=now;const clip=this.pools[confirm?'confirm':'click'][this.next++%4];clip.currentTime=0;clip.playbackRate=action==='minus'?0.92:action==='plus'?1.08:1;clip.play().catch(()=>{})}
 destroy(){this.setEnabled(false);for(const pool of Object.values(this.pools))for(const clip of pool){clip.removeAttribute('src');clip.load()}}
}
// Popup and wallet transfer have separate voices using one shared coin asset.
class WinSound {
 constructor(){this.clip=new Audio(base+'assets/audio/win.ogg');this.clip.preload='auto';this.clip.volume=0.44;this.transferClip=new Audio(base+'assets/audio/win.ogg');this.transferClip.preload='auto';this.transferClip.volume=0.20;this.enabled=false;this.active=false;soundLevels.then(l=>{if(Number.isFinite(l.win))this.clip.volume=l.win;if(Number.isFinite(l.win_transfer))this.transferClip.volume=l.win_transfer})}
 update(state){this.enabled=state.settings?.sound===true;if(!this.enabled){this.clip.pause();this.transferClip.pause()}const active=!!state.win;if(this.game===state.game&&active&&(!this.active||(state.winId!==undefined&&state.winId!==this.winId)))this.play();this.game=state.game;this.active=active;this.winId=state.winId}
 play(){if(!this.enabled||document.hidden)return;this.clip.currentTime=0;this.clip.playbackRate=1;this.clip.play().catch(()=>{})}
 playTransfer(){if(!this.enabled||document.hidden)return;this.transferClip.currentTime=0;this.transferClip.playbackRate=1.12;this.transferClip.preservesPitch=false;this.transferClip.play().catch(()=>{})}
 destroy(){this.transferClip.pause();this.transferClip.removeAttribute('src');this.transferClip.load();this.clip.pause();this.clip.removeAttribute('src');this.clip.load()}
}
// Levels tuned in Crash Composer → Sound Studio (assets/audio/sounds.json); built-in levels apply until it loads.
const soundLevels=typeof fetch==='function'?fetch(base+'assets/audio/sounds.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(m=>Object.fromEntries((m.events||[]).map(e=>[e.id,(e.takes||[]).some(t=>t.enabled!==false)?Math.min(1,Math.pow(10,Number(e.volume_db)/20)):0]))).catch(()=>({})):Promise.resolve({});
class MultiBetControls {
 constructor(){
  this.element=document.createElement('section');this.element.className='controls panel multi-bet-controls';this.element.setAttribute('aria-label','Three position betting controls');this.cards={};
  for(const [key,name,amount] of [['left','LEFT WINS',5],['main','MAIN CATCH',8],['right','RIGHT WINS',5]]){
   const el=document.createElement('section');el.className='multi-bet';el.setAttribute('aria-label',name);
   el.innerHTML='<div class="bet-quote">'+name+'<strong>1.00×</strong></div><div class="bet-receipt">Choose your stake</div><div class="stake bet-wager"><button type="button" class="button bet-step" data-step="-1" aria-label="Decrease '+name+' stake">−</button><input class="bet-amount money" aria-label="'+name+' stake in dollars" type="number" inputmode="numeric" min="1" max="1000" step="1" value="'+amount+'"><button type="button" class="button bet-step" data-step="1" aria-label="Increase '+name+' stake">+</button></div><button type="button" class="button action bet-action"><span class="action-title">BET</span><span class="money">'+money(amount)+'</span></button>';
   this.element.append(el);this.cards[key]={el,input:el.querySelector('input'),button:el.querySelector('.bet-action')};
  }
 }
}
class GameUI {
 constructor(host,send,config={}){
  this.host=host;this.send=send;this.config=config;this.state={};this.modal='';this.lastFocus=null;this.lastWins='';this.lastHistory='';this.bettingSound=new BettingSound();this.winSound=new WinSound();
  if(!instance&&!config.demo)instance=this;
  host.className='crash-ui';host.innerHTML='<div class="top"><section class="account panel" aria-label="Player and records"><div class="profile"><button class="identity" data-action="account"><span data-slot="avatar"></span><span><strong>You</strong><span class="level" data-slot="level"></span></span></button><div class="balance">'+icon('coin.png')+'<span class="money" data-slot="balance"></span></div><button class="icon-button" data-action="menu" aria-label="Menu">'+icon('menu.svg')+'</button></div><section class="records"><div class="records-heading">'+icon('trophy.svg')+'<span>Your best</span></div><div class="records-line"><span class="money record-value personal" data-slot="personal"></span><div class="record-top"><span class="record-summary-label">Top</span><span class="money record-value" data-slot="top"></span><span class="record-by">by</span><span class="owner-name" data-slot="owner"></span></div></div></section><div class="history" aria-label="Round history"></div></section><section class="winners panel"><div class="wins-head"><strong>Live Wins</strong><span class="online"><span class="dot"></span><span data-slot="online"></span></span><button class="text-button" data-action="wins">See all ›</button></div><div class="wins-list"></div></section></div><div class="bottom"><div class="multiplier"></div><section class="controls panel" aria-label="Bet controls"><div class="settings-row">'+button('auto','<span class="knob" aria-hidden="true"></span><span class="auto-label">Auto</span>','auto')+button('difficulty','<span data-slot="difficulty"></span><svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 10 8 6 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')+'</div><div class="stake" aria-label="Bet amount">'+button('min','MIN')+button('minus','−')+'<output class="money" data-slot="bet"></output>'+button('plus','+')+button('max','MAX')+'</div><div class="presets"></div><div class="actions">'+button('cash','<span class="action-title">CASH OUT</span><span class="money" data-slot="cash"></span>','action cash')+button('go','<span class="action-title"><span data-slot="playIcon">'+icon('play.svg')+'</span><span data-slot="goTitle"></span></span><span class="money" data-slot="goSubtitle"></span>','action go')+'</div></section></div><button class="dev" data-action="dev" hidden>DEV · UI</button><div class="toast" role="status" hidden></div><div class="modal-layer" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="crash-modal-title"><header><h2 id="crash-modal-title"></h2><button class="icon-button" data-action="close" aria-label="Close">'+icon('close.svg')+'</button></header><div class="modal-body"></div></section></div>';
  const account=host.querySelector('.account'),history=host.querySelector('.history'),column=document.createElement('div');
  column.className='account-column';account.before(column);column.append(account,history);
  this.slots=Object.fromEntries([...host.querySelectorAll('[data-slot]')].map(n=>[n.dataset.slot,n]));
  host.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)this.action(b.dataset.action,b.dataset.value);else {const control=e.target.closest('.bet-step,.bet-action');if(control&&!control.disabled)this.bettingSound.play(control.dataset.step==='-1'?'minus':control.dataset.step?'plus':'go')}});
  host.addEventListener('change',e=>{if(e.target.dataset.setting==='sound')this.bettingSound.setEnabled(e.target.checked);if(e.target.dataset.setting)this.send('setting',{key:e.target.dataset.setting,value:e.target.type==='checkbox'?e.target.checked:Number(e.target.value)});if(e.target.dataset.flag)this.send('flag',{key:e.target.dataset.flag,value:e.target.checked})});
  host.querySelector('.modal-layer').addEventListener('click',e=>{if(e.target===e.currentTarget&&this.modal!=='win')this.close()});
  this.keyHandler=e=>{if(!this.modal)return;if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.matches('[role=radio]')){e.preventDefault();const items=[...e.target.parentElement.querySelectorAll('[role=radio]')];let index=items.indexOf(e.target);index=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1)+items.length)%items.length;items[index].focus();return;}if(e.key==='Escape'&&this.modal!=='win'){e.preventDefault();if(this.modal.startsWith('limit:'))this.open('menu');else this.close()}if(e.key==='Tab'){const items=[...host.querySelectorAll('.modal button,.modal input,.modal select')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);if(!items.length){e.preventDefault();return}const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  document.addEventListener('keydown',this.keyHandler);
  this.standardControls=this.q('.controls');this.betSettings=this.q('.settings-row');this.setControlsVariant(config.controlsVariant);
  this.resize=new ResizeObserver(()=>this.layout());this.resize.observe(host);this.resize.observe(host.querySelector('.account'));this.resize.observe(column);this.resize.observe(host.querySelector('.controls'));if(this.multiBet)this.resize.observe(this.multiBet.element);
 }
 setControlsVariant(variant){
  const multi=variant==='three-position';
  if(multi&&!this.multiBet){this.multiBet=new MultiBetControls();this.q('.bottom').append(this.multiBet.element);this.resize?.observe(this.multiBet.element)}
  if(multi)this.multiBet.element.prepend(this.betSettings);
  else this.standardControls.prepend(this.betSettings);
  if(!multi&&this.multiBet){this.resize?.unobserve(this.multiBet.element);this.multiBet.element.remove();this.multiBet=null}
  this.standardControls.hidden=multi;
 }
 q(s){return this.host.querySelector(s)}
 features(){return {auto:true,difficulty:true,presets:true,...(this.state?.features||{})}}
 text(key,value){if(this.slots[key].textContent!==String(value))this.slots[key].textContent=value}
 action(action,value){
  this.bettingSound.play(action);
  if(['menu','account','wins','difficulty','dev','rules'].includes(action)){this.open(action);return}
  if(action==='close'){this.close();return}
  if(action==='back'){this.open('menu');return}
  if(action==='limit'){this.open('limit:'+value);return}
  if(action==='chooseLimit'){const [key,raw]=JSON.parse(value);const chosen=key==='theme'?raw:Number(raw);this.state.settings={...this.state.settings,[key]:chosen};this.send('setting',{key,value:chosen});this.open('menu');return}
  if(action==='chooseDifficulty'){this.send('difficulty',{index:Number(value)});this.close();return}
  if(action==='refill'){this.send('refill',{});this.close();return}
  if(action==='preset'){this.send('bet',{value:Number(value)});return}
  this.send(action,{});
 }
 update(s){
  this.winSound.update(s);
  this.bettingSound.setEnabled(s.settings?.sound===true);
  this.bettingSound.updateCashReady(s);
  this.state=s;currency=typeof s.currency==='string'?s.currency:'';this.host.hidden=false;this.host.classList.toggle('reduced',!!s.settings?.reduced_motion);
  this.text('level',s.level||'LVL 1');this.text('balance',money(s.balance));this.text('bet',money(s.bet));

  this.text('personal',money(s.personal));this.text('top',money(s.record?.payout));this.text('owner',s.record?.name||'');this.q('.record-top').title=[s.record?.name,s.record?.date].filter(Boolean).join(' · ');
  const signature=JSON.stringify([s.players,s.record?.name]);if(signature!==this.avatarSignature){this.avatarSignature=signature;this.slots.avatar.innerHTML=avatar('You',s.players)}
  this.text('difficulty',s.difficulties?.[s.difficulty]||'Normal');this.text('cash',money(s.cash));this.text('goTitle',s.goTitle||'PLAY');this.text('goSubtitle',s.goSubtitle||money(s.bet));this.text('online',(s.online||6)+' ONLINE');
  this.q('[data-action=auto]').setAttribute('aria-pressed',String(!!s.auto));
  for(const a of ['auto','difficulty','min','minus','plus','max'])this.q('[data-action='+a+']').disabled=!s.canBet;
  const go=this.q('[data-action=go]');go.disabled=!s.canGo||!!s.win;const asCash=goIsCash(s);go.classList.toggle('cash',asCash);this.slots.playIcon.hidden=asCash;
  const cash=this.q('[data-action=cash]');cash.hidden=!s.showCash;cash.disabled=!s.canCash||!!s.win; // Button visibility never changes the shared control layout.
  const presets=s.presets||[2,3,8,20];const presetKey=JSON.stringify(presets);if(presetKey!==this.lastPresets){this.lastPresets=presetKey;this.q('.presets').innerHTML=presets.map(v=>'<button class="button" data-action="preset" data-value="'+Number(v)+'">'+esc(money(v).replace('.00',''))+'</button>').join('')}
  for(const b of this.q('.presets').children){b.disabled=!s.canBet;b.setAttribute('aria-pressed',String(Number(b.dataset.value)===s.bet))}
  const flags=s.flags||{};this.q('.personal').hidden=false;this.q('.record-top').hidden=false;this.q('.records').hidden=flags.personal_record===false;
  this.q('.winners').hidden=flags.leaderboard===false;this.q('.history').hidden=flags.history===false;this.q('.online').hidden=flags.online_count===false;this.q('.dev').hidden=true;
  // Operator features remove whole groups; the grid releases their tracks.
  const features=this.features(),controls=this.multiBet?.element||this.standardControls,settingsVisible=features.auto||features.difficulty;
  this.q('[data-action=auto]').hidden=!features.auto;this.q('[data-action=difficulty]').hidden=!features.difficulty;this.q('.settings-row').hidden=!settingsVisible;this.q('.presets').hidden=!features.presets;
  controls.classList.toggle('no-settings',!settingsVisible);controls.classList.toggle('auto-only',features.auto&&!features.difficulty);controls.classList.toggle('difficulty-only',features.difficulty&&!features.auto);controls.classList.toggle('no-presets',!features.presets);
  const featureKey=JSON.stringify(features);if(featureKey!==this.lastFeatures){const changed=this.lastFeatures!==undefined;this.lastFeatures=featureKey;const modal=this.modal||'';if((modal==='difficulty'&&!features.difficulty)||(modal.startsWith('limit:auto')&&!features.auto))this.close();else if(changed&&modal==='menu')this.open('menu')}
  const winsKey=JSON.stringify(s.wins);if(winsKey!==this.lastWins){this.lastWins=winsKey;this.q('.wins-list').innerHTML=this.winRows((s.wins||[]).slice(0,5));if(this.modal==='wins')this.q('.modal-body').innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>'}
  const histKey=JSON.stringify(s.history);if(histKey!==this.lastHistory){this.lastHistory=histKey;this.q('.history').innerHTML=(s.history||[]).slice(0,15).map(v=>'<span class="pill">'+Number(v.multiplier).toFixed(2)+'×</span>').join('')}
  const multiplierTint=Number(s.multiplier)>=10?'gold':Number(s.multiplier)>=5?'purple':Number(s.multiplier)>=2?'success':'cyan';
  this.q('.multiplier').style.setProperty('--multiplier-color',`var(--${multiplierTint})`);
  this.q('.multiplier').hidden=s.game==='road';this.q('.multiplier').textContent=Number(s.multiplier||1).toFixed(2)+'×';
  this.q('.toast').hidden=!s.toast;this.q('.toast').textContent=s.toast||'';
  if(s.win&&this.modal!=='win')this.open('win');else if(!s.win&&this.modal==='win')this.close();
  if(this.modal==='win'){const total=this.q('.win-total');if(total)total.textContent=money(s.winAmount);const subtitle=this.q('.win-subtitle');if(subtitle)subtitle.textContent=s.winSubtitle||'Well played!'}
  if(this.modal==='difficulty'&&!s.canBet)this.close();
  const transfer=s.winTransferId||0;
  if(this.lastTransferId!==undefined&&transfer!==this.lastTransferId&&s.win){this.winSound.playTransfer();requestAnimationFrame(()=>this.flyWinCoins())}
  this.lastTransferId=transfer;
  if(s.settings?.reduced_motion)this.clearWinCoins();
  this.standardControls.hidden=!!this.multiBet;
  this.layout();
 }
 clearWinCoins(){
  if(this.coinFrame)cancelAnimationFrame(this.coinFrame);
  this.coinFrame=0;this.coinLayer?.remove();this.coinLayer=null;
 }
 flyWinCoins(){
  this.clearWinCoins();
  if(this.modal!=='win'||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const source=this.q('.win-coin'),target=this.q('.balance .icon');
  if(!source||!target)return;
  const layer=document.createElement('div');layer.className='win-coin-flight';layer.setAttribute('aria-hidden','true');this.host.append(layer);this.coinLayer=layer;
  const coins=Array.from({length:CrashTokens.WEB_WIN_COIN_COUNT},()=>{const coin=document.createElement('img');coin.src=base+'assets/icons/coin.png';coin.alt='';layer.append(coin);return coin});
  const start=performance.now();
  const tick=now=>{
   if(!source.isConnected||this.modal!=='win'||this.state.settings?.reduced_motion||matchMedia('(prefers-reduced-motion: reduce)').matches){this.clearWinCoins();return}
   const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
   coins.forEach((coin,i)=>{
    const p=Math.max(0,Math.min(1,(now-start-i*CrashTokens.WEB_WIN_COIN_STAGGER_MS)/CrashTokens.WEB_WIN_COIN_DURATION_MS));
    const t=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const arc=Math.sin(t*Math.PI),x=a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*t+85*Math.sin(i*1.8)*arc;
    const y=a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*t-100*arc;
    coin.style.opacity=String(Math.min(t*10,1)*Math.min((1-t)*10,1));
    coin.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${arc*(i%2===0?.5:-.5)}rad) scale(${.8+.4*arc})`;
   });
   if(now-start<CrashTokens.WEB_WIN_COIN_DURATION_MS+(coins.length-1)*CrashTokens.WEB_WIN_COIN_STAGGER_MS)this.coinFrame=requestAnimationFrame(tick);else this.clearWinCoins();
  };
  this.coinFrame=requestAnimationFrame(tick);
 }
 radioOption(action,value,selected,title,description='',reward='',rewardLabel=''){
  return '<button type="button" class="radio-option" role="radio" data-action="'+action+'" data-value="'+esc(value)+'" aria-checked="'+selected+'" tabindex="'+(selected?0:-1)+'"><img class="radio-marker" src="'+base+'assets/icons/radio_'+(selected?'on':'off')+'.svg" alt=""><span class="option-details"><span class="option-title">'+esc(title)+'</span>'+(description?'<span class="option-description">'+esc(description)+'</span>':'')+'</span>'+(reward?'<span class="option-reward"><span class="money">'+esc(reward)+'</span><span class="option-caption">'+esc(rewardLabel)+'</span></span>':'')+'</button>';
 }
 limitOptions(){
  const s=this.state,result={auto_steps:{title:'Cash out after',values:[0,3,5,10,15,20],suffix:s.game==='road'?' steps':s.game==='fruits'?' slices':' sec'},auto_cashout:{title:'Cash out at',values:[0,1.25,1.5,2,3,5,10,20],suffix:'×'}};
  // Only for games whose scene actually repaints: Fuel Run draws painted art layers that a
  // palette no longer touches, so the row offered a choice that changed nothing.
  if(!['road','fuel'].includes(s.game))result.theme={title:s.game==='fruits'?'Atmosphere':'Next session atmosphere',values:s.game==='fish'?['Caribbean','Sunset']:s.game==='fruits'?['Tropical','Sunset']:['Treasure','Market'],suffix:''};
  return result;
 }
 limitText(value,suffix){return value===0?'Off':String(value)+suffix}
 limitRow(key,option){const current=this.state.settings?.[key]??option.values[0];return '<div class="setting"><span>'+esc(option.title)+'</span><button class="button flat-button" data-action="limit" data-value="'+key+'">'+esc(this.limitText(current,option.suffix))+' <span aria-hidden="true">›</span></button></div>'}
 winRows(rows){return rows.map(v=>'<div class="winner">'+avatar(v.name,this.state.players)+'<span class="winner-name">'+esc(v.name)+'</span><span class="win-multiple">'+Number(v.multiplier||1).toFixed(2)+'×</span><span class="money">+'+money(v.payout)+'</span></div>').join('')}
 open(kind){
  const s=this.state,f=this.features();if(kind==='difficulty'&&(!s.canBet||!f.difficulty))return;if(kind.startsWith('limit:auto')&&!f.auto)return;if(s.win&&kind!=='win')return;
  if(!this.modal)this.lastFocus=document.activeElement;this.modal=kind;this.send('modal',{open:true});
  const layer=this.q('.modal-layer');layer.hidden=false;layer.classList.toggle('is-win',kind==='win');this.q('.modal').classList.toggle('win-modal',kind==='win');
  this.q('.modal h2').textContent={menu:'Menu',account:'Your account',wins:'Live Wins',difficulty:'Choose difficulty',rules:'How to play',dev:'Visible panels',win:'NICE WIN!'}[kind];
  this.q('[data-action=close]').hidden=kind==='win'&&!this.config.demo;
  const body=this.q('.modal-body');
  if(kind==='difficulty'){
   const content=s.difficultyContent||{};
   body.innerHTML='<p class="modal-description">'+esc(content.description||'Higher risk. Bigger rewards.')+'</p><p class="modal-note">'+esc(content.limits||'')+'</p><div class="option-list" role="radiogroup" aria-label="Difficulty">'+(content.options||[]).map((v,i)=>this.radioOption('chooseDifficulty',i,i===s.difficulty,v.title,v.description,v.reward,v.rewardLabel)).join('')+'</div>';
  }
  if(kind==='menu'){
   body.innerHTML=(this.config.menuSettings||['sound','music','haptics']).map(k=>'<label class="setting">'+({sound:'Sound',music:'Music',haptics:'Vibration',reduced_motion:'Reduce motion'}[k])+'<input class="switch" type="checkbox" role="switch" data-setting="'+k+'" '+(s.settings?.[k]?'checked':'')+'></label>').join('');
   const limits=this.limitOptions();
   if(limits.theme)body.innerHTML+=this.limitRow('theme',limits.theme);
   if(f.auto){
    body.innerHTML+='<h3 class="modal-section-title">Auto limits</h3>';
    for(const key of ['auto_steps','auto_cashout'])body.innerHTML+=this.limitRow(key,limits[key]);
    body.innerHTML+='<p class="modal-note">First limit reached cashes out. '+(s.game==='road'?'Auto stops after each round.':'Auto starts the next round until switched off or balance is too low.')+'</p>';
   }
   if(this.config.rulesHTML)body.innerHTML+=button('rules','How to play','flat-button');
   if(this.config.refill!==false&&this.state?.refill!==false)body.innerHTML+=button('refill','Refill to $1,000','flat-button');
   body.innerHTML+='<p class="modal-note centered">'+esc(this.config.menuNote||'Progress saved on this device')+'</p>';
  }
  if(kind==='rules')body.innerHTML='<button class="text-button back-button" data-action="back">← Back to menu</button>'+this.config.rulesHTML;
  if(kind.startsWith('limit:')){
   const key=kind.slice(6),option=this.limitOptions()[key];
   this.q('.modal h2').textContent=option.title;
   body.innerHTML='<button class="text-button back-button" data-action="back">← Back to menu</button><div class="option-list" role="radiogroup" aria-label="'+esc(option.title)+'">'+option.values.map(v=>this.radioOption('chooseLimit',JSON.stringify([key,v]),String(s.settings?.[key]??option.values[0])===String(v),this.limitText(v,option.suffix))).join('')+'</div>';
  }
  if(kind==='account'){
   body.innerHTML='<div class="account-summary">'+avatar('You',s.players)+'<div><p>You · Level '+(1+Math.floor((s.xp||0)/10))+'</p><p class="modal-note">'+((s.xp||0)%10)+' / 10 XP</p></div></div>';
   const row=(k,v,tone='')=>'<div class="setting"><span>'+esc(k)+'</span><strong class="account-stat '+tone+'">'+esc(v)+'</strong></div>';
   body.innerHTML+=row('Balance',money(s.balance))+row('Personal record',money(s.personal),'gold')+'<h3 class="modal-section-title">This session</h3>'+row('Completed rounds',s.rounds||0)+row('Successful cash outs',s.roundWins||0,'success')+row('Best cashed-out multiplier',s.roundWins?Number(s.bestMultiplier||0).toFixed(2)+'×':'—','gold');
  }
  if(kind==='wins')body.innerHTML=this.winRows(s.wins||[])||'<p class=muted>No wins yet.</p>';
  if(kind==='dev')body.innerHTML=Object.entries({leaderboard:'Leaderboard / live wins',history:'Round history',personal_record:'My record',online_count:'Online count',...(s.game==='market_stack'?{multiplier_ladder:'Multiplier ladder'}:{})}).map(([k,v])=>'<label class="setting">'+v+'<input class="switch" type="checkbox" role="switch" data-flag="'+k+'" '+(s.flags?.[k]!==false?'checked':'')+'></label>').join('');
  if(kind==='win'){
   body.innerHTML='<img class="win-coin" src="'+base+'assets/icons/coin.png" alt=""><div class="win-total">'+money(s.winAmount)+'</div><div class="win-subtitle">'+esc(s.winSubtitle||'Well played!')+'</div>';
   if(!s.settings?.reduced_motion){const fx=document.createElement('div');fx.className='confetti';fx.innerHTML=Array.from({length:32},(_,i)=>'<i style="--angle:'+i*13+'deg;--x:'+((Math.random()-.5)*600)+'px;--y:'+(Math.random()*400-240)+'px"></i>').join('');layer.append(fx);setTimeout(()=>fx.remove(),2000)}
  }
  for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=true;
  requestAnimationFrame(()=>{const target=layer.querySelector('button:not([hidden]),input,select');if(target)target.focus();else{this.q('.modal').tabIndex=-1;this.q('.modal').focus()}});
 }
 close(){this.clearWinCoins();this.modal='';this.q('.modal-layer').hidden=true;for(const n of [this.q('.top'),this.q('.bottom'),this.q('.dev')])n.inert=false;this.send('modal',{open:false});if(this.lastFocus?.isConnected)this.lastFocus.focus()}
 layout(){
  const wide=innerWidth>=CrashTokens.CRASH_LAPTOP_BREAKPOINT;
  const winners=this.q('.winners'),top=this.q('.top'),account=this.q('.account');
  const parent=wide?top:account;if(winners.parentElement!==parent){if(wide)top.append(winners);else account.insertBefore(winners,this.q('.records'))}
  const a=this.q('.account-column').getBoundingClientRect(),b=this.q('.bottom').getBoundingClientRect();
  this.host.style.setProperty('--dev-top',(Math.max(a.bottom,wide?winners.getBoundingClientRect().bottom:0)+8)+'px');
  // The fishing boat occupies the right side; reserve the taller Live Wins panel too.
  const sceneTop=this.state.game==='gold'?account.getBoundingClientRect().bottom:
   ['fish','catch'].includes(this.state.game)&&wide?Math.max(a.bottom,winners.getBoundingClientRect().bottom):a.bottom;
  const bounds={top:Math.round(sceneTop+12),bottom:Math.round(b.top),width:innerWidth,height:innerHeight};
  const key=JSON.stringify(bounds);if(key!==this.lastBounds){this.lastBounds=key;this.send('layout',bounds)}
 }
 destroy(){this.winSound.destroy();this.bettingSound.destroy();this.clearWinCoins();this.resize.disconnect();document.removeEventListener('keydown',this.keyHandler);this.host.remove()}
}
let callback=null,instance=null;
window.CrashUI={GameUI,MultiBetControls,connect(fn){callback=fn;if(!instance){const host=document.createElement('div');host.hidden=true;document.body.append(host);instance=new GameUI(host,(action,data)=>callback?.(JSON.stringify({action,...data})));}return true},receive(state){instance?.update(typeof state==='string'?JSON.parse(state):state)},get instance(){return instance}};
})();
