// Etie — map-first hooks (vanilla JS + localStorage + Supabase)
// Plain English: drop a hook on the map, connect, verify with photos.
var ETIE_KEY = 'etie-v1';

function todayISO(){ try{ var d=new Date(); var m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return d.getFullYear()+'-'+m+'-'+day; }catch(e){ return ''; } }
function uuidv4(){try{return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,(c)=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c).toString(16));}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,(c)=>((c||crypto.randomUUID?crypto.randomUUID():0).toString(16)));}}

function etieDefaults() {
  return {
    activeRole: null,
    trip: { destination: 'Hong Kong', dates: '', dateFrom: todayISO(), dateTo: '', country: 'HK', district: 'Central / Soho' },
    traveller: {
      nickname: '',
      nationality: '',
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
      city: 'Hong Kong', cities: ['Hong Kong'], district: 'Central / Soho', age: '', nationality: '',
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
window.ETIE = ETIE;
function saveState() { try { localStorage.setItem(ETIE_KEY, JSON.stringify(ETIE)); } catch (e) {} try { if (typeof window!=='undefined' && window.EtieCloud && window.EtieCloud.push) window.EtieCloud.push(); } catch (e) {} }
window.saveState = saveState;

// Photo handling — cloud-first (Supabase Storage), fallback to base64
// Optional travel photos (traveller step 6 + local step 7) — any role, detected by input id

// Tier helpers
// --- HK hook helpers (district/vibe maps + modifiers) ---
// Flag helpers
function flagEmoji(code){if(!code)return '';return String.fromCodePoint(...code.toUpperCase().split('').map(c=>127397+c.charCodeAt(0)));}
function flagForCountry(countryCode){var map={'PT':'🇵🇹','ES':'🇪🇸','FR':'🇫🇷','IT':'🇮🇹','JP':'🇯🇵','TH':'🇹🇭','US':'🇺🇸','AU':'🇦🇺','HK':'🇭🇰','SG':'🇸🇬','GB':'🇬🇧','DE':'🇩🇪','CA':'🇨🇦'};return map[countryCode]||flagEmoji(countryCode)||'🌍';}
function getRegionFlag(p){return flagForCountry(p.region||'HK');}
function flagForCity(name){
  // city or country name -> flag, '' when unknown (never guess)
  try{
    if(!name)return '';
    var n=String(name).trim().toLowerCase();if(!n)return '';
    var hit=null;
    (window.ETIE_CITIES||[]).forEach(function(c){if(!hit&&c&&c.city&&String(c.city).toLowerCase()===n)hit=c.code;});
    if(!hit)(window.ETIE_COUNTRIES||[]).forEach(function(c){if(!hit&&c&&c.name&&String(c.name).toLowerCase()===n)hit=c.code;});
    return hit?flagForCountry(hit):'';
  }catch(e){return '';}
}

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
    var panels=['messages','profile'];
    var want=[id];
    panels.forEach(function(p){var el=document.getElementById(p);if(el)el.classList.toggle('panel-open',want.indexOf(p)!==-1);});
    // Disable map pointer events when a panel is open so map doesn't block
    var mapEl=document.getElementById('map');
    if(mapEl){
      if(id==='map'){mapEl.style.pointerEvents='';}
      else{mapEl.style.pointerEvents='none';}
    }
    if(id==='profile'){renderLiteProfile();try{addQuestionArchiveLink();}catch(e){}}
    if(id==='messages'){try{renderHookChatList();}catch(e){}}
    if(id==='map'){try{initHKMap();if(window.maplibregl&&_map){setTimeout(function(){try{_map.resize();}catch(e){}},120);}renderMapPins();}catch(e){}}
  }catch(e){}
}



var ETIE_AVAIL_YM=null, ETIE_AVAIL_DRAG=null;


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




window.ETIE_ADMINS=['kan.ethan.cy@gmail.com'];
function debugGroupsEnabled(){try{return new URLSearchParams(window.location.search).get('debugGroups')==='1';}catch(e){return false;}}
function isEtieAdmin(){try{var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession();var em=s&&s.user&&s.user.email;if(em&&window.ETIE_ADMINS.indexOf(em.toLowerCase())!==-1)return true;}catch(e){} try{var q=new URLSearchParams(window.location.search).get('admin');if(q==='1'&&localStorage.getItem('etie-admin-unlock')==='1')return true;}catch(e){} return false;}
function canManagePin(p){try{var myId=myUid();if(myId&&p&&p.authorId&&myId===p.authorId)return true;}catch(e){}return false;}
function updateAdminVisibility(){try{var b=document.getElementById('adminBtn');if(b)b.style.display=isEtieAdmin()?'':'none';if(!isEtieAdmin())closeAdmin();}catch(e){}}
function openAdmin(){if(!isEtieAdmin()){toast('Admin restricted.');return;}try{var o=document.getElementById('adminOverlay');if(o)o.classList.remove('hidden');}catch(e){} try{ refreshAdminLive(); }catch(e){}}
function closeAdmin(){try{var o=document.getElementById('adminOverlay');if(o)o.classList.add('hidden');}catch(e){}}
function toggleAdmin(){if(!isEtieAdmin()){toast('Admin restricted.');return;}try{var o=document.getElementById('adminOverlay');if(!o)return;if(o.classList.contains('hidden'))openAdmin();else closeAdmin();}catch(e){}}

function wipeLocalEtie(){ try{ if(!confirm('Wipe local ETIE (requests/messages/meetups/reviews, keep profile)?')) return; ETIE.requests={}; ETIE.messages={}; ETIE.meetups={}; ETIE.reviews={}; ETIE._travStars=0; ETIE._localStars=0; saveState(); renderHookChatList(); renderMapPins(); toast('Local wiped — also run SQL wipe for cloud.'); }catch(e){} }
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
  // Fetch reports
  try{
    if(window.EtieCloud&&window.EtieCloud.fetchReports){
      window.EtieCloud.fetchReports(function(reps){
        try{
          var rc=document.getElementById('adminReportsCount');if(rc)rc.textContent=reps?reps.length:'0';
          var rl=document.getElementById('adminReportsList');
          if(rl){
            rl.innerHTML='';
            if(!reps||!reps.length){rl.innerHTML='<div class="muted small">No pending reports.</div>';return;}
            reps.forEach(function(r){
              var row=document.createElement('div');
              row.className='list-item';
              row.innerHTML='<div><strong></strong><br><span class="muted small"></span></div><span class="status"></span>';
              row.querySelector('strong').textContent='Report: '+(r.reason||'unspecified');
              row.querySelector('span.muted').textContent=new Date(r.created_at).toLocaleString();
              row.querySelector('span.status').textContent=r.status;
              rl.appendChild(row);
            });
          }
        }catch(e){}
      });
    }
  }catch(e){}
  // Fetch reported questions
  try{
    if(window.EtieCloud&&window.EtieCloud.fetchReportedQuestions){
      window.EtieCloud.fetchReportedQuestions(function(qs){
        try{
          var rl=document.getElementById('adminReportedQuestions');
          if(rl){
            rl.innerHTML='';
            if(!qs||!qs.length){rl.innerHTML='<div class="muted small">No reported questions.</div>';return;}
            qs.forEach(function(q){
              var row=document.createElement('div');
              row.className='list-item';
              row.innerHTML='<div><strong></strong><br><span class="muted small"></span></div><span class="status"></span>';
              row.querySelector('strong').textContent='Question: '+(q.question_text||'').substring(0,40);
              row.querySelector('span.muted').textContent=new Date(q.created_at).toLocaleString()+' · '+q.status;
              row.querySelector('span.status').textContent=q.status;
              rl.appendChild(row);
            });
          }
        }catch(e){}
      });
    }
  }catch(e){}
  }catch(e){ try{ var h=document.getElementById('adminLiveHint'); if(h) h.textContent='Live refresh failed.'; }catch(e2){}}
}


// Demo personas — permanent test individuals for solo testing (same browser, no second phone).
// Cloud sync pauses while a persona is active so demo play never pollutes real tables.
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
function toggleAvatarMenu(e){ try{ if(e&&e.stopPropagation) e.stopPropagation(); var btn=document.getElementById('headerProfile'); var d=document.getElementById('avatarDropdown'); if(!d||!btn)return; var opening=d.classList.contains('hidden'); if(opening){ d.classList.remove('hidden'); btn.setAttribute('aria-expanded','true'); document.body.appendChild(d); void btn.offsetHeight; var r=btn.getBoundingClientRect(); d.style.position='fixed'; d.style.top=(r.bottom+8)+'px'; d.style.left=Math.max(8,r.right-d.offsetWidth)+'px'; d.style.right='auto'; }else{ d.classList.add('hidden'); btn.setAttribute('aria-expanded','false'); var am=document.getElementById('avatarMenu'); if(am && d.parentNode!==am) am.appendChild(d); d.style.position=''; d.style.top=''; d.style.right=''; d.style.left=''; } }catch(_){} }
function closeAvatarMenu(){ try{ var d=document.getElementById('avatarDropdown'); if(d){ d.classList.add('hidden'); var am=document.getElementById('avatarMenu'); if(am && d.parentNode!==am) am.appendChild(d); d.style.position=''; d.style.top=''; d.style.right=''; d.style.left=''; } var btn=document.getElementById('headerProfile'); if(btn) btn.setAttribute('aria-expanded','false'); }catch(_){} }
// tapping anywhere outside the profile button dismisses the header dropdown
document.addEventListener('click',function(){try{closeAvatarMenu();}catch(_){}});
function closeAllModals(){
  try{closeChatDrawer();}catch(_){}
  try{closePinDetail();}catch(_){}
  try{closeDropHook();}catch(_){}
  try{closeLogSheet();}catch(_){}
  try{closeGroupModal();}catch(_){}
  try{closeQuestDrawer();}catch(_){}
  try{closeQuestCamera();}catch(_){}
  try{closeSetQuestModal();}catch(_){}
  try{closeCustomQuestInput();}catch(_){}
  try{closeProfileDrawer();}catch(_){}
  try{closeHandshakeModal();}catch(_){}
  try{closeAdmin();}catch(_){}
}
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
function addQuestionArchiveLink(){
  try{
    var view=document.getElementById('profileDrawerView');
    if(!view)return;
    if(document.getElementById('qArchiveLink'))return;
    var link=document.createElement('button');
    link.id='qArchiveLink';
    link.className='secondary';
    link.style.cssText='margin-top:16px;padding:10px 16px;width:100%;text-align:left;min-height:44px;';
    link.textContent='\ud83d\udcac Question Exchanges';
    link.onclick=function(){openQuestionArchiveFromProfile();};
    view.appendChild(link);
  }catch(e){}
}
function openQuestionArchiveFromProfile(){
  try{closeProfileDrawer();openQuestionArchive();}catch(e){}
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
    var ci=document.getElementById('liteCity'); if(ci&&document.activeElement!==ci&&!ci.value)ci.placeholder='Type a city, Enter to add';
    try{renderHomeCityChips();}catch(e){}
    try{fillNationalityList();var _ns=document.getElementById('liteNationality');if(_ns)_ns.value=ETIE.local.nationality||ETIE.traveller.nationality||'';}catch(e){}
    var photo=tr.photo||ETIE.local.photo||googleAvatar();
    var av=document.getElementById('liteAvatar');
    if(av){if(photo)av.innerHTML='<img src="'+photo+'">';else av.innerHTML='<span>+</span>';}
    var rl=document.getElementById('liteRoleLine');
    if(rl){var role=(ETIE.derivedRole||ETIE.activeRole||'traveller');rl.textContent=(role==='local'?'\uD83C\uDDED\uD83C\uDDF0 Local host':'\u2708\uFE0F Traveller')+' \u00B7 '+homeCitiesLabelFlags();}
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
    var ct=document.getElementById('doneCity'); if(ct){var _nl=nationalityLabel();ct.textContent='🏠 '+homeCitiesLabelFlags()+(_nl?' · '+_nl:'');}
    var vs=document.getElementById('doneVibes');
    if(vs){var _vp=vs.closest('.field');if(_vp)_vp.style.display='none';}
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
    var mem=document.getElementById('memoryMapDrawerView');
    var pass=document.getElementById('passportDrawerView');
    var t1=document.getElementById('tabDrawerProfile');
    var t2=document.getElementById('tabDrawerMemories');
    var t3=document.getElementById('tabDrawerPassport');
    // Hide all
    if(prof)prof.classList.remove('active');
    if(mem)mem.classList.remove('active');
    if(pass)pass.classList.remove('active');
    if(t1)t1.classList.remove('active');
    if(t2)t2.classList.remove('active');
    if(t3)t3.classList.remove('active');
    if(tab==='passport'){
      var pass=document.getElementById('passportDrawerView'); if(pass)pass.classList.add('active');
      var t3=document.getElementById('tabDrawerPassport'); if(t3)t3.classList.add('active');
      renderPassportDrawer();
    }else if(tab==='memories'){
      var mem=document.getElementById('memoryMapDrawerView'); if(mem)mem.classList.add('active');
      var t2=document.getElementById('tabDrawerMemories'); if(t2)t2.classList.add('active');
      renderMemoryMapFull();
    }else{
      var prof=document.getElementById('profileDrawerView'); if(prof)prof.classList.add('active');
      var t1=document.getElementById('tabDrawerProfile'); if(t1)t1.classList.add('active');
      showProfileSegment('grid'); // default to grid
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
    var ct=document.getElementById('drawerCity'); if(ct){var _nl=nationalityLabel();ct.textContent='🏠 '+homeCitiesLabelFlags()+(_nl?' · '+_nl:'');}
    var vs=document.getElementById('drawerVibes');
    if(vs){var _vp=vs.closest('.field');if(_vp)_vp.style.display='none';}
    var hk=document.getElementById('drawerHook'); if(hk)hk.textContent='“'+(tr.bio||'No personal hook yet.')+'”';
    renderDrawerMemories();
    renderDrawerSpots();
    renderDrawerPassions();
    renderDrawerFeaturedMemories();
  }catch(e){}
}
// ===== Profile Segment Toggle (Map / Grid) =====
function showProfileSegment(seg){
  try{
    var map=document.getElementById('profileSegmentMap');
    var grid=document.getElementById('profileSegmentGrid');
    var btnMap=document.getElementById('segProfileMap');
    var btnGrid=document.getElementById('segProfileGrid');
    if(!map||!grid)return;
    if(seg==='map'){
      if(map)map.style.display='block';
      if(grid)grid.style.display='none';
      if(btnMap){btnMap.classList.add('active');btnMap.style.color='#fff';btnMap.style.background='rgba(244,63,94,.2)';btnMap.style.borderColor='rgba(244,63,94,.5)';}
      if(btnGrid){btnGrid.classList.remove('active');btnGrid.style.color='rgba(255,255,255,.7)';btnGrid.style.background='rgba(255,255,255,.08)';btnGrid.style.borderColor='rgba(255,255,255,.16)';}
      renderProfileMemoryMap();
    }else{
      if(map)map.style.display='none';
      if(grid)grid.style.display='block';
      if(btnGrid){btnGrid.classList.add('active');btnGrid.style.color='#fff';btnGrid.style.background='rgba(244,63,94,.2)';btnGrid.style.borderColor='rgba(244,63,94,.5)';}
      if(btnMap){btnMap.classList.remove('active');btnMap.style.color='rgba(255,255,255,.7)';btnMap.style.background='rgba(255,255,255,.08)';btnMap.style.borderColor='rgba(255,255,255,.16)';}
    }
  }catch(e){}
}
// ===== Profile Memory Map (Map segment in Profile tab) =====
var _profileMemoryMap=null;
function renderProfileMemoryMap(){
  try{
    var container=document.getElementById('memoryMap');
    if(!container)return;
    if(_profileMemoryMap){try{if(_profileMemoryMap._memoryMarkers)_profileMemoryMap._memoryMarkers.forEach(function(m){try{if(m._interval)clearInterval(m._interval);}catch(e){}});}catch(e){}try{_profileMemoryMap.remove();}catch(e){}_profileMemoryMap=null;}
    container.innerHTML='';
    if(!window.maplibregl){container.innerHTML='<div class="muted" style="padding:20px;text-align:center;">Map loading…</div>';return;}
    if(window.EtieMapStyle && typeof window.EtieMapStyle.load === 'function'){
      window.EtieMapStyle.load(function(style){
        if(!style){showMapConfigError('memoryMap');return;}
        _profileMemoryMap = new maplibregl.Map({
          container:'memoryMap',
          projection:'globe',
          style:style,
          center:[HK_CENTER[1],HK_CENTER[0]],
          zoom:11,
          attributionControl:false
        });
        if(!_profileMemoryMap)return;
        _profileMemoryMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
        fetchAndRenderMemoryMarkers(_profileMemoryMap);
      });
    } else {
      _profileMemoryMap=createEtieMap('memoryMap',{
        center:[HK_CENTER[1],HK_CENTER[0]],
        zoom:11,
        attributionControl:false
      });
      if(!_profileMemoryMap)return;
      _profileMemoryMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
      fetchAndRenderMemoryMarkers(_profileMemoryMap);
    }
  }catch(e){console.error('renderProfileMemoryMap',e);}
}
// ===== Full Memory Map (Memories tab) =====
var _memoryMapFull=null;
function renderMemoryMapFull(){
  try{
    var container=document.getElementById('memoryMapFull');
    if(!container)return;
    if(_memoryMapFull){try{if(_memoryMapFull._memoryMarkers)_memoryMapFull._memoryMarkers.forEach(function(m){try{if(m._interval)clearInterval(m._interval);}catch(e){}});}catch(e){}try{_memoryMapFull.remove();}catch(e){}_memoryMapFull=null;}
    container.innerHTML='';
    if(!window.maplibregl){container.innerHTML='<div class="muted" style="padding:20px;text-align:center;">Map loading…</div>';return;}
    if(window.EtieMapStyle && typeof window.EtieMapStyle.load === 'function'){
      window.EtieMapStyle.load(function(style){
        if(!style){showMapConfigError('memoryMapFull');return;}
        _memoryMapFull = new maplibregl.Map({
          container:'memoryMapFull',
          projection:'globe',
          style:style,
          center:[HK_CENTER[1],HK_CENTER[0]],
          zoom:11,
          attributionControl:false
        });
        if(!_memoryMapFull)return;
        _memoryMapFull.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
        fetchAndRenderMemoryMarkers(_memoryMapFull, function(count){
          var el=document.getElementById('memoryMapCount');
          if(el)el.textContent=count+' memory'+(count===1?'':'s')+' mapped';
        });
      });
    } else {
      _memoryMapFull=createEtieMap('memoryMapFull',{
        center:[HK_CENTER[1],HK_CENTER[0]],
        zoom:11,
        attributionControl:false
      });
      if(!_memoryMapFull)return;
      _memoryMapFull.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
      fetchAndRenderMemoryMarkers(_memoryMapFull, function(count){
        var el=document.getElementById('memoryMapCount');
        if(el)el.textContent=count+' memory'+(count===1?'':'s')+' mapped';
      });
    }
    fetchAndRenderMemoryMarkers(_memoryMapFull, function(count){
      var el=document.getElementById('memoryMapCount');
      if(el)el.textContent=count+' memory'+(count===1?'':'s')+' mapped';
    });
  }catch(e){console.error('renderMemoryMapFull',e);}
}
// ===== Fetch hangout logs and render photo markers with clustering =====
// A hangout with N tagged people is stored as N rows (one tagged_user_id each).
// Collapse them into one entry so a single hangout never shows up N times, and
// merge everyone's names so the popup can still say who was there.
function dedupeMemories(logs){
  try{
    var map={},order=[];
    (logs||[]).forEach(function(l){
      try{
        if(!l)return;
        var k=(l.photo_url||'')+'|'+(l.taken_at||'')+'|'+(l.location||'')+'|'+l.lat+','+l.lng;
        var ex=map[k];
        if(!ex){
          ex={};for(var f in l){if(Object.prototype.hasOwnProperty.call(l,f))ex[f]=l[f];}
          ex._people=[];ex._nicknames=[];
          map[k]=ex;order.push(ex);
        }
        if(l.tagged_user_id&&ex._people.indexOf(l.tagged_user_id)<0){
          ex._people.push(l.tagged_user_id);
          if(l.tagged_nickname&&ex._nicknames.indexOf(l.tagged_nickname)<0)ex._nicknames.push(l.tagged_nickname);
        }
        if(l.status==='confirmed')ex.status='confirmed';
      }catch(e){}
    });
    return order;
  }catch(e){return logs||[];}
}

// MEMORY_GROUP_RADIUS_M: max distance (meters) for two memories to join the same group.
// Single source of truth — change here only.
var MEMORY_GROUP_RADIUS_M = 100;

// Group flat memory rows into spots (one pin per location, multiple photos).
// Greedy haversine grouping: first memory is the anchor and never moves;
// a memory within range of two anchors joins the nearer one. ~200m max span.
function groupMemoriesIntoSpots(logs){
  try{
    var groups=[]; // {anchor:{lat,lng}, spot:{...}}
    (logs||[]).forEach(function(l){
      try{
        if(!l||l.lat==null||l.lng==null||!l.photo_url)return;
        var bestIdx=-1,bestDist=Infinity;
        for(var i=0;i<groups.length;i++){
          var g=groups[i];
          var d=haversineKm(g.anchor.lat,g.anchor.lng,l.lat,l.lng)*1000;
          if(d<=MEMORY_GROUP_RADIUS_M && d<bestDist){bestDist=d;bestIdx=i;}
        }
        if(bestIdx>=0){
          groups[bestIdx].spot.photos.push({url:l.photo_url,caption:l.title||l.location||'',timestamp:l.taken_at||l.created_at||'',logId:l.id,owner:l.nickname||'Someone',ownerId:l.user_id});
        }else{
          var key=l.lat.toFixed(4)+','+l.lng.toFixed(4);
          groups.push({anchor:{lat:l.lat,lng:l.lng},spot:{id:'spot-'+key,name:l.location||l.title||'Hangout',coords:{lat:l.lat,lng:l.lng},owner:l.nickname||'Someone',ownerId:l.user_id,photos:[{url:l.photo_url,caption:l.title||l.location||'',timestamp:l.taken_at||l.created_at||'',logId:l.id,owner:l.nickname||'Someone',ownerId:l.user_id}]}});
        }
      }catch(e){}
    });
    return groups.map(function(g){return g.spot;});
  }catch(e){return [];}
}

// Rotating square memory marker with neon glow
function createMemorySpotMarker(spot,mapInstance){
  try{
    var el=document.createElement('div');
    el.className='memory-spot-marker';
    el.style.width='64px';
    el.style.height='64px';
    el.style.borderRadius='8px';
    el.style.overflow='hidden';
    el.style.position='relative';
    el.style.cursor='pointer';
    
    var img=document.createElement('img');
    img.src=spot.photos[0]?.url||'';
    img.style.width='100%';
    img.style.height='100%';
    img.style.objectFit='cover';
    img.style.transition='opacity 0.5s ease';
    el.appendChild(img);
    
    // Photo cycling if multiple
    if(spot.photos.length>1){
      var idx=0;
      var interval=setInterval(function(){
        try{
          idx=(idx+1)%spot.photos.length;
          img.style.opacity='0';
          setTimeout(function(){
            img.src=spot.photos[idx].url;
            img.style.opacity='1';
          },250);
        }catch(e){}
      },3500);
      // Store interval for cleanup
      el._interval=interval;
    }
    
    el.addEventListener('click',function(e){
      try{e.stopPropagation();e.preventDefault();}catch(_){}
      _pinJustClicked=true;
      setTimeout(function(){_pinJustClicked=false;},300);
      console.log('Memory marker clicked, spot:', spot.name, 'photos:', spot.photos.length);
      if(spot.photos.length<=1){
        window._memGroupPhotos=spot.photos;
        openMemorySingleView(0, spot);
      }else{
        openMemorySpotCard(spot);
      }
    });
    
    var mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([spot.coords.lng,spot.coords.lat]).addTo(mapInstance);
    mk._spot=spot;
    mk._interval=el._interval;
    return mk;
  }catch(e){console.error('createMemorySpotMarker error:',e);return null;}
}

// Open memory card for a spot (shows all photos)
// ===== Deep-question exchange (Q2) =====
var _wrapupPinId=null;
var _wrapupAskStep=0; // 0=not started, 1=asked, 2=answered
var _wrapupDismissed=false;

// Check for ended hangouts that need questions
function checkWrapupCard(){
  try{
    if(!window.EtieCloud||!window.EtieCloud.fetchMyQuestions||!isSignedIn())return;
    window.EtieCloud.fetchMyQuestions(function(questions){
      try{
        // Find ended hangouts where user hasn't asked or answered
        var pins=allMapPins()||[];
        var now=Date.now();
        var myId=null;try{myId=myUid();}catch(e){}
        if(!myId)return;
        var needingQuestions=[];
        pins.forEach(function(p){
          try{
            var state=getPinLifecycleState(p);
            if(state!=='ended'&&state!=='vanished')return;
            // Check if hangout ended >24h ago
            var endAt=validTs(p.hangoutEndAt)||validTs(p.expires_at);
            if(!endAt||now<endAt+24*3600000)return;
            // Check if user is a member
            var me=hookNick();
            var isMember=(p.members||[]).some(function(m){return m.nick===me;});
            if(!isMember)return;
            // Check if user has asked/answered for this hangout
            var asked=(questions||[]).filter(function(q){return q.hangout_id===p.id&&q.asker_id===myId;});
            var answered=(questions||[]).filter(function(q){return q.hangout_id===p.id&&q.answerer_id===myId&&q.status==='answered';});
            var askPending=(questions||[]).filter(function(q){return q.hangout_id===p.id&&q.answerer_id===myId&&q.status==='asked';});
            if(!asked.length||askPending.length){
              needingQuestions.push({pin:p,asked:asked.length,answerPending:askPending.length});
            }
          }catch(e){}
        });
        if(needingQuestions.length){
          showWrapupCard(needingQuestions);
        }else{
          hideWrapupCard();
        }
      }catch(e){}
    });
  }catch(e){}
}

