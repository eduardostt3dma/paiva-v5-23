/* PAIVA V5.31 — identidade e exclusão persistente de marcações 2D.
   Os projetos V1 sem uid são migrados em memória por tipo/índice.
   Não confundir apagar uma trilha com apagar apenas um quadro. */
(() => {
  'use strict';
  const validId=id=>typeof id==='string'&&id.length>0&&id.length<=120;
  const legacyId=(mark,index)=>'legacy:'+mark.kind+':'+index;

  function normalizeEntry(entry){
    if(!entry||!Array.isArray(entry.annotations))return entry;
    entry.annotations.forEach((mark,index)=>{
      if(!validId(mark.uid))mark.uid=legacyId(mark,index);
    });
    return entry;
  }

  function normalizeFrames(frames){
    for(const entry of frames.values())normalizeEntry(entry);
    return frames;
  }

  function removeFromFrames(frames,uid){
    if(!validId(uid))return [];
    const changes=[];
    for(const [key,entry] of frames){
      normalizeEntry(entry);
      if(!entry?.annotations?.some(mark=>mark.uid===uid))continue;
      // Copiamos somente os quadros afetados para que Desfazer recupere
      // exatamente pontos, trilhas, seleção de ângulos e flags anteriores.
      changes.push({key,entry:JSON.parse(JSON.stringify(entry))});
      const hadAngle=entry.annotations.some(mark=>mark.kind==='angle'||mark.kind==='full8');
      const removed=[];
      entry.annotations=entry.annotations.filter((mark,index)=>{
        if(mark.uid===uid){removed.push(index);return false;}
        return true;
      });
      const remap=index=>index-removed.filter(old=>old<index).length;
      entry.trails=(entry.trails||[]).filter(path=>!removed.includes(path.index))
        .map(path=>({...path,index:remap(path.index)}));
      entry.uncertain=(entry.uncertain||[]).filter(point=>!removed.includes(point.item))
        .map(point=>({...point,item:remap(point.item)}));
      entry.cleared=entry.annotations.length===0;
      entry.angularCleared=entry.angularCleared===true||
        (hadAngle&&!entry.annotations.some(mark=>mark.kind==='angle'||mark.kind==='full8'));
      entry.source='manual';
    }
    return changes;
  }

  function restoreFrames(frames,changes){
    if(!Array.isArray(changes))return;
    for(const change of changes){
      if(change&&Number.isInteger(change.key)&&change.entry)
        frames.set(change.key,JSON.parse(JSON.stringify(change.entry)));
    }
  }

  window.PAIVA_2D_HISTORY={normalizeEntry,normalizeFrames,removeFromFrames,
    restoreFrames,legacyId};
})();
