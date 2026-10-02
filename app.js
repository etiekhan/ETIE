// Etie Phase 6 — onboarding + requests + meetup + reviews (vanilla JS + localStorage)
// Plain English: plan → complete → both review. Trips shows live status.
var ETIE_KEY = 'etie-v1';

function todayISO(){ try{ var d=new Date(); var m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return d.getFullYear()+'-'+m+'-'+day; }catch(e){ return ''; } }
function uuidv4(){try{return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,(c)=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c).toString(16));}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,(c)=>((c||crypto.randomUUID?crypto.randomUUID():0).toString(16)));}}

function etieDefaults() {
  return {
    activeRole: null,
    trip: { destination: 'Hong Kong', dates: '', dateFrom: todayISO(), dateTo: '', country: 'HK', district: 'Central / Soho' },
    traveller: {
      nickname: '',
      nationality: 'HK',
      verificationMethods: [],
      interests: [],
      sidequestModifiers: {},
      personality: { social: 5, spontaneous: 5, curious: 5 },
      socialVibe: null, travelPace: null, _vibeSet: false, styleInterests: [],
      lookingFor: [],
      hook: '',
      photo: null,
      travelPhotos: [],
      tier: 'Rookie',
      completedTrips: 0,
      avgRatingReceived: 0
    },
    local: {
      displayName: '',
      city: 'Hong Kong', district: 'Central / Soho', age: '', nationality: 'HK',
      verificationMethods: [],
      interests: [],
      sidequestModifiers: {},
      personality: { social: 5, spontaneous: 5, curious: 5 },
      socialVibe: 1, travelPace: 1, styleInterests: [],
      availDates: [], travelPhotos: [],
      offer: '',
      offerTags: [],
      availability: [
        { label: 'Weekday evenings', status: 'Available' },
        { label: 'Weekend afternoons', status: 'Available' },
        { label: 'Other times', status: 'Ask me' }
      ],
      photo: null,
      tier: 'Rookie',
      hostedCount: 0,
      avgHostRating: 0,
      references: [],
      activities: []
    },
    requests: {},
    messages: {},
    meetups: {},
    reviews: {},
    reports: [],
    _travStars: 0,
    _localStars: 0,
    _lastTrav: 1,
    _lastLocal: 1,
    _pers10: true
  };
}

function etieNorm15(v){v=+v;if(isNaN(v))return 5;if(v>10)return Math.min(10,Math.max(1,Math.round(v/10)));return Math.min(10,Math.max(1,Math.round(v)));}
function etieNormPers(p){try{return {social:etieNorm15(p.social),spontaneous:etieNorm15(p.spontaneous),curious:etieNorm15(p.curious)};}catch(e){return {social:3,spontaneous:3,curious:3};}}
function loadState() {
  try {
    var raw = localStorage.getItem(ETIE_KEY);
    if (!raw) { var d = etieDefaults(); localStorage.setItem(ETIE_KEY, JSON.stringify(d)); return d; }
    var s = JSON.parse(raw);
    var def = etieDefaults();
    if(s.activeRole==null) s.activeRole=null;
    if(s._lastTrav==null) s._lastTrav=1;
    if(s._lastLocal==null) s._lastLocal=1;
    if(s.traveller&&s.traveller.verificationMethods==null) s.traveller.verificationMethods=[];
    s.trip = Object.assign(def.trip, s.trip || {});
    s.traveller = Object.assign(def.traveller, s.traveller || {});
    s.local = Object.assign(def.local, s.local || {});
    // migrate old 0-100 slider values to 1-5
    try{ if(s.traveller&&s.traveller.personality)s.traveller.personality=etieNormPers(s.traveller.personality); }catch(e){}
    try{ if(s.local&&s.local.personality)s.local.personality=etieNormPers(s.local.personality); }catch(e){}
    // one-time migration: 1-5 scale → 1-10 (x2). 0-100 legacy already handled above.
    if(!s._pers10){
      ['traveller','local'].forEach(function(r){
        var p=s[r]&&s[r].personality;
        if(p){['social','spontaneous','curious'].forEach(function(k){
          var v=+p[k];
          if(v>10)v=Math.round(v/10);
          else if(v>=1&&v<=5)v=Math.min(10,v*2);
          p[k]=Math.min(10,Math.max(1,v||5));
        });}
      });
      s._pers10=true;
    }
    if(!s.requests)s.requests={};
    if(!s.traveller.travelPhotos)s.traveller.travelPhotos=[];
    if(!s.traveller.nickname) s.traveller.nickname='';
    if(s.traveller.bio==null) s.traveller.bio='';
    if(!s.profileStep) s.profileStep=1;
    if(s.profileComplete==null) s.profileComplete=false;
    if(s.inviteOk==null) s.inviteOk=false;
    if(!s.inviteCode) s.inviteCode='';
    if(s.cloudOnboarded==null) s.cloudOnboarded=false;
    s._editingProfile=false;
    if(!Array.isArray(s.traveller.memories)) s.traveller.memories=[];
    if(!Array.isArray(s.traveller.spots)) s.traveller.spots=[];
    if(!s.traveller.activityStats||typeof s.traveller.activityStats!=='object') s.traveller.activityStats={};
    if(!Array.isArray(s.photoOutbox)) s.photoOutbox=[];
    if(s.traveller.socialVibe==null){ var sc=s.traveller.personality&&s.traveller.personality.social||5; s.traveller.socialVibe=sc<=3?0:sc>=8?2:1; }
    if(s.traveller.travelPace==null){ var pc=s.traveller.personality&&s.traveller.personality.spontaneous||5; s.traveller.travelPace=pc<=3?0:pc>=8?2:1; }
    if(!s.traveller.styleInterests)s.traveller.styleInterests=[];
    if(s.traveller.nationality==null) s.traveller.nationality='';
    if(!s.local.styleInterests)s.local.styleInterests=[];
    if(s.local.displayName==null) s.local.displayName='';
    if(s.local.socialVibe==null){ var lsc=s.local.personality&&s.local.personality.social||5; s.local.socialVibe=lsc<=3?0:lsc>=8?2:1; }
    if(s.local.travelPace==null){ var lpc=s.local.personality&&s.local.personality.spontaneous||5; s.local.travelPace=lpc<=3?0:lpc>=8?2:1; }
    if(!s.local.availDates)s.local.availDates=[];
    if(!s.local.travelPhotos)s.local.travelPhotos=[];
    if(!s.messages)s.messages={};
    if(!s.meetups)s.meetups={};
    if(!s.reviews)s.reviews={};
    if(!s.reports)s.reports=[];
    if(s.mapPins==null)s.mapPins=[];
    // v4 map-first: purge all legacy seed/demo/guide pins — live hooks only
    if(!s._pinsV4){
      try{
        s.mapPins=(s.mapPins||[]).filter(function(p){
          if(!p||!p.id)return false;
          if(p.id.indexOf('seed-')===0)return false;
          if(p.kind==='guide')return false;
          return true;
        });
      }catch(e){ s.mapPins=[]; }
      s._pinsV4=true;
      try{ localStorage.setItem(ETIE_KEY, JSON.stringify(s)); }catch(e){}
    }
    // one-time clean-defaults migration: wipe demo pre-fills for fresh traveller flow (only start date = today)
    if(!s._cleanDefaultsV1){
      var hasRealActivity = s.requests && Object.keys(s.requests).length>0;
      // treat legacy demo interests/hook as pre-fill to clear if no real activity
      var demoInt = ['Football','Salsa','Cooking','Thrift shopping'];
      var isDemoInt = s.traveller.interests && s.traveller.interests.length===4 && demoInt.every(function(x){return s.traveller.interests.indexOf(x)!==-1;});
      if(!hasRealActivity){
        // force blank traveller flow 1-6: only dateFrom = today
        s.trip.destination=''; s.trip.country=''; s.trip.dates=''; s.trip.dateFrom=todayISO(); s.trip.dateTo='';
        if(isDemoInt) s.traveller.interests=[];
        if(s.traveller.lookingFor && s.traveller.lookingFor.length===1 && s.traveller.lookingFor[0].indexOf('Hidden Gems')!==-1) s.traveller.lookingFor=[];
        // style chips + hook blank (keep neutral personality 5/5/5, vibe 1/1 is okay but chips cleared)
        s.traveller.styleInterests=[];
        if(s.traveller.hook && s.traveller.hook.length<80 && s.traveller.hook.indexOf('guidebook')!==-1) s.traveller.hook='';
        // photo/travel photos must be empty when off-cloud — clear stale base64 demo photo if no cloud session yet
        try{
          var hasCloud = window.EtieCloud && window.EtieCloud.isSharedOn && window.EtieCloud.isSharedOn();
          if(!hasCloud){
            // keep photo only if user explicitly set after this migration; clear old base64 blob for clean slate
            if(s.traveller.photo && typeof s.traveller.photo==='string' && s.traveller.photo.slice(0,22).indexOf('data:image')===0){
              // don't wipe if user is currently on Traveller Step 6 with a real recent upload — heuristic: wipe only demo-era blobs (>50k chars) or when flagged demo
              s.traveller.photo=null; s.traveller.travelPhotos=[];
            }
          }
        }catch(e){ s.traveller.photo=null; s.traveller.travelPhotos=[]; }
        s.traveller.nationality=''; s.traveller.nickname='';
      } else {
        // even with activity, ensure nationality not forced to HK and dateTo blank if never set
        if(s.traveller.nationality==='HK' && !s.traveller.nickname) s.traveller.nationality='';
      }
      s._cleanDefaultsV1=true;
      try{ localStorage.setItem(ETIE_KEY, JSON.stringify(s)); }catch(e){}
    }
    // v2: profile truly empty-start — clear untouched vibe/personality display defaults
    if(!s._cleanDefaultsV2){
      var noActivity = !(s.requests && Object.keys(s.requests).length);
      if(noActivity){
        // if user never touched Step 3 (no flag, no style tags), reset vibe to null = "Not set yet"
        if(!s.traveller._vibeSet && !(s.traveller.styleInterests&&s.traveller.styleInterests.length)){
          s.traveller.socialVibe=null; s.traveller.travelPace=null; s.traveller._vibeSet=false;
          s.traveller.personality={social:5,spontaneous:5,curious:5};
        }
        // clear any legacy personality display that was never user-set is handled by _vibeSet flag in renderProfiles
      }
      if(s.traveller.socialVibe==null && s.traveller._vibeSet==null) s.traveller._vibeSet=false;
      s._cleanDefaultsV2=true;
      try{ localStorage.setItem(ETIE_KEY, JSON.stringify(s)); }catch(e){}
    }
    // v3: start date always rolls to today when no real trip yet (stale 20th -> 21st)
    try{
      var noReq=!(s.requests && Object.keys(s.requests).length);
      var today=todayISO();
      if(noReq && today && (!s.trip.dateFrom || s.trip.dateFrom<today) && !s.trip.destination){
        s.trip.dateFrom=today; s.trip.dateTo=''; s.trip.dates='';
        try{ localStorage.setItem(ETIE_KEY, JSON.stringify(s)); }catch(e){}
      }
    }catch(e){}
    return s;
  } catch (e) { return etieDefaults(); }
}
var ETIE = loadState();
function saveState() { try { localStorage.setItem(ETIE_KEY, JSON.stringify(ETIE)); } catch (e) {} try { if (typeof window!=='undefined' && window.EtieCloud && window.EtieCloud.push) window.EtieCloud.push(); } catch (e) {} }

// Photo handling — cloud-first (Supabase Storage), fallback to base64
function handlePhotoUpload(input, role){
  var file=input.files[0];if(!file)return;
  // Optimistic local preview first
  var reader=new FileReader();
  reader.onload=function(e){
    var dataUrl=e.target.result;
    if(role==='trav'){ETIE.traveller.photo=dataUrl;var prev=document.getElementById('travPhotoPreview');}
    else{ETIE.local.photo=dataUrl;var prev=document.getElementById('localPhotoPreview');}
    if(prev){prev.innerHTML='<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';}
    var remBtn=document.getElementById(role==='trav'?'travPhotoRemove':'localPhotoRemove');if(remBtn)remBtn.style.display='inline-block';
    saveState();renderProfiles();
  };
  reader.readAsDataURL(file);
  // Upload to Supabase Storage (cloud-first)
  try{
    if(window.EtieCloud && window.EtieCloud.uploadPhoto && window.EtieCloud.isSharedOn()){
      window.EtieCloud.uploadPhoto(file, role).then(function(url){
        if(role==='trav')ETIE.traveller.photo=url; else ETIE.local.photo=url;
        saveState();renderProfiles();
        console.info('Photo uploaded to Supabase:', url);
      }).catch(function(err){
        console.warn('Photo upload failed, keeping local base64:', err);
      });
    }
  }catch(e){console.warn('Cloud photo upload skipped',e);}
}
function removePhoto(role){
  if(role==='trav'){ETIE.traveller.photo=null;var prev=document.getElementById('travPhotoPreview');}
  else{ETIE.local.photo=null;var prev=document.getElementById('localPhotoPreview');}
  if(prev){prev.innerHTML='<span style="color:rgba(255,255,255,.5);font-size:28px;">+</span>';}
  var remBtn=document.getElementById(role==='trav'?'travPhotoRemove':'localPhotoRemove');if(remBtn)remBtn.style.display='none';
  saveState();renderProfiles();
  // TODO: delete from Supabase Storage when implemented
}
// Optional travel photos (traveller step 6 + local step 7) — any role, detected by input id
function handleTravelPhoto(input,idx){
  var file=input.files[0];if(!file)return;
  var isLocal = (input.id||'').indexOf('local')===0;
  var store = isLocal ? (ETIE.local.travelPhotos||(ETIE.local.travelPhotos=[])) : (ETIE.traveller.travelPhotos||(ETIE.traveller.travelPhotos=[]));
  var prevId = isLocal ? 'localTravelPrev'+idx : 'travTravelPrev'+idx;
  var role = isLocal ? 'local' : 'trav';
  var reader=new FileReader();
  reader.onload=function(e){
    if(isLocal) ETIE.local.travelPhotos[idx]=e.target.result; else ETIE.traveller.travelPhotos[idx]=e.target.result;
    var prev=document.getElementById(prevId);
    if(prev)prev.innerHTML='<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
    saveState();renderProfiles();renderMatches();
  };
  reader.readAsDataURL(file);
  try{
    if(window.EtieCloud&&window.EtieCloud.uploadPhoto&&window.EtieCloud.isSharedOn()){
      window.EtieCloud.uploadPhoto(file,role).then(function(url){
        if(isLocal) ETIE.local.travelPhotos[idx]=url; else ETIE.traveller.travelPhotos[idx]=url;
        saveState();renderProfiles();renderMatches();
      }).catch(function(){});
    }
  }catch(e){}
}
function restorePhotoPreviews(){
  try{
    var tp=document.getElementById('travPhotoPreview');
    if(tp&&ETIE.traveller.photo){tp.innerHTML='<img src="'+ETIE.traveller.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';var rb=document.getElementById('travPhotoRemove');if(rb)rb.style.display='inline-block';}
    (ETIE.traveller.travelPhotos||[]).forEach(function(p,i){
      var pv=document.getElementById('travTravelPrev'+i);
      if(pv&&p)pv.innerHTML='<img src="'+p+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
    });
    var lp=document.getElementById('localPhotoPreview');
    if(lp&&ETIE.local.photo){lp.innerHTML='<img src="'+ETIE.local.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';var lb=document.getElementById('localPhotoRemove');if(lb)lb.style.display='inline-block';}
    (ETIE.local.travelPhotos||[]).forEach(function(p,i){
      var pv=document.getElementById('localTravelPrev'+i);
      if(pv&&p)pv.innerHTML='<img src="'+p+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
    });
    renderAvailDates();
  }catch(e){}
}
function renderDiscoverStrip(){
  try{
    var photos=((ETIE.traveller||{}).travelPhotos||[]).filter(Boolean);
    var selfie=(ETIE.traveller||{}).photo;
    var thumbs='';
    if(selfie)thumbs+='<img src="'+selfie+'" alt="you">';
    photos.forEach(function(p){thumbs+='<img src="'+p+'" alt="travel">';});
    if(!thumbs)return '<div class="card travel-strip"><strong>Your travel story</strong><p class="muted small" style="margin:6px 0 0;">No travel photos yet — add some in Traveller Step 6 so locals see your adventures.</p></div>';
    return '<div class="card travel-strip"><strong>Your travel story</strong><div class="travel-thumbs">'+thumbs+'</div></div>';
  }catch(e){return '';}
}

// Tier helpers
function getLocalTier(){return ETIE.local.tier||'Rookie';}
function getTravellerTier(){return ETIE.traveller.tier||'Rookie';}
function canSeeFullDiscover(){
  var lt=getLocalTier(), tt=getTravellerTier();
  return lt==='Verified'||lt==='Host'||tt==='Trusted';
}
function canCreateActivities(){return getLocalTier()==='Host';}
function isCleanLive(){ try{ var v=localStorage.getItem('etie-clean'); if(v==='0') return false; if(v==='1' || window.ETIE_CLEAN) return true; return true; }catch(e){ return true; } }
function liveLocals(){
  var live=(window.ETIE_LIVE_LOCALS||[]);
  if(!live.length) return null;
  // drop legacy kan_win demo row even if cached
  live=live.filter(function(l){ var n=((l&&l.name)||'').toLowerCase().trim(); return n!=='kan_win'&&n!=='kan win'&&n!=='kanwin'; });
  // exclude self when traveller is also a local guide
  try{
    var selfId=(window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession()&&window.EtieCloud.getSession().user&&window.EtieCloud.getSession().user.id)||null;
    if(selfId) live=live.filter(function(l){return l.id!==selfId;});
  }catch(e){}
  return live;
}
// --- HK hook helpers (district/vibe maps + modifiers) ---
var SQ_DISTRICTS=['All HK','Central / Soho','Lan Kwai Fong','Tsim Sha Tsui','Mong Kok'];
var SQ_VIBES=['All','Nightlife','Street Food','Photo Walk','Hiking'];
var SQ_DATE_OPTS=['Tonight / Today','Pick Dates'];
var SQ_VIBE_MAP={
  'Nightlife':['Soho Speakeasies & Hidden Bars','Underground LKF Nightlife','Nightlife','Bars','Soho Speakeasy Run','LKF Neon Crawl'],
  'Street Food':['Dai Pai Dong & Late Night Eats','Mong Kok Vintage & Local Markets','Street Food','Foodie Tours','Dai Pai Dong Food Blitz','Mong Kok Snack Blitz'],
  'Photo Walk':['Wong Kar-wai & Neon Photo Walks','Mong Kok Neon Walk','Harbour Photo Walk','Photography','Architecture'],
  'Hiking':["Dragon's Back & Island Hikes",'Hiking / Trekking','Ecotourism / Nature','Lamma Island Escape']
};
var SQ_HOOK_MAP={
  'Salsa':'🍸 Soho Speakeasy Run',
  'Cooking':'🥟 Dai Pai Dong Food Blitz',
  'Photography':'📸 Mong Kok Neon Walk',
  'Football':'⚽️ Street Football Showdown',
  'Music':'🎵 Underground Live Set',
  'Surfing':'🏄 Shek O Surf Dawn',
  'Tennis':'🎾 Victoria Park Rally',
  'Thrift shopping':'👕 Sham Shui Po Thrift Hunt',
  'Road Trips':'🚐 Lantau Road Trip',
  'Backpacking':'🎒 Urban Backpack Blitz',
  'Hostel Life':'🏠 Hostel Handover',
  'Language Exchange':'💬 Soho Language Swap',
  'Street Food':'🥢 Mong Kok Snack Blitz',
  'Exploring / Sightseeing':'🧭 Central Mystery Walk',
  'Digital Nomad':'💻 Co-work & Brew Crawl',
  'Scuba Diving / Snorkeling':'🤿 Sai Kung Dive Quest',
  'Hiking / Trekking':"🥾 Dragon's Back Hike",
  'Museums & Art':'🖼️ Art Basement Crawl',
  'Solo Travel':'🧳 Solo Hook',
  'Architecture':'🏙️ Harbour Photo Walk',
  'Local Markets':'🛍️ Temple Street Haggle',
  'Camping / Van Life':'⛺ Lamma Island Escape',
  'Café Hopping':'☕ Gough Street Café Crawl',
  'Live Music / Festivals':'🎤 LKF Neon Crawl',
  'Extreme Sports':'🪂 Sky Hook',
  'Ecotourism / Nature':'🌿 Tai Po Green Escape',
  'Foodie Tours':'🍜 Dai Pai Dong Food Blitz',
  'Sunset Spots':'🌅 Harbour Sunset Quest',
  'Hookmaxxing':'⚡ Ultimate Hook'
};
var SIDEQUEST_CHALLENGES={
  'Football':["⚡ Attempt 3 unpracticed skill moves in a pickup game","🏆 Challenge local HK players to a 2v2 street match","⚽ Score or assist using only your non-dominant foot"],
  'Street Food':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  'Photography':["📸 Ask 3 local strangers on the street for a quick portrait","🎬 Recreate a famous scene from a Wong Kar-wai film in Soho","🎞️ Shoot an entire hour using only monochrome/B&W framing"],
  'Thrift / Vintage':["👕 Let your match style a full outfit for you under HKD $150","🕶️ Wear an outlandish vintage item for 10 mins","🏷️ Find a hidden local vintage shop not on Google Maps"],
  'Thrift':["👕 Let your match style a full outfit for you under HKD $150","🕶️ Wear an outlandish vintage item for 10 mins","🏷️ Find a hidden local vintage shop not on Google Maps"],
  'Vintage':["👕 Let your match style a full outfit for you under HKD $150","🕶️ Wear an outlandish vintage item for 10 mins","🏷️ Find a hidden local vintage shop not on Google Maps"]
};
var SQ_MODIFIERS={
  'Football':["⚡ Attempt 3 unpracticed skill moves in a pickup game","🏆 Challenge local HK players to a 2v2 street match","⚽ Score or assist using only your non-dominant foot"],
  'Food/Dining':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  'Street Food':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  'Photography':["📸 Ask 3 local strangers on the street for a quick portrait","🎬 Recreate a famous scene from a Wong Kar-wai film in Soho","🎞️ Shoot an entire hour using only monochrome/B&W framing"],
  'Thrift / Vintage':["👕 Let your match style a full outfit for you under HKD $150","🕶️ Wear an outlandish vintage item for 10 mins","🏷️ Find a hidden local vintage shop not on Google Maps"],
  '🍸 Soho Speakeasies & Hidden Bars':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  '🥟 Dai Pai Dong & Late Night Eats':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  '📸 Wong Kar-wai & Neon Photo Walks':["📸 Ask 3 local strangers on the street for a quick portrait","🎬 Recreate a famous scene from a Wong Kar-wai film in Soho","🎞️ Shoot an entire hour using only monochrome/B&W framing"],
  '🥾 Dragon\'s Back & Island Hikes':["Hike without phone GPS","Find a hidden beach","Cook lunch on a camp stove"],
  '🛍️ Mong Kok Vintage & Local Markets':["👕 Let your match style a full outfit for you under HKD $150","🕶️ Wear an outlandish vintage item for 10 mins","🏷️ Find a hidden local vintage shop not on Google Maps"],
  '☕ Sheung Wan Cafe Hopping':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"],
  '🀄 Mahjong & Culture':["Learn 3 Mahjong moves in a live game","Play a round with HK locals","Teach the guide a game from your culture"],
  '🎧 Underground LKF Nightlife':["⚡ Attempt 3 unpracticed skill moves in a pickup game","🏆 Challenge local HK players to a 2v2 street match","⚽ Score or assist using only your non-dominant foot"],
  'Salsa':["⚡ Attempt 3 unpracticed skill moves in a pickup game","🏆 Challenge local HK players to a 2v2 street match","⚽ Score or assist using only your non-dominant foot"],
  'Cooking':["🥟 Order from a Dai Pai Dong completely in Cantonese without pointing","🌶️ Let your local host pick 3 mystery dishes for you","🍜 Eat at a stall with zero English text on the menu"]
};
function sqModifiersFor(tag){
  if(SQ_MODIFIERS[tag]) return SQ_MODIFIERS[tag];
  var base=tag.replace(/^[^A-Za-z0-9]+/,'').trim();
  if(SQ_MODIFIERS[base]) return SQ_MODIFIERS[base];
  if(/Food|Dining|Dai Pai/i.test(tag)) return SQ_MODIFIERS['Food/Dining'];
  if(/Photo|Wong Kar/i.test(tag)) return SQ_MODIFIERS['Photography'];
  if(/Football|Soccer/i.test(tag)) return SQ_MODIFIERS['Football'];
  return ["Complete the vibe challenge","Try the local way","Document your hook"];
}
var SQ_FILTERS={date:'Tonight / Today', district:'All HK', vibe:'All', customDate:''};
function sqHook(tag){ return SQ_HOOK_MAP[tag]||('✨ '+tag); }
function sqDistrictFor(guide){
  if(guide.district) return guide.district;
  if(guide.city && SQ_DISTRICTS.indexOf(guide.city)!==-1) return guide.city;
  var hash=0; try{ var s=guide.name||guide.id||''; for(var i=0;i<s.length;i++) hash+=s.charCodeAt(i);}catch(e){}
  return SQ_DISTRICTS[1 + (hash % 4)];
}
function sqBadgeFor(guide){
  var tier=guide.tier||'Rookie', hc=guide.hostedCount||(guide.stats&&guide.stats.travellersMet)||0;
  if(tier==='Host' || hc>=10) return 'Lvl 5 HK Sensei';
  if(tier==='Verified' || hc>=3) return 'Verified HK Local';
  if(hc>=1) return 'Lvl 2 HK Explorer';
  return 'HK Explorer';
}
function sqVibeMatch(guide, vibe){
  if(!vibe || vibe==='All') return true;
  var pool=(guide.interests||[]).concat(guide.offerTags||[]).concat([guide.offer||'']);
  var need=SQ_VIBE_MAP[vibe]||[];
  return need.some(function(n){ return pool.some(function(p){ return (p||'').toLowerCase().indexOf(n.toLowerCase())!==-1; }); });
}
function sqDistrictMatch(guide, district){
  if(!district || district==='All HK') return true;
  return sqDistrictFor(guide)===district;
}
function sqDateMatch(guide, dateOpt){
  if(SQ_FILTERS.customDate) return (guide.availDates||[]).indexOf(SQ_FILTERS.customDate)!==-1;
  if(!dateOpt || dateOpt==='Pick Dates') return true;
  var today=todayISO();
  return (guide.availDates||[]).indexOf(today)!==-1 || (guide.availDates||[]).length===0;
}
function getActivePactText(){
  try{
    if(ETIE.traveller.sidequestChallenge) return ETIE.traveller.sidequestChallenge;
    var its=ETIE.traveller.interests||[];
    var mods=ETIE.traveller.sidequestModifiers||{};
    var parts=[];
    its.slice(0,2).forEach(function(tag){
      var m=mods[tag];
      if(m) parts.push(tag.replace(/^[^A-Za-z0-9]+/, '').trim() + ': ' + m);
    });
    if(!parts.length && its.length) parts.push(sqModifiersFor(its[0])[0]);
    return parts.length? parts.join(' + ') : 'No pact yet — pick a vibe + twist.';
  }catch(e){ return 'No pact yet.'; }
}
function renderSidequestChallenges(){
  try{
    var box=document.getElementById('questChallenges'); if(!box) return;
    var hint=document.getElementById('questChallengesHint');
    var its=ETIE.traveller.interests||[];
    if(!its.length){
      box.innerHTML='';
      if(hint) hint.textContent='Select a vibe in Step 3 first.';
      return;
    }
    var primary=its[0];
    var challenges=SIDEQUEST_CHALLENGES[primary]||sqModifiersFor(primary);
    // Try to map via base interest name if primary is HK vibe
    if(!SIDEQUEST_CHALLENGES[primary]){
      var base=primary.replace(/^[^A-Za-z0-9]+/,'').trim();
      if(SIDEQUEST_CHALLENGES[base]) challenges=SIDEQUEST_CHALLENGES[base];
      else if(/Soho/i.test(primary)) challenges=SIDEQUEST_CHALLENGES['Football'];
      else if(/Dai Pai/i.test(primary)) challenges=SIDEQUEST_CHALLENGES['Street Food'];
      else if(/Wong Kar|Neon|Photo/i.test(primary)) challenges=SIDEQUEST_CHALLENGES['Photography'];
      else if(/Mong Kok|Vintage|Market/i.test(primary)) challenges=SIDEQUEST_CHALLENGES['Thrift / Vintage'];
      else if(/Dragon|Hike/i.test(primary)) challenges=SIDEQUEST_CHALLENGES['Photography'];
    }
    box.innerHTML='';
    box.className='quest-challenges';
    challenges.forEach(function(ch){
      var b=document.createElement('button'); b.className='chip'; b.textContent=ch;
      if(ETIE.traveller.sidequestChallenge===ch) b.classList.add('active');
      b.onclick=function(){ selectSidequestChallenge(ch); };
      box.appendChild(b);
    });
    if(hint) hint.textContent='Tap a challenge — this becomes your Active Hook Pact.';
    // Also update pact displays
    updatePactDisplays();
  }catch(e){}
}
function selectSidequestChallenge(ch){
  try{
    ETIE.traveller.sidequestChallenge=ch;
    // Also keep in modifiers for backward compat
    var primary=(ETIE.traveller.interests||[])[0]||'General';
    ETIE.traveller.sidequestModifiers=ETIE.traveller.sidequestModifiers||{};
    ETIE.traveller.sidequestModifiers[primary]=ch;
    saveState();
    renderSidequestChallenges();
    updatePactDisplays();
    // Pre-fill outreach message if in Step 11
    try{
      var ta=document.getElementById('reqMessage');
      if(ta && ch) ta.value='Hey — '+ch+' — are you down for this hook in '+ (ETIE.trip.district||'Hong Kong') +' tonight?';
    }catch(e){}
  }catch(e){}
}
function updatePactDisplays(){
  try{
    var pact=getActivePactText();
    var el8=document.getElementById('trav8PactText'); if(el8) el8.textContent=pact;
    var el11=document.getElementById('trav11PactText'); if(el11) el11.textContent=pact;
    // Also pre-fill textarea if pact exists
    try{
      var ta=document.getElementById('reqMessage');
      if(ta && pact && pact.indexOf('No pact')===-1 && !ta.dataset.prefilled){
        ta.value='Hey — '+pact+' — are you in?';
        ta.dataset.prefilled='1';
      }
    }catch(e){}
  }catch(e){}
}
function renderSidequestModifiers(role){
  try{
    var isTrav=role==='trav';
    var box=document.getElementById(isTrav?'travModifiersBox':'localModifiersBox');
    var cont=document.getElementById(isTrav?'travSidequestModifiers':'localSidequestModifiers');
    if(!box||!cont) return;
    var interests=isTrav? ETIE.traveller.interests : ETIE.local.interests;
    var mods=isTrav? ETIE.traveller.sidequestModifiers : ETIE.local.sidequestModifiers;
    if(!interests||!interests.length){ box.style.display='none'; cont.innerHTML=''; return; }
    box.style.display=''; cont.innerHTML='';
    interests.slice(0,3).forEach(function(tag){
      var wrap=document.createElement('div'); wrap.style.border='1px solid rgba(255,255,255,.12)'; wrap.style.borderRadius='12px'; wrap.style.padding='10px'; wrap.style.background='rgba(255,255,255,.04)';
      var lab=document.createElement('div'); lab.style.fontWeight='800'; lab.style.fontSize='13px'; lab.style.marginBottom='6px'; lab.textContent=tag; wrap.appendChild(lab);
      var opts=sqModifiersFor(tag);
      opts.forEach(function(opt){
        var b=document.createElement('button'); b.className='chip'+(mods[tag]===opt?' active':''); b.textContent=opt; b.style.margin='4px 6px 0 0'; b.style.fontSize='12px';
        b.onclick=(function(t,o){return function(){ try{ if(isTrav){ ETIE.traveller.sidequestModifiers[t]=o; } else { ETIE.local.sidequestModifiers[t]=o; } saveState(); renderSidequestModifiers(isTrav?'trav':'local'); updatePactDisplays(); }catch(e){}};})(tag,opt);
        wrap.appendChild(b);
      });
      cont.appendChild(wrap);
    });
  }catch(e){}
}
function updatePactDisplays(){
  try{
    var txt=getActivePactText();
    var a=document.getElementById('trav8PactText'); if(a) a.textContent=txt;
    var b=document.getElementById('trav11PactText'); if(b) b.textContent=txt;
  }catch(e){}
}
// Flag helpers
function flagEmoji(code){if(!code)return '';return String.fromCodePoint(...code.toUpperCase().split('').map(c=>127397+c.charCodeAt(0)));}
function flagForCountry(countryCode){var map={'PT':'🇵🇹','ES':'🇪🇸','FR':'🇫🇷','IT':'🇮🇹','JP':'🇯🇵','TH':'🇹🇭','US':'🇺🇸','AU':'🇦🇺','HK':'🇭🇰','SG':'🇸🇬'};return map[countryCode]||flagEmoji(countryCode)||'🌍';}

function toast(msg){var t=document.getElementById('toast');if(!t){alert(msg);return;}t.textContent=msg;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(function(){t.style.display='none';},2200);}
function gateState(){
  try{
    var signed=false;try{signed=isSignedIn();}catch(e){}
    if(!signed)return 'signin';
    var cloud=false;try{cloud=!!ETIE.cloudOnboarded;}catch(e){}
    var local=false;try{local=!!ETIE.profileComplete||isProfileComplete();}catch(e){}
    if(!(cloud||local))return 'profile';
  }catch(e){return 'signin';}
  return 'open';
}
function refreshGate(){
  try{
    var st=gateState();
    var o=document.getElementById('gateOverlay');if(!o)return st;
    if(st==='open'){o.classList.add('hidden');return st;}
    try{var hp=document.getElementById('profile');if(hp&&hp.classList.contains('panel-open'))return st;}catch(e){}
    o.classList.remove('hidden');
    renderGateBody(st);
    return st;
  }catch(e){return 'signin';}
}
function renderGateBody(st){
  try{
    var b=document.getElementById('gateBody');if(!b)return;
    b.innerHTML='';
    if(st==='signin'){
      var p=document.createElement('p');p.className='muted';p.textContent='ETIE is a private friend network. Sign in to enter.';
      var btn=document.createElement('button');btn.className='primary';btn.textContent='Sign in with Google';btn.style.width='100%';
      btn.onclick=function(){try{window.EtieCloud.signInWithGoogle();}catch(e){}};
      b.appendChild(p);b.appendChild(btn);return;
    }
    var tr=null;try{tr=ETIE.traveller||{};}catch(e){}
    var haveNick=false,havePhoto=false,haveVerify=false,haveHook=false;
    try{
      haveNick=!!(tr.nickname||ETIE.local.displayName);
      havePhoto=!!(tr.photo||ETIE.local.photo||googleAvatar());
      haveVerify=((tr.verificationMethods||[]).length>0);
      haveHook=!!((tr.bio||'').trim());
    }catch(e){}
    var ul=document.createElement('div');ul.className='gate-checks';
    [['Nickname',haveNick],['Photo',havePhoto],['Verification',haveVerify],['Personal hook',haveHook]].forEach(function(x){
      var r=document.createElement('div');r.className='gate-check'+(x[1]?' ok':'');
      r.textContent=(x[1]?'✅ ':'○ ')+x[0];ul.appendChild(r);
    });
    var btn3=document.createElement('button');btn3.className='primary';btn3.textContent='Complete Profile';btn3.style.width='100%';btn3.style.marginTop='12px;';
    btn3.onclick=function(){var o=document.getElementById('gateOverlay');if(o)o.classList.add('hidden');try{showScreen('profile');}catch(e){}};
    b.appendChild(ul);b.appendChild(btn3);
  }catch(e){}
}
function verifyInviteCode(){
  try{
    var inp=document.getElementById('inviteCodeInput');
    var code=(inp&&inp.value||'').trim();
    if(!code){toast('Enter your invite code.');return;}
    toast('Verifying invite…');
    window.EtieCloud.redeemInvite(code).then(function(ok){
      if(ok){toast('Welcome in.');}
      else toast('Invalid or claimed code — check it and retry.');
    });
  }catch(e){}
}
function showScreen(id){
  try{
    try{if(id==='map'&&gateState()!=='open'){refreshGate();return;}}catch(e){}
    var panels=['home','homeFlows','trips','messages','profile'];
    var want=(id==='home')?['home','homeFlows']:[id];
    panels.forEach(function(p){var el=document.getElementById(p);if(el)el.classList.toggle('panel-open',want.indexOf(p)!==-1);});
    if(id==='profile'){renderProfiles();updateProfileVisibility();}
    if(id==='messages'){renderMessagesList();try{renderHookChatList();}catch(e){}}
    if(id==='trips'){renderTrips();renderMeetup();}
    if(id==='map'){try{initHKMap();if(window.L&&_map){setTimeout(function(){try{_map.invalidateSize();}catch(e){}},120);}renderMapPins();}catch(e){}}
  }catch(e){}
}
function hideGroup(prefix){for(var i=1;i<=17;i++){var e=document.getElementById(prefix+i);if(e)e.classList.add('hidden');}}

function getChips(containerId){
  var c=document.getElementById(containerId);if(!c)return [];
  return Array.prototype.map.call(c.querySelectorAll('.chip.active'),function(el){return el.textContent.trim();});
}
function setChips(containerId, values){
  var c=document.getElementById(containerId);if(!c)return;
  Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(el){
    el.classList.toggle('active', values.indexOf(el.textContent.trim())!==-1);
  });
}
function updateCounts(){
  var tc=document.getElementById('travInterestCount');if(tc)tc.textContent=getChips('travInterests').length+' / 4 selected';
  var lc=document.getElementById('localInterestCount');if(lc)lc.textContent=getChips('localInterests').length+' / 4 selected';
  try{
    var box=document.getElementById('localSelected4');
    if(box){
      var sel=getChips('localInterests');
      box.innerHTML='';
      for(var i=0;i<4;i++){
        var d=document.createElement('div');d.className='selected4-cell'+(sel[i]?' filled':'');
        d.textContent=sel[i]||('Slot '+(i+1));
        box.appendChild(d);
      }
    }
  }catch(e){}
  try{
    var tb2=document.getElementById('travSelected4');
    if(tb2){
      var sel2=getChips('travInterests');
      tb2.innerHTML='';
      for(var i=0;i<4;i++){
        var d=document.createElement('div');d.className='selected4-cell'+(sel2[i]?' filled':'');
        d.textContent=sel2[i]||('Slot '+(i+1));
        tb2.appendChild(d);
      }
    }
  }catch(e){}
  try{ renderSidequestModifiers('trav'); renderSidequestModifiers('local'); updatePactDisplays(); }catch(e){}
}

function toggleChip(el){
  var parent=el.parentElement;var pid=parent&&parent.id;
  var limited=(pid==='travInterests'||pid==='localInterests');
  if(limited&&!el.classList.contains('active')){
    var cur=parent.querySelectorAll('.chip.active').length;
    if(cur>=4){toast('Pick up to 4 — unselect one to change.');return;}
  }
  el.classList.toggle('active');
  saveCurrentVisible(true);
  updateCounts();renderProfiles();
  try{ renderSidequestModifiers('trav'); renderSidequestModifiers('local'); updatePactDisplays(); }catch(e){}
}

function filterInterests(containerId,q){
  try{
    var c=document.getElementById(containerId);if(!c)return;
    q=(q||'').toLowerCase().trim();
    Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(el){
      var t=el.textContent.toLowerCase();
      el.style.display=(!q||t.indexOf(q)!==-1)?'':'none';
    });
  }catch(e){}
}
function toggleVerify(el){
  try{
    el.classList.toggle('selected');
    var st=el.querySelector('.status');
    if(st)st.textContent=el.classList.contains('selected')?'Selected':'Tap to select';
    saveLocal2();saveState();
  }catch(e){}
}
function toggleVerifyTrav(el){
  try{
    el.classList.toggle('selected');
    var st=el.querySelector('.status');
    if(st)st.textContent=el.classList.contains('selected')?'Selected':'Tap to select';
    saveTravVerify();saveState();renderProfiles();
  }catch(e){}
}
function saveTravVerify(){
  try{
    var c=document.getElementById('travVerify');if(!c)return;
    ETIE.traveller.verificationMethods=Array.prototype.map.call(
      c.querySelectorAll('.list-item.selected'),function(row){return row.getAttribute('data-method');});
  }catch(e){}
}
function saveLocal2(){
  try{
    var c=document.getElementById('localVerify');if(!c)return;
    ETIE.local.verificationMethods=Array.prototype.map.call(
      c.querySelectorAll('.list-item.selected'),function(row){return row.getAttribute('data-method');});
  }catch(e){}
}
function toggleAvail(el){
  var st=el.querySelector('.status');if(!st)return;
  var cur=st.textContent.trim();
  var nxt=cur==='Available'?'Ask me':(cur==='Ask me'?'Unavailable':'Available');
  st.textContent=nxt;
  saveLocal7();saveState();renderProfiles();renderLocalDashboard();toast('Availability saved: '+nxt);
}
function toggleDashAvail(i){
  var a=ETIE.local.availability[i];if(!a)return;
  a.status=a.status==='Available'?'Ask me':(a.status==='Ask me'?'Unavailable':'Available');
  saveState();syncAvailUI();renderProfiles();renderLocalDashboard();toast('Availability saved: '+a.label+' → '+a.status);
}
function syncAvailUI(){
  try{
    var c=document.getElementById('localAvailability');
    if(c)Array.prototype.forEach.call(c.querySelectorAll('.list-item'),function(row,i){
      if(ETIE.local.availability[i])row.querySelector('.status').textContent=ETIE.local.availability[i].status;
    });
  }catch(e){}
  try{ renderAvailDates(); }catch(e){}
  try{ renderAvailCal(); }catch(e){}
}
var ETIE_AVAIL_YM=null, ETIE_AVAIL_DRAG=null;
function availCalYM(){
  try{
    if(ETIE_AVAIL_YM) return ETIE_AVAIL_YM;
    var d=new Date(); // always open on the current month, follows local time
    ETIE_AVAIL_YM={y:d.getFullYear(),m:d.getMonth()};
    return ETIE_AVAIL_YM;
  }catch(e){ var _d=new Date(); return {y:_d.getFullYear(),m:_d.getMonth()}; }
}
function availCalNav(dir){
  try{
    var ym=availCalYM();
    var m=ym.m+dir, y=ym.y;
    while(m<0){m+=12;y--;} while(m>11){m-=12;y++;}
    ETIE_AVAIL_YM={y:y,m:m};
    renderAvailCal(); renderDashCal();
  }catch(e){}
}
function renderDashCal(){
  try{
    var box=document.getElementById('localDashCal'); if(!box) return;
    var ym=availCalYM();
    var M=['January','February','March','April','May','June','July','August','September','October','November','December'];
    var first=new Date(ym.y,ym.m,1);
    var startDay=(first.getDay()+6)%7;
    var days=new Date(ym.y,ym.m+1,0).getDate();
    var today=todayISO();
    var sel={}; (ETIE.local.availDates||[]).forEach(function(d){sel[d]=1;});
    box.innerHTML='';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(function(w){var h=document.createElement('div');h.className='avail-cal-dow';h.textContent=w;box.appendChild(h);});
    for(var i=0;i<startDay;i++){var p=document.createElement('div');p.className='avail-cal-day empty';box.appendChild(p);}
    for(var d=1;d<=days;d++){
      var mm=('0'+(ym.m+1)).slice(-2), dd=('0'+d).slice(-2);
      var ds=ym.y+'-'+mm+'-'+dd;
      var c=document.createElement('div');
      c.className='avail-cal-day '+(ds<today?'past':(sel[ds]?'avail':'unavail'));
      c.textContent=d; c.title=ds+(sel[ds]?' — available':' — not available');
      box.appendChild(c);
    }
  }catch(e){}
}
function toggleAvailCal(dateStr, force){
  try{
    if(!ETIE.local.availDates) ETIE.local.availDates=[];
    var i=ETIE.local.availDates.indexOf(dateStr);
    var want=(force!=null)?force:(i===-1);
    if(want&&i===-1) ETIE.local.availDates.push(dateStr);
    if(!want&&i!==-1) ETIE.local.availDates.splice(i,1);
    ETIE.local.availDates.sort();
    saveState(); renderAvailDates(); renderAvailCal(); renderProfiles(); renderLocalDashboard();
  }catch(e){}
}
function renderAvailCal(){
  try{
    var box=document.getElementById('availCal'); if(!box) return;
    var ym=availCalYM();
    var M=['January','February','March','April','May','June','July','August','September','October','November','December'];
    var title=document.getElementById('availCalTitle');
    if(title) title.textContent=M[ym.m]+' '+ym.y;
    var first=new Date(ym.y,ym.m,1);
    var startDay=(first.getDay()+6)%7; // Monday-first
    var days=new Date(ym.y,ym.m+1,0).getDate();
    var today=todayISO();
    var sel={}; (ETIE.local.availDates||[]).forEach(function(d){sel[d]=1;});
    box.innerHTML='';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(function(w){var h=document.createElement('div');h.className='avail-cal-dow';h.textContent=w;box.appendChild(h);});
    for(var i=0;i<startDay;i++){var p=document.createElement('div');p.className='avail-cal-day empty';box.appendChild(p);}
    for(var d=1;d<=days;d++){
      (function(day){
        var mm=('0'+(ym.m+1)).slice(-2), dd=('0'+day).slice(-2);
        var ds=ym.y+'-'+mm+'-'+dd;
        var c=document.createElement('div');
        c.className='avail-cal-day'+(sel[ds]?' sel':'')+(ds<today?' past':'');
        c.textContent=day; c.dataset.date=ds;
        c.onmousedown=function(e){ try{e.preventDefault();}catch(_){} if(ds<today)return; ETIE_AVAIL_DRAG={mode:!sel[ds]}; toggleAvailCal(ds, ETIE_AVAIL_DRAG.mode); };
        c.onmouseover=function(){ if(ETIE_AVAIL_DRAG&&ds>=today) toggleAvailCal(ds, ETIE_AVAIL_DRAG.mode); };
        c.onclick=function(){ if(ds<today)return; if(!ETIE_AVAIL_DRAG) toggleAvailCal(ds); };
        box.appendChild(c);
      })(d);
    }
    document.onmouseup=function(){ ETIE_AVAIL_DRAG=null; };
  }catch(e){}
}
function renderAvailDates(){
  try{
    // calendar-tap only: no date list columns — just a selected count
    var dates=(ETIE.local.availDates||[]).slice().sort();
    var sc=document.getElementById('availSelCount');
    if(sc) sc.textContent=dates.length?(dates.length+' date(s) selected: '+dates.join(', ')):'No dates selected yet.';
  }catch(e){}
}
function addAvailDate(){
  try{
    var inp=document.getElementById('availDatePick'); if(!inp||!inp.value){toast('Pick a date first.');return;}
    var d=inp.value; if(!ETIE.local.availDates) ETIE.local.availDates=[];
    if(ETIE.local.availDates.indexOf(d)!==-1){toast('Date already added.');return;}
    ETIE.local.availDates.push(d); ETIE.local.availDates.sort();
    saveState(); renderAvailDates(); renderProfiles(); renderLocalDashboard(); toast('Availability added: '+d);
  }catch(e){toast('Could not add date.');}
}
function removeAvailDate(i){
  try{ ETIE.local.availDates.splice(i,1); saveState(); renderAvailDates(); renderProfiles(); renderLocalDashboard(); }catch(e){}
}
function clearAvailDates(){ ETIE.local.availDates=[]; saveState(); renderAvailDates(); renderProfiles(); renderLocalDashboard(); toast('Availability cleared.'); }

