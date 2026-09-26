// Etie Phase 2 — Full Supabase sync (cloud-first, local fallback)
// Tables: etie_profiles, etie_requests, etie_messages, etie_meetups, etie_reviews, etie_reports
// Storage: etie-photos bucket
// Realtime: all shared tables
// Auto-tier promotion on review/meetup completion
(function(){
  var client=null, session=null, pushTimer=null, profileTimer=null, sharedSyncTimer=null, realtimeChannel=null;
  var reviewChannel=null, reportChannel=null, profileLiveChannel=null;

  function keys(){return {url:(window.ETIE_SUPABASE_URL||'').trim(), key:(window.ETIE_SUPABASE_ANON_KEY||'').trim()};}
  function table(){return window.ETIE_CLOUD_TABLE||'etie_states';}
  function profTable(){return window.ETIE_CLOUD_PROFILES_TABLE||'etie_profiles';}
  function reqTable(){return window.ETIE_CLOUD_REQUESTS_TABLE||'etie_requests';}
  function msgTable(){return window.ETIE_CLOUD_MESSAGES_TABLE||'etie_messages';}
  function meetTable(){return window.ETIE_CLOUD_MEETUPS_TABLE||'etie_meetups';}
  function revTable(){return window.ETIE_CLOUD_REVIEWS_TABLE||'etie_reviews';}
  function repTable(){return window.ETIE_CLOUD_REPORTS_TABLE||'etie_reports';}
  function badge(){return document.getElementById('cloudStatus');}
  function paint(status, text){
    var b=badge();if(!b)return;
    b.textContent=text||('Cloud: '+status);
    b.dataset.cloud=status;
  }
  function status(){
    var k=keys();
    if(!k.url||!k.key)return 'off';
    if(!window.supabase||!window.supabase.createClient)return 'offline-no-cdn';
    if(!client)return 'offline';
    return session?'on':'offline-no-login';
  }
  function isSharedOn(){
    if(window.ETIE_DEMO)return false;
    if(!client||!session)return false;
    return true;
  }

  function init(){
    try{
      var k=keys();
      if(!k.url||!k.key){paint('off','Cloud: offline demo');return;}
      if(!window.supabase||!window.supabase.createClient){paint('offline','Cloud: offline (CDN blocked)');return;}
      client=window.supabase.createClient(k.url,k.key,{auth:{detectSessionInUrl:false}});
      try{handleAuthCallback();}catch(e){}
      try{pullPins();subscribePins();}catch(e){}
      client.auth.getSession().then(function(r){
        session=r&&r.data&&r.data.session?r.data.session:null;
        if(session){paint('on','Cloud: on');pull();pullShared();subscribeShared();subscribeLiveProfiles();syncProfile();try{pullPins();}catch(e){}}
        else paint('offline','Cloud: offline — sign in');
        try{ if(typeof updateAdminVisibility==='function')updateAdminVisibility(); }catch(e){}
        try{ if(typeof updateAuthHeader==='function')updateAuthHeader(); if(typeof renderHeaderProfile==='function')renderHeaderProfile(); }catch(e){}
        // safety net: session can land a beat after first paint — re-sync header once settled
        setTimeout(function(){try{ if(typeof updateAuthHeader==='function')updateAuthHeader(); if(typeof renderHeaderProfile==='function')renderHeaderProfile(); }catch(e){}},800);
      }).catch(function(){paint('offline','Cloud: offline');});
      client.auth.onAuthStateChange(function(ev,s){
        session=s;
        try{ if(realtimeChannel){ client.removeChannel(realtimeChannel); realtimeChannel=null; } }catch(e){}
        try{ if(reviewChannel){ client.removeChannel(reviewChannel); reviewChannel=null; } }catch(e){}
        try{ if(reportChannel){ client.removeChannel(reportChannel); reportChannel=null; } }catch(e){}
        try{ if(profileLiveChannel){ client.removeChannel(profileLiveChannel); profileLiveChannel=null; } }catch(e){}
        if(s){paint('on','Cloud: on');pull();pullShared();subscribeShared();subscribeLiveProfiles();syncProfile();try{pullPins();subscribePins();}catch(e){}}
        else paint('offline','Cloud: offline — sign in');
        try{ if(typeof updateAdminVisibility==='function')updateAdminVisibility(); }catch(e){}
        try{ if(typeof updateAuthHeader==='function')updateAuthHeader(); if(typeof renderHeaderProfile==='function')renderHeaderProfile(); }catch(e){}
        setTimeout(function(){try{ if(typeof updateAuthHeader==='function')updateAuthHeader(); if(typeof renderHeaderProfile==='function')renderHeaderProfile(); }catch(e){}},800);
      });
    }catch(e){paint('offline','Cloud: offline');}
  }
  function handleAuthCallback(){
    // Magic-link landing (?code=… or ?error=…): exchange explicitly so failures are visible, not silent.
    var q;
    try{q=new URLSearchParams(window.location.search);}catch(e){return;}
    var err=q.get('error'), errDesc=q.get('error_description'), code=q.get('code');
    function cleanUrl(){
      try{
        ['code','error','error_code','error_description'].forEach(function(k){q.delete(k);});
        var rest=q.toString();
        var clean=window.location.pathname+(rest?('?'+rest):'')+window.location.hash;
        window.history.replaceState(null,'',clean);
      }catch(e){}
    }
    if(err){
      cleanUrl();
      toast('Link failed: '+((errDesc||err).replace(/\+/g,' '))+'. Request a fresh link below.');
      return;
    }
    if(!code)return;
    toast('Finishing sign-in…');
    client.auth.exchangeCodeForSession(code).then(function(r){
      cleanUrl();
      if(r&&r.error){toast('Link rejected: '+r.error.message+'. Open the newest link in the same browser.');return;}
      toast('Signed in — welcome back.');
    }).catch(function(e2){
      cleanUrl();
      toast('Link rejected: '+((e2&&e2.message)||'browser mismatch — open the link where you requested it'));
    });
  }
  function signIn(){
    try{
      var em=document.getElementById('authEmail');
      var email=(em&&em.value||'').trim();
      if(!email||email.indexOf('@')===-1){toast('Enter a valid email for magic link.');return;}
      if(!client){toast('Add Supabase keys first (supabase-config.js).');return;}
      var redirect=window.location.origin + window.location.pathname;
      var btn=document.getElementById('signInBtn');
      if(btn){btn.disabled=true;btn.textContent='Sending…';}
      client.auth.signInWithOtp({email:email, options:{emailRedirectTo: redirect}}).then(function(r){
        if(btn){btn.disabled=false;btn.textContent='Sign in';}
        if(r&&r.error){toast('Sign-in error: '+r.error.message);return;}
        toast('Check your email for the sign-in link.');
      }).catch(function(err){
        if(btn){btn.disabled=false;btn.textContent='Sign in';}
        toast('Sign-in failed: '+((err&&err.message)||'network error — try again'));
      });
    }catch(e){toast('Sign-in unavailable offline.');}
  }
  function signOut(){
    try{ if(!confirm('Are you sure you want to sign out?')) return; }catch(e){ return; }
    try{if(client)try{ client.removeChannel(realtimeChannel); client.removeChannel(reviewChannel); client.removeChannel(reportChannel); client.removeChannel(profileLiveChannel); if(pinChannel)client.removeChannel(pinChannel); }catch(e){};realtimeChannel=reviewChannel=reportChannel=profileLiveChannel=pinChannel=null; if(client)client.auth.signOut();}catch(e){}
    session=null;window.ETIE_LIVE_LOCALS=[];paint('offline','Cloud: offline — sign in');
    // privacy: clear local profile/trips/chats so next user on a public device sees blank (cloud copy stays for next sign-in)
    try{ localStorage.removeItem('etie-v1'); localStorage.removeItem('etie-v1-user-backup'); localStorage.removeItem('etie-v1-backup'); }catch(e){}
    try{ if(typeof etieDefaults==='function') ETIE=etieDefaults(); }catch(e){}
    try{ if(typeof restoreAll==='function') restoreAll(); }catch(e){}
    try{ if(typeof updateAuthHeader==='function')updateAuthHeader(); if(typeof renderHeaderProfile==='function')renderHeaderProfile(); if(typeof updateProfileVisibility==='function')updateProfileVisibility(); }catch(e){}
  }
  // ---- Phase 2: single-user backup (etie_states) ----
  function push(){
    try{
      if(window.ETIE_DEMO)return;
      if(!client||!session)return;
      clearTimeout(pushTimer);
      pushTimer=setTimeout(function(){
        try{
          var payload={user_id:session.user.id, data:(typeof ETIE!=='undefined'?ETIE:{}), updated_at:new Date().toISOString()};
          client.from(table()).upsert(payload).then(function(r){
            if(r&&r.error)console.warn('Etie cloud push failed',r.error.message);
          });
        }catch(e){console.warn('Etie cloud push skipped',e);}
      },800);
      scheduleProfileSync();
      scheduleSharedPush();
    }catch(e){}
  }
  function pull(){
    try{
      if(window.ETIE_DEMO)return;
      if(!client||!session)return;
      client.from(table()).select('data,updated_at').eq('user_id',session.user.id).maybeSingle().then(function(r){
        if(r&&(r.error||!r.data))return;
        var cloud=r.data&&r.data.data;
        if(!cloud||typeof cloud!=='object')return;
        var hasLocal=false;
        try{
          var cur=(typeof ETIE!=='undefined'?ETIE:{});
          hasLocal=cur&&(Object.keys(cur.requests||{}).length||Object.keys(cur.messages||{}).length||Object.keys(cur.meetups||{}).length);
        }catch(e){}
        if(hasLocal){
          console.info('Etie cloud row exists; keeping local demo data. Reset demo to adopt cloud.');
          return;
        }
        try { localStorage.setItem('etie-v1-backup', localStorage.getItem('etie-v1')||''); }catch(e){}
        try{
          ETIE=Object.assign(ETIE||{},cloud);
          saveState();
          if(typeof restoreAll==='function')restoreAll();
          toast('Cloud data loaded.');
        }catch(e){console.warn('Etie cloud pull skipped',e);}
      });
    }catch(e){}
  }
  // ---- Profile sync ----
  function scheduleProfileSync(){
    if(!isSharedOn())return;
    clearTimeout(profileTimer);
    profileTimer=setTimeout(syncProfile, 900);
  }
  function syncProfile(){
    try{
      if(!isSharedOn())return;
      if(typeof ETIE==='undefined'||!ETIE.local)return;
      var p=ETIE.local;
      var travNick=(typeof ETIE!=='undefined'&&ETIE.traveller&&ETIE.traveller.nickname)||'';
      var localNick=p.displayName||'';
      var chosen=localNick || travNick || (ETIE.traveller && ETIE.traveller.name) || session.user.email.split('@')[0];
      var base={
        user_id: session.user.id,
        display_name: chosen,
        city: p.city || ETIE.trip && ETIE.trip.destination || 'Hong Kong',
        age: parseInt(p.age,10)||28,
        interests: p.interests||[],
        personality: p.personality||{},
        offer: p.offer||'',
        offer_tags: p.offerTags||[],
        availability: p.availability||[],
        verification: {identity:true, local:true, methods:p.verificationMethods||[]},
        stats: {travellersMet:18, rating:4.9},
        updated_at: new Date().toISOString()
      };
      var extra={
        nationality: p.nationality || 'PT',
        traveller_nationality: (typeof ETIE!=='undefined'&&ETIE.traveller&&ETIE.traveller.nationality)||'HK',
        district: p.district || 'Central / Soho',
        tier: p.tier || 'Rookie',
        hosted_count: p.hostedCount || 0,
        avg_host_rating: p.avgHostRating || 0,
        references: p.references || [],
        activities: p.activities || [],
        avail_dates: (p.availDates||[]),
        travel_photos: (p.travelPhotos||[]),
        social_vibe: (p.socialVibe!=null?p.socialVibe:1),
        travel_pace: (p.travelPace!=null?p.travelPace:1),
        style_interests: (p.styleInterests||[])
      };
      function tryUpsert(payload){
        return client.from(profTable()).upsert(payload).then(function(r){
          if(r&&r.error){
            var msg=(r.error.message||'').toLowerCase();
            // if column missing (migrate not run), retry with base only
            // PostgREST says either "column X does not exist" or "Could not find the 'X' column ... in the schema cache"
            if(msg.indexOf('column')!==-1 && (msg.indexOf('does not exist')!==-1||msg.indexOf('could not find')!==-1||msg.indexOf('schema cache')!==-1)){
              console.warn('Etie profile sync: extra columns missing, retrying base only', r.error.message);
              return client.from(profTable()).upsert(base).then(function(r2){
                if(r2&&r2.error) console.warn('Etie profile sync (base) failed', r2.error.message);
                else console.info('Etie profile sync OK (base fallback)');
              });
            }
            console.warn('Etie profile sync failed',r.error.message);
          } else console.info('Etie profile sync OK');
        });
      }
      tryUpsert(Object.assign({}, base, extra));
    }catch(e){console.warn('Etie profile sync skipped',e);}
  }
  // ---- Shared requests/messages/meetups ----
  function scheduleSharedPush(){
    if(!isSharedOn())return;
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer=setTimeout(pushSharedRequests, 700);
  }
  function pushSharedRequest(localMockId){
    try{
      if(!isSharedOn())return Promise.resolve(null);
      if(!localMockId) localMockId=(typeof reqKey==='function'?reqKey():'local-marta');
      var k=localMockId;
      var localReq=(typeof ETIE!=='undefined' && ETIE.requests && ETIE.requests[k])?ETIE.requests[k]:null;
      if(!localReq)return Promise.resolve(null);
      return client.from(reqTable()).select('id,traveller_id,status').eq('local_mock_id', k).order('updated_at',{ascending:false}).limit(1).maybeSingle().then(function(found){
        var existing=found&&found.data;
        if(found&&found.error&&found.error.code!=='PGRST116') console.warn('pushSharedRequest lookup failed',found.error.message);
        if(existing&&existing.traveller_id!==session.user.id){
          return client.from(reqTable()).update({
            status: localReq.status,
            message: localReq.message||'',
            local_name: localReq.localName||k,
            destination: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.destination)||'Lisbon',
            dates: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.dates)||'',
            updated_at: new Date().toISOString()
          }).eq('id', existing.id).select('id').maybeSingle().then(function(r){
            if(r&&r.error)console.warn('pushSharedRequest (local update) failed',r.error.message);
            if(r&&r.data&&r.data.id) syncPendingMessages(k, r.data.id);
            return r&&r.data;
          });
        }
        var payload={
          traveller_id: session.user.id,
          local_mock_id: k,
          local_id: null,
          status: localReq.status,
          message: localReq.message||'',
          destination: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.destination)||'Lisbon',
          dates: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.dates)||'',
          traveller_name: (typeof ETIE!=='undefined' && ETIE.traveller && (ETIE.traveller.nickname||ETIE.traveller.name))||'Traveller',
          local_name: localReq.localName||k,
          updated_at: new Date().toISOString()
        };
        return client.from(reqTable()).upsert(payload, {onConflict:'traveller_id,local_mock_id'}).select('id').maybeSingle().then(function(r){
          if(r&&r.error)console.warn('pushSharedRequest failed',r.error.message);
          if(r&&r.data&&r.data.id) syncPendingMessages(k, r.data.id);
          return r&&r.data;
        });
      });
    }catch(e){console.warn('pushSharedRequest skipped',e); return Promise.resolve(null);}
  }
  function pushSharedRequests(){
    try{
      if(!isSharedOn()||typeof ETIE==='undefined'||!ETIE.requests)return;
      Object.keys(ETIE.requests).forEach(function(k){ pushSharedRequest(k); });
    }catch(e){}
  }
  function syncPendingMessages(localMockId, requestId){
    try{
      if(!isSharedOn())return;
      var arr=(ETIE.messages&&ETIE.messages[localMockId])||[];
      if(!arr.length)return;
      client.from(msgTable()).select('id,text,sender_role,created_at').eq('request_id', requestId).then(function(r){
        var existing=(r&&r.data)||[];
        var seen={};
        existing.forEach(function(m){ seen[m.sender_role+':'+m.text]=1; });
        var toInsert=[];
        arr.forEach(function(m){
          var role=m.from==='local'?'local':'traveller';
          var key=role+':'+m.text;
          if(seen[key])return;
          seen[key]=1;
          toInsert.push({request_id:requestId, sender_id: session.user.id, sender_role: role, text: m.text});
        });
        if(!toInsert.length)return;
        client.from(msgTable()).insert(toInsert).then(function(ir){
          if(ir&&ir.error)console.warn('syncPendingMessages insert failed',ir.error.message);
        });
      });
    }catch(e){console.warn('syncPendingMessages skipped',e);}
  }
  function pushSharedMessage(localMockId, text, senderRole){
    try{
      if(!isSharedOn())return;
      var k=localMockId|| (typeof reqKey==='function'?reqKey():'local-marta');
      client.from(reqTable()).select('id').eq('traveller_id', session.user.id).eq('local_mock_id', k).maybeSingle().then(function(r){
        var rid=r&&r.data&&r.data.id;
        if(!rid){
          client.from(reqTable()).select('id').eq('local_mock_id', k).order('updated_at',{ascending:false}).limit(1).maybeSingle().then(function(r2){
            var rid2=r2&&r2.data&&r2.data.id;
            if(rid2) doInsert(rid2); else console.warn('pushSharedMessage: no request_id for',k);
          });
        } else doInsert(rid);
        function doInsert(requestId){
          client.from(msgTable()).insert({request_id: requestId, sender_id: session.user.id, sender_role: senderRole, text: text}).then(function(ir){
            if(ir&&ir.error)console.warn('pushSharedMessage failed',ir.error.message);
          });
        }
      });
    }catch(e){console.warn('pushSharedMessage skipped',e);}
  }
  function pushSharedMeetup(localMockId){
    try{
      if(!isSharedOn()||typeof ETIE==='undefined'||!ETIE.meetups)return;
      var k=localMockId|| (typeof meetKey==='function'?meetKey():(typeof reqKey==='function'?reqKey():'local-marta'));
      var mu=ETIE.meetups[k];
      if(!mu||mu.status==='none')return;
      client.from(reqTable()).select('id').eq('local_mock_id', k).order('updated_at',{ascending:false}).limit(1).maybeSingle().then(function(r){
        var rid=r&&r.data&&r.data.id;
        if(!rid)return;
        var payload={request_id:rid, activity:mu.activity, when_text:mu.when, where_text:mu.where, status:mu.status, with_name:mu.with||''};
        client.from(meetTable()).upsert(payload,{onConflict:'request_id'}).then(function(ir){
          if(ir&&ir.error)console.warn('pushSharedMeetup failed',ir.error.message);
        });
      });
    }catch(e){console.warn('pushSharedMeetup skipped',e);}
  }
  function pullShared(){
    try{
      if(!isSharedOn())return;
      client.from(reqTable()).select('*').order('updated_at',{ascending:false}).limit(50).then(function(r){
        if(r&&r.error){ console.warn('pullShared requests failed',r.error.message); return; }
        var rows=r&&r.data||[];
        if(!rows.length)return;
        var changed=false;
        rows.forEach(function(row){
          var k=row.local_mock_id;
          var existing=(ETIE.requests&&ETIE.requests[k])||null;
          var cloudTs=new Date(row.updated_at).getTime();
          var localTs=existing&&existing.updatedAt?existing.updatedAt:0;
          if(!existing || cloudTs > localTs + 1500){
            if(!ETIE.requests)ETIE.requests={};
            ETIE.requests[k]={status: row.status, message: row.message||'', updatedAt: cloudTs, localName: row.local_name||k, travellerName: row.traveller_name||'Traveller', destination: row.destination||'', dates: row.dates||''};
            changed=true;
          }
        });
        if(changed){
          try{ saveState(); }catch(e){}
          try{ if(typeof renderRequests==='function')renderRequests(); if(typeof renderLocalDashboard==='function')renderLocalDashboard(); if(typeof renderMessagesList==='function')renderMessagesList(); if(typeof renderMeetup==='function')renderMeetup(); if(typeof renderTrips==='function')renderTrips(); }catch(e){}
        }
        var ids=rows.map(function(x){return x.id;});
        if(ids.length) pullSharedMessages(ids);
        if(ids.length) pullSharedMeetups(ids);
      });
    }catch(e){console.warn('pullShared skipped',e);}
  }
  function pullSharedMessages(requestIds){
    try{
      if(!isSharedOn()||!requestIds.length)return;
      client.from(msgTable()).select('*').in('request_id', requestIds).order('created_at',{ascending:true}).limit(200).then(function(r){
        if(r&&r.error){ console.warn('pullSharedMessages failed',r.error.message); return; }
        var rows=r&&r.data||[];
        if(!rows.length)return;
        client.from(reqTable()).select('id,local_mock_id').in('id', requestIds).then(function(rr){
          var idToKey={};
          (rr&&rr.data||[]).forEach(function(x){ idToKey[x.id]=x.local_mock_id; });
          var changed=false;
          rows.forEach(function(m){
            var k=idToKey[m.request_id];
            if(!k)return;
            if(!ETIE.messages)ETIE.messages={};
            if(!ETIE.messages[k])ETIE.messages[k]=[];
            var role=m.sender_role;
            var text=m.text;
            var exists=ETIE.messages[k].some(function(x){ return x.text===text && x.from===role; });
            if(exists)return;
            ETIE.messages[k].push({from: role, text: text, ts: new Date(m.created_at).getTime()});
            changed=true;
          });
          if(changed){
            Object.keys(ETIE.messages).forEach(function(k){ ETIE.messages[k].sort(function(a,b){return a.ts-b.ts;}); });
            try{ saveState(); }catch(e){}
            try{ if(typeof renderChat==='function')renderChat(); if(typeof renderMessagesList==='function')renderMessagesList(); }catch(e){}
          }
        });
      });
    }catch(e){}
  }
  function pullSharedMeetups(requestIds){
    try{
      if(!isSharedOn()||!requestIds.length)return;
      client.from(meetTable()).select('*').in('request_id', requestIds).then(function(r){
        if(r&&r.error){ console.warn('pullSharedMeetups failed',r.error.message); return; }
        var rows=r&&r.data||[];
        if(!rows.length)return;
        client.from(reqTable()).select('id,local_mock_id').in('id', requestIds).then(function(rr){
          var idToKey={}; (rr&&rr.data||[]).forEach(function(x){ idToKey[x.id]=x.local_mock_id; });
          var changed=false;
          rows.forEach(function(mu){
            var k=idToKey[mu.request_id];
            if(!k)return;
            if(!ETIE.meetups)ETIE.meetups={};
            var cur=ETIE.meetups[k];
            var cloudStatus=mu.status;
            if(!cur || cur.status!==cloudStatus || cur.activity!==mu.activity){
              ETIE.meetups[k]={activity:mu.activity, when:mu.when_text, where:mu.where_text, status:mu.status, with:mu.with_name||k};
              changed=true;
            }
          });
          if(changed){
            try{ saveState(); }catch(e){}
            try{ if(typeof renderMeetup==='function')renderMeetup(); if(typeof renderTrips==='function')renderTrips(); }catch(e){}
          }
        });
      });
    }catch(e){}
  }
  function subscribeShared(){
    try{
      if(!isSharedOn())return;
      if(realtimeChannel) try{ client.removeChannel(realtimeChannel); }catch(e){}
      realtimeChannel=client.channel('etie-8b-live');
      realtimeChannel.on('postgres_changes',{event:'*', schema:'public', table:reqTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(pullShared, 600);
      }).on('postgres_changes',{event:'*', schema:'public', table:msgTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(function(){ pullShared(); }, 500);
      }).on('postgres_changes',{event:'*', schema:'public', table:meetTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(function(){ pullShared(); }, 600);
      }).subscribe(function(status){
        if(status==='SUBSCRIBED') console.info('Etie realtime subscribed');
      });
    }catch(e){console.warn('subscribeShared skipped',e);}
  }
  // ---- Phase 2: Reviews ----
  function pushSharedReview(localMockId, role, reviewData){
    try{
      if(!isSharedOn())return Promise.resolve(null);
      var k=localMockId|| (typeof reqKey==='function'?reqKey():'local-marta');
      return client.from(reqTable()).select('id').eq('local_mock_id', k).order('updated_at',{ascending:false}).limit(1).maybeSingle().then(function(r){
        var rid=r&&r.data&&r.data.id;
        if(!rid)return Promise.resolve(null);
        var payload={request_id: rid};
        if(role==='trav'){
          payload.traveller_id=session.user.id;
          payload.local_id=null;
          payload.trav_rating=reviewData.rating;
          payload.trav_meet_again=reviewData.meetAgain;
          payload.trav_highlights=reviewData.highlights||[];
          payload.trav_private_text=reviewData.privateText||'';
        } else {
          payload.traveller_id=null;
          payload.local_id=session.user.id;
          payload.local_rating=reviewData.rating;
          payload.local_meet_again=reviewData.meetAgain;
          payload.local_highlights=reviewData.highlights||[];
          payload.local_private_text=reviewData.privateText||'';
        }
        return client.from(revTable()).upsert(payload, {onConflict:'request_id'}).then(function(ir){
          if(ir&&ir.error)console.warn('pushSharedReview failed',ir.error.message);
          // trigger auto-tier check
          checkAutoTier(role, reviewData.rating);
          return ir;
        });
      });
    }catch(e){console.warn('pushSharedReview skipped',e); return Promise.resolve(null);}
  }
  function subscribeReviews(){
    try{
      if(!isSharedOn())return;
      if(reviewChannel) try{ client.removeChannel(reviewChannel); }catch(e){}
      reviewChannel=client.channel('etie-reviews-live');
      reviewChannel.on('postgres_changes',{event:'*', schema:'public', table:revTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(pullSharedReviews, 500);
      }).subscribe(function(status){
        if(status==='SUBSCRIBED') console.info('Etie reviews realtime subscribed');
      });
    }catch(e){console.warn('subscribeReviews skipped',e);}
  }
  function pullSharedReviews(){
    try{
      if(!isSharedOn())return;
      client.from(revTable()).select('*').order('created_at',{ascending:false}).limit(20).then(function(r){
        if(r&&r.error){ console.warn('pullSharedReviews failed',r.error.message); return; }
        var rows=r&&r.data||[];
        var changed=false;
        rows.forEach(function(row){
          // need to find localMockId from request_id
          client.from(reqTable()).select('local_mock_id').eq('id', row.request_id).maybeSingle().then(function(r){
            var k=r&&r.data&&r.data.local_mock_id;
            if(!k)return;
            if(!ETIE.reviews)ETIE.reviews={};
            ETIE.reviews[k]=ETIE.reviews[k]||{};
            if(row.trav_rating){
              ETIE.reviews[k].trav={rating:row.trav_rating,meetAgain:row.trav_meet_again,highlights:row.trav_highlights,privateText:row.trav_private_text,at:new Date(row.created_at).getTime()};
            }
            if(row.local_rating){
              ETIE.reviews[k].local={rating:row.local_rating,meetAgain:row.local_meet_again,highlights:row.local_highlights,privateText:row.local_private_text,at:new Date(row.created_at).getTime()};
            }
            changed=true;
          });
        });
        if(changed){
          try{ saveState(); }catch(e){}
          try{ if(typeof renderMeetup==='function')renderMeetup(); if(typeof renderThanks==='function')renderThanks(); if(typeof renderTrips==='function')renderTrips(); }catch(e){}
        }
      });
    }catch(e){console.warn('pullSharedReviews skipped',e);}
  }
  // ---- Phase 2: Reports ----
  function pushSharedReport(reportData){
    try{
      if(!isSharedOn())return;
      var payload={
        reporter_id: session.user.id,
        reported_id: reportData.reportedId,
        request_id: reportData.requestId,
        category: reportData.category,
        details: reportData.details
      };
      client.from(repTable()).insert(payload).then(function(ir){
        if(ir&&ir.error)console.warn('pushSharedReport failed',ir.error.message);
      });
    }catch(e){console.warn('pushSharedReport skipped',e);}
  }
  function subscribeReports(){
    try{
      if(!isSharedOn())return;
      if(reportChannel) try{ client.removeChannel(reportChannel); }catch(e){}
      reportChannel=client.channel('etie-reports-live');
      reportChannel.on('postgres_changes',{event:'*', schema:'public', table:repTable()}, function(payload){
        // reports are admin-only visible, just log
        console.info('New report:', payload.new);
      }).subscribe(function(status){
        if(status==='SUBSCRIBED') console.info('Etie reports realtime subscribed');
      });
    }catch(e){console.warn('subscribeReports skipped',e);}
  }
  // ---- Live profiles for clean Discover (real users only) ----
  function profileToLocal(row){
    try{
      var hc = (row.hosted_count!=null?row.hosted_count:((row.stats&&row.stats.travellersMet)||0));
      var tier = row.tier || 'Rookie';
      var veteran = (tier==='Host'||tier==='Verified'||hc>=10);
      return {
        id: row.user_id,
        name: row.display_name || 'Guide',
        city: row.city || 'Hong Kong',
        district: row.district || row.city || 'Central / Soho',
        nationality: row.nationality || 'HK',
        age: row.age || 28,
        interests: row.interests || [],
        personality: row.personality || {social:5, spontaneous:5, curious:5},
        offer: row.offer || '',
        offerTags: row.offer_tags || [],
        availability: row.availability || [],
        availDates: row.avail_dates || [],
        stats: row.stats || {rating:4.9, reviews:0, travellersMet:hc},
        tier: tier,
        hostedCount: hc,
        veteran: veteran
      };
    }catch(e){ return null; }
  }
  function pullLiveProfiles(){
    try{
      if(!client||!session) return;
      client.from(profTable()).select('*').order('updated_at',{ascending:false}).limit(50).then(function(r){
        if(r&&r.error){ console.warn('pullLiveProfiles failed', r.error.message); return; }
        var rows=r&&r.data||[];
        // drop legacy kan_win demo row (old Kevin account) — never match it
        rows=rows.filter(function(x){ var n=((x&&x.display_name)||'').toLowerCase().trim(); return n!=='kan_win'&&n!=='kan win'&&n!=='kanwin'; });
        window.ETIE_LIVE_LOCALS = rows.map(profileToLocal).filter(Boolean);
        try{ if(typeof renderMatches==='function') renderMatches(); if(typeof renderLocalDashboard==='function') renderLocalDashboard(); if(typeof renderMapPins==='function') renderMapPins(); }catch(e){}
      });
    }catch(e){ console.warn('pullLiveProfiles skipped', e); }
  }
  function subscribeLiveProfiles(){
    try{
      if(!isSharedOn()) return;
      if(profileLiveChannel) try{ client.removeChannel(profileLiveChannel); }catch(e){}
      profileLiveChannel=client.channel('etie-profiles-live');
      profileLiveChannel.on('postgres_changes',{event:'*', schema:'public', table:profTable()}, function(){ setTimeout(pullLiveProfiles, 400); }).subscribe(function(s){ if(s==='SUBSCRIBED') console.info('Etie live profiles subscribed'); });
      pullLiveProfiles();
    }catch(e){ console.warn('subscribeLiveProfiles skipped', e); }
  }
  // ---- Auto-tier promotion ----
  function checkAutoTier(role, rating){
    try{
      if(!isSharedOn()||typeof ETIE==='undefined')return;
      var p = role==='trav' ? ETIE.traveller : ETIE.local;
      var completed = role==='trav' ? (p.completedTrips||0)+1 : (p.hostedCount||0)+1;
      var avgRating = role==='trav' ? (p.avgRatingReceived||0) : (p.avgHostRating||0);
      var newAvg = avgRating===0 ? rating : Math.round((avgRating*(completed-1)+rating)/completed);
      if(role==='trav'){
        p.completedTrips = completed;
        p.avgRatingReceived = newAvg;
        if(p.tier==='Rookie' && completed>=3 && newAvg>=4){
          p.tier='Trusted';
          toast('🎉 You earned Trusted status! Full Discover unlocked.');
        }
      } else {
        p.hostedCount = completed;
        p.avgHostRating = newAvg;
        if(p.tier==='Rookie' && completed>=3 && newAvg>=4){
          p.tier='Verified';
          toast('🎉 You earned Verified status! Full Discover + Host Activities unlocked.');
        } else if(p.tier==='Verified' && completed>=10 && newAvg>=4.8 && (p.references||[]).length>=2){
          p.tier='Host';
          toast('🌟 You earned Host status! Create activities + top placement.');
        }
      }
      // persist locally + schedule cloud sync
      saveState();
      scheduleProfileSync();
    }catch(e){console.warn('checkAutoTier skipped',e);}
  }
  // ---- Photo upload to Supabase Storage ----
  function uploadPhoto(file, role){
    return new Promise(function(resolve, reject){
      if(!client||!session){ reject('Not signed in'); return; }
      if(!file){ reject('No file'); return; }
      var ext = file.name.split('.').pop().toLowerCase();
      var path = session.user.id + '/' + role + '_' + Date.now() + '.' + ext;
      client.storage.from('etie-photos').upload(path, file, {cacheControl:'3600', upsert:false}).then(function(up){
        if(up.error){ reject(up.error.message); return; }
        client.storage.from('etie-photos').createSignedUrl(path, 60*60*24*365).then(function(su){
          if(su.error){ reject(su.error.message); return; }
          resolve(su.data.signedUrl);
        });
      }).catch(reject);
    });
  }
  // ---- Map-first hooks: Supabase etie_pins (run supabase-schema-pins.sql once) ----
  var pinChannel=null, pinPullTimer=null;
  function pinTable(){return 'etie_pins';}
  function pinRowToPin(r){
    try{
      return {id:String(r.id),kind:'hook',category:r.category||'Food',role:(r.role==='local'?'local':'traveller'),
        name:r.nickname||'Someone',verified:!!r.verified,location:r.location||'Hong Kong',
        lat:r.lat,lng:r.lng,hook:String(r.hook||'').slice(0,140),
        members:r.members||[{nick:r.nickname||'Someone',role:(r.role==='local'?'local':'traveller'),verified:!!r.verified}],
        pending:r.pending||[],status:r.status||'open',ts:(r.updated_at?new Date(r.updated_at).getTime():Date.now()),
        origin:'cloud',cloudId:String(r.id)};
    }catch(e){return null;}
  }
  function pinToRow(p){
    return {id:String(p.cloudId||p.id),user_id:(session&&session.user&&session.user.id)||null,
      nickname:p.name||'Someone',verified:!!p.verified,role:p.role||'traveller',category:p.category||'Food',
      location:p.location||'Hong Kong',lat:p.lat,lng:p.lng,hook:String(p.hook||'').slice(0,140),
      members:p.members||[],pending:p.pending||[],status:p.status||'open',updated_at:new Date().toISOString()};
  }
  function pullPins(){
    try{
      if(!client)return;
      client.from(pinTable()).select('*').order('updated_at',{ascending:false}).limit(200).then(function(r){
        try{
          if(r&&(r.error||!r.data))return; // table not migrated yet → stay local-only
          var cloud=(r.data||[]).map(pinRowToPin).filter(Boolean);
          if(typeof ETIE==='undefined')return;
          var local=(ETIE.mapPins||[]).filter(function(p){return p&&p.origin!=='cloud';});
          cloud.forEach(function(c){
            // local edits win for pins we also hold locally
            var dup=local.some(function(l){return l&&(l.cloudId===c.cloudId||l.id===c.id);});
            if(!dup)local.push(c);
          });
          ETIE.mapPins=local;
          try{if(typeof renderMapPins==='function')renderMapPins();}catch(e){}
        }catch(e){}
      }).catch(function(){});
    }catch(e){}
  }
  function pushPin(pin){
    try{
      if(!client||!session||!pin||pin.lat==null)return; // logged-out pins stay local-only
      var row=pinToRow(pin);
      client.from(pinTable()).upsert(row).then(function(r){
        try{
          if(r&&!r.error&&typeof ETIE!=='undefined'){
            (ETIE.mapPins||[]).forEach(function(p){if(p&&(p.id===pin.id))p.cloudId=String(row.id);});
          }
        }catch(e){}
      }).catch(function(){});
    }catch(e){}
  }
  function deletePin(pin){
    try{
      if(!client||!session||!pin)return;
      var id=pin.cloudId||pin.id;
      client.from(pinTable()).delete().eq('id',String(id)).then(function(){}).catch(function(){});
    }catch(e){}
  }
  function subscribePins(){
    try{
      if(!client||pinChannel)return;
      pinChannel=client.channel('etie-pins-live')
        .on('postgres_changes',{event:'*',schema:'public',table:pinTable()},function(){
          try{clearTimeout(pinPullTimer);}catch(e){}
          pinPullTimer=setTimeout(function(){try{pullPins();}catch(e){}},1200);
        }).subscribe();
    }catch(e){}
  }
  // ---- Expose ----
  window.EtieCloud={
    init:init, signIn:signIn, signOut:signOut,
    push:push, pull:pull, status:status,
    pullPins:pullPins, pushPin:pushPin, deletePin:deletePin,
    syncProfile:syncProfile, pushSharedRequest:pushSharedRequest, pushSharedMessage:pushSharedMessage, pushSharedMeetup:pushSharedMeetup,
    pushSharedReview:pushSharedReview, pushSharedReport:pushSharedReport,
    uploadPhoto:uploadPhoto,
    pullShared:pullShared, subscribeReviews:subscribeReviews, subscribeReports:subscribeReports,
    getClient:function(){return client;}, getSession:function(){return session;}, isSharedOn:isSharedOn
  };
  document.addEventListener('DOMContentLoaded',init);
})();