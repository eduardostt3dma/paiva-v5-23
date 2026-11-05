/* PAIVA V5.28 — triagem TT sem simulador. Referências por modelo identificado.
   FONTES: https://www.canyon.com/en-us/productpdf/geometry/?pid=4351
           https://www.canyon.com/en-de/productpdf/geometry/?pid=4455
   IMPORTANTE: intervalos de regulagem da bicicleta, NÃO fit do atleta. */
(() => {
  'use strict';
  const CATALOG=Object.freeze({
    cfr4351:{name:'Canyon Speedmax CFR Di2',code:'4351',
      url:'https://www.canyon.com/en-us/productpdf/geometry/?pid=4351',
      rows:[
        {size:'XS',maxH:170,seat:[621,741],padStack:[528,638],padReach:[363,417],frameStack:435,frameReach:393},
        {size:'S',maxH:178,seat:[664,784],padStack:[561,671],padReach:[386,440],frameStack:469,frameReach:415},
        {size:'M',maxH:186,seat:[735,855],padStack:[581,691],padReach:[408,463],frameStack:489,frameReach:438},
        {size:'L',maxH:196,seat:[775,895],padStack:[619,729],padReach:[430,484],frameStack:527,frameReach:459},
        {size:'XL',maxH:Infinity,seat:[799,919],padStack:[644,754],padReach:[454,508],frameStack:553,frameReach:483}
      ]},
    cf4455:{name:'Canyon Speedmax CF 8 Di2',code:'4455',
      url:'https://www.canyon.com/en-de/productpdf/geometry/?pid=4455',
      rows:[
        {size:'XS',maxH:166,seat:[613,733],padStack:[596,666],padReach:[352,463],frameStack:482,frameReach:374},
        {size:'S',maxH:174,seat:[651,771],padStack:[633,703],padReach:[377,488],frameStack:519,frameReach:402},
        {size:'M',maxH:186,seat:[696,846],padStack:[658,728],padReach:[399,510],frameStack:544,frameReach:420},
        {size:'L',maxH:196,seat:[730,880],padStack:[692,762],padReach:[411,522],frameStack:578,frameReach:443},
        {size:'XL',maxH:Infinity,seat:[760,910],padStack:[722,792],padReach:[447,558],frameStack:608,frameReach:468}
      ]}
  });
  const el=id=>document.getElementById(id);
  const read=(id,min,max)=>{
    const raw=String(el(id)?.value??'').trim().replace(',','.');
    const n=Number(raw);
    return raw&&Number.isFinite(n)&&n>=min&&n<=max?n:null;
  };
  const range=pair=>pair[0]+'–'+pair[1]+' mm';
  const middle=pair=>Math.round((pair[0]+pair[1])/2)+' mm';
  const manualPair=(lowId,highId,min,max,optional=false)=>{
    const low=read(lowId,min,max),high=read(highId,min,max);
    if(optional&&low===null&&high===null)return null;
    return low!==null&&high!==null&&low<=high?[low,high]:undefined;
  };
  function getEstimate(){
    const height=read('height',140,215);
    if(height===null)return null;
    if(el('paiva-tt-model')?.value==='manual'){
      const padStack=manualPair('paiva-tt-custom-stack-min','paiva-tt-custom-stack-max',200,1200);
      const padReach=manualPair('paiva-tt-custom-reach-min','paiva-tt-custom-reach-max',100,900);
      const seat=manualPair('paiva-tt-custom-seat-min','paiva-tt-custom-seat-max',300,1200,true);
      if(!padStack||!padReach||seat===undefined)return null;
      const inseam=read('inseam',55,110);
      const saddle=inseam!==null&&inseam<height?Math.round(inseam*.883*10):null;
      const deviation=seat===null||saddle===null?null:saddle<seat[0]?saddle-seat[0]:
        saddle>seat[1]?saddle-seat[1]:0;
      return {model:el('paiva-tt-custom-name')?.value?.trim()||'Modelo informado',
        code:'manual',url:null,size:el('paiva-tt-custom-size')?.value?.trim()||'A confirmar',
        height,seat,padStack,padReach,frameStack:null,frameReach:null,
        saddle,deviation,sourceType:'range-entered-by-professional'};
    }
    const model=CATALOG[el('paiva-tt-model')?.value||'cf4455']||CATALOG.cf4455;
    const row=model.rows.find(item=>height<=item.maxH)||model.rows[model.rows.length-1];
    const inseam=read('inseam',55,110);
    const saddle=inseam!==null&&inseam<height?Math.round(inseam*.883*10):null;
    const deviation=saddle===null?null:saddle<row.seat[0]?saddle-row.seat[0]:
      saddle>row.seat[1]?saddle-row.seat[1]:0;
    return {model:model.name,code:model.code,url:model.url,size:row.size,
      height,seat:row.seat,padStack:row.padStack,padReach:row.padReach,
      frameStack:row.frameStack,frameReach:row.frameReach,
      saddle,deviation,sourceType:'manufacturer-adjustment-range'};
  }
  function render(){
    const panel=el('paiva-tt-catalog');if(!panel)return;
    panel.hidden=document.querySelector('[data-mode].active')?.dataset.mode!=='tt';
    const result=el('paiva-tt-catalog-result');
    if(!result||panel.hidden)return;
    const manual=el('paiva-tt-model')?.value==='manual';
    if(el('paiva-tt-custom-fields'))el('paiva-tt-custom-fields').hidden=!manual;
    const estimate=getEstimate();
    if(!estimate){
      result.hidden=true;
      el('paiva-tt-catalog-empty').hidden=false;
      el('paiva-tt-catalog-empty').textContent=manual
        ? 'Preencha os mínimos e máximos dos dois pads consultando a ficha do modelo. A altura de selim é opcional.'
        : 'Informe a estatura na antropometria para visualizar as faixas.';
      return;
    }
    el('paiva-tt-catalog-empty').hidden=true;
    const set=(id,value)=>{if(el(id))el(id).textContent=value;};
    set('paiva-tt-catalog-size',estimate.size);
    set('paiva-tt-catalog-stack',range(estimate.padStack));
    set('paiva-tt-catalog-reach',range(estimate.padReach));
    set('paiva-tt-catalog-stack-mid',middle(estimate.padStack));
    set('paiva-tt-catalog-reach-mid',middle(estimate.padReach));
    set('paiva-tt-catalog-frame',estimate.frameStack===null
      ? 'Stack/reach DO QUADRO: consultar ficha da marca; não converter a partir dos pads.'
      : 'Quadro: stack '+estimate.frameStack+' mm / reach '+estimate.frameReach+' mm');
    set('paiva-tt-catalog-seat',estimate.seat
      ? 'Altura do selim permitida: '+range(estimate.seat)
      : 'Faixa de altura do selim não informada para este modelo.');
    set('paiva-tt-catalog-seat-status',estimate.saddle===null
      ? 'Informe também a entrepernas para verificar a faixa de altura do selim.'
      : estimate.seat===null
        ? 'Selim preliminar '+estimate.saddle+' mm. Para verificar compatibilidade, informe a faixa de altura publicada.'
      : estimate.deviation===0
        ? 'Selim preliminar '+estimate.saddle+' mm: dentro da faixa publicada para este tamanho. Ainda falta validar a posição.'
        : 'ATENÇÃO: selim preliminar '+estimate.saddle+' mm está '+
          Math.abs(estimate.deviation)+' mm '+(estimate.deviation<0?'abaixo':'acima')+
          ' da faixa publicada. Confira a convenção de medida e o tamanho adjacente.');
    const link=el('paiva-tt-catalog-source');
    if(link){link.hidden=!estimate.url;if(estimate.url)link.href=estimate.url;}
    result.hidden=false;
  }
  window.PAIVA_TT_REFERENCE={getEstimate,catalog:CATALOG};
  function initialize(){
    const host=el('paiva-tt-coordinates');
    if(!host)return;
    const container=document.createElement('div');
    container.id='paiva-tt-catalog';
    container.innerHTML=[
      '<div class="paiva-tt-catalog-header"><span>TT · SEM SIMULADOR</span>',
      '<strong>Referência geométrica por catálogo</strong></div>',
      '<p>Use a antropometria do cliente para localizar uma <b>faixa de regulagem REAL</b>',
      ' de um modelo identificado. Esses números não são o pad stack/reach ideal do atleta.</p>',
      '<label class="paiva-tt-model-label">Modelo de referência (exemplo)',
      '<select id="paiva-tt-model">',
      '<option value="cf4455">Canyon Speedmax CF 8 Di2 · ficha 4455</option>',
      '<option value="cfr4351">Canyon Speedmax CFR Di2 · ficha 4351</option>',
      '<option value="manual">Outro modelo · digitar ficha do fabricante</option>',
      '</select></label>',
      '<div id="paiva-tt-custom-fields" hidden>',
      '<div class="paiva-tt-custom-grid">',
      '<label>Marca / modelo<input id="paiva-tt-custom-name" placeholder="Ex.: Modelo TT do cliente"></label>',
      '<label>Tamanho<input id="paiva-tt-custom-size" placeholder="Ex.: M / 54"></label>',
      '<label>Pad stack mínimo (mm)<input id="paiva-tt-custom-stack-min" type="number" inputmode="decimal"></label>',
      '<label>Pad stack máximo (mm)<input id="paiva-tt-custom-stack-max" type="number" inputmode="decimal"></label>',
      '<label>Pad reach mínimo (mm)<input id="paiva-tt-custom-reach-min" type="number" inputmode="decimal"></label>',
      '<label>Pad reach máximo (mm)<input id="paiva-tt-custom-reach-max" type="number" inputmode="decimal"></label>',
      '<label>Selim mínimo (mm, opcional)<input id="paiva-tt-custom-seat-min" type="number" inputmode="decimal"></label>',
      '<label>Selim máximo (mm, opcional)<input id="paiva-tt-custom-seat-max" type="number" inputmode="decimal"></label>',
      '</div></div>',
      '<p id="paiva-tt-catalog-empty">Informe a estatura na antropometria para visualizar as faixas.</p>',
      '<div id="paiva-tt-catalog-result" hidden aria-live="polite">',
      '<div class="paiva-tt-catalog-size">Tamanho por estatura no catálogo: ',
      '<strong id="paiva-tt-catalog-size">—</strong></div>',
      '<div class="paiva-tt-catalog-grid">',
      '<div><span>Pad stack · AJUSTE</span><strong id="paiva-tt-catalog-stack">—</strong>',
      '<small>Centro geométrico: <b id="paiva-tt-catalog-stack-mid">—</b></small></div>',
      '<div><span>Pad reach · AJUSTE</span><strong id="paiva-tt-catalog-reach">—</strong>',
      '<small>Centro geométrico: <b id="paiva-tt-catalog-reach-mid">—</b></small></div>',
      '</div><p id="paiva-tt-catalog-frame"></p><p id="paiva-tt-catalog-seat"></p>',
      '<p id="paiva-tt-catalog-seat-status" class="paiva-tt-catalog-alert"></p>',
      '<a id="paiva-tt-catalog-source" href="#" target="_blank" rel="noopener noreferrer">',
      'Abrir ficha geométrica do fabricante</a></div>',
      '<p class="paiva-tt-catalog-warning">O centro geométrico é apenas a metade ',
      'da regulagem, NÃO uma posição biomecânica recomendada. Uma Road existente ',
      'pode ajudar na avaliação dinâmica, mas não convertemos medidas STI/Road ',
      'diretamente em apoios TT. Para outras marcas, consulte a ficha específica.</p>'
    ].join('');
    host.insertAdjacentElement('afterbegin',container);
    el('paiva-tt-model').addEventListener('change',render);
    container.querySelectorAll('input').forEach(input=>
      input.addEventListener('input',()=>{
        render();
        document.dispatchEvent(new Event('change',{bubbles:true}));
      }));
    document.querySelectorAll('[data-mode]').forEach(button=>
      button.addEventListener('click',render));
    document.addEventListener('input',event=>{
      if(['height','inseam','torso','arm'].includes(event.target?.id))render();
    });
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