function showWrapupCard(items){
  try{
    // Show popup once
    if(!_wrapupDismissed){
      showWrapupPopup(items);
      _wrapupDismissed=true;
    }
    // Show persistent card
    var existing=document.getElementById('wrapupCard');
    if(existing)existing.remove();
    var card=document.createElement('div');
    card.id='wrapupCard';
    card.style.cssText='position:fixed;top:64px;left:50%;transform:translateX(-50%);width:min(520px,94vw);background:rgba(20,16,28,.95);border:1px solid rgba(244,63,94,.3);border-radius:14px;padding:14px;z-index:9998;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.4);';
    var item=items[0];
    var p=item.pin;
    var otherMembers=(p.members||[]).filter(function(m){return m.nick!==hookNick();});
    card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
      +'<strong style="font-size:14px;color:#f43f5e;">Wrap-up: '+(p.title||p.location||'Hangout')+'</strong>'
      +'<button onclick="hideWrapupCard()" style="background:transparent;border:0;color:rgba(255,255,255,.5);cursor:pointer;font-size:16px;padding:4px;" aria-label="Dismiss">\u2715</button>'
      +'</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px;">'
      +'<div>1. Did the hangout happen? <button onclick="wrapupDidHappen(true)" style="padding:2px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">Yes</button> <button onclick="wrapupDidHappen(false)" style="padding:2px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">No</button></div>'
      +'<div>2. Log hangout <button onclick="wrapupLogHangout()" style="padding:2px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">Log</button></div>'
      +'<div>3. Ask your question <button onclick="wrapupAskQuestion()" style="padding:2px 8px;background:#f43f5e;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:11px;">Ask</button></div>'
      +(item.answerPending?'<div>4. Answer question <button onclick="wrapupAnswerQuestion()" style="padding:2px 8px;background:#22d3ee;color:#000;border:0;border-radius:4px;cursor:pointer;font-size:11px;">Answer</button></div>':'')
      +'</div>';
    // Store for later use
    window._wrapupPin=p;
    window._wrapupItem=item;
    document.body.appendChild(card);
  }catch(e){}
}

function hideWrapupCard(){
  try{var c=document.getElementById('wrapupCard');if(c)c.remove();}catch(e){}
}

function showWrapupPopup(items){
  try{
    var overlay=document.createElement('div');
    overlay.id='wrapupPopupOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(244,63,94,.3);border-radius:16px;padding:24px;max-width:440px;width:90%;color:#fff;text-align:center;';
    card.innerHTML='<h3 style="margin:0 0 12px;color:#f43f5e;">Hangout Wrap-up</h3>'
      +'<p style="font-size:14px;color:rgba(255,255,255,.7);margin-bottom:20px;">Time to reflect on your hangout. A few quick questions to complete.</p>'
      +'<button onclick="closeWrapupPopup()" style="padding:10px 24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:13px;">Later</button>';
    overlay.appendChild(card);
    overlay.onclick=function(e){if(e.target===overlay)closeWrapupPopup();};
    document.body.appendChild(overlay);
  }catch(e){}
}

function closeWrapupPopup(){
  try{var o=document.getElementById('wrapupPopupOverlay');if(o)o.remove();}catch(e){}
}

function wrapupDidHappen(yes){
  try{
    if(!yes){
      if(confirm('Report a problem with this hangout?')){
        toast('Report submitted. We\'ll review it.');
      }
      hideWrapupCard();
      return;
    }
    // Move to next step
    wrapupAskQuestion();
  }catch(e){}
}

function wrapupLogHangout(){
  try{
    hideWrapupCard();
    var p=window._wrapupPin;
    if(p)openLogSheet(p.id);
  }catch(e){}
}

function wrapupAskQuestion(){
  try{
    var p=window._wrapupPin;
    if(!p)return;
    var me=hookNick();
    var myId=null;try{myId=myUid();}catch(e){}
    if(!myId)return;
    var others=(p.members||[]).filter(function(m){return m.nick!==me&&m.uid;});
    if(!others.length){toast('No one else to ask.');return;}
    // Show picker: let user choose who to ask first
    var old=document.getElementById('askPickerOverlay');if(old)old.remove();
    var overlay=document.createElement('div');
    overlay.id='askPickerOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;max-width:400px;width:90%;color:#fff;';
    var html='<h3 style="margin:0 0 12px;color:#f43f5e;">Who do you want to ask first?</h3>';
    html+='<p style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:12px;">You need to ask everyone. Pick who to start with.</p>';
    others.forEach(function(m){
      html+='<button onclick="askPickedMember(\''+m.uid+'\',\''+m.nick+'\')" style="display:block;width:100%;padding:10px 14px;margin-bottom:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;">Ask '+(m.nick||'Someone')+'</button>';
    });
    html+='<button onclick="document.getElementById(\'askPickerOverlay\').remove()" style="margin-top:8px;padding:8px 16px;background:transparent;border:0;color:rgba(255,255,255,.5);cursor:pointer;font-size:12px;">Cancel</button>';
    card.innerHTML=html;
    overlay.appendChild(card);
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  }catch(e){}
}

function askPickedMember(uid, nick){
  try{
    var overlay=document.getElementById('askPickerOverlay');if(overlay)overlay.remove();
    var p=window._wrapupPin;
    if(!p)return;
    var myId=null;try{myId=myUid();}catch(e){}
    if(!myId)return;
    var question=prompt('Ask '+(nick||'them')+' something you\'d genuinely want to know (max 250 chars):');
    if(!question)return;
    question=question.trim().slice(0,250);
    if(question.length<1)return;
    var endAt=validTs(p.hangoutEndAt)||validTs(p.expires_at)||new Date().toISOString();
    if(window.EtieCloud&&window.EtieCloud.createQuestion){
      window.EtieCloud.createQuestion(p.id, myId, uid, question, endAt, function(res){
        try{
          if(res&&res.ok){
            // Log to personal question bank
            ETIE.questionBank=ETIE.questionBank||[];
            ETIE.questionBank.push({hangout_id:p.id, asker:myId, answerer:uid, answerer_nick:nick, question:question, asked_at:new Date().toISOString(), order:ETIE.questionBank.length+1});
            saveState();
            toast('Question sent to '+(nick||'them')+'!');
            window._wrapupAskStep=1;
            checkWrapupCard();
          }else{
            toast('Failed: '+(res&&res.error||'unknown'));
          }
        }catch(e){}
      });
    }
  }catch(e){}
}

function wrapupAnswerQuestion(){
  try{
    var item=window._wrapupItem;
    if(!item)return;
    // Find pending question for this user
    if(window.EtieCloud&&window.EtieCloud.fetchMyQuestions){
      window.EtieCloud.fetchMyQuestions(function(questions){
        try{
          var myId=null;try{myId=myUid();}catch(e){}
          var pending=(questions||[]).filter(function(q){return q.hangout_id===item.pin.id&&q.answerer_id===myId&&q.status==='asked';});
          if(!pending.length){toast('No pending questions.');return;}
          var q=pending[0];
          var answer=prompt('Your answer to: "'+q.question_text+'" (max 600 chars):');
          if(!answer)return;
          answer=answer.trim().slice(0,600);
          if(answer.length<1)return;
          if(window.EtieCloud&&window.EtieCloud.insertAnswer){
            window.EtieCloud.insertAnswer(q.id, answer, function(res){
              try{
                if(res&&res.ok){
                  toast('Answer saved!');
                  window._wrapupAskStep=2;
                  checkWrapupCard();
                }else{
                  toast('Failed: '+(res&&res.error||'unknown'));
                }
              }catch(e){}
            });
          }
        }catch(e){}
      });
    }
  }catch(e){}
}

// Gate: check if user owes questions before allowing hangout requests
function checkQuestionGate(pinId){
  try{
    if(!isSignedIn())return true; // allow if not signed in (will be blocked by auth gate anyway)
    // Check for ended hangouts with pending questions
    if(window._wrapupItem){
      // User has pending wrap-up — block new hangout requests
      return false;
    }
    return true;
  }catch(e){return true;}
}

// ===== Q3: Reveal and Archive =====
var _questionArchiveOpen=false;
var _hiddenExchanges={}; // question_id -> true (user hid this exchange)

function openQuestionArchive(){
  try{
    var old=document.getElementById('questionArchiveOverlay');if(old)old.remove();
    var overlay=document.createElement('div');
    overlay.id='questionArchiveOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;max-width:640px;width:90%;max-height:85vh;overflow-y:auto;color:#fff;';
    card.innerHTML='<h3 style="margin:0 0 16px;color:#f43f5e;">Question Exchanges</h3><div id="questionArchiveList"><div class="muted small">Loading...</div></div>'
      +'<button onclick="document.getElementById(\'questionArchiveOverlay\').remove()" style="margin-top:16px;padding:8px 16px;background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:12px;">Close</button>';
    overlay.appendChild(card);
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
    loadQuestionArchive();
  }catch(e){}
}

function loadQuestionArchive(){
  try{
    var list=document.getElementById('questionArchiveList');
    if(!list)return;
    if(!window.EtieCloud||!window.EtieCloud.fetchMyQuestions){list.innerHTML='<div class="muted small">Cloud not ready.</div>';return;}
    window.EtieCloud.fetchMyQuestions(function(questions){
      try{
        if(!questions||!questions.length){list.innerHTML='<div class="muted small">No question exchanges yet.</div>';return;}
        // Filter out hidden exchanges
        var visible=questions.filter(function(q){return !_hiddenExchanges[q.id];});
        if(!visible.length){list.innerHTML='<div class="muted small">All exchanges hidden.</div>';return;}
        // Group by person
        var myId=null;try{myId=myUid();}catch(e){}
        var byPerson={};
        visible.forEach(function(q){
          var other=q.asker_id===myId?q.answerer_id:q.asker_id;
          if(!byPerson[other])byPerson[other]=[];
          byPerson[other].push(q);
        });
        // Fetch display names
        var otherIds=Object.keys(byPerson);
        var renderArchive=function(nameMap){
          try{
            list.innerHTML='';
            otherIds.forEach(function(otherId){
              var personName=(nameMap&&nameMap[otherId])||otherId.substring(0,8)+'...';
              var header=document.createElement('div');
              header.style.cssText='font-size:14px;font-weight:700;color:#fff;margin-top:16px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.1);';
              header.textContent=personName;
              list.appendChild(header);
              byPerson[otherId].forEach(function(q){
                var row=document.createElement('div');
                row.style.cssText='padding:10px;background:rgba(255,255,255,.05);border-radius:8px;margin-bottom:8px;';
                var now=Date.now();
                var revealTime=q.reveal_at?new Date(q.reveal_at).getTime():0;
                var isRevealed=now>=revealTime;
                var state='';
                var stateColor='';
                if(q.status==='reported'){
                  state='Reported';stateColor='#f87171';
                }else if(!isRevealed){
                  if(q.answerer_id===myId&&q.status==='asked'){
                    state='Needs your answer';stateColor='#fbbf24';
                  }else{
                    state='Sealed';stateColor='#a78bfa';
                  }
                }else{
                  if(q.status==='asked'){
                    state='Your turn to ask';stateColor='#f43f5e';
                  }else if(q.status==='answered'){
                    state='Unlocked';stateColor='#4ade80';
                  }
                }
                var hrsLeft=Math.max(0,Math.ceil((revealTime-now)/3600000));
                row.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;">'
                  +'<div style="flex:1;min-width:0;">'
                  +'<div style="font-size:12px;color:#fff;margin-bottom:2px;">'+(q.question_text||'').substring(0,60)+(q.question_text&&q.question_text.length>60?'...':'')+'</div>'
                  +'<div style="font-size:11px;color:rgba(255,255,255,.5);">'+(q.status==='answered'?'Answered':'Asked')+'</div>'
                  +'</div>'
                  +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">'
                  +'<span style="font-size:11px;color:'+stateColor+';font-weight:700;">'+state+'</span>'
                  +(state==='Sealed'?'<span style="font-size:10px;color:rgba(255,255,255,.5);">Unlocks in '+hrsLeft+'h</span>':'')
                  +'<button onclick="openRevealScreen(\''+q.id+'\')" style="padding:4px 10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">View</button>'
                  +'<button onclick="hideExchange(\''+q.id+'\')" style="padding:2px 6px;background:transparent;border:0;color:rgba(255,255,255,.4);cursor:pointer;font-size:11px;" title="Remove from view">Hide</button>'
                  +'</div>'
                  +'</div>';
                list.appendChild(row);
              });
            });
          }catch(e){}
        };
        if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames&&otherIds.length){
          window.EtieCloud.fetchDisplayNames(otherIds, renderArchive);
        }else{
          renderArchive({});
        }
      }catch(e){list.innerHTML='<div class="muted small">Error loading.</div>';}
    });
  }catch(e){}
}

function readItBack(questionId){
  try{
    // Show the answerer's own version (they can always see their own)
    if(window.EtieCloud&&window.EtieCloud.fetchMyVersions){
      window.EtieCloud.fetchMyVersions(questionId, function(versions){
        try{
          var box=document.getElementById('revealContent');
          if(!box)return;
          if(!versions||!versions.length){box.innerHTML='<div class="muted small">No versions yet.</div>';return;}
          var latest=versions[0];
          box.innerHTML='<div style="margin-bottom:16px;">'
            +'<div style="font-size:14px;color:#22d3ee;font-weight:700;margin-bottom:8px;">Your answer (as they\'ll see it)</div>'
            +'<div style="font-size:15px;color:#fff;background:rgba(255,255,255,.05);padding:12px;border-radius:8px;">'+(latest.answer_text||'')+'</div>'
            +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:8px;">This is how your answer will appear after reveal. You can still edit until the reveal time.</div>'
            +'</div>';
        }catch(e){}
      });
    }
  }catch(e){}
}

function showAnswerHistory(questionId){
  try{
    // Track metadata: history was opened
    try{ETIE.questionMetrics=ETIE.questionMetrics||{};ETIE.questionMetrics[questionId]=ETIE.questionMetrics[questionId]||{};ETIE.questionMetrics[questionId].historyOpened=true;ETIE.questionMetrics[questionId].historyOpenedAt=new Date().toISOString();saveState();}catch(e){}
    if(!window.EtieCloud||!window.EtieCloud.fetchMyVersions){toast('Cloud not ready.');return;}
    window.EtieCloud.fetchMyVersions(questionId, function(versions){
      try{
        var box=document.getElementById('revealContent');
        if(!box)return;
        if(!versions||!versions.length){box.innerHTML='<div class="muted small">No versions yet.</div>';return;}
        var html='<div style="margin-bottom:16px;">'
          +'<div style="font-size:14px;color:#22d3ee;font-weight:700;margin-bottom:8px;">Your answer history ('+versions.length+' version'+(versions.length===1?'':'s')+')</div>';
        versions.forEach(function(v,i){
          html+='<div style="background:rgba(255,255,255,.05);padding:10px;border-radius:8px;margin-bottom:6px;">'
            +'<div style="font-size:10px;color:rgba(255,255,255,.4);margin-bottom:4px;">Version '+(versions.length-i)+' \u00b7 '+new Date(v.created_at).toLocaleString()+'</div>'
            +'<div style="font-size:13px;color:#fff;">'+(v.answer_text||'')+'</div>'
            +'</div>';
        });
        html+='</div>';
        box.innerHTML=html;
      }catch(e){}
    });
  }catch(e){}
}

function hideExchange(questionId){
  try{
    _hiddenExchanges[questionId]=true;
    loadQuestionArchive();
    toast('Exchange hidden.');
  }catch(e){}
}

function openRevealScreen(questionId){
  try{
    var old=document.getElementById('revealOverlay');if(old)old.remove();
    var overlay=document.createElement('div');
    overlay.id='revealOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;max-width:520px;width:90%;max-height:85vh;overflow-y:auto;color:#fff;';
    card.innerHTML='<div id="revealContent"><div class="muted small">Loading...</div></div>'
      +'<button onclick="document.getElementById(\'revealOverlay\').remove()" style="margin-top:16px;padding:8px 16px;background:rgba(255,255,255,.08);color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:12px;">Close</button>';
    overlay.appendChild(card);
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
    loadRevealContent(questionId);
  }catch(e){}
}

function loadRevealContent(questionId){
  try{
    var box=document.getElementById('revealContent');
    if(!box)return;
    if(!window.EtieCloud||!window.EtieCloud.getLatestAnswer){box.innerHTML='<div class="muted small">Cloud not ready.</div>';return;}
    window.EtieCloud.getLatestAnswer(questionId, function(res){
      try{
        if(!res||!res.ok){
          if(res&&res.error==='sealed'){
            var hrs=Math.max(0,Math.ceil((new Date(res.reveal_at).getTime()-Date.now())/3600000));
            box.innerHTML='<div style="text-align:center;padding:20px;">'
              +'<div style="font-size:16px;color:#a78bfa;margin-bottom:8px;">Answered. Unlocks in '+hrs+'h.</div>'
              +'<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:12px;">The answer is sealed until the reveal time.</div>'
              +'<div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:8px;margin-bottom:12px;">We track edit counts and timing for quality. Never your words.</div>'
              +'<button onclick="readItBack(\''+questionId+'\')" style="padding:8px 16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:12px;margin-right:8px;">Read it back as they\'ll see it</button>'
              +'<button onclick="showAnswerHistory(\''+questionId+'\')" style="padding:8px 16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:12px;">Your history</button>'
              +'</div>';
          }else{
            box.innerHTML='<div class="muted small">Cannot load: '+(res&&res.error||'unknown')+'</div>';
          }
          return;
        }
        // Revealed — show answer
        box.innerHTML='<div style="margin-bottom:16px;">'
          +'<div style="font-size:14px;color:#f43f5e;font-weight:700;margin-bottom:8px;">Question</div>'
          +'<div style="font-size:15px;color:#fff;margin-bottom:16px;">'+(res.question_text||'(question not shown)')+'</div>'
          +'<div style="font-size:14px;color:#22d3ee;font-weight:700;margin-bottom:8px;">Answer</div>'
          +'<div style="font-size:15px;color:#fff;background:rgba(255,255,255,.05);padding:12px;border-radius:8px;">'+(res.answer_text||'(no answer yet)')+'</div>'
          +'</div>'
          +'<div style="margin-top:12px;"><button onclick="reportQuestionPrompt(\''+questionId+'\')" style="padding:6px 12px;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);color:#f87171;border-radius:6px;cursor:pointer;font-size:12px;">🚩 Report question</button></div>';
      }catch(e){box.innerHTML='<div class="muted small">Error loading reveal.</div>';}
    });
  }catch(e){}
}

// Report a question (Q4 stub — will be expanded in Q4)
function reportQuestionPrompt(questionId){
  try{
    if(!confirm('Report this question? It will be removed from your obligations and flagged for admin review.'))return;
    if(window.EtieCloud&&window.EtieCloud.reportQuestion){
      window.EtieCloud.reportQuestion(questionId, function(ok){
        try{
          if(ok){toast('Question reported.');loadQuestionArchive();}
          else{toast('Report failed.');}
        }catch(e){}
      });
    }
  }catch(e){}
}

function openMemorySpotCard(spot){
  try{
    if(!spot||!spot.photos||!spot.photos.length)return;
    // Remove any existing overlay
    var old=document.getElementById('memGroupOverlay');if(old)old.remove();
    var old2=document.getElementById('memSingleOverlay');if(old2)old2.remove();
    window._openMemorySpot=spot;
    window._memGroupIndex=0;

    // Count unique people
    var peopleSet={};
    spot.photos.forEach(function(p){if(p.owner)peopleSet[p.owner]=1;});
    var peopleCount=Object.keys(peopleSet).length;

    // Create overlay
    var overlay=document.createElement('div');
    overlay.id='memGroupOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;max-width:560px;width:90%;max-height:85vh;display:flex;flex-direction:column;color:#fff;overflow:hidden;';
    // Header
    var header=document.createElement('div');
    header.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-shrink:0;';
    var headerLeft=document.createElement('div');
    var label=document.createElement('div');
    label.style.cssText='font-size:10px;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.6);font-weight:800;margin-bottom:4px;';
    label.textContent='MEMORIES HERE';
    headerLeft.appendChild(label);
    var title=document.createElement('div');
    title.style.cssText='font-family:var(--font-logo, Syne),sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:2px;';
    title.textContent=spot.name||'Hangout Memory';
    headerLeft.appendChild(title);
    var sub=document.createElement('div');
    sub.style.cssText='font-size:12px;color:rgba(255,255,255,.6);';
    sub.textContent=spot.photos.length+' memor'+(spot.photos.length===1?'y':'ies')+' \u00b7 '+peopleCount+' '+(peopleCount===1?'person':'people');
    headerLeft.appendChild(sub);
    header.appendChild(headerLeft);
    var closeBtn=document.createElement('button');
    closeBtn.setAttribute('aria-label','Close');
    closeBtn.style.cssText='padding:8px 12px;min-height:44px;min-width:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:16px;flex-shrink:0;';
    closeBtn.textContent='\u2715';
    closeBtn.onclick=function(){overlay.remove();};
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Grid container (scrollable)
    var gridWrap=document.createElement('div');
    gridWrap.style.cssText='flex:1;overflow-y:auto;min-height:0;';

    // Date sections only if >6 memories
    var useSections = spot.photos.length > 6;

    // Sort photos newest first
    var photos = spot.photos.slice().sort(function(a,b){
      var ta=a.timestamp?new Date(a.timestamp).getTime():0;
      var tb=b.timestamp?new Date(b.timestamp).getTime():0;
      return tb-ta;
    });

    // Group by date section if needed
    function dateSection(ts){
      var now=new Date();
      var d=new Date(ts);
      var today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var weekAgo=new Date(today.getTime()-7*86400000);
      if(d>=today) return 'Tonight';
      if(d>=weekAgo) return 'This week';
      return 'Earlier';
    }

    if(useSections){
      var sections={};
      var sectionOrder=[];
      photos.forEach(function(p,i){
        var sec=dateSection(p.timestamp||new Date().toISOString());
        if(!sections[sec]){sections[sec]=[];sectionOrder.push(sec);}
        sections[sec].push({photo:p,idx:i});
      });
      sectionOrder.forEach(function(sec){
        var h=document.createElement('div');
        h.style.cssText='font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.6);font-weight:700;margin:12px 0 6px;';
        h.textContent=sec;
        gridWrap.appendChild(h);
        var grid=document.createElement('div');
        grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;';
        sections[sec].forEach(function(item){grid.appendChild(makeTile(item.photo, item.idx, spot));});
        gridWrap.appendChild(grid);
      });
    } else {
      var grid=document.createElement('div');
      grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;';
      photos.forEach(function(p,i){grid.appendChild(makeTile(p, i, spot));});
      gridWrap.appendChild(grid);
    }

    card.appendChild(gridWrap);

    // Add a memory here button
    var addBtn=document.createElement('button');
    addBtn.style.cssText='margin-top:12px;padding:10px 16px;background:#f43f5e;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;flex-shrink:0;min-height:44px;';
    addBtn.textContent='Add a memory here';
    addBtn.onclick=function(){
      overlay.remove();
      try{openLogSheet(null,{lat:spot.coords.lat,lng:spot.coords.lng,label:spot.name});}catch(e){}
    };
    card.appendChild(addBtn);

    overlay.appendChild(card);
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);

    // Tagging happens in single memory view

    // Esc to close
    var escHandler=function(e){if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',escHandler);}};
    document.addEventListener('keydown',escHandler);

    // Store for single view navigation
    window._memGroupPhotos=photos;
  }catch(e){console.error('openMemorySpotCard error:',e);}
}
function cancelPendingTag(memoryId, taggedUserId){
  try{
    if(!confirm('Cancel this pending tag?'))return;
    if(window.EtieCloud&&window.EtieCloud.cancelTag){
      window.EtieCloud.cancelTag(memoryId, taggedUserId, function(ok){
        try{
          if(ok){toast('Tag cancelled.');loadMemTagSection(window._openMemorySpot, window._memSingleIdx||0);}
          else{toast('Cancel failed. (Needs cancel_tag RPC in Supabase)');}
        }catch(e){}
      });
    }else{
      toast('Cancel not available.');
    }
  }catch(e){}
}