function currentTravStep(){for(var i=1;i<=17;i++){var e=document.getElementById('trav'+i);if(e&&!e.classList.contains('hidden'))return i;}return 1;}
function currentLocalStep(){for(var i=1;i<=11;i++){var e=document.getElementById('local'+i);if(e&&!e.classList.contains('hidden'))return i;}return 1;}

function formatTripDates(f,t){
  try{
    var M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(!f)return '';
    var a=new Date(f+'T12:00');if(isNaN(a.getTime()))return f;
    if(!t||t===f)return a.getDate()+' '+M[a.getMonth()];
    var b=new Date(t+'T12:00');if(isNaN(b.getTime()))return a.getDate()+' '+M[a.getMonth()];
    if(a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear())return a.getDate()+'–'+b.getDate()+' '+M[a.getMonth()];
    var s=a.getDate()+' '+M[a.getMonth()]+' – '+b.getDate()+' '+M[b.getMonth()];
    if(a.getFullYear()!==b.getFullYear())s+=' '+b.getFullYear();
    return s;
  }catch(e){return f+' – '+(t||'');}
}

function setTravDate(el, val){ try{ var c=document.getElementById('travDatePills'); if(c) Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');}); el.classList.add('active'); var today=todayISO(); if(val==='Tonight'){ ETIE.trip.dateFrom=today; ETIE.trip.dateTo=today; ETIE.trip.dates=formatTripDates(today,today); } else { var end=new Date(); end.setDate(new Date().getDate()+7); var eISO=end.toISOString().slice(0,10); ETIE.trip.dateFrom=today; ETIE.trip.dateTo=eISO; ETIE.trip.dates=formatTripDates(today,eISO); } saveState(); }catch(e){} }
function saveTrav1(){
  var cityInp=document.getElementById('travCity');
  var city=cityInp?cityInp.value.trim():'';
  var countrySel=document.getElementById('travNationality');
  var country=countrySel?countrySel.value:'';
  if(city){
    ETIE.trip.destination=city;
    ETIE.trip.country=country||'HK';
  } else {
    ETIE.trip.destination='Hong Kong';
    ETIE.trip.country='HK';
  }
  try{ var sel=document.querySelector('#travDistrictPills .chip.active'); if(sel) ETIE.trip.district=sel.textContent.trim(); if(!ETIE.trip.district) ETIE.trip.district='Central / Soho'; }catch(e){ if(!ETIE.trip.district)ETIE.trip.district='Central / Soho'; }
  try{ var selD=document.querySelector('#travDatePills .chip.active'); var val=selD?selD.textContent.trim():'Tonight'; var today=todayISO(); if(val==='Tonight'){ ETIE.trip.dateFrom=today; ETIE.trip.dateTo=today; ETIE.trip.dates=formatTripDates(today,today); } else { var end=new Date(); end.setDate(new Date().getDate()+7); var eISO=end.toISOString().slice(0,10); ETIE.trip.dateFrom=today; ETIE.trip.dateTo=eISO; ETIE.trip.dates=formatTripDates(today,eISO); } }catch(e){ var today=todayISO(); ETIE.trip.dateFrom=today; ETIE.trip.dateTo=today; ETIE.trip.dates=formatTripDates(today,today); }
  var nn=document.getElementById('travNickname'); if(nn) ETIE.traveller.nickname=nn.value.trim();
  updateHookLabel();
}
function saveTrav2(){saveTravVerify();}
function saveTrav3(){
  ETIE.traveller.interests=getChips('travInterests');
  var svEl=document.getElementById('travSocialVibe'); var tpEl=document.getElementById('travTravelPace');
  if(svEl&&tpEl){
    var sv=+svEl.value, tp=+tpEl.value;
    var sc=vibeToSocial(sv), pc=paceToSpont(tp);
    ETIE.traveller.socialVibe=sv; ETIE.traveller.travelPace=tp; ETIE.traveller._vibeSet=true;
    ETIE.traveller.styleInterests=getChips('travStyleChips');
    ETIE.traveller.personality={social:sc,spontaneous:pc,curious:Math.round((sc+pc)/2)};
  }
  ETIE.traveller.lookingFor=getChips('travLookingFor');
}
var SOCIAL_VIBE_LABELS=["Solo & Quiet","Balanced","Group & Social"];
var TRAVEL_PACE_LABELS=["Relaxed","Moderate","Packed / High-Energy"];
function vibeToSocial(v){return v==0?2:v==2?9:5;}
function paceToSpont(v){return v==0?2:v==2?9:5;}
function saveTrav4(){
  var sv=+document.getElementById('travSocialVibe').value;
  var tp=+document.getElementById('travTravelPace').value;
  var sc=vibeToSocial(sv), pc=paceToSpont(tp);
  ETIE.traveller.socialVibe=sv; ETIE.traveller.travelPace=tp; ETIE.traveller._vibeSet=true;
  ETIE.traveller.styleInterests=getChips('travStyleChips');
  ETIE.traveller.personality={social:sc,spontaneous:pc,curious:Math.round((sc+pc)/2)};
}
function travHybridPayload(){var sv=ETIE.traveller.socialVibe, tp=ETIE.traveller.travelPace; return {social_vibe:SOCIAL_VIBE_LABELS[sv!=null?sv:1],travel_pace:TRAVEL_PACE_LABELS[tp!=null?tp:1],interests:(ETIE.traveller.styleInterests||[]).slice()};}
function refreshAnchoredLabels(){
  [['travSocialVibe','travSocialVibeVal'],['travTravelPace','travTravelPaceVal'],['localSocialVibe','localSocialVibeVal'],['localTravelPace','localTravelPaceVal']].forEach(function(p){
    var a=document.getElementById(p[0]), b=document.getElementById(p[1]);
    if(!a||!b)return;
    var labs=(p[0].indexOf('SocialVibe')!==-1?SOCIAL_VIBE_LABELS:TRAVEL_PACE_LABELS);
    b.textContent=labs[+a.value]||'';
  });
}
function saveTrav5(){ETIE.traveller.lookingFor=getChips('travLookingFor');}
function saveTrav6(){ETIE.traveller.hook=document.getElementById('travHook').value.trim();}
function setDistrict(el, val){ try{ var c=document.getElementById('localDistrictPills'); if(c) Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');}); el.classList.add('active'); ETIE.local.district=val; saveState(); }catch(e){} }
function saveLocal3(){ETIE.local.city=document.getElementById('localCity').value.trim();ETIE.local.age=document.getElementById('localAge').value.trim();ETIE.local.nationality=document.getElementById('localNationality').value; var dn=document.getElementById('localNickname'); if(dn) ETIE.local.displayName=dn.value.trim(); try{ var sel=document.querySelector('#localDistrictPills .chip.active'); ETIE.local.district= sel?sel.textContent.trim():'Central / Soho'; }catch(e){} }
function saveLocal4(){ETIE.local.interests=getChips('localInterests');}
function saveLocal5(){
  var sv=+document.getElementById('localSocialVibe').value;
  var tp=+document.getElementById('localTravelPace').value;
  var sc=vibeToSocial(sv), pc=paceToSpont(tp);
  ETIE.local.socialVibe=sv; ETIE.local.travelPace=tp;
  ETIE.local.styleInterests=getChips('localStyleChips');
  ETIE.local.personality={social:sc,spontaneous:pc,curious:Math.round((sc+pc)/2)};
}
function saveLocal6(){ETIE.local.offer=document.getElementById('localOffer').value.trim();try{var ot=document.getElementById('localOfferTags'); if(ot) ETIE.local.offerTags=getChips('localOfferTags'); else ETIE.local.offerTags=(ETIE.local.interests||[]).slice(0,4);}catch(e){ETIE.local.offerTags=(ETIE.local.interests||[]).slice(0,4);}}
function saveLocal7(){
  var c=document.getElementById('localAvailability');if(!c)return;
  ETIE.local.availability=Array.prototype.map.call(c.querySelectorAll('.list-item'),function(row){
    return {label:row.querySelector('strong').textContent.trim(),status:row.querySelector('.status').textContent.trim()};
  });
}

function saveTrav7(){}
function saveTrav8(){}
function saveTrav9(){}
function validTrav(step){
  if(step===1){
    if(!ETIE.trip.destination){ETIE.trip.destination='Hong Kong';ETIE.trip.country='HK';}
    if(!ETIE.trip.district){toast('Pick an HK district.');return false;}
    if(!ETIE.trip.dateFrom||!ETIE.trip.dateTo){toast('Pick when — Tonight or This Week.');return false;}
    if(!ETIE.traveller.nickname){toast('Add a nickname shown to local guides.');return false;}
  }
  if(step===2){if(!(ETIE.traveller.verificationMethods&&ETIE.traveller.verificationMethods.length)){toast('Pick at least 1 verification method to continue.');return false;}}
  if(step===3){
    if(ETIE.traveller.interests.length===0){toast('Pick at least 1 HK vibe.');return false;}
    if(ETIE.traveller.interests.length>4){toast('Pick up to 4.');return false;}
    if((ETIE.traveller.styleInterests||[]).length===0){toast('Pick at least 1 style tag.');return false;}
    if(ETIE.traveller.lookingFor.length===0){toast('Pick at least 1 option.');return false;}
  }
  if(step===4||step===5){
    if(step===5 && !ETIE.traveller.sidequestChallenge){toast('Pick a challenge for your vibe.');return false;}
    return true;
  }
  if(step===6){if(ETIE.traveller.hook.length<10){toast('Add a short hook (10+ characters) so locals get you.');return false;}}
  if(step===7||step===8||step===9){return true;}
  return true;
}
function validLocal(step){
  if(step===1){if(!ETIE.local.city){toast('Add your home city.');return false;}var a=parseInt(ETIE.local.age,10);if(isNaN(a)||a<18){toast('Age must be 18+.');return false;}if(!ETIE.local.nationality){toast('Select your nationality.');return false;}if(!ETIE.local.displayName){toast('Add a nickname shown to travellers.');return false;}}
  if(step===2){if(!(ETIE.local.verificationMethods&&ETIE.local.verificationMethods.length)){toast('Pick at least 1 verification method to continue.');return false;}}
  if(step===3){
    var hc=document.querySelectorAll('#localHostChallenges .chip.active');
    if(!hc.length){toast('Pick at least 1 sidequest you can host.');return false;}
  }
  if(step===4){if(ETIE.local.interests.length===0){toast('Pick at least 1 interest.');return false;}if(ETIE.local.interests.length>4){toast('Pick up to 4.');return false;}}
  if(step===6){if(ETIE.local.offer.length<10){toast('Add what you can offer (10+ characters).');return false;}}
  return true;
}

function saveCurrentVisible(silent){
  var t=currentTravStep();var l=document.getElementById('localFlow');
  var localVisible=l&&!l.classList.contains('hidden');
  if(!localVisible){try{
    if(t===1)saveTrav1();if(t===2)saveTrav2();if(t===3)saveTrav3();if(t===4)saveTrav4();if(t===5)saveTrav5();if(t===6)saveTrav6();if(t===7)saveTrav7();
  }catch(e){}}
  else{var s=currentLocalStep();try{
    if(s===1)saveLocal3();if(s===2)saveLocal2();if(s===4)saveLocal4();if(s===5)saveLocal5();if(s===6)saveLocal6();if(s===7)saveLocal7();
  }catch(e){}}
  saveState();if(!silent)updateCounts();
}

function travNext(n){
  var cur=currentTravStep();
  try{
    if(cur===1)saveTrav1();if(cur===2)saveTrav2();if(cur===3)saveTrav3();if(cur===4)saveTrav4();if(cur===5)saveTrav5();if(cur===6)saveTrav6();if(cur===7)saveTrav7();
    saveState();
    if(n>cur&&!validTrav(cur))return;
  }catch(e){}
  // Steps 9-17 are match-gated: only reachable when a real local guide exists
  if(n>=9 && n<=17 && !hasRealMatch()){
    // still allow Step 8 waiting state, but block deeper
    if(n===8){ /* allow */ } else {
      toast(n===9?'No local guides yet — complete both onboardings to get a match.':'Complete a match first (Step 8).');
      renderMatches(); hideGroup('trav'); var e7=document.getElementById('trav8'); if(e7) e7.classList.remove('hidden'); showScreen('trav8'); return;
    }
  }
  hideGroup('trav');var e=document.getElementById('trav'+n);if(e)e.classList.remove('hidden');try{ETIE._lastTrav=n;saveState();}catch(_){}if(n===1){try{renderTrav1Location();}catch(_){}}updateCounts();renderProfiles();
  if(n===5) try{ renderSidequestChallenges(); }catch(e){}
  if(n===8||n===11) try{ updatePactDisplays(); var ta=document.getElementById('reqMessage'); if(ta && ETIE.traveller.sidequestChallenge) ta.value='Hey — '+ETIE.traveller.sidequestChallenge+' — are you down for a hook in '+(ETIE.trip.district||'Hong Kong')+'?'; }catch(e){}
  if(n===8||n===9||n===10||n===11)renderMatches();if(n===10||n===11||n===12||n===13){renderRequests();renderChat();renderMessagesList();}if(n>=13&&n<=17){renderMeetup();renderTrips();renderThanks();paintStars('travStars',ETIE._travStars||0);}showScreen('trav'+n);
}
function localNext(n){
  var cur=currentLocalStep();
  try{
    if(cur===1)saveLocal3();if(cur===2)saveLocal2();if(cur===4)saveLocal4();if(cur===5)saveLocal5();if(cur===6)saveLocal6();if(cur===7)saveLocal7();
    saveState();
    if(n>cur&&!validLocal(cur))return;
  }catch(e){}
  for(var i=1;i<=11;i++){var e=document.getElementById('local'+i);if(e)e.classList.add('hidden');}
  var t=document.getElementById('local'+n);if(t)t.classList.remove('hidden');try{ETIE._lastLocal=n;saveState();}catch(_){}updateCounts();renderProfiles();syncAvailUI();if(n===7){renderLocalDashboard();}if(n===8||n===9){renderRequests();renderChat();renderMessagesList();renderMeetup();renderLocalDashboard();}if(n===10){renderMeetup();paintStars('localStars',ETIE._localStars||0);renderLocalDashboard();}showScreen('local'+n);
}
function findMatch(){try{saveTrav6();saveTrav7();saveState();if(!validTrav(6))return;}catch(e){}if(!ETIE.traveller.photo){toast('Add your selfie first — profiles with photos get 3x more requests.');return;}ETIE_MATCH_INDEX=0;renderMatches();travNext(8);}
function travRestart(){showScreen('trav1');travNext(1);}
window.ETIE_ADMINS=['kan.ethan.cy@gmail.com'];
function isEtieAdmin(){try{var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession();var em=s&&s.user&&s.user.email;if(em&&window.ETIE_ADMINS.indexOf(em.toLowerCase())!==-1)return true;}catch(e){} try{var q=new URLSearchParams(window.location.search).get('admin');if(q==='1'&&localStorage.getItem('etie-admin-unlock')==='1')return true;}catch(e){} return false;}
function updateAdminVisibility(){try{var b=document.getElementById('adminBtn');if(b)b.style.display=isEtieAdmin()?'':'none';if(!isEtieAdmin())closeAdmin();}catch(e){}}
function openAdmin(){if(!isEtieAdmin()){toast('Admin restricted.');return;}try{var o=document.getElementById('adminOverlay');if(o)o.classList.remove('hidden');}catch(e){} try{ refreshAdminLive(); }catch(e){}}
function closeAdmin(){try{var o=document.getElementById('adminOverlay');if(o)o.classList.add('hidden');}catch(e){}}
function toggleAdmin(){if(!isEtieAdmin()){toast('Admin restricted.');return;}try{var o=document.getElementById('adminOverlay');if(!o)return;if(o.classList.contains('hidden'))openAdmin();else closeAdmin();}catch(e){}}

function wipeLocalEtie(){ try{ if(!confirm('Wipe local ETIE (requests/messages/meetups/reviews, keep profile)?')) return; ETIE.requests={}; ETIE.messages={}; ETIE.meetups={}; ETIE.reviews={}; ETIE._travStars=0; ETIE._localStars=0; ETIE_MATCH_INDEX=0; saveState(); renderMatches(); renderRequests(); renderChat(); renderMessagesList(); renderMeetup(); renderTrips(); renderLocalDashboard(); toast('Local wiped — also run SQL wipe for cloud.'); }catch(e){} }
function wipeEverything(){
  if(!confirm('Are you sure you want to delete your data?')) return;
  if(!confirm('Yes, please proceed — permanently wipe profile, trips and chats on this device + cloud? (No = cancel)')) return;
  try{
    var client=window.EtieCloud&&window.EtieCloud.getClient&&window.EtieCloud.getClient();
    var sess=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession();
    var uid=sess&&sess.user&&sess.user.id;
    if(client&&uid){
      client.from('etie_messages').delete().eq('sender_id', uid).then(function(){});
      client.from('etie_meetups').delete().neq('request_id','00000000-0000-0000-0000-000000000000').then(function(){}); // RLS will scope, errors ignored
      client.from('etie_requests').delete().eq('traveller_id', uid).then(function(){});
      client.from('etie_reviews').delete().or('traveller_id.eq.'+uid+',local_id.eq.'+uid).then(function(){});
      client.from('etie_reports').delete().eq('reporter_id', uid).then(function(){});
      client.from('etie_profiles').delete().eq('user_id', uid).then(function(){});
      client.from('etie_states').delete().eq('user_id', uid).then(function(){});
    }
  }catch(e){}
  try{ localStorage.removeItem('etie-v1'); localStorage.removeItem('etie-v1-user-backup'); localStorage.setItem('etie-clean','1'); }catch(e){}
  try{ ETIE=loadState(); }catch(e){}
  setTimeout(function(){ location.reload(); }, 600);
}
(function(){ try{ var c=localStorage.getItem('etie-clean'); if(c!=='0'){ window.ETIE_CLEAN=true; localStorage.setItem('etie-clean','1'); setTimeout(function(){ var l=document.getElementById('cleanModeLine'); if(l) l.textContent='Clean mode ON (default)'; }, 600);} }catch(e){ window.ETIE_CLEAN=true; } })();
function refreshAdminLive(){
  try{
    var hint=document.getElementById('adminLiveHint');
    var uc=document.getElementById('adminUserCount'), vc=document.getElementById('adminVerifiedCount'), rc=document.getElementById('adminReportsCount'), mc=document.getElementById('adminMeetupsCount');
    var lp=document.getElementById('adminLiveProfiles'), lr=document.getElementById('adminLiveRequests');
    if(!window.EtieCloud || !window.EtieCloud.isSharedOn() || !window.EtieCloud.getClient || !window.EtieCloud.getClient()){
      if(hint) hint.textContent='Offline — sign in on both phones for live data.';
      if(uc) uc.textContent='—'; if(vc) vc.textContent='—'; if(rc) rc.textContent='—'; if(mc) mc.textContent='—';
      return;
    }
    if(hint) hint.textContent='Live · refreshing…';
    var client=window.EtieCloud.getClient();
    client.from('etie_profiles').select('*').order('updated_at',{ascending:false}).limit(20).then(function(r){
      var rows=(r&&r.data)||[];
      if(uc) uc.textContent=String(rows.length);
      var verified=rows.filter(function(x){return (x.hosted_count||0)>=3;}).length;
      if(vc) vc.textContent=String(verified);
      var isGuide=function(u){ try{ return ((u.interests||[]).length>0)||!!(u.offer)||(((u.avail_dates||[]).length)>0)||((u.hosted_count||0)>0); }catch(e){ return false; } };
      var guides=rows.filter(isGuide), travs=rows.filter(function(u){return !isGuide(u);});
      if(lp){
        lp.innerHTML='';
        if(!rows.length) lp.innerHTML='<div class="muted small">No profiles yet — complete onboarding on each phone.</div>';
        else {
          var gh=document.createElement('div'); gh.className='muted small'; gh.style.margin='4px 0'; gh.textContent='Local guides ('+guides.length+')'; lp.appendChild(gh);
          if(!guides.length){ var ge=document.createElement('div'); ge.className='muted small'; ge.textContent='None yet — a guide completes Local Steps 1–7.'; lp.appendChild(ge); }
          guides.forEach(function(u){
            var flag=''; try{ flag=flagForCountry(u.nationality||''); }catch(e){flag='🌍';}
            var name=u.display_name||String(u.user_id).slice(0,8);
            var row=document.createElement('div'); row.className='list-item';
            row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
            row.querySelector('strong').textContent=flag+' '+name+' · '+(u.city||'—');
            row.querySelector('.muted').textContent=(u.interests||[]).slice(0,3).join(' · ')||'no interests yet';
            row.querySelector('.status').textContent='Guide · '+(u.tier||'Rookie');
            lp.appendChild(row);
          });
          var th=document.createElement('div'); th.className='muted small'; th.style.margin='10px 0 4px'; th.textContent='Travellers ('+travs.length+')'; lp.appendChild(th);
          if(!travs.length){ var te=document.createElement('div'); te.className='muted small'; te.textContent='None — signed-in users without a guide profile land here.'; lp.appendChild(te); }
          travs.forEach(function(u){
            var flag2=''; try{ flag2=flagForCountry(u.nationality||''); }catch(e){flag2='🌍';}
            var name2=u.display_name||String(u.user_id).slice(0,8);
            var row2=document.createElement('div'); row2.className='list-item';
            row2.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
            row2.querySelector('strong').textContent=flag2+' '+name2;
            row2.querySelector('.muted').textContent='Traveller — no guide profile yet';
            row2.querySelector('.status').textContent='Traveller';
            lp.appendChild(row2);
          });
        }
      }
      var vq=document.getElementById('adminVerifyQueue');
      if(vq){
        vq.innerHTML='';
        if(!rows.length) vq.innerHTML='<div class="muted small">No users yet.</div>';
        else rows.forEach(function(u){
          var ms=[]; try{ ms=((u.verification&&u.verification.methods)||[]); }catch(e){}
          var nm=u.display_name||String(u.user_id).slice(0,8);
          var row=document.createElement('div'); row.className='list-item';
          row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
          row.querySelector('strong').textContent=nm;
          row.querySelector('.muted').textContent=ms.length?ms.join(' · '):'no verification submitted';
          row.querySelector('.status').textContent=ms.length?'Submitted':'Pending';
          vq.appendChild(row);
        });
      }
    });
    client.from('etie_reports').select('id',{count:'exact',head:true}).then(function(r){ if(rc) rc.textContent= String(r.count!=null?r.count:'—'); });
    client.from('etie_meetups').select('id',{count:'exact',head:true}).then(function(r){ if(mc) mc.textContent= String(r.count!=null?r.count:'—'); });
    client.from('etie_requests').select('id,local_mock_id,status,traveller_name,local_name,destination,updated_at').order('updated_at',{ascending:false}).limit(10).then(function(r){
      var rows=(r&&r.data)||[];
      if(!lr) return;
      if(!rows.length) lr.innerHTML='<div class="muted small">No requests yet — Fleming sends one, Ethan sees it here.</div>';
      else {
        lr.innerHTML='';
        rows.forEach(function(x){
          var row=document.createElement('div'); row.className='list-item';
          row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
          row.querySelector('strong').textContent=(x.traveller_name||'Traveller')+' → '+(x.local_name||x.local_mock_id)+' · '+x.status;
          row.querySelector('.muted').textContent=(x.destination||'—')+' · '+(new Date(x.updated_at).toLocaleString());
          row.querySelector('.status').textContent=x.status;
          lr.appendChild(row);
        });
      }
      if(hint) hint.textContent='Live · '+new Date().toLocaleTimeString();
    });
  }catch(e){ try{ var h=document.getElementById('adminLiveHint'); if(h) h.textContent='Live refresh failed.'; }catch(e2){}}
}
function toggleNav(){try{var n=document.getElementById('mainNav');var t=document.querySelector('.nav-toggle');if(n&&t){n.classList.toggle('open');t.textContent=n.classList.contains('open')?'✕':'☰';}}catch(e){}}

function setRole(role){try{ETIE.activeRole=role;}catch(e){}try{var u=new URL(window.location.href);u.searchParams.set('role',role);window.history.replaceState(null,'','?role='+role);}catch(e){}document.getElementById('travRole').classList.toggle('active',role==='traveller');document.getElementById('localRole').classList.toggle('active',role==='local');document.getElementById('travellerFlow').classList.toggle('hidden',role!=='traveller');document.getElementById('localFlow').classList.toggle('hidden',role!=='local');saveState();renderRoleGate();try{renderDerivedBadge();}catch(e){}if(role==='traveller')travNext(Math.min(17,Math.max(1,ETIE._lastTrav||1)));else localNext(Math.min(11,Math.max(1,ETIE._lastLocal||1)));showScreen('home');}
function hasAnyLocalData(){try{var l=ETIE.local||{};if(l.city||l.age||l.nationality||l.displayName)return true;if((l.interests||[]).length)return true;if((l.styleInterests||[]).length)return true;if(l.offer)return true;if(l.photo)return true;if((l.travelPhotos||[]).filter(Boolean).length)return true;if((l.availDates||[]).length)return true;if((l.verificationMethods||[]).length)return true;return false;}catch(e){return false;}}
function renderRoleGate(){
  try{
    var gate=document.getElementById('roleGate'); if(!gate)return;
    var fresh=!hasAnyTravellerData()&&!hasAnyLocalData()&&!ETIE.activeRole;
    try{ document.body.classList.toggle('no-role',!!fresh); }catch(e){}
    gate.style.display=fresh?'':'none';
    // both door cards always stay visible — they are the side switcher
    var et0=document.getElementById('entryCardTrav'); if(et0) et0.style.display='';
    var el0=document.getElementById('entryCardLocal'); if(el0) el0.style.display='';
    if(fresh){
      document.getElementById('travellerFlow').classList.add('hidden');
      document.getElementById('localFlow').classList.add('hidden');
      var rs0=document.getElementById('roleSwitch'); if(rs0) rs0.style.display='';
    } else if(ETIE.activeRole){
      document.getElementById('travellerFlow').classList.toggle('hidden',ETIE.activeRole!=='traveller');
      document.getElementById('localFlow').classList.toggle('hidden',ETIE.activeRole!=='local');
      document.getElementById('travRole').classList.toggle('active',ETIE.activeRole==='traveller');
      document.getElementById('localRole').classList.toggle('active',ETIE.activeRole==='local');
      var rs=document.getElementById('roleSwitch'); if(rs) rs.style.display='none';
    } else {
      var rs2=document.getElementById('roleSwitch'); if(rs2) rs2.style.display='';
    }
  }catch(e){}
}

// Demo personas — permanent test individuals for solo testing (same browser, no second phone).
// Cloud sync pauses while a persona is active so demo play never pollutes real tables.
function persBadges(el,o){
  try{
    if(!el) return;
    el.innerHTML=''; el.className='pers-badges';
    [['Social',o.social],['Spontaneous',o.spontaneous],['Curious',o.curious]].forEach(function(p){
      var s=document.createElement('span'); s.className='pers-badge'; s.textContent=p[0]+': '+p[1]+'/10'; el.appendChild(s);
    });
    if(o.vibe){var v=document.createElement('span');v.className='pers-badge';v.textContent='Vibe: '+o.vibe;el.appendChild(v);}
    if(o.pace){var pc=document.createElement('span');pc.className='pers-badge';pc.textContent='Pace: '+o.pace;el.appendChild(pc);}
    (o.extra||[]).forEach(function(x){var s=document.createElement('span');s.className='pers-badge';s.textContent=x;el.appendChild(s);});
  }catch(e){}
}
function hasAnyTravellerData(){
  try{
    if(ETIE.trip&&(ETIE.trip.destination||ETIE.trip.country||ETIE.trip.dates))return true;
    var t=ETIE.traveller||{};
    if(t.nickname||t.nationality||((t.verificationMethods||[]).length))return true;
    if((t.interests||[]).length)return true;
    if(t._vibeSet||(t.styleInterests||[]).length)return true;
    if((t.lookingFor||[]).length)return true;
    if(t.hook)return true;
    if(t.photo)return true;
    if((t.travelPhotos||[]).filter(Boolean).length)return true;
    return false;
  }catch(e){return true;}
}
function isSignedIn(){ try{ var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession(); return !!(s&&s.user); }catch(e){ return false; } }
function updateAuthHeader(){
  try{
    var in_=isSignedIn();
    var gb=document.getElementById('googleBtn'); if(gb) gb.style.display=in_?'none':'';
    try{ if(typeof renderDerivedBadge==='function')renderDerivedBadge(); }catch(e){}
    var cs=document.getElementById('cloudStatus'); if(cs) cs.style.display=in_?'none':'';
    var am=document.getElementById('avatarMenu'); if(am) am.style.display=in_?'':'none';
    if(!in_) closeAvatarMenu();
    try{ if(typeof updateAdminVisibility==='function') updateAdminVisibility(); }catch(e){}
  }catch(e){}
}
function toggleAvatarMenu(e){ try{ if(e&&e.stopPropagation) e.stopPropagation(); var d=document.getElementById('avatarDropdown'); if(d) d.classList.toggle('hidden'); }catch(_){} }
function closeAvatarMenu(){ try{ var d=document.getElementById('avatarDropdown'); if(d) d.classList.add('hidden'); }catch(_){} }
function renderHeaderProfile(){
  try{
    var box=document.getElementById('headerProfile'); if(!box)return;
    updateAuthHeader();
    if(!isSignedIn()){ box.style.display='none'; return; }
    var t=ETIE.traveller||{};
    var photo=t.photo||ETIE.local.photo||googleAvatar();
    var name=t.nickname||ETIE.local.displayName||'';
    var flag=''; try{ flag=flagForCountry(t.nationality||ETIE.local.nationality||''); }catch(e){}
    if(!name && !photo){ try{ var _s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession(); var _em=_s&&_s.user&&_s.user.email; name=_em?_em.split('@')[0]:'Account'; }catch(e){ name='Account'; } }
    box.style.display='';
    var av=document.getElementById('headerAvatar');
    if(av){ if(photo) av.innerHTML='<img src="'+photo+'">'; else av.textContent=(name||'?').charAt(0).toUpperCase(); }
    var nm=document.getElementById('headerName');
    if(nm) nm.textContent=(flag?flag+' ':'')+(name||'Traveller');
  }catch(e){}
}
function updateProfileVisibility(){
  try{
    renderHeaderProfile();
    renderRoleGate();
    var role=ETIE.activeRole||null;
    var showTrav=!role||role==='traveller';
    var showLocal=!role||role==='local';
    var travReady=hasAnyTravellerData()&&showTrav;
    var localReady=hasAnyLocalData()&&showLocal;
    var ready=travReady||localReady;
    var navBtn=document.getElementById('navProfileBtn');
    if(navBtn)navBtn.style.display='';
    var content=document.getElementById('profileContent');
    if(content)content.style.display=travReady?'':'none';
    var lpc=document.getElementById('localProfileContent');
    if(lpc)lpc.style.display=localReady?'':'none';
    var locked=document.getElementById('profileLocked');
    if(locked){
      locked.style.display=ready?'none':'';
      try{
        var p=locked.querySelector('p');
        var btn=locked.querySelector('button');
        if(role==='local'){ if(p)p.textContent='No local profile yet — complete Local Steps 1–7 and your profile will appear here.'; if(btn){btn.textContent='Start Local Step 1'; btn.setAttribute('onclick',"setRole('local');showScreen('home')");} }
        else { if(p)p.textContent='No profile yet — complete Traveller Steps 1–7 and your profile will appear here.'; if(btn){btn.textContent='Start Step 1'; btn.setAttribute('onclick',"setRole('traveller');showScreen('home')");} }
      }catch(e){}
    }
  }catch(e){}
}
function renderProfiles(){
  try{updateProfileVisibility();}catch(e){}
  try{renderLiteProfile();}catch(e){}
}
function renderLiteProfile(){
  try{
    var signed=false; try{signed=isSignedIn();}catch(e){}
    var so=document.getElementById('liteSignedOut'); if(so)so.style.display=signed?'none':'';
    var fm=document.getElementById('liteForm'); if(fm)fm.style.display=signed?'':'none';
    if(!signed)return;
    var tr=ETIE.traveller||{};
    var nick=tr.nickname||ETIE.local.displayName||'';
    var ni=document.getElementById('liteNick'); if(ni&&document.activeElement!==ni)ni.value=nick;
    var bi=document.getElementById('liteBio'); if(bi&&document.activeElement!==bi)bi.value=tr.bio||'';
    var ci=document.getElementById('liteCity'); if(ci&&document.activeElement!==ci)ci.value=ETIE.local.city||'Hong Kong';
    var photo=tr.photo||ETIE.local.photo||googleAvatar();
    var av=document.getElementById('liteAvatar');
    if(av){if(photo)av.innerHTML='<img src="'+photo+'">';else av.innerHTML='<span>+</span>';}
    var rl=document.getElementById('liteRoleLine');
    if(rl){var role=(ETIE.derivedRole||ETIE.activeRole||'traveller');rl.textContent=(role==='local'?'\uD83C\uDDED\uD83C\uDDF0 Local host':'\u2708\uFE0F Traveller')+' \u00B7 '+(ETIE.local.city||'Hong Kong');}
    var methods=tr.verificationMethods||[];
    var lv=document.getElementById('liteVerify');
    if(lv)Array.prototype.forEach.call(lv.querySelectorAll('.list-item'),function(row){
      var on=methods.indexOf(row.getAttribute('data-method'))!==-1;
      row.classList.toggle('selected',on);
      var st=row.querySelector('.status'); if(st)st.textContent=on?'Selected':'Tap to select';
    });
    var st2=document.getElementById('liteStats');
    if(st2){var tc=tr.completedTrips||0;st2.textContent=tc?('Meetups: '+tc):'No meetups yet \u2014 complete one to build reputation.';}
    var done=isProfileComplete();
    var editing=false; try{editing=!!ETIE._editingProfile;}catch(e){}
    var showDone=done&&!editing;
    var fisrt=firstIncompleteStep();
    var maxStep=(fisrt===0)?3:fisrt;
    var step=Math.min(ETIE.profileStep||1,maxStep);
    ETIE.profileStep=step;
    var sb=document.getElementById('liteStepsBar'); if(sb)sb.style.display=showDone?'none':'';
    [1,2,3].forEach(function(n){
      var s=document.getElementById('liteStep'+n); if(s)s.style.display=(!showDone&&n===step)?'':'none';
      var d=document.getElementById('liteDot'+n);
      if(d){d.classList.toggle('active',!showDone&&n===step);d.classList.toggle('done',stepValid(n));d.classList.toggle('locked',!showDone&&n>maxStep);}
    });
    var nav=document.getElementById('liteNav'); if(nav)nav.style.display=showDone?'none':'';
    var bk=document.getElementById('liteBack'); if(bk)bk.style.display=(!showDone&&step>1)?'':'none';
    var nx=document.getElementById('liteNext');
    if(nx)nx.textContent=(step>=3)?(done?'Done — back to Map':'Complete Profile & Unlock Map'):'Continue';
    var dv=document.getElementById('liteDoneView'); if(dv)dv.style.display=showDone?'':'none';
    if(showDone){try{renderDoneView();}catch(e){}}
    var rep=document.getElementById('liteRepBlock'); if(rep)rep.style.display=done?'':'none';
    try{renderHeaderProfile();}catch(e){}
  }catch(e){}
}
function stepValid(n){
  try{
    var tr=ETIE.traveller||{};
    if(n===1)return !!((tr.nickname||ETIE.local.displayName)&&(tr.photo||ETIE.local.photo||googleAvatar()));
    if(n===2)return ((tr.verificationMethods||[]).length>0);
    if(n===3)return !!((tr.bio||'').trim());
  }catch(e){}
  return false;
}
function stepMissingMsg(n){
  if(n===1)return 'Add a nickname and a photo first.';
  if(n===2)return 'Pick at least one verification method.';
  return 'Write your personal hook first.';
}
function firstIncompleteStep(){
  try{
    var tr=ETIE.traveller||{};
    if(!(tr.nickname||ETIE.local.displayName)||!(tr.photo||ETIE.local.photo||googleAvatar()))return 1;
    if(!((tr.verificationMethods||[]).length))return 2;
    if(!((tr.bio||'').trim()))return 3;
  }catch(e){}
  return 0;
}
function isProfileComplete(){
  try{
    if(!isSignedIn())return false;
    if(ETIE.profileComplete)return true;
    return firstIncompleteStep()===0;
  }catch(e){return false;}
}
function gotoProfileStep(n){
  try{
    n=Math.min(3,Math.max(1,n));
    var fisrt=firstIncompleteStep();
    var maxStep=(fisrt===0)?3:fisrt;
    if(n>maxStep){toast('Finish step '+maxStep+' first — steps unlock one by one.');n=maxStep;}
    ETIE.profileStep=n;saveState();renderLiteProfile();
  }catch(e){}
}
function stepProfile(d){
  try{
    var step=ETIE.profileStep||1;
    if(d>0){
      if(!stepValid(step)){toast(stepMissingMsg(step));gotoProfileStep(step);return;}
      if(step>=3){
        ETIE.profileComplete=true;ETIE._editingProfile=false;saveState();renderLiteProfile();try{refreshGate();}catch(e){}
        toast('Profile complete — map unlocked.');
        try{showScreen('map');}catch(e){}
        return;
      }
    }
    gotoProfileStep(step+d);
  }catch(e){}
}
function needProfile(action){
  try{
    if(!isSignedIn()){toast('Sign in to '+action+'.');try{showScreen('profile');}catch(e){}return true;}
    if(!isProfileComplete()){
      var m=firstIncompleteStep()||1;
      ETIE.profileStep=m;saveState();renderLiteProfile();
      toast('Finish your profile (step '+m+' of 3) to '+action+'.');
      try{showScreen('profile');}catch(e){}
      return true;
    }
  }catch(e){}
  return false;
}
function editProfile(){try{ETIE._editingProfile=true;ETIE.profileStep=1;saveState();renderLiteProfile();}catch(e){}}
function myHookVibes(){
  try{
    var me=hookNick(),seen={},out=[];
    (allMapPins()||[]).forEach(function(p){
      var mine=(p.members||[]).some(function(m){return m.nick===me;});
      if(!mine&&p.name!==me)return;
      if(p.category&&!seen[p.category]){seen[p.category]=1;out.push(p.category);}
    });
    return out;
  }catch(e){return [];}
}
function renderDoneView(){
  try{
    var tr=ETIE.traveller||{};
    var nick=tr.nickname||ETIE.local.displayName||'Someone';
    var photo=tr.photo||ETIE.local.photo||googleAvatar();
    var av=document.getElementById('doneAvatar');
    if(av){if(photo)av.innerHTML='<img src="'+photo+'">';else av.innerHTML='<span>+</span>';}
    var nm=document.getElementById('doneName'); if(nm)nm.textContent=nick;
    var vb=document.getElementById('doneVerified');
    if(vb){var v=(tr.verificationMethods||[]).length>0;vb.textContent=v?'✅ Verified':'';vb.style.display=v?'':'none';}
    var rl=document.getElementById('doneRole');
    if(rl){var role=(ETIE.derivedRole||ETIE.activeRole||'traveller');rl.textContent=role==='local'?'🇭🇰 Local Host':'✈️ Traveller';rl.classList.toggle('city-host',role==='local');}
    var ct=document.getElementById('doneCity'); if(ct)ct.textContent='🏠 '+(ETIE.local.city||'Hong Kong');
    var vs=document.getElementById('doneVibes');
    if(vs){vs.innerHTML='';var vibes=myHookVibes();
      if(!vibes.length){var e=document.createElement('span');e.className='muted small';e.textContent='No vibes yet — drop a hook.';vs.appendChild(e);}
      vibes.forEach(function(v){var s=document.createElement('span');s.className='chip active';s.textContent=mapCatEmoji(v)+' '+v;vs.appendChild(s);});
    }
    var hk=document.getElementById('doneHook'); if(hk)hk.textContent='“'+(tr.bio||'No personal hook yet.')+'”';
    renderMemories();renderSpots();renderPassions();
    renderFeaturedMemories();
    renderPassport();
  }catch(e){}
}
function showProfileTab(tab){
  try{
    var prof=document.getElementById('liteDoneView');
    var pass=document.getElementById('passportView');
    var t1=document.getElementById('tabProfile');
    var t2=document.getElementById('tabPassport');
    if(tab==='passport'){
      if(prof)prof.classList.remove('active');
      if(pass)pass.classList.add('active');
      if(t1)t1.classList.remove('active');
      if(t2)t2.classList.add('active');
      renderPassport();
    }else{
      if(prof)prof.classList.add('active');
      if(pass)pass.classList.remove('active');
      if(t1)t1.classList.add('active');
      if(t2)t2.classList.remove('active');
    }
  }catch(e){}
}
function getFeaturedMemories(){try{var m=ETIE.traveller&&ETIE.traveller.featuredMemories;return Array.isArray(m)?m.slice(0,3):[];}catch(e){return [];}}
function saveFeaturedMemories(arr){
  try{
    ETIE.traveller.featuredMemories=(arr||[]).slice(0,3);
    saveState();renderLiteProfile();
  }catch(e){}
}
function toggleFeaturedMemory(logEntry){
  try{
    var featured=getFeaturedMemories();
    var exists=featured.findIndex(function(f){return f.logId===logEntry.logId;});
    if(exists>=0){
      featured.splice(exists,1);
      toast('Removed from featured.');
    }else if(featured.length<3){
      featured.unshift(logEntry);
      toast('Pinned to featured!');
    }else{
      toast('Max 3 featured memories.');
      return;
    }
    saveFeaturedMemories(featured);
  }catch(e){}
}
function openProfileDrawer(){
  try{
    renderProfileDrawer();
    var o=document.getElementById('profileDrawer');
    if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeProfileDrawer(){
  try{
    var o=document.getElementById('profileDrawer');
    if(o)o.classList.add('hidden');
  }catch(e){}
}
function showProfileDrawerTab(tab){
  try{
    var prof=document.getElementById('profileDrawerView');
    var pass=document.getElementById('passportDrawerView');
    var t1=document.getElementById('tabDrawerProfile');
    var t2=document.getElementById('tabDrawerPassport');
    if(tab==='passport'){
      if(prof)prof.classList.remove('active');
      if(pass)pass.classList.add('active');
      if(t1)t1.classList.remove('active');
      if(t2)t2.classList.add('active');
      renderPassportDrawer();
    }else{
      if(prof)prof.classList.add('active');
      if(pass)pass.classList.remove('active');
      if(t1)t1.classList.add('active');
      if(t2)t2.classList.remove('active');
    }
  }catch(e){}
}
function renderProfileDrawer(){
  try{
    var tr=ETIE.traveller||{};
    var nick=tr.nickname||ETIE.local.displayName||'Someone';
    var photo=tr.photo||ETIE.local.photo||googleAvatar();
    var av=document.getElementById('drawerAvatar');
    if(av){if(photo)av.innerHTML='<img src="'+photo+'">';else av.innerHTML='<span>+</span>';}
    var nm=document.getElementById('drawerName'); if(nm)nm.textContent=nick;
    var vb=document.getElementById('drawerVerified');
    if(vb){var v=(tr.verificationMethods||[]).length>0;vb.textContent=v?'✅ Verified':'';vb.style.display=v?'':'none';}
    var rl=document.getElementById('drawerRole');
    if(rl){var role=(ETIE.derivedRole||ETIE.activeRole||'traveller');rl.textContent=role==='local'?'🇭🇰 Local Host':'✈️ Traveller';rl.classList.toggle('city-host',role==='local');}
    var ct=document.getElementById('drawerCity'); if(ct)ct.textContent='🏠 '+(ETIE.local.city||'Hong Kong');
    var vs=document.getElementById('drawerVibes');
    if(vs){vs.innerHTML='';var vibes=myHookVibes();
      if(!vibes.length){var e=document.createElement('span');e.className='muted small';e.textContent='No vibes yet — drop a hook.';vs.appendChild(e);}
      vibes.forEach(function(v){var s=document.createElement('span');s.className='chip active';s.textContent=mapCatEmoji(v)+' '+v;vs.appendChild(s);});
    }
    var hk=document.getElementById('drawerHook'); if(hk)hk.textContent='“'+(tr.bio||'No personal hook yet.')+'”';
    renderDrawerMemories();
    renderDrawerSpots();
    renderDrawerPassions();
    renderDrawerFeaturedMemories();
  }catch(e){}
}
function renderPassportDrawer(){
  try{
    var visitsBox=document.getElementById('drawerPassportVisits');
    var connBox=document.getElementById('drawerPassportConnections');
    if(!visitsBox || !connBox) return;
    visitsBox.innerHTML='';
    connBox.innerHTML='';
    var tr=ETIE.traveller||{};
    var diary=tr.activityDiary||[];
    // Neighborhood Visit Log
    var visits={};
    diary.forEach(function(e){
      if(e.neighborhood){
        var key=e.neighborhood;
        if(!visits[key]) visits[key]={count:0,last:0,icon:'🏙️'};
        visits[key].count++;
        if(e.timestamp>visits[key].last) visits[key].last=e.timestamp;
      }
    });
    if(Object.keys(visits).length===0){
      visitsBox.innerHTML='<div class="muted small" style="text-align:center;padding:24px;">No neighborhood visits yet.<br>Complete a verified hangout to log your first visit.</div>';
    }else{
      Object.entries(visits).sort(function(a,b){return b[1].last-a[1].last;}).forEach(function(entry){
        var name=entry[0], data=entry[1];
        var item=document.createElement('div');item.className='visit-item';
        item.innerHTML='<div class="visit-icon">🏙️</div>'
          +'<div class="visit-info"><div class="visit-name">'+name+'</div>'
          +'<div class="visit-meta">'+data.count+' visit'+(data.count===1?'':'s')+' · Last: '+fmtWhen(data.last)+'</div></div>';
        visitsBox.appendChild(item);
      });
    }
    // Co-Signed Connections
    var connections=diary.filter(function(e){return e.handshakeNote;});
    if(connections.length===0){
      connBox.innerHTML='<div class="muted small" style="text-align:center;padding:24px;">No co-signed connections yet.<br>Tag a friend in a memory to start a handshake.</div>';
    }else{
      connections.forEach(function(c){
        var item=document.createElement('div');item.className='connection-card';
        var initials=c.guestNick?c.guestNick.charAt(0).toUpperCase():'?';
        item.innerHTML='<div class="connection-avatars">'
          +'<div class="avatar" style="background:linear-gradient(135deg,#f43f5e,#fb7185);">'+initials+'</div>'
          +'<div class="avatar" style="background:linear-gradient(135deg,#0ea5e9,#22d3ee);">'+(hookNick()||'?').charAt(0).toUpperCase()+'</div>'
          +'</div>'
          +'<div class="connection-info">'
          +'<div class="connection-note">“'+c.handshakeNote+'”</div>'
          +'<div class="connection-meta">with '+c.guestNick+' · '+fmtWhen(c.timestamp)+'</div>'
          +'</div>';
        connBox.appendChild(item);
      });
    }
  }catch(e){}
}
function renderDrawerMemories(){
  try{
    var box=document.getElementById('drawerMemories');if(!box)return;
    box.innerHTML='';
    var mems=getMemories();
    for(var i=0;i<3;i++){
      (function(idx){
        var m=mems[idx];
        var card=document.createElement('div');card.className='mem-card';
        if(m&&m.image_url){
          var im=document.createElement('img');im.src=m.image_url;im.alt='Memory '+(idx+1);card.appendChild(im);
          var cap=document.createElement('input');cap.className='mem-cap';cap.maxLength=80;cap.placeholder='Add a caption…';cap.value=m.caption||'';
          cap.onchange=function(){var a=getMemories();if(a[idx]){a[idx].caption=cap.value.slice(0,80);saveMemories(a);}};
          card.appendChild(cap);
          var del=document.createElement('button');del.className='mem-del';del.textContent='✕ Remove';
          del.onclick=function(){var a=getMemories();a.splice(idx,1);saveMemories(a);toast('Memory removed.');};
          card.appendChild(del);
        }else{
          card.className='mem-card mem-empty';
          var plus=document.createElement('button');plus.className='mem-plus';plus.textContent='+';plus.title='Add Memory Photo';
          plus.onclick=function(){pickMemoryFile(idx);};
          card.appendChild(plus);
          var lab=document.createElement('span');lab.className='muted small';lab.textContent='Add Memory Photo';card.appendChild(lab);
          var urlrow=document.createElement('div');urlrow.className='mem-urlrow';
          var ui=document.createElement('input');ui.placeholder='or paste image URL…';
          var ub=document.createElement('button');ub.className='secondary';ub.textContent='Add';
          ub.onclick=function(){var u=(ui.value||'').trim();if(!u){toast('Paste an image URL first.');return;}var a=getMemories();a[idx]={id:Date.now(),image_url:u,caption:''};saveMemories(a);toast('Memory added.');};
          urlrow.appendChild(ui);urlrow.appendChild(ub);card.appendChild(urlrow);
        }
        box.appendChild(card);
      })(i);
    }
  }catch(e){}
}
function renderDrawerSpots(){
  try{
    var box=document.getElementById('drawerSpots');if(!box)return;
    var title=document.getElementById('drawerSpotsTitle');
    var tr=ETIE.traveller||{};var spots=tr.spots||[];
    if(title)title.textContent=spots.length?'Local spots':'Local spots (add up to 3)';
    box.innerHTML='';
    for(var i=0;i<3;i++){
      (function(idx){
        var s=spots[idx];
        var card=document.createElement('div');card.className='spot-card';
        if(s&&s.name){
          var em=document.createElement('div');em.className='spot-emoji';em.textContent=s.emoji||'📍';card.appendChild(em);
          var nm=document.createElement('div');nm.className='spot-name';nm.textContent=s.name;card.appendChild(nm);
          var nb=document.createElement('div');nb.className='spot-nbhd';nm.textContent=s.neighborhood||'';card.appendChild(nb);
          var del=document.createElement('button');del.className='mem-del';del.textContent='✕';del.onclick=function(){var a=spots;a.splice(idx,1);tr.spots=a;saveState();renderLiteProfile();renderProfileDrawer();};
          card.appendChild(del);
        }else{
          card.className='spot-card spot-empty';
          var plus=document.createElement('button');plus.className='mem-plus';plus.textContent='+';plus.title='Add Local Spot';
          plus.onclick=function(){pickSpotFile(idx);};
          card.appendChild(plus);
          var lab=document.createElement('span');lab.className='muted small';lab.textContent='Add Local Spot';card.appendChild(lab);
        }
        box.appendChild(card);
      })(i);
    }
  }catch(e){}
}
function renderDrawerPassions(){
  try{
    var box=document.getElementById('drawerPassions');if(!box)return;
    box.innerHTML='';
    var stats=ETIE.traveller?.activityStats||{};
    var keys=Object.keys(stats);
    if(!keys.length){var e=document.createElement('span');e.className='muted small';e.textContent='No passion badges yet — log a hangout to earn one.';box.appendChild(e);return;}
    keys.sort(function(a,b){return stats[b]-stats[a];});
    keys.slice(0,6).forEach(function(k){
      var cnt=stats[k];
      var emoji=passionEmoji(k);
      var badge=emoji+' '+k+(cnt>1?' ('+cnt+')':'');
      var s=document.createElement('span');s.className='chip active';s.textContent=badge;box.appendChild(s);
    });
  }catch(e){}
}
function renderDrawerFeaturedMemories(){
  try{
    var box=document.getElementById('drawerFeaturedMemories');if(!box)return;
    box.innerHTML='';
    var featured=getFeaturedMemories();
    if(!featured.length){
      box.innerHTML='<div class="mem-card mem-empty" style="grid-column:1/-1;text-align:center;padding:24px;"><div class="muted small">No featured memories yet.<br>Confirm a handshake to unlock pinning.</div></div>';
      return;
    }
    featured.forEach(function(f){
      var card=document.createElement('div');card.className='featured-card';
      if(f.photoUrl){
        var im=document.createElement('img');im.src=f.photoUrl;im.alt='Featured Memory';card.appendChild(im);
      }
      var cap=document.createElement('div');cap.className='featured-caption';cap.textContent='“'+(f.handshakeNote||'')+'”';card.appendChild(cap);
      var meta=document.createElement('div');meta.className='featured-meta';
      meta.innerHTML='<span>'+(f.activity||'Hangout')+'</span><span>'+(f.guestNick||'Co-signer')+'</span><span>'+fmtWhen(f.timestamp)+'</span>';
      card.appendChild(meta);
      var pin=document.createElement('div');pin.className='featured-pin';
      var isPinned=true;
      var btn=document.createElement('button');btn.textContent='★';btn.className=isPinned?'pinned':'';btn.title='Unpin from featured';
      btn.onclick=function(){toggleFeaturedMemory(f);};
      pin.appendChild(btn);card.appendChild(pin);
      box.appendChild(card);
    });
    var remaining=3-featured.length;
    for(var i=0;i<remaining;i++){
      var empty=document.createElement('div');empty.className='mem-card mem-empty';
      empty.innerHTML='<button class="mem-plus" style="opacity:.4;" disabled>+</button><span class="muted small">Pin a memory</span>';
      box.appendChild(empty);
    }
  }catch(e){}
}
function renderFeaturedMemories(){
  try{
    var box=document.getElementById('featuredMemories');if(!box)return;
    box.innerHTML='';
    var featured=getFeaturedMemories();
    if(!featured.length){
      box.innerHTML='<div class="mem-card mem-empty" style="grid-column:1/-1;text-align:center;padding:24px;"><div class="muted small">No featured memories yet.<br>Confirm a handshake to unlock pinning.</div></div>';
      return;
    }
    featured.forEach(function(f){
      var card=document.createElement('div');card.className='featured-card';
      if(f.photoUrl){
        var im=document.createElement('img');im.src=f.photoUrl;im.alt='Featured Memory';card.appendChild(im);
      }
      var cap=document.createElement('div');cap.className='featured-caption';cap.textContent='“'+(f.handshakeNote||'')+'”';card.appendChild(cap);
      var meta=document.createElement('div');meta.className='featured-meta';
      meta.innerHTML='<span>'+(f.activity||'Hangout')+'</span><span>'+(f.guestNick||'Co-signer')+'</span><span>'+fmtWhen(f.timestamp)+'</span>';
      card.appendChild(meta);
      var pin=document.createElement('div');pin.className='featured-pin';
      var isPinned=true;
      var btn=document.createElement('button');btn.textContent='★';btn.className=isPinned?'pinned':'';btn.title='Unpin from featured';
      btn.onclick=function(){toggleFeaturedMemory(f);};
      pin.appendChild(btn);card.appendChild(pin);
      box.appendChild(card);
    });
    // Empty slots
    var remaining=3-featured.length;
    for(var i=0;i<remaining;i++){
      var empty=document.createElement('div');empty.className='mem-card mem-empty';
      empty.innerHTML='<button class="mem-plus" style="opacity:.4;" disabled>+</button><span class="muted small">Pin a memory</span>';
      box.appendChild(empty);
    }
  }catch(e){}
}
function renderPassport(){
  try{
    var visitsBox=document.getElementById('passportVisits');
    var connBox=document.getElementById('passportConnections');
    if(!visitsBox || !connBox) return;
    visitsBox.innerHTML='';
    connBox.innerHTML='';
    var tr=ETIE.traveller||{};
    var diary=tr.activityDiary||[];
    // Neighborhood Visit Log
    var visits={};
    diary.forEach(function(e){
      if(e.neighborhood){
        var key=e.neighborhood;
        if(!visits[key]) visits[key]={count:0,last:0,icon:'🏙️'};
        visits[key].count++;
        if(e.timestamp>visits[key].last) visits[key].last=e.timestamp;
      }
    });
    if(Object.keys(visits).length===0){
      visitsBox.innerHTML='<div class="muted small" style="text-align:center;padding:24px;">No neighborhood visits yet.<br>Complete a verified hangout to log your first visit.</div>';
    }else{
      Object.entries(visits).sort(function(a,b){return b[1].last-a[1].last;}).forEach(function(entry){
        var name=entry[0], data=entry[1];
        var item=document.createElement('div');item.className='visit-item';
        item.innerHTML='<div class="visit-icon">🏙️</div>'
          +'<div class="visit-info"><div class="visit-name">'+name+'</div>'
          +'<div class="visit-meta">'+data.count+' visit'+(data.count===1?'':'s')+' · Last: '+fmtWhen(data.last)+'</div></div>';
        visitsBox.appendChild(item);
      });
    }
    // Co-Signed Connections
    var connections=diary.filter(function(e){return e.handshakeNote;});
    if(connections.length===0){
      connBox.innerHTML='<div class="muted small" style="text-align:center;padding:24px;">No co-signed connections yet.<br>Tag a friend in a memory to start a handshake.</div>';
    }else{
      connections.forEach(function(c){
        var item=document.createElement('div');item.className='connection-card';
        var initials=c.guestNick?c.guestNick.charAt(0).toUpperCase():'?';
        item.innerHTML='<div class="connection-avatars">'
          +'<div class="avatar" style="background:linear-gradient(135deg,#f43f5e,#fb7185);">'+initials+'</div>'
          +'<div class="avatar" style="background:linear-gradient(135deg,#0ea5e9,#22d3ee);">'+(hookNick()||'?').charAt(0).toUpperCase()+'</div>'
          +'</div>'
          +'<div class="connection-info">'
          +'<div class="connection-note">“'+c.handshakeNote+'”</div>'
          +'<div class="connection-meta">with '+c.guestNick+' · '+fmtWhen(c.timestamp)+'</div>'
          +'</div>';
        connBox.appendChild(item);
      });
    }
  }catch(e){}
}
function getMemories(){try{var m=ETIE.traveller&&ETIE.traveller.memories;return Array.isArray(m)?m.slice(0,3):[];}catch(e){return [];}}
function saveMemories(arr){
  try{
    ETIE.traveller.memories=(arr||[]).slice(0,3);
    if(ETIE.profileComplete&&!isProfileComplete())ETIE.profileComplete=false;
    saveState();renderLiteProfile();
  }catch(e){}
}
function renderMemories(){
  try{
    var box=document.getElementById('liteMemories');if(!box)return;
    box.innerHTML='';
    var mems=getMemories();
    for(var i=0;i<3;i++){
      (function(idx){
        var m=mems[idx];
        var card=document.createElement('div');card.className='mem-card';
        if(m&&m.image_url){
          var im=document.createElement('img');im.src=m.image_url;im.alt='Memory '+(idx+1);card.appendChild(im);
          var cap=document.createElement('input');cap.className='mem-cap';cap.maxLength=80;cap.placeholder='Add a caption…';cap.value=m.caption||'';
          cap.onchange=function(){var a=getMemories();if(a[idx]){a[idx].caption=cap.value.slice(0,80);saveMemories(a);}};
          card.appendChild(cap);
          var del=document.createElement('button');del.className='mem-del';del.textContent='✕ Remove';
          del.onclick=function(){var a=getMemories();a.splice(idx,1);saveMemories(a);toast('Memory removed.');};
          card.appendChild(del);
        }else{
          card.className='mem-card mem-empty';
          var plus=document.createElement('button');plus.className='mem-plus';plus.textContent='+';plus.title='Add Memory Photo';
          plus.onclick=function(){pickMemoryFile(idx);};
          card.appendChild(plus);
          var lab=document.createElement('span');lab.className='muted small';lab.textContent='Add Memory Photo';card.appendChild(lab);
          var urlrow=document.createElement('div');urlrow.className='mem-urlrow';
          var ui=document.createElement('input');ui.placeholder='or paste image URL…';
          var ub=document.createElement('button');ub.className='secondary';ub.textContent='Add';
          ub.onclick=function(){var u=(ui.value||'').trim();if(!u){toast('Paste an image URL first.');return;}var a=getMemories();a[idx]={id:Date.now(),image_url:u,caption:''};saveMemories(a);toast('Memory added.');};
          urlrow.appendChild(ui);urlrow.appendChild(ub);card.appendChild(urlrow);
        }
        box.appendChild(card);
      })(i);
    }
    try{
      if(window.EtieCloud&&window.EtieCloud.fetchUserLogs){
        var myId=null;try{var _s=window.EtieCloud.getSession();myId=_s&&_s.user&&_s.user.id;}catch(e){}
        if(myId)window.EtieCloud.fetchUserLogs(myId,function(rows){
          try{
            var urls={};
            (rows||[]).forEach(function(r){if(r&&r.is_live_verified&&r.photo_url)urls[r.photo_url]=1;});
            if(!Object.keys(urls).length)return;
            var cur=document.getElementById('liteMemories');
            if(!cur||cur!==box)return;
            Array.prototype.forEach.call(box.querySelectorAll('.mem-card'),function(card){
              try{
                var im=card.querySelector('img');if(!im||!urls[im.getAttribute('src')]||card.querySelector('.live-badge'))return;
                var bdg=document.createElement('div');bdg.className='live-badge';bdg.textContent='⚡ Verified Live';card.appendChild(bdg);
              }catch(e){}
            });
          }catch(e){}
        });
      }
    }catch(e){}
  }catch(e){}
}
function pickMemoryFile(idx){
  try{
    window._memSlot=idx;
    var f=document.getElementById('memFileInput');
    if(!f){f=document.createElement('input');f.type='file';f.id='memFileInput';f.accept='image/*';f.style.display='none';f.onchange=function(){handleMemoryFile(f);};document.body.appendChild(f);}
    f.click();
  }catch(e){}
}
function handleMemoryFile(input){
  try{
    var file=input.files&&input.files[0];if(!file)return;
    var idx=(window._memSlot==null?0:window._memSlot);window._memSlot=null;
    try{input.value='';}catch(e){}
    var done=function(url){
      try{var a=getMemories();a[idx]={id:Date.now(),image_url:url,caption:(a[idx]&&a[idx].caption)||''};saveMemories(a);toast('Memory added.');}catch(e){}
    };
    if(window.EtieCloud&&window.EtieCloud.uploadPhoto){
      window.EtieCloud.uploadPhoto(file,'memory').then(done).catch(function(){readLocal();});
    }else readLocal();
    function readLocal(){
      try{
        var r=new FileReader();
        r.onload=function(e){done(e.target.result);};
        r.readAsDataURL(file);
      }catch(e){toast('Could not read photo.');}
    }
  }catch(e){}
}
function getSpots(){try{var s=ETIE.traveller&&ETIE.traveller.spots;return Array.isArray(s)?s.slice(0,3):[];}catch(e){return [];}}
function saveSpots(arr){
  try{
    ETIE.traveller.spots=(arr||[]).slice(0,3);
    saveState();renderDoneView();
  }catch(e){}
}
var SPOT_EMOJIS=['🥟','🍺','📸','⚽','☕','🍸','🍜','🎵','🛍️','🌿'];
function renderSpots(){
  try{
    var box=document.getElementById('doneSpots');if(!box)return;
    box.innerHTML='';
    var spots=getSpots();
    var title=document.getElementById('doneSpotsTitle');
    var nick='';try{nick=ETIE.traveller.nickname||'Your';}catch(e){}
    if(title)title.textContent=(nick||'Your').toUpperCase()+"'S LOCAL SPOTS (UP TO 3)";
    for(var i=0;i<3;i++){
      (function(idx){
        var s=spots[idx];
        var card=document.createElement('div');card.className='spot-card';
        if(s&&s.name){
          var em=document.createElement('div');em.className='spot-emoji';em.textContent=s.emoji||'📍';card.appendChild(em);
          var nm=document.createElement('div');nm.className='spot-name';nm.textContent=s.name;card.appendChild(nm);
          var hd=document.createElement('div');hd.className='muted small';hd.textContent=s.hood||'';card.appendChild(hd);
          var del=document.createElement('button');del.className='mem-del';del.textContent='✕ Remove';
          del.onclick=function(){var a=getSpots();a.splice(idx,1);saveSpots(a);toast('Spot removed.');};
          card.appendChild(del);
        }else{
          card.classList.add('spot-empty');
          var nI=document.createElement('input');nI.placeholder='Venue name';nI.maxLength=40;
          var hI=document.createElement('input');hI.placeholder='Neighborhood';hI.maxLength=40;
          var eS=document.createElement('select');
          SPOT_EMOJIS.forEach(function(e){var o=document.createElement('option');o.value=e;o.textContent=e;eS.appendChild(o);});
          var add=document.createElement('button');add.className='secondary';add.textContent='Save spot';
          add.onclick=function(){
            var nm=(nI.value||'').trim();if(!nm){toast('Name the venue first.');return;}
            var a=getSpots();a[idx]={name:nm.slice(0,40),hood:(hI.value||'').trim().slice(0,40),emoji:eS.value};
            saveSpots(a);toast('Spot saved.');
          };
          card.appendChild(nI);card.appendChild(hI);card.appendChild(eS);card.appendChild(add);
        }
        box.appendChild(card);
      })(i);
    }
  }catch(e){}
}
function hostHereSpot(name){
  try{
    closePinDetail();
    openDropHook();
    var li=document.getElementById('hookLocation');if(li&&name)li.value=name.slice(0,80);
  }catch(e){}
}
function fillSpotsStrip(boxId,userId){
  try{
    var box=document.getElementById(boxId);if(!box)return;
    box.innerHTML='';box.style.display='none';
    if(!userId||!window.EtieCloud||!window.EtieCloud.fetchProfile)return;
    window.EtieCloud.fetchProfile(userId,function(row){
      try{
        var spots=row&&Array.isArray(row.recommended_spots)?row.recommended_spots.slice(0,3):[];
        if(!spots.length)return;
        spots.forEach(function(s){
          if(!s||!s.name)return;
          var c=document.createElement('div');c.className='spot-chip';c.title='Host here';
          c.innerHTML='<div></div><div class="muted small"></div>';
          c.querySelector('div').textContent=(s.emoji||'📍')+' '+s.name;
          c.querySelector('div.muted').textContent=s.hood||'';
          c.onclick=(function(n){return function(){hostHereSpot(n);};})(s.name);
          box.appendChild(c);
        });
        if(box.children.length)box.style.display='';
      }catch(e){}
    });
  }catch(e){}
}
function fillMemoryStrip(boxId,userId){
  try{
    var box=document.getElementById(boxId);if(!box)return;
    box.innerHTML='';box.style.display='none';
    if(!userId||!window.EtieCloud||!window.EtieCloud.fetchProfile)return;
    window.EtieCloud.fetchProfile(userId,function(row){
      try{
        var mems=row&&Array.isArray(row.memories)?row.memories.slice(0,3):[];
        if(!mems.length)return;
        mems.forEach(function(m){
          if(!m||!m.image_url)return;
          var im=document.createElement('img');im.src=m.image_url;im.title=m.caption||'Memory';im.alt='Memory';
          box.appendChild(im);
        });
        if(box.children.length)box.style.display='';
      }catch(e){}
    });
  }catch(e){}
}
function googleAvatar(){
  try{
    var c=window.EtieCloud&&window.EtieCloud.getClient?window.EtieCloud.getClient():null;
    var s=window.EtieCloud&&window.EtieCloud.getSession?window.EtieCloud.getSession():null;
    var m=s&&s.user&&s.user.user_metadata;
    return (m&&(m.avatar_url||m.picture))||null;
  }catch(e){return null;}
}
function saveLiteProfile(){
  try{
    var ni=document.getElementById('liteNick'), bi=document.getElementById('liteBio'), ci=document.getElementById('liteCity');
    var nick=ni?ni.value.trim().slice(0,24):'';
    ETIE.traveller.nickname=nick; ETIE.local.displayName=nick;
    if(bi)ETIE.traveller.bio=bi.value.slice(0,140);
    if(ci)ETIE.local.city=(ci.value.trim()||'Hong Kong').slice(0,60);
    if(ETIE.profileComplete&&!isProfileComplete())ETIE.profileComplete=false;
    saveState();
    try{renderHeaderProfile();}catch(e){}
    try{refreshGate();}catch(e){}
  }catch(e){}
}
function toggleLiteVerify(el){
  try{
    el.classList.toggle('selected');
    var c=document.getElementById('liteVerify');if(!c)return;
    var methods=Array.prototype.map.call(c.querySelectorAll('.list-item.selected'),function(row){return row.getAttribute('data-method');});
    ETIE.traveller.verificationMethods=methods.slice();
    ETIE.local.verificationMethods=methods.slice();
    saveState();renderLiteProfile();
  }catch(e){}
}
function handleLitePhoto(input){
  try{
    var file=input.files&&input.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        ETIE.traveller.photo=e.target.result; ETIE.local.photo=e.target.result;
        saveState();renderLiteProfile();
      }catch(err){}
    };
    reader.readAsDataURL(file);
  }catch(e){}
}

var ETIE_MATCH_INDEX=0;
function getRanked(){
  try{
    var live=liveLocals();
    var src=(live||[]);
    return window.EtieMatch.rank(ETIE.traveller, ETIE.trip, src, ETIE.local.availability, ETIE.reviews);
  } catch(e){return [];}
}
function currentMatch(){var r=getRanked();if(!r.length)return null;return r[Math.min(ETIE_MATCH_INDEX,r.length-1)];}
function cycleMatch(){var r=getRanked();if(!r.length)return;ETIE_MATCH_INDEX=(ETIE_MATCH_INDEX+1)%r.length;renderMatches();}
function hasRealMatch(){ var r=getRanked(); return r && r.length>0; }
function renderMatches(){
  var r=getRanked();
  if(!r.length){
    try{
      var t7t=document.getElementById('trav7Title'); if(t7t) t7t.textContent='Your next friend is waiting for you!';
      var t7s=document.getElementById('trav7Sub'); if(t7s) t7s.textContent='No local guides found matching your current filters. Check back after guides complete onboarding.';
      var mc=document.getElementById('matchAvatar'); if(mc) mc.textContent='—';
      var mn=document.getElementById('matchName'); if(mn) mn.textContent='No local guides found';
      var mm=document.getElementById('matchMeta'); if(mm) mm.textContent='Matching your current filters — check back soon.';
      var ms=document.getElementById('matchScore'); if(ms) ms.textContent='No match yet';
      var rn=document.getElementById('matchRankNote'); if(rn) rn.textContent='';
      // hide Steps 8-16 when no real match (they only live after a match)
      ['trav8','trav9','trav10','trav11','trav12','trav13','trav14','trav15','trav16'].forEach(function(id){var el=document.getElementById(id); if(el) el.classList.add('hidden');});

    }catch(e){}
    return;
  }
  // when we have a real match, ensure trav7 says "We found someone." and Steps 8+ are reachable
  try{ var t7t2=document.getElementById('trav7Title'); if(t7t2) t7t2.textContent='We found someone.'; var t7s2=document.getElementById('trav7Sub'); if(t7s2) t7s2.textContent='The product recommends people rather than making you browse a directory.'; }catch(e){}
  var m=currentMatch();var L=m.local;
  try{
    var lflag=flagForCountry(L.nationality||ETIE.trip.country);
    document.getElementById('matchAvatar').textContent=(L.name||'?').charAt(0);
    document.getElementById('matchName').textContent=lflag+' '+L.name;
    document.getElementById('matchMeta').textContent=flagForCountry(L.nationality||ETIE.trip.country)+' '+(L.city||ETIE.trip.destination)+' · Local guide · '+(L.age||'');
    document.getElementById('matchScore').textContent=m.label+' · '+m.score+'/100 (internal)';
    document.getElementById('matchRankNote').textContent='Top '+(ETIE_MATCH_INDEX+1)+' of '+r.length+' · '+r.map(function(x){return x.local.name+':'+x.score;}).join(' ');
    var mc=document.getElementById('matchChips');mc.innerHTML='';
    (L.interests||[]).forEach(function(x){var s=document.createElement('span');s.className='chip'+(m.shared.indexOf(x)!==-1?' active':'');s.textContent=x;mc.appendChild(s);});
    // Match avatar photo
    var ma=document.getElementById('matchAvatar');
    if(ma && m.local.photo){
      ma.innerHTML='<img src="'+m.local.photo+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
    }else if(ma){
      ma.textContent=(L.name||'?').charAt(0);
    }
    var mt=document.getElementById('matchTrust');
    mt.innerHTML='';
    var trustItems=[];
    if(m.repCount)trustItems.push(['★ '+m.rep+' ('+m.repCount+') live'+(m.myRating?(' · you: '+m.myRating+'★'):'')]);
    trustItems.push(['✓ Identity checked'],['✓ Local guide'],[(L.stats&&L.stats.rating?L.stats.rating:'—')+' ★'],[(L.stats&&L.stats.travellersMet?L.stats.travellersMet:'—')+' met']);
    trustItems.forEach(function(a){var s=document.createElement('span');s.textContent=a[0];mt.appendChild(s);});
    document.getElementById('matchWhy').textContent='You share '+(m.shared.join(' + ')||'no direct interests yet')+', personality fit '+m.pers+'/100, local value '+((L.offer||'').slice(0,80)||'—')+'…, available '+(availText(L)||'ask me')+'.';
    document.getElementById('whyInterestsTitle').textContent=m.shared.length+' shared interest'+(m.shared.length===1?'':'s');
    document.getElementById('whyInterests').textContent=(m.shared.join(' · ')||'None yet — try adding Salsa/Cooking/Football/Photography')+' ('+m.interestScore+'/100)';
    document.getElementById('whyInterestsBadge').textContent=m.interestScore>=70?'Strong':(m.interestScore>=40?'Okay':'Low');
    document.getElementById('whyPersonality').textContent='You '+ETIE.traveller.personality.social+'/'+ETIE.traveller.personality.spontaneous+'/'+ETIE.traveller.personality.curious+' vs '+L.name+' '+L.personality.social+'/'+L.personality.spontaneous+'/'+L.personality.curious+' ('+m.pers+'/100)';
    document.getElementById('whyPersonalityBadge').textContent=m.pers>=75?'Strong':(m.pers>=55?'Good':'Low');
    document.getElementById('whyValue').textContent=(L.offer||'—')+' ('+m.value+'/100)';
    document.getElementById('whyValueBadge').textContent=m.value>=70?'High':(m.value>=50?'Okay':'Low');
    document.getElementById('whyAvail').textContent=(availText(L)||'Ask the guide')+' during '+(ETIE.trip.dates||ETIE.trip.destination||'your trip');
    document.getElementById('whyAvailBadge').textContent=m.avail>=80?'Available':'Check';
    try{
      var wr=document.getElementById('whyReputation'),wb=document.getElementById('whyReputationBadge');
      if(window.ETIE_REVIEWS_V2===false){if(wr)wr.textContent='Reviews v2 off (original ranking).';if(wb)wb.textContent='Off';}
      else if(m.repCount){var adj=[];if(m.repBonus)adj.push((m.repBonus>0?'+':'')+m.repBonus);if(m.tagBonus)adj.push('+'+m.tagBonus+' taste');if(wr)wr.textContent=m.rep+'★ across '+m.repCount+' reviews'+(adj.length?(' ('+adj.join(', ')+')'):'');if(wb)wb.textContent=m.rep>=4.7?'Proven':(m.rep>=4?'Good':'Mixed');}
      else{if(wr)wr.textContent='No reviews yet — be the first to review after you meet.';if(wb)wb.textContent='New';}
    }catch(e){}
    document.getElementById('prof8Name').textContent=L.name+"'s profile";
    var p8a=document.getElementById('prof8Avatar');
    if(p8a && L.photo){
      p8a.innerHTML='<img src="'+L.photo+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
    }else if(p8a){
      p8a.textContent=(L.name||'?').charAt(0);
    }
    document.getElementById('prof8Title').textContent=L.name+', '+(L.age||'');
    document.getElementById('prof8Meta').textContent=flagForCountry(L.nationality||ETIE.trip.country)+' '+(L.city||'')+' · Local guide';
    var p8t=document.getElementById('prof8Trust');p8t.innerHTML='';
    var p8items=[];
    if(m.repCount)p8items.push('★ '+m.rep+' ('+m.repCount+') live'+(m.myRating?(' · you: '+m.myRating+'★'):''));
    p8items.push('✓ Identity checked','✓ Local guide',(L.stats.rating+' ★'));
    p8items.forEach(function(t){var s=document.createElement('span');s.textContent=t;p8t.appendChild(s);});
    var p8i=document.getElementById('prof8Interests');p8i.innerHTML='';
    (L.interests||[]).forEach(function(x){var s=document.createElement('span');s.className='chip'+(m.shared.indexOf(x)!==-1?' active':'');s.textContent=x;p8i.appendChild(s);});
    document.getElementById('prof8Offer').textContent='“'+(L.offer||'—')+'”';
    document.getElementById('prof8Stats').textContent=(L.stats.travellersMet||'—')+' travellers met · '+(L.stats.reviews||'—')+' reviews · '+(L.stats.references||'—')+' references (demo)'+(m.repCount?(' · live: '+m.rep+'★ ('+m.repCount+')'):'');

  }catch(e){}
}

function reqKey(){var m=currentMatch();return m?m.local.id:'local-marta';}
function reqStatus(k){k=k||reqKey();return (ETIE.requests[k]&&ETIE.requests[k].status)||'none';}
function availText(L){
  try{
    if(!L) return '';
    if(L.availDates && L.availDates.length) return L.availDates.slice().sort().join(', ');
    var av=L.availability||[];
    if(!av.length) return '';
    return av.map(function(a){ return (typeof a==='string')?a:(a.label+((a.status&&a.status!=='Available')?(' ('+a.status+')'):'')); }).join(', ');
  }catch(e){ return ''; }
}
function myUid(){ try{ var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession(); return (s&&s.user&&s.user.id)||null; }catch(e){ return null; } }
// Incoming request addressed to me (live local): requests are keyed by local id, so my own id as key = inbox
function inboxKey(){ try{ var uid=myUid(); if(!uid) return null; if(ETIE.requests && ETIE.requests[uid]) return uid; return null; }catch(e){ return null; } }
// Chat/request key honouring side: locals read their inbox, travellers read the match
function chatKey(){ try{ return (chatRole()==='local') ? (inboxKey()||reqKey()) : reqKey(); }catch(e){ return reqKey(); } }
function ensureChat(k){
  if(!ETIE.messages[k])ETIE.messages[k]=[];
  if(!ETIE.messages[k].length){
    var m=currentMatch();
    var lname=m?m.local.name:'Local guide';
    ETIE.messages[k].push({from:'local',text:'Hey! Excited to meet you. What are you most looking forward to in '+(ETIE.trip.destination||'the city')+' ('+lname+' here)?',ts:Date.now()-7200000});
  }
}
function sendRequest(){
  toast('sendRequest called');
  var m=currentMatch();if(!m){toast('Find a match first.');return;}
  var k=m.local.id;var msg=document.getElementById('reqMessage').value.trim();
  if(ETIE.requests[k]&&ETIE.requests[k].status==='pending'){toast('Request already pending');travNext(11);return;}
  ETIE.requests[k]={status:'pending',message:msg,updatedAt:Date.now(),localName:m.local.name,travellerName:(ETIE.traveller.nickname||'Traveller')};
  ensureChat(k);
  ETIE.messages[k].push({from:'traveller',text:'Request: '+(msg||'(no message)'),ts:Date.now()});
  saveState();renderRequests();renderChat();renderMessagesList();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, 'Request: '+(msg||'(no message)'), 'traveller'); }catch(e){}
  toast('Request sent!');
  travNext(11);
}
function acceptCurrent(){var k=inboxKey()||reqKey();if(reqStatus(k)==='none'){toast('No pending request — send one as Traveller first.');return;}ETIE.requests[k].status='approved';ETIE.requests[k].updatedAt=Date.now();ensureChat(k);ETIE.messages[k].push({from:'local',text:'Accepted! Looking forward to meeting. When suits you?',ts:Date.now()});saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, 'Accepted! Looking forward to meeting. When suits you?', 'local'); }catch(e){}
  toast('Approved — chat unlocked. Vibe Check: 3 messages to introduce yourself.');try{openChatPopup();}catch(e){}localNext(10);}
