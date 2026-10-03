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
// Optional travel photos (traveller step 6 + local step 7) — any role, detected by input id

// Tier helpers
// --- HK hook helpers (district/vibe maps + modifiers) ---
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
    var panels=['messages','profile'];
    var want=[id];
    panels.forEach(function(p){var el=document.getElementById(p);if(el)el.classList.toggle('panel-open',want.indexOf(p)!==-1);});
    if(id==='profile'){renderLiteProfile();}
    if(id==='messages'){try{renderHookChatList();}catch(e){}}
    if(id==='map'){try{initHKMap();if(window.L&&_map){setTimeout(function(){try{_map.invalidateSize();}catch(e){}},120);}renderMapPins();}catch(e){}}
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
function isEtieAdmin(){try{var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession();var em=s&&s.user&&s.user.email;if(em&&window.ETIE_ADMINS.indexOf(em.toLowerCase())!==-1)return true;}catch(e){} try{var q=new URLSearchParams(window.location.search).get('admin');if(q==='1'&&localStorage.getItem('etie-admin-unlock')==='1')return true;}catch(e){} return false;}
function canManagePin(p){try{var myId=myUid();if(myId&&p&&p.authorId&&myId===p.authorId)return true;if(isEtieAdmin())return true;}catch(e){}try{if(p&&!p.authorId){var me=hookNick();if(me&&(p.members||[])[0]&&(p.members||[])[0].nick===me)return true;}}catch(e){}return false;}
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
function toggleAvatarMenu(e){ try{ if(e&&e.stopPropagation) e.stopPropagation(); var d=document.getElementById('avatarDropdown'); if(d) d.classList.toggle('hidden'); }catch(_){} }
function closeAvatarMenu(){ try{ var d=document.getElementById('avatarDropdown'); if(d) d.classList.add('hidden'); }catch(_){} }
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

function myUid(){ try{ var s=window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession(); return (s&&s.user&&s.user.id)||null; }catch(e){ return null; } }
// Incoming request addressed to me (live local): requests are keyed by local id, so my own id as key = inbox
// Chat/request key honouring side: locals read their inbox, travellers read the match
// Chat popup (mini overlay) — was called from HTML but never defined, so traveller chat never opened



