/* PAIVA V5.32 — triagem TT para cliente SEM bicicleta, com duas fichas reais.
   Tabela de tamanho e geometria TREK Speed Concept SLR:
   https://www.trekbikes.com/us/en_US/bikes/road-bikes/triathlon-bikes/speed-concept/f/F231/speed-concept-slr-9/35757/
   Tabela de geometria CANYON Speedmax CF 8 Di2 (ficha 4455):
   https://www.canyon.com/en-de/productpdf/geometry/?pid=4455
   Os dois fabricantes não usam a mesma convenção para definir tamanho.
   Top tubes são VALORES DOS MODELOS, NÃO estimativas ideais para o cliente.
   Para um modelo antigo, top tube/seat tube são registros descritivos,
   não transformações de medidas do corpo em pad stack ou pad reach. */
(() => {
  'use strict';
  const SOURCE='https://www.trekbikes.com/us/en_US/bikes/road-bikes/triathlon-bikes/speed-concept/f/F231/speed-concept-slr-9/35757/';
  const CANYON_SOURCE='https://www.canyon.com/en-de/productpdf/geometry/?pid=4455';
  const TREK=Object.freeze([
    {size:'P',height:[154,167],inseam:[72,80],topTube:49.5,seatTube:49.9},
    {size:'M',height:[167,175],inseam:[77,83],topTube:51.8,seatTube:52.5},
    {size:'G',height:[175,186],inseam:[82,88],topTube:54.1,seatTube:54.9},
    {size:'GG',height:[186,198],inseam:[87,93],topTube:56.5,seatTube:57.4}
  ]);
  // Publicado em cm para altura e em mm para tubos; conversão explícita
  // de mm para cm. A Canyon usa APENAS altura na ficha deste modelo.
  const CANYON=Object.freeze([
    {size:'XS',height:[0,166],topTube:45.4,seatTube:48.0},
    {size:'S',height:[166,174],topTube:48.9,seatTube:51.8},
    {size:'M',height:[174,186],topTube:51.1,seatTube:54.3},
    {size:'L',height:[186,196],topTube:54.0,seatTube:57.7},
    {size:'XL',height:[196,Infinity],topTube:57.0,seatTube:60.7}
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
    const canyonCandidates=height===null?[]:
      CANYON.filter(row=>height>=row.height[0]&&height<=row.height[1]);
    const status=height===null?'Informe a estatura do cliente.':
      inseam===null?'Meça também a entrepernas: tamanho ainda não confirmado.':
      !heightMatches.length?'Fora da tabela de tamanhos deste modelo.':
      !both.length?'Estatura e entrepernas não coincidem em um tamanho deste catálogo.':
      both.length>1?'Duas opções no limite da tabela; comparar ambas.':
      'Triagem inicial de catálogo; confirmar a regulagem e posição dos pads.';
    const canyonStatus=height===null?'Canyon: informe a estatura.':
      canyonCandidates.length>1?'Canyon: estatura na fronteira de tamanhos. Compare os dois.':
      'Canyon: consulta por estatura na ficha 4455; não utiliza entrepernas neste critério.';
    const oldTopTube=read('paiva-tt-old-top-tube',35,75);
    const oldSeatTube=read('paiva-tt-old-seat-tube',25,75);
    const saddle=height!==null&&inseam!==null&&inseam<height?inseam*.883:null;
    return {height,inseam,saddle,status,heightMatches,candidates:both,
      canyonCandidates,canyonStatus,oldTopTube,oldSeatTube,
      source:SOURCE,sourceModel:'Trek Speed Concept SLR',
      canyonSource:CANYON_SOURCE,canyonModel:'Canyon Speedmax CF 8 Di2'};
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
    const seats=estimate.candidates.map(item=>item.size+': '+fmt(item.seatTube)+' cm');
    const canyonSizes=estimate.canyonCandidates.map(item=>item.size);
    const canyonTubes=estimate.canyonCandidates.map(item=>item.size+': '+fmt(item.topTube)+' cm');
    const canyonSeats=estimate.canyonCandidates.map(item=>item.size+': '+fmt(item.seatTube)+' cm');
    set('paiva-tt-simple-size',sizes.length?sizes.join(' ou '):'—');
    set('paiva-tt-simple-top-tube',tubes.length?tubes.join(' | '):'—');
    set('paiva-tt-simple-seat-tube',seats.length?seats.join(' | '):'—');
    set('paiva-tt-simple-canyon-size',canyonSizes.length?canyonSizes.join(' ou '):'—');
    set('paiva-tt-simple-canyon-top',canyonTubes.length?canyonTubes.join(' | '):'—');
    set('paiva-tt-simple-canyon-seat',canyonSeats.length?canyonSeats.join(' | '):'—');
    set('paiva-tt-simple-saddle',estimate.saddle===null?'—':fmt(estimate.saddle)+' cm');
    set('paiva-tt-simple-status',estimate.status);
    set('paiva-tt-simple-canyon-status',estimate.canyonStatus);
    set('paiva-tt-simple-old-top',estimate.oldTopTube===null?'Não informado':fmt(estimate.oldTopTube)+' cm');
    set('paiva-tt-simple-old-seat',estimate.oldSeatTube===null?'Não informado':fmt(estimate.oldSeatTube)+' cm');
    el('paiva-tt-simple-old-summary').hidden=path!=='old';
  }
  window.PAIVA_TT_SIMPLE={TREK,CANYON,getEstimate,isCatalogMode,render};
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
      '<p class="paiva-tt-simple-caption">TAMANHOS PARA PESQUISA · exemplos reais de dois fabricantes</p>',
      '<div class="paiva-tt-catalog-grid">',
      '<div><span>TREK · SPEED CONCEPT SLR</span><strong id="paiva-tt-simple-size">—</strong>',
      '<small>Tabela por estatura + entrepernas</small>',
      '<small>Top tube efetivo: <b id="paiva-tt-simple-top-tube">—</b></small>',
      '<small>Seat tube: <b id="paiva-tt-simple-seat-tube">—</b></small></div>',
      '<div><span>CANYON · SPEEDMAX CF 8 Di2</span><strong id="paiva-tt-simple-canyon-size">—</strong>',
      '<small>Ficha 4455 · tamanho pela estatura</small>',
      '<small>Top tube do catálogo: <b id="paiva-tt-simple-canyon-top">—</b></small>',
      '<small>Seat tube: <b id="paiva-tt-simple-canyon-seat">—</b></small></div>',
      '<div><span>ALTURA INICIAL DO SELIM · ESTIMATIVA</span>',
      '<strong id="paiva-tt-simple-saddle">—</strong>',
      '<small>Entrepernas × 0,883 desde o centro do MC; validar dinamicamente</small></div>',
      '</div><p class="paiva-tt-catalog-alert" id="paiva-tt-simple-status">Trek: informe estatura e entrepernas.</p>',
      '<p id="paiva-tt-simple-canyon-status">Canyon: informe estatura.</p>',
      '<p id="paiva-tt-simple-old-summary" hidden>TT antiga informada: top tube <b id="paiva-tt-simple-old-top">—</b>',
      ' · seat tube <b id="paiva-tt-simple-old-seat">—</b>. Medidas registradas, sem equivalência automática com os exemplos.</p>',
      '<p class="paiva-tt-catalog-warning"><b>Leitura honesta:</b> estas são medidas reais de DUAS bicicletas,',
      ' não um top tube ideal calculado do corpo. Tamanhos com letras diferentes',
      ' não são intercambiáveis. Tronco e braços seguem na ficha para avaliação do',
      ' profissional; sem bicicleta ou simulador não inventamos pad stack/reach.</p>',
      '<div class="paiva-tt-simple-sources"><a href="'+SOURCE+'" target="_blank" rel="noopener noreferrer">Fonte Trek</a>',
      '<a href="'+CANYON_SOURCE+'" target="_blank" rel="noopener noreferrer">Fonte Canyon · ficha 4455</a></div>',
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