function declineCurrent(){var k=inboxKey()||reqKey();if(reqStatus(k)==='none'){toast('No pending request.');return;}ETIE.requests[k].status='declined';ETIE.requests[k].updatedAt=Date.now();saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  toast('Declined — chat stays locked.');}
function openSafetyReport(role){
  var k=meetKey();var m=currentMatch();var other=role==='traveller'?m.local.name:'Etie';
  var html='<div style="padding:16px;max-width:400px;"><h3 style="margin:0 0 12px;color:#b00020;">Report / Safety concern</h3><p class="muted small" style="margin-bottom:12px;">This goes to Etie safety team only. '+other+' will not see this.</p><div class="field"><label>Category</label><select id="reportCategory" style="width:100%;padding:12px;border:1px solid #d9d3ca;border-radius:10px;"><option value="harassment">Harassment / inappropriate behavior</option><option value="unsafe">I felt unsafe / threatened</option><option value="no-show">No-show / ghosted after accept</option><option value="fake">Fake profile / misrepresentation</option><option value="other">Other</option></select></div><div class="field"><label>Details (required)</label><textarea id="reportDetails" placeholder="What happened? Be specific — helps us act fast." style="min-height:100px;padding:12px;border:1px solid #d9d3ca;border-radius:10px;"></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button class="secondary" onclick="closeSafetyReport()">Cancel</button><button class="primary" style="background:#b00020;border-color:#b00020;" onclick="submitSafetyReport(\''+role+'\')">Send report</button></div></div>';
  var ov=document.createElement('div');ov.className='chat-overlay';ov.onclick=function(e){if(e.target===this)closeSafetyReport();};ov.innerHTML='<div class="chat-popup" role="dialog" aria-modal="true" style="width:100%;max-width:440px;">'+html+'</div>';ov.id='safetyReportOverlay';document.body.appendChild(ov);
  try{document.getElementById('reportDetails').focus();}catch(e){}
}
function closeSafetyReport(){try{var ov=document.getElementById('safetyReportOverlay');if(ov)ov.remove();}catch(e){}}
function submitSafetyReport(role){
  var cat=document.getElementById('reportCategory').value;
  var details=document.getElementById('reportDetails').value.trim();
  if(!details){toast('Add details before sending.');return;}
  var k=meetKey();var m=currentMatch();
  var reportedId=null; // would need to map mock local ID to real user ID
  var reportData={category:cat,details:details,reportedId:reportedId,requestId:k};
  try{ETIE.reports=ETIE.reports||[];ETIE.reports.push({role:role,category:cat,details:details,at:Date.now(),requestId:k,otherName:role==='traveller'?m.local.name:'Etie'});saveState();}catch(e){}
  try{ if(window.EtieCloud && window.EtieCloud.pushSharedReport) window.EtieCloud.pushSharedReport(reportData); }catch(e){}
  closeSafetyReport();toast('Report sent — safety team will review.');
}
function sendChat(who,inputId){
  var k=(who==='local')?(inboxKey()||reqKey()):reqKey();
  var r=ETIE.requests[k];
  var st=r?r.status:'none';
  if(!r){toast('No active request.');return;}
  if(st!=='approved'){
    var input=document.getElementById(inputId);
    if(input){
      var count=r.messageCount||0;
      if(count>=3){
        toast('Vibe Check limit reached (3 messages). Wait for host approval.');
        return;
      }
      if(count===0) input.placeholder='Introduce yourself & share your ETA...';
    }
  }
  var input=null;
  if(inputId)input=document.getElementById(inputId);
  if(!input){
    if(who==='local'){
      input=document.getElementById('localChatInput9')&&document.getElementById('localChatInput9').value?document.getElementById('localChatInput9'):document.getElementById('localChatInput');
      var l9=document.getElementById('localChatInput9');
      var l8=document.getElementById('localChatInput');
      if(l9&&l8){
        var p9=document.getElementById('local9');
        var use9=p9&&!p9.classList.contains('hidden');
        input=use9?l9:(l9.value?l9:l8);
      } else input=l9||l8;
    } else input=document.getElementById('chatInput');
  }
  if(!input){toast('Chat unavailable.');return;}
  var text=(input.value||'').trim();if(!text){toast('Type a message first.');return;}
  if(st!=='approved' && st!=='pending'){toast('Chat unlocks after host approval.');return;}
  ensureChat(k);
  ETIE.messages[k].push({from:who,text:text,ts:Date.now()});
  r.messageCount=(r.messageCount||0)+1;
  r.updatedAt=Date.now();
  input.value='';saveState();renderChat();renderMessagesList();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, text, who); }catch(e){}
}
// Chat popup (mini overlay) — was called from HTML but never defined, so traveller chat never opened
function chatRole(){try{var lf=document.getElementById('localFlow');if(lf&&!lf.classList.contains('hidden'))return 'local';}catch(e){}return 'traveller';}
function openChatPopup(){
  try{
    renderChat();renderMessagesList();
    var o=document.getElementById('chatPopupOverlay');if(o)o.classList.remove('hidden');
    var pi=document.getElementById('chatPopupInput');if(pi)pi.disabled=(reqStatus(chatKey())!=='accepted');
    setTimeout(function(){try{var p=document.getElementById('chatPopupInput');if(p&&!p.disabled)p.focus();}catch(e){}},80);
  }catch(e){toast('Chat unavailable.');}
}
function closeChatPopup(){try{var o=document.getElementById('chatPopupOverlay');if(o)o.classList.add('hidden');}catch(e){}}
function sendChatPopup(){
  var who=chatRole();var k=chatKey();
  var pi=document.getElementById('chatPopupInput');if(!pi){toast('Chat unavailable.');return;}
  var text=(pi.value||'').trim();if(!text){toast('Type a message first.');return;}
  if(reqStatus(k)!=='accepted'){toast('Chat unlocks only after Accept.');return;}
  ensureChat(k);ETIE.messages[k].push({from:who,text:text,ts:Date.now()});
  pi.value='';saveState();renderChat();renderMessagesList();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, text, who); }catch(e){}
}
function tryPlanMeetup(){var k=reqKey();if(reqStatus(k)!=='accepted'){toast('Plan unlocks after Accept.');return;}travNext(12);}
function resetDemo(){ETIE.requests={};ETIE.messages={};ETIE.meetups={};ETIE.reviews={};ETIE._travStars=0;ETIE._localStars=0;ETIE_MATCH_INDEX=0;saveState();renderRequests();renderChat();renderMessagesList();renderMeetup();renderThanks();renderTrips();renderLocalDashboard();paintStars('travStars',0);paintStars('localStars',0);toast('Demo reset.');}
function renderRequests(){
  var m=currentMatch();if(!m)return;var k=m.local.id;var st=reqStatus(k);
  try{
    document.getElementById('reqTitle').textContent='Ask '+m.local.name+' to meet';
    var rt=document.getElementById('reqStatusTitle'),rs=document.getElementById('reqStatusSub'),oc=document.getElementById('openChatBtn');
    if(st==='pending'){rt.textContent='Request pending to '+m.local.name+'.';rs.textContent='Messaging: Vibe Check active (3 messages max).';oc.textContent='Open Vibe Check';}
    else if(st==='approved'){rt.textContent=m.local.name+' approved your request.';rs.textContent='Messaging unlocked. Coordinate your meetup.';oc.textContent='Open chat';}
    else if(st==='declined'){rt.textContent=m.local.name+' declined.';rs.textContent='Chat stays locked. Try Next suggestion.';oc.textContent='Back to matches';oc.onclick=function(){travNext(6);};return;}
    else if(st==='expired'){rt.textContent='Request expired.';rs.textContent='The host did not respond in time. Send a new request.';oc.textContent='Back to matches';oc.onclick=function(){travNext(6);};return;}
    else{rt.textContent='No request yet to '+m.local.name+'.';rs.textContent='Send one from Step 9 to unlock messaging after approval.';oc.textContent='Open chat (locked)';}
     oc.onclick=function(){openChatPopup();};
    var lr=document.getElementById('localReqTitle');if(lr){var _ik=inboxKey();var _tn=_ik&&ETIE.requests[_ik]&&ETIE.requests[_ik].travellerName;lr.textContent=(_tn||'Traveller')+' · for '+(m?m.local.name:'—');}
    var lw=document.getElementById('localReqWhy');    if(lw)lw.textContent=(m.shared.join(' · ')||'New traveller')+' · '+flagForCountry(ETIE.trip.country)+' '+ETIE.trip.destination+' '+ETIE.trip.dates;
    var ik=inboxKey();var ir=ik?ETIE.requests[ik]:null;
    var lm=document.getElementById('localReqMsg');if(lm)lm.textContent=(ir||ETIE.requests[k])?('“'+(((ir||ETIE.requests[k]).message)||'')+'”'):'No message yet.';
    var ls=document.getElementById('localReqStatus');if(ls){var ist=ir?ir.status:st;ls.textContent=ist==='none'?'No request yet — send one as Traveller first':ist;}
  }catch(e){}
}
function renderChat(){
  var m=currentMatch();if(!m)return;var k=m.local.id;var st=reqStatus(k);
  try{
    // Traveller view: my messages on right (black), local on left (grey)
    var ct=document.getElementById('chatTitle');
    var r=ETIE.requests[k];
    var mc=r?r.messageCount:0;
    if(ct){
      if(st==='pending') ct.textContent='Chat with '+m.local.name+' — Vibe Check: '+(3-mc)+'/3 left';
      else ct.textContent='Chat with '+m.local.name;
    }
    var lock=document.getElementById('chatLock');
    if(lock){
      if(st==='approved')lock.textContent='Unlocked. Keep it simple — aim for a real-world meetup.';
      else if(st==='pending')lock.textContent='Vibe Check: '+mc+'/3 messages sent. Introduce yourself & share your ETA.';
      else if(st==='declined')lock.textContent='Locked — declined.';
      else if(st==='expired')lock.textContent='Request expired — send a new one.';
      else lock.textContent='Locked — send a request in Step 9 first.';
    }
    var list=document.getElementById('chatList');if(list){list.innerHTML='';
    (ETIE.messages[k]||[]).forEach(function(msg){
      var b=document.createElement('div');b.className='bubble'+(msg.from==='traveller'?' me':'');b.textContent=msg.text;list.appendChild(b);
    });
    if(!(ETIE.messages[k]||[]).length){var d=document.createElement('div');d.className='muted small';d.textContent='No messages yet.';list.appendChild(d);}
    }
    var ci=document.getElementById('chatInput');
    if(ci){
      ci.disabled=(st!=='approved' && st!=='pending');
      if(st==='pending'){
        var left=3-(r?r.messageCount:0);
        ci.placeholder=left>0?('Vibe Check: '+left+'/3 left — introduce yourself'):'Vibe Check complete — wait for approval';
        if(left<=0) ci.disabled=true;
      } else if(st==='approved'){
        ci.placeholder='Message...';
        ci.disabled=false;
      }
    }
    // Local view (mirrored): reads the inbox request addressed to me, not the match
    var lk=inboxKey()||k; var lst=reqStatus(lk);
    var lr=ETIE.requests[lk];
    var lmc=lr?lr.messageCount:0;
    var lt=document.getElementById('localChatTitle');
    if(lt){
      if(lst==='pending') lt.textContent='Chat with Etie (traveller) — Vibe Check: '+(3-lmc)+'/3 left';
      else lt.textContent='Chat with Etie (traveller)';
    }
    var ll=document.getElementById('localChatLock');
    if(ll){
      if(lst==='approved')ll.textContent='Unlocked. Coordinate with your traveller, then meet.';
      else if(lst==='pending')ll.textContent='Vibe Check: '+lmc+'/3 messages received. Press Approve to unlock.';
      else if(lst==='declined')ll.textContent='Declined — chat stays locked.';
      else if(lst==='expired')ll.textContent='Request expired.';
      else ll.textContent='No request yet — waiting for a traveller request.';
    }
    var llist=document.getElementById('localChatList');
    if(llist){llist.innerHTML='';
      (ETIE.messages[lk]||[]).forEach(function(msg){
        var b=document.createElement('div');b.className='bubble'+(msg.from==='local'?' me':'');b.textContent=msg.text;llist.appendChild(b);
      });
      if(!(ETIE.messages[lk]||[]).length){var dd=document.createElement('div');dd.className='muted small';dd.textContent='No messages yet.';llist.appendChild(dd);}
    }
    var li1=document.getElementById('localChatInput');
    var li9=document.getElementById('localChatInput9');
    if(li1){
      li1.disabled=(lst!=='approved' && lst!=='pending');
      if(lst==='pending'){
        var lleft=3-(lr?lr.messageCount:0);
        li1.placeholder=lleft>0?('Vibe Check: '+lleft+'/3 left'):'Vibe Check complete — approve to unlock';
        if(lleft<=0) li1.disabled=true;
      } else { li1.placeholder='Message...'; }
    }
    if(li9){
      li9.disabled=(lst!=='approved' && lst!=='pending');
      if(lst==='pending'){
        var lleft=3-(lr?lr.messageCount:0);
        li9.placeholder=lleft>0?('Vibe Check: '+lleft+'/3 left'):'Vibe Check complete — approve to unlock';
        if(lleft<=0) li9.disabled=true;
      } else { li9.placeholder='Message...'; }
    }
    // Popup (mini, dismissable — doesn't hijack the flow)
    var whoPopup='traveller';try{var lf=document.getElementById('localFlow'); if(lf&&!lf.classList.contains('hidden')) whoPopup='local';}catch(e){}
    var pk=(whoPopup==='local')?lk:k; var pst=(whoPopup==='local')?lst:st;
    var pr=ETIE.requests[pk];
    var pmc=pr?pr.messageCount:0;
    var pT=document.getElementById('chatPopupTitle');if(pT)pT.textContent='Chat with '+((whoPopup==='local'&&inboxKey())?'Etie (traveller)':(m.local.name||'—'));
    if(pT && pst==='pending') pT.textContent+=' — Vibe Check: '+(3-pmc)+'/3 left';
    var pS=document.getElementById('chatPopupSub');if(pS)pS.textContent=pst==='approved'?'Unlocked — aim for a meetup':(pst==='pending'?'Vibe Check: '+pmc+'/3 messages':(pst==='declined'?'Locked — declined':(pst==='expired'?'Request expired':'Locked — send a request first')));
    var pL=document.getElementById('chatPopupList');if(pL){pL.innerHTML='';
      (ETIE.messages[pk]||[]).forEach(function(msg){
        var b=document.createElement('div');b.className='bubble'+(msg.from===whoPopup?' me':'');b.textContent=msg.text;pL.appendChild(b);
      });
      if(!(ETIE.messages[pk]||[]).length){var pd=document.createElement('div');pd.className='muted small';pd.textContent='No messages yet.';pL.appendChild(pd);}
    }
    var pI=document.getElementById('chatPopupInput');
    if(pI){
      pI.disabled=(pst!=='approved' && pst!=='pending');
      if(pst==='pending'){
        var pleft=3-pmc;
        pI.placeholder=pleft>0?('Vibe Check: '+pleft+'/3 left'):'Vibe Check complete — wait for approval';
        if(pleft<=0) pI.disabled=true;
      } else if(pst==='approved'){
        pI.placeholder='Message...';
        pI.disabled=false;
      }
    }
  }catch(e){}
}
function deleteChat(k){ if(!confirm('Delete this chat?')) return; try{ delete ETIE.requests[k]; delete ETIE.messages[k]; delete ETIE.meetups[k]; delete ETIE.reviews[k]; saveState(); renderMessagesList(); renderRequests(); renderChat(); renderTrips(); }catch(e){} try{ var c=window.EtieCloud&&window.EtieCloud.getClient&&window.EtieCloud.getClient(); if(c) c.from('etie_requests').delete().eq('local_mock_id',k).then(function(){}); }catch(e){} toast('Chat deleted.'); }
function renderMessagesList(){
  try{
    var box=document.getElementById('messagesList');if(!box)return;box.innerHTML='';
    var ids=Object.keys(ETIE.requests||{});
    if(!ids.length){box.innerHTML='<div class="list-item"><div><strong>No messages yet</strong><br><span class="muted">Your conversations will appear here after you connect.</span></div><span class="status">Empty</span></div>';return;}
    ids.forEach(function(k){
      var r=ETIE.requests[k];var msgs=ETIE.messages[k]||[];var last=msgs.length?msgs[msgs.length-1].text:'—';
      var row=document.createElement('div');row.className='list-item';row.style.cursor='pointer';row.title='Tap to open chat — swipe right or press ✕ to delete';
      row.innerHTML='<div><strong></strong><br><span class="muted"></span></div>';
      var flagPref = '';
      try{ if(ETIE.traveller.nationality) flagPref = flagForCountry(ETIE.traveller.nationality)+' '; }catch(e){}
      row.querySelector('strong').textContent=flagPref+(r.localName||k)+' · '+r.status;
      row.querySelector('.muted').textContent=last.slice(0,80);
      var st=document.createElement('span');st.className='status';st.textContent=r.status;row.appendChild(st);
      var del=document.createElement('button'); del.className='secondary'; del.textContent='✕'; del.title='Delete chat'; del.style.padding='6px 10px'; del.onclick=function(e){ e.stopPropagation(); deleteChat(k); };
      row.appendChild(del);
      row.onclick=(function(kk){return function(){
        focusMatch(kk);
        openChatPopup();
      };})(k);
      // swipe to delete (touch)
      (function(rowEl, key){ var sx=0; rowEl.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; }, {passive:true}); rowEl.addEventListener('touchend',function(e){ var dx=e.changedTouches[0].clientX - sx; if(dx>80) deleteChat(key); }); })(row,k);
      box.appendChild(row);
    });
  }catch(e){}
}