function makeTile(photo, idx, spot){
  var tile=document.createElement('div');
  tile.style.cssText='position:relative;border-radius:10px;overflow:hidden;cursor:pointer;aspect-ratio:3/4;background:#0b0b0e;';
  tile.onclick=function(){openMemorySingleView(idx, spot);};

  var img=document.createElement('img');
  img.src=photo.url;
  img.loading='lazy';
  img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
  tile.appendChild(img);

  // Date stamp (orange monospace) top-right
  var ts=photo.timestamp||new Date().toISOString();
  var d=new Date(ts);
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var dateStr=d.getDate()+' '+months[d.getMonth()]+' \u2019'+String(d.getFullYear()).slice(2);
  var stamp=document.createElement('div');
  stamp.style.cssText='position:absolute;top:6px;right:6px;font-family:monospace;font-size:11px;font-weight:700;color:#fb923c;text-shadow:0 0 8px rgba(251,146,60,.5);background:rgba(0,0,0,.5);padding:2px 6px;border-radius:4px;';
  stamp.textContent=dateStr;
  tile.appendChild(stamp);

  // Bottom gradient with caption + avatar + name/time
  var bottom=document.createElement('div');
  bottom.style.cssText='position:absolute;bottom:0;left:0;right:0;padding:8px;background:linear-gradient(transparent,rgba(0,0,0,.85));';
  if(photo.caption){
    var cap=document.createElement('div');
    cap.style.cssText='font-size:12px;font-weight:700;color:#fff;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    cap.textContent=photo.caption;
    bottom.appendChild(cap);
  }
  var metaRow=document.createElement('div');
  metaRow.style.cssText='display:flex;align-items:center;gap:4px;';
  var avatar=document.createElement('div');
  avatar.style.cssText='width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;';
  avatar.textContent=(photo.owner||'?').charAt(0).toUpperCase();
  metaRow.appendChild(avatar);
  var metaText=document.createElement('div');
  metaText.style.cssText='font-size:10px;color:rgba(255,255,255,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  var dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var timeStr=dayNames[d.getDay()]+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  metaText.textContent=(photo.owner||'Someone')+' \u00b7 '+timeStr;
  metaRow.appendChild(metaText);
  bottom.appendChild(metaRow);
  tile.appendChild(bottom);

  // Tag button (small, top-left)
  var tagBtn=document.createElement('button');
  tagBtn.style.cssText='position:absolute;top:6px;left:6px;padding:4px 8px;min-height:24px;background:rgba(244,63,94,.8);border:0;border-radius:4px;color:#fff;font-size:9px;font-weight:700;cursor:pointer;opacity:0.9;';
  tagBtn.textContent='Tag';
  tagBtn.setAttribute('aria-label','Tag people in this memory');
  tagBtn.onclick=function(e){e.stopPropagation();openMemorySingleView(idx, spot);};
  tile.appendChild(tagBtn);
  // Always visible on touch devices
  tile.onmouseenter=function(){tagBtn.style.opacity='1';};
  tile.onmouseleave=function(){tagBtn.style.opacity='0.9';};

  return tile;
}

function openMemorySingleView(idx, spot){
  try{
    var photos=window._memGroupPhotos||spot.photos;
    if(!photos||!photos.length)return;
    if(idx<0)idx=0;
    if(idx>=photos.length)idx=photos.length-1;
    window._memSingleIdx=idx;
    window._memSingleSpot=spot;
    var photo=photos[idx];

    var old=document.getElementById('memSingleOverlay');if(old)old.remove();
    var overlay=document.createElement('div');
    overlay.id='memSingleOverlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
    var card=document.createElement('div');
    card.style.cssText='background:#1a1428;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;max-width:640px;width:90%;max-height:85vh;overflow-y:auto;color:#fff;';
    // Navigation header
    var nav=document.createElement('div');
    nav.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    var backBtn=document.createElement('button');
    backBtn.setAttribute('aria-label','Back to group');
    backBtn.style.cssText='padding:8px 14px;min-height:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:13px;';
    backBtn.textContent='\u2190 Back to group';
    backBtn.onclick=function(){overlay.remove();};
    nav.appendChild(backBtn);
    var counter=document.createElement('div');
    counter.style.cssText='font-size:13px;color:rgba(255,255,255,.6);';
    counter.textContent=(idx+1)+' of '+photos.length;
    nav.appendChild(counter);
    var navBtns=document.createElement('div');
    navBtns.style.cssText='display:flex;gap:6px;';
    var prevBtn=document.createElement('button');
    prevBtn.setAttribute('aria-label','Previous memory');
    prevBtn.style.cssText='padding:8px 12px;min-height:44px;min-width:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:16px;';
    prevBtn.textContent='\u2190';
    prevBtn.disabled=idx===0;
    prevBtn.onclick=function(){if(idx>0)openMemorySingleView(idx-1,spot);};
    navBtns.appendChild(prevBtn);
    var nextBtn=document.createElement('button');
    nextBtn.setAttribute('aria-label','Next memory');
    nextBtn.style.cssText='padding:8px 12px;min-height:44px;min-width:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:8px;cursor:pointer;font-size:16px;';
    nextBtn.textContent='\u2192';
    nextBtn.disabled=idx===photos.length-1;
    nextBtn.onclick=function(){if(idx<photos.length-1)openMemorySingleView(idx+1,spot);};
    navBtns.appendChild(nextBtn);
    nav.appendChild(navBtns);
    card.appendChild(nav);

    // Content: photo left, details right
    var content=document.createElement('div');
    content.style.cssText='display:flex;gap:16px;flex-wrap:wrap;';
    var photoDiv=document.createElement('div');
    photoDiv.style.cssText='flex:1;min-width:200px;';
    var img=document.createElement('img');
    img.src=photo.url;
    img.style.cssText='width:100%;border-radius:12px;object-fit:cover;';
    photoDiv.appendChild(img);
    content.appendChild(photoDiv);

    var details=document.createElement('div');
    details.style.cssText='flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px;';
    // Avatar + author
    var authorRow=document.createElement('div');
    authorRow.style.cssText='display:flex;align-items:center;gap:8px;';
    var av=document.createElement('div');
    av.style.cssText='width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;';
    av.textContent=(photo.owner||'?').charAt(0).toUpperCase();
    authorRow.appendChild(av);
    var authorName=document.createElement('strong');
    authorName.style.cssText='font-size:15px;color:#fff;';
    authorName.textContent=photo.owner||'Someone';
    authorRow.appendChild(authorName);
    details.appendChild(authorRow);

    // Full date and time
    var ts=photo.timestamp||new Date().toISOString();
    var d=new Date(ts);
    var fullDate=document.createElement('div');
    fullDate.style.cssText='font-size:13px;color:rgba(255,255,255,.6);';
    fullDate.textContent=d.toLocaleString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'});
    details.appendChild(fullDate);

    // Caption in Syne
    if(photo.caption){
      var caption=document.createElement('div');
      caption.style.cssText='font-family:var(--font-logo, Syne),sans-serif;font-size:16px;font-weight:700;color:#fff;margin-top:4px;';
      caption.textContent=photo.caption;
      details.appendChild(caption);
    }

    // Place name muted
    var place=document.createElement('div');
    place.style.cssText='font-size:12px;color:rgba(255,255,255,.4);';
    place.textContent=spot.name||'';
    details.appendChild(place);

    // With: chips (if tag data exists)
    if(window.EtieCloud&&window.EtieCloud.fetchMemoryTags){
      window.EtieCloud.fetchMemoryTags(photo.logId, function(tags){
        try{
          if(!tags||!tags.length)return;
          var approved=tags.filter(function(t){return t.status==='approved';});
          if(!approved.length)return;
          var withLabel=document.createElement('div');
          withLabel.style.cssText='font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.6);font-weight:700;margin-top:4px;';
          withLabel.textContent='With:';
          details.appendChild(withLabel);
          var chips=document.createElement('div');
          chips.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;';
          // Fetch names for tagged users
          var taggedIds=approved.map(function(t){return t.tagged_user_id;}).filter(Boolean);
          var renderChips=function(nameMap){
            try{
              approved.forEach(function(t){
                var chip=document.createElement('span');
                chip.style.cssText='padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:11px;';
                var name=(nameMap&&nameMap[t.tagged_user_id])||t.tagged_user_id.substring(0,8)+'\u2026';
                chip.textContent=name;
                chips.appendChild(chip);
              });
            }catch(e){}
          };
          if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames&&taggedIds.length){
            window.EtieCloud.fetchDisplayNames(taggedIds, renderChips);
          }else{
            renderChips({});
          }
          details.appendChild(chips);
        }catch(e){}
      });
    }

    // Message privately (owner + approved tagged)
    var myId=null;try{myId=myUid();}catch(e){}
    var isOwner = myId && photo.ownerId && myId===photo.ownerId;
    var showMsg = isOwner;
    // Check if current user is an approved tagged person
    if(!isOwner && myId && window.EtieCloud&&window.EtieCloud.fetchMemoryTags){
      window.EtieCloud.fetchMemoryTags(photo.logId, function(tags){
        try{
          if(!tags||!tags.length)return;
          var approved=tags.some(function(tg){return tg.tagged_user_id===myId && tg.status==='approved';});
          if(approved){
            // Add message button
            var msgBtn=document.createElement('button');
            msgBtn.style.cssText='margin-top:8px;padding:8px 16px;background:rgba(34,211,238,.15);border:1px solid rgba(34,211,238,.3);color:#22d3ee;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;min-height:44px;';
            msgBtn.textContent='\ud83d\udcac Message privately';
            msgBtn.onclick=function(){overlay.remove();openDirectChatFromMemory(photo.logId, photo.owner);};
            details.appendChild(msgBtn);
          }
        }catch(e){}
      });
    }
    if(showMsg){
      var msgBtn=document.createElement('button');
      msgBtn.style.cssText='margin-top:8px;padding:8px 16px;background:rgba(34,211,238,.15);border:1px solid rgba(34,211,238,.3);color:#22d3ee;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;min-height:44px;';
      msgBtn.textContent='\ud83d\udcac Message privately';
      msgBtn.onclick=function(){overlay.remove();openDirectChatFromMemory(photo.logId, photo.owner);};
      details.appendChild(msgBtn);
    }

    content.appendChild(details);
    card.appendChild(content);

    // Tag section (available to all, RPC enforces owner-only)
    var tagSec=document.createElement('div');
    tagSec.id='memTagSection';
    tagSec.style.cssText='margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);';
    card.appendChild(tagSec);

    overlay.appendChild(card);

    try{loadMemTagSection(spot, idx);}catch(e){}
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);



    // Keyboard navigation
    var keyHandler=function(e){
      if(e.key==='ArrowLeft'&&idx>0){overlay.remove();openMemorySingleView(idx-1,spot);}
      if(e.key==='ArrowRight'&&idx<photos.length-1){overlay.remove();openMemorySingleView(idx+1,spot);}
      if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',keyHandler);}
    };
    document.addEventListener('keydown',keyHandler);

    // Store photos for navigation
    window._memGroupPhotos=photos;
  }catch(e){console.error('openMemorySingleView error:',e);}
}

function loadMemTagSection(spot, photoIdx){
  try{
    var section=document.getElementById('memTagSection');
    if(!section||!spot||!spot.photos||!spot.photos.length)return;
    if(photoIdx==null)photoIdx=0;
    // Use the specific photo's logId as the memory ID for tagging
    var memoryId=spot.photos[photoIdx].logId;
    if(!memoryId){section.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.4);">Tagging requires cloud sync.</div>';return;}
    // Check if current user is the owner
    var myId=null;try{myId=myUid();}catch(e){}
    // We'll show tag UI for the owner. For simplicity, show for all (owner check via RPC).
    section.innerHTML='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;">Tag people in this memory</div>'
      +'<div id="memTagConnections" style="margin-bottom:8px;"></div>'
      +'<div style="display:flex;gap:8px;margin-bottom:8px;">'
      +'<div style="position:relative;flex:1;">'
      +'<input id="memTagInput" placeholder="Or type a name" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font-size:13px;box-sizing:border-box;" oninput="suggestTagUsers(this.value,\''+memoryId+'\')">'
      +'<div id="memTagSuggestions" style="position:absolute;top:100%;left:0;right:0;background:rgba(20,16,28,.98);border:1px solid rgba(255,255,255,.16);border-radius:8px;margin-top:2px;max-height:160px;overflow-y:auto;z-index:10;display:none;"></div>'
      +'</div>'
      +'<button onclick="submitMemTag(\''+memoryId+'\')" style="padding:8px 14px;min-height:44px;background:#f43f5e;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:13px;">Tag</button>'
      +'</div>'
      +'<div id="memTagStatus" style="font-size:12px;color:rgba(255,255,255,.6);"></div>'
      +'<div id="memTagList" style="margin-top:8px;"></div>';
    // Load existing tags
    if(window.EtieCloud&&window.EtieCloud.fetchMemoryTags){
      window.EtieCloud.fetchMemoryTags(memoryId, function(tags){
        try{
          var list=document.getElementById('memTagList');
          if(!list)return;
          if(!tags||!tags.length){list.innerHTML='';return;}
          // Fetch display names for tagged users
          var userIds=tags.map(function(t){return t.tagged_user_id;}).filter(Boolean);
          var renderTags=function(nameMap){
            try{
              list.innerHTML=tags.map(function(t){
                var status=t.status==='approved'?'on their map':t.status==='pending'?'pending':'sat this one out';
                var color=t.status==='approved'?'#4ade80':t.status==='pending'?'#fbbf24':'#f87171';
                var name=(nameMap&&nameMap[t.tagged_user_id])||t.tagged_user_id.substring(0,8)+'…';
                var cancelBtn=t.status==='pending'
                  ? ' <button onclick="cancelPendingTag(\''+memoryId+'\',\''+t.tagged_user_id+'\')" style="margin-left:6px;padding:4px 8px;min-height:32px;background:rgba(255,60,60,.15);border:1px solid rgba(255,60,60,.3);color:#f87171;border-radius:3px;cursor:pointer;font-size:10px;" title="Cancel tag" aria-label="Cancel tag">\u2715</button>'
                  : '';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);">'
                  +'<span style="font-size:13px;color:#fff;">'+name+cancelBtn+'</span>'
                  +'<span style="font-size:11px;color:'+color+';">'+status+'</span>'
                  +'</div>';
              }).join('');
            }catch(e){}
          };
          if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames){
            window.EtieCloud.fetchDisplayNames(userIds, renderTags);
          }else{
            renderTags({});
          }
        }catch(e){}
      });
    }
    // Load connections as clickable tag buttons
    if(window.EtieCloud&&window.EtieCloud.fetchConnections){
      window.EtieCloud.fetchConnections(function(conns){
        try{
          if(!conns||!conns.length)return;
          var connBox=document.getElementById('memTagConnections');
          if(!connBox)return;
          var label=document.createElement('div');
          label.style.cssText='font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px;';
          label.textContent='Your connections (tap to tag):';
          connBox.appendChild(label);
          var btnRow=document.createElement('div');
          btnRow.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
          // Fetch display names for connections
          var connIds=conns.map(function(c){return c.user_id;}).filter(Boolean);
          var renderConnButtons=function(nameMap){
            try{
              conns.forEach(function(c){
                try{
                  var name=(nameMap&&nameMap[c.user_id])||c.user_id.substring(0,8)+'...';
                  var btn=document.createElement('button');
                  btn.style.cssText='padding:6px 12px;min-height:36px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:6px;cursor:pointer;font-size:12px;';
                  btn.textContent=name;
                  btn.onclick=function(){
                    if(status)status.textContent='Tagging '+name+'...';
                    if(window.EtieCloud&&window.EtieCloud.tagUser){
                      window.EtieCloud.tagUser(memoryId, c.user_id, function(res){
                        try{
                          if(res&&res.ok){
                            if(status)status.textContent='Tagged '+name+'! They\'ll see an invite.';
                            loadMemTagSection(window._openMemorySpot, window._memSingleIdx||0);
                          }else if(res&&res.error==='cooldown'){
                            var hrs=Math.ceil(res.hours_remaining||72);
                            if(status)status.textContent='You can tag '+name+' again in '+hrs+' hours.';
                          }else{
                            if(status)status.textContent='Tag failed: '+(res&&res.error||'unknown');
                          }
                        }catch(e){}
                      });
                    }
                  };
                  btnRow.appendChild(btn);
                }catch(e){}
              });
              connBox.appendChild(btnRow);
            }catch(e){}
          };
          if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames){
            window.EtieCloud.fetchDisplayNames(connIds, renderConnButtons);
          }else{
            renderConnButtons({});
          }
        }catch(e){}
      });
    }
  }catch(e){console.error('loadMemTagSection error:',e);}
}
function suggestTagUsers(query, memoryId){
  try{
    var box=document.getElementById('memTagSuggestions');
    if(!box)return;
    var q=(query||'').trim();
    if(!q){box.style.display='none';box.innerHTML='';return;}
    if(!window.EtieCloud||!window.EtieCloud.searchProfiles){box.style.display='none';return;}
    window.EtieCloud.searchProfiles(q, function(results){
      try{
        if(!results||!results.length){box.style.display='none';box.innerHTML='';return;}
        box.innerHTML='';
        results.forEach(function(u){
          var item=document.createElement('div');
          item.style.cssText='padding:8px 12px;cursor:pointer;font-size:13px;color:#fff;border-bottom:1px solid rgba(255,255,255,.06);';
          item.textContent=u.name+(u.city?' ('+u.city+')':'');
          item.onmouseenter=function(){item.style.background='rgba(255,255,255,.1)';};
          item.onmouseleave=function(){item.style.background='';};
          item.onclick=function(){
            var input=document.getElementById('memTagInput');
            if(input)input.value=u.name;
            box.style.display='none';
            // Tag immediately
            var status=document.getElementById('memTagStatus');
            if(status)status.textContent='Tagging '+u.name+'...';
            if(window.EtieCloud&&window.EtieCloud.tagUser){
              window.EtieCloud.tagUser(memoryId, u.user_id, function(res){
                try{
                  if(res&&res.ok){
                    if(status)status.textContent='Tagged '+u.name+'! They\'ll see an invite.';
                    var inp=document.getElementById('memTagInput');if(inp)inp.value='';
                    loadMemTagSection(window._openMemorySpot, window._memSingleIdx||0);
                  }else if(res&&res.error==='cooldown'){
                    var hrs=Math.ceil(res.hours_remaining||72);
                    if(status)status.textContent='You can tag '+u.name+' again in '+hrs+' hours.';
                  }else{
                    if(status)status.textContent='Tag failed: '+(res&&res.error||'unknown');
                  }
                }catch(e){}
              });
            }
          };
          box.appendChild(item);
        });
        box.style.display='block';
      }catch(e){}
    });
  }catch(e){}
}

