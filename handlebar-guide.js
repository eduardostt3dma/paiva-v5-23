/* PAIVA · Triagem conservadora de largura de guidão, separada por modalidade.
   Valores empíricos editáveis em versões futuras, não prescrição clínica. */
(() => {
  'use strict';
  const clamp=(x,low,high)=>Math.min(high,Math.max(low,x));
  function recommend(shoulderCm,mode) {
    if(mode==='tt')return {
      label:'Apoios aerodinâmicos TT',value:'Ajuste individual',
      detail:'Em TT/triathlon, o espaçamento dos apoios dos antebraços e a posição das extensões não devem ser derivados de uma regra simples de largura de ombros. Avalie ângulos, conforto, estabilidade e aerodinâmica no fit dinâmico.'
    };
    const shoulderMm=Number(shoulderCm)*10;
    if (!Number.isFinite(shoulderMm) || shoulderMm<250 || shoulderMm>650)
      return {label:mode==='mtb'?'Guidão MTB · largura total':mode==='tt'?'Apoios aerodinâmicos TT':'Guidão Road · centro a centro',value:'—',detail:'Informe a largura dos ombros, medida entre os acrômios (em centímetros).'};
    if(mode==='mtb') {
      // 440 mm de ombros -> faixa de 720–740 mm. Faixa estreita por opção
      // profissional de triagem XC/MTB; não se aplica a todas as modalidades.
      const high=clamp(740+Math.round((shoulderMm-440)/40)*10,680,740);
      return {
        label:'Guidão MTB · largura total',value:`${high-20}–${high} mm`,
        detail:`Ombros: ${Math.round(shoulderMm)} mm. Faixa de triagem XC/MTB proposta pelo profissional, medida de ponta a ponta. Não é fórmula científica universal. Conferir largura efetiva das manoplas, backsweep, rise, estabilidade, controle, terreno e preferência do ciclista.`
      };
    }
    if(mode==='road') {
      const high=clamp(Math.round(shoulderMm/20)*20,360,460);
      return {
        label:'Guidão Road · centro a centro',value:`${high-20} ou ${high} mm`,
        detail:`Ombros: ${Math.round(shoulderMm)} mm. Duas larguras comerciais para testar: uma próxima à medida biacromial e outra 20 mm mais estreita. Conferir referência centro a centro do fabricante (capas, drops e flares podem diferir), apoio no STI, mobilidade, controle, respiração e conforto. Não é prescrição automática.`
      };
    }
    return {label:'Guidão',value:'—',detail:'Selecione Road, MTB ou TT.'};
  }

  function render() {
    const results=document.getElementById('results');
    if(!results)return;
    for(const old of [...results.querySelectorAll('.result')]) {
      const label=old.querySelector('.head span')?.textContent||'';
      if(old.classList.contains('paiva-hbar-result') || label.startsWith('Largura do guidão'))old.remove();
    }
    const mode=document.querySelector('.mode [data-mode].active')?.dataset.mode || 'road';
    const value=document.getElementById('shoulder')?.value;
    const advice=recommend(value?.trim()?Number(value):NaN,mode);
    const section=document.createElement('div');
    section.className='result paiva-hbar-result';
    const head=document.createElement('div');head.className='head';
    const title=document.createElement('span');title.textContent=advice.label;
    const number=document.createElement('strong');number.textContent=advice.value;
    const help=document.createElement('button');help.type='button';help.className='paiva-hbar-help';
    help.textContent='?';help.setAttribute('aria-label','Como interpretar a largura do guidão');help.setAttribute('aria-expanded','false');
    const detail=document.createElement('small');detail.hidden=true;detail.className='paiva-hbar-detail';detail.textContent=advice.detail;
    head.append(title,number,help);section.append(head,detail);results.append(section);
  }

  function initialize() {
    const renderReport=()=>{
      render();
      if(typeof globalThis.fillClientReport==='function')globalThis.fillClientReport();
    };
    renderReport();
    // O aplicativo tem ouvintes próprios de inputs registrados antes deste
    // módulo; a fase de borbulhamento do documento roda depois deles.
    document.addEventListener('input',renderReport);
    document.addEventListener('click',event=>{
      const button=event.target.closest('.paiva-hbar-help');
      if(!button) {
        if(event.target.closest('[data-mode], #reset'))renderReport();
        return;
      }
      const detail=button.closest('.paiva-hbar-result')?.querySelector('.paiva-hbar-detail');
      if(!detail)return;
      detail.hidden=!detail.hidden;
      button.setAttribute('aria-expanded',String(!detail.hidden));
    });
  }
  globalThis.PAIVA_HANDLEBAR_GUIDE={recommend};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
