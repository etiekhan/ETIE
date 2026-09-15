// Etie Phase 8 + 8b — cloud sync with local fallback + shared live tables (never breaks offline demo)
// Requires: supabase-config.js loaded before this. CDN script optional.
// If keys empty or CDN blocked → status stays offline, app works exactly as Phases 1-7.
// Phase 8b adds shared tables (profiles/requests/messages/meetups) + realtime so TWO logged-in phones see each other.
(function(){
  var client=null, session=null, pushTimer=null, profileTimer=null, sharedSyncTimer=null, realtimeChannel=null;

  function keys(){return {url:(window.ETIE_SUPABASE_URL||'').trim(), key:(window.ETIE_SUPABASE_ANON_KEY||'').trim()};}
  function table(){return window.ETIE_CLOUD_TABLE||'etie_states';}
  function profTable(){return window.ETIE_CLOUD_PROFILES_TABLE||'etie_profiles';}
  function reqTable(){return window.ETIE_CLOUD_REQUESTS_TABLE||'etie_requests';}
  function msgTable(){return window.ETIE_CLOUD_MESSAGES_TABLE||'etie_messages';}
  function meetTable(){return window.ETIE_CLOUD_MEETUPS_TABLE||'etie_meetups';}
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
    // shared needs auth + client + table names (if any table disabled, stay Phase-8 only)
    if(window.ETIE_DEMO)return false; // demo personas stay local, never touch cloud
    if(!client||!session)return false;
    if(!window.ETIE_CLOUD_REQUESTS_TABLE||!window.ETIE_CLOUD_MESSAGES_TABLE)return false;
    return true;
  }

  function init(){
    try{
      var k=keys();
      if(!k.url||!k.key){paint('off','Cloud: offline demo');return;}
      if(!window.supabase||!window.supabase.createClient){paint('offline','Cloud: offline (CDN blocked)');return;}
      client=window.supabase.createClient(k.url,k.key);
      client.auth.getSession().then(function(r){
        session=r&&r.data&&r.data.session?r.data.session:null;
        if(session){paint('on','Cloud: on');pull();pullShared();subscribeShared();syncProfile();}
        else paint('offline','Cloud: offline — sign in');
      }).catch(function(){paint('offline','Cloud: offline');});
      client.auth.onAuthStateChange(function(ev,s){
        session=s;
        // clean old realtime before re-subscribing
        try{ if(realtimeChannel){ client.removeChannel(realtimeChannel); realtimeChannel=null; } }catch(e){}
        if(s){paint('on','Cloud: on');pull();pullShared();subscribeShared();syncProfile();}
        else paint('offline','Cloud: offline — sign in');
      });
    }catch(e){paint('offline','Cloud: offline');}
  }
  function signIn(){
    try{
      var em=document.getElementById('authEmail');
      var email=(em&&em.value||'').trim();
      if(!email||email.indexOf('@')===-1){toast('Enter a valid email for magic link.');return;}
      if(!client){toast('Add Supabase keys first (supabase-config.js).');return;}
      client.auth.signInWithOtp({email:email, options:{emailRedirectTo: window.location.href}}).then(function(r){
        if(r&&r.error)toast('Sign-in error: '+r.error.message);
        else toast('Check your email for the login link.');
      });
    }catch(e){toast('Sign-in unavailable offline.');}
  }
  function signOut(){
    try{if(client)try{ client.removeChannel(realtimeChannel); }catch(e){};realtimeChannel=null; if(client)client.auth.signOut();}catch(e){}
    session=null;paint('offline','Cloud: offline — sign in');
  }
  // ---- Phase 8: single-user backup ----
  function push(){
    try{
      if(window.ETIE_DEMO)return; // demo personas stay local
      if(!client||!session)return; // offline: localStorage already saved by app.js
      clearTimeout(pushTimer);
      pushTimer=setTimeout(function(){
        try{
          var payload={user_id:session.user.id, data:(typeof ETIE!=='undefined'?ETIE:{}), updated_at:new Date().toISOString()};
          client.from(table()).upsert(payload).then(function(r){
            if(r&&r.error)console.warn('Etie cloud push failed',r.error.message);
          });
        }catch(e){console.warn('Etie cloud push skipped',e);}
      },800);
      // also sync profile debounced (Phase 8b)
      scheduleProfileSync();
      scheduleSharedPush();
    }catch(e){}
  }
  function pull(){
    try{
      if(window.ETIE_DEMO)return; // demo personas stay local
      if(!client||!session)return;
      client.from(table()).select('data,updated_at').eq('user_id',session.user.id).maybeSingle().then(function(r){
        if(r&&(r.error||!r.data))return; // no cloud row yet → next saveState will push local up
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
        try { localStorage.setItem('etie-v1-backup', localStorage.getItem('etie-v1')||''); }
        catch(e){}
        try{
          ETIE=Object.assign(ETIE||{},cloud);
          saveState();
          if(typeof restoreAll==='function')restoreAll();
          toast('Cloud data loaded.');
        }catch(e){console.warn('Etie cloud pull skipped',e);}
      });
    }catch(e){}
  }

  // ---- Phase 8b: shared live helpers ----
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
      var payload={
        user_id: session.user.id,
        display_name: (p.displayName || ETIE.traveller && ETIE.traveller.name || session.user.email.split('@')[0]),
        city: p.city || ETIE.trip && ETIE.trip.destination || 'Lisbon',
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
      client.from(profTable()).upsert(payload).then(function(r){
        if(r&&r.error)console.warn('Etie profile sync failed',r.error.message);
      });
    }catch(e){console.warn('Etie profile sync skipped',e);}
  }

  function scheduleSharedPush(){
    if(!isSharedOn())return;
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer=setTimeout(pushSharedRequests, 700);
  }
  // push one request key to cloud (called from app.js wrappers)
  // 8b fix: if ANOTHER user created the request for this mock (traveller -> local flow),
  // update THEIR row by id instead of upserting our own (traveller_id, local_mock_id) row.
  // Without this, Accept on phone B creates a duplicate row and phone A never sees it.
  function pushSharedRequest(localMockId){
    try{
      if(!isSharedOn())return Promise.resolve(null);
      if(!localMockId) localMockId=(typeof reqKey==='function'?reqKey():'local-marta');
      var k=localMockId;
      var localReq=(typeof ETIE!=='undefined' && ETIE.requests && ETIE.requests[k])?ETIE.requests[k]:null;
      if(!localReq)return Promise.resolve(null);
      // 1) look for latest cloud row for this mock id (whoever created it)
      return client.from(reqTable()).select('id,traveller_id,status').eq('local_mock_id', k).order('updated_at',{ascending:false}).limit(1).maybeSingle().then(function(found){
        var existing=found&&found.data;
        if(found&&found.error&&found.error.code!=='PGRST116') console.warn('pushSharedRequest lookup failed',found.error.message);
        // 2) someone else's row exists and it's not ours -> we are the Local side: UPDATE it
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
        // 3) otherwise we are the Traveller (own row): upsert
        var payload={
          traveller_id: session.user.id,
          local_mock_id: k,
          local_id: null,
          status: localReq.status,
          message: localReq.message||'',
          destination: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.destination)||'Lisbon',
          dates: (typeof ETIE!=='undefined' && ETIE.trip && ETIE.trip.dates)||'',
          traveller_name: (typeof ETIE!=='undefined' && ETIE.traveller && ETIE.traveller.name)||'Traveller',
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
  // messages: ETIE.messages[k] is array of {from,text,ts}
  // we store in etie_messages with request_id lookup; dedupe by text+sender+~ts
  function syncPendingMessages(localMockId, requestId){
    try{
      if(!isSharedOn())return;
      var arr=(ETIE.messages&&ETIE.messages[localMockId])||[];
      if(!arr.length)return;
      // fetch existing cloud messages for this request_id to avoid duplicate inserts
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
      // need request_id first
      client.from(reqTable()).select('id').eq('traveller_id', session.user.id).eq('local_mock_id', k).maybeSingle().then(function(r){
        var rid=r&&r.data&&r.data.id;
        if(!rid){
          // if not found, try fetch any request with this mock id (other traveller's request that we are local for)
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
      // need request_id
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
      // fetch recent requests (limit 50 for demo) — open RLS lets any auth user see them; demo-small is fine
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
          // cloud newer or local missing -> adopt cloud
          if(!existing || cloudTs > localTs + 1500){
            if(!ETIE.requests)ETIE.requests={};
            ETIE.requests[k]={status: row.status, message: row.message||'', updatedAt: cloudTs, localName: row.local_name||k};
            changed=true;
          }
        });
        if(changed){
          try{ saveState(); }catch(e){}
          try{ if(typeof renderRequests==='function')renderRequests(); if(typeof renderLocalDashboard==='function')renderLocalDashboard(); if(typeof renderMessagesList==='function')renderMessagesList(); if(typeof renderMeetup==='function')renderMeetup(); if(typeof renderTrips==='function')renderTrips(); }catch(e){}
        }
        // after requests, pull messages + meetups for those ids
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
        // need map request_id -> localMockId
        client.from(reqTable()).select('id,local_mock_id').in('id', requestIds).then(function(rr){
          var idToKey={};
          (rr&&rr.data||[]).forEach(function(x){ idToKey[x.id]=x.local_mock_id; });
          var changed=false;
          rows.forEach(function(m){
            var k=idToKey[m.request_id];
            if(!k)return;
            if(!ETIE.messages)ETIE.messages={};
            if(!ETIE.messages[k])ETIE.messages[k]=[];
            var role=m.sender_role; // 'traveller'/'local'
            var text=m.text;
            // dedupe: if we already have same text+role, skip
            var exists=ETIE.messages[k].some(function(x){ return x.text===text && x.from===role; });
            if(exists)return;
            ETIE.messages[k].push({from: role, text: text, ts: new Date(m.created_at).getTime()});
            changed=true;
          });
          if(changed){
            // sort by ts
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
        // debounce pull
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(pullShared, 600);
      }).on('postgres_changes',{event:'*', schema:'public', table:msgTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(function(){ pullShared(); }, 500);
      }).on('postgres_changes',{event:'*', schema:'public', table:meetTable()}, function(payload){
        clearTimeout(sharedSyncTimer); sharedSyncTimer=setTimeout(function(){ pullShared(); }, 600);
      }).subscribe(function(status){
        if(status==='SUBSCRIBED') console.info('Etie 8b realtime subscribed');
      });
    }catch(e){console.warn('subscribeShared skipped',e);}
  }

  // expose for app.js wrappers (offline-safe)
  function getClient(){ return client; }
  function getSession(){ return session; }

  window.EtieCloud={
    init:init, signIn:signIn, signOut:signOut,
    push:push, pull:pull, status:status,
    // 8b
    syncProfile:syncProfile, pushSharedRequest:pushSharedRequest, pushSharedMessage:pushSharedMessage, pushSharedMeetup:pushSharedMeetup,
    pullShared:pullShared, getClient:getClient, getSession:getSession, isSharedOn:isSharedOn
  };
  document.addEventListener('DOMContentLoaded',init);
})();