function meetKey(){try{return (chatRole()==='local')?(inboxKey()||reqKey()):reqKey();}catch(e){return reqKey();}}
function meetup(){return ETIE.meetups[meetKey()]||{status:'none'};}
function paintStars(id,n){var c=document.getElementById(id);if(!c)return;Array.prototype.forEach.call(c.querySelectorAll('.star'),function(s,i){s.textContent=(i<n?'★':'☆');s.classList.toggle('active',i<n);});}
function setTravStars(n){ETIE._travStars=n;saveState();paintStars('travStars',n);}
function setLocalStars(n){ETIE._localStars=n;saveState();paintStars('localStars',n);}
function selectSingle(el,containerId){var c=document.getElementById(containerId);if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');});el.classList.add('active');}
function formatMeetWhen(d,t){
  try{
    var dt=new Date(d+'T'+(t||'12:00'));
    if(isNaN(dt.getTime()))return d+' '+(t||'');
    var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var s=days[dt.getDay()]+' '+dt.getDate()+' '+months[dt.getMonth()];
    if(t){var hh=+t.slice(0,2),mm=t.slice(3,5);var ap=hh>=12?'PM':'AM';var h12=hh%12||12;s+=' · '+h12+':'+mm+' '+ap;}
    return s;
  }catch(e){return d+' '+(t||'');}
}
function saveMeetup(){
  if(reqStatus()!=='accepted'){toast('Accept the request first.');return;}
  var a=document.getElementById('meetActivity').value.trim(),wh=document.getElementById('meetWhere').value.trim();
  var d=(document.getElementById('meetDate')||{}).value||'';
  var t=(document.getElementById('meetTime')||{}).value||'';
  if(!a||!d||!wh){toast('Fill activity, date and where.');return;}
  var w=formatMeetWhen(d,t);
  ETIE.meetups[meetKey()]={activity:a,when:w,meetDate:d,meetTime:t,where:wh,status:'planned',with:currentMatch().local.name};
  saveState();renderMeetup();renderTrips();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMeetup) window.EtieCloud.pushSharedMeetup(meetKey()); }catch(e){}
  travNext(13);
}
function completeMeetup(){
  var m=meetup();if(m.status!=='planned'){toast('Confirm the meetup in Step 12 first.');return;}
  ETIE.meetups[meetKey()].status='completed';saveState();renderMeetup();renderTrips();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMeetup) window.EtieCloud.pushSharedMeetup(meetKey()); }catch(e){}
  toast('Marked completed — now review.');
}
function completeMeetupAsLocal(){
  if(reqStatus()!=='accepted'){toast('Accept first.');return;}
  var m=meetup();if(m.status==='none'){toast('Traveller plans it in Step 13 first.');return;}
  if(m.status!=='completed'){ETIE.meetups[meetKey()].status='completed';saveState();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMeetup) window.EtieCloud.pushSharedMeetup(meetKey()); }catch(e){}
  }
  renderMeetup();renderTrips();localNext(11);
}
function submitTravReview(){
  if(meetup().status!=='completed'){toast('Mark meetup completed first.');return;}
  if(!(ETIE._travStars>=1)){toast('Tap 1-5 stars.');return;}
  var again=getChips('travAgain')[0]||'Definitely';
  var highlights=[document.getElementById('travHighlight1').value.trim(),document.getElementById('travHighlight2').value.trim(),document.getElementById('travHighlight3').value.trim()].filter(Boolean);
  var privateText=document.getElementById('travReviewText').value.trim();
  var reviewData={rating:ETIE._travStars,meetAgain:again,highlights:highlights,privateText:privateText};
  var k=meetKey();ETIE.reviews[k]=ETIE.reviews[k]||{};
  ETIE.reviews[k].trav={rating:ETIE._travStars,meetAgain:again,highlights:highlights,privateText:privateText,at:Date.now()};
  saveState();renderMeetup();renderTrips();renderThanks();travNext(15);
  try{ if(window.EtieCloud && window.EtieCloud.pushSharedReview) window.EtieCloud.pushSharedReview(k, 'trav', reviewData); }catch(e){}
}
function submitLocalReview(){
  if(meetup().status!=='completed'){toast('Mark meetup completed first.');return;}
  if(!(ETIE._localStars>=1)){toast('Tap 1-5 stars.');return;}
  var again=getChips('localAgain')[0]||'Definitely';
  var highlights=[document.getElementById('localHighlight1').value.trim(),document.getElementById('localHighlight2').value.trim(),document.getElementById('localHighlight3').value.trim()].filter(Boolean);
  var privateText=document.getElementById('localReviewText').value.trim();
  var reviewData={rating:ETIE._localStars,meetAgain:again,highlights:highlights,privateText:privateText};
  var k=meetKey();ETIE.reviews[k]=ETIE.reviews[k]||{};
  ETIE.reviews[k].local={rating:ETIE._localStars,meetAgain:again,highlights:highlights,privateText:privateText,at:Date.now()};
  saveState();renderTrips();toast('Review submitted — loop complete.');
  try{ if(window.EtieCloud && window.EtieCloud.pushSharedReview) window.EtieCloud.pushSharedReview(k, 'local', reviewData); }catch(e){}
}
function renderMeetup(){
  var m=currentMatch();if(!m)return;var mu=meetup();
  try{
    document.getElementById('meetWith').textContent='With '+m.local.name+' · '+flagForCountry(ETIE.trip.country)+' '+ETIE.trip.destination;
    if(mu.status!=='none'){
      var ma=document.getElementById('meetActivity');if(ma)ma.value=mu.activity||'';
      var mdt=document.getElementById('meetDate');if(mdt)mdt.value=mu.meetDate||'';
      var mtt=document.getElementById('meetTime');if(mtt)mtt.value=mu.meetTime||'';
      var mw=document.getElementById('meetWhere');if(mw)mw.value=mu.where||'';
    }
    document.getElementById('meetStatusTitle').textContent=mu.status==='completed'?'Meetup completed':(mu.status==='planned'?'Meetup planned':'No meetup yet');
    document.getElementById('meetSummaryTitle').textContent=(mu.activity||'—')+' · '+m.local.name+' + Etie';
    document.getElementById('meetSummarySub').textContent=(mu.when||'—')+' · '+(mu.where||'—');
    var rv=(ETIE.reviews[meetKey()]||{}).trav;
    document.getElementById('meetStatusLine').textContent='Status: '+mu.status+' · Request: '+reqStatus()+(rv?' · Your review: '+rv.rating+'★ '+rv.meetAgain:' · No review yet');
    document.getElementById('reviewTitle').textContent='Review '+m.local.name;
    var li=document.getElementById('localMeetInfo');
    if(li)li.textContent='Meetup: '+(mu.activity||'—')+' · '+(mu.when||'—')+' · '+(mu.where||'—')+' · Status: '+mu.status;
  }catch(e){}
}
function renderThanks(){
  try{
    var k=meetKey();var r=ETIE.reviews[k]||{};var t=r.trav;
    if(t){
      var hs=(t.highlights||[]).length?'<div class="small muted" style="margin-top:8px;"><strong>Highlights:</strong> '+(t.highlights.join('; '))+'</div>':'';
      var pt=t.privateText?'<div class="small muted" style="margin-top:4px;color:#b00020;"><strong>Private note:</strong> '+t.privateText+'</div>':'';
      document.getElementById('thanksSummary').innerHTML='<strong>Saved:</strong> '+t.rating+'★ · '+t.meetAgain+hs+pt+'. Counts toward reputation and future matching.';
    }else{
      document.getElementById('thanksSummary').innerHTML='<strong>Next time:</strong> Etie can use your signals for better matches.';
    }
  }catch(e){}
}
function renderTrips(){
  try{
    var box=document.getElementById('tripsList');if(!box)return;box.innerHTML='';
    var hasTrip=!!(ETIE.trip&&ETIE.trip.destination);
    if(!hasTrip && !Object.keys(ETIE.requests||{}).length){
      box.innerHTML='<div class="list-item"><div><strong>No trips yet</strong><br><span class="muted">Complete Traveller Step 1 (destination + dates) to start.</span></div><span class="status">Empty</span></div>'; return;
    }
    var m=currentMatch();var k=meetKey();var mu=meetup();var r=ETIE.reviews[k]||{};
    var row=document.createElement('div');row.className='list-item';
    var conn=reqStatus(k);var meet=mu.status;
    var tr=r.trav;var lr=r.local;
    var revParts=[];if(tr)revParts.push('Trav: '+tr.rating+'★ '+tr.meetAgain);if(lr)revParts.push('Local guide: '+lr.rating+'★ '+lr.meetAgain);
    var revText=revParts.length?revParts.join(' | '):'none';
    row.innerHTML='<div><strong></strong><br><span class="muted"></span></div>';
    row.querySelector('strong').textContent=(hasTrip?flagForCountry(ETIE.trip.country)+' '+ETIE.trip.destination+' · '+ETIE.trip.dates : 'No active trip');
    row.querySelector('.muted').textContent='Match: '+(m?m.local.name+' ('+m.score+')':'—')+' · Req: '+conn+' · Meet: '+meet+' · Reviews: '+revText;
    var b=document.createElement('button');b.className='secondary';b.textContent='Open';b.onclick=function(){setRole('traveller');showScreen('home');};
    row.appendChild(b);box.appendChild(row);
  }catch(e){}
}