function submitMemTag(memoryId){
  try{
    var input=document.getElementById('memTagInput');
    var status=document.getElementById('memTagStatus');
    if(!input||!memoryId)return;
    var name=input.value.trim();
    if(!name){if(status)status.textContent='Type a name first.';return;}
    if(status)status.textContent='Looking up...';
    if(window.EtieCloud&&window.EtieCloud.exactMatchUser){
      window.EtieCloud.exactMatchUser(name, function(user){
        try{
          if(!user){if(status)status.textContent='No exact match found. Check spelling.';return;}
          if(status)status.textContent='Tagging '+user.name+'...';
          if(window.EtieCloud&&window.EtieCloud.tagUser){
            window.EtieCloud.tagUser(memoryId, user.user_id, function(res){
              try{
                if(res&&res.ok){
                  if(status)status.textContent='Tagged '+user.name+'! They\'ll see an invite.';
                  input.value='';
                  // Reload tag list
                  loadMemTagSection(window._openMemorySpot, window._memSingleIdx||0);
                }else if(res&&res.error==='cooldown'){
                  var hrs=Math.ceil(res.hours_remaining||72);
                  if(status)status.textContent='You can tag '+user.name+' again in '+hrs+' hours.';
                }else{
                  if(status)status.textContent='Tag failed: '+(res&&res.error||'unknown');
                }
              }catch(e){}
            });
          }
        }catch(e){}
      });
    }
  }catch(e){console.error('submitMemTag error:',e);}
}
function getMemFeedPhotos(spot){
  try{
    var photos=(spot&&spot.photos)||[];
    var filter=window._memFeedFilter||'all';
    var me=null;try{me=myUid();}catch(e){}
    if(filter==='mine'){
      photos=photos.filter(function(p){return p.owner && me && p.owner===me;});
    }
    // Sort newest first
    photos=photos.slice().sort(function(a,b){
      var ta=a.timestamp?new Date(a.timestamp).getTime():0;
      var tb=b.timestamp?new Date(b.timestamp).getTime():0;
      return tb-ta;
    });
    return photos;
  }catch(e){return (spot&&spot.photos)||[];}
}
function renderMemoryFeed(spot){
  try{
    if(!spot)spot=window._openMemorySpot;
    if(!spot)return;
    var feed=document.getElementById('memoryFeed');
    if(!feed)return;
    var photos=getMemFeedPhotos(spot);
    var page=window._memFeedPage||0;
    var pageSize=window._memFeedPageSize||20;
    var end=(page+1)*pageSize;
    var visible=photos.slice(0,end);
    var view=window._memFeedView||'list';
    feed.innerHTML='';
    if(view==='grid'){
      feed.style.display='grid';
      feed.style.gridTemplateColumns='repeat(2,1fr)';
      feed.style.gap='8px';
    }else{
      feed.style.display='flex';
      feed.style.flexDirection='column';
      feed.style.gap='12px';
    }
    visible.forEach(function(photo, idx){
      var item=document.createElement('div');
      if(view==='grid'){
        item.style.cssText='background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;cursor:pointer;';
        var img=document.createElement('img');
        img.src=photo.url;
        img.loading='lazy';
        img.style.cssText='width:100%;height:120px;object-fit:cover;display:block;';
        item.appendChild(img);
        var cap=document.createElement('div');
        cap.style.cssText='padding:6px 8px;font-size:11px;color:rgba(255,255,255,.7);';
        cap.textContent=(photo.caption||'').slice(0,40);
        item.appendChild(cap);
      }else{
        item.style.cssText='background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;';
        var img=document.createElement('img');
        img.src=photo.url;
        img.loading='lazy';
        img.style.cssText='width:100%;height:180px;object-fit:cover;display:block;';
        item.appendChild(img);
        var caption=document.createElement('div');
        caption.style.cssText='padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;';
        var left=document.createElement('div');
        if(photo.caption){
          var cap=document.createElement('div');
          cap.style.cssText='font-size:13px;font-weight:600;color:#fff;margin-bottom:2px;';
          cap.textContent=photo.caption;
          left.appendChild(cap);
        }
        if(photo.timestamp){
          var date=document.createElement('div');
          date.style.cssText='font-size:11px;color:rgba(255,255,255,.6);';
          try{date.textContent=new Date(photo.timestamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){date.textContent=photo.timestamp;}
          left.appendChild(date);
        }
        if(photo.owner){
          var owner=document.createElement('div');
          owner.style.cssText='font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;';
          owner.textContent='by '+photo.owner;
          left.appendChild(owner);
        }
        caption.appendChild(left);
        var delBtn=document.createElement('button');
        delBtn.textContent='🗑';
        delBtn.setAttribute('aria-label','Delete photo');
        delBtn.style.cssText='background:rgba(255,60,60,.15);border:1px solid rgba(255,60,60,.3);color:#ff6b6b;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer;flex-shrink:0;min-height:44px;';
        delBtn.onclick=function(){
          if(!confirm('Delete this photo?'))return;
          deleteMemoryPhoto(photo, spot);
        };
        caption.appendChild(delBtn);
        item.appendChild(caption);
      }
      item.onclick=(function(p){return function(){openMemoryCardFromFeed(p,spot);};})(photo);
      feed.appendChild(item);
    });
    // Load more button
    var lm=document.getElementById('memoryLoadMore');
    if(lm){
      if(end<photos.length){lm.style.display='';}else{lm.style.display='none';}
    }
  }catch(e){console.error('renderMemoryFeed error:',e);}
}
function setMemFilter(f){
  try{
    window._memFeedFilter=f||'all';
    window._memFeedPage=0;
    var a=document.getElementById('memFilterAll'),b=document.getElementById('memFilterMine');
    if(a)a.classList.toggle('active',f==='all');
    if(b)b.classList.toggle('active',f==='mine');
    renderMemoryFeed(window._openMemorySpot);
  }catch(e){}
}
function setMemView(v){
  try{
    window._memFeedView=v||'list';
    var g=document.getElementById('memViewGrid'),l=document.getElementById('memViewList');
    if(g)g.classList.toggle('active',v==='grid');
    if(l)l.classList.toggle('active',v==='list');
    renderMemoryFeed(window._openMemorySpot);
  }catch(e){}
}
function loadMoreMemories(){
  try{
    window._memFeedPage=(window._memFeedPage||0)+1;
    renderMemoryFeed(window._openMemorySpot);
  }catch(e){}
}
function openMemoryCardFromFeed(photo, spot){
  try{
    // Build a log-like object for openMemoryCard
    var log={photo_url:photo.url,title:photo.caption,location:spot.name,taken_at:photo.timestamp};
    openMemoryCard(log);
  }catch(e){}
}
function deleteMemoryPhoto(photo, spot){
  try{
    if(!photo||!photo.url){toast('No photo to delete.');return;}
    // Delete from storage
    if(window.EtieCloud&&window.EtieCloud.deletePhoto){
      window.EtieCloud.deletePhoto(photo.url).catch(function(){});
    }
    // Delete from database
    if(photo.logId && window.EtieCloud&&window.EtieCloud.deleteHangoutLog){
      window.EtieCloud.deleteHangoutLog(photo.logId).then(function(){
        toast('Photo deleted.');
        // Refresh memory markers
        try{if(typeof loadMainMemoryMarkers==='function')loadMainMemoryMarkers();}catch(e){}
        try{var m=document.getElementById('memoryCardModal');if(m)m.classList.add('hidden');}catch(e){}
      }).catch(function(){toast('Deleted from storage, DB update failed.');});
    }else{
      toast('Photo deleted from storage.');
      try{if(typeof loadMainMemoryMarkers==='function')loadMainMemoryMarkers();}catch(e){}
      try{var m=document.getElementById('memoryCardModal');if(m)m.classList.add('hidden');}catch(e){}
    }
  }catch(e){console.error('deleteMemoryPhoto error:',e);toast('Delete failed.');}
}

// Add memory to an existing spot
function addMemoryToSpot(){
  try{
    var spot=window._openMemorySpot;
    if(!spot){toast('No spot selected.');return;}
    closeMemoryCard();
    openLogSheet(null,{lat:spot.coords.lat,lng:spot.coords.lng,label:spot.name});
  }catch(e){console.error('addMemoryToSpot error:',e);}
}

var _popupMemories=[];
function openPopupMemory(i){
  try{var l=_popupMemories[i];if(l)openMemoryCard(l);}catch(e){}
}
function addMemoryHereAt(i){
  try{
    var l=_popupMemories[i];if(!l)return;
    openLogSheet(null);
    _logSpot={lat:Number(l.lat),lng:Number(l.lng)};
    var n=document.getElementById('logSpotNote');
    if(n)n.textContent='Adding to this spot · '+Number(l.lat).toFixed(4)+', '+Number(l.lng).toFixed(4);
    var loc=document.getElementById('logLocation');
    if(loc&&!loc.value.trim())loc.value=l.location||'';
  }catch(e){}
}
function memoryPopupHtml(list){
  try{
    var rows=list.map(function(l,i){
      var when='';try{when=l.taken_at?fmtWhen(new Date(l.taken_at).getTime()):'';}catch(e){}
      var sub=[when,l.location].filter(Boolean).join(' · ');
      var who=(l._nicknames||[]).join(', ');
      return '<div class="mem-pop-row" role="button" tabindex="0" onclick="openPopupMemory('+i+')">'
        +'<div class="mem-pop-thumb">'+(l.photo_url?('<img src="'+l.photo_url+'" alt="">'):'')+'</div>'
        +'<div class="mem-pop-meta"><strong>'+logEsc(l.title||l.location||'Hangout')+'</strong>'
        +(sub?'<span class="muted small">'+logEsc(sub)+'</span>':'')
        +(who?'<span class="muted small">with '+logEsc(who)+'</span>':'')
        +'</div></div>';
    }).join('');
    return '<div class="mem-pop"><div class="mem-pop-head">'+list.length+' memor'+(list.length===1?'y':'ies')+' here</div>'
      +rows+'<button class="mem-pop-add" onclick="addMemoryHereAt(0)">+ Add a photo here</button></div>';
  }catch(e){return '';}
}
function memoryPhotoMarker(log,mapInstance){
  var lat=Number(log.lat),lng=Number(log.lng);
  var html='<div class="memory-marker" style="width:56px;height:56px;border-radius:12px;overflow:hidden;background:#000;border:3px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;">'
    +'<img src="'+log.photo_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
    +'</div>';
  var wrap=document.createElement('div');wrap.innerHTML=html;
  var el=wrap.firstChild;
  var mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(mapInstance);
  el.addEventListener('click',function(ev){try{ev.stopPropagation();ev.preventDefault();}catch(e){}_pinJustClicked=true;setTimeout(function(){_pinJustClicked=false;},300);openMemoryCard(log);});
  return mk;
}
function clusterMemoryLogs(logs,mapInstance){
  var groups=[];
  (logs||[]).forEach(function(log){
    try{
      var pt=mapInstance.project([Number(log.lng),Number(log.lat)]),found=null;
      for(var i=0;i<groups.length;i++){
        var g=groups[i],dx=pt.x-g.x,dy=pt.y-g.y;
        if(dx*dx+dy*dy<=2500){found=g;break;}
      }
      if(found){
        found.logs.push(log);
        var n=found.logs.length;
        found.x=(found.x*(n-1)+pt.x)/n;
        found.y=(found.y*(n-1)+pt.y)/n;
      }else groups.push({x:pt.x,y:pt.y,logs:[log]});
    }catch(e){}
  });
  return groups;
}
function buildMemoryCluster(rawLogs,mapInstance){
  var state={markers:[],popup:null,destroyed:false};
  function clear(){
    state.markers.forEach(function(m){try{m.remove();}catch(e){}});
    state.markers=[];
    if(state.popup){try{state.popup.remove();}catch(e){}state.popup=null;}
  }
  function openCluster(group){
    try{
      var list=dedupeMemories(group.logs);
      if(!list.length)return;
      if(list.length===1){openMemoryCard(list[0]);return;}
      _popupMemories=list;
      if(state.popup){try{state.popup.remove();}catch(e){}state.popup=null;}
      state.popup=new maplibregl.Popup({maxWidth:'290px',className:'mem-popup-wrap',closeButton:true,closeOnClick:true})
        .setLngLat(mapInstance.unproject([group.x,group.y]))
        .setHTML(memoryPopupHtml(list))
        .addTo(mapInstance);
    }catch(e){}
  }
  function refresh(){
    if(state.destroyed||!mapInstance)return;
    clear();
    var groups=clusterMemoryLogs(rawLogs||[],mapInstance);
    groups.forEach(function(group){
      try{
        if(group.logs.length===1){state.markers.push(memoryPhotoMarker(group.logs[0],mapInstance));return;}
        var count=group.logs.length,size=count<10?'small':(count<100?'medium':'large');
        var el=document.createElement('div');
        el.className='memory-cluster memory-cluster-'+size;
        el.innerHTML='<span>'+count+'</span>';
        var mk=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat(mapInstance.unproject([group.x,group.y])).addTo(mapInstance);
        el.addEventListener('click',function(ev){try{ev.stopPropagation();ev.preventDefault();}catch(e){}_pinJustClicked=true;setTimeout(function(){_pinJustClicked=false;},300);openCluster(group);});
        state.markers.push(mk);
      }catch(e){}
    });
  }
  state.refresh=refresh;
  state.remove=function(){
    state.destroyed=true;clear();
    try{mapInstance.off('zoomend',refresh);mapInstance.off('moveend',refresh);}catch(e){}
  };
  mapInstance.on('zoomend',refresh);
  mapInstance.on('moveend',refresh);
  refresh();
  return state;
}
function fetchAndRenderMemoryMarkers(mapInstance,onDone){
  try{
    if(!window.EtieCloud||!window.EtieCloud.fetchMyMemories){if(onDone)onDone(0);return;}
    var myId=null;try{myId=myUid();}catch(e){}
    if(!myId){if(onDone)onDone(0);return;}
    window.EtieCloud.fetchMyMemories(function(logs){
      try{
        var photoLogs=(logs||[]).filter(function(l){return l&&l.lat!=null&&l.lng!=null&&l.photo_url;});
        if(!photoLogs.length){if(onDone)onDone(0);return;}
        var spots=groupMemoriesIntoSpots(photoLogs);
        var markers=[];
        spots.forEach(function(spot){
          try{
            var mk=createMemorySpotMarker(spot,mapInstance);
            if(mk)markers.push(mk);
          }catch(e){console.error('spot marker error:',e);}
        });
        mapInstance._memoryMarkers=markers;
        // Debug: draw radius circles
        if(debugGroupsEnabled() && mapInstance && mapInstance.addSource){
          try{
            spots.forEach(function(spot){
              var c=spot.coords;
              // Draw a circle using a geojson source
              var pts=[];
              var r=MEMORY_GROUP_RADIUS_M/111320; // approx degrees
              for(var i=0;i<=64;i++){
                var a=(i/64)*2*Math.PI;
                pts.push([c.lng+Math.cos(a)*r/Math.cos(c.lat*Math.PI/180), c.lat+Math.sin(a)*r]);
              }
              var srcId='dbg-'+spot.id;
              if(mapInstance.getSource(srcId))mapInstance.removeSource(srcId);
              mapInstance.addSource(srcId,{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}});
              mapInstance.addLayer({id:srcId,type:'fill',source:srcId,paint:{'fill-color':'#f43f5e','fill-opacity':0.08}});
              mapInstance.addLayer({id:srcId+'-line',type:'line',source:srcId,paint:{'line-color':'#f43f5e','line-opacity':0.3,'line-width':1}});
            });
          }catch(e){}
        }
        if(onDone)onDone(spots.length);
      }catch(e){console.error('fetchAndRenderMemoryMarkers',e);if(onDone)onDone(0);}
    });
  }catch(e){console.error('fetchAndRenderMemoryMarkers outer',e);if(onDone)onDone(0);}
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
      if(window.EtieCloud&&window.EtieCloud.fetchMyMemories){
          window.EtieCloud.fetchMyMemories(function(rows){
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
function addToMemoryLog(nick,pin){
  // Called when a pin auto-archives — adds a memory entry for each member
  try{
    if(!window.EtieCloud||!window.EtieCloud.getSession)return;
    var session=window.EtieCloud.getSession();
    if(!session||!session.user)return;
    var userId=session.user.id;
    var mem={image_url:pin.photos?pin.photos[0]:null,caption:pin.title||pin.location||'Hangout',hook_id:pin.id,location:pin.location,taken_at:new Date().toISOString(),participants:(pin.members||[]).map(function(m){return m.nick;})};
    window.EtieCloud.fetchProfile(userId,function(row){
      try{
        var mems=row&&Array.isArray(row.memories)?row.memories:[];
        mems.unshift(mem);
        if(mems.length>50)mems=mems.slice(0,50);
        window.EtieCloud.getClient().from('etie_profiles').update({memories:mems}).eq('user_id',userId).then(function(){}).catch(function(){});
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
var _cityListDone=false;
function fillCityList(){
  // searchable major-city suggestions for Home city (free text still allowed)
  try{
    if(_cityListDone)return;_cityListDone=true;
    var dl=document.getElementById('cityList');if(!dl)return;
    var seen={},html='';
    var add=function(name){if(!name||seen[name])return;seen[name]=1;html+='<option value="'+String(name).replace(/"/g,'')+'">';};
    add('Hong Kong');
    (window.ETIE_CITIES||[]).forEach(function(c){if(c&&c.city)add(c.city);});
    dl.innerHTML=html;
  }catch(e){}
}
function homeCities(){
  // multi home cities, newest first, max 5. Migrates the legacy single city string.
  try{
    if(Array.isArray(ETIE.local.cities)&&ETIE.local.cities.length)return ETIE.local.cities.filter(Boolean).slice(0,5);
    if(ETIE.local.city)return [ETIE.local.city];
  }catch(e){}
  return ['Hong Kong'];
}
function homeCitiesLabel(){try{return homeCities().join(', ');}catch(e){return 'Hong Kong';}}
function homeCitiesLabelFlags(){try{return homeCities().map(function(c){var f=flagForCity(c);return (f?f+' ':'')+c;}).join(', ');}catch(e){return homeCitiesLabel();}}
function renderHomeCityChips(){
  try{
    var box=document.getElementById('homeCityChips');if(!box)return;
    box.innerHTML='';
    homeCities().forEach(function(name,idx){
      var s=document.createElement('span');s.className='chip active';s.style.margin='0 6px 6px 0';
      s.textContent=name+' ✕';s.title='Remove';
      s.onclick=(function(i){return function(){removeHomeCity(i);};})(idx);
      box.appendChild(s);
    });
  }catch(e){}
}
function addHomeCity(){
  try{
    var inp=document.getElementById('liteCity');if(!inp)return;
    var name=(inp.value||'').trim().slice(0,60);if(!name)return;
    var arr=homeCities();
    var dup=arr.some(function(c){return c.toLowerCase()===name.toLowerCase();});
    if(dup){inp.value='';return;}
    arr.unshift(name);arr=arr.slice(0,5);
    ETIE.local.cities=arr;ETIE.local.city=arr[0];
    // Clear old anchor so it gets re-geocoded
    ETIE.anchor=null;
    inp.value='';saveState();renderHomeCityChips();
    // Geocode the new home city and set as anchor
    geocodeCity(name,function(lat,lng){
      if(lat!=null&&lng!=null){
        ETIE.anchor={lat:lat,lng:lng,label:name};
        saveState();
        // Re-center map if it exists
        try{if(_map)_map.flyTo({center:[lng,lat],zoom:HK_ZOOM,duration:1500});}catch(e){}
        toast('Home city set to '+name);
      }else{
        toast('Could not find '+name+' on the map.');
      }
    });
    try{if(ETIE.profileComplete&&!isProfileComplete())ETIE.profileComplete=false;}catch(e){}
  }catch(e){}
}
function removeHomeCity(idx){
  try{
    var arr=homeCities();arr.splice(idx,1);
    if(!arr.length)arr=['Hong Kong'];
    ETIE.local.cities=arr;ETIE.local.city=arr[0];
    saveState();renderHomeCityChips();
  }catch(e){}
}
function saveNationality(){
  // explicit user pick, kept separate from home cities (live in HK ≠ HK national)
  try{
    var s=document.getElementById('liteNationality');
    var code=s?(s.value||''):''; 
    ETIE.local.nationality=code;ETIE.traveller.nationality=code;
    saveState();
    try{renderHeaderProfile();}catch(e){}
    try{refreshGate();}catch(e){}
  }catch(e){}
}
function fillNationalityList(){
  try{
    var s=document.getElementById('liteNationality');if(!s)return;
    if(s.options&&s.options.length>1)return; // already populated
    (window.ETIE_COUNTRIES||[]).forEach(function(c){
      if(!c||!c.code)return;
      var o=document.createElement('option');o.value=c.code;o.textContent=c.name;
      s.appendChild(o);
    });
    var cur='';try{cur=ETIE.local.nationality||ETIE.traveller.nationality||'';}catch(e){}
    if(cur)s.value=cur;
  }catch(e){}
}
function nationalityLabel(){
  try{
    var code=(ETIE.local.nationality||ETIE.traveller.nationality||'');
    if(!code)return '';
    var name=code;
    (window.ETIE_COUNTRIES||[]).forEach(function(c){if(c&&c.code===code)name=c.name;});
    return flagForCountry(code)+' '+name;
  }catch(e){return '';}
}
function saveLiteProfile(){  try{
    var ni=document.getElementById('liteNick'), bi=document.getElementById('liteBio');
    var nick=ni?ni.value.trim().slice(0,24):'';
    ETIE.traveller.nickname=nick; ETIE.local.displayName=nick;
    if(bi)ETIE.traveller.bio=bi.value.slice(0,140);
    if(!Array.isArray(ETIE.local.cities)||!ETIE.local.cities.length){ETIE.local.cities=[(ETIE.local.city||'Hong Kong')];}
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
        // persist to cloud storage so it survives sign-out (base64 never leaves the device)
        try{
          if(window.EtieCloud&&window.EtieCloud.uploadPhoto){
            window.EtieCloud.uploadPhoto(file,'avatar').then(function(url){
              try{
                if(url&&url.indexOf('http')===0){
                  ETIE.traveller.photo=url; ETIE.local.photo=url;
                  saveState();renderLiteProfile();
                }
              }catch(err){}
            }).catch(function(err){
              try{console.warn('Etie avatar upload failed:',err);}catch(_){}
              toast('Photo kept on this device — cloud upload failed.');
            });
          }
        }catch(err){}
      }catch(err){}
    };
    reader.readAsDataURL(file);
  }catch(e){}
}

var ETIE_MATCH_INDEX=0;

function myUid(){ try{ var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession(); return (s&&s.user&&s.user.id)||null; }catch(e){ return null; } }
// Guard against bogus timestamps: new Date(null) yields 1970-01-01, which would make
// "no expiry" hooks look long-expired. Anything before 2000-01-01 is treated as unset.
function validTs(v){
  if(v===null||v===undefined||v==='')return null;
  var t=(typeof v==='number')?v:new Date(v).getTime();
  if(!t||isNaN(t))return null;
  if(t<946684800000)return null; // 2000-01-01
  return t;
}
function isoOrNull(ms){ var t=validTs(ms); return t===null?null:new Date(t).toISOString(); }
// Incoming request addressed to me (live local): requests are keyed by local id, so my own id as key = inbox
// Chat/request key honouring side: locals read their inbox, travellers read the match
// Chat popup (mini overlay) — was called from HTML but never defined, so traveller chat never opened



function restoreAll(){
  try{
    renderLiteProfile();
  }catch(e){}
}
// ---- Friend in Every City — map-first hooks (MapLibre GL, Hong Kong) ----
// Pins render ONLY from live hooks: Supabase etie_pins (origin 'cloud') + local testing state.
// No seed/demo/guide-presence pins. Empty map shows the first-pin banner.
var MAP_CATS=[{id:'project mbappe, lebron or sth',emoji:'⚽'},{id:'letterboxd date',emoji:'🍿'},{id:'are you a fellow alcoholic?',emoji:'🍺'},{id:'time for a cuppa tea / coffee!',emoji:'☕'},{id:'walking around the city sharing headphones tgt',emoji:'🎧'},{id:'dubious quests and giggles',emoji:'⚡'},{id:'something else on your mind?',emoji:'💡'},{id:'Food',emoji:'🥟'},{id:'Nightlife',emoji:'🍺'},{id:'Photo',emoji:'📸'},{id:'Sports',emoji:'⚽'},{id:'Cafe',emoji:'☕'}];
var MAP_INTENTS=[{id:'All',label:'All Pins',emoji:''},{id:'traveller',label:'Visiting Now',emoji:''},{id:'local',label:'Hosted by Locals',emoji:''}];
var MAP_VIBES=[{id:'project mbappe, lebron or sth',emoji:'⚽'},{id:'letterboxd date',emoji:'🍿'},{id:'are you a fellow alcoholic?',emoji:'🍺'},{id:'time for a cuppa tea / coffee!',emoji:'☕'},{id:'walking around the city sharing headphones tgt',emoji:'🎧'},{id:'dubious quests and giggles',emoji:'⚡'},{id:'something else on your mind?',emoji:'💡'}];
var MAP_DISTRICT_LATLNG={'Central and Western':[22.2840,114.1520],'Wan Chai':[22.2770,114.1730],'Eastern':[22.2730,114.2220],'Southern':[22.2380,114.1650],'Yau Tsim Mong':[22.3100,114.1700],'Sham Shui Po':[22.3307,114.1625],'Kowloon City':[22.3280,114.1900],'Wong Tai Sin':[22.3420,114.1980],'Kwun Tong':[22.3080,114.2280],'Tsuen Wan':[22.3700,114.1150],'Tuen Mun':[22.3900,113.9750],'Yuen Long':[22.4450,114.0300],'North':[22.4950,114.1450],'Tai Po':[22.4500,114.1650],'Sha Tin':[22.3850,114.1950],'Sai Kung':[22.3800,114.2700],'Islands':[22.2900,113.9500],'Kwai Tsing':[22.3550,114.1150]};
var HK_CENTER=[22.2819,114.1581],HK_ZOOM=13;
var ETIE_MAP_STYLE_ID='outdoor-v2';
function mapTilerApiKey(){
  try{
    if(window.ETIE_CONFIG&&Object.prototype.hasOwnProperty.call(window.ETIE_CONFIG,'MAPTILER_API_KEY')){
      return String(window.ETIE_CONFIG.MAPTILER_API_KEY||'').trim();
    }
  }catch(e){}
  return '';
}
function mapTilerStyleUrl(){
  var key=mapTilerApiKey();
  return key?('https://api.maptiler.com/maps/'+ETIE_MAP_STYLE_ID+'/style.json?key='+encodeURIComponent(key)):null;
}
function showMapConfigError(container){
  var el=(typeof container==='string')?document.getElementById(container):container;
  var message='Map unavailable: API key missing or rejected. Set MAPTILER_API_KEY in your deployment environment.';
  if(el)el.innerHTML='<div class="map-config-error" role="alert"><strong>Map unavailable</strong><br>API key missing or rejected.<br>Set MAPTILER_API_KEY in your deployment environment.</div>';
  try{console.error(message);}catch(e){}
}
function createEtieMap(container,options){
  var style=mapTilerStyleUrl();
  if(!style){showMapConfigError(container);return null;}
  var opts={};for(var k in options){if(Object.prototype.hasOwnProperty.call(options,k))opts[k]=options[k];}
  opts.container=container;opts.style=style;
  if(!opts.projection)opts.projection='globe';
  return new maplibregl.Map(opts);
}
var MAP_FILTER='All',MAP_ROLE='All';
var _map=null,_mapLayer=null,_openPinId=null,_pinMarkers=[];
var _dropPoint=null; // {lat,lng} set by tapping the map
var _dropMarker=null;
var _hookDraft={category:'Food',role:'traveller'};
function mapCatEmoji(cat){for(var i=0;i<MAP_CATS.length;i++)if(MAP_CATS[i].id===cat||MAP_CATS[i].label===cat)return MAP_CATS[i].emoji;return '📍';}
function nearestDistrictLabel(lat,lng){
  var best='Central and Western',bd=1e18;
  try{
    for(var k in MAP_DISTRICT_LATLNG){
      var c=MAP_DISTRICT_LATLNG[k];
      var d=haversineKm(lat,lng,c[0],c[1]);
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
            try{_map.flyTo({center:[fx.lng,fx.lat],zoom:13,duration:1200});}catch(e){}
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
    else{var denied=false;try{denied=!!ETIE.locDenied;}catch(e){}b.innerHTML=denied?'📍 Share location <span class="loc-pill loc-off">Off</span>':'📍 Share location <span class="loc-pill loc-on">On</span>';b.className='derived-badge';}
  }catch(e){}
}
function geocodeCity(cityName, cb){
  try{
    ETIE.geoCache=ETIE.geoCache||{};
    var key='city:'+cityName.toLowerCase();
    if(ETIE.geoCache[key]){
      var c=ETIE.geoCache[key];
      try{cb(c.lat,c.lng);}catch(e){}
      return;
    }
    fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&q='+encodeURIComponent(cityName)+'&limit=1').then(function(r){return r.json();}).then(function(j){
      try{
        if(j&&j.length&&j[0].lat&&j[0].lon){
          var lat=parseFloat(j[0].lat),lng=parseFloat(j[0].lon);
          ETIE.geoCache[key]={lat:lat,lng:lng};
          try{saveState();}catch(e){}
          try{cb(lat,lng);}catch(e){}
        }else{try{cb(null,null);}catch(e){}}
      }catch(e){try{cb(null,null);}catch(e2){}}
    }).catch(function(){try{cb(null,null);}catch(e){}});
  }catch(e){try{cb(null,null);}catch(e2){}}
}

function getAnchor(){
  try{
    var hc=homeCities()[0]||'Hong Kong';
    // If anchor exists and matches current home city, use it
    if(ETIE.anchor&&ETIE.anchor.lat!=null&&ETIE.anchor.label===hc)return ETIE.anchor;
    // If home city is Hong Kong, use HK center
    if(hc==='Hong Kong')return {lat:HK_CENTER[0],lng:HK_CENTER[1],label:'Hong Kong'};
    // Otherwise, anchor is stale or missing — will be geocoded
  }catch(e){}
  return {lat:HK_CENTER[0],lng:HK_CENTER[1],label:'Hong Kong'};
}
function anchorBounds(a){
  try{return [[a.lat-1.1,a.lng-1.8],[a.lat+1.1,a.lng+1.8]];}catch(e){return [[22.10,113.80],[22.60,114.50]];}
}
function areaLabel(lat,lng){
  try{
    if(haversineKm(lat,lng,HK_CENTER[0],HK_CENTER[1])<=60)return nearestDistrictLabel(lat,lng);
  }catch(e){}
  try{return homeCities()[0]||'Around you';}catch(e){return 'Around you';}
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
  // normalize legacy user pins into the hook shape; drop anything without real coords.
  // CRITICAL: start from a copy of the original so nothing is silently dropped —
  // a whitelist here previously discarded chat, requests, lifecycle and region fields.
  if(!p||p.lat==null||p.lng==null)return null;
  var n={};
  for(var k in p){if(Object.prototype.hasOwnProperty.call(p,k))n[k]=p[k];}
  var role=(p.role==='local')?'local':'traveller';
  n.id=String(p.id);
  n.kind='hook';
  n.title=String(p.title||p.location||'Hook').slice(0,60);
  n.category=p.category||p.interest||'something else on your mind?';
  n.role=role;
  n.derivedRole=p.derivedRole||role;
  n.authorId=p.authorId||null;
  n.capacity=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
  n.expires_at=p.expires_at||p.ends_at||null;
  n.name=p.name||'Someone';
  n.verified=!!p.verified;
  n.location=p.location||nearestDistrictLabel(p.lat,p.lng);
  n.lat=p.lat;n.lng=p.lng;
  n.hook=String(p.hook||'').slice(0,140);
  n.members=p.members||[{nick:(p.name||'Someone'),role:role,verified:!!p.verified}];
  n.pending=p.pending||[];
  n.requests=p.requests||[];   // join requests must survive normalization
  n.chat=p.chat||[];           // group chat history must survive normalization
  n.status=p.status||'open';
  n.ts=p.ts||Date.now();
  n.origin=p.origin||'local';
  n.cloudId=p.cloudId||null;
  return n;
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
  // Hide pins that have vanished (past hangoutEndAt + 2hr buffer)
  all=all.filter(function(p){
    try{
      if(validTs(p.pinVanishAt)!==null && validTs(p.pinVanishAt)<nowTs) return false;
      return true;
    }catch(e){return true;}
  });
  return all;
}
function initHKMap(){
  try{
    if(_map||!window.maplibregl)return;
    var el=document.getElementById('hkMap');if(!el)return;
    var _anchor=getAnchor();
    // Geocode home city if anchor doesn't match
    try{
      var hc=homeCities()[0];
      if(hc && hc!=='Hong Kong' && (!_anchor || _anchor.label!=='Hong Kong' && _anchor.label!==hc || _anchor.label==='Hong Kong')){
        geocodeCity(hc,function(lat,lng){
          if(lat!=null&&lng!=null){
            ETIE.anchor={lat:lat,lng:lng,label:hc};
            saveState();
            try{if(_map)_map.flyTo({center:[lng,lat],zoom:HK_ZOOM,duration:1500});}catch(e){}
          }
        });
      }
    }catch(e){}
    var styleUrl = (window.EtieMapStyle && typeof window.EtieMapStyle.load === 'function') ? null : null;
    var opts = {
      container:'hkMap',
      center:[_anchor.lng,_anchor.lat],
      zoom:HK_ZOOM,
      minZoom:2,
      maxZoom:20,
      attributionControl:false,
      projection:'globe',
      dragRotate:true,
      pitchWithRotate:true
    };
    if(window.EtieMapStyle && typeof window.EtieMapStyle.load === 'function'){
      window.EtieMapStyle.load(function(style){
        if(!style){showMapConfigError('hkMap');return;}
        if(_map){return;}
        opts.style = style;
        _map = new maplibregl.Map(opts);
        if(!_map)return;
        _map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
        _map.on('click',onMapTap);
        _map.on('load',function(){
          renderMapFilter();
          try{renderMapPins();}catch(e){}
          try{startGlobeSpin();}catch(e){}
        });
      });
    } else {
      opts.style = mapTilerStyleUrl();
      if(!opts.style){showMapConfigError('hkMap');return;}
      _map = new maplibregl.Map(opts);
      if(!_map)return;
      _map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
      _map.on('click',onMapTap);
      _map.on('load',function(){
        renderMapFilter();
        try{renderMapPins();}catch(e){}
        try{startGlobeSpin();}catch(e){}
      });
    }
  }catch(e){}
}
var _pickMode=null; // legacy map-tap mode flag (kept for compat)
var _pinJustClicked=false;
function onMapTap(e){
  try{
    if(_pinJustClicked){_pinJustClicked=false;return;}
    var lngLat=e.lngLat;
    var lat=lngLat.lat,lng=lngLat.lng;
    _dropPoint={lat:lat,lng:lng};
    if(_dropMarker){try{_dropMarker.remove();}catch(_){}}
    _dropMarker=new maplibregl.Marker({color:'#3ddc97'}).setLngLat([lng,lat]).addTo(_map);
    _pickMode=null;
    if(_mapMode==='memories'){
      try{openLogSheet(null,{lat:lat,lng:lng,label:nearestDistrictLabel(lat,lng)});}catch(_){}
      return;
    }
    window._pendingDropGuess='Near '+nearestDistrictLabel(lat,lng);
    openDropHook();
  }catch(err){}
}
function renderMapFilter(){
  try{
    var bar=document.getElementById('mapFilterBar');if(!bar)return;
    bar.innerHTML='';
    
    // Status switch group (glowing dots, no emojis)
    var statusGroup=document.createElement('div');
    statusGroup.className='filter-status-group';
    statusGroup.style.display='flex';
    statusGroup.style.gap='6px';
    statusGroup.style.alignItems='center';
    
    var statusLabels={'All':'All pins','traveller':'Visiting Now','local':'Hosted by Locals'};
    var statusColors={'All':'var(--blue)','traveller':'var(--amber)','local':'var(--red)'};
    
    MAP_INTENTS.forEach(function(c){
      var on=(c.id==='All')?(MAP_ROLE==='All'&&MAP_FILTER==='All'):(MAP_ROLE===c.id);
      var b=document.createElement('button');
      b.className='chip filter-status-chip'+(on?' active':'');
      b.style.padding='7px 12px';
      b.style.display='flex';
      b.style.alignItems='center';
      b.style.gap='6px';
      var dot=document.createElement('span');
      dot.className='status-dot';
      dot.style.display='inline-block';
      dot.style.width='8px';
      dot.style.height='8px';
      dot.style.borderRadius='50%';
      dot.style.background=statusColors[c.id]||'var(--muted)';
      dot.style.boxShadow='0 0 6px '+(statusColors[c.id]||'var(--muted)');
      b.appendChild(dot);
      var label=document.createElement('span');
      label.textContent=statusLabels[c.id]||c.label;
      b.appendChild(label);
      b.onclick=(function(id){return function(){selectIntent(id);};})(c.id);
      statusGroup.appendChild(b);
    });
    
    bar.appendChild(statusGroup);
    
    // TOPICS label
    var topicsLabel=document.createElement('span');
    topicsLabel.className='filter-topics-label';
    topicsLabel.textContent='TOPICS';
    topicsLabel.style.fontSize='10px';
    topicsLabel.style.fontWeight='800';
    topicsLabel.style.letterSpacing='.12em';
    topicsLabel.style.color='var(--muted)';
    topicsLabel.style.marginLeft='12px';
    topicsLabel.style.marginRight='4px';
    topicsLabel.style.alignSelf='center';
    bar.appendChild(topicsLabel);
    
    // Topic chips row with scroll container
    var topicScroll=document.createElement('div');
    topicScroll.className='filter-topic-scroll';
    topicScroll.style.display='flex';
    topicScroll.style.gap='6px';
    topicScroll.style.overflowX='auto';
    topicScroll.style.scrollbarWidth='none';
    topicScroll.style.flex='1';
    topicScroll.style.minWidth='0';
    topicScroll.style.position='relative';
    
    MAP_VIBES.forEach(function(c){
      var b=document.createElement('button');
      b.className='chip filter-topic-chip'+(MAP_FILTER===c.id?' active':'');
      b.style.padding='7px 12px';
      b.style.flexShrink='0';
      b.style.display='flex';
      b.style.alignItems='center';
      b.style.gap='6px';
      var dot=document.createElement('span');
      dot.style.display='inline-block';
      dot.style.width='6px';
      dot.style.height='6px';
      dot.style.borderRadius='50%';
      dot.style.background='var(--violet)';
      dot.style.boxShadow='0 0 4px var(--violet)';
      b.appendChild(dot);
      var label=document.createElement('span');
      label.textContent=(c.label||c.id);
      b.appendChild(label);
      b.onclick=(function(id){return function(){setMapFilter(id);};})(c.id);
      topicScroll.appendChild(b);
    });
    
    bar.appendChild(topicScroll);
    
    // Arrow button for scrolling
    var arrowBtn=document.createElement('button');
    arrowBtn.className='filter-scroll-arrow';
    arrowBtn.textContent='→';
    arrowBtn.style.padding='7px 10px';
    arrowBtn.style.flexShrink='0';
    arrowBtn.style.background='rgba(255,255,255,.08)';
    arrowBtn.style.border='1px solid rgba(255,255,255,.12)';
    arrowBtn.style.borderRadius='999px';
    arrowBtn.style.color='var(--text)';
    arrowBtn.style.cursor='pointer';
    arrowBtn.style.fontSize='14px';
    arrowBtn.style.fontWeight='700';
    arrowBtn.setAttribute('aria-label','Scroll topics');
    arrowBtn.onclick=function(){
      topicScroll.scrollBy({left:200,behavior:'smooth'});
    };
    bar.appendChild(arrowBtn);
    
    // Right-edge fade
    var fade=document.createElement('div');
    fade.className='filter-topic-fade';
    fade.style.position='absolute';
    fade.style.right='0';
    fade.style.top='0';
    fade.style.bottom='0';
    fade.style.width='40px';
    fade.style.background='linear-gradient(to right,transparent,var(--ink))';
    fade.style.pointerEvents='none';
    fade.style.zIndex='1';
    topicScroll.style.position='relative';
    topicScroll.appendChild(fade);
    
    var rb=document.getElementById('mapRoleBar');
    if(rb)rb.style.display='none';
  }catch(e){}
}
function setMemoryFilter(f){
  try{
    window._memFilter=f||'all';
    renderMemoryFilters();
    applyMapMode();
  }catch(e){}
}

function renderMemoryFilters(){
  try{
    var bar=document.getElementById('mapFilterBar');if(!bar)return;
    bar.innerHTML='';
    var filters=[
      {id:'all',label:'All'},
      {id:'mine',label:'Mine'},
      {id:'tagged',label:'Tagged with me'}
    ];
    var active=window._memFilter||'all';
    var group=document.createElement('div');
    group.style.display='flex';
    group.style.gap='6px';
    group.style.alignItems='center';
    filters.forEach(function(f){
      var b=document.createElement('button');
      b.className='chip filter-status-chip'+(active===f.id?' active':'');
      b.style.padding='7px 12px';
      b.style.display='flex';
      b.style.alignItems='center';
      b.style.gap='6px';
      var dot=document.createElement('span');
      dot.style.display='inline-block';
      dot.style.width='8px';
      dot.style.height='8px';
      dot.style.borderRadius='50%';
      dot.style.background=f.id==='all'?'var(--blue)':f.id==='mine'?'var(--amber)':'var(--red)';
      dot.style.boxShadow='0 0 6px '+(f.id==='all'?'var(--blue)':f.id==='mine'?'var(--amber)':'var(--red)');
      b.appendChild(dot);
      var label=document.createElement('span');
      label.textContent=f.label;
      b.appendChild(label);
      b.onclick=(function(id){return function(){setMemoryFilter(id);};})(f.id);
      group.appendChild(b);
    });
    bar.appendChild(group);

    // Hide role bar
    var rb=document.getElementById('mapRoleBar');
    if(rb)rb.style.display='none';

    // Empty state check
    checkMemoryEmptyState();
  }catch(e){}
}

function checkMemoryEmptyState(){
  try{
    if(_mapMode!=='memories')return;
    if(!window.EtieCloud||!window.EtieCloud.fetchMyMemories)return;
    window.EtieCloud.fetchMyMemories(function(logs){
      try{
        var photoLogs=(logs||[]).filter(function(l){return l&&l.lat!=null&&l.lng!=null&&l.photo_url;});
        // Apply filter
        var filter=window._memFilter||'all';
        var myId=null;try{myId=myUid();}catch(e){}
        if(filter==='mine'){
          photoLogs=photoLogs.filter(function(l){return l.user_id===myId;});
        }else if(filter==='tagged'){
          photoLogs=photoLogs.filter(function(l){return l.tagged_user_id===myId;});
        }
        if(!photoLogs.length){
          // Show empty state
          var empty=document.getElementById('mapEmptyBanner');
          if(empty){
            empty.classList.remove('hidden');
            empty.innerHTML='No memories yet. Add your first. <button onclick="openStandaloneLog()" style="margin-left:8px;padding:8px 16px;min-height:44px;background:#f43f5e;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">+ Add</button>';
          }
        }else{
          var empty=document.getElementById('mapEmptyBanner');
          if(empty)empty.classList.add('hidden');
        }
      }catch(e){}
    });
  }catch(e){}
}

function setMapFilter(cat){MAP_FILTER=(MAP_FILTER===cat)?'All':cat;renderMapFilter();renderMapPins();}
function setMapRole(role){MAP_ROLE=role;renderMapFilter();renderMapPins();}
function selectIntent(id){if(id==='All'){MAP_ROLE='All';MAP_FILTER='All';}else{MAP_ROLE=id;}renderMapFilter();renderMapPins();}
function renderMapPins(){
  try{
    if(!window.maplibregl||!document.getElementById('hkMap'))return;
    initHKMap();if(!_map)return;
    _pinMarkers.forEach(function(m){try{m.remove();}catch(e){}});
    _pinMarkers=[];
    // Clear existing pin layers
    ['pins','pin-clusters'].forEach(function(id){
      if(_map.getLayer(id))_map.removeLayer(id);
      if(_map.getSource(id))_map.removeSource(id);
    });
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
        var coords=pinLatLng(p);
        var fresh=(Date.now()-(p.ts||0))<3600*1000?' sq-pin-fresh':'';
        var expired=isPinExpired(p)?' sq-pin-expired':'';
        var prole=((p.derivedRole||p.role)==='local')?'local':'traveller';
        // Determine color: red=local, amber=traveller, pink=other, blue=me (when Share location On)
        var isMe=false;
        try{var myId=myUid();isMe=!!(myId&&p.authorId&&myId===p.authorId);}catch(e){}
        var colorClass=isMe?'me':prole;
        var el=document.createElement('div');
        el.className='sq-pin sq-pin-'+colorClass+(fresh||'')+(expired||'');
        el.innerHTML=mapCatEmoji(p.category);
        el.style.width='36px';el.style.height='36px';el.style.display='flex';el.style.alignItems='center';el.style.justifyContent='center';el.style.fontSize='18px';
        var mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([coords[1],coords[0]]).addTo(_map);
        mk.getElement().addEventListener('click',function(e){try{e.stopPropagation();}catch(_){} _pinJustClicked=true;setTimeout(function(){_pinJustClicked=false;},300); (function(id){return function(){openPinDetail(id);};})(p.id)();});
        _pinMarkers.push(mk);
        // Store selected state for later
        mk._pinId=p.id;
      }catch(e){}
    }
    function renderPinCluster(group){
      var center=pinLatLng(group[0]);
      var count=group.length;
      var radius=30; // pixels from center
      // Render cluster circle at center
      var clusterEl=document.createElement('div');
      clusterEl.className='sq-cluster';
      clusterEl.innerHTML='<span>'+count+'</span>';
      clusterEl.style.width='44px';clusterEl.style.height='44px';clusterEl.style.display='flex';clusterEl.style.alignItems='center';clusterEl.style.justifyContent='center';clusterEl.style.fontSize='14px';clusterEl.style.fontWeight='800';
      var clusterMarker=new maplibregl.Marker({element:clusterEl,anchor:'center'}).setLngLat([center[1],center[0]]).addTo(_map);
      clusterMarker.getElement().addEventListener('click',function(e){try{e.stopPropagation();}catch(_){} _pinJustClicked=true;setTimeout(function(){_pinJustClicked=false;},300); _map.flyTo({center:[center[1],center[0]],zoom:Math.min(_map.getZoom()+2,16),duration:500});});
      _pinMarkers.push(clusterMarker);
      // Render individual pins spread around center
      group.forEach(function(p,i){
        var angle=(i/group.length)*2*Math.PI;
        try{
          var fresh=(Date.now()-(p.ts||0))<3600*1000?' sq-pin-fresh':'';
          var expired=isPinExpired(p)?' sq-pin-expired':'';
          var prole=((p.derivedRole||p.role)==='local')?'local':'traveller';
          var isMe=false;
          try{var myId=myUid();isMe=!!(myId&&p.authorId&&myId===p.authorId);}catch(e){}
          var colorClass=isMe?'me':prole;
          var el=document.createElement('div');
          el.className='sq-pin sq-pin-'+colorClass+(fresh||'')+(expired||'');
          el.innerHTML=mapCatEmoji(p.category);
          el.style.width='36px';el.style.height='36px';el.style.display='flex';el.style.alignItems='center';el.style.justifyContent='center';el.style.fontSize='18px';
          var offsetLat=center[0]+(radius/111000)*Math.cos(angle);
          var offsetLng=center[1]+(radius/111000)*Math.sin(angle)/Math.cos(center[0]*Math.PI/180);
          var mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([offsetLng,offsetLat]).addTo(_map);
          mk.getElement().addEventListener('click',function(e){try{e.stopPropagation();}catch(_){} _pinJustClicked=true;setTimeout(function(){_pinJustClicked=false;},300); (function(id){return function(){openPinDetail(id);};})(p.id)();});
          _pinMarkers.push(mk);
        }catch(e){}
      });
    }
    // Auto-fit once on initial load
    if(!_map._autoFitted && _pinMarkers.length > 0){
      _map._autoFitted = true;
      try{
        var coords = _pinMarkers.map(function(m){return m.getLngLat();});
        if(coords.length === 1){
          _map.flyTo({center:[coords[0].lng, coords[0].lat], zoom:14, duration:800});
        } else {
          var bounds = coords.reduce(function(b,c){return b.extend(c);}, new maplibregl.LngLatBounds(coords[0], coords[0]));
          _map.fitBounds(bounds, {padding:{top:80,bottom:80,left:260,right:80}, maxZoom:14, duration:800});
        }
      }catch(e){}
    }
  }catch(e){}
}
function selectHookCategory(el,v){try{var c=document.getElementById('hookInterestPills');if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');});if(el)el.classList.add('active');_hookDraft.category=v;_hookDraft.categoryTouched=true;}catch(e){try{_hookDraft.category=v;_hookDraft.categoryTouched=true;}catch(_){}}}
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
  {cat:'dubious quests and giggles',emoji:'💃',label:'dance? or even better... salsa?',title:'Salsa & Bachata night — down for a dance?'},
  {cat:'time for a cuppa tea / coffee!',emoji:'🥟',label:'foodie time?',title:'Foodie run — hunting for hidden local gems'},
  {cat:'are you a fellow alcoholic?',emoji:'🍸',label:'drinks in soho?',title:'Casual drinks & speakeasy in Soho'},
  {cat:'letterboxd date',emoji:'🎬',label:'letterboxd? sounds like movie movie',title:'Movie night for film heads'}
];
function applyHookPreset(i){
  try{
    var p=HOOK_PRESETS[i];if(!p)return;
    _hookDraft.category=p.cat;_hookDraft.categoryTouched=true;
    try{var c=document.getElementById('hookInterestPills');if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){var oc=x.getAttribute('onclick')||'';x.classList.toggle('active',oc.indexOf("'"+p.cat+"'")!==-1);});}catch(e){}
    var ht0=document.getElementById('hookTitle');if(ht0)ht0.value=p.title.slice(0,60);
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
function selectHookDuration(el){
  try{
    if(!el)return;
    var c=document.getElementById('hookDurationPills');
    if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){x.classList.remove('active');});
    el.classList.add('active');
    var dur=el.getAttribute('data-duration');
    _hookDraft.duration=dur;
    var endRow=document.getElementById('customEndTimeRow');
    var endInput=document.getElementById('customEndTime');
    if(dur==='none'){
      if(endRow)endRow.style.display='none';
      if(endInput){endInput.value='';endInput.removeAttribute('readonly');endInput.placeholder='No expiry — pin stays until you log it';}
    }else{
      if(endRow)endRow.style.display='';
      if(endInput){endInput.setAttribute('readonly','true');}
      updateEndTimeFromDuration();
    }
  }catch(e){}
}
function updateEndTimeFromDuration(){
  try{
    var dateStr=document.getElementById('customDate')?.value;
    var startStr=document.getElementById('customStartTime')?.value;
    var dur=_hookDraft.duration||'3h';
    var endInput=document.getElementById('customEndTime');
    if(!dateStr || !startStr || !endInput || dur==='none') return;
    var start=new Date(dateStr+'T'+startStr).getTime();
    var ms=parseDurationMs(dur);
    var end=new Date(start+ms);
    var hh=String(end.getHours()).padStart(2,'0');
    var mm=String(end.getMinutes()).padStart(2,'0');
    endInput.value=hh+':'+mm;
  }catch(e){}
}
function parseDurationMs(dur){
  var m=dur.match(/^(\d+)([hd])$/);
  if(!m) return 3*3600*1000;
  var n=parseInt(m[1],10);
  return m[2]==='h'?n*3600*1000:n*24*3600*1000;
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
    if(_hookDraft && _hookDraft.duration && _hookDraft.duration!=='none'){
      var dateStr=document.getElementById('customDate')?.value;
      var startStr=document.getElementById('customStartTime')?.value;
      if(dateStr && startStr){
        var start=new Date(dateStr+'T'+startStr).getTime();
        var ms=parseDurationMs(_hookDraft.duration);
        var end=start+ms;
        return {s:start,e:end};
      }
    }
    if(_hookDraft && _hookDraft.duration==='none'){
      return {s:nowTs,e:null}; // no expiry
    }
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
    _hookDraft={category:'general',categoryTouched:false,role:startRole,window:'custom',capacity:3,customStart:null,customEnd:null,photos:[]};
    var _lh={};try{_lh=ETIE.lastHook||{};}catch(e){}
    var ht0=document.getElementById('hookTitle');if(ht0)ht0.value=_lh.title||'';
    _hookDraft.capacity=3;hookCap((Math.min(4,Math.max(2,parseInt(_lh.capacity,10)||3)))-3);renderHookRoleLine();
    renderHookPresets();
    try{
      var pc=document.getElementById('hookInterestPills');
      if(pc)Array.prototype.forEach.call(pc.querySelectorAll('.chip'),function(x){
        var oc=x.getAttribute('onclick')||'';
        x.classList.toggle('active',!!(_lh.category&&oc.indexOf("'"+_lh.category+"'")!==-1));
      });
      if(_lh.category)_hookDraft.category=_lh.category;
      if(_lh.category)_hookDraft.categoryTouched=true;
    }catch(e){}
    var _now=new Date();
    var _p2=function(n){return (n<10?'0':'')+n;};
    var _start=new Date(_now.getTime()+60*60*1000); // default start 1h out so fresh pins open Accepting
    var _today=_start.getFullYear()+'-'+_p2(_start.getMonth()+1)+'-'+_p2(_start.getDate());
    var cd=document.getElementById('customDate'); if(cd) cd.value=_today;
    var cst=document.getElementById('customStartTime'); if(cst) cst.value=_p2(_start.getHours())+':'+_p2(_start.getMinutes());
    var cet=document.getElementById('customEndTime'); if(cet) cet.value='';
    var pv=document.getElementById('hookPhotoPreview'); if(pv) pv.innerHTML='';
    _hookDraft.duration='3h';
    try{
      var _dp=document.querySelector('#hookDurationPills [data-duration="'+((_lh&&_lh.duration)||'3h')+'"]');
      if(!_dp)_dp=document.querySelector('#hookDurationPills [data-duration="3h"]');
      selectHookDuration(_dp);
    }catch(e){selectHookDuration(document.querySelector('#hookDurationPills [data-duration="3h"]'));}
    try{var _hr=document.getElementById('hookRegion');if(_hr&&_lh&&_lh.region)_hr.value=_lh.region;}catch(e){}
    var cd=document.getElementById('customDate');
    var cst=document.getElementById('customStartTime');
    if(cd)cd.onchange=updateEndTimeFromDuration;
    if(cst)cst.onchange=updateEndTimeFromDuration;
    // no tap yet → no coords, no guess; Drop Pin stays blocked until the user taps
    var o=document.getElementById('dropHookModal');if(o){o.classList.remove('hidden');try{var _mb=o.querySelector('.chat-popup-body');if(_mb)_mb.scrollTop=0;}catch(e){}}
    var li=document.getElementById('hookLocation');
    if(li){li.value=window._pendingDropGuess||(_dropPoint?('Near '+nearestDistrictLabel(_dropPoint.lat,_dropPoint.lng)):'');window._pendingDropGuess=null;}
    var ht=document.getElementById('hookText');if(ht){ht.value=(_lh&&_lh.hook)||'';var ph='';try{ph=(ETIE.traveller&&ETIE.traveller.bio)||'';}catch(e){}ht.placeholder=ph||"e.g. Grabbing late-night claypot rice in Sham Shui Po—who's down to join?";}
    hookCountTick();setHookRole(_hookDraft.role);
    if(_dropMarker){try{_dropMarker.remove();}catch(e){}_dropMarker=null;}
    if(_dropPoint){try{_dropMarker=new maplibregl.Marker({color:'#3ddc97'}).setLngLat([_dropPoint.lng,_dropPoint.lat]).addTo(_map);}catch(e){}}
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
function pinSyncState(p){
  try{
    if(!p)return 'local';
    if(p.syncState==='live'||p.syncState==='syncing'||p.syncState==='local')return p.syncState; // explicit last-push outcome wins (incl. guests on host pins)
    if(p.origin==='cloud'||p.cloudId)return 'live'; // legacy pins pushed before sync tracking
    return 'local';
  }catch(e){return 'local';}
}
function paintSyncBadge(el,p){
  try{
    if(!el)return;
    var st=pinSyncState(p);
    el.style.display='';
    el.className='small sync-badge sync-'+st;
    var label=st==='live'?'':(st==='syncing'?'⏳ Sharing…':'📴 Not synced');
    try{if(st!=='live'&&p.syncError)label+=' · '+p.syncError;}catch(e){}
    el.textContent=label;
    if(!label)el.style.display='none';
  }catch(e){}
}
function markPinSynced(pinId,ok){
  // callback from EtieCloud.pushPin: flip honest sync state without touching anything else
  try{
    var arr=ETIE.mapPins||[];
    for(var i=0;i<arr.length;i++){var p=arr[i];if(p&&(p.id===pinId)){p.syncState=ok?'live':'local';break;}}
    saveState();renderMapPins();
    try{
      if(window._openPinId===pinId){
        var sb=document.getElementById('pinSyncBadge');
        if(sb)paintSyncBadge(sb,findPin(pinId));
      }
    }catch(e){}
  }catch(e){}
}
function persistPinCloud(pin){
  try{if(window.EtieCloud&&window.EtieCloud.pushPin)window.EtieCloud.pushPin(pin);}catch(e){}
}
function retryLocalPins(){
  // upload pins that never reached the cloud: signed-out drops AND failed updates
  // (e.g. a join request that was rejected by RLS). Called once a session exists.
  try{
    var arr=ETIE.mapPins||[],n=0;
    for(var i=0;i<arr.length&&n<20;i++){
      var p=arr[i];
      if(!p)continue;
      try{if(isPinExpired(p))continue;}catch(e){}
      var st=pinSyncState(p);
      if(st!=='local')continue;
      if(p.origin!=='local'&&!p.syncState)continue; // untouched cloud pins stay put
      p.syncState='syncing';p.syncError=null;
      try{persistPinCloud(p);n++;}catch(e){}
    }
    if(n){saveState();renderMapPins();}
  }catch(e){}
}
function saveDropHook(){
  try{
    if(!_dropPoint){toast('Tap the map first to place your pin.');return;}
    var title=((document.getElementById('hookTitle')||{}).value||'').trim().slice(0,60);
    var loc=((document.getElementById('hookLocation')||{}).value||'').trim().replace(/^\s*near\s+/i,'');
    var details=((document.getElementById('hookText')||{}).value||'').trim().slice(0,140);
    if(!title){toast('Give it a title first.');return;}
    var _dStr=((document.getElementById('customDate')||{}).value||'').trim();
    var _sStr=((document.getElementById('customStartTime')||{}).value||'').trim();
    if(!_dStr||!_sStr){toast('Pick a date and start time first.');return;}
    if(!_hookDraft.categoryTouched){toast('Pick a category first.');return;}
    if(!loc){toast('Name the pin location first.');return;}
    var nm=hookNick(),vf=hookVerified();
    var nowTs=Date.now();
    var win=windowExpires(_hookDraft.window||'now',nowTs);
    var cap=Math.min(4,Math.max(2,_hookDraft.capacity||3));
    var hook=details||title;
    // guarantee a filterable category even if no chip was tapped ('general'/'Food' match nothing)
    try{
      var _okCat=(typeof MAP_VIBES!=='undefined')&&MAP_VIBES.some(function(v){return v.id===_hookDraft.category;});
      if(!_okCat)_hookDraft.category='something else on your mind?';
    }catch(e){try{_hookDraft.category='something else on your mind?';}catch(_){}}
    var startsAt=win.s, endsAt=win.e;
    // Lifecycle timestamps. isoOrNull prevents new Date(null) -> 1970-01-01, which
    // made "No expiry" hooks invisible to every other device (vanish time in the past).
    var requestCutoffAt=endsAt; // requests stay open while spots remain, up to hangout end
    var hangoutEndAt=endsAt;
    var pinVanishAt=endsAt ? endsAt + 2*60*60*1000 : null;
    var pin={id:'pin-'+nowTs,kind:'hook',title:title,category:_hookDraft.category,role:_hookDraft.role,derivedRole:(function(){try{return ETIE.derivedRole||_hookDraft.role;}catch(e){return _hookDraft.role;}})(),authorId:(function(){try{return myUid();}catch(e){return null;}})(),
      starts_at:isoOrNull(startsAt),ends_at:isoOrNull(endsAt),expires_at:isoOrNull(endsAt),
      requestCutoffAt:isoOrNull(requestCutoffAt),
      hangoutEndAt:isoOrNull(hangoutEndAt),
      pinVanishAt:isoOrNull(pinVanishAt),
      capacity:cap,spotsAvailable:cap,
      name:nm,verified:vf,location:loc,lat:_dropPoint.lat,lng:_dropPoint.lng,hook:hook,photos:(_hookDraft.photos||[]).map(function(p){return p.dataUrl;}),
      region:_hookDraft.region||'HK',members:[{nick:nm,role:_hookDraft.role,verified:vf,bio:((ETIE.traveller&&ETIE.traveller.bio)||'').slice(0,140)}],pending:[],requests:[],status:'active',
      ts:Date.now(),origin:'local',cloudId:null,syncState:(function(){try{return (window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession())?'syncing':'local';}catch(e){return 'local';}})()};
    if(_hookDraft.window==='custom'){
      var cs=document.getElementById('customDate')?.value;
      var cst=document.getElementById('customStartTime')?.value;
      var cet=document.getElementById('customEndTime')?.value;
      if(cs && cst) pin.customStart=cs+'T'+cst;
      if(cs && cet) pin.customEnd=cs+'T'+cet;
    }
    // Region for dynamic flag
    var reg=document.getElementById('hookRegion');
    if(reg) pin.region=reg.value;
    if(!ETIE.mapPins)ETIE.mapPins=[];
    // remember this drop so the next sheet opens prefilled (photos excluded on purpose)
    try{ETIE.lastHook={title:title,hook:hook,category:_hookDraft.category,capacity:cap,duration:(_hookDraft.duration||'3h'),region:((document.getElementById('hookRegion')||{}).value||'HK')};}catch(e){}
    ETIE.mapPins.push(pin);
    saveState();persistPinCloud(pin);
    _dropPoint=null;
    if(_dropMarker){try{_dropMarker.remove();}catch(e){}_dropMarker=null;}
    closeDropHook();renderMapPins();
    toast(pin.syncState==='local'?'Hook saved on this device only — sign in to share it live.':'Hook dropped — sharing live.');
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
function isPinExpired(p){try{var t=validTs(p.expires_at);return t===null?false:t<Date.now();}catch(e){return false;}}
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
  try{var c=parseInt(p.capacity,10);if(c>=2&&c<=4){var open=Math.max(0,c-n);cap=open===0?' · Full':' · '+open+(open===1?' spot open':' spots open');}}catch(e){}
  if(isPinExpired(p))return 'Ended — log it';
  try{if(getPinLifecycleState(p)==='requests_closed')return 'Requests closed'+cap;}catch(e){}
  if(p.status==='trio'||n>=3)return '3 Connected'+cap;
  if(p.status==='pair'||n===2)return '1-on-1 Meetup'+cap;
  return 'Active'+cap;
}
var _expiryToasted={};
function sweepExpiredPins(){
  try{
    var now=Date.now(),changed=false,me=hookNick();
    (ETIE.mapPins||[]).forEach(function(raw){
      try{
        if(!raw||raw.kind==='guide'||raw.lat==null)return;
        var vanishAt=(function(){var t=validTs(raw.pinVanishAt);if(t!==null)return t;var e=validTs(raw.expires_at);return e===null?0:e+2*60*60*1000;})();
        // Pin vanishes from map after hangoutEndAt + 2hr buffer
        if(vanishAt && vanishAt < now && raw.status!=='archived'){
          raw.status='archived';changed=true;
          // Auto-archive to memory log for all members
          (raw.members||[]).forEach(function(m){
            try{addToMemoryLog(m.nick||m.uid, raw);}catch(e){}
          });
          if(raw.name===me&&!_expiryToasted[raw.id]){_expiryToasted[raw.id]=1;setTimeout((function(t){return function(){toast('🔥 “'+t+'” ended — it\'s now in your Memory Log.');};})((raw.title||raw.location||'Your hook')),1500);}
        } else {
          var ex=validTs(raw.expires_at)||0;
          if(ex&&ex<now&&raw.status==='active'){
            raw.status='pending_memory_log';changed=true;
            if(raw.name===me&&!_expiryToasted[raw.id]){_expiryToasted[raw.id]=1;setTimeout((function(t){return function(){toast('🔥 “'+t+'” ended — log the memory!');};})((raw.title||raw.location||'Your hook')),1500);}
          }
        }
        // Check and expire pending requests
        if(checkAndExpireRequests(raw)) changed=true;
      }catch(e){}
    });
    if(changed){saveState();try{(ETIE.mapPins||[]).forEach(function(raw){try{if(raw&&(raw.status==='pending_memory_log'||raw.status==='archived'))persistPinCloud(raw);}catch(e){}});}catch(e){}}
    return changed;
  }catch(e){return false;}
}
function openPinDetail(id){
  try{
    var p=findPin(id);if(!p){toast('Pin not found.');return;}
    checkAndExpireRequests(p);
    _openPinId=id;
    var me=hookNick();
    var myId=null;try{myId=myUid();}catch(e){}
    // host = author by user id (nicknames are not unique — never use them for permissions).
    var isHost=!!(myId&&p.authorId&&myId===p.authorId);
    var isMember=(p.members||[]).some(function(m){return m.uid?m.uid===myId:m.nick===me;});
    if(isHost)isMember=true;
    // find this user's request if any
    var myReq=null;
    (p.requests||[]).forEach(function(r){if(r.uid===myId||r.nick===me)myReq=r;});
    var reqStatus=myReq?myReq.status:null; // 'pending' | 'approved' | 'declined' | 'expired'
    var nn=document.getElementById('pinNick');if(nn)nn.textContent=p.name||'Someone';
    var av2=document.getElementById('pinAvatar');if(av2)av2.textContent=((p.name||'?').charAt(0)||'?').toUpperCase();
    var cb=document.getElementById('pinChatBtn');if(cb)cb.style.display=isMember?'':'none';
    var lb=document.getElementById('pinLogBtn');if(lb)lb.style.display=isMember?'':'none';
    try{renderPinLogs(p.id);}catch(e){}
    var vb=document.getElementById('pinVerified');if(vb){vb.textContent=p.verified?'Verified':'';vb.style.display=p.verified?'':'none';}
    var rb=document.getElementById('pinRoleBadge');if(rb){var pr=(p.role==='local')?'local':'traveller';rb.textContent=(pr==='local'?getRegionFlag(p)+' ':'')+(pr==='local'?'Local host':'Visiting');rb.classList.toggle('city-host',pr==='local');}
    var ptt=document.getElementById('pinTitle');if(ptt)ptt.textContent=p.title||p.location||'Hook';
    var ph=document.getElementById('pinHook');var hookTxt=p.hook||'';
    // Only show hook text if it differs from the title (avoid repetition)
    if(ph){
      if(hookTxt && hookTxt !== (p.title||'')){
        ph.textContent=hookTxt;
        ph.style.display='';
        var hl=document.querySelector('.hook-label');
        if(hl)hl.style.display='';
      }else{
        ph.style.display='none';
        var hl2=document.querySelector('.hook-label');
        if(hl2)hl2.style.display='none';
      }
    }
    var lc=document.getElementById('pinLoc');
    if(lc){var locTxt=String(p.location||'Hong Kong').replace(/^\s*near\s+/i,'');lc.textContent=mapCatEmoji(p.category)+' '+getRegionFlag(p)+' Near '+locTxt;}
    var pb=document.getElementById('pinBio');if(pb){var bb=p.members&&p.members[0]&&p.members[0].bio;pb.textContent=bb||'';pb.style.display=bb?'':'none';}
    var gb=document.getElementById('pinGroupBadge');if(gb)gb.textContent=groupBadgeText(p);
    try{var _lb0=document.getElementById('pinLifecycleBadge');if(_lb0)_lb0.style.display='none';}catch(e){} // merged into group badge
    var sb=document.getElementById('pinSyncBadge');if(sb)paintSyncBadge(sb,p);
    var mem=document.getElementById('pinMembers');
    if(mem){mem.innerHTML='';var ms=p.members||[];if(ms.length===1){var s=document.createElement('span');s.className='chip';s.textContent='Going: '+(ms[0].nick||'');mem.appendChild(s);}else if(ms.length>1){var s2=document.createElement('span');s2.className='chip';s2.textContent='Going ('+ms.length+')';mem.appendChild(s2);}}
    // GUEST VIEW: request status tab
    renderGuestRequestTab(p, myReq, reqStatus, isMember, isHost);
    // HOST VIEW: pending requests with Approve/Decline
    renderHostRequestView(p, isHost);
    var del=document.getElementById('pinDeleteBtn');
    if(del)del.style.display=isHost?'':'none';
    var claim=document.getElementById('pinClaimBtn');
    // escape hatch only: orphan pins with no recorded author. Creator is host, always.
    if(claim)claim.style.display=(!isHost&&!p.authorId&&isEtieAdmin())?'':'none';
    try{fillMemoryStrip('pinMemories',p.authorId||null);}catch(e){}
    try{fillSpotsStrip('pinSpots',p.authorId||null);}catch(e){}
    var d=document.getElementById('pinDrawer');if(d){d.classList.remove('hidden');d.classList.toggle('pin-drawer-expired',isPinExpired(p));document.body.classList.add('has-open-card');}
  }catch(e){}
}
function closePinDetail(){try{_openPinId=null;var d=document.getElementById('pinDrawer');if(d)d.classList.add('hidden');document.body.classList.remove('has-open-card');}catch(e){}}

// ===== PIN LIFECYCLE STATE =====
function getPinLifecycleState(p){
  // Returns: 'active' | 'requests_closed' | 'ended' | 'vanished'
  var now=Date.now();
  var vanishAt=validTs(p.pinVanishAt);
  var hangoutEndAt=validTs(p.hangoutEndAt);
  if(hangoutEndAt===null)hangoutEndAt=validTs(p.expires_at);
  var requestCutoffAt=validTs(p.requestCutoffAt);
  if(requestCutoffAt===null)requestCutoffAt=hangoutEndAt; // open till hangout end while spots remain
  if(vanishAt!==null && now>=vanishAt) return 'vanished';
  if(hangoutEndAt!==null && now>=hangoutEndAt) return 'ended';
  if(requestCutoffAt!==null && now>=requestCutoffAt) return 'requests_closed';
  return 'active';
}
function getPinLifecycleLabel(p){
  var state=getPinLifecycleState(p);
  if(state==='active') return '🟢 Active & Accepting';
  if(state==='requests_closed') return '🔒 Requests Closed';
  if(state==='ended') return '🏁 Hangout Ended — Tap to Log Memory';
  return '👻 Archived';
}
function getPinLifecycleClass(p){
  var state=getPinLifecycleState(p);
  if(state==='active') return 'lifecycle-active';
  if(state==='requests_closed') return 'lifecycle-requests-closed';
  if(state==='ended') return 'lifecycle-ended';
  return 'lifecycle-vanished';
}

// ===== GUEST REQUEST STATUS TAB =====
function renderGuestRequestTab(p, myReq, reqStatus, isMember, isHost){
  // hide old pending note
  var wait=document.getElementById('pinPendingNote');if(wait)wait.style.display='none';
  // hide old request button (we rebuild below)
  var req=document.getElementById('pinRequestBtn');if(req)req.style.display='none';

  // hosts never need guest-status UI (no "You're in" box, no duplicate chat button)
  if(isHost){
    var _sb=document.getElementById('pinRequestStatus');if(_sb)_sb.style.display='none';
    return;
  }

  var lifecycle=getPinLifecycleState(p);
  // Don't allow new requests if requests are closed, hangout ended, or pin vanished
  if(lifecycle!=='active'){
    if(req)req.style.display='none';
  }

  // no request yet, not a member, not host → show Request to Connect (only if active)
  if(!myReq && !isMember && !isHost && lifecycle==='active'){
    if(req){req.style.display='';req.textContent='Request to Connect';req.disabled=false;req.onclick=requestPinConnect;}
    return;
  }

  // build status tab
  var statusBox=document.getElementById('pinRequestStatus');
  if(!statusBox){
    statusBox=document.createElement('div');
    statusBox.id='pinRequestStatus';
    statusBox.style.cssText='margin-top:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:10px;border:1px solid rgba(255,255,255,.1);';
    var btn=document.getElementById('pinRequestBtn');
    if(btn)btn.parentNode.insertBefore(statusBox,btn.nextSibling);
  }
  var label='',cls='',actionHtml='';
  if(reqStatus==='pending'){
    label='⏳ Awaiting host approval';cls='pending';actionHtml='<button class="secondary" style="margin-top:8px;padding:10px 16px;" onclick="cancelMyRequest()">Cancel request</button>';
  }else if(reqStatus==='approved'){
    label='✅ Approved — you\'re in!';cls='approved';actionHtml='<button class="primary" style="margin-top:8px;padding:10px 16px;width:100%;" onclick="openChatDrawer(_openPinId)">Join the chat</button>';
  }else if(reqStatus==='declined'){
    label='❌ Request declined';cls='declined';actionHtml='<button class="secondary" style="margin-top:8px;padding:10px 16px;" onclick="clearMyDeclined()">Select another activity</button>';
  }else if(reqStatus==='expired'){
    label='⌛ Request expired (hook filled)';cls='expired';actionHtml='<button class="secondary" style="margin-top:8px;padding:10px 16px;" onclick="clearMyDeclined()">Select another activity</button>';
  }else if(isMember){
    label='✅ You\'re in this hangout';cls='approved';actionHtml='<button class="primary" style="margin-top:8px;padding:10px 16px;width:100%;" onclick="openChatDrawer(_openPinId)">Open chat</button>';
  }else{
    label='—';cls='';
  }
  statusBox.className='pin-request-status '+cls;
  statusBox.style.display='';
  statusBox.innerHTML='<div style="font-weight:600;color:#fff;margin-bottom:4px;">'+label+'</div>'+actionHtml;
}

// ===== HOST REQUEST VIEW (Approve/Decline) =====
function renderHostRequestView(p, isHost){
  var hostBox=document.getElementById('pinHostBox');
  if(!hostBox)return;
  hostBox.innerHTML='';
  if(!isHost)return;
  var pending=(p.requests||[]).filter(function(r){return r.status==='pending';});
  if(!pending.length)return;
  hostBox.innerHTML='<h4 style="margin:0 0 12px;color:#fff;">📋 Pending Requests ('+pending.length+')</h4>';
  pending.forEach(function(r){
    var idx=p.requests.indexOf(r);
    var row=document.createElement('div');
    row.style.cssText='display:flex;gap:12px;align-items:flex-start;padding:12px;background:rgba(255,255,255,.05);border-radius:10px;margin-bottom:8px;';
    var avatar=document.createElement('div');
    avatar.className='avatar';
    avatar.style.width='48px;height:48px;font-size:20px;background:linear-gradient(135deg,#f43f5e,#fb7185);flex-shrink:0;';
    avatar.textContent=(r.nick||'?').charAt(0).toUpperCase();
    var lab=document.createElement('div');
    lab.style.flex='1;min-width:0;';
    lab.innerHTML='<div style="font-weight:600;color:#fff;">'+(r.nick||'Someone')+'</div>'
      +'<div class="small muted">'+(r.role==='local'?'🇭🇰 Local Host':'✈️ Traveller')+(r.verified?' · Verified':'')+'</div>'
      +'<div class="small muted">'+new Date(r.createdAt).toLocaleTimeString()+'</div>'
      +(r.message?'<div class="small" style="margin-top:4px;color:#ffe4e6;">“'+r.message+'”</div>':'')
      +((r.vibe||[]).map(function(v){return '<div class="small" style="margin-top:4px;color:#ffe4e6;">💬 “'+(v.text||'')+'”</div>';}).join(''));
    var actions=document.createElement('div');
    actions.style.cssText='display:flex;flex-direction:column;gap:8px;flex-shrink:0;';
    var ok=document.createElement('button');ok.className='primary';ok.style.padding='10px 16px;width:100%;';ok.textContent='Approve';
    ok.onclick=(function(i){return function(){approveHookRequest(p.id,i);};})(idx);
    var no=document.createElement('button');no.className='secondary';no.style.padding='10px 16px;width:100%;';no.textContent='Decline';
    no.onclick=(function(i){return function(){declineHookRequest(p.id,i);};})(idx);
    actions.appendChild(ok);actions.appendChild(no);
    row.appendChild(avatar);row.appendChild(lab);row.appendChild(actions);
    hostBox.appendChild(row);
  });
}
function cancelMyRequest(){
  try{
    var p=findPin(_openPinId);if(!p)return;
    var myId=myUid();var me=hookNick();
    (p.requests||[]).forEach(function(r,idx){
      if((myId&&r.uid===myId)||r.nick===me){p.requests.splice(idx,1);}
    });
    storePin(p);openPinDetail(p.id);toast('Request cancelled.');
  }catch(e){}
}
function clearMyDeclined(){
  try{
    var p=findPin(_openPinId);if(!p)return;
    var myId=myUid();var me=hookNick();
    (p.requests||[]).forEach(function(r,idx){
      if((myId&&r.uid===myId)||r.nick===me){p.requests.splice(idx,1);}
    });
    storePin(p);openPinDetail(p.id);
  }catch(e){}
}
function acceptPinSidequest(){requestPinConnect();}
function requestPinConnect(){
  try{
    if(needProfile('connect'))return;
    // Gate: check if user owes questions for ended hangouts
    if(!checkQuestionGate()){toast('Answer your pending questions before joining a new hangout.');return;}
    var p=findPin(_openPinId);if(!p)return;
    try{if(myUid()&&p.authorId&&myUid()===p.authorId){toast('This is your hook — guests request to join you.');return;}}catch(e){}
    // Block new requests if requests are closed, hangout ended, or pin vanished
    var lifecycle=getPinLifecycleState(p);
    if(lifecycle!=='active'){toast('Requests for this hook have closed.');return;}
    var me={nick:hookNick(),role:(_hookDraft.role)||'traveller',verified:hookVerified(),ts:Date.now()};
    try{me.role=(ETIE.activeRole==='local')?'local':'traveller';}catch(e){}
    if((p.members||[]).some(function(m){return m.nick===me.nick;})){toast('You are already in this hangout.');return;}
    if((p.pending||[]).some(function(r){return r.nick===me.nick;})||(p.requests||[]).some(function(r){return r.nick===me.nick&&r.status==='pending';})){toast('Request already sent — waiting for the group.');return;}
    if(isPinExpired(p)){toast('This hook has ended.');return;}
    var cap=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
    if((p.members||[]).length>=Math.min(cap,3)){toast('This group is full ('+cap+' spots).');return;}
    var nowTs=Date.now();
    var reqId=(p.requests||[]).length>0?(p.requests[p.requests.length-1].id||null):null;
    var newReq={id:reqId||uuidv4(),uid:(function(){try{return myUid();}catch(e){return null;}})(),nick:me.nick,role:me.role,verified:me.verified,ts:me.ts,status:'pending',message:'',messageCount:0,vibe:[],createdAt:nowTs,updatedAt:nowTs};
    (p.requests||(p.requests=[])).push(newReq);
    storePin(p);
    openPinDetail(p.id);toast('Request sent — waiting for host approval.');
  }catch(e){toast('Could not send request.');}
}
function declineHookRequest(pinId,idx){
  try{
    var p=findPin(pinId);if(!p||!p.requests||!p.requests[idx])return;
    try{if(!canManagePin(p)){toast('Only the host can decline.');return;}}catch(e){return;}
    var req=p.requests[idx];
    if(req.status!=='pending') return;
    req.status='declined';req.updatedAt=Date.now();
    storePin(p);openPinDetail(p.id);renderMapPins();toast('Request declined.');
  }catch(e){}
}
function approveHookRequest(pinId,idx){
  try{
    // Gate: check if user owes questions for ended hangouts
    if(!checkQuestionGate()){toast('Answer your pending questions before approving a new hangout.');return;}
    var p=findPin(pinId);if(!p||!p.requests||!p.requests[idx])return;
    try{if(!canManagePin(p)){toast('Only the host can approve.');return;}}catch(e){return;}
    var req=p.requests[idx];
    if(req.status!=='pending') return;
    var cap=Math.min(4,Math.max(2,parseInt(p.capacity,10)||3));
    if((p.members||[]).length>=cap){
      toast('This hook is full ('+cap+' spots).');return;
    }
    req.status='approved';
    req.updatedAt=Date.now();
    p.members.push({nick:req.nick,role:req.role,verified:req.verified,uid:req.uid||null});
    req.locationRevealed=true;
    p.spotsAvailable=(p.spotsAvailable!==undefined?p.spotsAvailable:cap)-(p.members||[]).length;
    if(p.spotsAvailable<=0){
      p.requests.forEach(function(r){
        if(r.status==='pending' && r.id!==req.id){
          r.status='expired';r.updatedAt=Date.now();r.expiredReason='full';
        }
      });
    }
    storePin(p);openPinDetail(p.id);renderMapPins();
    toast('Approved! '+req.nick+' can now join the chat.');
    // Create connection (hangout) between host and approved requester
    try{
      var hostId=null;try{hostId=myUid();}catch(e){}
      if(hostId&&req.uid&&window.EtieCloud&&window.EtieCloud.acceptHookConnection){
        window.EtieCloud.acceptHookConnection(hostId, req.uid, function(){});
      }
    }catch(e){}
    try{if(window.EtieCloud&&window.EtieCloud.pushSharedRequest)window.EtieCloud.pushSharedRequest(p.id);}catch(e){}
  }catch(e){toast('Could not approve.');}
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
function renderPinVibe(p,me){
  try{
    var box=document.getElementById('pinVibeBox');if(!box)return;
    box.innerHTML='';box.style.display='none';
    var isMember=(p.members||[]).some(function(m){return m.nick===me;});
    if(isMember)return;
    var req=null;
    (p.requests||[]).forEach(function(r){if(r.status==='pending'&&r.nick===me)req=r;});
    if(!req)return;
    var vibe=req.vibe||[];
    var mine=vibe.filter(function(v){return v.nick===me;}).length;
    var left=Math.max(0,3-mine);
    box.style.display='';
    var h=document.createElement('div');h.className='small';h.style.cssText='font-weight:800;margin:8px 0 6px;color:#fff;';h.textContent='Vibe Check · '+left+'/3 left';box.appendChild(h);
    var list=document.createElement('div');list.style.cssText='display:flex;flex-direction:column;gap:6px;margin-bottom:8px;';
    vibe.forEach(function(v){
      var d=document.createElement('div');d.className='hchat'+(v.nick===me?' me':'');
      var w=document.createElement('span');w.className='who';w.textContent=v.nick||'Someone';
      d.appendChild(w);d.appendChild(document.createTextNode(v.text||''));list.appendChild(d);
    });
    if(!vibe.length){var e=document.createElement('div');e.className='muted small';e.textContent='No messages yet — introduce yourself.';list.appendChild(e);}
    box.appendChild(list);
    var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;';
    var inp=document.createElement('input');inp.id='pinVibeInput';inp.maxLength=140;
    inp.placeholder=left>0?'Introduce yourself & share your ETA...':'Vibe Check complete — wait for approval';
    inp.disabled=left<=0;inp.className='vibe-input';
    inp.onkeydown=function(ev){if(ev.key==='Enter')sendPinVibe();};
    var btn=document.createElement('button');btn.className='secondary';btn.style.padding='10px 14px';btn.textContent='Send';btn.disabled=left<=0;
    btn.onclick=function(){sendPinVibe();};
    row.appendChild(inp);row.appendChild(btn);box.appendChild(row);
  }catch(e){}
}
function sendPinVibe(){
  try{
    var p=findPin(_openPinId);if(!p)return;
    var me=hookNick();
    var req=null;
    (p.requests||[]).forEach(function(r){if(r.status==='pending'&&r.nick===me)req=r;});
    if(!req){toast('No pending request.');return;}
    req.vibe=req.vibe||[];
    var mine=req.vibe.filter(function(v){return v.nick===me;}).length;
    if(mine>=3){toast('Vibe Check complete — wait for host approval.');return;}
    var inp=document.getElementById('pinVibeInput');if(!inp)return;
    var text=(inp.value||'').trim();if(!text){toast('Introduce yourself first.');return;}
    req.vibe.push({nick:me,text:text.slice(0,140),ts:Date.now()});
    req.messageCount=(req.messageCount||0)+1;req.updatedAt=Date.now();
    storePin(p);renderPinVibe(p,me);
  }catch(e){}
}
function claimPinHost(){
  try{
    var p=findPin(_openPinId);if(!p){toast('Pin not found.');return;}
    var myId=myUid();if(!myId){toast('Sign in first.');return;}
    p.authorId=myId;
    storePin(p);
    openPinDetail(p.id);
    toast('You are now the host of this pin.');
  }catch(e){toast('Could not claim host.');}
}
function deletePinSidequest(){
  try{
    if(!_openPinId)return;
    var p=findPin(_openPinId);
    try{if(!canManagePin(p)){toast('Only the host can delete this pin.');return;}}catch(e){return;}
    ETIE.mapPins=(ETIE.mapPins||[]).filter(function(x){return x&&x.id!==_openPinId;});
    try{if(window.EtieCloud&&window.EtieCloud.deletePin&&p)window.EtieCloud.deletePin(p);}catch(e){}
    saveState();closePinDetail();renderMapPins();toast('Pin deleted.');
  }catch(e){}
}
// ---- Hook group chat drawer (Supabase etie_hook_messages realtime, local fallback) ----
var _chatPinId=null,_chatUnsub=null;
function openChatDrawer(pinId){
  try{
    var p=findPin(pinId);if(!p){toast('Hook not found.');return;}
    _chatPinId=pinId;
    var t=document.getElementById('chatHookTitle');if(t)t.textContent=getRegionFlag(p)+' '+(p.location||'Group chat');
    var s=document.getElementById('chatHookSub');
    if(s)s.textContent=((p.members||[]).map(function(m){return m.nick;}).join(' · ')||'Open hook');
    renderQuestBanner(p);
    renderHookChat();
    var d=document.getElementById('chatDrawer');if(d)d.classList.remove('hidden');
    try{fillMemoryStrip('chatMemories',p.authorId||null);}catch(e){}
    try{
      if(window.EtieCloud&&window.EtieCloud.subscribeHookChat){
        try{if(_chatUnsub)_chatUnsub();}catch(e){}
        var chatKey=String((p.cloudId||p.id));
        _chatUnsub=window.EtieCloud.subscribeHookChat(chatKey,function(row){
          try{
            addChatRow(chatKey,row);
            if(_chatPinId===pinId)renderHookChat();
          }catch(e){}
        });
      }
    }catch(e){}
  }catch(e){}
}
function closeChatDrawer(){try{_chatPinId=null;try{if(_chatUnsub)_chatUnsub();}catch(e){}_chatUnsub=null;var d=document.getElementById('chatDrawer');if(d)d.classList.add('hidden');}catch(e){}}
// ---- Chat state lives on the ETIE.mapPins ORIGINALS, never on findPin() copies ----
// findPin() returns a fresh normalized object, so mutating its .chat silently
// discards the message. These helpers always operate on the live array.
function pinChatArr(key,create){
  try{
    var arr=ETIE.mapPins||[];
    for(var i=0;i<arr.length;i++){
      var p=arr[i];
      if(p&&(String(p.cloudId||p.id)===String(key)||String(p.id)===String(key))){
        if(!p.chat&&create)p.chat=[];
        return p.chat||null;
      }
    }
  }catch(e){}
  return null;
}
function addChatRow(key,row){
  // returns true if the visible chat changed. Dedups by server id; upgrades an
  // optimistic local echo (same nick+text, close ts) instead of duplicating it.
  try{
    var arr=pinChatArr(key,true);if(!arr)return false;
    var rts=0;try{rts=new Date(row.created_at).getTime();}catch(e){}
    if(!rts)rts=row.ts||Date.now();
    var nick=row.sender_nick||row.nick||'Someone';
    var text=row.text||'';
    var id=row.id||null;
    var i,changed=false;
    if(id){
      for(i=0;i<arr.length;i++){if(arr[i]&&arr[i].id===id)return false;}
    }
    for(i=0;i<arr.length;i++){
      var m=arr[i];
      if(m&&(!m.id||String(m.id).indexOf('loc-')===0)&&m.nick===nick&&m.text===text&&Math.abs((m.ts||0)-rts)<15000){
        m.id=id||m.id;m.ts=rts;changed=true;break;
      }
    }
    if(!changed){
      arr.push({id:id||('loc-'+Date.now()+'-'+Math.floor(Math.random()*1e6)),nick:nick,role:row.sender_role||row.role||'traveller',text:text,ts:rts});
      if(arr.length>100)arr.splice(0,arr.length-100);
      changed=true;
    }
    if(changed){try{saveState();}catch(e){}}
    return changed;
  }catch(e){return false;}
}
function renderHookChat(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    var box=document.getElementById('chatMsgList');if(!box)return;
    box.innerHTML='';
    var me=hookNick();
    var msgs=(p.chat||[]).slice().sort(function(a,b){return (a.ts||0)-(b.ts||0);});
    msgs.forEach(function(m){
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
function toggleGlobalView(){
  try{
    if(!window.maplibregl||!_map)return;
    var btn=document.querySelector('.fab-globe');
    var isGlobal=_map.getZoom()<5;
    if(!isGlobal){
      // Go global
      _map.setMaxBounds([[-85,-180],[85,180]]);
      _map.flyTo({center:[114.1,22.3],zoom:3,duration:1500});
      if(btn)btn.classList.add('active');
      toast('🌍 Global view — drag to explore');
    }else{
      // Return to HK
      var a=getAnchor();
      _map.setMaxBounds([[-85,-180],[85,180]]);
      _map.flyTo({center:[a.lng,a.lat],zoom:HK_ZOOM,duration:1500});
      if(btn)btn.classList.remove('active');
      toast('🇭🇰 Back to Hong Kong');
    }
  }catch(e){}
}
function flyToArea(lat,lng,label){
  try{
    if(!window.maplibregl||!_map)return;
    _map.setMaxBounds([[lat-1.1,lng-1.8],[lat+1.1,lng+1.8]]);
    _map.flyTo({center:[lng,lat],zoom:13,duration:1000});
    toast(label||'Flying there.');
  }catch(e){}
}
function renderAreaSidebar(){
  try{
    var box=document.getElementById('areaList');if(!box)return;
    box.innerHTML='';
    if(_mapMode==='memories'){renderMemoryAreaSidebar(box);return;}
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
        var g=groups[k]||(groups[k]={lat:0,lng:0,n:0,people:{},labels:{},regions:{},pins:[]});
        g.lat+=p.lat;g.lng+=p.lng;g.n++;
        var rg=p.region||'HK';g.regions[rg]=(g.regions[rg]||0)+1;
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
        row.querySelector('strong').textContent=(function(){try{var rk=Object.keys(g.regions).sort(function(x,y){return g.regions[y]-g.regions[x];})[0];return (flagForCountry(rk||'HK')+' ');}catch(e){return '';}})()+(top.length>30?top.slice(0,29)+'…':top);
        row.querySelector('span.muted').textContent=g.n+' hook'+(g.n===1?'':'s')+(np?(' · '+np+' '+(np===1?'person':'people')):'');
        row.onclick=(function(la,ln,lb){return function(){flyToArea(la,ln,lb);};})(g.lat/g.n,g.lng/g.n,top);
        box.appendChild(row);
      }catch(e){}
    });
    var h=document.getElementById('areaCount');
    if(h)h.textContent=keys.length?keys.length+' area'+(keys.length===1?'':'s'):'';
  }catch(e){}
}
var _mapMode='hooks';
var _memFilter='all';
var _mainMemoryMarkers=[];
function renderMemoryAreaSidebar(box){
  try{
    var logs=window._memoryLogsCache||[];
    var a=getAnchor();
    var me=document.createElement('div');me.className='area-row area-me';
    me.innerHTML='<div><strong></strong><br><span class="muted small">your memory map home</span></div>';
    me.querySelector('strong').textContent='📍 '+(a.label||'Around you');
    me.onclick=function(){flyToArea(a.lat,a.lng,a.label||'Back home.');};
    box.appendChild(me);
    var groups={};
    logs.forEach(function(l){
      try{
        if(!l||l.lat==null||l.lng==null)return;
        var k=(Math.round(l.lat*2)/2).toFixed(1)+','+(Math.round(l.lng*2)/2).toFixed(1);
        var g=groups[k]||(groups[k]={lat:0,lng:0,n:0,people:{},labels:{}});
        g.lat+=l.lat;g.lng+=l.lng;g.n++;
        if(l.tagged_nickname)g.people[l.tagged_nickname]=1;
        var lb=l.location||l.title||'Hangout';
        g.labels[lb]=(g.labels[lb]||0)+1;
      }catch(e){}
    });
    var keys=Object.keys(groups).sort(function(x,y){return groups[y].n-groups[x].n;});
    if(!keys.length){var em=document.createElement('div');em.className='muted small';em.textContent='No memories yet — use Log a memory below.';box.appendChild(em);}
    keys.slice(0,12).forEach(function(k){
      try{
        var g=groups[k];
        var top=Object.keys(g.labels).sort(function(x,y){return g.labels[y]-g.labels[x];})[0]||'Somewhere';
        var np=Object.keys(g.people).length;
        var row=document.createElement('div');row.className='area-row';
        row.innerHTML='<div><strong></strong><br><span class="muted small"></span></div>';
        row.querySelector('strong').textContent=top.length>30?top.slice(0,29)+'…':top;
        row.querySelector('span.muted').textContent=g.n+' memor'+(g.n===1?'y':'ies')+(np?(' · '+np+' '+(np===1?'person':'people')):'');
        row.onclick=(function(la,ln,lb2){return function(){flyToArea(la,ln,lb2);};})(g.lat/g.n,g.lng/g.n,top);
        box.appendChild(row);
      }catch(e){}
    });
    var h=document.getElementById('areaCount');
    if(h)h.textContent=logs.length?(logs.length+' memor'+(logs.length===1?'y':'ies')):'';
  }catch(e){}
}
function setMapMode(mode){
  try{
    _mapMode=(mode==='memories')?'memories':'hooks';
    var a=document.getElementById('areaTabHooks'),b=document.getElementById('areaTabMem');
    if(a){a.classList.toggle('active',_mapMode==='hooks');a.setAttribute('aria-pressed',_mapMode==='hooks'?'true':'false');}
    if(b){b.classList.toggle('active',_mapMode==='memories');b.setAttribute('aria-pressed',_mapMode==='memories'?'true':'false');}
    try{renderAreaSidebar();}catch(e){}
    try{var h=document.getElementById('mapTapHint');if(h)h.textContent=_mapMode==='memories'?'Tap anywhere on the map to log a memory here.':'Click the map to drop a pin and tell travellers what you can show them.';}catch(_){}
    if(_mapMode==='memories'){
      renderMemoryFilters();
    }else{
      renderMapFilter();
    }
    applyMapMode();
    toast(_mapMode==='memories'?'📸 Memories — everywhere you have actually been.':'🪝 Hooks — people going out.');
  }catch(e){}
}
function applyMapMode(){
  try{
    if(!window.maplibregl||!_map)return;
    _mainMemoryMarkers.forEach(function(m){
      try{if(m._interval)clearInterval(m._interval);}catch(e){}
      try{m.remove();}catch(e){}
    });
    _mainMemoryMarkers=[];
    try{renderMapPins();}catch(e){}
    if(_mapMode==='memories'){
      loadMainMemoryMarkers();
      // Filter memories by current filter
      filterMainMemoryMarkers();
    }
  }catch(e){}
}

function filterMainMemoryMarkers(){
  try{
    if(_mapMode!=='memories')return;
    // Re-load with filter applied
    if(!window.EtieCloud||!window.EtieCloud.fetchMyMemories||!_map)return;
    var myId=null;try{myId=myUid();}catch(e){}
    if(!myId)return;
    window.EtieCloud.fetchMyMemories(function(logs){
      try{
        var photoLogs=(logs||[]).filter(function(l){return l&&l.lat!=null&&l.lng!=null&&l.photo_url;});
        var filter=window._memFilter||'all';
        if(filter==='mine'){
          photoLogs=photoLogs.filter(function(l){return l.user_id===myId;});
        }else if(filter==='tagged'){
          photoLogs=photoLogs.filter(function(l){return l.tagged_user_id===myId;});
        }
        _mainMemoryMarkers.forEach(function(m){
          try{if(m._interval)clearInterval(m._interval);}catch(e){}
          try{m.remove();}catch(e){}
        });
        _mainMemoryMarkers=[];
        if(!photoLogs.length){checkMemoryEmptyState();return;}
        var spots=groupMemoriesIntoSpots(photoLogs);
        spots.forEach(function(spot){
          try{
            var mk=createMemorySpotMarker(spot,_map);
            if(mk)_mainMemoryMarkers.push(mk);
          }catch(e){console.error('spot marker error:',e);}
        });
        checkMemoryEmptyState();
      }catch(e){}
    });
  }catch(e){}
}
function loadMainMemoryMarkers(){
  try{
    if(!window.EtieCloud||!window.EtieCloud.fetchMyMemories||!_map)return;
    var myId=null;try{myId=myUid();}catch(e){}
    if(!myId)return;
    window.EtieCloud.fetchMyMemories(function(logs){
      try{
        window._memoryLogsCache=dedupeMemories(logs);
        if(_mapMode!=='memories'||!_map)return;
        _mainMemoryMarkers.forEach(function(m){
          try{if(m._interval)clearInterval(m._interval);}catch(e){}
          try{m.remove();}catch(e){}
        });
        _mainMemoryMarkers=[];
        var photoLogs=window._memoryLogsCache.filter(function(l){return l&&l.lat!=null&&l.lng!=null&&l.photo_url;});
        if(!photoLogs.length)return;
        var spots=groupMemoriesIntoSpots(photoLogs);
        spots.forEach(function(spot){
          try{
            var mk=createMemorySpotMarker(spot,_map);
            if(mk)_mainMemoryMarkers.push(mk);
          }catch(e){console.error('spot marker error:',e);}
        });
        // Debug: draw radius circles
        if(debugGroupsEnabled() && _map && _map.addSource){
          try{
            spots.forEach(function(spot){
              var c=spot.coords;
              var pts=[];
              var r=MEMORY_GROUP_RADIUS_M/111320;
              for(var i=0;i<=64;i++){
                var a=(i/64)*2*Math.PI;
                pts.push([c.lng+Math.cos(a)*r/Math.cos(c.lat*Math.PI/180), c.lat+Math.sin(a)*r]);
              }
              var srcId='dbg-'+spot.id;
              if(_map.getSource(srcId))_map.removeSource(srcId);
              _map.addSource(srcId,{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}}});
              _map.addLayer({id:srcId,type:'fill',source:srcId,paint:{'fill-color':'#f43f5e','fill-opacity':0.08}});
              _map.addLayer({id:srcId+'-line',type:'line',source:srcId,paint:{'line-color':'#f43f5e','line-opacity':0.3,'line-width':1}});
            });
          }catch(e){}
        }
        try{renderAreaSidebar();}catch(e){}
      }catch(e){}
    });
  }catch(e){}
}
function refreshMapMode(){try{applyMapMode();}catch(e){}}
function closeGroupModal(){try{var o=document.getElementById('groupModal');if(o)o.classList.add('hidden');}catch(e){}}
function leaveHookChat(pinId){
  // leave an ended hangout: removes you from members and clears local chat.
  // Syncs (members is a real column), so it sticks on every device.
  try{
    if(!confirm('Leave this hangout? Its chat will be cleared for you.'))return;
    var arr=ETIE.mapPins||[],me=hookNick(),myId=null;
    try{myId=myUid();}catch(e){}
    for(var i=0;i<arr.length;i++){
      var p=arr[i];
      if(!p||(p.id!==pinId&&p.cloudId!==pinId))continue;
      p.members=(p.members||[]).filter(function(m){var mine=m.uid?(m.uid===myId):(m.nick===me);return !mine;});
      p.requests=(p.requests||[]).filter(function(r){var mine=r.uid?(r.uid===myId):(r.nick===me);return !mine;});
      p.chat=[];
      storePin(p);
      break;
    }
    try{if(window._openPinId===pinId)closePinDetail();}catch(e){}
    try{if(window._chatPinId===pinId)closeChatDrawer();}catch(e){}
    saveState();renderHookChatList();renderMapPins();
    toast('Left the hangout.');
  }catch(e){}
}
function renderRequestsRow(box){
  try{
    // Memory tag invites
    if(window.EtieCloud&&window.EtieCloud.fetchPendingTags){
      window.EtieCloud.fetchPendingTags(function(tags){
        try{
          if(!tags||!tags.length)return;
          // For each pending tag, fetch the memory to show thumbnail
          tags.forEach(function(tag){
            try{
              // Fetch memory details
              if(window.EtieCloud&&window.EtieCloud.fetchMyMemories){
                window.EtieCloud.fetchMyMemories(function(logs){
                  try{
                    var mem=null;
                    (logs||[]).forEach(function(l){if(l.id===tag.memory_id)mem=l;});
                    if(!mem)return;
                    var row=document.createElement('div');
                    row.className='list-item';
                    row.style.cssText='border-left:3px solid #f43f5e;';
                    var thumb=document.createElement('img');
                    thumb.src=mem.photo_url||'';
                    thumb.style.cssText='width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;';
                    row.appendChild(thumb);
                    var info=document.createElement('div');
                    info.style.flex='1;min-width:0;';
                    info.innerHTML='<strong style="color:#fff;">'+(mem.nickname||'Someone')+' tagged you in a memory</strong>'
                      +'<br><span class="muted small">'+(mem.location||'')+'</span>';
                    row.appendChild(info);
                    var actions=document.createElement('div');
                    actions.style.cssText='display:flex;gap:6px;flex-shrink:0;';
                    var addBtn=document.createElement('button');
                    addBtn.className='primary';addBtn.style.padding='6px 12px';addBtn.style.fontSize='12px';addBtn.textContent='Add to my map';
                    addBtn.onclick=function(){
                      if(window.EtieCloud&&window.EtieCloud.respondToTag){
                        window.EtieCloud.respondToTag(tag.memory_id,'approve',function(res){
                          try{
                            if(res&&res.ok){toast('Added to your map!');renderHookChatList();}
                            else{toast('Could not add: '+(res&&res.error||'unknown'));}
                          }catch(e){}
                        });
                      }
                    };
                    var declineBtn=document.createElement('button');
                    declineBtn.className='secondary';declineBtn.style.padding='6px 12px';declineBtn.style.fontSize='12px';declineBtn.textContent='Not for me';
                    declineBtn.onclick=function(){
                      if(window.EtieCloud&&window.EtieCloud.respondToTag){
                        window.EtieCloud.respondToTag(tag.memory_id,'decline',function(res){
                          try{
                            if(res&&res.ok){toast('Declined.');renderHookChatList();}
                            else{toast('Could not decline: '+(res&&res.error||'unknown'));}
                          }catch(e){}
                        });
                      }
                    };
                    actions.appendChild(addBtn);actions.appendChild(declineBtn);
                    row.appendChild(actions);
                    box.appendChild(row);
                  }catch(e){}
                });
              }
            }catch(e){}
          });
        }catch(e){}
      });
    }
  }catch(e){}
}

function renderHookChatList(){
  try{
    var box=document.getElementById('hookChatList');if(!box)return;
    box.innerHTML='';
    // Requests row (memory tag invites + hangout join requests)
    renderRequestsRow(box);
    var me=hookNick();
    // Show all pins user is a member of (including vanished/archived) so chat stays accessible
    var mine=(ETIE.mapPins||[]).filter(function(p){return p&&(p.members||[]).some(function(m){return m.nick===me;});});
    if(!mine.length){var e=document.createElement('div');e.className='muted small';e.textContent='No hook chats yet — connect on a pin to start one.';box.appendChild(e);return;}
    // Direct chat threads
    try{
      if(window.EtieCloud&&window.EtieCloud.fetchMyThreads){
        window.EtieCloud.fetchMyThreads(function(threads){
          try{
            if(!threads||!threads.length)return;
            var directHeader=document.createElement('div');
            directHeader.className='eyebrow';
            directHeader.style.marginTop='16px';
            directHeader.textContent='Direct chats';
            box.appendChild(directHeader);
            // Fetch display names for thread participants
            var threadOtherIds=threads.filter(function(th){return th.context_type==='direct';}).map(function(th){return th.other_user;}).filter(Boolean);
            var renderThreads=function(nameMap){
              try{
                threads.forEach(function(th){
                  try{
                    if(th.context_type!=='direct')return;
                    var row=document.createElement('div');
                    row.className='list-item';
                    row.style.cursor='pointer';
                    row.style.borderLeft='3px solid #22d3ee';
                    row.innerHTML='<div><strong></strong><br><span class="muted small"></span></div><span class="status" style="background:rgba(34,211,238,.15);color:#22d3ee;">Direct</span>';
                    var otherName=(nameMap&&th.other_user&&nameMap[th.other_user])||'Direct chat';
                    row.querySelector('strong').textContent=otherName;
                    row.querySelector('span.muted').textContent='Tap to open';
                    row.onclick=function(){
                      showDirectChatOverlay(th.id, null);
                    };
                    box.appendChild(row);
                  }catch(e){}
                });
              }catch(e){}
            };
            if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames&&threadOtherIds.length){
              window.EtieCloud.fetchDisplayNames(threadOtherIds, renderThreads);
            }else{
              renderThreads({});
            }
          }catch(e){}
        });
      }
    }catch(e){}

    // People list (accepted connections)
    try{
      if(window.EtieCloud&&window.EtieCloud.fetchConnections){
        window.EtieCloud.fetchConnections(function(conns){
          try{
            if(!conns||!conns.length)return;
            var peopleHeader=document.createElement('div');
            peopleHeader.className='eyebrow';
            peopleHeader.style.marginTop='16px';
            peopleHeader.textContent='People';
            box.appendChild(peopleHeader);
            // Fetch display names for connections
            var connIds=conns.map(function(c){return c.user_id;}).filter(Boolean);
            var renderPeople=function(nameMap){
              try{
                conns.forEach(function(c){
                  try{
                    var row=document.createElement('div');
                    row.className='list-item';
                    row.innerHTML='<div><strong></strong></div><button class="secondary" style="padding:8px 14px;font-size:12px;">Message</button>';
                    var name=(nameMap&&nameMap[c.user_id])||c.user_id.substring(0,8)+'…';
                    row.querySelector('strong').textContent=name;
                    var btn=row.querySelector('button');
                    btn.onclick=function(){
                      // Open direct chat with this connection
                      if(window.EtieCloud&&window.EtieCloud.getOrCreateDirectThread){
                        window.EtieCloud.getOrCreateDirectThread(c.user_id, function(tid){
                          try{
                            if(tid){showDirectChatOverlay(tid, null);}
                            else{toast('Could not open chat.');}
                          }catch(e){}
                        });
                      }else{toast('Direct chat not ready.');}
                    };
                    box.appendChild(row);
                  }catch(e){}
                });
              }catch(e){}
            };
            if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames){
              window.EtieCloud.fetchDisplayNames(connIds, renderPeople);
            }else{
              renderPeople({});
            }
          }catch(e){}
        });
      }
    }catch(e){}

    mine.forEach(function(p){
      try{
        var last=(p.chat||[])[(p.chat||[]).length-1];
        var row=document.createElement('div');row.className='list-item';row.style.cursor='pointer';
        var state=getPinLifecycleState(p);
        var lifecycleLabel=state==='vanished'?' 👻' : (state==='ended'?' 🏁' : (state==='requests_closed'?' 🔒' : ''));
        row.innerHTML='<div><strong></strong><br><span class="muted"></span></div><span class="status"></span>';
        row.querySelector('strong').textContent=mapCatEmoji(p.category)+' '+getRegionFlag(p)+' '+(p.title||p.location||'Hook')+lifecycleLabel;
        row.querySelector('span.muted').textContent=last?((last.nick||'')+': '+(last.text||'').slice(0,60)):'Tap to open chat';
        row.querySelector('span.status').textContent=groupBadgeText(p);
        // Add Hangout label
        var hangoutLabel=document.createElement('span');
        hangoutLabel.style.cssText='font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,.15);color:#fbbf24;margin-left:6px;';
        hangoutLabel.textContent='Hangout';
        row.querySelector('div').appendChild(hangoutLabel);
        (function(pin){
          row.onclick=function(){showScreen('map');openChatDrawer(pin.id);};
          // expired hangouts get their own delete: leave the hangout (members + chat cleared)
          try{
            var st=getPinLifecycleState(pin);
            if(st==='ended'||st==='vanished'){
              var lv=document.createElement('button');lv.className='secondary';lv.style.padding='8px 12px';lv.style.flexShrink='0';lv.textContent='Leave';
              lv.onclick=function(ev){try{if(ev&&ev.stopPropagation)ev.stopPropagation();}catch(e){}leaveHookChat(pin.id);};
              row.appendChild(lv);
            }
          }catch(e){}
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
var _logPeople=[];
var _logSearchResults=[];
var _logStandalone=false;
var _logSpot=null;
function closeLogSheet(){try{_logPinId=null;_logFile=null;_logPeople=[];_logSearchResults=[];_logSpot=null;_logStandalone=false;var o=document.getElementById('logHangoutModal');if(o)o.classList.add('hidden');}catch(e){}}
function logEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function renderLogPeopleChips(){
  try{
    var box=document.getElementById('logPeopleChips');if(!box)return;
    if(!_logPeople.length){box.innerHTML='<span class="muted small">No one added yet.</span>';return;}
    box.innerHTML=_logPeople.map(function(u){
      return '<span class="chip"><span>'+logEsc(u.name||'Someone')+'</span><b role="button" aria-label="Remove '+logEsc(u.name||'')+'" onclick="removeLogPerson(\''+u.user_id+'\')" style="cursor:pointer;margin-left:6px;">✕</b></span>';
    }).join('');
  }catch(e){}
}
function addLogPerson(u){
  try{
    if(!u||!u.user_id)return;
    if(_logPeople.some(function(x){return x.user_id===u.user_id;}))return;
    _logPeople.push({user_id:u.user_id,name:u.name||'Someone',city:u.city||''});
    renderLogPeopleChips();
    var si=document.getElementById('logPeopleSearch');if(si)si.value='';
    searchLogPeople('');
  }catch(e){}
}
function addLogPersonByIndex(i){
  try{var u=_logSearchResults[i];if(u)addLogPerson(u);}catch(e){}
}
function removeLogPerson(uid){
  try{_logPeople=_logPeople.filter(function(x){return x.user_id!==uid;});renderLogPeopleChips();searchLogPeople('');}catch(e){}
}
// Suggested first: people already in your life (previous memories + approved hook members)
// Fallback: all registered users on ETIE (paginated search)
function logPeopleSuggestions(){
  try{
    var out={},me=null;try{me=hookNick();}catch(e){}
    // Accepted connections first
    try{
      if(window.EtieCloud&&window.EtieCloud.fetchConnections){
        window.EtieCloud.fetchConnections(function(conns){
          try{
            (conns||[]).forEach(function(c){
              if(c&&c.user_id&&!out[c.user_id])out[c.user_id]={user_id:c.user_id,name:c.user_id.substring(0,8)+'...',city:''};
            });
            // Fetch display names
            if(window.EtieCloud&&window.EtieCloud.fetchDisplayNames){
              var ids=conns.map(function(c){return c.user_id;}).filter(Boolean);
              window.EtieCloud.fetchDisplayNames(ids, function(nameMap){
                try{
                  ids.forEach(function(id){
                    if(out[id]&&nameMap&&nameMap[id])out[id].name=nameMap[id];
                  });
                  try{searchLogPeople('');}catch(_){}
                }catch(e){}
              });
            }
          }catch(e){}
        });
      }
    }catch(e){}
    try{window.EtieCloud.fetchMyMemories(function(rows){
      (rows||[]).forEach(function(r){
        if(r&&r.tagged_user_id&&!out[r.tagged_user_id])out[r.tagged_user_id]={user_id:r.tagged_user_id,name:r.tagged_nickname||'Someone',city:''};
      });
      try{searchLogPeople('');}catch(_){}
    });}catch(e){}
    (allMapPins()||[]).forEach(function(p){
      try{
        (p&&p.members||[]).forEach(function(m){
          if(m&&m.nick!==me&&m.uid&&!out[m.uid])out[m.uid]={user_id:m.uid,name:m.nick,city:''};
        });
      }catch(e){}
    });
    return Object.keys(out).map(function(k){return out[k];}).slice(0,8);
  }catch(e){return [];}
}
function searchLogPeople(q){
  try{
    var res=document.getElementById('logPeopleResults');if(!res)return;
    q=String(q||'').trim();
    var mine={};_logPeople.forEach(function(u){mine[u.user_id]=1;});
    var draw=function(list){
      _logSearchResults=(list||[]).filter(function(u){return u&&u.user_id&&!mine[u.user_id];}).slice(0,8);
      if(!_logSearchResults.length){res.innerHTML='';return;}
      res.innerHTML=_logSearchResults.map(function(u,i){
        return '<div class="pick-row" role="button" tabindex="0" onclick="addLogPersonByIndex('+i+')"><span>'+logEsc(u.name||'Someone')+'</span>'
          +(u.city?'<span class="muted small">'+logEsc(u.city)+'</span>':'')+'</div>';
      }).join('');
    };
    if(!q){
      var sug=logPeopleSuggestions();
      if(!sug.length){
        res.innerHTML=_logSearchResults.length?res.innerHTML:'<div class="muted small" style="padding:6px 8px;">Type a name to find people on ETIE.</div>';
        return;
      }
      res.innerHTML='<div class="muted small" style="padding:6px 8px 2px;">Suggested</div>';
      draw(sug);
      return;
    }
    if(!window.EtieCloud||!window.EtieCloud.searchPeople){res.innerHTML='';return;}
    res.innerHTML='<div class="muted small" style="padding:6px 8px;">Searching…</div>';
    window.EtieCloud.searchPeople(q,function(list){draw(list||[]);});
  }catch(e){}
}
function useMapSpotForLog(){
  try{
    if(!window.maplibregl||!_map){toast('Map is not ready yet.');return;}
    var c=_map.getCenter();
    _logSpot={lat:c.lat,lng:c.lng};
    var n=document.getElementById('logSpotNote');
    if(n)n.textContent='Pinned to this spot · '+c.lat.toFixed(4)+', '+c.lng.toFixed(4)+' — it will show on your Memory Map.';
    toast('📍 Memory pinned here.');
  }catch(e){}
}
function openLogSheet(pinId,spot){
  try{
    var p=pinId?findPin(pinId):null;
    if(pinId&&!p){toast('Hook not found.');return;}
    var me=hookNick();
    if(p&&!(p.members||[]).some(function(m){return m.nick===me;})){toast('Join this hook first to log photos.');return;}
    _logPinId=p?pinId:null;_logStandalone=!p;_logFile=null;_logTakenAt=0;_logPeople=[];_logSearchResults=[];_logSpot=null;
    // Called from a map tap: keep the tapped point (this reset just cleared it)
    if(spot&&spot.lat!=null)_logSpot={lat:Number(spot.lat),lng:Number(spot.lng)};
    var t=document.getElementById('logHookName');
    if(t)t.textContent=p?((p.title||p.location||'Hook')):'A hangout off ETIE';
    var w=document.getElementById('logWindow');
    if(w){
      if(p){var pw=pinWindow(p);w.textContent=fmtWhen(pw.start)+'–'+fmtWhen(pw.end);try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&tz!=='Asia/Hong_Kong')w.textContent+=' '+tz;}catch(e){}}
      else{w.textContent='No hook, no matching, no approval needed. Photo + who you were with is enough.';}
    }
    var sel=document.getElementById('logActivity');
    if(sel&&p){for(var i=0;i<sel.options.length;i++){if(sel.options[i].text===p.category){sel.selectedIndex=i;break;}}}
    var cap=document.getElementById('logCaption');if(cap)cap.value='';
    var loc=document.getElementById('logLocation');
    if(loc)loc.value=p?(p.location||''):((spot&&spot.label)?spot.label:'');
    var note=document.getElementById('logSpotNote');
    if(note)note.textContent='Pan the map to where it happened, then tap Use map view so it shows on your Memory Map.';
    var si=document.getElementById('logPeopleSearch');if(si)si.value='';
    renderLogPeopleChips();
    var pv=document.getElementById('logPreview');if(pv)pv.innerHTML='';
    var pi=document.getElementById('logPhotoInput');if(pi)pi.value='';
    var btn=document.getElementById('logUploadBtn');if(btn){btn.disabled=false;btn.textContent='Upload Log';}
    updateOutboxNote();
    var o=document.getElementById('logHangoutModal');if(o)o.classList.remove('hidden');
    searchLogPeople('');
  }catch(e){}
}
// Door 2: log a hangout that happened off the app, with no hook involved.
function openStandaloneLog(){
  try{openLogSheet(null);}catch(e){}
}
function handleLogPhoto(input){
  try{
    var f=input.files&&input.files[0];if(!f)return;
    _logFile=f;_logTakenAt=f.lastModified||Date.now();
    var pv=document.getElementById('logPreview');
    if(pv){pv.innerHTML='';var im=document.createElement('img');im.src=URL.createObjectURL(f);im.style.cssText='width:100%;max-height:180px;object-fit:cover;border-radius:12px;';pv.appendChild(im);
      var cap=document.createElement('div');cap.className='muted small';cap.textContent='Taken: '+fmtWhen(_logTakenAt);pv.appendChild(cap);}
    // Show editable photo date
    var dateRow=document.getElementById('logPhotoDateRow');
    if(dateRow){dateRow.style.display='block';}
    var dateInput=document.getElementById('logPhotoDate');
    if(dateInput){
      var dt=new Date(_logTakenAt);
      // Format as YYYY-MM-DDTHH:MM for datetime-local
      var pad=function(n){return n<10?'0'+n:n;};
      dateInput.value=dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate())+'T'+pad(dt.getHours())+':'+pad(dt.getMinutes());
    }
  }catch(e){}
}
function fileToDataURL(file,cb){try{var r=new FileReader();r.onload=function(e){cb(e.target.result);};r.onerror=function(){cb(null);};r.readAsDataURL(file);}catch(e){cb(null);}}

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
    var p=_logStandalone?null:findPin(_logPinId);
    if(!_logStandalone&&!p){toast('Hook not found.');return;}
    if(!_logFile){toast('Choose a photo first.');return;}
    var sel=document.getElementById('logActivity');
    var act=sel?sel.options[sel.selectedIndex].text:'';
    var capEl=document.getElementById('logCaption');
    var locEl=document.getElementById('logLocation');
    var visEl=document.getElementById('logVisibility');
    var caption=capEl?capEl.value.trim().slice(0,120):'';
    var location=locEl?locEl.value.trim().slice(0,120):'';
    var visibility=visEl?visEl.value:'tagged';
    // Read photo date (editable)
    var dateInput=document.getElementById('logPhotoDate');
    if(dateInput&&dateInput.value){
      var parsed=new Date(dateInput.value);
      if(!isNaN(parsed.getTime()))_logTakenAt=parsed.getTime();
    }
    var taken=_logTakenAt||Date.now();
    var ok=false,w=null;
    if(p){w=pinWindow(p);ok=taken>=w.start-5*60*1000&&taken<=w.end+2*3600*1000;}
    var pid=p?(p.cloudId||p.id):null;
    var lat=null,lng=null;
    if(_logSpot){lat=_logSpot.lat;lng=_logSpot.lng;}
    else if(p){lat=p.lat;lng=p.lng;}
    var title=caption||location||act||'Hangout';
    var me=hookNick(), file=_logFile, tagged=(_logPeople||[]).slice(), urlFor=null;
    var btn=document.getElementById('logUploadBtn');
    var restore=function(){if(btn){btn.disabled=false;btn.textContent='Upload Log';}};
    var done=function(){
      try{
        var entries=[];
        if(!tagged.length){
          entries.push({hookId:pid,nick:me,photoUrl:urlFor,activity:act,title:title,location:location,lat:lat,lng:lng,takenAt:new Date(taken).toISOString(),verified:ok,status:'confirmed',confirmedAt:new Date().toISOString(),visibility:visibility});
        }else{
          tagged.forEach(function(u){
            entries.push({hookId:pid,nick:me,photoUrl:urlFor,activity:act,title:title,location:location,lat:lat,lng:lng,takenAt:new Date(taken).toISOString(),verified:ok,taggedUserId:u.user_id,taggedNickname:u.name||'Someone',status:'pending',visibility:visibility});
          });
        }
        var chain=Promise.resolve();
        entries.forEach(function(en){chain=chain.then(function(){return window.EtieCloud.pushHangoutLog(en);});});
        chain.then(function(){
          if(tagged.length){
            toast('Memory logged — asked '+tagged.map(function(u){return u.name;}).join(', ')+' to confirm.');
          }else{
            if(ok&&p)bumpPassion(act);
            toast(ok?('⚡ Verified Live Log · '+fmtWhen(taken)):'Memory logged to your map.');
          }
          closeLogSheet();
          if(p)renderPinLogs(p.id);
          refreshMapMode();
        });
      }catch(e){restore();}
    };
    var finishUpload=function(url){
      urlFor=url||null;
      if(!url){
        if(_logStandalone){restore();toast('Upload failed — please try again while online.');return;}
        fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Upload failed — queued for retry.');closeLogSheet();updateOutboxNote();});return;
      }
      done();
    };
    if(!navigator.onLine){
      if(_logStandalone){toast('You are offline — connect to log a memory.');return;}
      fileToDataURL(file,function(du){queueLog(pid,act,taken,me,du);toast('Offline — queued, will upload on reconnect.');closeLogSheet();updateOutboxNote();});return;
    }
    if(btn){btn.disabled=true;btn.textContent='Uploading…';}
    if(window.EtieCloud&&window.EtieCloud.uploadPhoto){
      window.EtieCloud.uploadPhoto(file,'log').then(function(url){finishUpload(url||null);}).catch(function(){
        if(_logStandalone){restore();toast('Upload failed — please try again.');return;}
        fileToDataURL(file,function(du){restore();queueLog(pid,act,taken,me,du);toast('Upload failed — queued for retry.');closeLogSheet();updateOutboxNote();});
      });
    }else{
      if(_logStandalone){restore();toast('Upload unavailable — please try again while online.');return;}
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
function refreshWeeklyBanner(){
  // map pill for the live sidequest; hidden when none or dismissed (per quest id)
  try{
    var show=function(q){
      try{
        var b=document.getElementById('weeklyQuestBanner');
        if(!b)return;
        var dismissed=null;try{dismissed=ETIE.dismissedWeeklyQuest;}catch(e){}
        if(q&&q.title&&q.id!==dismissed){
          window._weeklyQuest={id:q.id,title:q.title,desc:q.descr||''};
          var t=document.getElementById('weeklyQuestBannerText');if(t)t.textContent=q.title;
          b.classList.remove('hidden');
          try{document.body.classList.add('has-weekly-quest');}catch(e){}
        }else{
          b.classList.add('hidden');
          try{document.body.classList.remove('has-weekly-quest');}catch(e){}
        }
      }catch(e){}
    };
    if(window.EtieCloud&&window.EtieCloud.fetchSidequest){try{window.EtieCloud.fetchSidequest(function(q){show(q);try{if(window._chatPinId&&typeof renderQuestBanner==='function'&&typeof findPin==='function'){var pp=findPin(window._chatPinId);if(pp&&!pp.quest)renderQuestBanner(pp);}}catch(e){}});}catch(e){show(null);}}else show(null);
  }catch(e){}
}
function dismissWeeklyQuest(){
  try{
    var q=null;try{q=window._weeklyQuest;}catch(e){}
    try{ETIE.dismissedWeeklyQuest=q&&q.id?q.id:'none';}catch(e){}
    try{saveState();}catch(e){}
    var b=document.getElementById('weeklyQuestBanner');if(b)b.classList.add('hidden');
    try{document.body.classList.remove('has-weekly-quest');}catch(e){}
  }catch(e){}
}
function openQuestDrawer(){  try{
    var p=null;try{p=findPin(_chatPinId);}catch(e){}
    var paint=function(q){
      try{
        window._weeklyQuest=(q&&q.title)?{title:q.title,desc:q.descr||q.desc||''}:null;
        var has=!!window._weeklyQuest;
        var t=document.getElementById('questWeekTitle');if(t)t.textContent=has?window._weeklyQuest.title:'No sidequest this week yet.';
        var d=document.getElementById('questWeekDesc');if(d)d.textContent=has?window._weeklyQuest.desc:'Check back soon — new quests drop weekly.';
        var c=document.getElementById('questWeekCard');if(c)c.style.display='block';
        var ab=document.querySelector('#questWeekCard .quest-accept');if(ab)ab.style.display=(has&&p)?'':'none';
      }catch(e){}
    };
    if(window.EtieCloud&&window.EtieCloud.fetchSidequest){try{window.EtieCloud.fetchSidequest(paint);}catch(e){paint(null);}}
    else paint(null);
    document.getElementById('customQuestInput').classList.add('hidden');
    document.getElementById('activeQuestDisplay').classList.add('hidden');
    var o=document.getElementById('questDrawer');
    if(o)o.classList.remove('hidden');
  }catch(e){}
}
function closeQuestDrawer(){
  try{var o=document.getElementById('questDrawer');if(o)o.classList.add('hidden');}catch(e){}
}
function saveSidequest(){
  // admin publishes the sidequest of the week (admin UI only; RLS: signed-in writes)
  try{
    var t=((document.getElementById('sqTitle')||{}).value||'').trim().slice(0,80);
    var d=((document.getElementById('sqDesc')||{}).value||'').trim().slice(0,280);
    if(!t){toast('Give the sidequest a title first.');return;}
    if(!(window.EtieCloud&&window.EtieCloud.pushSidequest)){toast('Cloud not ready — sign in first.');return;}
    window.EtieCloud.pushSidequest(t,d).then(function(ok){
      try{
        var s=document.getElementById('sqStatus');
        if(ok){if(s)s.textContent='Live now: '+t;toast('Sidequest live.');
          try{document.getElementById('sqTitle').value='';document.getElementById('sqDesc').value='';}catch(e){}}
        else{if(s)s.textContent='Save failed.';toast('Could not save sidequest.');}
      }catch(e){}
    });
  }catch(e){toast('Could not save sidequest.');}
}
function clearSidequestLive(){
  try{
    if(!(window.EtieCloud&&window.EtieCloud.clearSidequest)){toast('Cloud not ready — sign in first.');return;}
    window.EtieCloud.clearSidequest().then(function(ok){
      try{var s=document.getElementById('sqStatus');if(s)s.textContent=ok?'No live sidequest.':'Clear failed.';}catch(e){}
      if(ok)toast('Sidequest cleared.');
    });
  }catch(e){}
}
// ===== Memory Card Modal =====
function openMemoryCard(log){
  try{
    var m=document.getElementById('memoryCardModal');
    if(!m)return;
    m.classList.remove('hidden');
    // Dual photo display (for now single photo, split view)
    var dual=document.getElementById('memoryCardDualPhoto');
    if(dual && log.photo_url){
      dual.innerHTML='<img src="'+log.photo_url+'" style="width:100%;height:100%;object-fit:cover;">';
    }
    var title=document.getElementById('memoryCardTitle');
    if(title)title.textContent=log.title||log.location||'Hangout Memory';
    var meta=document.getElementById('memoryCardMeta');
    if(meta){
      var taken=log.taken_at ? new Date(log.taken_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
      var loc=log.location||'';
      var owner=log.nickname||log.owner||'';
      meta.textContent=(taken||'')+(loc?' · '+loc:'')+(owner?' · by '+owner:'');
    }
    var cos=document.getElementById('memoryCardCosigners');
    if(cos && log.cosigners && log.cosigners.length){
      cos.textContent='Co-signed by: '+log.cosigners.map(function(c){return c.nick||c;}).join(', ');
    }
    var quest=document.getElementById('memoryCardQuest');
    var qtitle=document.getElementById('memoryCardQuestTitle');
    var qbadge=document.getElementById('memoryCardQuestBadge');
    if(log.questCompleted && log.questTitle){
      if(quest)quest.style.display='block';
      if(qtitle)qtitle.textContent=log.questTitle;
      if(qbadge){qbadge.textContent='⚡ Quest Completed';qbadge.style.display='inline-block';}
    }else{
      if(quest)quest.style.display='none';
      if(qbadge)qbadge.style.display='none';
    }
    var cosigners=document.getElementById('memoryCardCosigners');
    if(cosigners && log.cosigners && log.cosigners.length){
      cosigners.textContent='Co-signed by: '+log.cosigners.map(function(c){return c.nick||c;}).join(', ');
      cosigners.style.display='block';
    }else if(cosigners){
      cosigners.style.display='none';
    }
  }catch(e){}
}
function closeMemoryCard(){
  try{var m=document.getElementById('memoryCardModal');if(m)m.classList.add('hidden');}catch(e){}
}
function acceptCuratedQuest(){
  try{
    var p=findPin(_chatPinId);if(!p)return;
    var qw=null;try{qw=window._weeklyQuest;}catch(e){}
    if(!qw||!qw.title){toast('No live sidequest right now.');return;}
    p.quest={title:qw.title,setBy:'Side Quest',setAt:Date.now(),completed:false};
    storePin(p);
    closeQuestDrawer();
    renderQuestBanner(p);
    // Pin quest banner to chat
    pinQuestToChat(p);
    toast('Quest accepted: '+qw.title);
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
  // retired: the top quest banner card is the single quest surface now.
  // (Previously this injected a second, near-identical banner as a chat message.)
  try{}catch(e){}
}
function renderQuestBanner(p){
  try{
    var banner=document.getElementById('questBanner');
    if(!banner)return;
    var q=p?.quest;
    var actionBtn=banner.querySelector('.quest-action');
    var completeBtn=banner.querySelector('.quest-complete');
    if(!q){
      // no hook quest: surface the live weekly sidequest instead, with Accept
      var wq=null;
      try{wq=window._weeklyQuest;}catch(e){}
      if(!wq||!wq.title){banner.classList.add('hidden');return;}
      banner.classList.remove('hidden');
      banner.classList.add('quest-weekly');
      var titleEl=banner.querySelector('.quest-title');
      var subEl=banner.querySelector('.quest-sub');
      if(titleEl)titleEl.textContent='⚡ '+wq.title;
      if(subEl)subEl.textContent='Sidequest of the week · tap Accept to play it on this hook';
      if(actionBtn){actionBtn.style.display='inline-flex';actionBtn.textContent='Accept';actionBtn.onclick=function(){acceptCuratedQuest();};}
      if(completeBtn)completeBtn.style.display='none';
      return;
    }
    banner.classList.remove('quest-weekly');
    banner.classList.remove('hidden');
    var titleEl=banner.querySelector('.quest-title');
    var subEl=banner.querySelector('.quest-sub');
    var actionBtn=banner.querySelector('.quest-action');
    var completeBtn=banner.querySelector('.quest-complete');
    if(titleEl)titleEl.textContent=q.title;
    if(subEl)subEl.textContent='Set by '+q.setBy+' · '+fmtWhen(q.setAt);
    if(actionBtn){actionBtn.style.display=q.completed?'none':'inline-flex';actionBtn.textContent='✍️ Set Custom Quest';actionBtn.onclick=function(){openSetQuestModal();};}
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
    if(wt){wt.textContent=fmtWhen(w.start)+'–'+fmtWhen(w.end);try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&tz!=='Asia/Hong_Kong')wt.textContent+=' '+tz;}catch(e){}wt.style.display='';}
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
    var msg={id:('loc-'+Date.now()+'-'+Math.floor(Math.random()*1e6)),nick:hookNick(),role:role,text:text,ts:Date.now()};
    try{
      var key=String(p.cloudId||p.id);
      addChatRow(key,{id:msg.id,nick:msg.nick,role:msg.role,text:msg.text,ts:msg.ts});
    }catch(e){}
    inp.value='';renderHookChat();
    try{if(window.EtieCloud&&window.EtieCloud.pushHookMessage)window.EtieCloud.pushHookMessage(p,msg);}catch(e){}
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',function(){
  restoreAll();
  try{ initHKMap(); renderMapFilter(); renderMapPins(); }catch(e){}
  try{ if(typeof refreshWeeklyBanner==='function')refreshWeeklyBanner(); }catch(e){}
  // belt-and-braces: re-render once late so slow tiles/session can't leave an empty map
  try{setTimeout(function(){try{initHKMap();renderMapPins();}catch(e){}},2500);}catch(e){}
  try{ renderDerivedBadge(); locateUser(); }catch(e){}
  try{ refreshGate(); }catch(e){}
  try{ processPhotoOutbox(); }catch(e){}
  // Check for wrap-up card (ended hangouts needing questions)
  try{setTimeout(function(){checkWrapupCard();},3000);}catch(e){}
  try{ window.addEventListener('online',function(){try{processPhotoOutbox();}catch(e){}}); }catch(e){}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{closeQuestDrawer();}catch(e2){}try{closeProfileDrawer();}catch(e2b){}try{closeAdmin();}catch(e3){}try{closeAvatarMenu();}catch(e4){}try{closeChatDrawer();}catch(e5){}try{closePinDetail();}catch(e6){}try{closeGroupModal();}catch(e7){}try{closeDropHook();}catch(e8){}try{closeLogSheet();}catch(e9){}try{closeMemoryCard();}catch(e10){}}});
  document.addEventListener('click',function(e){try{var d=document.getElementById('avatarDropdown');var btn=document.getElementById('headerProfile');if(d&&!d.classList.contains('hidden')&&e.target!==btn&&!d.contains(e.target)&&e.target!==btn)closeAvatarMenu();}catch(err){}});
  // re-sync header whenever the tab regains focus (session may have landed elsewhere)
  try{
    document.addEventListener('visibilitychange',function(){if(!document.hidden){try{updateAuthHeader();renderHeaderProfile();}catch(e){}try{if(window.EtieCloud&&window.EtieCloud.pullPins)window.EtieCloud.pullPins();}catch(e){}try{if(typeof refreshWeeklyBanner==='function')refreshWeeklyBanner();}catch(e){}}});
    window.addEventListener('focus',function(){try{updateAuthHeader();renderHeaderProfile();}catch(e){}try{if(window.EtieCloud&&window.EtieCloud.pullPins)window.EtieCloud.pullPins();}catch(e){}try{if(typeof refreshWeeklyBanner==='function')refreshWeeklyBanner();}catch(e){}});
  }catch(e){}
  // Subscribe to reviews/reports when cloud is on
  setTimeout(function(){
    if(window.EtieCloud && window.EtieCloud.subscribeReviews) window.EtieCloud.subscribeReviews();
    if(window.EtieCloud && window.EtieCloud.subscribeReports) window.EtieCloud.subscribeReports();
  }, 2000);
  // Periodic lifecycle sweep (every 60s) to auto-archive vanished pins
  setInterval(function(){try{if(sweepExpiredPins())renderMapPins();}catch(e){}}, 60000);
});
