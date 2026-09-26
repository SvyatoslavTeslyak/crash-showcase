/* Simulated vote for the prototype: about ten thousand Lotomobil players over the voting
 * window, seeded so every visitor sees the same story. The shape is deliberate: launch-day
 * rush, evening peaks, busier weekends, Goat Gold ahead early, Fish Master taking the lead
 * mid-way, a Goat Gold rally after its trailer, then Fish Master pulling away at the end. */
(function(root){
  const HOUR=3600e3;
  const OPEN=Date.UTC(2026,10,2,0,0);           // Mon 2 Nov, 00:00
  const CLOSE=Date.UTC(2026,10,22,20,0);        // Sun 22 Nov, 20:00
  const NOW=CLOSE-((4*24+11)*3600+32*60)*1000;  // the prototype's "now": 4d 11h 32m before close
  const TARGET_NOW=10000;                       // votes cast by "now"

  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  // How busy each hour is: evenings, weekends, launch day, trailer day, the final weekend.
  function weight(t){
    const d=new Date(t),day=(t-OPEN)/(24*HOUR),h=d.getUTCHours(),wd=d.getUTCDay();
    const hour=[.25,.18,.12,.1,.1,.14,.3,.5,.65,.7,.72,.78,.9,.85,.8,.82,.95,1.15,1.45,1.7,1.8,1.6,1.1,.55][h];
    let w=hour*(wd===0||wd===6?1.25:1);
    w*=1+1.4*Math.exp(-day/1.4);                 // launch rush
    if(day>=8&&day<9.5)w*=1.45;                  // Goat Gold trailer drops
    if(day>=18)w*=1.3+0.5*(day-18);              // last-weekend push
    return w;
  }
  // Chance a vote goes to Fish Master at a moment in the race.
  function fishShare(t){
    const day=(t-OPEN)/(24*HOUR);
    if(day<2)return .43;                                        // Goat Gold starts ahead
    if(day<7)return .43+.16*(day-2)/5;                          // Fish Master catches up
    if(day<8)return .59;
    if(day<11.5)return .59-.21*Math.sin(Math.PI*(day-8)/3.5);   // Goat Gold rally after its trailer
    return .56+.02*Math.min(1,(day-11.5)/6);                    // Fish Master pulls away
  }

  const FIRST=['Jean','Marie','Wood-Mardy','Ketly','Jameson','Rose-Merline','Stevenson','Fabienne','Widlyne','Ricardo','Nadège','Frantz','Guerline','Junior','Mackenson','Djenane','Wilnor','Esther','Peterson','Sabine','Jocelyn','Natacha','Evens','Roseline','Kervens','Mirlande','Samuel','Darline','Fritznel','Judith','Clifford','Nathalie','Wesner','Lovely','Emmanuel','Tamara'];
  const LAST='ABCDEFGHJLMNPRSTV';

  function build(){
    const r=rng(20261102);
    // Spread TARGET_NOW votes over the hours up to NOW in proportion to weight, then keep
    // going to CLOSE at the same scale.
    const hours=[];for(let t=OPEN;t<CLOSE;t+=HOUR)hours.push(t);
    const upToNow=hours.filter(t=>t<NOW).reduce((a,t)=>a+weight(t),0);
    const scale=TARGET_NOW/upToNow;
    const votes=[];let carry=0;
    for(const t of hours){
      const want=weight(t)*scale*(0.85+r()*0.3)+carry,n=Math.floor(want);carry=want-n;
      for(let i=0;i<n;i++){
        const at=t+Math.floor(r()*HOUR);
        if(at>=CLOSE)continue;
        votes.push({at,side:r()<fishShare(at)?'fish':'goat',name:FIRST[Math.floor(r()*FIRST.length)]+' '+LAST[Math.floor(r()*LAST.length)]+'.',both:r()<(.58+.14*Math.min(1,(at-OPEN)/(10*24*HOUR)))});
      }
    }
    votes.sort((a,b)=>a.at-b.at);
    return votes;
  }

  const votes=build();
  // Running share every six hours, for the race chart.
  function series(until){
    const out=[];let f=0,n=0,i=0;
    for(let t=OPEN+6*HOUR;t<=until+1;t+=6*HOUR){
      while(i<votes.length&&votes[i].at<t){if(votes[i].side==='fish')f++;n++;i++}
      if(n>=250)out.push({t,share:f/n,total:n});
    }
    return out;
  }
  function tally(until){let fish=0,goat=0,both=0;for(const v of votes){if(v.at>=until)break;v.side==='fish'?fish++:goat++;if(v.both)both++}return{fish,goat,total:fish+goat,both}}
  function leadChanges(s){let c=0,prev=null;for(const p of s){const lead=p.share>=.5?'fish':'goat';if(prev&&lead!==prev)c++;prev=lead}return c}
  function recent(until,k){const out=[];for(let i=votes.length-1;i>=0&&out.length<k;i--)if(votes[i].at<until)out.push(votes[i]);return out}
  function between(a,b){return votes.filter(v=>v.at>=a&&v.at<b)}

  root.SeasonSim={OPEN,CLOSE,NOW,votes,series,tally,leadChanges,recent,between,names:FIRST,initials:LAST,rng};
})(typeof window!=='undefined'?window:globalThis);