function localNameFor(k){var r=ETIE.requests[k];if(r&&r.localName)return r.localName;var live=liveLocals()||[];for(var i=0;i<live.length;i++)if(live[i].id===k)return live[i].name;return k;}
function focusMatch(k){var r=getRanked();for(var i=0;i<r.length;i++)if(r[i].local.id===k){ETIE_MATCH_INDEX=i;break;}renderMatches();renderRequests();renderChat();renderMeetup();}
function acceptKey(k){if(!ETIE.requests[k]){toast('No request for '+k);return;}focusMatch(k);ETIE.requests[k].status='accepted';ETIE.requests[k].updatedAt=Date.now();ensureChat(k);ETIE.messages[k].push({from:'local',text:'Accepted! Looking forward to meeting.',ts:Date.now()});saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, 'Accepted! Looking forward to meeting.', 'local'); }catch(e){}
  toast('Accepted '+localNameFor(k));}
function declineKey(k){if(!ETIE.requests[k]){toast('No request for '+k);return;}focusMatch(k);ETIE.requests[k].status='declined';ETIE.requests[k].updatedAt=Date.now();saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  toast('Declined '+localNameFor(k));}
function renderLocalDashboard(){
  try{
    var dm=document.getElementById('dashMet'); if(dm) dm.textContent=String(ETIE.local.hostedCount||0);
    var dr=document.getElementById('dashRating'); if(dr) dr.textContent=(ETIE.local.avgHostRating||0)?(ETIE.local.avgHostRating+' ★'):'—';
    var dt=document.getElementById('localDashTrust');
    if(dt){ dt.innerHTML=''; var _vm=ETIE.local.verificationMethods||[]; if(!_vm.length){var _s=document.createElement('span');_s.textContent='Unverified';dt.appendChild(_s);} else _vm.forEach(function(x){var _s=document.createElement('span');_s.textContent='✓ '+x;dt.appendChild(_s);}); }
    var q=document.getElementById('localQueue');
    if(q){q.innerHTML='';var ids=Object.keys(ETIE.requests||{});
      if(!ids.length)q.innerHTML='<div class="list-item"><div><strong>No requests yet</strong><br><span class="muted">Send one as Traveller — try different matches.</span></div><span class="status">Empty</span></div>';
      ids.forEach(function(k){
        var r=ETIE.requests[k];var row=document.createElement('div');row.className='list-item';
        row.innerHTML='<div><strong></strong><br><span class="muted"></span></div>';
        var qflag='';
        try{ var qNation = (ETIE.traveller.nationality||''); if(qNation) qflag=flagForCountry(qNation)+' '; }catch(e){}
        row.querySelector('strong').textContent=qflag+localNameFor(k)+' · '+r.status;
        row.querySelector('.muted').textContent=(r.message||'—').slice(0,90);
        var wrap=document.createElement('div');wrap.style.display='flex';wrap.style.gap='6px';
        var v=document.createElement('button');v.className='secondary';v.textContent='View';v.onclick=(function(kk){return function(){focusMatch(kk);localNext(9);};})(k);
        var a=document.createElement('button');a.className='secondary';a.textContent='Accept';a.onclick=(function(kk){return function(){acceptKey(kk);};})(k);
        var d=document.createElement('button');d.className='secondary';d.textContent='Decline';d.onclick=(function(kk){return function(){declineKey(kk);};})(k);
        wrap.appendChild(v);wrap.appendChild(a);wrap.appendChild(d);row.appendChild(wrap);q.appendChild(row);
      });
    }
    try{ renderDashCal(); }catch(e){}
    var vis=document.getElementById('localVisibility');
    if(vis){var n=(ETIE.local.availDates||[]).length;
      vis.textContent=n>0?('Visible: '+n+' date(s) selected — travellers can match you on those days.'):('Hidden: no dates selected — pick dates in Step 7 to reappear.');}
    var h=document.getElementById('localHistory');
    if(h){h.innerHTML='';var keys=Object.keys(ETIE.meetups);
      var done=keys.filter(function(k){return ETIE.meetups[k].status==='completed';});
      if(!done.length)h.innerHTML='<div class="list-item"><div><strong>No completed meetups yet</strong><br><span class="muted">Plan → Complete → Review to build history.</span></div><span class="status">Empty</span></div>';
      done.forEach(function(k){
        var mu=ETIE.meetups[k];var rv=ETIE.reviews[k]||{};
        var row=document.createElement('div');row.className='list-item';
        row.innerHTML='<div><strong></strong><br><span class="muted"></span></div>';
        row.querySelector('strong').textContent=localNameFor(k)+' · '+mu.activity;
        row.querySelector('.muted').textContent=mu.when+' · Trav review: '+(rv.trav?(rv.trav.rating+'★ '+rv.trav.meetAgain):'none')+' · Local review: '+(rv.local?(rv.local.rating+'★'):'none');
        var st=document.createElement('span');st.className='status';st.textContent='Done';row.appendChild(st);
        h.appendChild(row);
      });
    }
  }catch(e){}
}