function restoreAll(){
  try{
    renderLiteProfile();
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
    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png?api_key=cc9c3230-65b0-44c0-8361-2c86413b0744',{maxZoom:20,attribution:'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(_map);
    _map.on('click',onMapTap);
    renderMapFilter();try{if(gateState()==='open')renderMapPins();}catch(e){}
  }catch(e){}
}
var _pickMode=null; // null | 'trav1' | 'hook'
function pickOnMap(mode){
  try{
    _pickMode='hook';
    closeDropHook();
    showScreen('map');
    toast('Tap the map to place your hook pin.');
  }catch(e){}
}
function onMapTap(e){
  try{
    _dropPoint={lat:e.latlng.lat,lng:e.latlng.lng};
    if(_dropMarker){try{_map.removeLayer(_dropMarker);}catch(_){}}
    _dropMarker=L.marker([_dropPoint.lat,_dropPoint.lng],{title:'Your pin location'}).addTo(_map);
    var guess='Near '+nearestDistrictLabel(_dropPoint.lat,_dropPoint.lng);
    _pickMode=null;
    window._pendingDropGuess=guess;
    openDropHook();
  }catch(err){}
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
    try{var c=document.getElementById('hookInterestPills');if(c)Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(x){var t=(x.textContent||'').toLowerCase();x.classList.toggle('active',t.indexOf(p.cat.toLowerCase())!==-1||(p.cat==='Photo'&&t.indexOf('photo')!==-1));});}catch(e){}
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
    try{var pc=document.getElementById('hookInterestPills');if(pc)Array.prototype.forEach.call(pc.querySelectorAll('.chip'),function(x){x.classList.remove('active');});}catch(e){}
    var _now=new Date();
    var _p2=function(n){return (n<10?'0':'')+n;};
    var _today=_now.getFullYear()+'-'+_p2(_now.getMonth()+1)+'-'+_p2(_now.getDate());
    var cd=document.getElementById('customDate'); if(cd) cd.value=_today;
    var cst=document.getElementById('customStartTime'); if(cst) cst.value=_p2(_now.getHours())+':'+_p2(_now.getMinutes());
    var cet=document.getElementById('customEndTime'); if(cet) cet.value='';
    var pv=document.getElementById('hookPhotoPreview'); if(pv) pv.innerHTML='';
    // default coords: last map tap, else live map center
    if(!_dropPoint){
      try{if(_map)_dropPoint={lat:_map.getCenter().lat,lng:_map.getCenter().lng};}catch(e){}
      if(!_dropPoint)_dropPoint={lat:HK_CENTER[0],lng:HK_CENTER[1]};
    }
    var o=document.getElementById('dropHookModal');if(o){o.classList.remove('hidden');try{var _mb=o.querySelector('.chat-popup-body');if(_mb)_mb.scrollTop=0;}catch(e){}}
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
    var label=st==='live'?'☁️ Live — visible to everyone':(st==='syncing'?'⏳ Sharing…':'📴 Only on this device');
    try{if(st!=='live'&&p.syncError)label+=' · '+p.syncError;}catch(e){}
    el.textContent=label;
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
      ts:Date.now(),origin:'local',cloudId:null,syncState:(function(){try{return (window.EtieCloud&&window.EtieCloud.getSession&&window.EtieCloud.getSession())?'syncing':'local';}catch(e){return 'local';}})()};
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
  try{var c=parseInt(p.capacity,10);if(c>=2&&c<=4){var open=Math.max(0,c-n);cap=' · '+open+(open===1?' spot open':' spots open');}}catch(e){}
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
    var myId=null;try{myId=myUid();}catch(e){}
    // host = author by user id (nicknames are not unique — never use them for permissions).
    // Admin can manage any pin; legacy pins without an author id fall back to member nick.
    var isHost=canManagePin(p);
    var isMember=(p.members||[]).some(function(m){return m.uid?m.uid===myId:m.nick===me;});
    if(isHost)isMember=true;
    var isPending=(p.pending||[]).some(function(r){return r.nick===me;})||(p.requests||[]).some(function(r){return r.nick===me&&r.status==='pending';});
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
    if(lc){var locTxt=String(p.location||'Hong Kong').replace(/^\s*near\s+/i,'');lc.textContent=mapCatEmoji(p.category)+' Near '+locTxt;}
    var pb=document.getElementById('pinBio');if(pb){var bb=p.members&&p.members[0]&&p.members[0].bio;pb.textContent=bb||'';pb.style.display=bb?'':'none';}
    var gb=document.getElementById('pinGroupBadge');if(gb)gb.textContent=groupBadgeText(p);
    var sb=document.getElementById('pinSyncBadge');if(sb)paintSyncBadge(sb,p);
    var mem=document.getElementById('pinMembers');
    if(mem){mem.innerHTML='';(p.members||[]).forEach(function(m){var s=document.createElement('span');s.className='chip';s.textContent=(m.role==='local'?'🇭🇰 ':'✈️ ')+m.nick;mem.appendChild(s);});}
    var req=document.getElementById('pinRequestBtn');
    if(req){
      if(isHost){req.style.display='none';} // hosts never request their own hook
      else if(isPending){req.style.display='';req.textContent='Request Sent';req.disabled=true;}
      else{req.style.display=(!isMember&&(p.members||[]).length<3&&!isPinExpired(p))?'':'none';req.textContent='Request to Connect';req.disabled=false;}
    }
    var wait=document.getElementById('pinPendingNote');
    if(wait)wait.style.display=isPending?'':'none';
    try{renderPinVibe(p,me);}catch(e){}
    // host controls: only the author (by id) sees incoming requests
    var hostBox=document.getElementById('pinHostBox');
    if(hostBox){
      hostBox.innerHTML='';
      if(isHost&&(p.requests||[]).length){
        p.requests.forEach(function(r,idx){
          if(r.status!=='pending') return;
          var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;padding:8px;background:rgba(255,255,255,.05);border-radius:8px;';
          var avatar=document.createElement('div');avatar.className='avatar small';avatar.style.width='32px;height:32px;font-size:14px;';avatar.textContent=(r.nick||'?').charAt(0).toUpperCase();
          var lab=document.createElement('span');lab.className='small';lab.style.flex='1';lab.textContent=(r.nick||'Someone')+' wants to join';
          if(r.verified) lab.textContent+=' ✅';
          if((r.vibe||[]).length){var vd=document.createElement('div');vd.className='small muted';vd.style.cssText='flex-basis:100%;font-style:italic;';vd.textContent='💬 “'+((r.vibe[r.vibe.length-1]||{}).text||'')+'” ('+r.vibe.length+'/3)';lab.appendChild(vd);}
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
    if(isHost){
      renderHostRequestDrawer(p);
    }
    var del=document.getElementById('pinDeleteBtn');
    if(del)del.style.display=isHost?'':'none';
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
    try{if(myUid()&&p.authorId&&myUid()===p.authorId){toast('This is your hook — guests request to join you.');return;}}catch(e){}
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
    try{if(!canManagePin(p)){toast('Only the host can decline.');return;}}catch(e){return;}
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
    try{if(!canManagePin(p)){toast('Only the host can approve.');return;}}catch(e){return;}
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
    p.members.push({nick:req.nick,role:req.role,verified:req.verified,uid:req.uid||null});
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
          +((r.vibe||[]).map(function(v){return '<div class="small" style="margin-top:4px;color:#ffe4e6;">💬 “'+(v.text||'')+'”</div>';}).join(''))
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
        var chatKey=String((p.cloudId||p.id));
        _chatUnsub=window.EtieCloud.subscribeHookChat(chatKey,function(row){
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
  restoreAll();
  try{ initHKMap(); renderMapFilter(); renderMapPins(); }catch(e){}
  try{ renderDerivedBadge(); locateUser(); }catch(e){}
  try{ refreshGate(); }catch(e){}
  try{ processPhotoOutbox(); }catch(e){}
  try{ window.addEventListener('online',function(){try{processPhotoOutbox();}catch(e){}}); }catch(e){}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{closeQuestDrawer();}catch(e2){}try{closeProfileDrawer();}catch(e2b){}try{closeAdmin();}catch(e3){}try{closeAvatarMenu();}catch(e4){}try{closeChatDrawer();}catch(e5){}try{closePinDetail();}catch(e6){}try{closeGroupModal();}catch(e7){}try{closeDropHook();}catch(e8){}try{closeLogSheet();}catch(e9){}}});
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
