/* portal.js — FirstTry Trust Center | F100 v4.4.2 */
(function(){
'use strict';

// Sidebar toggle (mobile off-canvas)
var sidebar=document.getElementById('sidebar-nav');
var toggleBtn=document.getElementById('sidebar-toggle');
var ov=document.createElement('div');
ov.id='sidebar-overlay';
ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:999;';
document.body.appendChild(ov);
if(toggleBtn&&sidebar){
  toggleBtn.addEventListener('click',function(){
    sidebar.classList.toggle('open');
    ov.style.display=sidebar.classList.contains('open')?'block':'none';
  });
  ov.addEventListener('click',function(){
    sidebar.classList.remove('open');
    ov.style.display='none';
  });
}

// Sidebar inline filter
var si=document.getElementById('sidebar-search-input');
if(si){
  si.addEventListener('input',function(){
    var q=this.value.toLowerCase().trim();
    var items=document.querySelectorAll('.sidebar-item');
    var groups=document.querySelectorAll('.sidebar-group');
    items.forEach(function(item){
      var t=item.dataset.searchTitle||'';
      item.classList.toggle('search-hidden',!!(q&&!t.includes(q)));
    });
    groups.forEach(function(g){
      var vis=g.querySelectorAll('.sidebar-item:not(.search-hidden)');
      g.style.display=vis.length?'':'none';
    });
  });
}

// Full-text search overlay from search_index.json
var searchIdx=null;
var so=null;

function getSo(){
  if(!so){
    so=document.createElement('div');
    so.id='search-overlay';
    document.body.appendChild(so);
  }
  return so;
}

function getRoot(){
  var l=document.querySelectorAll('link[rel="stylesheet"]');
  for(var i=0;i<l.length;i++){
    var h=l[i].getAttribute('href');
    if(h&&h.includes('assets/portal.css'))return h.replace('assets/portal.css','');
  }
  return '';
}

function loadIdx(cb){
  if(searchIdx){cb(searchIdx);return;}
  var r=getRoot();
  var x=new XMLHttpRequest();
  x.open('GET',r+'assets/search_index.json',true);
  x.onload=function(){
    if(x.status===200){try{searchIdx=JSON.parse(x.responseText);}catch(e){searchIdx=[];}}
    else searchIdx=[];
    cb(searchIdx);
  };
  x.onerror=function(){searchIdx=[];cb(searchIdx);};
  x.send();
}

function search(q,idx){
  if(!q)return[];
  var ql=q.toLowerCase();
  return idx.filter(function(e){
    return(e.title.toLowerCase().includes(ql)||
      (e.excerpt&&e.excerpt.toLowerCase().includes(ql))||
      (e.headings&&e.headings.some(function(h){return h.toLowerCase().includes(ql);}))||
      (e.doc_id&&e.doc_id.toLowerCase().includes(ql)));
  }).slice(0,12);
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderResults(rs,q){
  var r=getRoot();
  var el=getSo();
  if(!rs.length){
    el.innerHTML='<div class="sr-item" style="color:#5e6c84">No results for "'+esc(q)+'"</div>';
  }else{
    el.innerHTML=rs.map(function(e){
      return'<div class="sr-item" onclick="location.href=\''+r+e.route+'\'">'
        +'<div class="sr-title">'+esc(e.title)+'</div>'
        +'<div class="sr-group">'+esc(e.group)+' &middot; '+esc(e.doc_id)+'</div>'
        +(e.excerpt?'<div class="sr-excerpt">'+esc(e.excerpt.slice(0,130))+'&hellip;</div>':'')
        +'</div>';
    }).join('');
  }
  el.classList.add('visible');
}

if(si){
  var timer=null;
  si.addEventListener('input',function(){
    var q=this.value.trim();
    if(timer)clearTimeout(timer);
    if(!q){var el=getSo();if(el)el.classList.remove('visible');return;}
    timer=setTimeout(function(){loadIdx(function(idx){renderResults(search(q,idx),q);});},220);
  });
  document.addEventListener('click',function(e){
    var el=getSo();
    if(el&&!el.contains(e.target)&&e.target!==si)el.classList.remove('visible');
  });
  si.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      var el=getSo();if(el)el.classList.remove('visible');
      this.value='';
      document.querySelectorAll('.sidebar-item').forEach(function(i){i.classList.remove('search-hidden');});
      document.querySelectorAll('.sidebar-group').forEach(function(g){g.style.display='';});
    }
  });
}

})();
