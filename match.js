// Etie Phase 4 — simple explainable matcher (no AI)
// Plain English: score = shared interests 50% + personality 20% + availability 20% + local offer 10%
// Always returns reasons so UI can say WHY.
function etieNorm(s){return (s||'').toLowerCase().trim();}
function etieWords(s){return etieNorm(s).split(/[^a-z]+/).filter(Boolean);}

function etieShared(travInterests, local){
  var localPool=(local.interests||[]).concat(local.offerTags||[]);
  var shared=[];var seen={};
  (travInterests||[]).forEach(function(t){
    var tw=etieWords(t);
    localPool.forEach(function(l){
      var lw=etieWords(l);
      var hit=tw.some(function(w){return lw.indexOf(w)!==-1;})||lw.some(function(w){return tw.indexOf(w)!==-1;});
      if(hit&&!seen[etieNorm(l)]){seen[etieNorm(l)]=1;shared.push(l);}
    });
  });
  return shared;
}

function etiePersonality(tP, lP){
  try{
    // 1-10 scale: max total diff is 27 (9 per trait x 3). Closer = higher.
    var d=Math.abs(tP.social-lP.social)+Math.abs(tP.spontaneous-lP.spontaneous)+Math.abs(tP.curious-lP.curious);
    return Math.max(0,Math.round(100-d*(100/27)));
  }catch(e){return 50;}
}

function etieAvailability(local, userAvail){
  // MVP: traveller dates are free text, so we check local has any Available slot.
  // Later: real date overlap. User's own availability (if local-viewing) can boost.
  var has=(local.availability||[]).some(function(a){
    if(typeof a==='string')return true;
    return a.status==='Available';
  });
  return has?100:40;
}

function etieLocalValue(trav, local){
  var text=etieNorm((local.offer||'')+' '+(local.offerTags||[]).join(' '));
  var keys=(trav.interests||[]).concat(trav.lookingFor||[]);
  var hits=0;
  keys.forEach(function(k){etieWords(k).forEach(function(w){if(w.length>3&&text.indexOf(w)!==-1)hits++;});});
  if(hits>=3)return 100;if(hits===2)return 80;if(hits===1)return 60;return 35;
}

// Reviews v2 — reputation + learned tag affinity (toggle: window.ETIE_REVIEWS_V2=false for old ranking)
window.ETIE_REVIEWS_V2 = (window.ETIE_REVIEWS_V2 !== false);
function etieReviewStats(local, reviews){
  try{
    var baseR=(local.stats&&local.stats.rating)||4.5, baseN=(local.stats&&local.stats.reviews)||0;
    var sum=0, n=0, myRating=0;
    var r=reviews&&reviews[local.id];
    if(r&&r.trav&&r.trav.rating){myRating=+r.trav.rating;sum+=myRating;n++;}
    // aggregate tags across ALL highly-rated locals (learned taste, not just this local)
    var allTags={};
    try{
      Object.keys(reviews||{}).forEach(function(k){
        var t=(reviews[k]&&reviews[k].trav)||null;
        if(t&&(+t.rating>=4))(t.tags||[]).forEach(function(tag){allTags[tag]=(allTags[tag]||0)+1;});
      });
    }catch(e){}
    var eff=(baseR*baseN+sum)/(baseN+n||1);
    return {rating:Math.round(eff*10)/10, count:baseN+n, userRatings:n, myRating:myRating, allTags:allTags};
  }catch(e){return {rating:4.5,count:0,userRatings:0,myRating:0,allTags:{}};}
}
// Tags describe WHY it clicked — amplify the matching factor behind each tag.
function etieTagAffinity(local, allTags, s){
  try{
    var bonus=0;
    var has=function(t){return (allTags||{})[t]>0;};
    if(has('Shared interests')&&s.interestScore>=50)bonus+=2;
    if(has('Personality')&&s.pers>=75)bonus+=2;
    if(has('Conversation')&&s.pers>=70)bonus+=2;
    if(has('Activity')&&s.value>=60)bonus+=2;
    if(has('Local knowledge')&&s.value>=60)bonus+=2;
    return Math.min(6,bonus);
  }catch(e){return 0;}
}
function etieScoreLocal(trav, trip, local, userAvail, reviews){
  var shared=etieShared(trav.interests, local);
  var maxShared=Math.max(1, Math.min(4, (trav.interests||[]).length));
  var interestScore=Math.min(100, shared.length/maxShared*100);
  var pers=etiePersonality(trav.personality, local.personality);
  var avail=etieAvailability(local, userAvail);
  var value=etieLocalValue(trav, local);
  var total=Math.round(interestScore*0.5+pers*0.2+avail*0.2+value*0.1);
  var rep={rating:0,count:0,userRatings:0,allTags:{}}, repBonus=0, tagBonus=0, repNote='';
  if(window.ETIE_REVIEWS_V2){
    rep=etieReviewStats(local, reviews);
    // Bayesian-flavoured bonus: proven 4.7★+ locals rise slightly
    if(rep.count>=1&&rep.rating>=4.7)repBonus=3;
    else if(rep.count>=3&&rep.rating>=4.5)repBonus=2;
    // your own experience outweighs the crowd for YOUR ranking
    if(rep.myRating>=1&&rep.myRating<=2)repBonus=-8;
    tagBonus=etieTagAffinity(local, rep.allTags, {interestScore:interestScore,pers:pers,value:value});
    total=Math.max(5,Math.min(99,total+repBonus+tagBonus));
    repNote=rep.count?(' · '+rep.rating+'★ ('+rep.count+')'):'';
    if(rep.userRatings>=1)repNote+=' · you: '+rep.myRating+'★';
  }
  var label=total>=75?'Strong match':(total>=55?'Good match':'Okay match');
  if(window.ETIE_REVIEWS_V2&&rep.myRating>=1&&rep.myRating<=2)label='Okay match';
  
  // Beginner filter: if traveller is beginner (<=3 completed trips) and no shared interests, score = 0
  var travCompleted = (typeof ETIE!=='undefined' && ETIE.traveller) ? (ETIE.traveller.completedTrips || 0) : 0;
  var isBeginner = travCompleted <= 3;
  if(isBeginner && shared.length === 0){
    return {
      local: local, score: 0, label: 'No shared interests',
      shared: [], interestScore: 0,
      pers: Math.round(pers), avail: Math.round(avail), value: Math.round(value),
      rep: rep.rating, repCount: rep.count, repBonus: repBonus, tagBonus: tagBonus, myRating: rep.myRating
    };
  }
  
  return {
    local: local, score: total, label: label+repNote,
    shared: shared, interestScore: Math.round(interestScore),
    pers: Math.round(pers), avail: Math.round(avail), value: Math.round(value),
    rep: rep.rating, repCount: rep.count, repBonus: repBonus, tagBonus: tagBonus, myRating: rep.myRating
  };
}

function etieRank(trav, trip, locals, userAvail, reviews){
  return locals.map(function(l){return etieScoreLocal(trav, trip, l, userAvail, reviews);})
    .sort(function(a,b){return b.score-a.score;});
}
window.EtieMatch={score:etieScoreLocal,rank:etieRank,shared:etieShared};
