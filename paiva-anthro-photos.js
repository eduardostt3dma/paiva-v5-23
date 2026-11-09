/* PAIVA V5.85 — Registro fotográfico local, até quatro imagens. */
(() => {
 'use strict';
 const photos = [null,null,null,null];
 function init(){
  const arch=document.getElementById('plantarArchProfile');
  const fields=document.getElementById('fields');
  if(!arch||!fields||document.getElementById('paiva-photo-record'))return;
  const panel=document.createElement('section');panel.id='paiva-photo-record';
  panel.style.cssText='grid-column:1/-1;padding:17px;border:1px solid #424b55;border-radius:14px;background:#101419;color:#edf1f5;margin:12px 0';
  panel.innerHTML='<h3 style="margin:0 0 6px;font-size:17px">Registro fotográfico — Antropometria</h3><p style="font-size:12px;color:#b8c3cd;margin:0 0 14px">Até 4 fotos do pé, arco plantar ou outros detalhes da avaliação. As imagens serão incluídas no PDF. Arquivos originais não são alterados.</p>';
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px';
  for(let i=0;i<4;i++){
   const cell=document.createElement('div');cell.style.cssText='padding:12px;border:1px solid #37424d;border-radius:10px;background:#171c23;min-width:0';
   const label=document.createElement('label');label.textContent='Foto '+(i+1);label.style.cssText='display:block;font-size:12px;margin-bottom:7px';
   const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.setAttribute('aria-label','Selecionar foto '+(i+1));file.style.cssText='max-width:100%;font-size:11px;color:#dbe2e8';
   const preview=document.createElement('img');preview.alt='Prévia da foto '+(i+1);preview.style.cssText='display:none;width:100%;height:125px;object-fit:contain;background:#090d12;border-radius:7px;margin:8px 0';
   const caption=document.createElement('input');caption.type='text';caption.maxLength=80;caption.placeholder='Descrição da foto (opcional)';caption.setAttribute('aria-label','Descrição da foto '+(i+1));caption.style.cssText='box-sizing:border-box;width:100%;margin:8px 0;padding:8px;background:#0b1016;color:#f2f4f6;border:1px solid #4d5964;border-radius:7px;font-size:12px';
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remover foto';remove.disabled=true;remove.style.cssText='font-size:12px;padding:7px 10px;border:1px solid #56606a;border-radius:7px;background:#252c34;color:white;cursor:pointer';
   file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    if(!/^image\/(jpeg|png|webp)$/.test(selected.type)){alert('Escolha uma imagem JPG, PNG ou WEBP.');file.value='';return;}
    if(selected.size>12*1024*1024){alert('Foto muito grande. Escolha uma imagem de até 12 MB.');file.value='';return;}
    try{
     const bitmap=await createImageBitmap(selected);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
     const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
     const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
     photos[i]={image:canvas.toDataURL('image/jpeg',.83),caption:caption.value};
     preview.src=photos[i].image;preview.style.display='block';remove.disabled=false;
    }catch(error){console.error('Falha ao ler foto',error);alert('Não foi possível carregar essa foto.');}
   });
   caption.addEventListener('input',()=>{if(photos[i])photos[i].caption=caption.value;});
   remove.addEventListener('click',()=>{photos[i]=null;file.value='';preview.removeAttribute('src');preview.style.display='none';caption.value='';remove.disabled=true;});
   cell.append(label,file,preview,caption,remove);grid.append(cell);
  }
  panel.append(grid);
  const archNote=fields.querySelector('.wells-protocol-note');
  if(archNote)archNote.after(panel);else fields.append(panel);
 }
 globalThis.PAIVA_ANTHRO_PHOTOS={getPhotos:()=>photos.filter(Boolean).map(p=>({...p}))};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
