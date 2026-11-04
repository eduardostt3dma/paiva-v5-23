/* PAIVA — análise 2D em fotografia ou quadro de vídeo, 100% local.
   Marcação manual e rastreio fino semiautomático quadro a quadro.
   Não faz reconhecimento anatômico automático nem reconstrução 3D. */
(() => {
  'use strict';

  function angleDegrees(a, vertex, c) {
    const ux = a.x - vertex.x, uy = a.y - vertex.y;
    const vx = c.x - vertex.x, vy = c.y - vertex.y;
    const uLength = Math.hypot(ux,uy), vLength = Math.hypot(vx,vy);
    if (uLength < 8 || vLength < 8) return null;
    return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(uLength*vLength)))) * 180 / Math.PI;
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
        <p><strong>Ângulo suplementar:</strong> clique diretamente na etiqueta “A 35°”, por exemplo, para alternar entre 35° e 145° (180° − 35°). A geometria das hastes não muda, somente a convenção mostrada. Confirme qual convenção está usando no laudo.</p>
        <p><strong>Linha:</strong> clique e arraste de uma extremidade até a outra. Depois, “Ajustar pontos” permite puxar as pontas ou mover a reta inteira pelo centro. Sem calibração métrica, não é uma régua em milímetros.</p>
        <p><strong>Alinhamento:</strong> selecione uma linha tocando nela e use Horizontal / Vertical; mantenha Shift pressionado ao desenhar para limitar a inclinação a passos de 45°.</p>
        <p><strong>Rodinha do mouse:</strong> sobre o vídeo ou sobre um quadro capturado, gire para avançar ou voltar um quadro da pedalada. A página permanece parada. Em fotos independentes, use Ctrl + rodinha para o zoom. No quadro de vídeo capturado, a nova opção “Seguir pontos por quadro” tenta deslocar os marcadores automaticamente; quando um ponto se perder, corrija-o com o mouse. Com essa opção desligada, as marcações permanecem fixas.</p>
        <p><strong>Mouse e teclado:</strong> com o mouse sobre o vídeo, o botão DIREITO alterna pausar/reproduzir, sem abrir o menu do navegador. A tecla Espaço também alterna play/pause; K pausa, L reproduz e as setas ← / → mudam um quadro. Atalhos não são aplicados enquanto você digita em campos ou usa seletores.</p>
        <p><strong>Congelar com clique:</strong> no vídeo gravado, clique com o botão ESQUERDO sobre a imagem para pausar e capturar automaticamente o quadro atual; as ferramentas compactas ficam logo abaixo. Com o quadro capturado, você pode marcar ou editar os pontos.</p>
        <p><strong>Zoom:</strong> a análise abre centralizada em 175% para facilitar os pontos. O controle varia de 5% em 5%, incluindo 175% e 180%, até 400%. Clique em “Ajustar foto” ou “100%” para ver toda a imagem.</p>
        <p><strong>Enquadramento:</strong> em 100%, a foto inteira se ajusta automaticamente à altura e largura visíveis, sem precisar rolar a imagem. O botão “Ajustar foto” restaura esse enquadramento. “Tela ampla” esconde temporariamente o painel lateral e ocupa a janela para analisar com mais espaço. Saia pela mesma tecla ou Esc. O zoom acima de 100% volta a permitir deslocamento intencional para ver detalhes.</p>
        <p><strong>Marcar sem capturar:</strong> com um vídeo carregado, escolha Ângulo, Linha ou Ponto (as ferramentas ficam sempre visíveis). Clique e arraste diretamente no atleta: o vídeo congela naquele instante automaticamente e a marcação já começa com o mouse pressionado. Um clique simples também congela para você ajustar os pontos em seguida. O tamanho da imagem é mantido ao alternar do vídeo para o quadro congelado.</p>
        <p><strong>Régua de recorte:</strong> abaixo do vídeo, arraste as duas alças da régua — início e fim — até o trecho desejado. O botão “✂ Salvar trecho” gera o novo MP4 local, preservando o original. O ícone 📷 tira uma foto do quadro e salva um PNG com as marcações que estiverem visíveis.</p>
        <p><strong>Espessura:</strong> ajuste as linhas de 1 a 8 px no painel lateral. A mudança aparece imediatamente nas linhas existentes e nas novas marcações.</p>
        <p><strong>Webcam:</strong> no computador, libere o acesso à câmera para visualizar e filmar o pedal. Grave até 3 minutos ou clique e arraste diretamente no quadro da webcam para congelar e marcar. Não é mais obrigatório apertar “Capturar quadro”. Os pontos iniciais são sempre marcados manualmente.</p>
        <p><strong>Vídeos antigos:</strong> use “Abrir vídeo do computador ou pendrive” para carregar MP4, WebM, MOV e outros formatos que seu navegador consiga decodificar. Pause num quadro, capture e analise com as mesmas ferramentas; nenhum arquivo é enviado à internet.</p>
        <p><strong>Recortar vídeo:</strong> na coluna lateral, abra “✂ Recortar trecho do vídeo”. Marque início e fim pelo tempo atual ou digite mm:ss (ex.: 00:15 a 02:00). “Recortar e salvar MP4” gera um novo arquivo de até 3 minutos pelo motor de vídeo local; a filmagem original não é alterada. Esse processamento pode levar alguns minutos.</p>
        <p><strong>Seis cores:</strong> sob o quadro capturado, escolha vermelho, branco, verde, roxo, azul ou âmbar antes de desenhar o ângulo. Para mudar a cor de um ângulo existente, selecione-o com “Ajustar pontos” e escolha outra cor.</p>
        <p><strong>Registro automático:</strong> cada quadro capturado é arquivado como foto PNG com as linhas e ângulos, e atualizado quando você terminar de ajustá-los. As gravações de webcam e os vídeos recortados também vão para “Fotos e vídeos salvos”. Tudo permanece no armazenamento deste navegador, não em uma pasta permanente do Windows. Abra a lista e clique em Baixar para fazer suas cópias de segurança; limpar dados do navegador pode apagar os registros.</p>
        <p><strong>Vai e volta contínuo:</strong> os comandos ficam logo abaixo da imagem. Com essa opção marcada, o vídeo segue até o fim, retorna por buscas sucessivas de quadros e volta a avançar sem parar até você clicar em Pausar. A fluidez do retorno depende dos quadros-chave, do arquivo e do computador; a reprodução reversa em navegador pode ser menos suave do que em programas nativos. Use a régua de tempo para escolher o instante exato.</p>
        <p><strong>Extensão em trecho curto:</strong> capture um quadro próximo da extensão máxima e marque os três pontos anatômicos. Use “Buscar extensão” para examinar um intervalo curto antes e depois daquele instante, procurando o maior valor na convenção angular escolhida. O rastreio é experimental e pode interromper em áreas sem contraste; é uma prévia a validar manualmente, não uma medição clínica autônoma.</p>
        <p><strong>Seguir marcações em vídeo:</strong> depois de congelar um quadro do vídeo gravado, desenhe e alinhe as marcações. O comando avançado “Seguir marcações no vídeo” tenta acompanhá-las durante a reprodução. Se perder a referência, interrompe; não reconhece articulações e pode sofrer desvios. Use marcadores contrastantes, câmera fixa e valide cada ângulo antes de usar no bike fit.</p>
        <p><strong>Seguir pontos ao reproduzir:</strong> após capturar e marcar o quadro, escolha Voltar ao vídeo e Reproduzir. Com essa opção ativa, o rastreio assistido tenta acompanhar os pontos já desenhados, inclusive no retorno. Se perder algum marcador, a análise é interrompida para evitar um ângulo enganoso. Reposicione os pontos e recomece do quadro correto.</p>
        <p><strong>Ponto de trajetória:</strong> escolha “PONTO · RASTRO” e clique no quadril, pé ou outra referência visível; use “AJUSTAR PONTOS” para refinar a posição. Depois volte ao vídeo e reproduza com rastreio. O ponto e seu caminho recente ficam destacados sem cálculo angular. A linha do rastro representa deslocamento na imagem (pixels), não milímetros ou movimento tridimensional.</p>
        <p><strong>Rastreio fino (estilo de trabalho do Kinovea):</strong> congele o quadro próximo ao pedivela em 178°–180° e marque trocânter, côndilo e maléolo; opcionalmente, marque calcanhar e quadril. Com “Seguir pontos por quadro” ativado, gire a rodinha ou use ◀/▶ para mover somente UM quadro e atualizar cada marcador. Se uma referência escapar, ela permanece na posição anterior, sinalizada para corrigir: arraste o ponto diretamente na foto e continue com a rodinha. Não há necessidade de percorrer uma volta inteira. Em “Ajustes do rastreio” escolha o tamanho do alvo e a área de busca em pixels; a visualização das janelas é opcional. Os três marcos do ângulo são rastreados separadamente, mas exigem conferência visual. O método é implementação independente, não código do Kinovea.</p>
        <p><strong>Cursor e exclusão:</strong> sobre qualquer ponto, ângulo ou linha, o cursor permanece em cruz para posicionar com precisão. Clique com o botão DIREITO sobre uma marcação para abrir a opção “Excluir”. A exclusão pode ser revertida pelo botão Desfazer. Fora da marcação, o botão direito continua controlando pausa/play do vídeo. A tecla Delete também remove a marca selecionada quando a área do vídeo está em foco.</p>
        <p><strong>Rastrear um ponto isolado:</strong> escolha “PONTO · RASTRO”, marque um ponto no calcanhar ou no quadril e deixe “Seguir pontos por quadro” ligado. A rodinha do mouse acompanha esse pontinho e desenha o pequeno trajeto, mesmo sem ângulo desenhado. Se ele perder a referência, arraste-o de volta e continue.</p>
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
            <button type="button" data-2d-tool="angle" aria-pressed="true">ÂNGULO · ARRASTAR</button>
            <button type="button" data-2d-tool="line" aria-pressed="false">LINHA · ARRASTAR</button>
            <button type="button" data-2d-tool="point" aria-pressed="false">PONTO · RASTRO</button>
            <button type="button" data-2d-tool="edit" aria-pressed="false">AJUSTAR PONTOS</button>
            <button type="button" id="paiva-2d-photo-action" title="Foto com marcações" aria-label="Salvar foto do atleta com os ângulos">📷 Foto</button>
          </div>
          <label class="paiva-2d-point-role" id="paiva-2d-point-role-field" hidden>Rastrear ponto de
            <select id="paiva-2d-point-role" aria-label="Qual parte do atleta será rastreada">
              <option value="heel">Calcanhar</option><option value="hip">Quadril</option><option value="free">Outro ponto</option>
            </select>
          </label>
          <div class="paiva-2d-align" role="group" aria-label="Alinhar linha selecionada">
            <button type="button" id="paiva-2d-align-horizontal">↔ Horizontal</button>
            <button type="button" id="paiva-2d-align-vertical">↕ Vertical</button>
          </div>
          <div class="paiva-2d-zoom" role="group" aria-label="Zoom da fotografia">
            <label for="paiva-2d-zoom">Zoom <output id="paiva-2d-zoom-value">175%</output></label>
            <input id="paiva-2d-zoom" type="range" min="100" max="400" step="5" value="175" />
            <button type="button" id="paiva-2d-zoom-out">−</button>
            <button type="button" id="paiva-2d-zoom-reset">100%</button>
            <button type="button" id="paiva-2d-zoom-in">+</button>
          </div>
          <label class="paiva-2d-width" for="paiva-2d-width">Espessura das linhas <output id="paiva-2d-width-value" for="paiva-2d-width">3 px</output>
            <input id="paiva-2d-width" type="range" min="1" max="8" step="1" value="3" aria-label="Espessura das linhas, de um a oito pixels" />
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
              <label class="paiva-2d-pingpong"><input type="checkbox" id="paiva-2d-pingpong" checked /> ↔ Vai e volta contínuo</label>
              <label>Velocidade do vídeo
                <select id="paiva-2d-speed" aria-label="Velocidade de reprodução">
                  <option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option>
                  <option value="1" selected>1×</option><option value="1.5">1,5×</option>
                </select>
              </label>
              <div><button type="button" id="paiva-2d-play-video" disabled>▶ Reproduzir</button>
                <button type="button" id="paiva-2d-pause-video" disabled>⏸ Pausar</button></div>
              <label>Quadros por segundo do arquivo (para avançar manualmente)
                <select id="paiva-2d-file-fps"><option value="24">24 fps</option><option value="25">25 fps</option><option value="30" selected>30 fps</option><option value="50">50 fps</option><option value="60">60 fps</option></select>
              </label>
              <div><button type="button" id="paiva-2d-prev-frame" disabled>◀ Quadro</button>
                <button type="button" id="paiva-2d-next-frame" disabled>Quadro ▶</button></div>
              <small class="paiva-2d-wheel-hint">🖱 Rodinha: quadros · Direito: play/pause · Espaço: play/pause · ← →: quadros</small>
            </div>
            <button type="button" id="paiva-2d-camera-start">Ligar webcam</button>
            <button type="button" id="paiva-2d-record" disabled>Iniciar gravação</button>
            <button type="button" id="paiva-2d-stop-record" disabled>Parar gravação</button>
            <button type="button" id="paiva-2d-capture" disabled>Capturar quadro</button>
            <button type="button" id="paiva-2d-back-video" hidden>Voltar ao vídeo</button>
            <button type="button" id="paiva-2d-track-start" disabled>Seguir marcações no vídeo</button>
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
            <details class="paiva-2d-records"><summary>▣ Fotos e vídeos salvos <span id="paiva-2d-record-count"></span></summary>
              <small>Salvos automaticamente neste navegador, sem enviar ao site. Para guardar permanentemente, use Baixar; limpar dados do site pode apagá-los.</small>
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
    const markingDock=section.querySelector('.paiva-2d-marking-dock');
    for(const selector of ['.paiva-2d-tools','.paiva-2d-point-role','.paiva-2d-align','.paiva-2d-zoom','.paiva-2d-width'])
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
    quickDock.insertAdjacentHTML('afterbegin','<label class="paiva-2d-follow"><input type="checkbox" id="paiva-2d-auto-track" /> Seguir pontos ao reproduzir <span>· experimental</span></label>');
    playbackAdvanced.append(quickDock.querySelector('.paiva-2d-follow'));
    quickDock.innerHTML=`<div class="paiva-2d-fine-controls" aria-label="Rastreio fino por quadro">
      <label title="Acompanhar cada marcador quando você avança ou volta um quadro"><input id="paiva-2d-fine-mode" type="checkbox" checked /> ↔ Seguir pontos por quadro</label>
      <button type="button" id="paiva-2d-fine-prev" title="Voltar um quadro seguindo os pontos">◀</button>
      <button type="button" id="paiva-2d-fine-next" title="Avançar um quadro seguindo os pontos">▶</button>
      <button type="button" id="paiva-2d-fine-peak" title="Abrir o maior ângulo do joelho observado nos quadros percorridos" disabled>↗ Pico</button>
      <details class="paiva-2d-fine-settings"><summary>Ajustes do rastreio</summary>
        <label>Alvo (px) <select id="paiva-2d-fine-patch"><option value="4">4</option><option value="6" selected>6</option><option value="8">8</option><option value="10">10</option></select></label>
        <label>Busca (px) <select id="paiva-2d-fine-search"><option value="12">12</option><option value="22" selected>22</option><option value="32">32</option><option value="42">42</option></select></label>
        <label><input type="checkbox" id="paiva-2d-fine-boxes" /> Mostrar janelas</label>
      </details>
      <small id="paiva-2d-fine-readout">Marque o ângulo e gire a rodinha.</small>
    </div>`;
    section.querySelector('.paiva-2d-player-dock').hidden=true;

    const byId = key => document.getElementById('paiva-2d-' + key);
    const canvas = byId('canvas');
    const video = byId('video');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      byId('status').textContent = 'Este navegador não permite desenhar nesta ferramenta 2D.';
      return;
    }
    const original = document.createElement('canvas');
    const originalCtx = original.getContext('2d');
    if (!originalCtx) return;

    let photoLoaded = false;
    let tool = 'angle';
    let draft = [];
    let angleSequence = [];
    let annotations = [];
    let activeDrag = null;
    let activeDraw = null;
    let selectedIndex = -1;
    let lineWidth = 3;
    let cycleResult=null,cycleTrailsVisible=false;
    const fineTrails=new Map();
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
    const colors = {angle:'#e7cf86',line:'#8bd6e4',point:'#a8f5c3'};
    const palette=['#f56b6b','#f3f6fb','#57d39a','#b99cff','#64cbff','#ffca73'];
    let activeAngleColor=palette[0];
    const message = text => {byId('status').textContent = text;};
    const format = value => value.toFixed(1).replace('.',',');
    const displayedAngle = item => {
      const a=angleDegrees(item.points[0],item.points[1],item.points[2]);
      return a===null?null:item.supplementary?180-a:a;
    };
    // Um registro por quadro capturado. Novas marcações atualizam a foto do mesmo
    // instante, em vez de criar uma cópia a cada movimento do mouse.
    let autoPhotoId=null,photoSaveTimer=null,photoVersion=0;
    const records=()=>globalThis.PAIVA_RECORDS;
    const photoName=()=>`PAIVA_Analise_2D_${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
    let photoRecordName=photoName();
    function newPhotoRecord(){
      autoPhotoId=records()?.id('foto')||null;
      photoRecordName=photoName();photoVersion++;
      clearTimeout(photoSaveTimer);
    }
    function schedulePhotoSave(delayMs=650){
      if(!photoLoaded||!records()?.save||!autoPhotoId)return;
      const version=++photoVersion;
      clearTimeout(photoSaveTimer);
      photoSaveTimer=setTimeout(()=>{
        if(version!==photoVersion||!photoLoaded)return;
        canvas.toBlob(blob=>{
          if(!blob||version!==photoVersion)return;
          records().save({id:autoPhotoId,kind:'foto',name:photoRecordName,
            description:`Imagem 2D com ${annotations.filter(a=>a.kind==='angle').length} ângulo(s)`,blob})
            .catch(error=>{byId('record-count').textContent='· salvamento indisponível';console.warn('PAIVA: registro local',error);});
        },'image/png');
      },delayMs);
    }
    async function saveVideoRecord(blob,name,description){
      if(!records()?.save)return false;
      try{await records().save({kind:'video',name,description,blob});return true;}
      catch(error){message('Vídeo disponível para baixar, mas o salvamento automático falhou: '+(error?.message||'sem espaço'));return false;}
    }
    const recordList=byId('records-list');
    async function refreshRecordList(){
      if(!records()?.list){recordList.textContent='Registros indisponíveis neste navegador.';return;}
      try{
        const items=await records().list(40);
        byId('record-count').textContent=items.length?`· ${items.length}${items.length===40?'+':''}`:'';
        recordList.replaceChildren();
        if(!items.length){recordList.textContent='Nenhum registro ainda.';return;}
        for(const item of items){
          const row=document.createElement('div');row.className='paiva-2d-record-row';
          const info=document.createElement('span');info.textContent=`${item.kind==='foto'?'📷':'🎞'} ${item.name} · ${(item.size/1048576).toFixed(1)} MB`;
          info.title=item.description;row.append(info);
          const download=document.createElement('button');download.type='button';download.textContent='Baixar';
          download.addEventListener('click',()=>records().download(item.id).catch(e=>message(e.message)));row.append(download);
          const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Apagar este registro';
          remove.addEventListener('click',async()=>{
            if(!confirm('Apagar este registro salvo no navegador?'))return;
            try{await records().remove(item.id);}catch(e){message(e.message);}
          });row.append(remove);recordList.append(row);
        }
      }catch(error){recordList.textContent='Não foi possível ler os registros: '+(error?.message||'erro local');}
    }
    window.addEventListener('paiva-records-changed',refreshRecordList);
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
    function snapAngle(anchor,point,shiftKey) {
      if (!shiftKey) return point;
      const dx=point.x-anchor.x,dy=point.y-anchor.y;
      const length=Math.hypot(dx,dy);
      const direction=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);
      return constrain({x:anchor.x+Math.cos(direction)*length,y:anchor.y+Math.sin(direction)*length});
    }
    function draftFromDrag(kind,anchor,pointer,shiftKey) {
      const end=snapAngle(anchor,pointer,shiftKey);
      if (kind==='line') return [anchor,end];
      const dx=end.x-anchor.x,dy=end.y-anchor.y;
      // Uma única ação abre um ângulo reto editável; as hastes continuam livres.
      return [end,anchor,constrain({x:anchor.x-dy,y:anchor.y+dx})];
    }
    function segmentDistance(p,a,b) {
      const dx=b.x-a.x,dy=b.y-a.y;
      const norm=dx*dx+dy*dy;
      if (!norm) return Math.hypot(p.x-a.x,p.y-a.y);
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/norm));
      return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
    }

    function mark(p,color) {
      const radius = Math.max(3,Math.min(10,lineWidth+2));
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle = '#0b1a24';ctx.fill();
      ctx.lineWidth = Math.max(1,lineWidth/2);ctx.strokeStyle = color;ctx.stroke();
    }

    function tag(x,y,text,color) {
      const fontSize = Math.max(12,Math.min(20,canvas.width/65));
      ctx.font = `700 ${fontSize}px system-ui,sans-serif`;
      const padding = 4;
      const w = ctx.measureText(text).width + padding*2;
      const h = fontSize+padding*2;
      const tx = Math.max(4,Math.min(canvas.width-w-4,x+11));
      const ty = Math.max(h+4,Math.min(canvas.height-4,y-11));
      ctx.fillStyle = 'rgba(8,20,29,.74)';
      ctx.fillRect(tx,ty-h,w,h);
      ctx.strokeStyle = color;ctx.lineWidth=1;ctx.strokeRect(tx,ty-h,w,h);
      ctx.fillStyle = '#f4f8fa';ctx.textBaseline='middle';ctx.fillText(text,tx+padding,ty-h/2);
      return {left:tx,top:ty-h,right:tx+w,bottom:ty};
    }

    function drawAnnotation(item,index,partial=false) {
      const pts = item.points;
      const color = item.color||(item.kind==='point'&&item.role==='hip'?'#64cbff':colors[item.kind]);
      if(item.kind==='point') {
        if(pts.length){
          const p=pts[0];
          ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,lineWidth+1),0,Math.PI*2);
          ctx.fillStyle=color;ctx.fill();
          ctx.strokeStyle='#102a24';ctx.lineWidth=1.5;ctx.stroke();
        }
        return;
      }
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.strokeStyle=color;
      ctx.beginPath();
      if (pts.length) ctx.moveTo(pts[0].x,pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.stroke();
      for (const p of pts) mark(p,color);
      if (!partial && item.kind === 'angle' && pts.length === 3) {
        item.labelBounds=null;
        const a = displayedAngle(item);
        if (a !== null) item.labelBounds=tag(pts[1].x,pts[1].y,`A ${format(a)}°`,color);
      }
      if (!partial && item.kind === 'line' && pts.length === 2) {
        tag((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,`L${index+1}`,color);
      }
    }

    function updateValues() {
      const values = [];
      annotations.forEach((item,index) => {
        if (item.kind === 'angle') {
          const a = displayedAngle(item);
          values.push(`Ângulo ${index+1}: ${a === null ? 'rever pontos' : format(a)+'°'}`);
        } else if(item.kind==='point') values.push(`${item.role==='heel'?'Calcanhar':item.role==='hip'?'Quadril':`Ponto ${index+1}`} · rastro`);
        else values.push(`Linha ${index+1}`);
      });
      byId('values').textContent = values.join('  ·  ');
    }

    function render() {
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
          const item=annotations[Number(key.split(':')[0])];
          const color=item?.color||(item?.role==='hip'?'#64cbff':'#a8f5c3');
          ctx.save();ctx.globalAlpha=.52;ctx.strokeStyle=color;
          ctx.lineWidth=Math.max(1.5,lineWidth*.55);ctx.beginPath();
          path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
          ctx.stroke();ctx.restore();
        }
      }
      annotations.forEach((item,index) => drawAnnotation(item,index));
      if(stillFromVideo&&byId('fine-mode').checked){
        for(const lost of fineUncertain){
          const p=annotations[lost.item]?.points?.[lost.point];if(!p)continue;
          ctx.save();ctx.strokeStyle='#ffb45e';ctx.lineWidth=2.5;
          ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        if(byId('fine-boxes').checked&&selectedIndex>=0){
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
    }

    function selectTool(next) {
      tool=next;draft=[];angleSequence=[];activeDrag=null;activeDraw=null;
      byId('point-role-field').hidden=next!=='point';
      for (const button of section.querySelectorAll('[data-2d-tool]'))
        button.setAttribute('aria-pressed',String(button.getAttribute('data-2d-tool')===tool));
      render();
      if(!video.hidden && videoCanCapture()){
        message('Ferramenta pronta. Clique sobre o atleta para congelar. Ângulo: marque os 3 pontos com cliques ou abra as hastes arrastando.');
        return;
      }
      if (!photoLoaded) return;
      message(tool==='angle' ? 'Ângulo: clique em trocânter → côndilo → maléolo (3 cliques), ou arraste para abrir um ângulo. Depois puxe qualquer ponto, sem mudar de ferramenta.' :
        tool==='line' ? 'Linha: clique e ARRASTE do início ao fim. Use Shift para alinhar a cada 45°.' :
        tool==='point' ? 'Ponto: clique no quadril ou no pé. Arraste-o diretamente para corrigir.' :
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
        const segments=annotations[i].kind==='angle' ? [[0,1],[1,2]] : annotations[i].kind==='line' ? [[0,1]] : [];
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
      const kind=annotations[index].kind;
      lastDeletedAnnotation={index,item:annotations[index]};
      annotations.splice(index,1);
      selectedIndex=-1;draft=[];angleSequence=[];activeDrag=null;activeDraw=null;
      fineTrails.clear();fineUncertain=[];finePeak=null;
      byId('fine-readout').textContent='Marcação excluída · Desfazer restaura';
      closeDeleteMenu();
      render();updateCameraControls();schedulePhotoSave();
      const type=kind==='angle'?'Ângulo':kind==='point'?'Ponto':'Linha';
      message(`${type} excluído. Clique em “Desfazer” para recuperar se precisar.`);
      return true;
    }
    deleteMenu.querySelector('#paiva-2d-delete-confirm').addEventListener('click',()=>deleteAnnotation(pendingDeleteIndex));
    deleteMenu.querySelector('#paiva-2d-delete-cancel').addEventListener('click',closeDeleteMenu);
    document.addEventListener('pointerdown',event=>{
      if(!deleteMenu.hidden&&!deleteMenu.contains(event.target))closeDeleteMenu();
    });
    canvas.addEventListener('contextmenu',event=>{
      if(!photoLoaded||scanningActive)return;
      const index=annotationAt(event);
      if(index<0)return; // botão direito livre continua sendo play/pause
      event.preventDefault();event.stopPropagation();
      pendingDeleteIndex=index;selectedIndex=index;
      const kind=annotations[index].kind;
      deleteMenu.querySelector('#paiva-2d-delete-label').textContent=
        kind==='angle'?'Ângulo selecionado':kind==='point'?'Ponto selecionado':'Linha selecionada';
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
      lineWidth = Math.max(1,Math.min(8,Number(byId('width').value) || 3));
      byId('width-value').textContent = `${lineWidth} px`;
      render();
    });
    byId('width').addEventListener('change',schedulePhotoSave);
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
      if(event.key==='Escape'&&angleSequence.length){
        angleSequence=[];draft=[];activeDraw=null;render();
        message('Marcação de três pontos cancelada. Pode começar novamente.');
      }
    });
    byId('zoom').addEventListener('input',()=>updateZoom(Number(byId('zoom').value)));
    byId('zoom-in').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)+5));
    byId('zoom-out').addEventListener('click',()=>updateZoom(Number(byId('zoom').value)-5));
    byId('zoom-reset').addEventListener('click',()=>updateZoom(100));
    function alignLine(vertical) {
      let index=selectedIndex;
      if (annotations[index]?.kind!=='line') {
        index=-1;
        for (let i=annotations.length-1;i>=0;i--) {
          if (annotations[i].kind==='line') {index=i;break;}
        }
      }
      if (index<0) {message('Desenhe primeiro uma linha para alinhar.');return;}
      const pts=annotations[index].points;
      const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
      const length=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)/2;
      if (vertical) {
        pts[0]=constrain({x:center.x,y:center.y-length});
        pts[1]=constrain({x:center.x,y:center.y+length});
      } else {
        pts[0]=constrain({x:center.x-length,y:center.y});
        pts[1]=constrain({x:center.x+length,y:center.y});
      }
      selectedIndex=index;
      selectTool('edit');
      schedulePhotoSave();
      message(`Linha ${index+1} alinhada ${vertical?'verticalmente':'horizontalmente'}. Arraste as pontas para refinar.`);
    }
    byId('align-horizontal').addEventListener('click',()=>alignLine(false));
    byId('align-vertical').addEventListener('click',()=>alignLine(true));
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
    let trackingActive = false;
    let scanningActive = false,scanCancelled = false;
    const trackOverlay=byId('track-overlay');
    const trackCtx=trackOverlay.getContext('2d');
    const pointTrails=new Map();
    const maxRecordingMs = 180000;
    let backwardMode=false,reverseFrame=null,lastReverseTick=0,scrubActive=false,wheelAccumulator=0;
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
    function haltReverse(resetDirection=true) {
      if(reverseFrame!==null)cancelAnimationFrame(reverseFrame);
      reverseFrame=null;lastReverseTick=0;
      if(resetDirection)backwardMode=false;
    }
    function reverseTick(timestamp) {
      reverseFrame=null;
      if(!backwardMode||!hasFileVideo()||!byId('pingpong').checked)return;
      const fps=Number(byId('file-fps').value)||30;
      const rate=Number(byId('speed').value)||1;
      const interval=1000/(fps*rate);
      if(!lastReverseTick)lastReverseTick=timestamp-interval;
      if(timestamp-lastReverseTick>=interval && !video.seeking){
        lastReverseTick=timestamp;
        const next=Math.max(0,video.currentTime-1/fps);
        video.currentTime=next;
        syncTimeline();
        if(next<=.001){
          haltReverse();
          video.currentTime=0;
          Promise.resolve(video.play()).catch(()=>message('Clique em Reproduzir para continuar o vídeo.'));
          return;
        }
      }
      reverseFrame=requestAnimationFrame(reverseTick);
    }
    function startReverse() {
      if(!hasFileVideo()||!byId('pingpong').checked||!Number.isFinite(video.duration)||video.duration<=0)return;
      haltReverse();video.pause();
      backwardMode=true;
      video.currentTime=Math.max(0,video.duration-1/(Number(byId('file-fps').value)||30));
      reverseFrame=requestAnimationFrame(reverseTick);
      message('Retorno automático do vídeo. Clique em Pausar para examinar o quadro.');
    }

    function showVideo(enabled) {
      video.hidden = !enabled;
      canvas.hidden = enabled;
      // Ferramentas de marcação permanecem sempre visíveis, inclusive no vídeo.
      const videoContext=hasFileVideo()&&(enabled||stillFromVideo);
      section.querySelector('.paiva-2d-player-dock').hidden=!videoContext;
      section.querySelector('.paiva-2d-marking-dock').hidden=false;
      section.querySelector('.paiva-2d-angle-palette').hidden=false;
      byId('auto-track').disabled=!enabled;
      for (const button of section.querySelectorAll('[data-2d-tool]')) button.disabled=scanningActive;
      for (const key of ['undo','clear','save']) byId(key).disabled=enabled||scanningActive;
      byId('width').disabled=scanningActive;
      if(enabled)requestAnimationFrame(fitVideoImage);
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
    }

    function updateCameraControls() {
      const live = !!cameraStream;
      const recording = recorder?.state === 'recording';
      const hasPlayback = !!recordedUrl && video.getAttribute('src')===recordedUrl;
      byId('camera-start').disabled = live || recording;
      byId('camera-stop').disabled = !live;
      byId('record').disabled = !live || recording || typeof MediaRecorder === 'undefined';
      byId('stop-record').disabled = !recording;
      byId('capture').disabled = scanningActive || recording || (!live && !hasPlayback);
      byId('track-start').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo || !annotations.length || trackingActive || recording;
      byId('scan-short').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.kind==='angle') || trackingActive || recording;
      byId('cycle-start').disabled = scanningActive || !hasPlayback || !lastFrameFromVideo ||
        !annotations.some(item=>item.kind==='angle') || trackingActive || recording;
      byId('scan-radius').disabled = scanningActive;
      byId('cycle-duration').disabled = scanningActive;
      byId('track-stop').disabled = !trackingActive && !scanningActive;
      const canFine=hasPlayback&&!recording&&!scanningActive;
      byId('fine-prev').disabled=!canFine;
      byId('fine-next').disabled=!canFine;
      byId('fine-peak').disabled=!canFine||!finePeak;
      byId('prev-frame').disabled = !hasPlayback || recording || trackingActive || scanningActive;
      byId('next-frame').disabled = !hasPlayback || recording || trackingActive || scanningActive;
      byId('speed').disabled = !hasPlayback || recording;
      byId('pingpong').disabled = !hasPlayback || recording;
      byId('play-video').disabled = !hasPlayback || recording || scanningActive;
      byId('pause-video').disabled = !hasPlayback || recording || scanningActive;
      syncTimeline();
    }

    function stopTracking(clear=true) {
      if(scanningActive)scanCancelled=true;
      motionTracker?.stop();motionTracker=null;trackingActive=false;
      if (clear) trackOverlay.hidden=true;
      updateCameraControls();
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

    function paintTracked(points,w,h,time) {
      if (!trackCtx) return;
      alignTrackedOverlay();
      trackOverlay.width=w;trackOverlay.height=h;
      trackCtx.clearRect(0,0,w,h);
      trackCtx.lineWidth=2;trackCtx.lineCap='round';trackCtx.lineJoin='round';
      const readings=[];
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
          readings.push(`${item.role==='heel'?'Calcanhar':item.role==='hip'?'Quadril':`Ponto ${index+1}`} · trajetória`);
          return;
        }
        trackCtx.strokeStyle=color;trackCtx.fillStyle=color;
        trackCtx.beginPath();trackCtx.moveTo(pts[0].x,pts[0].y);
        for(let j=1;j<pts.length;j++)trackCtx.lineTo(pts[j].x,pts[j].y);
        trackCtx.stroke();
        for(const p of pts){
          trackCtx.beginPath();trackCtx.arc(p.x,p.y,4,0,Math.PI*2);
          trackCtx.fill();
        }
        if(item.kind==='angle') {
          const angle=angleDegrees(pts[0],pts[1],pts[2]);
          if(angle!==null) {
            const shown=item.supplementary?180-angle:angle;
            readings.push(`A ${format(shown)}°`);
            trackCtx.font='650 13px system-ui,sans-serif';
            trackCtx.fillText(`A ${format(shown)}°`,Math.min(w-82,pts[1].x+8),Math.max(15,pts[1].y-8));
          }
        }
      });
      byId('values').textContent=`Rastreio experimental ${time.toFixed(1).replace('.',',')} s · ${readings.join('  |  ') || 'linhas em movimento'}`;
    }

    async function startTracking() {
      if (trackingActive || scanningActive || !lastFrameFromVideo || !annotations.length || !recordedUrl) return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if (!motion?.create || !trackCtx) {message('Módulo de rastreio indisponível. Atualize todos os arquivos do aplicativo.');return;}
      pointTrails.clear();
      const currentTime=video.currentTime;
      motionTracker=motion.create({video,annotations:annotations.map(item=>({
        kind:item.kind,color:item.color,role:item.role,supplementary:!!item.supplementary,points:item.points.map(p=>({...p}))})),
        sourceWidth:canvas.width,sourceHeight:canvas.height,
        isReversePlaying:()=>backwardMode&&reverseFrame!==null,
        isPingPongEnabled:()=>byId('pingpong').checked,
        onPoints:(points,w,h,t)=>paintTracked(points,w,h,t),
        onLost:reason=>{
          haltReverse();stopTracking();video.pause();
          message(`Rastreio interrompido em ${video.currentTime.toFixed(1).replace('.',',')} s. ${reason} Não use esse ângulo sem conferir os marcadores.`);
        },
        onDone:()=>{stopTracking();message('Fim do vídeo. Rastreio encerrado; confira os ângulos antes de usar.');}
      });
      showVideo(true);trackOverlay.hidden=false;
      trackingActive=true;updateCameraControls();
      const started=await motionTracker.start();
      if (!started) {stopTracking();showVideo(false);return;}
      message(`Rastreio experimental iniciado em ${currentTime.toFixed(1).replace('.',',')} s. Use marcadores contrastantes e interrompa se um ponto se afastar da articulação.`);
    }
    async function scanShortSegment(){
      if(scanningActive||trackingActive||!lastFrameFromVideo||!hasFileVideo()||
        !annotations.some(item=>item.kind==='angle'))return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanWindow){message('Atualize também athlete-motion.js para usar a busca de extensão.');return;}
      const radius=Number(byId('scan-radius').value)||0.5;
      const fps=Number(byId('file-fps').value)||30;
      const center=video.currentTime;
      haltReverse();video.pause();
      scanCancelled=false;scanningActive=true;
      updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Buscando a extensão em ±${String(radius).replace('.',',')} s do quadro marcado. Aguarde; você pode interromper em “Parar rastreio”.`);
      try{
        const result=await motion.scanWindow({video,centerTime:center,radius,fps,
          annotations:annotations.map(item=>({kind:item.kind,color:item.color,role:item.role,supplementary:!!item.supplementary,
            points:item.points.map(p=>({...p}))})),
          sourceWidth:canvas.width,sourceHeight:canvas.height,
          shouldCancel:()=>scanCancelled,
          onProgress:progress=>message(`Analisando quadros próximos… ${progress.tested} conferidos · maior A ${format(progress.bestAngle)}° até agora.`)
        });
        if(scanCancelled)return;
        // Ao terminar, expõe o quadro em que a MAIOR leitura experimental ocorreu.
        // Os pontos desse quadro são correspondências rastreadas, não detecção anatômica.
        originalCtx.drawImage(video,0,0,original.width,original.height);
        annotations=result.best.shapes.map(item=>({kind:item.kind,color:item.color,role:item.role,supplementary:item.supplementary,
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
    function resetCycleResults(){
      cycleResult=null;cycleTrailsVisible=false;
      byId('cycle-results').hidden=true;
      if(photoLoaded)render();
    }
    function seekCycleFrame(time){
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
      });
    }
    async function showCycleFrame(which){
      if(!cycleResult||!hasFileVideo())return;
      const result=cycleResult;
      const chosen=which==='minimum'?result.minimum:
        which==='correct'?result.lastReliable:result.maximum;
      if(!chosen)return;
      try{
        haltReverse();video.pause();
        await seekCycleFrame(chosen.time);
        if(cycleResult!==result)return;
        originalCtx.drawImage(video,0,0,original.width,original.height);
        annotations=chosen.shapes.map(item=>({kind:item.kind,color:item.color,role:item.role,
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
        !annotations.some(item=>item.kind==='angle'))return;
      const motion=globalThis.PAIVA_MOTION_TRACKER;
      if(!motion?.scanCycle){message('Atualize também o arquivo athlete-motion.js.');return;}
      const start=video.currentTime;
      const duration=Number(byId('cycle-duration').value)||.75;
      const fps=Number(byId('file-fps').value)||30;
      resetCycleResults();
      haltReverse();video.pause();
      scanCancelled=false;scanningActive=true;updateCameraControls();
      for(const button of section.querySelectorAll('[data-2d-tool]'))button.disabled=true;
      message(`Rastreando um giro a partir de ${clockTime(start)} (${duration.toFixed(2).replace('.',',')} s). Aguarde; “Parar rastreio” cancela a busca.`);
      try{
        const result=await motion.scanCycle({video,startTime:start,duration,fps,
          annotations:annotations.map(item=>({kind:item.kind,role:item.role,
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
      haltReverse();stopTracking();stopStream();video.pause();resetCycleResults();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl=URL.createObjectURL(file);
      currentVideoFile=file;
      video.srcObject=null;video.src=recordedUrl;video.controls=false;
      video.muted=true;video.autoplay=false;video.load();
      video.playbackRate=Number(byId('speed').value)||1;
      fineNavigationEpoch++;
      pendingScrubTime=null;scrubActive=false;scrubPointerDown=false;scrubReleasePending=false;
      lastFrameFromVideo=false;
      stillFromVideo=false;
      fineTrails.clear();fineUncertain=[];finePeak=null;
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
        haltReverse();video.pause();video.currentTime=Math.max(0,Math.min(duration,adjusted));
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
        haltReverse();video.pause();
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
      if(backwardMode){
        if(reverseFrame===null)reverseFrame=requestAnimationFrame(reverseTick);
        message('Vídeo retornando. Clique em Pausar no instante desejado.');
        return;
      }
      if(!trackingActive && lastFrameFromVideo && annotations.length && byId('auto-track').checked){
        startTracking();return;
      }
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
      haltReverse(false);video.pause();
      savePausedOverlay();
      message('Vídeo pausado. Arraste o Ângulo, Linha ou Ponto diretamente na imagem para começar a análise.');
    }
    function togglePlayback() {
      if(scanningActive||!hasFileVideo())return;
      if(!video.paused || (backwardMode && reverseFrame!==null))pausePlayback();
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
      if(!byId('pingpong').checked && backwardMode){
        haltReverse();video.pause();
      }
      message(byId('pingpong').checked?'Vai e volta ativado: o vídeo retornará automaticamente no final.':'Vai e volta desativado.');
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
    byId('scrub').addEventListener('pointerdown',()=>{
      scrubPointerDown=true;scrubActive=true;scrubReleasePending=false;
      fineNavigationEpoch++;
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
      fineNavigationEpoch++;
      scrubActive=true;
      if(!scrubPointerDown)scrubReleasePending=true;
      haltReverse();video.pause();
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
      haltReverse();video.pause();
      // Reaproveita o canvas e seu contexto enquanto a gravação for a mesma:
      // menos alocações durante a rolagem, sem mudar o rastreamento validado.
      if(!fineSampler||fineSamplerSource!==source){
        fineSampler=motion.createFrameSampler(video);
        fineSamplerSource=source;
      }
      const sampler=fineSampler;
      const before=sampler.sample();
      if(!finePeak){
        const angle=annotations.find(a=>a.kind==='angle'&&a.points.length===3);
        const degrees=angle?angleDegrees(...angle.points):null;
        if(degrees!==null)finePeak={time:from,angle:degrees,
          shapes:annotations.map(a=>({...a,points:a.points.map(p=>({...p}))}))};
      }
      await seekCycleFrame(next);
      if(source!==recordedUrl||navigationEpoch!==fineNavigationEpoch||
        !lastFrameFromVideo||!stillFromVideo||canvas.hidden)return;
      const after=sampler.sample();
      const result=motion.trackFineShapes(before,after,sampler.width,sampler.height,
        annotations,canvas.width,canvas.height,{
          patch:Number(byId('fine-patch').value),search:Number(byId('fine-search').value)
        });
      const previous=annotations;
      annotations=result.shapes;
      fineUncertain=result.lost;
      for(const match of result.moved){
        const key=`${match.item}:${match.point}`;
        const old=previous[match.item]?.points?.[match.point];
        const current=annotations[match.item]?.points?.[match.point];
        if(!old||!current)continue;
        const path=fineTrails.get(key)||[{...old}];path.push({...current});
        if(path.length>13)path.shift();fineTrails.set(key,path);
      }
      const firstAngle=annotations.find(a=>a.kind==='angle'&&a.points.length===3);
      const angle=firstAngle?angleDegrees(...firstAngle.points):null;
      if(angle!==null&&!result.lost.some(p=>annotations[p.item]===firstAngle)&&(!finePeak||angle>finePeak.angle)){
        finePeak={time:next,angle,shapes:annotations.map(a=>({...a,points:a.points.map(p=>({...p}))}))};
      }
      originalCtx.drawImage(video,0,0,original.width,original.height);
      lastFrameFromVideo=true;stillFromVideo=true;
      render();syncTimeline();
      byId('fine-peak').disabled=!finePeak;
      // Evita codificar um PNG enquanto a rodinha ainda está avançando quadros.
      schedulePhotoSave(1600);
      const label=firstAngle?displayedAngle(firstAngle):null;
      const lost=result.lost.length;
      const readout=label===null&&annotations.some(item=>item.kind==='point')?'Ponto · rastro':
        label===null?'marcadores':`A ${format(label)}°`;
      byId('fine-readout').textContent=`${clockTime(next)} · ${readout}${finePeak?` · pico ${format(finePeak.angle)}°`:''}${lost?` · ${lost} ponto(s) corrigir`:''}`;
      message(lost?`Quadro ${clockTime(next)}: ${lost} marcador(es) em laranja perderam a referência. Arraste cada um para o local correto e continue com a rodinha.`:
        `Quadro ${clockTime(next)}: pontos acompanhados. Confira o alinhamento anatômico; mova a rodinha novamente para procurar a extensão máxima.`);
    }
    function stepFrame(direction,preserveCapturedImage=false) {
      if(scanningActive||!hasFileVideo())return;
      const fine=lastFrameFromVideo&&stillFromVideo&&!canvas.hidden&&annotations.length&&byId('fine-mode').checked;
      if(fine){
        if(finePending>=5)return;
        finePending++;
        fineSequence=fineSequence.catch(()=>{}).then(()=>fineStepFrame(direction)).catch(error=>{
          message(`Não foi possível seguir os pontos neste quadro: ${error?.message||'erro no vídeo'}. Corrija o marcador ou altere o FPS.`);
        }).finally(()=>{finePending--;});
        return;
      }
      haltReverse();video.pause();
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
    byId('prev-frame').addEventListener('click',()=>stepFrame(-1,true));
    byId('next-frame').addEventListener('click',()=>stepFrame(1,true));
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
      const peak=finePeak;haltReverse();video.pause();
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
    playerArea.setAttribute('aria-label','Área de análise 2D. Botão direito pausa ou reproduz; Espaço alterna vídeo; setas mudam os quadros.');
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
      haltReverse();
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
      if(hasFileVideo() && byId('pingpong').checked)startReverse();
    });

    function setFrame(source, naturalWidth, naturalHeight) {
      if (!naturalWidth || !naturalHeight) return false;
      const scale = Math.min(1,1400/Math.max(naturalWidth,naturalHeight));
      const width = Math.max(1,Math.round(naturalWidth*scale));
      const height = Math.max(1,Math.round(naturalHeight*scale));
      original.width = canvas.width = width;
      original.height = canvas.height = height;
      originalCtx.drawImage(source,0,0,width,height);
      photoLoaded = true;
      stillFromVideo=source===video;
      fineTrails.clear();fineUncertain=[];finePeak=null;
      lastDeletedAnnotation=null;closeDeleteMenu();
      annotations=[];draft=[];angleSequence=[];activeDrag=null;activeDraw=null;selectedIndex=-1;
      render();showVideo(false);updateZoom(Number(byId('zoom').value));
      newPhotoRecord();schedulePhotoSave();
      return true;
    }

    function videoCanCapture() {
      return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    }

    async function startCamera() {
      if (cameraStream) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        message('Webcam indisponível. Abra o site por HTTPS no Chrome ou Edge do Windows e confira a permissão de câmera.');
        return;
      }
      byId('camera-start').disabled = true;
      try {
        haltReverse();stopTracking();lastFrameFromVideo=false;
        const stream = await navigator.mediaDevices.getUserMedia({
          video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}, audio:false
        });
        cameraStream = stream;
        video.pause();video.removeAttribute('src');video.srcObject=stream;
        video.controls = false;video.muted = true;video.autoplay = true;
        showVideo(true);byId('back-video').hidden=true;
        try {await video.play();} catch (_) { /* alguns navegadores exigem outro clique */ }
        byId('camera-info').textContent = 'Webcam ligada. Apenas vídeo local, sem áudio nem envio à internet.';
        message('Webcam ligada. Você pode gravar ou começar um ângulo diretamente na imagem para congelar o quadro.');
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
      try {
        recorder = new MediaRecorder(cameraStream,supported
          ? {mimeType:supported,videoBitsPerSecond:1500000}
          : {videoBitsPerSecond:1500000});
      } catch (_) {message('A gravação não é compatível com esta webcam/navegador. Tente marcar o ângulo diretamente sobre a imagem.');return;}
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
        saveVideoRecord(movie,filename,'Gravação da webcam · Análise 2D');
        const download = byId('video-download');
        download.href=recordedUrl;
        download.download=filename;
        download.hidden=false;
        video.pause();video.srcObject=null;video.src=recordedUrl;
        lastFrameFromVideo=false;
        stillFromVideo=false;
        video.controls=false;video.muted=true;video.autoplay=false;video.load();
        showVideo(true);byId('back-video').hidden=true;
        byId('camera-info').textContent = 'Vídeo registrado automaticamente no navegador. Use Baixar para cópia permanente.';
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
      byId('camera-info').textContent='Gravando vídeo local · máximo de 3 minutos. Sem áudio.';
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
      haltReverse();stopStream();
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
      haltReverse();
      if (trackingActive) stopTracking();
      video.pause();
      if (!videoCanCapture() || !setFrame(video,video.videoWidth,video.videoHeight)) {
        message('Aguarde o vídeo carregar. Depois pause no quadro desejado e tente novamente.');return false;
      }
      lastFrameFromVideo=!cameraStream && !!recordedUrl;
      if (cameraStream) {
        stopStream();video.srcObject=null;
        byId('back-video').hidden=true;
      } else byId('back-video').hidden = !recordedUrl;
      updateCameraControls();
      message('Quadro congelado. Ângulo: clique no trocânter, côndilo e maléolo; depois arraste qualquer ponto para refinar.');
      return true;
    }

    byId('camera-start').addEventListener('click',startCamera);
    byId('record').addEventListener('click',startRecording);
    byId('stop-record').addEventListener('click',stopRecording);
    byId('camera-stop').addEventListener('click',stopCamera);
    byId('capture').addEventListener('click',captureVideoFrame);
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
      haltReverse();stopTracking();
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
        haltReverse();stopTracking();resetCycleResults();lastFrameFromVideo=false;
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
      // Manipulação direta: uma ponta já desenhada pode ser puxada mesmo
      // enquanto a ferramenta Ângulo/Linha/Ponto continua selecionada.
      const endpoint=findPoint(point,event);
      // No rastreio fino qualquer referência pode ser corrigida com o mouse,
      // mesmo que a ferramenta atualmente selecionada seja de outro tipo.
      if(endpoint){
        activeDrag=endpoint;
        selectedIndex=endpoint.item;
        if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
        return;
      }
      if(tool==='angle'||tool==='line'){
        const existingSegment=findSegment(point,event);
        if(existingSegment&&(tool===annotations[existingSegment.item]?.kind)){
          activeDrag=existingSegment;selectedIndex=existingSegment.item;
          if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* gesto transferido */}
          return;
        }
      }
      if(tool==='point'){
        annotations.push({kind:'point',role:byId('point-role').value,points:[point]});
        lastDeletedAnnotation=null;
        selectedIndex=annotations.length-1;
        render();updateCameraControls();
        schedulePhotoSave();
        message(stillFromVideo?'Ponto colocado. Com “Seguir pontos por quadro” ligado, gire a rodinha: o pontinho será rastreado e seu trajeto ficará desenhado.':
          'Ponto colocado. Para medir outro local, escolha Calcanhar ou Quadril no seletor e clique no atleta.');
        return;
      }
      if (tool==='edit') {
        activeDrag=findSegment(point,event);
        if (activeDrag) {
          selectedIndex=activeDrag.item;
          if(!forwardedGesture)try{canvas.setPointerCapture?.(event.pointerId);}catch(_){/* ponteiro transferido do vídeo */}
        } else message('Clique sobre uma ponta ou sobre o corpo da linha para arrastá-la.');
        return;
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
        draft=activeDraw.kind==='angle-sequence'?[...angleSequence,p]:
          draftFromDrag(activeDraw.kind,activeDraw.start,p,event.shiftKey);
        render();return;
      }
      if (!activeDrag || event.pointerId!==activeDrag.pointer)return;
      event.preventDefault();
      if (activeDrag.index>=0) annotations[activeDrag.item].points[activeDrag.index]=p;
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
          angleSequence=[];draft=[];render();
          message('Marcação interrompida. Comece novamente.');
        } else if(activeDraw.kind==='angle-sequence'||(activeDraw.kind==='angle'&&travel<8)){
          angleSequence.push(p);
          if(angleSequence.length===3){
            annotations.push({kind:'angle',points:angleSequence.map(q=>({...q})),color:activeAngleColor});
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
          annotations.push({kind:activeDraw.kind,points,
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
        if(stillFromVideo&&byId('fine-mode').checked){
          for(const key of fineTrails.keys())if(key.startsWith(`${changed}:`))fineTrails.delete(key);
          finePeak=null;
          byId('fine-readout').textContent='Ponto corrigido · continue com a rodinha';
          updateCameraControls();render();
        }
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
        draft=[];angleSequence=[];
        message('Marcação incompleta cancelada.');
      }else if(lastDeletedAnnotation){
        const {index,item}=lastDeletedAnnotation;
        annotations.splice(Math.min(index,annotations.length),0,item);
        selectedIndex=Math.min(index,annotations.length-1);
        lastDeletedAnnotation=null;
        message('Marcação recuperada na posição original.');
      }else{
        annotations.pop();selectedIndex=annotations.length-1;
        message('Última anotação removida.');
      }
      fineTrails.clear();fineUncertain=[];finePeak=null;
      updateCameraControls();
      render();
      schedulePhotoSave();
    });
    byId('clear').addEventListener('click',() => {
      if (annotations.length && !window.confirm('Remover todas as linhas e ângulos desta foto?'))return;
      annotations=[];draft=[];angleSequence=[];selectedIndex=-1;lastDeletedAnnotation=null;
      fineTrails.clear();fineUncertain=[];finePeak=null;
      closeDeleteMenu();render();message('Marcações removidas. A fotografia foi preservada.');
      schedulePhotoSave();
      updateCameraControls();
    });
    byId('save').addEventListener('click',() => {
      if (!photoLoaded) {message('Carregue uma fotografia antes de salvar.');return;}
      canvas.toBlob(blob => {
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

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
