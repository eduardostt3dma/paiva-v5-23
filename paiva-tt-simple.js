/* PAIVA V5.30 — triagem TT para cliente SEM bicicleta.
   Valores da tabela de tamanhos e geometria da TREK Speed Concept SLR
   (referência específica, NUNCA tabela universal de tamanho TT):
   https://www.trekbikes.com/us/en_US/bikes/road-bikes/triathlon-bikes/speed-concept/f/F231/speed-concept-slr-9/35757/
   Para um modelo antigo, top tube/seat tube são registros descritivos,
   não transformações de medidas do corpo em pad stack ou pad reach. */
(() => {
  'use strict';
  const SOURCE='https://www.trekbikes.com/us/en_US/bikes/road-bikes/triathlon-bikes/speed-concept/f/F231/speed-concept-slr-9/35757/';
  const TREK=Object.freeze([
    {size:'P',height:[154,167],inseam:[72,80],topTube:49.5,seatTube:49.9},
    {size:'M',height:[167,175],inseam:[77,83],topTube:51.8,seatTube:52.5},
    {size:'G',height:[175,186],inseam:[82,88],topTube:54.1,seatTube:54.9},
    {size:'GG',height:[186,198],inseam:[87,93],topTube:56.5,seatTube:57.4}
  ]);
  const el=id=>document.getElementById(id);
  const read=(id,min,max)=>{
    const raw=String(el(id)?.value??'').trim().replace(',','.');
    const value=Number(raw);
    return raw&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
  };
  const fmt=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
  const mode=()=>el('paiva-tt-path')?.value||'none';
  const isCatalogMode=()=>!el('paiva-tt-path')||mode()==='catalog';

  function getEstimate(){
    const height=read('height',140,215);
    const inseam=read('inseam',55,110);
    const heightMatches=height===null?[]:TREK.filter(row=>height>=row.height[0]&&height<=row.height[1]);
    const both=inseam===null?[]:heightMatches.filter(row=>inseam>=row.inseam[0]&&inseam<=row.inseam[1]);
    const status=height===null?'Informe a estatura do cliente.':
      inseam===null?'Meça também a entrepernas: tamanho ainda não confirmado.':
      !heightMatches.length?'Fora da tabela de tamanhos deste modelo.':
      !both.length?'Estatura e entrepernas não coincidem em um tamanho deste catálogo.':
      both.length>1?'Duas opções no limite da tabela; comparar ambas.':
      'Triagem inicial de catálogo; confirmar a regulagem e posição dos pads.';
    const oldTopTube=read('paiva-tt-old-top-tube',35,75);
    const oldSeatTube=read('paiva-tt-old-seat-tube',25,75);
    const saddle=height!==null&&inseam!==null&&inseam<height?inseam*.883:null;
    return {height,inseam,saddle,status,heightMatches,candidates:both,
      oldTopTube,oldSeatTube,source:SOURCE,sourceModel:'Trek Speed Concept SLR'};
  }
  function render(){
    const host=el('paiva-tt-simple');
    if(!host)return;
    host.hidden=document.querySelector('[data-mode].active')?.dataset.mode!=='tt';
    if(host.hidden)return;
    const path=mode();
    el('paiva-tt-old-fields').hidden=path!=='old';
    el('paiva-tt-simple-result').hidden=path==='catalog';
    const estimate=getEstimate();
    if(path==='catalog')return;
    const set=(id,value)=>{if(el(id))el(id).textContent=value;};
    const sizes=estimate.candidates.map(item=>item.size);
    const tubes=estimate.candidates.map(item=>item.size+': '+fmt(item.topTube)+' cm');
    set('paiva-tt-simple-size',sizes.length?sizes.join(' ou '):'—');
    set('paiva-tt-simple-top-tube',tubes.length?tubes.join(' | '):'—');
    set('paiva-tt-simple-saddle',estimate.saddle===null?'—':fmt(estimate.saddle)+' cm');
    set('paiva-tt-simple-status',estimate.status);
    set('paiva-tt-simple-old-top',estimate.oldTopTube===null?'Não informado':fmt(estimate.oldTopTube)+' cm');
    set('paiva-tt-simple-old-seat',estimate.oldSeatTube===null?'Não informado':fmt(estimate.oldSeatTube)+' cm');
    el('paiva-tt-simple-old-summary').hidden=path!=='old';
  }
  window.PAIVA_TT_SIMPLE={TREK,getEstimate,isCatalogMode,render};
  function initialize(){
    const host=el('paiva-tt-coordinates');
    if(!host)return;
    const panel=document.createElement('div');
    panel.id='paiva-tt-simple';
    panel.innerHTML=[
      '<div class="paiva-tt-catalog-header"><span>TT · ESCOLHA RÁPIDA</span>',
      '<strong>Primeiro passo: o cliente já tem TT?</strong></div>',
      '<label class="paiva-tt-model-label">Situação do cliente',
      '<select id="paiva-tt-path">',
      '<option value="none">Não tem bicicleta · usar antropometria</option>',
      '<option value="old">TT antiga · tenho só medidas simples</option>',
      '<option value="catalog">Tenho modelo e catálogo de geometria</option>',
      '</select></label>',
      '<div id="paiva-tt-old-fields" hidden>',
      '<div class="paiva-tt-custom-grid">',
      '<label>Top tube efetivo medido (cm)<input id="paiva-tt-old-top-tube" type="number" inputmode="decimal" min="35" max="75" step="0.1" placeholder="Ex.: 52,5"></label>',
      '<label>Seat tube medido (cm, opcional)<input id="paiva-tt-old-seat-tube" type="number" inputmode="decimal" min="25" max="75" step="0.1" placeholder="Ex.: 53"></label>',
      '</div><p>Use as medidas físicas da TT antiga, se disponíveis. Elas não determinam onde ficam os apoios de antebraço.</p></div>',
      '<div id="paiva-tt-simple-result" aria-live="polite">',
      '<div class="paiva-tt-catalog-grid">',
      '<div><span>TAMANHO INICIAL · EXEMPLO TREK</span><strong id="paiva-tt-simple-size">—</strong><small>Altura e entrepernas</small></div>',
      '<div><span>TOP TUBE EFETIVO · EXEMPLO TREK</span><strong id="paiva-tt-simple-top-tube">—</strong><small>Medida de quadro, NÃO pad reach</small></div>',
      '<div><span>SELIM PRELIMINAR</span><strong id="paiva-tt-simple-saddle">—</strong><small>Entrepernas × 0,883 · centro do MC</small></div>',
      '</div><p class="paiva-tt-catalog-alert" id="paiva-tt-simple-status">Informe estatura e entrepernas.</p>',
      '<p id="paiva-tt-simple-old-summary" hidden>TT antiga informada: top tube <b id="paiva-tt-simple-old-top">—</b>',
      ' · seat tube <b id="paiva-tt-simple-old-seat">—</b>. Medidas registradas, sem equivalência automática com o exemplo Trek.</p>',
      '<p class="paiva-tt-catalog-warning">Referência ilustrativa e específica da <b>Trek Speed Concept SLR</b>.',
      ' O tamanho e o top tube de outra TT podem ser diferentes. Não é prescrição de quadro;',
      ' sem bicicleta ou simulador não calculamos pad stack/reach ideal.</p>',
      '<a href="'+SOURCE+'" target="_blank" rel="noopener noreferrer">Ver tabela oficial Trek usada no exemplo</a>',
      '</div>'
    ].join('');
    host.insertAdjacentElement('afterbegin',panel);
    const change=()=>{
      render();
      document.dispatchEvent(new Event('change',{bubbles:true}));
    };
    el('paiva-tt-path').addEventListener('change',change);
    for(const field of panel.querySelectorAll('#paiva-tt-old-fields input'))field.addEventListener('input',change);
    document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',render));
    document.addEventListener('input',event=>{
      if(['height','inseam'].includes(event.target?.id))render();
    });
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
