// Etie Phase 6 — onboarding + requests + meetup + reviews (vanilla JS + localStorage)
// Plain English: plan → complete → both review. Trips shows live status.
var ETIE_KEY = 'etie-v1';

function todayISO(){ try{ return new Date().toISOString().slice(0,10); }catch(e){ return ''; } }
function etieDefaults() {
  return {
    trip: { destination: '', dates: '', dateFrom: todayISO(), dateTo: '', country: '' },
    traveller: {
      nickname: '',
      nationality: '',
      interests: [],
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
      city: '', age: '', nationality: '',
      verificationMethods: [],
      interests: [],
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
  // exclude self when traveller is also a local guide
  try{
    var selfId=(window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession()&&window.EtieCloud.getSession().user&&window.EtieCloud.getSession().user.id)||null;
    if(selfId) live=live.filter(function(l){return l.id!==selfId;});
  }catch(e){}
  return live;
}
function getDiscoverLocals(){
  var live=liveLocals();
  var useLive = isCleanLive() || (live && live.length);
  var all= useLive ? (live||[]) : ((window.ETIE_MOCKS&&window.ETIE_MOCKS.locals)||[]);
  var ranked=window.EtieMatch?window.EtieMatch.rank(ETIE.traveller, ETIE.trip, all, ETIE.local.availability, ETIE.reviews):all;
  // Beginner filter: hide locals with no shared interests for beginners (<=3 completed trips)
  // Veteran exemption: Host/Verified guides always stay visible so Ethan matches every traveller in tests
  var travCompleted = ETIE.traveller ? (ETIE.traveller.completedTrips || 0) : 0;
  var isBeginner = travCompleted <= 3;
  if(isBeginner){
    ranked = ranked.filter(function(x){ return (x.shared && x.shared.length > 0) || (x.local && (x.local.veteran || x.local.tier==='Host' || x.local.tier==='Verified')); });
  }
  // Veterans first for test predictability
  ranked.sort(function(a,b){
    var av=(a.local&&(a.local.veteran||a.local.tier==='Host'||a.local.tier==='Verified'))?1:0;
    var bv=(b.local&&(b.local.veteran||b.local.tier==='Host'||b.local.tier==='Verified'))?1:0;
    if(av!==bv)return bv-av;
    return b.score-a.score;
  });
  if(canSeeFullDiscover())return ranked;
  return ranked.slice(0,3);
}

// Flag helpers
function flagEmoji(code){if(!code)return '';return String.fromCodePoint(...code.toUpperCase().split('').map(c=>127397+c.charCodeAt(0)));}
function flagForCountry(countryCode){var map={'PT':'🇵🇹','ES':'🇪🇸','FR':'🇫🇷','IT':'🇮🇹','JP':'🇯🇵','TH':'🇹🇭','US':'🇺🇸','AU':'🇦🇺','HK':'🇭🇰','SG':'🇸🇬'};return map[countryCode]||flagEmoji(countryCode)||'🌍';}

function toast(msg){var t=document.getElementById('toast');if(!t){alert(msg);return;}t.textContent=msg;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(function(){t.style.display='none';},2200);}
function showScreen(id){var el=document.getElementById(id);if(id==='profile'){renderProfiles();updateProfileVisibility();}if(id==='messages')renderMessagesList();if(id==='trips'){renderTrips();renderMeetup();}if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});}
function hideGroup(prefix){for(var i=1;i<=15;i++){var e=document.getElementById(prefix+i);if(e)e.classList.add('hidden');}}

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
  var lc=document.getElementById('localInterestCount');if(lc)lc.textContent=getChips('localInterests').length+' selected';
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
}
function renderAvailDates(){
  try{
    var list=document.getElementById('availDateList'); if(!list) return;
    var dates=ETIE.local.availDates||[];
    if(!dates.length){ list.innerHTML='<div class="list-item"><div><strong>No dates yet</strong><br><span class="muted">Add dates you\'re free — travellers see you on those days.</span></div><span class="status">Empty</span></div>'; return; }
    list.innerHTML='';
    dates.slice().sort().forEach(function(d,idx){
      var row=document.createElement('div'); row.className='list-item';
      var dt=new Date(d+'T12:00'); var label=isNaN(dt.getTime())?d:dt.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
      row.innerHTML='<div><strong></strong></div>'; row.querySelector('strong').textContent=label;
      var rm=document.createElement('button'); rm.className='secondary'; rm.textContent='Remove'; rm.style.padding='6px 10px'; rm.onclick=(function(i){return function(){removeAvailDate(i);};})(idx);
      row.appendChild(rm); list.appendChild(row);
    });
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

function currentTravStep(){for(var i=1;i<=16;i++){var e=document.getElementById('trav'+i);if(e&&!e.classList.contains('hidden'))return i;}return 1;}
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
function saveTrav1(){
  ETIE.trip.destination=document.getElementById('travCity').value.trim();
  var f=(document.getElementById('travDateFrom')||{}).value||'',t=(document.getElementById('travDateTo')||{}).value||'';
  if(f&&t){ETIE.trip.dateFrom=f;ETIE.trip.dateTo=t;ETIE.trip.dates=formatTripDates(f,t);}
  var nc=document.getElementById('travNationality'); if(nc&&nc.value) ETIE.traveller.nationality=nc.value;
  var nn=document.getElementById('travNickname'); if(nn) ETIE.traveller.nickname=nn.value.trim();
  updateHookLabel();
}
function saveTrav2(){ETIE.traveller.interests=getChips('travInterests');}
var SOCIAL_VIBE_LABELS=["Solo & Quiet","Balanced","Group & Social"];
var TRAVEL_PACE_LABELS=["Relaxed","Moderate","Packed / High-Energy"];
function vibeToSocial(v){return v==0?2:v==2?9:5;}
function paceToSpont(v){return v==0?2:v==2?9:5;}
function saveTrav3(){
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
function saveTrav4(){ETIE.traveller.lookingFor=getChips('travLookingFor');}
function saveTrav5(){ETIE.traveller.hook=document.getElementById('travHook').value.trim();}
function saveLocal3(){ETIE.local.city=document.getElementById('localCity').value.trim();ETIE.local.age=document.getElementById('localAge').value.trim();ETIE.local.nationality=document.getElementById('localNationality').value; var dn=document.getElementById('localNickname'); if(dn) ETIE.local.displayName=dn.value.trim();}
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

function saveTrav6(){}
function saveTrav7(){}
function saveTrav8(){}
function validTrav(step){
  if(step===1){if(!ETIE.trip.destination){toast('Add a destination (e.g. Lisbon).');return false;}if(!(ETIE.trip.dateFrom&&ETIE.trip.dateTo)&&!ETIE.trip.dates){toast('Pick your trip dates on the calendar.');return false;}}
  if(step===2){if(ETIE.traveller.interests.length===0){toast('Pick at least 1 interest.');return false;}if(ETIE.traveller.interests.length>4){toast('Pick up to 4.');return false;}}
  if(step===4){if(ETIE.traveller.lookingFor.length===0){toast('Pick at least 1 option.');return false;}}
  if(step===5){if(ETIE.traveller.hook.length<10){toast('Add a short hook (10+ characters) so locals get you.');return false;}}
  if(step===6||step===7||step===8){return true;}
  return true;
}
function validLocal(step){
  if(step===2){if(!(ETIE.local.verificationMethods&&ETIE.local.verificationMethods.length)){toast('Pick at least 1 verification method to continue.');return false;}}
  if(step===3){if(!ETIE.local.city){toast('Add your home city.');return false;}var a=parseInt(ETIE.local.age,10);if(isNaN(a)||a<18){toast('Age must be 18+.');return false;}}
  if(step===4){if(ETIE.local.interests.length===0){toast('Pick at least 1 interest.');return false;}if(ETIE.local.interests.length>4){toast('Pick up to 4.');return false;}}
  if(step===6){if(ETIE.local.offer.length<10){toast('Add what you can offer (10+ characters).');return false;}}
  return true;
}

function saveCurrentVisible(silent){
  var t=currentTravStep();var l=document.getElementById('localFlow');
  var localVisible=l&&!l.classList.contains('hidden');
  if(!localVisible){try{
    if(t===1)saveTrav1();if(t===2)saveTrav2();if(t===3)saveTrav3();if(t===4)saveTrav4();if(t===5)saveTrav5();
  }catch(e){}}
  else{var s=currentLocalStep();try{
    if(s===2)saveLocal2();if(s===3)saveLocal3();if(s===4)saveLocal4();if(s===5)saveLocal5();if(s===6)saveLocal6();if(s===7)saveLocal7();
  }catch(e){}}
  saveState();if(!silent)updateCounts();
}

function travNext(n){
  var cur=currentTravStep();
  try{
    if(cur===1)saveTrav1();if(cur===2)saveTrav2();if(cur===3)saveTrav3();if(cur===4)saveTrav4();if(cur===5)saveTrav5();if(cur===6)saveTrav6();
    saveState();
    if(n>cur&&!validTrav(cur))return;
  }catch(e){}
  // Steps 8-16 are match-gated: only reachable when a real local guide exists (no Marta demo when offline)
  if(n>=8 && n<=16 && !hasRealMatch()){
    // still allow Step 7 waiting state, but block deeper
    if(n===7){ /* allow */ } else {
      toast(n===8?'No local guides yet — complete both onboardings to get a match.':'Complete a match first (Step 7).');
      renderMatches(); hideGroup('trav'); var e7=document.getElementById('trav7'); if(e7) e7.classList.remove('hidden'); showScreen('trav7'); return;
    }
  }
  hideGroup('trav');var e=document.getElementById('trav'+n);if(e)e.classList.remove('hidden');updateCounts();renderProfiles();if(n===7||n===8)renderMatches();if(n===9||n===10||n===11||n===12){renderRequests();renderChat();renderMessagesList();}if(n>=12&&n<=17){renderMeetup();renderTrips();renderThanks();paintStars('travStars',ETIE._travStars||0);}showScreen('trav'+n);
}
function localNext(n){
  var cur=currentLocalStep();
  try{
    if(cur===2)saveLocal2();if(cur===3)saveLocal3();if(cur===4)saveLocal4();if(cur===5)saveLocal5();if(cur===6)saveLocal6();if(cur===7)saveLocal7();
    saveState();
    if(n>cur&&!validLocal(cur))return;
  }catch(e){}
  for(var i=1;i<=10;i++){var e=document.getElementById('local'+i);if(e)e.classList.add('hidden');}
  var t=document.getElementById('local'+n);if(t)t.classList.remove('hidden');updateCounts();renderProfiles();syncAvailUI();if(n===7){renderLocalDashboard();}if(n===8||n===9){renderRequests();renderChat();renderMessagesList();renderMeetup();renderLocalDashboard();}if(n===10){renderMeetup();paintStars('localStars',ETIE._localStars||0);renderLocalDashboard();}showScreen('local'+n);
}
function findMatch(){try{saveTrav5();saveTrav6();saveState();if(!validTrav(5))return;}catch(e){}if(!ETIE.traveller.photo){toast('Add your selfie first — profiles with photos get 3x more requests.');return;}ETIE_MATCH_INDEX=0;renderMatches();travNext(7);}
function travRestart(){showScreen('trav1');travNext(1);}
function openAdmin(){try{var o=document.getElementById('adminOverlay');if(o)o.classList.remove('hidden');}catch(e){} try{ refreshAdminLive(); }catch(e){}}
function closeAdmin(){try{var o=document.getElementById('adminOverlay');if(o)o.classList.add('hidden');}catch(e){}}
function toggleAdmin(){try{var o=document.getElementById('adminOverlay');if(!o)return;if(o.classList.contains('hidden'))openAdmin();else closeAdmin();}catch(e){}}
function enableCleanLive(){ try{ localStorage.setItem('etie-clean','1'); window.ETIE_CLEAN=true; var l=document.getElementById('cleanModeLine'); if(l) l.textContent='Clean mode ON — mocks hidden. Refresh both phones. Run SQL wipe below if needed, then re-onboard Fleming (local) + Ethan (traveller).'; renderMatches(); toast('Clean live mode enabled.'); }catch(e){} }
function disableCleanLive(){ try{ localStorage.setItem('etie-clean','0'); window.ETIE_CLEAN=false; var l=document.getElementById('cleanModeLine'); if(l) l.textContent='Demos visible again (clean off).'; renderMatches(); toast('Demos restored.'); }catch(e){} }
function wipeLocalEtie(){ try{ if(!confirm('Wipe local ETIE (requests/messages/meetups/reviews, keep profile)?')) return; ETIE.requests={}; ETIE.messages={}; ETIE.meetups={}; ETIE.reviews={}; ETIE._travStars=0; ETIE._localStars=0; ETIE_MATCH_INDEX=0; saveState(); renderMatches(); renderRequests(); renderChat(); renderMessagesList(); renderMeetup(); renderTrips(); renderLocalDashboard(); toast('Local wiped — also run SQL wipe for cloud.'); }catch(e){} }
function wipeEverything(){
  if(!confirm('WIPE EVERYTHING on this device + cloud for this login? Profile, trips, chats, meetups all gone. Continue?')) return;
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
    if(window.ETIE_DEMO){ if(hint) hint.textContent='Demo active — cloud paused. Exit demo to see live.'; return; }
    if(!window.EtieCloud || !window.EtieCloud.isSharedOn() || !window.EtieCloud.getClient || !window.EtieCloud.getClient()){
      if(hint) hint.textContent='Offline — sign in on both phones for live data.';
      if(uc) uc.textContent='—'; if(vc) vc.textContent='—'; if(rc) rc.textContent='—'; if(mc) mc.textContent='—';
      return;
    }
    if(hint) hint.textContent='Live · refreshing…';
    var client=window.EtieCloud.getClient();
    client.from('etie_profiles').select('user_id,city,nationality,display_name,interests,hosted_count,tier,updated_at').order('updated_at',{ascending:false}).limit(20).then(function(r){
      var rows=(r&&r.data)||[];
      if(uc) uc.textContent=String(rows.length);
      var verified=rows.filter(function(x){return (x.hosted_count||0)>=3;}).length;
      if(vc) vc.textContent=String(verified);
      if(lp){
        if(!rows.length) lp.innerHTML='<div class="muted small">No profiles yet — complete onboarding on each phone.</div>';
        else {
          lp.innerHTML='';
          rows.forEach(function(u){
            var flag=''; try{ flag=flagForCountry(u.nationality||''); }catch(e){flag='🌍';}
            var name=u.display_name||u.user_id.slice(0,8);
            var city=u.city||'—';
            var tier=u.tier||'Rookie';
            var row=document.createElement('div'); row.className='list-item';
            row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
            row.querySelector('strong').textContent=flag+' '+name+' · '+city;
            row.querySelector('.muted').textContent=(u.interests||[]).slice(0,3).join(' · ')||'no interests yet';
            row.querySelector('.status').textContent=tier;
            lp.appendChild(row);
          });
        }
      }
    });
    client.from('etie_reports').select('id',{count:'exact',head:true}).then(function(r){ if(rc) rc.textContent= String(r.count!=null?r.count:'—'); });
    client.from('etie_meetups').select('id',{count:'exact',head:true}).then(function(r){ if(mc) mc.textContent= String(r.count!=null?r.count:'—'); });
    client.from('etie_requests').select('id,local_mock_id,status,traveller_name,local_name,destination,updated_at').order('updated_at',{ascending:false}).limit(10).then(function(r){
      var rows=(r&&r.data)||[];
      if(!lr) return;
      if(!rows.length) lr.innerHTML='<div class="muted small">No requests yet — Ethan sends one, Kevin sees it here.</div>';
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
function setRole(role){document.getElementById('travRole').classList.toggle('active',role==='traveller');document.getElementById('localRole').classList.toggle('active',role==='local');document.getElementById('travellerFlow').classList.toggle('hidden',role!=='traveller');document.getElementById('localFlow').classList.toggle('hidden',role!=='local');saveState();if(role==='traveller')travNext(1);else localNext(1);showScreen('home');}

// Demo personas — permanent test individuals for solo testing (same browser, no second phone).
// Cloud sync pauses while a persona is active so demo play never pollutes real tables.
function assumePersona(id){
  try{
    try{localStorage.setItem('etie-v1-user-backup',localStorage.getItem('etie-v1')||'');}catch(e){}
    window.ETIE_DEMO=id;
    var M=(window.ETIE_MOCKS||{});
    if(id==='trav-etie'){
      var t=M.traveller||{};
      ETIE.trip={destination:(M.trip&&M.trip.destination)||'Lisbon',dates:(M.trip&&M.trip.dates)||'12–18 September',country:(M.trip&&M.trip.country)||'PT'};
      ETIE.traveller={nickname:t.nickname||'',nationality:t.nationality||'HK',interests:((t.interests)||['Football','Salsa','Cooking','Thrift shopping']).slice(),personality:Object.assign({social:8,spontaneous:8,curious:10},t.personality||{}),socialVibe:1,travelPace:1,styleInterests:[],lookingFor:((t.lookingFor)||['💎 Hidden Gems']).slice(),hook:t.hook||'',photo:null,travelPhotos:[]};
      try{document.getElementById('cloudStatus').textContent='Demo: Etie (offline)';}catch(e){}
      try{document.getElementById('demoPersonaLine').textContent='Acting as Etie · traveller — Exit demo to return to your account.';}catch(e){}
      saveState();setRole('traveller');
    } else {
      var L=null;((M.locals)||[]).forEach(function(x){if(x.id===id)L=x;});
      if(!L){toast('Unknown persona');return;}
      ETIE.local={city:L.city||'Lisbon',age:String(L.age||28),verificationMethods:['Social media'],interests:(L.interests||[]).slice(0,4),personality:Object.assign({social:10,spontaneous:10,curious:10},L.personality||{}),offer:L.offer||'',offerTags:((L.offerTags||L.interests)||[]).slice(0,4),availability:(L.availability||[]).map(function(a){return (typeof a==='string')?{label:a,status:'Available'}:a;})};
      try{document.getElementById('cloudStatus').textContent='Demo: '+L.name+' (offline)';}catch(e){}
      try{document.getElementById('demoPersonaLine').textContent='Acting as '+L.name+' · local guide — Exit demo to return to your account.';}catch(e){}
      saveState();setRole('local');localNext(9);
    }
    toast('Demo persona active — cloud sync paused.');
  }catch(e){toast('Demo switch failed.');}
}
function exitDemo(){
  try{
    window.ETIE_DEMO=null;
    try{var raw=localStorage.getItem('etie-v1-user-backup');if(raw){localStorage.setItem(ETIE_KEY,raw);ETIE=loadState();}}catch(e){}
    try{document.getElementById('cloudStatus').textContent='Cloud: offline demo';}catch(e){}
    try{document.getElementById('demoPersonaLine').textContent='';}catch(e){}
    if(typeof restoreAll==='function')restoreAll();
    toast('Back to your account.');
  }catch(e){}
}

function hasAnyTravellerData(){
  try{
    if(ETIE.trip&&(ETIE.trip.destination||ETIE.trip.country||ETIE.trip.dates))return true;
    var t=ETIE.traveller||{};
    if(t.nickname||t.nationality)return true;
    if((t.interests||[]).length)return true;
    if(t._vibeSet||(t.styleInterests||[]).length)return true;
    if((t.lookingFor||[]).length)return true;
    if(t.hook)return true;
    if(t.photo)return true;
    if((t.travelPhotos||[]).filter(Boolean).length)return true;
    return false;
  }catch(e){return true;}
}
function updateProfileVisibility(){
  try{
    var ready=hasAnyTravellerData();
    var navBtn=document.getElementById('navProfileBtn');
    if(navBtn)navBtn.style.display=ready?'':'none';
    var content=document.getElementById('profileContent');
    if(content)content.style.display=ready?'':'none';
    var locked=document.getElementById('profileLocked');
    if(locked)locked.style.display=ready?'none':'';
  }catch(e){}
}
function renderProfiles(){
  try{
    updateProfileVisibility();
    var hasTrip=!!(ETIE.trip&&ETIE.trip.destination);
    var tripEl=document.getElementById('profTrip');
    var tflag=flagForCountry(ETIE.traveller.nationality||''); var dflag=flagForCountry(ETIE.trip.country);
    if(tripEl){
      if(!hasTrip) tripEl.textContent='No trip yet — complete Step 1';
      else tripEl.textContent=(ETIE.traveller.nationality?flagForCountry(ETIE.traveller.nationality)+' ':'')+dflag+' '+(ETIE.trip.destination||'—')+' · '+(ETIE.trip.dates||'—')+' · Traveller';
    }
    var pi=document.getElementById('profInterests');
    if(pi){pi.innerHTML=''; if(!ETIE.traveller.interests.length){ var e=document.createElement('span'); e.className='muted small'; e.textContent='No interests yet — pick up to 4 in Step 2.'; pi.appendChild(e);} else ETIE.traveller.interests.forEach(function(x){var s=document.createElement('span');s.className='chip active';s.textContent=x;pi.appendChild(s);});}
    var pp=document.getElementById('profPersonality');
    if(pp){
      var vibeTouched = !!(ETIE.traveller._vibeSet && ETIE.traveller.socialVibe!=null);
      var styleTouched = !!((ETIE.traveller.styleInterests||[]).length);
      if(!vibeTouched && !styleTouched){
        pp.textContent='Not set yet — set in Step 3.';
      } else {
        var _sv=ETIE.traveller.socialVibe, _tp=ETIE.traveller.travelPace;
        var svl=(_sv!=null?SOCIAL_VIBE_LABELS[_sv]:'')||'', tpl=(_tp!=null?TRAVEL_PACE_LABELS[_tp]:'')||'';
        pp.textContent=(svl?('Social vibe: '+svl+' · '):'')+(tpl?('Pace: '+tpl+' · '):'')+'Social '+ETIE.traveller.personality.social+'/10 · Spontaneous '+ETIE.traveller.personality.spontaneous+'/10 · Curious '+ETIE.traveller.personality.curious+'/10';
        if((ETIE.traveller.styleInterests||[]).length) pp.textContent+=' · '+(ETIE.traveller.styleInterests||[]).join(' · ');
      }
    }
    var pl=document.getElementById('profLookingFor');
    if(pl)pl.textContent=(ETIE.traveller.lookingFor||[]).join(' · ')||'Not set yet — pick in Step 4.';
    var ph=document.getElementById('profHook');
    if(ph)ph.textContent=ETIE.traveller.hook?('“'+ETIE.traveller.hook+'”'):'Not set yet — write in Step 5.';
    var ps=document.getElementById('profStats');
    if(ps){
      var tc=ETIE.traveller.completedTrips||0, ar=ETIE.traveller.avgRatingReceived||0;
      ps.textContent = (tc||ar) ? ('Trips: '+tc+' · Rating: '+(ar?ar.toFixed(1)+' ★':'—')) : 'No trips yet — complete a meetup to build reputation.';
    }
    // Traveller photo in profile
    var tp=document.getElementById('profTravPhoto');
    if(tp){tp.innerHTML=ETIE.traveller.photo?('<img src="'+ETIE.traveller.photo+'" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">'):'<span style="color:rgba(255,255,255,.5);font-size:24px;">+</span>';}
    var ln=document.getElementById('localDashName');
    var lflag=flagForCountry(ETIE.local.nationality);
    if(ln)ln.textContent=lflag+' You · '+(ETIE.local.city||'—');
    var ls=document.getElementById('localDashSub');
    if(ls)ls.textContent='Local guide · '+(ETIE.local.age||'—')+' · Social '+ETIE.local.personality.social;
    var li=document.getElementById('localDashInterests');
    if(li){li.innerHTML='';ETIE.local.interests.forEach(function(x){var s=document.createElement('span');s.className='chip active';s.textContent=x;li.appendChild(s);});ETIE.local.offerTags.forEach(function(x){if(ETIE.local.interests.indexOf(x)===-1){var s=document.createElement('span');s.className='chip';s.textContent=x;li.appendChild(s);}});}
    var lo=document.getElementById('localDashOffer');
    if(lo)lo.textContent='“'+(ETIE.local.offer||'—')+'”';
    var la=document.getElementById('localDashAvail');
    if(la){
      if((ETIE.local.availDates||[]).length){
        var ds=(ETIE.local.availDates||[]).slice().sort().map(function(d){ try{var dt=new Date(d+'T12:00'); return isNaN(dt.getTime())?d:dt.toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch(e){return d;}}).join(', ');
        la.textContent='Available dates: '+ds;
      } else {
        la.textContent='Available: '+ETIE.local.availability.filter(function(a){return a.status==='Available';}).map(function(a){return a.label;}).join(', ')+' · Other: '+ETIE.local.availability.filter(function(a){return a.status!=='Available';}).map(function(a){return a.label+' ('+a.status+')';}).join(', ');
      }
    }
    // Local photo in dashboard
    var lp=document.getElementById('localDashPhoto');
    if(lp){lp.innerHTML=ETIE.local.photo?('<img src="'+ETIE.local.photo+'" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">'):'<span style="color:rgba(255,255,255,.5);font-size:24px;">+</span>';}
    updateHookLabel();
  }catch(e){}
}

var ETIE_MATCH_INDEX=0;
function getRanked(){
  try{
    var live=liveLocals();
    var useLive = isCleanLive() || (live && live.length);
    var src= useLive ? (live||[]) : (window.ETIE_MOCKS&&window.ETIE_MOCKS.locals||[]);
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
      var t7s=document.getElementById('trav7Sub'); if(t7s) t7s.textContent=isCleanLive()?'No verified local guides yet — ask Fleming to finish Local onboarding, then Refresh. Discover will show real people.':'The product recommends people rather than making you browse a directory.';
      var mc=document.getElementById('matchAvatar'); if(mc) mc.textContent='—';
      var mn=document.getElementById('matchName'); if(mn) mn.textContent=isCleanLive()?'No verified local guides yet': 'No matches';
      var mm=document.getElementById('matchMeta'); if(mm) mm.textContent=isCleanLive()?'Clean mode: only real profiles. Ask Fleming to finish Local onboarding, then Refresh.': '—';
      var ms=document.getElementById('matchScore'); if(ms) ms.textContent='No match yet';
      var rn=document.getElementById('matchRankNote'); if(rn) rn.textContent='';
      // hide Steps 8-16 when no real match (they only live after a match)
      ['trav8','trav9','trav10','trav11','trav12','trav13','trav14','trav15','trav16'].forEach(function(id){var el=document.getElementById(id); if(el) el.classList.add('hidden');});
      var dg=document.getElementById('discoverGrid'); if(dg){ if(isCleanLive()) dg.innerHTML='<div class="card" style="padding:16px;"><strong>No local guides yet</strong><p class="muted small">Clean mode on — Discover shows only verified users (Ethan/Fleming). Complete both onboardings, then check Admin → Live users.</p></div>'; else dg.innerHTML=''; }
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
    trustItems.push(['✓ Demo identity'],['✓ Demo local guide'],[(L.stats&&L.stats.rating?L.stats.rating:'—')+' ★ (demo)'],[(L.stats&&L.stats.travellersMet?L.stats.travellersMet:'—')+' met (demo)']);
    trustItems.forEach(function(a){var s=document.createElement('span');s.textContent=a[0];mt.appendChild(s);});
    document.getElementById('matchWhy').textContent='You share '+(m.shared.join(' + ')||'no direct interests yet')+', personality fit '+m.pers+'/100, local value '+(L.offer||'').slice(0,80)+'…, available '+(L.availability||[]).join(', ')+'.';
    document.getElementById('whyInterestsTitle').textContent=m.shared.length+' shared interest'+(m.shared.length===1?'':'s');
    document.getElementById('whyInterests').textContent=(m.shared.join(' · ')||'None yet — try adding Salsa/Cooking/Football/Photography')+' ('+m.interestScore+'/100)';
    document.getElementById('whyInterestsBadge').textContent=m.interestScore>=70?'Strong':(m.interestScore>=40?'Okay':'Low');
    document.getElementById('whyPersonality').textContent='You '+ETIE.traveller.personality.social+'/'+ETIE.traveller.personality.spontaneous+'/'+ETIE.traveller.personality.curious+' vs '+L.name+' '+L.personality.social+'/'+L.personality.spontaneous+'/'+L.personality.curious+' ('+m.pers+'/100)';
    document.getElementById('whyPersonalityBadge').textContent=m.pers>=75?'Strong':(m.pers>=55?'Good':'Low');
    document.getElementById('whyValue').textContent=(L.offer||'—')+' ('+m.value+'/100)';
    document.getElementById('whyValueBadge').textContent=m.value>=70?'High':(m.value>=50?'Okay':'Low');
    document.getElementById('whyAvail').textContent=(L.availability||[]).join(', ')+' during '+ETIE.trip.dates;
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
    p8items.push('✓ Demo identity','✓ Demo local guide',(L.stats.rating+' ★ (demo)'));
    p8items.forEach(function(t){var s=document.createElement('span');s.textContent=t;p8t.appendChild(s);});
    var p8i=document.getElementById('prof8Interests');p8i.innerHTML='';
    (L.interests||[]).forEach(function(x){var s=document.createElement('span');s.className='chip'+(m.shared.indexOf(x)!==-1?' active':'');s.textContent=x;p8i.appendChild(s);});
    document.getElementById('prof8Offer').textContent='“'+(L.offer||'—')+'”';
    document.getElementById('prof8Stats').textContent=(L.stats.travellersMet||'—')+' travellers met · '+(L.stats.reviews||'—')+' reviews · '+(L.stats.references||'—')+' references (demo)'+(m.repCount?(' · live: '+m.rep+'★ ('+m.repCount+')'):'');
    var g=document.getElementById('discoverGrid');if(g){
      g.innerHTML='';
      var discoverLocals=getDiscoverLocals();
      g.innerHTML='';
      discoverLocals.forEach(function(x){
        var d=document.createElement('div');d.className='match-card card';
        // shade by compatibility: brighter = better match
        var sc=Math.min(99,Math.max(5,x.score||0));
        d.style.background='rgba(255,255,255,'+(0.55+sc/100*0.45).toFixed(2)+')';
        d.style.boxShadow='0 12px 30px rgba(232,93,117,'+(0.08+sc/100*0.28).toFixed(2)+')';
        var lflag=flagForCountry(x.local.nationality);
        d.innerHTML='<strong></strong><p class="muted"></p>';
        d.querySelector('strong').textContent=lflag+' '+x.local.name+' · '+x.score+(x.repCount?(' · '+x.rep+'★'):'');
        d.querySelector('.muted').textContent=(x.shared.join(' · ')||'No overlap yet')+' — '+x.label+(x.tagBonus?(' · loved by people like you'): '');
        var st=document.createElement('span');st.className='status';st.textContent='Local guide';d.appendChild(st);
        var vb=document.createElement('button');vb.className='secondary';vb.textContent='View';vb.style.marginTop='8px';
        vb.onclick=(function(id){return function(){
          document.getElementById('travRole').classList.add('active');document.getElementById('localRole').classList.remove('active');
          document.getElementById('travellerFlow').classList.remove('hidden');document.getElementById('localFlow').classList.add('hidden');
          focusMatch(id);travNext(8);
        };})(x.local.id);
        d.appendChild(vb);
        g.appendChild(d);
      });
      // Host activities section for Verified/Host
      if(canSeeFullDiscover() && getLocalTier()==='Host'){
        var hostActivities=ETIE.local.activities||[];
        if(hostActivities.length){
          var ha=document.createElement('div');ha.style.marginTop='24px';
          ha.innerHTML='<h3>Host Activities <span class="small muted">(create your own)</span></h3>';
          hostActivities.forEach(function(act){
            var ac=document.createElement('div');ac.className='match-card card';ac.style.marginTop='10px';
            ac.innerHTML='<strong></strong><p class="muted small"></p>';
            ac.querySelector('strong').textContent=act.title;
            ac.querySelector('.muted').textContent=act.description+' · '+act.when+' · '+act.where+' · '+act.capacity+' spots';
            ha.appendChild(ac);
          });
          g.appendChild(ha);
        }else{
          var ha=document.createElement('div');ha.style.marginTop='24px';
          ha.innerHTML='<h3>Host Activities</h3><p class="muted">No activities created yet. <button class="secondary" onclick="alert(\'Activity creation coming in Phase 10\')">Create activity</button></p>';
          g.appendChild(ha);
        }
      }
    }
  }catch(e){}
}

function reqKey(){var m=currentMatch();return m?m.local.id:'local-marta';}
function reqStatus(k){k=k||reqKey();return (ETIE.requests[k]&&ETIE.requests[k].status)||'none';}
function ensureChat(k){
  if(!ETIE.messages[k])ETIE.messages[k]=[];
  if(!ETIE.messages[k].length){
    var m=currentMatch();
    var lname=m?m.local.name:'Local guide';
    ETIE.messages[k].push({from:'local',text:'Hey! Excited to meet you. What are you most looking forward to in Lisbon ('+lname+' here)?',ts:Date.now()-7200000});
  }
}
function sendRequest(){
  toast('sendRequest called');
  var m=currentMatch();if(!m){toast('Find a match first.');return;}
  var k=m.local.id;var msg=document.getElementById('reqMessage').value.trim();
  if(ETIE.requests[k]&&ETIE.requests[k].status==='pending'){toast('Request already pending');travNext(11);return;}
  ETIE.requests[k]={status:'pending',message:msg,updatedAt:Date.now(),localName:m.local.name};
  ensureChat(k);
  ETIE.messages[k].push({from:'traveller',text:'Request: '+(msg||'(no message)'),ts:Date.now()});
  saveState();renderRequests();renderChat();renderMessagesList();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, 'Request: '+(msg||'(no message)'), 'traveller'); }catch(e){}
  toast('Request sent!');
  travNext(11);
}
function acceptCurrent(){var k=reqKey();if(reqStatus(k)==='none'){toast('No pending request — send one as Traveller first.');return;}ETIE.requests[k].status='accepted';ETIE.requests[k].updatedAt=Date.now();ensureChat(k);ETIE.messages[k].push({from:'local',text:'Accepted! Looking forward to meeting. When suits you?',ts:Date.now()});saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedRequest) window.EtieCloud.pushSharedRequest(k); }catch(e){}
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, 'Accepted! Looking forward to meeting. When suits you?', 'local'); }catch(e){}
  toast('Accepted — chat unlocked.');try{openChatPopup();}catch(e){}localNext(10);}
function declineCurrent(){var k=reqKey();if(reqStatus(k)==='none'){toast('No pending request.');return;}ETIE.requests[k].status='declined';ETIE.requests[k].updatedAt=Date.now();saveState();renderRequests();renderChat();renderMessagesList();renderLocalDashboard();
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
  var k=reqKey();
  var input=null;
  if(inputId)input=document.getElementById(inputId);
  if(!input){
    if(who==='local'){
      input=document.getElementById('localChatInput9')&&document.getElementById('localChatInput9').value?document.getElementById('localChatInput9'):document.getElementById('localChatInput');
      // if both exist and 9 is visible, prefer it
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
  if(reqStatus(k)!=='accepted'){toast('Chat unlocks only after Accept.');return;}
  ensureChat(k);ETIE.messages[k].push({from:who,text:text,ts:Date.now()});
  input.value='';saveState();renderChat();renderMessagesList();
  try{ if(window.EtieCloud&&window.EtieCloud.pushSharedMessage) window.EtieCloud.pushSharedMessage(k, text, who); }catch(e){}
}
// Chat popup (mini overlay) — was called from HTML but never defined, so traveller chat never opened
function chatRole(){try{var lf=document.getElementById('localFlow');if(lf&&!lf.classList.contains('hidden'))return 'local';}catch(e){}return 'traveller';}
function openChatPopup(){
  try{
    renderChat();renderMessagesList();
    var o=document.getElementById('chatPopupOverlay');if(o)o.classList.remove('hidden');
    var pi=document.getElementById('chatPopupInput');if(pi)pi.disabled=(reqStatus()!=='accepted');
    setTimeout(function(){try{var p=document.getElementById('chatPopupInput');if(p&&!p.disabled)p.focus();}catch(e){}},80);
  }catch(e){toast('Chat unavailable.');}
}
function closeChatPopup(){try{var o=document.getElementById('chatPopupOverlay');if(o)o.classList.add('hidden');}catch(e){}}
function sendChatPopup(){
  var who=chatRole();var k=reqKey();
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
    if(st==='pending'){rt.textContent='Request pending to '+m.local.name+'.';rs.textContent='Messaging stays locked until they accept. Demo: switch to Local guide flow → dashboard → Accept.';oc.textContent='Check chat (locked)';}
    else if(st==='accepted'){rt.textContent=m.local.name+' accepted your request.';rs.textContent='Messaging is now unlocked. Agree on activity, time and place.';oc.textContent='Open chat';}
    else if(st==='declined'){rt.textContent=m.local.name+' declined.';rs.textContent='Chat stays locked. Try Next suggestion in Step 6.';oc.textContent='Back to matches';oc.onclick=function(){travNext(6);};return;}
    else{rt.textContent='No request yet to '+m.local.name+'.';rs.textContent='Send one from Step 9 to unlock messaging after acceptance.';oc.textContent='Open chat (locked)';}
     oc.onclick=function(){openChatPopup();};
    var lr=document.getElementById('localReqTitle');if(lr)lr.textContent=(ETIE.traveller.nationality?flagForCountry(ETIE.traveller.nationality)+' ':'')+'Etie, 27 · for '+(m?m.local.name:'—');
    var lw=document.getElementById('localReqWhy');    if(lw)lw.textContent=(m.shared.join(' · ')||'New traveller')+' · '+flagForCountry(ETIE.trip.country)+' '+ETIE.trip.destination+' '+ETIE.trip.dates;
    var lm=document.getElementById('localReqMsg');if(lm)lm.textContent=ETIE.requests[k]?('“'+(ETIE.requests[k].message||'')+'”'):'No message yet.';
    var ls=document.getElementById('localReqStatus');if(ls)ls.textContent=st==='none'?'No request yet — send one as Traveller first':st;
  }catch(e){}
}
function renderChat(){
  var m=currentMatch();if(!m)return;var k=m.local.id;var st=reqStatus(k);
  try{
    // Traveller view: my messages on right (black), local on left (grey)
    var ct=document.getElementById('chatTitle');if(ct)ct.textContent='Chat with '+m.local.name;
    var lock=document.getElementById('chatLock');
    if(lock){
      if(st==='accepted')lock.textContent='Unlocked. Keep it simple — aim for a real-world meetup.';
      else if(st==='pending')lock.textContent='Locked — pending. Switch to Local guide to Accept (demo).';
      else if(st==='declined')lock.textContent='Locked — declined.';
      else lock.textContent='Locked — send a request in Step 9 first.';
    }
    var list=document.getElementById('chatList');if(list){list.innerHTML='';
    (ETIE.messages[k]||[]).forEach(function(msg){
      var b=document.createElement('div');b.className='bubble'+(msg.from==='traveller'?' me':'');b.textContent=msg.text;list.appendChild(b);
    });
    if(!(ETIE.messages[k]||[]).length){var d=document.createElement('div');d.className='muted small';d.textContent='No messages yet.';list.appendChild(d);}
    }
    var ci=document.getElementById('chatInput');if(ci)ci.disabled=(st!=='accepted');
    // Local view (mirrored): my (local) messages on right, traveller on left
    var lt=document.getElementById('localChatTitle');
    if(lt)lt.textContent='Chat with Etie (traveller)';
    var ll=document.getElementById('localChatLock');
    if(ll){
      if(st==='accepted')ll.textContent='Unlocked. Coordinate with your traveller, then meet.';
      else if(st==='pending')ll.textContent='Pending — press Accept in the dashboard above to unlock chat.';
      else if(st==='declined')ll.textContent='Declined — chat stays locked.';
      else ll.textContent='No request yet — waiting for a traveller request.';
    }
    var llist=document.getElementById('localChatList');
    if(llist){llist.innerHTML='';
      (ETIE.messages[k]||[]).forEach(function(msg){
        var b=document.createElement('div');b.className='bubble'+(msg.from==='local'?' me':'');b.textContent=msg.text;llist.appendChild(b);
      });
      if(!(ETIE.messages[k]||[]).length){var dd=document.createElement('div');dd.className='muted small';dd.textContent='No messages yet.';llist.appendChild(dd);}
    }
    var li1=document.getElementById('localChatInput');if(li1)li1.disabled=(st!=='accepted');
    var li9=document.getElementById('localChatInput9');if(li9)li9.disabled=(st!=='accepted');
    // Popup (mini, dismissable — doesn't hijack the flow)
    var pT=document.getElementById('chatPopupTitle');if(pT)pT.textContent='Chat with '+(m.local.name||'—');
    var pS=document.getElementById('chatPopupSub');if(pS)pS.textContent=st==='accepted'?'Unlocked — aim for a meetup':(st==='pending'?'Locked — pending Accept':st);
    var pL=document.getElementById('chatPopupList');if(pL){pL.innerHTML='';
      var whoPopup='traveller';try{var lf=document.getElementById('localFlow'); if(lf&&!lf.classList.contains('hidden')) whoPopup='local';}catch(e){}
      (ETIE.messages[k]||[]).forEach(function(msg){
        var b=document.createElement('div');b.className='bubble'+(msg.from===whoPopup?' me':'');b.textContent=msg.text;pL.appendChild(b);
      });
      if(!(ETIE.messages[k]||[]).length){var pd=document.createElement('div');pd.className='muted small';pd.textContent='No messages yet.';pL.appendChild(pd);}
    }
    var pI=document.getElementById('chatPopupInput');if(pI)pI.disabled=(st!=='accepted');
  }catch(e){}
}
function deleteChat(k){ if(!confirm('Delete this chat?')) return; try{ delete ETIE.requests[k]; delete ETIE.messages[k]; delete ETIE.meetups[k]; delete ETIE.reviews[k]; saveState(); renderMessagesList(); renderRequests(); renderChat(); renderTrips(); }catch(e){} try{ var c=window.EtieCloud&&window.EtieCloud.getClient&&window.EtieCloud.getClient(); if(c) c.from('etie_requests').delete().eq('local_mock_id',k).then(function(){}); }catch(e){} toast('Chat deleted.'); }
function renderMessagesList(){
  try{
    var box=document.getElementById('messagesList');if(!box)return;box.innerHTML='';
    var ids=Object.keys(ETIE.requests||{});
    if(isCleanLive()){
      // hide demo pools in clean mode — only show threads whose id is a real user_id or whose localName is not Marta/Javier/Sofia unless it came from live
      var demoIds=['local-marta','local-javier','local-sofia'];
      ids=ids.filter(function(k){ if(demoIds.indexOf(k)!==-1 && !ETIE.requests[k].traveller_id) return false; return true; });
    }
    if(!ids.length){box.innerHTML='<div class="list-item"><div><strong>No chats yet</strong><br><span class="muted">No users online — send a request when a local guide is live. Swipe/delete not needed yet.</span></div><span class="status">Empty</span></div>';return;}
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

function meetKey(){return reqKey();}
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
  var m=meetup();if(m.status==='none'){toast('Traveller plans it in Step 12 first (demo: switch back).');return;}
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
      document.getElementById('thanksSummary').innerHTML='<strong>Saved:</strong> '+t.rating+'★ · '+t.meetAgain+hs+pt+'. Counts toward demo reputation and future matching.';
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

function localNameFor(k){var r=ETIE.requests[k];if(r&&r.localName)return r.localName;var live=liveLocals(); var all= live && live.length ? live : ((window.ETIE_MOCKS&&window.ETIE_MOCKS.locals)||[]);for(var i=0;i<all.length;i++)if(all[i].id===k)return all[i].name;return k;}
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
    var q=document.getElementById('localQueue');
    if(q){q.innerHTML='';var ids=Object.keys(ETIE.requests);
      if(!ids.length)q.innerHTML='<div class="list-item"><div><strong>No requests yet</strong><br><span class="muted">Send one as Traveller Step 9 — try different matches.</span></div><span class="status">Empty</span></div>';
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
    var ae=document.getElementById('localDashAvailEdit');
    if(ae){ae.innerHTML='';ETIE.local.availability.forEach(function(a,i){
      var row=document.createElement('div');row.className='list-item';row.style.cursor='pointer';
      row.innerHTML='<div><strong></strong></div>';row.querySelector('strong').textContent=a.label;
      var st=document.createElement('span');st.className='status';st.textContent=a.status;row.appendChild(st);
      row.onclick=(function(ii){return function(){toggleDashAvail(ii);};})(i);
      ae.appendChild(row);
    });}
    var vis=document.getElementById('localVisibility');
    if(vis){var n=ETIE.local.availability.filter(function(a){return a.status==='Available';}).length;
      vis.textContent=n>0?('Visible (demo): '+n+' Available slot(s) — travellers can match you.'):('Hidden (demo): no Available slots — set one to Available to reappear. Matching score uses this rule.');}
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
    document.getElementById('travCity').value=ETIE.trip.destination;
    var tdf=document.getElementById('travDateFrom');if(tdf)tdf.value=ETIE.trip.dateFrom||'';
    var tdt=document.getElementById('travDateTo');if(tdt)tdt.value=ETIE.trip.dateTo||'';
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
  }catch(e){}
  restorePhotoPreviews();updateCounts();refreshSliderLabels();refreshAnchoredLabels();syncAvailUI();renderProfiles();renderMatches();renderRequests();renderChat();renderMessagesList();renderMeetup();renderThanks();renderTrips();renderLocalDashboard();paintStars('travStars',ETIE._travStars||0);paintStars('localStars',ETIE._localStars||0);
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
document.addEventListener('DOMContentLoaded',function(){
  alphabetisePickers();
  buildCountrySelects();
  restoreAll();
  document.addEventListener('click',function(e){
    try{
      if(!e.target||!e.target.closest)return;
      if(!e.target.closest('.suggest')&&e.target.id!=='travCity'&&e.target.id!=='localCity'){
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
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{closeChatPopup();}catch(e2){}try{closeAdmin();}catch(e3){}}});
  // Subscribe to reviews/reports when cloud is on
  setTimeout(function(){
    if(window.EtieCloud && window.EtieCloud.subscribeReviews) window.EtieCloud.subscribeReviews();
    if(window.EtieCloud && window.EtieCloud.subscribeReports) window.EtieCloud.subscribeReports();
  }, 2000);
});
