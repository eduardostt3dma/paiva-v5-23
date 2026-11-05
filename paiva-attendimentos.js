/* PAIVA V5.24 — fichas locais de atendimento, com backup JSON explícito.
   Fotos e vídeos 2D permanecem no arquivo de mídia separado do navegador. */
(() => {
  'use strict';
  const DB = 'paiva-attendimentos-v1';
  const STORE = 'fichas';
  const VERSION = 'paiva-attendance-v1';
  const clientIds = ['clientName','evalDate','clientEmail','clientPhone','clientBirth','clientSex'];
  const selectors = [
    '#fields input','#fields select','.bike-meta input','#bikeFields input',
    '#paiva-tt-path','#paiva-tt-old-fields input',
    '#paiva-proportions-conclusion','#paiva-tt-coordinates input','#paiva-tt-model','#paiva-bike-project input',
    '#paiva-bike-project select','#paiva-compare input'
  ];
  let database;
  let currentId = null;
  const el = id => document.getElementById(id);
  const mode = () => document.querySelector('[data-mode].active')?.dataset.mode || 'road';
  const pause = () => new Promise(resolve => setTimeout(resolve, 40));

  function allFields() {
    const elements = [...clientIds.map(el),...document.querySelectorAll(selectors.join(','))];
    return [...new Set(elements)].filter(item => item && item.id && !item.readOnly &&
      !['file','button','checkbox','radio'].includes(item.type));
  }
  function snapshot() {
    const values = Object.fromEntries(allFields().map(input => [input.id,input.value]));
    return {
      format:VERSION, mode:mode(), values,
      method:globalThis.PAIVA_ANTHRO_METHOD?.getMode?.() || 'height',
      profile:globalThis.PAIVA_BIKE_PROJECT?.getDraft?.()?.profile || 'balanced'
    };
  }
  function openDb() {
    if(database) return database;
    database = new Promise((resolve,reject) => {
      if(!globalThis.indexedDB) {reject(new Error('Este navegador não oferece arquivo local.'));return;}
      const request = indexedDB.open(DB,1);
      request.onupgradeneeded = () => {
        if(!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE,{keyPath:'id'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha ao abrir fichas locais.'));
    }).catch(error => {database=null;throw error;});
    return database;
  }
  async function transact(action, readOnly=false) {
    const db = await openDb();
    return new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,readOnly?'readonly':'readwrite');
      let output;
      const request = action(tx.objectStore(STORE));
      if(request) request.onsuccess = () => {output=request.result;};
      tx.oncomplete = () => resolve(output);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Não foi possível concluir a operação.'));
    });
  }
  const identifier = () => 'ficha-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const safeName = name => (String(name||'Cliente').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,45) || 'Cliente');
  function download(blob,name) {
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=name;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function validate(data) {
    if(!data || data.format!==VERSION || typeof data.values!=='object' ||
      data.values===null || Array.isArray(data.values) ||
      !['road','mtb','tt'].includes(data.mode))
      throw new Error('Arquivo incompatível com as fichas PAIVA V5.24.');
    return data;
  }

  async function initialize() {
    const anchor=document.querySelector('main > .client-first');
    if(!anchor || el('paiva-attendimentos'))return;
    const nav=document.createElement('nav');
    nav.id='paiva-v524-nav';nav.setAttribute('aria-label','Navegação pelos módulos PAIVA');
    for(const [name,target] of [
      ['Cadastro','.client-first'],['Antropometria','#fields'],
      ['Pré-fit','#paiva-sizing-method'],['Quadros','#paiva-compare'],
      ['2D','#paiva-athlete-2d'],['PDF','#print']
    ]){
      const button=document.createElement('button');button.type='button';
      button.textContent=name;
      button.addEventListener('click',()=>document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'}));
      nav.append(button);
    }
    document.querySelector('main > header')?.after(nav);
    const panel=document.createElement('section');
    panel.className='card paiva-sessions';panel.id='paiva-attendimentos';
    panel.innerHTML=`
      <div class="paiva-sessions-title"><div><span>ARQUIVO LOCAL · PAIVA V5.33</span>
        <h2>Atendimentos</h2></div><span class="paiva-sessions-indicator" id="paiva-session-current">Ficha nova</span></div>
      <div class="paiva-sessions-actions">
        <button type="button" id="paiva-session-save" class="btn primary">Salvar ficha</button>
        <button type="button" id="paiva-session-new" class="btn">Novo atendimento</button>
        <button type="button" id="paiva-session-export" class="btn">Exportar backup JSON</button>
        <label class="btn paiva-session-import">Importar backup
          <input id="paiva-session-import-file" type="file" accept=".json,application/json" /></label>
      </div>
      <div class="paiva-sessions-existing"><label for="paiva-session-list">Fichas salvas neste aparelho</label>
        <select id="paiva-session-list"><option value="">Nenhuma ficha selecionada</option></select>
        <button type="button" id="paiva-session-open" class="btn">Abrir ficha</button></div>
      <p id="paiva-session-status" role="status" aria-live="polite">As fichas ficam somente neste navegador. Exporte o JSON para backup.</p>
      <p class="paiva-sessions-alert">O backup JSON contém dados pessoais e não inclui fotos, vídeos nem marcações 2D. Guarde-o em local protegido. Para outro cliente, confira também a área de análise 2D.</p>`;
    anchor.after(panel);
    const status=message=>{el('paiva-session-status').textContent=message;};
    const busy=state=>{
      for(const id of ['paiva-session-save','paiva-session-new','paiva-session-open','paiva-session-export'])
        el(id).disabled=state;
    };

    async function refreshList() {
      const items=await transact(store=>store.getAll(),true);
      const select=el('paiva-session-list'), previous=select.value;
      select.replaceChildren(new Option('Selecione uma ficha',''));
      items.sort((a,b)=>b.updatedAt-a.updatedAt).forEach(item=>{
        select.append(new Option(`${item.name} · ${item.mode.toUpperCase()} · ${new Date(item.updatedAt).toLocaleDateString('pt-BR')}`,item.id));
      });
      select.value=items.some(item=>item.id===previous)?previous:(currentId||'');
      if(select.selectedIndex<0)select.value='';
    }
    function markCurrent(name) {
      el('paiva-session-current').textContent=currentId ? 'Editando: '+name : 'Ficha nova';
    }
    async function resetForm() {
      document.querySelector('[data-mode="road"]')?.click();
      await pause();
      globalThis.PAIVA_FRAME_COMPARE?.resetAll?.();
      globalThis.PAIVA_BIKE_PROJECT?.resetAll?.();
      globalThis.PAIVA_FINAL_MEASURES?.reset?.();
      globalThis.PAIVA_BIKE_PHOTOS?.clearAll?.();
      document.querySelector('[data-sizing="height"]')?.click();
      for(const input of allFields()) {
        input.value='';
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      // Novo atendimento sempre recomeça na opção TT sem bicicleta.
      if(el('paiva-tt-path'))el('paiva-tt-path').value='none';
      const date=el('evalDate');
      if(date){
        const today=new Date();
        date.value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
          String(today.getDate()).padStart(2,'0')].join('-');
      }
      document.dispatchEvent(new Event('change',{bubbles:true}));
      currentId=null;markCurrent('');
    }
    async function restore(data) {
      validate(data);
      await resetForm();
      document.querySelector(`[data-mode="${data.mode}"]`)?.click();
      await pause();
      const allowed=new Map(allFields().map(input=>[input.id,input]));
      for(const [id,value] of Object.entries(data.values)) {
        const input=allowed.get(id);
        if(!input || typeof value!=='string' || value.length>2000)continue;
        input.value=value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(data.method==='full')document.querySelector('[data-sizing="full"]')?.click();
      if(['aggressive','balanced','comfortable'].includes(data.profile))
        document.querySelector(`[data-prj-profile="${data.profile}"]`)?.click();
      document.dispatchEvent(new Event('input',{bubbles:true}));
    }
    async function run(task) {
      busy(true);
      try{await task();}
      catch(error){status('A operação não foi concluída: '+(error?.message||'erro desconhecido'));}
      finally{busy(false);}
    }

    el('paiva-session-save').addEventListener('click',()=>run(async()=>{
      const data=snapshot();
      const name=(data.values.clientName||'Cliente sem nome').trim();
      const now=Date.now();
      currentId=currentId||identifier();
      await transact(store=>store.put({id:currentId,name,mode:data.mode,
        createdAt:now,updatedAt:now,data}));
      markCurrent(name);await refreshList();
      status('Ficha salva neste aparelho. Exporte o backup JSON para guardá-la fora do navegador.');
    }));
    el('paiva-session-new').addEventListener('click',()=>run(async()=>{
      if(!window.confirm('Iniciar nova ficha? As alterações não salvas na ficha atual serão perdidas. As fichas já salvas continuam disponíveis.'))return;
      await resetForm();el('paiva-session-list').value='';
      status('Nova ficha pronta. A mídia 2D já aberta não foi removida: confira o visor antes de atender outro cliente.');
    }));
    el('paiva-session-open').addEventListener('click',()=>run(async()=>{
      const id=el('paiva-session-list').value;
      if(!id){status('Selecione uma ficha salva.');return;}
      if(!window.confirm('Abrir a ficha selecionada? Dados não salvos da ficha atual serão substituídos.'))return;
      const item=await transact(store=>store.get(id),true);
      if(!item)throw new Error('Ficha não encontrada.');
      await restore(item.data);currentId=id;markCurrent(item.name);
      status('Ficha carregada. Fotos e vídeos armazenados separadamente não são trocados automaticamente.');
    }));
    el('paiva-session-export').addEventListener('click',()=>{
      const data=snapshot(),name=safeName(data.values.clientName);
      const file=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      download(file,`PAIVA_Ficha_${name}_${new Date().toISOString().slice(0,10)}.json`);
      status('Backup da ficha exportado. O arquivo JSON contém dados pessoais: mantenha-o protegido.');
    });
    el('paiva-session-import-file').addEventListener('change',event=>run(async()=>{
      const file=event.target.files?.[0];if(!file)return;
      if(file.size>1024*1024)throw new Error('O arquivo JSON deve ter menos de 1 MB.');
      const data=validate(JSON.parse(await file.text()));
      if(!window.confirm('Importar esta ficha? Dados não salvos serão substituídos.'))return;
      await restore(data);
      status('Ficha importada. Use Salvar ficha para adicioná-la à lista deste aparelho.');
      event.target.value='';
    }));
    try{await refreshList();}
    catch(error){status('Arquivo local indisponível. Use Exportar backup JSON para guardar os dados.');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
