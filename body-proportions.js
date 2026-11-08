/* PAIVA: perfil descritivo para o cliente, sem classificação normativa. */
(() => {
  'use strict';
  const definitions = [
    ['inseam','Entreperna','Ajuda a contextualizar a posição do selim e o espaço para pedalar.'],
    ['torso','Tronco líquido','Participa da análise da inclinação do tronco e da distância até os apoios.'],
    ['arm','Braço líquido','Participa da avaliação do alcance até o guidão ou os apoios.']
  ];
  const explanation = 'Cada porcentagem compara uma medida com a estatura. São proporções independentes e não devem ser somadas para chegar a 100%. A entreperna é uma referência do protocolo, não o comprimento anatômico total da perna.';
  const meaning = 'Pessoas da mesma altura podem precisar de posições diferentes. Estas medidas ajudam a orientar a avaliação; os ajustes são confirmados pelo movimento, pelos apoios e pelo conforto na bicicleta.';
  const number = id => {
    const raw = document.getElementById(id)?.value?.trim().replace(',','.');
    const n = Number(raw);
    return raw && Number.isFinite(n) && n > 0 ? n : null;
  };
  const format = n => n.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  function getReport() {
    const height = number('height');
    const metrics = definitions.map(([key,label,description]) => {
      const length = number(key);
      const valid = height !== null && height >= 140 && height <= 215 && length !== null && length < height;
      return {label,description,length:valid?length:null,percent:valid?100*length/height:null};
    });
    return {height,metrics,explanation,meaning,
      conclusion:document.getElementById('paiva-proportions-conclusion')?.value.trim() || ''};
  }
  function content(data) {
    const box = document.createElement('div');
    const grid = document.createElement('div');grid.className='paiva-proportion-grid';
    for (const metric of data.metrics) {
      const card=document.createElement('div');card.className='paiva-proportion-metric';
      for (const [tag,text] of [['h3',metric.label],['strong',metric.percent===null?'—':format(metric.percent)+'%'],['span',metric.length===null?'Informe estatura e medida válidas':format(metric.length)+' cm · em relação à estatura'],['p',metric.description]]) {
        const node=document.createElement(tag);node.textContent=text;card.append(node);
      }
      grid.append(card);
    }
    box.append(grid);
    const chart=document.createElement('div');chart.className='paiva-proportion-chart';
    const heading=document.createElement('div');heading.className='paiva-chart-heading';heading.textContent='PROPORÇÕES EM RELAÇÃO À ESTATURA';chart.append(heading);
    for(const metric of data.metrics){
      const line=document.createElement('div');line.className='paiva-chart-line';
      const name=document.createElement('span');name.textContent=metric.label;
      const track=document.createElement('div');track.className='paiva-chart-track';
      const fill=document.createElement('div');fill.className='paiva-chart-fill';
      fill.style.width=(metric.percent===null?0:Math.max(0,Math.min(100,metric.percent)))+'%';track.append(fill);
      const value=document.createElement('strong');value.textContent=metric.percent===null?'—':format(metric.percent)+'%';
      line.append(name,track,value);chart.append(line);
    }
    const note=document.createElement('small');note.textContent='Escala visual: 0 a 100% da estatura · medidas independentes';chart.append(note);
    box.append(chart);
    for (const text of [data.explanation,data.meaning]) {const p=document.createElement('p');p.textContent=text;box.append(p);}
    return box;
  }
  function initialize() {
    const anthro=document.querySelector('.layout > section.card:has(#fields)');
    const footer=document.querySelector('main > footer');if(!anthro || !footer)return;
    const panel=document.createElement('section');panel.className='card paiva-proportions';
    panel.innerHTML='<h2>Suas proporções e a posição na bicicleta</h2><p class="paiva-proportion-intro">Prévia da informação que acompanha o relatório do cliente.</p><div id="paiva-proportions-preview"></div><label for="paiva-proportions-conclusion">Conclusão do avaliador para este atendimento</label><textarea id="paiva-proportions-conclusion" rows="4" maxlength="1500" placeholder="Registre o que observou, os ajustes realizados e o que confirmou na avaliação."></textarea><small>Texto opcional, incluído no PDF. Mantido apenas nesta página; ao iniciar outro atendimento, limpe este campo.</small>';
    anthro.after(panel);
    // A proporção ocupa uma linha completa entre antropometria e dados da bicicleta.
    panel.style.gridColumn='1 / -1';
    const css=document.createElement('style');css.textContent=`
      .paiva-proportions{margin-top:0;color:#e5e8ec}.paiva-proportions p{font-size:12px;line-height:1.65;color:#bac2ca}
      .layout > .paiva-proportions{grid-column:1 / -1;min-width:0}
      .paiva-proportion-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
      .paiva-proportion-metric{padding:11px;border:1px solid #4a525b;border-radius:10px;background:#161b21}
      .paiva-proportion-metric h3{font-size:11px;margin:0 0 6px}.paiva-proportion-metric strong{display:block;font-size:23px;letter-spacing:-.03em;color:#edf0f3}
      .paiva-proportion-metric span{display:block;margin-top:3px;font-size:10px;color:#b7c0c9}.paiva-proportion-metric p{margin-bottom:0}
      .paiva-proportion-chart{border:1px solid #353d45;border-radius:10px;background:#10151b;padding:12px 14px;margin:9px 0}
      .paiva-chart-heading{font-size:10px;letter-spacing:.1em;color:#b6c0ca;margin-bottom:9px}
      .paiva-chart-line{display:grid;grid-template-columns:95px minmax(0,1fr) 48px;gap:10px;align-items:center;margin:8px 0;font-size:11px;color:#d7dce1}
      .paiva-chart-track{height:7px;background:#303842;border-radius:10px;overflow:hidden}
      .paiva-chart-fill{height:100%;background:#c3a64a;border-radius:10px;transition:width .2s ease}
      .paiva-chart-line strong{font-size:11px;font-weight:500;text-align:right;color:#e5e8ec}
      .paiva-proportion-chart small{font-size:9px;margin-top:9px;color:#8e9aa5}
      .paiva-proportions label{display:block;font-size:13px;margin:20px 0 8px}.paiva-proportions textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #65717d;border-radius:10px;background:#0e1319;color:#edf0f3;font:inherit;resize:vertical}
      .paiva-proportions small{display:block;font-size:11px;line-height:1.6;color:#aeb8c2;margin-top:7px}
      @media(max-width:640px){.paiva-proportion-grid{grid-template-columns:1fr;gap:6px}.paiva-proportion-metric{padding:9px 11px}.paiva-proportion-metric p{display:none}.paiva-proportion-metric strong{font-size:20px}.paiva-chart-line{grid-template-columns:86px minmax(0,1fr) 44px;gap:7px}}
      @media print{main>.paiva-proportions{display:none!important}#reportProportions{break-inside:avoid;margin:16px 0}#reportProportions .paiva-proportion-metric{background:#fff;color:#20252b;border:1px solid #bcc4cb;padding:10px}#reportProportions strong{color:#20252b;font-size:24px}#reportProportions p,#reportProportions span{color:#454e57;font-size:9pt}#reportProportions h2{font-size:12pt}}`;
    document.head.append(css);
    const printSection=document.createElement('section');printSection.id='reportProportions';
    const warning=document.querySelector('#clientReport .report-warning');warning?.before(printSection);
    function render() {
      const data=getReport();document.getElementById('paiva-proportions-preview').replaceChildren(content(data));
      const heading=document.createElement('h2');heading.textContent='Suas proporções e a posição na bicicleta';
      printSection.replaceChildren(heading,content(data));
      if(data.conclusion){const p=document.createElement('p');const b=document.createElement('strong');b.textContent='Conclusão do avaliador: ';p.append(b,document.createTextNode(data.conclusion));printSection.append(p);}
    }
    document.addEventListener('input',render);document.addEventListener('change',render);window.addEventListener('beforeprint',render);render();
  }
  globalThis.PAIVA_PROPORTIONS={getReport};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
