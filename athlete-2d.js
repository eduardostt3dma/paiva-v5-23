/* PAIVA — análise 2D em fotografia ou quadro de vídeo, 100% local.
   Marcação manual e rastreio fino semiautomático quadro a quadro.
   Não faz reconhecimento anatômico automático nem reconstrução 3D. */
(() => {
  'use strict';

  function angleDegrees(a, vertex, c) {
    if(!a||!vertex||!c||![a.x,a.y,vertex.x,vertex.y,c.x,c.y].every(Number.isFinite))return null;
    const ux = a.x - vertex.x, uy = a.y - vertex.y;
    const vx = c.x - vertex.x, vy = c.y - vertex.y;
    const uLength = Math.hypot(ux,uy), vLength = Math.hypot(vx,vy);
    if (uLength < 8 || vLength < 8) return null;
    return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(uLength*vLength)))) * 180 / Math.PI;
  }

  // Oito referências conectadas, na ordem do membro superior até o pé.
  // O eixo do pé usa calcanhar -> antepé comparado à horizontal do solo;
  // não depende da inclinação da tíbia nem da posição do pedivela.
  const FULL8_POINTS=['Punho','Cotovelo lateral','Ombro / acrômio',
    'Quadril / trocânter maior','Joelho / côndilo lateral',
    'Tornozelo / maléolo lateral','Antepé / metatarso','Calcanhar'];
  function horizontalInclination(a,b){
    const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    return Math.hypot(dx,dy)<8?null:Math.atan2(dy,dx)*180/Math.PI;
  }
  // Diferente do tronco, a inclinação pé/solo precisa mostrar o SINAL:
  // positivo quando o metatarso está acima do calcanhar, negativo abaixo.
  // O eixo é a horizontal da imagem, não a linha da tíbia.
  function footInclination(heel,metatarsal){
    if(!heel||!metatarsal||![heel.x,heel.y,metatarsal.x,metatarsal.y].every(Number.isFinite))
      return null;
    const dx=Math.abs(metatarsal.x-heel.x),dy=heel.y-metatarsal.y;
    return Math.hypot(dx,dy)<8?null:Math.atan2(dy,dx)*180/Math.PI;
  }
  function full8Measurements(points){
    if(points.length!==8)return null;
    const angle=(a,b,c)=>angleDegrees(points[a],points[b],points[c]);
    return {elbow:angle(0,1,2),shoulder:angle(1,2,3),
      hip:angle(2,3,4),knee:angle(3,4,5),ankle:angle(4,5,6),
      trunk:horizontalInclination(points[2],points[3]),
      foot:footInclination(points[7],points[6])};
  }
  // O boneco já nasce montado. A forma inicial é apenas um guia visual:
  // Paiva posiciona o conjunto, depois refina cada articulação pelo mouse.
  function full8Template(width,height){
    const outline=[[.25,.46],[.36,.36],[.42,.19],[.65,.43],
      [.53,.65],[.58,.86],[.66,.89],[.55,.91]];
    return outline.map(([x,y])=>({x:x*width,y:y*height}));
  }
  // Busca local por um núcleo luminoso cercado de pixels mais escuros.
  // Não confunde isso com reconhecimento anatômico: falhas não movem o ponto.
  function reflectorNear(image,target,radius,excluded=[]){
    const {data,width:w,height:h}=image;
    if(!data||!(w>28&&h>28))return null;
    const light=(x,y)=>{
      const k=(y*w+x)*4;
      return data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722;
    };
    const minX=Math.max(13,Math.round(target.x-radius));
    const maxX=Math.min(w-14,Math.round(target.x+radius));
    const minY=Math.max(13,Math.round(target.y-radius));
    const maxY=Math.min(h-14,Math.round(target.y+radius));
    let best=null,score=-Infinity;
    for(let y=minY;y<=maxY;y+=2)for(let x=minX;x<=maxX;x+=2){
      const dist=Math.hypot(x-target.x,y-target.y);
      if(dist>radius||excluded.some(p=>Math.hypot(x-p.x,y-p.y)<14))continue;
      const center=light(x,y);
      if(center<205)continue;
      const ring=(light(x-12,y)+light(x+12,y)+light(x,y-12)+light(x,y+12)+
        light(x-9,y-9)+light(x+9,y-9)+light(x-9,y+9)+light(x+9,y+9))/8;
      const contrast=center-ring;
      if(contrast<53)continue;
      const rank=contrast-dist*.32;
      if(rank>score){score=rank;best={x,y};}
    }
    if(!best)return null;
    let sx=0,sy=0,total=0;
    for(let y=Math.max(0,best.y-4);y<=Math.min(h-1,best.y+4);y++)
      for(let x=Math.max(0,best.x-4);x<=Math.min(w-1,best.x+4);x++){
        const brightness=light(x,y);
        if(brightness<190)continue;
        const weight=brightness-180;
        sx+=x*weight;sy+=y*weight;total+=weight;
      }
    return total>0?{x:sx/total,y:sy/total}:best;
  }
  function stableFull8Measurements(item){
    const measured=full8Measurements(item.points);
    if(!measured)return null;
    const cached=item.lastReadings&&typeof item.lastReadings==='object'?item.lastReadings:{};
    const readings={};
    for(const [key,value] of Object.entries(measured)){
      if(Number.isFinite(value))cached[key]=value;
      readings[key]=Number.isFinite(value)?value:Number.isFinite(cached[key])?cached[key]:null;
    }
    item.lastReadings=cached;
    return readings;
  }
  function kneeReading(item){
    if(item?.kind==='full8')return stableFull8Measurements(item)?.knee??null;
    if(item?.kind==='angle'&&item.points.length===3){
      const angle=angleDegrees(...item.points);
      if(angle!==null)item.lastValidAngle=angle;
      return angle??(Number.isFinite(item.lastValidAngle)?item.lastValidAngle:null);
    }
    return null;
  }

  function initialize() {
    if (document.getElementById('paiva-athlete-2d')) return;
    const target = document.querySelector('main > footer');
    if (!target) return;

    const section = document.createElement('section');
    section.className = 'card paiva-athlete-2d';
    section.id = 'paiva-athlete-2d';
    section.innerHTML = `
      <div class="paiva-2d-title">
        <div><span>FERRAMENTA COMPLEMENTAR</span><h2>ANÁLISE ANGULAR 2D</h2></div>
        <div class="paiva-2d-title-actions">
          <button type="button" id="paiva-2d-fit" title="Mostrar a foto inteira sem barras de rolagem">▣ Ajustar foto</button>
          <button type="button" id="paiva-2d-wide" aria-pressed="false" title="Ampliar a área de análise">⛶ Tela ampla</button>
          <button type="button" id="paiva-2d-help" aria-label="Como medir ângulos e linhas" aria-expanded="false">?</button>
        </div>
      </div>
      <div id="paiva-2d-explain" class="paiva-2d-explain" hidden>
        <p><strong>Ângulo direto por três pontos:</strong> com a ferramenta Ângulo selecionada, clique no trocânter maior, depois no côndilo lateral (vértice) e finalmente no maléolo. Os três pontos aparecem no momento do clique e podem ser arrastados diretamente, sem trocar para Ajustar pontos. Esc cancela uma marcação incompleta. Como alternativa, clique e arraste para abrir as duas hastes de uma vez; depois puxe cada extremidade livremente.</p>
        <p><strong>Boneco pronto · 8 pontos:</strong> ao clicar no botão azul, aparece um boneco articulado inteiro na foto ou no quadro congelado. Arraste uma linha para mover o conjunto, ou uma bolinha para acertar cada plug refletivo. Use Espelhar ou −/+ para adaptar as proporções. “Encaixar refletores” procura pequenos pontos brilhantes próximos das bolinhas e ativa uma tentativa adicional de rastrear esses reflexos quadro a quadro. NÃO identifica articulações por IA: confira cada encaixe, corrija os laranjas e não confunda brilhos na bike com marcadores anatômicos. A alternativa “Marcar 8 um a um” continua disponível. O joelho usa quadril, côndilo e maléolo. O pé usa somente calcanhar e metatarso contra a horizontal do solo, sem usar a tíbia. Mesmo com falha no rastreio, os últimos valores continuam visíveis como referência provisória.</p>
        <p><strong>Ângulo suplementar:</strong> clique diretamente na etiqueta “A 35°”, por exemplo, para alternar entre 35° e 145° (180° − 35°). A geometria das hastes não muda, somente a convenção mostrada. Confirme qual convenção está usando no laudo.</p>
        <p><strong>Linha:</strong> clique e arraste de uma extremidade até a outra. Depois, “Ajustar pontos” permite puxar as pontas ou mover a reta inteira pelo centro. Sem calibração métrica, não é uma régua em milímetros.</p>
        <p><strong>Desenhar curva:</strong> o botão “✎ Desenhar curva” abre uma camada independente. Clique em diversos pontos da imagem, arraste as bolinhas para deixar o contorno maleável e escolha “Concluir curva”. Você pode desenhar outras curvas sem apagar as anteriores, ou voltar aos ângulos desligando “Desenhar curva”. A foto PNG exportada inclui essas curvas; elas são uma anotação visual, não um rastreio anatômico.</p>
        <p><strong>Alinhamento ao solo:</strong> segure Shift enquanto desenha ou move uma ponta para deixá-la exatamente na mesma altura da referência (linha horizontal de 0°). Isso vale também para qualquer haste de um ângulo de três pontos: a outra haste permanece livre para medir a inclinação real do pé. Shift nunca força a vertical nem um ângulo de 90°.</p>
        <p><strong>Excluir vários registros:</strong> abra “Fotos, vídeos e análises salvos”, marque os arquivos desejados ou “Selecionar tudo” e clique em “Excluir selecionados”. Uma confirmação evita exclusões acidentais. Essa limpeza é definitiva neste navegador; baixe antes as análises que queira conservar.</p>
        <p><strong>Rodinha do mouse:</strong> sobre o vídeo ou sobre um quadro capturado, gire para avançar ou voltar um quadro da pedalada. A página permanece parada. Em fotos independentes, use Ctrl + rodinha para o zoom. No quadro de vídeo capturado, a nova opção “Seguir pontos por quadro” tenta deslocar os marcadores automaticamente; quando um ponto se perder, corrija-o com o mouse. Com essa opção desligada, as marcações permanecem fixas.</p>
        <p><strong>Mouse e teclado:</strong> com o mouse sobre o vídeo, o botão DIREITO alterna pausar/reproduzir, sem abrir o menu do navegador. A tecla Espaço também alterna play/pause; K pausa, L reproduz e as setas ← / → mudam um quadro. Atalhos não são aplicados enquanto você digita em campos ou usa seletores.</p>
        <p><strong>Congelar com clique:</strong> no vídeo gravado, clique com o botão ESQUERDO sobre a imagem para pausar e capturar automaticamente o quadro atual; as ferramentas compactas ficam logo abaixo. Com o quadro capturado, você pode marcar ou editar os pontos.</p>
        <p><strong>Zoom:</strong> a análise abre centralizada em 175% para facilitar os pontos. O controle varia de 5% em 5%, incluindo 175% e 180%, até 400%. Clique em “Ajustar foto” ou “100%” para ver toda a imagem.</p>
        <p><strong>Qualidade da imagem:</strong> o quadro congelado preserva até Full HD (1920 × 1080, quando a fonte oferece essa resolução). Para filmar pela webcam, escolha Alta nitidez (solicita Full HD/até 60 fps e grava com menos compressão) ou Leve (HD/até 30 fps). O navegador negocia o que a câmera realmente suporta; confira resolução e fps mostrados após ligar. O rastreio usa uma amostra de até 1280 px, sem ampliar artificialmente o vídeo. Iluminação forte e exposição curta, quando ajustável na câmera, reduzem o borrão dos refletores. A opção de alta nitidez gera arquivos maiores e não melhora vídeos já gravados.</p>
        <p><strong>Enquadramento:</strong> em 100%, a foto inteira se ajusta automaticamente à altura e largura visíveis, sem precisar rolar a imagem. O botão “Ajustar foto” restaura esse enquadramento. “Tela ampla” esconde temporariamente o painel lateral e ocupa a janela para analisar com mais espaço. Saia pela mesma tecla ou Esc. O zoom acima de 100% volta a permitir deslocamento intencional para ver detalhes.</p>
        <p><strong>Marcar sem capturar:</strong> com um vídeo carregado, escolha Ângulo, Linha ou Ponto (as ferramentas ficam sempre visíveis). Clique e arraste diretamente no atleta: o vídeo congela naquele instante automaticamente e a marcação já começa com o mouse pressionado. Um clique simples também congela para você ajustar os pontos em seguida. O tamanho da imagem é mantido ao alternar do vídeo para o quadro congelado.</p>
        <p><strong>Régua de recorte:</strong> abaixo do vídeo, arraste as duas alças da régua — início e fim — até o trecho desejado. O botão “✂ Salvar trecho” gera o novo MP4 local, preservando o original. O ícone 📷 tira uma foto do quadro e salva um PNG com as marcações que estiverem visíveis.</p>
        <p><strong>Linhas e tamanho dos pontos:</strong> o único controle de 1 a 20 aumenta ou diminui tanto a espessura das linhas quanto os círculos dos pontos de ângulos, linhas e rastros. Você pode deixá-los bem maiores para enxergar a referência.</p>
        <p><strong>Webcam:</strong> no computador, libere o acesso à câmera para visualizar e filmar o pedal. Grave até 3 minutos ou clique e arraste diretamente no quadro da webcam para congelar e marcar. Não é mais obrigatório apertar “Capturar quadro”. Os pontos iniciais são sempre marcados manualmente.</p>
        <p><strong>Vídeos antigos:</strong> use “Abrir vídeo do computador ou pendrive” para carregar MP4, WebM, MOV e outros formatos que seu navegador consiga decodificar. Pause num quadro, capture e analise com as mesmas ferramentas; nenhum arquivo é enviado à internet.</p>
        <p><strong>2D manual · V5.59:</strong> a régua de tempo fica sempre visível debaixo do vídeo carregado. Arraste-a até o instante desejado e clique em "Pausar e marcar". Abaixo, escolha textura, adesivo colorido ou brilho refletivo. O seletor de região mostra somente os pontos daquele segmento, mas guarda os oito originais para voltar a qualquer momento. Os nomes dos ângulos ficam afastados dos marcadores. Use ◀ e ▶ um quadro por vez; o FPS selecionado é uma aproximação para vídeos importados. A IA experimental continua preservada.</p>
        <p><strong>Recortar vídeo:</strong> na coluna lateral, abra “✂ Recortar trecho do vídeo”. Marque início e fim pelo tempo atual ou digite mm:ss (ex.: 00:15 a 02:00). “Recortar e salvar MP4” gera um novo arquivo de até 3 minutos pelo motor de vídeo local; a filmagem original não é alterada. Esse processamento pode levar alguns minutos.</p>
        <p><strong>Seis cores:</strong> sob o quadro capturado, escolha vermelho, branco, verde, roxo, azul ou âmbar antes de desenhar o ângulo. Para mudar a cor de um ângulo existente, selecione-o com “Ajustar pontos” e escolha outra cor.</p>
        <p><strong>Registro automático:</strong> cada quadro capturado é arquivado como foto PNG com as linhas e ângulos, e atualizado quando você terminar de ajustá-los. As gravações de webcam e os vídeos recortados também vão para “Fotos e vídeos salvos”. Tudo permanece no armazenamento deste navegador, não em uma pasta permanente do Windows. Abra a lista e clique em Baixar para fazer suas cópias de segurança; limpar dados do navegador pode apagar os registros.</p>
        <p><strong>Repetir vídeo:</strong> com essa opção marcada, o vídeo chega ao fim, volta diretamente ao começo e continua pedalando para a frente, quantas vezes você quiser. Não existe reprodução de ré. Desmarque para que o vídeo pare ao terminar, ou clique em Pausar a qualquer momento.</p>
        <p><strong>Extensão em trecho curto:</strong> capture um quadro próximo da extensão máxima e marque os três pontos anatômicos. Use “Buscar extensão” para examinar um intervalo curto antes e depois daquele instante, procurando o maior valor na convenção angular escolhida. O rastreio é experimental e pode interromper em áreas sem contraste; é uma prévia a validar manualmente, não uma medição clínica autônoma.</p>
        <p><strong>Seguir marcações em vídeo:</strong> depois de congelar um quadro do vídeo gravado, desenhe e alinhe as marcações. O comando avançado “Seguir marcações no vídeo” tenta acompanhá-las durante a reprodução. Se perder a referência, interrompe; não reconhece articulações e pode sofrer desvios. Use marcadores contrastantes, câmera fixa e valide cada ângulo antes de usar no bike fit.</p>
        <p><strong>Seguir pontos ao reproduzir:</strong> após capturar e marcar o quadro, escolha Voltar ao vídeo e Reproduzir. Com essa opção ativa, o rastreio assistido tenta acompanhar os pontos já desenhados, inclusive no retorno. Se perder algum marcador, a análise é interrompida para evitar um ângulo enganoso. Reposicione os pontos e recomece do quadro correto.</p>
        <p><strong>Ponto de trajetória:</strong> escolha “PONTO LIVRE · RASTREAR” e clique em qualquer referência visível. Ajuste o controle separado “Tamanho do ponto livre” de 4 a 36 px, sem alterar as linhas nem os outros pontos. Em “↗ Traçar ponto”, escolha um intervalo curto para desenhar o caminho sobre o atleta. Não exibimos medidas horizontais/verticais: a finalidade é ver a trajetória. Distâncias reais exigirão calibração posterior.</p>
        <p><strong>Rastreio ON/OFF:</strong> marque ou selecione um Ângulo, Linha ou Ponto na imagem e clique em “Rastreio ON/OFF” para ativar ou desativar o acompanhamento desta marcação. Uma linha tem duas pontas, um ângulo tem três pontos e um ponto isolado tem um; cada ferramenta respeita a escolha.</p>
        <p><strong>Análises guardadas pelo tempo:</strong> ao concluir as marcações, o aplicativo registra o instante do vídeo e o desenho. Ao voltar com a régua ou a rodinha ao mesmo quadro, a análise reaparece para continuar editando. Fotos e a lista de instantes são armazenadas neste navegador. O MP4 original e os recortes continuam arquivos de vídeo limpos: as marcações ficam no projeto local salvo separadamente, não são incorporadas aos pixels do MP4 nesta versão.</p>
        <p><strong>Não perder o ângulo nem a correção:</strong> se o rastreador perder um ponto, o ângulo permanece visível na última posição conhecida, com os marcadores incertos em laranja. Corrija-os manualmente antes de interpretar o valor. Ao voltar a um quadro já corrigido, o programa restaura exatamente os pontos que você deixou naquele instante, sem substituir sua medição pela estimativa automática. Em quadros novos, o desenho anterior continua visível apenas como referência provisória, até você ajustá-lo. A referência angular é guardada com o projeto para reaparecer ao reabrir o mesmo vídeo.</p>
        <p><strong>Rastreio fino (estilo de trabalho do Kinovea):</strong> congele o quadro próximo ao pedivela em 178°–180° e marque trocânter, côndilo e maléolo; opcionalmente, marque calcanhar e quadril. Com “Seguir pontos por quadro” ativado, gire a rodinha ou use ◀/▶ para mover somente UM quadro e atualizar cada marcador. Se uma referência escapar, ela permanece na posição anterior, sinalizada para corrigir: arraste o ponto diretamente na foto e continue com a rodinha. Não há necessidade de percorrer uma volta inteira. Em “Ajustes do rastreio” escolha o tamanho do alvo e a área de busca em pixels; a visualização das janelas é opcional. Os três marcos do ângulo são rastreados separadamente, mas exigem conferência visual. O método é implementação independente, não código do Kinovea.</p>
        <p><strong>Cursor e exclusão:</strong> sobre qualquer ponto, ângulo ou linha, o cursor permanece em cruz. Clique com o botão DIREITO sobre uma marcação para abrir “Excluir”, ou selecione a marcação e use “✕ Excluir” ao lado de Rastreio ON/OFF. Ao excluir uma marcação rastreada, o sistema remove o mesmo rastro dos quadros salvos do vídeo, sem trazer o ponto de volta ao girar a rodinha. “Desfazer” recupera o registro removido. Fora da marcação, o botão direito controla pausa/play.</p>
        <p><strong>Rastrear um ponto isolado:</strong> escolha “PONTO · RASTRO”, marque um ponto onde desejar, ligue o rastreio e use a rodinha do mouse para acompanhá-lo e desenhar o pequeno trajeto, mesmo sem ângulo desenhado. Se perder a referência, arraste-o de volta e continue.</p>
        <p><strong>Rastreio de ponto melhorado:</strong> se a primeira correspondência de textura não localizar um marcador isolado, o programa tenta também a comparação de brilho com verificação de ida e volta, já usada no ciclo da pedalada. Ele interrompe o traçado quando não há correspondência suficientemente segura; não inventa o caminho.</p>
        <p><strong>Rastrear uma pedalada (alternativa avançada):</strong> o antigo comando “⟳ Rastrear 1 giro” continua disponível nas opções avançadas, mas para identificar a extensão máxima perto de 180° do pedivela prefira o rastreio fino quadro a quadro, corrigindo os pontos quando necessário.</p>
        <p><strong>Biomecânica:</strong> no joelho, uma referência possível é trocânter maior → côndilo femoral lateral → maléolo lateral. Escolha sempre a mesma convenção de pontos e o mesmo plano da câmera. A foto mostra uma projeção 2D, não captura rotação, profundidade nem movimento.</p>
        <p>O processamento ocorre neste aparelho. Imagens e vídeos não são transmitidos ao site ou ao GitHub. Salve a imagem marcada e o vídeo antes de fechar ou atualizar o aplicativo. Webcam exige permissão do navegador e conexão segura (HTTPS ou localhost).</p>
      </div>
      <div class="paiva-2d-workspace">
        <div class="paiva-2d-view">
          <div class="paiva-2d-canvas-wrap"><canvas id="paiva-2d-canvas" width="960" height="540" aria-label="Foto ou quadro do vídeo com ângulos e linhas desenhados manualmente"></canvas>
            <video id="paiva-2d-video" playsinline muted hidden aria-label="Webcam ou vídeo gravado para análise 2D"></video>
            <canvas id="paiva-2d-track-overlay" width="480" height="270" hidden aria-label="Visualização do rastreamento semiautomático sobre o vídeo"></canvas>
            <div class="paiva-2d-cycle-results" id="paiva-2d-cycle-results" hidden aria-label="Resultados de um giro da pedalada">
              <span id="paiva-2d-cycle-summary">Resultados da pedalada</span>
              <button type="button" id="paiva-2d-cycle-show-max" title="Abrir quadro da extensão máxima">Ver extensão</button>
              <button type="button" id="paiva-2d-cycle-show-min" title="Abrir quadro da flexão máxima">Ver flexão</button>
              <button type="button" id="paiva-2d-cycle-correct" hidden title="Corrigir os pontos no último quadro rastreado">Corrigir pontos</button>
              <button type="button" id="paiva-2d-cycle-dismiss" aria-label="Fechar resultados">×</button>
            </div></div>
          <div class="paiva-2d-player-dock" aria-label="Controles do vídeo sob a imagem">
            <div class="paiva-2d-trim-ruler" id="paiva-2d-trim-ruler" aria-label="Régua de recorte por tempo">
              <span class="paiva-2d-trim-ruler-caption">✂ TRECHO</span>
              <button type="button" id="paiva-2d-ruler-toggle" title="Reproduzir ou pausar vídeo" aria-label="Reproduzir ou pausar vídeo">▶</button>
              <output id="paiva-2d-trim-ruler-start">00:00</output>
              <div id="paiva-2d-trim-ruler-track" class="paiva-2d-trim-ruler-track" aria-label="Arraste as alças de início e fim do vídeo">
                <div id="paiva-2d-trim-ruler-selected" class="paiva-2d-trim-ruler-selected"></div>
                <button type="button" data-2d-trim-handle="start" id="paiva-2d-trim-handle-start" aria-label="Arrastar início do recorte" title="Início do recorte"></button>
                <button type="button" data-2d-trim-handle="end" id="paiva-2d-trim-handle-end" aria-label="Arrastar fim do recorte" title="Fim do recorte"></button>
              </div>
              <output id="paiva-2d-trim-ruler-end">02:00</output>
              <button type="button" id="paiva-2d-trim-ruler-save" title="Recortar e salvar novo MP4">✂ Salvar trecho</button>
              <button type="button" id="paiva-2d-camera-shot" title="Fotografar quadro com ângulos">📷 Foto</button>
              <small id="paiva-2d-trim-ruler-status" aria-live="polite" hidden></small>
            </div>
          </div>
          <div class="paiva-2d-marking-dock" aria-label="Ferramentas de medição sob a imagem"></div>
          <div class="paiva-2d-angle-palette" role="group" aria-label="Seis cores para os ângulos">
            <span>Ângulos</span>
            <button type="button" data-angle-color="#f56b6b" title="Vermelho" aria-label="Ângulo vermelho"></button>
            <button type="button" data-angle-color="#f3f6fb" title="Branco" aria-label="Ângulo branco"></button>
            <button type="button" data-angle-color="#57d39a" title="Verde" aria-label="Ângulo verde"></button>
            <button type="button" data-angle-color="#b99cff" title="Roxo" aria-label="Ângulo roxo"></button>
            <button type="button" data-angle-color="#64cbff" title="Azul" aria-label="Ângulo azul"></button>
            <button type="button" data-angle-color="#ffca73" title="Âmbar" aria-label="Ângulo âmbar"></button>
            <small>Selecione a cor e desenhe; para recolorir, selecione um ângulo.</small>
          </div>
          <div class="paiva-2d-quick-actions" aria-label="Capturar quadro e seguir marcações"></div>
          <p class="paiva-2d-status" id="paiva-2d-status" role="status" aria-live="polite">Carregue uma foto lateral do atleta ou ligue a webcam.</p>
          <div class="paiva-2d-values" id="paiva-2d-values" aria-live="polite"></div>
        </div>
        <aside class="paiva-2d-sidebar" aria-label="Painel de ferramentas da análise 2D">
          <div class="paiva-2d-sidebar-heading">FERRAMENTAS 2D</div>
          <label class="paiva-2d-file">Foto lateral do atleta · JPG/PNG
            <input type="file" id="paiva-2d-file" accept="image/*" aria-label="Escolher foto do atleta para análise 2D" />
          </label>
          <div class="paiva-2d-tools" role="group" aria-label="Ferramenta de desenho">
            <button type="button" data-2d-tool="full8" aria-pressed="false">BONECO COMPLETO · 8 PONTOS</button>
            <small id="paiva-2d-full8-guide" class="paiva-2d-full8-guide" hidden></small>
            <div class="paiva-2d-full8-actions" id="paiva-2d-full8-actions" hidden>
              <button type="button" id="paiva-2d-full8-reflectors">◉ Encaixar refletores</button>
              <button type="button" id="paiva-2d-full8-mirror">↔ Espelhar</button>
              <button type="button" id="paiva-2d-full8-shrink">− Menor</button>
              <button type="button" id="paiva-2d-full8-grow">+ Maior</button>
              <button type="button" id="paiva-2d-full8-manual">Marcar 8 um a um</button>
            </div>
            <button type="button" data-2d-tool="angle" aria-pressed="true">ÂNGULO · ARRASTAR</button>
            <button type="button" data-2d-tool="line" aria-pressed="false">LINHA · ARRASTAR</button>
            <button type="button" data-2d-tool="point" aria-pressed="false">● PONTO LIVRE · RASTREAR</button>
            <button type="button" data-2d-tool="edit" aria-pressed="false">AJUSTAR PONTOS</button>
            <button type="button" id="paiva-2d-track-toggle" title="Rastreio ON/OFF da marcação selecionada">Rastreio ON</button>
            <button type="button" id="paiva-2d-delete-selected" title="Excluir esta marcação em todos os quadros deste vídeo" disabled>✕ Excluir</button>
            <button type="button" id="paiva-2d-photo-action" title="Foto com marcações" aria-label="Salvar foto do atleta com os ângulos">📷 Foto</button>
          </div>
          <label class="paiva-2d-point-role" id="paiva-2d-point-role-field" hidden>Rastrear ponto de
            <select id="paiva-2d-point-role" aria-label="Qual parte do atleta será rastreada">
              <option value="free" selected>Ponto livre</option>
            </select>
          </label>
          <div class="paiva-2d-zoom" role="group" aria-label="Zoom da fotografia">
            <label for="paiva-2d-zoom">Zoom <output id="paiva-2d-zoom-value">175%</output></label>
            <input id="paiva-2d-zoom" type="range" min="100" max="400" step="5" value="175" />
            <button type="button" id="paiva-2d-zoom-out">−</button>
            <button type="button" id="paiva-2d-zoom-reset">100%</button>
            <button type="button" id="paiva-2d-zoom-in">+</button>
          </div>
          <label class="paiva-2d-width" for="paiva-2d-width">Espessura das linhas e pontos anatômicos <output id="paiva-2d-width-value" for="paiva-2d-width">3 px</output>
            <input id="paiva-2d-width" type="range" min="1" max="20" step="1" value="3" aria-label="Espessura das linhas e pontos de ângulos" />
          </label>
          <label class="paiva-2d-width" for="paiva-2d-point-size">● Tamanho do ponto livre <output id="paiva-2d-point-size-value" for="paiva-2d-point-size">14 px</output>
            <input id="paiva-2d-point-size" type="range" min="4" max="36" step="1" value="14" aria-label="Diâmetro individual do ponto livre de rastreio" />
          </label>
          <div class="paiva-2d-actions">
            <button type="button" id="paiva-2d-undo">Desfazer</button>
            <button type="button" id="paiva-2d-clear">Limpar linhas</button>
            <button type="button" id="paiva-2d-save" class="paiva-2d-save">Salvar imagem marcada</button>
          </div>
          <div class="paiva-2d-webcam">
            <div class="paiva-2d-sidebar-heading">VÍDEO · ARQUIVO OU WEBCAM</div>
            <label class="paiva-2d-file">Abrir vídeo do computador ou pendrive
              <input type="file" id="paiva-2d-video-file" accept="video/*,.mp4,.mov,.webm,.m4v,.avi" aria-label="Importar vídeo local para análise quadro a quadro" />
            </label>
            <div class="paiva-2d-playback">
              <div class="paiva-2d-timeline">
                <output id="paiva-2d-time-current" for="paiva-2d-scrub">00:00,0</output>
                <input type="range" id="paiva-2d-scrub" aria-label="Posição no vídeo" min="0" max="1" step="0.01" value="0" disabled />
                <output id="paiva-2d-time-total" for="paiva-2d-scrub">00:00,0</output>
              </div>
              <label class="paiva-2d-pingpong"><input type="checkbox" id="paiva-2d-pingpong" checked /> ↻ Repetir vídeo continuamente</label>
              <label>Velocidade do vídeo
                <select id="paiva-2d-speed" aria-label="Velocidade de reprodução">
                  <option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option>
                  <option value="1" selected>1×</option><option value="1.5">1,5×</option>
                </select>
              </label>
              <div><button type="button" id="paiva-2d-play-video" disabled>▶ Reproduzir</button>
                <button type="button" id="paiva-2d-pause-video" disabled>⏸ Pausar</button></div>
              <label>Quadros por segundo do arquivo (para avançar manualmente)
                <select id="paiva-2d-file-fps"><option value="24">24 fps</option><option value="25">25 fps</option><option value="30" selected>30 fps</option><option value="50">50 fps</option><option value="60">60 fps</option><option value="100">100 fps</option><option value="120">120 fps</option></select>
              </label>
              <small class="paiva-2d-fps-advice">Selecione o FPS original. Em MP4/MOV o salto é aproximado e depende da precisão de busca do navegador; confirme sempre o quadro.</small>
              <small class="paiva-2d-wheel-hint">🖱 Rodinha: quadros · Direito: excluir ponto (área vazia: play/pause) · Espaço: play/pause · ← →: quadros</small>
            </div>
            <label class="paiva-2d-camera-quality">Qualidade da captação
              <select id="paiva-2d-camera-quality" aria-label="Qualidade da webcam">
                <option value="detail" selected>Alta nitidez · Full HD / até 60 fps</option>
                <option value="standard">Leve · HD / até 30 fps</option>
              </select>
            </label>
            <button type="button" id="paiva-2d-camera-start">Ligar webcam</button>
            <button type="button" id="paiva-2d-record" disabled>Iniciar gravação</button>
            <button type="button" id="paiva-2d-stop-record" disabled>Parar gravação</button>
            <button type="button" id="paiva-2d-capture" disabled>Capturar quadro</button>
            <button type="button" id="paiva-2d-back-video" hidden>Voltar ao vídeo</button>
            <button type="button" id="paiva-2d-track-start" disabled>▶ Começar rastreamento</button>
            <div class="paiva-2d-cycle-action" aria-label="Rastreamento de um giro de pedalada">
              <button type="button" id="paiva-2d-cycle-start" disabled title="Acompanhar o ângulo, o calcanhar e o quadril por uma volta">⟳ Rastrear 1 giro</button>
              <select id="paiva-2d-cycle-duration" aria-label="Duração aproximada de uma pedalada completa">
                <option value="0.6">0,60 s · 100 rpm</option>
                <option value="0.75" selected>0,75 s · 80 rpm</option>
                <option value="0.86">0,86 s · 70 rpm</option>
                <option value="1">1,00 s · 60 rpm</option>
                <option value="1.2">1,20 s · 50 rpm</option>
                <option value="1.5">1,50 s · 40 rpm</option>
              </select>
            </div>
            <div class="paiva-2d-short-scan">
              <button type="button" id="paiva-2d-scan-short" disabled>Buscar extensão ±0,5 s</button>
              <select id="paiva-2d-scan-radius" aria-label="Trecho para busca da extensão máxima">
                <option value="0.25">±0,25 s</option><option value="0.5" selected>±0,5 s</option><option value="1">±1 s</option>
              </select>
            </div>
            <button type="button" id="paiva-2d-track-stop" disabled>Parar rastreio</button>
            <details class="paiva-2d-trimmer"><summary>✂ Recortar trecho do vídeo</summary>
              <div class="paiva-2d-trim-inputs">
                <label>Início <input id="paiva-2d-trim-start" type="text" inputmode="numeric" value="00:00" placeholder="mm:ss" /></label>
                <label>Fim <input id="paiva-2d-trim-end" type="text" inputmode="numeric" value="02:00" placeholder="mm:ss" /></label>
              </div>
              <div class="paiva-2d-trim-buttons"><button type="button" id="paiva-2d-trim-mark-start">Marcar início</button>
                <button type="button" id="paiva-2d-trim-mark-end">Marcar fim</button></div>
              <button type="button" id="paiva-2d-trim-run">Recortar e salvar MP4</button>
              <a id="paiva-2d-trim-download" hidden>Baixar recorte MP4</a>
              <small id="paiva-2d-trim-status">O original é preservado. O recorte usa o motor local e pode demorar.</small>
            </details>
            <button type="button" id="paiva-2d-camera-stop" disabled>Desligar webcam</button>
            <a id="paiva-2d-video-download" hidden>Baixar vídeo gravado</a>
            <small id="paiva-2d-camera-info">Sem envio para a internet. Webcam requer permissão.</small>
            <details class="paiva-2d-records"><summary>▣ Fotos, vídeos e análises salvos <span id="paiva-2d-record-count"></span></summary>
              <small>Salvos automaticamente neste navegador, sem enviar ao site. Para guardar permanentemente, use Baixar; limpar dados do site pode apagá-los.</small>
              <div class="paiva-2d-record-bulk">
                <label><input type="checkbox" id="paiva-2d-record-select-all" /> Selecionar tudo</label>
                <button type="button" id="paiva-2d-record-delete-bulk" disabled>Excluir selecionados</button>
              </div>
              <div id="paiva-2d-records-list">Carregando registros…</div>
            </details>
          </div>
        </aside>
      </div>
      <p class="paiva-2d-disclaimer">Medição angular manual sobre fotografia estática, para triagem. Confirme pontos anatômicos, plano da câmera e valores com sua avaliação dinâmica/STT/Retül.</p>`;
    target.before(section);

    // O conjunto que mais se usa na análise fica sempre imediatamente sob o vídeo.
    // Controles e IDs existentes são movidos (não duplicados), preservando eventos.
    const playerDock=section.querySelector('.paiva-2d-player-dock');
    const playbackAdvanced=document.createElement('details');
    playbackAdvanced.className='paiva-2d-playback-advanced';
    playbackAdvanced.innerHTML='<summary>⚙ Reprodução · velocidade · quadros</summary>';
    playbackAdvanced.append(section.querySelector('.paiva-2d-playback'));
    playerDock.append(playbackAdvanced);
    // A régua não pode ficar escondida em "Reprodução avançada": ela é a
    // navegação principal de quem analisa manualmente um vídeo 2D.
    const videoTimeline=section.querySelector('.paiva-2d-timeline');
    playerDock.prepend(videoTimeline);
    playerDock.insertAdjacentHTML('afterbegin',`<div class="paiva-2d-manual-bar" aria-label="Análise 2D manual no vídeo">
      <strong>2D MANUAL · VÍDEO + PONTOS</strong>
      <button type="button" id="paiva-2d-manual-freeze">⏸ Pausar e marcar</button>
      <small>Arraste a régua abaixo para o instante desejado. Pause e marque no quadro.</small>
    </div>`);
    const markingDock=section.querySelector('.paiva-2d-marking-dock');
    for(const selector of ['.paiva-2d-tools','.paiva-2d-point-role','.paiva-2d-zoom','.paiva-2d-width'])
      markingDock.append(section.querySelector(selector));
    const quickDock=section.querySelector('.paiva-2d-quick-actions');
    playbackAdvanced.append(document.getElementById('paiva-2d-capture'));
    playbackAdvanced.append(document.getElementById('paiva-2d-back-video'));
    // A captura manual fica como recurso de compatibilidade, mas o gesto direto
    // sobre o vídeo passa a congelar o quadro automaticamente.
    document.getElementById('paiva-2d-capture').hidden=true;
    playbackAdvanced.append(section.querySelector('.paiva-2d-cycle-action'));
    playbackAdvanced.append(document.getElementById('paiva-2d-track-stop'));
    playbackAdvanced.append(section.querySelector('.paiva-2d-short-scan'));
    playbackAdvanced.append(document.getElementById('paiva-2d-track-start'));
    playbackAdvanced.insertAdjacentHTML('beforeend',`<div class="paiva-2d-project-tools" aria-label="Cópia do projeto de análise por tempo">
      <button type="button" id="paiva-2d-project-export">↓ Baixar análises (.json)</button>
      <label>↑ Reabrir análises <input type="file" id="paiva-2d-project-import" accept=".json,application/json" /></label>
      <small>As marcações pertencem ao projeto; o MP4 original não é alterado.</small>
    </div>`);
    quickDock.insertAdjacentHTML('afterbegin','<label class="paiva-2d-follow"><input type="checkbox" id="paiva-2d-auto-track" /> Seguir pontos ao reproduzir <span>· experimental</span></label>');
    playbackAdvanced.append(quickDock.querySelector('.paiva-2d-follow'));
    quickDock.innerHTML=`<div class="paiva-2d-marker-lab" aria-label="Rastreamento de pontos sem IA no 2D">
      <strong>✥ RASTREIO DE PONTOS · SEM IA</strong>
      <label>Referência na imagem
        <select id="paiva-2d-marker-reference" aria-label="Como reconhecer o marcador manual entre quadros">
          <option value="texture" selected>Textura / contraste</option>
          <option value="color">Adesivo colorido</option>
          <option value="reflective">Ponto claro / refletivo</option>
        </select>
      </label>
      <label>Visualizar e rastrear
        <select id="paiva-2d-marker-group" aria-label="Grupo de pontos manuais para rastrear">
          <option value="all" selected>Oito pontos · todos</option>
          <option value="upper">Tronco + braço</option>
          <option value="leg">Fêmur + tíbia</option>
          <option value="foot">Pé + calcanhar</option>
          <option value="free">Somente ponto livre</option>
        </select>
      </label>
      <small id="paiva-2d-marker-group-note" aria-live="polite">Exibindo 8 pontos · todas as regiões. Trocar o grupo não apaga os outros pontos.</small>
      <small>Selecione os pontos no quadro parado. Use ◀ ▶ para seguir um quadro de cada vez. Ponto perdido fica para correção.</small>
    </div><div class="paiva-2d-fine-controls" aria-label="Rastreio fino por quadro">
      <label title="Acompanhar as marcações com rastreio ON ao avançar ou voltar um quadro"><input id="paiva-2d-fine-mode" type="checkbox" checked /> ↔ Seguir por quadro</label>
      <button type="button" id="paiva-2d-fine-prev" title="Voltar um quadro seguindo os pontos">◀</button>
      <button type="button" id="paiva-2d-fine-next" title="Avançar um quadro seguindo os pontos">▶</button>
      <button type="button" id="paiva-2d-fine-peak" title="Abrir o maior ângulo do joelho observado nos quadros percorridos" disabled>↗ Pico</button>
      <div class="paiva-2d-trajectory-controls" aria-label="Trajetória de um ponto do atleta">
        <button type="button" id="paiva-2d-trace-point" title="Seguir somente o ponto selecionado e desenhar sua trajetória" disabled>↗ Traçar ponto</button>
        <select id="paiva-2d-trace-duration" aria-label="Duração da trajetória">
          <option value="0.5">0,5 s</option><option value="1" selected>1 s</option><option value="2">2 s</option><option value="3">3 s</option>
        </select>
        <button type="button" id="paiva-2d-trace-stop" title="Interromper o traçado em andamento" disabled>■ Parar</button>
        <button type="button" id="paiva-2d-trace-clear" title="Apagar SÓ a linha da trajetória; mantém o ponto" disabled>✕ Só trajeto</button>
        <button type="button" id="paiva-2d-trace-delete-point" title="Excluir o ponto selecionado e seu rastreio em todos os quadros" disabled>✕ Excluir ponto</button>
        <small id="paiva-2d-trace-readout" aria-live="polite">Marque um ponto onde quiser acompanhar o movimento.</small>
      </div>
      <details class="paiva-2d-fine-settings"><summary>Ajustes do rastreio</summary>
        <label>Alvo (px) <select id="paiva-2d-fine-patch"><option value="4">4</option><option value="6" selected>6</option><option value="8">8</option><option value="10">10</option></select></label>
        <label>Busca (px) <select id="paiva-2d-fine-search"><option value="12">12</option><option value="22" selected>22</option><option value="32">32</option><option value="42">42</option></select></label>
        <label><input type="checkbox" id="paiva-2d-fine-boxes" /> Mostrar janelas</label>
      </details>
      <small id="paiva-2d-fine-readout">📌 Ângulo preservado entre quadros e ao reabrir a análise. Pontos laranja = posição provisória; confirme antes de medir.</small>
    </div>`;
    section.querySelector('.paiva-2d-player-dock').hidden=true;

    const byId = key => document.getElementById('paiva-2d-' + key);
    const canvas = byId('canvas');
    const video = byId('video');
    // Replay nativo: terminou -> volta ao início e segue para a frente.
    video.loop=byId('pingpong').checked;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      byId('status').textContent = 'Este navegador não permite desenhar nesta ferramenta 2D.';
      return;
    }
    // Curva maleável em camada independente: não modifica os ângulos,
    // marcadores, rastreio nem o histórico dos pontos do bike fit.
    const curveLayer=globalThis.PAIVA_SPLINE?.attach({
      host:canvas.parentElement,target:canvas,
      toolbar:section.querySelector('.paiva-2d-title-actions'),
      closeOnFinish:false,label:'Curva 2D'
    });
    const original = document.createElement('canvas');
    const originalCtx = original.getContext('2d');
    if (!originalCtx) return;

    let photoLoaded = false;
    let tool = 'angle';
    let draft = [];
    let angleSequence = [];
    let full8Sequence = [];
    let full8ManualMode = false;
    let annotations = [];
    let activeDrag = null;
    let activeDraw = null;
    let selectedIndex = -1;
    let defaultTrackEnabled=true;
    let lineWidth = 3;
    let pointDiameter = 14;
    let pointSizeSelection = null;
    let cycleResult=null,cycleTrailsVisible=false;
    const fineTrails=new Map();
    const singlePointTrails=new Map();
    let fineUncertain=[];
    let finePeak=null,finePending=0,fineSequence=Promise.resolve();
    let fineSampler=null,fineSamplerSource=null;
    let lastDeletedAnnotation=null;
    const deleteMenu=document.createElement('div');
    deleteMenu.className='paiva-2d-delete-menu';
    deleteMenu.hidden=true;
    deleteMenu.setAttribute('role','menu');
    deleteMenu.innerHTML='<span id="paiva-2d-delete-label">Marcação selecionada</span><button type="button" id="paiva-2d-delete-confirm" role="menuitem">✕ Excluir marcação</button><button type="button" id="paiva-2d-delete-cancel" role="menuitem">Cancelar</button>';
    section.append(deleteMenu);
    let pendingDeleteIndex=-1;
    const colors = {angle:'#e7cf86',line:'#8bd6e4',point:'#a8f5c3',full8:'#48d7ea'};
    const palette=['#f56b6b','#f3f6fb','#57d39a','#b99cff','#64cbff','#ffca73'];
    let activeAngleColor=palette[0];
    const message = text => {byId('status').textContent = text;};
    const format = value => value.toFixed(1).replace('.',',');
    const displayedAngle = item => {
      const actual=angleDegrees(item.points[0],item.points[1],item.points[2]);
      if(actual!==null)item.lastValidAngle=actual;
      const a=actual??(Number.isFinite(item.lastValidAngle)?item.lastValidAngle:null);
      return a===null?null:item.supplementary?180-a:a;
    };
    // Um registro por quadro capturado. Novas marcações atualizam a foto do mesmo
    // instante, em vez de criar uma cópia a cada movimento do mouse.
    let autoPhotoId=null,photoSaveTimer=null,photoVersion=0,photoTimeKey=null;
    let photoWriteChain=Promise.resolve();
    const photoRecordVersions=new Map();
    const records=()=>globalThis.PAIVA_RECORDS;
    const photoName=()=>`PAIVA_Analise_2D_${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
    // Um projeto leve por arquivo de vídeo: cada instante guarda suas
    // marcações em coordenadas do quadro. O arquivo original não é modificado.
    let timelineIdentity=null,timelineFileName='',timelineVideoSize=0,timelineEpoch=0;
    let timelineFrames=new Map(),timelinePersistTimer=null,timelineWriteChain=Promise.resolve();
    let shownFrameKey=null,timelineSeekSuppressed=0;
    let markSerial=0;
    const deletedMarkIds=new Set();
    const newMarkUid=()=>['mark',Date.now().toString(36),
      (++markSerial).toString(36),Math.random().toString(36).slice(2,7)].join('-');
    // Chave em milissegundos: quadros consecutivos de 100/120 fps não podem
    // colidir na mesma centésima de segundo (formato antigo, 30/60 fps).
    const frameKey=time=>Math.round(Math.max(0,Number(time)||0)*1000);
    const cloneAnnotations=items=>items.map(item=>({uid:item.uid||(item.uid=newMarkUid()),
      kind:item.kind,role:item.role||'free',
      color:item.color||null,supplementary:!!item.supplementary,
      trackEnabled:item.trackEnabled!==false,
      ...(item.reflectorMode?{reflectorMode:true}:{}),
      ...(item.kind==='point'?{diameter:Number.isFinite(item.diameter)?item.diameter:14}:{}),
      ...(Number.isFinite(item.lastValidAngle)?{lastValidAngle:item.lastValidAngle}:{}),
      ...(item.lastReadings?{lastReadings:{...item.lastReadings}}:{}),
      points:item.points.map(p=>({x:p.x,y:p.y}))}));
    // Guarda a última geometria válida independentemente dos arquivos por
    // instante. Uma ficha antiga pode conter só um ponto/linha: ela não deve
    // substituir e apagar o ângulo que está sendo acompanhado com a rodinha.
    // A última referência angular também é salva no projeto do vídeo, de
    // modo que reabrir a análise não a faça desaparecer.
    // A referência retida fica sinalizada para conferência, nunca vira
    // automaticamente uma nova medição válida.
    let wheelAnchor=null;
    const isAngular=item=>item?.kind==='angle'||item?.kind==='full8';
    function projectHeldAngles(){
      return wheelAnchor?.source===recordedUrl?
        cloneAnnotations(wheelAnchor.marks.filter(item=>
          isAngular(item)&&!deletedMarkIds.has(item.uid))):[];
    }
    function rememberWheelAnchor(){
      if(!stillFromVideo||!hasFileVideo()||!annotations.length)return;
      const steps=wheelAnchor?.source===recordedUrl?wheelAnchor.steps:0;
      const marks=cloneAnnotations(annotations.filter(item=>!deletedMarkIds.has(item.uid)));
      // BUG V5.26: um quadro restaurado com APENAS ponto/linha substituía a
      // âncora completa. No giro seguinte, o ângulo tinha sumido de vez.
      // Manter o último ângulo, mesmo quando o quadro tem outras marcações.
      if(!marks.some(isAngular)&&wheelAnchor?.source===recordedUrl){
        marks.push(...cloneAnnotations(wheelAnchor.marks.filter(item=>
          isAngular(item)&&!deletedMarkIds.has(item.uid))));
      }
      wheelAnchor={source:recordedUrl,marks,steps};
    }
    function recoverWheelAnchor(){
      if(wheelAnchor?.source!==recordedUrl||!wheelAnchor.marks.length)return false;
      // Não sobrepor uma medida já existente no quadro.
      if(annotations.some(isAngular))return false;
      const carried=(annotations.length?
        wheelAnchor.marks.filter(isAngular):wheelAnchor.marks)
        .filter(item=>!deletedMarkIds.has(item.uid));
      if(!carried.length)return false;
      const start=annotations.length;
      annotations.push(...cloneAnnotations(carried));
      // Os pontos provisórios do quadro seguinte são marcados em laranja;
      // o grau mostrado continua sendo a última geometria, não a leitura real.
      fineUncertain.push(...carried.flatMap((item,i)=>item.points.map((_,j)=>({item:start+i,point:j}))));
      return true;
    }
    function advanceWheelAnchor(){
      rememberWheelAnchor();
      if(wheelAnchor?.source===recordedUrl)wheelAnchor.steps++;
    }
    const clonePaths=()=>[...singlePointTrails].map(([index,path])=>({index,
      path:path.slice(-240).map(p=>({x:p.x,y:p.y,time:p.time}))}));
    // O navegador pode retornar 2,347 s ao voltar para um quadro salvo em
    // 2,333 s. Esses instantes são a MESMA imagem; um novo registro próximo
    // não deve ressuscitar a marcação antiga depois de uma exclusão.
    function timelineSlot(time){
      const raw=frameKey(time),fps=Number(byId('file-fps')?.value)||30;
      const tolerance=Math.min(.022,.62/Math.max(1,fps));
      let best=null;
      // Tolerância à busca aproximada do decodificador sem fundir dois
      // quadros vizinhos de 120 fps em um único registro.
      const radius=Math.max(3,Math.ceil(tolerance*1000));
      for(let offset=-radius;offset<=radius;offset++){
        const key=raw+offset,entry=timelineFrames.get(key);
        if(!entry)continue;
        const gap=Math.abs(entry.time-time);
        if(gap<=tolerance&&(!best||gap<best.gap))best={key,entry,gap};
      }
      return best;
    }
    function timelineFileId(file){
      const signature=`${file.name||'video'}|${file.size||0}|${file.type||''}`;
      let hash=2166136261;
      for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619);
      return `analise-2d-${(hash>>>0).toString(16)}-${file.size||0}`;
    }
    function persistTimelineNow(){
      if(!timelineIdentity||!records()?.save)return;
      clearTimeout(timelinePersistTimer);
      const identity=timelineIdentity,name=timelineFileName,size=timelineVideoSize;
      const frames=[...timelineFrames.values()].sort((a,b)=>a.time-b.time);
      const blob=new Blob([JSON.stringify({version:1,videoName:name,
        videoSize:size,deletedMarkIds:[...deletedMarkIds],
        heldAngles:projectHeldAngles(),frames})],{type:'application/json'});
      timelineWriteChain=timelineWriteChain.catch(()=>{}).then(()=>records().save({
        id:identity,kind:'analise',name:`PAIVA_Analise_${name.replace(/\.[^.]+$/,'')}.json`,
        description:`Marcações automáticas por instante · ${frames.length} quadros`,blob
      })).catch(error=>{console.warn('PAIVA: não foi possível salvar o histórico 2D',error);
        message('A análise está nesta sessão, mas não foi possível salvá-la no navegador. Libere espaço ou baixe as marcações.');});
    }
    function scheduleTimelinePersist(delay=480){
      if(!timelineIdentity)return;
      clearTimeout(timelinePersistTimer);
      timelinePersistTimer=setTimeout(persistTimelineNow,delay);
    }
    function rememberTimelineFrame(urgency=480,source='manual'){
      if(!timelineIdentity||!stillFromVideo||!hasFileVideo()||!photoLoaded)return;
      if(source==='manual'){
        if(annotations.length)rememberWheelAnchor();
        else wheelAnchor=null; // Exclusão explícita deve continuar sendo exclusão.
      }
      const time=video.currentTime,slot=timelineSlot(time),key=slot?.key??frameKey(time);
      // Uma posição corrigida pelo profissional é definitiva naquele quadro.
      // O rastreio automático pode preencher quadros novos, jamais substituí-la.
      if(source==='tracking'&&slot?.entry&&slot.entry.source!=='tracking'){
        shownFrameKey=slot.key;return;
      }
      // Também remove versões duplicadas do mesmo quadro criadas antes desta
      // correção, para que nenhuma delas reapareça ao voltar com a régua.
      const fps=Number(byId('file-fps')?.value)||30;
      const tolerance=Math.min(.022,.62/Math.max(1,fps));
      const radius=Math.max(3,Math.ceil(tolerance*1000));
      for(let offset=-radius;offset<=radius;offset++){
        const duplicate=key+offset,entry=timelineFrames.get(duplicate);
        if(duplicate!==key&&entry&&Math.abs(entry.time-time)<=tolerance)
          timelineFrames.delete(duplicate);
      }
      timelineFrames.set(key,{time:slot?.entry.time??time,source,
        cleared:source==='manual'&&annotations.length===0,
        angularCleared:source==='manual'&&!annotations.some(isAngular)&&
          slot?.entry?.angularCleared===true,
        annotations:cloneAnnotations(annotations),trails:clonePaths(),
        uncertain:fineUncertain.map(p=>({item:p.item,point:p.point}))});
      shownFrameKey=key;
      if(timelineFrames.size>1800){
        // Descartar primeiro um quadro estimado automaticamente. Assim uma
        // longa sessão de rastreio não expulsa medições corrigidas à mão.
        const automatic=[...timelineFrames].find(([id,entry])=>id!==key&&entry.source==='tracking');
        const oldest=automatic?.[0]??[...timelineFrames.keys()].find(id=>id!==key);
        if(oldest!==undefined)timelineFrames.delete(oldest);
      }
      scheduleTimelinePersist(urgency);
    }
    function restoreTimelineFrame(time,clearMissing=true,paint=true,preservePeak=false){
      const slot=timelineSlot(time),entry=slot?.entry;
      if(!entry&&!clearMissing)return false;
      if(entry)globalThis.PAIVA_2D_HISTORY?.normalizeEntry(entry);
      // Coordenadas armazenadas/corrigidas neste quadro têm prioridade sobre
      // qualquer rastreio contínuo antigo que tenha coincidido no mesmo tempo.
      lastTrackedGeometry=null;
      // Entradas vazias antigas não podem apagar um ângulo que o profissional
      // acabou de desenhar. Uma exclusão explícita nova tem flag `cleared`.
      const available=(entry?.annotations||[]).filter(item=>!deletedMarkIds.has(item.uid));
      const usable=available.length>0;
      const explicitlyCleared=entry?.cleared===true||
        (!!entry?.annotations?.length&&!usable);
      const angularCleared=entry?.angularCleared===true;
      if(entry&&(usable||explicitlyCleared)){
        annotations=cloneAnnotations(available);
        if(explicitlyCleared||angularCleared)wheelAnchor=null;
        singlePointTrails.clear();
        if(entry.trails)for(const trail of entry.trails){
          if(Number.isInteger(trail.index)&&annotations[trail.index]?.kind==='point'&&Array.isArray(trail.path))
            singlePointTrails.set(trail.index,trail.path.slice(-240).map(p=>({...p})));
        }
      }
      selectedIndex=-1;draft=[];angleSequence=[];full8Sequence=[];activeDrag=null;activeDraw=null;
      updateFull8Guide();
      lastDeletedAnnotation=null;
      fineTrails.clear();
      // Sem medição salva neste instante, manter a última geometria visível
      // e sinalizar que os pontos precisam ser conferidos. O ângulo não some.
      fineUncertain=usable?(entry.uncertain||[]).map(p=>({...p})):
        annotations.flatMap((item,i)=>
          item.points.map((_,j)=>({item:i,point:j})));
      // Mesmo quando o quadro salvo possui uma LINHA ou um PONTO, o ângulo
      // anterior precisa seguir visível. Uma exclusão explícita é respeitada.
      if(!explicitlyCleared&&!angularCleared)recoverWheelAnchor();
      if(!preservePeak)finePeak=null;
      shownFrameKey=slot?.key??frameKey(time);
      if(paint){render();updateCameraControls();}
      return usable||explicitlyCleared;
    }
    async function loadTimelineForVideo(file){
      if(timelineIdentity)persistTimelineNow();
      const epoch=++timelineEpoch;
      clearTimeout(timelinePersistTimer);
      timelineFrames=new Map();shownFrameKey=null;deletedMarkIds.clear();
      timelineIdentity=timelineFileId(file);timelineFileName=file.name||'video';
      timelineVideoSize=file.size||0;
      if(!records()?.get)return;
      try{
        await timelineWriteChain.catch(()=>{});
        const saved=await records().get(timelineIdentity);
        if(epoch!==timelineEpoch||!saved?.blob)return;
        const data=JSON.parse(await saved.blob.text());
        if(epoch!==timelineEpoch||data?.version!==1||!Array.isArray(data.frames))return;
        for(const frame of data.frames){
          if(!Number.isFinite(frame.time)||!Array.isArray(frame.annotations))continue;
          if(frame.annotations.some(a=>!['point','line','angle','full8'].includes(a.kind)||
            !Array.isArray(a.points)||a.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))continue;
          timelineFrames.set(frameKey(frame.time),frame);
        }
        globalThis.PAIVA_2D_HISTORY?.normalizeFrames(timelineFrames);
        for(const uid of Array.isArray(data.deletedMarkIds)?data.deletedMarkIds:[]){
          if(typeof uid!=='string'||uid.length>120||!uid)continue;
          deletedMarkIds.add(uid);
          globalThis.PAIVA_2D_HISTORY?.removeFromFrames(timelineFrames,uid);
        }
        // V5.37: restaura os ângulos fixados somente no vídeo correspondente.
        // Os pontos recuperados são referências provisórias até conferência.
        const held=Array.isArray(data.heldAngles)?data.heldAngles:[];
        const safeHeld=held.filter(item=>isAngular(item)&&
          Array.isArray(item.points)&&item.points.length===(item.kind==='angle'?3:8)&&
          item.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))&&
          !deletedMarkIds.has(item.uid)).slice(0,40);
        if(safeHeld.length)wheelAnchor={source:recordedUrl,
          marks:cloneAnnotations(safeHeld),steps:0};
        if(!canvas.hidden&&stillFromVideo)restoreTimelineFrame(video.currentTime,false);
        if(timelineFrames.size)message(`${timelineFrames.size} instante(s) de análise recuperados neste vídeo. Volte à régua para rever as marcações.`);
      }catch(error){console.warn('PAIVA: histórico 2D não pôde ser recuperado',error);}
    }
    byId('project-export').addEventListener('click',()=>{
      if(!timelineIdentity||!currentVideoFile){message('Abra primeiro o vídeo cuja análise deseja baixar.');return;}
      if(stillFromVideo&&!canvas.hidden&&!timelineSlot(video.currentTime))rememberTimelineFrame(0,'tracking');
      const frames=[...timelineFrames.values()].sort((a,b)=>a.time-b.time);
      const blob=new Blob([JSON.stringify({version:1,videoName:timelineFileName,
        videoSize:timelineVideoSize,deletedMarkIds:[...deletedMarkIds],
        heldAngles:projectHeldAngles(),frames})],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`PAIVA_Analise_${timelineFileName.replace(/\.[^.]+$/,'')}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      message(`Projeto exportado com ${frames.length} instante(s). Guarde o JSON junto do vídeo original.`);
    });
    byId('project-import').addEventListener('change',async event=>{
      const file=event.target.files?.[0];event.target.value='';
      if(!file)return;
      if(!hasFileVideo()||!currentVideoFile){message('Abra o vídeo original antes de importar suas marcações.');return;}
      if(file.size>12*1048576){message('Arquivo de marcações muito grande. Escolha um JSON de até 12 MB.');return;}
      try{
        const data=JSON.parse(await file.text());
        if(data?.version!==1||!Array.isArray(data.frames)||data.frames.length>1800)
          throw new Error('Este arquivo não é uma análise PAIVA compatível.');
        if(data.videoName!==timelineFileName||(Number.isFinite(data.videoSize)&&data.videoSize!==timelineVideoSize))
          throw new Error('Estas marcações pertencem a outro vídeo. Abra o arquivo original correspondente.');
        const imported=new Map();
        for(const entry of data.frames){
          if(!Number.isFinite(entry?.time)||entry.time<0||!Array.isArray(entry.annotations)||entry.annotations.length>100)
            throw new Error('Há um instante inválido no projeto.');
          for(const shape of entry.annotations){
            const required={point:1,line:2,angle:3,full8:8}[shape.kind];
            if(!required||!Array.isArray(shape.points)||shape.points.length!==required||
              shape.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
              throw new Error('Há uma marcação com pontos inválidos no projeto.');
          }
          globalThis.PAIVA_2D_HISTORY?.normalizeEntry(entry);
          imported.set(frameKey(entry.time),{time:entry.time,
            source:entry.source==='tracking'?'tracking':'manual',
            cleared:entry.cleared===true,
            angularCleared:entry.angularCleared===true,
            annotations:cloneAnnotations(entry.annotations),trails:Array.isArray(entry.trails)?entry.trails:[],
            uncertain:Array.isArray(entry.uncertain)?entry.uncertain.filter(p=>
              Number.isInteger(p.item)&&Number.isInteger(p.point)&&p.item>=0&&p.item<entry.annotations.length&&
              p.point>=0&&p.point<entry.annotations[p.item].points.length).map(p=>({item:p.item,point:p.point})):[]});
        }
        timelineFrames=imported;deletedMarkIds.clear();
        for(const uid of Array.isArray(data.deletedMarkIds)?data.deletedMarkIds:[]){
          if(typeof uid!=='string'||uid.length>120||!uid)continue;
          deletedMarkIds.add(uid);
          globalThis.PAIVA_2D_HISTORY?.removeFromFrames(timelineFrames,uid);
        }
        wheelAnchor=null;
        const held=Array.isArray(data.heldAngles)?data.heldAngles:[];
        const safeHeld=held.filter(item=>isAngular(item)&&
          Array.isArray(item.points)&&item.points.length===(item.kind==='angle'?3:8)&&
          item.points.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))&&
          !deletedMarkIds.has(item.uid)).slice(0,40);
        if(safeHeld.length)wheelAnchor={source:recordedUrl,
          marks:cloneAnnotations(safeHeld),steps:0};
        persistTimelineNow();
        if(stillFromVideo&&!canvas.hidden){restoreTimelineFrame(video.currentTime,true);}
        message(`${imported.size} instante(s) de análise importados. Volte com a régua aos tempos marcados.`);
      }catch(error){message(`Não foi possível abrir o projeto: ${error?.message||'JSON inválido'}`);}
    });
    let photoRecordName=photoName();
    function newPhotoRecord(){
      autoPhotoId=records()?.id('foto')||null;
      photoTimeKey=stillFromVideo&&hasFileVideo()?frameKey(video.currentTime):null;
      photoRecordName=photoName();photoVersion++;
      clearTimeout(photoSaveTimer);
    }
    function writePhotoVersion(blob,version,id,name,description){
      if(!blob||photoRecordVersions.get(id)!==version||!records()?.save)return;
      photoWriteChain=photoWriteChain.catch(()=>{}).then(()=>{
        // O PNG pode demorar a codificar: nunca deixar uma captura antiga
        // sobrescrever correções DO MESMO quadro. Quadros distintos mantêm
        // IDs próprios e podem terminar de salvar em qualquer ordem.
        if(photoRecordVersions.get(id)!==version)return;
        return records().save({id,kind:'foto',name,description,blob});
      }).catch(error=>{console.warn('PAIVA: não foi possível atualizar a foto automática',error);});
    }
    function schedulePhotoSave(delayMs=650,source='manual'){
      // Histórico de marcações é independente da exportação de fotos PNG.
      // Mesmo sem espaço/ID para foto, exclusões e alterações ficam no projeto.
      if(source!=='tracking')lastTrackedGeometry=null;
      rememberTimelineFrame(delayMs<=700?0:480,source);
      // Se a foto atual foi excluída pelo usuário, só criar outro registro
      // quando houver uma NOVA alteração; não ressuscitar o arquivo apagado.
      if(!autoPhotoId&&photoLoaded&&records()?.id)newPhotoRecord();
      if(!photoLoaded||!records()?.save||!autoPhotoId)return;
      if(stillFromVideo&&hasFileVideo()&&photoTimeKey!==frameKey(video.currentTime))newPhotoRecord();
      const version=++photoVersion;
      photoRecordVersions.set(autoPhotoId,version);
      clearTimeout(photoSaveTimer);
      if(delayMs<=700){
        // A conclusão de uma marcação tira uma foto imediatamente. A cópia
        // conserva o quadro mesmo se o usuário mover a régua em seguida.
        const id=autoPhotoId,name=photoRecordName;
        const count=annotations.filter(a=>a.kind==='angle'||a.kind==='full8').length;
        canvas.toBlob(blob=>{
          writePhotoVersion(blob,version,id,name,`Imagem 2D com ${count} ângulo(s) · instante preservado`);
        },'image/png');
        return;
      }
      photoSaveTimer=setTimeout(()=>{
        if(version!==photoVersion||!photoLoaded)return;
        const id=autoPhotoId,name=photoRecordName;
        const count=annotations.filter(a=>a.kind==='angle'||a.kind==='full8').length;
        canvas.toBlob(blob=>{
          writePhotoVersion(blob,version,id,name,`Imagem 2D com ${count} ângulo(s)`);
        },'image/png');
      },delayMs);
    }
    async function saveVideoRecord(blob,name,description){
      if(!records()?.save)return false;
      try{await records().save({kind:'video',name,description,blob});return true;}
      catch(error){message('Vídeo disponível para baixar, mas o salvamento automático falhou: '+(error?.message||'sem espaço'));return false;}
    }
    const recordList=byId('records-list');
    const recordSelectAll=byId('record-select-all');
    const recordDeleteBulk=byId('record-delete-bulk');
    const selectedRecordIds=new Set();
    let listedRecords=[];
    let deletingRecords=false;
    async function finishWritesBeforeDeletion(ids){
      // Um PNG ainda sendo codificado não pode reaparecer depois da exclusão.
      // Invalidar somente os IDs escolhidos, sem interferir em outros exames.
      const targets=new Set(ids);
      for(const id of targets)photoRecordVersions.delete(id);
      if(targets.has(autoPhotoId)){
        clearTimeout(photoSaveTimer);
        autoPhotoId=null;
      }
      await Promise.all([photoWriteChain.catch(()=>{}),timelineWriteChain.catch(()=>{})]);
    }
    function syncRecordSelection(){
      const total=listedRecords.length;
      const count=listedRecords.filter(item=>selectedRecordIds.has(item.id)).length;
      recordSelectAll.checked=total>0&&count===total;
      recordSelectAll.indeterminate=count>0&&count<total;
      recordSelectAll.disabled=!total||deletingRecords;
      recordDeleteBulk.disabled=!count||deletingRecords;
      recordDeleteBulk.textContent=count?`Excluir selecionados (${count})`:'Excluir selecionados';
    }
    recordSelectAll.addEventListener('change',()=>{
      if(recordSelectAll.checked)for(const item of listedRecords)selectedRecordIds.add(item.id);
      else selectedRecordIds.clear();
      for(const box of recordList.querySelectorAll('.paiva-2d-record-check'))
        box.checked=selectedRecordIds.has(box.value);
      syncRecordSelection();
    });
    recordDeleteBulk.addEventListener('click',async()=>{
      if(deletingRecords||!records()?.removeMany)return;
      const ids=listedRecords.filter(item=>selectedRecordIds.has(item.id)).map(item=>item.id);
      if(!ids.length)return;
      if(!confirm(`Excluir definitivamente ${ids.length} registro(s) selecionado(s)? Fotos, vídeos e análises apagados deste navegador não poderão ser recuperados. Baixe antes o que desejar guardar.`))return;
      deletingRecords=true;syncRecordSelection();
      try{
        await finishWritesBeforeDeletion(ids);
        const removed=await records().removeMany(ids);
        for(const id of ids)selectedRecordIds.delete(id);
        message(`${removed} registro(s) removido(s) do arquivo local.`);
      }catch(error){message('Não foi possível excluir os registros: '+(error?.message||'erro local'));}
      finally{deletingRecords=false;await refreshRecordList();}
    });
    async function refreshRecordList(){
      if(!records()?.list){recordList.textContent='Registros indisponíveis neste navegador.';return;}
      try{
        // Sem limite de 40: "Selecionar tudo" cobre também registros antigos.
        const items=await records().list(Infinity);
        listedRecords=items;
        const availableIds=new Set(items.map(item=>item.id));
        for(const id of selectedRecordIds)if(!availableIds.has(id))selectedRecordIds.delete(id);
        byId('record-count').textContent=items.length?`· ${items.length}`:'';
        recordList.replaceChildren();
        if(!items.length){recordList.textContent='Nenhum registro ainda.';syncRecordSelection();return;}
        for(const item of items){
          const row=document.createElement('div');row.className='paiva-2d-record-row';
          const check=document.createElement('input');check.type='checkbox';check.className='paiva-2d-record-check';
          check.value=item.id;check.checked=selectedRecordIds.has(item.id);
          check.setAttribute('aria-label',`Selecionar ${item.name} para excluir`);
          check.addEventListener('change',()=>{
            if(check.checked)selectedRecordIds.add(item.id);
            else selectedRecordIds.delete(item.id);
            syncRecordSelection();
          });row.append(check);
          const info=document.createElement('span');info.textContent=`${item.kind==='foto'?'📷':item.kind==='analise'?'📐':'🎞'} ${item.name} · ${item.kind==='analise'?`${(item.size/1024).toFixed(1)} KB`:`${(item.size/1048576).toFixed(1)} MB`}`;
          info.title=item.description;row.append(info);
          const download=document.createElement('button');download.type='button';download.textContent='Baixar';
          download.addEventListener('click',()=>records().download(item.id).catch(e=>message(e.message)));row.append(download);
          const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Apagar este registro';
          remove.addEventListener('click',async()=>{
            if(!confirm('Apagar este registro salvo no navegador?'))return;
            try{await finishWritesBeforeDeletion([item.id]);await records().remove(item.id);}
            catch(e){message(e.message);}
          });row.append(remove);recordList.append(row);
        }
        syncRecordSelection();
      }catch(error){recordList.textContent='Não foi possível ler os registros: '+(error?.message||'erro local');}
    }
    // Não reconstruir a lista oculta a cada quadro: evita engasgos do vídeo.
    window.addEventListener('paiva-records-changed',()=>{
      if(section.querySelector('.paiva-2d-records').open)refreshRecordList();
    });
    section.querySelector('.paiva-2d-records').addEventListener('toggle',event=>{
      if(event.target.open)refreshRecordList();
    });
    refreshRecordList();

    function pointAt(event) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const x = (event.clientX - rect.left) * canvas.width / rect.width;
      const y = (event.clientY - rect.top) * canvas.height / rect.height;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {x:Math.max(0,Math.min(canvas.width,x)),y:Math.max(0,Math.min(canvas.height,y))};
    }

    const constrain = p => ({x:Math.max(0,Math.min(canvas.width,p.x)),
      y:Math.max(0,Math.min(canvas.height,p.y))});
    function snapHorizontal(anchor,point,shiftKey) {
      if (!shiftKey) return point;
      // A linha do solo deve permanecer em 0°, mesmo se o movimento do
      // cursor for mais vertical. A referência (anchor) não é deslocada.
      return constrain({x:point.x,y:anchor.y});
    }
    function snapAngleSequencePoint(point,shiftKey) {
      if(!shiftKey||!angleSequence.length)return point;
      // No ângulo de três cliques, o vértice é a referência da terceira
      // haste. Nunca criar automaticamente uma perpendicular de 90°.
      return snapHorizontal(angleSequence[angleSequence.length===1?0:1],point,true);
    }
    function snapEditedPoint(annotation,index,point,shiftKey){
      if(!shiftKey||!annotation||annotation.kind==='point')return point;
      const pts=annotation.points;
      if(annotation.kind==='line')return snapHorizontal(pts[1-index],point,true);
      if(annotation.kind==='angle'){
        // Extremos alinham ao vértice; vértice alinha ao primeiro extremo.
        // A haste que não está sendo editada mantém sua geometria.
        return snapHorizontal(pts[index===1?0:1],point,true);
      }
      return point;
    }
    function draftFromDrag(kind,anchor,pointer,shiftKey) {
      const end=snapHorizontal(anchor,pointer,shiftKey);
      if (kind==='line') return [anchor,end];
      if (shiftKey) {
        // Ao abrir um ângulo arrastando, Shift produz uma referência
        // horizontal e deixa a outra haste seguir a inclinação do cursor.
        return [end,anchor,constrain(pointer)];
      }
      const dx=end.x-anchor.x,dy=end.y-anchor.y;
      // Sem Shift, preservar o gesto anterior que abre um ângulo editável.
      return [end,anchor,constrain({x:anchor.x-dy,y:anchor.y+dx})];
    }
    function segmentDistance(p,a,b) {
      const dx=b.x-a.x,dy=b.y-a.y;
      const norm=dx*dx+dy*dy;
      if (!norm) return Math.hypot(p.x-a.x,p.y-a.y);
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/norm));
      return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
    }

    // Cada região é apenas uma vista do MESMO boneco: não modificar os oito
    // pontos guardados nem mover os demais ao trocar a seleção.
    const full8Views={all:[0,1,2,3,4,5,6,7],upper:[0,1,2,3],
      leg:[3,4,5],foot:[5,6,7],free:[]};
    function activeFull8Points(){
      const group=byId('marker-group')?.value||'all';
      return full8Views[group]||full8Views.all;
    }
    function isPointVisible(item,index){
      return item?.kind!=='full8'||activeFull8Points().includes(index);
    }
    function visibleFull8Segments(){
      const shown=activeFull8Points();
      return shown.slice(1).filter((index)=>shown.includes(index-1))
        .map(index=>[index-1,index]);
    }

    function mark(p,color) {
      const radius = Math.max(3,Math.min(25,lineWidth*1.1+2));
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle = '#0b1a24';ctx.fill();
      ctx.lineWidth = Math.max(1,lineWidth/2);ctx.strokeStyle = color;ctx.stroke();
    }

    let occupiedTags=[];
    function tag(x,y,text,color) {
      const fontSize = Math.max(12,Math.min(20,canvas.width/65));
      ctx.font = `700 ${fontSize}px system-ui,sans-serif`;
      const padding = 4;
      const w = ctx.measureText(text).width + padding*2;
      const h = fontSize+padding*2;
      // Etiqueta com linha-guia longe do marcador: o texto não pode encobrir
      // a bolinha enquanto o profissional a reposiciona com o mouse.
      const candidates=[
        [x+35,y-h-27],[x-w-35,y-h-27],
        [x+35,y+27],[x-w-35,y+27],
        [x-w/2,y-h-40],[x-w/2,y+40]
      ];
      const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
      const overlap=(left,top,right,bottom,rect)=>
        Math.max(0,Math.min(right,rect.right)-Math.max(left,rect.left))*
        Math.max(0,Math.min(bottom,rect.bottom)-Math.max(top,rect.top));
      let best=null;
      for(const [cx,cy] of candidates){
        const tx=clamp(cx,4,Math.max(4,canvas.width-w-4));
        const top=clamp(cy,4,Math.max(4,canvas.height-h-4));
        const penalty=occupiedTags.reduce((sum,rect)=>sum+overlap(tx,top,tx+w,top+h,rect)*12,0);
        const pointsObscured=annotations.reduce((count,item)=>count+
          item.points.filter((p,j)=>isPointVisible(item,j)&&
            p.x>=tx-12&&p.x<=tx+w+12&&p.y>=top-12&&p.y<=top+h+12).length,0);
        const score=penalty+pointsObscured*2200+Math.abs(cx-tx)*7+Math.abs(cy-top)*7+
          Math.hypot(tx+w/2-x,top+h/2-y)*.08;
        if(!best||score<best.score)best={tx,top,score};
      }
      const {tx,top}=best;
      const endX=clamp(x,tx,tx+w),endY=clamp(y,top,top+h);
      const length=Math.hypot(endX-x,endY-y);
      ctx.save();
      if(length>1){
        ctx.strokeStyle=color;ctx.globalAlpha=.83;ctx.lineWidth=1.25;
        ctx.beginPath();ctx.moveTo(x+(endX-x)*Math.min(12/length,.42),y+(endY-y)*Math.min(12/length,.42));
        ctx.lineTo(endX,endY);ctx.stroke();
      }
      ctx.fillStyle = 'rgba(8,20,29,.74)';
      ctx.fillRect(tx,top,w,h);
      ctx.strokeStyle = color;ctx.lineWidth=1;ctx.strokeRect(tx,top,w,h);
      ctx.fillStyle = '#f4f8fa';ctx.textBaseline='middle';ctx.fillText(text,tx+padding,top+h/2);
      ctx.restore();
      const bounds={left:tx,top,right:tx+w,bottom:top+h};
      occupiedTags.push(bounds);
      return bounds;
    }

    function drawAnnotation(item,index,partial=false) {
      const pts = item.points;
      const color = item.color||(item.kind==='point'&&item.role==='hip'?'#64cbff':colors[item.kind]);
      if(item.kind==='point') {
        if(pts.length){
          const p=pts[0];
          ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,Math.min(22,(item.diameter||pointDiameter)/2)),0,Math.PI*2);
          ctx.fillStyle=color;ctx.fill();
          ctx.strokeStyle='#102a24';ctx.lineWidth=1.5;ctx.stroke();
        }
        return;
      }
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle=color;
      ctx.beginPath();
      if(item.kind==='full8'&&!partial){
        for(const [a,b] of visibleFull8Segments()){
          ctx.moveTo(pts[a].x,pts[a].y);ctx.lineTo(pts[b].x,pts[b].y);
        }
      }else{
        if (pts.length) ctx.moveTo(pts[0].x,pts[0].y);
        for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      }
      ctx.stroke();
      pts.forEach((p,j)=>{if(partial||isPointVisible(item,j))mark(p,color);});
      if (!partial && item.kind === 'angle' && pts.length === 3) {
        item.labelBounds=null;
        const a = displayedAngle(item);
        const pending=stillFromVideo&&fineUncertain.some(p=>p.item===index);
        const held=pending||angleDegrees(pts[0],pts[1],pts[2])===null;
        item.labelBounds=tag(pts[1].x,pts[1].y,a===null?'A — · ajustar':
          `A ${held?'≈ ':''}${format(a)}°${pending?' · conferir':held?' · último':''}`,color);
      }
      if (!partial && item.kind === 'line' && pts.length === 2) {
        tag((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,`L${index+1}`,color);
      }
      if(!partial&&item.kind==='full8'&&pts.length===8){
        const view=byId('marker-group')?.value||'all';
        // Referência horizontal do solo para o ângulo do pé. O calcanhar
        // nunca é medido em relação à tíbia.
        if(view==='all'||view==='foot'){
          ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle='rgba(72,215,234,.62)';
          ctx.lineWidth=Math.max(1.5,lineWidth*.6);ctx.beginPath();
          ctx.moveTo(pts[7].x,pts[7].y);ctx.lineTo(pts[6].x,pts[7].y);
          ctx.stroke();ctx.restore();
        }
        const raw=full8Measurements(pts),m=stableFull8Measurements(item);
        if(m){
          const pending=stillFromVideo?fineUncertain.filter(p=>p.item===index).map(p=>p.point):[];
          const kneePending=pending.some(j=>[3,4,5].includes(j));
          const footPending=pending.some(j=>[6,7].includes(j));
          if(view==='all'||view==='leg')tag(pts[4].x,pts[4].y,m.knee===null?'Joelho — · ajustar':
            `Joelho ${kneePending||raw.knee===null?'≈ ':''}${format(m.knee)}°${kneePending?' · conferir':''}`,color);
          if(view==='all'||view==='foot')tag(pts[6].x,pts[6].y,m.foot===null?'Pé/solo — · ajustar':
            `Pé/solo ${footPending||raw.foot===null?'≈ ':''}${format(m.foot)}°${footPending?' · conferir':''}`,color);
          if(view==='upper')tag(pts[2].x,pts[2].y,m.trunk===null?'Tronco — · ajustar':
            `Tronco/solo ${format(m.trunk)}°`,color);
        }
      }
    }

    function updateValues() {
      const values = [];
      annotations.forEach((item,index) => {
        if (item.kind === 'angle') {
          const a = displayedAngle(item);
          const pending=stillFromVideo&&fineUncertain.some(p=>p.item===index);
          values.push(`Ângulo ${index+1}: ${a === null ? 'rever pontos' : `${pending?'≈ ':''}${format(a)}°${pending?' (conferir)':''}`}`);
        } else if(item.kind==='full8'){
          const m=stableFull8Measurements(item);
          const pending=stillFromVideo?fineUncertain.filter(p=>p.item===index).map(p=>p.point):[];
          const val=(label,n,indices=[])=>`${label} ${n===null?'rever':`${pending.some(j=>indices.includes(j))?'≈ ':''}${format(n)}°`}`;
          const view=byId('marker-group')?.value||'all';
          if(m){
            const parts={elbow:val('Cotovelo',m.elbow,[0,1,2]),
              shoulder:val('Ombro',m.shoulder,[1,2,3]),
              hip:val('Quadril',m.hip,[2,3,4]),
              knee:val('Joelho',m.knee,[3,4,5]),
              ankle:val('Tornozelo',m.ankle,[4,5,6]),
              trunk:val('Tronco/solo',m.trunk,[2,3]),
              foot:val('Pé/solo',m.foot,[6,7])};
            const groups={all:['elbow','shoulder','hip','knee','ankle','trunk','foot'],
              upper:['elbow','shoulder','trunk'],leg:['knee'],foot:['foot'],free:[]};
            const shown=(groups[view]||groups.all).map(key=>parts[key]);
            if(shown.length)values.push(`${view==='all'?'8 pontos':view==='upper'?'Tronco + braço':view==='leg'?'Fêmur + tíbia':'Pé + calcanhar'} · ${shown.join(' · ')}`);
          }
        } else if(item.kind==='point') values.push(`${item.role==='heel'?'Calcanhar':item.role==='hip'?'Quadril':`Ponto ${index+1}`} · rastro`);
        else values.push(`Linha ${index+1}`);
      });
      byId('values').textContent = values.join('  ·  ');
    }

    function chosenPointIndex(){
      if(annotations[selectedIndex]?.kind==='point')return selectedIndex;
      for(let i=annotations.length-1;i>=0;i--)if(annotations[i].kind==='point')return i;
      return -1;
    }
    function appendSinglePoint(index,oldPoint,newPoint,from,to){
      if(annotations[index]?.kind!=='point'||!oldPoint||!newPoint)return;
      const gap=1.8/(Number(byId('file-fps').value)||30);
      let path=singlePointTrails.get(index)||[];
      if(!path.length||Math.min(Math.abs(from-path[0].time),Math.abs(from-path[path.length-1].time))>gap){
        path=[{...oldPoint,time:from}];
      }
      if(to<from && Math.abs(from-path[0].time)<=gap)
        path.unshift({...newPoint,time:to});
      else if(to>from && Math.abs(from-path[path.length-1].time)<=gap)
        path.push({...newPoint,time:to});
      else path=[{...oldPoint,time:from},{...newPoint,time:to}];
      if(path.length>240)path=path.slice(-240);
      singlePointTrails.set(index,path);
    }
    function trajectoryMetrics(path){
      if(!path||path.length<2)return null;
      const xs=path.map(p=>p.x),ys=path.map(p=>p.y);
      const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys);
      return {dx,dy};
    }
    function updateTrajectoryReadout(){
      const current=chosenPointIndex(),path=singlePointTrails.get(current);
      byId('trace-readout').textContent=path?.length>1
        ?`Trajetória do ponto · ${path.length} quadros · confira o desenho`
        :'A trajetória aparece desenhada sobre o atleta.';
      byId('trace-clear').disabled=singlePointTrails.size===0;
    }

    function updateTrackToggle(){
      const selected=annotations[selectedIndex];
      // O tamanho do ponto é próprio da marcação selecionada. A linha e os
      // demais pontos não mudam ao alterar este controle.
      const selectedPoint=selected?.kind==='point'?selected:null;
      const sizeSelection=selectedPoint?.uid||null;
      if(sizeSelection!==pointSizeSelection){
        pointSizeSelection=sizeSelection;
        const size=selectedPoint?.diameter||pointDiameter;
        byId('point-size').value=String(size);
        byId('point-size-value').textContent=size+' px';
      }
      const enabled=selected?selected.trackEnabled!==false:defaultTrackEnabled;
      const button=byId('track-toggle');
      button.textContent=`Rastreio ${enabled?'ON':'OFF'}`;
      button.setAttribute('aria-pressed',String(enabled));
      button.title=selected
        ?`Rastreio ${enabled?'ligado':'desligado'} desta marcação. Clique para alternar.`
        :'Clique para configurar o rastreio das próximas marcações.';
      byId('delete-selected').disabled=!selected;
      byId('trace-delete-point').disabled=scanningActive||selected?.kind!=='point';
    }
    byId('track-toggle').addEventListener('click',()=>{
      const selected=annotations[selectedIndex];
      if(selected){
        selected.trackEnabled=selected.trackEnabled===false;
        fineTrails.clear();finePeak=null;
        if(selected.trackEnabled===false)singlePointTrails.delete(selectedIndex);
        message(`Rastreio ${selected.trackEnabled?'ON':'OFF'} para ${selected.kind==='full8'?'esta análise completa':selected.kind==='angle'?'este ângulo':selected.kind==='line'?'esta linha':'este ponto'}. Os demais desenhos mantêm suas escolhas.`);
      }else{
        defaultTrackEnabled=!defaultTrackEnabled;
        message(`Rastreio ${defaultTrackEnabled?'ON':'OFF'} para as próximas marcações.`);
      }
      // Rastreio ON também prepara o acompanhamento com a rodinha. A caixa
      // separada de "Seguir por quadro" podia ficar desligada sem aviso.
      if((selected?selected.trackEnabled!==false:defaultTrackEnabled)&&hasFileVideo())
        byId('fine-mode').checked=true;
      render();updateCameraControls();schedulePhotoSave();
    });

    function render() {
      if(stillFromVideo&&!annotations.length)recoverWheelAnchor();
      occupiedTags=[];
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (photoLoaded) ctx.drawImage(original,0,0,canvas.width,canvas.height);
      else {
        ctx.fillStyle='#15212b';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#b6c8d4';ctx.textAlign='center';
        ctx.font=`${Math.max(18,canvas.width/36)}px system-ui,sans-serif`;
        ctx.fillText('Escolha a fotografia do atleta',canvas.width/2,canvas.height/2);
        ctx.textAlign='start';
      }
      if(cycleTrailsVisible&&cycleResult){
        for(const [role,color] of [['heel','#a8f5c3'],['hip','#64cbff']]){
          const path=role==='heel'?cycleResult.heelPath:cycleResult.hipPath;
          if(path.length<2)continue;
          ctx.save();ctx.beginPath();ctx.lineWidth=Math.max(2,lineWidth);
          ctx.strokeStyle=color;ctx.globalAlpha=.75;
          path.forEach((p,i)=>{
            const x=p.x/cycleResult.width*canvas.width,y=p.y/cycleResult.height*canvas.height;
            if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          });
          ctx.stroke();ctx.restore();
        }
      }
      if(stillFromVideo&&byId('fine-mode').checked){
        for(const [key,path] of fineTrails){
          if(path.length<2)continue;
          const [itemIndex,pointIndex]=key.split(':').map(Number);
          const item=annotations[itemIndex];
          if(!isPointVisible(item,pointIndex))continue;
          const color=item?.color||(item?.role==='hip'?'#64cbff':'#a8f5c3');
          ctx.save();ctx.globalAlpha=.52;ctx.strokeStyle=color;
          ctx.lineWidth=Math.max(1.5,lineWidth*.55);ctx.beginPath();
          path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
          ctx.stroke();ctx.restore();
        }
      }
      // Caminho do marcador individual permanece sobre a imagem, mesmo ao
      // pausar ou desligar a opção de seguir vários marcadores por quadro.
      for(const [index,path] of singlePointTrails){
        if(path.length<2||annotations[index]?.kind!=='point')continue;
        const item=annotations[index];
        const color=item.color||(item.role==='hip'?'#64cbff':'#a8f5c3');
        ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
        ctx.strokeStyle=color;ctx.globalAlpha=.9;
        ctx.lineWidth=Math.max(2,lineWidth*.9);
        ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
        const first=path[0],last=path[path.length-1];
        ctx.globalAlpha=1;ctx.fillStyle=color;
        ctx.beginPath();ctx.arc(first.x,first.y,3.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(last.x,last.y,4,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
      annotations.forEach((item,index) => drawAnnotation(item,index));
      if(stillFromVideo){
        for(const lost of fineUncertain){
          const item=annotations[lost.item];
          const p=item?.points?.[lost.point];
          if(!p||!isPointVisible(item,lost.point))continue;
          ctx.save();ctx.strokeStyle='#ffb45e';ctx.lineWidth=2.5;
          ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        if(byId('fine-mode').checked&&byId('fine-boxes').checked&&selectedIndex>=0){
          const marker=annotations[selectedIndex]?.points?.[0];
          if(marker){
            const scale=canvas.width/Math.min(960,video.videoWidth||960);
            const patch=Number(byId('fine-patch').value)*scale;
            const search=Number(byId('fine-search').value)*scale;
            ctx.save();ctx.setLineDash([5,5]);ctx.lineWidth=1.5;
            ctx.strokeStyle='#64cbff';ctx.strokeRect(marker.x-search,marker.y-search,search*2,search*2);
            ctx.strokeStyle='#fff';ctx.strokeRect(marker.x-patch,marker.y-patch,patch*2,patch*2);
            ctx.restore();
          }
        }
      }
      if (draft.length) drawAnnotation({kind:tool,points:draft},annotations.length,true);
      updateValues();
      updateTrajectoryReadout();
      updateTrackToggle();
    }

    function updateFull8Guide(){
      const guide=byId('full8-guide');
      guide.hidden=tool!=='full8';
      byId('full8-actions').hidden=tool!=='full8';
      if(tool==='full8')guide.textContent=full8ManualMode?
        `${full8Sequence.length}/8 marcados · próximo: ${FULL8_POINTS[full8Sequence.length]}`:
        'Boneco pronto: arraste uma linha para mover tudo; arraste cada bolinha para acertar o refletor. O pé é medido em relação ao solo.';
    }

    function installFull8Skeleton(){
      if(!photoLoaded||canvas.hidden||!canvas.width||!canvas.height)return false;
      let existing=annotations.findIndex(item=>item.kind==='full8'&&item.points.length===8);
      if(existing<0){
        annotations.push({uid:newMarkUid(),kind:'full8',points:full8Template(canvas.width,canvas.height),
          trackEnabled:defaultTrackEnabled,color:colors.full8});
        existing=annotations.length-1;
        lastDeletedAnnotation=null;
      }
      selectedIndex=existing;render();updateCameraControls();schedulePhotoSave();
      message('Boneco completo colocado! Arraste uma linha para mover as oito referências juntas; ajuste as bolinhas nos refletores e use Espelhar/−/+ se necessário.');
      return true;
    }
    function transformFull8(transform){
      if(canvas.hidden){message('Congele o vídeo para ajustar o boneco.');return;}
      const index=annotations[selectedIndex]?.kind==='full8'?selectedIndex:
        annotations.findIndex(item=>item.kind==='full8');
      if(index<0){message('Primeiro coloque o boneco sobre uma foto ou quadro congelado.');return;}
      const item=annotations[index];
      const xs=item.points.map(p=>p.x),ys=item.points.map(p=>p.y);
      const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
      item.points=item.points.map(p=>constrain({x:cx+(p.x-cx)*(transform==='mirror'?-1:transform),
        y:cy+(p.y-cy)*(transform==='mirror'?1:transform)}));
      selectedIndex=index;fineUncertain=[];render();updateCameraControls();schedulePhotoSave();
      message('Proporção do boneco ajustada. Agora confira e arraste cada ponto sobre seu refletor.');
    }
    function snapFull8ToReflectors(){
      if(!photoLoaded||canvas.hidden){message('Primeiro congele uma imagem com o boneco visível.');return;}
      const index=annotations[selectedIndex]?.kind==='full8'?selectedIndex:
        annotations.findIndex(item=>item.kind==='full8');
      if(index<0){message('Primeiro coloque o boneco sobre o ciclista.');return;}
      let pixels;
      try{pixels=originalCtx.getImageData(0,0,original.width,original.height);}
      catch(_){message('Não foi possível examinar os refletores desta imagem. Ajuste os pontos com o mouse.');return;}
      const group=annotations[index],radius=Math.max(22,Math.min(140,canvas.width*.08));
      const targets=activeFull8Points();
      if(!targets.length){message('Selecione uma região do boneco antes de encaixar refletores.');return;}
      const used=[],notFound=[];
      let foundCount=0;
      group.points=group.points.map((p,j)=>{
        if(!targets.includes(j))return {...p};
        const found=reflectorNear(pixels,p,radius,used);
        if(!found){notFound.push({item:index,point:j});return {...p};}
        used.push(found);foundCount++;
        return constrain(found);
      });
      if(foundCount){
        selectedIndex=index;
        group.reflectorMode=true;
        fineUncertain=fineUncertain.filter(p=>p.item!==index).concat(notFound);
        render();updateCameraControls();schedulePhotoSave();
      }
      message(foundCount?`${foundCount}/${targets.length} referências visíveis foram encaixadas em regiões refletivas. Confira a anatomia: pontos laranja precisam de correção manual.`:
        'Nenhum refletor isolado foi identificado perto das bolinhas. Mova o boneco inteiro para perto dos plugs e tente novamente.');
    }
    byId('full8-reflectors').addEventListener('click',snapFull8ToReflectors);
    byId('full8-mirror').addEventListener('click',()=>transformFull8('mirror'));
    byId('full8-shrink').addEventListener('click',()=>transformFull8(.88));
    byId('full8-grow').addEventListener('click',()=>transformFull8(1.14));
    byId('full8-manual').addEventListener('click',()=>selectTool('full8',true));

    function selectTool(next,manual=false) {
      full8ManualMode=next==='full8'&&manual;
      tool=next;draft=[];angleSequence=[];full8Sequence=[];activeDrag=null;activeDraw=null;
      // Não permitir que o modo "só ponto livre" esconda o boneco que o
      // usuário acabou de pedir para posicionar.
      if(next==='full8'&&byId('marker-group').value==='free'){
        byId('marker-group').value='all';updateMarkerGroupNote();
      }
      byId('point-role-field').hidden=true; // O ponto é livre: não precisa escolher parte do corpo.
      for (const button of section.querySelectorAll('[data-2d-tool]'))
        button.setAttribute('aria-pressed',String(button.getAttribute('data-2d-tool')===tool));
      updateFull8Guide();
      render();
      if(tool==='full8'&&!full8ManualMode){
        if(!video.hidden&&videoCanCapture())captureVideoFrame();
        if(installFull8Skeleton())return;
        message('Abra uma foto ou vídeo e congele a imagem para colocar o boneco completo.');
        return;
      }
      if(!video.hidden && videoCanCapture()){
        message(tool==='full8'?'Marcação manual: congele o vídeo e clique nos oito pontos em ordem.':
          'Ferramenta pronta. Clique sobre o atleta para congelar. Ângulo: marque os 3 pontos com cliques ou abra as hastes arrastando.');
        return;
      }
      if (!photoLoaded) return;
      message(tool==='full8' ? 'Modo manual: 1 Punho → 2 Cotovelo → 3 Ombro → 4 Quadril → 5 Joelho → 6 Tornozelo → 7 Metatarso → 8 Calcanhar.' :
        tool==='angle' ? 'Ângulo: clique em trocânter → côndilo → maléolo (3 cliques), ou arraste para abrir um ângulo. Depois puxe qualquer ponto, sem mudar de ferramenta.' :
        tool==='line' ? 'Linha: clique e ARRASTE do início ao fim. Segure Shift para alinhar horizontalmente ao solo (0°).' :
        tool==='point' ? 'Ponto: clique onde quiser no atleta. Arraste-o diretamente para corrigir e use Rastreio ON/OFF.' :
        'Ajustar: arraste uma ponta ou o corpo da linha/ângulo para reposicionar.');
    }
    function chooseAngleColor(color){
      if(!palette.includes(color))return;
      activeAngleColor=color;
      for(const button of section.querySelectorAll('[data-angle-color]'))
        button.setAttribute('aria-pressed',String(button.dataset.angleColor===color));
      if(annotations[selectedIndex]?.kind==='angle'){
        annotations[selectedIndex].color=color;render();schedulePhotoSave();
      }
    }
    for(const button of section.querySelectorAll('[data-angle-color]')){
      button.style.backgroundColor=button.dataset.angleColor;
      button.addEventListener('click',()=>chooseAngleColor(button.dataset.angleColor));
    }
    chooseAngleColor(activeAngleColor);

    function findPoint(point,event) {
      const rect = canvas.getBoundingClientRect();
      const tolerance = Math.max(10,18 * canvas.width / rect.width);
      for (let i=annotations.length-1;i>=0;i--) {
        for (let j=annotations[i].points.length-1;j>=0;j--) {
          if(!isPointVisible(annotations[i],j))continue;
          const p=annotations[i].points[j];
          if (Math.hypot(p.x-point.x,p.y-point.y)<=tolerance)
            return {item:i,index:j,pointer:event.pointerId};
        }
      }
      return null;
    }
    function angleLabelAt(point){
      for(let i=annotations.length-1;i>=0;i--){
        const a=annotations[i];
        if(a.kind!=='angle'||!a.labelBounds)continue;
        const {left,right,top,bottom}=a.labelBounds;
        if(point.x>=left-3&&point.x<=right+3&&point.y>=top-3&&point.y<=bottom+3)return i;
      }
      return -1;
    }

    function findSegment(point,event) {
      const rect=canvas.getBoundingClientRect();
      const tolerance=Math.max(8,12*canvas.width/rect.width);
      for (let i=annotations.length-1;i>=0;i--) {
        const pts=annotations[i].points;
        const segments=annotations[i].kind==='angle' ? [[0,1],[1,2]] : annotations[i].kind==='line' ? [[0,1]] :
          annotations[i].kind==='full8' ? visibleFull8Segments() : [];
        if (segments.some(([a,b])=>segmentDistance(point,pts[a],pts[b])<=tolerance))
          return {item:i,index:-1,pointer:event.pointerId,origin:point,
            original:pts.map(p=>({...p}))};
      }
      return null;
    }

    function annotationAt(event){
      const point=pointAt(event);
      if(!point)return -1;
      const endpoint=findPoint(point,event);
      if(endpoint)return endpoint.item;
      const label=angleLabelAt(point);
      if(label>=0)return label;
      const segment=findSegment(point,event);
      return segment?segment.item:-1;
    }
    function closeDeleteMenu(){
      deleteMenu.hidden=true;
      pendingDeleteIndex=-1;
    }
    function deleteAnnotation(index){
      if(index<0||index>=annotations.length)return false;
      // Invalida um seek/rastreio assíncrono que poderia restaurar a geometria
      // antiga depois do clique em Excluir.
      fineNavigationEpoch++;
      if(scanningActive)scanCancelled=true;
      if(trackingActive)stopTracking(false);
      lastTrackedGeometry=null;pointTrails.clear();trackedLastValues.clear();
      trackOverlay.hidden=true;
      const removed=annotations[index];
      const kind=removed.kind;
      const uid=removed.uid||(removed.uid=newMarkUid());
      const affected=globalThis.PAIVA_2D_HISTORY?.removeFromFrames(timelineFrames,uid)||[];
      deletedMarkIds.add(uid);
      lastDeletedAnnotation={index,item:removed,uid,affected};
      annotations.splice(index,1);
      // Excluir um ângulo com pontos/linhas restantes também é exclusão
      // explícita; a referência da rodinha não pode ressuscitar esse ângulo.
      if(wheelAnchor?.source===recordedUrl){
        wheelAnchor.marks=wheelAnchor.marks.filter(item=>item.uid!==uid);
        if(!wheelAnchor.marks.length)wheelAnchor=null;
      }
      // Se houver outros ângulos, preservá-los. Excluir um único ângulo não
      // deve desmontar todas as referências do projeto.
      selectedIndex=-1;draft=[];angleSequence=[];full8Sequence=[];activeDrag=null;activeDraw=null;
      updateFull8Guide();
      fineTrails.clear();singlePointTrails.clear();fineUncertain=[];finePeak=null;
      byId('fine-readout').textContent='Marcação excluída · Desfazer restaura';
      closeDeleteMenu();
      rememberTimelineFrame(0);
      if((kind==='angle'||kind==='full8')&&timelineIdentity&&stillFromVideo){
        const slot=timelineSlot(video.currentTime);
        if(slot?.entry){
          slot.entry.angularCleared=!annotations.some(isAngular);
          scheduleTimelinePersist(0);
        }
      }
      render();updateCameraControls();schedulePhotoSave();
      const type=kind==='full8'?'Análise completa':kind==='angle'?'Ângulo':kind==='point'?'Ponto':'Linha';
      message(`${type} excluído. Clique em “Desfazer” para recuperar se precisar.`);
      return true;
    }
    deleteMenu.querySelector('#paiva-2d-delete-confirm').addEventListener('click',()=>deleteAnnotation(pendingDeleteIndex));
    byId('delete-selected').addEventListener('click',()=>{
      if(!deleteAnnotation(selectedIndex))
        message('Selecione primeiro uma análise de oito pontos, um ângulo, uma linha ou um ponto para excluir.');
    });
    byId('trace-delete-point').addEventListener('click',()=>{
      if(annotations[selectedIndex]?.kind!=='point'||!deleteAnnotation(selectedIndex))
        message('Clique primeiro sobre o ponto verde que deseja excluir.');
    });
    deleteMenu.querySelector('#paiva-2d-delete-cancel').addEventListener('click',closeDeleteMenu);
    document.addEventListener('pointerdown',event=>{
      if(!deleteMenu.hidden&&!deleteMenu.contains(event.target))closeDeleteMenu();
    });
    canvas.addEventListener('contextmenu',event=>{
      if(!photoLoaded||scanningActive)return;
      // Excluir somente a marcação realmente atingida; nunca oferecer o
      // último desenho ao clicar num trecho vazio do atleta ou vídeo.
      const hit=annotationAt(event);
      if(hit<0){closeDeleteMenu();return;} // área vazia: pausa/play no player
      const index=hit;
      event.preventDefault();event.stopPropagation();
      pendingDeleteIndex=index;selectedIndex=index;
      updateTrackToggle();
      const kind=annotations[index].kind;
      deleteMenu.querySelector('#paiva-2d-delete-label').textContent=
        kind==='full8'?'Análise completa selecionada':kind==='angle'?'Ângulo selecionado':kind==='point'?'Ponto selecionado':'Linha selecionada';
      const width=170,height=88;
      deleteMenu.style.left=`${Math.max(4,Math.min(event.clientX,window.innerWidth-width-8))}px`;
      deleteMenu.style.top=`${Math.max(4,Math.min(event.clientY,window.innerHeight-height-8))}px`;
      deleteMenu.hidden=false;
      render();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!deleteMenu.hidden){
        event.preventDefault();event.stopImmediatePropagation();closeDeleteMenu();return;
      }
      if(event.key!=='Delete'||!photoLoaded||selectedIndex<0||document.activeElement!==canvas.parentElement)return;
      if(event.ctrlKey||event.altKey||event.metaKey)return;
      event.preventDefault();deleteAnnotation(selectedIndex);
    });

    for (const button of section.querySelectorAll('[data-2d-tool]'))
      button.addEventListener('click',() => selectTool(button.getAttribute('data-2d-tool')));
    byId('width').addEventListener('input', () => {
      lineWidth = Math.max(1,Math.min(20,Number(byId('width').value) || 3));
      byId('width-value').textContent = `${lineWidth} px`;
      render();
    });
    byId('width').addEventListener('change',schedulePhotoSave);
    byId('point-size').addEventListener('input',()=>{
      pointDiameter=Math.max(4,Math.min(36,Number(byId('point-size').value)||14));
      byId('point-size-value').textContent=pointDiameter+' px';
      const selected=annotations[selectedIndex];
      if(selected?.kind==='point')selected.diameter=pointDiameter;
      render();
    });
    byId('point-size').addEventListener('change',()=>{rememberTimelineFrame(0);schedulePhotoSave();});
    function availableImageHeight(){
      const view=section.querySelector('.paiva-2d-view');
      const viewport=canvas.parentElement;
      let controls=0;
      for(const element of view.children){
        if(element===viewport || element.hidden || getComputedStyle(element).display==='none')continue;
        const css=getComputedStyle(element);
        controls+=element.offsetHeight+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0);
      }
      const fullHeight=window.visualViewport?.height||window.innerHeight;
      // Reserva margem para título, barras do navegador e espaçamento do layout.
      const viewportLimit=parseFloat(getComputedStyle(viewport).maxHeight);
      const byWindow=Math.max(180,Math.floor(fullHeight-controls-
        (section.classList.contains('paiva-2d-expanded')?56:82)));
      // A própria janela de desenho tem limite de altura: respeitá-lo impede
      // o reaparecimento de barras internas mesmo em monitores muito largos.
      return Number.isFinite(viewportLimit)?Math.min(byWindow,Math.max(150,viewportLimit-4)):byWindow;
    }
    function updateZoom(value) {
      const next=Math.max(100,Math.min(400,Math.round(value/5)*5));
      byId('zoom').value=String(next);
      byId('zoom-value').textContent=`${next}%`;
      // O desenho e o vídeo usam exatamente o MESMO enquadramento calculado.
      // 100% cabe inteiro no quadro e aproveita a tela, sem encolher ao capturar.
      const viewport=canvas.parentElement;
      const fitHeight=availableImageHeight();
      const ratio=canvas.width/Math.max(1,canvas.height);
      const fitWidth=Math.max(1,Math.min(Math.max(1,viewport.clientWidth-4),fitHeight*ratio));
      canvas.style.width=`${Math.round(fitWidth*next/100)}px`;
      canvas.style.maxWidth=next===100?'100%':'none';
      canvas.style.maxHeight=next===100?`${fitHeight}px`:'none';
      canvas.style.height='auto';
      if(!video.hidden)fitVideoImage();
      // Zoom centrado, inclusive na primeira captura. O conteúdo ampliado pode
      // ser deslocado manualmente depois, sem encolher a foto nem alterar medidas.
      if(viewport){
        viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
        viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2);
      }
    }
    byId('fit').addEventListener('click',()=>updateZoom(100));
    window.addEventListener('resize',()=>updateZoom(Number(byId('zoom').value)));
    let previousBodyOverflow='';
    function setWideMode(enable){
      if(section.classList.contains('paiva-2d-expanded')===enable)return;
      section.classList.toggle('paiva-2d-expanded',enable);
      if(enable){previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
      else document.body.style.overflow=previousBodyOverflow;
      byId('wide').textContent=enable?'↙ Sair da tela ampla':'⛶ Tela ampla';
      byId('wide').setAttribute('aria-pressed',String(enable));
      updateZoom(Number(byId('zoom').value));
      if(!video.hidden)fitVideoImage();
    }
    byId('wide').addEventListener('click',()=>setWideMode(!section.classList.contains('paiva-2d-expanded')));
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&section.classList.contains('paiva-2d-expanded'))setWideMode(false);
      if(event.key==='Escape'&&(angleSequence.length||full8Sequence.length)){
        angleSequence=[];full8Sequence=[];draft=[];activeDraw=null;updateFull8Guide();render();
        message('Marcação incompleta cancelada. Pode começar novamente.');
      }
    });
    byId('zoom').addEventListener('input',()=>updateZoom(Number(byId('zoom').value)));
    byId('zoom-in').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)+5));
    byId('zoom-out').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)-5));
    byId('zoom-reset').addEventListener('click',()=>updateZoom(100));
    byId('help').addEventListener('click',() => {
      const box=byId('explain');const open=box.hidden;
      box.hidden=!open;byId('help').setAttribute('aria-expanded',String(open));
    });

    // A webcam serve como fonte de quadros. Um rastreio experimental local pode
    // seguir pontos contrastantes do vídeo gravado; nunca é medição validada.
    let cameraStream = null;
    let recorder = null;
    let recordedChunks = [];
    let recordingTimer = null;
    let recordedUrl = null;
    let currentVideoFile = null;
    let lastFrameFromVideo = false;
    let stillFromVideo = false;
    let motionTracker = null;
    let lastTrackedGeometry=null;
    let trackingActive = false;
    let scanningActive = false,scanCancelled = false;
    const trackOverlay=byId('track-overlay');
    const trackCtx=trackOverlay.getContext('2d');
    const pointTrails=new Map();
    const trackedLastValues=new Map();
    const maxRecordingMs = 180000;
    let scrubActive=false,wheelAccumulator=0;
    let scrubPointerDown=false,scrubReleasePending=false,pendingScrubTime=null;
    let fineNavigationEpoch=0;

    const hasFileVideo=()=>!!recordedUrl && video.getAttribute('src')===recordedUrl;
    const clockTime=value=>{
      if(!Number.isFinite(value)||value<0)return '00:00,0';
      const whole=Math.floor(value);
      return `${String(Math.floor(whole/60)).padStart(2,'0')}:${String(whole%60).padStart(2,'0')},${Math.floor(value*10)%10}`;
    };
    function syncTimeline() {
      const available=hasFileVideo()&&Number.isFinite(video.duration)&&video.duration>0;
      const slider=byId('scrub');
      slider.disabled=!available;
      slider.max=String(available?video.duration:1);
      if(!scrubActive)slider.value=String(available?Math.max(0,Math.min(video.duration,video.currentTime)):0);
      byId('time-current').textContent=clockTime(available?(scrubActive?Number(slider.value):video.currentTime):0);
      byId('time-total').textContent=clockTime(available?video.duration:0);
    }
    function showVideo(enabled) {
      video.hidden = !enabled;
      canvas.hidden = enabled;
      if(!enabled)trackOverlay.hidden=true;
      // Ferramentas de marcação permanecem sempre visíveis, inclusive no vídeo.
      const videoContext=hasFileVideo()&&(enabled||stillFromVideo);
      section.querySelector('.paiva-2d-player-dock').hidden=!videoContext;
      section.querySelector('.paiva-2d-marking-dock').hidden=false;
      section.querySelector('.paiva-2d-angle-palette').hidden=false;
      byId('auto-track').disabled=!enabled;
      for (const button of section.querySelectorAll('[data-2d-tool]')) button.disabled=scanningActive;
      for (const key of ['undo','clear','save']) byId(key).disabled=enabled||scanningActive;
      byId('width').disabled=scanningActive;
      if(enabled)requestAnimationFrame(()=>{fitVideoImage();if(!trackingActive)paintHeldOverlay();});
    }
    function fitVideoImage(){
      if(video.hidden||!video.videoWidth||!video.videoHeight)return;
      const fitHeight=availableImageHeight();
      const fitWidth=Math.min(Math.max(1,video.parentElement.clientWidth-4),
        fitHeight*video.videoWidth/video.videoHeight);
      const zoom=Number(byId('zoom').value)||175;
      video.style.width=`${Math.round(fitWidth*zoom/100)}px`;
      video.style.height='auto';video.style.maxWidth=zoom===100?'100%':'none';
      video.style.maxHeight=zoom===100?`${fitHeight}px`:'none';
      const viewport=video.parentElement;
      viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
      viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2);
      if(!trackOverlay.hidden)alignTrackedOverlay();
    }

    function updateCameraControls() {
      const live = !!cameraStream;
      const recording = recorder?.state === 'recording';
      const hasPlayback = !!recordedUrl && video.getAttribute('src')===recordedUrl;
      byId('camera-start').disabled = live || recording;
      byId('camera-quality').disabled = live || recording;
      byId('camera-stop').disabled = !live;
      byId('record').disabled = !live || recording || typeof MediaRecorder === 'undefined';
      byId('stop-record').disabled = !recording;
      byId('capture').disabled = scanningActive || recording || (!live && !hasPlayback);
      byId('track-start').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.trackEnabled!==false) || trackingActive || recording;
      byId('scan-short').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.kind==='angle'&&item.trackEnabled!==false) || trackingActive || recording;
      byId('cycle-start').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.kind==='angle'&&item.trackEnabled!==false) || trackingActive || recording;
      byId('scan-radius').disabled = scanningActive;
      byId('cycle-duration').disabled = scanningActive;
      byId('track-stop').disabled = !trackingActive && !scanningActive;
      const canFine=hasPlayback&&!recording&&!scanningActive;
      byId('track-toggle').disabled=scanningActive;
      byId('trace-point').disabled=!canFine||finePending>0||trackingActive||!lastFrameFromVideo||
        !stillFromVideo||chosenPointIndex()<0||annotations[chosenPointIndex()]?.trackEnabled===false;
      byId('trace-point').textContent=scanningActive?'Traçando…':'↗ Traçar ponto';
      byId('trace-stop').disabled=!scanningActive;
      byId('trace-duration').disabled=scanningActive;
      byId('trace-clear').disabled=scanningActive||singlePointTrails.size===0;
      byId('trace-delete-point').disabled=scanningActive||
        annotations[selectedIndex]?.kind!=='point';
      byId('fine-prev').disabled=!canFine;
      byId('fine-next').disabled=!canFine;
      byId('fine-peak').disabled=!canFine||!finePeak;
      byId('speed').disabled = !hasPlayback || recording;
      byId('pingpong').disabled = !hasPlayback || recording;
      byId('play-video').disabled = !hasPlayback || recording || scanningActive;
      byId('pause-video').disabled = !hasPlayback || recording || scanningActive;
      syncTimeline();
    }

    function stopTracking(clear=true) {
      if(scanningActive)scanCancelled=true;
      motionTracker?.stop();motionTracker=null;trackingActive=false;
      // Ao pausar no mesmo instante, PRESERVAR a última camada já desenhada:
      // nela está o grau que acabou de ser calculado (por exemplo 145°).
      // Só voltar ao guia original quando o vídeo realmente mudar de instante.
      const recent=lastTrackedGeometry?.source===recordedUrl&&!video.hidden&&
        Math.abs((lastTrackedGeometry?.time??-10)-video.currentTime)<.08;
      if(clear&&(!recent||trackOverlay.hidden))paintHeldOverlay();
      updateCameraControls();
    }

    function lastTrackedAnnotations(){
      const kept=cloneAnnotations(annotations);
      if(lastTrackedGeometry?.source!==recordedUrl)return kept;
      for(const item of lastTrackedGeometry.entries){
        if(kept[item.index]&&kept[item.index].points.length===item.points.length)
          kept[item.index].points=item.points.map(p=>({...p}));
      }
      return kept;
    }

    function alignTrackedOverlay() {
      if(!video.videoWidth || !video.videoHeight)return;
      const frame=video.getBoundingClientRect();
      const holder=video.parentElement.getBoundingClientRect();
      const ratio=video.videoWidth/video.videoHeight;
      if(!frame.width || !frame.height || !holder.width)return;
      const visibleWidth=Math.min(frame.width,frame.height*ratio);
      const visibleHeight=visibleWidth/ratio;
      trackOverlay.style.width=`${visibleWidth}px`;
      trackOverlay.style.height=`${visibleHeight}px`;
      trackOverlay.style.left=`${frame.left-holder.left+video.parentElement.scrollLeft+(frame.width-visibleWidth)/2}px`;
      trackOverlay.style.top=`${frame.top-holder.top+video.parentElement.scrollTop+(frame.height-visibleHeight)/2}px`;
    }
    window.addEventListener('resize',()=>{if(!trackOverlay.hidden)alignTrackedOverlay();});

    // A camada visual não depende do rastreador. Ao sair do quadro congelado,
    // parar o rastreio ou chegar ao fim do vídeo, os graus permanecem visíveis.
    // São referências, NÃO medidas novas de um quadro ainda não corrigido.
    function paintHeldOverlay(){
      if(stillFromVideo&&!annotations.length)recoverWheelAnchor();
      if(!trackCtx||video.hidden||!hasFileVideo()||!stillFromVideo||
        !annotations.length||!video.videoWidth||trackingActive){
        if(!trackingActive)trackOverlay.hidden=true;
        return;
      }
      alignTrackedOverlay();
      const w=canvas.width,h=canvas.height;
      if(!(w>0&&h>0))return;
      trackOverlay.width=w;trackOverlay.height=h;
      trackCtx.clearRect(0,0,w,h);
      const stamp=(p,label,color)=>{
        trackCtx.font=`700 ${Math.max(12,Math.min(18,w/75))}px system-ui,sans-serif`;
        const width=trackCtx.measureText(label).width+12,height=25;
        const x=Math.max(4,Math.min(w-width-4,p.x+12));
        const y=Math.max(27,Math.min(h-4,p.y-11));
        trackCtx.fillStyle='rgba(8,25,33,.88)';trackCtx.fillRect(x,y-height,width,height);
        trackCtx.strokeStyle=color;trackCtx.lineWidth=1;trackCtx.strokeRect(x,y-height,width,height);
        trackCtx.fillStyle='#effdff';trackCtx.fillText(label,x+6,y-8);
      };
      annotations.forEach(item=>{
        const pts=item.points,color=item.color||colors[item.kind]||'#70d8e8';
        if(!pts?.length)return;
        trackCtx.beginPath();
        if(item.kind==='full8'){
          for(const [a,b] of visibleFull8Segments()){
            trackCtx.moveTo(pts[a].x,pts[a].y);trackCtx.lineTo(pts[b].x,pts[b].y);
          }
        }else{
          trackCtx.moveTo(pts[0].x,pts[0].y);
          if(item.kind!=='point')for(let i=1;i<pts.length;i++)trackCtx.lineTo(pts[i].x,pts[i].y);
        }
        trackCtx.lineWidth=Math.max(2,lineWidth);trackCtx.strokeStyle=color;trackCtx.stroke();
        pts.forEach((p,j)=>{
          if(!isPointVisible(item,j))return;
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,6,0,2*Math.PI);
          trackCtx.fillStyle='#102631';trackCtx.fill();
          trackCtx.strokeStyle=color;trackCtx.lineWidth=2;trackCtx.stroke();
        });
        if(item.kind==='angle'&&pts.length===3){
          const a=displayedAngle(item);
          stamp(pts[1],a===null?'A — · corrigir':`A ${format(a)}° · referência`,color);
        }else if(item.kind==='full8'&&pts.length===8){
          const m=stableFull8Measurements(item);
          if(m){
            const view=byId('marker-group').value;
            if(view==='all'||view==='leg')stamp(pts[4],m.knee===null?'Joelho — · corrigir':`Joelho ${format(m.knee)}° · referência`,color);
            if(view==='all'||view==='foot')stamp(pts[6],m.foot===null?'Pé — · corrigir':`Pé/solo ${format(m.foot)}° · referência`,color);
            if(view==='upper')stamp(pts[2],m.trunk===null?'Tronco — · corrigir':`Tronco ${format(m.trunk)}° · referência`,color);
          }
        }
      });
      trackCtx.fillStyle='rgba(9,28,38,.86)';
      trackCtx.fillRect(4,4,Math.min(w-8,292),23);
      trackCtx.fillStyle='#ffc786';trackCtx.font='700 13px system-ui,sans-serif';
      trackCtx.fillText('GUIA RETIDO · congele para conferir',12,20);
      trackOverlay.hidden=false;
    }
    video.addEventListener('seeked',()=>{if(!video.hidden&&!trackingActive)paintHeldOverlay();});

    function paintTracked(points,w,h,time,uncertain=[]) {
      if (!trackCtx) return;
      alignTrackedOverlay();
      trackOverlay.width=w;trackOverlay.height=h;
      trackCtx.clearRect(0,0,w,h);
      trackCtx.lineWidth=2;trackCtx.lineCap='round';trackCtx.lineJoin='round';
      const readings=[];
      const lost=new Set(uncertain.map(p=>`${p.item}:${p.point}`));
      const needsCheck=(item,indices)=>indices.some(point=>lost.has(`${item}:${point}`));
      points.forEach((item,index)=> {
        const pts=item.points;
        const color=item.color||(item.kind==='angle'?'#ffe9a8':item.kind==='point'&&item.role==='hip'?'#64cbff':item.kind==='point'?'#a8f5c3':'#a6eeff');
        if(item.kind==='point'){
          const p=pts[0];
          if(!p)return;
          const trail=pointTrails.get(index)||[];
          if(!trail.length||Math.hypot(trail[trail.length-1].x-p.x,trail[trail.length-1].y-p.y)>.5)trail.push({...p});
          if(trail.length>180)trail.shift();
          pointTrails.set(index,trail);
          if(trail.length>1){
            trackCtx.beginPath();trackCtx.moveTo(trail[0].x,trail[0].y);
            for(let j=1;j<trail.length;j++)trackCtx.lineTo(trail[j].x,trail[j].y);
            trackCtx.strokeStyle=item.role==='hip'?'rgba(100,203,255,.82)':'rgba(168,245,195,.82)';
            trackCtx.lineWidth=2;trackCtx.stroke();
          }
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,5,0,Math.PI*2);
          trackCtx.fillStyle=color;trackCtx.fill();
          trackCtx.strokeStyle='#102d25';trackCtx.lineWidth=1.5;trackCtx.stroke();
          if(needsCheck(index,[0])){
            trackCtx.beginPath();trackCtx.arc(p.x,p.y,11,0,2*Math.PI);
            trackCtx.strokeStyle='#ffb45e';trackCtx.lineWidth=2.5;trackCtx.stroke();
          }
          readings.push(`${item.role==='heel'?'Calcanhar':item.role==='hip'?'Quadril':`Ponto ${index+1}`} · trajetória`);
          return;
        }
        trackCtx.strokeStyle=color;trackCtx.fillStyle=color;
        trackCtx.beginPath();
        if(item.kind==='full8'){
          for(const [a,b] of visibleFull8Segments()){
            trackCtx.moveTo(pts[a].x,pts[a].y);trackCtx.lineTo(pts[b].x,pts[b].y);
          }
        }else{
          trackCtx.moveTo(pts[0].x,pts[0].y);
          for(let j=1;j<pts.length;j++)trackCtx.lineTo(pts[j].x,pts[j].y);
        }
        trackCtx.stroke();
        for(let j=0;j<pts.length;j++){
          if(!isPointVisible(item,j))continue;
          const p=pts[j];
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,4,0,Math.PI*2);
          trackCtx.fill();
          if(needsCheck(index,[j])){
            trackCtx.beginPath();trackCtx.arc(p.x,p.y,11,0,2*Math.PI);
            trackCtx.strokeStyle='#ffb45e';trackCtx.lineWidth=2.5;trackCtx.stroke();
          }
        }
        if(item.kind==='angle') {
          const actual=angleDegrees(pts[0],pts[1],pts[2]);
          const cached=trackedLastValues.get(index)||{};
          const provisional=needsCheck(index,[0,1,2])||actual===null;
          if(!provisional){cached.angle=actual;trackedLastValues.set(index,cached);}
          const angle=provisional?(cached.angle??actual):actual;
          const shown=angle===null?null:item.supplementary?180-angle:angle;
          const label=shown===null?'A — · corrigir':`A ${provisional?'≈ ':''}${format(shown)}°${provisional?' · conferir':''}`;
          readings.push(label);
          trackCtx.font='650 13px system-ui,sans-serif';
          trackCtx.fillText(label,Math.min(w-115,pts[1].x+8),Math.max(15,pts[1].y-8));
        }else if(item.kind==='full8'&&pts.length===8){
          const m=full8Measurements(pts);
          const cached=trackedLastValues.get(index)||{};
          trackCtx.font='650 13px system-ui,sans-serif';
          const kneePending=needsCheck(index,[3,4,5])||m.knee===null;
          const footPending=needsCheck(index,[6,7])||m.foot===null;
          const trunkPending=needsCheck(index,[2,3])||m.trunk===null;
          if(!kneePending)cached.knee=m.knee;
          if(!footPending)cached.foot=m.foot;
          if(!trunkPending)cached.trunk=m.trunk;
          trackedLastValues.set(index,cached);
          const view=byId('marker-group').value;
          const candidates=[['Joelho',pts[4],m.knee,'knee',kneePending,['all','leg']],
            ['Pé/solo',pts[6],m.foot,'foot',footPending,['all','foot']],
            ['Tronco',pts[2],m.trunk,'trunk',trunkPending,['upper']]];
          for(const [name,point,value,key,pending,views] of candidates){
            if(!views.includes(view))continue;
            const last=pending?(cached[key]??value):value;
            const label=last===null?`${name} — · corrigir`:`${name} ${pending?'≈ ':''}${format(last)}°${pending?' · conferir':''}`;
            readings.push(label);
            trackCtx.fillText(label,Math.min(w-130,point.x+8),Math.max(15,point.y-8));
          }
        }
      });
      byId('values').textContent=`Rastreio experimental ${time.toFixed(1).replace('.',',')} s · ${readings.join('  |  ') || 'linhas em movimento'}${lost.size?` · ${lost.size} ponto(s) para corrigir`:''}`;
      trackOverlay.hidden=false;
    }

    async function startTracking() {
      if (trackingActive || scanningActive || !lastFrameFromVideo ||
        !annotations.some(a=>a.trackEnabled!==false) || !recordedUrl) return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if (!motion?.create || !trackCtx) {message('Módulo de rastreio indisponível. Atualize todos os arquivos do aplicativo.');return;}
      pointTrails.clear();
      trackedLastValues.clear();
      lastTrackedGeometry=null;
      const currentTime=video.currentTime;
      const trackedIndices=annotations.flatMap((item,i)=>item.trackEnabled!==false?[i]:[]);
      const selectedAnnotations=annotations.filter(a=>a.trackEnabled!==false);
      selectedAnnotations.forEach((item,index)=>{
        if(item.kind==='angle'){
          const value=angleDegrees(...item.points);
          if(value!==null||Number.isFinite(item.lastValidAngle))
            trackedLastValues.set(index,{angle:value??item.lastValidAngle});
        }else if(item.kind==='full8'){
          const value=stableFull8Measurements(item);
          trackedLastValues.set(index,{knee:value?.knee??null,foot:value?.foot??null});
        }
      });
      motionTracker=motion.create({video,annotations:selectedAnnotations.map(item=>({
        kind:item.kind,color:item.color,role:item.role,supplementary:!!item.supplementary,
        reflectorMode:!!item.reflectorMode,points:item.points.map(p=>({...p}))})),
        sourceWidth:canvas.width,sourceHeight:canvas.height,
        isLoopEnabled:()=>video.loop,
        onPoints:(points,w,h,t,uncertain=[])=>{
          lastTrackedGeometry={source:recordedUrl,time:t,uncertain,entries:points.map((item,i)=>({
            index:trackedIndices[i],points:item.points.map(p=>({
              x:p.x/w*canvas.width,y:p.y/h*canvas.height
            }))
          }))};
          paintTracked(points,w,h,t,uncertain);
        },
        onLost:reason=>{
          const held=lastTrackedAnnotations();
          video.pause();stopTracking();
          if(videoCanCapture()&&setFrame(video,video.videoWidth,video.videoHeight)){
            annotations=held;
            fineUncertain=held.flatMap((item,i)=>item.trackEnabled===false?[]:
              item.points.map((_,j)=>({item:i,point:j})));
            lastFrameFromVideo=true;stillFromVideo=true;
            byId('back-video').hidden=false;
            render();updateCameraControls();schedulePhotoSave(650,'tracking');
            message(`Rastreio interrompido em ${video.currentTime.toFixed(1).replace('.',',')} s. O ângulo ficou visível no último lugar conhecido. Corrija os pontos laranja antes de usar a medida. ${reason}`);
          }else{
            trackOverlay.hidden=false;
            message(`Rastreio interrompido. Os últimos marcadores foram mantidos sobre o vídeo; pause e capture para conferir. ${reason}`);
          }
        },
        onDone:()=>{stopTracking();message(video.loop
          ?'Vídeo reiniciado no começo. O rastreio da volta anterior foi encerrado; confira os ângulos antes de usar.'
          :'Fim do vídeo. Rastreio encerrado; confira os ângulos antes de usar.');}
      });
      showVideo(true);
      // O rastreador pode demorar para analisar seu primeiro quadro. Até lá,
      // a medida e os pontos originais já precisam estar desenhados no vídeo.
      paintHeldOverlay();trackOverlay.hidden=false;
      trackingActive=true;updateCameraControls();
      const started=await motionTracker.start();
      if (!started) {stopTracking();showVideo(false);return;}
      message(`Rastreio experimental iniciado em ${currentTime.toFixed(1).replace('.',',')} s. Use marcadores contrastantes e interrompa se um ponto se afastar da articulação.`);
    }
    async function scanShortSegment(){
      if(scanningActive||trackingActive||!lastFrameFromVideo||!hasFileVideo()||
        !annotations.some(item=>item.kind==='angle'&&item.trackEnabled!==false))return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanWindow){message('Atualize também athlete-motion.js para usar a busca de extensão.');return;}
      const radius=Number(byId('scan-radius').value)||0.5;
      const fps=Number(byId('file-fps').value)||30;
      const center=video.currentTime;
      video.pause();
      scanCancelled=false;scanningActive=true;
      updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Buscando a extensão em ±${String(radius).replace('.',',')} s do quadro marcado. Aguarde; você pode interromper em “Parar rastreio”.`);
      const scanSource=annotations.filter(item=>item.trackEnabled!==false);
      const scanUids=scanSource.map(item=>item.uid||(item.uid=newMarkUid()));
      try{
        const result=await motion.scanWindow({video,centerTime:center,radius,fps,
          annotations:scanSource.map(item=>({kind:item.kind,color:item.color,role:item.role,supplementary:!!item.supplementary,
            points:item.points.map(p=>({...p}))})),
          sourceWidth:canvas.width,sourceHeight:canvas.height,
          shouldCancel:()=>scanCancelled,
          onProgress:progress=>message(`Analisando quadros próximos… ${progress.tested} conferidos · maior A ${format(progress.bestAngle)}° até agora.`)
        });
        if(scanCancelled)return;
        // Ao terminar, expõe o quadro em que a MAIOR leitura experimental ocorreu.
        // Os pontos desse quadro são correspondências rastreadas, não detecção anatômica.
        originalCtx.drawImage(video,0,0,original.width,original.height);
        annotations=result.best.shapes.map((item,index)=>({uid:scanUids[index]||newMarkUid(),
          kind:item.kind,color:item.color,role:item.role,supplementary:item.supplementary,
          points:item.points.map(p=>({x:p.x/result.width*canvas.width,y:p.y/result.height*canvas.height}))}));
        lastFrameFromVideo=true;stillFromVideo=true;
        render();showVideo(false);updateZoom(Number(byId('zoom').value));
        newPhotoRecord();schedulePhotoSave();
        byId('back-video').hidden=false;
        message(`Maior leitura encontrada: A ${format(result.best.angle)}° em ${clockTime(result.best.time)} · ${result.tested} quadros próximos. ${result.partial?'Parte do intervalo foi interrompida por falta de referência; ':''}Confira visualmente cada ponto e a convenção angular antes de usar no bike fit.`);
      }catch(error){
        if(!scanCancelled)message(`Busca curta interrompida: ${error?.message||'não foi possível acompanhar os pontos'}. Confira contraste, FPS e posição dos marcadores.`);
      }finally{
        scanningActive=false;scanCancelled=false;
        updateCameraControls();
        for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=false;
      }
    }
    async function traceSinglePoint(){
      const index=chosenPointIndex();
      if(scanningActive||finePending>0||trackingActive||index<0||!stillFromVideo||!lastFrameFromVideo||!hasFileVideo())return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanSinglePoint){message('Atualize também athlete-motion.js para traçar o ponto.');return;}
      const start=video.currentTime;
      const selected=annotations[index];
      if(selected.trackEnabled===false){message('Ative “Rastreio ON” neste ponto antes de desenhar a trajetória.');return;}
      const point={...selected.points[0]};
      const duration=Number(byId('trace-duration').value)||1;
      const source=recordedUrl;
      const fps=Number(byId('file-fps').value)||30;
      video.pause();
      singlePointTrails.delete(index);
      scanCancelled=false;scanningActive=true;updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Traçando somente o ${selected.role==='hip'?'quadril':selected.role==='heel'?'calcanhar':'ponto'} por ${String(duration).replace('.',',')} s. O caminho fica desenhado; “Parar rastreio” interrompe.`);
      const displayPath=path=>{
        if(!path?.length||source!==recordedUrl||annotations[index]!==selected)return;
        singlePointTrails.set(index,path);
        const last=path[path.length-1];
        selected.points=[{x:last.x,y:last.y}];
        originalCtx.drawImage(video,0,0,original.width,original.height);
        lastFrameFromVideo=true;stillFromVideo=true;
        render();syncTimeline();
      };
      try{
        const result=await motion.scanSinglePoint({video,point,sourceWidth:canvas.width,
          sourceHeight:canvas.height,startTime:start,duration,fps,
          patch:Number(byId('fine-patch').value),search:Number(byId('fine-search').value),
          shouldCancel:()=>scanCancelled,
          onProgress:progress=>{
            displayPath(progress.path);
            message(`Traçando o ponto… ${progress.tested}/${progress.total} quadros. A linha mostra a trajetória observada.`);
          }
        });
        displayPath(result.path);
        schedulePhotoSave(400);
        message(`Trajetória desenhada em ${result.path.length} quadros. ${result.partial?'Trecho parcial: o ponto perdeu contraste ou a análise foi interrompida. ':''}Confira o caminho sobre o atleta.`);
      }catch(error){
        if(!scanCancelled)message(`Não foi possível traçar o ponto: ${error?.message||'erro no rastreamento'}. Coloque-o sobre uma referência contrastante, corrija e tente novamente.`);
      }finally{
        scanningActive=false;scanCancelled=false;
        updateCameraControls();
        for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=false;
      }
    }
    byId('trace-point').addEventListener('click',traceSinglePoint);
    byId('trace-stop').addEventListener('click',stopTrackingPlayback);
    byId('trace-clear').addEventListener('click',()=>{
      singlePointTrails.clear();render();updateCameraControls();schedulePhotoSave();
      message('Trajetória apagada. O ponto e os ângulos continuam preservados.');
    });
    function resetCycleResults(){
      cycleResult=null;cycleTrailsVisible=false;
      byId('cycle-results').hidden=true;
      if(photoLoaded)render();
    }
    function seekCycleFrame(time){
      timelineSeekSuppressed++;
      return new Promise((resolve,reject)=>{
        if(!hasFileVideo()||!Number.isFinite(video.duration)){
          reject(new Error('Vídeo indisponível para abrir o quadro.'));return;
        }
        const target=Math.max(0,Math.min(video.duration-.001,time));
        if(Math.abs(video.currentTime-target)<.0005&&video.readyState>=2){resolve();return;}
        let timer;
        const cleanup=()=>{
          clearTimeout(timer);
          video.removeEventListener('seeked',done);
          video.removeEventListener('error',fail);
        };
        const done=()=>{cleanup();resolve();};
        const fail=()=>{cleanup();reject(new Error('Não foi possível abrir esse quadro.'));};
        video.addEventListener('seeked',done);video.addEventListener('error',fail);
        timer=setTimeout(fail,7000);
        try{video.currentTime=target;}catch(_){fail();}
      }).finally(()=>{timelineSeekSuppressed=Math.max(0,timelineSeekSuppressed-1);});
    }
    async function showCycleFrame(which){
      if(!cycleResult||!hasFileVideo())return;
      const result=cycleResult;
      const chosen=which==='minimum'?result.minimum:
        which==='correct'?result.lastReliable:result.maximum;
      if(!chosen)return;
      try{
        video.pause();
        await seekCycleFrame(chosen.time);
        if(cycleResult!==result)return;
        originalCtx.drawImage(video,0,0,original.width,original.height);
        annotations=chosen.shapes.map((item,index)=>({uid:annotations[index]?.uid||newMarkUid(),
          kind:item.kind,color:item.color,role:item.role,
          supplementary:!!item.supplementary,
          points:item.points.map(p=>({x:p.x/result.width*canvas.width,y:p.y/result.height*canvas.height}))}));
        selectedIndex=-1;draft=[];lastFrameFromVideo=true;stillFromVideo=true;
        cycleTrailsVisible=which!=='correct';
        render();showVideo(false);updateZoom(Number(byId('zoom').value));
        newPhotoRecord();schedulePhotoSave();
        byId('back-video').hidden=false;
        byId('cycle-results').hidden=false;
        updateCameraControls();
        if(which==='correct'){
          selectTool('edit');
          message(`Quadro de correção em ${clockTime(chosen.time)}. Ajuste o ponto que escapou e inicie um novo giro. O trecho anterior foi preservado nos resultados.`);
        }else{
          message(`${which==='minimum'?'Menor ângulo (flexão)':'Maior ângulo (extensão)'}: ${format(chosen.angle)}° em ${clockTime(chosen.time)}. Confira os pontos e o ângulo suplementar antes de registrar.`);
        }
      }catch(error){message(`Não foi possível mostrar o quadro: ${error?.message||'erro no vídeo'}.`);}
    }
    async function trackOneCycle(){
      if(scanningActive||trackingActive||!lastFrameFromVideo||!hasFileVideo()||
        !annotations.some(item=>item.kind==='angle'&&item.trackEnabled!==false))return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanCycle){message('Atualize também o arquivo athlete-motion.js.');return;}
      const start=video.currentTime;
      const duration=Number(byId('cycle-duration').value)||.75;
      const fps=Number(byId('file-fps').value)||30;
      resetCycleResults();
      video.pause();
      scanCancelled=false;scanningActive=true;updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Rastreando um giro a partir de ${clockTime(start)} (${duration.toFixed(2).replace('.',',')} s). Aguarde; “Parar rastreio” cancela a busca.`);
      try{
        const result=await motion.scanCycle({video,startTime:start,duration,fps,
          annotations:annotations.filter(a=>a.trackEnabled!==false).map(item=>({kind:item.kind,role:item.role,
            color:item.color,supplementary:!!item.supplementary,
            points:item.points.map(p=>({...p}))})),
          sourceWidth:canvas.width,sourceHeight:canvas.height,
          shouldCancel:()=>scanCancelled,
          onProgress:progress=>message(`Um giro: ${progress.tested}/${progress.total} quadros · maior ${format(progress.maximum)}° · menor ${format(progress.minimum)}°.`)
        });
        if(scanCancelled)return;
        cycleResult=result;
        const adjective=result.partial?'Trecho parcial':'Um giro';
        const complement=result.supplementary?' · rótulo A mostra suplementar':'';
        byId('cycle-summary').textContent=`${adjective} · extensão ${format(result.maximum.angle)}° · flexão ${format(result.minimum.angle)}°${complement}`;
        byId('cycle-correct').hidden=!result.partial||!result.lastReliable;
        await showCycleFrame('maximum');
        message(`${adjective}: extensão ${format(result.maximum.angle)}° · flexão ${format(result.minimum.angle)}° · ${result.tested} quadros. `+
          `${result.partial?'Ponto perdido: use “Corrigir pontos”. ':' '}Confira os marcos nos dois instantes.`);
      }catch(error){
        if(!scanCancelled)message(`O giro não pôde ser concluído: ${error?.message||'rastreamento insuficiente'}. Reposicione os marcadores em áreas contrastantes e tente novamente.`);
      }finally{
        scanningActive=false;scanCancelled=false;updateCameraControls();
        for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=false;
      }
    }
    function stopTrackingPlayback() {
      if(scanningActive){scanCancelled=true;message('Interrompendo o rastreamento. O quadro original continua marcado.');return;}
      if(!trackingActive)return;
      stopTracking();video.pause();
      message('Rastreio encerrado. Pause noutro instante e capture um novo quadro para corrigir os pontos.');
    }
    byId('track-start').addEventListener('click',startTracking);
    byId('scan-short').addEventListener('click',scanShortSegment);
    byId('cycle-start').addEventListener('click',trackOneCycle);
    byId('cycle-show-max').addEventListener('click',()=>showCycleFrame('maximum'));
    byId('cycle-show-min').addEventListener('click',()=>showCycleFrame('minimum'));
    byId('cycle-correct').addEventListener('click',()=>showCycleFrame('correct'));
    byId('cycle-dismiss').addEventListener('click',()=>{byId('cycle-results').hidden=true;});
    byId('track-stop').addEventListener('click',stopTrackingPlayback);

    function stopStream() {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
    }

    function loadVideoFile(file,label='Vídeo local') {
      if (!file || recorder?.state==='recording') {
        message('Pare a gravação atual antes de importar outro vídeo.');return false;
      }
      const filename=String(label || file.name || 'Vídeo');
      const allowed=/\.(mp4|mov|webm|m4v|avi)$/i.test(filename) ||
        String(file.type||'').startsWith('video/');
      if (!allowed) {message('Selecione um vídeo, por exemplo MP4, WebM ou MOV.');return false;}
      stopTracking();stopStream();video.pause();resetCycleResults();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl=URL.createObjectURL(file);
      wheelAnchor=null;
      lastTrackedGeometry=null;
      currentVideoFile=file;
      loadTimelineForVideo(file);
      video.srcObject=null;video.src=recordedUrl;video.controls=false;
      video.muted=true;video.autoplay=false;video.load();
      video.playbackRate=Number(byId('speed').value)||1;
      fineNavigationEpoch++;
      pendingScrubTime=null;scrubActive=false;scrubPointerDown=false;scrubReleasePending=false;
      lastFrameFromVideo=false;
      stillFromVideo=false;
      fineTrails.clear();singlePointTrails.clear();fineUncertain=[];finePeak=null;
      fineSampler=null;fineSamplerSource=null;
      lastDeletedAnnotation=null;closeDeleteMenu();
      byId('back-video').hidden=true;
      const download=byId('video-download');download.hidden=true;download.removeAttribute('href');
      showVideo(true);
      byId('trim-start').value='00:00';byId('trim-end').value='02:00';
      byId('trim-ruler-status').hidden=true;
      byId('camera-info').textContent=`Arquivo: ${filename}. Reprodução local, sem upload.`;
      message('Vídeo aberto. Clique no atleta para congelar; com Ângulo, marque 3 pontos consecutivos ou arraste as hastes.');
      updateCameraControls();syncTimeline();
      attemptPlayback();
      return true;
    }
    const trimStatus=text=>{
      byId('trim-status').textContent=text;
      byId('trim-ruler-status').hidden=false;
      byId('trim-ruler-status').textContent=text;
    };
    const parseTime=value=>{
      const parts=String(value).trim().split(':');
      if(parts.length>3||!parts.length||parts.some(part=>!/^\d+(?:[.,]\d+)?$/.test(part)))return NaN;
      return parts.reduce((seconds,part)=>seconds*60+Number(part.replace(',','.')),0);
    };
    const trimClock=seconds=>{
      const minutes=Math.floor(seconds/60),sec=Math.floor(seconds%60);
      return `${String(minutes).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };
    const trimClockTenths=seconds=>{
      const minutes=Math.floor(seconds/60),whole=Math.floor(seconds%60),fraction=Math.floor(seconds*10)%10;
      return `${String(minutes).padStart(2,'0')}:${String(whole).padStart(2,'0')}.${fraction}`;
    };
    function updateTrimRuler(){
      const duration=Number(video.duration);
      const available=hasFileVideo()&&Number.isFinite(duration)&&duration>0;
      const track=byId('trim-ruler-track');
      track.classList.toggle('paiva-2d-ruler-disabled',!available);
      if(!available)return;
      const start=Math.max(0,Math.min(duration,parseTime(byId('trim-start').value)||0));
      const end=Math.max(start,Math.min(duration,parseTime(byId('trim-end').value)||duration));
      const left=start/duration*100,right=end/duration*100;
      byId('trim-handle-start').style.left=`${left}%`;
      byId('trim-handle-end').style.left=`${right}%`;
      byId('trim-ruler-selected').style.left=`${left}%`;
      byId('trim-ruler-selected').style.width=`${Math.max(0,right-left)}%`;
      byId('trim-ruler-start').textContent=trimClockTenths(start);
      byId('trim-ruler-end').textContent=trimClockTenths(end);
    }
    let draggedRuler=null;
    const rulerTrack=byId('trim-ruler-track');
    let rulerPaintFrame=null;
    function scheduleRulerPaint(){
      if(rulerPaintFrame!==null)return;
      rulerPaintFrame=requestAnimationFrame(()=>{
        rulerPaintFrame=null;updateTrimRuler();
      });
    }
    function changeRulerTime(event,handle){
      const duration=Number(video.duration);
      if(!hasFileVideo()||!Number.isFinite(duration)||duration<=0)return;
      // A geometria da régua não muda durante o arraste: medimos uma vez,
      // evitando forçar recálculo de layout em cada pixel do movimento.
      const r=draggedRuler?.rect||rulerTrack.getBoundingClientRect();
      const time=Math.max(0,Math.min(duration,(event.clientX-r.left)/Math.max(1,r.width)*duration));
      const start=Math.max(0,parseTime(byId('trim-start').value)||0);
      const end=Math.min(duration,parseTime(byId('trim-end').value)||duration);
      const adjusted=handle==='start'?Math.min(time,Math.max(0,end-0.2)):
        Math.max(time,Math.min(duration,start+0.2));
      byId(`trim-${handle}`).value=trimClockTenths(adjusted);
      scheduleRulerPaint();
      if(!video.hidden && !video.seeking){
        video.pause();video.currentTime=Math.max(0,Math.min(duration,adjusted));
      }
    }
    rulerTrack.addEventListener('pointerdown',event=>{
      if(event.button!==0||!hasFileVideo()||!Number.isFinite(video.duration))return;
      event.preventDefault();
      const direct=event.target.closest?.('[data-2d-trim-handle]')?.getAttribute('data-2d-trim-handle');
      const r=rulerTrack.getBoundingClientRect();
      const t=Math.max(0,Math.min(video.duration,(event.clientX-r.left)/Math.max(1,r.width)*video.duration));
      const start=parseTime(byId('trim-start').value)||0,end=parseTime(byId('trim-end').value)||video.duration;
      const handle=direct||(Math.abs(t-start)<=Math.abs(t-end)?'start':'end');
      draggedRuler={pointerId:event.pointerId,handle,rect:r};
      try{rulerTrack.setPointerCapture?.(event.pointerId);}catch(_){/* segue sem captura em navegadores antigos */}
      changeRulerTime(event,handle);
    });
    rulerTrack.addEventListener('pointermove',event=>{
      if(draggedRuler?.pointerId!==event.pointerId)return;
      event.preventDefault();changeRulerTime(event,draggedRuler.handle);
    });
    const finishRuler=event=>{
      if(draggedRuler?.pointerId!==event.pointerId)return;
      draggedRuler=null;
      if(rulerTrack.hasPointerCapture?.(event.pointerId))rulerTrack.releasePointerCapture(event.pointerId);
      if(rulerPaintFrame!==null){cancelAnimationFrame(rulerPaintFrame);rulerPaintFrame=null;}
      updateTrimRuler();
      trimStatus('Intervalo marcado na régua. Clique em “✂ Salvar trecho” quando estiver pronto.');
    };
    rulerTrack.addEventListener('pointerup',finishRuler);
    rulerTrack.addEventListener('pointercancel',finishRuler);
    byId('trim-start').addEventListener('change',updateTrimRuler);
    byId('trim-end').addEventListener('change',updateTrimRuler);
    byId('trim-ruler-save').addEventListener('click',()=>byId('trim-run').click());
    byId('trim-mark-start').addEventListener('click',()=>{
      if(!hasFileVideo()){trimStatus('Abra primeiro um vídeo.');return;}
      byId('trim-start').value=trimClock(video.currentTime);
      updateTrimRuler();
      trimStatus(`Início marcado em ${byId('trim-start').value}.`);
    });
    byId('trim-mark-end').addEventListener('click',()=>{
      if(!hasFileVideo()){trimStatus('Abra primeiro um vídeo.');return;}
      byId('trim-end').value=trimClock(video.currentTime);
      updateTrimRuler();
      trimStatus(`Fim marcado em ${byId('trim-end').value}.`);
    });
    let clipUrl=null;
    byId('trim-run').addEventListener('click',async()=>{
      if(!currentVideoFile||!hasFileVideo()){trimStatus('Abra um vídeo do computador ou grave com a webcam.');return;}
      const start=parseTime(byId('trim-start').value),end=parseTime(byId('trim-end').value);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start){
        trimStatus('Confira os tempos: use 00:10 até 02:00, por exemplo.');return;
      }
      if(Number.isFinite(video.duration)&&end>video.duration+0.15){
        trimStatus(`O fim excede a duração do vídeo (${trimClock(video.duration)}).`);return;
      }
      if(end-start>180){trimStatus('Faça recortes de até 3 minutos por vez para proteger a memória do navegador.');return;}
      const converter=globalThis.PAIVA_VIDEO_CONVERTER;
      if(!converter?.trim){trimStatus('Motor indisponível. Atualize os arquivos video-converter.js e ffmpeg no site.');return;}
      const button=byId('trim-run');button.disabled=true;byId('trim-download').hidden=true;
      try{
        video.pause();
        const cut=await converter.trim(currentVideoFile,start,end,trimStatus);
        if(clipUrl)URL.revokeObjectURL(clipUrl);
        clipUrl=URL.createObjectURL(cut);
        const link=byId('trim-download');link.href=clipUrl;link.download=cut.name;link.hidden=false;
        const saved=await saveVideoRecord(cut,cut.name,`Recorte de ${trimClock(start)} até ${trimClock(end)} · original preservado`);
        trimStatus(`Recorte MP4 pronto (${(cut.size/1048576).toFixed(1).replace('.',',')} MB). ${saved?'Arquivado em “Fotos e vídeos salvos”.':'O navegador não conseguiu arquivar; baixe agora.'} Use Baixar para guardar no Windows.`);
      }catch(error){trimStatus('Falha no recorte: '+(error?.message||'o vídeo não pôde ser processado')+'. Original preservado.');}
      finally{button.disabled=false;}
    });
    window.addEventListener('pagehide',()=>{if(clipUrl)URL.revokeObjectURL(clipUrl);});
    // Salva o instante com marcadores rastreados quando o usuário pausa o vídeo.
    let lastPauseFrameTime=-1;
    function savePausedOverlay(){
      if(!hasFileVideo()||!trackingActive||trackOverlay.hidden||!videoCanCapture()||!records()?.save)return;
      const at=video.currentTime;
      if(Math.abs(at-lastPauseFrameTime)<0.15)return;
      lastPauseFrameTime=at;
      const snapshot=document.createElement('canvas');
      snapshot.width=video.videoWidth;snapshot.height=video.videoHeight;
      const painter=snapshot.getContext('2d');if(!painter)return;
      try{
        painter.drawImage(video,0,0,snapshot.width,snapshot.height);
        painter.drawImage(trackOverlay,0,0,snapshot.width,snapshot.height);
      }catch(_){return;}
      snapshot.toBlob(blob=>{
        if(!blob)return;
        const name=`PAIVA_Quadro_Rastreado_${Math.round(at*1000)}ms.png`;
        records().save({kind:'foto',name,description:`Quadro em ${at.toFixed(2)} s · pontos rastreados (experimentais)`,blob})
          .catch(error=>console.warn('PAIVA: não foi possível salvar quadro rastreado',error));
      },'image/png');
    }
    function attemptPlayback() {
      if(scanningActive||!hasFileVideo())return;
      if(!trackingActive && lastFrameFromVideo && annotations.length && byId('auto-track').checked){
        startTracking();return;
      }
      if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
      if(video.ended)video.currentTime=0;
      let attempt;
      try{attempt=video.play();}catch(error){message(`Não foi possível iniciar o vídeo: ${error?.message||'erro de reprodução'}.`);return;}
      Promise.resolve(attempt).then(()=>{
        if(!video.paused)message('Vídeo em reprodução. Escolha uma ferramenta e arraste no atleta para congelar e medir automaticamente.');
      }).catch(error=>{
        message(error?.name==='NotAllowedError'
          ? 'O navegador bloqueou a reprodução automática. Clique em “▶ Reproduzir”.'
          : 'O navegador não conseguiu reproduzir este formato. Prefira MP4 (vídeo H.264) ou WebM; alguns AVI/MOV precisam de conversão.');
      });
    }
    byId('play-video').addEventListener('click',attemptPlayback);
    function pausePlayback() {
      video.pause();
      savePausedOverlay();
      message('Vídeo pausado. Arraste o Ângulo, Linha ou Ponto diretamente na imagem para começar a análise.');
    }
    function togglePlayback() {
      if(scanningActive||!hasFileVideo())return;
      if(!video.paused)pausePlayback();
      else {
        if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
        attemptPlayback();
      }
    }
    byId('pause-video').addEventListener('click',pausePlayback);
    byId('ruler-toggle').addEventListener('click',togglePlayback);
    video.addEventListener('play',()=>{byId('ruler-toggle').textContent='⏸';});
    video.addEventListener('pause',()=>{byId('ruler-toggle').textContent='▶';});
    byId('video-file').addEventListener('change',() => {
      const input=byId('video-file');
      const file=input.files?.[0];if(!file)return;
      loadVideoFile(file,file.name);
      input.value='';
    });
    byId('speed').addEventListener('change',()=>{
      video.playbackRate=Number(byId('speed').value)||1;
      if(recordedUrl)message(`Reprodução configurada para ${byId('speed').selectedOptions[0].textContent}.`);
    });
    byId('pingpong').addEventListener('change',()=>{
      video.loop=byId('pingpong').checked;
      message(video.loop?'Repetição ativada: ao terminar, o vídeo recomeça e segue para a frente.':'Repetição desativada: o vídeo vai parar no final.');
    });
    // Não enviar dezenas de seeks concorrentes ao decodificador durante um
    // único arraste da barra. Guarda o destino mais recente e só o aplica
    // quando o seek anterior terminar, sem atrasar o movimento da régua.
    function flushScrubSeek(){
      if(!hasFileVideo()||!Number.isFinite(video.duration)){
        pendingScrubTime=null;return;
      }
      if(video.seeking)return;
      if(pendingScrubTime!==null){
        const destination=pendingScrubTime;
        pendingScrubTime=null;
        if(Math.abs(video.currentTime-destination)>.0005){
          video.currentTime=destination;
          return;
        }
      }
      if(scrubReleasePending){
        scrubActive=false;scrubReleasePending=false;syncTimeline();
      }
    }
    video.addEventListener('seeked',flushScrubSeek);
    // Voltar com a régua ao mesmo instante deve recuperar o desenho daquele
    // quadro; saltar a outro instante não reaproveita indevidamente a análise.
    video.addEventListener('seeked',()=>{
      if(timelineSeekSuppressed||scanningActive||finePending>0||video.seeking||canvas.hidden||!stillFromVideo||
        !hasFileVideo()||!videoCanCapture())return;
      const time=video.currentTime;
      if(shownFrameKey===frameKey(time))return;
      originalCtx.drawImage(video,0,0,original.width,original.height);
      const restored=restoreTimelineFrame(time,true,false);
      if(!annotations.length)recoverWheelAnchor();
      lastFrameFromVideo=true;stillFromVideo=true;
      newPhotoRecord();render();updateCameraControls();
      message(restored?`Análise de ${clockTime(time)} recuperada com os pontos salvos. Pode continuar editando.`:
        annotations.length?`Quadro ${clockTime(time)}: o ângulo foi mantido como referência provisória. Ajuste os pontos laranja; os quadros já medidos estão salvos.`:
        `Quadro ${clockTime(time)} pronto para uma nova medição.`);
    });
    byId('scrub').addEventListener('pointerdown',()=>{
      scrubPointerDown=true;scrubActive=true;scrubReleasePending=false;
      fineNavigationEpoch++;
      // Ao arrastar a régua, voltar à visualização do vídeo: não deixar
      // um quadro congelado antigo escondendo o novo instante procurado.
      if(video.hidden&&hasFileVideo()){
        showVideo(true);byId('back-video').hidden=true;
      }
    });
    const finishScrub=()=>{
      scrubPointerDown=false;scrubReleasePending=true;
      flushScrubSeek();
    };
    byId('scrub').addEventListener('pointerup',finishScrub);
    byId('scrub').addEventListener('pointercancel',finishScrub);
    byId('scrub').addEventListener('change',finishScrub);
    byId('scrub').addEventListener('input',()=>{
      if(!hasFileVideo()||!Number.isFinite(video.duration))return;
      if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
      fineNavigationEpoch++;
      scrubActive=true;
      if(!scrubPointerDown)scrubReleasePending=true;
      video.pause();
      if(trackingActive)stopTracking();
      lastFrameFromVideo=false;
      pendingScrubTime=Math.max(0,Math.min(video.duration,Number(byId('scrub').value)||0));
      byId('time-current').textContent=clockTime(pendingScrubTime);
      flushScrubSeek();
      message('Posição ajustada. Capture um novo quadro antes de iniciar um rastreio.');
    });
    async function fineStepFrame(direction){
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.createFrameSampler||!motion?.trackFineShapes){
        message('Rastreio fino indisponível: envie TODOS os arquivos da atualização para o GitHub.');return;
      }
      const source=recordedUrl;
      const navigationEpoch=fineNavigationEpoch;
      const fps=Number(byId('file-fps').value)||30;
      const from=video.currentTime;
      const duration=Number.isFinite(video.duration)?video.duration:from;
      const next=Math.max(0,Math.min(Math.max(0,duration-.001),from+direction/fps));
      if(Math.abs(next-from)<.0005)return;
      video.pause();
      // Reaproveita o canvas e seu contexto enquanto a gravação for a mesma:
      // menos alocações durante a rolagem, sem mudar o rastreamento validado.
      if(!fineSampler||fineSamplerSource!==source){
        fineSampler=motion.createFrameSampler(video);
        fineSamplerSource=source;
      }
      const sampler=fineSampler;
      const before=sampler.sample();
      const beforeImage=sampler.lastImage;
      const selectedGroup=byId('marker-group').value;
      const kneeIsTracked=item=>item?.trackEnabled!==false&&
        (item?.kind==='full8'?['all','leg'].includes(selectedGroup):
          item?.kind==='angle'&&selectedGroup!=='free');
      if(!finePeak){
        const angle=annotations.find(a=>kneeIsTracked(a)&&kneeReading(a)!==null);
        const degrees=kneeReading(angle);
        if(degrees!==null)finePeak={time:from,angle:degrees,
          shapes:annotations.map(a=>({...a,points:a.points.map(p=>({...p}))}))};
      }
      await seekCycleFrame(next);
      if(source!==recordedUrl||navigationEpoch!==fineNavigationEpoch||
        !lastFrameFromVideo||!stillFromVideo||canvas.hidden)return;
      // Ao retornar a um quadro já medido, recuperar primeiro seus pontos
      // EXATOS. Não passar novamente pelo rastreador e nem regravar essa
      // geometria com uma estimativa de ida/volta da rodinha.
      const saved=restoreTimelineFrame(video.currentTime,false,false,true);
      if(!annotations.length)recoverWheelAnchor();
      if(!saved){
        const after=sampler.sample();
        const afterImage=sampler.lastImage;
        // Um marcador já perdido não volta a ser "confiável" por acaso na
        // rodada seguinte. Ele fica parado até o profissional reposicioná-lo.
        const blocked=new Set(fineUncertain.map(p=>`${p.item}:${p.point}`));
        const result=motion.trackFineShapes(before,after,sampler.width,sampler.height,
          annotations,canvas.width,canvas.height,{
            patch:Number(byId('fine-patch').value),search:Number(byId('fine-search').value),
            mode:byId('marker-reference').value,group:byId('marker-group').value,
            imageBefore:beforeImage,imageAfter:afterImage
          });
        const previous=annotations;
        for(const token of blocked){
          const [i,j]=token.split(':').map(Number);
          const fixed=previous[i]?.points?.[j];
          if(!fixed||!result.shapes[i]?.points?.[j])continue;
          result.shapes[i].points[j]={...fixed};
          if(!result.lost.some(p=>p.item===i&&p.point===j))result.lost.push({item:i,point:j});
        }
        result.moved=result.moved.filter(p=>!blocked.has(`${p.item}:${p.point}`));
        annotations=result.shapes.length?result.shapes:annotations;
        // Se a textura escapar, os próprios pontos permanecem na última
        // posição conhecida, circundados de laranja para ajuste manual.
        fineUncertain=result.lost;
        for(const match of result.moved){
          const key=`${match.item}:${match.point}`;
          const old=previous[match.item]?.points?.[match.point];
          const current=annotations[match.item]?.points?.[match.point];
          if(!old||!current)continue;
          const path=fineTrails.get(key)||[{...old}];path.push({...current});
          if(path.length>13)path.shift();fineTrails.set(key,path);
          if(annotations[match.item]?.kind==='point'&&match.point===0)
            appendSinglePoint(match.item,old,current,from,next);
        }
      }
      const firstAngleIndex=annotations.findIndex(a=>kneeIsTracked(a)&&kneeReading(a)!==null);
      const firstAngle=annotations[firstAngleIndex];
      const angle=kneeReading(firstAngle);
      if(angle!==null&&!fineUncertain.some(p=>p.item===firstAngleIndex)&&(!finePeak||angle>finePeak.angle)){
        finePeak={time:next,angle,shapes:annotations.map(a=>({...a,points:a.points.map(p=>({...p}))}))};
      }
      originalCtx.drawImage(video,0,0,original.width,original.height);
      lastFrameFromVideo=true;stillFromVideo=true;
      rememberWheelAnchor();
      render();syncTimeline();
      byId('fine-peak').disabled=!finePeak;
      // Evita codificar um PNG enquanto a rodinha ainda está avançando quadros.
      if(!saved)schedulePhotoSave(1600,'tracking');
      const label=firstAngle?.kind==='full8'?angle:firstAngle?displayedAngle(firstAngle):null;
      const lost=fineUncertain.length;
      const checking=firstAngleIndex>=0&&fineUncertain.some(p=>p.item===firstAngleIndex);
      const readout=label===null&&annotations.some(item=>item.kind==='point')?'Ponto · rastro':
        label===null?'marcadores':`A ${checking?'≈ ':''}${format(label)}°${checking?' (conferir)':''}`;
      byId('fine-readout').textContent=`${clockTime(next)} · ${readout}${finePeak?` · pico ${format(finePeak.angle)}°`:''}${lost?` · ${lost} ponto(s) corrigir`:''}`;
      message(lost?`Quadro ${clockTime(next)}: ${lost} marcador(es) em laranja precisam de correção. O ângulo foi mantido; ajuste os pontos e continue com a rodinha.`:
        saved?`Quadro ${clockTime(next)}: pontos salvos recuperados exatamente como estavam. Pode comparar a medida.`:
        `Quadro ${clockTime(next)}: pontos acompanhados. Confira o alinhamento anatômico; mova a rodinha novamente para procurar a extensão máxima.`);
    }
    function stepFrame(direction,preserveCapturedImage=false) {
      if(scanningActive||!hasFileVideo())return;
      if(!annotations.length)recoverWheelAnchor();
      advanceWheelAnchor();
      const fine=lastFrameFromVideo&&stillFromVideo&&!canvas.hidden&&
        annotations.some(item=>item.trackEnabled!==false)&&byId('fine-mode').checked;
      if(fine){
        if(finePending>=5)return;
        finePending++;
        fineSequence=fineSequence.catch(()=>{}).then(()=>fineStepFrame(direction)).catch(error=>{
          // Nem mesmo um erro do decodificador deve apagar a referência visual.
          if(stillFromVideo&&hasFileVideo()){
            recoverWheelAnchor();
            fineUncertain=annotations.flatMap((item,i)=>isAngular(item)?
              item.points.map((_,j)=>({item:i,point:j})):[]);
            render();
          }
          message(`Não foi possível seguir os pontos neste quadro: ${error?.message||'erro no vídeo'}. Corrija o marcador ou altere o FPS.`);
        }).finally(()=>{finePending--;});
        return;
      }
      video.pause();
      if(trackingActive)stopTracking();
      const refreshStill=preserveCapturedImage && stillFromVideo && !canvas.hidden;
      lastFrameFromVideo=false;
      const duration=Number.isFinite(video.duration)?video.duration:Math.max(video.currentTime,0);
      const fps=Number(byId('file-fps').value)||30;
      const next=Math.max(0,Math.min(duration,video.currentTime+direction/fps));
      if(refreshStill && Math.abs(next-video.currentTime)>.0001){
        video.addEventListener('seeked',()=>{
          if(!canvas.hidden && video.readyState>=2){
            originalCtx.drawImage(video,0,0,original.width,original.height);
            render();
          }
        },{once:true});
      }
      video.currentTime=next;
      syncTimeline();
      updateCameraControls();
      message(refreshStill
        ? `Quadro deslocado em 1/${fps} s. As marcações estão fixas: ajuste os pontos ao atleta antes de interpretar o ângulo; recapture para reativar o rastreio.`
        : `Avanço aproximado de 1/${fps} s. Ajuste o FPS conforme o vídeo; aguarde atualizar antes de capturar.`);
    }
    byId('fine-prev').addEventListener('click',()=>stepFrame(-1,true));
    byId('fine-next').addEventListener('click',()=>stepFrame(1,true));
    byId('fine-mode').addEventListener('change',()=>{
      fineUncertain=[];render();
      message(byId('fine-mode').checked?'Rastreio fino ligado: gire a rodinha, um quadro por vez. Corrija os pontos diretamente no atleta.':
        'Rastreio fino desligado: os pontos ficarão parados enquanto você movimenta o vídeo.');
    });
    byId('fine-boxes').addEventListener('change',render);
    byId('fine-peak').addEventListener('click',async()=>{
      if(!finePeak||!hasFileVideo()||finePending)return;
      const peak=finePeak;video.pause();
      try{
        await seekCycleFrame(peak.time);
        if(finePeak!==peak)return;
        annotations=peak.shapes.map(a=>({...a,points:a.points.map(p=>({...p}))}));
        originalCtx.drawImage(video,0,0,original.width,original.height);
        fineUncertain=[];render();syncTimeline();updateCameraControls();schedulePhotoSave();
        message(`Maior extensão observada neste trecho: ${format(peak.angle)}° em ${clockTime(peak.time)}. Confira os três marcos antes de usar a medida.`);
      }catch(error){message(`Não foi possível abrir o pico: ${error?.message||'erro no arquivo'}.`);}
    });
    // Sobre o visor da análise, a rodinha move o vídeo de fato: não rola a página.
    // Ctrl + rodinha mantém o zoom da foto; arquivos de webcam ao vivo não sofrem seek.
    canvas.parentElement.addEventListener('wheel',event=>{
      if(scanningActive){event.preventDefault();return;}
      if(event.ctrlKey && !canvas.hidden){
        event.preventDefault();
        updateZoom(Number(byId('zoom').value)+(event.deltaY<0?5:-5));
        return;
      }
      if(event.ctrlKey || !hasFileVideo() || !Number.isFinite(video.duration) || video.duration<=0)return;
      event.preventDefault();
      const multiplier=event.deltaMode===1?16:event.deltaMode===2?100:1;
      wheelAccumulator+=event.deltaY*multiplier;
      if(Math.abs(wheelAccumulator)<30)return;
      const direction=Math.sign(wheelAccumulator);
      wheelAccumulator=0;
      stepFrame(direction,!canvas.hidden);
    },{passive:false});
    const playerArea=canvas.parentElement;
    playerArea.tabIndex=0;
    playerArea.setAttribute('aria-label','Área de análise 2D. Botão direito exclui a marcação selecionada; Espaço alterna vídeo; setas mudam os quadros.');
    playerArea.addEventListener('pointerenter',()=>{globalThis.PAIVA_ACTIVE_VIDEO_PANEL='athlete';});
    playerArea.addEventListener('pointerdown',()=>playerArea.focus({preventScroll:true}));
    playerArea.addEventListener('contextmenu',event=>{
      if(!hasFileVideo())return;
      event.preventDefault();
      globalThis.PAIVA_ACTIVE_VIDEO_PANEL='athlete';
      togglePlayback();
    });
    document.addEventListener('keydown',event=>{
      if(globalThis.PAIVA_ACTIVE_VIDEO_PANEL!=='athlete'||!hasFileVideo()||event.repeat)return;
      if(event.ctrlKey||event.altKey||event.metaKey)return;
      if(event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]'))return;
      const key=event.code||event.key;
      if(key==='Space'||key===' '){event.preventDefault();togglePlayback();}
      else if(key==='KeyK'||key==='k'||key==='K'){event.preventDefault();pausePlayback();}
      else if(key==='KeyL'||key==='l'||key==='L'){event.preventDefault();
        if(video.hidden){showVideo(true);byId('back-video').hidden=true;}
        attemptPlayback();}
      else if(key==='ArrowLeft'||key==='ArrowRight'){
        event.preventDefault();stepFrame(key==='ArrowRight'?1:-1,!canvas.hidden);
      }
    });
    video.addEventListener('error',() => {
      if (!cameraStream && video.getAttribute('src'))
        message('O navegador não conseguiu reproduzir esse arquivo. Tente MP4 com vídeo H.264 ou WebM; alguns AVI/MOV precisam ser convertidos.');
    });
    video.addEventListener('loadedmetadata',()=>{
      syncTimeline();
      if(hasFileVideo()&&Number.isFinite(video.duration)&&video.duration>0){
        byId('trim-start').value='00:00';
        byId('trim-end').value=trimClockTenths(Math.min(120,video.duration));
        updateTrimRuler();
      }
      fitVideoImage();
      if(recordedUrl && video.getAttribute('src')===recordedUrl && video.paused)
        message('Vídeo pronto. Arraste o ângulo direto na imagem ou use a régua para recortar.');
    });
    video.addEventListener('timeupdate',syncTimeline);
    video.addEventListener('durationchange',()=>{
      syncTimeline();
      if(hasFileVideo()&&Number.isFinite(video.duration)&&video.duration>0){
        const finish=parseTime(byId('trim-end').value);
        if(finish>video.duration)byId('trim-end').value=trimClockTenths(video.duration);
        updateTrimRuler();
      }
    });
    video.addEventListener('ended',()=>{
      syncTimeline();
      // O loop nativo normalmente não dispara ended. Este fallback também
      // reinicia para a frente, caso o navegador não respeite o atributo loop.
      if(hasFileVideo() && video.loop){
        video.currentTime=0;
        Promise.resolve(video.play()).catch(()=>message('Clique em Reproduzir para continuar o vídeo.'));
      }
    });

    function setFrame(source, naturalWidth, naturalHeight) {
      if (!naturalWidth || !naturalHeight) return false;
      // Preserva Full HD (1920×1080), sem interpolar a fonte e com limite de
      // pixels para não sobrecarregar a memória durante fotos automáticas.
      const scale = Math.min(1,1920/Math.max(naturalWidth,naturalHeight),
        Math.sqrt(2304000/(naturalWidth*naturalHeight)));
      const width = Math.max(1,Math.round(naturalWidth*scale));
      const height = Math.max(1,Math.round(naturalHeight*scale));
      original.width = canvas.width = width;
      original.height = canvas.height = height;
      originalCtx.drawImage(source,0,0,width,height);
      photoLoaded = true;
      stillFromVideo=source===video;
      if(!stillFromVideo)wheelAnchor=null;
      fineTrails.clear();singlePointTrails.clear();fineUncertain=[];finePeak=null;
      lastDeletedAnnotation=null;closeDeleteMenu();
      annotations=[];draft=[];angleSequence=[];full8Sequence=[];activeDrag=null;activeDraw=null;selectedIndex=-1;
      updateFull8Guide();
      render();showVideo(false);updateZoom(Number(byId('zoom').value));
      newPhotoRecord();
      // A captura de vídeo recupera primeiro o quadro salvo. Uma foto estática
      // continua sendo arquivada imediatamente, como antes.
      if(!stillFromVideo||!hasFileVideo())schedulePhotoSave();
      return true;
    }

    function videoCanCapture() {
      return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    }

    function recordingBitrate(settings,detail){
      if(!detail)return 1500000;
      const width=Number(settings.width)||1280;
      const height=Number(settings.height)||720;
      const fps=Number(settings.frameRate)||30;
      return Math.round(Math.max(4000000,Math.min(10000000,width*height*fps*.10)));
    }

    function matchRecordingFps(fps){
      const choice=byId('file-fps');
      if(!(fps>0)||!choice)return;
      const rates=Array.from(choice.options).map(option=>Number(option.value));
      const nearest=rates.reduce((best,value)=>Math.abs(value-fps)<Math.abs(best-fps)?value:best,rates[0]);
      choice.value=String(nearest);
    }

    async function startCamera() {
      if (cameraStream) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        message('Webcam indisponível. Abra o site por HTTPS no Chrome ou Edge do Windows e confira a permissão de câmera.');
        return;
      }
      byId('camera-start').disabled = true;
      byId('camera-quality').disabled = true;
      try {
        stopTracking();lastFrameFromVideo=false;
        wheelAnchor=null;
        const detail=byId('camera-quality').value==='detail';
        const high={video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:60}},audio:false};
        const standard={video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false};
        let stream;
        let fallback=false;
        try{stream=await navigator.mediaDevices.getUserMedia(detail?high:standard);}
        catch(error){
          if(!detail||['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name))throw error;
          stream=await navigator.mediaDevices.getUserMedia(standard);
          fallback=true;
        }
        cameraStream = stream;
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.controls = false;video.muted = true;video.autoplay = true;
        showVideo(true);byId('back-video').hidden=true;
        try {await video.play();} catch (_) { /* alguns navegadores exigem outro clique */ }
        const actual=stream.getVideoTracks()[0]?.getSettings?.()||{};
        const size=`${actual.width||video.videoWidth||'?'} × ${actual.height||video.videoHeight||'?'}`;
        const fps=actual.frameRate?`${Math.round(actual.frameRate)} fps`:'fps não informado';
        byId('camera-info').textContent=`Webcam: ${size} · ${fps}${fallback?' · modo leve de compatibilidade':''}. Vídeo local, sem áudio.`;
        message(`Webcam ligada em ${size} · ${fps}. A nitidez real depende da câmera e da iluminação; agora pode gravar ou congelar o quadro.`);
      } catch (error) {
        stopStream();
        const denied = ['NotAllowedError','PermissionDeniedError','SecurityError'].includes(error?.name);
        message(denied ? 'O navegador bloqueou a webcam. Autorize a câmera nas permissões do site e tente novamente.'
          : 'Não foi possível abrir a webcam. Verifique a conexão, o uso por outro programa e as permissões do Windows.');
      }
      updateCameraControls();
    }

    function startRecording() {
      if (!cameraStream || recorder?.state==='recording') return;
      if (typeof MediaRecorder === 'undefined') {
        message('Este navegador não permite gravar vídeo. Você ainda pode capturar um quadro da webcam.');return;
      }
      const supported = ['video/webm;codecs=vp8','video/webm','video/mp4']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const settings=cameraStream.getVideoTracks()[0]?.getSettings?.()||{};
      const requestedQuality=byId('camera-quality').value==='detail';
      let bitrate=recordingBitrate(settings,requestedQuality);
      try {
        recorder = new MediaRecorder(cameraStream,supported
          ? {mimeType:supported,videoBitsPerSecond:bitrate}
          : {videoBitsPerSecond:bitrate});
      } catch (_) {
        // A webcam ainda pode fotografar e filmar no perfil de compatibilidade
        // caso o codificador do aparelho recuse a taxa maior.
        if(requestedQuality){
          bitrate=1500000;
          try{recorder=new MediaRecorder(cameraStream,supported
            ? {mimeType:supported,videoBitsPerSecond:bitrate}
            : {videoBitsPerSecond:bitrate});}
          catch(_){recorder=null;}
        }
        if(!recorder){
          message('A gravação não é compatível com esta webcam/navegador. Você ainda pode capturar um quadro.');
          return;
        }
      }
      const thisRecorder = recorder;
      recordedChunks=[];
      thisRecorder.ondataavailable = event => {if (event.data?.size) recordedChunks.push(event.data);};
      thisRecorder.onerror = () => {message('Falha durante a gravação. Tente um trecho mais curto.');};
      thisRecorder.onstop = () => {
        if (recordingTimer) {clearTimeout(recordingTimer);recordingTimer=null;}
        const mime = thisRecorder.mimeType || 'video/webm';
        const movie = new Blob(recordedChunks,{type:mime});
        recordedChunks=[];
        stopStream();
        if (!movie.size) {
          message('Não foi possível salvar a gravação. Tente novamente.');
          showVideo(false);updateCameraControls();return;
        }
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        recordedUrl = URL.createObjectURL(movie);
        const extension=mime.includes('mp4')?'mp4':'webm';
        const filename=`PAIVA_Filmagem_2D_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.${extension}`;
        currentVideoFile=new File([movie],filename,{type:mime});
        loadTimelineForVideo(currentVideoFile);
        saveVideoRecord(movie,filename,'Gravação da webcam · Análise 2D');
        const download = byId('video-download');
        download.href=recordedUrl;
        download.download=filename;
        download.hidden=false;
        video.pause();video.srcObject=null;video.src=recordedUrl;
        matchRecordingFps(Number(settings.frameRate));
        lastFrameFromVideo=false;
        stillFromVideo=false;
        video.controls=false;video.muted=true;video.autoplay=false;video.load();
        showVideo(true);byId('back-video').hidden=true;
        byId('camera-info').textContent = `Vídeo registrado no navegador · ${Math.round(bitrate/1000000*10)/10} Mb/s solicitados. Use Baixar para guardar. `+
          'A gravação em alta nitidez ocupa mais espaço.';
        message('Gravação concluída. Arraste um ângulo diretamente sobre o vídeo para congelar e medir. A filmagem também foi registrada no navegador.');
        updateCameraControls();
      };
      try {thisRecorder.start(250);} catch (_) {
        recorder=null;message('Não foi possível iniciar a gravação. Tente novamente.');return;
      }
      recordingTimer=setTimeout(() => {
        if (thisRecorder.state==='recording') {
          thisRecorder.stop();
          message('Limite de 3 minutos atingido. Finalizando o vídeo...');
        }
      },maxRecordingMs);
      byId('camera-info').textContent=`Gravando ${requestedQuality?'em alta nitidez':'em modo leve'} · ${Math.round(bitrate/1000000*10)/10} Mb/s solicitados · máximo de 3 minutos. Sem áudio.`;
      message('Gravação iniciada. Pedale normalmente e depois toque em “Parar gravação”.');
      updateCameraControls();
    }

    function stopRecording() {
      if (recorder?.state==='recording') {
        byId('stop-record').disabled=true;
        recorder.stop();message('Finalizando vídeo. Aguarde alguns instantes...');
      }
    }

    function stopCamera() {
      if (recorder?.state==='recording') {stopRecording();return;}
      stopStream();
      video.pause();
      if (video.srcObject) video.srcObject=null;
      showVideo(false);byId('back-video').hidden=true;
      byId('camera-info').textContent='Webcam desligada. Vídeos e imagens não são enviados à internet.';
      message('Webcam desligada. A imagem capturada, se houver, foi preservada.');
      updateCameraControls();
    }

    function captureVideoFrame() {
      if(scanningActive)return false;
      resetCycleResults();
      if (recorder?.state==='recording') {
        message('Pare a gravação antes de capturar um quadro para análise.');return false;
      }
      // Capturar outro instante do MESMO vídeo não deve apagar o ângulo.
      // Primeiro tentaremos restaurar a medição exata daquele quadro; se ela
      // não existir, mantemos as pontas anteriores para correção manual.
      // A rodinha ou a régua pode desligar 'quadro recém-capturado', mas os
      // três pontos anteriores continuam sendo a referência do novo instante.
      // Só utilizar coordenadas rastreadas se forem do MESMO instante.
      const hasPriorMarks=hasFileVideo()&&stillFromVideo&&annotations.length>0;
      const trackedAtThisTime=lastTrackedGeometry?.source===recordedUrl&&
        Math.abs(lastTrackedGeometry.time-video.currentTime)<.09;
      const carried=hasPriorMarks?
        (trackedAtThisTime?lastTrackedAnnotations():cloneAnnotations(annotations)):
        (wheelAnchor?.source===recordedUrl?cloneAnnotations(wheelAnchor.marks):[]);
      if (trackingActive) stopTracking();
      video.pause();
      if (!videoCanCapture() || !setFrame(video,video.videoWidth,video.videoHeight)) {
        message('Aguarde o vídeo carregar. Depois pause no quadro desejado e tente novamente.');return false;
      }
      lastFrameFromVideo=!cameraStream && !!recordedUrl;
      let restored=false;
      if(lastFrameFromVideo){
        restored=restoreTimelineFrame(video.currentTime,false,false);
        if(!restored&&carried.length){
          annotations=carried;
          fineUncertain=carried.flatMap((item,i)=>item.trackEnabled===false?[]:
            item.points.map((_,j)=>({item:i,point:j})));
        }
        rememberWheelAnchor();
        render();schedulePhotoSave(650,restored?'manual':'tracking');
      }
      if (cameraStream) {
        stopStream();video.srcObject=null;
        byId('back-video').hidden=true;
      } else byId('back-video').hidden = !recordedUrl;
      updateCameraControls();
      message(restored?`Análise salva recuperada em ${clockTime(video.currentTime)}, com os pontos na posição original.`:
        carried.length?'Quadro congelado com o ângulo preservado. Ajuste os pontos laranja no atleta e continue a comparação.':
        'Quadro congelado. Ângulo: clique no trocânter, côndilo e maléolo; depois arraste qualquer ponto para refinar.');
      return true;
    }

    byId('camera-start').addEventListener('click',startCamera);
    byId('record').addEventListener('click',startRecording);
    byId('stop-record').addEventListener('click',stopRecording);
    byId('camera-stop').addEventListener('click',stopCamera);
    byId('capture').addEventListener('click',captureVideoFrame);
    byId('manual-freeze').addEventListener('click',()=>{
      if(!hasFileVideo()&&!cameraStream){
        message('Primeiro abra um vídeo na Análise 2D. A régua ficará logo abaixo da imagem.');return;
      }
      if(video.seeking){
        message('Aguarde a régua terminar de localizar o quadro e clique novamente em Pausar e marcar.');return;
      }
      if(captureVideoFrame())message('2D manual pronto. Escolha BONECO 8 PONTOS, ÂNGULO ou PONTO LIVRE; depois avance com ◀ ▶ para testar o rastreamento sem IA.');
    });
    function updateMarkerGroupNote(){
      const group=byId('marker-group').value;
      const note={all:'Exibindo os 8 pontos · todos podem ser rastreados.',
        upper:'Tronco + braço · 4 pontos visíveis. Os outros 4 ficam guardados.',
        leg:'Fêmur + tíbia · 3 pontos visíveis. Os outros 5 ficam guardados.',
        foot:'Pé + calcanhar · 3 pontos visíveis. Os outros 5 ficam guardados.',
        free:'Somente pontos livres visíveis. O boneco de 8 pontos fica guardado.'};
      byId('marker-group-note').textContent=note[group]||note.all;
    }
    updateMarkerGroupNote();
    for(const key of ['marker-reference','marker-group'])
      byId(key).addEventListener('change',()=>{
        fineNavigationEpoch++; // não aplicar rastreio iniciado com o grupo anterior
        fineUncertain=[];
        fineTrails.clear();
        finePeak=null;
        byId('fine-peak').disabled=true;
        if(key==='marker-group'){
          updateMarkerGroupNote();
          if(annotations[selectedIndex]?.kind==='full8'&&!activeFull8Points().length)
            selectedIndex=-1;
        }
        if(photoLoaded)render();
        message(key==='marker-reference'?
          'Referência alterada. A próxima passagem quadro a quadro usará '+byId(key).selectedOptions[0].textContent+'. Confira os pontos.':
          'Vista alterada para '+byId(key).selectedOptions[0].textContent+'. Só os pontos desta região do boneco aparecem e são seguidos; os demais continuam salvos.');
      });
    let forwardedGesture=null;
    function projectVideoPointer(event,sourceRect){
      const target=canvas.getBoundingClientRect();
      const nx=(event.clientX-sourceRect.left)/Math.max(1,sourceRect.width);
      const ny=(event.clientY-sourceRect.top)/Math.max(1,sourceRect.height);
      return {button:event.button,pointerId:event.pointerId,type:event.type,shiftKey:event.shiftKey,
        clientX:target.left+nx*target.width,clientY:target.top+ny*target.height,
        preventDefault:()=>event.preventDefault()};
    }
    video.addEventListener('pointerdown',event=>{
      if(event.button!==0 || scanningActive || recorder?.state==='recording')return;
      if(!videoCanCapture()||(!hasFileVideo()&&!cameraStream))return;
      event.preventDefault();
      const sourceRect=video.getBoundingClientRect();
      if(!captureVideoFrame())return;
      forwardedGesture={pointerId:event.pointerId,sourceRect};
      // O primeiro arraste já é uma marcação, sem segundo clique em Capturar.
      canvasPointerDown(projectVideoPointer(event,sourceRect));
    });
    window.addEventListener('pointermove',event=>{
      if(!forwardedGesture||event.pointerId!==forwardedGesture.pointerId)return;
      canvasPointerMove(projectVideoPointer(event,forwardedGesture.sourceRect));
    });
    const finishForwardedGesture=event=>{
      if(!forwardedGesture||event.pointerId!==forwardedGesture.pointerId)return;
      const sourceRect=forwardedGesture.sourceRect;
      forwardedGesture=null;
      stopDrag(projectVideoPointer(event,sourceRect));
    };
    window.addEventListener('pointerup',finishForwardedGesture);
    window.addEventListener('pointercancel',finishForwardedGesture);
    byId('back-video').addEventListener('click',() => {
      if (!recordedUrl) return;
      if (trackingActive) stopTracking();
      showVideo(true);byId('back-video').hidden=true;
      message('Vídeo disponível novamente. Clique e arraste diretamente para analisar outro quadro. As marcações anteriores continuam no registro da foto.');
    });
    window.addEventListener('pagehide',() => {
      if(timelineIdentity)persistTimelineNow();
      stopTracking();
      if (recorder?.state==='recording') recorder.stop();
      stopStream();
      if (recordingTimer) clearTimeout(recordingTimer);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    });
    updateCameraControls();

    byId('file').addEventListener('change',() => {
      const chosen=byId('file').files?.[0];
      if (!chosen) return;
      if (recorder?.state==='recording') {
        message('Pare a gravação antes de carregar outra fotografia.');byId('file').value='';return;
      }
      if (!chosen.type.startsWith('image/') || chosen.size>20*1024*1024) {
        message('Escolha uma imagem compatível de até 20 MB.');return;
      }
      const uri=URL.createObjectURL(chosen);
      const photo=new Image();
      photo.onload=() => {
        stopTracking();resetCycleResults();lastFrameFromVideo=false;
        stopStream();video.pause();
        if (video.srcObject) video.srcObject=null;
        byId('back-video').hidden=true;
        setFrame(photo,photo.naturalWidth,photo.naturalHeight);
        URL.revokeObjectURL(uri);
        byId('file').value='';updateCameraControls();
        message('Imagem carregada. No modo Ângulo, marque três pontos com cliques ou arraste as hastes. Puxe as pontas diretamente.');
      };
      photo.onerror=() => {URL.revokeObjectURL(uri);message('Não foi possível abrir a foto. Tente JPG ou PNG.');};
      photo.src=uri;
    });

    function canvasPointerDown(event) {
      if(event.button!==0)return;
      if(scanningActive)return;
      if (!photoLoaded) {message('Primeiro escolha uma fotografia do atleta.');return;}
      const point=pointAt(event);
      if (!point) return;
      event.preventDefault();
      const selectedLabel=angleLabelAt(point);
      if(selectedLabel>=0){
        const angle=annotations[selectedLabel];
        selectedIndex=selectedLabel;
        angle.supplementary=!angle.supplementary;
        render();
        schedulePhotoSave();
        message(`Convenção alterada: A ${format(displayedAngle(angle))}°. Clique novamente no valor para inverter.`);
        return;
      }
      // No modo Ângulo, três cliques consecutivos definem exatamente os três
      // marcos anatômicos, sem criar um ramo perpendicular provisório.
      if(tool==='angle'&&angleSequence.length){
        activeDraw={pointer:event.pointerId,kind:'angle-sequence',start:point};
        draft=[...angleSequence,point];
        if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
        render();return;
      }
      if(tool==='full8'&&full8Sequence.length){
        activeDraw={pointer:event.pointerId,kind:'full8-sequence',start:point};
        draft=[...full8Sequence,point];
        if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
        render();return;
      }
      // Manipulação direta: uma ponta já desenhada pode ser puxada mesmo
      // enquanto a ferramenta Ângulo/Linha/Ponto continua selecionada.
      const endpoint=findPoint(point,event);
      // No rastreio fino qualquer referência pode ser corrigida com o mouse,
      // mesmo que a ferramenta atualmente selecionada seja de outro tipo.
      if(endpoint){
        activeDrag=endpoint;
        selectedIndex=endpoint.item;
        updateTrackToggle();
        if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
        return;
      }
      if(tool==='angle'||tool==='line'||tool==='full8'){
        const existingSegment=findSegment(point,event);
        if(existingSegment&&(tool===annotations[existingSegment.item]?.kind)){
          activeDrag=existingSegment;selectedIndex=existingSegment.item;
          updateTrackToggle();
          if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
          return;
        }
      }
      if(tool==='point'){
        annotations.push({uid:newMarkUid(),kind:'point',role:byId('point-role').value,points:[point],diameter:pointDiameter,trackEnabled:defaultTrackEnabled});
        lastDeletedAnnotation=null;
        selectedIndex=annotations.length-1;
        render();updateCameraControls();
        schedulePhotoSave();
        message(stillFromVideo?'Ponto colocado. Use Rastreio ON/OFF e “Traçar ponto” para desenhar seu caminho.':
          'Ponto colocado. Arraste diretamente para ajustar ou clique em outro local para adicionar mais um ponto.');
        return;
      }
      if (tool==='edit') {
        activeDrag=findSegment(point,event);
        if (activeDrag) {
          selectedIndex=activeDrag.item;
          updateTrackToggle();
          if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* ponteiro transferido do vídeo */}
        } else message('Clique sobre uma ponta ou sobre o corpo da linha para arrastá-la.');
        return;
      }
      if(tool==='full8'&&!full8ManualMode){
        message('O boneco já está montado. Arraste uma linha para movê-lo por inteiro, ou uma bolinha para corrigir um refletor.');
        return;
      }
      if(tool==='full8'){
        activeDraw={pointer:event.pointerId,kind:'full8-sequence',start:point};
        draft=[point];
        if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
        render();return;
      }
      activeDraw={pointer:event.pointerId,kind:tool,start:point};
      draft=draftFromDrag(tool,point,point,false);
      if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* ponteiro transferido do vídeo */}
      render();
    }
    canvas.addEventListener('pointerdown',canvasPointerDown);
    function canvasPointerMove(event) {
      const p=pointAt(event);if(!p)return;
      // Cruz fina inclusive em cima dos marcadores: o cursor "mão" escondia
      // exatamente o ponto anatômico que o profissional precisava acertar.
      canvas.style.cursor='crosshair';
      if (activeDraw?.pointer===event.pointerId) {
        event.preventDefault();
        draft=activeDraw.kind==='angle-sequence'?[...angleSequence,snapAngleSequencePoint(p,event.shiftKey)]:
          activeDraw.kind==='full8-sequence'?[...full8Sequence,p]:
          draftFromDrag(activeDraw.kind,activeDraw.start,p,event.shiftKey);
        render();return;
      }
      if (!activeDrag || event.pointerId!==activeDrag.pointer)return;
      event.preventDefault();
      if (activeDrag.index>=0){
        const item=annotations[activeDrag.item];
        item.points[activeDrag.index]=snapEditedPoint(item,activeDrag.index,p,event.shiftKey);
      }
      else {
        const dx=p.x-activeDrag.origin.x,dy=p.y-activeDrag.origin.y;
        annotations[activeDrag.item].points=activeDrag.original.map(q=>constrain({x:q.x+dx,y:q.y+dy}));
      }
      render();
    }
    canvas.addEventListener('pointermove',event=>{
      if(forwardedGesture?.pointerId!==event.pointerId)canvasPointerMove(event);
    });
    const stopDrag=event => {
      if (activeDraw?.pointer===event.pointerId) {
        const p=pointAt(event) || activeDraw.start;
        const travel=Math.hypot(p.x-activeDraw.start.x,p.y-activeDraw.start.y);
        if(event.type==='pointercancel'){
          angleSequence=[];full8Sequence=[];draft=[];updateFull8Guide();render();
          message('Marcação interrompida. Comece novamente.');
        } else if(activeDraw.kind==='full8-sequence'){
          full8Sequence.push(p);
          if(full8Sequence.length===8){
            annotations.push({uid:newMarkUid(),kind:'full8',points:full8Sequence.map(q=>({...q})),
              trackEnabled:defaultTrackEnabled,color:colors.full8});
            lastDeletedAnnotation=null;selectedIndex=annotations.length-1;
            full8Sequence=[];draft=[];updateFull8Guide();
            render();updateCameraControls();schedulePhotoSave();
            message('Análise completa concluída! Os 8 pontos estão interligados. Arraste qualquer referência para corrigir; o joelho e o pé são calculados automaticamente.');
          }else{
            draft=[...full8Sequence];updateFull8Guide();render();
            message(`${full8Sequence.length}/8 pontos marcados. Próximo: ${FULL8_POINTS[full8Sequence.length]}. Esc cancela.`);
          }
        } else if(activeDraw.kind==='angle-sequence'||(activeDraw.kind==='angle'&&travel<8)){
          angleSequence.push(snapAngleSequencePoint(p,event.shiftKey));
          if(angleSequence.length===3){
            annotations.push({uid:newMarkUid(),kind:'angle',points:angleSequence.map(q=>({...q})),
              trackEnabled:defaultTrackEnabled,color:activeAngleColor});
            lastDeletedAnnotation=null;
            selectedIndex=annotations.length-1;
            angleSequence=[];draft=[];render();updateCameraControls();schedulePhotoSave();
            message('Ângulo de três pontos concluído! Puxe cada ponto diretamente com o mouse, sem clicar em “Ajustar pontos”.');
          }else{
            draft=[...angleSequence];render();
            message(angleSequence.length===1?'1º ponto marcado (trocânter). Clique agora no côndilo femoral lateral.':
              '2º ponto marcado (côndilo). Clique no maléolo lateral para concluir o ângulo. Esc cancela.');
          }
        } else if (travel<8) {
          draft=[];render();
          message('Arraste a reta para desenhar, ou mude para Ângulo e marque três pontos com três cliques.');
        } else {
          const points=draftFromDrag(activeDraw.kind,activeDraw.start,p,event.shiftKey);
          annotations.push({uid:newMarkUid(),kind:activeDraw.kind,points,trackEnabled:defaultTrackEnabled,
            ...(activeDraw.kind==='angle'?{color:activeAngleColor}:{})});
          lastDeletedAnnotation=null;
          selectedIndex=annotations.length-1;
          draft=[];render();
          updateCameraControls();
          schedulePhotoSave();
          message('Marca concluída. Agora você pode puxar qualquer uma das pontas diretamente, com a mesma ferramenta selecionada.');
        }
        activeDraw=null;
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (activeDrag && activeDrag.pointer===event.pointerId) {
        const changed=activeDrag.item;
        const changedPoint=activeDrag.index;
        activeDrag=null;
        fineUncertain=fineUncertain.filter(p=>!(p.item===changed&&(changedPoint<0||p.point===changedPoint)));
        const removedTrajectory=singlePointTrails.delete(changed);
        if(stillFromVideo&&byId('fine-mode').checked){
          for(const key of fineTrails.keys())if(key.startsWith(`${changed}:`))fineTrails.delete(key);
          finePeak=null;
          byId('fine-readout').textContent='Ponto corrigido · continue com a rodinha';
          updateCameraControls();render();
        }
        else if(removedTrajectory)render();
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        message('Marcador ajustado. Confira o ângulo atualizado na imagem.');
        schedulePhotoSave();
      }
    };
    canvas.addEventListener('pointerup',event=>{
      if(forwardedGesture?.pointerId!==event.pointerId)stopDrag(event);
    });
    canvas.addEventListener('pointercancel',event=>{
      if(forwardedGesture?.pointerId!==event.pointerId)stopDrag(event);
    });
    byId('undo').addEventListener('click',() => {
      if(draft.length){
        draft=[];angleSequence=[];full8Sequence=[];updateFull8Guide();
        message('Marcação incompleta cancelada.');
      }else if(lastDeletedAnnotation){
        const {index,item,uid,affected}=lastDeletedAnnotation;
        if(uid)deletedMarkIds.delete(uid);
        globalThis.PAIVA_2D_HISTORY?.restoreFrames(timelineFrames,affected);
        annotations.splice(Math.min(index,annotations.length),0,item);
        selectedIndex=Math.min(index,annotations.length-1);
        lastDeletedAnnotation=null;
        message('Marcação recuperada na posição original.');
      }else{
        if(annotations.length){deleteAnnotation(annotations.length-1);return;}
        message('Nenhuma anotação para desfazer.');
      }
      fineTrails.clear();singlePointTrails.clear();fineUncertain=[];finePeak=null;
      updateCameraControls();
      render();
      schedulePhotoSave();
    });
    byId('clear').addEventListener('click',() => {
      if (annotations.length && !window.confirm('Remover todas as linhas e ângulos desta foto?'))return;
      annotations=[];draft=[];angleSequence=[];full8Sequence=[];selectedIndex=-1;lastDeletedAnnotation=null;
      wheelAnchor=null;
      updateFull8Guide();
      fineTrails.clear();singlePointTrails.clear();fineUncertain=[];finePeak=null;
      closeDeleteMenu();render();message('Marcações removidas. A fotografia foi preservada.');
      schedulePhotoSave();
      updateCameraControls();
    });
    byId('save').addEventListener('click',() => {
      if (!photoLoaded) {message('Carregue uma fotografia antes de salvar.');return;}
      // A foto exportada inclui a camada de curvas sem alterar o quadro base
      // nem destruir qualquer marcação angular existente.
      const exportCanvas=document.createElement('canvas');
      exportCanvas.width=canvas.width;exportCanvas.height=canvas.height;
      const exportCtx=exportCanvas.getContext('2d');
      if(!exportCtx){message('Não foi possível preparar a imagem.');return;}
      exportCtx.drawImage(canvas,0,0);
      if(curveLayer?.canvas)exportCtx.drawImage(curveLayer.canvas,0,0,canvas.width,canvas.height);
      exportCanvas.toBlob(blob => {
        if (!blob) {message('Não foi possível gerar a imagem.');return;}
        const uri=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=uri;link.download='PAIVA_Analise_Angular_2D.png';
        document.body.append(link);link.click();link.remove();
        setTimeout(() => URL.revokeObjectURL(uri),30000);
        message('Imagem 2D anotada pronta para download. Guarde-a com a ficha do cliente.');
      },'image/png');
    });
    function photographCurrentFrame(){
      if(!video.hidden && !captureVideoFrame())return;
      if(!photoLoaded){message('Abra uma fotografia ou vídeo antes de usar a câmera.');return;}
      byId('save').click();
    }
    byId('photo-action').addEventListener('click',photographCurrentFrame);
    byId('camera-shot').addEventListener('click',photographCurrentFrame);

    globalThis.PAIVA_ATHLETE_2D = {
      getAngles:() => annotations.filter(item => item.kind==='angle').map(displayedAngle),
      hasImage:() => photoLoaded,
      openVideo:(file,label) => {
        const loaded=loadVideoFile(file,label);
        if(loaded)section.scrollIntoView({behavior:'smooth',block:'start'});
        return loaded;
      }
    };
    render();
  }

  // O HTML carrega este arquivo com `defer`, antes dos módulos de registros e
  // rastreamento. `interactive` ainda é cedo: esperar DOMContentLoaded garante
  // que todos os scripts deferidos estejam prontos ao montar a bancada 2D.
  if (document.readyState==='complete') initialize();
  else document.addEventListener('DOMContentLoaded',initialize,{once:true});

  // PAIVA AERO V5.35: painel visual simplificado, independente do 2D.
  // Carrega somente os controles de onda visual; não interfere no rastreio.
  const windStyle=document.createElement('link');
  windStyle.rel='stylesheet';
  windStyle.href='./paiva-wind-simple.css';
  document.head.append(windStyle);
  const silhouetteScript=document.createElement('script');
  silhouetteScript.src='./paiva-wind-segmentation.js';
  silhouetteScript.async=false;
  const aiScript=document.createElement('script');
  aiScript.src='./paiva-wind-ai.js';
  aiScript.async=false;
  document.head.append(aiScript);
  document.head.append(silhouetteScript);
  const contourScript=document.createElement('script');
  contourScript.src='./paiva-aero-contour.js';
  contourScript.async=false;
  document.head.append(contourScript);
  const windScript=document.createElement('script');
  windScript.src='./paiva-wind-simple.js';
  windScript.async=false;
  document.head.append(windScript);
})();
