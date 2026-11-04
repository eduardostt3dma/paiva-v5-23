/* PAIVA · Arquivo local para fotos e vídeos. IndexedDB, sem upload.
   Armazenamento sujeito à quota/limpeza do navegador: exporte os arquivos. */
(() => {
  'use strict';
  const DB='paiva-bike-fit-records-v1';
  const STORE='items';
  let dbPromise=null;

  function open(){
    if(!('indexedDB' in globalThis))return Promise.reject(new Error('Armazenamento local não disponível neste navegador.'));
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o arquivo local.'));
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  }
  async function transaction(mode,operation){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      let result;
      const request=operation(tx.objectStore(STORE));
      if(request){request.onsuccess=()=>{result=request.result;};}
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||new Error('O navegador não conseguiu salvar esse registro.'));
      tx.onabort=()=>reject(tx.error||new Error('O registro não foi salvo; confira o espaço disponível.'));
    });
  }
  const id=kind=>`${kind}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  async function save(item){
    if(!(item?.blob instanceof Blob)||!item.blob.size)throw new Error('O arquivo está vazio.');
    const data={id:item.id||id(item.kind||'registro'),kind:item.kind||'registro',
      name:String(item.name||'registro'),description:String(item.description||''),
      createdAt:item.createdAt||Date.now(),updatedAt:Date.now(),
      size:item.blob.size,type:item.blob.type||'application/octet-stream',blob:item.blob};
    await transaction('readwrite',store=>store.put(data));
    window.dispatchEvent(new Event('paiva-records-changed'));
    return data.id;
  }
  async function get(key){return transaction('readonly',store=>store.get(key));}
  async function remove(key){
    await transaction('readwrite',store=>store.delete(key));
    window.dispatchEvent(new Event('paiva-records-changed'));
  }
  async function list(limit=40){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const results=[];
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).openCursor();
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor)return;
        const {id,kind,name,description,createdAt,updatedAt,size,type}=cursor.value;
        results.push({id,kind,name,description,createdAt,updatedAt,size,type});
        cursor.continue();
      };
      tx.oncomplete=()=>resolve(results.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit));
      tx.onerror=()=>reject(tx.error||new Error('Não foi possível listar os registros.'));
    });
  }
  async function download(key){
    const item=await get(key);
    if(!item?.blob)throw new Error('Registro não encontrado.');
    const url=URL.createObjectURL(item.blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=item.name;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  globalThis.PAIVA_RECORDS={save,get,list,remove,download,id};
})();