function restoreAll(){
  try{
    var tc=document.getElementById('travCity'); if(tc) tc.value=ETIE.trip.destination;
    var tdf=document.getElementById('travDateFrom');if(tdf)tdf.value=ETIE.trip.dateFrom||'';
    var tdt=document.getElementById('travDateTo');if(tdt)tdt.value=ETIE.trip.dateTo||'';
    try{
      var tdp=document.getElementById('travDistrictPills');
      if(tdp){
        var curD=ETIE.trip.district||'Central / Soho';
        Array.prototype.forEach.call(tdp.querySelectorAll('.chip'),function(b){ b.classList.toggle('active', b.textContent.trim()===curD); });
      }
      var tDateP=document.getElementById('travDatePills');
      if(tDateP){
        var isWeek=ETIE.trip.dateFrom && ETIE.trip.dateTo && ETIE.trip.dateFrom!==ETIE.trip.dateTo;
        var curV=isWeek?'This Week':'Tonight';
        Array.prototype.forEach.call(tDateP.querySelectorAll('.chip'),function(b){ b.classList.toggle('active', b.textContent.trim()===curV); });
      }
    }catch(e){}
    var tn=document.getElementById('travNationality'); if(tn) tn.value=ETIE.traveller.nationality||'';
    var tnn=document.getElementById('travNickname'); if(tnn) tnn.value=ETIE.traveller.nickname||'';
    setChips('travInterests',ETIE.traveller.interests);
    var svEl=document.getElementById('travSocialVibe'); if(svEl) svEl.value=(ETIE.traveller.socialVibe!=null?ETIE.traveller.socialVibe:1);
    var tpEl=document.getElementById('travTravelPace'); if(tpEl) tpEl.value=(ETIE.traveller.travelPace!=null?ETIE.traveller.travelPace:1);
    setChips('travStyleChips',ETIE.traveller.styleInterests||[]);
    var lsv=document.getElementById('localSocialVibe'); if(lsv) lsv.value=(ETIE.local.socialVibe!=null?ETIE.local.socialVibe:1);
    var ltp=document.getElementById('localTravelPace'); if(ltp) ltp.value=(ETIE.local.travelPace!=null?ETIE.local.travelPace:1);
    setChips('localStyleChips',ETIE.local.styleInterests||[]);
    setChips('travLookingFor',ETIE.traveller.lookingFor);
    document.getElementById('travHook').value=ETIE.traveller.hook;
    document.getElementById('localCity').value=ETIE.local.city;
    document.getElementById('localAge').value=ETIE.local.age;
    document.getElementById('localNationality').value=ETIE.local.nationality||'';
    var lnn=document.getElementById('localNickname'); if(lnn) lnn.value=ETIE.local.displayName||'';
    setChips('localInterests',ETIE.local.interests);
    // local hybrid handled above (localSocialVibe etc.)
    document.getElementById('localOffer').value=ETIE.local.offer;
    try{ setChips('localOfferTags',ETIE.local.offerTags); }catch(e){}
    try{
      var vm=ETIE.local.verificationMethods||[];
      var vc=document.getElementById('localVerify');
      if(vc)Array.prototype.forEach.call(vc.querySelectorAll('.list-item'),function(row){
        var on=vm.indexOf(row.getAttribute('data-method'))!==-1;
        row.classList.toggle('selected',on);
        var st=row.querySelector('.status');if(st)st.textContent=on?'Selected':'Tap to select';
      });
    }catch(e){}
    try{
      var tvm=ETIE.traveller.verificationMethods||[];
      var tc=document.getElementById('travVerify');
      if(tc)Array.prototype.forEach.call(tc.querySelectorAll('.list-item'),function(row){
        var on=tvm.indexOf(row.getAttribute('data-method'))!==-1;
        row.classList.toggle('selected',on);
        var st=row.querySelector('.status');if(st)st.textContent=on?'Selected':'Tap to select';
      });
    }catch(e){}
    try{
      var tdp=document.getElementById('travDistrictPills');
      if(tdp){
        var curD=ETIE.trip.district||'Central / Soho';
        Array.prototype.forEach.call(tdp.querySelectorAll('.chip'),function(b){
          b.classList.toggle('active', b.textContent.trim()===curD);
        });
      }
    }catch(e){}
    try{
      var dp=document.getElementById('localDistrictPills');
      if(dp){
        var cur=ETIE.local.district||'Central / Soho';
        Array.prototype.forEach.call(dp.querySelectorAll('.chip'),function(b){
          b.classList.toggle('active', b.textContent.trim()===cur);
        });
      }
    }catch(e){}
  }catch(e){}
  restorePhotoPreviews();updateCounts();refreshSliderLabels();refreshAnchoredLabels();syncAvailUI();renderProfiles();renderRoleGate();renderMatches();renderRequests();renderChat();renderMessagesList();renderMeetup();renderThanks();renderTrips();renderLocalDashboard();
}
function refreshSliderLabels(){
  var m=[['localSocial','localSocialVal'],['localSpont','localSpontVal'],['localCurious','localCuriousVal']];
  m.forEach(function(p){var a=document.getElementById(p[0]),b=document.getElementById(p[1]);if(a&&b)b.textContent=a.value;});
  refreshAnchoredLabels();
}
// Location database — build country selects + city typeahead (offline, no API)
function countryName(code){try{var a=window.ETIE_COUNTRIES||[];for(var i=0;i<a.length;i++)if(a[i].code===code)return a[i].name;}catch(e){}return code;}
function buildCountrySelects(){
  try{
    if(!window.ETIE_COUNTRIES)return;
    ['travNationality','localNationality'].forEach(function(id){
      var sel=document.getElementById(id);if(!sel)return;
      var cur=sel.value;
      sel.innerHTML='<option value="">Select nationality</option>';
      window.ETIE_COUNTRIES.forEach(function(c){
        var o=document.createElement('option');o.value=c.code;o.textContent=flagEmoji(c.code)+' '+c.name;sel.appendChild(o);
      });
      var o=document.createElement('option');o.value='OTHER';o.textContent='🌍 Other';sel.appendChild(o);
      if(cur)sel.value=cur;
    });
  }catch(e){}
}
function locationSuggest(inputId,boxId){
  try{
    var inp=document.getElementById(inputId),box=document.getElementById(boxId);
    if(!inp||!box)return;
    var q=(inp.value||'').toLowerCase().trim();
    box.innerHTML='';box.classList.remove('open');
    if(q.length<2)return;
    var out=[];var cities=window.ETIE_CITIES||[];
    // prefer the currently-selected country, then everything else (never hard-restricted)
    var selCode='';
    try{selCode=(document.getElementById(inputId==='travCity'?'travNationality':'localNationality')||{}).value||'';}catch(e){}
    var same=[],rest=[];
    for(var i=0;i<cities.length;i++){
      var c=cities[i];
      if((c.city+' '+countryName(c.code)).toLowerCase().indexOf(q)===-1)continue;
      if(selCode&&selCode!=='OTHER'&&c.code===selCode)same.push(c);else rest.push(c);
    }
    out=same.concat(rest).slice(0,8);
    if(!out.length)return;
    out.forEach(function(c){
      var b=document.createElement('button');b.type='button';b.className='suggest-item';
      var s=document.createElement('span');s.textContent=flagEmoji(c.code)+' '+c.city+' · '+countryName(c.code);b.appendChild(s);
      b.onclick=(function(cc){return function(){pickLocation(inputId,boxId,cc.city,cc.code);};})(c);
      box.appendChild(b);
    });
    box.classList.add('open');
  }catch(e){}
}
function pickLocation(inputId,boxId,city,code){
  try{
    var inp=document.getElementById(inputId);if(inp)inp.value=city;
    var box=document.getElementById(boxId);if(box){box.innerHTML='';box.classList.remove('open');}
    if(inputId==='travCity'){ ETIE.trip.destination=city;ETIE.trip.country=code; }
    if(inputId==='localCity'){var l=document.getElementById('localNationality');if(l)l.value=code;ETIE.local.city=city;ETIE.local.nationality=code;}
    saveCurrentVisible(true);updateHookLabel();
  }catch(e){}
}
function updateHookLabel(){
  try{
    var l=document.getElementById('travHookLabel');
    if(l)l.textContent='What would you love to do in '+(ETIE.trip.destination||'this city')+'?';
  }catch(e){}
}
// Alphabetise all pickers A–Z (countries keep 🌍 Other last; chips keep active state)
function alphabetisePickers(){
  try{
    ['travNationality','localNationality'].forEach(function(id){
      var sel=document.getElementById(id);if(!sel||!sel.options)return;
      var cur=sel.value;
      var opts=Array.prototype.slice.call(sel.options);
      var other=opts.filter(function(o){return o.value==='OTHER';});
      var rest=opts.filter(function(o){return o.value!=='OTHER';}).sort(function(a,b){return a.text.localeCompare(b.text);});
      rest.concat(other).forEach(function(o){sel.appendChild(o);});
      if(cur)sel.value=cur;
    });
    ['travInterests','localInterests','travLookingFor','localOfferTags'].forEach(function(id){
      var c=document.getElementById(id);if(!c)return;
      var btns=Array.prototype.slice.call(c.querySelectorAll('.chip')).sort(function(a,b){return a.textContent.trim().localeCompare(b.textContent.trim());});
      btns.forEach(function(b){c.appendChild(b);});
    });
  }catch(e){}
}
// ---- Friend in Every City — map-first hooks (Leaflet, Hong Kong) ----
// Pins render ONLY from live hooks: Supabase etie_pins (origin 'cloud') + local testing state.
// No seed/demo/guide-presence pins. Empty map shows the first-pin banner.
var MAP_CATS=[{id:'All',emoji:'🗺️'},{id:'Food',emoji:'🥟'},{id:'Nightlife',emoji:'🍺'},{id:'Photo',label:'Photo Walk',emoji:'📸'},{id:'Sports',emoji:'⚽'},{id:'Cafe',emoji:'☕'}];
var MAP_INTENTS=[{id:'All',label:'All Pins',emoji:'🗺️'},{id:'traveller',label:'✈️ Visiting Now'},{id:'local',label:'🇭🇰 Hosted by Locals'}];
var MAP_VIBES=[{id:'Sports',emoji:'⚽'},{id:'Nightlife',emoji:'🍺'},{id:'Cafe',label:'Cafes',emoji:'☕'},{id:'Photo',label:'Photo Walks',emoji:'📸'}];
var MAP_DISTRICT_LATLNG={'Central / Soho':[22.2819,114.1577],'Lan Kwai Fong':[22.2810,114.1550],'Sheung Wan':[22.2867,114.1520],'Tsim Sha Tsui':[22.2980,114.1722],'Mong Kok':[22.3193,114.1694],'Sham Shui Po':[22.3307,114.1625]};
var HK_CENTER=[22.2819,114.1581],HK_ZOOM=13;
var MAP_FILTER='All',MAP_ROLE='All';
var _map=null,_mapLayer=null,_openPinId=null;
var _dropPoint=null; // {lat,lng} set by tapping the map
var _dropMarker=null;
var _hookDraft={category:'Food',role:'traveller'};
function mapCatEmoji(cat){for(var i=0;i<MAP_CATS.length;i++)if(MAP_CATS[i].id===cat||MAP_CATS[i].label===cat)return MAP_CATS[i].emoji;return '📍';}
function nearestDistrictLabel(lat,lng){
  var best='Central / Soho',bd=1e9;
  try{
    for(var k in MAP_DISTRICT_LATLNG){
      var c=MAP_DISTRICT_LATLNG[k];
      var d=(c[0]-lat)*(c[0]-lat)+(c[1]-lng)*(c[1]-lng);
      if(d<bd){bd=d;best=k;}
    }
  }catch(e){}
  return best;
}
function hookNick(){try{return ETIE.traveller.nickname||ETIE.local.displayName||'You';}catch(e){return 'You';}}
function hookVerified(){try{return ((ETIE.traveller.verificationMethods||[]).length+(ETIE.local.verificationMethods||[]).length)>0;}catch(e){return false;}}
// ---- Automated location-based role derivation (GPS vs home city, 50km) ----
var HK_HOME=[22.3193,114.1694];
function haversineKm(lat1,lng1,lat2,lng2){
  try{
    var R=6371,dLa=(lat2-lat1)*Math.PI/180,dLn=(lng2-lng1)*Math.PI/180;
    var a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLn/2)*Math.sin(dLn/2);
    return 2*R*Math.asin(Math.sqrt(a));
  }catch(e){return 99999;}
}
function applyDerivedRole(role,why){
  try{
    var signed=false;try{signed=isSignedIn();}catch(e){}
    if(why==='gps'&&role){
      ETIE.derivedRole=role; ETIE.locDenied=false;
      if(signed&&!ETIE.activeRole)ETIE.activeRole=role; // first fix wins; manual roleSwitch picks stick after
      try{
        var fx=ETIE.lastFix;
        if(fx&&fx.lat!=null){
          ETIE.anchor={lat:fx.lat,lng:fx.lng,label:areaLabel(fx.lat,fx.lng)};
          if(!ETIE._anchored&&_map){
            ETIE._anchored=true;
            try{_map.setMaxBounds(anchorBounds(ETIE.anchor));}catch(e){}
            try{_map.flyTo([fx.lat,fx.lng],13,{duration:1.2});}catch(e){}
          }
          try{
            reverseLabel(fx.lat,fx.lng,function(lbl){
              if(!lbl)return;
              try{
                if(ETIE.anchor&&Math.abs(ETIE.anchor.lat-fx.lat)<0.01){ETIE.anchor.label=lbl;saveState();renderAreaSidebar();}
              }catch(e){}
            });
          }catch(e){}
        }
      }catch(e){}
    }else{
      ETIE.derivedRole=null; ETIE.locDenied=true; // never claim a role without a real GPS comparison
    }
    saveState();renderDerivedBadge();
    if(!signed)return;
    if(why==='gps')toast((role==='local'?'🇭🇰 Local detected — ':'✈️ Traveller detected — ')+'role set from your location.');
    else toast('Location unavailable — tap the 📍 badge to retry. No role assumed.');
  }catch(e){}
}
function renderDerivedBadge(){
  try{
    var b=document.getElementById('derivedBadge');if(!b)return;
    var signed=false;try{signed=isSignedIn();}catch(e){}
    if(!signed){b.style.display='none';return;}
    b.style.display='';
    var r=null;try{r=ETIE.derivedRole;}catch(e){}
    if(r==='local'){b.textContent='🇭🇰 Local';b.className='derived-badge derived-local';}
    else if(r==='traveller'){b.textContent='✈️ Traveller';b.className='derived-badge derived-traveller';}
    else{var denied=false;try{denied=!!ETIE.locDenied;}catch(e){}b.textContent=denied?'📍 Location off':'📍 …';b.className='derived-badge';}
  }catch(e){}
}
function getAnchor(){
  try{if(ETIE.anchor&&ETIE.anchor.lat!=null)return ETIE.anchor;}catch(e){}
  return {lat:HK_CENTER[0],lng:HK_CENTER[1],label:'Hong Kong'};
}
function anchorBounds(a){
  try{return [[a.lat-1.1,a.lng-1.8],[a.lat+1.1,a.lng+1.8]];}catch(e){return [[22.10,113.80],[22.60,114.50]];}
}
function areaLabel(lat,lng){
  try{
    if(haversineKm(lat,lng,HK_CENTER[0],HK_CENTER[1])<=60)return nearestDistrictLabel(lat,lng);
  }catch(e){}
  try{return ETIE.local.city||'Around you';}catch(e){return 'Around you';}
}
function reverseLabel(lat,lng,cb){
  try{
    ETIE.geoCache=ETIE.geoCache||{};
    var key=lat.toFixed(1)+','+lng.toFixed(1);
    if(ETIE.geoCache[key]){cb(ETIE.geoCache[key]);return;}
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+lat+'&lon='+lng+'&zoom=10').then(function(r){return r.json();}).then(function(j){
      try{
        var a=j&&j.address||{};
        var city=a.city||a.town||a.village||a.municipality||a.state||null;
        var cc=(a.country_code||'').toUpperCase();
        var label=city?city+(cc?' '+flagEmoji(cc):''):(j.display_name||'').split(',').slice(0,2).join(',');
        if(label){ETIE.geoCache[key]=label;try{saveState();}catch(e){}cb(label);}else cb(null);
      }catch(e){cb(null);}
    }).catch(function(){cb(null);});
  }catch(e){cb(null);}
}
function locateUser(){
  try{
    if(!navigator.geolocation){applyDerivedRole(null,'unavailable');return;}
    navigator.geolocation.getCurrentPosition(function(pos){
      try{
        var lat=pos.coords.latitude,lng=pos.coords.longitude;
        try{ETIE.lastFix={lat:lat,lng:lng};}catch(e){}
        var d=haversineKm(lat,lng,HK_HOME[0],HK_HOME[1]);
        applyDerivedRole(d<=50?'local':'traveller','gps');
      }catch(e){}
    },function(err){applyDerivedRole(null,'denied');},{timeout:9000,maximumAge:300000});
  }catch(e){}
}
function normHookPin(p){
  // normalize legacy user pins into the hook shape; drop anything without real coords
  if(!p||p.lat==null||p.lng==null)return null;
  var cat=p.category||p.interest||'Food';
  var known=['Food','Nightlife','Photo','Sports','Cafe'];
  if(known.indexOf(cat)===-1)cat='Food';
  var role=(p.role==='local')?'local':'traveller';
  return {
    id:String(p.id),kind:'hook',title:String(p.title||p.location||'Hook').slice(0,60),category:cat,role:role,derivedRole:p.derivedRole||role,authorId:p.authorId||null,
    capacity:Math.min(4,Math.max(2,parseInt(p.capacity,10)||3)),expires_at:p.expires_at||p.ends_at||null,
    starts_at:p.starts_at||null,ends_at:p.ends_at||null,
    name:p.name||'Someone',verified:!!p.verified,
    location:p.location||nearestDistrictLabel(p.lat,p.lng),
    lat:p.lat,lng:p.lng,hook:String(p.hook||'').slice(0,140),
    members:p.members||[{nick:(p.name||'Someone'),role:role,verified:!!p.verified}],
    pending:p.pending||[],status:p.status||'open',
    ts:p.ts||Date.now(),origin:p.origin||'local',cloudId:p.cloudId||null
  };
}
function allMapPins(){
  var out=[];
  try{
    (ETIE.mapPins||[]).forEach(function(p){
      if(!p||!p.id)return;
      if(String(p.id).indexOf('seed-')===0)return;
      if(p.kind==='guide')return;
      var n=normHookPin(p);
      if(n)out.push(n);
    });
  }catch(e){}
  return out;
}
function pinLatLng(p){return [p.lat,p.lng];}
function visibleMapPins(){
  var all=allMapPins();
  if(MAP_FILTER!=='All')all=all.filter(function(p){return p.category===MAP_FILTER;});
  if(MAP_ROLE!=='All')all=all.filter(function(p){return ((p.derivedRole||p.role)==='local'?'local':'traveller')===MAP_ROLE;});
  var nowTs=Date.now();
  all=all.filter(function(p){try{return !(p.expires_at&&new Date(p.expires_at).getTime()<nowTs);}catch(e){return true;}});
  return all;
}
function initHKMap(){
  try{
    if(_map||!window.L)return;
    var el=document.getElementById('hkMap');if(!el)return;
    var _anchor=getAnchor();
    var globalBounds=[[-85,-180],[85,180]];
    _map=L.map('hkMap',{zoomControl:false,minZoom:2,maxZoom:20,maxBounds:globalBounds,maxBoundsViscosity:0.3,worldCopyJump:true}).setView([_anchor.lat,_anchor.lng],HK_ZOOM);
    try{L.control.zoom({position:'bottomright'}).addTo(_map);}catch(e){}
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=cc9c3230-65b0-44c0-8361-2c86413b0744',{maxZoom:20,attribution:'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(_map);
    _map.on('click',onMapTap);
    renderMapFilter();try{if(gateState()==='open')renderMapPins();}catch(e){}
  }catch(e){}
}
var _pickMode=null; // null | 'trav1' | 'hook'
function pickOnMap(mode){
  try{
    _pickMode=(mode==='trav1')?'trav1':'hook';
    closeDropHook();
    showScreen('map');
    toast(_pickMode==='trav1'?'Tap the map to set your active location.':'Tap the map to place your hook pin.');
  }catch(e){}
}
function onMapTap(e){
  try{
    _dropPoint={lat:e.latlng.lat,lng:e.latlng.lng};
    if(_dropMarker){try{_map.removeLayer(_dropMarker);}catch(_){}}
    _dropMarker=L.marker([_dropPoint.lat,_dropPoint.lng],{title:'Your pin location'}).addTo(_map);
    var guess='Near '+nearestDistrictLabel(_dropPoint.lat,_dropPoint.lng);
    if(_pickMode==='trav1'){
      _pickMode=null;
      try{
        ETIE.trip.pickLat=_dropPoint.lat; ETIE.trip.pickLng=_dropPoint.lng;
        ETIE.trip.district=nearestDistrictLabel(_dropPoint.lat,_dropPoint.lng);
        saveState(); renderTrav1Location();
      }catch(err){}
      showScreen('home'); try{travNext(1);}catch(err){}
      toast('Active location set — '+guess+'.');
      return;
    }
    _pickMode=null;
    window._pendingDropGuess=guess;
    openDropHook();
  }catch(err){}
}
function renderTrav1Location(){
  try{
    var city='Hong Kong'; try{city=ETIE.city||'Hong Kong';}catch(e){}
    var b=document.getElementById('trav1CityBadge'); if(b)b.textContent='🇭🇰 '+city+' (Current Launch City)';
    var sub=document.getElementById('trav1Sub'); if(sub)sub.textContent='ETIE is live in '+city+'. Select your location to browse active local guides and meetup hooks.';
    var lat=null,lng=null;
    try{if(ETIE.trip.pickLat!=null){lat=ETIE.trip.pickLat;lng=ETIE.trip.pickLng;}}catch(e){}
    if(lat==null){ try{if(_map){var c=_map.getCenter();lat=c.lat;lng=c.lng;}}catch(e){} }
    if(lat==null){lat=HK_CENTER[0];lng=HK_CENTER[1];}
    var d=nearestDistrictLabel(lat,lng);
    if(ETIE.trip.pickLat==null){ try{ETIE.trip.district=d;}catch(e){} }
    var l=document.getElementById('trav1LocLabel');
    if(l)l.textContent='Near '+d+' ('+lat.toFixed(4)+', '+lng.toFixed(4)+')';
  }catch(e){}
}
function renderMapFilter(){
  try{
    var bar=document.getElementById('mapFilterBar');if(!bar)return;
    bar.innerHTML='';
    MAP_INTENTS.forEach(function(c){
      var on=(c.id==='All')?(MAP_ROLE==='All'&&MAP_FILTER==='All'):(MAP_ROLE===c.id);
      var b=document.createElement('button');b.className='chip'+(on?' active':'');b.textContent=(c.emoji?c.emoji+' ':'')+c.label;b.style.padding='8px 12px';
      b.onclick=(function(id){return function(){selectIntent(id);};})(c.id);
      bar.appendChild(b);
    });
    var sep=document.createElement('span');sep.className='filter-sep';sep.textContent='|';
    bar.appendChild(sep);
    MAP_VIBES.forEach(function(c){
      var b=document.createElement('button');b.className='chip'+(MAP_FILTER===c.id?' active':'');b.textContent=c.emoji+' '+(c.label||c.id);b.style.padding='8px 12px';
      b.onclick=(function(id){return function(){setMapFilter(id);};})(c.id);
      bar.appendChild(b);
    });
    var rb=document.getElementById('mapRoleBar');
    if(rb)rb.style.display='none';
  }catch(e){}
}
function setMapFilter(cat){MAP_FILTER=(MAP_FILTER===cat)?'All':cat;renderMapFilter();renderMapPins();}
function setMapRole(role){MAP_ROLE=role;renderMapFilter();renderMapPins();}
function selectIntent(id){if(id==='All'){MAP_ROLE='All';MAP_FILTER='All';}else{MAP_ROLE=id;}renderMapFilter();renderMapPins();}
function renderMapPins(){
  try{
    if(!window.L||!document.getElementById('hkMap'))return;
    initHKMap();if(!_map)return;
    if(_mapLayer){try{_map.removeLayer(_mapLayer);}catch(e){}}
    _mapLayer=L.layerGroup().addTo(_map);
    var pins=visibleMapPins();
    // Group pins by rounded coordinates to detect overlaps
    var pinGroups={};
    pins.forEach(function(p){
      var key=Math.round(p.lat*1000)+','+Math.round(p.lng*1000); // ~100m precision
      if(!pinGroups[key])pinGroups[key]=[];
      pinGroups[key].push(p);
    });
    // Render each group with spread for overlapping pins
    Object.keys(pinGroups).forEach(function(key){
      var group=pinGroups[key];
      if(group.length===1){
        renderSinglePin(group[0]);
      }else{
        renderPinCluster(group);
      }
    });
    function renderSinglePin(p){
      try{
        var ll=pinLatLng(p);
        var fresh=(Date.now()-(p.ts||0))<3600*1000?' sq-pin-fresh':'';
        var prole=((p.derivedRole||p.role)==='local')?'local':'traveller';
        var icon=L.divIcon({className:'',html:'<div class="sq-pin sq-pin-'+prole+fresh+'">'+mapCatEmoji(p.category)+'</div>',iconSize:[36,36],iconAnchor:[18,18]});
        var mk=L.marker(pinLatLng(p),{icon:icon,title:(p.name||'Hook')+' · '+p.category});
        mk.on('click',(function(id){return function(){openPinDetail(id);};})(p.id));
        _mapLayer.addLayer(mk);
      }catch(e){}
    }
    function renderPinCluster(group){
      var center=pinLatLng(group[0]);
      var count=group.length;
      var radius=25; // pixels from center
      group.forEach(function(p,i){
        var angle=(i/group.length)*2*Math.PI;
        var offsetLat=center[0]+(radius/111000)*Math.cos(angle); // ~111km per degree
        var offsetLng=center[1]+(radius/111000)*Math.sin(angle)/Math.cos(center[0]*Math.PI/180);
        try{
          var fresh=(Date.now()-(p.ts||0))<3600*1000?' sq-pin-fresh':'';
          var prole=((p.derivedRole||p.role)==='local')?'local':'traveller';
          var icon=L.divIcon({className:'',html:'<div class="sq-pin sq-pin-'+prole+fresh+'">'+mapCatEmoji(p.category)+'</div>',iconSize:[36,36],iconAnchor:[18,18]});
          var mk=L.marker([offsetLat,offsetLng],{icon:icon,title:(p.name||'Hook')+' · '+p.category});
          mk.on('click',(function(id){return function(){openPinDetail(id);};})(p.id));
          _mapLayer.addLayer(mk);
        }catch(e){}
      });
    }
    try{sweepExpiredPins();pins=visibleMapPins();}catch(e){}
    var c=document.getElementById('mapPinCount');
    if(c)c.textContent=pins.length?pins.length+' hook'+(pins.length===1?'':'s')+' live in HK':'';
    var eb=document.getElementById('mapEmptyBanner');
    if(eb)eb.classList.toggle('hidden',pins.length>0);
    try{renderAreaSidebar();}catch(e){}
  }catch(e){}
}
function selectHookCategory(el,v){try{var c=document.getElementById('hookInterestPills');if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');});if(el)el.classList.add('active');_hookDraft.category=v;}catch(e){_hookDraft.category=v;}}
function setHookRole(v){
  try{
    _hookDraft.role=(v==='local')?'local':'traveller';
    var t=document.getElementById('hookRoleTrav'),l=document.getElementById('hookRoleLocal');
    if(t)t.classList.toggle('active',_hookDraft.role==='traveller');
    if(l)l.classList.toggle('active',_hookDraft.role==='local');
    try{renderHookRoleLine();}catch(e){}
  }catch(e){}
}
var HOOK_PRESETS=[
  {cat:'Nightlife',emoji:'💃',label:'dance? or even better... salsa?',title:'Salsa & Bachata night — down for a dance?'},
  {cat:'Food',emoji:'🥟',label:'foodie time?',title:'Foodie run — hunting for hidden local gems'},
  {cat:'Nightlife',emoji:'🍸',label:'drinks in soho?',title:'Casual drinks & speakeasy in Soho'},
  {cat:'Photo',emoji:'🎬',label:'letterboxd? sounds like movie movie',title:'Movie night for film heads'}
];
function applyHookPreset(i){
  try{
    var p=HOOK_PRESETS[i];if(!p)return;
    _hookDraft.category=p.cat;
    var ht0=document.getElementById('hookTitle');if(ht0)ht0.value=p.title.slice(0,60);
    var ht=document.getElementById('hookText');if(ht)ht.focus();
    hookCountTick();
  }catch(e){}
}
function selectHookWindow(el,v){
  try{
    _hookDraft.window='custom';
    var c=document.getElementById('hookWindowPills');
    if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');});
    if(el)el.classList.add('active');
    var drawer=document.getElementById('customTimeDrawer');
    if(drawer)drawer.classList.remove('hidden');
  }catch(e){_hookDraft.window='custom';}
}
function hookCap(d){
  try{
    _hookDraft.capacity=Math.min(4,Math.max(2,(_hookDraft.capacity||3)+d));
    var v=document.getElementById('hookCapVal');if(v)v.textContent=_hookDraft.capacity;
    var h=document.getElementById('hookCapHint');
    if(h){
      var cap=_hookDraft.capacity;
      h.textContent=cap===2?'You + 1 guest (1-on-1)':(cap===3?'You + 2 guests (Trio)':'You + 3 guests (Group Max)');
    }
  }catch(e){}
}
function toggleHookRole(){try{setHookRole(_hookDraft.role==='local'?'traveller':'local');renderHookRoleLine();}catch(e){}}
function renderHookRoleLine(){
  try{
    var r=document.getElementById('hookRolePill');
    if(r)r.textContent=_hookDraft.role==='local'?'🇭🇰 Local Host':'✈️ Traveller';
  }catch(e){}
}
function windowExpires(w,nowTs){
  try{
    var dateStr=document.getElementById('customDate')?.value;
    var startStr=document.getElementById('customStartTime')?.value;
    var endStr=document.getElementById('customEndTime')?.value;
    if(!dateStr || !startStr){
      return {s:nowTs,e:nowTs+3*3600*1000};
    }
    var start=new Date(dateStr+'T'+startStr).getTime();
    var end=endStr ? new Date(dateStr+'T'+endStr).getTime() : start+3*3600*1000;
    if(end<=start) end=start+3*3600*1000;
    return {s:start,e:end};
  }catch(e){return {s:nowTs,e:nowTs+3*3600*1000};}
}
function hookCountTick(){
  try{
    var t=document.getElementById('hookText');var c=document.getElementById('hookCount');
    if(t&&c)c.textContent=(t.value||'').length+' / 140';
  }catch(e){}
}
function renderHookPresets(){
  try{
    var box=document.getElementById('hookPresets');
    if(!box) return;
    box.innerHTML='';
    HOOK_PRESETS.forEach(function(p,i){
      var btn=document.createElement('button');
      btn.className='chip preset-chip';
      btn.textContent=p.emoji+' '+p.label;
      btn.onclick=function(){applyHookPreset(i);};
      box.appendChild(btn);
    });
  }catch(e){}
}
function openDropHook(){
  try{
    if(needProfile('drop a hook'))return;
    var startRole='traveller';
    try{startRole=(ETIE.derivedRole||ETIE.activeRole)==='local'?'local':'traveller';}catch(e){}
    _hookDraft={category:'general',role:startRole,window:'custom',capacity:3,customStart:null,customEnd:null,photos:[]};
    var ht0=document.getElementById('hookTitle');if(ht0)ht0.value='';
    hookCap(0);renderHookRoleLine();
    renderHookPresets();
    var today=new Date().toISOString().slice(0,10);
    var cd=document.getElementById('customDate'); if(cd) cd.value=today;
    var cst=document.getElementById('customStartTime'); if(cst) cst.value='19:30';
    var cet=document.getElementById('customEndTime'); if(cet) cet.value='';
    var pv=document.getElementById('hookPhotoPreview'); if(pv) pv.innerHTML='';
    // default coords: last map tap, else live map center
    if(!_dropPoint){
      try{if(_map)_dropPoint={lat:_map.getCenter().lat,lng:_map.getCenter().lng};}catch(e){}
      if(!_dropPoint)_dropPoint={lat:HK_CENTER[0],lng:HK_CENTER[1]};
    }
    var o=document.getElementById('dropHookModal');if(o)o.classList.remove('hidden');
    var li=document.getElementById('hookLocation');
    if(li){li.value=window._pendingDropGuess||('Near '+nearestDistrictLabel(_dropPoint.lat,_dropPoint.lng));window._pendingDropGuess=null;}
    var ht=document.getElementById('hookText');if(ht){ht.value='';var ph='';try{ph=(ETIE.traveller&&ETIE.traveller.bio)||'';}catch(e){}ht.placeholder=ph||"e.g. Grabbing late-night claypot rice in Sham Shui Po—who's down to join?";}
    hookCountTick();setHookRole(_hookDraft.role);
    if(_dropMarker){try{_map.removeLayer(_dropMarker);}catch(e){}_dropMarker=null;}
    try{_dropMarker=L.marker([_dropPoint.lat,_dropPoint.lng],{title:'Your pin location'}).addTo(_map);}catch(e){}
  }catch(e){}
}
function closeDropHook(){try{var o=document.getElementById('dropHookModal');if(o)o.classList.add('hidden');}catch(e){}}
function handleHookPhotos(input){
  try{
    var files=Array.from(input.files||[]).slice(0,3);
    if(!files.length) return;
    var pv=document.getElementById('hookPhotoPreview'); if(!pv) return;
    files.forEach(function(file){
      if(_hookDraft.photos.length>=3) return;
      var reader=new FileReader();
      reader.onload=function(e){
        _hookDraft.photos.push({dataUrl:e.target.result,name:file.name,type:file.type});
        renderHookPhotoPreviews();
      };
      reader.readAsDataURL(file);
    });
    input.value='';
  }catch(e){}
}
function renderHookPhotoPreviews(){
  try{
    var pv=document.getElementById('hookPhotoPreview'); if(!pv) return;
    pv.innerHTML='';
    (_hookDraft.photos||[]).forEach(function(p,idx){
      var wrap=document.createElement('div'); wrap.style.position='relative'; wrap.style.width='80px'; wrap.style.height='80px'; wrap.style.borderRadius='12px'; wrap.style.overflow='hidden'; wrap.style.flexShrink='0';
      var im=document.createElement('img'); im.src=p.dataUrl; im.style.width='100%'; im.style.height='100%'; im.style.objectFit='cover'; wrap.appendChild(im);
      var del=document.createElement('button'); del.textContent='✕'; del.style.position='absolute'; del.style.top='4px'; del.style.right='4px'; del.style.width='20px'; del.style.height='20px'; del.style.borderRadius='50%'; del.style.background='rgba(0,0,0,.7)'; del.style.border='none'; del.style.color='#fff'; del.style.fontSize='12px'; del.style.cursor='pointer'; del.onclick=function(){_hookDraft.photos.splice(idx,1);renderHookPhotoPreviews();}; wrap.appendChild(del);
      pv.appendChild(wrap);
    });
  }catch(e){}
}
function persistPinCloud(pin){
  try{if(window.EtieCloud&&window.EtieCloud.pushPin)window.EtieCloud.pushPin(pin);}catch(e){}
}
function saveDropHook(){
  try{
    if(!_dropPoint){toast('Tap the map first to place your pin.');return;}
    var title=((document.getElementById('hookTitle')||{}).value||'').trim().slice(0,60);
    var loc=((document.getElementById('hookLocation')||{}).value||'').trim();
    var details=((document.getElementById('hookText')||{}).value||'').trim().slice(0,140);
    if(!title){toast('Give it a title first.');return;}
    if(!loc){toast('Name the pin location first.');return;}
    var nm=hookNick(),vf=hookVerified();
    var nowTs=Date.now();
    var win=windowExpires(_hookDraft.window||'now',nowTs);
    var cap=Math.min(4,Math.max(2,_hookDraft.capacity||3));
    var hook=details||title;
    var pin={id:'pin-'+nowTs,kind:'hook',title:title,category:_hookDraft.category,role:_hookDraft.role,derivedRole:(function(){try{return ETIE.derivedRole||_hookDraft.role;}catch(e){return _hookDraft.role;}})(),authorId:(function(){try{return myUid();}catch(e){return null;}})(),
      starts_at:new Date(win.s).toISOString(),ends_at:new Date(win.e).toISOString(),expires_at:new Date(win.e).toISOString(),capacity:cap,spotsAvailable:cap,
      name:nm,verified:vf,location:loc,lat:_dropPoint.lat,lng:_dropPoint.lng,hook:hook,photos:(_hookDraft.photos||[]).map(function(p){return p.dataUrl;}),
      members:[{nick:nm,role:_hookDraft.role,verified:vf,bio:((ETIE.traveller&&ETIE.traveller.bio)||'').slice(0,140)}],pending:[],requests:[],status:'active',
      ts:Date.now(),origin:'local',cloudId:null};
    if(_hookDraft.window==='custom'){
      var cs=document.getElementById('customDate')?.value;
      var cst=document.getElementById('customStartTime')?.value;
      var cet=document.getElementById('customEndTime')?.value;
      if(cs && cst) pin.customStart=cs+'T'+cst;
      if(cs && cet) pin.customEnd=cs+'T'+cet;
    }
    if(!ETIE.mapPins)ETIE.mapPins=[];
    ETIE.mapPins.push(pin);
    saveState();persistPinCloud(pin);
    _dropPoint=null;
    if(_dropMarker){try{_map.removeLayer(_dropMarker);}catch(e){}_dropMarker=null;}
    closeDropHook();renderMapPins();toast('Hook dropped — live on the map.');
  }catch(e){toast('Could not drop pin.');}
}
function findPin(id){var all=allMapPins();for(var i=0;i<all.length;i++)if(all[i].id===id)return all[i];return null;}
function storePin(p){
  // write a normalized pin back into ETIE.mapPins (matched by id or cloudId)
  try{
    var arr=ETIE.mapPins||[];
    for(var i=0;i<arr.length;i++){
      if(arr[i]&&(arr[i].id===p.id||(p.cloudId&&arr[i].cloudId===p.cloudId))){arr[i]=p;break;}
    }
    ETIE.mapPins=arr;saveState();persistPinCloud(p);
  }catch(e){}
}
function isPinExpired(p){try{return !!(p.expires_at&&new Date(p.expires_at).getTime()<Date.now());}catch(e){return false;}}
function hasApprovedRequest(p,nick){
  try{
    return (p.requests||[]).some(function(r){
      return r.status==='approved' && r.nick===nick;
    });
  }catch(e){return false;}
}
function getApprovedRequestLocation(p,nick){
  try{
    var req=(p.requests||[]).find(function(r){return r.status==='approved' && r.nick===nick;});
    if(req && req.locationRevealed){
      return {lat:p.lat,lng:p.lng,address:p.location};
    }
    return null;
  }catch(e){return null;}
}
function checkAndExpireRequests(p){
  try{
    var now=Date.now(),changed=false;
    (p.requests||[]).forEach(function(r){
      if(r.status!=='pending') return;
      // Expire after 30 minutes (1800000ms)
      if(now - r.createdAt > 30*60*1000){
        r.status='expired';
        r.updatedAt=now;
        r.expiredReason='timeout';
        changed=true;
      }
      // Expire if pin is expired
      else if(isPinExpired(p)){
        r.status='expired';
        r.updatedAt=now;
        r.expiredReason='hook_expired';
        changed=true;
      }
    });
    if(changed) storePin(p);
    return changed;
  }catch(e){return false;}
}
function groupBadgeText(p){
  var n=(p.members||[]).length,cap='';
  try{var c=parseInt(p.capacity,10);if(c>=2&&c<=4)cap=' · '+n+'/'+c;}catch(e){}
  if(isPinExpired(p))return 'Ended — log it';
  if(p.status==='trio'||n>=3)return '3 Connected'+cap;
  if(p.status==='pair'||n===2)return '1-on-1 Meetup'+cap;
  return 'Open hook · be the first'+cap;
}
var _expiryToasted={};
function sweepExpiredPins(){
  try{
    var now=Date.now(),changed=false,me=hookNick();
    (ETIE.mapPins||[]).forEach(function(raw){
      try{
        if(!raw||raw.kind==='guide'||raw.lat==null)return;
        var ex=raw.expires_at?new Date(raw.expires_at).getTime():0;
        if(ex&&ex<now&&raw.status==='active'){
          raw.status='pending_memory_log';changed=true;
          if(raw.name===me&&!_expiryToasted[raw.id]){_expiryToasted[raw.id]=1;setTimeout((function(t){return function(){toast('🔥 “'+t+'” ended — log the memory!');};})((raw.title||raw.location||'Your hook')),1500);}
        }
        // Check and expire pending requests
        if(checkAndExpireRequests(raw)) changed=true;
      }catch(e){}
    });
    if(changed){saveState();try{(ETIE.mapPins||[]).forEach(function(raw){try{if(raw&&raw.status==='pending_memory_log')persistPinCloud(raw);}catch(e){}});}catch(e){}}
  }catch(e){}
}
function openPinDetail(id){
  try{
    var p=findPin(id);if(!p){toast('Pin not found.');return;}
    checkAndExpireRequests(p);
    _openPinId=id;
    var me=hookNick();
    var isMember=(p.members||[]).some(function(m){return m.nick===me;});
    var isPending=(p.pending||[]).some(function(r){return r.nick===me;});
    var hasApproved=hasApprovedRequest(p,me);
    var nn=document.getElementById('pinNick');if(nn)nn.textContent=p.name||'Someone';
    var av2=document.getElementById('pinAvatar');if(av2)av2.textContent=((p.name||'?').charAt(0)||'?').toUpperCase();
    var cb=document.getElementById('pinChatBtn');if(cb)cb.style.display=isMember?'':'none';
    var lb=document.getElementById('pinLogBtn');if(lb)lb.style.display=isMember?'':'none';
    try{renderPinLogs(p.id);}catch(e){}
    var vb=document.getElementById('pinVerified');if(vb){vb.textContent=p.verified?'✅ Verified':'';vb.style.display=p.verified?'':'none';}
    var rb=document.getElementById('pinRoleBadge');if(rb){var pr=(p.role==='local')?'local':'traveller';rb.textContent=pr==='local'?'🇭🇰 Local Host':'✈️ Traveller';rb.classList.toggle('city-host',pr==='local');}
    var ptt=document.getElementById('pinTitle');if(ptt)ptt.textContent=p.title||p.location||'Hook';
    var lc=document.getElementById('pinLoc');
    if(lc){
      if(hasApproved || isMember){
        // Show exact location for approved members
        var exact=getApprovedRequestLocation(p,me) || {lat:p.lat,lng:p.lng,address:p.location};
        lc.innerHTML=mapCatEmoji(p.category)+' '+exact.address+' <span class="small muted">('+exact.lat.toFixed(4)+', '+exact.lng.toFixed(4)+')</span>';
      } else {
        // Show approximate neighborhood only
        lc.textContent=mapCatEmoji(p.category)+' '+(p.location||'Hong Kong')+' <span class="muted small">(Exact location revealed after approval)</span>';
      }
    }
    var hk=document.getElementById('pinHook');if(hk)hk.textContent='“'+(p.hook||'')+'”';
    var pb=document.getElementById('pinBio');if(pb){var bb=p.members&&p.members[0]&&p.members[0].bio;pb.textContent=bb||'';pb.style.display=bb?'':'none';}
    var gb=document.getElementById('pinGroupBadge');if(gb)gb.textContent=groupBadgeText(p);
    var mem=document.getElementById('pinMembers');
    if(mem){mem.innerHTML='';(p.members||[]).forEach(function(m){var s=document.createElement('span');s.className='chip';s.textContent=(m.role==='local'?'🇭🇰 ':'✈️ ')+m.nick;mem.appendChild(s);});}
    var req=document.getElementById('pinRequestBtn');
    if(req){
      req.style.display=(!isMember&&!isPending&&(p.members||[]).length<3&&!isPinExpired(p))?'':'none';
      req.textContent='Request to Connect';
    }
    var wait=document.getElementById('pinPendingNote');
    if(wait)wait.style.display=isPending?'':'none';
    // host controls: author sees incoming requests
    var hostBox=document.getElementById('pinHostBox');
    var mine=isMember&&(p.members||[])[0]&&(p.members||[])[0].nick===me;
    if(hostBox){
      hostBox.innerHTML='';
      if(mine&&(p.requests||[]).length){
        p.requests.forEach(function(r,idx){
          if(r.status!=='pending') return;
          var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;padding:8px;background:rgba(255,255,255,.05);border-radius:8px;';
          var avatar=document.createElement('div');avatar.className='avatar small';avatar.style.width='32px;height:32px;font-size:14px;';avatar.textContent=(r.nick||'?').charAt(0).toUpperCase();
          var lab=document.createElement('span');lab.className='small';lab.style.flex='1';lab.textContent=(r.nick||'Someone')+' wants to join';
          if(r.verified) lab.textContent+=' ✅';
          var ok=document.createElement('button');ok.className='primary';ok.style.padding='8px 12px';ok.textContent='Approve';
          ok.onclick=(function(i){return function(){approveHookRequest(p.id,i);};})(idx);
          var no=document.createElement('button');no.className='secondary';no.style.padding='8px 12px';no.textContent='Decline';
          no.onclick=(function(i){return function(){declineHookRequest(p.id,i);};})(idx);
          row.appendChild(avatar);row.appendChild(lab);row.appendChild(ok);row.appendChild(no);
          hostBox.appendChild(row);
        });
      }
    }
    // Host Request Drawer for pending applicants (full detail view)
    if(mine){
      renderHostRequestDrawer(p);
    }
    var del=document.getElementById('pinDeleteBtn');
    if(del)del.style.display=mine?'':'none';
    try{fillMemoryStrip('pinMemories',p.authorId||null);}catch(e){}
    try{fillSpotsStrip('pinSpots',p.authorId||null);}catch(e){}
    var d=document.getElementById('pinDrawer');if(d)d.classList.remove('hidden');
  }catch(e){}
}
function closePinDetail(){try{_openPinId=null;var d=document.getElementById('pinDrawer');if(d)d.classList.add('hidden');}catch(e){}}
function acceptPinSidequest(){requestPinConnect();}
function requestPinConnect(){
  try{
    if(needProfile('connect'))return;
    var p=findPin(_openPinId);if(!p)return;
    var me={nick:hookNick(),role:(_hookDraft.role)||'traveller',verified:hookVerified(),ts:Date.now()};
    try{me.role=(ETIE.activeRole==='local')?'local':'traveller';}catch(e){}
    if((p.members||[]).some(function(m){return m.nick===me.nick;})){toast('You are already in this hangout.');return;}
    if((p.pending||[]).some(function(r){return r.nick===me.nick;})){toast('Request already sent — waiting for the group.');return;}
    if(isPinExpired(p)){toast('This hook has ended.');return;}
    var cap=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
    if((p.members||[]).length>=Math.min(cap,3)){toast('This group is full ('+cap+' spots).');return;}
    var nowTs=Date.now();
    var reqId=(p.requests||[]).length>0?(p.requests[p.requests.length-1].id||null):null;
    var newReq={id:reqId||uuidv4(),nick:me.nick,role:me.role,verified:me.verified,ts:me.ts,status:'pending',message:'',messageCount:0,createdAt:nowTs,updatedAt:nowTs};
    (p.requests||(p.requests=[])).push(newReq);
    storePin(p);
    openPinDetail(p.id);toast('Request sent — waiting for host approval.');
    renderHostRequestDrawer(p);
  }catch(e){toast('Could not send request.');}
}
function acceptHookRequest(idx){
  try{
    var p=findPin(_openPinId);if(!p||!p.pending||!p.pending[idx])return;
    var req=p.pending[idx];
    if(p.status==='pair'||(p.members||[]).length>=2){
      // 3rd joiner: needs EVERY existing member to accept → group modal
      openGroupModal(p.id,idx);return;
    }
    p.members.push({nick:req.nick,role:req.role,verified:req.verified});
    p.pending.splice(idx,1);
    p.status=(p.members.length>=2)?'pair':'open';
    storePin(p);openPinDetail(p.id);renderMapPins();
    toast('Connected — 1-on-1 hangout on.');
    try{openChatDrawer(p.id);}catch(e){}
  }catch(e){}
}
function declineHookRequest(pinId,idx){
  try{
    var p=findPin(pinId);if(!p||!p.requests||!p.requests[idx])return;
    var req=p.requests[idx];
    if(req.status!=='pending') return;
    req.status='declined';
    req.updatedAt=Date.now();
    storePin(p);openPinDetail(p.id);renderMapPins();toast('Request declined.');
  }catch(e){}
}
function approveHookRequest(pinId,idx){
  try{
    var p=findPin(pinId);if(!p||!p.requests||!p.requests[idx])return;
    var req=p.requests[idx];
    if(req.status!=='pending') return;
    // Check capacity
    var cap=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
    if((p.members||[]).length>=cap){
      toast('This hook is full ('+cap+' spots).');return;
    }
    // Approve the request
    req.status='approved';
    req.updatedAt=Date.now();
    // Add to members
    p.members.push({nick:req.nick,role:req.role,verified:req.verified});
    // Reveal exact location to approved member
    req.locationRevealed=true;
    // Decrement available spots
    p.spotsAvailable=(p.spotsAvailable!==undefined?p.spotsAvailable:cap)-(p.members||[]).length;
    // If full, expire remaining pending requests
    if(p.spotsAvailable<=0){
      p.requests.forEach(function(r){
        if(r.status==='pending' && r.id!==req.id){
          r.status='expired';
          r.updatedAt=Date.now();
          r.expiredReason='full';
        }
      });
    }
    storePin(p);
    openPinDetail(p.id);
    renderMapPins();
    toast('Approved! Exact location revealed to '+req.nick);
    // Notify the approved user (in real app: push notification)
    try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(p.id); }catch(e){}
  }catch(e){toast('Could not approve.');}
}
function renderHostRequestDrawer(p){
  try{
    var drawer=document.getElementById('hostRequestDrawer');
    if(!drawer){
      var pd=document.getElementById('pinDrawer');
      if(pd){
        drawer=document.createElement('div');
        drawer.id='hostRequestDrawer';
        drawer.style.cssText='margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);';
        pd.appendChild(drawer);
      } else return;
    }
    var pending=(p.requests||[]).filter(function(r){return r.status==='pending';});
    var expiredFull=(p.requests||[]).filter(function(r){return r.status==='expired' && r.expiredReason==='full';});
    var approved=(p.requests||[]).filter(function(r){return r.status==='approved';});
    var html='';
    if(pending.length){
      html+='<h4 style="margin:0 0 12px;color:#fff;">📋 Pending Requests ('+pending.length+')</h4>';
      pending.forEach(function(r){
        var idx=p.requests.indexOf(r);
        html+='<div style="display:flex;gap:12px;align-items:center;padding:12px;background:rgba(255,255,255,.05);border-radius:10px;margin-bottom:8px;">'
          +'<div class="avatar" style="width:48px;height:48px;font-size:20px;background:linear-gradient(135deg,#f43f5e,#fb7185);">'+(r.nick||'?').charAt(0).toUpperCase()+'</div>'
          +'<div style="flex:1;">'
          +'<div style="font-weight:600;color:#fff;">'+(r.nick||'Someone')+'</div>'
          +'<div class="small muted">'+(r.role==='local'?'🇭🇰 Local Host':'✈️ Traveller')+(r.verified?' · Verified':'')+'</div>'
          +'<div class="small muted">'+new Date(r.createdAt).toLocaleTimeString()+'</div>'
          +(r.message?'<div class="small" style="margin-top:4px;color:#ffe4e6;">“'+r.message+'”</div>':'')
          +'</div>'
          +'<div style="display:flex;gap:8px;">'
          +'<button class="primary" style="padding:10px 16px;" onclick="approveHookRequest(\''+p.id+'\','+idx+')">Approve</button>'
          +'<button class="secondary" style="padding:10px 16px;" onclick="declineHookRequest(\''+p.id+'\','+idx+')">Decline</button>'
          +'</div>'
          +'</div>';
      });
    }
    if(approved.length){
      html+='<h4 style="margin:16px 0 8px;color:#fff;">✅ Approved ('+approved.length+')</h4>';
      approved.forEach(function(r){
        html+='<div style="padding:12px;background:rgba(34,197,94,.15);border-radius:10px;margin-bottom:8px;border:1px solid rgba(34,197,94,.3);">'
          +'<div style="font-weight:600;color:#22c55e;">'+(r.nick||'Someone')+' — Approved</div>'
          +'<div class="small muted">Location revealed at '+new Date(r.updatedAt).toLocaleTimeString()+'</div>'
          +'</div>';
      });
    }
    if(expiredFull.length){
      html+='<h4 style="margin:16px 0 8px;color:#fff;">⚠️ Hook Filled — '+expiredFull.length+' requests expired</h4>';
      html+='<div style="padding:16px;background:rgba(251,113,133,.15);border-radius:10px;border:1px solid rgba(251,113,133,.3);text-align:center;">'
        +'<div style="font-weight:600;color:#fb7185;margin-bottom:8px;">This hook just filled up!</div>'
        +'<div class="small muted" style="margin-bottom:12px;">Want to host the next one?</div>'
        +'<button class="primary" style="padding:12px 24px;" onclick="hostNextHook(\''+p.id+'\')">Host Next Hook</button>'
        +'</div>';
    }
    drawer.innerHTML=html;
  }catch(e){}
}
function hostNextHook(pinId){
  try{
    var p=findPin(pinId);
    if(!p) return;
    // Pre-fill the drop hook sheet with current category/neighborhood
    _hookDraft={category:p.category,role:'local',window:'now',capacity:3};
    var ht0=document.getElementById('hookTitle');if(ht0)ht0.value='';
    var hl=document.getElementById('hookLocation');if(hl)hl.value=p.location;
    selectHookCategory(null,p.category);
    selectHookWindow(null,'now');
    hookCap(0);
    renderHookRoleLine();
    openDropHook();
    toast('Create your next hook — same neighborhood, same vibe!');
  }catch(e){toast('Could not open hook sheet.');}
}
function deletePinSidequest(){
  try{
    if(!_openPinId)return;
    var p=findPin(_openPinId);
    ETIE.mapPins=(ETIE.mapPins||[]).filter(function(x){return x&&x.id!==_openPinId;});
    try{if(window.EtieCloud&&window.EtieCloud.deletePin&&p)window.EtieCloud.deletePin(p);}catch(e){}
    saveState();closePinDetail();renderMapPins();toast('Pin deleted.');
  }catch(e){}
}
// ---- Mutual Consensus Group Expansion: 3rd joiner needs ALL members to accept ----
var _groupCtx={pinId:null,reqIdx:0};
function openGroupModal(pinId,reqIdx){
  try{
    var p=findPin(pinId);if(!p||!p.pending||!p.pending[reqIdx])return;
    _groupCtx={pinId:pinId,reqIdx:reqIdx};
    var req=p.pending[reqIdx];
    var who=document.getElementById('groupJoiner');if(who)who.textContent=(req.nick||'Someone')+' wants to join your hangout. Accept & expand group?';
    renderGroupApprovals();
    var o=document.getElementById('groupModal');if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeGroupModal(){try{var o=document.getElementById('groupModal');if(o)o.classList.add('hidden');}catch(e){}}
function renderGroupApprovals(){
  try{
    var p=findPin(_groupCtx.pinId);if(!p)return;
    var req=p.pending[_groupCtx.reqIdx];if(!req)return;
    var box=document.getElementById('groupMembers');if(!box)return;
    box.innerHTML='';
    (p.members||[]).forEach(function(m){
      var ok=(req.approvals||[]).indexOf(m.nick)!==-1;
      var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;margin-top:8px;';
      var lab=document.createElement('span');lab.className='small';lab.style.flex='1';
      lab.textContent=(m.role==='local'?'🇭🇰 ':'✈️ ')+m.nick+(ok?' — accepted ✅':'');
      var b=document.createElement('button');b.className=ok?'secondary':'primary';b.style.padding='8px 12px';b.textContent=ok?'Accepted':'Accept';
      b.onclick=(function(nick){return function(){approveGroupJoin(nick);};})(m.nick);
      row.appendChild(lab);row.appendChild(b);box.appendChild(row);
    });
  }catch(e){}
}
function approveGroupJoin(memberNick){
  try{
    var p=findPin(_groupCtx.pinId);if(!p)return;
    var req=p.pending[_groupCtx.reqIdx];if(!req)return;
    req.approvals=req.approvals||[];
    if(req.approvals.indexOf(memberNick)===-1)req.approvals.push(memberNick);
    var allOk=(p.members||[]).every(function(m){return req.approvals.indexOf(m.nick)!==-1;});
    if(allOk){
      var cap2=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
      if((p.members||[]).length>=Math.min(cap2,3)){toast('This group is full ('+cap2+' spots).');return;}
      p.members.push({nick:req.nick,role:req.role,verified:req.verified});
      p.pending.splice(_groupCtx.reqIdx,1);
      p.status='trio';
      storePin(p);closeGroupModal();renderMapPins();openPinDetail(p.id);
      toast('Everyone accepted — group expanded to 3.');
      try{openChatDrawer(p.id);}catch(e){}
    }else{storePin(p);renderGroupApprovals();toast('Waiting on the other member…');}
  }catch(e){}
}
// ---- Hook group chat drawer (Supabase etie_hook_messages realtime, local fallback) ----
var _chatPinId=null,_chatUnsub=null;
function openChatDrawer(pinId){
  try{
    var p=findPin(pinId);if(!p){toast('Hook not found.');return;}
    _chatPinId=pinId;
    var t=document.getElementById('chatHookTitle');if(t)t.textContent=p.location||'Group chat';
    var s=document.getElementById('chatHookSub');
    if(s)s.textContent=((p.members||[]).map(function(m){return m.nick;}).join(' · ')||'Open hook');
    renderQuestBanner(p);
    renderHookChat();
    var d=document.getElementById('chatDrawer');if(d)d.classList.remove('hidden');
    try{fillMemoryStrip('chatMemories',p.authorId||null);}catch(e){}
    try{
      if(window.EtieCloud&&window.EtieCloud.subscribeHookChat){
        try{if(_chatUnsub)_chatUnsub();}catch(e){}
        _chatUnsub=window.EtieCloud.subscribeHookChat(pinId,function(row){
          try{
            var pp=findPin(pinId);if(!pp)return;
            var rts=0;try{rts=new Date(row.created_at).getTime();}catch(e){}
            var arr=pp.chat||(pp.chat=[]);
            var dup=arr.some(function(m){return m&&m.text===row.text&&m.nick===(row.sender_nick||'Someone')&&Math.abs((m.ts||0)-rts)<8000;});
            if(!dup){arr.push({nick:row.sender_nick||'Someone',role:row.sender_role||'traveller',text:row.text||'',ts:rts||Date.now()});saveState();}
            if(_chatPinId===pinId)renderHookChat();
          }catch(e){}
        });
      }
    }catch(e){}
  }catch(e){}
}
function closeChatDrawer(){try{_chatPinId=null;try{if(_chatUnsub)_chatUnsub();}catch(e){}_chatUnsub=null;var d=document.getElementById('chatDrawer');if(d)d.classList.add('hidden');}catch(e){}}
function renderHookChat(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    var box=document.getElementById('chatMsgList');if(!box)return;
    box.innerHTML='';
    var me=hookNick();
    (p.chat||[]).forEach(function(m){
      try{
        var d=document.createElement('div');
        var mine=m&&m.nick===me;
        d.className='hchat'+(mine?' me':'');
        var w=document.createElement('span');w.className='who';
        w.textContent=((m.role==='local'?'🇭🇰 ':'✈️ ')+(m.nick||'Someone'));
        d.appendChild(w);d.appendChild(document.createTextNode(m.text||''));
        box.appendChild(d);
      }catch(e){}
    });
    if(!(p.chat||[]).length){var e=document.createElement('div');e.className='muted small';e.textContent='No messages yet — say hi to the group.';box.appendChild(e);}
    try{box.scrollTop=box.scrollHeight;}catch(e2){}
  }catch(e){}
}
var _areasCollapsed=false;
function toggleAreaSidebar(){
  try{
    _areasCollapsed=!_areasCollapsed;
    var b=document.getElementById('areaList');if(b)b.style.display=_areasCollapsed?'none':'';
    var t=document.getElementById('areaToggle');if(t)t.textContent=_areasCollapsed?'▸ Areas':'▾ Areas';
  }catch(e){}
}
function flyToArea(lat,lng,label){
  try{
    if(!window.L||!_map)return;
    _map.setMaxBounds([[lat-1.1,lng-1.8],[lat+1.1,lng+1.8]]);
    _map.flyTo([lat,lng],13,{duration:1.0});
    toast(label||'Flying there.');
  }catch(e){}
}
function toggleGlobalView(){
  try{
    if(!window.L||!_map)return;
    var btn=document.querySelector('.fab-globe');
    var isGlobal=_map.getZoom()<5;
    if(!isGlobal){
      // Go global
      _map.setMaxBounds([[-85,-180],[85,180]]);
      _map.flyTo([22.3,114.1],3,{duration:1.5});
      if(btn)btn.classList.add('active');
      toast('🌍 Global view — drag to explore');
    }else{
      // Return to HK
      var a=getAnchor();
      _map.setMaxBounds([[-85,-180],[85,180]]);
      _map.flyTo([a.lat,a.lng],HK_ZOOM,{duration:1.5});
      if(btn)btn.classList.remove('active');
      toast('🇭🇰 Back to Hong Kong');
    }
  }catch(e){}
}
function flyToArea(lat,lng,label){
  try{
    if(!window.L||!_map)return;
    _map.setMaxBounds([[lat-1.1,lng-1.8],[lat+1.1,lng+1.8]]);
    _map.flyTo([lat,lng],13,{duration:1.0});
    toast(label||'Flying there.');
  }catch(e){}
}
function renderAreaSidebar(){
  try{
    var box=document.getElementById('areaList');if(!box)return;
    box.innerHTML='';
    var a=getAnchor();
    var me=document.createElement('div');me.className='area-row area-me';
    me.innerHTML='<div><strong></strong><br><span class="muted small">your map home</span></div>';
    me.querySelector('strong').textContent='📍 '+(a.label||'Around you');
    me.onclick=function(){flyToArea(a.lat,a.lng,a.label||'Back home.');};
    box.appendChild(me);
    var groups={};
    (visibleMapPins()||[]).forEach(function(p){
      try{
        var k=(Math.round(p.lat*2)/2).toFixed(1)+','+(Math.round(p.lng*2)/2).toFixed(1);
        var g=groups[k]||(groups[k]={lat:0,lng:0,n:0,people:{},labels:{},pins:[]});
        g.lat+=p.lat;g.lng+=p.lng;g.n++;
        (p.members||[]).forEach(function(m){if(m&&m.nick)g.people[m.nick]=1;});
        var lb=(p.location||p.district||'Hook spot');
        g.labels[lb]=(g.labels[lb]||0)+1;
        g.pins.push(p);
      }catch(e){}
    });
    var keys=Object.keys(groups).sort(function(x,y){return groups[y].n-groups[x].n;});
    if(!keys.length){var e=document.createElement('div');e.className='muted small';e.textContent='No connections anywhere yet.';box.appendChild(e);}
    keys.slice(0,12).forEach(function(k){
      try{
        var g=groups[k];
        var top=Object.keys(g.labels).sort(function(x,y){return g.labels[y]-g.labels[x];})[0]||'Hook area';
        var np=Object.keys(g.people).length;
        var row=document.createElement('div');row.className='area-row';
        row.innerHTML='<div><strong></strong><br><span class="muted small"></span></div>';
        row.querySelector('strong').textContent=top.length>30?top.slice(0,29)+'…':top;
        row.querySelector('span.muted').textContent=g.n+' hook'+(g.n===1?'':'s')+(np?(' · '+np+' '+(np===1?'person':'people')):'');
        row.onclick=(function(la,ln,lb){return function(){flyToArea(la,ln,lb);};})(g.lat/g.n,g.lng/g.n,top);
        box.appendChild(row);
      }catch(e){}
    });
    var h=document.getElementById('areaCount');
    if(h)h.textContent=keys.length?keys.length+' area'+(keys.length===1?'':'s'):'';
  }catch(e){}
}
function renderHookChatList(){
  try{
    var box=document.getElementById('hookChatList');if(!box)return;
    box.innerHTML='';
    var me=hookNick();
    var mine=allMapPins().filter(function(p){return (p.members||[]).some(function(m){return m.nick===me;});});
    if(!mine.length){var e=document.createElement('div');e.className='muted small';e.textContent='No hook chats yet — connect on a pin to start one.';box.appendChild(e);return;}
    mine.forEach(function(p){
      try{
        var last=(p.chat||[])[(p.chat||[]).length-1];
        var row=document.createElement('div');row.className='list-item';row.style.cursor='pointer';
        row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
        row.querySelector('strong').textContent=mapCatEmoji(p.category)+' '+(p.title||p.location||'Hook');
        row.querySelector('span.muted').textContent=last?((last.nick||'')+': '+(last.text||'').slice(0,60)):'Tap to open chat';
        row.querySelector('span.status').textContent=groupBadgeText(p);
        (function(pin){
          if(isPinExpired(pin)){row.onclick=function(){showScreen('map');openPinDetail(pin.id);};}
          else{row.onclick=function(){showScreen('map');openChatDrawer(pin.id);};}
        })(p);
        box.appendChild(row);
      }catch(e){}
    });
  }catch(e){}
}
// ---- Initiative 2: hangout-window photo verification + passion logging ----
var _logPinId=null,_logFile=null,_logTakenAt=0;
function fmtWhen(ts){try{return new Date(ts).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'});}catch(e){return '';};}
function pinWindow(p){
  try{
    var s=new Date(p.starts_at||p.ts||Date.now()).getTime();
    var e=new Date(p.ends_at||((p.ts||Date.now())+6*3600*1000)).getTime();
    return {start:s,end:e};
  }catch(e){var n=Date.now();return {start:n,end:n+6*3600*1000};}
}
function openLogSheet(pinId){
  try{
    var p=findPin(pinId);if(!p){toast('Hook not found.');return;}
    var me=hookNick();
    if(!(p.members||[]).some(function(m){return m.nick===me;})){toast('Join this hook first to log photos.');return;}
    _logPinId=pinId;_logFile=null;_logTakenAt=0;
    var t=document.getElementById('logHookName');if(t)t.textContent=p.location||'Hook';
    var w=pinWindow(p);
    var wt=document.getElementById('logWindow');if(wt)wt.textContent='Hangout window: '+fmtWhen(w.start)+' → '+fmtWhen(w.end)+' (+2h grace for the badge)';
    var sel=document.getElementById('logActivity');
    if(sel){for(var i=0;i<sel.options.length;i++){if(sel.options[i].text===p.category){sel.selectedIndex=i;break;}}}
    var pv=document.getElementById('logPreview');if(pv)pv.innerHTML='';
    var pi=document.getElementById('logPhotoInput');if(pi)pi.value='';
    var btn=document.getElementById('logUploadBtn');if(btn){btn.disabled=false;btn.textContent='Upload Log';}
    updateOutboxNote();
    var o=document.getElementById('logHangoutModal');if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeLogSheet(){try{_logPinId=null;_logFile=null;var o=document.getElementById('logHangoutModal');if(o)o.classList.add('hidden');}catch(e){}}
function populateLogTagDropdown(p){
  try{
    var sel=document.getElementById('logTaggedMember');
    if(!sel) return;
    var me=hookNick();
    var opts=['<option value="">— No tag —</option>'];
    (p.members||[]).forEach(function(m){
      if(m.nick!==me){
        opts.push('<option value="'+m.nick+'">'+(m.role==='local'?'🇭🇰 ':'✈️ ')+m.nick+'</option>');
      }
    });
    (p.pending||[]).forEach(function(r){
      if(r.nick!==me){
        opts.push('<option value="'+r.nick+'">'+(r.role==='local'?'🇭🇰 ':'✈️ ')+r.nick+' (pending)</option>');
      }
    });
    sel.innerHTML=opts.join('');
  }catch(e){}
}
function openLogSheet(pinId){
  try{
    var p=findPin(pinId);if(!p){toast('Hook not found.');return;}
    var me=hookNick();
    if(!(p.members||[]).some(function(m){return m.nick===me;})){toast('Join this hook first to log photos.');return;}
    _logPinId=pinId;_logFile=null;_logTakenAt=0;
    var t=document.getElementById('logHookName');if(t)t.textContent=p.location||'Hook';
    var w=pinWindow(p);
    var wt=document.getElementById('logWindow');if(wt)wt.textContent='Hangout window: '+fmtWhen(w.start)+' → '+fmtWhen(w.end)+' (+2h grace for the badge)';
    var sel=document.getElementById('logActivity');
    if(sel){for(var i=0;i<sel.options.length;i++){if(sel.options[i].text===p.category){sel.selectedIndex=i;break;}}}
    populateLogTagDropdown(p);
    var pv=document.getElementById('logPreview');if(pv)pv.innerHTML='';
    var pi=document.getElementById('logPhotoInput');if(pi)pi.value='';
    var btn=document.getElementById('logUploadBtn');if(btn){btn.disabled=false;btn.textContent='Upload Log';}
    updateOutboxNote();
    var o=document.getElementById('logHangoutModal');if(o)o.classList.remove('hidden');
  }catch(e){}
}
function handleLogPhoto(input){
  try{
    var f=input.files&&input.files[0];if(!f)return;
    _logFile=f;_logTakenAt=f.lastModified||Date.now();
    var pv=document.getElementById('logPreview');
    if(pv){pv.innerHTML='';var im=document.createElement('img');im.src=URL.createObjectURL(f);im.style.cssText='width:100%;max-height:180px;object-fit:cover;border-radius:12px;';pv.appendChild(im);
      var cap=document.createElement('div');cap.className='muted small';cap.textContent='Taken: '+fmtWhen(_logTakenAt);pv.appendChild(cap);}
  }catch(e){}
}
function fileToDataURL(file,cb){try{var r=new FileReader();r.onload=function(e){cb(e.target.result);};r.onerror=function(){cb(null);};r.readAsDataURL(file);}catch(e){cb(null);}}
function dataURLtoFile(du,name){
  try{
    var arr=du.split(','),mime=(arr[0].match(/:(.*?);/)||[])[1]||'image/jpeg';
    var bstr=atob(arr[1]),n=bstr.length,u8=new Uint8Array(n);
    for(var i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
    return new File([u8],name||'log.jpg',{type:mime});
  }catch(e){return null;}
}
function queueLog(hookId,act,taken,nick,du){
  try{
    ETIE.photoOutbox=ETIE.photoOutbox||[];
    ETIE.photoOutbox.push({hookId:hookId,activity:act,takenAt:taken,nick:nick,dataUrl:du||null,ts:Date.now()});
    saveState();updateOutboxNote();
  }catch(e){}
}
function updateOutboxNote(){
  try{
    var n=document.getElementById('logOutboxNote');if(!n)return;
    var q=(ETIE.photoOutbox||[]).length;
    n.style.display=q?'':'none';
    if(q)n.textContent=q+' photo'+(q===1?'':'s')+' queued for upload (offline).';
  }catch(e){}
}
function submitHangoutLog(){
  try{
    var p=findPin(_logPinId);if(!p){toast('Hook not found.');return;}
    if(!_logFile){toast('Choose a photo first.');return;}
    var sel=document.getElementById('logActivity');
    var act=sel?sel.options[sel.selectedIndex].text:'';
    var taggedSel=document.getElementById('logTaggedMember');
    var taggedNick=taggedSel?taggedSel.value:'';
    var taken=_logTakenAt||Date.now();
    var w=pinWindow(p);
    var ok=taken>=w.start-5*60*1000&&taken<=w.end+2*3600*1000;
    var pid=p.cloudId||p.id, me=hookNick(), file=_logFile;
    var btn=document.getElementById('logUploadBtn');
    var restore=function(){if(btn){btn.disabled=false;btn.textContent='Upload Log';}};
    var finishUpload=function(url){
      try{
        restore();
        if(!url){fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Upload failed — queued for retry.');closeLogSheet();updateOutboxNote();});return;}
        var logEntry={hookId:pid,nick:me,photoUrl:url,activity:act,takenAt:new Date(taken).toISOString(),verified:ok};
        if(taggedNick){
          logEntry.taggedUserId=taggedNick;
          logEntry.taggedNickname=taggedNick;
          logEntry.status='pending';
        } else {
          logEntry.status='confirmed';
          logEntry.confirmedAt=new Date().toISOString();
        }
        window.EtieCloud.pushHangoutLog(logEntry).then(function(saved){
          if(taggedNick){
            toast('Log uploaded — handshake request sent to '+taggedNick+' (24h to confirm).');
          } else {
            if(ok&&saved)bumpPassion(act);
            toast(ok?('⚡ Verified Live Log · '+fmtWhen(taken)):'Logged — outside the window, no badge this time.');
          }
          closeLogSheet();renderPinLogs(p.id);
        });
      }catch(e){restore();}
    };
    if(!navigator.onLine){fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Offline — queued, will upload on reconnect.');closeLogSheet();updateOutboxNote();});return;}
    if(btn){btn.disabled=true;btn.textContent='Uploading…';}
    if(window.EtieCloud&&window.EtieCloud.uploadPhoto){
      window.EtieCloud.uploadPhoto(file,'log').then(function(url){finishUpload(url||null);}).catch(function(){
        fileToDataURL(file,function(du){restore();queueLog(pid,act,taken,me,du);toast('Upload failed — queued for retry.');closeLogSheet();updateOutboxNote();});
      });
    }else{
      fileToDataURL(file,function(du){restore();queueLog(pid,act,taken,me,du);toast('Offline — queued, will upload on reconnect.');closeLogSheet();updateOutboxNote();});
    }
  }catch(e){}
}
function processPhotoOutbox(){
  try{
    var q=ETIE.photoOutbox||[];if(!q.length)return;
    if(!navigator.onLine)return;
    if(!window.EtieCloud||!window.EtieCloud.uploadPhoto||!isSignedIn())return;
    var it=q[0];
    var pin=null;
    try{
      var all=allMapPins()||[];
      for(var i=0;i<all.length;i++){if(all[i]&&(all[i].id===it.hookId||all[i].cloudId===it.hookId)){pin=all[i];break;}}
    }catch(e){}
    if(!pin){ETIE.photoOutbox.shift();saveState();setTimeout(processPhotoOutbox,500);return;}
    if(!it.dataUrl){ETIE.photoOutbox.shift();saveState();setTimeout(processPhotoOutbox,500);return;}
    var f=dataURLtoFile(it.dataUrl,'log.jpg');
    if(!f){ETIE.photoOutbox.shift();saveState();setTimeout(processPhotoOutbox,500);return;}
    window.EtieCloud.uploadPhoto(f,'log').then(function(url){
      if(!url){setTimeout(processPhotoOutbox,10000);return;}
      var w=pinWindow(pin);
      var vok=it.takenAt>=w.start-5*60*1000&&it.takenAt<=w.end+2*3600*1000;
      window.EtieCloud.pushHangoutLog({hookId:(pin.cloudId||pin.id),nick:it.nick,photoUrl:url,activity:it.activity,takenAt:new Date(it.takenAt).toISOString(),verified:vok}).then(function(saved){
        if(vok&&saved)bumpPassion(it.activity);
        ETIE.photoOutbox.shift();saveState();updateOutboxNote();
        if((ETIE.photoOutbox||[]).length)setTimeout(processPhotoOutbox,1500);
        else toast('Queued logs uploaded.');
      });
    }).catch(function(){setTimeout(processPhotoOutbox,10000);});
  }catch(e){}
}
// ---- Handshake / Co-tagging ----
var _handshakeLogId=null;
var _handshakeTimer=null;
function bumpPassion(act){
  try{
    if(!act)return;
    var key=act.toLowerCase().replace(/[^a-z]/g,'');
    if(!ETIE.traveller.activityStats)ETIE.traveller.activityStats={};
    ETIE.traveller.activityStats[key]=(ETIE.traveller.activityStats[key]||0)+1;
    var count=ETIE.traveller.activityStats[key];
    var badge=act+ (count===1?' Regular':' ('+count+' Verified Logs)');
    if(count===1 || count===3 || count===5 || count===10){
      toast('🏅 '+badge);
    }
    saveState();
    try{if(typeof renderProfile==='function')renderProfile();}catch(e){}
  }catch(e){}
}
function openHandshakeModal(log){
  try{
    _handshakeLogId=log.id;
    var card=document.getElementById('handshakeCard');
    if(card){
      card.innerHTML='<img src="'+log.photo_url+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:12px;">'
        +'<div style="font-weight:600;color:#fff;">'+(log.activity||'Hangout')+'</div>'
        +'<div class="muted small">with '+log.nickname+' · '+fmtWhen(new Date(log.taken_at).getTime())+'</div>';
    }
    var inp=document.getElementById('handshakeNoteInput');
    if(inp){inp.value=''; inp.placeholder='One sentence: what made this hangout special?';}
    var cnt=document.getElementById('handshakeCount');
    if(cnt)cnt.textContent='0';
    if(inp){
      inp.oninput=function(){var c=document.getElementById('handshakeCount');if(c)c.textContent=this.value.length;};
    }
    startHandshakeTimer(log);
    var o=document.getElementById('handshakeModal');if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeHandshakeModal(){try{_handshakeLogId=null;if(_handshakeTimer){clearInterval(_handshakeTimer);_handshakeTimer=null;}var o=document.getElementById('handshakeModal');if(o)o.classList.add('hidden');}catch(e){}}
// ---- Quest / Custom Quest Engine ----
var _questPinId=null;
var _questStep=1;
var _questPhotos=[null,null];
var _questStream=null;
var _questFacing='environment';
function openSetQuestModal(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    _questPinId=p.id;
    var inp=document.getElementById('setQuestTitle');
    if(inp){inp.value=''; inp.placeholder='e.g. Best group selfie at sunset';}
    var o=document.getElementById('setQuestModal');if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeSetQuestModal(){try{var o=document.getElementById('setQuestModal');if(o)o.classList.add('hidden');}catch(e){}}
function saveCustomQuest(){
  try{
    var inp=document.getElementById('setQuestTitle');
    var title=inp?inp.value.trim():'';
    if(!title){toast('Enter a quest title.');return;}
    if(title.length>60){toast('Max 60 characters.');return;}
    var p=findPin(_questPinId);if(!p)return;
    p.quest={title:title,setBy:hookNick(),setAt:Date.now(),completed:false};
    storePin(p);
    closeSetQuestModal();
    renderQuestBanner(p);
    toast('Quest set: '+title);
  }catch(e){toast('Could not set quest.');}
}
function openQuestDrawer(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    // Configure Quest of the Week (static for now, could come from backend)
    var questWeek={
      title:'Salsa & Bachata Night — Find the Hidden Speakeasy',
      desc:'Dance your way through a secret salsa spot in Soho. Find the unmarked door, order the house cocktail, and learn 3 moves from a local.'
    };
    document.getElementById('questWeekTitle').textContent=questWeek.title;
    document.getElementById('questWeekDesc').textContent=questWeek.desc;
    document.getElementById('questWeekCard').style.display='block';
    document.getElementById('customQuestInput').classList.add('hidden');
    document.getElementById('activeQuestDisplay').classList.add('hidden');
    var o=document.getElementById('questDrawer');
    if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeQuestDrawer(){
  try{var o=document.getElementById('questDrawer');if(o)o.classList.add('hidden');}catch(e){}
}
function acceptCuratedQuest(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    var questWeek={
      title:'Salsa & Bachata Night — Find the Hidden Speakeasy',
      desc:'Dance your way through a secret salsa spot in Soho. Find the unmarked door, order the house cocktail, and learn 3 moves from a local.'
    };
    p.quest={title:questWeek.title,setBy:'Side Quest',setAt:Date.now(),completed:false};
    storePin(p);
    closeQuestDrawer();
    renderQuestBanner(p);
    // Pin quest banner to chat
    pinQuestToChat(p);
    toast('Quest accepted: '+questWeek.title);
  }catch(e){toast('Could not accept quest.');}
}
function openCustomQuestInput(){
  try{
    document.getElementById('questWeekCard').style.display='none';
    document.getElementById('customQuestInput').classList.remove('hidden');
    var inp=document.getElementById('customQuestTitle');
    if(inp){inp.value=''; inp.focus();}
  }catch(e){}
}
function closeCustomQuestInput(){
  try{
    document.getElementById('customQuestInput').classList.add('hidden');
    document.getElementById('questWeekCard').style.display='block';
  }catch(e){}
}
function acceptCustomQuest(){
  try{
    var inp=document.getElementById('customQuestTitle');
    var title=inp?inp.value.trim():'';
    if(!title){toast('Enter a quest title.');return;}
    if(title.length>60){toast('Max 60 characters.');return;}
    var p=findPin(_chatPinId);if(!p)return;
    p.quest={title:title,setBy:hookNick(),setAt:Date.now(),completed:false};
    storePin(p);
    closeQuestDrawer();
    renderQuestBanner(p);
    pinQuestToChat(p);
    toast('Custom quest set: '+title);
  }catch(e){toast('Could not set quest.');}
}
function pinQuestToChat(p){
  try{
    var q=p?.quest;if(!q)return;
    var box=document.getElementById('chatMsgList');if(!box)return;
    // Remove existing quest banner
    var existing=box.querySelector('.quest-pinned-banner');
    if(existing)existing.remove();
    // Create pinned banner
    var banner=document.createElement('div');
    banner.className='quest-pinned-banner';
    banner.innerHTML='<span class="quest-icon">🏆</span>'
      +'<div class="quest-info"><div class="quest-title">'+q.title+'</div>'
      +'<div class="quest-meta">Set by '+q.setBy+' · '+fmtWhen(q.setAt)+'</div></div>'
      +'<button class="quest-complete-btn primary" onclick="openQuestCamera()">📸 Complete & Take Snap</button>';
box.insertBefore(banner,box.firstChild);
    box.scrollTop=0;
  }catch(e){}
}
function renderQuestBanner(p){
  try{
    var banner=document.getElementById('questBanner');
    if(!banner)return;
    var q=p?.quest;
    if(!q){banner.classList.add('hidden');return;}
    banner.classList.remove('hidden');
    var titleEl=banner.querySelector('.quest-title');
    var subEl=banner.querySelector('.quest-sub');
    var actionBtn=banner.querySelector('.quest-action');
    var completeBtn=banner.querySelector('.quest-complete');
    if(titleEl)titleEl.textContent=q.title;
    if(subEl)subEl.textContent='Set by '+q.setBy+' · '+fmtWhen(q.setAt);
    if(actionBtn)actionBtn.style.display=q.completed?'none':'inline-flex';
    if(completeBtn)completeBtn.style.display=q.completed?'none':'inline-flex';
  }catch(e){}
}
function openQuestCamera(){
  try{
    var p=findPin(_chatPinId);if(!p||!p.quest||p.quest.completed){toast('No active quest.');return;}
    _questPinId=p.id;
    _questStep=1;
    _questPhotos=[null,null];
    _questFacing='environment';
    var stepEl=document.getElementById('questCamStep');
    var labelEl=document.getElementById('questCamLabel');
    var guidanceEl=document.getElementById('questCamGuidance');
    var hintEl=document.getElementById('questCamHint');
    var video=document.getElementById('questVideo');
    var canvas=document.getElementById('questCanvas');
    var captured=document.getElementById('questCaptured');
    var capturedImg=document.getElementById('questCapturedImg');
    var overlay=document.getElementById('questCamOverlay');
    var retakeBtn=document.getElementById('questRetakeBtn');
    var nextBtn=document.getElementById('questNextBtn');
    if(stepEl)stepEl.textContent='1';
    if(labelEl)labelEl.textContent='Step 1: Group/Environment (rear camera)';
    if(guidanceEl)guidanceEl.textContent='📷 Frame the group & surroundings';
    if(hintEl)hintEl.textContent='Tap the screen or press Capture';
    if(video){video.style.display='none'; video.srcObject=null;}
    if(canvas){canvas.style.display='none';}
    if(captured){captured.style.display='none';}
    if(overlay){overlay.style.display='flex';}
    if(retakeBtn){retakeBtn.classList.remove('show');}
    if(nextBtn){nextBtn.textContent='Capture'; nextBtn.disabled=false;}
    startQuestCamera();
    var o=document.getElementById('questCameraModal');if(o)o.classList.remove('hidden');
  }catch(e){toast('Could not open camera.');}
}
function startQuestCamera(){
  try{
    var video=document.getElementById('questVideo');
    if(!video) return;
    var constraints={video:{facingMode:{exact:_questFacing}},audio:false};
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream){
      _questStream=stream;
      video.srcObject=stream;
      video.style.display='block';
      video.onloadedmetadata=function(){video.play();};
    }).catch(function(err){
      console.warn('Camera error:',err);
      toast('Camera access denied or unavailable.');
    });
  }catch(e){}
}
function stopQuestCamera(){
  try{if(_questStream){_questStream.getTracks().forEach(function(t){t.stop();});_questStream=null;}}catch(e){}
}
function captureQuestPhoto(){
  try{
    var video=document.getElementById('questVideo');
    var canvas=document.getElementById('questCanvas');
    var captured=document.getElementById('questCaptured');
    var capturedImg=document.getElementById('questCapturedImg');
    var overlay=document.getElementById('questCamOverlay');
    var retakeBtn=document.getElementById('questRetakeBtn');
    var nextBtn=document.getElementById('questNextBtn');
    if(!video||!canvas)return;
    var ctx=canvas.getContext('2d');
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    _questPhotos[_questStep-1]=canvas.toDataURL('image/jpeg',0.85);
    video.style.display='none';
    canvas.style.display='none';
    if(captured && capturedImg){
      capturedImg.src=_questPhotos[_questStep-1];
      captured.style.display='flex';
    }
    if(overlay)overlay.style.display='none';
    if(retakeBtn)retakeBtn.classList.add('show');
    if(nextBtn){
      if(_questStep===1){
        nextBtn.textContent='Next: Selfie';
      }else{
        nextBtn.textContent='Finish & Save';
      }
    }
  }catch(e){}
}
function retakeQuestPhoto(){
  try{
    var video=document.getElementById('questVideo');
    var canvas=document.getElementById('questCanvas');
    var captured=document.getElementById('questCaptured');
    var overlay=document.getElementById('questCamOverlay');
    var retakeBtn=document.getElementById('questRetakeBtn');
    var nextBtn=document.getElementById('questNextBtn');
    _questPhotos[_questStep-1]=null;
    if(video){video.style.display='block';}
    if(canvas){canvas.style.display='none';}
    if(captured){captured.style.display='none';}
    if(overlay){overlay.style.display='flex';}
    if(retakeBtn)retakeBtn.classList.remove('show');
    if(nextBtn){nextBtn.textContent='Capture'; nextBtn.disabled=false;}
  }catch(e){}
}
function nextQuestPhotoStep(){
  try{
    if(!_questPhotos[_questStep-1]){
      captureQuestPhoto();
      return;
    }
    if(_questStep===1){
      _questStep=2;
      _questFacing='user';
      var stepEl=document.getElementById('questCamStep');
      var labelEl=document.getElementById('questCamLabel');
      var guidanceEl=document.getElementById('questCamGuidance');
      var hintEl=document.getElementById('questCamHint');
      if(stepEl)stepEl.textContent='2';
      if(labelEl)labelEl.textContent='Step 2: Selfie (front camera)';
      if(guidanceEl)guidanceEl.textContent='🤳 Quick selfie!';
      if(hintEl)hintEl.textContent='Tap the screen or press Capture';
      stopQuestCamera();
      setTimeout(startQuestCamera,300);
      var retakeBtn=document.getElementById('questRetakeBtn');
      var nextBtn=document.getElementById('questNextBtn');
      if(retakeBtn)retakeBtn.classList.remove('show');
      if(nextBtn){nextBtn.textContent='Capture'; nextBtn.disabled=false;}
    }else{
      // Both photos captured, stitch and upload
      finishQuestSnap();
    }
  }catch(e){}
}
function finishQuestSnap(){
  try{
    stopQuestCamera();
    var p=findPin(_questPinId);if(!p||!p.quest)return;
    if(!_questPhotos[0] || !_questPhotos[1]){toast('Both photos required.');return;}
    // Stitch side-by-side
    var canvas=document.createElement('canvas');
    var ctx=canvas.getContext('2d');
    var img1=new Image();
    var img2=new Image();
    img1.onload=function(){
      img2.onload=function(){
        var h=Math.max(img1.height,img2.height);
        canvas.width=img1.width+img2.width;
        canvas.height=h;
        ctx.drawImage(img1,0,0,img1.width,h);
        ctx.drawImage(img2,img1.width,0,img2.width,h);
        var dataUrl=canvas.toDataURL('image/jpeg',0.85);
        uploadQuestResult(p, dataUrl);
      };
      img2.src=_questPhotos[1];
    };
    img1.src=_questPhotos[0];
    closeQuestCamera();
  }catch(e){toast('Failed to stitch photos.');}
}
function uploadQuestResult(p, dataUrl){
  try{
    var me=hookNick();
    var file=dataURLtoFile(dataUrl,'quest.jpg');
    if(!file){toast('Failed to prepare image.');return;}
    var btn=document.getElementById('questNextBtn');
    if(btn){btn.disabled=true;btn.textContent='Uploading…';}
    var act=p.quest?.title||'Quest';
    var taken=Date.now();
    var w=pinWindow(p);
    var ok=taken>=w.start-5*60*1000&&taken<=w.end+2*3600*1000;
    var pid=p.cloudId||p.id;
    var restore=function(){if(btn){btn.disabled=false;btn.textContent='Finish & Save';}};
    window.EtieCloud.uploadPhoto(file,'quest').then(function(url){
      if(!url){restore();fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Upload failed — queued.');updateOutboxNote();});return;}
      var logEntry={
        hookId:pid,nick:me,photoUrl:url,activity:act,takenAt:new Date(taken).toISOString(),
        verified:ok,questTitle:p.quest.title,questCompleted:true
      };
      window.EtieCloud.pushHangoutLog(logEntry).then(function(saved){
        if(ok&&saved)bumpPassion(act);
        // Mark quest completed
        p.quest.completed=true;p.quest.completedAt=Date.now();p.quest.completedBy=me;
        storePin(p);
        renderQuestBanner(p);
        toast('🏆 Quest completed! ⚡ Quest Completed: '+p.quest.title);
        renderPinLogs(p.id);
      });
    }).catch(function(){
      restore();
      fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Upload failed — queued.');updateOutboxNote();});
    });
  }catch(e){toast('Upload failed.');}
}
function closeQuestCamera(){
  try{stopQuestCamera();_questPinId=null;_questStep=1;_questPhotos=[null,null];_questFacing='environment';
  var o=document.getElementById('questCameraModal');if(o)o.classList.add('hidden');}catch(e){}
}
function dataURLtoFile(du,name){
  try{
    var arr=du.split(','),mime=(arr[0].match(/:(.*?);/)||[])[1]||'image/jpeg';
    var bstr=atob(arr[1]),n=bstr.length,u8=new Uint8Array(n);
    for(var i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
    return new File([u8],name||'img.jpg',{type:mime});
  }catch(e){return null;}
}
function startHandshakeTimer(log){
  try{
    if(_handshakeTimer){clearInterval(_handshakeTimer);}
    var created=log.created_at?new Date(log.created_at).getTime():Date.now();
    var expires=created+24*60*60*1000;
    var el=document.getElementById('handshakeTimer');
    var tick=function(){
      var left=expires-Date.now();
      if(left<=0){
        if(el)el.textContent='⏰ Expired';
        if(_handshakeTimer){clearInterval(_handshakeTimer);_handshakeTimer=null;}
        return;
      }
      var h=Math.floor(left/3600000);
      var m=Math.floor((left%3600000)/60000);
      var s=Math.floor((left%60000)/1000);
      if(el)el.textContent='⏳ '+(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s+' remaining';
    };
    tick();
    _handshakeTimer=setInterval(tick,1000);
  }catch(e){}
}
function confirmHandshake(){
  try{
    if(!_handshakeLogId){toast('No handshake pending.');return;}
    var note=document.getElementById('handshakeNoteInput');
    var text=note?note.value.trim():'';
    if(!text){toast('Handshake note is required.');return;}
    if(text.length>140){toast('Note too long (max 140 chars).');return;}
    var me=hookNick();
    var now=new Date().toISOString();
    window.EtieCloud.updateHangoutLog(_handshakeLogId,{
      status:'confirmed',
      handshake_note:text,
      confirmed_at:now
    }).then(function(ok){
      if(ok){
        // Publish to both profiles' activity diaries
        publishToActivityDiary(_handshakeLogId, text, me);
        toast('🤝 Handshake confirmed — memory published to both diaries!');
        closeHandshakeModal();
        // Refresh any relevant views
        try{if(typeof renderProfile==='function')renderProfile();}catch(e){}
        try{if(typeof renderPassport==='function')renderPassport();}catch(e){}
      }else{toast('Failed to confirm.');}
    });
  }catch(e){toast('Error confirming handshake.');}
}
function declineHandshake(){
  try{
    if(!_handshakeLogId){toast('No handshake pending.');return;}
    window.EtieCloud.updateHangoutLog(_handshakeLogId,{
      status:'expired',
      handshake_note:'Declined by tagged user.'
    }).then(function(ok){
      if(ok){toast('Handshake declined — photo stays private to host.');closeHandshakeModal();}
      else{toast('Failed to decline.');}
    });
  }catch(e){toast('Error declining handshake.');}
}
function publishToActivityDiary(logId, handshakeNote, guestNick){
  try{
    // Fetch the log to get full details
    window.EtieCloud.fetchHookLogs(logId, function(logs){
      // Actually we need to fetch by log ID - let's use a different approach
      // For now, store in local state for both users
      var logEntry={
        logId:logId,
        handshakeNote:handshakeNote,
        guestNick:guestNick,
        timestamp:Date.now()
      };
      // Store in traveller profile
      if(typeof ETIE!=='undefined' && ETIE.traveller){
        ETIE.traveller.activityDiary=ETIE.traveller.activityDiary||[];
        ETIE.traveller.activityDiary.unshift(logEntry);
        if(ETIE.traveller.activityDiary.length>50) ETIE.traveller.activityDiary=ETIE.traveller.activityDiary.slice(0,50);
      }
      if(typeof ETIE!=='undefined' && ETIE.local){
        ETIE.local.activityDiary=ETIE.local.activityDiary||[];
        ETIE.local.activityDiary.unshift(logEntry);
        if(ETIE.local.activityDiary.length>50) ETIE.local.activityDiary=ETIE.local.activityDiary.slice(0,50);
      }
      saveState();
    });
  }catch(e){}
}
function checkPendingHandshakes(){
  try{
    var me=hookNick();
    // Check local state for pending handshakes
    var pending=(ETIE.traveller?.activityDiary||[]).filter(function(e){return e.status==='pending';});
    // Also fetch from cloud if needed
    if(window.EtieCloud && window.EtieCloud.fetchTaggedLogs){
      var uid=myUid();
      if(uid){
        window.EtieCloud.fetchTaggedLogs(uid, function(logs){
          logs.forEach(function(log){
            // Show notification or open modal
            var notif=document.getElementById('handshakeNotif');
            if(notif){
              notif.style.display='block';
              notif.textContent='🤝 New handshake request from '+log.nickname;
              notif.onclick=function(){openHandshakeModal(log);};
            }
          });
        });
      }
    }
  }catch(e){}
}
function bumpPassion(act){
  try{
    if(!act)return;
    ETIE.traveller.activityStats=ETIE.traveller.activityStats||{};
    ETIE.traveller.activityStats[act]=(ETIE.traveller.activityStats[act]||0)+1;
    saveState();renderPassions();
  }catch(e){}
}
function passionEmoji(tag){
  var m={'Salsa':'💃','Football':'⚽','Coffee':'☕'};
  if(m[tag])return m[tag];
  try{return mapCatEmoji(tag);}catch(e){return '⚡';}
}
function renderPassions(){
  try{
    var box=document.getElementById('donePassions');if(!box)return;
    box.innerHTML='';
    var st={};try{st=ETIE.traveller.activityStats||{};}catch(e){}
    var keys=Object.keys(st).filter(function(k){return st[k]>0;}).sort(function(a,b){return st[b]-st[a];});
    if(!keys.length){var e=document.createElement('span');e.className='muted small';e.textContent='No verified logs yet — log a hangout photo to earn badges.';box.appendChild(e);return;}
    keys.forEach(function(k){var s=document.createElement('span');s.className='chip active';s.textContent=passionEmoji(k)+' '+k+' Regular · '+st[k]+' Verified Log'+(st[k]===1?'':'s');box.appendChild(s);});
  }catch(e){}
}
function renderPinLogs(pinId){
  try{
    var p=findPin(pinId);if(!p)return;
    var box=document.getElementById('pinLogs');if(!box)return;
    box.innerHTML='';box.style.display='none';
    var w=pinWindow(p);
    var wt=document.getElementById('pinWindow');
    if(wt){wt.textContent='Hangout window: '+fmtWhen(w.start)+' → '+fmtWhen(w.end);wt.style.display='';}
    if(!window.EtieCloud||!window.EtieCloud.fetchHookLogs)return;
    window.EtieCloud.fetchHookLogs(p.cloudId||p.id,function(rows){
      try{
        var verified=(rows||[]).filter(function(r){return r&&r.is_live_verified;});
        if(!verified.length)return;
        verified.slice(0,3).forEach(function(r){
          var d=document.createElement('div');d.className='live-badge';
          d.style.position='relative';
          var ts='';try{ts=new Date(r.taken_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){}
          d.textContent='⚡ Verified Live Log · '+ts;
          if(r.questCompleted && r.questTitle){
            var qb=document.createElement('span');qb.className='quest-badge';
            qb.textContent='⚡ Quest Completed: '+r.questTitle;
            qb.style.marginLeft='8px';
            d.appendChild(qb);
          }
          box.appendChild(d);
        });
        box.style.display='';
      }catch(e){}
    });
  }catch(e){}
}
function sendHookMessage(){
  try{
    var inp=document.getElementById('chatMsgInput');if(!inp)return;
    var text=(inp.value||'').trim();if(!text)return;
    var p=findPin(_chatPinId);if(!p){toast('Hook not found.');return;}
    var role='traveller';try{role=(ETIE.activeRole==='local')?'local':'traveller';}catch(e){}
    var msg={nick:hookNick(),role:role,text:text,ts:Date.now()};
    if(!p.chat)p.chat=[];
    p.chat.push(msg);saveState();inp.value='';renderHookChat();
    try{if(window.EtieCloud&&window.EtieCloud.pushHookMessage)window.EtieCloud.pushHookMessage(p,msg);}catch(e){}
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',function(){
  alphabetisePickers();
  buildCountrySelects();
  restoreAll();
  try{ initHKMap(); renderMapFilter(); renderMapPins(); }catch(e){}
  try{ renderDerivedBadge(); locateUser(); }catch(e){}
  try{ refreshGate(); }catch(e){}
  try{ processPhotoOutbox(); }catch(e){}
  try{ window.addEventListener('online',function(){try{processPhotoOutbox();}catch(e){}}); }catch(e){}
  try{
    var r=new URLSearchParams(window.location.search).get('role');
    if(r==='traveller'||r==='local') setRole(r);
  }catch(e){}
  document.addEventListener('click',function(e){
    try{
      if(!e.target||!e.target.closest)return;
      if(!e.target.closest('.suggest')&&e.target.id!=='travCity'&&e.target.id!=='localCity'&&e.target.id!=='travNationality'&&e.target.id!=='localNationality'){
        ['travCitySuggest','localCitySuggest'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('open');});
      }
    }catch(err){}
  });
  ['travSocialVibe','travTravelPace','localSocialVibe','localTravelPace'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.addEventListener('input',function(){refreshAnchoredLabels();saveCurrentVisible(true);saveState();});
  });
  ['travCity','travDateFrom','travDateTo','travHook','travNickname','localCity','localAge','localNickname','localOffer','travNationality','localNationality'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.addEventListener('change',function(){saveCurrentVisible(true);});
  });
  var ci=document.getElementById('chatInput');if(ci)ci.addEventListener('keydown',function(e){if(e.key==='Enter')sendChat('traveller');});
  var li=document.getElementById('localChatInput');if(li)li.addEventListener('keydown',function(e){if(e.key==='Enter')sendChat('local','localChatInput');});
  var li9=document.getElementById('localChatInput9');if(li9)li9.addEventListener('keydown',function(e){if(e.key==='Enter')sendChat('local','localChatInput9');});
  var pi=document.getElementById('chatPopupInput');if(pi)pi.addEventListener('keydown',function(e){if(e.key==='Enter')sendChatPopup();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{closeChatPopup();}catch(e2){}try{closeAdmin();}catch(e3){}try{closeAvatarMenu();}catch(e4){}try{closeChatDrawer();}catch(e5){}try{closePinDetail();}catch(e6){}try{closeGroupModal();}catch(e7){}try{closeDropHook();}catch(e8){}try{closeLogSheet();}catch(e9){}}});
  document.addEventListener('click',function(e){try{var m=document.getElementById('avatarMenu');if(m&&e.target&&!m.contains(e.target))closeAvatarMenu();}catch(err){}});
  // re-sync header whenever the tab regains focus (session may have landed elsewhere)
  try{
    document.addEventListener('visibilitychange',function(){if(!document.hidden){try{updateAuthHeader();renderHeaderProfile();}catch(e){}}});
    window.addEventListener('focus',function(){try{updateAuthHeader();renderHeaderProfile();}catch(e){}});
  }catch(e){}
  // Subscribe to reviews/reports when cloud is on
  setTimeout(function(){
    if(window.EtieCloud && window.EtieCloud.subscribeReviews) window.EtieCloud.subscribeReviews();
    if(window.EtieCloud && window.EtieCloud.subscribeReports) window.EtieCloud.subscribeReports();
  }, 2000);
});
