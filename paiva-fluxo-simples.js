/* PAIVA · orientação de fluxo sem alterar motores de vídeo, cálculos ou PDF. */
(()=>{'use strict';
 function init(){
  const station=document.getElementById('paiva-multi-camera');
  const analysis=document.getElementById('paiva-athlete-2d');
  const main=document.querySelector('main');
  const measures=document.getElementById('bikeFields')?.closest('.card');
  if(station&&analysis){
   if(!document.getElementById('paiva-simple-station-guide')){
    const guide=document.createElement('p');guide.id='paiva-simple-station-guide';guide.className='paiva-simple-guide';
    guide.innerHTML='<strong>CAMINHO:</strong> 1. Detectar webcams → 2. Escolher câmera A e B → 3. Ligar → 4. Gravar → 5. Parar → 6. <a href="#paiva-athlete-2d">Analisar no 2D ↓</a><br><small>Até 4 webcams disponíveis para escolher; 2 visores ativos. Troque a câmera nos seletores A/B. Depois de gravar, clique em “Analisar no 2D” no visor correspondente. Salve também o vídeo para manter uma cópia.</small>';
    station.querySelector('.paiva-multi-heading')?.after(guide);
   }
   if(!document.getElementById('paiva-simple-analysis-guide')){
    const guide=document.createElement('p');guide.id='paiva-simple-analysis-guide';guide.className='paiva-simple-guide';
    guide.innerHTML='<strong>CAMINHO:</strong> <a href="#paiva-multi-camera">↑ Voltar às câmeras / trocar webcam</a> · Para analisar: grave no Visor A ou B e clique em “Analisar no 2D”.';
    analysis.prepend(guide);
   }
  }
  if(main&&measures&&!measures.dataset.paivaLast){
    // Medidas finais devem ser a última etapa visual do atendimento, após o Vulto de Postura.
    const finalSection=document.createElement('section');
    finalSection.id='paiva-medidas-finais';finalSection.className='paiva-final-measures';
    const note=document.createElement('p');note.className='paiva-simple-guide';
    note.innerHTML='<strong>ÚLTIMA ETAPA DO BIKE FIT</strong> · Registre aqui as medidas finais da bicicleta, depois da comparação de postura.';
    finalSection.append(note,measures);
    main.append(finalSection);
    measures.dataset.paivaLast='true';
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();setTimeout(init,300);},{once:true});else{init();setTimeout(init,300);}
})();
